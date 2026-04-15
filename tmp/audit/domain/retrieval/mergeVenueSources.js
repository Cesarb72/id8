import { dedupeVenues } from './dedupeVenues';
export function mergeVenueSources(curatedVenues, liveVenues, requestedSourceMode) {
    const sourcePool = requestedSourceMode === 'curated'
        ? curatedVenues
        : requestedSourceMode === 'live'
            ? liveVenues
            : [...curatedVenues, ...liveVenues];
    const deduped = dedupeVenues(sourcePool);
    const countsBySource = deduped.venues.reduce((acc, venue) => {
        acc[venue.source.sourceOrigin] += 1;
        return acc;
    }, { curated: 0, live: 0 });
    return {
        venues: deduped.venues,
        dedupedCount: deduped.dedupedCount,
        dedupedLiveCount: deduped.dedupedLiveCount,
        liveDedupedAgainstCuratedCount: deduped.liveDedupedAgainstCuratedCount,
        liveNoveltyCollapsedCount: deduped.liveNoveltyCollapsedCount,
        dedupeLosses: deduped.losses,
        countsBySource,
    };
}
