import type {
  CoordinationComparableValue,
  CoordinationSignalComponent,
  CoordinationSignalSource,
} from './coordinationPrimitive'
import type { PeakCandidateFeasibilityVerdict } from '../../../domain/bearings/evaluateArcRouteMovementFeasibility'
import type { TasteRolePoolCandidateMeaningEvidence } from '../../../domain/interpretation/taste/tasteRolePoolMeaningView'
import type { ScoredVenue } from '../../../domain/types/arc'
import type { InternalRole } from '../../../domain/types/venue'

export type ArcPeakRecoverySignalSource = Extract<
  CoordinationSignalSource,
  'taste' | 'bearings' | 'compat'
>

export type ArcPeakRecoveryOwnerSignalSource = Exclude<
  ArcPeakRecoverySignalSource,
  'compat'
>

export interface OwnerProvenancedPeakRecoverySignal<
  TValue extends CoordinationComparableValue = number,
> extends Omit<CoordinationSignalComponent<TValue>, 'source'> {
  source: ArcPeakRecoveryOwnerSignalSource
}

export interface ArcPeakRecoveryTastePeakWorthinessSignal
  extends OwnerProvenancedPeakRecoverySignal<true> {
  source: 'taste'
  key: 'taste_peak_worthiness'
  status: 'peak_worthy'
  assessment: TasteRolePoolCandidateMeaningEvidence<'peak_worthiness'>
}

export interface ArcPeakRecoveryTasteCentralMomentQualitySignal
  extends OwnerProvenancedPeakRecoverySignal<boolean> {
  source: 'taste'
  key: 'taste_central_moment_quality'
  status:
    | 'central_moment'
    | 'possible_central_moment'
    | 'weak_central_moment'
    | 'not_central_moment'
  assessment: TasteRolePoolCandidateMeaningEvidence<'central_moment_quality'>
}

export interface ArcPeakRecoveryBearingsFeasibilitySignal
  extends OwnerProvenancedPeakRecoverySignal<true> {
  source: 'bearings'
  key: 'bearings_peak_feasibility'
  verdict: PeakCandidateFeasibilityVerdict & {
    feasible: true
  }
}

export interface ArcPeakRecoveryCandidateIdentity {
  candidateId: string
  baseVenueId?: string
  traceLabel?: string
}

export interface ArcPeakRecoveryRoleContext {
  candidateRole: InternalRole
  rolePoolRole?: InternalRole
  currentPeakCandidateId?: string
}

export type ArcPeakRecoveryCandidateContext =
  | 'current_peak'
  | 'candidate_pool'
  | 'fallback_pool'
  | 'recovery_pool_candidate'

export interface ArcPeakRecoveryCoordinationContext {
  context: ArcPeakRecoveryCandidateContext
  requestReason?:
    | 'empty_standard_peak_pool'
    | 'stronger_peak_available'
    | 'compatibility_review'
    | 'owner_signal_review'
}

export interface ArcPeakRecoveryCompatibilityPayload {
  source: 'compat'
  legacyReasonCodes?: readonly string[]
  oldScoreFields?: Record<string, unknown>
  debugMetadata?: Record<string, unknown>
}

export interface ArcPeakRecoveryEligibilitySignals {
  tastePeakWorthiness: ArcPeakRecoveryTastePeakWorthinessSignal
  tasteCentralMomentQuality: ArcPeakRecoveryTasteCentralMomentQualitySignal
  bearingsPeakFeasibility: ArcPeakRecoveryBearingsFeasibilitySignal
  fallbackOutcome?: never
  recoveryOutcome?: never
  recoveredCandidateId?: never
  publicProjection?: never
  debugProjection?: never
  rawScore?: never
}

export interface ArcPeakRecoveryCandidate<TPayload = ScoredVenue>
  extends ArcPeakRecoveryEligibilitySignals {
  id: string
  payload?: TPayload
  identity: ArcPeakRecoveryCandidateIdentity
  roleContext: ArcPeakRecoveryRoleContext
  coordinationContext: ArcPeakRecoveryCoordinationContext
  deterministicTieBreakKey: string
  signals: readonly [
    ArcPeakRecoveryTastePeakWorthinessSignal,
    ArcPeakRecoveryTasteCentralMomentQualitySignal,
    ArcPeakRecoveryBearingsFeasibilitySignal,
  ]
  compatibility?: ArcPeakRecoveryCompatibilityPayload
}

export interface ArcPeakRecoveryAdapterInput<TPayload = ScoredVenue> {
  candidates: readonly ArcPeakRecoveryCandidate<TPayload>[]
  currentPeakCandidateId?: string
  compatibility?: ArcPeakRecoveryCompatibilityPayload
}

export interface ArcPeakRecoveryPoolView<TPayload = ScoredVenue> {
  eligibleCandidates: readonly ArcPeakRecoveryCandidate<TPayload>[]
  emptyPool: boolean
  emptyPoolOutcome: 'no_recovery'
  compatibility?: ArcPeakRecoveryCompatibilityPayload
}

type AssertPeakRecoveryOwnerSource<T extends ArcPeakRecoveryOwnerSignalSource> = T
type AssertPeakRecoveryTasteSignal<
  T extends ArcPeakRecoveryTastePeakWorthinessSignal,
> = T
type AssertPeakRecoveryBearingsSignal<
  T extends ArcPeakRecoveryBearingsFeasibilitySignal,
> = T
type AssertPeakRecoveryEligibility<T extends ArcPeakRecoveryEligibilitySignals> = T
type AssertPeakRecoveryCandidate<T extends ArcPeakRecoveryCandidate> = T

export type ArcPeakRecoveryTasteSourceAccepted =
  AssertPeakRecoveryOwnerSource<'taste'>

export type ArcPeakRecoveryBearingsSourceAccepted =
  AssertPeakRecoveryOwnerSource<'bearings'>

// @ts-expect-error Waypoint coordinates owner-authored recovery signals; it cannot author them.
export type ArcPeakRecoveryWaypointSourceRejected = AssertPeakRecoveryOwnerSource<'waypoint'>

// @ts-expect-error Compatibility payloads are not owner-authored eligibility signals.
export type ArcPeakRecoveryCompatSourceRejected = AssertPeakRecoveryOwnerSource<'compat'>

// @ts-expect-error Taste peak-worthiness signals require Taste provenance.
export type ArcPeakRecoveryMissingTasteProvenanceRejected = AssertPeakRecoveryTasteSignal<{
    key: 'taste_peak_worthiness'
    value: true
    status: 'peak_worthy'
    assessment: TasteRolePoolCandidateMeaningEvidence<'peak_worthiness'>
  }>

// @ts-expect-error Bearings peak feasibility signals require Bearings provenance.
export type ArcPeakRecoveryMissingBearingsProvenanceRejected = AssertPeakRecoveryBearingsSignal<{
    key: 'bearings_peak_feasibility'
    value: true
    verdict: PeakCandidateFeasibilityVerdict & {
      feasible: true
    }
  }>

// @ts-expect-error Missing Taste peak-worthiness makes a recovery candidate ineligible.
export type ArcPeakRecoveryMissingTasteSignalRejected = AssertPeakRecoveryEligibility<{
    tasteCentralMomentQuality: ArcPeakRecoveryTasteCentralMomentQualitySignal
    bearingsPeakFeasibility: ArcPeakRecoveryBearingsFeasibilitySignal
  }>

// @ts-expect-error Missing Bearings feasibility makes a recovery candidate ineligible.
export type ArcPeakRecoveryMissingBearingsSignalRejected = AssertPeakRecoveryEligibility<{
    tastePeakWorthiness: ArcPeakRecoveryTastePeakWorthinessSignal
    tasteCentralMomentQuality: ArcPeakRecoveryTasteCentralMomentQualitySignal
  }>

// @ts-expect-error Raw scores without owner-provenanced signals are not recovery candidates.
export type ArcPeakRecoveryRawScoreRejected = AssertPeakRecoveryCandidate<{
  id: 'candidate'
  rawScore: 1
  deterministicTieBreakKey: 'candidate'
}>

// @ts-expect-error Recovery outcomes cannot be provided as eligibility truth.
export type ArcPeakRecoveryOutcomeTruthRejected = AssertPeakRecoveryEligibility<{
    tastePeakWorthiness: ArcPeakRecoveryTastePeakWorthinessSignal
    tasteCentralMomentQuality: ArcPeakRecoveryTasteCentralMomentQualitySignal
    bearingsPeakFeasibility: ArcPeakRecoveryBearingsFeasibilitySignal
    recoveryOutcome: 'selected'
  }>
