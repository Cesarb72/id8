import type { RefinementMode } from './refinement'
import type { RefinementOutcome } from './refinementOutcome'
import type { BoundaryDiagnostics, OverlapDiagnostics } from './boundaryDiagnostics'
import type { HighlightCandidateTier, HighlightValidityLevel } from './highlightValidity'
import type { BusinessStatus, HoursPressureLevel } from './hours'
import type { ConstraintTraceEntry, TemporalTrace } from './constraints'
import type { ExcludedVenueDiagnostics, QualityGateStatus } from './normalization'
import type { DurationClass, RouteContinuity, RouteMovementMode } from './pacing'
import type { LiveDataProvider, SourceMode, VenueSourceOrigin } from './sourceMode'
import type {
  DistrictAnchor,
  DistrictAnchorSource,
  DistrictRecommendation,
} from './district'
import type { SpatialCoherenceAnalysis } from './spatial'
import type { UserStopRole } from './itinerary'
import type {
  AnchorHoursRelaxationReason,
  AnchorAdmissionFailureReason,
  PreferredDiscoveryAdmissionRejectionReason,
  RoleContractStrength,
} from './roleContract'
import type {
  TasteDebugMetadata,
  TasteDurationEstimate,
  TasteHighlightTier,
  TasteRoleSuitability,
} from '../interpretation/taste/types'

export type FallbackRelaxationLevel = 'none' | 'lens-soft' | 'lens-off'
export type SelectionStrengthLabel =
  | 'Strong fit'
  | 'Acceptable fit'
  | 'Limited local options'
  | 'Fallback pick'

export interface RolePoolCounts {
  start: number
  highlight: number
  surprise: number
  windDown: number
}

export interface RejectedCandidateDiagnostics {
  venueId: string
  venueName: string
  score: number
  rejectionReasons: string[]
}

export interface RoleWinnerFrequencyEntry {
  venueId: string
  wins: number
  winShare: number
  flaggedUniversal: boolean
}

export interface LiveRoleLeaderDiagnostics {
  venueId: string
  venueName: string
  roleScore: number
  qualityGateStatus: QualityGateStatus
  likelyOpenForCurrentWindow: boolean
  timeConfidence: number
}

export interface LiveQueryCandidateDiagnostics {
  label: string
  template: string
  roleHint: string
  fetchedCount: number
  mappedCount: number
  normalizedCount: number
  approvedCount: number
  demotedCount: number
  suppressedCount: number
}

export type LiveCompetitionStage =
  | 'fetch'
  | 'normalization'
  | 'quality-gate'
  | 'dedupe'
  | 'retrieval'
  | 'role-pool'
  | 'highlight-validity'
  | 'arc-assembly'
  | 'final-route-winner'
  | 'selected-winner'

export interface ScoreDimensionDeltaDiagnostics {
  key: string
  label: string
  liveValue: number | string | boolean
  curatedValue: number | string | boolean
  delta: number | null
  favored: 'live' | 'curated' | 'tie'
  explanation: string
}

export interface RoleCompetitionScoreBreakdown {
  poolRankingScore: number
  roleFit: number
  tasteBonus: number
  tasteRoleSuitabilityContribution: number
  highlightPlausibilityBonus?: number
  overallFit: number
  lensCompatibility: number
  stopShapeFit: number
  vibeAuthority: number
  contextSpecificity: number
  dominancePenalty: number
  contractScore: number
  highlightValidityLevel?: HighlightValidityLevel
  highlightCandidateTier?: HighlightCandidateTier
  highlightValidityBoost?: number
  rolePoolLift: number
  liveRoleLift: number
  liveRolePromotion: number
  hoursPenalty: number
  hoursAdjusted: boolean
  sourceConfidence: number
  completenessScore: number
  qualityScore: number
  timeConfidence: number
  likelyOpenForCurrentWindow: boolean
  hoursKnown: boolean
  signatureScore: number
  genericScore: number
  qualityGateStatus: QualityGateStatus
}

export interface RoleCompetitionCandidateDiagnostics {
  venueId: string
  venueName: string
  sourceOrigin: VenueSourceOrigin
  qualityGateStatus: QualityGateStatus
  score: RoleCompetitionScoreBreakdown
}

export interface RoleCompetitionDiagnostics {
  role: UserStopRole
  strongestLive?: RoleCompetitionCandidateDiagnostics
  strongestCurated?: RoleCompetitionCandidateDiagnostics
  strongestLiveScore?: number
  strongestCuratedScore?: number
  strongestLiveLossReason?: string
  strongestLiveLostAtStage?: LiveCompetitionStage
  strongestLiveVsCuratedDelta: ScoreDimensionDeltaDiagnostics[]
  arcScoreDelta: ScoreDimensionDeltaDiagnostics[]
  outcome:
    | 'live-won'
    | 'curated-won'
    | 'no-live-candidate'
    | 'no-curated-candidate'
  liveEnteredRolePool: boolean
  curatedEnteredRolePool: boolean
  liveReachedArcAssembly: boolean
  curatedReachedArcAssembly: boolean
  liveWonFinalRoute: boolean
  winningVenueId?: string
  bestLiveArcCandidateId?: string
  bestLiveArcScore?: number
  selectedArcScore?: number
}

export interface LiveAttritionStageEntry {
  stage: LiveCompetitionStage
  liveCount: number
  droppedFromPrevious: number
  notes: string[]
}

export interface LiveAttritionTraceDiagnostics {
  liveFetchedCount: number
  liveMappedCount: number
  liveNormalizedCount: number
  liveApprovedCount: number
  liveDemotedCount: number
  liveSuppressedCount: number
  liveDedupedCount: number
  liveDedupedAgainstCuratedCount: number
  liveNoveltyCollapsedCount: number
  liveRetrievedCount: number
  liveEnteredRolePoolStart: number
  liveEnteredRolePoolHighlight: number
  liveEnteredRolePoolSurprise: number
  liveEnteredRolePoolWindDown: number
  liveRejectedByHighlightValidityCount: number
  liveRejectedByRolePoolCount: number
  liveLostInArcAssemblyCount: number
  liveLostInFinalWinnerCount: number
  stages: LiveAttritionStageEntry[]
}

export interface LiveDedupeLossDiagnostics {
  removedVenueId: string
  removedVenueName: string
  removedSourceOrigin: VenueSourceOrigin
  keptVenueId: string
  keptVenueName: string
  keptSourceOrigin: VenueSourceOrigin
  duplicateReason: string
  preferenceReason: string
  liveLostAgainstCurated: boolean
  liveNoveltyCollapsed: boolean
  liveSignatureScore?: number
  keptSignatureScore?: number
  liveDistinctivenessScore?: number
  keptDistinctivenessScore?: number
}

export interface LiveNoveltyLossDiagnostics {
  liveDedupedAgainstCuratedCount: number
  strongestLiveDedupedExamples: LiveDedupeLossDiagnostics[]
  dedupeLossReason: string[]
  liveNoveltyCollapsedCount: number
}

export interface ReasonBreakdownEntry {
  reason: string
  count: number
}

export interface LiveTrustFailureCandidateDiagnostics {
  venueId: string
  venueName: string
  qualityGateStatus: QualityGateStatus
  qualityScore: number
  sourceConfidence: number
  completenessScore: number
  signatureScore: number
  genericScore: number
  sourceQueryLabel?: string
  helpedBy: string[]
  hurtBy: string[]
  blockers: string[]
}

export interface LiveTrustBreakdownDiagnostics {
  topApprovedBlockers: ReasonBreakdownEntry[]
  topSuppressionReasons: ReasonBreakdownEntry[]
  topDedupeReasons: ReasonBreakdownEntry[]
  strongestApprovalFailures: LiveTrustFailureCandidateDiagnostics[]
  strongestSuppressedCandidates: LiveTrustFailureCandidateDiagnostics[]
  strongestDedupedCandidates: LiveDedupeLossDiagnostics[]
}

export interface CuratedDominanceDiagnostics {
  curatedDominanceDetected: boolean
  curatedDominancePrimaryReason: string
  repeatedCuratedWinnerPattern: string[]
  liveWouldNeedToImproveOn: string[]
  sourceBalanceSummary: string[]
}

export interface RolePoolDiagnostics {
  rolePoolSize: number
  rolePoolCandidateIds?: string[]
  strongCandidateCount: number
  categoryDiversityCount: number
  categoryDistribution: Partial<Record<string, number>>
  familyDiversityCount?: number
  familyDistribution?: Partial<Record<string, number>>
  dominantFamily?: string
  dominantFamilyShare?: number
  topConfidenceBand: 'strong' | 'medium' | 'weak'
  weakPool: boolean
  weakPoolReason?: string
  selectedVenueId: string
  selectedScore: number
  runnerUpVenueId?: string
  runnerUpScore?: number
  fallbackUsed: boolean
  fallbackLabel: SelectionStrengthLabel
  roleContractLabel?: string
  roleContractStrength?: RoleContractStrength
  contractStrictCandidateCount?: number
  contractRelaxedCandidateCount?: number
  contractSatisfied?: boolean
  contractRelaxed?: boolean
  contractFallbackReason?: string
  bestContractCandidateId?: string
  preferredDiscoveryVenueId?: string
  preferredDiscoveryVenueAdmitted?: boolean
  preferredDiscoveryVenueRejectedReason?: PreferredDiscoveryAdmissionRejectionReason
  preferredCandidateSurvivedToArc?: boolean
  preferredCandidateDroppedPreAssembly?: boolean
  selectedContractOverrideApplied?: boolean
  selectedContractOverrideRole?: UserStopRole
  selectedCandidateStillLostReason?: string
  selectedContractSatisfied?: boolean
  selectedViolatesContract?: boolean
  highlightValidCandidateCount?: number
  highlightFallbackCandidateCount?: number
  highlightInvalidCandidateCount?: number
  fallbackUsedBecauseNoValidHighlight?: boolean
  bestValidHighlightCandidateId?: string
  bestValidHighlightChallengerId?: string
  selectedHighlightValidityLevel?: HighlightValidityLevel
  selectedHighlightValidForIntent?: boolean
  selectedHighlightIsFallback?: boolean
  selectedHighlightViolatesIntent?: boolean
  selectedHighlightVetoReason?: string
  packLiteralRequirementSatisfied?: boolean
}

export interface RetrievalStageDiagnostics {
  totalSeed: number
  active: number
  qualityApproved: number
  qualityDemoted: number
  qualitySuppressed: number
  curatedSeed: number
  liveFetched: number
  liveMapped: number
  liveNormalized: number
  liveApproved: number
  liveDemoted: number
  liveSuppressed: number
  liveHoursDemoted: number
  liveHoursSuppressed: number
  cityMatch: number
  geographyMatch: number
  lensStrict: number
  lensSoft: number
  finalRetrieved: number
  neighborhoodPreferred: number
  dedupedMerged: number
  dedupedLive: number
  finalCurated: number
  finalLive: number
}

export interface VibeInfluenceDiagnostics {
  primaryVibe: string
  secondaryVibe?: string
  primaryVibeMatchCount: number
  secondaryVibeMatchCount: number
  weakVibeInfluence: boolean
  selectedHighlightVibeFit?: number
  selectedHighlightPackPressure?: number
  selectedHighlightPressureSource?: string
  selectedHighlightMusicSupport?: string
  selectedSupportStopVibeFit?: number
  routeShapeBiasApplied?: string
  routeShapeBiasScore?: number
  selectedHighlightAdventureRead?: string
  outdoorVsUrbanNotes?: string[]
}

export interface TasteVenueDiagnosticsSample {
  venueId: string
  venueName: string
  sourceType: 'seed' | 'live'
  energy: number
  socialDensity: number
  intimacy: number
  lingerFactor: number
  destinationFactor: number
  experientialFactor: number
  conversationFriendliness: number
  roleSuitability: TasteRoleSuitability
  highlightTier: TasteHighlightTier
  durationEstimate: TasteDurationEstimate
  noveltyWeight: number
  debug: Pick<TasteDebugMetadata, 'sourceMode' | 'confidence' | 'supportingSignals'>
}

export interface TasteInterpretationDiagnostics {
  seedExamples: TasteVenueDiagnosticsSample[]
  liveExamples: TasteVenueDiagnosticsSample[]
}

export interface RetrievalDiagnostics {
  stageCounts: RetrievalStageDiagnostics
  liveSource: {
    requestedMode: SourceMode
    effectiveMode: SourceMode
    provider?: LiveDataProvider
    debugOverrideApplied: boolean
    fallbackToCurated: boolean
    liveFetchAttempted: boolean
    liveFetchSucceeded: boolean
    failureReason?: string
    queryLocationLabel?: string
    queryCount: number
    liveQueryTemplatesUsed: string[]
    liveQueryLabelsUsed: string[]
    liveCandidatesByQuery: LiveQueryCandidateDiagnostics[]
    liveRoleIntentQueryNotes: string[]
    fetchedCount: number
    mappedCount: number
    normalizedCount: number
    approvedCount: number
    demotedCount: number
    suppressedCount: number
    liveHoursDemotedCount: number
    liveHoursSuppressedCount: number
    partialFailure: boolean
    errors: string[]
    countsBySource: Record<VenueSourceOrigin, number>
    dedupedCount: number
    dedupedLiveCount: number
    liveRetrievedCount: number
    hybridLiveCompetitiveCount: number
    liveHighlightCandidateCount: number
    liveCompetitivenessLiftApplied: number
    liveTimeConfidenceAdjustedCount: number
    liveTimeConfidencePenaltyByRole: RolePoolCounts
    liveRejectedByHighlightValidityCount: number
    liveRejectedByRolePoolCount: number
    liveLostInArcAssemblyCount: number
    liveLostInFinalWinnerCount: number
    liveRolePoolCounts: RolePoolCounts
    liveRoleWinCounts: RolePoolCounts
    strongestLiveByRole: Partial<Record<UserStopRole, LiveRoleLeaderDiagnostics>>
    strongestCuratedByRole: Partial<Record<UserStopRole, RoleCompetitionCandidateDiagnostics>>
    strongestLiveScoreByRole: Partial<Record<UserStopRole, number>>
    strongestCuratedScoreByRole: Partial<Record<UserStopRole, number>>
    strongestLiveLossReasonByRole: Partial<Record<UserStopRole, string>>
    strongestLiveLostAtStageByRole: Partial<Record<UserStopRole, LiveCompetitionStage>>
    strongestLiveVsCuratedDeltaByRole: Partial<Record<UserStopRole, ScoreDimensionDeltaDiagnostics[]>>
    roleCompetitionByRole: Partial<Record<UserStopRole, RoleCompetitionDiagnostics>>
    liveAttritionTrace: LiveAttritionTraceDiagnostics
    curatedDominance: CuratedDominanceDiagnostics
    dedupeNoveltyLoss: LiveNoveltyLossDiagnostics
    liveTrustBreakdown: LiveTrustBreakdownDiagnostics
    strongLiveCandidatesFilteredCount: number
    liveLostToCuratedReason: string[]
    sourceBalanceNotes: string[]
    curatedVsLiveWinnerNotes: string[]
    selectedStopSources: Partial<Record<UserStopRole, VenueSourceOrigin>>
  }
  personaFilteredCount: number
  starterPackFilteredCount: number
  refinementFilteredCount: number
  geographyFilteredCount: number
  roleShapeEligibleCount: number
  excludedByQualityGate: ExcludedVenueDiagnostics[]
  overPruned: boolean
  pruneNotes: string[]
  vibeInfluence: VibeInfluenceDiagnostics
  tasteInterpretation: TasteInterpretationDiagnostics
}

export interface SurpriseInjectionDiagnostics {
  surpriseInjected: boolean
  surpriseCandidateCount: number
  surpriseCandidateTierBreakdown: {
    strong: number
    nearStrong: number
  }
  generatedSurpriseArcCount: number
  surpriseComparedTierBreakdown: {
    strong: number
    nearStrong: number
  }
  surpriseGateProbability: number
  surpriseSelectionReason: string
  surpriseRejectedBySpatialCount: number
  surpriseRejectedBySpatialTier2Count: number
  scoreDeltaVsBaseArc?: number
  tradeoffThreshold?: number
  tradeoffThresholdBlocked: boolean
  rejectedByScoreCount: number
  surpriseAcceptanceBonusApplied: boolean
  surpriseAcceptanceBonusValue: number
  surpriseTasteSignals?: {
    venueId: string
    venueName: string
    experientialFactor: number
    noveltyWeight: number
    roleSuitability: number
    supportingSignals: string[]
  }
}

export interface DistrictAnchorDiagnostics {
  districtAnchor: DistrictAnchor
  selectedDistrictId: string
  selectedDistrictLabel: string
  selectedDistrictSource: DistrictAnchorSource
  selectedDistrictConfidence: number
  selectedDistrictReason: string
}

export interface CategoryDiversityDiagnostics {
  categoryDiversityScore: number
  repeatedCategoryCount: number
  categoryDiversityPenaltyApplied: boolean
  categoryDiversityPenalty: number
  notes: string[]
}

export interface StopExplainabilityDiagnostics {
  role: UserStopRole
  venueId: string
  venueName: string
  normalizedCategory: string
  normalizedSubcategory: string
  durationClass: DurationClass
  estimatedDurationMinutes: number
  socialDensity: number
  highlightCapability: string
  qualityGateStatus: QualityGateStatus
  sourceOrigin: VenueSourceOrigin
  sourceProvider?: LiveDataProvider
  sourceProviderRecordId?: string
  sourceQueryLabel?: string
  openNow?: boolean
  hoursKnown: boolean
  likelyOpenForCurrentWindow: boolean
  businessStatus: BusinessStatus
  timeConfidence: number
  hoursPressureLevel: HoursPressureLevel
  hoursDemotionApplied: boolean
  hoursSuppressionApplied: boolean
  sourceConfidence: number
  completenessScore: number
  normalizedFromRawType: string
  missingFields: string[]
  inferredFields: string[]
  qualityGateNotes: string[]
  reasonTags: string[]
  selectedBecause: string
  rejectionReasons: string[]
  refinementImpact: string[]
  starterPackImpact: string[]
  roleScore: number
  selectedScore: number
  roleRankingPosition: number
  lensCompatibility: number
  personaMatch: number
  vibeMatch: number
  proximityMatch: number
  selectionConfidence: number
  tasteInfluenceApplied: boolean
  tasteBonus?: number
  tasteRoleSuitabilityContribution?: number
  tasteHighlightPlausibilityBonus?: number
  contextSpecificity: number
  dominancePenalty: number
  universalityScore: number
  universalWinnerFlag: boolean
  moreContextSpecificChallengerExists: boolean
  fallbackLabel: SelectionStrengthLabel
  fallbackUsed: boolean
  runnerUpVenueId?: string
  runnerUpScore?: number
  scoreDeltaFromBaseline?: number
  rejectedAlternatives: RejectedCandidateDiagnostics[]
  roleContractLabel?: string
  roleContractStrength?: RoleContractStrength
  selectedContractOverrideApplied?: boolean
  selectedContractOverrideRole?: UserStopRole
  contractSatisfied?: boolean
  contractRelaxed?: boolean
  contractFallbackReason?: string
  bestContractCandidateId?: string
  selectedViolatesContract?: boolean
  contractMatchedSignals?: string[]
  contractViolationReasons?: string[]
  vibeAuthority?: number
  highlightVibeFit?: number
  windDownVibeFit?: number
  highlightPackPressure?: number
  highlightPressureSource?: string
  musicSupportSource?: string
  highlightValidForIntent?: boolean
  highlightValidityLevel?: HighlightValidityLevel
  highlightCandidateTier?: HighlightCandidateTier
  highlightVetoReason?: string
  packLiteralRequirementSatisfied?: boolean
  fallbackUsedBecauseNoValidHighlight?: boolean
  bestValidHighlightChallenger?: string
  selectedHighlightViolatesIntent?: boolean
  selectedHighlightIsFallback?: boolean
  highlightMatchedSignals?: string[]
  highlightViolationReasons?: string[]
  supportStopVibeFit?: number
  supportStopVibeEffect?: string
  supportStopVibeNotes?: string[]
  routeShapeBiasApplied?: string
  outdoorVsUrbanRead?: string
  outdoorVsUrbanNotes?: string[]
}

export interface TransitionExplainabilityDiagnostics {
  fromRole: UserStopRole
  toRole: UserStopRole
  fromVenueId: string
  toVenueId: string
  estimatedTravelMinutes: number
  transitionBufferMinutes: number
  estimatedTransitionMinutes: number
  frictionScore: number
  movementMode: RouteMovementMode
  neighborhoodContinuity: RouteContinuity
  notes: string[]
}

export interface RoutePacingDiagnostics {
  transitions: TransitionExplainabilityDiagnostics[]
  totalRouteFriction: number
  estimatedStopMinutes: number
  estimatedTransitionMinutes: number
  estimatedTotalMinutes: number
  estimatedTotalLabel: string
  routeFeelLabel: string
  pacingPenaltyApplied: boolean
  pacingPenaltyReasons: string[]
  smoothProgressionRewardApplied: boolean
  smoothProgressionRewardReasons: string[]
}

export interface BuildFallbackTraceDiagnostics {
  fullArcCandidatesCount: number
  partialArcCandidatesCount: number
  highlightOnlyCandidatesCount: number
  bestFullArcFound: boolean
  bestPartialArcFound: boolean
  bestHighlightOnlyFound: boolean
  usedRecoveredCentralMomentHighlight?: boolean
  recoveredHighlightCandidatesCount?: number
  centralMomentRecoveryReason?: string
  selectedFallbackType?: 'full' | 'partial' | 'single'
  fallbackFailureReason?: string
  triggerStage?: 'initial_selection' | 'refinement'
  primaryPathFailureReason?: string
  boundaryCandidateCountAtTrigger?: number
  rankedCandidateCountAtTrigger?: number
  rolePoolCountsAtTrigger?: RolePoolCounts
  selectedFallbackScore?: number
  selectedFallbackStopCount?: number
}

export interface ThinPoolRelaxationTrace {
  triggered: boolean
  expectedDirectionIdentity: string
  observedDirectionIdentity: string
  contractBuildabilityStatus: 'sufficient' | 'thin'
  missingRoleForContract: UserStopRole | null
  candidatePoolSufficiencyByRole: {
    start: number
    highlight: number
    windDown: number
  }
  relaxationReason?: string
  relaxedRule?: string
  validationOutcome: 'accepted_with_relaxation' | 'accepted_without_relaxation' | 'rejected'
}

export interface PreRankingAnchorRoleLockTrace {
  triggered: boolean
  lockApplied: boolean
  lockSource: 'user_intent_anchor' | 'none'
  triggerReason: string
  lockedRole?: UserStopRole
  lockedVenueId?: string
  anchorApplied: boolean
  anchorSurvivedToArc?: boolean
  preLockCandidateCount: number
  postLockCandidateCount: number
  survivingAnchorArcCount: number
  fallbackReason?: string
}

export interface GenerationDiagnostics {
  totalVenueCount: number
  retrievedVenueCount: number
  retrievalContractApplied: boolean
  retrievedVenueIds: string[]
  lensCompatibleCount: number
  scoredVenueCount: number
  rolePoolCounts: RolePoolCounts
  rolePoolVenueIdsByRole: {
    start: string[]
    highlight: string[]
    windDown: string[]
  }
  rolePoolVenueIdsCombined: string[]
  contractInfluenceSummary: string
  candidateArcCount: number
  anchorApplied: boolean
  anchorRole?: UserStopRole
  anchorInjectedToInventory: boolean
  anchorInjectionSource?: 'search' | 'session' | 'unknown'
  anchorInjectionFailureReason?: string
  rawAnchorVenueId?: string
  canonicalAnchorVenueId?: string
  anchorCanonicalized: boolean
  anchorCanonicalizationFailureReason?: string
  anchorHoursRelaxed: boolean
  anchorHoursRelaxationReason?: AnchorHoursRelaxationReason
  anchorAdmittedToRolePool?: boolean
  anchorAdmissionFailureReason?: AnchorAdmissionFailureReason
  anchorRolePoolSize?: number
  anchorRolePoolIndex?: number
  anchorRolePoolVenueIds?: string[]
  anchorGeographyRelaxed: boolean
  geographyViolationCount: number
  anchorSurvivedToArc?: boolean
  anchorDroppedReason?: string
  preValidationAnchorArcCount: number
  postValidationAnchorArcCount: number
  postPruneAnchorArcCount: number
  finalAnchorArcCount: number
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
  bestFinalAnchorArcId?: string
  bestFinalAnchorArcScore?: number
  bestNonAnchorArcId?: string
  bestNonAnchorArcScore?: number
  finalAnchorArcLossReason?: string
  userLedFinalRoleLockApplied: boolean
  finalArcFilteredToAnchorRole: boolean
  survivingAnchorArcCount: number
  userLedFinalRoleLockFallbackReason?: string
  constraintTrace: ConstraintTraceEntry[]
  temporalTrace: TemporalTrace
  fallbackRelaxationApplied: FallbackRelaxationLevel
  selectedArcId: string
  selectedStopIds: string[]
  buildFallbackTrace?: BuildFallbackTraceDiagnostics
  thinPoolRelaxationTrace?: ThinPoolRelaxationTrace
  preRankingAnchorRoleLockTrace?: PreRankingAnchorRoleLockTrace
  starterPackInfluenceApplied: boolean
  starterPackInfluenceSummary: string[]
  refinementModeApplied: RefinementMode[]
  refinementChangeSummary?: string
  alternativeCounts: Partial<Record<UserStopRole, number>>
  nearbyAlternativeCounts: Partial<Record<UserStopRole, number>>
  fallbackRelaxationLevel: FallbackRelaxationLevel
  geoPenaltyApplied: boolean
  duplicateCategoryPenaltyApplied: boolean
  roleWinnerFrequency: Partial<Record<UserStopRole, RoleWinnerFrequencyEntry[]>>
  rolePoolDiagnostics: Partial<Record<UserStopRole, RolePoolDiagnostics>>
  stopExplainability: Partial<Record<UserStopRole, StopExplainabilityDiagnostics>>
  routePacing: RoutePacingDiagnostics
  spatialCoherence: SpatialCoherenceAnalysis
  surpriseInjection: SurpriseInjectionDiagnostics
  districtAnchor: DistrictAnchor
  recommendedDistricts: DistrictRecommendation[]
  topDistrictId?: string
  selectedDistrictId: string
  selectedDistrictLabel: string
  selectedDistrictSource: DistrictAnchorSource
  selectedDistrictConfidence: number
  selectedDistrictReason: string
  categoryDiversity: CategoryDiversityDiagnostics
  strictShapeEnabled: boolean
  boundaryDiagnostics: BoundaryDiagnostics
  overlapDiagnostics?: OverlapDiagnostics
  retrievalDiagnostics: RetrievalDiagnostics
  faultIsolationNotes: string[]
  refinementOutcome?: RefinementOutcome
  baselineArcId?: string
  changedStopCount?: number
}
