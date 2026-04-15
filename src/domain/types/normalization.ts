import type { DurationClass } from './pacing'
import type { BusinessStatus, HoursPressureLevel } from './hours'
import type { LiveDataProvider, VenueSourceOrigin } from './sourceMode'

export type NormalizedVenueSourceType = 'seed' | 'raw-place' | 'raw-event'

export type HighlightCapabilityTier = 'highlight-capable' | 'support-only' | 'connective-only'

export type VenueSetting = 'indoor' | 'outdoor' | 'hybrid'

export type VenueRouteFootprint = 'compact' | 'neighborhood-hop' | 'destination'

export type QualityGateStatus = 'approved' | 'demoted' | 'suppressed'

export interface VenueHappeningsSignals {
  hotspotStrength: number
  eventPotential: number
  performancePotential: number
  liveNightlifePotential: number
  culturalAnchorPotential: number
  lateNightPotential: number
  currentRelevance: number
  hiddenGemStrength: number
  majorVenueStrength: number
}

export interface VenueCapabilitySignals {
  socialDensity: number
  highlightCapabilityTier: HighlightCapabilityTier
  highlightConfidence: number
  supportOnly: boolean
  connectiveOnly: boolean
  setting: VenueSetting
  familyFriendly: boolean
  adultSocial: boolean
  dateFriendly: boolean
  eventCapable: boolean
  musicCapable: boolean
  performanceCapable: boolean
  routeFootprint: VenueRouteFootprint
}

export interface VenueSignatureSignals {
  chainLike: boolean
  genericScore: number
  signatureScore: number
}

export interface VenueDurationProfile {
  durationClass: DurationClass
  estimatedMinutes: number
}

export interface VenueSourceMetadata {
  normalizedFromRawType: NormalizedVenueSourceType
  sourceOrigin: VenueSourceOrigin
  provider?: LiveDataProvider
  providerRecordId?: string
  formattedAddress?: string
  latitude?: number
  longitude?: number
  sourceQueryLabel?: string
  sourceConfidence: number
  completenessScore: number
  qualityScore: number
  openNow?: boolean
  hoursKnown: boolean
  likelyOpenForCurrentWindow: boolean
  businessStatus: BusinessStatus
  timeConfidence: number
  hoursPressureLevel: HoursPressureLevel
  hoursPressureNotes: string[]
  hoursDemotionApplied: boolean
  hoursSuppressionApplied: boolean
  sourceTypes: string[]
  missingFields: string[]
  inferredFields: string[]
  qualityGateStatus: QualityGateStatus
  qualityGateNotes: string[]
  approvalBlockers: string[]
  demotionReasons: string[]
  suppressionReasons: string[]
  happenings?: VenueHappeningsSignals
}

export interface QualityGateDecision {
  status: QualityGateStatus
  qualityScore: number
  notes: string[]
  approvalBlockers: string[]
  demotionReasons: string[]
  suppressionReasons: string[]
  hoursDemotionApplied: boolean
  hoursSuppressionApplied: boolean
}

export interface ExcludedVenueDiagnostics {
  venueId: string
  venueName: string
  sourceOrigin: VenueSourceOrigin
  provider?: LiveDataProvider
  qualityGateStatus: QualityGateStatus
  sourceConfidence: number
  completenessScore: number
  normalizedCategory?: string
  reasons: string[]
}
