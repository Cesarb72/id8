import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { sanJoseVenues } from '../src/data/venues.ts'
import {
  buildApplicationConciergeIntent,
  projectConciergeIntentToIntentInput,
} from '../src/app/concierge/conciergeIntentAdapter.ts'
import { buildCanonicalInterpretationBundle } from '../src/domain/interpretation/buildCanonicalInterpretationBundle.ts'
import { buildContractGateWorldFromCanonical } from '../src/domain/bearings/buildContractGateWorld.ts'
import { buildStrategyAdmissibleWorlds } from '../src/domain/bearings/buildStrategyAdmissibleWorlds.ts'
import { buildDistrictOpportunityProfiles } from '../src/domain/interpretation/district/intelligence/buildDistrictOpportunityProfiles.ts'
import { runGeneratePlan, type GeneratePlanResult } from '../src/domain/runGeneratePlan.ts'
import { roleProjection } from '../src/domain/config/roleProjection.ts'
import type {
  WaypointAssemblyObservationEvent,
  WaypointAssemblyObservationType,
} from '../src/domain/arc/waypointAssemblyObserver.ts'
import type { PersonaMode, VibeAnchor } from '../src/domain/types/intent.ts'
import type { UserStopRole } from '../src/domain/types/itinerary.ts'

type CaseId = 'romantic-cultured' | 'family-cozy' | 'friends-cultured'
type Provenance =
  | 'EXPLICIT_CASE_IDENTITY'
  | 'PRODUCTION_DERIVED'
  | 'PRODUCTION_DEFAULT'
  | 'ABSENT'
  | 'UNRESOLVED'

interface ManifestField<T> {
  value: T
  provenance: Provenance
}

interface CaseSpec {
  id: CaseId
  label: string
  persona: Extract<PersonaMode, 'romantic' | 'family' | 'friends'>
  vibe: Extract<VibeAnchor, 'cultured' | 'cozy'>
}

interface FetchCounters {
  attemptedProviderCalls: number
  successfulProviderCalls: number
  fieldProxyHits: number
  browserProviderHits: number
  lceProviderHits: number
  firstBlockedUrl: string | null
}

interface WaypointAssemblyObserverState {
  enabled: boolean
  detailLimit: number
  progressInterval: number
  totalEventsObserved: number
  totalDetailedEventsEmitted: number
  droppedDetailCount: number
  truncationOccurred: boolean
  eventCounts: Partial<Record<WaypointAssemblyObservationType, number>>
  firstObservedTypes: WaypointAssemblyObservationType[]
  rolePoolSizes?: WaypointAssemblyObservationEvent['rolePoolSizes']
  lastPhaseEntered: WaypointAssemblyObservationEvent | null
  lastPhaseCompleted: WaypointAssemblyObservationEvent | null
  latestEnteredOperation: WaypointAssemblyObservationEvent | null
  latestReturnedOperation: WaypointAssemblyObservationEvent | null
  assemblyCompleted: boolean
}

const CASES: Record<CaseId, CaseSpec> = {
  'romantic-cultured': {
    id: 'romantic-cultured',
    label: 'Romantic / Cultured / San Jose',
    persona: 'romantic',
    vibe: 'cultured',
  },
  'family-cozy': {
    id: 'family-cozy',
    label: 'Family / Cozy / San Jose',
    persona: 'family',
    vibe: 'cozy',
  },
  'friends-cultured': {
    id: 'friends-cultured',
    label: 'Friends / Cultured / San Jose',
    persona: 'friends',
    vibe: 'cultured',
  },
}

const UNAVAILABLE = 'UNAVAILABLE_WITHOUT_INSTRUMENTATION'
const caseArg = process.argv.slice(2)
const WAYPOINT_OBSERVER_ENABLED = process.env.MOVE2B_WAYPOINT_ASSEMBLY_OBSERVER === '1'
const ROUTE_COMPETITION_EVIDENCE_ENABLED =
  process.env.MOVE2B_ROUTE_COMPETITION_EVIDENCE === '1'
const WAYPOINT_OBSERVER_DETAIL_LIMIT = Number(
  process.env.MOVE2B_WAYPOINT_ASSEMBLY_DETAIL_LIMIT ?? 80,
)
const WAYPOINT_OBSERVER_PROGRESS_INTERVAL = Number(
  process.env.MOVE2B_WAYPOINT_ASSEMBLY_PROGRESS_INTERVAL ?? 1000,
)

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function emit(event: string, payload: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify({ event, ...payload })}\n`)
}

function field<T>(value: T, provenance: Provenance): ManifestField<T> {
  return { value, provenance }
}

function classifyUrl(url: string, counters: FetchCounters): void {
  if (url.includes('/api/field/text-search')) {
    counters.fieldProxyHits += 1
  }
  if (/googleapis|places\.google|maps\.google/i.test(url)) {
    counters.browserProviderHits += 1
  }
  if (/\/api\/lce|lce/i.test(url)) {
    counters.lceProviderHits += 1
  }
}

function repoStatus(): string {
  return execFileSync('git', ['status', '--short', '--branch'], {
    encoding: 'utf8',
  }).trim()
}

function createWaypointAssemblyObserver(caseId: CaseId): {
  observer?: (event: WaypointAssemblyObservationEvent) => void
  state: WaypointAssemblyObserverState
  summary: () => Record<string, unknown>
} {
  const state: WaypointAssemblyObserverState = {
    enabled: WAYPOINT_OBSERVER_ENABLED,
    detailLimit: WAYPOINT_OBSERVER_DETAIL_LIMIT,
    progressInterval: WAYPOINT_OBSERVER_PROGRESS_INTERVAL,
    totalEventsObserved: 0,
    totalDetailedEventsEmitted: 0,
    droppedDetailCount: 0,
    truncationOccurred: false,
    eventCounts: {},
    firstObservedTypes: [],
    lastPhaseEntered: null,
    lastPhaseCompleted: null,
    latestEnteredOperation: null,
    latestReturnedOperation: null,
    assemblyCompleted: false,
  }
  const seenTypes = new Set<WaypointAssemblyObservationType>()

  function compactEvent(event: WaypointAssemblyObservationEvent) {
    return {
      type: event.type,
      stage: event.stage,
      proves: event.proves,
      operationId: event.operationId,
      coreCombinationIndex: event.coreCombinationIndex,
      wildcardComparisonIndex: event.wildcardComparisonIndex,
      candidateCount: event.candidateCount,
      rolePoolSizes: event.rolePoolSizes,
      invalidReasonCodes: event.invalidReasonCodes,
      feasibilityReasonCodes: event.feasibilityReasonCodes,
      result: event.result,
      combination: event.combination,
      wildcard: event.wildcard,
    }
  }

  function summary() {
    return {
      enabled: state.enabled,
      detailLimit: state.detailLimit,
      progressInterval: state.progressInterval,
      totalEventsObserved: state.totalEventsObserved,
      totalDetailedEventsEmitted: state.totalDetailedEventsEmitted,
      droppedDetailCount: state.droppedDetailCount,
      truncationOccurred: state.truncationOccurred,
      eventCounts: state.eventCounts,
      firstObservedTypes: state.firstObservedTypes,
      rolePoolSizes: state.rolePoolSizes,
      lastPhaseEntered: state.lastPhaseEntered ? compactEvent(state.lastPhaseEntered) : null,
      lastPhaseCompleted: state.lastPhaseCompleted ? compactEvent(state.lastPhaseCompleted) : null,
      latestEnteredOperation: state.latestEnteredOperation
        ? compactEvent(state.latestEnteredOperation)
        : null,
      latestReturnedOperation: state.latestReturnedOperation
        ? compactEvent(state.latestReturnedOperation)
        : null,
      assemblyCompleted: state.assemblyCompleted,
    }
  }

  if (!WAYPOINT_OBSERVER_ENABLED) {
    return { state, summary }
  }

  function observer(event: WaypointAssemblyObservationEvent): void {
    state.totalEventsObserved += 1
    state.eventCounts[event.type] = (state.eventCounts[event.type] ?? 0) + 1
    if (!seenTypes.has(event.type)) {
      seenTypes.add(event.type)
      state.firstObservedTypes.push(event.type)
    }
    if (event.rolePoolSizes) {
      state.rolePoolSizes = event.rolePoolSizes
    }
    if (event.proves === 'entry') {
      state.lastPhaseEntered = event
      state.latestEnteredOperation = event
    } else if (event.proves === 'return') {
      state.latestReturnedOperation = event
    } else {
      state.lastPhaseCompleted = event
      if (event.type === 'assembly_completed') {
        state.assemblyCompleted = true
      }
    }

    const firstType = state.eventCounts[event.type] === 1
    const underDetailLimit = state.totalDetailedEventsEmitted < state.detailLimit
    const progressDue = state.totalEventsObserved % state.progressInterval === 0

    if (firstType || underDetailLimit) {
      state.totalDetailedEventsEmitted += 1
      emit('waypoint_assembly_observation', {
        caseId,
        sequence: state.totalEventsObserved,
        boundedness: {
          detailLimit: state.detailLimit,
          progressInterval: state.progressInterval,
          totalEventsObserved: state.totalEventsObserved,
          totalDetailedEventsEmitted: state.totalDetailedEventsEmitted,
          droppedDetailCount: state.droppedDetailCount,
          truncationOccurred: state.truncationOccurred,
        },
        observation: compactEvent(event),
      })
      return
    }

    state.droppedDetailCount += 1
    state.truncationOccurred = true
    if (progressDue) {
      emit('waypoint_assembly_progress', {
        caseId,
        sequence: state.totalEventsObserved,
        summary: summary(),
      })
    }
  }

  return { observer, state, summary }
}

function assertCanonicalTracerSource(): void {
  const runGeneratePlanSource = readFileSync('src/domain/runGeneratePlan.ts', 'utf8')
  const ownSource = readFileSync(new URL(import.meta.url), 'utf8')
  assert(
    runGeneratePlanSource.includes('export async function runGeneratePlan(') &&
      runGeneratePlanSource.includes('assembleArcCandidates('),
    'Canonical runGeneratePlan source shape is not present.',
  )
  const forbiddenScenarioEvidence = 'current-composition-evidence' + '.json'
  const forbiddenScenarioBuilder = 'buildScenarioNights' + 'FromCandidateBoard'
  const forbiddenRouteOverride = 'selectedRoute' + 'Override'
  assert(!ownSource.includes(forbiddenScenarioEvidence), 'Tracer must not read scenario output.')
  assert(!ownSource.includes(forbiddenScenarioBuilder), 'Tracer must not use scenario generation.')
  assert(!ownSource.includes(forbiddenRouteOverride), 'Tracer must not override returned route selection.')
}

function selectedRoute(result: GeneratePlanResult) {
  return result.selectedArc.stops.map((stop, index) => ({
    order: index + 1,
    internalRole: stop.role,
    userRole: roleProjection[stop.role],
    venueId: stop.scoredVenue.venue.id,
    candidateId: stop.scoredVenue.candidateIdentity.candidateId,
    name: stop.scoredVenue.venue.name,
  }))
}

function shownRoute(result: GeneratePlanResult) {
  return result.itinerary.stops.map((stop, index) => ({
    order: index + 1,
    role: stop.role,
    venueId: stop.venueId,
    name: stop.venueName,
  }))
}

function approvedRoute(result: GeneratePlanResult) {
  const materialized = result.contractEntryArtifact.enrichment?.materializedRouteStops
  if (!materialized) {
    return UNAVAILABLE
  }
  return (['start', 'highlight', 'windDown'] as const)
    .map((role) => materialized[role])
    .filter((stop): stop is NonNullable<typeof stop> => Boolean(stop))
    .map((stop) => ({
      role: stop.role,
      venueId: stop.venueId,
      baseVenueId: stop.baseVenueId,
      name: stop.name,
    }))
}

function selectedHighlight(result: GeneratePlanResult) {
  const highlight = result.selectedArc.stops.find((stop) => roleProjection[stop.role] === 'highlight')
  if (!highlight) {
    return UNAVAILABLE
  }
  return {
    venueId: highlight.scoredVenue.venue.id,
    candidateId: highlight.scoredVenue.candidateIdentity.candidateId,
    name: highlight.scoredVenue.venue.name,
  }
}

function parity(result: GeneratePlanResult) {
  const selectedByRole = new Map<UserStopRole, string>()
  for (const stop of result.selectedArc.stops) {
    selectedByRole.set(roleProjection[stop.role], stop.scoredVenue.venue.id)
  }
  const mismatches = result.itinerary.stops
    .filter((stop) => selectedByRole.get(stop.role) !== stop.venueId)
    .map((stop) => ({
      role: stop.role,
      selectedVenueId: selectedByRole.get(stop.role) ?? null,
      shownVenueId: stop.venueId,
    }))
  return {
    parity: mismatches.length === 0,
    mismatches,
  }
}

function summarizeGreatStop(result: GeneratePlanResult) {
  const gate = result.trace.greatStopGateResult
  if (!gate) {
    return UNAVAILABLE
  }
  return {
    status: gate.status,
    failedCriteria: gate.failedCriteria,
    reasons: gate.reasons,
    routeId: gate.routeId,
    criteria: {
      real: gate.criteria.real.passed,
      roleRight: gate.criteria.roleRight.passed,
      intentRight: gate.criteria.intentRight.passed,
      placeRight: gate.criteria.placeRight.passed,
      momentRight: gate.criteria.momentRight.passed,
    },
  }
}

function returnedEvidence(result: GeneratePlanResult, elapsedMs: number, counters: FetchCounters) {
  const boundary = result.trace.boundaryDiagnostics
  const selection = result.trace.greatStopGateSelectionDiagnostics
  const ingress = result.trace.canonicalInterpretationIngress
  return {
    totalRuntimeMs: Math.round(elapsedMs),
    canonicalInterpretationIngressSupplied: ingress?.supplied ?? UNAVAILABLE,
    waypointPrimaryInput: boundary.waypointContractTrace?.primaryInput ?? UNAVAILABLE,
    interpretationIdentifiers: {
      strategyFamily: ingress?.strategyFamily ?? UNAVAILABLE,
      experienceContractId: ingress?.experienceContractId ?? UNAVAILABLE,
      contractConstraintsId: ingress?.contractConstraintsId ?? UNAVAILABLE,
      bundleSource: ingress?.bundleSource ?? UNAVAILABLE,
    },
    assembledCandidateCount: result.trace.candidateArcCount,
    rankedCandidateCount:
      selection?.rankedCandidateCount ??
      boundary.postBoundaryOrder.length ??
      UNAVAILABLE,
    selectedRank:
      selection?.selectedCandidateRank ??
      boundary.postBoundarySnapshot.find((candidate) => candidate.candidateId === result.selectedArc.id)?.rank ??
      UNAVAILABLE,
    selectedHighlight: selectedHighlight(result),
    selectedOrderedRoute: selectedRoute(result),
    greatStopResult: summarizeGreatStop(result),
    approvedRoute: approvedRoute(result),
    shownRoute: shownRoute(result),
    assessedShownParity: parity(result),
    routeCompetitionEvidence: result.trace.waypointRouteCompetitionDiagnostics ?? {
      enabled: false,
      status: UNAVAILABLE,
      reason: ROUTE_COMPETITION_EVIDENCE_ENABLED
        ? 'diagnostic_not_returned'
        : 'diagnostic_disabled',
    },
    providerAttempts: counters.attemptedProviderCalls,
    providerHits: {
      successfulProviderCalls: counters.successfulProviderCalls,
      fieldProxyHits: counters.fieldProxyHits,
      browserProviderHits: counters.browserProviderHits,
      lceProviderHits: counters.lceProviderHits,
    },
  }
}

function parseCase(): CaseSpec {
  assert(caseArg.length === 1, 'Pass exactly one case id: romantic-cultured, family-cozy, or friends-cultured.')
  const spec = CASES[caseArg[0] as CaseId]
  assert(spec, `Unknown case id: ${caseArg[0]}`)
  return spec
}

async function run(): Promise<void> {
  const spec = parseCase()
  assertCanonicalTracerSource()
  const assemblyObserver = createWaypointAssemblyObserver(spec.id)

  const counters: FetchCounters = {
    attemptedProviderCalls: 0,
    successfulProviderCalls: 0,
    fieldProxyHits: 0,
    browserProviderHits: 0,
    lceProviderHits: 0,
    firstBlockedUrl: null,
  }
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    counters.attemptedProviderCalls += 1
    counters.firstBlockedUrl ??= url
    classifyUrl(url, counters)
    throw new Error(`Move 2B accepted production tracer must not call fetch/providers: ${url}`)
  }) as typeof fetch

  const conciergeIntent = buildApplicationConciergeIntent({
    mode: 'surprise',
    persona: spec.persona,
    primaryVibe: spec.vibe,
    city: 'San Jose',
  })
  const canonicalInterpretationBundle = buildCanonicalInterpretationBundle({
    conciergeIntent,
    interpretationSource: 'scripts.test-move-2b-accepted-production-tracer',
  })
  const projectedInput = projectConciergeIntentToIntentInput({
    conciergeIntent,
    mode: 'surprise',
    city: 'San Jose',
    distanceMode: 'nearby',
  })
  const manifest = {
    caseId: field(spec.id, 'EXPLICIT_CASE_IDENTITY'),
    label: field(spec.label, 'EXPLICIT_CASE_IDENTITY'),
    persona: field(spec.persona, 'EXPLICIT_CASE_IDENTITY'),
    vibe: field(spec.vibe, 'EXPLICIT_CASE_IDENTITY'),
    city: field('San Jose', 'EXPLICIT_CASE_IDENTITY'),
    publicMode: field(projectedInput.mode, 'PRODUCTION_DERIVED'),
    generationStrategy: field('runGeneratePlan', 'PRODUCTION_DERIVED'),
    sourceMode: field('curated', 'PRODUCTION_DEFAULT'),
    sourceModeOverrideApplied: field(true, 'PRODUCTION_DEFAULT'),
    district: field(projectedInput.district ?? null, projectedInput.district ? 'PRODUCTION_DERIVED' : 'ABSENT'),
    distanceMode: field(projectedInput.distanceMode, 'PRODUCTION_DEFAULT'),
    starterPackIdentity: field(null, 'ABSENT'),
    anchorPosture: field(conciergeIntent.anchorPosture, 'PRODUCTION_DERIVED'),
    seedPosture: field(conciergeIntent.starterLineage, 'PRODUCTION_DERIVED'),
    routeShapeContractIdentity: field(null, 'ABSENT'),
    canonicalInterpretationBundleIdentity: field(
      {
        conciergeIntentId: conciergeIntent.id,
        experienceContractId: canonicalInterpretationBundle.experienceContract.id,
        contractConstraintsId: canonicalInterpretationBundle.contractConstraints.id,
        strategyFamily: canonicalInterpretationBundle.strategyFamily,
      },
      'PRODUCTION_DERIVED',
    ),
    staticCorpus: field(
      {
        identity: 'src/data/venues.ts#sanJoseVenues',
        count: sanJoseVenues.length,
      },
      'PRODUCTION_DEFAULT',
    ),
    liveEnvelope: field(null, 'ABSENT'),
    waypointAssemblyObserver: field(
      WAYPOINT_OBSERVER_ENABLED ? 'enabled' : 'disabled',
      'PRODUCTION_DEFAULT',
    ),
    waypointRouteCompetitionEvidence: field(
      ROUTE_COMPETITION_EVIDENCE_ENABLED ? 'enabled' : 'disabled',
      'PRODUCTION_DEFAULT',
    ),
    timeoutAppliedByCaller: field(process.env.MOVE2B_TRACER_TIMEOUT_CEILING_MS ?? null, process.env.MOVE2B_TRACER_TIMEOUT_CEILING_MS ? 'PRODUCTION_DEFAULT' : 'ABSENT'),
  }

  emit('input_manifest', { manifest })
  emit('provider_guard_installed', {
    caseId: spec.id,
    providerGuard: {
      status: 'closed',
      ...counters,
    },
  })
  emit('case_start', {
    caseId: spec.id,
    generationAuthority: 'runGeneratePlan',
    waypointAssemblyObserver: {
      enabled: assemblyObserver.state.enabled,
      detailLimit: assemblyObserver.state.detailLimit,
      progressInterval: assemblyObserver.state.progressInterval,
    },
    repositoryStatusBeforeCase: repoStatus(),
  })

  try {
    const districtPreview = await buildDistrictOpportunityProfiles({
      locationQuery: 'San Jose',
      includeDebug: true,
    })
    const contractGateWorld = buildContractGateWorldFromCanonical({
      canonicalInterpretationBundle,
      ranked: districtPreview.ranked,
      source: 'scripts.test-move-2b-accepted-production-tracer',
    })
    const strategyAdmissibleWorlds = buildStrategyAdmissibleWorlds({ contractGateWorld })
    const startedAt = performance.now()
    const result = await runGeneratePlan(projectedInput, {
      seedVenues: sanJoseVenues,
      sourceMode: 'curated',
      sourceModeOverrideApplied: true,
      debugMode: false,
      experienceContract: canonicalInterpretationBundle.experienceContract,
      contractConstraints: canonicalInterpretationBundle.contractConstraints,
      canonicalInterpretationBundle,
      rankedDistrictPockets: districtPreview.ranked,
      contractGateWorld,
      strategyAdmissibleWorlds,
      waypointAssemblyObserver: assemblyObserver.observer,
      waypointRouteCompetitionEvidence: ROUTE_COMPETITION_EVIDENCE_ENABLED,
    })
    const elapsedMs = performance.now() - startedAt
    assert(
      result.selectedArc.id === result.trace.selectedArcId,
      'Returned selectedArc must match trace selectedArcId.',
    )
    assert(counters.attemptedProviderCalls === 0, 'Provider attempts must remain zero.')
    emit('case_complete', {
      caseId: spec.id,
      canonicalPathProof: {
        runGeneratePlanInvoked: true,
        productionBuildersUsed: [
          'buildApplicationConciergeIntent',
          'buildCanonicalInterpretationBundle',
          'projectConciergeIntentToIntentInput',
          'buildDistrictOpportunityProfiles',
          'buildContractGateWorldFromCanonical',
          'buildStrategyAdmissibleWorlds',
        ],
        staticCorpusUsed: 'src/data/venues.ts#sanJoseVenues',
        scenarioGenerationPathUsed: false,
        routeReconstructedByTracer: false,
        returnedWinnerOverridden: false,
      },
      evidence: returnedEvidence(result, elapsedMs, counters),
      providerGuard: {
        status: 'closed',
        ...counters,
      },
      waypointAssemblyObserver: assemblyObserver.summary(),
      repositoryStatusAfterCase: repoStatus(),
    })
  } catch (error) {
    emit('case_failed', {
      caseId: spec.id,
      errorMessage: error instanceof Error ? error.message : String(error),
      providerGuard: {
        status: counters.attemptedProviderCalls === 0 ? 'closed' : 'blocked_attempt',
        ...counters,
      },
      waypointAssemblyObserver: assemblyObserver.summary(),
      repositoryStatusAfterCase: repoStatus(),
    })
    throw error
  } finally {
    globalThis.fetch = originalFetch
  }
}

await run()
