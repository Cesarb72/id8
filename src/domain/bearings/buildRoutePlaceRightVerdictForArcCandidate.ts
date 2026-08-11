import type { ArcCandidate, ArcStop } from '../types/arc'
import type { RoutePacingDiagnostics } from '../types/diagnostics'
import type { IntentProfile, RouteShapePlaceRightMovementProfile } from '../types/intent'
import { getArcStopBaseVenueId } from '../candidates/candidateIdentity'
import { buildDistrictRoutePlaceFactsForArcCandidate } from '../interpretation/district/routePlaceFacts'
import { evaluateRoutePlaceRightEvidence } from './evaluateRoutePlaceRightEvidence'
import { getSpatialMode } from '../types/spatial'
import type {
  BearingsDistanceTransitionFact,
  BearingsMovementContractFacts,
  BearingsPlaceRightDiagnosticCounterfactuals,
  BearingsPlaceRightVerdict,
  BearingsRouteFeasibilityInput,
  BearingsRouteStopRole,
  DistrictRoutePlaceFacts,
} from './routePlaceRightContract'

export type BuildPlaceRightRecoveryClassification =
  | 'SOFT_FEASIBLE'
  | 'HARD_INFEASIBLE'
  | 'NOT_PLACE_RIGHT_FAILURE'
  | 'INSUFFICIENT_EVIDENCE'

export interface BuildPlaceRightRecoveryEvidence {
  classification: BuildPlaceRightRecoveryClassification
  reasonCodes: string[]
  hardReasonCodes: string[]
  softReasonCodes: string[]
  requiredAnchorSurvived: boolean | null
  softClausesObserveOnlyPassed: boolean
  supportWorldBuildableWithSoftObserved: boolean | null
}

function routeRoleFor(stop: ArcStop): BearingsRouteStopRole {
  if (stop.role === 'warmup') return 'start'
  if (stop.role === 'peak') return 'highlight'
  if (stop.role === 'cooldown') return 'windDown'
  if (stop.role === 'wildcard') return 'wildcard'
  return 'unknown'
}

function transitionPosture(
  movementMode: RoutePacingDiagnostics['transitions'][number]['movementMode'],
): BearingsDistanceTransitionFact['travelPosture'] {
  if (movementMode === 'walkable') return 'walkable'
  if (movementMode === 'short-drive') return 'limited_drive'
  if (movementMode === 'drive') return 'drive_like'
  return 'unknown'
}

function movementContractFor(params: {
  intent: IntentProfile
  locationClass?: 'L1 Dense' | 'L2 Mid' | 'L3 Sparse'
  placeRightTolerance?: RouteShapePlaceRightMovementProfile
}): BearingsMovementContractFacts {
  if (params.placeRightTolerance) {
    const tolerance = params.placeRightTolerance
    return {
      tolerance: tolerance.travelTolerance === 'expanded' ? 'flexible' : 'contained',
      travelPosture:
        tolerance.driveLikeMovement === 'acceptable'
          ? 'limited_drive'
          : tolerance.driveLikeMovement === 'limited'
            ? 'limited_drive'
            : 'walkable',
      spatialMode: tolerance.travelTolerance === 'expanded' ? 'flexible' : 'walkable',
      requireContinuity: tolerance.travelTolerance !== 'expanded',
      reasonCodes: [...tolerance.reasonCodes],
    }
  }
  if (params.locationClass === 'L3 Sparse') {
    return {
      tolerance: 'flexible',
      travelPosture: 'limited_drive',
      spatialMode: 'flexible',
      requireContinuity: false,
      reasonCodes: [],
    }
  }
  if (params.locationClass === 'L1 Dense') {
    return {
      tolerance: 'contained',
      travelPosture: 'walkable',
      spatialMode: 'walkable',
      requireContinuity: true,
      reasonCodes: [],
    }
  }
  const intent = params.intent
  if (intent.distanceMode === 'nearby') {
    return {
      tolerance: 'contained',
      travelPosture: 'walkable',
      spatialMode: getSpatialMode(intent.distanceMode),
      requireContinuity: true,
      reasonCodes: [],
    }
  }
  return {
    tolerance: 'compressed',
    travelPosture: 'limited_drive',
    spatialMode: getSpatialMode(intent.distanceMode),
    requireContinuity: false,
    reasonCodes: [],
  }
}

function buildRoutePlaceRightInput(params: {
  candidate: ArcCandidate
  intent: IntentProfile
  routePacing: RoutePacingDiagnostics
  locationClass?: 'L1 Dense' | 'L2 Mid' | 'L3 Sparse'
  districtFacts: DistrictRoutePlaceFacts
  placeRightTolerance?: RouteShapePlaceRightMovementProfile
}): BearingsRouteFeasibilityInput {
  const { candidate, intent, routePacing, districtFacts } = params
  const requiredAnchorBaseVenueId = intent.anchor?.venueId
  const transitions = routePacing.transitions.map((transition, index) => {
    const fromStop = candidate.stops[index]
    const toStop = candidate.stops[index + 1]
    return {
      fromBaseVenueId: fromStop ? getArcStopBaseVenueId(fromStop) : transition.fromVenueId,
      toBaseVenueId: toStop ? getArcStopBaseVenueId(toStop) : transition.toVenueId,
      estimatedTransitionMinutes: transition.estimatedTransitionMinutes,
      travelPosture: transitionPosture(transition.movementMode),
      evidenceSource: 'route_pacing_diagnostics',
    }
  })
  const localSupplyInsufficient = candidate.scoreBreakdown.localSupplySufficient === false
  const strongerNearbyishMoment = (candidate.scoreBreakdown.boundedStretchMeaningfulCount ?? 0) > 0
  const boundedStretchRespected =
    candidate.scoreBreakdown.stretchedCandidateDistanceStatus ===
    'outside nearby but within bounded stretch'
  const stretchApplied = candidate.scoreBreakdown.stretchApplied === true
  const stretchedStop = candidate.stops.find(
    (stop) => stop.scoredVenue.venue.name === candidate.scoreBreakdown.stretchedCandidateName,
  )
  const tasteStretchEvidence =
    stretchApplied ||
    localSupplyInsufficient ||
    strongerNearbyishMoment ||
    candidate.scoreBreakdown.strictNearbyFailed === true
      ? [
          {
            baseVenueId:
              stretchedStop?.scoredVenue.candidateIdentity.baseVenueId ??
              stretchedStop?.scoredVenue.venue.id ??
              candidate.id,
            stretchWorthiness:
              stretchApplied && boundedStretchRespected ? ('worth_it' as const) : ('unknown' as const),
            source: 'taste' as const,
            localSupplyInsufficient,
            strongerNearbyishMoment,
            boundedStretchRespected,
            stretchApplied,
            reasonCodes: candidate.scoreBreakdown.stretchReason
              ? [candidate.scoreBreakdown.stretchReason]
              : [],
          },
        ]
      : undefined

  return {
    routeId: candidate.id,
    candidateId: candidate.id,
    districtFacts,
    roleFacts: candidate.stops.map((stop) => {
      const baseVenueId = getArcStopBaseVenueId(stop)
      return {
        baseVenueId,
        routeRole: routeRoleFor(stop),
        requiredRole: baseVenueId === requiredAnchorBaseVenueId ? intent.anchor?.role : undefined,
        isRequiredStop: baseVenueId === requiredAnchorBaseVenueId,
        isSelectedAnchor: baseVenueId === requiredAnchorBaseVenueId,
        isPeakCandidate: stop.role === 'peak',
      }
    }),
    requiredStopFacts: requiredAnchorBaseVenueId
      ? [
          {
            baseVenueId: requiredAnchorBaseVenueId,
            requiredRole: intent.anchor?.role ?? 'unknown',
            survivalRequired: true,
            source: 'build_anchor',
          },
        ]
      : [],
    openClosedFacts: candidate.stops.map((stop) => ({
      baseVenueId: getArcStopBaseVenueId(stop),
      status: stop.scoredVenue.venue.isActive === false ? 'closed' : 'open',
      confidence: 1,
    })),
    distanceFacts: {
      totalEstimatedTransitionMinutes: routePacing.estimatedTransitionMinutes,
      maxSingleTransitionMinutes: transitions.reduce(
        (max, transition) => Math.max(max, transition.estimatedTransitionMinutes ?? 0),
        0,
      ),
      transitions,
      reasonCodes: [],
    },
    movementContract: movementContractFor({
      intent,
      locationClass: params.locationClass,
      placeRightTolerance: params.placeRightTolerance,
    }),
    supportSupplyFacts: districtFacts.anchorSupportRelationships.map((relationship) => ({
      role: 'support',
      anchorBaseVenueId: relationship.anchorBaseVenueId,
      nearbyCandidateCount: relationship.sameNeighborhoodSupportCount,
      supportSupplyMissing: (relationship.sameNeighborhoodSupportCount ?? 0) === 0,
      reasonCodes: [],
    })),
    tasteStretchEvidence,
  }
}

export function buildRoutePlaceRightVerdictForArcCandidate(params: {
  candidate: ArcCandidate
  intent: IntentProfile
  routePacing: RoutePacingDiagnostics
  locationClass?: 'L1 Dense' | 'L2 Mid' | 'L3 Sparse'
  placeRightTolerance?: RouteShapePlaceRightMovementProfile
  includeDiagnosticCounterfactuals?: boolean
}): BearingsPlaceRightVerdict {
  const districtFacts = buildDistrictRoutePlaceFactsForArcCandidate({
    candidate: params.candidate,
    requiredStopBaseVenueIds: params.intent.anchor?.venueId ? [params.intent.anchor.venueId] : [],
  })
  const input = buildRoutePlaceRightInput({
    candidate: params.candidate,
    intent: params.intent,
    routePacing: params.routePacing,
    locationClass: params.locationClass,
    districtFacts,
    placeRightTolerance: params.placeRightTolerance,
  })
  const productionVerdict = evaluateRoutePlaceRightEvidence(input)
  if (!params.includeDiagnosticCounterfactuals) {
    return productionVerdict
  }
  return {
    ...productionVerdict,
    diagnosticCounterfactuals: {
      allClausesEnforced: evaluateRoutePlaceRightEvidence(input, {
        softClauseMode: 'enforce',
        hardClauseMode: 'enforce',
      }),
      softClausesObserveOnly: evaluateRoutePlaceRightEvidence(input, {
        softClauseMode: 'observe_only',
        hardClauseMode: 'enforce',
      }),
    },
  }
}

export function buildRoutePlaceRightDiagnosticForArcCandidate(params: {
  candidate: ArcCandidate
  intent: IntentProfile
  routePacing: RoutePacingDiagnostics
  locationClass?: 'L1 Dense' | 'L2 Mid' | 'L3 Sparse'
  placeRightTolerance?: RouteShapePlaceRightMovementProfile
  softClauseMode: 'enforce' | 'observe_only'
}): BearingsPlaceRightVerdict {
  const districtFacts = buildDistrictRoutePlaceFactsForArcCandidate({
    candidate: params.candidate,
    requiredStopBaseVenueIds: params.intent.anchor?.venueId ? [params.intent.anchor.venueId] : [],
  })
  return evaluateRoutePlaceRightEvidence(
    buildRoutePlaceRightInput({
      candidate: params.candidate,
      intent: params.intent,
      routePacing: params.routePacing,
      locationClass: params.locationClass,
      districtFacts,
      placeRightTolerance: params.placeRightTolerance,
    }),
    {
      softClauseMode: params.softClauseMode,
      hardClauseMode: 'enforce',
    },
  )
}

function uniqueReasonCodes(values: readonly string[]): string[] {
  return [...new Set(values)]
}

function readSoftReasonCodes(
  counterfactuals: BearingsPlaceRightDiagnosticCounterfactuals,
): string[] {
  const supportWorld = counterfactuals.allClausesEnforced.supportWorldDiagnostics
  return uniqueReasonCodes([
    ...(supportWorld?.observedOnlyReasons ?? []),
    ...(supportWorld?.supplyFunnel.softRejectedCandidates.map((candidate) => candidate.reason) ?? []),
    ...counterfactuals.allClausesEnforced.reasons.filter((reason) =>
      reason === 'place_right:cluster_escape_structure' ||
      reason === 'place_right:scattered_neighborhoods' ||
      reason === 'place_right:poor_support_proximity' ||
      reason === 'place_right:backtrack_structure' ||
      reason === 'place_right:low_route_compactness',
    ),
  ])
}

export function classifyBuildPlaceRightRecoveryEvidence(params: {
  verdict?: BearingsPlaceRightVerdict | null
  requiredAnchorSurvived?: boolean | null
}): BuildPlaceRightRecoveryEvidence {
  const verdict = params.verdict
  const counterfactuals = verdict?.diagnosticCounterfactuals
  const hardReasonCodes = uniqueReasonCodes([
    ...(verdict?.supportWorldDiagnostics?.hardClausesEnforced ?? []),
    ...(verdict?.clauseAttribution?.hardFailureReasons ?? []),
  ])
  const requiredAnchorSurvived = params.requiredAnchorSurvived ?? null
  if (!verdict || !counterfactuals) {
    return {
      classification: 'INSUFFICIENT_EVIDENCE',
      reasonCodes: verdict?.reasons ?? [],
      hardReasonCodes,
      softReasonCodes: [],
      requiredAnchorSurvived,
      softClausesObserveOnlyPassed: false,
      supportWorldBuildableWithSoftObserved: null,
    }
  }
  return classifyBuildPlaceRightRecoveryCounterfactuals({
    counterfactuals,
    productionReasonCodes: verdict.reasons,
    requiredAnchorSurvived,
    productionStatus: verdict.status,
    hardReasonCodes,
  })
}

export function classifyBuildPlaceRightRecoveryCounterfactuals(params: {
  counterfactuals?: BearingsPlaceRightDiagnosticCounterfactuals | null
  productionReasonCodes?: readonly string[]
  requiredAnchorSurvived?: boolean | null
  productionStatus?: BearingsPlaceRightVerdict['status']
  hardReasonCodes?: readonly string[]
}): BuildPlaceRightRecoveryEvidence {
  const counterfactuals = params.counterfactuals
  const requiredAnchorSurvived = params.requiredAnchorSurvived ?? null
  if (!counterfactuals) {
    return {
      classification: 'INSUFFICIENT_EVIDENCE',
      reasonCodes: [...(params.productionReasonCodes ?? [])],
      hardReasonCodes: [...(params.hardReasonCodes ?? [])],
      softReasonCodes: [],
      requiredAnchorSurvived,
      softClausesObserveOnlyPassed: false,
      supportWorldBuildableWithSoftObserved: null,
    }
  }
  const softObserveOnly = counterfactuals.softClausesObserveOnly
  const softClausesObserveOnlyPassed =
    softObserveOnly.placeRightReady === true && softObserveOnly.status === 'pass'
  const supportWorldBuildableWithSoftObserved =
    softObserveOnly.supportWorldDiagnostics?.supplyFunnel.finalSupportWorld.buildable ?? null
  const softReasonCodes = readSoftReasonCodes(counterfactuals)
  const anchorHardFailed = requiredAnchorSurvived === false
  const hardPlaceRightFailed =
    softObserveOnly.status === 'fail' ||
    (supportWorldBuildableWithSoftObserved === false &&
      (softObserveOnly.supportWorldDiagnostics?.supplyFunnel.finalSupportWorld.reasonCodes ?? [])
        .some((reason) => !softReasonCodes.includes(reason)))
  const productionStatus = params.productionStatus ?? counterfactuals.allClausesEnforced.status
  const classification =
    productionStatus === 'pass'
      ? 'NOT_PLACE_RIGHT_FAILURE'
      : anchorHardFailed || hardPlaceRightFailed
        ? 'HARD_INFEASIBLE'
        : softClausesObserveOnlyPassed
          ? 'SOFT_FEASIBLE'
          : 'INSUFFICIENT_EVIDENCE'
  return {
    classification,
    reasonCodes: [...(params.productionReasonCodes ?? counterfactuals.allClausesEnforced.reasons)],
    hardReasonCodes: [...(params.hardReasonCodes ?? [])],
    softReasonCodes,
    requiredAnchorSurvived,
    softClausesObserveOnlyPassed,
    supportWorldBuildableWithSoftObserved,
  }
}
