import type { PersonaMode, VibeAnchor } from '../types/intent'
import type { UserStopRole } from '../types/itinerary'

/**
 * ARC BOUNDARY: runtime/planning-owned committed route artifact.
 *
 * `RuntimeRouteArtifact` is the canonical committed/generated route truth used by
 * runtime, persistence, and live surfaces. Session payloads and page-local wrappers
 * may adapt around it, but should not redefine the underlying runtime route shape.
 */

export interface RuntimeRouteMarker {
  id: string
  displayName: string
  role: UserStopRole
  stopIndex: number
  latitude: number
  longitude: number
}

export interface RuntimeRouteStop {
  id: string
  sourceStopId: string
  displayName: string
  providerRecordId?: string
  latitude: number
  longitude: number
  address: string
  role: UserStopRole
  stopIndex: number
  venueId: string
  title: string
  subtitle: string
  neighborhood: string
  driveMinutes: number
  imageUrl: string
}

export interface RuntimeRouteArtifact {
  routeId: string
  selectedDirectionId: string
  location: string
  persona: PersonaMode
  vibe: VibeAnchor
  stops: RuntimeRouteStop[]
  activeStopIndex: number
  routeHeadline: string
  routeSummary: string
  mapMarkers: RuntimeRouteMarker[]
  liveNotices: string[]
  updatedAt: number
}
