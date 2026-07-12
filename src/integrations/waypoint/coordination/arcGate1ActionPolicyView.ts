import type {
  CoordinationComparableValue,
  CoordinationSignalComponent,
  CoordinationSignalSource,
} from './coordinationPrimitive'
import type { ScoredVenue } from '../../../domain/types/arc'
import type { InternalRole } from '../../../domain/types/venue'

export type ArcGate1ActionPolicySignalSource = Extract<
  CoordinationSignalSource,
  'taste' | 'bearings' | 'field' | 'compat'
>

export type ArcGate1ActionPolicyOwnerSignalSource = Exclude<
  ArcGate1ActionPolicySignalSource,
  'compat'
>

export type ArcGate1TasteEvidenceKind =
  | 'family_fit'
  | 'romantic_support'
  | 'surprise_worthiness'
  | 'peak_support'
  | 'central_moment_support'
  | 'role_support'
  | 'intent_support'

export type ArcGate1BearingsEvidenceKind =
  | 'route_feasibility'
  | 'compactness_feasibility'
  | 'place_right_feasibility'
  | 'hours_feasibility'
  | 'distance_feasibility'
  | 'movement_feasibility'
  | 'admission_survival'
  | 'constraint_survival'

export type ArcGate1FieldEvidenceKind =
  | 'real_record'
  | 'active_record'
  | 'resolved_identity'

export interface OwnerProvenancedGate1ActionSignal<
  TSource extends ArcGate1ActionPolicyOwnerSignalSource =
    ArcGate1ActionPolicyOwnerSignalSource,
  TKind extends string = string,
  TValue extends CoordinationComparableValue = boolean,
> extends Omit<CoordinationSignalComponent<TValue>, 'source' | 'key'> {
  source: TSource
  key: TKind
  authority: 'owner_signal'
}

export type ArcGate1TasteActionSignal<
  TKind extends ArcGate1TasteEvidenceKind = ArcGate1TasteEvidenceKind,
  TValue extends CoordinationComparableValue = boolean,
> = OwnerProvenancedGate1ActionSignal<'taste', TKind, TValue>

export type ArcGate1BearingsActionSignal<
  TKind extends ArcGate1BearingsEvidenceKind = ArcGate1BearingsEvidenceKind,
  TValue extends CoordinationComparableValue = boolean,
> = OwnerProvenancedGate1ActionSignal<'bearings', TKind, TValue>

export type ArcGate1FieldActionSignal<
  TKind extends ArcGate1FieldEvidenceKind = ArcGate1FieldEvidenceKind,
  TValue extends CoordinationComparableValue = boolean,
> = OwnerProvenancedGate1ActionSignal<'field', TKind, TValue>

export interface ArcGate1CandidateIdentity {
  candidateId: string
  baseVenueId?: string
  traceLabel?: string
}

export type ArcGate1RouteContext =
  | 'core_route'
  | 'surprise_route'
  | 'partial_fallback_route'
  | 'role_pool'
  | 'preservation_pool'
  | 'recovery_pool'

export interface ArcGate1RoleRouteContext {
  routeContext: ArcGate1RouteContext
  candidateRole?: InternalRole
  currentRole?: InternalRole
  requestedRole?: InternalRole
  routeShape?: 'core' | 'wildcard' | 'partial' | 'highlight_only'
}

export interface ArcGate1CompatibilityPayload {
  source: 'compat'
  legacyReasonCodes?: readonly string[]
  legacyScores?: Record<string, unknown>
  publicProjection?: Record<string, unknown>
  debugProjection?: Record<string, unknown>
}

export type ArcGate1ActionKind =
  | 'preservation'
  | 'replacement'
  | 'surprise_promotion'
  | 'surprise_demotion'
  | 'fallback'
  | 'family_preservation'
  | 'preferred_role_admission'
  | 'romantic_fallback'
  | 'hard_contract_pressure'
  | 'rescue'

export interface ArcGate1EligibilityGuardrails {
  rawScore?: never
  fallbackOutcome?: never
  preservationOutcome?: never
  promotionOutcome?: never
  demotionOutcome?: never
  actionOutcome?: never
  publicProjection?: never
  debugProjection?: never
  compatibilityPayloadAsAuthority?: never
}

export interface ArcGate1TasteBearingFieldEligibility
  extends ArcGate1EligibilityGuardrails {
  taste: readonly [ArcGate1TasteActionSignal, ...ArcGate1TasteActionSignal[]]
  bearings: readonly [
    ArcGate1BearingsActionSignal,
    ...ArcGate1BearingsActionSignal[],
  ]
  field: ArcGate1FieldActionSignal
}

export interface ArcGate1TasteBearingsEligibility
  extends ArcGate1EligibilityGuardrails {
  taste: readonly [ArcGate1TasteActionSignal, ...ArcGate1TasteActionSignal[]]
  bearings: readonly [
    ArcGate1BearingsActionSignal,
    ...ArcGate1BearingsActionSignal[],
  ]
  field?: ArcGate1FieldActionSignal
}

export interface ArcGate1TasteFieldEligibility
  extends ArcGate1EligibilityGuardrails {
  taste: readonly [ArcGate1TasteActionSignal, ...ArcGate1TasteActionSignal[]]
  bearings?: readonly ArcGate1BearingsActionSignal[]
  field: ArcGate1FieldActionSignal
}

export interface ArcGate1BearingsFieldEligibility
  extends ArcGate1EligibilityGuardrails {
  taste?: readonly ArcGate1TasteActionSignal[]
  bearings: readonly [
    ArcGate1BearingsActionSignal,
    ...ArcGate1BearingsActionSignal[],
  ]
  field: ArcGate1FieldActionSignal
}

export type ArcGate1ActionEligibility<
  TAction extends ArcGate1ActionKind = ArcGate1ActionKind,
> = TAction extends
  | 'preservation'
  | 'replacement'
  | 'surprise_promotion'
  | 'surprise_demotion'
  | 'family_preservation'
  | 'preferred_role_admission'
  | 'romantic_fallback'
  | 'hard_contract_pressure'
  | 'rescue'
  ? ArcGate1TasteBearingFieldEligibility
  : TAction extends 'fallback'
    ? ArcGate1TasteBearingsEligibility
    : never

export interface ArcGate1ActionCandidate<
  TAction extends ArcGate1ActionKind = ArcGate1ActionKind,
  TPayload = ScoredVenue,
> extends ArcGate1EligibilityGuardrails {
  id: string
  action: TAction
  payload?: TPayload
  identity: ArcGate1CandidateIdentity
  roleRouteContext: ArcGate1RoleRouteContext
  deterministicTieBreakKey: string
  eligibility: ArcGate1ActionEligibility<TAction>
  ownerSignals: readonly OwnerProvenancedGate1ActionSignal[]
  compatibility?: ArcGate1CompatibilityPayload
}

export interface ArcGate1ActionPolicyInput<TPayload = ScoredVenue> {
  candidates: readonly ArcGate1ActionCandidate<ArcGate1ActionKind, TPayload>[]
  compatibility?: ArcGate1CompatibilityPayload
}

export type ArcGate1ActionRefusalReason =
  | 'preservation:owner_signal_failed'
  | 'preservation:would_mask_failed_place_right'
  | 'fallback:no_owner_valid_candidate'
  | 'fallback:would_mask_missing_meaning'
  | 'fallback:would_mask_failed_feasibility'
  | 'surprise:promotion_owner_signal_failed'
  | 'surprise:promotion_score_not_competitive'
  | 'surprise:demotion_would_hide_required_failure'
  | 'family_preservation:owner_signal_failed'
  | 'family_preservation:cap_refused_infeasible_candidate'

export type ArcGate1ActionDecisionKind =
  | 'preserve'
  | 'refuse_preservation'
  | 'replace'
  | 'promote'
  | 'demote'
  | 'fallback'
  | 'refuse_fallback'
  | 'admit'
  | 'refuse_admission'
  | 'no_action'
  | 'no_preservation'
  | 'no_fallback'
  | 'no_promotion'

export interface ArcGate1ActionDecision {
  source: 'waypoint'
  candidateId?: string
  decision: ArcGate1ActionDecisionKind
  reasons?: readonly ArcGate1ActionRefusalReason[]
  ownerSignals: readonly OwnerProvenancedGate1ActionSignal[]
  compatibility?: ArcGate1CompatibilityPayload
}

export interface ArcGate1ActionPolicyView<TPayload = ScoredVenue> {
  input: ArcGate1ActionPolicyInput<TPayload>
  decisions: readonly ArcGate1ActionDecision[]
  refusalReasons: readonly ArcGate1ActionRefusalReason[]
  noActionDecision?: Extract<
    ArcGate1ActionDecisionKind,
    'no_action' | 'no_preservation' | 'no_fallback' | 'no_promotion'
  >
  compatibility?: ArcGate1CompatibilityPayload
}

type AssertGate1OwnerSource<T extends ArcGate1ActionPolicyOwnerSignalSource> = T
type AssertGate1OwnerSignal<T extends OwnerProvenancedGate1ActionSignal> = T
type AssertGate1Eligibility<T extends ArcGate1EligibilityGuardrails> = T
type AssertGate1Candidate<T extends ArcGate1ActionCandidate> = T
type AssertGate1PreservationCandidate<
  T extends ArcGate1ActionCandidate<'preservation'>,
> = T
type AssertGate1FallbackCandidate<T extends ArcGate1ActionCandidate<'fallback'>> =
  T

export type ArcGate1TasteSourceAccepted = AssertGate1OwnerSource<'taste'>

export type ArcGate1BearingsSourceAccepted =
  AssertGate1OwnerSource<'bearings'>

export type ArcGate1FieldSourceAccepted = AssertGate1OwnerSource<'field'>

// @ts-expect-error Waypoint coordinates owner-authored Gate 1 signals; it cannot author them.
export type ArcGate1WaypointSourceRejected =
  AssertGate1OwnerSource<'waypoint'>

// @ts-expect-error Compatibility payloads are optional legacy/debug data, not eligibility truth.
export type ArcGate1CompatSourceRejected = AssertGate1OwnerSource<'compat'>

// @ts-expect-error Owner signals must carry explicit owner provenance.
export type ArcGate1MissingProvenanceRejected = AssertGate1OwnerSignal<{
  key: 'family_fit'
  authority: 'owner_signal'
  value: true
}>

// @ts-expect-error Raw unprovenanced scores cannot become Gate 1 eligibility truth.
export type ArcGate1RawScoreRejected = AssertGate1Candidate<{
  id: 'candidate'
  action: 'fallback'
  rawScore: 1
  identity: { candidateId: 'candidate' }
  roleRouteContext: { routeContext: 'partial_fallback_route' }
  deterministicTieBreakKey: 'candidate'
  eligibility: ArcGate1TasteBearingsEligibility
  ownerSignals: readonly OwnerProvenancedGate1ActionSignal[]
}>

// @ts-expect-error Fallback outcomes cannot be provided as eligibility truth.
export type ArcGate1FallbackOutcomeTruthRejected =
  AssertGate1Eligibility<{
    fallbackOutcome: 'fallback'
  }>

// @ts-expect-error Preservation outcomes cannot be provided as eligibility truth.
export type ArcGate1PreservationOutcomeTruthRejected =
  AssertGate1Eligibility<{
    preservationOutcome: 'preserved'
  }>

// @ts-expect-error Promotion outcomes cannot be provided as eligibility truth.
export type ArcGate1PromotionOutcomeTruthRejected =
  AssertGate1Eligibility<{
    promotionOutcome: 'promoted_to_highlight'
  }>

// @ts-expect-error Public/debug projections cannot become action-policy authority.
export type ArcGate1PublicProjectionTruthRejected =
  AssertGate1Eligibility<{
    publicProjection: { score: 1 }
  }>

// @ts-expect-error Missing Taste signal rejects actions that depend on Taste meaning.
export type ArcGate1MissingTasteSignalRejected =
  AssertGate1PreservationCandidate<{
    id: 'candidate'
    action: 'preservation'
    identity: { candidateId: 'candidate' }
    roleRouteContext: { routeContext: 'preservation_pool' }
    deterministicTieBreakKey: 'candidate'
    eligibility: ArcGate1BearingsFieldEligibility
    ownerSignals: readonly OwnerProvenancedGate1ActionSignal[]
  }>

// @ts-expect-error Missing Bearings signal rejects actions that depend on feasibility.
export type ArcGate1MissingBearingsSignalRejected =
  AssertGate1PreservationCandidate<{
    id: 'candidate'
    action: 'preservation'
    identity: { candidateId: 'candidate' }
    roleRouteContext: { routeContext: 'preservation_pool' }
    deterministicTieBreakKey: 'candidate'
    eligibility: ArcGate1TasteFieldEligibility
    ownerSignals: readonly OwnerProvenancedGate1ActionSignal[]
  }>

// @ts-expect-error Missing Field Real signal rejects actions that depend on Real.
export type ArcGate1MissingFieldRealSignalRejected =
  AssertGate1PreservationCandidate<{
    id: 'candidate'
    action: 'preservation'
    identity: { candidateId: 'candidate' }
    roleRouteContext: { routeContext: 'preservation_pool' }
    deterministicTieBreakKey: 'candidate'
    eligibility: ArcGate1TasteBearingsEligibility
    ownerSignals: readonly OwnerProvenancedGate1ActionSignal[]
  }>

// @ts-expect-error Fallback actions still require owner-authored meaning and feasibility.
export type ArcGate1FallbackMissingTasteRejected =
  AssertGate1FallbackCandidate<{
    id: 'candidate'
    action: 'fallback'
    identity: { candidateId: 'candidate' }
    roleRouteContext: { routeContext: 'partial_fallback_route' }
    deterministicTieBreakKey: 'candidate'
    eligibility: ArcGate1BearingsFieldEligibility
    ownerSignals: readonly OwnerProvenancedGate1ActionSignal[]
  }>
