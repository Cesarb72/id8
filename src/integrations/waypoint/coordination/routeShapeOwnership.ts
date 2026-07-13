import type { BearingsRouteMovementConstraints } from '../../../domain/bearings/routeMovementConstraints'
import type { DirectionRouteShapeComposition } from '../../../domain/interpretation/direction/routeShapeComposition'
import type { RouteShapeContract } from '../../../domain/types/intent'
import type { WaypointRouteShapeContract } from './waypointRouteShapeContract'

export type RouteShapeCompatibilityProjection = RouteShapeContract

export type RouteShapeDirectionProjectionStatus =
  | 'projected_from_direction_source_inputs'
  | 'not_projected_from_route_shape_contract_only'

export type RouteShapePhase5CompositionResidue =
  | 'roleProfile'
  | 'roleInvariants'
  | 'mutationProfile.preservePriority.family'
  | 'expansionProfile.lateNightTolerance'
  | 'roleInvariants.semanticTraits'

export interface RouteShapeOwnershipBuckets {
  directionComposition: DirectionRouteShapeComposition
  waypointRouteShape: WaypointRouteShapeContract
  bearingsMovementConstraints: BearingsRouteMovementConstraints
  compatibilityProjection: RouteShapeCompatibilityProjection
}

export interface RouteShapeOwnershipProjection {
  directionComposition?: DirectionRouteShapeComposition
  directionProjectionStatus: RouteShapeDirectionProjectionStatus
  directionProjectionReason: string
  waypointRouteShape: WaypointRouteShapeContract
  bearingsMovementConstraints: BearingsRouteMovementConstraints
  compatibilityProjection: RouteShapeCompatibilityProjection
  parkedPhase5CompositionResidue: RouteShapePhase5CompositionResidue[]
}
