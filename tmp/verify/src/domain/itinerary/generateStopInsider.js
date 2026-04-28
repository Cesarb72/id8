function hasCategory(mix, category, threshold = 0.18) {
    return mix[category] >= threshold;
}
function buildRoleReason(context) {
    if (context.role === 'start') {
        if (context.route.compactness >= 0.62 && context.energyLevel <= 3) {
            return 'Easy opening move that sets the tone without overcommitting.';
        }
        if (context.momentPotential >= 0.64 || context.roleScore >= 0.68) {
            return 'Good place to start before the night builds.';
        }
        return 'Strong opener that sets direction without rushing the night.';
    }
    if (context.role === 'highlight') {
        if (context.momentPotential >= 0.72 || context.momentIntensity >= 0.68) {
            return 'The route builds toward this as the central moment.';
        }
        if (context.roleScore >= 0.66) {
            return 'This is the strongest stop in the sequence.';
        }
        return 'Placed here as the central beat of the route.';
    }
    if (context.role === 'windDown') {
        if (context.energyLevel <= 2 || context.socialDensity <= 0.44) {
            return 'A softer finish that keeps the route from ending flat.';
        }
        if (context.route.compactness < 0.52) {
            return 'Lets the night land without cutting energy too abruptly.';
        }
        return 'Late sequence move that eases the night into a clean finish.';
    }
    if (context.momentPotential >= 0.66) {
        return 'Wildcard move that adds a distinct shift in the sequence.';
    }
    return 'Added as a wildcard so the route does not feel linear.';
}
function buildLocalSignal(context) {
    const nightlifeMix = context.route.nearbyCategoryMix.bar +
        context.route.nearbyCategoryMix.live_music +
        context.route.nearbyCategoryMix.event;
    if (context.socialDensity >= 0.66 &&
        (context.route.localContinuity === 'same-neighborhood' ||
            context.route.localContinuity === 'adjacent-neighborhoods')) {
        return 'Steady foot traffic from nearby spots keeps this area active.';
    }
    if (context.socialDensity <= 0.48 &&
        context.route.localContinuity === 'spread') {
        return 'Quieter pull than the main strip, but people linger longer here.';
    }
    if (context.route.compactness >= 0.64 &&
        context.route.localContinuity === 'same-neighborhood') {
        return 'Near enough to the core to stay lively without feeling crowded.';
    }
    if (nightlifeMix >= 0.32 || context.route.nearbyActivation >= 0.58) {
        return 'Surrounding spots keep the area active through the evening.';
    }
    if (hasCategory(context.route.nearbyCategoryMix, 'restaurant') &&
        hasCategory(context.route.nearbyCategoryMix, 'cafe')) {
        return 'Local food-and-cafe mix keeps this pocket steadily active.';
    }
    return 'Works well because this pocket stays active without long moves.';
}
function buildSelectionReason(context) {
    const scoreGap = typeof context.selectedScore === 'number' && typeof context.runnerUpScore === 'number'
        ? context.selectedScore - context.runnerUpScore
        : undefined;
    if (context.role === 'start' && context.route.localTravelMinutes <= 10) {
        return 'Chosen for a cleaner opening rhythm than nearby alternatives.';
    }
    if (context.role === 'highlight' &&
        (context.momentPotential >= 0.68 || context.momentIntensity >= 0.66)) {
        return 'Chosen over nearby options for a stronger central moment.';
    }
    if (context.role === 'windDown' && context.energyLevel <= 2) {
        return 'Better pacing match for a softer finish than nearby spots.';
    }
    if (context.role === 'surprise' && context.route.compactness >= 0.58) {
        return 'Adds contrast without forcing extra movement in the route.';
    }
    if (typeof scoreGap === 'number' && scoreGap >= 0.12) {
        return 'Chosen over nearby options for stronger route fit.';
    }
    if (context.route.compactness >= 0.66 || context.route.localTravelMinutes <= 10) {
        return 'Keeps the sequence tighter than similar alternatives.';
    }
    if (context.role === 'highlight' &&
        context.energyLevel >= 4 &&
        context.momentPotential >= 0.64) {
        return 'Better match for this pacing than louder nearby spots.';
    }
    if (context.contextSpecificity >= 0.66 || context.momentIntensity >= 0.66) {
        return 'Stronger ambiance and location fit than comparable options.';
    }
    if ((context.selectionConfidence ?? 0) >= 86 || context.roleScore >= 0.68) {
        return 'Selected because it holds this role more cleanly than alternatives.';
    }
    if (typeof scoreGap === 'number' && scoreGap > 0) {
        return 'Narrow win over nearby options, but cleaner fit in sequence.';
    }
    return 'Chosen because it keeps this route balanced and intentional.';
}
export function generateStopInsider(context) {
    return {
        roleReason: buildRoleReason(context),
        localSignal: buildLocalSignal(context),
        selectionReason: buildSelectionReason(context),
    };
}
