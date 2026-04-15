import { dedupeVenues } from './dedupeVenues'
import type { LiveDedupeLossDiagnostics } from '../types/diagnostics'
import type { SourceMode } from '../types/sourceMode'
import type { Venue } from '../types/venue'

export interface MergeVenueSourcesResult {
  venues: Venue[]
  dedupedCount: number
  dedupedLiveCount: number
  liveDedupedAgainstCuratedCount: number
  liveNoveltyCollapsedCount: number
  dedupeLosses: LiveDedupeLossDiagnostics[]
  countsBySource: {
    curated: number
    live: number
  }
}

export function mergeVenueSources(
  curatedVenues: Venue[],
  liveVenues: Venue[],
  requestedSourceMode: SourceMode,
): MergeVenueSourcesResult {
  const sourcePool =
    requestedSourceMode === 'curated'
      ? curatedVenues
      : requestedSourceMode === 'live'
        ? liveVenues
        : [...curatedVenues, ...liveVenues]

  const deduped = dedupeVenues(sourcePool)
  const countsBySource = deduped.venues.reduce(
    (acc, venue) => {
      acc[venue.source.sourceOrigin] += 1
      return acc
    },
    { curated: 0, live: 0 },
  )

  return {
    venues: deduped.venues,
    dedupedCount: deduped.dedupedCount,
    dedupedLiveCount: deduped.dedupedLiveCount,
    liveDedupedAgainstCuratedCount: deduped.liveDedupedAgainstCuratedCount,
    liveNoveltyCollapsedCount: deduped.liveNoveltyCollapsedCount,
    dedupeLosses: deduped.losses,
    countsBySource,
  }
}
