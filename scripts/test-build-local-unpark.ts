import { readFileSync } from 'node:fs'
import {
  buildBuildCardTruthModel,
  evaluateBuildStaticPreGenerationCardSelection,
} from '../src/app/services/canonicalPublicRouteTruthService.ts'
import { evaluateBuildCandidateAdmission } from '../src/app/services/buildCandidateAdmission/buildCandidateAdmissionService.ts'
import { buildAnchorTruthContract } from '../src/domain/artifacts/buildAnchorTruthContract.ts'
import type { BuildAnchorCanonicalRole } from '../src/domain/artifacts/buildAnchorTruthContract.ts'
import type { ContractEntryArtifact } from '../src/domain/artifacts/contractEntryArtifact.ts'
import type { RuntimeRouteArtifact, RuntimeRouteStop } from '../src/domain/artifacts/runtimeRouteArtifact.ts'
import type { Itinerary, ItineraryStop, UserStopRole } from '../src/domain/types/itinerary.ts'

const originalFetch = globalThis.fetch
let fetchCallCount = 0

globalThis.fetch = (async () => {
  fetchCallCount += 1
  throw new Error('Build local unpark card-selection test must not call fetch.')
}) as typeof fetch

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const routeIds = {
  start: 'sj-petiscos',
  highlight: 'sj-paper-plane',
  windDown: 'sj-hedley-club-lounge',
}

function artifact(patch: Partial<ContractEntryArtifact> = {}): ContractEntryArtifact {
  return {
    id: 'step2_static_build_paper_plane',
    sourceOpportunityId: 'step2_static_build_paper_plane',
    sourceMode: 'curated',
    anchorVenueId: routeIds.highlight,
    anchorRole: 'highlight',
    anchorName: 'Paper Plane',
    routeTitle: 'Paper Plane',
    flavorLine: 'Cocktail-led downtown night',
    routeSummary: 'Petiscos to Paper Plane to Hedley Club Lounge.',
    traits: ['focused', 'reliable', 'standout'],
    storySpine: {
      start: 'Petiscos',
      highlight: 'Paper Plane',
      windDown: 'Hedley Club Lounge',
    },
    districtLine: 'Mostly in Downtown Pocket',
    districtAnchorLine: 'District anchor: Downtown',
    authorityLine: 'Paper Plane can hold the highlight role.',
    whyChooseLine: 'Short downtown movement with a high-confidence cocktail center.',
    selection: {
      directionId: 'downtown-paper-plane',
      pocketId: 'downtown',
    },
    enrichment: {
      canonicalRouteRoleCoverage: {
        start: 'Petiscos',
        highlight: 'Paper Plane',
        windDown: 'Hedley Club Lounge',
        support: [
          { role: 'start', name: 'Petiscos', venueId: routeIds.start },
          { role: 'highlight', name: 'Paper Plane', venueId: routeIds.highlight },
          { role: 'windDown', name: 'Hedley Club Lounge', venueId: routeIds.windDown },
        ],
      },
    },
    ...patch,
  }
}

const generatedRouteIds = {
  start: 'sj-heritage-tea-house',
  highlight: 'sj-paper-plane',
  windDown: 'sj-jtown-matcha-kissaten',
}

function runtimeStop(role: UserStopRole, venueId: string, stopIndex: number): RuntimeRouteStop {
  const displayName =
    role === 'start'
      ? 'Heritage Tea House'
      : role === 'highlight'
        ? 'Paper Plane'
        : 'Jtown Matcha Kissaten'
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

function generatedRuntimeRoute(): RuntimeRouteArtifact {
  const stops = [
    runtimeStop('start', generatedRouteIds.start, 0),
    runtimeStop('highlight', generatedRouteIds.highlight, 1),
    runtimeStop('windDown', generatedRouteIds.windDown, 2),
  ]
  return {
    routeId: 'generated-runtime-paper-plane',
    selectedDirectionId: 'downtown-paper-plane',
    location: 'San Jose',
    persona: 'romantic',
    vibe: 'lively',
    stops,
    activeStopIndex: 0,
    routeHeadline: 'A lively night that builds and keeps moving',
    routeSummary: 'Heritage Tea House to Paper Plane to Jtown Matcha Kissaten.',
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

function itineraryStop(role: UserStopRole, venueId: string): ItineraryStop {
  const venueName =
    role === 'start'
      ? 'Heritage Tea House'
      : role === 'highlight'
        ? 'Paper Plane'
        : 'Jtown Matcha Kissaten'
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
    category: role === 'highlight' ? 'bar' : 'cafe',
    subcategory: role === 'highlight' ? 'cocktails' : 'tea',
    priceTier: '$$',
    tags: ['downtown'],
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

function generatedItinerary(): Itinerary {
  return {
    id: 'itinerary-generated-paper-plane',
    title: 'Generated Paper Plane Night',
    city: 'San Jose',
    crew: 'date',
    vibes: ['lively'],
    stops: [
      itineraryStop('start', generatedRouteIds.start),
      itineraryStop('highlight', generatedRouteIds.highlight),
      itineraryStop('windDown', generatedRouteIds.windDown),
    ],
    transitions: [],
    totalRouteFriction: 0.2,
    estimatedTotalMinutes: 150,
    estimatedTotalLabel: '2.5 hours',
    routeFeelLabel: 'Easy',
    story: {
      headline: 'Generated Paper Plane Night',
      subtitle: 'Downtown cocktail route',
    },
    storySpine: {
      title: 'Generated Paper Plane Night',
      phases: [],
      routeSummary: 'Heritage Tea House to Paper Plane to Jtown Matcha Kissaten.',
    },
    shareSummary: 'Paper Plane route.',
  }
}

function generatedArtifact(): ContractEntryArtifact {
  return artifact({
    id: 'contract_entry_generated_paper_plane',
    sourceOpportunityId: 'step2_static_build_paper_plane',
    routeTitle: 'Generated Paper Plane Night',
    routeSummary: 'Heritage Tea House to Paper Plane to Jtown Matcha Kissaten.',
    storySpine: {
      start: 'Heritage Tea House',
      highlight: 'Paper Plane',
      windDown: 'Jtown Matcha Kissaten',
    },
    enrichment: {
      canonicalRouteRoleCoverage: {
        start: 'Heritage Tea House',
        highlight: 'Paper Plane',
        windDown: 'Jtown Matcha Kissaten',
        support: [
          { role: 'highlight', name: 'Paper Plane', venueId: generatedRouteIds.highlight },
        ],
      },
    },
  })
}

function anchorContract(role: BuildAnchorCanonicalRole = 'highlight') {
  return buildAnchorTruthContract({
    identity: {
      venueId: routeIds.highlight,
      sourceVenueId: 'sj-paper-plane',
      providerRecordId: 'provider-paper-plane',
      displayName: 'Paper Plane',
      sourceOrigin: 'static',
      provider: 'static-corpus',
    },
    role: {
      role,
      roleResolutionSource: 'explicit',
    },
  })
}

function admittedStaticCandidate(candidate: ContractEntryArtifact = artifact()) {
  return evaluateBuildCandidateAdmission({
    mode: 'build',
    anchorContract: anchorContract('highlight'),
    contractEntryArtifact: candidate,
    buildParked: {
      providerSelectionAllowed: true,
      providerMergedIntoVisiblePool: true,
    },
  })
}

function main(): void {
  const paperPlane = artifact()
  const admission = admittedStaticCandidate(paperPlane)
  assert(admission.admitted, 'Static Paper Plane admission must pass.')
  assert(admission.truthGateStatus === 'passed', 'Static Paper Plane anchor truth must pass.')
  assert(
    admission.diagnostics.coreRouteIds.highlight === routeIds.highlight,
    'Static Paper Plane must preserve the required highlight id.',
  )

  const staticSelection = evaluateBuildStaticPreGenerationCardSelection({
    artifact: paperPlane,
    candidateAdmission: admission,
    selectedAnchorRequiredRole: 'highlight',
    sourceKind: 'static',
    buildProviderSelectionAllowed: true,
    buildProviderMergedIntoVisiblePool: true,
  })
  assert(staticSelection.selectable, 'Admitted static Paper Plane card must be selectable pre-generation.')

  const preGenerationTruth = buildBuildCardTruthModel({
    artifact: paperPlane,
    selectedArtifactId: paperPlane.id,
    selectedDirectionId: paperPlane.selection.directionId,
    approvedPayload: null,
    candidateAdmission: admission,
    anchorTruthContract: anchorContract('highlight'),
    selectedAnchorRequiredRole: 'highlight',
    sourceKind: 'static',
    buildProviderSelectionAllowed: true,
    buildProviderMergedIntoVisiblePool: true,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert(
    !preGenerationTruth.reviewEligible,
    'Pre-generation static selection must not make Review eligible.',
  )
  assert(
    preGenerationTruth.rejectionReasons.includes('build_route_authority_unavailable'),
    'Review must still require route-authority lock-ready truth.',
  )

  const generatedCanonicalArtifact = generatedArtifact()
  const generatedRoute = generatedRuntimeRoute()
  const generatedAdmission = evaluateBuildCandidateAdmission({
    mode: 'build',
    anchorContract: anchorContract('highlight'),
    contractEntryArtifact: generatedCanonicalArtifact,
    runtimeRouteArtifact: generatedRoute,
    buildParked: {
      providerSelectionAllowed: true,
      providerMergedIntoVisiblePool: true,
    },
  })
  const generatedTruth = buildBuildCardTruthModel({
    artifact: generatedCanonicalArtifact,
    selectedArtifactId: generatedCanonicalArtifact.id,
    selectedDirectionId: generatedCanonicalArtifact.selection.directionId,
    approvedPayload: {
      artifactId: generatedCanonicalArtifact.id,
      selectedDirectionId: generatedRoute.selectedDirectionId,
      finalRoute: generatedRoute,
      selectedClusterConfirmation: 'Paper Plane generated route is canonical.',
      itinerary: generatedItinerary(),
      sourceKind: 'static',
    },
    candidateAdmission: generatedAdmission,
    anchorTruthContract: anchorContract('highlight'),
    selectedAnchorRequiredRole: 'highlight',
    sourceKind: 'static',
    buildProviderSelectionAllowed: true,
    buildProviderMergedIntoVisiblePool: true,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert(generatedAdmission.admitted, 'Generated Paper Plane route must pass Build admission.')
  assert(
    generatedTruth.routeAuthorityLockReady,
    'Generated Paper Plane route must become route-authority lock-ready.',
  )
  assert(
    generatedTruth.reviewEligible,
    `Generated Paper Plane route must become Review-eligible after canonical materialization: ${JSON.stringify({
      rejectionReasons: generatedTruth.rejectionReasons,
      diagnostics: generatedTruth.diagnostics,
    })}`,
  )
  assert(generatedTruth.cardSelectable, 'Generated Paper Plane route must remain card-selectable.')

  const providerShadowSelection = evaluateBuildStaticPreGenerationCardSelection({
    artifact: paperPlane,
    candidateAdmission: admission,
    selectedAnchorRequiredRole: 'highlight',
    sourceKind: 'provider_shadow',
    buildProviderSelectionAllowed: true,
    buildProviderMergedIntoVisiblePool: true,
  })
  assert(!providerShadowSelection.selectable, 'Provider-shadow cards must remain non-selectable.')
  assert(
    providerShadowSelection.rejectionReasons.includes('build_static_source_not_approved'),
    'Provider-shadow rejection must be explicit.',
  )

  const debugOnlySelection = evaluateBuildStaticPreGenerationCardSelection({
    artifact: paperPlane,
    candidateAdmission: admission,
    selectedAnchorRequiredRole: 'highlight',
    sourceKind: 'debug_only',
    buildProviderSelectionAllowed: true,
    buildProviderMergedIntoVisiblePool: true,
  })
  assert(!debugOnlySelection.selectable, 'Debug-only cards must remain non-selectable.')

  const wrongRole = artifact({
    id: 'step2_scenario_built_romantic_lively_3__build_anchor_sj-paper-plane_windDown',
    anchorRole: 'windDown',
    storySpine: {
      start: 'Willow Court Wine Bar',
      highlight: 'Theatre District Jazz Cellar',
      windDown: 'Paper Plane',
    },
  })
  const wrongRoleAdmission = admittedStaticCandidate(wrongRole)
  const wrongRoleSelection = evaluateBuildStaticPreGenerationCardSelection({
    artifact: wrongRole,
    candidateAdmission: wrongRoleAdmission,
    selectedAnchorRequiredRole: 'highlight',
    sourceKind: 'static',
    buildProviderSelectionAllowed: true,
    buildProviderMergedIntoVisiblePool: true,
  })
  assert(!wrongRoleAdmission.admitted, 'Wrong-role Paper Plane candidate must fail admission.')
  assert(
    wrongRoleAdmission.rejectionReasons.includes('anchor_wrong_required_role'),
    'Wrong-role admission rejection must be explicit.',
  )
  assert(!wrongRoleSelection.selectable, 'Wrong-role Paper Plane candidate must remain disabled.')
  const selfDeclaredWrongRoleAdmission = evaluateBuildCandidateAdmission({
    mode: 'build',
    anchorContract: anchorContract('windDown'),
    contractEntryArtifact: wrongRole,
    buildParked: {
      providerSelectionAllowed: true,
      providerMergedIntoVisiblePool: true,
    },
  })
  const selfDeclaredWrongRoleSelection = evaluateBuildStaticPreGenerationCardSelection({
    artifact: wrongRole,
    candidateAdmission: selfDeclaredWrongRoleAdmission,
    selectedAnchorRequiredRole: 'highlight',
    sourceKind: 'static',
    buildProviderSelectionAllowed: true,
    buildProviderMergedIntoVisiblePool: true,
  })
  assert(
    !selfDeclaredWrongRoleSelection.selectable,
    'Candidate self-declared role must not override the selected highlight anchor contract.',
  )
  assert(
    selfDeclaredWrongRoleSelection.rejectionReasons.includes('build_static_anchor_role_mismatch'),
    'Selected-anchor role mismatch must be explicit.',
  )

  const parkedSelection = evaluateBuildStaticPreGenerationCardSelection({
    artifact: paperPlane,
    candidateAdmission: admission,
    selectedAnchorRequiredRole: 'highlight',
    sourceKind: 'static',
    buildProviderSelectionAllowed: false,
    buildProviderMergedIntoVisiblePool: true,
  })
  assert(!parkedSelection.selectable, 'Static Build card selection must still honor local unpark flags.')

  const sandboxSource = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')
  assert(
    sandboxSource.includes('build_static_pre_generation'),
    'Build static pre-generation display source must be wired into card rendering.',
  )
  assert(
    sandboxSource.includes('buildPreGenerationStaticCardSelectionByArtifactId'),
    'Build static selection adapter must be computed at page level.',
  )
  assert(
    sandboxSource.includes('effectiveCardSelectable'),
    'Route card disabled state must consume effective Build static selectability.',
  )
  assert(
    sandboxSource.includes('void generatePlan(optionDirection.id, option.id)'),
    'Build static card selection must invoke the canonical generation path with the selected artifact.',
  )
  assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)

  process.stdout.write('build local unpark card selection: passed\n')
  process.stdout.write(
    `${JSON.stringify(
      {
        fetchCallCount,
        staticPaperPlaneSelectable: staticSelection.selectable,
        staticPaperPlaneHighlightId: admission.diagnostics.coreRouteIds.highlight,
        preGenerationReviewEligible: preGenerationTruth.reviewEligible,
        generatedRouteAuthorityLockReady: generatedTruth.routeAuthorityLockReady,
        generatedReviewEligible: generatedTruth.reviewEligible,
        generatedRouteIds: generatedRoute.stops.map((stop) => stop.venueId),
        providerShadowSelectable: providerShadowSelection.selectable,
        debugOnlySelectable: debugOnlySelection.selectable,
        wrongRoleSelectable: wrongRoleSelection.selectable,
        parkedSelectable: parkedSelection.selectable,
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
