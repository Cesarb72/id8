import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
function buildSummaryCopy(mode, visibleKind, nearbyCount, swapCount) {
    if (mode === 'swap-only') {
        if (visibleKind === 'swap' && swapCount > 0) {
            return 'Pick a same-role alternative to reshape this beat without rebuilding the whole route.';
        }
        return 'Same-role alternatives keep the route structure intact while you swap in a different stop.';
    }
    if (visibleKind === 'nearby') {
        return 'A few nearby options if you want an easier pivot around this stop.';
    }
    if (visibleKind === 'swap') {
        return 'A few alternate takes on this same beat of the route.';
    }
    if (nearbyCount > 0 && swapCount > 0) {
        return `${nearbyCount} nearby ideas and ${swapCount} swaps are ready if you want to adjust this stop.`;
    }
    if (nearbyCount > 0) {
        return `${nearbyCount} nearby ideas are ready if you want to adjust this stop.`;
    }
    if (swapCount > 0) {
        return `${swapCount} swaps are ready if you want to adjust this stop.`;
    }
    return 'Look nearby or swap this stop if you want a different fit.';
}
function buildEmptyCopy(kind, mode) {
    if (mode === 'swap-only') {
        if (kind === 'swap') {
            return 'No stronger same-role swap surfaced for this stop right now.';
        }
        return 'Open this stop again to try a few same-role alternatives.';
    }
    if (kind === 'nearby') {
        return 'No nearby options surfaced for this stop right now.';
    }
    if (kind === 'swap') {
        return 'No stronger swap surfaced for this stop right now.';
    }
    return 'Choose nearby or swap to open options for this stop.';
}
function buildRationaleLabel(stop, option) {
    const venue = option.scoredVenue.venue;
    const normalizedReason = option.reason.toLowerCase();
    if (normalizedReason.includes('similar area')) {
        return 'Same area';
    }
    if (normalizedReason.includes('closer fit')) {
        return 'Closer';
    }
    if (stop.role === 'highlight' && venue.energyLevel >= 4) {
        return 'More lively';
    }
    if (stop.vibeTags.includes('cozy') && venue.vibeTags.includes('cozy')) {
        return 'Better cozy fit';
    }
    if (venue.priceTier === stop.priceTier) {
        return 'Same spend';
    }
    if (venue.vibeTags.some((tag) => stop.vibeTags.includes(tag))) {
        return 'Stronger vibe match';
    }
    return 'Fits this stop';
}
function buildComposePrompt(actionId) {
    if (actionId === 'add-before') {
        return 'Choose what to add before this stop.';
    }
    if (actionId === 'add-after') {
        return 'Choose what to add after this stop.';
    }
    return 'Choose what should replace this stop.';
}
function buildSearchHelperCopy(actionId) {
    if (actionId === 'replace-stop') {
        return 'Search for a real place, known venue, or nearby match.';
    }
    return 'Search for a real place to add into this route.';
}
function buildCustomHelperCopy(actionId) {
    if (actionId === 'replace-stop') {
        return "Add a private or manual stop instead, like Jane's house, the office, or a meetup point.";
    }
    return "Add a private or manual stop, like Jane's house, a pickup, or your office.";
}
function buildOwnershipContextCopy(ownershipKind) {
    if (ownershipKind === 'custom') {
        return 'This is your own manual stop, so the route is built around keeping it.';
    }
    if (ownershipKind === 'candidate') {
        return 'You already picked this stop, so edits here keep your choice in place.';
    }
    return undefined;
}
export function NearbyNodeGroup({ stop, mode = 'full', isExpanded = false, ownershipKind, visibleKind, alternatives, nearbyCount = 0, swapCount = 0, roleShapeActions = [], composeActions = [], onShowSwap, onShowNearby, onApplySwap, onApplyRoleShape, onApplyComposeAction, onSearchCompose, onCreateCustomComposeStop, onApplyComposeSearchResult, }) {
    const [showAll, setShowAll] = useState(false);
    const [composeActionId, setComposeActionId] = useState();
    const [composePath, setComposePath] = useState('search');
    const [composeQuery, setComposeQuery] = useState('');
    const [composeLoading, setComposeLoading] = useState(false);
    const [composeResults, setComposeResults] = useState([]);
    const hasVisibleAlternatives = alternatives.length > 0;
    const previewLimit = mode === 'swap-only' ? 3 : 2;
    const previewAlternatives = showAll ? alternatives : alternatives.slice(0, previewLimit);
    const hiddenCount = Math.max(alternatives.length - previewAlternatives.length, 0);
    const canReplace = composeActions.some((action) => action.id === 'replace-stop');
    const routeEditActions = composeActions.filter((action) => action.id !== 'replace-stop');
    const canSwap = swapCount > 0 || (visibleKind === 'swap' && alternatives.length > 0);
    const ownershipContextCopy = buildOwnershipContextCopy(ownershipKind);
    const showDraftActionGroups = mode === 'swap-only' &&
        (canSwap ||
            canReplace ||
            roleShapeActions.length > 0 ||
            routeEditActions.length > 0);
    const resetComposePanel = () => {
        setComposeActionId(undefined);
        setComposePath('search');
        setComposeQuery('');
        setComposeResults([]);
        setComposeLoading(false);
    };
    useEffect(() => {
        setShowAll(false);
    }, [visibleKind, stop.id]);
    useEffect(() => {
        if (!isExpanded) {
            resetComposePanel();
        }
    }, [isExpanded]);
    useEffect(() => {
        resetComposePanel();
    }, [stop.id]);
    useEffect(() => {
        if (composePath !== 'search' ||
            !composeActionId ||
            composeQuery.trim().length < 2 ||
            !onSearchCompose) {
            setComposeResults([]);
            setComposeLoading(false);
            return;
        }
        let cancelled = false;
        const timeoutId = window.setTimeout(() => {
            setComposeLoading(true);
            void onSearchCompose(composeActionId, composeQuery.trim())
                .then((results) => {
                if (!cancelled) {
                    setComposeResults(results);
                }
            })
                .catch(() => {
                if (!cancelled) {
                    setComposeResults([]);
                }
            })
                .finally(() => {
                if (!cancelled) {
                    setComposeLoading(false);
                }
            });
        }, 180);
        return () => {
            cancelled = true;
            window.clearTimeout(timeoutId);
        };
    }, [composeActionId, composePath, composeQuery, onSearchCompose]);
    if (!isExpanded) {
        return null;
    }
    const handleSelectComposeAction = (action) => {
        if (action.id === 'remove-stop') {
            const applied = onApplyComposeAction?.(action.id);
            if (applied) {
                resetComposePanel();
            }
            return;
        }
        setComposeActionId(action.id);
        setComposePath('search');
        setComposeQuery('');
        setComposeResults([]);
    };
    const openComposePanel = (actionId, path = 'search') => {
        setComposeActionId(actionId);
        setComposePath(path);
        setComposeQuery('');
        setComposeResults([]);
        setComposeLoading(false);
    };
    return (_jsxs("section", { className: `nearby-node-group${mode === 'swap-only' ? ' swap-only' : ''}${hasVisibleAlternatives ? ' expanded' : ''}${visibleKind ? ' open' : ''} active`, children: [_jsxs("div", { className: "nearby-node-header", children: [_jsxs("div", { children: [_jsx("p", { className: "nearby-node-kicker", children: "Edit this stop" }), _jsx("p", { className: "nearby-node-copy", children: buildSummaryCopy(mode, visibleKind, nearbyCount, swapCount) }), ownershipContextCopy && (_jsx("p", { className: "nearby-node-context-note", children: ownershipContextCopy }))] }), _jsxs("div", { className: "nearby-node-actions", children: [_jsxs("span", { className: "nearby-node-preview-chip", children: [swapCount, " swaps"] }), mode === 'full' && (_jsxs(_Fragment, { children: [_jsxs("span", { className: "nearby-node-preview-chip", children: [nearbyCount, " nearby"] }), _jsx("button", { type: "button", className: "chip-action subtle", onClick: onShowNearby, children: "See nearby" }), _jsx("button", { type: "button", className: "chip-action subtle", onClick: onShowSwap, children: "Swap stop" })] }))] })] }), !visibleKind && !hasVisibleAlternatives && (_jsxs("div", { className: "nearby-node-preview", children: [_jsx("span", { className: "nearby-node-preview-label", children: mode === 'swap-only' ? 'Looking for same-role swaps' : 'Nothing selected yet' }), mode === 'full' && _jsxs("span", { className: "nearby-node-preview-chip", children: [nearbyCount, " nearby"] }), _jsxs("span", { className: "nearby-node-preview-chip", children: [swapCount, " swaps"] }), _jsx("span", { className: "nearby-node-preview-note", children: buildEmptyCopy(undefined, mode) })] })), visibleKind && !hasVisibleAlternatives && (_jsx("p", { className: "nearby-node-empty", children: buildEmptyCopy(visibleKind, mode) })), hasVisibleAlternatives && (_jsxs("div", { className: "nearby-node-list", children: [previewAlternatives.map((option) => (_jsxs("button", { type: "button", className: "nearby-node-item", onClick: () => onApplySwap(option.scoredVenue.venue.id), children: [_jsxs("div", { className: "nearby-node-item-topline", children: [_jsx("span", { className: "nearby-node-item-label", children: mode === 'swap-only'
                                            ? `${stop.title} option`
                                            : visibleKind === 'nearby'
                                                ? 'Nearby option'
                                                : 'Route swap' }), _jsx("span", { className: "nearby-node-item-rationale", children: buildRationaleLabel(stop, option) })] }), _jsx("strong", { children: option.scoredVenue.venue.name }), _jsxs("small", { children: [option.scoredVenue.venue.neighborhood, " | ", option.scoredVenue.venue.driveMinutes, " min |", ' ', option.scoredVenue.venue.category.replace('_', ' ')] }), _jsx("small", { children: option.reason })] }, `${stop.role}_${visibleKind}_${option.scoredVenue.venue.id}`))), hiddenCount > 0 && (_jsxs("button", { type: "button", className: "nearby-node-more", onClick: () => setShowAll(true), children: ["Show ", hiddenCount, " more options"] }))] })), showDraftActionGroups && (_jsxs("div", { className: "nearby-node-compose", children: [(canSwap || canReplace) && (_jsxs("div", { className: "nearby-node-action-section", children: [_jsx("p", { className: "nearby-node-section-label", children: "Replace this stop" }), _jsxs("div", { className: "nearby-node-shape-actions", children: [canSwap && (_jsx("button", { type: "button", className: `chip-action subtle nearby-node-shape-action${visibleKind === 'swap' ? ' selected' : ''}`, onClick: onShowSwap, children: "Swap options" })), canReplace && (_jsx("button", { type: "button", className: `chip-action subtle nearby-node-shape-action${composeActionId === 'replace-stop' && composePath === 'search'
                                            ? ' selected'
                                            : ''}`, onClick: () => openComposePanel('replace-stop', 'search'), children: "Find a place" })), canReplace && (_jsx("button", { type: "button", className: `chip-action subtle nearby-node-shape-action${composeActionId === 'replace-stop' && composePath === 'custom'
                                            ? ' selected'
                                            : ''}`, onClick: () => openComposePanel('replace-stop', 'custom'), children: "Add your own stop" }))] })] })), roleShapeActions.length > 0 && (_jsxs("div", { className: "nearby-node-action-section", children: [_jsx("p", { className: "nearby-node-section-label", children: "Move it in the night" }), _jsx("div", { className: "nearby-node-shape-actions", children: roleShapeActions.map((action) => (_jsx("button", { type: "button", className: "chip-action subtle nearby-node-shape-action", onClick: () => onApplyRoleShape?.(action.id), children: action.label }, `${stop.role}_${action.id}`))) })] })), routeEditActions.length > 0 && (_jsxs("div", { className: "nearby-node-action-section", children: [_jsx("p", { className: "nearby-node-section-label", children: "Change the route" }), _jsx("div", { className: "nearby-node-shape-actions", children: routeEditActions.map((action) => (_jsx("button", { type: "button", className: `chip-action subtle nearby-node-shape-action${composeActionId === action.id ? ' selected' : ''}`, onClick: () => handleSelectComposeAction(action), children: action.id === 'remove-stop' ? 'Remove stop' : action.label }, `${stop.role}_${action.id}`))) })] })), composeActionId && (_jsxs("div", { className: "nearby-node-compose-panel", children: [_jsxs("div", { className: "nearby-node-compose-panel-header", children: [_jsx("p", { className: "nearby-node-preview-note", children: buildComposePrompt(composeActionId) }), _jsx("button", { type: "button", className: "chip-action subtle", onClick: resetComposePanel, children: "Cancel" })] }), composeActionId !== 'replace-stop' && (_jsxs("div", { className: "nearby-node-compose-paths", children: [_jsx("button", { type: "button", className: `chip-action subtle nearby-node-shape-action${composePath === 'search' ? ' selected' : ''}`, onClick: () => {
                                            setComposePath('search');
                                            setComposeQuery('');
                                            setComposeResults([]);
                                        }, children: "Find a place" }), _jsx("button", { type: "button", className: `chip-action subtle nearby-node-shape-action${composePath === 'custom' ? ' selected' : ''}`, onClick: () => {
                                            setComposePath('custom');
                                            setComposeQuery('');
                                            setComposeResults([]);
                                        }, children: "Add your own stop" })] })), composePath === 'search' && (_jsxs(_Fragment, { children: [_jsx("p", { className: "nearby-node-preview-note", children: buildSearchHelperCopy(composeActionId) }), _jsx("input", { value: composeQuery, onChange: (event) => setComposeQuery(event.target.value), placeholder: composeActionId === 'replace-stop'
                                            ? 'Search for a real place'
                                            : 'Search for a place to add' }), composeQuery.trim().length < 2 && (_jsx("p", { className: "nearby-node-preview-note", children: "Good for nearby matches, keywords, or a specific known venue." })), composeLoading && (_jsx("p", { className: "nearby-node-preview-note", children: "Looking for a good fit..." })), !composeLoading &&
                                        composeQuery.trim().length >= 2 &&
                                        composeResults.length === 0 && (_jsx("p", { className: "nearby-node-empty", children: "No strong place matches surfaced for this route yet." })), composeResults.length > 0 && (_jsx("div", { className: "nearby-node-list nearby-node-compose-results", children: composeResults.map((result) => (_jsxs("button", { type: "button", className: "nearby-node-item", onClick: () => {
                                                const applied = onApplyComposeSearchResult?.(composeActionId, result);
                                                if (applied) {
                                                    resetComposePanel();
                                                }
                                            }, children: [_jsxs("div", { className: "nearby-node-item-topline", children: [_jsx("span", { className: "nearby-node-item-label", children: "Place match" }), _jsx("span", { className: "nearby-node-item-rationale", children: result.rationale })] }), _jsx("strong", { children: result.title }), _jsx("small", { children: result.subtitle })] }, `${stop.role}_${composeActionId}_${result.id}`))) }))] })), composePath === 'custom' && (_jsxs(_Fragment, { children: [_jsx("p", { className: "nearby-node-preview-note", children: buildCustomHelperCopy(composeActionId) }), _jsx("input", { value: composeQuery, onChange: (event) => setComposeQuery(event.target.value), placeholder: "Enter a private or manual stop" }), _jsx("p", { className: "nearby-node-preview-note", children: "Examples: Jane's house, meetup point, office, pickup." }), _jsx("button", { type: "button", className: "ghost-button subtle nearby-node-custom-submit", disabled: composeQuery.trim().length < 2, onClick: () => {
                                            if (!composeActionId) {
                                                return;
                                            }
                                            const applied = onCreateCustomComposeStop?.(composeActionId, composeQuery.trim());
                                            if (applied) {
                                                resetComposePanel();
                                            }
                                        }, children: "Add this private stop" })] }))] }))] }))] }));
}
