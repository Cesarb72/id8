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
    if (totalMinutes >= 20 * 60) {
        return 'late';
    }
    if (totalMinutes >= 17 * 60) {
        return 'prime';
    }
    return 'early';
}
function hasTag(tags, terms) {
    for (const term of terms) {
        if (tags.has(term)) {
            return true;
        }
    }
    return false;
}
function addItem(items, item) {
    if (items.includes(item) || items.length >= 3) {
        return;
    }
    items.push(item);
}
export function getDirectionLiveSignals(direction, context) {
    const tags = new Set(direction.tags.map((tag) => tag.toLowerCase()));
    const mix = direction.categoryMix;
    const timeBand = getTimeBand(context.timeWindow);
    const activitySignal = direction.activityScore ??
        Math.max(mix.activity + mix.drinks, direction.energy === 'high' ? 0.7 : direction.energy === 'medium' ? 0.5 : 0.3);
    const denseSignal = (direction.density ?? 0.5) >= 0.58;
    const livelyLane = activitySignal >= 0.62 || (denseSignal && mix.drinks + mix.activity >= 0.5);
    const cozyLane = direction.energy === 'low' ||
        direction.noise === 'low' ||
        (mix.dining + mix.cafe >= 0.48 && mix.activity < 0.34);
    const culturalLane = mix.culture >= 0.2 ||
        hasTag(tags, ['arts-adjacent', 'gallery', 'museum', 'curated', 'cultural']);
    const musicLane = hasTag(tags, ['live', 'music', 'jazz', 'nightlife']);
    const items = [];
    if (livelyLane) {
        if (timeBand === 'late' || mix.drinks >= 0.2) {
            addItem(items, 'Busy cocktail spots picking up after 8.');
        }
        addItem(items, 'Street activity building around dining hubs.');
        if (musicLane || mix.activity >= 0.2 || (direction.momentPotential ?? 0) >= 0.6) {
            addItem(items, 'Music venues warming up.');
        }
    }
    else if (cozyLane) {
        addItem(items, 'Quieter dinner spots with steady flow.');
        if (mix.cafe + mix.dining >= 0.32 || hasTag(tags, ['cafe', 'coffee', 'dessert'])) {
            addItem(items, 'Coffee + dessert places staying active late.');
        }
        addItem(items, 'Lower-noise blocks keep movement easy between stops.');
    }
    else if (culturalLane) {
        if (timeBand === 'early' || timeBand === 'prime' || !timeBand) {
            addItem(items, 'Gallery and museum traffic earlier in the evening.');
        }
        addItem(items, 'Calmer pacing between stops.');
        if (mix.dining + mix.cafe >= 0.28) {
            addItem(items, 'Dinner and cafe anchors keep the area active into the evening.');
        }
    }
    if (context.persona === 'family' && items.length < 3) {
        addItem(items, 'Walkable transitions keep the route easy to follow.');
    }
    if (context.vibe === 'cozy' && items.length < 3) {
        addItem(items, 'Calmer corners stay active without crowd pressure.');
    }
    if (context.vibe === 'cultured' && items.length < 3) {
        addItem(items, 'Cultural anchors are strongest earlier in the night.');
    }
    if (items.length === 0) {
        return {
            title: 'Typical tonight here',
            items: ['Steady evening activity.', 'Walkable cluster of nearby spots.'],
        };
    }
    return {
        title: 'Happening nearby tonight',
        items: items.slice(0, 3),
    };
}
