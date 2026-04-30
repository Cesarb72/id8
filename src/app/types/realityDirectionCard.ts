import type { PersonaMode, VibeAnchor } from '../../domain/types/intent'

export type RealityCluster = 'lively' | 'chill' | 'explore'

export interface RealityClusterCardCopy {
  title: string
  subtitle?: string
  toneTag?: string
  whyNow: string
  whyYou: string
  anchorLine?: string
  supportLine?: string
  proofLine: string
  selectedProofLine?: string
  storySpinePreview?: {
    start: string
    highlight: string
    windDown: string
    whyThisWorks: string
  }
  liveSignals: {
    title: string
    items: string[]
  }
  confirmation: string
}

export interface RealityDirectionStrategyWorldDebug {
  admittedCount: number
  suppressedCount: number
  rejectedCount: number
  fallbackAdmittedCount: number
  totalInputCount: number
  hardFailCount: number
  suppressedBySignal: Record<string, number>
  rejectedBySignal: Record<string, number>
  topFailureReasons: string[]
  survivabilityStatus: 'viable' | 'weak' | 'collapsed'
  sampleDecisions: Array<{
    pocketId: string
    status: 'admitted' | 'suppressed' | 'rejected'
    reasonSummary: string
  }>
  allowedPreview: string
  suppressedPreview: string
  rejectedPreview: string
}

export interface RealityDirectionDebugMeta {
  pocketId: string
  pocketLabel?: string
  archetype: string
  confidence: number
  persona?: PersonaMode
  personaBoost?: number
  vibe?: VibeAnchor
  vibeBoost?: number
  finalScore?: number
  familyBias?: number
  richnessBoostApplied?: number
  similarityPenaltyApplied?: number
  composedCandidateAccepted?: boolean
  composedCandidateRejected?: boolean
  richnessContrastReason?: string
  shapedScoreBeforeCompression?: number
  shapedScoreAfterCompression?: number
  compressionApplied?: boolean
  compressionDelta?: number
  candidatePoolSize?: number
  preShapeRank?: number
  shapedRank?: number
  selectedRank?: number
  selectionMode?:
    | 'winner_strength'
    | 'guardrail_lane_alignment'
    | 'safe_adjacent'
    | 'different_angle'
    | 'score_fallback'
  maxSimilarityToSelected?: number
  similarityToWinner?: number
  similarityToSlot2?: number
  sameLaneAsWinner?: boolean
  similarityPenalty?: number
  contrastScore?: number
  winnerStrengthBonus?: number
  diversityLift?: number
  compositionChangedByShaping?: boolean
  elevatedFromOutsideTop3?: boolean
  laneIdentity?: string
  macroLane?: string
  directionExperienceIdentity?: string
  directionPrimaryIdentitySource?: string
  directionPeakModel?: string
  directionMovementStyle?: string
  directionDistrictSupportSummary?: string
  directionStrategyId?: string
  directionStrategyLabel?: string
  directionStrategyFamily?: string
  directionStrategySummary?: string
  directionStrategySource?: string
  directionCollapseGuardApplied?: boolean
  directionStrategyOverlapSummary?: string
  strategyConstraintStatus?: {
    required: 'pass' | 'fail'
    preferred: number
    suppressed: 'triggered' | 'not_triggered'
  }
  strategyPoolSize?: number
  strategyRejectedCount?: number
  strategyHardGuardStatus?: 'pass' | 'degraded'
  strategyHardGuardReason?: string
  contractGateApplied?: boolean
  contractGateSummary?: string
  contractGateStrengthSummary?: string
  contractGateRejectedCount?: number
  contractGateAllowedPreview?: string[]
  contractGateSuppressedPreview?: string[]
  floorRecoveryAttempted?: boolean
  floorRecoveryCandidateId?: string
  floorRecoveryReason?: string
  floorRecoveryBlockedReason?: string
  directionContractGateStatus?: string
  directionContractGateReasonSummary?: string
  contrastPocketInjected?: boolean
  strategyWorldSource?: string
  selectedStrategyWorldId?: string
  strategyWorldSummary?: string
  strategyWorldAdmittedCount?: number
  strategyWorldSuppressedCount?: number
  strategyWorldRejectedCount?: number
  strategyWorldAllowedPreview?: string
  strategyWorldSuppressedPreview?: string
  directionStrategyWorldDebug?: RealityDirectionStrategyWorldDebug
  directionStrategyWorldStatus?: string
  directionStrategyWorldReasonSummary?: string
  directionNarrativeSource?: string
  directionNarrativeMode?: string
  directionNarrativeSummary?: string
  districtIdentityStrength?: number
  momentumProfile?: string
  contrastEligible?: boolean
  contrastReason?: string
  experienceFamily?: string
  familyConfidence?: number
  laneCollapseRisk?: boolean
  laneSeparatedSlot3?: boolean
  laneSeparationReason?: string
  selectedFamilies?: string[]
  familyDiversityApplied?: boolean
  fallbackUsed?: boolean
  tasteBridgeDirectionDiversificationApplied?: boolean
  droppedPocketIds?: string[]
  strongestShapedId?: string
  correctedWinnerId?: string
  finalSelectedId?: string
  strongestShapedPreserved?: boolean
  slot1GuardrailApplied?: boolean
  top1RawSeparation?: number
  top1AdjustedSeparation?: number
  expressionMode?: string
  localSpecificityScore?: number
  usedPrimaryMicroPocket?: boolean
  usedPrimaryAnchor?: boolean
  selectedTemplateKeys?: string[]
  expressionPrimarySignal?: string
  expressionPocketType?: string
  routeShapeGrammarHint?: string
  routeShapeMovementHint?: string
  routeShapeSwapHint?: string
  experienceContractId?: string
  experienceContractIdentity?: string
  experienceContractSummary?: string
  experienceContractCoordinationMode?: string
  experienceContractHighlightModel?: string
  experienceContractHighlightType?: string
  experienceContractMovementStyle?: string
  experienceContractSocialPosture?: string
  experienceContractPacingStyle?: string
  experienceContractActPattern?: string
  experienceContractReasonSummary?: string
  contractConstraintsId?: string
  contractConstraintsPeakCountModel?: string
  contractConstraintsMovementTolerance?: string
  contractConstraintsHighlightPressure?: string
  contractConstraintsRequireContinuity?: boolean
  contractConstraintsRequireRecoveryWindows?: boolean
  conciergeIntentId?: string
  conciergeIntentMode?: string
  conciergeObjectivePrimary?: string
  conciergeControlPostureMode?: string
  conciergeConstraintSwapTolerance?: string
  conciergeHint?: string
}

export interface RealityDirectionCard {
  id: string
  cluster: RealityCluster
  card: RealityClusterCardCopy
  recommended?: boolean
  directionStrategyWorldDebug?: RealityDirectionStrategyWorldDebug
  debugMeta?: RealityDirectionDebugMeta
}
