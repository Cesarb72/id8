import { starterPacks } from '../src/data/starterPacks.ts'
import { buildCuratePublicCardGateDiagnostics } from '../src/app/services/curate/buildCuratePublicCardGateDiagnostics.ts'
import { buildCurateScenarioCardGateDiagnostics } from '../src/app/services/curate/buildCurateScenarioCardGateDiagnostics.ts'
import { buildCuratePreviewCommitabilityCacheKey } from '../src/app/services/curate/curatePreviewCommitabilityCache.ts'
import {
  PUBLIC_CURATE_CARD_TRUTH_MINIMUM_LOAD_BEARING_SOURCE_COUNT,
  PUBLIC_CURATE_CARD_TRUTH_RENDER_MIGRATED,
  buildPublicCurateCardTruthModel,
  buildPublicCurateCandidateConstructionDiagnostics,
  classifyArcadeAndDrinksCandidateState,
  parsePublicCurateRouteStops,
  validatePublicCurateStarterFit,
  type PublicCurateCandidateConstructionDiagnostics,
} from '../src/app/services/curate/publicCurateCardTruthService.ts'
import { FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY } from '../src/domain/field/corpus/fieldStaticProviderCorpusConfig.ts'
import { sanJoseProviderCorpusVenues } from '../src/domain/field/corpus/sanJoseProviderCorpus.ts'
import type { StarterPack } from '../src/domain/types/starterPack.ts'

const targetStarterIds = [
  'dessert-conversation',
  'coffee-books',
  'hidden-cocktail-corners',
  'arcade-and-drinks',
  'street-food-adventure',
  'wine-slow-evening',
  'live-music-loop',
] as const

const hostedFallbackStarterIds = new Set<string>([
  'hidden-cocktail-corners',
  'arcade-and-drinks',
  'live-music-loop',
])
const publicCurateCommittedRouteFallbackEnabled: boolean = false
const staleHostedRouteStops = [
  'start:Nirvana Soul',
  'highlight:Adega Wine Atelier',
  'windDown:Jtown Manju House',
] as const
const liveMusicLoopKnownMismatchStops = [
  'start:Riverwalk Boardgame Cafe',
  'highlight:Adega Wine Atelier',
  'windDown:Orchard Artisan Gelato',
] as const

type TargetStarterId = (typeof targetStarterIds)[number]

const originalFetch = globalThis.fetch
const originalFlagValue = process.env[FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY]
const originalSourceMode = process.env.VITE_ID8_SOURCE_MODE
const originalGoogleKey = process.env.VITE_GOOGLE_PLACES_API_KEY
const originalGoogleServerKey = process.env.GOOGLE_PLACES_API_KEY
const originalProviderKey = process.env.VITE_PROVIDER_API_KEY
let fetchCallCount = 0

const fetchTrap: typeof fetch = async () => {
  fetchCallCount += 1
  throw new Error('Curate public card gate diagnostics must not call fetch.')
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function setEnv(): void {
  globalThis.fetch = fetchTrap
  process.env[FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY] = '1'
  process.env.VITE_ID8_SOURCE_MODE = 'curated'
  delete process.env.VITE_GOOGLE_PLACES_API_KEY
  delete process.env.GOOGLE_PLACES_API_KEY
  delete process.env.VITE_PROVIDER_API_KEY
}

function restoreEnv(): void {
  globalThis.fetch = originalFetch

  if (originalFlagValue === undefined) {
    delete process.env[FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY]
  } else {
    process.env[FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY] = originalFlagValue
  }

  if (originalSourceMode === undefined) {
    delete process.env.VITE_ID8_SOURCE_MODE
  } else {
    process.env.VITE_ID8_SOURCE_MODE = originalSourceMode
  }

  if (originalGoogleKey === undefined) {
    delete process.env.VITE_GOOGLE_PLACES_API_KEY
  } else {
    process.env.VITE_GOOGLE_PLACES_API_KEY = originalGoogleKey
  }

  if (originalGoogleServerKey === undefined) {
    delete process.env.GOOGLE_PLACES_API_KEY
  } else {
    process.env.GOOGLE_PLACES_API_KEY = originalGoogleServerKey
  }

  if (originalProviderKey === undefined) {
    delete process.env.VITE_PROVIDER_API_KEY
  } else {
    process.env.VITE_PROVIDER_API_KEY = originalProviderKey
  }
}

function findStarterPack(id: TargetStarterId): StarterPack {
  const starterPack = starterPacks.find((candidate) => candidate.id === id)
  if (!starterPack) {
    throw new Error(`Missing starter pack: ${id}`)
  }
  return starterPack
}

function assertStarterScopedCacheIsolation(): void {
  const artifactId = 'step2_scenario_built_friends_cultured_1'
  const previousStarterId = 'wine-slow-evening'
  const nextStarterId = 'live-music-loop'
  const previousKey = buildCuratePreviewCommitabilityCacheKey({
    starterPackId: previousStarterId,
    artifactId,
  })
  const nextKey = buildCuratePreviewCommitabilityCacheKey({
    starterPackId: nextStarterId,
    artifactId,
  })
  const cache = {
    [previousKey]: {
      approvedFinalRouteStops: [...staleHostedRouteStops],
    },
  }
  assert(previousKey !== nextKey, 'Starter-scoped commitability keys must differ.')
  assert(
    cache[nextKey as keyof typeof cache] == null,
    'A starter switch must not find an approved payload under the next starter key.',
  )
}

function hasExactStaleHostedRoute(stops: readonly string[]): boolean {
  return staleHostedRouteStops.every((stop) => stops.includes(stop))
}

function buildArcadeCorpusCandidateSummaries() {
  return sanJoseProviderCorpusVenues
    .filter((candidate) => candidate.support.starters.includes('arcade-drinks'))
    .map((candidate) => ({
      name: candidate.venue.name,
      category: candidate.venue.category,
      supportRoles: [...candidate.support.roles],
      warmupAffinity: candidate.venue.roleAffinity?.warmup ?? null,
      peakAffinity: candidate.venue.roleAffinity?.peak ?? null,
      status: candidate.qualityGateStatus,
    }))
}

async function main(): Promise<void> {
  setEnv()
  assertStarterScopedCacheIsolation()
  const rows = []
  const serviceProbeRows = []
  const serviceCandidateDiagnosticsByStarter = new Map<
    TargetStarterId,
    PublicCurateCandidateConstructionDiagnostics
  >()
  let arcadeClassification:
    | ReturnType<typeof classifyArcadeAndDrinksCandidateState>
    | null = null

  for (const starterId of targetStarterIds) {
    const starterPack = findStarterPack(starterId)
    const directDiagnostics = await buildCuratePublicCardGateDiagnostics({
      starterPack,
      fetchCallCount: () => fetchCallCount,
    })
    const scenarioDiagnostics = await buildCurateScenarioCardGateDiagnostics({
      starterPack,
      fetchCallCount: () => fetchCallCount,
    })

    const diagnosticsByMode = [
      {
        mode: 'direct_planner_projection',
        diagnostics: directDiagnostics,
        scenario: null,
      },
      {
        mode: 'scenario_artifact_path',
        diagnostics: scenarioDiagnostics,
        scenario: scenarioDiagnostics,
      },
    ] as const

    for (const { mode, diagnostics, scenario } of diagnosticsByMode) {
      const serviceRouteStops = parsePublicCurateRouteStops(
        scenario?.scenarioArtifactRouteStops ?? diagnostics.directPlannerRouteStops,
      )
      const selectedArtifactId = scenario?.selectedArtifactId ?? null
      const serviceCandidateDiagnostics = buildPublicCurateCandidateConstructionDiagnostics({
        selectedStarterPack: starterPack,
        cacheKeyScope: `${starterId}:service-candidate-diagnostics`,
        candidates: serviceRouteStops.length > 0
          ? [
              {
                artifactId: selectedArtifactId,
                routeStops: serviceRouteStops,
                sourceMode: diagnostics.sourceMode.effectiveMode,
                qualification: {
                  status: diagnostics.selectedCuratePreviewCommitability.status,
                  hasApprovedPayload: diagnostics.hasApprovedPayload,
                },
              },
            ]
          : [],
        sourceMode: diagnostics.sourceMode.effectiveMode,
        fetchCallCount,
        committedRouteFallbackRenderEnabled: publicCurateCommittedRouteFallbackEnabled,
      })
      if (mode === 'direct_planner_projection') {
        serviceCandidateDiagnosticsByStarter.set(starterId, serviceCandidateDiagnostics)
      }
      if (starterId === 'arcade-and-drinks' && mode === 'direct_planner_projection') {
        arcadeClassification = classifyArcadeAndDrinksCandidateState({
          generatedRouteStops: serviceRouteStops,
          corpusCandidates: buildArcadeCorpusCandidateSummaries(),
        })
      }
      const serviceModel = buildPublicCurateCardTruthModel({
        selectedStarterPack: starterPack,
        cacheKeyScope: `${starterId}:diagnostic`,
        routeStops: serviceRouteStops,
        selectedArtifactId,
        qualificationByArtifactId: selectedArtifactId
          ? {
              [selectedArtifactId]: {
                status: diagnostics.selectedCuratePreviewCommitability.status,
                hasApprovedPayload: diagnostics.hasApprovedPayload,
              },
            }
          : {},
        committedRouteFallbackRenderEnabled: publicCurateCommittedRouteFallbackEnabled,
        currentPageRender: {
          wouldRenderCard: diagnostics.qualifiedVisibleCardCount > 0,
          primaryCardDisplayMode: diagnostics.primaryCardDisplayMode,
          selectedArtifactId,
        },
      })
      assert(
        diagnostics.publicCardGateReached,
        `${starterId} ${mode}: card gate diagnostics must run.`,
      )
    assert(
      diagnostics.directPlannerGenerated,
        `${starterId} ${mode}: direct planner must still generate.`,
    )
    assert(
      diagnostics.sourceMode.requestedMode === 'curated',
        `${starterId} ${mode}: requested source mode must remain curated.`,
    )
    assert(
      diagnostics.sourceMode.effectiveMode === 'curated',
        `${starterId} ${mode}: effective source mode must remain curated.`,
    )
    assert(
      diagnostics.sourceMode.liveFetchAttempted === false,
        `${starterId} ${mode}: live fetch must not be attempted.`,
    )
    assert(
      diagnostics.sourceMode.liveCount === 0,
        `${starterId} ${mode}: live source count must remain zero.`,
    )
    assert(
      diagnostics.cardArtifactCandidateCount >= 0,
        `${starterId} ${mode}: card artifact candidate count must be present.`,
    )
    assert(
      diagnostics.qualificationCandidateCount >= 0,
        `${starterId} ${mode}: qualification candidate count must be present.`,
    )
    assert(
      diagnostics.qualifiedVisibleCardCount >= 0,
        `${starterId} ${mode}: qualified visible card count must be present.`,
    )
    assert(
      diagnostics.rejectedVisibleCardCount >= 0,
      `${starterId} ${mode}: rejected visible card count must be present.`,
    )
    const committedRouteFallbackRenderable =
      publicCurateCommittedRouteFallbackEnabled &&
      diagnostics.committedRouteFallback.status === 'accepted'
    assert(
      committedRouteFallbackRenderable === false,
      `${starterId} ${mode}: committed direct-route fallback must not be public-renderable.`,
    )
    assert(
      serviceModel.diagnostics.serviceTruthSourceCount ===
        PUBLIC_CURATE_CARD_TRUTH_MINIMUM_LOAD_BEARING_SOURCE_COUNT,
      `${starterId} ${mode}: service truth source count must be the minimum load-bearing target.`,
    )
    assert(
      serviceModel.diagnostics.publicRenderMigrated === true &&
        PUBLIC_CURATE_CARD_TRUTH_RENDER_MIGRATED === true,
      `${starterId} ${mode}: public render must be migrated to ContractEntryArtifact truth.`,
    )
    assert(
      serviceModel.diagnostics.committedRouteFallbackRenderEnabled === false,
      `${starterId} ${mode}: committed fallback render flag must remain false.`,
    )
    assert(
      serviceModel.diagnostics.committedRouteFallbackRenderEligible === false,
      `${starterId} ${mode}: committed fallback must not be service-render-eligible.`,
    )
    assert(
      serviceCandidateDiagnostics.starterPackId === starterId,
      `${starterId} ${mode}: service candidate diagnostics must report the current starter id.`,
    )
    assert(
      serviceCandidateDiagnostics.cacheKeyScope?.includes(starterId) === true,
      `${starterId} ${mode}: service candidate cache key scope must include the selected starter.`,
    )
    assert(
      serviceCandidateDiagnostics.publicRenderMigrated === true &&
        serviceCandidateDiagnostics.pageRenderMigrated === false,
      `${starterId} ${mode}: service candidate diagnostics must report artifact render migration without page-local authorship.`,
    )
    assert(
      serviceCandidateDiagnostics.fetchCallCount === fetchCallCount,
      `${starterId} ${mode}: service candidate diagnostics must carry fetch count.`,
    )
    assert(
      serviceCandidateDiagnostics.candidates.every(
        (candidate) => candidate.starterPackId === starterId,
      ),
      `${starterId} ${mode}: every service candidate must be starter-scoped.`,
    )
    if (starterId === 'arcade-and-drinks') {
      assert(
        serviceModel.visibleCards.length === 0 && serviceModel.selectedCard === null,
        `${starterId} ${mode}: service must not render incomplete arcade route.`,
      )
      assert(
        serviceCandidateDiagnostics.rejectionReasons.includes('missing_required_role'),
        `${starterId} ${mode}: service candidate diagnostics must classify arcade as missing_required_role.`,
      )
    }
    if (starterId === 'arcade-and-drinks') {
      assert(
        diagnostics.committedRouteFallback.status === 'rejected',
        `${starterId} ${mode}: committed direct-route fallback must remain rejected.`,
      )
      assert(
        diagnostics.committedRouteFallback.rejectedReason === 'missing_start_role',
        `${starterId} ${mode}: committed direct-route fallback must reject missing start role.`,
      )
    }
    if (hostedFallbackStarterIds.has(starterId)) {
      assert(
        !hasExactStaleHostedRoute(diagnostics.directPlannerRouteStops),
        `${starterId} ${mode}: direct planner route must not be the stale Adega/Nirvana/Jtown route.`,
      )
      assert(
        committedRouteFallbackRenderable === false,
        `${starterId} ${mode}: hosted fallback route must not be public-renderable.`,
      )
    }
    if (
      scenario &&
      scenario.qualifiedVisibleCardCount > 0 &&
      !hostedFallbackStarterIds.has(starterId)
    ) {
      assert(
        scenario.primaryCardDisplayMode === 'qualified_only',
        `${starterId} ${mode}: scenario-approved cards must remain primary.`,
      )
    }

    rows.push({
        mode,
      starterId: diagnostics.starterId,
        artifactSource:
          scenario?.artifactSource ?? diagnostics.extractionBoundary.artifactSource,
      hostedFallbackObserved: hostedFallbackStarterIds.has(starterId),
      publicCardGateReached: diagnostics.publicCardGateReached,
      directPlannerGenerated: diagnostics.directPlannerGenerated,
      directPlannerRouteStops: diagnostics.directPlannerRouteStops,
        scenarioArtifactRouteStops: scenario?.scenarioArtifactRouteStops ?? null,
        scenarioArtifactCount: scenario?.scenarioArtifactCount ?? null,
        displayArtifactCount: scenario?.displayArtifactCount ?? null,
      cardArtifactCandidateCount: diagnostics.cardArtifactCandidateCount,
      qualificationCandidateCount: diagnostics.qualificationCandidateCount,
      qualifiedVisibleCardCount: diagnostics.qualifiedVisibleCardCount,
      rejectedVisibleCardCount: diagnostics.rejectedVisibleCardCount,
      primaryCardDisplayMode: diagnostics.primaryCardDisplayMode,
      hasApprovedPayload: diagnostics.hasApprovedPayload,
      selectedCuratePreviewCommitabilityStatus:
        diagnostics.selectedCuratePreviewCommitability.status,
      hardCommitCandidateCount:
        diagnostics.selectedCuratePreviewCommitability.hardCommitCandidateCount,
      missingRoleForContract:
        diagnostics.selectedCuratePreviewCommitability.missingRoleForContract,
      failedCheck: diagnostics.selectedCuratePreviewCommitability.failedCheck,
      failedReason: diagnostics.selectedCuratePreviewCommitability.failedReason,
      selectedArtifactId: scenario?.selectedArtifactId ?? null,
      committedRouteFallback: diagnostics.committedRouteFallback,
      committedRouteFallbackRenderEnabled: publicCurateCommittedRouteFallbackEnabled,
      committedRouteFallbackRenderable,
      publicCurateCardTruthService: {
        serviceTruthSourceCount: serviceModel.diagnostics.serviceTruthSourceCount,
        starterPackId: serviceModel.starterPackId,
        cardTruthStatus: serviceModel.diagnostics.cardTruthStatus,
        starterFitStatus: serviceModel.diagnostics.starterFitStatus,
        rejectionReasons: serviceModel.diagnostics.rejectionReasons,
        routeStops: serviceModel.diagnostics.routeStops.map(
          (stop) => `${stop.role}:${stop.name}`,
        ),
        allowedToRender: serviceModel.diagnostics.allowedToRender,
        pageCurrentlyWouldRenderSomethingElse:
          serviceModel.diagnostics.pageCurrentlyWouldRenderSomethingElse,
        publicRenderMigrated: serviceModel.diagnostics.publicRenderMigrated,
      },
      publicCurateServiceCandidateDiagnostics: {
        starterPackId: serviceCandidateDiagnostics.starterPackId,
        serviceTruthSourceCount: serviceCandidateDiagnostics.serviceTruthSourceCount,
        publicRenderMigrated: serviceCandidateDiagnostics.publicRenderMigrated,
        pageRenderMigrated: serviceCandidateDiagnostics.pageRenderMigrated,
        candidateCount: serviceCandidateDiagnostics.candidateCount,
        candidateArtifactIds: serviceCandidateDiagnostics.candidateArtifactIds,
        routeStops: serviceCandidateDiagnostics.routeStops.map(
          (stop) => `${stop.role}:${stop.name}`,
        ),
        roleCoverage: serviceCandidateDiagnostics.roleCoverage,
        starterFitStatus: serviceCandidateDiagnostics.starterFitStatus,
        rejectionReasons: serviceCandidateDiagnostics.rejectionReasons,
        cacheKeyScope: serviceCandidateDiagnostics.cacheKeyScope,
        sourceMode: serviceCandidateDiagnostics.sourceMode,
        fetchCallCount: serviceCandidateDiagnostics.fetchCallCount,
        allowedToRender: serviceCandidateDiagnostics.allowedToRender,
      },
      noQualifiedFallback: diagnostics.noQualifiedFallback,
      selectedInfeasible: diagnostics.selectedInfeasible,
      sourceMode: diagnostics.sourceMode,
      fetchCallCount: diagnostics.fetchCallCount,
        scenarioPath: scenario?.scenarioPath ?? null,
      extractionBoundary: diagnostics.extractionBoundary,
    })
    }
  }

  const starterADiagnostics = serviceCandidateDiagnosticsByStarter.get('hidden-cocktail-corners')
  const starterBDiagnostics = serviceCandidateDiagnosticsByStarter.get('live-music-loop')
  assert(starterADiagnostics, 'Cross-starter diagnostics must include Starter A.')
  assert(starterBDiagnostics, 'Cross-starter diagnostics must include Starter B.')
  assert(
    starterADiagnostics.starterPackId !== starterBDiagnostics.starterPackId,
    'Cross-starter diagnostics must report different starter ids.',
  )
  assert(
    starterADiagnostics.cacheKeyScope?.includes(starterADiagnostics.starterPackId ?? '') === true,
    'Starter A cache scope must include Starter A id.',
  )
  assert(
    starterBDiagnostics.cacheKeyScope?.includes(starterBDiagnostics.starterPackId ?? '') === true,
    'Starter B cache scope must include Starter B id.',
  )
  const starterASelectedArtifactId = starterADiagnostics.selectedCandidateArtifactId
  const starterBCandidateIds = new Set(starterBDiagnostics.candidateArtifactIds)
  assert(
    !starterASelectedArtifactId || !starterBCandidateIds.has(starterASelectedArtifactId),
    'Starter A selected artifact must not be selected under Starter B.',
  )
  assert(
    starterADiagnostics.candidateArtifactIds.every((artifactId) =>
      artifactId.includes(starterADiagnostics.starterPackId ?? ''),
    ),
    'Starter A diagnostic artifact ids must be explicitly starter-scoped.',
  )
  assert(
    starterBDiagnostics.candidateArtifactIds.every((artifactId) =>
      artifactId.includes(starterBDiagnostics.starterPackId ?? ''),
    ),
    'Starter B diagnostic artifact ids must be explicitly starter-scoped.',
  )
  const previousStarterApprovedPayloadProbe = buildPublicCurateCardTruthModel({
    selectedStarterPack: findStarterPack('live-music-loop'),
    cacheKeyScope: 'live-music-loop:previous-starter-approved-payload-probe',
    routeStops: starterADiagnostics.routeStops,
    approvedRefinementEntryPayload: {
      starterPackId: 'hidden-cocktail-corners',
      artifactId: starterASelectedArtifactId,
    },
    committedRouteFallbackRenderEnabled: publicCurateCommittedRouteFallbackEnabled,
  })
  assert(
    previousStarterApprovedPayloadProbe.diagnostics.allowedToRender === false,
    'Previous-starter approved payload must not pass current-starter service validation.',
  )
  assert(
    previousStarterApprovedPayloadProbe.diagnostics.cardTruthStatus === 'no_candidate',
    'Previous-starter approved payload probe must be blocked before public render without an artifact.',
  )
  const previousStarterApprovedPayloadFit = validatePublicCurateStarterFit({
    selectedStarterPack: findStarterPack('live-music-loop'),
    routeStops: starterADiagnostics.routeStops,
    approvedRefinementEntryPayload: {
      starterPackId: 'hidden-cocktail-corners',
      artifactId: starterASelectedArtifactId,
    },
  })
  assert(
    previousStarterApprovedPayloadFit.rejectionReasons.includes('approved_payload_starter_mismatch'),
    'Previous-starter approved payload fit must reject with approved_payload_starter_mismatch.',
  )
  assert(arcadeClassification, 'Arcade classification must be produced.')
  assert(
    arcadeClassification.classification === 'mixed' ||
      arcadeClassification.classification === 'route-shape/planner gap',
    'Arcade must classify as mixed or route-shape/planner gap.',
  )
  assert(
    arcadeClassification.generatedRouteMissingStart === true,
    'Arcade classification must identify the missing start role.',
  )
  assert(
    arcadeClassification.supportedCandidateCount > 0,
    'Arcade classification must report supported Field corpus candidates.',
  )
  assert(
    arcadeClassification.highlightOrSupportCandidateCount > 0,
    'Arcade classification must report highlight/support candidates.',
  )

  const liveMusicMismatchProbe = buildPublicCurateCardTruthModel({
    selectedStarterPack: findStarterPack('live-music-loop'),
    cacheKeyScope: 'live-music-loop:known-mismatch-probe',
    routeStops: parsePublicCurateRouteStops(liveMusicLoopKnownMismatchStops),
    committedRouteFallbackRenderEnabled: publicCurateCommittedRouteFallbackEnabled,
    currentPageRender: {
      wouldRenderCard: true,
      primaryCardDisplayMode: 'qualified_only',
    },
  })
  assert(
    liveMusicMismatchProbe.diagnostics.allowedToRender === false,
    'live-music-loop known mismatch probe must not be allowed to render.',
  )
  assert(
    liveMusicMismatchProbe.diagnostics.cardTruthStatus === 'no_candidate',
    'live-music-loop known mismatch public model must be blocked before render without an artifact.',
  )
  const liveMusicMismatchFit = validatePublicCurateStarterFit({
    selectedStarterPack: findStarterPack('live-music-loop'),
    routeStops: parsePublicCurateRouteStops(liveMusicLoopKnownMismatchStops),
  })
  assert(
    liveMusicMismatchFit.rejectionReasons.includes('card_promise_mismatch') ||
      liveMusicMismatchFit.rejectionReasons.includes('category_family_mismatch'),
    'live-music-loop known mismatch fit must reject card-promise or category-family mismatch.',
  )
  serviceProbeRows.push({
    probe: 'live-music-loop-known-mismatch',
    routeStops: liveMusicLoopKnownMismatchStops,
    cardTruthStatus: liveMusicMismatchProbe.diagnostics.cardTruthStatus,
    starterFitStatus: liveMusicMismatchProbe.diagnostics.starterFitStatus,
    rejectionReasons: liveMusicMismatchProbe.diagnostics.rejectionReasons,
    allowedToRender: liveMusicMismatchProbe.diagnostics.allowedToRender,
    publicRenderMigrated: liveMusicMismatchProbe.diagnostics.publicRenderMigrated,
  })
  serviceProbeRows.push({
    probe: 'cross-starter-hidden-cocktail-to-live-music',
    starterA: {
      starterPackId: starterADiagnostics.starterPackId,
      cacheKeyScope: starterADiagnostics.cacheKeyScope,
      selectedCandidateArtifactId: starterADiagnostics.selectedCandidateArtifactId,
      candidateArtifactIds: starterADiagnostics.candidateArtifactIds,
    },
    starterB: {
      starterPackId: starterBDiagnostics.starterPackId,
      cacheKeyScope: starterBDiagnostics.cacheKeyScope,
      selectedCandidateArtifactId: starterBDiagnostics.selectedCandidateArtifactId,
      candidateArtifactIds: starterBDiagnostics.candidateArtifactIds,
    },
    previousStarterPayloadRejected:
      previousStarterApprovedPayloadProbe.diagnostics.rejectionReasons,
    fetchCallCount,
  })
  serviceProbeRows.push({
    probe: 'arcade-and-drinks-classification',
    classification: arcadeClassification.classification,
    evidence: arcadeClassification.evidence,
    supportedCandidateCount: arcadeClassification.supportedCandidateCount,
    startRoleCandidateCount: arcadeClassification.startRoleCandidateCount,
    highlightOrSupportCandidateCount: arcadeClassification.highlightOrSupportCandidateCount,
    generatedRouteMissingStart: arcadeClassification.generatedRouteMissingStart,
  })

  assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)

  process.stdout.write('curate public card gate diagnostics: passed\n')
  process.stdout.write(
    `${JSON.stringify(
      {
        fetchCallCount,
        starterScopedCacheIsolation: 'passed',
        targetStarterIds,
        rootCauseClassification:
          'E. public truth gate/card boundary disables committed route fallback as public render truth',
        serviceTruthSourceCount: PUBLIC_CURATE_CARD_TRUTH_MINIMUM_LOAD_BEARING_SOURCE_COUNT,
        publicRenderMigrated: PUBLIC_CURATE_CARD_TRUTH_RENDER_MIGRATED,
        serviceProbeRows,
        rows,
      },
      null,
      2,
    )}\n`,
  )
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
  .finally(() => {
    restoreEnv()
  })
