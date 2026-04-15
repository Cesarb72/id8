function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
function normalizeTag(value) {
    return value.trim().toLowerCase();
}
function hasAnyTag(tags, candidates) {
    const normalized = new Set(tags.map(normalizeTag));
    return candidates.some((candidate) => normalized.has(normalizeTag(candidate)));
}
export function computeRouteShapeBias(stops, intent, lens) {
    if (stops.length === 0) {
        return {
            score: 0,
            appliedLabel: 'No route-shape bias applied.',
            notes: [],
        };
    }
    const highlight = stops.find((stop) => stop.role === 'peak') ?? stops[0];
    const drives = stops.map((stop) => stop.scoredVenue.venue.driveMinutes);
    const spread = Math.max(...drives) - Math.min(...drives);
    const clusterAroundHighlight = stops.reduce((sum, stop) => sum + Math.abs(stop.scoredVenue.venue.driveMinutes - highlight.scoredVenue.venue.driveMinutes), 0) / stops.length;
    const tags = stops.flatMap((stop) => stop.scoredVenue.venue.tags);
    const notes = [];
    let score = 0.5;
    let appliedLabel = 'Neutral route shape.';
    if (intent.primaryAnchor === 'adventurous-outdoor') {
        const scenicAnchor = highlight.scoredVenue.vibeAuthority.adventureRead === 'outdoor' ||
            highlight.scoredVenue.venue.category === 'park';
        if (scenicAnchor && spread <= 18) {
            score += 0.18;
            notes.push('outdoor route tolerates a little movement for a scenic anchor');
        }
        if (clusterAroundHighlight <= 8) {
            score += 0.08;
            notes.push('support stops stay reasonably close to the outdoor anchor');
        }
        if (hasAnyTag(tags, ['district', 'street-food', 'night-market']) && !scenicAnchor) {
            score -= 0.16;
            notes.push('route reads more urban than outdoor');
        }
        appliedLabel = scenicAnchor
            ? 'Outdoor route tolerated movement for an open-air anchor.'
            : 'Outdoor route stayed low-friction around weaker scenic signals.';
    }
    else if (intent.primaryAnchor === 'adventurous-urban') {
        const urbanAnchor = highlight.scoredVenue.vibeAuthority.adventureRead === 'urban';
        if (urbanAnchor && spread <= 12 && clusterAroundHighlight <= 6) {
            score += 0.2;
            notes.push('urban route clusters around district-scale wandering');
        }
        if (hasAnyTag(tags, ['local', 'community', 'underexposed', 'market', 'food-hall'])) {
            score += 0.08;
            notes.push('route keeps local urban texture');
        }
        if (hasAnyTag(tags, ['trail', 'viewpoint', 'nature', 'garden', 'stargazing'])) {
            score -= 0.18;
            notes.push('route drifts toward scenic outdoor logic');
        }
        appliedLabel = urbanAnchor
            ? 'Urban route stayed clustered around local discovery.'
            : 'Urban route lacked enough district-scale density.';
    }
    else if (intent.primaryAnchor === 'cozy') {
        score += spread <= 8 ? 0.18 : -0.14;
        if (lens.movementTolerance === 'low') {
            notes.push('cozy route prefers low-friction movement');
        }
        appliedLabel = spread <= 8 ? 'Cozy route stayed intimate and low-friction.' : 'Cozy route stretched a bit too far.';
    }
    else if (intent.primaryAnchor === 'chill') {
        score += spread <= 9 ? 0.16 : -0.12;
        appliedLabel = spread <= 9 ? 'Chill route kept movement simple.' : 'Chill route carried more movement than ideal.';
    }
    else if (intent.primaryAnchor === 'lively') {
        score += spread >= 4 && spread <= 14 ? 0.14 : 0;
        appliedLabel = spread >= 4 && spread <= 14
            ? 'Lively route allowed momentum-building movement.'
            : 'Lively route stayed flatter than ideal.';
    }
    else if (intent.primaryAnchor === 'playful') {
        score += spread >= 3 && spread <= 12 ? 0.12 : 0;
        appliedLabel = 'Playful route kept enough movement for variety.';
    }
    else if (intent.primaryAnchor === 'cultured') {
        score += spread <= 14 ? 0.12 : -0.08;
        appliedLabel = spread <= 14
            ? 'Cultured route kept movement measured around the centerpiece.'
            : 'Cultured route stretched beyond a thoughtful pace.';
    }
    return {
        score: clamp01(score),
        appliedLabel,
        notes,
    };
}
