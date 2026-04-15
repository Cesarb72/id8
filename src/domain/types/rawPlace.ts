import type { CrewProfile, VenueVibeTag } from './intent'
import type {
  NormalizedVenueSourceType,
  VenueSetting,
} from './normalization'
import type { HoursPeriod } from './hours'
import type { LiveDataProvider, VenueSourceOrigin } from './sourceMode'
import type {
  LocalSignals,
  PriceTier,
  RoleAffinity,
  VenueCategory,
} from './venue'

interface RawVenueBase {
  id: string
  name: string
  city?: string
  neighborhood?: string
  driveMinutes?: number
  priceTier?: PriceTier
  tags?: string[]
  shortDescription?: string
  narrativeFlavor?: string
  imageUrl?: string
  isActive?: boolean
  categoryHint?: VenueCategory
  subcategoryHint?: string
  sourceTypes?: string[]
  normalizedFromRawType?: NormalizedVenueSourceType
  sourceOrigin?: VenueSourceOrigin
  provider?: LiveDataProvider
  providerRecordId?: string
  sourceQueryLabel?: string
  queryTerms?: string[]
  sourceConfidence?: number
  formattedAddress?: string
  rating?: number
  ratingCount?: number
  openNow?: boolean
  businessStatus?: string
  hoursPeriods?: HoursPeriod[]
  regularOpeningHoursText?: string[]
  currentOpeningHoursText?: string[]
  utcOffsetMinutes?: number
  latitude?: number
  longitude?: number
  vibeTags?: VenueVibeTag[]
  useCases?: CrewProfile[]
  energyLevel?: number
  socialDensity?: number
  uniquenessScore?: number
  distinctivenessScore?: number
  underexposureScore?: number
  shareabilityScore?: number
  isHiddenGem?: boolean
  isChain?: boolean
  localSignals?: Partial<LocalSignals>
  roleAffinity?: Partial<RoleAffinity>
  settingHint?: VenueSetting
  familyFriendly?: boolean
  adultSocial?: boolean
  dateFriendly?: boolean
  eventCapable?: boolean
  musicCapable?: boolean
  performanceCapable?: boolean
}

export interface RawPlace extends RawVenueBase {
  rawType: 'place'
  placeTypes?: string[]
}

export interface RawEvent extends RawVenueBase {
  rawType: 'event'
  eventTypes?: string[]
}

export type RawVenueInput = RawPlace | RawEvent
