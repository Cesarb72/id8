import { inverseRoleProjection } from '../../../domain/config/roleProjection'
import type { ArcCandidate, ScoredVenue } from '../../../domain/types/arc'
import type { ItineraryStop } from '../../../domain/types/itinerary'

function normalizeIdentityName(value: string | undefined | null): string {
  return value?.trim().replace(/\s+/g, ' ').toLowerCase() ?? ''
}

export function findScoredVenueForStopWithPolicy(
  stop: Pick<ItineraryStop, 'role' | 'venueId' | 'venueName'>,
  selectedArc: Pick<ArcCandidate, 'stops'>,
  options?: {
    allowRoleFallback?: boolean
  },
): ScoredVenue | undefined {
  const targetRole = inverseRoleProjection[stop.role]
  const roleCandidates = selectedArc.stops.filter((arcStop) => arcStop.role === targetRole)
  const matchedByVenueId = roleCandidates.find(
    (arcStop) => arcStop.scoredVenue.venue.id === stop.venueId,
  )
  if (matchedByVenueId) {
    return matchedByVenueId.scoredVenue
  }

  const stopName = normalizeIdentityName(stop.venueName)
  if (stopName) {
    const matchedByName = roleCandidates.find(
      (arcStop) => normalizeIdentityName(arcStop.scoredVenue.venue.name) === stopName,
    )
    if (matchedByName) {
      return matchedByName.scoredVenue
    }
  }

  if (options?.allowRoleFallback === false) {
    return undefined
  }
  return roleCandidates[0]?.scoredVenue
}
