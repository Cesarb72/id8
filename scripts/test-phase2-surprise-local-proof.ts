import {
  buildLockInputFromRouteAuthoritySnapshot,
  buildRouteAuthoritySnapshot,
} from '../src/app/services/routeAuthority/routeAuthorityService.ts'
import { buildLockedLiveArtifactPayload } from '../src/app/services/live/liveSessionHandoff.ts'
import {
  buildApplicationConciergeIntent,
  projectConciergeIntentToIntentInput,
} from '../src/app/concierge/conciergeIntentAdapter.ts'
import { buildCanonicalInterpretationBundle } from '../src/domain/interpretation/buildCanonicalInterpretationBundle.ts'
import { buildContractGateWorldFromCanonical } from '../src/domain/bearings/buildContractGateWorld.ts'
import { buildStrategyAdmissibleWorlds } from '../src/domain/bearings/buildStrategyAdmissibleWorlds.ts'
import { assessDirectionContractBuildability } from '../src/domain/bearings/assessDirectionContractBuildability.ts'
import { buildFinalRoute } from '../src/domain/artifacts/runtimeRouteProjection.ts'
import type { RuntimeRouteArtifact } from '../src/domain/artifacts/runtimeRouteArtifact.ts'
import { validateLockedLiveArtifactSessionPayload } from '../src/domain/live/validateLiveArtifact.ts'
import { buildCanonicalSurpriseC1RouteShapeContract } from '../src/domain/arc/buildCanonicalSurpriseC1RouteShapeContract.ts'
import {
  buildStopTypeCandidateBoardFromContract,
  buildStopTypeCandidateBoardFromIntent,
} from '../src/domain/interpretation/discovery/stopTypeCandidateBoard.ts'
import { CLOSED_PREVIEW_LIVE_ENVELOPE } from '../src/domain/retrieval/liveEnvelope.ts'
import { runGeneratePlan, type GeneratePlanResult } from '../src/domain/runGeneratePlan.ts'
import {
  buildDirectionPlanningSelection,
  buildResolvedDirectionContext,
  validateDirectionRouteContract,
  type DirectionPlanningSelection,
} from '../src/domain/arc/directionPlanning.ts'
import type {
  IntentInput,
  ResolvedDirectionContext,
  RouteShapeContract,
  SelectedDirectionContext,
} from '../src/domain/types/intent.ts'
import type { Itinerary, ItineraryStop, UserStopRole } from '../src/domain/types/itinerary.ts'
import { buildDistrictOpportunityProfiles } from '../src/domain/interpretation/district/intelligence/buildDistrictOpportunityProfiles.ts'

type FetchCounters = {
  fetchCallCount: number
  fieldProxyHits: number
  browserProviderHits: number
  lceProviderHits: number
}

type SurpriseLoadBearingClassification =
  | 'contract_load_bearing'
  | 'contract_aware_only'
  | 'failing'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const originalFetch = globalThis.fetch
const fetchCounters: FetchCounters = {
  fetchCallCount: 0,
  fieldProxyHits: 0,
  browserProviderHits: 0,
  lceProviderHits: 0,
}

globalThis.fetch = (async (input) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  fetchCounters.fetchCallCount += 1
  if (url.includes('/api/field/text-search')) {
    fetchCounters.fieldProxyHits += 1
  }
  if (/googleapis|places\.google|maps\.google/i.test(url)) {
    fetchCounters.browserProviderHits += 1
  }
  if (/\/api\/lce|lce/i.test(url)) {
    fetchCounters.lceProviderHits += 1
  }
  throw new Error(`Surprise local proof must not call fetch/providers: ${url}`)
}) as typeof fetch

try {
  const proof = await runSurpriseLocalProof()

  assert(fetchCounters.fetchCallCount === 0, 'Provider valve must remain closed locally.')
  assert(fetchCounters.fieldProxyHits === 0, 'Local Surprise proof must not hit Field proxy.')
  assert(fetchCounters.browserProviderHits === 0, 'Local Surprise proof must not hit browser providers.')
  assert(fetchCounters.lceProviderHits === 0, 'Local Surprise proof must not hit LCE providers.')

  process.stdout.write('phase2 surprise local proof: passed\n')
  process.stdout.write(`${JSON.stringify(proof, null, 2)}\n`)
} finally {
  globalThis.fetch = originalFetch
}

async function runSurpriseLocalProof(): Promise<{
  proofSurface: string
  classification: SurpriseLoadBearingClassification
  completeConciergeIntent: boolean
  canonicalInterpretationBundleSupplied: boolean
  contractConstraintsPresent: boolean
  routeShapeContractId: string
  routeShapeProjectionId: string
  selectedCompositionRequirementSource: string | null
  selectedCompositionUnavailableReasons: string[]
  contractGateWorldPresent: boolean
  strategyAdmissibleWorldCount: number
  fieldCandidateBoardInputSource: string | null
  staleCompatibilityBoardChangedScenarioFamily: boolean
  waypointTracePrimaryInput: string | null
  waypointTraceObjective: string | null
  postPlannerValidationMode: string | null
  routeAuthorityStatus: string
  lockInputAvailable: boolean
  legacyHostedSeamReviewLockCtaWouldAppear: boolean
  legacyHostedSeamLockInputAvailable: boolean
  legacyHostedSeamRejectionReason: string | null
  fixedReviewLockGateMatchesLockAction: boolean
  generatedCanonicalLockInputSource: string | null
  selectedRouteArtifactOnlyLockReady: boolean
  pageLocalOnlyLockReady: boolean
  hiddenSurpriseHostedMismatchReproduced: boolean
  hiddenSurpriseItineraryCompanionPreserved: boolean
  hiddenSurpriseValidateLiveArtifactPasses: boolean
  hiddenSurpriseVisibleRouteRoles: string[]
  hiddenSurpriseSourceCoverageComplete: boolean
  staleProjectionIgnoredOrRejected: boolean
  staleProjectionAcceptedByPlanner: boolean
  staleProjectionChangedPlannerDiagnostics: boolean
  canonicalRouteIds: string[]
  staleProjectionRouteIds: string[]
  providerValve: FetchCounters
  hostedSurpriseProofSafe: boolean
}> {
  const conciergeIntent = buildApplicationConciergeIntent({
    mode: 'surprise',
    persona: 'romantic',
    primaryVibe: 'lively',
    city: 'San Jose',
    objectiveOccasion: 'explore',
  })
  assert(conciergeIntent.intentMode === 'surprise', 'Surprise ConciergeIntent mode must be surprise.')
  assert(
    conciergeIntent.objective.primary === 'discover_route_shape',
    'Surprise objective must discover route shape.',
  )
  assert(
    conciergeIntent.controlPosture.mode === 'assistant_led',
    'Surprise control posture must be assistant-led.',
  )
  assert(
    conciergeIntent.starterLineage.source === 'system_seeded',
    'Surprise starter lineage must be system-seeded.',
  )
  assert(
    conciergeIntent.anchorLineage.source === 'system_seeded',
    'Surprise anchor lineage must be system-seeded.',
  )
  assert(
    conciergeIntent.candidateLineage.source === 'none',
    'Surprise candidate lineage must be empty before selected artifact state.',
  )

  const canonicalInterpretationBundle = buildCanonicalInterpretationBundle({
    conciergeIntent,
    interpretationSource: 'scripts.test-phase2-surprise-local-proof',
  })
  const districtPreview = await buildDistrictOpportunityProfiles({
    locationQuery: 'San Jose',
    includeDebug: true,
  })
  const contractGateWorld = buildContractGateWorldFromCanonical({
    canonicalInterpretationBundle,
    ranked: districtPreview.ranked,
    source: 'scripts.test-phase2-surprise-local-proof',
  })
  const strategyAdmissibleWorlds = buildStrategyAdmissibleWorlds({ contractGateWorld })
  assert(
    canonicalInterpretationBundle.contractConstraints.id.length > 0,
    'ContractConstraints must be present.',
  )
  assert(
    contractGateWorld.admittedPockets.length > 0,
    'ContractGateWorld must admit at least one Surprise pocket.',
  )
  assert(strategyAdmissibleWorlds.length > 0, 'StrategyAdmissibleWorlds must be present.')

  const canonicalBoard = await buildStopTypeCandidateBoardFromContract({
    conciergeIntent,
    canonicalInterpretationBundle,
    contractConstraints: canonicalInterpretationBundle.contractConstraints,
    contractGateWorld,
    locationQuery: 'San Jose',
    sourceMode: 'curated',
    liveEnvelope: CLOSED_PREVIEW_LIVE_ENVELOPE,
  })
  assert(canonicalBoard, 'Surprise canonical Field candidate board must build.')
  assert(
    canonicalBoard.debug?.fieldDiscoveryContract?.inputSource === 'canonical_contract',
    'Surprise Field/candidate board must use canonical_contract input.',
  )
  const staleBoard = await buildStopTypeCandidateBoardFromIntent({
    city: 'San Jose',
    mode: 'surprise',
    persona: 'family',
    vibe: 'cultured',
    sourceMode: 'curated',
    liveEnvelope: CLOSED_PREVIEW_LIVE_ENVELOPE,
  })
  assert(staleBoard, 'Stale compatibility board must build for causality shadow comparison.')

  const selectedDirection = buildProofDirectionSelection()
  const selectedDirectionContextForValidation = buildResolvedDirectionContext(selectedDirection)
  assert(selectedDirectionContextForValidation, 'Selected direction context must resolve.')
  const routeShapeContract = buildCanonicalSurpriseC1RouteShapeContract({
    conciergeIntent,
    canonicalInterpretationBundle,
    selectedDirection,
    selectedDirectionContext: selectedDirectionContextForValidation,
  })
  const selectedDirectionContext = buildSelectedDirectionContext(selectedDirection)
  const projectedInput = projectConciergeIntentToIntentInput({
    conciergeIntent,
    mode: 'surprise',
    city: 'San Jose',
    district: selectedDirection.pocketLabel,
    distanceMode: 'nearby',
    selectedDirectionContext,
  })
  const canonicalResult = await runPlan(projectedInput, {
    canonicalInterpretationBundle,
    contractGateWorld,
    strategyAdmissibleWorlds,
    routeShapeContract,
  })
  assert(
    canonicalResult.trace.canonicalInterpretationIngress?.supplied === true,
    'CanonicalInterpretationBundle must be supplied to runGeneratePlan.',
  )
  assert(
    canonicalResult.trace.canonicalInterpretationIngress?.experienceContractAligned === true &&
      canonicalResult.trace.canonicalInterpretationIngress?.contractConstraintsAligned === true,
    'ExperienceContract and ContractConstraints must align with the supplied bundle.',
  )
  assert(
    canonicalResult.trace.boundaryDiagnostics.waypointContractTrace?.primaryInput ===
      'contract_context',
    'Waypoint trace must use contract_context.',
  )
  assert(
    canonicalResult.trace.boundaryDiagnostics.waypointContractTrace?.normalizedObjectivePrimary ===
      'discover_route_shape',
    'Waypoint trace must use discover_route_shape from the contract objective.',
  )
  const selectedCompositionStamp =
    canonicalResult.selectedArc.scoreBreakdown.experienceCompositionStamp
  assert(
    selectedCompositionStamp?.requirementSource === 'route_shape_contract',
    'Selected Surprise route must receive active C1 route-shape requirements.',
  )
  assert(
    selectedCompositionStamp.routeShapeContractId === routeShapeContract.id,
    'Selected C1 stamp must reference the transported RouteShapeContract.',
  )
  assert(
    selectedCompositionStamp.unavailableEvidence.every(
      (reason) => reason !== 'composition_requirements_missing',
    ),
    'Active C1 Surprise route must not report missing composition requirements.',
  )

  const directionValidation = validateSurpriseDirection({
    result: canonicalResult,
    selectedDirection,
    selectedDirectionContext: selectedDirectionContextForValidation,
  })
  assert(
    directionValidation.validatorMode === 'surprise',
    'post-planner validateDirectionRouteContract must run with mode: surprise.',
  )

  const routeAuthority = assertGeneratedCanonicalRouteAuthority(canonicalResult)
  const hiddenSurpriseCoverage = assertHiddenSurpriseSourceItineraryCoverage(canonicalResult)
  const staleProjectionInput = mutateCompatibilityProjection(projectedInput)
  let staleProjectionAcceptedByPlanner = false
  let staleProjectionChangedPlannerDiagnostics = false
  let staleProjectionResult: GeneratePlanResult | null = null
  try {
    staleProjectionResult = await runPlan(staleProjectionInput, {
      canonicalInterpretationBundle,
      contractGateWorld,
      strategyAdmissibleWorlds,
      routeShapeContract,
    })
    staleProjectionAcceptedByPlanner = true
    staleProjectionChangedPlannerDiagnostics =
      staleProjectionResult.intentProfile.persona !== canonicalResult.intentProfile.persona ||
      staleProjectionResult.intentProfile.primaryAnchor !==
        canonicalResult.intentProfile.primaryAnchor ||
      staleProjectionResult.intentProfile.city !== canonicalResult.intentProfile.city ||
      routeIds(staleProjectionResult.itinerary).join('|') !==
        routeIds(canonicalResult.itinerary).join('|') ||
      staleProjectionResult.trace.canonicalInterpretationIngress?.personaAligned === false ||
      staleProjectionResult.trace.canonicalInterpretationIngress?.primaryVibeAligned === false
  } catch {
    staleProjectionAcceptedByPlanner = false
    staleProjectionChangedPlannerDiagnostics = false
  }

  const staleProjectionIgnoredOrRejected =
    !staleProjectionAcceptedByPlanner || !staleProjectionChangedPlannerDiagnostics
  const classification: SurpriseLoadBearingClassification = staleProjectionIgnoredOrRejected
    ? 'contract_load_bearing'
    : 'contract_aware_only'

  return {
    proofSurface: 'local-tsx-service-harness',
    classification,
    completeConciergeIntent: true,
    canonicalInterpretationBundleSupplied: true,
    contractConstraintsPresent: true,
    routeShapeContractId: routeShapeContract.id,
    routeShapeProjectionId:
      routeShapeContract.interpretationC1Projection?.projectionId ?? 'missing_projection',
    selectedCompositionRequirementSource: selectedCompositionStamp.requirementSource,
    selectedCompositionUnavailableReasons: [
      ...selectedCompositionStamp.unavailableEvidence,
    ],
    contractGateWorldPresent: true,
    strategyAdmissibleWorldCount: strategyAdmissibleWorlds.length,
    fieldCandidateBoardInputSource:
      canonicalBoard.debug?.fieldDiscoveryContract?.inputSource ?? null,
    staleCompatibilityBoardChangedScenarioFamily:
      canonicalBoard.scenarioFamily !== staleBoard.scenarioFamily,
    waypointTracePrimaryInput:
      canonicalResult.trace.boundaryDiagnostics.waypointContractTrace?.primaryInput ?? null,
    waypointTraceObjective:
      canonicalResult.trace.boundaryDiagnostics.waypointContractTrace
        ?.normalizedObjectivePrimary ?? null,
    postPlannerValidationMode: directionValidation.validatorMode ?? null,
    routeAuthorityStatus: routeAuthority.snapshot.validationStatus,
    lockInputAvailable: routeAuthority.lockInput.ok,
    legacyHostedSeamReviewLockCtaWouldAppear:
      routeAuthority.legacyHostedSeamReviewLockCtaWouldAppear,
    legacyHostedSeamLockInputAvailable: routeAuthority.legacyHostedSeamLockInput.ok,
    legacyHostedSeamRejectionReason:
      routeAuthority.legacyHostedSeamLockInput.diagnostics.rejectionReason,
    fixedReviewLockGateMatchesLockAction: routeAuthority.fixedReviewLockGateMatchesLockAction,
    generatedCanonicalLockInputSource: routeAuthority.lockInput.ok
      ? routeAuthority.lockInput.diagnostics.lockInputSource
      : null,
    selectedRouteArtifactOnlyLockReady: routeAuthority.selectedRouteArtifactOnlyLockInput.ok,
    pageLocalOnlyLockReady: routeAuthority.pageLocalOnlyLockInput.ok,
    hiddenSurpriseHostedMismatchReproduced:
      hiddenSurpriseCoverage.hostedMismatchReproduced,
    hiddenSurpriseItineraryCompanionPreserved:
      hiddenSurpriseCoverage.itineraryCompanionPreserved,
    hiddenSurpriseValidateLiveArtifactPasses:
      hiddenSurpriseCoverage.validateLiveArtifactPasses,
    hiddenSurpriseVisibleRouteRoles: hiddenSurpriseCoverage.visibleRouteRoles,
    hiddenSurpriseSourceCoverageComplete:
      hiddenSurpriseCoverage.sourceCoverageComplete,
    staleProjectionIgnoredOrRejected,
    staleProjectionAcceptedByPlanner,
    staleProjectionChangedPlannerDiagnostics,
    canonicalRouteIds: routeIds(canonicalResult.itinerary),
    staleProjectionRouteIds: staleProjectionResult ? routeIds(staleProjectionResult.itinerary) : [],
    providerValve: { ...fetchCounters },
    hostedSurpriseProofSafe: classification === 'contract_load_bearing',
  }
}

async function runPlan(
  input: IntentInput,
  params: {
    canonicalInterpretationBundle: ReturnType<typeof buildCanonicalInterpretationBundle>
    contractGateWorld: ReturnType<typeof buildContractGateWorldFromCanonical>
    strategyAdmissibleWorlds: ReturnType<typeof buildStrategyAdmissibleWorlds>
    routeShapeContract: RouteShapeContract
  },
): Promise<GeneratePlanResult> {
  return runGeneratePlan(input, {
    sourceMode: 'curated',
    sourceModeOverrideApplied: true,
    debugMode: false,
    vibeTasteProfileScoring: 'off',
    occasionScoring: 'off',
    whenSpatialScoring: 'off',
    experienceContract: params.canonicalInterpretationBundle.experienceContract,
    contractConstraints: params.canonicalInterpretationBundle.contractConstraints,
    canonicalInterpretationBundle: params.canonicalInterpretationBundle,
    contractGateWorld: params.contractGateWorld,
    strategyAdmissibleWorlds: params.strategyAdmissibleWorlds,
    routeShapeContract: params.routeShapeContract,
  })
}

function buildProofDirectionSelection(): DirectionPlanningSelection {
  return buildDirectionPlanningSelection({
    id: 'surprise-contract-proof-direction',
    label: 'Surprise contract proof direction',
    pocketId: 'downtown-san-jose',
    pocketLabel: 'Downtown San Jose',
    archetype: 'social',
    cluster: 'lively',
    experienceFamily: 'romantic_lively',
    familyConfidence: 0.9,
    laneIdentity: 'lively_core',
    macroLane: 'lively',
  })
}

function buildSelectedDirectionContext(
  selectedDirection: DirectionPlanningSelection,
): SelectedDirectionContext {
  return {
    directionId: selectedDirection.id,
    pocketId: selectedDirection.pocketId,
    label: selectedDirection.label,
    archetype: selectedDirection.archetype,
    identity: selectedDirection.identity,
    subtitle: selectedDirection.subtitle,
    family: selectedDirection.experienceFamily,
    familyConfidence: selectedDirection.familyConfidence,
    cluster: selectedDirection.cluster,
    greatStopSignal: selectedDirection.greatStopSignal,
  }
}

function validateSurpriseDirection(params: {
  result: GeneratePlanResult
  selectedDirection: DirectionPlanningSelection
  selectedDirectionContext: ResolvedDirectionContext
}): ReturnType<typeof validateDirectionRouteContract> {
  const buildability = assessDirectionContractBuildability({
    expectedDirectionIdentity: params.selectedDirectionContext.identity,
    scoredVenues: params.result.scoredVenues,
  })
  return validateDirectionRouteContract({
    selectedDirectionContext: params.selectedDirectionContext,
    selectedDirection: params.selectedDirection,
    itinerary: params.result.itinerary,
    buildability,
    mode: 'surprise',
  })
}

function assertGeneratedCanonicalRouteAuthority(result: GeneratePlanResult): {
  snapshot: ReturnType<typeof buildRouteAuthoritySnapshot>
  lockInput: ReturnType<typeof buildLockInputFromRouteAuthoritySnapshot>
  legacyHostedSeamLockInput: ReturnType<typeof buildLockInputFromRouteAuthoritySnapshot>
  legacyHostedSeamReviewLockCtaWouldAppear: boolean
  fixedReviewLockGateMatchesLockAction: boolean
  selectedRouteArtifactOnlyLockInput: ReturnType<typeof buildLockInputFromRouteAuthoritySnapshot>
  pageLocalOnlyLockInput: ReturnType<typeof buildLockInputFromRouteAuthoritySnapshot>
} {
  const finalRoute = buildRuntimeRoute(result)
  const selectedDirectionId =
    result.contractEntryArtifact.selection.directionId ??
    result.intentProfile.selectedDirectionContext?.directionId ??
    finalRoute.selectedDirectionId
  const legacyHostedSeamSnapshot = buildRouteAuthoritySnapshot({
    contractEntryArtifact: result.contractEntryArtifact,
    selectedDirectionId,
    selectedArtifactId: result.contractEntryArtifact.id,
    pageLocalFinalRoute: finalRoute,
    selectedClusterConfirmation: 'Surprise generated route is ready for Review.',
    itinerary: result.itinerary,
  })
  const legacyHostedSeamLockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot: legacyHostedSeamSnapshot,
    activeRole: 'start',
    fallbackCity: result.intentProfile.city,
  })
  const legacyHostedSeamReviewLockCtaWouldAppear = Boolean(
    result.contractEntryArtifact &&
      finalRoute &&
      finalRoute.selectedDirectionId === selectedDirectionId,
  )
  assert(
    legacyHostedSeamReviewLockCtaWouldAppear,
    'Legacy hosted seam must model generated route display readiness.',
  )
  assert(
    !legacyHostedSeamLockInput.ok &&
      legacyHostedSeamLockInput.diagnostics.rejectionReason ===
        'lock_ready_requires_canonical_authority',
    'Legacy hosted seam must reproduce page-local-only lock authority failure.',
  )

  const snapshot = buildRouteAuthoritySnapshot({
    contractEntryArtifact: result.contractEntryArtifact,
    runtimeRouteArtifact: finalRoute,
    selectedDirectionId,
    selectedArtifactId: result.contractEntryArtifact.id,
    selectedClusterConfirmation: 'Surprise generated route is ready for Review.',
    itinerary: result.itinerary,
  })
  assert(snapshot.validationStatus === 'valid', 'Generated Surprise canonical truth must be valid.')
  const lockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot,
    activeRole: 'start',
    fallbackCity: result.intentProfile.city,
  })
  assert(lockInput.ok, 'Generated Surprise routeAuthority truth must produce lock input.')
  assert(
    lockInput.diagnostics.lockInputSource === 'contract_entry_artifact.runtime_route_artifact',
    'Generated Surprise lock input must come from generated canonical route truth.',
  )
  assert(
    !snapshot.rejectionReasons.includes('lock_ready_requires_canonical_authority'),
    'Generated Surprise canonical truth must make lock_ready_requires_canonical_authority unreachable.',
  )
  const fixedReviewLockGateMatchesLockAction = Boolean(lockInput.ok)
  assertRuntimeRouteArtifactShape(finalRoute)

  const staleSelectedRoute = buildStaleRoute(finalRoute)
  const selectedRouteArtifactOnlySnapshot = buildRouteAuthoritySnapshot({
    legacySelectedRouteArtifact: {
      source: 'legacy_selected_route_artifact',
      directionId: finalRoute.selectedDirectionId,
      candidateArtifactId: 'stale_surprise_selected_route_artifact',
      canonicalRouteArtifact: {
        finalRoute: staleSelectedRoute,
      },
    },
    selectedClusterConfirmation: 'Stale Surprise selected route artifact.',
    itinerary: result.itinerary,
  })
  const selectedRouteArtifactOnlyLockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot: selectedRouteArtifactOnlySnapshot,
    activeRole: 'start',
    fallbackCity: result.intentProfile.city,
  })
  assert(
    !selectedRouteArtifactOnlyLockInput.ok,
    'Stale SelectedRouteArtifact alone must not become Surprise route authority.',
  )

  const pageLocalOnlySnapshot = buildRouteAuthoritySnapshot({
    pageLocalFinalRoute: staleSelectedRoute,
    selectedClusterConfirmation: 'Stale Surprise page-local finalRoute.',
    itinerary: result.itinerary,
  })
  const pageLocalOnlyLockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot: pageLocalOnlySnapshot,
    activeRole: 'start',
    fallbackCity: result.intentProfile.city,
  })
  assert(
    !pageLocalOnlyLockInput.ok,
    'Page-local finalRoute alone must not become Surprise route authority.',
  )

  return {
    snapshot,
    lockInput,
    legacyHostedSeamLockInput,
    legacyHostedSeamReviewLockCtaWouldAppear,
    fixedReviewLockGateMatchesLockAction,
    selectedRouteArtifactOnlyLockInput,
    pageLocalOnlyLockInput,
  }
}

function assertHiddenSurpriseSourceItineraryCoverage(result: GeneratePlanResult): {
  hostedMismatchReproduced: boolean
  itineraryCompanionPreserved: boolean
  validateLiveArtifactPasses: boolean
  visibleRouteRoles: string[]
  sourceCoverageComplete: boolean
} {
  const hiddenSourceStopId = 'wildcard_sj-jtown-ramen-ya'
  const windDownStop = result.itinerary.stops.find((stop) => stop.role === 'windDown')
  assert(windDownStop, 'Hidden Surprise fixture requires an existing wind-down stop.')
  const hiddenSurpriseStop: ItineraryStop = {
    ...windDownStop,
    id: hiddenSourceStopId,
    role: 'surprise',
    title: 'Surprise',
    venueId: 'sj-jtown-ramen-ya',
    venueName: 'JTown Ramen Ya',
    subtitle: 'Hidden wildcard companion stop',
    selectedBecause: 'Models hosted Surprise wildcard source stop identity.',
    stopInsider: {
      ...windDownStop.stopInsider,
      roleReason: 'Hidden wildcard companion stop for Surprise validation.',
    },
  }
  const itineraryWithHiddenSurprise: Itinerary = {
    ...result.itinerary,
    stops: [...result.itinerary.stops, hiddenSurpriseStop],
  }
  const canonicalStopByRole = buildCanonicalStopIdentityByRole(itineraryWithHiddenSurprise)
  canonicalStopByRole.surprise = {
    displayName: hiddenSurpriseStop.venueName,
    providerRecordId: `provider:${hiddenSurpriseStop.venueId}`,
    latitude: hiddenSurpriseStop.latitude ?? 37.34,
    longitude: hiddenSurpriseStop.longitude ?? -121.89,
    addressLine: hiddenSurpriseStop.formattedAddress ?? `${hiddenSurpriseStop.venueName}, San Jose, CA`,
    neighborhood: hiddenSurpriseStop.neighborhood,
  }
  const selectedDirectionId =
    result.contractEntryArtifact.selection.directionId ??
    result.intentProfile.selectedDirectionContext?.directionId ??
    'surprise-generated-direction'
  const finalRouteWithHiddenSurprise = buildFinalRoute({
    itinerary: itineraryWithHiddenSurprise,
    canonicalStopByRole,
    selectedDirectionId,
    city: result.intentProfile.city,
    persona: result.intentProfile.persona,
    vibe: result.intentProfile.primaryAnchor,
    activeRole: 'start',
    mode: 'surprise',
    routeHeadline: result.itinerary.storySpine?.title ?? result.itinerary.title,
    routeSummary: result.itinerary.storySpine?.routeSummary ?? result.itinerary.shareSummary,
  })
  assert(finalRouteWithHiddenSurprise, 'Hidden Surprise fixture finalRoute must build.')
  assertRuntimeRouteArtifactShape(finalRouteWithHiddenSurprise)
  assert(
    finalRouteWithHiddenSurprise.stops.some(
      (stop) => stop.role === 'surprise' && stop.sourceStopId === hiddenSourceStopId,
    ),
    'Hidden Surprise fixture must include the wildcard source stop in finalRoute.',
  )

  const legacyCoreOnlyLockSafeStops = finalRouteWithHiddenSurprise.stops
    .filter((stop) => stop.role === 'start' || stop.role === 'highlight' || stop.role === 'windDown')
    .map((finalStop) => {
      const sourceStop =
        itineraryWithHiddenSurprise.stops.find((stop) => stop.id === finalStop.sourceStopId) ??
        itineraryWithHiddenSurprise.stops.find((stop) => stop.role === finalStop.role)
      assert(sourceStop, `Legacy fixture source stop missing for ${finalStop.sourceStopId}.`)
      return {
        ...sourceStop,
        id: finalStop.sourceStopId,
        role: finalStop.role,
        venueId: finalStop.venueId,
        venueName: finalStop.displayName || sourceStop.venueName,
      }
    })
  const legacyPayload = buildLockedLiveArtifactPayload({
    canonicalRouteArtifact: {
      selectedClusterConfirmation: 'Surprise generated route is ready for Review.',
      itinerary: itineraryWithHiddenSurprise,
      finalRoute: finalRouteWithHiddenSurprise,
    },
    lockSafeItineraryStops: legacyCoreOnlyLockSafeStops,
    activeRole: 'start',
    fallbackCity: result.intentProfile.city,
    lockedAt: 1,
    sessionId: 'surprise-hidden-source-legacy-fixture',
  })
  const legacyValidation = validateLockedLiveArtifactSessionPayload(legacyPayload)
  assert(
    !legacyValidation.ok &&
      legacyValidation.error.code === 'final_route_itinerary_mismatch' &&
      legacyValidation.error.detail.includes(`surprise:${hiddenSourceStopId}:missing_source_stop`),
    'Legacy core-only lock-safe itinerary must reproduce hidden Surprise missing_source_stop.',
  )

  const snapshot = buildRouteAuthoritySnapshot({
    contractEntryArtifact: result.contractEntryArtifact,
    runtimeRouteArtifact: finalRouteWithHiddenSurprise,
    selectedDirectionId,
    selectedArtifactId: result.contractEntryArtifact.id,
    selectedClusterConfirmation: 'Surprise generated route is ready for Review.',
    itinerary: itineraryWithHiddenSurprise,
  })
  const lockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot,
    activeRole: 'start',
    fallbackCity: result.intentProfile.city,
  })
  assert(lockInput.ok, 'Hidden Surprise canonical truth must produce lock input.')
  const lockSafeSourceIds = new Set(lockInput.input.lockSafeItineraryStops.map((stop) => stop.id))
  const sourceCoverageComplete = finalRouteWithHiddenSurprise.stops.every((stop) =>
    lockSafeSourceIds.has(stop.sourceStopId),
  )
  assert(
    sourceCoverageComplete,
    'Every hidden Surprise finalRoute sourceStopId must have a lock-safe itinerary companion.',
  )
  assert(
    lockSafeSourceIds.has(hiddenSourceStopId),
    'Hidden Surprise wildcard stop must be preserved as an itinerary companion.',
  )
  const fixedPayload = buildLockedLiveArtifactPayload({
    ...lockInput.input,
    lockedAt: 1,
    sessionId: 'surprise-hidden-source-fixed-fixture',
  })
  const fixedValidation = validateLockedLiveArtifactSessionPayload(fixedPayload)
  assert(fixedValidation.ok, 'Hidden Surprise fixed payload must validate as a live artifact.')
  const visibleRouteRoles = finalRouteWithHiddenSurprise.stops
    .filter((stop) => stop.role === 'start' || stop.role === 'highlight' || stop.role === 'windDown')
    .map((stop) => stop.role)
  assert(
    visibleRouteRoles.join('|') === 'start|highlight|windDown',
    'Hidden Surprise stop must not become part of visible core route roles.',
  )

  return {
    hostedMismatchReproduced: true,
    itineraryCompanionPreserved: lockSafeSourceIds.has(hiddenSourceStopId),
    validateLiveArtifactPasses: fixedValidation.ok,
    visibleRouteRoles,
    sourceCoverageComplete,
  }
}

function buildRuntimeRoute(result: GeneratePlanResult): RuntimeRouteArtifact {
  const selectedDirectionId =
    result.contractEntryArtifact.selection.directionId ??
    result.intentProfile.selectedDirectionContext?.directionId ??
    'surprise-generated-direction'
  const finalRoute = buildFinalRoute({
    itinerary: result.itinerary,
    canonicalStopByRole: buildCanonicalStopIdentityByRole(result.itinerary),
    selectedDirectionId,
    city: result.intentProfile.city,
    persona: result.intentProfile.persona,
    vibe: result.intentProfile.primaryAnchor,
    activeRole: 'start',
    mode: 'surprise',
    routeHeadline: result.itinerary.storySpine?.title ?? result.itinerary.title,
    routeSummary: result.itinerary.storySpine?.routeSummary ?? result.itinerary.shareSummary,
  })
  assert(finalRoute, 'Generated Surprise finalRoute must build from itinerary canonical identity.')
  return finalRoute
}

function buildCanonicalStopIdentityByRole(
  itinerary: Itinerary,
): Parameters<typeof buildFinalRoute>[0]['canonicalStopByRole'] {
  const canonicalStopByRole: Parameters<typeof buildFinalRoute>[0]['canonicalStopByRole'] = {}
  for (const stop of itinerary.stops) {
    if (stop.role !== 'start' && stop.role !== 'highlight' && stop.role !== 'windDown') {
      continue
    }
    canonicalStopByRole[stop.role] = {
      displayName: stop.venueName,
      providerRecordId: `provider:${stop.venueId}`,
      latitude: stop.latitude ?? 37.33,
      longitude: stop.longitude ?? -121.89,
      addressLine: stop.formattedAddress ?? `${stop.venueName}, San Jose, CA`,
      neighborhood: stop.neighborhood ?? resultNeighborhoodFallback(stop.role),
    }
  }
  return canonicalStopByRole
}

function resultNeighborhoodFallback(role: UserStopRole): string {
  return role === 'highlight' ? 'Downtown' : 'San Jose'
}

function buildStaleRoute(route: RuntimeRouteArtifact): RuntimeRouteArtifact {
  return {
    ...route,
    routeId: `${route.routeId}:stale`,
    stops: route.stops.map((stop, index) =>
      index === 1
        ? {
            ...stop,
            id: `${stop.id}:stale`,
            sourceStopId: `${stop.sourceStopId}:stale`,
            venueId: 'stale-surprise-highlight',
            providerRecordId: 'provider:stale-surprise-highlight',
            displayName: 'Stale Surprise Highlight',
          }
        : stop,
    ),
    mapMarkers: route.mapMarkers.map((marker, index) =>
      index === 1
        ? {
            ...marker,
            id: `${marker.id}:stale`,
            displayName: 'Stale Surprise Highlight',
          }
        : marker,
    ),
    updatedAt: route.updatedAt + 1,
  }
}

function mutateCompatibilityProjection(input: IntentInput): IntentInput {
  return {
    ...input,
    city: 'Oakland',
    district: 'Stale District',
    persona: 'family',
    primaryVibe: 'cultured',
    selectedDirectionContext: {
      ...input.selectedDirectionContext,
      directionId: 'stale-surprise-direction',
      pocketId: 'stale-surprise-pocket',
      selectedDirectionId: 'stale-surprise-direction',
      selectedPocketId: 'stale-surprise-pocket',
      identity: 'exploratory',
    } as IntentInput['selectedDirectionContext'],
  }
}

function routeIds(itinerary: Itinerary): string[] {
  return itinerary.stops
    .filter((stop) => stop.role === 'start' || stop.role === 'highlight' || stop.role === 'windDown')
    .map((stop) => stop.venueId)
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
    'RuntimeRouteArtifact shape must remain unchanged.',
  )
}
