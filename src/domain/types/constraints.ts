export type ConstraintPriority = 'hard' | 'user' | 'soft'

export type ConstraintDecision =
  | 'enforced'
  | 'softened'
  | 'skipped'
  | 'failed'
  | 'conflict'

export type ConstraintTraceType = 'anchor' | 'hours' | 'geography'

export interface ConstraintTraceEntry {
  type: ConstraintTraceType
  priority: ConstraintPriority
  decision: ConstraintDecision
  reason?: string
  overriddenBy?: ConstraintPriority
  details?: string[]
}

export type TemporalMode = 'unspecified' | 'explicit'

export interface TemporalTrace {
  mode: TemporalMode
  source: 'time_window' | 'none'
  rawValue?: string
}
