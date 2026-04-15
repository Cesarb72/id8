import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { deriveReadableDistrictName } from '../../domain/districts/deriveReadableDistrictName';
import { deriveDistrictFlowNarrative } from '../../domain/itinerary/deriveDistrictFlowNarrative';
function getRoleLabel(role) {
    if (role === 'start') {
        return 'Start';
    }
    if (role === 'windDown') {
        return 'Wind down';
    }
    return 'Highlight';
}
function getTransitionLabel(transition) {
    if (transition === 'stay_local') {
        return 'Stay in the pocket';
    }
    if (transition === 'district_shift') {
        return 'Move across districts';
    }
    return 'Quick shift';
}
export function DistrictFlowNarrative({ itinerary }) {
    const steps = deriveDistrictFlowNarrative(itinerary);
    if (steps.length === 0) {
        return null;
    }
    return (_jsxs("section", { className: "district-flow", children: [_jsxs("div", { className: "district-flow-header", children: [_jsxs("div", { children: [_jsx("p", { className: "district-flow-kicker", children: "District lens" }), _jsx("h2", { children: "How your night flows" })] }), _jsx("p", { className: "district-flow-copy", children: "Where it opens, where it gathers energy, and where it settles." })] }), _jsx("div", { className: "district-flow-list", children: steps.map((step, index) => (_jsxs("div", { className: "district-flow-item", children: [step.transitionFromPrev && (_jsx("p", { className: "district-flow-transition", children: getTransitionLabel(step.transitionFromPrev) })), (() => {
                            const readableDistrict = deriveReadableDistrictName(step.district, {
                                city: itinerary.city,
                            });
                            return (_jsxs("div", { className: "district-flow-step", children: [_jsx("span", { className: "district-flow-role", children: getRoleLabel(step.role) }), _jsxs("div", { className: "district-flow-step-body", children: [_jsx("strong", { className: "district-name", children: readableDistrict.displayName }), readableDistrict.optionalAnchor && (_jsx("p", { className: "anchor-line", children: readableDistrict.optionalAnchor })), _jsx("p", { children: step.reason })] })] }));
                        })()] }, `${step.role}_${step.district}_${index}`))) })] }));
}
