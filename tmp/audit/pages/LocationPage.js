import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ID8Butler } from '../components/butler/ID8Butler';
import { PageShell } from '../components/layout/PageShell';
const neighborhoodOptions = [
    'Downtown',
    'SoFA District',
    'Santana Row',
    'Rose Garden',
    'Willow Glen',
    'Kelley Park',
    'North San Jose',
    'Alum Rock',
    'Evergreen',
];
export function LocationPage({ city, neighborhood, startTime, canEditMood, onChange, onEditCrew, onEditMood, onBack, onNext, }) {
    return (_jsxs(PageShell, { topSlot: _jsx(ID8Butler, { message: "Commit the area and time you want this plan to honor." }), title: "Commit", subtitle: "Lock in the place and timing context before shaping the final route.", footer: _jsxs("div", { className: "action-row", children: [_jsx("button", { type: "button", className: "ghost-button", onClick: onBack, children: "Back" }), _jsx("button", { type: "button", className: "primary-button", onClick: onNext, children: "Continue to Shape" })] }), children: [_jsxs("div", { className: "inline-edit-row", children: [_jsx("button", { type: "button", className: "chip-action", onClick: onEditCrew, children: "Edit Who's Going" }), canEditMood && (_jsx("button", { type: "button", className: "chip-action", onClick: onEditMood, children: "Edit What" }))] }), _jsxs("label", { className: "input-group", children: [_jsx("span", { className: "input-label", children: "City" }), _jsx("input", { value: city, onChange: (event) => onChange(event.target.value, neighborhood, startTime), placeholder: "San Jose" })] }), _jsxs("label", { className: "input-group", children: [_jsx("span", { className: "input-label", children: "Area" }), _jsxs("select", { value: neighborhood ?? '', onChange: (event) => onChange(city, event.target.value ? event.target.value : undefined, startTime), children: [_jsx("option", { value: "", children: "Any neighborhood" }), neighborhoodOptions.map((option) => (_jsx("option", { value: option, children: option }, option)))] })] }), _jsxs("label", { className: "input-group", children: [_jsx("span", { className: "input-label", children: "Start time (debug)" }), _jsx("input", { value: startTime ?? '', onChange: (event) => onChange(city, neighborhood, event.target.value || undefined), placeholder: "20:00" })] })] }));
}
