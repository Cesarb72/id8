export function scoreUniquenessFit(venue, intent) {
    const baseline = venue.uniquenessScore * 0.6 + venue.distinctivenessScore * 0.4;
    const adventurousLift = intent.primaryAnchor === 'adventurous-urban' ||
        intent.secondaryAnchors?.includes('adventurous-urban')
        ? 0.06
        : 0;
    const chainPenalty = venue.isChain ? 0.08 : 0;
    return Math.max(0, Math.min(1, baseline + adventurousLift - chainPenalty));
}
