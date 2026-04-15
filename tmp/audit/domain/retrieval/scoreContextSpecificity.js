import { venueMatchesVibeTag } from '../taste/getVibeProfile';
function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
function tagOverlapScore(venueTags, preferredTags) {
    if (preferredTags.length === 0) {
        return 0;
    }
    const normalizedVenueTags = new Set(venueTags.map((tag) => tag.toLowerCase()));
    const matches = preferredTags.filter((tag) => normalizedVenueTags.has(tag.toLowerCase())).length;
    return matches / preferredTags.length;
}
export function scoreContextSpecificity({ venue, intent, crewPolicy, lens, fitBreakdown, stopShapeFit, }) {
    const personaSignal = clamp01(fitBreakdown.crewFit * 0.66 +
        (venue.useCases.includes(crewPolicy.crew) ? 0.24 : 0) +
        (crewPolicy.preferredCategories.includes(venue.category) ? 0.1 : 0));
    const vibeSignal = clamp01(fitBreakdown.anchorFit * 0.72 +
        (venueMatchesVibeTag(venue, intent.primaryAnchor) ? 0.2 : 0) +
        (intent.secondaryAnchors?.some((anchor) => venueMatchesVibeTag(venue, anchor)) ? 0.08 : 0));
    const lensSignal = clamp01((lens.preferredCategories.includes(venue.category) ? 0.52 : 0.18) +
        tagOverlapScore(venue.tags, lens.preferredTags) * 0.24 +
        (lens.discouragedCategories.includes(venue.category) ? -0.22 : 0) +
        (tagOverlapScore(venue.tags, lens.discouragedTags) > 0 ? -0.14 : 0));
    const start = clamp01(personaSignal * 0.26 +
        vibeSignal * 0.22 +
        lensSignal * 0.18 +
        stopShapeFit.start * 0.2 +
        venue.roleAffinity.warmup * 0.14);
    const peak = clamp01(personaSignal * 0.3 +
        vibeSignal * 0.3 +
        lensSignal * 0.16 +
        stopShapeFit.highlight * 0.16 +
        venue.roleAffinity.peak * 0.08);
    const wildcard = clamp01(personaSignal * 0.2 +
        vibeSignal * 0.26 +
        lensSignal * 0.16 +
        stopShapeFit.surprise * 0.16 +
        venue.roleAffinity.wildcard * 0.1 +
        venue.distinctivenessScore * 0.12);
    const cooldown = clamp01(personaSignal * 0.26 +
        vibeSignal * 0.18 +
        lensSignal * 0.2 +
        stopShapeFit.windDown * 0.24 +
        venue.roleAffinity.cooldown * 0.12);
    return {
        overall: clamp01((start + peak + wildcard + cooldown) / 4),
        personaSignal,
        vibeSignal,
        lensSignal,
        byRole: {
            warmup: start,
            peak,
            wildcard,
            cooldown,
        },
    };
}
