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

export interface RoleContractPoolStatus {
  role: InternalRole
  contractLabel: string
  contractStrength: RoleContractStrength
  contractSatisfied: boolean
  contractRelaxed: boolean
  fallbackReason?: string
  preferredDiscoveryVenueId?: string
  preferredDiscoveryVenueAdmitted?: boolean
  preferredDiscoveryVenueRejectedReason?: PreferredDiscoveryAdmissionRejectionReason
  preferredDiscoveryVenueHoursRelaxed?: boolean
  preferredDiscoveryVenueHoursRelaxationReason?: AnchorHoursRelaxationReason
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
  selectedHighlightValidityLevel?: HighlightValidityLevel
  selectedHighlightValidForIntent?: boolean
  selectedHighlightIsFallback?: boolean
  selectedHighlightViolatesIntent?: boolean
  selectedHighlightVetoReason?: string
  packLiteralRequirementSatisfied?: boolean
}
