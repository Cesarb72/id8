export type BusinessStatus =
  | 'operational'
  | 'temporarily-closed'
  | 'closed-permanently'
  | 'unknown'

export type PlanningTimePhase = 'morning' | 'afternoon' | 'evening' | 'late-night'

export type HoursPressureLevel =
  | 'strong-open'
  | 'likely-open'
  | 'unknown'
  | 'likely-closed'
  | 'closed'

export interface HoursPeriodPoint {
  day: number
  hour: number
  minute: number
}

export interface HoursPeriod {
  open?: HoursPeriodPoint
  close?: HoursPeriodPoint
}

export interface PlanningTimeWindowSignal {
  day: number
  hour: number
  minute: number
  phase: PlanningTimePhase
  label: string
  usesIntentWindow: boolean
}

export interface HoursPressureAnalysis {
  openNow?: boolean
  hoursKnown: boolean
  likelyOpenForCurrentWindow: boolean
  businessStatus: BusinessStatus
  timeConfidence: number
  hoursPressureLevel: HoursPressureLevel
  hoursPressureNotes: string[]
}
