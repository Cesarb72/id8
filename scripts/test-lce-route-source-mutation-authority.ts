import {
  assertLceRuntimeMutationMayCommit,
  buildLceRuntimeContract,
} from '../src/domain/lce/lceRuntimeContract.ts'
import { patchFinalRouteStop } from '../src/domain/artifacts/runtimeRouteProjection.ts'
import {
  buildLockInputFromRouteAuthoritySnapshot,
  buildRouteAuthoritySnapshot,
  type RouteAuthorityLegacySelectedRouteArtifactReference,
  type RouteAuthorityObservedSource,
  type RouteAuthoritySourceKind,
} from '../src/app/services/routeAuthority/routeAuthorityService.ts'
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
    throw new Error(`LCE route-source observer must not call fetch: ${String(input)}`)
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
    subtitle: 'LCE authority fixture',
    neighborhood: 'SoFA',
    driveMinutes: 8,
    imageUrl: `https://example.test/${venueId}.jpg`,
  }
}

function buildRuntimeRoute(routeId = 'runtime:lce-authority'): RuntimeRouteArtifact {
  const stops = [
    buildRuntimeStop('start', 0, 'sj-start', 'Start Fixture'),
    buildRuntimeStop('highlight', 1, 'sj-highlight', 'Highlight Fixture'),
    buildRuntimeStop('windDown', 2, 'sj-wind-down', 'Wind Down Fixture'),
  ]
  return {
    routeId,
    selectedDirectionId: 'direction:lce-authority',
    location: 'San Jose',
    persona: 'friends',
    vibe: 'lively',
    stops,
    activeStopIndex: 0,
    routeHeadline: 'Start Fixture to Highlight Fixture',
    routeSummary: 'Runtime route authority fixture',
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
    id: 'intent:lce-authority',
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
      candidateArtifactId: 'candidate:lce-authority',
      directionId: 'direction:lce-authority',
      anchorVenueId: 'sj-highlight',
      anchorRole: 'highlight',
      lineageSummary: 'RuntimeRouteArtifact authority observer fixture',
    },
  }
}

function buildRouteShapeContract(): RouteShapeContract {
  return {
    id: 'route-shape:lce-authority',
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
    id: 'itinerary:lce-authority',
    title: 'LCE authority route',
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
      headline: 'LCE authority route',
      subtitle: 'Runtime authority fixture',
    },
    shareSummary: 'LCE authority route',
  }
}

function buildSelectedRouteArtifact(
  finalRoute: RuntimeRouteArtifact,
): RouteAuthorityLegacySelectedRouteArtifactReference {
  return {
    source: 'committed',
    directionId: finalRoute.selectedDirectionId,
    candidateArtifactId: 'candidate:lce-authority',
    canonicalRouteArtifact: {
      finalRoute,
    },
  }
}

function sourceByKind(
  sources: RouteAuthorityObservedSource[],
  kind: RouteAuthoritySourceKind,
): RouteAuthorityObservedSource {
  const source = sources.find((item) => item.kind === kind)
  assert(source !== undefined, `Missing routeAuthority observed source: ${kind}`)
  return source
}

function assertSelectedRouteArtifactRejected(finalRoute: RuntimeRouteArtifact): void {
  const selectedRouteArtifact = buildSelectedRouteArtifact(finalRoute)
  const snapshot = buildRouteAuthoritySnapshot({
    legacySelectedRouteArtifact: selectedRouteArtifact,
    selectedClusterConfirmation: 'LCE selected route artifact authority rejection',
    itinerary: buildItinerary(),
  })
  const source = sourceByKind(snapshot.observedSources, 'legacy_selected_route_artifact')
  assert(source.present, 'SelectedRouteArtifact fixture must be observed.')
  assert(
    source.classification === 'legacy_compatibility',
    'SelectedRouteArtifact must be legacy compatibility, not authority.',
  )
  assert(
    snapshot.lockReadyCanonicalRouteTruthCandidate === null,
    'SelectedRouteArtifact alone must not become lock-ready authority.',
  )
  assert(
    snapshot.rejectionReasons.includes('legacy_sources_cannot_author_lock_ready_truth'),
    'SelectedRouteArtifact-only snapshot must explain legacy authority rejection.',
  )

  const lockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert(!lockInput.ok, 'SelectedRouteArtifact alone must not build lock input.')
  assert(
    lockInput.diagnostics.lockInputSource === null,
    'SelectedRouteArtifact alone must not identify an authority source.',
  )

  const lceContract = buildLceRuntimeContract({
    source: 'scripts.test-lce-route-source.selected-route-only',
    mutationKind: 'swap',
    phase: 'preview',
    targetRole: 'highlight',
    userConfirmed: false,
  })
  const gate = assertLceRuntimeMutationMayCommit(lceContract)
  assert(lceContract.route === null, 'SelectedRouteArtifact must not implicitly feed LCE.')
  assert(lceContract.diagnostics.routeSource === 'none', 'SelectedRouteArtifact must not be an LCE route source.')
  assert(!gate.ok && gate.reason === 'lce_runtime_route_missing', 'LCE must reject selected-route-only authority.')
}

function assertPageLocalFinalRouteRejected(finalRoute: RuntimeRouteArtifact): void {
  const snapshot = buildRouteAuthoritySnapshot({
    pageLocalFinalRoute: finalRoute,
    selectedClusterConfirmation: 'LCE page-local finalRoute authority rejection',
    itinerary: buildItinerary(),
  })
  const source = sourceByKind(snapshot.observedSources, 'page_local_final_route')
  assert(source.present, 'page-local finalRoute fixture must be observed.')
  assert(
    source.classification === 'page_local_authoring',
    'page-local finalRoute must be classified as page-local authoring.',
  )
  assert(
    snapshot.lockReadyCanonicalRouteTruthCandidate === null,
    'page-local finalRoute alone must not become lock-ready authority.',
  )
  assert(
    snapshot.rejectionReasons.includes('legacy_sources_cannot_author_lock_ready_truth'),
    'page-local-only snapshot must explain legacy/page-local authority rejection.',
  )

  const lockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert(!lockInput.ok, 'page-local finalRoute alone must not build lock input.')
  assert(
    lockInput.diagnostics.lockInputSource === null,
    'page-local finalRoute alone must not identify an authority source.',
  )

  const lceContract = buildLceRuntimeContract({
    source: 'scripts.test-lce-route-source.page-local-only',
    mutationKind: 'swap',
    phase: 'preview',
    targetRole: 'highlight',
    userConfirmed: false,
  })
  const gate = assertLceRuntimeMutationMayCommit(lceContract)
  assert(lceContract.route === null, 'page-local finalRoute must not implicitly feed LCE.')
  assert(lceContract.diagnostics.routeSource === 'none', 'page-local finalRoute must not be an LCE route source.')
  assert(!gate.ok && gate.reason === 'lce_runtime_route_missing', 'LCE must reject page-local-only authority.')
}

function assertRuntimeRouteFirst(finalRoute: RuntimeRouteArtifact): void {
  const canonicalFallback = buildRuntimeRoute('runtime:lce-canonical-fallback')
  const contract = buildLceRuntimeContract({
    source: 'scripts.test-lce-route-source.runtime-first',
    mutationKind: 'swap',
    phase: 'preview',
    targetRole: 'highlight',
    canonicalRoute: canonicalFallback,
    runtimeRouteArtifact: finalRoute,
    conciergeIntent: buildConciergeIntent(),
    routeShapeContract: buildRouteShapeContract(),
    userConfirmed: false,
  })
  assert(contract.route === finalRoute, 'LCE must choose RuntimeRouteArtifact over canonicalRoute fallback.')
  assert(
    contract.route !== canonicalFallback,
    'LCE must not fall back to canonicalRoute when RuntimeRouteArtifact is present.',
  )
  assert(
    contract.diagnostics.routeSource === 'runtime_route_artifact',
    'LCE route source must identify RuntimeRouteArtifact.',
  )
  assert(
    contract.diagnostics.consumedRuntimeRouteArtifact,
    'LCE diagnostics must record RuntimeRouteArtifact consumption.',
  )
  assert(
    contract.diagnostics.reasonCodes.includes('lce_consumed_runtime_route_artifact'),
    'LCE reason codes must include RuntimeRouteArtifact consumption.',
  )
  assert(
    !contract.diagnostics.reasonCodes.some((reason) => reason.includes('selected_route')),
    'LCE must not contain SelectedRouteArtifact fallback reason codes.',
  )
  assert(
    !contract.diagnostics.reasonCodes.some((reason) => reason.includes('page_local')),
    'LCE must not contain page-local fallback reason codes.',
  )
}

function assertSandboxSwapRuntimePatch(finalRoute: RuntimeRouteArtifact): RuntimeRouteArtifact {
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
    swappedArc: { id: 'arc:lce-authority-swapped' } as ArcCandidate,
    swappedItinerary: buildItinerary('sj-replacement-highlight'),
  }
  const planSnapshot: SwapCommitPlanSnapshotLike = {
    itinerary: buildItinerary(),
    selectedArc: { id: 'arc:lce-authority-original' } as ArcCandidate,
    selectedDirectionContract: {
      id: finalRoute.selectedDirectionId,
    },
    selectedDirectionPreviewContext: {
      label: 'LCE authority route',
    },
    routeShapeContract: buildRouteShapeContract(),
    conciergeIntent: buildConciergeIntent(),
    runtimeFieldReality: {
      source: 'static_runtime_fixture',
      role: 'highlight',
      venueId: 'sj-highlight',
      available: false,
      reasonCodes: ['fixture_runtime_unavailable'],
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

  const lceDiagnostics = result.swapDebugBreadcrumb.lceDiagnostics
  assert(lceDiagnostics?.consumedRuntimeRouteArtifact === true, 'Sandbox swap must consume RuntimeRouteArtifact.')
  assert(lceDiagnostics.routeSource === 'runtime_route_artifact', 'Sandbox swap LCE route source must be runtime.')
  assert(lceDiagnostics.userConfirmed === true, 'Sandbox swap LCE contract must be user-confirmed.')
  assert(
    lceDiagnostics.reasonCodes.includes('lce_user_confirmed_mutation'),
    'Sandbox swap LCE contract must record user confirmation.',
  )
  assert(
    lceDiagnostics.reasonCodes.includes('lce_runtime_mutation_commit_allowed'),
    'Sandbox swap LCE contract must pass the commit gate.',
  )
  assert(
    result.nextFinalRoute !== finalRoute,
    'Sandbox swap must produce a patched RuntimeRouteArtifact instance.',
  )
  assert(
    result.nextFinalRoute.stops[1]?.venueId === 'sj-replacement-highlight',
    'Sandbox swap must patch RuntimeRouteArtifact stop identity.',
  )
  assert(
    result.nextFinalRoute.liveNotices.includes('highlight swapped to Replacement Highlight.'),
    'Sandbox swap must carry the runtime route patch notice.',
  )
  assert(
    result.swapDebugBreadcrumb.swapRenderSource === 'renderOnlyFinalRoute',
    'Sandbox swap must not promote page-local route truth to canonical authority.',
  )
  return result.nextFinalRoute
}

function main(): void {
  installFetchTrap()
  try {
    const finalRoute = buildRuntimeRoute()
    assertRuntimeRouteFirst(finalRoute)
    assertSelectedRouteArtifactRejected(finalRoute)
    assertPageLocalFinalRouteRejected(finalRoute)
    const patchedRoute = assertSandboxSwapRuntimePatch(finalRoute)
    assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)

    const summary = {
      fetchCallCount,
      runtimeFirstRouteSource: 'runtime_route_artifact',
      selectedRouteAuthorityRejected: true,
      pageLocalAuthorityRejected: true,
      sandboxSwapUserConfirmed: true,
      patchedRouteIds: patchedRoute.stops.map((stop) => stop.venueId),
    }
    process.stdout.write('lce route source mutation authority: passed\n')
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  } finally {
    restoreFetch()
  }
}

main()
