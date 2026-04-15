import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ID8Butler } from '../components/butler/ID8Butler';
import { StarterPackCard } from '../components/cards/StarterPackCard';
import { PageShell } from '../components/layout/PageShell';
export function CurateExperiencePage({ packs, selectedPackId, onSelectPack, onBack, onContinue, }) {
    return (_jsx(PageShell, { topSlot: _jsx(ID8Butler, { message: "Pick a starter pack and I will shape a route from it, including the new date-centered packs." }), title: "Curate Experience", subtitle: "Guided packs for dates, culture, and stronger local discovery.", footer: _jsxs("div", { className: "action-row", children: [_jsx("button", { type: "button", className: "ghost-button", onClick: onBack, children: "Back" }), _jsx("button", { type: "button", className: "primary-button", onClick: onContinue, disabled: !selectedPackId, children: "Continue" })] }), children: _jsx("div", { className: "card-stack", children: packs.map((pack) => (_jsx(StarterPackCard, { pack: pack, selected: selectedPackId === pack.id, onSelect: onSelectPack }, pack.id))) }) }));
}
