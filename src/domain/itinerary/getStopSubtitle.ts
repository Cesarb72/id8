import type { ExperienceLens } from '../types/experienceLens'
import type { UserStopRole } from '../types/itinerary'
import type { Venue } from '../types/venue'

export function getStopSubtitle(
  role: UserStopRole,
  venue: Venue,
  lens?: ExperienceLens,
): string {
  if (role === 'start') {
    if (lens?.tone === 'intimate') {
      return `Settle in at ${venue.name} with a quieter, confident opening.`
    }
    if (lens?.tone === 'electric') {
      return `Kick things off at ${venue.name} to set social momentum early.`
    }
    return `Ease in at ${venue.name} for a confident opening move.`
  }
  if (role === 'highlight') {
    if (lens?.tone === 'electric') {
      return `${venue.name} drives the main burst of energy for this route.`
    }
    return `${venue.name} carries the main moment with strong local flavor.`
  }
  if (role === 'surprise') {
    if (lens?.discoveryBias === 'high') {
      return `${venue.name} adds a discovery-heavy twist that still fits the plan.`
    }
    return `${venue.name} adds an unexpected layer without breaking the flow.`
  }
  if (lens?.tone === 'refined') {
    return `${venue.name} lands the route with an easy, polished finish.`
  }
  return `${venue.name} brings a graceful finish to close things out.`
}
