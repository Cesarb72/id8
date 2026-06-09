import { execFileSync } from 'node:child_process'
import { starterPacks } from '../src/data/starterPacks.ts'
import { buildCurateFailedStarterDiagnostics } from '../src/domain/diagnostics/buildCurateFailedStarterDiagnostics.ts'
import { FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY } from '../src/domain/field/corpus/fieldStaticProviderCorpusConfig.ts'
import type { StarterPack } from '../src/domain/types/starterPack.ts'

const targetStarterIds = ['dessert-conversation', 'coffee-books'] as const
const originalFetch = globalThis.fetch
const originalFlagValue = process.env[FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY]
const originalSourceMode = process.env.VITE_ID8_SOURCE_MODE
const originalGoogleKey = process.env.VITE_GOOGLE_PLACES_API_KEY
let fetchCallCount = 0

const fetchTrap: typeof fetch = async () => {
  fetchCallCount += 1
  throw new Error('Curate failed-starter diagnostics test must not call fetch.')
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function setEnv(): void {
  globalThis.fetch = fetchTrap
  process.env[FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY] = '1'
  process.env.VITE_ID8_SOURCE_MODE = 'curated'
  delete process.env.VITE_GOOGLE_PLACES_API_KEY
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
}

function findStarterPack(id: string): StarterPack {
  const starterPack = starterPacks.find((candidate) => candidate.id === id)
  if (!starterPack) {
    throw new Error(`Missing starter pack: ${id}`)
  }
  return starterPack
}

function assertNoPublicUiTouched(): void {
  const status = execFileSync(
    'git',
    ['status', '--short', '--untracked-files=all'],
    { encoding: 'utf8' },
  )
  const publicUiHits = status
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) =>
      /^(\?\?|[ MADRCU]{1,2})\s+src\/(app|components|pages)\//.test(
        line.replace(/\\/g, '/'),
      ),
    )
  assert(
    publicUiHits.length === 0,
    `Patch 3C diagnostics must not touch public UI files: ${publicUiHits.join(', ')}`,
  )
}

async function main(): Promise<void> {
  setEnv()
  const summaries = []

  for (const starterId of targetStarterIds) {
    const diagnostics = await buildCurateFailedStarterDiagnostics(
      findStarterPack(starterId),
    )

    assert(
      diagnostics.retrieval.requestedMode === 'curated',
      `${starterId}: requested sourceMode must remain curated.`,
    )
    assert(
      diagnostics.retrieval.effectiveMode === 'curated',
      `${starterId}: effective sourceMode must remain curated.`,
    )
    assert(
      !diagnostics.retrieval.liveFetchAttempted,
      `${starterId}: live fetch must not be attempted.`,
    )
    assert(
      diagnostics.retrieval.countsBySource.live === 0,
      `${starterId}: live source count must remain zero.`,
    )
    assert(
      diagnostics.retrieval.retrievedVenueCount > 0,
      `${starterId}: retrieval must return venues.`,
    )
    assert(
      diagnostics.fieldCorpus.retrievedCount > 0,
      `${starterId}: Field corpus candidates must be present.`,
    )
    assert(
      diagnostics.scoring.finalScoredCount > 0,
      `${starterId}: scored venue diagnostics must be present.`,
    )
    assert(
      diagnostics.rolePools.start.count >= 0 &&
        diagnostics.rolePools.highlight.count >= 0 &&
        diagnostics.rolePools.windDown.count >= 0,
      `${starterId}: role-pool counts must be present.`,
    )
    assert(
      diagnostics.arcAssembly.invalidReasonHistogram &&
        Object.keys(diagnostics.arcAssembly.invalidReasonHistogram).length > 0,
      `${starterId}: arc invalid reason histogram must be present.`,
    )
    assert(
      diagnostics.fallbackProbe.exactFallbackTraceAvailable === false,
      `${starterId}: exact private fallback trace must not be claimed available.`,
    )
    assert(
      diagnostics.fallbackProbe.invalidReasonHistogram &&
        Object.keys(diagnostics.fallbackProbe.invalidReasonHistogram).length > 0,
      `${starterId}: fallback probe invalid reason histogram must be present.`,
    )
    assert(
      diagnostics.runGeneratePlanComparison.generated === true,
      `${starterId}: comparison run should generate after Patch 3E compatibility fix.`,
    )
    assert(
      diagnostics.arcAssembly.candidateCount > 0,
      `${starterId}: arc assembly should produce candidates after Patch 3E compatibility fix.`,
    )

    summaries.push({
      starterId,
      retrievedVenueCount: diagnostics.retrieval.retrievedVenueCount,
      fieldRetrievedCount: diagnostics.fieldCorpus.retrievedCount,
      scoredVenueCount: diagnostics.scoring.finalScoredCount,
      rolePoolCounts: {
        start: diagnostics.rolePools.start.count,
        highlight: diagnostics.rolePools.highlight.count,
        surprise: diagnostics.rolePools.surprise.count,
        windDown: diagnostics.rolePools.windDown.count,
      },
      arcCandidateCount: diagnostics.arcAssembly.candidateCount,
      invalidReasons: diagnostics.arcAssembly.invalidReasonHistogram,
      fallbackProbe: {
        inferredFallbackFailureReason:
          diagnostics.fallbackProbe.inferredFallbackFailureReason,
        validFullArcCount: diagnostics.fallbackProbe.validFullArcCount,
        validPartialArcCount: diagnostics.fallbackProbe.validPartialArcCount,
        validHighlightOnlyCount: diagnostics.fallbackProbe.validHighlightOnlyCount,
      },
      inferredFailureCategories: diagnostics.inferredFailureCategories,
      generated: diagnostics.runGeneratePlanComparison.generated,
      selectedStopIds: diagnostics.runGeneratePlanComparison.selectedStopIds,
    })
  }

  assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)
  assertNoPublicUiTouched()

  process.stdout.write('curate failed-starter diagnostics validation: passed\n')
  process.stdout.write(
    `${JSON.stringify(
      {
        fetchCallCount,
        targetStarterIds,
        summaries,
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
