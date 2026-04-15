function getRouteShape(stops, totalRouteFriction) {
    const neighborhoods = new Set(stops.map((stop) => stop.neighborhood));
    const maxDrive = Math.max(...stops.map((stop) => stop.driveMinutes));
    if (neighborhoods.size <= 2 && maxDrive <= 12 && totalRouteFriction <= 3) {
        return 'tight';
    }
    if (neighborhoods.size <= 3 && maxDrive <= 18 && totalRouteFriction <= 6) {
        return 'balanced';
    }
    return 'wandering';
}
function getDescriptor(intent) {
    const primaryMap = {
        cozy: 'cozy',
        lively: 'lively',
        playful: 'playful',
        cultured: 'cultured',
        chill: 'easygoing',
        'adventurous-outdoor': 'open-air',
        'adventurous-urban': 'wandering',
    };
    if (intent.primaryAnchor === 'cozy' && intent.crew === 'romantic') {
        return 'cozy';
    }
    if (intent.primaryAnchor === 'playful' && intent.crew === 'socialite') {
        return 'playful';
    }
    return primaryMap[intent.primaryAnchor];
}
function getOutingLabel(intent, stops) {
    const nightlifeCount = stops.filter((stop) => ['bar', 'live_music', 'event'].includes(stop.category)).length;
    const afternoonCount = stops.filter((stop) => ['cafe', 'park', 'museum'].includes(stop.category)).length;
    if (intent.primaryAnchor === 'lively' ||
        intent.mode === 'surprise' ||
        nightlifeCount >= 2) {
        return 'night out';
    }
    if (intent.primaryAnchor === 'adventurous-outdoor' || afternoonCount >= 2) {
        return 'afternoon';
    }
    return 'evening';
}
function getAreaPhrase(itinerary, routeShape) {
    if (itinerary.neighborhood) {
        return routeShape === 'wandering'
            ? `around ${itinerary.neighborhood}`
            : `through ${itinerary.neighborhood}`;
    }
    return routeShape === 'wandering'
        ? `across ${itinerary.city}`
        : `through ${itinerary.city}`;
}
function withArticle(value) {
    return /^[aeiou]/i.test(value) ? `An ${value}` : `A ${value}`;
}
export function buildPlanStoryContext(intent, itinerary) {
    const routeShape = getRouteShape(itinerary.stops, itinerary.totalRouteFriction);
    return {
        descriptor: getDescriptor(intent),
        outingLabel: getOutingLabel(intent, itinerary.stops),
        areaPhrase: getAreaPhrase(itinerary, routeShape),
        routeShape,
        estimatedTotalLabel: itinerary.estimatedTotalLabel,
        routeFeelLabel: itinerary.routeFeelLabel,
        hasSurprise: itinerary.stops.some((stop) => stop.role === 'surprise'),
        startStop: itinerary.stops.find((stop) => stop.role === 'start'),
        highlightStop: itinerary.stops.find((stop) => stop.role === 'highlight'),
        windDownStop: itinerary.stops.find((stop) => stop.role === 'windDown'),
    };
}
export function buildPlanNarrative(intent, itinerary) {
    const story = buildPlanStoryContext(intent, itinerary);
    return `${withArticle(story.descriptor)} ${story.outingLabel} ${story.areaPhrase}.`;
}
