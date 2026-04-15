function toTitleCase(value) {
    return value
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}
function normalizeSignals(values) {
    return new Set((values ?? []).map((value) => value.toLowerCase()));
}
function hasAnySignal(signals, candidates) {
    return candidates.some((candidate) => signals.has(candidate));
}
function getAtmospherePhrase(signals, priceTier) {
    if (hasAnySignal(signals, ['late-night', 'lively', 'social', 'cocktails', 'crowded'])) {
        return 'for late nights';
    }
    if (hasAnySignal(signals, ['cozy', 'intimate', 'romantic'])) {
        return 'with a cozy crowd';
    }
    if (hasAnySignal(signals, ['quiet', 'calm', 'soft-landing', 'relaxed'])) {
        return 'for a relaxed crowd';
    }
    if (hasAnySignal(signals, ['local', 'community', 'neighborhood', 'comfort'])) {
        return 'locals return to';
    }
    if (priceTier === '$$$' ||
        priceTier === '$$$$' ||
        hasAnySignal(signals, ['stylish', 'sleek', 'elevated', 'upscale'])) {
        return 'with polished details';
    }
    if (hasAnySignal(signals, ['outdoor', 'garden', 'nature', 'viewpoint'])) {
        return 'for an open-air pause';
    }
    return undefined;
}
function getBaseLine(category, subcategory, signals) {
    const cleanSubcategory = subcategory ? toTitleCase(subcategory) : undefined;
    if (category === 'restaurant') {
        if (cleanSubcategory && !/restaurant|dining|food/i.test(cleanSubcategory)) {
            return `${cleanSubcategory} spot`;
        }
        return 'Classic restaurant';
    }
    if (category === 'bar') {
        if (cleanSubcategory && !/bar|cocktail/i.test(cleanSubcategory)) {
            return `${cleanSubcategory} bar`;
        }
        if (signals && hasAnySignal(signals, ['wine', 'wine-bar'])) {
            return 'Wine bar';
        }
        return 'Cocktail bar';
    }
    if (category === 'cafe') {
        if (cleanSubcategory && !/cafe|coffee/i.test(cleanSubcategory)) {
            return `${cleanSubcategory} cafe`;
        }
        return 'Neighborhood cafe';
    }
    if (category === 'dessert') {
        if (cleanSubcategory && !/dessert|ice cream|gelato/i.test(cleanSubcategory)) {
            return `${cleanSubcategory} dessert spot`;
        }
        return 'Dessert spot';
    }
    if (category === 'live_music') {
        if (cleanSubcategory && !/music|venue/i.test(cleanSubcategory)) {
            return `${cleanSubcategory} music room`;
        }
        return 'Live music room';
    }
    if (category === 'activity') {
        if (cleanSubcategory) {
            return `${cleanSubcategory} spot`;
        }
        return 'Playful activity spot';
    }
    if (category === 'park') {
        return 'Scenic neighborhood park';
    }
    if (category === 'museum') {
        if (cleanSubcategory && !/museum/i.test(cleanSubcategory)) {
            return `${cleanSubcategory} museum`;
        }
        return 'Thoughtful museum';
    }
    return 'Live event spot';
}
function toWordCount(value) {
    return value.trim().split(/\s+/).filter(Boolean).length;
}
function buildIdentityLine(venue, role) {
    const signals = normalizeSignals([...(venue.tags ?? []), ...(venue.vibeTags ?? [])]);
    const baseLine = getBaseLine(venue.category, venue.subcategory, signals);
    const atmospherePhrase = getAtmospherePhrase(signals, venue.priceTier);
    if (role === 'windDown' &&
        venue.category === 'cafe' &&
        hasAnySignal(signals, ['tea-room', 'tea', 'quiet', 'calm', 'relaxed'])) {
        return 'Quiet neighborhood tea house for a relaxed close';
    }
    if (role === 'start' &&
        venue.category === 'restaurant' &&
        hasAnySignal(signals, ['chef-led', 'cozy', 'local', 'comfort'])) {
        return 'Well-liked local spot with a chef-led menu';
    }
    if (venue.category === 'cafe' &&
        hasAnySignal(signals, ['local', 'cozy', 'community', 'comfort'])) {
        return 'Well-liked local cafe with a cozy feel';
    }
    if (venue.category === 'bar' &&
        hasAnySignal(signals, ['late-night', 'cocktails', 'social'])) {
        return 'Popular cocktail bar for late nights';
    }
    if (venue.category === 'live_music' &&
        hasAnySignal(signals, ['jazz', 'listening', 'small-stage'])) {
        return 'Well-known music room for late sets';
    }
    if (atmospherePhrase) {
        const combined = `${baseLine} ${atmospherePhrase}`;
        if (toWordCount(combined) <= 10) {
            return combined;
        }
    }
    if (toWordCount(baseLine) <= 4) {
        if (venue.category === 'cafe') {
            return 'Casual neighborhood cafe';
        }
        if (venue.category === 'restaurant') {
            return venue.subcategory ? `${toTitleCase(venue.subcategory)} restaurant` : 'Classic restaurant';
        }
    }
    return baseLine;
}
function buildHighlightIdentityLine(venue) {
    const signals = normalizeSignals([...(venue.tags ?? []), ...(venue.vibeTags ?? [])]);
    if (hasAnySignal(signals, ['speakeasy', 'cocktails', 'mixology'])) {
        return 'Hidden speakeasy known for serious cocktails';
    }
    if (hasAnySignal(signals, ['wine', 'wine-bar', 'curated', 'intimate'])) {
        return 'Intimate wine bar known for curated pours';
    }
    if (venue.category === 'restaurant' &&
        hasAnySignal(signals, ['lively', 'bold', 'chef-led', 'elevated', 'social'])) {
        return 'Popular dining room for bold flavors';
    }
    if (venue.category === 'live_music' &&
        hasAnySignal(signals, ['jazz', 'listening', 'small-stage', 'curated'])) {
        return 'Well-known music room for late sets';
    }
    if (venue.category === 'museum' &&
        hasAnySignal(signals, ['curated', 'thoughtful', 'historic', 'gallery'])) {
        return 'Go-to museum for thoughtful exhibitions';
    }
    if (venue.category === 'activity' &&
        hasAnySignal(signals, ['immersive', 'interactive', 'games'])) {
        return 'Popular activity spot people plan around';
    }
    if (venue.category === 'bar' && hasAnySignal(signals, ['cocktails', 'stylish', 'social'])) {
        return 'Go-to cocktail bar for atmosphere';
    }
    return undefined;
}
function buildRoleLine(role) {
    if (role === 'start') {
        return 'Easy place to get started';
    }
    if (role === 'highlight') {
        return 'This is your main moment';
    }
    if (role === 'surprise') {
        return 'A good shift in the night';
    }
    return 'Low-key finish to the night';
}
function buildConfidenceLine(role, venue) {
    if (role !== 'highlight') {
        return undefined;
    }
    const signals = normalizeSignals([...(venue.tags ?? []), ...(venue.vibeTags ?? [])]);
    if (hasAnySignal(signals, ['local', 'community', 'underexposed', 'hidden-gem', 'neighborhood'])) {
        if (venue.category === 'restaurant') {
            return 'Well-known local favorite for dinner and drinks';
        }
        if (venue.category === 'bar') {
            return 'Neighborhood go-to for drinks and a full room';
        }
        return 'Local favorite people keep coming back to';
    }
    if (hasAnySignal(signals, ['late-night', 'cocktails', 'mixology'])) {
        return 'Popular late-night spot for serious cocktails';
    }
    if (hasAnySignal(signals, ['wine', 'wine-bar', 'curated', 'intimate'])) {
        return 'Go-to wine bar for a slower night';
    }
    if (venue.category === 'restaurant' &&
        (hasAnySignal(signals, ['chef-led', 'elevated', 'stylish', 'social']) ||
            venue.priceTier === '$$$' ||
            venue.priceTier === '$$$$')) {
        return 'Well-known local favorite for dinner and drinks';
    }
    if (venue.category === 'live_music' &&
        hasAnySignal(signals, ['jazz', 'listening', 'small-stage', 'late-night'])) {
        return 'Go-to room for music and a full crowd';
    }
    if (venue.category === 'museum' &&
        hasAnySignal(signals, ['curated', 'thoughtful', 'historic', 'gallery'])) {
        return 'Go-to stop for a thoughtful night out';
    }
    return undefined;
}
export function deriveReadableStopContent(stop, venue, role) {
    const resolvedRole = role ?? stop.role;
    const highlightIdentity = resolvedRole === 'highlight' ? buildHighlightIdentityLine(venue) : undefined;
    return {
        identityLine: highlightIdentity ?? buildIdentityLine(venue, resolvedRole),
        roleLine: buildRoleLine(resolvedRole),
        confidenceLine: buildConfidenceLine(resolvedRole, venue),
    };
}
