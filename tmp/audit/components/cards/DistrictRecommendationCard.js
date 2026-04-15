import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function DistrictRecommendationCard({ recommendation, selected, isTopPick, onSelect, }) {
    const explanation = recommendation.districtExplanation ?? {
        tone: 'Intentional and exploratory',
        summary: recommendation.reason,
        highlights: ['Distinctive local spots', 'Strong start-to-finish flow'],
    };
    const insider = recommendation.districtInsider ?? {
        whyNow: explanation.summary,
        whyYou: explanation.highlights[0] ?? recommendation.reason,
        whatStandsOut: explanation.highlights[1] ??
            explanation.highlights[0] ??
            'Distinctive local character in one pocket.',
    };
    return (_jsxs("button", { type: "button", className: `district-card${selected ? ' selected' : ''}`, "aria-pressed": selected, onClick: () => onSelect(recommendation.districtId), children: [_jsxs("span", { className: "district-card-topline", children: [_jsx("span", { className: "district-card-title", children: recommendation.label }), isTopPick && _jsx("span", { className: "district-card-badge", children: "Top Pick" })] }), _jsx("span", { className: "district-card-tone", children: explanation.tone }), _jsxs("div", { className: "district-card-insider", children: [_jsxs("p", { className: "district-card-insider-line", children: [_jsx("span", { children: "Why this area tonight:" }), " ", insider.whyNow] }), _jsxs("p", { className: "district-card-insider-line", children: [_jsx("span", { children: "Why it fits:" }), " ", insider.whyYou] }), _jsxs("p", { className: "district-card-insider-line", children: [_jsx("span", { children: "What stands out:" }), " ", insider.whatStandsOut] })] })] }));
}
