import type { ProviderTextSearchQuery } from '../src/domain/providers/ProviderAdapter'
import { searchPlaces } from '../src/domain/providers/ProviderAdapter'

const originalFetch = globalThis.fetch

async function main(): Promise<void> {
  let fetchCount = 0
  globalThis.fetch = async () => {
    fetchCount += 1
    return {
      ok: false,
      status: 429,
      json: async () => ({
        ok: false,
        diagnostics: {
          errorCode: 'rate_limit',
          blockedReason: 'provider_rate_limited',
          callConsumed: false,
        },
        results: [],
      }),
    } as unknown as Response
  }

  const queries: ProviderTextSearchQuery[] = [
    {
      queryLabel: 'test-1',
      textQuery: 'coffee in san jose',
      fieldMask: 'places.id',
    },
    {
      queryLabel: 'test-2',
      textQuery: 'dinner in san jose',
      fieldMask: 'places.id',
    },
  ]

  const result = await searchPlaces({
    callPurpose: 'retrieval_supply',
    city: 'San Jose',
    context: {},
    mapPlace: () => undefined,
    queries,
    sourceMode: 'live',
  })

  if (fetchCount !== 1) {
    throw new Error(`Expected only one fetch to occur, got ${fetchCount}`)
  }
  if (result.errors.length === 0) {
    throw new Error('Expected errors on 429 stop condition')
  }

  fetchCount = 0
  await searchPlaces({
    callPurpose: 'retrieval_supply',
    city: 'San Jose',
    context: {},
    mapPlace: () => undefined,
    queries,
    sourceMode: 'live',
    envelope: {
      maxProviderCalls: 0,
    },
  })
  if (fetchCount !== 0) {
    throw new Error(`Expected maxProviderCalls=0 to prevent fetch, got ${fetchCount}`)
  }

  await searchPlaces({
    callPurpose: 'retrieval_supply',
    city: 'San Jose',
    context: {},
    mapPlace: () => undefined,
    queries,
    sourceMode: 'live',
    envelope: {
      maxQueryLabels: 0,
    },
  })
  if (fetchCount !== 0) {
    throw new Error(`Expected maxQueryLabels=0 to prevent fetch, got ${fetchCount}`)
  }
  process.stdout.write('provider adapter stop-on-429: passed\n')
}

main().catch((error) => {
  process.stderr.write(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exitCode = 1
}).finally(() => {
  globalThis.fetch = originalFetch
})
