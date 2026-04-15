export function getScoredVenueCandidateId(candidate) {
    return candidate.candidateIdentity.candidateId;
}
export function getScoredVenueBaseVenueId(candidate) {
    return candidate.candidateIdentity.baseVenueId;
}
export function getScoredVenueTraceLabel(candidate) {
    return candidate.candidateIdentity.traceLabel;
}
export function isHyperlocalActivationVariant(candidate) {
    return candidate.candidateIdentity.kind === 'hyperlocal_activation';
}
export function isMomentCandidate(candidate) {
    return candidate.candidateIdentity.kind === 'moment';
}
export function isSameScoredVenueCandidate(left, right) {
    return getScoredVenueCandidateId(left) === getScoredVenueCandidateId(right);
}
export function isSameBaseVenue(left, right) {
    return getScoredVenueBaseVenueId(left) === getScoredVenueBaseVenueId(right);
}
export function getArcStopCandidateId(stop) {
    return getScoredVenueCandidateId(stop.scoredVenue);
}
export function getArcStopBaseVenueId(stop) {
    return getScoredVenueBaseVenueId(stop.scoredVenue);
}
