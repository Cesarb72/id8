import {
  deriveContractEntryArtifactRoleCoverage,
  validateContractEntryArtifactPreCommitTruth,
  type ContractEntryArtifact,
} from '../../../domain/artifacts/contractEntryArtifact'
import type { RuntimeRouteArtifact, RuntimeRouteStop } from '../../../domain/artifacts/runtimeRouteArtifact'
import type { Itinerary } from '../../../domain/types/itinerary'

type CoreRouteRole = 'start' | 'highlight' | 'windDown'

export type RouteAuthoritySourceKind =
  | 'contract_entry_artifact'
  | 'runtime_route_artifact'
  | 'approved_payload'
  | 'legacy_curate_refinement_entry_payload'
  | 'legacy_selected_route_artifact'
  | 'page_local_final_route'

export type RouteAuthoritySourceClassification =
  | 'canonical_authority'
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
  selectedClusterConfirmation?: string
  itinerary?: Itinerary
  finalRoute: RuntimeRouteArtifact
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
  mismatchReasons?: string[]
}): RouteAuthorityObservedSource {
  return {
    kind: 'contract_entry_artifact',
    classification: 'canonical_authority',
    present: Boolean(params.artifact),
    ...(params.artifact?.id ? { artifactId: params.artifact.id } : {}),
    ...(params.artifact?.selection.directionId ? { directionId: params.artifact.selection.directionId } : {}),
    routeIds: artifactRouteIds(params.artifact),
    displayNames: artifactDisplayNames(params.artifact),
    mismatchReasons: params.mismatchReasons ?? [],
  }
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

  const hasCanonicalAuthority = Boolean(artifact || canonicalRuntimeRoute)
  const canonicalRouteValid =
    Boolean(canonicalRuntimeRoute) &&
    runtimeMismatchReasons.length === 0 &&
    !rejectionReasons.includes('runtime_route_artifact_mismatch') &&
    !rejectionReasons.includes('runtime_lock_ineligible') &&
    !rejectionReasons.includes('artifact_validation_rejected')
  const lockReadyCanonicalRouteTruthCandidate =
    canonicalRuntimeRoute && canonicalRouteValid
      ? {
          selectedDirectionId: selectedDirectionId ?? canonicalRuntimeRoute.selectedDirectionId,
          ...(input.selectedClusterConfirmation
            ? { selectedClusterConfirmation: input.selectedClusterConfirmation }
            : {}),
          ...(input.itinerary ? { itinerary: input.itinerary } : {}),
          finalRoute: canonicalRuntimeRoute,
        }
      : null

  if (!lockReadyCanonicalRouteTruthCandidate) {
    const hasOnlyCompatibilityRoute = Boolean(
      approvedPayloadRoute || legacyCurateRoute || legacySelectedRoute || pageLocalFinalRoute,
    )
    if (hasOnlyCompatibilityRoute && !canonicalRuntimeRoute) {
      rejectionReasons.push('lock_ready_requires_canonical_authority')
    }
    if ((legacyCurateRoute || legacySelectedRoute || pageLocalFinalRoute) && !hasCanonicalAuthority) {
      rejectionReasons.push('legacy_sources_cannot_author_lock_ready_truth')
    }
  }

  const observedSources: RouteAuthorityObservedSource[] = [
    buildArtifactSource({ artifact }),
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
          rejectionReasons.includes('runtime_route_artifact_mismatch')
        ? 'invalid'
        : lockReadyCanonicalRouteTruthCandidate
          ? 'valid'
          : 'warning'
  const sourceLabel = lockReadyCanonicalRouteTruthCandidate
    ? artifact
      ? 'contract_entry_artifact.runtime_route_artifact'
      : 'runtime_route_artifact'
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
  }
}
