import {
  createFieldTextSearchProviderFromEnv,
  createMockFieldTextSearchProvider,
  mapProviderErrorToBlockedReason,
  readServerGooglePlacesKeyState,
} from '../api/field/_lib/fieldTextSearchProvider.ts'
import type { FieldTextSearchRequest } from '../src/domain/field/fieldProxyTypes.ts'

const originalFetch = globalThis.fetch
const originalGooglePlacesApiKey = process.env.GOOGLE_PLACES_API_KEY
let fetchCallCount = 0

const fetchTrap: typeof fetch = async () => {
  fetchCallCount += 1
  throw new Error('Field proxy mocked provider tests must not call fetch.')
}

const request: FieldTextSearchRequest = {
  purpose: 'retrieval_supply',
  city: 'San Jose',
  mode: 'curate',
  queryLabel: 'highlight-intent',
  textQuery: 'mocked live music san jose',
  center: {
    lat: 37.3382,
    lng: -121.8863,
  },
  radiusMeters: 5000,
  pageSize: 8,
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

async function assertMockSuccess(): Promise<void> {
  const provider = createMockFieldTextSearchProvider({
    keyPresent: true,
    resultCount: 2,
  })
  const result = await provider.searchText(request)
  assert(result.ok, 'Mock provider should return success.')
  assert(result.providerStatus === 'mocked', 'Mock provider status must be mocked.')
  assert(result.results.length === 2, 'Mock provider must return requested result count.')
  assert(
    result.results.every((venue) => venue.provider === 'google_places' && venue.sourceMode === 'live'),
    'Mocked venues must use normalized ProviderVenue shape.',
  )
  process.stdout.write('mock provider success: passed\n')
}

async function assertProviderErrorMappings(): Promise<void> {
  const missingKey = await createMockFieldTextSearchProvider({
    keyPresent: false,
  }).searchText(request)
  assert(!missingKey.ok, 'Missing key mock must fail.')
  assert(
    !missingKey.ok && mapProviderErrorToBlockedReason(missingKey.errorCode) === 'provider_key_missing',
    'Missing key must map to provider_key_missing.',
  )

  const rateLimited = await createMockFieldTextSearchProvider({
    keyPresent: true,
    providerStatus: 'rate_limited',
  }).searchText(request)
  assert(!rateLimited.ok, 'Rate-limited mock must fail.')
  assert(
    !rateLimited.ok && mapProviderErrorToBlockedReason(rateLimited.errorCode) === 'provider_rate_limited',
    'Rate limit must map to provider_rate_limited.',
  )

  const unavailable = await createMockFieldTextSearchProvider({
    keyPresent: true,
    providerStatus: 'unavailable',
  }).searchText(request)
  assert(!unavailable.ok, 'Unavailable mock must fail.')
  assert(
    !unavailable.ok && mapProviderErrorToBlockedReason(unavailable.errorCode) === 'provider_unavailable',
    'Unavailable must map to provider_unavailable.',
  )
  process.stdout.write('provider error mapping: passed\n')
}

function assertServerOnlyKeyReadPath(): void {
  assert(
    readServerGooglePlacesKeyState({}).keyPresent === false,
    'Missing injected server key must report absent.',
  )
  assert(
    readServerGooglePlacesKeyState({ GOOGLE_PLACES_API_KEY: 'server-only-test-value' }).keyPresent === true,
    'Injected server key state must report present without mutating process env.',
  )
  assert(
    process.env.GOOGLE_PLACES_API_KEY === originalGooglePlacesApiKey,
    'Injected key-state checks must not mutate process GOOGLE_PLACES_API_KEY.',
  )
  assert(
    createFieldTextSearchProviderFromEnv() === null,
    'Default hosted provider factory must stay inactive in P0-B3.',
  )
  process.stdout.write('server-only key read path: passed\n')
}

async function main(): Promise<void> {
  globalThis.fetch = fetchTrap

  assertServerOnlyKeyReadPath()
  await assertMockSuccess()
  await assertProviderErrorMappings()

  assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)
  process.stdout.write('field proxy mocked provider: passed\n')
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
  .finally(() => {
    globalThis.fetch = originalFetch
    if (originalGooglePlacesApiKey === undefined) {
      delete process.env.GOOGLE_PLACES_API_KEY
    } else {
      process.env.GOOGLE_PLACES_API_KEY = originalGooglePlacesApiKey
    }
  })
