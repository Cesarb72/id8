import type { CrewProfile } from './intent'
import type { PriceTier, VenueCategory } from './venue'

export interface CrewPolicy {
  crew: CrewProfile
  preferredCategories: VenueCategory[]
  discouragedCategories: VenueCategory[]
  blockedCategories: VenueCategory[]
  preferredVibes?: string[]
  maxPriceTier: PriceTier
  targetEnergy: number
  hiddenGemBias: number
  wildcardBias: number
  diversityBias: number
  proximityStrictness: number
  windDownPreferredCategories: VenueCategory[]
  windDownAvoidCategories: VenueCategory[]
}
