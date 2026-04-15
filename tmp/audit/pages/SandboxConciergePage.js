import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ID8Butler } from '../components/butler/ID8Butler';
import { DistrictPreviewPanel } from '../components/dev/DistrictPreviewPanel';
import { RealityCommitStep, } from '../components/demo/RealityCommitStep';
import { buildDirectionCandidates, } from '../domain/direction/buildDirectionCandidates';
import { applyPersonaShaping } from '../domain/direction/applyPersonaShaping';
import { applyVibeShaping } from '../domain/direction/applyVibeShaping';
import { selectBestDistinctDirections } from '../domain/direction/selectBestDistinctDirections';
import { JourneyMapReal } from '../components/journey/JourneyMapReal';
import { RouteSpine } from '../components/journey/RouteSpine';
import { PageShell } from '../components/layout/PageShell';
import { swapArcStop } from '../domain/arc/swapArcStop';
import { scoreAnchoredRoleFit } from '../domain/arc/scoreAnchoredRoleFit';
import { inverseRoleProjection } from '../domain/config/roleProjection';
import { buildHyperlocalDirectionExpression, } from '../domain/directions/buildHyperlocalDirectionExpression';
import { saveLiveArtifactSession, } from '../domain/live/liveArtifactSession';
import { searchAnchorVenues, } from '../domain/search/searchAnchorVenues';
import { getCrewPolicy } from '../domain/intent/getCrewPolicy';
import { projectItinerary } from '../domain/itinerary/projectItinerary';
import { buildTonightSignals } from '../domain/journey/buildTonightSignals';
import { deriveContractAwareStopNarrative } from '../domain/journey/deriveStopNarrative';
import { runGeneratePlan } from '../domain/runGeneratePlan';
import { dedupeStringIds } from '../domain/utils/dedupeStringIds';
import { areStageOverlapFingerprintsEqual, computeJaccardOverlap, formatCollapsedIdPreview, formatIdList, formatJaccard, formatSignedScore, truncateText, } from '../domain/utils/debugListHelpers';
import { buildCanonicalInterpretationBundle, formatExperienceContractActShape, normalizeExperienceContractVibe, } from '../domain/interpretation/buildCanonicalInterpretationBundle';
import { buildContractGateWorld, } from '../domain/bearings/buildContractGateWorld';
import { buildStrategyAdmissibleWorlds, } from '../domain/bearings/buildStrategyAdmissibleWorlds';
import { mapVenueToTasteInput } from '../domain/interpretation/taste/mapVenueToTasteInput';
import { interpretVenueTaste } from '../domain/interpretation/taste/interpretVenueTaste';
import { buildDistrictOpportunityProfiles, } from '../engines/district';
const personaOptions = [
    { label: 'Romantic', value: 'romantic' },
    { label: 'Friends', value: 'friends' },
    { label: 'Family', value: 'family' },
];
const vibeOptions = [
    { label: 'Lively', value: 'lively' },
    { label: 'Cozy', value: 'cozy' },
    { label: 'Cultured', value: 'cultured' },
];
const clusterRefinementMap = {
    lively: ['more-exciting'],
    chill: ['more-relaxed'],
    explore: ['more-unique'],
};
const roleToInternalRole = {
    start: 'warmup',
    highlight: 'peak',
    surprise: 'wildcard',
    windDown: 'cooldown',
};
function normalizePlanningNameCandidate(value) {
    const normalized = value?.replace(/\s+/g, ' ').trim();
    if (!normalized) {
        return undefined;
    }
    const token = normalized.toLowerCase();
    if (token === 'tbd' || token === 'unknown' || token === 'n/a') {
        return undefined;
    }
    return normalized;
}
function extractRepresentativeEntityName(traceLabel) {
    const normalizedTrace = normalizePlanningNameCandidate(traceLabel);
    if (!normalizedTrace) {
        return undefined;
    }
    const [entityNameCandidate] = normalizedTrace.split('|');
    return normalizePlanningNameCandidate(entityNameCandidate);
}
function getAnchorSearchChip(category) {
    if (category === 'restaurant') {
        return 'restaurant';
    }
    if (category === 'bar' || category === 'live_music') {
        return 'drinks';
    }
    if (category === 'park') {
        return 'park';
    }
    if (category === 'activity' || category === 'museum' || category === 'event') {
        return 'activity';
    }
    return undefined;
}
function tokenizeName(value) {
    return value
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 3);
}
function computeNameOverlapScore(query, candidate) {
    const queryTokens = new Set(tokenizeName(query));
    if (queryTokens.size === 0) {
        return 0;
    }
    const candidateTokens = tokenizeName(candidate);
    if (candidateTokens.length === 0) {
        return 0;
    }
    let overlapCount = 0;
    for (const token of candidateTokens) {
        if (queryTokens.has(token)) {
            overlapCount += 1;
        }
    }
    return overlapCount / queryTokens.size;
}
function isLikelySyntheticVenueStyleName(name) {
    const geoToken = /\b(district|downtown|midtown|uptown|japantown|willow|rose|river|alley|station|square|avenue|road)\b/i;
    const venueToken = /\b(cellar|atelier|promenade|stroll|walk|loop|collective|corner|room|hall|yard|grove)\b/i;
    return geoToken.test(name) && venueToken.test(name);
}
function hasSourceBackedIdentity(scoredVenue) {
    if (!scoredVenue) {
        return false;
    }
    const source = scoredVenue.venue.source;
    const providerRecordId = source.providerRecordId?.trim();
    return Boolean(providerRecordId ||
        source.sourceOrigin === 'live' ||
        scoredVenue.candidateIdentity.parentPlaceId ||
        scoredVenue.candidateIdentity.baseVenueId);
}
function hasNavigableVenueLocation(scoredVenue) {
    if (!scoredVenue) {
        return false;
    }
    const source = scoredVenue.venue.source;
    const hasProviderRecord = Boolean(source.providerRecordId?.trim());
    const hasCoordinates = typeof source.latitude === 'number' && typeof source.longitude === 'number';
    const hasAreaContext = Boolean(scoredVenue.venue.city.trim() && scoredVenue.venue.neighborhood.trim());
    return hasProviderRecord || hasCoordinates || hasAreaContext;
}
function isCommittedHighlightCandidateAnchored(scoredVenue) {
    const resolvedDisplay = resolvePlanningVenueDisplayFromScoredVenue(scoredVenue);
    if (!resolvedDisplay.sourceBacked) {
        return false;
    }
    if (!hasSourceBackedIdentity(scoredVenue)) {
        return false;
    }
    if (!hasNavigableVenueLocation(scoredVenue)) {
        return false;
    }
    if (scoredVenue.venue.source.normalizedFromRawType === 'seed' &&
        !scoredVenue.venue.source.providerRecordId &&
        isLikelySyntheticVenueStyleName(resolvedDisplay.title)) {
        return false;
    }
    return true;
}
function isCanonicalAnchorSearchResult(providerRecordId, latitude, longitude, subtitle) {
    return Boolean(providerRecordId &&
        typeof latitude === 'number' &&
        typeof longitude === 'number' &&
        subtitle?.trim());
}
async function resolveCanonicalPlanningStopIdentity(stop, scoredVenue) {
    const directCanonical = resolveCanonicalPlanningStopIdentityFromScoredVenue(stop, scoredVenue);
    if (directCanonical) {
        return directCanonical;
    }
    const queryCandidates = [
        normalizePlanningNameCandidate(stop.venueName),
        normalizePlanningNameCandidate(scoredVenue?.venue.name),
        extractRepresentativeEntityName(scoredVenue?.candidateIdentity.traceLabel),
    ].filter((value) => Boolean(value));
    const uniqueQueries = [...new Set(queryCandidates)];
    if (uniqueQueries.length === 0) {
        return undefined;
    }
    const searchCity = normalizePlanningNameCandidate(stop.city) ??
        normalizePlanningNameCandidate(scoredVenue?.venue.city);
    if (!searchCity) {
        return undefined;
    }
    const searchNeighborhood = normalizePlanningNameCandidate(stop.neighborhood) ??
        normalizePlanningNameCandidate(scoredVenue?.venue.neighborhood);
    const chip = getAnchorSearchChip(stop.category);
    for (const query of uniqueQueries) {
        const candidates = await searchAnchorVenues({
            query,
            city: searchCity,
            neighborhood: searchNeighborhood,
            chip,
        });
        const ranked = candidates
            .map((candidate) => {
            const providerRecordId = candidate.venue.source.providerRecordId?.trim();
            const latitude = candidate.venue.source.latitude;
            const longitude = candidate.venue.source.longitude;
            const subtitle = candidate.subtitle?.trim();
            if (!isCanonicalAnchorSearchResult(providerRecordId, latitude, longitude, subtitle)) {
                return undefined;
            }
            const overlapScore = computeNameOverlapScore(query, candidate.venue.name);
            if (overlapScore <= 0) {
                return undefined;
            }
            return {
                candidate,
                overlapScore,
            };
        })
            .filter((value) => Boolean(value))
            .sort((left, right) => right.overlapScore - left.overlapScore);
        const matched = ranked[0]?.candidate;
        if (!matched) {
            continue;
        }
        return {
            role: stop.role,
            stopId: stop.id,
            sourceVenueId: matched.venue.id,
            displayName: matched.venue.name,
            providerRecordId: matched.venue.source.providerRecordId,
            latitude: matched.venue.source.latitude,
            longitude: matched.venue.source.longitude,
            addressLine: matched.subtitle.trim(),
            city: matched.venue.city,
            neighborhood: matched.venue.neighborhood,
        };
    }
    return undefined;
}
function getPlanningFallbackCategoryLabel(category) {
    if (category === 'live_music') {
        return 'Live music venue';
    }
    if (category === 'cafe') {
        return 'Coffee stop';
    }
    if (category === 'bar') {
        return 'Bar stop';
    }
    if (category === 'dessert') {
        return 'Dessert stop';
    }
    if (category === 'restaurant') {
        return 'Restaurant stop';
    }
    if (category === 'activity') {
        return 'Activity stop';
    }
    if (category === 'museum') {
        return 'Museum stop';
    }
    if (category === 'park') {
        return 'Park stop';
    }
    return 'Event venue';
}
function buildPlanningFallbackStopTitle(stop) {
    const categoryLabel = getPlanningFallbackCategoryLabel(stop.category);
    const neighborhood = stop.neighborhood.trim();
    const city = stop.city.trim();
    if (neighborhood) {
        return `${categoryLabel} in ${neighborhood}`;
    }
    if (city) {
        return `${categoryLabel} near ${city}`;
    }
    return `${categoryLabel} nearby`;
}
function resolvePlanningStopDisplay(stop, scoredVenue) {
    const genericFallback = buildPlanningFallbackStopTitle(stop);
    const genericFallbackToken = genericFallback.toLowerCase();
    const stopName = normalizePlanningNameCandidate(stop.venueName);
    const scoredVenueName = normalizePlanningNameCandidate(scoredVenue?.venue.name);
    const traceEntityName = extractRepresentativeEntityName(scoredVenue?.candidateIdentity.traceLabel);
    const preferredRealName = [stopName, scoredVenueName, traceEntityName].find((candidate) => candidate && candidate.toLowerCase() !== genericFallbackToken) ?? undefined;
    if (preferredRealName) {
        return {
            title: preferredRealName,
            sourceBacked: true,
        };
    }
    return {
        title: genericFallback,
        sourceBacked: false,
    };
}
function resolvePlanningVenueDisplayFromScoredVenue(scoredVenue) {
    const genericFallback = buildPlanningFallbackStopTitle({
        category: scoredVenue.venue.category,
        neighborhood: scoredVenue.venue.neighborhood,
        city: scoredVenue.venue.city,
    });
    const genericFallbackToken = genericFallback.toLowerCase();
    const venueName = normalizePlanningNameCandidate(scoredVenue.venue.name);
    const traceEntityName = extractRepresentativeEntityName(scoredVenue.candidateIdentity.traceLabel);
    const preferredRealName = [venueName, traceEntityName].find((candidate) => candidate && candidate.toLowerCase() !== genericFallbackToken) ?? undefined;
    if (preferredRealName) {
        return {
            title: preferredRealName,
            sourceBacked: true,
        };
    }
    return {
        title: genericFallback,
        sourceBacked: false,
    };
}
function buildCanonicalAddressLine(stop, scoredVenue) {
    const stopSubtitle = normalizePlanningNameCandidate(stop.subtitle);
    if (stopSubtitle) {
        return stopSubtitle;
    }
    const neighborhood = normalizePlanningNameCandidate(stop.neighborhood) ??
        normalizePlanningNameCandidate(scoredVenue?.venue.neighborhood);
    const city = normalizePlanningNameCandidate(stop.city) ??
        normalizePlanningNameCandidate(scoredVenue?.venue.city);
    if (neighborhood && city) {
        return `${neighborhood}, ${city}`;
    }
    return neighborhood ?? city;
}
function resolveCanonicalPlanningStopIdentityFromScoredVenue(stop, scoredVenue) {
    if (!scoredVenue) {
        return undefined;
    }
    const providerRecordId = scoredVenue.venue.source.providerRecordId?.trim();
    const latitude = scoredVenue.venue.source.latitude;
    const longitude = scoredVenue.venue.source.longitude;
    if (!providerRecordId || typeof latitude !== 'number' || typeof longitude !== 'number') {
        return undefined;
    }
    const addressLine = buildCanonicalAddressLine(stop, scoredVenue);
    if (!addressLine) {
        return undefined;
    }
    const display = resolvePlanningStopDisplay(stop, scoredVenue);
    return {
        role: stop.role,
        stopId: stop.id,
        sourceVenueId: scoredVenue.venue.id,
        displayName: display.title,
        providerRecordId,
        latitude,
        longitude,
        addressLine,
        city: stop.city || scoredVenue.venue.city,
        neighborhood: stop.neighborhood || scoredVenue.venue.neighborhood,
    };
}
function findScoredVenueForStop(stop, selectedArc) {
    const targetRole = inverseRoleProjection[stop.role];
    const matched = selectedArc.stops.find((arcStop) => arcStop.role === targetRole &&
        arcStop.scoredVenue.venue.id === stop.venueId);
    if (matched) {
        return matched.scoredVenue;
    }
    return selectedArc.stops.find((arcStop) => arcStop.role === targetRole)?.scoredVenue;
}
async function enforceFullStopRealityContract(params) {
    let nextArc = params.selectedArc;
    let nextItinerary = params.itinerary;
    const rejectedStopRoles = [];
    const committedRoles = nextItinerary.stops
        .map((stop) => stop.role)
        .filter((role) => role === 'start' || role === 'highlight' || role === 'windDown');
    const crewPolicy = getCrewPolicy(params.intentProfile.crew);
    for (const role of committedRoles) {
        const currentStop = nextItinerary.stops.find((stop) => stop.role === role);
        if (!currentStop) {
            continue;
        }
        const currentScoredVenue = findScoredVenueForStop(currentStop, nextArc);
        const currentCanonical = await resolveCanonicalPlanningStopIdentity(currentStop, currentScoredVenue);
        if (currentCanonical) {
            continue;
        }
        const internalRole = inverseRoleProjection[role];
        const replacementCandidates = params.scoredVenues
            .filter((candidate) => candidate.candidateIdentity.kind !== 'moment')
            .filter((candidate) => candidate.venue.id !== currentScoredVenue?.venue.id)
            .sort((left, right) => {
            const roleScoreKey = roleToInternalRole[role];
            const leftScore = scoreAnchoredRoleFit(left, roleScoreKey);
            const rightScore = scoreAnchoredRoleFit(right, roleScoreKey);
            return rightScore - leftScore || left.venue.name.localeCompare(right.venue.name);
        });
        let replaced = false;
        for (const candidate of replacementCandidates) {
            const swappedArc = swapArcStop({
                currentArc: nextArc,
                role: internalRole,
                replacement: candidate,
                intent: params.intentProfile,
                crewPolicy,
                lens: params.lens,
            });
            if (!swappedArc) {
                continue;
            }
            const swappedItinerary = projectItinerary(swappedArc, params.intentProfile, params.lens);
            const swappedStop = swappedItinerary.stops.find((item) => item.role === role);
            if (!swappedStop) {
                continue;
            }
            const swappedScoredVenue = findScoredVenueForStop(swappedStop, swappedArc);
            const swappedCanonical = await resolveCanonicalPlanningStopIdentity(swappedStop, swappedScoredVenue);
            if (!swappedCanonical) {
                continue;
            }
            nextArc = swappedArc;
            nextItinerary = swappedItinerary;
            rejectedStopRoles.push(role);
            replaced = true;
            break;
        }
        if (!replaced) {
            throw new Error(`No canonical source-backed ${role} stop is available for planning mode.`);
        }
    }
    const canonicalStopByRole = {};
    for (const stop of nextItinerary.stops) {
        const scoredVenue = findScoredVenueForStop(stop, nextArc);
        const canonical = await resolveCanonicalPlanningStopIdentity(stop, scoredVenue);
        if (!canonical) {
            if (stop.role === 'surprise') {
                continue;
            }
            throw new Error(`Canonical identity resolution failed for committed ${stop.role} stop.`);
        }
        canonicalStopByRole[stop.role] = canonical;
    }
    return {
        selectedArc: nextArc,
        itinerary: nextItinerary,
        canonicalStopByRole,
        rejectedStopRoles,
    };
}
function applyCanonicalIdentityToItinerary(itinerary, canonicalStopByRole) {
    return {
        ...itinerary,
        stops: itinerary.stops.map((stop) => {
            const canonical = canonicalStopByRole[stop.role];
            if (!canonical) {
                return stop;
            }
            return {
                ...stop,
                venueName: canonical.displayName,
                city: canonical.city,
                neighborhood: canonical.neighborhood,
            };
        }),
    };
}
function toFinalRouteStop(stop, stopIndex, canonicalStopByRole) {
    const canonical = canonicalStopByRole[stop.role];
    if (!canonical ||
        !canonical.providerRecordId ||
        !canonical.displayName ||
        typeof canonical.latitude !== 'number' ||
        typeof canonical.longitude !== 'number' ||
        !canonical.addressLine) {
        return null;
    }
    return {
        id: stop.id,
        sourceStopId: stop.id,
        displayName: canonical.displayName,
        providerRecordId: canonical.providerRecordId,
        latitude: canonical.latitude,
        longitude: canonical.longitude,
        address: canonical.addressLine,
        role: stop.role,
        stopIndex,
        venueId: stop.venueId,
        title: stop.title,
        subtitle: stop.subtitle,
        neighborhood: canonical.neighborhood || stop.neighborhood,
        driveMinutes: stop.driveMinutes,
        imageUrl: stop.imageUrl,
    };
}
function buildFinalRoute(params) {
    const stops = params.itinerary.stops
        .map((stop, stopIndex) => toFinalRouteStop(stop, stopIndex, params.canonicalStopByRole));
    if (stops.some((stop) => !stop)) {
        return null;
    }
    const committedStops = stops.filter((stop) => Boolean(stop));
    const routeHeadline = getPreviewOneLiner(params.selectedCluster, params.itinerary, params.selectedDirectionPreviewContext);
    const routeSummary = getPreviewContinuityLine(params.selectedCluster, params.itinerary, params.selectedDirectionPreviewContext);
    const activeStopIndex = Math.max(0, committedStops.findIndex((stop) => stop.role === params.activeRole));
    return {
        routeId: `${params.itinerary.id}-${Date.now()}`,
        selectedDirectionId: params.selectedDirectionId,
        location: params.city,
        persona: params.persona,
        vibe: params.vibe,
        stops: committedStops,
        activeStopIndex,
        routeHeadline,
        routeSummary,
        mapMarkers: committedStops.map((stop) => ({
            id: stop.id,
            displayName: stop.displayName,
            role: stop.role,
            stopIndex: stop.stopIndex,
            latitude: stop.latitude,
            longitude: stop.longitude,
        })),
        liveNotices: [],
        updatedAt: Date.now(),
    };
}
function buildFinalRouteMapMarkers(stops) {
    return stops
        .slice()
        .sort((left, right) => left.stopIndex - right.stopIndex)
        .map((stop) => ({
        id: stop.id,
        displayName: stop.displayName,
        role: stop.role,
        stopIndex: stop.stopIndex,
        latitude: stop.latitude,
        longitude: stop.longitude,
    }));
}
function patchFinalRouteStop(params) {
    const orderedStops = params.route.stops
        .slice()
        .sort((left, right) => left.stopIndex - right.stopIndex);
    let replaceIndex = -1;
    let resolution = null;
    if (params.targetStopId) {
        replaceIndex = orderedStops.findIndex((stop) => stop.id === params.targetStopId);
        if (replaceIndex >= 0) {
            resolution = 'id';
        }
    }
    if (replaceIndex < 0 && typeof params.targetStopIndex === 'number') {
        replaceIndex = orderedStops.findIndex((stop) => stop.stopIndex === params.targetStopIndex);
        if (replaceIndex >= 0) {
            resolution = 'index';
        }
    }
    if (replaceIndex < 0) {
        replaceIndex = orderedStops.findIndex((stop) => stop.role === params.targetRole);
        if (replaceIndex >= 0) {
            resolution = 'role';
        }
    }
    if (replaceIndex < 0 || !resolution) {
        return null;
    }
    const currentStop = orderedStops[replaceIndex];
    if (!currentStop) {
        return null;
    }
    const replacementStop = {
        ...currentStop,
        ...params.replacementStop,
        title: currentStop.title,
        role: currentStop.role,
        stopIndex: currentStop.stopIndex,
    };
    const nextStops = orderedStops.map((stop, index) => index === replaceIndex ? replacementStop : stop);
    const nextActiveStopIndex = params.activeRole != null
        ? Math.max(0, nextStops.findIndex((stop) => stop.role === params.activeRole))
        : params.route.activeStopIndex;
    return {
        route: {
            ...params.route,
            routeId: `${params.route.routeId}-swap-${Date.now()}`,
            stops: nextStops,
            activeStopIndex: nextActiveStopIndex,
            mapMarkers: buildFinalRouteMapMarkers(nextStops),
            liveNotices: params.notice
                ? [...(params.route.liveNotices ?? []), params.notice]
                : params.route.liveNotices,
            updatedAt: Date.now(),
        },
        resolvedStop: currentStop,
        resolution,
    };
}
function logSwapCommitChecks(route, swappedRole, surfaces) {
    if (!import.meta.env.DEV) {
        return;
    }
    const stopNames = route.stops.map((stop) => stop.displayName);
    const stopIds = route.stops.map((stop) => stop.providerRecordId || stop.id);
    console.log('SWAP COMMIT CHECK', {
        routeId: route.routeId,
        swappedRole,
        stopNames,
        stopIds,
    });
    surfaces.forEach((surface) => {
        console.log('SURFACE ROUTE CHECK', {
            surface,
            routeId: route.routeId,
            stopNames,
        });
    });
}
function isSocialSignal(stop) {
    const tags = new Set(stop.tags.map((tag) => tag.toLowerCase()));
    return (stop.category === 'bar' ||
        stop.category === 'live_music' ||
        ['social', 'live', 'music', 'jazz', 'cocktails'].some((tag) => tags.has(tag)));
}
function isExploratorySignal(stop) {
    const tags = new Set(stop.tags.map((tag) => tag.toLowerCase()));
    return (stop.category === 'museum' ||
        stop.category === 'activity' ||
        stop.category === 'park' ||
        ['culture', 'gallery', 'explore', 'walkable'].some((tag) => tags.has(tag)));
}
function isIntimateSignal(stop) {
    const tags = new Set(stop.tags.map((tag) => tag.toLowerCase()));
    return (stop.category === 'restaurant' ||
        ['quiet', 'cozy', 'tea', 'dessert', 'courtyard'].some((tag) => tags.has(tag)));
}
function inferDirectionIdentityFromSignals(params) {
    const family = params.experienceFamily?.toLowerCase();
    if (family && ['intimate', 'ambient', 'indulgent'].includes(family)) {
        return 'intimate';
    }
    if (family && ['social', 'eventful', 'playful'].includes(family)) {
        return 'social';
    }
    if (family && ['exploratory', 'cultural', 'ritual'].includes(family)) {
        return 'exploratory';
    }
    const laneHint = `${params.cluster} ${params.laneIdentity ?? ''} ${params.macroLane ?? ''} ${params.archetype ?? ''} ${params.label ?? ''} ${params.subtitle ?? ''}`.toLowerCase();
    if (/intimate|dining|restaurant|ambient|cozy|romantic|wine|courtyard|quiet/.test(laneHint)) {
        return 'intimate';
    }
    if (/lively|social|eventful|activity|night|cocktail|bar|live/.test(laneHint)) {
        return 'social';
    }
    if (/explore|culture|museum|gallery|district|curated/.test(laneHint)) {
        return 'exploratory';
    }
    if (params.cluster === 'chill') {
        return 'intimate';
    }
    if (params.cluster === 'lively') {
        return 'social';
    }
    return 'exploratory';
}
function inferDirectionIdentityFromDirection(direction) {
    return inferDirectionIdentityFromSignals({
        experienceFamily: direction.debugMeta?.experienceFamily,
        cluster: direction.cluster,
        archetype: direction.debugMeta?.archetype,
        label: direction.card.title,
        subtitle: direction.card.subtitle,
        laneIdentity: direction.debugMeta?.laneIdentity,
        macroLane: direction.debugMeta?.macroLane,
    });
}
function resolveObservedDirectionIdentity(itinerary, expectedDirectionIdentity) {
    const counts = {
        social: 0,
        exploratory: 0,
        intimate: 0,
    };
    itinerary.stops.forEach((stop) => {
        if (isSocialSignal(stop)) {
            counts.social += 1;
        }
        if (isExploratorySignal(stop)) {
            counts.exploratory += 1;
        }
        if (isIntimateSignal(stop)) {
            counts.intimate += 1;
        }
    });
    if (expectedDirectionIdentity && counts[expectedDirectionIdentity] > 0) {
        return expectedDirectionIdentity;
    }
    const ranked = Object.keys(counts).sort((left, right) => {
        if (counts[right] !== counts[left]) {
            return counts[right] - counts[left];
        }
        const tiebreakOrder = ['intimate', 'social', 'exploratory'];
        return tiebreakOrder.indexOf(left) - tiebreakOrder.indexOf(right);
    });
    return ranked[0] ?? 'exploratory';
}
function clampTasteScore(value) {
    if (Number.isNaN(value)) {
        return 0;
    }
    return Math.min(1, Math.max(0, value));
}
function formatTasteScore(value) {
    return value.toFixed(2);
}
function deriveFoundationTasteSignals(scoredVenue, timeWindow, persona, vibe) {
    if (!scoredVenue) {
        return undefined;
    }
    return interpretVenueTaste(mapVenueToTasteInput(scoredVenue.venue), {
        timeWindow,
        persona: persona ?? undefined,
        vibe: vibe ?? undefined,
    });
}
function formatTasteRoleSuitabilitySummary(signals) {
    if (!signals) {
        return 'n/a';
    }
    return `start:${formatTasteScore(signals.roleSuitability.start)} | highlight:${formatTasteScore(signals.roleSuitability.highlight)} | windDown:${formatTasteScore(signals.roleSuitability.windDown)}`;
}
function formatTasteSignalSummary(signals) {
    if (!signals) {
        return 'n/a';
    }
    return `energy:${formatTasteScore(signals.energy)} social:${formatTasteScore(signals.socialDensity)} intimacy:${formatTasteScore(signals.intimacy)} linger:${formatTasteScore(signals.lingerFactor)} destination:${formatTasteScore(signals.destinationFactor)} experiential:${formatTasteScore(signals.experientialFactor)} convo:${formatTasteScore(signals.conversationFriendliness)}`;
}
function formatTastePersonalitySummary(signals) {
    if (!signals || signals.venuePersonality.tags.length === 0) {
        return 'n/a';
    }
    return signals.venuePersonality.tags.join(' | ');
}
function formatHighlightRoleContrastSummary(signals) {
    if (!signals) {
        return 'n/a';
    }
    const highlightVsStart = signals.roleSuitability.highlight - signals.roleSuitability.start;
    const highlightVsWindDown = signals.roleSuitability.highlight - signals.roleSuitability.windDown;
    return `h-s:${formatTasteScore(highlightVsStart)} | h-w:${formatTasteScore(highlightVsWindDown)}`;
}
function formatHighlightTierReasonSummary(signals) {
    if (!signals) {
        return 'n/a';
    }
    const quickPenalty = signals.durationEstimate === 'quick' ? 'quick_duration_penalty' : 'no_quick_penalty';
    const personality = signals.venuePersonality.tags.join('|') || 'none';
    return `tier:${signals.highlightTier} | dest:${formatTasteScore(signals.destinationFactor)} exp:${formatTasteScore(signals.experientialFactor)} sig:${formatTasteScore(signals.anchorStrength)} | ${quickPenalty} | personality:${personality}`;
}
function formatEnergyBand(value) {
    if (typeof value !== 'number') {
        return 'n/a';
    }
    if (value >= 0.78) {
        return 'high-pulse';
    }
    if (value >= 0.62) {
        return 'animated';
    }
    if (value >= 0.46) {
        return 'balanced';
    }
    return 'soft';
}
function formatSocialDensityBand(value) {
    if (typeof value !== 'number') {
        return 'n/a';
    }
    if (value >= 0.78) {
        return 'broad-social';
    }
    if (value >= 0.62) {
        return 'contained-social';
    }
    if (value >= 0.46) {
        return 'mixed-social';
    }
    return 'quiet-social';
}
function formatSelectedHighlightVibeFit(signals, persona, vibe) {
    if (!signals || !vibe) {
        return 'n/a';
    }
    const livelyLike = vibe === 'lively' || vibe === 'playful';
    const cozyLike = vibe === 'cozy' || vibe === 'chill';
    const energyBand = formatEnergyBand(signals.energy);
    const socialBand = formatSocialDensityBand(signals.socialDensity);
    const highlightStrength = signals.roleSuitability.highlight;
    if (livelyLike) {
        const containedLivelyFit = signals.energy >= 0.56 &&
            signals.socialDensity >= 0.54 &&
            highlightStrength >= 0.62 &&
            (persona !== 'romantic' ||
                signals.intimacy >= 0.48 ||
                signals.conversationFriendliness >= 0.5);
        return containedLivelyFit ? `strong (${energyBand}/${socialBand})` : `soft (${energyBand}/${socialBand})`;
    }
    if (cozyLike) {
        const cozyFit = signals.energy <= 0.62 &&
            signals.socialDensity <= 0.62 &&
            signals.intimacy >= 0.52 &&
            highlightStrength >= 0.54;
        return cozyFit ? `strong (${energyBand}/${socialBand})` : `drifted (${energyBand}/${socialBand})`;
    }
    return `balanced (${energyBand}/${socialBand})`;
}
function formatVibePressureSummary(signals, persona, vibe) {
    if (!signals || !vibe) {
        return 'n/a';
    }
    const livelyLike = vibe === 'lively' || vibe === 'playful';
    const cozyLike = vibe === 'cozy' || vibe === 'chill';
    const tension = formatTasteScore(signals.roleSuitability.highlight - signals.roleSuitability.windDown);
    if (livelyLike) {
        const mode = persona === 'romantic' ? 'contained_pulse' : persona === 'friends' ? 'broad_pulse' : 'animated_pulse';
        return `${mode} | energy:${formatEnergyBand(signals.energy)} | social:${formatSocialDensityBand(signals.socialDensity)} | h-w:${tension}`;
    }
    if (cozyLike) {
        return `soft_contained | energy:${formatEnergyBand(signals.energy)} | social:${formatSocialDensityBand(signals.socialDensity)} | h-w:${tension}`;
    }
    return `balanced_tone | energy:${formatEnergyBand(signals.energy)} | social:${formatSocialDensityBand(signals.socialDensity)} | h-w:${tension}`;
}
function formatToneSeparationSummary(signals) {
    if (!signals) {
        return 'n/a';
    }
    const highlightVsStart = formatTasteScore(signals.roleSuitability.highlight - signals.roleSuitability.start);
    const highlightVsWindDown = formatTasteScore(signals.roleSuitability.highlight - signals.roleSuitability.windDown);
    return `h-s:${highlightVsStart} | h-w:${highlightVsWindDown} | tier:${signals.highlightTier}`;
}
function getFoundationTasteSignalsForRole(plan, role) {
    if (!plan) {
        return undefined;
    }
    const stop = plan.itinerary.stops.find((entry) => entry.role === role);
    if (!stop) {
        return undefined;
    }
    const scoredVenue = findScoredVenueForStop(stop, plan.selectedArc);
    return deriveFoundationTasteSignals(scoredVenue, plan.intentProfile.timeWindow, plan.intentProfile.persona ?? undefined, plan.intentProfile.primaryAnchor);
}
function buildTasteVenuePersonalityProfile(candidate) {
    const signals = candidate.taste.signals;
    const tags = toTagSet(candidate.venue.tags);
    const intimate = signals.intimacy >= 0.58 ||
        ['intimate', 'cozy', 'quiet', 'conversation', 'romantic', 'courtyard'].some((tag) => tags.has(tag));
    const social = signals.socialDensity >= 0.6 ||
        ['social', 'cocktails', 'lively', 'buzzing', 'live', 'music', 'jazz'].some((tag) => tags.has(tag));
    const destination = signals.destinationFactor >= 0.58 ||
        signals.highlightTier === 1 ||
        ['destination', 'signature', 'chef-led', 'tasting'].some((tag) => tags.has(tag));
    const lingering = signals.lingerFactor >= 0.56 ||
        signals.durationEstimate === 'extended' ||
        signals.durationEstimate === 'event' ||
        ['lingering', 'dessert', 'tea', 'wine', 'conversation'].some((tag) => tags.has(tag));
    const quickStop = signals.durationEstimate === 'quick' ||
        ['quick-stop', 'quick-start', 'walk-up', 'grab-and-go', 'counter-service'].some((tag) => tags.has(tag));
    const experiential = signals.experientialFactor >= 0.56 ||
        signals.momentIntensity.score >= 0.66 ||
        ['experiential', 'live', 'performance', 'immersive', 'tasting', 'curated'].some((tag) => tags.has(tag));
    const calm = signals.energy <= 0.46 ||
        ['quiet', 'calm', 'tea', 'dessert', 'bakery', 'low-key'].some((tag) => tags.has(tag));
    const highIntensity = signals.momentIntensity.score >= 0.72 ||
        signals.energy >= 0.72 ||
        ['high-energy', 'late-night', 'night-owl', 'buzzing', 'lively'].some((tag) => tags.has(tag));
    const lowFriction = candidate.venue.driveMinutes <= 12 ||
        ['walkable', 'easy-entry', 'quick-start', 'reservation-recommended'].some((tag) => tags.has(tag));
    const summary = [
        intimate ? 'intimate' : null,
        social ? 'social' : null,
        destination ? 'destination' : null,
        lingering ? 'lingering' : null,
        quickStop ? 'quick-stop' : null,
        experiential ? 'experiential' : null,
    ]
        .filter((value) => Boolean(value))
        .join(' | ');
    return {
        intimate,
        social,
        destination,
        lingering,
        quickStop,
        experiential,
        calm,
        highIntensity,
        lowFriction,
        summary: summary || 'neutral',
    };
}
function getStrongCurationTasteBias(persona, vibe, contractConstraints) {
    let highlightFloor = 0.62;
    let startFloor = 0.5;
    let windDownFloor = 0.5;
    if (persona === 'friends') {
        highlightFloor = 0.58;
        startFloor = 0.47;
        windDownFloor = 0.46;
    }
    else if (persona === 'family') {
        highlightFloor = 0.6;
        startFloor = 0.54;
        windDownFloor = 0.52;
    }
    if (vibe === 'lively' || vibe === 'playful') {
        highlightFloor -= 0.02;
    }
    else if (vibe === 'cozy' || vibe === 'chill') {
        highlightFloor += 0.02;
        windDownFloor += 0.02;
    }
    else if (vibe === 'cultured') {
        highlightFloor += 0.01;
    }
    if (contractConstraints) {
        if (contractConstraints.highlightPressure === 'strong') {
            highlightFloor += 0.02;
        }
        else if (contractConstraints.highlightPressure === 'distributed') {
            highlightFloor -= 0.06;
        }
        else {
            highlightFloor -= 0.01;
        }
        if (contractConstraints.peakCountModel === 'single') {
            highlightFloor += 0.02;
            windDownFloor += 0.02;
        }
        else if (contractConstraints.peakCountModel === 'multi') {
            highlightFloor -= 0.02;
            startFloor -= 0.01;
            windDownFloor -= 0.01;
        }
        else if (contractConstraints.peakCountModel === 'distributed') {
            highlightFloor -= 0.05;
            startFloor -= 0.01;
        }
        else if (contractConstraints.peakCountModel === 'cumulative') {
            startFloor += 0.01;
        }
        if (contractConstraints.requireRecoveryWindows) {
            startFloor += 0.03;
            windDownFloor += 0.04;
        }
        if (contractConstraints.requireContinuity) {
            startFloor += 0.01;
            windDownFloor += 0.01;
        }
        if (contractConstraints.windDownStrictness === 'soft_required') {
            windDownFloor += 0.03;
        }
        else if (contractConstraints.windDownStrictness === 'controlled') {
            windDownFloor += 0.01;
        }
        else {
            windDownFloor -= 0.02;
        }
        if (!contractConstraints.allowLateHighEnergy) {
            windDownFloor += 0.01;
        }
        if (contractConstraints.movementTolerance === 'contained') {
            startFloor += 0.01;
        }
    }
    const summary = `strong-curation | ${persona}/${vibe} | floors start ${formatTasteScore(startFloor)} highlight ${formatTasteScore(highlightFloor)} windDown ${formatTasteScore(windDownFloor)} | constraints ${contractConstraints
        ? `${contractConstraints.peakCountModel}/${contractConstraints.highlightPressure}/${contractConstraints.windDownStrictness}`
        : 'none'}`;
    return {
        highlightFloor: clampTasteScore(highlightFloor),
        startFloor: clampTasteScore(startFloor),
        windDownFloor: clampTasteScore(windDownFloor),
        summary,
    };
}
function deriveHighlightQualification(params) {
    const { candidate, persona, vibe, highlightFloor, contractConstraints } = params;
    const signals = candidate.taste.signals;
    const personality = buildTasteVenuePersonalityProfile(candidate);
    const tierPenalty = signals.highlightTier === 1 ? 0.08 : signals.highlightTier === 2 ? -0.04 : -0.2;
    let score = signals.roleSuitability.highlight * 0.32 +
        signals.momentIntensity.score * 0.22 +
        signals.destinationFactor * 0.16 +
        signals.experientialFactor * 0.14 +
        candidate.venue.signature.signatureScore * 0.1 +
        signals.personalityStrength * 0.06;
    score += tierPenalty;
    if (personality.destination) {
        score += 0.05;
    }
    if (personality.experiential) {
        score += 0.04;
    }
    if (personality.quickStop && !personality.destination && !personality.experiential) {
        score -= 0.24;
    }
    if (personality.lingering && persona === 'romantic') {
        score += 0.05;
    }
    if (personality.intimate && persona === 'romantic' && (vibe === 'cozy' || vibe === 'chill')) {
        score += 0.06;
    }
    if (persona === 'friends' && vibe === 'lively' && personality.social) {
        score += 0.05;
    }
    if (persona === 'family' && personality.highIntensity) {
        score -= 0.08;
    }
    if (persona === 'romantic' && vibe !== 'lively' && personality.social && !personality.intimate) {
        score -= 0.06;
    }
    if (vibe === 'lively' && personality.highIntensity) {
        score += 0.03;
    }
    if (contractConstraints) {
        if (contractConstraints.highlightPressure === 'strong' &&
            (personality.destination || personality.experiential)) {
            score += 0.05;
        }
        if (contractConstraints.highlightPressure === 'distributed' &&
            personality.destination &&
            !personality.experiential) {
            score -= 0.04;
        }
        if (contractConstraints.peakCountModel === 'single' &&
            !personality.destination &&
            !personality.intimate) {
            score -= 0.04;
        }
        if (contractConstraints.peakCountModel === 'multi' && personality.social) {
            score += 0.03;
        }
        if (contractConstraints.requireEscalation && personality.highIntensity) {
            score += 0.03;
        }
        if (!contractConstraints.allowLateHighEnergy && personality.highIntensity) {
            score -= 0.06;
        }
        if (contractConstraints.kidEngagementRequired && personality.highIntensity) {
            score -= 0.04;
        }
    }
    const normalizedScore = clampTasteScore(score);
    const passed = normalizedScore >= highlightFloor;
    const reason = passed ? 'qualified' : 'below_highlight_floor';
    return {
        score: normalizedScore,
        passed,
        reason,
        personality,
    };
}
function deriveRoleEligibility(params) {
    const { role, candidate, persona, vibe, floors, highlightQualification, contractConstraints } = params;
    const signals = candidate.taste.signals;
    const personality = highlightQualification.personality;
    const floor = role === 'start' ? floors.startFloor : role === 'windDown' ? floors.windDownFloor : floors.highlightFloor;
    if (role === 'highlight') {
        return {
            score: highlightQualification.score,
            floor,
            passed: highlightQualification.passed,
            reason: highlightQualification.reason,
        };
    }
    if (role === 'start') {
        let score = signals.roleSuitability.start * 0.58 +
            (personality.lowFriction ? 0.12 : 0) +
            (personality.quickStop ? 0.06 : 0) +
            (signals.energy <= 0.62 ? 0.05 : -0.03);
        if (personality.highIntensity) {
            score -= 0.12;
        }
        if (personality.destination && !personality.lowFriction) {
            score -= 0.06;
        }
        if (persona === 'family' && !personality.lowFriction) {
            score -= 0.08;
        }
        if (persona === 'friends' && vibe === 'lively' && personality.social) {
            score += 0.03;
        }
        if (contractConstraints?.requireContinuity && !personality.lowFriction) {
            score -= 0.06;
        }
        if (contractConstraints &&
            (contractConstraints.movementTolerance === 'contained' ||
                contractConstraints.movementTolerance === 'compressed') &&
            !personality.lowFriction) {
            score -= 0.04;
        }
        if (contractConstraints?.groupBasecampPreferred && personality.social) {
            score += 0.03;
        }
        const normalized = clampTasteScore(score);
        const passed = normalized >= floor;
        return {
            score: normalized,
            floor,
            passed,
            reason: passed ? 'qualified' : 'below_start_floor',
        };
    }
    let windDownScore = signals.roleSuitability.windDown * 0.56 +
        (personality.calm ? 0.09 : 0) +
        (personality.lingering ? 0.07 : 0) +
        (signals.energy <= 0.54 ? 0.06 : -0.02);
    if (personality.highIntensity) {
        windDownScore -= 0.16;
    }
    if (personality.quickStop && !personality.calm) {
        windDownScore -= 0.06;
    }
    if (persona === 'romantic' && (vibe === 'cozy' || vibe === 'chill') && personality.intimate) {
        windDownScore += 0.05;
    }
    if (persona === 'friends' && vibe === 'lively' && personality.social && !personality.calm) {
        windDownScore -= 0.04;
    }
    if (contractConstraints?.requireRecoveryWindows && personality.calm) {
        windDownScore += 0.05;
    }
    if (contractConstraints?.requireRecoveryWindows && !personality.calm && !personality.lingering) {
        windDownScore -= 0.06;
    }
    if (contractConstraints && !contractConstraints.allowLateHighEnergy && personality.highIntensity) {
        windDownScore -= 0.08;
    }
    if (contractConstraints?.windDownStrictness === 'soft_required' && personality.lingering) {
        windDownScore += 0.03;
    }
    const normalizedWindDown = clampTasteScore(windDownScore);
    const windDownPassed = normalizedWindDown >= floor;
    return {
        score: normalizedWindDown,
        floor,
        passed: windDownPassed,
        reason: windDownPassed ? 'qualified' : 'below_winddown_floor',
    };
}
function buildCandidateQualificationMap(params) {
    const { scoredVenues, persona, vibe, floors, contractConstraints } = params;
    const qualificationByCandidateId = {};
    for (const candidate of scoredVenues) {
        const highlightQualification = deriveHighlightQualification({
            candidate,
            persona,
            vibe,
            highlightFloor: floors.highlightFloor,
            contractConstraints,
        });
        const roleEligibility = {
            start: deriveRoleEligibility({
                role: 'start',
                candidate,
                persona,
                vibe,
                floors,
                highlightQualification,
                contractConstraints,
            }),
            highlight: deriveRoleEligibility({
                role: 'highlight',
                candidate,
                persona,
                vibe,
                floors,
                highlightQualification,
                contractConstraints,
            }),
            windDown: deriveRoleEligibility({
                role: 'windDown',
                candidate,
                persona,
                vibe,
                floors,
                highlightQualification,
                contractConstraints,
            }),
        };
        qualificationByCandidateId[candidate.candidateIdentity.candidateId] = {
            candidateId: candidate.candidateIdentity.candidateId,
            highlightQualificationScore: highlightQualification.score,
            highlightQualificationPassed: highlightQualification.passed,
            roleEligibility,
            venuePersonality: highlightQualification.personality,
        };
    }
    return qualificationByCandidateId;
}
function getCandidateQualificationForVenue(qualificationByCandidateId, candidate) {
    const byCandidate = qualificationByCandidateId[candidate.candidateIdentity.candidateId];
    if (byCandidate) {
        return byCandidate;
    }
    return Object.values(qualificationByCandidateId).find((entry) => entry.candidateId.split('::')[0] === candidate.venue.id);
}
function applyStrongCurationRoleScoreShaping(params) {
    const { candidate, qualification, rolePoolMembershipByRole } = params;
    if (!qualification) {
        return candidate;
    }
    const inStartPool = rolePoolMembershipByRole.start.has(candidate.venue.id);
    const inHighlightPool = rolePoolMembershipByRole.highlight.has(candidate.venue.id);
    const inWindDownPool = rolePoolMembershipByRole.windDown.has(candidate.venue.id);
    const startMultiplier = qualification.roleEligibility.start.passed
        ? 1 + (qualification.roleEligibility.start.score - qualification.roleEligibility.start.floor) * 0.32
        : 0.34;
    const highlightMultiplier = qualification.roleEligibility.highlight.passed
        ? 1 + (qualification.highlightQualificationScore - qualification.roleEligibility.highlight.floor) * 0.5
        : 0.16;
    const windDownMultiplier = qualification.roleEligibility.windDown.passed
        ? 1 + (qualification.roleEligibility.windDown.score - qualification.roleEligibility.windDown.floor) * 0.34
        : 0.3;
    return {
        ...candidate,
        roleScores: {
            ...candidate.roleScores,
            warmup: inStartPool
                ? clampTasteScore(candidate.roleScores.warmup * clampTasteScore(startMultiplier * 1.08))
                : clampTasteScore(candidate.roleScores.warmup * 0.18),
            peak: inHighlightPool
                ? clampTasteScore(candidate.roleScores.peak * clampTasteScore(highlightMultiplier * 1.16))
                : clampTasteScore(candidate.roleScores.peak * 0.07),
            cooldown: inWindDownPool
                ? clampTasteScore(candidate.roleScores.cooldown * clampTasteScore(windDownMultiplier * 1.09))
                : clampTasteScore(candidate.roleScores.cooldown * 0.18),
        },
    };
}
function isStrictHighlightPoolCandidate(params) {
    const { candidate, qualification, persona, vibe, thinPoolHighlightFallbackApplied, contractConstraints, } = params;
    const personality = qualification.venuePersonality;
    const signals = candidate.taste.signals;
    const highlightFloor = qualification.roleEligibility.highlight.floor;
    const strongQualification = qualification.highlightQualificationScore >= highlightFloor + 0.08;
    const exceptionalTier2 = qualification.highlightQualificationScore >= highlightFloor + 0.11 &&
        (personality.destination || personality.experiential) &&
        candidate.venue.signature.signatureScore >= 0.56;
    if (!qualification.highlightQualificationPassed || !qualification.roleEligibility.highlight.passed) {
        return false;
    }
    if (personality.quickStop && !personality.destination && !personality.experiential) {
        return false;
    }
    if (candidate.venue.signature.signatureScore < 0.48 &&
        signals.destinationFactor < 0.5 &&
        signals.experientialFactor < 0.5) {
        return false;
    }
    if (signals.highlightTier === 3) {
        if (!thinPoolHighlightFallbackApplied) {
            return false;
        }
        return strongQualification;
    }
    if (signals.highlightTier === 2 && !thinPoolHighlightFallbackApplied && !exceptionalTier2) {
        return false;
    }
    if (persona === 'romantic' && vibe === 'lively') {
        if (personality.social &&
            !personality.intimate &&
            !personality.destination &&
            qualification.highlightQualificationScore < highlightFloor + 0.1) {
            return false;
        }
    }
    if (persona === 'romantic' && (vibe === 'cozy' || vibe === 'chill')) {
        if (personality.social && !personality.intimate && !thinPoolHighlightFallbackApplied) {
            return false;
        }
        if (!personality.intimate &&
            !personality.lingering &&
            qualification.highlightQualificationScore < highlightFloor + 0.1) {
            return false;
        }
    }
    if (persona === 'family' && personality.highIntensity && !thinPoolHighlightFallbackApplied) {
        return false;
    }
    if (contractConstraints &&
        !contractConstraints.allowLateHighEnergy &&
        personality.highIntensity &&
        !thinPoolHighlightFallbackApplied) {
        return false;
    }
    if (contractConstraints?.highlightPressure === 'strong' &&
        !personality.destination &&
        !personality.experiential &&
        qualification.highlightQualificationScore <
            qualification.roleEligibility.highlight.floor + 0.08) {
        return false;
    }
    if (contractConstraints?.highlightPressure === 'distributed' &&
        personality.destination &&
        !personality.social &&
        qualification.highlightQualificationScore <
            qualification.roleEligibility.highlight.floor + 0.1) {
        return false;
    }
    return true;
}
function isStrictStartPoolCandidate(params) {
    const { candidate, qualification, persona, vibe, contractConstraints } = params;
    const personality = qualification.venuePersonality;
    if (!qualification.roleEligibility.start.passed) {
        return false;
    }
    if (personality.highIntensity) {
        return false;
    }
    if (personality.destination && !personality.lowFriction) {
        return false;
    }
    if (personality.quickStop && !personality.lowFriction) {
        return false;
    }
    if (candidate.taste.signals.highlightTier === 1 && personality.destination) {
        return false;
    }
    if (persona === 'family' && !personality.lowFriction) {
        return false;
    }
    if (persona === 'romantic' && (vibe === 'cozy' || vibe === 'chill') && !personality.intimate) {
        return false;
    }
    if (contractConstraints?.requireContinuity &&
        !personality.lowFriction &&
        qualification.roleEligibility.start.score < qualification.roleEligibility.start.floor + 0.05) {
        return false;
    }
    if (contractConstraints?.requireRecoveryWindows && personality.highIntensity) {
        return false;
    }
    return true;
}
function isStrictWindDownPoolCandidate(params) {
    const { candidate, qualification, persona, vibe, contractConstraints } = params;
    const personality = qualification.venuePersonality;
    const tags = toTagSet(candidate.venue.tags);
    if (!qualification.roleEligibility.windDown.passed) {
        return false;
    }
    if (personality.highIntensity) {
        return false;
    }
    if (tags.has('late-night') || tags.has('night-owl')) {
        return false;
    }
    if (!personality.calm &&
        !personality.lingering &&
        qualification.roleEligibility.windDown.score <
            qualification.roleEligibility.windDown.floor + 0.08) {
        return false;
    }
    if (qualification.highlightQualificationScore >= qualification.roleEligibility.highlight.floor + 0.16) {
        return false;
    }
    if (persona === 'friends' && vibe === 'lively' && personality.social && !personality.calm) {
        return false;
    }
    if (contractConstraints?.requireRecoveryWindows && !personality.calm && !personality.lingering) {
        return false;
    }
    if (contractConstraints && !contractConstraints.allowLateHighEnergy && personality.highIntensity) {
        return false;
    }
    if (contractConstraints?.windDownStrictness === 'soft_required' &&
        !personality.calm &&
        !personality.lingering) {
        return false;
    }
    return true;
}
function getCoreRolePoolCounts(scoredVenues) {
    const eligible = scoredVenues.filter((candidate) => candidate.candidateIdentity.kind !== 'moment');
    return {
        start: eligible.filter((candidate) => candidate.roleScores.warmup >= 0.44).length,
        highlight: eligible.filter((candidate) => candidate.roleScores.peak >= 0.44).length,
        windDown: eligible.filter((candidate) => candidate.roleScores.cooldown >= 0.44).length,
    };
}
function scoreSignatureHighlightShortlistCandidate(params) {
    const { candidate, qualification, persona, vibe, contractConstraints } = params;
    const signals = candidate.taste.signals;
    const personality = qualification.venuePersonality;
    const tierWeight = signals.highlightTier === 1 ? 0.08 : signals.highlightTier === 2 ? -0.02 : -0.12;
    let score = qualification.highlightQualificationScore * 0.38 +
        signals.roleSuitability.highlight * 0.16 +
        signals.momentIntensity.score * 0.13 +
        signals.destinationFactor * 0.11 +
        signals.experientialFactor * 0.1 +
        candidate.venue.signature.signatureScore * 0.08 +
        scoreAnchoredRoleFit(candidate, 'peak') * 0.04;
    score += tierWeight;
    if (personality.destination) {
        score += 0.05;
    }
    if (personality.experiential) {
        score += 0.04;
    }
    if (personality.quickStop && !personality.destination && !personality.experiential) {
        score -= 0.2;
    }
    if (candidate.venue.signature.signatureScore < 0.48 &&
        signals.destinationFactor < 0.5 &&
        signals.experientialFactor < 0.5) {
        score -= 0.12;
    }
    if (persona === 'romantic' && vibe === 'lively') {
        if (personality.intimate || personality.lingering) {
            score += 0.05;
        }
        if (personality.social && !personality.intimate && !personality.destination) {
            score -= 0.08;
        }
    }
    else if (persona === 'romantic' && (vibe === 'cozy' || vibe === 'chill')) {
        if (personality.intimate || personality.lingering) {
            score += 0.07;
        }
        if (personality.social && !personality.intimate) {
            score -= 0.12;
        }
    }
    else if (persona === 'friends' && vibe === 'lively') {
        if (personality.social || personality.highIntensity) {
            score += 0.06;
        }
    }
    else if (persona === 'family') {
        if (personality.highIntensity) {
            score -= 0.12;
        }
        if (personality.lowFriction || personality.lingering) {
            score += 0.03;
        }
    }
    if (contractConstraints) {
        if (contractConstraints.highlightPressure === 'strong' &&
            (personality.destination || personality.experiential)) {
            score += 0.04;
        }
        if (contractConstraints.highlightPressure === 'distributed' && personality.social) {
            score += 0.05;
        }
        if (!contractConstraints.allowLateHighEnergy && personality.highIntensity) {
            score -= 0.08;
        }
        if (contractConstraints.peakCountModel === 'single' && personality.quickStop) {
            score -= 0.06;
        }
    }
    return clampTasteScore(score);
}
function buildSignatureHighlightShortlist(params) {
    const { highlightPool, qualifiedHighlightPool, qualificationByCandidateId, persona, vibe, thinPoolHighlightFallbackApplied, contractConstraints, } = params;
    const sourcePool = highlightPool.length > 0 ? highlightPool : qualifiedHighlightPool;
    if (sourcePool.length === 0) {
        return {
            shortlist: [],
            fallbackToQualifiedHighlightPool: true,
        };
    }
    const scored = sourcePool
        .map((candidate) => {
        const qualification = getCandidateQualificationForVenue(qualificationByCandidateId, candidate);
        if (!qualification) {
            return undefined;
        }
        return {
            candidate,
            score: scoreSignatureHighlightShortlistCandidate({
                candidate,
                qualification,
                persona,
                vibe,
                contractConstraints,
            }),
        };
    })
        .filter((value) => Boolean(value))
        .sort((left, right) => right.score - left.score || left.candidate.venue.name.localeCompare(right.candidate.venue.name));
    if (scored.length === 0) {
        return {
            shortlist: [],
            fallbackToQualifiedHighlightPool: true,
        };
    }
    const topScore = scored[0].score;
    const dynamicThreshold = Math.max(thinPoolHighlightFallbackApplied ? 0.54 : 0.6, topScore -
        (contractConstraints?.highlightPressure === 'distributed'
            ? thinPoolHighlightFallbackApplied
                ? 0.24
                : 0.18
            : thinPoolHighlightFallbackApplied
                ? 0.18
                : 0.12));
    const targetSize = scored.length >= 18 ? 8 : scored.length >= 12 ? 6 : scored.length >= 7 ? 5 : 3;
    const shortlist = scored
        .filter((entry) => {
        const signals = entry.candidate.taste.signals;
        if (signals.highlightTier === 3 && !thinPoolHighlightFallbackApplied) {
            return false;
        }
        return entry.score >= dynamicThreshold;
    })
        .slice(0, targetSize);
    if (shortlist.length === 0) {
        const fallbackSize = Math.min(3, scored.length);
        return {
            shortlist: scored.slice(0, fallbackSize),
            fallbackToQualifiedHighlightPool: true,
        };
    }
    return {
        shortlist,
        fallbackToQualifiedHighlightPool: false,
    };
}
function buildTasteCurationDebugForArc(params) {
    const { selectedArc, qualificationByCandidateId, personaVibeTasteBiasSummary, thinPoolHighlightFallbackApplied, highlightPoolCountBefore, highlightPoolCountAfter, rolePoolCountByRoleBefore, rolePoolCountByRoleAfter, signatureHighlightShortlistCount, signatureHighlightShortlistIds, highlightShortlistScoreSummary, selectedHighlightFromShortlist, selectedHighlightShortlistRank, fallbackToQualifiedHighlightPool, upstreamPoolSelectionApplied, postGenerationRepairCount, rolePoolVenueIdsByRole, rolePoolVenueIdsCombined, } = params;
    const getRoleSummary = (role) => {
        const internalRole = role === 'start' ? 'warmup' : role === 'highlight' ? 'peak' : 'cooldown';
        const selectedStop = selectedArc.stops.find((stop) => stop.role === internalRole)?.scoredVenue;
        if (!selectedStop) {
            return 'n/a';
        }
        const qualification = getCandidateQualificationForVenue(qualificationByCandidateId, selectedStop);
        if (!qualification) {
            return 'n/a';
        }
        const eligibility = qualification.roleEligibility[role];
        return `${eligibility.passed ? 'pass' : 'fail'} ${formatTasteScore(eligibility.score)}/${formatTasteScore(eligibility.floor)} (${eligibility.reason})`;
    };
    const highlightStop = selectedArc.stops.find((stop) => stop.role === 'peak')?.scoredVenue;
    const highlightQualification = highlightStop
        ? getCandidateQualificationForVenue(qualificationByCandidateId, highlightStop)
        : undefined;
    return {
        highlightQualificationScore: highlightQualification?.highlightQualificationScore ?? null,
        highlightQualificationPassed: highlightQualification?.highlightQualificationPassed ?? null,
        tasteRoleEligibilityByRole: {
            start: getRoleSummary('start'),
            highlight: getRoleSummary('highlight'),
            windDown: getRoleSummary('windDown'),
        },
        personaVibeTasteBiasSummary,
        venuePersonalitySummary: highlightQualification?.venuePersonality.summary ?? 'n/a',
        thinPoolHighlightFallbackApplied,
        highlightPoolCountBefore,
        highlightPoolCountAfter,
        rolePoolCountByRoleBefore,
        rolePoolCountByRoleAfter,
        signatureHighlightShortlistCount,
        signatureHighlightShortlistIds,
        highlightShortlistScoreSummary,
        selectedHighlightFromShortlist,
        selectedHighlightShortlistRank,
        fallbackToQualifiedHighlightPool,
        upstreamPoolSelectionApplied,
        postGenerationRepairCount,
        rolePoolVenueIdsByRole,
        rolePoolVenueIdsCombined,
    };
}
function applyStrongCurationTastePass(params) {
    const { selectedArc, itinerary, scoredVenues, intentProfile, lens, contractConstraints } = params;
    const persona = intentProfile.persona ?? 'friends';
    const vibe = intentProfile.primaryAnchor;
    const baseBias = getStrongCurationTasteBias(persona, vibe, contractConstraints);
    const rolePoolCountByRoleBefore = getCoreRolePoolCounts(scoredVenues);
    const provisionalQualification = buildCandidateQualificationMap({
        scoredVenues,
        persona,
        vibe,
        floors: baseBias,
        contractConstraints,
    });
    const baseQualifiedHighlightCount = scoredVenues.filter((candidate) => {
        const qualification = getCandidateQualificationForVenue(provisionalQualification, candidate);
        return Boolean(qualification?.highlightQualificationPassed && qualification.roleEligibility.highlight.passed);
    }).length;
    const thinPoolHighlightFallbackApplied = baseQualifiedHighlightCount < 2;
    const effectiveBias = thinPoolHighlightFallbackApplied
        ? {
            ...baseBias,
            highlightFloor: Math.max(0.5, baseBias.highlightFloor - 0.08),
            summary: `${baseBias.summary} | thin-pool highlight relaxation`,
        }
        : baseBias;
    const finalQualification = buildCandidateQualificationMap({
        scoredVenues,
        persona,
        vibe,
        floors: effectiveBias,
        contractConstraints,
    });
    const baseCandidates = scoredVenues.filter((candidate) => candidate.candidateIdentity.kind !== 'moment');
    const roleCandidateWeight = (role, candidate) => {
        const qualification = getCandidateQualificationForVenue(finalQualification, candidate);
        if (!qualification) {
            return 0;
        }
        if (role === 'highlight') {
            return (qualification.highlightQualificationScore * 0.64 +
                scoreAnchoredRoleFit(candidate, 'peak') * 0.36 +
                (qualification.venuePersonality.destination ? 0.04 : 0) +
                (qualification.venuePersonality.experiential ? 0.03 : 0));
        }
        if (role === 'start') {
            return (qualification.roleEligibility.start.score * 0.48 +
                scoreAnchoredRoleFit(candidate, 'warmup') * 0.52 +
                (qualification.venuePersonality.lowFriction ? 0.04 : 0));
        }
        return (qualification.roleEligibility.windDown.score * 0.46 +
            scoreAnchoredRoleFit(candidate, 'cooldown') * 0.54 +
            (qualification.venuePersonality.calm ? 0.04 : 0) +
            (qualification.venuePersonality.lingering ? 0.03 : 0));
    };
    const sortByRoleWeight = (role) => (left, right) => roleCandidateWeight(role, right) - roleCandidateWeight(role, left) ||
        left.venue.name.localeCompare(right.venue.name);
    const strictHighlightPool = baseCandidates
        .filter((candidate) => {
        const qualification = getCandidateQualificationForVenue(finalQualification, candidate);
        if (!qualification) {
            return false;
        }
        return isStrictHighlightPoolCandidate({
            candidate,
            qualification,
            persona,
            vibe,
            thinPoolHighlightFallbackApplied,
            contractConstraints,
        });
    })
        .sort(sortByRoleWeight('highlight'));
    const relaxedHighlightPool = baseCandidates
        .filter((candidate) => {
        const qualification = getCandidateQualificationForVenue(finalQualification, candidate);
        return Boolean(qualification?.highlightQualificationPassed &&
            qualification.roleEligibility.highlight.passed);
    })
        .sort(sortByRoleWeight('highlight'));
    const strictStartPool = baseCandidates
        .filter((candidate) => {
        const qualification = getCandidateQualificationForVenue(finalQualification, candidate);
        if (!qualification) {
            return false;
        }
        return isStrictStartPoolCandidate({
            candidate,
            qualification,
            persona,
            vibe,
            contractConstraints,
        });
    })
        .sort(sortByRoleWeight('start'));
    const relaxedStartPool = baseCandidates
        .filter((candidate) => {
        const qualification = getCandidateQualificationForVenue(finalQualification, candidate);
        return Boolean(qualification?.roleEligibility.start.passed);
    })
        .sort(sortByRoleWeight('start'));
    const strictWindDownPool = baseCandidates
        .filter((candidate) => {
        const qualification = getCandidateQualificationForVenue(finalQualification, candidate);
        if (!qualification) {
            return false;
        }
        return isStrictWindDownPoolCandidate({
            candidate,
            qualification,
            persona,
            vibe,
            contractConstraints,
        });
    })
        .sort(sortByRoleWeight('windDown'));
    const relaxedWindDownPool = baseCandidates
        .filter((candidate) => {
        const qualification = getCandidateQualificationForVenue(finalQualification, candidate);
        return Boolean(qualification?.roleEligibility.windDown.passed);
    })
        .sort(sortByRoleWeight('windDown'));
    const dedupePool = (pool) => {
        const byVenueId = new Map();
        for (const candidate of pool) {
            if (!byVenueId.has(candidate.venue.id)) {
                byVenueId.set(candidate.venue.id, candidate);
            }
        }
        return [...byVenueId.values()];
    };
    const highlightPool = dedupePool(strictHighlightPool.length > 0
        ? strictHighlightPool
        : relaxedHighlightPool.slice(0, Math.max(3, relaxedHighlightPool.length)));
    const startPool = dedupePool(strictStartPool.length > 0 ? strictStartPool : relaxedStartPool.slice(0, Math.max(4, relaxedStartPool.length)));
    const windDownPool = dedupePool(strictWindDownPool.length > 0
        ? strictWindDownPool
        : relaxedWindDownPool.slice(0, Math.max(4, relaxedWindDownPool.length)));
    const rolePoolCountByRoleAfter = {
        start: startPool.length,
        highlight: highlightPool.length,
        windDown: windDownPool.length,
    };
    const shortlistBuild = buildSignatureHighlightShortlist({
        highlightPool,
        qualifiedHighlightPool: relaxedHighlightPool,
        qualificationByCandidateId: finalQualification,
        persona,
        vibe,
        thinPoolHighlightFallbackApplied,
        contractConstraints,
    });
    const signatureHighlightShortlist = shortlistBuild.shortlist;
    const signatureHighlightShortlistPool = signatureHighlightShortlist.map((entry) => entry.candidate);
    const signatureHighlightShortlistIds = signatureHighlightShortlistPool.map((candidate) => candidate.venue.id);
    const highlightShortlistScoreSummary = signatureHighlightShortlist.length > 0
        ? signatureHighlightShortlist
            .slice(0, 5)
            .map((entry) => `${entry.candidate.venue.id}:${formatTasteScore(entry.score)}`)
            .join(' | ')
        : 'n/a';
    const highlightPreferredPool = signatureHighlightShortlistPool.length > 0 ? signatureHighlightShortlistPool : highlightPool;
    let fallbackToQualifiedHighlightPool = shortlistBuild.fallbackToQualifiedHighlightPool;
    let highlightMembershipSet = new Set(highlightPreferredPool.map((candidate) => candidate.venue.id));
    const rolePoolMembershipByRole = {
        start: new Set(startPool.map((candidate) => candidate.venue.id)),
        highlight: highlightMembershipSet,
        windDown: new Set(windDownPool.map((candidate) => candidate.venue.id)),
    };
    const adjustedScoredVenues = scoredVenues.map((candidate) => applyStrongCurationRoleScoreShaping({
        candidate,
        qualification: getCandidateQualificationForVenue(finalQualification, candidate),
        rolePoolMembershipByRole,
    }));
    const crewPolicy = getCrewPolicy(intentProfile.crew);
    let nextArc = selectedArc;
    let nextItinerary = itinerary;
    let upstreamPoolSelectionApplied = false;
    let postGenerationRepairCount = 0;
    const applyRoleFromCustomPool = (role, pool, sharpenWhenPossible) => {
        const internalRole = inverseRoleProjection[role];
        const currentStop = nextArc.stops.find((stop) => stop.role === internalRole)?.scoredVenue;
        if (!currentStop) {
            return false;
        }
        if (pool.length === 0) {
            return false;
        }
        const currentScore = roleCandidateWeight(role, currentStop);
        const bestScore = roleCandidateWeight(role, pool[0]);
        const currentInPool = rolePoolMembershipByRole[role].has(currentStop.venue.id);
        const shouldTry = !currentInPool ||
            (sharpenWhenPossible && bestScore >= currentScore + 0.08) ||
            (!sharpenWhenPossible && bestScore >= currentScore + 0.12);
        if (!shouldTry) {
            return false;
        }
        for (const replacement of pool) {
            if (replacement.venue.id === currentStop.venue.id) {
                continue;
            }
            const swappedArc = swapArcStop({
                currentArc: nextArc,
                role: internalRole,
                replacement,
                intent: intentProfile,
                crewPolicy,
                lens,
            });
            if (!swappedArc) {
                continue;
            }
            const swappedItinerary = projectItinerary(swappedArc, intentProfile, lens);
            const swappedRoleStop = swappedItinerary.stops.find((stop) => stop.role === role);
            if (!swappedRoleStop || swappedRoleStop.venueId !== replacement.venue.id) {
                continue;
            }
            if (role !== 'highlight' && highlightMembershipSet.size > 0) {
                const highlightStop = swappedArc.stops.find((stop) => stop.role === 'peak')?.scoredVenue;
                if (!highlightStop || !highlightMembershipSet.has(highlightStop.venue.id)) {
                    continue;
                }
            }
            nextArc = swappedArc;
            nextItinerary = swappedItinerary;
            upstreamPoolSelectionApplied = true;
            return true;
        }
        return false;
    };
    const highlightSelectedFromPreferredPool = applyRoleFromCustomPool('highlight', highlightPreferredPool, true);
    const selectedHighlightAfterPreferred = nextArc.stops.find((stop) => stop.role === 'peak')?.scoredVenue?.venue.id;
    if (signatureHighlightShortlistPool.length > 0 &&
        (!selectedHighlightAfterPreferred || !highlightMembershipSet.has(selectedHighlightAfterPreferred))) {
        const qualifiedFallbackPool = highlightPool.length > 0 ? highlightPool : relaxedHighlightPool;
        if (qualifiedFallbackPool.length > 0) {
            fallbackToQualifiedHighlightPool = true;
            highlightMembershipSet = new Set(qualifiedFallbackPool.map((candidate) => candidate.venue.id));
            rolePoolMembershipByRole.highlight = highlightMembershipSet;
            const fallbackApplied = applyRoleFromCustomPool('highlight', qualifiedFallbackPool, true);
            if (fallbackApplied && !highlightSelectedFromPreferredPool) {
                upstreamPoolSelectionApplied = true;
            }
        }
    }
    applyRoleFromCustomPool('start', startPool, false);
    applyRoleFromCustomPool('windDown', windDownPool, false);
    const maybeRepairRole = (role) => {
        const internalRole = inverseRoleProjection[role];
        const currentStop = nextArc.stops.find((stop) => stop.role === internalRole)?.scoredVenue;
        if (!currentStop) {
            return;
        }
        const currentQualification = getCandidateQualificationForVenue(finalQualification, currentStop);
        const currentPass = role === 'highlight'
            ? Boolean(currentQualification?.highlightQualificationPassed &&
                currentQualification.roleEligibility.highlight.passed)
            : Boolean(currentQualification?.roleEligibility[role].passed);
        if (currentPass) {
            return;
        }
        const roleScoreKey = roleToInternalRole[role];
        const highlightRepairPool = signatureHighlightShortlistPool.length > 0 && !fallbackToQualifiedHighlightPool
            ? signatureHighlightShortlistPool
            : highlightPool;
        const replacements = (role === 'highlight' ? highlightRepairPool : adjustedScoredVenues)
            .filter((candidate) => candidate.candidateIdentity.kind !== 'moment')
            .filter((candidate) => candidate.venue.id !== currentStop.venue.id)
            .filter((candidate) => {
            if (role === 'highlight') {
                return highlightMembershipSet.has(candidate.venue.id);
            }
            const qualification = getCandidateQualificationForVenue(finalQualification, candidate);
            return Boolean(qualification?.roleEligibility[role].passed);
        })
            .sort((left, right) => {
            const leftQualification = getCandidateQualificationForVenue(finalQualification, left);
            const rightQualification = getCandidateQualificationForVenue(finalQualification, right);
            const leftRoleWeight = role === 'highlight'
                ? (leftQualification?.highlightQualificationScore ?? 0) * 0.55 +
                    scoreAnchoredRoleFit(left, roleScoreKey) * 0.45
                : (leftQualification?.roleEligibility[role].score ?? 0) * 0.4 +
                    scoreAnchoredRoleFit(left, roleScoreKey) * 0.6;
            const rightRoleWeight = role === 'highlight'
                ? (rightQualification?.highlightQualificationScore ?? 0) * 0.55 +
                    scoreAnchoredRoleFit(right, roleScoreKey) * 0.45
                : (rightQualification?.roleEligibility[role].score ?? 0) * 0.4 +
                    scoreAnchoredRoleFit(right, roleScoreKey) * 0.6;
            return rightRoleWeight - leftRoleWeight || left.venue.name.localeCompare(right.venue.name);
        });
        for (const replacement of replacements) {
            const swappedArc = swapArcStop({
                currentArc: nextArc,
                role: internalRole,
                replacement,
                intent: intentProfile,
                crewPolicy,
                lens,
            });
            if (!swappedArc) {
                continue;
            }
            const swappedItinerary = projectItinerary(swappedArc, intentProfile, lens);
            const swappedRoleStop = swappedItinerary.stops.find((stop) => stop.role === role);
            if (!swappedRoleStop || swappedRoleStop.venueId !== replacement.venue.id) {
                continue;
            }
            if (role !== 'highlight') {
                const highlightStop = swappedArc.stops.find((stop) => stop.role === 'peak')?.scoredVenue;
                if (!highlightStop || !highlightMembershipSet.has(highlightStop.venue.id)) {
                    continue;
                }
            }
            nextArc = swappedArc;
            nextItinerary = swappedItinerary;
            postGenerationRepairCount += 1;
            break;
        }
    };
    maybeRepairRole('highlight');
    maybeRepairRole('start');
    maybeRepairRole('windDown');
    const selectedHighlightVenueId = nextArc.stops.find((stop) => stop.role === 'peak')?.scoredVenue?.venue.id ?? null;
    const shortlistRankByVenueId = new Map(signatureHighlightShortlistPool.map((candidate, index) => [candidate.venue.id, index + 1]));
    const selectedHighlightFromShortlist = Boolean(selectedHighlightVenueId && shortlistRankByVenueId.has(selectedHighlightVenueId));
    const selectedHighlightShortlistRank = selectedHighlightVenueId
        ? shortlistRankByVenueId.get(selectedHighlightVenueId) ?? null
        : null;
    const rolePoolVenueIdsByRole = {
        start: [...rolePoolMembershipByRole.start],
        highlight: [...rolePoolMembershipByRole.highlight],
        windDown: [...rolePoolMembershipByRole.windDown],
    };
    const rolePoolVenueIdsCombined = dedupeStringIds([
        ...rolePoolVenueIdsByRole.start,
        ...rolePoolVenueIdsByRole.highlight,
        ...rolePoolVenueIdsByRole.windDown,
    ]);
    return {
        selectedArc: nextArc,
        itinerary: nextItinerary,
        scoredVenues: adjustedScoredVenues,
        qualificationByCandidateId: finalQualification,
        personaVibeTasteBiasSummary: effectiveBias.summary,
        thinPoolHighlightFallbackApplied,
        highlightPoolCountBefore: rolePoolCountByRoleBefore.highlight,
        highlightPoolCountAfter: rolePoolCountByRoleAfter.highlight,
        rolePoolCountByRoleBefore,
        rolePoolCountByRoleAfter,
        signatureHighlightShortlistCount: signatureHighlightShortlist.length,
        signatureHighlightShortlistIds,
        highlightShortlistScoreSummary,
        selectedHighlightFromShortlist,
        selectedHighlightShortlistRank,
        fallbackToQualifiedHighlightPool,
        upstreamPoolSelectionApplied,
        postGenerationRepairCount,
        rolePoolVenueIdsByRole,
        rolePoolVenueIdsCombined,
    };
}
function assessDirectionContractBuildability(params) {
    const { expectedDirectionIdentity, scoredVenues } = params;
    const roleScoreByCoreRole = {
        start: 'warmup',
        highlight: 'peak',
        windDown: 'cooldown',
    };
    const candidatePoolSufficiencyByRole = {
        start: 0,
        highlight: 0,
        windDown: 0,
    };
    const identityMatcher = expectedDirectionIdentity === 'social'
        ? isSocialSignal
        : expectedDirectionIdentity === 'exploratory'
            ? isExploratorySignal
            : isIntimateSignal;
    const identityCandidates = scoredVenues
        .filter((candidate) => hasSourceBackedIdentity(candidate))
        .filter((candidate) => hasNavigableVenueLocation(candidate))
        .filter((candidate) => identityMatcher(candidate.venue));
    ['start', 'highlight', 'windDown'].forEach((role) => {
        const roleScoreKey = roleScoreByCoreRole[role];
        candidatePoolSufficiencyByRole[role] = identityCandidates.filter((candidate) => candidate.roleScores[roleScoreKey] >= 0.44).length;
    });
    const missingRoleForContract = ['start', 'highlight', 'windDown'].find((role) => candidatePoolSufficiencyByRole[role] === 0) ?? null;
    return {
        expectedDirectionIdentity,
        contractBuildabilityStatus: missingRoleForContract ? 'thin' : 'sufficient',
        missingRoleForContract,
        candidatePoolSufficiencyByRole,
    };
}
function validateDirectionRouteContract(params) {
    const { selectedDirectionContext, selectedDirection, itinerary, buildability } = params;
    const hasHighlight = itinerary.stops.some((stop) => stop.role === 'highlight');
    const expectedDirectionIdentity = selectedDirectionContext?.identity ?? selectedDirection?.identity ?? 'exploratory';
    if (selectedDirectionContext?.identity &&
        selectedDirectionContext.identity !== expectedDirectionIdentity) {
        console.warn('[Direction Identity Mismatch]', {
            selected: selectedDirectionContext.identity,
            expected: expectedDirectionIdentity,
        });
    }
    const observedDirectionIdentity = resolveObservedDirectionIdentity(itinerary, expectedDirectionIdentity);
    if (!hasHighlight) {
        return {
            valid: false,
            generationDriftReason: 'missing highlight role in generated itinerary',
            expectedDirectionIdentity,
            observedDirectionIdentity,
            contractBuildabilityStatus: buildability.contractBuildabilityStatus,
            missingRoleForContract: buildability.missingRoleForContract,
            candidatePoolSufficiencyByRole: buildability.candidatePoolSufficiencyByRole,
            fallbackApplied: false,
        };
    }
    const identityMismatch = observedDirectionIdentity !== expectedDirectionIdentity;
    if (identityMismatch) {
        if (buildability.contractBuildabilityStatus === 'thin') {
            return {
                valid: true,
                generationDriftReason: 'thin_pool_identity_relaxation',
                expectedDirectionIdentity,
                observedDirectionIdentity,
                contractBuildabilityStatus: buildability.contractBuildabilityStatus,
                missingRoleForContract: buildability.missingRoleForContract,
                candidatePoolSufficiencyByRole: buildability.candidatePoolSufficiencyByRole,
                fallbackApplied: true,
            };
        }
        return {
            valid: false,
            generationDriftReason: 'identity_mismatch',
            expectedDirectionIdentity,
            observedDirectionIdentity,
            contractBuildabilityStatus: buildability.contractBuildabilityStatus,
            missingRoleForContract: buildability.missingRoleForContract,
            candidatePoolSufficiencyByRole: buildability.candidatePoolSufficiencyByRole,
            fallbackApplied: false,
        };
    }
    return {
        valid: true,
        generationDriftReason: null,
        expectedDirectionIdentity,
        observedDirectionIdentity,
        contractBuildabilityStatus: buildability.contractBuildabilityStatus,
        missingRoleForContract: buildability.missingRoleForContract,
        candidatePoolSufficiencyByRole: buildability.candidatePoolSufficiencyByRole,
        fallbackApplied: false,
    };
}
function normalizeSwapToken(value) {
    return value?.trim().toLowerCase() ?? '';
}
function getStopIntensity(stop) {
    if (!stop) {
        return 'medium';
    }
    const tags = toTagSet(stop.tags);
    if (tags.has('late-night') ||
        tags.has('night-owl') ||
        tags.has('high-energy') ||
        tags.has('buzzing')) {
        return 'high';
    }
    if (stop.category === 'live_music' ||
        stop.category === 'event' ||
        ['live', 'music', 'jazz', 'performance'].some((tag) => tags.has(tag))) {
        return 'high';
    }
    if (stop.category === 'cafe' ||
        stop.category === 'dessert' ||
        stop.category === 'park' ||
        ['quiet', 'cozy', 'tea', 'conversation', 'walk-up'].some((tag) => tags.has(tag))) {
        return 'low';
    }
    return 'medium';
}
function toIntensityRank(intensity) {
    if (intensity === 'low') {
        return 1;
    }
    if (intensity === 'medium') {
        return 2;
    }
    return 3;
}
function getStopInvariantTraits(stop) {
    const traits = new Set();
    const tags = toTagSet(stop.tags);
    const intensity = getStopIntensity(stop);
    if (stop.driveMinutes <= 10 ||
        stop.category === 'cafe' ||
        stop.category === 'dessert' ||
        ['quick-start', 'walk-up', 'coffee', 'tea-room'].some((tag) => tags.has(tag))) {
        traits.add('low_friction');
    }
    if (stop.driveMinutes <= 16) {
        traits.add('continuity');
    }
    if (stop.category === 'live_music' ||
        stop.category === 'event' ||
        stop.category === 'bar' ||
        ['jazz', 'performance', 'chef-led', 'tasting', 'signature', 'cocktails', 'social'].some((tag) => tags.has(tag))) {
        traits.add('centerpiece');
    }
    if (stop.category === 'bar' ||
        ['social', 'cocktails', 'live', 'music', 'lively'].some((tag) => tags.has(tag))) {
        traits.add('social');
    }
    if (stop.category === 'museum' ||
        stop.category === 'activity' ||
        ['culture', 'gallery', 'curated'].some((tag) => tags.has(tag))) {
        traits.add('cultural');
    }
    if (stop.category === 'cafe' ||
        stop.category === 'dessert' ||
        stop.category === 'park' ||
        ['buffer', 'transition', 'coffee', 'pastry'].some((tag) => tags.has(tag))) {
        traits.add('buffer');
    }
    if (stop.category === 'dessert' ||
        ['quiet', 'cozy', 'tea', 'conversation', 'wind-down', 'dessert'].some((tag) => tags.has(tag))) {
        traits.add('settling');
        traits.add('calm');
    }
    if (intensity === 'high' ||
        ['late-night', 'night-owl', 'high-energy', 'buzzing', 'lively'].some((tag) => tags.has(tag))) {
        traits.add('lively');
    }
    if (tags.has('late-night') || tags.has('night-owl')) {
        traits.add('late_night');
    }
    if (['explore', 'experimental', 'creative', 'unexpected', 'adventure'].some((tag) => tags.has(tag))) {
        traits.add('contrast');
    }
    if (traits.has('social') ||
        traits.has('cultural') ||
        traits.has('calm') ||
        traits.has('buffer')) {
        traits.add('continuity');
    }
    return traits;
}
function getRoleInvariantProfileForSwap(role, contract) {
    if (role === 'start') {
        return contract.roleInvariants.start;
    }
    if (role === 'highlight') {
        return contract.roleInvariants.highlight;
    }
    if (role === 'windDown') {
        return contract.roleInvariants.windDown;
    }
    const roleToken = role;
    if (roleToken === 'surprise') {
        return contract.roleInvariants.surprise;
    }
    if (roleToken === 'support') {
        return contract.roleInvariants.support;
    }
    return undefined;
}
function formatRoleInvariantSummary(profile) {
    if (!profile) {
        return 'n/a';
    }
    const required = profile.requiredTraits.join('+') || 'none';
    const forbidden = profile.forbiddenTraits.join('+') || 'none';
    const minIntensity = profile.minRelativeIntensity ?? 'none';
    const maxIntensity = profile.maxRelativeIntensity ?? 'none';
    return `req:${required} | forbid:${forbidden} | min:${minIntensity} | max:${maxIntensity} | weak:${String(profile.allowSwapToWeaker)} | esc:${String(profile.allowEscalation)}`;
}
function evaluateHardStructuralSwapCompatibility(params) {
    const { role, targetRole, targetStopIndex, hasTargetSlotAtIndex, targetSlotRoleAtIndex, requestedReplacementId, candidateStop, originalStop, canonicalItinerary, baselineItinerary, routeShapeContract, requireReplacementCanonicalProvider, replacementCanonicalProviderId, } = params;
    const roleSequenceBefore = baselineItinerary.stops.map((stop) => stop.role).join('>');
    const roleSequenceAfter = canonicalItinerary.stops.map((stop) => stop.role).join('>');
    const hasHighlight = canonicalItinerary.stops.some((stop) => stop.role === 'highlight');
    const roleAllowedByShape = (role === 'start' || role === 'highlight' || role === 'windDown') &&
        routeShapeContract.mutationProfile.allowedRoles.includes(role);
    const movementLimit = Math.max(routeShapeContract.movementProfile.maxTransitionMinutes, 1);
    const movementFlexAllowance = routeShapeContract.mutationProfile.swapFlexibility === 'high'
        ? 6
        : routeShapeContract.mutationProfile.swapFlexibility === 'medium'
            ? 3
            : 0;
    const hardMovementLimit = movementLimit + movementFlexAllowance;
    const transitionsWithinShape = canonicalItinerary.transitions.every((transition) => Number.isFinite(transition.estimatedTravelMinutes) &&
        transition.estimatedTravelMinutes >= 0 &&
        transition.estimatedTravelMinutes <= movementLimit);
    const transitionsFeasible = canonicalItinerary.transitions.every((transition) => Number.isFinite(transition.estimatedTravelMinutes) &&
        transition.estimatedTravelMinutes >= 0 &&
        transition.estimatedTravelMinutes <= hardMovementLimit);
    const preservedRole = targetRole === role &&
        candidateStop.role === role &&
        canonicalItinerary.stops.some((stop) => stop.role === role) &&
        roleAllowedByShape;
    const preservedFeasibility = transitionsFeasible &&
        hasHighlight &&
        canonicalItinerary.stops.length === baselineItinerary.stops.length &&
        roleSequenceBefore === roleSequenceAfter;
    const fail = (hardRejectCode, reason, nextPreservedRole = preservedRole) => ({
        passed: false,
        reason,
        hardRejectCode,
        preservedRole: nextPreservedRole,
        preservedFeasibility,
    });
    if (!hasTargetSlotAtIndex) {
        return fail('target_slot_missing', 'Hard reject: target slot index is no longer present on canonical route.');
    }
    if (!roleAllowedByShape) {
        return fail('role_not_allowed', `Hard reject: role ${role} is not allowed for swap by route shape contract.`, false);
    }
    if (targetSlotRoleAtIndex !== role || targetRole !== role) {
        return fail('target_role_mismatch', 'Hard reject: target slot role changed during swap commit.', false);
    }
    if (targetStopIndex < 0) {
        return fail('target_stop_index_invalid', 'Hard reject: target slot index is invalid.', false);
    }
    if (!requestedReplacementId || !candidateStop.venueId) {
        return fail('replacement_identity_missing', 'Hard reject: replacement venue identity is missing.');
    }
    if (candidateStop.venueId !== requestedReplacementId) {
        return fail('replacement_identity_mismatch', 'Hard reject: requested replacement id does not match selected candidate identity.');
    }
    if (requireReplacementCanonicalProvider && !replacementCanonicalProviderId?.trim()) {
        return fail('replacement_canonical_provider_missing', 'Hard reject: replacement canonical provider identity is missing.');
    }
    if (!preservedFeasibility) {
        return fail('structural_feasibility_break', 'Hard reject: swap breaks route structural feasibility (roles/transitions/highlight).');
    }
    const roleInvariant = getRoleInvariantProfileForSwap(role, routeShapeContract);
    let preferredRoleTraitMissing = [];
    if (roleInvariant) {
        const candidateTraits = getStopInvariantTraits(candidateStop);
        const missingRequiredTraits = roleInvariant.requiredTraits.filter((trait) => !candidateTraits.has(trait));
        if (missingRequiredTraits.length > 0) {
            return fail('missing_required_traits', `Hard reject: ${role} swap misses required traits (${missingRequiredTraits.join(', ')}).`);
        }
        const forbiddenTraitsPresent = roleInvariant.forbiddenTraits.filter((trait) => candidateTraits.has(trait));
        if (forbiddenTraitsPresent.length > 0) {
            return fail('forbidden_traits_present', `Hard reject: ${role} swap includes forbidden traits (${forbiddenTraitsPresent.join(', ')}).`);
        }
        const candidateIntensity = getStopIntensity(candidateStop);
        const originalIntensity = getStopIntensity(originalStop);
        const highlightStop = getCoreStop(canonicalItinerary, 'highlight');
        const highlightIntensity = getStopIntensity(highlightStop);
        const candidateRank = toIntensityRank(candidateIntensity);
        const originalRank = toIntensityRank(originalIntensity);
        const highlightRank = toIntensityRank(highlightIntensity);
        if (!roleInvariant.allowSwapToWeaker &&
            candidateRank < originalRank &&
            (!candidateTraits.has('centerpiece') ||
                candidateTraits.has('buffer') ||
                originalRank - candidateRank >= 2)) {
            return fail('weakened_below_threshold', 'Hard reject: swap weakens this role below its required center-of-gravity threshold.');
        }
        if (!roleInvariant.allowEscalation && candidateRank > originalRank) {
            return fail('escalation_not_allowed', 'Hard reject: swap escalates this role beyond its invariant envelope.');
        }
        if (roleInvariant.minRelativeIntensity) {
            const minRank = toIntensityRank(roleInvariant.minRelativeIntensity);
            if (candidateRank < minRank) {
                return fail('below_invariant_min_intensity', `Hard reject: ${role} intensity is below invariant minimum (${roleInvariant.minRelativeIntensity}).`);
            }
        }
        if (roleInvariant.maxRelativeIntensity) {
            const maxIntensity = roleInvariant.maxRelativeIntensity;
            if ((maxIntensity === 'low' || maxIntensity === 'medium' || maxIntensity === 'high') &&
                candidateRank > toIntensityRank(maxIntensity)) {
                return fail('above_invariant_max_intensity', `Hard reject: ${role} intensity exceeds invariant maximum (${maxIntensity}).`);
            }
            if (maxIntensity === 'below_highlight' && candidateRank >= highlightRank) {
                return fail('must_remain_below_highlight', `Hard reject: ${role} must remain below highlight intensity.`);
            }
            if (maxIntensity === 'at_most_highlight' && candidateRank > highlightRank) {
                return fail('exceeds_highlight_ceiling', `Hard reject: ${role} exceeds highlight intensity ceiling.`);
            }
        }
        if (role === 'start' && candidateRank > highlightRank) {
            return fail('start_overshadows_highlight', 'Hard reject: start cannot overshadow the highlight.');
        }
        if (role === 'highlight') {
            const otherCoreStops = canonicalItinerary.stops.filter((stop) => stop.role === 'start' || stop.role === 'windDown');
            const maxOtherCoreRank = otherCoreStops.reduce((maxRank, stop) => {
                const stopRank = toIntensityRank(getStopIntensity(stop));
                return stopRank > maxRank ? stopRank : maxRank;
            }, 1);
            if (candidateRank < maxOtherCoreRank) {
                return fail('highlight_not_strongest', 'Hard reject: highlight must remain the strongest central moment.');
            }
        }
        if (role === 'windDown' && candidateRank > highlightRank) {
            return fail('winddown_above_highlight', 'Hard reject: wind-down cannot escalate above highlight intensity.');
        }
        preferredRoleTraitMissing = roleInvariant.preferredTraits.filter((trait) => !candidateTraits.has(trait));
    }
    return {
        passed: true,
        preservedRole,
        preservedFeasibility,
        transitionsWithinShape,
        preferredRoleTraitMissing,
    };
}
function evaluateSwapCompatibility(params) {
    const { role, swapSnapshot, canonicalItinerary, planSnapshot, finalRouteSnapshot, routeShapeContract, } = params;
    const preservePriority = new Set(routeShapeContract.mutationProfile.preservePriority);
    const targetSlot = finalRouteSnapshot.stops.find((stop) => stop.stopIndex === swapSnapshot.targetStopIndex);
    const hardStructural = evaluateHardStructuralSwapCompatibility({
        role,
        targetRole: swapSnapshot.targetRole,
        targetStopIndex: swapSnapshot.targetStopIndex,
        hasTargetSlotAtIndex: Boolean(targetSlot),
        targetSlotRoleAtIndex: targetSlot?.role,
        requestedReplacementId: swapSnapshot.requestedReplacementId,
        candidateStop: swapSnapshot.candidateStop,
        originalStop: swapSnapshot.originalStop,
        canonicalItinerary,
        baselineItinerary: planSnapshot.itinerary,
        routeShapeContract,
        requireReplacementCanonicalProvider: true,
        replacementCanonicalProviderId: swapSnapshot.replacementCanonical.providerRecordId,
    });
    if (!hardStructural.passed) {
        return {
            swapCompatibilityPassed: false,
            swapCompatibilityReason: hardStructural.reason,
            swapCompatibilityRejectClass: 'hard_structural',
            preservedRole: hardStructural.preservedRole,
            preservedDistrict: false,
            preservedFamily: false,
            preservedFeasibility: hardStructural.preservedFeasibility,
            softDirectionDriftDetected: false,
        };
    }
    const { preservedRole, preservedFeasibility, transitionsWithinShape, preferredRoleTraitMissing } = hardStructural;
    const preferredRoleTraitDrift = preferredRoleTraitMissing.length > 0;
    const targetSlotForSoft = targetSlot ?? finalRouteSnapshot.stops.find((stop) => stop.stopIndex === swapSnapshot.targetStopIndex);
    if (!targetSlotForSoft) {
        return {
            swapCompatibilityPassed: false,
            swapCompatibilityReason: 'Hard reject: target slot index is no longer present on canonical route.',
            swapCompatibilityRejectClass: 'hard_structural',
            preservedRole,
            preservedDistrict: false,
            preservedFamily: false,
            preservedFeasibility,
            softDirectionDriftDetected: false,
        };
    }
    const districtBefore = normalizeSwapToken(targetSlotForSoft.neighborhood);
    const districtAfter = normalizeSwapToken(swapSnapshot.replacementCanonical.neighborhood || swapSnapshot.candidateStop.neighborhood);
    const continuityMode = routeShapeContract.movementProfile.neighborhoodContinuity;
    const preservedDistrict = !districtBefore ||
        !districtAfter ||
        districtBefore === districtAfter ||
        continuityMode === 'flexible';
    const selectedFamily = planSnapshot.selectedDirectionContract.experienceFamily;
    const selectedFamilyConfidence = planSnapshot.selectedDirectionContract.familyConfidence ?? 0;
    const expectedMode = selectedFamily && selectedFamilyConfidence >= FAMILY_STORY_CONFIDENCE_MIN
        ? mapFamilyModeToNightPreviewMode(selectedFamily)
        : undefined;
    const actualMode = getNightPreviewMode(planSnapshot.selectedCluster, canonicalItinerary);
    const preservedFamily = !expectedMode || expectedMode === actualMode;
    const roleShape = role === 'start' || role === 'highlight' || role === 'windDown'
        ? routeShapeContract.roleProfile[role]
        : undefined;
    const softDirectionDriftDetected = (preservePriority.has('district') && !preservedDistrict) ||
        (preservePriority.has('family') && !preservedFamily) ||
        (preservePriority.has('movement') && !transitionsWithinShape) ||
        preferredRoleTraitDrift;
    const driftSignals = [];
    if (!preservedDistrict) {
        driftSignals.push('district');
    }
    if (!preservedFamily) {
        driftSignals.push('family');
    }
    if (!transitionsWithinShape) {
        driftSignals.push('movement');
    }
    if (preferredRoleTraitDrift) {
        driftSignals.push(`role_traits:${preferredRoleTraitMissing.join('+')}`);
    }
    if (softDirectionDriftDetected) {
        return {
            swapCompatibilityPassed: true,
            swapCompatibilityReason: `Passed swap compatibility with soft drift (${driftSignals.join(', ') || 'none'}); allowed by ${routeShapeContract.mutationProfile.swapFlexibility} swap flexibility.`,
            swapCompatibilityRejectClass: 'soft_direction_drift',
            preservedRole,
            preservedDistrict,
            preservedFamily,
            preservedFeasibility,
            softDirectionDriftDetected,
        };
    }
    return {
        swapCompatibilityPassed: true,
        swapCompatibilityReason: `Passed structural compatibility with route shape preserved (role variability ${roleShape?.variability ?? 'n/a'}).`,
        swapCompatibilityRejectClass: 'none',
        preservedRole,
        preservedDistrict,
        preservedFamily,
        preservedFeasibility,
        softDirectionDriftDetected: false,
    };
}
function getCoreStop(itinerary, role) {
    return itinerary.stops.find((stop) => stop.role === role);
}
function getRouteArcType(itinerary) {
    const hasStart = itinerary.stops.some((stop) => stop.role === 'start');
    const hasHighlight = itinerary.stops.some((stop) => stop.role === 'highlight');
    const hasWindDown = itinerary.stops.some((stop) => stop.role === 'windDown');
    if (hasHighlight && hasStart && hasWindDown) {
        return 'full';
    }
    if (hasHighlight && (hasStart || hasWindDown)) {
        return 'partial';
    }
    return 'highlightOnly';
}
function getHighlightIntensityFromArc(arc) {
    return arc.stops.find((stop) => stop.role === 'peak')?.scoredVenue.taste.signals.momentIntensity.score;
}
function getBearingsSignal(itinerary) {
    const transitions = itinerary.transitions;
    if (transitions.length === 0) {
        return 'Everything stays within a short drive.';
    }
    const maxTravel = Math.max(...transitions.map((transition) => transition.estimatedTravelMinutes));
    if (maxTravel <= 12) {
        return 'Everything stays within a short drive.';
    }
    return 'This route avoids long travel gaps.';
}
function toRadians(value) {
    return (value * Math.PI) / 180;
}
function computeDistanceKm(from, to) {
    const earthRadiusKm = 6371;
    const deltaLatitude = toRadians(to.latitude - from.latitude);
    const deltaLongitude = toRadians(to.longitude - from.longitude);
    const fromLatitude = toRadians(from.latitude);
    const toLatitude = toRadians(to.latitude);
    const haversine = Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
        Math.cos(fromLatitude) *
            Math.cos(toLatitude) *
            Math.sin(deltaLongitude / 2) *
            Math.sin(deltaLongitude / 2);
    const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    return earthRadiusKm * centralAngle;
}
function getAnchoredBearingsSignal(itinerary, canonicalStopByRole) {
    const ordered = itinerary.stops
        .map((stop) => canonicalStopByRole[stop.role])
        .filter((item) => Boolean(item));
    if (ordered.length < 2) {
        return getBearingsSignal(itinerary);
    }
    const segmentDistancesKm = [];
    for (let index = 0; index < ordered.length - 1; index += 1) {
        const from = ordered[index];
        const to = ordered[index + 1];
        if (!from || !to) {
            continue;
        }
        segmentDistancesKm.push(computeDistanceKm({ latitude: from.latitude, longitude: from.longitude }, { latitude: to.latitude, longitude: to.longitude }));
    }
    if (segmentDistancesKm.length === 0) {
        return getBearingsSignal(itinerary);
    }
    const maxSegmentDistanceKm = Math.max(...segmentDistancesKm);
    if (maxSegmentDistanceKm <= 3.6) {
        return 'Everything stays within a short drive.';
    }
    return 'This route avoids long travel gaps.';
}
function toTitleCase(value) {
    return value
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}
function getDirectionToneTag(archetype) {
    if (archetype === 'lively') {
        return 'Active';
    }
    if (archetype === 'cultural') {
        return 'Curated';
    }
    if (archetype === 'chill') {
        return 'Calm';
    }
    return 'Social';
}
function hasFlowSeed(value) {
    const normalized = value.toLowerCase();
    return normalized.includes('->') || normalized.includes('\u2192') || normalized.includes(' then ');
}
function getDirectionWhyNow(candidate) {
    const mix = candidate.derivedFrom.hospitalityMix;
    const ambiance = candidate.derivedFrom.ambianceProfile;
    const hasFlow = candidate.derivedFrom.momentSeeds.some((seed) => hasFlowSeed(seed));
    const activityMomentum = mix.activity + mix.drinks;
    const comfortSignal = mix.dining + mix.cafe;
    if (candidate.cluster === 'lively' || activityMomentum >= 0.5) {
        if (ambiance.energy === 'high' || hasFlow) {
            return 'This is where the night already has momentum.';
        }
        return 'Best when you want the night to build fast.';
    }
    if (candidate.cluster === 'chill' || comfortSignal >= 0.42) {
        if (ambiance.noise === 'low' || ambiance.energy === 'low') {
            return 'Softer, easier start without losing the night.';
        }
        return 'More neighborhood feel than main-strip energy.';
    }
    if (candidate.cluster === 'explore' || candidate.archetype === 'cultural' || mix.culture >= 0.18) {
        if (hasFlow || candidate.derivedFrom.momentPotential >= 0.7) {
            return 'More focused, intentional, and easy to commit to.';
        }
        return 'Better if you want the night to feel curated, not crowded.';
    }
    return 'A steadier option that keeps the night easy to follow.';
}
function getDirectionWhyYou(candidate, persona, vibe) {
    const mix = candidate.derivedFrom.hospitalityMix;
    const ambiance = candidate.derivedFrom.ambianceProfile;
    const highMomentum = mix.activity + mix.drinks >= 0.5 || ambiance.energy === 'high';
    const calmSignal = ambiance.energy === 'low' || ambiance.noise === 'low';
    const curatedSignal = mix.culture >= 0.2 || candidate.cluster === 'explore';
    if (vibe === 'lively') {
        if (candidate.cluster === 'lively' || highMomentum) {
            return 'Stronger social flow, fewer dead spots.';
        }
        if (candidate.cluster === 'explore' || curatedSignal) {
            return 'More focus, less wandering.';
        }
        return 'Easier pacing with fewer sharp transitions.';
    }
    if (vibe === 'cozy') {
        if (candidate.cluster === 'chill' || calmSignal) {
            return 'Less movement, more intimacy.';
        }
        if (candidate.cluster === 'explore' || curatedSignal) {
            return 'More focus, less noise.';
        }
        return 'More energy, less lingering.';
    }
    if (vibe === 'cultured') {
        if (candidate.cluster === 'explore' || curatedSignal) {
            return 'More focus, less noise.';
        }
        if (candidate.cluster === 'lively' || highMomentum) {
            return 'More energy, less wandering.';
        }
        return 'Easier pacing with fewer sharp transitions.';
    }
    if (persona === 'romantic') {
        return candidate.cluster === 'chill'
            ? 'Less movement, more intimacy.'
            : 'More energy, less wandering.';
    }
    if (persona === 'friends') {
        return candidate.cluster === 'lively'
            ? 'Stronger social flow, fewer dead spots.'
            : 'More focus, less noise.';
    }
    return candidate.cluster === 'chill'
        ? 'Easier pacing with fewer sharp transitions.'
        : 'More focus, less noise.';
}
function toProofToken(value) {
    return value
        .replace(/\s*->\s*/g, ' | ')
        .replace(/\s*\u2192\s*/g, ' | ')
        .replace(/\s+pocket$/i, '')
        .trim();
}
function toSeedProofToken(seed) {
    const normalized = seed.toLowerCase();
    if (normalized.includes('gallery')) {
        return 'Gallery stroll';
    }
    if (normalized.includes('coffee') || normalized.includes('cafe')) {
        return 'Coffee start';
    }
    if (normalized.includes('wine')) {
        return 'Wine bar';
    }
    if (normalized.includes('cocktail') || normalized.includes('bar')) {
        return 'Cocktail lane';
    }
    if (normalized.includes('dinner')) {
        return 'Dinner anchor';
    }
    if (normalized.includes('walk') || normalized.includes('stroll')) {
        return 'Walkable strip';
    }
    if (normalized.includes('late') || normalized.includes('night')) {
        return 'Late-night cluster';
    }
    if (normalized.includes('detour') || normalized.includes('playful')) {
        return 'Playful detour';
    }
    return undefined;
}
function getMixProofToken(candidate) {
    const mix = candidate.derivedFrom.hospitalityMix;
    if (mix.drinks >= 0.24) {
        return 'Wine bar pocket';
    }
    if (mix.activity >= 0.3) {
        return 'Late-night cluster';
    }
    if (mix.culture >= 0.2) {
        return 'Gallery pocket';
    }
    if (mix.cafe >= 0.2) {
        return 'Cafe pocket';
    }
    if (mix.dining >= 0.24) {
        return 'Dinner pocket';
    }
    return 'Neighborhood pocket';
}
function getDirectionProofLine(candidate, selected) {
    if (selected && candidate.nearbyExamples.length > 0) {
        return candidate.nearbyExamples.slice(0, 2).join(' · ');
    }
    const seedTokens = candidate.derivedFrom.momentSeeds
        .map((seed) => toSeedProofToken(seed))
        .filter((seed) => Boolean(seed));
    const mixToken = getMixProofToken(candidate);
    if (!selected) {
        const compact = Array.from(new Set([mixToken, ...seedTokens])).slice(0, 2);
        return compact.join(' · ');
    }
    const highlightTokens = candidate.highlights
        .map((value) => toProofToken(value))
        .filter((value) => value.length > 0);
    if (highlightTokens.length > 0) {
        return highlightTokens.slice(0, 2).join(' · ');
    }
    return toProofToken(candidate.pocketLabel);
}
const FAMILY_STORY_CONFIDENCE_MIN = 0.58;
const NIGHT_PREVIEW_HIGHLIGHT_DOMINANCE_THRESHOLD = 0.72;
function getStoryFamilyMode(candidate) {
    return candidate.familyConfidence >= FAMILY_STORY_CONFIDENCE_MIN
        ? candidate.experienceFamily
        : 'neutral';
}
function getStorySpineStartLine(candidate, vibe) {
    const familyMode = getStoryFamilyMode(candidate);
    const ambiance = candidate.derivedFrom.ambianceProfile;
    const mix = candidate.derivedFrom.hospitalityMix;
    if (familyMode === 'ambient') {
        return 'Calmer entry that unfolds slowly into the area.';
    }
    if (familyMode === 'ritual') {
        return 'Step into a structured opening with clear pacing.';
    }
    if (familyMode === 'indulgent') {
        return 'Slower opening that settles around richer stops.';
    }
    if (familyMode === 'eventful') {
        return 'Quick start that builds toward punctuated peaks.';
    }
    if (familyMode === 'social') {
        return 'Warm social entry with early momentum.';
    }
    if (familyMode === 'cultural') {
        return 'Intentional opening that sets a focused route.';
    }
    if (familyMode === 'playful' || familyMode === 'exploratory') {
        return 'Curious opener with room for a small detour.';
    }
    if (vibe === 'cozy' || ambiance.noise === 'low') {
        return 'Low-friction start with calmer movement.';
    }
    if (mix.activity + mix.drinks >= 0.52 || vibe === 'lively') {
        return 'Fast opening that gets momentum going early.';
    }
    return 'Balanced opening that keeps pacing easy.';
}
function getStorySpineHighlightLine(candidate) {
    const familyMode = getStoryFamilyMode(candidate);
    const mix = candidate.derivedFrom.hospitalityMix;
    const momentPotential = candidate.derivedFrom.momentPotential;
    if (familyMode === 'eventful') {
        return 'Middle stretch peaks through bursty high-energy moments.';
    }
    if (familyMode === 'cultural') {
        return 'Centerpoint stays focused around culture-forward anchors.';
    }
    if (familyMode === 'ritual') {
        return 'Middle beat lands as a clean, stepwise centerpiece.';
    }
    if (familyMode === 'indulgent') {
        return 'Central moment centers on a deeper destination stop.';
    }
    if (familyMode === 'ambient' || familyMode === 'intimate') {
        return 'Center beat stays warm and contained, not chaotic.';
    }
    if (familyMode === 'social') {
        return 'Middle section carries a stronger social peak.';
    }
    if (familyMode === 'playful') {
        return 'Middle section leans into activity-forward switch-ups.';
    }
    if (familyMode === 'exploratory') {
        return 'Middle stretch layers varied signals into one focal moment.';
    }
    if (momentPotential >= 0.7 || mix.activity + mix.drinks >= 0.5) {
        return 'Middle stretch becomes the strongest momentum point.';
    }
    return 'Middle beat stays steady as the route center.';
}
function getStorySpineWindDownLine(candidate) {
    const familyMode = getStoryFamilyMode(candidate);
    const ambiance = candidate.derivedFrom.ambianceProfile;
    if (familyMode === 'eventful' || familyMode === 'social') {
        return 'Finish tapers from peak energy into a cleaner close.';
    }
    if (familyMode === 'ritual') {
        return 'Finish lands predictably with minimal transition friction.';
    }
    if (familyMode === 'ambient' || familyMode === 'intimate') {
        return 'Finish settles into a quieter, lower-noise close.';
    }
    if (familyMode === 'indulgent') {
        return 'Finish slows so the closing stop can linger naturally.';
    }
    if (familyMode === 'cultural') {
        return 'Finish eases out without losing the intentional flow.';
    }
    if (familyMode === 'playful' || familyMode === 'exploratory') {
        return 'Finish settles after variety without abrupt drop-offs.';
    }
    if (ambiance.noise === 'low' || ambiance.energy === 'low') {
        return 'Finish stays low-friction and easy to land.';
    }
    return 'Finish resolves with a clean pacing drop.';
}
function getStorySpineWhyThisWorksLine(candidate) {
    const familyMode = getStoryFamilyMode(candidate);
    if (familyMode === 'eventful') {
        return 'Built for a quick build, punctuated peak, and controlled landing.';
    }
    if (familyMode === 'social') {
        return 'Built for social momentum, a clear middle peak, and clean finish.';
    }
    if (familyMode === 'ritual') {
        return 'Designed to progress cleanly with a strong central moment.';
    }
    if (familyMode === 'indulgent') {
        return 'Built around a richer center with slower, deliberate pacing.';
    }
    if (familyMode === 'ambient' || familyMode === 'intimate') {
        return 'Built for a calm build, contained middle, and soft finish.';
    }
    if (familyMode === 'cultural') {
        return 'Designed for focused progression with an intentional center.';
    }
    if (familyMode === 'playful' || familyMode === 'exploratory') {
        return 'Built for varied progression with a clear middle beat.';
    }
    return 'Built for steady progression with a strong central moment.';
}
function getDirectionTrajectoryHint(candidate, vibe) {
    const familyMode = getStoryFamilyMode(candidate);
    const mix = candidate.derivedFrom.hospitalityMix;
    const ambiance = candidate.derivedFrom.ambianceProfile;
    if (familyMode === 'eventful') {
        return 'a fast build toward punctuated peaks.';
    }
    if (familyMode === 'social') {
        return 'an energetic build toward a social middle.';
    }
    if (familyMode === 'ritual') {
        return 'a structured route with a clear central beat.';
    }
    if (familyMode === 'indulgent') {
        return 'a slower arc centered on richer stops.';
    }
    if (familyMode === 'ambient' || familyMode === 'intimate') {
        return 'a softer arc with a calmer, contained middle.';
    }
    if (familyMode === 'cultural') {
        return 'an intentional progression toward a focused center.';
    }
    if (familyMode === 'playful' || familyMode === 'exploratory') {
        return 'a varied arc that still lands cleanly.';
    }
    if (vibe === 'cozy' || ambiance.noise === 'low') {
        return 'a lower-friction arc with calmer pacing.';
    }
    if (mix.activity + mix.drinks >= 0.5 || vibe === 'lively') {
        return 'a quicker build toward a stronger middle.';
    }
    return 'a steady arc with clear pacing.';
}
function getKnownForLine(stop) {
    const priorityTags = stop.tags.filter((tag) => ['jazz', 'cocktails', 'wine', 'dessert', 'chef-led', 'tasting', 'speakeasy', 'tea'].includes(tag.toLowerCase()));
    const tags = (priorityTags.length > 0 ? priorityTags : stop.tags).slice(0, 2);
    if (tags.length > 0) {
        return `Known for ${tags.map((tag) => toTitleCase(tag)).join(' and ')}.`;
    }
    if (stop.subcategory) {
        return `Known for its ${toTitleCase(stop.subcategory)} focus.`;
    }
    return `Known for a strong local fit in ${stop.neighborhood}.`;
}
function toTagSet(tags) {
    return new Set(tags.map((tag) => tag.toLowerCase()));
}
function getAlternativeDescriptor(candidate, options) {
    const tags = toTagSet(candidate.venue.tags);
    let baseDescriptor = 'different vibe';
    if (['intimate', 'quiet', 'cozy', 'conversation', 'tea-room'].some((tag) => tags.has(tag))) {
        baseDescriptor = 'more intimate';
    }
    else if (['live', 'jazz', 'music', 'social', 'cocktails', 'late-night'].some((tag) => tags.has(tag))) {
        baseDescriptor = 'more lively';
    }
    else if (['dessert', 'gelato', 'ice-cream', 'tea', 'pastry'].some((tag) => tags.has(tag))) {
        baseDescriptor = 'slower pace';
    }
    else if (candidate.venue.category === 'museum' || candidate.venue.category === 'event') {
        baseDescriptor = 'slower pace';
    }
    else if (candidate.venue.category === 'park') {
        baseDescriptor = 'more open-air';
    }
    else if (candidate.venue.driveMinutes <= 8) {
        baseDescriptor = 'closer, easier stop';
    }
    const role = options?.role;
    if (!role) {
        return baseDescriptor;
    }
    if (role === 'start') {
        if (baseDescriptor === 'more lively') {
            return 'faster opener';
        }
        if (baseDescriptor === 'more intimate' || baseDescriptor === 'slower pace') {
            return 'easier opener';
        }
        if (baseDescriptor === 'closer, easier stop') {
            return 'lower-friction opener';
        }
        return 'different opening tone';
    }
    if (role === 'highlight') {
        if (options?.contractConstraints?.peakCountModel === 'distributed') {
            return baseDescriptor === 'more lively' ? 'distributed social peak' : 'distributed peak option';
        }
        if (baseDescriptor === 'more lively') {
            return 'stronger center';
        }
        if (baseDescriptor === 'more intimate') {
            return 'softer center';
        }
        if (baseDescriptor === 'slower pace') {
            return 'steadier center';
        }
        if (baseDescriptor === 'closer, easier stop') {
            return 'tighter center';
        }
        return 'different center read';
    }
    if (role === 'windDown') {
        if (baseDescriptor === 'more lively') {
            return 'later-energy landing';
        }
        if (baseDescriptor === 'more intimate' || baseDescriptor === 'slower pace') {
            return 'steadier landing';
        }
        if (baseDescriptor === 'closer, easier stop') {
            return 'easier landing';
        }
        return 'different landing style';
    }
    return baseDescriptor;
}
function evaluateSwapCandidateDisplayPrefilter(params) {
    const { role, originalStop, candidateStop, candidateHasCanonicalIdentity, swappedItinerary, routeShapeContract, baselineItinerary, targetStopIndex, targetRole, hasTargetSlotAtIndex, targetSlotRoleAtIndex, requestedReplacementId, } = params;
    if (!candidateHasCanonicalIdentity) {
        return {
            passes: false,
            reason: 'canonical_identity_missing',
        };
    }
    if (!routeShapeContract || !baselineItinerary) {
        return { passes: true };
    }
    const hardStructural = evaluateHardStructuralSwapCompatibility({
        role,
        targetRole,
        targetStopIndex,
        hasTargetSlotAtIndex,
        targetSlotRoleAtIndex,
        requestedReplacementId,
        candidateStop,
        originalStop,
        canonicalItinerary: swappedItinerary,
        baselineItinerary,
        routeShapeContract,
        requireReplacementCanonicalProvider: false,
    });
    if (!hardStructural.passed) {
        return {
            passes: false,
            reason: hardStructural.hardRejectCode,
        };
    }
    return { passes: true };
}
function getRoleAlternatives(stop, scoredVenues, itineraryStops, currentArc, intent, lens, options) {
    const role = roleToInternalRole[stop.role];
    const usedVenueIds = new Set(itineraryStops.map((item) => item.venueId));
    const currentVenueId = stop.venueId;
    const crewPolicy = getCrewPolicy(intent.crew);
    const projectionByVenueId = new Map();
    const targetRouteStop = options?.finalRouteSnapshot?.stops.find((routeStop) => routeStop.role === stop.role) ??
        options?.finalRouteSnapshot?.stops.find((routeStop) => routeStop.sourceStopId === stop.id || routeStop.venueId === stop.venueId);
    const baselineTargetStopIndex = targetRouteStop?.stopIndex ??
        options?.baselineItinerary?.stops.findIndex((itineraryStop) => itineraryStop.role === stop.role &&
            (itineraryStop.id === stop.id || itineraryStop.venueId === stop.venueId)) ??
        -1;
    const hasTargetSlotAtIndex = baselineTargetStopIndex >= 0;
    const targetSlotRoleAtIndex = targetRouteStop?.role ??
        (hasTargetSlotAtIndex
            ? options?.baselineItinerary?.stops[baselineTargetStopIndex]?.role
            : undefined);
    const resolveProjection = (candidate) => {
        if (projectionByVenueId.has(candidate.venue.id)) {
            return projectionByVenueId.get(candidate.venue.id) ?? null;
        }
        const swappedArc = swapArcStop({
            currentArc,
            role: inverseRoleProjection[stop.role],
            replacement: candidate,
            intent,
            crewPolicy,
            lens,
        });
        if (!swappedArc) {
            projectionByVenueId.set(candidate.venue.id, null);
            return null;
        }
        const swappedItinerary = projectItinerary(swappedArc, intent, lens);
        const candidateStop = swappedItinerary.stops.find((item) => item.role === stop.role);
        if (!candidateStop) {
            projectionByVenueId.set(candidate.venue.id, null);
            return null;
        }
        const projection = {
            swappedArc,
            swappedItinerary,
            candidateStop,
        };
        projectionByVenueId.set(candidate.venue.id, projection);
        return projection;
    };
    const buildRanked = (includeUsed, minRoleScore) => scoredVenues
        .filter((candidate) => candidate.venue.id !== currentVenueId)
        .filter((candidate) => candidate.candidateIdentity.kind !== 'moment')
        .filter((candidate) => hasSourceBackedIdentity(candidate))
        .filter((candidate) => hasNavigableVenueLocation(candidate))
        .filter((candidate) => (includeUsed ? true : !usedVenueIds.has(candidate.venue.id)))
        .filter((candidate) => candidate.roleScores[role] >= minRoleScore)
        .filter((candidate) => Boolean(resolveProjection(candidate)))
        .sort((left, right) => {
        const leftProximity = 1 / (1 + Math.abs(left.venue.driveMinutes - stop.driveMinutes));
        const rightProximity = 1 / (1 + Math.abs(right.venue.driveMinutes - stop.driveMinutes));
        const leftScore = scoreAnchoredRoleFit(left, role) * 0.9 + leftProximity * 0.1;
        const rightScore = scoreAnchoredRoleFit(right, role) * 0.9 + rightProximity * 0.1;
        return rightScore - leftScore || left.venue.name.localeCompare(right.venue.name);
    });
    const strictPrimary = buildRanked(false, 0.52);
    const strictFallback = buildRanked(true, 0.52);
    const relaxedPrimary = buildRanked(false, 0.44);
    const relaxedFallback = buildRanked(true, 0.44);
    const combined = [...strictPrimary, ...strictFallback, ...relaxedPrimary, ...relaxedFallback];
    const uniqueCandidates = [];
    const seenVenueIds = new Set();
    for (const candidate of combined) {
        if (seenVenueIds.has(candidate.venue.id)) {
            continue;
        }
        seenVenueIds.add(candidate.venue.id);
        if (stop.role === 'highlight' && !isCommittedHighlightCandidateAnchored(candidate)) {
            continue;
        }
        uniqueCandidates.push(candidate);
    }
    const beforeCount = uniqueCandidates.length;
    let canonicalIdentityResolvedCount = 0;
    let canonicalIdentityMissingCount = 0;
    const prefilteredSwapCandidateIds = [];
    const prefilterRejectReasonSummary = [];
    const filteredCandidates = [];
    for (const candidate of uniqueCandidates) {
        const projection = resolveProjection(candidate);
        if (!projection) {
            prefilteredSwapCandidateIds.push(candidate.venue.id);
            if (prefilterRejectReasonSummary.length < 4) {
                prefilterRejectReasonSummary.push(`${candidate.venue.id}: no swap projection`);
            }
            continue;
        }
        const directCanonical = resolveCanonicalPlanningStopIdentityFromScoredVenue(projection.candidateStop, candidate);
        const cachedCanonical = options?.canonicalSwapIdentityByVenueId?.[candidate.venue.id];
        const candidateHasCanonicalIdentity = Boolean(directCanonical || cachedCanonical);
        if (candidateHasCanonicalIdentity) {
            canonicalIdentityResolvedCount += 1;
        }
        else {
            canonicalIdentityMissingCount += 1;
        }
        const prefilter = evaluateSwapCandidateDisplayPrefilter({
            role: stop.role,
            originalStop: stop,
            candidateStop: projection.candidateStop,
            candidateHasCanonicalIdentity,
            swappedItinerary: projection.swappedItinerary,
            routeShapeContract: options?.routeShapeContract,
            baselineItinerary: options?.baselineItinerary,
            targetStopIndex: baselineTargetStopIndex,
            targetRole: stop.role,
            hasTargetSlotAtIndex,
            targetSlotRoleAtIndex,
            requestedReplacementId: candidate.venue.id,
        });
        if (!prefilter.passes) {
            prefilteredSwapCandidateIds.push(candidate.venue.id);
            if (prefilter.reason && prefilterRejectReasonSummary.length < 4) {
                prefilterRejectReasonSummary.push(`${candidate.venue.id}: ${prefilter.reason}`);
            }
            continue;
        }
        filteredCandidates.push(candidate);
    }
    const alternatives = [];
    for (const candidate of filteredCandidates) {
        const planningDisplay = resolvePlanningVenueDisplayFromScoredVenue(candidate);
        alternatives.push({
            venueId: candidate.venue.id,
            name: planningDisplay.title,
            descriptor: getAlternativeDescriptor(candidate, {
                role: stop.role,
                contractConstraints: options?.contractConstraints,
            }),
        });
        if (alternatives.length >= 3) {
            break;
        }
    }
    return {
        alternatives,
        prefilterDebug: {
            swapCandidateDisplayCountBefore: beforeCount,
            swapCandidateDisplayCountAfter: filteredCandidates.length,
            canonicalIdentityResolvedCount,
            canonicalIdentityMissingCount,
            prefilteredSwapCandidateIds,
            prefilterRejectReasonSummary,
            swapDisplayUsesSharedHardStructuralCheck: true,
        },
    };
}
function getLocalSignal(stop) {
    const tags = toTagSet(stop.tags);
    if (['reservations', 'reservation-recommended', 'book-ahead', 'bookings'].some((tag) => tags.has(tag))) {
        return 'Reservations recommended.';
    }
    if (['late-night', 'night-owl', 'live', 'jazz', 'small-stage'].some((tag) => tags.has(tag))) {
        return 'Fills quickly after 9pm.';
    }
    if (['walk-up', 'quick-start', 'coffee', 'tea-room', 'dessert', 'gelato'].some((tag) => tags.has(tag))) {
        return 'Best earlier in the evening.';
    }
    if (stop.role === 'windDown') {
        return 'Best once the main moment eases out.';
    }
    if (stop.category === 'restaurant' || stop.category === 'bar' || stop.category === 'live_music') {
        return 'Reservations recommended.';
    }
    return 'Best earlier in the evening.';
}
function buildVenueLinkUrl(stop, displayNameOverride, anchorSource) {
    const providerRecordId = anchorSource?.providerRecordId?.trim();
    if (providerRecordId) {
        return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(providerRecordId)}`;
    }
    const latitude = anchorSource?.latitude;
    const longitude = anchorSource?.longitude;
    if (typeof latitude === 'number' && typeof longitude === 'number') {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
    }
    const queryName = displayNameOverride?.trim() ||
        normalizePlanningNameCandidate(anchorSource?.venueName) ||
        stop.venueName;
    const query = [queryName, stop.neighborhood, stop.city].filter(Boolean).join(', ');
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
function getRoleTravelWindow(itinerary, role) {
    const stopIndex = itinerary.stops.findIndex((stop) => stop.role === role);
    if (stopIndex < 0) {
        return 0;
    }
    const before = stopIndex > 0 ? itinerary.transitions[stopIndex - 1]?.estimatedTravelMinutes ?? 0 : 0;
    const after = stopIndex < itinerary.stops.length - 1
        ? itinerary.transitions[stopIndex]?.estimatedTravelMinutes ?? 0
        : 0;
    return before + after;
}
function getSwapTradeoffSignal(role, candidate) {
    const tags = toTagSet(candidate.tags);
    if (role === 'highlight') {
        if (candidate.category === 'museum' ||
            candidate.category === 'event' ||
            ['quiet', 'cozy', 'curated', 'gallery'].some((tag) => tags.has(tag))) {
            return 'Keeps the centerpiece, shifts to a quieter pace.';
        }
        if (candidate.category === 'live_music' ||
            ['live', 'jazz', 'social', 'cocktails', 'late-night'].some((tag) => tags.has(tag))) {
            return 'Keeps the centerpiece, shifts to a livelier middle.';
        }
        return 'Keeps the centerpiece, shifts the tone.';
    }
    if (role === 'start') {
        if (['coffee', 'tea-room', 'quiet'].some((tag) => tags.has(tag))) {
            return 'Starts with a calmer first beat.';
        }
        return 'Starts with a more active first beat.';
    }
    return 'Keeps the route shape, changes the landing style.';
}
function getSwapCascadeHint(role, candidate) {
    const tags = toTagSet(candidate.tags);
    if (role === 'highlight') {
        return ['quiet', 'cozy', 'conversation'].some((tag) => tags.has(tag))
            ? 'May soften the ending.'
            : 'May tighten the ending.';
    }
    if (role === 'start') {
        return 'May shift how quickly the middle builds.';
    }
    return 'May change how gently the night lands.';
}
function getPostSwapHintRole(role) {
    if (role === 'start') {
        return 'highlight';
    }
    if (role === 'highlight') {
        return 'windDown';
    }
    return null;
}
function getPostSwapHintText(role) {
    if (role === 'start') {
        return 'You may want to keep the middle focused.';
    }
    if (role === 'highlight') {
        return 'You may want to tighten this ending.';
    }
    return null;
}
function getHighlightTypeLabel(stop) {
    if (!stop) {
        return 'main highlight';
    }
    const tags = toTagSet(stop.tags);
    const late = tags.has('late-night') || tags.has('night-owl');
    if (tags.has('jazz')) {
        return late ? 'late jazz set' : 'jazz set';
    }
    if (stop.category === 'live_music' || ['live', 'music', 'performance', 'listening'].some((tag) => tags.has(tag))) {
        return late ? 'late live music set' : 'live music set';
    }
    if (stop.category === 'restaurant' || ['dinner', 'chef-led', 'tasting'].some((tag) => tags.has(tag))) {
        return 'dinner anchor';
    }
    if (stop.category === 'bar' || ['cocktails', 'social'].some((tag) => tags.has(tag))) {
        return 'cocktail-forward highlight';
    }
    return 'main highlight';
}
function getStartPacingLabel(stop) {
    if (!stop) {
        return 'a balanced start';
    }
    const tags = toTagSet(stop.tags);
    if (['quiet', 'cozy', 'conversation', 'coffee', 'tea-room', 'tea'].some((tag) => tags.has(tag))) {
        return 'a relaxed start';
    }
    if (['high-energy', 'buzzing', 'social', 'lively'].some((tag) => tags.has(tag))) {
        return 'an energetic start';
    }
    return 'a balanced start';
}
function getFinishPacingLabel(stop) {
    if (!stop) {
        return 'a clean finish';
    }
    const tags = toTagSet(stop.tags);
    if (['dessert', 'quiet', 'cozy', 'tea-room', 'tea'].some((tag) => tags.has(tag))) {
        return 'a clean finish';
    }
    if (['social', 'late-night', 'cocktails'].some((tag) => tags.has(tag))) {
        return 'a social finish';
    }
    return 'a clean finish';
}
function getVibeNarrativeLabel(cluster) {
    if (cluster === 'lively') {
        return 'lively';
    }
    if (cluster === 'chill') {
        return 'slower-paced';
    }
    return 'exploratory';
}
function buildSelectedDirectionPreviewContext(contract) {
    if (!contract) {
        return undefined;
    }
    return {
        directionId: contract.id,
        directionTitle: contract.label,
        pocketId: contract.pocketId,
        cluster: contract.cluster,
        experienceFamily: contract.experienceFamily,
        familyConfidence: contract.familyConfidence,
        subtitle: contract.subtitle,
        supportLine: contract.supportLine,
        whyNow: contract.whyNow,
        storySpinePreview: contract.storySpinePreview,
    };
}
function buildSelectedDirectionContract(direction) {
    if (!direction) {
        return undefined;
    }
    return {
        id: direction.id,
        label: direction.card.title,
        pocketId: direction.debugMeta?.pocketId ?? direction.id,
        pocketLabel: direction.debugMeta?.pocketLabel ?? direction.card.title,
        archetype: direction.debugMeta?.archetype ?? direction.cluster,
        identity: inferDirectionIdentityFromDirection(direction),
        subtitle: direction.card.subtitle ?? '',
        reasons: direction.card.liveSignals.items.slice(0, 3),
        cluster: direction.cluster,
        confirmation: direction.card.confirmation,
        experienceFamily: direction.debugMeta?.experienceFamily,
        familyConfidence: direction.debugMeta?.familyConfidence,
        supportLine: direction.card.supportLine,
        whyNow: direction.card.whyNow,
        laneIdentity: direction.debugMeta?.laneIdentity,
        macroLane: direction.debugMeta?.macroLane,
        storySpinePreview: direction.card.storySpinePreview,
    };
}
function buildResolvedDirectionContext(selectedDirection) {
    if (!selectedDirection) {
        return undefined;
    }
    return {
        selectedDirectionId: selectedDirection.id,
        selectedPocketId: selectedDirection.pocketId,
        label: selectedDirection.label,
        archetype: selectedDirection.archetype,
        identity: selectedDirection.identity,
    };
}
function getRouteShapeRoleProfile(role, selectedDirection, conciergeIntent, contractConstraints) {
    const { persona, pacing, socialEnergy } = conciergeIntent.experienceProfile;
    const { swapTolerance } = conciergeIntent.constraintPosture;
    const controlMode = conciergeIntent.controlPosture.mode;
    const escalationMode = contractConstraints.requireEscalation;
    const strictContinuity = contractConstraints.requireContinuity;
    const strongCenter = contractConstraints.highlightPressure === 'strong';
    const distributedCenter = contractConstraints.highlightPressure === 'distributed';
    if (role === 'start') {
        return {
            intent: 'set-tone',
            energyLevel: contractConstraints.requireRecoveryWindows || strictContinuity
                ? 'low'
                : socialEnergy === 'high' || selectedDirection.cluster === 'lively'
                    ? 'medium'
                    : 'low',
            pacing: escalationMode || pacing === 'quick' ? 'quick' : 'balanced',
            variability: controlMode === 'user_directed'
                ? 'flexible'
                : controlMode === 'assistant_led'
                    ? 'fixed'
                    : 'guided-flex',
        };
    }
    if (role === 'highlight') {
        return {
            intent: 'centerpiece',
            energyLevel: distributedCenter && !escalationMode
                ? 'medium'
                : strongCenter || escalationMode || socialEnergy === 'high'
                    ? 'high'
                    : selectedDirection.cluster === 'chill'
                        ? 'medium'
                        : 'high',
            pacing: escalationMode ? 'quick' : 'balanced',
            variability: swapTolerance === 'high'
                ? 'flexible'
                : swapTolerance === 'medium'
                    ? 'guided-flex'
                    : 'fixed',
        };
    }
    return {
        intent: 'landing',
        energyLevel: 'low',
        pacing: contractConstraints.windDownStrictness === 'soft_required' ||
            pacing === 'linger' ||
            persona === 'romantic'
            ? 'linger'
            : 'balanced',
        variability: controlMode === 'assistant_led' ? 'fixed' : 'guided-flex',
    };
}
function dedupeInvariantTraits(traits) {
    return [...new Set(traits)];
}
function buildRouteRoleInvariants(params) {
    const { selectedDirection, selectedDirectionContext, conciergeIntent, contractConstraints, arcShape, movementProfile, } = params;
    const archetypeHint = `${selectedDirectionContext.archetype} ${selectedDirectionContext.label}`.toLowerCase();
    const culturalLean = /culture|museum|gallery|ritual|explore|curated/.test(archetypeHint) ||
        selectedDirection.cluster === 'explore';
    const livelyLean = /lively|social|eventful|playful|night/.test(archetypeHint) ||
        selectedDirection.cluster === 'lively';
    const calmLean = selectedDirection.cluster === 'chill' ||
        conciergeIntent.experienceProfile.vibe === 'cozy' ||
        conciergeIntent.experienceProfile.vibe === 'chill';
    const tightMovement = movementProfile.radius === 'tight';
    const fastArc = arcShape === 'fast_open_strong_center_clean_landing';
    const startPreferred = dedupeInvariantTraits([
        contractConstraints.requireContinuity ? 'continuity' : 'contrast',
        calmLean ? 'calm' : 'social',
        tightMovement ? 'low_friction' : 'continuity',
        contractConstraints.requireRecoveryWindows ? 'buffer' : 'contrast',
    ]);
    const highlightPreferred = dedupeInvariantTraits([
        culturalLean ? 'cultural' : 'social',
        livelyLean || fastArc || contractConstraints.requireEscalation ? 'lively' : 'continuity',
        contractConstraints.highlightPressure === 'distributed' ? 'social' : 'continuity',
    ]);
    const windDownPreferred = dedupeInvariantTraits([
        'settling',
        'continuity',
        calmLean ? 'calm' : 'buffer',
        contractConstraints.requireRecoveryWindows ? 'buffer' : 'continuity',
    ]);
    return {
        start: {
            requiredTraits: dedupeInvariantTraits([
                'low_friction',
                ...(contractConstraints.requireContinuity ? ['continuity'] : []),
            ]),
            preferredTraits: startPreferred,
            forbiddenTraits: contractConstraints.allowLateHighEnergy
                ? ['centerpiece']
                : ['centerpiece', 'late_night'],
            minRelativeIntensity: 'low',
            maxRelativeIntensity: 'medium',
            allowSwapToWeaker: true,
            allowEscalation: false,
        },
        highlight: {
            requiredTraits: contractConstraints.highlightPressure === 'distributed'
                ? ['continuity']
                : ['centerpiece'],
            preferredTraits: highlightPreferred,
            forbiddenTraits: contractConstraints.highlightPressure === 'distributed' ? [] : ['buffer'],
            minRelativeIntensity: 'medium',
            maxRelativeIntensity: 'at_most_highlight',
            allowSwapToWeaker: false,
            allowEscalation: contractConstraints.requireEscalation,
        },
        windDown: {
            requiredTraits: dedupeInvariantTraits([
                'continuity',
                ...(contractConstraints.requireRecoveryWindows ? ['settling'] : []),
            ]),
            preferredTraits: windDownPreferred,
            forbiddenTraits: contractConstraints.allowLateHighEnergy
                ? ['centerpiece']
                : ['centerpiece', 'late_night'],
            minRelativeIntensity: 'low',
            maxRelativeIntensity: contractConstraints.windDownStrictness === 'flexible'
                ? 'at_most_highlight'
                : 'below_highlight',
            allowSwapToWeaker: true,
            allowEscalation: false,
        },
        surprise: {
            requiredTraits: ['contrast'],
            preferredTraits: ['continuity'],
            forbiddenTraits: ['centerpiece'],
            minRelativeIntensity: 'low',
            maxRelativeIntensity: 'at_most_highlight',
            allowSwapToWeaker: true,
            allowEscalation: false,
        },
        support: {
            requiredTraits: ['continuity'],
            preferredTraits: ['buffer', 'low_friction'],
            forbiddenTraits: ['centerpiece'],
            minRelativeIntensity: 'low',
            maxRelativeIntensity: 'medium',
            allowSwapToWeaker: true,
            allowEscalation: false,
        },
    };
}
function buildRouteShapeContract(params) {
    const { selectedDirection, selectedDirectionContext, conciergeIntent, contractConstraints } = params;
    const arcShape = contractConstraints.requireEscalation
        ? 'fast_open_strong_center_clean_landing'
        : contractConstraints.peakCountModel === 'cumulative' || selectedDirection.cluster === 'explore'
            ? 'focused_open_social_center_clean_landing'
            : 'steady_open_curated_center_soft_landing';
    const travelTolerance = conciergeIntent.constraintPosture.travelTolerance;
    const movementRadius = contractConstraints.movementTolerance === 'contained' ||
        contractConstraints.movementTolerance === 'compressed' ||
        travelTolerance === 'tight'
        ? 'tight'
        : contractConstraints.movementTolerance === 'moderate' || travelTolerance === 'balanced'
            ? 'balanced'
            : 'open';
    const movementProfile = {
        radius: movementRadius,
        maxTransitionMinutes: movementRadius === 'tight'
            ? contractConstraints.movementTolerance === 'contained'
                ? 14
                : 18
            : movementRadius === 'balanced'
                ? 24
                : 32,
        neighborhoodContinuity: contractConstraints.requireContinuity || movementRadius === 'tight'
            ? 'strict'
            : movementRadius === 'balanced'
                ? 'preferred'
                : 'flexible',
    };
    const swapFlexibility = contractConstraints
        .windDownStrictness === 'flexible'
        ? 'high'
        : contractConstraints.requireContinuity && contractConstraints.highlightPressure === 'strong'
            ? 'low'
            : conciergeIntent.constraintPosture.swapTolerance;
    const roleProfile = {
        start: getRouteShapeRoleProfile('start', selectedDirection, conciergeIntent, contractConstraints),
        highlight: getRouteShapeRoleProfile('highlight', selectedDirection, conciergeIntent, contractConstraints),
        windDown: getRouteShapeRoleProfile('windDown', selectedDirection, conciergeIntent, contractConstraints),
    };
    const roleInvariants = buildRouteRoleInvariants({
        selectedDirection,
        selectedDirectionContext,
        conciergeIntent,
        contractConstraints,
        arcShape,
        movementProfile,
    });
    const preservePriority = [
        'role',
        'feasibility',
        'movement',
    ];
    if (conciergeIntent.realityPosture.coherencePriority !== 'low' ||
        conciergeIntent.constraintPosture.structureRigidity !== 'flexible') {
        preservePriority.push('district');
    }
    if (conciergeIntent.realityPosture.coherencePriority === 'high' ||
        conciergeIntent.constraintPosture.structureRigidity === 'tight') {
        preservePriority.push('family');
    }
    return {
        id: `rshape_v1_${selectedDirectionContext.selectedDirectionId}_${conciergeIntent.id}_${contractConstraints.id}`,
        arcShape,
        roleProfile,
        roleInvariants,
        movementProfile,
        mutationProfile: {
            swapFlexibility,
            allowedRoles: ['start', 'highlight', 'windDown'],
            preservePriority,
        },
        expansionProfile: {
            supportsNearbyExtensions: true,
            preferredExpansionRole: conciergeIntent.experienceProfile.explorationTolerance === 'high' ||
                selectedDirection.cluster === 'lively'
                ? 'highlight'
                : 'windDown',
            lateNightTolerance: contractConstraints.allowLateHighEnergy ||
                conciergeIntent.experienceProfile.socialEnergy === 'high'
                ? 'high'
                : contractConstraints.requireRecoveryWindows ||
                    conciergeIntent.experienceProfile.socialEnergy === 'low'
                    ? 'low'
                    : 'medium',
        },
    };
}
function getRouteShapeHints(routeShapeContract) {
    const startPacing = routeShapeContract.roleProfile.start.pacing === 'quick' ? 'Fast open' : 'Steady open';
    const highlightEnergy = routeShapeContract.roleProfile.highlight.energyLevel === 'high'
        ? 'strong center'
        : 'curated center';
    const landingPacing = routeShapeContract.roleProfile.windDown.pacing === 'linger'
        ? 'clean landing'
        : 'soft landing';
    const movementHint = routeShapeContract.movementProfile.radius === 'tight'
        ? 'Everything stays close'
        : routeShapeContract.movementProfile.radius === 'balanced'
            ? 'Short transitions throughout'
            : 'Flexible movement envelope';
    const swapHint = routeShapeContract.mutationProfile.swapFlexibility === 'high'
        ? 'Easy to swap the centerpiece'
        : routeShapeContract.mutationProfile.swapFlexibility === 'medium'
            ? 'Swaps stay in-shape'
            : 'Swaps are tightly scoped';
    return {
        grammarHint: `${startPacing} | ${highlightEnergy} | ${landingPacing}`,
        movementHint,
        swapHint,
    };
}
function getPreviewFamilyMode(context) {
    if (!context?.experienceFamily) {
        return 'neutral';
    }
    return (context.familyConfidence ?? 0) >= FAMILY_STORY_CONFIDENCE_MIN
        ? context.experienceFamily
        : 'neutral';
}
function mapFamilyModeToNightPreviewMode(familyMode) {
    if (familyMode === 'social' || familyMode === 'eventful' || familyMode === 'playful') {
        return 'social';
    }
    if (familyMode === 'exploratory' || familyMode === 'cultural' || familyMode === 'ritual') {
        return 'exploratory';
    }
    if (familyMode === 'intimate' || familyMode === 'ambient' || familyMode === 'indulgent') {
        return 'intimate';
    }
    return undefined;
}
function getNightPreviewMode(cluster, itinerary, context) {
    const familyMode = mapFamilyModeToNightPreviewMode(getPreviewFamilyMode(context));
    if (familyMode) {
        return familyMode;
    }
    let socialScore = 0;
    let exploratoryScore = 0;
    let intimateScore = 0;
    itinerary.stops.forEach((stop) => {
        const tags = toTagSet(stop.tags);
        if (stop.category === 'live_music' ||
            stop.category === 'bar' ||
            ['live', 'music', 'jazz', 'social', 'cocktails'].some((tag) => tags.has(tag))) {
            socialScore += 1;
        }
        if (stop.category === 'museum' ||
            stop.category === 'activity' ||
            stop.category === 'park' ||
            ['gallery', 'culture', 'walking', 'walkable', 'explore'].some((tag) => tags.has(tag))) {
            exploratoryScore += 1;
        }
        if (stop.category === 'restaurant' ||
            ['quiet', 'cozy', 'conversation', 'tea', 'dessert', 'courtyard'].some((tag) => tags.has(tag))) {
            intimateScore += 1;
        }
    });
    if (socialScore > exploratoryScore && socialScore > intimateScore) {
        return 'social';
    }
    if (exploratoryScore > socialScore && exploratoryScore > intimateScore) {
        return 'exploratory';
    }
    if (intimateScore > socialScore && intimateScore > exploratoryScore) {
        return 'intimate';
    }
    if (cluster === 'lively') {
        return 'social';
    }
    if (cluster === 'explore') {
        return 'exploratory';
    }
    return 'intimate';
}
function getNightPreviewModeFromDirection(direction) {
    const family = direction.debugMeta?.experienceFamily;
    if (family === 'social' || family === 'eventful' || family === 'playful') {
        return 'social';
    }
    if (family === 'exploratory' || family === 'cultural' || family === 'ritual') {
        return 'exploratory';
    }
    if (family === 'intimate' || family === 'ambient' || family === 'indulgent') {
        return 'intimate';
    }
    if (direction.cluster === 'lively') {
        return 'social';
    }
    if (direction.cluster === 'explore') {
        return 'exploratory';
    }
    return 'intimate';
}
function extractPreviewStopNamesFromDirection(direction) {
    const source = direction.card.selectedProofLine ?? direction.card.proofLine;
    return Array.from(new Set(source
        .split(/\||\u00B7|,/)
        .map((part) => part.replace(/^includes:\s*/i, '').trim())
        .filter(Boolean)));
}
function toDirectionPreviewStops(stopNames) {
    if (stopNames.length === 0) {
        return [];
    }
    if (stopNames.length === 1) {
        return [{ role: 'highlight', name: stopNames[0] }];
    }
    if (stopNames.length === 2) {
        return [
            { role: 'start', name: stopNames[0] },
            { role: 'highlight', name: stopNames[1] },
        ];
    }
    if (stopNames.length === 3) {
        return [
            { role: 'start', name: stopNames[0] },
            { role: 'highlight', name: stopNames[1] },
            { role: 'windDown', name: stopNames[2] },
        ];
    }
    return [
        { role: 'start', name: stopNames[0] },
        { role: 'highlight', name: stopNames[1] },
        { role: 'surprise', name: stopNames[2] },
        { role: 'windDown', name: stopNames[3] },
    ];
}
function getDirectionPreviewHeadline(mode, persona) {
    if (persona === 'romantic') {
        if (mode === 'social') {
            return 'A lively plan with a strong centerpiece and softer pacing around it';
        }
        if (mode === 'exploratory') {
            return 'A relaxed plan with atmosphere and room for discovery';
        }
        return 'A slower plan built around intimate, standout moments';
    }
    if (persona === 'family') {
        if (mode === 'social') {
            return 'An easy, active plan with clear anchors from start to finish';
        }
        if (mode === 'exploratory') {
            return 'A clear, accessible plan with variety and simple pacing';
        }
        return 'A calm plan built around easy anchor stops';
    }
    if (mode === 'social') {
        return 'A lively plan that builds and keeps moving';
    }
    if (mode === 'exploratory') {
        return 'A varied plan with movement and room to explore';
    }
    return 'A steadier plan with a strong middle and easy flow';
}
function getDirectionPreviewTone(mode, persona) {
    if (persona === 'romantic') {
        if (mode === 'social') {
            return 'Stronger central energy with a more intimate pace around it.';
        }
        if (mode === 'exploratory') {
            return 'Atmospheric pacing with intentional movement between moments.';
        }
        return 'Calm pacing with room to linger at each stop.';
    }
    if (persona === 'family') {
        if (mode === 'social') {
            return 'Clear transitions and straightforward pacing across anchor stops.';
        }
        if (mode === 'exploratory') {
            return 'Accessible variety with low-friction movement.';
        }
        return 'Simple pacing with an easy, dependable finish.';
    }
    if (mode === 'social') {
        return 'Shared energy and steady movement through the middle.';
    }
    if (mode === 'exploratory') {
        return 'Variety-forward pacing with easy group flow.';
    }
    return 'Lower-key pacing with a clear center and soft finish.';
}
function buildPreviewFromDirection(direction, persona) {
    const mode = getNightPreviewModeFromDirection(direction);
    const stopNames = extractPreviewStopNamesFromDirection(direction);
    return {
        directionId: direction.id,
        headline: getDirectionPreviewHeadline(mode, persona),
        tone: getDirectionPreviewTone(mode, persona),
        stops: toDirectionPreviewStops(stopNames),
        continuityLine: 'Everything stays close and easy to move between',
    };
}
function buildPreviewFromFinalRoute(route) {
    return {
        directionId: route.selectedDirectionId,
        headline: route.routeHeadline,
        tone: route.routeSummary,
        stops: route.stops
            .slice()
            .sort((left, right) => left.stopIndex - right.stopIndex)
            .map((stop) => ({
            role: stop.role,
            name: stop.displayName,
        })),
        continuityLine: route.routeSummary,
    };
}
function buildDirectionIdentity(direction) {
    return [
        direction.id,
        direction.cluster,
        direction.card.title,
        direction.card.subtitle ?? '',
        direction.card.whyNow,
        direction.card.whyYou,
        direction.card.anchorLine ?? '',
        direction.card.supportLine ?? '',
        direction.card.proofLine,
        direction.card.selectedProofLine ?? '',
        direction.debugMeta?.experienceFamily ?? '',
        direction.debugMeta?.familyConfidence ?? '',
    ].join('|');
}
function getDirectionPreviewStopLine(stop, persona) {
    if (persona === 'family') {
        if (stop.role === 'start') {
            return `Start easy at ${stop.name} — a simple stop to ease everyone in.`;
        }
        if (stop.role === 'highlight') {
            return `Head to ${stop.name} — this is the central stop of the plan.`;
        }
        if (stop.role === 'windDown') {
            return `Wrap up at ${stop.name} — an easy place to wind down.`;
        }
        return `If you want a change, ${stop.name} is an easy detour.`;
    }
    if (persona === 'romantic') {
        if (stop.role === 'start') {
            return `Start easy at ${stop.name} — a calm opener with atmosphere.`;
        }
        if (stop.role === 'highlight') {
            return `Head to ${stop.name} — this is where the night peaks.`;
        }
        if (stop.role === 'windDown') {
            return `Wrap up at ${stop.name} — a softer place to land together.`;
        }
        return `If you want a pivot, ${stop.name} adds a flexible detour.`;
    }
    if (stop.role === 'start') {
        return `Start easy at ${stop.name} — an easy start for the group.`;
    }
    if (stop.role === 'highlight') {
        return `Head to ${stop.name} — this is where the night peaks.`;
    }
    if (stop.role === 'windDown') {
        return `Wrap up at ${stop.name} — a relaxed place to close things out.`;
    }
    return `If you want a pivot, ${stop.name} adds a flexible detour.`;
}
function getPreviewFamilyHeadline(family, cluster) {
    if (family === 'eventful') {
        return 'A punctuated night with clear peaks';
    }
    if (family === 'intimate') {
        return 'A closer, contained night with calmer pacing';
    }
    if (family === 'ritual') {
        return 'A structured night that progresses in sequence';
    }
    if (family === 'exploratory') {
        return 'A layered night with open progression';
    }
    if (family === 'indulgent') {
        return 'A richer night centered on deeper stops';
    }
    if (family === 'ambient') {
        return 'A slower night that settles into atmosphere';
    }
    if (family === 'social') {
        return 'A social night with momentum through the middle';
    }
    if (family === 'cultural') {
        return 'An intentional night with focused pacing';
    }
    if (family === 'playful') {
        return 'A curious night with activity-led contrast';
    }
    return `A ${getVibeNarrativeLabel(cluster)} night with clear pacing`;
}
function getPreviewDirectionCue(context) {
    const rawCue = context?.supportLine ?? context?.subtitle ?? context?.whyNow;
    if (!rawCue) {
        return undefined;
    }
    const normalized = rawCue.replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '');
    if (!normalized) {
        return undefined;
    }
    if (normalized.length <= 88) {
        return normalized;
    }
    return `${normalized.slice(0, 85).trimEnd()}...`;
}
function hasDenseOverlapCue(context) {
    const cue = [
        context?.supportLine,
        context?.subtitle,
        context?.whyNow,
        context?.storySpinePreview?.whyThisWorks,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    if (!cue) {
        return false;
    }
    return [
        'dense',
        'overlap',
        'compact',
        'tight',
        'walkable',
        'short transition',
        'coherent',
        'coherence',
        'support',
    ].some((token) => cue.includes(token));
}
function extractPreviewConcepts(value) {
    const normalized = value.toLowerCase();
    const concepts = new Set();
    const dictionary = [
        { key: 'fast', cues: ['fast', 'quick', 'momentum'] },
        { key: 'social', cues: ['social', 'lively'] },
        { key: 'calm', cues: ['calm', 'contained', 'softer', 'settle'] },
        { key: 'structured', cues: ['structured', 'sequence', 'intentional', 'focused'] },
        { key: 'varied', cues: ['varied', 'layered', 'exploratory'] },
        { key: 'rich', cues: ['richer', 'indulgent'] },
        { key: 'center', cues: ['central', 'center', 'anchor', 'peak'] },
    ];
    for (const entry of dictionary) {
        if (entry.cues.some((cue) => normalized.includes(cue))) {
            concepts.add(entry.key);
        }
    }
    return concepts;
}
function shouldRenderNightPreviewIdentityLine(identityLine, headline, whyLine) {
    const normalizedIdentity = identityLine.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!normalizedIdentity) {
        return false;
    }
    const normalizedHeadline = headline.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const normalizedWhy = whyLine.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (normalizedHeadline.includes(normalizedIdentity) ||
        normalizedIdentity.includes(normalizedHeadline)) {
        return false;
    }
    const identityConcepts = extractPreviewConcepts(identityLine);
    if (identityConcepts.size === 0) {
        return false;
    }
    const coveredConcepts = extractPreviewConcepts(`${headline} ${whyLine}`);
    let overlapCount = 0;
    for (const concept of identityConcepts) {
        if (coveredConcepts.has(concept)) {
            overlapCount += 1;
        }
    }
    return overlapCount / identityConcepts.size < 0.75;
}
function getNightPreviewIdentityLine(context, arc) {
    const familyMode = getPreviewFamilyMode(context);
    const highlightIntensity = getHighlightIntensityFromArc(arc) ?? 0.62;
    if (familyMode === 'eventful' || familyMode === 'social') {
        return 'A fast-moving night with a strong central moment';
    }
    if (familyMode === 'intimate' || familyMode === 'ambient') {
        return 'A calmer night with a contained central moment';
    }
    if (familyMode === 'ritual') {
        return 'A structured night that builds cleanly to center';
    }
    if (familyMode === 'cultural') {
        return 'An intentional night with a focused central moment';
    }
    if (familyMode === 'playful' || familyMode === 'exploratory') {
        return 'A varied night with a clear central anchor';
    }
    if (familyMode === 'indulgent') {
        return 'A richer night centered on one defining moment';
    }
    if (highlightIntensity >= NIGHT_PREVIEW_HIGHLIGHT_DOMINANCE_THRESHOLD) {
        return 'A quick-build night with a clear central peak';
    }
    if (highlightIntensity >= 0.62) {
        return 'A balanced night with a clear central moment';
    }
    return 'A steady night with a softer central anchor';
}
function getNightPreviewWhyLine(cluster, itinerary, context, _arc) {
    void cluster;
    void itinerary;
    void context;
    return '';
}
function getPreviewOneLiner(cluster, itinerary, context) {
    const mode = getNightPreviewMode(cluster, itinerary, context);
    if (mode === 'social') {
        return 'A lively night that builds and keeps moving';
    }
    if (mode === 'exploratory') {
        return 'A relaxed night with room to wander and discover';
    }
    return 'A slower night built around a few strong moments';
}
function getClusterInterpretation(cluster, context) {
    const familyMode = getPreviewFamilyMode(context);
    if (familyMode === 'eventful') {
        return 'Fast build with punctuated momentum and a clear central peak.';
    }
    if (familyMode === 'intimate') {
        return 'Contained progression with closer transitions and a softer landing.';
    }
    if (familyMode === 'ritual') {
        return 'Stepwise pacing with a predictable sequence into the center moment.';
    }
    if (familyMode === 'exploratory') {
        return 'Layered progression that keeps variety without losing route clarity.';
    }
    if (familyMode === 'indulgent') {
        return 'Richer middle focus with deliberate pacing around anchor-grade stops.';
    }
    if (familyMode === 'ambient') {
        return 'Atmospheric pacing that unfolds slowly and avoids abrupt transitions.';
    }
    if (familyMode === 'social') {
        return 'Social flow that builds quickly and stays active through the midpoint.';
    }
    if (familyMode === 'cultural') {
        return 'Intentional pacing with a focused center and lower chaos profile.';
    }
    if (familyMode === 'playful') {
        return 'Activity-forward pacing with controlled detours and a clear center beat.';
    }
    if (cluster === 'lively') {
        return 'Higher social momentum with a stronger midpoint.';
    }
    if (cluster === 'chill') {
        return 'Softer pacing with a steadier build into the highlight.';
    }
    return 'More exploratory pacing with contrast across stops.';
}
function getRouteThesis(cluster, itinerary, context) {
    const highlight = getCoreStop(itinerary, 'highlight');
    const waypoint = highlight ? `${highlight.venueName} (${getHighlightTypeLabel(highlight)})` : 'TBD';
    const cue = getPreviewDirectionCue(context);
    const interpretation = getClusterInterpretation(cluster, context);
    if (cue) {
        return `Interpretation: ${interpretation} Waypoint: ${waypoint}. Direction cue: ${cue}.`;
    }
    return `Interpretation: ${interpretation} Waypoint: ${waypoint}.`;
}
function getPreviewStopTexture(stop) {
    const tags = toTagSet(stop.tags);
    if (stop.category === 'live_music' ||
        ['jazz', 'live', 'music', 'performance', 'listening'].some((tag) => tags.has(tag))) {
        return 'A music-forward room';
    }
    if (['tea', 'tea-room', 'coffee', 'quiet', 'cozy', 'conversation'].some((tag) => tags.has(tag))) {
        return 'A quiet lounge setting';
    }
    if (['dessert', 'gelato', 'ice-cream', 'pastry', 'sweet'].some((tag) => tags.has(tag))) {
        return 'A gentle dessert-forward stop';
    }
    if (stop.category === 'restaurant') {
        return 'A warm dining room';
    }
    if (stop.category === 'bar') {
        return 'A cocktail-forward spot';
    }
    if (stop.category === 'museum') {
        return 'A culture-forward space';
    }
    if (stop.category === 'park') {
        return 'An open-air setting';
    }
    return 'A neighborhood venue';
}
function getRoleFamilyFraming(role, family, recoveredCentralMomentHighlight = false, dominantHighlight = false) {
    if (role === 'start') {
        if (family === 'ritual' || family === 'cultural') {
            return 'sets direction early without peaking too soon';
        }
        if (family === 'eventful' || family === 'social') {
            return 'starts light and keeps the night flexible';
        }
        if (family === 'playful' || family === 'exploratory') {
            return 'opens with optionality while keeping the route pointed';
        }
        return 'opens the night with room to settle in';
    }
    if (role === 'highlight') {
        if (recoveredCentralMomentHighlight) {
            return 'acts as the night\'s central release point';
        }
        if (dominantHighlight || family === 'eventful' || family === 'social') {
            return 'delivers the clearest payoff of the night';
        }
        if (family === 'intimate' || family === 'ambient') {
            return 'holds the route together as its central moment';
        }
        if (family === 'ritual' || family === 'cultural') {
            return 'carries the route\'s defining central release';
        }
        return 'carries the main energy the route is built around';
    }
    if (role === 'windDown') {
        if (family === 'ritual' || family === 'cultural') {
            return 'turns the pace down into a cleaner close';
        }
        if (family === 'intimate' || family === 'ambient' || family === 'indulgent') {
            return 'gives the route a softer, more settled finish';
        }
        if (family === 'eventful' ||
            family === 'social' ||
            family === 'playful' ||
            family === 'exploratory') {
            return 'lets the night taper without dropping flat';
        }
        return 'lands the route with a clean decompression';
    }
    return 'supports overall route flow';
}
function getPreviewStopDescription(stop, _context, _arc) {
    if (!stop) {
        return 'This stop keeps the night moving.';
    }
    if (stop.role === 'start') {
        return `Start easy at ${stop.venueName} — a low-key spot to ease in.`;
    }
    if (stop.role === 'highlight') {
        return `Head to ${stop.venueName} — this is where the night peaks.`;
    }
    if (stop.role === 'windDown') {
        return `Wrap up at ${stop.venueName} — a relaxed place to land softly.`;
    }
    return `If you want a pivot, ${stop.venueName} adds a flexible detour.`;
}
function getLightConstraintBadges(stop) {
    const tags = toTagSet(stop.tags);
    const badgePool = [];
    if (stop.category === 'live_music' ||
        ['jazz', 'live', 'music', 'performance', 'listening'].some((tag) => tags.has(tag))) {
        badgePool.push({ label: 'Live music', priority: 4 });
    }
    if (['late-night', 'night-owl', 'open-late', 'after-dark', 'night'].some((tag) => tags.has(tag))) {
        badgePool.push({ label: 'Late-night friendly', priority: 3 });
    }
    if (tags.has('walkable')) {
        badgePool.push({ label: 'Short walk', priority: 2 });
    }
    if (['popular', 'busy', 'crowded', 'buzzing', 'signature', 'destination'].some((tag) => tags.has(tag))) {
        badgePool.push({ label: 'Popular spot', priority: 1 });
    }
    const strongestPriority = Math.max(...badgePool.map((item) => item.priority), 0);
    const filteredPool = strongestPriority >= 3
        ? badgePool.filter((item) => item.priority > 1)
        : badgePool;
    return filteredPool
        .sort((left, right) => right.priority - left.priority || left.label.localeCompare(right.label))
        .slice(0, 2)
        .map((item) => item.label);
}
function getPreviewContinuityLine(_cluster, _itinerary, _context, _arc) {
    return 'Everything stays close and easy to move between';
}
function getNightPreviewHighlightReasonLine(arc, context) {
    const highlight = arc.stops.find((stop) => stop.role === 'peak')?.scoredVenue;
    if (!highlight) {
        return 'This anchors the experience and defines the tone.';
    }
    const familyMode = getPreviewFamilyMode(context);
    const recoveredCentralMomentHighlight = Boolean(arc.scoreBreakdown.recoveredCentralMomentHighlight);
    if (recoveredCentralMomentHighlight) {
        if (familyMode === 'eventful' || familyMode === 'social') {
            return 'This is the main moment the route builds around.';
        }
        if (familyMode === 'ritual' || familyMode === 'indulgent') {
            return 'This anchors the route as its defining central moment.';
        }
        if (familyMode === 'intimate' || familyMode === 'ambient') {
            return 'This holds the night together as a calmer anchoring moment.';
        }
        return 'This serves as the central moment the rest of the route supports.';
    }
    const dominantPeak = Boolean(arc.scoreBreakdown.highlightDominanceApplied) ||
        highlight.taste.signals.momentIntensity.score >=
            NIGHT_PREVIEW_HIGHLIGHT_DOMINANCE_THRESHOLD;
    if (dominantPeak) {
        if (familyMode === 'eventful' || familyMode === 'social') {
            return 'The night peaks here with its strongest energy.';
        }
        if (familyMode === 'ritual' || familyMode === 'indulgent') {
            return 'This anchors the experience as the defining central moment.';
        }
        if (familyMode === 'intimate' || familyMode === 'ambient') {
            return 'This is the central peak, kept strong without breaking the pacing.';
        }
        if (familyMode === 'exploratory' || familyMode === 'playful') {
            return 'This is the moment the route builds toward and resolves around.';
        }
        return 'This is the moment the night builds toward.';
    }
    if (familyMode === 'ritual' || familyMode === 'intimate' || familyMode === 'ambient') {
        return 'This becomes the central moment that the rest of the route supports.';
    }
    return 'This anchors the experience and defines the tone.';
}
function getInlineStopNarrative(stop, intent, options) {
    const localSignal = getLocalSignal(stop);
    const venueLinkUrl = buildVenueLinkUrl(stop);
    const baseTonightSignals = buildTonightSignals({
        stop,
        scoredVenue: options?.scoredVenue,
        roleTravelWindowMinutes: options?.roleTravelWindowMinutes,
        nearbySummary: options?.nearbySummary,
    });
    const stopNarrative = deriveContractAwareStopNarrative({
        stop,
        intent,
        scoredVenue: options?.scoredVenue,
        itineraryStops: options?.itineraryStops,
        experienceContract: options?.experienceContract,
        contractConstraints: options?.contractConstraints,
    });
    const flavorLine = stopNarrative.flavorTags.length > 0 ? `Flavor: ${stopNarrative.flavorTags.join(' · ')}` : undefined;
    const tonightSignals = Array.from(new Set([flavorLine, ...baseTonightSignals].filter((value) => Boolean(value)))).slice(0, 4);
    return {
        whyItFits: stopNarrative.roleMeaning,
        tonightSignals,
        aroundHereSignals: flavorLine ? [flavorLine] : undefined,
        knownFor: `${stopNarrative.whyNow} ${getKnownForLine(stop)}`,
        goodToKnow: stopNarrative.transitionLogic,
        localSignal,
        stopNarrativeWhyNow: stopNarrative.whyNow,
        stopNarrativeRoleMeaning: stopNarrative.roleMeaning,
        stopNarrativeTransitionLogic: stopNarrative.transitionLogic,
        stopNarrativeFlavorTags: stopNarrative.flavorTags,
        stopNarrativeMode: stopNarrative.mode,
        stopNarrativeSource: stopNarrative.source,
        stopFlavorSummary: stopNarrative.flavorSummary,
        stopTransitionSummary: stopNarrative.transitionSummary,
        venueLinkUrl,
    };
}
function getInlineStopDetail(stop, intent, scoredVenues, itineraryStops, currentArc, lens, options) {
    const narrative = getInlineStopNarrative(stop, intent, {
        scoredVenue: findScoredVenueForStop(stop, currentArc),
        roleTravelWindowMinutes: options?.roleTravelWindowMinutes,
        nearbySummary: options?.nearbySummary,
        itineraryStops,
        experienceContract: options?.experienceContract,
        contractConstraints: options?.contractConstraints,
    });
    const { alternatives, prefilterDebug } = getRoleAlternatives(stop, scoredVenues, itineraryStops, currentArc, intent, lens, {
        routeShapeContract: options?.routeShapeContract,
        baselineItinerary: options?.baselineItinerary,
        finalRouteSnapshot: options?.finalRouteSnapshot,
        canonicalSwapIdentityByVenueId: options?.canonicalSwapIdentityByVenueId,
        contractConstraints: options?.contractConstraints,
    });
    return {
        ...narrative,
        alternatives,
        swapCandidatePrefilterDebug: prefilterDebug,
    };
}
export function SandboxConciergePage() {
    const [city, setCity] = useState('San Jose');
    const [persona, setPersona] = useState('romantic');
    const [primaryVibe, setPrimaryVibe] = useState('lively');
    const [selectedDirectionId, setSelectedDirectionId] = useState(null);
    const [selectedIdReconciled, setSelectedIdReconciled] = useState(false);
    const [userSelectedDirection, setUserSelectedDirection] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState();
    const [plan, setPlan] = useState();
    const [finalRoute, setFinalRoute] = useState(null);
    const [routeVersion, setRouteVersion] = useState(0);
    const [hasRevealed, setHasRevealed] = useState(false);
    const [activeRole, setActiveRole] = useState('start');
    const [nearbySummaryByRole, setNearbySummaryByRole] = useState({});
    const [isLocking, setIsLocking] = useState(false);
    const [previewSwap, setPreviewSwap] = useState();
    const [swapDebugBreadcrumb, setSwapDebugBreadcrumb] = useState(null);
    const [swapInteractionBreadcrumb, setSwapInteractionBreadcrumb] = useState(null);
    const [swapCompatibilityDebug, setSwapCompatibilityDebug] = useState(null);
    const [swapCanonicalIdentityByVenueId, setSwapCanonicalIdentityByVenueId] = useState({});
    const [swapCanonicalIdentityMissingByVenueId, setSwapCanonicalIdentityMissingByVenueId] = useState({});
    const [generationContractDebug, setGenerationContractDebug] = useState(null);
    const [appliedSwapRole, setAppliedSwapRole] = useState(null);
    const [canonicalStopByRole, setCanonicalStopByRole] = useState({});
    const [rejectedStopRoles, setRejectedStopRoles] = useState([]);
    const [districtPreviewResult, setDistrictPreviewResult] = useState();
    const [districtPreviewLoading, setDistrictPreviewLoading] = useState(false);
    const [districtPreviewError, setDistrictPreviewError] = useState();
    const [stageFingerprintsByScenario, setStageFingerprintsByScenario] = useState({});
    const [debugExpandedByKey, setDebugExpandedByKey] = useState({});
    const verticalDebugEnvValue = import.meta.env.VITE_VERTICAL_DEBUG;
    const verticalDebugEnabled = verticalDebugEnvValue === '1';
    const districtLocationQuery = useMemo(() => city.trim(), [city]);
    const previousDirectionIdentityRef = useRef(new Map());
    const previousPersonaVibeRef = useRef(null);
    const selectionEpochRef = useRef(0);
    const autoDirectionSyncAttemptRef = useRef(null);
    const planRef = useRef(plan);
    const finalRouteRef = useRef(finalRoute);
    const canonicalStopByRoleRef = useRef(canonicalStopByRole);
    const swapCanonicalIdentityByVenueIdRef = useRef(swapCanonicalIdentityByVenueId);
    const routeVersionRef = useRef(routeVersion);
    const updateFinalRoute = useCallback((nextRoute) => {
        setFinalRoute(nextRoute);
        setRouteVersion((current) => (nextRoute ? current + 1 : 0));
    }, []);
    useEffect(() => {
        planRef.current = plan;
    }, [plan]);
    useEffect(() => {
        finalRouteRef.current = finalRoute;
    }, [finalRoute]);
    useEffect(() => {
        canonicalStopByRoleRef.current = canonicalStopByRole;
    }, [canonicalStopByRole]);
    useEffect(() => {
        swapCanonicalIdentityByVenueIdRef.current = swapCanonicalIdentityByVenueId;
    }, [swapCanonicalIdentityByVenueId]);
    useEffect(() => {
        routeVersionRef.current = routeVersion;
    }, [routeVersion]);
    useEffect(() => {
        setSwapCanonicalIdentityByVenueId({});
        setSwapCanonicalIdentityMissingByVenueId({});
    }, [plan?.itinerary.id]);
    useEffect(() => {
        if (!plan) {
            return;
        }
        let cancelled = false;
        const hydrateSwapCanonicalIdentity = async () => {
            const knownResolved = swapCanonicalIdentityByVenueId;
            const knownMissing = swapCanonicalIdentityMissingByVenueId;
            const nextResolved = {};
            const nextMissing = {};
            const crewPolicy = getCrewPolicy(plan.intentProfile.crew);
            const coreStops = plan.itinerary.stops.filter((stop) => stop.role === 'start' || stop.role === 'highlight' || stop.role === 'windDown');
            for (const stop of coreStops) {
                const internalRole = roleToInternalRole[stop.role];
                const rankedCandidates = plan.scoredVenues
                    .filter((candidate) => candidate.candidateIdentity.kind !== 'moment')
                    .filter((candidate) => candidate.venue.id !== stop.venueId)
                    .filter((candidate) => hasSourceBackedIdentity(candidate))
                    .filter((candidate) => hasNavigableVenueLocation(candidate))
                    .filter((candidate) => candidate.roleScores[internalRole] >= 0.44)
                    .sort((left, right) => {
                    const leftScore = scoreAnchoredRoleFit(left, internalRole);
                    const rightScore = scoreAnchoredRoleFit(right, internalRole);
                    return rightScore - leftScore || left.venue.name.localeCompare(right.venue.name);
                })
                    .slice(0, 14);
                for (const candidate of rankedCandidates) {
                    if (knownResolved[candidate.venue.id] ||
                        nextResolved[candidate.venue.id] ||
                        knownMissing[candidate.venue.id] ||
                        nextMissing[candidate.venue.id]) {
                        continue;
                    }
                    const swappedArc = swapArcStop({
                        currentArc: plan.selectedArc,
                        role: inverseRoleProjection[stop.role],
                        replacement: candidate,
                        intent: plan.intentProfile,
                        crewPolicy,
                        lens: plan.lens,
                    });
                    if (!swappedArc) {
                        nextMissing[candidate.venue.id] = true;
                        continue;
                    }
                    const swappedItinerary = projectItinerary(swappedArc, plan.intentProfile, plan.lens);
                    const candidateStop = swappedItinerary.stops.find((item) => item.role === stop.role);
                    if (!candidateStop) {
                        nextMissing[candidate.venue.id] = true;
                        continue;
                    }
                    const canonicalFromSource = resolveCanonicalPlanningStopIdentityFromScoredVenue(candidateStop, candidate);
                    if (canonicalFromSource) {
                        nextResolved[candidate.venue.id] = canonicalFromSource;
                        continue;
                    }
                    const canonical = await resolveCanonicalPlanningStopIdentity(candidateStop, candidate);
                    if (cancelled) {
                        return;
                    }
                    if (canonical) {
                        nextResolved[candidate.venue.id] = canonical;
                    }
                    else {
                        nextMissing[candidate.venue.id] = true;
                    }
                }
            }
            if (cancelled) {
                return;
            }
            if (Object.keys(nextResolved).length > 0) {
                setSwapCanonicalIdentityByVenueId((current) => ({
                    ...current,
                    ...nextResolved,
                }));
            }
            if (Object.keys(nextMissing).length > 0) {
                setSwapCanonicalIdentityMissingByVenueId((current) => ({
                    ...current,
                    ...nextMissing,
                }));
            }
        };
        void hydrateSwapCanonicalIdentity();
        return () => {
            cancelled = true;
        };
    }, [plan, swapCanonicalIdentityByVenueId, swapCanonicalIdentityMissingByVenueId]);
    const unresolvedLocationReason = districtPreviewResult?.location.source === 'unresolved_query'
        ? districtPreviewResult.location.meta.unresolvedReason
        : undefined;
    const canonicalInterpretationBundle = useMemo(() => buildCanonicalInterpretationBundle({
        persona,
        vibe: primaryVibe,
        city: districtLocationQuery,
        planningMode: 'engine-led',
        entryPoint: 'direction_selection',
        hasAnchor: false,
    }), [districtLocationQuery, persona, primaryVibe]);
    const canonicalConciergeIntent = canonicalInterpretationBundle.normalizedIntent;
    const canonicalExperienceContract = canonicalInterpretationBundle.experienceContract;
    const canonicalContractConstraints = canonicalInterpretationBundle.contractConstraints;
    const contractGateWorld = useMemo(() => {
        return buildContractGateWorld({
            ranked: districtPreviewResult?.ranked ?? [],
            context: {
                persona,
                vibe: primaryVibe,
                experienceContract: canonicalExperienceContract,
                contractConstraints: canonicalContractConstraints,
            },
            source: 'page.sandbox.direction.contractGateWorld',
        });
    }, [
        canonicalContractConstraints,
        canonicalExperienceContract,
        districtPreviewResult,
        persona,
        primaryVibe,
    ]);
    const contractAwareDistrictRanking = useMemo(() => contractGateWorld.contractAwareRanking, [contractGateWorld]);
    const strategyAdmissibleWorlds = useMemo(() => buildStrategyAdmissibleWorlds({
        contractGateWorld,
        strategyFamily: canonicalInterpretationBundle.strategyFamily,
        strategySummary: canonicalInterpretationBundle.strategySemantics.summary,
    }), [canonicalInterpretationBundle, contractGateWorld]);
    const directionCards = useMemo(() => {
        if (!districtPreviewResult || contractGateWorld.admittedPockets.length === 0) {
            return [];
        }
        const experienceContractActShape = formatExperienceContractActShape(canonicalExperienceContract.actStructure.actPattern);
        const candidatePoolLimit = Math.min(contractGateWorld.admittedPockets.length, 10);
        const baseCandidates = buildDirectionCandidates({
            ranked: contractAwareDistrictRanking.ranked,
            debug: districtPreviewResult.debug,
            candidatePoolLimit,
            contractGateWorld,
            strategyAdmissibleWorlds,
            context: {
                persona,
                vibe: primaryVibe,
                experienceContract: canonicalExperienceContract,
                contractConstraints: canonicalContractConstraints,
            },
        });
        const personaShapedCandidates = applyPersonaShaping(baseCandidates, persona);
        const vibeShapedCandidates = applyVibeShaping(personaShapedCandidates, primaryVibe);
        const finalSelection = selectBestDistinctDirections({
            candidates: vibeShapedCandidates,
            preShapeCandidates: baseCandidates,
            requestedVibe: primaryVibe,
            finalLimit: 3,
        });
        const correctedWinnerId = finalSelection.debug.correctedWinnerId ?? finalSelection.finalists[0]?.pocketId;
        const finalistsByPocketId = new Map(finalSelection.finalists.map((candidate) => [candidate.pocketId, candidate]));
        const correctedWinner = correctedWinnerId
            ? finalistsByPocketId.get(correctedWinnerId)
            : undefined;
        const candidates = [
            ...(correctedWinner ? [correctedWinner] : []),
            ...finalSelection.finalists.filter((candidate) => candidate.pocketId !== correctedWinner?.pocketId),
        ].slice(0, 3);
        const finalSelectedId = candidates[0]?.pocketId;
        const preShapeRankByPocketId = new Map(baseCandidates.map((candidate, index) => [candidate.pocketId, index + 1]));
        const shapedRankByPocketId = new Map(vibeShapedCandidates.map((candidate, index) => [candidate.pocketId, index + 1]));
        const decisionByPocketId = new Map(finalSelection.debug.selectionDecisions.map((decision) => [decision.pocketId, decision]));
        const elevatedPocketIds = new Set(finalSelection.debug.elevatedPocketIds);
        // TODO(multi-vibe-shaping): support secondary-vibe and blended weighting in a future pass.
        const usedPrimarySignals = new Set();
        const usedPocketTypes = new Set();
        return candidates.map((candidate, index) => {
            const hyperlocalExpression = buildHyperlocalDirectionExpression({
                districtLabel: candidate.pocketLabel,
                defaultTitle: candidate.label,
                defaultSubtitle: candidate.subtitle,
                defaultSupportLine: candidate.supportLine,
                preferDefaultTitle: true,
                preferDefaultSubtitle: true,
                defaultSectionLabel: 'What defines this area',
                defaultBullets: candidate.reasons.slice(0, 3),
                candidate,
                hyperlocal: candidate.derivedFrom.hyperlocal,
                usedPrimarySignals,
                usedPocketTypes,
            });
            if (hyperlocalExpression.primarySignalKey) {
                usedPrimarySignals.add(hyperlocalExpression.primarySignalKey);
            }
            if (hyperlocalExpression.pocketType) {
                usedPocketTypes.add(hyperlocalExpression.pocketType);
            }
            const confirmation = `You're starting in ${candidate.pocketLabel} — ${getDirectionTrajectoryHint(candidate, primaryVibe)}`;
            const candidateDirectionContract = {
                id: candidate.pocketId,
                label: hyperlocalExpression.title,
                pocketId: candidate.pocketId,
                pocketLabel: candidate.pocketLabel,
                archetype: candidate.archetype,
                identity: inferDirectionIdentityFromSignals({
                    experienceFamily: candidate.experienceFamily,
                    cluster: candidate.cluster,
                    archetype: candidate.archetype,
                    label: hyperlocalExpression.title,
                    subtitle: hyperlocalExpression.subtitle,
                    laneIdentity: candidate.contrastProfile.laneIdentity,
                    macroLane: candidate.contrastProfile.macroLane,
                }),
                subtitle: hyperlocalExpression.subtitle,
                reasons: hyperlocalExpression.bullets.slice(0, 3),
                cluster: candidate.cluster,
                confirmation,
                experienceFamily: candidate.experienceFamily,
                familyConfidence: candidate.familyConfidence,
                supportLine: hyperlocalExpression.supportLine,
                whyNow: candidate.directionNarrativeSummary,
                laneIdentity: candidate.contrastProfile.laneIdentity,
                macroLane: candidate.contrastProfile.macroLane,
                storySpinePreview: {
                    start: getStorySpineStartLine(candidate, primaryVibe),
                    highlight: getStorySpineHighlightLine(candidate),
                    windDown: getStorySpineWindDownLine(candidate),
                    whyThisWorks: getStorySpineWhyThisWorksLine(candidate),
                },
            };
            const candidateDirectionContext = buildResolvedDirectionContext(candidateDirectionContract);
            if (!candidateDirectionContext) {
                return null;
            }
            const routeShapeHints = getRouteShapeHints(buildRouteShapeContract({
                selectedDirection: candidateDirectionContract,
                selectedDirectionContext: candidateDirectionContext,
                conciergeIntent: canonicalConciergeIntent,
                contractConstraints: canonicalContractConstraints,
            }));
            const conciergeHint = `${canonicalConciergeIntent.controlPosture.mode} | ${canonicalConciergeIntent.objective.primary} | swaps ${canonicalConciergeIntent.constraintPosture.swapTolerance}`;
            return {
                id: candidate.pocketId,
                cluster: candidate.cluster,
                recommended: index === 0,
                directionStrategyWorldDebug: candidate.directionStrategyWorldDebug,
                card: {
                    title: hyperlocalExpression.title,
                    subtitle: hyperlocalExpression.subtitle,
                    toneTag: getDirectionToneTag(candidate.archetype),
                    whyNow: candidate.directionNarrativeSummary,
                    whyYou: candidate.directionNarrativeSupport,
                    anchorLine: hyperlocalExpression.anchorLine,
                    supportLine: hyperlocalExpression.supportLine,
                    proofLine: getDirectionProofLine(candidate, false),
                    selectedProofLine: getDirectionProofLine(candidate, true),
                    storySpinePreview: {
                        start: getStorySpineStartLine(candidate, primaryVibe),
                        highlight: getStorySpineHighlightLine(candidate),
                        windDown: getStorySpineWindDownLine(candidate),
                        whyThisWorks: getStorySpineWhyThisWorksLine(candidate),
                    },
                    liveSignals: {
                        title: hyperlocalExpression.sectionLabel,
                        items: hyperlocalExpression.bullets,
                    },
                    confirmation,
                },
                debugMeta: {
                    pocketId: candidate.pocketId,
                    pocketLabel: candidate.pocketLabel,
                    archetype: candidate.archetype,
                    confidence: candidate.confidence,
                    persona: candidate.shapingDebug?.persona,
                    personaBoost: candidate.shapingDebug?.personaBoost,
                    vibe: candidate.shapingDebug?.vibe,
                    vibeBoost: candidate.shapingDebug?.vibeBoost,
                    finalScore: candidate.shapingDebug?.finalScore,
                    familyBias: candidate.shapingDebug?.familyBias,
                    richnessBoostApplied: candidate.richnessDebug?.richnessBoostApplied,
                    similarityPenaltyApplied: candidate.richnessDebug?.similarityPenaltyApplied,
                    composedCandidateAccepted: candidate.richnessDebug?.composedCandidateAccepted,
                    composedCandidateRejected: candidate.richnessDebug?.composedCandidateRejected,
                    richnessContrastReason: candidate.richnessDebug?.richnessContrastReason,
                    shapedScoreBeforeCompression: candidate.shapingDebug?.shapedScoreBeforeCompression,
                    shapedScoreAfterCompression: candidate.shapingDebug?.shapedScoreAfterCompression,
                    compressionApplied: candidate.shapingDebug?.compressionApplied,
                    compressionDelta: candidate.shapingDebug?.compressionDelta,
                    candidatePoolSize: finalSelection.debug.candidatePoolSize,
                    preShapeRank: preShapeRankByPocketId.get(candidate.pocketId),
                    shapedRank: shapedRankByPocketId.get(candidate.pocketId),
                    selectedRank: decisionByPocketId.get(candidate.pocketId)?.selectionRank,
                    selectionMode: decisionByPocketId.get(candidate.pocketId)?.selectionMode,
                    maxSimilarityToSelected: decisionByPocketId.get(candidate.pocketId)?.maxSimilarityToSelected,
                    similarityToWinner: decisionByPocketId.get(candidate.pocketId)?.similarityToWinner,
                    similarityToSlot2: decisionByPocketId.get(candidate.pocketId)?.similarityToSlot2,
                    sameLaneAsWinner: decisionByPocketId.get(candidate.pocketId)?.sameLaneAsWinner,
                    similarityPenalty: decisionByPocketId.get(candidate.pocketId)?.similarityPenalty,
                    contrastScore: decisionByPocketId.get(candidate.pocketId)?.contrastScore,
                    winnerStrengthBonus: decisionByPocketId.get(candidate.pocketId)?.winnerStrengthBonus,
                    diversityLift: decisionByPocketId.get(candidate.pocketId)?.diversityLift,
                    compositionChangedByShaping: finalSelection.debug.compositionChangedByShaping,
                    elevatedFromOutsideTop3: elevatedPocketIds.has(candidate.pocketId),
                    strongestShapedId: finalSelection.debug.strongestShapedId,
                    correctedWinnerId: finalSelection.debug.correctedWinnerId,
                    finalSelectedId,
                    strongestShapedPreserved: finalSelection.debug.strongestShapedPreserved,
                    slot1GuardrailApplied: finalSelection.debug.slot1GuardrailApplied,
                    top1RawSeparation: finalSelection.debug.top1RawSeparation,
                    top1AdjustedSeparation: finalSelection.debug.top1AdjustedSeparation,
                    laneIdentity: candidate.contrastProfile.laneIdentity,
                    macroLane: candidate.contrastProfile.macroLane,
                    directionExperienceIdentity: candidate.directionExperienceIdentity,
                    directionPrimaryIdentitySource: candidate.directionPrimaryIdentitySource,
                    directionPeakModel: candidate.directionPeakModel,
                    directionMovementStyle: candidate.directionMovementStyle,
                    directionDistrictSupportSummary: candidate.directionDistrictSupportSummary,
                    directionStrategyId: candidate.directionStrategyId,
                    directionStrategyLabel: candidate.directionStrategyLabel,
                    directionStrategyFamily: candidate.directionStrategyFamily,
                    directionStrategySummary: candidate.directionStrategySummary,
                    directionStrategySource: candidate.directionStrategySource,
                    directionCollapseGuardApplied: candidate.directionCollapseGuardApplied,
                    directionStrategyOverlapSummary: candidate.directionStrategyOverlapSummary,
                    strategyConstraintStatus: candidate.strategyConstraintStatus,
                    strategyPoolSize: candidate.strategyPoolSize,
                    strategyRejectedCount: candidate.strategyRejectedCount,
                    strategyHardGuardStatus: candidate.strategyHardGuardStatus,
                    strategyHardGuardReason: candidate.strategyHardGuardReason,
                    contractGateApplied: candidate.contractGateApplied,
                    contractGateSummary: candidate.contractGateSummary,
                    contractGateStrengthSummary: candidate.contractGateStrengthSummary,
                    contractGateRejectedCount: candidate.contractGateRejectedCount,
                    contractGateAllowedPreview: candidate.contractGateAllowedPreview,
                    contractGateSuppressedPreview: candidate.contractGateSuppressedPreview,
                    directionContractGateStatus: candidate.directionContractGateStatus,
                    directionContractGateReasonSummary: candidate.directionContractGateReasonSummary,
                    strategyWorldSource: candidate.strategyWorldSource,
                    selectedStrategyWorldId: candidate.selectedStrategyWorldId,
                    strategyWorldSummary: candidate.strategyWorldSummary,
                    strategyWorldAdmittedCount: candidate.strategyWorldAdmittedCount,
                    strategyWorldSuppressedCount: candidate.strategyWorldSuppressedCount,
                    strategyWorldRejectedCount: candidate.strategyWorldRejectedCount,
                    strategyWorldAllowedPreview: candidate.strategyWorldAllowedPreview,
                    strategyWorldSuppressedPreview: candidate.strategyWorldSuppressedPreview,
                    directionStrategyWorldDebug: candidate.directionStrategyWorldDebug,
                    directionStrategyWorldStatus: candidate.directionStrategyWorldStatus,
                    directionStrategyWorldReasonSummary: candidate.directionStrategyWorldReasonSummary,
                    directionNarrativeSource: candidate.directionNarrativeSource,
                    directionNarrativeMode: candidate.directionNarrativeMode,
                    directionNarrativeSummary: candidate.directionNarrativeSummary,
                    districtIdentityStrength: candidate.contrastProfile.districtIdentityStrength,
                    momentumProfile: candidate.contrastProfile.momentumProfile,
                    contrastEligible: candidate.contrastProfile.contrastEligible,
                    contrastReason: candidate.contrastProfile.contrastReason,
                    experienceFamily: candidate.experienceFamily,
                    familyConfidence: candidate.familyConfidence,
                    laneCollapseRisk: finalSelection.debug.laneCollapseRisk,
                    laneSeparatedSlot3: finalSelection.debug.laneSeparatedSlot3,
                    laneSeparationReason: finalSelection.debug.laneSeparationReason,
                    selectedFamilies: finalSelection.debug.selectedFamilies,
                    familyDiversityApplied: finalSelection.debug.familyDiversityApplied,
                    fallbackUsed: finalSelection.debug.fallbackUsed,
                    expressionMode: hyperlocalExpression.expressionMode,
                    localSpecificityScore: hyperlocalExpression.localSpecificityScore,
                    usedPrimaryMicroPocket: hyperlocalExpression.usedPrimaryMicroPocket,
                    usedPrimaryAnchor: hyperlocalExpression.usedPrimaryAnchor,
                    selectedTemplateKeys: hyperlocalExpression.templateKeys,
                    expressionPrimarySignal: hyperlocalExpression.primarySignalKey,
                    expressionPocketType: hyperlocalExpression.pocketType,
                    routeShapeGrammarHint: routeShapeHints.grammarHint,
                    routeShapeMovementHint: routeShapeHints.movementHint,
                    routeShapeSwapHint: routeShapeHints.swapHint,
                    experienceContractId: canonicalExperienceContract.id,
                    experienceContractIdentity: canonicalExperienceContract.contractIdentity,
                    experienceContractSummary: canonicalExperienceContract.summary,
                    experienceContractCoordinationMode: canonicalExperienceContract.coordinationMode,
                    experienceContractHighlightModel: canonicalExperienceContract.highlightModel,
                    experienceContractHighlightType: canonicalExperienceContract.highlightType,
                    experienceContractMovementStyle: canonicalExperienceContract.movementStyle,
                    experienceContractSocialPosture: canonicalExperienceContract.socialPosture,
                    experienceContractPacingStyle: canonicalExperienceContract.pacingStyle,
                    experienceContractActPattern: experienceContractActShape,
                    experienceContractReasonSummary: canonicalExperienceContract.debug.contractReasonSummary,
                    contractConstraintsId: canonicalContractConstraints.id,
                    contractConstraintsPeakCountModel: canonicalContractConstraints.peakCountModel,
                    contractConstraintsMovementTolerance: canonicalContractConstraints.movementTolerance,
                    contractConstraintsHighlightPressure: canonicalContractConstraints.highlightPressure,
                    contractConstraintsRequireContinuity: canonicalContractConstraints.requireContinuity,
                    contractConstraintsRequireRecoveryWindows: canonicalContractConstraints.requireRecoveryWindows,
                    conciergeIntentId: canonicalConciergeIntent.id,
                    conciergeIntentMode: canonicalConciergeIntent.intentMode,
                    conciergeObjectivePrimary: canonicalConciergeIntent.objective.primary,
                    conciergeControlPostureMode: canonicalConciergeIntent.controlPosture.mode,
                    conciergeConstraintSwapTolerance: canonicalConciergeIntent.constraintPosture.swapTolerance,
                    conciergeHint,
                },
            };
        }).filter((entry) => Boolean(entry));
    }, [
        canonicalConciergeIntent,
        canonicalContractConstraints,
        canonicalExperienceContract,
        contractAwareDistrictRanking,
        contractGateWorld,
        strategyAdmissibleWorlds,
        districtPreviewResult,
        persona,
        primaryVibe,
    ]);
    const directionIdentityById = useMemo(() => new Map(directionCards.map((entry) => [entry.id, buildDirectionIdentity(entry)])), [directionCards]);
    const directionSetKey = useMemo(() => `${persona}|${primaryVibe}|${directionCards.map((entry) => entry.id).join('|')}`, [directionCards, persona, primaryVibe]);
    const selectedDirection = useMemo(() => selectedDirectionId
        ? directionCards.find((entry) => entry.id === selectedDirectionId)
        : undefined, [directionCards, selectedDirectionId]);
    const selectedDirectionContract = useMemo(() => buildSelectedDirectionContract(selectedDirection), [selectedDirection]);
    const selectedDirectionContext = useMemo(() => buildResolvedDirectionContext(selectedDirectionContract), [selectedDirectionContract]);
    const selectedRouteShapeContract = useMemo(() => selectedDirectionContract && selectedDirectionContext
        ? buildRouteShapeContract({
            selectedDirection: selectedDirectionContract,
            selectedDirectionContext,
            conciergeIntent: canonicalConciergeIntent,
            contractConstraints: canonicalContractConstraints,
        })
        : undefined, [
        canonicalConciergeIntent,
        canonicalContractConstraints,
        selectedDirectionContext,
        selectedDirectionContract,
    ]);
    const userSelectedOverrideActive = Boolean(selectedDirectionId &&
        userSelectedDirection &&
        userSelectedDirection.setKey === directionSetKey &&
        userSelectedDirection.directionId === selectedDirectionId);
    const generatePlan = useCallback(async (directionIdOverride) => {
        const selectionEpochAtStart = selectionEpochRef.current;
        const normalizedDirectionOverride = typeof directionIdOverride === 'string' ? directionIdOverride : null;
        const activeDirectionId = normalizedDirectionOverride ?? selectedDirectionId;
        if (!activeDirectionId) {
            return false;
        }
        const activeDirection = directionCards.find((entry) => entry.id === activeDirectionId);
        if (!activeDirection) {
            return false;
        }
        const activeDirectionContract = buildSelectedDirectionContract(activeDirection);
        if (!activeDirectionContract) {
            setError('Direction contract is unavailable. Re-select a direction and try again.');
            return false;
        }
        const activeDirectionContext = buildResolvedDirectionContext(activeDirectionContract);
        if (!activeDirectionContext) {
            setError('Direction context is unavailable. Re-select a direction and try again.');
            return false;
        }
        const activeRouteShapeContract = buildRouteShapeContract({
            selectedDirection: activeDirectionContract,
            selectedDirectionContext: activeDirectionContext,
            conciergeIntent: canonicalConciergeIntent,
            contractConstraints: canonicalContractConstraints,
        });
        const activeContractConstraints = canonicalContractConstraints;
        const activeCluster = activeDirection.cluster;
        if (!activeCluster) {
            return false;
        }
        if (!districtLocationQuery) {
            setError('Enter a location before generating a plan.');
            return false;
        }
        if (unresolvedLocationReason) {
            setError(unresolvedLocationReason);
            return false;
        }
        if (districtPreviewResult && districtPreviewResult.ranked.length === 0) {
            setError('No viable districts for this location. Update the location and try again.');
            return false;
        }
        setLoading(true);
        setError(undefined);
        setIsLocking(false);
        setHasRevealed(false);
        setPreviewSwap(undefined);
        setSwapDebugBreadcrumb(null);
        setSwapInteractionBreadcrumb(null);
        setSwapCompatibilityDebug(null);
        setGenerationContractDebug(null);
        setAppliedSwapRole(null);
        setNearbySummaryByRole({});
        setCanonicalStopByRole({});
        setRejectedStopRoles([]);
        try {
            const selectedClusterConfirmation = activeDirectionContract.confirmation;
            const selectedDirectionPreviewContext = buildSelectedDirectionPreviewContext(activeDirectionContract);
            const result = await runGeneratePlan({
                mode: 'build',
                planningMode: 'engine-led',
                persona,
                primaryVibe,
                city: districtLocationQuery,
                district: activeDirectionContract.pocketLabel,
                distanceMode: 'nearby',
                refinementModes: clusterRefinementMap[activeCluster],
                selectedDirectionContext: {
                    directionId: activeDirectionContract.id,
                    label: activeDirectionContract.label,
                    pocketId: activeDirectionContract.pocketId,
                    archetype: activeDirectionContract.archetype,
                    identity: activeDirectionContext.identity,
                    subtitle: activeDirectionContract.subtitle,
                    reasons: activeDirectionContract.reasons,
                    family: activeDirectionContract.experienceFamily,
                    familyConfidence: activeDirectionContract.familyConfidence,
                    cluster: activeDirectionContract.cluster,
                },
            }, {
                sourceMode: 'curated',
                sourceModeOverrideApplied: true,
                debugMode: false,
                experienceContract: canonicalExperienceContract,
                contractConstraints: canonicalContractConstraints,
            });
            if (result.intentProfile.selectedDirectionContext?.directionId !== activeDirectionContract.id) {
                throw new Error('Route drifted from selected direction contract. Direction context was not preserved.');
            }
            const strongCurationPass = applyStrongCurationTastePass({
                itinerary: result.itinerary,
                selectedArc: result.selectedArc,
                scoredVenues: result.scoredVenues,
                intentProfile: result.intentProfile,
                lens: result.lens,
                contractConstraints: activeContractConstraints,
            });
            const anchoredPlan = await enforceFullStopRealityContract({
                itinerary: strongCurationPass.itinerary,
                selectedArc: strongCurationPass.selectedArc,
                scoredVenues: strongCurationPass.scoredVenues,
                intentProfile: result.intentProfile,
                lens: result.lens,
            });
            const tasteCurationDebug = buildTasteCurationDebugForArc({
                selectedArc: anchoredPlan.selectedArc,
                qualificationByCandidateId: strongCurationPass.qualificationByCandidateId,
                personaVibeTasteBiasSummary: strongCurationPass.personaVibeTasteBiasSummary,
                thinPoolHighlightFallbackApplied: strongCurationPass.thinPoolHighlightFallbackApplied,
                highlightPoolCountBefore: strongCurationPass.highlightPoolCountBefore,
                highlightPoolCountAfter: strongCurationPass.highlightPoolCountAfter,
                rolePoolCountByRoleBefore: strongCurationPass.rolePoolCountByRoleBefore,
                rolePoolCountByRoleAfter: strongCurationPass.rolePoolCountByRoleAfter,
                signatureHighlightShortlistCount: strongCurationPass.signatureHighlightShortlistCount,
                signatureHighlightShortlistIds: strongCurationPass.signatureHighlightShortlistIds,
                highlightShortlistScoreSummary: strongCurationPass.highlightShortlistScoreSummary,
                selectedHighlightFromShortlist: strongCurationPass.selectedHighlightFromShortlist,
                selectedHighlightShortlistRank: strongCurationPass.selectedHighlightShortlistRank,
                fallbackToQualifiedHighlightPool: strongCurationPass.fallbackToQualifiedHighlightPool,
                upstreamPoolSelectionApplied: strongCurationPass.upstreamPoolSelectionApplied,
                postGenerationRepairCount: strongCurationPass.postGenerationRepairCount,
                rolePoolVenueIdsByRole: strongCurationPass.rolePoolVenueIdsByRole,
                rolePoolVenueIdsCombined: strongCurationPass.rolePoolVenueIdsCombined,
            });
            const canonicalItinerary = applyCanonicalIdentityToItinerary(anchoredPlan.itinerary, anchoredPlan.canonicalStopByRole);
            const expectedDirectionIdentity = activeDirectionContext.identity ?? activeDirectionContract.identity ?? 'exploratory';
            const contractBuildability = assessDirectionContractBuildability({
                expectedDirectionIdentity,
                scoredVenues: strongCurationPass.scoredVenues,
            });
            const directionValidation = validateDirectionRouteContract({
                selectedDirectionContext: activeDirectionContext,
                selectedDirection: activeDirectionContract,
                itinerary: canonicalItinerary,
                buildability: contractBuildability,
            });
            setGenerationContractDebug({
                generationDriftReason: directionValidation.generationDriftReason,
                missingRoleForContract: directionValidation.missingRoleForContract,
                contractBuildabilityStatus: directionValidation.contractBuildabilityStatus,
                candidatePoolSufficiencyByRole: directionValidation.candidatePoolSufficiencyByRole,
                expectedDirectionIdentity: directionValidation.expectedDirectionIdentity,
                observedDirectionIdentity: directionValidation.observedDirectionIdentity,
                fallbackApplied: directionValidation.fallbackApplied,
            });
            if (!directionValidation.valid) {
                throw new Error('Route drifted from selected direction contract. Please regenerate.');
            }
            const nextFinalRoute = buildFinalRoute({
                itinerary: canonicalItinerary,
                canonicalStopByRole: anchoredPlan.canonicalStopByRole,
                selectedDirectionId: activeDirectionContract.id,
                city: districtLocationQuery,
                persona,
                vibe: primaryVibe,
                activeRole: 'start',
                selectedCluster: activeCluster,
                selectedDirectionPreviewContext,
            });
            if (!nextFinalRoute) {
                throw new Error('Route commit failed: one or more stops are missing canonical identity.');
            }
            if (nextFinalRoute.selectedDirectionId !== activeDirectionContract.id) {
                throw new Error('Route drifted from selected direction contract. Please regenerate.');
            }
            if (selectionEpochRef.current !== selectionEpochAtStart) {
                return false;
            }
            setPlan({
                itinerary: canonicalItinerary,
                selectedArc: anchoredPlan.selectedArc,
                scoredVenues: strongCurationPass.scoredVenues,
                generationTrace: result.trace,
                intentProfile: result.intentProfile,
                lens: result.lens,
                conciergeIntent: canonicalConciergeIntent,
                experienceContract: canonicalExperienceContract,
                contractConstraints: activeContractConstraints,
                selectedDirectionContext: activeDirectionContext,
                selectedCluster: activeCluster,
                selectedClusterConfirmation,
                selectedDirectionContract: activeDirectionContract,
                routeShapeContract: activeRouteShapeContract,
                tasteCurationDebug,
                selectedDirectionPreviewContext,
            });
            updateFinalRoute(nextFinalRoute);
            setCanonicalStopByRole(anchoredPlan.canonicalStopByRole);
            setRejectedStopRoles(anchoredPlan.rejectedStopRoles);
            setActiveRole('start');
            setNearbySummaryByRole({});
            autoDirectionSyncAttemptRef.current = null;
            return true;
        }
        catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : 'Failed to generate plan.');
            return false;
        }
        finally {
            setLoading(false);
        }
    }, [
        canonicalConciergeIntent,
        canonicalContractConstraints,
        canonicalExperienceContract,
        directionCards,
        districtLocationQuery,
        districtPreviewResult,
        persona,
        primaryVibe,
        selectedDirectionId,
        unresolvedLocationReason,
        updateFinalRoute,
    ]);
    const handleSelectDirection = useCallback((directionId) => {
        const directionChanged = selectedDirectionId !== directionId;
        setSelectedDirectionId(directionId);
        setUserSelectedDirection(directionSetKey.length > 0
            ? {
                setKey: directionSetKey,
                directionId,
            }
            : null);
        setSelectedIdReconciled(false);
        setSwapDebugBreadcrumb(null);
        setSwapInteractionBreadcrumb(null);
        setSwapCompatibilityDebug(null);
        setGenerationContractDebug(null);
        if (directionChanged) {
            selectionEpochRef.current += 1;
            autoDirectionSyncAttemptRef.current = null;
            setLoading(false);
            setHasRevealed(false);
            setPreviewSwap(undefined);
            setAppliedSwapRole(null);
            setNearbySummaryByRole({});
            setCanonicalStopByRole({});
            setRejectedStopRoles([]);
            setPlan(undefined);
            updateFinalRoute(null);
            setError(undefined);
        }
    }, [directionSetKey, selectedDirectionId, updateFinalRoute]);
    useEffect(() => {
        const currentDirectionId = selectedDirectionId ?? plan?.selectedDirectionContract.id ?? null;
        if (!plan || !finalRoute || loading || !currentDirectionId) {
            return;
        }
        if (finalRoute.selectedDirectionId === currentDirectionId) {
            autoDirectionSyncAttemptRef.current = null;
            return;
        }
        if (autoDirectionSyncAttemptRef.current === currentDirectionId) {
            return;
        }
        autoDirectionSyncAttemptRef.current = currentDirectionId;
        void (async () => {
            const synced = await generatePlan(currentDirectionId);
            if (!synced) {
                setError((current) => current ??
                    'Direction sync mismatch persisted. Re-select a direction and generate again.');
            }
        })();
    }, [finalRoute, generatePlan, loading, plan, selectedDirectionId]);
    useEffect(() => {
        setHasRevealed(false);
        setIsLocking(false);
        setPreviewSwap(undefined);
        setSwapDebugBreadcrumb(null);
        setSwapInteractionBreadcrumb(null);
        setSwapCompatibilityDebug(null);
        setGenerationContractDebug(null);
        setAppliedSwapRole(null);
        setNearbySummaryByRole({});
        setCanonicalStopByRole({});
        setRejectedStopRoles([]);
        setPlan(undefined);
        updateFinalRoute(null);
        setError(undefined);
    }, [districtLocationQuery, persona, primaryVibe, updateFinalRoute]);
    useEffect(() => {
        if (directionCards.length === 0 || directionSetKey.length === 0) {
            setSelectedDirectionId(null);
            setUserSelectedDirection(null);
            setSelectedIdReconciled(false);
            setSwapDebugBreadcrumb(null);
            setSwapInteractionBreadcrumb(null);
            setSwapCompatibilityDebug(null);
            setGenerationContractDebug(null);
            updateFinalRoute(null);
            previousDirectionIdentityRef.current = new Map();
            previousPersonaVibeRef.current = { persona, vibe: primaryVibe };
            return;
        }
        const previousPersonaVibe = previousPersonaVibeRef.current;
        const personaOrVibeChanged = Boolean(previousPersonaVibe &&
            (previousPersonaVibe.persona !== persona || previousPersonaVibe.vibe !== primaryVibe));
        const previousIdentityById = previousDirectionIdentityRef.current;
        const firstCandidateId = directionCards[0]?.id ?? null;
        const selectedStillExists = Boolean(selectedDirectionId && directionIdentityById.has(selectedDirectionId));
        let nextSelectedDirectionId = selectedDirectionId;
        if (!selectedStillExists) {
            nextSelectedDirectionId = firstCandidateId;
        }
        else if (personaOrVibeChanged && selectedDirectionId) {
            const previousIdentity = previousIdentityById.get(selectedDirectionId);
            const nextIdentity = directionIdentityById.get(selectedDirectionId);
            if (!previousIdentity || !nextIdentity || previousIdentity !== nextIdentity) {
                nextSelectedDirectionId = firstCandidateId;
            }
        }
        if (!nextSelectedDirectionId) {
            nextSelectedDirectionId = firstCandidateId;
        }
        const reconciled = nextSelectedDirectionId !== selectedDirectionId;
        if (reconciled) {
            selectionEpochRef.current += 1;
            autoDirectionSyncAttemptRef.current = null;
            setGenerationContractDebug(null);
            setSelectedDirectionId(nextSelectedDirectionId);
            setUserSelectedDirection(null);
        }
        else if (userSelectedDirection &&
            (userSelectedDirection.setKey !== directionSetKey ||
                userSelectedDirection.directionId !== selectedDirectionId)) {
            setUserSelectedDirection(null);
        }
        setSelectedIdReconciled(reconciled);
        previousDirectionIdentityRef.current = new Map(directionIdentityById);
        previousPersonaVibeRef.current = { persona, vibe: primaryVibe };
    }, [
        directionCards,
        directionIdentityById,
        directionSetKey,
        persona,
        primaryVibe,
        selectedDirectionId,
        updateFinalRoute,
        userSelectedDirection,
    ]);
    useEffect(() => {
        let cancelled = false;
        setDistrictPreviewLoading(true);
        setDistrictPreviewError(undefined);
        const timeoutHandle = window.setTimeout(() => {
            void (async () => {
                try {
                    const result = await buildDistrictOpportunityProfiles({
                        locationQuery: districtLocationQuery,
                        includeDebug: true,
                    });
                    if (!cancelled) {
                        setDistrictPreviewResult(result);
                        setDistrictPreviewError(result.location.source === 'unresolved_query'
                            ? result.location.meta.unresolvedReason ?? 'Could not resolve location.'
                            : undefined);
                    }
                }
                catch (nextError) {
                    console.error(nextError);
                    if (!cancelled) {
                        setDistrictPreviewError(nextError instanceof Error
                            ? nextError.message
                            : 'Failed to load district preview.');
                    }
                }
                finally {
                    if (!cancelled) {
                        setDistrictPreviewLoading(false);
                    }
                }
            })();
        }, 180);
        return () => {
            cancelled = true;
            window.clearTimeout(timeoutHandle);
        };
    }, [districtLocationQuery]);
    const handleNearbySummaryChange = useCallback((role, summary) => {
        setNearbySummaryByRole((current) => {
            if (!summary) {
                if (!(role in current)) {
                    return current;
                }
                const next = { ...current };
                delete next[role];
                return next;
            }
            if (current[role] === summary) {
                return current;
            }
            return {
                ...current,
                [role]: summary,
            };
        });
    }, []);
    const handlePreviewAlternative = useCallback(async (role, venueId) => {
        console.log('[SWAP CLICK]', venueId);
        const markPreviewGuardFailure = (reason, message) => {
            console.warn('[SWAP PREVIEW GUARD]', {
                reason,
                role,
                replacementId: venueId,
            });
            setSwapInteractionBreadcrumb((current) => ({
                swapClickFired: current?.swapClickFired ?? true,
                swapHandlerEntered: true,
                swapCandidateAtClickId: current?.swapCandidateAtClickId ?? venueId ?? null,
                swapCandidateCanonicalIdentityAtClick: current?.swapCandidateCanonicalIdentityAtClick ?? null,
                candidateHasCanonicalIdentity: current?.candidateHasCanonicalIdentity ?? null,
                swapTargetSlotIndexAtClick: current?.swapTargetSlotIndexAtClick ?? null,
                swapTargetRoleAtClick: current?.swapTargetRoleAtClick ?? role,
                swapGuardFailureReason: reason,
                swapCommitStarted: false,
                swapCommitFinished: false,
                swapModalClosedAfterCommit: false,
            }));
            setError(message);
        };
        setSwapInteractionBreadcrumb({
            swapClickFired: true,
            swapHandlerEntered: true,
            swapCandidateAtClickId: venueId ?? null,
            swapCandidateCanonicalIdentityAtClick: null,
            candidateHasCanonicalIdentity: null,
            swapTargetSlotIndexAtClick: null,
            swapTargetRoleAtClick: role,
            swapGuardFailureReason: null,
            swapCommitStarted: false,
            swapCommitFinished: false,
            swapModalClosedAfterCommit: false,
        });
        const activePlan = planRef.current;
        const activeFinalRoute = finalRouteRef.current;
        if (!activePlan) {
            markPreviewGuardFailure('plan_missing_at_click', 'Swap preview did not start: plan missing at click.');
            return;
        }
        if (!activeFinalRoute) {
            markPreviewGuardFailure('final_route_missing_at_click', 'Swap preview did not start: final route missing at click.');
            return;
        }
        setError(undefined);
        try {
            const replacement = activePlan.scoredVenues.find((candidate) => candidate.venue.id === venueId);
            const originalStop = activePlan.itinerary.stops.find((stop) => stop.role === role);
            const targetRouteStop = activeFinalRoute.stops.find((stop) => stop.role === role);
            if (!replacement) {
                markPreviewGuardFailure('replacement_missing_in_plan', `Swap preview did not start: replacement ${venueId} is not in the current plan.`);
                return;
            }
            if (!originalStop) {
                markPreviewGuardFailure('original_stop_missing_for_role', `Swap preview did not start: original ${role} stop is missing.`);
                return;
            }
            if (!targetRouteStop) {
                markPreviewGuardFailure('target_route_stop_missing_for_role', `Swap preview did not start: target route stop for ${role} is missing.`);
                return;
            }
            setSwapInteractionBreadcrumb((current) => ({
                swapClickFired: current?.swapClickFired ?? true,
                swapHandlerEntered: true,
                swapCandidateAtClickId: current?.swapCandidateAtClickId ?? venueId,
                swapCandidateCanonicalIdentityAtClick: current?.swapCandidateCanonicalIdentityAtClick ?? null,
                candidateHasCanonicalIdentity: current?.candidateHasCanonicalIdentity ?? null,
                swapTargetSlotIndexAtClick: targetRouteStop.stopIndex,
                swapTargetRoleAtClick: targetRouteStop.role,
                swapGuardFailureReason: null,
                swapCommitStarted: false,
                swapCommitFinished: false,
                swapModalClosedAfterCommit: false,
            }));
            setSwapDebugBreadcrumb({
                swapTargetSlotIndex: targetRouteStop.stopIndex,
                swapTargetRole: targetRouteStop.role,
                swapBeforeStopId: targetRouteStop.id,
                swapRequestedReplacementId: replacement.venue.id,
                swapAppliedReplacementId: null,
                swapCommitSucceeded: false,
                swapRenderSource: 'finalRoute',
                routeVersion: routeVersionRef.current,
                mismatch: false,
            });
            const crewPolicy = getCrewPolicy(activePlan.intentProfile.crew);
            const swappedArc = swapArcStop({
                currentArc: activePlan.selectedArc,
                role: inverseRoleProjection[role],
                replacement,
                intent: activePlan.intentProfile,
                crewPolicy,
                lens: activePlan.lens,
            });
            if (!swappedArc) {
                markPreviewGuardFailure('swap_arc_projection_failed', `Swap preview did not start: ${venueId} cannot project into the ${role} role.`);
                return;
            }
            const swappedItinerary = projectItinerary(swappedArc, activePlan.intentProfile, activePlan.lens);
            const candidateStop = swappedItinerary.stops.find((stop) => stop.role === role);
            if (!candidateStop) {
                markPreviewGuardFailure('candidate_stop_missing_after_projection', `Swap preview did not start: projected ${role} stop is missing for ${venueId}.`);
                return;
            }
            if (candidateStop.venueId !== replacement.venue.id) {
                throw new Error('Swap preview mismatch: selected venue did not resolve to the requested role.');
            }
            const replacementCanonicalFromCandidate = swapCanonicalIdentityByVenueIdRef.current[replacement.venue.id] ??
                resolveCanonicalPlanningStopIdentityFromScoredVenue(candidateStop, replacement);
            setSwapInteractionBreadcrumb((current) => ({
                swapClickFired: current?.swapClickFired ?? true,
                swapHandlerEntered: true,
                swapCandidateAtClickId: current?.swapCandidateAtClickId ?? venueId,
                swapCandidateCanonicalIdentityAtClick: replacementCanonicalFromCandidate?.providerRecordId ?? null,
                candidateHasCanonicalIdentity: Boolean(replacementCanonicalFromCandidate),
                swapTargetSlotIndexAtClick: current?.swapTargetSlotIndexAtClick ?? targetRouteStop.stopIndex,
                swapTargetRoleAtClick: current?.swapTargetRoleAtClick ?? targetRouteStop.role,
                swapGuardFailureReason: null,
                swapCommitStarted: false,
                swapCommitFinished: false,
                swapModalClosedAfterCommit: false,
            }));
            const replacementCanonical = replacementCanonicalFromCandidate ??
                (await resolveCanonicalPlanningStopIdentity(candidateStop, replacement));
            if (!replacementCanonical) {
                markPreviewGuardFailure('replacement_canonical_identity_missing', 'This swap option is missing canonical place identity and cannot be previewed.');
                return;
            }
            const originalCanonical = canonicalStopByRoleRef.current[role];
            const originalDisplay = resolvePlanningStopDisplay(originalStop, findScoredVenueForStop(originalStop, activePlan.selectedArc));
            const candidateStopForDisplay = {
                ...candidateStop,
                venueName: replacementCanonical.displayName,
            };
            const candidateNarrative = getInlineStopNarrative(candidateStopForDisplay, activePlan.intentProfile, {
                scoredVenue: findScoredVenueForStop(candidateStop, swappedArc),
                roleTravelWindowMinutes: getRoleTravelWindow(swappedItinerary, role),
                itineraryStops: swappedItinerary.stops,
                experienceContract: activePlan.experienceContract,
                contractConstraints: activePlan.contractConstraints,
            });
            const originalTravel = getRoleTravelWindow(activePlan.itinerary, role);
            const candidateTravel = getRoleTravelWindow(swappedItinerary, role);
            const travelDelta = Math.round(candidateTravel - originalTravel);
            const constraintSignal = travelDelta >= 2
                ? `Adds ~${travelDelta} min travel.`
                : travelDelta <= -2
                    ? `Saves ~${Math.abs(travelDelta)} min travel.`
                    : 'Keeps travel about the same.';
            setActiveRole(role);
            setPreviewSwap({
                role,
                targetRouteId: activeFinalRoute.routeId,
                targetStopId: targetRouteStop.id,
                targetStopIndex: targetRouteStop.stopIndex,
                targetRole: targetRouteStop.role,
                swapBeforeStopId: targetRouteStop.id,
                requestedReplacementId: replacement.venue.id,
                originalStop: {
                    ...originalStop,
                    venueName: originalCanonical?.displayName ?? originalDisplay.title,
                },
                candidateStop: candidateStopForDisplay,
                replacementCanonical,
                swappedArc,
                swappedItinerary,
                descriptor: getAlternativeDescriptor(replacement, {
                    role,
                    contractConstraints: activePlan.contractConstraints,
                }),
                whyItFits: candidateNarrative.whyItFits,
                knownFor: candidateNarrative.knownFor,
                localSignal: candidateNarrative.localSignal ?? 'Best earlier in the evening.',
                venueLinkUrl: buildVenueLinkUrl(candidateStopForDisplay, replacementCanonical.displayName, {
                    providerRecordId: replacementCanonical.providerRecordId,
                    latitude: replacementCanonical.latitude,
                    longitude: replacementCanonical.longitude,
                    venueName: replacementCanonical.displayName,
                }),
                tradeoffSignal: getSwapTradeoffSignal(role, candidateStopForDisplay),
                constraintSignal,
                cascadeHint: getSwapCascadeHint(role, candidateStopForDisplay),
            });
            setSwapCompatibilityDebug(null);
            setAppliedSwapRole(null);
        }
        catch (nextError) {
            const reason = nextError instanceof Error ? nextError.message : 'Could not preview this swap option.';
            console.warn('[SWAP PREVIEW ERROR]', {
                role,
                replacementId: venueId,
                reason,
            });
            setSwapInteractionBreadcrumb((current) => ({
                swapClickFired: current?.swapClickFired ?? true,
                swapHandlerEntered: true,
                swapCandidateAtClickId: current?.swapCandidateAtClickId ?? venueId ?? null,
                swapCandidateCanonicalIdentityAtClick: current?.swapCandidateCanonicalIdentityAtClick ?? null,
                candidateHasCanonicalIdentity: current?.candidateHasCanonicalIdentity ?? null,
                swapTargetSlotIndexAtClick: current?.swapTargetSlotIndexAtClick ?? null,
                swapTargetRoleAtClick: current?.swapTargetRoleAtClick ?? role,
                swapGuardFailureReason: 'preview_exception',
                swapCommitStarted: false,
                swapCommitFinished: false,
                swapModalClosedAfterCommit: false,
            }));
            setError(reason);
        }
    }, []);
    const handleApplyPreviewSwap = async (invocation) => {
        const markGuardFailure = (reason, message) => {
            setSwapCompatibilityDebug({
                swapCompatibilityPassed: false,
                swapCompatibilityReason: message,
                swapCompatibilityRejectClass: 'hard_structural',
                preservedRole: false,
                preservedDistrict: false,
                preservedFamily: false,
                preservedFeasibility: false,
                softDirectionDriftDetected: false,
            });
            setSwapInteractionBreadcrumb((current) => ({
                swapClickFired: current?.swapClickFired ?? true,
                swapHandlerEntered: true,
                swapCandidateAtClickId: current?.swapCandidateAtClickId ?? null,
                swapTargetSlotIndexAtClick: current?.swapTargetSlotIndexAtClick ?? null,
                swapTargetRoleAtClick: current?.swapTargetRoleAtClick ?? null,
                swapGuardFailureReason: reason,
                swapCommitStarted: false,
                swapCommitFinished: false,
                swapModalClosedAfterCommit: false,
            }));
            setError(message);
        };
        setSwapInteractionBreadcrumb((current) => ({
            swapClickFired: current?.swapClickFired ?? true,
            swapHandlerEntered: true,
            swapCandidateAtClickId: current?.swapCandidateAtClickId ?? null,
            swapTargetSlotIndexAtClick: current?.swapTargetSlotIndexAtClick ?? null,
            swapTargetRoleAtClick: current?.swapTargetRoleAtClick ?? null,
            swapGuardFailureReason: null,
            swapCommitStarted: false,
            swapCommitFinished: false,
            swapModalClosedAfterCommit: false,
        }));
        const { role, swapSnapshot, planSnapshot, finalRouteSnapshot, routeVersionAtClick } = invocation;
        if (!swapSnapshot) {
            markGuardFailure('swap_snapshot_missing', 'Swap did not start: missing swap selection at click.');
            return;
        }
        if (!planSnapshot) {
            markGuardFailure('plan_missing', 'Swap did not start: plan state missing at click.');
            return;
        }
        if (!finalRouteSnapshot) {
            markGuardFailure('final_route_missing', 'Swap did not start: final route missing at click.');
            return;
        }
        if (swapSnapshot.role !== role) {
            markGuardFailure('role_mismatch', `Swap did not start: role mismatch (${swapSnapshot.role} vs ${role}).`);
            return;
        }
        if (!planSnapshot.selectedDirectionContract) {
            markGuardFailure('direction_contract_missing', 'Swap did not start: selected direction contract is missing.');
            return;
        }
        if (swapSnapshot.targetRole !== role) {
            markGuardFailure('target_role_mismatch', `Swap did not start: target role mismatch (${swapSnapshot.targetRole} vs ${role}).`);
            return;
        }
        if (swapSnapshot.targetStopIndex < 0) {
            markGuardFailure('target_slot_missing', 'Swap did not start: target slot index is invalid.');
            return;
        }
        setError(undefined);
        setSwapInteractionBreadcrumb((current) => ({
            swapClickFired: current?.swapClickFired ?? true,
            swapHandlerEntered: true,
            swapCandidateAtClickId: current?.swapCandidateAtClickId ?? swapSnapshot.requestedReplacementId,
            swapTargetSlotIndexAtClick: current?.swapTargetSlotIndexAtClick ?? swapSnapshot.targetStopIndex,
            swapTargetRoleAtClick: current?.swapTargetRoleAtClick ?? swapSnapshot.targetRole,
            swapGuardFailureReason: null,
            swapCommitStarted: true,
            swapCommitFinished: false,
            swapModalClosedAfterCommit: false,
        }));
        try {
            const nextCanonicalStopByRole = {
                ...canonicalStopByRole,
                [role]: swapSnapshot.replacementCanonical,
            };
            const canonicalItinerary = applyCanonicalIdentityToItinerary(swapSnapshot.swappedItinerary, nextCanonicalStopByRole);
            const swapDirectionId = planSnapshot.selectedDirectionContract.id;
            const swapPreviewContext = planSnapshot.selectedDirectionPreviewContext;
            const compatibility = evaluateSwapCompatibility({
                role,
                swapSnapshot,
                canonicalItinerary,
                planSnapshot,
                finalRouteSnapshot,
                routeShapeContract: planSnapshot.routeShapeContract,
            });
            setSwapCompatibilityDebug(compatibility);
            if (!compatibility.swapCompatibilityPassed) {
                throw new Error(`Swap rejected: ${compatibility.swapCompatibilityReason}`);
            }
            if (!swapDirectionId || !swapPreviewContext) {
                throw new Error('Route update failed: canonical route state is unavailable.');
            }
            if (finalRouteSnapshot.selectedDirectionId !== swapDirectionId) {
                throw new Error('Swap rejected: route direction drifted from the selected direction contract.');
            }
            if (swapSnapshot.targetRouteId !== finalRouteSnapshot.routeId) {
                throw new Error('Swap preview is stale. Please reopen swap options and try again.');
            }
            const sourceSwapStop = canonicalItinerary.stops.find((stop) => stop.role === role);
            const currentRouteStop = finalRouteSnapshot.stops.find((stop) => stop.id === swapSnapshot.targetStopId) ??
                finalRouteSnapshot.stops.find((stop) => stop.stopIndex === swapSnapshot.targetStopIndex) ??
                finalRouteSnapshot.stops.find((stop) => stop.role === swapSnapshot.targetRole);
            if (!sourceSwapStop || !currentRouteStop) {
                throw new Error('Route update failed: swapped stop could not be resolved.');
            }
            if (currentRouteStop.role !== swapSnapshot.targetRole ||
                currentRouteStop.stopIndex !== swapSnapshot.targetStopIndex) {
                console.error('Swap aborted due to target mismatch.', {
                    routeId: finalRouteSnapshot.routeId,
                    expectedRole: swapSnapshot.targetRole,
                    expectedStopIndex: swapSnapshot.targetStopIndex,
                    resolvedRole: currentRouteStop.role,
                    resolvedStopIndex: currentRouteStop.stopIndex,
                });
                throw new Error('Swap target mismatch detected. Please retry from the current route.');
            }
            if (swapSnapshot.candidateStop.venueId !== swapSnapshot.requestedReplacementId) {
                throw new Error(`Swap integrity mismatch: modal requested ${swapSnapshot.requestedReplacementId}, candidate resolved ${swapSnapshot.candidateStop.venueId}.`);
            }
            const projectedSwapMismatch = sourceSwapStop.venueId !== swapSnapshot.requestedReplacementId;
            const canonicalItineraryAfterSwap = projectedSwapMismatch
                ? {
                    ...canonicalItinerary,
                    stops: canonicalItinerary.stops.map((stop) => {
                        if (stop.role !== role) {
                            return stop;
                        }
                        return {
                            ...stop,
                            id: swapSnapshot.candidateStop.id,
                            venueId: swapSnapshot.requestedReplacementId,
                            venueName: swapSnapshot.replacementCanonical.displayName,
                            city: swapSnapshot.replacementCanonical.city,
                            neighborhood: swapSnapshot.replacementCanonical.neighborhood || swapSnapshot.candidateStop.neighborhood,
                            driveMinutes: swapSnapshot.candidateStop.driveMinutes,
                            imageUrl: swapSnapshot.candidateStop.imageUrl,
                        };
                    }),
                }
                : canonicalItinerary;
            const replacementStop = {
                id: swapSnapshot.candidateStop.id,
                sourceStopId: swapSnapshot.candidateStop.id,
                displayName: swapSnapshot.replacementCanonical.displayName,
                providerRecordId: swapSnapshot.replacementCanonical.providerRecordId,
                latitude: swapSnapshot.replacementCanonical.latitude,
                longitude: swapSnapshot.replacementCanonical.longitude,
                address: swapSnapshot.replacementCanonical.addressLine,
                role: currentRouteStop.role,
                stopIndex: currentRouteStop.stopIndex,
                venueId: swapSnapshot.requestedReplacementId,
                title: currentRouteStop.title,
                subtitle: currentRouteStop.subtitle,
                neighborhood: swapSnapshot.replacementCanonical.neighborhood || swapSnapshot.candidateStop.neighborhood,
                driveMinutes: swapSnapshot.candidateStop.driveMinutes,
                imageUrl: swapSnapshot.candidateStop.imageUrl,
            };
            const patched = patchFinalRouteStop({
                route: finalRouteSnapshot,
                targetRole: swapSnapshot.targetRole,
                targetStopId: swapSnapshot.targetStopId,
                targetStopIndex: swapSnapshot.targetStopIndex,
                replacementStop,
                notice: `${role} swapped to ${replacementStop.displayName}.`,
                activeRole: role,
            });
            if (!patched) {
                throw new Error('Route update failed: canonical route patch did not apply.');
            }
            if (import.meta.env.DEV) {
                console.log('SWAP TARGET CHECK', {
                    routeId: finalRouteSnapshot.routeId,
                    modalTargetStopId: swapSnapshot.targetStopId,
                    modalTargetRole: swapSnapshot.targetRole,
                    modalTargetStopIndex: swapSnapshot.targetStopIndex,
                    resolvedStopId: patched.resolvedStop.id,
                    resolvedRole: patched.resolvedStop.role,
                    resolvedStopIndex: patched.resolvedStop.stopIndex,
                });
            }
            if (patched.resolvedStop.role !== swapSnapshot.targetRole ||
                patched.resolvedStop.stopIndex !== swapSnapshot.targetStopIndex) {
                console.error('Swap aborted due to patch resolution mismatch.', {
                    routeId: finalRouteSnapshot.routeId,
                    expectedRole: swapSnapshot.targetRole,
                    expectedStopIndex: swapSnapshot.targetStopIndex,
                    resolvedRole: patched.resolvedStop.role,
                    resolvedStopIndex: patched.resolvedStop.stopIndex,
                    resolution: patched.resolution,
                });
                throw new Error('Swap target mismatch detected. Please retry from the current route.');
            }
            const nextFinalRoute = patched.route;
            const appliedStop = nextFinalRoute.stops.find((stop) => stop.stopIndex === swapSnapshot.targetStopIndex);
            if (!appliedStop) {
                throw new Error('Swap integrity mismatch: target slot is missing after route patch.');
            }
            if (appliedStop.role !== swapSnapshot.targetRole) {
                throw new Error(`Swap integrity mismatch: target role changed from ${swapSnapshot.targetRole} to ${appliedStop.role}.`);
            }
            const appliedReplacementId = appliedStop.venueId;
            const swapMismatch = appliedReplacementId !== swapSnapshot.requestedReplacementId;
            setSwapDebugBreadcrumb({
                swapTargetSlotIndex: swapSnapshot.targetStopIndex,
                swapTargetRole: swapSnapshot.targetRole,
                swapBeforeStopId: swapSnapshot.swapBeforeStopId,
                swapRequestedReplacementId: swapSnapshot.requestedReplacementId,
                swapAppliedReplacementId: appliedReplacementId,
                postSwapCanonicalStopIdBySlot: [...nextFinalRoute.stops]
                    .sort((left, right) => left.stopIndex - right.stopIndex)
                    .map((stop) => stop.venueId),
                postSwapRenderedStopIdBySlot: canonicalItineraryAfterSwap.stops.map((stop) => stop.venueId),
                swapCommitSucceeded: !swapMismatch,
                swapRenderSource: 'finalRoute',
                routeVersion: swapMismatch ? routeVersionAtClick : routeVersionAtClick + 1,
                mismatch: swapMismatch,
            });
            if (swapMismatch) {
                throw new Error(`Swap integrity mismatch: requested ${swapSnapshot.requestedReplacementId}, applied ${appliedReplacementId}.`);
            }
            setPlan({
                ...planSnapshot,
                itinerary: canonicalItineraryAfterSwap,
                selectedArc: swapSnapshot.swappedArc,
            });
            updateFinalRoute(nextFinalRoute);
            logSwapCommitChecks(nextFinalRoute, role, ['preview', 'map', 'spine', 'live', 'share', 'calendar']);
            setCanonicalStopByRole(nextCanonicalStopByRole);
            setPreviewSwap(undefined);
            setAppliedSwapRole(role);
            setActiveRole(role);
            setSwapInteractionBreadcrumb((current) => ({
                swapClickFired: current?.swapClickFired ?? true,
                swapHandlerEntered: true,
                swapCandidateAtClickId: current?.swapCandidateAtClickId ?? swapSnapshot.requestedReplacementId,
                swapTargetSlotIndexAtClick: current?.swapTargetSlotIndexAtClick ?? swapSnapshot.targetStopIndex,
                swapTargetRoleAtClick: current?.swapTargetRoleAtClick ?? swapSnapshot.targetRole,
                swapGuardFailureReason: null,
                swapCommitStarted: true,
                swapCommitFinished: true,
                swapModalClosedAfterCommit: true,
            }));
        }
        catch (nextError) {
            const reason = nextError instanceof Error ? nextError.message : 'Could not apply this swap option.';
            setSwapCompatibilityDebug((current) => {
                if (current && !current.swapCompatibilityPassed) {
                    return current;
                }
                return {
                    swapCompatibilityPassed: false,
                    swapCompatibilityReason: reason,
                    swapCompatibilityRejectClass: 'hard_structural',
                    preservedRole: current?.preservedRole ?? false,
                    preservedDistrict: current?.preservedDistrict ?? false,
                    preservedFamily: current?.preservedFamily ?? false,
                    preservedFeasibility: current?.preservedFeasibility ?? false,
                    softDirectionDriftDetected: current?.softDirectionDriftDetected ?? false,
                };
            });
            setSwapInteractionBreadcrumb((current) => ({
                swapClickFired: current?.swapClickFired ?? true,
                swapHandlerEntered: true,
                swapCandidateAtClickId: current?.swapCandidateAtClickId ?? swapSnapshot?.requestedReplacementId ?? null,
                swapTargetSlotIndexAtClick: current?.swapTargetSlotIndexAtClick ?? swapSnapshot?.targetStopIndex ?? null,
                swapTargetRoleAtClick: current?.swapTargetRoleAtClick ?? swapSnapshot?.targetRole ?? null,
                swapGuardFailureReason: reason,
                swapCommitStarted: true,
                swapCommitFinished: true,
                swapModalClosedAfterCommit: false,
            }));
            setError(reason);
        }
    };
    const handleSwapConfirmClick = () => {
        const swapSnapshot = previewSwap;
        const candidateIdAtClick = swapSnapshot?.requestedReplacementId ?? swapSnapshot?.candidateStop.venueId ?? null;
        const targetSlotIndexAtClick = swapSnapshot?.targetStopIndex ?? null;
        const targetRoleAtClick = swapSnapshot?.targetRole ?? null;
        const clickMissingReason = !swapSnapshot
            ? 'preview_swap_missing_at_click'
            : !candidateIdAtClick
                ? 'candidate_missing_at_click'
                : targetSlotIndexAtClick == null
                    ? 'target_slot_missing_at_click'
                    : !targetRoleAtClick
                        ? 'target_role_missing_at_click'
                        : null;
        setSwapInteractionBreadcrumb({
            swapClickFired: true,
            swapHandlerEntered: false,
            swapCandidateAtClickId: candidateIdAtClick,
            swapTargetSlotIndexAtClick: targetSlotIndexAtClick,
            swapTargetRoleAtClick: targetRoleAtClick,
            swapGuardFailureReason: clickMissingReason,
            swapCommitStarted: false,
            swapCommitFinished: false,
            swapModalClosedAfterCommit: false,
        });
        if (clickMissingReason || !swapSnapshot) {
            setSwapCompatibilityDebug({
                swapCompatibilityPassed: false,
                swapCompatibilityReason: `Swap click ignored: ${clickMissingReason ?? 'missing swap payload'}.`,
                swapCompatibilityRejectClass: 'hard_structural',
                preservedRole: false,
                preservedDistrict: false,
                preservedFamily: false,
                preservedFeasibility: false,
                softDirectionDriftDetected: false,
            });
            setError(`Swap click ignored: ${clickMissingReason ?? 'missing swap payload'}.`);
            return;
        }
        void handleApplyPreviewSwap({
            role: swapSnapshot.role,
            swapSnapshot,
            planSnapshot: plan,
            finalRouteSnapshot: finalRoute,
            routeVersionAtClick: routeVersion,
        });
    };
    const handleKeepCurrentSwap = (role) => {
        if (!previewSwap || previewSwap.role !== role) {
            return;
        }
        setPreviewSwap(undefined);
    };
    const handleLockNight = () => {
        if (!plan || !finalRoute || isLocking) {
            return;
        }
        setIsLocking(true);
        saveLiveArtifactSession({
            city: finalRoute.location || plan.itinerary.city || city.trim(),
            itinerary: plan.itinerary,
            selectedClusterConfirmation: plan.selectedClusterConfirmation,
            initialActiveRole: activeRole,
            lockedAt: Date.now(),
            finalRoute: {
                ...finalRoute,
                activeStopIndex: Math.max(0, finalRoute.stops.findIndex((stop) => stop.role === activeRole)),
            },
        });
        window.setTimeout(() => {
            window.location.assign('/journey/live');
        }, 220);
    };
    const planningDisplayStops = useMemo(() => {
        if (!plan || !finalRoute) {
            return [];
        }
        const stopBySourceId = new Map(plan.itinerary.stops.map((stop) => [stop.id, stop]));
        const stopByIndex = new Map(plan.itinerary.stops.map((stop, index) => [index, stop]));
        const orderedRouteStops = [...finalRoute.stops].sort((left, right) => left.stopIndex - right.stopIndex);
        return orderedRouteStops
            .map((finalStop) => {
            const sourceStop = stopBySourceId.get(finalStop.sourceStopId) ??
                stopByIndex.get(finalStop.stopIndex) ??
                plan.itinerary.stops.find((stop) => stop.role === finalStop.role && stop.venueId === finalStop.venueId) ??
                plan.itinerary.stops.find((stop) => stop.role === finalStop.role);
            if (!sourceStop) {
                return null;
            }
            return {
                ...sourceStop,
                id: finalStop.sourceStopId,
                role: finalStop.role,
                title: finalStop.title,
                subtitle: finalStop.subtitle,
                venueId: finalStop.venueId,
                venueName: finalStop.displayName,
                city: finalRoute.location || sourceStop.city,
                neighborhood: finalStop.neighborhood || sourceStop.neighborhood,
                driveMinutes: finalStop.driveMinutes,
                imageUrl: finalStop.imageUrl,
            };
        })
            .filter((stop) => Boolean(stop));
    }, [finalRoute, plan]);
    const postSwapCanonicalStopIdBySlot = useMemo(() => finalRoute
        ? [...finalRoute.stops]
            .sort((left, right) => left.stopIndex - right.stopIndex)
            .map((stop) => stop.venueId)
        : [], [finalRoute]);
    const postSwapRenderedStopIdBySlot = useMemo(() => planningDisplayStops.map((stop) => stop.venueId), [planningDisplayStops]);
    const selectedDirectionPreviewContext = useMemo(() => buildSelectedDirectionPreviewContext(selectedDirectionContract), [selectedDirectionContract]);
    const activePreviewDirectionContext = selectedDirectionPreviewContext ?? plan?.selectedDirectionPreviewContext;
    const selectedDirectionContractId = selectedDirectionContract?.id ?? plan?.selectedDirectionContract.id ?? null;
    const selectedDirectionPocketId = selectedDirectionContract?.pocketId ?? plan?.selectedDirectionContract.pocketId ?? null;
    const resolvedSelectedDirectionContext = selectedDirectionContext ?? plan?.selectedDirectionContext;
    const resolvedExperienceContract = plan?.experienceContract ?? canonicalExperienceContract;
    const resolvedContractConstraints = plan?.contractConstraints ?? canonicalContractConstraints;
    const resolvedConciergeIntent = plan?.conciergeIntent ?? canonicalConciergeIntent;
    const experienceContractSource = plan?.experienceContract
        ? 'plan.experienceContract'
        : 'canonicalExperienceContract';
    const contractConstraintsSource = plan?.contractConstraints
        ? 'plan.contractConstraints'
        : 'canonicalContractConstraints';
    const experienceContractActPattern = resolvedExperienceContract.actStructure.actPattern.join(' | ');
    const executionBridgeSummary = [
        `peak:${resolvedContractConstraints.peakCountModel}`,
        `movement:${resolvedContractConstraints.movementTolerance} -> radius:${(selectedRouteShapeContract ?? plan?.routeShapeContract)?.movementProfile.radius ?? 'n/a'}`,
        `continuity:${resolvedContractConstraints.requireContinuity ? 'required' : 'optional'}`,
        `windDown:${resolvedContractConstraints.windDownStrictness}`,
    ].join(' | ');
    const conciergeIntentSource = plan?.conciergeIntent ? 'plan.conciergeIntent' : 'canonicalConciergeIntent';
    const conciergeIntentId = resolvedConciergeIntent.id;
    const conciergeIntentMode = resolvedConciergeIntent.intentMode;
    const conciergeIntentObjectivePrimary = resolvedConciergeIntent.objective.primary;
    const conciergeIntentControlMode = resolvedConciergeIntent.controlPosture.mode;
    const conciergeIntentPersona = resolvedConciergeIntent.experienceProfile.persona;
    const conciergeIntentVibe = resolvedConciergeIntent.experienceProfile.vibe;
    const conciergeIntentAnchorMode = resolvedConciergeIntent.anchorPosture.mode;
    const conciergeIntentTravelTolerance = resolvedConciergeIntent.constraintPosture.travelTolerance;
    const conciergeIntentSwapTolerance = resolvedConciergeIntent.constraintPosture.swapTolerance;
    const activeRouteShapeContract = selectedRouteShapeContract ?? plan?.routeShapeContract;
    const routeShapeContractId = activeRouteShapeContract?.id ?? null;
    const routeShapeArcShape = activeRouteShapeContract?.arcShape ?? null;
    const routeShapeSwapFlexibility = activeRouteShapeContract?.mutationProfile.swapFlexibility ?? null;
    const routeShapeMovementRadius = activeRouteShapeContract?.movementProfile.radius ?? null;
    const selectedDirectionContextIdentity = resolvedSelectedDirectionContext?.identity ?? null;
    const selectedDirectionExperienceIdentity = selectedDirection?.debugMeta?.directionExperienceIdentity ?? 'n/a';
    const selectedDirectionPrimaryIdentitySource = selectedDirection?.debugMeta?.directionPrimaryIdentitySource ?? 'n/a';
    const selectedDirectionPeakModel = selectedDirection?.debugMeta?.directionPeakModel ?? 'n/a';
    const selectedDirectionMovementStyle = selectedDirection?.debugMeta?.directionMovementStyle ?? 'n/a';
    const selectedDirectionDistrictSupportSummary = selectedDirection?.debugMeta?.directionDistrictSupportSummary ?? 'n/a';
    const selectedDirectionStrategyId = selectedDirection?.debugMeta?.directionStrategyId ?? 'n/a';
    const selectedDirectionStrategyLabel = selectedDirection?.debugMeta?.directionStrategyLabel ?? 'n/a';
    const selectedDirectionStrategyFamily = selectedDirection?.debugMeta?.directionStrategyFamily ?? 'n/a';
    const selectedDirectionStrategySummary = selectedDirection?.debugMeta?.directionStrategySummary ?? 'n/a';
    const selectedDirectionStrategySource = selectedDirection?.debugMeta?.directionStrategySource ?? 'n/a';
    const selectedDirectionCollapseGuardApplied = String(selectedDirection?.debugMeta?.directionCollapseGuardApplied ?? false);
    const selectedDirectionStrategyOverlapSummary = selectedDirection?.debugMeta?.directionStrategyOverlapSummary ?? 'n/a';
    const selectedDirectionStrategyConstraintStatus = selectedDirection?.debugMeta
        ?.strategyConstraintStatus
        ? JSON.stringify(selectedDirection.debugMeta.strategyConstraintStatus)
        : 'n/a';
    const selectedDirectionStrategyPoolSize = selectedDirection?.debugMeta?.strategyPoolSize ?? 'n/a';
    const selectedDirectionStrategyRejectedCount = selectedDirection?.debugMeta?.strategyRejectedCount ?? 'n/a';
    const selectedDirectionStrategyHardGuardStatus = selectedDirection?.debugMeta?.strategyHardGuardStatus ?? 'n/a';
    const selectedDirectionStrategyHardGuardReason = selectedDirection?.debugMeta?.strategyHardGuardReason ?? 'n/a';
    const selectedContractGateApplied = String(selectedDirection?.debugMeta?.contractGateApplied ?? false);
    const selectedContractGateSummary = selectedDirection?.debugMeta?.contractGateSummary ?? 'n/a';
    const selectedContractGateStrengthSummary = selectedDirection?.debugMeta?.contractGateStrengthSummary ?? 'n/a';
    const selectedContractGateRejectedCount = selectedDirection?.debugMeta?.contractGateRejectedCount ?? 'n/a';
    const selectedContractGateAllowedPreview = selectedDirection?.debugMeta?.contractGateAllowedPreview?.join(',') ?? 'n/a';
    const selectedContractGateSuppressedPreview = selectedDirection?.debugMeta?.contractGateSuppressedPreview?.join(',') ?? 'n/a';
    const selectedDirectionContractGateStatus = selectedDirection?.debugMeta?.directionContractGateStatus ?? 'n/a';
    const selectedDirectionContractGateReasonSummary = selectedDirection?.debugMeta?.directionContractGateReasonSummary ?? 'n/a';
    const selectedStrategyWorld = strategyAdmissibleWorlds.find((world) => world.strategyId === selectedDirectionStrategyId);
    const selectedStrategyWorldId = selectedDirection?.debugMeta?.selectedStrategyWorldId ??
        selectedStrategyWorld?.strategyId ??
        'n/a';
    const selectedStrategyWorldSource = selectedDirection?.debugMeta?.strategyWorldSource ??
        selectedStrategyWorld?.source ??
        'n/a';
    const selectedStrategyWorldSummary = selectedDirection?.debugMeta?.strategyWorldSummary ??
        selectedStrategyWorld?.summary ??
        'n/a';
    const selectedStrategyWorldAdmittedCount = selectedDirection?.debugMeta?.strategyWorldAdmittedCount ??
        selectedStrategyWorld?.debug.admittedCount ??
        'n/a';
    const selectedStrategyWorldSuppressedCount = selectedDirection?.debugMeta?.strategyWorldSuppressedCount ??
        selectedStrategyWorld?.debug.suppressedCount ??
        'n/a';
    const selectedStrategyWorldRejectedCount = selectedDirection?.debugMeta?.strategyWorldRejectedCount ??
        selectedStrategyWorld?.debug.rejectedCount ??
        'n/a';
    const selectedStrategyWorldAllowedPreview = selectedDirection?.debugMeta?.strategyWorldAllowedPreview ??
        selectedStrategyWorld?.debug.allowedPreview ??
        'n/a';
    const selectedStrategyWorldSuppressedPreview = selectedDirection?.debugMeta?.strategyWorldSuppressedPreview ??
        selectedStrategyWorld?.debug.suppressedPreview ??
        'n/a';
    const selectedDirectionStrategyWorldStatus = selectedDirection?.debugMeta?.directionStrategyWorldStatus ?? 'n/a';
    const selectedDirectionStrategyWorldReasonSummary = selectedDirection?.debugMeta?.directionStrategyWorldReasonSummary ?? 'n/a';
    const selectedDirectionNarrativeSource = selectedDirection?.debugMeta?.directionNarrativeSource ?? 'n/a';
    const selectedDirectionNarrativeMode = selectedDirection?.debugMeta?.directionNarrativeMode ?? 'n/a';
    const selectedDirectionNarrativeSummary = selectedDirection?.debugMeta?.directionNarrativeSummary ?? 'n/a';
    const generationDriftReason = generationContractDebug?.generationDriftReason ?? null;
    const contractBuildabilityStatus = generationContractDebug?.contractBuildabilityStatus ?? null;
    const missingRoleForContract = generationContractDebug?.missingRoleForContract ?? null;
    const candidatePoolSufficiencyByRole = generationContractDebug?.candidatePoolSufficiencyByRole;
    const expectedDirectionIdentity = generationContractDebug?.expectedDirectionIdentity ?? null;
    const observedDirectionIdentity = generationContractDebug?.observedDirectionIdentity ?? null;
    const generationIdentityFallbackApplied = generationContractDebug?.fallbackApplied ?? false;
    const candidatePoolSufficiencySummary = candidatePoolSufficiencyByRole
        ? `start:${candidatePoolSufficiencyByRole.start} | highlight:${candidatePoolSufficiencyByRole.highlight} | windDown:${candidatePoolSufficiencyByRole.windDown}`
        : null;
    const swapCanonicalIdentityCacheResolvedCount = Object.keys(swapCanonicalIdentityByVenueId).length;
    const swapCanonicalIdentityCacheMissingCount = Object.keys(swapCanonicalIdentityMissingByVenueId).length;
    const tasteCurationDebug = plan?.tasteCurationDebug;
    const highlightQualificationScore = typeof tasteCurationDebug?.highlightQualificationScore === 'number'
        ? formatTasteScore(tasteCurationDebug.highlightQualificationScore)
        : 'n/a';
    const highlightQualificationPassed = tasteCurationDebug?.highlightQualificationPassed == null
        ? 'n/a'
        : String(tasteCurationDebug.highlightQualificationPassed);
    const tasteRoleEligibilityByRoleSummary = tasteCurationDebug
        ? `start:${tasteCurationDebug.tasteRoleEligibilityByRole.start} | highlight:${tasteCurationDebug.tasteRoleEligibilityByRole.highlight} | windDown:${tasteCurationDebug.tasteRoleEligibilityByRole.windDown}`
        : 'n/a';
    const personaVibeTasteBiasSummary = tasteCurationDebug?.personaVibeTasteBiasSummary ?? 'n/a';
    const venuePersonalitySummary = tasteCurationDebug?.venuePersonalitySummary ?? 'n/a';
    const highlightPoolCountBefore = tasteCurationDebug?.highlightPoolCountBefore ?? 0;
    const highlightPoolCountAfter = tasteCurationDebug?.highlightPoolCountAfter ?? 0;
    const rolePoolCountByRoleBeforeSummary = tasteCurationDebug
        ? `start:${tasteCurationDebug.rolePoolCountByRoleBefore.start} | highlight:${tasteCurationDebug.rolePoolCountByRoleBefore.highlight} | windDown:${tasteCurationDebug.rolePoolCountByRoleBefore.windDown}`
        : 'n/a';
    const rolePoolCountByRoleAfterSummary = tasteCurationDebug
        ? `start:${tasteCurationDebug.rolePoolCountByRoleAfter.start} | highlight:${tasteCurationDebug.rolePoolCountByRoleAfter.highlight} | windDown:${tasteCurationDebug.rolePoolCountByRoleAfter.windDown}`
        : 'n/a';
    const signatureHighlightShortlistCount = tasteCurationDebug?.signatureHighlightShortlistCount ?? 0;
    const signatureHighlightShortlistIds = tasteCurationDebug && tasteCurationDebug.signatureHighlightShortlistIds.length > 0
        ? tasteCurationDebug.signatureHighlightShortlistIds.join(', ')
        : 'n/a';
    const highlightShortlistScoreSummary = tasteCurationDebug?.highlightShortlistScoreSummary ?? 'n/a';
    const selectedHighlightFromShortlist = String(tasteCurationDebug?.selectedHighlightFromShortlist ?? false);
    const selectedHighlightShortlistRank = tasteCurationDebug?.selectedHighlightShortlistRank ?? 'n/a';
    const fallbackToQualifiedHighlightPool = String(tasteCurationDebug?.fallbackToQualifiedHighlightPool ?? false);
    const upstreamPoolSelectionApplied = String(tasteCurationDebug?.upstreamPoolSelectionApplied ?? false);
    const postGenerationRepairCount = tasteCurationDebug?.postGenerationRepairCount ?? 0;
    const thinPoolHighlightFallbackApplied = String(tasteCurationDebug?.thinPoolHighlightFallbackApplied ?? false);
    const scenarioKey = `${persona}|${normalizeExperienceContractVibe(primaryVibe)}`;
    const topPocketDebugRows = contractAwareDistrictRanking.ranked.slice(0, 6).map((entry) => ({
        pocketId: entry.profile.pocketId,
        debug: contractAwareDistrictRanking.pocketDebugById[entry.profile.pocketId],
    }));
    const topPocketIds = topPocketDebugRows.map((entry) => entry.pocketId);
    const topPocketContractFitDeltas = topPocketDebugRows.map((entry) => `${entry.pocketId}:${formatSignedScore(entry.debug?.contractFitDelta ?? 0)}`);
    const topPocketContractFitReasons = topPocketDebugRows.map((entry) => {
        const reasons = entry.debug?.contractFitReasons?.slice(0, 2).join(' & ') ?? 'n/a';
        return `${entry.pocketId}:${reasons}`;
    });
    const directionCandidatePocketIds = dedupeStringIds(directionCards.map((entry) => entry.id));
    const directionStrategyIds = dedupeStringIds(directionCards.map((entry) => entry.debugMeta?.directionStrategyId ?? null));
    const retrievalContractApplied = plan?.generationTrace.retrievalContractApplied ?? false;
    const retrievedVenueIds = dedupeStringIds(plan?.generationTrace.retrievedVenueIds ??
        plan?.scoredVenues.map((venue) => venue.venue.id) ??
        []);
    const rolePoolVenueIdsByRole = plan?.generationTrace.rolePoolVenueIdsByRole;
    const rolePoolVenueIdsByRoleSummary = rolePoolVenueIdsByRole
        ? `start:${formatIdList(rolePoolVenueIdsByRole.start)} | highlight:${formatIdList(rolePoolVenueIdsByRole.highlight)} | windDown:${formatIdList(rolePoolVenueIdsByRole.windDown)}`
        : 'n/a';
    const rolePoolVenueIds = dedupeStringIds(plan?.generationTrace.rolePoolVenueIdsCombined ??
        tasteCurationDebug?.rolePoolVenueIdsCombined ??
        []);
    const contractInfluenceSummary = plan?.generationTrace.contractInfluenceSummary ??
        'retrieval:none|highlight:none|windDown:none';
    const highlightShortlistIds = dedupeStringIds(tasteCurationDebug?.signatureHighlightShortlistIds ?? []);
    const finalStopVenueIds = dedupeStringIds(finalRoute?.stops
        .slice()
        .sort((left, right) => left.stopIndex - right.stopIndex)
        .map((stop) => stop.venueId) ?? []);
    const stageOverlapFingerprint = useMemo(() => ({
        scenarioKey,
        topPocketIds,
        directionCandidatePocketIds,
        retrievedVenueIds,
        rolePoolVenueIds,
        highlightShortlistIds,
        finalStopVenueIds,
    }), [
        directionCandidatePocketIds,
        finalStopVenueIds,
        highlightShortlistIds,
        retrievedVenueIds,
        rolePoolVenueIds,
        scenarioKey,
        topPocketIds,
    ]);
    const topPocketIdsSummary = formatIdList(stageOverlapFingerprint.topPocketIds);
    const directionCandidatePocketIdsSummary = formatIdList(stageOverlapFingerprint.directionCandidatePocketIds);
    const retrievedVenueIdsSummary = formatIdList(stageOverlapFingerprint.retrievedVenueIds);
    const rolePoolVenueIdsSummary = formatIdList(stageOverlapFingerprint.rolePoolVenueIds);
    const highlightShortlistIdsSummary = formatIdList(stageOverlapFingerprint.highlightShortlistIds);
    const finalStopVenueIdsSummary = formatIdList(stageOverlapFingerprint.finalStopVenueIds);
    const topPocketContractFitDeltasSummary = formatIdList(topPocketContractFitDeltas);
    const topPocketContractFitReasonsSummary = formatIdList(topPocketContractFitReasons);
    const trackedScenarioKeys = Object.keys(stageFingerprintsByScenario).sort();
    const trackedScenarioKeysSummary = trackedScenarioKeys.join(' | ') || 'n/a';
    const scenarioJaccardByStage = useMemo(() => {
        const comparisons = Object.entries(stageFingerprintsByScenario)
            .filter(([key]) => key !== stageOverlapFingerprint.scenarioKey)
            .map(([key, fingerprint]) => {
            const topPocketOverlap = computeJaccardOverlap(stageOverlapFingerprint.topPocketIds, fingerprint.topPocketIds);
            const directionPocketOverlap = computeJaccardOverlap(stageOverlapFingerprint.directionCandidatePocketIds, fingerprint.directionCandidatePocketIds);
            const retrievedVenueOverlap = computeJaccardOverlap(stageOverlapFingerprint.retrievedVenueIds, fingerprint.retrievedVenueIds);
            const rolePoolOverlap = computeJaccardOverlap(stageOverlapFingerprint.rolePoolVenueIds, fingerprint.rolePoolVenueIds);
            const shortlistOverlap = computeJaccardOverlap(stageOverlapFingerprint.highlightShortlistIds, fingerprint.highlightShortlistIds);
            const finalStopOverlap = computeJaccardOverlap(stageOverlapFingerprint.finalStopVenueIds, fingerprint.finalStopVenueIds);
            return `${key}[pockets:${formatJaccard(topPocketOverlap)} dir:${formatJaccard(directionPocketOverlap)} retrieved:${formatJaccard(retrievedVenueOverlap)} pools:${formatJaccard(rolePoolOverlap)} shortlist:${formatJaccard(shortlistOverlap)} final:${formatJaccard(finalStopOverlap)}]`;
        })
            .sort((left, right) => left.localeCompare(right));
        return comparisons.length > 0 ? comparisons.join(' | ') : 'n/a';
    }, [stageFingerprintsByScenario, stageOverlapFingerprint]);
    const setDebugExpanded = useCallback((key, nextExpanded) => {
        setDebugExpandedByKey((current) => ({
            ...current,
            [key]: nextExpanded,
        }));
    }, []);
    const toggleDebugExpanded = useCallback((key) => {
        setDebugExpandedByKey((current) => ({
            ...current,
            [key]: !current[key],
        }));
    }, []);
    const isDebugExpanded = useCallback((key) => Boolean(debugExpandedByKey[key]), [debugExpandedByKey]);
    const selectedStartTasteSignals = useMemo(() => getFoundationTasteSignalsForRole(plan, 'start'), [plan]);
    const selectedHighlightTasteSignals = useMemo(() => getFoundationTasteSignalsForRole(plan, 'highlight'), [plan]);
    const selectedWindDownTasteSignals = useMemo(() => getFoundationTasteSignalsForRole(plan, 'windDown'), [plan]);
    const selectedStartTasteSignalsSummary = formatTasteSignalSummary(selectedStartTasteSignals);
    const selectedHighlightTasteSignalsSummary = formatTasteSignalSummary(selectedHighlightTasteSignals);
    const selectedWindDownTasteSignalsSummary = formatTasteSignalSummary(selectedWindDownTasteSignals);
    const selectedStartTasteRoleSuitabilitySummary = formatTasteRoleSuitabilitySummary(selectedStartTasteSignals);
    const selectedHighlightTasteRoleSuitabilitySummary = formatTasteRoleSuitabilitySummary(selectedHighlightTasteSignals);
    const selectedWindDownTasteRoleSuitabilitySummary = formatTasteRoleSuitabilitySummary(selectedWindDownTasteSignals);
    const selectedStartTastePersonalitySummary = formatTastePersonalitySummary(selectedStartTasteSignals);
    const selectedHighlightTastePersonalitySummary = formatTastePersonalitySummary(selectedHighlightTasteSignals);
    const selectedWindDownTastePersonalitySummary = formatTastePersonalitySummary(selectedWindDownTasteSignals);
    const selectedHighlightTasteTier = selectedHighlightTasteSignals?.highlightTier ?? 'n/a';
    const selectedHighlightTasteDuration = selectedHighlightTasteSignals?.durationEstimate ?? 'n/a';
    const selectedHighlightTasteNovelty = typeof selectedHighlightTasteSignals?.noveltyWeight === 'number'
        ? formatTasteScore(selectedHighlightTasteSignals.noveltyWeight)
        : 'n/a';
    const selectedHighlightTasteSourceMode = selectedHighlightTasteSignals?.debug.sourceMode ?? 'n/a';
    const selectedHighlightTasteSeedCalibratedApplied = String(selectedHighlightTasteSignals?.debug.seedCalibratedApplied ?? false);
    const selectedHighlightRoleContrast = formatHighlightRoleContrastSummary(selectedHighlightTasteSignals);
    const selectedHighlightTierReason = formatHighlightTierReasonSummary(selectedHighlightTasteSignals);
    const selectedHighlightEnergyBand = formatEnergyBand(selectedHighlightTasteSignals?.energy);
    const selectedHighlightSocialDensityBand = formatSocialDensityBand(selectedHighlightTasteSignals?.socialDensity);
    const selectedHighlightVibeFit = formatSelectedHighlightVibeFit(selectedHighlightTasteSignals, conciergeIntentPersona, conciergeIntentVibe);
    const vibePressureSummary = formatVibePressureSummary(selectedHighlightTasteSignals, conciergeIntentPersona, conciergeIntentVibe);
    const toneSeparationSummary = formatToneSeparationSummary(selectedHighlightTasteSignals);
    const routeShapeStartInvariantSummary = activeRouteShapeContract
        ? formatRoleInvariantSummary(activeRouteShapeContract.roleInvariants.start)
        : 'n/a';
    const routeShapeHighlightInvariantSummary = activeRouteShapeContract
        ? formatRoleInvariantSummary(activeRouteShapeContract.roleInvariants.highlight)
        : 'n/a';
    const routeShapeWindDownInvariantSummary = activeRouteShapeContract
        ? formatRoleInvariantSummary(activeRouteShapeContract.roleInvariants.windDown)
        : 'n/a';
    const preview = useMemo(() => {
        if (finalRoute &&
            selectedDirectionContractId &&
            finalRoute.selectedDirectionId === selectedDirectionContractId) {
            return buildPreviewFromFinalRoute(finalRoute);
        }
        return selectedDirection ? buildPreviewFromDirection(selectedDirection, persona) : null;
    }, [finalRoute, persona, selectedDirection, selectedDirectionContractId]);
    const previewDirectionId = preview?.directionId ?? null;
    const finalRouteDirectionId = finalRoute?.selectedDirectionId ?? null;
    const selectedDirectionContextId = resolvedSelectedDirectionContext?.selectedDirectionId ?? null;
    const directionSyncMismatch = Boolean(selectedDirectionContractId &&
        ((previewDirectionId && previewDirectionId !== selectedDirectionContractId) ||
            (selectedDirectionContextId && selectedDirectionContextId !== selectedDirectionContractId) ||
            (finalRouteDirectionId && finalRouteDirectionId !== selectedDirectionContractId)));
    const directionSyncStatus = !selectedDirectionContractId
        ? 'no_selection'
        : loading
            ? 'building'
            : !finalRoute
                ? 'awaiting_generation'
                : directionSyncMismatch
                    ? 'mismatch'
                    : 'synced';
    const previewSynced = Boolean(finalRoute) &&
        Boolean(selectedDirectionContractId) &&
        previewDirectionId === selectedDirectionContractId &&
        finalRouteDirectionId === selectedDirectionContractId;
    const debugViewModel = useMemo(() => {
        const rolePoolCountsSummary = rolePoolVenueIdsByRole
            ? `start:${rolePoolVenueIdsByRole.start.length}/highlight:${rolePoolVenueIdsByRole.highlight.length}/windDown:${rolePoolVenueIdsByRole.windDown.length}`
            : 'start:0/highlight:0/windDown:0';
        const interpretationBundlePresent = true;
        const interpretationBundleSource = canonicalInterpretationBundle.debug.bundleSource;
        const interpretationBundleSummary = `${canonicalInterpretationBundle.strategyFamily} | ${canonicalInterpretationBundle.contractSummary}`;
        const contractGateWorldPresent = contractGateWorld.debug.contractGateWorldPresent;
        const contractGateWorldSource = contractGateWorld.debug.contractGateWorldSource;
        const contractGateWorldSummary = contractGateWorld.debug.contractGateWorldSummary;
        const contractGateWorldRejectedCount = contractGateWorld.debug.rejectedCount;
        const contractGateWorldAllowedPreview = contractGateWorld.debug.allowedPreview.join(',') || 'n/a';
        const contractGateWorldSuppressedPreview = contractGateWorld.debug.suppressedPreview.join(',') || 'n/a';
        const strategyWorldsPresent = strategyAdmissibleWorlds.length > 0;
        const strategyWorldIds = strategyAdmissibleWorlds.map((world) => world.strategyId).join(',') || 'n/a';
        const contractSummary = `${resolvedExperienceContract.contractIdentity} | ${resolvedExperienceContract.coordinationMode} | ${resolvedExperienceContract.highlightModel} | ${resolvedExperienceContract.movementStyle}`;
        const constraintSummary = `${resolvedContractConstraints.peakCountModel} | continuity:${resolvedContractConstraints.requireContinuity ? 'on' : 'off'} | escalation:${resolvedContractConstraints.requireEscalation ? 'on' : 'off'} | windDown:${resolvedContractConstraints.windDownStrictness}`;
        const directionSummary = `top=${topPocketIds.slice(0, 3).join(',') || 'n/a'} | strategy=${selectedDirectionStrategyLabel} | ids=${directionStrategyIds.join(',') || 'n/a'}`;
        const generationSummary = `retrieval:${retrievalContractApplied ? 'on' : 'off'} | pools ${rolePoolCountsSummary} | shortlist:${highlightShortlistIds.length} | final:${finalStopVenueIds.length}`;
        const swapRequestedReplacementId = swapDebugBreadcrumb?.swapRequestedReplacementId ?? 'n/a';
        const swapAppliedReplacementId = swapDebugBreadcrumb?.swapAppliedReplacementId ?? 'n/a';
        const swapCompatibilityReason = swapCompatibilityDebug?.swapCompatibilityReason ?? 'n/a';
        const directionSyncStatusMarker = directionSyncStatus === 'synced'
            ? 'OK'
            : directionSyncStatus === 'mismatch'
                ? 'FAIL'
                : 'WARN';
        const generationDriftMarker = generationDriftReason ? 'FAIL' : 'OK';
        const missingRoleMarker = missingRoleForContract ? `WARN ${missingRoleForContract}` : 'OK';
        const swapMarker = swapDebugBreadcrumb
            ? swapDebugBreadcrumb.swapCommitSucceeded && !swapDebugBreadcrumb.mismatch
                ? 'OK'
                : 'FAIL'
            : 'OK';
        const runtimeSummary = `sync:${directionSyncStatusMarker.toLowerCase()} | drift:${generationDriftReason ?? 'none'} | missingRole:${missingRoleForContract ?? 'none'} | swap:last ${swapMarker === 'OK' ? 'ok' : 'issue'}`;
        const topPocketContractFitReasonsCompact = topPocketContractFitReasons.map((reason) => truncateText(reason, 92));
        const comparisons = Object.entries(stageFingerprintsByScenario)
            .filter(([key]) => key !== stageOverlapFingerprint.scenarioKey)
            .sort((left, right) => left[0].localeCompare(right[0]));
        const compareSummary = comparisons.length === 0
            ? 'no comparison yet'
            : (() => {
                const [targetKey, fingerprint] = comparisons[0];
                const topPocketOverlap = computeJaccardOverlap(stageOverlapFingerprint.topPocketIds, fingerprint.topPocketIds);
                const retrievedVenueOverlap = computeJaccardOverlap(stageOverlapFingerprint.retrievedVenueIds, fingerprint.retrievedVenueIds);
                const rolePoolOverlap = computeJaccardOverlap(stageOverlapFingerprint.rolePoolVenueIds, fingerprint.rolePoolVenueIds);
                const shortlistOverlap = computeJaccardOverlap(stageOverlapFingerprint.highlightShortlistIds, fingerprint.highlightShortlistIds);
                const finalStopOverlap = computeJaccardOverlap(stageOverlapFingerprint.finalStopVenueIds, fingerprint.finalStopVenueIds);
                return `vs ${targetKey} | pockets ${formatJaccard(topPocketOverlap)} | retrieved ${formatJaccard(retrievedVenueOverlap)} | pools ${formatJaccard(rolePoolOverlap)} | shortlist ${formatJaccard(shortlistOverlap)} | final ${formatJaccard(finalStopOverlap)}`;
            })();
        return {
            rolePoolCountsSummary,
            interpretationBundlePresent,
            interpretationBundleSource,
            interpretationBundleSummary,
            contractGateWorldPresent,
            contractGateWorldSource,
            contractGateWorldSummary,
            contractGateWorldRejectedCount,
            contractGateWorldAllowedPreview,
            contractGateWorldSuppressedPreview,
            strategyWorldsPresent,
            strategyWorldIds,
            contractSummary,
            constraintSummary,
            directionSummary,
            generationSummary,
            swapRequestedReplacementId,
            swapAppliedReplacementId,
            swapCompatibilityReason,
            directionSyncStatusMarker,
            generationDriftMarker,
            missingRoleMarker,
            swapMarker,
            runtimeSummary,
            topPocketContractFitReasonsCompact,
            compareSummary,
        };
    }, [
        directionSyncStatus,
        canonicalInterpretationBundle,
        contractGateWorld,
        strategyAdmissibleWorlds,
        finalStopVenueIds,
        generationDriftReason,
        highlightShortlistIds,
        missingRoleForContract,
        resolvedContractConstraints,
        resolvedExperienceContract,
        retrievalContractApplied,
        rolePoolVenueIdsByRole,
        selectedDirectionExperienceIdentity,
        selectedDirectionStrategyLabel,
        stageFingerprintsByScenario,
        stageOverlapFingerprint,
        swapCompatibilityDebug,
        swapDebugBreadcrumb,
        topPocketIds,
        topPocketContractFitReasons,
        directionStrategyIds,
    ]);
    const { rolePoolCountsSummary, interpretationBundlePresent, interpretationBundleSource, interpretationBundleSummary, contractGateWorldPresent, contractGateWorldSource, contractGateWorldSummary, contractGateWorldRejectedCount, contractGateWorldAllowedPreview, contractGateWorldSuppressedPreview, strategyWorldsPresent, strategyWorldIds, contractSummary, constraintSummary, directionSummary, generationSummary, swapRequestedReplacementId, swapAppliedReplacementId, swapCompatibilityReason, directionSyncStatusMarker, generationDriftMarker, missingRoleMarker, swapMarker, runtimeSummary, topPocketContractFitReasonsCompact, compareSummary, } = debugViewModel;
    useEffect(() => {
        if (!stageOverlapFingerprint.scenarioKey) {
            return;
        }
        setStageFingerprintsByScenario((current) => {
            const existing = current[stageOverlapFingerprint.scenarioKey];
            if (areStageOverlapFingerprintsEqual(existing, stageOverlapFingerprint)) {
                return current;
            }
            return {
                ...current,
                [stageOverlapFingerprint.scenarioKey]: stageOverlapFingerprint,
            };
        });
    }, [stageOverlapFingerprint]);
    useEffect(() => {
        if (!import.meta.env.DEV || !finalRoute) {
            return;
        }
        console.log('ROUTE TRUTH CHECK', {
            routeVersion,
            routeId: finalRoute.routeId,
            selectedDirectionId: finalRoute.selectedDirectionId,
            stopNames: finalRoute.stops.map((stop) => stop.displayName),
            stopRoles: finalRoute.stops.map((stop) => stop.role),
            stopIds: finalRoute.stops.map((stop) => stop.id || stop.providerRecordId),
        });
    }, [finalRoute, routeVersion]);
    useEffect(() => {
        if (!import.meta.env.DEV) {
            return;
        }
        console.log('DIRECTION REBUILD CHECK', {
            persona,
            vibe: primaryVibe,
            directionIds: directionCards.map((direction) => direction.id),
            selectedDirectionId,
        });
    }, [directionCards, persona, primaryVibe, selectedDirectionId]);
    useEffect(() => {
        if (!import.meta.env.DEV) {
            return;
        }
        console.log('SYNC CHECK', {
            selectedDirectionId: selectedDirectionContractId,
            selectedDirectionPocketId,
            previewDirectionId,
            finalRouteDirectionId,
            previewStops: preview?.stops?.map((stop) => stop.name),
        });
    }, [finalRouteDirectionId, preview, previewDirectionId, selectedDirectionContractId, selectedDirectionPocketId]);
    useEffect(() => {
        if (!import.meta.env.DEV || !swapDebugBreadcrumb) {
            return;
        }
        console.log('SWAP BREADCRUMB', swapDebugBreadcrumb);
    }, [swapDebugBreadcrumb]);
    useEffect(() => {
        if (!import.meta.env.DEV || !swapInteractionBreadcrumb) {
            return;
        }
        console.log('SWAP INTERACTION', swapInteractionBreadcrumb);
    }, [swapInteractionBreadcrumb]);
    useEffect(() => {
        if (!import.meta.env.DEV || !swapCompatibilityDebug) {
            return;
        }
        console.log('SWAP COMPATIBILITY', swapCompatibilityDebug);
    }, [swapCompatibilityDebug]);
    useEffect(() => {
        if (!swapDebugBreadcrumb) {
            return;
        }
        setSwapDebugBreadcrumb((current) => {
            if (!current) {
                return current;
            }
            const canonicalAtTarget = postSwapCanonicalStopIdBySlot[current.swapTargetSlotIndex] ?? null;
            const renderedAtTarget = postSwapRenderedStopIdBySlot[current.swapTargetSlotIndex] ?? null;
            const canonicalRenderMismatch = canonicalAtTarget !== renderedAtTarget;
            const canonicalRequestMismatch = canonicalAtTarget !== current.swapRequestedReplacementId;
            const nextMismatch = current.mismatch || canonicalRenderMismatch || canonicalRequestMismatch;
            const next = {
                ...current,
                postSwapCanonicalStopIdBySlot,
                postSwapRenderedStopIdBySlot,
                mismatch: nextMismatch,
                swapCommitSucceeded: current.swapCommitSucceeded &&
                    !canonicalRenderMismatch &&
                    !canonicalRequestMismatch &&
                    current.swapAppliedReplacementId === current.swapRequestedReplacementId,
            };
            const canonicalUnchanged = JSON.stringify(current.postSwapCanonicalStopIdBySlot ?? []) ===
                JSON.stringify(next.postSwapCanonicalStopIdBySlot ?? []);
            const renderedUnchanged = JSON.stringify(current.postSwapRenderedStopIdBySlot ?? []) ===
                JSON.stringify(next.postSwapRenderedStopIdBySlot ?? []);
            if (canonicalUnchanged &&
                renderedUnchanged &&
                current.mismatch === next.mismatch &&
                current.swapCommitSucceeded === next.swapCommitSucceeded) {
                return current;
            }
            return next;
        });
    }, [postSwapCanonicalStopIdBySlot, postSwapRenderedStopIdBySlot, swapDebugBreadcrumb]);
    const guidedRouteStops = useMemo(() => finalRoute
        ? [...finalRoute.stops]
            .sort((left, right) => left.stopIndex - right.stopIndex)
            .map((stop) => ({
            id: stop.id,
            role: stop.role,
            name: stop.displayName,
            displayName: stop.displayName,
            stopIndex: stop.stopIndex,
            latitude: stop.latitude,
            longitude: stop.longitude,
        }))
        : [], [finalRoute]);
    const guidedWaypointOverrides = useMemo(() => Object.fromEntries(guidedRouteStops.map((stop) => [
        stop.role,
        typeof stop.latitude === 'number' && typeof stop.longitude === 'number'
            ? {
                name: stop.displayName ?? stop.name,
                coordinates: [stop.longitude, stop.latitude],
            }
            : {
                name: stop.displayName ?? stop.name,
            },
    ])), [guidedRouteStops]);
    const guidedActiveStop = useMemo(() => {
        if (guidedRouteStops.length === 0) {
            return undefined;
        }
        return guidedRouteStops.find((stop) => stop.role === activeRole) ?? guidedRouteStops[0];
    }, [activeRole, guidedRouteStops]);
    const guidedActiveStopIndex = useMemo(() => {
        if (!guidedActiveStop) {
            return undefined;
        }
        const index = guidedRouteStops.findIndex((stop) => stop.id === guidedActiveStop.id);
        return index >= 0 ? index : undefined;
    }, [guidedActiveStop, guidedRouteStops]);
    useEffect(() => {
        if (!import.meta.env.DEV || !finalRoute) {
            return;
        }
        console.log('MAP REFRESH CHECK', {
            routeId: finalRoute.routeId,
            activeStopId: guidedActiveStop?.id ?? null,
            activeStopIndex: guidedActiveStopIndex ?? null,
            mapStopNames: guidedRouteStops.map((stop) => stop.displayName || stop.name),
        });
    }, [finalRoute, guidedActiveStop?.id, guidedActiveStopIndex, guidedRouteStops]);
    useEffect(() => {
        if (!import.meta.env.DEV || !verticalDebugEnabled || !finalRoute) {
            return;
        }
        console.log('ROUTE SURFACE CHECK: preview', { routeId: finalRoute.routeId });
        console.log('ROUTE SURFACE CHECK: map', { routeId: finalRoute.routeId });
        console.log('ROUTE SURFACE CHECK: spine', { routeId: finalRoute.routeId });
    }, [finalRoute, verticalDebugEnabled]);
    const { inlineDetailsByRole, swapCandidatePrefilterDebugByRole, } = useMemo(() => {
        if (!plan) {
            return {
                inlineDetailsByRole: {},
                swapCandidatePrefilterDebugByRole: {},
            };
        }
        const detailEntries = planningDisplayStops.map((stop) => {
            const scoredVenue = findScoredVenueForStop(stop, plan.selectedArc);
            const inlineDetail = getInlineStopDetail(stop, plan.intentProfile, plan.scoredVenues, planningDisplayStops, plan.selectedArc, plan.lens, {
                roleTravelWindowMinutes: getRoleTravelWindow(plan.itinerary, stop.role),
                nearbySummary: nearbySummaryByRole[stop.role],
                routeShapeContract: plan.routeShapeContract,
                baselineItinerary: plan.itinerary,
                finalRouteSnapshot: finalRoute,
                canonicalSwapIdentityByVenueId: swapCanonicalIdentityByVenueId,
                experienceContract: plan.experienceContract,
                contractConstraints: plan.contractConstraints,
            });
            const canonical = canonicalStopByRole[stop.role];
            inlineDetail.venueLinkUrl =
                canonical
                    ? buildVenueLinkUrl(stop, canonical.displayName, {
                        providerRecordId: canonical.providerRecordId,
                        latitude: canonical.latitude,
                        longitude: canonical.longitude,
                        venueName: canonical.displayName,
                    })
                    : buildVenueLinkUrl(stop, stop.venueName, {
                        providerRecordId: scoredVenue?.venue.source.providerRecordId,
                        latitude: scoredVenue?.venue.source.latitude,
                        longitude: scoredVenue?.venue.source.longitude,
                        venueName: scoredVenue?.venue.name,
                    });
            const nearbySummary = nearbySummaryByRole[stop.role];
            if (nearbySummary) {
                inlineDetail.aroundHereSignals = [
                    nearbySummary,
                    ...(inlineDetail.aroundHereSignals ?? []),
                ].slice(0, 2);
            }
            return [stop.role, inlineDetail];
        });
        const prefilterEntries = detailEntries.map(([role, detail]) => [
            role,
            detail.swapCandidatePrefilterDebug,
        ]);
        return {
            inlineDetailsByRole: Object.fromEntries(detailEntries),
            swapCandidatePrefilterDebugByRole: Object.fromEntries(prefilterEntries),
        };
    }, [
        canonicalStopByRole,
        finalRoute,
        nearbySummaryByRole,
        plan,
        planningDisplayStops,
        swapCanonicalIdentityByVenueId,
    ]);
    const activeStopInlineDetail = inlineDetailsByRole[activeRole];
    const activeStopNarrativeMode = activeStopInlineDetail?.stopNarrativeMode ?? 'n/a';
    const activeStopNarrativeSource = activeStopInlineDetail?.stopNarrativeSource ?? 'n/a';
    const activeStopFlavorSummary = activeStopInlineDetail?.stopFlavorSummary ?? 'n/a';
    const activeStopTransitionSummary = activeStopInlineDetail?.stopTransitionSummary ?? 'n/a';
    const activeSwapCandidatePrefilterDebug = swapCandidatePrefilterDebugByRole[activeRole];
    const appliedSwapNoteByRole = useMemo(() => {
        if (!appliedSwapRole) {
            return {};
        }
        return {
            [appliedSwapRole]: 'Adjusted while keeping your flow intact',
        };
    }, [appliedSwapRole]);
    const postSwapHintByRole = useMemo(() => {
        if (!appliedSwapRole || !plan) {
            return {};
        }
        const hintRole = getPostSwapHintRole(appliedSwapRole);
        const hintText = getPostSwapHintText(appliedSwapRole);
        if (!hintRole || !hintText || !plan.itinerary.stops.some((stop) => stop.role === hintRole)) {
            return {};
        }
        return {
            [hintRole]: hintText,
        };
    }, [appliedSwapRole, plan]);
    return (_jsxs(PageShell, { className: "sandbox-concierge-shell", topSlot: _jsx(ID8Butler, { message: "Pick a direction, review your route, and lock tonight when it feels right." }), title: "ID.8 Concierge", subtitle: "Plan tonight in minutes.", children: [_jsxs("div", { className: "demo-flow-frame concierge-flow", children: [_jsx("p", { className: "concierge-context-line", children: "Thoughtfully planned using real-time local context." }), _jsxs("div", { style: {
                            border: '1px solid #d7dde2',
                            background: '#f8fafb',
                            color: '#31414b',
                            padding: '0.55rem 0.7rem',
                            borderRadius: '10px',
                            fontSize: '0.79rem',
                            lineHeight: 1.45,
                        }, children: [_jsxs("div", { children: ["VITE_VERTICAL_DEBUG: ", String(verticalDebugEnvValue)] }), _jsxs("div", { children: ["verticalDebugEnabled: ", String(verticalDebugEnabled)] }), verticalDebugEnabled && (_jsxs(_Fragment, { children: [_jsxs("div", { style: { marginTop: '0.55rem', borderTop: '1px solid #d7dde2', paddingTop: '0.5rem' }, children: [_jsx("div", { style: { fontWeight: 700 }, children: "A. CONTRACT" }), _jsxs("div", { children: ["interpretationBundlePresent: ", String(interpretationBundlePresent)] }), _jsxs("div", { children: ["interpretationBundleSource: ", interpretationBundleSource] }), _jsxs("div", { children: ["interpretationBundleSummary: ", interpretationBundleSummary] }), _jsxs("div", { children: ["contractSummary: ", contractSummary] }), _jsxs("div", { children: ["experienceContract.id: ", resolvedExperienceContract.id] }), _jsxs("div", { children: ["contractIdentity: ", resolvedExperienceContract.contractIdentity] }), _jsxs("div", { children: ["coordinationMode: ", resolvedExperienceContract.coordinationMode] }), _jsxs("div", { children: ["highlightModel: ", resolvedExperienceContract.highlightModel] }), _jsxs("div", { children: ["movementStyle: ", resolvedExperienceContract.movementStyle] }), _jsxs("div", { children: ["actPattern: ", experienceContractActPattern] })] }), _jsxs("div", { style: { marginTop: '0.55rem', borderTop: '1px solid #d7dde2', paddingTop: '0.5rem' }, children: [_jsx("div", { style: { fontWeight: 700 }, children: "B. CONSTRAINTS" }), _jsxs("div", { children: ["constraintSummary: ", constraintSummary] }), _jsxs("div", { children: ["peakCountModel: ", resolvedContractConstraints.peakCountModel] }), _jsxs("div", { children: ["requireEscalation: ", String(resolvedContractConstraints.requireEscalation)] }), _jsxs("div", { children: ["requireContinuity: ", String(resolvedContractConstraints.requireContinuity)] }), _jsxs("div", { children: ["requireRecoveryWindows: ", String(resolvedContractConstraints.requireRecoveryWindows)] }), _jsxs("div", { children: ["socialDensityBand: ", resolvedContractConstraints.socialDensityBand] }), _jsxs("div", { children: ["windDownStrictness: ", resolvedContractConstraints.windDownStrictness] }), _jsxs("div", { children: ["highlightPressure: ", resolvedContractConstraints.highlightPressure] })] }), _jsxs("div", { style: { marginTop: '0.55rem', borderTop: '1px solid #d7dde2', paddingTop: '0.5rem' }, children: [_jsx("div", { style: { fontWeight: 700 }, children: "C. DISTRICT / DIRECTION" }), _jsxs("div", { children: ["directionSummary: ", directionSummary] }), _jsxs("div", { children: ["contractGateWorldPresent: ", String(contractGateWorldPresent)] }), _jsxs("div", { children: ["contractGateWorldSource: ", contractGateWorldSource] }), _jsxs("div", { children: ["contractGateWorldSummary: ", contractGateWorldSummary] }), _jsxs("div", { children: ["contractGateRejectedCount: ", contractGateWorldRejectedCount] }), _jsxs("div", { children: ["contractGateAllowedPreview: ", contractGateWorldAllowedPreview] }), _jsxs("div", { children: ["contractGateSuppressedPreview: ", contractGateWorldSuppressedPreview] }), _jsxs("div", { children: ["strategyWorldsPresent: ", String(strategyWorldsPresent)] }), _jsxs("div", { children: ["strategyWorldIds: ", strategyWorldIds] }), _jsxs("div", { children: ["selectedStrategyWorldId: ", selectedStrategyWorldId] }), _jsxs("div", { children: ["selectedStrategyWorldSource: ", selectedStrategyWorldSource] }), _jsxs("div", { children: ["selectedStrategyWorldSummary: ", selectedStrategyWorldSummary] }), _jsxs("div", { children: ["selectedStrategyWorldAdmittedCount: ", selectedStrategyWorldAdmittedCount] }), _jsxs("div", { children: ["selectedStrategyWorldSuppressedCount: ", selectedStrategyWorldSuppressedCount] }), _jsxs("div", { children: ["selectedStrategyWorldRejectedCount: ", selectedStrategyWorldRejectedCount] }), _jsxs("div", { children: ["selectedStrategyWorldAllowedPreview: ", selectedStrategyWorldAllowedPreview] }), _jsxs("div", { children: ["selectedStrategyWorldSuppressedPreview: ", selectedStrategyWorldSuppressedPreview] }), _jsxs("div", { children: ["contractAwareDistrictRankingApplied: ", String(contractAwareDistrictRanking.applied)] }), _jsxs("div", { children: ["topPocketIds:", ' ', isDebugExpanded('topPocketIds')
                                                        ? topPocketIdsSummary
                                                        : formatCollapsedIdPreview(topPocketIds), topPocketIds.length > 0 && (_jsx("button", { type: "button", onClick: () => toggleDebugExpanded('topPocketIds'), style: { marginLeft: '0.35rem', fontSize: '0.74rem' }, children: isDebugExpanded('topPocketIds') ? 'hide' : 'show' }))] }), _jsxs("div", { children: ["topPocketContractFitReasons:", ' ', isDebugExpanded('topPocketContractFitReasons')
                                                        ? topPocketContractFitReasonsSummary
                                                        : formatCollapsedIdPreview(topPocketContractFitReasonsCompact), topPocketContractFitReasons.length > 0 && (_jsx("button", { type: "button", onClick: () => toggleDebugExpanded('topPocketContractFitReasons'), style: { marginLeft: '0.35rem', fontSize: '0.74rem' }, children: isDebugExpanded('topPocketContractFitReasons') ? 'hide' : 'show' }))] }), _jsxs("div", { children: ["directionExperienceIdentity: ", selectedDirectionExperienceIdentity] }), _jsxs("div", { children: ["directionStrategyId: ", selectedDirectionStrategyId] }), _jsxs("div", { children: ["directionStrategyLabel: ", selectedDirectionStrategyLabel] }), _jsxs("div", { children: ["directionStrategyFamily: ", selectedDirectionStrategyFamily] }), _jsxs("div", { children: ["directionStrategySummary: ", selectedDirectionStrategySummary] }), _jsxs("div", { children: ["directionStrategySource: ", selectedDirectionStrategySource] }), _jsxs("div", { children: ["directionCollapseGuardApplied: ", selectedDirectionCollapseGuardApplied] }), _jsxs("div", { children: ["directionStrategyOverlapSummary: ", selectedDirectionStrategyOverlapSummary] }), _jsxs("div", { children: ["strategyConstraintStatus: ", selectedDirectionStrategyConstraintStatus] }), _jsxs("div", { children: ["strategyPoolSize: ", selectedDirectionStrategyPoolSize] }), _jsxs("div", { children: ["strategyRejectedCount: ", selectedDirectionStrategyRejectedCount] }), _jsxs("div", { children: ["strategyHardGuardStatus: ", selectedDirectionStrategyHardGuardStatus] }), _jsxs("div", { children: ["strategyHardGuardReason: ", selectedDirectionStrategyHardGuardReason] }), _jsxs("div", { children: ["contractGateApplied: ", selectedContractGateApplied] }), _jsxs("div", { children: ["contractGateSummary: ", selectedContractGateSummary] }), _jsxs("div", { children: ["gateStrengthSummary: ", selectedContractGateStrengthSummary] }), _jsxs("div", { children: ["contractGateRejectedCount: ", selectedContractGateRejectedCount] }), _jsxs("div", { children: ["contractGateAllowedPreview: ", selectedContractGateAllowedPreview] }), _jsxs("div", { children: ["contractGateSuppressedPreview: ", selectedContractGateSuppressedPreview] }), _jsxs("div", { children: ["directionContractGateStatus: ", selectedDirectionContractGateStatus] }), _jsxs("div", { children: ["directionContractGateReasonSummary: ", selectedDirectionContractGateReasonSummary] }), _jsxs("div", { children: ["directionStrategyWorldStatus: ", selectedDirectionStrategyWorldStatus] }), _jsxs("div", { children: ["directionStrategyWorldReasonSummary: ", selectedDirectionStrategyWorldReasonSummary] }), _jsxs("div", { children: ["directionDistrictSupportSummary: ", selectedDirectionDistrictSupportSummary] }), _jsxs("div", { children: ["directionNarrativeSummary: ", selectedDirectionNarrativeSummary] }), _jsxs("div", { children: ["compareSummary: ", compareSummary] }), _jsxs("div", { children: ["stageScenarioKeys: ", trackedScenarioKeysSummary] }), _jsxs("div", { children: ["scenarioJaccardByStage: ", scenarioJaccardByStage] })] }), _jsxs("div", { style: { marginTop: '0.55rem', borderTop: '1px solid #d7dde2', paddingTop: '0.5rem' }, children: [_jsx("div", { style: { fontWeight: 700 }, children: "D. GENERATION" }), _jsxs("div", { children: ["generationSummary: ", generationSummary] }), _jsxs("div", { children: ["retrievalContractApplied: ", String(retrievalContractApplied)] }), _jsxs("div", { children: ["retrievedVenueIds:", ' ', isDebugExpanded('retrievedVenueIds')
                                                        ? retrievedVenueIdsSummary
                                                        : formatCollapsedIdPreview(retrievedVenueIds), retrievedVenueIds.length > 0 && (_jsx("button", { type: "button", onClick: () => toggleDebugExpanded('retrievedVenueIds'), style: { marginLeft: '0.35rem', fontSize: '0.74rem' }, children: isDebugExpanded('retrievedVenueIds') ? 'hide' : 'show' }))] }), _jsxs("div", { children: ["rolePoolVenueIdsByRole:", ' ', isDebugExpanded('rolePoolVenueIdsByRole')
                                                        ? rolePoolVenueIdsByRoleSummary
                                                        : rolePoolCountsSummary, rolePoolVenueIdsByRole && (_jsx("button", { type: "button", onClick: () => toggleDebugExpanded('rolePoolVenueIdsByRole'), style: { marginLeft: '0.35rem', fontSize: '0.74rem' }, children: isDebugExpanded('rolePoolVenueIdsByRole') ? 'hide' : 'show' }))] }), _jsxs("div", { children: ["highlightShortlistIds:", ' ', isDebugExpanded('highlightShortlistIds')
                                                        ? highlightShortlistIdsSummary
                                                        : formatCollapsedIdPreview(highlightShortlistIds), highlightShortlistIds.length > 0 && (_jsx("button", { type: "button", onClick: () => toggleDebugExpanded('highlightShortlistIds'), style: { marginLeft: '0.35rem', fontSize: '0.74rem' }, children: isDebugExpanded('highlightShortlistIds') ? 'hide' : 'show' }))] }), _jsxs("div", { children: ["finalStopVenueIds:", ' ', isDebugExpanded('finalStopVenueIds')
                                                        ? finalStopVenueIdsSummary
                                                        : formatCollapsedIdPreview(finalStopVenueIds), finalStopVenueIds.length > 0 && (_jsx("button", { type: "button", onClick: () => toggleDebugExpanded('finalStopVenueIds'), style: { marginLeft: '0.35rem', fontSize: '0.74rem' }, children: isDebugExpanded('finalStopVenueIds') ? 'hide' : 'show' }))] })] }), _jsxs("div", { style: { marginTop: '0.55rem', borderTop: '1px solid #d7dde2', paddingTop: '0.5rem' }, children: [_jsx("div", { style: { fontWeight: 700 }, children: "E. RUNTIME / SWAP" }), _jsxs("div", { children: ["runtimeSummary: ", runtimeSummary] }), _jsxs("div", { children: ["directionSyncStatus: ", directionSyncStatusMarker, " ", directionSyncStatus] }), _jsxs("div", { children: ["generationDriftReason: ", generationDriftMarker, " ", generationDriftReason ?? 'none'] }), _jsxs("div", { children: ["missingRoleForContract: ", missingRoleMarker] }), _jsxs("div", { children: ["swapCompatibilityReason: ", swapMarker, " ", swapCompatibilityReason] }), _jsxs("div", { children: ["swapRequestedReplacementId: ", swapRequestedReplacementId] }), _jsxs("div", { children: ["swapAppliedReplacementId: ", swapAppliedReplacementId] }), _jsxs("div", { children: ["activeStopNarrativeMode: ", activeStopNarrativeMode] }), _jsxs("div", { children: ["activeStopNarrativeSource: ", activeStopNarrativeSource] }), _jsxs("div", { children: ["activeStopFlavorSummary: ", activeStopFlavorSummary] }), _jsxs("div", { children: ["activeStopTransitionSummary: ", activeStopTransitionSummary] }), (swapInteractionBreadcrumb || swapCompatibilityDebug || swapDebugBreadcrumb) && (_jsxs("div", { children: ["swapTraceDetails:", ' ', _jsx("button", { type: "button", onClick: () => toggleDebugExpanded('swapTraceDetails'), style: { marginLeft: '0.2rem', fontSize: '0.74rem' }, children: isDebugExpanded('swapTraceDetails') ? 'hide' : 'show' })] })), isDebugExpanded('swapTraceDetails') && (_jsxs(_Fragment, { children: [_jsxs("div", { children: ["swapTrace.swapClickFired:", ' ', swapInteractionBreadcrumb
                                                                ? String(swapInteractionBreadcrumb.swapClickFired)
                                                                : 'n/a'] }), _jsxs("div", { children: ["swapTrace.swapGuardFailureReason:", ' ', swapInteractionBreadcrumb?.swapGuardFailureReason ?? 'none'] }), _jsxs("div", { children: ["swapTrace.swapCompatibilityRejectClass:", ' ', swapCompatibilityDebug?.swapCompatibilityRejectClass ?? 'n/a'] }), _jsxs("div", { children: ["swapTrace.postSwapCanonicalStopIdBySlot:", ' ', swapDebugBreadcrumb
                                                                ? formatCollapsedIdPreview(swapDebugBreadcrumb.postSwapCanonicalStopIdBySlot ?? [])
                                                                : 'n/a'] }), _jsxs("div", { children: ["swapTrace.postSwapRenderedStopIdBySlot:", ' ', swapDebugBreadcrumb
                                                                ? formatCollapsedIdPreview(swapDebugBreadcrumb.postSwapRenderedStopIdBySlot ?? [])
                                                                : 'n/a'] })] }))] }), _jsxs("details", { style: { marginTop: '0.6rem' }, open: isDebugExpanded('legacyDebugDetails'), onToggle: (event) => setDebugExpanded('legacyDebugDetails', event.target.open), children: [_jsx("summary", { style: { cursor: 'pointer', fontWeight: 600 }, children: "Legacy full debug details (all signals preserved)" }), _jsxs("div", { style: { marginTop: '0.4rem' }, children: [_jsxs("div", { children: ["selectedDirectionId: ", selectedDirectionContractId ?? 'n/a'] }), _jsxs("div", { children: ["selectedDirectionPocketId: ", selectedDirectionPocketId ?? 'n/a'] }), _jsxs("div", { children: ["selectedDirectionContext.id:", ' ', resolvedSelectedDirectionContext?.selectedDirectionId ?? 'n/a'] }), _jsxs("div", { children: ["selectedDirectionContextIdentity: ", selectedDirectionContextIdentity ?? 'n/a'] }), _jsxs("div", { children: ["directionExperienceIdentity: ", selectedDirectionExperienceIdentity] }), _jsxs("div", { children: ["directionPrimaryIdentitySource: ", selectedDirectionPrimaryIdentitySource] }), _jsxs("div", { children: ["directionPeakModel: ", selectedDirectionPeakModel] }), _jsxs("div", { children: ["directionMovementStyle: ", selectedDirectionMovementStyle] }), _jsxs("div", { children: ["directionDistrictSupportSummary: ", selectedDirectionDistrictSupportSummary] }), _jsxs("div", { children: ["directionStrategyId: ", selectedDirectionStrategyId] }), _jsxs("div", { children: ["directionStrategyLabel: ", selectedDirectionStrategyLabel] }), _jsxs("div", { children: ["directionStrategyFamily: ", selectedDirectionStrategyFamily] }), _jsxs("div", { children: ["directionStrategySummary: ", selectedDirectionStrategySummary] }), _jsxs("div", { children: ["directionStrategySource: ", selectedDirectionStrategySource] }), _jsxs("div", { children: ["directionCollapseGuardApplied: ", selectedDirectionCollapseGuardApplied] }), _jsxs("div", { children: ["directionStrategyOverlapSummary: ", selectedDirectionStrategyOverlapSummary] }), _jsxs("div", { children: ["strategyConstraintStatus: ", selectedDirectionStrategyConstraintStatus] }), _jsxs("div", { children: ["strategyPoolSize: ", selectedDirectionStrategyPoolSize] }), _jsxs("div", { children: ["strategyRejectedCount: ", selectedDirectionStrategyRejectedCount] }), _jsxs("div", { children: ["strategyHardGuardStatus: ", selectedDirectionStrategyHardGuardStatus] }), _jsxs("div", { children: ["strategyHardGuardReason: ", selectedDirectionStrategyHardGuardReason] }), _jsxs("div", { children: ["contractGateApplied: ", selectedContractGateApplied] }), _jsxs("div", { children: ["contractGateSummary: ", selectedContractGateSummary] }), _jsxs("div", { children: ["gateStrengthSummary: ", selectedContractGateStrengthSummary] }), _jsxs("div", { children: ["contractGateRejectedCount: ", selectedContractGateRejectedCount] }), _jsxs("div", { children: ["contractGateAllowedPreview: ", selectedContractGateAllowedPreview] }), _jsxs("div", { children: ["contractGateSuppressedPreview: ", selectedContractGateSuppressedPreview] }), _jsxs("div", { children: ["directionContractGateStatus: ", selectedDirectionContractGateStatus] }), _jsxs("div", { children: ["directionContractGateReasonSummary: ", selectedDirectionContractGateReasonSummary] }), _jsxs("div", { children: ["directionStrategyWorldStatus: ", selectedDirectionStrategyWorldStatus] }), _jsxs("div", { children: ["directionStrategyWorldReasonSummary: ", selectedDirectionStrategyWorldReasonSummary] }), _jsxs("div", { children: ["selectedStrategyWorldId: ", selectedStrategyWorldId] }), _jsxs("div", { children: ["selectedStrategyWorldSource: ", selectedStrategyWorldSource] }), _jsxs("div", { children: ["selectedStrategyWorldSummary: ", selectedStrategyWorldSummary] }), _jsxs("div", { children: ["selectedStrategyWorldAdmittedCount: ", selectedStrategyWorldAdmittedCount] }), _jsxs("div", { children: ["selectedStrategyWorldSuppressedCount: ", selectedStrategyWorldSuppressedCount] }), _jsxs("div", { children: ["selectedStrategyWorldRejectedCount: ", selectedStrategyWorldRejectedCount] }), _jsxs("div", { children: ["selectedStrategyWorldAllowedPreview: ", selectedStrategyWorldAllowedPreview] }), _jsxs("div", { children: ["selectedStrategyWorldSuppressedPreview: ", selectedStrategyWorldSuppressedPreview] }), _jsxs("div", { children: ["directionNarrativeSource: ", selectedDirectionNarrativeSource] }), _jsxs("div", { children: ["directionNarrativeMode: ", selectedDirectionNarrativeMode] }), _jsxs("div", { children: ["directionNarrativeSummary: ", selectedDirectionNarrativeSummary] }), _jsxs("div", { children: ["directionSyncStatus: ", directionSyncStatus] }), _jsxs("div", { children: ["directionSyncMismatch: ", String(directionSyncMismatch)] }), _jsxs("div", { children: ["previewDirectionId: ", previewDirectionId ?? 'n/a'] }), _jsxs("div", { children: ["finalRouteDirectionId: ", finalRouteDirectionId ?? 'n/a'] }), _jsxs("div", { children: ["interpretationBundlePresent: ", String(interpretationBundlePresent)] }), _jsxs("div", { children: ["interpretationBundleSource: ", interpretationBundleSource] }), _jsxs("div", { children: ["interpretationBundleSummary: ", interpretationBundleSummary] }), _jsxs("div", { children: ["contractGateWorldPresent: ", String(contractGateWorldPresent)] }), _jsxs("div", { children: ["contractGateWorldSource: ", contractGateWorldSource] }), _jsxs("div", { children: ["contractGateWorldSummary: ", contractGateWorldSummary] }), _jsxs("div", { children: ["contractGateWorldRejectedCount: ", contractGateWorldRejectedCount] }), _jsxs("div", { children: ["contractGateWorldAllowedPreview: ", contractGateWorldAllowedPreview] }), _jsxs("div", { children: ["contractGateWorldSuppressedPreview: ", contractGateWorldSuppressedPreview] }), _jsxs("div", { children: ["strategyWorldsPresent: ", String(strategyWorldsPresent)] }), _jsxs("div", { children: ["strategyWorldIds: ", strategyWorldIds] }), _jsxs("div", { children: ["conciergeIntent.id: ", conciergeIntentId ?? 'n/a'] }), _jsxs("div", { children: ["conciergeIntent.intentMode: ", conciergeIntentMode ?? 'n/a'] }), _jsxs("div", { children: ["conciergeIntent.objective.primary: ", conciergeIntentObjectivePrimary ?? 'n/a'] }), _jsxs("div", { children: ["conciergeIntent.controlPosture.mode: ", conciergeIntentControlMode ?? 'n/a'] }), _jsxs("div", { children: ["conciergeIntent.persona: ", conciergeIntentPersona ?? 'n/a'] }), _jsxs("div", { children: ["conciergeIntent.vibe: ", conciergeIntentVibe ?? 'n/a'] }), _jsxs("div", { children: ["conciergeIntent.anchorPosture.mode: ", conciergeIntentAnchorMode ?? 'n/a'] }), _jsxs("div", { children: ["conciergeIntent.source: ", conciergeIntentSource] }), _jsxs("div", { children: ["conciergeIntent.constraintPosture.travelTolerance:", ' ', conciergeIntentTravelTolerance ?? 'n/a'] }), _jsxs("div", { children: ["conciergeIntent.constraintPosture.swapTolerance:", ' ', conciergeIntentSwapTolerance ?? 'n/a'] }), _jsxs("div", { children: ["experienceContract.id: ", resolvedExperienceContract.id] }), _jsxs("div", { children: ["experienceContract.contractIdentity:", ' ', resolvedExperienceContract.contractIdentity] }), _jsxs("div", { children: ["experienceContract.coordinationMode:", ' ', resolvedExperienceContract.coordinationMode] }), _jsxs("div", { children: ["experienceContract.highlightModel:", ' ', resolvedExperienceContract.highlightModel] }), _jsxs("div", { children: ["experienceContract.highlightType: ", resolvedExperienceContract.highlightType] }), _jsxs("div", { children: ["experienceContract.movementStyle: ", resolvedExperienceContract.movementStyle] }), _jsxs("div", { children: ["experienceContract.socialPosture: ", resolvedExperienceContract.socialPosture] }), _jsxs("div", { children: ["experienceContract.pacingStyle: ", resolvedExperienceContract.pacingStyle] }), _jsxs("div", { children: ["experienceContract.actPattern: ", experienceContractActPattern] }), _jsxs("div", { children: ["experienceContract.contractReasonSummary:", ' ', resolvedExperienceContract.debug.contractReasonSummary] }), _jsxs("div", { children: ["experienceContract.source: ", experienceContractSource] }), _jsxs("div", { children: ["contractConstraints.id: ", resolvedContractConstraints.id] }), _jsxs("div", { children: ["contractConstraints.peakCountModel: ", resolvedContractConstraints.peakCountModel] }), _jsxs("div", { children: ["contractConstraints.requireEscalation:", ' ', String(resolvedContractConstraints.requireEscalation)] }), _jsxs("div", { children: ["contractConstraints.requireContinuity:", ' ', String(resolvedContractConstraints.requireContinuity)] }), _jsxs("div", { children: ["contractConstraints.requireRecoveryWindows:", ' ', String(resolvedContractConstraints.requireRecoveryWindows)] }), _jsxs("div", { children: ["contractConstraints.maxEnergyDropTolerance:", ' ', resolvedContractConstraints.maxEnergyDropTolerance] }), _jsxs("div", { children: ["contractConstraints.socialDensityBand: ", resolvedContractConstraints.socialDensityBand] }), _jsxs("div", { children: ["contractConstraints.movementTolerance:", ' ', resolvedContractConstraints.movementTolerance] }), _jsxs("div", { children: ["contractConstraints.allowLateHighEnergy:", ' ', String(resolvedContractConstraints.allowLateHighEnergy)] }), _jsxs("div", { children: ["contractConstraints.windDownStrictness:", ' ', resolvedContractConstraints.windDownStrictness] }), _jsxs("div", { children: ["contractConstraints.highlightPressure:", ' ', resolvedContractConstraints.highlightPressure] }), _jsxs("div", { children: ["contractConstraints.multiAnchorAllowed:", ' ', String(resolvedContractConstraints.multiAnchorAllowed)] }), _jsxs("div", { children: ["contractConstraints.groupBasecampPreferred:", ' ', String(resolvedContractConstraints.groupBasecampPreferred)] }), _jsxs("div", { children: ["contractConstraints.kidEngagementRequired:", ' ', String(resolvedContractConstraints.kidEngagementRequired)] }), _jsxs("div", { children: ["contractConstraints.adultPayoffRequired:", ' ', String(resolvedContractConstraints.adultPayoffRequired)] }), _jsxs("div", { children: ["contractConstraints.constraintReasonSummary:", ' ', resolvedContractConstraints.debug.constraintReasonSummary] }), _jsxs("div", { children: ["contractConstraints.source: ", contractConstraintsSource] }), _jsxs("div", { children: ["executionBridgeSummary: ", executionBridgeSummary] }), _jsxs("div", { children: ["contractAwareDistrictRankingApplied: ", String(contractAwareDistrictRanking.applied)] }), _jsxs("div", { children: ["retrievalContractApplied: ", String(retrievalContractApplied)] }), _jsxs("div", { children: ["contractInfluenceSummary: ", contractInfluenceSummary] }), _jsxs("div", { children: ["topPocketIds: ", topPocketIdsSummary] }), _jsxs("div", { children: ["topPocketContractFitDeltas: ", topPocketContractFitDeltasSummary] }), _jsxs("div", { children: ["topPocketContractFitReasons: ", topPocketContractFitReasonsSummary] }), _jsxs("div", { children: ["directionCandidatePocketIds: ", directionCandidatePocketIdsSummary] }), _jsxs("div", { children: ["directionStrategyIds: ", formatIdList(directionStrategyIds)] }), _jsxs("div", { children: ["retrievedVenueIds: ", retrievedVenueIdsSummary] }), _jsxs("div", { children: ["rolePoolVenueIdsByRole: ", rolePoolVenueIdsByRoleSummary] }), _jsxs("div", { children: ["rolePoolVenueIds: ", rolePoolVenueIdsSummary] }), _jsxs("div", { children: ["highlightShortlistIds: ", highlightShortlistIdsSummary] }), _jsxs("div", { children: ["finalStopVenueIds: ", finalStopVenueIdsSummary] }), _jsxs("div", { children: ["stageScenarioKeys: ", trackedScenarioKeysSummary] }), _jsxs("div", { children: ["scenarioJaccardByStage: ", scenarioJaccardByStage] }), _jsxs("div", { children: ["routeShapeContract.id: ", routeShapeContractId ?? 'n/a'] }), _jsxs("div", { children: ["routeShapeContract.arcShape: ", routeShapeArcShape ?? 'n/a'] }), _jsxs("div", { children: ["routeShapeContract.mutationProfile.swapFlexibility:", ' ', routeShapeSwapFlexibility ?? 'n/a'] }), _jsxs("div", { children: ["routeShapeContract.movementProfile.radius: ", routeShapeMovementRadius ?? 'n/a'] }), _jsxs("div", { children: ["routeShapeContract.roleInvariants.start: ", routeShapeStartInvariantSummary] }), _jsxs("div", { children: ["routeShapeContract.roleInvariants.highlight: ", routeShapeHighlightInvariantSummary] }), _jsxs("div", { children: ["routeShapeContract.roleInvariants.windDown: ", routeShapeWindDownInvariantSummary] }), _jsxs("div", { children: ["generationDriftReason: ", generationDriftReason ?? 'none'] }), _jsxs("div", { children: ["contractBuildabilityStatus: ", contractBuildabilityStatus ?? 'n/a'] }), _jsxs("div", { children: ["missingRoleForContract: ", missingRoleForContract ?? 'n/a'] }), _jsxs("div", { children: ["expectedDirectionIdentity: ", expectedDirectionIdentity ?? 'n/a'] }), _jsxs("div", { children: ["observedDirectionIdentity: ", observedDirectionIdentity ?? 'n/a'] }), _jsxs("div", { children: ["generationIdentityFallbackApplied: ", String(generationIdentityFallbackApplied)] }), _jsxs("div", { children: ["candidatePoolSufficiencyByRole: ", candidatePoolSufficiencySummary ?? 'n/a'] }), _jsxs("div", { children: ["highlightQualificationScore: ", highlightQualificationScore] }), _jsxs("div", { children: ["highlightQualificationPassed: ", highlightQualificationPassed] }), _jsxs("div", { children: ["highlightPoolCountBefore: ", highlightPoolCountBefore] }), _jsxs("div", { children: ["highlightPoolCountAfter: ", highlightPoolCountAfter] }), _jsxs("div", { children: ["rolePoolCountByRoleBefore: ", rolePoolCountByRoleBeforeSummary] }), _jsxs("div", { children: ["rolePoolCountByRoleAfter: ", rolePoolCountByRoleAfterSummary] }), _jsxs("div", { children: ["signatureHighlightShortlistCount: ", signatureHighlightShortlistCount] }), _jsxs("div", { children: ["signatureHighlightShortlistIds: ", signatureHighlightShortlistIds] }), _jsxs("div", { children: ["highlightShortlistScoreSummary: ", highlightShortlistScoreSummary] }), _jsxs("div", { children: ["selectedHighlightFromShortlist: ", selectedHighlightFromShortlist] }), _jsxs("div", { children: ["selectedHighlightShortlistRank: ", selectedHighlightShortlistRank] }), _jsxs("div", { children: ["fallbackToQualifiedHighlightPool: ", fallbackToQualifiedHighlightPool] }), _jsxs("div", { children: ["tasteRoleEligibilityByRole: ", tasteRoleEligibilityByRoleSummary] }), _jsxs("div", { children: ["personaVibeTasteBias: ", personaVibeTasteBiasSummary] }), _jsxs("div", { children: ["venuePersonalitySummary: ", venuePersonalitySummary] }), _jsxs("div", { children: ["selectedStartTasteSignals: ", selectedStartTasteSignalsSummary] }), _jsxs("div", { children: ["selectedStartTasteRoleSuitability: ", selectedStartTasteRoleSuitabilitySummary] }), _jsxs("div", { children: ["selectedStartVenuePersonality: ", selectedStartTastePersonalitySummary] }), _jsxs("div", { children: ["selectedHighlightTasteSignals: ", selectedHighlightTasteSignalsSummary] }), _jsxs("div", { children: ["selectedHighlightTasteRoleSuitability:", ' ', selectedHighlightTasteRoleSuitabilitySummary] }), _jsxs("div", { children: ["selectedHighlightVenuePersonality: ", selectedHighlightTastePersonalitySummary] }), _jsxs("div", { children: ["selectedHighlightTasteTier: ", selectedHighlightTasteTier] }), _jsxs("div", { children: ["selectedHighlightDurationEstimate: ", selectedHighlightTasteDuration] }), _jsxs("div", { children: ["selectedHighlightNoveltyWeight: ", selectedHighlightTasteNovelty] }), _jsxs("div", { children: ["selectedHighlightTasteSourceMode: ", selectedHighlightTasteSourceMode] }), _jsxs("div", { children: ["selectedHighlightRoleContrast: ", selectedHighlightRoleContrast] }), _jsxs("div", { children: ["selectedHighlightTierReason: ", selectedHighlightTierReason] }), _jsxs("div", { children: ["selectedHighlightVibeFit: ", selectedHighlightVibeFit] }), _jsxs("div", { children: ["selectedHighlightEnergyBand: ", selectedHighlightEnergyBand] }), _jsxs("div", { children: ["selectedHighlightSocialDensityBand: ", selectedHighlightSocialDensityBand] }), _jsxs("div", { children: ["vibePressureSummary: ", vibePressureSummary] }), _jsxs("div", { children: ["toneSeparationSummary: ", toneSeparationSummary] }), _jsxs("div", { children: ["selectedHighlightSeedCalibratedApplied:", ' ', selectedHighlightTasteSeedCalibratedApplied] }), _jsxs("div", { children: ["selectedWindDownTasteSignals: ", selectedWindDownTasteSignalsSummary] }), _jsxs("div", { children: ["selectedWindDownTasteRoleSuitability:", ' ', selectedWindDownTasteRoleSuitabilitySummary] }), _jsxs("div", { children: ["selectedWindDownVenuePersonality: ", selectedWindDownTastePersonalitySummary] }), _jsxs("div", { children: ["upstreamPoolSelectionApplied: ", upstreamPoolSelectionApplied] }), _jsxs("div", { children: ["postGenerationRepairCount: ", postGenerationRepairCount] }), _jsxs("div", { children: ["thinPoolHighlightFallbackApplied: ", thinPoolHighlightFallbackApplied] }), _jsxs("div", { children: ["swapPrefilterActiveRole: ", activeRole] }), _jsxs("div", { children: ["swapCanonicalIdentityCacheResolvedCount: ", swapCanonicalIdentityCacheResolvedCount] }), _jsxs("div", { children: ["swapCanonicalIdentityCacheMissingCount: ", swapCanonicalIdentityCacheMissingCount] }), _jsxs("div", { children: ["swapCandidateDisplayCountBefore:", ' ', activeSwapCandidatePrefilterDebug?.swapCandidateDisplayCountBefore ?? 'n/a'] }), _jsxs("div", { children: ["swapCandidateDisplayCountAfter:", ' ', activeSwapCandidatePrefilterDebug?.swapCandidateDisplayCountAfter ?? 'n/a'] }), _jsxs("div", { children: ["canonicalIdentityResolvedCount:", ' ', activeSwapCandidatePrefilterDebug?.canonicalIdentityResolvedCount ?? 'n/a'] }), _jsxs("div", { children: ["canonicalIdentityMissingCount:", ' ', activeSwapCandidatePrefilterDebug?.canonicalIdentityMissingCount ?? 'n/a'] }), _jsxs("div", { children: ["prefilteredSwapCandidateIds:", ' ', (activeSwapCandidatePrefilterDebug?.prefilteredSwapCandidateIds ?? []).join(', ') || 'n/a'] }), _jsxs("div", { children: ["prefilterRejectReasonSummary:", ' ', (activeSwapCandidatePrefilterDebug?.prefilterRejectReasonSummary ?? []).join(' | ') ||
                                                                'n/a'] }), _jsxs("div", { children: ["swapDisplayUsesSharedHardStructuralCheck:", ' ', String(activeSwapCandidatePrefilterDebug?.swapDisplayUsesSharedHardStructuralCheck ?? false)] }), swapInteractionBreadcrumb && (_jsxs(_Fragment, { children: [_jsxs("div", { children: ["swapClickFired: ", String(swapInteractionBreadcrumb.swapClickFired)] }), _jsxs("div", { children: ["swapHandlerEntered: ", String(swapInteractionBreadcrumb.swapHandlerEntered)] }), _jsxs("div", { children: ["swapCandidateAtClickId: ", swapInteractionBreadcrumb.swapCandidateAtClickId ?? 'n/a'] }), _jsxs("div", { children: ["swapCandidateCanonicalIdentityAtClick:", ' ', swapInteractionBreadcrumb.swapCandidateCanonicalIdentityAtClick ?? 'n/a'] }), _jsxs("div", { children: ["candidateHasCanonicalIdentity:", ' ', String(swapInteractionBreadcrumb.candidateHasCanonicalIdentity ?? false)] }), _jsxs("div", { children: ["swapTargetSlotIndexAtClick:", ' ', swapInteractionBreadcrumb.swapTargetSlotIndexAtClick ?? 'n/a'] }), _jsxs("div", { children: ["swapTargetRoleAtClick: ", swapInteractionBreadcrumb.swapTargetRoleAtClick ?? 'n/a'] }), _jsxs("div", { children: ["swapGuardFailureReason: ", swapInteractionBreadcrumb.swapGuardFailureReason ?? 'none'] }), _jsxs("div", { children: ["swapCommitStarted: ", String(swapInteractionBreadcrumb.swapCommitStarted)] }), _jsxs("div", { children: ["swapCommitFinished: ", String(swapInteractionBreadcrumb.swapCommitFinished)] }), _jsxs("div", { children: ["swapModalClosedAfterCommit:", ' ', String(swapInteractionBreadcrumb.swapModalClosedAfterCommit)] })] })), swapCompatibilityDebug && (_jsxs(_Fragment, { children: [_jsxs("div", { children: ["swapCompatibilityPassed: ", String(swapCompatibilityDebug.swapCompatibilityPassed)] }), _jsxs("div", { children: ["swapCompatibilityReason: ", swapCompatibilityDebug.swapCompatibilityReason] }), _jsxs("div", { children: ["swapCompatibilityRejectClass: ", swapCompatibilityDebug.swapCompatibilityRejectClass] }), _jsxs("div", { children: ["swapRejectSource:", ' ', swapCompatibilityDebug.swapCompatibilityRejectClass === 'hard_structural'
                                                                        ? 'hard structural invalidity'
                                                                        : swapCompatibilityDebug.swapCompatibilityRejectClass === 'soft_direction_drift'
                                                                            ? 'soft direction drift'
                                                                            : 'none'] }), _jsxs("div", { children: ["preservedRole: ", String(swapCompatibilityDebug.preservedRole)] }), _jsxs("div", { children: ["preservedDistrict: ", String(swapCompatibilityDebug.preservedDistrict)] }), _jsxs("div", { children: ["preservedFamily: ", String(swapCompatibilityDebug.preservedFamily)] }), _jsxs("div", { children: ["preservedFeasibility: ", String(swapCompatibilityDebug.preservedFeasibility)] }), _jsxs("div", { children: ["softDirectionDriftDetected:", ' ', String(swapCompatibilityDebug.softDirectionDriftDetected)] })] })), swapDebugBreadcrumb && (_jsxs(_Fragment, { children: [_jsxs("div", { children: ["swapTargetSlotIndex: ", swapDebugBreadcrumb.swapTargetSlotIndex] }), _jsxs("div", { children: ["swapTargetRole: ", swapDebugBreadcrumb.swapTargetRole] }), _jsxs("div", { children: ["swapBeforeStopId: ", swapDebugBreadcrumb.swapBeforeStopId] }), _jsxs("div", { children: ["swapRequestedReplacementId: ", swapDebugBreadcrumb.swapRequestedReplacementId] }), _jsxs("div", { children: ["swapAppliedReplacementId: ", swapDebugBreadcrumb.swapAppliedReplacementId ?? 'n/a'] }), _jsxs("div", { children: ["swapCommitSucceeded: ", String(swapDebugBreadcrumb.swapCommitSucceeded)] }), _jsxs("div", { children: ["swapRenderSource: ", swapDebugBreadcrumb.swapRenderSource] }), _jsxs("div", { children: ["postSwapCanonicalStopIdBySlot:", ' ', (swapDebugBreadcrumb.postSwapCanonicalStopIdBySlot ?? []).join(', ') || 'n/a'] }), _jsxs("div", { children: ["postSwapRenderedStopIdBySlot:", ' ', (swapDebugBreadcrumb.postSwapRenderedStopIdBySlot ?? []).join(', ') || 'n/a'] }), _jsxs("div", { children: ["routeVersion: ", swapDebugBreadcrumb.routeVersion] }), swapDebugBreadcrumb.mismatch && (_jsxs("div", { children: ["SWAP_ID_MISMATCH: requested ", swapDebugBreadcrumb.swapRequestedReplacementId, " but applied ", swapDebugBreadcrumb.swapAppliedReplacementId ?? 'n/a', ' | ', "canonicalAtSlot", ' ', swapDebugBreadcrumb.postSwapCanonicalStopIdBySlot?.[swapDebugBreadcrumb.swapTargetSlotIndex] ?? 'n/a', ' | ', "renderedAtSlot", ' ', swapDebugBreadcrumb.postSwapRenderedStopIdBySlot?.[swapDebugBreadcrumb.swapTargetSlotIndex] ?? 'n/a'] }))] }))] })] })] }))] }), _jsx("section", { className: "preview-adjustments draft-tune-panel", children: _jsxs("div", { className: "preview-adjustments-grid compact", children: [_jsxs("label", { className: "input-group inline-field", children: [_jsx("span", { className: "input-label", children: "Location" }), _jsx("input", { value: city, onChange: (event) => setCity(event.target.value), placeholder: "City, ST" })] }), _jsxs("label", { className: "input-group inline-field", children: [_jsx("span", { className: "input-label", children: "Persona" }), _jsx("select", { value: persona, onChange: (event) => setPersona(event.target.value), children: personaOptions.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value))) })] }), _jsxs("label", { className: "input-group inline-field", children: [_jsx("span", { className: "input-label", children: "Vibe" }), _jsx("select", { value: primaryVibe, onChange: (event) => setPrimaryVibe(event.target.value), children: vibeOptions.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value))) })] })] }) }), _jsx(RealityCommitStep, { persona: persona, vibe: primaryVibe, selectedDirectionId: selectedDirectionId, finalSelectedId: selectedDirectionId, selectedIdReconciled: selectedIdReconciled, userSelectedOverrideActive: userSelectedOverrideActive, onSelectDirection: handleSelectDirection, onGenerate: generatePlan, loading: loading, directionCards: directionCards, showDebugMeta: verticalDebugEnabled, allowFallbackCards: false }), error && (_jsxs("div", { className: "preview-notice draft-feedback", children: [_jsx("p", { className: "preview-notice-title", children: "Could not generate" }), _jsx("p", { className: "preview-notice-copy", children: error })] })), !hasRevealed && preview && (_jsx("section", { className: "plan-preview", children: _jsx("article", { className: "night-preview-card", children: _jsxs("div", { className: "night-preview-content compact-top", children: [_jsx("p", { className: "night-preview-kicker", children: "Tonight's route" }), _jsx("h3", { children: preview.headline }), _jsx("p", { className: "night-preview-thesis", children: preview.tone }), _jsx("div", { className: "night-preview-stops", children: preview.stops.map((stop) => (_jsx("div", { className: "night-preview-stop-item", children: _jsx("p", { className: "night-preview-stop-description", children: getDirectionPreviewStopLine(stop, persona) }) }, `${preview.directionId}_${stop.role}_${stop.name}`))) }), _jsx("p", { className: "system-line", children: preview.continuityLine }), plan && previewSynced && (_jsx("div", { className: "action-row draft-actions", children: _jsx("button", { type: "button", className: "primary-button", onClick: () => setHasRevealed(true), children: "Review full route" }) }))] }) }) })), hasRevealed && plan && finalRoute && previewSynced && (_jsxs("section", { className: `plan-reveal sandbox-plan-reveal${isLocking ? ' is-locking' : ''}`, children: [_jsxs("div", { className: "confirm-night-header", children: [_jsx("h2", { children: "Confirm your night" }), _jsx("p", { children: "Take one last look." })] }), _jsx("p", { className: "preview-notice-copy", children: plan.selectedDirectionContract.confirmation }), _jsxs("div", { className: "sandbox-guided-review", children: [_jsx("div", { className: "sandbox-guided-map-rail", children: _jsxs("div", { className: "sandbox-guided-map-rail-inner", children: [_jsx(JourneyMapReal, { activeRole: activeRole, routeStops: guidedRouteStops, waypointOverrides: guidedWaypointOverrides, activeStopId: guidedActiveStop?.id, activeStopIndex: guidedActiveStopIndex, cityLabel: finalRoute.location || city.trim(), onNearbySummaryChange: handleNearbySummaryChange }, `sandbox-route-${finalRoute.routeId}`), verticalDebugEnabled && (_jsxs("p", { className: "system-line", children: ["activeStopId=", guidedActiveStop?.id ?? 'n/a', " | activeStopRole=", guidedActiveStop?.role ?? 'n/a', " | activeStopIndex=", typeof guidedActiveStopIndex === 'number' ? guidedActiveStopIndex : 'n/a'] }))] }) }), _jsxs("div", { className: "sandbox-guided-story-column", children: [_jsx(RouteSpine, { className: "draft-story-spine", stops: planningDisplayStops, storySpine: plan.itinerary.storySpine, routeHeadline: finalRoute.routeHeadline, routeWhyLine: finalRoute.routeSummary, experienceFamily: activePreviewDirectionContext?.experienceFamily, familyConfidence: activePreviewDirectionContext?.familyConfidence, usedRecoveredCentralMomentHighlight: Boolean(plan.selectedArc.scoreBreakdown.recoveredCentralMomentHighlight), routeDebugSummary: verticalDebugEnabled
                                                    ? {
                                                        arcType: getRouteArcType(plan.itinerary),
                                                        highlightIntensity: getHighlightIntensityFromArc(plan.selectedArc),
                                                        usedRecoveredCentralMomentHighlight: Boolean(plan.selectedArc.scoreBreakdown.usedRecoveredCentralMomentHighlight),
                                                    }
                                                    : undefined, allowStopAdjustments: false, enableInlineDetails: true, inlineDetailsByRole: inlineDetailsByRole, appliedSwapNoteByRole: appliedSwapNoteByRole, postSwapHintByRole: postSwapHintByRole, activeRole: activeRole, changedRoles: [], animatedRoles: [], debugMode: verticalDebugEnabled, enableActiveStopTracking: true, alternativesByRole: {}, alternativeKindsByRole: {}, highlightDecisionSignal: "Chosen over closer options to carry the night better.", onFocusRole: setActiveRole, onShowSwap: () => undefined, onShowNearby: () => undefined, onApplySwap: () => undefined, onPreviewAlternative: handlePreviewAlternative }), _jsx("p", { className: "system-line", children: getAnchoredBearingsSignal(plan.itinerary, canonicalStopByRole) }), appliedSwapRole && (_jsx("p", { className: "system-line swap-global-signal", children: "Your route shifted slightly to keep the night balanced." })), _jsx("p", { className: "system-line", children: "We'll keep your night on track as things shift." }), _jsxs("div", { className: "sandbox-guided-action-row", children: [_jsx("p", { className: "confirm-decision-line", children: isLocking
                                                            ? 'Locking it in...'
                                                            : 'Ready when you are.' }), _jsxs("div", { className: "action-row draft-actions", children: [_jsx("button", { type: "button", className: "primary-button", onClick: handleLockNight, disabled: isLocking, children: isLocking ? 'Locking it in...' : 'Lock this night' }), _jsx("button", { type: "button", className: "ghost-button", children: "Send to friends" })] })] })] })] })] }))] }), verticalDebugEnabled && (_jsxs(_Fragment, { children: [_jsx("div", { style: {
                            border: '1px solid #ff7a18',
                            background: '#fff4e8',
                            color: '#8a3f0a',
                            fontWeight: 800,
                            letterSpacing: '0.04em',
                            padding: '0.55rem 0.7rem',
                            borderRadius: '10px',
                        }, children: "DISTRICT DEBUG ENABLED" }), _jsx(DistrictPreviewPanel, { data: districtPreviewResult, loading: districtPreviewLoading, error: districtPreviewError, locationQuery: districtLocationQuery })] })), previewSwap && (_jsx("div", { className: "swap-preview-overlay", onClick: () => setPreviewSwap(undefined), role: "presentation", children: _jsxs("article", { className: "swap-preview-popout", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "swap-preview-header", children: [_jsx("p", { className: "swap-preview-kicker", children: "Swap option" }), _jsx("button", { type: "button", className: "ghost-button subtle", onClick: () => setPreviewSwap(undefined), children: "Close" })] }), _jsxs("div", { className: "swap-preview-card", children: [_jsx("div", { className: "swap-preview-image-wrap", children: _jsx("img", { src: previewSwap.candidateStop.imageUrl, alt: previewSwap.candidateStop.venueName }) }), _jsxs("div", { className: "swap-preview-body", children: [_jsx("span", { className: "reveal-story-chip active", children: previewSwap.candidateStop.title }), _jsx("h3", { children: previewSwap.candidateStop.venueName }), _jsx("p", { className: "swap-preview-descriptor", children: previewSwap.descriptor }), _jsxs("p", { className: "stop-card-meta", children: [_jsx("span", { className: "district-name", children: previewSwap.candidateStop.neighborhood }), " |", ' ', previewSwap.candidateStop.driveMinutes, " min out"] }), _jsxs("div", { className: "stop-card-inline-detail-row", children: [_jsx("p", { className: "stop-card-inline-detail-label", children: "Why it fits" }), _jsx("p", { className: "stop-card-inline-detail-copy", children: previewSwap.whyItFits })] }), _jsxs("div", { className: "stop-card-inline-detail-row", children: [_jsx("p", { className: "stop-card-inline-detail-label", children: "Known for" }), _jsx("p", { className: "stop-card-inline-detail-copy", children: previewSwap.knownFor })] }), _jsxs("div", { className: "stop-card-inline-detail-row", children: [_jsx("p", { className: "stop-card-inline-detail-label", children: "Local signal" }), _jsx("p", { className: "stop-card-inline-detail-copy", children: previewSwap.localSignal })] }), _jsxs("div", { className: "swap-preview-impact", children: [_jsx("p", { className: "stop-card-inline-detail-label", children: "What changes" }), _jsxs("ul", { className: "swap-preview-impact-list", children: [_jsx("li", { children: previewSwap.tradeoffSignal }), _jsx("li", { children: previewSwap.constraintSignal }), _jsx("li", { children: previewSwap.cascadeHint })] })] }), _jsx("p", { className: "swap-preview-reassure", children: "The rest of your route stays stable." }), _jsxs("div", { className: "swap-preview-actions", children: [_jsxs("a", { className: "stop-card-venue-link", href: previewSwap.venueLinkUrl, target: "_blank", rel: "noreferrer", children: ["Open venue page", ' ->'] }), _jsxs("div", { className: "action-row", children: [_jsx("button", { type: "button", className: "ghost-button", onClick: () => handleKeepCurrentSwap(previewSwap.role), children: "Stay on plan" }), _jsx("button", { type: "button", className: "primary-button", onClick: handleSwapConfirmClick, children: "Swap this stop" })] })] })] })] })] }) }))] }));
}
