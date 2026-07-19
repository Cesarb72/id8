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
  | CurateHardPocketProofTargetAssertionReason
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
  | 'proof_target_assertion_failed'
type CurateHardCommitFeasibilityRole = Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>

export type CurateHardPocketProofTargetAssertionReason =
  | 'proof_target_selected_direction_missing'
  | 'proof_target_selected_pocket_missing'
  | 'proof_target_active_pocket_mismatch'
  | 'proof_target_selected_stop_outside_pocket'
  | 'proof_target_cross_pocket_not_allowed'
  | 'proof_target_semantic_proof_missing'

export interface CurateHardPocketProofTargetAssertionContext {
  diagnosticOnly: true
  proofTargetId: string
  targetPocketId?: string | null
  targetPocketLabel?: string | null
  activePocketId?: string | null
  activePocketLabel?: string | null
  activePocketCenter?: { lat: number; lng: number } | null
  activePocketHintRadiusM?: number | null
  activeFieldAdmissionEnvelopeRadiusM?: number | null
  crossPocketAllowed?: boolean
}

export interface CurateHardPocketProofTargetAssertionResult {
  diagnosticOnly: true
  status: 'passed' | 'failed' | 'not_applicable'
  reason: CurateHardPocketProofTargetAssertionReason | null
  proofTargetId: string | null
  crossPocketAllowed: boolean
  selectedDirectionId: string | null
  selectedPocketId: string | null
  targetPocketId: string | null
  targetPocketLabel: string | null
  activePocketId: string | null
  activePocketLabel: string | null
  activePocketCenter: { lat: number; lng: number } | null
  activePocketHintRadiusM: number | null
  activeFieldAdmissionEnvelopeRadiusM: number | null
  selectedProofStopId: string | null
  selectedProofStopName: string | null
  selectedProofStopPocketId: string | null
  selectedProofStopPocketLabel: string | null
}

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
  proofTargetAssertion: CurateHardPocketProofTargetAssertionResult
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

function normalizeProofTargetToken(value: string | undefined | null): string {
  return value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim() ?? ''
}

function proofTargetTokensMatch(left: string | undefined | null, right: string | undefined | null): boolean {
  const normalizedLeft = normalizeProofTargetToken(left)
  const normalizedRight = normalizeProofTargetToken(right)
  return Boolean(
    normalizedLeft &&
      normalizedRight &&
      (normalizedLeft === normalizedRight ||
        normalizedLeft.includes(normalizedRight) ||
        normalizedRight.includes(normalizedLeft)),
  )
}

function findSelectedStopForCoffeeBooksProof(params: {
  opportunity: VerifiedCityOpportunity
  representation: StarterSemanticRepresentation | undefined
}): BuiltScenarioStop | undefined {
  const evidence = params.representation?.evidence.find(
    (entry) =>
      entry.source === 'selected_route_stop' &&
      entry.evidenceTypes.some((type) => COFFEE_BOOKS_PUBLIC_EVIDENCE_TYPES.has(type)),
  )
  if (!evidence) {
    return undefined
  }
  return (
    findScenarioStopByVenueId(params.opportunity, evidence.venueId) ??
    findScenarioStopByName(params.opportunity, evidence.name)
  )
}

function selectedProofStopMatchesPocket(params: {
  stop: BuiltScenarioStop
  targetPocketId: string
  targetPocketLabel?: string | null
}): boolean {
  if (proofTargetTokensMatch(params.stop.geoBucket, params.targetPocketId)) {
    return true
  }
  if (!params.targetPocketLabel) {
    return false
  }
  return (
    proofTargetTokensMatch(params.stop.geoLabel, params.targetPocketLabel) ||
    proofTargetTokensMatch(params.stop.district, params.targetPocketLabel) ||
    proofTargetTokensMatch(params.stop.neighborhoodLabel, params.targetPocketLabel)
  )
}

function proofTargetPocketIdentitiesMatch(params: {
  leftPocketId?: string | null
  leftPocketLabel?: string | null
  rightPocketId?: string | null
  rightPocketLabel?: string | null
}): boolean {
  if (
    params.leftPocketId &&
    params.rightPocketId &&
    params.leftPocketId === params.rightPocketId
  ) {
    return true
  }
  return (
    proofTargetTokensMatch(params.leftPocketLabel, params.rightPocketLabel) ||
    proofTargetTokensMatch(params.leftPocketId, params.rightPocketLabel) ||
    proofTargetTokensMatch(params.leftPocketLabel, params.rightPocketId)
  )
}

function buildProofTargetAssertionResult(params: {
  proofTarget?: CurateHardPocketProofTargetAssertionContext
  status: CurateHardPocketProofTargetAssertionResult['status']
  reason: CurateHardPocketProofTargetAssertionReason | null
  selectedDirectionId?: string | null
  selectedPocketId?: string | null
  targetPocketId?: string | null
  targetPocketLabel?: string | null
  selectedProofStop?: BuiltScenarioStop | null
}): CurateHardPocketProofTargetAssertionResult {
  return {
    diagnosticOnly: true,
    status: params.status,
    reason: params.reason,
    proofTargetId: params.proofTarget?.proofTargetId ?? null,
    crossPocketAllowed: params.proofTarget?.crossPocketAllowed === true,
    selectedDirectionId: params.selectedDirectionId ?? null,
    selectedPocketId: params.selectedPocketId ?? null,
    targetPocketId: params.targetPocketId ?? null,
    targetPocketLabel: params.targetPocketLabel ?? null,
    activePocketId: params.proofTarget?.activePocketId ?? null,
    activePocketLabel: params.proofTarget?.activePocketLabel ?? null,
    activePocketCenter: params.proofTarget?.activePocketCenter ?? null,
    activePocketHintRadiusM: params.proofTarget?.activePocketHintRadiusM ?? null,
    activeFieldAdmissionEnvelopeRadiusM:
      params.proofTarget?.activeFieldAdmissionEnvelopeRadiusM ?? null,
    selectedProofStopId: params.selectedProofStop?.venueId ?? null,
    selectedProofStopName: params.selectedProofStop?.name ?? null,
    selectedProofStopPocketId: params.selectedProofStop?.geoBucket ?? null,
    selectedProofStopPocketLabel:
      params.selectedProofStop?.geoLabel ??
      params.selectedProofStop?.district ??
      params.selectedProofStop?.neighborhoodLabel ??
      null,
  }
}

export function evaluateCurateHardPocketProofTargetAssertion(params: {
  opportunity: VerifiedCityOpportunity
  selection: ContractEntryArtifact['selection']
  directionBacking?: ContractEntryArtifact['directionBacking']
  starterPack?: StarterPack | null
  starterSemanticRepresentation?: StarterSemanticRepresentation
  proofTarget?: CurateHardPocketProofTargetAssertionContext
}): CurateHardPocketProofTargetAssertionResult {
  const { proofTarget } = params
  if (!proofTarget || params.starterPack?.id !== 'coffee-books') {
    return buildProofTargetAssertionResult({
      proofTarget,
      status: 'not_applicable',
      reason: null,
      selectedDirectionId: params.selection.directionId ?? params.directionBacking?.directionId,
      selectedPocketId: params.selection.pocketId ?? params.directionBacking?.pocketId,
      targetPocketId: proofTarget?.targetPocketId ?? params.selection.pocketId,
      targetPocketLabel: proofTarget?.targetPocketLabel,
    })
  }

  const selectedDirectionId = params.selection.directionId ?? params.directionBacking?.directionId ?? null
  const selectedPocketId = params.selection.pocketId ?? params.directionBacking?.pocketId ?? null
  const targetPocketId = proofTarget.targetPocketId ?? selectedPocketId
  const targetPocketLabel = proofTarget.targetPocketLabel ?? null
  const representation =
    params.starterSemanticRepresentation ??
    params.opportunity.starterSemanticRepresentation
  const selectedProofStop = findSelectedStopForCoffeeBooksProof({
    opportunity: params.opportunity,
    representation,
  })

  if (!selectedDirectionId?.trim()) {
    return buildProofTargetAssertionResult({
      proofTarget,
      status: 'failed',
      reason: 'proof_target_selected_direction_missing',
      selectedDirectionId,
      selectedPocketId,
      targetPocketId,
      targetPocketLabel,
      selectedProofStop,
    })
  }
  if (!selectedPocketId?.trim() || !targetPocketId?.trim()) {
    return buildProofTargetAssertionResult({
      proofTarget,
      status: 'failed',
      reason: 'proof_target_selected_pocket_missing',
      selectedDirectionId,
      selectedPocketId,
      targetPocketId,
      targetPocketLabel,
      selectedProofStop,
    })
  }
  if (
    proofTarget.activePocketId &&
    !proofTarget.crossPocketAllowed &&
    !proofTargetPocketIdentitiesMatch({
      leftPocketId: proofTarget.activePocketId,
      leftPocketLabel: proofTarget.activePocketLabel,
      rightPocketId: targetPocketId,
      rightPocketLabel: targetPocketLabel,
    })
  ) {
    return buildProofTargetAssertionResult({
      proofTarget,
      status: 'failed',
      reason: 'proof_target_active_pocket_mismatch',
      selectedDirectionId,
      selectedPocketId,
      targetPocketId,
      targetPocketLabel,
      selectedProofStop,
    })
  }
  if (params.directionBacking?.status === 'unbacked' && !proofTarget.crossPocketAllowed) {
    return buildProofTargetAssertionResult({
      proofTarget,
      status: 'failed',
      reason: 'proof_target_cross_pocket_not_allowed',
      selectedDirectionId,
      selectedPocketId,
      targetPocketId,
      targetPocketLabel,
      selectedProofStop,
    })
  }
  if (!selectedProofStop) {
    return buildProofTargetAssertionResult({
      proofTarget,
      status: 'failed',
      reason: 'proof_target_semantic_proof_missing',
      selectedDirectionId,
      selectedPocketId,
      targetPocketId,
      targetPocketLabel,
      selectedProofStop,
    })
  }
  if (
    !selectedProofStopMatchesPocket({
      stop: selectedProofStop,
      targetPocketId,
      targetPocketLabel,
    })
  ) {
    return buildProofTargetAssertionResult({
      proofTarget,
      status: 'failed',
      reason: 'proof_target_selected_stop_outside_pocket',
      selectedDirectionId,
      selectedPocketId,
      targetPocketId,
      targetPocketLabel,
      selectedProofStop,
    })
  }

  return buildProofTargetAssertionResult({
    proofTarget,
    status: 'passed',
    reason: null,
    selectedDirectionId,
    selectedPocketId,
    targetPocketId,
    targetPocketLabel,
    selectedProofStop,
  })
}

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
  proofTarget?: CurateHardPocketProofTargetAssertionContext
}): {
  allowed: boolean
  status: CurateScenarioBuildabilityAdmissionStatus
  reason: CurateScenarioBuildabilityAdmissionReason | null
  failedRoles: Array<Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>>
  seedProjectionAvailable: boolean
  proofTargetAssertion: CurateHardPocketProofTargetAssertionResult
  hardCommitFeasibility: CurateHardCommitFeasibilityDiagnostic
} {
  const { opportunity, artifact, starterPack, proofTarget } = params
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
    const proofTargetAssertion = artifact
      ? evaluateCurateHardPocketProofTargetAssertion({
          opportunity,
          selection: artifact.selection,
          directionBacking: artifact.directionBacking,
          starterPack,
          starterSemanticRepresentation:
            artifact.enrichment?.starterSemanticRepresentation ??
            opportunity.starterSemanticRepresentation,
          proofTarget,
        })
      : buildProofTargetAssertionResult({
          proofTarget,
          status: proofTarget ? 'failed' : 'not_applicable',
          reason: proofTarget ? 'proof_target_selected_direction_missing' : null,
          selectedDirectionId: opportunity.selection.directionId,
          selectedPocketId: opportunity.selection.pocketId,
          targetPocketId: proofTarget?.targetPocketId ?? opportunity.selection.pocketId,
          targetPocketLabel: proofTarget?.targetPocketLabel,
        })
    return {
      allowed: false,
      status: 'rejected',
      reason: 'scenario_route_mixed_di_fallback_scattered',
      failedRoles: [],
      seedProjectionAvailable: false,
      proofTargetAssertion,
      hardCommitFeasibility: buildFeasibility({
        status: 'failed',
        failureClass: 'planner_inventory_mismatch',
      }),
    }
  }
  if (!artifact || !opportunity.scenarioNight) {
    const proofTargetAssertion = buildProofTargetAssertionResult({
      proofTarget,
      status: proofTarget ? 'failed' : 'not_applicable',
      reason: proofTarget ? 'proof_target_selected_direction_missing' : null,
      selectedDirectionId: opportunity.selection.directionId,
      selectedPocketId: opportunity.selection.pocketId,
      targetPocketId: proofTarget?.targetPocketId ?? opportunity.selection.pocketId,
      targetPocketLabel: proofTarget?.targetPocketLabel,
    })
    return {
      allowed: false,
      status: 'rejected',
      reason: 'scenario_route_seed_projection_missing',
      failedRoles: ['start', 'highlight', 'windDown'],
      seedProjectionAvailable: false,
      proofTargetAssertion,
      hardCommitFeasibility: buildFeasibility({
        status: 'failed',
        failureClass: 'missing_seed_identity',
      }),
    }
  }

  const proofTargetAssertion = evaluateCurateHardPocketProofTargetAssertion({
    opportunity,
    selection: artifact.selection,
    directionBacking: artifact.directionBacking,
    starterPack,
    starterSemanticRepresentation:
      artifact.enrichment?.starterSemanticRepresentation ??
      opportunity.starterSemanticRepresentation,
    proofTarget,
  })
  if (proofTargetAssertion.status === 'failed') {
    return {
      allowed: false,
      status: 'rejected',
      reason: proofTargetAssertion.reason,
      failedRoles: ['highlight'],
      seedProjectionAvailable: Boolean(artifact),
      proofTargetAssertion,
      hardCommitFeasibility: buildFeasibility({
        status: 'failed',
        failureClass: 'proof_target_assertion_failed',
        failedRole: 'highlight',
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
      proofTargetAssertion,
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
      proofTargetAssertion,
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
    proofTargetAssertion,
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
  proofTarget?: CurateHardPocketProofTargetAssertionContext
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
      proofTarget: params.proofTarget,
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
      proofTargetAssertion: admission.proofTargetAssertion,
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
  proofTarget?: CurateHardPocketProofTargetAssertionContext
}): CurateScenarioBackedArtifactBridgeResult {
  const primary = buildArtifactsForPool({
    opportunities: params.primaryOpportunities,
    sourcePool: 'primary',
    ecsState: params.ecsState,
    directionCards: params.directionCards,
    allDirectionCards: params.allDirectionCards,
    starterPack: params.starterPack,
    proofTarget: params.proofTarget,
  })
  const fallback = buildArtifactsForPool({
    opportunities: params.fallbackOpportunities,
    sourcePool: 'fallback',
    ecsState: params.ecsState,
    directionCards: params.directionCards,
    allDirectionCards: params.allDirectionCards,
    starterPack: params.starterPack,
    proofTarget: params.proofTarget,
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
