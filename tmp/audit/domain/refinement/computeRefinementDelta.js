import { inverseRoleProjection, roleProjection } from '../config/roleProjection';
const SCORE_MATERIAL_THRESHOLD = 3;
const CONFIDENCE_MATERIAL_THRESHOLD = 8;
function formatRefinement(mode) {
    if (mode === 'more-exciting') {
        return 'More Exciting';
    }
    if (mode === 'more-relaxed') {
        return 'More Relaxed';
    }
    if (mode === 'closer-by') {
        return 'Closer By';
    }
    if (mode === 'more-unique') {
        return 'More Unique';
    }
    return 'A Little Fancier';
}
function roleLabel(role) {
    if (role === 'start') {
        return 'Start';
    }
    if (role === 'highlight') {
        return 'Highlight';
    }
    if (role === 'surprise') {
        return 'Surprise stop';
    }
    return 'Wind Down';
}
function buildSummaryMessage(requestedModes, stopDeltas, changedStopCount, materiallyChangedStopCount) {
    const modeLabel = requestedModes.length > 0 ? formatRefinement(requestedModes[0]) : 'your refinement';
    const materiallyChangedRoles = stopDeltas.filter((delta) => delta.materialChange).map((delta) => delta.role);
    if (materiallyChangedStopCount === 0) {
        return `No stronger nearby option matched "${modeLabel}", so your plan stayed the same.`;
    }
    if (changedStopCount === 0) {
        return `Plan re-evaluated for "${modeLabel}" with the same visible stops.`;
    }
    if (materiallyChangedRoles.length === 1) {
        const role = materiallyChangedRoles[0];
        if (role === 'highlight' && requestedModes.includes('more-exciting')) {
            return 'Highlight changed to a more energetic option.';
        }
        if (role === 'windDown' && requestedModes.includes('closer-by')) {
            return 'Wind Down moved closer.';
        }
        if (role === 'surprise' && requestedModes.includes('more-unique')) {
            return 'Surprise stop swapped for a more unique pick.';
        }
        return `${roleLabel(role)} changed after refinement.`;
    }
    const labels = materiallyChangedRoles.map((role) => roleLabel(role));
    return `Updated ${labels.join(', ')} for "${modeLabel}".`;
}
export function computeRefinementDelta({ requestedModes, nextArc, previousArc, nextStopExplainability, previousStopExplainability, targetedRoles = [], primaryTargetRole, targetRoleExistedInVisiblePlan = true, targetRoleSelectionReason = '', targetedCandidateCount = 0, targetedChangeSucceeded = false, fullPlanFallbackUsed = false, winnerInertiaDetected = false, winnerInertiaReduced = false, winnerInertiaNotes = [], }) {
    if (!previousArc) {
        return undefined;
    }
    const allRoles = new Set([
        ...previousArc.stops.map((stop) => roleProjection[stop.role]),
        ...nextArc.stops.map((stop) => roleProjection[stop.role]),
    ]);
    const stopDeltas = [...allRoles].map((role) => {
        const internalRole = inverseRoleProjection[role];
        const previousStop = previousArc.stops.find((stop) => stop.role === internalRole);
        const nextStop = nextArc.stops.find((stop) => stop.role === internalRole);
        const previousDebug = previousStopExplainability?.[role];
        const nextDebug = nextStopExplainability[role];
        const previousScore = previousDebug?.selectedScore ??
            (previousStop ? Number((previousStop.scoredVenue.roleScores[internalRole] * 100).toFixed(1)) : undefined);
        const nextScore = nextDebug?.selectedScore ??
            (nextStop ? Number((nextStop.scoredVenue.roleScores[internalRole] * 100).toFixed(1)) : undefined);
        const scoreDelta = typeof previousScore === 'number' && typeof nextScore === 'number'
            ? Number((nextScore - previousScore).toFixed(1))
            : undefined;
        const previousConfidence = previousDebug?.selectionConfidence;
        const nextConfidence = nextDebug?.selectionConfidence;
        const confidenceDelta = typeof previousConfidence === 'number' && typeof nextConfidence === 'number'
            ? nextConfidence - previousConfidence
            : undefined;
        const previousVenueId = previousStop?.scoredVenue.venue.id;
        const nextVenueId = nextStop?.scoredVenue.venue.id;
        const changed = previousVenueId !== nextVenueId;
        const materialScoreShift = typeof scoreDelta === 'number' && Math.abs(scoreDelta) >= SCORE_MATERIAL_THRESHOLD;
        const materialConfidenceShift = typeof confidenceDelta === 'number' &&
            Math.abs(confidenceDelta) >= CONFIDENCE_MATERIAL_THRESHOLD;
        return {
            role,
            previousVenueId,
            nextVenueId,
            changed,
            previousScore,
            nextScore,
            scoreDelta,
            previousConfidence,
            nextConfidence,
            confidenceDelta,
            materialChange: changed || materialScoreShift || materialConfidenceShift,
        };
    });
    const changedStopCount = stopDeltas.filter((delta) => delta.changed).length;
    const materiallyChangedStopCount = stopDeltas.filter((delta) => delta.materialChange).length;
    const sameResult = changedStopCount === 0;
    const outcomeType = materiallyChangedStopCount === 0
        ? 'no_better_match'
        : changedStopCount === 0
            ? 'plan_reconsidered_same_result'
            : materiallyChangedStopCount === stopDeltas.length
                ? 'plan_changed'
                : 'partial_change';
    const pathResult = materiallyChangedStopCount === 0
        ? 'no_better_match'
        : targetedChangeSucceeded
            ? 'targeted_change'
            : changedStopCount > 0
                ? 'full_plan_change'
                : 'reconsidered_same_result';
    return {
        requestedModes,
        previousArcId: previousArc.id,
        nextArcId: nextArc.id,
        outcomeType,
        pathResult,
        targetedRoles,
        primaryTargetRole,
        targetRoleExistedInVisiblePlan,
        targetRoleSelectionReason,
        targetedCandidateCount,
        targetedChangeSucceeded,
        fullPlanFallbackUsed,
        changedStopCount,
        materiallyChangedStopCount,
        sameResult,
        escalationUsed: false,
        winnerInertiaDetected,
        winnerInertiaReduced,
        winnerInertiaNotes,
        stopDeltas,
        summaryMessage: buildSummaryMessage(requestedModes, stopDeltas, changedStopCount, materiallyChangedStopCount),
    };
}
