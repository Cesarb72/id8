import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { ID8Butler } from '../components/butler/ID8Butler';
import { ExtendOutingSection } from '../components/exploration/ExtendOutingSection';
import { RefineSheet } from '../components/flow/RefineSheet';
import { DistrictFlowNarrative } from '../components/journey/DistrictFlowNarrative';
import { JourneyMap } from '../components/journey/JourneyMap';
import { RevealDebugPanels } from '../components/journey/RevealDebugPanels';
import { RouteSpine } from '../components/journey/RouteSpine';
import { PageShell } from '../components/layout/PageShell';
const revealPlaceholderItems = [
    'Keep going nearby',
    'Try a different area',
    'Share with friends',
    'Book this plan',
];
function buildRouteMeta(itinerary) {
    const location = itinerary.neighborhood
        ? `${itinerary.neighborhood}, ${itinerary.city}`
        : itinerary.city;
    return `${itinerary.stops.length} stops | ${location}`;
}
function buildRefinementBannerMessage(refinementOutcome) {
    if (!refinementOutcome) {
        return undefined;
    }
    const changedRoles = refinementOutcome.stopDeltas
        .filter((delta) => delta.changed)
        .map((delta) => delta.role);
    if (refinementOutcome.materiallyChangedStopCount === 0) {
        return 'No stronger nearby option matched that change.';
    }
    if (changedRoles.includes('start') &&
        refinementOutcome.requestedModes.includes('more-unique')) {
        return 'Start changed for a more unique opening.';
    }
    if (refinementOutcome.requestedModes.includes('closer-by') &&
        refinementOutcome.changedStopCount > 0) {
        return 'Route tightened for a closer night out.';
    }
    if (changedRoles.includes('highlight') &&
        refinementOutcome.requestedModes.includes('more-exciting')) {
        return 'Highlight changed for a stronger centerpiece.';
    }
    if (changedRoles.includes('windDown') &&
        refinementOutcome.requestedModes.includes('more-relaxed')) {
        return 'Wind Down shifted into a softer finish.';
    }
    return refinementOutcome.summaryMessage;
}
function getAnchorStatus(generationTrace) {
    if (!generationTrace?.anchorApplied) {
        return 'ok';
    }
    const anchorTrace = generationTrace.constraintTrace.find((entry) => entry.type === 'anchor');
    const hasConstraintConflict = generationTrace.constraintTrace.some((entry) => entry.decision === 'conflict');
    if (hasConstraintConflict || anchorTrace?.decision === 'conflict') {
        return 'conflict';
    }
    if (generationTrace.anchorSurvivedToArc === false || anchorTrace?.decision === 'failed') {
        return 'dropped';
    }
    return 'ok';
}
function buildAnchorStatusMessage(generationTrace) {
    const status = getAnchorStatus(generationTrace);
    if (status === 'ok') {
        return { status };
    }
    const message = generationTrace?.temporalTrace.mode === 'explicit'
        ? "This place isn't available at your selected time."
        : "We couldn't build a plan around this place.";
    const detail = status === 'conflict'
        ? 'The selected time created a hard conflict, so the route stayed realistic instead of forcing the anchor.'
        : 'The route could not keep this place as the required anchor and still produce a viable plan.';
    return { status, message, detail };
}
export function RevealPage({ itinerary, selectedRefinements, generationTrace, compositionConflictMessage, explorationPlan, explorationLoading, lightNearbyExtensions, alternativesByRole, alternativeKindsByRole, forceDebug = false, onShowSwap, onShowNearby, onApplySwap, onApplyRefinement, onContinueOuting, onLock, onStartOver, }) {
    const [showRefineSheet, setShowRefineSheet] = useState(false);
    const [activeRole, setActiveRole] = useState('start');
    const [animatedRoles, setAnimatedRoles] = useState([]);
    const debugEnabled = forceDebug ||
        (typeof window !== 'undefined' && window.location.search.includes('debug=1'));
    const refinementOutcome = generationTrace?.refinementOutcome;
    const changedRoles = refinementOutcome?.stopDeltas.filter((delta) => delta.changed).map((delta) => delta.role) ??
        [];
    const refinementBannerMessage = buildRefinementBannerMessage(refinementOutcome);
    const anchorStatusMessage = buildAnchorStatusMessage(generationTrace);
    useEffect(() => {
        if (!itinerary.stops.some((stop) => stop.role === activeRole)) {
            setActiveRole('start');
        }
    }, [activeRole, itinerary.stops]);
    useEffect(() => {
        if (!refinementOutcome?.nextItineraryId) {
            return;
        }
        const nextAnimatedRoles = refinementOutcome.stopDeltas
            .filter((delta) => delta.changed)
            .map((delta) => delta.role);
        if (nextAnimatedRoles.length === 0) {
            return;
        }
        setActiveRole(nextAnimatedRoles[0] ?? 'start');
        setAnimatedRoles(nextAnimatedRoles);
        const timeoutId = window.setTimeout(() => setAnimatedRoles([]), 2200);
        return () => window.clearTimeout(timeoutId);
    }, [refinementOutcome?.nextItineraryId, refinementOutcome?.stopDeltas]);
    return (_jsxs(PageShell, { topSlot: _jsx(ID8Butler, { message: "Your route is set. Follow the main spine first, then open nearby branches only if you want extra room to wander." }), title: itinerary.story.headline, subtitle: itinerary.story.subtitle, footer: _jsxs("div", { className: "action-row wrap", children: [_jsx("button", { type: "button", className: "ghost-button", onClick: onStartOver, children: "Start Over" }), _jsx("button", { type: "button", className: "ghost-button", onClick: () => setShowRefineSheet(true), children: "Refine It" }), _jsx("button", { type: "button", className: "primary-button", onClick: onLock, children: "Lock It In" })] }), children: [_jsxs("div", { className: "reveal-story-meta", children: [_jsx("span", { className: "reveal-story-chip", children: "Guided story" }), _jsx("span", { className: "reveal-story-chip", children: buildRouteMeta(itinerary) }), _jsx("span", { className: "reveal-story-chip", children: itinerary.estimatedTotalLabel }), _jsx("span", { className: "reveal-story-chip", children: itinerary.routeFeelLabel })] }), _jsxs("div", { className: "reveal-story-meta", "aria-label": "Built with", children: [_jsx("span", { className: "reveal-story-chip", children: "Built with:" }), _jsx("span", { className: "reveal-story-chip", children: "Real-time availability" }), _jsx("span", { className: "reveal-story-chip", children: "Local context" }), _jsx("span", { className: "reveal-story-chip", children: "Flow optimization" })] }), _jsxs("div", { className: "stage-rail", "aria-label": "Journey stages", children: [_jsx("span", { className: "stage-rail-item", children: "Explore" }), _jsx("span", { className: "stage-rail-item", children: "Draft" }), _jsx("span", { className: "stage-rail-item", children: "Tune" }), _jsx("span", { className: "stage-rail-item", children: "Confirm" }), _jsx("span", { className: "stage-rail-item active", children: "Experience" }), _jsx("span", { className: "stage-rail-item later", children: "Extend (later)" })] }), _jsx(DistrictFlowNarrative, { itinerary: itinerary }), _jsx(JourneyMap, { itinerary: itinerary, activeRole: activeRole, changedRoles: changedRoles, visibleAlternativesByRole: alternativesByRole, nearbyCounts: generationTrace?.nearbyAlternativeCounts ?? {}, onActiveRoleChange: setActiveRole }), refinementBannerMessage && (_jsxs("div", { className: "refinement-banner", children: [_jsx("p", { className: "refinement-banner-kicker", children: "Refinement Update" }), _jsx("p", { className: "refinement-banner-copy", children: refinementBannerMessage })] })), anchorStatusMessage.status !== 'ok' && anchorStatusMessage.message && (_jsxs("div", { className: "refinement-banner", children: [_jsx("p", { className: "refinement-banner-kicker", children: "\u26A0\uFE0F Anchor Issue" }), _jsx("p", { className: "refinement-banner-copy", children: anchorStatusMessage.message }), anchorStatusMessage.detail && (_jsx("p", { className: "refinement-banner-copy", children: anchorStatusMessage.detail }))] })), compositionConflictMessage && (_jsxs("div", { className: "refinement-banner", children: [_jsx("p", { className: "refinement-banner-kicker", children: "Composition Constraint" }), _jsx("p", { className: "refinement-banner-copy", children: compositionConflictMessage })] })), _jsx(RouteSpine, { stops: itinerary.stops, storySpine: itinerary.storySpine, debugMode: debugEnabled, allowStopAdjustments: false, activeRole: activeRole, changedRoles: changedRoles, animatedRoles: animatedRoles, generationTrace: generationTrace, alternativesByRole: alternativesByRole, alternativeKindsByRole: alternativeKindsByRole, onFocusRole: setActiveRole, onShowSwap: onShowSwap, onShowNearby: onShowNearby, onApplySwap: onApplySwap }), _jsx(ExtendOutingSection, { options: lightNearbyExtensions, explorationPlan: explorationPlan, explorationLoading: explorationLoading, onContinueOuting: onContinueOuting }), _jsxs("section", { className: "roadmap-panel", "aria-label": "Coming later", children: [_jsxs("div", { className: "roadmap-panel-header", children: [_jsx("p", { className: "discovery-group-kicker", children: "Coming later" }), _jsx("p", { className: "discovery-group-copy", children: "These extensions are visible here to show the fuller journey, but none are live yet." })] }), _jsx("div", { className: "roadmap-grid", children: revealPlaceholderItems.map((item) => (_jsxs("div", { className: "roadmap-item", children: [_jsx("span", { children: item }), _jsx("small", { children: "Later" })] }, item))) })] }), debugEnabled && generationTrace && (_jsx(RevealDebugPanels, { itinerary: itinerary, generationTrace: generationTrace })), showRefineSheet && (_jsx(RefineSheet, { initialModes: selectedRefinements, onClose: () => setShowRefineSheet(false), onApply: (modes) => {
                    setShowRefineSheet(false);
                    onApplyRefinement(modes);
                } }))] }));
}
