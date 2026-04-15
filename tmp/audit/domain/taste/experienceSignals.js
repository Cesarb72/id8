import { getScoredVenueBaseVenueId } from '../candidates/candidateIdentity';
const DISTINCTIVE_ARCHETYPES = new Set([
    'outdoor',
    'activity',
    'culture',
    'scenic',
]);
const HOSPITALITY_ARCHETYPES = new Set([
    'dining',
    'drinks',
    'sweet',
]);
function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
export function isHighMomentPotential(value) {
    const score = typeof value === 'number' ? value : value.score;
    return score >= 0.48;
}
export function getMomentStrengthRank(strength) {
    if (strength === 'strong') {
        return 3;
    }
    if (strength === 'medium') {
        return 2;
    }
    return 1;
}
export function isStrongMomentIdentity(value) {
    return value?.strength === 'strong';
}
export function getMomentIntensityRank(tier) {
    if (tier === 'signature') {
        return 4;
    }
    if (tier === 'exceptional') {
        return 3;
    }
    if (tier === 'strong') {
        return 2;
    }
    return 1;
}
export function getMomentIntensityTierBoost(value) {
    const tier = typeof value === 'string' ? value : value.tier;
    if (tier === 'signature') {
        return 0.16;
    }
    if (tier === 'exceptional') {
        return 0.1;
    }
    if (tier === 'strong') {
        return 0.05;
    }
    return 0;
}
export function getArchetypeRepeatTolerance(archetype, tasteModeId) {
    if (!tasteModeId) {
        return 1;
    }
    if (tasteModeId === 'scenic-outdoor') {
        if (archetype === 'scenic' || archetype === 'outdoor') {
            return 0.56;
        }
        if (archetype === 'activity') {
            return 0.82;
        }
    }
    if (tasteModeId === 'activity-led') {
        if (archetype === 'activity' || archetype === 'social') {
            return 0.58;
        }
        if (archetype === 'outdoor') {
            return 0.84;
        }
    }
    if (tasteModeId === 'social-night') {
        if (archetype === 'social' || archetype === 'drinks' || archetype === 'activity') {
            return 0.72;
        }
    }
    if (tasteModeId === 'cozy-flow') {
        if (archetype === 'dining' || archetype === 'sweet') {
            return 0.82;
        }
    }
    if (tasteModeId === 'highlight-centered' && archetype === 'culture') {
        return 0.84;
    }
    return 1;
}
export function getHighlightArchetypeLift(signals, tasteModeId) {
    const primary = signals.primaryExperienceArchetype;
    const includes = (value) => signals.experienceArchetypes.includes(value);
    let lift = primary === 'scenic'
        ? 0.13
        : primary === 'outdoor'
            ? 0.11
            : primary === 'activity'
                ? 0.12
                : primary === 'culture'
                    ? 0.1
                    : primary === 'social'
                        ? 0.07
                        : primary === 'drinks'
                            ? 0.045
                            : primary === 'sweet'
                                ? 0.03
                                : 0.02;
    if (includes('scenic') && includes('outdoor')) {
        lift += 0.03;
    }
    if (includes('activity') && includes('social')) {
        lift += 0.02;
    }
    if (signals.momentPotential.score >= 0.72) {
        lift += 0.03;
    }
    else if (signals.momentPotential.score >= 0.52) {
        lift += 0.015;
    }
    if (tasteModeId === 'scenic-outdoor' && (includes('scenic') || includes('outdoor'))) {
        lift += 0.04;
    }
    if (tasteModeId === 'activity-led' && (includes('activity') || includes('social'))) {
        lift += 0.04;
    }
    if (tasteModeId === 'highlight-centered' && includes('culture')) {
        lift += 0.02;
    }
    return clamp01(lift);
}
export function getGenericHospitalityFallbackPenalty(params) {
    if (params.protectedCandidate) {
        return 0;
    }
    const categoryWeight = params.venueCategory === 'cafe'
        ? 1
        : params.venueCategory === 'dessert'
            ? 0.94
            : params.venueCategory === 'restaurant'
                ? 0.76
                : params.venueCategory === 'bar'
                    ? 0.6
                    : 0;
    if (categoryWeight === 0) {
        return 0;
    }
    const archetypePenalty = HOSPITALITY_ARCHETYPES.has(params.signals.primaryExperienceArchetype)
        ? 1
        : 0.7;
    const lowMomentRead = (1 - params.signals.momentIntensity.score) * 0.32 +
        (1 - params.signals.momentPotential.score) * 0.24;
    const lowRichness = (1 - params.signals.experientialFactor) * 0.24 +
        (1 - params.uniquenessScore) * 0.12 +
        (1 - params.distinctivenessScore) * 0.1;
    const genericRead = (1 - params.signals.categorySpecificity) * 0.18 +
        (1 - params.signals.personalityStrength) * 0.14 +
        params.signatureGenericScore * 0.12;
    const modePressure = params.tasteModeId === 'scenic-outdoor' || params.tasteModeId === 'activity-led'
        ? 0.03
        : params.tasteModeId === 'cozy-flow' && params.venueCategory !== 'cafe'
            ? -0.008
            : 0;
    return clamp01((lowMomentRead + lowRichness + genericRead) * categoryWeight * archetypePenalty * 0.18 +
        modePressure);
}
export function isGenericHospitalityFallbackCandidate(candidate) {
    const archetype = candidate.taste.signals.primaryExperienceArchetype;
    const genericCategory = candidate.venue.category === 'cafe' ||
        candidate.venue.category === 'dessert' ||
        candidate.venue.category === 'restaurant' ||
        candidate.venue.category === 'bar';
    const passiveArchetype = HOSPITALITY_ARCHETYPES.has(archetype);
    const weakMomentRead = candidate.taste.signals.momentIntensity.score < 0.78 &&
        candidate.taste.signals.momentPotential.score < 0.72 &&
        candidate.momentIdentity.strength !== 'strong';
    const lowSignalRead = candidate.taste.fallbackPenalty.signalScore >= 0.1;
    const contractCritical = candidate.roleContract.peak.satisfied &&
        (candidate.roleContract.peak.strength === 'strong' ||
            candidate.roleContract.peak.strength === 'hard');
    return genericCategory && passiveArchetype && weakMomentRead && lowSignalRead && !contractCritical;
}
function computeHighlightAlternativeStrength(candidate) {
    return (candidate.roleScores.peak * 0.34 +
        candidate.taste.signals.momentIntensity.score * 0.22 +
        candidate.taste.signals.momentPotential.score * 0.16 +
        candidate.taste.signals.experientialFactor * 0.14 +
        candidate.venue.distinctivenessScore * 0.08 +
        candidate.venue.uniquenessScore * 0.06 +
        candidate.stopShapeFit.highlight * 0.08 +
        (isGenericHospitalityFallbackCandidate(candidate) ? -0.06 : 0.04));
}
export function assessGenericHospitalityFallbackPenalty(candidate, candidates) {
    const signalScore = candidate.taste.fallbackPenalty.signalScore;
    if (!isGenericHospitalityFallbackCandidate(candidate) || signalScore <= 0) {
        return {
            appliedPenalty: 0,
            strongerAlternativePresent: false,
            reason: 'candidate not eligible for fallback suppression',
        };
    }
    const strongestAlternative = [...candidates]
        .filter((alternative) => {
        if (getScoredVenueBaseVenueId(alternative) === getScoredVenueBaseVenueId(candidate)) {
            return false;
        }
        if (alternative.highlightValidity.validityLevel === 'invalid') {
            return false;
        }
        if (alternative.roleScores.peak < 0.56 || alternative.stopShapeFit.highlight < 0.32) {
            return false;
        }
        return !isGenericHospitalityFallbackCandidate(alternative);
    })
        .sort((left, right) => {
        return (computeHighlightAlternativeStrength(right) - computeHighlightAlternativeStrength(left) ||
            right.roleScores.peak - left.roleScores.peak ||
            right.fitScore - left.fitScore);
    })[0];
    if (!strongestAlternative) {
        return {
            appliedPenalty: 0,
            strongerAlternativePresent: false,
            reason: 'no stronger non-fallback highlight available',
        };
    }
    const strengthGap = computeHighlightAlternativeStrength(strongestAlternative) -
        computeHighlightAlternativeStrength(candidate);
    if (strengthGap <= 0.045) {
        return {
            appliedPenalty: 0,
            strongerAlternativePresent: false,
            strongerAlternativeName: strongestAlternative.venue.name,
            reason: 'fallback remains competitive in this pool',
        };
    }
    return {
        appliedPenalty: clamp01(signalScore *
            (0.52 +
                Math.min(0.42, strengthGap * 0.9) +
                (strongestAlternative.taste.signals.momentIntensity.score >= 0.72 ? 0.1 : 0))),
        strongerAlternativePresent: true,
        strongerAlternativeName: strongestAlternative.venue.name,
        reason: `stronger highlight available: ${strongestAlternative.venue.name}`,
    };
}
export function getExperienceArchetypeSummary(archetypes) {
    return archetypes.join(' + ');
}
export function hasDistinctiveExperienceArchetype(archetypes) {
    return archetypes.some((archetype) => DISTINCTIVE_ARCHETYPES.has(archetype));
}
