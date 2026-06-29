import { readFileSync } from 'node:fs'
import {
  buildBuildCardTruthModel,
  type BuildApprovedPayloadReference,
} from '../src/app/services/canonicalPublicRouteTruthService.ts'
import {
  buildLockInputFromRouteAuthoritySnapshot,
  buildRouteAuthoritySnapshot,
} from '../src/app/services/routeAuthority/routeAuthorityService.ts'
import { evaluateBuildSupportReplacementPolicy } from '../src/app/services/routeAuthority/buildSupportReplacementPolicy.ts'
import { evaluateBuildCandidateAdmission } from '../src/app/services/buildCandidateAdmission/buildCandidateAdmissionService.ts'
import { buildAnchorTruthContract } from '../src/domain/artifacts/buildAnchorTruthContract.ts'
import type { ContractEntryArtifact } from '../src/domain/artifacts/contractEntryArtifact.ts'
import type { RuntimeRouteArtifact, RuntimeRouteStop } from '../src/domain/artifacts/runtimeRouteArtifact.ts'
import { curatedVenues } from '../src/data/venues.ts'
import {
  buildProviderPublicLiveEnvelope,
  evaluateBuildProviderPublicLiveEligibility,
} from '../src/domain/providers/buildProviderPublicLiveWiring.ts'
import { buildProviderSourceOpportunity } from '../src/domain/providers/buildProviderSourceOpportunity.ts'
import type { ProviderVenue } from '../src/domain/providers/providerTypes.ts'
import type { ArcCandidate } from '../src/domain/types/arc.ts'
import type { RouteShapeContract } from '../src/domain/types/intent.ts'
import type { Itinerary, ItineraryStop, UserStopRole } from '../src/domain/types/itinerary.ts'

const FIELD_PROXY_PATH = '/api/field/text-search'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const originalFetch = globalThis.fetch
const originalEnv = {
  VITE_ID8_BUILD_PROVIDER_STEP2_INTEGRATION:
    process.env.VITE_ID8_BUILD_PROVIDER_STEP2_INTEGRATION,
  VITE_ID8_BUILD_PROVIDER_SUPPLY: process.env.VITE_ID8_BUILD_PROVIDER_SUPPLY,
  VITE_ID8_BUILD_PROVIDER_VISIBLE_MERGE: process.env.VITE_ID8_BUILD_PROVIDER_VISIBLE_MERGE,
  VITE_ID8_PROVIDER_ENABLE_BUILD_ANCHOR_NEARBY:
    process.env.VITE_ID8_PROVIDER_ENABLE_BUILD_ANCHOR_NEARBY,
  VITE_ID8_SOURCE_MODE: process.env.VITE_ID8_SOURCE_MODE,
}

let fieldProxyFetchAttemptCount = 0
let directProviderFetchAttemptCount = 0
let fieldProxyRequestBody: Record<string, unknown> | null = null

globalThis.fetch = (async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  if (/googleapis|places\.google|maps\.google/i.test(url)) {
    directProviderFetchAttemptCount += 1
    throw new Error(`Direct provider fetch is forbidden in local Build proof: ${url}`)
  }
  if (url !== FIELD_PROXY_PATH) {
    throw new Error(`Unexpected fetch path in local Build proof: ${url}`)
  }

  fieldProxyFetchAttemptCount += 1
  fieldProxyRequestBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
  return new Response(
    JSON.stringify({
      ok: true,
      cache: 'miss',
      budget: {
        date: '2026-06-29',
        cap: 3,
        used: 1,
        remaining: 2,
      },
      results: buildMockProviderVenues(),
      diagnostics: {
        purpose: 'waypoint_nearby',
        queryHash: 'local-phase2-build-proof',
        providerStatus: 'mocked',
        resultCount: 3,
        callConsumed: true,
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
}) as typeof fetch

const staticRouteIds = {
  start: 'sj-petiscos',
  highlight: 'sj-paper-plane',
  windDown: 'sj-hedley-club-lounge',
} as const

const generatedRouteIds = {
  start: 'sj-good-karma',
  highlight: 'sj-paper-plane',
  windDown: 'sj-haberdasher',
} as const

try {
  process.env.VITE_ID8_BUILD_PROVIDER_STEP2_INTEGRATION = 'true'
  process.env.VITE_ID8_BUILD_PROVIDER_SUPPLY = 'true'
  process.env.VITE_ID8_BUILD_PROVIDER_VISIBLE_MERGE = 'true'
  process.env.VITE_ID8_PROVIDER_ENABLE_BUILD_ANCHOR_NEARBY = 'true'
  process.env.VITE_ID8_SOURCE_MODE = 'hybrid'

  assertSourceLevelBrowserGap()

  const publicBuildEligibility = evaluateBuildProviderPublicLiveEligibility({
    isPublicSurface: true,
    isBuildWrapperActive: true,
    isDevOrSandboxCloseoutFlow: false,
    step2IntegrationFlagEnabled: true,
    supplyFlagEnabled: true,
    sourceMode: 'hybrid',
  })
  assert(publicBuildEligibility.eligible, 'Public Build provider path must be eligible.')
  assert(publicBuildEligibility.reasons.length === 0, 'Public Build eligibility must have no reasons.')
  assert(
    publicBuildEligibility.envelope?.liveProviderAllowed === true &&
      publicBuildEligibility.envelope.maxProviderCalls === 3 &&
      publicBuildEligibility.envelope.maxQueryLabels === 3 &&
      publicBuildEligibility.envelope.maxCenters === 1,
    'Public Build eligibility must attach the fixed 3/3/1 envelope.',
  )

  const paperPlane = curatedVenues.find((venue) => venue.id === 'sj-paper-plane')
  assert(paperPlane, 'Paper Plane venue must exist.')
  assert(
    typeof paperPlane.source.latitude === 'number' &&
      typeof paperPlane.source.longitude === 'number',
    'Paper Plane provider-source coordinates must be present.',
  )

  const providerResult = await buildProviderSourceOpportunity({
    anchorVenue: paperPlane,
    liveEnvelope: buildProviderPublicLiveEnvelope(),
  })
  assert(fieldProxyFetchAttemptCount === 1, 'Build flow must attempt exactly one Field proxy fetch.')
  assert(directProviderFetchAttemptCount === 0, 'Build flow must not attempt direct provider fetches.')
  assert(fieldProxyRequestBody?.purpose === 'waypoint_nearby', 'Field proxy purpose must be waypoint_nearby.')
  assert(fieldProxyRequestBody?.mode === 'build', 'Field proxy mode must be build.')
  assert(
    fieldProxyRequestBody?.queryLabel === 'build-provider-nearby',
    'Field proxy query label must remain build-provider-nearby.',
  )
  assert(providerResult.diagnostics.trace !== null, 'Mocked Field proxy attempt must produce a trace.')
  assert(providerResult.diagnostics.ledger !== null, 'Mocked Field proxy attempt must produce a ledger.')
  assert(
    providerResult.diagnostics.buildProviderTraceBillableCallCount === 1,
    'Mocked governed supply must consume one provider call in diagnostics.',
  )
  assert(
    ![
      'build_provider_supply_disabled',
      'anchor_canonical_identity_missing',
      'anchor_provider_record_missing',
      'anchor_coordinates_missing',
      'provider_request_blocked',
      'provider_request_failed',
    ].includes(String(providerResult.diagnostics.buildProviderSupplyBlockedReason)),
    `Mocked governed supply must pass eligibility, coordinate, and Field proxy gates; blockedReason=${providerResult.diagnostics.buildProviderSupplyBlockedReason}.`,
  )
  if (providerResult.opportunity) {
    assert(
      providerResult.opportunity.sourceMode === 'live',
      'Mocked governed supply must remain a live provider-source opportunity.',
    )
  }

  const staticArtifact = buildArtifact({
    id: 'step2_static_build_paper_plane',
    sourceOpportunityId: 'step2_static_build_paper_plane',
    routeIds: staticRouteIds,
    routeSummary: 'Petiscos to Paper Plane to Hedley Club Lounge.',
  })
  const generatedArtifact = buildArtifact({
    id: 'generated_public_build_paper_plane',
    sourceOpportunityId: 'generated_public_build_paper_plane',
    routeIds: generatedRouteIds,
    routeSummary: 'Good Karma to Paper Plane to Haberdasher.',
  })
  const generatedFinalRoute = buildRuntimeRoute({
    routeIds: generatedRouteIds,
    routeSummary: 'Good Karma to Paper Plane to Haberdasher.',
  })
  const generatedItinerary = buildItinerary(generatedRouteIds)
  const anchorContract = buildAnchorTruthContract({
    identity: {
      venueId: 'sj-paper-plane',
      providerRecordId: 'ChIJ2XdOpLzMj4ARkdRQg4ZRVTY',
      displayName: 'Paper Plane',
    },
    role: {
      role: 'highlight',
      roleResolutionSource: 'explicit',
    },
  })

  const staticOnlyTruth = buildBuildCardTruthModel({
    artifact: staticArtifact,
    selectedCandidateArtifact: staticArtifact,
    selectedArtifactId: staticArtifact.id,
    selectedDirectionId: staticArtifact.selection.directionId,
    approvedPayload: null,
    candidateAdmission: null,
    anchorTruthContract: anchorContract,
    selectedAnchorRequiredRole: 'highlight',
    sourceKind: 'static',
    buildProviderSelectionAllowed: true,
    buildProviderMergedIntoVisiblePool: true,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert(!staticOnlyTruth.reviewEligible, 'Static pre-generation card must not be Review-eligible.')
  assert(!staticOnlyTruth.routeAuthorityLockReady, 'Static pre-generation card must not be lock-ready.')

  const generatedAdmission = evaluateBuildCandidateAdmission({
    mode: 'build',
    anchorContract,
    contractEntryArtifact: generatedArtifact,
    runtimeRouteArtifact: generatedFinalRoute,
    buildParked: {
      providerSelectionAllowed: true,
      providerMergedIntoVisiblePool: true,
    },
  })
  assert(generatedAdmission.admitted, 'Generated Build route must pass anchor admission.')

  const replacementPolicy = evaluateBuildSupportReplacementPolicy({
    selectedCandidateArtifact: staticArtifact,
    generatedArtifact,
    finalRoute: generatedFinalRoute,
    selectedArc: buildSelectedArc(generatedRouteIds),
    routeShapeContract: buildRouteShapeContractFixture(),
    selectedAnchorVenueId: 'sj-paper-plane',
    selectedAnchorRequiredRole: 'highlight',
    requiredStopVenueIdsByRole: {
      highlight: 'sj-paper-plane',
    },
  })
  assert(replacementPolicy.admitted, 'Deterministic replacement policy must admit generated support stops.')
  assert(replacementPolicy.deterministic, 'Deterministic replacement policy must be deterministic.')
  assert(
    replacementPolicy.reasonCodes.includes('replacement_selected_by_deterministic_arc') &&
      replacementPolicy.reasonCodes.includes('seed_support_stop_replaced_as_non_required') &&
      replacementPolicy.reasonCodes.includes('replacement_traced_to_post_parity_route'),
    'Deterministic replacement policy must preserve traceable reason codes.',
  )

  const approvedPayload: BuildApprovedPayloadReference = {
    artifactId: generatedArtifact.id,
    selectedDirectionId: generatedFinalRoute.selectedDirectionId,
    finalRoute: generatedFinalRoute,
    selectedClusterConfirmation: 'Generated Paper Plane route is ready for Review.',
    itinerary: generatedItinerary,
    sourceKind: 'static',
  }
  const generatedTruth = buildBuildCardTruthModel({
    artifact: generatedArtifact,
    selectedCandidateArtifact: staticArtifact,
    selectedArtifactId: generatedArtifact.id,
    selectedDirectionId: generatedArtifact.selection.directionId,
    approvedPayload,
    candidateAdmission: generatedAdmission,
    anchorTruthContract: anchorContract,
    selectedAnchorRequiredRole: 'highlight',
    sourceKind: 'static',
    routeReplacementAdmitted: replacementPolicy.admitted,
    buildProviderSelectionAllowed: true,
    buildProviderMergedIntoVisiblePool: true,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert(generatedTruth.reviewEligible, 'Generated Build truth must make Review eligible.')
  assert(generatedTruth.routeAuthorityLockReady, 'Generated Build truth must be routeAuthority lock-ready.')
  assert(generatedTruth.diagnostics.lockInputAvailable, 'Generated Build truth must expose lock input.')

  const providerShadowTruth = buildBuildCardTruthModel({
    artifact: generatedArtifact,
    selectedCandidateArtifact: staticArtifact,
    selectedArtifactId: generatedArtifact.id,
    selectedDirectionId: generatedArtifact.selection.directionId,
    approvedPayload,
    candidateAdmission: generatedAdmission,
    anchorTruthContract: anchorContract,
    selectedAnchorRequiredRole: 'highlight',
    sourceKind: 'provider_shadow',
    routeReplacementAdmitted: replacementPolicy.admitted,
    buildProviderSelectionAllowed: true,
    buildProviderMergedIntoVisiblePool: true,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert(!providerShadowTruth.reviewEligible, 'Provider-shadow artifacts must remain non-authority.')

  const routeAuthoritySnapshot = buildRouteAuthoritySnapshot({
    contractEntryArtifact: generatedArtifact,
    runtimeRouteArtifact: generatedFinalRoute,
    selectedDirectionId: generatedArtifact.selection.directionId,
    selectedArtifactId: generatedArtifact.id,
    selectedClusterConfirmation: 'Generated Paper Plane route is ready for Review.',
    itinerary: generatedItinerary,
    buildContext: {
      mode: 'build',
      selectedCandidateArtifact: staticArtifact,
      selectedCandidateSourceKind: 'build_static_pre_generation',
      selectedAnchorVenueId: 'sj-paper-plane',
      selectedAnchorRequiredRole: 'highlight',
      routeReplacementAdmitted: replacementPolicy.admitted,
    },
  })
  assert(routeAuthoritySnapshot.validationStatus === 'valid', 'routeAuthority must validate generated truth.')

  const lockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot: routeAuthoritySnapshot,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert(lockInput.ok, 'Generated routeAuthority truth must produce lock input.')
  assert(
    lockInput.input.canonicalRouteArtifact.finalRoute.stops
      .map((stop) => stop.venueId)
      .join(' -> ') === 'sj-good-karma -> sj-paper-plane -> sj-haberdasher',
    'Lock input must use reviewed generated finalRoute truth.',
  )
  assertRuntimeRouteArtifactShape(generatedFinalRoute)

  process.stdout.write('phase2 build local proof: passed\n')
  process.stdout.write(
    `${JSON.stringify(
      {
        proofSurface: 'local-tsx-service-harness',
        browserRunnerAvailable: false,
        startPathCoveredBySourceAssertion: '/start/build?fresh=1&debug=1',
        publicBuildProviderEligible: publicBuildEligibility.eligible,
        envelope: publicBuildEligibility.envelope,
        fieldProxyFetchAttemptCount,
        directProviderFetchAttemptCount,
        providerCallCount: providerResult.diagnostics.buildProviderTraceBillableCallCount,
        providerSourceOpportunityEmitted:
          providerResult.diagnostics.buildProviderSourceOpportunityEmitted,
        providerSourceAuthority: false,
        fieldProxyRequest: {
          purpose: fieldProxyRequestBody?.purpose,
          mode: fieldProxyRequestBody?.mode,
          queryLabel: fieldProxyRequestBody?.queryLabel,
          hasCenter: Boolean(fieldProxyRequestBody?.center),
        },
        staticReviewEligible: staticOnlyTruth.reviewEligible,
        deterministicReplacementPolicyAdmitted: replacementPolicy.admitted,
        deterministicReplacementPolicyReasons: replacementPolicy.reasonCodes,
        generatedReviewEligible: generatedTruth.reviewEligible,
        routeAuthorityStatus: routeAuthoritySnapshot.validationStatus,
        lockInputAvailable: lockInput.ok,
        lockRoute: lockInput.ok
          ? lockInput.input.canonicalRouteArtifact.finalRoute.stops.map((stop) => stop.venueId)
          : [],
        providerShadowReviewEligible: providerShadowTruth.reviewEligible,
        runtimeRouteArtifactShapeUnchanged: true,
      },
      null,
      2,
    )}\n`,
  )
} finally {
  globalThis.fetch = originalFetch
  restoreEnv()
}

function assertSourceLevelBrowserGap(): void {
  const packageJson = readFileSync('package.json', 'utf8')
  const sandboxSource = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')
  const providerAdapterSource = readFileSync('src/domain/providers/ProviderAdapter.ts', 'utf8')
  assert(
    !/playwright|cypress|puppeteer|vitest|jsdom|happy-dom|@testing-library/i.test(packageJson),
    'Browser-level runner dependencies should not be introduced without approval.',
  )
  assert(
    sandboxSource.includes('data-id8-public-build-provider-diagnostics') &&
      sandboxSource.includes('data-id8-public-build-review-gating-diagnostics'),
    'Public Build diagnostic surfaces must remain capturable.',
  )
  assert(
    sandboxSource.includes('Generated route to review') &&
      sandboxSource.includes('This is the route to lock.'),
    'Public Build Review copy must identify generated route truth.',
  )
  assert(
    providerAdapterSource.includes('fetch(config.requestPath') &&
      !providerAdapterSource.includes('places.googleapis.com'),
    'ProviderAdapter must route through Field proxy and avoid browser-side Google calls.',
  )
}

function restoreEnv(): void {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

function buildMockProviderVenues(): ProviderVenue[] {
  return [
    buildMockProviderVenue({
      providerRecordId: 'mock-good-karma',
      displayName: 'Good Karma',
      primaryType: 'vegetarian_restaurant',
      latitude: 37.3353,
      longitude: -121.8909,
    }),
    buildMockProviderVenue({
      providerRecordId: 'mock-paper-plane-nearby',
      displayName: 'Paper Plane Nearby Echo',
      primaryType: 'bar',
      latitude: 37.3312,
      longitude: -121.8879,
    }),
    buildMockProviderVenue({
      providerRecordId: 'mock-haberdasher',
      displayName: 'Haberdasher',
      primaryType: 'cocktail_bar',
      latitude: 37.3368,
      longitude: -121.8898,
    }),
  ]
}

function buildMockProviderVenue(input: {
  displayName: string
  latitude: number
  longitude: number
  primaryType: string
  providerRecordId: string
}): ProviderVenue {
  return {
    provider: 'google_places',
    providerRecordId: input.providerRecordId,
    displayName: input.displayName,
    formattedAddress: `${input.displayName}, San Jose, CA`,
    shortFormattedAddress: 'Downtown San Jose',
    primaryType: input.primaryType,
    types: [input.primaryType, 'point_of_interest', 'establishment'],
    liveMusic: false,
    servesBeer: true,
    servesWine: true,
    goodForGroups: true,
    goodForChildren: false,
    allowsDogs: false,
    servesVegetarianFood: input.primaryType === 'vegetarian_restaurant',
    editorialSummary: `${input.displayName} mocked local proof provider record.`,
    businessStatus: 'OPERATIONAL',
    currentOpeningHours: {
      openNow: true,
      weekdayDescriptions: ['Monday: 5:00 PM - 11:00 PM'],
    },
    regularOpeningHours: {
      weekdayDescriptions: ['Monday: 5:00 PM - 11:00 PM'],
    },
    rating: 4.6,
    userRatingCount: 120,
    utcOffsetMinutes: -420,
    websiteUri: 'https://example.test',
    location: {
      latitude: input.latitude,
      longitude: input.longitude,
    },
    sourceMode: 'live',
    rawPayloadAvailable: false,
    fetchedAt: 1782691200000,
    completenessHints: {
      hasAddress: true,
      hasLocation: true,
      hasHours: true,
      hasPrimaryType: true,
      hasRating: true,
    },
  }
}

function buildSelectedArc(routeIds: Record<'start' | 'highlight' | 'windDown', string>): ArcCandidate {
  return {
    id: 'deterministic-paper-plane-arc',
    stops: [
      { role: 'warmup', scoredVenue: { venue: { id: routeIds.start } } },
      { role: 'peak', scoredVenue: { venue: { id: routeIds.highlight } } },
      { role: 'cooldown', scoredVenue: { venue: { id: routeIds.windDown } } },
    ],
  } as unknown as ArcCandidate
}

function buildRouteShapeContractFixture(): RouteShapeContract {
  return {
    id: 'rshape_test_phase2_build_paper_plane',
    arcShape: 'steady_open_curated_center_soft_landing',
    roleProfile: {
      start: {},
      highlight: {},
      windDown: {},
    },
    roleInvariants: {
      start: {},
      highlight: {},
      windDown: {},
    },
    movementProfile: {
      radius: 'tight',
      maxTransitionMinutes: 18,
      neighborhoodContinuity: 'strict',
    },
    mutationProfile: {
      swapFlexibility: 'medium',
      allowedRoles: ['start', 'highlight', 'windDown'],
      preservePriority: ['role', 'feasibility', 'movement'],
    },
    expansionProfile: {
      supportsNearbyExtensions: true,
      preferredExpansionRole: 'windDown',
      lateNightTolerance: 'medium',
    },
  } as RouteShapeContract
}

function assertRuntimeRouteArtifactShape(route: RuntimeRouteArtifact): void {
  const expectedKeys = [
    'activeStopIndex',
    'liveNotices',
    'location',
    'mapMarkers',
    'persona',
    'routeHeadline',
    'routeId',
    'routeSummary',
    'selectedDirectionId',
    'stops',
    'updatedAt',
    'vibe',
  ]
  assert(
    Object.keys(route).sort().join('|') === expectedKeys.sort().join('|'),
    'RuntimeRouteArtifact fixture shape must remain unchanged.',
  )
}

function buildRuntimeStop(role: UserStopRole, venueId: string, stopIndex: number): RuntimeRouteStop {
  const displayName =
    venueId === 'sj-petiscos'
      ? 'Petiscos'
      : venueId === 'sj-paper-plane'
        ? 'Paper Plane'
        : venueId === 'sj-hedley-club-lounge'
          ? 'Hedley Club Lounge'
          : venueId === 'sj-good-karma'
            ? 'Good Karma'
            : 'Haberdasher'
  return {
    id: `${role}:${venueId}`,
    sourceStopId: `${role}:${venueId}`,
    displayName,
    latitude: 37.33,
    longitude: -121.89,
    address: '1 Test Way',
    role,
    stopIndex,
    venueId,
    title: role === 'highlight' ? 'Cocktail anchor' : 'Support stop',
    subtitle: 'Downtown',
    neighborhood: 'Downtown',
    driveMinutes: 4,
    imageUrl: '/test.jpg',
  }
}

function buildRuntimeRoute(params: {
  routeIds: Record<'start' | 'highlight' | 'windDown', string>
  routeSummary: string
}): RuntimeRouteArtifact {
  const stops = [
    buildRuntimeStop('start', params.routeIds.start, 0),
    buildRuntimeStop('highlight', params.routeIds.highlight, 1),
    buildRuntimeStop('windDown', params.routeIds.windDown, 2),
  ]
  return {
    routeId: 'build-runtime-paper-plane',
    selectedDirectionId: 'downtown-paper-plane',
    location: 'San Jose',
    persona: 'friends',
    vibe: 'lively',
    stops,
    activeStopIndex: 0,
    routeHeadline: 'Paper Plane Night',
    routeSummary: params.routeSummary,
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
}

function buildItineraryStop(role: UserStopRole, venueId: string): ItineraryStop {
  const stop = buildRuntimeStop(role, venueId, role === 'start' ? 0 : role === 'highlight' ? 1 : 2)
  return {
    id: stop.sourceStopId,
    role,
    title: stop.title,
    venueId,
    venueName: stop.displayName,
    formattedAddress: stop.address,
    latitude: stop.latitude,
    longitude: stop.longitude,
    city: 'San Jose',
    category: 'bar',
    subcategory: 'cocktails',
    priceTier: '$$',
    tags: ['cocktails'],
    vibeTags: ['lively'],
    neighborhood: stop.neighborhood,
    driveMinutes: stop.driveMinutes,
    durationClass: 'standard',
    estimatedDurationMinutes: 45,
    estimatedDurationLabel: '45 min',
    subtitle: stop.subtitle,
    imageUrl: stop.imageUrl,
    stopInsider: {
      roleReason: 'test role',
      localSignal: 'test local',
      selectionReason: 'test selection',
    },
  }
}

function buildItinerary(routeIds: Record<'start' | 'highlight' | 'windDown', string>): Itinerary {
  return {
    id: 'itinerary-paper-plane',
    title: 'Paper Plane Night',
    city: 'San Jose',
    crew: 'socialite',
    vibes: ['lively'],
    stops: [
      buildItineraryStop('start', routeIds.start),
      buildItineraryStop('highlight', routeIds.highlight),
      buildItineraryStop('windDown', routeIds.windDown),
    ],
    transitions: [],
    totalRouteFriction: 0.2,
    estimatedTotalMinutes: 150,
    estimatedTotalLabel: '2.5 hours',
    routeFeelLabel: 'Easy',
    story: {
      headline: 'Paper Plane Night',
      subtitle: 'Downtown cocktails',
    },
    storySpine: {
      title: 'Paper Plane Night',
      phases: [],
      routeSummary: 'Paper Plane route.',
    },
    shareSummary: 'Paper Plane route.',
  }
}

function buildArtifact(params: {
  id: string
  sourceOpportunityId: string
  routeIds: Record<'start' | 'highlight' | 'windDown', string>
  routeSummary: string
}): ContractEntryArtifact {
  return {
    id: params.id,
    sourceOpportunityId: params.sourceOpportunityId,
    sourceMode: 'curated',
    anchorVenueId: 'sj-paper-plane',
    anchorRole: 'highlight',
    anchorName: 'Paper Plane',
    routeTitle: 'Paper Plane Night',
    flavorLine: 'Cocktails with a compact downtown arc.',
    routeSummary: params.routeSummary,
    traits: ['cocktails', 'downtown'],
    storySpine: {
      start: buildRuntimeStop('start', params.routeIds.start, 0).displayName,
      highlight: 'Paper Plane',
      windDown: buildRuntimeStop('windDown', params.routeIds.windDown, 2).displayName,
    },
    districtLine: 'Downtown San Jose',
    districtAnchorLine: 'Downtown',
    authorityLine: 'Build candidate fixture.',
    whyChooseLine: 'Keeps the required anchor in the route.',
    selection: {
      directionId: 'downtown-paper-plane',
      pocketId: 'downtown',
    },
    enrichment: {
      canonicalRouteRoleCoverage: {
        start: buildRuntimeStop('start', params.routeIds.start, 0).displayName,
        highlight: 'Paper Plane',
        windDown: buildRuntimeStop('windDown', params.routeIds.windDown, 2).displayName,
        support: [
          {
            role: 'start',
            name: buildRuntimeStop('start', params.routeIds.start, 0).displayName,
            venueId: params.routeIds.start,
          },
          {
            role: 'highlight',
            name: 'Paper Plane',
            venueId: params.routeIds.highlight,
          },
          {
            role: 'windDown',
            name: buildRuntimeStop('windDown', params.routeIds.windDown, 2).displayName,
            venueId: params.routeIds.windDown,
          },
        ],
      },
    },
  }
}
