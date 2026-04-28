function countReasons(reasons) {
    const counts = reasons.reduce((acc, reason) => {
        acc[reason] = (acc[reason] ?? 0) + 1;
        return acc;
    }, {});
    return Object.entries(counts)
        .map(([reason, count]) => ({ reason, count }))
        .sort((left, right) => right.count - left.count)
        .slice(0, 6);
}
function upstreamStrength(venue) {
    return (venue.source.qualityScore * 0.34 +
        venue.source.sourceConfidence * 0.24 +
        venue.source.completenessScore * 0.18 +
        venue.signature.signatureScore * 0.14 +
        (1 - venue.signature.genericScore) * 0.1);
}
function toFailureCandidate(venue) {
    const helpedBy = [
        ...venue.source.qualityGateNotes.filter((note) => /(supports|viable path|distinctive|fairly|metadata|signal)/i.test(note)),
        ...venue.source.hoursPressureNotes.filter((note) => /(supports|accepted|positive|open)/i.test(note)),
    ].slice(0, 4);
    const hurtBy = [
        ...venue.source.demotionReasons,
        ...venue.source.suppressionReasons,
        ...venue.source.hoursPressureNotes.filter((note) => /(conflicts|unknown|closed|soft)/i.test(note)),
    ].slice(0, 6);
    return {
        venueId: venue.id,
        venueName: venue.name,
        qualityGateStatus: venue.source.qualityGateStatus,
        qualityScore: Number((venue.source.qualityScore * 100).toFixed(1)),
        sourceConfidence: Number((venue.source.sourceConfidence * 100).toFixed(1)),
        completenessScore: Number((venue.source.completenessScore * 100).toFixed(1)),
        signatureScore: Number((venue.signature.signatureScore * 100).toFixed(1)),
        genericScore: Number((venue.signature.genericScore * 100).toFixed(1)),
        sourceQueryLabel: venue.source.sourceQueryLabel,
        helpedBy,
        hurtBy,
        blockers: venue.source.qualityGateStatus === 'suppressed'
            ? venue.source.suppressionReasons
            : venue.source.demotionReasons,
    };
}
export function buildLiveTrustBreakdown(liveVenues, dedupeLosses) {
    const demoted = liveVenues
        .filter((venue) => venue.source.qualityGateStatus === 'demoted')
        .sort((left, right) => upstreamStrength(right) - upstreamStrength(left));
    const suppressed = liveVenues
        .filter((venue) => venue.source.qualityGateStatus === 'suppressed')
        .sort((left, right) => upstreamStrength(right) - upstreamStrength(left));
    return {
        topApprovedBlockers: countReasons(demoted.flatMap((venue) => venue.source.demotionReasons)),
        topSuppressionReasons: countReasons(suppressed.flatMap((venue) => venue.source.suppressionReasons)),
        topDedupeReasons: countReasons(dedupeLosses
            .filter((loss) => loss.removedSourceOrigin === 'live')
            .flatMap((loss) => [loss.duplicateReason, loss.preferenceReason])),
        strongestApprovalFailures: demoted.slice(0, 5).map(toFailureCandidate),
        strongestSuppressedCandidates: suppressed.slice(0, 5).map(toFailureCandidate),
        strongestDedupedCandidates: dedupeLosses
            .filter((loss) => loss.removedSourceOrigin === 'live')
            .sort((left, right) => {
            const leftSignal = Math.max(left.liveSignatureScore ?? 0, left.liveDistinctivenessScore ?? 0);
            const rightSignal = Math.max(right.liveSignatureScore ?? 0, right.liveDistinctivenessScore ?? 0);
            return rightSignal - leftSignal;
        })
            .slice(0, 5),
    };
}
