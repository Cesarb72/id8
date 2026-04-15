function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
function deriveTasteHoursStatus(venue) {
    if (venue.source.businessStatus === 'closed-permanently' ||
        venue.source.businessStatus === 'temporarily-closed') {
        return 'closed';
    }
    if (venue.source.hoursPressureLevel === 'strong-open') {
        return 'open';
    }
    if (venue.source.hoursPressureLevel === 'likely-open') {
        return 'likely_open';
    }
    if (venue.source.hoursPressureLevel === 'likely-closed') {
        return 'likely_closed';
    }
    if (venue.source.hoursPressureLevel === 'closed') {
        return 'closed';
    }
    return venue.source.hoursKnown ? 'uncertain' : 'unknown';
}
function deriveSeedCalibratedTasteProfile(venue) {
    if (venue.source.normalizedFromRawType !== 'seed') {
        return undefined;
    }
    const energy = clamp01(venue.energyLevel / 5);
    const socialDensity = clamp01(venue.socialDensity / 5);
    const lingerFactorByDuration = {
        XS: 0.28,
        S: 0.42,
        M: 0.58,
        L: 0.74,
        XL: 0.88,
    }[venue.durationProfile.durationClass];
    const intimacy = clamp01(0.56 +
        (venue.settings.dateFriendly ? 0.12 : 0) +
        (venue.category === 'cafe' || venue.category === 'dessert' || venue.category === 'park'
            ? 0.08
            : 0) -
        socialDensity * 0.3 -
        energy * 0.18);
    const destinationFactor = clamp01(venue.signature.signatureScore * 0.62 +
        venue.distinctivenessScore * 0.18 +
        (venue.highlightCapable ? 0.08 : 0));
    const experientialFactor = clamp01(venue.distinctivenessScore * 0.34 +
        venue.uniquenessScore * 0.22 +
        venue.shareabilityScore * 0.14 +
        (venue.settings.eventCapable ||
            venue.settings.musicCapable ||
            venue.settings.performanceCapable
            ? 0.1
            : 0) +
        (venue.highlightCapable ? 0.08 : 0));
    const conversationFriendliness = clamp01(0.62 +
        (venue.settings.dateFriendly ? 0.1 : 0) +
        (venue.category === 'cafe' || venue.category === 'dessert' || venue.category === 'park'
            ? 0.08
            : 0) -
        energy * 0.22 -
        socialDensity * 0.12 -
        (venue.settings.musicCapable ? 0.06 : 0));
    return {
        energy,
        socialDensity,
        intimacy,
        lingerFactor: lingerFactorByDuration,
        destinationFactor,
        experientialFactor,
        conversationFriendliness,
    };
}
export function mapVenueToTasteInput(venue) {
    const descriptiveSummary = [venue.shortDescription, venue.narrativeFlavor]
        .filter(Boolean)
        .join(' ')
        .trim();
    return {
        id: venue.id,
        name: venue.name,
        category: venue.category,
        subcategory: venue.subcategory,
        tags: [...new Set([...venue.tags, ...venue.vibeTags])],
        placeTypes: venue.source.sourceTypes.length > 0 ? venue.source.sourceTypes : undefined,
        setting: venue.settings.setting,
        eventCapable: venue.settings.eventCapable,
        musicCapable: venue.settings.musicCapable,
        performanceCapable: venue.settings.performanceCapable,
        highlightCapable: venue.highlightCapable,
        priceLevel: venue.priceTier,
        neighborhood: venue.neighborhood,
        liveSource: venue.source.sourceOrigin === 'live',
        sourceConfidence: venue.source.sourceConfidence,
        qualityScore: venue.source.qualityScore,
        signatureStrength: venue.signature.signatureScore,
        hoursStatus: deriveTasteHoursStatus(venue),
        hoursConfidence: venue.source.timeConfidence,
        editorialSummary: descriptiveSummary || undefined,
        seedCalibratedProfile: deriveSeedCalibratedTasteProfile(venue),
    };
}
