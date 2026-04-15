import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function CrewCard({ persona, title, description, selected, onSelect }) {
    return (_jsxs("button", { type: "button", className: `choice-card${selected ? ' selected' : ''}`, onClick: () => onSelect(persona), children: [_jsx("span", { className: "choice-card-title", children: title }), _jsx("span", { className: "choice-card-description", children: description })] }));
}
