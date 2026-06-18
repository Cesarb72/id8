import { buildCurateStarterPlannerInput } from '../src/app/services/curate/buildCurateCommittedRouteFallback.ts'
import { starterPacks } from '../src/data/starterPacks.ts'
import { getDiscoveryCandidates } from '../src/domain/discovery/getDiscoveryCandidates.ts'
import type { FieldTextSearchRequest, FieldTextSearchResponse } from '../src/domain/field/fieldProxyTypes.ts'
import { buildStopTypeCandidateBoardFromIntent } from '../src/domain/interpretation/discovery/stopTypeCandidateBoard.ts'
import { previewDistrictRecommendations } from '../src/domain/previewDistrictRecommendations.ts'
import { runGeneratePlan } from '../src/domain/runGeneratePlan.ts'
import { CLOSED_PREVIEW_LIVE_ENVELOPE } from '../src/domain/retrieval/liveEnvelope.ts'
import type { StarterPack } from '../src/domain/types/starterPack.ts'

const FIELD_PROXY_PATH = '/api/field/text-search'
const originalFetch = globalThis.fetch
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
const managedEnvKeys = [
  'GOOGLE_PLACES_API_KEY',
  'VITE_GOOGLE_PLACES_API_KEY',
  'VITE_PROVIDER_API_KEY',
  'VITE_ID8_SOURCE_MODE',
  'VITE_ID8_FIELD_GOVERNED_MODE',
  'VITE_ID8_ALLOW_CURATED_FALLBACK',
  'VITE_ID8_ALLOW_BOOTSTRAP_FALLBACK',
  'VITE_ID8_ALLOW_DEFAULT_CITY_FALLBACK',
  'VITE_ID8_ALLOW_FIXTURE_INJECTION',
  'VITE_ID8_FAIL_CLOSED_ON_LIVE_INVENTORY_FAILURE',
] as const
const originalEnvValues = new Map(
  managedEnvKeys.map((key) => [key, process.env[key]] as const),
)

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function resetEnv(): void {
  for (const key of managedEnvKeys) {
    delete process.env[key]
  }
}

function restoreEnv(): void {
  for (const key of managedEnvKeys) {
    const original = originalEnvValues.get(key)
    if (original === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = original
    }
  }
}

function setPublicCurateRoute(): void {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: {
        pathname: '/start/curate',
        search: '',
      },
    },
  })
}

function restoreWindow(): void {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
  } else {
    Reflect.deleteProperty(globalThis, 'window')
  }
}

function findStarterPack(id: string): StarterPack {
  const starterPack = starterPacks.find((candidate) => candidate.id === id)
  if (!starterPack) {
    throw new Error(`Missing starter pack: ${id}`)
  }
  return starterPack
}

function buildCoffeeBooksInput(starterPack: StarterPack) {
  return {
    mode: 'curate' as const,
    persona: starterPack.personaBias ?? null,
    primaryVibe: starterPack.primaryAnchor,
    secondaryVibe: starterPack.secondaryAnchors?.[0],
    city: 'San Jose',
    distanceMode: starterPack.distanceMode ?? 'nearby',
    prefersHiddenGems: starterPack.lensPreset?.discoveryBias === 'high',
  }
}

async function withZeroProxyTrap(
  label: string,
  run: () => Promise<void> | void,
): Promise<number> {
  let proxyCalls = 0
  globalThis.fetch = (async (input) => {
    const url = String(input)
    if (url.includes(FIELD_PROXY_PATH)) {
      proxyCalls += 1
      throw new Error(`${label}: unexpected Field proxy call to ${url}`)
    }
    throw new Error(`${label}: unexpected non-Field fetch to ${url}`)
  }) as typeof fetch

  await run()
  assert(proxyCalls === 0, `${label}: expected zero Field proxy calls, received ${proxyCalls}.`)
  return proxyCalls
}

async function runEntryRenderPreviewEffects(): Promise<void> {
  await buildStopTypeCandidateBoardFromIntent({
    city: 'San Jose',
    persona: 'romantic',
    vibe: 'lively',
    sourceMode: 'curated',
    liveEnvelope: CLOSED_PREVIEW_LIVE_ENVELOPE,
  })
  await previewDistrictRecommendations(
    {
      persona: 'romantic',
      primaryVibe: 'lively',
      city: 'San Jose',
      distanceMode: 'nearby',
    },
    {
      sourceMode: 'curated',
      sourceModeOverrideApplied: false,
      liveEnvelope: CLOSED_PREVIEW_LIVE_ENVELOPE,
    },
  )
}

async function runCoffeeBooksSelectionPreviewEffects(starterPack: StarterPack): Promise<void> {
  await buildStopTypeCandidateBoardFromIntent({
    city: 'San Jose',
    persona: starterPack.personaBias ?? 'romantic',
    vibe: starterPack.primaryAnchor,
    sourceMode: 'curated',
    liveEnvelope: CLOSED_PREVIEW_LIVE_ENVELOPE,
  })
  await previewDistrictRecommendations(buildCoffeeBooksInput(starterPack), {
    starterPack,
    sourceMode: 'curated',
    sourceModeOverrideApplied: false,
    liveEnvelope: CLOSED_PREVIEW_LIVE_ENVELOPE,
  })
}

async function runMoodDiscoveryPreview(starterPack: StarterPack): Promise<void> {
  await getDiscoveryCandidates(buildCoffeeBooksInput(starterPack), {
    starterPack,
    sourceMode: 'curated',
    sourceModeOverrideApplied: false,
    liveEnvelope: CLOSED_PREVIEW_LIVE_ENVELOPE,
  })
}

async function runRestoredPreselectedStarterPreview(starterPack: StarterPack): Promise<void> {
  const baseInput = {
    ...buildCurateStarterPlannerInput(starterPack),
    city: 'San Jose',
  }
  await runGeneratePlan(baseInput, {
    starterPack,
    sourceMode: 'curated',
    sourceModeOverrideApplied: false,
    debugMode: false,
    liveEnvelope: CLOSED_PREVIEW_LIVE_ENVELOPE,
  })
  await runGeneratePlan(
    {
      ...baseInput,
      selectedDirectionContext: {
        directionId: 'restored-preselected-coffee-books',
        label: 'Restored Coffee & Books',
        pocketId: 'san-jose',
      },
    },
    {
      starterPack,
      sourceMode: 'curated',
      sourceModeOverrideApplied: true,
      debugMode: false,
      curateCommitSemantics: 'seed_guided',
      liveEnvelope: CLOSED_PREVIEW_LIVE_ENVELOPE,
    },
  )
}

function buildMockFieldResponse(request: FieldTextSearchRequest): FieldTextSearchResponse {
  return {
    ok: true,
    cache: 'miss',
    budget: {
      date: '2026-06-18',
      cap: 32,
      used: 1,
      remaining: 31,
    },
    results: [],
    diagnostics: {
      purpose: request.purpose,
      queryHash: 'mock-query-hash',
      providerStatus: 'mocked_field_proxy',
      resultCount: 0,
      callConsumed: true,
    },
  }
}

async function runDefaultFinalGenerationDry(starterPack: StarterPack): Promise<number> {
  return withZeroProxyTrap(
    'Public default final generation without explicit live envelope',
    async () => {
      await runGeneratePlan(buildCoffeeBooksInput(starterPack), {
        starterPack,
        sourceMode: 'curated',
        sourceModeOverrideApplied: false,
      })
    },
  )
}

async function runExplicitLiveEnvelopeGeneration(starterPack: StarterPack): Promise<{
  calls: number
  maxProviderCalls: number
}> {
  const maxProviderCalls = 2
  let proxyCalls = 0
  globalThis.fetch = (async (input, init) => {
    const url = String(input)
    if (!url.includes(FIELD_PROXY_PATH)) {
      throw new Error(`Explicit live-envelope generation: unexpected fetch to ${url}`)
    }
    proxyCalls += 1
    const body = JSON.parse(String(init?.body)) as FieldTextSearchRequest
    return {
      ok: true,
      status: 200,
      async json() {
        return buildMockFieldResponse(body)
      },
    } as Response
  }) as typeof fetch

  await runGeneratePlan(buildCoffeeBooksInput(starterPack), {
    starterPack,
    sourceMode: 'curated',
    sourceModeOverrideApplied: false,
    liveEnvelope: {
      liveProviderAllowed: true,
      maxProviderCalls,
      maxQueryLabels: maxProviderCalls,
      maxCenters: 1,
    },
  })

  assert(proxyCalls > 0, 'Explicit live-envelope generation must exercise the Field proxy.')
  assert(
    proxyCalls <= maxProviderCalls,
    `Explicit live-envelope generation exceeded maxProviderCalls=${maxProviderCalls}; received ${proxyCalls}.`,
  )
  return {
    calls: proxyCalls,
    maxProviderCalls,
  }
}

async function main(): Promise<void> {
  resetEnv()
  setPublicCurateRoute()
  const coffeeBooks = findStarterPack('coffee-books')

  const entryRenderCalls = await withZeroProxyTrap(
    'Curate entry render',
    runEntryRenderPreviewEffects,
  )
  const starterListCalls = await withZeroProxyTrap('Starter list render', () => {
    assert(starterPacks.length > 0, 'Starter list must render available starter packs.')
  })
  const coffeeBooksSelectionCalls = await withZeroProxyTrap(
    'Coffee + Books selection',
    () => runCoffeeBooksSelectionPreviewEffects(coffeeBooks),
  )
  const moodDiscoveryCalls = await withZeroProxyTrap(
    'Mood/discovery preview',
    () => runMoodDiscoveryPreview(coffeeBooks),
  )
  const restoredPreselectedCalls = await withZeroProxyTrap(
    'Restored/preselected starter',
    () => runRestoredPreselectedStarterPreview(coffeeBooks),
  )
  const defaultFinalGenerationCalls = await runDefaultFinalGenerationDry(coffeeBooks)
  const explicitLiveGeneration = await runExplicitLiveEnvelopeGeneration(coffeeBooks)

  process.stdout.write(`Curate entry render proxy calls: ${entryRenderCalls}\n`)
  process.stdout.write(`Starter list render proxy calls: ${starterListCalls}\n`)
  process.stdout.write(`Coffee + Books selection proxy calls: ${coffeeBooksSelectionCalls}\n`)
  process.stdout.write(`Mood/discovery preview proxy calls: ${moodDiscoveryCalls}\n`)
  process.stdout.write(`Restored/preselected starter proxy calls: ${restoredPreselectedCalls}\n`)
  process.stdout.write(
    `Public default final generation without explicit live envelope proxy calls: ${defaultFinalGenerationCalls}\n`,
  )
  process.stdout.write(
    `Explicit live-envelope generation proxy calls: ${explicitLiveGeneration.calls} <= ${explicitLiveGeneration.maxProviderCalls}\n`,
  )
  process.stdout.write('curate entry no field proxy: passed\n')
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
  .finally(() => {
    globalThis.fetch = originalFetch
    restoreWindow()
    restoreEnv()
  })
