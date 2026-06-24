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
import type {
  BuiltScenarioStop,
  StarterSemanticRepresentation,
} from '../../../domain/interpretation/construction/scenarioBuilder'
import type { VerifiedCityOpportunity } from '../../../domain/interpretation/verifiedCityOpportunity'
import type { StarterPack } from '../../../domain/types/starterPack'
import type { UserStopRole } from '../../../domain/types/itinerary'

export type CurateScenarioBackedArtifactBridgeSourcePool = 'primary' | 'fallback'
type CurateScenarioBuildabilityAdmissionStatus = 'not_applicable' | 'passed' | 'rejected'
type CurateScenarioBuildabilityAdmissionReason =
  | 'scenario_route_buildability_mismatch'
  | 'scenario_route_mixed_di_fallback_scattered'
  | 'coffee_books_wind_down_energy_mismatch'
  | 'coffee_books_semantic_representation_missing'
  | 'scenario_route_seed_projection_missing'

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
  scenarioRouteBuildabilityStatus: CurateScenarioBuildabilityAdmissionStatus
  scenarioRouteBuildabilityReason: CurateScenarioBuildabilityAdmissionReason | null
  scenarioRouteBuildabilityFailedRoles: Array<Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>>
  scenarioRouteBuildabilitySeedProjectionAvailable: boolean
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

function starterSemanticRepresentationIsSelectedStopBacked(
  representation: StarterSemanticRepresentation | undefined,
): boolean {
  return Boolean(
    representation?.status === 'represented' &&
      representation.evidence.some((entry) => entry.source === 'selected_route_stop'),
  )
}

function findScenarioStopByVenueId(
  opportunity: VerifiedCityOpportunity,
  venueId: string | undefined,
): BuiltScenarioStop | undefined {
  const normalizedVenueId = venueId?.trim()
  if (!normalizedVenueId) {
    return undefined
  }
  return opportunity.scenarioNight?.stops.find((stop) => stop.venueId === normalizedVenueId)
}

function findScenarioStopByName(
  opportunity: VerifiedCityOpportunity,
  name: string | undefined,
): BuiltScenarioStop | undefined {
  const normalizedName = name?.trim().toLowerCase()
  if (!normalizedName) {
    return undefined
  }
  return opportunity.scenarioNight?.stops.find(
    (stop) => stop.name.trim().toLowerCase() === normalizedName,
  )
}

function findStopOptionVenueIdByName(
  opportunity: VerifiedCityOpportunity,
  role: Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>,
  name: string | undefined,
): string | undefined {
  const normalizedName = name?.trim().toLowerCase()
  if (!normalizedName) {
    return undefined
  }
  const options =
    role === 'start'
      ? opportunity.starts
      : role === 'highlight'
        ? [opportunity.anchor, ...(opportunity.highlightAlternates ?? [])]
        : opportunity.closes
  return options.find((option) => option.name.trim().toLowerCase() === normalizedName)?.venueId
}

function resolveScenarioCoreStop(params: {
  opportunity: VerifiedCityOpportunity
  artifact: ContractEntryArtifact
  role: Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>
}): BuiltScenarioStop | undefined {
  const { opportunity, artifact, role } = params
  const storyName =
    role === 'start'
      ? artifact.storySpine.start
      : role === 'highlight'
        ? artifact.storySpine.highlight
        : artifact.storySpine.windDown
  const stopOptionVenueId = findStopOptionVenueIdByName(opportunity, role, storyName)
  const stopFromOption = findScenarioStopByVenueId(opportunity, stopOptionVenueId)
  if (stopFromOption) {
    return stopFromOption
  }
  const stopFromStoryName = findScenarioStopByName(opportunity, storyName)
  if (stopFromStoryName) {
    return stopFromStoryName
  }
  if (role === 'start') {
    return opportunity.scenarioNight?.stops.find((stop) => stop.position === 'start')
  }
  if (role === 'highlight') {
    return (
      opportunity.scenarioNight?.stops.find((stop) => stop.position === 'highlight') ??
      findScenarioStopByVenueId(opportunity, artifact.anchorVenueId)
    )
  }
  return (
    opportunity.scenarioNight?.stops.find((stop) => stop.position === 'closer') ??
    opportunity.scenarioNight?.stops[opportunity.scenarioNight.stops.length - 1]
  )
}

function estimateCoffeeBooksScenarioStopEnergy(
  stop: BuiltScenarioStop,
  role: Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>,
): number {
  if (role === 'start') {
    return 2
  }
  if (role === 'highlight' || role === 'windDown') {
    if (
      stop.venueCategory === 'cafe' ||
      stop.venueCategory === 'dessert' ||
      stop.venueCategory === 'museum' ||
      stop.venueCategory === 'park'
    ) {
      return 2
    }
    if (stop.venueCategory === 'bar' || stop.venueCategory === 'restaurant') {
      return 3
    }
    if (
      stop.venueCategory === 'activity' ||
      stop.venueCategory === 'event' ||
      stop.venueCategory === 'live_music'
    ) {
      return 4
    }
    return 3
  }
  return 3
}

function scenarioStopSatisfiesRoleContract(params: {
  starterPack: StarterPack
  stop: BuiltScenarioStop
  role: Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>
}): boolean {
  const { starterPack, stop, role } = params
  const contract = starterPack.roleContracts?.[role]
  if (!contract) {
    return true
  }
  if (
    contract.requiredCategories &&
    contract.requiredCategories.length > 0 &&
    (!stop.venueCategory || !contract.requiredCategories.includes(stop.venueCategory))
  ) {
    return false
  }
  if (
    typeof contract.maxEnergyLevel === 'number' &&
    estimateCoffeeBooksScenarioStopEnergy(stop, role) > contract.maxEnergyLevel
  ) {
    return false
  }
  const roleFit =
    role === 'start'
      ? stop.roleFit.start
      : role === 'highlight'
        ? stop.roleFit.highlight
        : stop.roleFit.windDown
  return typeof roleFit === 'number' ? roleFit >= 0.24 : true
}

function assessCoffeeBooksScenarioBuildability(params: {
  opportunity: VerifiedCityOpportunity
  artifact: ContractEntryArtifact | null
  starterPack?: StarterPack | null
}): {
  allowed: boolean
  status: CurateScenarioBuildabilityAdmissionStatus
  reason: CurateScenarioBuildabilityAdmissionReason | null
  failedRoles: Array<Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>>
  seedProjectionAvailable: boolean
} {
  const { opportunity, artifact, starterPack } = params
  if (starterPack?.id !== 'coffee-books') {
    return {
      allowed: true,
      status: 'not_applicable',
      reason: null,
      failedRoles: [],
      seedProjectionAvailable: true,
    }
  }
  if (
    opportunity.scenarioNight?.geoCoherence?.rejectionReason ===
    'scenario_route_mixed_di_fallback_scattered'
  ) {
    return {
      allowed: false,
      status: 'rejected',
      reason: 'scenario_route_mixed_di_fallback_scattered',
      failedRoles: [],
      seedProjectionAvailable: false,
    }
  }
  if (!artifact || !opportunity.scenarioNight) {
    return {
      allowed: false,
      status: 'rejected',
      reason: 'scenario_route_seed_projection_missing',
      failedRoles: ['start', 'highlight', 'windDown'],
      seedProjectionAvailable: false,
    }
  }

  const representation =
    artifact.enrichment?.starterSemanticRepresentation ??
    opportunity.starterSemanticRepresentation ??
    opportunity.scenarioNight.starterSemanticRepresentation
  if (!starterSemanticRepresentationIsSelectedStopBacked(representation)) {
    return {
      allowed: false,
      status: 'rejected',
      reason: 'coffee_books_semantic_representation_missing',
      failedRoles: [],
      seedProjectionAvailable: true,
    }
  }

  const roles = ['start', 'highlight', 'windDown'] as const
  const stopsByRole = new Map(
    roles.map((role) => [
      role,
      resolveScenarioCoreStop({
        opportunity,
        artifact,
        role,
      }),
    ]),
  )
  const missingRoles = roles.filter((role) => !stopsByRole.get(role))
  if (missingRoles.length > 0) {
    return {
      allowed: false,
      status: 'rejected',
      reason: 'scenario_route_seed_projection_missing',
      failedRoles: [...missingRoles],
      seedProjectionAvailable: false,
    }
  }

  const failedRoles = roles.filter((role) => {
    const stop = stopsByRole.get(role)
    return stop
      ? !scenarioStopSatisfiesRoleContract({
          starterPack,
          stop,
          role,
        })
      : true
  })
  if (failedRoles.length > 0) {
    const windDownStop = stopsByRole.get('windDown')
    const windDownMaxEnergy = starterPack.roleContracts?.windDown?.maxEnergyLevel
    const windDownEnergy = windDownStop
      ? estimateCoffeeBooksScenarioStopEnergy(windDownStop, 'windDown')
      : null
    return {
      allowed: false,
      status: 'rejected',
      reason:
        failedRoles.includes('windDown') &&
        typeof windDownMaxEnergy === 'number' &&
        typeof windDownEnergy === 'number' &&
        windDownEnergy > windDownMaxEnergy
          ? 'coffee_books_wind_down_energy_mismatch'
          : 'scenario_route_buildability_mismatch',
      failedRoles: [...failedRoles],
      seedProjectionAvailable: true,
    }
  }

  return {
    allowed: true,
    status: 'passed',
    reason: null,
    failedRoles: [],
    seedProjectionAvailable: true,
  }
}

function buildArtifactsForPool(params: {
  opportunities: VerifiedCityOpportunity[]
  sourcePool: CurateScenarioBackedArtifactBridgeSourcePool
  ecsState: VerifiedOpportunityArtifactBuilderEcsState
  directionCards: RealityDirectionCard[]
  allDirectionCards: RealityDirectionCard[]
  starterPack?: StarterPack | null
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
    const admission = assessCoffeeBooksScenarioBuildability({
      opportunity,
      artifact,
      starterPack: params.starterPack,
    })
    if (artifact && admission.allowed) {
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
        admission.reason ??
        (directionBackingStatus === 'backed'
          ? null
          : artifact
            ? artifact.directionBacking?.reason ?? 'direction_backing_missing'
            : 'contract_entry_artifact_not_produced'),
      scenarioRouteBuildabilityStatus: admission.status,
      scenarioRouteBuildabilityReason: admission.reason,
      scenarioRouteBuildabilityFailedRoles: admission.failedRoles,
      scenarioRouteBuildabilitySeedProjectionAvailable: admission.seedProjectionAvailable,
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
  starterPack?: StarterPack | null
}): CurateScenarioBackedArtifactBridgeResult {
  const primary = buildArtifactsForPool({
    opportunities: params.primaryOpportunities,
    sourcePool: 'primary',
    ecsState: params.ecsState,
    directionCards: params.directionCards,
    allDirectionCards: params.allDirectionCards,
    starterPack: params.starterPack,
  })
  const fallback = buildArtifactsForPool({
    opportunities: params.fallbackOpportunities,
    sourcePool: 'fallback',
    ecsState: params.ecsState,
    directionCards: params.directionCards,
    allDirectionCards: params.allDirectionCards,
    starterPack: params.starterPack,
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
