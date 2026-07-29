import { computeHybridLiveLift } from './computeHybridLiveLift'
import { classifyProviderAuthority } from './fieldPolicy'
import type { LiveDedupeLossDiagnostics } from '../types/diagnostics'
import type { Venue } from '../types/venue'

export function getAdmittedRouteVenueIdentity(venue: Venue): string | undefined {
  const routeIdentity = venue.id.trim()
  if (!routeIdentity) {
    return undefined
  }

  const normalizedRouteIdentity = routeIdentity.toLowerCase()
  const providerRecordId = venue.source.providerRecordId?.trim().toLowerCase()
  if (normalizedRouteIdentity.startsWith('live_google_')) {
    return undefined
  }
  if (providerRecordId && normalizedRouteIdentity === providerRecordId) {
    return undefined
  }

  return routeIdentity
}

export function isSelectableAdmittedRouteVenue(venue: Venue): boolean {
  return Boolean(getAdmittedRouteVenueIdentity(venue))
}

function getDuplicateReason(left: Venue, right: Venue): string | undefined {
  const leftIdentity = getAdmittedRouteVenueIdentity(left)
  const rightIdentity = getAdmittedRouteVenueIdentity(right)
  if (leftIdentity && rightIdentity && leftIdentity === rightIdentity) {
    return 'same admitted canonical route identity'
  }
  return undefined
}

function stableRepresentativeKey(venue: Venue): string {
  const sourceRank = venue.source.sourceOrigin === 'curated' ? '0' : '1'
  return [
    sourceRank,
    venue.id,
    venue.name,
    venue.source.providerRecordId ?? '',
  ].join('\u001f')
}

function pickPreferredVenue(left: Venue, right: Venue): { preferred: Venue; reason: string } {
  const leftIdentity = getAdmittedRouteVenueIdentity(left)
  const rightIdentity = getAdmittedRouteVenueIdentity(right)
  if (!leftIdentity || leftIdentity !== rightIdentity) {
    throw new Error('retrieval dedupe attempted to choose a representative without matching admitted identity')
  }

  return {
    preferred: stableRepresentativeKey(left) <= stableRepresentativeKey(right) ? left : right,
    reason: 'same admitted canonical identity collapsed with stable source-independent representative',
  }
}

function computeNoveltyCollapse(removed: Venue, kept: Venue): boolean {
  if (removed.source.sourceOrigin !== 'live' || kept.source.sourceOrigin !== 'curated') {
    return false
  }
  return (
    removed.signature.signatureScore >= 0.55 ||
    removed.distinctivenessScore >= kept.distinctivenessScore ||
    computeHybridLiveLift(removed).strongLiveCandidate
  )
}

export interface DedupeVenuesResult {
  venues: Venue[]
  dedupedCount: number
  dedupedLiveCount: number
  liveDedupedAgainstCuratedCount: number
  liveNoveltyCollapsedCount: number
  losses: LiveDedupeLossDiagnostics[]
}

export function dedupeVenues(venues: Venue[]): DedupeVenuesResult {
  const deduped: Venue[] = []
  let dedupedCount = 0
  let dedupedLiveCount = 0
  let liveDedupedAgainstCuratedCount = 0
  let liveNoveltyCollapsedCount = 0
  const losses: LiveDedupeLossDiagnostics[] = []

  for (const venue of venues) {
    if (!isSelectableAdmittedRouteVenue(venue)) {
      continue
    }
    const duplicateIndex = deduped.findIndex((candidate) => Boolean(getDuplicateReason(candidate, venue)))
    if (duplicateIndex === -1) {
      deduped.push(venue)
      continue
    }

    const current = deduped[duplicateIndex]!
    const duplicateReason = getDuplicateReason(current, venue) ?? 'duplicate collapsed during source merge'
    dedupedCount += 1
    const resolution = pickPreferredVenue(current, venue)
    const removed = resolution.preferred === current ? venue : current
    const kept = resolution.preferred
    if (removed.source.sourceOrigin === 'live') {
      dedupedLiveCount += 1
    }
    const liveLostAgainstCurated =
      removed.source.sourceOrigin === 'live' && kept.source.sourceOrigin === 'curated'
    const liveNoveltyCollapsed = computeNoveltyCollapse(removed, kept)

    if (liveLostAgainstCurated) {
      liveDedupedAgainstCuratedCount += 1
    }
    if (liveNoveltyCollapsed) {
      liveNoveltyCollapsedCount += 1
    }

    if (removed.source.sourceOrigin === 'live' || kept.source.sourceOrigin === 'live') {
      losses.push({
        removedVenueId: removed.id,
        removedVenueName: removed.name,
        removedSourceOrigin: removed.source.sourceOrigin,
        removedProviderAuthority: classifyProviderAuthority(removed.source),
        keptVenueId: kept.id,
        keptVenueName: kept.name,
        keptSourceOrigin: kept.source.sourceOrigin,
        keptProviderAuthority: classifyProviderAuthority(kept.source),
        duplicateReason,
        preferenceReason: resolution.reason,
        liveLostAgainstCurated,
        liveNoveltyCollapsed,
        liveSignatureScore:
          removed.source.sourceOrigin === 'live'
            ? Number((removed.signature.signatureScore * 100).toFixed(1))
            : kept.source.sourceOrigin === 'live'
              ? Number((kept.signature.signatureScore * 100).toFixed(1))
              : undefined,
        keptSignatureScore: Number((kept.signature.signatureScore * 100).toFixed(1)),
        liveDistinctivenessScore:
          removed.source.sourceOrigin === 'live'
            ? Number((removed.distinctivenessScore * 100).toFixed(1))
            : kept.source.sourceOrigin === 'live'
              ? Number((kept.distinctivenessScore * 100).toFixed(1))
              : undefined,
        keptDistinctivenessScore: Number((kept.distinctivenessScore * 100).toFixed(1)),
      })
    }

    deduped[duplicateIndex] = kept
  }

  return {
    venues: deduped,
    dedupedCount,
    dedupedLiveCount,
    liveDedupedAgainstCuratedCount,
    liveNoveltyCollapsedCount,
    losses,
  }
}
