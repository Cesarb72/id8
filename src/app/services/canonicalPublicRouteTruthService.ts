import {
  deriveContractEntryArtifactRoleCoverage,
  validateContractEntryArtifactPreCommitTruth,
  type ContractEntryArtifact,
} from '../../domain/artifacts/contractEntryArtifact'
import {
  buildAnchorTruthContract,
  validateRuntimeRouteBuildAnchor,
  type BuildAnchorCanonicalRole,
  type BuildAnchorTruthContract,
} from '../../domain/artifacts/buildAnchorTruthContract'
import type { RuntimeRouteArtifact } from '../../domain/artifacts/runtimeRouteArtifact'
import {
  buildContractEntryLockProjection,
  buildContractEntryPlansSummaryProjection,
  buildContractEntryReviewProjection,
  buildContractEntryRevealProjection,
  buildContractEntryVisibleCardProjection,
} from '../../domain/artifacts/contractEntryArtifactProjection'
import type { ExperienceMode } from '../../domain/types/intent'
import type { Itinerary, UserStopRole } from '../../domain/types/itinerary'
import type { StarterPack } from '../../domain/types/starterPack'
import {
  buildPublicCurateCardTruthModel,
  validatePublicCurateStarterFit,
  type PublicCurateCardTruthInput,
  type PublicCurateCardTruthModel,
} from './curate/publicCurateCardTruthService'
import {
  buildLockInputFromRouteAuthoritySnapshot,
  buildRouteAuthoritySnapshot,
} from './routeAuthority/routeAuthorityService'
import type { BuildCandidateAdmissionResult } from './buildCandidateAdmission/buildCandidateAdmissionService'
import type { BuildAnchorSelection } from './buildAnchorOrchestrationService'

export interface PublicContractEntryArtifactTruthContext {
  mode: ExperienceMode | null
  starterPack?: StarterPack | null
}

export interface PublicContractEntryArtifactTruthResult {
  allowedToRender: boolean
  artifact: ContractEntryArtifact | null
  rejectionReasons: string[]
}

export type BuildApprovedRouteSourceKind = 'static' | 'provider_shadow' | 'debug_only'

export type BuildStaticPreGenerationSelectionRejectionReason =
  | 'build_static_artifact_missing'
  | 'build_static_source_not_approved'
  | 'build_static_admission_missing'
  | 'build_static_admission_failed'
  | 'build_static_anchor_truth_not_passed'
  | 'build_static_anchor_role_mismatch'
  | 'build_static_core_route_roles_missing'
  | 'build_static_candidate_not_unparked'

export type BuildCardTruthRejectionReason =
  | 'build_admission_missing'
  | 'build_admission_failed'
  | 'build_anchor_truth_missing'
  | 'build_anchor_not_preserved'
  | 'build_anchor_wrong_role'
  | 'build_hours_blocked'
  | 'build_route_authority_unavailable'
  | 'build_provider_shadow_not_selectable'
  | 'build_debug_candidate_not_selectable'
  | 'build_selected_artifact_mismatch'
  | 'build_selected_direction_mismatch'
  | 'build_final_route_missing'
  | 'build_non_canonical_route_ids'
  | 'build_source_not_approved_selectable'
  | 'build_provider_selection_parked'
  | 'build_provider_visible_merge_parked'
  | 'build_review_truth_unavailable'

export interface BuildApprovedPayloadReference {
  artifactId?: string | null
  selectedDirectionId?: string | null
  finalRoute?: RuntimeRouteArtifact | null
  selectedClusterConfirmation?: string | null
  itinerary?: Itinerary | null
  sourceKind?: BuildApprovedRouteSourceKind
}

export interface BuildCardTruthInput {
  artifact: ContractEntryArtifact | null | undefined
  selectedArtifactId?: string | null
  selectedDirectionId?: string | null
  approvedPayload?: BuildApprovedPayloadReference | null
  candidateAdmission?: BuildCandidateAdmissionResult | null
  anchorTruthContract?: BuildAnchorTruthContract | null
  selectedAnchorRequiredRole?: BuildAnchorCanonicalRole | null
  selectedBuildAnchor?: BuildAnchorSelection | null
  sourceKind?: BuildApprovedRouteSourceKind
  buildProviderSelectionAllowed: boolean
  buildProviderMergedIntoVisiblePool: boolean
  activeRole?: UserStopRole
  fallbackCity?: string
}

export interface BuildCardTruthResult {
  approvedPayloadTruthAllowed: boolean
  visibleCardEligible: boolean
  cardSelectable: boolean
  reviewEligible: boolean
  routeAuthorityLockReady: boolean
  sourceKind: BuildApprovedRouteSourceKind
  isProviderShadow: boolean
  isDebugOnly: boolean
  isApprovedSelectableSource: boolean
  providerShadowExcluded: boolean
  buildTruthReady: boolean
  buildSelectableWhenUnparked: boolean
  rejectionReasons: BuildCardTruthRejectionReason[]
  warningReasons: string[]
  diagnostics: {
    artifactId: string | null
    selectedArtifactId: string | null
    selectedDirectionId: string | null
    approvedPayloadArtifactId: string | null
    approvedPayloadDirectionId: string | null
    finalRoutePresent: boolean
    routeAuthorityStatus: string
    routeAuthoritySourceLabel: string
    routeAuthorityRejectionReasons: string[]
    routeAuthorityMismatchReasons: string[]
    lockInputAvailable: boolean
    buildAdmissionAdmitted: boolean | null
    buildAdmissionTruthGateStatus: string | null
    buildAnchorValidationStatus: string | null
    buildProviderSelectionAllowed: boolean
    buildProviderMergedIntoVisiblePool: boolean
    isProviderShadow: boolean
    isDebugOnly: boolean
    isApprovedSelectableSource: boolean
    providerShadowExcluded: boolean
    buildTruthReady: boolean
    buildSelectableWhenUnparked: boolean
  }
}

export interface BuildStaticPreGenerationCardSelectionInput {
  artifact: ContractEntryArtifact | null | undefined
  candidateAdmission?: BuildCandidateAdmissionResult | null
  selectedAnchorRequiredRole?: BuildAnchorCanonicalRole | null
  sourceKind?: BuildApprovedRouteSourceKind
  buildProviderSelectionAllowed: boolean
  buildProviderMergedIntoVisiblePool: boolean
}

export interface BuildStaticPreGenerationCardSelectionResult {
  selectable: boolean
  sourceKind: BuildApprovedRouteSourceKind
  rejectionReasons: BuildStaticPreGenerationSelectionRejectionReason[]
  diagnostics: {
    artifactId: string | null
    admitted: boolean | null
    truthGateStatus: string | null
    selectedAnchorRequiredRole: BuildAnchorCanonicalRole | null
    artifactAnchorRole: BuildAnchorCanonicalRole | null
    missingCoreRoles: string[]
    coreRouteIds: Partial<Record<string, string>>
    buildProviderSelectionAllowed: boolean
    buildProviderMergedIntoVisiblePool: boolean
  }
}

export type CanonicalModePublicRouteTruthInput =
  | {
      mode: 'curate'
      input: PublicCurateCardTruthInput
    }
  | {
      mode: 'build'
      input: BuildCardTruthInput
    }

export type CanonicalModePublicRouteTruthResult =
  | {
      mode: 'curate'
      truth: PublicCurateCardTruthModel
    }
  | {
      mode: 'build'
      truth: BuildCardTruthResult
    }

function normalizeRouteText(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function getItineraryRoleName(
  itinerary: Itinerary,
  role: 'start' | 'highlight' | 'windDown',
): string | null {
  return itinerary.stops.find((stop) => stop.role === role)?.venueName ?? null
}

function collectContextRejectionReasons(
  artifact: ContractEntryArtifact,
  context: PublicContractEntryArtifactTruthContext,
): string[] {
  const reasons = new Set<string>()
  const artifactMode = artifact.enrichment?.mode
  const expectedMode = context.mode
  if (!expectedMode) {
    reasons.add('missing_expected_mode')
  }
  if (expectedMode && artifactMode && artifactMode !== expectedMode) {
    reasons.add('mode_context_mismatch')
  }
  if (expectedMode && artifact.enrichment?.modeContextFit?.mode) {
    if (artifact.enrichment.modeContextFit.mode !== expectedMode) {
      reasons.add('mode_context_mismatch')
    }
  }

  const expectedStarterPackId = context.starterPack?.id
  const artifactStarterPackId =
    artifact.enrichment?.starterContextFit?.starterPackId ??
    artifact.enrichment?.userInputContext?.starterPackId
  if (expectedStarterPackId && artifactStarterPackId !== expectedStarterPackId) {
    reasons.add('starter_context_mismatch')
  }
  if (!expectedStarterPackId && artifactStarterPackId && expectedMode === 'curate') {
    reasons.add('starter_context_mismatch')
  }

  if (expectedMode === 'curate') {
    const starterFit = validatePublicCurateStarterFit({
      selectedStarterPack: context.starterPack ?? null,
      artifact,
    })
    if (!starterFit.allowedToRender) {
      for (const reason of starterFit.rejectionReasons) {
        reasons.add(`curate_${reason}`)
      }
    }
  }

  return [...reasons]
}

export function validatePublicContractEntryArtifactTruth(
  artifact: ContractEntryArtifact | undefined | null,
  context: PublicContractEntryArtifactTruthContext,
): PublicContractEntryArtifactTruthResult {
  if (!artifact) {
    return {
      allowedToRender: false,
      artifact: null,
      rejectionReasons: ['missing_contract_entry_artifact'],
    }
  }

  const validation = validateContractEntryArtifactPreCommitTruth(artifact, {
    requireEnrichment: true,
  })
  const rejectionReasons = new Set<string>(validation.rejectionReasons)
  for (const reason of collectContextRejectionReasons(artifact, context)) {
    rejectionReasons.add(reason)
  }
  const allowedToRender =
    validation.status === 'valid' &&
    validation.fullPlanVisible &&
    rejectionReasons.size === 0

  return {
    allowedToRender,
    artifact: allowedToRender ? artifact : null,
    rejectionReasons: [...rejectionReasons],
  }
}

export function buildArtifactBackedVisibleItinerary(params: {
  artifact: ContractEntryArtifact | undefined | null
  itinerary: Itinerary | undefined | null
  context: PublicContractEntryArtifactTruthContext
}): Itinerary | null {
  const { artifact, itinerary, context } = params
  if (!itinerary) {
    return null
  }
  const truth = validatePublicContractEntryArtifactTruth(artifact, context)
  if (!truth.allowedToRender || !truth.artifact) {
    return null
  }
  const roleCoverage = deriveContractEntryArtifactRoleCoverage(truth.artifact)
  const roles = ['start', 'highlight', 'windDown'] as const
  const routeMatchesArtifact = roles.every((role) => {
    const itineraryName = getItineraryRoleName(itinerary, role)
    return normalizeRouteText(itineraryName) === normalizeRouteText(roleCoverage[role])
  })
  if (!routeMatchesArtifact) {
    return null
  }
  return itinerary
}

export function buildCanonicalPublicRouteFlowTruth(
  artifact: ContractEntryArtifact | undefined | null,
  context: PublicContractEntryArtifactTruthContext,
) {
  const truth = validatePublicContractEntryArtifactTruth(artifact, context)
  if (!truth.allowedToRender || !truth.artifact) {
    return {
      allowed: false,
      rejectionReasons: truth.rejectionReasons,
      visibleCard: null,
      review: null,
      reveal: null,
      lock: null,
      plans: null,
    }
  }

  return {
    allowed: true,
    rejectionReasons: [],
    visibleCard: buildContractEntryVisibleCardProjection(truth.artifact),
    review: buildContractEntryReviewProjection(truth.artifact),
    reveal: buildContractEntryRevealProjection(truth.artifact),
    lock: buildContractEntryLockProjection(truth.artifact),
    plans: buildContractEntryPlansSummaryProjection(truth.artifact),
  }
}

function addBuildTruthReason(
  reasons: BuildCardTruthRejectionReason[],
  reason: BuildCardTruthRejectionReason,
): void {
  if (!reasons.includes(reason)) {
    reasons.push(reason)
  }
}

function addBuildStaticSelectionReason(
  reasons: BuildStaticPreGenerationSelectionRejectionReason[],
  reason: BuildStaticPreGenerationSelectionRejectionReason,
): void {
  if (!reasons.includes(reason)) {
    reasons.push(reason)
  }
}

function resolveBuildAnchorTruthContract(
  input: BuildCardTruthInput,
): BuildAnchorTruthContract | null {
  if (input.anchorTruthContract) {
    return input.anchorTruthContract
  }
  const requiredRole = input.selectedAnchorRequiredRole ?? input.artifact?.anchorRole ?? null
  if (!input.selectedBuildAnchor?.venueId || !requiredRole) {
    return null
  }
  return buildAnchorTruthContract({
    identity: {
      venueId: input.selectedBuildAnchor.venueId,
      sourceVenueId: input.selectedBuildAnchor.sourceVenueId,
      providerRecordId: input.selectedBuildAnchor.providerRecordId,
      displayName: input.selectedBuildAnchor.name,
    },
    role: {
      role: requiredRole,
      roleResolutionSource: input.selectedAnchorRequiredRole ? 'explicit' : 'inferred',
    },
  })
}

function hasCanonicalThreeRoleFinalRoute(
  finalRoute: RuntimeRouteArtifact | null | undefined,
): boolean {
  if (!finalRoute) {
    return false
  }
  return (['start', 'highlight', 'windDown'] as const).every((role) =>
    finalRoute.stops.some((stop) => stop.role === role && Boolean(stop.venueId.trim())),
  )
}

export function buildBuildCardTruthModel(input: BuildCardTruthInput): BuildCardTruthResult {
  const artifact = input.artifact ?? null
  const approvedPayload = input.approvedPayload ?? null
  const finalRoute = approvedPayload?.finalRoute ?? null
  const sourceKind = input.sourceKind ?? approvedPayload?.sourceKind ?? 'static'
  const isProviderShadow = sourceKind === 'provider_shadow'
  const isDebugOnly = sourceKind === 'debug_only'
  const isApprovedSelectableSource = sourceKind === 'static'
  const providerShadowExcluded = isProviderShadow
  const rejectionReasons: BuildCardTruthRejectionReason[] = []
  const buildTruthRejectionReasons: BuildCardTruthRejectionReason[] = []
  const warningReasons = [...(input.candidateAdmission?.warningReasons ?? [])]

  if (!input.candidateAdmission) {
    addBuildTruthReason(buildTruthRejectionReasons, 'build_admission_missing')
  } else if (!input.candidateAdmission.admitted) {
    addBuildTruthReason(buildTruthRejectionReasons, 'build_admission_failed')
    if (
      input.candidateAdmission.rejectionReasons.includes('closed_for_plan_window') ||
      input.candidateAdmission.rejectionReasons.includes('explicit_time_requires_known_open_hours')
    ) {
      addBuildTruthReason(buildTruthRejectionReasons, 'build_hours_blocked')
    }
    if (input.candidateAdmission.rejectionReasons.includes('stale_or_non_canonical_route_ids')) {
      addBuildTruthReason(buildTruthRejectionReasons, 'build_non_canonical_route_ids')
    }
  }

  const anchorTruthContract = resolveBuildAnchorTruthContract(input)
  let anchorValidationStatus: string | null = null
  if (!anchorTruthContract) {
    addBuildTruthReason(buildTruthRejectionReasons, 'build_anchor_truth_missing')
  } else if (finalRoute) {
    const anchorValidation = validateRuntimeRouteBuildAnchor(anchorTruthContract, finalRoute)
    anchorValidationStatus = anchorValidation.status
    if (anchorValidation.status === 'invalid' || !anchorValidation.preserved) {
      if (anchorValidation.reasons.includes('anchor_not_in_required_role')) {
        addBuildTruthReason(buildTruthRejectionReasons, 'build_anchor_wrong_role')
      }
      addBuildTruthReason(buildTruthRejectionReasons, 'build_anchor_not_preserved')
    }
  }

  if (!finalRoute) {
    addBuildTruthReason(buildTruthRejectionReasons, 'build_final_route_missing')
  } else if (!hasCanonicalThreeRoleFinalRoute(finalRoute)) {
    addBuildTruthReason(buildTruthRejectionReasons, 'build_non_canonical_route_ids')
  }

  if (artifact?.id && input.selectedArtifactId && artifact.id !== input.selectedArtifactId) {
    addBuildTruthReason(buildTruthRejectionReasons, 'build_selected_artifact_mismatch')
  }
  if (
    approvedPayload?.artifactId &&
    (input.selectedArtifactId ?? artifact?.id) &&
    approvedPayload.artifactId !== (input.selectedArtifactId ?? artifact?.id)
  ) {
    addBuildTruthReason(buildTruthRejectionReasons, 'build_selected_artifact_mismatch')
  }
  const expectedDirectionId = input.selectedDirectionId ?? artifact?.selection.directionId ?? null
  const observedDirectionId = approvedPayload?.selectedDirectionId ?? finalRoute?.selectedDirectionId
  if (expectedDirectionId && observedDirectionId && observedDirectionId !== expectedDirectionId) {
    addBuildTruthReason(buildTruthRejectionReasons, 'build_selected_direction_mismatch')
  }

  const routeAuthoritySnapshot = buildRouteAuthoritySnapshot({
    contractEntryArtifact: artifact,
    selectedDirectionId: expectedDirectionId,
    selectedArtifactId: input.selectedArtifactId ?? artifact?.id ?? approvedPayload?.artifactId ?? null,
    approvedPayload,
    selectedClusterConfirmation: approvedPayload?.selectedClusterConfirmation ?? undefined,
    itinerary: approvedPayload?.itinerary ?? undefined,
  })
  const routeAuthorityLockReady = Boolean(
    routeAuthoritySnapshot.lockReadyCanonicalRouteTruthCandidate &&
      routeAuthoritySnapshot.validationStatus === 'valid',
  )
  if (!routeAuthorityLockReady) {
    addBuildTruthReason(buildTruthRejectionReasons, 'build_route_authority_unavailable')
  }

  const lockInput =
    input.activeRole && input.fallbackCity
      ? buildLockInputFromRouteAuthoritySnapshot({
          snapshot: routeAuthoritySnapshot,
          activeRole: input.activeRole,
          fallbackCity: input.fallbackCity,
        })
      : null
  const lockInputAvailable = lockInput?.ok ?? routeAuthorityLockReady

  buildTruthRejectionReasons.forEach((reason) => addBuildTruthReason(rejectionReasons, reason))

  const buildTruthReady =
    buildTruthRejectionReasons.length === 0 &&
    Boolean(artifact && finalRoute && input.candidateAdmission?.admitted)
  if (isProviderShadow) {
    addBuildTruthReason(rejectionReasons, 'build_provider_shadow_not_selectable')
  }
  if (isDebugOnly) {
    addBuildTruthReason(rejectionReasons, 'build_debug_candidate_not_selectable')
  }
  if (!isApprovedSelectableSource) {
    addBuildTruthReason(rejectionReasons, 'build_source_not_approved_selectable')
  }
  const approvedPayloadTruthAllowed = buildTruthReady && isApprovedSelectableSource
  const visibleCardEligible = approvedPayloadTruthAllowed
  const buildSelectableWhenUnparked = approvedPayloadTruthAllowed
  if (buildSelectableWhenUnparked && !input.buildProviderSelectionAllowed) {
    addBuildTruthReason(rejectionReasons, 'build_provider_selection_parked')
  }
  if (buildSelectableWhenUnparked && !input.buildProviderMergedIntoVisiblePool) {
    addBuildTruthReason(rejectionReasons, 'build_provider_visible_merge_parked')
  }
  const cardSelectable = Boolean(
    buildSelectableWhenUnparked &&
      input.buildProviderSelectionAllowed &&
      input.buildProviderMergedIntoVisiblePool,
  )
  const reviewEligible = Boolean(cardSelectable && routeAuthorityLockReady)
  if (!reviewEligible) {
    addBuildTruthReason(rejectionReasons, 'build_review_truth_unavailable')
  }

  return {
    approvedPayloadTruthAllowed,
    visibleCardEligible,
    cardSelectable,
    reviewEligible,
    routeAuthorityLockReady,
    sourceKind,
    isProviderShadow,
    isDebugOnly,
    isApprovedSelectableSource,
    providerShadowExcluded,
    buildTruthReady,
    buildSelectableWhenUnparked,
    rejectionReasons,
    warningReasons,
    diagnostics: {
      artifactId: artifact?.id ?? null,
      selectedArtifactId: input.selectedArtifactId ?? null,
      selectedDirectionId: expectedDirectionId,
      approvedPayloadArtifactId: approvedPayload?.artifactId ?? null,
      approvedPayloadDirectionId: approvedPayload?.selectedDirectionId ?? null,
      finalRoutePresent: Boolean(finalRoute),
      routeAuthorityStatus: routeAuthoritySnapshot.validationStatus,
      routeAuthoritySourceLabel: routeAuthoritySnapshot.sourceLabel,
      routeAuthorityRejectionReasons: routeAuthoritySnapshot.rejectionReasons,
      routeAuthorityMismatchReasons: routeAuthoritySnapshot.mismatchReasons,
      lockInputAvailable,
      buildAdmissionAdmitted: input.candidateAdmission?.admitted ?? null,
      buildAdmissionTruthGateStatus: input.candidateAdmission?.truthGateStatus ?? null,
      buildAnchorValidationStatus: anchorValidationStatus,
      buildProviderSelectionAllowed: input.buildProviderSelectionAllowed,
      buildProviderMergedIntoVisiblePool: input.buildProviderMergedIntoVisiblePool,
      isProviderShadow,
      isDebugOnly,
      isApprovedSelectableSource,
      providerShadowExcluded,
      buildTruthReady,
      buildSelectableWhenUnparked,
    },
  }
}

export function evaluateBuildStaticPreGenerationCardSelection(
  input: BuildStaticPreGenerationCardSelectionInput,
): BuildStaticPreGenerationCardSelectionResult {
  const rejectionReasons: BuildStaticPreGenerationSelectionRejectionReason[] = []
  const artifact = input.artifact ?? null
  const admission = input.candidateAdmission ?? null
  const sourceKind = input.sourceKind ?? 'static'
  const selectedAnchorRequiredRole = input.selectedAnchorRequiredRole ?? null
  const artifactAnchorRole = artifact?.anchorRole ?? null

  if (!artifact) {
    addBuildStaticSelectionReason(rejectionReasons, 'build_static_artifact_missing')
  }
  if (
    selectedAnchorRequiredRole &&
    artifactAnchorRole &&
    artifactAnchorRole !== selectedAnchorRequiredRole
  ) {
    addBuildStaticSelectionReason(rejectionReasons, 'build_static_anchor_role_mismatch')
  }
  if (
    selectedAnchorRequiredRole &&
    admission?.requiredAnchorRole &&
    admission.requiredAnchorRole !== selectedAnchorRequiredRole
  ) {
    addBuildStaticSelectionReason(rejectionReasons, 'build_static_anchor_role_mismatch')
  }
  if (sourceKind !== 'static') {
    addBuildStaticSelectionReason(rejectionReasons, 'build_static_source_not_approved')
  }
  if (!admission) {
    addBuildStaticSelectionReason(rejectionReasons, 'build_static_admission_missing')
  } else {
    if (!admission.admitted) {
      addBuildStaticSelectionReason(rejectionReasons, 'build_static_admission_failed')
    }
    if (admission.truthGateStatus !== 'passed') {
      addBuildStaticSelectionReason(rejectionReasons, 'build_static_anchor_truth_not_passed')
    }
    if (admission.diagnostics.missingCoreRoles.length > 0) {
      addBuildStaticSelectionReason(rejectionReasons, 'build_static_core_route_roles_missing')
    }
  }
  if (!input.buildProviderSelectionAllowed || !input.buildProviderMergedIntoVisiblePool) {
    addBuildStaticSelectionReason(rejectionReasons, 'build_static_candidate_not_unparked')
  }

  return {
    selectable: rejectionReasons.length === 0,
    sourceKind,
    rejectionReasons,
    diagnostics: {
      artifactId: artifact?.id ?? null,
      admitted: admission?.admitted ?? null,
      truthGateStatus: admission?.truthGateStatus ?? null,
      selectedAnchorRequiredRole,
      artifactAnchorRole,
      missingCoreRoles: admission?.diagnostics.missingCoreRoles ?? [],
      coreRouteIds: admission?.diagnostics.coreRouteIds ?? {},
      buildProviderSelectionAllowed: input.buildProviderSelectionAllowed,
      buildProviderMergedIntoVisiblePool: input.buildProviderMergedIntoVisiblePool,
    },
  }
}

export function buildModeAwarePublicRouteTruth(
  input: CanonicalModePublicRouteTruthInput,
): CanonicalModePublicRouteTruthResult {
  if (input.mode === 'curate') {
    return {
      mode: 'curate',
      truth: buildPublicCurateCardTruthModel(input.input),
    }
  }
  return {
    mode: 'build',
    truth: buildBuildCardTruthModel(input.input),
  }
}
