import { strict as assert } from 'node:assert'

import { patchFinalRouteStop } from '../src/domain/artifacts/runtimeRouteProjection.ts'
import {
  buildLockInputFromRouteAuthoritySnapshot,
  buildRouteAuthoritySnapshot,
  type RouteAuthorityLegacySelectedRouteArtifactReference,
} from '../src/app/services/routeAuthority/routeAuthorityService.ts'
import {
  applyPreviewSwapCommit,
  type PreviewSwapStateLike,
  type SwapCommitPlanSnapshotLike,
  type SwapCompatibilityResultLike,
  type SwapReplacementCanonicalLike,
} from '../src/app/services/sandbox/sandboxSwapService.ts'
import {
  coordinateSteeringPrelockSwapProposals,
  projectSteeringSwapCandidateForCoordination,
} from '../src/integrations/waypoint/coordination/coordinateSteeringPrelockProposals.ts'
import type { SteeringPrelockAcceptedProposal } from '../src/integrations/waypoint/coordination/steeringPrelockProposal.ts'
import type { ContractEntryArtifact } from '../src/domain/artifacts/contractEntryArtifact.ts'
import type {
  RuntimeRouteArtifact,
  RuntimeRouteStop,
} from '../src/domain/artifacts/runtimeRouteArtifact.ts'
import type { ArcCandidate, ScoredVenue } from '../src/domain/types/arc.ts'
import type { ConciergeIntent, RouteShapeContract } from '../src/domain/types/intent.ts'
import type { Itinerary, ItineraryStop, UserStopRole } from '../src/domain/types/itinerary.ts'

const originalFetch = globalThis.fetch
let fetchCallCount = 0

function installFetchTrap(): void {
  globalThis.fetch = (async (input) => {
    fetchCallCount += 1
    throw new Error(`Steering review-lock handoff observer must not call fetch: ${String(input)}`)
  }) as typeof fetch
}

function restoreFetch(): void {
  globalThis.fetch = originalFetch
}

function buildRuntimeStop(
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
    subtitle: 'Steering review-lock fixture',
    neighborhood: 'SoFA',
    driveMinutes: 8,
    imageUrl: `https://example.test/${venueId}.jpg`,
  }
}

function buildRuntimeRoute(routeId = 'runtime:steering-review-lock'): RuntimeRouteArtifact {
  const stops = [
    buildRuntimeStop('start', 0, 'sj-start', 'Start Fixture'),
    buildRuntimeStop('highlight', 1, 'sj-original-highlight', 'Original Highlight'),
    buildRuntimeStop('windDown', 2, 'sj-wind-down', 'Wind Down Fixture'),
  ]
  return {
    routeId,
    selectedDirectionId: 'direction:steering-review-lock',
    location: 'San Jose',
    persona: 'friends',
    vibe: 'lively',
    stops,
    activeStopIndex: 0,
    routeHeadline: 'Steering review-lock fixture',
    routeSummary: 'Original route before steering.',
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

function buildItineraryStop(role: UserStopRole, venueId: string, venueName: string): ItineraryStop {
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

function buildItinerary(highlightVenueId = 'sj-original-highlight'): Itinerary {
  const highlightName =
    highlightVenueId === 'sj-steering-swapped-highlight'
      ? 'Steering Swapped Highlight'
      : 'Original Highlight'
  const stops = [
    buildItineraryStop('start', 'sj-start', 'Start Fixture'),
    buildItineraryStop('highlight', highlightVenueId, highlightName),
    buildItineraryStop('windDown', 'sj-wind-down', 'Wind Down Fixture'),
  ]
  return {
    id: 'itinerary:steering-review-lock',
    title: 'Steering review-lock route',
    city: 'San Jose',
    crew: 'socialite',
    vibes: ['lively'],
    stops,
    transitions: [],
    totalRouteFriction: 0.2,
    estimatedTotalMinutes: 135,
    estimatedTotalLabel: '2 hr 15 min',
    routeFeelLabel: 'Tight runtime continuity',
    story: {
      headline: 'Steering review-lock route',
      subtitle: 'Runtime authority fixture',
    },
    shareSummary: 'Steering review-lock route',
  }
}

function buildConciergeIntent(): ConciergeIntent {
  return {
    id: 'intent:steering-review-lock',
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
      anchorValue: 'steering-review-lock',
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
      candidateArtifactId: 'candidate:steering-review-lock',
      directionId: 'direction:steering-review-lock',
      lineageSummary: 'Steering review-lock handoff observer fixture',
    },
  }
}

function buildRouteShapeContract(): RouteShapeContract {
  return {
    id: 'route-shape:steering-review-lock',
    arcShape: 'fast_open_strong_center_clean_landing',
    roleProfile: {
      start: {
        intent: 'set-tone',
        energyLevel: 'medium',
        pacing: 'balanced',
        variability: 'guided-flex',
      },
      highlight: {
        intent: 'centerpiece',
        energyLevel: 'high',
        pacing: 'linger',
        variability: 'fixed',
      },
      windDown: {
        intent: 'landing',
        energyLevel: 'low',
        pacing: 'linger',
        variability: 'guided-flex',
      },
    },
    roleInvariants: {
      start: {
        requiredTraits: ['low_friction'],
        preferredTraits: ['social'],
        forbiddenTraits: [],
        allowSwapToWeaker: true,
        allowEscalation: true,
      },
      highlight: {
        requiredTraits: ['centerpiece'],
        preferredTraits: ['lively'],
        forbiddenTraits: [],
        minRelativeIntensity: 'high',
        allowSwapToWeaker: false,
        allowEscalation: false,
      },
      windDown: {
        requiredTraits: ['settling'],
        preferredTraits: ['continuity'],
        forbiddenTraits: [],
        maxRelativeIntensity: 'below_highlight',
        allowSwapToWeaker: true,
        allowEscalation: false,
      },
    },
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
  }
}

function buildScoredVenue(params: {
  id: string
  name: string
  roleScore: number
  driveMinutes: number
  providerRecordId: string
}): ScoredVenue {
  const roleScores = {
    warmup: 0.5,
    peak: params.roleScore,
    wildcard: 0.5,
    cooldown: 0.5,
  }
  return {
    venue: {
      id: params.id,
      name: params.name,
      city: 'San Jose',
      neighborhood: 'SoFA',
      driveMinutes: params.driveMinutes,
      category: 'bar',
      subcategory: 'wine',
      priceTier: '$$',
      tags: [],
      useCases: [],
      vibeTags: ['lively'],
      energyLevel: 0.7,
      socialDensity: 0.6,
      uniquenessScore: 0.6,
      distinctivenessScore: 0.6,
      underexposureScore: 0.5,
      shareabilityScore: 0.5,
      isChain: false,
      localSignals: {
        localFavoriteScore: 0.5,
        neighborhoodPrideScore: 0.5,
        repeatVisitorScore: 0.5,
      },
      roleAffinity: roleScores,
      imageUrl: '',
      shortDescription: '',
      narrativeFlavor: '',
      isHiddenGem: false,
      isActive: true,
      highlightCapable: true,
      durationProfile: {} as never,
      settings: {} as never,
      signature: {} as never,
      source: {
        normalizedFromRawType: 'seed',
        sourceOrigin: 'static-corpus',
        provider: 'fixture',
        providerRecordId: params.providerRecordId,
        formattedAddress: `${params.name}, San Jose, CA`,
        latitude: 37.331,
        longitude: -121.891,
        sourceConfidence: 0.9,
        completenessScore: 0.9,
        qualityScore: 0.9,
        hoursKnown: true,
        likelyOpenForCurrentWindow: true,
        businessStatus: 'OPERATIONAL',
        timeConfidence: 0.9,
        hoursPressureLevel: 'low',
        hoursPressureNotes: [],
        hoursDemotionApplied: false,
        hoursSuppressionApplied: false,
        sourceTypes: [],
        missingFields: [],
        inferredFields: [],
        qualityGateStatus: 'approved',
        qualityGateNotes: [],
        approvalBlockers: [],
        demotionReasons: [],
        suppressionReasons: [],
      },
    },
    candidateIdentity: {
      candidateId: `candidate:${params.id}`,
      baseVenueId: params.id,
      kind: 'base',
      traceLabel: params.name,
    },
    momentIdentity: { type: 'anchor', strength: 'strong' },
    fitBreakdown: {} as never,
    fitScore: params.roleScore,
    hiddenGemScore: 0.5,
    lensCompatibility: 0.7,
    contextSpecificity: {
      overall: 0.7,
      personaSignal: 0.7,
      vibeSignal: 0.7,
      lensSignal: 0.7,
      byRole: roleScores,
    },
    dominanceControl: {
      universalityScore: 0.2,
      flaggedUniversal: false,
      byRole: {
        warmup: 0.2,
        peak: 0.2,
        wildcard: 0.2,
        cooldown: 0.2,
      },
    },
    roleContract: {
      warmup: {} as never,
      peak: {} as never,
      wildcard: {} as never,
      cooldown: {} as never,
    },
    stopShapeFit: {
      start: 0.5,
      highlight: params.roleScore,
      surprise: 0.5,
      windDown: 0.5,
    },
    vibeAuthority: {} as never,
    highlightValidity: {} as never,
    roleScores,
    taste: {
      signals: {} as never,
      modeAlignment: {
        score: 0.7,
        penalty: 0,
        lane: 'balanced' as never,
        tier: 'primary',
        supportiveTagScore: 0,
        lanePriorityScore: 0,
      },
      fallbackPenalty: {
        signalScore: 0,
        appliedPenalty: 0,
        applied: false,
        strongerAlternativePresent: false,
        reason: '',
      },
      rolePoolInfluence: {
        warmup: {} as never,
        peak: {} as never,
        wildcard: {} as never,
        cooldown: {} as never,
      },
    },
  }
}

function buildSelectedProposal(currentStop: ItineraryStop): SteeringPrelockAcceptedProposal {
  const candidate = buildScoredVenue({
    id: 'sj-steering-swapped-highlight',
    name: 'Steering Swapped Highlight',
    roleScore: 0.92,
    driveMinutes: 5,
    providerRecordId: 'provider:steering-swapped-highlight',
  })
  const projected = projectSteeringSwapCandidateForCoordination({
    currentStop,
    candidate,
    targetRole: 'highlight',
    internalRole: 'peak',
  })
  assert.equal(projected.status, 'projected', 'Steering candidate must project from owner evidence.')
  const result = coordinateSteeringPrelockSwapProposals({
    targetRole: 'highlight',
    currentStopIdentity: projected.candidate.currentStopIdentity,
    candidates: [projected.candidate],
  })
  const proposal = result.acceptedProposals[0]
  assert.ok(proposal, 'Waypoint must return an accepted steering proposal.')
  assert.equal(proposal.status, 'proposed')
  assert.equal(proposal.action, 'swap_stop')
  assert.equal(proposal.candidateIdentity.baseVenueId, 'sj-steering-swapped-highlight')
  assert.notEqual(
    proposal.candidateIdentity.baseVenueId,
    proposal.candidateIdentity.providerRecordId,
    'Provider record ID must remain provenance, not route identity.',
  )
  assert.equal(proposal.currentStopIdentity.source, 'field')
  assert.equal(proposal.candidateIdentity.source, 'field')
  assert.equal(proposal.roleFitEvidence[0].source, 'taste')
  assert.equal(proposal.feasibility[0].source, 'bearings')
  assert.equal(proposal.movementDelta?.source, 'bearings')
  return proposal
}

function buildArtifactForSteeredRoute(finalRoute: RuntimeRouteArtifact): ContractEntryArtifact {
  const stops = new Map(finalRoute.stops.map((stop) => [stop.role, stop] as const))
  const start = stops.get('start')
  const highlight = stops.get('highlight')
  const windDown = stops.get('windDown')
  assert.ok(start && highlight && windDown, 'Steered route must include the three core roles.')
  return {
    id: 'artifact:steering-review-lock-steered',
    sourceOpportunityId: 'source:steering-review-lock-steered',
    anchorVenueId: highlight.venueId,
    anchorRole: 'highlight',
    anchorName: highlight.displayName,
    routeTitle: 'Steered review route',
    flavorLine: 'Fixture steered route',
    routeSummary: 'Steered review route summary.',
    traits: ['fixture'],
    storySpine: {
      start: start.displayName,
      highlight: highlight.displayName,
      windDown: windDown.displayName,
    },
    districtLine: 'SoFA',
    districtAnchorLine: 'SoFA',
    authorityLine: 'Runtime route artifact authority fixture.',
    whyChooseLine: 'Proves review-lock handoff.',
    selection: {
      directionId: finalRoute.selectedDirectionId,
    },
    enrichment: {
      canonicalRouteRoleCoverage: {
        start: start.displayName,
        highlight: highlight.displayName,
        windDown: windDown.displayName,
        support: [
          { role: 'start', name: start.displayName, venueId: start.venueId },
          { role: 'highlight', name: highlight.displayName, venueId: highlight.venueId },
          { role: 'windDown', name: windDown.displayName, venueId: windDown.venueId },
        ],
      },
      validationStatus: 'valid',
      runtimeLockEligibility: {
        eligible: true,
        status: 'eligible',
        selectedDirectionId: finalRoute.selectedDirectionId,
        runtimeRouteArtifact: finalRoute,
      },
    },
  }
}

function buildLegacySelectedRouteArtifact(
  finalRoute: RuntimeRouteArtifact,
): RouteAuthorityLegacySelectedRouteArtifactReference {
  return {
    source: 'committed',
    directionId: finalRoute.selectedDirectionId,
    candidateArtifactId: 'legacy:selected-route-artifact:stale',
    canonicalRouteArtifact: {
      finalRoute,
    },
  }
}

function routeIds(route: RuntimeRouteArtifact): string[] {
  return route.stops
    .slice()
    .sort((left, right) => left.stopIndex - right.stopIndex)
    .map((stop) => stop.venueId)
}

function assertRuntimeRouteShape(route: RuntimeRouteArtifact): void {
  assert.equal(route.stops.length, 3, 'RuntimeRouteArtifact must preserve three core stops.')
  assert.equal(route.mapMarkers.length, route.stops.length, 'RuntimeRouteArtifact markers must match stops.')
  for (const stop of route.stops) {
    assert.ok(stop.id.trim(), 'RuntimeRouteArtifact stop id must be present.')
    assert.ok(stop.sourceStopId.trim(), 'RuntimeRouteArtifact sourceStopId must be present.')
    assert.ok(stop.venueId.trim(), 'RuntimeRouteArtifact stop venueId must be present.')
    assert.ok(stop.displayName.trim(), 'RuntimeRouteArtifact stop displayName must be present.')
    assert.ok(Number.isFinite(stop.latitude), 'RuntimeRouteArtifact stop latitude must be finite.')
    assert.ok(Number.isFinite(stop.longitude), 'RuntimeRouteArtifact stop longitude must be finite.')
  }
}

function applySelectedProposal(params: {
  currentRoute: RuntimeRouteArtifact
  selectedProposal: SteeringPrelockAcceptedProposal
}): {
  resultRoute: RuntimeRouteArtifact
  resultItinerary: Itinerary
} {
  const { currentRoute, selectedProposal } = params
  const candidateIdentity = selectedProposal.candidateIdentity
  assert.ok(candidateIdentity.baseVenueId, 'Selected proposal must include a route identity.')
  assert.ok(candidateIdentity.providerRecordId, 'Selected proposal must include provider provenance.')
  const replacementCanonical: SwapReplacementCanonicalLike = {
    displayName: candidateIdentity.displayName,
    providerRecordId: candidateIdentity.providerRecordId,
    latitude: candidateIdentity.latitude ?? 37.331,
    longitude: candidateIdentity.longitude ?? -121.891,
    addressLine:
      candidateIdentity.formattedAddress ??
      `${candidateIdentity.displayName}, San Jose, CA`,
    city: 'San Jose',
    neighborhood: candidateIdentity.neighborhood ?? 'SoFA',
  }
  const replacementStop = buildItineraryStop(
    'highlight',
    candidateIdentity.baseVenueId,
    candidateIdentity.displayName,
  )
  const swappedItinerary = buildItinerary(candidateIdentity.baseVenueId)
  const swapSnapshot: PreviewSwapStateLike = {
    role: 'highlight',
    targetRouteId: currentRoute.routeId,
    targetStopId: 'stop:sj-original-highlight',
    targetStopIndex: 1,
    targetRole: 'highlight',
    swapBeforeStopId: 'stop:sj-original-highlight',
    requestedReplacementId: candidateIdentity.baseVenueId,
    originalStop: buildItineraryStop('highlight', 'sj-original-highlight', 'Original Highlight'),
    candidateStop: replacementStop,
    replacementCanonical,
    swappedArc: { id: 'arc:steering-review-lock-swapped' } as ArcCandidate,
    swappedItinerary,
  }
  const planSnapshot: SwapCommitPlanSnapshotLike = {
    itinerary: buildItinerary(),
    selectedArc: { id: 'arc:steering-review-lock-original' } as ArcCandidate,
    selectedDirectionContract: {
      id: currentRoute.selectedDirectionId,
    },
    selectedDirectionPreviewContext: {
      label: 'Steering review-lock route',
    },
    routeShapeContract: buildRouteShapeContract(),
    conciergeIntent: buildConciergeIntent(),
    runtimeFieldReality: {
      source: 'static_runtime_fixture',
      role: 'highlight',
      venueId: 'sj-original-highlight',
      available: false,
      reasonCodes: ['fixture_runtime_unavailable'],
    },
  }

  const result = applyPreviewSwapCommit(
    {
      role: 'highlight',
      swapSnapshot,
      planSnapshot,
      finalRouteSnapshot: currentRoute,
      routeVersionAtClick: 12,
      canonicalStopByRole: {
        highlight: replacementCanonical,
      },
    },
    {
      applyCanonicalIdentityToItinerary: (itinerary) => itinerary,
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
        subtitle: 'Fixture replacement',
        driveMinutes: 5,
        imageUrl: 'https://example.test/steering-swapped-highlight.jpg',
      }),
      getNonEmptyRuntimeRouteString: (value) => (value && value.trim() ? value : null),
      getPreviewSwapFeedback: () => 'Preview confirmed.',
    },
  )

  assert.equal(
    result.swapDebugBreadcrumb.lceDiagnostics?.routeSource,
    'runtime_route_artifact',
    'Steering commit must consume RuntimeRouteArtifact.',
  )
  assert.equal(
    result.swapDebugBreadcrumb.lceDiagnostics?.userConfirmed,
    true,
    'Steering commit must be user-confirmed before mutation.',
  )
  assert.equal(
    result.swapDebugBreadcrumb.swapRequestedReplacementId,
    candidateIdentity.baseVenueId,
    'Swap breadcrumb must preserve selected proposal route identity.',
  )
  assert.equal(
    result.swapDebugBreadcrumb.swapAppliedReplacementId,
    candidateIdentity.baseVenueId,
    'Swap breadcrumb must prove selected proposal became reviewed route.',
  )

  return {
    resultRoute: result.nextFinalRoute,
    resultItinerary: result.nextItinerary,
  }
}

function main(): void {
  installFetchTrap()
  try {
    const originalReviewedRoute = buildRuntimeRoute()
    const originalReviewedItinerary = buildItinerary()
    const originalIds = routeIds(originalReviewedRoute)
    const selectedProposal = buildSelectedProposal(
      buildItineraryStop('highlight', 'sj-original-highlight', 'Original Highlight'),
    )
    const expectedSwappedStop = selectedProposal.candidateIdentity.baseVenueId
    assert.ok(expectedSwappedStop, 'Selected proposal must include expected swapped stop.')

    const { resultRoute: steeredReviewedRoute, resultItinerary: steeredReviewedItinerary } =
      applySelectedProposal({
        currentRoute: originalReviewedRoute,
        selectedProposal,
      })
    const steeredIds = routeIds(steeredReviewedRoute)

    assertRuntimeRouteShape(steeredReviewedRoute)
    assert.notDeepEqual(steeredIds, originalIds, 'Steered reviewed route IDs must change.')
    assert.equal(
      steeredReviewedRoute.stops[1]?.venueId,
      expectedSwappedStop,
      'Reviewed route must contain the selected proposal in the target slot.',
    )
    assert.notEqual(
      steeredReviewedRoute.stops[1]?.venueId,
      'sj-original-highlight',
      'Reviewed route must not retain original stop in the steered slot.',
    )

    const steeredArtifact = buildArtifactForSteeredRoute(steeredReviewedRoute)
    const snapshot = buildRouteAuthoritySnapshot({
      contractEntryArtifact: steeredArtifact,
      runtimeRouteArtifact: steeredReviewedRoute,
      selectedDirectionId: steeredReviewedRoute.selectedDirectionId,
      selectedArtifactId: steeredArtifact.id,
      selectedClusterConfirmation: 'Steered reviewed route is ready for lock.',
      itinerary: steeredReviewedItinerary,
      legacySelectedRouteArtifact: buildLegacySelectedRouteArtifact(originalReviewedRoute),
    })
    assert.equal(snapshot.validationStatus, 'valid', 'Steered routeAuthority snapshot must remain valid.')
    assert.equal(
      snapshot.lockReadyCanonicalRouteTruthCandidate?.source,
      'contract_entry_artifact.runtime_route_artifact',
      'Lock authority must come from canonical artifact plus RuntimeRouteArtifact.',
    )
    assert.deepEqual(
      snapshot.canonicalRouteIds,
      steeredIds,
      'routeAuthority canonical IDs must match steered reviewed route IDs.',
    )
    assert.ok(
      snapshot.mismatchReasons.includes('legacy_selected_route_artifact_highlight_id_mismatch'),
      'Stale SelectedRouteArtifact compatibility input must be detected as stale.',
    )

    const lockInput = buildLockInputFromRouteAuthoritySnapshot({
      snapshot,
      activeRole: 'start',
      fallbackCity: 'San Jose',
    })
    assert.equal(lockInput.ok, true, 'Steered routeAuthority must produce lock input.')
    assert.deepEqual(
      routeIds(lockInput.input.canonicalRouteArtifact.finalRoute),
      steeredIds,
      'Locked route IDs must match steered reviewed route IDs.',
    )
    assert.equal(
      lockInput.input.canonicalRouteArtifact.finalRoute.stops[1]?.venueId,
      expectedSwappedStop,
      'Lock input must contain the swapped-in stop.',
    )
    assert.notEqual(
      lockInput.input.canonicalRouteArtifact.finalRoute.stops[1]?.venueId,
      'sj-original-highlight',
      'Lock input must not contain the stale original stop in the target slot.',
    )
    assert.equal(
      lockInput.diagnostics.builtFromCanonicalAuthority,
      true,
      'Lock input must be built from canonical routeAuthority.',
    )
    assert.equal(
      lockInput.diagnostics.legacyInputsObserved,
      true,
      'Observer must include stale legacy input pressure.',
    )
    assert.equal(
      lockInput.diagnostics.legacyInputsMatchedCanonicalTruth,
      false,
      'Stale legacy route must not be mistaken for canonical truth.',
    )

    const staleSnapshot = buildRouteAuthoritySnapshot({
      runtimeRouteArtifact: originalReviewedRoute,
      selectedDirectionId: originalReviewedRoute.selectedDirectionId,
      selectedClusterConfirmation: 'Stale route is not the reviewed steered route.',
      itinerary: originalReviewedItinerary,
    })
    const staleLockInput = buildLockInputFromRouteAuthoritySnapshot({
      snapshot: staleSnapshot,
      activeRole: 'start',
      fallbackCity: 'San Jose',
    })
    assert.equal(staleLockInput.ok, true, 'Negative fixture must prove stale route could otherwise lock.')
    assert.equal(
      staleLockInput.input.canonicalRouteArtifact.finalRoute.stops[1]?.venueId,
      'sj-original-highlight',
      'Negative stale lock fixture must retain original stop.',
    )
    assert.notEqual(
      staleLockInput.input.canonicalRouteArtifact.finalRoute.stops[1]?.venueId,
      expectedSwappedStop,
      'Negative stale lock fixture must not contain swapped stop.',
    )
    assert.notDeepEqual(
      routeIds(staleLockInput.input.canonicalRouteArtifact.finalRoute),
      steeredIds,
      'Observer would fail if lock consumed stale pre-steer route IDs.',
    )

    assert.equal(fetchCallCount, 0, `Expected provider silence, fetch called ${fetchCallCount}.`)

    process.stdout.write('steering review-lock handoff: passed\n')
    process.stdout.write(
      `${JSON.stringify(
        {
          observer: 'steering_review_lock_handoff',
          selectedProposal: {
            targetRole: selectedProposal.targetRole,
            candidateBaseVenueId: selectedProposal.candidateIdentity.baseVenueId,
            candidateProviderRecordId: selectedProposal.candidateIdentity.providerRecordId,
            providerPromotedToIdentity: false,
            rank: selectedProposal.rank.rank,
          },
          reviewedRoute: {
            before: originalIds,
            after: steeredIds,
            targetSlotChanged:
              originalReviewedRoute.stops[1]?.venueId !== steeredReviewedRoute.stops[1]?.venueId,
            originalStopSurvivedInTargetSlot:
              steeredReviewedRoute.stops[1]?.venueId === 'sj-original-highlight',
          },
          lockInput: {
            available: lockInput.ok,
            source: lockInput.diagnostics.lockInputSource,
            routeIds: routeIds(lockInput.input.canonicalRouteArtifact.finalRoute),
            targetSlot: lockInput.input.canonicalRouteArtifact.finalRoute.stops[1]?.venueId,
            legacyInputsObserved: lockInput.diagnostics.legacyInputsObserved,
            legacyInputsMatchedCanonicalTruth:
              lockInput.diagnostics.legacyInputsMatchedCanonicalTruth,
          },
          staleNegative: {
            wouldFailIfStaleRouteLocked: true,
            staleTargetSlot:
              staleLockInput.input.canonicalRouteArtifact.finalRoute.stops[1]?.venueId,
            expectedSwappedStop,
          },
          authority: {
            routeAuthorityStatus: snapshot.validationStatus,
            routeAuthoritySource: snapshot.sourceLabel,
            selectedRouteArtifactOverridePrevented: true,
            runtimeRouteArtifactShapeValid: true,
          },
          guardrails: {
            visibleUiTouched: false,
            objectiveUiTouched: false,
            eventsTouched: false,
            providerActivated: false,
            canonicalRepairTouched: false,
            rolePoolRepairTouched: false,
            signatureHighlightTouched: false,
            scoreAnchoredRoleFitConsumed: false,
            providerIdPromotedToRouteIdentity: false,
          },
          fetchCallCount,
        },
        null,
        2,
      )}\n`,
    )
  } finally {
    restoreFetch()
  }
}

main()
