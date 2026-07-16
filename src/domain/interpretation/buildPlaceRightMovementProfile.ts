import type {
  PersonaMode,
  RouteShapePlaceRightLocationClass,
  RouteShapePlaceRightMovementProfile,
} from '../types/intent'

type PlaceRightMovementProfileValues = Omit<
  RouteShapePlaceRightMovementProfile,
  'source' | 'reasonCodes'
>

const PLACE_RIGHT_MOVEMENT_PROFILE_MATRIX: Record<
  PersonaMode,
  Record<RouteShapePlaceRightLocationClass, PlaceRightMovementProfileValues>
> = {
  romantic: {
    'L1 Dense': {
      travelTolerance: 'tight',
      maxComfortableTotalMovementMinutes: 18,
      maxSingleTransitionMinutes: 10,
      maxClusterEscapes: 1,
      driveLikeMovement: 'discouraged',
    },
    'L2 Mid': {
      travelTolerance: 'tight',
      maxComfortableTotalMovementMinutes: 24,
      maxSingleTransitionMinutes: 14,
      maxClusterEscapes: 1,
      driveLikeMovement: 'limited',
    },
    'L3 Sparse': {
      travelTolerance: 'expanded',
      maxComfortableTotalMovementMinutes: 32,
      maxSingleTransitionMinutes: 18,
      maxClusterEscapes: 2,
      driveLikeMovement: 'acceptable',
    },
  },
  friends: {
    'L1 Dense': {
      travelTolerance: 'balanced',
      maxComfortableTotalMovementMinutes: 24,
      maxSingleTransitionMinutes: 12,
      maxClusterEscapes: 1,
      driveLikeMovement: 'limited',
    },
    'L2 Mid': {
      travelTolerance: 'balanced',
      maxComfortableTotalMovementMinutes: 32,
      maxSingleTransitionMinutes: 16,
      maxClusterEscapes: 2,
      driveLikeMovement: 'acceptable',
    },
    'L3 Sparse': {
      travelTolerance: 'expanded',
      maxComfortableTotalMovementMinutes: 42,
      maxSingleTransitionMinutes: 22,
      maxClusterEscapes: 2,
      driveLikeMovement: 'acceptable',
    },
  },
  family: {
    'L1 Dense': {
      travelTolerance: 'tight',
      maxComfortableTotalMovementMinutes: 18,
      maxSingleTransitionMinutes: 10,
      maxClusterEscapes: 1,
      driveLikeMovement: 'discouraged',
    },
    'L2 Mid': {
      travelTolerance: 'tight',
      maxComfortableTotalMovementMinutes: 24,
      maxSingleTransitionMinutes: 14,
      maxClusterEscapes: 1,
      driveLikeMovement: 'limited',
    },
    'L3 Sparse': {
      travelTolerance: 'expanded',
      maxComfortableTotalMovementMinutes: 34,
      maxSingleTransitionMinutes: 18,
      maxClusterEscapes: 2,
      driveLikeMovement: 'acceptable',
    },
  },
}

export function buildPlaceRightMovementProfile(params: {
  persona: PersonaMode
  locationClass: RouteShapePlaceRightLocationClass
}): RouteShapePlaceRightMovementProfile {
  const values = PLACE_RIGHT_MOVEMENT_PROFILE_MATRIX[params.persona][params.locationClass]
  return {
    source: 'interpretation_contract_constraints',
    ...values,
    reasonCodes: [
      'place_right_movement_profile:interpretation_authored',
      `location_class:${params.locationClass}`,
    ],
  }
}

export const interpretationPlaceRightMovementProfileMatrix = PLACE_RIGHT_MOVEMENT_PROFILE_MATRIX
