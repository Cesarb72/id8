import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function VibeChip({ vibe, label, sublabel, selected, onClick }) {
    return (_jsxs("button", { type: "button", className: `vibe-chip${selected ? ' selected' : ''}`, onClick: () => onClick(vibe), children: [_jsx("span", { children: label }), _jsx("small", { children: sublabel })] }));
}
