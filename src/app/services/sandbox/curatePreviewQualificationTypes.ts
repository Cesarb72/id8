import type { DirectionContractBuildability } from '../../../domain/bearings/assessDirectionContractBuildability'

type CurateFailureKind = 'structural_infeasibility' | 'validation_failure' | 'runtime_error'
type CurateRepairQualificationStatus = 'committable' | 'infeasible'
type CurateCommitSemantics = 'seed_guided' | 'approved_route_hard_commit' | null
type CurateStopRole = 'start' | 'highlight' | 'windDown'

export interface CurateWindDownRepairTargetLike {
  role: 'windDown'
  venueId: string | null
  name: string
  category: string | null
  source: string
}

export interface CurateQualificationRepairState<
  TRepairTarget extends CurateWindDownRepairTargetLike = CurateWindDownRepairTargetLike,
> {
  attempted: boolean
  originalWindDown: string | null
  repairedWindDown: string | null
  repairedWindDownTarget: TRepairTarget | null
  repairReason: string | null
  repairSource: string | null
}

export interface CuratePreviewCommitabilityStateLike<
  TDirectionCoreRole extends string = string,
  TApprovedPayload = unknown,
> {
  status: 'checking' | 'committable' | 'infeasible'
  artifactId: string
  hardCommitCandidateCount: number
  rankedCandidateCount: number
  explicitFallbackReason?: string
  failureKind?: CurateFailureKind
  failedCheck?: string | null
  errorName?: string | null
  errorMessageRaw?: string | null
  curateCommitSemantics?: CurateCommitSemantics
  hardCommitRequired?: boolean
  failedRoles: CurateStopRole[]
  contractBuildabilityStatus?: DirectionContractBuildability['contractBuildabilityStatus']
  missingRoleForContract: TDirectionCoreRole | null
  candidatePoolSufficiencyByRole?: Record<TDirectionCoreRole, number>
  selectedDirectionId?: string | null
  activeDistrictPocketId?: string
  selectedArtifactLineageSummary?: string
  plannerInputSummary?: string
  selectedTargetSummary?: string
  exactPreservingCandidateIds?: string[]
  finalWinnerSummary?: string
  sampledCandidatesSummary?: string
  rolePoolVenueIdsByRole?: Record<TDirectionCoreRole, string[]>
  approvedRefinementEntryPayload?: TApprovedPayload
  windDownRepairAttempted?: boolean
  windDownRepairSucceeded?: boolean
  windDownRepairOriginal?: string | null
  windDownRepairReplacement?: string | null
  windDownRepairReplacementId?: string | null
  windDownRepairReason?: string | null
  windDownRepairSource?: string | null
  windDownRepairPreferenceApplied?: boolean
  windDownRepairPreferenceTarget?: string | null
  repairedDiscoveryPrefsWindDown?: string | null
  repairedLineageWindDown?: string | null
  repairedCandidatePoolSufficiencyByRole?: Record<TDirectionCoreRole, number>
  repairedHardCommitCandidateCount?: number | null
  repairedFailureReason?: string | null
  repairedQualificationStatus?: CurateRepairQualificationStatus | null
}
