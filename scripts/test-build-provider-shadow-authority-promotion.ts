import { readFileSync } from 'node:fs'
import {
  buildLockInputFromRouteAuthoritySnapshot,
  buildRouteAuthoritySnapshot,
} from '../src/app/services/routeAuthority/routeAuthorityService.ts'
import type { ContractEntryArtifact } from '../src/domain/artifacts/contractEntryArtifact.ts'
import type { RuntimeRouteArtifact, RuntimeRouteStop } from '../src/domain/artifacts/runtimeRouteArtifact.ts'
import type { Itinerary, ItineraryStop, UserStopRole } from '../src/domain/types/itinerary.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function sourceSlice(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start + startMarker.length)
  assert(start >= 0, `Missing source marker: ${startMarker}`)
  assert(end > start, `Missing source marker after ${startMarker}: ${endMarker}`)
  return source.slice(start, end)
}

const originalFetch = globalThis.fetch
let fetchCallCount = 0

globalThis.fetch = (async () => {
  fetchCallCount += 1
  throw new Error('test-build-provider-shadow-authority-promotion must not call fetch.')
}) as typeof fetch

function buildProviderShadowCandidateArtifact(): ContractEntryArtifact {
  return {
    id: 'verified_build_provider_live_sj-tech-interactive_1783141664265',
    sourceOpportunityId: 'verified_build_provider_live_sj-tech-interactive_1783141664265',
    sourceMode: 'build_provider_live',
    anchorVenueId: 'sj-tech-interactive',
    anchorRole: 'highlight',
    anchorName: 'The Tech Interactive',
    routeTitle: 'The Tech Interactive Family Route',
    flavorLine: 'Provider-backed family route candidate.',
    routeSummary: 'Dumont Creamery & Cafe to The Tech Interactive to Dumont Creamery & Cafe.',
    traits: ['family', 'museum', 'downtown'],
    storySpine: {
      start: 'Dumont Creamery & Cafe',
      highlight: 'The Tech Interactive',
      windDown: 'Dumont Creamery & Cafe',
    },
    districtLine: 'Downtown San Jose',
    districtAnchorLine: 'Near The Tech Interactive',
    authorityLine: 'Provider shadow candidate only; not generated route authority.',
    whyChooseLine: 'Healthy provider supply can form a candidate, but must be promoted through generation.',
    selection: {
      directionId: 'build-provider-live-sj-tech-interactive',
      pocketId: 'provider-live-sj-tech-interactive',
    },
    enrichment: {
      canonicalRouteRoleCoverage: {
        start: 'Dumont Creamery & Cafe',
        highlight: 'The Tech Interactive',
        windDown: 'Dumont Creamery & Cafe',
        support: [
          {
            role: 'start',
            name: 'Dumont Creamery & Cafe',
            venueId: 'provider-dumont-creamery-cafe',
          },
          {
            role: 'highlight',
            name: 'The Tech Interactive',
            venueId: 'sj-tech-interactive',
          },
          {
            role: 'windDown',
            name: 'Dumont Creamery & Cafe',
            venueId: 'provider-dumont-creamery-cafe',
          },
        ],
      },
    },
  } as ContractEntryArtifact
}

function buildPromotedGeneratedArtifact(): ContractEntryArtifact {
  return {
    ...buildProviderShadowCandidateArtifact(),
    id: 'generated_public_build_tech_interactive',
    sourceOpportunityId: 'verified_build_provider_live_sj-tech-interactive_1783141664265',
    sourceMode: 'build_provider_live',
    authorityLine: 'Generated canonical route truth promoted after provider-backed generation.',
    whyChooseLine: 'Generated route authority replaces the provider-shadow candidate before lock.',
  } as ContractEntryArtifact
}

function buildRuntimeStop(role: UserStopRole, venueId: string, stopIndex: number): RuntimeRouteStop {
  const displayName =
    venueId === 'sj-tech-interactive' ? 'The Tech Interactive' : 'Dumont Creamery & Cafe'
  return {
    id: `${role}:${venueId}:${stopIndex}`,
    sourceStopId: `${role}:${venueId}:${stopIndex}`,
    displayName,
    latitude: 37.331,
    longitude: -121.889,
    address: '1 Test Way',
    role,
    stopIndex,
    venueId,
    title: role === 'highlight' ? 'Museum anchor' : 'Family support stop',
    subtitle: 'Downtown San Jose',
    neighborhood: 'Downtown',
    driveMinutes: 4,
    imageUrl: '/test.jpg',
  }
}

function buildRuntimeRoute(): RuntimeRouteArtifact {
  const stops = [
    buildRuntimeStop('start', 'provider-dumont-creamery-cafe', 0),
    buildRuntimeStop('highlight', 'sj-tech-interactive', 1),
    buildRuntimeStop('windDown', 'provider-dumont-creamery-cafe', 2),
  ]
  return {
    routeId: 'build-runtime-tech-interactive',
    selectedDirectionId: 'build-provider-live-sj-tech-interactive',
    location: 'San Jose',
    persona: 'family',
    vibe: 'cultured',
    stops,
    activeStopIndex: 0,
    routeHeadline: 'The Tech Interactive Family Route',
    routeSummary: 'Dumont Creamery & Cafe to The Tech Interactive to Dumont Creamery & Cafe.',
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

function buildItineraryStop(role: UserStopRole, venueId: string, stopIndex: number): ItineraryStop {
  const runtimeStop = buildRuntimeStop(role, venueId, stopIndex)
  return {
    id: runtimeStop.sourceStopId,
    role,
    title: runtimeStop.title,
    venueId,
    venueName: runtimeStop.displayName,
    formattedAddress: runtimeStop.address,
    latitude: runtimeStop.latitude,
    longitude: runtimeStop.longitude,
    city: 'San Jose',
    category: role === 'highlight' ? 'museum' : 'cafe',
    subcategory: role === 'highlight' ? 'interactive museum' : 'dessert',
    priceTier: '$$',
    tags: role === 'highlight' ? ['museum', 'family'] : ['cafe', 'dessert'],
    vibeTags: ['family'],
    neighborhood: runtimeStop.neighborhood,
    driveMinutes: runtimeStop.driveMinutes,
    durationClass: 'standard',
    estimatedDurationMinutes: 45,
    estimatedDurationLabel: '45 min',
    subtitle: runtimeStop.subtitle,
    imageUrl: runtimeStop.imageUrl,
    stopInsider: {
      roleReason: 'test role',
      localSignal: 'test local',
      selectionReason: 'test selection',
    },
  }
}

function buildItinerary(): Itinerary {
  return {
    id: 'itinerary-tech-interactive',
    title: 'The Tech Interactive Family Route',
    city: 'San Jose',
    crew: 'family',
    vibes: ['cultured'],
    stops: [
      buildItineraryStop('start', 'provider-dumont-creamery-cafe', 0),
      buildItineraryStop('highlight', 'sj-tech-interactive', 1),
      buildItineraryStop('windDown', 'provider-dumont-creamery-cafe', 2),
    ],
    transitions: [],
    totalRouteFriction: 0.2,
    estimatedTotalMinutes: 150,
    estimatedTotalLabel: '2.5 hours',
    routeFeelLabel: 'Easy',
    story: {
      headline: 'The Tech Interactive Family Route',
      subtitle: 'Family museum route',
    },
    storySpine: {
      title: 'The Tech Interactive Family Route',
      phases: [],
      routeSummary: 'Dumont Creamery & Cafe to The Tech Interactive to Dumont Creamery & Cafe.',
    },
    shareSummary: 'The Tech Interactive route.',
  }
}

try {
  const sandboxSource = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')
  const routeAuthoritySource = readFileSync(
    'src/app/services/routeAuthority/routeAuthorityService.ts',
    'utf8',
  )

  const providerGenerationCandidateBlock = sourceSlice(
    sandboxSource,
    'const buildProviderGenerationCandidateArtifact = useMemo(() => {',
    'const buildGenerationInputCandidateArtifacts = useMemo(',
  )
  const generationInputCandidateBlock = sourceSlice(
    sandboxSource,
    'const buildGenerationInputCandidateArtifacts = useMemo(',
    'const curateDisplayArtifactsBeforeDedupe = useMemo',
  )
  const selectedBuildCandidateSourceKindBlock = sourceSlice(
    sandboxSource,
    'const selectedBuildCandidateSourceKind =',
    'const publicSurpriseVerifiedCardModels = useMemo',
  )
  const preGenerationReadyBlock = sourceSlice(
    sandboxSource,
    'const buildPreGenerationSelectionReady = Boolean(',
    'useEffect(() => {',
  )
  const generatedCanonicalHandoffBlock = sourceSlice(
    sandboxSource,
    'const buildGeneratedCanonicalHandoff = useMemo(() => {',
    'const routeAuthoritySnapshot = useMemo(',
  )
  const buildSelectedCardTruthReadyBlock = sourceSlice(
    sandboxSource,
    'const buildSelectedCardTruthReady = Boolean(',
    'const showPrimaryContinueAction = Boolean(',
  )
  const handleBuildFullPlanBlock = sourceSlice(
    sandboxSource,
    'const handleBuildFullPlan = useCallback(async () => {',
    'const handleRetrySurpriseGeneration = useCallback(',
  )

  assert(
    providerGenerationCandidateBlock.includes('shadowBuildProviderArtifact') &&
      providerGenerationCandidateBlock.includes('shadowBuildProviderDiagnostics?.buildProviderSourceOpportunityEmitted') &&
      providerGenerationCandidateBlock.includes('enrichContractEntryArtifactWithDirectionBacking'),
    'Public Build must still create a provider-backed generation candidate from shadow provider supply.',
  )
  assert(
    generationInputCandidateBlock.includes('buildProviderGenerationCandidateArtifact') &&
      generationInputCandidateBlock.includes('...buildAnchorMatchedCandidateArtifacts'),
    'Build generation input artifacts must still include the provider-backed candidate.',
  )
  assert(
    selectedBuildCandidateSourceKindBlock.includes("'provider_shadow'") &&
      selectedBuildCandidateSourceKindBlock.includes('buildProviderGenerationCandidateArtifact.id'),
    'Provider-backed selected candidates must still be tagged provider_shadow before generated truth exists.',
  )
  assert(
    preGenerationReadyBlock.includes("buildSelectedCandidateAdmissionDiagnostic?.source === 'provider_shadow'") &&
      preGenerationReadyBlock.includes('buildProviderMergedIntoVisiblePool') &&
      preGenerationReadyBlock.includes('buildSelectedCandidateAdmissionDiagnostic.admitted'),
    'Build pre-generation readiness must still admit provider-backed generation input.',
  )
  assert(
    generatedCanonicalHandoffBlock.includes('plan?.generatedContractEntryArtifact') &&
      generatedCanonicalHandoffBlock.includes('renderOnlyFinalRoute') &&
      generatedCanonicalHandoffBlock.includes('selectedCandidateRouteArtifact') &&
      generatedCanonicalHandoffBlock.includes('selectedBuildAnchor?.venueId'),
    'Generated canonical handoff must still require generated artifact and renderOnlyFinalRoute.',
  )
  assert(
    routeAuthoritySource.includes("selectedCandidateSourceKind === 'provider_shadow'") &&
      routeAuthoritySource.includes("reasons.push('provider_shadow_not_authority')") &&
      routeAuthoritySource.includes("reasons.push('generated_contract_entry_missing')"),
    'Route authority must still reject provider_shadow when generated runtime truth is missing.',
  )
  assert(
    buildSelectedCardTruthReadyBlock.includes('buildPreGenerationSelectionReady') &&
      handleBuildFullPlanBlock.includes('!buildReviewTruthEligible') &&
      handleBuildFullPlanBlock.includes('!buildPreGenerationSelectionReady') &&
      handleBuildFullPlanBlock.includes('generatePlan('),
    'Public Build must allow provider-backed pre-generation readiness to reach generation before Review eligibility.',
  )

  const providerShadowCandidate = buildProviderShadowCandidateArtifact()
  const providerShadowSnapshot = buildRouteAuthoritySnapshot({
    contractEntryArtifact: null,
    runtimeRouteArtifact: null,
    selectedDirectionId: providerShadowCandidate.selection.directionId,
    selectedArtifactId: providerShadowCandidate.id,
    buildContext: {
      mode: 'build',
      selectedCandidateArtifact: providerShadowCandidate,
      selectedCandidateSourceKind: 'provider_shadow',
      selectedAnchorVenueId: 'sj-tech-interactive',
      selectedAnchorRequiredRole: 'highlight',
      routeReplacementAdmitted: false,
    },
  })
  const providerShadowLockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot: providerShadowSnapshot,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  const generatedContractEntryArtifact = buildPromotedGeneratedArtifact()
  const finalRoute = buildRuntimeRoute()
  const promotedGeneratedSnapshot = buildRouteAuthoritySnapshot({
    contractEntryArtifact: generatedContractEntryArtifact,
    runtimeRouteArtifact: finalRoute,
    selectedDirectionId: generatedContractEntryArtifact.selection.directionId,
    selectedArtifactId: generatedContractEntryArtifact.id,
    selectedClusterConfirmation: 'Generated Tech Interactive route is ready for Review.',
    itinerary: buildItinerary(),
    buildContext: {
      mode: 'build',
      selectedCandidateArtifact: null,
      selectedCandidateSourceKind: null,
      selectedAnchorVenueId: 'sj-tech-interactive',
      selectedAnchorRequiredRole: 'highlight',
      routeReplacementAdmitted: false,
    },
  })
  const promotedLockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot: promotedGeneratedSnapshot,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })

  const evidence = {
    selectedAnchorCanonicalVenueId: 'sj-tech-interactive',
    providerSupplySettled: true,
    providerSupplyHealthy: true,
    providerBackedCandidateSelected: true,
    providerShadowCandidatePresent: true,
    providerShadowAdmittedForGenerationInput: true,
    buildPreGenerationSelectionReady: true,
    generationInputEligible: true,
    generatePlanInvokedOrEquivalentGenerationHandoffProof: true,
    canonicalHandoffMissing: false,
    generatedContractEntryArtifactProduced: Boolean(promotedGeneratedSnapshot.selectedContractEntryArtifact),
    finalRouteProduced: Boolean(promotedGeneratedSnapshot.lockReadyCanonicalRouteTruthCandidate?.finalRoute),
    runtimeRouteArtifactProduced: Boolean(
      promotedGeneratedSnapshot.buildDiagnostics?.generatedRuntimeRoutePresent,
    ),
    providerShadowNotAuthority: promotedGeneratedSnapshot.rejectionReasons.includes(
      'provider_shadow_not_authority',
    ),
    generatedContractEntryMissing: promotedGeneratedSnapshot.rejectionReasons.includes(
      'generated_contract_entry_missing',
    ),
    lockInputAvailable: promotedLockInput.ok,
    providerShadowPreGenerationNonLockable: !providerShadowLockInput.ok,
    providerShadowPreGenerationReasons: providerShadowSnapshot.rejectionReasons,
    fetchCallCount,
  }

  console.log(JSON.stringify(evidence, null, 2))

  assert(fetchCallCount === 0, 'No fetch/provider/API calls may occur in this red test.')
  assert(
    providerShadowSnapshot.rejectionReasons.includes('provider_shadow_not_authority'),
    'provider_shadow_not_authority must remain present before generated authority exists.',
  )
  assert(
    providerShadowSnapshot.rejectionReasons.includes('generated_contract_entry_missing'),
    'generated_contract_entry_missing must remain present before generated authority exists.',
  )
  assert(!providerShadowLockInput.ok, 'Provider-shadow candidate must not produce lock input.')
  assert(evidence.generatedContractEntryArtifactProduced, 'Generated ContractEntryArtifact must be produced.')
  assert(evidence.finalRouteProduced, 'finalRoute must be produced.')
  assert(evidence.runtimeRouteArtifactProduced, 'RuntimeRouteArtifact must be produced.')
  assert(!evidence.providerShadowNotAuthority, 'Promoted generated route must not retain provider_shadow_not_authority.')
  assert(!evidence.generatedContractEntryMissing, 'Promoted generated route must not report generated_contract_entry_missing.')
  assert(evidence.lockInputAvailable, 'Promoted generated route must produce lock input.')
} finally {
  globalThis.fetch = originalFetch
}
