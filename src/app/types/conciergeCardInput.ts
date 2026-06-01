import type { TasteModeId } from '../../domain/taste/selectTasteMode'
import type { VibeTasteProfileId } from '../../domain/taste/resolveVibeTasteProfile'
import type {
  ConciergeObjectiveOccasion,
  PersonaMode,
  VibeAnchor,
} from '../../domain/types/intent'
import {
  buildWhenSignalProfile,
  type ConciergeCardSpatialMode,
  type WhenSignalDraftInput,
  type WhenSignalDurationBand,
  type WhenSignalMovementPreference,
  type WhenSignalProfile,
  type WhenSignalTimePhase,
} from '../../domain/when/whenSignalProfile'

export { buildWhenSignalProfile }
export type {
  ConciergeCardSpatialMode,
  WhenSignalDurationBand,
  WhenSignalMovementPreference,
  WhenSignalProfile,
  WhenSignalTimePhase,
}

export type ConciergeCardVibeUxProfile = 'lively' | 'cozy' | 'cultured'

export type ConciergeCardWhenDraft = WhenSignalDraftInput

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
  when: ConciergeCardWhenDraft
  whenSignalProfile: WhenSignalProfile
  vibe: ConciergeCardVibeDraft
}
