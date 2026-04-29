import type { RuntimeRouteArtifact } from '../../../domain/artifacts/runtimeRouteArtifact'
import type { Itinerary, ItineraryStop, UserStopRole } from '../../../domain/types/itinerary'
import {
  createLiveArtifactPlanId,
  getLastLiveArtifactSaveError,
  getLiveArtifactStorageDebugSnapshot,
  saveLiveArtifactSession,
  type LiveArtifactSessionPayload,
  type LiveArtifactStorageDebugSnapshot,
} from '../../../domain/live/liveArtifactSession'
import type { LiveArtifactRouteError } from '../../../domain/live/validateLiveArtifact'

export interface LockedLiveArtifactRouteTruth {
  selectedClusterConfirmation: string
  itinerary: Itinerary
  finalRoute: RuntimeRouteArtifact
}

export interface BuildLockedLiveArtifactPayloadInput {
  canonicalRouteArtifact: LockedLiveArtifactRouteTruth
  lockSafeItineraryStops: ItineraryStop[]
  activeRole: UserStopRole
  fallbackCity: string
  lockedAt?: number
  sessionId?: string
}

export interface SaveLockedLiveArtifactSessionResult {
  ok: boolean
  sessionId: string
  savedSessionId: string | null
  saveError: LiveArtifactRouteError | null
  storageDebug: LiveArtifactStorageDebugSnapshot
  failureReason: string | null
}

export function buildLockedLiveArtifactPayload(
  input: BuildLockedLiveArtifactPayloadInput,
): LiveArtifactSessionPayload {
  const { canonicalRouteArtifact, lockSafeItineraryStops, activeRole } = input
  const sessionId = input.sessionId ?? createLiveArtifactPlanId()
  const lockedAt = input.lockedAt ?? Date.now()
  const lockedCity =
    canonicalRouteArtifact.finalRoute.location ||
    canonicalRouteArtifact.itinerary.city ||
    input.fallbackCity.trim() ||
    'San Jose'
  const lockedTitle =
    canonicalRouteArtifact.itinerary.title ||
    canonicalRouteArtifact.finalRoute.routeHeadline ||
    "Tonight's route"
  const lockedItinerary: Itinerary = {
    ...canonicalRouteArtifact.itinerary,
    city: lockedCity,
    title: lockedTitle,
    stops: lockSafeItineraryStops,
  }

  return {
    sessionId,
    city: lockedCity,
    itinerary: lockedItinerary,
    selectedClusterConfirmation: canonicalRouteArtifact.selectedClusterConfirmation,
    initialActiveRole: activeRole,
    lockedAt,
    finalRoute: {
      ...canonicalRouteArtifact.finalRoute,
      activeStopIndex: Math.max(
        0,
        canonicalRouteArtifact.finalRoute.stops.findIndex((stop) => stop.role === activeRole),
      ),
    },
  }
}

export function saveLockedLiveArtifactSession(
  input: BuildLockedLiveArtifactPayloadInput,
): SaveLockedLiveArtifactSessionResult {
  const payload = buildLockedLiveArtifactPayload(input)
  const savedSessionId = saveLiveArtifactSession(payload)
  const saveError = getLastLiveArtifactSaveError()
  const storageDebug = getLiveArtifactStorageDebugSnapshot(savedSessionId ?? payload.sessionId)
  const failureReason = savedSessionId
    ? null
    : saveError
      ? `${saveError.code}: ${saveError.detail}`
      : 'Live artifact session save returned null.'

  return {
    ok: Boolean(savedSessionId),
    sessionId: payload.sessionId,
    savedSessionId,
    saveError,
    storageDebug,
    failureReason,
  }
}
