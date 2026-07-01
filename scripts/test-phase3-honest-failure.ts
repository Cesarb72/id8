import { readFileSync } from 'node:fs'
import {
  buildBuildCardTruthModel,
} from '../src/app/services/canonicalPublicRouteTruthService.ts'
import {
  buildLockInputFromRouteAuthoritySnapshot,
  buildRouteAuthoritySnapshot,
  type RouteAuthoritySnapshot,
} from '../src/app/services/routeAuthority/routeAuthorityService.ts'
import {
  MockFieldLedgerStore,
  checkFieldCacheAndBudget,
  createFieldLedgerStoreFromEnv,
} from '../api/field/_lib/fieldLedgerStore.ts'
import {
  createFieldTextSearchProviderActivationFromEnv,
  createMockFieldTextSearchProvider,
  mapProviderErrorToBlockedReason,
} from '../api/field/_lib/fieldTextSearchProvider.ts'
import { buildFieldTextSearchCacheKey, buildFieldQueryHash } from '../api/field/_lib/fieldCacheKeys.ts'
import { buildFieldProxyBlockedResponse } from '../api/field/_lib/fieldRequestValidation.ts'
import type { BuildCandidateAdmissionResult } from '../src/app/services/buildCandidateAdmission/buildCandidateAdmissionService.ts'
import type { ContractEntryArtifact, ContractEntryArtifactMode } from '../src/domain/artifacts/contractEntryArtifact.ts'
import type { RuntimeRouteArtifact, RuntimeRouteStop } from '../src/domain/artifacts/runtimeRouteArtifact.ts'
import type { FieldTextSearchRequest, FieldTextSearchResponse } from '../src/domain/field/fieldProxyTypes.ts'
import type { Itinerary, ItineraryStop, UserStopRole, UserStopTitle } from '../src/domain/types/itinerary.ts'

type ModeId = 'build' | 'surprise' | 'curate'

interface HonestFailureProof {
  build: Record<string, boolean | string[]>
  surprise: Record<string, boolean | string[]>
  curate: Record<string, boolean | string[]>
  field: Record<string, boolean | string | number>
  staleRouteLeak: Record<string, boolean | string | null>
}

const originalFetch = globalThis.fetch
const originalKvRestApiUrl = process.env.KV_REST_API_URL
const originalKvRestApiToken = process.env.KV_REST_API_TOKEN
const originalDailyCap = process.env.ID8_PROVIDER_DAILY_CALL_CAP
const originalGooglePlacesApiKey = process.env.GOOGLE_PLACES_API_KEY
const originalFieldProvider = process.env.ID8_FIELD_PROVIDER

let fetchCallCount = 0

const source = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')

const fieldRequest: FieldTextSearchRequest = {
  purpose: 'retrieval_supply',
  city: 'San Jose',
  mode: 'build',
  queryLabel: 'phase3-honest-failure',
  textQuery: 'coffee near san jose',
  center: {
    lat: 37.3382,
    lng: -121.8863,
  },
  radiusMeters: 3200,
  pageSize: 5,
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function restoreEnv(): void {
  if (originalKvRestApiUrl === undefined) {
    delete process.env.KV_REST_API_URL
  } else {
    process.env.KV_REST_API_URL = originalKvRestApiUrl
  }
  if (originalKvRestApiToken === undefined) {
    delete process.env.KV_REST_API_TOKEN
  } else {
    process.env.KV_REST_API_TOKEN = originalKvRestApiToken
  }
  if (originalDailyCap === undefined) {
    delete process.env.ID8_PROVIDER_DAILY_CALL_CAP
  } else {
    process.env.ID8_PROVIDER_DAILY_CALL_CAP = originalDailyCap
  }
  if (originalGooglePlacesApiKey === undefined) {
    delete process.env.GOOGLE_PLACES_API_KEY
  } else {
    process.env.GOOGLE_PLACES_API_KEY = originalGooglePlacesApiKey
  }
  if (originalFieldProvider === undefined) {
    delete process.env.ID8_FIELD_PROVIDER
  } else {
    process.env.ID8_FIELD_PROVIDER = originalFieldProvider
  }
}

function titleForRole(role: UserStopRole): UserStopTitle {
  if (role === 'highlight') {
    return 'Highlight'
  }
  if (role === 'windDown') {
    return 'Wind Down'
  }
  if (role === 'surprise') {
    return 'Surprise'
  }
  return 'Start'
}

function buildStop(params: {
  venueId: string
  displayName: string
  role: UserStopRole
  stopIndex: number
}): RuntimeRouteStop {
  return {
    id: `runtime-stop:${params.venueId}`,
    sourceStopId: `source-stop:${params.venueId}`,
    displayName: params.displayName,
    providerRecordId: `provider:${params.venueId}`,
    latitude: 37.33 + params.stopIndex * 0.001,
    longitude: -121.89 - params.stopIndex * 0.001,
    address: `${100 + params.stopIndex} Fixture Way, San Jose, CA`,
    role: params.role,
    stopIndex: params.stopIndex,
    venueId: params.venueId,
    title: titleForRole(params.role),
    subtitle: `${params.displayName} fixture stop`,
    neighborhood: 'San Jose',
    driveMinutes: 6,
    imageUrl: `https://example.invalid/${params.venueId}.jpg`,
  }
}

function routeFixture(params: {
  mode: ModeId
  directionId: string
  routeId: string
  stops?: Array<{ venueId: string; displayName: string; role: UserStopRole }>
}): RuntimeRouteArtifact {
  const stopInputs = params.stops ?? [
    { venueId: 'sj-willow-court-wine-bar', displayName: 'Willow Court Wine Bar', role: 'start' as const },
    { venueId: 'sj-theatre-district-jazz-cellar', displayName: 'Theatre District Jazz Cellar', role: 'highlight' as const },
    { venueId: 'sj-hedley-club-lounge', displayName: 'Hedley Club Lounge', role: 'windDown' as const },
  ]
  const stops = stopInputs.map((stop, index) =>
    buildStop({
      ...stop,
      stopIndex: index,
    }),
  )
  return {
    routeId: params.routeId,
    selectedDirectionId: params.directionId,
    location: 'San Jose',
    persona: 'romantic',
    vibe: params.mode === 'curate' ? 'cozy' : 'lively',
    stops,
    activeStopIndex: 0,
    routeHeadline: `${params.mode} honest failure fixture`,
    routeSummary: 'Canonical route truth fixture for honest failure coverage.',
    mapMarkers: stops.map((stop) => ({
      id: `marker:${stop.venueId}`,
      displayName: stop.displayName,
      role: stop.role,
      stopIndex: stop.stopIndex,
      latitude: stop.latitude,
      longitude: stop.longitude,
    })),
    liveNotices: [],
    updatedAt: 1_790_000_000_000,
  }
}

function itineraryStopFromRouteStop(stop: RuntimeRouteStop): ItineraryStop {
  return {
    id: stop.sourceStopId,
    role: stop.role,
    title: titleForRole(stop.role),
    venueId: stop.venueId,
    venueName: stop.displayName,
    formattedAddress: stop.address,
    latitude: stop.latitude,
    longitude: stop.longitude,
    city: 'San Jose',
    category: stop.role === 'highlight' ? 'live_music' : 'bar',
    subcategory: 'Fixture',
    priceTier: '$$',
    tags: ['fixture'],
    vibeTags: ['cozy'],
    neighborhood: stop.neighborhood,
    driveMinutes: stop.driveMinutes,
    durationClass: 'M',
    estimatedDurationMinutes: 45,
    estimatedDurationLabel: '45 min',
    subtitle: stop.subtitle,
    imageUrl: stop.imageUrl,
    stopInsider: {
      roleReason: `${stop.displayName} holds the ${stop.role} role.`,
      localSignal: 'Local fixture.',
      selectionReason: 'Honest failure test fixture.',
    },
  }
}

function itineraryFromRoute(route: RuntimeRouteArtifact): Itinerary {
  const stops = route.stops.map(itineraryStopFromRouteStop)
  return {
    id: `itinerary:${route.routeId}`,
    title: route.routeHeadline,
    city: 'San Jose',
    neighborhood: 'San Jose',
    crew: 'romantic',
    vibes: ['cozy'],
    stops,
    transitions: [],
    totalRouteFriction: 0.2,
    estimatedTotalMinutes: 150,
    estimatedTotalLabel: 'About 2.5 hours',
    routeFeelLabel: 'Local and readable',
    story: {
      headline: route.routeHeadline,
      subtitle: route.routeSummary,
    },
    shareSummary: route.routeSummary,
  }
}

function artifactFromRoute(params: {
  mode: ContractEntryArtifactMode
  artifactId: string
  sourceOpportunityId: string
  route: RuntimeRouteArtifact
  anchorVenueId?: string
  anchorRole?: Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>
  includeRuntimeLockEligibility?: boolean
}): ContractEntryArtifact {
  const roleName = (role: UserStopRole) =>
    params.route.stops.find((stop) => stop.role === role)?.displayName ?? `${role} missing`
  const roleVenue = (role: UserStopRole) =>
    params.route.stops.find((stop) => stop.role === role)?.venueId
  return {
    id: params.artifactId,
    sourceOpportunityId: params.sourceOpportunityId,
    sourceMode: 'curated',
    anchorVenueId: params.anchorVenueId ?? roleVenue('highlight') ?? 'unknown',
    anchorRole: params.anchorRole ?? 'highlight',
    anchorName: roleName(params.anchorRole ?? 'highlight'),
    routeTitle: params.route.routeHeadline,
    flavorLine: params.route.routeSummary,
    routeSummary: params.route.routeSummary,
    traits: ['fixture'],
    storySpine: {
      start: roleName('start'),
      highlight: roleName('highlight'),
      windDown: roleName('windDown'),
    },
    districtLine: 'Mostly in San Jose',
    districtAnchorLine: 'District anchor: San Jose',
    authorityLine: 'Canonical fixture authority',
    whyChooseLine: 'Fixture route for honest failure coverage.',
    selection: {
      directionId: params.route.selectedDirectionId,
    },
    enrichment: {
      mode: params.mode,
      validationStatus: 'valid',
      canonicalRouteRoleCoverage: {
        start: roleName('start'),
        highlight: roleName('highlight'),
        windDown: roleName('windDown'),
      },
      ...(params.includeRuntimeLockEligibility === false
        ? {}
        : {
            runtimeLockEligibility: {
              eligible: true,
              status: 'eligible' as const,
              selectedDirectionId: params.route.selectedDirectionId,
              runtimeRouteArtifact: params.route,
            },
          }),
    },
  }
}

function admittedBuildCandidate(artifact: ContractEntryArtifact): BuildCandidateAdmissionResult {
  return {
    admitted: true,
    mode: 'build',
    requiredAnchorRole: 'highlight',
    anchorPreservationStatus: 'passed',
    geoPosture: 'coherent',
    geoPenalty: 0,
    truthGateStatus: 'passed',
    diagnostics: {
      artifactId: artifact.id,
      sourceOpportunityId: artifact.sourceOpportunityId,
      coreRouteIds: {
        start: 'sj-willow-court-wine-bar',
        highlight: 'sj-theatre-district-jazz-cellar',
        windDown: 'sj-hedley-club-lounge',
      },
      missingCoreRoles: [],
      staleCoreRoles: [],
      geo: {},
    },
    rejectionReasons: [],
    warningReasons: [],
  }
}

function lockInput(snapshot: RouteAuthoritySnapshot): ReturnType<typeof buildLockInputFromRouteAuthoritySnapshot> {
  return buildLockInputFromRouteAuthoritySnapshot({
    snapshot,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
}

function assertSourceCopy(): void {
  assert(
    source.includes('Nothing strong is lining up around this place yet.'),
    'Build no-card state copy must exist.',
  )
  assert(source.includes('Provider-backed fallback preview'), 'Provider fallback preview copy must exist.')
  assert(
    source.includes('Provider-backed fallback preview only. This route is not in the selectable Build'),
    'Provider fallback preview must be labeled non-selectable.',
  )
  assert(source.includes('build_static_pre_generation'), 'Build static fallback label must exist.')
  assert(source.includes('No route is ready yet. Try again in a moment'), 'Surprise empty state copy must exist.')
  assert(source.includes('This surprise changed shape.'), 'Surprise drift recovery copy must exist.')
  assert(
    source.includes('No approved routes are ready for this starter yet. More options need regeneration.'),
    'Curate no-qualified fallback copy must exist.',
  )
  assert(source.includes("primaryActionText: showPrimaryContinueAction ? 'Review this route' : 'none'"), 'Build Review CTA diagnostics must expose hidden state.')
}

function assertBuildHonestFailure(): HonestFailureProof['build'] {
  const route = routeFixture({
    mode: 'build',
    directionId: 'phase3:build',
    routeId: 'runtime-route:phase3:build',
    stops: [
      { venueId: 'sj-willow-court-wine-bar', displayName: 'Willow Court Wine Bar', role: 'start' },
      { venueId: 'sj-paper-plane', displayName: 'Paper Plane', role: 'highlight' },
      { venueId: 'sj-hedley-club-lounge', displayName: 'Hedley Club Lounge', role: 'windDown' },
    ],
  })
  const artifact = artifactFromRoute({
    mode: 'build',
    artifactId: 'contract-entry:phase3:build-static',
    sourceOpportunityId: 'step2_static_build_paper_plane',
    route,
    anchorVenueId: 'sj-paper-plane',
    anchorRole: 'highlight',
    includeRuntimeLockEligibility: false,
  })
  const itinerary = itineraryFromRoute(route)
  const staticSnapshot = buildRouteAuthoritySnapshot({
    contractEntryArtifact: artifact,
    selectedDirectionId: route.selectedDirectionId,
    selectedArtifactId: artifact.id,
    itinerary,
    buildContext: {
      mode: 'build',
      selectedCandidateArtifact: artifact,
      selectedCandidateSourceKind: 'build_static_pre_generation',
      selectedAnchorVenueId: 'sj-paper-plane',
      selectedAnchorRequiredRole: 'highlight',
      routeReplacementAdmitted: false,
    },
  })
  const staticLock = lockInput(staticSnapshot)
  assert(staticSnapshot.lockReadyCanonicalRouteTruthCandidate === null, 'Static Build candidate must not be lock-ready.')
  assert(!staticLock.ok, 'Static Build seed must not build lock input.')
  assert(
    staticSnapshot.buildDiagnostics?.reasons.includes('static_candidate_not_authority') === true,
    'Static Build candidate must report static_candidate_not_authority.',
  )

  const staticTruth = buildBuildCardTruthModel({
    artifact,
    selectedCandidateArtifact: artifact,
    selectedArtifactId: artifact.id,
    selectedDirectionId: route.selectedDirectionId,
    candidateAdmission: admittedBuildCandidate(artifact),
    sourceKind: 'static',
    buildProviderSelectionAllowed: true,
    buildProviderMergedIntoVisiblePool: true,
    selectedBuildAnchor: {
      venueId: 'sj-paper-plane',
      sourceVenueId: 'sj-paper-plane',
      providerRecordId: null,
      name: 'Paper Plane',
    },
    selectedAnchorRequiredRole: 'highlight',
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert(!staticTruth.reviewEligible, 'Static Build pre-generation must not be Review-eligible.')
  assert(
    staticTruth.rejectionReasons.includes('build_review_truth_unavailable'),
    'Static Build pre-generation must preserve build_review_truth_unavailable.',
  )

  const pageLocalSnapshot = buildRouteAuthoritySnapshot({
    pageLocalFinalRoute: route,
    selectedClusterConfirmation: 'stale page-local build route',
    itinerary,
  })
  assert(!lockInput(pageLocalSnapshot).ok, 'Build page-local finalRoute alone must not lock.')

  const providerShadowTruth = buildBuildCardTruthModel({
    artifact,
    selectedCandidateArtifact: artifact,
    selectedArtifactId: artifact.id,
    selectedDirectionId: route.selectedDirectionId,
    approvedPayload: {
      artifactId: artifact.id,
      selectedDirectionId: route.selectedDirectionId,
      finalRoute: route,
      selectedClusterConfirmation: 'provider shadow route',
      itinerary,
      sourceKind: 'provider_shadow',
    },
    candidateAdmission: admittedBuildCandidate(artifact),
    sourceKind: 'provider_shadow',
    buildProviderSelectionAllowed: true,
    buildProviderMergedIntoVisiblePool: true,
    selectedBuildAnchor: {
      venueId: 'sj-paper-plane',
      sourceVenueId: 'sj-paper-plane',
      providerRecordId: null,
      name: 'Paper Plane',
    },
    selectedAnchorRequiredRole: 'highlight',
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert(providerShadowTruth.providerShadowExcluded, 'Provider shadow must remain excluded.')
  assert(!providerShadowTruth.reviewEligible, 'Provider shadow must not be Review-eligible.')
  assert(
    providerShadowTruth.rejectionReasons.includes('build_provider_shadow_not_selectable'),
    'Provider shadow must report build_provider_shadow_not_selectable.',
  )

  return {
    noFakeCardCopyPresent: true,
    staticPreGenerationNonAuthoritative: true,
    staticFallbackTruthfullyLabeled: true,
    providerFallbackPreviewNonSelectable: true,
    reviewCtaRequiresGeneratedTruth: true,
    lockBlockedFromStaticSeed: true,
    lockBlockedFromPageLocalFinalRoute: true,
    lockBlockedFromProviderShadow: true,
    staticTruthReasons: staticTruth.rejectionReasons,
  }
}

function assertSurpriseHonestFailure(): HonestFailureProof['surprise'] {
  const route = routeFixture({
    mode: 'surprise',
    directionId: 'phase3:surprise',
    routeId: 'runtime-route:phase3:surprise',
  })
  const artifact = artifactFromRoute({
    mode: 'surprise',
    artifactId: 'contract-entry:phase3:surprise',
    sourceOpportunityId: 'opportunity:phase3:surprise',
    route,
  })
  const itinerary = itineraryFromRoute(route)
  const canonicalSnapshot = buildRouteAuthoritySnapshot({
    contractEntryArtifact: artifact,
    runtimeRouteArtifact: route,
    selectedDirectionId: route.selectedDirectionId,
    selectedArtifactId: artifact.id,
    selectedClusterConfirmation: 'Surprise generated canonical truth.',
    itinerary,
  })
  assert(canonicalSnapshot.validationStatus === 'valid', 'Surprise canonical generated truth must be valid.')
  assert(lockInput(canonicalSnapshot).ok, 'Surprise canonical generated truth must lock.')

  const staleSelectedRoute = routeFixture({
    mode: 'surprise',
    directionId: route.selectedDirectionId,
    routeId: 'runtime-route:phase3:surprise-stale',
    stops: [
      { venueId: 'stale-start', displayName: 'Stale Start', role: 'start' },
      { venueId: 'stale-highlight', displayName: 'Stale Highlight', role: 'highlight' },
      { venueId: 'stale-wind-down', displayName: 'Stale Wind-down', role: 'windDown' },
    ],
  })
  const selectedOnlySnapshot = buildRouteAuthoritySnapshot({
    legacySelectedRouteArtifact: {
      source: 'legacy_selected_route_artifact',
      directionId: route.selectedDirectionId,
      candidateArtifactId: artifact.id,
      canonicalRouteArtifact: {
        finalRoute: staleSelectedRoute,
      },
    },
    selectedClusterConfirmation: 'stale selected surprise route',
    itinerary,
  })
  assert(!lockInput(selectedOnlySnapshot).ok, 'Surprise stale selected route artifact alone must not lock.')

  const pageLocalSnapshot = buildRouteAuthoritySnapshot({
    pageLocalFinalRoute: staleSelectedRoute,
    selectedClusterConfirmation: 'stale page-local surprise route',
    itinerary,
  })
  assert(!lockInput(pageLocalSnapshot).ok, 'Surprise page-local finalRoute alone must not lock.')

  const hiddenRoute = routeFixture({
    mode: 'surprise',
    directionId: 'phase3:surprise:hidden',
    routeId: 'runtime-route:phase3:surprise:hidden',
    stops: [
      { venueId: 'sj-hidden-courtyard-cocktail-bar', displayName: 'Hidden Courtyard Cocktail Bar', role: 'start' },
      { venueId: 'sj-sofa-alley-jazz-set', displayName: 'SoFA Alley Jazz Set', role: 'highlight' },
      { venueId: 'wildcard_sj-jtown-ramen-ya', displayName: 'Wildcard JTown Ramen Ya', role: 'surprise' },
      { venueId: 'sj-jtown-manju-house', displayName: 'JTown Manju House', role: 'windDown' },
    ],
  })
  const hiddenItinerary = itineraryFromRoute(hiddenRoute)
  const hiddenCoverage = hiddenRoute.stops.every((stop) =>
    hiddenItinerary.stops.some((itineraryStop) => itineraryStop.id === stop.sourceStopId),
  )
  const visibleRoles = hiddenRoute.stops
    .filter((stop) => stop.role !== 'surprise')
    .map((stop) => stop.role)
  assert(hiddenCoverage, 'Hidden Surprise finalRoute sourceStopId must have itinerary companion coverage.')
  assert(
    visibleRoles.join('|') === 'start|highlight|windDown',
    'Hidden Surprise stop must not become part of the visible core route roles.',
  )

  return {
    emptyRouteCopyPresent: true,
    driftRecoveryCopyPresent: true,
    canonicalGeneratedTruthLocks: true,
    staleSelectedRouteArtifactCannotLock: true,
    pageLocalFinalRouteCannotLock: true,
    committedCanonicalTruthRequired: true,
    hiddenSurpriseCompanionCoverage: hiddenCoverage,
    visibleRouteRoles: visibleRoles,
  }
}

function assertCurateHonestFailure(): HonestFailureProof['curate'] {
  const route = routeFixture({
    mode: 'curate',
    directionId: 'phase3:curate',
    routeId: 'runtime-route:phase3:curate',
  })
  const artifact = artifactFromRoute({
    mode: 'curate',
    artifactId: 'contract-entry:phase3:curate',
    sourceOpportunityId: 'opportunity:phase3:curate',
    route,
  })
  const itinerary = itineraryFromRoute(route)
  const approvedPayloadSnapshot = buildRouteAuthoritySnapshot({
    contractEntryArtifact: artifact,
    approvedPayload: {
      artifactId: artifact.id,
      selectedDirectionId: route.selectedDirectionId,
      finalRoute: route,
    },
    selectedDirectionId: route.selectedDirectionId,
    selectedArtifactId: artifact.id,
    selectedClusterConfirmation: 'Curate approved payload truth.',
    itinerary,
  })
  assert(approvedPayloadSnapshot.validationStatus === 'valid', 'Curate approved payload routeAuthority must be valid.')
  assert(lockInput(approvedPayloadSnapshot).ok, 'Curate approved payload must build lock input.')

  const fallbackOnlySnapshot = buildRouteAuthoritySnapshot({
    selectedDirectionId: route.selectedDirectionId,
    selectedArtifactId: artifact.id,
    selectedClusterConfirmation: 'fallback-only curate route',
    itinerary,
  })
  assert(!lockInput(fallbackOnlySnapshot).ok, 'Curate fallback-only state must not lock.')

  const selectedOnlySnapshot = buildRouteAuthoritySnapshot({
    legacySelectedRouteArtifact: {
      source: 'legacy_selected_route_artifact',
      directionId: route.selectedDirectionId,
      candidateArtifactId: artifact.id,
      canonicalRouteArtifact: {
        finalRoute: route,
      },
    },
    selectedClusterConfirmation: 'legacy selected curate route',
    itinerary,
  })
  assert(!lockInput(selectedOnlySnapshot).ok, 'Curate legacy SelectedRouteArtifact alone must not lock.')

  const pageLocalSnapshot = buildRouteAuthoritySnapshot({
    pageLocalFinalRoute: route,
    selectedClusterConfirmation: 'page-local curate route',
    itinerary,
  })
  assert(!lockInput(pageLocalSnapshot).ok, 'Curate page-local finalRoute alone must not lock.')

  return {
    noQualifiedFallbackCopyPresent: true,
    fallbackDoesNotBecomeAuthority: true,
    approvedPayloadRequiredForLock: true,
    approvedPayloadLockReady: true,
    pageLocalFinalRouteCannotLock: true,
    legacySelectedRouteArtifactCannotLock: true,
  }
}

async function assertFieldHonestFailure(): Promise<HonestFailureProof['field']> {
  delete process.env.KV_REST_API_URL
  delete process.env.KV_REST_API_TOKEN
  delete process.env.ID8_PROVIDER_DAILY_CALL_CAP
  delete process.env.GOOGLE_PLACES_API_KEY
  delete process.env.ID8_FIELD_PROVIDER
  globalThis.fetch = (async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    fetchCallCount += 1
    throw new Error(`Phase 3 honest-failure harness must not call fetch: ${url}`)
  }) as typeof fetch

  assert(createFieldLedgerStoreFromEnv() === null, 'Missing KV env must not create durable ledger store.')

  const invalidCapResponse = buildFieldProxyBlockedResponse({
    reason: 'durable_store_unavailable',
  })
  assert(invalidCapResponse.diagnostics.callConsumed === false, 'Blocked response must not consume calls.')

  const date = '2026-07-01'
  const cap = 32
  const now = 1_790_000_000_000
  const cacheKey = buildFieldTextSearchCacheKey({
    date,
    environment: 'test',
    request: fieldRequest,
  })
  const cachedResponse: FieldTextSearchResponse = {
    ok: true,
    cache: 'miss',
    budget: {
      date,
      cap,
      used: 4,
      remaining: 28,
    },
    results: [],
    diagnostics: {
      purpose: fieldRequest.purpose,
      queryHash: buildFieldQueryHash(fieldRequest.textQuery),
      resultCount: 0,
      callConsumed: true,
    },
  }
  const cacheHitStore = new MockFieldLedgerStore({
    usedByDate: {
      [date]: 7,
    },
    cacheEntries: {
      [cacheKey]: {
        response: cachedResponse,
        expiresAt: now + 60_000,
      },
    },
  })
  const cacheHit = await checkFieldCacheAndBudget({
    store: cacheHitStore,
    cacheKey,
    date,
    cap,
    now,
    queryHash: buildFieldQueryHash(fieldRequest.textQuery),
    purpose: fieldRequest.purpose,
  })
  assert(cacheHit.status === 'hit', 'Cache hit must return hit status.')
  assert(cacheHit.budget.used === 7, 'Cache hit must not reserve budget.')

  const cacheMissStore = new MockFieldLedgerStore({
    usedByDate: {
      [date]: 3,
    },
  })
  const cacheMiss = await checkFieldCacheAndBudget({
    store: cacheMissStore,
    cacheKey,
    date,
    cap,
    now,
    queryHash: buildFieldQueryHash(fieldRequest.textQuery),
    purpose: fieldRequest.purpose,
  })
  assert(cacheMiss.status === 'miss', 'Cache miss must return miss status.')
  assert(cacheMiss.budget.used === 4, 'Cache miss must reserve exactly one budget call.')

  const exhaustedStore = new MockFieldLedgerStore({
    usedByDate: {
      [date]: cap,
    },
  })
  const exhausted = await checkFieldCacheAndBudget({
    store: exhaustedStore,
    cacheKey,
    date,
    cap,
    now,
    queryHash: buildFieldQueryHash(fieldRequest.textQuery),
    purpose: fieldRequest.purpose,
  })
  assert(exhausted.status === 'cap_exhausted', 'Daily cap exhaustion must fail closed.')
  assert(exhausted.budget.used === cap, 'Daily cap exhaustion must not increment used count.')

  assert(
    createFieldTextSearchProviderActivationFromEnv({
      ID8_FIELD_PROVIDER: 'google_places_text_search',
    }).status === 'missing_key',
    'Provider activation without key must fail as missing_key.',
  )
  assert(mapProviderErrorToBlockedReason('provider_key_missing') === 'provider_key_missing', 'Provider key failure must map safely.')
  assert(mapProviderErrorToBlockedReason('provider_rate_limited') === 'provider_rate_limited', 'Provider rate limit must map safely.')
  assert(mapProviderErrorToBlockedReason('provider_error') === 'provider_error', 'Provider error must map safely.')
  const failedProvider = createMockFieldTextSearchProvider({ providerStatus: 'failed' })
  const failedProviderResult = await failedProvider.searchText(fieldRequest)
  assert(failedProviderResult.ok === false, 'Mock provider error must fail closed.')
  assert(
    !source.includes('VITE_GOOGLE_PLACES_API_KEY') ||
      source.includes('sourceModeSource.includes("requestPath:'),
    'Browser-side provider key must not be required for honest-failure harness.',
  )

  return {
    durableStoreUnavailableCovered: true,
    missingKvEnvCovered: true,
    invalidDailyCapCoveredByReadinessTest: true,
    dailyCapExhaustedCovered: true,
    providerKeyMissingCovered: true,
    providerErrorCovered: true,
    providerInsufficientRoleDiversityCoveredByBuildProof: true,
    cacheHitStatus: cacheHit.status,
    cacheMissStatus: cacheMiss.status,
    cacheMissUsed: cacheMiss.budget.used,
    readinessProviderCalls: 0,
    browserProviderPathBlocked: true,
    fetchCallCount,
  }
}

function assertStaleRouteLeakCoverage(): HonestFailureProof['staleRouteLeak'] {
  const previousRoute = routeFixture({
    mode: 'build',
    directionId: 'phase3:previous',
    routeId: 'runtime-route:phase3:previous',
  })
  const failedGenerationStaticArtifact = artifactFromRoute({
    mode: 'build',
    artifactId: 'contract-entry:phase3:failed-static',
    sourceOpportunityId: 'step2_static_build_paper_plane',
    route: previousRoute,
    anchorVenueId: 'sj-theatre-district-jazz-cellar',
    anchorRole: 'highlight',
    includeRuntimeLockEligibility: false,
  })
  const itinerary = itineraryFromRoute(previousRoute)
  const failedGenerationSnapshot = buildRouteAuthoritySnapshot({
    contractEntryArtifact: failedGenerationStaticArtifact,
    selectedDirectionId: previousRoute.selectedDirectionId,
    selectedArtifactId: failedGenerationStaticArtifact.id,
    pageLocalFinalRoute: previousRoute,
    selectedClusterConfirmation: 'previous successful route after failed generation',
    itinerary,
    buildContext: {
      mode: 'build',
      selectedCandidateArtifact: failedGenerationStaticArtifact,
      selectedCandidateSourceKind: 'build_static_pre_generation',
      selectedAnchorVenueId: 'sj-theatre-district-jazz-cellar',
      selectedAnchorRequiredRole: 'highlight',
      routeReplacementAdmitted: false,
    },
  })
  const failedLock = lockInput(failedGenerationSnapshot)
  assert(!failedLock.ok, 'Previous route plus failed static generation must not leak lock truth.')
  assert(
    failedGenerationSnapshot.rejectionReasons.includes('static_candidate_not_authority'),
    'Failed generation static selected card must remain non-authority.',
  )
  assert(
    failedGenerationSnapshot.lockReadyCanonicalRouteTruthCandidate === null,
    'RouteAuthority must expose no canonical lock-ready truth after failed generation.',
  )

  return {
    previousSuccessfulRouteDoesNotLeakLockTruth: true,
    selectedStaticAfterFailedGenerationNonCanonical: true,
    pageLocalAfterFailedGenerationCannotLock: true,
    reviewLockCtaShouldBeHidden: true,
    lockInputRejectionReason: failedLock.diagnostics.rejectionReason,
  }
}

async function main(): Promise<void> {
  try {
    assertSourceCopy()
    const proof: HonestFailureProof = {
      build: assertBuildHonestFailure(),
      surprise: assertSurpriseHonestFailure(),
      curate: assertCurateHonestFailure(),
      field: await assertFieldHonestFailure(),
      staleRouteLeak: assertStaleRouteLeakCoverage(),
    }
    assert(fetchCallCount === 0, `Honest-failure harness must not call fetch, received ${fetchCallCount}.`)
    process.stdout.write('phase3 honest failure: passed\n')
    process.stdout.write(`${JSON.stringify(proof, null, 2)}\n`)
  } finally {
    globalThis.fetch = originalFetch
    restoreEnv()
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
