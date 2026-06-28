import { patchFinalRouteStop } from '../src/domain/artifacts/runtimeRouteProjection.ts'
import {
  assertLceRuntimeMutationMayCommit,
  buildLceRuntimeContract,
} from '../src/domain/lce/lceRuntimeContract.ts'
import {
  applyPreviewSwapCommit,
  type PreviewSwapStateLike,
  type SwapCommitPlanSnapshotLike,
  type SwapCompatibilityResultLike,
  type SwapReplacementCanonicalLike,
} from '../src/app/services/sandbox/sandboxSwapService.ts'
import type {
  RuntimeRouteArtifact,
  RuntimeRouteStop,
} from '../src/domain/artifacts/runtimeRouteArtifact.ts'
import type { ArcCandidate } from '../src/domain/types/arc.ts'
import type { ConciergeIntent, RouteShapeContract } from '../src/domain/types/intent.ts'
import type { Itinerary, ItineraryStop, UserStopRole } from '../src/domain/types/itinerary.ts'

const originalFetch = globalThis.fetch
let fetchCallCount = 0

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function installFetchTrap(): void {
  globalThis.fetch = (async (input) => {
    fetchCallCount += 1
    throw new Error(`LCE contract threading test must not call fetch: ${String(input)}`)
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
    sourceStopId: `source:${venueId}`,
    displayName,
    providerRecordId: `provider:${venueId}`,
    latitude: 37.33 + stopIndex * 0.001,
    longitude: -121.89 - stopIndex * 0.001,
    address: `${displayName}, San Jose, CA`,
    role,
    stopIndex,
    venueId,
    title: role === 'windDown' ? 'Wind Down' : role === 'highlight' ? 'Highlight' : 'Start',
    subtitle: 'Contract-threaded runtime stop',
    neighborhood: 'SoFA',
    driveMinutes: 8,
    imageUrl: `https://example.test/${venueId}.jpg`,
  }
}

function buildRuntimeRoute(): RuntimeRouteArtifact {
  const stops = [
    buildRuntimeStop('start', 0, 'sj-start', 'Start Fixture'),
    buildRuntimeStop('highlight', 1, 'sj-highlight', 'Highlight Fixture'),
    buildRuntimeStop('windDown', 2, 'sj-wind-down', 'Wind Down Fixture'),
  ]
  return {
    routeId: 'runtime:lce-threading',
    selectedDirectionId: 'direction:lce-threading',
    location: 'San Jose',
    persona: 'friends',
    vibe: 'lively',
    stops,
    activeStopIndex: 0,
    routeHeadline: 'Start Fixture to Highlight Fixture',
    routeSummary: 'Runtime route fixture',
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

function buildConciergeIntent(): ConciergeIntent {
  return {
    id: 'intent:lce-threading',
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
      mode: 'hard',
      anchorType: 'venue',
      anchorValue: 'sj-highlight',
      roleHint: 'highlight',
    },
    constraintPosture: {
      travelTolerance: 'balanced',
      structureRigidity: 'tight',
      swapTolerance: 'low',
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
      source: 'build_anchor',
      anchorId: 'sj-highlight',
      displayName: 'Highlight Fixture',
      roleHint: 'highlight',
      required: true,
    },
    candidateLineage: {
      source: 'selected_candidate_route_artifact',
      candidateArtifactId: 'candidate:lce-threading',
      directionId: 'direction:lce-threading',
      anchorVenueId: 'sj-highlight',
      anchorRole: 'highlight',
      lineageSummary: 'RuntimeRouteArtifact preservation test',
    },
  }
}

function buildRouteShapeContract(): RouteShapeContract {
  return {
    id: 'route-shape:lce-threading',
    arcShape: 'fast_open_strong_center_clean_landing',
    roleProfile: {
      start: { intent: 'set-tone', energyLevel: 'medium', pacing: 'balanced', variability: 'guided-flex' },
      highlight: { intent: 'centerpiece', energyLevel: 'high', pacing: 'linger', variability: 'fixed' },
      windDown: { intent: 'landing', energyLevel: 'low', pacing: 'linger', variability: 'guided-flex' },
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
    category: 'bar' as ItineraryStop['category'],
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

function buildItinerary(highlightVenueId = 'sj-highlight'): Itinerary {
  const stops = [
    buildItineraryStop('start', 'sj-start', 'Start Fixture'),
    buildItineraryStop('highlight', highlightVenueId, 'Replacement Highlight'),
    buildItineraryStop('windDown', 'sj-wind-down', 'Wind Down Fixture'),
  ]
  return {
    id: 'itinerary:lce-threading',
    title: 'LCE threading route',
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
      headline: 'LCE threading route',
      subtitle: 'Runtime preservation fixture',
    },
    shareSummary: 'LCE threading route',
  }
}

function main(): void {
  installFetchTrap()
  try {
    const finalRoute = buildRuntimeRoute()
    const conciergeIntent = buildConciergeIntent()
    const routeShapeContract = buildRouteShapeContract()
    const previewContract = buildLceRuntimeContract({
      source: 'scripts.test-lce-contract-threading.preview',
      mutationKind: 'swap',
      phase: 'preview',
      targetRole: 'highlight',
      runtimeRouteArtifact: finalRoute,
      conciergeIntent,
      routeShapeContract,
      runtimeFieldReality: {
        source: 'static_runtime_fixture',
        role: 'highlight',
        venueId: 'sj-highlight',
        available: false,
        reasonCodes: ['fixture_runtime_unavailable'],
      },
      userConfirmed: false,
    })
    assert(previewContract.route === finalRoute, 'LCE contract must consume RuntimeRouteArtifact.')
    assert(previewContract.diagnostics.consumedConciergeIntent, 'LCE contract must consume ConciergeIntent.')
    assert(previewContract.diagnostics.swapTolerance === 'low', 'ConciergeIntent swap tolerance must win.')
    assert(previewContract.diagnostics.anchorPreservation.required, 'Hard anchor must require preservation.')
    assert(
      previewContract.diagnostics.reasonCodes.includes('lce_waits_for_user_confirmation'),
      'Preview phase must wait for user confirmation.',
    )
    assert(
      !assertLceRuntimeMutationMayCommit(previewContract).ok,
      'Unconfirmed LCE mutation must not be committable.',
    )

    const replacementCanonical: SwapReplacementCanonicalLike = {
      displayName: 'Replacement Highlight',
      providerRecordId: 'provider:sj-replacement-highlight',
      latitude: 37.335,
      longitude: -121.895,
      addressLine: 'Replacement Highlight, San Jose, CA',
      city: 'San Jose',
      neighborhood: 'SoFA',
    }
    const replacementStop = buildItineraryStop(
      'highlight',
      'sj-replacement-highlight',
      'Replacement Highlight',
    )
    const swappedItinerary = buildItinerary('sj-replacement-highlight')
    const swapSnapshot: PreviewSwapStateLike = {
      role: 'highlight',
      targetRouteId: finalRoute.routeId,
      targetStopId: 'stop:sj-highlight',
      targetStopIndex: 1,
      targetRole: 'highlight',
      swapBeforeStopId: 'stop:sj-highlight',
      requestedReplacementId: 'sj-replacement-highlight',
      originalStop: buildItineraryStop('highlight', 'sj-highlight', 'Highlight Fixture'),
      candidateStop: replacementStop,
      replacementCanonical,
      swappedArc: { id: 'arc:swapped' } as ArcCandidate,
      swappedItinerary,
    }
    const planSnapshot: SwapCommitPlanSnapshotLike = {
      itinerary: buildItinerary(),
      selectedArc: { id: 'arc:original' } as ArcCandidate,
      selectedDirectionContract: {
        id: finalRoute.selectedDirectionId,
      },
      selectedDirectionPreviewContext: {
        label: 'LCE threading route',
      },
      routeShapeContract,
      conciergeIntent,
      runtimeFieldReality: {
        source: 'static_runtime_fixture',
        role: 'highlight',
        venueId: 'sj-highlight',
        available: false,
      },
    }
    const result = applyPreviewSwapCommit(
      {
        role: 'highlight',
        swapSnapshot,
        planSnapshot,
        finalRouteSnapshot: finalRoute,
        routeVersionAtClick: 7,
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
          driveMinutes: 8,
          imageUrl: 'https://example.test/replacement.jpg',
        }),
        getNonEmptyRuntimeRouteString: (value) => (value && value.trim() ? value : null),
        getPreviewSwapFeedback: () => 'Preview confirmed.',
      },
    )
    assert(
      result.nextFinalRoute.stops[1]?.venueId === 'sj-replacement-highlight',
      'Confirmed swap must patch RuntimeRouteArtifact stop identity.',
    )
    assert(
      result.swapDebugBreadcrumb.lceDiagnostics?.consumedRuntimeRouteArtifact === true,
      'Swap breadcrumb must show LCE consumed RuntimeRouteArtifact.',
    )
    assert(
      result.swapDebugBreadcrumb.lceDiagnostics?.consumedConciergeIntent === true,
      'Swap breadcrumb must show LCE consumed ConciergeIntent.',
    )
    assert(
      result.swapDebugBreadcrumb.lceDiagnostics?.silentMutationAllowed === false,
      'LCE diagnostics must never allow silent mutation.',
    )
    assert(
      result.swapDebugBreadcrumb.lceDiagnostics?.reasonCodes.includes(
        'lce_runtime_mutation_commit_allowed',
      ),
      'Confirmed swap must include LCE commit-allowed reason code.',
    )
    assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)
    process.stdout.write('lce contract threading: passed\n')
    process.stdout.write(
      JSON.stringify(
        {
          fetchCallCount,
          previewReasonCodes: previewContract.diagnostics.reasonCodes,
          commitReasonCodes: result.swapDebugBreadcrumb.lceDiagnostics?.reasonCodes,
          routeIds: result.nextFinalRoute.stops.map((stop) => stop.venueId),
        },
        null,
        2,
      ),
    )
    process.stdout.write('\n')
  } finally {
    restoreFetch()
  }
}

main()
