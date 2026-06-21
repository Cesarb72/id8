import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

interface ProviderCallSiteClassification {
  filePath: string
  functionName: string
  callPurpose: string
  trigger: string
  envelope: 'yes' | 'blocked-by-source-mode' | 'default-closed-runtime-envelope'
  pageRenderSurface: boolean
  classification: 'enveloped' | 'blocked' | 'intentionally-explicit-final-generation'
  evidence: string[]
}

const callSites: ProviderCallSiteClassification[] = [
  {
    filePath: 'src/domain/sources/fetchLivePlaces.ts',
    functionName: 'fetchLivePlaces',
    callPurpose: 'retrieval_supply',
    trigger: 'Step B Curate final generation through private live smoke wrapper',
    envelope: 'yes',
    pageRenderSurface: false,
    classification: 'intentionally-explicit-final-generation',
    evidence: [
      'retrieveVenues passes options.liveEnvelope caps into fetchLivePlaces',
      'retrieveVenues forces curated retrieval unless liveEnvelope.liveProviderAllowed === true',
      'runGeneratePlan strips raw caller liveEnvelope before internal retrieval',
      'Step B Curate wrapper owns the private 3/3/1 envelope path',
      'fetchLivePlaces forwards options.envelope to ProviderAdapter.searchPlaces',
    ],
  },
  {
    filePath: 'src/domain/nearby/fetchNearbyPlacesForWaypoint.ts',
    functionName: 'fetchNearbyPlacesForWaypoint',
    callPurpose: 'waypoint_nearby',
    trigger: 'JourneyMapReal active waypoint render/effect; default closed unless runtimeLiveEnvelope is explicit',
    envelope: 'default-closed-runtime-envelope',
    pageRenderSurface: true,
    classification: 'blocked',
    evidence: [
      'fetchNearbyPlacesForWaypoint defaults to CLOSED_RUNTIME_LIVE_ENVELOPE',
      'runtimeLiveEnvelope.liveProviderAllowed !== true returns runtime-provider-disabled before searchPlaces',
      'JourneyMapReal checks runtimeLiveEnvelope.liveProviderAllowed before calling fetchNearbyPlacesForWaypoint',
    ],
  },
  {
    filePath: 'src/domain/providers/ProviderAdapter.ts',
    functionName: 'searchAnchorPlaces',
    callPurpose: 'anchor_search',
    trigger: 'Build anchor user action through searchAnchorVenues',
    envelope: 'blocked-by-source-mode',
    pageRenderSurface: false,
    classification: 'blocked',
    evidence: [
      'searchAnchorVenues passes sourceMode: curated',
      'ProviderAdapter.searchPlaces blocks sourceMode === curated before fetch',
    ],
  },
  {
    filePath: 'src/domain/providers/ProviderAdapter.ts',
    functionName: 'getNearbyPlaces',
    callPurpose: 'waypoint_nearby',
    trigger: 'Provider wrapper; no production caller in src',
    envelope: 'default-closed-runtime-envelope',
    pageRenderSurface: false,
    classification: 'blocked',
    evidence: [
      'No src caller imports getNearbyPlaces',
      'Waypoint render/effect path uses fetchNearbyPlacesForWaypoint, which is runtime-envelope blocked',
    ],
  },
  {
    filePath: 'src/domain/providers/buildProviderSourceOpportunity.ts',
    functionName: 'buildProviderSourceOpportunity',
    callPurpose: 'build_anchor_nearby',
    trigger: 'Build-anchor provider supply shadow/user action; explicit live envelope required',
    envelope: 'default-closed-runtime-envelope',
    pageRenderSurface: false,
    classification: 'blocked',
    evidence: [
      'buildProviderSourceOpportunity defaults to CLOSED_RUNTIME_LIVE_ENVELOPE',
      'liveEnvelope.liveProviderAllowed !== true returns provider_request_blocked before searchPlaces',
      'explicit build-provider dry-run harness passes a deliberate live envelope',
    ],
  },
]

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function countMatches(source: string, pattern: RegExp): number {
  return Array.from(source.matchAll(pattern)).length
}

function assertSourceContains(filePath: string, needle: string): void {
  const source = readFileSync(filePath, 'utf8')
  assert(source.includes(needle), `${filePath}: expected source to contain ${needle}`)
}

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    const stats = statSync(path)
    if (stats.isDirectory()) {
      return listSourceFiles(path)
    }
    return path.endsWith('.ts') || path.endsWith('.tsx') ? [path] : []
  })
}

function assertDirectSearchPlacesInventory(): void {
  const srcFiles = [
    'src/domain/sources/fetchLivePlaces.ts',
    'src/domain/nearby/fetchNearbyPlacesForWaypoint.ts',
    'src/domain/providers/ProviderAdapter.ts',
    'src/domain/providers/buildProviderSourceOpportunity.ts',
  ]
  const directSearchPlacesCalls = srcFiles.reduce((sum, filePath) => {
    const source = readFileSync(filePath, 'utf8')
    return sum + countMatches(source, /\bsearchPlaces(?:<[^>]+>)?\s*\(/g)
  }, 0)

  const providerAdapterSource = readFileSync('src/domain/providers/ProviderAdapter.ts', 'utf8')
  const functionDefinitionCount = countMatches(
    providerAdapterSource,
    /export async function searchPlaces</g,
  )
  const expectedCallCount = callSites.length + functionDefinitionCount
  assert(
    directSearchPlacesCalls === expectedCallCount,
    `Expected ${expectedCallCount} ProviderAdapter.searchPlaces references, found ${directSearchPlacesCalls}. Update the call-site inventory.`,
  )
}

function assertNoUnclassifiedWrapperCallers(): void {
  const sourceFiles = [
    'src/domain/search/searchAnchorVenues.ts',
    'src/components/journey/JourneyMapReal.tsx',
    'src/domain/providers/buildProviderSupplyDryRunHarness.ts',
    'src/domain/retrieval/retrieveVenues.ts',
    'src/domain/retrieval/hybridPortableAdapter.ts',
  ]
  const combined = sourceFiles.map((filePath) => readFileSync(filePath, 'utf8')).join('\n')
  assert(
    combined.includes('sourceMode: \'curated\'') && combined.includes('searchAnchorPlaces'),
    'anchor_search wrapper must remain sourceMode curated blocked.',
  )
  assert(
    combined.includes('fetchNearbyPlacesForWaypoint(activeWaypoint, { runtimeLiveEnvelope })'),
    'JourneyMapReal must pass runtimeLiveEnvelope into fetchNearbyPlacesForWaypoint.',
  )
  assert(
    combined.includes('liveProviderAllowed: true') && combined.includes('buildProviderSourceOpportunity'),
    'Explicit build-provider harness must construct a live envelope deliberately.',
  )
  assert(
    combined.includes('fetchHybridPortableVenues(intent.city, { liveEnvelope: options.liveEnvelope })'),
    'Hybrid portable retrieval must receive the explicit retrieval live envelope.',
  )
}

function assertStepBCuratePrivateEnvelopeBoundary(): void {
  const runGeneratePlanSource = readFileSync('src/domain/runGeneratePlan.ts', 'utf8')
  const appServiceSource = readFileSync('src/app/services/arcApplicationService.ts', 'utf8')
  const appShellSource = readFileSync('src/app/AppShell.tsx', 'utf8')
  const sandboxConciergeSource = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')
  const runGeneratePlanOptionsMatch = runGeneratePlanSource.match(
    /export interface RunGeneratePlanOptions \{[\s\S]*?\n\}/,
  )
  assert(runGeneratePlanOptionsMatch, 'Expected exported RunGeneratePlanOptions interface.')
  assert(
    !runGeneratePlanOptionsMatch[0].includes('liveEnvelope'),
    'RunGeneratePlanOptions must not expose liveEnvelope.',
  )
  assert(
    runGeneratePlanSource.includes('liveEnvelope: _ignoredLiveEnvelope'),
    'runGeneratePlan must strip raw caller liveEnvelope values.',
  )
  assert(
    runGeneratePlanSource.includes('const STEP_B_CURATE_LIVE_SMOKE_ENVELOPE: LiveProviderEnvelope = {') &&
      runGeneratePlanSource.includes('maxProviderCalls: 3') &&
      runGeneratePlanSource.includes('maxQueryLabels: 3') &&
      runGeneratePlanSource.includes('maxCenters: 1'),
    'Step B Curate live smoke envelope must remain private and fixed at 3/3/1.',
  )
  assert(
    appServiceSource.includes('gate.environment === \'default\'') &&
      appServiceSource.includes('gate.mode === \'curate\'') &&
      appServiceSource.includes('gate.inputMode === \'curate\'') &&
      appServiceSource.includes('gate.generationTarget === \'final\'') &&
      appServiceSource.includes('gate.selectedStarterPackPresent') &&
      appServiceSource.includes('gate.invocation === \'public_selected_curate_review_route\'') &&
      appServiceSource.includes('gate.userSourceModeOverrideApplied === false') &&
      appServiceSource.includes('gate.smokeSwitchEnabled'),
    'Step B Curate app-service gate must include every approved predicate.',
  )
  assert(
    countMatches(appShellSource, /\brunStepBCurateLiveSmokePlanBuild\(\{/g) === 0 &&
      !appShellSource.includes('readStepBCurateLiveSmokeEnabled()'),
    'AppShell is archive-mounted and must not remain a Step B Curate wrapper entry point.',
  )
  assert(
    countMatches(sandboxConciergeSource, /\brunStepBCurateLiveSmokePlanBuild\(\{/g) === 1,
    'SandboxConciergePage must have the only runtime Step B Curate wrapper call site.',
  )
  assert(
    sandboxConciergeSource.includes("invocation === 'public_selected_curate_review_route'") &&
      sandboxConciergeSource.includes("'public_selected_curate_review_route'") &&
      sandboxConciergeSource.includes('userSourceModeOverrideApplied: false'),
    'Public selected Curate review-route invocation must be explicit and not authorized by broad sourceModeOverrideApplied.',
  )
  assert(
    sandboxConciergeSource.includes('const stepBCurateReviewRouteForceGeneration = shouldApplyStepBCurateLiveSmoke({') &&
      sandboxConciergeSource.includes('!stepBCurateReviewRouteForceGeneration &&') &&
      sandboxConciergeSource.includes('committedPlanMatchesGenerateDirection || (plan && previewSynced)'),
    'Prepared-route reveal early return may only be bypassed by the exact Step B Curate review-route gate.',
  )
  assert(
    sandboxConciergeSource.includes('!stepBCurateReviewRouteForceGeneration &&\n      isCurateWrapperActive &&\n      selectedCuratePreviewCommitability?.status === \'committable\'') &&
      sandboxConciergeSource.includes('selectedCuratePreviewCommitability.approvedRefinementEntryPayload'),
    'Curate approved-payload reveal branch may only be bypassed by the exact Step B Curate review-route gate.',
  )
  assert(
    sandboxConciergeSource.includes('readStepBCurateLiveSmokeEnabled()') &&
      !sandboxConciergeSource.includes('URLSearchParams(window.location.search).get(\'VITE_ID8_STEP_B_CURATE_LIVE_SMOKE\')'),
    'Step B smoke switch must be deployment/app env driven, not URL-param driven.',
  )

  const importingFiles = listSourceFiles('src').filter((filePath) =>
    readFileSync(filePath, 'utf8').includes('runStepBCurateLiveSmokeGeneratePlan'),
  )
  assert(
    importingFiles.length === 2 &&
      importingFiles.includes(join('src', 'domain', 'runGeneratePlan.ts')) &&
      importingFiles.includes(join('src', 'app', 'services', 'arcApplicationService.ts')),
    `Only arcApplicationService may import the internal Step B generator; found ${importingFiles.join(', ')}.`,
  )
}

function main(): void {
  assertDirectSearchPlacesInventory()
  assertNoUnclassifiedWrapperCallers()
  assertStepBCuratePrivateEnvelopeBoundary()
  assertSourceContains(
    'src/domain/retrieval/liveEnvelope.ts',
    'export const CLOSED_RUNTIME_LIVE_ENVELOPE',
  )
  assertSourceContains(
    'src/domain/nearby/fetchNearbyPlacesForWaypoint.ts',
    "reason: 'runtime-provider-disabled'",
  )
  assertSourceContains(
    'src/domain/providers/buildProviderSourceOpportunity.ts',
    "blockedReason: 'provider_request_blocked'",
  )

  for (const callSite of callSites) {
    process.stdout.write(
      [
        `${callSite.callPurpose}: ${callSite.filePath} :: ${callSite.functionName}`,
        `trigger=${callSite.trigger}`,
        `envelope=${callSite.envelope}`,
        `pageRenderSurface=${String(callSite.pageRenderSurface)}`,
        `classification=${callSite.classification}`,
      ].join(' | ') + '\n',
    )
  }
  process.stdout.write('provider call-site inventory: passed\n')
}

main()
