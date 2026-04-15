import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { ID8Butler } from '../components/butler/ID8Butler';
import { CrewCard } from '../components/cards/CrewCard';
import { VibeChip } from '../components/cards/VibeChip';
import { PageShell } from '../components/layout/PageShell';
import { searchAnchorVenues, } from '../domain/search/searchAnchorVenues';
import { vibeOptions } from '../domain/types/intent';
const areaHintOptions = [
    'Downtown',
    'SoFA District',
    'Santana Row',
    'Rose Garden',
    'Willow Glen',
    'North San Jose',
];
const anchorChipOptions = [
    { value: 'restaurant', label: 'Restaurant' },
    { value: 'movie', label: 'Movie' },
    { value: 'drinks', label: 'Drinks' },
    { value: 'park', label: 'Park' },
    { value: 'activity', label: 'Activity' },
];
const personaOptions = [
    {
        persona: 'romantic',
        title: 'Romantic',
        description: 'Intimate, polished, and lower-friction pacing.',
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
const exploreModeContent = {
    directed: {
        pageTitle: 'Build around what you know',
        pageSubtitle: 'Keep the page tight, choose the anchor, and shape the rest of the plan around it.',
        butlerMessage: 'Set the tone, keep the area focused, and lock in the one thing the plan needs to include.',
        introKicker: 'Directed mode',
        introTitle: 'Start with the thing you already know you want.',
        introCopy: 'This mode is build-oriented. The anchor search is the main move, and discovery stays in a supporting role.',
        setupTitle: 'Keep the rest of the plan aligned.',
        setupCopy: 'Choose the vibe and area so the anchor search stays focused and the route builds in a straight line.',
        nextLabel: 'Build draft plan',
    },
    discover: {
        pageTitle: 'Discover a direction',
        pageSubtitle: 'Open the page up, compare a few paths, and let the route take shape from what stands out.',
        butlerMessage: 'Set the tone, keep the area loose if you want, and pick the direction that feels most promising.',
        introKicker: 'Exploratory mode',
        introTitle: 'Start broad, then follow the most interesting path.',
        introCopy: 'This mode is discovery-oriented. Direction cards lead the page, and you can save up to two signals before the draft tightens up.',
        setupTitle: 'Give discovery a point of view.',
        setupCopy: 'Pick the vibe first, then browse directions that fit it. Use the area hint only if you want discovery to stay in one pocket.',
        nextLabel: 'See draft directions',
    },
};
function isSelected(selectedVenueIds, venueId) {
    return selectedVenueIds.includes(venueId);
}
function buildSelectionHelper(selectedCount) {
    if (selectedCount === 0) {
        return 'Pick up to two if you want to guide the route a bit.';
    }
    if (selectedCount === 1) {
        return 'You can add one more, or leave it there.';
    }
    return 'You are set. We will use these as soft preferences.';
}
function inferInitialExploreMode(showAnchorSearch, anchorName, selectedVenueIds = []) {
    if (!showAnchorSearch) {
        return 'discover';
    }
    if (anchorName) {
        return 'directed';
    }
    if (selectedVenueIds.length > 0) {
        return 'discover';
    }
    return 'directed';
}
export function MoodSelectionPage({ primaryVibe, secondaryVibe, persona, city, neighborhood, anchorName, anchorVenueId, showAnchorSearch = false, discoveryGroups, discoveryLoading, selectedVenueIds, debugPanel, onChange, onPersonaChange, onContextChange, onAnchorSelect, onToggleDiscoveryVenue, onBack, onNext, }) {
    const [anchorQuery, setAnchorQuery] = useState('');
    const [anchorChip, setAnchorChip] = useState();
    const [anchorResults, setAnchorResults] = useState([]);
    const [anchorLoading, setAnchorLoading] = useState(false);
    const [anchorError, setAnchorError] = useState();
    const [exploreMode, setExploreMode] = useState(() => inferInitialExploreMode(showAnchorSearch, anchorName, selectedVenueIds));
    const canContinue = Boolean(primaryVibe);
    const canToggleMore = selectedVenueIds.length < 2;
    const supportingDirections = useMemo(() => (discoveryGroups ?? []).slice(0, 2), [discoveryGroups]);
    const showSupportingFits = exploreMode === 'directed' &&
        Boolean(primaryVibe) &&
        Boolean(anchorVenueId) &&
        (discoveryLoading || supportingDirections.length > 0);
    const isDirectedMode = exploreMode === 'directed';
    const modeContent = exploreModeContent[exploreMode];
    const hasDiscoverDirections = (discoveryGroups?.length ?? 0) > 0;
    useEffect(() => {
        if (!showAnchorSearch) {
            setExploreMode('discover');
            return;
        }
        if (anchorName) {
            setExploreMode('directed');
        }
    }, [anchorName, showAnchorSearch]);
    useEffect(() => {
        if (exploreMode !== 'directed') {
            return;
        }
        const trimmedQuery = anchorQuery.trim();
        if (trimmedQuery.length < 2) {
            setAnchorResults([]);
            setAnchorLoading(false);
            setAnchorError(undefined);
            return;
        }
        let cancelled = false;
        setAnchorLoading(true);
        setAnchorError(undefined);
        const timeoutHandle = window.setTimeout(() => {
            void (async () => {
                try {
                    const results = await searchAnchorVenues({
                        query: trimmedQuery,
                        city,
                        neighborhood,
                        chip: anchorChip,
                    });
                    if (cancelled) {
                        return;
                    }
                    setAnchorResults(results);
                    setAnchorError(results.length === 0 ? 'No close matches yet. Try a broader name.' : undefined);
                }
                catch (error) {
                    console.error(error);
                    if (!cancelled) {
                        setAnchorResults([]);
                        setAnchorError('Search is unavailable right now. You can still continue without an anchor.');
                    }
                }
                finally {
                    if (!cancelled) {
                        setAnchorLoading(false);
                    }
                }
            })();
        }, 220);
        return () => {
            cancelled = true;
            window.clearTimeout(timeoutHandle);
        };
    }, [anchorChip, anchorQuery, city, exploreMode, neighborhood]);
    const renderDirection = (direction) => (_jsxs("section", { className: `direction-set${isDirectedMode ? ' compact' : ' spacious'}`, children: [_jsxs("div", { className: "direction-set-header", children: [_jsxs("div", { children: [_jsx("p", { className: "discovery-group-kicker", children: isDirectedMode ? 'Good options for your plan' : 'You could go this direction' }), _jsx("h2", { children: direction.title })] }), _jsx("p", { className: "discovery-group-copy", children: direction.narrative }), _jsx("p", { className: `direction-set-guidance${isDirectedMode ? '' : ' primary'}`, children: isDirectedMode
                            ? 'Optional support once the anchor is set.'
                            : 'Pick from this set if this feels like the right path.' })] }), _jsxs("div", { className: "discovery-meta", children: [direction.pocketLabel && (_jsx("span", { className: "reveal-story-chip", children: direction.pocketLabel })), _jsx("span", { className: `reveal-story-chip${isDirectedMode ? '' : ' active'}`, children: isDirectedMode ? 'Plan support' : 'Primary action' }), _jsx("span", { className: "reveal-story-chip", children: "Not final" })] }), _jsx("div", { className: "direction-set-grid", children: direction.groups.map((group) => group.candidates.map((candidate) => {
                    const selected = isSelected(selectedVenueIds, candidate.venueId);
                    const disabled = !selected && !canToggleMore;
                    return (_jsxs("button", { type: "button", className: `discovery-card${selected ? ' selected' : ''}${isDirectedMode ? ' supporting' : ' priority'}`, "aria-pressed": selected, disabled: disabled, onClick: () => onToggleDiscoveryVenue(candidate.venueId), children: [_jsxs("span", { className: "discovery-card-topline", children: [_jsx("span", { className: "discovery-card-type", children: group.title }), _jsx("span", { className: `discovery-card-badge${selected ? ' selected' : ''}`, children: selected
                                            ? isDirectedMode
                                                ? 'Added'
                                                : 'Saved'
                                            : isDirectedMode
                                                ? 'Support plan'
                                                : 'Choose path' })] }), _jsx("strong", { children: candidate.name }), _jsx("span", { className: "discovery-card-reason", children: candidate.reason }), _jsx("span", { className: "discovery-card-meta", children: candidate.areaLabel }), _jsx("span", { className: "discovery-card-state", children: selected
                                    ? isDirectedMode
                                        ? 'We will keep this as optional support around your anchor.'
                                        : 'We will treat this as a strong signal for the direction you want.'
                                    : disabled
                                        ? 'Two picks already saved.'
                                        : isDirectedMode
                                            ? 'Useful if it strengthens the anchor-led route.'
                                            : 'Use this to tell us which direction feels right.' })] }, candidate.venueId));
                })) })] }, direction.id));
    const setupPanel = (_jsxs("section", { className: `explore-setup-panel explore-setup-panel-${exploreMode}`, children: [_jsxs("div", { className: "explore-section-heading", children: [_jsx("p", { className: "input-label", children: isDirectedMode ? 'Setup' : 'Set the lens' }), _jsx("h2", { children: modeContent.setupTitle }), _jsx("p", { className: "explore-section-copy", children: modeContent.setupCopy })] }), _jsxs("div", { className: "mood-section", children: [_jsx("p", { className: "input-label", children: "Primary vibe" }), _jsx("div", { className: "chip-grid", children: vibeOptions.map((option) => (_jsx(VibeChip, { vibe: option.value, label: option.label, sublabel: option.sublabel, selected: primaryVibe === option.value, onClick: (nextPrimary) => onChange(nextPrimary, secondaryVibe === nextPrimary ? undefined : secondaryVibe) }, `primary_${option.value}`))) })] }), primaryVibe && (_jsxs("div", { className: "mood-section", children: [_jsx("p", { className: "input-label", children: "Secondary vibe (optional)" }), _jsx("div", { className: "chip-grid", children: vibeOptions
                            .filter((option) => option.value !== primaryVibe)
                            .map((option) => (_jsx(VibeChip, { vibe: option.value, label: option.label, sublabel: option.sublabel, selected: secondaryVibe === option.value, onClick: (nextSecondary) => onChange(primaryVibe, secondaryVibe === nextSecondary ? undefined : nextSecondary) }, `secondary_${option.value}`))) })] })), primaryVibe && (_jsxs("div", { className: "mood-section", children: [_jsxs("div", { className: "explore-section-heading", children: [_jsx("p", { className: "input-label", children: "Persona (optional)" }), _jsx("h2", { children: "Refine who this is for" }), _jsx("p", { className: "explore-section-copy", children: "Keep this blank if the vibe should do the heavy lifting. Persona only adds a light modifier." })] }), _jsx("div", { className: "card-stack", children: personaOptions.map((option) => (_jsx(CrewCard, { persona: option.persona, title: option.title, description: option.description, selected: persona === option.persona, onSelect: (nextPersona) => onPersonaChange(persona === nextPersona ? null : nextPersona) }, option.persona))) }), _jsx("div", { className: "action-row", children: _jsx("button", { type: "button", className: "ghost-button", disabled: !persona, onClick: () => onPersonaChange(null), children: "Skip persona" }) })] })), _jsxs("div", { className: `explore-context-grid${isDirectedMode ? ' compact' : ''}`, children: [_jsxs("label", { className: "input-group", children: [_jsx("span", { className: "input-label", children: "City" }), _jsx("input", { value: city, onChange: (event) => onContextChange(event.target.value, neighborhood), placeholder: "San Jose" })] }), _jsxs("label", { className: "input-group", children: [_jsx("span", { className: "input-label", children: "Area hint (optional)" }), _jsxs("select", { value: neighborhood ?? '', onChange: (event) => onContextChange(city, event.target.value ? event.target.value : undefined), children: [_jsx("option", { value: "", children: "Anywhere nearby" }), areaHintOptions.map((option) => (_jsx("option", { value: option, children: option }, option)))] })] })] })] }));
    return (_jsx(PageShell, { topSlot: _jsx(ID8Butler, { message: modeContent.butlerMessage }), title: modeContent.pageTitle, subtitle: modeContent.pageSubtitle, footer: _jsxs("div", { className: "action-row", children: [_jsx("button", { type: "button", className: "ghost-button", onClick: onBack, children: "Back" }), _jsx("button", { type: "button", className: "primary-button", disabled: !canContinue, onClick: onNext, children: modeContent.nextLabel })] }), children: _jsxs("div", { className: `explore-page explore-page-${exploreMode}`, children: [showAnchorSearch && (_jsxs("section", { className: "explore-mode-section", children: [_jsx("p", { className: "input-label", children: "How do you want to start?" }), _jsxs("div", { className: "explore-mode-grid", children: [_jsxs("button", { type: "button", className: `explore-mode-card${exploreMode === 'directed' ? ' selected' : ''}`, onClick: () => setExploreMode('directed'), children: [_jsx("strong", { children: "I know what I want" }), _jsx("span", { children: "Build around one anchor and keep discovery in support." })] }), _jsxs("button", { type: "button", className: `explore-mode-card${exploreMode === 'discover' ? ' selected' : ''}`, onClick: () => setExploreMode('discover'), children: [_jsx("strong", { children: "Help me discover" }), _jsx("span", { children: "Open up the page and let direction cards lead the next step." })] })] })] })), _jsxs("section", { className: `explore-mode-intro explore-mode-intro-${exploreMode}`, children: [_jsx("p", { className: "discovery-group-kicker", children: modeContent.introKicker }), _jsx("h2", { children: modeContent.introTitle }), _jsx("p", { className: "explore-mode-intro-copy", children: modeContent.introCopy })] }), debugPanel, isDirectedMode && showAnchorSearch && (_jsxs("section", { className: "anchor-search-panel anchor-search-panel-primary", children: [_jsxs("div", { className: "explore-section-heading", children: [_jsx("p", { className: "input-label", children: "Primary action" }), _jsx("h2", { children: "Choose the anchor" }), _jsx("p", { className: "explore-section-copy", children: "Search for the one place or activity the plan needs to include, then build the rest around it." })] }), _jsxs("label", { className: "input-group", children: [_jsx("span", { className: "input-label", children: "Build around one thing" }), _jsx("input", { value: anchorQuery, onChange: (event) => setAnchorQuery(event.target.value), placeholder: "What's the one thing you definitely want to do?" })] }), _jsx("div", { className: "chip-grid", children: anchorChipOptions.map((option) => {
                                const selected = anchorChip === option.value;
                                return (_jsx("button", { type: "button", className: `chip-action${selected ? ' selected' : ''}`, onClick: () => setAnchorChip((current) => current === option.value ? undefined : option.value), children: option.label }, option.value));
                            }) }), anchorName ? (_jsxs("p", { className: "anchor-search-note", children: ["Locked anchor: ", _jsx("strong", { children: anchorName })] })) : (_jsx("p", { className: "anchor-search-status", children: "Search for the thing you already know you want, then let the rest of the route follow it." })), (anchorLoading || anchorResults.length > 0 || anchorError) && (_jsxs("div", { className: "anchor-search-results", children: [anchorLoading && _jsx("p", { className: "anchor-search-status", children: "Searching nearby places..." }), !anchorLoading &&
                                    anchorResults.map((result) => (_jsxs("button", { type: "button", className: "anchor-search-result", onClick: () => onAnchorSelect(result.venue), children: [_jsx("strong", { children: result.venue.name }), _jsx("span", { children: result.subtitle })] }, result.venue.id))), !anchorLoading && anchorError && (_jsx("p", { className: "anchor-search-status", children: anchorError }))] }))] })), setupPanel, isDirectedMode && (showSupportingFits ? (_jsxs("section", { className: "discovery-surface supporting-fits", children: [_jsxs("div", { className: "discovery-status compact", children: [_jsxs("div", { className: "discovery-meta", children: [_jsx("span", { className: "reveal-story-chip", children: "Direction sets" }), _jsx("span", { className: "reveal-story-chip", children: "Optional" })] }), _jsx("h2", { className: "explore-surface-title", children: "Good options for your plan" }), _jsx("p", { className: "discovery-status-copy", children: "Once the anchor is locked, these are optional directions that can strengthen the rest of the flow." })] }), discoveryLoading ? (_jsxs("div", { className: "generating-panel", children: [_jsx("div", { className: "loading-orb" }), _jsx("p", { children: "Shaping a few different routes around that anchor." })] })) : (supportingDirections.map((direction) => renderDirection(direction)))] })) : (_jsxs("section", { className: "explore-secondary-note", children: [_jsx("p", { className: "input-label", children: "Supporting discovery" }), _jsx("p", { children: "Pick an anchor first. Once it is set, optional supporting directions will appear here." })] }))), !isDirectedMode && (_jsxs("section", { className: "discovery-surface discovery-surface-exploratory", children: [_jsxs("div", { className: "discovery-status primary", children: [_jsxs("div", { className: "discovery-meta", children: [_jsx("span", { className: "reveal-story-chip active", children: "Direction finding" }), _jsx("span", { className: "reveal-story-chip", children: "Pick up to 2" }), _jsx("span", { className: `reveal-story-chip${selectedVenueIds.length > 0 ? ' active' : ''}`, children: selectedVenueIds.length === 0
                                                ? 'No picks yet'
                                                : selectedVenueIds.length === 1
                                                    ? '1 pick saved'
                                                    : '2 picks saved' })] }), _jsx("h2", { className: "explore-surface-title", children: "Choose a direction to follow" }), _jsx("p", { className: "discovery-status-copy", children: buildSelectionHelper(selectedVenueIds.length) })] }), discoveryLoading ? (_jsxs("div", { className: "generating-panel", children: [_jsx("div", { className: "loading-orb" }), _jsx("p", { children: "Sketching a few different ways this night could go." })] })) : hasDiscoverDirections ? ((discoveryGroups ?? []).map((direction) => renderDirection(direction))) : (_jsxs("div", { className: "explore-secondary-note explore-secondary-note-spacious", children: [_jsx("p", { className: "input-label", children: "Direction cards" }), _jsx("p", { children: "Choose a primary vibe to unlock a few routes you could take from here." })] }))] }))] }) }));
}
