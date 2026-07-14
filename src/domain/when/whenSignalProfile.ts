export type ConciergeCardSpatialMode = 'WALKABLE' | 'FLEXIBLE'
export type WhenSignalPosture =
  | 'now_doable_tonight'
  | 'later_tonight'
  | 'this_weekend'
  | 'next_week'
  | 'pick_a_time'
export type WhenSignalInputSource = 'defaulted' | 'user_supplied'
export type WhenSignalTimePhase =
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'late-night'
  | 'unspecified'
export type WhenSignalDurationBand = 'short' | 'standard' | 'extended' | 'unspecified'
export type WhenSignalMovementPreference = 'walkable' | 'flexible'
export type WhenSpatialScoringMode = 'off' | 'soft_curate_spatial'

export interface WhenSignalDraftInput {
  whenPosture?: WhenSignalPosture
  whenPostureSource?: WhenSignalInputSource
  startTime?: string
  durationMinutes: number | null
  durationSource?: WhenSignalInputSource
  spatialMode: ConciergeCardSpatialMode
  flexibilitySource?: WhenSignalInputSource
}

export interface WhenSignalProfile {
  whenPosture: WhenSignalPosture
  whenPostureSource: WhenSignalInputSource
  whenDefaulted: boolean
  startTime?: string
  durationMinutes: number | null
  durationSource: WhenSignalInputSource
  spatialMode: ConciergeCardSpatialMode
  flexibilitySource: WhenSignalInputSource
  timePhase: WhenSignalTimePhase
  durationBand: WhenSignalDurationBand
  movementPreference: WhenSignalMovementPreference
  eventsReadiness: {
    seam: 'when_plus_where'
    status: 'parked'
    canSeedFutureEventsQuery: boolean
    reason: string
  }
  reasonSummary: string
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

export function buildWhenSignalProfile(when: WhenSignalDraftInput): WhenSignalProfile {
  const whenPosture = when.whenPosture ?? 'now_doable_tonight'
  const whenPostureSource =
    when.whenPostureSource ?? (when.whenPosture ? 'user_supplied' : 'defaulted')
  const startTime = when.startTime?.trim() || undefined
  const timePhase = getTimePhase(startTime)
  const durationBand = getDurationBand(when.durationMinutes)
  const durationSource =
    when.durationSource ?? (when.durationMinutes == null ? 'defaulted' : 'user_supplied')
  const flexibilitySource = when.flexibilitySource ?? 'defaulted'
  const movementPreference =
    when.spatialMode === 'FLEXIBLE' ? 'flexible' : 'walkable'
  const reasonSummary = [
    `when ${whenPosture}`,
    timePhase === 'unspecified'
      ? 'no explicit start time'
      : `time phase ${timePhase}`,
    durationBand === 'unspecified'
      ? 'duration unspecified'
      : `duration ${durationBand}`,
    `movement ${movementPreference}`,
  ].join(' | ')

  return {
    whenPosture,
    whenPostureSource,
    whenDefaulted: whenPostureSource === 'defaulted',
    startTime,
    durationMinutes: when.durationMinutes,
    durationSource,
    spatialMode: when.spatialMode,
    flexibilitySource,
    timePhase,
    durationBand,
    movementPreference,
    eventsReadiness: {
      seam: 'when_plus_where',
      status: 'parked',
      canSeedFutureEventsQuery: true,
      reason: 'When posture is structured for a future when+where Events query; Events behavior is parked.',
    },
    reasonSummary,
  }
}
