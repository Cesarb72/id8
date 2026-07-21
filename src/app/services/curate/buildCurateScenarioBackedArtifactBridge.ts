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
import type { StopTypeCandidateBoard } from '../../../domain/interpretation/discovery/stopTypeCandidateBoard'
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
  | 'anchor_centered_support_selection_failed'
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
  proofPolicy?: 'curate_hard_pocket' | 'surprise_hard_pocket' | 'build_required_anchor_soft_geography'
  proofMode?: 'curate_or_surprise' | 'build_required_anchor'
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

type CurateBuildAnchorSupportRole = Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>
type CurateBuildAnchorSupportSelectionStatus = 'not_applicable' | 'passed' | 'failed'
type CurateBuildAnchorSupportSelectionSource =
  | 'scenario_stop'
  | 'live_supply'
  | 'admitted_candidate'
  | 'admitted_candidate_board'
  | 'static_fallback'
  | 'none'
type CurateBuildAnchorSupportSelectionReason =
  | 'build_required_anchor_support_reselected'
  | 'stale_support_stop_outside_anchor_pocket'
  | 'support_stop_replaced_for_route_compactness'
  | 'anchor_centered_support_selection_applied'
  | 'anchor_centered_support_selection_failed'
  | 'support_stop_kept_anchor_centered'
  | 'support_stop_preserved_required_anchor'
  | 'build_required_anchor_support_selection_not_applicable'
  | 'admitted_support_candidate_used'
  | 'scenario_support_role_missing'
  | 'admitted_winddown_candidate_selected'
  | 'admitted_winddown_candidate_rejected_role_contract'
  | 'admitted_winddown_candidate_rejected_anchor_pocket'
  | 'build_required_anchor_support_from_admitted_supply'
  | 'build_required_anchor_no_admitted_winddown_support_candidate'

type CurateBuildAnchorSupportCandidateRejectedReason =
  | 'anchor_pocket_mismatch'
  | 'role_semantics_failed'
  | 'role_contract_failed'
  | 'blocked_venue'
  | 'used_id_conflict'
  | 'not_admitted'
  | 'missing_venue_id'

export interface CurateBuildAdmittedSupportCandidate {
  venueId: string
  name: string
  address?: string
  district?: string
  neighborhoodLabel?: string
  coordinates?: { lat: number; lng: number }
  providerPlaceId?: string
  sourceLabel?: string
  geoBucket?: BuiltScenarioStop['geoBucket']
  geoBucketSource?: BuiltScenarioStop['geoBucketSource']
  geoLabel?: BuiltScenarioStop['geoLabel']
  geoAssignmentMethod?: BuiltScenarioStop['geoAssignmentMethod']
  venueCategory?: BuiltScenarioStop['venueCategory']
  venueSubcategory?: string
  sourceType?: BuiltScenarioStop['sourceType']
  sourceTypes?: string[]
  venueTags?: string[]
  authorityScore?: number
  currentRelevance?: number
  roleFit?: BuiltScenarioStop['roleFit']
  score?: number
  boardRank?: number
  admitted?: boolean
  blockedReason?: string | null
  enteredStopTypePool?: boolean
  enteredAnyScenarioNight?: boolean
}

interface CurateBuildAnchorSupportCandidateDiagnostic {
  role: CurateBuildAnchorSupportRole
  venueId: string | null
  name: string | null
  pocketId: string | null
  pocketLabel: string | null
  source: CurateBuildAnchorSupportSelectionSource
  sourceLabel: string | null
  roleFit: BuiltScenarioStop['roleFit'] | null
  admitted: boolean | null
  blockedReason: string | null
  usedIdConflict: boolean
  enteredStopTypePool: boolean | null
  enteredAnyScenarioNight: boolean | null
  anchorPocketMatch: boolean
  roleSemanticsPassed: boolean
  roleContractPassed: boolean
  selected: boolean
  rejectedReason: CurateBuildAnchorSupportCandidateRejectedReason | null
}

interface CurateBuildAnchorSupportStopDiagnostic {
  role: CurateBuildAnchorSupportRole
  originalStopId: string | null
  originalStopName: string | null
  originalPocketId: string | null
  originalPocketLabel: string | null
  replacementStopId: string | null
  replacementStopName: string | null
  replacementPocketId: string | null
  replacementPocketLabel: string | null
  kept: boolean
  replaced: boolean
  selectedSupportSource: CurateBuildAnchorSupportSelectionSource
  reason: CurateBuildAnchorSupportSelectionReason
}

export interface CurateBuildAnchorSupportSelectionDiagnostic {
  diagnosticOnly: true
  status: CurateBuildAnchorSupportSelectionStatus
  reason: CurateBuildAnchorSupportSelectionReason | null
  proofPolicy: CurateHardPocketProofTargetAssertionContext['proofPolicy'] | null
  proofMode: CurateHardPocketProofTargetAssertionContext['proofMode'] | null
  requiredAnchorId: string | null
  requiredAnchorName: string | null
  requiredAnchorPocketId: string | null
  requiredAnchorPocketLabel: string | null
  originalSupportStops: CurateBuildAnchorSupportStopDiagnostic[]
  replacementSupportStops: CurateBuildAnchorSupportStopDiagnostic[]
  scenarioSupportCandidateCountByRole: Record<CurateBuildAnchorSupportRole, number>
  admittedCandidateBoardCountByRole: Record<CurateBuildAnchorSupportRole, number>
  admittedFallbackCandidateCountByRole: Record<CurateBuildAnchorSupportRole, number>
  supportSelectionUsedCandidateBoardFallback: boolean
  supportSelectionSourceByRole: Record<CurateBuildAnchorSupportRole, CurateBuildAnchorSupportSelectionSource>
  windDownCandidateDiagnostics: CurateBuildAnchorSupportCandidateDiagnostic[]
  chosenWindDownCandidate: {
    venueId: string
    name: string
    pocketId: string | null
    pocketLabel: string | null
    source: CurateBuildAnchorSupportSelectionSource
  } | null
  availableCompactAlternativesConsidered: Array<{
    role: CurateBuildAnchorSupportRole
    venueId: string
    name: string
    pocketId: string | null
    pocketLabel: string | null
    source: CurateBuildAnchorSupportSelectionSource
  }>
  movementTotalBefore: number | null
  movementTotalAfter: number | null
  maxTransitionBefore: number | null
  maxTransitionAfter: number | null
  neighborhoodsBefore: string[]
  neighborhoodsAfter: string[]
  anchorCentered: boolean
  routeShapePreserved: boolean
  greatStopInputUsesReplacedSupports: boolean
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
  buildRequiredAnchorSupportSelection: CurateBuildAnchorSupportSelectionDiagnostic
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

function buildDefaultBuildAnchorSupportSelectionDiagnostic(
  overrides: Partial<CurateBuildAnchorSupportSelectionDiagnostic> = {},
): CurateBuildAnchorSupportSelectionDiagnostic {
  return {
    diagnosticOnly: true,
    status: 'not_applicable',
    reason: 'build_required_anchor_support_selection_not_applicable',
    proofPolicy: null,
    proofMode: null,
    requiredAnchorId: null,
    requiredAnchorName: null,
    requiredAnchorPocketId: null,
    requiredAnchorPocketLabel: null,
    originalSupportStops: [],
    replacementSupportStops: [],
    scenarioSupportCandidateCountByRole: { start: 0, highlight: 0, windDown: 0 },
    admittedCandidateBoardCountByRole: { start: 0, highlight: 0, windDown: 0 },
    admittedFallbackCandidateCountByRole: { start: 0, highlight: 0, windDown: 0 },
    supportSelectionUsedCandidateBoardFallback: false,
    supportSelectionSourceByRole: { start: 'none', highlight: 'none', windDown: 'none' },
    windDownCandidateDiagnostics: [],
    chosenWindDownCandidate: null,
    availableCompactAlternativesConsidered: [],
    movementTotalBefore: null,
    movementTotalAfter: null,
    maxTransitionBefore: null,
    maxTransitionAfter: null,
    neighborhoodsBefore: [],
    neighborhoodsAfter: [],
    anchorCentered: false,
    routeShapePreserved: false,
    greatStopInputUsesReplacedSupports: false,
    ...overrides,
  }
}

function buildSupportStopDiagnostic(params: {
  role: CurateBuildAnchorSupportRole
  originalStop?: BuiltScenarioStop | null
  replacementStop?: BuiltScenarioStop | null
  kept: boolean
  replaced: boolean
  selectedSupportSource: CurateBuildAnchorSupportSelectionSource
  reason: CurateBuildAnchorSupportSelectionReason
}): CurateBuildAnchorSupportStopDiagnostic {
  return {
    role: params.role,
    originalStopId: params.originalStop?.venueId ?? null,
    originalStopName: params.originalStop?.name ?? null,
    originalPocketId: params.originalStop?.geoBucket ?? null,
    originalPocketLabel:
      params.originalStop?.geoLabel ??
      params.originalStop?.district ??
      params.originalStop?.neighborhoodLabel ??
      null,
    replacementStopId: params.replacementStop?.venueId ?? null,
    replacementStopName: params.replacementStop?.name ?? null,
    replacementPocketId: params.replacementStop?.geoBucket ?? null,
    replacementPocketLabel:
      params.replacementStop?.geoLabel ??
      params.replacementStop?.district ??
      params.replacementStop?.neighborhoodLabel ??
      null,
    kept: params.kept,
    replaced: params.replaced,
    selectedSupportSource: params.selectedSupportSource,
    reason: params.reason,
  }
}

function roleForScenarioPosition(
  position: BuiltScenarioStop['position'] | undefined,
): CurateBuildAnchorSupportRole | null {
  if (position === 'start' || position === 'mid') {
    return 'start'
  }
  if (position === 'highlight') {
    return 'highlight'
  }
  if (position === 'windDown' || position === 'closer') {
    return 'windDown'
  }
  return null
}

function findScenarioCoreStopByRole(params: {
  opportunity: VerifiedCityOpportunity
  role: CurateBuildAnchorSupportRole
}): BuiltScenarioStop | undefined {
  const stops = params.opportunity.scenarioNight?.stops ?? []
  if (params.role === 'start') {
    return (
      findScenarioStopByName(params.opportunity, params.opportunity.storySpine.start) ??
      stops.find((stop) => stop.position === 'start') ??
      stops[0]
    )
  }
  if (params.role === 'highlight') {
    return (
      findScenarioStopByName(params.opportunity, params.opportunity.storySpine.highlight) ??
      stops.find((stop) => stop.position === 'highlight') ??
      findScenarioStopByVenueId(params.opportunity, params.opportunity.anchor.venueId)
    )
  }
  const finalVenueId = params.opportunity.scenarioWindDownDebug?.finalVenueId ?? undefined
  const finalName = params.opportunity.scenarioWindDownDebug?.finalName ?? undefined
  return (
    findScenarioStopByVenueId(params.opportunity, finalVenueId) ??
    findScenarioStopByName(params.opportunity, finalName) ??
    findScenarioStopByName(params.opportunity, params.opportunity.storySpine.windDown) ??
    stops.find((stop) => stop.position === 'closer') ??
    stops.find((stop) => stop.position === 'windDown') ??
    stops[stops.length - 1]
  )
}

function scenarioStopMatchesRole(
  stop: BuiltScenarioStop,
  role: CurateBuildAnchorSupportRole,
): boolean {
  return roleForScenarioPosition(stop.position) === role
}

function scenarioStopPassesSupportRoleSemantics(params: {
  stop: BuiltScenarioStop
  role: CurateBuildAnchorSupportRole
}): boolean {
  const roleFit =
    params.role === 'start'
      ? params.stop.roleFit.start
      : params.role === 'highlight'
        ? params.stop.roleFit.highlight
        : params.stop.roleFit.windDown
  const minimumFit = params.role === 'highlight' ? 0.5 : params.role === 'windDown' ? 0.42 : 0.36
  return typeof roleFit === 'number' ? roleFit >= minimumFit : true
}

function scenarioStopMatchesProofTargetPocket(params: {
  stop: BuiltScenarioStop
  proofTarget: CurateHardPocketProofTargetAssertionContext
}): boolean {
  const targetPocketId = params.proofTarget.targetPocketId?.trim()
  const targetPocketLabel = params.proofTarget.targetPocketLabel?.trim()
  if (!targetPocketId && !targetPocketLabel) {
    return false
  }
  return selectedProofStopMatchesPocket({
    stop: params.stop,
    targetPocketId: targetPocketId || targetPocketLabel || '',
    targetPocketLabel,
  })
}

function estimateTransitionMinutes(
  left: BuiltScenarioStop | undefined,
  right: BuiltScenarioStop | undefined,
): number {
  if (!left || !right) {
    return 0
  }
  if (left.coordinates && right.coordinates) {
    const dx = left.coordinates.lat - right.coordinates.lat
    const dy = left.coordinates.lng - right.coordinates.lng
    const approximateMeters = Math.sqrt(dx * dx + dy * dy) * 111_000
    return Math.max(4, Math.ceil(approximateMeters / 80))
  }
  if (
    left.geoBucket &&
    right.geoBucket &&
    normalizeProofTargetToken(left.geoBucket) === normalizeProofTargetToken(right.geoBucket)
  ) {
    return 8
  }
  const leftLabel = left.geoLabel ?? left.district ?? left.neighborhoodLabel
  const rightLabel = right.geoLabel ?? right.district ?? right.neighborhoodLabel
  if (proofTargetTokensMatch(leftLabel, rightLabel)) {
    return 10
  }
  return 16
}

function summarizeScenarioRouteMovement(
  routeStops: Array<BuiltScenarioStop | undefined>,
): {
  total: number | null
  max: number | null
  neighborhoods: string[]
} {
  const stops = routeStops.filter((stop): stop is BuiltScenarioStop => Boolean(stop))
  if (stops.length < 2) {
    return {
      total: null,
      max: null,
      neighborhoods: stops
        .map((stop) => stop.geoLabel ?? stop.district ?? stop.neighborhoodLabel)
        .filter((value): value is string => Boolean(value?.trim())),
    }
  }
  const transitions = stops.slice(1).map((stop, index) =>
    estimateTransitionMinutes(stops[index], stop),
  )
  return {
    total: transitions.reduce((sum, value) => sum + value, 0),
    max: Math.max(...transitions),
    neighborhoods: Array.from(
      new Set(
        stops
          .map((stop) => stop.geoLabel ?? stop.district ?? stop.neighborhoodLabel)
          .filter((value): value is string => Boolean(value?.trim())),
      ),
    ),
  }
}

function cloneStopForRole(
  stop: BuiltScenarioStop,
  role: CurateBuildAnchorSupportRole,
): BuiltScenarioStop {
  return {
    ...stop,
    position: role === 'windDown' ? 'windDown' : role,
  }
}

export function collectBuildAdmittedSupportCandidatesFromCandidateBoard(
  board: StopTypeCandidateBoard | null | undefined,
): CurateBuildAdmittedSupportCandidate[] {
  const candidateDiagnostics = board?.debug?.candidateDiagnosticsByStopType
  if (!candidateDiagnostics) {
    return []
  }
  const districtDiagnosticByVenueId = new Map(
    (board?.debug?.districtIntelligence?.liveCandidateDiagnostics ?? []).map((entry) => [
      entry.candidateId,
      entry,
    ]),
  )
  const byVenueId = new Map<string, CurateBuildAdmittedSupportCandidate>()
  Object.values(candidateDiagnostics).forEach((entry) => {
    entry?.topCandidates.forEach((candidate) => {
      const venueId = candidate.venueId.trim()
      if (!venueId) {
        return
      }
      const districtDiagnostic =
        candidate.districtIntelligenceDiagnostic ?? districtDiagnosticByVenueId.get(venueId)
      const admitted = districtDiagnostic?.admissionStatus === 'admitted'
      const candidateBoardEntry: CurateBuildAdmittedSupportCandidate = {
        venueId,
        name: candidate.name,
        address: candidate.address,
        district: candidate.district,
        neighborhoodLabel: candidate.neighborhoodLabel,
        coordinates: candidate.coordinates,
        providerPlaceId: candidate.providerPlaceId,
        sourceLabel: candidate.sourceLabel,
        geoBucket: candidate.geoBucket,
        geoBucketSource: candidate.geoBucketSource,
        geoLabel: candidate.geoLabel,
        geoAssignmentMethod: candidate.geoAssignmentMethod,
        venueCategory: candidate.venueCategory,
        venueSubcategory: candidate.venueSubcategory,
        sourceType: candidate.sourceType,
        sourceTypes: candidate.sourceTypes,
        authorityScore: candidate.score,
        currentRelevance: candidate.score,
        roleFit: candidate.roleFit,
        score: candidate.score,
        boardRank: candidate.boardRank,
        admitted,
        blockedReason:
          districtDiagnostic?.admissionBlockedReason ??
          districtDiagnostic?.assignmentBlockedReason ??
          null,
        enteredStopTypePool: candidate.enteredStopTypePool,
        enteredAnyScenarioNight: false,
      }
      const existing = byVenueId.get(venueId)
      const existingScore = existing?.score ?? 0
      const nextScore = candidateBoardEntry.score ?? 0
      const existingRank = existing?.boardRank ?? Number.POSITIVE_INFINITY
      const nextRank = candidateBoardEntry.boardRank ?? Number.POSITIVE_INFINITY
      if (!existing || nextScore > existingScore || (nextScore === existingScore && nextRank < existingRank)) {
        byVenueId.set(venueId, candidateBoardEntry)
      }
    })
  })
  return [...byVenueId.values()].sort(
    (left, right) =>
      (right.score ?? 0) - (left.score ?? 0) ||
      (left.boardRank ?? Number.POSITIVE_INFINITY) - (right.boardRank ?? Number.POSITIVE_INFINITY) ||
      left.name.localeCompare(right.name) ||
      left.venueId.localeCompare(right.venueId),
  )
}

function getBuildAnchorSupportSelectionSource(params: {
  opportunity: VerifiedCityOpportunity
  opportunityIndex: number
  stage: 'scenario' | 'admitted_candidate_board'
}): CurateBuildAnchorSupportSelectionSource {
  if (params.stage === 'scenario') {
    return 'scenario_stop'
  }
  void params.opportunity
  void params.opportunityIndex
  return 'admitted_candidate_board'
}

function buildSupportCandidateDiagnostic(params: {
  role: CurateBuildAnchorSupportRole
  stop: BuiltScenarioStop | null
  source: CurateBuildAnchorSupportSelectionSource
  sourceLabel?: string | null
  roleFit?: BuiltScenarioStop['roleFit'] | null
  admitted?: boolean | null
  blockedReason?: string | null
  usedIdConflict?: boolean
  enteredStopTypePool?: boolean | null
  enteredAnyScenarioNight?: boolean | null
  anchorPocketMatch: boolean
  roleSemanticsPassed: boolean
  roleContractPassed: boolean
  selected?: boolean
  rejectedReason?: CurateBuildAnchorSupportCandidateRejectedReason | null
}): CurateBuildAnchorSupportCandidateDiagnostic {
  return {
    role: params.role,
    venueId: params.stop?.venueId ?? null,
    name: params.stop?.name ?? null,
    pocketId: params.stop?.geoBucket ?? null,
    pocketLabel:
      params.stop?.geoLabel ?? params.stop?.district ?? params.stop?.neighborhoodLabel ?? null,
    source: params.source,
    sourceLabel: params.sourceLabel ?? params.stop?.sourceLabel ?? null,
    roleFit: params.roleFit ?? params.stop?.roleFit ?? null,
    admitted: params.admitted ?? null,
    blockedReason: params.blockedReason ?? null,
    usedIdConflict: params.usedIdConflict === true,
    enteredStopTypePool: params.enteredStopTypePool ?? null,
    enteredAnyScenarioNight: params.enteredAnyScenarioNight ?? null,
    anchorPocketMatch: params.anchorPocketMatch,
    roleSemanticsPassed: params.roleSemanticsPassed,
    roleContractPassed: params.roleContractPassed,
    selected: params.selected === true,
    rejectedReason: params.rejectedReason ?? null,
  }
}

function collectBuildAnchorSupportCandidates(params: {
  opportunities: VerifiedCityOpportunity[]
  admittedSupportCandidates?: readonly CurateBuildAdmittedSupportCandidate[]
  role: CurateBuildAnchorSupportRole
  proofTarget: CurateHardPocketProofTargetAssertionContext
  blockedVenueIds: Set<string>
  starterPack: StarterPack
  allowAdmittedFallback: boolean
}): {
  candidates: Array<{
    stop: BuiltScenarioStop
    source: CurateBuildAnchorSupportSelectionSource
    score: number
    sourceStage: 'scenario' | 'admitted_candidate_board'
  }>
  diagnostics: CurateBuildAnchorSupportCandidateDiagnostic[]
  scenarioCandidateCount: number
  admittedCandidateBoardCount: number
  admittedFallbackCandidateCount: number
} {
  const scenarioVenueIds = new Set(
    params.opportunities.flatMap((opportunity) =>
      (opportunity.scenarioNight?.stops ?? []).map((stop) => stop.venueId).filter(Boolean),
    ),
  )

  function toAdmittedCandidateStop(candidate: CurateBuildAdmittedSupportCandidate): BuiltScenarioStop {
    const score = candidate.score ?? candidate.authorityScore ?? candidate.currentRelevance ?? 0.72
    return {
      position: params.role === 'windDown' ? 'windDown' : params.role,
      stopType:
        params.role === 'windDown'
          ? 'atmospheric_nightcap'
          : params.role === 'highlight'
            ? 'thoughtful_wine_or_lunch'
            : 'cultural_institution',
      venueId: candidate.venueId,
      name: candidate.name,
      address: candidate.address,
      district: candidate.district ?? candidate.geoLabel,
      neighborhoodLabel: candidate.neighborhoodLabel ?? candidate.geoLabel,
      coordinates: candidate.coordinates,
      providerPlaceId: candidate.providerPlaceId,
      sourceLabel: candidate.sourceLabel,
      geoBucket: candidate.geoBucket,
      geoBucketSource: candidate.geoBucketSource,
      geoLabel: candidate.geoLabel ?? candidate.district ?? candidate.neighborhoodLabel,
      geoAssignmentMethod: candidate.geoAssignmentMethod,
      sourceType: candidate.sourceType,
      authorityScore: candidate.authorityScore ?? score,
      currentRelevance: candidate.currentRelevance ?? score,
      reasons: [`${candidate.name} is admitted candidate-board support for the Build route.`],
      momentLabel: candidate.name,
      whyThisStop: `${candidate.name} keeps the Build route centered near the required anchor.`,
      venueCategory: candidate.venueCategory,
      venueSubcategory: candidate.venueSubcategory,
      venueTags: candidate.venueTags ?? [],
      sourceTypes: candidate.sourceTypes ?? [],
      roleFit: {
        start: candidate.roleFit?.start,
        highlight: candidate.roleFit?.highlight,
        windDown: candidate.roleFit?.windDown,
      },
    }
  }

  function collectScenarioCandidates(): {
    candidates: Array<{
      stop: BuiltScenarioStop
      source: CurateBuildAnchorSupportSelectionSource
      score: number
      sourceStage: 'scenario' | 'admitted_candidate_board'
    }>
    diagnostics: CurateBuildAnchorSupportCandidateDiagnostic[]
  } {
  const byVenueId = new Map<string, {
    stop: BuiltScenarioStop
    source: CurateBuildAnchorSupportSelectionSource
    score: number
    sourceStage: 'scenario' | 'admitted_candidate_board'
  }>()
  const diagnostics: CurateBuildAnchorSupportCandidateDiagnostic[] = []
  params.opportunities.forEach((opportunity, opportunityIndex) => {
    for (const stop of opportunity.scenarioNight?.stops ?? []) {
      const source = getBuildAnchorSupportSelectionSource({ opportunity, opportunityIndex, stage: 'scenario' })
      const venueIdPresent = Boolean(stop.venueId.trim())
      const usedIdConflict = venueIdPresent && params.blockedVenueIds.has(stop.venueId)
      const roleMatched = scenarioStopMatchesRole(stop, params.role)
      const anchorPocketMatch = scenarioStopMatchesProofTargetPocket({
        stop,
        proofTarget: params.proofTarget,
      })
      const roleSemanticsPassed =
        roleMatched && scenarioStopPassesSupportRoleSemantics({ stop, role: params.role })
      const roleContractPassed =
        roleMatched &&
        scenarioStopSatisfiesRoleContract({
          starterPack: params.starterPack,
          stop,
          role: params.role,
        })
      const rejectedReason: CurateBuildAnchorSupportCandidateRejectedReason | null = !venueIdPresent
        ? 'missing_venue_id'
        : usedIdConflict
          ? 'used_id_conflict'
          : !anchorPocketMatch
            ? 'anchor_pocket_mismatch'
            : !roleSemanticsPassed
              ? 'role_semantics_failed'
              : !roleContractPassed
                ? 'role_contract_failed'
                : null
      if (params.role === 'windDown') {
        diagnostics.push(
          buildSupportCandidateDiagnostic({
            role: params.role,
            stop,
            source,
            sourceLabel: stop.sourceLabel ?? null,
            roleFit: stop.roleFit,
            admitted: null,
            blockedReason: null,
            usedIdConflict,
            enteredStopTypePool: true,
            enteredAnyScenarioNight: true,
            anchorPocketMatch,
            roleSemanticsPassed,
            roleContractPassed,
            rejectedReason,
          }),
        )
      }
      if (
        !venueIdPresent ||
        usedIdConflict ||
        !roleMatched ||
        !anchorPocketMatch ||
        !roleSemanticsPassed ||
        !roleContractPassed
      ) {
        continue
      }
      const roleFit =
        params.role === 'start'
          ? stop.roleFit.start
          : params.role === 'highlight'
            ? stop.roleFit.highlight
            : stop.roleFit.windDown
      const score =
        (roleFit ?? 0) * 0.52 +
        stop.authorityScore * 0.24 +
        stop.currentRelevance * 0.18 +
        (source === 'live_supply' ? 0.05 : source === 'scenario_stop' ? 0.02 : 0)
      const existing = byVenueId.get(stop.venueId)
      if (!existing || score > existing.score) {
        byVenueId.set(stop.venueId, {
          stop,
          source,
          score,
          sourceStage: 'scenario',
        })
      }
    }
  })
  return {
    candidates: [...byVenueId.values()].sort(
    (left, right) =>
      right.score - left.score ||
      left.stop.name.localeCompare(right.stop.name) ||
      left.stop.venueId.localeCompare(right.stop.venueId),
    ),
    diagnostics,
  }
  }

  function collectAdmittedCandidateBoardCandidates(): {
    candidates: Array<{
      stop: BuiltScenarioStop
      source: CurateBuildAnchorSupportSelectionSource
      score: number
      sourceStage: 'scenario' | 'admitted_candidate_board'
    }>
    diagnostics: CurateBuildAnchorSupportCandidateDiagnostic[]
    candidateBoardCount: number
  } {
    const source = getBuildAnchorSupportSelectionSource({
      opportunity: params.opportunities[0],
      opportunityIndex: 0,
      stage: 'admitted_candidate_board',
    })
    const byVenueId = new Map<string, {
      stop: BuiltScenarioStop
      source: CurateBuildAnchorSupportSelectionSource
      score: number
      sourceStage: 'scenario' | 'admitted_candidate_board'
    }>()
    const diagnostics: CurateBuildAnchorSupportCandidateDiagnostic[] = []
    const candidates = params.admittedSupportCandidates ?? []
    candidates.forEach((candidate) => {
      const stop = toAdmittedCandidateStop(candidate)
      const venueIdPresent = Boolean(stop.venueId.trim())
      const admitted = candidate.admitted === true
      const usedIdConflict = venueIdPresent && params.blockedVenueIds.has(stop.venueId)
      const anchorPocketMatch = scenarioStopMatchesProofTargetPocket({
        stop,
        proofTarget: params.proofTarget,
      })
      const roleSemanticsPassed = scenarioStopPassesSupportRoleSemantics({
        stop,
        role: params.role,
      })
      const roleContractPassed = scenarioStopSatisfiesRoleContract({
        starterPack: params.starterPack,
        stop,
        role: params.role,
      })
      const rejectedReason: CurateBuildAnchorSupportCandidateRejectedReason | null = !venueIdPresent
        ? 'missing_venue_id'
        : !admitted
          ? 'not_admitted'
          : usedIdConflict
            ? 'used_id_conflict'
            : !anchorPocketMatch
              ? 'anchor_pocket_mismatch'
              : !roleSemanticsPassed
                ? 'role_semantics_failed'
                : !roleContractPassed
                  ? 'role_contract_failed'
                  : null
      if (params.role === 'windDown') {
        diagnostics.push(
          buildSupportCandidateDiagnostic({
            role: params.role,
            stop,
            source,
            sourceLabel: candidate.sourceLabel ?? null,
            roleFit: stop.roleFit,
            admitted,
            blockedReason: candidate.blockedReason ?? null,
            usedIdConflict,
            enteredStopTypePool: candidate.enteredStopTypePool ?? null,
            enteredAnyScenarioNight:
              candidate.enteredAnyScenarioNight ?? scenarioVenueIds.has(candidate.venueId),
            anchorPocketMatch,
            roleSemanticsPassed,
            roleContractPassed,
            rejectedReason,
          }),
        )
      }
      if (
        !venueIdPresent ||
        !admitted ||
        usedIdConflict ||
        !anchorPocketMatch ||
        !roleSemanticsPassed ||
        !roleContractPassed
      ) {
        return
      }
      const roleFit =
        params.role === 'start'
          ? stop.roleFit.start
          : params.role === 'highlight'
            ? stop.roleFit.highlight
            : stop.roleFit.windDown
      const score =
        (roleFit ?? 0) * 0.52 +
        stop.authorityScore * 0.24 +
        stop.currentRelevance * 0.18 +
        0.03
      const existing = byVenueId.get(stop.venueId)
      if (!existing || score > existing.score) {
        byVenueId.set(stop.venueId, {
          stop,
          source,
          score,
          sourceStage: 'admitted_candidate_board',
        })
      }
    })
    return {
      candidates: [...byVenueId.values()].sort(
        (left, right) =>
          right.score - left.score ||
          left.stop.name.localeCompare(right.stop.name) ||
          left.stop.venueId.localeCompare(right.stop.venueId),
      ),
      diagnostics,
      candidateBoardCount: candidates.length,
    }
  }

  const scenario = collectScenarioCandidates()
  const admitted =
    scenario.candidates.length === 0 && params.allowAdmittedFallback
      ? collectAdmittedCandidateBoardCandidates()
      : { candidates: [], diagnostics: [], candidateBoardCount: 0 }
  const selectedStage = scenario.candidates.length > 0 ? scenario : admitted
  const diagnostics = [...scenario.diagnostics, ...admitted.diagnostics]
  return {
    candidates: selectedStage.candidates,
    diagnostics,
    scenarioCandidateCount: scenario.candidates.length,
    admittedCandidateBoardCount: admitted.candidateBoardCount,
    admittedFallbackCandidateCount: admitted.candidates.length,
  }
}

function replaceScenarioCoreStop(params: {
  opportunity: VerifiedCityOpportunity
  replacements: Partial<Record<CurateBuildAnchorSupportRole, BuiltScenarioStop>>
}): VerifiedCityOpportunity {
  const scenarioNight = params.opportunity.scenarioNight
  if (!scenarioNight) {
    return params.opportunity
  }
  const originalStart = findScenarioCoreStopByRole({ opportunity: params.opportunity, role: 'start' })
  const originalHighlight = findScenarioCoreStopByRole({
    opportunity: params.opportunity,
    role: 'highlight',
  })
  const originalWindDown = findScenarioCoreStopByRole({
    opportunity: params.opportunity,
    role: 'windDown',
  })
  const start = params.replacements.start ?? originalStart
  const highlight = params.replacements.highlight ?? originalHighlight
  const windDown = params.replacements.windDown ?? originalWindDown
  const replacementByOriginalVenueId = new Map<string, BuiltScenarioStop>()
  if (params.replacements.start && originalStart?.venueId) {
    replacementByOriginalVenueId.set(originalStart.venueId, cloneStopForRole(params.replacements.start, 'start'))
  }
  if (params.replacements.highlight && originalHighlight?.venueId) {
    replacementByOriginalVenueId.set(
      originalHighlight.venueId,
      cloneStopForRole(params.replacements.highlight, 'highlight'),
    )
  }
  if (params.replacements.windDown && originalWindDown?.venueId) {
    replacementByOriginalVenueId.set(
      originalWindDown.venueId,
      cloneStopForRole(params.replacements.windDown, 'windDown'),
    )
  }
  const replacementVenueIds = new Set(
    Object.values(params.replacements)
      .map((stop) => stop?.venueId)
      .filter((value): value is string => Boolean(value)),
  )
  const replacedScenarioStops = scenarioNight.stops
    .map((stop) => replacementByOriginalVenueId.get(stop.venueId) ?? stop)
    .filter((stop, index, list) => {
      if (!replacementVenueIds.has(stop.venueId)) {
        return true
      }
      return list.findIndex((entry) => entry.venueId === stop.venueId) === index
    })
  return {
    ...params.opportunity,
    starts: start
      ? [{
          venueId: start.venueId,
          name: start.name,
          address: start.address,
          reason: start.whyThisStop || start.reasons[0] || 'Anchor-centered start support.',
          score: start.roleFit.start ?? start.authorityScore,
        }]
      : params.opportunity.starts,
    closes: windDown
      ? [{
          venueId: windDown.venueId,
          name: windDown.name,
          address: windDown.address,
          reason:
            windDown.whyThisStop ||
            windDown.reasons[0] ||
            'Anchor-centered wind-down support.',
          score: windDown.roleFit.windDown ?? windDown.authorityScore,
        }]
      : params.opportunity.closes,
    storySpine: {
      start: start?.name ?? params.opportunity.storySpine.start,
      highlight: highlight?.name ?? params.opportunity.storySpine.highlight,
      windDown: windDown?.name ?? params.opportunity.storySpine.windDown,
    },
    districtContext: {
      ...params.opportunity.districtContext,
      primaryDistrict:
        highlight?.geoLabel ??
        highlight?.district ??
        highlight?.neighborhoodLabel ??
        params.opportunity.districtContext.primaryDistrict,
    },
    excellence: {
      ...params.opportunity.excellence,
      startQuality: start?.roleFit.start ?? params.opportunity.excellence.startQuality,
      windDownQuality:
        windDown?.roleFit.windDown ?? params.opportunity.excellence.windDownQuality,
      supportCoherence: Math.max(params.opportunity.excellence.supportCoherence, 0.82),
    },
    scenarioWindDownDebug: windDown
      ? {
          originalVenueId:
            params.opportunity.scenarioWindDownDebug?.originalVenueId ??
            originalWindDown?.venueId ??
            null,
          originalName:
            params.opportunity.scenarioWindDownDebug?.originalName ??
            originalWindDown?.name ??
            null,
          originalRoleEligible:
            params.opportunity.scenarioWindDownDebug?.originalRoleEligible ?? true,
          repairApplied:
            params.opportunity.scenarioWindDownDebug?.repairApplied ??
            Boolean(params.replacements.windDown),
          repairReplacementVenueId:
            params.replacements.windDown?.venueId ??
            params.opportunity.scenarioWindDownDebug?.repairReplacementVenueId ??
            null,
          repairReplacementName:
            params.replacements.windDown?.name ??
            params.opportunity.scenarioWindDownDebug?.repairReplacementName ??
            null,
          repairSource:
            params.replacements.windDown
              ? 'build_required_anchor_support_selection'
              : params.opportunity.scenarioWindDownDebug?.repairSource ?? null,
          repairReason:
            params.replacements.windDown
              ? 'support_stop_replaced_for_route_compactness'
              : params.opportunity.scenarioWindDownDebug?.repairReason ?? null,
          finalVenueId: windDown.venueId,
          finalName: windDown.name,
          finalRoleEligible: true,
        }
      : params.opportunity.scenarioWindDownDebug,
    scenarioNight: {
      ...scenarioNight,
      stops: replacedScenarioStops,
      whyThisWorks:
        start && highlight && windDown
          ? `Starts at ${start.name}, centers on ${highlight.name}, and lands cleanly at ${windDown.name}.`
          : scenarioNight.whyThisWorks,
    },
  }
}

function maybeApplyBuildRequiredAnchorSupportSelection(params: {
  opportunity: VerifiedCityOpportunity
  opportunities: VerifiedCityOpportunity[]
  admittedSupportCandidates?: readonly CurateBuildAdmittedSupportCandidate[]
  starterPack?: StarterPack | null
  proofTarget?: CurateHardPocketProofTargetAssertionContext
}): {
  opportunity: VerifiedCityOpportunity
  diagnostic: CurateBuildAnchorSupportSelectionDiagnostic
} {
  const { opportunity, proofTarget, starterPack } = params
  const isBuildRequiredAnchor =
    proofTarget?.proofPolicy === 'build_required_anchor_soft_geography' ||
    proofTarget?.proofMode === 'build_required_anchor'
  if (
    !isBuildRequiredAnchor ||
    starterPack?.id !== 'coffee-books' ||
    !proofTarget ||
    !opportunity.scenarioNight
  ) {
    return {
      opportunity,
      diagnostic: buildDefaultBuildAnchorSupportSelectionDiagnostic({
        proofPolicy: proofTarget?.proofPolicy ?? null,
        proofMode: proofTarget?.proofMode ?? null,
      }),
    }
  }

  const selectedProofStop = findSelectedStopForCoffeeBooksProof({
    opportunity,
    representation:
      opportunity.starterSemanticRepresentation ??
      opportunity.scenarioNight.starterSemanticRepresentation,
  })
  if (!selectedProofStop) {
    return {
      opportunity,
      diagnostic: buildDefaultBuildAnchorSupportSelectionDiagnostic({
        status: 'failed',
        reason: 'anchor_centered_support_selection_failed',
        proofPolicy: proofTarget.proofPolicy ?? null,
        proofMode: proofTarget.proofMode ?? null,
      }),
    }
  }

  const anchorRole = roleForScenarioPosition(selectedProofStop.position) ?? 'highlight'
  const originalRoute = {
    start: findScenarioCoreStopByRole({ opportunity, role: 'start' }),
    highlight: findScenarioCoreStopByRole({ opportunity, role: 'highlight' }),
    windDown: findScenarioCoreStopByRole({ opportunity, role: 'windDown' }),
  }
  const originalMovement = summarizeScenarioRouteMovement([
    originalRoute.start,
    originalRoute.highlight,
    originalRoute.windDown,
  ])
  const blockedVenueIds = new Set(
    [selectedProofStop.venueId].filter((value): value is string => Boolean(value?.trim())),
  )
  const replacements: Partial<Record<CurateBuildAnchorSupportRole, BuiltScenarioStop>> = {}
  const originalSupportStops: CurateBuildAnchorSupportStopDiagnostic[] = []
  const replacementSupportStops: CurateBuildAnchorSupportStopDiagnostic[] = []
  const scenarioSupportCandidateCountByRole: Record<CurateBuildAnchorSupportRole, number> = {
    start: 0,
    highlight: 0,
    windDown: 0,
  }
  const admittedCandidateBoardCountByRole: Record<CurateBuildAnchorSupportRole, number> = {
    start: 0,
    highlight: 0,
    windDown: 0,
  }
  const admittedFallbackCandidateCountByRole: Record<CurateBuildAnchorSupportRole, number> = {
    start: 0,
    highlight: 0,
    windDown: 0,
  }
  const supportSelectionSourceByRole: Record<
    CurateBuildAnchorSupportRole,
    CurateBuildAnchorSupportSelectionSource
  > = {
    start: 'none',
    highlight: 'none',
    windDown: 'none',
  }
  const windDownCandidateDiagnostics: CurateBuildAnchorSupportCandidateDiagnostic[] = []
  let chosenWindDownCandidate: CurateBuildAnchorSupportSelectionDiagnostic['chosenWindDownCandidate'] = null
  const availableCompactAlternativesConsidered:
    CurateBuildAnchorSupportSelectionDiagnostic['availableCompactAlternativesConsidered'] = []

  for (const role of ['start', 'highlight', 'windDown'] as const) {
    const originalStop = originalRoute[role]
    if (role === anchorRole || originalStop?.venueId === selectedProofStop.venueId) {
      const preserved = buildSupportStopDiagnostic({
        role,
        originalStop,
        replacementStop: originalStop,
        kept: true,
        replaced: false,
        selectedSupportSource: 'none',
        reason: 'support_stop_preserved_required_anchor',
      })
      originalSupportStops.push(preserved)
      replacementSupportStops.push(preserved)
      supportSelectionSourceByRole[role] = 'none'
      continue
    }
    const alreadyAnchorCentered = originalStop
      ? scenarioStopMatchesProofTargetPocket({ stop: originalStop, proofTarget })
      : false
    if (alreadyAnchorCentered) {
      const kept = buildSupportStopDiagnostic({
        role,
        originalStop,
        replacementStop: originalStop,
        kept: true,
        replaced: false,
        selectedSupportSource: 'scenario_stop',
        reason: 'support_stop_kept_anchor_centered',
      })
      originalSupportStops.push(kept)
      replacementSupportStops.push(kept)
      supportSelectionSourceByRole[role] = 'scenario_stop'
      if (originalStop?.venueId) {
        blockedVenueIds.add(originalStop.venueId)
      }
      continue
    }
    const candidateCollection = collectBuildAnchorSupportCandidates({
      opportunities: params.opportunities,
      admittedSupportCandidates: params.admittedSupportCandidates,
      role,
      proofTarget,
      blockedVenueIds,
      starterPack,
      allowAdmittedFallback: role === 'windDown',
    })
    scenarioSupportCandidateCountByRole[role] = candidateCollection.scenarioCandidateCount
    admittedCandidateBoardCountByRole[role] =
      candidateCollection.admittedCandidateBoardCount
    admittedFallbackCandidateCountByRole[role] =
      candidateCollection.admittedFallbackCandidateCount
    if (role === 'windDown') {
      windDownCandidateDiagnostics.push(...candidateCollection.diagnostics)
    }
    availableCompactAlternativesConsidered.push(
      ...candidateCollection.candidates.slice(0, 5).map((entry) => ({
        role,
        venueId: entry.stop.venueId,
        name: entry.stop.name,
        pocketId: entry.stop.geoBucket ?? null,
        pocketLabel:
          entry.stop.geoLabel ?? entry.stop.district ?? entry.stop.neighborhoodLabel ?? null,
        source: entry.source,
      })),
    )
    const replacement = candidateCollection.candidates[0]
    if (!replacement) {
      const admittedCandidateBoardWindDownFailed =
        role === 'windDown' &&
        candidateCollection.scenarioCandidateCount === 0 &&
        candidateCollection.admittedCandidateBoardCount > 0 &&
        candidateCollection.admittedFallbackCandidateCount === 0
      const failed = buildSupportStopDiagnostic({
        role,
        originalStop,
        replacementStop: null,
        kept: false,
        replaced: false,
        selectedSupportSource: 'none',
        reason:
          admittedCandidateBoardWindDownFailed
            ? 'build_required_anchor_no_admitted_winddown_support_candidate'
            : role === 'windDown' && candidateCollection.scenarioCandidateCount === 0
            ? 'scenario_support_role_missing'
            : 'anchor_centered_support_selection_failed',
      })
      originalSupportStops.push(failed)
      replacementSupportStops.push(failed)
      const failedRoute = {
        ...originalRoute,
        ...replacements,
      }
      const failedMovement = summarizeScenarioRouteMovement([
        failedRoute.start,
        failedRoute.highlight,
        failedRoute.windDown,
      ])
      return {
        opportunity,
        diagnostic: buildDefaultBuildAnchorSupportSelectionDiagnostic({
          status: 'failed',
          reason: admittedCandidateBoardWindDownFailed
            ? 'build_required_anchor_no_admitted_winddown_support_candidate'
            : 'anchor_centered_support_selection_failed',
          proofPolicy: proofTarget.proofPolicy ?? null,
          proofMode: proofTarget.proofMode ?? null,
          requiredAnchorId: selectedProofStop.venueId,
          requiredAnchorName: selectedProofStop.name,
          requiredAnchorPocketId: selectedProofStop.geoBucket ?? null,
          requiredAnchorPocketLabel:
            selectedProofStop.geoLabel ??
            selectedProofStop.district ??
            selectedProofStop.neighborhoodLabel ??
            null,
          originalSupportStops,
          replacementSupportStops,
          scenarioSupportCandidateCountByRole,
          admittedCandidateBoardCountByRole,
          admittedFallbackCandidateCountByRole,
          supportSelectionUsedCandidateBoardFallback: false,
          supportSelectionSourceByRole,
          windDownCandidateDiagnostics,
          chosenWindDownCandidate,
          availableCompactAlternativesConsidered,
          movementTotalBefore: originalMovement.total,
          movementTotalAfter: failedMovement.total,
          maxTransitionBefore: originalMovement.max,
          maxTransitionAfter: failedMovement.max,
          neighborhoodsBefore: originalMovement.neighborhoods,
          neighborhoodsAfter: failedMovement.neighborhoods,
          anchorCentered: false,
          routeShapePreserved: false,
          greatStopInputUsesReplacedSupports: false,
        }),
      }
    }
    replacements[role] = replacement.stop
    blockedVenueIds.add(replacement.stop.venueId)
    supportSelectionSourceByRole[role] = replacement.source
    if (role === 'windDown') {
      chosenWindDownCandidate = {
        venueId: replacement.stop.venueId,
        name: replacement.stop.name,
        pocketId: replacement.stop.geoBucket ?? null,
        pocketLabel:
          replacement.stop.geoLabel ??
          replacement.stop.district ??
          replacement.stop.neighborhoodLabel ??
          null,
        source: replacement.source,
      }
      windDownCandidateDiagnostics.forEach((entry) => {
        if (entry.venueId === replacement.stop.venueId) {
          entry.selected = true
          entry.rejectedReason = null
        }
      })
    }
    const diagnostic = buildSupportStopDiagnostic({
      role,
      originalStop,
      replacementStop: replacement.stop,
      kept: false,
      replaced: true,
      selectedSupportSource: replacement.source,
      reason:
        replacement.sourceStage === 'admitted_candidate_board'
          ? 'admitted_winddown_candidate_selected'
          : 'support_stop_replaced_for_route_compactness',
    })
    originalSupportStops.push(
      buildSupportStopDiagnostic({
        role,
        originalStop,
        replacementStop: null,
        kept: false,
        replaced: false,
        selectedSupportSource: 'none',
        reason: 'stale_support_stop_outside_anchor_pocket',
      }),
    )
    replacementSupportStops.push(diagnostic)
  }

  const adjustedOpportunity = replaceScenarioCoreStop({
    opportunity,
    replacements,
  })
  const adjustedRoute = {
    start: findScenarioCoreStopByRole({ opportunity: adjustedOpportunity, role: 'start' }),
    highlight: findScenarioCoreStopByRole({ opportunity: adjustedOpportunity, role: 'highlight' }),
    windDown: findScenarioCoreStopByRole({ opportunity: adjustedOpportunity, role: 'windDown' }),
  }
  const adjustedMovement = summarizeScenarioRouteMovement([
    adjustedRoute.start,
    adjustedRoute.highlight,
    adjustedRoute.windDown,
  ])
  const replacementApplied = Object.keys(replacements).length > 0
  const anchorCentered = [adjustedRoute.start, adjustedRoute.highlight, adjustedRoute.windDown]
    .filter((stop): stop is BuiltScenarioStop => Boolean(stop))
    .every((stop) => scenarioStopMatchesProofTargetPocket({ stop, proofTarget }))
  const routeShapePreserved = Boolean(adjustedRoute.start && adjustedRoute.highlight && adjustedRoute.windDown)
  const usedAdmittedSupply = Object.values(supportSelectionSourceByRole).some(
    (source) =>
      source === 'live_supply' ||
      source === 'admitted_candidate' ||
      source === 'admitted_candidate_board',
  )
  const supportSelectionUsedCandidateBoardFallback = Object.values(supportSelectionSourceByRole).some(
    (source) => source === 'admitted_candidate_board',
  )

  return {
    opportunity: adjustedOpportunity,
    diagnostic: buildDefaultBuildAnchorSupportSelectionDiagnostic({
      status: 'passed',
      reason: replacementApplied
        ? usedAdmittedSupply
          ? 'build_required_anchor_support_from_admitted_supply'
          : 'anchor_centered_support_selection_applied'
        : null,
      proofPolicy: proofTarget.proofPolicy ?? null,
      proofMode: proofTarget.proofMode ?? null,
      requiredAnchorId: selectedProofStop.venueId,
      requiredAnchorName: selectedProofStop.name,
      requiredAnchorPocketId: selectedProofStop.geoBucket ?? null,
      requiredAnchorPocketLabel:
        selectedProofStop.geoLabel ??
        selectedProofStop.district ??
        selectedProofStop.neighborhoodLabel ??
        null,
      originalSupportStops,
      replacementSupportStops,
      scenarioSupportCandidateCountByRole,
      admittedCandidateBoardCountByRole,
      admittedFallbackCandidateCountByRole,
      supportSelectionUsedCandidateBoardFallback,
      supportSelectionSourceByRole,
      windDownCandidateDiagnostics,
      chosenWindDownCandidate,
      availableCompactAlternativesConsidered,
      movementTotalBefore: originalMovement.total,
      movementTotalAfter: adjustedMovement.total,
      maxTransitionBefore: originalMovement.max,
      maxTransitionAfter: adjustedMovement.max,
      neighborhoodsBefore: originalMovement.neighborhoods,
      neighborhoodsAfter: adjustedMovement.neighborhoods,
      anchorCentered,
      routeShapePreserved,
      greatStopInputUsesReplacedSupports: replacementApplied,
    }),
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
  buildRequiredAnchorSupportSelection?: CurateBuildAnchorSupportSelectionDiagnostic
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
  const buildRequiredAnchorSupportSelection =
    params.buildRequiredAnchorSupportSelection ??
    buildDefaultBuildAnchorSupportSelectionDiagnostic({
      proofPolicy: proofTarget?.proofPolicy ?? null,
      proofMode: proofTarget?.proofMode ?? null,
    })
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

  if (buildRequiredAnchorSupportSelection.status === 'failed') {
    return {
      allowed: false,
      status: 'rejected',
      reason: 'anchor_centered_support_selection_failed',
      failedRoles: buildRequiredAnchorSupportSelection.replacementSupportStops
        .filter(
          (entry) =>
            entry.reason === 'anchor_centered_support_selection_failed' ||
            entry.reason === 'build_required_anchor_no_admitted_winddown_support_candidate',
        )
        .map((entry) => entry.role),
      seedProjectionAvailable: true,
      proofTargetAssertion,
      hardCommitFeasibility: buildFeasibility({
        status: 'failed',
        failureClass: 'materialization_unresolved',
        failedRole:
          buildRequiredAnchorSupportSelection.replacementSupportStops.find(
            (entry) =>
              entry.reason === 'anchor_centered_support_selection_failed' ||
              entry.reason === 'build_required_anchor_no_admitted_winddown_support_candidate',
          )?.role ?? null,
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
  admittedSupportCandidates?: readonly CurateBuildAdmittedSupportCandidate[]
  starterPack?: StarterPack | null
  proofTarget?: CurateHardPocketProofTargetAssertionContext
}): {
  artifacts: ContractEntryArtifact[]
  diagnostics: CurateScenarioBackedArtifactBridgeDiagnostic[]
} {
  const artifacts: ContractEntryArtifact[] = []
  const diagnostics: CurateScenarioBackedArtifactBridgeDiagnostic[] = []

  dedupeOpportunities(params.opportunities).forEach((opportunity) => {
    const supportSelection = maybeApplyBuildRequiredAnchorSupportSelection({
      opportunity,
      opportunities: params.opportunities,
      admittedSupportCandidates: params.admittedSupportCandidates,
      starterPack: params.starterPack,
      proofTarget: params.proofTarget,
    })
    const baseArtifact = buildContractEntryArtifactFromVerifiedOpportunity({
      opportunity: supportSelection.opportunity,
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
      opportunity: supportSelection.opportunity,
      artifact,
      starterPack: params.starterPack,
      proofTarget: params.proofTarget,
      buildRequiredAnchorSupportSelection: supportSelection.diagnostic,
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
      buildRequiredAnchorSupportSelection: supportSelection.diagnostic,
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
  admittedSupportCandidates?: readonly CurateBuildAdmittedSupportCandidate[]
  starterPack?: StarterPack | null
  proofTarget?: CurateHardPocketProofTargetAssertionContext
}): CurateScenarioBackedArtifactBridgeResult {
  const primary = buildArtifactsForPool({
    opportunities: params.primaryOpportunities,
    sourcePool: 'primary',
    ecsState: params.ecsState,
    directionCards: params.directionCards,
    allDirectionCards: params.allDirectionCards,
    admittedSupportCandidates: params.admittedSupportCandidates,
    starterPack: params.starterPack,
    proofTarget: params.proofTarget,
  })
  const fallback = buildArtifactsForPool({
    opportunities: params.fallbackOpportunities,
    sourcePool: 'fallback',
    ecsState: params.ecsState,
    directionCards: params.directionCards,
    allDirectionCards: params.allDirectionCards,
    admittedSupportCandidates: params.admittedSupportCandidates,
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
