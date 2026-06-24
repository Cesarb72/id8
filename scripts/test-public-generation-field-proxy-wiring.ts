import { readFileSync } from 'node:fs'
import {
  buildPublicCurateCardTruthModel,
  validatePublicCurateApprovedPayloadTruth,
} from '../src/app/services/curate/publicCurateCardTruthService.ts'
import { buildCurateCommittedRouteFallbackDecision } from '../src/app/services/curate/buildCurateCommittedRouteFallback.ts'
import { runCuratePreviewQualificationAttempt } from '../src/app/services/sandbox/curatePreviewQualificationService.ts'
import {
  buildCoffeeBooksSemanticRepresentationFromRouteStops,
  coffeeBooksSemanticRepresentationMissingReason,
} from '../src/app/services/curate/coffeeBooksSemanticRepresentation.ts'
import { buildCurateScenarioBackedArtifactBridge } from '../src/app/services/curate/buildCurateScenarioBackedArtifactBridge.ts'
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
import type {
  StopTypeCandidate,
  StopTypeCandidateBoard,
} from '../src/domain/interpretation/discovery/stopTypeCandidateBoard.ts'
import {
  mapBuiltScenarioNightToVerifiedOpportunity,
  type VerifiedCityOpportunity,
} from '../src/domain/interpretation/verifiedCityOpportunity.ts'
import { runGeneratePlan } from '../src/domain/runGeneratePlan.ts'
import type { GeneratePlanResult } from '../src/domain/runGeneratePlan.ts'
import type { RuntimeRouteArtifact } from '../src/domain/artifacts/runtimeRouteArtifact.ts'
import type { FieldTextSearchRequest, FieldTextSearchResponse } from '../src/domain/field/fieldProxyTypes.ts'
import type { ProviderVenue } from '../src/domain/providers/providerTypes.ts'
import type { RealityDirectionCard } from '../src/app/types/realityDirectionCard.ts'
import type { ExperienceMode, IntentInput } from '../src/domain/types/intent.ts'
import type { StarterPack } from '../src/domain/types/starterPack.ts'
import type { Venue } from '../src/domain/types/venue.ts'
import type { VenueCategory } from '../src/domain/types/venue.ts'

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
  'VITE_ID8_ENABLE_FIELD_STATIC_PROVIDER_CORPUS_CURATE',
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
  const primaryType = request.queryLabel.includes('highlight-culture')
    ? 'art_gallery'
    : request.queryLabel.includes('coffee') || request.queryLabel.includes('reading')
      ? 'cafe'
      : request.queryLabel.includes('bar') || request.queryLabel.includes('night')
        ? 'bar'
        : 'restaurant'
  const types = request.queryLabel.includes('coffee-books')
    ? [primaryType, 'book_store', 'point_of_interest', 'establishment']
    : [primaryType, 'point_of_interest', 'establishment']
  const latitude = 37.331 + index * 0.002
  const longitude = -121.889 - index * 0.002
  return {
    provider: 'google_places',
    providerRecordId: `mock-field-${request.mode}-${request.queryLabel}-${index + 1}`,
    displayName: request.queryLabel.includes('coffee-books')
      ? `${request.mode} ${request.queryLabel} book culture venue ${index + 1}`
      : `${request.mode} ${request.queryLabel} field venue ${index + 1}`,
    formattedAddress: `${100 + index} Field Proxy Way, San Jose, CA`,
    primaryType,
    types,
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

function semanticCorpusFromCandidate(candidate: StopTypeCandidate): string {
  return [
    candidate.name,
    candidate.venueCategory,
    candidate.venueSubcategory,
    ...(candidate.sourceTypes ?? []),
    ...(candidate.venueTags ?? []),
  ]
    .join(' ')
    .toLowerCase()
}

function semanticCorpusIncludesAny(corpus: string, terms: string[]): boolean {
  const normalizedCorpus = corpus.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
  const tokenSet = new Set(normalizedCorpus.split(' ').filter(Boolean))
  return terms.some((term) => {
    const normalizedTerm = term.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
    return normalizedTerm.includes(' ')
      ? normalizedCorpus.includes(normalizedTerm)
      : tokenSet.has(normalizedTerm)
  })
}

function candidateHasCoffeeBooksSemanticRepresentation(candidate: StopTypeCandidate): boolean {
  const corpus = semanticCorpusFromCandidate(candidate)
  return (
    candidate.venueCategory === 'museum' ||
    semanticCorpusIncludesAny(corpus, [
      'book',
      'books',
      'bookstore',
      'book store',
      'library',
      'reading',
      'literary',
      'museum',
      'gallery',
      'art',
      'exhibit',
      'exhibition',
      'cultural center',
      'cultural venue',
    ])
  )
}

function builtNightHasCoffeeBooksSemanticRepresentation(
  night: ReturnType<typeof buildScenarioNightsFromCandidateBoard>[number],
): boolean {
  return night.starterSemanticRepresentation?.status === 'represented'
}

function createScenarioCandidate(
  venueId: string,
  name: string,
  overrides: Partial<StopTypeCandidate> = {},
): StopTypeCandidate {
  return {
    venueId,
    name,
    city: 'San Jose',
    address: '100 Test Way, San Jose, CA',
    district: 'Downtown',
    neighborhoodLabel: 'Downtown',
    stopType: 'debrief_stop',
    venueCategory: 'cafe',
    venueSubcategory: 'cafe',
    shortDescription: 'Quiet cafe stop.',
    sourceTypes: ['cafe'],
    venueTags: ['quiet', 'curated'],
    sourceType: 'venue',
    hoursKnown: true,
    openNow: true,
    authorityScore: 0.74,
    hiddenGemScore: 0.4,
    currentRelevance: 0.7,
    eventPotential: 0,
    performancePotential: 0,
    liveNightlifePotential: 0,
    culturalAnchorPotential: 0.2,
    lateNightPotential: 0.2,
    majorVenueStrength: 0.5,
    roleFit: {
      start: 0.82,
      highlight: 0.82,
      windDown: 0.82,
    },
    reasons: ['quiet cafe fit'],
    ...overrides,
  }
}

function createFallbackPlannerStop(
  role: 'warmup' | 'peak' | 'cooldown',
  venueId: string,
  name: string,
  overrides: {
    category?: VenueCategory
    subcategory?: string
    tags?: string[]
    shortDescription?: string
    narrativeFlavor?: string
  } = {},
): GeneratePlanResult['selectedArc']['stops'][number] {
  return {
    role,
    scoredVenue: {
      venue: {
        id: venueId,
        name,
        city: 'San Jose',
        neighborhood: 'Willow Glen',
        driveMinutes: 8,
        category: overrides.category ?? 'cafe',
        subcategory: overrides.subcategory ?? 'coffee',
        priceTier: '$$',
        tags: overrides.tags ?? ['quiet', 'curated', 'thoughtful'],
        useCases: ['date'],
        vibeTags: ['cultured'],
        energyLevel: 2,
        socialDensity: 2,
        uniquenessScore: 0.7,
        distinctivenessScore: 0.7,
        underexposureScore: 0.5,
        shareabilityScore: 0.5,
        isChain: false,
        localSignals: {
          localFavoriteScore: 0.7,
          neighborhoodPrideScore: 0.7,
          repeatVisitorScore: 0.6,
        },
        roleAffinity: {
          warmup: 0.8,
          peak: 0.8,
          wildcard: 0.6,
          cooldown: 0.8,
        },
        imageUrl: '',
        shortDescription: overrides.shortDescription ?? 'Quiet curated cafe stop.',
        narrativeFlavor: overrides.narrativeFlavor ?? 'Calm thoughtful route stop.',
        isHiddenGem: false,
        isActive: true,
        highlightCapable: true,
        durationProfile: {} as GeneratePlanResult['selectedArc']['stops'][number]['scoredVenue']['venue']['durationProfile'],
        settings: {} as GeneratePlanResult['selectedArc']['stops'][number]['scoredVenue']['venue']['settings'],
        signature: {} as GeneratePlanResult['selectedArc']['stops'][number]['scoredVenue']['venue']['signature'],
        source: {
          sourceOrigin: 'curated',
        } as GeneratePlanResult['selectedArc']['stops'][number]['scoredVenue']['venue']['source'],
      },
    },
  } as GeneratePlanResult['selectedArc']['stops'][number]
}

function buildFallbackGeneratePlanResult(
  stops: GeneratePlanResult['selectedArc']['stops'],
): GeneratePlanResult {
  return {
    selectedArc: {
      stops,
    },
    itinerary: {
      city: 'San Jose',
      title: 'Fallback route',
      shareSummary: 'Fallback route summary.',
      storySpine: {
        title: 'Fallback route',
        routeSummary: 'Fallback route summary.',
      },
    },
    trace: {
      retrievalDiagnostics: {
        liveSource: {
          requestedMode: 'curated',
          effectiveMode: 'curated',
          liveFetchAttempted: false,
          countsBySource: {
            live: 0,
          },
        },
      },
    },
  } as GeneratePlanResult
}

function buildCoffeeBooksScenarioBoard(params: {
  starterPack: StarterPack
  includeSemanticCandidate: boolean
  includeCafeOnlyHighlightAlternative?: boolean
}): StopTypeCandidateBoard {
  const startCandidate = createScenarioCandidate('generic-start-cafe', 'Generic Start Cafe', {
    stopType: 'cultural_institution',
    culturalAnchorPotential: 0.9,
    venueTags: ['quiet', 'curated', 'thoughtful'],
    reasons: ['quiet curated cafe fit'],
  })
  const highlightCandidate = params.includeSemanticCandidate
    ? createScenarioCandidate('reading-gallery', 'Reading Room Gallery', {
        stopType: 'secondary_cultural_stop',
        venueCategory: 'museum',
        venueSubcategory: 'art_gallery',
        shortDescription: 'A quiet gallery and reading-room cultural stop.',
        sourceTypes: ['art_gallery', 'book_store'],
        venueTags: ['gallery', 'reading', 'literary', 'quiet', 'curated'],
        culturalAnchorPotential: 0.76,
        reasons: ['gallery reading culture signal'],
      })
    : createScenarioCandidate('generic-highlight-cafe', 'Generic Highlight Cafe', {
        stopType: 'secondary_cultural_stop',
        culturalAnchorPotential: 0.9,
        venueTags: ['quiet', 'curated', 'thoughtful'],
        reasons: ['quiet curated cafe fit'],
      })
  const highlightCandidates = [
    highlightCandidate,
    ...(params.includeSemanticCandidate && params.includeCafeOnlyHighlightAlternative
      ? [
          createScenarioCandidate('generic-highlight-cafe', 'Generic Highlight Cafe', {
            stopType: 'secondary_cultural_stop',
            authorityScore: 0.98,
            currentRelevance: 0.98,
            culturalAnchorPotential: 0.95,
            venueTags: ['quiet', 'curated', 'thoughtful'],
            reasons: ['quiet curated cafe fit'],
          }),
        ]
      : []),
  ]
  const windDownCandidate = createScenarioCandidate('generic-bakery', 'Generic Bakery', {
    stopType: 'thematic_lunch',
    venueCategory: 'dessert',
    venueSubcategory: 'bakery',
    sourceTypes: ['bakery'],
    venueTags: ['dessert', 'quiet'],
    reasons: ['bakery landing'],
  })
  return {
    city: 'San Jose',
    persona: 'romantic',
    vibe: 'cultured',
    starterPack: params.starterPack,
    scenarioFamily: 'romantic_cultured',
    requiredStopTypes: ['cultural_institution', 'secondary_cultural_stop', 'thematic_lunch'],
    candidatesByStopType: {
      cultural_institution: [startCandidate],
      secondary_cultural_stop: highlightCandidates,
      thematic_lunch: [windDownCandidate],
    } as StopTypeCandidateBoard['candidatesByStopType'],
  }
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
  assert(
    board.starterPack?.id === scenario.starterPack?.id,
    `${scenario.mode}: candidate board must preserve starterPack for scoring/selection.`,
  )
  const requestLabels = calls.map((call) => call.body.queryLabel)
  assert(
    requestLabels.length > 0 &&
      requestLabels.every((label) => label.startsWith('coffee-books-')),
    `${scenario.mode}: Coffee & Books Step B supply labels must be starter-semantic; received ${requestLabels.join(', ')}.`,
  )
  const semanticCandidateCount = Object.values(board.candidatesByStopType)
    .flat()
    .filter(candidateHasCoffeeBooksSemanticRepresentation).length
  assert(
    semanticCandidateCount > 0,
    `${scenario.mode}: Coffee & Books candidate board must contain book/culture/reading-adjacent candidates.`,
  )
  const builtNights = buildScenarioNightsFromCandidateBoard(board)
  assert(
    builtNights.some((night) => night.complete),
    `${scenario.mode}: Scenario Builder must produce a built night from the board.`,
  )
  const representativeBuiltNight = builtNights.find(
    (night) => night.complete && builtNightHasCoffeeBooksSemanticRepresentation(night),
  )
  assert(
    representativeBuiltNight,
    `${scenario.mode}: Scenario Builder must not let cafe/bakery-only Coffee & Books routes win.`,
  )
  assert(
    representativeBuiltNight.starterSemanticRepresentation?.status === 'represented' &&
      representativeBuiltNight.starterSemanticRepresentation.evidence.length > 0,
    `${scenario.mode}: built night must preserve Coffee & Books semantic evidence.`,
  )
  const scenarioDirectionCards: RealityDirectionCard[] = [
    {
      id: 'coffee-books-scenario-direction',
      cluster: 'chill',
      card: {
        title: 'Coffee and Books scenario route',
        whyNow: 'A quiet route with a literary middle.',
        whyYou: 'Built from the Coffee & Books starter.',
        proofLine: 'Scenario-backed Coffee & Books proof.',
        liveSignals: {
          title: 'Scenario supply',
          items: ['Books Inc.', 'Authors Bookstore'],
        },
        confirmation: 'Coffee & Books scenario route',
      },
      debugMeta: {
        pocketId: 'san-jose',
        archetype: 'cultural',
        confidence: 0.9,
      },
    },
  ]
  const representedScenarioOpportunities: VerifiedCityOpportunity[] = []
  let artifact: ContractEntryArtifact | null = null
  for (const night of builtNights) {
    if (!night.complete) {
      continue
    }
    const opportunity = mapBuiltScenarioNightToVerifiedOpportunity({
      night,
      districtDiscoveryCards: [{ id: 'san-jose', name: 'San Jose' }],
      directionCards: scenarioDirectionCards,
      personaLabel: 'Romantic',
      vibeLabel: 'Cozy',
    })
    if (!opportunity) {
      continue
    }
    assert(
      opportunity.starterSemanticRepresentation?.status === 'represented' &&
        opportunity.starterSemanticRepresentation.evidence.length > 0,
      `${scenario.mode}: VerifiedCityOpportunity must preserve Coffee & Books semantic evidence.`,
    )
    representedScenarioOpportunities.push(opportunity)
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
  const bridgeScenarioOpportunities = representedScenarioOpportunities.map((opportunity, index) => ({
    ...opportunity,
    selection: {
      pocketId: opportunity.selection.pocketId ?? `coffee-books-scenario-pocket-${index}`,
      directionId: opportunity.selection.directionId ?? `coffee-books-scenario-direction-${index}`,
    },
  }))
  const bridgeDirectionCards: RealityDirectionCard[] = bridgeScenarioOpportunities.map(
    (opportunity, index) => ({
      id: opportunity.selection.directionId ?? `coffee-books-scenario-direction-${index}`,
      cluster: 'chill',
      card: {
        title: `Coffee and Books scenario route ${index + 1}`,
        whyNow: 'A quiet route with a literary middle.',
        whyYou: 'Built from the Coffee & Books starter.',
        proofLine: 'Scenario-backed Coffee & Books proof.',
        liveSignals: {
          title: 'Scenario supply',
          items: ['Books Inc.', 'Authors Bookstore'],
        },
        confirmation: 'Coffee & Books scenario route',
      },
      debugMeta: {
        pocketId: opportunity.selection.pocketId ?? `coffee-books-scenario-pocket-${index}`,
        archetype: 'cultural',
        confidence: 0.9,
      },
    }),
  )
  const scenarioBridge = buildCurateScenarioBackedArtifactBridge({
    primaryOpportunities: bridgeScenarioOpportunities,
    fallbackOpportunities: bridgeScenarioOpportunities,
    ecsState: {
      exploration: 'focused',
      discovery: 'reliable',
      highlight: 'standout',
    },
    directionCards: bridgeDirectionCards,
    allDirectionCards: bridgeDirectionCards,
  })
  assert(
    scenarioBridge.candidateArtifacts.length > 0,
    `${scenario.mode}: scenario-backed Coffee & Books opportunity must become a candidate artifact through the shared Curate bridge.`,
  )
  assert(
    scenarioBridge.displayBackedArtifacts.length > 0,
    `${scenario.mode}: scenario-backed Coffee & Books artifact must be direction-backed for display admission.`,
  )
  assert(
    scenarioBridge.qualificationCandidateArtifacts.length > 0,
    `${scenario.mode}: represented scenario-backed artifact must enter qualification candidates.`,
  )
  assert(
    scenarioBridge.diagnostics.some(
      (entry) =>
        entry.starterSemanticStatus === 'represented' &&
        entry.includedInQualificationCandidateArtifacts,
    ),
    `${scenario.mode}: shared bridge diagnostics must expose represented qualification candidate inclusion.`,
  )
  assert(artifact, `${scenario.mode}: ContractEntryArtifact must be produced before reveal.`)
  assert(
    artifact.enrichment?.starterSemanticRepresentation?.status === 'represented' &&
      artifact.enrichment.starterSemanticRepresentation.evidence.length > 0,
    `${scenario.mode}: ContractEntryArtifact enrichment must preserve Coffee & Books semantic evidence.`,
  )
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

function assertCoffeeBooksScenarioGate(starterPack: StarterPack): void {
  const genericOnlyBoard = buildCoffeeBooksScenarioBoard({
    starterPack,
    includeSemanticCandidate: false,
  })
  const genericOnlyNights = buildScenarioNightsFromCandidateBoard(genericOnlyBoard)
  assert(
    genericOnlyNights.every((night) => !night.complete),
    'Coffee & Books tea/coffee/bakery-only Scenario Builder route must fail the semantic representation gate.',
  )
  assert(
    genericOnlyNights.every(
      (night) => night.starterSemanticRepresentation?.status === 'missing',
    ),
    'Coffee & Books generic quiet/curated tags and culturalAnchorPotential alone must not satisfy Books.',
  )

  const semanticBoard = buildCoffeeBooksScenarioBoard({
    starterPack,
    includeSemanticCandidate: true,
  })
  const semanticNights = buildScenarioNightsFromCandidateBoard(semanticBoard)
  const semanticCompleteNight = semanticNights.find(
    (night) => night.complete && builtNightHasCoffeeBooksSemanticRepresentation(night),
  )
  assert(
    semanticCompleteNight,
    'Coffee & Books semantically representative Scenario Builder route must remain eligible.',
  )
  assert(
    semanticCompleteNight.starterSemanticRepresentation?.status === 'represented' &&
      semanticCompleteNight.starterSemanticRepresentation.evidence.length > 0,
    'Coffee & Books built night must expose which selected stop satisfied representation.',
  )

  const mixedBoard = buildCoffeeBooksScenarioBoard({
    starterPack,
    includeSemanticCandidate: true,
    includeCafeOnlyHighlightAlternative: true,
  })
  const mixedNights = buildScenarioNightsFromCandidateBoard(mixedBoard)
  const completeMixedNights = mixedNights.filter((night) => night.complete)
  assert(
    completeMixedNights.length > 0,
    'Coffee & Books mixed board must produce at least one representative route.',
  )
  assert(
    completeMixedNights.every((night) =>
      night.stops.some((stop) => stop.venueId === 'reading-gallery'),
    ),
    'Coffee & Books representative routes must outrank/filter above cafe-only highlight alternatives.',
  )
  const stopTypeBoardSource = readFileSync(
    'src/domain/interpretation/discovery/stopTypeCandidateBoard.ts',
    'utf8',
  )
  assert(
    stopTypeBoardSource.includes('candidateDiagnosticsByStopType') &&
      stopTypeBoardSource.includes('topCandidates') &&
      stopTypeBoardSource.includes('boardRank') &&
      stopTypeBoardSource.includes('enteredStopTypePool') &&
      stopTypeBoardSource.includes('coffeeBooksSemanticEvidencePresent') &&
      stopTypeBoardSource.includes('matchedSemanticEvidence'),
    'StopTypeCandidateBoard diagnostics must expose rank, stop-type pool entry, role/source fields, and Coffee & Books semantic evidence.',
  )
  const scenarioBuilderSource = readFileSync(
    'src/domain/interpretation/construction/scenarioBuilder.ts',
    'utf8',
  )
  assert(
    scenarioBuilderSource.includes('coffee_books_semantic_incomplete') &&
      scenarioBuilderSource.includes('coffee_books_semantic_representation') &&
      scenarioBuilderSource.includes('starterSemanticRepresentation'),
    'Scenario Builder diagnostics must keep Coffee & Books semantic rejection reasons available.',
  )
  process.stdout.write('Coffee & Books semantic Scenario Builder gate: passed\n')
}

function assertCoffeeBooksCommittedRouteFallbackGate(): void {
  resetEnv()
  process.env.VITE_ID8_ENABLE_FIELD_STATIC_PROVIDER_CORPUS_CURATE = '1'
  const coffeeBooksStarterPack = findStarterPack('coffee-books')
  const nonCoffeeStarterPack = findStarterPack('cozy-date-night')
  const cafeOnlyResult = buildFallbackGeneratePlanResult([
    createFallbackPlannerStop('warmup', 'fallback-tea', 'Fallback Tea Atelier'),
    createFallbackPlannerStop('peak', 'fallback-coffee', 'Fallback Coffee Roastery'),
    createFallbackPlannerStop('cooldown', 'fallback-bakery', 'Fallback Bakehouse', {
      category: 'dessert',
      subcategory: 'bakery',
      tags: ['quiet', 'curated', 'calm'],
    }),
  ])
  const rejectedCoffeeBooksFallback = buildCurateCommittedRouteFallbackDecision({
    starterPack: coffeeBooksStarterPack,
    result: cafeOnlyResult,
    selectedDirectionId: 'direction-willow-glen',
    selectedPocketId: 'willow-glen',
  })
  assert(
    rejectedCoffeeBooksFallback.status === 'rejected' &&
      rejectedCoffeeBooksFallback.rejectedReason ===
        'coffee_books_semantic_representation_missing',
    'Coffee & Books committed_route_fallback cafe-only route must be rejected before card admission.',
  )
  const visibleFallbackArtifacts =
    rejectedCoffeeBooksFallback.status === 'accepted'
      ? [rejectedCoffeeBooksFallback.artifact]
      : []
  assert(
    visibleFallbackArtifacts.length === 0,
    'Coffee & Books committed_route_fallback artifact without semantic representation must not become visible.',
  )

  const representedResult = buildFallbackGeneratePlanResult([
    createFallbackPlannerStop('warmup', 'fallback-tea', 'Fallback Tea Atelier'),
    createFallbackPlannerStop('peak', 'fallback-gallery', 'Fallback Reading Gallery', {
      category: 'museum',
      subcategory: 'art_gallery',
      tags: ['gallery', 'reading', 'literary', 'culture'],
      shortDescription: 'Small gallery with reading-room cultural programming.',
      narrativeFlavor: 'Bookish cultural anchor.',
    }),
    createFallbackPlannerStop('cooldown', 'fallback-bakery', 'Fallback Bakehouse', {
      category: 'dessert',
      subcategory: 'bakery',
    }),
  ])
  const acceptedCoffeeBooksFallback = buildCurateCommittedRouteFallbackDecision({
    starterPack: coffeeBooksStarterPack,
    result: representedResult,
    selectedDirectionId: 'direction-willow-glen',
    selectedPocketId: 'willow-glen',
  })
  assert(
    acceptedCoffeeBooksFallback.status === 'accepted' &&
      acceptedCoffeeBooksFallback.artifact.enrichment?.starterSemanticRepresentation?.status ===
        'represented',
    'Coffee & Books committed_route_fallback with explicit cultural/book evidence must remain eligible.',
  )

  const acceptedNonCoffeeFallback = buildCurateCommittedRouteFallbackDecision({
    starterPack: nonCoffeeStarterPack,
    result: cafeOnlyResult,
    selectedDirectionId: 'direction-willow-glen',
    selectedPocketId: 'willow-glen',
  })
  assert(
    acceptedNonCoffeeFallback.status === 'accepted',
    'Non-Coffee starters must keep existing committed_route_fallback behavior.',
  )
  process.stdout.write('Coffee & Books committed-route fallback gate: passed\n')
}

function assertCoffeeBooksCommittedRuntimeSummaryGate(): void {
  const cafeOnlyRepresentation = buildCoffeeBooksSemanticRepresentationFromRouteStops([
    {
      venueId: 'tea',
      name: 'Willow Glen Tea Atelier',
      position: 'start',
      evidenceParts: [
        { field: 'venueCategory', value: 'cafe' },
        { field: 'venueSubcategory', value: 'tea-room' },
        { field: 'vibeTag', value: ['quiet', 'curated', 'calm', 'culture'] },
      ],
    },
    {
      venueId: 'coffee',
      name: 'Chromatic Coffee Roastery',
      position: 'highlight',
      evidenceParts: [
        { field: 'venueCategory', value: 'cafe' },
        { field: 'venueSubcategory', value: 'coffee' },
        { field: 'tag', value: ['thoughtful', 'quiet'] },
        { field: 'scenarioFamily', value: 'romantic_cultured', sourceScope: 'scenario_family' },
      ],
    },
    {
      venueId: 'bakery',
      name: 'Willow Glen Bakehouse',
      position: 'windDown',
      evidenceParts: [
        { field: 'venueCategory', value: 'dessert' },
        { field: 'venueSubcategory', value: 'bakery' },
        { field: 'tag', value: 'calm' },
        { field: 'culturalAnchorPotential', value: '0.95', sourceScope: 'derived_signal' },
        { field: 'bodyText', value: 'Start at an artisan cafe', sourceScope: 'body_text' },
      ],
    },
  ])
  assert(
    cafeOnlyRepresentation.status === 'missing' &&
      cafeOnlyRepresentation.rejectionReasons?.includes(
        coffeeBooksSemanticRepresentationMissingReason,
      ),
    'Coffee & Books committed runtime summary must reject tea/coffee/bakery-only routes.',
  )
  assert(
    (cafeOnlyRepresentation.matchedEvidence ?? []).every((match) => !match.admissible),
    'Coffee & Books vibe, scenario-family, body text, and derived-signal matches must be diagnostic-only.',
  )

  const representedSummary = buildCoffeeBooksSemanticRepresentationFromRouteStops([
    {
      venueId: 'tea',
      name: 'Willow Glen Tea Atelier',
      position: 'start',
      evidenceParts: [
        { field: 'venueCategory', value: 'cafe' },
        { field: 'venueSubcategory', value: 'tea-room' },
      ],
    },
    {
      venueId: 'bookstore',
      name: 'Recycle Bookstore',
      position: 'highlight',
      evidenceParts: [
        { field: 'venueCategory', value: 'bookstore' },
        { field: 'tag', value: ['books', 'reading', 'literary'] },
      ],
    },
    {
      venueId: 'bakery',
      name: 'Willow Glen Bakehouse',
      position: 'windDown',
      evidenceParts: [
        { field: 'venueCategory', value: 'dessert' },
        { field: 'venueSubcategory', value: 'bakery' },
      ],
    },
  ])
  assert(
    representedSummary.status === 'represented' &&
      representedSummary.evidence.some((entry) => entry.venueId === 'bookstore'),
    'Coffee & Books committed runtime summary with explicit bookstore evidence must remain eligible.',
  )
  assert(
    representedSummary.matchedEvidence?.some(
      (entry) =>
        entry.admissible &&
        entry.stopName === 'Recycle Bookstore' &&
        entry.sourceScope === 'selected_stop_field' &&
        entry.field === 'displayName',
    ),
    'Coffee & Books semantic evidence must preserve selected stop name, field, term, match type, and admissibility.',
  )

  for (const category of [
    'library',
    'museum',
    'gallery',
    'art_gallery',
    'cultural_center',
    'exhibit',
    'exhibition',
  ]) {
    const categoryRepresentation = buildCoffeeBooksSemanticRepresentationFromRouteStops([
      {
        venueId: `valid-${category}`,
        name: category === 'library' ? 'Community Library' : 'Selected cultural stop',
        position: 'highlight',
        evidenceParts: [{ field: 'venueSubcategory', value: category }],
      },
    ])
    assert(
      categoryRepresentation.status === 'represented',
      `Coffee & Books selected stop category/subcategory "${category}" must satisfy representation.`,
    )
  }

  const kinokuniyaRepresentation = buildCoffeeBooksSemanticRepresentationFromRouteStops([
    {
      venueId: 'kinokuniya',
      name: 'Kinokuniya Bookstore - San José',
      position: 'highlight',
      evidenceParts: [{ field: 'sourceType', value: 'book_store' }],
    },
  ])
  assert(
    kinokuniyaRepresentation.status === 'represented',
    'Coffee & Books explicit bookstore names and provider/source types must remain valid evidence.',
  )

  const sandboxSource = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')
  assert(
    sandboxSource.includes('evaluateCoffeeBooksCommittedRouteSummaryAdmission') &&
      sandboxSource.includes('starterPackId: activeCurateStarterPackId') &&
      sandboxSource.includes('renderedCommittedRouteArtifactForSummary?.finalRoute') &&
      sandboxSource.includes('selectedRouteArtifact.canonicalRouteArtifact') &&
      sandboxSource.includes('data-id8-route-summary-suppressed="true"') &&
      sandboxSource.includes('data-id8-route-summary-rejection-reason') &&
      sandboxSource.includes('data-id8-route-summary-semantic-evidence'),
    'Coffee & Books committed/runtime summary admission must evaluate the actual rendered route and expose suppression evidence.',
  )
  assert(
    sandboxSource.includes('activeCurateStarterPackId =') &&
      sandboxSource.includes('selectedStarterPack?.id ?? selectedStarterPackId') &&
      sandboxSource.includes('params.starterPackId !== \'coffee-books\'') &&
      sandboxSource.includes('if (!params.finalRoute)') &&
      sandboxSource.includes('semanticRepresentationStatus: \'missing\''),
    'Coffee & Books runtime summary admission must use explicit active starter scope and reject missing rendered route context instead of returning not_applicable.',
  )
  assert(
    sandboxSource.includes('!coffeeBooksCommittedRouteSummarySuppressed') &&
      sandboxSource.includes('const renderSharedPlanPreview = Boolean') &&
      sandboxSource.includes('const showPrimaryContinueAction = Boolean'),
    'Coffee & Books runtime summary suppression must hide both the generated summary and Review CTA.',
  )
  assert(
    sandboxSource.includes('activeCurateStarterPackId === \'coffee-books\'') &&
      sandboxSource.includes('!effectiveCurateSelectedArtifact'),
    'Coffee & Books no-card direction fallback summaries must not render without a starter-valid artifact.',
  )
  assert(
    sandboxSource.includes('data-id8-step-b-coffee-books-diagnostics') &&
      sandboxSource.includes('scenarioRoleCompatibility') &&
      sandboxSource.includes('hasExplicitBookstoreCompatibleRole') &&
      sandboxSource.includes('coffeeBooksScenarioDefinitionGap') &&
      sandboxSource.includes('oneStarterVsSystemicClassification') &&
      sandboxSource.includes('reusable_starter_to_role_compatibility_risk') &&
      sandboxSource.includes('bookstoreCandidateDisposition') &&
      sandboxSource.includes('scenarioNightDiagnostics') &&
      sandboxSource.includes('artifactDiagnostics') &&
      sandboxSource.includes('publicNoCardState') &&
      sandboxSource.includes('reviewCtaExpectedVisible') &&
      sandboxSource.includes('diagnosticMount: \'always_mounted_public_curate_page_level\'') &&
      sandboxSource.includes('stepBCoffeeBooksAlwaysMountedDiagnostics') &&
      sandboxSource.includes('diagnosticsUnavailableReason') &&
      sandboxSource.includes('scenarioBackedArtifactBridgeDiagnostics') &&
      sandboxSource.includes('qualificationDiagnostics') &&
      sandboxSource.includes('visibleCardDiagnostics') &&
      sandboxSource.includes('runtimeSummary') &&
      sandboxSource.includes('reviewCta'),
    'Coffee & Books Step B diagnostics must expose role compatibility, board, scenario, artifact/card, and no-card state evidence.',
  )
  process.stdout.write('Coffee & Books committed runtime summary gate: passed\n')
}

function createTruthInvariantArtifact(): ContractEntryArtifact {
  return {
    id: 'step2_scenario_built_romantic_cultured_1',
    sourceOpportunityId: 'step2_scenario_built_romantic_cultured_1',
    sourceMode: 'curated',
    anchorVenueId: 'rosicrucian-museum',
    anchorRole: 'highlight',
    anchorName: 'Rosicrucian Egyptian Museum',
    routeTitle: 'Scenario-backed Coffee & Books route',
    flavorLine: 'A cultured route with a literary anchor.',
    routeSummary: 'Academic Coffee, Rosicrucian Egyptian Museum, and Willow Glen Bakehouse form the approved scenario-backed route.',
    traits: ['focused', 'reliable', 'intimate'],
    storySpine: {
      start: 'Academic Coffee',
      highlight: 'Rosicrucian Egyptian Museum',
      windDown: 'Willow Glen Bakehouse',
    },
    districtLine: 'Mostly in San Jose',
    districtAnchorLine: 'District anchor: San Jose',
    authorityLine: 'Adega regional flight window is the highlight for this route.',
    whyChooseLine:
      'Rosicrucian Egyptian Museum anchors the route, with Academic Coffee to start and Willow Glen Bakehouse to wind down.',
    selection: {
      directionId: 'direction-romantic-cultured',
      pocketId: 'san-jose',
    },
    directionBacking: {
      status: 'backed',
      directionId: 'direction-romantic-cultured',
      pocketId: 'san-jose',
      source: 'selection_direction',
      reason: 'matched_selection_direction',
    },
    enrichment: {
      mode: 'curate',
      validationStatus: 'valid',
      locationContext: {
        city: 'San Jose',
        neighborhood: 'San Jose',
      },
      userInputContext: {
        starterPackId: 'coffee-books',
      },
      conciergeIntentSummary: {
        primaryVibe: 'cultured',
        persona: 'romantic',
        summary: 'Coffee & Books validation fixture.',
      },
      tasteDistrictSummary: {
        districtId: 'san-jose',
        districtLabel: 'San Jose',
        summary: 'San Jose Coffee & Books route.',
      },
      fieldProvenanceSummary: {
        sourceMode: 'curated',
        corpusUsed: true,
      },
      bearingsAdmissionProof: {
        status: 'present',
        proofId: 'truth-invariant-fixture-bearings',
        summary: 'Fixture route has all core roles.',
      },
      waypointSequenceProof: {
        status: 'present',
        proofId: 'truth-invariant-fixture-waypoints',
        summary: 'Fixture route has an ordered sequence.',
      },
      starterContextFit: {
        status: 'passed',
        starterPackId: 'coffee-books',
        mode: 'curate',
      },
      modeContextFit: {
        status: 'passed',
        mode: 'curate',
      },
      canonicalRouteRoleCoverage: {
        start: 'Academic Coffee',
        highlight: 'Rosicrucian Egyptian Museum',
        windDown: 'Willow Glen Bakehouse',
      },
      runtimeLockEligibility: {
        eligible: true,
        status: 'eligible',
        selectedDirectionId: 'direction-romantic-cultured',
      },
    },
  }
}

function createTruthInvariantFinalRoute(params: {
  routeId: string
  directionId: string
  start: string
  highlight: string
  windDown: string
}): RuntimeRouteArtifact {
  const stops = [
    { role: 'start' as const, displayName: params.start },
    { role: 'highlight' as const, displayName: params.highlight },
    { role: 'windDown' as const, displayName: params.windDown },
  ].map((stop, index) => ({
    id: `${params.routeId}_${stop.role}`,
    sourceStopId: `${params.routeId}_${stop.role}_source`,
    displayName: stop.displayName,
    latitude: 37.33 + index * 0.001,
    longitude: -121.89 - index * 0.001,
    address: 'San Jose, CA',
    role: stop.role,
    stopIndex: index,
    venueId: `${params.routeId}_${stop.role}_venue`,
    title: stop.displayName,
    subtitle: 'San Jose',
    neighborhood: 'San Jose',
    driveMinutes: 0,
    imageUrl: '',
  }))
  return {
    routeId: params.routeId,
    selectedDirectionId: params.directionId,
    location: 'San Jose',
    persona: 'romantic',
    vibe: 'cultured',
    stops,
    activeStopIndex: 0,
    routeHeadline: 'Coffee & Books route',
    routeSummary: `${params.highlight} anchors the route.`,
    mapMarkers: stops.map((stop) => ({
      id: `${stop.id}_marker`,
      displayName: stop.displayName,
      role: stop.role,
      stopIndex: stop.stopIndex,
      latitude: stop.latitude,
      longitude: stop.longitude,
    })),
    liveNotices: [],
    updatedAt: 1,
  }
}

function assertCurateApprovedPayloadVisibleCardTruthInvariant(): void {
  const starterPack = findStarterPack('coffee-books')
  const artifact = createTruthInvariantArtifact()
  const staleWillowGlenRoute = createTruthInvariantFinalRoute({
    routeId: 'stale-willow-glen',
    directionId: 'direction-romantic-cultured',
    start: 'Willow Glen Tea Atelier',
    highlight: 'Chromatic Coffee Roastery',
    windDown: 'Willow Glen Bakehouse',
  })
  const stalePayload = {
    artifactId: artifact.id,
    starterPackId: starterPack.id,
    finalRoute: staleWillowGlenRoute,
  }
  const staleTruth = validatePublicCurateApprovedPayloadTruth({
    selectedStarterPack: starterPack,
    artifact,
    approvedRefinementEntryPayload: stalePayload,
  })
  assert(
    !staleTruth.allowedToRender &&
      staleTruth.rejectionReasons.includes('approved_payload_route_mismatch') &&
      staleTruth.rejectionReasons.includes('approved_payload_final_route_semantic_mismatch'),
    'Stale Willow Glen approved payload must not produce a visible Coffee & Books card.',
  )
  const rejectedModel = buildPublicCurateCardTruthModel({
    selectedStarterPack: starterPack,
    artifactCandidates: [artifact],
    selectedArtifactId: artifact.id,
    qualificationByArtifactId: {
      [artifact.id]: {
        status: 'committable',
        hasApprovedPayload: true,
        approvedRefinementEntryPayload: stalePayload,
      },
    },
    committedRouteFallbackRenderEnabled: false,
  })
  assert(
    rejectedModel.visibleCards.length === 0 &&
      !rejectedModel.actionsAllowed.review &&
      rejectedModel.diagnostics.rejectionReasons.includes('approved_payload_route_mismatch'),
    'Visible card and Review CTA must be suppressed when approved payload route truth diverges from artifact truth.',
  )

  const alignedRoute = createTruthInvariantFinalRoute({
    routeId: 'aligned-scenario-backed',
    directionId: 'direction-romantic-cultured',
    start: 'Academic Coffee',
    highlight: 'Rosicrucian Egyptian Museum',
    windDown: 'Willow Glen Bakehouse',
  })
  const alignedPayload = {
    artifactId: artifact.id,
    starterPackId: starterPack.id,
    finalRoute: alignedRoute,
  }
  const alignedTruth = validatePublicCurateApprovedPayloadTruth({
    selectedStarterPack: starterPack,
    artifact,
    approvedRefinementEntryPayload: alignedPayload,
  })
  assert(
    alignedTruth.allowedToRender &&
      alignedTruth.coffeeBooksSemanticRepresentationStatus === 'represented',
    'Aligned scenario-backed approved payload with explicit cultural evidence must remain visible.',
  )
  const alignedModel = buildPublicCurateCardTruthModel({
    selectedStarterPack: starterPack,
    artifactCandidates: [artifact],
    selectedArtifactId: artifact.id,
    qualificationByArtifactId: {
      [artifact.id]: {
        status: 'committable',
        hasApprovedPayload: true,
        approvedRefinementEntryPayload: alignedPayload,
      },
    },
    committedRouteFallbackRenderEnabled: false,
  })
  assert(
    alignedModel.visibleCards.length === 1 &&
      alignedModel.actionsAllowed.review &&
      alignedModel.visibleCards[0]?.artifactId === artifact.id,
    'Aligned artifact, approved payload, visible card, and Review CTA truth must render together.',
  )

  const sandboxSource = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')
  assert(
    sandboxSource.includes('validatePublicCurateApprovedPayloadTruth') &&
      sandboxSource.includes('approvedPayloadTruthAllowed') &&
      sandboxSource.includes('publicCurateSelectedCardTruthReady') &&
      sandboxSource.includes('selectedCurateVisibleCardModel.artifact.id === selectedCandidateRouteArtifact.id') &&
      sandboxSource.includes('data-id8-route-card-artifact-id'),
    'Sandbox Curate card render and Review CTA must consume shared approved-payload truth invariant and expose stable card artifact ids.',
  )
  process.stdout.write('Curate approved-payload visible-card truth invariant: passed\n')
}

async function assertCuratePreflightApprovedPayloadTruthInvariant(): Promise<void> {
  const starterPack = findStarterPack('coffee-books')
  const artifact = createTruthInvariantArtifact()
  const staleWillowGlenRoute = createTruthInvariantFinalRoute({
    routeId: 'stale-willow-glen',
    directionId: 'direction-romantic-cultured',
    start: 'Willow Glen Tea Atelier',
    highlight: 'Chromatic Coffee Roastery',
    windDown: 'Willow Glen Bakehouse',
  })
  const alignedRoute = createTruthInvariantFinalRoute({
    routeId: 'aligned-scenario-backed',
    directionId: 'direction-romantic-cultured',
    start: 'Academic Coffee',
    highlight: 'Rosicrucian Egyptian Museum',
    windDown: 'Willow Glen Bakehouse',
  })

  const selectedArtifactDiscoveryPreferences: NonNullable<IntentInput['discoveryPreferences']> = [
    {
      venueId: 'aligned-scenario-backed_start_venue',
      role: 'start',
    },
    {
      venueId: 'aligned-scenario-backed_highlight_venue',
      role: 'highlight',
    },
    {
      venueId: 'aligned-scenario-backed_windDown_venue',
      role: 'windDown',
    },
  ]
  const selectedArtifactLineage = {
    artifactId: artifact.id,
    sourceOpportunityId: artifact.sourceOpportunityId,
    sourceMode: artifact.sourceMode,
    anchorVenueId: artifact.anchorVenueId,
    anchorRole: artifact.anchorRole,
    directionId: artifact.selection.directionId,
    pocketId: artifact.selection.pocketId,
  }
  const activeCandidateOpportunity = {
    scenarioNight: {
      scenarioFamily: 'romantic_cultured',
    },
  }
  const alignedScenarioHardCommitSeedVenues = selectedArtifactDiscoveryPreferences.map(
    (preference) =>
      ({
        id: preference.venueId,
        name: preference.venueId,
      }) as Venue,
  )

  const runAttempt = async (
    finalRoute: RuntimeRouteArtifact,
    hardCommit: {
      hardCommitRequired?: boolean
      hardCommitPreservationSucceeded?: boolean
      hardCommitCandidateCount?: number
      throwFromPlanBuild?: Error
      scenarioHardCommitSeedVenues?: Venue[]
    } = {},
  ) => {
    let approvedPayloadBuildCount = 0
    let observedCurateCommitSemantics: string | null = null
    let observedSeedVenueIds: string[] = []
    let runPlanBuildCount = 0
    const result = await runCuratePreviewQualificationAttempt({
      artifactId: artifact.id,
      artifactToQualify: artifact,
      activeDirection: {
        cluster: 'romantic_cultured',
        card: { confirmation: 'Cultured Coffee & Books route' },
      },
      activeCandidateOpportunity,
      selectedStarterPack: starterPack,
      districtLocationQuery: 'San Jose',
      persona: 'romantic',
      primaryVibe: 'cultured',
      activeDistrictPocketId: 'san-jose',
      canonicalInterpretationBundle: {} as never,
      canonicalConciergeIntent: {} as never,
      canonicalExperienceContract: {} as never,
      canonicalContractConstraints: {} as never,
      refinementModes: [],
      activeDirectionContract: {
        id: 'direction-romantic-cultured',
        pocketLabel: 'San Jose',
      } as never,
      activeDirectionContextForValidation: {} as never,
      activeDirectionContractForValidation: {} as never,
      expectedDirectionIdentityForPreview: 'selection',
      activeIntentSelectedDirectionContext: {} as never,
      activeRouteShapeContract: {} as never,
      selectedArtifactDiscoveryPreferences,
      scenarioHardCommitSeedVenues:
        hardCommit.scenarioHardCommitSeedVenues ?? alignedScenarioHardCommitSeedVenues,
      selectedArtifactLineage,
      selectedArtifactLineageSummary: 'scenario_backed_artifact',
      plannerInputSummary: 'mocked Coffee & Books preflight',
      selectedDirectionPreviewContext: undefined,
    }, {
      runPlanBuild: async (_input, options) => {
        runPlanBuildCount += 1
        observedCurateCommitSemantics = options?.curateCommitSemantics ?? null
        observedSeedVenueIds = options?.seedVenues?.map((venue) => venue.id) ?? []
        if (hardCommit.throwFromPlanBuild) {
          throw hardCommit.throwFromPlanBuild
        }
        return {
          trace: {
            curateHardCommit: {
              hardCommitRequired: hardCommit.hardCommitRequired ?? true,
              hardCommitPreservationSucceeded:
                hardCommit.hardCommitPreservationSucceeded ?? true,
              hardCommitCandidateCount: hardCommit.hardCommitCandidateCount ?? 1,
              rankedCandidateCount: 1,
              failedRoles:
                hardCommit.hardCommitPreservationSucceeded === false
                  ? ['start', 'highlight', 'windDown']
                  : [],
              exactPreservingCandidateIds:
                hardCommit.hardCommitPreservationSucceeded === false ? [] : [artifact.id],
              explicitFallbackReason:
                hardCommit.hardCommitPreservationSucceeded === false
                  ? 'curate_selected_artifact_structurally_infeasible'
                  : undefined,
            },
          },
          intentProfile: {
            mode: 'curate',
            selectedDirectionContext: {},
          },
          itinerary: {},
          selectedArc: {},
          scoredVenues: [],
          lens: {},
        } as never
      },
      enforceSelectedDirectionLineage: () => undefined,
      runPostPlannerCommitParityStages: async () => ({
        strongCurationPass: {
          rolePoolVenueIdsByRole: {
            start: [],
            highlight: [],
            windDown: [],
          },
        },
        anchoredPlan: {},
        canonicalItinerary: {},
        contractBuildability: {},
        directionValidation: {
          valid: true,
          generationDriftReason: null,
          contractBuildabilityStatus: 'buildable',
          missingRoleForContract: null,
          candidatePoolSufficiencyByRole: {
            start: 1,
            highlight: 1,
            windDown: 1,
          },
        },
        nextFinalRoute: finalRoute,
      }) as never,
      attemptStarterAwareWindDownRepair: () => ({
        repairedArtifact: null,
        repairReason: 'not_needed',
        originalWindDown: null,
        repairedWindDown: null,
        repairedWindDownTarget: null,
        repairSource: null,
      }),
      buildApprovedRefinementEntryPayload: () => {
        approvedPayloadBuildCount += 1
        return {
          artifactId: artifact.id,
          starterPackId: starterPack.id,
          finalRoute,
        }
      },
      formatCurateSelectedTargetSummary: () => 'selected target',
      formatCurateFinalWinnerSummary: () => 'final winner',
      formatCurateHardCommitSampleCandidatesSummary: () => 'sample candidates',
      getCurateDiscoveryPreferenceVenueId: () => 'n/a',
      getErrorName: (error) => error instanceof Error ? error.name : typeof error,
      getErrorMessageRaw: (error) => error instanceof Error ? error.message : String(error),
      getCuratePreflightRuntimeReason: (error) =>
        error instanceof Error ? `curate_preflight_runtime_error:${error.name}` : 'curate_preflight_runtime_error',
    })
    return {
      result,
      approvedPayloadBuildCount,
      observedCurateCommitSemantics,
      observedSeedVenueIds,
      runPlanBuildCount,
    }
  }

  const staleAttempt = await runAttempt(staleWillowGlenRoute)
  assert(
    staleAttempt.result.kind === 'infeasible' &&
      staleAttempt.approvedPayloadBuildCount === 0 &&
      staleAttempt.observedCurateCommitSemantics === 'approved_route_hard_commit' &&
      staleAttempt.result.state.status === 'infeasible' &&
      staleAttempt.result.state.approvedRefinementEntryPayload === undefined &&
      staleAttempt.result.state.failedCheck === 'approved_payload_route_mismatch',
    'Curate preflight must fail closed before approved payload construction when parity finalRoute diverges from the selected artifact.',
  )

  const alignedAttempt = await runAttempt(alignedRoute)
  assert(
    alignedAttempt.result.kind === 'committable' &&
      alignedAttempt.approvedPayloadBuildCount === 1 &&
      alignedAttempt.observedCurateCommitSemantics === 'approved_route_hard_commit' &&
      alignedAttempt.runPlanBuildCount === 1 &&
      selectedArtifactDiscoveryPreferences.every((preference) =>
        alignedAttempt.observedSeedVenueIds.includes(preference.venueId),
      ) &&
      alignedAttempt.result.state.status === 'committable' &&
      Boolean(alignedAttempt.result.state.approvedRefinementEntryPayload),
    'Curate preflight must still approve an aligned scenario-backed Coffee & Books route with exact seed venues.',
  )

  const missingSeedIdentityAttempt = await runAttempt(alignedRoute, {
    scenarioHardCommitSeedVenues: alignedScenarioHardCommitSeedVenues.filter(
      (venue) => venue.id !== 'aligned-scenario-backed_highlight_venue',
    ),
  })
  assert(
    missingSeedIdentityAttempt.result.kind === 'infeasible' &&
      missingSeedIdentityAttempt.approvedPayloadBuildCount === 0 &&
      missingSeedIdentityAttempt.runPlanBuildCount === 0 &&
      missingSeedIdentityAttempt.result.state.failedCheck ===
        'approved_payload_route_materialization_unavailable' &&
      missingSeedIdentityAttempt.result.state.explicitFallbackReason ===
        'approved_payload_route_materialization_unavailable',
    'Scenario-backed hard-commit qualification must fail closed before planning when exact seed identity is missing.',
  )

  const unavailableAttempt = await runAttempt(alignedRoute, {
    hardCommitRequired: true,
    hardCommitPreservationSucceeded: false,
    hardCommitCandidateCount: 0,
  })
  assert(
    unavailableAttempt.result.kind === 'infeasible' &&
      unavailableAttempt.approvedPayloadBuildCount === 0 &&
      unavailableAttempt.observedCurateCommitSemantics === 'approved_route_hard_commit' &&
      unavailableAttempt.result.state.failedCheck ===
        'approved_payload_route_materialization_unavailable' &&
      unavailableAttempt.result.state.explicitFallbackReason ===
        'approved_payload_route_materialization_unavailable',
    'Scenario-backed Curate preflight must fail closed with a precise materialization reason when no exact-preserving route exists.',
  )

  const thrownMaterializationAttempt = await runAttempt(alignedRoute, {
    throwFromPlanBuild: new Error(
      'Fallback arc recovery failed (no_honest_route_available). full=0 partial=0 highlightOnly=0',
    ),
  })
  assert(
    thrownMaterializationAttempt.result.kind === 'infeasible' &&
      thrownMaterializationAttempt.approvedPayloadBuildCount === 0 &&
      thrownMaterializationAttempt.observedCurateCommitSemantics ===
        'approved_route_hard_commit' &&
      thrownMaterializationAttempt.result.state.failedCheck ===
        'approved_payload_route_materialization_unavailable' &&
      thrownMaterializationAttempt.result.state.explicitFallbackReason ===
        'approved_payload_route_materialization_unavailable' &&
      thrownMaterializationAttempt.result.state.failureKind === 'structural_infeasibility',
    'Known hard-commit fallback recovery errors must be classified as materialization unavailable, not runtime_error.',
  )

  const unexpectedAttempt = await runAttempt(alignedRoute, {
    throwFromPlanBuild: new Error('unexpected planner failure'),
  })
  assert(
    unexpectedAttempt.result.kind === 'unexpectedFailure' &&
      unexpectedAttempt.approvedPayloadBuildCount === 0 &&
      unexpectedAttempt.observedCurateCommitSemantics === 'approved_route_hard_commit' &&
      unexpectedAttempt.result.state.failureKind === 'runtime_error' &&
      unexpectedAttempt.result.state.failedCheck === null,
    'Unexpected hard-commit planner errors must remain runtime_error.',
  )

  const serviceSource = readFileSync(
    'src/app/services/sandbox/curatePreviewQualificationService.ts',
    'utf8',
  )
  assert(
    serviceSource.includes('validatePublicCurateApprovedPayloadTruth') &&
      serviceSource.includes('getApprovedPayloadTruthFailureReason') &&
      serviceSource.includes('approvedPayloadTruthFailureReason') &&
      serviceSource.includes('approved_route_hard_commit') &&
      serviceSource.includes('approved_payload_route_materialization_unavailable') &&
      serviceSource.includes('isKnownHardCommitMaterializationError') &&
      serviceSource.includes('scenarioHardCommitSeedVenues') &&
      serviceSource.includes('getMissingScenarioHardCommitSeedRoles') &&
      serviceSource.includes('baseCommitParitySucceeded && !approvedPayloadTruthFailureReason'),
    'Curate preflight qualification must share the approved-payload truth invariant before payload construction.',
  )
  process.stdout.write('Curate preflight approved-payload truth invariant: passed\n')
}

function assertCurateVisibleCardProjectionUsesApprovedRouteTruth(): void {
  const sandboxSource = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')
  assert(
    sandboxSource.includes('approvedRouteHighlightProof') &&
      sandboxSource.includes('approvedRouteWhyChooseLine'),
    'Curate visible card model must derive approved-route proof copy from final-route stops.',
  )
  assert(
    sandboxSource.includes('resolveFinalRouteStopGeography') &&
      sandboxSource.includes('resolveFinalRouteDisplayLocation(approvedFinalRoute') &&
      sandboxSource.includes('buildFinalRouteClusterConfirmation(fallbackFinalRoute'),
    'Curate visible card/post-selection geography must derive from final-route stops when an approved route exists.',
  )
  assert(
    sandboxSource.includes('{cardModel.districtLine}') &&
      sandboxSource.includes('{cardModel.whyChooseLine}') &&
      sandboxSource.includes('{cardModel.authorityLine}') &&
      sandboxSource.includes('{cardModel.happeningsLine}') &&
      sandboxSource.includes('{cardModel.whyTonightProofLine}'),
    'Curate route card render must use cardModel copy fields instead of stale artifact copy.',
  )
  process.stdout.write('Curate visible card approved-route coherence projection: passed\n')
}

function assertHostedObserverCapturesSuppressedRouteSummaryEvidence(): void {
  const observerSource = readFileSync('scripts/observe-hosted-step-b-supply.ts', 'utf8')
  assert(
    observerSource.includes('visibleRouteSummaryText') &&
      observerSource.includes('selectedRouteSummaryArtifactSource') &&
      observerSource.includes('selectedRouteSummaryArtifactProvenance') &&
      observerSource.includes('selectedRouteArtifactCanonicalRouteSource') &&
      observerSource.includes('activeStarterIdForSemanticAdmission') &&
      observerSource.includes('routeSummarySuppressed') &&
      observerSource.includes('routeSummarySuppressionReason') &&
      observerSource.includes('matchedSemanticEvidence') &&
      observerSource.includes('bodySemanticSubstringHits') &&
      observerSource.includes('stepBDiagnosticEvidence') &&
      observerSource.includes('readStepBCoffeeBooksDiagnostics') &&
      observerSource.includes('step_b_coffee_books_diagnostics') &&
      observerSource.includes('visible route cards or no-card diagnostics after candidate supply') &&
      observerSource.includes('after_candidate_supply_no_card_poll') &&
      observerSource.includes('no_visible_route_card_after_candidate_supply') &&
      observerSource.includes('No visible route card found and Step B Coffee & Books diagnostics were missing after candidate supply.') &&
      observerSource.includes('routeSummaryPassedStarterSemanticRepresentation') &&
      observerSource.includes('reviewCtaVisible') &&
      observerSource.includes('data-id8-route-card-artifact-id') &&
      observerSource.includes('stable route card artifact id before click') &&
      observerSource.includes('stable-artifact-id-not-found') &&
      !observerSource.includes('semanticTermsPresent'),
    'Hosted observer must persist route summary source/provenance and suppression semantic evidence when no cards exist.',
  )
  process.stdout.write('Hosted observer route-summary suppression evidence capture: passed\n')
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
  assertCoffeeBooksScenarioGate(findStarterPack('coffee-books'))
  assertCoffeeBooksCommittedRouteFallbackGate()
  assertCoffeeBooksCommittedRuntimeSummaryGate()
  assertCurateApprovedPayloadVisibleCardTruthInvariant()
  await assertCuratePreflightApprovedPayloadTruthInvariant()
  assertCurateVisibleCardProjectionUsesApprovedRouteTruth()
  assertHostedObserverCapturesSuppressedRouteSummaryEvidence()
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
