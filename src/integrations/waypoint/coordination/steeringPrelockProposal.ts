import type {
  CoordinationComparableValue,
  CoordinationSignalComponent,
  CoordinationSignalSource,
} from './coordinationPrimitive'
import type { UserStopRole } from '../../../domain/types/itinerary'

export type SteeringPrelockOwnerEvidenceSource = Extract<
  CoordinationSignalSource,
  'taste' | 'bearings' | 'field'
>

export type SteeringPrelockTraceSource =
  | SteeringPrelockOwnerEvidenceSource
  | 'waypoint'
  | 'compat'

export type SteeringPrelockAction =
  | 'swap_stop'
  | 'replace_weak_stop'
  | 'shorter_moves'
  | 'stronger_center'
  | 'adjust_pacing'
  | 'adjust_route_shape'
  | 'preserve_anchor'
  | 'preserve_peak'
  | 'role_pool_repair'

export type SteeringPrelockRefusalClass =
  | 'no_admissible_replacement'
  | 'anchor_peak_preservation'
  | 'movement_would_get_worse'
  | 'hours_admission_conflict'
  | 'role_fit_too_weak'
  | 'identity_provenance_missing'
  | 'insufficient_owner_evidence'
  | 'route_structure_violation'

export interface SteeringPrelockEvidenceGuardrails {
  rawRoleFitScore?: never
  rawFeasibilityScore?: never
  appAnchoredRoleFitScore?: never
  appAuthoredReason?: never
  waypointAuthoredMeaning?: never
  waypointAuthoredFeasibility?: never
  waypointHydratedIdentity?: never
}

export interface SteeringPrelockOwnerEvidence<
  TSource extends SteeringPrelockOwnerEvidenceSource,
  TKind extends string,
  TValue extends CoordinationComparableValue = number,
> extends Omit<CoordinationSignalComponent<TValue>, 'source' | 'key'>,
    SteeringPrelockEvidenceGuardrails {
  source: TSource
  key: TKind
  authority: 'owner_evidence'
}

export type SteeringRoleFitEvidenceKind =
  | 'role_suitability'
  | 'semantic_fit'
  | 'central_moment_support'
  | 'highlight_strength'
  | 'weak_stop_reason'

export interface SteeringRoleFitEvidence<
  TKind extends SteeringRoleFitEvidenceKind = SteeringRoleFitEvidenceKind,
  TValue extends CoordinationComparableValue = number,
> extends SteeringPrelockOwnerEvidence<'taste', TKind, TValue> {
  source: 'taste'
  role: UserStopRole
  verdict:
    | 'strong_fit'
    | 'acceptable_fit'
    | 'weak_fit'
    | 'not_fit'
    | 'unknown'
  ownerReasons?: readonly string[]
}

export type SteeringFeasibilityEvidenceKind =
  | 'admission'
  | 'hours'
  | 'movement'
  | 'route_structure'
  | 'required_stop_survival'
  | 'origin_posture'

export interface SteeringFeasibilityEvidence<
  TKind extends SteeringFeasibilityEvidenceKind = SteeringFeasibilityEvidenceKind,
  TValue extends CoordinationComparableValue = boolean,
> extends SteeringPrelockOwnerEvidence<'bearings', TKind, TValue> {
  source: 'bearings'
  status: 'feasible' | 'soft_feasible' | 'infeasible' | 'unknown'
  ownerReasons?: readonly string[]
}

export interface SteeringMovementDeltaEvidence
  extends SteeringPrelockOwnerEvidence<'bearings', 'movement_delta', number> {
  source: 'bearings'
  currentTravelMinutes?: number
  candidateTravelMinutes?: number
  deltaMinutes: number
  direction: 'shorter' | 'same' | 'longer' | 'unknown'
  originAware: boolean
  originPrecision?: string
  ownerReasons?: readonly string[]
}

export interface SteeringStopIdentity
  extends SteeringPrelockEvidenceGuardrails {
  source: 'field'
  venueId?: string
  candidateId?: string
  baseVenueId?: string
  displayName: string
  providerRecordId?: string
  sourceOrigin?: string
  sourceProvenance?: string
  latitude?: number
  longitude?: number
  formattedAddress?: string
  neighborhood?: string
  identityStatus: 'resolved' | 'partial' | 'missing'
  missingIdentityReasons?: readonly string[]
}

export interface SteeringProposalRank {
  source: 'waypoint'
  rank: number
  score?: number
  tieBreakKey: string
  rankingBasis:
    | 'owner_evidence'
    | 'owner_evidence_with_compatibility_projection'
    | 'refusal'
}

export interface SteeringRefusalReason {
  source: 'waypoint'
  refusalClass: SteeringPrelockRefusalClass
  userFacingCapable: true
  messageKey: string
  ownerEvidenceNeeded: readonly SteeringPrelockOwnerEvidenceSource[]
  ownerReasons?: readonly string[]
}

export interface SteeringOwnerEvidenceProvenance {
  source: SteeringPrelockOwnerEvidenceSource
  key: string
  label?: string
  reason?: string
}

export interface SteeringCompatibilityProvenance {
  source: 'compat'
  key: string
  label?: string
  reason?: string
}

export interface SteeringWaypointProvenance {
  source: 'waypoint'
  key: 'steering_prelock_proposal'
  action: SteeringPrelockAction
  label?: string
  reason?: string
}

export interface SteeringProposalProvenance {
  waypoint: SteeringWaypointProvenance
  ownerTrace: readonly SteeringOwnerEvidenceProvenance[]
  compatibilityTrace?: readonly SteeringCompatibilityProvenance[]
}

export interface SteeringPrelockProposalBase
  extends SteeringPrelockEvidenceGuardrails {
  action: SteeringPrelockAction
  targetRole: UserStopRole
  currentStopIdentity: SteeringStopIdentity
  provenance: SteeringProposalProvenance
}

export interface SteeringPrelockAcceptedProposal
  extends SteeringPrelockProposalBase {
  status: 'proposed'
  candidateIdentity: SteeringStopIdentity
  roleFitEvidence: readonly [SteeringRoleFitEvidence, ...SteeringRoleFitEvidence[]]
  feasibility: readonly [
    SteeringFeasibilityEvidence,
    ...SteeringFeasibilityEvidence[],
  ]
  movementDelta?: SteeringMovementDeltaEvidence
  rank: SteeringProposalRank
  refusalReason?: never
}

export interface SteeringPrelockRefusalProposal
  extends SteeringPrelockProposalBase {
  status: 'refused'
  candidateIdentity?: SteeringStopIdentity
  roleFitEvidence?: readonly SteeringRoleFitEvidence[]
  feasibility?: readonly SteeringFeasibilityEvidence[]
  movementDelta?: SteeringMovementDeltaEvidence
  rank?: SteeringProposalRank
  refusalReason: SteeringRefusalReason
}

export type SteeringPrelockProposal =
  | SteeringPrelockAcceptedProposal
  | SteeringPrelockRefusalProposal

type AssertSteeringOwnerSource<T extends SteeringPrelockOwnerEvidenceSource> = T
type AssertSteeringTraceSource<T extends SteeringPrelockTraceSource> = T
type AssertSteeringRoleFitEvidence<T extends SteeringRoleFitEvidence> = T
type AssertSteeringFeasibilityEvidence<T extends SteeringFeasibilityEvidence> = T
type AssertSteeringMovementDeltaEvidence<
  T extends SteeringMovementDeltaEvidence,
> = T
type AssertSteeringIdentity<T extends SteeringStopIdentity> = T
type AssertAcceptedProposal<T extends SteeringPrelockAcceptedProposal> = T
type AssertRefusalProposal<T extends SteeringPrelockRefusalProposal> = T

export type SteeringTasteEvidenceSourceAccepted =
  AssertSteeringOwnerSource<'taste'>

export type SteeringBearingsEvidenceSourceAccepted =
  AssertSteeringOwnerSource<'bearings'>

export type SteeringFieldEvidenceSourceAccepted =
  AssertSteeringOwnerSource<'field'>

export type SteeringWaypointTraceSourceAccepted =
  AssertSteeringTraceSource<'waypoint'>

// @ts-expect-error Waypoint ranks/proposes but cannot author owner evidence.
export type SteeringWaypointOwnerEvidenceSourceRejected = AssertSteeringOwnerSource<'waypoint'>

// @ts-expect-error Compatibility projections cannot become owner evidence.
export type SteeringCompatOwnerEvidenceSourceRejected = AssertSteeringOwnerSource<'compat'>

// @ts-expect-error Taste role-fit evidence requires Taste provenance.
export type SteeringMissingTasteProvenanceRejected = AssertSteeringRoleFitEvidence<{
    key: 'role_suitability'
    authority: 'owner_evidence'
    value: 0.8
    role: 'highlight'
    verdict: 'strong_fit'
  }>

// @ts-expect-error Bearings feasibility evidence requires Bearings provenance.
export type SteeringWrongFeasibilitySourceRejected = AssertSteeringFeasibilityEvidence<{
    source: 'taste'
    key: 'movement'
    authority: 'owner_evidence'
    value: true
    status: 'feasible'
  }>

// @ts-expect-error Movement delta is Bearings-authored, not Waypoint-authored.
export type SteeringWaypointMovementDeltaRejected = AssertSteeringMovementDeltaEvidence<{
    source: 'waypoint'
    key: 'movement_delta'
    authority: 'owner_evidence'
    value: -4
    deltaMinutes: -4
    direction: 'shorter'
    originAware: true
  }>

// @ts-expect-error Stop identity must be Field-authored.
export type SteeringAppHydratedIdentityRejected = AssertSteeringIdentity<{
  source: 'compat'
  venueId: 'candidate'
  displayName: 'Candidate'
  identityStatus: 'resolved'
}>

// @ts-expect-error Accepted proposals require candidate identity.
export type SteeringAcceptedMissingCandidateIdentityRejected = AssertAcceptedProposal<{
    status: 'proposed'
    action: 'swap_stop'
    targetRole: 'highlight'
    currentStopIdentity: SteeringStopIdentity
    roleFitEvidence: readonly [
      SteeringRoleFitEvidence,
      ...SteeringRoleFitEvidence[],
    ]
    feasibility: readonly [
      SteeringFeasibilityEvidence,
      ...SteeringFeasibilityEvidence[],
    ]
    rank: SteeringProposalRank
    provenance: SteeringProposalProvenance
  }>

// @ts-expect-error Refusal proposals require a load-bearing refusal reason.
export type SteeringRefusalMissingReasonRejected = AssertRefusalProposal<{
  status: 'refused'
  action: 'swap_stop'
  targetRole: 'highlight'
  currentStopIdentity: SteeringStopIdentity
  provenance: SteeringProposalProvenance
}>

// @ts-expect-error Raw role-fit scores cannot be accepted as steering proposal evidence.
export type SteeringRawRoleFitScoreRejected = AssertAcceptedProposal<{
  status: 'proposed'
  action: 'swap_stop'
  targetRole: 'highlight'
  currentStopIdentity: SteeringStopIdentity
  candidateIdentity: SteeringStopIdentity
  rawRoleFitScore: 0.9
  roleFitEvidence: readonly [
    SteeringRoleFitEvidence,
    ...SteeringRoleFitEvidence[],
  ]
  feasibility: readonly [
    SteeringFeasibilityEvidence,
    ...SteeringFeasibilityEvidence[],
  ]
  rank: SteeringProposalRank
  provenance: SteeringProposalProvenance
}>
