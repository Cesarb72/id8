import { getNearbyAlternatives } from '../retrieval/getNearbyAlternatives';
import { swapArcStop } from './swapArcStop';
function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
function roleSpecificBoost(role, venue, lens) {
    if (role === 'cooldown') {
        const energyPenalty = venue.venue.energyLevel >= 4
            ? lens.tone === 'electric'
                ? 0.12
                : 0.24
            : 0;
        const categoryBonus = venue.venue.category === 'dessert' ||
            venue.venue.category === 'park' ||
            venue.venue.category === 'cafe'
            ? 0.12
            : 0;
        return categoryBonus - energyPenalty;
    }
    if (role === 'wildcard') {
        return lens.discoveryBias === 'high'
            ? venue.hiddenGemScore * 0.12
            : venue.hiddenGemScore * 0.04;
    }
    if (role === 'peak') {
        return venue.venue.energyLevel >= 3 ? 0.08 : -0.06;
    }
    return 0;
}
export function getRoleAlternatives({ role, currentArc, scoredVenues, intent, crewPolicy, lens, limit = 5, }) {
    const nearbyPool = getNearbyAlternatives({
        role,
        currentArc,
        scoredVenues,
        intent,
        lens,
        limit: Math.max(limit * 3, 10),
    });
    return nearbyPool
        .map((candidate) => {
        const swappedArc = swapArcStop({
            currentArc,
            role,
            replacement: candidate.scoredVenue,
            intent,
            crewPolicy,
            lens,
        });
        if (!swappedArc) {
            return null;
        }
        const contractEval = candidate.scoredVenue.roleContract[role];
        const contractBoost = contractEval.score * (role === 'peak' ? 0.16 : 0.1);
        const contractPenalty = contractEval.satisfied || contractEval.strength === 'none'
            ? 0
            : (1 - contractEval.score) * (role === 'peak' ? 0.18 : 0.12);
        const score = clamp01(candidate.score * 0.4 +
            candidate.scoredVenue.roleScores[role] * 0.28 +
            candidate.scoredVenue.fitScore * 0.14 +
            candidate.scoredVenue.lensCompatibility * 0.1 +
            contractBoost -
            contractPenalty +
            roleSpecificBoost(role, candidate.scoredVenue, lens));
        return {
            scoredVenue: candidate.scoredVenue,
            score,
            reason: candidate.reason,
        };
    })
        .filter((item) => Boolean(item))
        .sort((left, right) => right.score - left.score)
        .slice(0, limit);
}
