import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
const POSITION_TEMPLATES = {
    3: [
        { x: 16, y: 70 },
        { x: 50, y: 30 },
        { x: 84, y: 64 },
    ],
    4: [
        { x: 14, y: 72 },
        { x: 40, y: 46 },
        { x: 66, y: 20 },
        { x: 84, y: 66 },
    ],
};
const VIEWPORT_HALF_WIDTH = 14;
const VIEWPORT_HALF_HEIGHT = 12;
const DISTRICT_ZONE_TEMPLATES = [
    { x: 28, y: 30, width: 32, height: 24, tone: 'core' },
    { x: 56, y: 56, width: 38, height: 28, tone: 'creative' },
    { x: 80, y: 36, width: 30, height: 22, tone: 'calm' },
];
const NEARBY_SIGNAL_OFFSETS_BY_ROLE = {
    start: [
        { x: -20, y: -16 },
        { x: 22, y: 14 },
    ],
    highlight: [
        { x: -8, y: -7 },
        { x: 7, y: -6 },
        { x: 9, y: 1 },
        { x: 6, y: 8 },
        { x: -2, y: 9 },
        { x: -8, y: 6 },
        { x: -9, y: -1 },
    ],
    windDown: [
        { x: -24, y: -14 },
        { x: 21, y: 15 },
    ],
    surprise: [
        { x: -12, y: -10 },
        { x: 10, y: 8 },
        { x: -9, y: 13 },
    ],
};
const ACTIVITY_SIGNAL_OFFSETS = [
    { x: -6, y: -8 },
    { x: 7, y: 6 },
];
function getMapPoints(stopCount) {
    return POSITION_TEMPLATES[stopCount] ?? POSITION_TEMPLATES[3];
}
function getRouteCenter(points, stopCount) {
    const relevant = points.slice(0, stopCount);
    if (relevant.length === 0) {
        return { x: 50, y: 50 };
    }
    const sum = relevant.reduce((acc, point) => ({
        x: acc.x + point.x,
        y: acc.y + point.y,
    }), { x: 0, y: 0 });
    return {
        x: sum.x / relevant.length,
        y: sum.y / relevant.length,
    };
}
function buildNodeLabel(role) {
    if (role === 'start') {
        return 'Start';
    }
    if (role === 'highlight') {
        return 'Highlight';
    }
    if (role === 'surprise') {
        return 'Surprise';
    }
    return 'Wind Down';
}
function isInViewportFrame(point, center) {
    return (Math.abs(point.x - center.x) <= VIEWPORT_HALF_WIDTH &&
        Math.abs(point.y - center.y) <= VIEWPORT_HALF_HEIGHT);
}
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function buildDistrictLabels(city, stops) {
    const normalizedCity = city.trim().toLowerCase();
    if (normalizedCity.includes('san jose')) {
        return ['Downtown', 'SoFa', 'Japantown'];
    }
    const neighborhoodLabels = Array.from(new Set(stops
        .map((stop) => stop.neighborhood?.trim())
        .filter((value) => Boolean(value)))).slice(0, 3);
    return [
        neighborhoodLabels[0] ?? 'Central District',
        neighborhoodLabels[1] ?? 'Arts Quarter',
        neighborhoodLabels[2] ?? 'Northside',
    ];
}
function buildRoleClass(role) {
    if (role === 'highlight') {
        return ' role-highlight';
    }
    if (role === 'start') {
        return ' role-start';
    }
    return ' role-wind-down';
}
function buildRoleStateClass(role) {
    if (role === 'windDown') {
        return ' state-wind-down';
    }
    if (role === 'highlight') {
        return ' state-highlight';
    }
    return ' state-start';
}
function getNearbyOffsets(role) {
    return NEARBY_SIGNAL_OFFSETS_BY_ROLE[role] ?? NEARBY_SIGNAL_OFFSETS_BY_ROLE.start;
}
function buildActiveNodeSignal(role) {
    if (role === 'highlight') {
        return 'Filling up';
    }
    if (role === 'windDown') {
        return 'Quiet now';
    }
    return 'Live soon';
}
function buildFollowingCopy(role) {
    if (role === 'start') {
        return 'Starting here — easing into the night';
    }
    if (role === 'highlight') {
        return 'Next: peak energy building';
    }
    return 'Then: slowing into a clean finish';
}
export function JourneyMap({ itinerary, activeRole, changedRoles, visibleAlternativesByRole: _visibleAlternativesByRole, nearbyCounts: _nearbyCounts, narrativeLine, orientationOnly = false, integratedSurface = false, activeStopDescription, activeStopDetail, stopDescriptionsByRole, stopDetailsByRole, onActiveRoleChange, }) {
    const surfaceRef = useRef(null);
    const [mapMode, setMapMode] = useState('overview');
    const [revealPhase, setRevealPhase] = useState('overview');
    const points = useMemo(() => getMapPoints(itinerary.stops.length), [itinerary.stops.length]);
    const effectiveMapMode = orientationOnly ? 'overview' : mapMode;
    const effectiveRevealPhase = orientationOnly ? 'free' : revealPhase;
    const revealRole = effectiveRevealPhase === 'free' ? activeRole : 'start';
    const startStop = itinerary.stops.find((stop) => stop.role === 'start') ?? itinerary.stops[0];
    const rolePointMap = useMemo(() => {
        const mapped = {};
        itinerary.stops.forEach((stop, index) => {
            mapped[stop.role] = points[index] ?? points[0];
        });
        return mapped;
    }, [itinerary.stops, points]);
    const routeCenter = useMemo(() => getRouteCenter(points, itinerary.stops.length), [itinerary.stops.length, points]);
    const journeyStops = useMemo(() => itinerary.stops.map((stop, index) => ({
        index,
        role: stop.role,
        stop,
    })), [itinerary.stops]);
    const activeJourneyIndex = Math.max(journeyStops.findIndex((item) => item.role === activeRole), 0);
    const syncedActiveRole = journeyStops[activeJourneyIndex]?.role ?? activeRole;
    const activeStop = itinerary.stops.find((stop) => stop.role === syncedActiveRole) ?? startStop;
    const activeStopIndex = Math.max(itinerary.stops.findIndex((stop) => stop.role === syncedActiveRole), 0);
    const focusRole = effectiveRevealPhase === 'begin-here' ? 'start' : syncedActiveRole;
    const focusPoint = effectiveMapMode === 'overview' ? routeCenter : rolePointMap[focusRole] ?? routeCenter;
    const activePoint = rolePointMap[syncedActiveRole] ?? rolePointMap.highlight ?? routeCenter;
    const framePoint = integratedSurface && effectiveMapMode === 'focus' ? { x: 50, y: 56 } : activePoint;
    const orientationPanX = orientationOnly ? clamp((50 - activePoint.x) * 0.56, -20, 20) : 0;
    const orientationPanY = orientationOnly ? clamp((50 - activePoint.y) * 0.36, -12, 12) : 0;
    const glassFrameStyle = integratedSurface
        ? { left: '50%', top: '56%' }
        : { left: `${framePoint.x}%`, top: `${framePoint.y}%` };
    const activeSurfaceDetail = stopDetailsByRole?.[syncedActiveRole] ?? activeStopDetail;
    const activeSurfaceDescription = stopDescriptionsByRole?.[syncedActiveRole] ?? activeStopDescription ?? activeStop.subtitle;
    const tonightSignals = activeSurfaceDetail?.tonightSignals?.slice(0, 2) ?? [];
    const routeGradientId = useMemo(() => `journey-route-gradient-${String(itinerary.id)
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .toLowerCase()}`, [itinerary.id]);
    const districtZones = useMemo(() => {
        const labels = buildDistrictLabels(itinerary.city, itinerary.stops);
        return DISTRICT_ZONE_TEMPLATES.map((template, index) => ({
            ...template,
            label: labels[index] ?? `District ${index + 1}`,
            id: `${itinerary.id}_district_${index}`,
        }));
    }, [itinerary.city, itinerary.id, itinerary.stops]);
    useEffect(() => {
        if (orientationOnly) {
            setMapMode('overview');
            setRevealPhase('free');
            return;
        }
        setMapMode('overview');
        setRevealPhase('overview');
        const beginTimeoutId = window.setTimeout(() => {
            setMapMode('focus');
            setRevealPhase('begin-here');
        }, 850);
        const freeTimeoutId = window.setTimeout(() => {
            setRevealPhase('free');
        }, 2000);
        return () => {
            window.clearTimeout(beginTimeoutId);
            window.clearTimeout(freeTimeoutId);
        };
    }, [itinerary.id, orientationOnly]);
    useEffect(() => {
        if (orientationOnly ||
            !integratedSurface ||
            journeyStops.length === 0 ||
            typeof window === 'undefined') {
            return;
        }
        const target = surfaceRef.current;
        if (!target) {
            return;
        }
        let rafId = 0;
        const updateByScroll = () => {
            const rect = target.getBoundingClientRect();
            const viewportHeight = Math.max(window.innerHeight || 0, 1);
            const progress = clamp((viewportHeight - rect.top) / Math.max(rect.height + viewportHeight, 1), 0, 1);
            let nextIndex = Math.floor(progress * journeyStops.length);
            nextIndex = clamp(nextIndex, 0, journeyStops.length - 1);
            const nextRole = journeyStops[nextIndex]?.role;
            if (nextRole && nextRole !== activeRole) {
                onActiveRoleChange(nextRole);
            }
        };
        const scheduleUpdate = () => {
            if (rafId) {
                return;
            }
            rafId = window.requestAnimationFrame(() => {
                rafId = 0;
                updateByScroll();
            });
        };
        updateByScroll();
        window.addEventListener('scroll', scheduleUpdate, { passive: true });
        window.addEventListener('resize', scheduleUpdate);
        return () => {
            if (rafId) {
                window.cancelAnimationFrame(rafId);
            }
            window.removeEventListener('scroll', scheduleUpdate);
            window.removeEventListener('resize', scheduleUpdate);
        };
    }, [activeRole, integratedSurface, journeyStops, onActiveRoleChange, orientationOnly]);
    const polylinePoints = points
        .slice(0, itinerary.stops.length)
        .map((point) => `${point.x},${point.y}`)
        .join(' ');
    const legLabels = itinerary.transitions.map((transition, index) => {
        const from = points[index] ?? points[0];
        const to = points[index + 1] ?? from;
        return {
            id: `${transition.fromStopId}_${transition.toStopId}_${index}`,
            x: (from.x + to.x) / 2,
            y: (from.y + to.y) / 2,
            minutes: Math.max(transition.estimatedTravelMinutes, 1),
        };
    });
    const routeSegments = itinerary.transitions.map((transition, index) => {
        const from = points[index] ?? points[0];
        const to = points[index + 1] ?? from;
        const isIntoActive = index === activeStopIndex - 1;
        const isOutOfActive = index === activeStopIndex;
        const toStop = itinerary.stops[index + 1];
        return {
            id: `${transition.fromStopId}_${transition.toStopId}_${index}`,
            x1: from.x,
            y1: from.y,
            x2: to.x,
            y2: to.y,
            emphasis: isIntoActive ? 'primary' : isOutOfActive ? 'secondary' : 'muted',
            intoHighlight: toStop?.role === 'highlight',
        };
    });
    return (_jsxs("section", { ref: surfaceRef, className: `journey-map reveal-phase-${effectiveRevealPhase}${orientationOnly ? ' orientation' : ''}`, children: [_jsxs("div", { className: "journey-map-header", children: [_jsxs("div", { children: [_jsx("p", { className: "journey-map-kicker", children: integratedSurface ? 'Journey Surface' : 'Journey Map' }), _jsx("h2", { children: itinerary.city }), _jsx("p", { className: "journey-map-subcopy", children: effectiveMapMode === 'overview'
                                    ? 'Full route view keeps every stop and movement visible.'
                                    : 'Focused stop view keeps the active beat anchored in the wider route.' }), narrativeLine && _jsx("p", { className: "journey-map-narrative", children: narrativeLine })] }), _jsxs("div", { className: "journey-map-controls", children: [_jsx("button", { type: "button", className: "chip-action", onClick: () => {
                                    setRevealPhase('free');
                                    setMapMode('overview');
                                }, children: "See Full Route" }), !orientationOnly && (_jsx("button", { type: "button", className: "chip-action", onClick: () => {
                                    setRevealPhase('free');
                                    setMapMode('focus');
                                }, children: "Focus Active Stop" }))] })] }), _jsxs("div", { className: `journey-map-stage-shell reveal-${effectiveRevealPhase}${buildRoleStateClass(syncedActiveRole)}`, children: [orientationOnly && (_jsx("p", { className: "journey-map-following", children: buildFollowingCopy(syncedActiveRole) })), startStop && !orientationOnly && (_jsxs("div", { className: `journey-map-overlay ${effectiveRevealPhase}`, children: [_jsx("p", { className: "journey-map-overlay-kicker", children: effectiveRevealPhase === 'overview' ? 'Full route in view' : 'Begin here' }), _jsx("strong", { children: startStop.venueName }), _jsx("span", { children: effectiveRevealPhase === 'overview'
                                    ? 'Take in the whole shape first.'
                                    : 'Start stop highlighted first so the plan reads fast.' })] })), _jsxs("div", { className: `journey-map-stage ${effectiveMapMode} ${effectiveRevealPhase}${integratedSurface ? ` ${effectiveMapMode === 'focus' ? 'story-mode' : 'route-mode'}` : ''}`, style: {
                            transformOrigin: `${focusPoint.x}% ${focusPoint.y}%`,
                            '--orientation-pan-x': `${orientationPanX}%`,
                            '--orientation-pan-y': `${orientationPanY}%`,
                        }, children: [_jsx("div", { className: "journey-map-grid" }), _jsx("div", { className: "journey-map-ambient-shimmer", "aria-hidden": "true" }), _jsxs("div", { className: "journey-map-district-layer", "aria-hidden": "true", children: [districtZones.map((zone, index) => (_jsx("span", { className: `journey-map-district-zone tone-${zone.tone}`, style: {
                                            left: `${zone.x}%`,
                                            top: `${zone.y}%`,
                                            width: `${zone.width}%`,
                                            height: `${zone.height}%`,
                                            animationDelay: `${index * 0.8}s`,
                                        } }, `${zone.id}_zone`))), districtZones.map((zone, index) => (_jsx("span", { className: `journey-map-district-label tone-${zone.tone}`, style: {
                                            left: `${zone.x}%`,
                                            top: `${zone.y}%`,
                                            animationDelay: `${index * 0.9}s`,
                                        }, children: zone.label }, `${zone.id}_label`)))] }), _jsx("div", { className: "journey-map-activity-layer", "aria-hidden": "true", children: itinerary.stops.map((stop, index) => {
                                    const point = points[index] ?? points[0];
                                    return ACTIVITY_SIGNAL_OFFSETS.map((offset, signalIndex) => {
                                        const signalPoint = {
                                            x: point.x + offset.x,
                                            y: point.y + offset.y,
                                        };
                                        return (_jsx("span", { className: `journey-map-activity-signal${buildRoleClass(stop.role)}${syncedActiveRole === stop.role ? ' active-stop' : ''}${isInViewportFrame(signalPoint, framePoint) ? ' in-frame' : ' out-frame'}`, style: {
                                                left: `${signalPoint.x}%`,
                                                top: `${signalPoint.y}%`,
                                                animationDelay: `${index * 0.42 + signalIndex * 0.3}s`,
                                            } }, `${stop.id}_activity_${signalIndex}`));
                                    });
                                }) }), _jsxs("svg", { className: "journey-map-lines", viewBox: "0 0 100 100", preserveAspectRatio: "none", "aria-hidden": "true", children: [_jsx("defs", { children: _jsxs("linearGradient", { id: routeGradientId, x1: "10%", y1: "80%", x2: "90%", y2: "20%", children: [_jsx("stop", { offset: "0%", stopColor: "rgb(102 156 199 / 0.92)" }), _jsx("stop", { offset: "56%", stopColor: "rgb(236 165 74 / 0.98)" }), _jsx("stop", { offset: "100%", stopColor: "rgb(153 168 184 / 0.56)" })] }) }), _jsx("polyline", { className: "journey-map-line-shadow", points: polylinePoints }), _jsx("polyline", { className: "journey-map-line", points: polylinePoints, style: { stroke: `url(#${routeGradientId})` } }), _jsx("polyline", { className: "journey-map-line-flow", points: polylinePoints, style: { stroke: `url(#${routeGradientId})` } }), routeSegments.map((segment) => (_jsx("line", { className: `journey-map-line-segment ${segment.emphasis}${segment.intoHighlight ? ' into-highlight' : ''}`, x1: segment.x1, y1: segment.y1, x2: segment.x2, y2: segment.y2, style: { stroke: `url(#${routeGradientId})` } }, segment.id)))] }, itinerary.id), legLabels.map((leg, index) => (_jsxs("span", { className: `journey-map-leg-label${effectiveRevealPhase === 'begin-here' && index > 0 ? ' muted' : ''}${isInViewportFrame(leg, framePoint) ? ' in-frame' : ' out-frame'}`, style: {
                                    left: `${leg.x}%`,
                                    top: `${leg.y}%`,
                                }, children: ["~", leg.minutes, " min drive"] }, leg.id))), itinerary.stops.map((stop, index) => {
                                const point = points[index] ?? points[0];
                                return (_jsxs("div", { children: [stop.role === syncedActiveRole &&
                                            getNearbyOffsets(stop.role).map((offset, previewIndex) => {
                                                const nearbySignalPoint = {
                                                    x: point.x + offset.x,
                                                    y: point.y + offset.y,
                                                };
                                                return (_jsx("span", { className: `journey-map-nearby-dot${buildRoleClass(stop.role)}${syncedActiveRole === stop.role ? ' active' : ''}${isInViewportFrame(nearbySignalPoint, framePoint) ? ' in-frame' : ' out-frame'}${effectiveMapMode === 'focus' && syncedActiveRole === stop.role ? ' centered' : ''}`, style: {
                                                        left: `${nearbySignalPoint.x}%`,
                                                        top: `${nearbySignalPoint.y}%`,
                                                        animationDelay: `${index * 0.25 + previewIndex * 0.14}s`,
                                                    } }, `${stop.id}_nearby_signal_${previewIndex}`));
                                            }), stop.role === syncedActiveRole && (_jsx("span", { className: `journey-map-node-signal${buildRoleClass(stop.role)}`, style: {
                                                left: `${point.x}%`,
                                                top: `${point.y - 13}%`,
                                            }, children: buildActiveNodeSignal(stop.role) })), _jsxs("button", { type: "button", className: `journey-map-node${syncedActiveRole === stop.role ? ' active' : ''}${changedRoles.includes(stop.role) ? ' changed' : ''}${stop.role === 'highlight' ? ' highlight' : ''}${stop.role === revealRole ? ' lead' : ''}${effectiveRevealPhase === 'begin-here' && stop.role !== revealRole ? ' muted' : ''}${isInViewportFrame(point, framePoint) ? ' in-frame' : ' out-frame'}${effectiveMapMode === 'focus' && syncedActiveRole === stop.role ? ' centered' : ''}${effectiveMapMode === 'focus' && syncedActiveRole === stop.role ? ' active-centered' : ''}`, style: { left: `${point.x}%`, top: `${point.y}%` }, onClick: () => {
                                                onActiveRoleChange(stop.role);
                                                if (!orientationOnly) {
                                                    setRevealPhase('free');
                                                    setMapMode('focus');
                                                }
                                            }, children: [_jsxs("span", { className: "journey-map-node-index", children: ["0", index + 1] }), _jsx("strong", { children: buildNodeLabel(stop.role) }), _jsx("small", { children: stop.venueName })] })] }, stop.id));
                            }), integratedSurface && (_jsx("div", { className: `journey-map-story-scrim ${effectiveMapMode === 'focus' ? 'active' : ''}`, "aria-hidden": "true" })), !orientationOnly && (_jsx("div", { className: `journey-map-viewframe${integratedSurface && effectiveMapMode === 'focus' ? ' story-focus' : ''}`, style: glassFrameStyle, "aria-hidden": "true" })), integratedSurface && activeStop && (_jsx("div", { className: `journey-surface-story-layer ${effectiveMapMode === 'focus' ? 'focus' : 'overview'}`, children: effectiveMapMode === 'focus' ? (_jsxs("article", { className: "journey-surface-card active primary", children: [_jsx("p", { className: "journey-surface-card-label", children: activeStop.title.toUpperCase() }), _jsx("h3", { children: activeStop.venueName }), _jsx("p", { className: "journey-surface-card-description", children: activeSurfaceDescription }), activeSurfaceDetail?.whyItFits && (_jsxs("div", { className: "journey-surface-card-row", children: [_jsx("p", { className: "journey-surface-card-row-label", children: "Why it fits" }), _jsx("p", { className: "journey-surface-card-row-copy", children: activeSurfaceDetail.whyItFits })] })), tonightSignals.length > 0 && (_jsxs("div", { className: "journey-surface-card-row", children: [_jsx("p", { className: "journey-surface-card-row-label", children: "Tonight" }), _jsx("ul", { className: "journey-surface-card-signals", children: tonightSignals.map((signal) => (_jsx("li", { children: signal }, `${activeStop.id}_${signal}`))) })] })), activeSurfaceDetail?.localSignal && (_jsxs("div", { className: "journey-surface-card-row", children: [_jsx("p", { className: "journey-surface-card-row-label", children: "Local note" }), _jsx("p", { className: "journey-surface-card-row-copy", children: activeSurfaceDetail.localSignal })] }))] })) : (_jsxs("div", { className: "journey-surface-route-pill", children: [_jsx("span", { children: activeStop.title }), _jsx("strong", { children: activeStop.venueName })] })) }))] })] }), _jsxs("div", { className: "journey-map-footer", children: [_jsx("p", { className: "journey-map-focus", children: effectiveMapMode === 'overview'
                            ? `Full route view across ${itinerary.city}.`
                            : `Focused on ${buildNodeLabel(syncedActiveRole)} with surrounding route context preserved.` }), _jsx("p", { className: "journey-map-now-viewing", children: `Now viewing: ${buildNodeLabel(syncedActiveRole)} — ${activeStop.venueName}` }), _jsxs("div", { className: "journey-map-legend", children: [_jsx("span", { children: "Main route" }), _jsx("span", { children: integratedSurface ? 'Active story card' : 'Around here tonight' })] })] })] }));
}
