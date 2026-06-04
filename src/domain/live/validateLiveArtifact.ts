import type {
  LiveArtifactSessionPayload,
} from './liveArtifactSession'
import type {
  RuntimeRouteArtifact,
  RuntimeRouteMarker,
  RuntimeRouteStop,
} from '../artifacts/runtimeRouteArtifact'
import type { PersonaMode, VibeAnchor } from '../types/intent'
import type { Itinerary, ItineraryStop, UserStopRole } from '../types/itinerary'
import {
  getProviderRecordIdFromLiveGoogleVenueId,
} from '../providers/admitLiveVenueIdentity'

export type LiveArtifactRouteErrorCode =
  | 'invalid_payload_shape'
  | 'missing_final_route'
  | 'invalid_final_route_shape'
  | 'final_route_itinerary_mismatch'

export interface LiveArtifactRouteError {
  code: LiveArtifactRouteErrorCode
  detail: string
}

export type LockedLiveArtifactValidationResult =
  | {
      ok: true
      payload: LiveArtifactSessionPayload
    }
  | {
      ok: false
      error: LiveArtifactRouteError
    }

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNonNegativeInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0
}

function isPersonaMode(value: unknown): value is PersonaMode {
  return value === 'romantic' || value === 'friends' || value === 'family'
}

function isVibeAnchor(value: unknown): value is VibeAnchor {
  return (
    value === 'cozy' ||
    value === 'lively' ||
    value === 'playful' ||
    value === 'cultured' ||
    value === 'chill' ||
    value === 'adventurous-outdoor' ||
    value === 'adventurous-urban'
  )
}

function isValidRole(value: unknown): value is UserStopRole {
  return value === 'start' || value === 'highlight' || value === 'surprise' || value === 'windDown'
}

function describeStopFieldState(input: {
  label: string
  value: unknown
  kind: 'string' | 'number' | 'role'
}): string | null {
  const { label, value, kind } = input
  if (value === undefined) {
    return `${label}:missing`
  }
  if (value === null) {
    return `${label}:wrong_type:null`
  }
  if (kind === 'string') {
    if (typeof value !== 'string') {
      return `${label}:wrong_type:${typeof value}`
    }
    if (value.trim().length === 0) {
      return `${label}:empty_string`
    }
    return null
  }
  if (kind === 'number') {
    if (typeof value !== 'number') {
      return `${label}:wrong_type:${typeof value}`
    }
    if (!Number.isFinite(value)) {
      return `${label}:invalid_number`
    }
    return null
  }
  if (typeof value !== 'string') {
    return `${label}:wrong_type:${typeof value}`
  }
  if (value.trim().length === 0) {
    return `${label}:empty_string`
  }
  if (!isValidRole(value)) {
    return `${label}:invalid_role`
  }
  return null
}

function describeItineraryStopShapeIssues(
  value: unknown,
  stopLabel: string,
): string[] {
  if (!isObject(value)) {
    return [`${stopLabel}:wrong_type:${value === null ? 'null' : typeof value}`]
  }
  return [
    describeStopFieldState({ label: `${stopLabel}.id`, value: value.id, kind: 'string' }),
    describeStopFieldState({ label: `${stopLabel}.role`, value: value.role, kind: 'role' }),
    describeStopFieldState({ label: `${stopLabel}.venueId`, value: value.venueId, kind: 'string' }),
    describeStopFieldState({
      label: `${stopLabel}.venueName`,
      value: value.venueName,
      kind: 'string',
    }),
    describeStopFieldState({ label: `${stopLabel}.city`, value: value.city, kind: 'string' }),
    describeStopFieldState({
      label: `${stopLabel}.neighborhood`,
      value: value.neighborhood,
      kind: 'string',
    }),
    describeStopFieldState({
      label: `${stopLabel}.driveMinutes`,
      value: value.driveMinutes,
      kind: 'number',
    }),
    describeStopFieldState({ label: `${stopLabel}.title`, value: value.title, kind: 'string' }),
    describeStopFieldState({
      label: `${stopLabel}.subtitle`,
      value: value.subtitle,
      kind: 'string',
    }),
    describeStopFieldState({
      label: `${stopLabel}.imageUrl`,
      value: value.imageUrl,
      kind: 'string',
    }),
  ].filter((entry): entry is string => Boolean(entry))
}

function isItineraryStopShape(value: unknown): value is ItineraryStop {
  if (!isObject(value)) {
    return false
  }
  return (
    isNonEmptyString(value.id) &&
    isValidRole(value.role) &&
    isNonEmptyString(value.venueId) &&
    isNonEmptyString(value.venueName) &&
    isNonEmptyString(value.city) &&
    isNonEmptyString(value.neighborhood) &&
    isFiniteNumber(value.driveMinutes) &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.subtitle) &&
    isNonEmptyString(value.imageUrl)
  )
}

function isItineraryShape(value: unknown): value is Itinerary {
  if (!isObject(value)) {
    return false
  }
  const stops = value.stops
  if (!Array.isArray(stops) || stops.length === 0) {
    return false
  }
  if (!stops.every(isItineraryStopShape)) {
    return false
  }
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.city) &&
    isNonEmptyString(value.title)
  )
}

function describeFieldState(input: {
  label: string
  value: unknown
  kind: 'string' | 'object' | 'array'
}): string | null {
  const { label, value, kind } = input
  if (value === undefined) {
    return `${label}:missing`
  }
  if (value === null) {
    return `${label}:wrong_type:null`
  }
  if (kind === 'string') {
    if (typeof value !== 'string') {
      return `${label}:wrong_type:${typeof value}`
    }
    if (value.trim().length === 0) {
      return `${label}:empty_string`
    }
    return null
  }
  if (kind === 'object') {
    return isObject(value) ? null : `${label}:wrong_type:${Array.isArray(value) ? 'array' : typeof value}`
  }
  if (!Array.isArray(value)) {
    return `${label}:wrong_type:${typeof value}`
  }
  if (value.length === 0) {
    return `${label}:empty_array`
  }
  return null
}

function describeLockedPayloadShapeIssues(payload: Record<string, unknown>): string[] {
  const issues = [
    describeFieldState({ label: 'payload.sessionId', value: payload.sessionId, kind: 'string' }),
    describeFieldState({ label: 'payload.city', value: payload.city, kind: 'string' }),
    describeFieldState({ label: 'payload.itinerary', value: payload.itinerary, kind: 'object' }),
    describeFieldState({
      label: 'payload.selectedClusterConfirmation',
      value: payload.selectedClusterConfirmation,
      kind: 'string',
    }),
    describeFieldState({
      label: 'payload.initialActiveRole',
      value: payload.initialActiveRole,
      kind: 'string',
    }),
    payload.lockedAt === undefined
      ? 'payload.lockedAt:missing'
      : payload.lockedAt === null
        ? 'payload.lockedAt:wrong_type:null'
        : !isFiniteNumber(payload.lockedAt)
          ? `payload.lockedAt:wrong_type:${typeof payload.lockedAt}`
          : null,
    describeFieldState({ label: 'payload.finalRoute', value: payload.finalRoute, kind: 'object' }),
  ].filter((entry): entry is string => Boolean(entry))

  const itinerary = payload.itinerary
  if (!isObject(itinerary)) {
    return issues
  }

  const itineraryStops = itinerary.stops
  issues.push(
    ...[
      describeFieldState({ label: 'payload.itinerary.id', value: itinerary.id, kind: 'string' }),
      describeFieldState({ label: 'payload.itinerary.city', value: itinerary.city, kind: 'string' }),
      describeFieldState({
        label: 'payload.itinerary.title',
        value: itinerary.title,
        kind: 'string',
      }),
      describeFieldState({
        label: 'payload.itinerary.stops',
        value: itineraryStops,
        kind: 'array',
      }),
    ].filter((entry): entry is string => Boolean(entry)),
  )

  if (Array.isArray(itineraryStops) && itineraryStops.length > 0) {
    const invalidStopIndex = itineraryStops.findIndex((stop) => !isItineraryStopShape(stop))
    if (invalidStopIndex >= 0) {
      issues.push(
        ...describeItineraryStopShapeIssues(
          itineraryStops[invalidStopIndex],
          `payload.itinerary.stops[${invalidStopIndex}]`,
        ),
      )
    }
  }

  return issues
}

function getProviderRecordIdFromVenueId(venueId: string): string | undefined {
  return getProviderRecordIdFromLiveGoogleVenueId(venueId)
}

function sanitizeProviderRecordId(value: unknown, venueId: string): string | undefined {
  const providerRecordIdFromVenueId = getProviderRecordIdFromVenueId(venueId)
  if (!isNonEmptyString(value)) {
    return providerRecordIdFromVenueId
  }

  const normalized = value.trim()
  if (!normalized) {
    return providerRecordIdFromVenueId
  }

  if (providerRecordIdFromVenueId) {
    // Back-compat for legacy payloads that wrote venue id into providerRecordId.
    if (normalized === venueId) {
      return providerRecordIdFromVenueId
    }
    if (normalized === providerRecordIdFromVenueId) {
      return normalized
    }
    return providerRecordIdFromVenueId
  }

  return undefined
}

function sanitizeFinalRouteStop(value: unknown): RuntimeRouteStop | null {
  if (!isObject(value)) {
    return null
  }

  if (
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.sourceStopId) ||
    !isNonEmptyString(value.displayName) ||
    !isFiniteNumber(value.latitude) ||
    !isFiniteNumber(value.longitude) ||
    !isNonEmptyString(value.address) ||
    !isValidRole(value.role) ||
    !isNonNegativeInteger(value.stopIndex) ||
    !isNonEmptyString(value.venueId) ||
    !isNonEmptyString(value.title) ||
    !isNonEmptyString(value.subtitle) ||
    !isNonEmptyString(value.neighborhood) ||
    !isFiniteNumber(value.driveMinutes) ||
    !isNonEmptyString(value.imageUrl)
  ) {
    return null
  }

  const providerRecordId = sanitizeProviderRecordId(value.providerRecordId, value.venueId)
  return {
    id: value.id,
    sourceStopId: value.sourceStopId,
    displayName: value.displayName,
    ...(providerRecordId ? { providerRecordId } : {}),
    latitude: value.latitude,
    longitude: value.longitude,
    address: value.address,
    role: value.role,
    stopIndex: value.stopIndex,
    venueId: value.venueId,
    title: value.title,
    subtitle: value.subtitle,
    neighborhood: value.neighborhood,
    driveMinutes: value.driveMinutes,
    imageUrl: value.imageUrl,
  }
}

function describeFinalRouteStopShapeIssues(value: unknown, stopLabel: string): string[] {
  const stopRecord = isObject(value) ? value : {}
  return [
    describeStopFieldState({
      label: `${stopLabel}.sourceStopId`,
      value: stopRecord.sourceStopId,
      kind: 'string',
    }),
    describeStopFieldState({ label: `${stopLabel}.role`, value: stopRecord.role, kind: 'role' }),
    describeStopFieldState({
      label: `${stopLabel}.venueId`,
      value: stopRecord.venueId,
      kind: 'string',
    }),
    describeStopFieldState({ label: `${stopLabel}.title`, value: stopRecord.title, kind: 'string' }),
    describeStopFieldState({
      label: `${stopLabel}.subtitle`,
      value: stopRecord.subtitle,
      kind: 'string',
    }),
    describeStopFieldState({
      label: `${stopLabel}.imageUrl`,
      value: stopRecord.imageUrl,
      kind: 'string',
    }),
    describeStopFieldState({
      label: `${stopLabel}.driveMinutes`,
      value: stopRecord.driveMinutes,
      kind: 'number',
    }),
  ].filter((entry): entry is string => Boolean(entry))
}

function describeFinalRouteShapeIssues(value: unknown): string[] {
  if (!isObject(value)) {
    return [`finalRoute:wrong_type:${value === null ? 'null' : typeof value}`]
  }

  const issues = [
    describeStopFieldState({ label: 'finalRoute.id', value: value.routeId, kind: 'string' }),
    describeStopFieldState({
      label: 'finalRoute.location',
      value: value.location,
      kind: 'string',
    }),
    describeFieldState({
      label: 'finalRoute.stops',
      value: value.stops,
      kind: 'array',
    }),
  ].filter((entry): entry is string => Boolean(entry))

  if (Array.isArray(value.stops) && value.stops.length > 0) {
    value.stops.forEach((stop, stopIndex) => {
      issues.push(
        ...describeFinalRouteStopShapeIssues(stop, `finalRoute.stops[${stopIndex}]`),
      )
    })
  }

  return issues
}

function isRuntimeRouteMarkerShape(value: unknown): value is RuntimeRouteMarker {
  return (
    isObject(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.displayName) &&
    isValidRole(value.role) &&
    isNonNegativeInteger(value.stopIndex) &&
    isFiniteNumber(value.latitude) &&
    isFiniteNumber(value.longitude)
  )
}

function sanitizeFinalRoute(value: unknown): RuntimeRouteArtifact | null {
  if (!isObject(value)) {
    return null
  }
  if (
    !isNonEmptyString(value.routeId) ||
    !isNonEmptyString(value.selectedDirectionId) ||
    !isNonEmptyString(value.location) ||
    !isPersonaMode(value.persona) ||
    !isVibeAnchor(value.vibe) ||
    !isNonNegativeInteger(value.activeStopIndex) ||
    !isNonEmptyString(value.routeHeadline) ||
    !isNonEmptyString(value.routeSummary) ||
    !isFiniteNumber(value.updatedAt)
  ) {
    return null
  }

  const rawStops = value.stops
  if (!Array.isArray(rawStops) || rawStops.length === 0) {
    return null
  }
  const stops = rawStops
    .map((stop) => sanitizeFinalRouteStop(stop))
    .filter((stop): stop is RuntimeRouteStop => Boolean(stop))
  if (stops.length !== rawStops.length) {
    return null
  }

  const rawMapMarkers = value.mapMarkers
  if (!Array.isArray(rawMapMarkers)) {
    return null
  }
  const mapMarkers = rawMapMarkers
    .filter(isRuntimeRouteMarkerShape)
    .map((marker) => ({
      id: marker.id,
      displayName: marker.displayName,
      role: marker.role,
      stopIndex: marker.stopIndex,
      latitude: marker.latitude,
      longitude: marker.longitude,
    }))
  if (mapMarkers.length !== rawMapMarkers.length) {
    return null
  }

  const liveNotices = value.liveNotices
  if (!Array.isArray(liveNotices) || !liveNotices.every((notice) => typeof notice === 'string')) {
    return null
  }

  return {
    routeId: value.routeId,
    selectedDirectionId: value.selectedDirectionId,
    location: value.location,
    persona: value.persona,
    vibe: value.vibe,
    stops,
    activeStopIndex: value.activeStopIndex,
    routeHeadline: value.routeHeadline,
    routeSummary: value.routeSummary,
    mapMarkers,
    liveNotices,
    updatedAt: value.updatedAt,
  }
}

function hasUniqueStopIdentity(stops: RuntimeRouteStop[]): boolean {
  const ids = new Set<string>()
  const sourceIds = new Set<string>()
  const stopIndexes = new Set<number>()
  for (const stop of stops) {
    if (ids.has(stop.id) || sourceIds.has(stop.sourceStopId) || stopIndexes.has(stop.stopIndex)) {
      return false
    }
    ids.add(stop.id)
    sourceIds.add(stop.sourceStopId)
    stopIndexes.add(stop.stopIndex)
  }
  return true
}

export function validateFinalRouteAgainstItinerary(input: {
  itinerary: Itinerary
  finalRoute: RuntimeRouteArtifact
}): boolean {
  const { itinerary, finalRoute } = input
  const sanitizedFinalRoute = sanitizeFinalRoute(finalRoute)
  if (!isItineraryShape(itinerary) || !sanitizedFinalRoute) {
    return false
  }

  if (!hasUniqueStopIdentity(sanitizedFinalRoute.stops)) {
    return false
  }

  const itineraryStopById = new Map(itinerary.stops.map((stop) => [stop.id, stop] as const))
  for (const stop of sanitizedFinalRoute.stops) {
    const sourceStop = itineraryStopById.get(stop.sourceStopId)
    if (!sourceStop) {
      return false
    }
    if (sourceStop.role !== stop.role) {
      return false
    }
  }

  const markerById = new Map(sanitizedFinalRoute.mapMarkers.map((marker) => [marker.id, marker] as const))
  for (const stop of sanitizedFinalRoute.stops) {
    const marker = markerById.get(stop.id)
    if (!marker) {
      return false
    }
    if (marker.role !== stop.role || marker.stopIndex !== stop.stopIndex) {
      return false
    }
  }

  return sanitizedFinalRoute.activeStopIndex < sanitizedFinalRoute.stops.length
}

export function sanitizeLiveArtifactSessionPayload(
  payload: unknown,
): LiveArtifactSessionPayload | null {
  if (!isObject(payload)) {
    return null
  }

  if (
    !isNonEmptyString(payload.sessionId) ||
    !isNonEmptyString(payload.city) ||
    !isItineraryShape(payload.itinerary) ||
    !isNonEmptyString(payload.selectedClusterConfirmation) ||
    !isValidRole(payload.initialActiveRole) ||
    !isFiniteNumber(payload.lockedAt)
  ) {
    return null
  }

  const base: LiveArtifactSessionPayload = {
    sessionId: payload.sessionId,
    city: payload.city,
    itinerary: payload.itinerary,
    selectedClusterConfirmation: payload.selectedClusterConfirmation,
    initialActiveRole: payload.initialActiveRole,
    lockedAt: payload.lockedAt,
  }

  if (!('finalRoute' in payload) || payload.finalRoute == null) {
    return base
  }

  const sanitizedFinalRoute = sanitizeFinalRoute(payload.finalRoute)
  if (!sanitizedFinalRoute) {
    return base
  }

  if (
    !validateFinalRouteAgainstItinerary({
      itinerary: payload.itinerary,
      finalRoute: sanitizedFinalRoute,
    })
  ) {
    return base
  }

  return {
    ...base,
    finalRoute: sanitizedFinalRoute,
  }
}

export function validateLockedLiveArtifactSessionPayload(
  payload: unknown,
): LockedLiveArtifactValidationResult {
  if (!isObject(payload)) {
    return {
      ok: false,
      error: {
        code: 'invalid_payload_shape',
        detail: 'Live artifact payload is not an object.',
      },
    }
  }

  if (
    !isNonEmptyString(payload.sessionId) ||
    !isNonEmptyString(payload.city) ||
    !isItineraryShape(payload.itinerary) ||
    !isNonEmptyString(payload.selectedClusterConfirmation) ||
    !isValidRole(payload.initialActiveRole) ||
    !isFiniteNumber(payload.lockedAt)
  ) {
    const shapeIssues = describeLockedPayloadShapeIssues(payload)
    return {
      ok: false,
      error: {
        code: 'invalid_payload_shape',
        detail:
          shapeIssues.join(' | ') ||
          'Live artifact payload is missing required locked-session fields.',
      },
    }
  }

  if (!('finalRoute' in payload) || payload.finalRoute == null) {
    return {
      ok: false,
      error: {
        code: 'missing_final_route',
        detail: 'Locked live artifact is missing finalRoute.',
      },
    }
  }

  const sanitizedFinalRoute = sanitizeFinalRoute(payload.finalRoute)
  if (!sanitizedFinalRoute) {
    const shapeIssues = describeFinalRouteShapeIssues(payload.finalRoute)
    return {
      ok: false,
      error: {
        code: 'invalid_final_route_shape',
        detail:
          shapeIssues.join(' | ') ||
          'finalRoute failed RuntimeRouteArtifact shape validation.',
      },
    }
  }

  const base: LiveArtifactSessionPayload = {
    sessionId: payload.sessionId,
    city: payload.city,
    itinerary: payload.itinerary,
    selectedClusterConfirmation: payload.selectedClusterConfirmation,
    initialActiveRole: payload.initialActiveRole,
    lockedAt: payload.lockedAt,
  }

  if (
    !validateFinalRouteAgainstItinerary({
      itinerary: payload.itinerary,
      finalRoute: sanitizedFinalRoute,
    })
  ) {
    const itineraryStopById = new Map(
      payload.itinerary.stops.map((stop: ItineraryStop) => [stop.id, stop] as const),
    )
    const mismatchDetails = sanitizedFinalRoute.stops
      .map((stop) => {
        const sourceStop = itineraryStopById.get(stop.sourceStopId)
        if (!sourceStop) {
          return `${stop.role}:${stop.sourceStopId}:missing_source_stop`
        }
        if (sourceStop.role !== stop.role) {
          return `${stop.role}:${stop.sourceStopId}:role_mismatch:${sourceStop.role}`
        }
        return null
      })
      .filter((detail): detail is string => Boolean(detail))
    return {
      ok: false,
      error: {
        code: 'final_route_itinerary_mismatch',
        detail:
          mismatchDetails.join(' | ') ||
          'finalRoute could not be validated against itinerary stop identity and marker alignment.',
      },
    }
  }

  return {
    ok: true,
    payload: {
      ...base,
      finalRoute: sanitizedFinalRoute,
    },
  }
}
