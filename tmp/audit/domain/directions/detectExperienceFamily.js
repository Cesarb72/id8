const NEW_FAMILY_COMPETITIVE_BAND = 0.08;
const NEW_FAMILY_TIE_BREAK_BOOST = 0.015;
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function toFixed(value) {
    return Number(clamp(value, 0, 1).toFixed(3));
}
function includesAny(values, terms) {
    return values.some((value) => terms.some((term) => value.includes(term)));
}
function getCategoryDiversity(categories) {
    const uniqueCount = new Set(categories).size;
    return clamp(uniqueCount / 4, 0, 1);
}
function toLevel(value, invert = false) {
    const score = value === 'high' ? 1 : value === 'medium' ? 0.62 : 0.24;
    return invert ? 1 - score : score;
}
function getMixVariance(mix) {
    if (!mix) {
        return 0;
    }
    const values = [mix.drinks, mix.dining, mix.culture, mix.cafe, mix.activity];
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
    return clamp(variance * 18, 0, 1);
}
export function detectExperienceFamily(candidate, context) {
    const categories = (candidate.dominantCategories ?? []).map((value) => value.toLowerCase());
    const signals = (candidate.whyHereSignals ?? []).map((value) => value.toLowerCase());
    const tags = (candidate.experientialTags ?? []).map((value) => value.toLowerCase());
    const activationStrength = clamp(candidate.activationStrength ?? 0.5, 0, 1);
    const environmentalInfluencePotential = clamp(candidate.environmentalInfluencePotential ?? 0.5, 0, 1);
    const momentPotential = clamp(candidate.momentPotential ?? 0.5, 0, 1);
    const ambiance = candidate.ambianceProfile ?? {
        energy: 'medium',
        intimacy: 'medium',
        noise: 'medium',
    };
    const mix = candidate.hospitalityMix ?? {
        drinks: 0.2,
        dining: 0.2,
        culture: 0.2,
        cafe: 0.2,
        activity: 0.2,
    };
    const categoryDiversity = getCategoryDiversity(categories);
    const mixVariance = getMixVariance(candidate.hospitalityMix);
    const nightlifeLike = includesAny(categories, [
        'bar',
        'nightlife',
        'cocktail',
        'dessert',
        'brewery',
    ]);
    const cultureLike = includesAny(categories, [
        'museum',
        'gallery',
        'theater',
        'arts',
        'history',
        'exhibit',
    ]);
    const playfulLike = includesAny(categories, [
        'activity',
        'arcade',
        'game',
        'music',
        'entertainment',
    ]);
    const intimateLike = includesAny(categories, [
        'restaurant',
        'dining',
        'wine',
        'cafe',
        'tea',
    ]);
    const mixedSignal = includesAny(signals, [
        'identity_forward_mix',
        'identity_coherent_mix',
        'strong_environmental_influence',
        'baseline_micro_pocket',
    ]);
    const noveltySignal = includesAny(tags, [
        'mixed-program',
        'arts-adjacent',
        'curated',
        'intentional',
        'lively',
    ]);
    const ambientLikeSignal = includesAny(tags, ['scenic', 'calm', 'quiet', 'atmospheric', 'ambient']) ||
        includesAny(categories, ['park', 'waterfront', 'garden']) ||
        ambiance.noise === 'low';
    const eventLikeSignal = includesAny(tags, ['event', 'live', 'festival', 'show', 'spike']) ||
        includesAny(categories, ['event', 'music', 'activity']) ||
        includesAny(signals, ['high_activation_core']);
    const diningForwardSignal = includesAny(categories, ['restaurant', 'dining', 'tasting', 'wine', 'dessert']) ||
        mix.dining >= 0.32;
    const structuredTransitions = includesAny(signals, ['steady_activation_base', 'tight_walkable_micro_pocket']) ||
        includesAny(tags, ['intentional', 'curated', 'sequence', 'structured']);
    const lowActivation = 1 - activationStrength;
    const lowEnergy = toLevel(ambiance.energy, true);
    const highEnergy = toLevel(ambiance.energy);
    const lowNoise = toLevel(ambiance.noise, true);
    const intimacy = toLevel(ambiance.intimacy);
    const lowMomentum = 1 - momentPotential;
    let socialScore = activationStrength * 0.36 +
        (mix.drinks + mix.activity) * 0.26 +
        (nightlifeLike ? 0.2 : 0) +
        environmentalInfluencePotential * 0.08;
    if (context?.vibe === 'lively') {
        socialScore += 0.06;
    }
    if (context?.persona === 'friends') {
        socialScore += 0.05;
    }
    let culturalScore = mix.culture * 0.35 +
        (cultureLike ? 0.24 : 0) +
        lowActivation * 0.14 +
        (includesAny(signals, ['identity_coherent_mix']) ? 0.09 : 0) +
        (tags.includes('arts-adjacent') ? 0.08 : 0);
    if (context?.vibe === 'cultured') {
        culturalScore += 0.06;
    }
    if (context?.persona === 'family') {
        culturalScore += 0.04;
    }
    let playfulScore = mix.activity * 0.31 +
        activationStrength * 0.23 +
        environmentalInfluencePotential * 0.14 +
        (playfulLike ? 0.16 : 0) +
        (noveltySignal ? 0.08 : 0) +
        categoryDiversity * 0.08;
    if (context?.vibe === 'lively') {
        playfulScore += 0.04;
    }
    let intimateScore = (mix.dining + mix.cafe) * 0.31 +
        lowActivation * 0.24 +
        (intimateLike ? 0.18 : 0) +
        ((signals.includes('tight_walkable_micro_pocket') ||
            signals.includes('steady_activation_base'))
            ? 0.1
            : 0) +
        (environmentalInfluencePotential < 0.55 ? 0.07 : 0);
    if (context?.vibe === 'cozy') {
        intimateScore += 0.06;
    }
    if (context?.persona === 'romantic') {
        intimateScore += 0.05;
    }
    let exploratoryScore = categoryDiversity * 0.32 +
        environmentalInfluencePotential * 0.18 +
        mix.culture * 0.12 +
        mix.activity * 0.1 +
        (mixedSignal ? 0.14 : 0) +
        (noveltySignal ? 0.1 : 0);
    if (context?.vibe === 'cultured') {
        exploratoryScore += 0.03;
    }
    if (context?.persona === 'friends') {
        exploratoryScore += 0.02;
    }
    let ambientScore = lowActivation * 0.2 +
        lowMomentum * 0.16 +
        lowNoise * 0.16 +
        lowEnergy * 0.12 +
        (mix.culture + mix.cafe) * 0.18 +
        (ambientLikeSignal ? 0.14 : 0) +
        (mix.activity < 0.22 ? 0.08 : 0) -
        (mix.activity > 0.36 ? 0.12 : 0);
    if (context?.vibe === 'cozy' || context?.vibe === 'chill') {
        ambientScore += 0.04;
    }
    let eventfulScore = activationStrength * 0.21 +
        momentPotential * 0.24 +
        mix.activity * 0.2 +
        highEnergy * 0.14 +
        (eventLikeSignal ? 0.15 : 0) +
        (nightlifeLike ? 0.08 : 0) -
        ((mix.activity < 0.18 ? 0.1 : 0) + (ambiance.energy === 'low' ? 0.06 : 0));
    if (context?.vibe === 'lively') {
        eventfulScore += 0.05;
    }
    let ritualScore = (mix.dining + mix.cafe) * 0.2 +
        (structuredTransitions ? 0.22 : 0) +
        (1 - mixVariance) * 0.16 +
        (categoryDiversity < 0.52 ? 0.1 : 0) +
        (ambiance.energy !== 'high' ? 0.12 : 0) +
        (ambiance.noise !== 'high' ? 0.1 : 0) +
        (activationStrength >= 0.4 && activationStrength <= 0.68 ? 0.08 : 0) -
        (mix.activity > 0.42 ? 0.1 : 0);
    if (context?.persona === 'family') {
        ritualScore += 0.03;
    }
    let indulgentScore = mix.dining * 0.3 +
        (1 - mix.activity) * 0.18 +
        lowMomentum * 0.1 +
        intimacy * 0.13 +
        environmentalInfluencePotential * 0.11 +
        (diningForwardSignal ? 0.12 : 0) +
        (ambiance.noise === 'low' ? 0.07 : 0) -
        ((mix.activity > 0.38 ? 0.1 : 0) + (categoryDiversity > 0.78 ? 0.06 : 0));
    if (context?.persona === 'romantic' || context?.vibe === 'cozy') {
        indulgentScore += 0.03;
    }
    const ambientTieBreakEligible = mix.activity <= 0.24 && (ambiance.energy === 'low' || ambiance.noise === 'low');
    const ritualTieBreakEligible = mix.dining + mix.cafe >= 0.34 &&
        mix.dining + mix.cafe <= 0.62 &&
        activationStrength >= 0.38 &&
        activationStrength <= 0.7 &&
        !(ambiance.energy === 'high' && ambiance.noise === 'high');
    const indulgentTieBreakEligible = mix.dining >= 0.32 && mix.activity <= 0.24;
    if (ambientTieBreakEligible) {
        ambientScore += NEW_FAMILY_TIE_BREAK_BOOST;
    }
    if (ritualTieBreakEligible) {
        ritualScore += NEW_FAMILY_TIE_BREAK_BOOST;
    }
    if (indulgentTieBreakEligible) {
        indulgentScore += NEW_FAMILY_TIE_BREAK_BOOST;
    }
    socialScore = clamp(socialScore, 0, 1);
    culturalScore = clamp(culturalScore, 0, 1);
    playfulScore = clamp(playfulScore, 0, 1);
    intimateScore = clamp(intimateScore, 0, 1);
    exploratoryScore = clamp(exploratoryScore, 0, 1);
    ambientScore = clamp(ambientScore, 0, 1);
    eventfulScore = clamp(eventfulScore, 0, 1);
    ritualScore = clamp(ritualScore, 0, 1);
    indulgentScore = clamp(indulgentScore, 0, 1);
    const ranked = [
        { family: 'social', score: socialScore },
        { family: 'cultural', score: culturalScore },
        { family: 'playful', score: playfulScore },
        { family: 'intimate', score: intimateScore },
        { family: 'exploratory', score: exploratoryScore },
        { family: 'ambient', score: ambientScore },
        { family: 'eventful', score: eventfulScore },
        { family: 'ritual', score: ritualScore },
        { family: 'indulgent', score: indulgentScore },
    ].sort((left, right) => {
        if (right.score !== left.score) {
            return right.score - left.score;
        }
        return left.family.localeCompare(right.family);
    });
    const legacyFamilies = new Set([
        'social',
        'cultural',
        'playful',
        'intimate',
        'exploratory',
    ]);
    const newFamilies = new Set([
        'ambient',
        'eventful',
        'ritual',
        'indulgent',
    ]);
    const provisionalWinner = ranked[0];
    const provisionalRunnerUp = ranked[1];
    const topLegacyCandidate = ranked.find((entry) => legacyFamilies.has(entry.family)) ?? provisionalRunnerUp;
    const winner = newFamilies.has(provisionalWinner.family) &&
        topLegacyCandidate &&
        provisionalWinner.score - topLegacyCandidate.score < -NEW_FAMILY_COMPETITIVE_BAND
        ? topLegacyCandidate
        : provisionalWinner;
    const runnerUp = ranked.find((entry) => entry.family !== winner.family) ?? provisionalRunnerUp;
    const confidence = toFixed(clamp(0.42 + winner.score * 0.38 + (winner.score - runnerUp.score) * 0.42, 0, 1));
    return {
        family: winner.family,
        confidence,
    };
}
