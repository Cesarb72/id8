import type { RuntimeRouteArtifact, RuntimeRouteStop } from './runtimeRouteArtifact'
import type { PersonaMode, VibeAnchor } from '../types/intent'
import type { Itinerary, ItineraryStop, UserStopRole } from '../types/itinerary'

interface CanonicalRuntimeRouteStopIdentity {
  displayName: string
  providerRecordId: string
  latitude: number
  longitude: number
  addressLine: string
  neighborhood: string
}

function getNonEmptyRuntimeRouteString(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function getSharedItineraryStopFallbackImageUrl(stops: ItineraryStop[]): string {
  const stopByRole = new Map(stops.map((stop) => [stop.role, stop] as const))
  return (
    getNonEmptyRuntimeRouteString(stopByRole.get('highlight')?.imageUrl) ??
    getNonEmptyRuntimeRouteString(stopByRole.get('start')?.imageUrl) ??
    getNonEmptyRuntimeRouteString(stopByRole.get('windDown')?.imageUrl) ??
    getNonEmptyRuntimeRouteString(stops.find((stop) => getNonEmptyRuntimeRouteString(stop.imageUrl))?.imageUrl) ??
    ''
  )
}

function hydrateRuntimeRouteStopDisplayFields(params: {
  stop: ItineraryStop
  existingRouteStop?: Partial<RuntimeRouteStop>
  fallbackImageUrl: string
}): Pick<RuntimeRouteStop, 'title' | 'subtitle' | 'driveMinutes' | 'imageUrl'> {
  const { stop, existingRouteStop, fallbackImageUrl } = params
  return {
    title: getNonEmptyRuntimeRouteString(existingRouteStop?.title) ?? stop.title,
    subtitle:
      getNonEmptyRuntimeRouteString(existingRouteStop?.subtitle) ??
      getNonEmptyRuntimeRouteString(stop.subtitle) ??
      stop.neighborhood,
    driveMinutes:
      typeof existingRouteStop?.driveMinutes === 'number' && Number.isFinite(existingRouteStop.driveMinutes)
        ? existingRouteStop.driveMinutes
        : stop.driveMinutes,
    imageUrl:
      getNonEmptyRuntimeRouteString(existingRouteStop?.imageUrl) ??
      getNonEmptyRuntimeRouteString(stop.imageUrl) ??
      fallbackImageUrl,
  }
}

export function toFinalRouteStop(
  stop: ItineraryStop,
  stopIndex: number,
  canonicalStopByRole: Partial<Record<UserStopRole, CanonicalRuntimeRouteStopIdentity>>,
  fallbackImageUrl: string,
): RuntimeRouteStop | null {
  const canonical = canonicalStopByRole[stop.role]
  if (
    !canonical ||
    !canonical.providerRecordId ||
    !canonical.displayName ||
    typeof canonical.latitude !== 'number' ||
    typeof canonical.longitude !== 'number' ||
    !canonical.addressLine
  ) {
    return null
  }
  const displayFields = hydrateRuntimeRouteStopDisplayFields({
    stop,
    fallbackImageUrl,
  })
  return {
    id: stop.id,
    sourceStopId: stop.id,
    displayName: canonical.displayName,
    providerRecordId: canonical.providerRecordId,
    latitude: canonical.latitude,
    longitude: canonical.longitude,
    address: canonical.addressLine,
    role: stop.role,
    stopIndex,
    venueId: stop.venueId,
    title: displayFields.title,
    subtitle: displayFields.subtitle,
    neighborhood: canonical.neighborhood || stop.neighborhood,
    driveMinutes: displayFields.driveMinutes,
    imageUrl: displayFields.imageUrl,
  }
}

export function buildFinalRoute(params: {
  itinerary: Itinerary
  canonicalStopByRole: Partial<Record<UserStopRole, CanonicalRuntimeRouteStopIdentity>>
  selectedDirectionId: string
  city: string
  persona: PersonaMode
  vibe: VibeAnchor
  activeRole: UserStopRole
  mode: 'surprise' | 'curate' | 'build'
  routeHeadline: string
  routeSummary: string
}): RuntimeRouteArtifact | null {
  const visibleStops = params.itinerary.stops.filter((stop) => {
    if (stop.role === 'start' || stop.role === 'highlight' || stop.role === 'windDown') {
      return true
    }
    return (
      params.mode === 'surprise' &&
      stop.role === 'surprise' &&
      Boolean(params.canonicalStopByRole.surprise)
    )
  })
  const hasStart = visibleStops.some((stop) => stop.role === 'start')
  const hasHighlight = visibleStops.some((stop) => stop.role === 'highlight')
  const hasWindDown = visibleStops.some((stop) => stop.role === 'windDown')
  if (!hasStart || !hasHighlight || !hasWindDown) {
    return null
  }
  const fallbackImageUrl = getSharedItineraryStopFallbackImageUrl(visibleStops)
  const stops = visibleStops.map((stop, stopIndex) =>
    toFinalRouteStop(stop, stopIndex, params.canonicalStopByRole, fallbackImageUrl),
  )
  if (stops.some((stop) => !stop)) {
    return null
  }
  const committedStops = stops.filter((stop): stop is RuntimeRouteStop => Boolean(stop))
  const activeStopIndex = Math.max(
    0,
    committedStops.findIndex((stop) => stop.role === params.activeRole),
  )
  return {
    routeId: `${params.itinerary.id}-${Date.now()}`,
    selectedDirectionId: params.selectedDirectionId,
    location: params.city,
    persona: params.persona,
    vibe: params.vibe,
    stops: committedStops,
    activeStopIndex,
    routeHeadline: params.routeHeadline,
    routeSummary: params.routeSummary,
    mapMarkers: committedStops.map((stop) => ({
      id: stop.id,
      displayName: stop.displayName,
      role: stop.role,
      stopIndex: stop.stopIndex,
      latitude: stop.latitude,
      longitude: stop.longitude,
    })),
    liveNotices: [],
    updatedAt: Date.now(),
  }
}

export function buildFinalRouteMapMarkers(
  stops: RuntimeRouteStop[],
): RuntimeRouteArtifact['mapMarkers'] {
  return stops
    .slice()
    .sort((left, right) => left.stopIndex - right.stopIndex)
    .map((stop) => ({
      id: stop.id,
      displayName: stop.displayName,
      role: stop.role,
      stopIndex: stop.stopIndex,
      latitude: stop.latitude,
      longitude: stop.longitude,
    }))
}

export function patchFinalRouteStop(params: {
  route: RuntimeRouteArtifact
  targetRole: UserStopRole
  targetStopId?: string
  targetStopIndex?: number
  replacementStop: RuntimeRouteStop
  notice?: string
  activeRole?: UserStopRole
}): {
  route: RuntimeRouteArtifact
  resolvedStop: RuntimeRouteStop
  resolution: 'id' | 'index' | 'role'
} | null {
  const orderedStops = params.route.stops
    .slice()
    .sort((left, right) => left.stopIndex - right.stopIndex)
  let replaceIndex = -1
  let resolution: 'id' | 'index' | 'role' | null = null
  if (params.targetStopId) {
    replaceIndex = orderedStops.findIndex((stop) => stop.id === params.targetStopId)
    if (replaceIndex >= 0) {
      resolution = 'id'
    }
  }
  if (replaceIndex < 0 && typeof params.targetStopIndex === 'number') {
    replaceIndex = orderedStops.findIndex((stop) => stop.stopIndex === params.targetStopIndex)
    if (replaceIndex >= 0) {
      resolution = 'index'
    }
  }
  if (replaceIndex < 0) {
    replaceIndex = orderedStops.findIndex((stop) => stop.role === params.targetRole)
    if (replaceIndex >= 0) {
      resolution = 'role'
    }
  }
  if (replaceIndex < 0 || !resolution) {
    return null
  }
  const currentStop = orderedStops[replaceIndex]
  if (!currentStop) {
    return null
  }
  const replacementStop: RuntimeRouteStop = {
    ...currentStop,
    ...params.replacementStop,
    title: currentStop.title,
    role: currentStop.role,
    stopIndex: currentStop.stopIndex,
  }
  const nextStops = orderedStops.map((stop, index) =>
    index === replaceIndex ? replacementStop : stop,
  )
  const nextActiveStopIndex =
    params.activeRole != null
      ? Math.max(0, nextStops.findIndex((stop) => stop.role === params.activeRole))
      : params.route.activeStopIndex
  return {
    route: {
      ...params.route,
      routeId: `${params.route.routeId}-swap-${Date.now()}`,
      stops: nextStops,
      activeStopIndex: nextActiveStopIndex,
      mapMarkers: buildFinalRouteMapMarkers(nextStops),
      liveNotices: params.notice
        ? [...(params.route.liveNotices ?? []), params.notice]
        : params.route.liveNotices,
      updatedAt: Date.now(),
    },
    resolvedStop: currentStop,
    resolution,
  }
}
