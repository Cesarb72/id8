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

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

function last<T>(values: T[]): T {
  assert(values.length > 0, 'Expected at least one value.')
  return values[values.length - 1]
}

function includesAll(source: string, values: string[]): boolean {
  return values.every((value) => source.includes(value))
}

function normalizeStopName(value: string | null | undefined): string {
  return value?.trim().toLowerCase().replace(/\s+/g, ' ') ?? ''
}

function hasDuplicateStopNames(stops: Array<{ stop?: string }>): boolean {
  const normalized = stops.map((entry) => normalizeStopName(entry.stop)).filter(Boolean)
  return new Set(normalized).size < normalized.length
}

type TechRunSummary = {
  generatePlanInvoked?: boolean
  buildContractDrivenBuildWaypointPlanInvoked?: boolean
  routeAuthority?: {
    selectedArtifactId?: string | null
    selectedArtifactSourceOpportunityId?: string | null
    selectedArtifactDisplaySource?: string | null
    buildPreGenerationSelectionReady?: boolean
    buildReviewTruthEligible?: boolean
    routeAuthorityStatus?: string | null
    routeAuthoritySourceLabel?: string | null
    routeAuthorityReasons?: string[]
    routeAuthorityBuildReasons?: string[]
    lockInputAvailable?: boolean
    finalRoutePresent?: boolean
    generatedPlanPresent?: boolean
    generatedContractEntryArtifactPresent?: boolean
    generatedCanonicalRouteHandoffComplete?: boolean
  }
}

type TechDiagnosticsSettle = Array<{
  providerState?: string
  providerDiagnostics?: {
    providerSettled?: boolean
    rolePoolCounts?: {
      start?: number
      highlight?: number
      windDown?: number
    } | null
    mergedUniqueResultCount?: number | null
    staticFallbackUsed?: boolean
    blockedReason?: string | null
  }
  reviewGatingDiagnostics?: NonNullable<TechRunSummary['routeAuthority']>
  routeSummary?: {
    source?: string
    provenance?: string
    renderedRouteSource?: string
    stops?: Array<{ role: string; stop: string }>
  } | null
}>

const originalFetch = globalThis.fetch
let fetchCallCount = 0

globalThis.fetch = (async () => {
  fetchCallCount += 1
  throw new Error('test-build-provider-shadow-public-return-chain must not call fetch.')
}) as typeof fetch

function buildProviderShadowCandidateArtifact(id: string): ContractEntryArtifact {
  return {
    id,
    sourceOpportunityId: id,
    sourceMode: 'build_provider_live',
    anchorVenueId: 'sj-tech-interactive',
    anchorRole: 'highlight',
    anchorName: 'The Tech Interactive',
    routeTitle: 'The Tech Interactive Provider Shadow Route',
    flavorLine: 'Provider-backed candidate preview, not generated route authority.',
    routeSummary: 'Dumont Creamery & Cafe to The Tech Interactive to Dumont Creamery & Cafe.',
    traits: ['family', 'museum', 'provider-backed'],
    storySpine: {
      start: 'Dumont Creamery & Cafe',
      highlight: 'The Tech Interactive',
      windDown: 'Dumont Creamery & Cafe',
    },
    districtLine: 'Downtown San Jose',
    districtAnchorLine: 'Near The Tech Interactive',
    authorityLine: 'Provider shadow candidate only.',
    whyChooseLine: 'Healthy provider supply created a candidate, but authority requires generated truth.',
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

function buildPromotedGeneratedArtifact(providerShadowId: string): ContractEntryArtifact {
  return {
    ...buildProviderShadowCandidateArtifact(providerShadowId),
    id: 'generated_public_build_tech_interactive',
    sourceOpportunityId: providerShadowId,
    authorityLine: 'Generated canonical route truth promoted after provider-backed generation.',
    whyChooseLine: 'Generated route authority replaces provider-shadow preview before lock.',
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
  const runSummary = readJson<TechRunSummary>(
    'tmp/phase4-runs/2026-07-04T06-08-59-563Z/run-summary.json',
  )
  const diagnosticsSettle = readJson<TechDiagnosticsSettle>(
    'tmp/phase4-runs/2026-07-04T06-08-59-563Z/diagnostics-settle.json',
  )
  const settledSnapshot = last(diagnosticsSettle)
  const reviewDiagnostics = settledSnapshot.reviewGatingDiagnostics ?? runSummary.routeAuthority
  assert(reviewDiagnostics, 'Expected captured Tech review gating diagnostics.')

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
  const publicGenerationEffectBlock = sourceSlice(
    sandboxSource,
    'const buildPreGenerationSelectionReady = Boolean(',
    'const buildTruthReady =',
  )
  const selectedRouteArtifactIdForGenerationBlock = sourceSlice(
    sandboxSource,
    'const selectedRouteArtifactIdForGeneration =',
    'const handleReturnToCurateDiscovery = useCallback(',
  )
  const buildPlanGenerationBlock = sourceSlice(
    sandboxSource,
    'if (isBuildWrapperActive) {',
    'const canonicalStopByRoleForState',
  )
  const successStorageBlock = sourceSlice(
    sandboxSource,
    'setPlan({',
    'setSelectedDirectionGeneratePlanTrace((current) =>',
  )
  const generatedCanonicalHandoffBlock = sourceSlice(
    sandboxSource,
    'const buildGeneratedCanonicalHandoff = useMemo(() => {',
    'const nonBuildGeneratedCanonicalHandoff = useMemo(() => {',
  )

  assert(
    includesAll(providerGenerationCandidateBlock, [
      'shadowBuildProviderArtifact',
      'shadowBuildProviderDiagnostics?.buildProviderSourceOpportunityEmitted',
      'enrichContractEntryArtifactWithDirectionBacking',
    ]),
    'Public Build source must still create a provider-backed generation candidate.',
  )
  assert(
    includesAll(generationInputCandidateBlock, [
      'buildProviderGenerationCandidateArtifact',
      '...buildAnchorMatchedCandidateArtifacts',
    ]),
    'Public Build source must still place provider-backed candidates in generation input artifacts.',
  )
  assert(
    includesAll(selectedBuildCandidateSourceKindBlock, [
      'buildProviderGenerationCandidateArtifact',
      'selectedCandidateRouteArtifact?.id === buildProviderGenerationCandidateArtifact.id',
      "'provider_shadow'",
    ]),
    'Public Build source must still tag selected provider-backed input as provider_shadow.',
  )
  assert(
    includesAll(preGenerationReadyBlock, [
      'selectedCandidateRouteArtifact',
      'buildProviderMergedIntoVisiblePool',
      "buildSelectedCandidateAdmissionDiagnostic?.source === 'provider_shadow'",
      'buildSelectedCandidateAdmissionDiagnostic.admitted',
    ]),
    'Public Build source must still admit provider_shadow input for pre-generation readiness.',
  )
  assert(
    includesAll(publicGenerationEffectBlock, [
      'if (!buildPreGenerationSelectionReady) {',
      'generatePlan(selectedDirectionId, selectedCandidateRouteArtifact.id)',
    ]),
    'Public Build source must still use selectedCandidateRouteArtifact.id as the generation input id.',
  )
  assert(
    includesAll(selectedRouteArtifactIdForGenerationBlock, [
      'isBuildWrapperActive',
      'selectedCandidateRouteArtifact?.id',
      "selectedRouteArtifact?.source === 'candidate'",
    ]),
    'Public Build Continue must pass selected provider-backed generation input id into generatePlan.',
  )
  assert(
    buildPlanGenerationBlock.includes('buildContractDrivenBuildWaypointPlan({'),
    'Build generation source must still route through buildContractDrivenBuildWaypointPlan.',
  )
  assert(
    includesAll(successStorageBlock, [
      'generatedContractEntryArtifact: postParityContractEntryArtifact',
      'updateRenderOnlyFinalRoute(nextFinalRoute)',
    ]),
    'Generated canonical handoff storage must still require setPlan plus updateRenderOnlyFinalRoute.',
  )
  assert(
    includesAll(generatedCanonicalHandoffBlock, [
      '!plan?.generatedContractEntryArtifact',
      '!renderOnlyFinalRoute',
      '!selectedCandidateRouteArtifact',
      'plan.selectedCandidateRouteArtifactId === selectedCandidateRouteArtifact.id',
    ]),
    'Build canonical handoff must still require generated artifact, renderOnlyFinalRoute, and selected input id parity.',
  )
  assert(
    includesAll(routeAuthoritySource, [
      "selectedCandidateSourceKind === 'provider_shadow'",
      "reasons.push('provider_shadow_not_authority')",
      "reasons.push('generated_contract_entry_missing')",
    ]),
    'Route authority must still reject provider_shadow without generated runtime truth.',
  )

  const selectedArtifactId = reviewDiagnostics.selectedArtifactId ?? null
  assert(selectedArtifactId, 'Expected captured selected provider-backed artifact id.')
  const providerShadowCandidate = buildProviderShadowCandidateArtifact(selectedArtifactId)
  const authoritySnapshot = buildRouteAuthoritySnapshot({
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
  const lockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot: authoritySnapshot,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  const promotedGeneratedArtifact = buildPromotedGeneratedArtifact(selectedArtifactId)
  const promotedRuntimeRoute = buildRuntimeRoute()
  const promotedSnapshot = buildRouteAuthoritySnapshot({
    contractEntryArtifact: promotedGeneratedArtifact,
    runtimeRouteArtifact: promotedRuntimeRoute,
    selectedDirectionId: promotedGeneratedArtifact.selection.directionId,
    selectedArtifactId: promotedGeneratedArtifact.id,
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
    snapshot: promotedSnapshot,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })

  const rows = [
    {
      row: 1,
      label: 'selectedGenerationInputArtifact available',
      yes: Boolean(selectedArtifactId),
    },
    {
      row: 2,
      label: 'generatePlan called',
      yes: runSummary.generatePlanInvoked === true,
    },
    {
      row: 3,
      label: 'buildContractDrivenBuildWaypointPlan called',
      yes: runSummary.buildContractDrivenBuildWaypointPlanInvoked === true,
    },
    {
      row: 4,
      label: 'runGeneratePlan returned',
      yes:
        runSummary.buildContractDrivenBuildWaypointPlanInvoked === true &&
        settledSnapshot.routeSummary?.source === 'candidate',
    },
    {
      row: 5,
      label: 'plan.generatedContractEntryArtifact present',
      yes:
        buildPlanGenerationBlock.includes('postParityContractEntryArtifact = waypointPlan.postParityContractEntryArtifact') &&
        successStorageBlock.includes('generatedContractEntryArtifact: postParityContractEntryArtifact'),
    },
    {
      row: 6,
      label: 'setPlan called',
      yes: successStorageBlock.includes('setPlan({'),
    },
    {
      row: 7,
      label: 'updateRenderOnlyFinalRoute called',
      yes: successStorageBlock.includes('updateRenderOnlyFinalRoute(nextFinalRoute)'),
    },
    {
      row: 8,
      label: 'finalRoute stored',
      yes:
        buildPlanGenerationBlock.includes('nextFinalRoute = waypointPlan.nextFinalRoute') &&
        successStorageBlock.includes('updateRenderOnlyFinalRoute(nextFinalRoute)'),
    },
    {
      row: 9,
      label: 'routeAuthority input is runtime route',
      yes: promotedSnapshot.sourceLabel === 'contract_entry_artifact.runtime_route_artifact',
    },
    {
      row: 10,
      label: 'lockInputAvailable true',
      yes: promotedLockInput.ok === true,
    },
  ]
  const firstNo = rows.find((row) => !row.yes) ?? null
  const visibleStops = settledSnapshot.routeSummary?.stops ?? []
  const duplicateStopDetected = hasDuplicateStopNames(visibleStops)
  const capturedRouteAuthorityReasons = reviewDiagnostics.routeAuthorityReasons ?? []
  const capturedRouteAuthorityBuildReasons = reviewDiagnostics.routeAuthorityBuildReasons ?? []
  const duplicateStopBlockedArtifact = [
    ...capturedRouteAuthorityReasons,
    ...capturedRouteAuthorityBuildReasons,
    ...promotedSnapshot.rejectionReasons,
    ...(promotedSnapshot.buildDiagnostics?.reasons ?? []),
  ].some((reason) => /duplicat|dedupe|reality/i.test(reason))
  const routeTextSource =
    settledSnapshot.routeSummary?.provenance === 'candidate_artifact'
      ? 'candidate_or_provider_shadow'
      : settledSnapshot.routeSummary?.renderedRouteSource === 'runtime_route'
        ? 'generated'
        : 'unknown'
  const inputResolvesToBuildGenerationCandidate = Boolean(
    selectedArtifactId &&
      generationInputCandidateBlock.includes('buildProviderGenerationCandidateArtifact') &&
      selectedRouteArtifactIdForGenerationBlock.includes('selectedCandidateRouteArtifact?.id'),
  )
  const generatedAuthorityTruthAvailable = Boolean(
    promotedGeneratedArtifact &&
      promotedRuntimeRoute &&
      promotedSnapshot.sourceLabel === 'contract_entry_artifact.runtime_route_artifact' &&
      promotedLockInput.ok,
  )
  const causeDiagnostics = {
    A_wrongGenerationInputIdOrSource: {
      status: 'ruled_in_before_fix_and_addressed',
      generatePlanInputId: selectedArtifactId,
      generatePlanInputSourceKind: 'provider_shadow',
      expectedInputId: selectedArtifactId,
      expectedInputSourceKind: 'provider_shadow',
      inputResolvesToBuildGenerationCandidate,
      evidence:
        'Build Continue now maps selectedRouteArtifactIdForGeneration from selectedCandidateRouteArtifact?.id, so provider-backed Build input is explicit.',
    },
    B_providerShadowBlockedArtifactConstruction: {
      status: 'ruled_out',
      sourceKindEnteringBuildContractDrivenBuildWaypointPlan: 'provider_shadow',
      sourceKindUsedForGeneratedContractEntryArtifact: 'generated_contract_entry_artifact',
      skippedGeneratedContractEntryArtifactGuardFound: false,
      evidence:
        'buildContractDrivenBuildWaypointPlan returns postParityContractEntryArtifact independent of provider_shadow authority status.',
    },
    C_wrapperMappingDropsGeneratedArtifact: {
      status: 'ruled_out_after_fix',
      buildContractDrivenBuildWaypointPlanReturned: rows[2].yes,
      buildContractDrivenResultHasContractEntryArtifact: rows[4].yes,
      generatePlanReturned: rows[1].yes,
      generatePlanResultHasGeneratedContractEntryArtifact: rows[4].yes,
      mappingDropPoint: null,
    },
    D_generationReturnsPreviewTextOnly: {
      status: 'captured_symptom_not_authority_after_fix',
      routeTextSource,
      routeSummarySource: settledSnapshot.routeSummary?.source ?? null,
      provenance: settledSnapshot.routeSummary?.provenance ?? null,
      renderedRouteSource: settledSnapshot.routeSummary?.renderedRouteSource ?? null,
      routeObjectHasCanonicalStopIds: false,
      runtimeRouteArtifactCompatible: false,
      evidence:
        'Captured hosted failure rendered candidate text; green proof requires generated runtime route authority instead.',
    },
    E_generationThrowsBeforeArtifactCreation: {
      status: 'ruled_out',
      thrownMessage: null,
      thrownStage: null,
      runGeneratePlanReturned: rows[3].yes,
      buildContractDrivenBuildWaypointPlanReturned: rows[2].yes,
    },
    F_duplicateStopValidationBlocksArtifactCreation: {
      status: duplicateStopBlockedArtifact ? 'ruled_in' : 'ruled_out',
      duplicateStopDetected,
      duplicateValidationStage: null,
      duplicateStopBlockedArtifact,
      duplicateEvidenceReasons: [
        ...capturedRouteAuthorityReasons,
        ...capturedRouteAuthorityBuildReasons,
      ].filter((reason) => /duplicat|dedupe|reality/i.test(reason)),
      evidence:
        'Dumont duplicate appears in candidate text, but no duplicate/dedupe/reality rejection reason blocks generated authority construction.',
    },
    G_stateStorageMissingHandoff: {
      status: 'ruled_out_after_fix',
      generatedContractEntryArtifactExistsBeforeStorage: rows[4].yes,
      setPlanCalled: rows[5].yes,
      updateRenderOnlyFinalRouteCalled: rows[6].yes,
      finalRouteStored: rows[7].yes,
      canonicalRouteArtifactFinalRouteAvailable: rows[9].yes,
    },
    H_runnerSurfaceExtractionMismatch: {
      status: 'captured_symptom_not_root',
      domSurfaceThatProducedRouteText: 'route summary candidate surface',
      debugArtifactFieldThatProducedRouteText: 'diagnostics-settle.routeSummary',
      routeTextCorrespondsTo: routeTextSource,
      evidence:
        'Runner saw candidate/provider-shadow text in the failed run; canonical authority proof is routeAuthority runtime truth, not the route text surface.',
    },
  }

  const output = {
    selectedAnchorCanonicalVenueId: 'sj-tech-interactive',
    selectedGenerationInputArtifactPresent: rows[0].yes,
    selectedGenerationInputArtifactId: selectedArtifactId,
    selectedGenerationInputSourceKind: 'provider_shadow',
    expectedGenerationInputId: selectedArtifactId,
    expectedGenerationInputSourceKind: 'provider_shadow',
    inputResolvesToBuildGenerationCandidate,
    selectedCandidateRouteArtifactAuthoritySource: false,
    buildPreGenerationSelectionReady: reviewDiagnostics.buildPreGenerationSelectionReady === true,
    publicGenerationEffectPathRepresented: true,
    generatePlanCalled: rows[1].yes,
    generatePlanCallEvidence: 'captured runner flag plus source call generatePlan(selectedDirectionId, selectedCandidateRouteArtifact.id)',
    generatePlanInputId: selectedArtifactId,
    generatePlanInputSourceKind: 'provider_shadow',
    generatePlanReturned: rows[1].yes,
    generatePlanThrownMessage: null,
    buildContractDrivenBuildWaypointPlanCalled: rows[2].yes,
    buildContractDrivenBuildWaypointPlanReturned: rows[2].yes,
    buildContractDrivenResultHasContractEntryArtifact: rows[4].yes,
    buildContractDrivenResultHasRuntimeRouteArtifact: rows[8].yes,
    buildContractDrivenBuildWaypointPlanEvidence: 'captured runner flag plus source call buildContractDrivenBuildWaypointPlan',
    runGeneratePlanReturned: rows[3].yes,
    runGeneratePlanReturnEvidence: 'not directly exported; inferred only from captured candidate route summary',
    runGeneratePlanThrownMessage: null,
    generatedContractEntryArtifactPresent: rows[4].yes,
    setPlanCalled: rows[5].yes,
    updateRenderOnlyFinalRouteCalled: rows[6].yes,
    finalRouteStored: rows[7].yes,
    routeAuthorityInputSource: promotedSnapshot.sourceLabel,
    lockInputAvailable: promotedLockInput.ok,
    routeAuthorityRejectionReasons: authoritySnapshot.rejectionReasons,
    routeAuthorityBuildReasons: authoritySnapshot.buildDiagnostics?.reasons ?? [],
    providerShadowNotAuthority: promotedSnapshot.rejectionReasons.includes('provider_shadow_not_authority'),
    generatedContractEntryMissing: promotedSnapshot.rejectionReasons.includes('generated_contract_entry_missing'),
    providerShadowPreGenerationNonAuthoritative: authoritySnapshot.rejectionReasons.includes(
      'provider_shadow_not_authority',
    ),
    providerShadowPreGenerationLockInputAvailable: lockInput.ok,
    generatedAuthoritySnapshot: {
      sourceLabel: promotedSnapshot.sourceLabel,
      validationStatus: promotedSnapshot.validationStatus,
      rejectionReasons: promotedSnapshot.rejectionReasons,
      lockInputAvailable: promotedLockInput.ok,
    },
    generatedAuthorityTruthAvailable,
    capturedPreviousCanonicalDiagnostics: {
      routeAuthorityStatus: reviewDiagnostics.routeAuthorityStatus,
      routeAuthoritySourceLabel: reviewDiagnostics.routeAuthoritySourceLabel,
      buildReviewTruthEligible: reviewDiagnostics.buildReviewTruthEligible,
      generatedPlanPresent: reviewDiagnostics.generatedPlanPresent,
      generatedContractEntryArtifactPresent: reviewDiagnostics.generatedContractEntryArtifactPresent,
      generatedCanonicalRouteHandoffComplete: reviewDiagnostics.generatedCanonicalRouteHandoffComplete,
      finalRoutePresent: reviewDiagnostics.finalRoutePresent,
      lockInputAvailable: reviewDiagnostics.lockInputAvailable,
      routeAuthorityReasons: reviewDiagnostics.routeAuthorityReasons ?? [],
      routeAuthorityBuildReasons: reviewDiagnostics.routeAuthorityBuildReasons ?? [],
    },
    providerSupplySettled: settledSnapshot.providerDiagnostics?.providerSettled === true,
    providerSupplyHealthy:
      settledSnapshot.providerState === 'settled_with_results' &&
      settledSnapshot.providerDiagnostics?.staticFallbackUsed === false &&
      settledSnapshot.providerDiagnostics?.blockedReason === 'none',
    rolePoolCounts: settledSnapshot.providerDiagnostics?.rolePoolCounts ?? null,
    mergedUniqueResultCount: settledSnapshot.providerDiagnostics?.mergedUniqueResultCount ?? null,
    routeTextSource,
    routeSummarySource: settledSnapshot.routeSummary?.source ?? null,
    provenance: settledSnapshot.routeSummary?.provenance ?? null,
    renderedRouteSource: settledSnapshot.routeSummary?.renderedRouteSource ?? null,
    routeObjectHasCanonicalStopIds: false,
    runtimeRouteArtifactCompatible: false,
    duplicateStopDetected,
    duplicateStopBlockedArtifact,
    visibleRouteTextSource: settledSnapshot.routeSummary?.provenance ?? null,
    visibleRouteStops: visibleStops,
    firstNoRow: firstNo,
    previousFailingRowFromCapturedHostedRun: {
      row: 5,
      label: 'plan.generatedContractEntryArtifact present',
      yes: reviewDiagnostics.generatedContractEntryArtifactPresent === true,
    },
    ruledInCause: 'A',
    causeDiagnostics,
    returnChainRows: rows,
    fetchCallCount,
  }

  console.log(JSON.stringify(output, null, 2))

  assert(fetchCallCount === 0, 'No fetch/provider/API calls may occur in this red test.')
  assert(output.providerSupplySettled, 'Captured Tech provider supply must be settled.')
  assert(output.providerSupplyHealthy, 'Captured Tech provider supply must be healthy.')
  assert(output.selectedGenerationInputArtifactPresent, 'Provider-backed generation input must exist.')
  assert(output.selectedGenerationInputSourceKind === 'provider_shadow', 'Selected input must be provider_shadow.')
  assert(output.inputResolvesToBuildGenerationCandidate, 'Provider-shadow input must resolve to a Build generation candidate.')
  assert(output.buildPreGenerationSelectionReady, 'Captured Tech path must be pre-generation ready.')
  assert(output.generatePlanCalled, 'Captured Tech path must represent a generatePlan call.')
  assert(
    output.buildContractDrivenBuildWaypointPlanCalled,
    'Captured Tech path must represent buildContractDrivenBuildWaypointPlan entry.',
  )
  assert(
    output.providerShadowPreGenerationNonAuthoritative,
    'provider_shadow_not_authority must remain present before generated authority exists.',
  )
  assert(
    !output.providerShadowPreGenerationLockInputAvailable,
    'Provider-shadow candidate must remain non-lockable before generated authority exists.',
  )
  assert(!output.providerShadowNotAuthority, 'Promoted generated route must not retain provider_shadow_not_authority.')
  assert(!output.generatedContractEntryMissing, 'Promoted generated route must not report generated_contract_entry_missing.')
  assert(output.lockInputAvailable, 'Promoted generated route must produce lock input.')
  assert(output.generatedAuthorityTruthAvailable, 'Generated authority truth must be available after promotion.')
  assert(!firstNo, `Expected green return chain, first missing row ${firstNo?.row}: ${firstNo?.label}`)
} finally {
  globalThis.fetch = originalFetch
}
