import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { getVibeLabel } from '../../domain/types/intent';
function buildRouteMeta(itinerary) {
    const location = itinerary.neighborhood
        ? `${itinerary.neighborhood}, ${itinerary.city}`
        : itinerary.city;
    return `${itinerary.stops.length} stops | ${location}`;
}
function formatDistrictStrategy(strategy) {
    return strategy === 'shift-district' ? 'District shift' : 'Stay local';
}
function formatTimePhase(phase) {
    if (phase === 'late-night') {
        return 'Late night';
    }
    return phase.charAt(0).toUpperCase() + phase.slice(1);
}
function formatContinuationMode(mode) {
    if (mode === 'CONTINUATION_FRAGMENT') {
        return 'Fragment';
    }
    if (mode === 'COMPACT_CONTINUATION') {
        return 'Compact continuation';
    }
    return 'Full continuation';
}
export function ContinuationPanel({ plan, title = 'Continue the outing', variant = 'default', }) {
    const itinerary = plan.displayItinerary;
    const kicker = variant === 'secondary' ? 'Continuation' : 'Optional continuation';
    return (_jsxs("section", { className: `continuation-panel${variant === 'secondary' ? ' secondary' : ''}`, children: [_jsxs("div", { className: "continuation-header", children: [_jsxs("div", { children: [_jsx("p", { className: "continuation-kicker", children: kicker }), _jsx("h2", { children: title }), _jsx("p", { className: "continuation-copy", children: plan.transition.summary })] }), _jsxs("div", { className: "reveal-story-meta", children: [_jsx("span", { className: "reveal-story-chip", children: buildRouteMeta(itinerary) }), _jsx("span", { className: "reveal-story-chip", children: itinerary.estimatedTotalLabel }), _jsx("span", { className: "reveal-story-chip", children: itinerary.routeFeelLabel })] })] }), _jsx("p", { className: "continuation-subtitle", children: itinerary.story.subtitle }), _jsxs("div", { className: "continuation-chip-row", children: [_jsx("span", { className: "continuation-chip", children: formatContinuationMode(plan.transition.continuationMode) }), _jsx("span", { className: "continuation-chip", children: plan.transition.resolutionStrength }), _jsx("span", { className: "continuation-chip", children: formatDistrictStrategy(plan.transition.districtStrategy) }), _jsx("span", { className: "continuation-chip", children: plan.transition.vibeShift }), _jsx("span", { className: "continuation-chip", children: formatTimePhase(plan.transition.timePhase) }), _jsx("span", { className: "continuation-chip", children: getVibeLabel(plan.transition.nextPrimaryVibe) })] }), _jsxs("div", { className: "helper-note-stack", children: [_jsxs("p", { className: "helper-note", children: [_jsx("strong", { children: "Resolved:" }), " ", plan.transition.resolvedReason] }), _jsxs("p", { className: "helper-note", children: [_jsx("strong", { children: "Mode:" }), " ", plan.transition.continuationReason] }), _jsxs("p", { className: "helper-note", children: [_jsx("strong", { children: "District:" }), " ", plan.transition.districtReason] }), _jsxs("p", { className: "helper-note", children: [_jsx("strong", { children: "Vibe:" }), " ", plan.transition.vibeReason] }), _jsxs("p", { className: "helper-note", children: [_jsx("strong", { children: "Repetition:" }), " ", plan.transition.repetitionReason] })] }), _jsx("div", { className: "continuation-stop-list", children: itinerary.stops.map((stop, index) => (_jsxs("article", { className: "continuation-stop", children: [_jsxs("span", { className: "continuation-stop-index", children: ["0", index + 1] }), _jsxs("div", { className: "continuation-stop-body", children: [_jsx("p", { className: "continuation-stop-kicker", children: stop.title }), _jsx("strong", { children: stop.venueName }), _jsxs("p", { className: "continuation-stop-meta", children: [stop.neighborhood, " | ", stop.category.replace('_', ' '), " | ", stop.estimatedDurationLabel] })] })] }, stop.id))) })] }));
}
