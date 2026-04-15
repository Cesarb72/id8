import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { ID8Butler } from '../butler/ID8Butler';
import { PageShell } from '../layout/PageShell';
function isSelected(selectedVenueIds, venueId) {
    return selectedVenueIds.includes(venueId);
}
function buildSelectionSummary(selectedCount) {
    if (selectedCount === 0) {
        return 'No picks yet';
    }
    if (selectedCount === 1) {
        return '1 pick saved';
    }
    return '2 picks saved';
}
function buildSelectionHelper(selectedCount) {
    if (selectedCount === 0) {
        return 'Pick up to two if you want to guide the night a bit.';
    }
    if (selectedCount === 1) {
        return 'You can add one more, or leave it there.';
    }
    return 'You are set. We will use these as soft preferences.';
}
export function DiscoverySurface({ groups, selectedVenueIds, loading, onToggleVenue, onBack, onSkip, onGenerate, }) {
    const selectedCount = selectedVenueIds.length;
    const canToggleMore = selectedCount < 2;
    return (_jsx(PageShell, { topSlot: _jsx(ID8Butler, { message: loading
                ? 'Pulling together a few strong fits for your night.'
                : 'Here are a few strong fits. Pick any you want me to lean toward.' }), title: "A Few Strong Fits", subtitle: loading
            ? 'Grouping a small set of good options by role.'
            : "Optional. Pick up to two, or leave it fully in the planner's hands.", footer: _jsxs("div", { className: "action-row wrap discovery-footer-actions", children: [_jsx("button", { type: "button", className: "ghost-button", onClick: onBack, children: "Back" }), _jsx("button", { type: "button", className: "ghost-button subtle", onClick: onSkip, children: "Skip for now" }), _jsx("button", { type: "button", className: "primary-button", onClick: onGenerate, children: "Generate your outing" })] }), children: loading ? (_jsxs("div", { className: "generating-panel", children: [_jsx("div", { className: "loading-orb" }), _jsx("p", { children: "Finding a few strong candidates for this plan." })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "discovery-status", children: [_jsxs("div", { className: "discovery-meta", children: [_jsx("span", { className: "reveal-story-chip", children: "Optional preview" }), _jsx("span", { className: "reveal-story-chip", children: "Pick up to 2" }), _jsx("span", { className: `reveal-story-chip${selectedCount > 0 ? ' active' : ''}`, children: buildSelectionSummary(selectedCount) })] }), _jsx("p", { className: "discovery-status-copy", children: buildSelectionHelper(selectedCount) })] }), _jsx("div", { className: "discovery-surface", children: groups.map((group) => (_jsxs("section", { className: "discovery-group", children: [_jsxs("div", { className: "discovery-group-header", children: [_jsxs("div", { children: [_jsxs("p", { className: "discovery-group-kicker", children: ["Curated for ", group.title.toLowerCase()] }), _jsx("h2", { children: group.title })] }), _jsx("p", { className: "discovery-group-copy", children: group.subtitle })] }), _jsx("div", { className: "discovery-card-list", children: group.candidates.map((candidate) => {
                                    const selected = isSelected(selectedVenueIds, candidate.venueId);
                                    const disabled = !selected && !canToggleMore;
                                    return (_jsxs("button", { type: "button", className: `discovery-card${selected ? ' selected' : ''}`, "aria-pressed": selected, disabled: disabled, onClick: () => onToggleVenue(candidate.venueId), children: [_jsxs("span", { className: "discovery-card-topline", children: [_jsx("span", { className: "discovery-card-type", children: candidate.categoryLabel }), _jsx("span", { className: `discovery-card-badge${selected ? ' selected' : ''}`, children: selected ? 'Selected' : 'Tap to prefer' })] }), _jsx("strong", { children: candidate.name }), _jsx("span", { className: "discovery-card-reason", children: candidate.reason }), _jsx("span", { className: "discovery-card-meta", children: candidate.areaLabel }), _jsx("span", { className: "discovery-card-state", children: selected
                                                    ? 'We will lean toward this if it fits cleanly.'
                                                    : disabled
                                                        ? 'Two picks already saved.'
                                                        : 'Optional nudge, not a hard lock.' })] }, candidate.venueId));
                                }) })] }, group.role))) })] })) }));
}
