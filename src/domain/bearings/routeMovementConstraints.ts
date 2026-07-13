import type { RouteShapeContract } from '../types/intent'

export interface BearingsRouteMovementConstraints {
  source: 'bearings'
  movementProfile: RouteShapeContract['movementProfile']
  radius: RouteShapeContract['movementProfile']['radius']
  maxTransitionMinutes: RouteShapeContract['movementProfile']['maxTransitionMinutes']
  neighborhoodContinuity: RouteShapeContract['movementProfile']['neighborhoodContinuity']
  movementPosture: 'tight' | 'balanced' | 'open'
  feasibilityGuardrails: {
    requireNeighborhoodContinuity: boolean
    allowClusterEscape: boolean
    maxDriveMinutes: number
    maxWalkMinutes: number
  }
}
