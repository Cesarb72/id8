import { readFileSync } from 'node:fs'
import {
  buildLockInputFromRouteAuthoritySnapshot,
  buildRouteAuthoritySnapshot,
} from '../src/app/services/routeAuthority/routeAuthorityService.ts'
import { buildApplicationConciergeIntent } from '../src/app/concierge/conciergeIntentAdapter.ts'
import { buildAnchorTruthContract } from '../src/domain/artifacts/buildAnchorTruthContract.ts'
import { buildCanonicalInterpretationBundle } from '../src/domain/interpretation/buildCanonicalInterpretationBundle.ts'
import {
  buildRouteShapeContract,
  validateDirectionRouteContract,
  type DirectionContractValidationResult,
} from '../src/domain/arc/directionPlanning.ts'
import { buildContractDrivenBuildWaypointPlan } from '../src/domain/waypoint/buildContractDrivenBuildWaypointPlan.ts'
import type { GeneratePlanResult } from '../src/domain/runGeneratePlan.ts'
import type { DirectionPlanningSelection } from '../src/domain/arc/directionPlanning.ts'
import type { ArcCandidate, ScoredVenue } from '../src/domain/types/arc.ts'
import type { Itinerary, ItineraryStop, UserStopRole } from '../src/domain/types/itinerary.ts'
import type {
  FullStopRealityContractOutcome,
  RunPostPlannerCommitParityStagesDependencies,
  StrongCurationTastePassResult,
} from '../src/domain/waypoint/postPlannerCommitParity.ts'

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

type VillageRunSummary = {
  canonicalId?: string
  persona?: string
  locationClass?: string
  providerDiagnosticsSettleState?: string
  staticFallbackUsed?: boolean
  mergedUniqueResultCount?: number
  rolePoolCounts?: {
    start?: number
    highlight?: number
    windDown?: number
  }
  routeAuthority?: {
    selectedArtifactId?: string | null
    selectedArtifactSourceOpportunityId?: string | null
    buildPreGenerationSelectionReady?: boolean
    routeAuthorityStatus?: string | null
    routeAuthorityReasons?: string[]
    lockInputAvailable?: boolean
    generatedContractEntryArtifactPresent?: boolean
    finalRoutePresent?: boolean
    generatedCanonicalRouteHandoffComplete?: boolean
  }
}

type EvergreenRunSummary = {
  canonicalId?: string
  persona?: string
  locationClass?: string
  providerDiagnosticsSettleState?: string
  staticFallbackUsed?: boolean
  generatedFinalRouteStops?: Array<{
    role?: string
    stop?: string
    venueId?: string
  }>
  routeAuthority?: {
    routeAuthorityStatus?: string | null
    routeAuthoritySourceLabel?: string | null
    lockInputAvailable?: boolean
    generatedContractEntryArtifactPresent?: boolean
    finalRoutePresent?: boolean
    generatedCanonicalRouteHandoffComplete?: boolean
  }
}

type StopDiagnostic = {
  role: string
  name: string | null
  venueId: string | null
  category: string | null
  tags: string[]
  vibeTags: string[]
  sourceType: string | null
  providerRecordId: string | null
  neighborhood: string | null
  driveMinutes: number | null
}

type HostedProviderResult = {
  providerRecordId?: string
  displayName?: string
  primaryType?: string
  types?: string[]
  location?: {
    latitude?: number
    longitude?: number
  }
}

type HostedFieldTextSearchRequest = {
  queryLabel?: string
  responseBody?: {
    results?: HostedProviderResult[]
  }
}

type HostedNetworkArtifact = {
  fieldTextSearchRequests?: HostedFieldTextSearchRequest[]
}

type StopCompatibilityDiagnostic = {
  role: string
  name: string
  category: string
  signals: string[]
  lowPressureCompatible: boolean
  hardIncompatibleSignals: string[]
}

type CompatibilityConditionDiagnostic = {
  expectedDirectionIdentity: string
  observedDirectionIdentity: string | null
  selectedContextCompatible: boolean
  rolesComplete: boolean
  hardIncompatibleSignalsPresent: boolean
  hardIncompatibleSignals: string[]
  allCoreStopsLowPressureCompatible: boolean
  stopCompatibility: StopCompatibilityDiagnostic[]
  compatibilityAccepted: boolean
  failedCondition: string | null
}

type ParityValidationDiagnostic = {
  selectedDirectionId: string | null
  selectedDirectionContextId: string | null
  selectedDirectionContractId: string | null
  expectedDirectionIdentity: string | null
  observedDirectionIdentity: string | null
  generationDriftReason: string | null
  fallbackApplied: boolean | null
  contractBuildabilityStatus: string | null
  candidatePoolSufficiencyByRole: Record<string, number> | null
  selectedDirectionContext: Record<string, unknown> | null
  selectedDirectionContract: Record<string, unknown> | null
  generatedRouteBeforeValidation: StopDiagnostic[]
}

type VillageRedOutput = {
  selectedAnchorCanonicalVenueId: 'sj-village-grill'
  persona: 'Friends'
  locationClass: 'L3 Sparse'
  providerSupplyHealthy: boolean
  selectedGenerationInputSourceKind: 'provider_shadow'
  buildContractDrivenBuildWaypointPlanInvoked: boolean
  runGeneratePlanReturned: boolean
  postPlannerCommitParityReached: boolean
  directionValidationThrown: boolean
  thrownMessage: string
  directionCompatibilityAccepted: boolean
  compatibilityRule: string | null
  arbitraryIdentityDriftStillFails: boolean
  selectedContextCompatible: boolean
  rolesComplete: boolean
  hardIncompatibleSignalsPresent: boolean
  hardIncompatibleSignals: string[]
  allCoreStopsLowPressureCompatible: boolean
  stopCompatibility: StopCompatibilityDiagnostic[]
  compatibilityAccepted: boolean
  failedCondition: string | null
  generatedContractEntryArtifactProduced: boolean
  finalRouteProduced: boolean
  runtimeRouteArtifactProduced: boolean
  lockInputAvailable: boolean
  fetchCallCount: number
  selectedDirectionContractFields: Record<string, unknown>
  generatedRouteBeforeValidation: StopDiagnostic[]
  driftComparison: Record<string, unknown>
  evergreenComparison: Record<string, unknown>
  causeClassification: Record<string, string>
}

const VILLAGE_ANCHOR_ID = 'sj-village-grill'
const VILLAGE_DIRECTION_ID = 'easy_hang'
const HOSTED_VILLAGE_ARTIFACT_DIR = 'tmp/phase4-runs/2026-07-05T09-04-08-737Z'
const VILLAGE_PROVIDER_SHADOW_ARTIFACT_ID =
  'verified_build_provider_live_sj-village-grill_1783242257407'
const DRIFT_MESSAGE = 'Route drifted from selected direction contract. Please regenerate.'

const originalFetch = globalThis.fetch
let fetchCallCount = 0

globalThis.fetch = (async () => {
  fetchCallCount += 1
  throw new Error('test-build-village-grill-direction-drift must not call fetch.')
}) as typeof fetch

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

function normalizeSignal(value: string | null | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function uniqueSignals(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map(normalizeSignal).filter(Boolean))]
}

function hostedProviderResultsByLabel(network: HostedNetworkArtifact): Map<string, HostedProviderResult[]> {
  const byLabel = new Map<string, HostedProviderResult[]>()
  for (const request of network.fieldTextSearchRequests ?? []) {
    const label = request.queryLabel
    if (!label) {
      continue
    }
    byLabel.set(label, request.responseBody?.results ?? [])
  }
  return byLabel
}

function deriveHostedSemanticSignals(result: HostedProviderResult): string[] {
  const rawSignals = uniqueSignals([result.primaryType, ...(result.types ?? [])])
  const derived = new Set(rawSignals)
  if (rawSignals.some((signal) => signal.includes('live_music'))) {
    derived.add('live_music')
  }
  if (rawSignals.some((signal) => signal.includes('cocktail'))) {
    derived.add('cocktails')
  }
  if (rawSignals.some((signal) => signal.includes('night_club'))) {
    derived.add('late_night')
  }
  if (rawSignals.some((signal) => signal === 'bar' || signal.includes('bar_and_grill'))) {
    derived.add('social')
  }
  if (rawSignals.some((signal) => signal.includes('restaurant'))) {
    derived.add('restaurant')
  }
  if (rawSignals.some((signal) => signal.includes('cafe') || signal.includes('coffee'))) {
    derived.add('cafe')
    derived.add('tea')
  }
  if (rawSignals.some((signal) => signal.includes('dessert') || signal.includes('ice_cream'))) {
    derived.add('dessert')
  }
  return [...derived]
}

function hostedDirectionCategory(result: HostedProviderResult, fallback: string): string {
  const rawSignals = uniqueSignals([result.primaryType, ...(result.types ?? [])])
  if (rawSignals.some((signal) => signal.includes('restaurant'))) {
    return 'restaurant'
  }
  if (rawSignals.some((signal) => signal.includes('cafe') || signal.includes('coffee'))) {
    return 'cafe'
  }
  return normalizeSignal(result.primaryType) || fallback
}

function pickHostedResult(params: {
  byLabel: Map<string, HostedProviderResult[]>
  label: string
  preferHardIncompatible?: boolean
  excludeHardIncompatible?: boolean
}): HostedProviderResult {
  const results = params.byLabel.get(params.label) ?? []
  assert(results.length > 0, `Expected hosted provider results for ${params.label}.`)
  if (params.preferHardIncompatible) {
    const hardResult = results.find((result) => {
      const signals = deriveHostedSemanticSignals(result)
      return signals.some((signal) =>
        ['activity', 'centerpiece', 'cocktails', 'jazz', 'late_night', 'live', 'live_music', 'museum', 'park'].includes(
          signal,
        ),
      )
    })
    if (hardResult) {
      return hardResult
    }
  }
  if (params.excludeHardIncompatible) {
    const compatibleResult = results.find((result) => {
      const signals = deriveHostedSemanticSignals(result)
      return !signals.some((signal) => HARD_INCOMPATIBLE_SIGNALS.has(signal))
    })
    if (compatibleResult) {
      return compatibleResult
    }
  }
  return results[0]
}

function makeItineraryStop(params: {
  role: UserStopRole
  venueId: string
  venueName: string
  category?: string
  tags?: string[]
  vibeTags?: string[]
  latitude?: number
  longitude?: number
  driveMinutes?: number
}): ItineraryStop {
  return {
    id: `${params.role}:${params.venueId}`,
    role: params.role,
    title:
      params.role === 'start'
        ? 'Start'
        : params.role === 'highlight'
          ? 'Highlight'
          : 'Wind Down',
    venueId: params.venueId,
    venueName: params.venueName,
    formattedAddress: '4075 Evergreen Village Square, San Jose, CA',
    latitude: params.latitude ?? 37.31438909671919,
    longitude: params.longitude ?? -121.77320854504963,
    city: 'San Jose',
    category: params.category ?? 'restaurant',
    tags: params.tags ?? ['provider-backed', 'friends', 'evergreen'],
    vibeTags: params.vibeTags ?? ['relaxed', 'social'],
    neighborhood: 'Evergreen Village',
    driveMinutes: params.driveMinutes ?? 22,
    durationClass: 'medium',
    estimatedDurationMinutes: 45,
    estimatedDurationLabel: '45 min',
    subtitle: 'Provider-backed local test stop',
    imageUrl: '/test.jpg',
    selectedBecause: 'Local no-network provider-backed route diagnostic.',
  } as ItineraryStop
}

function makeScoredVenue(stop: ItineraryStop): ScoredVenue {
  return {
    venue: {
      id: stop.venueId,
      name: stop.venueName,
      category: stop.category ?? 'restaurant',
      city: 'San Jose',
      neighborhood: stop.neighborhood ?? 'Evergreen Village',
      priceTier: '$$',
      tags: stop.tags ?? [],
      vibeTags: stop.vibeTags ?? [],
      driveMinutes: stop.driveMinutes ?? 22,
      durationProfile: {
        durationClass: stop.durationClass ?? 'medium',
        estimatedMinutes: stop.estimatedDurationMinutes ?? 45,
      },
      source: {
        sourceKind: 'provider',
        sourceOrigin: 'google_places',
        provider: 'google_places',
        providerRecordId: `provider:${stop.venueId}`,
        formattedAddress: stop.formattedAddress,
        latitude: stop.latitude,
        longitude: stop.longitude,
      },
      shortDescription: stop.subtitle ?? '',
      imageUrl: stop.imageUrl,
    },
    score: 0.8,
    reasons: ['local no-network Village Grill direction drift diagnostic'],
    roleScores: {
      start: stop.role === 'start' ? 0.9 : 0.55,
      highlight: stop.role === 'highlight' ? 0.9 : 0.55,
      windDown: stop.role === 'windDown' ? 0.9 : 0.55,
    },
  } as unknown as ScoredVenue
}

function summarizeStop(stop: ItineraryStop): StopDiagnostic {
  return {
    role: stop.role,
    name: stop.venueName ?? null,
    venueId: stop.venueId ?? null,
    category: stop.category ?? null,
    tags: stop.tags ?? [],
    vibeTags: stop.vibeTags ?? [],
    sourceType: 'provider_backed_local_fixture',
    providerRecordId: stop.venueId ? `provider:${stop.venueId}` : null,
    neighborhood: stop.neighborhood ?? null,
    driveMinutes: stop.driveMinutes ?? null,
  }
}

function makeArcCandidate(stops: ItineraryStop[]): ArcCandidate {
  return {
    id: 'arc_provider_shadow_village_grill_direction_drift',
    stops: stops.map((stop) => ({
      role:
        stop.role === 'start'
          ? 'warmup'
          : stop.role === 'highlight'
            ? 'peak'
            : 'cooldown',
      scoredVenue: makeScoredVenue(stop),
    })),
    score: 0.8,
    totalScore: 0.8,
    diagnostics: {
      reason: 'local no-network Village Grill direction drift diagnostic',
    },
  } as unknown as ArcCandidate
}

function buildHostedLikeGeneratePlanResult(network: HostedNetworkArtifact): GeneratePlanResult {
  const byLabel = hostedProviderResultsByLabel(network)
  const hostedStart = pickHostedResult({
    byLabel,
    label: 'build-provider-highlight',
    excludeHardIncompatible: true,
  })
  const hostedHighlight = pickHostedResult({
    byLabel,
    label: 'build-provider-start',
  })
  const hostedWindDown = pickHostedResult({
    byLabel,
    label: 'build-provider-winddown',
  })
  const hostedStartSignals = deriveHostedSemanticSignals(hostedStart)
  const hostedHighlightSignals = deriveHostedSemanticSignals(hostedHighlight)
  const hostedWindDownSignals = deriveHostedSemanticSignals(hostedWindDown)
  const stops = [
    makeItineraryStop({
      role: 'start',
      venueId: `provider:${hostedStart.providerRecordId ?? 'hosted-start'}`,
      venueName: hostedStart.displayName ?? 'Hosted Start',
      category: hostedDirectionCategory(hostedStart, 'bar'),
      tags: ['provider-backed', 'friends', 'hosted-replay', ...hostedStartSignals],
      vibeTags: ['social'],
      latitude: hostedStart.location?.latitude,
      longitude: hostedStart.location?.longitude,
      driveMinutes: 20,
    }),
    makeItineraryStop({
      role: 'highlight',
      venueId: VILLAGE_ANCHOR_ID,
      venueName: hostedHighlight.displayName ?? 'Village Grill',
      category: hostedDirectionCategory(hostedHighlight, 'restaurant'),
      tags: ['provider-backed', 'friends', 'hosted-replay', ...hostedHighlightSignals],
      vibeTags: ['relaxed'],
      latitude: hostedHighlight.location?.latitude,
      longitude: hostedHighlight.location?.longitude,
      driveMinutes: 22,
    }),
    makeItineraryStop({
      role: 'windDown',
      venueId: `provider:${hostedWindDown.providerRecordId ?? 'hosted-wind-down'}`,
      venueName: hostedWindDown.displayName ?? 'Hosted Wind Down',
      category: hostedDirectionCategory(hostedWindDown, 'cafe'),
      tags: ['provider-backed', 'friends', 'hosted-replay', ...hostedWindDownSignals],
      vibeTags: ['relaxed'],
      latitude: hostedWindDown.location?.latitude,
      longitude: hostedWindDown.location?.longitude,
      driveMinutes: 21,
    }),
  ]
  const itinerary: Itinerary = {
    id: 'itinerary_provider_shadow_village_grill_direction_drift',
    title: 'Village Grill Friends Route',
    summary: 'Hosted-like provider-backed Village Grill route that drifts from the selected easy hang contract.',
    city: 'San Jose',
    neighborhood: 'Evergreen Village',
    shareSummary: stops.map((stop) => stop.venueName).join(' to '),
    estimatedTotalLabel: 'About 2 hours',
    story: {
      subtitle: 'Hosted-like friends route around Village Grill.',
    },
    storySpine: {
      title: 'Village Grill Friends Route',
      routeSummary: stops.map((stop) => stop.venueName).join(' to '),
    },
    stops,
  } as Itinerary
  const selectedArc = makeArcCandidate(stops)
  const scoredVenues = stops.map(makeScoredVenue)

  return {
    itinerary,
    selectedArc,
    scoredVenues,
    intentProfile: {
      crew: 'socialite',
      mode: 'build',
      persona: 'friends',
      personaSource: 'explicit',
      primaryAnchor: 'cozy',
      city: 'San Jose',
      district: 'Evergreen Village',
      distanceMode: 'nearby',
      prefersHiddenGems: false,
      planningMode: 'user-led',
      anchor: {
        venueId: VILLAGE_ANCHOR_ID,
        role: 'highlight',
      },
      selectedDirectionContext: {
        directionId: VILLAGE_DIRECTION_ID,
        selectedDirectionId: VILLAGE_DIRECTION_ID,
        pocketId: 'evergreen',
        selectedPocketId: 'evergreen',
        label: 'Easy hang night',
        archetype: 'friends_cozy',
        identity: 'easy_hang',
        cluster: 'chill',
      },
    },
    lens: {
      tone: 'cozy',
      discoveryBias: 'balanced',
      movementTolerance: 'nearby',
    },
    trace: {
      intent: {
        mode: 'build',
      },
      lens: {
        tone: 'cozy',
        discoveryBias: 'balanced',
        movementTolerance: 'nearby',
      },
      rankingEngine: 'local-no-network',
      selectedArcId: selectedArc.id,
      selectedDistrictId: 'evergreen',
      selectedDistrictLabel: 'Evergreen Village',
      selectedDistrictReason: 'Local no-network Village Grill direction compatibility diagnostic.',
      stopExplainability: {
        highlight: {
          selectedBecause: 'Village Grill is the selected Build anchor.',
        },
      },
      retrievalDiagnostics: {
        liveSource: {
          requestedMode: 'hybrid',
          effectiveMode: 'hybrid',
          provider: 'google_places',
          debugOverrideApplied: false,
          fallbackToCurated: false,
          liveFetchAttempted: false,
          liveFetchSucceeded: false,
          queryCount: 0,
          labelsConsidered: 0,
          labelsAdmitted: 0,
          centersConsidered: 0,
          centersAdmitted: 0,
          dispatchQueriesPlanned: 0,
          dispatchQueriesAttempted: 0,
          dispatchQueriesPlannedWithinCap: true,
          liveQueryTemplatesUsed: [],
          liveQueryLabelsUsed: [],
          liveCandidatesByQuery: [],
          liveRoleIntentQueryNotes: [],
          fetchedCount: 0,
          mappedCount: 0,
          normalizedCount: 0,
          approvedCount: 0,
          demotedCount: 0,
          suppressedCount: 0,
          liveHoursDemotedCount: 0,
          liveHoursSuppressedCount: 0,
          partialFailure: false,
          errors: [],
          countsBySource: { curated: 3, live: 0, bootstrap: 0 },
        },
      },
    },
  } as unknown as GeneratePlanResult
}

function buildIncompatibleEasyHangRoute(): Itinerary {
  const stops = [
    makeItineraryStop({
      role: 'start',
      venueId: 'provider-gallery-start',
      venueName: 'Gallery Start',
      category: 'museum',
    }),
    makeItineraryStop({
      role: 'highlight',
      venueId: 'provider-park-highlight',
      venueName: 'Park Highlight',
      category: 'park',
    }),
    makeItineraryStop({
      role: 'windDown',
      venueId: 'provider-live-music-wind-down',
      venueName: 'Live Music Wind Down',
      category: 'live_music',
    }),
  ]
  return {
    id: 'itinerary_incompatible_easy_hang_drift',
    title: 'Incompatible Easy Hang Drift Route',
    summary: 'Exploratory and late-night signals should not be accepted as easy hang.',
    stops,
  } as Itinerary
}

const HARD_INCOMPATIBLE_SIGNALS = new Set([
  'activity',
  'centerpiece',
  'cocktails',
  'jazz',
  'late_night',
  'live',
  'live_music',
  'museum',
  'park',
])

const LOW_PRESSURE_SIGNALS = new Set([
  'bakery',
  'cafe',
  'casual_american',
  'casual-american',
  'dessert',
  'friends',
  'group_friendly',
  'group-friendly',
  'neighborhood',
  'provider_backed',
  'provider-backed',
  'relaxed',
  'restaurant',
  'tea',
])

function stopSignals(stop: StopDiagnostic): string[] {
  return uniqueSignals([stop.category, ...stop.tags, ...stop.vibeTags])
}

function evaluateEasyHangIntimateCompatibility(params: {
  selectedDirectionContext: {
    directionId?: string
    selectedDirectionId?: string
    label?: string
    archetype?: string
    identity?: string
  }
  expectedDirectionIdentity: string
  observedDirectionIdentity: string | null
  stops: StopDiagnostic[]
}): CompatibilityConditionDiagnostic {
  const contextSignals = uniqueSignals([
    params.selectedDirectionContext.directionId,
    params.selectedDirectionContext.selectedDirectionId,
    params.selectedDirectionContext.label,
    params.selectedDirectionContext.archetype,
    params.selectedDirectionContext.identity,
  ])
  const selectedContextCompatible =
    contextSignals.includes('easy_hang') ||
    contextSignals.includes('friends_cozy') ||
    contextSignals.includes('easy_hang_night')
  const coreStops = {
    start: params.stops.find((stop) => stop.role === 'start'),
    highlight: params.stops.find((stop) => stop.role === 'highlight'),
    windDown: params.stops.find((stop) => stop.role === 'windDown'),
  }
  const rolesComplete = Boolean(coreStops.start && coreStops.highlight && coreStops.windDown)
  const stopCompatibility = [coreStops.start, coreStops.highlight, coreStops.windDown]
    .filter((stop): stop is StopDiagnostic => Boolean(stop))
    .map((stop) => {
      const signals = stopSignals(stop)
      const hardIncompatibleSignals = signals.filter((signal) => HARD_INCOMPATIBLE_SIGNALS.has(signal))
      return {
        role: stop.role,
        name: stop.name ?? 'unknown',
        category: stop.category ?? 'unknown',
        signals,
        lowPressureCompatible: signals.some((signal) => LOW_PRESSURE_SIGNALS.has(signal)),
        hardIncompatibleSignals,
      }
    })
  const hardIncompatibleSignals = [
    ...new Set(stopCompatibility.flatMap((stop) => stop.hardIncompatibleSignals)),
  ]
  const hardIncompatibleSignalsPresent = hardIncompatibleSignals.length > 0
  const allCoreStopsLowPressureCompatible =
    rolesComplete && stopCompatibility.every((stop) => stop.lowPressureCompatible)
  let failedCondition: string | null = null
  if (params.expectedDirectionIdentity !== 'easy_hang') {
    failedCondition = 'expected_identity_not_easy_hang'
  } else if (params.observedDirectionIdentity !== 'intimate') {
    failedCondition = 'observed_identity_not_intimate'
  } else if (!selectedContextCompatible) {
    failedCondition = 'selected_context_not_easy_hang'
  } else if (!rolesComplete) {
    failedCondition = 'missing_core_role'
  } else if (hardIncompatibleSignalsPresent) {
    failedCondition = 'hard_incompatible_easy_hang_signal'
  } else if (!allCoreStopsLowPressureCompatible) {
    failedCondition = 'missing_low_pressure_easy_hang_signal'
  }

  return {
    expectedDirectionIdentity: params.expectedDirectionIdentity,
    observedDirectionIdentity: params.observedDirectionIdentity,
    selectedContextCompatible,
    rolesComplete,
    hardIncompatibleSignalsPresent,
    hardIncompatibleSignals,
    allCoreStopsLowPressureCompatible,
    stopCompatibility,
    compatibilityAccepted: failedCondition === null,
    failedCondition,
  }
}

function buildLocalPostPlannerDependencies(params: {
  onPostPlannerCommitParityReached: () => void
  onDirectionValidation: (diagnostic: ParityValidationDiagnostic) => void
}): RunPostPlannerCommitParityStagesDependencies {
  const strongPass = (input: {
    itinerary: Itinerary
    selectedArc: ArcCandidate
    scoredVenues: ScoredVenue[]
  }): StrongCurationTastePassResult => ({
    selectedArc: input.selectedArc,
    itinerary: input.itinerary,
    scoredVenues: input.scoredVenues,
    qualificationByCandidateId: {},
    personaVibeTasteBiasSummary: 'local Village Grill direction drift diagnostic',
    thinPoolHighlightFallbackApplied: false,
    highlightPoolCountBefore: input.scoredVenues.length,
    highlightPoolCountAfter: input.scoredVenues.length,
    rolePoolCountByRoleBefore: { start: 1, highlight: 1, windDown: 1 },
    rolePoolCountByRoleAfter: { start: 1, highlight: 1, windDown: 1 },
    signatureHighlightShortlistCount: 1,
    signatureHighlightShortlistIds: [VILLAGE_ANCHOR_ID],
    highlightShortlistScoreSummary: 'local Village Grill direction drift diagnostic',
    selectedHighlightFromShortlist: true,
    selectedHighlightShortlistRank: 1,
    fallbackToQualifiedHighlightPool: false,
    upstreamPoolSelectionApplied: true,
    postGenerationRepairCount: 0,
    rolePoolVenueIdsByRole: {
      start: input.itinerary.stops
        .filter((stop) => stop.role === 'start')
        .map((stop) => stop.venueId),
      highlight: input.itinerary.stops
        .filter((stop) => stop.role === 'highlight')
        .map((stop) => stop.venueId),
      windDown: input.itinerary.stops
        .filter((stop) => stop.role === 'windDown')
        .map((stop) => stop.venueId),
    },
    rolePoolVenueIdsCombined: input.itinerary.stops.map((stop) => stop.venueId),
    thinPoolRelaxationTrace: {
      triggered: false,
      baseQualifiedHighlightCount: 1,
      baseHighlightFloor: 0.5,
      relaxedHighlightFloor: 0.5,
      triggerReason: 'none',
      relaxedRule: 'none',
      effectSummary: 'not applied',
    },
  })

  return {
    buildPassthroughStrongCurationTastePass: strongPass,
    applyStrongCurationTastePass: (input) => strongPass(input),
    enforceFullStopRealityContract: async (input) =>
      ({
        selectedArc: input.selectedArc,
        itinerary: input.itinerary,
        canonicalStopByRole: Object.fromEntries(
          input.itinerary.stops.map((stop) => [
            stop.role,
            {
              displayName: stop.venueName,
              providerRecordId: `provider:${stop.venueId}`,
              latitude: stop.latitude ?? 37.31438909671919,
              longitude: stop.longitude ?? -121.77320854504963,
              addressLine: stop.formattedAddress ?? '4075 Evergreen Village Square, San Jose, CA',
              city: stop.city ?? 'San Jose',
              neighborhood: stop.neighborhood ?? 'Evergreen Village',
            },
          ]),
        ),
        rejectedStopRoles: [],
      }) satisfies FullStopRealityContractOutcome,
    applyCanonicalIdentityToItinerary: (itinerary) => itinerary,
    assessDirectionContractBuildability: () =>
      ({
        contractBuildabilityStatus: 'strong',
        candidatePoolSufficiencyByRole: { start: 1, highlight: 1, windDown: 1 },
        missingRoleForContract: null,
      }) as ReturnType<RunPostPlannerCommitParityStagesDependencies['assessDirectionContractBuildability']>,
    validateDirectionRouteContract: (input) => {
      params.onPostPlannerCommitParityReached()
      const result = validateDirectionRouteContract(input)
      params.onDirectionValidation({
        selectedDirectionId: input.selectedDirectionContext?.directionId ?? null,
        selectedDirectionContextId: input.selectedDirectionContext?.selectedDirectionId ?? null,
        selectedDirectionContractId: null,
        expectedDirectionIdentity: result.expectedDirectionIdentity,
        observedDirectionIdentity: result.observedDirectionIdentity,
        generationDriftReason: result.generationDriftReason,
        fallbackApplied: result.fallbackApplied,
        contractBuildabilityStatus: result.contractBuildabilityStatus,
        candidatePoolSufficiencyByRole: result.candidatePoolSufficiencyByRole,
        selectedDirectionContext: input.selectedDirectionContext
          ? { ...input.selectedDirectionContext }
          : null,
        selectedDirectionContract: input.selectedDirection ? { ...input.selectedDirection } : null,
        generatedRouteBeforeValidation: input.itinerary.stops.map(summarizeStop),
      })
      return result
    },
    resolveRouteCopy: ({ canonicalItinerary }) => ({
      routeHeadline: 'Village Grill Friends Route',
      routeSummary: canonicalItinerary.stops.map((stop) => stop.venueName).join(' to '),
    }),
  }
}

async function main(): Promise<void> {
  const sandboxSource = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')
  const waypointSource = readFileSync('src/domain/waypoint/buildContractDrivenBuildWaypointPlan.ts', 'utf8')
  const paritySource = readFileSync('src/domain/waypoint/postPlannerCommitParity.ts', 'utf8')
  const directionPlanningSource = readFileSync('src/domain/arc/directionPlanning.ts', 'utf8')
  const rolePoolSource = readFileSync('src/domain/arc/buildRolePools.ts', 'utf8')
  const runSummary = readJson<VillageRunSummary>(
    `${HOSTED_VILLAGE_ARTIFACT_DIR}/run-summary.json`,
  )
  const hostedNetwork = readJson<HostedNetworkArtifact>(
    `${HOSTED_VILLAGE_ARTIFACT_DIR}/network.json`,
  )
  const evergreenSummary = readJson<EvergreenRunSummary>(
    'tmp/phase4-runs/2026-07-04T20-42-53-291Z/run-summary.json',
  )

  const providerGenerationCandidateBlock = sourceSlice(
    sandboxSource,
    'const buildProviderGenerationCandidateArtifact = useMemo(() => {',
    'const buildGenerationInputCandidateArtifacts = useMemo(',
  )
  const generationInputCandidateBlock = sourceSlice(
    sandboxSource,
    'const buildGenerationInputCandidateArtifacts = useMemo(',
    'const curateDisplayArtifactsBeforeDedupe = useMemo',
  )
  const validateDirectionRouteContractBlock = sourceSlice(
    directionPlanningSource,
    'export function validateDirectionRouteContract(params:',
    'if (params.mode === \'surprise\' && selectedDirectionContext) {',
  )
  assert(
    providerGenerationCandidateBlock.includes('shadowBuildProviderArtifact') &&
      providerGenerationCandidateBlock.includes('enrichContractEntryArtifactWithDirectionBacking'),
    'Expected provider-backed generation candidate creation to use the shadow provider artifact.',
  )
  assert(
    sandboxSource.includes("selectedBuildCandidateSourceKind =") &&
      sandboxSource.includes("? 'provider_shadow'") &&
      sandboxSource.includes(": 'build_static_pre_generation'"),
    'Expected selected Build candidate source kind to tag provider-backed input as provider_shadow.',
  )
  assert(
    generationInputCandidateBlock.includes('buildProviderGenerationCandidateArtifact'),
    'Expected provider-backed generation candidate to be admitted as Build generation input.',
  )
  assert(
    waypointSource.includes('(input.runPlanBuild ?? runGeneratePlan)') &&
      waypointSource.includes('runPostPlannerCommitParityStages') &&
      waypointSource.includes('buildContractEntryArtifactFromGeneration'),
    'Expected buildContractDrivenBuildWaypointPlan to route through generation, parity, and generated artifact creation.',
  )
  assert(
    paritySource.includes('Route drifted from selected direction contract. Please regenerate.') &&
      paritySource.includes('if (!directionValidation.valid)'),
    'Expected post-planner parity to throw the selected direction drift message before final route creation.',
  )
  assert(
    rolePoolSource.includes('isBuildFriendsEasyHangContext') &&
      rolePoolSource.includes('isEasyHangHardIncompatibleCandidate') &&
      rolePoolSource.includes('excluded hard-incompatible easy-hang signals before arc assembly'),
    'Expected Build Friends easy-hang hard-signal exclusion to run before arc assembly.',
  )

  const providerSupplyHealthy =
    runSummary.canonicalId === VILLAGE_ANCHOR_ID &&
    runSummary.providerDiagnosticsSettleState === 'settled_with_results' &&
    runSummary.staticFallbackUsed === false &&
    (runSummary.mergedUniqueResultCount ?? 0) > 0
  const providerShadowCandidateSelected = Boolean(
    runSummary.routeAuthority?.selectedArtifactId?.includes(VILLAGE_ANCHOR_ID),
  )
  const selectedGenerationInputArtifactId =
    runSummary.routeAuthority?.selectedArtifactId ?? VILLAGE_PROVIDER_SHADOW_ARTIFACT_ID
  assert(providerSupplyHealthy, 'Expected hosted Village artifact to show healthy provider supply.')
  assert(providerShadowCandidateSelected, 'Expected hosted Village artifact to select provider-backed candidate.')
  assert(
    (hostedNetwork.fieldTextSearchRequests ?? []).length === 3,
    'Expected latest hosted Village artifact to include all three provider response bodies.',
  )

  const selectedDirectionContract: DirectionPlanningSelection = {
    id: VILLAGE_DIRECTION_ID,
    label: 'Easy hang night',
    subtitle: 'Low-pressure hang with smooth transitions.',
    pocketId: 'evergreen',
    pocketLabel: 'Evergreen Village',
    archetype: 'friends_cozy',
    cluster: 'chill',
    identity: 'easy_hang' as DirectionPlanningSelection['identity'],
    experienceFamily: 'social',
    familyConfidence: 0.86,
  }
  const selectedDirectionContext = {
    selectedDirectionId: VILLAGE_DIRECTION_ID,
    selectedPocketId: 'evergreen',
    directionId: VILLAGE_DIRECTION_ID,
    pocketId: 'evergreen',
    label: 'Easy hang night',
    archetype: 'friends_cozy',
    identity: 'easy_hang' as DirectionPlanningSelection['identity'],
    cluster: 'chill' as const,
  }
  const conciergeIntent = buildApplicationConciergeIntent({
    mode: 'build',
    persona: 'friends',
    primaryVibe: 'cozy',
    city: 'San Jose',
    objectiveOccasion: 'connect',
    anchor: {
      venueId: VILLAGE_ANCHOR_ID,
      role: 'highlight',
    },
    anchorDisplayName: 'Village Grill',
    candidateLineage: {
      source: 'selected_candidate_route_artifact',
      candidateArtifactId: selectedGenerationInputArtifactId,
      directionId: VILLAGE_DIRECTION_ID,
      pocketId: 'evergreen',
      sourceOpportunityId: selectedGenerationInputArtifactId,
      anchorVenueId: VILLAGE_ANCHOR_ID,
      anchorRole: 'highlight',
      lineageSummary: 'Provider-backed Village Grill generation input',
    },
  })
  const canonicalInterpretationBundle = buildCanonicalInterpretationBundle({
    conciergeIntent,
    selectedDirectionContext,
    interpretationSource: 'scripts.test-build-village-grill-direction-drift',
  })
  const routeShapeContract = buildRouteShapeContract({
    selectedDirection: selectedDirectionContract,
    selectedDirectionContext,
    conciergeIntent,
    contractConstraints: canonicalInterpretationBundle.contractConstraints,
  })
  const anchorTruthContract = buildAnchorTruthContract({
    identity: {
      venueId: VILLAGE_ANCHOR_ID,
      providerRecordId: 'provider:sj-village-grill',
      displayName: 'Village Grill',
      latitude: 37.31438909671919,
      longitude: -121.77320854504963,
    },
    role: {
      role: 'highlight',
      roleResolutionSource: 'explicit',
    },
  })

  let buildContractDrivenBuildWaypointPlanInvoked = false
  let runGeneratePlanReturned = false
  let postPlannerCommitParityReached = false
  let thrownMessage = ''
  let generatedContractEntryArtifactProduced = false
  let finalRouteProduced = false
  let runtimeRouteArtifactProduced = false
  let parityValidationDiagnostic: ParityValidationDiagnostic | null = null

  buildContractDrivenBuildWaypointPlanInvoked = true
  const waypointPlan = await buildContractDrivenBuildWaypointPlan({
    conciergeIntent,
    canonicalInterpretationBundle,
    mode: 'build',
    city: 'San Jose',
    district: 'Evergreen Village',
    distanceMode: 'nearby',
    selectedDirectionContext,
    selectedDirectionContextForValidation: selectedDirectionContext,
    selectedDirectionContract,
    selectedDirectionContractForValidation: selectedDirectionContract,
    selectedDirectionId: VILLAGE_DIRECTION_ID,
    selectedDirectionPreviewScenarioFamily: 'friends_cozy',
    expectedDirectionIdentity: selectedDirectionContract.identity,
    discoveryPreferences: [
      {
        venueId: VILLAGE_ANCHOR_ID,
        role: 'highlight',
      },
    ],
    anchor: {
      venueId: VILLAGE_ANCHOR_ID,
      role: 'highlight',
    },
    selectedArtifactLineage: {
      artifactId: selectedGenerationInputArtifactId,
      sourceOpportunityId: selectedGenerationInputArtifactId,
      sourceMode: 'build_provider_live',
      anchorVenueId: VILLAGE_ANCHOR_ID,
      anchorRole: 'highlight',
      directionId: VILLAGE_DIRECTION_ID,
      pocketId: 'evergreen',
    },
    sourceMode: 'curated',
    sourceModeOverrideApplied: true,
    persona: 'friends',
    vibe: 'cozy',
    requiredBuildAnchor: {
      role: 'highlight',
      venueId: VILLAGE_ANCHOR_ID,
    },
    buildAnchorTruthContract: anchorTruthContract,
    postPlannerDependencies: buildLocalPostPlannerDependencies({
      onPostPlannerCommitParityReached: () => {
        postPlannerCommitParityReached = true
      },
      onDirectionValidation: (diagnostic) => {
        parityValidationDiagnostic = {
          ...diagnostic,
          selectedDirectionContractId: selectedDirectionContract.id,
        }
      },
    }),
    runPlanBuild: async () => {
      const result = buildHostedLikeGeneratePlanResult(hostedNetwork)
      runGeneratePlanReturned = true
      return result
    },
  }).catch((error: unknown) => {
    thrownMessage = error instanceof Error ? error.message : String(error)
    return null
  })

  generatedContractEntryArtifactProduced = Boolean(waypointPlan?.postParityContractEntryArtifact)
  finalRouteProduced = Boolean(waypointPlan?.nextFinalRoute)
  runtimeRouteArtifactProduced = finalRouteProduced
  const generatedAuthoritySnapshot = buildRouteAuthoritySnapshot({
    contractEntryArtifact: waypointPlan?.postParityContractEntryArtifact ?? null,
    runtimeRouteArtifact: waypointPlan?.nextFinalRoute ?? null,
    selectedDirectionId: VILLAGE_DIRECTION_ID,
    selectedArtifactId: waypointPlan?.postParityContractEntryArtifact?.id ?? null,
    selectedClusterConfirmation: 'Generated Village Grill route is ready for Review.',
    itinerary: waypointPlan?.canonicalItinerary,
    buildContext: {
      mode: 'build',
      selectedCandidateArtifact: null,
      selectedCandidateSourceKind: null,
      selectedAnchorVenueId: VILLAGE_ANCHOR_ID,
      selectedAnchorRequiredRole: 'highlight',
      routeReplacementAdmitted: false,
    },
  })
  const generatedLockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot: generatedAuthoritySnapshot,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  const generatedRouteBeforeValidation =
    parityValidationDiagnostic?.generatedRouteBeforeValidation ?? []
  const compatibilityDiagnostic = evaluateEasyHangIntimateCompatibility({
    selectedDirectionContext,
    expectedDirectionIdentity: parityValidationDiagnostic?.expectedDirectionIdentity ?? VILLAGE_DIRECTION_ID,
    observedDirectionIdentity: parityValidationDiagnostic?.observedDirectionIdentity ?? null,
    stops: generatedRouteBeforeValidation,
  })
  const routeContainsSelectedAnchorInRequiredRole = generatedRouteBeforeValidation.some(
    (stop) => stop.role === 'highlight' && stop.venueId === VILLAGE_ANCHOR_ID,
  )
  const selectedDirectionIdMismatch =
    parityValidationDiagnostic?.selectedDirectionId !== VILLAGE_DIRECTION_ID ||
    parityValidationDiagnostic?.selectedDirectionContextId !== VILLAGE_DIRECTION_ID
  const directionIdentityMismatch =
    parityValidationDiagnostic?.expectedDirectionIdentity !==
    parityValidationDiagnostic?.observedDirectionIdentity
  const sourceOrProvenanceCheckedByValidator =
    validateDirectionRouteContractBlock.includes('sourceKind') ||
    validateDirectionRouteContractBlock.includes('provider_shadow')
  const incompatibleValidation = validateDirectionRouteContract({
    selectedDirectionContext,
    selectedDirection: selectedDirectionContract,
    itinerary: buildIncompatibleEasyHangRoute(),
    buildability: {
      contractBuildabilityStatus: 'strong',
      candidatePoolSufficiencyByRole: { start: 1, highlight: 1, windDown: 1 },
      missingRoleForContract: null,
    },
    mode: 'build',
    previewScenarioFamily: 'friends_cozy',
  })
  const arbitraryIdentityDriftStillFails = incompatibleValidation.valid === false

  const output: VillageRedOutput = {
    selectedAnchorCanonicalVenueId: VILLAGE_ANCHOR_ID,
    persona: 'Friends',
    locationClass: 'L3 Sparse',
    providerSupplyHealthy,
    selectedGenerationInputSourceKind: 'provider_shadow',
    buildContractDrivenBuildWaypointPlanInvoked,
    runGeneratePlanReturned,
    postPlannerCommitParityReached,
    directionValidationThrown: thrownMessage === DRIFT_MESSAGE,
    thrownMessage,
    directionCompatibilityAccepted:
      parityValidationDiagnostic?.generationDriftReason ===
        'easy_hang_intimate_semantic_compatibility' &&
      parityValidationDiagnostic.fallbackApplied === true,
    compatibilityRule:
      parityValidationDiagnostic?.generationDriftReason ===
      'easy_hang_intimate_semantic_compatibility'
        ? 'build_easy_hang_accepts_intimate_identity_when_complete_low_pressure_friends_shape_survives'
        : null,
    arbitraryIdentityDriftStillFails,
    selectedContextCompatible: compatibilityDiagnostic.selectedContextCompatible,
    rolesComplete: compatibilityDiagnostic.rolesComplete,
    hardIncompatibleSignalsPresent: compatibilityDiagnostic.hardIncompatibleSignalsPresent,
    hardIncompatibleSignals: compatibilityDiagnostic.hardIncompatibleSignals,
    allCoreStopsLowPressureCompatible:
      compatibilityDiagnostic.allCoreStopsLowPressureCompatible,
    stopCompatibility: compatibilityDiagnostic.stopCompatibility,
    compatibilityAccepted: compatibilityDiagnostic.compatibilityAccepted,
    failedCondition: compatibilityDiagnostic.failedCondition,
    generatedContractEntryArtifactProduced,
    finalRouteProduced,
    runtimeRouteArtifactProduced,
    lockInputAvailable: generatedLockInput.ok,
    fetchCallCount,
    selectedDirectionContractFields: {
      selectedDirectionId: VILLAGE_DIRECTION_ID,
      selectedDirectionContractId: selectedDirectionContract.id,
      intentMode: conciergeIntent.intentMode,
      persona: conciergeIntent.experienceProfile.persona,
      selectedDirectionLabel: selectedDirectionContract.label,
      selectedDirectionArchetype: selectedDirectionContract.archetype,
      selectedDirectionCluster: selectedDirectionContract.cluster,
      selectedDirectionIdentity: selectedDirectionContract.identity,
      selectedDirectionExperienceFamily: selectedDirectionContract.experienceFamily,
      primaryVibe: conciergeIntent.experienceProfile.primaryVibe,
      objectiveOccasion: conciergeIntent.objective.occasion,
      anchorVenueId: conciergeIntent.anchorPosture.anchorValue,
      anchorRoleHint: conciergeIntent.anchorPosture.roleHint,
      locationCity: 'San Jose',
      selectedPocketId: selectedDirectionContract.pocketId,
      selectedPocketLabel: selectedDirectionContract.pocketLabel,
      routeShape: {
        id: routeShapeContract.id,
        arcShape: routeShapeContract.arcShape,
        roleProfile: routeShapeContract.roleProfile,
        roleInvariants: routeShapeContract.roleInvariants,
        movementProfile: routeShapeContract.movementProfile,
        mutationProfile: routeShapeContract.mutationProfile,
        expansionProfile: routeShapeContract.expansionProfile,
      },
      contractConstraints: {
        id: canonicalInterpretationBundle.contractConstraints.id,
        peakCountModel: canonicalInterpretationBundle.contractConstraints.peakCountModel,
        movementTolerance: canonicalInterpretationBundle.contractConstraints.movementTolerance,
        requireContinuity: canonicalInterpretationBundle.contractConstraints.requireContinuity,
        windDownStrictness: canonicalInterpretationBundle.contractConstraints.windDownStrictness,
      },
    },
    generatedRouteBeforeValidation,
    driftComparison: {
      selectedDirectionIdMismatch,
      contractIdMismatch: false,
      personaMismatch: false,
      vibeMismatch: false,
      roleProfileMismatch: 'not_checked_by_post_planner_direction_validator',
      venueFamilyMismatch: directionIdentityMismatch,
      movementShapeMismatch: 'not_checked_before_identity_rejection',
      sourceProvenanceMismatch: sourceOrProvenanceCheckedByValidator,
      anchorRoleMismatch: !routeContainsSelectedAnchorInRequiredRole,
      anchorIdentityMismatch: !generatedRouteBeforeValidation.some(
        (stop) => stop.venueId === VILLAGE_ANCHOR_ID,
      ),
      staleSelectedDirectionContext: selectedDirectionIdMismatch,
      missingMetadata: generatedRouteBeforeValidation.some((stop) => !stop.category),
      failedComparison: {
        field: 'direction_identity',
        expected: parityValidationDiagnostic?.expectedDirectionIdentity ?? null,
        observed: parityValidationDiagnostic?.observedDirectionIdentity ?? null,
        generationDriftReason: parityValidationDiagnostic?.generationDriftReason ?? null,
        fallbackApplied: parityValidationDiagnostic?.fallbackApplied ?? null,
        contractBuildabilityStatus:
          parityValidationDiagnostic?.contractBuildabilityStatus ?? null,
        candidatePoolSufficiencyByRole:
          parityValidationDiagnostic?.candidatePoolSufficiencyByRole ?? null,
      },
    },
    evergreenComparison: {
      artifact: 'tmp/phase4-runs/2026-07-04T20-42-53-291Z',
      canonicalId: evergreenSummary.canonicalId,
      persona: evergreenSummary.persona,
      locationClass: evergreenSummary.locationClass,
      providerSupplyHealthy:
        evergreenSummary.providerDiagnosticsSettleState === 'settled_with_results' &&
        evergreenSummary.staticFallbackUsed === false,
      generatedContractEntryArtifactPresent:
        evergreenSummary.routeAuthority?.generatedContractEntryArtifactPresent ?? false,
      finalRoutePresent: evergreenSummary.routeAuthority?.finalRoutePresent ?? false,
      generatedCanonicalRouteHandoffComplete:
        evergreenSummary.routeAuthority?.generatedCanonicalRouteHandoffComplete ?? false,
      routeAuthorityStatus: evergreenSummary.routeAuthority?.routeAuthorityStatus ?? null,
      routeAuthoritySourceLabel: evergreenSummary.routeAuthority?.routeAuthoritySourceLabel ?? null,
      lockInputAvailable: evergreenSummary.routeAuthority?.lockInputAvailable ?? false,
      generatedRouteStops: evergreenSummary.generatedFinalRouteStops ?? [],
      whyEvergreenPasses:
        'Evergreen reaches generated runtime authority and lock input; Village stops at post-planner direction identity validation before finalRoute/artifact creation.',
    },
    causeClassification: {
      A:
        compatibilityDiagnostic.hardIncompatibleSignalsPresent
          ? `supported: hosted-like replay contains hard-incompatible signals (${compatibilityDiagnostic.hardIncompatibleSignals.join(',')})`
          : 'not_supported',
      B:
        !compatibilityDiagnostic.allCoreStopsLowPressureCompatible
          ? 'supported: one or more core stops lack low-pressure/easy-hang-compatible signals'
          : 'not_supported',
      C: compatibilityDiagnostic.selectedContextCompatible
        ? 'not_supported: selected context is recognized as easy_hang/friends_cozy'
        : 'supported: selected context is not recognized as easy_hang/friends_cozy',
      D:
        parityValidationDiagnostic?.observedDirectionIdentity === 'intimate'
          ? 'not_supported: observed identity remains intimate in hosted-like replay'
          : `supported: observed identity is ${parityValidationDiagnostic?.observedDirectionIdentity ?? 'unknown'}`,
      E:
        generatedRouteBeforeValidation.length > 0
          ? 'not_supported: latest provider response bodies are sufficient for a hosted-like replay, but the true pre-validation route is still absent'
          : 'supported: local test still lacks hosted route details',
      F:
        'partially_supported: provider response bodies are available; exact pre-validation route candidate diagnostics are not captured',
      G:
        compatibilityDiagnostic.failedCondition &&
        compatibilityDiagnostic.failedCondition !== 'hard_incompatible_easy_hang_signal'
          ? 'possible: compatibility rule may be too narrow for a semantically acceptable route'
          : 'not_supported',
      H:
        compatibilityDiagnostic.hardIncompatibleSignalsPresent
          ? 'supported: generation/admission should avoid hard-incompatible stops for easy_hang'
          : 'not_supported',
      I: sourceOrProvenanceCheckedByValidator
        ? 'source_inspection_risk: validator source text includes source/provider terms'
        : 'not_supported: validator comparison is semantic, not provider provenance',
    },
  }

  console.log(JSON.stringify(output, null, 2))

  assert(output.buildContractDrivenBuildWaypointPlanInvoked, 'Expected Build Waypoint planner to be invoked.')
  assert(output.runGeneratePlanReturned, 'Expected local generation result to return before parity validation.')
  assert(output.postPlannerCommitParityReached, 'Expected post-planner parity validation to be reached.')
  assert(!output.directionValidationThrown, 'Expected hosted-like Village replay to avoid direction validation throw.')
  assert(output.directionCompatibilityAccepted, 'Expected hosted-like replay to accept explicit easy_hang/intimate compatibility.')
  assert(output.compatibilityAccepted, 'Expected compatibility diagnostic to accept hosted-like replay after hard-signal admission filtering.')
  assert(output.failedCondition === null, 'Expected compatibility diagnostic to have no failed condition.')
  assert(
    !output.hardIncompatibleSignalsPresent,
    'Expected hard-incompatible live_music/cocktails signals to be excluded before route validation.',
  )
  assert(output.arbitraryIdentityDriftStillFails, 'Expected arbitrary easy_hang identity drift to remain rejected.')
  assert(output.generatedContractEntryArtifactProduced, 'Expected generated ContractEntryArtifact after compatible route validation.')
  assert(output.finalRouteProduced, 'Expected finalRoute after compatible route validation.')
  assert(output.runtimeRouteArtifactProduced, 'Expected RuntimeRouteArtifact after compatible route validation.')
  assert(output.lockInputAvailable, 'Expected lock input after generated authority handoff.')
  assert(output.fetchCallCount === 0, 'Expected zero fetch calls.')
}

try {
  await main()
} finally {
  globalThis.fetch = originalFetch
}
