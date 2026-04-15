import { curatedVenues } from '../../../data/venues';
import { fetchHybridPortableVenues } from '../../../domain/retrieval/hybridPortableAdapter';
import { haversineDistanceM } from '../clustering/geoDistance';
import { normalizePlaceEntity } from './normalizePlaceEntity';
const DEFAULT_MAX_ENTITIES = 120;
const MIN_MAX_ENTITIES = 20;
const MAX_MAX_ENTITIES = 500;
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function normalizeCity(value) {
    const token = (value ?? '').trim().toLowerCase().split(',')[0] ?? '';
    return token.replace(/\s+/g, ' ').trim();
}
function uniqueById(entities) {
    const seen = new Set();
    const deduped = [];
    for (const entity of entities) {
        if (seen.has(entity.id)) {
            continue;
        }
        seen.add(entity.id);
        deduped.push(entity);
    }
    return deduped;
}
export async function fetchPlaceEntities(input) {
    // TODO(district-engine): Replace static seed adapter with provider-backed entity retrieval.
    const cityHint = normalizeCity(input.resolvedLocation.meta.city);
    const curatedCityVenues = cityHint.length > 0
        ? curatedVenues.filter((venue) => normalizeCity(venue.city) === cityHint)
        : [];
    const hasCuratedCoverage = curatedCityVenues.length >= 10;
    let sourceVenues = curatedCityVenues;
    let retrieval = {
        mode: hasCuratedCoverage ? 'curated' : 'none',
        city: input.resolvedLocation.meta.city ?? cityHint,
        curatedCount: curatedCityVenues.length,
        liveRawFetchedCount: 0,
        liveFetchedCount: 0,
        liveMappedCount: 0,
        liveMappedDroppedCount: 0,
        liveMapDropReasons: {},
        liveNormalizedCount: 0,
        liveNormalizationDroppedCount: 0,
        liveNormalizationDropReasons: {},
        liveAcceptedPreGeoCount: 0,
        liveAcceptedCount: 0,
        liveSuppressedCount: 0,
        liveSuppressionReasons: {},
        geoBucketCount: 0,
        dominantAreaShare: 0,
        geoSpreadScore: 0,
        geoDiversityDownsampledCount: 0,
        bootstrapCount: 0,
        selectedCount: 0,
        notes: hasCuratedCoverage
            ? ['Curated city inventory used for district entity retrieval.']
            : ['No curated coverage found for requested city.'],
    };
    if (!hasCuratedCoverage && cityHint.length > 0) {
        const hybrid = await fetchHybridPortableVenues(cityHint);
        sourceVenues = hybrid.venues;
        retrieval = {
            mode: hybrid.diagnostics.mode,
            city: hybrid.diagnostics.city,
            curatedCount: curatedCityVenues.length,
            liveRawFetchedCount: hybrid.diagnostics.liveRawFetched,
            liveFetchedCount: hybrid.diagnostics.liveRawFetched,
            liveMappedCount: hybrid.diagnostics.liveMapped,
            liveMappedDroppedCount: hybrid.diagnostics.liveMappedDropped,
            liveMapDropReasons: hybrid.diagnostics.liveMapDropReasons,
            liveNormalizedCount: hybrid.diagnostics.liveNormalized,
            liveNormalizationDroppedCount: hybrid.diagnostics.liveNormalizationDropped,
            liveNormalizationDropReasons: hybrid.diagnostics.liveNormalizationDropReasons,
            liveAcceptedPreGeoCount: hybrid.diagnostics.liveAcceptedPreGeo,
            liveAcceptedCount: hybrid.diagnostics.liveAccepted,
            liveSuppressedCount: hybrid.diagnostics.liveSuppressed,
            liveSuppressionReasons: hybrid.diagnostics.liveSuppressionReasons,
            geoBucketCount: hybrid.diagnostics.geoBucketCount,
            dominantAreaShare: hybrid.diagnostics.dominantAreaShare,
            geoSpreadScore: hybrid.diagnostics.geoSpreadScore,
            geoDiversityDownsampledCount: hybrid.diagnostics.geoDiversityDownsampledCount,
            bootstrapCount: hybrid.diagnostics.bootstrapCount,
            selectedCount: hybrid.diagnostics.selectedCount,
            notes: hybrid.diagnostics.notes,
        };
    }
    const seeded = sourceVenues;
    const normalized = uniqueById(seeded.map(normalizePlaceEntity));
    const maxEntities = clamp(input.maxEntities ?? DEFAULT_MAX_ENTITIES, MIN_MAX_ENTITIES, MAX_MAX_ENTITIES);
    const searchRadiusM = input.searchRadiusM ?? input.resolvedLocation.radiusM;
    const withDistance = normalized
        .map((entity) => ({
        entity,
        distanceM: haversineDistanceM(entity.location, input.resolvedLocation.center),
    }))
        .sort((left, right) => {
        if (left.distanceM !== right.distanceM) {
            return left.distanceM - right.distanceM;
        }
        const leftPopularity = left.entity.signals?.popularity ?? 0;
        const rightPopularity = right.entity.signals?.popularity ?? 0;
        return rightPopularity - leftPopularity;
    });
    const inRadius = withDistance.filter((item) => item.distanceM <= searchRadiusM);
    const selected = inRadius.length >= 3
        ? inRadius.slice(0, maxEntities)
        : withDistance.slice(0, Math.min(maxEntities, withDistance.length));
    return {
        entities: selected.map((item) => item.entity),
        retrieval: {
            ...retrieval,
            selectedCount: selected.length,
        },
    };
}
