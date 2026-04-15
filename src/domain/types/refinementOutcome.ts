import type { RefinementMode } from './refinement'
import type { UserStopRole } from './itinerary'

export type RefinementOutcomeType =
  | 'plan_changed'
  | 'partial_change'
  | 'plan_reconsidered_same_result'
  | 'no_better_match'

export interface StopDelta {
  role: UserStopRole
  previousVenueId?: string
  nextVenueId?: string
  changed: boolean
  previousScore?: number
  nextScore?: number
  scoreDelta?: number
  previousConfidence?: number
  nextConfidence?: number
  confidenceDelta?: number
  materialChange: boolean
}

export interface RefinementOutcome {
  requestedModes: RefinementMode[]
  previousArcId?: string
  nextArcId: string
  previousItineraryId?: string
  nextItineraryId?: string
  outcomeType: RefinementOutcomeType
  pathResult:
    | 'targeted_change'
    | 'full_plan_change'
    | 'reconsidered_same_result'
    | 'no_better_match'
  targetedRoles: UserStopRole[]
  primaryTargetRole?: UserStopRole
  targetRoleExistedInVisiblePlan: boolean
  targetRoleSelectionReason: string
  targetedCandidateCount: number
  targetedChangeSucceeded: boolean
  fullPlanFallbackUsed: boolean
  changedStopCount: number
  materiallyChangedStopCount: number
  sameResult: boolean
  escalationUsed: boolean
  winnerInertiaDetected: boolean
  winnerInertiaReduced: boolean
  winnerInertiaNotes: string[]
  stopDeltas: StopDelta[]
  summaryMessage: string
}
