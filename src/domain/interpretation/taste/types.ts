import type { VenueSetting } from '../../types/normalization'

export type TasteRole = 'start' | 'highlight' | 'windDown' | 'surprise'

export type TasteVenueCategory =
  | 'restaurant'
  | 'bar'
  | 'cafe'
  | 'dessert'
  | 'live_music'
  | 'activity'
  | 'park'
  | 'museum'
  | 'event'

export type TastePriceLevel = '$' | '$$' | '$$$' | '$$$$'

export type TasteHoursStatus =
  | 'open'
  | 'likely_open'
  | 'uncertain'
  | 'likely_closed'
  | 'closed'
  | 'unknown'

export interface SeedCalibratedTasteProfile {
  energy: number
  socialDensity: number
  intimacy: number
  lingerFactor: number
  destinationFactor: number
  experientialFactor: number
  conversationFriendliness: number
}

export interface TasteHappeningsSignals {
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

export interface NormalizedVenueTasteInput {
  id: string
  name: string
  category: TasteVenueCategory
  subcategory?: string
  tags: string[]
  placeTypes?: string[]
  setting?: VenueSetting
  eventCapable?: boolean
  musicCapable?: boolean
  performanceCapable?: boolean
  highlightCapable?: boolean
  rating?: number
  reviewCount?: number
  priceLevel?: TastePriceLevel
  neighborhood?: string
  liveSource: boolean
  sourceConfidence: number
  qualityScore: number
  signatureStrength: number
  hoursStatus?: TasteHoursStatus
  hoursConfidence?: number
  editorialSummary?: string
  userReviewSnippets?: string[]
  seedCalibratedProfile?: SeedCalibratedTasteProfile
  happenings?: TasteHappeningsSignals
  hotspotStrength?: number
  eventPotential?: number
  performancePotential?: number
  liveNightlifePotential?: number
  culturalAnchorPotential?: number
  lateNightPotential?: number
  currentRelevance?: number
  hiddenGemStrength?: number
  majorVenueStrength?: number
}

export interface TasteRoleSuitability {
  start: number
  highlight: number
  windDown: number
  surprise: number
}

export interface TasteRoleAdjustments {
  start: number
  highlight: number
  windDown: number
  surprise: number
}

// Lower numeric tier means a stronger highlight read.
// Tier 1 = Signature, Tier 2 = Strong support, Tier 3 = Connector.
export type TasteHighlightTier = 1 | 2 | 3

export type TasteDurationEstimate = 'quick' | 'moderate' | 'extended' | 'event'

export type TasteVenuePersonalityTag =
  | 'intimate'
  | 'social'
  | 'destination'
  | 'lingering'
  | 'quick_stop'
  | 'experiential'

export interface TasteVenuePersonality {
  tags: TasteVenuePersonalityTag[]
}

export type TasteExperienceArchetype =
  | 'dining'
  | 'drinks'
  | 'sweet'
  | 'outdoor'
  | 'activity'
  | 'culture'
  | 'scenic'
  | 'social'

export type TasteExperienceFamily = string

export type TasteMomentPotentialSource = 'none' | 'inferred' | 'real'

export interface TasteMomentPotential {
  score: number
  source: TasteMomentPotentialSource
}

export type TasteMomentType =
  | 'arrival'
  | 'explore'
  | 'anchor'
  | 'linger'
  | 'transition'
  | 'close'

export type TasteMomentStrength = 'strong' | 'medium' | 'light'

export interface TasteMomentIdentity {
  type: TasteMomentType
  strength: TasteMomentStrength
}

export type TasteMomentIntensityTier =
  | 'standard'
  | 'strong'
  | 'exceptional'
  | 'signature'

export interface TasteMomentIntensity {
  score: number
  tier: TasteMomentIntensityTier
  drivers: string[]
}

export type TasteMomentTier = 'anchor' | 'builder' | 'support'

export interface TasteMomentEnrichment {
  temporalEnergy: number
  socialEnergy: number
  ambientUniqueness: number
  culturalDepth: number
  highlightSurfaceBoost: number
  signals: string[]
}

export type TasteHyperlocalActivationType =
  | 'live_performance'
  | 'social_ritual'
  | 'tasting_activation'
  | 'cultural_activation'
  | 'seasonal_market'
  | 'ambient_activation'

export type TasteHyperlocalRecurrenceShape =
  | 'programmed'
  | 'recurring'
  | 'seasonal'
  | 'ambient'

export type TasteHyperlocalTemporalLabel = 'background' | 'timely' | 'active'

export type TasteTemporalPresenceState = 'none' | 'implicit' | 'explicit'

export type TasteTemporalWindow = 'day' | 'evening' | 'late' | 'flexible'

export type TasteHyperlocalContractHint =
  | 'romantic_ambient'
  | 'culture_highlight'
  | 'curated_highlight'
  | 'social_highlight'
  | 'cozy_anchor'

export interface TasteHyperlocalInterpretationImpact {
  highlightSuitability: number
  momentPotential: number
  novelty: number
  momentIntensity: number
  familyRefinements: string[]
}

export interface TasteHyperlocalTemporalCompatibility {
  timePresenceState: TasteTemporalPresenceState
  contextWindow?: TasteTemporalWindow
  activationWindow?: TasteTemporalWindow
  roleAdjustments: TasteRoleAdjustments
  materiallyChangesViability: boolean
  signals: string[]
}

export interface TasteHyperlocalActivation {
  activationTypes: TasteHyperlocalActivationType[]
  primaryActivationType?: TasteHyperlocalActivationType
  temporalRelevance: number
  temporalLabel: TasteHyperlocalTemporalLabel
  recurrenceShape?: TasteHyperlocalRecurrenceShape
  intensityContribution: number
  contractCompatibilityHints: TasteHyperlocalContractHint[]
  interpretationImpact: TasteHyperlocalInterpretationImpact
  temporalCompatibility: TasteHyperlocalTemporalCompatibility
  signals: string[]
  materiallyChangesHighlightPotential: boolean
  materiallyChangesInterpretation: boolean
}

export interface TasteInterpretationContext {
  timeWindow?: string
  persona?: 'romantic' | 'friends' | 'family' | null
  vibe?:
    | 'cozy'
    | 'lively'
    | 'playful'
    | 'cultured'
    | 'chill'
    | 'adventurous-outdoor'
    | 'adventurous-urban'
    | null
}

export interface TasteRomanticSignals {
  intimacy: number
  ambiance: number
  scenic: number
  sharedActivity: number
  ambientExperience: number
}

export type TasteRomanticFlavor =
  | 'intimate'
  | 'scenic'
  | 'playful'
  | 'ambient'
  | 'mixed'
  | 'none'

export interface TasteDebugMetadata {
  sourceMode: 'seed_calibrated' | 'rule_inferred' | 'hybrid'
  supportingSignals: string[]
  confidence: number
  seedCalibratedApplied: boolean
  interpretationStrategy: 'seed_calibrated' | 'rule_inferred' | 'hybrid'
}

export interface TasteSignals {
  energy: number
  socialDensity: number
  intimacy: number
  lingerFactor: number
  destinationFactor: number
  experientialFactor: number
  conversationFriendliness: number
  outdoorStrength: number
  interactiveStrength: number
  roleSuitability: TasteRoleSuitability
  highlightTier: TasteHighlightTier
  durationEstimate: TasteDurationEstimate
  venuePersonality: TasteVenuePersonality
  experienceArchetypes: TasteExperienceArchetype[]
  primaryExperienceArchetype: TasteExperienceArchetype
  baseExperienceFamily: TasteExperienceFamily
  experienceFamily: TasteExperienceFamily
  experienceFamilyExpanded: boolean
  experienceFamilyExpansionReason?: string
  momentElevationPotential: number
  isElevatedMomentCandidate: boolean
  momentElevationReason?: string
  momentPotential: TasteMomentPotential
  momentIdentity: TasteMomentIdentity
  momentIntensity: TasteMomentIntensity
  momentTier: TasteMomentTier
  momentEnrichment: TasteMomentEnrichment
  hyperlocalActivation: TasteHyperlocalActivation
  romanticSignals: TasteRomanticSignals
  romanticScore: number
  romanticFlavor: TasteRomanticFlavor
  isRomanticMomentCandidate: boolean
  noveltyWeight: number
  categorySpecificity: number
  personalityStrength: number
  anchorStrength: number
  debug: TasteDebugMetadata
}

export type DetectedMomentType =
  | 'anchor'
  | 'supporting'
  | 'temporal'
  | 'discovery'
  | 'community'

export interface DetectedMoment {
  id: string
  title: string
  venueId?: string
  districtId?: string
  sourceType: 'venue' | 'event' | 'hybrid'
  momentType: DetectedMomentType
  strength: number
  timingRelevance: number
  intentFit: number
  roleFit: {
    start: number
    highlight: number
    windDown: number
  }
  reason: string
  descriptors?: {
    energy?: string
    tone?: string
    pacing?: string
  }
  liveContext?: {
    hasEvent?: boolean
    hasHappyHour?: boolean
    hasPerformance?: boolean
    timeWindowLabel?: string
  }
}
