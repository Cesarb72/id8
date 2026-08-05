import { buildContractEntryRuntimeRouteLockTruth } from '../src/app/services/live/contractEntryLockHandoff.ts'
import { sanJoseVenues } from '../src/data/venues.ts'
import { getArcStopBaseVenueId } from '../src/domain/candidates/candidateIdentity.ts'
import { runGeneratePlan } from '../src/domain/runGeneratePlan.ts'
import {
  GreatStopGateSelectionError,
  type BuildCandidatePoolCompactnessCandidateDetail,
  type BuildLocationClass,
  type GreatStopCandidateFailureDetails,
  type GreatStopGateCandidateFailureDetail,
  type GreatStopGateCandidateIdentityDiagnostic,
  type GreatStopGateCriterion,
  type GreatStopGateDiagnostics,
  type GreatStopGateResult,
  type GreatStopGateSelectionDiagnostics,
} from '../src/domain/types/greatStopGate.ts'
import type { IntentInput, PersonaMode, VibeAnchor } from '../src/domain/types/intent.ts'

type ThinCellId = 'Adega' | 'MINIBOSS' | 'Happy Hollow'
type VerdictStatus = 'PASS' | 'FAIL' | 'UNKNOWN'
type DiagnosticPrimaryResult =
  | 'CURRENT_ROUTE_PASSES'
  | 'PASSING_ALTERNATIVE_EXISTS'
  | 'HARD_FEASIBILITY_VETO'
  | 'SOFT_FEASIBILITY_FALSE_VETO'
  | 'WRONG_SHAPE_IMPOSITION'
  | `NON_FEASIBILITY_REJECTION - ${string}`
  | 'CANDIDATE_SUPPLY_LIMITATION'
  | 'WAYPOINT_MISSELECTION_OR_ASSEMBLY'
  | 'MULTIPLE_INDEPENDENT_REJECTIONS'
  | 'PROOF_ONLY_FAILURE'
  | `UNKNOWN - ${string}`

interface ThinCellSpec {
  cell: ThinCellId
  anchorVenueId: string
  persona: PersonaMode
  primaryVibe: VibeAnchor
  secondaryVibe?: VibeAnchor
  district: string
  distanceMode: NonNullable<IntentInput['distanceMode']>
  locationClass: BuildLocationClass
}

interface OwnerVerdictTable {
  real: VerdictStatus
  placeRight: VerdictStatus
  roleRight: VerdictStatus
  intentRight: VerdictStatus
  momentRight: VerdictStatus
  experienceComposition: VerdictStatus | 'NOT_ACTIVE_FOR_BUILD_THIN_CELL'
  aggregate: VerdictStatus
}

interface SoftHardClassification {
  softPolicyVetoes: string[]
  hardFeasibilityVetoes: string[]
  unknownFeasibilityVetoes: string[]
  note: string
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const originalFetch = globalThis.fetch
let fetchCallCount = 0

globalThis.fetch = (async (input) => {
  fetchCallCount += 1
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  throw new Error(`THIN formal Great Stop bridge observer must not call fetch: ${url}`)
}) as typeof fetch

const cells: ThinCellSpec[] = [
  {
    cell: 'Adega',
    anchorVenueId: 'sj-adega-wine-atelier',
    persona: 'romantic',
    primaryVibe: 'cozy',
    secondaryVibe: 'lively',
    district: 'Little Portugal',
    distanceMode: 'short-drive',
    locationClass: 'L2 Mid',
  },
  {
    cell: 'MINIBOSS',
    anchorVenueId: 'sj-miniboss',
    persona: 'friends',
    primaryVibe: 'lively',
    secondaryVibe: 'cultured',
    district: 'Downtown',
    distanceMode: 'short-drive',
    locationClass: 'L2 Mid',
  },
  {
    cell: 'Happy Hollow',
    anchorVenueId: 'sj-happy-hollow',
    persona: 'family',
    primaryVibe: 'lively',
    secondaryVibe: 'cultured',
    district: 'East San Jose',
    distanceMode: 'short-drive',
    locationClass: 'L2 Mid',
  },
]

function buildInput(spec: ThinCellSpec): IntentInput {
  return {
    mode: 'build',
    planningMode: 'user-led',
    persona: spec.persona,
    primaryVibe: spec.primaryVibe,
    secondaryVibe: spec.secondaryVibe,
    city: 'San Jose',
    district: spec.district,
    distanceMode: spec.distanceMode,
    anchor: {
      venueId: spec.anchorVenueId,
      role: 'highlight',
    },
    discoveryPreferences: [
      {
        venueId: spec.anchorVenueId,
        role: 'highlight',
      },
    ],
  }
}

function verdict(passed: boolean | undefined): VerdictStatus {
  if (passed == null) {
    return 'UNKNOWN'
  }
  return passed ? 'PASS' : 'FAIL'
}

function ownerVerdictsFromGate(gate?: GreatStopGateResult): OwnerVerdictTable {
  return {
    real: verdict(gate?.criteria.real.passed),
    placeRight: verdict(gate?.criteria.placeRight.passed),
    roleRight: verdict(gate?.criteria.roleRight.passed),
    intentRight: verdict(gate?.criteria.intentRight.passed),
    momentRight: verdict(gate?.criteria.momentRight.passed),
    experienceComposition: 'NOT_ACTIVE_FOR_BUILD_THIN_CELL',
    aggregate: gate?.status ?? 'UNKNOWN',
  }
}

function routeFromFailureDetail(detail: GreatStopGateCandidateFailureDetail | undefined) {
  if (!detail) {
    return null
  }
  return {
    candidateId: detail.candidateId,
    rank: detail.rank,
    signature: detail.signature,
    stopCount: detail.stopIds.length,
    orderedRouteNames: detail.routeNames,
    orderedCanonicalVenueIds: detail.baseVenueIds,
    orderedRoles: detail.creditedRoles,
    anchorSurvival: {
      requiredAnchorPresent: detail.requiredAnchorPresent ?? null,
      requiredAnchorRole: detail.requiredAnchorRole ?? null,
      requiredAnchorRoleCorrect: detail.requiredAnchorRoleCorrect ?? null,
    },
    ownerVerdicts: {
      real: detail.failedCriteria.includes('real') ? 'FAIL' : 'PASS',
      placeRight: detail.failedCriteria.includes('place_right') ? 'FAIL' : 'PASS',
      roleRight: detail.failedCriteria.includes('role_right') ? 'FAIL' : 'PASS',
      intentRight: detail.failedCriteria.includes('intent_right') ? 'FAIL' : 'PASS',
      momentRight: detail.failedCriteria.includes('moment_right') ? 'FAIL' : 'PASS',
      experienceComposition: 'NOT_ACTIVE_FOR_BUILD_THIN_CELL',
      aggregate: 'FAIL',
    } satisfies OwnerVerdictTable,
    failingCriteria: detail.failedCriteria,
    failureReasons: detail.failureReasons,
    bearings: {
      totalMovement: detail.totalMovementEstimate,
      maximumTransition: detail.maxSingleTransitionEstimate,
      movementLimit: detail.totalLimitMinutes,
      transitionLimit: detail.transitionLimitMinutes,
      clusterEscapes: detail.clusterEscapeCount,
      clusterPath: detail.clusterPath,
      backtrackDetected: detail.backtrackDetected,
      driveLikeMovementDetected: detail.driveLikeMovementDetected,
      placeRightClauseAttribution: detail.placeRightClauseAttribution,
      supportWorldDiagnostics: detail.placeRightSupportWorldDiagnostics ?? null,
      diagnosticCounterfactuals: detail.placeRightDiagnosticCounterfactuals
        ? {
            allClausesEnforced: {
              status: detail.placeRightDiagnosticCounterfactuals.allClausesEnforced.status,
              reasons: detail.placeRightDiagnosticCounterfactuals.allClausesEnforced.reasons,
              supportWorldDiagnostics:
                detail.placeRightDiagnosticCounterfactuals.allClausesEnforced
                  .supportWorldDiagnostics ?? null,
            },
            softClausesObserveOnly: {
              status: detail.placeRightDiagnosticCounterfactuals.softClausesObserveOnly.status,
              reasons:
                detail.placeRightDiagnosticCounterfactuals.softClausesObserveOnly.reasons,
              supportWorldDiagnostics:
                detail.placeRightDiagnosticCounterfactuals.softClausesObserveOnly
                  .supportWorldDiagnostics ?? null,
            },
          }
        : null,
    },
    taste: {
      momentFailureReasons: detail.momentFailureReasons,
      roleEnergyNote: detail.roleEnergyNote ?? null,
      scoreSummary: detail.scoreSummary,
    },
  }
}

function routeFromIdentitySummary(summary: GreatStopGateCandidateIdentityDiagnostic | undefined) {
  if (!summary) {
    return null
  }
  return {
    candidateId: summary.candidateId,
    rank: summary.rank,
    signature: summary.signature,
    stopCount: summary.stops.length,
    orderedRouteNames: summary.stops.map((stop) => stop.name),
    orderedCanonicalVenueIds: summary.stops.map((stop) => stop.baseVenueId),
    orderedRawVenueIds: summary.stops.map((stop) => stop.rawVenueId),
    orderedRoles: summary.stops.map((stop) => stop.role),
    anchorSurvival: {
      preservesRequiredAnchor: summary.preservesRequiredAnchor ?? null,
      requiredRoleCorrect: summary.requiredRoleCorrect ?? null,
      structuralFailureReasons: summary.structuralFailureReasons,
    },
    failingCriteria: summary.failedCriteria,
    failureReasons: summary.reasons,
  }
}

function compactAlternative(detail: BuildCandidatePoolCompactnessCandidateDetail | undefined) {
  if (!detail) {
    return null
  }
  return {
    candidateId: detail.candidateId,
    preTop40Rank: detail.preTop40Rank,
    postTop40Rank: detail.postTop40Rank ?? null,
    survivedTop40: detail.survivedTop40,
    pruneReason: detail.pruneReason ?? null,
    stopCount: detail.stopCount,
    hasSurprise: detail.hasSurprise,
    orderedRouteNames: detail.routeNames,
    orderedCanonicalVenueIds: detail.baseVenueIds,
    orderedRoles: detail.roles,
    anchorSurvival: {
      requiredAnchorPresent: detail.requiredAnchorPresent ?? null,
      requiredAnchorRoleCorrect: detail.requiredAnchorRoleCorrect ?? null,
    },
    movement: {
      totalMovement: detail.totalMovementEstimate,
      compactnessTotalMovementLimit: detail.compactnessTotalMovementLimit ?? null,
      greatStopTotalMovementLimit: detail.greatStopTotalMovementLimit ?? null,
      maximumTransition: detail.maxTransitionEstimate,
      transitionLimit: detail.maxTransitionLimit ?? null,
      clusterEscapes: detail.clusterEscapeCount,
      clusterPath: detail.clusterPath,
      backtrackDetected: detail.backtrackDetected,
      repeatedClusterEscapeDetected: detail.repeatedClusterEscapeDetected,
      driveLikeMovementDetected: detail.driveLikeMovementDetected,
    },
    authorityStatus:
      'diagnostic_only_not_great_stop_approved; listed from existing compactness diagnostics',
  }
}

function failureDetailSummary(details?: GreatStopCandidateFailureDetails) {
  if (!details) {
    return null
  }
  return {
    evaluatedCandidateCount: details.evaluatedCandidateCount,
    passingCandidateCount: details.passingCandidateCount,
    candidatesFailingOnlyOneCriterionCount: details.candidatesFailingOnlyOneCriterionCount,
    candidatesFailingOnlyMovementCount: details.candidatesFailingOnlyMovementCount,
    candidatesFailingOnlyMomentCount: details.candidatesFailingOnlyMomentCount,
    candidatesFailingBothPlaceAndMomentCount: details.candidatesFailingBothPlaceAndMomentCount,
    repeatedFailureReasonCounts: details.repeatedFailureReasonCounts,
    requiredAnchorPreservedCount: details.requiredAnchorPreservedCount,
    compactnessCandidateCount: details.compactnessCandidateCount ?? null,
    backtrackPatternCount: details.backtrackPatternCount,
    nearestToPassCandidate: routeFromFailureDetail(details.nearestToPassCandidate),
    topFailingCandidates: details.topFailingCandidates.map(routeFromFailureDetail),
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

function classifySoftHard(reasons: readonly string[], diagnostics?: GreatStopGateDiagnostics): SoftHardClassification {
  const softPolicyVetoes: string[] = []
  const hardFeasibilityVetoes: string[] = []
  const unknownFeasibilityVetoes: string[] = []

  for (const reason of unique(reasons)) {
    if (
      reason.includes('cluster_escape') ||
      reason.includes('low_route_compactness') ||
      reason.includes('scattered_neighborhoods') ||
      reason.includes('poor_support_proximity') ||
      reason.includes('backtrack_structure')
    ) {
      softPolicyVetoes.push(reason)
    } else if (
      reason.includes('closed') ||
      reason.includes('hours') ||
      reason.includes('impossible') ||
      reason.includes('non_traversable')
    ) {
      hardFeasibilityVetoes.push(reason)
    } else if (
      reason.includes('support_supply_not_buildable') ||
      reason.includes('required_stop_survival_failed')
    ) {
      unknownFeasibilityVetoes.push(reason)
    }
  }

  return {
    softPolicyVetoes,
    hardFeasibilityVetoes,
    unknownFeasibilityVetoes,
    note:
      diagnostics?.movement || diagnostics?.clusterCoherence
        ? 'Current code does not implement a soft/hard policy split. This observer classifies movement and cluster-spread reasons as observational soft policy vetoes unless time/open/traversal impossibility evidence is present; support-world buildability remains unknown without deeper Bearings support-world evidence.'
        : 'No route-level Bearings diagnostics were exposed for this cell.',
  }
}

function primaryResult(params: {
  gate?: GreatStopGateResult
  diagnostics?: GreatStopGateSelectionDiagnostics
}): DiagnosticPrimaryResult {
  const gate = params.gate ?? params.diagnostics?.selectedGateResult
  if (gate?.status === 'PASS') {
    return 'CURRENT_ROUTE_PASSES'
  }
  const failedCriteria = gate?.failedCriteria ?? params.diagnostics?.failedTopCandidateCriteria ?? []
  const reasons = unique(gate?.reasons ?? params.diagnostics?.failureReasons ?? [])
  const ownerFailures = new Set<string>()
  if (failedCriteria.includes('real')) ownerFailures.add('Field:real')
  if (failedCriteria.includes('place_right')) ownerFailures.add('Bearings:place_right')
  if (failedCriteria.includes('role_right')) ownerFailures.add('Taste:role_right')
  if (failedCriteria.includes('intent_right')) ownerFailures.add('Taste:intent_right')
  if (failedCriteria.includes('moment_right')) ownerFailures.add('Taste:moment_right')

  const hasOwnerApprovedAlternative = (params.diagnostics?.passingCandidateCount ?? 0) > 0
  if (hasOwnerApprovedAlternative) {
    return 'PASSING_ALTERNATIVE_EXISTS'
  }
  if (ownerFailures.size > 1) {
    return 'MULTIPLE_INDEPENDENT_REJECTIONS'
  }
  if (failedCriteria.includes('place_right')) {
    const softObserve = gate?.diagnostics.placeRightDiagnosticCounterfactuals?.softClausesObserveOnly
    if (softObserve?.status === 'pass' && softObserve.reasons.length === 0) {
      return 'SOFT_FEASIBILITY_FALSE_VETO'
    }
    const classification = classifySoftHard(reasons, gate?.diagnostics)
    if (
      classification.softPolicyVetoes.length > 0 &&
      classification.hardFeasibilityVetoes.length === 0 &&
      classification.unknownFeasibilityVetoes.length === 0
    ) {
      return 'SOFT_FEASIBILITY_FALSE_VETO'
    }
    if (classification.hardFeasibilityVetoes.length > 0) {
      return 'HARD_FEASIBILITY_VETO'
    }
    return 'UNKNOWN - Bearings:place_right:support_world_buildability'
  }
  if (failedCriteria.includes('intent_right')) {
    const reason = reasons.find((item) => item.includes('intent_right')) ?? 'intent_right_failed'
    return `NON_FEASIBILITY_REJECTION - Taste:intent_right:${reason}`
  }
  if (failedCriteria.includes('role_right')) {
    const reason = reasons.find((item) => item.includes('role_right')) ?? 'role_right_failed'
    return `NON_FEASIBILITY_REJECTION - Taste:role_right:${reason}`
  }
  if (failedCriteria.includes('moment_right')) {
    const reason = reasons.find((item) => item.includes('moment_right')) ?? 'moment_right_failed'
    return `NON_FEASIBILITY_REJECTION - Taste:moment_right:${reason}`
  }
  if ((params.diagnostics?.rankedCandidateCount ?? 0) === 0) {
    return 'CANDIDATE_SUPPLY_LIMITATION'
  }
  return 'UNKNOWN - no_selected_gate_result'
}

function summarizeSelectionDiagnostics(diagnostics?: GreatStopGateSelectionDiagnostics) {
  if (!diagnostics) {
    return null
  }
  const compactness = diagnostics.compactnessRankingDiagnostics
  const pool = compactness?.buildCandidatePoolCompactnessDiagnostics
  return {
    status: diagnostics.status,
    stage: diagnostics.stage,
    selectedCandidateId: diagnostics.selectedCandidateId ?? null,
    selectedCandidateRank: diagnostics.selectedCandidateRank ?? null,
    rankedCandidateCount: diagnostics.rankedCandidateCount ?? null,
    evaluatedCandidateCount: diagnostics.evaluatedCandidateCount,
    fullEvaluatedCandidateCount: diagnostics.fullEvaluatedCandidateCount ?? null,
    passingCandidateCount: diagnostics.passingCandidateCount ?? null,
    anchorPreservingCandidateCount: diagnostics.anchorPreservingCandidateCount ?? null,
    firstRankWhereRequiredAnchorAppears: diagnostics.firstRankWhereRequiredAnchorAppears ?? null,
    candidatesWithRequiredAnchorByRawId: diagnostics.candidatesWithRequiredAnchorByRawId ?? null,
    candidatesWithRequiredAnchorByBaseVenueId: diagnostics.candidatesWithRequiredAnchorByBaseVenueId ?? null,
    candidatesWithRequiredAnchorByNormalizedHelper:
      diagnostics.candidatesWithRequiredAnchorByNormalizedHelper ?? null,
    failedTopCandidateCriteria: diagnostics.failedTopCandidateCriteria ?? [],
    failureReasons: diagnostics.failureReasons,
    structuralFailureReasons: diagnostics.structuralFailureReasons ?? [],
    rolePoolIdentityDiagnostics: diagnostics.rolePoolIdentityDiagnostics ?? null,
    waypointC1Approval: diagnostics.waypointC1Approval ?? null,
    selectedGateResult: diagnostics.selectedGateResult
      ? {
          routeId: diagnostics.selectedGateResult.routeId,
          ownerVerdicts: ownerVerdictsFromGate(diagnostics.selectedGateResult),
          failedCriteria: diagnostics.selectedGateResult.failedCriteria,
          reasons: diagnostics.selectedGateResult.reasons,
          requiredAnchor: diagnostics.selectedGateResult.requiredAnchor ?? null,
          preset: diagnostics.selectedGateResult.preset,
          bearings: diagnostics.selectedGateResult.diagnostics,
        }
      : null,
    bestFailingCandidateSummary: diagnostics.bestFailingCandidateSummary ?? null,
    bestAnchorPreservingFailingCandidate: diagnostics.bestAnchorPreservingFailingCandidate ?? null,
    evaluatedRoutes: (diagnostics.evaluatedCandidateIdentitySummaries ?? []).map(routeFromIdentitySummary),
    failureDetails: failureDetailSummary(diagnostics.greatStopCandidateFailureDetails),
    compactnessRankingDiagnostics: compactness
      ? {
          routeShapeCompactnessAdjustmentActive: compactness.routeShapeCompactnessAdjustmentActive,
          compactnessActivationReason: compactness.compactnessActivationReason,
          movementRadius: compactness.movementRadius ?? null,
          maxTransitionMinutes: compactness.maxTransitionMinutes ?? null,
          neighborhoodContinuity: compactness.neighborhoodContinuity ?? null,
          compactnessEvaluatedCandidateCount: compactness.compactnessEvaluatedCandidateCount,
          compactnessCandidateCount: compactness.compactnessCandidateCount,
          compactnessPassingPlaceRightCandidateCount:
            compactness.compactnessPassingPlaceRightCandidateCount ?? null,
          nearestCompactCandidate: compactAlternative(compactness.nearestCompactCandidate),
          nearestPlaceRightCandidate: compactAlternative(compactness.nearestPlaceRightCandidate),
          topCandidateDetails: compactness.topCandidateDetails.map(compactAlternative),
          poolVisibility: compactness.poolVisibility,
          buildCandidatePoolCompactnessDiagnostics: pool
            ? {
                fullAssembledCandidateCount: pool.fullAssembledCandidateCount,
                anchorPreservingAssembledCandidateCount: pool.anchorPreservingAssembledCandidateCount,
                threeStopCandidateCount: pool.threeStopCandidateCount,
                fourStopCandidateCount: pool.fourStopCandidateCount,
                withSurpriseCandidateCount: pool.withSurpriseCandidateCount,
                withoutSurpriseCandidateCount: pool.withoutSurpriseCandidateCount,
                preTop40CandidateCount: pool.preTop40CandidateCount,
                postTop40CandidateCount: pool.postTop40CandidateCount,
                requiredAnchorPreservedPreTop40Count: pool.requiredAnchorPreservedPreTop40Count,
                requiredAnchorPreservedPostTop40Count: pool.requiredAnchorPreservedPostTop40Count,
                preTop40CompactCandidateCount: pool.preTop40CompactCandidateCount,
                preTop40PlaceRightCandidateCount: pool.preTop40PlaceRightCandidateCount,
                preTop40NearCompactCandidateCount: pool.preTop40NearCompactCandidateCount,
                postTop40CompactCandidateCount: pool.postTop40CompactCandidateCount,
                postTop40PlaceRightCandidateCount: pool.postTop40PlaceRightCandidateCount,
                firstCompactPreTop40Rank: pool.firstCompactPreTop40Rank ?? null,
                firstPlaceRightPreTop40Rank: pool.firstPlaceRightPreTop40Rank ?? null,
                firstCompactPostTop40Rank: pool.firstCompactPostTop40Rank ?? null,
                firstPlaceRightPostTop40Rank: pool.firstPlaceRightPostTop40Rank ?? null,
                candidateShapeCounts: pool.candidateShapeCounts,
                rolePoolNearAnchorSupportVisibility: pool.rolePoolNearAnchorSupportVisibility,
                compactnessTotalMovementLimit: pool.compactnessTotalMovementLimit ?? null,
                greatStopTotalMovementLimit: pool.greatStopTotalMovementLimit ?? null,
                maxTransitionLimit: pool.maxTransitionLimit ?? null,
                compactnessLimitMatchesGreatStopLimit: pool.compactnessLimitMatchesGreatStopLimit ?? null,
                nearestPreTop40CompactCandidate: compactAlternative(pool.nearestPreTop40CompactCandidate),
                nearestPreTop40PlaceRightCandidate: compactAlternative(pool.nearestPreTop40PlaceRightCandidate),
                bestPreTop40NearCompactCandidate: compactAlternative(pool.bestPreTop40NearCompactCandidate),
                topPreTop40MovementCandidates: pool.topPreTop40MovementCandidates.map(compactAlternative),
              }
            : null,
        }
      : null,
  }
}

async function observeCell(spec: ThinCellSpec) {
  const requestedInput = buildInput(spec)
  try {
    const result = await runGeneratePlan(requestedInput, {
      seedVenues: sanJoseVenues,
      sourceMode: 'curated',
      sourceModeOverrideApplied: true,
      includePlaceRightDiagnosticCounterfactuals: true,
      debugMode: false,
    })
    const greatStop = result.trace.greatStopGateResult
    assert(greatStop, `${spec.cell} generation trace must expose formal Great Stop result.`)
    const lockTruth = buildContractEntryRuntimeRouteLockTruth({
      artifact: result.contractEntryArtifact,
      itinerary: result.itinerary,
      scoredVenues: result.scoredVenues,
      selectedDirectionId: result.intentProfile.selectedDirectionContext?.directionId ?? 'thin-build',
      selectedClusterConfirmation: `${spec.cell} THIN route`,
      city: result.itinerary.city,
      persona: result.intentProfile.persona ?? spec.persona,
      vibe: result.intentProfile.primaryAnchor,
      mode: 'build',
    })

    return {
      cell: spec.cell,
      status: 'COMPLETED',
      proofType: 'current_generation_plus_formal_great_stop_gate',
      requestedPreset: {
        mode: 'build',
        persona: spec.persona,
        primaryVibe: spec.primaryVibe,
        secondaryVibe: spec.secondaryVibe ?? null,
        city: 'San Jose',
        district: spec.district,
        distanceMode: spec.distanceMode,
        requiredAnchor: spec.anchorVenueId,
        requiredRole: 'highlight',
        expectedLocationClass: spec.locationClass,
      },
      interpretationProjection: {
        persona: result.intentProfile.persona,
        primaryVibe: result.intentProfile.primaryAnchor,
        secondaryVibe: result.intentProfile.secondaryAnchor ?? null,
        selectedDirectionId: result.intentProfile.selectedDirectionContext?.directionId ?? null,
        selectedPocketId: result.intentProfile.selectedDirectionContext?.pocketId ?? null,
      },
      attemptedRoute: {
        selectedArcId: result.selectedArc.id,
        stopCount: result.selectedArc.stops.length,
        orderedRoles: result.selectedArc.stops.map((stop) => stop.role),
        orderedCanonicalVenueIds: result.selectedArc.stops.map(getArcStopBaseVenueId),
        orderedNames: result.selectedArc.stops.map((stop) => stop.scoredVenue.venue.name),
        selectedHighlight:
          result.selectedArc.stops.find((stop) => stop.role === 'peak')?.scoredVenue.venue.id ?? null,
        requiredAnchorSurvival: greatStop.requiredAnchor ?? null,
      },
      ownerVerdicts: ownerVerdictsFromGate(greatStop),
      softHardClassification: classifySoftHard(greatStop.reasons, greatStop.diagnostics),
      decisiveKiller: primaryResult({ gate: greatStop, diagnostics: result.trace.greatStopGateSelectionDiagnostics }),
      greatStop: {
        status: greatStop.status,
        failedCriteria: greatStop.failedCriteria,
        reasons: greatStop.reasons,
        routeId: greatStop.routeId,
        preset: greatStop.preset,
          diagnostics: greatStop.diagnostics,
          placeRightDiagnosticCounterfactuals:
            greatStop.diagnostics.placeRightDiagnosticCounterfactuals
              ? {
                  allClausesEnforced: {
                    status:
                      greatStop.diagnostics.placeRightDiagnosticCounterfactuals
                        .allClausesEnforced.status,
                    reasons:
                      greatStop.diagnostics.placeRightDiagnosticCounterfactuals
                        .allClausesEnforced.reasons,
                    supportWorldDiagnostics:
                      greatStop.diagnostics.placeRightDiagnosticCounterfactuals
                        .allClausesEnforced.supportWorldDiagnostics ?? null,
                  },
                  softClausesObserveOnly: {
                    status:
                      greatStop.diagnostics.placeRightDiagnosticCounterfactuals
                        .softClausesObserveOnly.status,
                    reasons:
                      greatStop.diagnostics.placeRightDiagnosticCounterfactuals
                        .softClausesObserveOnly.reasons,
                    supportWorldDiagnostics:
                      greatStop.diagnostics.placeRightDiagnosticCounterfactuals
                        .softClausesObserveOnly.supportWorldDiagnostics ?? null,
                  },
                }
              : null,
        },
      selectionDiagnostics: summarizeSelectionDiagnostics(result.trace.greatStopGateSelectionDiagnostics),
      lockAuthority: {
        evaluated: true,
        lockable: lockTruth.ok,
        lockRejectionReason: lockTruth.ok ? null : lockTruth.reason,
      },
      counterfactualAuthorityBoundary:
        'No counterfactual is emitted as ContractEntryArtifact, RuntimeRouteArtifact, Review, Lock, save, or route authority truth.',
    }
  } catch (error) {
    if (error instanceof GreatStopGateSelectionError) {
      const diagnostics = error.greatStopGateSelectionDiagnostics
      const selectedGate = diagnostics.selectedGateResult
      return {
        cell: spec.cell,
        status: 'GREAT_STOP_SELECTION_FAILED',
        proofType: 'current_generation_plus_formal_great_stop_gate',
        requestedPreset: {
          mode: 'build',
          persona: spec.persona,
          primaryVibe: spec.primaryVibe,
          secondaryVibe: spec.secondaryVibe ?? null,
          city: 'San Jose',
          district: spec.district,
          distanceMode: spec.distanceMode,
          requiredAnchor: spec.anchorVenueId,
          requiredRole: 'highlight',
          expectedLocationClass: spec.locationClass,
        },
        interpretationProjection:
          'Generation aborted before PlanResult was returned; requested IntentInput above is the production input consumed by runGeneratePlan.',
        attemptedRoute: routeFromIdentitySummary(diagnostics.evaluatedCandidateIdentitySummaries?.[0]),
        strongestRejectedExactRoute:
          routeFromFailureDetail(diagnostics.greatStopCandidateFailureDetails?.nearestToPassCandidate) ??
          routeFromIdentitySummary(diagnostics.evaluatedCandidateIdentitySummaries?.[0]),
        ownerVerdicts: ownerVerdictsFromGate(selectedGate),
        softHardClassification: classifySoftHard(diagnostics.failureReasons, selectedGate?.diagnostics),
        decisiveKiller: primaryResult({ diagnostics }),
        greatStop: {
          status: diagnostics.status,
          stage: diagnostics.stage,
          failedTopCandidateCriteria: diagnostics.failedTopCandidateCriteria ?? [],
          failureReasons: diagnostics.failureReasons,
          selectedGateResult: selectedGate
            ? {
                status: selectedGate.status,
                failedCriteria: selectedGate.failedCriteria,
                reasons: selectedGate.reasons,
                routeId: selectedGate.routeId,
                requiredAnchor: selectedGate.requiredAnchor ?? null,
                preset: selectedGate.preset,
                diagnostics: selectedGate.diagnostics,
                placeRightDiagnosticCounterfactuals:
                  selectedGate.diagnostics.placeRightDiagnosticCounterfactuals
                    ? {
                        allClausesEnforced: {
                          status:
                            selectedGate.diagnostics.placeRightDiagnosticCounterfactuals
                              .allClausesEnforced.status,
                          reasons:
                            selectedGate.diagnostics.placeRightDiagnosticCounterfactuals
                              .allClausesEnforced.reasons,
                          supportWorldDiagnostics:
                            selectedGate.diagnostics.placeRightDiagnosticCounterfactuals
                              .allClausesEnforced.supportWorldDiagnostics ?? null,
                        },
                        softClausesObserveOnly: {
                          status:
                            selectedGate.diagnostics.placeRightDiagnosticCounterfactuals
                              .softClausesObserveOnly.status,
                          reasons:
                            selectedGate.diagnostics.placeRightDiagnosticCounterfactuals
                              .softClausesObserveOnly.reasons,
                          supportWorldDiagnostics:
                            selectedGate.diagnostics.placeRightDiagnosticCounterfactuals
                              .softClausesObserveOnly.supportWorldDiagnostics ?? null,
                        },
                      }
                    : null,
              }
            : null,
        },
        selectionDiagnostics: summarizeSelectionDiagnostics(diagnostics),
        candidateSupplyFunnel: {
          rankedCandidateCount: diagnostics.rankedCandidateCount ?? null,
          evaluatedCandidateCount: diagnostics.evaluatedCandidateCount,
          fullEvaluatedCandidateCount: diagnostics.fullEvaluatedCandidateCount ?? null,
          passingCandidateCount: diagnostics.passingCandidateCount ?? null,
          anchorPreservingCandidateCount: diagnostics.anchorPreservingCandidateCount ?? null,
          rolePools: diagnostics.rolePoolIdentityDiagnostics ?? null,
        },
        alternativeShapeEvaluation: {
          evaluatedThroughExistingOwnerAuthorities:
            diagnostics.greatStopCandidateFailureDetails?.topFailingCandidates.map(routeFromFailureDetail) ?? [],
          compactnessDiagnosticsOnly:
            diagnostics.compactnessRankingDiagnostics?.buildCandidatePoolCompactnessDiagnostics
              ? {
                  nearestPreTop40CompactCandidate: compactAlternative(
                    diagnostics.compactnessRankingDiagnostics.buildCandidatePoolCompactnessDiagnostics
                      .nearestPreTop40CompactCandidate,
                  ),
                  nearestPreTop40PlaceRightCandidate: compactAlternative(
                    diagnostics.compactnessRankingDiagnostics.buildCandidatePoolCompactnessDiagnostics
                      .nearestPreTop40PlaceRightCandidate,
                  ),
                  bestPreTop40NearCompactCandidate: compactAlternative(
                    diagnostics.compactnessRankingDiagnostics.buildCandidatePoolCompactnessDiagnostics
                      .bestPreTop40NearCompactCandidate,
                  ),
                  topPreTop40MovementCandidates:
                    diagnostics.compactnessRankingDiagnostics.buildCandidatePoolCompactnessDiagnostics
                      .topPreTop40MovementCandidates.map(compactAlternative),
                }
              : null,
          passingAlternativeExistsUnderCurrentPolicy: (diagnostics.passingCandidateCount ?? 0) > 0,
          placeRightCapableDiagnosticAlternatives:
            diagnostics.compactnessRankingDiagnostics?.buildCandidatePoolCompactnessDiagnostics
              ?.postTop40PlaceRightCandidateCount ?? 0,
        },
        lockAuthority: {
          evaluated: false,
          lockable: false,
          lockRejectionReason: 'great_stop_failed_before_contract_entry_artifact',
        },
        counterfactualAuthorityBoundary:
          'Failure diagnostics and alternatives are diagnostic-only; no failed or counterfactual route is emitted as ContractEntryArtifact, RuntimeRouteArtifact, Review, Lock, save, or route authority truth.',
      }
    }
    return {
      cell: spec.cell,
      status: 'UNEXPECTED_ERROR',
      proofType: 'current_generation_plus_formal_great_stop_gate',
      requestedPreset: {
        mode: 'build',
        persona: spec.persona,
        primaryVibe: spec.primaryVibe,
        secondaryVibe: spec.secondaryVibe ?? null,
        city: 'San Jose',
        district: spec.district,
        distanceMode: spec.distanceMode,
        requiredAnchor: spec.anchorVenueId,
        requiredRole: 'highlight',
        expectedLocationClass: spec.locationClass,
      },
      error: error instanceof Error ? error.stack ?? error.message : String(error),
      decisiveKiller: 'UNKNOWN - unexpected_observer_error' satisfies DiagnosticPrimaryResult,
      lockAuthority: {
        evaluated: false,
        lockable: false,
        lockRejectionReason: 'observer_error_no_authority_emitted',
      },
    }
  }
}

try {
  const observed = []
  for (const spec of cells) {
    observed.push(await observeCell(spec))
  }

  assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)

  const status = observed.every((entry) => entry.status === 'COMPLETED' && entry.ownerVerdicts.aggregate === 'PASS')
    ? 'PASS'
    : 'CHARACTERIZED'

  process.stdout.write(
    `${JSON.stringify(
      {
        observer: 'thin_cells_formal_great_stop',
        status,
        proofType: 'generation_based_diagnostic_only',
        formalFiveCriteriaGateRun: true,
        providerCalls: fetchCallCount,
        sourceMode: 'curated_static_only',
        productionSeam:
          'runGeneratePlan -> selectGreatStopGatePassingCandidate -> buildGreatStopGateResult',
        authorityBoundary:
          'Counterfactual and failed candidates remain observer output only and are never passed to Review, Lock, save, RuntimeRouteArtifact, or routeAuthority.',
        cells: observed,
      },
      null,
      2,
    )}\n`,
  )
} finally {
  globalThis.fetch = originalFetch
}
