import { scoreArcAssembly } from '../../../domain/arc/scoreArcAssembly'
import { buildRoutePlaceRightVerdictForArcCandidate } from '../../../domain/bearings/buildRoutePlaceRightVerdictForArcCandidate'
import { computeFieldRealVerdictForArcCandidate } from '../../../domain/field/computeFieldRealVerdict'
import { selectGreatStopGatePassingCandidate } from '../../../domain/greatStop/buildGreatStopGateResult'
import { selectWaypointC1ApprovalCandidates } from '../../../domain/waypoint/selectWaypointC1ApprovalCandidates'
import { projectRouteShapeOwnership } from '../../../integrations/waypoint/coordination/projectRouteShapeOwnership'
import type { ArcCandidate } from '../../../domain/types/arc'
import type { CrewPolicy } from '../../../domain/types/crewPolicies'
import type { ExperienceLens } from '../../../domain/types/experienceLens'
import type { BuildLocationClass, GreatStopGateSelectionDiagnostics } from '../../../domain/types/greatStopGate'
import type { IntentProfile, RouteShapeContract } from '../../../domain/types/intent'
import type { UserStopRole } from '../../../domain/types/itinerary'
import type { WaypointC1ApprovalDiagnostics } from '../../../domain/waypoint/selectWaypointC1ApprovalCandidates'

export type FormalSwapFinalRouteApprovalRefusalOwner =
  | 'application'
  | 'taste'
  | 'bearings'
  | 'waypoint'
  | 'great_stop'

export interface FormalSwapFinalRouteApprovalDiagnostics {
  source: 'app.services.sandbox.formalSwapFinalRouteApproval'
  targetRole: UserStopRole
  proposedCandidateId: string
  assessedCandidateId?: string
  routeShapeContractId: string
  tasteRequirementSource?: string
  tasteStatus?: string
  tasteReasonCodes: string[]
  waypointC1Approval?: WaypointC1ApprovalDiagnostics
  bearingsStatus?: string
  bearingsReasonCodes: string[]
  greatStop?: GreatStopGateSelectionDiagnostics
}

export type FormalSwapFinalRouteApprovalResult =
  | {
      status: 'approved'
      approvedCandidate: ArcCandidate
      diagnostics: FormalSwapFinalRouteApprovalDiagnostics
    }
  | {
      status: 'rejected'
      refusalOwner: FormalSwapFinalRouteApprovalRefusalOwner
      reason: string
      diagnostics: FormalSwapFinalRouteApprovalDiagnostics
    }

export interface FormalSwapFinalRouteApprovalParams {
  targetRole: UserStopRole
  proposedCandidate: ArcCandidate
  intent: IntentProfile
  crewPolicy: CrewPolicy
  lens: ExperienceLens
  routeShapeContract: RouteShapeContract
  locationClass?: BuildLocationClass
}

function reject(params: {
  refusalOwner: FormalSwapFinalRouteApprovalRefusalOwner
  reason: string
  diagnostics: FormalSwapFinalRouteApprovalDiagnostics
}): FormalSwapFinalRouteApprovalResult {
  return {
    status: 'rejected',
    refusalOwner: params.refusalOwner,
    reason: params.reason,
    diagnostics: params.diagnostics,
  }
}

export function approveFormalSwapFinalRoute(
  params: FormalSwapFinalRouteApprovalParams,
): FormalSwapFinalRouteApprovalResult {
  const { proposedCandidate, routeShapeContract } = params
  const baseDiagnostics: FormalSwapFinalRouteApprovalDiagnostics = {
    source: 'app.services.sandbox.formalSwapFinalRouteApproval',
    targetRole: params.targetRole,
    proposedCandidateId: proposedCandidate.id,
    routeShapeContractId: routeShapeContract.id,
    tasteReasonCodes: [],
    bearingsReasonCodes: [],
  }

  if (params.targetRole !== 'start' && params.targetRole !== 'windDown') {
    return reject({
      refusalOwner: 'application',
      reason: 'formal_swap_role_not_authorized_in_slice_5b',
      diagnostics: baseDiagnostics,
    })
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
  const tasteDiagnostics: FormalSwapFinalRouteApprovalDiagnostics = {
    ...baseDiagnostics,
    assessedCandidateId: assessedCandidate.id,
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
  const waypointDiagnostics: FormalSwapFinalRouteApprovalDiagnostics = {
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
  const bearingsDiagnostics: FormalSwapFinalRouteApprovalDiagnostics = {
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
  const greatStopDiagnostics: FormalSwapFinalRouteApprovalDiagnostics = {
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
    diagnostics: greatStopDiagnostics,
  }
}
