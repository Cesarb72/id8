import {
  buildLockInputFromRouteAuthoritySnapshot,
  buildRouteAuthoritySnapshot,
} from '../src/app/services/routeAuthority/routeAuthorityService.ts'
import {
  buildSandboxCanonicalRouteArtifact,
  projectFinalRouteToPlanningDisplayStops,
} from '../src/app/services/sandbox/canonicalRouteArtifactService.ts'
import type { RuntimeRouteArtifact, RuntimeRouteStop } from '../src/domain/artifacts/runtimeRouteArtifact.ts'
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
    throw new Error(`App-authored truth relocation test must not call fetch: ${String(input)}`)
  }) as typeof fetch
}

function restoreFetch(): void {
  globalThis.fetch = originalFetch
}

function buildStop(
  role: UserStopRole,
  stopIndex: number,
  venueId: string,
  venueName: string,
): ItineraryStop {
  return {
    id: `itinerary:${venueId}`,
    role,
    title: role === 'windDown' ? 'Wind Down' : role === 'highlight' ? 'Highlight' : 'Start',
    venueId,
    venueName,
    formattedAddress: `${venueName}, San Jose, CA`,
    latitude: 37.33 + stopIndex * 0.001,
    longitude: -121.89 - stopIndex * 0.001,
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

function buildItinerary(): Itinerary {
  const stops = [
    buildStop('start', 0, 'sj-willow-court-wine-bar', 'Willow Court Wine Bar'),
    buildStop('highlight', 1, 'sj-theatre-district-jazz-cellar', 'Theatre District Jazz Cellar'),
    buildStop('windDown', 2, 'sj-hedley-club-lounge', 'Hedley Club Lounge'),
  ]
  return {
    id: 'itinerary:app-authored-truth-relocation',
    title: 'Willow Court to Jazz Cellar',
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
      headline: 'Willow Court to Jazz Cellar',
      subtitle: 'Runtime preservation fixture',
    },
    shareSummary: 'Willow Court -> Theatre District Jazz Cellar -> Hedley Club Lounge',
  }
}

function buildRuntimeStop(sourceStop: ItineraryStop, stopIndex: number): RuntimeRouteStop {
  return {
    id: `runtime:${sourceStop.venueId}`,
    sourceStopId: sourceStop.id,
    displayName: sourceStop.venueName,
    providerRecordId: `provider:${sourceStop.venueId}`,
    latitude: sourceStop.latitude ?? 37.33,
    longitude: sourceStop.longitude ?? -121.89,
    address: sourceStop.formattedAddress ?? `${sourceStop.venueName}, San Jose, CA`,
    role: sourceStop.role,
    stopIndex,
    venueId: sourceStop.venueId,
    title: sourceStop.title,
    subtitle: sourceStop.subtitle,
    neighborhood: sourceStop.neighborhood,
    driveMinutes: sourceStop.driveMinutes,
    imageUrl: sourceStop.imageUrl,
  }
}

function buildRuntimeRoute(
  itinerary: Itinerary,
  selectedDirectionId = 'direction:green',
): RuntimeRouteArtifact {
  const stops = itinerary.stops.map((stop, index) => buildRuntimeStop(stop, index))
  return {
    routeId: `runtime:${selectedDirectionId}`,
    selectedDirectionId,
    location: 'San Jose',
    persona: 'friends',
    vibe: 'lively',
    stops,
    activeStopIndex: 0,
    routeHeadline: 'Willow Court to Jazz Cellar',
    routeSummary: 'Willow Court -> Theatre District Jazz Cellar -> Hedley Club Lounge',
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

interface TestPlanSnapshot {
  selectedDirectionContract: {
    id: string
  }
  selectedClusterConfirmation: string
  itinerary: Itinerary
  marker: string
}

function buildPlan(itinerary: Itinerary, directionId = 'direction:green'): TestPlanSnapshot {
  return {
    selectedDirectionContract: {
      id: directionId,
    },
    selectedClusterConfirmation:
      'Willow Court Wine Bar -> Theatre District Jazz Cellar -> Hedley Club Lounge',
    itinerary,
    marker: 'plan-snapshot-preserved',
  }
}

function main(): void {
  installFetchTrap()
  try {
    const itinerary = buildItinerary()
    const plan = buildPlan(itinerary)
    const routeAuthorityFinalRoute = buildRuntimeRoute(itinerary)
    const stalePageLocalRoute = buildRuntimeRoute(itinerary, 'direction:stale-page-local')
    const canonicalStopByRole = {
      start: { venueId: 'sj-willow-court-wine-bar' },
      highlight: { venueId: 'sj-theatre-district-jazz-cellar' },
      windDown: { venueId: 'sj-hedley-club-lounge' },
    }

    const nonBuildArtifact = buildSandboxCanonicalRouteArtifact({
      plan,
      routeAuthorityFinalRoute,
      renderOnlyFinalRoute: routeAuthorityFinalRoute,
      canonicalStopByRole,
      isBuildWrapperActive: false,
    })
    assert(nonBuildArtifact, 'Service must build canonical route artifact for matching non-Build route.')
    assert(nonBuildArtifact.planSnapshot === plan, 'Service must preserve plan snapshot reference.')
    assert(
      nonBuildArtifact.finalRoute === routeAuthorityFinalRoute,
      'Service-built canonical artifact must preserve current non-Build finalRoute behavior.',
    )
    assert(
      nonBuildArtifact.selectedDirectionId === plan.selectedDirectionContract.id,
      'Service-built canonical artifact must use selected direction contract id.',
    )

    const buildArtifact = buildSandboxCanonicalRouteArtifact({
      plan,
      routeAuthorityFinalRoute,
      renderOnlyFinalRoute: stalePageLocalRoute,
      canonicalStopByRole,
      isBuildWrapperActive: true,
    })
    assert(buildArtifact?.finalRoute === routeAuthorityFinalRoute, 'Build path must use routeAuthority finalRoute.')
    assert(
      buildArtifact.finalRoute !== stalePageLocalRoute,
      'Build path must not promote stale page-local finalRoute.',
    )

    const approvedArtifact = buildSandboxCanonicalRouteArtifact({
      approvedPayload: {
        planSnapshot: plan,
        canonicalStopByRole,
      },
      plan: null,
      routeAuthorityFinalRoute,
      renderOnlyFinalRoute: stalePageLocalRoute,
      canonicalStopByRole: {},
      isBuildWrapperActive: false,
    })
    assert(
      approvedArtifact?.finalRoute === routeAuthorityFinalRoute,
      'Approved payload path must use routeAuthority finalRoute.',
    )
    assert(
      approvedArtifact?.canonicalStopByRole === canonicalStopByRole,
      'Approved payload path must preserve approved canonical stop map.',
    )

    const mismatchedArtifact = buildSandboxCanonicalRouteArtifact({
      plan,
      routeAuthorityFinalRoute: stalePageLocalRoute,
      renderOnlyFinalRoute: stalePageLocalRoute,
      canonicalStopByRole,
      isBuildWrapperActive: false,
    })
    assert(!mismatchedArtifact, 'Direction mismatch must not build canonical route artifact.')

    const planningDisplayStops = projectFinalRouteToPlanningDisplayStops(nonBuildArtifact)
    assert(
      planningDisplayStops.map((stop) => stop.venueId).join('|') ===
        [
          'sj-willow-court-wine-bar',
          'sj-theatre-district-jazz-cellar',
          'sj-hedley-club-lounge',
        ].join('|'),
      'Planning display projection must preserve Curate green route identity.',
    )
    assert(
      planningDisplayStops[1]?.venueName === 'Theatre District Jazz Cellar',
      'Planning display projection must derive display venue from finalRoute.',
    )

    const pageLocalOnlySnapshot = buildRouteAuthoritySnapshot({
      pageLocalFinalRoute: routeAuthorityFinalRoute,
      selectedClusterConfirmation: plan.selectedClusterConfirmation,
      itinerary,
    })
    const pageLocalOnlyLockInput = buildLockInputFromRouteAuthoritySnapshot({
      snapshot: pageLocalOnlySnapshot,
      activeRole: 'start',
      fallbackCity: 'San Jose',
    })
    assert(
      !pageLocalOnlyLockInput.ok,
      'Page-local finalRoute alone must not author lock-ready route truth.',
    )
    assert(
      pageLocalOnlySnapshot.rejectionReasons.includes(
        'legacy_sources_cannot_author_lock_ready_truth',
      ),
      'RouteAuthority must remain the canonical authority gate.',
    )

    assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)
    process.stdout.write('app-authored truth relocation: passed\n')
    process.stdout.write(
      JSON.stringify(
        {
          fetchCallCount,
          routeIds: planningDisplayStops.map((stop) => stop.venueId),
          pageLocalOnlyLockReady: pageLocalOnlyLockInput.ok,
          routeAuthorityRejections: pageLocalOnlySnapshot.rejectionReasons,
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
