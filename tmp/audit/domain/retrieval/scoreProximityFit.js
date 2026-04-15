function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
export function scoreProximityFit(venue, intent) {
    const neighborhoodQuery = intent.neighborhood?.trim().toLowerCase();
    const sameNeighborhood = neighborhoodQuery
        ? venue.neighborhood.toLowerCase() === neighborhoodQuery
        : false;
    const nearbyCap = 14;
    const shortDriveCap = 30;
    const cap = intent.distanceMode === 'nearby' ? nearbyCap : shortDriveCap;
    const drivePenalty = clamp01(venue.driveMinutes / cap);
    const driveScore = clamp01(1 - drivePenalty);
    const neighborhoodBonus = sameNeighborhood ? 1 : 0;
    const neighborhoodPenalty = neighborhoodQuery && !sameNeighborhood ? 0.18 : 0;
    if (intent.distanceMode === 'nearby') {
        const strictDriveScore = clamp01(1 - venue.driveMinutes / nearbyCap);
        return clamp01(strictDriveScore * 0.62 + neighborhoodBonus * 0.38 - neighborhoodPenalty);
    }
    return clamp01(driveScore * 0.8 + neighborhoodBonus * 0.2 - neighborhoodPenalty * 0.5);
}
