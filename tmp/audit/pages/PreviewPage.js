import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { ID8Butler } from '../components/butler/ID8Butler';
import { RouteSpine } from '../components/journey/RouteSpine';
import { PageShell } from '../components/layout/PageShell';
const neighborhoodOptions = [
    'Downtown',
    'SoFA District',
    'Santana Row',
    'Rose Garden',
    'Willow Glen',
    'Kelley Park',
    'North San Jose',
    'Alum Rock',
    'Evergreen',
];
const draftPlaceholderItems = [
    'Extend this night',
    'Best start time',
    'Group input',
    'Availability & booking',
];
function buildDraftSummary(distanceMode) {
    if (distanceMode === 'short-drive') {
        return 'Built around your vibe with a little more range for stronger options.';
    }
    return 'Built around your vibe and nearby options.';
}
function buildDraftFeedback({ previewDirty, districtPreference, neighborhood, startTime, distanceTolerance, energyBias, }) {
    if (previewDirty) {
        return 'Your preview controls are ready. Adjust plan to refresh this route.';
    }
    if (districtPreference) {
        return 'This draft is currently tuned toward your preferred district.';
    }
    if (startTime) {
        return 'We adjusted this draft to better fit your selected time.';
    }
    if (neighborhood) {
        return 'This draft stays close to your selected area.';
    }
    if (distanceTolerance === 'compact') {
        return 'We kept this route tight so everything stays easy to reach.';
    }
    if (distanceTolerance === 'open') {
        return 'This route has more movement range for wider coverage.';
    }
    if (energyBias === 'softer') {
        return 'This route is currently tuned toward a softer energy curve.';
    }
    if (energyBias === 'stronger') {
        return 'This route is currently tuned toward a stronger energy curve.';
    }
    return 'We gave this draft a little more range to open up stronger combinations.';
}
function buildEffectStrengthLabel(value) {
    if (value === 'strong') {
        return 'Strong update';
    }
    if (value === 'moderate') {
        return 'Moderate update';
    }
    return 'Minor update';
}
function buildStopReference(itinerary, role) {
    return itinerary.stops.find((stop) => stop.role === role);
}
function buildRoleShapeSummary(itinerary, role, action) {
    const stop = buildStopReference(itinerary, role);
    const label = stop?.venueName ?? 'that stop';
    if (action.id === 'use-to-start') {
        return `Moved ${label} to the start of the night`;
    }
    if (action.id === 'make-main') {
        return `Made ${label} the main stop`;
    }
    if (action.id === 'save-for-later') {
        return `Saved ${label} for later in the night`;
    }
    return `Moved ${label} to the end of the night`;
}
function buildReplaceSummary(itinerary, role, nextLabel) {
    const stop = buildStopReference(itinerary, role);
    const roleLabel = stop?.title.toLowerCase() ?? 'this stop';
    return `Replaced ${roleLabel} with ${nextLabel}`;
}
function buildRouteChangeSummary(itinerary, role, actionId, nextLabel) {
    const stop = buildStopReference(itinerary, role);
    const currentLabel = stop?.venueName ?? 'this stop';
    if (actionId === 'remove-stop') {
        return `Removed ${currentLabel} from the route`;
    }
    if (actionId === 'replace-stop' && nextLabel) {
        return buildReplaceSummary(itinerary, role, nextLabel);
    }
    if (actionId === 'add-before') {
        return `Added ${nextLabel ?? 'a stop'} before ${currentLabel}`;
    }
    return `Added ${nextLabel ?? 'a stop'} after ${currentLabel}`;
}
export function PreviewPage({ itinerary, generationTrace, planAdjustmentFeedback, neighborhood, startTime, distanceMode, budget, previewControls, previewDirty, compositionConflictMessage, alternativesByRole, alternativeKindsByRole, roleShapeActionsByRole, composeActionsByRole, ownedStopKindsByRole, adjustDisabledRoles = [], adjustLockedNotesByRole, unavailableByRole, lceRepairProposal, lceTraceNote, lceSystemMessage, debugPanel, onChangePreviewControls, onChangeNeighborhood, onChangeBudget, onShowSwap, onApplySwap, onApplyRoleShape, onApplyComposeAction, onSearchCompose, onCreateCustomComposeStop, onApplyComposeSearchResult, onApplyLceRepairProposal, onKeepCurrentPlanAfterLce, onBack, onRefresh, onConfirm, }) {
    const [activeRole, setActiveRole] = useState(itinerary.stops.find((stop) => stop.role === 'highlight')?.role ??
        itinerary.stops[0]?.role ??
        'start');
    const [changedRoles, setChangedRoles] = useState([]);
    const [animatedRoles, setAnimatedRoles] = useState([]);
    const [recentEditSummary, setRecentEditSummary] = useState();
    const [collapseAdjustPanelKey, setCollapseAdjustPanelKey] = useState(0);
    const previousStopsByRoleRef = useRef(undefined);
    const recommendedDistricts = generationTrace?.recommendedDistricts ?? [];
    const districtPreference = previewControls.districtPreference ?? generationTrace?.selectedDistrictId ?? '';
    const distanceTolerance = previewControls.distanceTolerance ?? (distanceMode === 'short-drive' ? 'open' : 'balanced');
    const energyBias = previewControls.energyBias ?? 'balanced';
    const startTimeValue = previewControls.startTime ?? startTime ?? '';
    const feedbackCopy = buildDraftFeedback({
        previewDirty,
        districtPreference: districtPreference || undefined,
        neighborhood,
        startTime: startTimeValue || undefined,
        distanceTolerance,
        energyBias,
    });
    useEffect(() => {
        if (!itinerary.stops.some((stop) => stop.role === activeRole)) {
            setActiveRole(itinerary.stops[0]?.role ?? 'start');
        }
    }, [activeRole, itinerary.stops]);
    useEffect(() => {
        const nextStopsByRole = itinerary.stops.reduce((accumulator, stop) => {
            accumulator[stop.role] = stop.venueId;
            return accumulator;
        }, {});
        const previousStopsByRole = previousStopsByRoleRef.current;
        previousStopsByRoleRef.current = nextStopsByRole;
        if (!previousStopsByRole) {
            return;
        }
        let nextChangedRoles = itinerary.stops
            .filter((stop) => previousStopsByRole[stop.role] !== stop.venueId)
            .map((stop) => stop.role);
        const previousRoles = Object.keys(previousStopsByRole);
        const nextRoles = itinerary.stops.map((stop) => stop.role);
        const structuralChangeDetected = previousRoles.length !== nextRoles.length ||
            previousRoles.some((role) => !nextRoles.includes(role)) ||
            nextRoles.some((role) => !previousRoles.includes(role));
        if (structuralChangeDetected && nextChangedRoles.length === 0) {
            nextChangedRoles = nextRoles;
        }
        setChangedRoles(nextChangedRoles);
        if (nextChangedRoles.length === 0) {
            setAnimatedRoles([]);
            return;
        }
        setActiveRole(nextChangedRoles[0] ?? 'start');
        setAnimatedRoles(nextChangedRoles);
        const timeoutId = window.setTimeout(() => setAnimatedRoles([]), 1800);
        return () => window.clearTimeout(timeoutId);
    }, [itinerary.id, itinerary.stops]);
    const handleApplyRoleShape = (role, action) => {
        const applied = onApplyRoleShape(role, action.id);
        if (!applied) {
            return;
        }
        setActiveRole(action.targetRole);
        setRecentEditSummary(buildRoleShapeSummary(itinerary, role, action));
        setCollapseAdjustPanelKey((current) => current + 1);
    };
    const handleApplySwap = (role, venueId) => {
        onApplySwap(role, venueId);
        const nextLabel = alternativesByRole[role]?.find((option) => option.scoredVenue.venue.id === venueId)?.scoredVenue
            .venue.name ?? 'a new option';
        setActiveRole(role);
        setRecentEditSummary(buildReplaceSummary(itinerary, role, nextLabel));
    };
    const handleApplyComposeAction = (role, action) => {
        const applied = onApplyComposeAction(role, action.id);
        if (!applied) {
            return false;
        }
        setActiveRole(role);
        setRecentEditSummary(buildRouteChangeSummary(itinerary, role, action.id));
        setCollapseAdjustPanelKey((current) => current + 1);
        return true;
    };
    const handleApplyComposeSearchResult = (role, action, result) => {
        const applied = onApplyComposeSearchResult(role, action.id, result);
        if (!applied) {
            return false;
        }
        setActiveRole(action.id === 'replace-stop' ? role : 'surprise');
        setRecentEditSummary(buildRouteChangeSummary(itinerary, role, action.id, result.title));
        setCollapseAdjustPanelKey((current) => current + 1);
        return true;
    };
    return (_jsxs(PageShell, { topSlot: _jsx(ID8Butler, { message: "Here is the draft version of your night. Read the story spine first, then adjust individual stops if you want to reshape the plan without rebuilding it." }), title: "Draft your night", subtitle: buildDraftSummary(distanceMode), children: [_jsxs("div", { className: "draft-page-topline", children: [_jsxs("div", { className: "reveal-story-meta", children: [_jsx("span", { className: "reveal-story-chip draft-chip", children: "Draft" }), _jsx("span", { className: "reveal-story-chip", children: itinerary.estimatedTotalLabel }), _jsx("span", { className: "reveal-story-chip", children: itinerary.routeFeelLabel })] }), _jsx("button", { type: "button", className: "ghost-button subtle draft-back-link", onClick: onBack, children: "Back to Explore" })] }), _jsxs("div", { className: "reveal-story-meta", "aria-label": "Built with", children: [_jsx("span", { className: "reveal-story-chip", children: "Built with:" }), _jsx("span", { className: "reveal-story-chip", children: "Real-time availability" }), _jsx("span", { className: "reveal-story-chip", children: "Local context" }), _jsx("span", { className: "reveal-story-chip", children: "Flow optimization" })] }), _jsxs("section", { className: "preview-controls-panel", "aria-label": "Preview controls", children: [_jsxs("div", { className: "preview-controls-header", children: [_jsxs("div", { children: [_jsx("p", { className: "discovery-group-kicker", children: "Preview controls" }), _jsx("h3", { children: "Lightly steer this route" })] }), _jsx("button", { type: "button", className: "ghost-button", disabled: !previewDirty, onClick: onRefresh, children: "Adjust plan" })] }), _jsxs("div", { className: "preview-controls-grid", children: [recommendedDistricts.length > 0 && (_jsxs("label", { className: "input-group", children: [_jsx("span", { className: "input-label", children: "Preferred area" }), _jsxs("select", { value: districtPreference, onChange: (event) => onChangePreviewControls({
                                            districtPreference: event.target.value || undefined,
                                        }), children: [_jsx("option", { value: "", children: "Let planner decide" }), recommendedDistricts.map((district) => (_jsx("option", { value: district.districtId, children: district.label }, district.districtId)))] })] })), _jsxs("label", { className: "input-group", children: [_jsx("span", { className: "input-label", children: "Start time" }), _jsx("input", { type: "time", value: startTimeValue, onChange: (event) => onChangePreviewControls({
                                            startTime: event.target.value || undefined,
                                        }), placeholder: "20:00" })] }), _jsxs("fieldset", { className: "input-group", children: [_jsx("legend", { className: "input-label", children: "Distance tolerance" }), _jsxs("div", { className: "toggle-row", children: [_jsx("button", { type: "button", className: `toggle-pill${distanceTolerance === 'compact' ? ' selected' : ''}`, onClick: () => onChangePreviewControls({
                                                    distanceTolerance: 'compact',
                                                }), children: "Compact" }), _jsx("button", { type: "button", className: `toggle-pill${distanceTolerance === 'balanced' ? ' selected' : ''}`, onClick: () => onChangePreviewControls({
                                                    distanceTolerance: 'balanced',
                                                }), children: "Balanced" }), _jsx("button", { type: "button", className: `toggle-pill${distanceTolerance === 'open' ? ' selected' : ''}`, onClick: () => onChangePreviewControls({
                                                    distanceTolerance: 'open',
                                                }), children: "Open" })] })] }), _jsxs("fieldset", { className: "input-group", children: [_jsx("legend", { className: "input-label", children: "Energy bias" }), _jsxs("div", { className: "toggle-row", children: [_jsx("button", { type: "button", className: `toggle-pill${energyBias === 'softer' ? ' selected' : ''}`, onClick: () => onChangePreviewControls({
                                                    energyBias: 'softer',
                                                }), children: "Softer" }), _jsx("button", { type: "button", className: `toggle-pill${energyBias === 'balanced' ? ' selected' : ''}`, onClick: () => onChangePreviewControls({
                                                    energyBias: 'balanced',
                                                }), children: "Balanced" }), _jsx("button", { type: "button", className: `toggle-pill${energyBias === 'stronger' ? ' selected' : ''}`, onClick: () => onChangePreviewControls({
                                                    energyBias: 'stronger',
                                                }), children: "Stronger" })] })] })] })] }), planAdjustmentFeedback && (_jsxs("section", { className: "plan-update-panel", "aria-label": "Plan update", children: [_jsxs("div", { className: "plan-update-header", children: [_jsx("p", { className: "discovery-group-kicker", children: "Plan update" }), _jsx("span", { className: `plan-update-strength plan-update-strength-${planAdjustmentFeedback.effectStrength}`, children: buildEffectStrengthLabel(planAdjustmentFeedback.effectStrength) })] }), _jsx("p", { className: "plan-update-headline", children: planAdjustmentFeedback.headline }), _jsxs("div", { className: "plan-update-lists", children: [_jsxs("div", { children: [_jsx("p", { className: "plan-update-list-title", children: "What changed" }), _jsx("ul", { className: "plan-update-list", children: planAdjustmentFeedback.changeSummary.map((item) => (_jsx("li", { children: item }, `change-${item}`))) })] }), _jsxs("div", { children: [_jsx("p", { className: "plan-update-list-title", children: "Why this still works" }), _jsx("ul", { className: "plan-update-list", children: planAdjustmentFeedback.trustNotes.map((item) => (_jsx("li", { children: item }, `trust-${item}`))) })] })] })] })), _jsxs("div", { className: "stage-rail", "aria-label": "Journey stages", children: [_jsx("span", { className: "stage-rail-item", children: "Explore" }), _jsx("span", { className: "stage-rail-item active", children: "Draft" }), _jsx("span", { className: "stage-rail-item active", children: "Tune" }), _jsx("span", { className: "stage-rail-item", children: "Confirm" }), _jsx("span", { className: "stage-rail-item", children: "Experience" }), _jsx("span", { className: "stage-rail-item later", children: "Extend (later)" })] }), _jsx(RouteSpine, { className: "draft-story-spine", stops: itinerary.stops, storySpine: itinerary.storySpine, debugMode: false, adjustMode: "swap-only", collapseAdjustPanelKey: collapseAdjustPanelKey, activeRole: activeRole, changedRoles: changedRoles, animatedRoles: animatedRoles, generationTrace: generationTrace, alternativesByRole: alternativesByRole, alternativeKindsByRole: alternativeKindsByRole, roleShapeActionsByRole: roleShapeActionsByRole, composeActionsByRole: composeActionsByRole, ownedStopKindsByRole: ownedStopKindsByRole, adjustDisabledRoles: adjustDisabledRoles, adjustLockedNotesByRole: adjustLockedNotesByRole, unavailableByRole: unavailableByRole, adjustLabel: "Edit", onFocusRole: setActiveRole, onShowSwap: onShowSwap, onShowNearby: () => undefined, onApplySwap: handleApplySwap, onApplyRoleShape: (roleToShape, actionId) => {
                    const action = roleShapeActionsByRole[roleToShape]?.find((item) => item.id === actionId);
                    if (!action) {
                        return;
                    }
                    handleApplyRoleShape(roleToShape, action);
                }, onApplyComposeAction: (roleToCompose, actionId) => {
                    const action = composeActionsByRole[roleToCompose]?.find((item) => item.id === actionId);
                    if (!action) {
                        return false;
                    }
                    return handleApplyComposeAction(roleToCompose, action);
                }, onSearchCompose: onSearchCompose, onCreateCustomComposeStop: onCreateCustomComposeStop, onApplyComposeSearchResult: (roleToCompose, actionId, result) => {
                    const action = composeActionsByRole[roleToCompose]?.find((item) => item.id === actionId);
                    if (!action || action.id === 'remove-stop') {
                        return false;
                    }
                    return handleApplyComposeSearchResult(roleToCompose, action, result);
                } }), lceRepairProposal && (_jsxs("div", { className: "preview-notice draft-feedback", children: [_jsx("p", { className: "preview-notice-title", children: "This stop may no longer be available." }), _jsx("p", { className: "preview-notice-copy", children: "We found a strong alternative." }), _jsxs("p", { className: "preview-notice-copy", children: [lceRepairProposal.brokenStopVenueName, " ", " -> ", " ", lceRepairProposal.replacement.venue.name] }), _jsx("p", { className: "preview-notice-copy", children: "Adjusted using real-time conditions" }), _jsxs("div", { className: "action-row draft-actions", children: [_jsx("button", { type: "button", className: "ghost-button subtle", onClick: onKeepCurrentPlanAfterLce, children: "Keep current plan" }), _jsx("button", { type: "button", className: "primary-button", onClick: onApplyLceRepairProposal, children: "Apply update" })] })] })), lceSystemMessage && (_jsxs("div", { className: "preview-notice draft-feedback", children: [_jsx("p", { className: "preview-notice-title", children: "System" }), _jsx("p", { className: "preview-notice-copy", children: lceSystemMessage }), lceSystemMessage === 'Adjusted for availability.' && (_jsx("p", { className: "preview-notice-copy", children: "Route preserved and rebalanced." }))] })), recentEditSummary && (_jsxs("div", { className: "preview-notice draft-change-summary", children: [_jsx("p", { className: "preview-notice-title", children: "Recent change" }), _jsx("p", { className: "preview-notice-copy", children: recentEditSummary })] })), compositionConflictMessage && (_jsxs("div", { className: "preview-notice draft-feedback", children: [_jsx("p", { className: "preview-notice-title", children: "Composition constraint" }), _jsx("p", { className: "preview-notice-copy", children: compositionConflictMessage })] })), debugPanel, _jsxs("section", { className: "preview-adjustments draft-tune-panel", children: [_jsxs("div", { className: "preview-adjustments-header", children: [_jsxs("div", { children: [_jsx("p", { className: "discovery-group-kicker", children: "Tune this plan" }), _jsx("h2", { children: "Small changes, same night" })] }), _jsx("p", { className: "discovery-group-copy", children: "Keep the story spine in view, then tune the pace and start point without rebuilding the whole flow by hand." }), _jsx("p", { className: "explore-section-copy", children: 'Use "Edit" on any stop to replace it, move it in the night, or change the route without rebuilding the whole draft.' })] }), _jsxs("details", { className: "draft-more-options", children: [_jsx("summary", { children: "More options" }), _jsxs("div", { className: "preview-adjustments-grid", children: [_jsxs("label", { className: "input-group", children: [_jsx("span", { className: "input-label", children: "Stay near" }), _jsxs("select", { value: neighborhood ?? '', onChange: (event) => onChangeNeighborhood(event.target.value ? event.target.value : undefined), children: [_jsx("option", { value: "", children: "Any neighborhood" }), neighborhoodOptions.map((option) => (_jsx("option", { value: option, children: option }, option)))] })] }), _jsxs("label", { className: "input-group", children: [_jsx("span", { className: "input-label", children: "Spend" }), _jsxs("select", { value: budget ?? '', onChange: (event) => onChangeBudget(event.target.value ? event.target.value : undefined), children: [_jsx("option", { value: "", children: "No preference" }), _jsx("option", { value: "value", children: "Value" }), _jsx("option", { value: "balanced", children: "Balanced" }), _jsx("option", { value: "premium", children: "Premium" })] })] })] })] }), _jsxs("div", { className: "preview-notice draft-feedback", children: [_jsx("p", { className: "preview-notice-title", children: "System note" }), _jsx("p", { className: "preview-notice-copy", children: feedbackCopy })] }), _jsx("div", { className: "action-row draft-actions", children: _jsx("button", { type: "button", className: "primary-button", onClick: onConfirm, children: "Lock this plan" }) })] }), _jsxs("section", { className: "roadmap-panel", "aria-label": "Coming later", children: [_jsxs("div", { className: "roadmap-panel-header", children: [_jsx("p", { className: "discovery-group-kicker", children: "Coming later" }), _jsx("p", { className: "discovery-group-copy", children: "These are part of the fuller flow, but they are not live yet." })] }), _jsx("div", { className: "roadmap-grid", children: draftPlaceholderItems.map((item) => (_jsxs("div", { className: "roadmap-item", children: [_jsx("span", { children: item }), _jsx("small", { children: "Not live yet" })] }, item))) })] })] }));
}
