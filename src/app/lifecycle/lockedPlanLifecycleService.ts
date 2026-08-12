import type {
  DeleteLockedPlanRequest,
  DeleteLockedPlanSuccess,
  GetLockedPlanRequest,
  ListLockedPlansSuccess,
  LockedPlanLifecycleDependencies,
  LockedPlanLifecyclePlanProjection,
  LockedPlanLifecycleResult,
  LockedPlanLifecycleShareProjection,
  PublishLockedPlanShareRequest,
  PublishLockedPlanShareSuccess,
  ReadLockedPlanShareRequest,
  SaveLockedPlanRequest,
  SaveLockedPlanSuccess,
} from './lockedPlanLifecycleTypes'
import {
  lifecycleFailure,
  lifecycleSuccess,
} from './lockedPlanLifecycleTypes'
import {
  validateLockedPlanLifecyclePayload,
  validateStoredPlanProjection,
  validateStoredShareProjection,
} from './lockedPlanLifecycleValidation'

function requireAuthenticatedUser(
  dependencies: LockedPlanLifecycleDependencies,
): LockedPlanLifecycleResult<string> {
  const userId = dependencies.identity.getAuthenticatedUserId()?.trim()
  if (!userId) {
    return lifecycleFailure(
      'unauthenticated',
      'Lifecycle action requires an authenticated user.',
    )
  }
  return lifecycleSuccess(userId)
}

export interface LockedPlanLifecycleService {
  saveLockedPlan(
    request: SaveLockedPlanRequest,
  ): Promise<LockedPlanLifecycleResult<SaveLockedPlanSuccess>>
  getLockedPlan(
    request: GetLockedPlanRequest,
  ): Promise<LockedPlanLifecycleResult<LockedPlanLifecyclePlanProjection>>
  listLockedPlans(): Promise<LockedPlanLifecycleResult<ListLockedPlansSuccess>>
  publishShare(
    request: PublishLockedPlanShareRequest,
  ): Promise<LockedPlanLifecycleResult<PublishLockedPlanShareSuccess>>
  readShare(
    request: ReadLockedPlanShareRequest,
  ): Promise<LockedPlanLifecycleResult<LockedPlanLifecycleShareProjection>>
  deleteLockedPlan(
    request: DeleteLockedPlanRequest,
  ): Promise<LockedPlanLifecycleResult<DeleteLockedPlanSuccess>>
}

export function createLockedPlanLifecycleService(
  dependencies: LockedPlanLifecycleDependencies,
): LockedPlanLifecycleService {
  const now = dependencies.now ?? (() => Date.now())

  return {
    async saveLockedPlan(request) {
      const user = requireAuthenticatedUser(dependencies)
      if (!user.ok) {
        return user
      }
      const validation = validateLockedPlanLifecyclePayload(request.payload)
      if (!validation.ok) {
        return validation
      }
      const saved = await dependencies.persistence.savePlan({
        ownerUserId: user.value,
        payload: validation.value.payload,
        routeBinding: validation.value.routeBinding,
        saveOperationId: request.saveOperationId,
        now: now(),
      })
      if (!saved.ok) {
        return saved
      }
      const egress = validateStoredPlanProjection(saved.value.plan)
      if (!egress.ok) {
        return egress
      }
      return lifecycleSuccess({
        ...saved.value,
        plan: egress.value,
      })
    },

    async getLockedPlan(request) {
      const user = requireAuthenticatedUser(dependencies)
      if (!user.ok) {
        return user
      }
      const plan = await dependencies.persistence.getPlanForOwner({
        ownerUserId: user.value,
        planId: request.planId,
      })
      if (!plan.ok) {
        return plan
      }
      return validateStoredPlanProjection(plan.value)
    },

    async listLockedPlans() {
      const user = requireAuthenticatedUser(dependencies)
      if (!user.ok) {
        return user
      }
      const listed = await dependencies.persistence.listPlansForOwner({
        ownerUserId: user.value,
      })
      if (!listed.ok) {
        return listed
      }
      const plans: LockedPlanLifecyclePlanProjection[] = []
      for (const plan of listed.value.plans) {
        const validation = validateStoredPlanProjection(plan)
        if (!validation.ok) {
          return validation
        }
        plans.push(validation.value)
      }
      return lifecycleSuccess({ plans })
    },

    async publishShare(request) {
      const user = requireAuthenticatedUser(dependencies)
      if (!user.ok) {
        return user
      }
      const published = await dependencies.persistence.publishShare({
        ownerUserId: user.value,
        planId: request.planId,
        now: now(),
      })
      if (!published.ok) {
        return published
      }
      const validation = validateStoredShareProjection(published.value.share)
      if (!validation.ok) {
        return validation
      }
      return lifecycleSuccess({
        share: validation.value,
      })
    },

    async readShare(request) {
      const share = await dependencies.persistence.readShare({
        shareVersionId: request.shareVersionId,
      })
      if (!share.ok) {
        return share
      }
      return validateStoredShareProjection(share.value)
    },

    async deleteLockedPlan(request) {
      const user = requireAuthenticatedUser(dependencies)
      if (!user.ok) {
        return user
      }
      return dependencies.persistence.deletePlan({
        ownerUserId: user.value,
        planId: request.planId,
        now: now(),
      })
    },
  }
}
