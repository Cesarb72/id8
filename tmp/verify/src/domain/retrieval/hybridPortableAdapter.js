import { normalizeVenue } from '../normalize/normalizeVenue';
import { fetchLivePlaces } from '../sources/fetchLivePlaces';
const PORTABLE_SEEDS = [
    {
        idSuffix: 'central-coffee-hall',
        name: 'Central Coffee Hall',
        neighborhoodSuffix: 'Central District',
        category: 'cafe',
        driveMinutes: 8,
        tags: ['coffee', 'warmup', 'walkable', 'conversation'],
        priceTier: '$$',
        description: 'Coffee-forward start point with a calm social tone.',
        narrative: 'Portable warmup anchor with low-friction pacing.',
    },
    {
        idSuffix: 'central-kitchen',
        name: 'Central Kitchen',
        neighborhoodSuffix: 'Central District',
        category: 'restaurant',
        driveMinutes: 9,
        tags: ['dining', 'chef-led', 'conversation', 'neighborhood'],
        priceTier: '$$$',
        description: 'Balanced dining anchor with broad route utility.',
        narrative: 'Reliable centerpiece dining lane for mixed intents.',
    },
    {
        idSuffix: 'central-social-club',
        name: 'Central Social Club',
        neighborhoodSuffix: 'Central District',
        category: 'bar',
        driveMinutes: 9,
        tags: ['cocktails', 'social', 'highlight', 'night'],
        priceTier: '$$',
        description: 'Social bar anchor with moderate highlight energy.',
        narrative: 'Portable momentum bump for lively arcs.',
    },
    {
        idSuffix: 'central-market-court',
        name: 'Central Market Court',
        neighborhoodSuffix: 'Central District',
        category: 'event',
        driveMinutes: 8,
        tags: ['market', 'event', 'movement', 'walkable'],
        priceTier: '$$',
        description: 'Market-style support lane with flexible timing.',
        narrative: 'Compact event node for layered sequences.',
    },
    {
        idSuffix: 'central-arcade-hub',
        name: 'Central Arcade Hub',
        neighborhoodSuffix: 'Central District',
        category: 'activity',
        driveMinutes: 9,
        tags: ['activity', 'playful', 'group-friendly', 'discovery'],
        priceTier: '$$',
        description: 'Interactive activity support stop for social groups.',
        narrative: 'High-energy optional lane for highlight-adjacent movement.',
    },
    {
        idSuffix: 'arts-craft-cafe',
        name: 'Craft District Cafe',
        neighborhoodSuffix: 'Arts District',
        category: 'cafe',
        driveMinutes: 11,
        tags: ['coffee', 'curated', 'low-noise', 'linger'],
        priceTier: '$$',
        description: 'Arts-side cafe with calmer warmup utility.',
        narrative: 'Discovery-friendly opening in the cultural lane.',
    },
    {
        idSuffix: 'arts-gallery-walk',
        name: 'Gallery Walk',
        neighborhoodSuffix: 'Arts District',
        category: 'activity',
        driveMinutes: 11,
        tags: ['gallery', 'discovery', 'movement', 'cultural-flow'],
        priceTier: '$',
        description: 'Walkable gallery corridor with strong cultural signal.',
        narrative: 'Cultural discovery connector with low-friction movement.',
    },
    {
        idSuffix: 'arts-museum-house',
        name: 'City Arts House',
        neighborhoodSuffix: 'Arts District',
        category: 'museum',
        driveMinutes: 12,
        tags: ['museum', 'cultural-anchor', 'historic', 'curated'],
        priceTier: '$$',
        description: 'Cultural anchor with slower pacing and discovery depth.',
        narrative: 'Portable culture authority for curator/family intents.',
    },
    {
        idSuffix: 'arts-wine-room',
        name: 'Arts Wine Room',
        neighborhoodSuffix: 'Arts District',
        category: 'bar',
        driveMinutes: 11,
        tags: ['wine', 'intimate', 'conversation', 'slow'],
        priceTier: '$$$',
        description: 'Low-noise wine bar with winddown utility.',
        narrative: 'Softer highlight option for romantic/cultured arcs.',
    },
    {
        idSuffix: 'arts-bistro',
        name: 'Arts Bistro',
        neighborhoodSuffix: 'Arts District',
        category: 'restaurant',
        driveMinutes: 12,
        tags: ['dining', 'local', 'cozy', 'curated'],
        priceTier: '$$',
        description: 'Neighborhood bistro with approachable cultural tone.',
        narrative: 'Supportive dining anchor in arts-forward pockets.',
    },
    {
        idSuffix: 'riverfront-trail-cafe',
        name: 'Riverfront Trail Cafe',
        neighborhoodSuffix: 'Riverfront',
        category: 'cafe',
        driveMinutes: 13,
        tags: ['coffee', 'open-air', 'walkable', 'reset'],
        priceTier: '$$',
        description: 'Open-air cafe for start or reset transitions.',
        narrative: 'Outdoors-leaning starter lane near stroll routes.',
    },
    {
        idSuffix: 'riverfront-park-loop',
        name: 'Riverfront Park Loop',
        neighborhoodSuffix: 'Riverfront',
        category: 'park',
        driveMinutes: 13,
        tags: ['park', 'stroll', 'reset', 'open-air'],
        priceTier: '$',
        description: 'Scenic reset route with strong cooldown usefulness.',
        narrative: 'Winddown lane that improves sequence quality.',
    },
    {
        idSuffix: 'riverfront-food-hall',
        name: 'Riverfront Food Hall',
        neighborhoodSuffix: 'Riverfront',
        category: 'event',
        driveMinutes: 14,
        tags: ['food-hall', 'social', 'event', 'variety'],
        priceTier: '$$',
        description: 'Flexible social node with broad dining variety.',
        narrative: 'Event-like support lane for friends/family groups.',
    },
    {
        idSuffix: 'riverfront-dining-room',
        name: 'Riverfront Dining Room',
        neighborhoodSuffix: 'Riverfront',
        category: 'restaurant',
        driveMinutes: 14,
        tags: ['dining', 'conversation', 'neighborhood', 'highlight'],
        priceTier: '$$$',
        description: 'Steady dining anchor with medium-intensity pace.',
        narrative: 'Adaptable center point for mixed route shapes.',
    },
    {
        idSuffix: 'riverfront-gelato-house',
        name: 'Riverfront Gelato House',
        neighborhoodSuffix: 'Riverfront',
        category: 'dessert',
        driveMinutes: 13,
        tags: ['dessert', 'shareable', 'cooldown', 'walkable'],
        priceTier: '$$',
        description: 'Dessert lane with strong winddown compatibility.',
        narrative: 'Soft landing option that improves end-role fit.',
    },
    {
        idSuffix: 'neighborhood-bakery-cafe',
        name: 'Neighborhood Bakery Cafe',
        neighborhoodSuffix: 'Neighborhood Core',
        category: 'cafe',
        driveMinutes: 10,
        tags: ['bakery', 'coffee', 'cozy', 'low-noise'],
        priceTier: '$$',
        description: 'Cozy bakery cafe with low-friction start utility.',
        narrative: 'Soft neighborhood entry for cozy/family arcs.',
    },
    {
        idSuffix: 'neighborhood-dinner-house',
        name: 'Neighborhood Dinner House',
        neighborhoodSuffix: 'Neighborhood Core',
        category: 'restaurant',
        driveMinutes: 10,
        tags: ['dining', 'conversation', 'family-friendly', 'local'],
        priceTier: '$$',
        description: 'Approachable dining anchor with broad usefulness.',
        narrative: 'Comfortable core dining lane with stable pacing.',
    },
    {
        idSuffix: 'neighborhood-green-park',
        name: 'Neighborhood Green Park',
        neighborhoodSuffix: 'Neighborhood Core',
        category: 'park',
        driveMinutes: 10,
        tags: ['park', 'reset', 'open-air', 'family-friendly'],
        priceTier: '$',
        description: 'Calmer open-air support venue for transitions.',
        narrative: 'Reset anchor for softer sequence movement.',
    },
    {
        idSuffix: 'neighborhood-dessert-kitchen',
        name: 'Neighborhood Dessert Kitchen',
        neighborhoodSuffix: 'Neighborhood Core',
        category: 'dessert',
        driveMinutes: 10,
        tags: ['dessert', 'cozy', 'shareable', 'cooldown'],
        priceTier: '$$',
        description: 'Dessert support lane for romantic/family winddowns.',
        narrative: 'Reliable gentle finish lane in residential pockets.',
    },
    {
        idSuffix: 'neighborhood-listening-bar',
        name: 'Neighborhood Listening Bar',
        neighborhoodSuffix: 'Neighborhood Core',
        category: 'bar',
        driveMinutes: 11,
        tags: ['listening', 'intimate', 'conversation', 'night'],
        priceTier: '$$',
        description: 'Lower-noise social option for smaller groups.',
        narrative: 'Conversation-forward highlight for softer nights.',
    },
];
function normalizeCity(value) {
    const normalized = value.trim().toLowerCase().replace(/\./g, '');
    const [head] = normalized.split(',');
    return (head ?? normalized).replace(/\s+/g, ' ').trim();
}
const KNOWN_CITY_CENTERS = {
    'san jose': { lat: 37.3382, lng: -121.8863 },
    denver: { lat: 39.7392, lng: -104.9903 },
    austin: { lat: 30.2672, lng: -97.7431 },
};
function toTitleCase(value) {
    return value
        .split(' ')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}
function slugify(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
function hashString(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}
function hashToUnit(value) {
    return hashString(value) / 4294967295;
}
function getCityCenter(city) {
    const key = normalizeCity(city);
    const known = KNOWN_CITY_CENTERS[key];
    if (known) {
        return known;
    }
    return {
        lat: Number((30.5 + hashToUnit(`${key}:lat`) * 11.5).toFixed(4)),
        lng: Number((-121.5 + hashToUnit(`${key}:lng`) * 23.5).toFixed(4)),
    };
}
function gateStatusRank(status) {
    if (status === 'approved') {
        return 3;
    }
    if (status === 'demoted') {
        return 2;
    }
    return 1;
}
function compareVenueQuality(left, right) {
    const gateDelta = gateStatusRank(left.source.qualityGateStatus) - gateStatusRank(right.source.qualityGateStatus);
    if (gateDelta !== 0) {
        return gateDelta;
    }
    if (left.source.qualityScore !== right.source.qualityScore) {
        return left.source.qualityScore - right.source.qualityScore;
    }
    if (left.source.sourceConfidence !== right.source.sourceConfidence) {
        return left.source.sourceConfidence - right.source.sourceConfidence;
    }
    if (left.source.completenessScore !== right.source.completenessScore) {
        return left.source.completenessScore - right.source.completenessScore;
    }
    return right.id.localeCompare(left.id);
}
function sortByQuality(venues) {
    return [...venues].sort((left, right) => {
        const qualityDelta = compareVenueQuality(right, left);
        if (qualityDelta !== 0) {
            return qualityDelta;
        }
        return left.id.localeCompare(right.id);
    });
}
function dedupeVenues(venues) {
    const bestByKey = new Map();
    for (const venue of venues) {
        const key = venue.source.providerRecordId ??
            `${normalizeCity(venue.city)}|${slugify(venue.name)}|${slugify(venue.neighborhood)}|${venue.category}`;
        const existing = bestByKey.get(key);
        if (!existing || compareVenueQuality(venue, existing) > 0) {
            bestByKey.set(key, venue);
        }
    }
    return sortByQuality([...bestByKey.values()]);
}
function mergeReasonCounts(current, incoming) {
    const merged = { ...current };
    for (const [reason, count] of Object.entries(incoming)) {
        merged[reason] = (merged[reason] ?? 0) + count;
    }
    return merged;
}
function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
function getGeoBucketKey(venue) {
    const latitude = venue.source.latitude;
    const longitude = venue.source.longitude;
    if (typeof latitude === 'number' && typeof longitude === 'number') {
        const latBucket = Math.round(latitude / 0.018);
        const lngBucket = Math.round(longitude / 0.018);
        return `grid:${latBucket}:${lngBucket}`;
    }
    const neighborhoodKey = slugify(venue.neighborhood);
    if (neighborhoodKey) {
        return `nbh:${neighborhoodKey}`;
    }
    return 'unknown';
}
function summarizeGeoSpread(venues) {
    const bucketMap = new Map();
    for (const venue of venues) {
        const key = getGeoBucketKey(venue);
        const entries = bucketMap.get(key) ?? [];
        entries.push(venue);
        bucketMap.set(key, entries);
    }
    const bucketCount = bucketMap.size;
    const total = venues.length;
    const dominantEntry = [...bucketMap.entries()].sort((left, right) => {
        if (right[1].length !== left[1].length) {
            return right[1].length - left[1].length;
        }
        return left[0].localeCompare(right[0]);
    })[0];
    const dominantCount = dominantEntry?.[1].length ?? 0;
    const dominantAreaShare = total > 0 ? Number((dominantCount / total).toFixed(3)) : 0;
    const bucketComponent = clamp01((bucketCount - 1) / 4);
    const balanceComponent = clamp01(1 - dominantAreaShare);
    const geoSpreadScore = Number((bucketComponent * 0.6 + balanceComponent * 0.4).toFixed(3));
    return {
        geoBucketCount: bucketCount,
        dominantAreaShare,
        geoSpreadScore,
        dominantBucketKey: dominantEntry?.[0],
        bucketMap,
    };
}
function applyGeoDiversityShaping(venues) {
    const summary = summarizeGeoSpread(venues);
    if (venues.length < 10 || summary.geoBucketCount < 2 || summary.dominantAreaShare <= 0.5) {
        return {
            venues,
            geoBucketCount: summary.geoBucketCount,
            dominantAreaShare: summary.dominantAreaShare,
            geoSpreadScore: summary.geoSpreadScore,
            downsampledCount: 0,
            notes: [],
        };
    }
    const dominantBucketKey = summary.dominantBucketKey;
    if (!dominantBucketKey) {
        return {
            venues,
            geoBucketCount: summary.geoBucketCount,
            dominantAreaShare: summary.dominantAreaShare,
            geoSpreadScore: summary.geoSpreadScore,
            downsampledCount: 0,
            notes: [],
        };
    }
    const dominantBucket = sortByQuality(summary.bucketMap.get(dominantBucketKey) ?? []);
    const nonDominant = sortByQuality([...summary.bucketMap.entries()]
        .filter(([key]) => key !== dominantBucketKey)
        .flatMap(([, bucketVenues]) => bucketVenues));
    const total = venues.length;
    const dominantCap = Math.max(6, Math.ceil(total * 0.55));
    if (dominantBucket.length <= dominantCap) {
        return {
            venues,
            geoBucketCount: summary.geoBucketCount,
            dominantAreaShare: summary.dominantAreaShare,
            geoSpreadScore: summary.geoSpreadScore,
            downsampledCount: 0,
            notes: [],
        };
    }
    const trimmedDominant = dominantBucket.slice(0, dominantCap);
    const shaped = sortByQuality([...trimmedDominant, ...nonDominant]);
    const shapedSummary = summarizeGeoSpread(shaped);
    return {
        venues: shaped,
        geoBucketCount: shapedSummary.geoBucketCount,
        dominantAreaShare: shapedSummary.dominantAreaShare,
        geoSpreadScore: shapedSummary.geoSpreadScore,
        downsampledCount: dominantBucket.length - trimmedDominant.length,
        notes: [
            `Geo diversity shaping trimmed ${dominantBucket.length - trimmedDominant.length} dominant-area venues to improve bucket balance.`,
        ],
    };
}
function selectGeoBalancedVenues(venues, maxCount) {
    if (venues.length <= maxCount) {
        return venues;
    }
    const bucketMap = new Map();
    for (const venue of sortByQuality(venues)) {
        const key = getGeoBucketKey(venue);
        const entries = bucketMap.get(key) ?? [];
        entries.push(venue);
        bucketMap.set(key, entries);
    }
    const bucketOrder = [...bucketMap.entries()]
        .sort((left, right) => {
        const leftHead = left[1][0];
        const rightHead = right[1][0];
        if (leftHead && rightHead) {
            const qualityDelta = compareVenueQuality(rightHead, leftHead);
            if (qualityDelta !== 0) {
                return qualityDelta;
            }
        }
        return left[0].localeCompare(right[0]);
    })
        .map(([key]) => key);
    const selected = [];
    while (selected.length < maxCount) {
        let advanced = false;
        for (const bucketKey of bucketOrder) {
            const entries = bucketMap.get(bucketKey);
            if (!entries || entries.length === 0) {
                continue;
            }
            const nextVenue = entries.shift();
            if (!nextVenue) {
                continue;
            }
            selected.push(nextVenue);
            advanced = true;
            if (selected.length >= maxCount) {
                break;
            }
        }
        if (!advanced) {
            break;
        }
    }
    return sortByQuality(selected);
}
function projectNeighborhoodByGeoArea(venues, city) {
    const cityCenter = getCityCenter(city);
    return venues.map((venue) => {
        const latitude = venue.source.latitude;
        const longitude = venue.source.longitude;
        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
            return venue;
        }
        const latDelta = latitude - cityCenter.lat;
        const lngDelta = longitude - cityCenter.lng;
        const absLat = Math.abs(latDelta);
        const absLng = Math.abs(lngDelta);
        let areaLabel = 'Central';
        if (absLat > 0.012 || absLng > 0.012) {
            areaLabel =
                absLat >= absLng
                    ? latDelta >= 0
                        ? 'North'
                        : 'South'
                    : lngDelta >= 0
                        ? 'East'
                        : 'West';
        }
        return {
            ...venue,
            neighborhood: `${toTitleCase(normalizeCity(city) || city)} ${areaLabel} District`,
        };
    });
}
function buildIntent(city, primaryAnchor, crew) {
    return {
        crew,
        primaryAnchor,
        city,
        distanceMode: 'short-drive',
        prefersHiddenGems: primaryAnchor === 'cultured' || primaryAnchor === 'adventurous-urban',
        mode: 'build',
        planningMode: 'engine-led',
    };
}
export function buildPortableBootstrapVenues(city) {
    const cityLabel = toTitleCase(normalizeCity(city) || city);
    const citySlug = slugify(cityLabel || 'portable-city');
    return PORTABLE_SEEDS.map((seed) => normalizeVenue({
        rawType: 'place',
        id: `hybrid_${citySlug}_${seed.idSuffix}`,
        name: `${cityLabel} ${seed.name}`,
        city: cityLabel,
        neighborhood: `${cityLabel} ${seed.neighborhoodSuffix}`,
        driveMinutes: seed.driveMinutes,
        priceTier: seed.priceTier,
        tags: [...seed.tags, 'portable-bootstrap', 'hybrid'],
        shortDescription: seed.description,
        narrativeFlavor: seed.narrative,
        categoryHint: seed.category,
        subcategoryHint: seed.tags[0] ?? seed.category,
        placeTypes: [seed.category, ...seed.tags.slice(0, 2)],
        sourceTypes: [seed.category, 'portable-bootstrap'],
        normalizedFromRawType: 'raw-place',
        sourceOrigin: 'live',
        sourceQueryLabel: 'portable-bootstrap',
        sourceConfidence: 0.62,
        isChain: false,
        isHiddenGem: true,
        uniquenessScore: 0.72,
        distinctivenessScore: 0.74,
        underexposureScore: 0.73,
        shareabilityScore: 0.7,
        vibeTags: ['culture', 'creative', 'relaxed'],
    }));
}
export async function fetchHybridPortableVenues(city) {
    const normalizedCity = toTitleCase(normalizeCity(city) || city);
    if (!normalizedCity) {
        return {
            venues: [],
            diagnostics: {
                mode: 'none',
                city: city,
                liveAttempted: false,
                liveSucceeded: false,
                liveRawFetched: 0,
                liveMapped: 0,
                liveMappedDropped: 0,
                liveMapDropReasons: {},
                liveNormalized: 0,
                liveNormalizationDropped: 0,
                liveNormalizationDropReasons: {},
                liveAcceptedPreGeo: 0,
                liveAccepted: 0,
                liveSuppressed: 0,
                liveSuppressionReasons: {},
                geoBucketCount: 0,
                dominantAreaShare: 0,
                geoSpreadScore: 0,
                geoDiversityDownsampledCount: 0,
                bootstrapCount: 0,
                selectedCount: 0,
                notes: ['No city provided for hybrid retrieval.'],
            },
        };
    }
    const liveIntents = [
        buildIntent(normalizedCity, 'cozy', 'romantic'),
        buildIntent(normalizedCity, 'lively', 'socialite'),
        buildIntent(normalizedCity, 'cultured', 'curator'),
    ];
    const liveResults = await Promise.all(liveIntents.map((intent) => fetchLivePlaces(intent)));
    const liveAcceptedBeforeDedupe = liveResults
        .flatMap((entry) => entry.venues)
        .filter((venue) => venue.source.qualityGateStatus !== 'suppressed');
    const liveSuppressedBeforeDedupe = liveResults
        .flatMap((entry) => entry.venues)
        .filter((venue) => venue.source.qualityGateStatus === 'suppressed');
    const liveVenuesDeduped = dedupeVenues(liveAcceptedBeforeDedupe);
    const geoShapedLiveVenues = applyGeoDiversityShaping(liveVenuesDeduped);
    const liveVenues = geoShapedLiveVenues.venues;
    const liveRawFetched = liveResults.reduce((sum, entry) => sum + entry.diagnostics.rawFetchedCount, 0);
    const liveMapped = liveResults.reduce((sum, entry) => sum + entry.diagnostics.mappedCount, 0);
    const liveMappedDropped = liveResults.reduce((sum, entry) => sum + entry.diagnostics.mappedDroppedCount, 0);
    const liveMapDropReasons = liveResults.reduce((merged, entry) => mergeReasonCounts(merged, entry.diagnostics.mappedDropReasons), {});
    const liveNormalized = liveResults.reduce((sum, entry) => sum + entry.diagnostics.normalizedCount, 0);
    const liveNormalizationDropped = liveResults.reduce((sum, entry) => sum + entry.diagnostics.normalizationDroppedCount, 0);
    const liveNormalizationDropReasons = liveResults.reduce((merged, entry) => mergeReasonCounts(merged, entry.diagnostics.normalizationDropReasons), {});
    const liveSuppressionReasons = liveResults.reduce((merged, entry) => mergeReasonCounts(merged, entry.diagnostics.acceptanceDropReasons), {});
    const liveAttempted = liveResults.some((entry) => entry.diagnostics.attempted);
    const liveSucceeded = liveResults.some((entry) => entry.diagnostics.success);
    const dedupeDropped = liveAcceptedBeforeDedupe.length - liveVenuesDeduped.length;
    if (liveVenues.length >= 12) {
        const selectedLiveVenues = projectNeighborhoodByGeoArea(selectGeoBalancedVenues(liveVenues, 32), normalizedCity);
        return {
            venues: selectedLiveVenues,
            diagnostics: {
                mode: 'hybrid_live',
                city: normalizedCity,
                liveAttempted,
                liveSucceeded,
                liveRawFetched,
                liveMapped,
                liveMappedDropped,
                liveMapDropReasons,
                liveNormalized,
                liveNormalizationDropped,
                liveNormalizationDropReasons,
                liveAcceptedPreGeo: liveVenuesDeduped.length,
                liveAccepted: liveVenues.length,
                liveSuppressed: liveSuppressedBeforeDedupe.length,
                liveSuppressionReasons,
                geoBucketCount: geoShapedLiveVenues.geoBucketCount,
                dominantAreaShare: geoShapedLiveVenues.dominantAreaShare,
                geoSpreadScore: geoShapedLiveVenues.geoSpreadScore,
                geoDiversityDownsampledCount: geoShapedLiveVenues.downsampledCount,
                bootstrapCount: 0,
                selectedCount: selectedLiveVenues.length,
                notes: [
                    'Live hybrid retrieval provided enough entities without bootstrap support.',
                    ...(dedupeDropped > 0 ? [`${dedupeDropped} duplicate live entities collapsed during merge.`] : []),
                    ...geoShapedLiveVenues.notes,
                    ...(selectedLiveVenues.length < liveVenues.length
                        ? [`Geo-balanced selection chose ${selectedLiveVenues.length} venues from ${liveVenues.length} live candidates.`]
                        : []),
                ],
            },
        };
    }
    const bootstrapVenues = buildPortableBootstrapVenues(normalizedCity);
    const merged = dedupeVenues([...liveVenues, ...bootstrapVenues]);
    const selectedMergedVenues = projectNeighborhoodByGeoArea(selectGeoBalancedVenues(merged, 36), normalizedCity);
    const mode = liveVenues.length > 0
        ? 'hybrid_live_plus_bootstrap'
        : 'hybrid_bootstrap';
    return {
        venues: selectedMergedVenues,
        diagnostics: {
            mode,
            city: normalizedCity,
            liveAttempted,
            liveSucceeded,
            liveRawFetched,
            liveMapped,
            liveMappedDropped,
            liveMapDropReasons,
            liveNormalized,
            liveNormalizationDropped,
            liveNormalizationDropReasons,
            liveAcceptedPreGeo: liveVenuesDeduped.length,
            liveAccepted: liveVenues.length,
            liveSuppressed: liveSuppressedBeforeDedupe.length,
            liveSuppressionReasons,
            geoBucketCount: geoShapedLiveVenues.geoBucketCount,
            dominantAreaShare: geoShapedLiveVenues.dominantAreaShare,
            geoSpreadScore: geoShapedLiveVenues.geoSpreadScore,
            geoDiversityDownsampledCount: geoShapedLiveVenues.downsampledCount,
            bootstrapCount: bootstrapVenues.length,
            selectedCount: selectedMergedVenues.length,
            notes: mode === 'hybrid_bootstrap'
                ? [
                    'Live retrieval unavailable or too thin; portable bootstrap fallback supplied the field.',
                    ...(liveAttempted
                        ? [
                            `Live attrition snapshot: fetched ${liveRawFetched}, mapped ${liveMapped}, normalized ${liveNormalized}, accepted ${liveVenues.length}.`,
                        ]
                        : []),
                ]
                : [
                    'Live retrieval was thin; portable bootstrap supplemented coverage for district formation.',
                    `Live attrition snapshot: fetched ${liveRawFetched}, mapped ${liveMapped}, normalized ${liveNormalized}, accepted ${liveVenues.length}.`,
                    ...(dedupeDropped > 0 ? [`${dedupeDropped} duplicate live entities collapsed during merge.`] : []),
                    ...geoShapedLiveVenues.notes,
                    ...(selectedMergedVenues.length < merged.length
                        ? [
                            `Geo-balanced selection chose ${selectedMergedVenues.length} venues from ${merged.length} total candidates.`,
                        ]
                        : []),
                ],
        },
    };
}
