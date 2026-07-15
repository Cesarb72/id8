import type { CoordinateSteeringPrelockSwapResult } from '../../integrations/waypoint/coordination/coordinateSteeringPrelockProposals'
import type {
  SteeringPrelockAcceptedProposal,
  SteeringPrelockRefusalClass,
  SteeringPrelockRefusalProposal,
} from '../../integrations/waypoint/coordination/steeringPrelockProposal'
import type { UserStopRole } from '../../domain/types/itinerary'

export const STEERING_SWAP_DISPLAY_LIMIT = 3

export interface SteeringSwapProposalDisplayItem {
  rank: number
  routeIdentity: string
  displayName: string
  area?: string
  roleFitLabel: string
  feasibilityLabel: string
  movementLabel: string
  ownerEvidence: readonly ('taste' | 'bearings' | 'field')[]
  proposal: SteeringPrelockAcceptedProposal
}

export interface SteeringSwapProposalSelection {
  targetRole: UserStopRole
  routeIdentity: string
  providerRecordId?: string
  displayName: string
  rank: number
  proposal: SteeringPrelockAcceptedProposal
}

export interface SteeringSwapProposalRefusalDisplay {
  refusalClass: SteeringPrelockRefusalClass
  message: string
  ownerEvidenceNeeded: readonly ('taste' | 'bearings' | 'field')[]
}

export interface SteeringSwapProposalDisplay {
  currentStopLabel: string
  currentRole: UserStopRole
  currentRoleLabel: string
  proposals: readonly SteeringSwapProposalDisplayItem[]
  refusal?: SteeringSwapProposalRefusalDisplay
}

function formatRoleLabel(role: UserStopRole): string {
  if (role === 'start') {
    return 'Start'
  }
  if (role === 'highlight') {
    return 'Highlight'
  }
  if (role === 'windDown') {
    return 'Wind-down'
  }
  return 'Surprise'
}

function formatRoleFit(proposal: SteeringPrelockAcceptedProposal): string {
  const evidence = proposal.roleFitEvidence[0]
  if (evidence.verdict === 'strong_fit') {
    return 'Strong role fit'
  }
  if (evidence.verdict === 'acceptable_fit') {
    return 'Acceptable role fit'
  }
  if (evidence.verdict === 'weak_fit') {
    return 'Weak role fit'
  }
  if (evidence.verdict === 'not_fit') {
    return 'Not a role fit'
  }
  return 'Role fit unknown'
}

function formatFeasibility(proposal: SteeringPrelockAcceptedProposal): string {
  const evidence = proposal.feasibility[0]
  if (evidence.status === 'feasible') {
    return 'Route constraints clear'
  }
  if (evidence.status === 'soft_feasible') {
    return 'Route constraints mostly clear'
  }
  if (evidence.status === 'infeasible') {
    return 'Route constraints blocked'
  }
  return 'Route constraints unknown'
}

function formatMovement(proposal: SteeringPrelockAcceptedProposal): string {
  const movement = proposal.movementDelta
  if (!movement) {
    return 'Movement impact unknown'
  }
  if (movement.direction === 'shorter') {
    return `${Math.abs(movement.deltaMinutes)} min easier movement`
  }
  if (movement.direction === 'longer') {
    return `${movement.deltaMinutes} min harder movement`
  }
  if (movement.direction === 'same') {
    return 'Same movement load'
  }
  return 'Movement impact unknown'
}

export function formatSteeringSwapRefusalMessage(
  refusalClass: SteeringPrelockRefusalClass,
): string {
  if (refusalClass === 'role_fit_too_weak') {
    return 'No strong enough swap for this stop yet.'
  }
  if (refusalClass === 'no_admissible_replacement') {
    return 'No replacement clears the route constraints right now.'
  }
  if (refusalClass === 'movement_would_get_worse') {
    return 'Available swaps would make the route harder to move through.'
  }
  if (refusalClass === 'identity_provenance_missing') {
    return "I can't verify a route-safe identity for this replacement."
  }
  return 'No route-safe swap is available for this stop right now.'
}

function buildRefusalDisplay(
  refusal: SteeringPrelockRefusalProposal | undefined,
): SteeringSwapProposalRefusalDisplay | undefined {
  if (!refusal) {
    return undefined
  }
  return {
    refusalClass: refusal.refusalReason.refusalClass,
    message: formatSteeringSwapRefusalMessage(refusal.refusalReason.refusalClass),
    ownerEvidenceNeeded: refusal.refusalReason.ownerEvidenceNeeded,
  }
}

export function buildSteeringSwapProposalSelection(
  proposal: SteeringPrelockAcceptedProposal,
): SteeringSwapProposalSelection | undefined {
  const routeIdentity = proposal.candidateIdentity.baseVenueId?.trim()
  if (!routeIdentity) {
    return undefined
  }
  return {
    targetRole: proposal.targetRole,
    routeIdentity,
    providerRecordId: proposal.candidateIdentity.providerRecordId,
    displayName: proposal.candidateIdentity.displayName,
    rank: proposal.rank.rank,
    proposal,
  }
}

export function buildSteeringSwapProposalDisplay(params: {
  currentStopLabel: string
  currentRole: UserStopRole
  coordination: CoordinateSteeringPrelockSwapResult
  maxAlternatives?: number
}): SteeringSwapProposalDisplay {
  const maxAlternatives = params.maxAlternatives ?? STEERING_SWAP_DISPLAY_LIMIT
  const proposals = params.coordination.acceptedProposals
    .slice(0, maxAlternatives)
    .map((proposal): SteeringSwapProposalDisplayItem => ({
      rank: proposal.rank.rank,
      routeIdentity: proposal.candidateIdentity.baseVenueId ?? proposal.candidateIdentity.venueId ?? '',
      displayName: proposal.candidateIdentity.displayName,
      area: proposal.candidateIdentity.neighborhood,
      roleFitLabel: formatRoleFit(proposal),
      feasibilityLabel: formatFeasibility(proposal),
      movementLabel: formatMovement(proposal),
      ownerEvidence: ['taste', 'bearings', 'field'],
      proposal,
    }))

  return {
    currentStopLabel: params.currentStopLabel,
    currentRole: params.currentRole,
    currentRoleLabel: formatRoleLabel(params.currentRole),
    proposals,
    refusal: proposals.length > 0 ? undefined : buildRefusalDisplay(params.coordination.refusalProposal),
  }
}
