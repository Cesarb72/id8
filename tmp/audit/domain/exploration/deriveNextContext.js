import { getTimeWindowSignal } from '../retrieval/getTimeWindowSignal';
const timePhaseOrder = ['morning', 'afternoon', 'evening', 'late-night'];
function advanceTimePhase(phase, elapsedMinutes) {
    const startIndex = timePhaseOrder.indexOf(phase);
    if (startIndex === -1) {
        return phase;
    }
    const steps = elapsedMinutes >= 240 ? 2 : elapsedMinutes >= 110 ? 1 : 0;
    return timePhaseOrder[Math.min(startIndex + steps, timePhaseOrder.length - 1)] ?? phase;
}
function getAlternateDistrict(result) {
    return result.trace.recommendedDistricts.find((district) => district.districtId !== result.trace.selectedDistrictId);
}
function deriveDistrictStrategy(result) {
    const selectedDistrict = result.trace.recommendedDistricts.find((district) => district.districtId === result.trace.selectedDistrictId);
    const alternateDistrict = getAlternateDistrict(result);
    const continuationNeighborhood = result.itinerary.stops[result.itinerary.stops.length - 1]?.neighborhood ??
        result.intentProfile.neighborhood;
    const selectedDiversity = selectedDistrict?.signals.diversity ?? 0.5;
    const selectedScore = selectedDistrict?.score ?? 0.55;
    const uniqueCategories = new Set(result.itinerary.stops.map((stop) => stop.category)).size;
    const spatial = result.trace.spatialCoherence;
    const districtFeelsSpent = selectedDiversity < 0.58 ||
        result.trace.categoryDiversity.repeatedCategoryCount > 0 ||
        spatial.repeatedClusterEscapeCount > 0 ||
        (uniqueCategories >= 3 && spatial.clustersVisited.length >= 2);
    const walkable = result.intentProfile.distanceMode === 'nearby';
    const strongAlternate = Boolean(alternateDistrict) &&
        ((alternateDistrict?.score ?? 0) >= selectedScore - 0.04 ||
            ((alternateDistrict?.signals.diversity ?? 0) - selectedDiversity >= 0.1));
    const strongWalkableShift = strongAlternate &&
        (spatial.repeatedClusterEscapeCount > 0 ||
            spatial.longTransitionCount > 0 ||
            (alternateDistrict?.score ?? 0) >= selectedScore + 0.08);
    if (!walkable && districtFeelsSpent && alternateDistrict && strongAlternate) {
        return {
            districtStrategy: 'shift-district',
            nextDistrictId: alternateDistrict.districtId,
            nextDistrictLabel: alternateDistrict.label,
            districtReason: `Arc 1 already used much of ${result.trace.selectedDistrictLabel}'s structural variety, so Arc 2 shifts toward ${alternateDistrict.label}.`,
        };
    }
    if (walkable && districtFeelsSpent && alternateDistrict && strongWalkableShift) {
        return {
            districtStrategy: 'shift-district',
            nextDistrictId: alternateDistrict.districtId,
            nextDistrictLabel: alternateDistrict.label,
            districtReason: `Walkable continuity stayed the default, but repeated local spread made ${alternateDistrict.label} the stronger next district.`,
        };
    }
    if (result.trace.selectedDistrictSource === 'city_fallback') {
        return {
            districtStrategy: 'stay-put',
            continuationNeighborhood,
            districtReason: `Arc 1 never anchored to a single district, so Arc 2 keeps continuity around ${continuationNeighborhood ?? result.intentProfile.city}.`,
        };
    }
    return {
        districtStrategy: 'stay-put',
        nextDistrictId: result.trace.selectedDistrictId,
        nextDistrictLabel: result.trace.selectedDistrictLabel,
        continuationNeighborhood,
        districtReason: result.intentProfile.distanceMode === 'nearby'
            ? `Walkable continuation stays in ${result.trace.selectedDistrictLabel} and picks up from ${continuationNeighborhood ?? 'the last stop area'}.`
            : `Arc 1 still leaves room inside ${result.trace.selectedDistrictLabel}, so Arc 2 continues locally instead of resetting elsewhere.`,
    };
}
function mapShiftedVibe(currentVibe, vibeShift, endCategory) {
    if (vibeShift === 'MAINTAIN') {
        return currentVibe;
    }
    if (vibeShift === 'LIFT') {
        if (currentVibe === 'cozy' || currentVibe === 'chill') {
            return 'cultured';
        }
        if (currentVibe === 'cultured') {
            return 'lively';
        }
        if (currentVibe === 'playful') {
            return 'adventurous-urban';
        }
        if (currentVibe === 'adventurous-outdoor') {
            return 'playful';
        }
        if (currentVibe === 'adventurous-urban') {
            return 'lively';
        }
        return 'lively';
    }
    if (vibeShift === 'SOFTEN') {
        if (currentVibe === 'lively' || currentVibe === 'playful') {
            return 'chill';
        }
        if (currentVibe === 'adventurous-urban') {
            return 'cultured';
        }
        if (currentVibe === 'adventurous-outdoor') {
            return 'chill';
        }
        if (currentVibe === 'cultured') {
            return 'cozy';
        }
        return 'cozy';
    }
    if (endCategory === 'dessert' || endCategory === 'cafe') {
        return 'cozy';
    }
    if (currentVibe === 'lively' || currentVibe === 'playful') {
        return 'chill';
    }
    if (currentVibe === 'adventurous-urban') {
        return 'cultured';
    }
    return 'cozy';
}
function deriveVibeShift(result, nextPhase) {
    const currentPrimary = result.intentProfile.primaryAnchor;
    const currentSecondary = result.intentProfile.secondaryAnchors?.[0];
    const endStop = result.selectedArc.stops[result.selectedArc.stops.length - 1]?.scoredVenue.venue;
    const endCategory = endStop?.category;
    const endEnergy = endStop?.energyLevel ?? 3;
    const elapsedMinutes = result.itinerary.estimatedTotalMinutes;
    let vibeShift = 'MAINTAIN';
    let repetitionReason = 'Arc 1 ends on an open enough category mix, so Arc 2 can continue without forcing a reset.';
    if (nextPhase === 'late-night' ||
        elapsedMinutes >= 250 ||
        ((endCategory === 'dessert' || endCategory === 'cafe') && endEnergy <= 2)) {
        vibeShift = 'LAND';
        repetitionReason =
            'Arc 1 already settles into a softer finish, so Arc 2 lands gently instead of restarting at the same intensity.';
    }
    else if (endCategory === 'restaurant' || endCategory === 'cafe') {
        vibeShift = 'LIFT';
        repetitionReason =
            'Arc 1 finishes on a food-led beat, so Arc 2 lifts away from another immediate food-to-food pairing.';
    }
    else if (endCategory === 'bar' ||
        endCategory === 'live_music' ||
        endCategory === 'activity' ||
        endCategory === 'event' ||
        endEnergy >= 4) {
        vibeShift = 'SOFTEN';
        repetitionReason =
            'Arc 1 closes on a higher-energy category, so Arc 2 opens softer to avoid a like-for-like restart.';
    }
    const nextPrimaryVibe = mapShiftedVibe(currentPrimary, vibeShift, endCategory);
    const nextSecondaryVibe = nextPrimaryVibe === currentPrimary ? currentSecondary : currentPrimary;
    const vibeReason = vibeShift === 'MAINTAIN'
        ? `Arc 2 keeps the ${currentPrimary} lane because Arc 1 still has room to extend that tone cleanly.`
        : vibeShift === 'LIFT'
            ? `Arc 2 lifts from ${currentPrimary} into ${nextPrimaryVibe} so the continuation feels like a next chapter, not the same opening again.`
            : vibeShift === 'SOFTEN'
                ? `Arc 2 softens the pace after Arc 1's stronger finish so the continuation keeps momentum without oversaturating energy.`
                : `Arc 2 lands into ${nextPrimaryVibe} because the outing has already moved far enough to favor a calmer late sequence.`;
    return {
        vibeShift,
        nextPrimaryVibe,
        nextSecondaryVibe,
        vibeReason,
        repetitionReason,
    };
}
function isMajorAnchorCategory(category) {
    return (category === 'restaurant' ||
        category === 'live_music' ||
        category === 'event' ||
        category === 'activity' ||
        category === 'museum');
}
function evaluateResolution(result, vibeShift) {
    const roles = new Set(result.itinerary.stops.map((stop) => stop.role));
    const finalStop = result.itinerary.stops[result.itinerary.stops.length - 1];
    const highlightStop = result.itinerary.stops.find((stop) => stop.role === 'highlight');
    const hasMeaningfulSequence = roles.has('start') && roles.has('highlight') && roles.has('windDown');
    const endsOnWindDown = finalStop?.role === 'windDown';
    const landsSoftly = vibeShift === 'LAND';
    const strongDuration = result.itinerary.estimatedTotalMinutes >= 240;
    const moderateDuration = result.itinerary.estimatedTotalMinutes >= 165;
    const majorAnchorUsed = isMajorAnchorCategory(highlightStop?.category) ||
        result.itinerary.stops.some((stop) => isMajorAnchorCategory(stop.category));
    const matchedSignals = [
        hasMeaningfulSequence && 'completed a start-highlight-wind-down shape',
        endsOnWindDown && 'already finishes on wind-down',
        landsSoftly && 'continuation tone already reads as LAND',
        strongDuration && `already spans ${result.itinerary.estimatedTotalLabel}`,
        !strongDuration && moderateDuration && `already feels fairly complete at ${result.itinerary.estimatedTotalLabel}`,
        majorAnchorUsed && 'already consumed a main anchor category',
    ].filter(Boolean);
    let resolutionStrength = 'NONE';
    if (hasMeaningfulSequence &&
        endsOnWindDown &&
        landsSoftly &&
        strongDuration &&
        majorAnchorUsed) {
        resolutionStrength = 'STRONG';
    }
    else if ((hasMeaningfulSequence && endsOnWindDown && (landsSoftly || moderateDuration)) ||
        (endsOnWindDown && landsSoftly && moderateDuration) ||
        (hasMeaningfulSequence && moderateDuration && majorAnchorUsed)) {
        resolutionStrength = 'MODERATE';
    }
    const continuationMode = resolutionStrength === 'STRONG'
        ? 'CONTINUATION_FRAGMENT'
        : resolutionStrength === 'MODERATE'
            ? 'COMPACT_CONTINUATION'
            : 'FULL_CONTINUATION';
    const resolvedReason = resolutionStrength === 'STRONG'
        ? `Resolution strength STRONG because Arc 1 ${matchedSignals.join('; ')}.`
        : resolutionStrength === 'MODERATE'
            ? `Resolution strength MODERATE because Arc 1 ${matchedSignals.join('; ')}, but it does not look fully closed enough for a single-stop-only continuation.`
            : matchedSignals.length > 0
                ? `Resolution strength NONE because Arc 1 only ${matchedSignals.join('; ')}.`
                : 'Resolution strength NONE because Arc 1 has not clearly reached a mostly complete ending shape yet.';
    const continuationReason = continuationMode === 'CONTINUATION_FRAGMENT'
        ? 'Fragment mode selected because the first outing already looks fully resolved and continuation should read as one last soft stop.'
        : continuationMode === 'COMPACT_CONTINUATION'
            ? 'Compact continuation selected because the first outing feels mostly complete, so continuation should stay to one or two soft late-compatible beats.'
            : 'Full continuation selected because the first outing does not yet appear resolved enough to collapse the next chapter.';
    return {
        outingResolved: resolutionStrength !== 'NONE',
        resolutionStrength,
        resolvedReason,
        continuationMode,
        continuationReason,
    };
}
function softenContinuationPrimaryVibe(continuationMode, vibeShift, nextPrimaryVibe) {
    if (continuationMode === 'FULL_CONTINUATION') {
        return nextPrimaryVibe;
    }
    if (vibeShift === 'LAND') {
        return 'cozy';
    }
    if (nextPrimaryVibe === 'lively' || nextPrimaryVibe === 'playful') {
        return 'chill';
    }
    return nextPrimaryVibe;
}
export function deriveNextContext(result) {
    const currentTime = getTimeWindowSignal(result.intentProfile);
    const timePhase = advanceTimePhase(currentTime.phase, result.itinerary.estimatedTotalMinutes);
    const districtDecision = deriveDistrictStrategy(result);
    const vibeDecision = deriveVibeShift(result, timePhase);
    const resolutionDecision = evaluateResolution(result, vibeDecision.vibeShift);
    const nextPrimaryVibe = softenContinuationPrimaryVibe(resolutionDecision.continuationMode, vibeDecision.vibeShift, vibeDecision.nextPrimaryVibe);
    const nextSecondaryVibe = resolutionDecision.continuationMode === 'FULL_CONTINUATION'
        ? vibeDecision.nextSecondaryVibe
        : undefined;
    const nextIntent = {
        mode: result.intentProfile.mode,
        persona: result.intentProfile.crew === 'romantic'
            ? 'romantic'
            : result.intentProfile.crew === 'socialite'
                ? 'friends'
                : 'family',
        primaryVibe: nextPrimaryVibe,
        secondaryVibe: nextSecondaryVibe,
        city: result.intentProfile.city,
        district: districtDecision.nextDistrictId,
        neighborhood: districtDecision.districtStrategy === 'stay-put'
            ? districtDecision.continuationNeighborhood
            : undefined,
        distanceMode: result.intentProfile.distanceMode,
        budget: result.intentProfile.budget,
        timeWindow: timePhase,
        prefersHiddenGems: result.intentProfile.prefersHiddenGems,
        refinementModes: result.intentProfile.refinementModes,
    };
    const summary = resolutionDecision.continuationMode === 'CONTINUATION_FRAGMENT'
        ? `Arc 2 becomes a single soft ${timePhase} extension instead of restarting a full outing.`
        : resolutionDecision.continuationMode === 'COMPACT_CONTINUATION'
            ? `Arc 2 stays compact with one or two soft ${timePhase} beats instead of opening a whole new outing.`
            : districtDecision.districtStrategy === 'shift-district'
                ? `Arc 2 moves into ${districtDecision.nextDistrictLabel} for a stronger continuation in the ${timePhase}.`
                : `Arc 2 stays connected to ${districtDecision.continuationNeighborhood ?? districtDecision.nextDistrictLabel ?? result.intentProfile.city} and keeps the night moving into the ${timePhase}.`;
    return {
        nextIntent,
        districtStrategy: districtDecision.districtStrategy,
        vibeShift: vibeDecision.vibeShift,
        resolutionStrength: resolutionDecision.resolutionStrength,
        continuationMode: resolutionDecision.continuationMode,
        timePhase,
        nextDistrictLabel: districtDecision.nextDistrictLabel,
        continuationNeighborhood: districtDecision.continuationNeighborhood,
        nextPrimaryVibe,
        outingResolved: resolutionDecision.outingResolved,
        resolvedReason: resolutionDecision.resolvedReason,
        continuationReason: resolutionDecision.continuationReason,
        districtReason: districtDecision.districtReason,
        vibeReason: vibeDecision.vibeReason,
        repetitionReason: vibeDecision.repetitionReason,
        summary,
    };
}
