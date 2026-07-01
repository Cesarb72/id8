import {
  deriveContractEntryArtifactRoleCoverage,
  validateContractEntryArtifactPreCommitTruth,
  type ContractEntryArtifact,
} from '../../../domain/artifacts/contractEntryArtifact'
import type { RuntimeRouteArtifact, RuntimeRouteStop } from '../../../domain/artifacts/runtimeRouteArtifact'
import type { Itinerary, ItineraryStop, UserStopRole } from '../../../domain/types/itinerary'
import type { BuildLockedLiveArtifactPayloadInput } from '../live/liveSessionHandoff'

export type CoreRouteRole = 'start' | 'highlight' | 'windDown'

export type RouteAuthoritySourceKind =
  | 'contract_entry_artifact'
  | 'runtime_route_artifact'
  | 'approved_payload'
  | 'legacy_curate_refinement_entry_payload'
  | 'legacy_selected_route_artifact'
  | 'page_local_final_route'

export type RouteAuthoritySourceClassification =
  | 'canonical_authority'
  | 'candidate_not_authority'
  | 'validated_compatibility'
  | 'legacy_compatibility'
  | 'page_local_authoring'

export type RouteAuthorityValidationStatus = 'valid' | 'warning' | 'invalid' | 'missing'

export interface RouteAuthorityApprovedPayloadReference {
  artifactId?: string | null
  selectedDirectionId?: string | null
  finalRoute?: RuntimeRouteArtifact | null
}

export interface RouteAuthorityLegacyCurateRefinementEntryPayloadReference {
  artifactId?: string | null
  selectedDirectionId?: string | null
  finalRoute?: RuntimeRouteArtifact | null
}

export interface RouteAuthorityLegacySelectedRouteArtifactReference {
  source?: string | null
  directionId?: string | null
  candidateArtifactId?: string | null
  candidateRouteArtifact?: ContractEntryArtifact | null
  canonicalRouteArtifact?: {
    finalRoute?: RuntimeRouteArtifact | null
  } | null
}

export interface RouteAuthorityLockReadyCanonicalRouteTruthCandidate {
  selectedDirectionId: string
  selectedArtifactId?: string
  source:
    | 'contract_entry_artifact.approved_payload'
    | 'contract_entry_artifact.runtime_route_artifact'
    | 'runtime_route_artifact'
  selectedClusterConfirmation?: string
  itinerary?: Itinerary
  finalRoute: RuntimeRouteArtifact
}

export type BuildRouteAuthoritySourceKind =
  | 'static'
  | 'build_static_pre_generation'
  | 'candidate_draft'
  | 'provider_shadow'
  | 'debug_only'

export type RouteAuthorityBuildDiagnosticReason =
  | 'static_candidate_not_authority'
  | 'generated_contract_entry_missing'
  | 'generated_route_identity_mismatch'
  | 'required_anchor_role_missing'
  | 'required_anchor_role_survived'
  | 'build_candidate_contract_preserved'
  | 'build_candidate_contract_drifted'
  | 'route_authority_lock_ready'
  | 'route_authority_lock_blocked'
  | 'provider_shadow_not_authority'
  | 'candidate_draft_not_authority'

export interface RouteAuthorityBuildContext {
  mode: 'build'
  selectedCandidateArtifact?: ContractEntryArtifact | null
  selectedCandidateSourceKind?: BuildRouteAuthoritySourceKind | null
  selectedAnchorVenueId?: string | null
  selectedAnchorRequiredRole?: CoreRouteRole | null
  routeReplacementAdmitted?: boolean
}

export interface RouteAuthorityBuildDiagnostics {
  mode: 'build'
  selectedCandidateArtifactId: string | null
  selectedCandidateSourceKind: BuildRouteAuthoritySourceKind | null
  generatedContractEntryArtifactId: string | null
  generatedRuntimeRoutePresent: boolean
  selectedAnchorVenueId: string | null
  selectedAnchorRequiredRole: CoreRouteRole | null
  anchorRoleSurvived: boolean
  candidateContractPreserved: boolean
  routeReplacementAdmitted: boolean
  reasons: RouteAuthorityBuildDiagnosticReason[]
}

export interface RouteAuthorityObservedSource {
  kind: RouteAuthoritySourceKind
  classification: RouteAuthoritySourceClassification
  present: boolean
  artifactId?: string
  directionId?: string
  routeIds: string[]
  displayNames: string[]
  mismatchReasons: string[]
}

export interface RouteAuthoritySnapshot {
  selectedContractEntryArtifact: ContractEntryArtifact | null
  selectedDirectionId: string | null
  selectedArtifactId: string | null
  approvedPayloadRoute: RuntimeRouteArtifact | null
  canonicalRouteIds: string[]
  lockReadyCanonicalRouteTruthCandidate: RouteAuthorityLockReadyCanonicalRouteTruthCandidate | null
  sourceLabel: string
  validationStatus: RouteAuthorityValidationStatus
  mismatchReasons: string[]
  rejectionReasons: string[]
  observedSources: RouteAuthorityObservedSource[]
  buildDiagnostics?: RouteAuthorityBuildDiagnostics
}

export interface RouteAuthorityLockInputDiagnostics {
  lockInputSource: RouteAuthorityLockReadyCanonicalRouteTruthCandidate['source'] | null
  canonicalRouteIds: string[]
  legacyInputsObserved: boolean
  legacyInputsMatchedCanonicalTruth: boolean | null
  builtFromCanonicalAuthority: boolean
  rejectionReason: string | null
}

export type RouteAuthorityLockInputResult =
  | {
      ok: true
      input: BuildLockedLiveArtifactPayloadInput
      diagnostics: RouteAuthorityLockInputDiagnostics
    }
  | {
      ok: false
      input: null
      diagnostics: RouteAuthorityLockInputDiagnostics
    }

export interface BuildRouteAuthoritySnapshotInput {
  contractEntryArtifact?: ContractEntryArtifact | null
  selectedDirectionId?: string | null
  selectedArtifactId?: string | null
  runtimeRouteArtifact?: RuntimeRouteArtifact | null
  approvedPayload?: RouteAuthorityApprovedPayloadReference | null
  legacyCurateRefinementEntryPayload?: RouteAuthorityLegacyCurateRefinementEntryPayloadReference | null
  legacySelectedRouteArtifact?: RouteAuthorityLegacySelectedRouteArtifactReference | null
  pageLocalFinalRoute?: RuntimeRouteArtifact | null
  selectedClusterConfirmation?: string
  itinerary?: Itinerary
  buildContext?: RouteAuthorityBuildContext | null
}

interface RoleIdentity {
  role: CoreRouteRole
  id?: string
  displayName?: string
}

interface RouteComparisonResult {
  matches: boolean
  mismatchReasons: string[]
}

const CORE_ROLES: CoreRouteRole[] = ['start', 'highlight', 'windDown']

function normalizeRole(role: string | undefined | null): CoreRouteRole | null {
  if (role === 'start' || role === 'highlight' || role === 'windDown') {
    return role
  }
  const normalized = role?.trim().toLowerCase()
  if (normalized === 'winddown' || normalized === 'wind down') {
    return 'windDown'
  }
  return null
}

function isRuntimeRouteItineraryRole(role: string | undefined | null): role is UserStopRole {
  return role === 'start' || role === 'highlight' || role === 'surprise' || role === 'windDown'
}

function normalizeText(value: string | undefined | null): string {
  return value?.trim().toLowerCase().replace(/\s+/g, ' ') ?? ''
}

function nonEmpty(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function firstNonEmpty(values: string[][]): string[] {
  return values.find((value) => value.length > 0) ?? []
}

function coreRouteIdsMatch(left: string[], right: string[]): boolean {
  return left.length === CORE_ROLES.length && left.join('|') === right.join('|')
}

function hasInvalidArtifactValidationReason(rejectionReasons: string[]): boolean {
  return rejectionReasons.some(
    (reason) =>
      reason === 'artifact_validation_rejected' ||
      reason === 'runtime_lock_ineligible' ||
      reason.endsWith('_failed') ||
      reason.endsWith('_rejected'),
  )
}

function orderedCoreStops(route: RuntimeRouteArtifact | null | undefined): RuntimeRouteStop[] {
  return (
    route?.stops
      .filter((stop) => normalizeRole(stop.role) !== null)
      .slice()
      .sort((left, right) => left.stopIndex - right.stopIndex) ?? []
  )
}

function firstStableStopId(stop: RuntimeRouteStop | undefined): string | undefined {
  if (!stop) {
    return undefined
  }
  return nonEmpty(stop.venueId) ?? nonEmpty(stop.providerRecordId) ?? nonEmpty(stop.sourceStopId)
}

function stopStableIdCandidates(stop: RuntimeRouteStop | undefined): string[] {
  if (!stop) {
    return []
  }
  return unique([stop.venueId, stop.providerRecordId, stop.sourceStopId])
}

function routeIds(route: RuntimeRouteArtifact | null | undefined): string[] {
  return orderedCoreStops(route).map((stop) => firstStableStopId(stop)).filter((id): id is string => Boolean(id))
}

function routeDisplayNames(route: RuntimeRouteArtifact | null | undefined): string[] {
  return orderedCoreStops(route).map((stop) => stop.displayName)
}

function routeStopByRole(route: RuntimeRouteArtifact | null | undefined): Partial<Record<CoreRouteRole, RuntimeRouteStop>> {
  const stopsByRole: Partial<Record<CoreRouteRole, RuntimeRouteStop>> = {}
  for (const stop of orderedCoreStops(route)) {
    const role = normalizeRole(stop.role)
    if (role && !stopsByRole[role]) {
      stopsByRole[role] = stop
    }
  }
  return stopsByRole
}

function artifactRoleIdentities(artifact: ContractEntryArtifact | null | undefined): RoleIdentity[] {
  if (!artifact) {
    return []
  }

  const coverage = deriveContractEntryArtifactRoleCoverage(artifact)
  const identities = new Map<CoreRouteRole, RoleIdentity>()
  for (const role of CORE_ROLES) {
    identities.set(role, {
      role,
      displayName: coverage[role],
    })
  }

  for (const support of artifact.enrichment?.canonicalRouteRoleCoverage?.support ?? []) {
    const role = normalizeRole(support.role)
    if (!role) {
      continue
    }
    const current = identities.get(role)
    identities.set(role, {
      role,
      id: nonEmpty(support.venueId) ?? current?.id,
      displayName: nonEmpty(support.name) ?? current?.displayName,
    })
  }

  const anchorRole = normalizeRole(artifact.anchorRole)
  if (anchorRole) {
    const current = identities.get(anchorRole)
    identities.set(anchorRole, {
      role: anchorRole,
      id: nonEmpty(artifact.anchorVenueId) ?? current?.id,
      displayName: current?.displayName,
    })
  }

  return CORE_ROLES.map((role) => identities.get(role)).filter(
    (identity): identity is RoleIdentity => Boolean(identity),
  )
}

function artifactRouteIds(artifact: ContractEntryArtifact | null | undefined): string[] {
  return artifactRoleIdentities(artifact).map((identity) => identity.id).filter((id): id is string => Boolean(id))
}

function artifactDisplayNames(artifact: ContractEntryArtifact | null | undefined): string[] {
  return artifactRoleIdentities(artifact)
    .map((identity) => identity.displayName)
    .filter((name): name is string => Boolean(name))
}

function sourceClassificationForArtifact(params: {
  artifact: ContractEntryArtifact | null | undefined
  buildContext?: RouteAuthorityBuildContext | null
  runtimeRoute?: RuntimeRouteArtifact | null
}): RouteAuthoritySourceClassification {
  if (
    params.buildContext?.mode === 'build' &&
    params.artifact &&
    params.buildContext.selectedCandidateArtifact?.id === params.artifact.id &&
    !params.runtimeRoute
  ) {
    return 'candidate_not_authority'
  }
  return 'canonical_authority'
}

function compareRouteToArtifact(params: {
  route: RuntimeRouteArtifact
  artifact: ContractEntryArtifact
  reasonPrefix: string
}): RouteComparisonResult {
  const expectedByRole = new Map(artifactRoleIdentities(params.artifact).map((identity) => [identity.role, identity]))
  const stopsByRole = routeStopByRole(params.route)
  const mismatchReasons: string[] = []

  for (const role of CORE_ROLES) {
    const expected = expectedByRole.get(role)
    const stop = stopsByRole[role]
    if (!expected) {
      mismatchReasons.push(`${params.reasonPrefix}_${role}_missing_artifact_identity`)
      continue
    }
    if (!stop) {
      mismatchReasons.push(`${params.reasonPrefix}_${role}_missing_route_stop`)
      continue
    }

    if (expected.id) {
      const candidateIds = stopStableIdCandidates(stop)
      if (!candidateIds.includes(expected.id)) {
        mismatchReasons.push(`${params.reasonPrefix}_${role}_id_mismatch`)
      }
      continue
    }

    const expectedName = normalizeText(expected.displayName)
    const actualName = normalizeText(stop.displayName)
    if (!expectedName || !actualName || expectedName !== actualName) {
      mismatchReasons.push(`${params.reasonPrefix}_${role}_display_name_mismatch`)
    }
  }

  return {
    matches: mismatchReasons.length === 0,
    mismatchReasons,
  }
}

function compareRoutesByStableIds(params: {
  expected: RuntimeRouteArtifact
  actual: RuntimeRouteArtifact
  reasonPrefix: string
}): RouteComparisonResult {
  const expectedStops = routeStopByRole(params.expected)
  const actualStops = routeStopByRole(params.actual)
  const mismatchReasons: string[] = []

  for (const role of CORE_ROLES) {
    const expectedStop = expectedStops[role]
    const actualStop = actualStops[role]
    if (!expectedStop || !actualStop) {
      mismatchReasons.push(`${params.reasonPrefix}_${role}_missing_route_stop`)
      continue
    }

    const expectedIds = stopStableIdCandidates(expectedStop)
    const actualIds = stopStableIdCandidates(actualStop)
    if (expectedIds.length > 0 && actualIds.length > 0) {
      if (!expectedIds.some((id) => actualIds.includes(id))) {
        mismatchReasons.push(`${params.reasonPrefix}_${role}_id_mismatch`)
      }
      continue
    }

    if (normalizeText(expectedStop.displayName) !== normalizeText(actualStop.displayName)) {
      mismatchReasons.push(`${params.reasonPrefix}_${role}_display_name_mismatch`)
    }
  }

  return {
    matches: mismatchReasons.length === 0,
    mismatchReasons,
  }
}

function buildRouteSource(params: {
  kind: RouteAuthoritySourceKind
  classification: RouteAuthoritySourceClassification
  route?: RuntimeRouteArtifact | null
  artifactId?: string | null
  directionId?: string | null
  mismatchReasons?: string[]
}): RouteAuthorityObservedSource {
  return {
    kind: params.kind,
    classification: params.classification,
    present: Boolean(params.route ?? params.artifactId ?? params.directionId),
    ...(nonEmpty(params.artifactId) ? { artifactId: nonEmpty(params.artifactId) } : {}),
    ...(nonEmpty(params.directionId) ? { directionId: nonEmpty(params.directionId) } : {}),
    routeIds: routeIds(params.route),
    displayNames: routeDisplayNames(params.route),
    mismatchReasons: params.mismatchReasons ?? [],
  }
}

function buildArtifactSource(params: {
  artifact: ContractEntryArtifact | null | undefined
  classification?: RouteAuthoritySourceClassification
  mismatchReasons?: string[]
}): RouteAuthorityObservedSource {
  return {
    kind: 'contract_entry_artifact',
    classification: params.classification ?? 'canonical_authority',
    present: Boolean(params.artifact),
    ...(params.artifact?.id ? { artifactId: params.artifact.id } : {}),
    ...(params.artifact?.selection.directionId ? { directionId: params.artifact.selection.directionId } : {}),
    routeIds: artifactRouteIds(params.artifact),
    displayNames: artifactDisplayNames(params.artifact),
    mismatchReasons: params.mismatchReasons ?? [],
  }
}

function buildAnchorSurvivedInRole(params: {
  route: RuntimeRouteArtifact | null | undefined
  anchorVenueId?: string | null
  requiredRole?: CoreRouteRole | null
}): boolean {
  const anchorVenueId = nonEmpty(params.anchorVenueId)
  const requiredRole = params.requiredRole ?? null
  if (!params.route || !anchorVenueId || !requiredRole) {
    return false
  }
  const stop = routeStopByRole(params.route)[requiredRole]
  if (!stop) {
    return false
  }
  return stopStableIdCandidates(stop).includes(anchorVenueId)
}

function buildRouteAuthorityBuildDiagnostics(params: {
  artifact: ContractEntryArtifact | null
  runtimeRoute: RuntimeRouteArtifact | null
  buildContext: RouteAuthorityBuildContext
}): RouteAuthorityBuildDiagnostics {
  const selectedCandidateArtifact = params.buildContext.selectedCandidateArtifact ?? null
  const selectedCandidateSourceKind = params.buildContext.selectedCandidateSourceKind ?? null
  const routeReplacementAdmitted = params.buildContext.routeReplacementAdmitted === true
  const reasons: RouteAuthorityBuildDiagnosticReason[] = []

  if (
    selectedCandidateArtifact &&
    (!params.artifact || params.artifact.id === selectedCandidateArtifact.id) &&
    !params.runtimeRoute
  ) {
    reasons.push('static_candidate_not_authority')
  }
  if (selectedCandidateSourceKind === 'provider_shadow' || selectedCandidateSourceKind === 'debug_only') {
    reasons.push('provider_shadow_not_authority')
  }
  if (selectedCandidateSourceKind === 'candidate_draft') {
    reasons.push('candidate_draft_not_authority')
  }
  if (!params.artifact || !params.runtimeRoute) {
    reasons.push('generated_contract_entry_missing')
  }

  const anchorRoleSurvived = buildAnchorSurvivedInRole({
    route: params.runtimeRoute,
    anchorVenueId: params.buildContext.selectedAnchorVenueId,
    requiredRole: params.buildContext.selectedAnchorRequiredRole,
  })
  if (anchorRoleSurvived) {
    reasons.push('required_anchor_role_survived')
  } else if (params.buildContext.selectedAnchorVenueId && params.buildContext.selectedAnchorRequiredRole) {
    reasons.push('required_anchor_role_missing')
  }

  let candidateContractPreserved = false
  if (selectedCandidateArtifact && params.runtimeRoute) {
    const comparison = compareRouteToArtifact({
      route: params.runtimeRoute,
      artifact: selectedCandidateArtifact,
      reasonPrefix: 'build_candidate_contract',
    })
    candidateContractPreserved = comparison.matches
    if (comparison.matches) {
      reasons.push('build_candidate_contract_preserved')
    } else {
      reasons.push('build_candidate_contract_drifted', 'generated_route_identity_mismatch')
    }
  }

  const lockBlocked =
    reasons.includes('static_candidate_not_authority') ||
    reasons.includes('generated_contract_entry_missing') ||
    reasons.includes('required_anchor_role_missing') ||
    reasons.includes('provider_shadow_not_authority') ||
    reasons.includes('candidate_draft_not_authority') ||
    (reasons.includes('build_candidate_contract_drifted') && !routeReplacementAdmitted)

  reasons.push(lockBlocked ? 'route_authority_lock_blocked' : 'route_authority_lock_ready')

  return {
    mode: 'build',
    selectedCandidateArtifactId: selectedCandidateArtifact?.id ?? null,
    selectedCandidateSourceKind,
    generatedContractEntryArtifactId: params.artifact?.id ?? null,
    generatedRuntimeRoutePresent: Boolean(params.runtimeRoute),
    selectedAnchorVenueId: params.buildContext.selectedAnchorVenueId ?? null,
    selectedAnchorRequiredRole: params.buildContext.selectedAnchorRequiredRole ?? null,
    anchorRoleSurvived,
    candidateContractPreserved,
    routeReplacementAdmitted,
    reasons: unique(reasons) as RouteAuthorityBuildDiagnosticReason[],
  }
}

function buildDiagnosticsBlockLock(diagnostics: RouteAuthorityBuildDiagnostics | undefined): boolean {
  return Boolean(diagnostics?.reasons.includes('route_authority_lock_blocked'))
}

function selectedRouteRuntimeRoute(
  selectedRouteArtifact: RouteAuthorityLegacySelectedRouteArtifactReference | null | undefined,
): RuntimeRouteArtifact | null {
  return selectedRouteArtifact?.canonicalRouteArtifact?.finalRoute ?? null
}

export function buildRouteAuthoritySnapshot(
  input: BuildRouteAuthoritySnapshotInput,
): RouteAuthoritySnapshot {
  const artifact = input.contractEntryArtifact ?? null
  const runtimeRoute =
    input.runtimeRouteArtifact ?? artifact?.enrichment?.runtimeLockEligibility?.runtimeRouteArtifact ?? null
  const approvedPayloadRoute = input.approvedPayload?.finalRoute ?? null
  const buildRuntimeRoute =
    input.buildContext?.mode === 'build' ? runtimeRoute ?? approvedPayloadRoute : runtimeRoute
  const legacyCurateRoute = input.legacyCurateRefinementEntryPayload?.finalRoute ?? null
  const legacySelectedRoute = selectedRouteRuntimeRoute(input.legacySelectedRouteArtifact)
  const pageLocalFinalRoute = input.pageLocalFinalRoute ?? null
  const selectedDirectionId =
    nonEmpty(input.selectedDirectionId) ??
    nonEmpty(runtimeRoute?.selectedDirectionId) ??
    nonEmpty(artifact?.selection.directionId) ??
    nonEmpty(input.approvedPayload?.selectedDirectionId) ??
    null
  const selectedArtifactId =
    nonEmpty(input.selectedArtifactId) ??
    nonEmpty(artifact?.id) ??
    nonEmpty(input.approvedPayload?.artifactId) ??
    null
  const buildDiagnostics =
    input.buildContext?.mode === 'build'
      ? buildRouteAuthorityBuildDiagnostics({
          artifact,
          runtimeRoute: buildRuntimeRoute,
          buildContext: input.buildContext,
        })
      : undefined

  const mismatchReasons: string[] = []
  const rejectionReasons: string[] = []
  let runtimeMismatchReasons: string[] = []
  let approvedPayloadMismatchReasons: string[] = []
  let legacyCurateMismatchReasons: string[] = []
  let legacySelectedMismatchReasons: string[] = []
  let pageLocalMismatchReasons: string[] = []

  if (artifact) {
    const artifactValidation = validateContractEntryArtifactPreCommitTruth(artifact)
    rejectionReasons.push(...artifactValidation.rejectionReasons)
  }
  if (buildDiagnostics) {
    if (buildDiagnostics.reasons.includes('static_candidate_not_authority')) {
      rejectionReasons.push('static_candidate_not_authority')
    }
    if (buildDiagnostics.reasons.includes('generated_contract_entry_missing')) {
      rejectionReasons.push('generated_contract_entry_missing')
    }
    if (buildDiagnostics.reasons.includes('required_anchor_role_missing')) {
      rejectionReasons.push('required_anchor_role_missing')
    }
    if (
      buildDiagnostics.reasons.includes('generated_route_identity_mismatch') &&
      !buildDiagnostics.routeReplacementAdmitted
    ) {
      rejectionReasons.push('generated_route_identity_mismatch')
    }
    if (buildDiagnostics.reasons.includes('provider_shadow_not_authority')) {
      rejectionReasons.push('provider_shadow_not_authority')
    }
    if (buildDiagnostics.reasons.includes('candidate_draft_not_authority')) {
      rejectionReasons.push('candidate_draft_not_authority')
    }
  }

  if (artifact && runtimeRoute) {
    const comparison = compareRouteToArtifact({
      route: runtimeRoute,
      artifact,
      reasonPrefix: 'runtime_route_artifact',
    })
    runtimeMismatchReasons = comparison.mismatchReasons
    if (!comparison.matches) {
      rejectionReasons.push('runtime_route_artifact_mismatch')
      mismatchReasons.push(...runtimeMismatchReasons)
    }
  }

  const canonicalRuntimeRoute = runtimeRoute
  if (approvedPayloadRoute) {
    const comparison = canonicalRuntimeRoute
      ? compareRoutesByStableIds({
          expected: canonicalRuntimeRoute,
          actual: approvedPayloadRoute,
          reasonPrefix: 'approved_payload',
        })
      : artifact
        ? compareRouteToArtifact({
            route: approvedPayloadRoute,
            artifact,
            reasonPrefix: 'approved_payload',
          })
        : { matches: false, mismatchReasons: ['approved_payload_missing_canonical_authority'] }
    approvedPayloadMismatchReasons = comparison.mismatchReasons
    if (!comparison.matches) {
      rejectionReasons.push('approved_payload_route_mismatch')
      mismatchReasons.push(...approvedPayloadMismatchReasons)
    }
  }

  if (legacyCurateRoute && artifact) {
    legacyCurateMismatchReasons = compareRouteToArtifact({
      route: legacyCurateRoute,
      artifact,
      reasonPrefix: 'legacy_curate_refinement_entry_payload',
    }).mismatchReasons
    mismatchReasons.push(...legacyCurateMismatchReasons)
  }
  if (legacySelectedRoute && artifact) {
    legacySelectedMismatchReasons = compareRouteToArtifact({
      route: legacySelectedRoute,
      artifact,
      reasonPrefix: 'legacy_selected_route_artifact',
    }).mismatchReasons
    mismatchReasons.push(...legacySelectedMismatchReasons)
  }
  if (pageLocalFinalRoute && artifact) {
    pageLocalMismatchReasons = compareRouteToArtifact({
      route: pageLocalFinalRoute,
      artifact,
      reasonPrefix: 'page_local_final_route',
    }).mismatchReasons
    mismatchReasons.push(...pageLocalMismatchReasons)
  }

  const approvedPayloadRouteCanonical =
    Boolean(artifact && approvedPayloadRoute) &&
    approvedPayloadMismatchReasons.length === 0 &&
    !rejectionReasons.includes('approved_payload_route_mismatch')
  const canonicalAuthorityRoute =
    canonicalRuntimeRoute ?? (approvedPayloadRouteCanonical ? approvedPayloadRoute : null)
  const lockInputSource: RouteAuthorityLockReadyCanonicalRouteTruthCandidate['source'] | null =
    canonicalRuntimeRoute && artifact
      ? 'contract_entry_artifact.runtime_route_artifact'
      : canonicalRuntimeRoute
        ? 'runtime_route_artifact'
        : approvedPayloadRouteCanonical
          ? 'contract_entry_artifact.approved_payload'
          : null
  const hasCanonicalAuthority = Boolean(artifact || canonicalRuntimeRoute)
  const canonicalRouteValid =
    Boolean(canonicalAuthorityRoute) &&
    runtimeMismatchReasons.length === 0 &&
    !rejectionReasons.includes('runtime_route_artifact_mismatch') &&
    !rejectionReasons.includes('runtime_lock_ineligible') &&
    !buildDiagnosticsBlockLock(buildDiagnostics) &&
    !hasInvalidArtifactValidationReason(rejectionReasons)
  const lockReadyCanonicalRouteTruthCandidate =
    canonicalAuthorityRoute && canonicalRouteValid && lockInputSource
      ? {
          selectedDirectionId: selectedDirectionId ?? canonicalAuthorityRoute.selectedDirectionId,
          ...(selectedArtifactId ? { selectedArtifactId } : {}),
          source: lockInputSource,
          ...(input.selectedClusterConfirmation
            ? { selectedClusterConfirmation: input.selectedClusterConfirmation }
            : {}),
          ...(input.itinerary ? { itinerary: input.itinerary } : {}),
          finalRoute: canonicalAuthorityRoute,
        }
      : null

  if (!lockReadyCanonicalRouteTruthCandidate) {
    const hasOnlyCompatibilityRoute = Boolean(
      approvedPayloadRoute || legacyCurateRoute || legacySelectedRoute || pageLocalFinalRoute,
    )
    if (hasOnlyCompatibilityRoute && !canonicalAuthorityRoute) {
      rejectionReasons.push('lock_ready_requires_canonical_authority')
    }
    if ((legacyCurateRoute || legacySelectedRoute || pageLocalFinalRoute) && !hasCanonicalAuthority) {
      rejectionReasons.push('legacy_sources_cannot_author_lock_ready_truth')
    }
  }

  const observedSources: RouteAuthorityObservedSource[] = [
    buildArtifactSource({
      artifact,
      classification: sourceClassificationForArtifact({
        artifact,
        buildContext: input.buildContext,
        runtimeRoute: buildRuntimeRoute,
      }),
    }),
    buildRouteSource({
      kind: 'runtime_route_artifact',
      classification: 'canonical_authority',
      route: runtimeRoute,
      directionId: runtimeRoute?.selectedDirectionId,
      mismatchReasons: runtimeMismatchReasons,
    }),
    buildRouteSource({
      kind: 'approved_payload',
      classification: 'validated_compatibility',
      route: approvedPayloadRoute,
      artifactId: input.approvedPayload?.artifactId,
      directionId: input.approvedPayload?.selectedDirectionId,
      mismatchReasons: approvedPayloadMismatchReasons,
    }),
    buildRouteSource({
      kind: 'legacy_curate_refinement_entry_payload',
      classification: 'legacy_compatibility',
      route: legacyCurateRoute,
      artifactId: input.legacyCurateRefinementEntryPayload?.artifactId,
      directionId: input.legacyCurateRefinementEntryPayload?.selectedDirectionId,
      mismatchReasons: legacyCurateMismatchReasons,
    }),
    buildRouteSource({
      kind: 'legacy_selected_route_artifact',
      classification: 'legacy_compatibility',
      route: legacySelectedRoute,
      artifactId: input.legacySelectedRouteArtifact?.candidateArtifactId,
      directionId: input.legacySelectedRouteArtifact?.directionId,
      mismatchReasons: legacySelectedMismatchReasons,
    }),
    buildRouteSource({
      kind: 'page_local_final_route',
      classification: 'page_local_authoring',
      route: pageLocalFinalRoute,
      directionId: pageLocalFinalRoute?.selectedDirectionId,
      mismatchReasons: pageLocalMismatchReasons,
    }),
  ]

  const presentSources = observedSources.filter((source) => source.present)
  const canonicalRouteIds = firstNonEmpty([
    routeIds(lockReadyCanonicalRouteTruthCandidate?.finalRoute),
    routeIds(runtimeRoute),
    artifactRouteIds(artifact),
    routeIds(approvedPayloadRoute),
    routeIds(legacyCurateRoute),
    routeIds(legacySelectedRoute),
    routeIds(pageLocalFinalRoute),
  ])
  const validationStatus: RouteAuthorityValidationStatus =
    presentSources.length === 0
      ? 'missing'
      : rejectionReasons.includes('approved_payload_route_mismatch') ||
          rejectionReasons.includes('runtime_route_artifact_mismatch') ||
          rejectionReasons.includes('generated_route_identity_mismatch') ||
          rejectionReasons.includes('required_anchor_role_missing')
        ? 'invalid'
        : lockReadyCanonicalRouteTruthCandidate
          ? 'valid'
          : 'warning'
  const sourceLabel = lockReadyCanonicalRouteTruthCandidate
    ? lockReadyCanonicalRouteTruthCandidate.source
    : presentSources.length > 0
      ? presentSources.map((source) => source.kind).join('.')
      : 'missing_authority'

  return {
    selectedContractEntryArtifact: artifact,
    selectedDirectionId,
    selectedArtifactId,
    approvedPayloadRoute,
    canonicalRouteIds,
    lockReadyCanonicalRouteTruthCandidate,
    sourceLabel,
    validationStatus,
    mismatchReasons,
    rejectionReasons: unique(rejectionReasons),
    observedSources,
    ...(buildDiagnostics ? { buildDiagnostics } : {}),
  }
}

function getNonEmptyImageUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function buildLockSafeItineraryStops(params: {
  itinerary: Itinerary
  finalRoute: RuntimeRouteArtifact
}): ItineraryStop[] {
  const stopBySourceId = new Map(params.itinerary.stops.map((stop) => [stop.id, stop] as const))
  const stopByIndex = new Map(params.itinerary.stops.map((stop, index) => [index, stop] as const))
  const finalRouteStopByRole = new Map(
    params.finalRoute.stops.map((stop) => [stop.role, stop] as const),
  )
  const itineraryStopByRole = new Map(
    params.itinerary.stops.map((stop) => [stop.role, stop] as const),
  )
  const sharedFallbackImageUrl =
    getNonEmptyImageUrl(finalRouteStopByRole.get('highlight')?.imageUrl) ??
    getNonEmptyImageUrl(itineraryStopByRole.get('highlight')?.imageUrl) ??
    getNonEmptyImageUrl(finalRouteStopByRole.get('start')?.imageUrl) ??
    getNonEmptyImageUrl(itineraryStopByRole.get('start')?.imageUrl) ??
    getNonEmptyImageUrl(finalRouteStopByRole.get('windDown')?.imageUrl) ??
    getNonEmptyImageUrl(itineraryStopByRole.get('windDown')?.imageUrl) ??
    getNonEmptyImageUrl(
      params.finalRoute.stops.find((stop) => getNonEmptyImageUrl(stop.imageUrl))?.imageUrl,
    ) ??
    getNonEmptyImageUrl(
      params.itinerary.stops.find((stop) => getNonEmptyImageUrl(stop.imageUrl))?.imageUrl,
    ) ??
    ''

  return [...params.finalRoute.stops]
    .filter((stop) => isRuntimeRouteItineraryRole(stop.role))
    .sort((left, right) => left.stopIndex - right.stopIndex)
    .map((finalStop) => {
      const sourceStop =
        stopBySourceId.get(finalStop.sourceStopId) ??
        stopByIndex.get(finalStop.stopIndex) ??
        params.itinerary.stops.find(
          (stop) => stop.role === finalStop.role && stop.venueId === finalStop.venueId,
        ) ??
        params.itinerary.stops.find((stop) => stop.role === finalStop.role)
      if (!sourceStop) {
        return null
      }
      const resolvedImageUrl =
        getNonEmptyImageUrl(sourceStop.imageUrl) ??
        getNonEmptyImageUrl(finalStop.imageUrl) ??
        sharedFallbackImageUrl
      return {
        ...sourceStop,
        id: finalStop.sourceStopId,
        role: finalStop.role,
        venueId: finalStop.venueId,
        venueName: finalStop.displayName || sourceStop.venueName,
        neighborhood: finalStop.neighborhood || sourceStop.neighborhood,
        driveMinutes:
          Number.isFinite(finalStop.driveMinutes) && finalStop.driveMinutes >= 0
            ? finalStop.driveMinutes
            : sourceStop.driveMinutes,
        imageUrl: resolvedImageUrl,
      }
    })
    .filter((stop): stop is ItineraryStop => Boolean(stop))
}

function buildLockInputDiagnostics(params: {
  snapshot: RouteAuthoritySnapshot
  rejectionReason: string | null
}): RouteAuthorityLockInputDiagnostics {
  const legacySources = params.snapshot.observedSources.filter(
    (source) =>
      source.kind === 'legacy_curate_refinement_entry_payload' ||
      source.kind === 'legacy_selected_route_artifact' ||
      source.kind === 'page_local_final_route',
  )
  const presentLegacySources = legacySources.filter((source) => source.present)
  const legacyInputsObserved = presentLegacySources.length > 0
  const legacyInputsMatchedCanonicalTruth = legacyInputsObserved
    ? presentLegacySources.every((source) => source.mismatchReasons.length === 0)
    : null

  return {
    lockInputSource: params.snapshot.lockReadyCanonicalRouteTruthCandidate?.source ?? null,
    canonicalRouteIds: params.snapshot.canonicalRouteIds,
    legacyInputsObserved,
    legacyInputsMatchedCanonicalTruth,
    builtFromCanonicalAuthority: Boolean(params.snapshot.lockReadyCanonicalRouteTruthCandidate),
    rejectionReason: params.rejectionReason,
  }
}

export function buildLockInputFromRouteAuthoritySnapshot(params: {
  snapshot: RouteAuthoritySnapshot
  activeRole: UserStopRole
  fallbackCity: string
}): RouteAuthorityLockInputResult {
  const candidate = params.snapshot.lockReadyCanonicalRouteTruthCandidate
  if (!candidate) {
    const rejectionReason =
      params.snapshot.rejectionReasons[0] ??
      (params.snapshot.validationStatus === 'missing'
        ? 'missing_route_authority'
        : 'missing_lock_ready_canonical_route_truth')
    return {
      ok: false,
      input: null,
      diagnostics: buildLockInputDiagnostics({
        snapshot: params.snapshot,
        rejectionReason,
      }),
    }
  }
  if (!candidate.itinerary) {
    return {
      ok: false,
      input: null,
      diagnostics: buildLockInputDiagnostics({
        snapshot: params.snapshot,
        rejectionReason: 'missing_lock_ready_itinerary',
      }),
    }
  }
  if (!candidate.selectedClusterConfirmation?.trim()) {
    return {
      ok: false,
      input: null,
      diagnostics: buildLockInputDiagnostics({
        snapshot: params.snapshot,
        rejectionReason: 'missing_selected_cluster_confirmation',
      }),
    }
  }
  if (!coreRouteIdsMatch(routeIds(candidate.finalRoute), params.snapshot.canonicalRouteIds)) {
    return {
      ok: false,
      input: null,
      diagnostics: buildLockInputDiagnostics({
        snapshot: params.snapshot,
        rejectionReason: 'lock_input_canonical_route_ids_mismatch',
      }),
    }
  }

  return {
    ok: true,
    input: {
      canonicalRouteArtifact: {
        selectedClusterConfirmation: candidate.selectedClusterConfirmation,
        itinerary: candidate.itinerary,
        finalRoute: candidate.finalRoute,
      },
      lockSafeItineraryStops: buildLockSafeItineraryStops({
        itinerary: candidate.itinerary,
        finalRoute: candidate.finalRoute,
      }),
      activeRole: params.activeRole,
      fallbackCity: params.fallbackCity,
    },
    diagnostics: buildLockInputDiagnostics({
      snapshot: params.snapshot,
      rejectionReason: null,
    }),
  }
}
