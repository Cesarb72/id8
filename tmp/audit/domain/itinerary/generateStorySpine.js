const calmCategories = new Set(['dessert', 'cafe', 'park', 'museum']);
const energeticCategories = new Set(['bar', 'live_music', 'event', 'activity']);
function getCompactness(route) {
    if (route.transitions.length === 0) {
        return 'compact';
    }
    const maxTransition = Math.max(...route.transitions.map((transition) => transition.estimatedTransitionMinutes));
    const spreadTransitions = route.transitions.filter((transition) => transition.neighborhoodContinuity === 'spread').length;
    if (maxTransition <= 12 && spreadTransitions === 0 && route.totalRouteFriction <= 4) {
        return 'compact';
    }
    if (maxTransition <= 18 && spreadTransitions <= 1 && route.totalRouteFriction <= 7) {
        return 'mixed';
    }
    return 'roaming';
}
function getEnergyBand(stop, vibe) {
    if (stop) {
        if (energeticCategories.has(stop.category)) {
            return 'energetic';
        }
        if (calmCategories.has(stop.category)) {
            return 'calm';
        }
    }
    if (vibe === 'lively' || vibe === 'playful') {
        return 'energetic';
    }
    if (vibe === 'cozy' || vibe === 'chill') {
        return 'calm';
    }
    return 'balanced';
}
function resolvePhaseStop(route, role) {
    const explicit = route.stops.find((stop) => stop.role === role);
    if (explicit) {
        return explicit;
    }
    if (route.stops.length < 3) {
        return undefined;
    }
    if (role === 'start') {
        return route.stops[0];
    }
    if (role === 'highlight') {
        return route.stops[Math.floor(route.stops.length / 2)];
    }
    return route.stops[route.stops.length - 1];
}
function getTitle(context, compactness) {
    if (context.crew === 'romantic' || context.persona === 'romantic') {
        return compactness === 'compact'
            ? 'A romantic arc with a gentle build'
            : 'A romantic arc with room to breathe';
    }
    if (context.crew === 'socialite' || context.persona === 'friends') {
        return 'A social arc with a clear peak';
    }
    if (context.crew === 'curator' || context.persona === 'family') {
        return 'An intentional arc from opener to close';
    }
    if (context.vibe === 'cozy' || context.vibe === 'chill') {
        return 'A gentle arc through the night';
    }
    if (context.vibe === 'lively' || context.vibe === 'playful') {
        return 'A social arc with a strong center';
    }
    return 'A clear arc from start to finish';
}
function getStartLabel(context, startEnergy) {
    if (startEnergy === 'calm' ||
        context.crew === 'romantic' ||
        context.vibe === 'cozy' ||
        context.vibe === 'chill') {
        return 'Ease In';
    }
    if (startEnergy === 'energetic' ||
        context.crew === 'socialite' ||
        context.vibe === 'lively' ||
        context.vibe === 'playful') {
        return 'Set the Tone';
    }
    return 'Open with Intention';
}
function getHighlightLabel(context, highlightEnergy) {
    if (highlightEnergy === 'energetic' ||
        context.crew === 'socialite' ||
        context.vibe === 'lively' ||
        context.vibe === 'playful') {
        return 'Main Event';
    }
    return 'The Moment';
}
function getWinddownLabel(context, finishEnergy) {
    if (finishEnergy === 'calm' ||
        context.crew === 'romantic' ||
        context.vibe === 'cozy' ||
        context.vibe === 'chill' ||
        context.vibe === 'cultured') {
        return 'Let It Land';
    }
    return 'Slow the Pace';
}
function buildStartSummary(compactness, startEnergy) {
    if (compactness === 'compact' && startEnergy === 'calm') {
        return 'Opens with a relaxed first stop so the night settles in naturally.';
    }
    if (compactness === 'compact') {
        return 'Opens close to your first stop so the night gets moving without extra travel.';
    }
    if (compactness === 'mixed') {
        return 'Opens with a short move to set the tone before the centerpiece.';
    }
    return 'Opens with a little movement to establish the night\'s direction.';
}
function buildHighlightSummary(context, highlightEnergy) {
    if (highlightEnergy === 'energetic') {
        return 'Builds toward a higher-energy centerpiece that carries the middle of the route.';
    }
    if (context.crew === 'curator' ||
        context.vibe === 'cultured' ||
        context.vibe === 'adventurous-outdoor' ||
        context.vibe === 'adventurous-urban') {
        return 'Builds toward an intentional centerpiece that anchors the night.';
    }
    return 'Builds toward a clear centerpiece that the rest of the sequence supports.';
}
function buildWinddownSummary(compactness, finishEnergy) {
    if (finishEnergy === 'calm' && compactness === 'compact') {
        return 'Lands on a calmer final stop nearby so the night can taper naturally.';
    }
    if (finishEnergy === 'calm') {
        return 'Lands on a calmer final stop so the pace can come down naturally.';
    }
    if (compactness === 'compact') {
        return 'Lands with one last social beat nearby without losing momentum.';
    }
    return 'Lands with one last social beat before closing out.';
}
function buildRouteSummary(input) {
    if (input.compactness === 'compact' && input.finishEnergy === 'calm') {
        return 'The route stays compact, builds to a clear centerpiece, and lands somewhere calmer.';
    }
    if (input.compactness === 'compact' && input.finishEnergy === 'energetic') {
        return 'The route stays compact, peaks in the middle, and keeps social momentum to the end.';
    }
    if (input.compactness === 'mixed' && input.finishEnergy === 'calm') {
        return 'This sequence opens smoothly, builds through the middle, and settles into a calmer close.';
    }
    if (input.startEnergy === 'energetic' && input.finishEnergy === 'calm') {
        return 'This sequence opens socially, peaks in the middle, and lands somewhere calmer.';
    }
    if (input.finishEnergy === 'energetic') {
        return 'This sequence opens with intent, peaks in the middle, and closes with steady energy.';
    }
    return 'This sequence opens smoothly, peaks in the middle, and lands on an easy finish.';
}
export function generateStorySpine(route, context) {
    const startStop = resolvePhaseStop(route, 'start');
    const highlightStop = resolvePhaseStop(route, 'highlight');
    const windDownStop = resolvePhaseStop(route, 'windDown');
    const compactness = getCompactness(route);
    const startEnergy = getEnergyBand(startStop, context.vibe);
    const highlightEnergy = getEnergyBand(highlightStop, context.vibe);
    const finishEnergy = getEnergyBand(windDownStop, context.vibe);
    const phases = [];
    if (startStop) {
        phases.push({
            role: 'start',
            label: getStartLabel(context, startEnergy),
            summary: buildStartSummary(compactness, startEnergy),
        });
    }
    if (highlightStop) {
        phases.push({
            role: 'highlight',
            label: getHighlightLabel(context, highlightEnergy),
            summary: buildHighlightSummary(context, highlightEnergy),
        });
    }
    if (windDownStop) {
        phases.push({
            role: 'winddown',
            label: getWinddownLabel(context, finishEnergy),
            summary: buildWinddownSummary(compactness, finishEnergy),
        });
    }
    return {
        title: getTitle(context, compactness),
        phases,
        routeSummary: buildRouteSummary({
            compactness,
            startEnergy,
            finishEnergy,
        }),
    };
}
