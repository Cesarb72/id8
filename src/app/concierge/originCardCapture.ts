import type {
  ConciergeCardInputDraft,
  ConciergeCardOriginDraft,
} from '../types/conciergeCardInput'
import type { DistrictPoint } from '../../engines/district/types/districtTypes'

export type ConciergeCardOriginCaptureUpdate =
  | {
      status: 'geolocation_precise'
      userLatLng: DistrictPoint
      locationQuery?: string
    }
  | {
      status: 'explicit_origin'
      explicitOriginText: string
      locationQuery?: string
    }
  | {
      status: 'denied'
      locationQuery?: string
    }
  | {
      status: 'omitted'
      locationQuery?: string
    }
  | {
      status: 'unknown_fallback'
      locationQuery?: string
    }

export function buildDefaultConciergeCardOriginDraft(): ConciergeCardOriginDraft {
  return {
    status: 'omitted',
    originPrecision: 'unknown',
    originSource: 'unknown',
    posture: 'softest',
    captureNeeded: true,
    capturePath: 'choose_origin_method',
    reason: 'Origin omitted; keep the softest movement posture and ask for capture when needed.',
  }
}

export function buildDeniedConciergeCardOriginDraft(): ConciergeCardOriginDraft {
  return {
    status: 'denied',
    originPrecision: 'unknown',
    originSource: 'unknown',
    posture: 'softest',
    captureNeeded: true,
    capturePath: 'enter_explicit_origin',
    reason: 'Location permission denied; preserve unknown origin and offer explicit origin entry.',
  }
}

export function applyConciergeCardOriginCapture(
  current: ConciergeCardInputDraft,
  update: ConciergeCardOriginCaptureUpdate,
): ConciergeCardInputDraft {
  let origin: ConciergeCardOriginDraft
  if (update.status === 'geolocation_precise') {
    origin = {
      status: update.status,
      locationQuery: update.locationQuery ?? 'Current location',
      userLatLng: update.userLatLng,
      originPrecision: 'precise',
      originSource: 'geolocation',
      posture: 'strict',
      captureNeeded: false,
      capturePath: 'none',
      reason: 'Precise geolocation captured by user action.',
    }
  } else if (update.status === 'explicit_origin') {
    origin = {
      status: update.status,
      locationQuery: update.locationQuery ?? update.explicitOriginText,
      explicitOriginText: update.explicitOriginText.trim(),
      originPrecision: 'precise',
      originSource: 'explicit_origin',
      posture: 'strict',
      captureNeeded: false,
      capturePath: 'none',
      reason: 'Explicit origin captured without live geocoding.',
    }
  } else if (update.status === 'denied') {
    origin = {
      ...buildDeniedConciergeCardOriginDraft(),
      locationQuery: update.locationQuery,
    }
  } else if (update.status === 'unknown_fallback') {
    origin = {
      status: update.status,
      locationQuery: update.locationQuery,
      originPrecision: 'unknown',
      originSource: 'unknown',
      posture: 'softest',
      captureNeeded: true,
      capturePath: 'choose_origin_method',
      reason: 'Origin is unresolved; keep the softest movement posture and preserve capture path.',
    }
  } else {
    origin = {
      ...buildDefaultConciergeCardOriginDraft(),
      locationQuery: update.locationQuery,
    }
  }

  return {
    ...current,
    origin,
  }
}
