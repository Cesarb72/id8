import type { HoursPeriod } from '../types/hours'
import type { EngineSourceMode } from '../types/sourceMode'

export interface ProviderVenueLocation {
  latitude: number
  longitude: number
}

export interface ProviderVenueOpeningHours {
  openNow?: boolean
  weekdayDescriptions?: string[]
  periods?: HoursPeriod[]
}

export interface ProviderVenueCompletenessHints {
  hasAddress: boolean
  hasLocation: boolean
  hasHours: boolean
  hasPrimaryType: boolean
  hasRating: boolean
}

// ProviderVenue is the Field-owned provider-normalized shape. It is not engine-ready and
// must be converted into RawPlace/Venue before crossing into Interpretation/Bearings.
export interface ProviderVenue {
  provider: 'google_places'
  providerRecordId: string
  displayName: string
  formattedAddress?: string
  shortFormattedAddress?: string
  primaryType?: string
  types?: string[]
  editorialSummary?: string
  businessStatus?: string
  currentOpeningHours?: ProviderVenueOpeningHours
  regularOpeningHours?: ProviderVenueOpeningHours
  rating?: number
  userRatingCount?: number
  websiteUri?: string
  utcOffsetMinutes?: number
  location?: ProviderVenueLocation
  sourceMode: Extract<EngineSourceMode, 'live'>
  rawPayloadAvailable: false
  fetchedAt: number
  completenessHints: ProviderVenueCompletenessHints
}
