import { scoreLensCompatibility } from './scoreLensCompatibility'
import type { ExperienceLens } from '../types/experienceLens'
import type { IntentProfile } from '../types/intent'
import type { Venue } from '../types/venue'

export interface LensShapedVenue {
  venue: Venue
  lensCompatibility: number
}

export function applyLensToVenue(
  venue: Venue,
  intent: IntentProfile,
  lens: ExperienceLens,
): LensShapedVenue {
  return {
    venue,
    lensCompatibility: scoreLensCompatibility(venue, intent, lens),
  }
}
