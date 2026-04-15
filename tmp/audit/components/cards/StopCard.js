import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { deriveReadableDistrictName } from '../../domain/districts/deriveReadableDistrictName';
import { deriveReadableStopContent } from '../../domain/interpretation/deriveReadableStopContent';
function buildCardClassName({ active, changed, ownershipKind, locked, anchorStop, inlineDetailExpanded, liveAlerted, }) {
    return [
        'stop-card',
        active ? 'active' : '',
        changed ? 'changed' : '',
        ownershipKind === 'candidate' ? 'user-owned' : '',
        ownershipKind === 'custom' ? 'custom-owned' : '',
        locked ? 'locked' : '',
        anchorStop ? 'anchor-stop' : '',
        inlineDetailExpanded ? 'inline-detail-expanded' : '',
        liveAlerted ? 'live-alerted' : '',
    ]
        .filter(Boolean)
        .join(' ');
}
function buildAroundHereSignals(role) {
    if (role === 'start') {
        return [
            'Calm cafes nearby',
            'Easy seating before peak hours',
        ];
    }
    if (role === 'highlight') {
        return [
            'Live music starting nearby',
            'Bars filling faster after 8',
        ];
    }
    return [
        'Dessert spots open late',
        'Quieter corners available',
    ];
}
function buildFallbackStopInsider(role) {
    if (role === 'start') {
        return {
            roleReason: 'Easy opening move that starts the route cleanly.',
            localSignal: 'This pocket stays active enough to begin without rush.',
            selectionReason: 'Chosen as the cleanest opening fit for this sequence.',
        };
    }
    if (role === 'highlight') {
        return {
            roleReason: 'Placed as the central moment in the sequence.',
            localSignal: 'Surrounding activity keeps this stop from feeling isolated.',
            selectionReason: 'Chosen over nearby options to anchor the route better.',
        };
    }
    if (role === 'windDown') {
        return {
            roleReason: 'Late stop to land the night more softly.',
            localSignal: 'This area supports a calmer finish without going flat.',
            selectionReason: 'Selected for a smoother end-of-route fit.',
        };
    }
    return {
        roleReason: 'Added as a wildcard to keep the route dynamic.',
        localSignal: 'Nearby activity gives this stop context in the sequence.',
        selectionReason: 'Chosen to add contrast without breaking pacing.',
    };
}
function normalizeLineToken(value) {
    return value
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function uniqueLines(values, limit) {
    const seen = new Set();
    const result = [];
    for (const value of values) {
        const next = value?.trim();
        if (!next) {
            continue;
        }
        const token = normalizeLineToken(next);
        if (!token || seen.has(token)) {
            continue;
        }
        seen.add(token);
        result.push(next);
        if (result.length >= limit) {
            break;
        }
    }
    return result;
}
function getRoleChipLabel(role) {
    if (role === 'windDown') {
        return 'WIND DOWN';
    }
    if (role === 'highlight') {
        return 'HIGHLIGHT';
    }
    if (role === 'start') {
        return 'START';
    }
    return 'SURPRISE';
}
function formatOpenUntil(rawTime) {
    const normalized = rawTime.replace(/\s+/g, ' ').trim();
    const upperAmPm = normalized.replace(/\b(am|pm)\b/gi, (value) => value.toUpperCase());
    return `Open until ${upperAmPm}`;
}
function extractOpenStatus(values, tags, unavailable) {
    if (unavailable) {
        return 'Unavailable';
    }
    const text = values
        .filter((value) => Boolean(value?.trim()))
        .join(' ')
        .toLowerCase();
    const openUntilMatch = text.match(/\bopen(?:\s+until|\s+till)\s+([0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm)?)/i);
    if (openUntilMatch?.[1]) {
        return formatOpenUntil(openUntilMatch[1]);
    }
    if (/\bopen now\b/i.test(text)) {
        return 'Open now';
    }
    if (/\btemporarily closed\b/i.test(text)) {
        return 'Temporarily closed';
    }
    if (/\bclosed\b/i.test(text)) {
        return 'Closed';
    }
    const normalizedTags = new Set(tags.map((tag) => tag.toLowerCase()));
    if (normalizedTags.has('late-night') || normalizedTags.has('night-owl')) {
        return 'Open late';
    }
    return undefined;
}
function extractRatingLabel(values) {
    const text = values
        .filter((value) => Boolean(value?.trim()))
        .join(' ');
    const starMatch = text.match(/\b([1-4]\.\d)\s*(?:★|stars?|\/\s*5)\b/i);
    if (starMatch?.[1]) {
        return `${starMatch[1]}★`;
    }
    const ratedMatch = text.match(/\brated\s+([1-4]\.\d)\b/i);
    if (ratedMatch?.[1]) {
        return `${ratedMatch[1]}★`;
    }
    return undefined;
}
export function StopCard({ stop, sequence, active = false, changed = false, ownershipKind, locked = false, anchorStop = false, adjustmentOpen = false, adjustLabel, adjustDisabled = false, adjustNote, unavailable = false, unavailableReason = 'unavailable', highlightDecisionSignal, highlightDecisionSecondarySignal, inlineDetail, appliedSwapNote, postSwapHint, inlineDetailExpanded = false, showInlineDetailToggle = false, liveAlerted = false, debugMode = false, onFocus, onAdjust, onToggleInlineDetail, onPreviewAlternative, onPreviewDecisionAction, }) {
    const readableDistrict = deriveReadableDistrictName(stop.neighborhood, {
        city: stop.city,
    });
    const readableContent = deriveReadableStopContent(stop, {
        category: stop.category,
        subcategory: stop.subcategory,
        priceTier: stop.priceTier,
        tags: stop.tags,
        vibeTags: stop.vibeTags,
    }, stop.role);
    const visibleReasonLabels = active || changed || debugMode
        ? debugMode
            ? stop.reasonLabels
            : stop.reasonLabels?.slice(0, 2)
        : undefined;
    const insider = stop.stopInsider ?? buildFallbackStopInsider(stop.role);
    const statusBadge = unavailable
        ? {
            label: unavailableReason === 'removed' ? 'Removed' : 'Unavailable',
            className: 'locked',
        }
        : locked
            ? { label: 'Locked', className: 'locked' }
            : ownershipKind === 'custom'
                ? { label: 'Custom', className: 'custom-stop' }
                : undefined;
    const hasVenueLink = Boolean(inlineDetail?.venueLinkUrl);
    const aroundHereSignals = inlineDetail?.aroundHereSignals && inlineDetail.aroundHereSignals.length > 0
        ? inlineDetail.aroundHereSignals.slice(0, 1)
        : buildAroundHereSignals(stop.role);
    const tonightSignals = uniqueLines([
        ...(inlineDetail?.tonightSignals?.slice(0, 3) ?? []),
        aroundHereSignals[0],
        inlineDetail?.localSignal,
        insider.localSignal,
        buildAroundHereSignals(stop.role)[1],
    ], 3);
    const replacementTarget = inlineDetail?.alternatives?.[0]?.replacementContext;
    const openStatusLabel = extractOpenStatus([
        stop.subtitle,
        stop.note,
        inlineDetail?.goodToKnow,
        inlineDetail?.localSignal,
        inlineDetail?.whyItFits,
    ], stop.tags, unavailable);
    const ratingLabel = extractRatingLabel([
        stop.subtitle,
        inlineDetail?.knownFor,
        inlineDetail?.goodToKnow,
        ...(stop.reasonLabels ?? []),
    ]);
    const realityAnchors = uniqueLines([
        readableDistrict.displayName,
        `${stop.driveMinutes} min away`,
        openStatusLabel,
        ratingLabel,
    ], 4);
    const secondaryDetails = uniqueLines([
        `${readableDistrict.displayName} - ${stop.estimatedDurationLabel} - ${stop.driveMinutes} min away`,
        readableContent.confidenceLine,
        insider.roleReason,
        readableContent.roleLine,
        inlineDetail?.whyItFits,
        stop.role === 'highlight'
            ? highlightDecisionSignal ?? 'Chosen as your main moment'
            : undefined,
        stop.role === 'highlight' ? highlightDecisionSecondarySignal : undefined,
        insider.selectionReason,
        inlineDetail?.knownFor,
        inlineDetail?.goodToKnow,
        inlineDetail?.localSignal,
        stop.note,
        appliedSwapNote,
        postSwapHint,
        debugMode && typeof stop.selectionConfidence === 'number'
            ? `Confidence ${stop.selectionConfidence}% - ${stop.durationClass} pace${stop.fallbackLabel ? ` - ${stop.fallbackLabel}` : ''}`
            : undefined,
        debugMode && inlineDetail?.stopNarrativeMode
            ? `Narrative mode: ${inlineDetail.stopNarrativeMode}`
            : undefined,
        debugMode && inlineDetail?.stopNarrativeSource
            ? `Narrative source: ${inlineDetail.stopNarrativeSource}`
            : undefined,
        debugMode && inlineDetail?.stopFlavorSummary
            ? `Flavor: ${inlineDetail.stopFlavorSummary}`
            : undefined,
        debugMode && inlineDetail?.stopTransitionSummary
            ? `Transition: ${inlineDetail.stopTransitionSummary}`
            : undefined,
    ], 8);
    const showSwapsSection = Boolean(inlineDetail?.alertSignal ||
        (inlineDetail?.alternatives && inlineDetail.alternatives.length > 0) ||
        (inlineDetail?.decisionActions && inlineDetail.decisionActions.length > 0));
    return (_jsxs("article", { className: buildCardClassName({
            active,
            changed,
            ownershipKind,
            locked,
            anchorStop,
            inlineDetailExpanded,
            liveAlerted,
        }), onClick: () => {
            onFocus?.();
            if (showInlineDetailToggle) {
                onToggleInlineDetail?.();
            }
        }, children: [_jsx("div", { className: "stop-card-image-wrap", children: _jsx("img", { src: stop.imageUrl, alt: stop.venueName, loading: "lazy" }) }), _jsxs("div", { className: "stop-card-content", children: [_jsxs("div", { className: "stop-card-topline", children: [_jsxs("div", { className: "stop-card-kicker-row", children: [typeof sequence === 'number' && _jsxs("span", { className: "stop-card-sequence", children: ["0", sequence + 1] }), _jsx("p", { className: "stop-card-kicker", children: getRoleChipLabel(stop.role) })] }), changed && _jsx("span", { className: "stop-card-change-badge", children: "Updated" })] }), statusBadge && (_jsx("div", { className: "stop-card-badge-row", children: _jsx("span", { className: `stop-card-badge ${statusBadge.className}`, children: statusBadge.label }) })), _jsx("h3", { children: stop.venueName }), _jsx("p", { className: "stop-card-description-line", children: readableContent.identityLine }), realityAnchors.length > 0 && (_jsx("p", { className: "stop-card-reality-anchors", children: realityAnchors.join(' · ') })), tonightSignals.length > 0 && (_jsxs("div", { className: "stop-card-inline-detail-row stop-card-tonight-primary", children: [_jsx("p", { className: "stop-card-inline-detail-label", children: "TONIGHT" }), _jsx("ul", { className: "stop-card-inline-tonight-list", children: tonightSignals.map((signal) => (_jsx("li", { className: "stop-card-inline-detail-copy", children: signal }, `${stop.id}_${signal}`))) })] })), unavailable && (_jsx("p", { className: "stop-card-note", children: "This stop may no longer be available." })), visibleReasonLabels && visibleReasonLabels.length > 0 && (_jsx("div", { className: "stop-reason-row", children: visibleReasonLabels.map((label) => (_jsx("span", { className: "stop-reason-chip", children: label }, `${stop.id}_${label}`))) })), (onAdjust || adjustLabel) && (_jsx("div", { className: "stop-card-actions", children: _jsx("button", { type: "button", className: `chip-action stop-card-adjust${adjustmentOpen ? ' active' : ''}`, disabled: adjustDisabled, onClick: (event) => {
                                event.stopPropagation();
                                onAdjust?.();
                            }, children: adjustLabel ?? (adjustmentOpen ? 'Hide adjustments' : 'Adjust this stop') }) })), showInlineDetailToggle && (_jsx("div", { className: "stop-card-actions", children: _jsx("button", { type: "button", className: `chip-action stop-card-adjust${inlineDetailExpanded ? ' active' : ''}`, onClick: (event) => {
                                event.stopPropagation();
                                onToggleInlineDetail?.();
                            }, children: inlineDetailExpanded ? 'Show less' : 'See more' }) })), inlineDetailExpanded && inlineDetail && (_jsxs("div", { className: "stop-card-inline-detail", children: [secondaryDetails.length > 0 && (_jsxs("details", { className: "stop-card-secondary-details", onClick: (event) => event.stopPropagation(), children: [_jsx("summary", { children: "See details" }), _jsx("div", { className: "stop-card-secondary-details-body", children: secondaryDetails.map((line) => (_jsx("p", { className: "stop-card-inline-detail-copy", children: line }, `${stop.id}_detail_${line}`))) })] })), showSwapsSection && (_jsxs("div", { className: "stop-card-inline-detail-row stop-card-swaps-section", children: [_jsx("p", { className: "stop-card-inline-detail-label", children: "Better options for this moment" }), replacementTarget && (_jsxs("p", { className: "stop-card-inline-detail-copy stop-card-inline-replacement-target", children: ["Replacing: ", replacementTarget] })), inlineDetail.alertSignal && (_jsx("p", { className: "stop-card-inline-alert", children: inlineDetail.alertSignal })), inlineDetail.alternatives && inlineDetail.alternatives.length > 0 && (_jsx("div", { className: "stop-card-inline-alternatives", children: inlineDetail.alternatives.map((alternative) => {
                                            const replacementId = alternative.venueId;
                                            return (_jsxs("button", { type: "button", className: "stop-card-inline-alt-button", disabled: !onPreviewAlternative, onClick: (event) => {
                                                    event.stopPropagation();
                                                    console.log('[SWAP CLICK]', replacementId);
                                                    if (!onPreviewAlternative) {
                                                        console.warn('[SWAP CLICK GUARD] preview handler missing', {
                                                            role: stop.role,
                                                            replacementId,
                                                        });
                                                        return;
                                                    }
                                                    onPreviewAlternative(stop.role, replacementId);
                                                }, children: [_jsxs("div", { className: "stop-card-inline-alt-topline", children: [_jsx("p", { className: "stop-card-inline-detail-copy", children: _jsx("strong", { children: alternative.name }) }), _jsx("span", { className: "stop-card-inline-alt-action", children: "Swap to this" })] }), _jsxs("p", { className: "stop-card-inline-detail-copy", children: [alternative.descriptor, alternative.distanceLabel ? ` - ${alternative.distanceLabel}` : ''] })] }, replacementId));
                                        }) })), inlineDetail.decisionActions && inlineDetail.decisionActions.length > 0 && (_jsxs("div", { className: "stop-card-inline-decision-block", children: [_jsx("p", { className: "stop-card-inline-or", children: "Or" }), _jsx("div", { className: "stop-card-inline-decision-actions", children: inlineDetail.decisionActions.map((action) => (_jsx("button", { type: "button", className: "ghost-button stop-card-inline-decision-button", onClick: (event) => {
                                                        event.stopPropagation();
                                                        onPreviewDecisionAction?.(stop.role, action.id);
                                                    }, children: action.label }, `${stop.id}_${action.id}`))) })] }))] }))] })), hasVenueLink && (_jsx("div", { className: "stop-card-final-action-row", children: _jsxs("a", { className: "stop-card-venue-link", href: inlineDetail?.venueLinkUrl, target: "_blank", rel: "noreferrer", onClick: (event) => event.stopPropagation(), children: ["Open venue page", ' ->'] }) })), adjustNote && _jsx("p", { className: "stop-card-adjust-note", children: adjustNote })] })] }));
}
