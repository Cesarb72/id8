import type {
  RouteShapeArcShape,
  RouteShapeContract,
  RouteShapeRole,
} from '../../../domain/types/intent'

export interface WaypointRouteShapeContract {
  source: 'waypoint'
  arcShape: RouteShapeArcShape
  roleOrder: RouteShapeRole[]
  mutationProfile: RouteShapeContract['mutationProfile']
  structuralPreservationRules: {
    requiredRoles: RouteShapeRole[]
    allowedRoles: RouteShapeContract['mutationProfile']['allowedRoles']
    preservePriority: RouteShapeContract['mutationProfile']['preservePriority']
    swapFlexibility: RouteShapeContract['mutationProfile']['swapFlexibility']
  }
  allowedRouteShapeActions: Array<
    | 'preserve_role_order'
    | 'swap_within_role'
    | 'expand_nearby'
    | 'replace_by_role'
    | 'reject_structural_drift'
  >
}
