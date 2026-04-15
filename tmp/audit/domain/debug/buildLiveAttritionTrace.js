function stageEntry(stage, liveCount, previousCount, notes) {
    return {
        stage,
        liveCount,
        droppedFromPrevious: previousCount === undefined ? 0 : Math.max(0, previousCount - liveCount),
        notes,
    };
}
function uniqueLiveIdsFromRolePools(rolePools) {
    return new Set([...rolePools.warmup, ...rolePools.peak, ...rolePools.wildcard, ...rolePools.cooldown]
        .filter((item) => item.venue.source.sourceOrigin === 'live')
        .map((item) => item.venue.id));
}
function uniqueLiveIdsFromArcCandidates(arcCandidates) {
    return new Set(arcCandidates.flatMap((candidate) => candidate.stops
        .filter((stop) => stop.scoredVenue.venue.source.sourceOrigin === 'live')
        .map((stop) => stop.scoredVenue.venue.id)));
}
export function buildLiveNoveltyLossDiagnostics(retrieval) {
    const strongestLiveDedupedExamples = [...retrieval.sourceMode.dedupeLosses]
        .filter((loss) => loss.liveLostAgainstCurated)
        .sort((left, right) => {
        const leftSignal = Math.max(left.liveSignatureScore ?? 0, left.liveDistinctivenessScore ?? 0);
        const rightSignal = Math.max(right.liveSignatureScore ?? 0, right.liveDistinctivenessScore ?? 0);
        return rightSignal - leftSignal;
    })
        .slice(0, 3);
    const dedupeLossReason = [...new Set(retrieval.sourceMode.dedupeLosses
            .filter((loss) => loss.liveLostAgainstCurated)
            .map((loss) => `${loss.duplicateReason}; ${loss.preferenceReason}`))].slice(0, 4);
    return {
        liveDedupedAgainstCuratedCount: retrieval.sourceMode.liveDedupedAgainstCuratedCount,
        strongestLiveDedupedExamples,
        dedupeLossReason,
        liveNoveltyCollapsedCount: retrieval.sourceMode.liveNoveltyCollapsedCount,
    };
}
export function buildLiveAttritionTrace({ retrieval, scoredVenues, rolePools, arcCandidates, selectedArc, roleCompetitionByRole, }) {
    const liveRetrievedCount = scoredVenues.filter((item) => item.venue.source.sourceOrigin === 'live').length;
    const liveEnteredRolePoolStart = rolePools.warmup.filter((item) => item.venue.source.sourceOrigin === 'live').length;
    const liveEnteredRolePoolHighlight = rolePools.peak.filter((item) => item.venue.source.sourceOrigin === 'live').length;
    const liveEnteredRolePoolSurprise = rolePools.wildcard.filter((item) => item.venue.source.sourceOrigin === 'live').length;
    const liveEnteredRolePoolWindDown = rolePools.cooldown.filter((item) => item.venue.source.sourceOrigin === 'live').length;
    const liveRolePoolVenueIds = uniqueLiveIdsFromRolePools(rolePools);
    const liveArcVenueIds = uniqueLiveIdsFromArcCandidates(arcCandidates);
    const liveRejectedByHighlightValidityCount = scoredVenues.filter((item) => item.venue.source.sourceOrigin === 'live' &&
        item.roleScores.peak >= 0.58 &&
        item.highlightValidity.validityLevel === 'invalid').length;
    const liveRejectedByRolePoolCount = Math.max(0, liveRetrievedCount - liveRolePoolVenueIds.size);
    const liveLostInArcAssemblyCount = [...liveRolePoolVenueIds].filter((venueId) => !liveArcVenueIds.has(venueId)).length;
    const liveLostInFinalWinnerCount = Object.values(roleCompetitionByRole).filter((comparison) => comparison?.strongestLiveLostAtStage === 'final-route-winner').length;
    const selectedLiveCount = selectedArc.stops.filter((stop) => stop.scoredVenue.venue.source.sourceOrigin === 'live').length;
    const stages = [];
    stages.push(stageEntry('fetch', retrieval.sourceMode.fetchedCount, undefined, [
        `${retrieval.sourceMode.fetchedCount} live place records fetched across ${retrieval.sourceMode.queryCount} queries.`,
        ...(retrieval.sourceMode.partialFailure ? ['Some live queries failed, so fetch attrition may be understated.'] : []),
    ]));
    stages.push(stageEntry('normalization', retrieval.sourceMode.normalizedCount, retrieval.sourceMode.fetchedCount, [
        `${retrieval.sourceMode.mappedCount} records mapped and ${retrieval.sourceMode.normalizedCount} normalized into venue objects.`,
    ]));
    stages.push(stageEntry('quality-gate', retrieval.sourceMode.approvedCount + retrieval.sourceMode.demotedCount, retrieval.sourceMode.normalizedCount, [
        `${retrieval.sourceMode.approvedCount} approved, ${retrieval.sourceMode.demotedCount} demoted, ${retrieval.sourceMode.suppressedCount} suppressed.`,
        ...(retrieval.sourceMode.liveHoursSuppressedCount > 0
            ? [`${retrieval.sourceMode.liveHoursSuppressedCount} live venues were fully suppressed by hours pressure.`]
            : []),
    ]));
    stages.push(stageEntry('dedupe', liveRetrievedCount + retrieval.sourceMode.dedupedLiveCount, retrieval.sourceMode.approvedCount + retrieval.sourceMode.demotedCount, [
        `${retrieval.sourceMode.dedupedLiveCount} live venues were removed during dedupe.`,
        `${retrieval.sourceMode.liveDedupedAgainstCuratedCount} of those were collapsed into curated seeds.`,
    ]));
    stages.push(stageEntry('retrieval', liveRetrievedCount, liveRetrievedCount + retrieval.sourceMode.dedupedLiveCount, [
        `${liveRetrievedCount} live venues survived into the scored retrieval set.`,
        `Final retrieved source balance: curated ${retrieval.stageCounts.finalCurated}, live ${retrieval.stageCounts.finalLive}.`,
    ]));
    stages.push(stageEntry('role-pool', liveRolePoolVenueIds.size, liveRetrievedCount, [
        `Role-pool entry counts: Start ${liveEnteredRolePoolStart}, Highlight ${liveEnteredRolePoolHighlight}, Surprise ${liveEnteredRolePoolSurprise}, Wind Down ${liveEnteredRolePoolWindDown}.`,
        `${liveRejectedByRolePoolCount} retrieved live venues never entered any role pool.`,
    ]));
    stages.push(stageEntry('highlight-validity', Math.max(0, liveEnteredRolePoolHighlight - liveRejectedByHighlightValidityCount), liveEnteredRolePoolHighlight, [
        `${liveRejectedByHighlightValidityCount} live highlight candidates were vetoed as invalid.`,
    ]));
    stages.push(stageEntry('arc-assembly', liveArcVenueIds.size, liveRolePoolVenueIds.size, [
        `${liveLostInArcAssemblyCount} live role-pool venues never appeared in a valid arc candidate.`,
        `${arcCandidates.length} arc candidates were assembled in total.`,
    ]));
    stages.push(stageEntry('final-route-winner', selectedLiveCount, liveArcVenueIds.size, [
        `${selectedLiveCount} live stops survived into the selected final route.`,
        `${liveLostInFinalWinnerCount} role-level live challengers reached arc assembly but still lost the final route winner.`,
    ]));
    return {
        liveFetchedCount: retrieval.sourceMode.fetchedCount,
        liveMappedCount: retrieval.sourceMode.mappedCount,
        liveNormalizedCount: retrieval.sourceMode.normalizedCount,
        liveApprovedCount: retrieval.sourceMode.approvedCount,
        liveDemotedCount: retrieval.sourceMode.demotedCount,
        liveSuppressedCount: retrieval.sourceMode.suppressedCount,
        liveDedupedCount: retrieval.sourceMode.dedupedLiveCount,
        liveDedupedAgainstCuratedCount: retrieval.sourceMode.liveDedupedAgainstCuratedCount,
        liveNoveltyCollapsedCount: retrieval.sourceMode.liveNoveltyCollapsedCount,
        liveRetrievedCount,
        liveEnteredRolePoolStart,
        liveEnteredRolePoolHighlight,
        liveEnteredRolePoolSurprise,
        liveEnteredRolePoolWindDown,
        liveRejectedByHighlightValidityCount,
        liveRejectedByRolePoolCount,
        liveLostInArcAssemblyCount,
        liveLostInFinalWinnerCount,
        stages,
    };
}
