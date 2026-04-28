function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
export function getNearbyAlternatives({ role, currentArc, scoredVenues, intent, lens, limit = 5, }) {
    const roleStop = currentArc.stops.find((stop) => stop.role === role);
    if (!roleStop) {
        return [];
    }
    const occupiedIds = new Set(currentArc.stops
        .filter((stop) => stop.role !== role)
        .map((stop) => stop.scoredVenue.venue.id));
    const originNeighborhood = roleStop.scoredVenue.venue.neighborhood;
    const originDrive = roleStop.scoredVenue.venue.driveMinutes;
    const neighborhoodQuery = intent.neighborhood?.toLowerCase();
    const lensRole = role === 'warmup' ? 'start' : role === 'peak' ? 'highlight' : role === 'wildcard' ? 'surprise' : 'windDown';
    const scoreCandidate = (item) => {
        const sameNeighborhood = item.venue.neighborhood === originNeighborhood ? 1 : 0;
        const neighborhoodIntentBonus = neighborhoodQuery && item.venue.neighborhood.toLowerCase() === neighborhoodQuery ? 1 : 0;
        const driveDiff = Math.abs(item.venue.driveMinutes - originDrive);
        const driveCloseness = clamp01(1 - driveDiff / 18);
        const score = clamp01(driveCloseness * 0.45 +
            sameNeighborhood * 0.25 +
            neighborhoodIntentBonus * 0.1 +
            item.roleScores[role] * 0.1 +
            item.fitBreakdown.anchorFit * 0.05 +
            item.lensCompatibility * 0.03 +
            item.stopShapeFit[lensRole] * 0.02 +
            item.roleContract[role].score * 0.06 -
            (item.roleContract[role].satisfied || item.roleContract[role].strength === 'none'
                ? 0
                : (1 - item.roleContract[role].score) * 0.08));
        const reason = sameNeighborhood
            ? `Similar area around ${originNeighborhood}.`
            : 'Closer fit based on travel and pacing.';
        return {
            scoredVenue: item,
            score,
            reason,
        };
    };
    const strictCandidates = scoredVenues
        .filter((item) => item.venue.id !== roleStop.scoredVenue.venue.id &&
        !occupiedIds.has(item.venue.id) &&
        item.roleScores[role] >= 0.52 &&
        item.lensCompatibility >= 0.38 &&
        item.stopShapeFit[lensRole] >= 0.4)
        .map(scoreCandidate)
        .sort((left, right) => right.score - left.score);
    if (strictCandidates.length >= Math.min(3, limit)) {
        return strictCandidates.slice(0, limit);
    }
    const relaxedCandidates = scoredVenues
        .filter((item) => item.venue.id !== roleStop.scoredVenue.venue.id &&
        !occupiedIds.has(item.venue.id) &&
        item.roleScores[role] >= 0.42 &&
        item.lensCompatibility >= (lens.discoveryBias === 'high' ? 0.33 : 0.36))
        .map(scoreCandidate)
        .sort((left, right) => right.score - left.score);
    return relaxedCandidates.slice(0, limit);
}
