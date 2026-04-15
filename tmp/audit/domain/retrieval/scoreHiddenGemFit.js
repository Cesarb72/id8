function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
export function scoreHiddenGemFit(venue, fitScore, intent) {
    const weighted = fitScore * 0.4 +
        venue.distinctivenessScore * 0.25 +
        venue.underexposureScore * 0.2 +
        venue.shareabilityScore * 0.15;
    const chainPenalty = venue.isChain ? 0.08 : 0;
    const localSignalAverage = (venue.localSignals.localFavoriteScore + venue.localSignals.neighborhoodPrideScore) / 2;
    const localBonus = localSignalAverage * 0.06;
    const hiddenGemLift = venue.isHiddenGem ? 0.05 : 0;
    const intentLift = intent.prefersHiddenGems ? 0.04 : 0;
    return clamp01(weighted - chainPenalty + localBonus + hiddenGemLift + intentLift);
}
