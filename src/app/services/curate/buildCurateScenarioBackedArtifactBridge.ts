import type { RealityDirectionCard } from '../../types/realityDirectionCard'
import {
  enrichContractEntryArtifactWithDirectionBacking,
  partitionContractEntryArtifactsByDirectionBacking,
} from '../sandbox/contractEntryArtifactNormalizer'
import type { ContractEntryArtifact } from '../../../domain/artifacts/contractEntryArtifact'
import {
  buildContractEntryArtifactFromVerifiedOpportunity,
  type VerifiedOpportunityArtifactBuilderEcsState,
} from '../../../domain/interpretation/buildContractEntryArtifactFromVerifiedOpportunity'
import type { VerifiedCityOpportunity } from '../../../domain/interpretation/verifiedCityOpportunity'

export type CurateScenarioBackedArtifactBridgeSourcePool = 'primary' | 'fallback'

export interface CurateScenarioBackedArtifactBridgeDiagnostic {
  opportunityId: string
  sourcePool: CurateScenarioBackedArtifactBridgeSourcePool
  artifactId: string | null
  contractEntryArtifactProduced: boolean
  directionBackingStatus: ContractEntryArtifact['directionBacking'] extends infer T
    ? T extends { status: infer TStatus }
      ? TStatus
      : 'missing'
    : 'missing'
  directionBackingReason: string | null
  starterSemanticStatus: string | null
  includedInCandidateArtifacts: boolean
  includedInDisplayBackedArtifacts: boolean
  includedInQualificationCandidateArtifacts: boolean
  displayExclusionReason: string | null
}

export interface CurateScenarioBackedArtifactBridgeResult {
  candidateArtifacts: ContractEntryArtifact[]
  fallbackArtifacts: ContractEntryArtifact[]
  displayBackedArtifacts: ContractEntryArtifact[]
  fallbackDisplayBackedArtifacts: ContractEntryArtifact[]
  qualificationCandidateArtifacts: ContractEntryArtifact[]
  diagnostics: CurateScenarioBackedArtifactBridgeDiagnostic[]
}

function dedupeOpportunities(opportunities: VerifiedCityOpportunity[]): VerifiedCityOpportunity[] {
  const byId = new Map<string, VerifiedCityOpportunity>()
  opportunities.forEach((opportunity) => {
    if (!byId.has(opportunity.id)) {
      byId.set(opportunity.id, opportunity)
    }
  })
  return [...byId.values()]
}

function dedupeArtifacts(artifacts: ContractEntryArtifact[]): ContractEntryArtifact[] {
  const byId = new Map<string, ContractEntryArtifact>()
  artifacts.forEach((artifact) => {
    if (!byId.has(artifact.id)) {
      byId.set(artifact.id, artifact)
    }
  })
  return [...byId.values()]
}

function buildArtifactsForPool(params: {
  opportunities: VerifiedCityOpportunity[]
  sourcePool: CurateScenarioBackedArtifactBridgeSourcePool
  ecsState: VerifiedOpportunityArtifactBuilderEcsState
  directionCards: RealityDirectionCard[]
  allDirectionCards: RealityDirectionCard[]
}): {
  artifacts: ContractEntryArtifact[]
  diagnostics: CurateScenarioBackedArtifactBridgeDiagnostic[]
} {
  const artifacts: ContractEntryArtifact[] = []
  const diagnostics: CurateScenarioBackedArtifactBridgeDiagnostic[] = []

  dedupeOpportunities(params.opportunities).forEach((opportunity) => {
    const baseArtifact = buildContractEntryArtifactFromVerifiedOpportunity({
      opportunity,
      ecsState: params.ecsState,
      useScenarioBackedArtifacts: true,
    })
    const artifact = baseArtifact
      ? enrichContractEntryArtifactWithDirectionBacking({
          artifact: baseArtifact,
          directionCards: params.directionCards,
          allDirectionCards: params.allDirectionCards,
        })
      : null
    if (artifact) {
      artifacts.push(artifact)
    }
    const directionBackingStatus = artifact?.directionBacking?.status ?? 'missing'
    diagnostics.push({
      opportunityId: opportunity.id,
      sourcePool: params.sourcePool,
      artifactId: artifact?.id ?? null,
      contractEntryArtifactProduced: Boolean(artifact),
      directionBackingStatus,
      directionBackingReason: artifact?.directionBacking?.reason ?? null,
      starterSemanticStatus:
        artifact?.enrichment?.starterSemanticRepresentation?.status ??
        opportunity.starterSemanticRepresentation?.status ??
        null,
      includedInCandidateArtifacts: false,
      includedInDisplayBackedArtifacts: false,
      includedInQualificationCandidateArtifacts: false,
      displayExclusionReason:
        directionBackingStatus === 'backed'
          ? null
          : artifact
            ? artifact.directionBacking?.reason ?? 'direction_backing_missing'
            : 'contract_entry_artifact_not_produced',
    })
  })

  return {
    artifacts,
    diagnostics,
  }
}

export function buildCurateScenarioBackedArtifactBridge(params: {
  primaryOpportunities: VerifiedCityOpportunity[]
  fallbackOpportunities: VerifiedCityOpportunity[]
  ecsState: VerifiedOpportunityArtifactBuilderEcsState
  directionCards: RealityDirectionCard[]
  allDirectionCards: RealityDirectionCard[]
  maxQualificationCandidateCount?: number
}): CurateScenarioBackedArtifactBridgeResult {
  const primary = buildArtifactsForPool({
    opportunities: params.primaryOpportunities,
    sourcePool: 'primary',
    ecsState: params.ecsState,
    directionCards: params.directionCards,
    allDirectionCards: params.allDirectionCards,
  })
  const fallback = buildArtifactsForPool({
    opportunities: params.fallbackOpportunities,
    sourcePool: 'fallback',
    ecsState: params.ecsState,
    directionCards: params.directionCards,
    allDirectionCards: params.allDirectionCards,
  })
  const primaryPartition = partitionContractEntryArtifactsByDirectionBacking(primary.artifacts)
  const fallbackPartition = partitionContractEntryArtifactsByDirectionBacking(fallback.artifacts)
  const maxQualificationCandidateCount = params.maxQualificationCandidateCount ?? 8
  const qualificationCandidateArtifacts = dedupeArtifacts([
    ...primary.artifacts,
    ...fallback.artifacts,
  ]).slice(0, maxQualificationCandidateCount)
  const candidateArtifactIds = new Set(primary.artifacts.map((artifact) => artifact.id))
  const displayBackedArtifactIds = new Set(
    [
      ...primaryPartition.backedArtifacts,
      ...fallbackPartition.backedArtifacts,
    ].map((artifact) => artifact.id),
  )
  const qualificationArtifactIds = new Set(
    qualificationCandidateArtifacts.map((artifact) => artifact.id),
  )

  return {
    candidateArtifacts: primary.artifacts,
    fallbackArtifacts: fallback.artifacts,
    displayBackedArtifacts: primaryPartition.backedArtifacts,
    fallbackDisplayBackedArtifacts: fallbackPartition.backedArtifacts,
    qualificationCandidateArtifacts,
    diagnostics: [...primary.diagnostics, ...fallback.diagnostics].map((entry) => ({
      ...entry,
      includedInCandidateArtifacts: Boolean(
        entry.artifactId && candidateArtifactIds.has(entry.artifactId),
      ),
      includedInDisplayBackedArtifacts: Boolean(
        entry.artifactId && displayBackedArtifactIds.has(entry.artifactId),
      ),
      includedInQualificationCandidateArtifacts: Boolean(
        entry.artifactId && qualificationArtifactIds.has(entry.artifactId),
      ),
    })),
  }
}
