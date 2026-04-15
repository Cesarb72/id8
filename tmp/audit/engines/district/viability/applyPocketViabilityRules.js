const DEFAULT_THRESHOLDS = {
    minEntities: 5,
    softMinEntities: 3,
    hardRejectBelow: 3,
    hardMaxCentroidDistanceM: 650,
};
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function toFixed(value) {
    return Number(value.toFixed(3));
}
const DENSITY_SCORE_BASELINE = 260;
function computeViabilitySignals(pocket, thresholds) {
    const entityCount = pocket.entities.length;
    const densityScore = clamp(pocket.geometry.densityEntitiesPerKm2 / DENSITY_SCORE_BASELINE, 0, 1);
    // Keep signal responsibilities separated:
    // - walkabilityScore: local movement friction inside the pocket footprint
    // - compactnessScore: shape coherence (elongation), not distance spread
    // - radiusPenalty: only hard-cap overflow beyond max centroid distance
    const walkabilityScore = clamp(1 - pocket.geometry.avgDistanceFromCentroidM / 260, 0, 1) * 0.75 +
        clamp(1 - pocket.geometry.maxPairwiseDistanceM / 950, 0, 1) * 0.25;
    const compactnessScore = clamp(1 - clamp((pocket.geometry.elongationRatio - 1) / 3, 0, 1), 0, 1);
    const radiusPenalty = Math.max(0, (pocket.geometry.maxDistanceFromCentroidM - thresholds.hardMaxCentroidDistanceM) /
        thresholds.hardMaxCentroidDistanceM);
    return {
        entityCount,
        categoryDiversity: toFixed(pocket.laneDiversityScore),
        densityScore: toFixed(densityScore),
        walkabilityScore: toFixed(walkabilityScore),
        compactnessScore: toFixed(compactnessScore),
        radiusPenalty: toFixed(radiusPenalty),
    };
}
function computeViabilityScore(signals) {
    const entityCountScore = clamp(signals.entityCount / 9, 0, 1);
    const score = entityCountScore * 0.25 +
        signals.categoryDiversity * 0.2 +
        signals.densityScore * 0.18 +
        signals.walkabilityScore * 0.23 +
        signals.compactnessScore * 0.14 -
        signals.radiusPenalty * 0.18;
    return toFixed(clamp(score, 0, 1));
}
function buildClassification(pocket, signals, score, thresholds) {
    const entityCount = pocket.entities.length;
    if (entityCount < thresholds.hardRejectBelow) {
        return 'reject';
    }
    if (pocket.geometry.maxDistanceFromCentroidM > thresholds.hardMaxCentroidDistanceM + 120) {
        return 'reject';
    }
    if (entityCount >= thresholds.minEntities &&
        score >= 0.72 &&
        pocket.geometry.maxDistanceFromCentroidM <= 470 &&
        signals.categoryDiversity >= 0.35 &&
        signals.walkabilityScore >= 0.55) {
        return 'strong';
    }
    if (entityCount >= thresholds.minEntities &&
        score >= 0.52 &&
        pocket.geometry.maxDistanceFromCentroidM <= thresholds.hardMaxCentroidDistanceM &&
        signals.categoryDiversity >= 0.25) {
        return 'usable';
    }
    if (entityCount >= thresholds.softMinEntities &&
        score >= 0.34 &&
        signals.walkabilityScore >= 0.2) {
        return 'weak';
    }
    return 'reject';
}
function buildReasons(pocket, signals, classification, thresholds) {
    const reasons = [];
    reasons.push(`${signals.entityCount} entities, diversity ${signals.categoryDiversity}, density ${signals.densityScore}.`);
    reasons.push(`Walkability ${signals.walkabilityScore}, compactness ${signals.compactnessScore}, max radius ${pocket.geometry.maxDistanceFromCentroidM}m.`);
    if (signals.entityCount < thresholds.hardRejectBelow) {
        reasons.push(`Rejected: below hard minimum of ${thresholds.hardRejectBelow} entities.`);
    }
    else if (signals.entityCount < thresholds.minEntities) {
        reasons.push(`Soft pass: below strong minimum of ${thresholds.minEntities}, classified as ${classification}.`);
    }
    if (pocket.geometry.maxDistanceFromCentroidM > thresholds.hardMaxCentroidDistanceM) {
        reasons.push(`Spread exceeds hard centroid distance target (${thresholds.hardMaxCentroidDistanceM}m).`);
    }
    if (signals.categoryDiversity < 0.25) {
        reasons.push('Low category diversity reduced viability class.');
    }
    if (classification === 'strong') {
        reasons.push('Strong pocket: compact, walkable, and diverse enough for multi-stop flow.');
    }
    else if (classification === 'usable') {
        reasons.push('Usable pocket: supports local movement with manageable spread.');
    }
    else if (classification === 'weak') {
        reasons.push('Weak pocket: can be used with caution in sparse conditions.');
    }
    else {
        reasons.push('Rejected pocket: does not meet minimum spatial viability constraints.');
    }
    return reasons;
}
function toViablePocket(pocket, thresholds) {
    const signals = computeViabilitySignals(pocket, thresholds);
    const score = computeViabilityScore(signals);
    const classification = buildClassification(pocket, signals, score, thresholds);
    const reasons = buildReasons(pocket, signals, classification, thresholds);
    return {
        ...pocket,
        viability: {
            classification,
            score,
            reasons,
            signals,
            thresholds: {
                minEntities: thresholds.minEntities,
                softMinEntities: thresholds.softMinEntities,
                hardRejectBelow: thresholds.hardRejectBelow,
                hardMaxCentroidDistanceM: thresholds.hardMaxCentroidDistanceM,
            },
        },
    };
}
export function applyPocketViabilityRules(rawPockets, thresholds = {}) {
    const mergedThresholds = {
        ...DEFAULT_THRESHOLDS,
        ...thresholds,
    };
    const evaluated = rawPockets.map((pocket) => toViablePocket(pocket, mergedThresholds));
    const accepted = evaluated.filter((pocket) => pocket.viability.classification !== 'reject');
    const rejected = evaluated.filter((pocket) => pocket.viability.classification === 'reject');
    return {
        evaluated,
        accepted,
        rejected,
    };
}
