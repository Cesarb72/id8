const CATEGORY_BASELINES = {
    activity: {
        energy: 0.74,
        socialDensity: 0.62,
        intimacy: 0.34,
        lingerFactor: 0.68,
        destinationFactor: 0.76,
        experientialFactor: 0.86,
        conversationFriendliness: 0.42,
    },
    bar: {
        energy: 0.72,
        socialDensity: 0.74,
        intimacy: 0.34,
        lingerFactor: 0.58,
        destinationFactor: 0.6,
        experientialFactor: 0.64,
        conversationFriendliness: 0.42,
    },
    cafe: {
        energy: 0.34,
        socialDensity: 0.4,
        intimacy: 0.62,
        lingerFactor: 0.52,
        destinationFactor: 0.34,
        experientialFactor: 0.34,
        conversationFriendliness: 0.8,
    },
    dessert: {
        energy: 0.42,
        socialDensity: 0.46,
        intimacy: 0.54,
        lingerFactor: 0.42,
        destinationFactor: 0.38,
        experientialFactor: 0.42,
        conversationFriendliness: 0.68,
    },
    event: {
        energy: 0.84,
        socialDensity: 0.82,
        intimacy: 0.22,
        lingerFactor: 0.74,
        destinationFactor: 0.84,
        experientialFactor: 0.9,
        conversationFriendliness: 0.24,
    },
    live_music: {
        energy: 0.8,
        socialDensity: 0.72,
        intimacy: 0.28,
        lingerFactor: 0.66,
        destinationFactor: 0.76,
        experientialFactor: 0.86,
        conversationFriendliness: 0.24,
    },
    museum: {
        energy: 0.4,
        socialDensity: 0.34,
        intimacy: 0.58,
        lingerFactor: 0.62,
        destinationFactor: 0.68,
        experientialFactor: 0.78,
        conversationFriendliness: 0.64,
    },
    park: {
        energy: 0.28,
        socialDensity: 0.22,
        intimacy: 0.76,
        lingerFactor: 0.66,
        destinationFactor: 0.68,
        experientialFactor: 0.72,
        conversationFriendliness: 0.84,
    },
    restaurant: {
        energy: 0.56,
        socialDensity: 0.58,
        intimacy: 0.46,
        lingerFactor: 0.66,
        destinationFactor: 0.54,
        experientialFactor: 0.52,
        conversationFriendliness: 0.62,
    },
};
const HIGH_ENERGY_TERMS = [
    'after dark',
    'buzzing',
    'cocktails',
    'crowded',
    'dance',
    'dj',
    'late night',
    'lively',
    'nightlife',
    'party',
    'rooftop',
    'karaoke',
];
const CALM_TERMS = [
    'bookish',
    'calm',
    'cozy',
    'garden',
    'intimate',
    'low-key',
    'patio',
    'quiet',
    'relaxed',
    'romantic',
];
const OUTDOOR_TERMS = [
    'beer garden',
    'courtyard',
    'fresh air',
    'garden',
    'greenhouse',
    'open air',
    'outdoor',
    'outdoor seating',
    'park',
    'patio',
    'plaza',
    'rooftop',
    'trail',
    'walkable',
];
const SCENIC_TERMS = [
    'botanical',
    'lookout',
    'promenade',
    'scenic',
    'stargazing',
    'sunset',
    'view',
    'viewpoint',
    'waterfront',
];
const INTERACTIVE_TERMS = [
    'arcade',
    'class',
    'exhibit',
    'games',
    'hands-on',
    'immersive',
    'interactive',
    'karaoke',
    'mini golf',
    'puzzle',
    'studio',
    'workshop',
];
const SOCIAL_ACTIVITY_TERMS = [
    'board games',
    'community',
    'friendly competition',
    'group activity',
    'live',
    'playful',
    'social activity',
    'team',
];
const PASSIVE_HOSPITALITY_TERMS = [
    'bar seating',
    'cafe',
    'cocktail lounge',
    'dining room',
    'seated',
    'table service',
    'tea house',
    'tea room',
    'wine bar',
];
const DESTINATION_TERMS = [
    'chef',
    'degustation',
    'destination',
    'hidden gem',
    'iconic',
    'michelin',
    'omakase',
    'reservation',
    'speakeasy',
    'tasting menu',
    'view',
];
const MOMENT_ANCHOR_IDENTITY_TERMS = [
    'atelier',
    'chef',
    'curated',
    'destination',
    'event',
    'experiential',
    'hidden',
    'historic',
    'iconic',
    'immersive',
    'listening',
    'omakase',
    'reservation',
    'secret',
    'signature',
    'speakeasy',
    'tasting',
];
const DRINKS_TERMS = [
    'brewery',
    'cafe',
    'cocktail',
    'cocktails',
    'coffee',
    'espresso',
    'tea',
    'wine',
];
const SWEET_TERMS = [
    'bakery',
    'dessert',
    'gelato',
    'ice cream',
    'pastry',
    'sweet',
];
const CULTURE_TERMS = [
    'art',
    'cultural',
    'exhibit',
    'gallery',
    'heritage',
    'historic',
    'history',
    'jazz',
    'japanese',
    'listening',
    'museum',
    'performance',
    'theater',
];
const AMBIENT_TERMS = [
    'ambient',
    'atmosphere',
    'candlelit',
    'cocktail lounge',
    'experiential',
    'greenhouse',
    'intimate',
    'jazz',
    'listening',
    'lounge',
    'speakeasy',
    'vibe',
];
const TEMPORAL_ENERGY_TERMS = [
    'after dark',
    'evening',
    'jazz',
    'late night',
    'lineup',
    'listening',
    'live music',
    'night',
    'nightlife',
    'performance',
    'show',
];
const RECURRING_EVENT_TERMS = [
    'every friday',
    'monthly',
    'nightly',
    'recurring',
    'rotating',
    'series',
    'weekly',
];
const SOCIAL_ENERGY_TERMS = [
    'buzzy',
    'busy',
    'crowded',
    'packed',
    'popular',
    'scene',
    'social',
    'vibrant',
];
const GROUP_SIGNAL_TERMS = [
    'board games',
    'communal',
    'friends',
    'group',
    'shared',
    'social activity',
    'team',
];
const AMBIENT_UNIQUENESS_TERMS = [
    'atmosphere',
    'atelier',
    'candlelit',
    'curated',
    'design',
    'design-forward',
    'glow',
    'greenhouse',
    'interior',
    'lighting',
    'listening room',
    'moody',
    'mood',
    'neon',
    'supper club',
    'vibe-rich',
];
const CULTURAL_DEPTH_TERMS = [
    'art',
    'artist',
    'atelier',
    'exhibit',
    'gallery',
    'immersive',
    'installation',
    'listening',
    'live music',
    'performance',
    'showcase',
    'theater',
];
const LIVE_PERFORMANCE_ACTIVATION_TERMS = [
    'concert',
    'jazz',
    'lineup',
    'listening room',
    'live music',
    'performance',
    'resident',
    'set',
    'show',
    'stage',
];
const SOCIAL_RITUAL_ACTIVATION_TERMS = [
    'community night',
    'game night',
    'karaoke',
    'locals night',
    'open mic',
    'series',
    'social ritual',
    'trivia',
    'weekly',
];
const TASTING_ACTIVATION_TERMS = [
    'chef-led',
    'degustation',
    'flight',
    'omakase',
    'pairing',
    'prix fixe',
    'seasonal menu',
    'special menu',
    'tasting',
    'wine pairing',
];
const CULTURAL_ACTIVATION_TERMS = [
    'artist',
    'curated',
    'exhibit',
    'gallery',
    'installation',
    'opening',
    'performance',
    'screening',
    'showcase',
    'studio',
];
const SEASONAL_MARKET_ACTIVATION_TERMS = [
    'fair',
    'festival',
    'holiday',
    'market',
    'night market',
    'popup',
    'seasonal',
    'vendor',
];
const AMBIENT_ACTIVATION_TERMS = [
    'after dark',
    'ambient',
    'candlelit',
    'courtyard',
    'listening room',
    'low-light',
    'moonlight',
    'speakeasy',
    'twilight',
];
const PROGRAMMED_ACTIVATION_TERMS = [
    'lineup',
    'program',
    'programming',
    'resident',
    'rotating',
    'special',
];
const DAY_WINDOW_TERMS = [
    'afternoon',
    'breakfast',
    'brunch',
    'coffee',
    'daytime',
    'lunch',
    'morning',
];
const EVENING_WINDOW_TERMS = [
    'date night',
    'date-night',
    'dinner',
    'evening',
    'happy hour',
    'sunset',
    'tonight',
    'twilight',
];
const LATE_WINDOW_TERMS = [
    'after dark',
    'after-dark',
    'late night',
    'late-night',
    'midnight',
    'nightcap',
];
export const STANDARD_ROMANTIC_THRESHOLD = 0.5;
export const COZY_SCENIC_ROMANTIC_THRESHOLD = 0.42;
function normalizeInterpretationTimeWindow(value) {
    const normalized = value?.trim().toLowerCase();
    return normalized ? normalized : undefined;
}
function parseTemporalWindow(value) {
    const normalized = normalizeInterpretationTimeWindow(value);
    if (!normalized) {
        return undefined;
    }
    if (DAY_WINDOW_TERMS.some((term) => normalized.includes(term))) {
        return 'day';
    }
    if (LATE_WINDOW_TERMS.some((term) => normalized.includes(term))) {
        return 'late';
    }
    if (EVENING_WINDOW_TERMS.some((term) => normalized.includes(term))) {
        return 'evening';
    }
    const match = normalized.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (!match) {
        return undefined;
    }
    let hour = Number(match[1]);
    const meridiem = match[3];
    if (meridiem === 'pm' && hour < 12) {
        hour += 12;
    }
    if (meridiem === 'am' && hour === 12) {
        hour = 0;
    }
    if (hour < 17) {
        return 'day';
    }
    if (hour < 22) {
        return 'evening';
    }
    return 'late';
}
function createZeroRoleAdjustments() {
    return {
        start: 0,
        highlight: 0,
        windDown: 0,
        surprise: 0,
    };
}
const INTIMACY_TERMS = [
    'cozy',
    'date night',
    'hidden',
    'intimate',
    'low-key',
    'quiet',
    'romantic',
    'snug',
    'tea house',
    'wine bar',
];
const SHARED_ACTIVITY_TERMS = [
    'art walk',
    'board games',
    'class',
    'exhibit',
    'games',
    'garden walk',
    'interactive',
    'mini golf',
    'puzzle',
    'stroll',
    'walk',
    'workshop',
];
const LINGER_TERMS = [
    'brunch',
    'coffee',
    'courses',
    'dessert',
    'patio',
    'tasting',
    'tea',
    'wine',
];
const SOCIAL_TERMS = [
    'bar seating',
    'communal',
    'crowded',
    'group',
    'party',
    'scene',
    'social',
];
const CONVERSATION_POSITIVE_TERMS = [
    'bookish',
    'cozy',
    'date night',
    'neighborhood',
    'patio',
    'quiet',
    'wine',
];
const CONVERSATION_NEGATIVE_TERMS = [
    'club',
    'crowded',
    'dance',
    'dj',
    'late night',
    'loud',
    'nightlife',
];
const SURPRISE_TERMS = [
    'chef counter',
    'hidden',
    'omakase',
    'reservation',
    'rotating',
    'seasonal',
    'speakeasy',
    'tasting',
];
const NIGHTLIFE_SIGNATURE_TERMS = [
    'bar',
    'cocktails',
    'dj',
    'jazz',
    'late night',
    'listening',
    'nightlife',
    'rooftop',
    'speakeasy',
];
const DINING_SIGNATURE_TERMS = [
    'chef',
    'chef counter',
    'chef led',
    'degustation',
    'omakase',
    'seasonal',
    'small plate',
    'small plates',
    'tapas',
    'tasting menu',
    'wine pairing',
];
const LOCAL_CHARACTER_TERMS = [
    'artisan',
    'community',
    'courtyard',
    'heritage',
    'historic',
    'local',
    'neighborhood',
    'seasonal',
    'underexposed',
];
const GENERIC_PREMIUM_TERMS = [
    'elevated',
    'modern',
    'new american',
    'polished',
    'refined',
    'stylish',
    'upscale',
];
const QUICK_STOP_TERMS = [
    'counter',
    'grab',
    'grab-and-go',
    'kiosk',
    'quick',
    'takeout',
    'to-go',
    'walk-up',
];
const LANDING_TERMS = [
    'bakery',
    'calm',
    'dessert',
    'low-key',
    'nightcap',
    'pastry',
    'quiet',
    'tea',
    'wind down',
    'wine',
];
const CENTERPIECE_TERMS = [
    'chef',
    'destination',
    'event',
    'experiential',
    'immersive',
    'must-visit',
    'notable',
    'reservation',
    'signature',
    'tasting',
];
const START_FRICTION_TERMS = [
    'chef counter',
    'degustation',
    'lineup',
    'omakase',
    'reservation',
    'set menu',
    'tasting menu',
];
export function interpretVenueTaste(venue, context) {
    const inferred = inferRuleProfile(venue, context);
    const sourceMode = resolveSourceMode(venue.seedCalibratedProfile, inferred.profile);
    const baseProfile = mergeProfile(venue.seedCalibratedProfile, inferred.profile);
    const tonePressure = applyContextTonePressure(baseProfile, venue, context);
    const profile = tonePressure.profile;
    const experienceStrengths = inferred.experienceStrengths;
    const experienceArchetypes = deriveExperienceArchetypes(venue, profile, experienceStrengths);
    const hyperlocalActivation = deriveHyperlocalActivation(venue, profile, experienceArchetypes, context);
    const momentEnrichment = deriveMomentEnrichment(venue, profile, experienceStrengths, experienceArchetypes, hyperlocalActivation);
    const romanticSignals = deriveRomanticSignals(venue, profile, experienceStrengths, experienceArchetypes, momentEnrichment);
    const romanticScore = deriveRomanticScore(romanticSignals);
    const romanticFlavor = deriveRomanticFlavor(romanticSignals, romanticScore);
    const momentPotential = deriveMomentPotential(venue, profile, experienceStrengths, experienceArchetypes, momentEnrichment, hyperlocalActivation);
    const momentIdentity = deriveMomentIdentity(venue, profile, momentPotential, experienceArchetypes);
    const isRomanticMomentCandidate = deriveRomanticMomentCandidate(venue, romanticSignals, romanticScore, momentIdentity, experienceArchetypes, momentEnrichment);
    const noveltyWeight = deriveNoveltyWeight(venue, profile, momentPotential, momentEnrichment, hyperlocalActivation);
    const calibration = deriveTasteCalibration(venue, profile, noveltyWeight);
    const durationEstimate = deriveDurationEstimate(venue, profile);
    const baseRoleSuitability = deriveRoleSuitability(venue, profile, durationEstimate, noveltyWeight, calibration, experienceStrengths, momentPotential, experienceArchetypes, momentEnrichment, hyperlocalActivation, context);
    const anchorStrength = deriveAnchorStrength(venue, profile, baseRoleSuitability.highlight, calibration, experienceStrengths, momentPotential);
    const highlightTier = deriveHighlightTier(venue, baseRoleSuitability.highlight, profile, anchorStrength, experienceStrengths, durationEstimate, context);
    const momentIntensity = deriveMomentIntensity(venue, profile, experienceStrengths, experienceArchetypes, momentPotential, momentIdentity, romanticSignals, noveltyWeight, calibration, anchorStrength, highlightTier, momentEnrichment, hyperlocalActivation);
    const momentTier = deriveMomentTier(venue, profile, experienceStrengths, experienceArchetypes, momentPotential, momentIdentity, momentIntensity, momentEnrichment, hyperlocalActivation);
    const baseExperienceFamily = deriveExperienceFamily(venue, profile, experienceStrengths, experienceArchetypes, romanticSignals, momentIntensity, calibration, momentEnrichment, hyperlocalActivation);
    const familyExpansion = deriveExpandedExperienceFamily(venue, profile, momentPotential, momentIntensity, momentEnrichment, hyperlocalActivation, baseExperienceFamily);
    const experienceFamily = familyExpansion.family;
    const momentElevation = deriveActivationMomentElevation(profile, momentPotential, momentIntensity, hyperlocalActivation, experienceFamily, familyExpansion.expanded);
    const roleSuitability = applyExpandedFamilyRoleAdjustment(baseRoleSuitability, experienceFamily, baseExperienceFamily, hyperlocalActivation);
    const venuePersonality = deriveVenuePersonality(venue, profile, roleSuitability, highlightTier, durationEstimate, momentIntensity, context);
    const debugSignals = finalizeSupportingSignals([...inferred.supportingSignals, ...tonePressure.signals], sourceMode, momentIntensity, experienceFamily, momentEnrichment, hyperlocalActivation, momentElevation.eligible);
    return {
        ...profile,
        outdoorStrength: experienceStrengths.outdoor,
        interactiveStrength: experienceStrengths.interactive,
        roleSuitability,
        highlightTier,
        durationEstimate,
        venuePersonality,
        experienceArchetypes: experienceArchetypes.archetypes,
        primaryExperienceArchetype: experienceArchetypes.primary,
        baseExperienceFamily,
        experienceFamily,
        experienceFamilyExpanded: familyExpansion.expanded,
        experienceFamilyExpansionReason: familyExpansion.reason,
        momentElevationPotential: momentElevation.potential,
        isElevatedMomentCandidate: momentElevation.eligible,
        momentElevationReason: momentElevation.reason,
        momentPotential,
        momentIdentity,
        momentIntensity,
        momentTier,
        momentEnrichment,
        hyperlocalActivation,
        romanticSignals,
        romanticScore,
        romanticFlavor,
        isRomanticMomentCandidate,
        noveltyWeight,
        categorySpecificity: calibration.categorySpecificity,
        personalityStrength: calibration.personalityStrength,
        anchorStrength,
        debug: {
            sourceMode,
            supportingSignals: debugSignals,
            confidence: deriveDebugConfidence(venue, sourceMode),
            seedCalibratedApplied: Boolean(venue.seedCalibratedProfile),
            interpretationStrategy: sourceMode,
        },
    };
}
function inferRuleProfile(venue, context) {
    const profile = { ...CATEGORY_BASELINES[venue.category] };
    const supportingSignals = [`baseline:${venue.category}`];
    const keywords = buildKeywordCorpus(venue);
    const energyBump = keywordScore(keywords, HIGH_ENERGY_TERMS);
    const calmBump = keywordScore(keywords, CALM_TERMS);
    const destinationBump = keywordScore(keywords, DESTINATION_TERMS);
    const lingerBump = keywordScore(keywords, LINGER_TERMS);
    const socialBump = keywordScore(keywords, SOCIAL_TERMS);
    const conversationBump = keywordScore(keywords, CONVERSATION_POSITIVE_TERMS);
    const conversationPenalty = keywordScore(keywords, CONVERSATION_NEGATIVE_TERMS);
    const surpriseBump = keywordScore(keywords, SURPRISE_TERMS);
    const outdoorBump = keywordScore(keywords, OUTDOOR_TERMS);
    const scenicBump = keywordScore(keywords, SCENIC_TERMS);
    const interactiveBump = keywordScore(keywords, INTERACTIVE_TERMS);
    const socialActivityBump = keywordScore(keywords, SOCIAL_ACTIVITY_TERMS);
    const passiveHospitalityBump = keywordScore(keywords, PASSIVE_HOSPITALITY_TERMS);
    const experienceStrengths = deriveExperienceStrengths(venue, {
        outdoorBump,
        scenicBump,
        interactiveBump,
        socialActivityBump,
        passiveHospitalityBump,
    });
    profile.energy = clamp01(profile.energy + energyBump * 0.18 - calmBump * 0.12);
    profile.socialDensity = clamp01(profile.socialDensity +
        socialBump * 0.16 +
        energyBump * 0.08 +
        socialActivityBump * 0.08 -
        calmBump * 0.06);
    profile.intimacy = clamp01(profile.intimacy +
        calmBump * 0.18 +
        scenicBump * 0.08 -
        socialBump * 0.08 -
        energyBump * 0.06 -
        interactiveBump * 0.04);
    profile.lingerFactor = clamp01(profile.lingerFactor + lingerBump * 0.16 + outdoorBump * 0.06);
    profile.destinationFactor = clamp01(profile.destinationFactor +
        destinationBump * 0.2 +
        surpriseBump * 0.08 +
        scenicBump * 0.2 +
        experienceStrengths.outdoor * 0.14 +
        experienceStrengths.interactive * 0.1 -
        experienceStrengths.passiveHospitality * 0.05);
    profile.experientialFactor = clamp01(profile.experientialFactor +
        destinationBump * 0.14 +
        surpriseBump * 0.18 +
        interactiveBump * 0.2 +
        socialActivityBump * 0.12 +
        experienceStrengths.outdoor * 0.12 +
        experienceStrengths.interactive * 0.18 -
        experienceStrengths.passiveHospitality * 0.08);
    profile.conversationFriendliness = clamp01(profile.conversationFriendliness +
        conversationBump * 0.16 +
        calmBump * 0.08 -
        conversationPenalty * 0.18 +
        experienceStrengths.outdoor * 0.08 -
        experienceStrengths.interactive * 0.04);
    profile.energy = clamp01(profile.energy +
        experienceStrengths.interactive * 0.08 -
        experienceStrengths.outdoor * 0.02 -
        experienceStrengths.passiveHospitality * 0.03);
    if (venue.priceLevel === '$$$' || venue.priceLevel === '$$$$') {
        profile.destinationFactor = clamp01(profile.destinationFactor + 0.08);
        profile.experientialFactor = clamp01(profile.experientialFactor + 0.06);
        pushSupportingSignal(supportingSignals, 'metadata:premium-price');
    }
    const hasHighRatingCue = (venue.rating ?? 0) >= 4.5;
    const hasHighReviewCue = (venue.reviewCount ?? 0) >= 250;
    if (hasHighRatingCue) {
        profile.destinationFactor = clamp01(profile.destinationFactor + 0.04);
        profile.experientialFactor = clamp01(profile.experientialFactor + 0.04);
    }
    if (hasHighReviewCue) {
        profile.socialDensity = clamp01(profile.socialDensity + 0.06);
        profile.destinationFactor = clamp01(profile.destinationFactor + 0.04);
    }
    if (hasHighRatingCue || hasHighReviewCue) {
        pushSupportingSignal(supportingSignals, 'metadata:strong-social-proof');
    }
    if (energyBump >= 0.33) {
        pushSupportingSignal(supportingSignals, 'keyword:high-energy');
    }
    if (calmBump >= 0.33) {
        pushSupportingSignal(supportingSignals, 'keyword:calm');
    }
    if (destinationBump >= 0.33 || surpriseBump >= 0.33) {
        pushSupportingSignal(supportingSignals, 'keyword:destination');
    }
    if (lingerBump >= 0.33) {
        pushSupportingSignal(supportingSignals, 'keyword:linger');
    }
    if (experienceStrengths.outdoor >= 0.58) {
        pushSupportingSignal(supportingSignals, 'signal:outdoor-strong');
    }
    else if (experienceStrengths.outdoor >= 0.38) {
        pushSupportingSignal(supportingSignals, 'signal:outdoor-light');
    }
    if (experienceStrengths.interactive >= 0.58) {
        pushSupportingSignal(supportingSignals, 'signal:interactive-strong');
    }
    else if (experienceStrengths.interactive >= 0.38) {
        pushSupportingSignal(supportingSignals, 'signal:interactive-light');
    }
    if (conversationBump >= 0.33) {
        pushSupportingSignal(supportingSignals, 'keyword:conversation-friendly');
    }
    if (conversationPenalty >= 0.33) {
        pushSupportingSignal(supportingSignals, 'keyword:loud');
    }
    const experienceArchetypes = deriveExperienceArchetypes(venue, profile, experienceStrengths);
    const hyperlocalActivation = deriveHyperlocalActivation(venue, profile, experienceArchetypes, context);
    const momentEnrichment = deriveMomentEnrichment(venue, profile, experienceStrengths, experienceArchetypes, hyperlocalActivation);
    const momentPotential = deriveMomentPotential(venue, profile, experienceStrengths, experienceArchetypes, momentEnrichment, hyperlocalActivation);
    if (momentPotential.score >= 0.68) {
        pushSupportingSignal(supportingSignals, 'signal:moment-strong');
    }
    else if (momentPotential.score >= 0.48) {
        pushSupportingSignal(supportingSignals, 'signal:moment-light');
    }
    if (hyperlocalActivation.primaryActivationType) {
        pushSupportingSignal(supportingSignals, `signal:activation-${hyperlocalActivation.primaryActivationType.replace(/_/g, '-')}`);
    }
    return {
        profile: clampProfile(profile),
        supportingSignals,
        experienceStrengths,
    };
}
function mergeProfile(seed, inferred) {
    if (!seed) {
        return inferred;
    }
    const seedWeight = 0.7;
    const inferredWeight = 0.3;
    return clampProfile({
        energy: seed.energy * seedWeight + inferred.energy * inferredWeight,
        socialDensity: seed.socialDensity * seedWeight + inferred.socialDensity * inferredWeight,
        intimacy: seed.intimacy * seedWeight + inferred.intimacy * inferredWeight,
        lingerFactor: seed.lingerFactor * seedWeight + inferred.lingerFactor * inferredWeight,
        destinationFactor: seed.destinationFactor * seedWeight +
            inferred.destinationFactor * inferredWeight,
        experientialFactor: seed.experientialFactor * seedWeight +
            inferred.experientialFactor * inferredWeight,
        conversationFriendliness: seed.conversationFriendliness * seedWeight +
            inferred.conversationFriendliness * inferredWeight,
    });
}
function applyContextTonePressure(profile, venue, context) {
    const persona = context?.persona ?? undefined;
    const vibe = context?.vibe ?? undefined;
    if (!vibe) {
        return { profile, signals: [] };
    }
    const keywords = buildKeywordCorpus(venue);
    const livelyLike = vibe === 'lively' || vibe === 'playful';
    const cozyLike = vibe === 'cozy' || vibe === 'chill';
    const energeticCue = clamp01(keywordScore(keywords, HIGH_ENERGY_TERMS) * 0.56 +
        keywordScore(keywords, TEMPORAL_ENERGY_TERMS) * 0.22 +
        (venue.category === 'bar' || venue.category === 'live_music' ? 0.14 : 0));
    const calmCue = clamp01(keywordScore(keywords, CALM_TERMS) * 0.56 +
        keywordScore(keywords, LANDING_TERMS) * 0.18 +
        (venue.category === 'dessert' || venue.category === 'cafe' ? 0.12 : 0));
    const containedSocialCue = clamp01(profile.socialDensity * 0.34 +
        profile.energy * 0.2 +
        profile.intimacy * 0.24 +
        profile.conversationFriendliness * 0.16 +
        keywordScore(keywords, AMBIENT_TERMS) * 0.06);
    const broadSocialCue = clamp01(profile.socialDensity * 0.42 +
        profile.energy * 0.3 +
        keywordScore(keywords, SOCIAL_TERMS) * 0.2 +
        energeticCue * 0.18 -
        profile.intimacy * 0.12);
    let nextProfile = { ...profile };
    const signals = [];
    if (livelyLike) {
        const livelyLift = 0.08 +
            energeticCue * 0.08 +
            (venue.category === 'bar' || venue.category === 'live_music' ? 0.04 : 0);
        nextProfile.energy = clamp01(nextProfile.energy + livelyLift);
        nextProfile.socialDensity = clamp01(nextProfile.socialDensity + 0.07 + broadSocialCue * 0.07);
        nextProfile.experientialFactor = clamp01(nextProfile.experientialFactor + 0.06);
        nextProfile.destinationFactor = clamp01(nextProfile.destinationFactor + 0.03 + energeticCue * 0.03);
        if (persona === 'romantic') {
            nextProfile.intimacy = clamp01(nextProfile.intimacy - 0.01 + containedSocialCue * 0.05);
            nextProfile.conversationFriendliness = clamp01(nextProfile.conversationFriendliness - 0.02 + containedSocialCue * 0.04);
            signals.push('tone:vibe-lively-romantic-contained-lift');
        }
        else if (persona === 'friends') {
            nextProfile.intimacy = clamp01(nextProfile.intimacy - 0.06);
            nextProfile.conversationFriendliness = clamp01(nextProfile.conversationFriendliness - 0.03);
            signals.push('tone:vibe-lively-friends-broad-social-lift');
        }
        else {
            nextProfile.intimacy = clamp01(nextProfile.intimacy - 0.03);
            nextProfile.conversationFriendliness = clamp01(nextProfile.conversationFriendliness - 0.02);
            signals.push('tone:vibe-lively-general-lift');
        }
    }
    else if (cozyLike) {
        const cozySoftening = 0.09 + calmCue * 0.06;
        nextProfile.energy = clamp01(nextProfile.energy - cozySoftening);
        nextProfile.socialDensity = clamp01(nextProfile.socialDensity - 0.08 - broadSocialCue * 0.04);
        nextProfile.intimacy = clamp01(nextProfile.intimacy + 0.08 + calmCue * 0.06);
        nextProfile.conversationFriendliness = clamp01(nextProfile.conversationFriendliness + 0.07 + calmCue * 0.04);
        nextProfile.lingerFactor = clamp01(nextProfile.lingerFactor + 0.05);
        nextProfile.destinationFactor = clamp01(nextProfile.destinationFactor - 0.02 + calmCue * 0.02);
        signals.push('tone:vibe-cozy-softening');
    }
    else if (vibe === 'cultured') {
        nextProfile.destinationFactor = clamp01(nextProfile.destinationFactor + 0.05);
        nextProfile.experientialFactor = clamp01(nextProfile.experientialFactor + 0.05);
        nextProfile.conversationFriendliness = clamp01(nextProfile.conversationFriendliness + 0.03);
        nextProfile.energy = clamp01(nextProfile.energy + 0.01);
        signals.push('tone:vibe-cultured-curation-lift');
    }
    else if (vibe === 'adventurous-outdoor' || vibe === 'adventurous-urban') {
        nextProfile.energy = clamp01(nextProfile.energy + 0.06);
        nextProfile.socialDensity = clamp01(nextProfile.socialDensity + 0.03);
        nextProfile.experientialFactor = clamp01(nextProfile.experientialFactor + 0.07);
        nextProfile.destinationFactor = clamp01(nextProfile.destinationFactor + 0.03);
        nextProfile.lingerFactor = clamp01(nextProfile.lingerFactor + 0.02);
        signals.push('tone:vibe-adventurous-lift');
    }
    return {
        profile: clampProfile(nextProfile),
        signals,
    };
}
function deriveRoleSuitability(venue, profile, durationEstimate, noveltyWeight, calibration, experienceStrengths, momentPotential, experienceArchetypes, momentEnrichment, hyperlocalActivation, context) {
    const keywords = buildKeywordCorpus(venue);
    const quickStopSignal = clamp01(keywordScore(keywords, QUICK_STOP_TERMS) * 0.72 +
        (durationEstimate === 'quick' ? 0.22 : 0));
    const landingSignal = clamp01(keywordScore(keywords, LANDING_TERMS) * 0.58 +
        keywordScore(keywords, CALM_TERMS) * 0.3 +
        (venue.category === 'dessert' || venue.category === 'cafe' ? 0.12 : 0) +
        (durationEstimate === 'extended' || durationEstimate === 'moderate' ? 0.08 : 0));
    const centerpieceSignal = clamp01(keywordScore(keywords, CENTERPIECE_TERMS) * 0.42 +
        profile.destinationFactor * 0.24 +
        profile.experientialFactor * 0.22 +
        venue.signatureStrength * 0.12 +
        (venue.highlightCapable ? 0.12 : 0));
    const startFrictionSignal = clamp01(keywordScore(keywords, START_FRICTION_TERMS) * 0.56 +
        keywordScore(keywords, DESTINATION_TERMS) * 0.18 +
        (durationEstimate === 'event' ? 0.12 : 0));
    const nightlifePressure = clamp01(calibration.nightlifeStrength * 0.56 +
        profile.energy * 0.3 +
        profile.socialDensity * 0.14);
    const hoursConfidence = venue.hoursConfidence ?? 0.5;
    const temporalAdjustments = hyperlocalActivation.temporalCompatibility.roleAdjustments;
    const startHoursSupport = venue.hoursStatus === 'open' || venue.hoursStatus === 'likely_open'
        ? 0.06
        : venue.hoursStatus === 'closed' || venue.hoursStatus === 'likely_closed'
            ? -0.1
            : 0;
    const quickDurationPenalty = durationEstimate === 'quick'
        ? 0.14
        : durationEstimate === 'event'
            ? 0.1
            : durationEstimate === 'moderate'
                ? 0.04
                : 0;
    const startDurationPenalty = durationEstimate === 'event' ? 0.18 : durationEstimate === 'extended' ? 0.06 : 0;
    const windDownDurationPenalty = durationEstimate === 'event' ? 0.2 : durationEstimate === 'quick' ? 0.04 : 0;
    let start = clamp01(profile.conversationFriendliness * 0.28 +
        profile.socialDensity * 0.14 +
        profile.intimacy * 0.08 +
        (1 - profile.energy) * 0.1 +
        profile.lingerFactor * 0.1 +
        (1 - profile.destinationFactor) * 0.08 +
        (1 - profile.experientialFactor) * 0.06 +
        calibration.categorySpecificity * 0.06 +
        calibration.personalityStrength * 0.04 +
        experienceStrengths.outdoor * 0.06 +
        experienceStrengths.interactive * 0.03 +
        hoursConfidence * 0.12 +
        startHoursSupport +
        (1 - calibration.nightlifeStrength) * 0.04 -
        calibration.signatureDiningStrength * 0.03 -
        startFrictionSignal * 0.16 -
        centerpieceSignal * 0.2 -
        startDurationPenalty +
        quickStopSignal * 0.08 +
        temporalAdjustments.start +
        (venue.category === 'cafe' ? 0.06 : 0));
    const categoryIdentityBoost = experienceStrengths.interactive >= 0.7 || experienceStrengths.outdoor >= 0.76
        ? 0.11
        : venue.category === 'activity' ||
            venue.category === 'museum' ||
            venue.category === 'park' ||
            venue.category === 'event'
            ? 0.08
            : venue.category === 'restaurant' ||
                venue.category === 'bar' ||
                venue.category === 'live_music'
                ? 0.05
                : 0.02;
    const distinctiveArchetypeBoost = experienceArchetypes.archetypes.some((archetype) => archetype === 'outdoor' ||
        archetype === 'activity' ||
        archetype === 'culture' ||
        archetype === 'scenic')
        ? 0.09
        : experienceArchetypes.archetypes.includes('social')
            ? 0.05
            : 0.02;
    const quickStopSuppression = quickStopSignal >= 0.55 &&
        !(venue.signatureStrength >= 0.8 && profile.destinationFactor >= 0.74)
        ? 0.16
        : quickDurationPenalty;
    let highlight = clamp01(profile.destinationFactor * 0.22 +
        profile.experientialFactor * 0.22 +
        profile.energy * 0.1 +
        experienceStrengths.interactive * 0.12 +
        experienceStrengths.outdoor * 0.1 +
        momentPotential.score * 0.14 +
        momentEnrichment.highlightSurfaceBoost * 0.12 +
        hyperlocalActivation.interpretationImpact.highlightSuitability * 0.24 +
        venue.signatureStrength * 0.15 +
        venue.qualityScore * 0.08 +
        noveltyWeight * 0.08 +
        calibration.categorySpecificity * 0.12 +
        calibration.personalityStrength * 0.12 +
        Math.max(calibration.nightlifeStrength, calibration.signatureDiningStrength) *
            0.1 +
        calibration.eveningFit * 0.06 +
        centerpieceSignal * 0.18 +
        temporalAdjustments.highlight +
        categoryIdentityBoost +
        distinctiveArchetypeBoost -
        quickStopSuppression -
        landingSignal * 0.12 -
        calibration.genericPremiumPenalty * 0.12 +
        (venue.highlightCapable === false ? 0.12 : 0) +
        (venue.category === 'restaurant' || venue.category === 'bar' ? 0.01 : 0));
    let windDown = clamp01(profile.intimacy * 0.26 +
        profile.conversationFriendliness * 0.24 +
        profile.lingerFactor * 0.2 +
        experienceStrengths.outdoor * 0.05 +
        (1 - profile.energy) * 0.14 +
        (1 - profile.socialDensity) * 0.08 +
        landingSignal * 0.18 +
        calibration.categorySpecificity * 0.04 +
        hoursConfidence * 0.08 +
        (1 - calibration.nightlifeStrength) * 0.04 -
        calibration.signatureDiningStrength * 0.02 +
        (durationEstimate === 'moderate' || durationEstimate === 'extended' ? 0.04 : 0) -
        windDownDurationPenalty -
        centerpieceSignal * 0.2 -
        nightlifePressure * 0.12 +
        temporalAdjustments.windDown +
        (venue.category === 'dessert' || venue.category === 'cafe' || venue.category === 'park'
            ? 0.08
            : venue.category === 'bar'
                ? 0.02
                : 0));
    if (highlight >= 0.72) {
        const dominance = clamp01((highlight - 0.72) * 1.18 + centerpieceSignal * 0.28);
        start = clamp01(start - 0.14 * dominance);
        windDown = clamp01(windDown - 0.2 * dominance);
    }
    if (start >= 0.66 && centerpieceSignal >= 0.58) {
        start = clamp01(start - 0.12);
    }
    if (windDown >= 0.62 &&
        (profile.energy >= 0.66 || nightlifePressure >= 0.62 || centerpieceSignal >= 0.66)) {
        windDown = clamp01(windDown - 0.16);
    }
    if (landingSignal >= 0.58) {
        highlight = clamp01(highlight - 0.08 * landingSignal);
    }
    const vibe = context?.vibe ?? undefined;
    const persona = context?.persona ?? undefined;
    const livelyLike = vibe === 'lively' || vibe === 'playful';
    const cozyLike = vibe === 'cozy' || vibe === 'chill';
    const livelyPulseSignal = clamp01(profile.energy * 0.36 +
        profile.socialDensity * 0.26 +
        nightlifePressure * 0.2 +
        momentPotential.score * 0.08 +
        venue.signatureStrength * 0.1);
    const containedPulseSignal = clamp01(livelyPulseSignal * 0.54 +
        profile.intimacy * 0.2 +
        profile.conversationFriendliness * 0.16 +
        (1 - quickStopSignal) * 0.1);
    const softCenterSignal = clamp01((1 - profile.energy) * 0.44 +
        (1 - profile.socialDensity) * 0.26 +
        landingSignal * 0.16 +
        profile.intimacy * 0.14);
    const broadChaosSignal = clamp01(profile.energy * 0.42 +
        profile.socialDensity * 0.32 +
        nightlifePressure * 0.2 -
        profile.intimacy * 0.16 -
        profile.conversationFriendliness * 0.1);
    if (livelyLike) {
        highlight = clamp01(highlight + livelyPulseSignal * 0.1 + containedPulseSignal * 0.06 - softCenterSignal * 0.1);
        start = clamp01(start - livelyPulseSignal * 0.08);
        windDown = clamp01(windDown - livelyPulseSignal * 0.06);
        if (persona === 'romantic') {
            highlight = clamp01(highlight + containedPulseSignal * 0.08 - broadChaosSignal * 0.1);
            if (softCenterSignal >= 0.62 && centerpieceSignal < 0.62) {
                highlight = clamp01(highlight - 0.1);
            }
        }
        else if (persona === 'friends') {
            highlight = clamp01(highlight + livelyPulseSignal * 0.08);
            start = clamp01(start + profile.socialDensity * 0.04);
        }
        else if (persona === 'family') {
            highlight = clamp01(highlight - broadChaosSignal * 0.08);
            windDown = clamp01(windDown + profile.conversationFriendliness * 0.05);
        }
    }
    else if (cozyLike) {
        highlight = clamp01(highlight - livelyPulseSignal * 0.14 + profile.intimacy * 0.08 + landingSignal * 0.06);
        start = clamp01(start + profile.conversationFriendliness * 0.06 + profile.intimacy * 0.04);
        windDown = clamp01(windDown + landingSignal * 0.08 + profile.conversationFriendliness * 0.06);
    }
    const surprise = clamp01(noveltyWeight * 0.28 +
        profile.experientialFactor * 0.2 +
        profile.destinationFactor * 0.18 +
        momentPotential.score * 0.1 +
        Math.max(momentEnrichment.temporalEnergy, momentEnrichment.culturalDepth) * 0.08 +
        hyperlocalActivation.interpretationImpact.novelty * 0.16 +
        experienceStrengths.interactive * 0.14 +
        experienceStrengths.outdoor * 0.06 +
        profile.energy * 0.08 +
        venue.signatureStrength * 0.12 +
        calibration.personalityStrength * 0.08 +
        temporalAdjustments.surprise +
        calibration.categorySpecificity * 0.04 +
        (venue.category === 'event' || venue.category === 'activity' ? 0.08 : 0));
    return {
        start,
        highlight,
        windDown,
        surprise,
    };
}
function deriveHighlightTier(venue, highlightSuitability, profile, anchorStrength, experienceStrengths, durationEstimate, context) {
    const quickDurationPenalty = durationEstimate === 'quick' ? 0.12 : 0;
    const vibe = context?.vibe ?? undefined;
    const persona = context?.persona ?? undefined;
    const livelyLike = vibe === 'lively' || vibe === 'playful';
    const cozyLike = vibe === 'cozy' || vibe === 'chill';
    const pulseBand = clamp01(profile.energy * 0.46 +
        profile.socialDensity * 0.28 +
        profile.experientialFactor * 0.14 +
        (durationEstimate === 'event' ? 0.12 : 0));
    const socialContainment = clamp01(profile.intimacy * 0.34 +
        profile.conversationFriendliness * 0.28 +
        profile.socialDensity * 0.24 +
        profile.energy * 0.14);
    const broadNightlifeSignal = clamp01(profile.energy * 0.44 +
        profile.socialDensity * 0.36 -
        profile.intimacy * 0.12 -
        profile.conversationFriendliness * 0.08);
    const categoryCenterpieceLift = venue.category === 'event' || venue.category === 'live_music'
        ? 0.08
        : venue.category === 'activity' || venue.category === 'museum'
            ? 0.06
            : venue.category === 'restaurant' || venue.category === 'bar'
                ? 0.04
                : 0.02;
    const highlightStrength = highlightSuitability * 0.42 +
        profile.destinationFactor * 0.16 +
        profile.experientialFactor * 0.16 +
        Math.max(experienceStrengths.outdoor, experienceStrengths.interactive) * 0.1 +
        venue.signatureStrength * 0.12 +
        venue.qualityScore * 0.08 +
        anchorStrength * 0.16 +
        categoryCenterpieceLift -
        quickDurationPenalty;
    const vibeAdjustedStrength = clamp01(highlightStrength +
        (livelyLike ? pulseBand * 0.08 : 0) -
        (cozyLike ? pulseBand * 0.06 : 0) +
        (cozyLike ? socialContainment * 0.04 : 0));
    const exceptionalQuickCenterpiece = durationEstimate === 'quick' &&
        venue.signatureStrength >= 0.82 &&
        profile.destinationFactor >= 0.76 &&
        profile.experientialFactor >= 0.74 &&
        highlightSuitability >= 0.8 &&
        anchorStrength >= 0.74;
    const livelyToneQualified = !livelyLike ||
        (pulseBand >= 0.56 &&
            (persona !== 'romantic' || socialContainment >= 0.52) &&
            (persona === 'friends' || broadNightlifeSignal <= 0.82));
    const cozyToneQualified = !cozyLike ||
        (profile.intimacy >= 0.56 && profile.conversationFriendliness >= 0.52 && pulseBand <= 0.72);
    // Lower numeric tier is stronger: 1 = signature, 3 = connector.
    if (vibeAdjustedStrength >= 0.84 &&
        highlightSuitability >= 0.74 &&
        profile.destinationFactor >= 0.64 &&
        profile.experientialFactor >= 0.62 &&
        venue.signatureStrength >= 0.62 &&
        venue.qualityScore >= 0.58 &&
        venue.highlightCapable !== false &&
        livelyToneQualified &&
        cozyToneQualified &&
        (durationEstimate !== 'quick' || exceptionalQuickCenterpiece)) {
        return 1;
    }
    if (vibeAdjustedStrength >= 0.64 &&
        highlightSuitability >= 0.58 &&
        (persona !== 'romantic' || !livelyLike || pulseBand >= 0.5) &&
        (profile.destinationFactor >= 0.5 || profile.experientialFactor >= 0.54)) {
        return 2;
    }
    return 3;
}
function deriveMomentIntensity(venue, profile, experienceStrengths, experienceArchetypes, momentPotential, momentIdentity, romanticSignals, noveltyWeight, calibration, anchorStrength, highlightTier, momentEnrichment, hyperlocalActivation) {
    const primaryArchetype = experienceArchetypes.primary;
    const signatureQuality = clamp01(anchorStrength * 0.42 +
        venue.signatureStrength * 0.34 +
        venue.qualityScore * 0.24);
    const distinctiveIdentity = clamp01(calibration.categorySpecificity * 0.48 +
        calibration.personalityStrength * 0.32 +
        noveltyWeight * 0.2);
    const experientialRichness = clamp01(profile.experientialFactor * 0.34 +
        profile.destinationFactor * 0.22 +
        Math.max(experienceStrengths.outdoor, experienceStrengths.interactive) * 0.28 +
        momentPotential.score * 0.16 +
        Math.max(momentEnrichment.ambientUniqueness, momentEnrichment.culturalDepth) * 0.12);
    const scenicStrength = clamp01(romanticSignals.scenic * 0.58 +
        experienceStrengths.outdoor * 0.28 +
        (primaryArchetype === 'scenic' ? 0.14 : primaryArchetype === 'outdoor' ? 0.08 : 0));
    const activityRichness = clamp01(romanticSignals.sharedActivity * 0.52 +
        experienceStrengths.interactive * 0.34 +
        (primaryArchetype === 'activity' ? 0.14 : primaryArchetype === 'culture' ? 0.08 : 0));
    const ambientPull = clamp01(Math.max(romanticSignals.ambiance, romanticSignals.ambientExperience) * 0.68 +
        profile.intimacy * 0.14 +
        (primaryArchetype === 'culture' || primaryArchetype === 'social' ? 0.1 : 0));
    const temporalLift = clamp01(momentEnrichment.temporalEnergy * 0.56 +
        momentEnrichment.socialEnergy * 0.14 +
        profile.destinationFactor * 0.1 +
        profile.experientialFactor * 0.08 +
        (venue.category === 'live_music' || venue.category === 'event' ? 0.1 : 0));
    const culturalImmersion = clamp01(momentEnrichment.culturalDepth * 0.62 +
        momentEnrichment.ambientUniqueness * 0.12 +
        profile.destinationFactor * 0.08 +
        (primaryArchetype === 'culture' ? 0.12 : 0));
    const vibeRichness = clamp01(momentEnrichment.ambientUniqueness * 0.62 +
        profile.intimacy * 0.1 +
        venue.signatureStrength * 0.08 +
        (venue.setting === 'indoor' || venue.setting === 'hybrid' ? 0.08 : 0));
    const hyperlocalLift = clamp01(hyperlocalActivation.intensityContribution * 0.72 +
        hyperlocalActivation.interpretationImpact.momentIntensity * 0.34 +
        (hyperlocalActivation.materiallyChangesHighlightPotential ? 0.08 : 0) +
        (hyperlocalActivation.temporalLabel === 'active' ? 0.06 : 0));
    const highlightTierLift = highlightTier === 1 ? 0.14 : highlightTier === 2 ? 0.07 : 0;
    const momentIdentityLift = momentIdentity.type === 'anchor'
        ? 0.12
        : momentIdentity.type === 'explore'
            ? 0.09
            : momentIdentity.type === 'transition'
                ? 0.02
                : 0;
    const momentStrengthLift = momentIdentity.strength === 'strong'
        ? 0.12
        : momentIdentity.strength === 'medium'
            ? 0.06
            : 0;
    const passiveHospitalityPenalty = experienceStrengths.passiveHospitality * 0.08;
    const score = clamp01(momentPotential.score * 0.22 +
        signatureQuality * 0.16 +
        distinctiveIdentity * 0.12 +
        experientialRichness * 0.12 +
        Math.max(scenicStrength, activityRichness, ambientPull, temporalLift, culturalImmersion, vibeRichness, hyperlocalLift) * 0.16 +
        profile.destinationFactor * 0.08 +
        venue.qualityScore * 0.06 +
        highlightTierLift * 0.45 +
        momentIdentityLift * 0.42 +
        momentStrengthLift * 0.42 -
        passiveHospitalityPenalty);
    const tier = score >= 0.935 &&
        signatureQuality >= 0.72 &&
        momentPotential.score >= 0.68 &&
        highlightTier === 1
        ? 'signature'
        : score >= 0.72 && (momentPotential.score >= 0.6 || momentIdentity.strength === 'strong')
            ? 'exceptional'
            : score >= 0.56
                ? 'strong'
                : 'standard';
    const driverScores = [
        { label: 'scenic pull', value: scenicStrength },
        { label: 'shared activity', value: activityRichness },
        { label: 'ambient romance', value: ambientPull },
        { label: 'temporal lift', value: temporalLift },
        { label: 'cultural depth', value: culturalImmersion },
        { label: 'ambient uniqueness', value: vibeRichness },
        { label: 'hyperlocal activation', value: hyperlocalLift },
        { label: 'signature quality', value: signatureQuality },
        { label: 'distinctive identity', value: distinctiveIdentity },
        { label: 'experiential richness', value: experientialRichness },
    ]
        .filter((driver) => driver.value >= 0.46)
        .sort((left, right) => right.value - left.value)
        .slice(0, 3);
    return {
        score,
        tier,
        drivers: driverScores.length > 0
            ? driverScores.map((driver) => driver.label)
            : ['baseline moment read'],
    };
}
function deriveMomentTier(venue, profile, experienceStrengths, experienceArchetypes, momentPotential, momentIdentity, momentIntensity, momentEnrichment, hyperlocalActivation) {
    const keywords = buildKeywordCorpus(venue);
    const primaryArchetype = experienceArchetypes.primary;
    const destinationKeyword = keywordScore(keywords, DESTINATION_TERMS);
    const identityKeyword = keywordScore(keywords, MOMENT_ANCHOR_IDENTITY_TERMS);
    const identitySignal = clamp01(destinationKeyword * 0.44 +
        identityKeyword * 0.34 +
        venue.signatureStrength * 0.12 +
        venue.qualityScore * 0.1);
    const destinationRead = clamp01(profile.destinationFactor * 0.28 +
        momentPotential.score * 0.2 +
        momentIntensity.score * 0.1 +
        venue.signatureStrength * 0.14 +
        venue.qualityScore * 0.1 +
        identitySignal * 0.18 +
        (momentIdentity.type === 'anchor'
            ? 0.14
            : momentIdentity.type === 'explore'
                ? 0.08
                : momentIdentity.type === 'linger'
                    ? 0.04
                    : 0));
    const experientialRichness = clamp01(profile.experientialFactor * 0.3 +
        momentIntensity.score * 0.2 +
        momentPotential.score * 0.16 +
        Math.max(experienceStrengths.outdoor, experienceStrengths.interactive) * 0.12 +
        Math.max(momentEnrichment.ambientUniqueness, momentEnrichment.culturalDepth) * 0.12 +
        hyperlocalActivation.intensityContribution * 0.1);
    const memorability = clamp01(venue.signatureStrength * 0.38 +
        venue.qualityScore * 0.2 +
        momentIntensity.score * 0.2 +
        Math.max(momentEnrichment.ambientUniqueness, momentEnrichment.culturalDepth) * 0.14 +
        hyperlocalActivation.interpretationImpact.novelty * 0.08);
    const anchorScore = clamp01(destinationRead * 0.34 +
        experientialRichness * 0.28 +
        memorability * 0.22 +
        identitySignal * 0.16 +
        (momentIdentity.strength === 'strong' ? 0.08 : 0));
    const hospitalityOrCulturalPrimary = primaryArchetype === 'dining' ||
        primaryArchetype === 'drinks' ||
        primaryArchetype === 'sweet' ||
        primaryArchetype === 'culture' ||
        primaryArchetype === 'social';
    const builderScore = clamp01(destinationRead * 0.24 +
        experientialRichness * 0.28 +
        memorability * 0.2 +
        profile.lingerFactor * 0.1 +
        profile.intimacy * 0.08 +
        (hospitalityOrCulturalPrimary ? 0.08 : 0));
    const destinationLikeCharacteristics = destinationKeyword >= 0.34 ||
        identityKeyword >= 0.34 ||
        venue.eventCapable ||
        venue.performanceCapable ||
        venue.musicCapable;
    const anchorTierQualified = (momentIdentity.type === 'anchor' || momentIdentity.type === 'explore') &&
        momentIdentity.strength === 'strong' &&
        (momentIntensity.tier === 'exceptional' || momentIntensity.tier === 'signature') &&
        anchorScore >= 0.66 &&
        destinationLikeCharacteristics;
    if (anchorTierQualified) {
        return 'anchor';
    }
    const builderTierQualified = builderScore >= 0.54 &&
        momentPotential.score >= 0.46 &&
        momentIntensity.score >= 0.54 &&
        (momentIdentity.type === 'anchor' ||
            momentIdentity.type === 'explore' ||
            momentIdentity.type === 'linger' ||
            hospitalityOrCulturalPrimary);
    if (builderTierQualified) {
        return 'builder';
    }
    return 'support';
}
function deriveDurationEstimate(venue, profile) {
    if (venue.category === 'event' || venue.category === 'live_music') {
        return 'event';
    }
    const keywords = buildKeywordCorpus(venue);
    const quickCue = keywordScore(keywords, QUICK_STOP_TERMS);
    const landingCue = keywordScore(keywords, LANDING_TERMS);
    const durationScore = profile.lingerFactor * 0.44 +
        profile.experientialFactor * 0.18 +
        profile.destinationFactor * 0.12 +
        (venue.category === 'restaurant' ? 0.08 : 0) +
        (venue.category === 'activity' || venue.category === 'museum' ? 0.06 : 0) +
        (venue.category === 'cafe' || venue.category === 'dessert' ? -0.1 : 0) +
        landingCue * 0.12 -
        quickCue * 0.24;
    if (durationScore >= 0.76) {
        return 'extended';
    }
    if (durationScore >= 0.5) {
        return 'moderate';
    }
    return 'quick';
}
function deriveVenuePersonality(venue, profile, roleSuitability, highlightTier, durationEstimate, momentIntensity, context) {
    const tags = [];
    const keywords = buildKeywordCorpus(venue);
    const hasKeyword = (terms, threshold = 0.28) => keywordScore(keywords, terms) >= threshold;
    const quickCue = keywordScore(keywords, QUICK_STOP_TERMS);
    const landingCue = keywordScore(keywords, LANDING_TERMS);
    const destinationCue = keywordScore(keywords, DESTINATION_TERMS);
    const centerpieceCue = keywordScore(keywords, CENTERPIECE_TERMS);
    const socialCue = keywordScore(keywords, SOCIAL_TERMS);
    const intimacyCue = keywordScore(keywords, INTIMACY_TERMS);
    const vibe = context?.vibe ?? undefined;
    const persona = context?.persona ?? undefined;
    const livelyLike = vibe === 'lively' || vibe === 'playful';
    const cozyLike = vibe === 'cozy' || vibe === 'chill';
    const socialThreshold = livelyLike ? 0.62 : cozyLike ? 0.72 : 0.68;
    const intimacyThreshold = livelyLike ? 0.66 : cozyLike ? 0.58 : 0.64;
    const intimate = (profile.intimacy >= intimacyThreshold &&
        profile.conversationFriendliness >= 0.6 &&
        profile.socialDensity <= (livelyLike ? 0.7 : 0.68)) ||
        (profile.intimacy >= 0.7 && profile.socialDensity <= 0.74) ||
        (hasKeyword(['intimate', 'cozy', 'candle', 'romantic', 'conversation'], 0.26) &&
            socialCue <= (livelyLike ? 0.38 : 0.34));
    if (intimate) {
        tags.push('intimate');
    }
    const social = profile.socialDensity >= socialThreshold ||
        (profile.energy >= (livelyLike ? 0.64 : 0.7) &&
            profile.socialDensity >= (livelyLike ? 0.54 : 0.58)) ||
        hasKeyword(['social', 'cocktail', 'lively', 'buzzing', 'group', 'nightlife'], 0.3);
    if (social) {
        tags.push('social');
    }
    const destination = (profile.destinationFactor >= 0.64 &&
        profile.experientialFactor >= 0.56 &&
        venue.signatureStrength >= 0.56 &&
        quickCue <= 0.5) ||
        highlightTier === 1 ||
        (momentIntensity.tier === 'signature' &&
            venue.signatureStrength >= 0.56 &&
            quickCue <= 0.52) ||
        (hasKeyword(['destination', 'signature', 'chef', 'notable', 'must-visit'], 0.28) &&
            roleSuitability.highlight >= 0.6 &&
            quickCue <= 0.54);
    if (destination) {
        tags.push('destination');
    }
    const lingering = ((profile.lingerFactor >= 0.62 || landingCue >= 0.4) &&
        (durationEstimate === 'moderate' || durationEstimate === 'extended')) ||
        (durationEstimate === 'extended' && profile.conversationFriendliness >= 0.5) ||
        (hasKeyword(['lingering', 'dessert', 'wine', 'tea', 'patio', 'courtyard'], 0.3) &&
            quickCue < 0.58);
    if (lingering) {
        tags.push('lingering');
    }
    const quickStop = (durationEstimate === 'quick' &&
        (quickCue >= 0.28 || roleSuitability.highlight <= 0.54)) ||
        (quickCue >= 0.42 && destinationCue <= 0.36 && centerpieceCue <= 0.42) ||
        hasKeyword(['quick', 'grab', 'counter', 'walk-up', 'to-go'], 0.34);
    if (quickStop) {
        tags.push('quick_stop');
    }
    const experiential = (profile.experientialFactor >= 0.64 &&
        (momentIntensity.score >= 0.64 || profile.destinationFactor >= 0.56) &&
        quickCue <= 0.58) ||
        momentIntensity.tier === 'signature' ||
        hasKeyword(['immersive', 'tasting', 'live', 'performance', 'curated', 'interactive'], 0.3);
    if (experiential) {
        tags.push('experiential');
    }
    if (livelyLike && roleSuitability.highlight >= 0.64 && profile.energy >= 0.56) {
        if (!tags.includes('social')) {
            tags.push('social');
        }
        if (persona === 'romantic' &&
            profile.intimacy >= 0.54 &&
            profile.conversationFriendliness >= 0.52 &&
            !tags.includes('intimate')) {
            tags.push('intimate');
        }
    }
    if (cozyLike && roleSuitability.highlight >= 0.58) {
        if (!tags.includes('intimate') && profile.intimacy >= 0.56) {
            tags.push('intimate');
        }
        if (tags.includes('social') && !tags.includes('destination') && profile.socialDensity <= 0.7) {
            tags.splice(tags.indexOf('social'), 1);
        }
    }
    if (tags.includes('social') && tags.includes('intimate')) {
        const socialAdvantage = profile.socialDensity + socialCue - (profile.intimacy + intimacyCue);
        if (socialAdvantage >= 0.18) {
            tags.splice(tags.indexOf('intimate'), 1);
        }
        else if (socialAdvantage <= -0.2) {
            tags.splice(tags.indexOf('social'), 1);
        }
    }
    if (tags.includes('quick_stop') && tags.includes('destination')) {
        const strongDestinationOverride = highlightTier === 1 ||
            (venue.signatureStrength >= 0.76 &&
                profile.destinationFactor >= 0.74 &&
                roleSuitability.highlight >= 0.78);
        if (!strongDestinationOverride) {
            tags.splice(tags.indexOf('destination'), 1);
        }
    }
    if (tags.includes('quick_stop') && tags.includes('lingering') && landingCue < 0.44) {
        tags.splice(tags.indexOf('lingering'), 1);
    }
    return {
        tags: [...new Set(tags)],
    };
}
function deriveNoveltyWeight(venue, profile, momentPotential, momentEnrichment, hyperlocalActivation) {
    return clamp01(venue.signatureStrength * 0.42 +
        profile.destinationFactor * 0.18 +
        profile.experientialFactor * 0.16 +
        momentPotential.score * 0.08 +
        Math.max(momentEnrichment.ambientUniqueness, momentEnrichment.culturalDepth) * 0.08 +
        hyperlocalActivation.intensityContribution * 0.06 +
        hyperlocalActivation.interpretationImpact.novelty * 0.18 +
        venue.qualityScore * 0.08 +
        venue.sourceConfidence * 0.08 +
        (venue.liveSource ? 0.05 : 0) +
        ((venue.tags.length > 3 || (venue.placeTypes?.length ?? 0) > 2) ? 0.03 : 0));
}
function deriveTasteCalibration(venue, profile, noveltyWeight) {
    const keywords = buildKeywordCorpus(venue);
    const nightlifeStrength = keywordScore(keywords, NIGHTLIFE_SIGNATURE_TERMS);
    const signatureDiningStrength = keywordScore(keywords, DINING_SIGNATURE_TERMS);
    const localCharacterStrength = keywordScore(keywords, LOCAL_CHARACTER_TERMS);
    const genericPremiumStrength = keywordScore(keywords, GENERIC_PREMIUM_TERMS);
    const subcategorySpecificity = venue.subcategory && !isGenericSubcategory(venue.subcategory, venue.category) ? 1 : 0;
    const tagRichness = clamp01(venue.tags.length / 5);
    const placeTypeRichness = clamp01((venue.placeTypes?.length ?? 0) / 4);
    const categorySpecificity = clamp01(subcategorySpecificity * 0.34 +
        tagRichness * 0.24 +
        placeTypeRichness * 0.12 +
        localCharacterStrength * 0.14 +
        signatureDiningStrength * 0.1 +
        nightlifeStrength * 0.06);
    const personalityStrength = clamp01(categorySpecificity * 0.34 +
        venue.signatureStrength * 0.24 +
        noveltyWeight * 0.16 +
        localCharacterStrength * 0.14 +
        Math.max(signatureDiningStrength, nightlifeStrength) * 0.12 -
        Math.max(0, genericPremiumStrength - categorySpecificity) * 0.12);
    const hoursSupport = venue.hoursStatus === 'open' || venue.hoursStatus === 'likely_open'
        ? 0.16
        : venue.hoursStatus === 'closed' || venue.hoursStatus === 'likely_closed'
            ? -0.2
            : 0;
    const eveningCategoryBase = venue.category === 'restaurant' ||
        venue.category === 'bar' ||
        venue.category === 'live_music' ||
        venue.category === 'event'
        ? 0.56
        : venue.category === 'activity' || venue.category === 'museum'
            ? 0.44
            : venue.category === 'dessert'
                ? 0.38
                : 0.24;
    const eveningFit = clamp01(eveningCategoryBase +
        profile.energy * 0.12 +
        profile.lingerFactor * 0.12 +
        (venue.hoursConfidence ?? 0.5) * 0.08 +
        hoursSupport);
    const genericPremiumPenalty = clamp01(genericPremiumStrength * 0.56 +
        ((venue.priceLevel === '$$$' || venue.priceLevel === '$$$$') ? 0.12 : 0) -
        categorySpecificity * 0.24 -
        personalityStrength * 0.2 -
        localCharacterStrength * 0.12 -
        venue.signatureStrength * 0.12);
    return {
        categorySpecificity,
        personalityStrength,
        nightlifeStrength,
        signatureDiningStrength,
        eveningFit,
        genericPremiumPenalty,
    };
}
function deriveAnchorStrength(venue, profile, highlightSuitability, calibration, experienceStrengths, momentPotential) {
    return clamp01(highlightSuitability * 0.24 +
        profile.destinationFactor * 0.2 +
        profile.experientialFactor * 0.16 +
        momentPotential.score * 0.08 +
        Math.max(experienceStrengths.outdoor, experienceStrengths.interactive) * 0.1 +
        venue.signatureStrength * 0.14 +
        calibration.categorySpecificity * 0.12 +
        calibration.personalityStrength * 0.1 +
        calibration.eveningFit * 0.06 +
        venue.qualityScore * 0.04 +
        venue.sourceConfidence * 0.04 -
        calibration.genericPremiumPenalty * 0.08);
}
function deriveExperienceStrengths(venue, keywordSignals) {
    const scenicPlaceType = hasAnyFragment(venue.placeTypes, [
        'garden',
        'lookout',
        'park',
        'pier',
        'plaza',
        'promenade',
        'trail',
        'view',
        'waterfront',
    ]);
    const interactivePlaceType = hasAnyFragment(venue.placeTypes, [
        'amusement',
        'arcade',
        'bowling',
        'escape',
        'gallery',
        'museum',
        'studio',
        'theater',
        'workshop',
    ]);
    const outdoor = (venue.category === 'park' ? 0.74 : 0) +
        (venue.setting === 'outdoor' ? 0.56 : venue.setting === 'hybrid' ? 0.34 : 0.04) +
        keywordSignals.outdoorBump * 0.22 +
        keywordSignals.scenicBump * 0.28 +
        (scenicPlaceType ? 0.16 : 0) +
        (venue.highlightCapable ? 0.04 : 0) -
        keywordSignals.passiveHospitalityBump * 0.08;
    const interactive = (venue.category === 'activity'
        ? 0.74
        : venue.category === 'event' || venue.category === 'live_music'
            ? 0.48
            : venue.category === 'museum'
                ? 0.28
                : 0.04) +
        keywordSignals.interactiveBump * 0.34 +
        keywordSignals.socialActivityBump * 0.2 +
        (interactivePlaceType ? 0.16 : 0) +
        (venue.eventCapable ? 0.08 : 0) +
        (venue.performanceCapable || venue.musicCapable ? 0.06 : 0) -
        keywordSignals.passiveHospitalityBump * 0.1;
    const passiveHospitality = (venue.category === 'restaurant' ||
        venue.category === 'bar' ||
        venue.category === 'cafe' ||
        venue.category === 'dessert'
        ? 0.42
        : 0.1) +
        keywordSignals.passiveHospitalityBump * 0.24 +
        (venue.setting === 'indoor' ? 0.08 : 0) -
        outdoor * 0.1 -
        interactive * 0.12;
    return {
        outdoor: clamp01(outdoor),
        interactive: clamp01(interactive),
        passiveHospitality: clamp01(passiveHospitality),
    };
}
function deriveExperienceArchetypes(venue, profile, experienceStrengths) {
    const keywords = buildKeywordCorpus(venue);
    const scores = {
        dining: (venue.category === 'restaurant' ? 0.82 : 0) +
            keywordScore(keywords, DINING_SIGNATURE_TERMS) * 0.18 +
            profile.lingerFactor * 0.04,
        drinks: (venue.category === 'bar' ? 0.84 : venue.category === 'cafe' ? 0.58 : 0) +
            keywordScore(keywords, DRINKS_TERMS) * 0.22 +
            keywordScore(keywords, NIGHTLIFE_SIGNATURE_TERMS) * 0.1,
        sweet: (venue.category === 'dessert' ? 0.88 : 0) +
            keywordScore(keywords, SWEET_TERMS) * 0.26 +
            (venue.category === 'cafe' ? 0.08 : 0),
        outdoor: experienceStrengths.outdoor * 0.88 +
            (venue.category === 'park' ? 0.18 : 0),
        activity: experienceStrengths.interactive * 0.82 +
            keywordScore(keywords, INTERACTIVE_TERMS) * 0.18 +
            keywordScore(keywords, SOCIAL_ACTIVITY_TERMS) * 0.12 +
            (venue.category === 'activity' ? 0.16 : venue.category === 'event' ? 0.08 : 0),
        culture: (venue.category === 'museum'
            ? 0.82
            : venue.category === 'live_music'
                ? 0.72
                : venue.category === 'event'
                    ? 0.42
                    : 0) +
            keywordScore(keywords, CULTURE_TERMS) * 0.26 +
            keywordScore(keywords, LOCAL_CHARACTER_TERMS) * 0.08,
        scenic: keywordScore(keywords, SCENIC_TERMS) * 0.62 +
            experienceStrengths.outdoor * 0.34 +
            (hasAnyFragment(venue.placeTypes, [
                'garden',
                'lookout',
                'promenade',
                'view',
                'waterfront',
            ])
                ? 0.12
                : 0),
        social: profile.socialDensity * 0.42 +
            keywordScore(keywords, SOCIAL_TERMS) * 0.26 +
            keywordScore(keywords, SOCIAL_ACTIVITY_TERMS) * 0.22 +
            experienceStrengths.interactive * 0.12 +
            (venue.eventCapable || venue.musicCapable || venue.performanceCapable ? 0.1 : 0),
    };
    const priority = [
        'scenic',
        'activity',
        'outdoor',
        'culture',
        'social',
        'dining',
        'drinks',
        'sweet',
    ];
    const archetypes = priority
        .filter((archetype) => scores[archetype] >= 0.42)
        .sort((left, right) => scores[right] - scores[left] || priority.indexOf(left) - priority.indexOf(right))
        .slice(0, 3);
    if (archetypes.length === 0) {
        archetypes.push(venue.category === 'restaurant'
            ? 'dining'
            : venue.category === 'bar' || venue.category === 'cafe'
                ? 'drinks'
                : venue.category === 'dessert'
                    ? 'sweet'
                    : venue.category === 'park'
                        ? 'outdoor'
                        : venue.category === 'activity'
                            ? 'activity'
                            : venue.category === 'museum' || venue.category === 'live_music'
                                ? 'culture'
                                : 'social');
    }
    return {
        primary: archetypes[0],
        archetypes,
    };
}
function deriveMomentPotential(venue, profile, experienceStrengths, experienceArchetypes, momentEnrichment, hyperlocalActivation) {
    const archetypes = new Set(experienceArchetypes.archetypes);
    const score = clamp01((archetypes.has('scenic') ? 0.28 : 0) +
        (archetypes.has('outdoor') ? 0.18 : 0) +
        (archetypes.has('activity') ? 0.24 : 0) +
        (archetypes.has('culture') ? 0.22 : 0) +
        (archetypes.has('social') ? 0.18 : 0) +
        profile.destinationFactor * 0.14 +
        profile.experientialFactor * 0.16 +
        venue.signatureStrength * 0.1 +
        venue.qualityScore * 0.06 +
        momentEnrichment.temporalEnergy * 0.08 +
        momentEnrichment.socialEnergy * 0.04 +
        momentEnrichment.ambientUniqueness * 0.08 +
        momentEnrichment.culturalDepth * 0.1 +
        hyperlocalActivation.intensityContribution * 0.08 +
        hyperlocalActivation.interpretationImpact.momentPotential * 0.18 +
        experienceStrengths.interactive * 0.24 +
        experienceStrengths.outdoor * 0.1 +
        (venue.eventCapable || venue.performanceCapable || venue.musicCapable ? 0.06 : 0) -
        experienceStrengths.passiveHospitality * 0.08);
    return {
        score,
        source: score >= 0.3 ? 'inferred' : 'none',
    };
}
function deriveExperienceFamily(venue, profile, experienceStrengths, experienceArchetypes, romanticSignals, momentIntensity, calibration, momentEnrichment, hyperlocalActivation) {
    const keywords = buildKeywordCorpus(venue);
    const archetypes = new Set(experienceArchetypes.archetypes);
    const familyRefinements = new Set(hyperlocalActivation.interpretationImpact.familyRefinements);
    const ambientKeyword = keywordScore(keywords, AMBIENT_TERMS);
    const interactiveKeyword = keywordScore(keywords, INTERACTIVE_TERMS);
    const cultureKeyword = keywordScore(keywords, CULTURE_TERMS);
    const culturalCue = keywords.includes('japanese') || keywords.includes('heritage') || keywords.includes('historic');
    const ambientCue = keywords.includes('greenhouse') ||
        keywords.includes('reflective') ||
        keywords.includes('atmosphere');
    const richnessSignal = clamp01(profile.experientialFactor * 0.42 +
        calibration.categorySpecificity * 0.28 +
        calibration.personalityStrength * 0.3);
    const scenicSignal = clamp01(romanticSignals.scenic * 0.42 +
        experienceStrengths.outdoor * 0.26 +
        (archetypes.has('scenic') ? 0.18 : 0) +
        (archetypes.has('outdoor') ? 0.1 : 0) +
        momentIntensity.score * 0.08);
    const quietSignal = clamp01(profile.conversationFriendliness * 0.34 +
        profile.intimacy * 0.22 +
        (1 - profile.energy) * 0.18 +
        (1 - profile.socialDensity) * 0.14 +
        romanticSignals.intimacy * 0.12);
    const activitySignal = clamp01(experienceStrengths.interactive * 0.42 +
        romanticSignals.sharedActivity * 0.18 +
        (archetypes.has('activity') ? 0.18 : 0) +
        (archetypes.has('social') ? 0.08 : 0) +
        (familyRefinements.has('quiet_activity')
            ? hyperlocalActivation.interpretationImpact.momentPotential * 0.18
            : 0) +
        profile.experientialFactor * 0.1);
    const cultureSignal = clamp01((archetypes.has('culture') ? 0.34 : 0) +
        cultureKeyword * 0.24 +
        romanticSignals.ambientExperience * 0.12 +
        profile.destinationFactor * 0.12 +
        richnessSignal * 0.18 +
        (familyRefinements.has('cultural')
            ? hyperlocalActivation.interpretationImpact.momentIntensity * 0.2
            : 0) +
        (venue.category === 'museum' || venue.category === 'live_music' || venue.category === 'event'
            ? 0.12
            : 0));
    const ambientSignal = clamp01(Math.max(romanticSignals.ambiance, romanticSignals.ambientExperience) * 0.34 +
        profile.intimacy * 0.12 +
        profile.destinationFactor * 0.1 +
        momentIntensity.score * 0.08 +
        momentEnrichment.ambientUniqueness * 0.18 +
        momentEnrichment.temporalEnergy * 0.06 +
        (familyRefinements.has('ambient_indoor')
            ? hyperlocalActivation.interpretationImpact.momentIntensity * 0.2
            : 0) +
        richnessSignal * 0.18 +
        (venue.setting === 'indoor' ? 0.12 : 0) +
        (venue.category === 'bar' || venue.category === 'live_music' || venue.category === 'cafe'
            ? 0.08
            : 0) +
        ambientKeyword * 0.18);
    const immersiveCultureSignal = clamp01(cultureSignal * 0.44 +
        momentEnrichment.culturalDepth * 0.28 +
        momentEnrichment.ambientUniqueness * 0.12 +
        (familyRefinements.has('immersive_cultural')
            ? hyperlocalActivation.interpretationImpact.momentIntensity * 0.18
            : 0) +
        richnessSignal * 0.12 +
        (venue.category === 'museum' || venue.category === 'live_music' || venue.category === 'event'
            ? 0.08
            : 0));
    const diningSignal = clamp01((archetypes.has('dining') ? 0.28 : 0) +
        (archetypes.has('sweet') ? 0.08 : 0) +
        profile.lingerFactor * 0.14 +
        romanticSignals.intimacy * 0.16 +
        romanticSignals.ambiance * 0.1 +
        richnessSignal * 0.16 +
        (familyRefinements.has('intimate_dining')
            ? hyperlocalActivation.interpretationImpact.highlightSuitability * 0.22
            : 0) +
        (venue.category === 'restaurant' ? 0.14 : venue.category === 'dessert' ? 0.08 : 0) +
        experienceStrengths.passiveHospitality * 0.1);
    const familyScores = [
        {
            family: 'outdoor_scenic',
            score: clamp01(scenicSignal * 0.66 + quietSignal * 0.12 + richnessSignal * 0.12),
        },
        {
            family: 'quiet_activity',
            score: clamp01(activitySignal * 0.5 + quietSignal * 0.22 + richnessSignal * 0.16),
        },
        {
            family: 'cultural',
            score: clamp01(cultureSignal * 0.62 + ambientSignal * 0.12 + richnessSignal * 0.16),
        },
        {
            family: 'immersive_cultural',
            score: clamp01(immersiveCultureSignal * 0.64 + ambientSignal * 0.1 + richnessSignal * 0.12),
        },
        {
            family: 'ambient_indoor',
            score: clamp01(ambientSignal * 0.58 + quietSignal * 0.14 + richnessSignal * 0.14),
        },
        {
            family: 'intimate_dining',
            score: clamp01(diningSignal * 0.62 + quietSignal * 0.14 + richnessSignal * 0.12),
        },
    ];
    const priority = [
        'outdoor_scenic',
        'quiet_activity',
        'immersive_cultural',
        'cultural',
        'ambient_indoor',
        'intimate_dining',
    ];
    const best = [...familyScores].sort((left, right) => {
        return (right.score - left.score ||
            priority.indexOf(left.family) - priority.indexOf(right.family));
    })[0];
    if (culturalCue && scenicSignal >= 0.54 && quietSignal >= 0.56) {
        return 'cultural';
    }
    if (ambientCue && scenicSignal >= 0.54 && quietSignal >= 0.58) {
        return 'ambient_indoor';
    }
    if (familyRefinements.has('immersive_cultural') &&
        immersiveCultureSignal >= 0.46 &&
        momentIntensity.score >= 0.66) {
        return 'immersive_cultural';
    }
    if (familyRefinements.has('ambient_indoor') &&
        ambientSignal >= 0.42 &&
        momentIntensity.score >= 0.62 &&
        venue.setting !== 'outdoor') {
        return 'ambient_indoor';
    }
    if (familyRefinements.has('intimate_dining') &&
        diningSignal >= 0.48 &&
        momentIntensity.score >= 0.6) {
        return 'intimate_dining';
    }
    const quietActivityBridge = activitySignal >= 0.4 &&
        quietSignal >= 0.58 &&
        scenicSignal - activitySignal <= 0.2 &&
        (interactiveKeyword >= 0.33 || archetypes.has('activity'));
    if (quietActivityBridge) {
        return 'quiet_activity';
    }
    const enrichedAmbientBridge = ambientSignal >= 0.42 &&
        momentEnrichment.ambientUniqueness >= 0.5 &&
        momentIntensity.score >= 0.72 &&
        calibration.personalityStrength >= 0.52 &&
        (venue.category === 'bar' ||
            venue.category === 'restaurant' ||
            venue.category === 'live_music' ||
            venue.category === 'museum');
    if (enrichedAmbientBridge) {
        return 'ambient_indoor';
    }
    const enrichedCultureBridge = immersiveCultureSignal >= 0.48 &&
        momentEnrichment.culturalDepth >= 0.46 &&
        momentIntensity.score >= 0.72 &&
        calibration.personalityStrength >= 0.5 &&
        (venue.category === 'museum' ||
            venue.category === 'live_music' ||
            venue.category === 'event' ||
            cultureKeyword >= 0.33);
    if (enrichedCultureBridge) {
        return 'immersive_cultural';
    }
    const culturalBridge = cultureSignal >= 0.34 &&
        scenicSignal - cultureSignal <= 0.3 &&
        (cultureKeyword >= 0.33 || culturalCue || romanticSignals.ambientExperience >= 0.34);
    if (culturalBridge) {
        if (immersiveCultureSignal >= 0.54 && momentEnrichment.culturalDepth >= 0.48) {
            return 'immersive_cultural';
        }
        return 'cultural';
    }
    const ambientBridge = ambientSignal >= 0.34 &&
        quietSignal >= 0.58 &&
        scenicSignal - ambientSignal <= 0.24 &&
        (ambientKeyword >= 0.33 || ambientCue);
    if (ambientBridge) {
        return 'ambient_indoor';
    }
    if (best && best.score >= 0.42) {
        return best.family;
    }
    if (archetypes.has('scenic') || archetypes.has('outdoor')) {
        return 'outdoor_scenic';
    }
    if (archetypes.has('activity')) {
        return 'quiet_activity';
    }
    if (archetypes.has('culture')) {
        return immersiveCultureSignal >= 0.54 ? 'immersive_cultural' : 'cultural';
    }
    if (archetypes.has('dining') || archetypes.has('sweet')) {
        return 'intimate_dining';
    }
    return 'ambient_indoor';
}
function deriveExpandedExperienceFamily(venue, profile, momentPotential, momentIntensity, momentEnrichment, hyperlocalActivation, baseFamily) {
    const activationType = hyperlocalActivation.primaryActivationType;
    if (!activationType ||
        !hyperlocalActivation.materiallyChangesInterpretation ||
        hyperlocalActivation.intensityContribution < 0.34 ||
        momentIntensity.score < 0.72 ||
        momentPotential.score < 0.58) {
        return { family: baseFamily, expanded: false };
    }
    const activationStrength = clamp01(hyperlocalActivation.intensityContribution * 0.52 +
        hyperlocalActivation.interpretationImpact.highlightSuitability * 0.22 +
        hyperlocalActivation.interpretationImpact.momentIntensity * 0.18 +
        (hyperlocalActivation.temporalCompatibility.materiallyChangesViability ? 0.08 : 0));
    if (activationStrength < 0.36) {
        return { family: baseFamily, expanded: false };
    }
    const expandedFamily = activationType === 'tasting_activation'
        ? 'tasting_experience'
        : activationType === 'live_performance'
            ? 'live_experience'
            : activationType === 'cultural_activation'
                ? 'immersive_experience'
                : activationType === 'ambient_activation'
                    ? 'atmospheric_experience'
                    : undefined;
    if (!expandedFamily) {
        return { family: baseFamily, expanded: false };
    }
    const distinctFromBase = (expandedFamily === 'tasting_experience' && baseFamily !== 'intimate_dining') ||
        (expandedFamily === 'live_experience' &&
            baseFamily !== 'immersive_cultural' &&
            baseFamily !== 'cultural') ||
        (expandedFamily === 'immersive_experience' &&
            baseFamily !== 'immersive_cultural' &&
            baseFamily !== 'cultural') ||
        (expandedFamily === 'atmospheric_experience' && baseFamily !== 'ambient_indoor');
    if (!distinctFromBase) {
        return { family: baseFamily, expanded: false };
    }
    const plausible = (expandedFamily === 'tasting_experience' &&
        momentEnrichment.ambientUniqueness >= 0.46 &&
        profile.intimacy >= 0.42 &&
        hyperlocalActivation.contractCompatibilityHints.includes('curated_highlight')) ||
        (expandedFamily === 'live_experience' &&
            momentEnrichment.temporalEnergy >= 0.48 &&
            momentEnrichment.culturalDepth >= 0.4 &&
            !hyperlocalActivation.activationTypes.includes('social_ritual')) ||
        (expandedFamily === 'immersive_experience' &&
            momentEnrichment.culturalDepth >= 0.52 &&
            hyperlocalActivation.contractCompatibilityHints.includes('culture_highlight')) ||
        (expandedFamily === 'atmospheric_experience' &&
            momentEnrichment.ambientUniqueness >= 0.54 &&
            profile.socialDensity <= 0.66 &&
            hyperlocalActivation.contractCompatibilityHints.includes('romantic_ambient'));
    if (!plausible) {
        return { family: baseFamily, expanded: false };
    }
    const reason = expandedFamily === 'tasting_experience'
        ? 'strong tasting activation reshaped dining into a tasting experience'
        : expandedFamily === 'live_experience'
            ? 'strong live activation reshaped culture into a live experience'
            : expandedFamily === 'immersive_experience'
                ? 'strong cultural activation reshaped the venue into an immersive experience'
                : 'strong ambient activation reshaped the venue into an atmospheric experience';
    return {
        family: expandedFamily,
        expanded: true,
        reason,
    };
}
function applyExpandedFamilyRoleAdjustment(roleSuitability, experienceFamily, baseExperienceFamily, hyperlocalActivation) {
    if (experienceFamily === baseExperienceFamily) {
        return roleSuitability;
    }
    const adjusted = { ...roleSuitability };
    const activationScale = clamp01(hyperlocalActivation.intensityContribution * 0.44 +
        hyperlocalActivation.interpretationImpact.highlightSuitability * 0.26 +
        (hyperlocalActivation.temporalCompatibility.materiallyChangesViability ? 0.12 : 0));
    if (experienceFamily === 'tasting_experience') {
        adjusted.highlight = clamp01(adjusted.highlight + 0.026 * activationScale);
        adjusted.windDown = clamp01(adjusted.windDown + 0.018 * activationScale);
    }
    else if (experienceFamily === 'live_experience') {
        adjusted.highlight = clamp01(adjusted.highlight + 0.028 * activationScale);
        adjusted.surprise = clamp01(adjusted.surprise + 0.02 * activationScale);
    }
    else if (experienceFamily === 'immersive_experience') {
        adjusted.highlight = clamp01(adjusted.highlight + 0.024 * activationScale);
        adjusted.surprise = clamp01(adjusted.surprise + 0.022 * activationScale);
    }
    else if (experienceFamily === 'atmospheric_experience') {
        adjusted.highlight = clamp01(adjusted.highlight + 0.022 * activationScale);
        adjusted.windDown = clamp01(adjusted.windDown + 0.02 * activationScale);
    }
    return adjusted;
}
function deriveActivationMomentElevation(profile, momentPotential, momentIntensity, hyperlocalActivation, experienceFamily, familyExpanded) {
    const activationType = hyperlocalActivation.primaryActivationType;
    if (!activationType) {
        return {
            potential: 0,
            eligible: false,
            reason: 'no hyperlocal activation',
        };
    }
    const hints = new Set(hyperlocalActivation.contractCompatibilityHints);
    const strongActivationEffect = hyperlocalActivation.interpretationImpact.highlightSuitability >= 0.05 ||
        hyperlocalActivation.interpretationImpact.momentIntensity >= 0.05 ||
        hyperlocalActivation.interpretationImpact.momentPotential >= 0.05;
    const contractPlausible = hints.has('romantic_ambient') ||
        hints.has('culture_highlight') ||
        hints.has('curated_highlight') ||
        hints.has('cozy_anchor');
    const socialChaosBlocked = activationType === 'social_ritual' &&
        profile.socialDensity >= 0.82 &&
        profile.intimacy < 0.5;
    const elevatedFamily = experienceFamily === 'tasting_experience' ||
        experienceFamily === 'live_experience' ||
        experienceFamily === 'immersive_experience' ||
        experienceFamily === 'atmospheric_experience';
    const potential = clamp01(hyperlocalActivation.intensityContribution * 0.34 +
        hyperlocalActivation.interpretationImpact.highlightSuitability * 0.2 +
        hyperlocalActivation.interpretationImpact.momentIntensity * 0.16 +
        hyperlocalActivation.interpretationImpact.momentPotential * 0.12 +
        momentIntensity.score * 0.14 +
        momentPotential.score * 0.08 +
        (familyExpanded && elevatedFamily ? 0.1 : 0) +
        (hyperlocalActivation.temporalCompatibility.materiallyChangesViability ? 0.05 : 0) -
        (socialChaosBlocked ? 0.14 : 0));
    if (!hyperlocalActivation.materiallyChangesInterpretation) {
        return {
            potential,
            eligible: false,
            reason: 'activation does not materially change interpretation',
        };
    }
    if (!hyperlocalActivation.materiallyChangesHighlightPotential) {
        return {
            potential,
            eligible: false,
            reason: 'activation does not materially change highlight potential',
        };
    }
    if (!strongActivationEffect || hyperlocalActivation.intensityContribution < 0.34) {
        return {
            potential,
            eligible: false,
            reason: 'activation impact too weak',
        };
    }
    if (momentIntensity.score < 0.76 || momentPotential.score < 0.58) {
        return {
            potential,
            eligible: false,
            reason: 'base moment not strong enough',
        };
    }
    if (!contractPlausible || socialChaosBlocked) {
        return {
            potential,
            eligible: false,
            reason: socialChaosBlocked
                ? 'social activation too chaotic for elevation'
                : 'contract compatibility not plausible',
        };
    }
    if (potential < 0.46) {
        return {
            potential,
            eligible: false,
            reason: 'elevation potential below threshold',
        };
    }
    return {
        potential,
        eligible: true,
        reason: activationType.replace(/_/g, ' ') +
            ' reads as a true moment candidate',
    };
}
function deriveMomentIdentity(venue, profile, momentPotential, experienceArchetypes) {
    const archetype = experienceArchetypes.primary;
    const archetypes = new Set(experienceArchetypes.archetypes);
    const strongThreshold = archetype === 'scenic' ||
        archetype === 'activity' ||
        archetype === 'culture' ||
        archetype === 'outdoor'
        ? 0.62
        : archetype === 'social'
            ? 0.66
            : 0.72;
    const mediumThreshold = archetype === 'dining' || archetype === 'drinks' || archetype === 'sweet'
        ? 0.42
        : 0.38;
    const strength = momentPotential.score >= strongThreshold
        ? 'strong'
        : momentPotential.score >= mediumThreshold
            ? 'medium'
            : 'light';
    if (strength === 'strong' &&
        (archetypes.has('activity') ||
            archetypes.has('culture') ||
            archetypes.has('social') ||
            ((archetype === 'dining' || archetype === 'drinks' || archetype === 'sweet') &&
                (profile.destinationFactor >= 0.72 || profile.experientialFactor >= 0.74)))) {
        return { type: 'anchor', strength };
    }
    if (archetype === 'scenic' || archetype === 'outdoor') {
        if (archetype === 'scenic') {
            if (strength === 'strong') {
                return { type: 'anchor', strength };
            }
            if (profile.energy <= 0.34 &&
                (profile.intimacy >= 0.64 || profile.lingerFactor >= 0.62) &&
                momentPotential.score < 0.58) {
                return { type: 'close', strength };
            }
            if (profile.energy <= 0.42 && strength === 'light') {
                return { type: 'arrival', strength };
            }
            return { type: 'explore', strength };
        }
        if (strength === 'strong' &&
            profile.destinationFactor >= 0.82 &&
            profile.experientialFactor >= 0.72) {
            return { type: 'anchor', strength };
        }
        if (profile.energy <= 0.34 &&
            (profile.intimacy >= 0.64 || profile.lingerFactor >= 0.62) &&
            profile.destinationFactor < 0.68) {
            return {
                type: 'close',
                strength: strength === 'strong' ? 'medium' : strength,
            };
        }
        if (profile.energy <= 0.42 && strength === 'light') {
            return { type: 'arrival', strength };
        }
        return { type: 'explore', strength };
    }
    if (archetype === 'activity' || archetype === 'culture') {
        return { type: strength === 'strong' ? 'anchor' : 'explore', strength };
    }
    if (archetype === 'social') {
        return {
            type: strength === 'strong'
                ? 'anchor'
                : profile.socialDensity >= 0.62
                    ? 'transition'
                    : 'explore',
            strength,
        };
    }
    if (archetype === 'sweet') {
        return {
            type: profile.energy <= 0.44 || profile.intimacy >= 0.58 ? 'close' : 'linger',
            strength,
        };
    }
    if (archetype === 'dining') {
        return {
            type: strength === 'strong'
                ? 'anchor'
                : profile.lingerFactor >= 0.6 || profile.intimacy >= 0.52
                    ? 'linger'
                    : 'transition',
            strength,
        };
    }
    if (archetype === 'drinks') {
        if (venue.category === 'cafe') {
            return {
                type: profile.energy <= 0.36
                    ? 'arrival'
                    : profile.lingerFactor >= 0.52
                        ? 'linger'
                        : 'transition',
                strength,
            };
        }
        return {
            type: profile.energy <= 0.46 ? 'linger' : 'transition',
            strength,
        };
    }
    if (profile.energy <= 0.38) {
        return { type: 'close', strength };
    }
    if (profile.lingerFactor >= 0.6) {
        return { type: 'linger', strength };
    }
    return { type: 'transition', strength };
}
function deriveRomanticSignals(venue, profile, experienceStrengths, experienceArchetypes, momentEnrichment) {
    const keywords = buildKeywordCorpus(venue);
    const archetypes = new Set(experienceArchetypes.archetypes);
    const intimacyKeyword = keywordScore(keywords, INTIMACY_TERMS);
    const ambianceKeyword = keywordScore(keywords, AMBIENT_TERMS);
    const scenicKeyword = keywordScore(keywords, SCENIC_TERMS);
    const sharedKeyword = keywordScore(keywords, SHARED_ACTIVITY_TERMS);
    const scenicPlaceType = hasAnyFragment(venue.placeTypes, [
        'garden',
        'lookout',
        'park',
        'promenade',
        'trail',
        'view',
        'viewpoint',
        'waterfront',
    ]);
    const walkingPlaceType = hasAnyFragment(venue.placeTypes, [
        'garden',
        'park',
        'promenade',
        'trail',
        'walk',
        'waterfront',
    ]);
    const interactivePlaceType = hasAnyFragment(venue.placeTypes, [
        'arcade',
        'gallery',
        'museum',
        'studio',
        'workshop',
    ]);
    const intimateCategoryBoost = venue.category === 'cafe'
        ? 0.16
        : venue.category === 'dessert'
            ? 0.12
            : venue.category === 'bar'
                ? 0.08
                : 0;
    const ambianceCategoryBoost = venue.category === 'bar'
        ? 0.18
        : venue.category === 'live_music'
            ? 0.16
            : venue.category === 'cafe'
                ? 0.08
                : venue.category === 'restaurant'
                    ? 0.06
                    : 0;
    const intimacy = clamp01(profile.intimacy * 0.44 +
        profile.conversationFriendliness * 0.16 +
        intimacyKeyword * 0.24 +
        ambianceKeyword * 0.08 +
        momentEnrichment.ambientUniqueness * 0.04 +
        intimateCategoryBoost +
        (archetypes.has('scenic') ? 0.05 : 0) -
        profile.socialDensity * 0.1 -
        profile.energy * 0.08);
    const ambiance = clamp01(ambianceKeyword * 0.34 +
        profile.destinationFactor * 0.14 +
        profile.experientialFactor * 0.12 +
        venue.signatureStrength * 0.1 +
        venue.qualityScore * 0.06 +
        momentEnrichment.ambientUniqueness * 0.14 +
        momentEnrichment.culturalDepth * 0.06 +
        ambianceCategoryBoost +
        (venue.musicCapable || venue.performanceCapable ? 0.1 : 0) +
        (archetypes.has('social') ? 0.04 : 0));
    const scenic = clamp01(experienceStrengths.outdoor * 0.34 +
        scenicKeyword * 0.3 +
        (archetypes.has('scenic') ? 0.22 : 0) +
        (archetypes.has('outdoor') ? 0.12 : 0) +
        (venue.category === 'park' ? 0.18 : 0) +
        (scenicPlaceType ? 0.14 : 0));
    const sharedActivity = clamp01(experienceStrengths.interactive * 0.34 +
        sharedKeyword * 0.28 +
        (archetypes.has('activity') ? 0.18 : 0) +
        (archetypes.has('culture') ? 0.08 : 0) +
        (interactivePlaceType ? 0.12 : 0) +
        (walkingPlaceType ? 0.1 : 0) +
        (venue.category === 'activity' ? 0.14 : venue.category === 'museum' ? 0.08 : 0));
    const ambientExperience = clamp01(ambianceKeyword * 0.2 +
        keywordScore(keywords, CULTURE_TERMS) * 0.12 +
        momentEnrichment.ambientUniqueness * 0.16 +
        momentEnrichment.culturalDepth * 0.16 +
        momentEnrichment.temporalEnergy * 0.04 +
        (venue.category === 'live_music' ? 0.28 : venue.category === 'event' ? 0.12 : 0) +
        (venue.musicCapable ? 0.18 : 0) +
        (venue.performanceCapable ? 0.12 : 0) +
        (archetypes.has('culture') ? 0.08 : 0) +
        (archetypes.has('social') ? 0.04 : 0) +
        profile.experientialFactor * 0.08);
    return {
        intimacy,
        ambiance,
        scenic,
        sharedActivity,
        ambientExperience,
    };
}
function deriveRomanticScore(romanticSignals) {
    return clamp01(romanticSignals.intimacy * 0.25 +
        romanticSignals.ambiance * 0.2 +
        romanticSignals.scenic * 0.2 +
        romanticSignals.sharedActivity * 0.2 +
        romanticSignals.ambientExperience * 0.15);
}
function deriveHyperlocalActivation(venue, profile, experienceArchetypes, context) {
    const keywords = buildKeywordCorpus(venue);
    const archetypes = new Set(experienceArchetypes.archetypes);
    const livePerformance = clamp01(keywordScore(keywords, LIVE_PERFORMANCE_ACTIVATION_TERMS) * 0.54 +
        (venue.category === 'live_music' ? 0.24 : 0) +
        (venue.musicCapable ? 0.12 : 0) +
        (venue.performanceCapable ? 0.1 : 0) +
        (venue.liveSource ? 0.06 : 0));
    const socialRitual = clamp01(keywordScore(keywords, SOCIAL_RITUAL_ACTIVATION_TERMS) * 0.5 +
        keywordScore(keywords, RECURRING_EVENT_TERMS) * 0.18 +
        (venue.category === 'bar' || venue.category === 'activity' ? 0.08 : 0) +
        (venue.eventCapable ? 0.08 : 0));
    const tastingActivation = clamp01(keywordScore(keywords, TASTING_ACTIVATION_TERMS) * 0.58 +
        (venue.category === 'restaurant' || venue.category === 'bar' ? 0.08 : 0) +
        venue.signatureStrength * 0.08);
    const culturalActivation = clamp01(keywordScore(keywords, CULTURAL_ACTIVATION_TERMS) * 0.54 +
        keywordScore(keywords, CULTURE_TERMS) * 0.14 +
        (venue.category === 'museum' ? 0.18 : venue.category === 'event' ? 0.1 : 0) +
        (venue.performanceCapable ? 0.08 : 0) +
        (archetypes.has('culture') ? 0.08 : 0));
    const seasonalMarket = clamp01(keywordScore(keywords, SEASONAL_MARKET_ACTIVATION_TERMS) * 0.6 +
        (venue.category === 'event' ? 0.16 : 0) +
        (venue.eventCapable ? 0.08 : 0));
    const ambientActivation = clamp01(keywordScore(keywords, AMBIENT_ACTIVATION_TERMS) * 0.5 +
        keywordScore(keywords, AMBIENT_TERMS) * 0.12 +
        (venue.setting === 'indoor' || venue.setting === 'hybrid' ? 0.08 : 0) +
        (venue.category === 'bar' || venue.category === 'live_music' ? 0.08 : 0) +
        venue.signatureStrength * 0.06);
    const activationScores = [
        {
            type: 'live_performance',
            score: livePerformance,
            signal: 'live performance',
        },
        {
            type: 'social_ritual',
            score: socialRitual,
            signal: 'social ritual',
        },
        {
            type: 'tasting_activation',
            score: tastingActivation,
            signal: 'tasting activation',
        },
        {
            type: 'cultural_activation',
            score: culturalActivation,
            signal: 'cultural activation',
        },
        {
            type: 'seasonal_market',
            score: seasonalMarket,
            signal: 'seasonal market',
        },
        {
            type: 'ambient_activation',
            score: ambientActivation,
            signal: 'ambient activation',
        },
    ].sort((left, right) => right.score - left.score);
    const strongest = activationScores[0];
    const activationTypes = strongest
        ? activationScores
            .filter((entry) => entry.score >= 0.42 ||
            (strongest.score >= 0.48 &&
                strongest.score - entry.score <= 0.08 &&
                entry.score >= 0.34))
            .map((entry) => entry.type)
        : [];
    const primaryActivationType = activationTypes[0];
    const temporalRelevance = clamp01((strongest?.score ?? 0) * 0.34 +
        keywordScore(keywords, PROGRAMMED_ACTIVATION_TERMS) * 0.18 +
        keywordScore(keywords, RECURRING_EVENT_TERMS) * 0.16 +
        keywordScore(keywords, SEASONAL_MARKET_ACTIVATION_TERMS) * 0.12 +
        (venue.liveSource ? 0.08 : 0) +
        ((venue.hoursStatus === 'open' || venue.hoursStatus === 'likely_open') ? 0.04 : 0));
    const temporalLabel = temporalRelevance >= 0.68
        ? 'active'
        : temporalRelevance >= 0.36
            ? 'timely'
            : 'background';
    const recurrenceShape = seasonalMarket >= 0.46
        ? 'seasonal'
        : socialRitual >= 0.44 || keywordScore(keywords, RECURRING_EVENT_TERMS) >= 0.34
            ? 'recurring'
            : livePerformance >= 0.46 ||
                tastingActivation >= 0.46 ||
                culturalActivation >= 0.46 ||
                keywordScore(keywords, PROGRAMMED_ACTIVATION_TERMS) >= 0.34
                ? 'programmed'
                : ambientActivation >= 0.46
                    ? 'ambient'
                    : undefined;
    const recurrenceBoost = recurrenceShape === 'programmed'
        ? 0.08
        : recurrenceShape === 'recurring'
            ? 0.07
            : recurrenceShape === 'seasonal'
                ? 0.08
                : recurrenceShape === 'ambient'
                    ? 0.05
                    : 0;
    const intensityContribution = activationTypes.length === 0
        ? 0
        : clamp01((strongest?.score ?? 0) * 0.4 +
            temporalRelevance * 0.22 +
            recurrenceBoost +
            profile.destinationFactor * 0.08 +
            profile.experientialFactor * 0.08 +
            (venue.qualityScore >= 0.78 ? 0.04 : 0));
    let highlightSuitabilityImpact = 0;
    let momentPotentialImpact = 0;
    let noveltyImpact = 0;
    let momentIntensityImpact = 0;
    const familyRefinements = [];
    const addFamilyRefinement = (value) => {
        if (!familyRefinements.includes(value)) {
            familyRefinements.push(value);
        }
    };
    for (const activationType of activationTypes) {
        if (activationType === 'live_performance') {
            highlightSuitabilityImpact += intensityContribution * 0.09;
            momentPotentialImpact += intensityContribution * 0.08;
            noveltyImpact += intensityContribution * 0.05;
            momentIntensityImpact += intensityContribution * 0.1;
            addFamilyRefinement('immersive_cultural');
            addFamilyRefinement('ambient_indoor');
        }
        if (activationType === 'tasting_activation') {
            highlightSuitabilityImpact += intensityContribution * 0.08;
            momentPotentialImpact += intensityContribution * 0.06;
            noveltyImpact += intensityContribution * 0.06;
            momentIntensityImpact += intensityContribution * 0.08;
            addFamilyRefinement('intimate_dining');
            addFamilyRefinement('ambient_indoor');
        }
        if (activationType === 'cultural_activation') {
            highlightSuitabilityImpact += intensityContribution * 0.08;
            momentPotentialImpact += intensityContribution * 0.08;
            noveltyImpact += intensityContribution * 0.07;
            momentIntensityImpact += intensityContribution * 0.09;
            addFamilyRefinement('immersive_cultural');
            addFamilyRefinement('cultural');
        }
        if (activationType === 'social_ritual') {
            highlightSuitabilityImpact += intensityContribution * 0.04;
            momentPotentialImpact += intensityContribution * 0.05;
            noveltyImpact += intensityContribution * 0.05;
            momentIntensityImpact += intensityContribution * 0.04;
            addFamilyRefinement('quiet_activity');
        }
        if (activationType === 'ambient_activation') {
            highlightSuitabilityImpact += intensityContribution * 0.08;
            momentPotentialImpact += intensityContribution * 0.05;
            noveltyImpact += intensityContribution * 0.04;
            momentIntensityImpact += intensityContribution * 0.08;
            addFamilyRefinement('ambient_indoor');
        }
        if (activationType === 'seasonal_market') {
            highlightSuitabilityImpact += intensityContribution * 0.06;
            momentPotentialImpact += intensityContribution * 0.08;
            noveltyImpact += intensityContribution * 0.08;
            momentIntensityImpact += intensityContribution * 0.05;
            addFamilyRefinement('quiet_activity');
            addFamilyRefinement('cultural');
        }
    }
    const contractCompatibilityHints = [];
    if (activationTypes.includes('live_performance') ||
        activationTypes.includes('ambient_activation') ||
        activationTypes.includes('cultural_activation')) {
        contractCompatibilityHints.push('romantic_ambient');
    }
    if (activationTypes.includes('cultural_activation') ||
        activationTypes.includes('live_performance')) {
        contractCompatibilityHints.push('culture_highlight');
    }
    if (activationTypes.includes('tasting_activation')) {
        contractCompatibilityHints.push('curated_highlight');
    }
    if (activationTypes.includes('social_ritual') ||
        activationTypes.includes('seasonal_market')) {
        contractCompatibilityHints.push('social_highlight');
    }
    if (activationTypes.includes('ambient_activation') ||
        (activationTypes.includes('tasting_activation') && profile.energy <= 0.58)) {
        contractCompatibilityHints.push('cozy_anchor');
    }
    const signals = activationScores
        .filter((entry) => activationTypes.includes(entry.type))
        .map((entry) => entry.signal);
    if (recurrenceShape) {
        signals.push(`${recurrenceShape} cadence`);
    }
    if (temporalLabel !== 'background' && activationTypes.length > 0) {
        signals.push(`${temporalLabel} relevance`);
    }
    const temporalCompatibility = deriveHyperlocalTemporalCompatibility(venue, keywords, activationTypes, temporalRelevance, temporalLabel, intensityContribution, context);
    return {
        activationTypes,
        primaryActivationType,
        temporalRelevance,
        temporalLabel,
        recurrenceShape,
        intensityContribution,
        contractCompatibilityHints,
        interpretationImpact: {
            highlightSuitability: clamp01(highlightSuitabilityImpact),
            momentPotential: clamp01(momentPotentialImpact),
            novelty: clamp01(noveltyImpact),
            momentIntensity: clamp01(momentIntensityImpact),
            familyRefinements,
        },
        temporalCompatibility,
        signals: [...new Set(signals)],
        materiallyChangesHighlightPotential: activationTypes.length > 0 && intensityContribution >= 0.26,
        materiallyChangesInterpretation: activationTypes.length > 0 &&
            (highlightSuitabilityImpact >= 0.04 ||
                momentIntensityImpact >= 0.04 ||
                familyRefinements.length > 0),
    };
}
function deriveHyperlocalTemporalCompatibility(venue, keywords, activationTypes, temporalRelevance, temporalLabel, intensityContribution, context) {
    const contextWindow = parseTemporalWindow(context?.timeWindow);
    const dayCueScore = clamp01(keywordScore(keywords, DAY_WINDOW_TERMS) * 0.56 +
        keywordScore(keywords, SEASONAL_MARKET_ACTIVATION_TERMS) * 0.22 +
        (activationTypes.includes('seasonal_market') ? 0.26 : 0) +
        (venue.category === 'cafe' ? 0.08 : 0));
    const eveningCueScore = clamp01(keywordScore(keywords, EVENING_WINDOW_TERMS) * 0.44 +
        keywordScore(keywords, TEMPORAL_ENERGY_TERMS) * 0.18 +
        (activationTypes.includes('live_performance') ? 0.22 : 0) +
        (activationTypes.includes('tasting_activation') ? 0.16 : 0) +
        (activationTypes.includes('cultural_activation') ? 0.12 : 0) +
        (activationTypes.includes('ambient_activation') ? 0.1 : 0));
    const lateCueScore = clamp01(keywordScore(keywords, LATE_WINDOW_TERMS) * 0.52 +
        keywordScore(keywords, HIGH_ENERGY_TERMS) * 0.12 +
        (activationTypes.includes('live_performance') ? 0.12 : 0) +
        (activationTypes.includes('social_ritual') ? 0.08 : 0) +
        (venue.category === 'bar' || venue.category === 'live_music' ? 0.08 : 0));
    let activationWindow;
    if (lateCueScore >= 0.3 && lateCueScore > eveningCueScore + 0.04) {
        activationWindow = 'late';
    }
    else if (dayCueScore >= 0.32 && dayCueScore > eveningCueScore + 0.05) {
        activationWindow = 'day';
    }
    else if (eveningCueScore >= 0.24) {
        activationWindow = 'evening';
    }
    else if (activationTypes.includes('ambient_activation')) {
        activationWindow = 'flexible';
    }
    else if (activationTypes.includes('seasonal_market')) {
        activationWindow = 'day';
    }
    else if (activationTypes.includes('live_performance') ||
        activationTypes.includes('tasting_activation') ||
        activationTypes.includes('cultural_activation') ||
        activationTypes.includes('social_ritual')) {
        activationWindow = temporalRelevance >= 0.34 ? 'evening' : undefined;
    }
    const timePresenceState = contextWindow
        ? 'explicit'
        : activationTypes.length > 0 &&
            (Boolean(activationWindow) ||
                temporalLabel !== 'background' ||
                temporalRelevance >= 0.28)
            ? 'implicit'
            : 'none';
    const roleAdjustments = createZeroRoleAdjustments();
    const signals = [];
    const activationScale = clamp01(intensityContribution * 0.54 +
        temporalRelevance * 0.28 +
        (temporalLabel === 'active' ? 0.18 : temporalLabel === 'timely' ? 0.1 : 0));
    for (const activationType of activationTypes) {
        if (activationType === 'live_performance') {
            roleAdjustments.highlight += 0.055 * activationScale;
            roleAdjustments.surprise += 0.035 * activationScale;
            roleAdjustments.windDown += 0.015 * activationScale;
            signals.push('performance favors highlight');
            continue;
        }
        if (activationType === 'tasting_activation') {
            roleAdjustments.highlight += 0.048 * activationScale;
            roleAdjustments.surprise += 0.022 * activationScale;
            roleAdjustments.windDown += 0.018 * activationScale;
            signals.push('tasting favors highlight');
            continue;
        }
        if (activationType === 'cultural_activation') {
            roleAdjustments.highlight += 0.042 * activationScale;
            roleAdjustments.surprise += 0.028 * activationScale;
            roleAdjustments.start += 0.012 * activationScale;
            signals.push('cultural activation favors highlight');
            continue;
        }
        if (activationType === 'social_ritual') {
            roleAdjustments.surprise += 0.03 * activationScale;
            roleAdjustments.highlight += 0.02 * activationScale;
            signals.push('social ritual favors surprise');
            continue;
        }
        if (activationType === 'ambient_activation') {
            roleAdjustments.highlight += 0.03 * activationScale;
            roleAdjustments.windDown += 0.032 * activationScale;
            roleAdjustments.surprise += 0.01 * activationScale;
            signals.push('ambient activation favors wind down');
            continue;
        }
        if (activationType === 'seasonal_market') {
            roleAdjustments.start += 0.04 * activationScale;
            roleAdjustments.surprise += 0.028 * activationScale;
            roleAdjustments.highlight += 0.018 * activationScale;
            signals.push('seasonal market favors start');
        }
    }
    if (contextWindow && activationWindow && activationWindow !== 'flexible') {
        if (contextWindow === activationWindow) {
            roleAdjustments.highlight += 0.018;
            roleAdjustments.surprise += 0.008;
            signals.push(`${contextWindow} context aligns`);
        }
        else if (contextWindow === 'day' && activationWindow === 'evening') {
            roleAdjustments.highlight -= 0.024;
            roleAdjustments.windDown -= 0.01;
            signals.push('day context softens evening fit');
        }
        else if (contextWindow === 'day' && activationWindow === 'late') {
            roleAdjustments.highlight -= 0.03;
            roleAdjustments.windDown -= 0.016;
            signals.push('day context softens late fit');
        }
        else if (contextWindow === 'evening' && activationWindow === 'day') {
            roleAdjustments.start -= 0.01;
            roleAdjustments.highlight -= 0.018;
            signals.push('evening context softens day fit');
        }
        else if (contextWindow === 'late' && activationWindow === 'day') {
            roleAdjustments.highlight -= 0.026;
            roleAdjustments.start -= 0.014;
            signals.push('late context softens day fit');
        }
        else if (contextWindow === 'late' && activationWindow === 'evening') {
            roleAdjustments.highlight -= 0.008;
            roleAdjustments.windDown += 0.006;
            signals.push('late context leans wind down');
        }
    }
    else if (activationWindow === 'flexible') {
        roleAdjustments.highlight += 0.008;
        roleAdjustments.windDown += 0.008;
        signals.push('flexible activation window');
    }
    else if (activationWindow) {
        signals.push(`implicit ${activationWindow} fit`);
    }
    const materiallyChangesViability = activationTypes.length > 0 &&
        Object.values(roleAdjustments).some((value) => Math.abs(value) >= 0.02);
    return {
        timePresenceState,
        contextWindow,
        activationWindow,
        roleAdjustments,
        materiallyChangesViability,
        signals: [...new Set(signals)],
    };
}
function deriveMomentEnrichment(venue, profile, experienceStrengths, experienceArchetypes, hyperlocalActivation) {
    const keywords = buildKeywordCorpus(venue);
    const archetypes = new Set(experienceArchetypes.archetypes);
    const temporalKeyword = clamp01(keywordScore(keywords, TEMPORAL_ENERGY_TERMS) * 0.72 +
        keywordScore(keywords, RECURRING_EVENT_TERMS) * 0.28);
    const socialKeyword = clamp01(keywordScore(keywords, SOCIAL_ENERGY_TERMS) * 0.7 +
        keywordScore(keywords, GROUP_SIGNAL_TERMS) * 0.3);
    const ambientKeyword = keywordScore(keywords, AMBIENT_UNIQUENESS_TERMS);
    const culturalKeyword = keywordScore(keywords, CULTURAL_DEPTH_TERMS);
    const hyperlocalTemporalLift = hyperlocalActivation.temporalRelevance * 0.12;
    const hyperlocalAmbientLift = hyperlocalActivation.activationTypes.includes('ambient_activation') ||
        hyperlocalActivation.activationTypes.includes('live_performance')
        ? hyperlocalActivation.intensityContribution * 0.12
        : 0;
    const hyperlocalCulturalLift = hyperlocalActivation.activationTypes.includes('cultural_activation') ||
        hyperlocalActivation.activationTypes.includes('live_performance') ||
        hyperlocalActivation.activationTypes.includes('seasonal_market')
        ? hyperlocalActivation.intensityContribution * 0.12
        : 0;
    const temporalEnergy = clamp01(temporalKeyword * 0.46 +
        (venue.category === 'live_music' || venue.category === 'event' ? 0.24 : 0) +
        (venue.musicCapable || venue.performanceCapable ? 0.12 : 0) +
        (venue.liveSource ? 0.06 : 0) +
        profile.energy * 0.08 +
        hyperlocalTemporalLift +
        (venue.hoursStatus === 'open' || venue.hoursStatus === 'likely_open' ? 0.04 : 0));
    const socialEnergy = clamp01(socialKeyword * 0.42 +
        profile.socialDensity * 0.18 +
        normalizeCount(venue.reviewCount, 240) * 0.14 +
        (venue.category === 'bar' || venue.category === 'activity' ? 0.08 : 0) +
        (venue.category === 'live_music' || venue.category === 'event' ? 0.12 : 0) +
        (venue.eventCapable ? 0.08 : 0));
    const ambientUniqueness = clamp01(ambientKeyword * 0.42 +
        profile.intimacy * 0.08 +
        venue.signatureStrength * 0.14 +
        venue.qualityScore * 0.08 +
        hyperlocalAmbientLift +
        (venue.setting === 'indoor' || venue.setting === 'hybrid' ? 0.08 : 0) +
        (venue.editorialSummary ? 0.06 : 0) +
        ((venue.userReviewSnippets?.length ?? 0) > 0 ? 0.04 : 0));
    const culturalDepth = clamp01(culturalKeyword * 0.42 +
        (archetypes.has('culture') ? 0.18 : 0) +
        (venue.category === 'museum' || venue.category === 'live_music' || venue.category === 'event'
            ? 0.12
            : 0) +
        (venue.musicCapable || venue.performanceCapable ? 0.08 : 0) +
        (venue.eventCapable ? 0.06 : 0) +
        venue.qualityScore * 0.08 +
        hyperlocalCulturalLift +
        profile.experientialFactor * 0.06);
    const highlightSurfaceBoost = clamp01(temporalEnergy * 0.18 +
        socialEnergy * 0.08 +
        ambientUniqueness * 0.18 +
        culturalDepth * 0.2 +
        hyperlocalActivation.intensityContribution * 0.14 +
        profile.experientialFactor * 0.1 +
        venue.signatureStrength * 0.1 +
        venue.qualityScore * 0.08 -
        experienceStrengths.passiveHospitality * 0.08);
    const signals = [];
    if (temporalEnergy >= 0.42) {
        signals.push('temporal energy');
    }
    if (socialEnergy >= 0.42) {
        signals.push('social energy');
    }
    if (ambientUniqueness >= 0.42) {
        signals.push('ambient uniqueness');
    }
    if (culturalDepth >= 0.42) {
        signals.push('cultural depth');
    }
    if (hyperlocalActivation.materiallyChangesHighlightPotential) {
        signals.push('hyperlocal activation');
    }
    return {
        temporalEnergy,
        socialEnergy,
        ambientUniqueness,
        culturalDepth,
        highlightSurfaceBoost,
        signals,
    };
}
function deriveRomanticFlavor(romanticSignals, romanticScore) {
    const rankedSignals = [
        { key: 'intimate', value: romanticSignals.intimacy },
        { key: 'scenic', value: romanticSignals.scenic },
        { key: 'playful', value: romanticSignals.sharedActivity },
        {
            key: 'ambient',
            value: Math.max(romanticSignals.ambiance, romanticSignals.ambientExperience),
        },
    ].sort((left, right) => right.value - left.value);
    const strongest = rankedSignals[0];
    const runnerUp = rankedSignals[1];
    if (!strongest || romanticScore < 0.28 || strongest.value < 0.34) {
        return 'none';
    }
    if (runnerUp && strongest.value - runnerUp.value <= 0.06 && runnerUp.value >= 0.5) {
        return 'mixed';
    }
    return strongest.key;
}
function deriveRomanticMomentCandidate(venue, romanticSignals, romanticScore, momentIdentity, experienceArchetypes, momentEnrichment) {
    const primaryArchetype = experienceArchetypes.primary;
    const hospitalityPrimary = primaryArchetype === 'dining' ||
        primaryArchetype === 'drinks' ||
        primaryArchetype === 'sweet';
    const atmosphericDiningSignal = hospitalityPrimary &&
        romanticSignals.intimacy >= 0.6 &&
        Math.max(romanticSignals.ambiance, romanticSignals.ambientExperience) >= 0.56 &&
        (momentEnrichment.ambientUniqueness >= 0.52 ||
            momentEnrichment.culturalDepth >= 0.46);
    const viewBackedDiningSignal = hospitalityPrimary &&
        romanticSignals.scenic >= 0.48 &&
        romanticSignals.intimacy >= 0.56 &&
        romanticSignals.ambientExperience >= 0.52;
    const strongRomanticDimension = romanticSignals.sharedActivity >= 0.48 ||
        romanticSignals.scenic >= 0.48 ||
        romanticSignals.ambientExperience >= 0.46 ||
        romanticSignals.intimacy >= 0.68 ||
        romanticSignals.ambiance >= 0.62 ||
        atmosphericDiningSignal ||
        viewBackedDiningSignal;
    const cozyScenicSupport = romanticSignals.sharedActivity >= 0.56 ||
        romanticSignals.scenic >= 0.56 ||
        romanticSignals.ambientExperience >= 0.52;
    const destinationCenterpieceSignal = momentIdentity.type === 'anchor' ||
        momentIdentity.strength === 'strong' ||
        venue.signatureStrength >= 0.7 ||
        momentEnrichment.culturalDepth >= 0.56;
    const lingerCenterpieceSignal = momentIdentity.type === 'linger' ||
        momentIdentity.type === 'close' ||
        (romanticSignals.intimacy >= 0.62 && romanticSignals.ambientExperience >= 0.52);
    const hiddenGemCenterpieceSignal = venue.signatureStrength >= 0.68 && venue.qualityScore >= 0.68;
    const diningCenterpieceSignal = hospitalityPrimary &&
        (destinationCenterpieceSignal ||
            lingerCenterpieceSignal ||
            hiddenGemCenterpieceSignal);
    const genericHospitalityOnlyFallback = hospitalityPrimary &&
        romanticSignals.sharedActivity < 0.56 &&
        romanticSignals.scenic < 0.56 &&
        romanticSignals.ambientExperience < 0.52 &&
        romanticSignals.ambiance < 0.62 &&
        romanticSignals.intimacy < 0.72 &&
        momentEnrichment.ambientUniqueness < 0.52 &&
        momentEnrichment.culturalDepth < 0.48 &&
        venue.signatureStrength < 0.66;
    const hospitalityDateWorthy = !hospitalityPrimary ||
        atmosphericDiningSignal ||
        viewBackedDiningSignal ||
        romanticSignals.intimacy >= 0.66 ||
        romanticSignals.ambiance >= 0.64 ||
        momentEnrichment.ambientUniqueness >= 0.54;
    const standardPath = romanticScore >= STANDARD_ROMANTIC_THRESHOLD &&
        strongRomanticDimension &&
        hospitalityDateWorthy &&
        (!hospitalityPrimary || diningCenterpieceSignal) &&
        !genericHospitalityOnlyFallback;
    const scenicSharedCozyPath = romanticScore >= COZY_SCENIC_ROMANTIC_THRESHOLD &&
        cozyScenicSupport &&
        momentIdentity.strength !== 'light' &&
        !genericHospitalityOnlyFallback;
    const enrichedAmbientPath = romanticScore >= COZY_SCENIC_ROMANTIC_THRESHOLD &&
        momentIdentity.strength !== 'light' &&
        !genericHospitalityOnlyFallback &&
        venue.signatureStrength >= 0.68 &&
        Math.max(romanticSignals.ambiance, romanticSignals.ambientExperience) >= 0.46 &&
        (momentEnrichment.ambientUniqueness >= 0.5 || momentEnrichment.culturalDepth >= 0.5);
    return standardPath || scenicSharedCozyPath || enrichedAmbientPath;
}
function deriveDebugConfidence(venue, sourceMode) {
    const modeBase = sourceMode === 'seed_calibrated'
        ? 0.82
        : sourceMode === 'hybrid'
            ? 0.76
            : 0.58;
    const reviewSignal = normalizeCount(venue.reviewCount, 200);
    const metadataRichness = (venue.editorialSummary ? 0.08 : 0) +
        ((venue.userReviewSnippets?.length ?? 0) > 0 ? 0.06 : 0) +
        (venue.subcategory ? 0.03 : 0) +
        (venue.neighborhood ? 0.03 : 0);
    return clamp01(modeBase * 0.5 +
        venue.sourceConfidence * 0.18 +
        venue.qualityScore * 0.16 +
        (venue.hoursConfidence ?? 0.5) * 0.08 +
        reviewSignal * 0.05 +
        metadataRichness);
}
function resolveSourceMode(seed, inferred) {
    if (seed && hasMeaningfulDelta(seed, inferred)) {
        return 'hybrid';
    }
    if (seed) {
        return 'seed_calibrated';
    }
    return 'rule_inferred';
}
function hasMeaningfulDelta(seed, inferred) {
    return (Math.abs(seed.energy - inferred.energy) >= 0.05 ||
        Math.abs(seed.socialDensity - inferred.socialDensity) >= 0.05 ||
        Math.abs(seed.intimacy - inferred.intimacy) >= 0.05 ||
        Math.abs(seed.lingerFactor - inferred.lingerFactor) >= 0.05 ||
        Math.abs(seed.destinationFactor - inferred.destinationFactor) >= 0.05 ||
        Math.abs(seed.experientialFactor - inferred.experientialFactor) >= 0.05 ||
        Math.abs(seed.conversationFriendliness - inferred.conversationFriendliness) >= 0.05);
}
function isGenericSubcategory(subcategory, category) {
    const normalized = subcategory.trim().toLowerCase();
    return (normalized.length <= 3 ||
        normalized === category ||
        normalized === category.replace('_', ' ') ||
        normalized === 'food' ||
        normalized === 'drink' ||
        normalized === 'place');
}
function buildKeywordCorpus(venue) {
    const textBlocks = [
        venue.name,
        venue.subcategory,
        venue.editorialSummary,
        venue.tags.join(' '),
        venue.placeTypes?.join(' '),
        venue.userReviewSnippets?.join(' '),
    ];
    return textBlocks
        .filter((value) => Boolean(value))
        .join(' ')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean);
}
function hasAnyFragment(values, fragments) {
    if (!values || values.length === 0) {
        return false;
    }
    return fragments.some((fragment) => values.some((value) => value.toLowerCase().includes(fragment)));
}
function keywordScore(keywords, terms) {
    const corpus = ` ${keywords.join(' ')} `;
    let hits = 0;
    for (const term of terms) {
        if (corpus.includes(` ${term.toLowerCase()} `)) {
            hits += 1;
        }
    }
    return Math.min(1, hits / 3);
}
function normalizeCount(value, ceiling) {
    if (!value || value <= 0) {
        return 0;
    }
    return clamp01(value / ceiling);
}
function clampProfile(profile) {
    return {
        energy: clamp01(profile.energy),
        socialDensity: clamp01(profile.socialDensity),
        intimacy: clamp01(profile.intimacy),
        lingerFactor: clamp01(profile.lingerFactor),
        destinationFactor: clamp01(profile.destinationFactor),
        experientialFactor: clamp01(profile.experientialFactor),
        conversationFriendliness: clamp01(profile.conversationFriendliness),
    };
}
function finalizeSupportingSignals(supportingSignals, sourceMode, momentIntensity, experienceFamily, momentEnrichment, hyperlocalActivation, elevatedMomentCandidate) {
    const finalized = [...supportingSignals];
    if (sourceMode === 'seed_calibrated') {
        finalized.splice(1, 0, 'source:seed-profile');
    }
    if (sourceMode === 'hybrid') {
        finalized.splice(1, 0, 'source:hybrid-merge');
    }
    if (momentIntensity) {
        finalized.push(`signal:moment-${momentIntensity.tier}`);
    }
    if (experienceFamily) {
        finalized.push(`signal:family-${experienceFamily}`);
    }
    if (momentEnrichment) {
        for (const signal of momentEnrichment.signals) {
            finalized.push(`signal:${signal.replace(/\s+/g, '-')}`);
        }
    }
    if (hyperlocalActivation?.primaryActivationType) {
        finalized.push(`signal:activation-${hyperlocalActivation.primaryActivationType.replace(/_/g, '-')}`);
    }
    if (elevatedMomentCandidate) {
        finalized.push('signal:activation-moment-elevated');
    }
    return [...new Set(finalized)].slice(0, 8);
}
function pushSupportingSignal(supportingSignals, signal) {
    if (!supportingSignals.includes(signal)) {
        supportingSignals.push(signal);
    }
}
function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
