import { rankWithWaypointBoundary } from './core';
export function rankArcCandidates(candidates, intent) {
    const response = rankWithWaypointBoundary({ candidates, intent });
    return {
        rankedCandidates: response.ranked.map((entry) => entry.candidate),
        rankingEngine: response.engine,
    };
}
