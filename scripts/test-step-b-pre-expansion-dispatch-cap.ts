import { fetchLivePlaces } from '../src/domain/sources/fetchLivePlaces.ts'
import { buildLiveQueryPlan } from '../src/domain/sources/buildLiveQueryPlan.ts'
import { starterPacks } from '../src/data/starterPacks.ts'
import type { FieldTextSearchRequest, FieldTextSearchResponse } from '../src/domain/field/fieldProxyTypes.ts'

const originalFetch = globalThis.fetch

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

async function main(): Promise<void> {
  const coffeeBooksStarterPack = starterPacks.find((starterPack) => starterPack.id === 'coffee-books')
  assert(coffeeBooksStarterPack, 'Expected Coffee & Books starter pack.')
  const coffeeBooksQueryPlan = buildLiveQueryPlan(
    {
      city: 'San Jose',
      crew: 'romantic',
      mode: 'curate',
      primaryAnchor: 'cultured',
      secondaryAnchor: 'chill',
      timeWindow: 'evening',
    } as any,
    coffeeBooksStarterPack,
  )
  const firstThreeCoffeeBooksLabels = coffeeBooksQueryPlan.slice(0, 3).map((entry) => entry.label)
  const firstThreeCoffeeBooksText = coffeeBooksQueryPlan
    .slice(0, 3)
    .map((entry) => `${entry.label} ${entry.textQuery} ${entry.queryTerms.join(' ')}`.toLowerCase())
    .join(' ')
  assert(
    firstThreeCoffeeBooksLabels.every((label) => label.startsWith('coffee-books-')),
    `Expected Coffee & Books first three labels to be starter-specific; received ${firstThreeCoffeeBooksLabels.join(', ')}.`,
  )
  assert(
    ['book', 'reading', 'literary', 'culture', 'gallery'].some((term) =>
      firstThreeCoffeeBooksText.includes(term),
    ),
    'Expected Coffee & Books first three query labels/text to carry book/culture/reading semantics.',
  )

  const requests: FieldTextSearchRequest[] = []
  globalThis.fetch = (async (input, init) => {
    const url = String(input)
    assert(url === '/api/field/text-search', `Expected Field proxy path, received ${url}.`)
    const body = JSON.parse(String(init?.body)) as FieldTextSearchRequest
    requests.push(body)
    const mockedResults = body.queryLabel.startsWith('coffee-books-')
      ? [
          {
            provider: 'google_places',
            providerRecordId: `inside-${body.queryLabel}`,
            displayName: `Inside ${body.queryLabel}`,
            primaryType: body.queryLabel.includes('highlight') ? 'book_store' : 'cafe',
            types: body.queryLabel.includes('highlight')
              ? ['book_store', 'store']
              : ['cafe', 'coffee_shop'],
            formattedAddress: '1 Pocket Way, San Jose, CA',
            shortFormattedAddress: '1 Pocket Way',
            businessStatus: 'OPERATIONAL',
            rating: 4.7,
            userRatingCount: 120,
            location: { latitude: 37.32124, longitude: -121.91235 },
          },
          {
            provider: 'google_places',
            providerRecordId: `outside-${body.queryLabel}`,
            displayName: `Outside ${body.queryLabel}`,
            primaryType: body.queryLabel.includes('highlight') ? 'book_store' : 'cafe',
            types: body.queryLabel.includes('highlight')
              ? ['book_store', 'store']
              : ['cafe', 'coffee_shop'],
            formattedAddress: '99 Far Way, San Jose, CA',
            shortFormattedAddress: '99 Far Way',
            businessStatus: 'OPERATIONAL',
            rating: 4.5,
            userRatingCount: 90,
            location: { latitude: 37.36981, longitude: -121.92986 },
          },
        ]
      : []
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          ok: true,
          cache: 'miss',
          budget: {
            date: '2026-06-19',
            cap: 32,
            used: requests.length,
            remaining: Math.max(0, 32 - requests.length),
          },
          results: mockedResults,
          diagnostics: {
            purpose: body.purpose,
            queryHash: 'mock-query-hash',
            providerStatus: 'mocked_field_proxy',
            resultCount: 0,
            callConsumed: true,
          },
        } satisfies FieldTextSearchResponse
      },
    } as Response
  }) as typeof fetch

  const result = await fetchLivePlaces(
    {
      city: 'San Jose',
      crew: 'romantic',
      mode: 'curate',
      primaryAnchor: 'cozy',
      secondaryAnchor: 'cultured',
      timeWindow: 'evening',
    } as any,
    undefined,
    {
      maxQueryCenters: 3,
      sourceMode: 'live',
      envelope: {
        maxProviderCalls: 3,
        maxQueryLabels: 3,
      },
      stepBCurateLiveSmokeActive: true,
    },
  )

  assert(
    result.diagnostics.labelsConsidered === 7,
    `Expected 7 labels before envelope, received ${result.diagnostics.labelsConsidered}.`,
  )
  assert(
    result.diagnostics.labelsAdmitted === 3,
    `Expected 3 labels admitted, received ${result.diagnostics.labelsAdmitted}.`,
  )
  assert(
    result.diagnostics.centersConsidered === 3,
    `Expected 3 centers considered, received ${result.diagnostics.centersConsidered}.`,
  )
  assert(
    result.diagnostics.centersAdmitted === 3,
    `Expected 3 centers admitted, received ${result.diagnostics.centersAdmitted}.`,
  )
  assert(
    result.diagnostics.dispatchQueriesPlanned === 3,
    `Expected dispatch plan capped to 3 before ProviderAdapter, received ${result.diagnostics.dispatchQueriesPlanned}.`,
  )
  assert(
    result.diagnostics.dispatchQueriesPlannedWithinCap,
    'Expected dispatch plan cap assertion to pass.',
  )
  assert(requests.length === 3, `Expected exactly 3 mocked proxy calls, received ${requests.length}.`)

  requests.length = 0
  const pocketResult = await fetchLivePlaces(
    {
      city: 'San Jose',
      crew: 'romantic',
      mode: 'curate',
      primaryAnchor: 'cultured',
      secondaryAnchor: 'cozy',
      timeWindow: 'evening',
    } as any,
    coffeeBooksStarterPack,
    {
      maxQueryCenters: 1,
      sourceMode: 'live',
      envelope: {
        maxProviderCalls: 3,
        maxQueryLabels: 3,
      },
      pocketHint: {
        pocketId: 'raw-pocket-test',
        pocketLabel: 'Test Reading Pocket',
        centroid: { lat: 37.32123, lng: -121.91234 },
        radiusM: 180,
        source: 'district_intelligence',
        city: 'San Jose',
        locationLabel: 'Test Reading Pocket, San Jose',
      },
      stepBCurateLiveSmokeActive: true,
    },
  )

  assert(
    pocketResult.diagnostics.pocketCenteredRetrievalApplied,
    'Coffee & Books pocket hint must activate pocket-centered retrieval.',
  )
  assert(
    pocketResult.diagnostics.queryCentersUsed.length === 1 &&
      pocketResult.diagnostics.queryCentersUsed[0]?.id === 'pocket',
    `Coffee & Books pocket hint must use one pocket center; received ${JSON.stringify(pocketResult.diagnostics.queryCentersUsed)}.`,
  )
  assert(
    pocketResult.diagnostics.queryRadiusM === 650,
    `Coffee & Books pocket radius must be DI-derived with bounded floor; received ${pocketResult.diagnostics.queryRadiusM}.`,
  )
  assert(
    requests.length === 3,
    `Expected exactly 3 pocket-centered mocked proxy calls, received ${requests.length}.`,
  )
  const pocketCenters = requests.map((request) => request.center)
  assert(
    pocketCenters.every(
      (center) => center?.lat === 37.32123 && center.lng === -121.91234,
    ),
    `Coffee & Books provider requests must use the pocket center, received ${JSON.stringify(pocketCenters)}.`,
  )
  assert(
    pocketCenters.every((center) => center?.lat !== 37.3382 || center.lng !== -121.8863),
    'Coffee & Books provider requests must not use the broad San Jose city center when a pocket hint exists.',
  )
  assert(
    requests.every((request) => request.radiusMeters === 650),
    `Coffee & Books provider requests must use the bounded pocket radius, received ${requests.map((request) => request.radiusMeters).join(', ')}.`,
  )
  assert(
    requests.every((request) => request.textQuery.includes('Test Reading Pocket, San Jose')),
    `Coffee & Books pocket queries must be location-parameterized, received ${requests.map((request) => request.textQuery).join(' | ')}.`,
  )
  assert(
    pocketResult.diagnostics.pocketFilterInputCount === 6,
    `Coffee & Books pocket filter must inspect normalized live candidates, received ${pocketResult.diagnostics.pocketFilterInputCount}.`,
  )
  assert(
    pocketResult.diagnostics.pocketFilterInsideEnvelopeCount === 3,
    `Coffee & Books pocket filter must admit in-pocket candidates, received ${pocketResult.diagnostics.pocketFilterInsideEnvelopeCount}.`,
  )
  assert(
    pocketResult.diagnostics.pocketFilterDroppedCount === 3,
    `Coffee & Books pocket filter must drop scattered fallback candidates, received ${pocketResult.diagnostics.pocketFilterDroppedCount}.`,
  )
  assert(
    pocketResult.venues.every((venue) => venue.name.startsWith('Inside')),
    `Coffee & Books pocket-filtered venues must not include far-away records, received ${pocketResult.venues.map((venue) => venue.name).join(', ')}.`,
  )

  process.stdout.write(
    [
      'step b pre-expansion dispatch cap: passed',
      `labels ${result.diagnostics.labelsConsidered} -> ${result.diagnostics.labelsAdmitted}`,
      `centers ${result.diagnostics.centersConsidered} -> ${result.diagnostics.centersAdmitted}`,
      `dispatch ${result.diagnostics.dispatchQueriesPlanned}`,
      `attempted ${result.diagnostics.dispatchQueriesAttempted}`,
    ].join(' | ') + '\n',
  )
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
  .finally(() => {
    globalThis.fetch = originalFetch
  })
