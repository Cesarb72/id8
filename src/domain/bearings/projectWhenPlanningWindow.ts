import type { PlanningTimePhase, PlanningTimeWindowSignal } from '../types/hours'
import type { WhenSignalPosture, WhenSignalProfile } from '../when/whenSignalProfile'

export type BearingsWhenPlanningWindowStrictness = 'soft' | 'medium' | 'broad' | 'strict'
export type BearingsWhenPlanningWindowKind =
  | 'runtime_now'
  | 'posture_representative'
  | 'broad_future'
  | 'explicit_time'
  | 'invalid_explicit_time'

export type BearingsWhenHoursPosture =
  | 'defaulted_time_relaxation_allowed'
  | 'posture_time_relaxation_allowed'
  | 'explicit_time_requires_known_hours'
  | 'broad_future_do_not_hard_block_known_hours'
  | 'invalid_time_no_fallback'

export interface BearingsWhenProjectedPlanningWindow {
  day: number
  hour: number
  minute: number
  phase: PlanningTimePhase
  label: string
  localDate: string
}

export interface BearingsWhenPlanningWindowProjection {
  posture: WhenSignalPosture
  whenDefaulted: boolean
  whenPostureSource: WhenSignalProfile['whenPostureSource']
  startTime?: string
  durationMinutes: number | null
  strictness: BearingsWhenPlanningWindowStrictness
  kind: BearingsWhenPlanningWindowKind
  representativeWindow?: BearingsWhenProjectedPlanningWindow
  windowWidthMinutes: number | null
  actualRuntimeClockUsed: boolean
  broadFuture: boolean
  exactUserTime: boolean
  valid: boolean
  invalidReason?: 'missing_explicit_time' | 'unparseable_explicit_time'
  hoursPosture: BearingsWhenHoursPosture
  diagnostics: {
    source: 'bearings_when_projection'
    clockIso: string
    localTimeBasis: string
    reason: string
  }
}

export interface ProjectBearingsWhenPlanningWindowParams {
  whenSignalProfile: WhenSignalProfile
  clock: Date
  localTimeBasis?: string
}

interface ParsedTime {
  hour: number
  minute: number
}

function getPhaseFromHour(hour: number): PlanningTimePhase {
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

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function toLocalDateLabel(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function buildWindow(date: Date, label: string): BearingsWhenProjectedPlanningWindow {
  const hour = date.getHours()
  return {
    day: date.getDay(),
    hour,
    minute: date.getMinutes(),
    phase: getPhaseFromHour(hour),
    label,
    localDate: toLocalDateLabel(date),
  }
}

function withTime(date: Date, hour: number, minute = 0): Date {
  const next = new Date(date)
  next.setHours(hour, minute, 0, 0)
  return next
}

function laterTonight(clock: Date): Date {
  const laterHour = Math.min(23, Math.max(19, clock.getHours() + 2))
  return withTime(clock, laterHour, clock.getMinutes())
}

function upcomingWeekend(clock: Date): Date {
  const day = clock.getDay()
  if (day === 6 && clock.getHours() < 22) {
    return withTime(clock, Math.max(19, clock.getHours()), clock.getMinutes())
  }
  if (day === 0 && clock.getHours() < 18) {
    return withTime(clock, Math.max(17, clock.getHours()), clock.getMinutes())
  }

  const daysUntilSaturday = (6 - day + 7) % 7 || 7
  const weekend = new Date(clock)
  weekend.setDate(clock.getDate() + daysUntilSaturday)
  return withTime(weekend, 19, 0)
}

function nextWeekRepresentative(clock: Date): Date {
  const daysUntilNextMonday = ((1 - clock.getDay() + 7) % 7) || 7
  const nextWeek = new Date(clock)
  nextWeek.setDate(clock.getDate() + daysUntilNextMonday)
  return withTime(nextWeek, 19, 0)
}

function parseExplicitStartTime(startTime: string | undefined): ParsedTime | undefined {
  const normalized = startTime?.trim().toLowerCase()
  if (!normalized) {
    return undefined
  }

  const directMatches: Array<[string[], ParsedTime]> = [
    [['breakfast', 'morning', 'coffee'], { hour: 9, minute: 0 }],
    [['brunch', 'lunch', 'daytime', 'afternoon'], { hour: 13, minute: 0 }],
    [['sunset', 'dinner', 'evening', 'date-night'], { hour: 19, minute: 0 }],
    [['late-night', 'nightcap', 'after-dark', 'night'], { hour: 22, minute: 0 }],
  ]

  for (const [candidates, parsed] of directMatches) {
    if (candidates.some((candidate) => normalized.includes(candidate))) {
      return parsed
    }
  }

  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/)
  if (!match) {
    return undefined
  }

  let hour = Number(match[1])
  const minute = match[2] === undefined ? 0 : Number(match[2])
  const meridiem = match[3]
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    return undefined
  }
  if (meridiem === undefined && hour > 23) {
    return undefined
  }
  if (meridiem !== undefined && (hour < 1 || hour > 12)) {
    return undefined
  }
  if (meridiem === 'pm' && hour < 12) {
    hour += 12
  }
  if (meridiem === 'am' && hour === 12) {
    hour = 0
  }
  return { hour, minute }
}

function widthFromDuration(durationMinutes: number | null): number | null {
  return durationMinutes === null ? null : Math.max(15, durationMinutes)
}

export function projectBearingsWhenPlanningWindow(
  params: ProjectBearingsWhenPlanningWindowParams,
): BearingsWhenPlanningWindowProjection {
  const { whenSignalProfile, clock } = params
  const localTimeBasis = params.localTimeBasis ?? 'runtime_local'
  const baseDiagnostics = {
    source: 'bearings_when_projection' as const,
    clockIso: clock.toISOString(),
    localTimeBasis,
  }
  const windowWidthMinutes = widthFromDuration(whenSignalProfile.durationMinutes)

  if (whenSignalProfile.whenPosture === 'now_doable_tonight') {
    const strictness: BearingsWhenPlanningWindowStrictness =
      whenSignalProfile.whenDefaulted ? 'soft' : 'medium'
    return {
      posture: whenSignalProfile.whenPosture,
      whenDefaulted: whenSignalProfile.whenDefaulted,
      whenPostureSource: whenSignalProfile.whenPostureSource,
      startTime: whenSignalProfile.startTime,
      durationMinutes: whenSignalProfile.durationMinutes,
      strictness,
      kind: 'runtime_now',
      representativeWindow: buildWindow(clock, 'actual runtime now'),
      windowWidthMinutes,
      actualRuntimeClockUsed: true,
      broadFuture: false,
      exactUserTime: false,
      valid: true,
      hoursPosture: whenSignalProfile.whenDefaulted
        ? 'defaulted_time_relaxation_allowed'
        : 'posture_time_relaxation_allowed',
      diagnostics: {
        ...baseDiagnostics,
        reason: whenSignalProfile.whenDefaulted
          ? 'Default now/doable tonight uses the injected runtime clock with soft strictness.'
          : 'User-selected now/doable tonight uses the injected runtime clock with medium strictness.',
      },
    }
  }

  if (whenSignalProfile.whenPosture === 'later_tonight') {
    return {
      posture: whenSignalProfile.whenPosture,
      whenDefaulted: whenSignalProfile.whenDefaulted,
      whenPostureSource: whenSignalProfile.whenPostureSource,
      startTime: whenSignalProfile.startTime,
      durationMinutes: whenSignalProfile.durationMinutes,
      strictness: 'medium',
      kind: 'posture_representative',
      representativeWindow: buildWindow(laterTonight(clock), 'later tonight representative window'),
      windowWidthMinutes,
      actualRuntimeClockUsed: true,
      broadFuture: false,
      exactUserTime: false,
      valid: true,
      hoursPosture: 'posture_time_relaxation_allowed',
      diagnostics: {
        ...baseDiagnostics,
        reason: 'Later tonight uses a same-day representative posture from the injected clock.',
      },
    }
  }

  if (whenSignalProfile.whenPosture === 'this_weekend') {
    return {
      posture: whenSignalProfile.whenPosture,
      whenDefaulted: whenSignalProfile.whenDefaulted,
      whenPostureSource: whenSignalProfile.whenPostureSource,
      startTime: whenSignalProfile.startTime,
      durationMinutes: whenSignalProfile.durationMinutes,
      strictness: 'medium',
      kind: 'posture_representative',
      representativeWindow: buildWindow(upcomingWeekend(clock), 'this weekend representative window'),
      windowWidthMinutes,
      actualRuntimeClockUsed: true,
      broadFuture: false,
      exactUserTime: false,
      valid: true,
      hoursPosture: 'posture_time_relaxation_allowed',
      diagnostics: {
        ...baseDiagnostics,
        reason: 'This weekend uses a date-aware weekend representative posture, not the legacy Friday fallback.',
      },
    }
  }

  if (whenSignalProfile.whenPosture === 'next_week') {
    return {
      posture: whenSignalProfile.whenPosture,
      whenDefaulted: whenSignalProfile.whenDefaulted,
      whenPostureSource: whenSignalProfile.whenPostureSource,
      startTime: whenSignalProfile.startTime,
      durationMinutes: whenSignalProfile.durationMinutes,
      strictness: 'broad',
      kind: 'broad_future',
      representativeWindow: buildWindow(nextWeekRepresentative(clock), 'next week broad representative window'),
      windowWidthMinutes,
      actualRuntimeClockUsed: true,
      broadFuture: true,
      exactUserTime: false,
      valid: true,
      hoursPosture: 'broad_future_do_not_hard_block_known_hours',
      diagnostics: {
        ...baseDiagnostics,
        reason: 'Next week remains a broad future posture and must not hard-block on an exact day/time the user did not supply.',
      },
    }
  }

  const parsedTime = parseExplicitStartTime(whenSignalProfile.startTime)
  if (!parsedTime) {
    return {
      posture: whenSignalProfile.whenPosture,
      whenDefaulted: whenSignalProfile.whenDefaulted,
      whenPostureSource: whenSignalProfile.whenPostureSource,
      startTime: whenSignalProfile.startTime,
      durationMinutes: whenSignalProfile.durationMinutes,
      strictness: 'strict',
      kind: 'invalid_explicit_time',
      windowWidthMinutes,
      actualRuntimeClockUsed: false,
      broadFuture: false,
      exactUserTime: true,
      valid: false,
      invalidReason: whenSignalProfile.startTime ? 'unparseable_explicit_time' : 'missing_explicit_time',
      hoursPosture: 'invalid_time_no_fallback',
      diagnostics: {
        ...baseDiagnostics,
        reason: 'Invalid explicit pick-a-time cannot silently fall back to the legacy Friday window.',
      },
    }
  }

  const explicitDate = withTime(clock, parsedTime.hour, parsedTime.minute)
  return {
    posture: whenSignalProfile.whenPosture,
    whenDefaulted: whenSignalProfile.whenDefaulted,
    whenPostureSource: whenSignalProfile.whenPostureSource,
    startTime: whenSignalProfile.startTime,
    durationMinutes: whenSignalProfile.durationMinutes,
    strictness: 'strict',
    kind: 'explicit_time',
    representativeWindow: buildWindow(explicitDate, `explicit ${whenSignalProfile.startTime?.trim()}`),
    windowWidthMinutes,
    actualRuntimeClockUsed: false,
    broadFuture: false,
    exactUserTime: true,
    valid: true,
    hoursPosture: 'explicit_time_requires_known_hours',
    diagnostics: {
      ...baseDiagnostics,
      reason: 'Pick-a-time preserves the explicit user time with strict Bearings feasibility semantics.',
    },
  }
}

export function projectWhenPlanningWindowToSignal(
  projection: BearingsWhenPlanningWindowProjection,
): PlanningTimeWindowSignal | undefined {
  const window = projection.representativeWindow
  if (!projection.valid || !window) {
    return undefined
  }

  return {
    day: window.day,
    hour: window.hour,
    minute: window.minute,
    phase: window.phase,
    label: window.label,
    source: 'when_planning_window',
    usesIntentWindow: projection.strictness === 'strict',
    whenProjection: {
      posture: projection.posture,
      strictness: projection.strictness,
      whenDefaulted: projection.whenDefaulted,
      source: projection.whenPostureSource,
      broadFuture: projection.broadFuture,
      actualRuntimeClockUsed: projection.actualRuntimeClockUsed,
    },
  }
}
