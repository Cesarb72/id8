import { applyLensToVenue } from './applyLensToVenue';
import { fetchHybridPortableVenues } from './hybridPortableAdapter';
import { mergeVenueSources } from './mergeVenueSources';
import { buildLiveTrustBreakdown } from '../debug/buildLiveTrustBreakdown';
import { BOUNDED_NEARBY_STRETCH_DRIVE_MINUTES, isOutsideStrictNearbyButWithinBoundedStretch, isWithinStrictNearbyWindow, } from '../constraints/localStretchPolicy';
import { fetchLivePlaces } from '../sources/fetchLivePlaces';
import { curatedVenues as baseCuratedVenues } from '../../data/venues';
function sanitize(value) {
    return value.trim().toLowerCase();
}
function sanitizeCity(value) {
    const normalized = sanitize(value).replace(/\./g, '');
    const [head] = normalized.split(',');
    return (head ?? normalized).trim();
}
function hasCuratedCityCoverage(venues, cityQuery) {
    if (!cityQuery) {
        return false;
    }
    const count = venues.filter((venue) => sanitizeCity(venue.city) === cityQuery).length;
    return count >= 10;
}
function buildExcludedDiagnostics(venues) {
    return venues.map((venue) => ({
        venueId: venue.id,
        venueName: venue.name,
        sourceOrigin: venue.source.sourceOrigin,
        provider: venue.source.provider,
        qualityGateStatus: venue.source.qualityGateStatus,
        sourceConfidence: Number((venue.source.sourceConfidence * 100).toFixed(1)),
        completenessScore: Number((venue.source.completenessScore * 100).toFixed(1)),
        normalizedCategory: venue.category,
        reasons: venue.source.suppressionReasons,
    }));
}
function countBySource(venues) {
    return venues.reduce((acc, venue) => {
        acc[venue.source.sourceOrigin] += 1;
        return acc;
    }, { curated: 0, live: 0 });
}
function buildSourcePool(requestedSourceMode, curatedVenues, liveVenues) {
    if (requestedSourceMode === 'curated') {
        return curatedVenues;
    }
    if (requestedSourceMode === 'live') {
        return liveVenues;
    }
    return [...curatedVenues, ...liveVenues];
}
function resolveRequiredInventoryVenues(availableVenues, seedVenues, dedupeLosses) {
    if (!seedVenues || seedVenues.length === 0) {
        return [];
    }
    const venueById = new Map(availableVenues.map((venue) => [venue.id, venue]));
    return seedVenues
        .map((seedVenue) => {
        const exactMatch = venueById.get(seedVenue.id);
        if (exactMatch) {
            return exactMatch;
        }
        const dedupeResolvedVenueId = dedupeLosses.find((loss) => loss.removedVenueId === seedVenue.id)?.keptVenueId;
        if (dedupeResolvedVenueId) {
            const dedupeResolvedVenue = venueById.get(dedupeResolvedVenueId);
            if (dedupeResolvedVenue) {
                return dedupeResolvedVenue;
            }
        }
        return availableVenues.find((venue) => {
            if (seedVenue.source.providerRecordId &&
                venue.source.providerRecordId === seedVenue.source.providerRecordId) {
                return true;
            }
            return (venue.category === seedVenue.category &&
                sanitize(venue.name) === sanitize(seedVenue.name) &&
                sanitize(venue.city) === sanitize(seedVenue.city) &&
                sanitize(venue.neighborhood) === sanitize(seedVenue.neighborhood));
        });
    })
        .filter((venue) => Boolean(venue))
        .filter((venue, index, collection) => collection.findIndex((candidate) => candidate.id === venue.id) === index);
}
function mergeRequiredVenues(primaryVenues, requiredVenues) {
    if (requiredVenues.length === 0) {
        return primaryVenues;
    }
    const merged = [...requiredVenues];
    const seenIds = new Set(requiredVenues.map((venue) => venue.id));
    for (const venue of primaryVenues) {
        if (seenIds.has(venue.id)) {
            continue;
        }
        merged.push(venue);
        seenIds.add(venue.id);
    }
    return merged;
}
export async function retrieveVenues(intent, lens, options = {}) {
    const curatedVenues = options.seedVenues
        ? [...options.seedVenues, ...baseCuratedVenues]
        : baseCuratedVenues;
    const requestedSourceMode = options.requestedSourceMode ?? 'curated';
    const cityQuery = sanitizeCity(intent.city);
    const curatedCoverageForCity = hasCuratedCityCoverage(curatedVenues, cityQuery);
    const normalizedNeighborhood = intent.neighborhood
        ? sanitize(intent.neighborhood)
        : undefined;
    const maxDriveMinutes = intent.distanceMode === 'nearby' ? BOUNDED_NEARBY_STRETCH_DRIVE_MINUTES : 28;
    const liveFetch = requestedSourceMode === 'curated'
        ? {
            venues: [],
            diagnostics: {
                attempted: false,
                provider: 'google-places',
                queryLocationLabel: intent.neighborhood ? `${intent.neighborhood}, ${intent.city}` : intent.city,
                queryCentersCount: 0,
                queryCentersUsed: [],
                queryRadiusM: 0,
                requestedKinds: ['restaurant', 'bar', 'cafe'],
                queryCount: 0,
                liveQueryTemplatesUsed: [],
                liveQueryLabelsUsed: [],
                liveCandidatesByQuery: [],
                liveRoleIntentQueryNotes: [],
                fetchedCount: 0,
                rawFetchedCount: 0,
                mappedCount: 0,
                mappedDroppedCount: 0,
                mappedDropReasons: {},
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
                failureReason: undefined,
                errors: [],
            },
        }
        : await fetchLivePlaces(intent, options.starterPack);
    const hybridPortable = requestedSourceMode !== 'curated' && cityQuery.length > 0 && !curatedCoverageForCity
        ? await fetchHybridPortableVenues(intent.city)
        : undefined;
    const effectiveLiveVenues = [
        ...liveFetch.venues,
        ...(hybridPortable?.venues ?? []),
    ].filter((venue, index, collection) => collection.findIndex((candidate) => candidate.id === venue.id) === index);
    const mergedRequested = mergeVenueSources(curatedVenues, effectiveLiveVenues, requestedSourceMode);
    const liveTrustBreakdown = buildLiveTrustBreakdown(effectiveLiveVenues, mergedRequested.dedupeLosses);
    const liveHoursDemotedCount = effectiveLiveVenues.filter((venue) => venue.source.hoursDemotionApplied).length;
    const liveHoursSuppressedCount = effectiveLiveVenues.filter((venue) => venue.source.hoursSuppressionApplied).length;
    const effectiveLiveApprovedCount = effectiveLiveVenues.filter((venue) => venue.source.qualityGateStatus === 'approved').length;
    const effectiveLiveDemotedCount = effectiveLiveVenues.filter((venue) => venue.source.qualityGateStatus === 'demoted').length;
    const effectiveLiveSuppressedCount = effectiveLiveVenues.filter((venue) => venue.source.qualityGateStatus === 'suppressed').length;
    const hasEffectiveLiveCoverage = liveFetch.diagnostics.success || effectiveLiveVenues.length > 0;
    const allowCuratedFallbackForCity = curatedCoverageForCity || cityQuery.length === 0 || cityQuery === 'san jose';
    const shouldFallbackToCurated = requestedSourceMode !== 'curated' &&
        allowCuratedFallbackForCity &&
        (!hasEffectiveLiveCoverage ||
            mergedRequested.countsBySource.live === 0 ||
            (requestedSourceMode === 'live' && mergedRequested.venues.length < 10));
    const sourcePool = shouldFallbackToCurated
        ? curatedVenues
        : buildSourcePool(requestedSourceMode, curatedVenues, effectiveLiveVenues);
    const mergedPool = mergeVenueSources(curatedVenues, effectiveLiveVenues, shouldFallbackToCurated ? 'curated' : requestedSourceMode);
    const requiredInventoryVenues = resolveRequiredInventoryVenues(mergedPool.venues, options.seedVenues, mergedRequested.dedupeLosses);
    const activeVenues = mergedPool.venues.filter((venue) => venue.isActive);
    const qualityApproved = activeVenues.filter((venue) => venue.source.qualityGateStatus === 'approved');
    const qualityDemoted = activeVenues.filter((venue) => venue.source.qualityGateStatus === 'demoted');
    const qualitySuppressed = activeVenues.filter((venue) => venue.source.qualityGateStatus === 'suppressed');
    const qualityEligibleVenues = activeVenues.filter((venue) => venue.source.qualityGateStatus !== 'suppressed');
    const excludedByQualityGate = buildExcludedDiagnostics(qualitySuppressed);
    const cityMatches = qualityEligibleVenues.filter((venue) => sanitizeCity(venue.city) === cityQuery &&
        venue.driveMinutes <= maxDriveMinutes);
    const allowDefaultSanJoseFallback = allowCuratedFallbackForCity && (cityQuery.length === 0 || cityQuery === 'san jose');
    const fallbackMatches = cityMatches.length > 0
        ? cityMatches
        : allowDefaultSanJoseFallback && (shouldFallbackToCurated || requestedSourceMode === 'curated')
            ? qualityEligibleVenues.filter((venue) => sanitizeCity(venue.city) === 'san jose' &&
                venue.driveMinutes <= maxDriveMinutes)
            : [];
    const shapedCandidates = fallbackMatches
        .map((venue) => applyLensToVenue(venue, intent, lens))
        .sort((left, right) => right.lensCompatibility - left.lensCompatibility);
    const compatibilityThreshold = lens.discoveryBias === 'high' ? 0.36 : lens.tone === 'refined' ? 0.44 : 0.41;
    let fallbackRelaxationApplied = 'none';
    let filteredByLens = shapedCandidates.filter((candidate) => candidate.lensCompatibility >= compatibilityThreshold);
    const lensStrictCount = filteredByLens.length;
    const lensSoftCount = shapedCandidates.filter((candidate) => candidate.lensCompatibility >= 0.3).length;
    if (filteredByLens.length < 10) {
        filteredByLens = shapedCandidates.filter((candidate) => candidate.lensCompatibility >= 0.3);
        fallbackRelaxationApplied = 'lens-soft';
    }
    if (filteredByLens.length < 8) {
        filteredByLens = shapedCandidates;
        fallbackRelaxationApplied = 'lens-off';
    }
    const lensShapedVenues = filteredByLens.map((candidate) => candidate.venue);
    const localFirstLensShapedVenues = intent.distanceMode === 'nearby'
        ? [
            ...lensShapedVenues.filter((venue) => isWithinStrictNearbyWindow(venue.driveMinutes, intent.distanceMode)),
            ...lensShapedVenues
                .filter((venue) => isOutsideStrictNearbyButWithinBoundedStretch(venue.driveMinutes, intent.distanceMode))
                .slice(0, 6),
        ]
        : lensShapedVenues;
    const buildResult = (venues, neighborhoodPreferred) => {
        const finalCountsBySource = countBySource(venues);
        return {
            venues,
            totalVenueCount: mergedPool.venues.length,
            lensCompatibleCount: filteredByLens.length,
            excludedByQualityGate,
            fallbackRelaxationApplied,
            sourceMode: {
                requestedMode: requestedSourceMode,
                effectiveMode: shouldFallbackToCurated ? 'curated' : requestedSourceMode,
                debugOverrideApplied: Boolean(options.sourceModeOverrideApplied),
                fallbackToCurated: shouldFallbackToCurated,
                liveFetchAttempted: liveFetch.diagnostics.attempted,
                liveFetchSucceeded: hasEffectiveLiveCoverage,
                provider: liveFetch.diagnostics.provider,
                failureReason: shouldFallbackToCurated && liveFetch.diagnostics.failureReason
                    ? liveFetch.diagnostics.failureReason
                    : shouldFallbackToCurated && requestedSourceMode === 'live' && mergedRequested.venues.length < 10
                        ? 'Live-only inventory was too thin for safe plan generation, so curated fallback was used.'
                        : liveFetch.diagnostics.failureReason,
                queryLocationLabel: liveFetch.diagnostics.queryLocationLabel,
                queryCentersCount: liveFetch.diagnostics.queryCentersCount,
                queryCentersUsed: liveFetch.diagnostics.queryCentersUsed,
                queryRadiusM: liveFetch.diagnostics.queryRadiusM,
                queryCount: liveFetch.diagnostics.queryCount,
                liveQueryTemplatesUsed: liveFetch.diagnostics.liveQueryTemplatesUsed,
                liveQueryLabelsUsed: liveFetch.diagnostics.liveQueryLabelsUsed,
                liveCandidatesByQuery: liveFetch.diagnostics.liveCandidatesByQuery,
                liveRoleIntentQueryNotes: liveFetch.diagnostics.liveRoleIntentQueryNotes,
                fetchedCount: liveFetch.diagnostics.fetchedCount,
                rawFetchedCount: liveFetch.diagnostics.rawFetchedCount,
                mappedCount: liveFetch.diagnostics.mappedCount + (hybridPortable?.diagnostics.selectedCount ?? 0),
                mappedDroppedCount: liveFetch.diagnostics.mappedDroppedCount,
                mappedDropReasons: liveFetch.diagnostics.mappedDropReasons,
                normalizedCount: effectiveLiveVenues.length,
                dedupedByPlaceIdCount: liveFetch.diagnostics.dedupedByPlaceIdCount,
                normalizationDroppedCount: liveFetch.diagnostics.normalizationDroppedCount,
                normalizationDropReasons: liveFetch.diagnostics.normalizationDropReasons,
                acceptedCount: liveFetch.diagnostics.acceptedCount,
                acceptanceDroppedCount: liveFetch.diagnostics.acceptanceDroppedCount,
                acceptanceDropReasons: liveFetch.diagnostics.acceptanceDropReasons,
                approvedCount: effectiveLiveApprovedCount,
                demotedCount: effectiveLiveDemotedCount,
                suppressedCount: effectiveLiveSuppressedCount,
                liveHoursDemotedCount,
                liveHoursSuppressedCount,
                partialFailure: liveFetch.diagnostics.partialFailure,
                errors: liveFetch.diagnostics.errors,
                countsBySource: finalCountsBySource,
                dedupedCount: mergedRequested.dedupedCount,
                dedupedLiveCount: mergedRequested.dedupedLiveCount,
                liveDedupedAgainstCuratedCount: mergedRequested.liveDedupedAgainstCuratedCount,
                liveNoveltyCollapsedCount: mergedRequested.liveNoveltyCollapsedCount,
                dedupeLosses: mergedRequested.dedupeLosses,
                liveTrustBreakdown,
                hybridAdapterUsed: Boolean(hybridPortable),
                hybridAdapterMode: hybridPortable?.diagnostics.mode,
                hybridAdapterNotes: hybridPortable?.diagnostics.notes,
                hybridAdapterCount: hybridPortable?.diagnostics.selectedCount,
            },
            stageCounts: {
                totalSeed: mergedPool.venues.length,
                active: activeVenues.length,
                qualityApproved: qualityApproved.length,
                qualityDemoted: qualityDemoted.length,
                qualitySuppressed: qualitySuppressed.length,
                curatedSeed: curatedVenues.length,
                liveFetched: liveFetch.diagnostics.fetchedCount,
                liveMapped: liveFetch.diagnostics.mappedCount + (hybridPortable?.diagnostics.selectedCount ?? 0),
                liveNormalized: effectiveLiveVenues.length,
                liveApproved: effectiveLiveApprovedCount,
                liveDemoted: effectiveLiveDemotedCount,
                liveSuppressed: effectiveLiveSuppressedCount,
                liveHoursDemoted: liveHoursDemotedCount,
                liveHoursSuppressed: liveHoursSuppressedCount,
                cityMatch: cityMatches.length,
                geographyMatch: fallbackMatches.length,
                lensStrict: lensStrictCount,
                lensSoft: lensSoftCount,
                finalRetrieved: venues.length,
                neighborhoodPreferred,
                dedupedMerged: mergedRequested.dedupedCount,
                dedupedLive: mergedRequested.dedupedLiveCount,
                finalCurated: finalCountsBySource.curated,
                finalLive: finalCountsBySource.live,
            },
        };
    };
    if (!normalizedNeighborhood) {
        return buildResult(mergeRequiredVenues(localFirstLensShapedVenues, requiredInventoryVenues), 0);
    }
    const neighborhoodMatches = localFirstLensShapedVenues.filter((venue) => sanitize(venue.neighborhood) === normalizedNeighborhood);
    const nearbyMatches = localFirstLensShapedVenues.filter((venue) => sanitize(venue.neighborhood) !== normalizedNeighborhood);
    if (intent.distanceMode === 'nearby' && neighborhoodMatches.length > 0) {
        return buildResult(mergeRequiredVenues([...neighborhoodMatches, ...nearbyMatches], requiredInventoryVenues), neighborhoodMatches.length);
    }
    return buildResult(mergeRequiredVenues(localFirstLensShapedVenues, requiredInventoryVenues), neighborhoodMatches.length);
}
