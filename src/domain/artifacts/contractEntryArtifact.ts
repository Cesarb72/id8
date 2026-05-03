import type { BuiltScenarioNight } from '../interpretation/construction/scenarioBuilder'
import type { DirectionContractBuildability } from '../bearings/assessDirectionContractBuildability'
import type { UserStopRole } from '../types/itinerary'

/**
 * ARC BOUNDARY: interpretation-owned candidate route artifact.
 *
 * `ContractEntryArtifact` is the canonical shared contract for Step 2 / pre-commit
 * route candidates. Application wrappers may select, project, and render it, but
 * should not redefine the artifact shape locally.
 */

export interface ContractEntryArtifactStorySpine {
  start: string
  highlight: string
  windDown: string
}

export interface ContractEntryArtifactSelection {
  pocketId?: string
  directionId?: string
}

export interface ContractEntryArtifactLineage {
  artifactId: string
  sourceOpportunityId: string
  anchorVenueId: string
  anchorRole?: Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>
  directionId?: string
  pocketId?: string
}

export interface ContractEntryArtifactQualification<
  TDirectionCoreRole extends string = string,
  TApprovedPayload = unknown,
> {
  status: 'checking' | 'committable' | 'infeasible'
  failureKind?: 'structural_infeasibility' | 'validation_failure' | 'runtime_error'
  failedCheck?: string | null
  missingRoleForContract: TDirectionCoreRole | null
  candidatePoolSufficiencyByRole?: Record<TDirectionCoreRole, number>
  contractBuildabilityStatus?: DirectionContractBuildability['contractBuildabilityStatus']
  hardCommitRequired?: boolean
  approvedRefinementEntryPayload?: TApprovedPayload
}

export interface ContractEntryArtifact {
  id: string
  sourceOpportunityId: string
  anchorVenueId: string
  anchorRole?: Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>
  anchorName: string
  routeTitle: string
  flavorLine: string
  routeSummary: string
  traits: string[]
  storySpine: ContractEntryArtifactStorySpine
  districtLine: string
  districtAnchorLine: string
  authorityLine: string
  happeningsLine?: string
  whyChooseLine: string
  whyTonightProofLine?: string
  scenarioEvaluation?: BuiltScenarioNight['evaluation']
  selection: ContractEntryArtifactSelection
  qualification?: ContractEntryArtifactQualification
}

export function buildContractEntryArtifactLineage(
  artifact: ContractEntryArtifact,
): ContractEntryArtifactLineage {
  return {
    artifactId: artifact.id,
    sourceOpportunityId: artifact.sourceOpportunityId,
    anchorVenueId: artifact.anchorVenueId,
    ...(artifact.anchorRole ? { anchorRole: artifact.anchorRole } : {}),
    ...(artifact.selection.directionId ? { directionId: artifact.selection.directionId } : {}),
    ...(artifact.selection.pocketId ? { pocketId: artifact.selection.pocketId } : {}),
  }
}

// Compatibility alias during extraction from page-local naming.
export type CanonicalCandidateRouteArtifact = ContractEntryArtifact
