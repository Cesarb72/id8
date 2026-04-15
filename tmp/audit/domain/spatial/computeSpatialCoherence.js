import { getSpatialMode } from '../types/spatial';
import { getVenueClusterId } from './getVenueClusterId';
function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
function roundToHundredths(value) {
    return Number(value.toFixed(2));
}
function inferClusterId(stop) {
    return getVenueClusterId(stop.scoredVenue.venue);
}
function uniqueConsecutive(values) {
    return values.filter((value, index) => index === 0 || value !== values[index - 1]);
}
function getWalkableTransitionDelta(sameCluster, driveGap) {
    const notes = [];
    let bonus = 0;
    let penalty = 0;
    let longTransition = false;
    if (sameCluster) {
        bonus += 0.12;
        notes.push('same-cluster handoff');
    }
    else {
        penalty += driveGap <= 4 ? 0.06 : 0.14;
        notes.push('cluster escape in walkable mode');
    }
    if (driveGap >= 8) {
        penalty += 0.08;
        longTransition = true;
        notes.push('long transfer for walkable mode');
    }
    if (driveGap >= 12) {
        penalty += 0.12;
        notes.push('destination jump is stretching beyond a local outing');
    }
    return {
        bonus,
        penalty,
        longTransition,
        notes,
    };
}
function getFlexibleTransitionDelta(sameCluster, driveGap) {
    const notes = [];
    let bonus = 0;
    let penalty = 0;
    let longTransition = false;
    if (sameCluster) {
        bonus += 0.07;
        notes.push('same-cluster transition keeps the route grounded');
    }
    else {
        penalty += 0.05;
        notes.push('cross-cluster move accepted in flexible mode');
    }
    if (driveGap >= 10) {
        penalty += 0.06;
        longTransition = true;
        notes.push('drive starts to feel material');
    }
    if (driveGap >= 14) {
        penalty += 0.1;
        notes.push('jump is large even for flexible mode');
    }
    return {
        bonus,
        penalty,
        longTransition,
        notes,
    };
}
export function computeSpatialCoherence(stops, intent) {
    const mode = getSpatialMode(intent.distanceMode);
    const clusterAssignments = stops.map((stop) => ({
        venueId: stop.scoredVenue.venue.id,
        venueName: stop.scoredVenue.venue.name,
        neighborhood: stop.scoredVenue.venue.neighborhood,
        clusterId: inferClusterId(stop),
    }));
    const homeClusterId = clusterAssignments[0]?.clusterId ?? 'unknown';
    const highlightClusterId = clusterAssignments[stops.findIndex((stop) => stop.role === 'peak')]?.clusterId ??
        homeClusterId;
    const clusterSequence = clusterAssignments.map((assignment) => assignment.clusterId);
    const clusterSegments = uniqueConsecutive(clusterSequence);
    const distinctNonHomeClusters = [
        ...new Set(clusterSegments.filter((clusterId) => clusterId !== homeClusterId)),
    ];
    let spatialBonus = 0;
    let spatialPenalty = 0;
    let sameClusterTransitionCount = 0;
    let clusterEscapeCount = 0;
    let longTransitionCount = 0;
    const transitions = stops.slice(0, -1).map((stop, index) => {
        const fromAssignment = clusterAssignments[index];
        const toAssignment = clusterAssignments[index + 1];
        const driveGap = Math.abs(stop.scoredVenue.venue.driveMinutes - stops[index + 1].scoredVenue.venue.driveMinutes);
        const sameCluster = fromAssignment.clusterId === toAssignment.clusterId;
        const delta = mode === 'walkable'
            ? getWalkableTransitionDelta(sameCluster, driveGap)
            : getFlexibleTransitionDelta(sameCluster, driveGap);
        if (sameCluster) {
            sameClusterTransitionCount += 1;
        }
        else {
            clusterEscapeCount += 1;
        }
        if (delta.longTransition) {
            longTransitionCount += 1;
        }
        spatialBonus += delta.bonus;
        spatialPenalty += delta.penalty;
        return {
            fromVenueId: stop.scoredVenue.venue.id,
            toVenueId: stops[index + 1].scoredVenue.venue.id,
            fromClusterId: fromAssignment.clusterId,
            toClusterId: toAssignment.clusterId,
            fromNeighborhood: stop.scoredVenue.venue.neighborhood,
            toNeighborhood: stops[index + 1].scoredVenue.venue.neighborhood,
            driveGap,
            sameCluster,
            clusterEscape: !sameCluster,
            longTransition: delta.longTransition,
            jumpUsed: false,
            scoreDelta: roundToHundredths(delta.bonus - delta.penalty),
            notes: delta.notes,
        };
    });
    const notes = [];
    let repeatedClusterEscapeCount = 0;
    let jumpUsed = false;
    if (mode === 'walkable') {
        if (clusterSegments.length <= 1) {
            spatialBonus += 0.18;
            notes.push('walkable route stayed inside one local cluster');
        }
        else if (distinctNonHomeClusters.length === 1 && clusterSegments.length <= 3) {
            jumpUsed = true;
            const jumpTransition = transitions.find((transition) => transition.toClusterId === distinctNonHomeClusters[0]);
            if (jumpTransition) {
                jumpTransition.jumpUsed = true;
                jumpTransition.notes = [
                    ...jumpTransition.notes,
                    jumpTransition.toClusterId === highlightClusterId
                        ? 'allowed destination jump lands on the highlight cluster'
                        : 'allowed destination jump stays controlled',
                ];
                jumpTransition.scoreDelta = roundToHundredths(jumpTransition.scoreDelta + 0.12);
            }
            spatialBonus += jumpTransition?.toClusterId === highlightClusterId ? 0.12 : 0.06;
            notes.push(jumpTransition?.toClusterId === highlightClusterId
                ? 'one destination jump was used to reach a stronger highlight area'
                : 'one destination jump was used without breaking local coherence');
            if (clusterSegments.length === 3) {
                notes.push('route returns to the home cluster after one destination excursion');
            }
        }
        else {
            repeatedClusterEscapeCount =
                Math.max(0, clusterSegments.length - 3) +
                    Math.max(0, distinctNonHomeClusters.length - 1);
            spatialPenalty += 0.16 + repeatedClusterEscapeCount * 0.12;
            notes.push('walkable route bounces across too many clusters');
        }
    }
    else {
        if (clusterSegments.length <= 2) {
            spatialBonus += 0.08;
            notes.push('flexible route still clusters cleanly enough to feel intentional');
        }
        if (clusterSegments.length >= 4) {
            repeatedClusterEscapeCount = clusterSegments.length - 3;
            spatialPenalty += repeatedClusterEscapeCount * 0.08;
            notes.push('flexible route changes clusters repeatedly');
        }
        if (longTransitionCount === 0) {
            spatialBonus += 0.04;
            notes.push('flexible route avoids any heavy driving jumps');
        }
    }
    const scoreBase = mode === 'walkable' ? 0.74 : 0.78;
    const score = clamp01(scoreBase + spatialBonus - spatialPenalty);
    return {
        mode,
        homeClusterId,
        clustersVisited: [...new Set(clusterSequence)],
        clusterAssignments,
        transitions,
        sameClusterTransitionCount,
        clusterEscapeCount,
        repeatedClusterEscapeCount,
        longTransitionCount,
        jumpUsed,
        spatialBonus: roundToHundredths(spatialBonus),
        spatialPenalty: roundToHundredths(spatialPenalty),
        score: roundToHundredths(score),
        notes,
    };
}
