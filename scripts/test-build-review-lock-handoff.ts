import { readFileSync } from 'node:fs'
import {
  buildBuildCardTruthModel,
  type BuildApprovedPayloadReference,
} from '../src/app/services/canonicalPublicRouteTruthService.ts'
import {
  buildLockInputFromRouteAuthoritySnapshot,
  buildRouteAuthoritySnapshot,
} from '../src/app/services/routeAuthority/routeAuthorityService.ts'
import { evaluateBuildCandidateAdmission } from '../src/app/services/buildCandidateAdmission/buildCandidateAdmissionService.ts'
import { buildAnchorTruthContract } from '../src/domain/artifacts/buildAnchorTruthContract.ts'
import type { ContractEntryArtifact } from '../src/domain/artifacts/contractEntryArtifact.ts'
import type { RuntimeRouteArtifact, RuntimeRouteStop } from '../src/domain/artifacts/runtimeRouteArtifact.ts'
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

  const generatedRouteIds = {
    start: 'sj-good-karma',
    highlight: 'sj-paper-plane',
    windDown: 'sj-haberdasher',
  } as const
  const haberdasherRouteIds = {
    start: 'sj-hedley-club-lounge',
    highlight: 'sj-opera-san-jose',
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
    routeIds: generatedRouteIds,
    routeSummary: 'Good Karma to Paper Plane to Haberdasher.',
  })
  const preParityGeneratedArtifact = buildArtifact({
    id: 'generated_public_build_paper_plane_pre_parity',
    sourceOpportunityId: 'generated_public_build_paper_plane_pre_parity',
    routeIds: staticRouteIds,
    routeSummary: 'Petiscos to Paper Plane to Hedley Club Lounge.',
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
    selectedCandidateArtifact: null,
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
  assert(generatedTruth.routeAuthorityLockReady, 'Generated Build truth must become routeAuthority lock-ready.')
  assert(generatedTruth.reviewEligible, 'Generated Build truth must make Review eligible.')
  assert(generatedTruth.diagnostics.lockInputAvailable, 'Generated Build truth must make lock input available.')
  assert(
    !generatedTruth.diagnostics.routeAuthorityBuildReasons.includes('generated_route_identity_mismatch'),
    'Generated Build truth must not compare against a second static route identity.',
  )
  assert(
    !generatedTruth.diagnostics.routeAuthorityBuildReasons.includes('build_candidate_contract_drifted'),
    'Generated Build truth must not use selected static card drift as a gate.',
  )

  const providerShadowTruth = buildBuildCardTruthModel({
    artifact: generatedArtifact,
    selectedCandidateArtifact: null,
    selectedArtifactId: generatedArtifact.id,
    selectedDirectionId: generatedArtifact.selection.directionId,
    approvedPayload,
    candidateAdmission: generatedAdmission,
    anchorTruthContract: anchorContract,
    selectedAnchorRequiredRole: 'highlight',
    sourceKind: 'provider_shadow',
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
      selectedCandidateArtifact: null,
      selectedCandidateSourceKind: null,
      selectedAnchorVenueId: 'sj-paper-plane',
      selectedAnchorRequiredRole: 'highlight',
      routeReplacementAdmitted: false,
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
      selectedCandidateArtifact: null,
      selectedCandidateSourceKind: null,
      selectedAnchorVenueId: 'sj-paper-plane',
      selectedAnchorRequiredRole: 'highlight',
      routeReplacementAdmitted: false,
    },
  })
  assert(generatedSnapshot.validationStatus === 'valid', 'Generated single-source routeAuthority must be valid.')
  assert(
    !generatedSnapshot.rejectionReasons.includes('generated_route_identity_mismatch'),
    'generated_route_identity_mismatch must be unreachable for single-source Build routeAuthority.',
  )
  assert(
    !generatedSnapshot.rejectionReasons.includes('static_candidate_not_authority'),
    'Promoted generated Build route must not retain static candidate authority metadata.',
  )
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

  const haberdasherArtifact = buildArtifact({
    id: 'generated_public_build_haberdasher',
    sourceOpportunityId: 'generated_public_build_haberdasher',
    routeIds: haberdasherRouteIds,
    routeSummary: 'Hedley Club Lounge to Opera San Jose to Haberdasher.',
    anchorVenueId: 'sj-haberdasher',
    anchorRole: 'windDown',
    anchorName: 'Haberdasher',
    routeTitle: 'Haberdasher Night',
  })
  const haberdasherFinalRoute = buildRuntimeRoute({
    routeIds: haberdasherRouteIds,
    routeSummary: 'Hedley Club Lounge to Opera San Jose to Haberdasher.',
    routeId: 'build-runtime-haberdasher',
    routeHeadline: 'Haberdasher Night',
  })
  const haberdasherItinerary = buildItinerary(haberdasherRouteIds)
  const haberdasherAnchorContract = buildAnchorTruthContract({
    identity: {
      venueId: 'sj-haberdasher',
      providerRecordId: 'ChIJp3c0MJzMj4ARx0TJBncXxAA',
      displayName: 'Haberdasher',
    },
    role: {
      role: 'windDown',
      roleResolutionSource: 'explicit',
    },
  })
  const haberdasherAdmission = evaluateBuildCandidateAdmission({
    mode: 'build',
    anchorContract: haberdasherAnchorContract,
    contractEntryArtifact: haberdasherArtifact,
    runtimeRouteArtifact: haberdasherFinalRoute,
    buildParked: {
      providerSelectionAllowed: true,
      providerMergedIntoVisiblePool: true,
    },
  })
  assert(haberdasherAdmission.admitted, 'Haberdasher windDown generated route must pass admission.')
  assert(
    haberdasherAdmission.requiredAnchorRole === 'windDown',
    'Haberdasher required anchor role must remain windDown.',
  )
  const haberdasherSnapshot = buildRouteAuthoritySnapshot({
    contractEntryArtifact: haberdasherArtifact,
    runtimeRouteArtifact: haberdasherFinalRoute,
    selectedDirectionId: haberdasherArtifact.selection.directionId,
    selectedArtifactId: haberdasherArtifact.id,
    selectedClusterConfirmation: 'Generated Haberdasher route is ready for Review.',
    itinerary: haberdasherItinerary,
    buildContext: {
      mode: 'build',
      selectedCandidateArtifact: null,
      selectedCandidateSourceKind: null,
      selectedAnchorVenueId: 'sj-haberdasher',
      selectedAnchorRequiredRole: 'windDown',
      routeReplacementAdmitted: false,
    },
  })
  assert(haberdasherSnapshot.validationStatus === 'valid', 'Haberdasher windDown routeAuthority must be valid.')
  assert(
    haberdasherSnapshot.buildDiagnostics?.reasons.includes('required_anchor_role_survived'),
    'routeAuthority must credit Haberdasher as the required windDown anchor through runtimeRoute.',
  )
  assert(
    !haberdasherSnapshot.rejectionReasons.includes('required_anchor_role_missing'),
    'routeAuthority must not emit required_anchor_role_missing when runtimeRoute contains Haberdasher as windDown.',
  )
  assert(
    !haberdasherSnapshot.rejectionReasons.includes('static_candidate_not_authority'),
    'Promoted Haberdasher generated route must not be classified as static candidate authority.',
  )
  const haberdasherLockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot: haberdasherSnapshot,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert(haberdasherLockInput.ok, 'Haberdasher windDown generated route must produce lock input.')
  assert(
    haberdasherLockInput.input.canonicalRouteArtifact.finalRoute.stops
      .map((stop) => stop.venueId)
      .join(' -> ') ===
      'sj-hedley-club-lounge -> sj-opera-san-jose -> sj-haberdasher',
    'Haberdasher lock input must preserve the promoted generated finalRoute.',
  )

  const sandboxSource = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')
  const buildBranchIndex = sandboxSource.indexOf('if (isBuildWrapperActive) {')
  const waypointEntryIndex = sandboxSource.indexOf('buildContractDrivenBuildWaypointPlan({')
  const compatibilityProjectionIndex = sandboxSource.indexOf(
    'const planBuildInput = projectConciergeIntentToIntentInput({',
  )
  assert(
    buildBranchIndex >= 0 &&
      waypointEntryIndex > buildBranchIndex &&
      (compatibilityProjectionIndex === -1 || compatibilityProjectionIndex > waypointEntryIndex),
    'Sandbox page must enter the Waypoint contract-driven Build branch before any non-Build compatibility projection.',
  )
  assert(
    !sandboxSource.includes('evaluateBuildSupportReplacementPolicy'),
    'Sandbox page must leave buildSupportReplacementPolicy unreached for Build Step 1b.',
  )
  assert(fetchCallCount === 0, `Expected no provider/fetch calls, received ${fetchCallCount}.`)

  process.stdout.write('build review lock handoff: passed\n')
  process.stdout.write(
    `${JSON.stringify(
      {
        staticReviewEligible: staticOnlyTruth.reviewEligible,
        preParityGeneratedStatus: preParityGeneratedSnapshot.validationStatus,
        generatedReviewEligible: generatedTruth.reviewEligible,
        generatedRouteAuthorityStatus: generatedSnapshot.validationStatus,
        generatedRouteIdentityMismatch: generatedSnapshot.rejectionReasons.includes(
          'generated_route_identity_mismatch',
        ),
        selectedStaticCandidateInGeneratedAuthority: false,
        lockInputAvailable: lockInput.ok,
        providerShadowReviewEligible: providerShadowTruth.reviewEligible,
        haberdasherRouteAuthorityStatus: haberdasherSnapshot.validationStatus,
        haberdasherRequiredAnchorRole: haberdasherAdmission.requiredAnchorRole,
        haberdasherLockInputAvailable: haberdasherLockInput.ok,
        replacementPolicyReachedByBuildPage: false,
        fetchCallCount,
      },
      null,
      2,
    )}\n`,
  )
} finally {
  globalThis.fetch = originalFetch
}

function buildRuntimeStop(role: UserStopRole, venueId: string, stopIndex: number): RuntimeRouteStop {
  const displayName =
    venueId === 'sj-petiscos'
      ? 'Petiscos'
      : venueId === 'sj-paper-plane'
        ? 'Paper Plane'
        : venueId === 'sj-hedley-club-lounge'
          ? 'Hedley Club Lounge'
          : venueId === 'sj-opera-san-jose'
            ? 'Opera San Jose'
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
  routeId?: string
  routeHeadline?: string
}): RuntimeRouteArtifact {
  const stops = [
    buildRuntimeStop('start', params.routeIds.start, 0),
    buildRuntimeStop('highlight', params.routeIds.highlight, 1),
    buildRuntimeStop('windDown', params.routeIds.windDown, 2),
  ]
  return {
    routeId: params.routeId ?? 'build-runtime-paper-plane',
    selectedDirectionId: 'downtown-paper-plane',
    location: 'San Jose',
    persona: 'friends',
    vibe: 'lively',
    stops,
    activeStopIndex: 0,
    routeHeadline: params.routeHeadline ?? 'Paper Plane Night',
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
  anchorVenueId?: string
  anchorRole?: UserStopRole
  anchorName?: string
  routeTitle?: string
}): ContractEntryArtifact {
  const anchorVenueId = params.anchorVenueId ?? 'sj-paper-plane'
  const anchorRole = params.anchorRole ?? 'highlight'
  const anchorName = params.anchorName ?? 'Paper Plane'
  const routeTitle = params.routeTitle ?? 'Paper Plane Night'
  return {
    id: params.id,
    sourceOpportunityId: params.sourceOpportunityId,
    sourceMode: 'curated',
    anchorVenueId,
    anchorRole,
    anchorName,
    routeTitle,
    flavorLine: 'Cocktails with a compact downtown arc.',
    routeSummary: params.routeSummary,
    traits: ['cocktails', 'downtown'],
    storySpine: {
      start: buildRuntimeStop('start', params.routeIds.start, 0).displayName,
      highlight:
        anchorRole === 'highlight'
          ? anchorName
          : buildRuntimeStop('highlight', params.routeIds.highlight, 1).displayName,
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
        highlight:
          anchorRole === 'highlight'
            ? anchorName
            : buildRuntimeStop('highlight', params.routeIds.highlight, 1).displayName,
        windDown: buildRuntimeStop('windDown', params.routeIds.windDown, 2).displayName,
        support: [
          {
            role: 'start',
            name: buildRuntimeStop('start', params.routeIds.start, 0).displayName,
            venueId: params.routeIds.start,
          },
          {
            role: 'highlight',
            name:
              anchorRole === 'highlight'
                ? anchorName
                : buildRuntimeStop('highlight', params.routeIds.highlight, 1).displayName,
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
