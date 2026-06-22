import { buildPublicCurateCardTruthModel } from '../src/app/services/curate/publicCurateCardTruthService.ts'
import {
  runStepBCurateLiveSmokeCandidateSupply,
  shouldApplyStepBCurateLiveSmokeCandidateSupply,
  type StepBCurateLiveSmokeCandidateSupplyGate,
} from '../src/app/services/arcApplicationService.ts'
import { starterPacks } from '../src/data/starterPacks.ts'
import {
  validateContractEntryArtifactPreCommitTruth,
  type ContractEntryArtifact,
} from '../src/domain/artifacts/contractEntryArtifact.ts'
import { buildContractEntryArtifactFromVerifiedOpportunity } from '../src/domain/interpretation/buildContractEntryArtifactFromVerifiedOpportunity.ts'
import { buildScenarioNightsFromCandidateBoard } from '../src/domain/interpretation/construction/scenarioBuilder.ts'
import { mapBuiltScenarioNightToVerifiedOpportunity } from '../src/domain/interpretation/verifiedCityOpportunity.ts'
import { runGeneratePlan } from '../src/domain/runGeneratePlan.ts'
import type { FieldTextSearchRequest, FieldTextSearchResponse } from '../src/domain/field/fieldProxyTypes.ts'
import type { ProviderVenue } from '../src/domain/providers/providerTypes.ts'
import type { ExperienceMode, IntentInput } from '../src/domain/types/intent.ts'
import type { StarterPack } from '../src/domain/types/starterPack.ts'

const FIELD_PROXY_PATH = '/api/field/text-search'
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

function resetEnv(): void {
  for (const key of managedEnvKeys) {
    delete process.env[key]
  }
}

function setPublicCurateRoute(): void {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: {
        pathname: '/start/curate',
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

function buildSupplyGate(
  scenario: Scenario,
  overrides: Partial<StepBCurateLiveSmokeCandidateSupplyGate> = {},
): StepBCurateLiveSmokeCandidateSupplyGate {
  return {
    environment: 'default',
    pathname: '/start/curate',
    isPublicSurface: true,
    mode: scenario.mode,
    inputMode: scenario.input.mode,
    phase: 'candidate_supply',
    selectedStarterPackPresent: Boolean(scenario.starterPack),
    userSourceModeOverrideApplied: false,
    smokeSwitchEnabled: true,
    ...overrides,
  }
}

function buildProviderVenue(request: FieldTextSearchRequest, index: number): ProviderVenue {
  const primaryType = request.queryLabel.includes('coffee')
    ? 'cafe'
    : request.queryLabel.includes('bar') || request.queryLabel.includes('night')
      ? 'bar'
      : 'restaurant'
  const latitude = 37.331 + index * 0.002
  const longitude = -121.889 - index * 0.002
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
    assert(url === FIELD_PROXY_PATH, `Expected Field proxy URL, received ${url}.`)
    assert(!url.includes('places.googleapis.com'), 'Browser must not call Google Places.')
    assert(!url.includes('GOOGLE_PLACES_API_KEY'), 'Browser request must not expose provider keys.')
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

function createZeroProxyTrap(label: string): typeof fetch {
  return (async (input) => {
    const url = String(input)
    if (url.includes(FIELD_PROXY_PATH)) {
      throw new Error(`${label}: unexpected Field proxy call to ${url}.`)
    }
    if (url.includes('places.googleapis.com')) {
      throw new Error(`${label}: browser attempted Google Places call.`)
    }
    throw new Error(`${label}: unexpected non-Field fetch to ${url}.`)
  }) as typeof fetch
}

async function assertPublicDefaultGenerationStaysDry(scenario: Scenario): Promise<number> {
  resetEnv()
  setPublicCurateRoute()
  globalThis.fetch = createZeroProxyTrap(`${scenario.mode}: public default generation`)

  const result = await runGeneratePlan(scenario.input, {
    starterPack: scenario.starterPack,
    sourceMode: 'curated',
    sourceModeOverrideApplied: false,
  })
  const validation = validateContractEntryArtifactPreCommitTruth(result.contractEntryArtifact, {
    requireEnrichment: true,
  })

  assert(
    result.trace.retrievalDiagnostics.liveSource.liveFetchAttempted === false,
    `${scenario.mode}: default generation must not attempt live Field retrieval.`,
  )
  assert(validation.status === 'valid', `${scenario.mode}: dry artifact must validate.`)
  process.stdout.write(`${scenario.mode} public default generation Field proxy calls: 0\n`)
  return 0
}

async function assertPublicCurateCandidateSupplySmokeOffStaysDry(
  scenario: Scenario,
): Promise<number> {
  resetEnv()
  setPublicCurateRoute()
  globalThis.fetch = createZeroProxyTrap(`${scenario.mode}: smoke-off candidate supply`)

  const board = await runStepBCurateLiveSmokeCandidateSupply({
    gate: buildSupplyGate(scenario, { smokeSwitchEnabled: false }),
    input: {
      city: scenario.input.city,
      mode: 'curate',
      persona: scenario.input.persona ?? 'romantic',
      vibe: scenario.input.primaryVibe,
      sourceMode: 'curated',
    },
    starterPack: scenario.starterPack ?? null,
  })

  assert(board !== null, `${scenario.mode}: smoke-off candidate supply should still build a board.`)
  process.stdout.write(`${scenario.mode} public Curate candidate supply smoke-off Field proxy calls: 0\n`)
  return 0
}

async function assertPublicCurateCandidateSupplyUsesPrivateEnvelope(
  scenario: Scenario,
): Promise<{
  fieldProxyCalls: number
  artifact: ContractEntryArtifact
}> {
  resetEnv()
  setPublicCurateRoute()
  const calls: CapturedFieldRequest[] = []
  globalThis.fetch = createFieldProxyFetch(calls)
  const maxProviderCalls = 3

  const board = await runStepBCurateLiveSmokeCandidateSupply({
    gate: buildSupplyGate(scenario),
    input: {
      city: scenario.input.city,
      mode: 'curate',
      persona: scenario.input.persona ?? 'romantic',
      vibe: scenario.input.primaryVibe,
      sourceMode: 'curated',
    },
    starterPack: scenario.starterPack ?? null,
  })
  assert(board !== null, `${scenario.mode}: Step B candidate supply must build a board.`)
  const builtNights = buildScenarioNightsFromCandidateBoard(board)
  assert(
    builtNights.some((night) => night.complete),
    `${scenario.mode}: Scenario Builder must produce a built night from the board.`,
  )
  let artifact: ContractEntryArtifact | null = null
  for (const night of builtNights) {
    if (!night.complete) {
      continue
    }
    const opportunity = mapBuiltScenarioNightToVerifiedOpportunity({
      night,
      districtDiscoveryCards: [{ id: 'san-jose', name: 'San Jose' }],
      directionCards: [],
      personaLabel: 'Romantic',
      vibeLabel: 'Cozy',
    })
    if (!opportunity) {
      continue
    }
    artifact = buildContractEntryArtifactFromVerifiedOpportunity({
      opportunity,
      ecsState: {
        exploration: 'focused',
        discovery: 'reliable',
        highlight: 'standout',
      },
      useScenarioBackedArtifacts: true,
    })
    if (artifact) {
      break
    }
  }
  assert(artifact, `${scenario.mode}: ContractEntryArtifact must be produced before reveal.`)
  const validation = validateContractEntryArtifactPreCommitTruth(artifact)

  assert(calls.length > 0, `${scenario.mode}: candidate supply must call the Field proxy.`)
  assert(
    calls.length <= maxProviderCalls,
    `${scenario.mode}: candidate supply exceeded maxProviderCalls=${maxProviderCalls}; received ${calls.length}.`,
  )
  assert(
    calls.every((call) => call.url === FIELD_PROXY_PATH),
    `${scenario.mode}: candidate supply must only call /api/field/text-search.`,
  )
  assert(
    calls.every((call) => call.body.mode === scenario.mode),
    `${scenario.mode}: Field proxy request mode must match Curate supply mode.`,
  )
  assert(
    calls.every((call) => call.body.purpose === 'retrieval_supply'),
    `${scenario.mode}: candidate supply must request retrieval_supply.`,
  )
  assert(validation.status === 'valid', `${scenario.mode}: pre-reveal artifact must validate.`)
  process.stdout.write(
    `${scenario.mode} public Curate candidate supply Field proxy calls: ${calls.length} <= ${maxProviderCalls}\n`,
  )
  return {
    fieldProxyCalls: calls.length,
    artifact,
  }
}

async function assertCallerSuppliedEnvelopeCannotActivateSupplySmoke(
  scenario: Scenario,
): Promise<number> {
  resetEnv()
  setPublicCurateRoute()
  globalThis.fetch = createZeroProxyTrap(`${scenario.mode}: caller-supplied liveEnvelope`)

  const board = await runStepBCurateLiveSmokeCandidateSupply({
    gate: buildSupplyGate(scenario, { smokeSwitchEnabled: false }),
    input: {
      city: scenario.input.city,
      mode: 'curate',
      persona: scenario.input.persona ?? 'romantic',
      vibe: scenario.input.primaryVibe,
      sourceMode: 'hybrid',
      liveEnvelope: {
        liveProviderAllowed: true,
        maxProviderCalls: 99,
        maxQueryLabels: 99,
        maxCenters: 99,
      },
    } as Parameters<typeof runStepBCurateLiveSmokeCandidateSupply>[0]['input'],
    starterPack: scenario.starterPack ?? null,
  })

  assert(board !== null, `${scenario.mode}: caller envelope dry fallback should still build a board.`)
  process.stdout.write(`${scenario.mode} caller-supplied liveEnvelope Field proxy calls: 0\n`)
  return 0
}

function simulatePreparedRouteReview(params: {
  committedPlanMatchesGenerateDirection: boolean
  planPresent: boolean
  previewSynced: boolean
  approvedRefinementEntryPayloadPresent?: boolean
  approvedPayloadArtifactMatchesSelected?: boolean
}): {
  earlyReveal: boolean
  approvedPayloadReveal: boolean
  generated: boolean
} {
  if (params.committedPlanMatchesGenerateDirection || (params.planPresent && params.previewSynced)) {
    return {
      earlyReveal: true,
      approvedPayloadReveal: false,
      generated: false,
    }
  }

  if (params.approvedRefinementEntryPayloadPresent && params.approvedPayloadArtifactMatchesSelected) {
    return {
      earlyReveal: true,
      approvedPayloadReveal: true,
      generated: false,
    }
  }

  return {
    earlyReveal: false,
    approvedPayloadReveal: false,
    generated: true,
  }
}

async function assertReviewThisRouteMakesNoAdditionalFieldProxyCalls(
  scenario: Scenario,
): Promise<number> {
  resetEnv()
  setPublicCurateRoute()
  globalThis.fetch = createZeroProxyTrap(`${scenario.mode}: Review this route`)

  const prepared = simulatePreparedRouteReview({
    committedPlanMatchesGenerateDirection: true,
    planPresent: true,
    previewSynced: true,
  })
  const approvedPayload = simulatePreparedRouteReview({
    committedPlanMatchesGenerateDirection: false,
    planPresent: false,
    previewSynced: false,
    approvedRefinementEntryPayloadPresent: true,
    approvedPayloadArtifactMatchesSelected: true,
  })

  assert(prepared.earlyReveal, `${scenario.mode}: prepared-route reveal branch must remain active.`)
  assert(!prepared.generated, `${scenario.mode}: prepared-route reveal must not generate.`)
  assert(
    approvedPayload.earlyReveal && approvedPayload.approvedPayloadReveal,
    `${scenario.mode}: approved-payload reveal branch must remain active.`,
  )
  assert(!approvedPayload.generated, `${scenario.mode}: approved-payload reveal must not generate.`)
  process.stdout.write(`${scenario.mode} Review this route additional Field proxy calls: 0\n`)
  return 0
}

async function assertWrongSurfaceSupplyGateStaysDry(
  scenario: Scenario,
  overrides: Partial<StepBCurateLiveSmokeCandidateSupplyGate>,
  label: string,
): Promise<number> {
  resetEnv()
  setPublicCurateRoute()
  globalThis.fetch = createZeroProxyTrap(label)
  const gate = buildSupplyGate(scenario, overrides)

  assert(
    !shouldApplyStepBCurateLiveSmokeCandidateSupply(gate),
    `${label}: gate should reject this surface.`,
  )
  await runStepBCurateLiveSmokeCandidateSupply({
    gate,
    input: {
      city: scenario.input.city,
      mode: 'curate',
      persona: scenario.input.persona ?? 'romantic',
      vibe: scenario.input.primaryVibe,
      sourceMode: 'curated',
    },
    starterPack: scenario.starterPack ?? null,
  })
  process.stdout.write(`${label} Field proxy calls: 0\n`)
  return 0
}

async function assertFailClosedDoesNotRenderFalseCard(): Promise<void> {
  resetEnv()
  const scenario = buildScenarios()[0]
  globalThis.fetch = createZeroProxyTrap('fail-closed card truth')
  const result = simulatePreparedRouteReview({
    committedPlanMatchesGenerateDirection: false,
    planPresent: false,
    previewSynced: false,
  })
  assert(result.generated, 'Unprepared reveal may still fall back to dry deterministic generation.')
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
  let smokeOffSupplyProxyCalls = 0
  let smokeOnSupplyProxyCalls = 0
  let callerEnvelopeProxyCalls = 0
  let reviewProxyCalls = 0
  let wrongSurfaceProxyCalls = 0
  for (const scenario of buildScenarios()) {
    defaultGenerationProxyCalls += await assertPublicDefaultGenerationStaysDry(scenario)
    if (scenario.mode === 'curate') {
      smokeOffSupplyProxyCalls += await assertPublicCurateCandidateSupplySmokeOffStaysDry(scenario)
      const smokeOnSupply = await assertPublicCurateCandidateSupplyUsesPrivateEnvelope(scenario)
      smokeOnSupplyProxyCalls += smokeOnSupply.fieldProxyCalls
      callerEnvelopeProxyCalls += await assertCallerSuppliedEnvelopeCannotActivateSupplySmoke(scenario)
      reviewProxyCalls += await assertReviewThisRouteMakesNoAdditionalFieldProxyCalls(scenario)
      wrongSurfaceProxyCalls += await assertWrongSurfaceSupplyGateStaysDry(
        scenario,
        { pathname: '/start/surprise', mode: 'surprise', inputMode: 'surprise' },
        'Surprise supply smoke',
      )
      wrongSurfaceProxyCalls += await assertWrongSurfaceSupplyGateStaysDry(
        scenario,
        { pathname: '/start/build', mode: 'build', inputMode: 'build' },
        'Build supply smoke',
      )
      wrongSurfaceProxyCalls += await assertWrongSurfaceSupplyGateStaysDry(
        scenario,
        { pathname: '/dev/start/curate', isPublicSurface: false },
        'JourneyMapReal/Live/Keep the Night Going dry gate',
      )
      wrongSurfaceProxyCalls += await assertWrongSurfaceSupplyGateStaysDry(
        scenario,
        { phase: 'other' },
        'Build provider shadow dry gate',
      )
    }
  }
  await assertFailClosedDoesNotRenderFalseCard()
  process.stdout.write(
    `Public default final generation without explicit live envelope proxy calls: ${defaultGenerationProxyCalls}\n`,
  )
  process.stdout.write(
    `Public Curate candidate supply smoke-off proxy calls: ${smokeOffSupplyProxyCalls}\n`,
  )
  process.stdout.write(
    `Public Curate candidate supply smoke-on proxy calls: ${smokeOnSupplyProxyCalls}\n`,
  )
  process.stdout.write(
    `Caller-supplied liveEnvelope dry proxy calls: ${callerEnvelopeProxyCalls}\n`,
  )
  process.stdout.write(`Review this route additional proxy calls: ${reviewProxyCalls}\n`)
  process.stdout.write(`Wrong-surface supply gate proxy calls: ${wrongSurfaceProxyCalls}\n`)
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
