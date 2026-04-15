import { getDurationProfile } from '../taste/getDurationProfile';
import { computeLiveSignatureStrength } from '../retrieval/computeLiveSignatureStrength';
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function hasAnyTag(raw, candidates) {
    const tags = new Set((raw.tags ?? []).map((tag) => tag.toLowerCase()));
    return candidates.some((candidate) => tags.has(candidate.toLowerCase()));
}
function inferSetting(raw, category) {
    if (raw.settingHint) {
        return raw.settingHint;
    }
    if (category === 'park') {
        return 'outdoor';
    }
    if (hasAnyTag(raw, ['garden', 'trail', 'viewpoint', 'stargazing', 'walkable', 'outdoor-seating', 'rooftop'])) {
        return category === 'bar' || category === 'event' || category === 'activity' ? 'hybrid' : 'outdoor';
    }
    if (hasAnyTag(raw, ['greenhouse', 'courtyard', 'open-air'])) {
        return 'hybrid';
    }
    return 'indoor';
}
function inferEnergyLevel(raw, category, inferredFields) {
    if (typeof raw.energyLevel === 'number') {
        return raw.energyLevel;
    }
    inferredFields.push('energyLevel');
    const baseByCategory = {
        restaurant: 3,
        bar: 4,
        cafe: 2,
        dessert: 2,
        live_music: 4,
        activity: 4,
        park: 1,
        museum: 2,
        event: 3,
    };
    let energy = baseByCategory[category];
    if (hasAnyTag(raw, ['quiet', 'calm', 'tea-room', 'reflective', 'stargazing'])) {
        energy -= 1;
    }
    if (hasAnyTag(raw, ['social', 'group', 'arcade', 'karaoke', 'high-energy', 'cocktails'])) {
        energy += 1;
    }
    return clamp(energy, 1, 5);
}
function inferSocialDensity(raw, category, energyLevel, inferredFields) {
    if (typeof raw.socialDensity === 'number') {
        return raw.socialDensity;
    }
    inferredFields.push('socialDensity');
    let socialDensity = category === 'bar' || category === 'event' || category === 'live_music'
        ? 4
        : category === 'restaurant' || category === 'activity'
            ? 3
            : 2;
    if (hasAnyTag(raw, ['quiet', 'tea-room', 'reflective', 'stroll'])) {
        socialDensity -= 1;
    }
    if (hasAnyTag(raw, ['community', 'market', 'social', 'group'])) {
        socialDensity += 1;
    }
    if (energyLevel >= 4) {
        socialDensity += 0.5;
    }
    return clamp(Math.round(socialDensity), 1, 5);
}
function inferVibeTags(raw, category, inferredFields) {
    if (raw.vibeTags && raw.vibeTags.length > 0) {
        return raw.vibeTags;
    }
    inferredFields.push('vibeTags');
    const base = {
        restaurant: ['culinary', 'cozy'],
        bar: ['lively', 'creative'],
        cafe: ['cozy', 'relaxed'],
        dessert: ['cozy', 'culinary'],
        live_music: ['culture', 'creative'],
        activity: ['playful', 'creative'],
        park: ['outdoors', 'relaxed'],
        museum: ['culture', 'creative'],
        event: ['creative', 'culture'],
    };
    const vibes = new Set(base[category]);
    if (hasAnyTag(raw, ['social', 'cocktails', 'group', 'community'])) {
        vibes.add('lively');
    }
    if (hasAnyTag(raw, ['quiet', 'tea-room', 'calm', 'reflective'])) {
        vibes.add('relaxed');
    }
    if (hasAnyTag(raw, ['garden', 'trail', 'viewpoint', 'stargazing'])) {
        vibes.add('outdoors');
    }
    return [...vibes];
}
function inferAudienceFlags(raw, category) {
    const familyFriendly = raw.familyFriendly ??
        (hasAnyTag(raw, ['family-friendly', 'learning', 'hands-on', 'outdoor-play', 'animals']) ||
            category === 'museum');
    const adultSocial = raw.adultSocial ??
        (category === 'bar' ||
            category === 'live_music' ||
            hasAnyTag(raw, ['cocktails', 'wine', 'stylish', 'rooftop', 'speakeasy']));
    const dateFriendly = raw.dateFriendly ??
        (category === 'restaurant' ||
            category === 'dessert' ||
            hasAnyTag(raw, ['intimate', 'chef-led', 'tea-room', 'cozy', 'wine']));
    return {
        familyFriendly,
        adultSocial,
        dateFriendly,
    };
}
function inferUseCases(raw, audienceFlags, inferredFields) {
    if (raw.useCases && raw.useCases.length > 0) {
        return raw.useCases;
    }
    inferredFields.push('useCases');
    const useCases = new Set();
    if (audienceFlags.dateFriendly) {
        useCases.add('romantic');
    }
    if (audienceFlags.adultSocial || hasAnyTag(raw, ['social', 'group', 'playful'])) {
        useCases.add('socialite');
    }
    if (audienceFlags.familyFriendly || hasAnyTag(raw, ['culture', 'learning', 'guided'])) {
        useCases.add('curator');
    }
    if (useCases.size === 0) {
        useCases.add('socialite');
    }
    return [...useCases];
}
function inferHighlightTier(raw, category) {
    if (category === 'restaurant' || category === 'bar' || category === 'live_music') {
        return { tier: 'highlight-capable', confidence: 0.82 };
    }
    if (category === 'event' ||
        (category === 'activity' && hasAnyTag(raw, ['arcade', 'karaoke', 'mini-golf', 'guided']))) {
        return { tier: 'highlight-capable', confidence: 0.74 };
    }
    if (category === 'museum' ||
        category === 'activity' ||
        category === 'park' ||
        category === 'dessert' ||
        category === 'cafe') {
        return {
            tier: hasAnyTag(raw, ['scenic', 'trail', 'viewpoint', 'signature', 'historic', 'immersive', 'intimate'])
                ? 'highlight-capable'
                : 'support-only',
            confidence: hasAnyTag(raw, ['signature', 'immersive', 'historic']) ? 0.68 : 0.56,
        };
    }
    return { tier: 'connective-only', confidence: 0.45 };
}
function inferRouteFootprint(raw) {
    const driveMinutes = raw.driveMinutes ?? 12;
    if (driveMinutes <= 10) {
        return 'compact';
    }
    if (driveMinutes <= 16) {
        return 'neighborhood-hop';
    }
    return 'destination';
}
function inferSignatureSignals(raw, category) {
    const chainLike = raw.isChain ?? false;
    const liveSignatureStrength = computeLiveSignatureStrength(raw, category);
    let genericScore = chainLike ? 0.8 : 0.32;
    let signatureScore = typeof raw.distinctivenessScore === 'number'
        ? raw.distinctivenessScore
        : chainLike
            ? 0.28
            : 0.62;
    if (hasAnyTag(raw, ['local', 'signature', 'chef-led', 'historic', 'artisan', 'understated'])) {
        genericScore -= 0.12;
        signatureScore += 0.12;
    }
    if (hasAnyTag(raw, ['casual', 'food-hall', 'family-friendly', 'neighborhood'])) {
        genericScore += 0.08;
    }
    if (category === 'event' || category === 'live_music') {
        signatureScore += 0.05;
    }
    if (liveSignatureStrength.strength > 0) {
        genericScore -= liveSignatureStrength.genericRelief;
        signatureScore += liveSignatureStrength.signatureBoost;
    }
    return {
        chainLike,
        genericScore: clamp(Number(genericScore.toFixed(2)), 0, 1),
        signatureScore: clamp(Number(signatureScore.toFixed(2)), 0, 1),
    };
}
function inferScore(rawValue, fallback, inferredFields, field) {
    if (typeof rawValue === 'number') {
        return rawValue;
    }
    inferredFields.push(field);
    return fallback;
}
function inferLocalSignals(raw, signatureScore, inferredFields) {
    if (raw.localSignals) {
        return {
            localFavoriteScore: raw.localSignals.localFavoriteScore ?? 0.72,
            neighborhoodPrideScore: raw.localSignals.neighborhoodPrideScore ?? 0.72,
            repeatVisitorScore: raw.localSignals.repeatVisitorScore ?? 0.72,
        };
    }
    inferredFields.push('localSignals');
    const base = clamp(0.58 + signatureScore * 0.24, 0.45, 0.92);
    return {
        localFavoriteScore: Number(base.toFixed(2)),
        neighborhoodPrideScore: Number((base + 0.04).toFixed(2)),
        repeatVisitorScore: Number((base - 0.02).toFixed(2)),
    };
}
function inferRoleAffinity(raw, category, highlightTier, inferredFields) {
    if (raw.roleAffinity) {
        return {
            warmup: raw.roleAffinity.warmup ?? 0.5,
            peak: raw.roleAffinity.peak ?? 0.5,
            wildcard: raw.roleAffinity.wildcard ?? 0.5,
            cooldown: raw.roleAffinity.cooldown ?? 0.5,
        };
    }
    inferredFields.push('roleAffinity');
    const baseByCategory = {
        restaurant: { warmup: 0.58, peak: 0.84, wildcard: 0.4, cooldown: 0.42 },
        bar: { warmup: 0.5, peak: 0.8, wildcard: 0.48, cooldown: 0.54 },
        cafe: { warmup: 0.86, peak: 0.42, wildcard: 0.52, cooldown: 0.82 },
        dessert: { warmup: 0.58, peak: 0.52, wildcard: 0.48, cooldown: 0.9 },
        live_music: { warmup: 0.42, peak: 0.86, wildcard: 0.82, cooldown: 0.38 },
        activity: { warmup: 0.48, peak: 0.8, wildcard: 0.82, cooldown: 0.34 },
        park: { warmup: 0.78, peak: 0.56, wildcard: 0.66, cooldown: 0.92 },
        museum: { warmup: 0.62, peak: 0.72, wildcard: 0.6, cooldown: 0.68 },
        event: { warmup: 0.54, peak: 0.76, wildcard: 0.86, cooldown: 0.44 },
    };
    const roleAffinity = { ...baseByCategory[category] };
    if (highlightTier === 'support-only') {
        roleAffinity.peak = Math.max(0.48, roleAffinity.peak - 0.12);
        roleAffinity.cooldown = Math.min(0.96, roleAffinity.cooldown + 0.04);
    }
    if (highlightTier === 'connective-only') {
        roleAffinity.peak = Math.max(0.3, roleAffinity.peak - 0.2);
        roleAffinity.wildcard = Math.max(0.34, roleAffinity.wildcard - 0.1);
    }
    return roleAffinity;
}
export function inferVenueSignals({ raw, category, }) {
    const inferredFields = [];
    const energyLevel = inferEnergyLevel(raw, category, inferredFields);
    const socialDensity = inferSocialDensity(raw, category, energyLevel, inferredFields);
    const vibeTags = inferVibeTags(raw, category, inferredFields);
    const audienceFlags = inferAudienceFlags(raw, category);
    const useCases = inferUseCases(raw, audienceFlags, inferredFields);
    const highlight = inferHighlightTier(raw, category);
    const signature = inferSignatureSignals(raw, category);
    const uniquenessScore = inferScore(raw.uniquenessScore, clamp(0.52 + signature.signatureScore * 0.38, 0.4, 0.95), inferredFields, 'uniquenessScore');
    const distinctivenessScore = inferScore(raw.distinctivenessScore, clamp(0.5 + signature.signatureScore * 0.42, 0.38, 0.96), inferredFields, 'distinctivenessScore');
    const underexposureScore = inferScore(raw.underexposureScore, clamp(0.42 + (raw.isHiddenGem ? 0.22 : 0) + (signature.signatureScore - signature.genericScore) * 0.12, 0.25, 0.92), inferredFields, 'underexposureScore');
    const shareabilityScore = inferScore(raw.shareabilityScore, clamp(0.48 + socialDensity * 0.06 + signature.signatureScore * 0.12, 0.35, 0.94), inferredFields, 'shareabilityScore');
    const isHiddenGem = typeof raw.isHiddenGem === 'boolean'
        ? raw.isHiddenGem
        : signature.signatureScore >= 0.78 && underexposureScore >= 0.64;
    if (typeof raw.isHiddenGem !== 'boolean') {
        inferredFields.push('isHiddenGem');
    }
    const isChain = raw.isChain ?? signature.chainLike;
    if (typeof raw.isChain !== 'boolean') {
        inferredFields.push('isChain');
    }
    const setting = inferSetting(raw, category);
    const localSignals = inferLocalSignals(raw, signature.signatureScore, inferredFields);
    const roleAffinity = inferRoleAffinity(raw, category, highlight.tier, inferredFields);
    const durationProfileBase = getDurationProfile({
        category,
        tags: raw.tags ?? [],
    });
    const durationProfile = {
        durationClass: durationProfileBase.durationClass,
        estimatedMinutes: durationProfileBase.baseMinutes,
    };
    return {
        useCases,
        vibeTags,
        energyLevel,
        socialDensity,
        uniquenessScore,
        distinctivenessScore,
        underexposureScore,
        shareabilityScore,
        isHiddenGem,
        isChain,
        localSignals,
        roleAffinity,
        durationProfile,
        settings: {
            socialDensity,
            highlightCapabilityTier: highlight.tier,
            highlightConfidence: highlight.confidence,
            supportOnly: highlight.tier === 'support-only',
            connectiveOnly: highlight.tier === 'connective-only',
            setting,
            familyFriendly: audienceFlags.familyFriendly,
            adultSocial: audienceFlags.adultSocial,
            dateFriendly: audienceFlags.dateFriendly,
            eventCapable: raw.eventCapable ??
                (category === 'event' || hasAnyTag(raw, ['market', 'pop-up', 'community'])),
            musicCapable: raw.musicCapable ??
                (category === 'live_music' || hasAnyTag(raw, ['jazz', 'listening', 'acoustic'])),
            performanceCapable: raw.performanceCapable ??
                (category === 'live_music' || hasAnyTag(raw, ['performance', 'small-stage', 'guided', 'gallery'])),
            routeFootprint: inferRouteFootprint(raw),
        },
        signature,
        inferredFields: [...new Set(inferredFields)],
    };
}
