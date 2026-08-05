import type { PersonaMode } from './intent'
import type { UserStopRole } from './itinerary'
import type {
  BearingsPlaceRightClauseAttribution,
  BearingsPlaceRightDiagnosticCounterfactuals,
  BearingsPlaceRightSupportWorldDiagnostics,
} from '../bearings/routePlaceRightContract'
import type { WaypointC1ApprovalDiagnostics } from '../waypoint/selectWaypointC1ApprovalCandidates'

export type GreatStopGateStatus = 'PASS' | 'FAIL'

export type GreatStopGateCriterion =
  | 'real'
  | 'role_right'
  | 'intent_right'
  | 'place_right'
  | 'moment_right'

export type BuildLocationClass = 'L1 Dense' | 'L2 Mid' | 'L3 Sparse'

export type GreatStopTravelTolerance = 'tight' | 'balanced' | 'expanded'

export type GreatStopGatePresetSource = 'explicit' | 'inferred_from_distance_mode'

export interface GreatStopCriterionResult {
  passed: boolean
  reasons: string[]
}

export interface GreatStopRequiredAnchorResult {
  venueId: string
  role: UserStopRole
  survived: boolean
  creditedRole?: UserStopRole
}

export interface GreatStopGatePreset {
  persona: PersonaMode
  locationClass: BuildLocationClass
  travelTolerance: GreatStopTravelTolerance
  source: GreatStopGatePresetSource
}

export interface GreatStopGateDiagnostics {
  movement: {
    totalEstimatedTransitionMinutes: number
    maxSingleTransitionMinutes: number
    transitionCount: number
    driveLikeMovement: boolean
    transitionLimitMinutes: number
    totalLimitMinutes: number
  }
  clusterCoherence: {
    clusterEscapeCount: number
    repeatedClusterEscapeCount: number
    longTransitionCount: number
    maxClusterEscapes: number
    spatialScore: number
    notes: string[]
  }
  zigzagOrBacktrack: {
    detected: boolean
    reason?: string
  }
  arcProgression: {
    startPresent: boolean
    highlightPresent: boolean
    windDownPresent: boolean
    peakRoleAdvantage: number
    supportAverageRoleFit: number
    energyProgressionValid: boolean
  }
  laneVariance: {
    uniqueLaneCount: number
    laneRepetitionCount: number
    supportLaneVariance: number
  }
  strongMoment: {
    present: boolean
    note?: string
    highlightMomentScore?: number
    momentStrengthScore?: number
    momentFlatPenalty?: number
  }
  placeRightClauseAttribution?: BearingsPlaceRightClauseAttribution
  placeRightSupportWorldDiagnostics?: BearingsPlaceRightSupportWorldDiagnostics
  placeRightDiagnosticCounterfactuals?: BearingsPlaceRightDiagnosticCounterfactuals
}

export interface GreatStopGateResult {
  status: GreatStopGateStatus
  failedCriteria: GreatStopGateCriterion[]
  reasons: string[]
  routeId: string
  requiredAnchor?: GreatStopRequiredAnchorResult
  criteria: {
    real: GreatStopCriterionResult
    roleRight: GreatStopCriterionResult
    intentRight: GreatStopCriterionResult
    placeRight: GreatStopCriterionResult
    momentRight: GreatStopCriterionResult
  }
  preset: GreatStopGatePreset
  diagnostics: GreatStopGateDiagnostics
}

export type GreatStopGateSelectionStage = 'pre_selection_gate' | 'post_repair_verification'

export interface GreatStopGateCandidateSummary {
  candidateId: string
  rank: number
  signature: string
  stopVenueIdsByRole: Partial<Record<UserStopRole, string>>
  requiredAnchorPreserved?: boolean
  requiredAnchorRoleCorrect?: boolean
  failedCriteria: GreatStopGateCriterion[]
  reasons: string[]
}

export interface GreatStopGateCandidateFailureDetail {
  rank: number
  candidateId: string
  signature: string
  routeNames: string[]
  stopIds: string[]
  baseVenueIds: string[]
  creditedRoles: UserStopRole[]
  requiredAnchorPresent?: boolean
  requiredAnchorRole?: UserStopRole
  requiredAnchorRoleCorrect?: boolean
  failedCriteria: GreatStopGateCriterion[]
  failureReasons: string[]
  totalMovementEstimate: number
  maxSingleTransitionEstimate: number
  transitionLimitMinutes: number
  totalLimitMinutes: number
  clusterPath: string[]
  clusterEscapeCount: number
  backtrackDetected: boolean
  driveLikeMovementDetected: boolean
  placeRightClauseAttribution?: BearingsPlaceRightClauseAttribution
  placeRightSupportWorldDiagnostics?: BearingsPlaceRightSupportWorldDiagnostics
  placeRightDiagnosticCounterfactuals?: BearingsPlaceRightDiagnosticCounterfactuals
  momentFailureReasons: string[]
  roleEnergyNote?: string
  scoreSummary: {
    totalScore: number
    geographyScore?: number
    roleFlowScore?: number
    diversityScore?: number
    windDownScore?: number
    highlightMomentScore?: number
    momentStrengthScore?: number
    momentFlatPenalty?: number
  }
}

export interface GreatStopCandidateFailureDetails {
  evaluatedCandidateCount: number
  passingCandidateCount: number
  detailCandidateLimit: number
  nearestToPassCandidate?: GreatStopGateCandidateFailureDetail
  topFailingCandidates: GreatStopGateCandidateFailureDetail[]
  candidatesFailingOnlyOneCriterionCount: number
  candidatesFailingOnlyMovementCount: number
  candidatesFailingOnlyMomentCount: number
  candidatesFailingBothPlaceAndMomentCount: number
  repeatedFailureReasonCounts: Record<string, number>
  requiredAnchorPreservedCount: number
  compactnessCandidateCount?: number
  backtrackPatternCount: number
}

export interface GreatStopCompactnessCandidateDetail {
  rank: number
  candidateId: string
  routeNames: string[]
  stopIds: string[]
  baseVenueIds: string[]
  requiredAnchorPresent?: boolean
  requiredAnchorRole?: UserStopRole
  totalMovementEstimate: number
  totalMovementLimit?: number
  maxSingleTransitionEstimate: number
  maxTransitionLimit?: number
  clusterPath: string[]
  clusterEscapeCount: number
  backtrackDetected: boolean
  repeatedClusterEscapeDetected: boolean
  driveLikeMovementDetected: boolean
  compactnessAdjustmentScore: number
  compactnessReasonSummary: string[]
  originalWaypointScore: number
  adjustedWaypointScore: number
}

export interface GreatStopCompactnessRankingDiagnostics {
  routeShapeCompactnessAdjustmentActive: boolean
  compactnessActivationReason: string
  movementRadius?: string
  maxTransitionMinutes?: number
  neighborhoodContinuity?: string
  preservePriorityIncludesMovement: boolean
  compactnessEvaluatedCandidateCount: number
  compactnessAdjustedCandidateCount: number
  compactnessCandidateCount: number
  compactnessPassingPlaceRightCandidateCount?: number
  firstCompactCandidateRank?: number
  firstPlaceRightCandidateRank?: number
  compactCandidateRanks: number[]
  compactCandidateRankLimit: number
  candidatesOverTotalMovementLimitCount: number
  candidatesOverMaxTransitionLimitCount: number
  candidatesWithBacktrackCount: number
  candidatesWithRepeatedClusterEscapeCount: number
  candidatesWithExtraClusterEscapeCount: number
  candidatesWithDriveLikeMovementCount: number
  detailCandidateLimit: number
  topCandidateDetails: GreatStopCompactnessCandidateDetail[]
  nearestCompactCandidate?: GreatStopCompactnessCandidateDetail
  nearestPlaceRightCandidate?: GreatStopCompactnessCandidateDetail
  poolVisibility: {
    beforeTop40Preservation: 'not_captured'
    beforeTop40PreservationReason: string
    afterTop40PreservationCandidateCount: number
    afterWaypointRankingCandidateCount: number
    greatStopEvaluatedCandidateCount: number
    firstCompactCandidateOutsideGreatStopEvaluatedSet?: boolean
    rolePoolCompactnessVisibility: 'not_captured'
    rolePoolCompactnessVisibilityReason: string
  }
  buildCandidatePoolCompactnessDiagnostics?: BuildCandidatePoolCompactnessDiagnostics
}

export interface BuildCandidatePoolCompactnessCandidateDetail {
  preTop40Rank: number
  postTop40Rank?: number
  candidateId: string
  routeNames: string[]
  stopIds: string[]
  baseVenueIds: string[]
  roles: string[]
  requiredAnchorPresent?: boolean
  requiredAnchorRoleCorrect?: boolean
  stopCount: number
  hasSurprise: boolean
  hasWildcard: boolean
  totalMovementEstimate: number
  compactnessTotalMovementLimit?: number
  greatStopTotalMovementLimit?: number
  maxTransitionEstimate: number
  maxTransitionLimit?: number
  clusterPath: string[]
  clusterEscapeCount: number
  backtrackDetected: boolean
  repeatedClusterEscapeDetected: boolean
  driveLikeMovementDetected: boolean
  compactnessAdjustmentScore: number
  compactnessReasonSummary: string[]
  survivedTop40: boolean
  pruneReason?: string
}

export interface BuildCandidatePoolCompactnessDiagnostics {
  fullAssembledCandidateCount: number
  anchorPreservingAssembledCandidateCount: number
  threeStopCandidateCount: number
  fourStopCandidateCount: number
  withSurpriseCandidateCount: number
  withoutSurpriseCandidateCount: number
  preTop40CandidateCount: number
  postTop40CandidateCount: number
  requiredAnchorPreservedPreTop40Count: number
  requiredAnchorPreservedPostTop40Count: number
  preTop40CompactCandidateCount: number
  preTop40PlaceRightCandidateCount: number
  preTop40NearCompactCandidateCount: number
  postTop40CompactCandidateCount: number
  postTop40PlaceRightCandidateCount: number
  firstCompactPreTop40Rank?: number
  firstPlaceRightPreTop40Rank?: number
  firstCompactPostTop40Rank?: number
  firstPlaceRightPostTop40Rank?: number
  compactCandidatesPrunedBeforeTop40Count: number
  placeRightCandidatesPrunedBeforeTop40Count: number
  nearCompactCandidatesPrunedBeforeTop40Count: number
  compactCandidatesPreservedIntoTop40Count?: number
  placeRightCandidatesPreservedIntoTop40Count?: number
  preservedCompactCandidateIds?: string[]
  preservedCompactCandidateRoutes?: string[]
  replacedCandidateIds?: string[]
  replacedCandidateCount?: number
  candidatePreservationReason?: string
  candidateShapeCounts: {
    threeStop: number
    fourStop: number
    withSurprise: number
    withoutSurprise: number
  }
  rolePoolNearAnchorSupportVisibility: {
    status: 'captured' | 'not_captured'
    reason?: string
    tightSupportAdmissionActive?: boolean
    requiredAnchorBaseVenueId?: string
    requiredAnchorNeighborhood?: string
    startNearAnchorCountBeforeAdmission?: number
    startNearAnchorCountAfterAdmission?: number
    windDownNearAnchorCountBeforeAdmission?: number
    windDownNearAnchorCountAfterAdmission?: number
    startNearAnchorCount?: number
    windDownNearAnchorCount?: number
    sameClusterStartCount?: number
    sameClusterWindDownCount?: number
    supportSupplyMissing?: boolean
  }
  compactnessTotalMovementLimit?: number
  greatStopTotalMovementLimit?: number
  maxTransitionLimit?: number
  compactnessLimitMatchesGreatStopLimit?: boolean
  compactnessLimitSource: string
  greatStopLimitSource: string
  mismatchExplanation?: string
  detailCandidateLimit: number
  nearestPreTop40CompactCandidate?: BuildCandidatePoolCompactnessCandidateDetail
  nearestPreTop40PlaceRightCandidate?: BuildCandidatePoolCompactnessCandidateDetail
  bestPreTop40NearCompactCandidate?: BuildCandidatePoolCompactnessCandidateDetail
  topPreTop40MovementCandidates: BuildCandidatePoolCompactnessCandidateDetail[]
}

export interface GreatStopGateCandidateStopIdentityDiagnostic {
  role: UserStopRole
  name: string
  rawVenueId: string
  baseVenueId: string
  normalizedHelperVenueId: string
  candidateId?: string
  provider?: string
  providerRecordId?: string
  sourceOrigin?: string
  matchRequiredAnchorByRawId?: boolean
  matchRequiredAnchorByBaseVenueId?: boolean
  matchRequiredAnchorByNormalizedHelper?: boolean
}

export interface GreatStopGateCandidateIdentityDiagnostic {
  candidateId: string
  rank: number
  signature: string
  skippedReason?: 'required_anchor_role_missing'
  preservesRequiredAnchor?: boolean
  requiredRoleCorrect?: boolean
  structuralFailureReasons: string[]
  failedCriteria: GreatStopGateCriterion[]
  reasons: string[]
  stops: GreatStopGateCandidateStopIdentityDiagnostic[]
}

export interface GreatStopGateRolePoolIdentityDiagnostics {
  rolePoolVenueIdsByRole?: Partial<Record<UserStopRole, string[]>>
  rolePoolBaseVenueIdsByRole?: Partial<Record<UserStopRole, string[]>>
  requiredAnchorPresentInRolePoolByRawId?: boolean
  requiredAnchorPresentInRolePoolByBaseVenueId?: boolean
  requiredAnchorPresentInRolePoolByNormalizedHelper?: boolean
}

export interface GreatStopGateSelectionDiagnostics {
  status: GreatStopGateStatus
  stage: GreatStopGateSelectionStage
  selectedCandidateId?: string
  selectedCandidateRank?: number
  rankedCandidateCount?: number
  evaluatedCandidateCount: number
  fullEvaluatedCandidateCount?: number
  diagnosticCandidateSummaryLimit?: number
  omittedCandidateCount?: number
  skippedMissingRequiredAnchorCount?: number
  anchorPreservingCandidateCount?: number
  evaluatedAnchorPreservingCandidateCount?: number
  firstRankWhereRequiredAnchorAppears?: number
  candidatesWithRequiredAnchorByRawId?: number
  candidatesWithRequiredAnchorByBaseVenueId?: number
  candidatesWithRequiredAnchorByNormalizedHelper?: number
  evaluatedCandidateIdentitySummaries?: GreatStopGateCandidateIdentityDiagnostic[]
  rolePoolIdentityDiagnostics?: GreatStopGateRolePoolIdentityDiagnostics
  failedTopCandidateCriteria?: GreatStopGateCriterion[]
  failureReasons: string[]
  bestFailingCandidateSummary?: GreatStopGateCandidateSummary
  bestAnchorPreservingFailingCandidate?: GreatStopGateCandidateSummary
  greatStopCandidateFailureDetails?: GreatStopCandidateFailureDetails
  compactnessRankingDiagnostics?: GreatStopCompactnessRankingDiagnostics
  waypointC1Approval?: WaypointC1ApprovalDiagnostics
  structuralFailureReasons?: string[]
  passingCandidateCount?: number
  selectedGateResult?: GreatStopGateResult
}

export class GreatStopGateSelectionError extends Error {
  readonly greatStopGateSelectionDiagnostics: GreatStopGateSelectionDiagnostics

  constructor(diagnostics: GreatStopGateSelectionDiagnostics) {
    const failedCriteria =
      diagnostics.failedTopCandidateCriteria?.join(',') ||
      diagnostics.structuralFailureReasons?.join(',') ||
      diagnostics.bestFailingCandidateSummary?.failedCriteria.join(',') ||
      'unknown'
    const reasons = diagnostics.failureReasons.join(',') || 'no_passing_great_stop_candidate'
    super(`Great Stop gate failed (${diagnostics.stage}): ${failedCriteria}; ${reasons}`)
    this.name = 'GreatStopGateSelectionError'
    this.greatStopGateSelectionDiagnostics = diagnostics
  }
}
