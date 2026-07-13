import type {
  RoleProfile,
  RouteRoleInvariants,
  RouteShapeArcShape,
  RouteShapeContract,
  RouteShapeRole,
} from '../../../domain/types/intent'

export interface WaypointRouteShapeContract {
  source: 'waypoint'
  arcShape: RouteShapeArcShape
  roleOrder: RouteShapeRole[]
  roleProfile: Record<RouteShapeRole, RoleProfile>
  roleInvariants: RouteRoleInvariants
  mutationProfile: RouteShapeContract['mutationProfile']
  expansionProfile: RouteShapeContract['expansionProfile']
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
