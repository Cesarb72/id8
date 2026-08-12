import assert from 'node:assert/strict'
import { createLockedPlanLifecycleService } from '../src/app/lifecycle/lockedPlanLifecycleService.ts'
import {
  DeterministicLockedPlanIdentitySession,
  DeterministicLockedPlanReferencePersistence,
  runDeterministicConcurrent,
} from '../src/app/lifecycle/lockedPlanLifecycleReferenceAdapters.ts'
import {
  buildCompositionEvidenceRouteIdentitySignature,
  type CompositionEvidenceLineage,
} from '../src/domain/artifacts/compositionEvidenceLineage.ts'
import type {
  RuntimeRouteArtifact,
  RuntimeRouteStop,
} from '../src/domain/artifacts/runtimeRouteArtifact.ts'
import type { LiveArtifactSessionPayload } from '../src/domain/live/liveArtifactSession.ts'
import { validateLockedLiveArtifactSessionPayload } from '../src/domain/live/validateLiveArtifact.ts'
import type { Itinerary, ItineraryStop, UserStopRole } from '../src/domain/types/itinerary.ts'

let fetchCalls = 0
globalThis.fetch = ((input: RequestInfo | URL) => {
  fetchCalls += 1
  throw new Error(`Move 4 lifecycle proof must not call fetch: ${String(input)}`)
}) as typeof fetch

const routeIds = {
  start: 'venue-start',
  highlight: 'venue-highlight',
  windDown: 'venue-wind-down',
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function titleForRole(role: UserStopRole): ItineraryStop['title'] {
  if (role === 'windDown') {
    return 'Wind Down'
  }
  return role === 'start' ? 'Start' : role === 'highlight' ? 'Highlight' : 'Surprise'
}

function itineraryStop(role: UserStopRole, index: number): ItineraryStop {
  const title = titleForRole(role)
  const venueId = role === 'windDown' ? routeIds.windDown : routeIds[role as 'start' | 'highlight']
  return {
    id: venueId,
    role,
    title,
    venueId,
    venueName: `${title} Venue`,
    formattedAddress: '1 San Jose Way',
    latitude: 37.33 + index * 0.001,
    longitude: -121.89 - index * 0.001,
    city: 'San Jose',
    category: 'bar',
    subcategory: 'proof',
    priceTier: '$$',
    tags: ['proof'],
    vibeTags: ['cozy'],
    neighborhood: 'Downtown',
    driveMinutes: index === 0 ? 0 : 8,
    durationClass: 'M',
    estimatedDurationMinutes: 45,
    estimatedDurationLabel: '45 min',
    subtitle: 'Proof stop',
    imageUrl: 'https://example.test/move-4-proof.jpg',
    stopInsider: {
      roleReason: 'Proof role',
      localSignal: 'Proof signal',
      selectionReason: 'Proof selection',
    },
  }
}

function runtimeStop(role: 'start' | 'highlight' | 'windDown', index: number): RuntimeRouteStop {
  const venueId = routeIds[role]
  const title = titleForRole(role)
  return {
    id: venueId,
    sourceStopId: venueId,
    displayName: `${title} Venue`,
    providerRecordId: venueId,
    latitude: 37.33 + index * 0.001,
    longitude: -121.89 - index * 0.001,
    address: '1 San Jose Way',
    role,
    stopIndex: index,
    venueId,
    title: `${title} Venue`,
    subtitle: 'Proof stop',
    neighborhood: 'Downtown',
    driveMinutes: index === 0 ? 0 : 8,
    imageUrl: 'https://example.test/move-4-proof.jpg',
  }
}

function buildValidPayload(overrides: Partial<LiveArtifactSessionPayload> = {}): LiveArtifactSessionPayload {
  const itinerary: Itinerary = {
    id: 'itinerary-move-4-proof',
    title: 'Move 4 proof route',
    city: 'San Jose',
    crew: 'romantic',
    vibes: ['cozy'],
    stops: [
      itineraryStop('start', 0),
      itineraryStop('highlight', 1),
      itineraryStop('windDown', 2),
    ],
    transitions: [],
    totalRouteFriction: 0.2,
    estimatedTotalMinutes: 150,
    estimatedTotalLabel: '2.5 hr',
    routeFeelLabel: 'Tight',
    story: {
      headline: 'Move 4 proof',
      subtitle: 'Durable lifecycle evidence',
    },
    shareSummary: 'Move 4 proof route.',
  }
  const stops = [
    runtimeStop('start', 0),
    runtimeStop('highlight', 1),
    runtimeStop('windDown', 2),
  ]
  const finalRoute: RuntimeRouteArtifact = {
    routeId: 'runtime-move-4-proof',
    selectedDirectionId: 'direction-move-4',
    location: 'San Jose',
    persona: 'romantic',
    vibe: 'cozy',
    stops,
    activeStopIndex: 0,
    routeHeadline: 'Move 4 proof route',
    routeSummary: 'Durable lifecycle proof route.',
    mapMarkers: stops.map((stop) => ({
      id: stop.id,
      displayName: stop.displayName,
      role: stop.role,
      stopIndex: stop.stopIndex,
      latitude: stop.latitude,
      longitude: stop.longitude,
    })),
    liveNotices: [],
    updatedAt: 1,
  }
  const compositionEvidenceLineage: CompositionEvidenceLineage = {
    schemaVersion: 'composition_evidence_lineage.v0_1',
    source: 'contract_entry_artifact.generation',
    approvedAt: 1,
    approvedCandidateId: 'arc-move-4-proof',
    approvedRouteIdentitySignature: buildCompositionEvidenceRouteIdentitySignature(routeIds),
    approvedRouteIdentity: routeIds,
    inputCarrier: {
      routeShapeContractId: 'route-shape-move-4',
      conciergeIntentId: 'concierge-intent-move-4',
      experienceContractId: 'experience-contract-move-4',
      contractConstraintsId: 'contract-constraints-move-4',
      routeShapeProjectionId: 'projection-move-4',
      selectedDirectionId: 'direction-move-4',
      selectedPocketId: 'pocket-move-4',
    },
    taste: {
      source: 'taste.experience_composition.v0_1',
      status: 'pass',
      requirementSource: 'route_shape_contract',
      routeShapeContractId: 'route-shape-move-4',
      score: 0.91,
      startContributionStatus: 'pass',
      highlightContributionStatus: 'pass',
      windDownContributionStatus: 'pass',
      startPreparesHighlightStatus: 'pass',
      windDownResolvesHighlightStatus: 'pass',
      reasonCodes: [],
      unavailableEvidence: [],
    },
    waypoint: {
      enforcementActive: true,
      routeShapeContractId: 'route-shape-move-4',
      projectionId: 'projection-move-4',
      selectedCandidateId: 'arc-move-4-proof',
      selectedCandidateRank: 1,
      eligibleCandidateCount: 1,
      failureReasons: [],
    },
    bearings: {
      status: 'pass',
      reasonCodes: [],
    },
    greatStop: {
      status: 'PASS',
      selectedCandidateId: 'arc-move-4-proof',
      selectedCandidateRank: 1,
      failedCriteria: [],
      reasonCodes: [],
    },
  }
  return {
    sessionId: 'session-move-4-proof',
    city: 'San Jose',
    itinerary,
    selectedClusterConfirmation: 'Move 4 proof confirmed.',
    initialActiveRole: 'highlight',
    lockedAt: 1,
    finalRoute,
    compositionEvidenceLineage,
    ...overrides,
  }
}

async function runProof() {
  let now = 200
  const identity = new DeterministicLockedPlanIdentitySession('user-a')
  const persistence = new DeterministicLockedPlanReferencePersistence()
  const service = createLockedPlanLifecycleService({
    identity,
    persistence,
    now: () => ++now,
  })
  const payload = buildValidPayload()
  assert.equal(validateLockedLiveArtifactSessionPayload(clone(payload)).ok, true)

  persistence.failNextSaveTransaction()
  const failedSave = await service.saveLockedPlan({
    payload,
    saveOperationId: 'save-op-fail',
  })
  assert.equal(failedSave.ok, false)
  assert.equal(failedSave.ok ? null : failedSave.code, 'transaction_failed')
  const noPartialPlan = await service.getLockedPlan({ planId: 'plan_0001' })
  assert.equal(noPartialPlan.ok, false)
  assert.equal(noPartialPlan.ok ? null : noPartialPlan.code, 'plan_not_found')

  const concurrentSaves = await runDeterministicConcurrent([
    () => service.saveLockedPlan({ payload, saveOperationId: 'save-op-concurrent' }),
    () => service.saveLockedPlan({ payload: clone(payload), saveOperationId: 'save-op-concurrent' }),
  ])
  assert.equal(concurrentSaves[0]!.ok, true)
  assert.equal(concurrentSaves[1]!.ok, true)
  const firstPlanId = concurrentSaves[0]!.ok ? concurrentSaves[0]!.value.plan.planId : null
  const secondPlanId = concurrentSaves[1]!.ok ? concurrentSaves[1]!.value.plan.planId : null
  assert.equal(firstPlanId, 'plan_0001')
  assert.equal(secondPlanId, 'plan_0001')

  const retry = await service.saveLockedPlan({
    payload: clone(payload),
    saveOperationId: 'save-op-concurrent',
  })
  assert.equal(retry.ok, true)
  assert.equal(retry.ok ? retry.value.plan.planId : null, 'plan_0001')
  assert.equal(retry.ok ? retry.value.idempotentReplay : null, true)

  const conflictPayload = buildValidPayload({ sessionId: 'different-session-same-op' })
  const conflict = await service.saveLockedPlan({
    payload: conflictPayload,
    saveOperationId: 'save-op-concurrent',
  })
  assert.equal(conflict.ok, false)
  assert.equal(conflict.ok ? null : conflict.code, 'idempotency_conflict')

  identity.setAuthenticatedUserId('user-b')
  const ownerScoped = await service.saveLockedPlan({
    payload: buildValidPayload({ sessionId: 'session-user-b' }),
    saveOperationId: 'save-op-concurrent',
  })
  assert.equal(ownerScoped.ok, true)
  assert.equal(ownerScoped.ok ? ownerScoped.value.plan.planId : null, 'plan_0002')

  identity.setAuthenticatedUserId('user-a')
  persistence.failNextPublishTransaction()
  const failedPublish = await service.publishShare({ planId: 'plan_0001' })
  assert.equal(failedPublish.ok, false)
  assert.equal(failedPublish.ok ? null : failedPublish.code, 'transaction_failed')
  const noPartialShare = await service.readShare({ shareVersionId: 'share_0001' })
  assert.equal(noPartialShare.ok, false)
  assert.equal(noPartialShare.ok ? null : noPartialShare.code, 'share_not_found')

  const concurrentShares = await runDeterministicConcurrent([
    () => service.publishShare({ planId: 'plan_0001' }),
    () => service.publishShare({ planId: 'plan_0001' }),
  ])
  assert.equal(concurrentShares[0]!.ok, true)
  assert.equal(concurrentShares[1]!.ok, true)
  const shareIds = concurrentShares.map((share) => (share.ok ? share.value.share.shareVersionId : null))
  assert.deepEqual(shareIds, ['share_0001', 'share_0002'])
  const firstShareRead = await service.readShare({ shareVersionId: 'share_0001' })
  assert.equal(firstShareRead.ok, true)
  assert.deepEqual(
    firstShareRead.ok ? firstShareRead.value.snapshotPayload : null,
    concurrentShares[0]!.ok ? concurrentShares[0]!.value.share.snapshotPayload : null,
  )

  persistence.failNextDeleteTransaction()
  const failedDelete = await service.deleteLockedPlan({ planId: 'plan_0001' })
  assert.equal(failedDelete.ok, false)
  assert.equal(failedDelete.ok ? null : failedDelete.code, 'transaction_failed')
  assert.equal((await service.getLockedPlan({ planId: 'plan_0001' })).ok, true)
  assert.equal((await service.readShare({ shareVersionId: 'share_0001' })).ok, true)

  const deleted = await service.deleteLockedPlan({ planId: 'plan_0001' })
  assert.equal(deleted.ok, true)
  assert.deepEqual(deleted.ok ? deleted.value.revokedShareVersionIds : [], ['share_0001', 'share_0002'])
  const staleReturn = await service.getLockedPlan({ planId: 'plan_0001' })
  assert.equal(staleReturn.ok, false)
  assert.equal(staleReturn.ok ? null : staleReturn.code, 'plan_deleted')
  const publishDeleted = await service.publishShare({ planId: 'plan_0001' })
  assert.equal(publishDeleted.ok, false)
  assert.equal(publishDeleted.ok ? null : publishDeleted.code, 'plan_deleted')
  const revokedShare = await service.readShare({ shareVersionId: 'share_0001' })
  assert.equal(revokedShare.ok, false)
  assert.equal(revokedShare.ok ? null : revokedShare.code, 'share_revoked')

  const mutationPayload = buildValidPayload({ sessionId: 'session-mutation-proof' })
  const mutationSaved = await service.saveLockedPlan({
    payload: mutationPayload,
    saveOperationId: 'save-op-mutation',
  })
  assert.equal(mutationSaved.ok, true)
  const mutationPlanId = mutationSaved.ok ? mutationSaved.value.plan.planId : 'missing'
  persistence.mutateStoredPlanPayloadForProof(mutationPlanId, (plan) => {
    plan.payload.finalRoute!.routeHeadline = 'Persistence tried to rewrite returned route text'
  })
  const mutatedReturn = await service.getLockedPlan({ planId: mutationPlanId })
  assert.equal(mutatedReturn.ok, false)
  assert.equal(mutatedReturn.ok ? null : mutatedReturn.code, 'persistence_truth_mutation')

  return {
    failedSave: failedSave.ok ? null : failedSave.code,
    concurrentPlanIds: [firstPlanId, secondPlanId],
    retryPlanId: retry.ok ? retry.value.plan.planId : null,
    conflict: conflict.ok ? null : conflict.code,
    ownerScopedPlanId: ownerScoped.ok ? ownerScoped.value.plan.planId : null,
    failedPublish: failedPublish.ok ? null : failedPublish.code,
    shareIds,
    failedDelete: failedDelete.ok ? null : failedDelete.code,
    deletedShares: deleted.ok ? deleted.value.revokedShareVersionIds : [],
    staleReturn: staleReturn.ok ? null : staleReturn.code,
    publishDeleted: publishDeleted.ok ? null : publishDeleted.code,
    revokedShare: revokedShare.ok ? null : revokedShare.code,
    mutatedReturn: mutatedReturn.ok ? null : mutatedReturn.code,
  }
}

const first = await runProof()
const second = await runProof()
assert.deepEqual(second, first)
assert.equal(fetchCalls, 0)

console.log(
  JSON.stringify(
    {
      result: 'PASS',
      proof: 'move4_lifecycle_idempotency_concurrency',
      providerCalls: 0,
      fetchCalls,
      externalNetworkCalls: 0,
      deterministicRunsEqual: true,
      summary: first,
    },
    null,
    2,
  ),
)
