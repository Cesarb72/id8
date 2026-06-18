import { starterPacks } from '../src/data/starterPacks'
import { getDiscoveryCandidates } from '../src/domain/discovery/getDiscoveryCandidates'
import { previewDistrictRecommendations } from '../src/domain/previewDistrictRecommendations'
import { runGeneratePlan } from '../src/domain/runGeneratePlan'
import { CLOSED_PREVIEW_LIVE_ENVELOPE } from '../src/domain/retrieval/liveEnvelope'

const originalFetch = globalThis.fetch
let fieldProxyCalled = false
globalThis.fetch = (async (input) => {
  const url = String(input)
  if (url.includes('/api/field/text-search')) {
    fieldProxyCalled = true
    throw new Error('Field proxy must not be called during discovery preview')
  }
  throw new Error(`Unexpected fetch during discovery preview: ${url}`)
}) as typeof fetch

async function main(): Promise<void> {
  // minimal intent input; normalizeIntent will fill defaults
  const input: any = {
    city: 'San Jose',
    mode: 'curate',
    primaryVibe: 'cozy',
  }

  const groups = await getDiscoveryCandidates(input, {
    liveEnvelope: CLOSED_PREVIEW_LIVE_ENVELOPE,
  })

  await previewDistrictRecommendations(input, {
    sourceMode: 'curated',
    sourceModeOverrideApplied: false,
    liveEnvelope: CLOSED_PREVIEW_LIVE_ENVELOPE,
  })

  const coffeeBooks = starterPacks.find((pack) => pack.id === 'coffee-books')
  if (!coffeeBooks) {
    throw new Error('Missing coffee-books starter pack')
  }
  await runGeneratePlan(
    {
      mode: 'curate',
      persona: coffeeBooks.personaBias ?? null,
      primaryVibe: coffeeBooks.primaryAnchor,
      secondaryVibe: coffeeBooks.secondaryAnchors?.[0],
      city: 'San Jose',
      distanceMode: coffeeBooks.distanceMode ?? 'nearby',
      prefersHiddenGems: coffeeBooks.lensPreset?.discoveryBias === 'high',
    },
    {
      starterPack: coffeeBooks,
      sourceMode: 'curated',
      sourceModeOverrideApplied: false,
    },
  )

  if (fieldProxyCalled) {
    throw new Error('Field proxy was called during discovery preview')
  }

  process.stdout.write('discovery preview no-live-field: passed\n')
}

main().catch((err) => {
  const message = err instanceof Error ? err.stack ?? err.message : String(err)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
}).finally(() => {
  globalThis.fetch = originalFetch
})
