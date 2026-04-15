import { createId } from '../../lib/ids';
import { isValidArcCombination } from './isValidArcCombination';
import { scoreArcAssembly } from './scoreArcAssembly';
export function swapArcStop({ currentArc, role, replacement, intent, crewPolicy, lens, }) {
    const updatedStops = currentArc.stops.map((stop) => stop.role === role ? { ...stop, scoredVenue: replacement } : stop);
    if (!isValidArcCombination(updatedStops, intent, crewPolicy, lens)) {
        return null;
    }
    const scored = scoreArcAssembly(updatedStops, intent, crewPolicy, lens);
    return {
        id: createId(`arc_swap_${role}`),
        stops: updatedStops,
        totalScore: scored.totalScore,
        scoreBreakdown: scored.scoreBreakdown,
        pacing: scored.pacing,
        spatial: scored.spatial,
        hasWildcard: updatedStops.some((stop) => stop.role === 'wildcard'),
    };
}
