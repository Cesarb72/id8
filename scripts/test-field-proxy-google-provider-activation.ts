import fieldTextSearchHandler from '../api/field/text-search.ts'
import {
  buildGoogleTextSearchRequestBody,
  createFieldTextSearchProviderActivationFromEnv,
  createFieldTextSearchProviderFromEnv,
  fieldTextSearchProviderActivationValue,
  googleTextSearchEndpoint,
  googleTextSearchFieldMask,
} from '../api/field/_lib/fieldTextSearchProvider.ts'
import type {
  FieldTextSearchRequest,
  FieldTextSearchResponse,
} from '../src/domain/field/fieldProxyTypes.ts'

const originalFetch = globalThis.fetch
const originalGooglePlacesApiKey = process.env.GOOGLE_PLACES_API_KEY
const originalId8FieldProvider = process.env.ID8_FIELD_PROVIDER
const originalKvRestApiUrl = process.env.KV_REST_API_URL
const originalKvRestApiToken = process.env.KV_REST_API_TOKEN
const originalVercelEnv = process.env.VERCEL_ENV

const testApiKey = 'redacted-test-google-key'
const request: FieldTextSearchRequest = {
  purpose: 'retrieval_supply',
  city: 'San Jose',
  mode: 'curate',
  queryLabel: 'phase-2-live-text-search-smoke',
  textQuery: 'coffee downtown san jose',
  center: {
    lat: 37.3382,
    lng: -121.8863,
  },
  radiusMeters: 5000,
  pageSize: 3,
  context: {
    starterId: 'coffee-books',
    vibe: 'cozy',
    persona: 'romantic',
    timeWindow: 'evening',
    neighborhood: 'Downtown San Jose',
  },
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function restoreEnv(): void {
  if (originalGooglePlacesApiKey === undefined) {
    delete process.env.GOOGLE_PLACES_API_KEY
  } else {
    process.env.GOOGLE_PLACES_API_KEY = originalGooglePlacesApiKey
  }
  if (originalId8FieldProvider === undefined) {
    delete process.env.ID8_FIELD_PROVIDER
  } else {
    process.env.ID8_FIELD_PROVIDER = originalId8FieldProvider
  }
  if (originalKvRestApiUrl === undefined) {
    delete process.env.KV_REST_API_URL
  } else {
    process.env.KV_REST_API_URL = originalKvRestApiUrl
  }
  if (originalKvRestApiToken === undefined) {
    delete process.env.KV_REST_API_TOKEN
  } else {
    process.env.KV_REST_API_TOKEN = originalKvRestApiToken
  }
  if (originalVercelEnv === undefined) {
    delete process.env.VERCEL_ENV
  } else {
    process.env.VERCEL_ENV = originalVercelEnv
  }
}

function getHeader(headers: HeadersInit | undefined, name: string): string | null {
  if (!headers) {
    return null
  }
  if (headers instanceof Headers) {
    return headers.get(name)
  }
  if (Array.isArray(headers)) {
    const pair = headers.find(([key]) => key.toLowerCase() === name.toLowerCase())
    return pair?.[1] ?? null
  }
  const record = headers as Record<string, string>
  return record[name] ?? record[name.toLowerCase()] ?? null
}

function createResponse() {
  return {
    statusCode: null as number | null,
    payload: null as FieldTextSearchResponse | null,
    status(statusCode: number) {
      this.statusCode = statusCode
      return this
    },
    json(payload: unknown) {
      this.payload = payload as FieldTextSearchResponse
    },
    setHeader() {},
  }
}

function createMockUpstashFetch(commands: unknown[][]): typeof fetch {
  return async (input, init) => {
    assert(
      String(input) !== googleTextSearchEndpoint,
      'Missing-key route validation must not call Google Text Search.',
    )
    assert(init?.body, 'Mock Upstash request must include a REST command body.')
    const command = JSON.parse(String(init.body)) as unknown[]
    commands.push(command)
    const name = String(command[0]).toUpperCase()
    const result = name === 'GET' ? null : name === 'RPUSH' || name === 'EXPIRE' ? 1 : 'OK'
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({ result })
      },
    } as Response
  }
}

async function assertActivationGate(): Promise<void> {
  let fetchCallCount = 0
  const fakeFetch: typeof fetch = async () => {
    fetchCallCount += 1
    throw new Error('Provider creation must not call fetch.')
  }

  assert(
    createFieldTextSearchProviderActivationFromEnv({}, fakeFetch).status === 'inactive',
    'No key and no activation flag must keep provider inactive.',
  )
  assert(
    createFieldTextSearchProviderActivationFromEnv({
      GOOGLE_PLACES_API_KEY: testApiKey,
    }, fakeFetch).status === 'inactive',
    'Key alone must keep provider inactive.',
  )
  assert(
    createFieldTextSearchProviderActivationFromEnv({
      ID8_FIELD_PROVIDER: fieldTextSearchProviderActivationValue,
    }, fakeFetch).status === 'missing_key',
    'Activation flag alone must fail as provider_key_missing.',
  )
  assert(
    createFieldTextSearchProviderFromEnv({
      GOOGLE_PLACES_API_KEY: testApiKey,
      ID8_FIELD_PROVIDER: fieldTextSearchProviderActivationValue,
    }, fakeFetch) !== null,
    'Key plus server-only activation flag must create the provider.',
  )
  assert(fetchCallCount === 0, 'Provider activation checks must not call fetch.')
  process.stdout.write('google provider activation gate: passed\n')
}

async function assertGoogleProviderRequestAndMapping(): Promise<void> {
  const captured: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []
  const fakeFetch: typeof fetch = async (input, init) => {
    captured.push({ input, init })
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          places: [
            {
              id: 'places/mock-place-id',
              displayName: { text: 'Mock Coffee' },
              formattedAddress: '1 Mock Plaza, San Jose, CA 95113',
              location: {
                latitude: 37.3382,
                longitude: -121.8863,
              },
              types: ['cafe', 'food', 'point_of_interest'],
              primaryType: 'cafe',
              businessStatus: 'OPERATIONAL',
              rating: 4.6,
              userRatingCount: 128,
              regularOpeningHours: {
                openNow: true,
                weekdayDescriptions: ['Monday: 8:00 AM - 5:00 PM'],
                periods: [
                  {
                    open: { day: 1, hour: 8, minute: 0 },
                    close: { day: 1, hour: 17, minute: 0 },
                  },
                ],
              },
            },
          ],
        }
      },
    } as Response
  }

  const activation = createFieldTextSearchProviderActivationFromEnv({
    GOOGLE_PLACES_API_KEY: testApiKey,
    ID8_FIELD_PROVIDER: fieldTextSearchProviderActivationValue,
  }, fakeFetch)
  assert(activation.status === 'active', 'Key plus activation flag must be active.')

  const result = await activation.provider.searchText(request)
  assert(result.ok, 'Mocked Google Text Search response must normalize successfully.')
  assert(captured.length === 1, 'Provider search must issue exactly one fetch.')
  assert(String(captured[0].input) === googleTextSearchEndpoint, 'Provider must call Text Search (New) only.')
  assert(!String(captured[0].input).includes('/v1/places/'), 'Provider must not call Details API.')
  assert(captured[0].init?.method === 'POST', 'Provider must use POST.')
  assert(
    getHeader(captured[0].init?.headers, 'X-Goog-Api-Key') === testApiKey,
    'Provider must send the API key only in the server-side Google header.',
  )
  assert(
    getHeader(captured[0].init?.headers, 'X-Goog-FieldMask') === googleTextSearchFieldMask,
    'Provider must send the minimal configured field mask.',
  )
  assert(!googleTextSearchFieldMask.includes('*'), 'Field mask must not request wildcard fields.')
  assert(
    !/photos|reviews|editorialSummary|generativeSummary|nationalPhoneNumber|internationalPhoneNumber/.test(
      googleTextSearchFieldMask,
    ),
    'Field mask must not request forbidden rich/contact fields.',
  )

  const body = JSON.parse(String(captured[0].init?.body)) as ReturnType<
    typeof buildGoogleTextSearchRequestBody
  >
  assert(JSON.stringify(body) === JSON.stringify(buildGoogleTextSearchRequestBody(request)), 'Provider request body must be deterministic.')
  assert(!JSON.stringify(body).includes(testApiKey), 'Provider request body must not include the API key.')

  const venue = result.results[0]
  assert(venue.provider === 'google_places', 'Normalized venue must identify Google Places provider.')
  assert(venue.providerRecordId === 'places/mock-place-id', 'Normalized venue must preserve Google place id.')
  assert(venue.displayName === 'Mock Coffee', 'Normalized venue must map displayName.text.')
  assert(venue.location?.latitude === 37.3382, 'Normalized venue must map latitude.')
  assert(venue.primaryType === 'cafe', 'Normalized venue must map primaryType.')
  assert(venue.regularOpeningHours?.openNow === true, 'Normalized venue must map opening hours.')
  assert(venue.sourceMode === 'live', 'Normalized venue must use live source mode.')
  process.stdout.write('google provider request and mapping: passed\n')
}

async function assertFlagAloneRouteDoesNotReserveBudget(): Promise<void> {
  const commands: unknown[][] = []
  process.env.KV_REST_API_URL = 'https://example-upstash.invalid/'
  process.env.KV_REST_API_TOKEN = 'test-token-not-a-provider-key'
  process.env.VERCEL_ENV = 'preview'
  process.env.ID8_FIELD_PROVIDER = fieldTextSearchProviderActivationValue
  delete process.env.GOOGLE_PLACES_API_KEY
  globalThis.fetch = createMockUpstashFetch(commands)

  const response = createResponse()
  await fieldTextSearchHandler(
    {
      method: 'POST',
      body: request,
    },
    response,
  )

  assert(response.statusCode === 503, 'Activation flag without key must return 503.')
  assert(response.payload?.ok === false, 'Activation flag without key must return structured JSON.')
  assert(
    response.payload?.diagnostics.blockedReason === 'provider_key_missing',
    'Activation flag without key must fail closed as provider_key_missing.',
  )
  assert(
    response.payload?.diagnostics.callConsumed === false,
    'Activation flag without key must not consume a provider call.',
  )
  assert(response.payload?.budget.used === 0, 'Activation flag without key must not reserve budget.')
  assert(!commands.some((command) => command[0] === 'EVAL'), 'Activation flag without key must not reserve budget.')
  assert(!commands.some((command) => command[0] === 'RPUSH'), 'Activation flag without key must not log a provider call.')
  process.stdout.write('flag-alone route budget silence: passed\n')
}

async function main(): Promise<void> {
  const logs: string[] = []
  const originalConsoleLog = console.log
  const originalConsoleError = console.error
  console.log = (...args: unknown[]) => {
    logs.push(args.join(' '))
    originalConsoleLog(...args)
  }
  console.error = (...args: unknown[]) => {
    logs.push(args.join(' '))
    originalConsoleError(...args)
  }

  try {
    await assertActivationGate()
    await assertGoogleProviderRequestAndMapping()
    await assertFlagAloneRouteDoesNotReserveBudget()
    assert(!logs.some((line) => line.includes(testApiKey)), 'Test API key must not be logged.')
    process.stdout.write('field proxy Google provider activation: passed\n')
  } finally {
    console.log = originalConsoleLog
    console.error = originalConsoleError
  }
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
  .finally(() => {
    globalThis.fetch = originalFetch
    restoreEnv()
  })
