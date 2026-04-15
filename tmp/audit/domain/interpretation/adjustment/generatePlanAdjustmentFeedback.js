const orderedRoles = ['start', 'highlight', 'surprise', 'windDown'];
function pushUnique(target, value) {
    if (!value || target.includes(value)) {
        return;
    }
    target.push(value);
}
function stopMapByRole(itinerary) {
    return itinerary.stops.reduce((accumulator, stop) => {
        accumulator[stop.role] = stop.venueId;
        return accumulator;
    }, {});
}
function countChangedStops(previous, next) {
    const previousByRole = stopMapByRole(previous);
    const nextByRole = stopMapByRole(next);
    return orderedRoles.reduce((count, role) => {
        const previousStop = previousByRole[role];
        const nextStop = nextByRole[role];
        if (!previousStop && !nextStop) {
            return count;
        }
        return previousStop === nextStop ? count : count + 1;
    }, 0);
}
function hasRole(itinerary, role) {
    return itinerary.stops.some((stop) => stop.role === role);
}
function hasCentralMoment(itinerary) {
    const startIndex = itinerary.stops.findIndex((stop) => stop.role === 'start');
    const highlightIndex = itinerary.stops.findIndex((stop) => stop.role === 'highlight');
    if (highlightIndex < 0) {
        return false;
    }
    return startIndex < 0 || highlightIndex >= startIndex;
}
function resolveEffectStrength({ districtChanged, changedStopCount, highlightChanged, spatialModeChanged, frictionDelta, durationDelta, surpriseChanged, }) {
    let magnitude = 0;
    if (districtChanged) {
        magnitude += 2;
    }
    if (changedStopCount >= 2) {
        magnitude += 2;
    }
    else if (changedStopCount === 1) {
        magnitude += 1;
    }
    if (highlightChanged) {
        magnitude += 1;
    }
    if (spatialModeChanged) {
        magnitude += 1;
    }
    if (Math.abs(frictionDelta) >= 2) {
        magnitude += 1;
    }
    if (Math.abs(durationDelta) >= 45) {
        magnitude += 1;
    }
    if (surpriseChanged) {
        magnitude += 1;
    }
    if (magnitude >= 4) {
        return 'strong';
    }
    if (magnitude >= 2) {
        return 'moderate';
    }
    return 'minor';
}
function buildHeadline(strength, mostlySame) {
    if (strength === 'strong') {
        return 'Plan update: route reshaped around your adjustments';
    }
    if (strength === 'moderate') {
        return 'Plan update: route refined with visible changes';
    }
    if (mostlySame) {
        return 'Plan update: kept the route mostly the same';
    }
    return 'Plan update: small refinements applied';
}
export function generatePlanAdjustmentFeedback({ previousPlan, nextPlan, controls, }) {
    const previousStopByRole = stopMapByRole(previousPlan.itinerary);
    const nextStopByRole = stopMapByRole(nextPlan.itinerary);
    const changedStopCount = countChangedStops(previousPlan.itinerary, nextPlan.itinerary);
    const highlightChanged = previousStopByRole.highlight !== nextStopByRole.highlight;
    const previousHasSurprise = hasRole(previousPlan.itinerary, 'surprise');
    const nextHasSurprise = hasRole(nextPlan.itinerary, 'surprise');
    const surpriseChanged = previousHasSurprise !== nextHasSurprise;
    const districtChanged = previousPlan.trace.selectedDistrictId !== nextPlan.trace.selectedDistrictId;
    const frictionDelta = nextPlan.trace.routePacing.totalRouteFriction - previousPlan.trace.routePacing.totalRouteFriction;
    const durationDelta = nextPlan.trace.routePacing.estimatedTotalMinutes -
        previousPlan.trace.routePacing.estimatedTotalMinutes;
    const spatialModeChanged = previousPlan.trace.spatialCoherence.mode !== nextPlan.trace.spatialCoherence.mode;
    const becameMoreCompact = (previousPlan.trace.spatialCoherence.mode === 'flexible' &&
        nextPlan.trace.spatialCoherence.mode === 'walkable') ||
        frictionDelta <= -1;
    const becameMoreOpen = (previousPlan.trace.spatialCoherence.mode === 'walkable' &&
        nextPlan.trace.spatialCoherence.mode === 'flexible') ||
        frictionDelta >= 1;
    const becameSofter = (!nextHasSurprise && previousHasSurprise) ||
        durationDelta <= -25 ||
        frictionDelta <= -1;
    const becameStronger = (nextHasSurprise && !previousHasSurprise) ||
        durationDelta >= 25 ||
        frictionDelta >= 1;
    const mostlySame = !districtChanged &&
        changedStopCount === 0 &&
        !spatialModeChanged &&
        Math.abs(frictionDelta) <= 1 &&
        Math.abs(durationDelta) <= 20;
    const nextRefinementModes = nextPlan.trace.intent.refinementModes ?? [];
    const districtAccepted = Boolean(controls.districtPreference) &&
        nextPlan.trace.selectedDistrictId === controls.districtPreference;
    const startTimeAccepted = Boolean(controls.startTime) && nextPlan.trace.intent.timeWindow === controls.startTime;
    const distanceAccepted = controls.distanceTolerance === 'compact'
        ? nextPlan.trace.intent.distanceMode === 'nearby' &&
            nextRefinementModes.includes('closer-by')
        : controls.distanceTolerance === 'open'
            ? nextPlan.trace.intent.distanceMode === 'short-drive'
            : controls.distanceTolerance === 'balanced'
                ? nextPlan.trace.intent.distanceMode === 'nearby' &&
                    !nextRefinementModes.includes('closer-by')
                : false;
    const energyAccepted = controls.energyBias === 'softer'
        ? nextRefinementModes.includes('more-relaxed') &&
            !nextRefinementModes.includes('more-exciting')
        : controls.energyBias === 'stronger'
            ? nextRefinementModes.includes('more-exciting') &&
                !nextRefinementModes.includes('more-relaxed')
            : controls.energyBias === 'balanced'
                ? !nextRefinementModes.includes('more-exciting') &&
                    !nextRefinementModes.includes('more-relaxed')
                : false;
    const changeSummary = [];
    if (districtChanged) {
        pushUnique(changeSummary, `Shifted the route toward ${nextPlan.trace.selectedDistrictLabel}.`);
    }
    if (changedStopCount >= 2) {
        pushUnique(changeSummary, 'Updated multiple stops while preserving route coherence.');
    }
    else if (changedStopCount === 1) {
        pushUnique(changeSummary, highlightChanged
            ? 'Updated the central stop to better match your adjustments.'
            : 'Swapped one stop and kept the overall flow intact.');
    }
    if (controls.distanceTolerance === 'compact' && becameMoreCompact) {
        pushUnique(changeSummary, 'Route became more compact with easier transitions.');
    }
    if (controls.distanceTolerance === 'open' && becameMoreOpen) {
        pushUnique(changeSummary, 'Route opened up to allow more movement between stops.');
    }
    if (controls.energyBias === 'softer' && becameSofter) {
        pushUnique(changeSummary, 'Pacing softened so the night lands more gently.');
    }
    if (controls.energyBias === 'stronger' && becameStronger) {
        pushUnique(changeSummary, 'Pacing strengthened around a bigger central moment.');
    }
    if (changeSummary.length === 0) {
        pushUnique(changeSummary, mostlySame
            ? 'Kept the same core route because it already fit your adjustments.'
            : 'Made small route refinements while keeping the same structure.');
    }
    const trustNotes = [];
    if (startTimeAccepted) {
        pushUnique(trustNotes, 'Still fits your selected start time.');
    }
    if (nextPlan.trace.spatialCoherence.mode === 'walkable') {
        pushUnique(trustNotes, 'Stops remain geographically compact.');
    }
    else {
        pushUnique(trustNotes, 'Transitions remain manageable across the route.');
    }
    if (hasCentralMoment(nextPlan.itinerary)) {
        pushUnique(trustNotes, 'The route still builds toward a central moment.');
    }
    if (mostlySame) {
        if (controls.districtPreference && districtAccepted && !districtChanged) {
            pushUnique(trustNotes, 'That district was already the strongest fit for this route.');
        }
        if (controls.distanceTolerance === 'compact' && distanceAccepted) {
            pushUnique(trustNotes, 'Your route was already compact, so no major changes were needed.');
        }
        if (controls.distanceTolerance === 'open' && distanceAccepted) {
            pushUnique(trustNotes, 'This route already had enough range, so only light changes were needed.');
        }
        if (controls.energyBias === 'softer' && energyAccepted) {
            pushUnique(trustNotes, 'The current district already fit your softer energy preference.');
        }
        if (controls.energyBias === 'stronger' && energyAccepted) {
            pushUnique(trustNotes, 'The current district already supported a stronger energy curve.');
        }
    }
    const effectStrength = resolveEffectStrength({
        districtChanged,
        changedStopCount,
        highlightChanged,
        spatialModeChanged,
        frictionDelta,
        durationDelta,
        surpriseChanged,
    });
    return {
        headline: buildHeadline(effectStrength, mostlySame),
        changeSummary: changeSummary.slice(0, 3),
        trustNotes: trustNotes.slice(0, 3),
        effectStrength,
    };
}
