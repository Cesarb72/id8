import type {
  MovementOriginPrecision,
  MovementOriginSource,
} from '../../engines/district/types/districtTypes'

export type OriginMovementProjectionPrecision = MovementOriginPrecision | 'anchor' | 'venue'
export type OriginMovementProjectionSource =
  | MovementOriginSource
  | 'anchor_fallback'
  | 'venue_fallback'
  | 'anchor_user_selected'
  | 'venue_user_selected'
export type OriginMovementStrictness = 'strict' | 'medium' | 'broad' | 'softest' | 'invalid'
export type OriginMovementRadiusPosture = 'tight' | 'medium' | 'soft' | 'softest' | 'invalid'

export interface ProjectOriginMovementPostureInput {
  originPrecision?: OriginMovementProjectionPrecision
  originSource?: OriginMovementProjectionSource
  userSelectedStartNearAnchor?: boolean
}

export interface OriginMovementPostureProjection {
  source: 'bearings'
  originPrecision: OriginMovementProjectionPrecision
  originSource: OriginMovementProjectionSource
  strictness: OriginMovementStrictness
  movementRadiusPosture: OriginMovementRadiusPosture
  captureNeeded: boolean
  diagnosticReason: string
  fallbackEstimated: boolean
  allowsTightWalkableClaims: boolean
  valid: boolean
}

function projection(
  input: ProjectOriginMovementPostureInput,
  values: Omit<
    OriginMovementPostureProjection,
    'source' | 'originPrecision' | 'originSource'
  >,
): OriginMovementPostureProjection {
  return {
    source: 'bearings',
    originPrecision: input.originPrecision ?? 'unknown',
    originSource: input.originSource ?? 'unknown',
    ...values,
  }
}

function isAnchorOrVenueFallback(input: ProjectOriginMovementPostureInput): boolean {
  return (
    input.originPrecision === 'anchor' ||
    input.originPrecision === 'venue' ||
    input.originSource === 'anchor_fallback' ||
    input.originSource === 'venue_fallback' ||
    input.originSource === 'anchor_user_selected' ||
    input.originSource === 'venue_user_selected'
  )
}

export function projectOriginMovementPosture(
  input: ProjectOriginMovementPostureInput,
): OriginMovementPostureProjection {
  if (isAnchorOrVenueFallback(input)) {
    if (!input.userSelectedStartNearAnchor) {
      return projection(input, {
        strictness: 'invalid',
        movementRadiusPosture: 'invalid',
        captureNeeded: true,
        diagnosticReason:
          'Anchor/venue fallback cannot become movement origin unless the user explicitly chooses start-near-anchor.',
        fallbackEstimated: true,
        allowsTightWalkableClaims: false,
        valid: false,
      })
    }
    return projection(input, {
      strictness: 'medium',
      movementRadiusPosture: 'medium',
      captureNeeded: false,
      diagnosticReason:
        'User explicitly selected start-near-anchor; anchor origin can be used as an estimated movement posture, not precise GPS.',
      fallbackEstimated: true,
      allowsTightWalkableClaims: false,
      valid: true,
    })
  }

  if (
    input.originPrecision === 'precise' &&
    (input.originSource === 'geolocation' || input.originSource === 'explicit_origin')
  ) {
    return projection(input, {
      strictness: 'strict',
      movementRadiusPosture: 'tight',
      captureNeeded: false,
      diagnosticReason: 'Precise user origin supports strict movement posture.',
      fallbackEstimated: false,
      allowsTightWalkableClaims: true,
      valid: true,
    })
  }

  if (
    input.originPrecision === 'neighborhood' &&
    input.originSource === 'neighborhood_fallback'
  ) {
    return projection(input, {
      strictness: 'medium',
      movementRadiusPosture: 'medium',
      captureNeeded: false,
      diagnosticReason:
        'Neighborhood fallback is estimated; use medium movement posture and block tight walkable claims.',
      fallbackEstimated: true,
      allowsTightWalkableClaims: false,
      valid: true,
    })
  }

  if (input.originPrecision === 'city' && input.originSource === 'city_fallback') {
    return projection(input, {
      strictness: 'broad',
      movementRadiusPosture: 'soft',
      captureNeeded: false,
      diagnosticReason:
        'City fallback is broad; use soft movement posture and block tight walkable claims.',
      fallbackEstimated: true,
      allowsTightWalkableClaims: false,
      valid: true,
    })
  }

  return projection(input, {
    strictness: 'softest',
    movementRadiusPosture: 'softest',
    captureNeeded: true,
    diagnosticReason:
      'Unknown or omitted origin cannot support precise movement claims; keep capture path open.',
    fallbackEstimated: true,
    allowsTightWalkableClaims: false,
    valid: true,
  })
}
