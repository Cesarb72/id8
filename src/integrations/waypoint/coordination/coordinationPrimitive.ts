/**
 * Domain-blind Waypoint coordination primitive types.
 *
 * Waypoint coordinates already-authored engine signals. Input signal
 * components intentionally cannot name Waypoint as their author.
 */
export type CoordinationSignalSource =
  | 'taste'
  | 'bearings'
  | 'district'
  | 'field'
  | 'direction'
  | 'compat'

export type CoordinationComparableValue = number | string | boolean

export interface CoordinationSignalProvenance {
  source: CoordinationSignalSource
  key: string
  label?: string
  reason?: string
}

export interface CoordinationSignalComponent<
  TValue extends CoordinationComparableValue = number,
> extends CoordinationSignalProvenance {
  value: TValue
  weight?: number
  contribution?: number
}

export interface CoordinationDiversityDimension<
  TValue extends CoordinationComparableValue = string,
> extends CoordinationSignalProvenance {
  value: TValue
}

export interface CoordinationFallbackMetadata extends CoordinationSignalProvenance {
  applied: boolean
  penalty?: number
}

export interface CoordinationCandidate<TPayload = unknown> {
  id: string
  payload: TPayload
  signals: readonly CoordinationSignalComponent[]
  admissibility?: readonly CoordinationSignalComponent[]
  diversity?: readonly CoordinationDiversityDimension[]
  fallback?: CoordinationFallbackMetadata
  deterministicTieBreakKey?: string
}

export interface CoordinationRequest<TPayload = unknown> {
  candidates: readonly CoordinationCandidate<TPayload>[]
  selectLimit?: number
}

export interface CoordinationScoreTrace {
  candidateId: string
  baseScore: number
  finalScore: number
  components: readonly CoordinationSignalComponent[]
}

export interface CoordinationPreservationTrace {
  candidateId: string
  preserved: boolean
  signals: readonly CoordinationSignalProvenance[]
  reason?: string
}

export interface CoordinationRankedEntry<TPayload = unknown> {
  rank: number
  candidate: CoordinationCandidate<TPayload>
  score: number
  scoreTrace: CoordinationScoreTrace
}

export interface CoordinationResult<TPayload = unknown> {
  ranked: readonly CoordinationRankedEntry<TPayload>[]
  selected: readonly CoordinationRankedEntry<TPayload>[]
  scoreTraces: readonly CoordinationScoreTrace[]
  preservationTraces: readonly CoordinationPreservationTrace[]
  signalProvenance: readonly CoordinationSignalProvenance[]
}

export type RankAndSelectOverEngineSignals = <TPayload = unknown>(
  request: CoordinationRequest<TPayload>,
) => CoordinationResult<TPayload>
