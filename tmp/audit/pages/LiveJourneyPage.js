import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ID8Butler } from '../components/butler/ID8Butler';
import { RouteSpine } from '../components/journey/RouteSpine';
import { JourneyMapReal, } from '../components/journey/JourneyMapReal';
import { PageShell } from '../components/layout/PageShell';
import { createLiveArtifactPlanId, loadSharedLiveArtifactPlan, loadLiveArtifactSession, saveLiveArtifactSession, saveLiveArtifactHomeState, saveSharedLiveArtifactPlan, } from '../domain/live/liveArtifactSession';
import { buildTonightSignals } from '../domain/journey/buildTonightSignals';
const LIVE_ALERT_PREVIEW_BY_DECISION = {
    keep: {
        title: 'Stay with current plan',
        lines: ["We'll keep watching this stop."],
        ctaLabel: 'Confirm',
    },
    switch: {
        title: 'Swap Jazz Cellar for a nearby option',
        lines: ['Keeps the same role in your night.', '2 min away.'],
        ctaLabel: 'Apply swap',
    },
    timing: {
        title: 'Push this stop by 20 minutes',
        lines: ['Improves entry window.', 'Rest of route stays aligned.'],
        ctaLabel: 'Update timing',
    },
};
const LIVE_CONTINUATION_OPTIONS = [
    {
        id: 'stay-nearby',
        title: 'Stay nearby',
        description: 'Keep things local with one or two easy nearby beats.',
        stops: [
            {
                id: 'continue_stay_nearby_1',
                name: 'Alameda Late Kitchen',
                descriptor: 'Walkable nightcap with easy seating and soft energy.',
                coordinates: [-121.9256, 37.3235],
            },
            {
                id: 'continue_stay_nearby_2',
                name: 'Garden Patio Pour',
                descriptor: 'Low-key patio stop to keep the flow nearby.',
                coordinates: [-121.9237, 37.3221],
            },
        ],
    },
    {
        id: 'change-pace',
        title: 'Change the pace',
        description: 'Shift energy with a fresh district feel after the main arc.',
        stops: [
            {
                id: 'continue_change_pace_1',
                name: 'SoFa Vinyl Room',
                descriptor: 'A livelier late set to lift momentum again.',
                coordinates: [-121.8918, 37.3339],
            },
            {
                id: 'continue_change_pace_2',
                name: 'Market Street Social',
                descriptor: 'Crowd-forward lounge to close on a brighter note.',
                coordinates: [-121.8886, 37.3351],
            },
        ],
    },
    {
        id: 'ease-out',
        title: 'Ease out',
        description: 'Land softly with a calmer final beat before wrapping.',
        stops: [
            {
                id: 'continue_ease_out_1',
                name: 'Willow Quiet Bar',
                descriptor: 'Quieter corner for a slow final pour.',
                coordinates: [-121.9194, 37.3202],
            },
            {
                id: 'continue_ease_out_2',
                name: 'Late Dessert Counter',
                descriptor: 'Short, relaxed sweet finish before heading out.',
                coordinates: [-121.9168, 37.3189],
            },
        ],
    },
];
const WIND_DOWN_COORDINATES = [-121.9275, 37.3229];
const FALLBACK_COORDINATES_BY_ROLE = {
    start: [-121.8947, 37.3358],
    highlight: [-121.8892, 37.3331],
    surprise: [-121.9078, 37.3292],
    windDown: [-121.9275, 37.3229],
};
function toTitleCase(value) {
    return value
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
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
function getLocalSignal(stop) {
    const normalized = new Set(stop.tags.map((tag) => tag.toLowerCase()));
    if (['reservations', 'reservation-recommended', 'book-ahead', 'bookings'].some((tag) => normalized.has(tag))) {
        return 'Reservations recommended.';
    }
    if (['late-night', 'night-owl', 'live', 'jazz', 'small-stage'].some((tag) => normalized.has(tag))) {
        return 'Fills quickly after 9pm.';
    }
    if (['walk-up', 'quick-start', 'coffee', 'tea-room', 'dessert', 'gelato'].some((tag) => normalized.has(tag))) {
        return 'Easy to enter without long waits.';
    }
    return 'Steady local traffic through the evening.';
}
function getNearbyOptionDescriptor(category) {
    if (category === 'nightlife') {
        return 'more lively';
    }
    if (category === 'dessert') {
        return 'slower pace';
    }
    if (category === 'cafe') {
        return 'more intimate';
    }
    return 'closer, easier stop';
}
function toRadians(value) {
    return (value * Math.PI) / 180;
}
function estimateMinutesBetweenCoordinates(from, to) {
    const [fromLng, fromLat] = from;
    const [toLng, toLat] = to;
    const earthRadiusMeters = 6371000;
    const deltaLat = toRadians(toLat - fromLat);
    const deltaLng = toRadians(toLng - fromLng);
    const fromLatRadians = toRadians(fromLat);
    const toLatRadians = toRadians(toLat);
    const haversine = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
        Math.cos(fromLatRadians) *
            Math.cos(toLatRadians) *
            Math.sin(deltaLng / 2) *
            Math.sin(deltaLng / 2);
    const angularDistance = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    const distanceMeters = earthRadiusMeters * angularDistance;
    const walkMetersPerMinute = 85;
    return Math.max(1, Math.round(distanceMeters / walkMetersPerMinute));
}
function formatClockTime(date) {
    return date.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
    });
}
function toGoogleCalendarDate(date) {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}
function toIcsDate(date) {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}
function toSharedPlanPath(planId) {
    return `/p/${encodeURIComponent(planId)}`;
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
function toFinalRouteStopFromArtifact(stop, stopIndex) {
    const fallbackCoordinates = FALLBACK_COORDINATES_BY_ROLE[stop.role];
    return {
        id: stop.id,
        sourceStopId: stop.id,
        displayName: stop.venueName,
        providerRecordId: stop.venueId || stop.id,
        latitude: fallbackCoordinates[1],
        longitude: fallbackCoordinates[0],
        address: `${stop.neighborhood}, ${stop.city}`.replace(/^,\s*/, ''),
        role: stop.role,
        stopIndex,
        venueId: stop.venueId,
        title: stop.title,
        subtitle: stop.subtitle,
        neighborhood: stop.neighborhood,
        driveMinutes: stop.driveMinutes,
        imageUrl: stop.imageUrl,
    };
}
function buildFinalRouteFromArtifact(artifact) {
    const stops = artifact.itinerary.stops.map((stop, stopIndex) => toFinalRouteStopFromArtifact(stop, stopIndex));
    return {
        routeId: artifact.finalRoute?.routeId ?? `${artifact.itinerary.id}-live`,
        selectedDirectionId: artifact.finalRoute?.selectedDirectionId ?? artifact.itinerary.id,
        location: artifact.city,
        persona: artifact.finalRoute?.persona ?? artifact.itinerary.crew.persona,
        vibe: artifact.finalRoute?.vibe ?? artifact.itinerary.vibes[0] ?? 'lively',
        stops,
        activeStopIndex: Math.max(0, stops.findIndex((stop) => stop.role === artifact.initialActiveRole)),
        routeHeadline: artifact.itinerary.story?.headline ?? artifact.itinerary.title,
        routeSummary: artifact.selectedClusterConfirmation,
        mapMarkers: stops.map((stop) => ({
            id: stop.id,
            displayName: stop.displayName,
            role: stop.role,
            stopIndex: stop.stopIndex,
            latitude: stop.latitude,
            longitude: stop.longitude,
        })),
        liveNotices: [],
        updatedAt: artifact.lockedAt,
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
export function LiveJourneyPage({ sharedPlanId }) {
    const [artifact] = useState(() => sharedPlanId ? loadSharedLiveArtifactPlan(sharedPlanId) : loadLiveArtifactSession());
    const [finalRoute, setFinalRoute] = useState(() => {
        if (!artifact) {
            return null;
        }
        return artifact.finalRoute ?? buildFinalRouteFromArtifact(artifact);
    });
    const [activeRole, setActiveRole] = useState(artifact?.initialActiveRole ?? 'start');
    const [nearbySummaryByRole, setNearbySummaryByRole] = useState({});
    const [nearbyOptionsByRole, setNearbyOptionsByRole] = useState({});
    const [liveAlertStage, setLiveAlertStage] = useState('idle');
    const [liveAlertDecision, setLiveAlertDecision] = useState(null);
    const [liveAppliedDecision, setLiveAppliedDecision] = useState(null);
    const [selectedSwitchNearbyOption, setSelectedSwitchNearbyOption] = useState(null);
    const [liveAppliedSwitchOption, setLiveAppliedSwitchOption] = useState(null);
    const [selectedContinuationOptionId, setSelectedContinuationOptionId] = useState(null);
    const [previewContinuationOptionId, setPreviewContinuationOptionId] = useState(null);
    const [continuationStops, setContinuationStops] = useState([]);
    const [planDetailsOpen, setPlanDetailsOpen] = useState(false);
    const [utilityModal, setUtilityModal] = useState(null);
    const [shareFeedback, setShareFeedback] = useState(null);
    const [sharePlanId, setSharePlanId] = useState(sharedPlanId ?? null);
    const routeItineraryStops = useMemo(() => {
        if (!artifact || !finalRoute) {
            return [];
        }
        const sourceStopById = new Map(artifact.itinerary.stops.map((stop) => [stop.id, stop]));
        const sourceStopByRole = new Map(artifact.itinerary.stops.map((stop) => [stop.role, stop]));
        const fallbackSourceStop = artifact.itinerary.stops[0];
        return finalRoute.stops
            .slice()
            .sort((left, right) => left.stopIndex - right.stopIndex)
            .map((finalStop) => {
            const sourceStop = sourceStopById.get(finalStop.sourceStopId) ??
                sourceStopByRole.get(finalStop.role) ??
                fallbackSourceStop;
            if (!sourceStop || !finalStop.displayName.trim()) {
                return null;
            }
            return {
                ...sourceStop,
                id: finalStop.sourceStopId || sourceStop.id,
                role: finalStop.role,
                title: finalStop.title || sourceStop.title,
                venueId: finalStop.venueId || sourceStop.venueId,
                venueName: finalStop.displayName,
                city: finalRoute.location || sourceStop.city,
                subtitle: finalStop.subtitle || sourceStop.subtitle,
                neighborhood: finalStop.neighborhood || sourceStop.neighborhood,
                driveMinutes: finalStop.driveMinutes ?? sourceStop.driveMinutes,
                imageUrl: finalStop.imageUrl || sourceStop.imageUrl,
            };
        })
            .filter((stop) => Boolean(stop));
    }, [artifact, finalRoute]);
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
    const handleNearbyOptionsChange = useCallback((role, options) => {
        setNearbyOptionsByRole((current) => {
            const nextOptions = options.slice(0, 3);
            const existing = current[role] ?? [];
            if (existing.length === nextOptions.length &&
                existing.every((option, index) => option.id === nextOptions[index]?.id &&
                    option.minutesAway === nextOptions[index]?.minutesAway &&
                    option.category === nextOptions[index]?.category)) {
                return current;
            }
            return {
                ...current,
                [role]: nextOptions,
            };
        });
    }, []);
    const switchNearbyOptions = (nearbyOptionsByRole.highlight ?? []).slice(0, 3);
    const originalHighlightStop = routeItineraryStops.find((stop) => stop.role === 'highlight') ?? null;
    useEffect(() => {
        if (!artifact) {
            return;
        }
        if (liveAppliedDecision) {
            return;
        }
        if (liveAlertStage !== 'idle') {
            return;
        }
        const timer = window.setTimeout(() => {
            setLiveAlertStage('alert');
            setLiveAlertDecision(null);
            setSelectedSwitchNearbyOption(null);
            setActiveRole('highlight');
            setPlanDetailsOpen(true);
        }, 1200);
        return () => window.clearTimeout(timer);
    }, [artifact, liveAlertStage, liveAppliedDecision]);
    useEffect(() => {
        if (liveAlertStage !== 'resolved') {
            return;
        }
        const timer = window.setTimeout(() => {
            setLiveAlertStage('idle');
        }, 2400);
        return () => window.clearTimeout(timer);
    }, [liveAlertStage]);
    useEffect(() => {
        if (!shareFeedback) {
            return;
        }
        const timer = window.setTimeout(() => {
            setShareFeedback(null);
        }, 2200);
        return () => window.clearTimeout(timer);
    }, [shareFeedback]);
    useEffect(() => {
        if (!import.meta.env.DEV || !finalRoute) {
            return;
        }
        console.log('ROUTE TRUTH CHECK', {
            routeId: finalRoute.routeId,
            selectedDirectionId: finalRoute.selectedDirectionId,
            stopNames: finalRoute.stops.map((stop) => stop.displayName),
            stopRoles: finalRoute.stops.map((stop) => stop.role),
            stopIds: finalRoute.stops.map((stop) => stop.id || stop.providerRecordId),
        });
        console.log('ROUTE SURFACE CHECK: live-map', { routeId: finalRoute.routeId });
        console.log('ROUTE SURFACE CHECK: live-spine', { routeId: finalRoute.routeId });
        console.log('ROUTE SURFACE CHECK: live-share', { routeId: finalRoute.routeId });
        console.log('ROUTE SURFACE CHECK: live-calendar', { routeId: finalRoute.routeId });
    }, [finalRoute]);
    useEffect(() => {
        if (!artifact || !finalRoute || routeItineraryStops.length === 0) {
            return;
        }
        saveLiveArtifactSession({
            ...artifact,
            initialActiveRole: activeRole,
            finalRoute,
            itinerary: {
                ...artifact.itinerary,
                stops: routeItineraryStops,
            },
        });
    }, [activeRole, artifact, finalRoute, routeItineraryStops]);
    const handleLiveAlertDecision = (decision) => {
        setActiveRole('highlight');
        setPlanDetailsOpen(true);
        if (decision !== 'switch') {
            setSelectedSwitchNearbyOption(null);
        }
        setLiveAlertDecision(decision);
        setLiveAlertStage('preview');
    };
    const handlePreviewAlternativeFromCard = (role, venueId) => {
        if (role !== 'highlight') {
            return;
        }
        const option = switchNearbyOptions.find((candidate) => candidate.id === venueId);
        if (!option) {
            return;
        }
        setSelectedSwitchNearbyOption(option);
        setLiveAlertDecision('switch');
        setLiveAlertStage('preview');
    };
    const handlePreviewDecisionActionFromCard = (role, decision) => {
        if (role !== 'highlight') {
            return;
        }
        handleLiveAlertDecision(decision);
    };
    const handleSelectContinuationOption = (optionId) => {
        const selectedOption = LIVE_CONTINUATION_OPTIONS.find((option) => option.id === optionId);
        if (!selectedOption) {
            return;
        }
        setPreviewContinuationOptionId(selectedOption.id);
    };
    const handleConfirmContinuationOption = () => {
        if (!previewContinuationOptionId) {
            return;
        }
        const selectedOption = LIVE_CONTINUATION_OPTIONS.find((option) => option.id === previewContinuationOptionId);
        if (!selectedOption) {
            setPreviewContinuationOptionId(null);
            return;
        }
        setSelectedContinuationOptionId(selectedOption.id);
        setContinuationStops(selectedOption.stops.slice(0, 2));
        setPlanDetailsOpen(true);
        setActiveRole('windDown');
        setPreviewContinuationOptionId(null);
    };
    const handleCloseContinuationPreview = () => {
        setPreviewContinuationOptionId(null);
    };
    const handleDonePlanning = () => {
        const sharedId = persistSharedPlan();
        const mapPath = sharedId ? toSharedPlanPath(sharedId) : '/journey/live';
        saveLiveArtifactHomeState({
            city: finalRoute?.location ?? artifact.city,
            mapPath,
        });
        window.location.assign('/home');
    };
    const handleOpenShareModal = () => {
        setShareFeedback(null);
        persistSharedPlan();
        setUtilityModal('share');
    };
    const handleOpenCalendarModal = () => {
        setUtilityModal('calendar');
    };
    const handleCloseUtilityModal = () => {
        setShareFeedback(null);
        setUtilityModal(null);
    };
    const handleConfirmLiveAlertDecision = () => {
        if (!liveAlertDecision) {
            return;
        }
        if (liveAlertDecision === 'switch') {
            setLiveAppliedSwitchOption(selectedSwitchNearbyOption);
            if (selectedSwitchNearbyOption) {
                setFinalRoute((current) => {
                    if (!current) {
                        return current;
                    }
                    const currentHighlightStop = current.stops.find((stop) => stop.role === 'highlight');
                    if (!currentHighlightStop) {
                        return current;
                    }
                    const replacementStop = {
                        ...currentHighlightStop,
                        displayName: selectedSwitchNearbyOption.name,
                        providerRecordId: selectedSwitchNearbyOption.id,
                        latitude: selectedSwitchNearbyOption.coordinates[1],
                        longitude: selectedSwitchNearbyOption.coordinates[0],
                        address: `${currentHighlightStop.neighborhood || current.location}, ${current.location}`.replace(/^,\s*/, ''),
                        subtitle: `${getNearbyOptionDescriptor(selectedSwitchNearbyOption.category)} · ${selectedSwitchNearbyOption.minutesAway} min away`,
                    };
                    const patchedRoute = patchFinalRouteStop({
                        route: current,
                        targetRole: 'highlight',
                        targetStopId: currentHighlightStop.id,
                        targetStopIndex: currentHighlightStop.stopIndex,
                        replacementStop,
                        notice: `Highlight switched to ${selectedSwitchNearbyOption.name}.`,
                        activeRole: 'highlight',
                    });
                    if (!patchedRoute) {
                        return current;
                    }
                    if (import.meta.env.DEV) {
                        console.log('SWAP TARGET CHECK', {
                            routeId: current.routeId,
                            modalTargetStopId: currentHighlightStop.id,
                            modalTargetRole: 'highlight',
                            modalTargetStopIndex: currentHighlightStop.stopIndex,
                            resolvedStopId: patchedRoute.resolvedStop.id,
                            resolvedRole: patchedRoute.resolvedStop.role,
                            resolvedStopIndex: patchedRoute.resolvedStop.stopIndex,
                        });
                    }
                    if (patchedRoute.resolvedStop.role !== 'highlight' ||
                        patchedRoute.resolvedStop.stopIndex !== currentHighlightStop.stopIndex) {
                        console.error('Live swap aborted due to target mismatch.', {
                            routeId: current.routeId,
                            expectedRole: 'highlight',
                            expectedStopIndex: currentHighlightStop.stopIndex,
                            resolvedRole: patchedRoute.resolvedStop.role,
                            resolvedStopIndex: patchedRoute.resolvedStop.stopIndex,
                            resolution: patchedRoute.resolution,
                        });
                        return current;
                    }
                    logSwapCommitChecks(patchedRoute.route, 'highlight', [
                        'live',
                        'map',
                        'spine',
                        'share',
                        'calendar',
                    ]);
                    return patchedRoute.route;
                });
            }
        }
        else {
            setLiveAppliedSwitchOption(null);
        }
        setLiveAppliedDecision(liveAlertDecision);
        setSelectedSwitchNearbyOption(null);
        setLiveAlertDecision(null);
        setLiveAlertStage('resolved');
    };
    const handleBackFromLiveAlertPreview = () => {
        setLiveAlertDecision(null);
        setSelectedSwitchNearbyOption(null);
        setPlanDetailsOpen(true);
        setActiveRole('highlight');
        setLiveAlertStage('alert');
    };
    const inlineDetailsByRole = useMemo(() => {
        if (!artifact) {
            return {};
        }
        return Object.fromEntries(routeItineraryStops.map((stop) => {
            const next = {
                whyItFits: stop.selectedBecause?.trim() ||
                    `Anchored as your ${stop.title.toLowerCase()} beat without breaking route flow.`,
                knownFor: getKnownForLine(stop),
                goodToKnow: 'Kept aligned with nearby pacing and transition timing.',
                localSignal: getLocalSignal(stop),
                tonightSignals: buildTonightSignals({
                    stop,
                    roleTravelWindowMinutes: getRoleTravelWindow(artifact.itinerary, stop.role),
                    nearbySummary: nearbySummaryByRole[stop.role],
                    nearbyOptionsCount: nearbyOptionsByRole[stop.role]?.length ?? 0,
                }),
            };
            const nearbySummary = nearbySummaryByRole[stop.role];
            if (nearbySummary) {
                next.aroundHereSignals = [nearbySummary];
            }
            if (stop.role === 'highlight' && liveAlertStage === 'alert') {
                next.alertSignal = '⚠️ This stop is getting busy';
                next.decisionActions = [
                    { id: 'keep', label: 'Keep current plan' },
                    { id: 'timing', label: 'Go later (~20 min)' },
                ];
                next.alternatives = switchNearbyOptions.map((option) => ({
                    venueId: option.id,
                    name: option.name,
                    descriptor: getNearbyOptionDescriptor(option.category),
                    distanceLabel: `${option.minutesAway} min away`,
                    replacementContext: originalHighlightStop?.venueName ?? stop.venueName,
                }));
            }
            if (stop.role === 'highlight' && liveAppliedDecision) {
                if (liveAppliedDecision === 'keep') {
                    next.localSignal = "We'll keep watching this stop.";
                }
                else if (liveAppliedDecision === 'switch') {
                    next.whyItFits = 'Same highlight role, same vibe, minimal disruption.';
                    if (liveAppliedSwitchOption) {
                        next.localSignal = `Swapped to ${liveAppliedSwitchOption.name} (${liveAppliedSwitchOption.minutesAway} min away).`;
                    }
                    else {
                        next.localSignal = 'Nearby highlight swap selected (mock) - 2 min away.';
                    }
                }
                else if (liveAppliedDecision === 'timing') {
                    next.tonightSignals = [
                        'Shifted +20 min to improve the entry window.',
                        ...((next.tonightSignals ?? []).slice(0, 1)),
                    ];
                }
            }
            return [stop.role, next];
        }));
    }, [
        artifact,
        liveAlertStage,
        liveAppliedDecision,
        liveAppliedSwitchOption,
        nearbySummaryByRole,
        originalHighlightStop?.venueName,
        routeItineraryStops,
        switchNearbyOptions,
    ]);
    const continuationEntries = useMemo(() => continuationStops.map((stop) => ({
        id: stop.id,
        title: stop.name,
        descriptor: stop.descriptor,
    })), [continuationStops]);
    const routeMoments = useMemo(() => {
        if (!artifact || !finalRoute) {
            return [];
        }
        const orderedStops = [...finalRoute.stops].sort((left, right) => left.stopIndex - right.stopIndex);
        return orderedStops.map((stop, index) => ({
            id: stop.id,
            roleLabel: stop.title,
            name: stop.displayName,
            descriptor: stop.subtitle,
            durationMinutes: 45,
            travelToNextMinutes: artifact.itinerary.transitions[index]?.estimatedTransitionMinutes ??
                (index < orderedStops.length - 1 ? 8 : 0),
        }));
    }, [artifact, finalRoute]);
    const calendarTimeline = useMemo(() => {
        if (!artifact || routeMoments.length === 0) {
            return [];
        }
        const startBase = new Date(artifact.lockedAt || Date.now());
        startBase.setMinutes(0, 0, 0);
        if (startBase.getHours() < 17) {
            startBase.setHours(19, 0, 0, 0);
        }
        let cursor = startBase.getTime();
        return routeMoments.map((moment) => {
            const start = new Date(cursor);
            const end = new Date(cursor + moment.durationMinutes * 60000);
            const timeLabel = `${formatClockTime(start)} - ${formatClockTime(end)}`;
            cursor = end.getTime() + moment.travelToNextMinutes * 60000;
            return {
                ...moment,
                start,
                end,
                timeLabel,
            };
        });
    }, [artifact, routeMoments]);
    const shareTitle = `Your night in ${finalRoute?.location ?? artifact.city}`;
    const shareStopsText = routeMoments
        .map((moment, index) => `${index + 1}. ${moment.roleLabel}: ${moment.name}`)
        .join('\n');
    const shareText = `${shareTitle}\n${shareStopsText}`;
    const shareArtifactPayload = useMemo(() => {
        if (!artifact || !finalRoute) {
            return null;
        }
        return {
            ...artifact,
            initialActiveRole: activeRole,
            finalRoute,
            itinerary: {
                ...artifact.itinerary,
                stops: routeItineraryStops,
            },
        };
    }, [activeRole, artifact, finalRoute, routeItineraryStops]);
    const persistSharedPlan = useCallback(() => {
        if (!shareArtifactPayload) {
            return null;
        }
        const nextPlanId = sharePlanId ?? createLiveArtifactPlanId();
        saveSharedLiveArtifactPlan(nextPlanId, shareArtifactPayload);
        if (sharePlanId !== nextPlanId) {
            setSharePlanId(nextPlanId);
        }
        return nextPlanId;
    }, [shareArtifactPayload, sharePlanId]);
    const buildShareUrl = useCallback(() => {
        const nextPlanId = persistSharedPlan();
        if (!nextPlanId) {
            return null;
        }
        const path = toSharedPlanPath(nextPlanId);
        return typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;
    }, [persistSharedPlan]);
    const shareUrl = useMemo(() => {
        if (!sharePlanId) {
            return typeof window !== 'undefined'
                ? `${window.location.origin}/journey/live`
                : '/journey/live';
        }
        const path = toSharedPlanPath(sharePlanId);
        return typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;
    }, [sharePlanId]);
    const copyButtonLabel = shareFeedback === 'Copied' ? 'Copied' : 'Copy link';
    const googleCalendarUrl = useMemo(() => {
        if (calendarTimeline.length === 0) {
            return '#';
        }
        const firstEntry = calendarTimeline[0];
        const lastEntry = calendarTimeline[calendarTimeline.length - 1];
        const details = calendarTimeline
            .map((entry) => `${entry.timeLabel} - ${entry.roleLabel}: ${entry.name}`)
            .join('\n');
        return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(shareTitle)}&dates=${toGoogleCalendarDate(firstEntry.start)}/${toGoogleCalendarDate(lastEntry.end)}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(finalRoute?.location ?? artifact.city)}`;
    }, [artifact.city, calendarTimeline, finalRoute?.location, shareTitle]);
    const calendarIcsContent = useMemo(() => {
        if (calendarTimeline.length === 0) {
            return '';
        }
        const escapeIcs = (value) => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
        const firstEntry = calendarTimeline[0];
        const lastEntry = calendarTimeline[calendarTimeline.length - 1];
        const details = calendarTimeline
            .map((entry) => `${entry.timeLabel} - ${entry.roleLabel}: ${entry.name}`)
            .join('\\n');
        return [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//ID8//Live Journey//EN',
            'BEGIN:VEVENT',
            `UID:id8-live-${artifact.lockedAt}@id8`,
            `DTSTAMP:${toIcsDate(new Date())}`,
            `DTSTART:${toIcsDate(firstEntry.start)}`,
            `DTEND:${toIcsDate(lastEntry.end)}`,
            `SUMMARY:${escapeIcs(shareTitle)}`,
            `DESCRIPTION:${escapeIcs(details)}`,
            `LOCATION:${escapeIcs(finalRoute?.location ?? artifact.city)}`,
            'END:VEVENT',
            'END:VCALENDAR',
        ].join('\r\n');
    }, [artifact.city, artifact.lockedAt, calendarTimeline, finalRoute?.location, shareTitle]);
    const mapRouteStops = useMemo(() => finalRoute
        ? finalRoute.stops
            .slice()
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
    useEffect(() => {
        if (!import.meta.env.DEV || !finalRoute) {
            return;
        }
        const activeMapStop = mapRouteStops.find((stop) => stop.role === activeRole) ?? mapRouteStops[0];
        const activeMapStopIndex = typeof activeMapStop?.stopIndex === 'number'
            ? activeMapStop.stopIndex
            : mapRouteStops.findIndex((stop) => stop.id === activeMapStop?.id);
        console.log('MAP REFRESH CHECK', {
            routeId: finalRoute.routeId,
            activeStopId: activeMapStop?.id ?? null,
            activeStopIndex: activeMapStopIndex >= 0 ? activeMapStopIndex : null,
            mapStopNames: mapRouteStops.map((stop) => stop.displayName || stop.name),
        });
    }, [activeRole, finalRoute, mapRouteStops]);
    const mapWaypointOverrides = useMemo(() => {
        return undefined;
    }, []);
    const selectedNearbyPlaceIdByRole = useMemo(() => {
        return undefined;
    }, []);
    const liveAlertPreview = useMemo(() => {
        if (!liveAlertDecision) {
            return null;
        }
        if (liveAlertDecision === 'switch') {
            return null;
        }
        return LIVE_ALERT_PREVIEW_BY_DECISION[liveAlertDecision];
    }, [liveAlertDecision]);
    const liveSwapPreview = useMemo(() => {
        if (liveAlertStage !== 'preview' ||
            liveAlertDecision !== 'switch' ||
            !selectedSwitchNearbyOption) {
            return null;
        }
        const descriptor = getNearbyOptionDescriptor(selectedSwitchNearbyOption.category);
        const distanceLine = `${descriptor} · ${selectedSwitchNearbyOption.minutesAway} min away`;
        const currentHighlightName = originalHighlightStop?.venueName ?? 'Theatre District Jazz Cellar';
        const currentRoleLabel = originalHighlightStop?.title ?? 'Highlight';
        const locationLine = `${originalHighlightStop?.neighborhood ?? 'Downtown San Jose'} | about ${selectedSwitchNearbyOption.minutesAway} min | ${originalHighlightStop?.driveMinutes ?? 6} min out`;
        const pacingShift = selectedSwitchNearbyOption.minutesAway <= 4
            ? 'Slightly faster handoff into your peak moment.'
            : 'Slightly later handoff into your peak moment.';
        const travelImpact = `${selectedSwitchNearbyOption.minutesAway} min from your current highlight anchor.`;
        const vibeShift = selectedSwitchNearbyOption.category === 'nightlife'
            ? 'Energy stays high with a similar nightlife feel.'
            : selectedSwitchNearbyOption.category === 'dessert'
                ? 'Energy softens slightly while keeping the highlight role.'
                : selectedSwitchNearbyOption.category === 'cafe'
                    ? 'A calmer highlight with conversational pacing.'
                    : 'Similar local energy with a nearby pivot.';
        return {
            name: selectedSwitchNearbyOption.name,
            imageUrl: originalHighlightStop?.imageUrl ?? routeItineraryStops[0]?.imageUrl ?? '',
            roleChip: currentRoleLabel,
            distanceLine,
            roleLine: `This becomes your new ${currentRoleLabel}`,
            replacesLine: `Replaces: ${currentHighlightName}`,
            locationLine,
            whyItFits: inlineDetailsByRole.highlight?.whyItFits ??
                'Same role, same route intent, with minimal disruption.',
            knownFor: inlineDetailsByRole.highlight?.knownFor ??
                'Known for a strong local fit in this district.',
            localSignal: inlineDetailsByRole.highlight?.localSignal ??
                'Local traffic remains steady through this window.',
            whatChanges: [pacingShift, travelImpact, vibeShift],
        };
    }, [
        artifact,
        inlineDetailsByRole,
        liveAlertDecision,
        liveAlertStage,
        originalHighlightStop?.driveMinutes,
        originalHighlightStop?.imageUrl,
        originalHighlightStop?.neighborhood,
        originalHighlightStop?.title,
        originalHighlightStop?.venueName,
        routeItineraryStops,
        selectedSwitchNearbyOption,
    ]);
    const liveContinuationPreview = useMemo(() => {
        if (!previewContinuationOptionId) {
            return null;
        }
        const selectedOption = LIVE_CONTINUATION_OPTIONS.find((option) => option.id === previewContinuationOptionId);
        if (!selectedOption) {
            return null;
        }
        const firstStop = selectedOption.stops[0];
        if (!firstStop) {
            return null;
        }
        const lastStop = selectedOption.stops[selectedOption.stops.length - 1] ?? firstStop;
        const minutesFromWindDown = estimateMinutesBetweenCoordinates(WIND_DOWN_COORDINATES, firstStop.coordinates);
        const durationExtensionLine = selectedOption.stops.length > 1
            ? 'Adds about 60-90 minutes to your night.'
            : 'Adds about 30-45 minutes to your night.';
        const travelImpactLine = `First add-on stop is about ${minutesFromWindDown} min from your wind-down.`;
        const energyShiftLine = selectedOption.id === 'change-pace'
            ? 'Energy lifts again with a brighter late stretch.'
            : selectedOption.id === 'ease-out'
                ? 'Energy softens further for a calmer finish.'
                : 'Energy stays steady with a nearby continuation.';
        const whyItFitsLine = selectedOption.id === 'change-pace'
            ? 'Adds a fresh second wind while keeping your route coherent.'
            : selectedOption.id === 'ease-out'
                ? 'Extends gently without breaking your current pace.'
                : 'Keeps momentum local with minimal travel overhead.';
        return {
            title: selectedOption.title,
            name: firstStop.name,
            descriptor: firstStop.descriptor,
            distanceLine: `${minutesFromWindDown} min away from wind-down`,
            addsLine: "Adds 1-2 stops after your wind-down",
            whyItFits: whyItFitsLine,
            knownFor: `Continuation mode: ${selectedOption.title.toLowerCase()}.`,
            localSignal: 'Built from nearby context already on your map.',
            whatChanges: [
                durationExtensionLine,
                travelImpactLine,
                energyShiftLine,
                'Original three-stop route remains intact.',
            ],
            finalStopLine: selectedOption.stops.length > 1 ? `You'll end here instead: ${lastStop.name}` : null,
            imageUrl: routeItineraryStops[2]?.imageUrl ?? routeItineraryStops[0]?.imageUrl ?? '',
        };
    }, [previewContinuationOptionId, routeItineraryStops]);
    const handleCopyShareLink = useCallback(async () => {
        const nextShareUrl = buildShareUrl();
        if (!nextShareUrl) {
            setShareFeedback('Unable to create share link');
            return;
        }
        try {
            await navigator.clipboard.writeText(nextShareUrl);
            setShareFeedback('Copied');
        }
        catch {
            setShareFeedback('Unable to copy link on this device');
        }
    }, [buildShareUrl]);
    const handleNativeShare = useCallback(async () => {
        const nextShareUrl = buildShareUrl();
        if (!nextShareUrl) {
            setShareFeedback('Unable to create share link');
            return;
        }
        if (!navigator.share) {
            await handleCopyShareLink();
            return;
        }
        try {
            await navigator.share({
                title: shareTitle,
                text: shareText,
                url: nextShareUrl,
            });
            setShareFeedback('Shared');
        }
        catch {
            setShareFeedback('Share canceled');
        }
    }, [buildShareUrl, handleCopyShareLink, shareText, shareTitle]);
    const handleDownloadIcs = useCallback(() => {
        if (!calendarIcsContent) {
            return;
        }
        const file = new Blob([calendarIcsContent], { type: 'text/calendar;charset=utf-8' });
        const url = window.URL.createObjectURL(file);
        const anchor = document.createElement('a');
        const slug = (finalRoute?.location ?? artifact.city).toLowerCase().replace(/[^a-z0-9]+/g, '-');
        anchor.href = url;
        anchor.download = `id8-night-${slug || 'live'}.ics`;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(url);
    }, [artifact.city, calendarIcsContent, finalRoute?.location]);
    const isAlertActive = liveAlertStage === 'alert' || liveAlertStage === 'preview';
    const liveHeaderStatus = isAlertActive ? 'Adjusting in real time' : 'In motion';
    if (!artifact) {
        return (_jsx(PageShell, { title: "Live Journey", subtitle: "No active artifact found", children: _jsxs("div", { className: "demo-flow-frame", children: [_jsxs("div", { className: "preview-notice draft-feedback", children: [_jsx("p", { className: "preview-notice-title", children: sharedPlanId ? 'Shared plan not found' : 'No live artifact yet' }), _jsx("p", { className: "preview-notice-copy", children: sharedPlanId
                                    ? 'This shared link is unavailable on this device.'
                                    : 'Lock a night from concierge first, then come back here.' })] }), _jsx("div", { className: "action-row draft-actions", children: _jsx("button", { type: "button", className: "primary-button", onClick: () => window.location.assign(sharedPlanId ? '/home' : '/'), children: sharedPlanId ? 'Go to home' : 'Go to planner' }) })] }) }));
    }
    return (_jsx(PageShell, { topSlot: _jsx(ID8Butler, { message: "Live artifact active. Co-pilot is watching your route." }), title: "Live Journey Artifact", subtitle: "Active route handoff", children: _jsx("div", { className: "demo-flow-frame live-artifact-page", children: _jsxs("section", { className: "plan-reveal live-artifact-surface", children: [_jsx("div", { className: "live-artifact-top-actions", children: _jsx("button", { type: "button", className: "ghost-button subtle", onClick: handleDonePlanning, children: "Done planning" }) }), _jsxs("div", { className: "confirm-night-header live-artifact-header is-live", children: [_jsx("h2", { children: "Your night \u2014 live" }), _jsxs("p", { children: [finalRoute?.location ?? artifact.city, " \u00B7 Tonight"] }), _jsx("p", { className: "live-artifact-status", children: liveHeaderStatus })] }), _jsx("p", { className: "preview-notice-copy", children: finalRoute?.routeSummary ?? artifact.selectedClusterConfirmation }), _jsx("div", { className: "artifact-map-layer is-live", children: _jsx(JourneyMapReal, { activeRole: activeRole, onNearbySummaryChange: handleNearbySummaryChange, onNearbyOptionsChange: handleNearbyOptionsChange, routeStops: mapRouteStops, waypointOverrides: mapWaypointOverrides, selectedNearbyPlaceIdByRole: selectedNearbyPlaceIdByRole, continuationStops: continuationStops, alertActive: isAlertActive, alertRole: isAlertActive ? 'highlight' : null }, `live-route-${finalRoute?.routeId ?? 'none'}`) }), _jsxs("section", { className: `lce-system-layer is-live stage-${liveAlertStage}`, "aria-live": "polite", children: [_jsx("p", { className: "lce-system-strip", children: "[ LIVE CO-PILOT \u2014 ACTIVE ]" }), liveAlertStage === 'idle' && (_jsx("p", { className: "lce-system-idle", children: "We're keeping an eye on your route" })), liveAlertStage === 'alert' && (_jsxs("article", { className: "lce-alert-card", children: [_jsx("h3", { children: "Something changed near your next stop" }), _jsx("p", { className: "lce-alert-copy", children: "Theatre District Jazz Cellar is getting busy." }), _jsx("p", { className: "lce-alert-support", children: "Open the Highlight stop below to review options." })] })), liveAlertStage === 'preview' && liveAlertPreview && (_jsxs("article", { className: "lce-alert-card preview", children: [_jsx("p", { className: "lce-alert-kicker", children: "Decision preview" }), _jsx("h3", { children: liveAlertPreview.title }), liveAlertPreview.lines.map((line) => (_jsx("p", { className: "lce-alert-support", children: line }, line))), _jsxs("div", { className: "lce-alert-actions", children: [_jsx("button", { type: "button", className: "ghost-button lce-action-button", onClick: handleBackFromLiveAlertPreview, children: "Back" }), _jsx("button", { type: "button", className: "ghost-button lce-action-button", onClick: handleConfirmLiveAlertDecision, children: liveAlertPreview.ctaLabel })] })] })), liveAlertStage === 'resolved' && (_jsxs("div", { className: "preview-notice draft-feedback live-resolved-state", children: [_jsx("p", { className: "preview-notice-title", children: "Updated" }), _jsx("p", { className: "preview-notice-copy", children: "Your night is still on track." })] }))] }), liveSwapPreview && (_jsx("div", { className: "swap-preview-overlay", onClick: handleBackFromLiveAlertPreview, role: "presentation", children: _jsxs("article", { className: "swap-preview-popout", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "swap-preview-header", children: [_jsx("p", { className: "swap-preview-kicker", children: "Preview change" }), _jsx("button", { type: "button", className: "ghost-button subtle", onClick: handleBackFromLiveAlertPreview, children: "Close" })] }), _jsxs("div", { className: "swap-preview-card", children: [_jsx("div", { className: "swap-preview-image-wrap", children: _jsx("img", { src: liveSwapPreview.imageUrl, alt: liveSwapPreview.name }) }), _jsxs("div", { className: "swap-preview-body", children: [_jsx("span", { className: "reveal-story-chip active", children: liveSwapPreview.roleChip }), _jsx("h3", { children: liveSwapPreview.name }), _jsx("p", { className: "swap-preview-descriptor", children: liveSwapPreview.distanceLine }), _jsx("p", { className: "stop-card-meta", children: liveSwapPreview.locationLine }), _jsx("p", { className: "swap-preview-descriptor", children: liveSwapPreview.roleLine }), _jsx("p", { className: "swap-preview-descriptor", children: liveSwapPreview.replacesLine }), _jsxs("div", { className: "stop-card-inline-detail-row", children: [_jsx("p", { className: "stop-card-inline-detail-label", children: "Why it fits" }), _jsx("p", { className: "stop-card-inline-detail-copy", children: liveSwapPreview.whyItFits })] }), _jsxs("div", { className: "stop-card-inline-detail-row", children: [_jsx("p", { className: "stop-card-inline-detail-label", children: "Known for" }), _jsx("p", { className: "stop-card-inline-detail-copy", children: liveSwapPreview.knownFor })] }), _jsxs("div", { className: "stop-card-inline-detail-row", children: [_jsx("p", { className: "stop-card-inline-detail-label", children: "Local signal" }), _jsx("p", { className: "stop-card-inline-detail-copy", children: liveSwapPreview.localSignal })] }), _jsxs("div", { className: "swap-preview-impact", children: [_jsx("p", { className: "stop-card-inline-detail-label", children: "What changes in your night" }), _jsx("ul", { className: "swap-preview-impact-list", children: liveSwapPreview.whatChanges.map((changeLine) => (_jsx("li", { children: changeLine }, changeLine))) })] }), _jsx("p", { className: "swap-preview-reassure", children: "The rest of your route stays stable." }), _jsx("div", { className: "swap-preview-actions", children: _jsxs("div", { className: "action-row", children: [_jsx("button", { type: "button", className: "ghost-button", onClick: handleBackFromLiveAlertPreview, children: "Keep current" }), _jsx("button", { type: "button", className: "primary-button", onClick: handleConfirmLiveAlertDecision, children: "Use this instead" })] }) })] })] })] }) })), liveContinuationPreview && (_jsx("div", { className: "swap-preview-overlay", onClick: handleCloseContinuationPreview, role: "presentation", children: _jsxs("article", { className: "swap-preview-popout", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "swap-preview-header", children: [_jsx("p", { className: "swap-preview-kicker", children: "Preview continuation" }), _jsx("button", { type: "button", className: "ghost-button subtle", onClick: handleCloseContinuationPreview, children: "Close" })] }), _jsxs("div", { className: "swap-preview-card", children: [_jsx("div", { className: "swap-preview-image-wrap", children: _jsx("img", { src: liveContinuationPreview.imageUrl, alt: liveContinuationPreview.name }) }), _jsxs("div", { className: "swap-preview-body", children: [_jsx("span", { className: "reveal-story-chip active", children: liveContinuationPreview.title }), _jsx("h3", { children: liveContinuationPreview.name }), _jsx("p", { className: "swap-preview-descriptor", children: liveContinuationPreview.descriptor }), _jsx("p", { className: "stop-card-meta", children: liveContinuationPreview.distanceLine }), _jsx("p", { className: "swap-preview-descriptor", children: liveContinuationPreview.addsLine }), liveContinuationPreview.finalStopLine && (_jsx("p", { className: "swap-preview-descriptor", children: liveContinuationPreview.finalStopLine })), _jsxs("div", { className: "stop-card-inline-detail-row", children: [_jsx("p", { className: "stop-card-inline-detail-label", children: "Why it fits" }), _jsx("p", { className: "stop-card-inline-detail-copy", children: liveContinuationPreview.whyItFits })] }), _jsxs("div", { className: "stop-card-inline-detail-row", children: [_jsx("p", { className: "stop-card-inline-detail-label", children: "Known for" }), _jsx("p", { className: "stop-card-inline-detail-copy", children: liveContinuationPreview.knownFor })] }), _jsxs("div", { className: "stop-card-inline-detail-row", children: [_jsx("p", { className: "stop-card-inline-detail-label", children: "Local signal" }), _jsx("p", { className: "stop-card-inline-detail-copy", children: liveContinuationPreview.localSignal })] }), _jsxs("div", { className: "swap-preview-impact", children: [_jsx("p", { className: "stop-card-inline-detail-label", children: "What changes in your night" }), _jsx("ul", { className: "swap-preview-impact-list", children: liveContinuationPreview.whatChanges.map((changeLine) => (_jsx("li", { children: changeLine }, changeLine))) })] }), _jsx("p", { className: "swap-preview-reassure", children: "The rest of your route stays stable." }), _jsx("div", { className: "swap-preview-actions", children: _jsxs("div", { className: "action-row", children: [_jsx("button", { type: "button", className: "ghost-button", onClick: handleCloseContinuationPreview, children: "Keep current" }), _jsx("button", { type: "button", className: "primary-button", onClick: handleConfirmContinuationOption, children: "Add this to my night" })] }) })] })] })] }) })), utilityModal === 'share' && (_jsx("div", { className: "swap-preview-overlay", onClick: handleCloseUtilityModal, role: "presentation", children: _jsxs("article", { className: "swap-preview-popout", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "swap-preview-header", children: [_jsx("p", { className: "swap-preview-kicker", children: shareTitle }), _jsx("button", { type: "button", className: "ghost-button subtle", onClick: handleCloseUtilityModal, children: "Close" })] }), _jsxs("div", { className: "swap-preview-card", children: [_jsx("div", { className: "swap-preview-image-wrap live-share-snapshot", "aria-hidden": "true", children: routeItineraryStops[0]?.imageUrl ? (_jsx("img", { src: routeItineraryStops[0].imageUrl, alt: `${finalRoute?.location ?? artifact.city} route snapshot` })) : (_jsx("p", { children: "Map snapshot placeholder" })) }), _jsxs("div", { className: "swap-preview-body", children: [_jsx("p", { className: "swap-preview-descriptor", children: "Route snapshot" }), _jsx("ul", { className: "swap-preview-impact-list", children: routeMoments.map((moment) => (_jsxs("li", { children: [moment.roleLabel, ": ", moment.name] }, moment.id))) }), _jsx("p", { className: "stop-card-meta", children: shareUrl }), shareFeedback && _jsx("p", { className: "stop-card-meta", children: shareFeedback }), _jsx("div", { className: "swap-preview-actions", children: _jsxs("div", { className: "action-row", children: [_jsx("button", { type: "button", className: "ghost-button", onClick: handleCopyShareLink, children: copyButtonLabel }), _jsx("button", { type: "button", className: "primary-button", onClick: handleNativeShare, children: "Share" })] }) })] })] })] }) })), utilityModal === 'calendar' && (_jsx("div", { className: "swap-preview-overlay", onClick: handleCloseUtilityModal, role: "presentation", children: _jsxs("article", { className: "swap-preview-popout", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "swap-preview-header", children: [_jsx("p", { className: "swap-preview-kicker", children: "Add to calendar" }), _jsx("button", { type: "button", className: "ghost-button subtle", onClick: handleCloseUtilityModal, children: "Close" })] }), _jsxs("div", { className: "swap-preview-card", children: [_jsx("div", { className: "live-calendar-snapshot", "aria-hidden": "true", children: calendarTimeline.length > 0 ? (_jsx("ul", { className: "live-calendar-timeline", children: calendarTimeline.map((entry, index) => (_jsxs("li", { className: "live-calendar-timeline-item", children: [_jsxs("span", { className: "live-calendar-timeline-marker", children: [_jsx("span", { className: "live-calendar-timeline-dot" }), index < calendarTimeline.length - 1 && (_jsx("span", { className: "live-calendar-timeline-line" }))] }), _jsxs("span", { className: "live-calendar-timeline-copy", children: [_jsxs("span", { className: "live-calendar-time", children: [formatClockTime(entry.start), " - ", entry.roleLabel] }), _jsx("span", { className: "live-calendar-stop", children: entry.name })] })] }, `timeline-${entry.id}`))) })) : (_jsx("p", { className: "live-calendar-empty", children: "Timeline updates once your route is set." })) }), _jsxs("div", { className: "swap-preview-body", children: [_jsx("p", { className: "swap-preview-descriptor", children: "Structured timeline for your night." }), _jsxs("div", { className: "swap-preview-actions", children: [_jsx("div", { className: "action-row", children: _jsx("a", { href: googleCalendarUrl, target: "_blank", rel: "noreferrer", className: "primary-button", children: "Add to Google Calendar" }) }), _jsx("div", { className: "action-row", children: _jsx("button", { type: "button", className: "calendar-secondary-action", onClick: handleDownloadIcs, children: "Download .ics" }) })] })] })] })] }) })), _jsxs("details", { className: "live-artifact-details", open: planDetailsOpen, onToggle: (event) => {
                            setPlanDetailsOpen(event.currentTarget.open);
                        }, children: [_jsx("summary", { children: "View plan details" }), _jsx("div", { className: "live-artifact-details-body", children: _jsx(RouteSpine, { className: "draft-story-spine artifact-reference-spine is-live", stops: routeItineraryStops, storySpine: artifact.itinerary.storySpine, allowStopAdjustments: false, enableInlineDetails: true, inlineDetailsByRole: inlineDetailsByRole, appliedSwapNoteByRole: {}, postSwapHintByRole: {}, activeRole: activeRole, alertedRole: liveAlertStage === 'alert' ? 'highlight' : null, continuationEntries: continuationEntries, changedRoles: [], animatedRoles: [], alternativesByRole: {}, alternativeKindsByRole: {}, highlightDecisionSignal: "Chosen over closer options to carry the night better.", onFocusRole: setActiveRole, onShowSwap: () => undefined, onShowNearby: () => undefined, onApplySwap: () => undefined, onPreviewAlternative: handlePreviewAlternativeFromCard, onPreviewDecisionAction: handlePreviewDecisionActionFromCard }) })] }), _jsxs("section", { className: "live-continuation-section", children: [_jsxs("div", { className: "live-continuation-header", children: [_jsx("h3", { children: "Keep the night going" }), _jsx("p", { children: "When you're ready, here are a few ways to continue from your last stop" })] }), _jsx("div", { className: "live-continuation-options", children: LIVE_CONTINUATION_OPTIONS.map((option) => (_jsxs("button", { type: "button", className: `live-continuation-option${selectedContinuationOptionId === option.id ? ' active' : ''}`, onClick: () => handleSelectContinuationOption(option.id), children: [_jsx("p", { className: "live-continuation-option-title", children: option.title }), _jsx("p", { className: "live-continuation-option-copy", children: option.description })] }, option.id))) })] }), _jsxs("div", { className: "action-row draft-actions artifact-secondary-actions", children: [_jsx("button", { type: "button", className: "ghost-button subtle", onClick: handleOpenShareModal, children: "Send to friends" }), _jsx("button", { type: "button", className: "ghost-button subtle", onClick: handleOpenCalendarModal, children: "Add to calendar" })] })] }) }) }));
}
