import { inverseRoleProjection } from '../config/roleProjection';
function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
function priceTierNumber(value) {
    if (value === '$') {
        return 1;
    }
    if (value === '$$') {
        return 2;
    }
    if (value === '$$$') {
        return 3;
    }
    return 4;
}
function objectiveScoreForMode(mode, role, candidate, intent) {
    const internalRole = inverseRoleProjection[role];
    const roleFit = candidate.roleScores[internalRole];
    const energyNorm = candidate.venue.energyLevel / 5;
    const inverseDrive = clamp01(1 - candidate.venue.driveMinutes / 30);
    const priceNorm = priceTierNumber(candidate.venue.priceTier) / 4;
    const neighborhoodIntentMatch = intent.neighborhood &&
        intent.neighborhood.toLowerCase() === candidate.venue.neighborhood.toLowerCase()
        ? 1
        : 0;
    if (mode === 'more-unique') {
        return clamp01(candidate.venue.distinctivenessScore * 0.35 +
            candidate.venue.underexposureScore * 0.25 +
            candidate.hiddenGemScore * 0.3 +
            candidate.contextSpecificity.byRole[internalRole] * 0.08 +
            candidate.roleContract[internalRole].score * 0.06 +
            roleFit * 0.08 +
            (role === 'surprise' || role === 'highlight' ? 0.06 : 0));
    }
    if (mode === 'closer-by') {
        return clamp01(inverseDrive * 0.5 +
            candidate.fitBreakdown.proximityFit * 0.35 +
            neighborhoodIntentMatch * 0.1 +
            candidate.roleContract[internalRole].score * 0.06 +
            roleFit * 0.05 +
            candidate.contextSpecificity.byRole[internalRole] * 0.06);
    }
    if (mode === 'more-relaxed') {
        return clamp01((1 - energyNorm) * 0.42 +
            candidate.stopShapeFit.windDown * (role === 'windDown' ? 0.24 : 0.12) +
            candidate.fitBreakdown.proximityFit * 0.2 +
            candidate.roleContract[internalRole].score * 0.08 +
            roleFit * 0.12 +
            candidate.contextSpecificity.byRole[internalRole] * 0.1);
    }
    if (mode === 'more-exciting') {
        return clamp01(energyNorm * 0.42 +
            roleFit * 0.22 +
            candidate.contextSpecificity.byRole[internalRole] * 0.1 +
            candidate.roleContract[internalRole].score * 0.08 +
            candidate.venue.distinctivenessScore * 0.15 +
            candidate.hiddenGemScore * 0.1 +
            (role === 'highlight' || role === 'surprise' ? 0.06 : 0));
    }
    return clamp01(priceNorm * 0.44 +
        candidate.lensCompatibility * 0.2 +
        roleFit * 0.12 +
        candidate.roleContract[internalRole].score * 0.08 +
        candidate.contextSpecificity.byRole[internalRole] * 0.1 +
        candidate.fitBreakdown.budgetFit * 0.14 +
        (role === 'start' || role === 'highlight' ? 0.06 : 0));
}
export function findTargetedRefinementCandidates({ role, currentArc, scoredVenues, intent, directive, limit = 14, }) {
    const internalRole = inverseRoleProjection[role];
    const currentStop = currentArc.stops.find((stop) => stop.role === internalRole);
    if (!currentStop) {
        return [];
    }
    const occupiedIds = new Set(currentArc.stops
        .filter((stop) => stop.role !== internalRole)
        .map((stop) => stop.scoredVenue.venue.id));
    const currentObjective = objectiveScoreForMode(directive.mode, role, currentStop.scoredVenue, intent) -
        currentStop.scoredVenue.dominanceControl.byRole[internalRole];
    const baseCandidates = scoredVenues
        .filter((candidate) => candidate.venue.id !== currentStop.scoredVenue.venue.id &&
        !occupiedIds.has(candidate.venue.id) &&
        candidate.roleScores[internalRole] >= directive.minRoleScore &&
        candidate.lensCompatibility >= 0.3 &&
        candidate.contextSpecificity.byRole[internalRole] >= 0.42);
    const contractSatisfiedCandidates = baseCandidates.filter((candidate) => candidate.roleContract[internalRole].satisfied);
    const candidatePool = contractSatisfiedCandidates.length > 0
        ? contractSatisfiedCandidates
        : baseCandidates;
    return candidatePool
        .map((candidate) => {
        const objectiveScore = objectiveScoreForMode(directive.mode, role, candidate, intent);
        const dominancePenalty = candidate.dominanceControl.byRole[internalRole];
        return {
            scoredVenue: candidate,
            objectiveScore: Number((objectiveScore - dominancePenalty).toFixed(3)),
            objectiveDelta: Number((objectiveScore - dominancePenalty - currentObjective).toFixed(3)),
            roleScore: Number((candidate.roleScores[internalRole] * 100).toFixed(1)),
        };
    })
        .sort((left, right) => {
        if (right.objectiveDelta !== left.objectiveDelta) {
            return right.objectiveDelta - left.objectiveDelta;
        }
        return right.objectiveScore - left.objectiveScore;
    })
        .slice(0, limit);
}
