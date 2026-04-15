import type { TemporalMode, TemporalTrace } from '../types/constraints'
import type { IntentInput, IntentProfile } from '../types/intent'

type TemporalInput =
  | Pick<IntentInput, 'timeWindow'>
  | Pick<IntentProfile, 'timeWindow'>
  | { timeWindow?: string }
  | undefined

function normalizeTimeWindow(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

export function detectTemporalMode(input?: TemporalInput): TemporalMode {
  return normalizeTimeWindow(input?.timeWindow) ? 'explicit' : 'unspecified'
}

export function buildTemporalTrace(input?: TemporalInput): TemporalTrace {
  const rawValue = normalizeTimeWindow(input?.timeWindow)
  if (rawValue) {
    return {
      mode: 'explicit',
      source: 'time_window',
      rawValue,
    }
  }

  return {
    mode: 'unspecified',
    source: 'none',
  }
}
