import { readFileSync } from 'node:fs'
import {
  buildBuildCardTruthModel,
  buildModeAwarePublicRouteTruth,
} from '../src/app/services/canonicalPublicRouteTruthService.ts'
import { buildAnchorTruthContract } from '../src/domain/artifacts/buildAnchorTruthContract.ts'
import type { BuildAnchorCanonicalRole } from '../src/domain/artifacts/buildAnchorTruthContract.ts'
import type { ContractEntryArtifact } from '../src/domain/artifacts/contractEntryArtifact.ts'
import type { RuntimeRouteArtifact, RuntimeRouteStop } from '../src/domain/artifacts/runtimeRouteArtifact.ts'
import type { Itinerary, ItineraryStop, UserStopRole } from '../src/domain/types/itinerary.ts'
import {
  evaluateBuildCandidateAdmission,
  evaluateCandidateGeoPosture,
} from '../src/app/services/buildCandidateAdmission/buildCandidateAdmissionService.ts'
import type { BearingsStaticRuntimeHoursProofResult } from '../src/domain/bearings/staticRuntimeHoursProof.ts'
import type { ScenarioRouteGeoCoherence } from '../src/domain/interpretation/construction/scenarioBuilder.ts'

const originalFetch = globalThis.fetch
let fetchCallCount = 0

const fetchTrap: typeof fetch = async () => {
  fetchCallCount += 1
  throw new Error('Build card truth test must not call fetch.')
}

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

function buildRuntimeStop(role: UserStopRole, venueId: string, stopIndex: number): RuntimeRouteStop {
  return {
    id: `${role}:${venueId}`,
    sourceStopId: `${role}:${venueId}`,
    displayName:
      role === 'start' ? 'Good Karma' : role === 'highlight' ? 'Paper Plane' : 'Haberdasher',
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

function buildRuntimeRoute(patch: Partial<RuntimeRouteArtifact> = {}): RuntimeRouteArtifact {
  const stops = [
    buildRuntimeStop('start', routeIds.start, 0),
    buildRuntimeStop('highlight', routeIds.highlight, 1),
    buildRuntimeStop('windDown', routeIds.windDown, 2),
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

function buildItineraryStop(role: UserStopRole, venueId: string): ItineraryStop {
  return {
    id: `${role}:${venueId}`,
    role,
    title: role === 'windDown' ? 'Wind Down' : role === 'highlight' ? 'Highlight' : 'Start',
    venueId,
    venueName:
      role === 'start' ? 'Good Karma' : role === 'highlight' ? 'Paper Plane' : 'Haberdasher',
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

function buildItinerary(): Itinerary {
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
      routeSummary: 'Good Karma to Paper Plane to Haberdasher.',
    },
    shareSummary: 'Paper Plane route.',
  }
}

function buildArtifact(patch: Partial<ContractEntryArtifact> = {}): ContractEntryArtifact {
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

function proof(
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

function buildAnchorContract(role: BuildAnchorCanonicalRole = 'highlight') {
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
  artifact?: ContractEntryArtifact
  finalRoute?: RuntimeRouteArtifact | null
  anchorRole?: BuildAnchorCanonicalRole
  sourceKind?: 'static' | 'provider_shadow' | 'debug_only'
  selectedArtifactId?: string
  selectedDirectionId?: string
  hoursStatus?: BearingsStaticRuntimeHoursProofResult['status']
  geo?: ScenarioRouteGeoCoherence | null
}) {
  const artifact = params.artifact ?? buildArtifact()
  const finalRoute = params.finalRoute === undefined ? buildRuntimeRoute() : params.finalRoute
  const anchorContract = buildAnchorContract(params.anchorRole ?? 'highlight')
  const admission = evaluateBuildCandidateAdmission({
    mode: 'build',
    anchorContract,
    contractEntryArtifact: artifact,
    runtimeRouteArtifact: finalRoute,
    hoursProof: proof(params.hoursStatus ?? 'open_for_plan_window'),
    planningWindow,
    geoCoherence: params.geo ?? null,
    buildParked: {
      providerSelectionAllowed: false,
      providerMergedIntoVisiblePool: false,
    },
  })
  return buildBuildCardTruthModel({
    artifact,
    selectedCandidateArtifact: artifact,
    selectedArtifactId: params.selectedArtifactId ?? artifact.id,
    selectedDirectionId: params.selectedDirectionId ?? artifact.selection.directionId,
    approvedPayload: finalRoute
      ? {
          artifactId: artifact.id,
          selectedDirectionId: finalRoute.selectedDirectionId,
          finalRoute,
          selectedClusterConfirmation: 'Downtown works tonight.',
          itinerary: buildItinerary(),
          sourceKind: params.sourceKind ?? 'static',
        }
      : null,
    candidateAdmission: admission,
    anchorTruthContract: anchorContract,
    sourceKind: params.sourceKind ?? 'static',
    buildProviderSelectionAllowed: false,
    buildProviderMergedIntoVisiblePool: false,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
}

function main(): void {
  globalThis.fetch = fetchTrap

  const passing = buildTruth({})
  assert(passing.approvedPayloadTruthAllowed, 'Build approved payload truth must pass when all gates pass.')
  assert(passing.visibleCardEligible, 'Build visible-card eligibility must pass when all gates pass.')
  assert(passing.buildTruthReady, 'Build truth must be ready when all canonical gates pass.')
  assert(
    passing.buildSelectableWhenUnparked,
    'Build card must report selectable readiness for a future unpark when truth passes.',
  )
  assert(!passing.reviewEligible, 'Build Review eligibility must remain false while parked.')
  assert(!passing.cardSelectable, 'Build card must remain non-selectable while parked.')

  const wrongRole = buildTruth({ anchorRole: 'start' })
  assert(!wrongRole.reviewEligible, 'Wrong anchor role must block Review truth.')
  assert(
    wrongRole.rejectionReasons.includes('build_anchor_wrong_role'),
    'Wrong anchor role must report build_anchor_wrong_role.',
  )

  const providerShadow = buildTruth({ sourceKind: 'provider_shadow' })
  assert(!providerShadow.buildTruthReady, 'Provider-shadow candidate must not become Build truth-ready.')
  assert(!providerShadow.routeAuthorityLockReady, 'Provider-shadow candidate must not become routeAuthority lock-ready.')
  assert(!providerShadow.cardSelectable, 'Provider-shadow candidate must not be selectable.')
  assert(providerShadow.providerShadowExcluded, 'Provider-shadow exclusion diagnostic must be true.')
  assert(
    !providerShadow.isApprovedSelectableSource,
    'Provider-shadow candidate must not be an approved selectable source.',
  )
  assert(
    providerShadow.rejectionReasons.includes('build_provider_shadow_not_selectable'),
    'Provider-shadow candidate must report provider-shadow exclusion.',
  )

  const debugOnly = buildTruth({ sourceKind: 'debug_only' })
  assert(!debugOnly.cardSelectable, 'Debug-only candidate must not be selectable.')
  assert(!debugOnly.isApprovedSelectableSource, 'Debug-only candidate must not be an approved selectable source.')
  assert(
    debugOnly.rejectionReasons.includes('build_debug_candidate_not_selectable'),
    'Debug-only candidate must report debug-only exclusion.',
  )

  const missingRouteAuthority = buildTruth({ finalRoute: null })
  assert(!missingRouteAuthority.reviewEligible, 'Missing route authority must block Review truth.')
  assert(
    missingRouteAuthority.rejectionReasons.includes('build_route_authority_unavailable'),
    'Missing route authority must be explicit.',
  )

  const artifactMismatch = buildTruth({ selectedArtifactId: 'wrong-artifact' })
  assert(!artifactMismatch.reviewEligible, 'Selected artifact mismatch must block Review truth.')
  assert(
    artifactMismatch.rejectionReasons.includes('build_selected_artifact_mismatch'),
    'Selected artifact mismatch must be explicit.',
  )

  const directionMismatch = buildTruth({ selectedDirectionId: 'wrong-direction' })
  assert(!directionMismatch.reviewEligible, 'Selected direction mismatch must block Review truth.')
  assert(
    directionMismatch.rejectionReasons.includes('build_selected_direction_mismatch'),
    'Selected direction mismatch must be explicit.',
  )

  const driftedRoute = buildRuntimeRoute({
    stops: [
      buildRuntimeStop('start', 'sj-heritage-tea-house', 0),
      buildRuntimeStop('highlight', routeIds.highlight, 1),
      buildRuntimeStop('windDown', 'sj-jtown-matcha-kissaten', 2),
    ],
    routeSummary: 'Heritage Tea House to Paper Plane to Jtown Matcha Kissaten.',
  })
  const drifted = buildTruth({ finalRoute: driftedRoute })
  assert(!drifted.routeAuthorityLockReady, 'Build route drift must block routeAuthority lock-ready truth.')
  assert(!drifted.reviewEligible, 'Build route drift must block Review truth.')
  assert(
    drifted.diagnostics.routeAuthorityBuildReasons.includes('build_candidate_contract_drifted'),
    'Build route drift must be diagnosed as build_candidate_contract_drifted.',
  )
  assert(
    drifted.diagnostics.routeAuthorityBuildReasons.includes('generated_route_identity_mismatch'),
    'Build route drift must report generated_route_identity_mismatch.',
  )

  const scattered = buildTruth({ geo: scatteredGeo })
  assert(scattered.buildTruthReady, 'Build scattered geography warning alone must not block truth readiness.')
  assert(!scattered.reviewEligible, 'Build scattered geography route must remain Review-ineligible while parked.')
  assert(
    scattered.warningReasons.includes('build_geo_scattered_required_anchor'),
    'Build scattered geography must remain a warning.',
  )

  const closedHours = buildTruth({ hoursStatus: 'closed_for_plan_window' })
  assert(!closedHours.reviewEligible, 'Closed hours must block Build truth.')
  assert(
    closedHours.rejectionReasons.includes('build_hours_blocked'),
    'Closed-hours block must be explicit.',
  )

  const curateGeo = evaluateCandidateGeoPosture({
    mode: 'curate',
    geoCoherence: scatteredGeo,
  })
  assert(
    curateGeo.hardBlockReason === 'curate_geo_scattered',
    'Curate scattered geography hard gate must remain unchanged.',
  )

  const modeAwareBuild = buildModeAwarePublicRouteTruth({
    mode: 'build',
    input: {
      artifact: buildArtifact(),
      selectedCandidateArtifact: buildArtifact(),
      selectedArtifactId: 'build-candidate-paper-plane',
      selectedDirectionId: 'downtown-cocktails',
      approvedPayload: {
        artifactId: 'build-candidate-paper-plane',
        selectedDirectionId: 'downtown-cocktails',
        finalRoute: buildRuntimeRoute(),
        selectedClusterConfirmation: 'Downtown works tonight.',
        itinerary: buildItinerary(),
        sourceKind: 'static',
      },
      candidateAdmission: evaluateBuildCandidateAdmission({
        mode: 'build',
        anchorContract: buildAnchorContract(),
        contractEntryArtifact: buildArtifact(),
        runtimeRouteArtifact: buildRuntimeRoute(),
        hoursProof: proof('open_for_plan_window'),
        planningWindow,
      }),
      anchorTruthContract: buildAnchorContract(),
      sourceKind: 'static',
      buildProviderSelectionAllowed: false,
      buildProviderMergedIntoVisiblePool: false,
    },
  })
  assert(modeAwareBuild.mode === 'build', 'Mode-aware truth service must return Build result.')
  assert(
    modeAwareBuild.truth.buildTruthReady,
    'Mode-aware Build truth must preserve truth readiness when gates pass.',
  )
  assert(
    !modeAwareBuild.truth.reviewEligible,
    'Mode-aware Build truth must keep Review eligibility parked.',
  )

  const sandboxSource = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')
  assert(
    sandboxSource.includes('const buildProviderSelectionAllowed = true'),
    'Build provider selection must be locally unparked.',
  )
  assert(
    sandboxSource.includes('const buildProviderMergedIntoVisiblePool = true'),
    'Build provider visible merge must be locally unparked.',
  )

  assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)

  process.stdout.write('build card truth: passed\n')
  process.stdout.write(
    `${JSON.stringify(
      {
        fetchCallCount,
        passingBuildTruthReady: passing.buildTruthReady,
        passingReviewEligible: passing.reviewEligible,
        passingCardSelectable: passing.cardSelectable,
        providerShadowBuildTruthReady: providerShadow.buildTruthReady,
        providerShadowExcluded: providerShadow.providerShadowExcluded,
        providerShadowReasons: providerShadow.rejectionReasons,
        debugOnlyReasons: debugOnly.rejectionReasons,
        scatteredWarnings: scattered.warningReasons,
        curateGeoHardBlock: curateGeo.hardBlockReason,
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
