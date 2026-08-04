import type { TasteExperienceCompositionStamp } from '../interpretation/taste/computeExperienceCompositionStamp'
import type { ArcCandidate } from '../types/arc'
import type { RouteShapeContract } from '../types/intent'

export type WaypointC1ApprovalIneligibilityReason =
  | 'c1_stamp_missing'
  | 'c1_requirement_source_unavailable'
  | 'c1_route_shape_contract_mismatch'
  | 'c1_status_fail'
  | 'c1_status_unavailable'
  | 'c1_soft_not_authorized'

export interface WaypointC1ApprovalCandidateDiagnostic {
  rank: number
  candidateId: string
  signature: string
  totalScore: number
  requirementSource?: TasteExperienceCompositionStamp['requirementSource']
  routeShapeContractId?: string
  tasteStatus?: TasteExperienceCompositionStamp['status']
  tasteReasonCodes: string[]
  unavailableEvidence: string[]
  eligible: boolean
  ineligibilityReasons: WaypointC1ApprovalIneligibilityReason[]
}

export interface WaypointC1ApprovalDiagnostics {
  enforcementActive: boolean
  routeShapeContractId?: string
  projectionId?: string
  evaluatedCandidateCount: number
  eligibleCandidateCount: number
  ineligibleCandidateCount: number
  softAuthorizedByRequirement: boolean
  softAuthorizationSource: 'role_composition_requirement.minimumStatus' | 'none'
  selectedCandidateId?: string
  selectedCandidateRank?: number
  topCandidate?: WaypointC1ApprovalCandidateDiagnostic
  firstEligibleCandidate?: WaypointC1ApprovalCandidateDiagnostic
  ineligibleCandidateLimit: number
  ineligibleCandidates: WaypointC1ApprovalCandidateDiagnostic[]
  failureReasons: WaypointC1ApprovalIneligibilityReason[]
}

export interface WaypointC1ApprovalSelection {
  candidates: ArcCandidate[]
  diagnostics: WaypointC1ApprovalDiagnostics
}

function candidateSignature(candidate: ArcCandidate): string {
  return candidate.stops
    .map((stop) => `${stop.role}:${stop.scoredVenue.candidateIdentity.candidateId}`)
    .join('|')
}

function minimumStatusPermitsSoft(stamp: TasteExperienceCompositionStamp): boolean {
  const requirements = [
    stamp.startContribution.requirement,
    stamp.highlightContribution.requirement,
    stamp.windDownContribution.requirement,
  ]
  return requirements.every((requirement) => requirement?.minimumStatus === 'soft')
}

function c1ApprovalForCandidate(params: {
  candidate: ArcCandidate
  rank: number
  routeShapeContract: RouteShapeContract
}): WaypointC1ApprovalCandidateDiagnostic {
  const { candidate, rank, routeShapeContract } = params
  const stamp = candidate.scoreBreakdown.experienceCompositionStamp
  const ineligibilityReasons: WaypointC1ApprovalIneligibilityReason[] = []
  if (!stamp) {
    ineligibilityReasons.push('c1_stamp_missing')
  } else {
    if (stamp.requirementSource !== 'route_shape_contract') {
      ineligibilityReasons.push('c1_requirement_source_unavailable')
    }
    if (stamp.routeShapeContractId !== routeShapeContract.id) {
      ineligibilityReasons.push('c1_route_shape_contract_mismatch')
    }
    if (stamp.status === 'fail') {
      ineligibilityReasons.push('c1_status_fail')
    }
    if (stamp.status === 'unavailable') {
      ineligibilityReasons.push('c1_status_unavailable')
    }
    if (stamp.status === 'soft' && !minimumStatusPermitsSoft(stamp)) {
      ineligibilityReasons.push('c1_soft_not_authorized')
    }
  }

  return {
    rank,
    candidateId: candidate.id,
    signature: candidateSignature(candidate),
    totalScore: candidate.totalScore,
    requirementSource: stamp?.requirementSource,
    routeShapeContractId: stamp?.routeShapeContractId,
    tasteStatus: stamp?.status,
    tasteReasonCodes: [...(stamp?.reasons ?? [])],
    unavailableEvidence: [...(stamp?.unavailableEvidence ?? [])],
    eligible: ineligibilityReasons.length === 0,
    ineligibilityReasons,
  }
}

export function selectWaypointC1ApprovalCandidates(params: {
  candidates: readonly ArcCandidate[]
  routeShapeContract?: RouteShapeContract
  ineligibleCandidateLimit?: number
}): WaypointC1ApprovalSelection {
  const ineligibleCandidateLimit = params.ineligibleCandidateLimit ?? 8
  if (!params.routeShapeContract) {
    return {
      candidates: [...params.candidates],
      diagnostics: {
        enforcementActive: false,
        evaluatedCandidateCount: params.candidates.length,
        eligibleCandidateCount: params.candidates.length,
        ineligibleCandidateCount: 0,
        softAuthorizedByRequirement: false,
        softAuthorizationSource: 'none',
        selectedCandidateId: params.candidates[0]?.id,
        selectedCandidateRank: params.candidates.length > 0 ? 1 : undefined,
        ineligibleCandidateLimit,
        ineligibleCandidates: [],
        failureReasons: [],
      },
    }
  }

  const evaluated = params.candidates.map((candidate, index) =>
    c1ApprovalForCandidate({
      candidate,
      rank: index + 1,
      routeShapeContract: params.routeShapeContract!,
    }),
  )
  const eligibleIds = new Set(
    evaluated.filter((candidate) => candidate.eligible).map((candidate) => candidate.candidateId),
  )
  const candidates = params.candidates.filter((candidate) => eligibleIds.has(candidate.id))
  const firstEligibleCandidate = evaluated.find((candidate) => candidate.eligible)
  const ineligibleCandidates = evaluated.filter((candidate) => !candidate.eligible)
  const failureReasons = [
    ...new Set(ineligibleCandidates.flatMap((candidate) => candidate.ineligibilityReasons)),
  ]

  return {
    candidates,
    diagnostics: {
      enforcementActive: true,
      routeShapeContractId: params.routeShapeContract.id,
      projectionId: params.routeShapeContract.interpretationC1Projection?.projectionId,
      evaluatedCandidateCount: params.candidates.length,
      eligibleCandidateCount: candidates.length,
      ineligibleCandidateCount: ineligibleCandidates.length,
      softAuthorizedByRequirement: evaluated.some(
        (candidate) =>
          candidate.tasteStatus === 'soft' &&
          candidate.eligible &&
          candidate.requirementSource === 'route_shape_contract',
      ),
      softAuthorizationSource: evaluated.some(
        (candidate) =>
          candidate.tasteStatus === 'soft' &&
          candidate.eligible &&
          candidate.requirementSource === 'route_shape_contract',
      )
        ? 'role_composition_requirement.minimumStatus'
        : 'none',
      selectedCandidateId: firstEligibleCandidate?.candidateId,
      selectedCandidateRank: firstEligibleCandidate?.rank,
      topCandidate: evaluated[0],
      firstEligibleCandidate,
      ineligibleCandidateLimit,
      ineligibleCandidates: ineligibleCandidates.slice(0, ineligibleCandidateLimit),
      failureReasons,
    },
  }
}
