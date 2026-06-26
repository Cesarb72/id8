import { readFileSync } from 'node:fs'
import { buildBuildCardTruthModel } from '../src/app/services/canonicalPublicRouteTruthService.ts'
import { evaluateBuildCandidateAdmission } from '../src/app/services/buildCandidateAdmission/buildCandidateAdmissionService.ts'
import { buildAnchorTruthContract } from '../src/domain/artifacts/buildAnchorTruthContract.ts'
import type { BuildAnchorCanonicalRole } from '../src/domain/artifacts/buildAnchorTruthContract.ts'
import type { ContractEntryArtifact } from '../src/domain/artifacts/contractEntryArtifact.ts'
import type { RuntimeRouteArtifact, RuntimeRouteStop } from '../src/domain/artifacts/runtimeRouteArtifact.ts'
import type { Itinerary, ItineraryStop, UserStopRole } from '../src/domain/types/itinerary.ts'
import type { BearingsStaticRuntimeHoursProofResult } from '../src/domain/bearings/staticRuntimeHoursProof.ts'
import type { ScenarioRouteGeoCoherence } from '../src/domain/interpretation/construction/scenarioBuilder.ts'

const originalFetch = globalThis.fetch
let fetchCallCount = 0

globalThis.fetch = (async () => {
  fetchCallCount += 1
  throw new Error('Build unpark readiness test must not call fetch.')
}) as typeof fetch

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const routeIds = {
  start: 'sj-good-karma',
  highlight: 'sj-paper-plane',
  windDown: 'sj-haberdasher',
}

function runtimeStop(role: UserStopRole, venueId: string, stopIndex: number): RuntimeRouteStop {
  const displayName =
    role === 'start' ? 'Good Karma' : role === 'highlight' ? 'Paper Plane' : 'Haberdasher'
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
    title: displayName,
    subtitle: 'Downtown',
    neighborhood: 'Downtown',
    driveMinutes: 4,
    imageUrl: '/test.jpg',
  }
}

function runtimeRoute(patch: Partial<RuntimeRouteArtifact> = {}): RuntimeRouteArtifact {
  const stops = [
    runtimeStop('start', routeIds.start, 0),
    runtimeStop('highlight', routeIds.highlight, 1),
    runtimeStop('windDown', routeIds.windDown, 2),
  ]
  return {
    routeId: 'build-runtime-paper-plane',
    selectedDirectionId: 'downtown-cocktails',
    location: 'San Jose',
    persona: 'friends',
    vibe: 'lively',
    stops,
    activeStopIndex: 0,
    routeHeadline: 'Paper Plane Night',
    routeSummary: 'Good Karma to Paper Plane to Haberdasher.',
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
    ...patch,
  }
}

function itineraryStop(role: UserStopRole, venueId: string): ItineraryStop {
  const venueName =
    role === 'start' ? 'Good Karma' : role === 'highlight' ? 'Paper Plane' : 'Haberdasher'
  return {
    id: `${role}:${venueId}`,
    role,
    title: venueName,
    venueId,
    venueName,
    formattedAddress: '1 Test Way',
    latitude: 37.33,
    longitude: -121.89,
    city: 'San Jose',
    category: 'bar',
    subcategory: 'cocktails',
    priceTier: '$$',
    tags: ['cocktails'],
    vibeTags: ['lively'],
    neighborhood: 'Downtown',
    driveMinutes: 4,
    durationClass: 'standard',
    estimatedDurationMinutes: 45,
    estimatedDurationLabel: '45 min',
    subtitle: 'Downtown',
    imageUrl: '/test.jpg',
    stopInsider: {
      roleReason: 'test role',
      localSignal: 'test local',
      selectionReason: 'test selection',
    },
  }
}

function itinerary(): Itinerary {
  return {
    id: 'itinerary-paper-plane',
    title: 'Paper Plane Night',
    city: 'San Jose',
    crew: 'socialite',
    vibes: ['lively'],
    stops: [
      itineraryStop('start', routeIds.start),
      itineraryStop('highlight', routeIds.highlight),
      itineraryStop('windDown', routeIds.windDown),
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
      routeSummary: 'Good Karma to Paper Plane to Haberdasher.',
    },
    shareSummary: 'Paper Plane route.',
  }
}

function artifact(patch: Partial<ContractEntryArtifact> = {}): ContractEntryArtifact {
  return {
    id: 'build-candidate-paper-plane',
    sourceOpportunityId: 'build-opportunity-paper-plane',
    sourceMode: 'curated',
    anchorVenueId: routeIds.highlight,
    anchorRole: 'highlight',
    anchorName: 'Paper Plane',
    routeTitle: 'Paper Plane Night',
    flavorLine: 'Cocktails with a compact downtown arc.',
    routeSummary: 'Start nearby, center Paper Plane, and land close.',
    traits: ['cocktails', 'downtown'],
    storySpine: {
      start: 'Good Karma',
      highlight: 'Paper Plane',
      windDown: 'Haberdasher',
    },
    districtLine: 'Downtown San Jose',
    districtAnchorLine: 'Downtown',
    authorityLine: 'Build candidate fixture.',
    whyChooseLine: 'Keeps the required anchor in the route.',
    selection: {
      directionId: 'downtown-cocktails',
      pocketId: 'downtown',
    },
    enrichment: {
      canonicalRouteRoleCoverage: {
        start: 'Good Karma',
        highlight: 'Paper Plane',
        windDown: 'Haberdasher',
        support: [
          { role: 'start', name: 'Good Karma', venueId: routeIds.start },
          { role: 'highlight', name: 'Paper Plane', venueId: routeIds.highlight },
          { role: 'windDown', name: 'Haberdasher', venueId: routeIds.windDown },
        ],
      },
    },
    ...patch,
  }
}

function hoursProof(
  status: BearingsStaticRuntimeHoursProofResult['status'],
): BearingsStaticRuntimeHoursProofResult {
  return {
    status,
    required: true,
    proofSource: 'structured_periods',
    structuredPeriodCount: status === 'unknown_for_plan_window' ? 0 : 1,
    textHoursAvailable: false,
    planningWindowLabel: 'Friday 7:00 PM',
  }
}

const planningWindow = {
  day: 5,
  hour: 19,
  minute: 0,
  label: 'Friday 7:00 PM',
  source: 'intent_time_window',
  usesIntentWindow: true,
} as const

const scatteredGeo: ScenarioRouteGeoCoherence = {
  status: 'scattered',
  rejectionReason: 'scenario_route_geo_scattered',
  geoBearingStopCount: 3,
  uniqueGeoBucketCount: 3,
  dominantGeoBucket: 'downtown',
  dominantGeoShare: 0.34,
  routeGeoBuckets: [
    { role: 'start', venueId: routeIds.start, name: 'Good Karma', geoBucket: 'downtown' },
    { role: 'highlight', venueId: routeIds.highlight, name: 'Paper Plane', geoBucket: 'soma' },
    { role: 'windDown', venueId: routeIds.windDown, name: 'Haberdasher', geoBucket: 'sofa' },
  ],
}

function anchorContract(role: BuildAnchorCanonicalRole = 'highlight') {
  return buildAnchorTruthContract({
    identity: {
      venueId: routeIds.highlight,
      sourceVenueId: 'google:sj-paper-plane',
      providerRecordId: 'provider-paper-plane',
      displayName: 'Paper Plane',
    },
    role: {
      role,
      roleResolutionSource: 'explicit',
    },
  })
}

function buildTruth(params: {
  sourceKind?: 'static' | 'provider_shadow' | 'debug_only'
  providerSelectionAllowed?: boolean
  providerMergedIntoVisiblePool?: boolean
  finalRoute?: RuntimeRouteArtifact | null
  anchorRole?: BuildAnchorCanonicalRole
  selectedArtifactId?: string
  selectedDirectionId?: string
  hoursStatus?: BearingsStaticRuntimeHoursProofResult['status']
  geo?: ScenarioRouteGeoCoherence | null
  missingAnchor?: boolean
}) {
  const candidateArtifact = artifact()
  const finalRoute = params.finalRoute === undefined ? runtimeRoute() : params.finalRoute
  const contract = params.missingAnchor ? null : anchorContract(params.anchorRole ?? 'highlight')
  const admission = evaluateBuildCandidateAdmission({
    mode: 'build',
    anchorContract: contract,
    contractEntryArtifact: candidateArtifact,
    runtimeRouteArtifact: finalRoute,
    hoursProof: hoursProof(params.hoursStatus ?? 'open_for_plan_window'),
    planningWindow,
    geoCoherence: params.geo ?? null,
    buildParked: {
      providerSelectionAllowed: params.providerSelectionAllowed ?? false,
      providerMergedIntoVisiblePool: params.providerMergedIntoVisiblePool ?? false,
    },
  })

  return buildBuildCardTruthModel({
    artifact: candidateArtifact,
    selectedArtifactId: params.selectedArtifactId ?? candidateArtifact.id,
    selectedDirectionId: params.selectedDirectionId ?? candidateArtifact.selection.directionId,
    approvedPayload: finalRoute
      ? {
          artifactId: candidateArtifact.id,
          selectedDirectionId: finalRoute.selectedDirectionId,
          finalRoute,
          selectedClusterConfirmation: 'Downtown works tonight.',
          itinerary: itinerary(),
          sourceKind: params.sourceKind ?? 'static',
        }
      : null,
    candidateAdmission: admission,
    anchorTruthContract: contract,
    sourceKind: params.sourceKind ?? 'static',
    buildProviderSelectionAllowed: params.providerSelectionAllowed ?? false,
    buildProviderMergedIntoVisiblePool: params.providerMergedIntoVisiblePool ?? false,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
}

function main(): void {
  const parkedStatic = buildTruth({})
  assert(parkedStatic.buildTruthReady, 'Truth-passing Build candidate must report buildTruthReady.')
  assert(
    parkedStatic.buildSelectableWhenUnparked,
    'Truth-passing approved source must report buildSelectableWhenUnparked.',
  )
  assert(!parkedStatic.cardSelectable, 'Build candidate must not be selectable while parked.')
  assert(!parkedStatic.reviewEligible, 'Build Review eligibility must be false while parked.')
  assert(
    parkedStatic.rejectionReasons.includes('build_provider_selection_parked'),
    'Parked selection reason must be explicit.',
  )
  assert(
    parkedStatic.rejectionReasons.includes('build_provider_visible_merge_parked'),
    'Parked merge reason must be explicit.',
  )

  const localUnparkedStatic = buildTruth({
    providerSelectionAllowed: true,
    providerMergedIntoVisiblePool: true,
  })
  assert(
    localUnparkedStatic.cardSelectable && localUnparkedStatic.reviewEligible,
    'Local unpark requires Build truth plus approved selectable source.',
  )
  assert(
    localUnparkedStatic.routeAuthorityLockReady,
    'Local unpark must require route-authority lock-ready truth.',
  )

  const providerShadow = buildTruth({ sourceKind: 'provider_shadow' })
  assert(providerShadow.buildTruthReady, 'Provider-shadow candidate may be truth-ready diagnostically.')
  assert(providerShadow.providerShadowExcluded, 'Provider-shadow exclusion diagnostic must be true.')
  assert(!providerShadow.isApprovedSelectableSource, 'Provider-shadow source must not be approved selectable.')
  assert(!providerShadow.cardSelectable, 'Provider-shadow candidate must not be selectable while parked.')
  assert(!providerShadow.reviewEligible, 'Provider-shadow candidate must not be Review-eligible while parked.')
  assert(
    providerShadow.rejectionReasons.includes('build_provider_shadow_not_selectable'),
    'Provider-shadow exclusion reason must be explicit.',
  )

  const debugOnly = buildTruth({ sourceKind: 'debug_only' })
  assert(debugOnly.isDebugOnly, 'Debug-only diagnostic must be true.')
  assert(!debugOnly.isApprovedSelectableSource, 'Debug-only source must not be approved selectable.')
  assert(!debugOnly.cardSelectable, 'Debug-only candidate must not be selectable.')

  const providerShadowWithLocalFlags = buildTruth({
    sourceKind: 'provider_shadow',
    providerSelectionAllowed: true,
    providerMergedIntoVisiblePool: true,
  })
  assert(
    !providerShadowWithLocalFlags.cardSelectable && !providerShadowWithLocalFlags.reviewEligible,
    'Provider-shadow source must not bypass truth gates after local unpark.',
  )

  const debugOnlyWithLocalFlags = buildTruth({
    sourceKind: 'debug_only',
    providerSelectionAllowed: true,
    providerMergedIntoVisiblePool: true,
  })
  assert(
    !debugOnlyWithLocalFlags.cardSelectable && !debugOnlyWithLocalFlags.reviewEligible,
    'Debug-only source must not bypass truth gates after local unpark.',
  )

  const missingAuthority = buildTruth({ finalRoute: null })
  assert(!missingAuthority.buildTruthReady, 'Missing route authority must block truth readiness.')
  assert(
    missingAuthority.rejectionReasons.includes('build_route_authority_unavailable'),
    'Missing route authority reason must be explicit.',
  )

  const artifactMismatch = buildTruth({ selectedArtifactId: 'wrong-artifact' })
  assert(!artifactMismatch.buildTruthReady, 'Selected artifact mismatch must block readiness.')
  assert(
    artifactMismatch.rejectionReasons.includes('build_selected_artifact_mismatch'),
    'Selected artifact mismatch reason must be explicit.',
  )

  const directionMismatch = buildTruth({ selectedDirectionId: 'wrong-direction' })
  assert(!directionMismatch.buildTruthReady, 'Selected direction mismatch must block readiness.')
  assert(
    directionMismatch.rejectionReasons.includes('build_selected_direction_mismatch'),
    'Selected direction mismatch reason must be explicit.',
  )

  const scattered = buildTruth({ geo: scatteredGeo })
  assert(scattered.buildTruthReady, 'Build geography warning alone must not block readiness.')
  assert(
    scattered.warningReasons.includes('build_geo_scattered_required_anchor'),
    'Build geography warning must be preserved.',
  )

  const wrongRole = buildTruth({ anchorRole: 'start' })
  assert(!wrongRole.buildTruthReady, 'Anchor truth failure must block readiness.')
  assert(
    wrongRole.rejectionReasons.includes('build_anchor_wrong_role'),
    'Anchor wrong-role reason must be explicit.',
  )

  const missingAnchor = buildTruth({ missingAnchor: true })
  assert(!missingAnchor.buildTruthReady, 'Missing anchor must block readiness.')
  assert(
    missingAnchor.rejectionReasons.includes('build_anchor_truth_missing'),
    'Missing anchor reason must be explicit.',
  )

  const closedHours = buildTruth({ hoursStatus: 'closed_for_plan_window' })
  assert(!closedHours.buildTruthReady, 'Closed hours must block readiness.')
  assert(
    closedHours.rejectionReasons.includes('build_hours_blocked'),
    'Closed-hours reason must be explicit.',
  )

  const sandboxSource = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')
  assert(
    sandboxSource.includes('const buildProviderSelectionAllowed = true'),
    'Build provider selection flag must be locally unparked.',
  )
  assert(
    sandboxSource.includes('const buildProviderMergedIntoVisiblePool = true'),
    'Build provider visible merge flag must be locally unparked.',
  )
  assert(
    sandboxSource.includes('buildSelectedCardTruthReady'),
    'Build Review gate must consume Build truth readiness.',
  )
  assert(
    sandboxSource.includes('buildPreGenerationSelectionReady'),
    'Build local generation gate must consume static candidate admission readiness.',
  )
  assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)

  process.stdout.write('build local unpark: passed\n')
  process.stdout.write(
    `${JSON.stringify(
      {
        fetchCallCount,
        parkedBuildTruthReady: parkedStatic.buildTruthReady,
        parkedSelectableWhenUnparked: parkedStatic.buildSelectableWhenUnparked,
        parkedReviewEligible: parkedStatic.reviewEligible,
        localUnparkedReviewEligible: localUnparkedStatic.reviewEligible,
        localUnparkedCardSelectable: localUnparkedStatic.cardSelectable,
        providerShadowExcluded: providerShadow.providerShadowExcluded,
        missingAnchorReady: missingAnchor.buildTruthReady,
        scatteredWarnings: scattered.warningReasons,
        buildProviderSelectionAllowed: true,
        buildProviderMergedIntoVisiblePool: true,
      },
      null,
      2,
    )}\n`,
  )
}

try {
  main()
} catch (error: unknown) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
} finally {
  globalThis.fetch = originalFetch
}
