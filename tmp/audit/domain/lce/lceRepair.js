import { getRoleAlternatives } from '../arc/getRoleAlternatives';
import { swapArcStop } from '../arc/swapArcStop';
import { inverseRoleProjection } from '../config/roleProjection';
function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
function uniqueByCandidateId(candidates) {
    const seen = new Set();
    const unique = [];
    for (const candidate of candidates) {
        const id = candidate.scoredVenue.candidateIdentity.candidateId;
        if (seen.has(id)) {
            continue;
        }
        seen.add(id);
        unique.push(candidate);
    }
    return unique;
}
function computeLocalContinuityScore(currentArc, replacement, role) {
    const index = currentArc.stops.findIndex((stop) => stop.role === role);
    if (index < 0) {
        return 0.5;
    }
    const previous = index > 0 ? currentArc.stops[index - 1] : undefined;
    const next = index < currentArc.stops.length - 1 ? currentArc.stops[index + 1] : undefined;
    const replacementDrive = replacement.venue.driveMinutes;
    const previousScore = previous
        ? clamp01(1 - Math.abs(previous.scoredVenue.venue.driveMinutes - replacementDrive) / 18)
        : 0.64;
    const nextScore = next
        ? clamp01(1 - Math.abs(next.scoredVenue.venue.driveMinutes - replacementDrive) / 18)
        : 0.64;
    return (previousScore + nextScore) / 2;
}
function buildRankedCandidates(scoredVenues, role) {
    return [...scoredVenues]
        .sort((left, right) => right.roleScores[role] - left.roleScores[role] ||
        right.fitScore - left.fitScore ||
        right.lensCompatibility - left.lensCompatibility ||
        left.candidateIdentity.candidateId.localeCompare(right.candidateIdentity.candidateId))
        .map((scoredVenue) => ({ scoredVenue, source: 'ranked-candidates' }));
}
function formatSourceLabel(source) {
    return source === 'role-pool' ? 'role pool' : 'ranked candidate field';
}
export function proposeLceRepair({ currentArc, role, trigger, scoredVenues, intent, crewPolicy, lens, rolePoolAlternatives, }) {
    const internalRole = inverseRoleProjection[role];
    const brokenStop = currentArc.stops.find((stop) => stop.role === internalRole);
    if (!brokenStop) {
        return undefined;
    }
    const excludedVenueIds = new Set(currentArc.stops
        .filter((stop) => stop.role !== internalRole)
        .map((stop) => stop.scoredVenue.venue.id));
    excludedVenueIds.add(brokenStop.scoredVenue.venue.id);
    const rolePool = rolePoolAlternatives ?? getRoleAlternatives({
        role: internalRole,
        currentArc,
        scoredVenues,
        intent,
        crewPolicy,
        lens,
        limit: 12,
    });
    const rolePoolCandidates = rolePool.map((item) => ({
        scoredVenue: item.scoredVenue,
        source: 'role-pool',
    }));
    const rankedCandidates = buildRankedCandidates(scoredVenues, internalRole);
    const mergedCandidates = uniqueByCandidateId([...rolePoolCandidates, ...rankedCandidates]).filter((candidate) => !excludedVenueIds.has(candidate.scoredVenue.venue.id) &&
        candidate.scoredVenue.candidateIdentity.candidateId !==
            brokenStop.scoredVenue.candidateIdentity.candidateId);
    const evaluated = mergedCandidates
        .map((candidate) => {
        const proposedArc = swapArcStop({
            currentArc,
            role: internalRole,
            replacement: candidate.scoredVenue,
            intent,
            crewPolicy,
            lens,
        });
        if (!proposedArc) {
            return undefined;
        }
        const roleScore = candidate.scoredVenue.roleScores[internalRole];
        const contractFit = candidate.scoredVenue.roleContract[internalRole].satisfied ? 1 : 0;
        const highlightValidityFit = internalRole === 'peak'
            ? candidate.scoredVenue.highlightValidity.validityLevel === 'valid'
                ? 1
                : candidate.scoredVenue.highlightValidity.validityLevel === 'fallback'
                    ? 0.55
                    : 0
            : 0.66;
        const continuity = computeLocalContinuityScore(currentArc, candidate.scoredVenue, internalRole);
        const sourceBoost = candidate.source === 'role-pool' ? 0.03 : 0;
        const score = roleScore * 0.46 +
            candidate.scoredVenue.fitScore * 0.2 +
            contractFit * 0.14 +
            continuity * 0.14 +
            highlightValidityFit * 0.06 +
            sourceBoost;
        return {
            ...candidate,
            proposedArc,
            score,
            continuity,
            contractFit,
        };
    })
        .filter((candidate) => Boolean(candidate))
        .sort((left, right) => right.score - left.score ||
        right.scoredVenue.roleScores[internalRole] - left.scoredVenue.roleScores[internalRole] ||
        right.scoredVenue.fitScore - left.scoredVenue.fitScore ||
        left.scoredVenue.candidateIdentity.candidateId.localeCompare(right.scoredVenue.candidateIdentity.candidateId));
    const best = evaluated[0];
    if (!best) {
        return undefined;
    }
    const rationale = `${formatSourceLabel(best.source)} | role ${best.scoredVenue.roleScores[internalRole].toFixed(2)} | continuity ${best.continuity.toFixed(2)} | contract ${best.contractFit >= 1 ? 'fit' : 'soft-fit'}`;
    return {
        role,
        trigger,
        brokenStopVenueId: brokenStop.scoredVenue.venue.id,
        brokenStopVenueName: brokenStop.scoredVenue.venue.name,
        replacement: best.scoredVenue,
        source: best.source,
        rationale,
        proposedArc: best.proposedArc,
    };
}
