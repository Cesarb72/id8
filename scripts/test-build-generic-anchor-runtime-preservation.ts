import { readFileSync } from 'node:fs'
import {
  buildLockInputFromRouteAuthoritySnapshot,
  buildRouteAuthoritySnapshot,
} from '../src/app/services/routeAuthority/routeAuthorityService.ts'
import { buildApplicationConciergeIntent } from '../src/app/concierge/conciergeIntentAdapter.ts'
import { buildAnchorTruthContract } from '../src/domain/artifacts/buildAnchorTruthContract.ts'
import type { ContractEntryArtifact } from '../src/domain/artifacts/contractEntryArtifact.ts'
import type { RuntimeRouteStop } from '../src/domain/artifacts/runtimeRouteArtifact.ts'
import { buildCanonicalInterpretationBundle } from '../src/domain/interpretation/buildCanonicalInterpretationBundle.ts'
import { buildContractDrivenBuildWaypointPlan } from '../src/domain/waypoint/buildContractDrivenBuildWaypointPlan.ts'
import type { GeneratePlanResult } from '../src/domain/runGeneratePlan.ts'
import type { DirectionPlanningSelection } from '../src/domain/arc/directionPlanning.ts'
import type { ArcCandidate } from '../src/domain/types/arc.ts'
import type { Itinerary, ItineraryStop, UserStopRole } from '../src/domain/types/itinerary.ts'
import type { ScoredVenue } from '../src/domain/types/venue.ts'
import type {
  FullStopRealityContractOutcome,
  RunPostPlannerCommitParityStagesDependencies,
  StrongCurationTastePassResult,
} from '../src/domain/waypoint/postPlannerCommitParity.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const originalFetch = globalThis.fetch
let fetchCallCount = 0

globalThis.fetch = (async () => {
  fetchCallCount += 1
  throw new Error('test-build-generic-anchor-runtime-preservation must not call fetch.')
}) as typeof fetch

const HABERDASHER_CANDIDATE_ARTIFACT_ID =
  'step2_scenario_built_romantic_lively_2__build_anchor_sj-haberdasher_windDown'
const HABERDASHER_SOURCE_OPPORTUNITY_ID = 'step2_scenario_built_romantic_lively_2'
const HABERDASHER_DIRECTION_ID = 'direction_romantic_lively_2'
const haberdasherVisibleRouteIds = {
  start: 'sj-hedley-club-lounge',
  highlight: 'sj-opera-san-jose',
  windDown: 'sj-haberdasher',
} as const
const generatedRouteMissingAnchorIds = {
  start: 'sj-hedley-club-lounge',
  highlight: 'sj-opera-san-jose',
  windDown: 'sj-fox-tale-fermentation-project',
} as const

try {
  const sandboxSource = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')
  const paperPlaneSpecialPathDetected =
    sandboxSource.includes("selectedBuildAnchor?.venueId !== 'sj-paper-plane'") &&
    sandboxSource.includes("id: 'step2_static_build_paper_plane'")

  const selectedCandidateArtifact = buildArtifact({
    id: HABERDASHER_CANDIDATE_ARTIFACT_ID,
    sourceOpportunityId: HABERDASHER_SOURCE_OPPORTUNITY_ID,
    routeIds: haberdasherVisibleRouteIds,
    routeTitle: 'Opera San Jose',
    routeSummary: 'Hedley Club Lounge to Opera San Jose to Haberdasher.',
    anchorVenueId: 'sj-haberdasher',
    anchorRole: 'windDown',
    anchorName: 'Haberdasher',
    directionId: HABERDASHER_DIRECTION_ID,
  })
  const generatedArtifactMissingAnchor = buildArtifact({
    id: 'generated_public_build_haberdasher_runtime_missing_anchor',
    sourceOpportunityId: 'generated_public_build_haberdasher_runtime_missing_anchor',
    routeIds: generatedRouteMissingAnchorIds,
    routeTitle: 'Opera San Jose',
    routeSummary: 'Hedley Club Lounge to Opera San Jose to Fox Tale.',
    anchorVenueId: 'sj-opera-san-jose',
    anchorRole: 'highlight',
    anchorName: 'Opera San Jose',
    directionId: HABERDASHER_DIRECTION_ID,
  })
  const selectedDirectionContract: DirectionPlanningSelection = {
    id: HABERDASHER_DIRECTION_ID,
    label: 'Romantic lively SoFA',
    subtitle: 'Scenario-backed romantic night',
    pocketId: 'sofa',
    pocketLabel: 'SoFA District',
    archetype: 'romantic_lively',
    cluster: 'lively',
    identity: 'romantic_lively' as DirectionPlanningSelection['identity'],
    experienceFamily: 'nightlife',
    familyConfidence: 0.9,
  }
  const selectedDirectionContext = {
    selectedDirectionId: HABERDASHER_DIRECTION_ID,
    selectedPocketId: 'sofa',
    directionId: HABERDASHER_DIRECTION_ID,
    pocketId: 'sofa',
    label: 'Romantic lively SoFA',
    archetype: 'romantic_lively',
    identity: 'romantic_lively' as DirectionPlanningSelection['identity'],
    cluster: 'lively' as const,
  }
  const conciergeIntent = buildApplicationConciergeIntent({
    mode: 'build',
    persona: 'romantic',
    primaryVibe: 'lively',
    city: 'San Jose',
    objectiveOccasion: 'connect',
    anchor: {
      venueId: 'sj-haberdasher',
      role: 'windDown',
    },
    anchorDisplayName: 'Haberdasher',
    candidateLineage: {
      source: 'selected_candidate_route_artifact',
      candidateArtifactId: selectedCandidateArtifact.id,
      directionId: HABERDASHER_DIRECTION_ID,
      pocketId: 'sofa',
      sourceOpportunityId: HABERDASHER_SOURCE_OPPORTUNITY_ID,
      anchorVenueId: 'sj-haberdasher',
      anchorRole: 'windDown',
      lineageSummary: 'Hedley Club Lounge -> Opera San Jose -> Haberdasher',
    },
  })
  const canonicalInterpretationBundle = buildCanonicalInterpretationBundle({
    conciergeIntent,
    selectedDirectionContext,
    interpretationSource: 'scripts.test-build-generic-anchor-runtime-preservation',
  })
  const anchorTruthContract = buildAnchorTruthContract({
    identity: {
      venueId: 'sj-haberdasher',
      providerRecordId: 'ChIJkV6TlrDMj4ARIPxsqSMrdr4',
      displayName: 'Haberdasher',
      latitude: 37.32991507979461,
      longitude: -121.88654414825072,
    },
    role: {
      role: 'windDown',
      roleResolutionSource: 'explicit',
    },
  })

  let enteredBuildContractDrivenBuildWaypointPlan = false
  let postPlannerParityTouched = false
  let thrownMessage = ''
  const waypointPlan = await buildContractDrivenBuildWaypointPlan({
    conciergeIntent,
    canonicalInterpretationBundle,
    mode: 'build',
    city: 'San Jose',
    district: 'SoFA District',
    distanceMode: 'nearby',
    selectedDirectionContext,
    selectedDirectionContextForValidation: selectedDirectionContext,
    selectedDirectionContract,
    selectedDirectionContractForValidation: selectedDirectionContract,
    selectedDirectionId: HABERDASHER_DIRECTION_ID,
    selectedDirectionPreviewScenarioFamily: 'romantic_lively',
    expectedDirectionIdentity: selectedDirectionContract.identity,
    discoveryPreferences: [
      {
        venueId: 'sj-haberdasher',
        role: 'windDown',
      },
    ],
    anchor: {
      venueId: 'sj-haberdasher',
      role: 'windDown',
    },
    selectedArtifactLineage: {
      artifactId: selectedCandidateArtifact.id,
      sourceOpportunityId: selectedCandidateArtifact.sourceOpportunityId,
      sourceMode: selectedCandidateArtifact.sourceMode,
      anchorVenueId: 'sj-haberdasher',
      anchorRole: 'windDown',
      directionId: HABERDASHER_DIRECTION_ID,
      pocketId: 'sofa',
    },
    sourceMode: 'hybrid',
    sourceModeOverrideApplied: true,
    persona: 'romantic',
    vibe: 'lively',
    requiredBuildAnchor: {
      role: 'windDown',
      venueId: 'sj-haberdasher',
    },
    buildAnchorTruthContract: anchorTruthContract,
    postPlannerDependencies: buildRuntimePreservationFailingPostPlannerDependencies(() => {
      postPlannerParityTouched = true
    }),
    runPlanBuild: async (_input, options) => {
      enteredBuildContractDrivenBuildWaypointPlan = true
      assert(
        options?.selectedArtifactLineage?.artifactId === HABERDASHER_CANDIDATE_ARTIFACT_ID,
        'Generic Build candidate lineage must be threaded into runPlanBuild.',
      )
      return buildGeneratePlanResult({
        contractEntryArtifact: generatedArtifactMissingAnchor,
        itinerary: buildItinerary(generatedRouteMissingAnchorIds),
        selectedDirectionId: HABERDASHER_DIRECTION_ID,
      })
    },
  }).catch((error: unknown) => {
    thrownMessage = error instanceof Error ? error.message : String(error)
    return null
  })

  const generatedContractEntryArtifact = waypointPlan?.postParityContractEntryArtifact ?? null
  const runtimeRouteArtifact = waypointPlan?.nextFinalRoute ?? null
  const generatedContractEntryArtifactProduced = Boolean(generatedContractEntryArtifact)
  const runtimeRouteArtifactProduced = Boolean(runtimeRouteArtifact)
  const anchorPreservationFailed = thrownMessage.includes('anchor_preservation_failed')
  const preParityFailureGone =
    !thrownMessage.includes('anchor_canonical_id_mismatch') &&
    !thrownMessage.includes('anchor_not_in_required_role')
  const postParityRuntimeValidationReached = postPlannerParityTouched && runtimeRouteArtifactProduced
  const downstreamRouteAuthoritySnapshot = buildRouteAuthoritySnapshot({
    contractEntryArtifact: generatedContractEntryArtifact,
    runtimeRouteArtifact,
    selectedDirectionId: HABERDASHER_DIRECTION_ID,
    selectedArtifactId: generatedContractEntryArtifact?.id ?? null,
    selectedClusterConfirmation: 'Generated Haberdasher route is ready for Review.',
    itinerary: waypointPlan?.canonicalItinerary,
    buildContext: {
      mode: 'build',
      selectedCandidateArtifact: null,
      selectedCandidateSourceKind: null,
      selectedAnchorVenueId: 'sj-haberdasher',
      selectedAnchorRequiredRole: 'windDown',
      routeReplacementAdmitted: false,
    },
  })
  const downstreamLockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot: downstreamRouteAuthoritySnapshot,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  const finalRouteStopIds =
    runtimeRouteArtifact?.stops
      .filter((stop) => stop.role === 'start' || stop.role === 'highlight' || stop.role === 'windDown')
      .map((stop) => `${stop.role}:${stop.venueId}`) ?? []
  const haberdasherWindDownSurvived = finalRouteStopIds.includes('windDown:sj-haberdasher')
  const requiredRolePreserved =
    generatedContractEntryArtifact?.anchorVenueId === 'sj-haberdasher' &&
    generatedContractEntryArtifact.anchorRole === 'windDown'
  const downstreamRouteAuthorityValid = downstreamRouteAuthoritySnapshot.validationStatus === 'valid'
  const proof = {
    paperPlaneSpecialPathDetected,
    haberdasherUsesGenericPath: selectedCandidateArtifact.id !== 'step2_static_build_paper_plane',
    enteredBuildContractDrivenBuildWaypointPlan,
    preParityFailureGone,
    postParityRuntimeValidationReached,
    thrownMessage: thrownMessage || null,
    anchorPreservationFailed,
    generatedContractEntryArtifactProduced,
    runtimeRouteArtifactProduced,
    finalRouteProduced: runtimeRouteArtifactProduced,
    lockInputAvailable: downstreamLockInput.ok,
    downstreamRouteAuthorityValid,
    finalRouteStopIds,
    haberdasherWindDownSurvived,
    requiredRolePreserved,
    requiredAnchorRoleMissingAbsent: !downstreamRouteAuthoritySnapshot.rejectionReasons.includes(
      'required_anchor_role_missing',
    ),
    staticCandidateNotAuthorityAbsent: !downstreamRouteAuthoritySnapshot.rejectionReasons.includes(
      'static_candidate_not_authority',
    ),
    downstreamRouteAuthorityReasons: downstreamRouteAuthoritySnapshot.rejectionReasons,
    fetchCallCount,
  }

  process.stdout.write(`${JSON.stringify(proof, null, 2)}\n`)

  assert(paperPlaneSpecialPathDetected, 'Paper Plane-specific static path must remain detectable.')
  assert(proof.haberdasherUsesGenericPath, 'Haberdasher must use the generic non-Paper Build path.')
  assert(
    enteredBuildContractDrivenBuildWaypointPlan,
    'Haberdasher must enter buildContractDrivenBuildWaypointPlan/runPlanBuild.',
  )
  assert(preParityFailureGone, 'The removed pre-parity anchor validation must not be the failure.')
  assert(postParityRuntimeValidationReached, 'Expected post-parity runtime anchor validation to be reached.')
  assert(!anchorPreservationFailed, 'anchor_preservation_failed must be absent after runtime preservation.')
  assert(generatedContractEntryArtifactProduced, 'Generated ContractEntryArtifact should be produced.')
  assert(runtimeRouteArtifactProduced, 'RuntimeRouteArtifact/finalRoute should be returned.')
  assert(haberdasherWindDownSurvived, 'sj-haberdasher must survive in finalRoute as windDown.')
  assert(requiredRolePreserved, 'Required windDown role must be preserved and credited.')
  assert(downstreamLockInput.ok, 'Lock input should be available after runtime preservation.')
  assert(downstreamRouteAuthorityValid, 'RouteAuthority should be valid after generated route promotion.')
  assert(
    !downstreamRouteAuthoritySnapshot.rejectionReasons.includes('required_anchor_role_missing'),
    'required_anchor_role_missing must be absent.',
  )
  assert(
    !downstreamRouteAuthoritySnapshot.rejectionReasons.includes('static_candidate_not_authority'),
    'static_candidate_not_authority must be absent for the promoted generated route.',
  )
  assert(fetchCallCount === 0, `Expected no provider/fetch calls, received ${fetchCallCount}.`)
} finally {
  globalThis.fetch = originalFetch
}

function buildRuntimePreservationFailingPostPlannerDependencies(
  markTouched: () => void,
): RunPostPlannerCommitParityStagesDependencies {
  const strongPass = (params: {
    itinerary: Itinerary
    selectedArc: ArcCandidate
    scoredVenues: ScoredVenue[]
  }): StrongCurationTastePassResult => {
    markTouched()
    return {
      selectedArc: params.selectedArc,
      itinerary: params.itinerary,
      scoredVenues: params.scoredVenues,
      qualificationByCandidateId: {},
      personaVibeTasteBiasSummary: 'runtime preservation red test: no Haberdasher repair applied',
      thinPoolHighlightFallbackApplied: false,
      highlightPoolCountBefore: 1,
      highlightPoolCountAfter: 1,
      rolePoolCountByRoleBefore: { start: 1, highlight: 1, windDown: 1 },
      rolePoolCountByRoleAfter: { start: 1, highlight: 1, windDown: 1 },
      signatureHighlightShortlistCount: 1,
      signatureHighlightShortlistIds: ['sj-opera-san-jose'],
      highlightShortlistScoreSummary: 'generic non-Paper red test',
      selectedHighlightFromShortlist: true,
      selectedHighlightShortlistRank: 1,
      fallbackToQualifiedHighlightPool: false,
      upstreamPoolSelectionApplied: true,
      postGenerationRepairCount: 0,
      rolePoolVenueIdsByRole: {
        start: ['sj-hedley-club-lounge'],
        highlight: ['sj-opera-san-jose'],
        windDown: ['sj-fox-tale-fermentation-project'],
      },
      rolePoolVenueIdsCombined: [
        'sj-hedley-club-lounge',
        'sj-opera-san-jose',
        'sj-fox-tale-fermentation-project',
      ],
      windDownCandidateQualityDiagnostics: [
        {
          venueId: 'sj-haberdasher',
          name: 'Haberdasher',
          inCandidateUniverse: true,
          inWindDownPool: true,
          windDownPoolRank: 2,
          selectedAsWindDown: false,
          roleAffinityCooldownScore: 0.9,
          roleCandidateWeight: 0.9,
          roleEligibilityScore: 0.9,
          roleEligibilityFloor: 0.5,
          roleEligibilityPassed: true,
          roleEligibilityReason: 'required_build_anchor_not_preserved',
          anchoredCooldownFit: 0.9,
          category: 'bar',
          tags: ['cocktails'],
          neighborhood: 'SoFA District',
          driveMinutes: 4,
          sourceKind: 'generic_red_test',
          providerRecordId: 'ChIJp3c0MJzMj4ARx0TJBncXxAA',
          hasCoordinates: true,
        },
      ],
      thinPoolRelaxationTrace: {
        triggered: false,
        baseQualifiedHighlightCount: 1,
        baseHighlightFloor: 0.5,
        relaxedHighlightFloor: 0.5,
        triggerReason: 'none',
        relaxedRule: 'none',
        effectSummary: 'not applied',
      },
    }
  }
  return {
    buildPassthroughStrongCurationTastePass: strongPass,
    applyStrongCurationTastePass: (params) => strongPass(params),
    enforceFullStopRealityContract: async (params) => {
      markTouched()
      return {
        selectedArc: params.selectedArc,
        itinerary: params.itinerary,
        canonicalStopByRole: Object.fromEntries(
          params.itinerary.stops.map((stop) => [
            stop.role,
            {
              displayName: stop.venueName,
              providerRecordId: `provider:${stop.venueId}`,
              latitude: stop.latitude ?? 37.33,
              longitude: stop.longitude ?? -121.89,
              addressLine: stop.formattedAddress ?? '1 Test Way',
              city: stop.city ?? 'San Jose',
              neighborhood: stop.neighborhood ?? 'Downtown',
            },
          ]),
        ),
        rejectedStopRoles: [],
      } satisfies FullStopRealityContractOutcome
    },
    applyCanonicalIdentityToItinerary: (itinerary) => itinerary,
    assessDirectionContractBuildability: () =>
      ({
        contractBuildabilityStatus: 'strong',
        candidatePoolSufficiencyByRole: { start: 1, highlight: 1, windDown: 1 },
        missingRoleForContract: null,
      }) as ReturnType<RunPostPlannerCommitParityStagesDependencies['assessDirectionContractBuildability']>,
    validateDirectionRouteContract: () =>
      ({
        valid: true,
        validatorMode: 'build',
        generationDriftReason: null,
        expectedDirectionIdentity: 'romantic_lively',
        observedDirectionIdentity: 'romantic_lively',
        fallbackApplied: false,
        contractBuildabilityStatus: 'strong',
        missingRoleForContract: null,
        candidatePoolSufficiencyByRole: { start: 1, highlight: 1, windDown: 1 },
        directionAlignmentScore: 1,
      }) as ReturnType<RunPostPlannerCommitParityStagesDependencies['validateDirectionRouteContract']>,
    resolveRouteCopy: () => ({
      routeHeadline: 'Haberdasher Night',
      routeSummary: 'Hedley Club Lounge to Opera San Jose to Fox Tale.',
    }),
  }
}

function buildGeneratePlanResult(params: {
  contractEntryArtifact: ContractEntryArtifact
  itinerary: Itinerary
  selectedDirectionId: string
}): GeneratePlanResult {
  return {
    itinerary: params.itinerary,
    selectedArc: buildSelectedArc(params.itinerary),
    scoredVenues: [] as ScoredVenue[],
    contractEntryArtifact: params.contractEntryArtifact,
    intentProfile: {
      mode: 'build',
      planningMode: 'user-led',
      persona: 'romantic',
      primaryVibe: 'lively',
      primaryAnchor: 'lively',
      city: 'San Jose',
      district: 'SoFA District',
      distanceMode: 'nearby',
      refinementModes: [],
      selectedDirectionContext: {
        directionId: params.selectedDirectionId,
        pocketId: 'sofa',
        label: 'Romantic lively SoFA',
        identity: 'romantic_lively',
      },
      discoveryPreferences: [
        {
          venueId: 'sj-haberdasher',
          role: 'windDown',
        },
      ],
      anchor: {
        venueId: 'sj-haberdasher',
        role: 'windDown',
      },
    } as GeneratePlanResult['intentProfile'],
    lens: {
      tone: 'romantic',
      discoveryBias: 'balanced',
      movementTolerance: 'contained',
      locality: 'local',
      socialMode: 'date',
      budgetSensitivity: 'medium',
    } as GeneratePlanResult['lens'],
    trace: {
      intent: {
        mode: 'build',
      },
      lens: {
        tone: 'romantic',
        discoveryBias: 'balanced',
        movementTolerance: 'contained',
      },
      rankingEngine: 'mocked_no_network_generic_build_runtime_preservation_red',
      selectedArtifactLineage: {
        artifactId: HABERDASHER_CANDIDATE_ARTIFACT_ID,
        sourceOpportunityId: HABERDASHER_SOURCE_OPPORTUNITY_ID,
        sourceMode: 'curated',
        anchorVenueId: 'sj-haberdasher',
        anchorRole: 'windDown',
        directionId: HABERDASHER_DIRECTION_ID,
        pocketId: 'sofa',
      },
      selectedDistrictId: 'sofa',
      selectedDistrictLabel: 'SoFA District',
      selectedDistrictReason: 'mocked no-network Build runtime preservation red test',
      stopExplainability: {},
      retrievalDiagnostics: {
        liveSource: {
          requestedMode: 'hybrid',
          effectiveMode: 'hybrid',
          provider: 'google_places',
          debugOverrideApplied: false,
          fallbackToCurated: false,
          liveFetchAttempted: false,
          liveFetchSucceeded: false,
          queryCount: 0,
          labelsConsidered: 0,
          labelsAdmitted: 0,
          centersConsidered: 0,
          centersAdmitted: 0,
          dispatchQueriesPlanned: 0,
          dispatchQueriesAttempted: 0,
          dispatchQueriesPlannedWithinCap: true,
          liveQueryTemplatesUsed: [],
          liveQueryLabelsUsed: [],
          liveCandidatesByQuery: [],
          liveRoleIntentQueryNotes: [],
          fetchedCount: 0,
          mappedCount: 0,
          normalizedCount: 0,
          approvedCount: 0,
          demotedCount: 0,
          suppressedCount: 0,
          liveHoursDemotedCount: 0,
          liveHoursSuppressedCount: 0,
          partialFailure: false,
          errors: [],
          countsBySource: { curated: 3, live: 0, bootstrap: 0 },
        },
      },
    } as GeneratePlanResult['trace'],
  }
}

function buildRuntimeStop(role: UserStopRole, venueId: string, stopIndex: number): RuntimeRouteStop {
  const displayName =
    venueId === 'sj-hedley-club-lounge'
      ? 'Hedley Club Lounge'
      : venueId === 'sj-opera-san-jose'
        ? 'Opera San Jose'
        : venueId === 'sj-fox-tale-fermentation-project'
          ? 'Fox Tale Fermentation Project'
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
    title: role === 'highlight' ? 'Centerpiece' : 'Support stop',
    subtitle: 'Downtown',
    neighborhood: venueId === 'sj-haberdasher' ? 'SoFA District' : 'Downtown',
    driveMinutes: 4,
    imageUrl: '/test.jpg',
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
    id: 'itinerary-haberdasher-runtime-preservation-red',
    title: 'Haberdasher Night',
    city: 'San Jose',
    crew: 'date',
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
      headline: 'Haberdasher Night',
      subtitle: 'Downtown romantic route',
    },
    storySpine: {
      title: 'Haberdasher Night',
      phases: [],
      routeSummary: 'Haberdasher route.',
    },
    shareSummary: 'Haberdasher route.',
  }
}

function buildSelectedArc(itinerary: Itinerary): ArcCandidate {
  return {
    id: 'arc-haberdasher-runtime-preservation-red',
    stops: itinerary.stops.map((stop) => ({
      role: stop.role === 'windDown' ? 'cooldown' : stop.role === 'highlight' ? 'peak' : 'warmup',
      scoredVenue: {
        venue: {
          id: stop.venueId,
          name: stop.venueName,
        },
      },
    })),
    scoreBreakdown: {},
  } as ArcCandidate
}

function buildArtifact(params: {
  id: string
  sourceOpportunityId: string
  routeIds: Record<'start' | 'highlight' | 'windDown', string>
  routeSummary: string
  anchorVenueId: string
  anchorRole: Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>
  anchorName: string
  routeTitle: string
  directionId: string
}): ContractEntryArtifact {
  return {
    id: params.id,
    sourceOpportunityId: params.sourceOpportunityId,
    sourceMode: 'curated',
    anchorVenueId: params.anchorVenueId,
    anchorRole: params.anchorRole,
    anchorName: params.anchorName,
    routeTitle: params.routeTitle,
    flavorLine: 'Scenario-backed Build candidate.',
    routeSummary: params.routeSummary,
    traits: ['romantic', 'downtown'],
    storySpine: {
      start: buildRuntimeStop('start', params.routeIds.start, 0).displayName,
      highlight: buildRuntimeStop('highlight', params.routeIds.highlight, 1).displayName,
      windDown:
        params.anchorRole === 'windDown'
          ? params.anchorName
          : buildRuntimeStop('windDown', params.routeIds.windDown, 2).displayName,
    },
    districtLine: 'Downtown / SoFA District',
    districtAnchorLine: 'SoFA District',
    authorityLine: 'Scenario-backed Build candidate fixture.',
    whyChooseLine: 'Keeps the visible route close to the selected anchor.',
    selection: {
      directionId: params.directionId,
      pocketId: 'sofa',
    },
    enrichment: {
      canonicalRouteRoleCoverage: {
        start: buildRuntimeStop('start', params.routeIds.start, 0).displayName,
        highlight: buildRuntimeStop('highlight', params.routeIds.highlight, 1).displayName,
        windDown:
          params.anchorRole === 'windDown'
            ? params.anchorName
            : buildRuntimeStop('windDown', params.routeIds.windDown, 2).displayName,
        support: [
          {
            role: 'start',
            name: buildRuntimeStop('start', params.routeIds.start, 0).displayName,
            venueId: params.routeIds.start,
          },
          {
            role: 'highlight',
            name: buildRuntimeStop('highlight', params.routeIds.highlight, 1).displayName,
            venueId: params.routeIds.highlight,
          },
          {
            role: 'windDown',
            name:
              params.anchorRole === 'windDown'
                ? params.anchorName
                : buildRuntimeStop('windDown', params.routeIds.windDown, 2).displayName,
            venueId: params.routeIds.windDown,
          },
        ],
      },
    },
  }
}
