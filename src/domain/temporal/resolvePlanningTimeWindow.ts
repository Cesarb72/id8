import {
  projectBearingsWhenPlanningWindow,
  projectWhenPlanningWindowToSignal,
  type BearingsWhenPlanningWindowProjection,
} from '../bearings/projectWhenPlanningWindow'
import { getTimeWindowSignal } from '../retrieval/getTimeWindowSignal'
import type { PlanningTimeWindowSignal } from '../types/hours'
import type { IntentProfile } from '../types/intent'
import type { WhenSignalProfile } from '../when/whenSignalProfile'

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

export interface ResolvePlanningTimeWindowOptions {
  whenSignalProfile?: WhenSignalProfile
  clock?: Date
}

export interface PlanningTimeWindowResolution {
  planningWindow?: PlanningTimeWindowSignal
  whenProjection?: BearingsWhenPlanningWindowProjection
}

export function resolvePlanningTimeWindowResolution(
  intent: IntentProfile,
  options: ResolvePlanningTimeWindowOptions = {},
): PlanningTimeWindowResolution {
  const intentWindow = getTimeWindowSignal(intent, options.clock)
  if (intentWindow.usesIntentWindow) {
    return {
      planningWindow: {
        ...intentWindow,
        source: 'intent_time_window',
      },
    }
  }

  if (options.whenSignalProfile) {
    const whenProjection = projectBearingsWhenPlanningWindow({
      whenSignalProfile: options.whenSignalProfile,
      clock: options.clock ?? new Date(),
    })
    return {
      planningWindow: projectWhenPlanningWindowToSignal(whenProjection),
      whenProjection,
    }
  }

  return {
    planningWindow: {
      ...intentWindow,
      source: 'runtime_current_window',
    },
  }
}

export function resolvePlanningTimeWindow(
  intent: IntentProfile,
  options: ResolvePlanningTimeWindowOptions = {},
): PlanningTimeWindowSignal | undefined {
  return resolvePlanningTimeWindowResolution(intent, options).planningWindow
}
