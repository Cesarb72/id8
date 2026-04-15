import { deterministicTiebreaker } from '../../lib/ids';
function priceToNumber(priceTier) {
    if (priceTier === '$') {
        return 1;
    }
    if (priceTier === '$$') {
        return 2;
    }
    if (priceTier === '$$$') {
        return 3;
    }
    return 4;
}
function averagePrice(candidate) {
    const total = candidate.stops.reduce((sum, stop) => sum + priceToNumber(stop.scoredVenue.venue.priceTier), 0);
    return total / candidate.stops.length;
}
function driveSpread(candidate) {
    const drives = candidate.stops.map((stop) => stop.scoredVenue.venue.driveMinutes);
    return Math.max(...drives) - Math.min(...drives);
}
function candidateDeterministicKey(candidate) {
    return candidate.stops
        .map((stop) => `${stop.role}:${stop.scoredVenue.venue.id}`)
        .join('|');
}
function refinementAdjustment(candidate, intent) {
    const refinements = new Set(intent.refinementModes ?? []);
    let adjustment = 0;
    if (refinements.has('more-exciting')) {
        const peak = candidate.stops.find((stop) => stop.role === 'peak');
        const wildcard = candidate.stops.find((stop) => stop.role === 'wildcard');
        adjustment += (peak?.scoredVenue.venue.energyLevel ?? 0) * 0.005;
        adjustment += (wildcard?.scoredVenue.venue.energyLevel ?? 0) * 0.004;
    }
    if (refinements.has('more-unique')) {
        const uniquenessAverage = candidate.stops.reduce((sum, stop) => sum + stop.scoredVenue.venue.uniquenessScore, 0) /
            candidate.stops.length;
        adjustment += uniquenessAverage * 0.04;
    }
    if (refinements.has('little-fancier')) {
        adjustment += averagePrice(candidate) * 0.018;
    }
    if (refinements.has('closer-by')) {
        adjustment += Math.max(0, 0.04 - driveSpread(candidate) * 0.0025);
    }
    if (refinements.has('more-relaxed')) {
        const cooldown = candidate.stops[candidate.stops.length - 1];
        adjustment += Math.max(0, (4 - cooldown.scoredVenue.venue.energyLevel) * 0.01);
    }
    return adjustment;
}
export function rankWithWaypointBoundary(request) {
    const ranked = request.candidates
        .map((candidate) => {
        const tiebreaker = deterministicTiebreaker(candidateDeterministicKey(candidate)) * 0.01;
        const rankingScore = candidate.totalScore + refinementAdjustment(candidate, request.intent) + tiebreaker;
        return { candidate, rankingScore };
    })
        .sort((left, right) => right.rankingScore - left.rankingScore);
    return {
        ranked,
        engine: 'local-deterministic-boundary',
    };
}
