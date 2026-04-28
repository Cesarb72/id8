import type { ItineraryStop } from '../types/itinerary'
import type { VenueCardDetailInput } from '../types/stopRepresentation'
import type { VenueCardStopRepresentationWithSource } from '../types/stopRepresentation'
import type { Venue } from '../types/venue'
import { buildVenueCardStopRepresentation } from './buildVenueCardStopRepresentation'

const EMPTY_CURATED_VENUE_BY_ID = new Map<string, Venue>()

export function buildPlanningStopRepresentation(params: {
  stop: ItineraryStop
  detail?: VenueCardDetailInput
}): VenueCardStopRepresentationWithSource | null {
  return buildVenueCardStopRepresentation({
    role: params.stop.role,
    detail: params.detail,
    planningStop: params.stop,
    fallbackSeed: undefined,
    curatedVenueById: EMPTY_CURATED_VENUE_BY_ID,
  })
}
