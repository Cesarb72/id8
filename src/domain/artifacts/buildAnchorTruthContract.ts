import type { ContractEntryArtifact } from './contractEntryArtifact'
import type { RuntimeRouteArtifact } from './runtimeRouteArtifact'
import type { AnchorRole } from '../types/intent'
import type { Itinerary, UserStopRole } from '../types/itinerary'
import type { Venue } from '../types/venue'

export type BuildAnchorCanonicalRole = Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>

export type BuildAnchorRoleResolutionSource =
  | 'explicit'
  | 'inferred'
  | 'defaulted_highlight'
  | 'missing'

export type BuildAnchorTruthFailureReason =
  | 'anchor_role_missing'
  | 'anchor_role_defaulted_highlight'
  | 'anchor_role_ambiguous'
  | 'anchor_identity_missing'
  | 'anchor_not_in_required_role'
  | 'anchor_only_support_stop'
  | 'anchor_canonical_id_mismatch'
  | 'anchor_provider_id_only'
  | 'anchor_preservation_failed'

export type BuildAnchorTruthStatus = 'valid' | 'warning' | 'invalid'

export interface BuildAnchorTruthContract {
  canonicalVenueId: string
  sourceVenueId?: string
  providerRecordId?: string
  requiredRole: BuildAnchorCanonicalRole
  displayName?: string
  sourceOrigin?: Venue['source']['sourceOrigin']
  provider?: Venue['source']['provider']
  coordinates?: {
    latitude: number
    longitude: number
  }
  roleResolutionSource: BuildAnchorRoleResolutionSource
  diagnostics: {
    status: BuildAnchorTruthStatus
    reasons: BuildAnchorTruthFailureReason[]
  }
}

export interface BuildAnchorIdentityInput {
  venueId?: string | null
  sourceVenueId?: string | null
  providerRecordId?: string | null
  displayName?: string | null
  sourceOrigin?: Venue['source']['sourceOrigin']
  provider?: Venue['source']['provider']
  latitude?: number | null
  longitude?: number | null
}

export interface BuildAnchorRoleInput {
  role?: string | null
  roleResolutionSource?: BuildAnchorRoleResolutionSource
}

export interface BuildAnchorTruthValidationResult {
  status: BuildAnchorTruthStatus
  preserved: boolean
  requiredRole: BuildAnchorCanonicalRole
  canonicalVenueId: string
  observedRole?: UserStopRole | string
  observedVenueId?: string
  reasons: BuildAnchorTruthFailureReason[]
}

function nonEmpty(value: string | null | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

export function isBuildAnchorCanonicalRole(
  role: string | null | undefined,
): role is BuildAnchorCanonicalRole {
  return role === 'start' || role === 'highlight' || role === 'windDown'
}

export function resolveBuildAnchorRole(params: BuildAnchorRoleInput): {
  role: BuildAnchorCanonicalRole
  roleResolutionSource: BuildAnchorRoleResolutionSource
  reasons: BuildAnchorTruthFailureReason[]
} {
  if (isBuildAnchorCanonicalRole(params.role)) {
    return {
      role: params.role,
      roleResolutionSource: params.roleResolutionSource ?? 'explicit',
      reasons: [],
    }
  }

  if (params.role && params.role.trim()) {
    return {
      role: 'highlight',
      roleResolutionSource: 'defaulted_highlight',
      reasons: ['anchor_role_ambiguous', 'anchor_role_defaulted_highlight'],
    }
  }

  return {
    role: 'highlight',
    roleResolutionSource: 'defaulted_highlight',
    reasons: ['anchor_role_missing', 'anchor_role_defaulted_highlight'],
  }
}

export function buildAnchorTruthContract(params: {
  identity: BuildAnchorIdentityInput
  role: BuildAnchorRoleInput
}): BuildAnchorTruthContract {
  const canonicalVenueId = nonEmpty(params.identity.venueId)
  const roleResolution = resolveBuildAnchorRole(params.role)
  const reasons = [...roleResolution.reasons]

  if (!canonicalVenueId) {
    reasons.push('anchor_identity_missing')
  }

  const latitude =
    typeof params.identity.latitude === 'number' ? params.identity.latitude : undefined
  const longitude =
    typeof params.identity.longitude === 'number' ? params.identity.longitude : undefined
  const status: BuildAnchorTruthStatus = reasons.includes('anchor_identity_missing')
    ? 'invalid'
    : reasons.length > 0
      ? 'warning'
      : 'valid'

  return {
    canonicalVenueId: canonicalVenueId ?? '',
    ...(nonEmpty(params.identity.sourceVenueId)
      ? { sourceVenueId: nonEmpty(params.identity.sourceVenueId) }
      : {}),
    ...(nonEmpty(params.identity.providerRecordId)
      ? { providerRecordId: nonEmpty(params.identity.providerRecordId) }
      : {}),
    requiredRole: roleResolution.role,
    ...(nonEmpty(params.identity.displayName)
      ? { displayName: nonEmpty(params.identity.displayName) }
      : {}),
    ...(params.identity.sourceOrigin ? { sourceOrigin: params.identity.sourceOrigin } : {}),
    ...(params.identity.provider ? { provider: params.identity.provider } : {}),
    ...(latitude !== undefined && longitude !== undefined
      ? { coordinates: { latitude, longitude } }
      : {}),
    roleResolutionSource: roleResolution.roleResolutionSource,
    diagnostics: {
      status,
      reasons,
    },
  }
}

function statusFromReasons(reasons: BuildAnchorTruthFailureReason[]): BuildAnchorTruthStatus {
  if (reasons.length === 0) {
    return 'valid'
  }
  if (
    reasons.every(
      (reason) =>
        reason === 'anchor_role_missing' || reason === 'anchor_role_defaulted_highlight',
    )
  ) {
    return 'warning'
  }
  return 'invalid'
}

export function validateContractEntryArtifactBuildAnchor(
  contract: BuildAnchorTruthContract,
  artifact: ContractEntryArtifact | null | undefined,
): BuildAnchorTruthValidationResult {
  const reasons = [...contract.diagnostics.reasons]
  if (!contract.canonicalVenueId) {
    reasons.push('anchor_identity_missing')
  }
  if (!artifact) {
    reasons.push('anchor_preservation_failed')
    return {
      status: 'invalid',
      preserved: false,
      requiredRole: contract.requiredRole,
      canonicalVenueId: contract.canonicalVenueId,
      reasons,
    }
  }

  const artifactRoleResolution = resolveBuildAnchorRole({
    role: artifact.anchorRole,
    roleResolutionSource: artifact.anchorRole ? 'inferred' : 'defaulted_highlight',
  })
  const observedRole = artifactRoleResolution.role
  reasons.push(...artifactRoleResolution.reasons)

  if (!artifact.anchorVenueId) {
    reasons.push('anchor_identity_missing')
  } else if (artifact.anchorVenueId === contract.providerRecordId && artifact.anchorVenueId !== contract.canonicalVenueId) {
    reasons.push('anchor_provider_id_only')
  } else if (artifact.anchorVenueId !== contract.canonicalVenueId) {
    reasons.push('anchor_canonical_id_mismatch')
  }

  if (observedRole !== contract.requiredRole) {
    reasons.push('anchor_not_in_required_role')
  }

  const status = statusFromReasons(reasons)
  return {
    status,
    preserved: status !== 'invalid',
    requiredRole: contract.requiredRole,
    canonicalVenueId: contract.canonicalVenueId,
    observedRole,
    observedVenueId: artifact.anchorVenueId,
    reasons,
  }
}

export function validateRuntimeRouteBuildAnchor(
  contract: BuildAnchorTruthContract,
  route: RuntimeRouteArtifact | null | undefined,
): BuildAnchorTruthValidationResult {
  const reasons = [...contract.diagnostics.reasons]
  if (!contract.canonicalVenueId) {
    reasons.push('anchor_identity_missing')
  }
  if (!route) {
    reasons.push('anchor_preservation_failed')
    return {
      status: 'invalid',
      preserved: false,
      requiredRole: contract.requiredRole,
      canonicalVenueId: contract.canonicalVenueId,
      reasons,
    }
  }

  const exactRoleStop = route.stops.find(
    (stop) => stop.role === contract.requiredRole && stop.venueId === contract.canonicalVenueId,
  )
  const wrongRoleStop = route.stops.find(
    (stop) => stop.role !== contract.requiredRole && stop.venueId === contract.canonicalVenueId,
  )
  const providerOnlyStop = contract.providerRecordId
    ? route.stops.find(
        (stop) =>
          stop.providerRecordId === contract.providerRecordId &&
          stop.venueId !== contract.canonicalVenueId,
      )
    : undefined

  if (!exactRoleStop) {
    if (wrongRoleStop) {
      if (isBuildAnchorCanonicalRole(wrongRoleStop.role)) {
        reasons.push('anchor_not_in_required_role')
      } else {
        reasons.push('anchor_only_support_stop')
      }
    } else if (providerOnlyStop) {
      reasons.push('anchor_provider_id_only')
    } else {
      reasons.push('anchor_preservation_failed')
    }
  }

  const status = statusFromReasons(reasons)
  return {
    status,
    preserved: status !== 'invalid',
    requiredRole: contract.requiredRole,
    canonicalVenueId: contract.canonicalVenueId,
    observedRole: exactRoleStop?.role ?? wrongRoleStop?.role ?? providerOnlyStop?.role,
    observedVenueId: exactRoleStop?.venueId ?? wrongRoleStop?.venueId ?? providerOnlyStop?.venueId,
    reasons,
  }
}

export function validateItineraryBuildAnchor(
  contract: BuildAnchorTruthContract,
  itinerary: Itinerary | null | undefined,
): BuildAnchorTruthValidationResult {
  const reasons = [...contract.diagnostics.reasons]
  if (!contract.canonicalVenueId) {
    reasons.push('anchor_identity_missing')
  }
  if (!itinerary) {
    reasons.push('anchor_preservation_failed')
    return {
      status: 'invalid',
      preserved: false,
      requiredRole: contract.requiredRole,
      canonicalVenueId: contract.canonicalVenueId,
      reasons,
    }
  }

  const exactRoleStop = itinerary.stops.find(
    (stop) => stop.role === contract.requiredRole && stop.venueId === contract.canonicalVenueId,
  )
  const wrongRoleStop = itinerary.stops.find(
    (stop) => stop.role !== contract.requiredRole && stop.venueId === contract.canonicalVenueId,
  )

  if (!exactRoleStop) {
    reasons.push(
      wrongRoleStop
        ? isBuildAnchorCanonicalRole(wrongRoleStop.role)
          ? 'anchor_not_in_required_role'
          : 'anchor_only_support_stop'
        : 'anchor_preservation_failed',
    )
  }

  const status = statusFromReasons(reasons)
  return {
    status,
    preserved: status !== 'invalid',
    requiredRole: contract.requiredRole,
    canonicalVenueId: contract.canonicalVenueId,
    observedRole: exactRoleStop?.role ?? wrongRoleStop?.role,
    observedVenueId: exactRoleStop?.venueId ?? wrongRoleStop?.venueId,
    reasons,
  }
}

export function buildAnchorTruthContractFromVenue(params: {
  venue: Venue
  role?: AnchorRole | string | null
  roleResolutionSource?: BuildAnchorRoleResolutionSource
  sourceVenueId?: string | null
}): BuildAnchorTruthContract {
  return buildAnchorTruthContract({
    identity: {
      venueId: params.venue.id,
      sourceVenueId: params.sourceVenueId,
      providerRecordId: params.venue.source.providerRecordId,
      displayName: params.venue.name,
      sourceOrigin: params.venue.source.sourceOrigin,
      provider: params.venue.source.provider,
      latitude: params.venue.source.latitude,
      longitude: params.venue.source.longitude,
    },
    role: {
      role: params.role,
      roleResolutionSource: params.roleResolutionSource,
    },
  })
}
