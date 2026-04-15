import type { CrewPolicy } from './crewPolicies'
import type { ExperienceLens } from './experienceLens'
import type { LensStopRole } from './experienceLens'
import type {
  AdventureRead,
  MusicSupportSource,
  VibePressureSource,
} from '../taste/computeVibeAuthority'
import type {
  TasteHyperlocalActivationType,
  TasteMomentIdentity,
  TasteSignals,
} from '../interpretation/taste/types'
import type { TasteExperienceLane, TasteModeAlignmentTier } from '../taste/selectTasteMode'
import type { HighlightValidityEvaluation } from './highlightValidity'
import type { IntentProfile } from './intent'
import type { MomentSourceType, MomentType } from './moment'
import type { RoutePacingAnalysis } from './pacing'
import type { RoleContractEvaluation } from './roleContract'
import type { SpatialCoherenceAnalysis } from './spatial'
import type { InternalRole, Venue } from './venue'

export interface VenueFitBreakdown {
  anchorFit: number
  crewFit: number
  proximityFit: number
  budgetFit: number
  uniquenessFit: number
  hiddenGemFit: number
}

export interface ScoredVenueCandidateIdentity {
  candidateId: string
  baseVenueId: string
  kind: 'base' | 'hyperlocal_activation' | 'moment'
  activationType?: TasteHyperlocalActivationType
  momentId?: string
  momentType?: MomentType
  momentSourceType?: MomentSourceType
  parentPlaceId?: string
  traceLabel: string
}

export interface ScoredVenue {
  venue: Venue
  candidateIdentity: ScoredVenueCandidateIdentity
  isAnchor?: boolean
  recoveredCentralMomentHighlight?: boolean
  centralMomentRecoveryReason?: string
  momentIdentity: TasteMomentIdentity
  fitBreakdown: VenueFitBreakdown
  fitScore: number
  hiddenGemScore: number
  lensCompatibility: number
  contextSpecificity: {
    overall: number
    personaSignal: number
    vibeSignal: number
    lensSignal: number
    byRole: Record<InternalRole, number>
  }
  dominanceControl: {
    universalityScore: number
    flaggedUniversal: boolean
    byRole: Record<InternalRole, number>
  }
  roleContract: Record<InternalRole, RoleContractEvaluation>
  stopShapeFit: Record<LensStopRole, number>
  vibeAuthority: {
    primary: number
    secondary: number
    overall: number
    packPressure: {
      highlight: number
    }
    byRole: Record<LensStopRole, number>
    pressureSource: {
      highlight: VibePressureSource
    }
    musicSupportSource: MusicSupportSource
    adventureRead: AdventureRead
    adventureReadScores: {
      outdoor: number
      urban: number
    }
    adventureNotes: string[]
  }
  highlightValidity: HighlightValidityEvaluation
  roleScores: Record<InternalRole, number>
  taste: {
    signals: TasteSignals
    modeAlignment: {
      score: number
      penalty: number
      lane: TasteExperienceLane
      tier: TasteModeAlignmentTier
      supportiveTagScore: number
      lanePriorityScore: number
    }
    fallbackPenalty: {
      signalScore: number
      appliedPenalty: number
      applied: boolean
      strongerAlternativePresent: boolean
      strongerAlternativeName?: string
      reason: string
    }
    rolePoolInfluence: Record<
      InternalRole,
      {
        tasteBonus: number
        roleSuitabilityContribution: number
        momentContribution: number
        highlightPlausibilityBonus: number
        modeAlignmentContribution: number
        modeAlignmentPenalty: number
      }
    >
  }
}

export interface ArcStop {
  role: InternalRole
  scoredVenue: ScoredVenue
}

export interface SurpriseTasteSignalsSnapshot {
  venueId: string
  venueName: string
  experientialFactor: number
  noveltyWeight: number
  roleSuitability: number
  supportingSignals: string[]
}

export interface SurpriseInjectionMetadata {
  candidateTier: 'strong' | 'nearStrong'
  gateProbability: number
  gateScore: number
  spatialScore: number
  scoreDeltaFromBase: number
  allowedTradeoff: number
  acceptanceBonusApplied: boolean
  acceptanceBonusValue: number
  selectionReason: string
  promotionOutcome?:
    | 'promoted_to_highlight'
    | 'held_constraint'
    | 'held_score'
    | 'held_role_invalid'
  promotionNote?: string
  demotedHighlightDisposition?: 'surprise' | 'removed'
  tasteSignals: SurpriseTasteSignalsSnapshot
}

export interface ArcScoreBreakdown {
  roleFlowScore: number
  diversityScore: number
  repeatedCategoryCount?: number
  categoryDiversityPenalty?: number
  categoryDiversityNotes?: string[]
  geographyScore: number
  spatialCoherenceScore?: number
  spatialBonus?: number
  spatialPenalty?: number
  hiddenGemLift: number
  windDownScore: number
  durationPacingScore?: number
  transitionSmoothnessScore?: number
  outingLengthScore?: number
  awkwardPacingPenalty?: number
  vibeCoherenceScore?: number
  highlightVibeScore?: number
  highlightMomentScore?: number
  momentStrengthScore?: number
  momentVarianceScore?: number
  momentFlatPenalty?: number
  missedPeakPenalty?: number
  missedPeakApplied?: boolean
  roleEnergyScore?: number
  roleEnergyPenalty?: number
  roleEnergyNote?: string
  strongMomentPresent?: boolean
  momentQualityNote?: string
  highlightValidityScore?: number
  arcContrastScore?: number
  highlightCenteringScore?: number
  discoveryContractScore?: number
  supportStopVibeScore?: number
  routeShapeBiasScore?: number
  alignmentPreservationScore?: number
  themeSpreadScore?: number
  themeSpreadPenalty?: number
  themeSpreadNote?: string
  romanticMomentContractScore?: number
  romanticMomentContractPenalty?: number
  romanticMomentCandidatesAvailable?: number
  romanticMomentCandidatesFeasible?: number
  romanticMomentPresent?: boolean
  romanticMomentRole?: InternalRole | 'none'
  strongestRomanticCandidateName?: string
  romanticContractScore?: number
  romanticContractPenalty?: number
  romanticContractSatisfied?: boolean
  romanticContractFeasible?: boolean
  romanticHighlightCandidatesFeasible?: number
  romanticHighlightArbitrationScore?: number
  romanticHighlightArbitrationPenalty?: number
  romanticHighlightArbitrationResult?:
    | 'romantic_highlight_won'
    | 'generic_cozy_highlight_won'
    | 'non_generic_highlight_won'
    | 'no_romantic_alternative_available'
  localSupplySufficient?: boolean
  strictNearbyFailed?: boolean
  stretchApplied?: boolean
  stretchReason?: string
  localStretchCandidateSetBasis?: string
  strictNearbyMeaningfulCount?: number
  boundedStretchMeaningfulCount?: number
  localSupplyDerivedFrom?: string
  strictNearbyFailedDerivedFrom?: string
  stretchedCandidateName?: string
  stretchedCandidateDistanceStatus?: string
  tasteModeAlignmentScore?: number
  tasteModePresencePenalty?: number
  tasteModeAlignedStopCount?: number
  tasteModeStrongAlignedStopCount?: number
  tasteModeAvailableAlignedCount?: number
  tasteModeAvailableStrongCount?: number
  liveRolePromotionScore?: number
  contractComplianceScore?: number
  contractViolationPenalty?: number
  contractOverrideApplied?: boolean
  contractOverrideRoles?: InternalRole[]
  fallbackHighlightSignal?: number
  fallbackHighlightPenalty?: number
  fallbackHighlightPenaltyApplied?: boolean
  fallbackHighlightReason?: string
  fallbackHighlightAlternativeName?: string
  familyCompetitionScore?: number
  familyCompetitionPenalty?: number
  familyCompetitionActive?: boolean
  familyCompetitionEligibleFamilies?: string[]
  familyCompetitionLeadingFamily?: string
  familyCompetitionTopSpread?: number
  familyCompetitionThreshold?: number
  familyCompetitionWinnerMode?:
    | 'single_family_only'
    | 'clear_family_lead'
    | 'competitive_field_best_family_won'
    | 'competitive_field_alternate_family_won'
    | 'competitive_field_non_competing_family_won'
  expressionWidth?: 'narrow' | 'moderate' | 'broad'
  expressionWidthReason?: string
  expressionWidthFamilyCount?: number
  expressionWidthCompetitiveFamilyCount?: number
  expressionWidthIntensitySpread?: number
  expressionWidthPeakPoolSize?: number
  expressionWidthFallbackReliance?: boolean
  expressionReleaseScore?: number
  expressionReleasePenalty?: number
  expressionReleaseEligible?: boolean
  expressionReleaseReason?: string
  expressionReleaseEliteCandidateNames?: string[]
  expressionReleaseEliteFamilies?: string[]
  expressionReleaseSelectedCandidateName?: string
  expressionReleaseSelectedFamily?: string
  expressionReleaseSelectionMode?:
    | 'clear_winner'
    | 'release_ineligible'
    | 'competitive_field_lead_held'
    | 'competitive_field_alternate_selected'
  expressionReleaseDecision?: string
  activationMomentElevationScore?: number
  activationMomentElevationPenalty?: number
  activationMomentElevationEligible?: boolean
  activationMomentElevationApplied?: boolean
  activationMomentElevationReason?: string
  activationMomentElevationCandidateNames?: string[]
  activationMomentElevationCandidateFamilies?: string[]
  activationMomentElevationTopCandidateName?: string
  activationMomentElevationTopCandidatePotential?: number
  activationMomentElevationWinnerElevated?: boolean
  fakeCompletenessPenalty?: number
  usedPartialArc?: boolean
  droppedWeakSupport?: boolean
  fakeCompletenessAvoided?: boolean
  recoveredCentralMomentHighlight?: boolean
  usedRecoveredCentralMomentHighlight?: boolean
  recoveredHighlightCandidatesCount?: number
  centralMomentRecoveryReason?: string
  returnedPartialArc?: boolean
  returnedHighlightOnlyArc?: boolean
  fullArcUnavailable?: boolean
  partialArcChosenReason?: string
  highlightDominanceApplied?: boolean
  highlightFamilyAlignmentApplied?: boolean
  highlightSupportPenaltyApplied?: boolean
  eliteFieldDiversified?: boolean
  eliteFieldDiversificationReason?: string
  eliteFieldDetectedLanes?: string[]
  eliteFieldLaneCandidates?: string[]
  eliteFieldCandidateNames?: string[]
  eliteFieldCandidateLanes?: string[]
}

export interface ArcCandidate {
  id: string
  stops: ArcStop[]
  totalScore: number
  scoreBreakdown: ArcScoreBreakdown
  pacing: RoutePacingAnalysis
  spatial: SpatialCoherenceAnalysis
  hasWildcard: boolean
  surpriseInjection?: SurpriseInjectionMetadata
}

export interface ArcAssemblySurpriseDiagnostics {
  surpriseCandidateCount: number
  surpriseCandidateTierBreakdown: {
    strong: number
    nearStrong: number
  }
  gateProbability: number
  generatedSurpriseArcCount: number
  comparedSurpriseArcTierBreakdown: {
    strong: number
    nearStrong: number
  }
  rejectedByProbabilityCount: number
  rejectedBySpatialCount: number
  rejectedBySpatialNearStrongCount: number
  rejectedByScoreCount: number
  bestRejectedScoreDelta?: number
  bestRejectedAllowedTradeoff?: number
  bestRejectedAcceptanceBonusValue?: number
}

export interface AnchorArcTraceDiagnostics {
  anchorRole?: InternalRole
  anchorVenueId?: string
  anchorGeographyRelaxed: boolean
  geographyViolationCount: number
  preValidationAnchorArcCount: number
  postValidationAnchorArcCount: number
  postPruneAnchorArcCount: number
  invalidatedAnchorArcCount: number
  invalidatedAnchorArcReasons: Record<string, number>
  anchorArcTrimmedByTopN: boolean
  anchorArcTrimmedByWhichStage?: string
  bestPreValidationAnchorArcId?: string
  bestPreValidationAnchorArcScore?: number
  bestValidatedAnchorArcId?: string
  bestValidatedAnchorArcScore?: number
  bestPrunedAnchorArcId?: string
  bestPrunedAnchorArcScore?: number
}

export interface AssembleArcCandidatesResult {
  candidates: ArcCandidate[]
  surpriseDiagnostics: ArcAssemblySurpriseDiagnostics
  anchorTrace?: AnchorArcTraceDiagnostics
}

export interface StopAlternative {
  scoredVenue: ScoredVenue
  score: number
  reason: string
}

export type StopAlternativeKind = 'swap' | 'nearby'

export interface ArcBuildContext {
  intent: IntentProfile
  crewPolicy: CrewPolicy
  lens: ExperienceLens
}
