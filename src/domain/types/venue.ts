import type { CrewProfile, VenueVibeTag } from './intent'
import type {
  VenueCapabilitySignals,
  VenueDurationProfile,
  VenueSignatureSignals,
  VenueSourceMetadata,
} from './normalization'

export type VenueCategory =
  | 'restaurant'
  | 'bar'
  | 'cafe'
  | 'dessert'
  | 'live_music'
  | 'activity'
  | 'park'
  | 'museum'
  | 'event'

export type PriceTier = '$' | '$$' | '$$$' | '$$$$'

export type InternalRole = 'warmup' | 'peak' | 'wildcard' | 'cooldown'

export interface LocalSignals {
  localFavoriteScore: number
  neighborhoodPrideScore: number
  repeatVisitorScore: number
}

export type RoleAffinity = Record<InternalRole, number>

export interface Venue {
  id: string
  name: string
  city: string
  neighborhood: string
  driveMinutes: number
  category: VenueCategory
  subcategory: string
  priceTier: PriceTier
  tags: string[]
  useCases: CrewProfile[]
  vibeTags: VenueVibeTag[]
  energyLevel: number
  socialDensity: number
  uniquenessScore: number
  distinctivenessScore: number
  underexposureScore: number
  shareabilityScore: number
  isChain: boolean
  localSignals: LocalSignals
  roleAffinity: RoleAffinity
  imageUrl: string
  shortDescription: string
  narrativeFlavor: string
  isHiddenGem: boolean
  isActive: boolean
  highlightCapable: boolean
  durationProfile: VenueDurationProfile
  settings: VenueCapabilitySignals
  signature: VenueSignatureSignals
  source: VenueSourceMetadata
}
