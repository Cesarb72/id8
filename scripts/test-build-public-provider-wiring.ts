import { readFileSync } from 'node:fs'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function sourceSlice(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start + startMarker.length)
  assert(start >= 0, `Missing source marker: ${startMarker}`)
  assert(end > start, `Missing source marker after ${startMarker}: ${endMarker}`)
  return source.slice(start, end)
}

const originalFetch = globalThis.fetch
const originalSourceMode = process.env.VITE_ID8_SOURCE_MODE
let fetchCallCount = 0

globalThis.fetch = (async () => {
  fetchCallCount += 1
  throw new Error('test-build-public-provider-wiring must not call fetch.')
}) as typeof fetch

try {
  const wiring = await import('../src/domain/providers/buildProviderPublicLiveWiring.ts')
  const sandboxSource = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')
  const providerAdapterSource = readFileSync('src/domain/providers/ProviderAdapter.ts', 'utf8')
  const sourceModeSource = readFileSync('src/domain/sources/getSourceMode.ts', 'utf8')
  const buildProviderSource = readFileSync('src/domain/providers/buildProviderSourceOpportunity.ts', 'utf8')
  const staticBuildSource = sandboxSource
  const appServiceSource = readFileSync('src/app/services/arcApplicationService.ts', 'utf8')

  const envelope = wiring.buildProviderPublicLiveEnvelope()
  assert(envelope.liveProviderAllowed === true, 'Build public live envelope must allow provider calls.')
  assert(envelope.maxProviderCalls === 3, 'Build public live envelope must cap provider calls at 3.')
  assert(envelope.maxQueryLabels === 3, 'Build public live envelope must cap query labels at 3.')
  assert(envelope.maxCenters === 1, 'Build public live envelope must cap query centers at 1.')
  assert(
    wiring.BUILD_PROVIDER_PUBLIC_LIVE_ENVELOPE.maxProviderCalls === 3 &&
      wiring.BUILD_PROVIDER_PUBLIC_LIVE_ENVELOPE.maxQueryLabels === 3 &&
      wiring.BUILD_PROVIDER_PUBLIC_LIVE_ENVELOPE.maxCenters === 1,
    'Exported Build public envelope config must remain fixed at 3/3/1.',
  )

  const eligible = wiring.evaluateBuildProviderPublicLiveEligibility({
    isPublicSurface: true,
    isBuildWrapperActive: true,
    isDevOrSandboxCloseoutFlow: false,
    step2IntegrationFlagEnabled: true,
    supplyFlagEnabled: true,
    sourceMode: 'hybrid',
  })
  assert(eligible.eligible === true, 'Public Build must be eligible with flags and hybrid source mode.')
  assert(eligible.envelope?.maxProviderCalls === 3, 'Eligible result must attach the fixed envelope.')

  const liveEligible = wiring.evaluateBuildProviderPublicLiveEligibility({
    isPublicSurface: true,
    isBuildWrapperActive: true,
    isDevOrSandboxCloseoutFlow: false,
    step2IntegrationFlagEnabled: true,
    supplyFlagEnabled: true,
    sourceMode: 'live',
  })
  assert(liveEligible.eligible === true, 'Public Build must be eligible with live source mode.')

  const closedCases = [
    {
      name: 'non-public',
      input: { ...eligibleInput(), isPublicSurface: false },
      reason: 'not_public_surface',
    },
    {
      name: 'non-build',
      input: { ...eligibleInput(), isBuildWrapperActive: false },
      reason: 'not_build_mode',
    },
    {
      name: 'dev-sandbox',
      input: { ...eligibleInput(), isDevOrSandboxCloseoutFlow: true },
      reason: 'dev_or_sandbox_closeout_flow',
    },
    {
      name: 'integration flag missing',
      input: { ...eligibleInput(), step2IntegrationFlagEnabled: false },
      reason: 'step2_integration_flag_disabled',
    },
    {
      name: 'supply flag missing',
      input: { ...eligibleInput(), supplyFlagEnabled: false },
      reason: 'supply_flag_disabled',
    },
    {
      name: 'curated source mode',
      input: { ...eligibleInput(), sourceMode: 'curated' as const },
      reason: 'source_mode_not_live_compatible',
    },
    {
      name: 'missing source mode',
      input: { ...eligibleInput(), sourceMode: null },
      reason: 'source_mode_not_live_compatible',
    },
  ]

  closedCases.forEach((scenario) => {
    const result = wiring.evaluateBuildProviderPublicLiveEligibility(scenario.input)
    assert(result.eligible === false, `${scenario.name}: provider path must remain closed.`)
    assert(result.envelope === null, `${scenario.name}: closed provider path must not attach envelope.`)
    assert(
      result.reasons.includes(scenario.reason as never),
      `${scenario.name}: expected blocked reason ${scenario.reason}.`,
    )
  })

  process.env.VITE_ID8_SOURCE_MODE = 'hybrid'
  assert(
    wiring.readBuildProviderPublicLiveSourceMode() === 'hybrid',
    'Build public source-mode reader must read hybrid from env.',
  )
  process.env.VITE_ID8_SOURCE_MODE = 'curated'
  assert(
    wiring.readBuildProviderPublicLiveSourceMode() === 'curated',
    'Build public source-mode reader must preserve curated as a closed-mode signal.',
  )
  delete process.env.VITE_ID8_SOURCE_MODE
  assert(
    wiring.readBuildProviderPublicLiveSourceMode() === null,
    'Build public source-mode reader must fail closed when env is missing.',
  )

  assert(
    sandboxSource.includes('evaluateBuildProviderPublicLiveEligibility') &&
      sandboxSource.includes('readBuildProviderPublicLiveSourceMode'),
    'Sandbox Build page must use the public-live eligibility helper.',
  )
  assert(
    sandboxSource.includes('liveEnvelope: buildProviderLiveEnvelope'),
    'Build provider call must receive the explicit public-live envelope handle.',
  )
  const providerRequestKeyBlock = sourceSlice(
    sandboxSource,
    'const buildProviderRequestAnchorKey = useMemo(',
    'const [shadowBuildProviderSourceOpportunity',
  )
  assert(
    providerRequestKeyBlock.includes('buildProviderContinueIntent') &&
      providerRequestKeyBlock.includes('selectedBuildAnchorVenue'),
    'Build provider request key must require explicit Continue intent and a selected anchor.',
  )
  const providerDispatchEffectBlock = sourceSlice(
    sandboxSource,
    'if (!buildProviderRequestAnchorKey) {',
    'const shadowBuildProviderVerifiedOpportunity',
  )
  assert(
    providerDispatchEffectBlock.includes('buildProviderSourceOpportunity({') &&
      providerDispatchEffectBlock.includes('anchorVenue: selectedBuildAnchorVenue') &&
      providerDispatchEffectBlock.includes('liveEnvelope: buildProviderLiveEnvelope'),
    'Existing Build provider dispatch must stay in the governed effect behind the request key.',
  )
  const anchorSelectBlock = sourceSlice(
    sandboxSource,
    'const handleBuildAnchorSelect = useCallback((result: SelectableAnchorSearchResult) => {',
    'const handleBuildContinue = useCallback(() => {',
  )
  assert(
    anchorSelectBlock.includes('setBuildProviderContinueIntent(false)'),
    'Selecting a Build anchor must clear provider Continue intent.',
  )
  assert(
    !anchorSelectBlock.includes('setBuildProviderContinueIntent(true)') &&
      !anchorSelectBlock.includes('buildProviderSourceOpportunity(') &&
      !anchorSelectBlock.includes('/api/field/text-search'),
    'Selecting a Build anchor must not arm or call provider dispatch.',
  )
  const buildContinueBlock = sourceSlice(
    sandboxSource,
    'const handleBuildContinue = useCallback(() => {',
    'const handleSelectDirection = useCallback(',
  )
  assert(
    buildContinueBlock.includes('setBuildProviderContinueIntent(true)'),
    'Build Continue must explicitly arm provider dispatch.',
  )
  assert(
    buildContinueBlock.indexOf('setBuildProviderContinueIntent(true)') <
      buildContinueBlock.indexOf('setBuildAnchorReady(true)'),
    'Build Continue must arm provider dispatch before leaving the gate.',
  )
  assert(
    sandboxSource.includes('build_public_live_ineligible:') &&
      sandboxSource.includes('buildProviderPublicLiveEnvelope'),
    'Build diagnostics must expose public-live eligibility and envelope state.',
  )
  assert(
    sandboxSource.includes('const effectiveBuildSelectedAnchorRequiredRole') &&
      sandboxSource.includes('selectedCandidateRouteArtifact?.anchorRole ?? buildSelectedAnchorRequiredRole') &&
      sandboxSource.includes('activeCandidateAnchorRole:\n            effectiveBuildSelectedAnchorRequiredRole') &&
      sandboxSource.includes('selectedAnchorRequiredRole: effectiveBuildSelectedAnchorRequiredRole'),
    'Public Build promotion must use the selected/generated artifact anchor role instead of forcing highlight.',
  )
  assert(
    !sandboxSource.includes('GOOGLE_PLACES_API_KEY') &&
      !sandboxSource.includes('VITE_GOOGLE_PLACES_API_KEY'),
    'Sandbox page must not expose provider key names or browser key paths.',
  )

  assert(
    providerAdapterSource.includes("fetch(config.requestPath") &&
      sourceModeSource.includes("requestPath: '/api/field/text-search'"),
    'ProviderAdapter must route eligible provider calls through the Field proxy path.',
  )
  assert(
    !providerAdapterSource.includes('places.googleapis.com'),
    'ProviderAdapter must not contain a direct Google Places browser/provider fetch path.',
  )
  assert(
    buildProviderSource.includes("sourceMode: 'live'") &&
      buildProviderSource.includes('maxProviderCalls: liveEnvelope.maxProviderCalls') &&
      buildProviderSource.includes('maxQueryLabels: liveEnvelope.maxQueryLabels'),
    'Build provider supply must call ProviderAdapter in live mode with envelope caps.',
  )
  assert(
    buildProviderSource.includes("start: 'build-provider-start'") &&
      buildProviderSource.includes("highlight: 'build-provider-highlight'") &&
      buildProviderSource.includes("windDown: 'build-provider-winddown'") &&
      buildProviderSource.includes('return BUILD_PROVIDER_QUERY_LABELS.map((queryLabel)'),
    'Build provider dispatch labels must remain the role-diverse start/highlight/wind-down set.',
  )
  assert(
    buildProviderSource.includes('input.liveEnvelope ?? CLOSED_RUNTIME_LIVE_ENVELOPE') &&
      buildProviderSource.includes('liveEnvelope.liveProviderAllowed !== true'),
    'Build provider supply must remain closed when no explicit live envelope is supplied.',
  )

  assert(
    staticBuildSource.includes("id: 'step2_static_build_paper_plane'") &&
      staticBuildSource.includes("sourceMode: 'curated'") &&
      staticBuildSource.includes('build_static_pre_generation'),
    'Static Paper Plane pre-generation fallback must remain present and distinguishable.',
  )
  assert(
    sandboxSource.includes('publicBuildGeneratedRouteTruthOwnsPostContinueSurface') &&
      sandboxSource.includes('data-id8-route-card-display-source="build_generated_final_route"') &&
      sandboxSource.includes('canonicalRouteArtifact.finalRoute.stops.find((stop) => stop.role === role)') &&
      sandboxSource.includes('!publicBuildGeneratedRouteTruthOwnsPostContinueSurface && (publicSurpriseRouteChoiceVisible'),
    'Public Build post-Continue route card surface must be owned by generated/final route truth, not the static pre-generation card.',
  )
  const buildReviewDiagnosticsBlock = sourceSlice(
    sandboxSource,
    'const publicBuildReviewGatingDiagnosticsBase = {',
    'const publicBuildPrimaryActionText',
  )
  assert(
    buildReviewDiagnosticsBlock.includes('postGenerationRouteTruthOwnsSurface') &&
      sandboxSource.includes("publicBuildGeneratedRouteTruthOwnsPostContinueSurface\n    ? 'build_generated_final_route'") &&
      buildReviewDiagnosticsBlock.includes('selectedRouteStaticPreGeneration') &&
      buildReviewDiagnosticsBlock.includes('!publicBuildGeneratedRouteTruthOwnsPostContinueSurface'),
    'Build Review diagnostics must show generated/final route ownership and prevent static pre-generation selection after finalRoute exists.',
  )
  assert(
    sandboxSource.includes('const publicBuildReviewGatingDiagnostics = {') &&
      sandboxSource.includes('...publicBuildReviewGatingDiagnosticsBase') &&
      sandboxSource.includes('primaryActionText: publicBuildPrimaryActionText') &&
      sandboxSource.includes('buildRouteLifecycleDiagnostics.reviewEligible'),
    'Build Review diagnostics must derive final Review CTA visibility from route lifecycle eligibility.',
  )
  const buildProviderDiagnosticsBlock = sourceSlice(
    sandboxSource,
    'const buildProviderDiagnosticsAvailable = Boolean(shadowBuildProviderDiagnostics)',
    'const curateDisplayDedupeDebug = curateDisplayDedupeResult.debug',
  )
  assert(
    buildProviderDiagnosticsBlock.includes("'diagnostics_unavailable'") &&
      buildProviderDiagnosticsBlock.includes("'in_flight'") &&
      buildProviderDiagnosticsBlock.includes("'settled_with_results'") &&
      buildProviderDiagnosticsBlock.includes("'settled_zero_results'") &&
      buildProviderDiagnosticsBlock.includes('countsRepresentSettledProvider') &&
      buildProviderDiagnosticsBlock.includes('staticPreGenerationCandidateVisible') &&
      buildProviderDiagnosticsBlock.includes('mergedUniqueResultCount:') &&
      buildProviderDiagnosticsBlock.includes(': null') &&
      buildProviderDiagnosticsBlock.includes('rolePoolCounts:') &&
      buildProviderDiagnosticsBlock.includes(': null'),
    'Build provider diagnostics must distinguish pending/unavailable state from settled zero counts and static fallback.',
  )
  assert(
    appServiceSource.includes('const STEP_B_CURATE_LIVE_SMOKE_CANDIDATE_SUPPLY_ENVELOPE: LiveProviderEnvelope = {') &&
      appServiceSource.includes('maxProviderCalls: 3') &&
      appServiceSource.includes('maxQueryLabels: 3') &&
      appServiceSource.includes('maxCenters: 1'),
    'Existing Curate live smoke 3/3/1 envelope must remain intact.',
  )
  assert(fetchCallCount === 0, `Expected no fetch/provider calls, received ${fetchCallCount}.`)

  process.stdout.write('build public provider wiring: passed\n')
  process.stdout.write(
    JSON.stringify(
      {
        envelope,
        closedCases: closedCases.map((scenario) => scenario.name),
        fetchCallCount,
        fieldProxyPathOnly: true,
        staticFallbackDistinguishable: true,
      },
      null,
      2,
    ) + '\n',
  )
} finally {
  if (originalSourceMode === undefined) {
    delete process.env.VITE_ID8_SOURCE_MODE
  } else {
    process.env.VITE_ID8_SOURCE_MODE = originalSourceMode
  }
  globalThis.fetch = originalFetch
}

function eligibleInput() {
  return {
    isPublicSurface: true,
    isBuildWrapperActive: true,
    isDevOrSandboxCloseoutFlow: false,
    step2IntegrationFlagEnabled: true,
    supplyFlagEnabled: true,
    sourceMode: 'hybrid' as const,
  }
}
