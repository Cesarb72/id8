import type {
  CoordinationCandidate,
  CoordinationComparableValue,
  CoordinationDiversityDimension,
  CoordinationFallbackMetadata,
  CoordinationSignalComponent,
  CoordinationSignalSource,
} from './coordinationPrimitive'
import type { ArcCandidate, ArcScoreBreakdown } from '../../../domain/types/arc'

export type ArcCoordinationSignalSource = Exclude<
  CoordinationSignalSource,
  'waypoint'
>

export interface OwnerProvenancedArcCoordinationSignal<
  TValue extends CoordinationComparableValue = number,
> extends Omit<CoordinationSignalComponent<TValue>, 'source'> {
  source: ArcCoordinationSignalSource
}

export interface OwnerProvenancedArcDiversityDimension<
  TValue extends CoordinationComparableValue = string,
> extends Omit<CoordinationDiversityDimension<TValue>, 'source'> {
  source: ArcCoordinationSignalSource
}

export interface OwnerProvenancedArcFallbackMetadata
  extends Omit<CoordinationFallbackMetadata, 'source'> {
  source: ArcCoordinationSignalSource
}

export interface ArcRouteCoordinationCompatibility {
  totalScore?: ArcCandidate['totalScore']
  scoreBreakdown?: ArcScoreBreakdown
  rankingMetadata?: {
    rank?: number
    previousRank?: number
    reason?: string
  }
  debugMetadata?: Record<string, unknown>
  deterministicTieBreakKey?: string
  preservationMetadata?: {
    preserved: boolean
    reason?: string
  }
  fallbackMetadata?: {
    applied: boolean
    reason?: string
    penalty?: number
  }
}

export type ArcRouteCoordinationCandidate<
  TPayload extends ArcCandidate = ArcCandidate,
> = Omit<
  CoordinationCandidate<TPayload>,
  'signals' | 'admissibility' | 'diversity' | 'fallback'
> & {
  signals: readonly OwnerProvenancedArcCoordinationSignal[]
  admissibility?: readonly OwnerProvenancedArcCoordinationSignal[]
  diversity?: readonly OwnerProvenancedArcDiversityDimension[]
  fallback?: OwnerProvenancedArcFallbackMetadata
}

export interface ArcRouteCoordinationAdapterInput<
  TPayload extends ArcCandidate = ArcCandidate,
> {
  candidate: ArcRouteCoordinationCandidate<TPayload>
  compatibility?: ArcRouteCoordinationCompatibility
}

export interface ArcRouteCoordinationView<
  TPayload extends ArcCandidate = ArcCandidate,
> {
  candidate: ArcRouteCoordinationCandidate<TPayload>
  compatibility?: ArcRouteCoordinationCompatibility
}

type AssertArcSource<T extends ArcCoordinationSignalSource> = T
type AssertArcSignal<T extends OwnerProvenancedArcCoordinationSignal> = T
type AssertArcAdapterInput<T extends ArcRouteCoordinationAdapterInput> = T

export type ArcCoordinationOwnerSourceProof = AssertArcSource<'taste'>

// @ts-expect-error Waypoint coordinates owner-authored signals; it cannot author input signals.
export type ArcCoordinationWaypointSourceRejected = AssertArcSource<'waypoint'>

// @ts-expect-error Arc coordination signals require explicit owner provenance.
export type ArcCoordinationMissingProvenanceRejected = AssertArcSignal<{
  key: 'raw_score'
  value: 1
}>

// @ts-expect-error Raw scores without owner-provenanced signals are not adapter inputs.
export type ArcCoordinationRawScoreInputRejected = AssertArcAdapterInput<{
  candidate: {
    id: 'arc'
    payload: ArcCandidate
    totalScore: number
  }
}>
