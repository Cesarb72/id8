import { getTimeWindowSignal } from '../retrieval/getTimeWindowSignal'
import type { PlanningTimeWindowSignal } from '../types/hours'
import type { IntentProfile } from '../types/intent'

export const GATE1_DEFAULT_EVENING_WINDOW_SOURCE = 'gate1_default_evening_window' as const

export function buildGate1DefaultEveningWindow(): PlanningTimeWindowSignal {
  return {
    day: 5,
    hour: 19,
    minute: 0,
    phase: 'evening',
    label: 'Gate 1 default Friday 7:00 PM',
    source: GATE1_DEFAULT_EVENING_WINDOW_SOURCE,
    usesIntentWindow: false,
  }
}

export function resolvePlanningTimeWindow(intent: IntentProfile): PlanningTimeWindowSignal {
  const intentWindow = getTimeWindowSignal(intent)
  if (intentWindow.usesIntentWindow) {
    return {
      ...intentWindow,
      source: 'intent_time_window',
    }
  }

  return buildGate1DefaultEveningWindow()
}
