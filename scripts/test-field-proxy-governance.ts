import fieldTextSearchHandler from '../api/field/text-search.ts'
import {
  buildFieldContextKey,
  buildFieldTextSearchCacheKey,
  buildFieldQueryHash,
} from '../api/field/_lib/fieldCacheKeys.ts'
import {
  validateFieldProxyMethod,
  validateFieldTextSearchRequestBody,
  type FieldRequestValidationFailureReason,
} from '../api/field/_lib/fieldRequestValidation.ts'
import type {
  FieldTextSearchRequest,
  FieldTextSearchResponse,
} from '../src/domain/field/fieldProxyTypes.ts'

const originalFetch = globalThis.fetch
let fetchCallCount = 0

const fetchTrap: typeof fetch = async () => {
  fetchCallCount += 1
  throw new Error('Field proxy governance tests must not call fetch.')
}

const validRequest: FieldTextSearchRequest = {
  purpose: 'retrieval_supply',
  city: 'San Jose',
  mode: 'curate',
  queryLabel: 'highlight-intent',
  textQuery: 'live music in downtown san jose',
  center: {
    lat: 37.3382,
    lng: -121.8863,
  },
  radiusMeters: 5100,
  pageSize: 8,
  context: {
    starterId: 'live-music-loop',
    vibe: 'cultured',
    persona: 'friends',
    timeWindow: 'evening',
    neighborhood: 'SoFA',
    sessionId: 'raw-session-id-must-not-leak',
  },
}

interface CapturedResponse {
  statusCode: number | null
  payload: FieldTextSearchResponse | null
  headers: Record<string, string>
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function expectValidationFailure(
  name: string,
  body: unknown,
  expectedReason: FieldRequestValidationFailureReason,
): void {
  const result = validateFieldTextSearchRequestBody(body)
  assert(!result.ok, `${name}: expected validation to fail.`)
  assert(
    result.reason === expectedReason,
    `${name}: expected ${expectedReason}, received ${result.reason}.`,
  )
  process.stdout.write(`${name}: passed\n`)
}

function omitField<T extends Record<string, unknown>>(value: T, key: keyof T): Record<string, unknown> {
  const next = { ...value }
  delete next[key]
  return next
}

function createResponse(): CapturedResponse & {
  status: (statusCode: number) => ReturnType<typeof createResponse>
  json: (payload: unknown) => void
  setHeader: (name: string, value: string) => void
} {
  const captured: CapturedResponse = {
    statusCode: null,
    payload: null,
    headers: {},
  }
  return {
    ...captured,
    status(statusCode) {
      this.statusCode = statusCode
      return this
    },
    json(payload) {
      this.payload = payload as FieldTextSearchResponse
    },
    setHeader(name, value) {
      this.headers[name] = value
    },
  }
}

async function expectHandlerBlocked(params: {
  name: string
  method?: string
  body: unknown
  expectedStatus: number
  expectedReason: FieldRequestValidationFailureReason
}): Promise<void> {
  const response = createResponse()
  await fieldTextSearchHandler(
    {
      method: params.method,
      body: params.body,
    },
    response,
  )
  assert(
    response.statusCode === params.expectedStatus,
    `${params.name}: expected status ${params.expectedStatus}, received ${response.statusCode ?? 'none'}.`,
  )
  assert(response.payload, `${params.name}: expected JSON payload.`)
  assert(response.payload.ok === false, `${params.name}: expected ok:false.`)
  assert(
    response.payload.diagnostics.blockedReason === params.expectedReason,
    `${params.name}: expected blockedReason ${params.expectedReason}, received ${response.payload.diagnostics.blockedReason ?? 'none'}.`,
  )
  assert(response.payload.diagnostics.callConsumed === false, `${params.name}: expected no budget consumption.`)
  assert(response.payload.diagnostics.resultCount === 0, `${params.name}: expected resultCount 0.`)
  assert(response.payload.results.length === 0, `${params.name}: expected empty results.`)
  process.stdout.write(`${params.name}: passed\n`)
}

async function main(): Promise<void> {
  globalThis.fetch = fetchTrap

  const methodFailure = validateFieldProxyMethod('GET')
  assert(methodFailure && !methodFailure.ok, 'GET must fail method validation.')
  assert(methodFailure.reason === 'invalid_method', 'GET must report invalid_method.')
  process.stdout.write('POST only validation: passed\n')

  expectValidationFailure('missing purpose', omitField(validRequest, 'purpose'), 'missing_purpose')
  expectValidationFailure(
    'invalid purpose',
    { ...validRequest, purpose: 'details_lookup' },
    'invalid_purpose',
  )
  expectValidationFailure('missing city', omitField(validRequest, 'city'), 'missing_city')
  expectValidationFailure(
    'unsupported city',
    { ...validRequest, city: 'Denver' },
    'unsupported_city',
  )
  expectValidationFailure('missing mode', omitField(validRequest, 'mode'), 'missing_mode')
  expectValidationFailure('invalid mode', { ...validRequest, mode: 'plan' }, 'invalid_mode')
  expectValidationFailure(
    'missing queryLabel',
    omitField(validRequest, 'queryLabel'),
    'missing_query_label',
  )
  expectValidationFailure(
    'missing textQuery',
    omitField(validRequest, 'textQuery'),
    'missing_text_query',
  )
  expectValidationFailure(
    'invalid center',
    { ...validRequest, center: { lat: 100, lng: -121.8863 } },
    'invalid_center',
  )
  expectValidationFailure(
    'invalid radius',
    { ...validRequest, radiusMeters: -1 },
    'invalid_radius',
  )
  expectValidationFailure(
    'invalid pageSize',
    { ...validRequest, pageSize: 0 },
    'invalid_page_size',
  )

  const validValidation = validateFieldTextSearchRequestBody(validRequest)
  assert(validValidation.ok, 'Valid request must pass validation before fail-closed runtime.')

  const contextKey = buildFieldContextKey(validRequest.context)
  const cacheKey = buildFieldTextSearchCacheKey({
    date: '2026-06-11',
    environment: 'test',
    request: validRequest,
  })
  assert(
    !contextKey.includes('raw-session-id-must-not-leak') &&
      !cacheKey.includes('raw-session-id-must-not-leak'),
    'Raw sessionId must not appear in context/cache keys.',
  )
  assert(
    buildFieldQueryHash(validRequest.textQuery) === buildFieldQueryHash('  LIVE   MUSIC IN DOWNTOWN SAN JOSE '),
    'Query hash must normalize whitespace and case deterministically.',
  )
  process.stdout.write('cache key privacy and query hashing: passed\n')

  await expectHandlerBlocked({
    name: 'handler invalid method',
    method: 'GET',
    body: validRequest,
    expectedStatus: 405,
    expectedReason: 'invalid_method',
  })
  await expectHandlerBlocked({
    name: 'handler invalid json',
    method: 'POST',
    body: '{not-json',
    expectedStatus: 400,
    expectedReason: 'invalid_json',
  })
  await expectHandlerBlocked({
    name: 'handler valid request fails closed',
    method: 'POST',
    body: validRequest,
    expectedStatus: 503,
    expectedReason: 'field_proxy_not_activated',
  })

  assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)
  process.stdout.write('field proxy governance: passed\n')
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
