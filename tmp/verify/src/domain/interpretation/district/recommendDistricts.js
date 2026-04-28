import { resolveDistrictAnchor } from './resolveDistrictAnchor';
import { generateDistrictExplanation } from './generateDistrictExplanation';
import { generateDistrictInsider } from './generateDistrictInsider';
import { getVenueClusterId } from '../../spatial/getVenueClusterId';
function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
function roundToHundredths(value) {
    return Number(value.toFixed(2));
}
function normalizeWeights(weights) {
    const minFloor = 0.15;
    const floored = {
        start: Math.max(minFloor, weights.start),
        highlight: Math.max(minFloor, weights.highlight),
        winddown: Math.max(minFloor, weights.winddown),
    };
    const total = floored.start + floored.highlight + floored.winddown;
    if (total <= 0) {
        return { start: 0.33, highlight: 0.34, winddown: 0.33 };
    }
    return {
        start: floored.start / total,
        highlight: floored.highlight / total,
        winddown: floored.winddown / total,
    };
}
function getRoleWeights(intent) {
    let weights;
    switch (intent.primaryAnchor) {
        case 'cozy':
            weights = { start: 0.42, highlight: 0.2, winddown: 0.38 };
            break;
        case 'lively':
            weights = { start: 0.2, highlight: 0.6, winddown: 0.2 };
            break;
        case 'cultured':
            weights = { start: 0.4, highlight: 0.35, winddown: 0.25 };
            break;
        case 'playful':
            weights = { start: 0.24, highlight: 0.56, winddown: 0.2 };
            break;
        case 'chill':
            weights = { start: 0.34, highlight: 0.2, winddown: 0.46 };
            break;
        case 'adventurous-outdoor':
            weights = { start: 0.36, highlight: 0.4, winddown: 0.24 };
            break;
        case 'adventurous-urban':
            weights = { start: 0.3, highlight: 0.45, winddown: 0.25 };
            break;
        default:
            weights = { start: 0.33, highlight: 0.34, winddown: 0.33 };
            break;
    }
    if (intent.crew === 'romantic') {
        weights = {
            start: weights.start + 0.02,
            highlight: weights.highlight - 0.06,
            winddown: weights.winddown + 0.04,
        };
    }
    else if (intent.crew === 'curator') {
        weights = {
            start: weights.start + 0.04,
            highlight: weights.highlight - 0.06,
            winddown: weights.winddown + 0.02,
        };
    }
    else {
        weights = {
            start: weights.start - 0.03,
            highlight: weights.highlight + 0.07,
            winddown: weights.winddown - 0.04,
        };
    }
    return normalizeWeights(weights);
}
function getViableCandidates(rolePools, scoredVenues) {
    const candidatesById = new Map();
    for (const pool of [
        rolePools.warmup,
        rolePools.peak,
        rolePools.cooldown,
        rolePools.wildcard,
    ]) {
        for (const candidate of pool) {
            candidatesById.set(candidate.venue.id, candidate);
        }
    }
    if (candidatesById.size > 0) {
        return [...candidatesById.values()];
    }
    return scoredVenues.slice(0, 20);
}
function getDistrictGroups(viableCandidates, rolePools, intent) {
    const warmupIds = new Set(rolePools.warmup.map((candidate) => candidate.venue.id));
    const peakIds = new Set(rolePools.peak.map((candidate) => candidate.venue.id));
    const cooldownIds = new Set(rolePools.cooldown.map((candidate) => candidate.venue.id));
    const groups = new Map();
    for (const candidate of viableCandidates) {
        const clusterId = getVenueClusterId(candidate.venue);
        const districtIdentity = resolveDistrictAnchor({
            city: intent.city,
            district: clusterId,
        });
        const current = groups.get(districtIdentity.districtId) ?? {
            districtId: districtIdentity.districtId,
            label: districtIdentity.districtLabel,
            candidates: [],
            coreRolePresence: {
                warmup: false,
                peak: false,
                cooldown: false,
            },
            categories: new Set(),
        };
        current.candidates.push(candidate);
        current.categories.add(candidate.venue.category);
        current.coreRolePresence.warmup =
            current.coreRolePresence.warmup || warmupIds.has(candidate.venue.id);
        current.coreRolePresence.peak =
            current.coreRolePresence.peak || peakIds.has(candidate.venue.id);
        current.coreRolePresence.cooldown =
            current.coreRolePresence.cooldown || cooldownIds.has(candidate.venue.id);
        groups.set(districtIdentity.districtId, current);
    }
    return [...groups.values()];
}
function getDensityScore(candidateCount, maxCandidateCount) {
    if (maxCandidateCount <= 0) {
        return 0;
    }
    return clamp01(candidateCount / maxCandidateCount);
}
function getAdjustedDensityScore(rawDensity) {
    return clamp01(Math.pow(rawDensity, 0.72));
}
function getRelevanceScore(candidates) {
    if (candidates.length === 0) {
        return 0;
    }
    const total = candidates.reduce((sum, candidate) => {
        const coreRoleAlignment = Math.max(candidate.roleScores.warmup, candidate.roleScores.peak, candidate.roleScores.cooldown);
        return sum + candidate.fitScore * 0.58 + coreRoleAlignment * 0.42;
    }, 0);
    return clamp01(total / candidates.length);
}
function getDiversityScore(group) {
    const coreRoleCoverage = [
        group.coreRolePresence.warmup,
        group.coreRolePresence.peak,
        group.coreRolePresence.cooldown,
    ].filter(Boolean).length / 3;
    const categoryCoverage = clamp01(group.categories.size / 4);
    return clamp01(coreRoleCoverage * 0.65 + categoryCoverage * 0.35);
}
function getEnergyScore(candidates) {
    if (candidates.length === 0) {
        return 0;
    }
    const total = candidates.reduce((sum, candidate) => sum + candidate.venue.source.qualityScore, 0);
    return clamp01(total / candidates.length);
}
function getSignatureScore(candidates) {
    if (candidates.length === 0) {
        return 0;
    }
    const total = candidates.reduce((sum, candidate) => {
        const signatureSignal = candidate.venue.distinctivenessScore * 0.35 +
            candidate.venue.uniquenessScore * 0.24 +
            candidate.venue.underexposureScore * 0.18 +
            candidate.venue.shareabilityScore * 0.1 +
            candidate.taste.signals.categorySpecificity * 0.13;
        return sum + signatureSignal;
    }, 0);
    return clamp01(total / candidates.length);
}
function getDominanceScore(values) {
    if (values.length === 0) {
        return 0;
    }
    const counts = new Map();
    for (const value of values) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    const maxCount = Math.max(...counts.values());
    return clamp01(maxCount / values.length);
}
function getCoherenceScore(group) {
    if (group.candidates.length === 0) {
        return 0;
    }
    const neighborhoodDominance = getDominanceScore(group.candidates.map((candidate) => candidate.venue.neighborhood.toLowerCase()));
    const experienceFamilyDominance = getDominanceScore(group.candidates.map((candidate) => candidate.taste.signals.experienceFamily));
    return clamp01(neighborhoodDominance * 0.58 + experienceFamilyDominance * 0.42);
}
function getSequenceSupportScore(group) {
    if (group.candidates.length === 0) {
        return 0;
    }
    const bestWarmup = Math.max(...group.candidates.map((candidate) => candidate.roleScores.warmup));
    const bestPeak = Math.max(...group.candidates.map((candidate) => candidate.roleScores.peak));
    const bestCooldown = Math.max(...group.candidates.map((candidate) => candidate.roleScores.cooldown));
    const sequenceMean = (bestWarmup + bestPeak + bestCooldown) / 3;
    const sequenceSpread = Math.max(bestWarmup, bestPeak, bestCooldown) - Math.min(bestWarmup, bestPeak, bestCooldown);
    const sequenceBalance = 1 - sequenceSpread;
    const coverage = [
        group.coreRolePresence.warmup,
        group.coreRolePresence.peak,
        group.coreRolePresence.cooldown,
    ].filter(Boolean).length / 3;
    return clamp01(sequenceMean * 0.68 + coverage * 0.22 + sequenceBalance * 0.1);
}
function getTasteAverages(candidates) {
    if (candidates.length === 0) {
        return {
            intimacy: 0,
            linger: 0,
            conversation: 0,
            calm: 0,
            social: 0,
            culturalDepth: 0,
            discovery: 0,
            experiential: 0,
            outdoor: 0,
            playful: 0,
        };
    }
    const totals = candidates.reduce((sum, candidate) => {
        const signals = candidate.taste.signals;
        return {
            intimacy: sum.intimacy + signals.intimacy,
            linger: sum.linger + signals.lingerFactor,
            conversation: sum.conversation + signals.conversationFriendliness,
            calm: sum.calm + (1 - signals.energy),
            social: sum.social + signals.socialDensity,
            culturalDepth: sum.culturalDepth + signals.momentEnrichment.culturalDepth,
            discovery: sum.discovery +
                (signals.momentPotential.score * 0.5 +
                    signals.noveltyWeight * 0.3 +
                    signals.momentElevationPotential * 0.2),
            experiential: sum.experiential + signals.experientialFactor,
            outdoor: sum.outdoor + signals.outdoorStrength,
            playful: sum.playful + signals.interactiveStrength,
        };
    }, {
        intimacy: 0,
        linger: 0,
        conversation: 0,
        calm: 0,
        social: 0,
        culturalDepth: 0,
        discovery: 0,
        experiential: 0,
        outdoor: 0,
        playful: 0,
    });
    return {
        intimacy: clamp01(totals.intimacy / candidates.length),
        linger: clamp01(totals.linger / candidates.length),
        conversation: clamp01(totals.conversation / candidates.length),
        calm: clamp01(totals.calm / candidates.length),
        social: clamp01(totals.social / candidates.length),
        culturalDepth: clamp01(totals.culturalDepth / candidates.length),
        discovery: clamp01(totals.discovery / candidates.length),
        experiential: clamp01(totals.experiential / candidates.length),
        outdoor: clamp01(totals.outdoor / candidates.length),
        playful: clamp01(totals.playful / candidates.length),
    };
}
function getCategoryMix(candidates) {
    if (candidates.length === 0) {
        return {
            restaurant: 0,
            bar: 0,
            cafe: 0,
            dessert: 0,
            liveMusic: 0,
            activity: 0,
            park: 0,
            museum: 0,
            event: 0,
        };
    }
    const totals = candidates.reduce((sum, candidate) => {
        const category = candidate.venue.category;
        if (category === 'restaurant') {
            return { ...sum, restaurant: sum.restaurant + 1 };
        }
        if (category === 'bar') {
            return { ...sum, bar: sum.bar + 1 };
        }
        if (category === 'cafe') {
            return { ...sum, cafe: sum.cafe + 1 };
        }
        if (category === 'dessert') {
            return { ...sum, dessert: sum.dessert + 1 };
        }
        if (category === 'live_music') {
            return { ...sum, liveMusic: sum.liveMusic + 1 };
        }
        if (category === 'activity') {
            return { ...sum, activity: sum.activity + 1 };
        }
        if (category === 'park') {
            return { ...sum, park: sum.park + 1 };
        }
        if (category === 'museum') {
            return { ...sum, museum: sum.museum + 1 };
        }
        return { ...sum, event: sum.event + 1 };
    }, {
        restaurant: 0,
        bar: 0,
        cafe: 0,
        dessert: 0,
        liveMusic: 0,
        activity: 0,
        park: 0,
        museum: 0,
        event: 0,
    });
    return {
        restaurant: clamp01(totals.restaurant / candidates.length),
        bar: clamp01(totals.bar / candidates.length),
        cafe: clamp01(totals.cafe / candidates.length),
        dessert: clamp01(totals.dessert / candidates.length),
        liveMusic: clamp01(totals.liveMusic / candidates.length),
        activity: clamp01(totals.activity / candidates.length),
        park: clamp01(totals.park / candidates.length),
        museum: clamp01(totals.museum / candidates.length),
        event: clamp01(totals.event / candidates.length),
    };
}
function hasTag(tags, needle) {
    const normalizedNeedle = needle.toLowerCase();
    return tags.some((tag) => tag.toLowerCase().includes(normalizedNeedle));
}
function getWalkabilitySignal(candidates) {
    if (candidates.length === 0) {
        return 0;
    }
    const matched = candidates.filter((candidate) => ['walkable', 'stroll', 'promenade', 'courtyard', 'main-street', 'main street', 'open air'].some((term) => hasTag(candidate.venue.tags, term))).length;
    return clamp01(matched / candidates.length);
}
function getEventMomentumSignal(candidates) {
    if (candidates.length === 0) {
        return 0;
    }
    const total = candidates.reduce((sum, candidate) => {
        const activation = candidate.taste.signals.hyperlocalActivation.primaryActivationType;
        const activationBoost = activation === 'live_performance' ||
            activation === 'seasonal_market' ||
            activation === 'social_ritual'
            ? 1
            : activation === 'ambient_activation' || activation === 'cultural_activation'
                ? 0.65
                : 0;
        const tagBoost = ['event', 'night market', 'market', 'live', 'performance', 'show', 'lineup'].some((term) => hasTag(candidate.venue.tags, term))
            ? 1
            : 0;
        return sum + Math.max(activationBoost, tagBoost);
    }, 0);
    return clamp01(total / candidates.length);
}
function average(values) {
    if (values.length === 0) {
        return 0;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function getRoleStrengths(group) {
    if (group.candidates.length === 0) {
        return {
            startStrength: 0,
            highlightStrength: 0,
            winddownStrength: 0,
        };
    }
    const taste = getTasteAverages(group.candidates);
    const categories = getCategoryMix(group.candidates);
    const walkability = getWalkabilitySignal(group.candidates);
    const eventMomentum = getEventMomentumSignal(group.candidates);
    const energy = 1 - taste.calm;
    const social = taste.social;
    const chaosPenalty = clamp01(Math.max(0, social - 0.58) * 0.9 + Math.max(0, energy - 0.62) * 0.8);
    const overCalmPenalty = clamp01(Math.max(0, taste.calm - 0.72) * 0.9);
    const meanRoleSuitability = {
        start: average(group.candidates.map((candidate) => candidate.taste.signals.roleSuitability.start)),
        highlight: average(group.candidates.map((candidate) => candidate.taste.signals.roleSuitability.highlight)),
        windDown: average(group.candidates.map((candidate) => candidate.taste.signals.roleSuitability.windDown)),
    };
    const bestRole = {
        start: Math.max(...group.candidates.map((candidate) => candidate.roleScores.warmup)),
        highlight: Math.max(...group.candidates.map((candidate) => candidate.roleScores.peak)),
        windDown: Math.max(...group.candidates.map((candidate) => candidate.roleScores.cooldown)),
    };
    const momentPotential = average(group.candidates.map((candidate) => candidate.taste.signals.momentPotential.score));
    const momentIntensity = average(group.candidates.map((candidate) => candidate.taste.signals.momentIntensity.score));
    const startCategorySupport = clamp01(categories.cafe * 0.28 +
        categories.restaurant * 0.14 +
        categories.museum * 0.14 +
        categories.park * 0.16 +
        categories.dessert * 0.12 +
        categories.activity * 0.08 +
        categories.event * 0.08);
    const highlightCategorySupport = clamp01(categories.bar * 0.22 +
        categories.liveMusic * 0.22 +
        categories.event * 0.2 +
        categories.activity * 0.14 +
        categories.restaurant * 0.16 +
        categories.museum * 0.06);
    const winddownCategorySupport = clamp01(categories.dessert * 0.22 +
        categories.cafe * 0.18 +
        categories.restaurant * 0.2 +
        categories.park * 0.16 +
        categories.bar * 0.14 +
        categories.museum * 0.1);
    const startStrength = clamp01(meanRoleSuitability.start * 0.25 +
        bestRole.start * 0.16 +
        taste.conversation * 0.13 +
        taste.calm * 0.13 +
        walkability * 0.12 +
        taste.culturalDepth * 0.08 +
        startCategorySupport * 0.13 -
        chaosPenalty * 0.14);
    const highlightStrength = clamp01(meanRoleSuitability.highlight * 0.23 +
        bestRole.highlight * 0.16 +
        social * 0.14 +
        energy * 0.14 +
        momentPotential * 0.12 +
        momentIntensity * 0.08 +
        eventMomentum * 0.08 +
        highlightCategorySupport * 0.11 -
        overCalmPenalty * 0.08);
    const winddownStrength = clamp01(meanRoleSuitability.windDown * 0.25 +
        bestRole.windDown * 0.16 +
        taste.intimacy * 0.14 +
        taste.linger * 0.13 +
        taste.conversation * 0.1 +
        taste.calm * 0.1 +
        winddownCategorySupport * 0.12 -
        chaosPenalty * 0.12);
    return {
        startStrength,
        highlightStrength,
        winddownStrength,
    };
}
function getRoleFitScore(roleStrengths, roleWeights) {
    return clamp01(roleStrengths.startStrength * roleWeights.start +
        roleStrengths.highlightStrength * roleWeights.highlight +
        roleStrengths.winddownStrength * roleWeights.winddown);
}
function getVibeAffinity(intent, taste, sequenceSupport) {
    switch (intent.primaryAnchor) {
        case 'cozy':
            return clamp01(taste.intimacy * 0.28 +
                taste.linger * 0.25 +
                taste.conversation * 0.24 +
                taste.calm * 0.15 +
                sequenceSupport * 0.08);
        case 'cultured':
            return clamp01(taste.culturalDepth * 0.35 +
                taste.discovery * 0.25 +
                taste.experiential * 0.2 +
                taste.conversation * 0.1 +
                sequenceSupport * 0.1);
        case 'lively':
            return clamp01(taste.social * 0.36 +
                (1 - taste.calm) * 0.24 +
                taste.discovery * 0.18 +
                taste.playful * 0.12 +
                sequenceSupport * 0.1);
        case 'playful':
            return clamp01(taste.playful * 0.38 +
                taste.social * 0.22 +
                taste.discovery * 0.2 +
                taste.experiential * 0.1 +
                sequenceSupport * 0.1);
        case 'chill':
            return clamp01(taste.calm * 0.34 +
                taste.conversation * 0.24 +
                taste.linger * 0.22 +
                taste.intimacy * 0.1 +
                sequenceSupport * 0.1);
        case 'adventurous-outdoor':
            return clamp01(taste.outdoor * 0.36 +
                taste.discovery * 0.24 +
                taste.experiential * 0.2 +
                taste.playful * 0.1 +
                sequenceSupport * 0.1);
        case 'adventurous-urban':
            return clamp01(taste.discovery * 0.32 +
                taste.experiential * 0.24 +
                taste.social * 0.2 +
                taste.playful * 0.14 +
                sequenceSupport * 0.1);
        default:
            return clamp01(taste.discovery * 0.3 +
                taste.experiential * 0.24 +
                taste.conversation * 0.18 +
                taste.social * 0.18 +
                sequenceSupport * 0.1);
    }
}
function getCrewAffinity(intent, taste, sequenceSupport, signature) {
    if (intent.crew === 'romantic') {
        return clamp01(taste.intimacy * 0.31 +
            taste.conversation * 0.23 +
            taste.linger * 0.2 +
            taste.calm * 0.14 +
            sequenceSupport * 0.07 +
            signature * 0.05);
    }
    if (intent.crew === 'curator') {
        return clamp01(taste.culturalDepth * 0.3 +
            taste.discovery * 0.23 +
            taste.experiential * 0.18 +
            taste.conversation * 0.11 +
            sequenceSupport * 0.11 +
            signature * 0.07);
    }
    return clamp01(taste.social * 0.32 +
        (1 - taste.calm) * 0.2 +
        taste.playful * 0.18 +
        taste.discovery * 0.16 +
        sequenceSupport * 0.08 +
        signature * 0.06);
}
function getAffinityScores(group, intent, sequenceSupport, signature) {
    const taste = getTasteAverages(group.candidates);
    const vibeAffinity = getVibeAffinity(intent, taste, sequenceSupport);
    const crewAffinity = getCrewAffinity(intent, taste, sequenceSupport, signature);
    return {
        affinity: clamp01(vibeAffinity * 0.58 + crewAffinity * 0.42),
        vibeAffinity: clamp01(vibeAffinity),
        crewAffinity: clamp01(crewAffinity),
    };
}
function getAlignmentLift(density, affinity, signature, coherence, relevance, diversity) {
    const contextStrength = clamp01(relevance * 0.55 + diversity * 0.45);
    return clamp01((Math.max(0, affinity - density) * 0.07 +
        Math.max(0, signature - density) * 0.05 +
        Math.max(0, coherence - density) * 0.03) *
        contextStrength);
}
function getBreadthPenalty(density, affinity, signature, coherence) {
    return clamp01(Math.max(0, density - affinity - 0.08) * 0.16 +
        Math.max(0, density - signature - 0.08) * 0.12 +
        Math.max(0, density - coherence - 0.05) * 0.14);
}
function getSparsityPenalty(density, diversity, sequenceSupport) {
    return clamp01(Math.max(0, 0.38 - density) * 0.18 +
        Math.max(0, 0.58 - diversity) * 0.2 +
        Math.max(0, 0.62 - sequenceSupport) * 0.08);
}
function buildReason(input) {
    const positiveSignals = [
        {
            key: 'role-fit',
            value: input.roleFitScore,
            reason: 'District timing profile matches your start/highlight/wind-down needs.',
        },
        {
            key: 'affinity',
            value: input.affinity,
            reason: 'District character aligns strongly with your vibe and crew.',
        },
        {
            key: 'signature',
            value: input.signature,
            reason: 'Distinctive local signature stands out from generic breadth.',
        },
        {
            key: 'sequence',
            value: input.sequenceSupport,
            reason: 'Supports a natural start-to-highlight-to-wind-down sequence.',
        },
        {
            key: 'coherence',
            value: input.coherence,
            reason: 'Neighborhood identity stays coherent across candidate stops.',
        },
        {
            key: 'relevance',
            value: input.signals.relevance,
            reason: 'Strong match for your selected vibe and intent.',
        },
        {
            key: 'density',
            value: input.signals.density,
            reason: 'High concentration of options in a compact area.',
        },
    ]
        .filter((entry) => entry.value >= 0.64)
        .sort((left, right) => right.value - left.value);
    const parts = [];
    if (positiveSignals[0]) {
        parts.push(positiveSignals[0].reason);
    }
    else {
        parts.push('Balanced district option for this outing.');
    }
    if (input.roleFitAdjustment >= 0.07) {
        parts.push('Temporal role fit provided a meaningful recommendation lift.');
    }
    else if (input.alignmentLift >= 0.05) {
        parts.push('Strong signature and fit offset raw breadth disadvantage.');
    }
    else if (input.sparsityPenalty >= 0.07) {
        parts.push('Smaller footprint held this district back despite thematic alignment.');
    }
    else if (input.breadthPenalty >= 0.06) {
        parts.push('Broad coverage was tempered because coherence and signature were weaker.');
    }
    else if (positiveSignals[1] && positiveSignals[1].reason !== positiveSignals[0]?.reason) {
        parts.push(positiveSignals[1].reason);
    }
    return parts.slice(0, 2).join(' ');
}
export function recommendDistricts({ scoredVenues, rolePools, intent, limit = 5, }) {
    const viableCandidates = getViableCandidates(rolePools, scoredVenues);
    const districtGroups = getDistrictGroups(viableCandidates, rolePools, intent);
    const maxCandidateCount = Math.max(...districtGroups.map((group) => group.candidates.length), 0);
    const roleWeights = getRoleWeights(intent);
    return districtGroups
        .map((group) => {
        const density = roundToHundredths(getDensityScore(group.candidates.length, maxCandidateCount));
        const adjustedDensity = roundToHundredths(getAdjustedDensityScore(density));
        const relevance = roundToHundredths(getRelevanceScore(group.candidates));
        const diversity = roundToHundredths(getDiversityScore(group));
        const energy = roundToHundredths(getEnergyScore(group.candidates));
        const signature = roundToHundredths(getSignatureScore(group.candidates));
        const coherence = roundToHundredths(getCoherenceScore(group));
        const sequenceSupport = roundToHundredths(getSequenceSupportScore(group));
        const roleStrengths = getRoleStrengths(group);
        const roleFitScore = roundToHundredths(getRoleFitScore(roleStrengths, roleWeights));
        const roleFitAdjustment = roundToHundredths(roleFitScore * 0.1);
        const affinityScores = getAffinityScores(group, intent, sequenceSupport, signature);
        const affinity = roundToHundredths(affinityScores.affinity);
        const tasteAverages = getTasteAverages(group.candidates);
        const categoryMix = getCategoryMix(group.candidates);
        const walkability = roundToHundredths(getWalkabilitySignal(group.candidates));
        const eventMomentum = roundToHundredths(getEventMomentumSignal(group.candidates));
        const momentPotential = roundToHundredths(average(group.candidates.map((candidate) => candidate.taste.signals.momentPotential.score)));
        const alignmentLift = roundToHundredths(getAlignmentLift(density, affinity, signature, coherence, relevance, diversity));
        const breadthPenalty = roundToHundredths(getBreadthPenalty(density, affinity, signature, coherence));
        const sparsityPenalty = roundToHundredths(getSparsityPenalty(density, diversity, sequenceSupport));
        const componentBreakdownRaw = {
            density: adjustedDensity * 0.15,
            relevance: relevance * 0.2,
            diversity: diversity * 0.15,
            energy: energy * 0.08,
            affinity: affinity * 0.14,
            signature: signature * 0.1,
            coherence: coherence * 0.04,
            sequenceSupport: sequenceSupport * 0.04,
            roleFit: roleFitScore * 0.1,
        };
        const baseScore = Object.values(componentBreakdownRaw).reduce((sum, value) => sum + value, 0);
        const score = roundToHundredths(clamp01(baseScore + alignmentLift - breadthPenalty - sparsityPenalty));
        const signals = {
            density,
            relevance,
            diversity,
            energy,
        };
        const districtExplanation = generateDistrictExplanation({
            affinity,
            signature,
            coherence,
            sequenceSupport,
            roleFit: roleFitScore,
        }, {
            persona: intent.persona,
            crew: intent.crew,
            vibe: intent.primaryAnchor,
        });
        const districtInsider = generateDistrictInsider({
            affinity,
            signature,
            coherence,
            sequenceSupport,
            roleFit: roleFitScore,
            density,
            diversity,
            energy,
            calm: roundToHundredths(tasteAverages.calm),
            social: roundToHundredths(tasteAverages.social),
            culturalDepth: roundToHundredths(tasteAverages.culturalDepth),
            discovery: roundToHundredths(tasteAverages.discovery),
            walkability,
            eventMomentum,
            momentPotential,
            categoryMix,
        }, {
            persona: intent.persona,
            crew: intent.crew,
            vibe: intent.primaryAnchor,
            timeWindow: intent.timeWindow,
        });
        return {
            districtId: group.districtId,
            label: group.label,
            score,
            districtExplanation,
            districtInsider,
            signals,
            reason: buildReason({
                signals,
                affinity,
                signature,
                coherence,
                sequenceSupport,
                roleFitScore,
                roleFitAdjustment,
                alignmentLift,
                breadthPenalty,
                sparsityPenalty,
            }),
            debug: {
                adjustedDensity,
                affinity,
                vibeAffinity: roundToHundredths(affinityScores.vibeAffinity),
                crewAffinity: roundToHundredths(affinityScores.crewAffinity),
                signature,
                coherence,
                sequenceSupport,
                startStrength: roundToHundredths(roleStrengths.startStrength),
                highlightStrength: roundToHundredths(roleStrengths.highlightStrength),
                winddownStrength: roundToHundredths(roleStrengths.winddownStrength),
                roleFitScore,
                roleFitAdjustment,
                roleWeights: {
                    start: roundToHundredths(roleWeights.start),
                    highlight: roundToHundredths(roleWeights.highlight),
                    winddown: roundToHundredths(roleWeights.winddown),
                },
                alignmentLift,
                breadthPenalty,
                sparsityPenalty,
                componentBreakdown: {
                    density: roundToHundredths(componentBreakdownRaw.density),
                    relevance: roundToHundredths(componentBreakdownRaw.relevance),
                    diversity: roundToHundredths(componentBreakdownRaw.diversity),
                    energy: roundToHundredths(componentBreakdownRaw.energy),
                    affinity: roundToHundredths(componentBreakdownRaw.affinity),
                    signature: roundToHundredths(componentBreakdownRaw.signature),
                    coherence: roundToHundredths(componentBreakdownRaw.coherence),
                    sequenceSupport: roundToHundredths(componentBreakdownRaw.sequenceSupport),
                    roleFit: roundToHundredths(componentBreakdownRaw.roleFit),
                },
            },
        };
    })
        .sort((left, right) => {
        if (right.score !== left.score) {
            return right.score - left.score;
        }
        if (right.debug && left.debug) {
            if (right.debug.roleFitScore !== left.debug.roleFitScore) {
                return right.debug.roleFitScore - left.debug.roleFitScore;
            }
            if (right.debug.affinity !== left.debug.affinity) {
                return right.debug.affinity - left.debug.affinity;
            }
        }
        return left.label.localeCompare(right.label);
    })
        .slice(0, limit);
}
