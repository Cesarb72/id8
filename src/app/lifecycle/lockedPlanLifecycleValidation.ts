import {
  buildCompositionEvidenceRouteIdentitySignature,
  getCompositionEvidenceRouteIdentityFromRuntimeRoute,
  validateCompositionEvidenceLineageForFinalRoute,
} from '../../domain/artifacts/compositionEvidenceLineage'
import {
  validateFinalRouteAgainstItinerary,
  validateLockedLiveArtifactSessionPayload,
} from '../../domain/live/validateLiveArtifact'
import type {
  LockedPlanLifecyclePlanProjection,
  LockedPlanLifecycleResult,
  LockedPlanLifecycleShareProjection,
  LockedPlanRouteBinding,
  LockedPlanValidatedPayload,
} from './lockedPlanLifecycleTypes'
import {
  lifecycleFailure,
  lifecycleSuccess,
} from './lockedPlanLifecycleTypes'

function stableStringifyValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringifyValue(entry)).join(',')}]`
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringifyValue(record[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export function stableLifecycleFingerprint(value: unknown): string {
  return stableStringifyValue(value)
}

export function cloneLifecycleValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function orderedStopVenueIds(finalRoute: LockedPlanValidatedPayload['finalRoute']): string[] {
  return finalRoute.stops
    .slice()
    .sort((left, right) => left.stopIndex - right.stopIndex)
    .map((stop) => `${stop.role}:${stop.venueId}`)
}

function deriveRouteBinding(
  validated: Omit<LockedPlanValidatedPayload, 'routeBinding'>,
): LockedPlanRouteBinding {
  const routeIdentity = getCompositionEvidenceRouteIdentityFromRuntimeRoute(validated.finalRoute)
  const routeIdentitySignature = routeIdentity
    ? buildCompositionEvidenceRouteIdentitySignature(routeIdentity)
    : ''
  return {
    routeId: validated.finalRoute.routeId,
    selectedDirectionId: validated.finalRoute.selectedDirectionId,
    orderedStopVenueIds: orderedStopVenueIds(validated.finalRoute),
    routeIdentitySignature,
    lineageIdentitySignature: validated.compositionEvidenceLineage.approvedRouteIdentitySignature,
    payloadFingerprint: stableLifecycleFingerprint(validated.payload),
  }
}

function routeBindingsMatch(left: LockedPlanRouteBinding, right: LockedPlanRouteBinding): boolean {
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

export function validateLockedPlanLifecyclePayload(
  payload: unknown,
): LockedPlanLifecycleResult<LockedPlanValidatedPayload> {
  const payloadValidation = validateLockedLiveArtifactSessionPayload(payload)
  if (!payloadValidation.ok) {
    const code =
      payloadValidation.error.code === 'missing_final_route'
        ? 'missing_final_route'
        : payloadValidation.error.code === 'final_route_itinerary_mismatch'
          ? 'route_binding_mismatch'
          : payloadValidation.error.code === 'invalid_composition_evidence_lineage'
            ? 'lineage_binding_mismatch'
            : 'invalid_locked_payload'
    return lifecycleFailure(
      code,
      payloadValidation.error.detail,
      [payloadValidation.error.code],
    )
  }

  const { payload: validatedPayload } = payloadValidation
  if (!validatedPayload.finalRoute) {
    return lifecycleFailure(
      'missing_final_route',
      'Locked lifecycle payload must include finalRoute.',
    )
  }
  if (!validatedPayload.compositionEvidenceLineage) {
    return lifecycleFailure(
      'missing_composition_evidence_lineage',
      'Locked lifecycle payload must include compositionEvidenceLineage.',
    )
  }

  if (
    !validateFinalRouteAgainstItinerary({
      itinerary: validatedPayload.itinerary,
      finalRoute: validatedPayload.finalRoute,
    })
  ) {
    return lifecycleFailure(
      'route_binding_mismatch',
      'RuntimeRouteArtifact failed existing itinerary binding validation.',
    )
  }

  const lineageValidation = validateCompositionEvidenceLineageForFinalRoute({
    lineage: validatedPayload.compositionEvidenceLineage,
    finalRoute: validatedPayload.finalRoute,
    selectedDirectionId: validatedPayload.finalRoute.selectedDirectionId,
  })
  if (!lineageValidation.ok) {
    return lifecycleFailure(
      'lineage_binding_mismatch',
      'compositionEvidenceLineage failed existing finalRoute binding validation.',
      lineageValidation.reasons,
    )
  }

  const validated = {
    payload: cloneLifecycleValue(validatedPayload),
    finalRoute: validatedPayload.finalRoute,
    compositionEvidenceLineage: validatedPayload.compositionEvidenceLineage,
  }
  return lifecycleSuccess({
    ...validated,
    routeBinding: deriveRouteBinding(validated),
  })
}

export function validateStoredPlanProjection(
  plan: LockedPlanLifecyclePlanProjection,
): LockedPlanLifecycleResult<LockedPlanLifecyclePlanProjection> {
  if (plan.payloadSchemaVersion !== 'live_artifact_session.v1') {
    return lifecycleFailure(
      'unsupported_payload_schema',
      `Unsupported locked-plan payload schema: ${plan.payloadSchemaVersion}.`,
    )
  }
  if (plan.deletedAt !== null) {
    return lifecycleFailure('plan_deleted', `Plan ${plan.planId} is deleted.`)
  }
  const validation = validateLockedPlanLifecyclePayload(plan.payload)
  if (!validation.ok) {
    return validation
  }
  if (
    plan.routeId !== validation.value.finalRoute.routeId ||
    !routeBindingsMatch(plan.routeBinding, validation.value.routeBinding)
  ) {
    return lifecycleFailure(
      'persistence_truth_mutation',
      `Stored plan ${plan.planId} no longer matches its locked route binding.`,
    )
  }
  return lifecycleSuccess(cloneLifecycleValue(plan))
}

export function validateStoredShareProjection(
  share: LockedPlanLifecycleShareProjection,
): LockedPlanLifecycleResult<LockedPlanLifecycleShareProjection> {
  if (share.snapshotSchemaVersion !== 'live_artifact_share.v1') {
    return lifecycleFailure(
      'unsupported_payload_schema',
      `Unsupported share schema: ${share.snapshotSchemaVersion}.`,
    )
  }
  if (share.snapshotPayloadSchemaVersion !== 'live_artifact_session.v1') {
    return lifecycleFailure(
      'unsupported_payload_schema',
      `Unsupported share payload schema: ${share.snapshotPayloadSchemaVersion}.`,
    )
  }
  if (share.revokedAt !== null || share.deletedAt !== null) {
    return lifecycleFailure('share_revoked', `Share ${share.shareVersionId} is unavailable.`)
  }
  const validation = validateLockedPlanLifecyclePayload(share.snapshotPayload)
  if (!validation.ok) {
    return validation
  }
  if (
    share.routeId !== validation.value.finalRoute.routeId ||
    !routeBindingsMatch(share.routeBinding, validation.value.routeBinding)
  ) {
    return lifecycleFailure(
      'persistence_truth_mutation',
      `Stored share ${share.shareVersionId} no longer matches its locked route binding.`,
    )
  }
  return lifecycleSuccess(cloneLifecycleValue(share))
}
