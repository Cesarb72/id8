import type { ArcStop, ScoredVenue } from '../types/arc'

export function getScoredVenueCandidateId(candidate: ScoredVenue): string {
  return candidate.candidateIdentity.candidateId
}

export function getScoredVenueBaseVenueId(candidate: ScoredVenue): string {
  return candidate.candidateIdentity.baseVenueId
}

export function getScoredVenueTraceLabel(candidate: ScoredVenue): string {
  return candidate.candidateIdentity.traceLabel
}

export function isHyperlocalActivationVariant(candidate: ScoredVenue): boolean {
  return candidate.candidateIdentity.kind === 'hyperlocal_activation'
}

export function isMomentCandidate(candidate: ScoredVenue): boolean {
  return candidate.candidateIdentity.kind === 'moment'
}

export function isSameScoredVenueCandidate(
  left: ScoredVenue,
  right: ScoredVenue,
): boolean {
  return getScoredVenueCandidateId(left) === getScoredVenueCandidateId(right)
}

export function isSameBaseVenue(
  left: ScoredVenue,
  right: ScoredVenue,
): boolean {
  return getScoredVenueBaseVenueId(left) === getScoredVenueBaseVenueId(right)
}

export function getArcStopCandidateId(stop: ArcStop): string {
  return getScoredVenueCandidateId(stop.scoredVenue)
}

export function getArcStopBaseVenueId(stop: ArcStop): string {
  return getScoredVenueBaseVenueId(stop.scoredVenue)
}
