function getTimeBand(timeWindow) {
    if (!timeWindow) {
        return undefined;
    }
    const [hourRaw, minuteRaw] = timeWindow.split(':');
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw ?? '0');
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
        return undefined;
    }
    const totalMinutes = hour * 60 + minute;
    if (totalMinutes >= 21 * 60 + 30) {
        return 'late';
    }
    if (totalMinutes >= 18 * 60) {
        return 'prime';
    }
    return 'early';
}
function buildWhyNow(signals, context) {
    const energetic = signals.energy >= 0.64 || 1 - signals.calm >= 0.63;
    const calmPocket = signals.calm >= 0.62 && signals.energy < 0.64;
    const compactPocket = signals.coherence >= 0.66 || signals.walkability >= 0.55 || signals.density >= 0.56;
    const eveningMomentum = signals.eventMomentum >= 0.58 || signals.momentPotential >= 0.62;
    const timeBand = getTimeBand(context.timeWindow);
    if (energetic && compactPocket && (timeBand === 'late' || eveningMomentum)) {
        return 'Active later and well-suited to an evening build.';
    }
    if (calmPocket && compactPocket) {
        return 'Quieter area with a steadier flow, better for a slower start.';
    }
    if (energetic && compactPocket) {
        return 'Dense, walkable pocket with enough energy to carry the night.';
    }
    if (compactPocket) {
        return 'Compact cluster that keeps movement low without feeling flat.';
    }
    if (signals.sequenceSupport >= 0.64) {
        return 'Steady area with pacing that holds up through the night.';
    }
    return 'Balanced area with enough movement and variety for tonight.';
}
function buildWhyYou(signals, context) {
    const strongFlow = signals.sequenceSupport >= 0.66 && signals.roleFit >= 0.66;
    const socialNight = signals.energy >= 0.66 || signals.social >= 0.64;
    const intentionalNight = context.vibe === 'cultured' ||
        context.vibe === 'adventurous-outdoor' ||
        context.vibe === 'adventurous-urban';
    if (context.persona === 'romantic' || context.crew === 'romantic') {
        if (signals.calm >= 0.6) {
            return 'Supports a slower, more intimate opening.';
        }
        if (strongFlow) {
            return 'Keeps the route warm without losing pacing.';
        }
        return 'Fits a romantic night while staying easy to move through.';
    }
    if (context.persona === 'friends' || context.crew === 'socialite') {
        if (socialNight) {
            return 'Good for building social momentum early.';
        }
        if (strongFlow) {
            return 'Keeps the route flexible while staying on tone.';
        }
        return 'Matches a social plan without stretching the route.';
    }
    if (context.persona === 'family') {
        if (signals.culturalDepth >= 0.58) {
            return 'Fits a cultural night without losing pacing.';
        }
        return 'Keeps the route easy to follow for a shared night out.';
    }
    if (context.crew === 'curator' || intentionalNight) {
        if (signals.discovery >= 0.62) {
            return 'Fits a curated night with room for discovery.';
        }
        return 'Keeps the route intentional while staying flexible.';
    }
    if (strongFlow) {
        return 'Keeps the route flexible while staying on tone.';
    }
    if (signals.affinity >= 0.66) {
        return 'Strong fit for this plan’s pacing and tone.';
    }
    return 'Balanced fit that still keeps the night coherent.';
}
function categoryLabel(category) {
    if (category === 'restaurant') {
        return 'dining';
    }
    if (category === 'bar') {
        return 'bars';
    }
    if (category === 'cafe') {
        return 'cafes';
    }
    if (category === 'dessert') {
        return 'dessert spots';
    }
    if (category === 'liveMusic') {
        return 'live music';
    }
    if (category === 'activity') {
        return 'activity spots';
    }
    if (category === 'park') {
        return 'open-air space';
    }
    if (category === 'museum') {
        return 'museums';
    }
    return 'events';
}
function hasCategory(mix, category, threshold = 0.2) {
    return mix[category] >= threshold;
}
function buildCategoryMixLine(mix) {
    const rankedCategories = Object.entries(mix)
        .filter(([, value]) => value > 0.1)
        .sort((left, right) => {
        if (right[1] !== left[1]) {
            return right[1] - left[1];
        }
        return left[0].localeCompare(right[0]);
    })
        .map(([category]) => categoryLabel(category));
    if (rankedCategories.length >= 3) {
        return `Distinctive mix of ${rankedCategories[0]}, ${rankedCategories[1]}, and ${rankedCategories[2]} nearby.`;
    }
    if (rankedCategories.length === 2) {
        return `Distinctive mix of ${rankedCategories[0]} and ${rankedCategories[1]} in one pocket.`;
    }
    if (rankedCategories.length === 1) {
        return `Clear ${rankedCategories[0]} identity with nearby support options.`;
    }
    return 'Balanced category mix without a single generic lane.';
}
function buildWhatStandsOut(signals) {
    const mix = signals.categoryMix;
    if (hasCategory(mix, 'bar', 0.18) &&
        (hasCategory(mix, 'activity', 0.14) ||
            hasCategory(mix, 'museum', 0.12) ||
            hasCategory(mix, 'liveMusic', 0.12) ||
            hasCategory(mix, 'event', 0.12))) {
        return 'Mix of bars and creative spots in one tight pocket.';
    }
    if (hasCategory(mix, 'restaurant', 0.2) &&
        (hasCategory(mix, 'park', 0.12) ||
            hasCategory(mix, 'cafe', 0.14) ||
            hasCategory(mix, 'dessert', 0.12))) {
        return 'Strong dinner-and-stroll rhythm without needing long moves.';
    }
    if ((hasCategory(mix, 'museum', 0.1) || hasCategory(mix, 'event', 0.1)) &&
        (hasCategory(mix, 'restaurant', 0.14) || hasCategory(mix, 'cafe', 0.14)) &&
        (hasCategory(mix, 'park', 0.1) || hasCategory(mix, 'activity', 0.1))) {
        return 'Unusual mix of culture, food, and open-air space.';
    }
    if (signals.calm >= 0.62 && signals.social <= 0.56) {
        return 'More neighborhood feel than main-strip energy.';
    }
    if (signals.signature >= 0.7 || signals.diversity >= 0.64) {
        return buildCategoryMixLine(mix);
    }
    return 'Local texture stands out more than broad main-strip coverage.';
}
export function generateDistrictInsider(signals, context) {
    return {
        whyNow: buildWhyNow(signals, context),
        whyYou: buildWhyYou(signals, context),
        whatStandsOut: buildWhatStandsOut(signals),
    };
}
