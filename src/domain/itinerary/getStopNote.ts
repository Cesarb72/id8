import type { ExperienceLens } from '../types/experienceLens'
import type { UserStopRole } from '../types/itinerary'
import type { Venue } from '../types/venue'

export function getStopNote(
  role: UserStopRole,
  venue: Venue,
  lens?: ExperienceLens,
): string | undefined {
  if (role === 'surprise') {
    return venue.isHiddenGem
      ? 'Local pick with lower exposure and high discovery payoff.'
      : 'A curveball stop chosen to add variety.'
  }
  if (role === 'windDown' && venue.energyLevel <= 2) {
    if (lens?.tone === 'intimate') {
      return 'A softer close designed for lingering and a clean landing.'
    }
    return 'A calmer close to end on a polished note.'
  }
  if (role === 'highlight' && venue.category === 'restaurant') {
    return 'Best for lingering and making this the centerpiece.'
  }
  return undefined
}
