import {
  approveFinalRouteCandidate,
  type FinalRouteApprovalDiagnostics,
  type FinalRouteApprovalRefusalOwner,
  type FinalRouteApprovalResult,
} from '../../../domain/routeApproval/approveFinalRouteCandidate'
import type { ArcCandidate } from '../../../domain/types/arc'
import type { CrewPolicy } from '../../../domain/types/crewPolicies'
import type { ExperienceLens } from '../../../domain/types/experienceLens'
import type { BuildLocationClass } from '../../../domain/types/greatStopGate'
import type { IntentProfile, RouteShapeContract } from '../../../domain/types/intent'
import type { UserStopRole } from '../../../domain/types/itinerary'

export type FormalSwapFinalRouteApprovalRefusalOwner = FinalRouteApprovalRefusalOwner
export type FormalSwapFinalRouteApprovalDiagnostics = FinalRouteApprovalDiagnostics

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
    routeShapeProjectionId: routeShapeContract.interpretationC1Projection?.projectionId,
    tasteReasonCodes: [],
    proposedRouteSignature: proposedCandidate.stops
      .map((stop) => `${stop.role}:${stop.scoredVenue.candidateIdentity.candidateId}`)
      .join('|'),
    bearingsReasonCodes: [],
  }

  if (params.targetRole !== 'start' && params.targetRole !== 'windDown') {
    return reject({
      refusalOwner: 'application',
      reason: 'formal_swap_role_not_authorized_in_slice_5b',
      diagnostics: baseDiagnostics,
    })
  }

  return approveFinalRouteCandidate({
    source: 'app.services.sandbox.formalSwapFinalRouteApproval',
    targetRole: params.targetRole,
    proposedCandidate,
    intent: params.intent,
    crewPolicy: params.crewPolicy,
    lens: params.lens,
    routeShapeContract,
    locationClass: params.locationClass,
  }) as FormalSwapFinalRouteApprovalResult
}
