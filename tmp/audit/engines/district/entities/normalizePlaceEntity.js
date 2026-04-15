import { getPseudoCityCenter, normalizeCityKey } from '../location/pseudoCityCenter';
const DEFAULT_ANCHOR = {
    key: 'default-downtown-core',
    lat: 37.3386,
    lng: -121.8856,
    jitterRadiusM: 72,
};
const CITY_DEFAULT_ANCHORS = {
    'san jose': {
        key: 'san-jose-default-core',
        lat: 37.3386,
        lng: -121.8856,
        jitterRadiusM: 72,
    },
    denver: {
        key: 'denver-default-core',
        lat: 39.7392,
        lng: -104.9903,
        jitterRadiusM: 78,
    },
};
const CITY_NEIGHBORHOOD_ANCHORS = {
    'san jose': {
        downtown: {
            key: 'downtown-core',
            lat: 37.3384,
            lng: -121.8858,
            jitterRadiusM: 68,
        },
        'sofa district': {
            key: 'sofa-south',
            lat: 37.3305,
            lng: -121.8879,
            jitterRadiusM: 64,
        },
        'san pedro': {
            key: 'san-pedro-northwest',
            lat: 37.3395,
            lng: -121.8942,
            jitterRadiusM: 62,
        },
        'santana row': {
            key: 'santana-row',
            lat: 37.3211,
            lng: -121.9495,
            jitterRadiusM: 78,
        },
        'north san jose': {
            key: 'north-san-jose',
            lat: 37.391,
            lng: -121.9373,
            jitterRadiusM: 88,
        },
        'rose garden': {
            key: 'rose-garden',
            lat: 37.3349,
            lng: -121.922,
            jitterRadiusM: 74,
        },
        'kelley park': {
            key: 'kelley-park',
            lat: 37.3267,
            lng: -121.8683,
            jitterRadiusM: 82,
        },
        'alum rock': {
            key: 'alum-rock',
            lat: 37.381,
            lng: -121.8207,
            jitterRadiusM: 86,
        },
        evergreen: {
            key: 'evergreen',
            lat: 37.2869,
            lng: -121.7879,
            jitterRadiusM: 86,
        },
        'willow glen': {
            key: 'willow-glen',
            lat: 37.3075,
            lng: -121.9018,
            jitterRadiusM: 78,
        },
        'the alameda': {
            key: 'the-alameda',
            lat: 37.3384,
            lng: -121.9139,
            jitterRadiusM: 74,
        },
        japantown: {
            key: 'japantown',
            lat: 37.3491,
            lng: -121.8941,
            jitterRadiusM: 72,
        },
    },
    denver: {
        'downtown / lodo': {
            key: 'denver-downtown-lodo',
            lat: 39.7527,
            lng: -104.9993,
            jitterRadiusM: 78,
        },
        rino: {
            key: 'denver-rino',
            lat: 39.7688,
            lng: -104.9799,
            jitterRadiusM: 76,
        },
        'cherry creek': {
            key: 'denver-cherry-creek',
            lat: 39.7197,
            lng: -104.9522,
            jitterRadiusM: 72,
        },
        'highlands / lohi': {
            key: 'denver-highlands-lohi',
            lat: 39.7583,
            lng: -105.013,
            jitterRadiusM: 74,
        },
    },
};
function normalizeNeighborhoodKey(value) {
    return (value ?? '').trim().toLowerCase();
}
function hashString(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}
function hashToSignedUnit(value) {
    const fraction = hashString(value) / 4294967295;
    return fraction * 2 - 1;
}
function hashToUnit(value) {
    return hashString(value) / 4294967295;
}
function metersToLatDegrees(meters) {
    return meters / 111320;
}
function metersToLngDegrees(meters, atLat) {
    const radians = (atLat * Math.PI) / 180;
    const metersPerDegree = 111320 * Math.cos(radians);
    const safeMetersPerDegree = Math.max(20000, metersPerDegree);
    return meters / safeMetersPerDegree;
}
function toEntityType(category) {
    if (category === 'event') {
        return 'event';
    }
    if (category === 'live_music') {
        return 'program';
    }
    if (category === 'museum' || category === 'activity' || category === 'park') {
        return 'hub';
    }
    return 'venue';
}
function toFixedScore(value) {
    return Number(Math.max(0, Math.min(1, value)).toFixed(3));
}
function buildDynamicCityAnchor(cityKey) {
    const pseudoCenter = getPseudoCityCenter(cityKey);
    return {
        key: `${cityKey || 'unknown'}-default-core`,
        lat: pseudoCenter.lat,
        lng: pseudoCenter.lng,
        jitterRadiusM: 84,
    };
}
function buildDynamicNeighborhoodAnchor(cityKey, neighborhoodKey) {
    const cityAnchor = CITY_DEFAULT_ANCHORS[cityKey] ?? buildDynamicCityAnchor(cityKey);
    const angle = hashToUnit(`${cityKey}:${neighborhoodKey}:angle`) * Math.PI * 2;
    const radiusM = 520 + hashToUnit(`${cityKey}:${neighborhoodKey}:radius`) * 720;
    const northM = Math.sin(angle) * radiusM;
    const eastM = Math.cos(angle) * radiusM;
    return {
        key: `${cityKey || 'unknown'}-${neighborhoodKey || 'generic'}-dynamic`,
        lat: cityAnchor.lat + metersToLatDegrees(northM),
        lng: cityAnchor.lng + metersToLngDegrees(eastM, cityAnchor.lat),
        jitterRadiusM: 86,
    };
}
function buildLocation(venue) {
    const cityKey = normalizeCityKey(venue.city);
    const neighborhoodKey = normalizeNeighborhoodKey(venue.neighborhood);
    const cityNeighborhoodAnchors = CITY_NEIGHBORHOOD_ANCHORS[cityKey] ?? {};
    const dynamicNeighborhoodAnchor = neighborhoodKey
        ? buildDynamicNeighborhoodAnchor(cityKey, neighborhoodKey)
        : undefined;
    const base = cityNeighborhoodAnchors[neighborhoodKey] ??
        dynamicNeighborhoodAnchor ??
        CITY_DEFAULT_ANCHORS[cityKey] ??
        buildDynamicCityAnchor(cityKey) ??
        DEFAULT_ANCHOR;
    // Deterministic polar jitter keeps each neighborhood locally tight while
    // preserving stable per-venue placement between runs.
    const angleRadians = hashToUnit(`${venue.id}:angle`) * Math.PI * 2;
    const radialScale = Math.sqrt(hashToUnit(`${venue.id}:radius`));
    const jitterMeters = radialScale * base.jitterRadiusM;
    const jitterNorthM = Math.sin(angleRadians) * jitterMeters;
    const jitterEastM = Math.cos(angleRadians) * jitterMeters;
    const latJitter = metersToLatDegrees(jitterNorthM);
    const lngJitter = metersToLngDegrees(jitterEastM, base.lat);
    return {
        lat: base.lat + latJitter,
        lng: base.lng + lngJitter,
        normalizedNeighborhoodKey: neighborhoodKey,
        anchorKey: base.key,
        jitterRadiusM: base.jitterRadiusM,
    };
}
export function normalizePlaceEntity(venue) {
    const popularity = venue.uniquenessScore * 0.35 +
        venue.shareabilityScore * 0.25 +
        venue.localSignals.localFavoriteScore * 0.4;
    const activity = venue.energyLevel / 5;
    const trust = venue.source.qualityScore * 0.45 +
        venue.source.sourceConfidence * 0.35 +
        venue.localSignals.repeatVisitorScore * 0.2;
    const location = buildLocation(venue);
    return {
        id: venue.id,
        name: venue.name,
        location: {
            lat: location.lat,
            lng: location.lng,
        },
        type: toEntityType(venue.category),
        categories: [venue.category, venue.subcategory, ...venue.source.sourceTypes].filter(Boolean),
        tags: [...venue.tags, ...venue.vibeTags].filter(Boolean),
        metadata: {
            hours: {
                hoursKnown: venue.source.hoursKnown,
                likelyOpenForCurrentWindow: venue.source.likelyOpenForCurrentWindow,
                pressureLevel: venue.source.hoursPressureLevel,
            },
            organizationType: venue.isChain ? 'chain' : 'local',
            address: `${venue.neighborhood}, ${venue.city}`,
            neighborhood: venue.neighborhood,
            sublocality: venue.neighborhood,
            pseudoGeo: {
                normalizedNeighborhoodKey: location.normalizedNeighborhoodKey,
                anchorKey: location.anchorKey,
                jitterRadiusM: location.jitterRadiusM,
            },
        },
        signals: {
            popularity: toFixedScore(popularity),
            activity: toFixedScore(activity),
            trust: toFixedScore(trust),
            openNow: venue.source.openNow,
        },
    };
}
