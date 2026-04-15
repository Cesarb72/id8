const DEFAULT_SELECT_LIMIT = 6;
const SECONDARY_POCKET_SURVIVAL_BAND = 0.2;
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function getSetOverlap(left, right) {
    const leftSet = new Set(left.map((value) => value.toLowerCase()));
    const rightSet = new Set(right.map((value) => value.toLowerCase()));
    if (leftSet.size === 0 || rightSet.size === 0) {
        return 0;
    }
    let intersection = 0;
    for (const value of leftSet) {
        if (rightSet.has(value)) {
            intersection += 1;
        }
    }
    const unionSize = new Set([...leftSet, ...rightSet]).size;
    return unionSize > 0 ? intersection / unionSize : 0;
}
function getDominantMixChannel(profile) {
    const mix = profile.tasteSignals.hospitalityMix;
    return (Object.entries(mix).sort((left, right) => {
        if (right[1] !== left[1]) {
            return right[1] - left[1];
        }
        return left[0].localeCompare(right[0]);
    })[0]?.[0] ?? 'activity');
}
function getSecondaryVarietyGain(profile, retainedProfiles) {
    if (retainedProfiles.length === 0) {
        return 0;
    }
    const familyContrastScore = retainedProfiles.filter((entry) => entry.tasteSignals.experientialTags.some((tag) => !profile.tasteSignals.experientialTags.includes(tag))).length / retainedProfiles.length;
    const archetypeContrastScore = retainedProfiles.filter((entry) => getDominantMixChannel(entry) !== getDominantMixChannel(profile)).length / retainedProfiles.length;
    const identityContrastScore = retainedProfiles.filter((entry) => getSetOverlap(entry.categories, profile.categories) < 0.4).length / retainedProfiles.length;
    const anchorId = profile.hyperlocal?.primaryAnchor?.entityId;
    const distinctAnchorScore = anchorId &&
        retainedProfiles.every((entry) => entry.hyperlocal?.primaryAnchor?.entityId !== anchorId)
        ? 1
        : 0;
    const interpretableShapeScore = clamp((profile.hyperlocal?.primaryMicroPocket.identityStrength ?? 0.5) * 0.56 +
        (profile.hyperlocal?.primaryMicroPocket.coherenceScore ?? 0.5) * 0.44, 0, 1);
    return clamp(familyContrastScore * 0.26 +
        archetypeContrastScore * 0.24 +
        identityContrastScore * 0.2 +
        distinctAnchorScore * 0.14 +
        interpretableShapeScore * 0.16, 0, 1);
}
function buildReasons(profile) {
    return [
        `Score ${profile.score.totalScore} with viability ${profile.classification}.`,
        `${profile.entityCount} entities and ${profile.categories.length} leading categories.`,
        `Walkability ${profile.coreSignals.walkability}, density ${profile.coreSignals.density}.`,
    ];
}
export function rankAndSelectPockets(profiles, selectLimit = DEFAULT_SELECT_LIMIT) {
    const sorted = [...profiles].sort((left, right) => {
        if (right.score.totalScore !== left.score.totalScore) {
            return right.score.totalScore - left.score.totalScore;
        }
        if (right.coreSignals.viability !== left.coreSignals.viability) {
            return right.coreSignals.viability - left.coreSignals.viability;
        }
        if (right.entityCount !== left.entityCount) {
            return right.entityCount - left.entityCount;
        }
        return left.label.localeCompare(right.label);
    });
    const ranked = sorted.map((profile, index) => ({
        rank: index + 1,
        score: profile.score.totalScore,
        reasons: buildReasons(profile),
        profile,
    }));
    const baseSelected = ranked.slice(0, Math.max(1, selectLimit));
    const topScore = ranked[0]?.score ?? 0;
    const secondarySurvivors = ranked.filter((entry) => {
        if (entry.rank <= 1) {
            return false;
        }
        if (entry.profile.classification === 'weak' || entry.profile.classification === 'reject') {
            return false;
        }
        return topScore - entry.score <= SECONDARY_POCKET_SURVIVAL_BAND;
    }).sort((left, right) => {
        const leftGain = getSecondaryVarietyGain(left.profile, baseSelected.map((entry) => entry.profile));
        const rightGain = getSecondaryVarietyGain(right.profile, baseSelected.map((entry) => entry.profile));
        if (rightGain !== leftGain) {
            return rightGain - leftGain;
        }
        if (right.score !== left.score) {
            return right.score - left.score;
        }
        return left.profile.pocketId.localeCompare(right.profile.pocketId);
    });
    const selectedPocketIds = new Set();
    const selected = [...baseSelected, ...secondarySurvivors].filter((entry) => {
        if (selectedPocketIds.has(entry.profile.pocketId)) {
            return false;
        }
        selectedPocketIds.add(entry.profile.pocketId);
        return true;
    });
    return {
        ranked,
        selected,
    };
}
