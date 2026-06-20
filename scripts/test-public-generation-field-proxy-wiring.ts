import { buildPublicCurateCardTruthModel } from '../src/app/services/curate/publicCurateCardTruthService.ts'
import {
  runStepBCurateLiveSmokePlanBuild,
  shouldApplyStepBCurateLiveSmoke,
  type StepBCurateLiveSmokeGate,
} from '../src/app/services/arcApplicationService.ts'
import { starterPacks } from '../src/data/starterPacks.ts'
import { validateContractEntryArtifactPreCommitTruth } from '../src/domain/artifacts/contractEntryArtifact.ts'
import { runGeneratePlan } from '../src/domain/runGeneratePlan.ts'
import type { FieldTextSearchRequest, FieldTextSearchResponse } from '../src/domain/field/fieldProxyTypes.ts'
import type { ProviderVenue } from '../src/domain/providers/providerTypes.ts'
import type { ExperienceMode, IntentInput } from '../src/domain/types/intent.ts'
import type { StarterPack } from '../src/domain/types/starterPack.ts'

const originalFetch = globalThis.fetch
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
const managedEnvKeys = [
  'GOOGLE_PLACES_API_KEY',
  'VITE_GOOGLE_PLACES_API_KEY',
  'VITE_PROVIDER_API_KEY',
  'VITE_ID8_SOURCE_MODE',
  'VITE_ID8_FIELD_GOVERNED_MODE',
  'VITE_ID8_ALLOW_CURATED_FALLBACK',
  'VITE_ID8_ALLOW_BOOTSTRAP_FALLBACK',
  'VITE_ID8_ALLOW_DEFAULT_CITY_FALLBACK',
  'VITE_ID8_ALLOW_FIXTURE_INJECTION',
  'VITE_ID8_FAIL_CLOSED_ON_LIVE_INVENTORY_FAILURE',
] as const
const originalEnvValues = new Map(
  managedEnvKeys.map((key) => [key, process.env[key]] as const),
)

interface Scenario {
  mode: ExperienceMode
  input: IntentInput
  starterPack?: StarterPack
}

function buildStepBGate(
  scenario: Scenario,
  overrides: Partial<StepBCurateLiveSmokeGate> = {},
): StepBCurateLiveSmokeGate {
  return {
    environment: 'default',
    pathname: '/',
    mode: scenario.mode,
    inputMode: scenario.input.mode,
    generationTarget: 'final',
    selectedStarterPackPresent: Boolean(scenario.starterPack),
    invocation: scenario.mode === 'curate' ? 'public_selected_curate_review_route' : 'other',
    userSourceModeOverrideApplied: false,
    smokeSwitchEnabled: true,
    ...overrides,
  }
}

interface CapturedFieldRequest {
  url: string
  body: FieldTextSearchRequest
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function restoreEnv(): void {
  for (const key of managedEnvKeys) {
    const original = originalEnvValues.get(key)
    if (original === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = original
    }
  }
}

function setPublicRoute(): void {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: {
        pathname: '/',
        search: '',
      },
    },
  })
}

function restoreWindow(): void {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
  } else {
    Reflect.deleteProperty(globalThis, 'window')
  }
}

function resetEnv(): void {
  for (const key of managedEnvKeys) {
    delete process.env[key]
  }
}

function findStarterPack(id: string): StarterPack {
  const starterPack = starterPacks.find((candidate) => candidate.id === id)
  if (!starterPack) {
    throw new Error(`Missing starter pack: ${id}`)
  }
  return starterPack
}

function buildScenarios(): Scenario[] {
  const starterPack = findStarterPack('coffee-books')
  return [
    {
      mode: 'curate',
      starterPack,
      input: {
        mode: 'curate',
        persona: starterPack.personaBias ?? null,
        primaryVibe: starterPack.primaryAnchor,
        secondaryVibe: starterPack.secondaryAnchors?.[0],
        city: 'San Jose',
        distanceMode: starterPack.distanceMode ?? 'nearby',
        prefersHiddenGems: starterPack.lensPreset?.discoveryBias === 'high',
      },
    },
    {
      mode: 'surprise',
      input: {
        mode: 'surprise',
        persona: 'friends',
        primaryVibe: 'cultured',
        secondaryVibe: 'lively',
        city: 'San Jose',
        distanceMode: 'nearby',
        prefersHiddenGems: true,
      },
    },
    {
      mode: 'build',
      input: {
        mode: 'build',
        planningMode: 'user-led',
        persona: 'romantic',
        primaryVibe: 'cozy',
        secondaryVibe: 'cultured',
        city: 'San Jose',
        distanceMode: 'nearby',
        prefersHiddenGems: false,
      },
    },
  ]
}

function inferPrimaryType(query: string): string {
  const normalized = query.toLowerCase()
  if (normalized.includes('museum') || normalized.includes('gallery')) {
    return 'museum'
  }
  if (normalized.includes('park') || normalized.includes('trail')) {
    return 'park'
  }
  if (normalized.includes('bar') || normalized.includes('cocktail')) {
    return 'bar'
  }
  if (normalized.includes('dessert')) {
    return 'dessert_shop'
  }
  if (normalized.includes('coffee') || normalized.includes('cafe')) {
    return 'cafe'
  }
  return 'restaurant'
}

function buildProviderVenue(request: FieldTextSearchRequest, index: number): ProviderVenue {
  const primaryType = inferPrimaryType(request.textQuery)
  const latitude = (request.center?.lat ?? 37.3382) + index * 0.001
  const longitude = (request.center?.lng ?? -121.8863) - index * 0.001
  return {
    provider: 'google_places',
    providerRecordId: `mock-field-${request.mode}-${request.queryLabel}-${index + 1}`,
    displayName: `${request.mode} ${request.queryLabel} field venue ${index + 1}`,
    formattedAddress: `${100 + index} Field Proxy Way, San Jose, CA`,
    primaryType,
    types: [primaryType, 'point_of_interest', 'establishment'],
    businessStatus: 'OPERATIONAL',
    rating: 4.5,
    userRatingCount: 120 + index,
    location: {
      latitude,
      longitude,
    },
    sourceMode: 'live',
    rawPayloadAvailable: false,
    fetchedAt: 1_780_000_000_000 + index,
    completenessHints: {
      hasAddress: true,
      hasHours: false,
      hasLocation: true,
      hasPrimaryType: true,
      hasRating: true,
    },
  }
}

function buildFieldResponse(request: FieldTextSearchRequest): FieldTextSearchResponse {
  const results = [buildProviderVenue(request, 0), buildProviderVenue(request, 1)]
  return {
    ok: true,
    cache: 'miss',
    budget: {
      date: '2026-06-13',
      cap: 32,
      used: 1,
      remaining: 31,
    },
    results,
    diagnostics: {
      purpose: request.purpose,
      queryHash: 'mock-query-hash',
      providerStatus: 'mocked_field_proxy',
      resultCount: results.length,
      callConsumed: true,
    },
  }
}

function createFieldProxyFetch(calls: CapturedFieldRequest[]): typeof fetch {
  return async (input, init) => {
    const url = String(input)
    assert(url === '/api/field/text-search', `Expected Field proxy URL, received ${url}.`)
    assert(!url.includes('places.googleapis.com'), 'Browser must not call Google Places.')
    assert(init?.method === 'POST', 'Field proxy request must use POST.')
    const body = JSON.parse(String(init?.body)) as FieldTextSearchRequest
    calls.push({ url, body })
    return {
      ok: true,
      status: 200,
      async json() {
        return buildFieldResponse(body)
      },
    } as Response
  }
}

function createFailClosedFieldProxyFetch(calls: CapturedFieldRequest[]): typeof fetch {
  return async (input, init) => {
    const url = String(input)
    assert(url === '/api/field/text-search', `Expected Field proxy URL, received ${url}.`)
    const body = JSON.parse(String(init?.body)) as FieldTextSearchRequest
    calls.push({ url, body })
    return {
      ok: false,
      status: 503,
      async json() {
        return {
          ok: false,
          cache: 'miss',
          budget: {
            date: '2026-06-13',
            cap: 32,
            used: 0,
            remaining: 32,
          },
          results: [],
          diagnostics: {
            purpose: body.purpose,
            queryHash: 'mock-query-hash',
            blockedReason: 'field_proxy_not_activated',
            errorCode: 'field_proxy_not_activated',
            resultCount: 0,
            callConsumed: false,
          },
        } satisfies FieldTextSearchResponse
      },
    } as Response
  }
}

async function assertPublicDefaultGenerationStaysDry(scenario: Scenario): Promise<number> {
  resetEnv()
  setPublicRoute()
  const calls: CapturedFieldRequest[] = []
  globalThis.fetch = (async (input) => {
    const url = String(input)
    if (url.includes('/api/field/text-search')) {
      throw new Error(`${scenario.mode}: public default generation must not call the Field proxy.`)
    }
    throw new Error(`${scenario.mode}: unexpected fetch during public default generation: ${url}`)
  }) as typeof fetch

  const result = await runGeneratePlan(scenario.input, {
    starterPack: scenario.starterPack,
    sourceMode: 'curated',
    sourceModeOverrideApplied: false,
  })
  const validation = validateContractEntryArtifactPreCommitTruth(result.contractEntryArtifact, {
    requireEnrichment: true,
  })

  assert(calls.length === 0, `${scenario.mode}: default generation must make zero proxy calls.`)
  assert(
    result.trace.retrievalDiagnostics.liveSource.liveFetchAttempted === false,
    `${scenario.mode}: default generation must not attempt live Field retrieval.`,
  )
  assert(validation.status === 'valid', `${scenario.mode}: dry artifact must validate.`)
  process.stdout.write(`${scenario.mode} public default generation Field proxy calls: 0\n`)
  return calls.length
}

async function assertPublicSelectedCurateReviewRouteSmokeOffStaysDry(
  scenario: Scenario,
): Promise<number> {
  resetEnv()
  setPublicRoute()
  let proxyCalls = 0
  globalThis.fetch = (async (input) => {
    const url = String(input)
    if (url.includes('/api/field/text-search')) {
      proxyCalls += 1
      throw new Error(`${scenario.mode}: smoke-off public review route must not call Field proxy.`)
    }
    throw new Error(`${scenario.mode}: unexpected fetch during smoke-off public review route: ${url}`)
  }) as typeof fetch

  const result = await runStepBCurateLiveSmokePlanBuild({
    gate: buildStepBGate(scenario, {
      smokeSwitchEnabled: false,
    }),
    input: scenario.input,
    options: {
      starterPack: scenario.starterPack,
      sourceMode: 'curated',
      sourceModeOverrideApplied: true,
    },
  })

  assert(proxyCalls === 0, `${scenario.mode}: smoke-off public review route must make zero proxy calls.`)
  assert(
    result.trace.retrievalDiagnostics.liveSource.liveFetchAttempted === false,
    `${scenario.mode}: smoke-off public review route must not attempt live Field retrieval.`,
  )
  process.stdout.write(`${scenario.mode} public review route smoke-off Field proxy calls: 0\n`)
  return proxyCalls
}

async function assertPublicSelectedCurateReviewRouteUsesPrivateLiveEnvelope(
  scenario: Scenario,
): Promise<number> {
  resetEnv()
  setPublicRoute()
  const calls: CapturedFieldRequest[] = []
  globalThis.fetch = createFieldProxyFetch(calls)
  const maxProviderCalls = 3

  const result = await runStepBCurateLiveSmokePlanBuild({
    gate: buildStepBGate(scenario),
    input: scenario.input,
    options: {
      starterPack: scenario.starterPack,
      sourceMode: 'curated',
      sourceModeOverrideApplied: true,
    },
  })
  const artifact = result.contractEntryArtifact
  const validation = validateContractEntryArtifactPreCommitTruth(artifact, {
    requireEnrichment: true,
  })

  assert(calls.length > 0, `${scenario.mode}: public review route must call the Field proxy.`)
  assert(
    calls.length <= maxProviderCalls,
    `${scenario.mode}: public review route must respect maxProviderCalls=${maxProviderCalls}; received ${calls.length}.`,
  )
  assert(
    calls.every((call) => call.url === '/api/field/text-search'),
    `${scenario.mode}: generation must only call /api/field/text-search.`,
  )
  assert(
    calls.every((call) => call.body.mode === scenario.mode),
    `${scenario.mode}: Field proxy request mode must match generation mode.`,
  )
  assert(
    calls.every((call) => call.body.purpose === 'retrieval_supply'),
    `${scenario.mode}: public generation must request retrieval_supply.`,
  )
  assert(
    result.trace.retrievalDiagnostics.liveSource.liveFetchAttempted === true,
    `${scenario.mode}: public review route must attempt live Field retrieval.`,
  )
  assert(
    result.trace.retrievalDiagnostics.liveSource.dispatchQueriesPlanned <= maxProviderCalls,
    `${scenario.mode}: Step B dispatch plan must be capped before fetch.`,
  )
  assert(
    result.trace.retrievalDiagnostics.liveSource.dispatchQueriesPlannedWithinCap,
    `${scenario.mode}: Step B dispatch plan must assert cap compliance.`,
  )
  assert(
    result.trace.retrievalDiagnostics.liveSource.fetchedCount > 0,
    `${scenario.mode}: Field proxy candidates must enter retrieval diagnostics.`,
  )
  assert(
    result.trace.retrievalDiagnostics.liveSource.mappedCount > 0,
    `${scenario.mode}: Field proxy candidates must map before planning.`,
  )
  assert(validation.status === 'valid', `${scenario.mode}: enriched artifact must validate.`)
  assert(
    artifact.enrichment?.fieldProvenanceSummary?.liveProviderUsed === true,
    `${scenario.mode}: artifact provenance must record live Field usage.`,
  )
  assert(
    artifact.enrichment?.modeContextFit?.status === 'passed',
    `${scenario.mode}: generated artifact must preserve mode context fit.`,
  )
  process.stdout.write(
    `${scenario.mode} public selected Curate review route Field proxy calls: ${calls.length} <= ${maxProviderCalls}\n`,
  )
  return calls.length
}

interface PreparedRouteReviewHandlerParams {
  scenario: Scenario
  smokeSwitchEnabled: boolean
  isPublicSurface: boolean
  isCurateWrapperActive: boolean
  isBuildWrapperActive: boolean
  committedPlanMatchesGenerateDirection: boolean
  planPresent: boolean
  previewSynced: boolean
}

async function runPreparedRouteReviewHandlerSimulation(
  params: PreparedRouteReviewHandlerParams,
): Promise<{
  earlyReveal: boolean
  generated: boolean
  fieldProxyCalls: number
  liveFetchAttempted: boolean
}> {
  const {
    scenario,
    smokeSwitchEnabled,
    isPublicSurface,
    isCurateWrapperActive,
    isBuildWrapperActive,
    committedPlanMatchesGenerateDirection,
    planPresent,
    previewSynced,
  } = params
  const calls: CapturedFieldRequest[] = []
  globalThis.fetch = createFieldProxyFetch(calls)
  const generationInvocation: StepBCurateLiveSmokeGate['invocation'] =
    isPublicSurface && isCurateWrapperActive
      ? 'public_selected_curate_review_route'
      : 'other'
  const forceStepBGeneration = shouldApplyStepBCurateLiveSmoke({
    environment: 'default',
    pathname: '/',
    invocation: generationInvocation,
    mode: isCurateWrapperActive ? 'curate' : null,
    inputMode: isCurateWrapperActive ? 'curate' : isBuildWrapperActive ? 'build' : 'surprise',
    generationTarget: 'final',
    selectedStarterPackPresent: Boolean(scenario.starterPack),
    userSourceModeOverrideApplied: false,
    smokeSwitchEnabled,
  })

  if (
    !forceStepBGeneration &&
    (committedPlanMatchesGenerateDirection || (planPresent && previewSynced))
  ) {
    return {
      earlyReveal: true,
      generated: false,
      fieldProxyCalls: calls.length,
      liveFetchAttempted: false,
    }
  }

  const result = await runStepBCurateLiveSmokePlanBuild({
    gate: buildStepBGate(scenario, {
      invocation: generationInvocation,
      mode: isCurateWrapperActive ? 'curate' : null,
      inputMode: isCurateWrapperActive ? 'curate' : isBuildWrapperActive ? 'build' : 'surprise',
      selectedStarterPackPresent: Boolean(scenario.starterPack),
      smokeSwitchEnabled,
    }),
    input: scenario.input,
    options: {
      starterPack: scenario.starterPack,
      sourceMode: 'curated',
      sourceModeOverrideApplied: true,
    },
  })

  return {
    earlyReveal: false,
    generated: true,
    fieldProxyCalls: calls.length,
    liveFetchAttempted: result.trace.retrievalDiagnostics.liveSource.liveFetchAttempted,
  }
}

async function assertPreparedRouteSmokeOffPreservesEarlyReveal(
  scenario: Scenario,
): Promise<number> {
  resetEnv()
  setPublicRoute()
  globalThis.fetch = (async (input) => {
    const url = String(input)
    if (url.includes('/api/field/text-search')) {
      throw new Error(`${scenario.mode}: smoke-off prepared route reveal must not call Field proxy.`)
    }
    throw new Error(`${scenario.mode}: unexpected fetch during prepared route reveal: ${url}`)
  }) as typeof fetch

  const result = await runPreparedRouteReviewHandlerSimulation({
    scenario,
    smokeSwitchEnabled: false,
    isPublicSurface: true,
    isCurateWrapperActive: true,
    isBuildWrapperActive: false,
    committedPlanMatchesGenerateDirection: true,
    planPresent: true,
    previewSynced: true,
  })

  assert(result.earlyReveal, `${scenario.mode}: smoke-off prepared route must reveal early.`)
  assert(!result.generated, `${scenario.mode}: smoke-off prepared route must not generate.`)
  assert(result.fieldProxyCalls === 0, `${scenario.mode}: smoke-off prepared route must stay dry.`)
  assert(!result.liveFetchAttempted, `${scenario.mode}: smoke-off prepared route must not attempt live.`)
  process.stdout.write(`${scenario.mode} prepared route smoke-off early reveal Field proxy calls: 0\n`)
  return result.fieldProxyCalls
}

async function assertPreparedRouteSmokeOnBypassesEarlyReveal(
  scenario: Scenario,
): Promise<number> {
  resetEnv()
  setPublicRoute()
  const result = await runPreparedRouteReviewHandlerSimulation({
    scenario,
    smokeSwitchEnabled: true,
    isPublicSurface: true,
    isCurateWrapperActive: true,
    isBuildWrapperActive: false,
    committedPlanMatchesGenerateDirection: true,
    planPresent: true,
    previewSynced: true,
  })

  assert(!result.earlyReveal, `${scenario.mode}: smoke-on prepared route must bypass early reveal.`)
  assert(result.generated, `${scenario.mode}: smoke-on prepared route must generate.`)
  assert(result.fieldProxyCalls > 0, `${scenario.mode}: smoke-on prepared route must call Field proxy.`)
  assert(
    result.fieldProxyCalls <= 3,
    `${scenario.mode}: smoke-on prepared route exceeded maxProviderCalls=3; received ${result.fieldProxyCalls}.`,
  )
  assert(result.liveFetchAttempted, `${scenario.mode}: smoke-on prepared route must attempt live.`)
  process.stdout.write(
    `${scenario.mode} prepared route smoke-on Field proxy calls: ${result.fieldProxyCalls} <= 3\n`,
  )
  return result.fieldProxyCalls
}

async function assertPreparedRouteWrongModeSmokeStaysDry(scenario: Scenario): Promise<number> {
  resetEnv()
  setPublicRoute()
  globalThis.fetch = (async (input) => {
    const url = String(input)
    if (url.includes('/api/field/text-search')) {
      throw new Error(`${scenario.mode}: prepared wrong-mode smoke must not call Field proxy.`)
    }
    throw new Error(`${scenario.mode}: unexpected fetch during prepared wrong-mode smoke: ${url}`)
  }) as typeof fetch

  const result = await runPreparedRouteReviewHandlerSimulation({
    scenario,
    smokeSwitchEnabled: true,
    isPublicSurface: true,
    isCurateWrapperActive: false,
    isBuildWrapperActive: scenario.mode === 'build',
    committedPlanMatchesGenerateDirection: true,
    planPresent: true,
    previewSynced: true,
  })

  assert(result.earlyReveal, `${scenario.mode}: wrong-mode prepared route must preserve early reveal.`)
  assert(!result.generated, `${scenario.mode}: wrong-mode prepared route must not generate.`)
  assert(result.fieldProxyCalls === 0, `${scenario.mode}: wrong-mode prepared route must stay dry.`)
  process.stdout.write(`${scenario.mode} prepared wrong-mode smoke Field proxy calls: 0\n`)
  return result.fieldProxyCalls
}

async function assertUserSourceOverrideStillBlocksStepB(scenario: Scenario): Promise<number> {
  resetEnv()
  setPublicRoute()
  let proxyCalls = 0
  globalThis.fetch = (async (input) => {
    const url = String(input)
    if (url.includes('/api/field/text-search')) {
      proxyCalls += 1
      throw new Error(`${scenario.mode}: user source override must not enter Step B.`)
    }
    throw new Error(`${scenario.mode}: unexpected fetch during user source override fallback: ${url}`)
  }) as typeof fetch

  const result = await runStepBCurateLiveSmokePlanBuild({
    gate: buildStepBGate(scenario, {
      userSourceModeOverrideApplied: true,
    }),
    input: scenario.input,
    options: {
      starterPack: scenario.starterPack,
      sourceMode: 'curated',
      sourceModeOverrideApplied: true,
    },
  })

  assert(proxyCalls === 0, `${scenario.mode}: user source override must make zero proxy calls.`)
  assert(
    result.trace.retrievalDiagnostics.liveSource.liveFetchAttempted === false,
    `${scenario.mode}: user source override must not attempt live Field retrieval.`,
  )
  process.stdout.write(`${scenario.mode} user-source-override smoke Field proxy calls: 0\n`)
  return proxyCalls
}

async function assertSmokeSwitchWrongModeStaysDry(scenario: Scenario): Promise<number> {
  resetEnv()
  setPublicRoute()
  let proxyCalls = 0
  globalThis.fetch = (async (input) => {
    const url = String(input)
    if (url.includes('/api/field/text-search')) {
      proxyCalls += 1
      throw new Error(`${scenario.mode}: smoke switch must not call Field proxy outside Curate final.`)
    }
    throw new Error(`${scenario.mode}: unexpected fetch during smoke switch dry fallback: ${url}`)
  }) as typeof fetch

  const result = await runStepBCurateLiveSmokePlanBuild({
    gate: buildStepBGate(scenario),
    input: scenario.input,
    options: {
      starterPack: scenario.starterPack,
      sourceMode: 'curated',
      sourceModeOverrideApplied: false,
    },
  })

  assert(proxyCalls === 0, `${scenario.mode}: smoke switch fallback must make zero proxy calls.`)
  assert(
    result.trace.retrievalDiagnostics.liveSource.liveFetchAttempted === false,
    `${scenario.mode}: smoke switch fallback must not attempt live retrieval.`,
  )
  process.stdout.write(`${scenario.mode} smoke switch Field proxy calls: 0\n`)
  return proxyCalls
}

async function assertFailClosedDoesNotRenderFalseCard(): Promise<void> {
  resetEnv()
  process.env.VITE_ID8_FIELD_GOVERNED_MODE = '1'
  process.env.VITE_ID8_FAIL_CLOSED_ON_LIVE_INVENTORY_FAILURE = '1'
  setPublicRoute()
  const calls: CapturedFieldRequest[] = []
  globalThis.fetch = createFailClosedFieldProxyFetch(calls)
  const scenario = buildScenarios()[0]

  let thrown = false
  try {
    await runStepBCurateLiveSmokePlanBuild({
      gate: buildStepBGate(scenario),
      input: scenario.input,
      options: {
        starterPack: scenario.starterPack,
        sourceMode: 'curated',
        sourceModeOverrideApplied: false,
      },
    })
  } catch {
    thrown = true
  }

  assert(thrown, 'Governed fail-closed Field proxy failure must block generation.')
  assert(calls.length > 0, 'Fail-closed scenario must still prove the Field proxy was called.')
  const falseCard = buildPublicCurateCardTruthModel({
    artifact: null,
    itinerary: null,
    mode: 'curate',
    starterPack: scenario.starterPack ?? null,
  })
  assert(!falseCard.allowedToRender, 'No false public card may render without an artifact.')
  process.stdout.write('fail-closed proxy public card block: passed\n')
}

async function main(): Promise<void> {
  let defaultGenerationProxyCalls = 0
  let smokeOffReviewRouteProxyCalls = 0
  let preparedSmokeOffProxyCalls = 0
  let preparedSmokeOnProxyCalls = 0
  let stepBProxyCalls = 0
  let userSourceOverrideProxyCalls = 0
  let wrongModeSmokeProxyCalls = 0
  let wrongModePreparedSmokeProxyCalls = 0
  for (const scenario of buildScenarios()) {
    defaultGenerationProxyCalls += await assertPublicDefaultGenerationStaysDry(scenario)
    if (scenario.mode === 'curate') {
      smokeOffReviewRouteProxyCalls +=
        await assertPublicSelectedCurateReviewRouteSmokeOffStaysDry(scenario)
      preparedSmokeOffProxyCalls += await assertPreparedRouteSmokeOffPreservesEarlyReveal(scenario)
      preparedSmokeOnProxyCalls += await assertPreparedRouteSmokeOnBypassesEarlyReveal(scenario)
      stepBProxyCalls += await assertPublicSelectedCurateReviewRouteUsesPrivateLiveEnvelope(scenario)
      userSourceOverrideProxyCalls += await assertUserSourceOverrideStillBlocksStepB(scenario)
    } else {
      wrongModePreparedSmokeProxyCalls += await assertPreparedRouteWrongModeSmokeStaysDry(scenario)
      wrongModeSmokeProxyCalls += await assertSmokeSwitchWrongModeStaysDry(scenario)
    }
  }
  await assertFailClosedDoesNotRenderFalseCard()
  process.stdout.write(
    `Public default final generation without explicit live envelope proxy calls: ${defaultGenerationProxyCalls}\n`,
  )
  process.stdout.write(
    `Public selected Curate review route smoke-off proxy calls: ${smokeOffReviewRouteProxyCalls}\n`,
  )
  process.stdout.write(
    `Prepared public selected Curate review route smoke-off proxy calls: ${preparedSmokeOffProxyCalls}\n`,
  )
  process.stdout.write(
    `Prepared public selected Curate review route smoke-on proxy calls: ${preparedSmokeOnProxyCalls}\n`,
  )
  process.stdout.write(
    `Step B Curate wrapper proxy calls: ${stepBProxyCalls}\n`,
  )
  process.stdout.write(
    `User source override smoke proxy calls: ${userSourceOverrideProxyCalls}\n`,
  )
  process.stdout.write(
    `Wrong-mode smoke switch proxy calls: ${wrongModeSmokeProxyCalls}\n`,
  )
  process.stdout.write(
    `Wrong-mode prepared smoke switch proxy calls: ${wrongModePreparedSmokeProxyCalls}\n`,
  )
  process.stdout.write('public generation Field proxy wiring: passed\n')
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
  .finally(() => {
    globalThis.fetch = originalFetch
    restoreWindow()
    restoreEnv()
  })
