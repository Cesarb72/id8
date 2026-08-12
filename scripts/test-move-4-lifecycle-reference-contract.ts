import assert from 'node:assert/strict'
import {
  createLockedPlanLifecycleService,
} from '../src/app/lifecycle/lockedPlanLifecycleService.ts'
import {
  DeterministicLockedPlanIdentitySession,
  DeterministicLockedPlanReferencePersistence,
} from '../src/app/lifecycle/lockedPlanLifecycleReferenceAdapters.ts'
import {
  validateLockedPlanLifecyclePayload,
} from '../src/app/lifecycle/lockedPlanLifecycleValidation.ts'
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

function buildValidPayload(): LiveArtifactSessionPayload {
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
  const approvedRouteIdentitySignature = buildCompositionEvidenceRouteIdentitySignature(routeIds)
  const compositionEvidenceLineage: CompositionEvidenceLineage = {
    schemaVersion: 'composition_evidence_lineage.v0_1',
    source: 'contract_entry_artifact.generation',
    approvedAt: 1,
    approvedCandidateId: 'arc-move-4-proof',
    approvedRouteIdentitySignature,
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
  }
}

let now = 100
const identity = new DeterministicLockedPlanIdentitySession(null)
const persistence = new DeterministicLockedPlanReferencePersistence()
const service = createLockedPlanLifecycleService({
  identity,
  persistence,
  now: () => ++now,
})

const payload = buildValidPayload()
assert.equal(validateLockedLiveArtifactSessionPayload(clone(payload)).ok, true)
assert.equal(validateLockedPlanLifecyclePayload(clone(payload)).ok, true)

const unauthenticated = await service.saveLockedPlan({
  payload,
  saveOperationId: 'save-op-unauthenticated',
})
assert.equal(unauthenticated.ok, false)
assert.equal(unauthenticated.ok ? null : unauthenticated.code, 'unauthenticated')

identity.setAuthenticatedUserId('user-a')

const malformed = await service.saveLockedPlan({
  payload: { ...clone(payload), finalRoute: null } as LiveArtifactSessionPayload,
  saveOperationId: 'save-op-malformed',
})
assert.equal(malformed.ok, false)
assert.equal(malformed.ok ? null : malformed.code, 'missing_final_route')

const routeMismatchPayload = clone(payload)
routeMismatchPayload.finalRoute!.stops[1]!.sourceStopId = 'missing-source-stop'
const routeMismatch = await service.saveLockedPlan({
  payload: routeMismatchPayload,
  saveOperationId: 'save-op-route-mismatch',
})
assert.equal(routeMismatch.ok, false)
assert.equal(routeMismatch.ok ? null : routeMismatch.code, 'route_binding_mismatch')

const lineageMismatchPayload = clone(payload)
lineageMismatchPayload.compositionEvidenceLineage!.approvedRouteIdentity.highlight = 'stale-highlight'
lineageMismatchPayload.compositionEvidenceLineage!.approvedRouteIdentitySignature =
  buildCompositionEvidenceRouteIdentitySignature(
    lineageMismatchPayload.compositionEvidenceLineage!.approvedRouteIdentity,
  )
const lineageMismatch = await service.saveLockedPlan({
  payload: lineageMismatchPayload,
  saveOperationId: 'save-op-lineage-mismatch',
})
assert.equal(lineageMismatch.ok, false)
assert.equal(lineageMismatch.ok ? null : lineageMismatch.code, 'lineage_binding_mismatch')

const saved = await service.saveLockedPlan({
  payload,
  saveOperationId: 'save-op-primary',
})
assert.equal(saved.ok, true)
assert.equal(saved.ok ? saved.value.plan.planId : null, 'plan_0001')
assert.equal(saved.ok ? saved.value.plan.routeId : null, payload.finalRoute!.routeId)
assert.equal(saved.ok ? saved.value.idempotentReplay : null, false)
assert.deepEqual(saved.ok ? saved.value.plan.payload : null, validateLockedLiveArtifactSessionPayload(payload).ok ? validateLockedLiveArtifactSessionPayload(payload).payload : null)
assert.equal(
  saved.ok ? saved.value.plan.payload.compositionEvidenceLineage?.approvedCandidateId : null,
  'arc-move-4-proof',
)

const returned = await service.getLockedPlan({ planId: saved.ok ? saved.value.plan.planId : 'missing' })
assert.equal(returned.ok, true)
assert.deepEqual(returned.ok ? returned.value.payload : null, saved.ok ? saved.value.plan.payload : null)
assert.equal(validateLockedLiveArtifactSessionPayload(returned.ok ? returned.value.payload : null).ok, true)

identity.setAuthenticatedUserId('user-b')
const unauthorized = await service.getLockedPlan({ planId: saved.ok ? saved.value.plan.planId : 'missing' })
assert.equal(unauthorized.ok, false)
assert.equal(unauthorized.ok ? null : unauthorized.code, 'plan_not_found')

const otherSaved = await service.saveLockedPlan({
  payload: { ...clone(payload), sessionId: 'session-user-b' },
  saveOperationId: 'save-op-user-b',
})
assert.equal(otherSaved.ok, true)

const userBList = await service.listLockedPlans()
assert.equal(userBList.ok, true)
assert.deepEqual(
  userBList.ok ? userBList.value.plans.map((plan) => plan.ownerUserId) : [],
  ['user-b'],
)

identity.setAuthenticatedUserId('user-a')
const userAList = await service.listLockedPlans()
assert.equal(userAList.ok, true)
assert.deepEqual(
  userAList.ok ? userAList.value.plans.map((plan) => plan.planId) : [],
  ['plan_0001'],
)

const firstShare = await service.publishShare({ planId: saved.ok ? saved.value.plan.planId : 'missing' })
const secondShare = await service.publishShare({ planId: saved.ok ? saved.value.plan.planId : 'missing' })
assert.equal(firstShare.ok, true)
assert.equal(secondShare.ok, true)
assert.notEqual(
  firstShare.ok ? firstShare.value.share.shareVersionId : null,
  secondShare.ok ? secondShare.value.share.shareVersionId : null,
)

const firstShareRead = await service.readShare({
  shareVersionId: firstShare.ok ? firstShare.value.share.shareVersionId : 'missing',
})
assert.equal(firstShareRead.ok, true)
assert.deepEqual(
  firstShareRead.ok ? firstShareRead.value.snapshotPayload : null,
  firstShare.ok ? firstShare.value.share.snapshotPayload : null,
)

const originalShareHeadline = firstShareRead.ok
  ? firstShareRead.value.snapshotPayload.finalRoute?.routeHeadline
  : null
persistence.mutateStoredPlanPayloadForProof(saved.ok ? saved.value.plan.planId : 'missing', (plan) => {
  plan.payload.finalRoute!.routeHeadline = 'Persistence tried to rewrite the owner plan'
})
const mutatedPlanReturn = await service.getLockedPlan({
  planId: saved.ok ? saved.value.plan.planId : 'missing',
})
assert.equal(mutatedPlanReturn.ok, false)
assert.equal(mutatedPlanReturn.ok ? null : mutatedPlanReturn.code, 'persistence_truth_mutation')

const immutableShareRead = await service.readShare({
  shareVersionId: firstShare.ok ? firstShare.value.share.shareVersionId : 'missing',
})
assert.equal(immutableShareRead.ok, true)
assert.equal(
  immutableShareRead.ok ? immutableShareRead.value.snapshotPayload.finalRoute?.routeHeadline : null,
  originalShareHeadline,
)

const shareMutationTarget = secondShare.ok ? secondShare.value.share.shareVersionId : 'missing'
persistence.mutateStoredShareSnapshotForProof(shareMutationTarget, (share) => {
  share.snapshotPayload.finalRoute!.routeHeadline = 'Persistence tried to rewrite the share'
})
const mutatedShareRead = await service.readShare({ shareVersionId: shareMutationTarget })
assert.equal(mutatedShareRead.ok, false)
assert.equal(mutatedShareRead.ok ? null : mutatedShareRead.code, 'persistence_truth_mutation')

const deleted = await service.deleteLockedPlan({ planId: saved.ok ? saved.value.plan.planId : 'missing' })
assert.equal(deleted.ok, true)
assert.equal(deleted.ok ? deleted.value.alreadyDeleted : null, false)
assert.deepEqual(
  deleted.ok ? deleted.value.revokedShareVersionIds : [],
  ['share_0001', 'share_0002'],
)

const deletedReturn = await service.getLockedPlan({ planId: saved.ok ? saved.value.plan.planId : 'missing' })
assert.equal(deletedReturn.ok, false)
assert.equal(deletedReturn.ok ? null : deletedReturn.code, 'plan_deleted')

const revokedShare = await service.readShare({
  shareVersionId: firstShare.ok ? firstShare.value.share.shareVersionId : 'missing',
})
assert.equal(revokedShare.ok, false)
assert.equal(revokedShare.ok ? null : revokedShare.code, 'share_revoked')

const repeatedDelete = await service.deleteLockedPlan({ planId: saved.ok ? saved.value.plan.planId : 'missing' })
assert.equal(repeatedDelete.ok, true)
assert.equal(repeatedDelete.ok ? repeatedDelete.value.alreadyDeleted : null, true)

const staleSnapshot = persistence.getPlanSnapshotForProof(saved.ok ? saved.value.plan.planId : 'missing')
assert(staleSnapshot)
assert.notEqual(staleSnapshot.deletedAt, null)
const staleReadAfterDelete = await service.getLockedPlan({
  planId: staleSnapshot.planId,
})
assert.equal(staleReadAfterDelete.ok, false)
assert.equal(staleReadAfterDelete.ok ? null : staleReadAfterDelete.code, 'plan_deleted')

const missingShare = await service.readShare({ shareVersionId: 'share_missing' })
assert.equal(missingShare.ok, false)
assert.equal(missingShare.ok ? null : missingShare.code, 'share_not_found')

assert.equal(fetchCalls, 0)

console.log(
  JSON.stringify(
    {
      result: 'PASS',
      proof: 'move4_lifecycle_reference_contract',
      providerCalls: 0,
      fetchCalls,
      externalNetworkCalls: 0,
      savedPlanId: saved.ok ? saved.value.plan.planId : null,
      shares: [
        firstShare.ok ? firstShare.value.share.shareVersionId : null,
        secondShare.ok ? secondShare.value.share.shareVersionId : null,
      ],
      failures: {
        unauthenticated: unauthenticated.ok ? null : unauthenticated.code,
        malformed: malformed.ok ? null : malformed.code,
        routeMismatch: routeMismatch.ok ? null : routeMismatch.code,
        lineageMismatch: lineageMismatch.ok ? null : lineageMismatch.code,
        unauthorizedOwnerScopedLookup: unauthorized.ok ? null : unauthorized.code,
        mutatedPlan: mutatedPlanReturn.ok ? null : mutatedPlanReturn.code,
        mutatedShare: mutatedShareRead.ok ? null : mutatedShareRead.code,
        deletedReturn: deletedReturn.ok ? null : deletedReturn.code,
        revokedShare: revokedShare.ok ? null : revokedShare.code,
      },
    },
    null,
    2,
  ),
)
