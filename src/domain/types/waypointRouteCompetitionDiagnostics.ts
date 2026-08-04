import type { TasteExperienceCompositionStamp } from '../interpretation/taste/computeExperienceCompositionStamp'
import type { TasteRouteMomentVerdict } from '../interpretation/taste/routeMomentVerdict'
import type { UserStopRole } from './itinerary'
import type { RoutePacingAnalysis } from './pacing'
import type { SpatialCoherenceAnalysis } from './spatial'

export type WaypointRouteCompetitionGlobalStrongestStatus =
  | 'GLOBAL_STRONGEST_PROVEN'
  | 'GLOBAL_STRONGEST_NOT_PROVEN'

export type WaypointRouteCompetitionFailureReason =
  | 'assembly_incomplete'
  | 'pre_ranking_population_truncated'
  | 'ranked_population_incomplete'
  | 'selected_not_in_ranked_population'
  | 'selected_not_first'
  | 'tie_population_truncated'
  | 'evidence_missing'
  | 'assessed_route_mismatch'
  | 'shown_route_mismatch'

export type WaypointRouteCompetitionApprovalContinuityStatus =
  | 'PROVEN_BY_EXISTING_EVIDENCE'
  | 'UNAVAILABLE_WITHOUT_PROTECTED_INSTRUMENTATION'
  | 'NOT_APPLICABLE'

export type WaypointRouteCompetitionRowPurpose =
  | 'selected_winner'
  | 'immediate_ranked_runner_up'
  | 'first_different_highlight'
  | 'first_different_ordered_route'
  | 'first_different_structural_posture'
  | 'selected_score_boundary_tie'

export interface WaypointRouteCompetitionPromiseIdentity {
  supplied: boolean
  primaryInput?: 'contract_context' | 'intent_profile_compatibility'
  canonicalInterpretationSupplied?: boolean
  strategyIds: string[]
  strategyFamily?: string
  experienceContractId?: string
  contractConstraintsId?: string
  normalizedObjectivePrimary?: string
  normalizedPacing?: string
  anchorPostureMode?: string
  candidateLineageSource?: string
}

export interface WaypointRouteCompetitionRankedIdentity {
  rank: number
  candidateId: string
  orderedStopIds: string[]
  orderedBaseVenueIds: string[]
  orderedRouteSignature: string
  highlightId?: string
}

export interface WaypointRouteCompetitionStructuralPosture {
  stopCount: number
  hasWildcard: boolean
  promotionOutcome?: string
  candidateTier?: string
}

export interface WaypointRouteCompetitionTasteEvidence {
  routeMomentVerdict?: TasteRouteMomentVerdict
  experienceCompositionStamp?: TasteExperienceCompositionStamp
  highlightMomentScore?: number
  momentStrengthScore?: number
  momentVarianceScore?: number
  strongMomentPresent?: boolean
}

export interface WaypointRouteCompetitionBearingsEvidence {
  geographyScore?: number
  spatialCoherenceScore?: number
  spatial?: SpatialCoherenceAnalysis
  pacing?: RoutePacingAnalysis
}

export interface WaypointRouteCompetitionComparisonDimensions {
  productionRankingScore: number
  boundaryBaseScore: number
  boundaryQualityAdjustment: number
  routeShapeCompactnessAdjustment: number
  refinementNudge: number
  tiebreaker: number
}

export interface WaypointRouteCompetitionComparisonRow {
  purposes: WaypointRouteCompetitionRowPurpose[]
  rank: number
  candidateId: string
  orderedStopIds: string[]
  orderedBaseVenueIds: string[]
  stopIdsByRole: Partial<Record<UserStopRole, string>>
  highlightId?: string
  productionScore: number
  comparisonDimensions: WaypointRouteCompetitionComparisonDimensions
  structuralPosture: WaypointRouteCompetitionStructuralPosture
  tasteEvidence: WaypointRouteCompetitionTasteEvidence
  bearingsEvidence: WaypointRouteCompetitionBearingsEvidence
  interpretationPromiseIdentity?: WaypointRouteCompetitionPromiseIdentity
}

export interface WaypointRouteCompetitionPopulationIdentities {
  count: number
  complete: boolean
  cap: number
  truncated: boolean
  entries: WaypointRouteCompetitionRankedIdentity[]
}

export interface WaypointRouteCompetitionRowTruncationStatus {
  cap: number
  truncated: boolean
  reason?: 'row_cap_exceeded' | 'selected_score_boundary_ties_exceeded_cap'
}

export interface WaypointRouteCompetitionDiagnostics {
  enabled: true
  owner: 'Waypoint'
  diagnosticVersion: 'waypoint.route_competition.v1'
  assemblyCompleted: boolean
  retainedCandidateCount: number
  preTop40CandidateCount: number
  assembledCandidateCount: number
  finalBoundaryInputCount: number
  finalRankedCandidateCount: number
  top40Truncated: boolean
  rankedPopulationComplete: boolean
  selectedCandidateId?: string
  selectedRank?: number
  selectedFromRankedPopulation: boolean
  selectedFirstWithinFinalRankedPopulation: boolean
  assessedRouteMatchesSelected: boolean
  shownRouteMatchesSelected: boolean
  approvalContinuityStatus: WaypointRouteCompetitionApprovalContinuityStatus
  globalStrongestStatus: WaypointRouteCompetitionGlobalStrongestStatus
  globalStrongestFailureReasons: WaypointRouteCompetitionFailureReason[]
  finalRankedPopulation: WaypointRouteCompetitionPopulationIdentities
  comparisonRows: WaypointRouteCompetitionComparisonRow[]
  rowTruncation: WaypointRouteCompetitionRowTruncationStatus
  interpretationPromiseIdentity?: WaypointRouteCompetitionPromiseIdentity
  interpretationPromiseSharedByComparedRows: boolean
}
