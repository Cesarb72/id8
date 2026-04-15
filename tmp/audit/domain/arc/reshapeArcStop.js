import { createId } from '../../lib/ids';
import { inverseRoleProjection, roleProjection } from '../config/roleProjection';
import { isValidArcCombination } from './isValidArcCombination';
import { scoreArcAssembly } from './scoreArcAssembly';
function getShapeForStopCount(stopCount) {
    if (stopCount === 4) {
        return ['warmup', 'peak', 'wildcard', 'cooldown'];
    }
    return ['warmup', 'peak', 'cooldown'];
}
function buildRoleShapeAction(targetRole, stopCount) {
    if (targetRole === 'wildcard' && stopCount !== 4) {
        return undefined;
    }
    const byRole = {
        warmup: {
            id: 'use-to-start',
            label: 'Use this to start',
            acknowledgement: 'Now starting here',
        },
        peak: {
            id: 'make-main',
            label: 'Make this the main stop',
            acknowledgement: 'Main stop updated',
        },
        wildcard: {
            id: 'save-for-later',
            label: 'Save this for later',
            acknowledgement: 'Saved for later',
        },
        cooldown: {
            id: 'use-to-close',
            label: 'Use this to close',
            acknowledgement: 'Closing here',
        },
    };
    const index = getShapeForStopCount(stopCount).indexOf(targetRole);
    if (index < 0) {
        return undefined;
    }
    const action = byRole[targetRole];
    return {
        ...action,
        targetIndex: index,
        targetRole: roleProjection[targetRole],
    };
}
function buildStableRoleSwap(currentArc, role, targetRole) {
    const shape = getShapeForStopCount(currentArc.stops.length);
    if (!shape.includes(role) || !shape.includes(targetRole)) {
        return null;
    }
    const stopsByRole = new Map(currentArc.stops.map((stop) => [stop.role, stop]));
    const selectedStop = stopsByRole.get(role);
    const displacedStop = stopsByRole.get(targetRole);
    if (!selectedStop || !displacedStop) {
        return null;
    }
    return shape.map((slotRole) => {
        if (slotRole === targetRole) {
            return {
                ...selectedStop,
                role: targetRole,
            };
        }
        if (slotRole === role) {
            return {
                ...displacedStop,
                role,
            };
        }
        const preservedStop = stopsByRole.get(slotRole);
        return preservedStop ? { ...preservedStop, role: slotRole } : undefined;
    }).filter((stop) => Boolean(stop));
}
export function reshapeArcStop({ currentArc, role, targetRole, intent, crewPolicy, lens, }) {
    if (role === targetRole) {
        return null;
    }
    const reshapedStops = buildStableRoleSwap(currentArc, role, targetRole);
    if (!reshapedStops) {
        return null;
    }
    if (!isValidArcCombination(reshapedStops, intent, crewPolicy, lens)) {
        return null;
    }
    const scored = scoreArcAssembly(reshapedStops, intent, crewPolicy, lens);
    return {
        id: createId(`arc_shape_${roleProjection[targetRole]}`),
        stops: reshapedStops,
        totalScore: scored.totalScore,
        scoreBreakdown: scored.scoreBreakdown,
        pacing: scored.pacing,
        spatial: scored.spatial,
        hasWildcard: reshapedStops.some((stop) => stop.role === 'wildcard'),
    };
}
export function getRoleShapeActions({ currentArc, role, intent, crewPolicy, lens, }) {
    const internalRole = inverseRoleProjection[role];
    const shape = getShapeForStopCount(currentArc.stops.length);
    return shape
        .filter((targetRole) => targetRole !== internalRole)
        .map((targetRole) => buildRoleShapeAction(targetRole, currentArc.stops.length))
        .filter((action) => Boolean(action))
        .filter((action) => Boolean(reshapeArcStop({
        currentArc,
        role: internalRole,
        targetRole: inverseRoleProjection[action.targetRole],
        intent,
        crewPolicy,
        lens,
    })))
        .sort((left, right) => left.targetIndex - right.targetIndex);
}
