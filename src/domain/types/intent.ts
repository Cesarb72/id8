import type { RefinementMode } from './refinement'

export type PersonaMode = 'romantic' | 'friends' | 'family'
export type PersonaSource = 'explicit' | 'derived'
export type CrewProfile = 'romantic' | 'socialite' | 'curator'
export type DistanceMode = 'nearby' | 'short-drive'
export type BudgetPreference = 'value' | 'balanced' | 'premium'
export type ExperienceMode = 'surprise' | 'curate' | 'build'
export type PlanningMode = 'engine-led' | 'user-led'
export type DiscoveryPreferenceRole = 'start' | 'highlight' | 'windDown'
export type AnchorRole = 'start' | 'highlight' | 'windDown'
export type RouteShapeRole = DiscoveryPreferenceRole

export type RouteShapeArcShape =
  | 'fast_open_strong_center_clean_landing'
  | 'steady_open_curated_center_soft_landing'
  | 'focused_open_social_center_clean_landing'

export type RouteShapeEnergyLevel = 'low' | 'medium' | 'high'
export type RouteShapePacing = 'quick' | 'balanced' | 'linger'
export type RouteShapeVariability = 'fixed' | 'guided-flex' | 'flexible'
export type RouteInvariantTrait =
  | 'low_friction'
  | 'centerpiece'
  | 'settling'
  | 'late_night'
  | 'lively'
  | 'calm'
  | 'social'
  | 'cultural'
  | 'buffer'
  | 'contrast'
  | 'continuity'
export type RouteInvariantIntensity = 'low' | 'medium' | 'high'
export type RouteInvariantMaxRelativeIntensity =
  | RouteInvariantIntensity
  | 'below_highlight'
  | 'at_most_highlight'

export interface RoleProfile {
  intent: 'set-tone' | 'centerpiece' | 'landing'
  energyLevel: RouteShapeEnergyLevel
  pacing: RouteShapePacing
  variability: RouteShapeVariability
}

export interface RoleInvariantProfile {
  requiredTraits: RouteInvariantTrait[]
  preferredTraits: RouteInvariantTrait[]
  forbiddenTraits: RouteInvariantTrait[]
  minRelativeIntensity?: RouteInvariantIntensity
  maxRelativeIntensity?: RouteInvariantMaxRelativeIntensity
  allowSwapToWeaker: boolean
  allowEscalation: boolean
}

export interface RouteRoleInvariants {
  start: RoleInvariantProfile
  highlight: RoleInvariantProfile
  windDown: RoleInvariantProfile
  surprise?: RoleInvariantProfile
  support?: RoleInvariantProfile
}

export interface RouteShapeContract {
  id: string
  arcShape: RouteShapeArcShape
  roleProfile: Record<RouteShapeRole, RoleProfile>
  roleInvariants: RouteRoleInvariants
  movementProfile: {
    radius: 'tight' | 'balanced' | 'open'
    maxTransitionMinutes: number
    neighborhoodContinuity: 'strict' | 'preferred' | 'flexible'
  }
  mutationProfile: {
    swapFlexibility: 'low' | 'medium' | 'high'
    allowedRoles: RouteShapeRole[]
    preservePriority: Array<'role' | 'feasibility' | 'district' | 'family' | 'movement'>
  }
  expansionProfile: {
    supportsNearbyExtensions: boolean
    preferredExpansionRole: RouteShapeRole
    lateNightTolerance: 'low' | 'medium' | 'high'
  }
}

export type ConciergeIntentMode = 'surprise' | 'curated' | 'direct' | 'anchored' | 'search_led'
export type ConciergeControlPostureMode = 'assistant_led' | 'guided_assist' | 'user_directed'
export type ConciergeObjectivePrimary =
  | 'discover_route_shape'
  | 'stabilize_selected_direction'
  | 'lock_anchor_and_sequence'
  | 'preserve_route_integrity'
  | 'search_and_route'
export type ConciergeExperiencePacing = 'quick' | 'balanced' | 'linger'
export type ConciergeSocialEnergy = 'low' | 'medium' | 'high'
export type ConciergeExplorationTolerance = 'low' | 'medium' | 'high'
export type ConciergeAnchorPostureMode = 'none' | 'soft' | 'hard'
export type ConciergeAnchorType = 'none' | 'venue' | 'district' | 'time'
export type ConciergeTravelTolerance = 'tight' | 'balanced' | 'flexible'
export type ConciergeStructureRigidity = 'tight' | 'balanced' | 'flexible'
export type ConciergeSwapTolerance = 'low' | 'medium' | 'high'
export type ConciergeRealityPriority = 'low' | 'medium' | 'high'

export interface ConciergeIntent {
  id: string
  intentMode: ConciergeIntentMode
  objective: {
    primary: ConciergeObjectivePrimary
  }
  controlPosture: {
    mode: ConciergeControlPostureMode
  }
  experienceProfile: {
    persona: PersonaMode
    vibe: VibeAnchor
    pacing: ConciergeExperiencePacing
    socialEnergy: ConciergeSocialEnergy
    explorationTolerance: ConciergeExplorationTolerance
  }
  anchorPosture: {
    mode: ConciergeAnchorPostureMode
    anchorType: ConciergeAnchorType
    anchorValue?: string
    roleHint?: AnchorRole
    timeBound?: string
  }
  constraintPosture: {
    travelTolerance: ConciergeTravelTolerance
    structureRigidity: ConciergeStructureRigidity
    swapTolerance: ConciergeSwapTolerance
  }
  realityPosture: {
    liveSignalPriority: ConciergeRealityPriority
    coherencePriority: ConciergeRealityPriority
    noveltyPriority: ConciergeRealityPriority
    certaintyPriority: ConciergeRealityPriority
  }
}

export type ExperienceContractCoordinationMode =
  | 'depth'
  | 'pulse'
  | 'narrative'
  | 'hang'
  | 'momentum'
  | 'enrichment'
  | 'balance'
  | 'play'

export type ExperienceContractHighlightModel =
  | 'single_peak'
  | 'multi_peak'
  | 'cumulative'
  | 'distributed'

export type ExperienceContractHighlightType =
  | 'destination_dining'
  | 'experiential'
  | 'thematic_culmination'
  | 'social_anchor'
  | 'distributed_social'
  | 'learning_anchor'
  | 'play_peak'

export type ExperienceContractMovementStyle =
  | 'contained'
  | 'momentum'
  | 'curated_progression'
  | 'compressed'
  | 'exploratory'

export type ExperienceContractSocialPosture =
  | 'intimate'
  | 'balanced'
  | 'group_internal'
  | 'social'
  | 'family_unit'
  | 'parallel_tracks'

export type ExperienceContractPacingStyle =
  | 'slow_linger'
  | 'dynamic'
  | 'structured_acts'
  | 'steady'
  | 'burst_reset'

export type ExperienceContractActPattern =
  | 'connection_build'
  | 'earned_centerpiece'
  | 'soft_landing'
  | 'energy_injection'
  | 'pulse_build'
  | 'peak'
  | 'late_taper'
  | 'discovery_anchor'
  | 'thematic_deepen'
  | 'culmination'
  | 'reflective_close'
  | 'easy_entry'
  | 'settle_in'
  | 'optional_anchor'
  | 'elastic_close'
  | 'basecamp_or_injection'
  | 'escalation'
  | 'distributed_peaks'
  | 'ritual_reset'
  | 'anchor_one'
  | 'debrief'
  | 'anchor_two'
  | 'conversation_close'
  | 'engage'
  | 'recover'
  | 'easy_taper'
  | 'high_engagement'
  | 'reset'
  | 'reengage'
  | 'tired_happy_close'
  | 'learning_anchor'
  | 'decompression'
  | 'secondary_enrichment'
  | 'reflective_taper'

export interface ExperienceContractConstraintPriority {
  logistics: 'low' | 'medium' | 'high'
  biologicalRhythm: 'low' | 'medium' | 'high'
  adultPayoffRequired: boolean
  recoveryNodesRequired: boolean
  lateNightAllowed: boolean
}

export interface ExperienceContractVenuePressure {
  demandStrongCenterpiece: boolean
  allowDistributedHighlight: boolean
  requireCulturalAnchor: boolean
  requireGroupBasecamp: boolean
  requireKidEngagement: boolean
}

export interface ExperienceContract {
  id: string
  persona: PersonaMode
  vibe: VibeAnchor
  coordinationMode: ExperienceContractCoordinationMode
  contractIdentity: string
  summary: string
  actStructure: {
    actCount: number
    actPattern: ExperienceContractActPattern[]
  }
  highlightModel: ExperienceContractHighlightModel
  highlightType: ExperienceContractHighlightType
  movementStyle: ExperienceContractMovementStyle
  socialPosture: ExperienceContractSocialPosture
  pacingStyle: ExperienceContractPacingStyle
  constraintPriority: ExperienceContractConstraintPriority
  venuePressure: ExperienceContractVenuePressure
  debug: {
    derivedFrom: string[]
    contractReasonSummary: string
  }
}

export type ContractConstraintPeakCountModel = 'single' | 'multi' | 'distributed' | 'cumulative'
export type ContractConstraintEnergyDropTolerance = 'low' | 'medium' | 'high'
export type ContractConstraintSocialDensityBand = 'low' | 'medium' | 'medium_high' | 'high'
export type ContractConstraintMovementTolerance = 'contained' | 'compressed' | 'moderate' | 'exploratory'
export type ContractConstraintWindDownStrictness = 'soft_required' | 'controlled' | 'flexible'
export type ContractConstraintHighlightPressure = 'strong' | 'moderate' | 'distributed'

export interface ContractConstraints {
  id: string
  experienceContractId: string
  peakCountModel: ContractConstraintPeakCountModel
  requireEscalation: boolean
  requireContinuity: boolean
  requireRecoveryWindows: boolean
  maxEnergyDropTolerance: ContractConstraintEnergyDropTolerance
  socialDensityBand: ContractConstraintSocialDensityBand
  movementTolerance: ContractConstraintMovementTolerance
  allowLateHighEnergy: boolean
  windDownStrictness: ContractConstraintWindDownStrictness
  highlightPressure: ContractConstraintHighlightPressure
  multiAnchorAllowed: boolean
  groupBasecampPreferred: boolean
  kidEngagementRequired: boolean
  adultPayoffRequired: boolean
  debug: {
    derivedFrom: string[]
    constraintReasonSummary: string
  }
}

export interface PreferredDiscoveryVenue {
  venueId: string
  role: DiscoveryPreferenceRole
}

export interface PlanAnchor {
  venueId: string
  role?: AnchorRole
}

export type VibeAnchor =
  | 'cozy'
  | 'lively'
  | 'playful'
  | 'cultured'
  | 'chill'
  | 'adventurous-outdoor'
  | 'adventurous-urban'

export type VenueVibeTag =
  | VibeAnchor
  | 'culinary'
  | 'creative'
  | 'culture'
  | 'outdoors'
  | 'relaxed'

export type VibeOption = {
  value: VibeAnchor
  label: string
  sublabel: string
}

export type DirectionExperienceFamily =
  | 'social'
  | 'cultural'
  | 'playful'
  | 'intimate'
  | 'exploratory'
  | 'ambient'
  | 'eventful'
  | 'ritual'
  | 'indulgent'

export type DirectionIdentity = 'social' | 'exploratory' | 'intimate'

export type GreatStopFailureCriterion =
  | 'real'
  | 'role_right'
  | 'intent_right'
  | 'place_right'
  | 'moment_right'

export type GreatStopRiskTier = 'none' | 'warning' | 'severe'

export interface GreatStopDownstreamSignal {
  source: 'scenario_great_stop'
  available: boolean
  passesNight: boolean
  totalStopCount: number
  failedStopCount: number
  severeFailureCount: number
  failedCriteriaCounts: Record<GreatStopFailureCriterion, number>
  severeCriteriaCounts: Record<Extract<GreatStopFailureCriterion, 'real' | 'place_right' | 'moment_right'>, number>
  riskTier: GreatStopRiskTier
  suppressionRecommended: boolean
  degradedConfidencePenalty: number
  reasonCodes: string[]
  notes: string[]
}

export interface SelectedDirectionContext {
  directionId?: string
  label?: string
  pocketId?: string
  archetype?: string
  identity?: DirectionIdentity
  subtitle?: string
  reasons?: string[]
  family?: DirectionExperienceFamily
  familyConfidence?: number
  cluster?: 'lively' | 'chill' | 'explore'
  greatStopSignal?: GreatStopDownstreamSignal
}

export interface ResolvedDirectionContext {
  selectedDirectionId: string
  selectedPocketId: string
  label: string
  archetype: string
  identity?: DirectionIdentity
  greatStopSignal?: GreatStopDownstreamSignal
}

export const vibeOptions: VibeOption[] = [
  { value: 'cozy', label: 'Cozy', sublabel: 'warm | intimate | relaxed' },
  { value: 'lively', label: 'Lively', sublabel: 'energetic | social | buzzing' },
  { value: 'playful', label: 'Playful', sublabel: 'fun | active | interactive' },
  { value: 'cultured', label: 'Cultured', sublabel: 'arts | music | thoughtful' },
  { value: 'chill', label: 'Chill', sublabel: 'easygoing | casual | low-pressure' },
  {
    value: 'adventurous-outdoor',
    label: 'Adventurous (Outdoor)',
    sublabel: 'scenic | open-air | exploratory',
  },
  {
    value: 'adventurous-urban',
    label: 'Adventurous (Urban)',
    sublabel: 'local | wandering | discovery',
  },
]

const vibeLabels: Record<VibeAnchor | VenueVibeTag, string> = {
  cozy: 'Cozy',
  lively: 'Lively',
  playful: 'Playful',
  cultured: 'Cultured',
  chill: 'Chill',
  'adventurous-outdoor': 'Adventurous (Outdoor)',
  'adventurous-urban': 'Adventurous (Urban)',
  culinary: 'Culinary',
  creative: 'Creative',
  culture: 'Culture',
  outdoors: 'Outdoors',
  relaxed: 'Relaxed',
}

export function getVibeLabel(value: VibeAnchor | VenueVibeTag): string {
  return vibeLabels[value]
}

export function getVibeSublabel(value: VibeAnchor): string {
  return vibeOptions.find((option) => option.value === value)?.sublabel ?? ''
}

export interface IntentInput {
  persona: PersonaMode | null
  primaryVibe: VibeAnchor | null
  secondaryVibe?: VibeAnchor
  city: string
  district?: string
  neighborhood?: string
  distanceMode: DistanceMode
  budget?: BudgetPreference
  startTime?: string
  timeWindow?: string
  prefersHiddenGems?: boolean
  refinementModes?: RefinementMode[]
  mode?: ExperienceMode
  planningMode?: PlanningMode
  anchor?: PlanAnchor
  discoveryPreferences?: PreferredDiscoveryVenue[]
  selectedDirectionContext?: SelectedDirectionContext
}

export interface IntentProfile {
  crew: CrewProfile
  persona?: PersonaMode | null
  personaSource?: PersonaSource
  primaryAnchor: VibeAnchor
  secondaryAnchors?: VibeAnchor[]
  city: string
  district?: string
  neighborhood?: string
  distanceMode: DistanceMode
  budget?: BudgetPreference
  timeWindow?: string
  prefersHiddenGems: boolean
  refinementModes?: RefinementMode[]
  mode: ExperienceMode
  planningMode: PlanningMode
  anchor?: Required<PlanAnchor>
  discoveryPreferences?: PreferredDiscoveryVenue[]
  selectedDirectionContext?: SelectedDirectionContext
}
