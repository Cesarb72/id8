function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function toFixed(value) {
    return Number(value.toFixed(3));
}
const MIN_SHAPING_BOOST = -0.12;
const MAX_SHAPING_BOOST = 0.12;
const MIN_FAMILY_BIAS = -0.035;
const MAX_FAMILY_BIAS = 0.035;
const POST_SHAPING_MAX_SPREAD = 0.12;
function isSupportedPrimaryVibe(vibe) {
    return vibe === 'cozy' || vibe === 'lively' || vibe === 'playful' || vibe === 'cultured';
}
function hasFlowSignal(seed) {
    const lowered = seed.toLowerCase();
    return lowered.includes('->') || lowered.includes('\u2192') || lowered.includes(' then ');
}
function hasSeedTerm(seeds, terms) {
    return seeds.some((seed) => terms.some((term) => seed.includes(term)));
}
function computeCategoryDiversity(candidate) {
    const mix = candidate.derivedFrom.hospitalityMix;
    const activeCategories = [mix.drinks, mix.dining, mix.culture, mix.cafe, mix.activity].filter((value) => value >= 0.14).length;
    return clamp(activeCategories / 5, 0, 1);
}
function computeNonDominantCategoryInclusion(candidate) {
    const mixValues = Object.values(candidate.derivedFrom.hospitalityMix);
    const dominant = Math.max(...mixValues);
    const remainder = clamp(1 - dominant, 0, 1);
    return clamp(remainder / 0.8, 0, 1);
}
function computeFamilyBias(candidate) {
    const family = candidate.experienceFamily;
    const confidence = candidate.familyConfidence;
    const mix = candidate.derivedFrom.hospitalityMix;
    const ambiance = candidate.derivedFrom.ambianceProfile;
    const seeds = candidate.derivedFrom.momentSeeds.map((seed) => seed.toLowerCase());
    const tags = new Set(candidate.derivedFrom.experientialTags.map((tag) => tag.toLowerCase()));
    const activationStrength = candidate.derivedFrom.hyperlocal?.primaryMicroPocket.activationStrength ?? 0.5;
    const environmentalInfluence = candidate.derivedFrom.hyperlocal?.primaryMicroPocket.environmentalInfluencePotential ?? 0.5;
    const diversityScore = computeCategoryDiversity(candidate);
    const nonDominantInclusion = computeNonDominantCategoryInclusion(candidate);
    const nightlifeSignal = hasSeedTerm(seeds, [
        'night',
        'late',
        'bar',
        'cocktail',
        'wine',
        'music',
    ]);
    const structuredTransitions = seeds.some((seed) => hasFlowSignal(seed));
    const movementFriendly = computeMovementFriendlyScore(candidate);
    const calmScenicSignal = tags.has('scenic') ||
        tags.has('calm') ||
        tags.has('quiet') ||
        tags.has('atmospheric');
    const eventSpikeSignal = tags.has('event') ||
        tags.has('live') ||
        tags.has('festival') ||
        tags.has('show') ||
        seeds.some((seed) => ['event', 'live', 'show', 'festival', 'set', 'headline'].some((term) => seed.includes(term)));
    const balancedMixSignal = Math.max(mix.dining, mix.cafe, mix.culture, mix.drinks, mix.activity) -
        Math.min(mix.dining, mix.cafe, mix.culture, mix.drinks, mix.activity) <
        0.28;
    const noveltySignal = hasSeedTerm(seeds, ['detour', 'wander', 'switch-up', 'discovery', 'gallery']) ||
        tags.has('mixed-program') ||
        tags.has('offbeat');
    const chaoticOverlap = activationStrength >= 0.66 &&
        (ambiance.energy === 'high' || ambiance.noise === 'high') &&
        mix.activity >= 0.34;
    let rawBias = 0;
    if (family === 'social') {
        rawBias =
            activationStrength * 0.02 +
                (mix.drinks + mix.activity) * 0.015 +
                (nightlifeSignal ? 0.009 : 0) -
                ((ambiance.energy === 'low' ? 0.007 : 0) + (mix.activity < 0.2 ? 0.005 : 0));
    }
    else if (family === 'cultural') {
        rawBias =
            mix.culture * 0.019 +
                (structuredTransitions ? 0.01 : 0) +
                (tags.has('arts-adjacent') ? 0.008 : 0) -
                (chaoticOverlap ? 0.011 : 0);
    }
    else if (family === 'playful') {
        const diningLinearPenalty = mix.dining >= 0.4 &&
            mix.activity < 0.2 &&
            mix.drinks < 0.18 &&
            !noveltySignal
            ? 0.012
            : 0;
        rawBias =
            mix.activity * 0.018 +
                diversityScore * 0.01 +
                environmentalInfluence * 0.008 +
                (noveltySignal ? 0.01 : 0) -
                diningLinearPenalty;
    }
    else if (family === 'intimate') {
        const highDensityHighEnergyPenalty = (activationStrength >= 0.68 ? 0.008 : 0) +
            (ambiance.energy === 'high' ? 0.008 : 0) +
            (ambiance.noise === 'high' ? 0.007 : 0);
        rawBias =
            (mix.dining + mix.cafe) * 0.017 +
                (ambiance.noise === 'low' ? 0.01 : ambiance.noise === 'medium' ? 0.004 : 0) +
                (ambiance.energy === 'low' ? 0.01 : ambiance.energy === 'medium' ? 0.004 : 0) -
                highDensityHighEnergyPenalty;
    }
    else if (family === 'ambient') {
        rawBias =
            (ambiance.noise === 'low' ? 0.014 : ambiance.noise === 'medium' ? 0.006 : 0) +
                (ambiance.energy === 'low' ? 0.013 : ambiance.energy === 'medium' ? 0.005 : 0) +
                (calmScenicSignal ? 0.01 : 0) +
                (mix.culture + mix.cafe) * 0.01 -
                (mix.activity * 0.014 + (activationStrength > 0.68 ? 0.01 : 0));
    }
    else if (family === 'eventful') {
        rawBias =
            mix.activity * 0.017 +
                candidate.derivedFrom.momentPotential * 0.016 +
                activationStrength * 0.012 +
                (ambiance.energy === 'high' ? 0.01 : 0) +
                (eventSpikeSignal ? 0.01 : 0) -
                ((ambiance.energy === 'low' ? 0.012 : 0) + (mix.activity < 0.18 ? 0.01 : 0));
    }
    else if (family === 'ritual') {
        const chaosPenalty = (diversityScore > 0.82 ? 0.01 : 0) +
            (ambiance.energy === 'high' && mix.activity > 0.36 ? 0.01 : 0);
        rawBias =
            (mix.dining + mix.cafe) * 0.011 +
                (structuredTransitions ? 0.014 : 0) +
                (balancedMixSignal ? 0.009 : 0) +
                (activationStrength >= 0.42 && activationStrength <= 0.68 ? 0.008 : 0) -
                chaosPenalty;
    }
    else if (family === 'indulgent') {
        const fragmentedMixPenalty = diversityScore > 0.84 && mix.activity > 0.28 ? 0.012 : 0;
        rawBias =
            mix.dining * 0.02 +
                (1 - movementFriendly) * 0.012 +
                (1 - mix.activity) * 0.01 +
                (ambiance.intimacy === 'high' ? 0.008 : 0) -
                (mix.activity * 0.014 + fragmentedMixPenalty);
    }
    else if (family === 'exploratory') {
        rawBias =
            diversityScore * 0.018 +
                nonDominantInclusion * 0.012 +
                environmentalInfluence * 0.008 +
                (noveltySignal ? 0.007 : 0);
    }
    else {
        rawBias =
            diversityScore * 0.018 +
                nonDominantInclusion * 0.012 +
                environmentalInfluence * 0.008 +
                (noveltySignal ? 0.007 : 0);
    }
    const confidenceScale = 0.55 + confidence * 0.45;
    return clamp(rawBias * confidenceScale, MIN_FAMILY_BIAS, MAX_FAMILY_BIAS);
}
function computeSequenceQuality(candidate) {
    const seeds = candidate.derivedFrom.momentSeeds.filter((seed) => seed.trim().length > 0);
    const mix = candidate.derivedFrom.hospitalityMix;
    const seedCountSignal = seeds.length >= 3 ? 0.42 : seeds.length >= 2 ? 0.32 : 0;
    const flowSignal = seeds.some((seed) => hasFlowSignal(seed)) ? 0.33 : 0;
    const diversityCount = Object.values(mix).filter((value) => value >= 0.16).length;
    const balancedMixSignal = mix.activity <= 0.5 && diversityCount >= 3 ? 0.25 : mix.activity <= 0.55 && diversityCount >= 2 ? 0.15 : 0;
    return clamp(seedCountSignal + flowSignal + balancedMixSignal, 0, 1);
}
function computeDiversityScore(candidate) {
    const mix = candidate.derivedFrom.hospitalityMix;
    const diversityCount = Object.values(mix).filter((value) => value >= 0.14).length;
    return clamp(diversityCount / 5, 0, 1);
}
function computeMovementFriendlyScore(candidate) {
    const seeds = candidate.derivedFrom.momentSeeds;
    const flowSignal = seeds.some((seed) => hasFlowSignal(seed)) ? 0.45 : 0;
    const multiStageSignal = seeds.length >= 2 ? 0.35 : 0;
    const energySignal = candidate.derivedFrom.ambianceProfile.energy === 'high'
        ? 0.2
        : candidate.derivedFrom.ambianceProfile.energy === 'medium'
            ? 0.1
            : 0;
    return clamp(flowSignal + multiStageSignal + energySignal, 0, 1);
}
function computeNoveltyScore(candidate) {
    const tags = new Set(candidate.derivedFrom.experientialTags.map((tag) => tag.toLowerCase()));
    const seeds = candidate.derivedFrom.momentSeeds.map((seed) => seed.toLowerCase());
    const tagSignal = ['mixed-program', 'arts-adjacent', 'offbeat', 'curated'].some((tag) => tags.has(tag))
        ? 0.55
        : 0;
    const seedSignal = seeds.some((seed) => ['detour', 'stroll', 'wander', 'discovery', 'gallery'].some((term) => seed.includes(term)))
        ? 0.45
        : 0;
    return clamp(tagSignal + seedSignal, 0, 1);
}
function computeVibeBoost(candidate, vibe) {
    const tags = new Set(candidate.derivedFrom.experientialTags.map((tag) => tag.toLowerCase()));
    const mix = candidate.derivedFrom.hospitalityMix;
    const ambiance = candidate.derivedFrom.ambianceProfile;
    const sequenceQuality = computeSequenceQuality(candidate);
    const diversityScore = computeDiversityScore(candidate);
    const movementFriendly = computeMovementFriendlyScore(candidate);
    const noveltyScore = computeNoveltyScore(candidate);
    const mixedProgram = tags.has('mixed-program');
    const activityLed = tags.has('activity-led');
    if (vibe === 'cozy') {
        const intimacyBoost = ambiance.intimacy === 'high' ? 0.06 : ambiance.intimacy === 'medium' ? 0.03 : 0;
        const noiseBoost = ambiance.noise === 'low' ? 0.06 : ambiance.noise === 'medium' ? 0.035 : 0;
        const energyBoost = ambiance.energy === 'low' ? 0.05 : ambiance.energy === 'medium' ? 0.03 : 0;
        const comfortMixBoost = mix.dining * 0.04 + mix.cafe * 0.05 + mix.culture * 0.04;
        const sequenceBoost = sequenceQuality * 0.08;
        const activityPenalty = mix.activity > 0.38 ? 0.07 : mix.activity > 0.3 ? 0.04 : 0;
        const movementPenalty = movementFriendly > 0.75 && mix.activity > 0.36 ? 0.05 : 0;
        const socialNoisePenalty = ambiance.noise === 'high'
            ? 0.07
            : ambiance.noise === 'medium' && mix.drinks + mix.activity > 0.5
                ? 0.04
                : 0;
        const activityLedPenalty = activityLed ? 0.05 : 0;
        const broadMixedProgramPenalty = mixedProgram && movementFriendly > 0.85 && mix.activity > 0.34 ? 0.03 : 0;
        return clamp(intimacyBoost +
            noiseBoost +
            energyBoost +
            comfortMixBoost +
            sequenceBoost -
            activityPenalty -
            movementPenalty -
            socialNoisePenalty -
            activityLedPenalty -
            broadMixedProgramPenalty, MIN_SHAPING_BOOST, MAX_SHAPING_BOOST);
    }
    if (vibe === 'lively') {
        const seeds = candidate.derivedFrom.momentSeeds.map((seed) => seed.toLowerCase());
        const romanticLivelyContext = candidate.shapingDebug?.persona === 'romantic';
        if (romanticLivelyContext) {
            // Romantic+lively is intentionally tuned as a persona modifier, not as a global lively model.
            const hasNightlifeCarrySeed = hasSeedTerm(seeds, [
                'wine bar',
                'cocktail',
                'late',
                'music',
                'bar',
            ]);
            const hasSceneEdgeSeed = hasSeedTerm(seeds, ['gallery', 'detour', 'stroll', 'wander', 'speakeasy']);
            const energyBoost = ambiance.energy === 'high' ? 0.04 : ambiance.energy === 'medium' ? 0.03 : 0;
            const sharedMomentumBoost = sequenceQuality * 0.025 +
                movementFriendly * 0.015 +
                candidate.derivedFrom.momentPotential * 0.015;
            const nightlifeCarryBoost = mix.drinks * 0.04 + mix.activity * 0.055 + (hasNightlifeCarrySeed ? 0.02 : 0);
            const socialWarmthBoost = (ambiance.intimacy === 'high' ? 0.018 : ambiance.intimacy === 'medium' ? 0.01 : 0) +
                (mix.dining + mix.culture) * 0.012;
            const sceneCredibilityBoost = (tags.has('arts-adjacent') ? 0.015 : 0) +
                (tags.has('lively') ? 0.01 : 0) +
                (hasSceneEdgeSeed ? 0.015 : 0) +
                (activityLed && ambiance.intimacy === 'high' && sequenceQuality >= 0.55 && ambiance.noise !== 'high'
                    ? 0.03
                    : 0);
            const noisePenalty = ambiance.noise === 'high' ? 0.08 : ambiance.noise === 'medium' ? 0.035 : 0;
            const activityBreadthPenalty = mix.activity > 0.4 ? 0.02 : mix.activity > 0.36 ? 0.01 : 0;
            const mixedProgramChaosPenalty = mixedProgram ? 0.04 : 0;
            const activityLedMismatchPenalty = activityLed && (sequenceQuality < 0.55 || ambiance.intimacy === 'low') ? 0.04 : 0;
            const chaoticEnergyPenalty = ambiance.energy === 'high' && ambiance.noise === 'high' ? 0.03 : 0;
            const antiSaturationOffset = 0.03;
            return clamp(energyBoost +
                sharedMomentumBoost +
                nightlifeCarryBoost +
                socialWarmthBoost +
                sceneCredibilityBoost -
                noisePenalty -
                activityBreadthPenalty -
                mixedProgramChaosPenalty -
                activityLedMismatchPenalty -
                chaoticEnergyPenalty -
                antiSaturationOffset, MIN_SHAPING_BOOST, MAX_SHAPING_BOOST);
        }
        // TODO(non-romantic-lively): calibrate universal lively behavior separately for friends/family passes.
        const energyBoost = ambiance.energy === 'high' ? 0.07 : ambiance.energy === 'medium' ? 0.045 : 0;
        const drinksActivityBoost = mix.drinks * 0.06 + mix.activity * 0.085;
        const socialDensity = clamp((mix.drinks + mix.activity) * 0.55 +
            (ambiance.energy === 'high' ? 0.18 : ambiance.energy === 'medium' ? 0.1 : 0) +
            candidate.derivedFrom.momentPotential * 0.25, 0, 1);
        const socialDensityBoost = socialDensity * 0.045;
        const movementBoost = movementFriendly * 0.035;
        const activityLedBoost = activityLed ? 0.035 : 0;
        const quietPenalty = ambiance.energy === 'low' ? 0.06 : ambiance.noise === 'low' ? 0.04 : 0;
        const mixedProgramPenalty = mixedProgram && movementFriendly > 0.8 ? 0.03 : 0;
        const livelyOffset = 0.045;
        return clamp(energyBoost +
            drinksActivityBoost +
            socialDensityBoost +
            movementBoost +
            activityLedBoost -
            quietPenalty -
            mixedProgramPenalty -
            livelyOffset, MIN_SHAPING_BOOST, MAX_SHAPING_BOOST);
    }
    if (vibe === 'playful') {
        const noveltyBoost = noveltyScore * 0.1;
        const activityBoost = mix.activity * 0.1;
        const diversityBoost = diversityScore * 0.08;
        const detourSeedBoost = candidate.derivedFrom.momentSeeds.some((seed) => ['detour', 'stroll', 'wander', 'discovery', 'switch-up'].some((term) => seed.toLowerCase().includes(term)))
            ? 0.07
            : 0;
        const mixedProgramBoost = mixedProgram ? 0.06 : 0;
        const formalPenalty = mix.activity < 0.2 && mix.dining + mix.culture > 0.62 && ambiance.energy === 'low' ? 0.07 : 0;
        const narrowPenalty = diversityScore < 0.34 ? 0.05 : 0;
        return clamp(noveltyBoost +
            activityBoost +
            diversityBoost +
            detourSeedBoost +
            mixedProgramBoost -
            formalPenalty -
            narrowPenalty, MIN_SHAPING_BOOST, MAX_SHAPING_BOOST);
    }
    const seeds = candidate.derivedFrom.momentSeeds.map((seed) => seed.toLowerCase());
    const romanticCulturedContext = candidate.shapingDebug?.persona === 'romantic';
    if (romanticCulturedContext) {
        // Romantic+cultured is intentionally tuned as a persona modifier, not as a global cultured model.
        const hasIntentionalTag = tags.has('intentional') || tags.has('curated');
        const hasFlowSeed = seeds.some((seed) => hasFlowSignal(seed));
        const hasCulturalSeed = hasSeedTerm(seeds, [
            'gallery',
            'museum',
            'performance',
            'historic',
            'architecture',
            'wine bar',
            'stroll',
        ]);
        const contradictionPressure = (activityLed ? 0.35 : 0) +
            (mixedProgram && mix.activity > 0.36 ? 0.25 : mixedProgram ? 0.12 : 0) +
            (ambiance.noise === 'high' ? 0.3 : 0) +
            (mix.activity > 0.42 ? 0.2 : mix.activity > 0.36 ? 0.12 : 0);
        const aestheticCoherence = clamp((tags.has('arts-adjacent') ? 0.32 : 0) +
            (hasIntentionalTag ? 0.22 : 0) +
            (hasFlowSeed ? 0.2 : 0) +
            (hasCulturalSeed ? 0.18 : 0) -
            contradictionPressure, 0, 1);
        const conversationFriendlyPacing = clamp((ambiance.noise === 'low' ? 1 : ambiance.noise === 'medium' ? 0.65 : 0.25) *
            (ambiance.intimacy === 'high' ? 1 : ambiance.intimacy === 'medium' ? 0.7 : 0.35), 0, 1);
        const cultureBoost = mix.culture * 0.08;
        const sequenceBoost = sequenceQuality * 0.05;
        const intimacyBoost = ambiance.intimacy === 'high' ? 0.02 : ambiance.intimacy === 'medium' ? 0.012 : 0;
        const momentPotentialBoost = candidate.derivedFrom.momentPotential * 0.015;
        const artsIntentionalBoost = (tags.has('arts-adjacent') ? 0.015 : 0) +
            (hasIntentionalTag ? 0.015 : 0) +
            (hasFlowSeed ? 0.01 : 0);
        const aestheticCoherenceBoost = aestheticCoherence * 0.03;
        const conversationBoost = conversationFriendlyPacing * 0.02;
        const romanticSynergyBoost = sequenceQuality * 0.012 + (ambiance.intimacy === 'high' ? 0.008 : 0);
        const activityLedPenalty = activityLed ? 0.07 : 0;
        const mixedProgramChaosPenalty = mixedProgram && (mix.activity > 0.36 || ambiance.noise === 'high') ? 0.05 : mixedProgram ? 0.025 : 0;
        const noiseMismatchPenalty = ambiance.noise === 'high' && (mix.culture < 0.24 || ambiance.intimacy !== 'high')
            ? 0.06
            : ambiance.noise === 'medium' && mix.culture < 0.18
                ? 0.025
                : 0;
        const broadActivityPenalty = mix.activity > 0.42 ? 0.05 : mix.activity > 0.36 ? 0.03 : 0;
        const antiSaturationOffset = 0.04;
        return clamp(cultureBoost +
            sequenceBoost +
            intimacyBoost +
            momentPotentialBoost +
            artsIntentionalBoost +
            aestheticCoherenceBoost +
            conversationBoost +
            romanticSynergyBoost -
            activityLedPenalty -
            mixedProgramChaosPenalty -
            noiseMismatchPenalty -
            broadActivityPenalty -
            antiSaturationOffset, MIN_SHAPING_BOOST, MAX_SHAPING_BOOST);
    }
    // TODO(non-romantic-cultured): calibrate universal cultured behavior separately for friends/family passes.
    const cultureBoost = mix.culture * 0.17;
    const sequenceBoost = sequenceQuality * 0.12;
    const intimacyBoost = ambiance.intimacy === 'high' ? 0.05 : ambiance.intimacy === 'medium' ? 0.03 : 0;
    const artsTagBoost = tags.has('arts-adjacent') ? 0.07 : tags.has('curated') ? 0.04 : 0;
    const intentionalPacingBoost = tags.has('intentional') || tags.has('curated') || candidate.derivedFrom.momentSeeds.some((seed) => hasFlowSignal(seed))
        ? 0.08
        : 0.01;
    const genericActivityPenalty = mix.activity > 0.38 ? 0.08 : mix.activity > 0.3 ? 0.05 : 0;
    const activityLedPenalty = activityLed ? 0.08 : 0;
    const weakCulturePenalty = mix.culture < 0.2 ? 0.05 : 0;
    const weakIntentionalPenalty = sequenceQuality < 0.55 ? 0.05 : 0;
    return clamp(cultureBoost +
        sequenceBoost +
        intimacyBoost +
        artsTagBoost +
        intentionalPacingBoost -
        genericActivityPenalty -
        activityLedPenalty -
        weakCulturePenalty -
        weakIntentionalPenalty -
        0.02, MIN_SHAPING_BOOST, MAX_SHAPING_BOOST);
}
function shapeSubtitleForVibe(subtitle, vibe) {
    if (vibe === 'cozy') {
        return /softer|slower|intimate|quiet/i.test(subtitle)
            ? subtitle
            : `${subtitle} Softer, slower shared pacing.`;
    }
    if (vibe === 'lively') {
        return /energetic|active|momentum|shared/i.test(subtitle)
            ? subtitle
            : `${subtitle} Energetic, shared momentum.`;
    }
    if (vibe === 'playful') {
        return /curious|detour|playful|explor/i.test(subtitle)
            ? subtitle
            : `${subtitle} Curious pacing with room for detours.`;
    }
    return /intentional|arts-forward|thoughtful|curated/i.test(subtitle)
        ? subtitle
        : `${subtitle} Intentional, arts-forward pacing.`;
}
function shouldPreserveExperienceSubtitle(candidate) {
    return (candidate.directionPrimaryIdentitySource.startsWith('contract:') ||
        candidate.directionPrimaryIdentitySource.startsWith('strategy:'));
}
export function applyVibeShaping(candidates, vibe) {
    const supportedVibe = isSupportedPrimaryVibe(vibe);
    const prelimShaped = candidates.map((candidate) => {
        const baseScore = typeof candidate.finalScore === 'number' ? candidate.finalScore : candidate.confidence;
        const vibeBoost = supportedVibe ? computeVibeBoost(candidate, vibe) : 0;
        const familyBias = computeFamilyBias(candidate);
        const shapedScoreBeforeCompression = baseScore + vibeBoost + familyBias;
        return {
            ...candidate,
            subtitle: supportedVibe && !shouldPreserveExperienceSubtitle(candidate)
                ? shapeSubtitleForVibe(candidate.subtitle, vibe)
                : candidate.subtitle,
            finalScore: shapedScoreBeforeCompression,
            shapingDebug: {
                persona: candidate.shapingDebug?.persona,
                personaBoost: candidate.shapingDebug?.personaBoost,
                vibe,
                vibeBoost: toFixed(vibeBoost),
                family: candidate.experienceFamily,
                familyConfidence: candidate.familyConfidence,
                familyBias: toFixed(familyBias),
                shapedScoreBeforeCompression: toFixed(shapedScoreBeforeCompression),
                shapedScoreAfterCompression: toFixed(shapedScoreBeforeCompression),
                compressionApplied: false,
                compressionDelta: 0,
                finalScore: toFixed(shapedScoreBeforeCompression),
            },
        };
    });
    const topShapedScore = prelimShaped.reduce((maxValue, candidate) => candidate.finalScore > maxValue ? candidate.finalScore : maxValue, Number.NEGATIVE_INFINITY);
    const shaped = prelimShaped.map((candidate) => {
        const shapedScoreBeforeCompression = candidate.finalScore;
        const spread = topShapedScore - shapedScoreBeforeCompression;
        const shapedScoreAfterCompression = spread > POST_SHAPING_MAX_SPREAD
            ? topShapedScore - POST_SHAPING_MAX_SPREAD
            : shapedScoreBeforeCompression;
        const compressionDelta = shapedScoreAfterCompression - shapedScoreBeforeCompression;
        const compressionApplied = compressionDelta > 0.0005;
        return {
            ...candidate,
            finalScore: shapedScoreAfterCompression,
            shapingDebug: {
                ...candidate.shapingDebug,
                shapedScoreBeforeCompression: toFixed(shapedScoreBeforeCompression),
                shapedScoreAfterCompression: toFixed(shapedScoreAfterCompression),
                compressionApplied,
                compressionDelta: toFixed(compressionDelta),
                finalScore: toFixed(shapedScoreAfterCompression),
            },
        };
    });
    if (!supportedVibe) {
        return shaped;
    }
    return shaped.slice().sort((left, right) => {
        if (right.finalScore !== left.finalScore) {
            return right.finalScore - left.finalScore;
        }
        if (right.confidence !== left.confidence) {
            return right.confidence - left.confidence;
        }
        return left.pocketId.localeCompare(right.pocketId);
    });
}
