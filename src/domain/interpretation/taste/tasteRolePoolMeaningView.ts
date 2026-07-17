import type {
  RolePoolMeaningCandidateEvidence,
  RolePoolMeaningCandidateInput,
  RolePoolMeaningContextEvidence,
  RolePoolMeaningContextInput,
  RolePoolMeaningEvidence,
} from './computeRolePoolMeaningEvidence'
import type {
  TasteRouteMeaningCompatibilityStatus,
  TasteRouteMeaningFitStrength,
  TasteRouteMeaningSignalComponent,
  TasteRouteMeaningStopRole,
  TasteRouteMeaningVenueId,
} from './routeMeaningVerdict'

export type TasteRolePoolMeaningViewSource = 'taste'

export type TasteRolePoolMeaningViewScope = 'candidate_set_pre_coordination'

export type TasteRolePoolMeaningEvidenceKind =
  | 'peak_worthiness'
  | 'central_moment_quality'
  | 'romantic_role_meaning'
  | 'family_role_meaning'
  | 'expression_activation_meaning'
  | 'role_suitability_meaning'
  | 'category_archetype_meaning'
  | 'easy_hang_meaning'

export type NonTasteRolePoolMeaningEvidenceKind =
  | 'peak_arbitration'
  | 'winner_selection'
  | 'fallback_selection'
  | 'preservation_decision'
  | 'recovery_decision'
  | 'route_sequencing'
  | 'peak_feasibility'
  | 'hours_feasibility'
  | 'movement_feasibility'
  | 'source_record_truth'

export interface TasteRolePoolMeaningProvenance {
  source: TasteRolePoolMeaningViewSource
  key: string
  label?: string
  reason?: string
}

export interface TasteRolePoolCandidateMeaningInput {
  source: TasteRolePoolMeaningViewSource
  role?: TasteRouteMeaningStopRole
  candidate: RolePoolMeaningCandidateInput
  context: RolePoolMeaningContextInput
}

export interface TasteRolePoolCandidateMeaningEvidence<
  TKind extends TasteRolePoolMeaningEvidenceKind = TasteRolePoolMeaningEvidenceKind,
> {
  source: TasteRolePoolMeaningViewSource
  kind: TKind
  candidateVenueId?: TasteRouteMeaningVenueId
  role?: TasteRouteMeaningStopRole
  score?: number
  strength?: TasteRouteMeaningFitStrength
  compatibility?: TasteRouteMeaningCompatibilityStatus
  reasons?: readonly string[]
  components?: readonly TasteRouteMeaningSignalComponent<number | string | boolean>[]
  candidateEvidence?: RolePoolMeaningCandidateEvidence
  rolePoolEvidence?: RolePoolMeaningEvidence['rolePoolEvidence']
}

export interface TasteRolePoolMeaningContextView {
  source: TasteRolePoolMeaningViewSource
  contextInput?: RolePoolMeaningContextInput
  contextEvidence?: RolePoolMeaningContextEvidence
}

export interface TasteRolePoolMeaningView {
  source: TasteRolePoolMeaningViewSource
  scope: TasteRolePoolMeaningViewScope
  provenance: readonly TasteRolePoolMeaningProvenance[]
  context?: TasteRolePoolMeaningContextView
  candidates: readonly TasteRolePoolCandidateMeaningEvidence[]
  rolePools?: Partial<
    Record<TasteRouteMeaningStopRole, readonly TasteRolePoolCandidateMeaningEvidence[]>
  >
  foundation?: readonly RolePoolMeaningEvidence[]
}

type AssertTasteRolePoolMeaningEvidenceKind<
  TKind extends TasteRolePoolMeaningEvidenceKind,
> = TKind

export type TasteRolePoolMeaningPeakWorthinessAccepted =
  AssertTasteRolePoolMeaningEvidenceKind<'peak_worthiness'>

export type TasteRolePoolMeaningCentralMomentQualityAccepted =
  AssertTasteRolePoolMeaningEvidenceKind<'central_moment_quality'>

// @ts-expect-error Taste carries peak worthiness, not peak arbitration.
export type TasteRolePoolMeaningRejectsArbitration = AssertTasteRolePoolMeaningEvidenceKind<'peak_arbitration'>

// @ts-expect-error Bearings owns feasibility evidence.
export type TasteRolePoolMeaningRejectsFeasibility = AssertTasteRolePoolMeaningEvidenceKind<'movement_feasibility'>

// @ts-expect-error Waypoint/coordination owns fallback selection.
export type TasteRolePoolMeaningRejectsFallbackSelection = AssertTasteRolePoolMeaningEvidenceKind<'fallback_selection'>

// @ts-expect-error LCE/coordination owns preservation decisions, not Taste meaning.
export type TasteRolePoolMeaningRejectsPreservationDecision = AssertTasteRolePoolMeaningEvidenceKind<'preservation_decision'>

// @ts-expect-error Field owns source record truth.
export type TasteRolePoolMeaningRejectsRecordTruth = AssertTasteRolePoolMeaningEvidenceKind<'source_record_truth'>

// @ts-expect-error Untyped generic evidence cannot bypass the Taste role-pool boundary.
export type TasteRolePoolMeaningRejectsUntypedKind = AssertTasteRolePoolMeaningEvidenceKind<string>
