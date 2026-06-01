import type { TasteModeId } from '../../domain/taste/selectTasteMode'
import type { VibeTasteProfileId } from '../../domain/taste/resolveVibeTasteProfile'
import type {
  ConciergeObjectiveOccasion,
  PersonaMode,
  VibeAnchor,
} from '../../domain/types/intent'

export type ConciergeCardSpatialMode = 'WALKABLE' | 'FLEXIBLE'
export type ConciergeCardVibeUxProfile = 'lively' | 'cozy' | 'cultured'
export type WhenSignalTimePhase =
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'late-night'
  | 'unspecified'
export type WhenSignalDurationBand = 'short' | 'standard' | 'extended' | 'unspecified'
export type WhenSignalMovementPreference = 'walkable' | 'flexible'

export interface ConciergeCardWhenDraft {
  startTime?: string
  durationMinutes: number | null
  spatialMode: ConciergeCardSpatialMode
}

export interface WhenSignalProfile {
  startTime?: string
  durationMinutes: number | null
  spatialMode: ConciergeCardSpatialMode
  timePhase: WhenSignalTimePhase
  durationBand: WhenSignalDurationBand
  movementPreference: WhenSignalMovementPreference
  reasonSummary: string
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
  whenSignalProfile: WhenSignalProfile
  vibe: ConciergeCardVibeDraft
}

function parseHourFromStartTime(startTime: string | undefined): number | undefined {
  const normalized = startTime?.trim().toLowerCase()
  if (!normalized) {
    return undefined
  }

  const directMatches: Array<[string[], number]> = [
    [['breakfast', 'morning', 'coffee'], 9],
    [['brunch', 'lunch', 'daytime', 'afternoon'], 13],
    [['sunset', 'dinner', 'evening', 'date-night'], 19],
    [['late-night', 'nightcap', 'after-dark', 'night'], 22],
  ]

  for (const [candidates, hour] of directMatches) {
    if (candidates.some((candidate) => normalized.includes(candidate))) {
      return hour
    }
  }

  const match = normalized.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/)
  if (!match) {
    return undefined
  }

  let hour = Number(match[1])
  const meridiem = match[3]
  if (meridiem === 'pm' && hour < 12) {
    hour += 12
  }
  if (meridiem === 'am' && hour === 12) {
    hour = 0
  }
  return Math.max(0, Math.min(23, hour))
}

function getTimePhase(startTime: string | undefined): WhenSignalTimePhase {
  const hour = parseHourFromStartTime(startTime)
  if (hour === undefined) {
    return 'unspecified'
  }
  if (hour < 11) {
    return 'morning'
  }
  if (hour < 17) {
    return 'afternoon'
  }
  if (hour < 22) {
    return 'evening'
  }
  return 'late-night'
}

function getDurationBand(durationMinutes: number | null): WhenSignalDurationBand {
  if (durationMinutes == null) {
    return 'unspecified'
  }
  if (durationMinutes <= 90) {
    return 'short'
  }
  if (durationMinutes <= 210) {
    return 'standard'
  }
  return 'extended'
}

export function buildWhenSignalProfile(when: ConciergeCardWhenDraft): WhenSignalProfile {
  const startTime = when.startTime?.trim() || undefined
  const timePhase = getTimePhase(startTime)
  const durationBand = getDurationBand(when.durationMinutes)
  const movementPreference =
    when.spatialMode === 'FLEXIBLE' ? 'flexible' : 'walkable'
  const reasonSummary = [
    timePhase === 'unspecified'
      ? 'no explicit start time'
      : `time phase ${timePhase}`,
    durationBand === 'unspecified'
      ? 'duration unspecified'
      : `duration ${durationBand}`,
    `movement ${movementPreference}`,
  ].join(' | ')

  return {
    startTime,
    durationMinutes: when.durationMinutes,
    spatialMode: when.spatialMode,
    timePhase,
    durationBand,
    movementPreference,
    reasonSummary,
  }
}
