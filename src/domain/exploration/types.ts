import type { GeneratePlanResult } from '../runGeneratePlan'
import type { PlanningTimePhase } from '../types/hours'
import type { IntentInput, VibeAnchor } from '../types/intent'
import type { Itinerary } from '../types/itinerary'

export type ExplorationDistrictStrategy = 'stay-put' | 'shift-district'
export type ExplorationVibeShift = 'MAINTAIN' | 'LIFT' | 'SOFTEN' | 'LAND'
export type ExplorationResolutionStrength = 'NONE' | 'MODERATE' | 'STRONG'
export type ExplorationContinuationMode =
  | 'FULL_CONTINUATION'
  | 'COMPACT_CONTINUATION'
  | 'CONTINUATION_FRAGMENT'

export interface DerivedNextContext {
  nextIntent: IntentInput
  districtStrategy: ExplorationDistrictStrategy
  vibeShift: ExplorationVibeShift
  resolutionStrength: ExplorationResolutionStrength
  continuationMode: ExplorationContinuationMode
  timePhase: PlanningTimePhase
  nextDistrictLabel?: string
  continuationNeighborhood?: string
  nextPrimaryVibe: VibeAnchor
  outingResolved: boolean
  resolvedReason: string
  continuationReason: string
  districtReason: string
  vibeReason: string
  repetitionReason: string
  summary: string
}

export interface ExplorationPlan {
  arc1: GeneratePlanResult
  transition: DerivedNextContext
  arc2: GeneratePlanResult
  displayItinerary: Itinerary
}
