import { getTimeWindowSignal } from '../retrieval/getTimeWindowSignal';
import { normalizeVenue } from '../normalize/normalizeVenue';
import { buildLiveQueryPlan } from './buildLiveQueryPlan';
import { getGooglePlacesConfig } from './getSourceMode';
import { mapLivePlaceToRawPlaceWithDiagnostics, } from './mapLivePlaceToRawPlace';
const googleFieldMask = [
    'places.id',
    'places.displayName',
    'places.primaryType',
    'places.types',
    'places.formattedAddress',
    'places.shortFormattedAddress',
    'places.addressComponents',
    'places.editorialSummary',
    'places.businessStatus',
    'places.currentOpeningHours.openNow',
    'places.currentOpeningHours.weekdayDescriptions',
    'places.currentOpeningHours.periods',
    'places.priceLevel',
    'places.regularOpeningHours.weekdayDescriptions',
    'places.regularOpeningHours.periods',
    'places.rating',
    'places.userRatingCount',
    'places.utcOffsetMinutes',
    'places.websiteUri',
    'places.location',
].join(',');
const KNOWN_CITY_CENTERS = {
    'san jose': { lat: 37.3382, lng: -121.8863 },
    denver: { lat: 39.7392, lng: -104.9903 },
    austin: { lat: 30.2672, lng: -97.7431 },
};
function normalizeCity(value) {
    const normalized = value.trim().toLowerCase().replace(/\./g, '');
    const [head] = normalized.split(',');
    return (head ?? normalized).replace(/\s+/g, ' ').trim();
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
    const cityKey = normalizeCity(city);
    const known = KNOWN_CITY_CENTERS[cityKey];
    if (known) {
        return known;
    }
    const lat = 30.5 + hashToUnit(`${cityKey}:lat`) * 11.5;
    const lng = -121.5 + hashToUnit(`${cityKey}:lng`) * 23.5;
    return { lat: Number(lat.toFixed(4)), lng: Number(lng.toFixed(4)) };
}
function metersToLatDegrees(meters) {
    return meters / 111320;
}
function metersToLngDegrees(meters, latitude) {
    const latRadians = (latitude * Math.PI) / 180;
    const metersPerDegree = 111320 * Math.max(0.2, Math.cos(latRadians));
    return meters / metersPerDegree;
}
function deriveQueryCenters(city, maxCenters, offsetM) {
    const center = getCityCenter(city);
    const latOffset = metersToLatDegrees(offsetM);
    const lngOffset = metersToLngDegrees(offsetM, center.lat);
    const allCenters = [
        {
            id: 'core',
            lat: Number(center.lat.toFixed(5)),
            lng: Number(center.lng.toFixed(5)),
        },
        {
            id: 'north',
            lat: Number((center.lat + latOffset).toFixed(5)),
            lng: Number(center.lng.toFixed(5)),
        },
        {
            id: 'east',
            lat: Number(center.lat.toFixed(5)),
            lng: Number((center.lng + lngOffset).toFixed(5)),
        },
        {
            id: 'south',
            lat: Number((center.lat - latOffset).toFixed(5)),
            lng: Number(center.lng.toFixed(5)),
        },
        {
            id: 'west',
            lat: Number(center.lat.toFixed(5)),
            lng: Number((center.lng - lngOffset).toFixed(5)),
        },
    ];
    return allCenters.slice(0, Math.max(1, Math.min(5, maxCenters)));
}
async function runQueryPlanInBatches(queryPlan) {
    const settled = [];
    const batchSize = 6;
    for (let index = 0; index < queryPlan.length; index += batchSize) {
        const batch = queryPlan.slice(index, index + batchSize);
        const batchSettled = await Promise.allSettled(batch.map(async (query) => ({
            query,
            places: await queryGooglePlacesTextSearch({
                kind: query.kind,
                textQuery: query.textQuery,
                center: query.center,
                radiusM: query.radiusM,
            }),
        })));
        settled.push(...batchSettled);
    }
    return settled;
}
function countByGateStatus(venues, status) {
    return venues.filter((venue) => venue.source.qualityGateStatus === status).length;
}
function emptyMapDropReasons() {
    return {
        missing_name: 0,
        missing_place_id: 0,
        unsupported_category: 0,
    };
}
function incrementBucket(counter, key) {
    counter[key] = (counter[key] ?? 0) + 1;
}
function formatLocationLabel(intent) {
    return intent.neighborhood ? `${intent.neighborhood}, ${intent.city}` : intent.city;
}
async function queryGooglePlacesTextSearch(query) {
    const config = getGooglePlacesConfig();
    if (!config.apiKey) {
        throw new Error('Missing VITE_GOOGLE_PLACES_API_KEY.');
    }
    const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': config.apiKey,
            'X-Goog-FieldMask': googleFieldMask,
        },
        body: JSON.stringify({
            textQuery: query.textQuery,
            pageSize: config.pageSize,
            languageCode: config.languageCode,
            regionCode: config.regionCode,
            rankPreference: 'RELEVANCE',
            locationBias: {
                circle: {
                    center: {
                        latitude: query.center.lat,
                        longitude: query.center.lng,
                    },
                    radius: query.radiusM,
                },
            },
        }),
    });
    if (!response.ok) {
        throw new Error(`${query.kind} query failed (${response.status})`);
    }
    const payload = (await response.json());
    return (payload.places ?? []).filter((place) => place.businessStatus !== 'CLOSED_PERMANENTLY');
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
function dedupeByPlaceId(venues) {
    const bestByKey = new Map();
    for (const venue of venues) {
        const key = venue.source.providerRecordId ??
            `${normalizeCity(venue.city)}|${venue.name.trim().toLowerCase()}|${venue.category}`;
        const existing = bestByKey.get(key);
        if (!existing || compareVenueQuality(venue, existing) > 0) {
            bestByKey.set(key, venue);
        }
    }
    const deduped = [...bestByKey.values()].sort((left, right) => left.id.localeCompare(right.id));
    return {
        venues: deduped,
        dropped: Math.max(0, venues.length - deduped.length),
    };
}
function normalizeRawPlaces(rawPlaces, intent) {
    const timeWindowSignal = getTimeWindowSignal(intent);
    const venues = [];
    let droppedCount = 0;
    const droppedReasons = {};
    for (const rawPlace of rawPlaces) {
        try {
            venues.push(normalizeVenue(rawPlace, {
                timeWindowSignal,
            }));
        }
        catch (error) {
            droppedCount += 1;
            const reason = error instanceof Error && error.message
                ? `normalize_error:${error.message.split(':')[0]}`
                : 'normalize_error:unknown';
            incrementBucket(droppedReasons, reason);
        }
    }
    return {
        venues,
        droppedCount,
        droppedReasons,
    };
}
function countSuppressionReasons(venues) {
    const reasons = {};
    for (const venue of venues) {
        if (venue.source.qualityGateStatus !== 'suppressed') {
            continue;
        }
        if (venue.source.suppressionReasons.length === 0) {
            incrementBucket(reasons, 'suppressed_without_reason');
            continue;
        }
        for (const reason of venue.source.suppressionReasons) {
            incrementBucket(reasons, reason);
        }
    }
    return reasons;
}
export async function fetchLivePlaces(intent, starterPack) {
    const config = getGooglePlacesConfig();
    const queryLocationLabel = formatLocationLabel(intent);
    const baseQueryPlan = buildLiveQueryPlan(intent, starterPack);
    const queryCenters = deriveQueryCenters(intent.city, config.maxCenters, config.centerOffsetM);
    const queryPlan = baseQueryPlan.flatMap((entry) => queryCenters.map((center) => ({
        ...entry,
        label: `${entry.label}@${center.id}`,
        center,
        radiusM: config.queryRadiusM,
    })));
    const queryTemplatesUsed = [...new Set(queryPlan.map((entry) => entry.template))];
    const queryLabelsUsed = queryPlan.map((entry) => entry.label);
    const roleIntentQueryNotes = [...new Set(baseQueryPlan.flatMap((entry) => entry.notes))];
    const requestedKindsForPlan = [...new Set(baseQueryPlan.map((entry) => entry.kind))];
    if (!config.apiKey) {
        return {
            venues: [],
            diagnostics: {
                attempted: false,
                provider: 'google-places',
                queryLocationLabel,
                queryCentersCount: queryCenters.length,
                queryCentersUsed: queryCenters,
                queryRadiusM: config.queryRadiusM,
                requestedKinds: requestedKindsForPlan,
                queryCount: 0,
                liveQueryTemplatesUsed: queryTemplatesUsed,
                liveQueryLabelsUsed: queryLabelsUsed,
                liveCandidatesByQuery: [],
                liveRoleIntentQueryNotes: roleIntentQueryNotes,
                fetchedCount: 0,
                rawFetchedCount: 0,
                mappedCount: 0,
                mappedDroppedCount: 0,
                mappedDropReasons: emptyMapDropReasons(),
                normalizedCount: 0,
                dedupedByPlaceIdCount: 0,
                normalizationDroppedCount: 0,
                normalizationDropReasons: {},
                acceptedCount: 0,
                acceptanceDroppedCount: 0,
                acceptanceDropReasons: {},
                approvedCount: 0,
                demotedCount: 0,
                suppressedCount: 0,
                partialFailure: false,
                success: false,
                failureReason: 'Live adapter disabled because the Google Places API key is missing.',
                errors: [],
            },
        };
    }
    const settled = await runQueryPlanInBatches(queryPlan);
    const errors = [];
    let fetchedCount = 0;
    const rawPlaces = [];
    const fetchedCountByQuery = new Map();
    const mappedDropReasons = emptyMapDropReasons();
    let mappedDroppedCount = 0;
    for (const result of settled) {
        if (result.status === 'rejected') {
            errors.push(result.reason instanceof Error ? result.reason.message : 'Unknown live source failure');
            continue;
        }
        const { query, places } = result.value;
        fetchedCount += places.length;
        fetchedCountByQuery.set(query.label, places.length);
        places.forEach((place, index) => {
            const mapped = mapLivePlaceToRawPlaceWithDiagnostics(place, {
                city: intent.city,
                neighborhood: intent.neighborhood,
                requestedKind: query.kind,
                queryLabel: query.label,
                queryTerms: query.queryTerms,
                rank: index,
            });
            if (mapped.rawPlace) {
                rawPlaces.push(mapped.rawPlace);
            }
            else if (mapped.dropReason) {
                mappedDroppedCount += 1;
                mappedDropReasons[mapped.dropReason] = (mappedDropReasons[mapped.dropReason] ?? 0) + 1;
            }
        });
    }
    const normalized = normalizeRawPlaces(rawPlaces, intent);
    const deduped = dedupeByPlaceId(normalized.venues);
    const venues = deduped.venues;
    const successfulQueries = settled.filter((entry) => entry.status === 'fulfilled').length;
    const liveCandidatesByQuery = queryPlan.map((query) => {
        const mapped = rawPlaces.filter((rawPlace) => rawPlace.sourceQueryLabel === query.label);
        const normalizedForQuery = normalized.venues.filter((venue) => venue.source.sourceQueryLabel === query.label);
        return {
            label: query.label,
            template: query.template,
            roleHint: query.roleHint,
            fetchedCount: fetchedCountByQuery.get(query.label) ?? 0,
            mappedCount: mapped.length,
            normalizedCount: normalizedForQuery.length,
            approvedCount: countByGateStatus(normalizedForQuery, 'approved'),
            demotedCount: countByGateStatus(normalizedForQuery, 'demoted'),
            suppressedCount: countByGateStatus(normalizedForQuery, 'suppressed'),
        };
    });
    return {
        venues,
        diagnostics: {
            attempted: true,
            provider: 'google-places',
            queryLocationLabel,
            queryCentersCount: queryCenters.length,
            queryCentersUsed: queryCenters,
            queryRadiusM: config.queryRadiusM,
            requestedKinds: requestedKindsForPlan,
            queryCount: queryPlan.length,
            liveQueryTemplatesUsed: queryTemplatesUsed,
            liveQueryLabelsUsed: queryLabelsUsed,
            liveCandidatesByQuery,
            liveRoleIntentQueryNotes: roleIntentQueryNotes,
            fetchedCount,
            rawFetchedCount: fetchedCount,
            mappedCount: rawPlaces.length,
            mappedDroppedCount,
            mappedDropReasons,
            normalizedCount: venues.length,
            dedupedByPlaceIdCount: deduped.dropped,
            normalizationDroppedCount: normalized.droppedCount,
            normalizationDropReasons: normalized.droppedReasons,
            acceptedCount: venues.length - countByGateStatus(venues, 'suppressed'),
            acceptanceDroppedCount: countByGateStatus(venues, 'suppressed'),
            acceptanceDropReasons: countSuppressionReasons(venues),
            approvedCount: countByGateStatus(venues, 'approved'),
            demotedCount: countByGateStatus(venues, 'demoted'),
            suppressedCount: countByGateStatus(venues, 'suppressed'),
            partialFailure: errors.length > 0 && successfulQueries > 0,
            success: successfulQueries > 0,
            failureReason: successfulQueries === 0 && errors.length > 0
                ? errors[0]
                : undefined,
            errors,
        },
    };
}
