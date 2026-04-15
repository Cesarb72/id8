import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { refinementOptions } from '../../domain/types/refinement';
export function RefineSheet({ initialModes, onApply, onClose }) {
    const [selectedModes, setSelectedModes] = useState(initialModes);
    const selectedSet = useMemo(() => new Set(selectedModes), [selectedModes]);
    const toggleMode = (mode) => {
        setSelectedModes((current) => current.includes(mode) ? current.filter((item) => item !== mode) : [...current, mode]);
    };
    return (_jsxs("section", { className: "refine-sheet", children: [_jsxs("header", { className: "refine-sheet-header", children: [_jsx("h3", { children: "Refine This Plan" }), _jsx("button", { type: "button", className: "ghost-button", onClick: onClose, children: "Close" })] }), _jsx("div", { className: "refine-options", children: refinementOptions.map((option) => (_jsxs("button", { type: "button", className: `refine-option${selectedSet.has(option.mode) ? ' selected' : ''}`, onClick: () => toggleMode(option.mode), children: [_jsx("span", { children: option.label }), _jsx("small", { children: option.description })] }, option.mode))) }), _jsx("footer", { className: "refine-sheet-footer", children: _jsx("button", { type: "button", className: "primary-button", onClick: () => onApply(selectedModes), children: "Apply Refinement" }) })] }));
}
