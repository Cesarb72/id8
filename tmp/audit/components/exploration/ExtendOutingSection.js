import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ContinuationPanel } from './ContinuationPanel';
function formatCategoryLabel(option) {
    return `${option.neighborhood} | ${option.driveMinutes} min | ${option.category.replace('_', ' ')}`;
}
export function ExtendOutingSection({ options, explorationPlan, explorationLoading, onContinueOuting, }) {
    const continuationReadsSecondary = options.length > 0;
    const continuationFeelsSoft = explorationPlan?.transition.resolutionStrength === 'STRONG' ||
        explorationPlan?.transition.continuationMode === 'CONTINUATION_FRAGMENT';
    return (_jsxs("section", { className: "outing-extend-section", children: [_jsxs("div", { className: "outing-extend-header", children: [_jsxs("div", { children: [_jsx("p", { className: "outing-extend-kicker", children: "Extend" }), _jsx("h2", { children: "Extend your outing" })] }), _jsx("p", { className: "outing-extend-copy", children: "A few easy ways to keep the night going." })] }), options.length > 0 ? (_jsxs("div", { className: "outing-extend-nearby", children: [_jsxs("div", { className: "outing-extend-subhead", children: [_jsxs("div", { children: [_jsx("p", { className: "outing-extend-subkicker", children: "First" }), _jsx("h3", { children: "Keep it light" })] }), _jsx("p", { className: "outing-extend-subcopy", children: "One more easy stop nearby." })] }), _jsx("div", { className: "outing-extend-option-list", children: options.map((option) => (_jsxs("article", { className: "outing-extend-option", children: [_jsx("p", { className: "outing-extend-option-label", children: option.label }), _jsx("strong", { children: option.venueName }), _jsx("p", { className: "outing-extend-option-note", children: option.note }), _jsx("p", { className: "outing-extend-option-meta", children: formatCategoryLabel(option) })] }, option.id))) })] })) : (_jsx("p", { className: "outing-extend-empty", children: "Nothing easy surfaced nearby right now, but you can still keep going if you want to." })), _jsxs("div", { className: `outing-extend-continuation${continuationReadsSecondary ? ' secondary' : ''}${continuationFeelsSoft ? ' soft' : ''}`, children: [_jsxs("div", { className: "outing-extend-subhead", children: [_jsxs("div", { children: [_jsx("p", { className: "outing-extend-subkicker", children: "Then" }), _jsx("h3", { children: "Or keep going" })] }), _jsx("p", { className: "outing-extend-subcopy", children: "See a fuller next chapter." })] }), _jsx("button", { type: "button", className: "ghost-button outing-extend-continue-button emphasis", onClick: onContinueOuting, disabled: explorationLoading, children: explorationLoading
                            ? 'Finding continuation...'
                            : explorationPlan
                                ? 'Refresh continuation'
                                : 'See how it continues' }), explorationPlan ? (_jsx(ContinuationPanel, { plan: explorationPlan, variant: "secondary" })) : null] })] }));
}
