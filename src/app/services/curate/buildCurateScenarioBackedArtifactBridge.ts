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
  StarterSemanticEvidenceKind,
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
  | 'scenario_route_seed_projection_missing'
  | 'coffee_books_insufficient_in_pocket_literary_supply'
type CurateHardCommitFeasibilityFailureClass =
  | 'missing_seed_identity'
  | 'missing_discovery_preference_identity'
  | 'role_mapping_mismatch'
  | 'planner_inventory_mismatch'
  | 'exact_preservation_failed'
  | 'semantic_contract_failed'
  | 'canonical_start_not_planner_compatible'
  | 'canonical_highlight_not_planner_compatible'
  | 'canonical_windDown_not_planner_compatible'
  | 'canonical_role_missing_seed'
  | 'canonical_role_missing_discovery_preference'
  | 'canonical_role_not_in_planner_pool'
  | 'canonical_exact_preservation_failed'
  | 'materialization_unresolved'
type CurateHardCommitFeasibilityRole = Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>

interface CurateHardCommitFeasibilityRoleDiagnostic {
  role: CurateHardCommitFeasibilityRole
  expectedArcRole: 'warmup' | 'peak' | 'cooldown'
  selectedStopId: string | null
  selectedStopName: string | null
  seedVenueId: string | null
  discoveryPreferenceVenueId: string | null
  presentInProjectedRoleSet: boolean
  failed: boolean
  failureClass: CurateHardCommitFeasibilityFailureClass | null
}

interface CurateHardCommitFeasibilityDiagnostic {
  routeArtifactId: string | null
  status: 'passed' | 'failed' | 'not_applicable'
  failureClass: CurateHardCommitFeasibilityFailureClass | null
  failedRole: CurateHardCommitFeasibilityRole | null
  failedStopId: string | null
  failedStopName: string | null
  selectedStopIds: Record<CurateHardCommitFeasibilityRole, string | null>
  seedVenueIds: Record<CurateHardCommitFeasibilityRole, string | null>
  discoveryPreferenceVenueIds: Record<CurateHardCommitFeasibilityRole, string | null>
  roleDiagnostics: CurateHardCommitFeasibilityRoleDiagnostic[]
}

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
  hardCommitFeasibility: CurateHardCommitFeasibilityDiagnostic
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

const COFFEE_BOOKS_PUBLIC_EVIDENCE_TYPES = new Set<StarterSemanticEvidenceKind>([
  'book',
  'reading',
  'literary',
  'library',
  'bookstore',
])

function starterSemanticRepresentationHasPublicCoffeeBooksEvidence(
  representation: StarterSemanticRepresentation | undefined,
): boolean {
  return Boolean(
    representation?.status === 'represented' &&
      representation.evidence.some(
        (entry) =>
          entry.source === 'selected_route_stop' &&
          entry.evidenceTypes.some((type) => COFFEE_BOOKS_PUBLIC_EVIDENCE_TYPES.has(type)),
      ),
  )
}

function expectedArcRoleFor(
  role: CurateHardCommitFeasibilityRole,
): CurateHardCommitFeasibilityRoleDiagnostic['expectedArcRole'] {
  if (role === 'start') {
    return 'warmup'
  }
  if (role === 'highlight') {
    return 'peak'
  }
  return 'cooldown'
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
  hardCommitFeasibility: CurateHardCommitFeasibilityDiagnostic
} {
  const { opportunity, artifact, starterPack } = params
  const buildFeasibility = (overrides: Partial<CurateHardCommitFeasibilityDiagnostic> = {}) => {
    const roles = ['start', 'highlight', 'windDown'] as const
    const roleDiagnostics = roles.map((role) => {
      const stop = artifact && opportunity.scenarioNight
        ? resolveScenarioCoreStop({ opportunity, artifact, role })
        : undefined
      const selectedStopId = stop?.venueId ?? null
      const selectedStopName = stop?.name ?? null
      const failed = !selectedStopId || overrides.failureClass === 'semantic_contract_failed'
      return {
        role,
        expectedArcRole: expectedArcRoleFor(role),
        selectedStopId,
        selectedStopName,
        seedVenueId: selectedStopId,
        discoveryPreferenceVenueId: selectedStopId,
        presentInProjectedRoleSet: Boolean(selectedStopId),
        failed,
        failureClass: failed
          ? overrides.failureClass ?? 'missing_seed_identity'
          : null,
      }
    })
    const failedDiagnostic = roleDiagnostics.find((entry) => entry.failed)
    return {
      routeArtifactId: artifact?.id ?? null,
      status: overrides.status ?? (failedDiagnostic ? 'failed' : 'passed'),
      failureClass:
        overrides.failureClass ??
        failedDiagnostic?.failureClass ??
        null,
      failedRole: overrides.failedRole ?? failedDiagnostic?.role ?? null,
      failedStopId: overrides.failedStopId ?? failedDiagnostic?.selectedStopId ?? null,
      failedStopName: overrides.failedStopName ?? failedDiagnostic?.selectedStopName ?? null,
      selectedStopIds: {
        start: roleDiagnostics.find((entry) => entry.role === 'start')?.selectedStopId ?? null,
        highlight: roleDiagnostics.find((entry) => entry.role === 'highlight')?.selectedStopId ?? null,
        windDown: roleDiagnostics.find((entry) => entry.role === 'windDown')?.selectedStopId ?? null,
      },
      seedVenueIds: {
        start: roleDiagnostics.find((entry) => entry.role === 'start')?.seedVenueId ?? null,
        highlight: roleDiagnostics.find((entry) => entry.role === 'highlight')?.seedVenueId ?? null,
        windDown: roleDiagnostics.find((entry) => entry.role === 'windDown')?.seedVenueId ?? null,
      },
      discoveryPreferenceVenueIds: {
        start:
          roleDiagnostics.find((entry) => entry.role === 'start')?.discoveryPreferenceVenueId ??
          null,
        highlight:
          roleDiagnostics.find((entry) => entry.role === 'highlight')?.discoveryPreferenceVenueId ??
          null,
        windDown:
          roleDiagnostics.find((entry) => entry.role === 'windDown')?.discoveryPreferenceVenueId ??
          null,
      },
      roleDiagnostics,
      ...overrides,
    } satisfies CurateHardCommitFeasibilityDiagnostic
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
      hardCommitFeasibility: buildFeasibility({
        status: 'failed',
        failureClass: 'planner_inventory_mismatch',
      }),
    }
  }
  if (!artifact || !opportunity.scenarioNight) {
    return {
      allowed: false,
      status: 'rejected',
      reason: 'scenario_route_seed_projection_missing',
      failedRoles: ['start', 'highlight', 'windDown'],
      seedProjectionAvailable: false,
      hardCommitFeasibility: buildFeasibility({
        status: 'failed',
        failureClass: 'missing_seed_identity',
      }),
    }
  }

  if (
    starterPack?.id === 'coffee-books' &&
    !starterSemanticRepresentationHasPublicCoffeeBooksEvidence(
      artifact.enrichment?.starterSemanticRepresentation ??
        opportunity.starterSemanticRepresentation,
    )
  ) {
    return {
      allowed: false,
      status: 'rejected',
      reason: 'coffee_books_insufficient_in_pocket_literary_supply',
      failedRoles: ['highlight'],
      seedProjectionAvailable: true,
      hardCommitFeasibility: buildFeasibility({
        status: 'failed',
        failureClass: 'semantic_contract_failed',
        failedRole: 'highlight',
      }),
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
      hardCommitFeasibility: buildFeasibility({
        status: 'failed',
        failureClass: 'missing_seed_identity',
        failedRole: missingRoles[0] ?? null,
      }),
    }
  }

  return {
    allowed: true,
    status: 'passed',
    reason: null,
    failedRoles: [],
    seedProjectionAvailable: true,
    hardCommitFeasibility: buildFeasibility(),
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
      hardCommitFeasibility: admission.hardCommitFeasibility,
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
