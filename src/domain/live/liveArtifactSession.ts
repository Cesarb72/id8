import type { Itinerary, UserStopRole } from '../types/itinerary'
import type {
  RuntimeRouteArtifact,
  RuntimeRouteStop,
} from '../artifacts/runtimeRouteArtifact'
import {
  sanitizeLiveArtifactSessionPayload,
  validateLockedLiveArtifactSessionPayload,
  type LiveArtifactRouteError,
} from './validateLiveArtifact'

const LIVE_ARTIFACT_SESSION_KEY = 'id8.liveArtifact.v1'
const LIVE_ARTIFACT_SESSION_PREFIX = 'id8.liveArtifact.session.v1.'
const LIVE_ARTIFACT_ACTIVE_SESSION_ID_KEY = 'id8.liveArtifact.activeSessionId.v1'
const LIVE_ARTIFACT_EXIT_NOTICE_KEY = 'id8.liveArtifact.exitNotice.v1'
const LIVE_ARTIFACT_SHARED_PLAN_PREFIX = 'id8.liveArtifact.sharedPlan.v1.'
const LIVE_ARTIFACT_HOME_STATE_KEY = 'id8.liveArtifact.home.v1'
const LIVE_ARTIFACT_CONTINUATION_UI_PREFIX = 'id8.liveArtifact.continuationUi.v1.'

export interface LiveArtifactSessionPayload {
  sessionId: string
  city: string
  itinerary: Itinerary
  selectedClusterConfirmation: string
  initialActiveRole: UserStopRole
  lockedAt: number
  finalRoute?: RuntimeRouteArtifact
}

export type FinalRouteStop = RuntimeRouteStop
export type FinalRoute = RuntimeRouteArtifact

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

export interface LiveArtifactContinuationUiState {
  selectedContinuationOptionId: string | null
  previewContinuationOptionId: string | null
}

export interface SharedLiveArtifactPlanEntry {
  planId: string
  payload: LiveArtifactSessionPayload
}

export type LockedLiveArtifactLoadResult =
  | {
      status: 'missing'
    }
  | {
      status: 'ok'
      payload: LiveArtifactSessionPayload
    }
  | {
      status: 'error'
      error: LiveArtifactRouteError
    }

export interface LiveArtifactStorageDebugSnapshot {
  activeSessionId: string | null
  activeSessionIdPresent: boolean
  sessionKey: string | null
  sessionPayloadPresent: boolean
}

let lastLiveArtifactSaveError: LiveArtifactRouteError | null = null

function getLiveArtifactSessionKey(sessionId: string): string {
  return `${LIVE_ARTIFACT_SESSION_PREFIX}${sessionId}`
}

export function saveLiveArtifactSession(payload: LiveArtifactSessionPayload): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  const validated = validateLockedLiveArtifactSessionPayload(payload)
  if (!validated.ok) {
    lastLiveArtifactSaveError = validated.error
    return null
  }
  lastLiveArtifactSaveError = null
  const previousActiveSessionId = window.sessionStorage
    .getItem(LIVE_ARTIFACT_ACTIVE_SESSION_ID_KEY)
    ?.trim()
  if (
    previousActiveSessionId &&
    previousActiveSessionId !== validated.payload.sessionId
  ) {
    window.sessionStorage.removeItem(getLiveArtifactSessionKey(previousActiveSessionId))
  }
  window.sessionStorage.setItem(
    getLiveArtifactSessionKey(validated.payload.sessionId),
    JSON.stringify(validated.payload),
  )
  window.sessionStorage.setItem(LIVE_ARTIFACT_ACTIVE_SESSION_ID_KEY, validated.payload.sessionId)
  window.sessionStorage.setItem(LIVE_ARTIFACT_SESSION_KEY, JSON.stringify(validated.payload))
  return validated.payload.sessionId
}

export function getLastLiveArtifactSaveError(): LiveArtifactRouteError | null {
  return lastLiveArtifactSaveError
}

export function getLiveArtifactStorageDebugSnapshot(
  sessionId: string | null,
): LiveArtifactStorageDebugSnapshot {
  if (typeof window === 'undefined') {
    return {
      activeSessionId: null,
      activeSessionIdPresent: false,
      sessionKey: sessionId ? getLiveArtifactSessionKey(sessionId) : null,
      sessionPayloadPresent: false,
    }
  }
  const activeSessionId = window.sessionStorage.getItem(LIVE_ARTIFACT_ACTIVE_SESSION_ID_KEY)?.trim() || null
  const sessionKey = sessionId ? getLiveArtifactSessionKey(sessionId) : null
  return {
    activeSessionId,
    activeSessionIdPresent: Boolean(activeSessionId),
    sessionKey,
    sessionPayloadPresent: Boolean(
      sessionKey && window.sessionStorage.getItem(sessionKey),
    ),
  }
}

export function loadLiveArtifactSession(): LiveArtifactSessionPayload | null {
  if (typeof window === 'undefined') {
    return null
  }
  const activeSessionId = window.sessionStorage.getItem(LIVE_ARTIFACT_ACTIVE_SESSION_ID_KEY)?.trim()
  if (!activeSessionId) {
    return null
  }
  const raw = window.sessionStorage.getItem(getLiveArtifactSessionKey(activeSessionId))
  if (!raw) {
    return null
  }
  try {
    const result = validateLockedLiveArtifactSessionPayload(JSON.parse(raw))
    return result.ok ? result.payload : null
  } catch {
    return null
  }
}

export function loadValidatedLiveArtifactSession(): LockedLiveArtifactLoadResult {
  if (typeof window === 'undefined') {
    return { status: 'missing' }
  }
  const activeSessionId = window.sessionStorage.getItem(LIVE_ARTIFACT_ACTIVE_SESSION_ID_KEY)?.trim()
  if (!activeSessionId) {
    return { status: 'missing' }
  }
  const raw = window.sessionStorage.getItem(getLiveArtifactSessionKey(activeSessionId))
  if (!raw) {
    return { status: 'missing' }
  }
  try {
    const result = validateLockedLiveArtifactSessionPayload(JSON.parse(raw))
    if (!result.ok) {
      return {
        status: 'error',
        error: result.error,
      }
    }
    return {
      status: 'ok',
      payload: result.payload,
    }
  } catch {
    return {
      status: 'error',
      error: {
        code: 'invalid_payload_shape',
        detail: 'Stored live artifact could not be parsed.',
      },
    }
  }
}

export function endLiveArtifactSession(): void {
  if (typeof window === 'undefined') {
    return
  }
  const activeSessionId = window.sessionStorage.getItem(LIVE_ARTIFACT_ACTIVE_SESSION_ID_KEY)?.trim()
  if (activeSessionId) {
    window.sessionStorage.removeItem(getLiveArtifactSessionKey(activeSessionId))
  }
  window.sessionStorage.removeItem(LIVE_ARTIFACT_ACTIVE_SESSION_ID_KEY)
  window.sessionStorage.removeItem(LIVE_ARTIFACT_SESSION_KEY)
  window.sessionStorage.removeItem(LIVE_ARTIFACT_HOME_STATE_KEY)
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

function getLiveArtifactContinuationUiKey(sessionId: string): string {
  return `${LIVE_ARTIFACT_CONTINUATION_UI_PREFIX}${sessionId}`
}

export function saveSharedLiveArtifactPlan(
  planId: string,
  payload: LiveArtifactSessionPayload,
): void {
  if (typeof window === 'undefined' || !planId) {
    return
  }
  const validated = validateLockedLiveArtifactSessionPayload(payload)
  if (!validated.ok) {
    return
  }
  try {
    window.localStorage.setItem(getSharedPlanKey(planId), JSON.stringify(validated.payload))
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
    const result = validateLockedLiveArtifactSessionPayload(JSON.parse(raw))
    return result.ok ? result.payload : null
  } catch {
    return null
  }
}

export function loadValidatedSharedLiveArtifactPlan(planId: string): LockedLiveArtifactLoadResult {
  if (typeof window === 'undefined' || !planId) {
    return { status: 'missing' }
  }
  const raw = window.localStorage.getItem(getSharedPlanKey(planId))
  if (!raw) {
    return { status: 'missing' }
  }
  try {
    const result = validateLockedLiveArtifactSessionPayload(JSON.parse(raw))
    if (!result.ok) {
      return {
        status: 'error',
        error: result.error,
      }
    }
    return {
      status: 'ok',
      payload: result.payload,
    }
  } catch {
    return {
      status: 'error',
      error: {
        code: 'invalid_payload_shape',
        detail: 'Stored shared live artifact could not be parsed.',
      },
    }
  }
}

export function saveLiveArtifactContinuationUiState(
  sessionId: string,
  state: LiveArtifactContinuationUiState,
): void {
  if (typeof window === 'undefined' || !sessionId) {
    return
  }
  try {
    window.sessionStorage.setItem(
      getLiveArtifactContinuationUiKey(sessionId),
      JSON.stringify({
        selectedContinuationOptionId: state.selectedContinuationOptionId ?? null,
        previewContinuationOptionId: state.previewContinuationOptionId ?? null,
      }),
    )
  } catch {
    // noop
  }
}

export function loadLiveArtifactContinuationUiState(
  sessionId: string,
): LiveArtifactContinuationUiState | null {
  if (typeof window === 'undefined' || !sessionId) {
    return null
  }
  const raw = window.sessionStorage.getItem(getLiveArtifactContinuationUiKey(sessionId))
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as Partial<LiveArtifactContinuationUiState>
    const selectedContinuationOptionId =
      typeof parsed.selectedContinuationOptionId === 'string'
        ? parsed.selectedContinuationOptionId
        : null
    const previewContinuationOptionId =
      typeof parsed.previewContinuationOptionId === 'string'
        ? parsed.previewContinuationOptionId
        : null
    return {
      selectedContinuationOptionId,
      previewContinuationOptionId,
    }
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
        const payload = sanitizeLiveArtifactSessionPayload(JSON.parse(raw))
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

export function removeSharedLiveArtifactPlan(planId: string): void {
  if (typeof window === 'undefined' || !planId) {
    return
  }
  try {
    window.localStorage.removeItem(getSharedPlanKey(planId))
  } catch {
    // noop
  }
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
