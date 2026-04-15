import type { PlanningTimePhase, PlanningTimeWindowSignal } from '../types/hours'
import type { IntentProfile } from '../types/intent'

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

function parseHourFromTimeWindow(timeWindow?: string): number | undefined {
  if (!timeWindow) {
    return undefined
  }

  const normalized = timeWindow.trim().toLowerCase()
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

export function getTimeWindowSignal(intent: IntentProfile): PlanningTimeWindowSignal {
  const now = new Date()
  const parsedHour = parseHourFromTimeWindow(intent.timeWindow)
  const hour = parsedHour ?? now.getHours()
  const minute = parsedHour === undefined ? now.getMinutes() : 0
  const phase = getPhaseFromHour(hour)

  return {
    day: now.getDay(),
    hour,
    minute,
    phase,
    label:
      parsedHour === undefined
        ? `${phase} now`
        : intent.timeWindow?.trim() || phase,
    usesIntentWindow: parsedHour !== undefined,
  }
}
