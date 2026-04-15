import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ID8Butler } from '../components/butler/ID8Butler';
import { CrewCard } from '../components/cards/CrewCard';
import { PageShell } from '../components/layout/PageShell';
const crewOptions = [
    {
        persona: 'romantic',
        title: 'Romantic',
        description: 'Intimate, polished, and low-friction pacing.',
    },
    {
        persona: 'friends',
        title: 'Friends',
        description: 'Social, energetic, and variety-forward.',
    },
    {
        persona: 'family',
        title: 'Family',
        description: 'Comfortable for mixed ages with strong flow.',
    },
];
export function CrewSelectionPage({ selectedPersona, onSelect, onBack, onNext, }) {
    return (_jsx(PageShell, { topSlot: _jsx(ID8Butler, { message: "Who is joining this plan?" }), title: "Who's Going?", subtitle: "Choose the persona mode for this run.", footer: _jsxs("div", { className: "action-row", children: [_jsx("button", { type: "button", className: "ghost-button", onClick: onBack, children: "Back" }), _jsx("button", { type: "button", className: "primary-button", disabled: !selectedPersona, onClick: onNext, children: "Continue" })] }), children: _jsx("div", { className: "card-stack", children: crewOptions.map((option) => (_jsx(CrewCard, { persona: option.persona, title: option.title, description: option.description, selected: selectedPersona === option.persona, onSelect: onSelect }, option.persona))) }) }));
}
