import { starterPacks } from '../src/data/starterPacks.ts'
import { validateContractEntryArtifactPreCommitTruth } from '../src/domain/artifacts/contractEntryArtifact.ts'
import { runGeneratePlan } from '../src/domain/runGeneratePlan.ts'
import type { ExperienceMode, IntentInput } from '../src/domain/types/intent.ts'
import type { StarterPack } from '../src/domain/types/starterPack.ts'

const originalFetch = globalThis.fetch
const originalSourceMode = process.env.VITE_ID8_SOURCE_MODE
const originalGoogleKey = process.env.VITE_GOOGLE_PLACES_API_KEY
let fetchCallCount = 0

const fetchTrap: typeof fetch = async () => {
  fetchCallCount += 1
  throw new Error('Generation ContractEntryArtifact handoff test must not call fetch.')
}

interface Scenario {
  mode: ExperienceMode
  input: IntentInput
  starterPack?: StarterPack
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function findStarterPack(id: string): StarterPack {
  const starterPack = starterPacks.find((candidate) => candidate.id === id)
  if (!starterPack) {
    throw new Error(`Missing starter pack: ${id}`)
  }
  return starterPack
}

function setEnv(): void {
  globalThis.fetch = fetchTrap
  process.env.VITE_ID8_SOURCE_MODE = 'curated'
  delete process.env.VITE_GOOGLE_PLACES_API_KEY
}

function restoreEnv(): void {
  globalThis.fetch = originalFetch
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

function buildScenarios(): Scenario[] {
  const starterPack = findStarterPack('coffee-books')
  return [
    {
      mode: 'curate',
      starterPack,
      input: {
        mode: 'curate',
        persona: starterPack.personaBias ?? null,
        primaryVibe: starterPack.primaryAnchor,
        secondaryVibe: starterPack.secondaryAnchors?.[0],
        city: 'San Jose',
        distanceMode: starterPack.distanceMode ?? 'nearby',
        prefersHiddenGems: starterPack.lensPreset?.discoveryBias === 'high',
      },
    },
    {
      mode: 'surprise',
      input: {
        mode: 'surprise',
        persona: 'friends',
        primaryVibe: 'cultured',
        secondaryVibe: 'lively',
        city: 'San Jose',
        distanceMode: 'nearby',
        prefersHiddenGems: true,
      },
    },
    {
      mode: 'build',
      input: {
        mode: 'build',
        planningMode: 'user-led',
        persona: 'romantic',
        primaryVibe: 'cozy',
        secondaryVibe: 'cultured',
        city: 'San Jose',
        distanceMode: 'nearby',
        prefersHiddenGems: false,
      },
    },
  ]
}

async function main(): Promise<void> {
  setEnv()
  const summaries = []

  for (const scenario of buildScenarios()) {
    const result = await runGeneratePlan(scenario.input, {
      starterPack: scenario.starterPack,
      sourceMode: 'curated',
      sourceModeOverrideApplied: false,
    })
    const artifact = result.contractEntryArtifact
    const validation = validateContractEntryArtifactPreCommitTruth(artifact, {
      requireEnrichment: true,
    })

    assert(validation.status === 'valid', `${scenario.mode}: artifact must pass strict validation.`)
    assert(validation.fullPlanVisible, `${scenario.mode}: artifact must be full-plan visible.`)
    assert(artifact.enrichment?.mode === scenario.mode, `${scenario.mode}: artifact mode must match generation mode.`)
    assert(
      artifact.enrichment?.modeContextFit?.status === 'passed',
      `${scenario.mode}: mode context fit must pass.`,
    )
    assert(
      artifact.enrichment?.fieldProvenanceSummary?.liveProviderUsed === false,
      `${scenario.mode}: live provider must not be used.`,
    )
    assert(
      result.trace.retrievalDiagnostics.liveSource.liveFetchAttempted === false,
      `${scenario.mode}: live fetch must not be attempted.`,
    )
    assert(
      artifact.enrichment?.canonicalRouteRoleCoverage?.start === validation.roleCoverage.start,
      `${scenario.mode}: start role must derive from artifact truth.`,
    )
    assert(
      artifact.enrichment?.canonicalRouteRoleCoverage?.highlight === validation.roleCoverage.highlight,
      `${scenario.mode}: highlight role must derive from artifact truth.`,
    )
    assert(
      artifact.enrichment?.canonicalRouteRoleCoverage?.windDown === validation.roleCoverage.windDown,
      `${scenario.mode}: wind-down role must derive from artifact truth.`,
    )

    summaries.push({
      mode: scenario.mode,
      artifactId: artifact.id,
      validationStatus: validation.status,
      roles: validation.roleCoverage,
      liveProviderUsed: artifact.enrichment?.fieldProvenanceSummary?.liveProviderUsed,
      liveFetchAttempted: result.trace.retrievalDiagnostics.liveSource.liveFetchAttempted,
    })
  }

  assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)
  process.stdout.write('generation ContractEntryArtifact handoff: passed\n')
  process.stdout.write(`${JSON.stringify({ fetchCallCount, summaries }, null, 2)}\n`)
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
