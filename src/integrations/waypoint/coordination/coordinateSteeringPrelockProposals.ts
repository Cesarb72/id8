import type { RuntimeRouteStop } from '../../../domain/artifacts/runtimeRouteArtifact'
import type { ScoredVenue } from '../../../domain/types/arc'
import type { ItineraryStop, UserStopRole } from '../../../domain/types/itinerary'
import type { InternalRole } from '../../../domain/types/venue'
import {
  projectSteeringIdentityFromRuntimeStop,
  projectSteeringIdentityFromScoredVenue,
  projectSteeringStopIdentity,
} from './steeringIdentityProjection'
import type {
  SteeringFeasibilityEvidence,
  SteeringMovementDeltaEvidence,
  SteeringPrelockAcceptedProposal,
  SteeringPrelockAction,
  SteeringPrelockOwnerEvidenceSource,
  SteeringPrelockProposal,
  SteeringPrelockRefusalClass,
  SteeringPrelockRefusalProposal,
  SteeringRefusalReason,
  SteeringRoleFitEvidence,
  SteeringStopIdentity,
} from './steeringPrelockProposal'

export interface SteeringSwapCandidateProjection {
  candidateKey: string
  currentStopIdentity: SteeringStopIdentity
  candidateIdentity: SteeringStopIdentity
  roleFitEvidence: readonly [SteeringRoleFitEvidence<'role_suitability'>]
  feasibility: readonly [SteeringFeasibilityEvidence<'admission'>]
  movementDelta: SteeringMovementDeltaEvidence
  tieBreakKey: string
}

export interface SteeringSwapCandidateProjectionRefusal {
  candidateKey: string
  refusalClass: SteeringPrelockRefusalClass
  ownerEvidenceNeeded: readonly SteeringPrelockOwnerEvidenceSource[]
  ownerReasons: readonly string[]
}

export type SteeringSwapCandidateProjectionResult =
  | {
      status: 'projected'
      candidate: SteeringSwapCandidateProjection
    }
  | {
      status: 'refused'
      refusal: SteeringSwapCandidateProjectionRefusal
    }

export interface CoordinateSteeringPrelockSwapInput {
  action?: Extract<SteeringPrelockAction, 'swap_stop'>
  targetRole: UserStopRole
  currentStopIdentity: SteeringStopIdentity
  candidates: readonly SteeringSwapCandidateProjection[]
  allowMovementWorsening?: boolean
}

export interface CoordinateSteeringPrelockSwapResult {
  proposals: readonly SteeringPrelockProposal[]
  acceptedProposals: readonly SteeringPrelockAcceptedProposal[]
  refusalProposal?: SteeringPrelockRefusalProposal
  rankingAttribution: readonly (
    | 'Taste role-fit evidence'
    | 'Bearings feasibility'
    | 'Bearings movementDelta'
    | 'Field identity/provenance'
    | 'Waypoint arbitration over owner evidence'
  )[]
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(1, value))
}

function roleFitVerdict(value: number): SteeringRoleFitEvidence['verdict'] {
  if (value >= 0.72) {
    return 'strong_fit'
  }
  if (value >= 0.44) {
    return 'acceptable_fit'
  }
  if (value > 0) {
    return 'weak_fit'
  }
  return 'unknown'
}

function movementDirection(deltaMinutes: number): SteeringMovementDeltaEvidence['direction'] {
  if (!Number.isFinite(deltaMinutes)) {
    return 'unknown'
  }
  if (deltaMinutes <= -1) {
    return 'shorter'
  }
  if (deltaMinutes >= 1) {
    return 'longer'
  }
  return 'same'
}

function movementScore(deltaMinutes: number): number {
  if (!Number.isFinite(deltaMinutes)) {
    return 0.35
  }
  if (deltaMinutes <= 0) {
    return clamp01(0.7 + Math.min(0.3, Math.abs(deltaMinutes) / 20))
  }
  return clamp01(0.7 - Math.min(0.5, deltaMinutes / 20))
}

function proposalScore(candidate: SteeringSwapCandidateProjection): number {
  const roleFit = clamp01(candidate.roleFitEvidence[0].value as number)
  const feasible = candidate.feasibility.every(
    (evidence) => evidence.value === true && evidence.status !== 'infeasible',
  )
  const feasibleScore = feasible ? 1 : 0
  const movement = movementScore(candidate.movementDelta.deltaMinutes)
  return Number((roleFit * 0.58 + feasibleScore * 0.18 + movement * 0.24).toFixed(6))
}

function buildRefusalReason(params: {
  refusalClass: SteeringPrelockRefusalClass
  ownerEvidenceNeeded: readonly SteeringPrelockOwnerEvidenceSource[]
  ownerReasons: readonly string[]
}): SteeringRefusalReason {
  return {
    source: 'waypoint',
    refusalClass: params.refusalClass,
    userFacingCapable: true,
    messageKey: `steering.swap.${params.refusalClass}`,
    ownerEvidenceNeeded: params.ownerEvidenceNeeded,
    ownerReasons: params.ownerReasons,
  }
}

function hasResolvedFieldIdentity(identity: SteeringStopIdentity): boolean {
  return identity.source === 'field' && Boolean(identity.baseVenueId?.trim())
}

function classifyCandidateRefusal(
  candidate: SteeringSwapCandidateProjection,
  options: Pick<CoordinateSteeringPrelockSwapInput, 'allowMovementWorsening'>,
): SteeringSwapCandidateProjectionRefusal | undefined {
  if (
    !hasResolvedFieldIdentity(candidate.currentStopIdentity) ||
    !hasResolvedFieldIdentity(candidate.candidateIdentity)
  ) {
    return {
      candidateKey: candidate.candidateKey,
      refusalClass: 'identity_provenance_missing',
      ownerEvidenceNeeded: ['field'],
      ownerReasons: ['field:identity_projection_missing_baseVenueId'],
    }
  }

  if (
    candidate.roleFitEvidence.some(
      (evidence) => evidence.verdict === 'weak_fit' || evidence.verdict === 'not_fit',
    )
  ) {
    return {
      candidateKey: candidate.candidateKey,
      refusalClass: 'role_fit_too_weak',
      ownerEvidenceNeeded: ['taste'],
      ownerReasons: ['taste:role_fit_too_weak'],
    }
  }

  if (
    candidate.feasibility.some(
      (evidence) => evidence.value !== true || evidence.status === 'infeasible',
    )
  ) {
    return {
      candidateKey: candidate.candidateKey,
      refusalClass: 'no_admissible_replacement',
      ownerEvidenceNeeded: ['bearings'],
      ownerReasons: ['bearings:admission_failed'],
    }
  }

  if (
    options.allowMovementWorsening === false &&
    candidate.movementDelta.direction === 'longer'
  ) {
    return {
      candidateKey: candidate.candidateKey,
      refusalClass: 'movement_would_get_worse',
      ownerEvidenceNeeded: ['bearings'],
      ownerReasons: ['bearings:movement_delta_longer_than_allowed'],
    }
  }

  return undefined
}

function buildRefusalProposal(params: {
  action: Extract<SteeringPrelockAction, 'swap_stop'>
  targetRole: UserStopRole
  currentStopIdentity: SteeringStopIdentity
  refusal: SteeringSwapCandidateProjectionRefusal
}): SteeringPrelockRefusalProposal {
  return {
    status: 'refused',
    action: params.action,
    targetRole: params.targetRole,
    currentStopIdentity: params.currentStopIdentity,
    refusalReason: buildRefusalReason(params.refusal),
    provenance: {
      waypoint: {
        source: 'waypoint',
        key: 'steering_prelock_proposal',
        action: params.action,
        reason: 'Waypoint refused swap proposal from owner evidence.',
      },
      ownerTrace: params.refusal.ownerEvidenceNeeded.map((source) => ({
        source,
        key: `${source}:required_evidence`,
      })),
    },
  }
}

export function coordinateSteeringPrelockSwapProposals(
  input: CoordinateSteeringPrelockSwapInput,
): CoordinateSteeringPrelockSwapResult {
  const action = input.action ?? 'swap_stop'
  const accepted = input.candidates
    .map((candidate) => {
      const refusal = classifyCandidateRefusal(candidate, input)
      if (refusal) {
        return undefined
      }
      const score = proposalScore(candidate)
      const proposal: SteeringPrelockAcceptedProposal = {
        status: 'proposed',
        action,
        targetRole: input.targetRole,
        currentStopIdentity: candidate.currentStopIdentity,
        candidateIdentity: candidate.candidateIdentity,
        roleFitEvidence: candidate.roleFitEvidence,
        feasibility: candidate.feasibility,
        movementDelta: candidate.movementDelta,
        rank: {
          source: 'waypoint',
          rank: 0,
          score,
          tieBreakKey: candidate.tieBreakKey,
          rankingBasis: 'owner_evidence',
        },
        provenance: {
          waypoint: {
            source: 'waypoint',
            key: 'steering_prelock_proposal',
            action,
            reason: 'Waypoint ranked swap proposal over owner evidence.',
          },
          ownerTrace: [
            { source: 'taste', key: candidate.roleFitEvidence[0].key },
            { source: 'bearings', key: candidate.feasibility[0].key },
            { source: 'bearings', key: candidate.movementDelta.key },
            { source: 'field', key: 'current_stop_identity' },
            { source: 'field', key: 'candidate_identity' },
          ],
        },
      }
      return proposal
    })
    .filter((proposal): proposal is SteeringPrelockAcceptedProposal => Boolean(proposal))
    .sort(
      (left, right) =>
        (right.rank.score ?? 0) - (left.rank.score ?? 0) ||
        left.rank.tieBreakKey.localeCompare(right.rank.tieBreakKey),
    )
    .map((proposal, index) => ({
      ...proposal,
      rank: {
        ...proposal.rank,
        rank: index + 1,
      },
    }))

  if (accepted.length > 0) {
    return {
      proposals: accepted,
      acceptedProposals: accepted,
      rankingAttribution: [
        'Taste role-fit evidence',
        'Bearings feasibility',
        'Bearings movementDelta',
        'Field identity/provenance',
        'Waypoint arbitration over owner evidence',
      ],
    }
  }

  const firstRefusal =
    input.candidates
      .map((candidate) => classifyCandidateRefusal(candidate, input))
      .find((refusal): refusal is SteeringSwapCandidateProjectionRefusal =>
        Boolean(refusal),
      ) ?? {
      candidateKey: 'none',
      refusalClass: 'no_admissible_replacement' as const,
      ownerEvidenceNeeded: ['taste', 'bearings', 'field'] as const,
      ownerReasons: ['waypoint:no_owner_supported_candidates'],
    }

  const refusalProposal = buildRefusalProposal({
    action,
    targetRole: input.targetRole,
    currentStopIdentity: input.currentStopIdentity,
    refusal: firstRefusal,
  })

  return {
    proposals: [refusalProposal],
    acceptedProposals: [],
    refusalProposal,
    rankingAttribution: ['Waypoint arbitration over owner evidence'],
  }
}

export function projectSteeringSwapCandidateForCoordination(params: {
  currentStop: ItineraryStop
  currentRuntimeStop?: RuntimeRouteStop
  candidate: ScoredVenue
  candidateStop?: ItineraryStop
  targetRole: UserStopRole
  internalRole: InternalRole
}): SteeringSwapCandidateProjectionResult {
  const currentStopIdentityResult = params.currentRuntimeStop
    ? projectSteeringIdentityFromRuntimeStop(params.currentRuntimeStop, {
        baseVenueId: params.currentStop.venueId,
        sourceOrigin: 'curated',
        sourceProvenance: 'field:runtime_route_artifact',
      })
    : projectSteeringStopIdentity({
        baseVenueId: params.currentStop.venueId,
        venueId: params.currentStop.venueId,
        displayName: params.currentStop.venueName,
        sourceOrigin: 'curated',
        sourceProvenance: 'field:itinerary_stop',
        coordinates:
          typeof params.currentStop.latitude === 'number' &&
          typeof params.currentStop.longitude === 'number'
            ? {
                lat: params.currentStop.latitude,
                lng: params.currentStop.longitude,
              }
            : undefined,
        address: params.currentStop.formattedAddress,
        neighborhood: params.currentStop.neighborhood,
        candidateId: params.currentStop.id,
      })
  if (currentStopIdentityResult.status === 'refused') {
    return {
      status: 'refused',
      refusal: {
        candidateKey: params.candidate.candidateIdentity.candidateId,
        refusalClass: 'identity_provenance_missing',
        ownerEvidenceNeeded: ['field'],
        ownerReasons: currentStopIdentityResult.refusalReason.ownerReasons ?? [],
      },
    }
  }

  const candidateIdentityResult = projectSteeringIdentityFromScoredVenue(params.candidate)
  if (candidateIdentityResult.status === 'refused') {
    return {
      status: 'refused',
      refusal: {
        candidateKey: params.candidate.candidateIdentity.candidateId,
        refusalClass: 'identity_provenance_missing',
        ownerEvidenceNeeded: ['field'],
        ownerReasons: candidateIdentityResult.refusalReason.ownerReasons ?? [],
      },
    }
  }

  const roleFitValue = clamp01(params.candidate.roleScores[params.internalRole])
  const deltaMinutes =
    params.candidate.venue.driveMinutes - params.currentStop.driveMinutes
  const roleFitEvidence: SteeringRoleFitEvidence<'role_suitability'> = {
    source: 'taste',
    key: 'role_suitability',
    authority: 'owner_evidence',
    value: roleFitValue,
    role: params.targetRole,
    verdict: roleFitVerdict(roleFitValue),
    reason: 'Taste-authored role score consumed by steering proposal.',
    ownerReasons: ['taste:role_score'],
  }
  const feasibility: SteeringFeasibilityEvidence<'admission'> = {
    source: 'bearings',
    key: 'admission',
    authority: 'owner_evidence',
    value: true,
    status: 'feasible',
    reason: 'Candidate survived existing swap projection and display prefilters.',
    ownerReasons: ['bearings:swap_projection_survived'],
  }
  const movementDelta: SteeringMovementDeltaEvidence = {
    source: 'bearings',
    key: 'movement_delta',
    authority: 'owner_evidence',
    value: deltaMinutes,
    currentTravelMinutes: params.currentStop.driveMinutes,
    candidateTravelMinutes: params.candidate.venue.driveMinutes,
    deltaMinutes,
    direction: movementDirection(deltaMinutes),
    originAware: false,
    ownerReasons: ['bearings:drive_minutes_delta'],
  }

  return {
    status: 'projected',
    candidate: {
      candidateKey: params.candidate.candidateIdentity.candidateId,
      currentStopIdentity: currentStopIdentityResult.identity,
      candidateIdentity: candidateIdentityResult.identity,
      roleFitEvidence: [roleFitEvidence],
      feasibility: [feasibility],
      movementDelta,
      tieBreakKey:
        candidateIdentityResult.identity.baseVenueId ??
        params.candidate.candidateIdentity.candidateId,
    },
  }
}
