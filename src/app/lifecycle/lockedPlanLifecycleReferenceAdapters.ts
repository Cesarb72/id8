import type {
  DeleteLockedPlanSuccess,
  LifecyclePlanId,
  LifecycleSaveOperationId,
  LifecycleShareVersionId,
  LifecycleUserId,
  ListLockedPlansSuccess,
  LockedPlanIdentitySession,
  LockedPlanLifecyclePersistence,
  LockedPlanLifecyclePlanProjection,
  LockedPlanLifecycleResult,
  LockedPlanLifecycleShareProjection,
  PublishLockedPlanShareSuccess,
  SaveLockedPlanPersistenceInput,
  SaveLockedPlanSuccess,
} from './lockedPlanLifecycleTypes'
import {
  lifecycleFailure,
  lifecycleSuccess,
} from './lockedPlanLifecycleTypes'
import { cloneLifecycleValue } from './lockedPlanLifecycleValidation'

function formatDeterministicId(prefix: string, value: number): string {
  return `${prefix}_${String(value).padStart(4, '0')}`
}

function idempotencyKey(userId: LifecycleUserId, saveOperationId: LifecycleSaveOperationId): string {
  return `${userId}::${saveOperationId}`
}

export class DeterministicLockedPlanIdentitySession implements LockedPlanIdentitySession {
  private currentUserId: LifecycleUserId | null

  constructor(initialUserId: LifecycleUserId | null = null) {
    this.currentUserId = initialUserId
  }

  setAuthenticatedUserId(userId: LifecycleUserId | null): void {
    this.currentUserId = userId
  }

  getAuthenticatedUserId(): LifecycleUserId | null {
    return this.currentUserId
  }
}

interface SaveOperationRecord {
  ownerUserId: LifecycleUserId
  saveOperationId: LifecycleSaveOperationId
  payloadFingerprint: string
  planId: LifecyclePlanId
}

export class DeterministicLockedPlanReferencePersistence
  implements LockedPlanLifecyclePersistence
{
  private plans = new Map<LifecyclePlanId, LockedPlanLifecyclePlanProjection>()
  private shares = new Map<LifecycleShareVersionId, LockedPlanLifecycleShareProjection>()
  private saveOperations = new Map<string, SaveOperationRecord>()
  private planCounter = 0
  private shareCounter = 0
  private failNextSave = false
  private failNextPublish = false
  private failNextDelete = false

  failNextSaveTransaction(): void {
    this.failNextSave = true
  }

  failNextPublishTransaction(): void {
    this.failNextPublish = true
  }

  failNextDeleteTransaction(): void {
    this.failNextDelete = true
  }

  async savePlan(
    input: SaveLockedPlanPersistenceInput,
  ): Promise<LockedPlanLifecycleResult<SaveLockedPlanSuccess>> {
    if (this.failNextSave) {
      this.failNextSave = false
      return lifecycleFailure(
        'transaction_failed',
        'Reference adapter simulated a failed atomic Save transaction.',
      )
    }

    const operationKey = idempotencyKey(input.ownerUserId, input.saveOperationId)
    const existingOperation = this.saveOperations.get(operationKey)
    if (existingOperation) {
      if (existingOperation.payloadFingerprint !== input.routeBinding.payloadFingerprint) {
        return lifecycleFailure(
          'idempotency_conflict',
          'saveOperationId was reused by the same owner for different locked truth.',
        )
      }
      const existingPlan = this.plans.get(existingOperation.planId)
      if (!existingPlan) {
        return lifecycleFailure(
          'partial_record',
          'Idempotency record pointed at a missing plan.',
        )
      }
      return lifecycleSuccess({
        plan: cloneLifecycleValue(existingPlan),
        idempotentReplay: true,
      })
    }

    const planId = formatDeterministicId('plan', ++this.planCounter)
    const plan: LockedPlanLifecyclePlanProjection = {
      planId,
      ownerUserId: input.ownerUserId,
      routeId: input.routeBinding.routeId,
      saveOperationId: input.saveOperationId,
      payloadSchemaVersion: 'live_artifact_session.v1',
      payload: cloneLifecycleValue(input.payload),
      routeBinding: cloneLifecycleValue(input.routeBinding),
      createdAt: input.now,
      updatedAt: input.now,
      deletedAt: null,
    }
    this.plans.set(planId, plan)
    this.saveOperations.set(operationKey, {
      ownerUserId: input.ownerUserId,
      saveOperationId: input.saveOperationId,
      payloadFingerprint: input.routeBinding.payloadFingerprint,
      planId,
    })
    return lifecycleSuccess({
      plan: cloneLifecycleValue(plan),
      idempotentReplay: false,
    })
  }

  async getPlanForOwner(input: {
    ownerUserId: LifecycleUserId
    planId: LifecyclePlanId
  }): Promise<LockedPlanLifecycleResult<LockedPlanLifecyclePlanProjection>> {
    const plan = this.plans.get(input.planId)
    if (!plan) {
      return lifecycleFailure('plan_not_found', `Plan ${input.planId} was not found.`)
    }
    if (plan.ownerUserId !== input.ownerUserId) {
      return lifecycleFailure(
        'plan_not_found',
        `Plan ${input.planId} was not found for the authenticated owner.`,
      )
    }
    if (plan.deletedAt !== null) {
      return lifecycleFailure('plan_deleted', `Plan ${input.planId} is deleted.`)
    }
    return lifecycleSuccess(cloneLifecycleValue(plan))
  }

  async listPlansForOwner(input: {
    ownerUserId: LifecycleUserId
  }): Promise<LockedPlanLifecycleResult<ListLockedPlansSuccess>> {
    const plans = [...this.plans.values()]
      .filter((plan) => plan.ownerUserId === input.ownerUserId && plan.deletedAt === null)
      .map((plan) => cloneLifecycleValue(plan))
    return lifecycleSuccess({ plans })
  }

  async publishShare(input: {
    ownerUserId: LifecycleUserId
    planId: LifecyclePlanId
    now: number
  }): Promise<LockedPlanLifecycleResult<PublishLockedPlanShareSuccess>> {
    if (this.failNextPublish) {
      this.failNextPublish = false
      return lifecycleFailure(
        'transaction_failed',
        'Reference adapter simulated a failed atomic Publish transaction.',
      )
    }

    const planResult = await this.getPlanForOwner({
      ownerUserId: input.ownerUserId,
      planId: input.planId,
    })
    if (!planResult.ok) {
      return planResult
    }

    const shareVersionId = formatDeterministicId('share', ++this.shareCounter)
    const share: LockedPlanLifecycleShareProjection = {
      shareVersionId,
      sourcePlanId: planResult.value.planId,
      publishingUserId: input.ownerUserId,
      routeId: planResult.value.routeId,
      snapshotSchemaVersion: 'live_artifact_share.v1',
      snapshotPayloadSchemaVersion: planResult.value.payloadSchemaVersion,
      snapshotPayload: cloneLifecycleValue(planResult.value.payload),
      routeBinding: cloneLifecycleValue(planResult.value.routeBinding),
      publishedAt: input.now,
      revokedAt: null,
      deletedAt: null,
    }
    this.shares.set(shareVersionId, share)
    return lifecycleSuccess({
      share: cloneLifecycleValue(share),
    })
  }

  async readShare(input: {
    shareVersionId: LifecycleShareVersionId
  }): Promise<LockedPlanLifecycleResult<LockedPlanLifecycleShareProjection>> {
    const share = this.shares.get(input.shareVersionId)
    if (!share) {
      return lifecycleFailure(
        'share_not_found',
        `Share ${input.shareVersionId} was not found.`,
      )
    }
    if (share.revokedAt !== null || share.deletedAt !== null) {
      return lifecycleFailure(
        'share_revoked',
        `Share ${input.shareVersionId} is unavailable.`,
      )
    }
    const sourcePlan = this.plans.get(share.sourcePlanId)
    if (!sourcePlan || sourcePlan.deletedAt !== null) {
      return lifecycleFailure(
        'share_revoked',
        `Share ${input.shareVersionId} source plan is unavailable.`,
      )
    }
    return lifecycleSuccess(cloneLifecycleValue(share))
  }

  async deletePlan(input: {
    ownerUserId: LifecycleUserId
    planId: LifecyclePlanId
    now: number
  }): Promise<LockedPlanLifecycleResult<DeleteLockedPlanSuccess>> {
    if (this.failNextDelete) {
      this.failNextDelete = false
      return lifecycleFailure(
        'transaction_failed',
        'Reference adapter simulated a failed atomic Delete transaction.',
      )
    }

    const plan = this.plans.get(input.planId)
    if (!plan) {
      return lifecycleFailure('plan_not_found', `Plan ${input.planId} was not found.`)
    }
    if (plan.ownerUserId !== input.ownerUserId) {
      return lifecycleFailure(
        'plan_not_found',
        `Plan ${input.planId} was not found for the authenticated owner.`,
      )
    }

    const alreadyDeleted = plan.deletedAt !== null
    const deletedAt = plan.deletedAt ?? input.now
    if (!alreadyDeleted) {
      plan.deletedAt = deletedAt
      plan.updatedAt = input.now
    }

    const revokedShareVersionIds: LifecycleShareVersionId[] = []
    for (const share of this.shares.values()) {
      if (share.sourcePlanId !== input.planId) {
        continue
      }
      if (share.revokedAt === null) {
        share.revokedAt = deletedAt
      }
      if (share.deletedAt === null) {
        share.deletedAt = deletedAt
      }
      revokedShareVersionIds.push(share.shareVersionId)
    }

    return lifecycleSuccess({
      planId: input.planId,
      deletedAt,
      revokedShareVersionIds,
      alreadyDeleted,
    })
  }

  mutateStoredPlanPayloadForProof(
    planId: LifecyclePlanId,
    mutate: (plan: LockedPlanLifecyclePlanProjection) => void,
  ): void {
    const plan = this.plans.get(planId)
    if (plan) {
      mutate(plan)
    }
  }

  mutateStoredShareSnapshotForProof(
    shareVersionId: LifecycleShareVersionId,
    mutate: (share: LockedPlanLifecycleShareProjection) => void,
  ): void {
    const share = this.shares.get(shareVersionId)
    if (share) {
      mutate(share)
    }
  }

  getPlanSnapshotForProof(
    planId: LifecyclePlanId,
  ): LockedPlanLifecyclePlanProjection | null {
    const plan = this.plans.get(planId)
    return plan ? cloneLifecycleValue(plan) : null
  }

  getShareSnapshotForProof(
    shareVersionId: LifecycleShareVersionId,
  ): LockedPlanLifecycleShareProjection | null {
    const share = this.shares.get(shareVersionId)
    return share ? cloneLifecycleValue(share) : null
  }
}

export async function runDeterministicConcurrent<T>(
  operations: Array<() => Promise<T>>,
): Promise<T[]> {
  return Promise.all(operations.map((operation) => operation()))
}
