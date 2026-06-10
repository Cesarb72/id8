import { starterPacks } from '../src/data/starterPacks.ts'
import { buildCuratePublicCardGateDiagnostics } from '../src/app/services/curate/buildCuratePublicCardGateDiagnostics.ts'
import { buildCurateScenarioCardGateDiagnostics } from '../src/app/services/curate/buildCurateScenarioCardGateDiagnostics.ts'
import { FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY } from '../src/domain/field/corpus/fieldStaticProviderCorpusConfig.ts'
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
const committedFallbackAcceptedStarterIds = new Set<string>([
  'hidden-cocktail-corners',
  'live-music-loop',
])

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

async function main(): Promise<void> {
  setEnv()
  const rows = []

  for (const starterId of targetStarterIds) {
    const directDiagnostics = await buildCuratePublicCardGateDiagnostics({
      starterPack: findStarterPack(starterId),
      fetchCallCount: () => fetchCallCount,
    })
    const scenarioDiagnostics = await buildCurateScenarioCardGateDiagnostics({
      starterPack: findStarterPack(starterId),
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
    if (committedFallbackAcceptedStarterIds.has(starterId)) {
      assert(
        diagnostics.committedRouteFallback.status === 'accepted',
        `${starterId} ${mode}: committed direct-route fallback must be accepted.`,
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
      noQualifiedFallback: diagnostics.noQualifiedFallback,
      selectedInfeasible: diagnostics.selectedInfeasible,
      sourceMode: diagnostics.sourceMode,
      fetchCallCount: diagnostics.fetchCallCount,
        scenarioPath: scenario?.scenarioPath ?? null,
      extractionBoundary: diagnostics.extractionBoundary,
    })
    }
  }

  assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)

  process.stdout.write('curate public card gate diagnostics: passed\n')
  process.stdout.write(
    `${JSON.stringify(
      {
        fetchCallCount,
        targetStarterIds,
        rootCauseClassification:
          'E. public truth gate/card boundary hides committed route when scenario artifacts produce no qualified card',
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
