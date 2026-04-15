import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { DistrictRecommendationCard } from '../components/cards/DistrictRecommendationCard';
import { ID8Butler } from '../components/butler/ID8Butler';
import { PageShell } from '../components/layout/PageShell';
export function DistrictSelectionPage({ recommendations, selectedDistrictId, loading, onSelect, onBack, onSkip, onContinue, }) {
    return (_jsx(PageShell, { topSlot: _jsx(ID8Butler, { message: loading
                ? 'Scanning the strongest areas first.'
                : 'Where should you go tonight?' }), title: "Choose an area", subtitle: loading
            ? 'Finding the strongest districts before route planning.'
            : 'Pick one recommended district or skip and let the planner decide.', footer: _jsxs("div", { className: "action-row", children: [_jsx("button", { type: "button", className: "ghost-button", onClick: onBack, children: "Back" }), !loading && (_jsx("button", { type: "button", className: "ghost-button", onClick: onSkip, children: "Let the planner choose" })), _jsx("button", { type: "button", className: "primary-button", disabled: loading || !selectedDistrictId, onClick: onContinue, children: "Continue" })] }), children: loading ? (_jsxs("div", { className: "generating-panel", children: [_jsx("div", { className: "loading-orb" }), _jsx("p", { children: "Finding the best districts for this plan." })] })) : (_jsx("div", { className: "card-stack", children: recommendations.map((recommendation, index) => (_jsx(DistrictRecommendationCard, { recommendation: recommendation, selected: selectedDistrictId === recommendation.districtId, isTopPick: index === 0, onSelect: onSelect }, recommendation.districtId))) })) }));
}
