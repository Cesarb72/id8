const WALKABLE_TAGS = ['walkable', 'stroll', 'photo-walk', 'viewpoint', 'garden', 'scenic'];
const SOFT_TAGS = ['calm', 'quiet', 'cozy', 'soft-landing', 'conversation', 'wine', 'dessert'];
function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
function hasAnyTag(venue, tags) {
    return tags.some((tag) => venue.tags.includes(tag));
}
function formatCategory(category) {
    return category.replace('_', ' ');
}
function buildExtensionPresentation(venue) {
    if (venue.category === 'dessert') {
        return {
            label: 'Quick dessert',
            note: 'A small sweet finish that keeps the ending easy.',
        };
    }
    if (venue.category === 'bar' &&
        venue.energyLevel <= 4 &&
        (hasAnyTag(venue, ['wine', 'quiet', 'cozy', 'late-night']) || venue.socialDensity <= 3)) {
        return {
            label: 'Low-key nightcap',
            note: 'One easy drink nearby without reopening the whole night.',
        };
    }
    if (venue.category === 'park' ||
        (venue.category === 'activity' && hasAnyTag(venue, ['scenic', 'stroll', 'photo-walk', 'walkable']))) {
        return {
            label: 'Scenic walk',
            note: 'A soft outdoor beat if you want a little more room before heading out.',
        };
    }
    return {
        label: 'Linger nearby',
        note: 'A calm nearby stop that adds a little extra time without restarting the route.',
    };
}
export function deriveLightNearbyExtensions({ currentArc, scoredVenues, intent, lens, limit = 2, }) {
    const finalStop = currentArc.stops[currentArc.stops.length - 1];
    if (!finalStop) {
        return [];
    }
    const finalVenue = finalStop.scoredVenue.venue;
    const occupiedIds = new Set(currentArc.stops.map((stop) => stop.scoredVenue.venue.id));
    const walkableMode = intent.distanceMode === 'nearby';
    const candidates = scoredVenues
        .filter((item) => {
        const venue = item.venue;
        const sameNeighborhood = venue.neighborhood === finalVenue.neighborhood;
        const driveDelta = Math.abs(venue.driveMinutes - finalVenue.driveMinutes);
        const readsWalkable = sameNeighborhood || hasAnyTag(venue, WALKABLE_TAGS);
        const allowedCategory = venue.category === 'dessert' ||
            venue.category === 'cafe' ||
            venue.category === 'bar' ||
            venue.category === 'park' ||
            (venue.category === 'activity' && hasAnyTag(venue, ['scenic', 'stroll', 'photo-walk']));
        return (!occupiedIds.has(venue.id) &&
            allowedCategory &&
            venue.energyLevel <= 4 &&
            item.roleScores.cooldown >= 0.42 &&
            item.stopShapeFit.windDown >= 0.42 &&
            item.lensCompatibility >= (lens.discoveryBias === 'high' ? 0.34 : 0.38) &&
            readsWalkable &&
            (walkableMode ? driveDelta <= 6 : sameNeighborhood || driveDelta <= 4));
    })
        .map((item) => {
        const venue = item.venue;
        const sameNeighborhood = venue.neighborhood === finalVenue.neighborhood ? 1 : 0;
        const driveDelta = Math.abs(venue.driveMinutes - finalVenue.driveMinutes);
        const walkableSignal = hasAnyTag(venue, WALKABLE_TAGS) ? 1 : 0;
        const softSignal = hasAnyTag(venue, SOFT_TAGS) ? 1 : 0;
        const energySoftness = clamp01(1 - Math.abs(venue.energyLevel - 2) / 3);
        const driveCloseness = clamp01(1 - driveDelta / 8);
        const sameCategoryPenalty = venue.category === finalVenue.category &&
            (venue.category === 'dessert' || venue.category === 'cafe' || venue.category === 'bar')
            ? 0.04
            : 0;
        const presentation = buildExtensionPresentation(venue);
        return {
            scoredVenue: item,
            score: sameNeighborhood * 0.28 +
                driveCloseness * 0.2 +
                energySoftness * 0.16 +
                item.roleScores.cooldown * 0.16 +
                item.stopShapeFit.windDown * 0.08 +
                item.lensCompatibility * 0.06 +
                item.roleContract.cooldown.score * 0.06 +
                walkableSignal * 0.06 +
                softSignal * 0.04 -
                sameCategoryPenalty,
            option: {
                id: venue.id,
                label: presentation.label,
                venueName: venue.name,
                neighborhood: venue.neighborhood,
                category: venue.category,
                driveMinutes: venue.driveMinutes,
                note: presentation.note,
                reason: sameNeighborhood
                    ? `Keeps the ending around ${finalVenue.neighborhood}.`
                    : `Stays close enough to feel like an easy ${formatCategory(venue.category)} add-on.`,
            },
        };
    })
        .sort((left, right) => right.score - left.score);
    const selected = [];
    const usedLabels = new Set();
    for (const candidate of candidates) {
        if (selected.length >= limit) {
            break;
        }
        if (usedLabels.has(candidate.option.label)) {
            continue;
        }
        selected.push(candidate);
        usedLabels.add(candidate.option.label);
    }
    if (selected.length < limit) {
        for (const candidate of candidates) {
            if (selected.length >= limit) {
                break;
            }
            if (selected.some((item) => item.option.id === candidate.option.id)) {
                continue;
            }
            selected.push(candidate);
        }
    }
    return selected.map((candidate) => candidate.option);
}
