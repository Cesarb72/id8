import { scoreArcAssembly } from '../arc/scoreArcAssembly'
import { buildRoutePlaceRightVerdictForArcCandidate } from '../bearings/buildRoutePlaceRightVerdictForArcCandidate'
import { computeFieldRealVerdictForArcCandidate } from '../field/computeFieldRealVerdict'
import { selectGreatStopGatePassingCandidate } from '../greatStop/buildGreatStopGateResult'
import { selectWaypointC1ApprovalCandidates } from '../waypoint/selectWaypointC1ApprovalCandidates'
import { projectRouteShapeOwnership } from '../../integrations/waypoint/coordination/projectRouteShapeOwnership'
import type { ArcCandidate } from '../types/arc'
import type { CrewPolicy } from '../types/crewPolicies'
import type { ExperienceLens } from '../types/experienceLens'
import type { BuildLocationClass, GreatStopGateSelectionDiagnostics } from '../types/greatStopGate'
import type { IntentProfile, RouteShapeContract } from '../types/intent'
import type { UserStopRole } from '../types/itinerary'
import type { WaypointC1ApprovalDiagnostics } from '../waypoint/selectWaypointC1ApprovalCandidates'

export type FinalRouteApprovalRefusalOwner =
  | 'application'
  | 'taste'
  | 'bearings'
  | 'waypoint'
  | 'great_stop'

export interface FinalRouteApprovalDiagnostics {
  source: string
  targetRole?: UserStopRole
  proposedCandidateId: string
  assessedCandidateId?: string
  routeShapeContractId: string
  routeShapeProjectionId?: string
  tasteRequirementSource?: string
  tasteStatus?: string
  tasteReasonCodes: string[]
  proposedRouteSignature: string
  assessedRouteSignature?: string
  approvedRouteSignature?: string
  waypointC1Approval?: WaypointC1ApprovalDiagnostics
  bearingsStatus?: string
  bearingsReasonCodes: string[]
  greatStop?: GreatStopGateSelectionDiagnostics
}

export type FinalRouteApprovalResult =
  | {
      status: 'approved'
      approvedCandidate: ArcCandidate
      diagnostics: FinalRouteApprovalDiagnostics
    }
  | {
      status: 'rejected'
      refusalOwner: FinalRouteApprovalRefusalOwner
      reason: string
      diagnostics: FinalRouteApprovalDiagnostics
    }

export interface FinalRouteApprovalParams {
  source: string
  targetRole?: UserStopRole
  proposedCandidate: ArcCandidate
  intent: IntentProfile
  crewPolicy: CrewPolicy
  lens: ExperienceLens
  routeShapeContract: RouteShapeContract
  locationClass?: BuildLocationClass
}

function candidateSignature(candidate: ArcCandidate): string {
  return candidate.stops
    .map((stop) => `${stop.role}:${stop.scoredVenue.candidateIdentity.candidateId}`)
    .join('|')
}

function reject(params: {
  refusalOwner: FinalRouteApprovalRefusalOwner
  reason: string
  diagnostics: FinalRouteApprovalDiagnostics
}): FinalRouteApprovalResult {
  return {
    status: 'rejected',
    refusalOwner: params.refusalOwner,
    reason: params.reason,
    diagnostics: params.diagnostics,
  }
}

export function approveFinalRouteCandidate(
  params: FinalRouteApprovalParams,
): FinalRouteApprovalResult {
  const { proposedCandidate, routeShapeContract } = params
  const baseDiagnostics: FinalRouteApprovalDiagnostics = {
    source: params.source,
    targetRole: params.targetRole,
    proposedCandidateId: proposedCandidate.id,
    routeShapeContractId: routeShapeContract.id,
    routeShapeProjectionId: routeShapeContract.interpretationC1Projection?.projectionId,
    tasteReasonCodes: [],
    proposedRouteSignature: candidateSignature(proposedCandidate),
    bearingsReasonCodes: [],
  }

  const scored = scoreArcAssembly(
    proposedCandidate.stops,
    params.intent,
    params.crewPolicy,
    params.lens,
    undefined,
    { routeShapeContract },
  )
  const assessedCandidate: ArcCandidate = {
    ...proposedCandidate,
    ...scored,
  }
  const tasteStamp = assessedCandidate.scoreBreakdown.experienceCompositionStamp
  const tasteDiagnostics: FinalRouteApprovalDiagnostics = {
    ...baseDiagnostics,
    assessedCandidateId: assessedCandidate.id,
    assessedRouteSignature: candidateSignature(assessedCandidate),
    tasteRequirementSource: tasteStamp?.requirementSource,
    tasteStatus: tasteStamp?.status,
    tasteReasonCodes: [...(tasteStamp?.reasons ?? []), ...(tasteStamp?.unavailableEvidence ?? [])],
  }
  if (!tasteStamp || tasteStamp.status === 'fail' || tasteStamp.status === 'unavailable') {
    return reject({
      refusalOwner: 'taste',
      reason: tasteStamp?.status ? `c1_taste_${tasteStamp.status}` : 'c1_taste_stamp_missing',
      diagnostics: tasteDiagnostics,
    })
  }

  const waypointC1Approval = selectWaypointC1ApprovalCandidates({
    candidates: [assessedCandidate],
    routeShapeContract,
  })
  const waypointDiagnostics: FinalRouteApprovalDiagnostics = {
    ...tasteDiagnostics,
    waypointC1Approval: waypointC1Approval.diagnostics,
  }
  const waypointApprovedCandidate = waypointC1Approval.candidates[0]
  if (!waypointApprovedCandidate) {
    return reject({
      refusalOwner: 'waypoint',
      reason:
        waypointC1Approval.diagnostics.failureReasons[0] ??
        'waypoint_c1_final_route_ineligible',
      diagnostics: waypointDiagnostics,
    })
  }

  const placeRightVerdict = buildRoutePlaceRightVerdictForArcCandidate({
    candidate: waypointApprovedCandidate,
    intent: params.intent,
    routePacing: waypointApprovedCandidate.pacing,
    locationClass: params.locationClass,
  })
  const bearingsDiagnostics: FinalRouteApprovalDiagnostics = {
    ...waypointDiagnostics,
    bearingsStatus: placeRightVerdict.status,
    bearingsReasonCodes: [...placeRightVerdict.reasons],
  }
  if (!placeRightVerdict.placeRightReady || placeRightVerdict.status !== 'pass') {
    return reject({
      refusalOwner: 'bearings',
      reason: placeRightVerdict.reasons[0] ?? 'bearings_place_right_final_route_failed',
      diagnostics: bearingsDiagnostics,
    })
  }

  const routeShapeOwnership = projectRouteShapeOwnership({ routeShapeContract })
  const greatStopSelection = selectGreatStopGatePassingCandidate({
    candidates: [waypointApprovedCandidate],
    intent: params.intent,
    locationClass: params.locationClass,
    locationClassSource: params.locationClass ? 'explicit' : undefined,
    placeRightTolerance:
      routeShapeOwnership.bearingsMovementConstraints.placeRightTolerance,
    placeRightVerdictForCandidate: () => placeRightVerdict,
    fieldRealVerdictForCandidate: computeFieldRealVerdictForArcCandidate,
    stage: 'pre_selection_gate',
    rolePoolIdentityDiagnostics: {
      rolePoolBaseVenueIdsByRole: {},
      rolePoolVenueIdsByRole: {},
    },
  })
  const greatStopDiagnostics: FinalRouteApprovalDiagnostics = {
    ...bearingsDiagnostics,
    greatStop: greatStopSelection.diagnostics,
  }
  if (!greatStopSelection.selectedCandidate) {
    return reject({
      refusalOwner: 'great_stop',
      reason:
        greatStopSelection.diagnostics.failureReasons[0] ??
        'great_stop_final_route_approval_failed',
      diagnostics: greatStopDiagnostics,
    })
  }

  return {
    status: 'approved',
    approvedCandidate: greatStopSelection.selectedCandidate,
    diagnostics: {
      ...greatStopDiagnostics,
      approvedRouteSignature: candidateSignature(greatStopSelection.selectedCandidate),
    },
  }
}
