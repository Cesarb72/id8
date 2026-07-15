import type { TasteModeId } from '../../domain/taste/selectTasteMode'
import type { VibeTasteProfileId } from '../../domain/taste/resolveVibeTasteProfile'
import type {
  ConciergeObjectiveOccasion,
  ConciergeObjectiveSource,
  PersonaMode,
  VibeAnchor,
} from '../../domain/types/intent'
import type {
  DistrictPoint,
  MovementOriginPrecision,
  MovementOriginSource,
} from '../../engines/district/types/districtTypes'
import {
  buildWhenSignalProfile,
  type ConciergeCardSpatialMode,
  type WhenSignalInputSource,
  type WhenSignalDraftInput,
  type WhenSignalDurationBand,
  type WhenSignalMovementPreference,
  type WhenSignalPosture,
  type WhenSignalProfile,
  type WhenSignalTimePhase,
} from '../../domain/when/whenSignalProfile'

export { buildWhenSignalProfile }
export type {
  ConciergeCardSpatialMode,
  WhenSignalInputSource,
  WhenSignalDurationBand,
  WhenSignalMovementPreference,
  WhenSignalPosture,
  WhenSignalProfile,
  WhenSignalTimePhase,
}

export type ConciergeCardVibeUxProfile = 'lively' | 'cozy' | 'cultured'

export type ConciergeCardWhenDraft = WhenSignalDraftInput
export type ConciergeCardOriginCaptureStatus =
  | 'geolocation_precise'
  | 'explicit_origin'
  | 'denied'
  | 'omitted'
  | 'unknown_fallback'
export type ConciergeCardOriginCapturePosture = 'strict' | 'medium' | 'broad' | 'softest'
export type ConciergeCardOriginCapturePath =
  | 'none'
  | 'request_geolocation'
  | 'enter_explicit_origin'
  | 'choose_origin_method'

export interface ConciergeCardOriginDraft {
  status: ConciergeCardOriginCaptureStatus
  locationQuery?: string
  userLatLng?: DistrictPoint
  explicitOriginText?: string
  originPrecision: MovementOriginPrecision
  originSource: MovementOriginSource
  posture: ConciergeCardOriginCapturePosture
  captureNeeded: boolean
  capturePath: ConciergeCardOriginCapturePath
  reason: string
}

export interface ConciergeCardVibeDraft {
  selectedVibe: VibeAnchor
  uxProfile: ConciergeCardVibeUxProfile
  tasteProfileId: TasteModeId | null
  vibeTasteProfileId: VibeTasteProfileId | null
}

export interface ConciergeCardInputDraft {
  city: string
  persona: PersonaMode
  objectiveOccasion: ConciergeObjectiveOccasion
  objectiveSource?: ConciergeObjectiveSource
  objectiveDefaulted?: boolean
  when: ConciergeCardWhenDraft
  whenSignalProfile: WhenSignalProfile
  origin?: ConciergeCardOriginDraft
  vibe: ConciergeCardVibeDraft
}
