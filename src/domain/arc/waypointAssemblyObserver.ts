import type { InternalRole } from '../types/venue'

export type WaypointAssemblyObservationType =
  | 'assembly_entered'
  | 'role_pools_received'
  | 'core_combination_entered'
  | 'validation_entered'
  | 'validation_returned'
  | 'bearings_feasibility_received'
  | 'invalid_combination_rejected'
  | 'wildcard_phase_entered'
  | 'wildcard_comparison_entered'
  | 'wildcard_comparison_returned'
  | 'promotion_phase_entered'
  | 'promotion_evaluation_entered'
  | 'promotion_evaluation_returned'
  | 'candidate_retained'
  | 'assembly_completed'

export type WaypointAssemblyObservationStage =
  | 'assembly'
  | 'role_pools'
  | 'core_combination'
  | 'validation'
  | 'wildcard_comparison'
  | 'promotion_evaluation'
  | 'retention'
  | 'completion'

export interface WaypointAssemblyStopIdentity {
  role: InternalRole
  candidateId: string
  baseVenueId?: string
  venueId: string
}

export interface WaypointAssemblyObservationEvent {
  observerVersion: 'waypoint-assembly-observer.v1'
  owner: 'Waypoint'
  type: WaypointAssemblyObservationType
  stage: WaypointAssemblyObservationStage
  proves: 'entry' | 'return' | 'completion'
  operationId?: string
  coreCombinationIndex?: number
  wildcardComparisonIndex?: number
  candidateCount?: number
  rolePoolSizes?: {
    warmup: number
    peak: number
    wildcard: number
    cooldown: number
  }
  combination?: WaypointAssemblyStopIdentity[]
  wildcard?: WaypointAssemblyStopIdentity
  invalidReasonCodes?: string[]
  feasibilityReasonCodes?: string[]
  result?: string
}

export type WaypointAssemblyObserver = (event: WaypointAssemblyObservationEvent) => void
