import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { strict as assert } from 'node:assert'

import {
  buildSteeringSwapProposalDisplay,
  buildSteeringSwapProposalSelection,
} from '../src/app/steering/steeringProposalDisplay.ts'
import {
  buildLockInputFromRouteAuthoritySnapshot,
  buildRouteAuthoritySnapshot,
} from '../src/app/services/routeAuthority/routeAuthorityService.ts'
import {
  applyPreviewSwapCommit,
  type PreviewSwapStateLike,
  type SwapCommitPlanSnapshotLike,
  type SwapCompatibilityResultLike,
  type SwapReplacementCanonicalLike,
} from '../src/app/services/sandbox/sandboxSwapService.ts'
import { patchFinalRouteStop } from '../src/domain/artifacts/runtimeRouteProjection.ts'
import type {
  RuntimeRouteArtifact,
  RuntimeRouteStop,
} from '../src/domain/artifacts/runtimeRouteArtifact.ts'
import type { ArcCandidate } from '../src/domain/types/arc.ts'
import type { ConciergeIntent, RouteShapeContract } from '../src/domain/types/intent.ts'
import type { Itinerary, ItineraryStop, UserStopRole } from '../src/domain/types/itinerary.ts'
import type {
  SteeringPrelockAcceptedProposal,
  SteeringStopIdentity,
} from '../src/integrations/waypoint/coordination/steeringPrelockProposal.ts'

const projectRoot = process.cwd()
const readSource = (relativePath: string) =>
  readFileSync(join(projectRoot, relativePath), 'utf8')

const sandboxSource = readSource('src/pages/SandboxConciergePage.tsx')
const routeSpineSource = readSource('src/components/journey/RouteSpine.tsx')
const nearbyNodeSource = readSource('src/components/journey/NearbyNodeGroup.tsx')
const displaySource = readSource('src/app/steering/steeringProposalDisplay.ts')

const originalFetch = globalThis.fetch
let fetchCallCount = 0

globalThis.fetch = (async (input) => {
  fetchCallCount += 1
  throw new Error(`Steering UI apply observer must not call fetch: ${String(input)}`)
}) as typeof fetch

function assertContains(source: string, marker: string, label: string): void {
  assert.ok(source.includes(marker), `${label} missing marker: ${marker}`)
}

function assertExcludes(source: string, marker: string, label: string): void {
  assert.ok(!source.includes(marker), `${label} must not contain marker: ${marker}`)
}

function runtimeStop(
  role: UserStopRole,
  stopIndex: number,
  venueId: string,
  displayName: string,
): RuntimeRouteStop {
  return {
    id: `stop:${venueId}`,
    sourceStopId: `itinerary:${venueId}`,
    displayName,
    providerRecordId: `provider:${venueId}`,
    latitude: 37.33 + stopIndex * 0.001,
    longitude: -121.89 - stopIndex * 0.001,
    address: `${displayName}, San Jose, CA`,
    role,
    stopIndex,
    venueId,
    title: role === 'windDown' ? 'Wind Down' : role === 'highlight' ? 'Highlight' : 'Start',
    subtitle: 'Steering UI apply fixture',
    neighborhood: 'SoFA',
    driveMinutes: 8,
    imageUrl: `https://example.test/${venueId}.jpg`,
  }
}

function runtimeRoute(routeId = 'runtime:steering-ui-apply'): RuntimeRouteArtifact {
  const stops = [
    runtimeStop('start', 0, 'sj-start', 'Start Fixture'),
    runtimeStop('highlight', 1, 'sj-original-highlight', 'Original Highlight'),
    runtimeStop('windDown', 2, 'sj-wind-down', 'Wind Down Fixture'),
  ]
  return {
    routeId,
    selectedDirectionId: 'direction:steering-ui-apply',
    location: 'San Jose',
    persona: 'friends',
    vibe: 'lively',
    stops,
    activeStopIndex: 0,
    routeHeadline: 'Steering UI apply fixture',
    routeSummary: 'Original reviewed route before steering proposal selection.',
    mapMarkers: stops.map((stop) => ({
      id: stop.id,
      displayName: stop.displayName,
      role: stop.role,
      stopIndex: stop.stopIndex,
      latitude: stop.latitude,
      longitude: stop.longitude,
    })),
    liveNotices: [],
    updatedAt: 1_787_000_000_000,
  }
}

function itineraryStop(role: UserStopRole, venueId: string, venueName: string): ItineraryStop {
  return {
    id: `itinerary:${venueId}`,
    role,
    title: role === 'windDown' ? 'Wind Down' : role === 'highlight' ? 'Highlight' : 'Start',
    venueId,
    venueName,
    formattedAddress: `${venueName}, San Jose, CA`,
    latitude: 37.33,
    longitude: -121.89,
    city: 'San Jose',
    category: 'bar',
    subcategory: 'fixture',
    priceTier: '$$',
    tags: ['fixture'],
    vibeTags: ['lively'],
    neighborhood: 'SoFA',
    driveMinutes: 8,
    durationClass: 'medium',
    estimatedDurationMinutes: 45,
    estimatedDurationLabel: '45 min',
    subtitle: 'Fixture stop',
    imageUrl: `https://example.test/${venueId}.jpg`,
    stopInsider: {
      roleReason: 'Fixture role',
      localSignal: 'Fixture signal',
      selectionReason: 'Fixture selection',
    },
  }
}

function itinerary(highlightVenueId = 'sj-original-highlight'): Itinerary {
  const highlightName =
    highlightVenueId === 'sj-steering-selected-highlight'
      ? 'Steering Selected Highlight'
      : 'Original Highlight'
  return {
    id: 'itinerary:steering-ui-apply',
    title: 'Steering UI apply route',
    city: 'San Jose',
    crew: 'socialite',
    vibes: ['lively'],
    stops: [
      itineraryStop('start', 'sj-start', 'Start Fixture'),
      itineraryStop('highlight', highlightVenueId, highlightName),
      itineraryStop('windDown', 'sj-wind-down', 'Wind Down Fixture'),
    ],
    transitions: [],
    totalRouteFriction: 0.2,
    estimatedTotalMinutes: 135,
    estimatedTotalLabel: '2 hr 15 min',
    routeFeelLabel: 'Tight runtime continuity',
    story: {
      headline: 'Steering UI apply route',
      subtitle: 'Runtime authority fixture',
    },
    shareSummary: 'Steering UI apply route',
  }
}

function intent(): ConciergeIntent {
  return {
    id: 'intent:steering-ui-apply',
    intentMode: 'anchored',
    objective: {
      primary: 'preserve_route_integrity',
      occasion: 'connect',
    },
    controlPosture: {
      mode: 'user_directed',
    },
    experienceProfile: {
      persona: 'friends',
      vibe: 'lively',
      pacing: 'balanced',
      socialEnergy: 'medium',
      explorationTolerance: 'medium',
    },
    anchorPosture: {
      mode: 'soft',
      anchorType: 'none',
      anchorValue: 'steering-ui-apply',
    },
    constraintPosture: {
      travelTolerance: 'balanced',
      structureRigidity: 'tight',
      swapTolerance: 'medium',
    },
    realityPosture: {
      liveSignalPriority: 'high',
      coherencePriority: 'high',
      noveltyPriority: 'low',
      certaintyPriority: 'high',
    },
    starterLineage: {
      source: 'none',
    },
    anchorLineage: {
      source: 'none',
    },
    candidateLineage: {
      source: 'selected_candidate_route_artifact',
      candidateArtifactId: 'candidate:steering-ui-apply',
      directionId: 'direction:steering-ui-apply',
      lineageSummary: 'Steering UI apply observer fixture',
    },
  }
}

const routeShapeContract = {
  id: 'route-shape:steering-ui-apply',
  arcShape: 'fast_open_strong_center_clean_landing',
  roleProfile: {},
  roleInvariants: {},
  movementProfile: {
    radius: 'balanced',
    maxTransitionMinutes: 12,
    neighborhoodContinuity: 'preferred',
  },
  mutationProfile: {
    swapFlexibility: 'medium',
    allowedRoles: ['highlight'],
    preservePriority: ['role', 'feasibility', 'district'],
  },
  expansionProfile: {
    supportsNearbyExtensions: true,
    preferredExpansionRole: 'windDown',
    lateNightTolerance: 'medium',
  },
} as unknown as RouteShapeContract

function fieldIdentity(params: {
  baseVenueId: string
  displayName: string
  providerRecordId: string
}): SteeringStopIdentity {
  return {
    source: 'field',
    baseVenueId: params.baseVenueId,
    venueId: params.baseVenueId,
    displayName: params.displayName,
    providerRecordId: params.providerRecordId,
    neighborhood: 'SoFA',
    identityStatus: 'resolved',
  }
}

function acceptedProposal(): SteeringPrelockAcceptedProposal {
  const currentStopIdentity = fieldIdentity({
    baseVenueId: 'sj-original-highlight',
    displayName: 'Original Highlight',
    providerRecordId: 'live_google_original_highlight',
  })
  const candidateIdentity = fieldIdentity({
    baseVenueId: 'sj-steering-selected-highlight',
    displayName: 'Steering Selected Highlight',
    providerRecordId: 'live_google_selected_highlight',
  })
  return {
    status: 'proposed',
    action: 'swap_stop',
    targetRole: 'highlight',
    currentStopIdentity,
    candidateIdentity,
    roleFitEvidence: [
      {
        source: 'taste',
        key: 'role_suitability',
        authority: 'owner_evidence',
        value: 0.91,
        role: 'highlight',
        verdict: 'strong_fit',
      },
    ],
    feasibility: [
      {
        source: 'bearings',
        key: 'admission',
        authority: 'owner_evidence',
        value: true,
        status: 'feasible',
      },
    ],
    movementDelta: {
      source: 'bearings',
      key: 'movement_delta',
      authority: 'owner_evidence',
      value: -3,
      currentTravelMinutes: 8,
      candidateTravelMinutes: 5,
      deltaMinutes: -3,
      direction: 'shorter',
      originAware: true,
    },
    rank: {
      source: 'waypoint',
      rank: 1,
      score: 0.94,
      tieBreakKey: 'sj-steering-selected-highlight',
      rankingBasis: 'owner_evidence',
    },
    provenance: {
      waypoint: {
        source: 'waypoint',
        key: 'steering_prelock_proposal',
        action: 'swap_stop',
      },
      ownerTrace: [
        { source: 'taste', key: 'role_suitability' },
        { source: 'bearings', key: 'admission' },
        { source: 'bearings', key: 'movement_delta' },
        { source: 'field', key: 'candidate_identity' },
      ],
    },
  }
}

function routeIds(route: RuntimeRouteArtifact): string[] {
  return [...route.stops]
    .sort((left, right) => left.stopIndex - right.stopIndex)
    .map((stop) => stop.venueId)
}

try {
  assertContains(displaySource, 'buildSteeringSwapProposalSelection', 'Display selection helper')
  assertContains(displaySource, 'proposal.candidateIdentity.baseVenueId?.trim()', 'Route identity source')
  assertContains(routeSpineSource, 'onSelectSteeringProposal', 'RouteSpine selection handoff')
  assertContains(nearbyNodeSource, 'onSelectSteeringProposal(proposal.proposal)', 'NearbyNodeGroup accepted proposal handoff')
  assertContains(sandboxSource, 'handleSelectSteeringProposal', 'Sandbox selected proposal handler')
  assertContains(sandboxSource, 'buildSteeringSwapProposalSelection(proposal)', 'Sandbox selection projection')
  assertContains(
    sandboxSource,
    'handlePreviewAlternative(selection.targetRole, selection.routeIdentity)',
    'Sandbox preview path handoff',
  )
  assertExcludes(displaySource, 'scoreAnchoredRoleFit', 'Steering display/apply projection')

  const proposal = acceptedProposal()
  const display = buildSteeringSwapProposalDisplay({
    currentStopLabel: 'Original Highlight',
    currentRole: 'highlight',
    coordination: {
      proposals: [proposal],
      acceptedProposals: [proposal],
      rankingAttribution: ['Waypoint arbitration over owner evidence'],
    },
  })
  const displayItem = display.proposals[0]
  assert.ok(displayItem, 'Display must expose accepted proposal.')
  assert.equal(displayItem.proposal, proposal, 'Display item must retain selected proposal payload.')
  const selection = buildSteeringSwapProposalSelection(displayItem.proposal)
  assert.ok(selection, 'Selection must resolve from proposal payload.')
  assert.equal(selection.targetRole, 'highlight')
  assert.equal(selection.routeIdentity, 'sj-steering-selected-highlight')
  assert.equal(selection.providerRecordId, 'live_google_selected_highlight')
  assert.notEqual(
    selection.routeIdentity,
    selection.providerRecordId,
    'Provider ID must remain provenance/debug, not route identity.',
  )

  const originalRoute = runtimeRoute()
  const replacementCanonical: SwapReplacementCanonicalLike = {
    displayName: selection.displayName,
    providerRecordId: selection.providerRecordId ?? 'provider:missing',
    latitude: 37.332,
    longitude: -121.892,
    addressLine: `${selection.displayName}, San Jose, CA`,
    city: 'San Jose',
    neighborhood: 'SoFA',
  }
  const swapSnapshot: PreviewSwapStateLike = {
    role: selection.targetRole,
    targetRouteId: originalRoute.routeId,
    targetStopId: 'stop:sj-original-highlight',
    targetStopIndex: 1,
    targetRole: selection.targetRole,
    swapBeforeStopId: 'stop:sj-original-highlight',
    requestedReplacementId: selection.routeIdentity,
    originalStop: itineraryStop('highlight', 'sj-original-highlight', 'Original Highlight'),
    candidateStop: itineraryStop('highlight', selection.routeIdentity, selection.displayName),
    replacementCanonical,
    swappedArc: { id: 'arc:steering-ui-apply-swapped' } as ArcCandidate,
    swappedItinerary: itinerary(selection.routeIdentity),
  }
  const planSnapshot: SwapCommitPlanSnapshotLike = {
    itinerary: itinerary(),
    selectedArc: { id: 'arc:steering-ui-apply-original' } as ArcCandidate,
    selectedDirectionContract: {
      id: originalRoute.selectedDirectionId,
    },
    selectedDirectionPreviewContext: {
      label: 'Steering UI apply route',
    },
    routeShapeContract,
    conciergeIntent: intent(),
    runtimeFieldReality: {
      source: 'static_runtime_fixture',
      role: 'highlight',
      venueId: 'sj-original-highlight',
      available: false,
      reasonCodes: ['fixture_runtime_unavailable'],
    },
  }

  const commitResult = applyPreviewSwapCommit(
    {
      role: selection.targetRole,
      swapSnapshot,
      planSnapshot,
      finalRouteSnapshot: originalRoute,
      routeVersionAtClick: 5,
      canonicalStopByRole: {
        highlight: replacementCanonical,
      },
    },
    {
      applyCanonicalIdentityToItinerary: (nextItinerary) => nextItinerary,
      evaluateSwapCompatibility: (): SwapCompatibilityResultLike => ({
        swapCompatibilityPassed: true,
        swapCompatibilityReason: 'fixture-compatible',
        swapCompatibilityRejectClass: 'none',
        preservedRole: true,
        preservedDistrict: true,
        preservedFamily: true,
        preservedFeasibility: true,
        softDirectionDriftDetected: false,
      }),
      patchFinalRouteStop,
      getSharedItineraryStopFallbackImageUrl: () => 'https://example.test/fallback.jpg',
      hydrateRuntimeRouteStopDisplayFields: () => ({
        title: 'Highlight',
        subtitle: 'Selected steering proposal',
        driveMinutes: 5,
        imageUrl: 'https://example.test/steering-selected-highlight.jpg',
      }),
      getNonEmptyRuntimeRouteString: (value) => (value && value.trim() ? value : null),
      getPreviewSwapFeedback: () => 'Swap preview applied.',
    },
  )

  const reviewedRoute = commitResult.nextFinalRoute
  assert.equal(
    reviewedRoute.stops[1]?.venueId,
    selection.routeIdentity,
    'Reviewed route must contain selected proposal at target slot.',
  )
  assert.notEqual(
    reviewedRoute.stops[1]?.venueId,
    'sj-original-highlight',
    'Original stop must no longer occupy target slot.',
  )
  assert.equal(
    commitResult.swapDebugBreadcrumb.swapRequestedReplacementId,
    selection.routeIdentity,
    'Preview commit path must use selected proposal route identity.',
  )
  assert.equal(
    commitResult.swapDebugBreadcrumb.lceDiagnostics?.routeSource,
    'runtime_route_artifact',
    'Preview commit path must preserve RuntimeRouteArtifact authority.',
  )

  const snapshot = buildRouteAuthoritySnapshot({
    runtimeRouteArtifact: reviewedRoute,
    selectedDirectionId: reviewedRoute.selectedDirectionId,
    selectedClusterConfirmation: 'Steering UI proposal applied.',
    itinerary: commitResult.nextItinerary,
  })
  const lockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot,
    activeRole: 'highlight',
    fallbackCity: 'San Jose',
  })
  assert.equal(lockInput.ok, true, 'Steered reviewed route must remain lockable.')
  assert.deepEqual(
    routeIds(lockInput.input.canonicalRouteArtifact.finalRoute),
    routeIds(reviewedRoute),
    'Locked route must equal reviewed route after proposal apply.',
  )

  const refusedDisplay = buildSteeringSwapProposalDisplay({
    currentStopLabel: 'Original Highlight',
    currentRole: 'highlight',
    coordination: {
      proposals: [
        {
          status: 'refused',
          action: 'swap_stop',
          targetRole: 'highlight',
          currentStopIdentity: proposal.currentStopIdentity,
          refusalReason: {
            source: 'waypoint',
            refusalClass: 'no_admissible_replacement',
            userFacingCapable: true,
            messageKey: 'steering.swap.no_admissible_replacement',
            ownerEvidenceNeeded: ['bearings'],
          },
          provenance: {
            waypoint: {
              source: 'waypoint',
              key: 'steering_prelock_proposal',
              action: 'swap_stop',
            },
            ownerTrace: [{ source: 'bearings', key: 'admission' }],
          },
        },
      ],
      acceptedProposals: [],
      refusalProposal: {
        status: 'refused',
        action: 'swap_stop',
        targetRole: 'highlight',
        currentStopIdentity: proposal.currentStopIdentity,
        refusalReason: {
          source: 'waypoint',
          refusalClass: 'no_admissible_replacement',
          userFacingCapable: true,
          messageKey: 'steering.swap.no_admissible_replacement',
          ownerEvidenceNeeded: ['bearings'],
        },
        provenance: {
          waypoint: {
            source: 'waypoint',
            key: 'steering_prelock_proposal',
            action: 'swap_stop',
          },
          ownerTrace: [{ source: 'bearings', key: 'admission' }],
        },
      },
      rankingAttribution: ['Waypoint arbitration over owner evidence'],
    },
  })
  assert.equal(refusedDisplay.proposals.length, 0, 'Refusal state must expose no fake alternatives.')
  assert.equal(
    refusedDisplay.refusal?.message,
    'No replacement clears the route constraints right now.',
    'Refusal state must keep explicit refusal copy.',
  )

  assert.equal(fetchCallCount, 0, `Expected provider silence, fetch called ${fetchCallCount}.`)

  console.log(
    JSON.stringify(
      {
        observer: 'steering_ui_apply_proposal',
        selectedProposal: {
          targetRole: selection.targetRole,
          routeIdentity: selection.routeIdentity,
          providerRecordId: selection.providerRecordId,
          providerPromotedToIdentity: false,
          rank: selection.rank,
        },
        reviewedRoute: {
          before: routeIds(originalRoute),
          after: routeIds(reviewedRoute),
          targetSlot: reviewedRoute.stops[1]?.venueId,
          originalStopSurvivedInTargetSlot:
            reviewedRoute.stops[1]?.venueId === 'sj-original-highlight',
        },
        lock: {
          ok: lockInput.ok,
          routeEqualsReviewedRoute: true,
          targetSlot: lockInput.input.canonicalRouteArtifact.finalRoute.stops[1]?.venueId,
        },
        refusalNoMutation: {
          noAcceptedProposal: refusedDisplay.proposals.length === 0,
          explicitRefusal: refusedDisplay.refusal?.refusalClass,
        },
        providerNetworkCalls: fetchCallCount,
      },
      null,
      2,
    ),
  )
} finally {
  globalThis.fetch = originalFetch
}
