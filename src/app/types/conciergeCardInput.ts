import type { TasteModeId } from '../../domain/taste/selectTasteMode'
import type { VibeTasteProfileId } from '../../domain/taste/resolveVibeTasteProfile'
import type {
  ConciergeObjectiveOccasion,
  PersonaMode,
  VibeAnchor,
} from '../../domain/types/intent'

export type ConciergeCardSpatialMode = 'WALKABLE' | 'FLEXIBLE'
export type ConciergeCardVibeUxProfile = 'lively' | 'cozy' | 'cultured'

export interface ConciergeCardWhenDraft {
  startTime?: string
  durationMinutes: number | null
  spatialMode: ConciergeCardSpatialMode
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
  when: ConciergeCardWhenDraft
  vibe: ConciergeCardVibeDraft
}
