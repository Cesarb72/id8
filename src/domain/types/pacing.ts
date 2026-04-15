export type DurationClass = 'XS' | 'S' | 'M' | 'L' | 'XL'

export type RouteMovementMode = 'walkable' | 'short-drive' | 'drive'

export type RouteContinuity = 'same-neighborhood' | 'adjacent-neighborhoods' | 'spread'

export interface EstimatedStopDuration {
  roleKey: string
  venueId: string
  durationClass: DurationClass
  estimatedDurationMinutes: number
}

export interface EstimatedTransition {
  fromRoleKey: string
  toRoleKey: string
  fromVenueId: string
  toVenueId: string
  estimatedTravelMinutes: number
  transitionBufferMinutes: number
  estimatedTransitionMinutes: number
  frictionScore: number
  movementMode: RouteMovementMode
  neighborhoodContinuity: RouteContinuity
  energyDelta: number
  notes: string[]
}

export interface RoutePacingAnalysis {
  stops: EstimatedStopDuration[]
  transitions: EstimatedTransition[]
  estimatedStopMinutes: number
  estimatedTransitionMinutes: number
  estimatedTotalMinutes: number
  estimatedTotalLabel: string
  totalRouteFriction: number
  averageTransitionFriction: number
  routeFeelLabel: string
  pacingScore: number
  transitionSmoothnessScore: number
  outingLengthScore: number
  awkwardPacingPenalty: number
  pacingPenaltyApplied: boolean
  pacingPenaltyReasons: string[]
  smoothProgressionRewardApplied: boolean
  smoothProgressionRewardReasons: string[]
}
