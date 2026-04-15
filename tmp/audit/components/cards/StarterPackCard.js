import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { getVibeLabel } from '../../domain/types/intent';
function getPersonaLabel(value) {
    if (value === 'romantic') {
        return 'Date';
    }
    if (value === 'friends') {
        return 'Friends';
    }
    if (value === 'family') {
        return 'Family';
    }
    return 'Flexible';
}
export function StarterPackCard({ pack, selected, onSelect }) {
    return (_jsxs("button", { type: "button", className: `starter-pack-card${selected ? ' selected' : ''}`, onClick: () => onSelect(pack.id), children: [_jsx("span", { className: "starter-pack-title", children: pack.title }), _jsxs("span", { className: "starter-pack-meta", children: [getPersonaLabel(pack.personaBias), " | ", getVibeLabel(pack.primaryAnchor)] }), _jsx("span", { className: "starter-pack-description", children: pack.description })] }));
}
