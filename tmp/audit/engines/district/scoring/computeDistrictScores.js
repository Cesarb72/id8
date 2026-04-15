function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function toFixed(value) {
    return Number(value.toFixed(3));
}
const VIABILITY_BONUS_BY_CLASS = {
    strong: 0.09,
    usable: 0.05,
    weak: 0.01,
    reject: 0,
};
export function computeDistrictScores(fieldSignals, viabilityClass) {
    const normalizedEntityCount = clamp(fieldSignals.entityCount / 10, 0, 1);
    const fieldScore = normalizedEntityCount * 0.26 +
        fieldSignals.categoryDiversity * 0.2 +
        fieldSignals.density * 0.18 +
        fieldSignals.walkability * 0.2 +
        fieldSignals.viability * 0.16;
    const viabilityBonus = VIABILITY_BONUS_BY_CLASS[viabilityClass];
    const totalScore = clamp(fieldScore + viabilityBonus, 0, 1);
    return {
        fieldScore: toFixed(fieldScore),
        viabilityBonus: toFixed(viabilityBonus),
        totalScore: toFixed(totalScore),
    };
}
