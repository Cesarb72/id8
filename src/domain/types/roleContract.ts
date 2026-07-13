import type { LensPersonaContract, LensStopRole, ResolvedHospitalityContract } from './experienceLens'
import type { HighlightValidityLevel } from './highlightValidity'
import type { InternalRole, VenueCategory } from './venue'

export type RoleContractStrength = 'none' | 'soft' | 'strong' | 'hard'
export type PreferredDiscoveryAdmissionRejectionReason =
  | 'rejected_hours'
  | 'rejected_context'
  | 'rejected_role_fit'
  | 'rejected_structure'

export type AnchorAdmissionFailureReason =
  | PreferredDiscoveryAdmissionRejectionReason
  | 'anchor_not_scored'

export type AnchorHoursRelaxationReason = 'no_explicit_time'

export interface RoleContractRule {
  label: string
  role: LensStopRole
  strength: RoleContractStrength
  requiredCategories: VenueCategory[]
  preferredCategories: VenueCategory[]
  discouragedCategories: VenueCategory[]
  requiredTags: string[]
  preferredTags: string[]
  discouragedTags: string[]
  maxEnergyLevel?: number
}

export interface RoleContractSet {
  sourceLabels: string[]
  byRole: Record<LensStopRole, RoleContractRule>
  personaContract?: LensPersonaContract
  resolvedContract?: ResolvedHospitalityContract
}

export interface RoleContractEvaluation {
  contractLabel: string
  strength: RoleContractStrength
  score: number
  satisfied: boolean
  matchedSignals: string[]
  violations: string[]
}

interface RolePoolStatusBase {
  role: InternalRole
  contractLabel: string
  contractStrength: RoleContractStrength
}

/**
 * Load-bearing role-pool behavior truth. Later consumers can migrate here when
 * proving candidate admission, preservation, and ordering behavior is unchanged.
 */
export interface RolePoolAdmissionStatus extends RolePoolStatusBase {
  contractSatisfied: boolean
  contractRelaxed: boolean
  fallbackReason?: string
  preferredDiscoveryVenueId?: string
  preferredDiscoveryVenueAdmitted?: boolean
  preferredDiscoveryVenueRejectedReason?: PreferredDiscoveryAdmissionRejectionReason
  preferredDiscoveryVenueHoursRelaxed?: boolean
  preferredDiscoveryVenueHoursRelaxationReason?: AnchorHoursRelaxationReason
  tightSupportAdmissionActive?: boolean
  tightSupportAdmissionReason?: string
  requiredAnchorBaseVenueId?: string
  requiredAnchorNeighborhood?: string
  supportSupplyMissing?: boolean
}

/**
 * User-facing role-pool explanation truth.
 *
 * This bucket is user-facing. Any future consumer migration must prove public
 * stop-reason copy is byte-for-byte or snapshot-equivalent unchanged
 * before/after, including rejectedReason and fallbackReason cases. This is
 * part of the honest-failure / never-masked-route posture.
 */
export interface RolePoolPublicReasonStatus extends RolePoolStatusBase {
  contractSatisfied: boolean
  contractRelaxed: boolean
  fallbackReason?: string
  preferredDiscoveryVenueRejectedReason?: PreferredDiscoveryAdmissionRejectionReason
  preferredDiscoveryVenueHoursRelaxed?: boolean
  preferredDiscoveryVenueHoursRelaxationReason?: AnchorHoursRelaxationReason
  fallbackUsedBecauseNoValidHighlight?: boolean
  centralMomentRecoveryReason?: string
  selectedHighlightVetoReason?: string
}

/**
 * Debug and development diagnostics. These fields explain pool formation and
 * route selection, but are not the behavior-authoring path by themselves.
 */
export interface RolePoolDiagnosticsStatus extends RolePoolStatusBase {
  strictCandidateCount: number
  relaxedCandidateCount: number
  bestContractCandidateId?: string
  validCandidateCount?: number
  fallbackCandidateCount?: number
  invalidCandidateCount?: number
  fallbackUsedBecauseNoValidHighlight?: boolean
  bestValidHighlightCandidateId?: string
  bestValidHighlightChallengerId?: string
  recoveredCentralMomentHighlight?: boolean
  recoveredHighlightCandidatesCount?: number
  centralMomentRecoveryReason?: string
  requiredAnchorBaseVenueId?: string
  requiredAnchorNeighborhood?: string
  nearAnchorSupportCandidateCountBeforeAdmission?: number
  nearAnchorSupportCandidateCountAfterAdmission?: number
  nearAnchorSupportCandidateIds?: string[]
  supportSupplyMissing?: boolean
  selectedHighlightValidityLevel?: HighlightValidityLevel
  selectedHighlightValidForIntent?: boolean
  selectedHighlightIsFallback?: boolean
  selectedHighlightViolatesIntent?: boolean
  selectedHighlightVetoReason?: string
  packLiteralRequirementSatisfied?: boolean
}

/**
 * Temporary compatibility shape for the existing contractPoolStatus projection.
 * Keep this intact while later slices migrate consumers into narrower buckets.
 */
export interface RolePoolCompatibilityStatus
  extends RolePoolAdmissionStatus,
    RolePoolPublicReasonStatus,
    RolePoolDiagnosticsStatus {}

export interface RoleContractPoolStatus extends RolePoolCompatibilityStatus {}
