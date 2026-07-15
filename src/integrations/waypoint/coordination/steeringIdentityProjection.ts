import type { RuntimeRouteStop } from '../../../domain/artifacts/runtimeRouteArtifact'
import type { ScoredVenue } from '../../../domain/types/arc'
import type { VenueSourceOrigin } from '../../../domain/types/sourceMode'
import type {
  SteeringRefusalReason,
  SteeringStopIdentity,
} from './steeringPrelockProposal'

export interface SteeringIdentityCoordinates {
  lat: number
  lng: number
}

export interface SteeringIdentityProjectionInput {
  baseVenueId?: string | null
  venueId?: string | null
  displayName?: string | null
  providerRecordId?: string | null
  sourceOrigin?: VenueSourceOrigin | string | null
  sourceProvenance?: string | null
  coordinates?: SteeringIdentityCoordinates | null
  latitude?: number | null
  longitude?: number | null
  formattedAddress?: string | null
  address?: string | null
  neighborhood?: string | null
  candidateId?: string | null
}

export interface SteeringIdentityProjectionRefusal {
  status: 'refused'
  identity: SteeringStopIdentity
  refusalReason: SteeringRefusalReason
}

export interface SteeringIdentityProjectionSuccess {
  status: 'projected'
  identity: SteeringStopIdentity
  refusalReason?: never
}

export type SteeringIdentityProjectionResult =
  | SteeringIdentityProjectionRefusal
  | SteeringIdentityProjectionSuccess

function nonEmpty(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function isProviderRecordId(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLowerCase()
  return Boolean(
    normalized &&
      (normalized.startsWith('live_google_') ||
        normalized.startsWith('google_') ||
        normalized.startsWith('google-') ||
        normalized.startsWith('provider:')),
  )
}

function projectCoordinates(
  input: Pick<SteeringIdentityProjectionInput, 'coordinates' | 'latitude' | 'longitude'>,
): { latitude?: number; longitude?: number } {
  const latitude =
    typeof input.coordinates?.lat === 'number'
      ? input.coordinates.lat
      : typeof input.latitude === 'number'
        ? input.latitude
        : undefined
  const longitude =
    typeof input.coordinates?.lng === 'number'
      ? input.coordinates.lng
      : typeof input.longitude === 'number'
        ? input.longitude
        : undefined
  return {
    ...(typeof latitude === 'number' && Number.isFinite(latitude)
      ? { latitude }
      : {}),
    ...(typeof longitude === 'number' && Number.isFinite(longitude)
      ? { longitude }
      : {}),
  }
}

function buildIdentityRefusalReason(
  missingIdentityReasons: readonly string[],
): SteeringRefusalReason {
  return {
    source: 'waypoint',
    refusalClass: 'identity_provenance_missing',
    userFacingCapable: true,
    messageKey: 'steering.identity.insufficient_field_identity',
    ownerEvidenceNeeded: ['field'],
    ownerReasons: missingIdentityReasons,
  }
}

export function projectSteeringStopIdentity(
  input: SteeringIdentityProjectionInput,
): SteeringIdentityProjectionResult {
  const providedBaseVenueId = nonEmpty(input.baseVenueId)
  const baseVenueId =
    providedBaseVenueId && !isProviderRecordId(providedBaseVenueId)
      ? providedBaseVenueId
      : undefined
  const providerRecordId = nonEmpty(input.providerRecordId)
  const displayName = nonEmpty(input.displayName) ?? 'Unknown stop'
  const missingIdentityReasons: string[] = []

  if (!providedBaseVenueId) {
    missingIdentityReasons.push('missing_baseVenueId')
  } else if (!baseVenueId) {
    missingIdentityReasons.push('baseVenueId_looks_like_provider_id')
  }

  if (!displayName) {
    missingIdentityReasons.push('missing_displayName')
  }

  if (!baseVenueId && providerRecordId && isProviderRecordId(providerRecordId)) {
    missingIdentityReasons.push('providerRecordId_not_route_logic_identity')
  }

  const identity: SteeringStopIdentity = {
    source: 'field',
    ...(baseVenueId ? { baseVenueId } : {}),
    ...(nonEmpty(input.venueId) ? { venueId: nonEmpty(input.venueId) } : {}),
    displayName,
    ...(providerRecordId ? { providerRecordId } : {}),
    ...(nonEmpty(input.sourceOrigin) ? { sourceOrigin: nonEmpty(input.sourceOrigin) } : {}),
    ...(nonEmpty(input.sourceProvenance)
      ? { sourceProvenance: nonEmpty(input.sourceProvenance) }
      : {}),
    ...projectCoordinates(input),
    ...(nonEmpty(input.formattedAddress) ?? nonEmpty(input.address)
      ? { formattedAddress: nonEmpty(input.formattedAddress) ?? nonEmpty(input.address) }
      : {}),
    ...(nonEmpty(input.neighborhood) ? { neighborhood: nonEmpty(input.neighborhood) } : {}),
    ...(nonEmpty(input.candidateId) ? { candidateId: nonEmpty(input.candidateId) } : {}),
    identityStatus: baseVenueId ? 'resolved' : 'missing',
    ...(missingIdentityReasons.length > 0 ? { missingIdentityReasons } : {}),
  }

  if (!baseVenueId) {
    return {
      status: 'refused',
      identity,
      refusalReason: buildIdentityRefusalReason(missingIdentityReasons),
    }
  }

  return {
    status: 'projected',
    identity,
  }
}

export function projectSteeringIdentityFromScoredVenue(
  candidate: ScoredVenue,
): SteeringIdentityProjectionResult {
  return projectSteeringStopIdentity({
    baseVenueId: candidate.candidateIdentity.baseVenueId,
    venueId: candidate.candidateIdentity.baseVenueId,
    displayName: candidate.venue.name,
    providerRecordId: candidate.venue.source.providerRecordId,
    sourceOrigin: candidate.venue.source.sourceOrigin,
    sourceProvenance: candidate.venue.source.provider
      ? `field:${candidate.venue.source.provider}`
      : `field:${candidate.venue.source.sourceOrigin}`,
    latitude: candidate.venue.source.latitude,
    longitude: candidate.venue.source.longitude,
    formattedAddress: candidate.venue.source.formattedAddress,
    neighborhood: candidate.venue.neighborhood,
    candidateId: candidate.candidateIdentity.candidateId,
  })
}

export function projectSteeringIdentityFromRuntimeStop(
  stop: RuntimeRouteStop,
  options: {
    baseVenueId?: string | null
    sourceOrigin?: VenueSourceOrigin | string | null
    sourceProvenance?: string | null
    candidateId?: string | null
  } = {},
): SteeringIdentityProjectionResult {
  return projectSteeringStopIdentity({
    baseVenueId: options.baseVenueId ?? stop.venueId,
    venueId: stop.venueId,
    displayName: stop.displayName,
    providerRecordId: stop.providerRecordId,
    sourceOrigin: options.sourceOrigin,
    sourceProvenance: options.sourceProvenance,
    latitude: stop.latitude,
    longitude: stop.longitude,
    formattedAddress: stop.address,
    neighborhood: stop.neighborhood,
    candidateId: options.candidateId,
  })
}
