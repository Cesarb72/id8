import type { LiveArtifactSessionPayload } from '../../domain/live/liveArtifactSession'
import type { LockedPlanRouteBinding } from './lockedPlanLifecycleTypes'
import {
  cloneLifecycleValue,
  validateLockedPlanLifecyclePayload,
} from './lockedPlanLifecycleValidation'

export type PendingLockedPlanClaimFailureCode =
  | 'invalid_locked_payload'
  | 'route_binding_mismatch'
  | 'lineage_binding_mismatch'
  | 'missing_claim'
  | 'corrupt_claim'
  | 'storage_unavailable'

export interface PendingLockedPlanClaimFailure {
  ok: false
  code: PendingLockedPlanClaimFailureCode
  detail: string
  reasons: string[]
}

export interface PendingLockedPlanClaimSuccess<T> {
  ok: true
  value: T
}

export type PendingLockedPlanClaimResult<T> =
  | PendingLockedPlanClaimSuccess<T>
  | PendingLockedPlanClaimFailure

export interface PendingLockedPlanClaimStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface PendingLockedPlanClaim {
  payload: LiveArtifactSessionPayload
  routeBinding: LockedPlanRouteBinding
  lifecycleState: 'pending_auth_continuity'
  durableSaveState: 'not_saved'
}

interface StoredPendingLockedPlanClaim {
  schemaVersion: 'pending_locked_plan_claim.v1'
  lifecycleState: 'pending_auth_continuity'
  durableSaveState: 'not_saved'
  payload: LiveArtifactSessionPayload
  routeBinding: LockedPlanRouteBinding
}

export const PENDING_LOCKED_PLAN_CLAIM_STORAGE_KEY =
  'id8.lifecycle.pendingLockedPlanClaim.v1'

function pendingSuccess<T>(value: T): PendingLockedPlanClaimSuccess<T> {
  return { ok: true, value }
}

function pendingFailure(
  code: PendingLockedPlanClaimFailureCode,
  detail: string,
  reasons: string[] = [code],
): PendingLockedPlanClaimFailure {
  return {
    ok: false,
    code,
    detail,
    reasons,
  }
}

function mapLifecycleFailure(
  detail: string,
  code: string,
  reasons: string[],
): PendingLockedPlanClaimFailure {
  if (code === 'route_binding_mismatch') {
    return pendingFailure('route_binding_mismatch', detail, reasons)
  }
  if (code === 'lineage_binding_mismatch') {
    return pendingFailure('lineage_binding_mismatch', detail, reasons)
  }
  return pendingFailure('invalid_locked_payload', detail, reasons)
}

function routeBindingsEqual(left: LockedPlanRouteBinding, right: LockedPlanRouteBinding): boolean {
  return (
    left.routeId === right.routeId &&
    left.selectedDirectionId === right.selectedDirectionId &&
    left.routeIdentitySignature === right.routeIdentitySignature &&
    left.lineageIdentitySignature === right.lineageIdentitySignature &&
    left.payloadFingerprint === right.payloadFingerprint &&
    left.orderedStopVenueIds.length === right.orderedStopVenueIds.length &&
    left.orderedStopVenueIds.every((entry, index) => entry === right.orderedStopVenueIds[index])
  )
}

function isStoredClaim(value: unknown): value is StoredPendingLockedPlanClaim {
  if (!value || typeof value !== 'object') {
    return false
  }
  const record = value as Partial<StoredPendingLockedPlanClaim>
  return (
    record.schemaVersion === 'pending_locked_plan_claim.v1' &&
    record.lifecycleState === 'pending_auth_continuity' &&
    record.durableSaveState === 'not_saved' &&
    typeof record.payload === 'object' &&
    record.payload !== null &&
    typeof record.routeBinding === 'object' &&
    record.routeBinding !== null &&
    !('planId' in record) &&
    !('saveOperationId' in record) &&
    !('shareVersionId' in record)
  )
}

function loadStoredClaim(
  storage: PendingLockedPlanClaimStorage,
): PendingLockedPlanClaimResult<PendingLockedPlanClaim> {
  const raw = storage.getItem(PENDING_LOCKED_PLAN_CLAIM_STORAGE_KEY)
  if (!raw) {
    return pendingFailure('missing_claim', 'No pending locked-plan claim is stored.')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    storage.removeItem(PENDING_LOCKED_PLAN_CLAIM_STORAGE_KEY)
    return pendingFailure('corrupt_claim', 'Stored pending locked-plan claim could not be parsed.')
  }
  if (!isStoredClaim(parsed)) {
    storage.removeItem(PENDING_LOCKED_PLAN_CLAIM_STORAGE_KEY)
    return pendingFailure('corrupt_claim', 'Stored pending locked-plan claim has an invalid envelope.')
  }
  const validation = validateLockedPlanLifecyclePayload(parsed.payload)
  if (!validation.ok) {
    storage.removeItem(PENDING_LOCKED_PLAN_CLAIM_STORAGE_KEY)
    return mapLifecycleFailure(validation.detail, validation.code, validation.reasons)
  }
  if (!routeBindingsEqual(parsed.routeBinding, validation.value.routeBinding)) {
    storage.removeItem(PENDING_LOCKED_PLAN_CLAIM_STORAGE_KEY)
    return pendingFailure(
      'route_binding_mismatch',
      'Stored pending locked-plan claim no longer matches the validated locked payload binding.',
    )
  }
  return pendingSuccess({
    payload: cloneLifecycleValue(validation.value.payload),
    routeBinding: cloneLifecycleValue(validation.value.routeBinding),
    lifecycleState: 'pending_auth_continuity',
    durableSaveState: 'not_saved',
  })
}

export function preservePendingLockedPlanClaim(input: {
  storage: PendingLockedPlanClaimStorage
  payload: unknown
}): PendingLockedPlanClaimResult<PendingLockedPlanClaim> {
  const validation = validateLockedPlanLifecyclePayload(input.payload)
  if (!validation.ok) {
    return mapLifecycleFailure(validation.detail, validation.code, validation.reasons)
  }
  const stored: StoredPendingLockedPlanClaim = {
    schemaVersion: 'pending_locked_plan_claim.v1',
    lifecycleState: 'pending_auth_continuity',
    durableSaveState: 'not_saved',
    payload: cloneLifecycleValue(validation.value.payload),
    routeBinding: cloneLifecycleValue(validation.value.routeBinding),
  }
  try {
    input.storage.setItem(PENDING_LOCKED_PLAN_CLAIM_STORAGE_KEY, JSON.stringify(stored))
  } catch {
    return pendingFailure(
      'storage_unavailable',
      'Temporary pending locked-plan claim storage is unavailable.',
    )
  }
  return pendingSuccess({
    payload: cloneLifecycleValue(stored.payload),
    routeBinding: cloneLifecycleValue(stored.routeBinding),
    lifecycleState: stored.lifecycleState,
    durableSaveState: stored.durableSaveState,
  })
}

export function readPendingLockedPlanClaim(input: {
  storage: PendingLockedPlanClaimStorage
}): PendingLockedPlanClaimResult<PendingLockedPlanClaim> {
  return loadStoredClaim(input.storage)
}

export function consumePendingLockedPlanClaim(input: {
  storage: PendingLockedPlanClaimStorage
}): PendingLockedPlanClaimResult<PendingLockedPlanClaim> {
  const claim = loadStoredClaim(input.storage)
  if (claim.ok) {
    input.storage.removeItem(PENDING_LOCKED_PLAN_CLAIM_STORAGE_KEY)
  }
  return claim
}

export function clearPendingLockedPlanClaim(input: {
  storage: PendingLockedPlanClaimStorage
}): PendingLockedPlanClaimResult<{ cleared: true }> {
  input.storage.removeItem(PENDING_LOCKED_PLAN_CLAIM_STORAGE_KEY)
  return pendingSuccess({ cleared: true })
}
