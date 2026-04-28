function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
function normalizeTag(tag) {
    return tag.trim().toLowerCase();
}
function mapEnergyLevelToBand(level) {
    if (level <= 2) {
        return 'low';
    }
    if (level <= 3) {
        return 'medium';
    }
    return 'high';
}
function hasTagOverlap(venueTags, targetTags) {
    if (targetTags.length === 0) {
        return 0;
    }
    const normalizedVenueTags = venueTags.map(normalizeTag);
    const matches = targetTags.filter((tag) => normalizedVenueTags.includes(normalizeTag(tag)));
    return matches.length / targetTags.length;
}
export function scoreLensCompatibility(venue, intent, lens) {
    const categoryPreferred = lens.preferredCategories.includes(venue.category) ? 1 : 0.42;
    const categoryPenalty = lens.discouragedCategories.includes(venue.category) ? 0.24 : 0;
    const preferredTags = hasTagOverlap(venue.tags, lens.preferredTags);
    const discouragedTags = hasTagOverlap(venue.tags, lens.discouragedTags);
    const energyBand = mapEnergyLevelToBand(venue.energyLevel);
    const energyFit = lens.energyBand.includes(energyBand) ? 1 : 0.45;
    const movementPressure = lens.movementTolerance === 'low' ? Math.max(0, (venue.driveMinutes - 12) / 20) : 0;
    const discoveryPreference = lens.discoveryBias === 'high'
        ? venue.underexposureScore * 0.12 + venue.distinctivenessScore * 0.08
        : lens.discoveryBias === 'low'
            ? -venue.underexposureScore * 0.06
            : 0;
    const neighborhoodBias = intent.neighborhood && intent.neighborhood.toLowerCase() === venue.neighborhood.toLowerCase()
        ? 0.08
        : 0;
    return clamp01(categoryPreferred * 0.4 +
        preferredTags * 0.18 +
        energyFit * 0.22 +
        neighborhoodBias +
        discoveryPreference -
        discouragedTags * 0.14 -
        categoryPenalty -
        movementPressure);
}
export function scoreLensStopShapeCompatibility(venue, lens, role) {
    const shape = lens.preferredStopShapes[role];
    const categoryFit = shape.preferredCategories.includes(venue.category) ? 1 : 0.4;
    const categoryPenalty = shape.discouragedCategories.includes(venue.category) ? 0.28 : 0;
    const tagFit = hasTagOverlap(venue.tags, shape.preferredTags);
    const discouragedTagFit = hasTagOverlap(venue.tags, shape.discouragedTags);
    const energyBand = mapEnergyLevelToBand(venue.energyLevel);
    const energyFit = shape.energyPreference.includes(energyBand) ? 1 : 0.4;
    return clamp01(categoryFit * 0.46 + tagFit * 0.2 + energyFit * 0.34 - categoryPenalty - discouragedTagFit * 0.2);
}
