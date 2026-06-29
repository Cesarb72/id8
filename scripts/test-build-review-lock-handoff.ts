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
import type { ArcCandidate } from '../src/domain/types/arc.ts'
import type { RouteShapeContract } from '../src/domain/types/intent.ts'
import type { Itinerary, ItineraryStop, UserStopRole } from '../src/domain/types/itinerary.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const originalFetch = globalThis.fetch
let fetchCallCount = 0

globalThis.fetch = (async () => {
  fetchCallCount += 1
  throw new Error('test-build-review-lock-handoff must not call fetch.')
}) as typeof fetch

const staticRouteIds = {
  start: 'sj-petiscos',
  highlight: 'sj-paper-plane',
  windDown: 'sj-hedley-club-lounge',
} as const

const replacementRouteIds = {
  start: 'sj-good-karma',
  highlight: 'sj-paper-plane',
  windDown: 'sj-haberdasher',
} as const

try {
  const staticArtifact = buildArtifact({
    id: 'step2_static_build_paper_plane',
    sourceOpportunityId: 'step2_static_build_paper_plane',
    routeIds: staticRouteIds,
    routeSummary: 'Petiscos to Paper Plane to Hedley Club Lounge.',
  })
  const generatedArtifact = buildArtifact({
    id: 'generated_public_build_paper_plane',
    sourceOpportunityId: 'generated_public_build_paper_plane',
    routeIds: replacementRouteIds,
    routeSummary: 'Good Karma to Paper Plane to Haberdasher.',
  })
  const preParityGeneratedArtifact = buildArtifact({
    id: 'generated_public_build_paper_plane_pre_parity',
    sourceOpportunityId: 'generated_public_build_paper_plane_pre_parity',
    routeIds: staticRouteIds,
    routeSummary: 'Petiscos to Paper Plane to Hedley Club Lounge.',
  })
  const generatedFinalRoute = buildRuntimeRoute({
    routeIds: replacementRouteIds,
    routeSummary: 'Good Karma to Paper Plane to Haberdasher.',
  })
  const generatedItinerary = buildItinerary(replacementRouteIds)
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
  assert(!staticOnlyTruth.reviewEligible, 'Static pre-generation must not be Review-eligible by itself.')
  assert(!staticOnlyTruth.routeAuthorityLockReady, 'Static pre-generation must not be routeAuthority lock-ready.')
  assert(
    staticOnlyTruth.rejectionReasons.includes('build_final_route_missing'),
    'Static-only Review truth must still report missing finalRoute.',
  )

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
  const deterministicReplacementPolicy = evaluateBuildSupportReplacementPolicy({
    selectedCandidateArtifact: staticArtifact,
    generatedArtifact,
    finalRoute: generatedFinalRoute,
    selectedArc: buildSelectedArc(replacementRouteIds),
    routeShapeContract: buildRouteShapeContractFixture(),
    selectedAnchorVenueId: 'sj-paper-plane',
    selectedAnchorRequiredRole: 'highlight',
    requiredStopVenueIdsByRole: {
      highlight: 'sj-paper-plane',
    },
  })
  assert(
    deterministicReplacementPolicy.admitted,
    `Deterministic support replacement policy must admit traced support replacements: ${JSON.stringify(
      deterministicReplacementPolicy,
    )}`,
  )
  assert(
    deterministicReplacementPolicy.deterministic,
    'Deterministic support replacement policy must mark admitted replacements deterministic.',
  )
  assert(
    deterministicReplacementPolicy.replacedRoles.join(',') === 'start,windDown',
    'Deterministic support replacement policy must expose replaced support roles.',
  )
  assert(
    deterministicReplacementPolicy.reasonCodes.includes('replacement_selected_by_deterministic_arc'),
    'Support replacement must be traced to the deterministic selected arc.',
  )

  const requiredSupportReplacementPolicy = evaluateBuildSupportReplacementPolicy({
    selectedCandidateArtifact: staticArtifact,
    generatedArtifact,
    finalRoute: generatedFinalRoute,
    selectedArc: buildSelectedArc(replacementRouteIds),
    routeShapeContract: buildRouteShapeContractFixture(),
    selectedAnchorVenueId: 'sj-paper-plane',
    selectedAnchorRequiredRole: 'highlight',
    requiredStopVenueIdsByRole: {
      start: 'sj-petiscos',
      highlight: 'sj-paper-plane',
    },
  })
  assert(
    !requiredSupportReplacementPolicy.admitted,
    'User-marked required support stops must not be replaceable.',
  )
  assert(
    requiredSupportReplacementPolicy.rejectionReasons.includes('required_support_stop_replaced'),
    'Required support replacement must expose required_support_stop_replaced.',
  )

  const approvedPayload: BuildApprovedPayloadReference = {
    artifactId: generatedArtifact.id,
    selectedDirectionId: generatedFinalRoute.selectedDirectionId,
    finalRoute: generatedFinalRoute,
    selectedClusterConfirmation: 'Generated Paper Plane route is ready for Review.',
    itinerary: generatedItinerary,
    sourceKind: 'static',
  }
  const generatedTruthWithoutHandoff = buildBuildCardTruthModel({
    artifact: generatedArtifact,
    selectedCandidateArtifact: staticArtifact,
    selectedArtifactId: generatedArtifact.id,
    selectedDirectionId: generatedArtifact.selection.directionId,
    approvedPayload,
    candidateAdmission: generatedAdmission,
    anchorTruthContract: anchorContract,
    selectedAnchorRequiredRole: 'highlight',
    sourceKind: 'static',
    buildProviderSelectionAllowed: true,
    buildProviderMergedIntoVisiblePool: true,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert(
    !generatedTruthWithoutHandoff.reviewEligible,
    'Generated replacement must remain blocked without explicit Build handoff admission.',
  )
  assert(
    generatedTruthWithoutHandoff.diagnostics.routeAuthorityBuildReasons.includes(
      'build_candidate_contract_drifted',
    ),
    'Unadmitted replacement must expose selected static candidate drift.',
  )

  const generatedTruthWithHandoff = buildBuildCardTruthModel({
    artifact: generatedArtifact,
    selectedCandidateArtifact: staticArtifact,
    selectedArtifactId: generatedArtifact.id,
    selectedDirectionId: generatedArtifact.selection.directionId,
    approvedPayload,
    candidateAdmission: generatedAdmission,
    anchorTruthContract: anchorContract,
    selectedAnchorRequiredRole: 'highlight',
    sourceKind: 'static',
    routeReplacementAdmitted: deterministicReplacementPolicy.admitted,
    buildProviderSelectionAllowed: true,
    buildProviderMergedIntoVisiblePool: true,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert(generatedTruthWithHandoff.routeAuthorityLockReady, 'Generated handoff must become routeAuthority lock-ready.')
  assert(generatedTruthWithHandoff.reviewEligible, 'Generated handoff must make Review eligible.')
  assert(
    generatedTruthWithHandoff.diagnostics.lockInputAvailable,
    'Generated handoff must make lock input available.',
  )
  assert(
    generatedTruthWithHandoff.diagnostics.routeAuthorityBuildReasons.includes(
      'required_anchor_role_survived',
    ),
    'Generated handoff must prove the Paper Plane anchor survived.',
  )

  const requiredSupportTruth = buildBuildCardTruthModel({
    artifact: generatedArtifact,
    selectedCandidateArtifact: staticArtifact,
    selectedArtifactId: generatedArtifact.id,
    selectedDirectionId: generatedArtifact.selection.directionId,
    approvedPayload,
    candidateAdmission: generatedAdmission,
    anchorTruthContract: anchorContract,
    selectedAnchorRequiredRole: 'highlight',
    sourceKind: 'static',
    routeReplacementAdmitted: requiredSupportReplacementPolicy.admitted,
    buildProviderSelectionAllowed: true,
    buildProviderMergedIntoVisiblePool: true,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert(
    !requiredSupportTruth.reviewEligible,
    'Review must stay hidden when deterministic replacement policy rejects required support drift.',
  )

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
    routeReplacementAdmitted: true,
    buildProviderSelectionAllowed: true,
    buildProviderMergedIntoVisiblePool: true,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert(!providerShadowTruth.reviewEligible, 'Provider-shadow artifacts must remain non-authority.')
  assert(
    providerShadowTruth.rejectionReasons.includes('build_provider_shadow_not_selectable'),
    'Provider-shadow exclusion must remain explicit.',
  )

  const preParityGeneratedSnapshot = buildRouteAuthoritySnapshot({
    contractEntryArtifact: preParityGeneratedArtifact,
    runtimeRouteArtifact: generatedFinalRoute,
    selectedDirectionId: preParityGeneratedArtifact.selection.directionId,
    selectedArtifactId: preParityGeneratedArtifact.id,
    selectedClusterConfirmation: 'Generated Paper Plane route is ready for Review.',
    itinerary: generatedItinerary,
    buildContext: {
      mode: 'build',
      selectedCandidateArtifact: staticArtifact,
      selectedCandidateSourceKind: 'build_static_pre_generation',
      selectedAnchorVenueId: 'sj-paper-plane',
      selectedAnchorRequiredRole: 'highlight',
      routeReplacementAdmitted: true,
    },
  })
  assert(
    preParityGeneratedSnapshot.validationStatus === 'invalid',
    'Pre-parity generated artifact identity must not validate against the post-parity finalRoute.',
  )
  assert(
    preParityGeneratedSnapshot.rejectionReasons.includes('runtime_route_artifact_mismatch'),
    'Pre-parity generated artifact identity must expose RuntimeRouteArtifact mismatch.',
  )

  const generatedSnapshot = buildRouteAuthoritySnapshot({
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
      routeReplacementAdmitted: true,
    },
  })
  const lockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot: generatedSnapshot,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert(lockInput.ok, 'Generated routeAuthority truth must produce lock input.')
  assert(
    lockInput.input.canonicalRouteArtifact.finalRoute.stops
      .map((stop) => stop.venueId)
      .join(' -> ') ===
      'sj-good-karma -> sj-paper-plane -> sj-haberdasher',
    'Lock input must read generated finalRoute truth.',
  )

  const staticSnapshot = buildRouteAuthoritySnapshot({
    contractEntryArtifact: staticArtifact,
    selectedDirectionId: staticArtifact.selection.directionId,
    selectedArtifactId: staticArtifact.id,
    buildContext: {
      mode: 'build',
      selectedCandidateArtifact: staticArtifact,
      selectedCandidateSourceKind: 'build_static_pre_generation',
      selectedAnchorVenueId: 'sj-paper-plane',
      selectedAnchorRequiredRole: 'highlight',
      routeReplacementAdmitted: false,
    },
  })
  const staticLockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot: staticSnapshot,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert(!staticLockInput.ok, 'Lock must not succeed without RuntimeRouteArtifact/finalRoute truth.')

  const sandboxSource = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')
  const generatedArtifactBuilderSource = readFileSync(
    'src/domain/artifacts/buildContractEntryArtifactFromGeneration.ts',
    'utf8',
  )
  const routeAuthoritySource = readFileSync(
    'src/app/services/routeAuthority/routeAuthorityService.ts',
    'utf8',
  )
  assert(
    sandboxSource.includes('buildGeneratedCanonicalHandoff') &&
      sandboxSource.includes('routeReplacementAdmitted') &&
      sandboxSource.includes('evaluateBuildSupportReplacementPolicy'),
    'Sandbox page must expose a narrow generated Build canonical handoff gated by deterministic replacement policy.',
  )
  assert(
    sandboxSource.includes('buildSelectedCardTruthReady') &&
      !sandboxSource.includes('!isBuildWrapperActive || buildReviewTruthEligible || buildPreGenerationSelectionReady'),
    'Build Review CTA gate must not be loosened by static selection readiness.',
  )
  assert(
    sandboxSource.includes("import { buildContractEntryArtifactFromGeneration }") &&
      sandboxSource.includes('const postParityContractEntryArtifact = buildContractEntryArtifactFromGeneration') &&
      sandboxSource.includes('itinerary: canonicalItinerary') &&
      sandboxSource.includes('selectedArc: anchoredPlan.selectedArc') &&
      sandboxSource.includes('scoredVenues: strongCurationPass.scoredVenues') &&
      sandboxSource.includes('generatedContractEntryArtifact: postParityContractEntryArtifact'),
    'Build handoff must rebuild generated ContractEntryArtifact from the shared post-parity route basis.',
  )
  assert(
    generatedArtifactBuilderSource.includes('const support = itinerary.stops.map') &&
      !generatedArtifactBuilderSource.includes("stop.role !== 'start' && stop.role !== 'highlight' && stop.role !== 'windDown'"),
    'Generated ContractEntryArtifact role coverage must retain stable IDs for canonical roles.',
  )
  assert(
    routeAuthoritySource.includes('!buildDiagnostics.routeReplacementAdmitted'),
    'RouteAuthority must keep generated-route identity mismatch blocked unless replacement is admitted.',
  )
  assert(fetchCallCount === 0, `Expected no provider/fetch calls, received ${fetchCallCount}.`)

  process.stdout.write('build review lock handoff: passed\n')
  process.stdout.write(
    `${JSON.stringify(
      {
        staticReviewEligible: staticOnlyTruth.reviewEligible,
        preParityGeneratedStatus: preParityGeneratedSnapshot.validationStatus,
        deterministicReplacementPolicyAdmitted: deterministicReplacementPolicy.admitted,
        deterministicReplacementPolicyReasons: deterministicReplacementPolicy.reasonCodes,
        generatedReviewEligible: generatedTruthWithHandoff.reviewEligible,
        generatedRouteAuthorityStatus: generatedSnapshot.validationStatus,
        lockInputAvailable: lockInput.ok,
        providerShadowReviewEligible: providerShadowTruth.reviewEligible,
        fetchCallCount,
      },
      null,
      2,
    )}\n`,
  )
} finally {
  globalThis.fetch = originalFetch
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
    id: 'rshape_test_build_paper_plane',
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
          { role: 'highlight', name: 'Paper Plane', venueId: params.routeIds.highlight },
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
