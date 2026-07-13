import type { BearingsRouteMovementConstraints } from '../../../domain/bearings/routeMovementConstraints'
import type { DirectionRouteShapeComposition } from '../../../domain/interpretation/direction/routeShapeComposition'
import type { RouteShapeContract } from '../../../domain/types/intent'
import type { WaypointRouteShapeContract } from './waypointRouteShapeContract'

export type RouteShapeCompatibilityProjection = RouteShapeContract

export interface RouteShapeOwnershipBuckets {
  directionComposition: DirectionRouteShapeComposition
  waypointRouteShape: WaypointRouteShapeContract
  bearingsMovementConstraints: BearingsRouteMovementConstraints
  compatibilityProjection: RouteShapeCompatibilityProjection
}
