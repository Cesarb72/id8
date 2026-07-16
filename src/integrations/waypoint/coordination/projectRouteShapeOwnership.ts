import type { BearingsRouteMovementConstraints } from '../../../domain/bearings/routeMovementConstraints'
import type { DirectionRouteShapeComposition } from '../../../domain/interpretation/direction/routeShapeComposition'
import type { DirectionPlanningSelection } from '../../../domain/interpretation/direction/selectedDirectionProjection'
import type {
  ConciergeIntent,
  ContractConstraints,
  ResolvedDirectionContext,
  RouteShapeContract,
  RouteShapeRole,
} from '../../../domain/types/intent'
import type {
  RouteShapeOwnershipProjection,
  RouteShapePhase5CompositionResidue,
} from './routeShapeOwnership'
import type { WaypointRouteShapeContract } from './waypointRouteShapeContract'

export const ROUTE_SHAPE_PHASE5_COMPOSITION_RESIDUE: RouteShapePhase5CompositionResidue[] = [
  'roleProfile',
  'roleInvariants',
  'mutationProfile.preservePriority.family',
  'expansionProfile.lateNightTolerance',
  'roleInvariants.semanticTraits',
]

export interface DirectionRouteShapeCompositionProjectionInput {
  selectedDirection: DirectionPlanningSelection
  selectedDirectionContext: ResolvedDirectionContext
  conciergeIntent: ConciergeIntent
  contractConstraints: ContractConstraints
}

export interface ProjectRouteShapeOwnershipInput {
  routeShapeContract: RouteShapeContract
  directionCompositionInput?: DirectionRouteShapeCompositionProjectionInput
}

function projectDirectionRouteShapeComposition(
  routeShapeContract: RouteShapeContract,
  input: DirectionRouteShapeCompositionProjectionInput,
): DirectionRouteShapeComposition {
  const {
    selectedDirection,
    selectedDirectionContext,
    conciergeIntent,
    contractConstraints,
  } = input
  return {
    source: 'direction',
    selectedDirectionId: selectedDirectionContext.selectedDirectionId,
    selectedPocketId: selectedDirectionContext.selectedPocketId,
    selectedDirectionIdentity: selectedDirection.identity,
    selectedDirection: {
      id: selectedDirection.id,
      label: selectedDirection.label,
      pocketId: selectedDirection.pocketId,
      pocketLabel: selectedDirection.pocketLabel,
      archetype: selectedDirection.archetype,
      cluster: selectedDirection.cluster,
      identity: selectedDirection.identity,
      experienceFamily: selectedDirection.experienceFamily,
      familyConfidence: selectedDirection.familyConfidence,
    },
    selectedDirectionContext: {
      selectedDirectionId: selectedDirectionContext.selectedDirectionId,
      selectedPocketId: selectedDirectionContext.selectedPocketId,
      label: selectedDirectionContext.label,
      archetype: selectedDirectionContext.archetype,
      identity: selectedDirectionContext.identity,
    },
    conciergeIntentId: conciergeIntent.id,
    contractConstraintsId: contractConstraints.id,
    intendedArcShape: routeShapeContract.arcShape,
    experienceFamily: selectedDirection.experienceFamily,
    familyConfidence: selectedDirection.familyConfidence,
    compositionPosture: {
      requireEscalation: contractConstraints.requireEscalation,
      peakCountModel: contractConstraints.peakCountModel,
      highlightPressure: contractConstraints.highlightPressure,
      requireContinuity: contractConstraints.requireContinuity,
    },
  }
}

function projectBearingsMovementConstraints(
  routeShapeContract: RouteShapeContract,
): BearingsRouteMovementConstraints {
  const movementProfile = routeShapeContract.movementProfile
  return {
    source: 'bearings',
    movementProfile,
    radius: movementProfile.radius,
    maxTransitionMinutes: movementProfile.maxTransitionMinutes,
    neighborhoodContinuity: movementProfile.neighborhoodContinuity,
    placeRightTolerance: movementProfile.placeRightTolerance,
    movementPosture: movementProfile.radius,
    feasibilityGuardrails: {
      requireNeighborhoodContinuity: movementProfile.neighborhoodContinuity === 'strict',
      allowClusterEscape: movementProfile.neighborhoodContinuity !== 'strict',
    },
  }
}

function projectWaypointRouteShapeContract(
  routeShapeContract: RouteShapeContract,
): WaypointRouteShapeContract {
  const allowedRoles = routeShapeContract.mutationProfile.allowedRoles
  const canonicalRoleOrder: RouteShapeRole[] = ['start', 'highlight', 'windDown']
  const roleOrder = canonicalRoleOrder.filter((role) => allowedRoles.includes(role))
  return {
    source: 'waypoint',
    arcShape: routeShapeContract.arcShape,
    roleOrder,
    mutationProfile: routeShapeContract.mutationProfile,
    structuralPreservationRules: {
      requiredRoles: roleOrder,
      allowedRoles,
      preservePriority: routeShapeContract.mutationProfile.preservePriority,
      swapFlexibility: routeShapeContract.mutationProfile.swapFlexibility,
    },
    allowedRouteShapeActions: [
      'preserve_role_order',
      'swap_within_role',
      'expand_nearby',
      'replace_by_role',
      'reject_structural_drift',
    ],
  }
}

export function projectRouteShapeOwnership(
  input: ProjectRouteShapeOwnershipInput,
): RouteShapeOwnershipProjection {
  const { routeShapeContract, directionCompositionInput } = input
  const directionComposition = directionCompositionInput
    ? projectDirectionRouteShapeComposition(routeShapeContract, directionCompositionInput)
    : undefined
  return {
    directionComposition,
    directionProjectionStatus: directionComposition
      ? 'projected_from_direction_source_inputs'
      : 'not_projected_from_route_shape_contract_only',
    directionProjectionReason: directionComposition
      ? 'Direction composition projected from selected direction, selected direction context, ConciergeIntent, and contract constraints.'
      : 'RouteShapeContract alone does not carry enough provenance to author DirectionRouteShapeComposition.',
    waypointRouteShape: projectWaypointRouteShapeContract(routeShapeContract),
    bearingsMovementConstraints: projectBearingsMovementConstraints(routeShapeContract),
    compatibilityProjection: routeShapeContract,
    parkedPhase5CompositionResidue: ROUTE_SHAPE_PHASE5_COMPOSITION_RESIDUE,
  }
}
