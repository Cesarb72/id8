import { starterPacks } from '../src/data/starterPacks.ts'
import { buildArtifactBackedVisibleItinerary, validatePublicContractEntryArtifactTruth } from '../src/app/services/canonicalPublicRouteTruthService.ts'
import { buildPublicCurateCardTruthModel } from '../src/app/services/curate/publicCurateCardTruthService.ts'
import { FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY } from '../src/domain/field/corpus/fieldStaticProviderCorpusConfig.ts'
import { runGeneratePlan } from '../src/domain/runGeneratePlan.ts'
import type { ContractEntryArtifact } from '../src/domain/artifacts/contractEntryArtifact.ts'
import type { IntentInput } from '../src/domain/types/intent.ts'
import type { StarterPack } from '../src/domain/types/starterPack.ts'

const originalFetch = globalThis.fetch
const originalFlagValue = process.env[FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY]
const originalSourceMode = process.env.VITE_ID8_SOURCE_MODE
const originalGoogleKey = process.env.VITE_GOOGLE_PLACES_API_KEY
let fetchCallCount = 0

const fetchTrap: typeof fetch = async () => {
  fetchCallCount += 1
  throw new Error('Public ContractEntryArtifact card truth test must not call fetch.')
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

function buildStarterInput(starterPack: StarterPack): IntentInput {
  return {
    mode: 'curate',
    persona: starterPack.personaBias ?? null,
    primaryVibe: starterPack.primaryAnchor,
    secondaryVibe: starterPack.secondaryAnchors?.[0],
    city: 'San Jose',
    distanceMode: starterPack.distanceMode ?? 'nearby',
    prefersHiddenGems: starterPack.lensPreset?.discoveryBias === 'high',
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

function cloneAsLiveMusicAdegaMismatch(artifact: ContractEntryArtifact): ContractEntryArtifact {
  return {
    ...artifact,
    id: 'contract-entry:test-live-music-adega-mismatch',
    routeTitle: 'Live Music Loop',
    anchorName: 'Adega',
    storySpine: {
      ...artifact.storySpine,
      highlight: 'Adega',
    },
    enrichment: {
      ...artifact.enrichment,
      mode: 'curate',
      userInputContext: {
        ...artifact.enrichment?.userInputContext,
        starterPackId: 'live-music-loop',
      },
      starterContextFit: {
        status: 'passed',
        starterPackId: 'live-music-loop',
        mode: 'curate',
        contextKey: 'live-music-loop:curate:San Jose:cultured',
        rejectionReasons: [],
      },
      canonicalRouteRoleCoverage: {
        ...artifact.enrichment?.canonicalRouteRoleCoverage,
        start: artifact.enrichment?.canonicalRouteRoleCoverage?.start ?? artifact.storySpine.start,
        highlight: 'Adega',
        windDown: artifact.enrichment?.canonicalRouteRoleCoverage?.windDown ?? artifact.storySpine.windDown,
      },
    },
  }
}

async function main(): Promise<void> {
  setEnv()
  const coffeeBooks = findStarterPack('coffee-books')
  const liveMusicLoop = findStarterPack('live-music-loop')
  const result = await runGeneratePlan(buildStarterInput(coffeeBooks), {
    starterPack: coffeeBooks,
    sourceMode: 'curated',
    sourceModeOverrideApplied: false,
  })
  const artifact = result.contractEntryArtifact

  const validTruth = validatePublicContractEntryArtifactTruth(artifact, {
    mode: 'curate',
    starterPack: coffeeBooks,
  })
  assert(validTruth.allowedToRender, 'Valid enriched ContractEntryArtifact must render.')
  assert(
    buildArtifactBackedVisibleItinerary({
      artifact,
      itinerary: result.itinerary,
      context: { mode: 'curate', starterPack: coffeeBooks },
    }) === result.itinerary,
    'Visible itinerary must be backed by matching artifact role truth.',
  )

  const noArtifactTruth = validatePublicContractEntryArtifactTruth(null, {
    mode: 'curate',
    starterPack: coffeeBooks,
  })
  assert(!noArtifactTruth.allowedToRender, 'No public card may render without a ContractEntryArtifact.')

  const crossStarterTruth = validatePublicContractEntryArtifactTruth(artifact, {
    mode: 'curate',
    starterPack: liveMusicLoop,
  })
  assert(!crossStarterTruth.allowedToRender, 'Cross-starter artifact must not render.')
  assert(
    crossStarterTruth.rejectionReasons.includes('starter_context_mismatch'),
    'Cross-starter rejection must preserve starter context mismatch.',
  )

  const crossModeTruth = validatePublicContractEntryArtifactTruth(artifact, {
    mode: 'surprise',
    starterPack: null,
  })
  assert(!crossModeTruth.allowedToRender, 'Cross-mode artifact must not render.')
  assert(
    crossModeTruth.rejectionReasons.includes('mode_context_mismatch'),
    'Cross-mode rejection must preserve mode context mismatch.',
  )

  const routeStopsOnlyModel = buildPublicCurateCardTruthModel({
    selectedStarterPack: coffeeBooks,
    routeStops: [
      { role: 'start', name: 'Candidate Start' },
      { role: 'highlight', name: 'Candidate Highlight' },
      { role: 'windDown', name: 'Candidate Wind Down' },
    ],
    committedRouteFallbackRenderEnabled: true,
  })
  assert(routeStopsOnlyModel.visibleCards.length === 0, 'Route-stop-only card must not render.')
  assert(!routeStopsOnlyModel.actionsAllowed.review, 'Route-stop-only card must not allow review.')

  const adegaMismatch = cloneAsLiveMusicAdegaMismatch(artifact)
  const adegaTruth = validatePublicContractEntryArtifactTruth(adegaMismatch, {
    mode: 'curate',
    starterPack: liveMusicLoop,
  })
  assert(!adegaTruth.allowedToRender, 'Live Music Loop / Adega mismatch must not render.')
  assert(
    adegaTruth.rejectionReasons.includes('curate_card_promise_mismatch'),
    'Adega mismatch must preserve card promise mismatch.',
  )

  assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)
  process.stdout.write('public ContractEntryArtifact card truth: passed\n')
  process.stdout.write(
    `${JSON.stringify(
      {
        fetchCallCount,
        validArtifactId: artifact.id,
        crossStarterRejections: crossStarterTruth.rejectionReasons,
        crossModeRejections: crossModeTruth.rejectionReasons,
        adegaRejections: adegaTruth.rejectionReasons,
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
