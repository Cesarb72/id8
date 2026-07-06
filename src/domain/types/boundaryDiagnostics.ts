import type { ExperienceMode, PersonaMode, VibeAnchor } from './intent'
import type { UserStopRole } from './itinerary'

export type BoundaryContributionLevel = 'none' | 'minor' | 'meaningful'

export interface ArcCandidateSnapshot {
  candidateId: string
  stopIdsByRole: Partial<Record<UserStopRole, string>>
  stopCategoriesByRole: Partial<Record<UserStopRole, string>>
  preBoundaryScore: number
  categoryComposition: string[]
  diversitySummary: string
}

export interface RankedArcCandidateSnapshot extends ArcCandidateSnapshot {
  rank: number
  boundaryScore: number
  previousRank: number
  rankChanged: boolean
  becameWinner: boolean
  boundaryBaseScore?: number
  boundaryRefinementNudge?: number
  boundaryTiebreaker?: number
  boundaryRefinementTokens?: string[]
  boundaryRefinementTokenDeltas?: Record<string, number>
}

export interface BuildQualityRankedArcStopSummary {
  role: UserStopRole
  venueId: string
  canonicalVenueId: string
  candidateId?: string
  name: string
  category?: string
  subcategory?: string
  lane?: string
  tags: string[]
  neighborhood?: string
  cluster?: string
  sourceOrigin?: string
  roleScore?: number
}

export interface BuildQualityRankedArcCandidateSummary {
  rank: number
  candidateId: string
  signature: string
  stopVenueIdsByRole: Partial<Record<UserStopRole, string>>
  stopNamesByRole: Partial<Record<UserStopRole, string>>
  stops: BuildQualityRankedArcStopSummary[]
  totalScore: number
  boundaryScore: number
  boundaryBaseScore?: number
  boundaryRefinementNudge?: number
  boundaryTiebreaker?: number
  requiredAnchorPresent?: boolean
  requiredAnchorRoleCorrect?: boolean
  duplicateVenue: boolean
  roleShapeValid: boolean
  invalidationReasons: string[]
  hardInvalidationReason?: string
  qualityProxy: {
    clusterTransitionCount?: number
    laneRepetitionCount: number
    laneDiversityCount: number
    strongMomentPresent?: boolean
    supportVariance: number
    categoryDiversityPenalty?: number
    repeatedCategoryCount?: number
  }
}

export interface BuildQualityRankedArcDiagnostics {
  stage: 'post_anchor_role_lock_pre_selection'
  repairStage: 'pre_post_planner_repair'
  postPlannerRepairObserved: false
  candidatePoolSource: 'boundary_candidates_after_anchor_role_lock'
  rankedCandidateSource: 'waypoint_ranked_boundary_candidates'
  rejectionReasonSource: 'accepted_ranked_candidates_revalidated'
  rejectedCandidateReasonsAvailable: boolean
  rolePoolVenueIdsByRole: Partial<Record<UserStopRole, string[]>>
  boundaryCandidateVenueIdsByRole: Partial<Record<UserStopRole, string[]>>
  boundaryCandidateCount: number
  rankedCandidateCount: number
  selectedCandidateId: string
  selectedCandidateSignature: string
  selectedWaypointRank: number | null
  selectedCandidatePreservesRequiredAnchor?: boolean
  selectedCandidateRequiredRoleCorrect?: boolean
  requiredAnchorVenueId?: string
  requiredAnchorRole?: UserStopRole
  userLedFinalRoleLockApplied: boolean
  finalArcFilteredToAnchorRole: boolean
  rankedCandidates: BuildQualityRankedArcCandidateSummary[]
}

export interface BoundaryRefinementNudgeTrace {
  requestedTokens: string[]
  adjustedCandidateCount: number
  minAdjustment: number
  maxAdjustment: number
  averageAdjustment: number
  hostVocabularyMappingApplied: boolean
  greatStopQualityContext?: {
    riskTier: 'none' | 'warning' | 'severe'
    failedStopCount: number
    severeFailureCount: number
    suppressionRecommended: boolean
    penaltyHint: number
    reasonCodes: string[]
  }
}

export interface BoundaryDiagnostics {
  boundaryInvoked: boolean
  candidateArcCount: number
  candidateIdsPassed: string[]
  preBoundaryOrder: string[]
  postBoundaryOrder: string[]
  winnerBeforeBoundary?: string
  winnerAfterBoundary?: string
  finalProjectedWinner: string
  selectedArcBeforeBoundary?: string
  selectedArcAfterBoundary?: string
  finalProjectedArcId: string
  finalProjectedMatchesPostBoundaryWinner: boolean
  changedWinner: boolean
  boundaryChangedWinner: boolean
  changedOrderCount: number
  averageRankDelta: number
  topCandidateOverlapPct: number
  boundaryContributionLevel: BoundaryContributionLevel
  preBoundarySnapshot: ArcCandidateSnapshot[]
  postBoundarySnapshot: RankedArcCandidateSnapshot[]
  buildQualityRankedArcDiagnostics?: BuildQualityRankedArcDiagnostics
  refinementNudgeTrace?: BoundaryRefinementNudgeTrace
  waypointContractTrace?: {
    supplied: boolean
    primaryInput: 'contract_context' | 'intent_profile_compatibility'
    canonicalInterpretationSupplied: boolean
    strategyWorldCount: number
    strategyIds: string[]
    requiredStopConsumed: boolean
    requiredStopRequired: boolean
    requiredStopRole?: UserStopRole
    requiredStopVenueId?: string
    requiredStopSource?: string
    requiredStopReasonCodes: string[]
    requiredStopSurvivingCandidateCount: number
    topCandidatePreservesRequiredStop?: boolean
    normalizedObjectivePrimary?: string
    normalizedPacing?: string
    anchorPostureMode?: string
    candidateLineageSource?: string
  }
  warnings: string[]
}

export interface OverlapScenarioDiagnostics {
  scenarioId: string
  label: string
  mode: ExperienceMode
  persona: PersonaMode
  primaryVibe: VibeAnchor
  secondaryVibe?: VibeAnchor
  starterPackId?: string
  strictShapeEnabled: boolean
  retrievedVenueIds: string[]
  rolePoolVenueIds: string[]
  topCandidateSignatures: string[]
  winnerSignature: string
}

export interface OverlapPairDiagnostics {
  leftScenarioId: string
  rightScenarioId: string
  retrievedVenueOverlapPct: number
  rolePoolOverlapPct: number
  topCandidateOverlapPct: number
  winnerOverlapPct: number
}

export interface OverlapDiagnostics {
  scenarios: OverlapScenarioDiagnostics[]
  pairs: OverlapPairDiagnostics[]
  warnings: string[]
}
