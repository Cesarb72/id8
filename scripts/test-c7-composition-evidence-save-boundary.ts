import assert from 'node:assert/strict'
import { buildLockedLiveArtifactPayload } from '../src/app/services/live/liveSessionHandoff.ts'
import {
  buildLockInputFromRouteAuthoritySnapshot,
  buildRouteAuthoritySnapshot,
} from '../src/app/services/routeAuthority/routeAuthorityService.ts'
import {
  buildCompositionEvidenceRouteIdentitySignature,
  cloneCompositionEvidenceLineage,
  type CompositionEvidenceLineage,
} from '../src/domain/artifacts/compositionEvidenceLineage.ts'
import type { ContractEntryArtifact } from '../src/domain/artifacts/contractEntryArtifact.ts'
import type { RuntimeRouteArtifact, RuntimeRouteStop } from '../src/domain/artifacts/runtimeRouteArtifact.ts'
import { validateLockedLiveArtifactSessionPayload } from '../src/domain/live/validateLiveArtifact.ts'
import type { Itinerary, ItineraryStop, UserStopRole } from '../src/domain/types/itinerary.ts'

let fetchCalls = 0
globalThis.fetch = ((input: RequestInfo | URL) => {
  fetchCalls += 1
  throw new Error(`C7 composition-evidence save-boundary proof must not call providers: ${String(input)}`)
}) as typeof fetch

const routeIds = {
  start: 'venue-start',
  highlight: 'venue-highlight',
  windDown: 'venue-wind-down',
}

function itineraryStop(role: UserStopRole, index: number): ItineraryStop {
  const titleByRole: Record<UserStopRole, ItineraryStop['title']> = {
    start: 'Start',
    highlight: 'Highlight',
    surprise: 'Surprise',
    windDown: 'Wind Down',
  }
  const venueId = role === 'windDown' ? routeIds.windDown : routeIds[role as 'start' | 'highlight']
  return {
    id: venueId,
    role,
    title: titleByRole[role],
    venueId,
    venueName: `${titleByRole[role]} Venue`,
    formattedAddress: '1 San Jose Way',
    latitude: 37.33 + index * 0.001,
    longitude: -121.89 - index * 0.001,
    city: 'San Jose',
    category: 'bar' as never,
    subcategory: 'proof',
    priceTier: '$$' as never,
    tags: ['proof'],
    vibeTags: ['cozy'],
    neighborhood: 'Downtown',
    driveMinutes: index === 0 ? 0 : 8,
    durationClass: 'medium',
    estimatedDurationMinutes: 45,
    estimatedDurationLabel: '45 min',
    subtitle: 'Proof stop',
    imageUrl: 'https://example.test/c7-proof.jpg',
    stopInsider: {
      roleReason: 'Proof role',
      localSignal: 'Proof signal',
      selectionReason: 'Proof selection',
    },
  }
}

function runtimeStop(role: 'start' | 'highlight' | 'windDown', index: number): RuntimeRouteStop {
  const venueId = routeIds[role]
  return {
    id: venueId,
    sourceStopId: venueId,
    displayName: `${role} Venue`,
    providerRecordId: venueId,
    latitude: 37.33 + index * 0.001,
    longitude: -121.89 - index * 0.001,
    address: '1 San Jose Way',
    role,
    stopIndex: index,
    venueId,
    title: `${role} Venue`,
    subtitle: 'Proof stop',
    neighborhood: 'Downtown',
    driveMinutes: index === 0 ? 0 : 8,
    imageUrl: 'https://example.test/c7-proof.jpg',
  }
}

const itinerary: Itinerary = {
  id: 'itinerary-c7-proof',
  title: 'C7 proof route',
  city: 'San Jose',
  crew: 'date-night',
  vibes: ['cozy'],
  stops: [itineraryStop('start', 0), itineraryStop('highlight', 1), itineraryStop('windDown', 2)],
  transitions: [],
  totalRouteFriction: 0.2,
  estimatedTotalMinutes: 150,
  estimatedTotalLabel: '2.5 hr',
  routeFeelLabel: 'Tight',
  story: {
    headline: 'C7 proof',
    subtitle: 'Durable composition evidence',
  },
  shareSummary: 'C7 proof route.',
}

const finalRoute: RuntimeRouteArtifact = {
  routeId: 'runtime-c7-proof',
  selectedDirectionId: 'direction-c7',
  location: 'San Jose',
  persona: 'romantic',
  vibe: 'cozy',
  stops: [runtimeStop('start', 0), runtimeStop('highlight', 1), runtimeStop('windDown', 2)],
  activeStopIndex: 0,
  routeHeadline: 'C7 proof route',
  routeSummary: 'Durable composition evidence proof route.',
  mapMarkers: [runtimeStop('start', 0), runtimeStop('highlight', 1), runtimeStop('windDown', 2)].map(
    (stop) => ({
      id: stop.id,
      displayName: stop.displayName,
      role: stop.role,
      stopIndex: stop.stopIndex,
      latitude: stop.latitude,
      longitude: stop.longitude,
    }),
  ),
  liveNotices: [],
  updatedAt: 1,
}

const approvedRouteIdentitySignature = buildCompositionEvidenceRouteIdentitySignature(routeIds)

const lineage: CompositionEvidenceLineage = {
  schemaVersion: 'composition_evidence_lineage.v0_1',
  source: 'contract_entry_artifact.generation',
  approvedAt: 1,
  approvedCandidateId: 'arc-c7-proof',
  approvedRouteIdentitySignature,
  approvedRouteIdentity: routeIds,
  inputCarrier: {
    routeShapeContractId: 'route-shape-c7',
    conciergeIntentId: 'concierge-intent-c7',
    experienceContractId: 'experience-contract-c7',
    contractConstraintsId: 'contract-constraints-c7',
    routeShapeProjectionId: 'projection-c7',
    selectedDirectionId: 'direction-c7',
    selectedPocketId: 'pocket-c7',
  },
  taste: {
    source: 'taste.experience_composition.v0_1',
    status: 'pass',
    requirementSource: 'route_shape_contract',
    routeShapeContractId: 'route-shape-c7',
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
    routeShapeContractId: 'route-shape-c7',
    projectionId: 'projection-c7',
    selectedCandidateId: 'arc-c7-proof',
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
    selectedCandidateId: 'arc-c7-proof',
    selectedCandidateRank: 1,
    failedCriteria: [],
    reasonCodes: [],
  },
}

function artifactWithLineage(
  compositionEvidenceLineage: CompositionEvidenceLineage | undefined,
  identities = routeIds,
): ContractEntryArtifact {
  return {
    id: 'contract-entry-c7-proof',
    sourceOpportunityId: 'arc-c7-proof',
    anchorVenueId: identities.highlight,
    anchorRole: 'highlight',
    anchorName: 'Highlight Venue',
    routeTitle: 'C7 proof route',
    flavorLine: 'Proof flavor',
    routeSummary: 'Proof route summary.',
    traits: ['proof'],
    storySpine: {
      start: 'Start Venue',
      highlight: 'Highlight Venue',
      windDown: 'Wind Down Venue',
    },
    districtLine: 'Downtown',
    districtAnchorLine: 'District anchor: Downtown',
    authorityLine: 'Authority 100%',
    whyChooseLine: 'Proof selected.',
    selection: {
      directionId: 'direction-c7',
      pocketId: 'pocket-c7',
    },
    enrichment: {
      canonicalRouteRoleCoverage: {
        start: 'Start Venue',
        highlight: 'Highlight Venue',
        windDown: 'Wind Down Venue',
        support: [
          { role: 'start', name: 'Start Venue', venueId: identities.start },
          { role: 'highlight', name: 'Highlight Venue', venueId: identities.highlight },
          { role: 'windDown', name: 'Wind Down Venue', venueId: identities.windDown },
        ],
      },
      runtimeLockEligibility: {
        eligible: true,
        status: 'eligible',
        rejectionReasons: [],
        greatStopStatus: 'PASS',
        greatStopFailedCriteria: [],
        greatStopRejectionReasons: [],
        selectedDirectionId: 'direction-c7',
      },
      ...(compositionEvidenceLineage ? { compositionEvidenceLineage } : {}),
    },
  }
}

const snapshot = buildRouteAuthoritySnapshot({
  contractEntryArtifact: artifactWithLineage(lineage),
  runtimeRouteArtifact: finalRoute,
  selectedDirectionId: 'direction-c7',
  selectedArtifactId: 'contract-entry-c7-proof',
  selectedClusterConfirmation: 'C7 proof confirmed.',
  itinerary,
})
assert.equal(snapshot.validationStatus, 'valid')
assert(snapshot.lockReadyCanonicalRouteTruthCandidate?.compositionEvidenceLineage)

const lockInput = buildLockInputFromRouteAuthoritySnapshot({
  snapshot,
  activeRole: 'highlight',
  fallbackCity: 'San Jose',
  requireCompositionEvidenceLineage: true,
})
assert.equal(lockInput.ok, true)
assert.equal(
  lockInput.ok
    ? lockInput.input.canonicalRouteArtifact.compositionEvidenceLineage?.approvedRouteIdentitySignature
    : null,
  approvedRouteIdentitySignature,
)

const payload = buildLockedLiveArtifactPayload(lockInput.ok ? lockInput.input : assert.fail('Expected lock input.'))
assert.equal(payload.compositionEvidenceLineage?.approvedRouteIdentitySignature, approvedRouteIdentitySignature)

const validated = validateLockedLiveArtifactSessionPayload(JSON.parse(JSON.stringify(payload)))
assert.equal(validated.ok, true)
assert.equal(
  validated.ok ? validated.payload.compositionEvidenceLineage?.approvedRouteIdentitySignature : null,
  approvedRouteIdentitySignature,
)
assert.deepEqual(validated.ok ? validated.payload.compositionEvidenceLineage : null, lineage)
assert.equal(validated.ok ? validated.payload.compositionEvidenceLineage?.approvedAt : null, 1)

const staleLineage = cloneCompositionEvidenceLineage(lineage)
staleLineage.approvedRouteIdentity.highlight = 'stale-highlight'
staleLineage.approvedRouteIdentitySignature = buildCompositionEvidenceRouteIdentitySignature(
  staleLineage.approvedRouteIdentity,
)
const staleValidated = validateLockedLiveArtifactSessionPayload({
  ...payload,
  compositionEvidenceLineage: staleLineage,
})
assert.equal(staleValidated.ok, false)
assert.equal(staleValidated.ok ? null : staleValidated.error.code, 'invalid_composition_evidence_lineage')

const missingLineageSnapshot = buildRouteAuthoritySnapshot({
  contractEntryArtifact: artifactWithLineage(undefined),
  runtimeRouteArtifact: finalRoute,
  selectedDirectionId: 'direction-c7',
  selectedArtifactId: 'contract-entry-c7-proof',
  selectedClusterConfirmation: 'C7 proof confirmed.',
  itinerary,
})
const missingLineageLockInput = buildLockInputFromRouteAuthoritySnapshot({
  snapshot: missingLineageSnapshot,
  activeRole: 'highlight',
  fallbackCity: 'San Jose',
  requireCompositionEvidenceLineage: true,
})
assert.equal(missingLineageLockInput.ok, false)
assert.equal(
  missingLineageLockInput.diagnostics.rejectionReason,
  'missing_composition_evidence_lineage',
)

const compatibilityPayload = {
  ...payload,
}
delete compatibilityPayload.compositionEvidenceLineage
const compatibilityValidated = validateLockedLiveArtifactSessionPayload(compatibilityPayload)
assert.equal(compatibilityValidated.ok, true)
assert.equal(compatibilityValidated.ok ? compatibilityValidated.payload.compositionEvidenceLineage : null, undefined)

const changedRouteIds = {
  ...routeIds,
  highlight: 'venue-new-highlight',
}
const changedFinalRoute: RuntimeRouteArtifact = {
  ...finalRoute,
  routeId: 'runtime-c7-proof-changed',
  stops: finalRoute.stops.map((stop) =>
    stop.role === 'highlight'
      ? {
          ...stop,
          id: changedRouteIds.highlight,
          sourceStopId: changedRouteIds.highlight,
          venueId: changedRouteIds.highlight,
          providerRecordId: changedRouteIds.highlight,
          displayName: 'New Highlight Venue',
          title: 'New Highlight Venue',
        }
      : stop,
  ),
  mapMarkers: finalRoute.mapMarkers.map((marker) =>
    marker.role === 'highlight'
      ? {
          ...marker,
          id: changedRouteIds.highlight,
          displayName: 'New Highlight Venue',
        }
      : marker,
  ),
}
const changedItinerary: Itinerary = {
  ...itinerary,
  stops: itinerary.stops.map((stop) =>
    stop.role === 'highlight'
      ? {
          ...stop,
          id: changedRouteIds.highlight,
          venueId: changedRouteIds.highlight,
          venueName: 'New Highlight Venue',
        }
      : stop,
  ),
}
const changedLineage = cloneCompositionEvidenceLineage(lineage)
changedLineage.approvedAt = 2
changedLineage.approvedCandidateId = 'arc-c7-proof-changed'
changedLineage.approvedRouteIdentity = changedRouteIds
changedLineage.approvedRouteIdentitySignature = buildCompositionEvidenceRouteIdentitySignature(changedRouteIds)
changedLineage.waypoint.selectedCandidateId = 'arc-c7-proof-changed'
changedLineage.greatStop.selectedCandidateId = 'arc-c7-proof-changed'
const changedSnapshot = buildRouteAuthoritySnapshot({
  contractEntryArtifact: artifactWithLineage(changedLineage, changedRouteIds),
  runtimeRouteArtifact: changedFinalRoute,
  selectedDirectionId: 'direction-c7',
  selectedArtifactId: 'contract-entry-c7-proof',
  selectedClusterConfirmation: 'C7 changed proof confirmed.',
  itinerary: changedItinerary,
})
const changedLockInput = buildLockInputFromRouteAuthoritySnapshot({
  snapshot: changedSnapshot,
  activeRole: 'highlight',
  fallbackCity: 'San Jose',
  requireCompositionEvidenceLineage: true,
})
assert.equal(changedLockInput.ok, true)
const changedPayload = buildLockedLiveArtifactPayload(
  changedLockInput.ok ? changedLockInput.input : assert.fail('Expected changed lock input.'),
)
const changedValidated = validateLockedLiveArtifactSessionPayload(JSON.parse(JSON.stringify(changedPayload)))
assert.equal(changedValidated.ok, true)
assert.equal(
  changedValidated.ok
    ? changedValidated.payload.compositionEvidenceLineage?.approvedRouteIdentitySignature
    : null,
  changedLineage.approvedRouteIdentitySignature,
)
assert.notEqual(
  changedValidated.ok
    ? changedValidated.payload.compositionEvidenceLineage?.approvedRouteIdentitySignature
    : null,
  approvedRouteIdentitySignature,
)
const changedRouteWithPriorEvidence = validateLockedLiveArtifactSessionPayload({
  ...changedPayload,
  compositionEvidenceLineage: lineage,
})
assert.equal(changedRouteWithPriorEvidence.ok, false)

assert.equal(fetchCalls, 0)

console.log(
  JSON.stringify(
    {
      result: 'PASS',
      proof: 'c7_composition_evidence_save_boundary',
      providerCalls: fetchCalls,
      preservedSignature: approvedRouteIdentitySignature,
      replacementSignature: changedLineage.approvedRouteIdentitySignature,
      missingLineageRejection: missingLineageLockInput.diagnostics.rejectionReason,
      staleLineageRejection: staleValidated.ok ? null : staleValidated.error.code,
      compatibilityAccepted: compatibilityValidated.ok,
    },
    null,
    2,
  ),
)
