import type { Itinerary, UserStopRole } from '../types/itinerary'
import type { PersonaMode, VibeAnchor } from '../types/intent'

const LIVE_ARTIFACT_SESSION_KEY = 'id8.liveArtifact.v1'
const LIVE_ARTIFACT_EXIT_NOTICE_KEY = 'id8.liveArtifact.exitNotice.v1'
const LIVE_ARTIFACT_SHARED_PLAN_PREFIX = 'id8.liveArtifact.sharedPlan.v1.'
const LIVE_ARTIFACT_HOME_STATE_KEY = 'id8.liveArtifact.home.v1'

export interface LiveArtifactSessionPayload {
  city: string
  itinerary: Itinerary
  selectedClusterConfirmation: string
  initialActiveRole: UserStopRole
  lockedAt: number
  finalRoute?: FinalRoute
}

export interface FinalRouteStop {
  id: string
  sourceStopId: string
  displayName: string
  providerRecordId: string
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

export interface FinalRoute {
  routeId: string
  selectedDirectionId: string
  location: string
  persona: PersonaMode
  vibe: VibeAnchor
  stops: FinalRouteStop[]
  activeStopIndex: number
  routeHeadline: string
  routeSummary: string
  mapMarkers: Array<{
    id: string
    displayName: string
    role: UserStopRole
    stopIndex: number
    latitude: number
    longitude: number
  }>
  liveNotices: string[]
  updatedAt: number
}

export interface LiveArtifactExitNotice {
  title?: string
  message: string
  mapPath?: string
  showPlanAnotherNight?: boolean
}

export interface LiveArtifactHomeState {
  city: string
  mapPath: string
}

export interface SharedLiveArtifactPlanEntry {
  planId: string
  payload: LiveArtifactSessionPayload
}

export function saveLiveArtifactSession(payload: LiveArtifactSessionPayload): void {
  if (typeof window === 'undefined') {
    return
  }
  window.sessionStorage.setItem(LIVE_ARTIFACT_SESSION_KEY, JSON.stringify(payload))
}

export function loadLiveArtifactSession(): LiveArtifactSessionPayload | null {
  if (typeof window === 'undefined') {
    return null
  }
  const raw = window.sessionStorage.getItem(LIVE_ARTIFACT_SESSION_KEY)
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as LiveArtifactSessionPayload
  } catch {
    return null
  }
}

export function createLiveArtifactPlanId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `plan_${Date.now()}`
}

function getSharedPlanKey(planId: string): string {
  return `${LIVE_ARTIFACT_SHARED_PLAN_PREFIX}${planId}`
}

export function saveSharedLiveArtifactPlan(
  planId: string,
  payload: LiveArtifactSessionPayload,
): void {
  if (typeof window === 'undefined' || !planId) {
    return
  }
  try {
    window.localStorage.setItem(getSharedPlanKey(planId), JSON.stringify(payload))
  } catch {
    // noop
  }
}

export function loadSharedLiveArtifactPlan(planId: string): LiveArtifactSessionPayload | null {
  if (typeof window === 'undefined' || !planId) {
    return null
  }
  const raw = window.localStorage.getItem(getSharedPlanKey(planId))
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as LiveArtifactSessionPayload
  } catch {
    return null
  }
}

export function listSharedLiveArtifactPlans(): SharedLiveArtifactPlanEntry[] {
  if (typeof window === 'undefined') {
    return []
  }

  const entries: SharedLiveArtifactPlanEntry[] = []
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (!key || !key.startsWith(LIVE_ARTIFACT_SHARED_PLAN_PREFIX)) {
        continue
      }

      const planId = key.slice(LIVE_ARTIFACT_SHARED_PLAN_PREFIX.length)
      if (!planId) {
        continue
      }

      const raw = window.localStorage.getItem(key)
      if (!raw) {
        continue
      }

      try {
        const payload = JSON.parse(raw) as LiveArtifactSessionPayload
        if (!payload || typeof payload.lockedAt !== 'number') {
          continue
        }
        entries.push({
          planId,
          payload,
        })
      } catch {
        continue
      }
    }
  } catch {
    return []
  }

  return entries.sort((left, right) => right.payload.lockedAt - left.payload.lockedAt)
}

export function saveLiveArtifactHomeState(state: LiveArtifactHomeState): void {
  if (typeof window === 'undefined') {
    return
  }
  window.sessionStorage.setItem(LIVE_ARTIFACT_HOME_STATE_KEY, JSON.stringify(state))
}

export function loadLiveArtifactHomeState(): LiveArtifactHomeState | null {
  if (typeof window === 'undefined') {
    return null
  }
  const raw = window.sessionStorage.getItem(LIVE_ARTIFACT_HOME_STATE_KEY)
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as LiveArtifactHomeState
  } catch {
    return null
  }
}

export function setLiveArtifactExitNotice(notice: string | LiveArtifactExitNotice): void {
  if (typeof window === 'undefined') {
    return
  }
  const payload = typeof notice === 'string' ? { message: notice } : notice
  window.sessionStorage.setItem(LIVE_ARTIFACT_EXIT_NOTICE_KEY, JSON.stringify(payload))
}

export function consumeLiveArtifactExitNotice(): LiveArtifactExitNotice | null {
  if (typeof window === 'undefined') {
    return null
  }
  const raw = window.sessionStorage.getItem(LIVE_ARTIFACT_EXIT_NOTICE_KEY)
  if (!raw) {
    return null
  }
  window.sessionStorage.removeItem(LIVE_ARTIFACT_EXIT_NOTICE_KEY)
  try {
    const parsed = JSON.parse(raw) as LiveArtifactExitNotice
    if (parsed && typeof parsed.message === 'string') {
      return parsed
    }
    return null
  } catch {
    return { message: raw }
  }
}
