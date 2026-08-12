import type { CompositionEvidenceLineage } from '../../domain/artifacts/compositionEvidenceLineage'
import type { RuntimeRouteArtifact } from '../../domain/artifacts/runtimeRouteArtifact'
import type { LiveArtifactSessionPayload } from '../../domain/live/liveArtifactSession'

export type LifecycleUserId = string
export type LifecyclePlanId = string
export type LifecycleRouteId = RuntimeRouteArtifact['routeId']
export type LifecycleShareVersionId = string
export type LifecycleSaveOperationId = string

export type LockedPlanPayloadSchemaVersion = 'live_artifact_session.v1'
export type LockedPlanShareSchemaVersion = 'live_artifact_share.v1'

export interface LockedPlanRouteBinding {
  routeId: LifecycleRouteId
  selectedDirectionId: string
  orderedStopVenueIds: string[]
  routeIdentitySignature: string
  lineageIdentitySignature: string
  payloadFingerprint: string
}

export interface LockedPlanLifecyclePlanProjection {
  planId: LifecyclePlanId
  ownerUserId: LifecycleUserId
  routeId: LifecycleRouteId
  saveOperationId: LifecycleSaveOperationId
  payloadSchemaVersion: LockedPlanPayloadSchemaVersion
  payload: LiveArtifactSessionPayload
  routeBinding: LockedPlanRouteBinding
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

export interface LockedPlanLifecycleShareProjection {
  shareVersionId: LifecycleShareVersionId
  sourcePlanId: LifecyclePlanId
  publishingUserId: LifecycleUserId
  routeId: LifecycleRouteId
  snapshotSchemaVersion: LockedPlanShareSchemaVersion
  snapshotPayloadSchemaVersion: LockedPlanPayloadSchemaVersion
  snapshotPayload: LiveArtifactSessionPayload
  routeBinding: LockedPlanRouteBinding
  publishedAt: number
  revokedAt: number | null
  deletedAt: number | null
}

export type LockedPlanLifecycleFailureCode =
  | 'unauthenticated'
  | 'invalid_locked_payload'
  | 'missing_final_route'
  | 'missing_composition_evidence_lineage'
  | 'route_binding_mismatch'
  | 'lineage_binding_mismatch'
  | 'persistence_truth_mutation'
  | 'unsupported_payload_schema'
  | 'plan_not_found'
  | 'plan_deleted'
  | 'unauthorized_plan_access'
  | 'share_not_found'
  | 'share_revoked'
  | 'idempotency_conflict'
  | 'transaction_failed'
  | 'partial_record'

export interface LockedPlanLifecycleFailure {
  ok: false
  code: LockedPlanLifecycleFailureCode
  detail: string
  reasons: string[]
}

export interface LockedPlanLifecycleSuccess<T> {
  ok: true
  value: T
}

export type LockedPlanLifecycleResult<T> =
  | LockedPlanLifecycleSuccess<T>
  | LockedPlanLifecycleFailure

export interface SaveLockedPlanRequest {
  payload: LiveArtifactSessionPayload
  saveOperationId: LifecycleSaveOperationId
}

export interface SaveLockedPlanSuccess {
  plan: LockedPlanLifecyclePlanProjection
  idempotentReplay: boolean
}

export interface GetLockedPlanRequest {
  planId: LifecyclePlanId
}

export interface ListLockedPlansSuccess {
  plans: LockedPlanLifecyclePlanProjection[]
}

export interface PublishLockedPlanShareRequest {
  planId: LifecyclePlanId
}

export interface PublishLockedPlanShareSuccess {
  share: LockedPlanLifecycleShareProjection
}

export interface ReadLockedPlanShareRequest {
  shareVersionId: LifecycleShareVersionId
}

export interface DeleteLockedPlanRequest {
  planId: LifecyclePlanId
}

export interface DeleteLockedPlanSuccess {
  planId: LifecyclePlanId
  deletedAt: number
  revokedShareVersionIds: LifecycleShareVersionId[]
  alreadyDeleted: boolean
}

export interface LockedPlanIdentitySession {
  getAuthenticatedUserId(): LifecycleUserId | null
}

export interface SaveLockedPlanPersistenceInput {
  ownerUserId: LifecycleUserId
  payload: LiveArtifactSessionPayload
  routeBinding: LockedPlanRouteBinding
  saveOperationId: LifecycleSaveOperationId
  now: number
}

export interface LockedPlanLifecyclePersistence {
  savePlan(
    input: SaveLockedPlanPersistenceInput,
  ): Promise<LockedPlanLifecycleResult<SaveLockedPlanSuccess>>
  getPlanForOwner(input: {
    ownerUserId: LifecycleUserId
    planId: LifecyclePlanId
  }): Promise<LockedPlanLifecycleResult<LockedPlanLifecyclePlanProjection>>
  listPlansForOwner(input: {
    ownerUserId: LifecycleUserId
  }): Promise<LockedPlanLifecycleResult<ListLockedPlansSuccess>>
  publishShare(input: {
    ownerUserId: LifecycleUserId
    planId: LifecyclePlanId
    now: number
  }): Promise<LockedPlanLifecycleResult<PublishLockedPlanShareSuccess>>
  readShare(input: {
    shareVersionId: LifecycleShareVersionId
  }): Promise<LockedPlanLifecycleResult<LockedPlanLifecycleShareProjection>>
  deletePlan(input: {
    ownerUserId: LifecycleUserId
    planId: LifecyclePlanId
    now: number
  }): Promise<LockedPlanLifecycleResult<DeleteLockedPlanSuccess>>
}

export interface LockedPlanLifecycleDependencies {
  identity: LockedPlanIdentitySession
  persistence: LockedPlanLifecyclePersistence
  now?: () => number
}

export interface LockedPlanValidatedPayload {
  payload: LiveArtifactSessionPayload
  finalRoute: RuntimeRouteArtifact
  compositionEvidenceLineage: CompositionEvidenceLineage
  routeBinding: LockedPlanRouteBinding
}

export function lifecycleSuccess<T>(value: T): LockedPlanLifecycleSuccess<T> {
  return {
    ok: true,
    value,
  }
}

export function lifecycleFailure(
  code: LockedPlanLifecycleFailureCode,
  detail: string,
  reasons: string[] = [code],
): LockedPlanLifecycleFailure {
  return {
    ok: false,
    code,
    detail,
    reasons,
  }
}
