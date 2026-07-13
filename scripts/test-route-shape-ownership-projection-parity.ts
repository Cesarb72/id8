import { isDeepStrictEqual } from 'node:util'
import { projectRouteShapeOwnership } from '../src/integrations/waypoint/coordination/projectRouteShapeOwnership.ts'
import type { RouteShapeContract } from '../src/domain/types/intent.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  if (!isDeepStrictEqual(actual, expected)) {
    throw new Error(`${message}\nactual: ${JSON.stringify(actual)}\nexpected: ${JSON.stringify(expected)}`)
  }
}

const routeShapeContract: RouteShapeContract = {
  id: 'rshape_v1_test_direction_intent_constraints',
  arcShape: 'fast_open_strong_center_clean_landing',
  roleProfile: {
    start: {
      intent: 'set-tone',
      energyLevel: 'low',
      pacing: 'quick',
      variability: 'guided-flex',
    },
    highlight: {
      intent: 'centerpiece',
      energyLevel: 'high',
      pacing: 'balanced',
      variability: 'fixed',
    },
    windDown: {
      intent: 'landing',
      energyLevel: 'low',
      pacing: 'linger',
      variability: 'guided-flex',
    },
  },
  roleInvariants: {
    start: {
      requiredTraits: ['low_friction', 'continuity'],
      preferredTraits: ['social', 'continuity'],
      forbiddenTraits: ['centerpiece'],
      minRelativeIntensity: 'low',
      maxRelativeIntensity: 'medium',
      allowSwapToWeaker: true,
      allowEscalation: false,
    },
    highlight: {
      requiredTraits: ['centerpiece'],
      preferredTraits: ['lively', 'social'],
      forbiddenTraits: ['buffer'],
      minRelativeIntensity: 'medium',
      maxRelativeIntensity: 'at_most_highlight',
      allowSwapToWeaker: false,
      allowEscalation: true,
    },
    windDown: {
      requiredTraits: ['continuity', 'settling'],
      preferredTraits: ['calm', 'buffer'],
      forbiddenTraits: ['centerpiece', 'late_night'],
      minRelativeIntensity: 'low',
      maxRelativeIntensity: 'below_highlight',
      allowSwapToWeaker: true,
      allowEscalation: false,
    },
    surprise: {
      requiredTraits: ['contrast'],
      preferredTraits: ['continuity'],
      forbiddenTraits: ['centerpiece'],
      minRelativeIntensity: 'low',
      maxRelativeIntensity: 'at_most_highlight',
      allowSwapToWeaker: true,
      allowEscalation: false,
    },
    support: {
      requiredTraits: ['continuity'],
      preferredTraits: ['buffer', 'low_friction'],
      forbiddenTraits: ['centerpiece'],
      minRelativeIntensity: 'low',
      maxRelativeIntensity: 'medium',
      allowSwapToWeaker: true,
      allowEscalation: false,
    },
  },
  movementProfile: {
    radius: 'tight',
    maxTransitionMinutes: 14,
    neighborhoodContinuity: 'strict',
  },
  mutationProfile: {
    swapFlexibility: 'low',
    allowedRoles: ['start', 'highlight', 'windDown'],
    preservePriority: ['role', 'feasibility', 'movement', 'district', 'family'],
  },
  expansionProfile: {
    supportsNearbyExtensions: true,
    preferredExpansionRole: 'highlight',
    lateNightTolerance: 'high',
  },
}

const projection = projectRouteShapeOwnership({ routeShapeContract })

assertDeepEqual(
  projection.compatibilityProjection,
  routeShapeContract,
  'Compatibility projection drifted from RouteShapeContract',
)
assert(
  projection.compatibilityProjection === routeShapeContract,
  'Compatibility projection should preserve the current RouteShapeContract object',
)

assertDeepEqual(
  projection.bearingsMovementConstraints.movementProfile,
  routeShapeContract.movementProfile,
  'Bearings movement profile drifted',
)
assert(
  projection.bearingsMovementConstraints.radius === routeShapeContract.movementProfile.radius,
  'Bearings radius drifted',
)
assert(
  projection.bearingsMovementConstraints.maxTransitionMinutes ===
    routeShapeContract.movementProfile.maxTransitionMinutes,
  'Bearings max transition drifted',
)
assert(
  projection.bearingsMovementConstraints.neighborhoodContinuity ===
    routeShapeContract.movementProfile.neighborhoodContinuity,
  'Bearings neighborhood continuity drifted',
)
assert(
  projection.bearingsMovementConstraints.feasibilityGuardrails.requireNeighborhoodContinuity,
  'Strict continuity should project to Bearings continuity guardrail',
)

assertDeepEqual(
  projection.waypointRouteShape.mutationProfile,
  routeShapeContract.mutationProfile,
  'Waypoint mutation profile drifted',
)
assertDeepEqual(
  projection.waypointRouteShape.roleOrder,
  routeShapeContract.mutationProfile.allowedRoles,
  'Waypoint role order drifted from clean structural roles',
)
assertDeepEqual(
  projection.waypointRouteShape.structuralPreservationRules.allowedRoles,
  routeShapeContract.mutationProfile.allowedRoles,
  'Waypoint allowed roles drifted',
)
assertDeepEqual(
  projection.waypointRouteShape.structuralPreservationRules.preservePriority,
  routeShapeContract.mutationProfile.preservePriority,
  'Waypoint preserve priority drifted',
)
assert(
  projection.waypointRouteShape.structuralPreservationRules.swapFlexibility ===
    routeShapeContract.mutationProfile.swapFlexibility,
  'Waypoint swap flexibility drifted',
)

assert(
  projection.directionComposition === undefined,
  'Direction composition must not be invented from RouteShapeContract alone',
)
assert(
  projection.directionProjectionStatus === 'not_projected_from_route_shape_contract_only',
  'Direction projection status should disclose missing source inputs',
)

assertDeepEqual(
  projection.compatibilityProjection.roleProfile,
  routeShapeContract.roleProfile,
  'Parked roleProfile residue drifted from compatibility projection',
)
assertDeepEqual(
  projection.compatibilityProjection.roleInvariants,
  routeShapeContract.roleInvariants,
  'Parked roleInvariants residue drifted from compatibility projection',
)
assert(
  projection.compatibilityProjection.mutationProfile.preservePriority.includes('family'),
  'Parked preservePriority.family residue must remain in compatibility projection',
)
assert(
  projection.compatibilityProjection.expansionProfile.lateNightTolerance === 'high',
  'Parked lateNightTolerance residue must remain in compatibility projection',
)
assert(
  projection.compatibilityProjection.roleInvariants.highlight.preferredTraits.includes('lively') &&
    projection.compatibilityProjection.roleInvariants.windDown.preferredTraits.includes('calm'),
  'Parked semantic role-invariant traits must remain in compatibility projection',
)
assert(
  projection.parkedPhase5CompositionResidue.includes('roleProfile') &&
    projection.parkedPhase5CompositionResidue.includes('roleInvariants') &&
    projection.parkedPhase5CompositionResidue.includes('mutationProfile.preservePriority.family') &&
    projection.parkedPhase5CompositionResidue.includes('expansionProfile.lateNightTolerance') &&
    projection.parkedPhase5CompositionResidue.includes('roleInvariants.semanticTraits'),
  'Phase 5 parked residue list is incomplete',
)
assert(
  !Object.prototype.hasOwnProperty.call(projection.waypointRouteShape, 'roleProfile') &&
    !Object.prototype.hasOwnProperty.call(projection.waypointRouteShape, 'roleInvariants') &&
    !Object.prototype.hasOwnProperty.call(projection.waypointRouteShape, 'expansionProfile'),
  'Waypoint projection should not absorb mixed Phase 5 composition residue',
)

console.log('[route-shape-ownership-projection-parity] PASS')
console.log('[route-shape-ownership-projection-parity] provider/network calls: 0')
