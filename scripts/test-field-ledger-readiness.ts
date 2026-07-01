import fieldLedgerReadinessHandler from '../api/field/ledger-readiness.ts'

type ReadinessPayload = {
  ok: boolean
  service: 'field_ledger_readiness'
  storeMode: 'durable_kv' | 'unavailable'
  kvConfigured: boolean
  durableStoreAvailable: boolean
  readinessCheck: 'passed' | 'failed' | 'skipped'
  budgetCap: {
    configured: boolean
    valid: boolean
    cap: number | null
  }
  budget?: {
    date: string
    cap: number
    used: number
    remaining: number
  }
  reasons: string[]
  warnings: string[]
  diagnostics: {
    providerCallAttempted: false
    budgetReserved: false
    kvMutationAttempted: false
  }
}

const originalFetch = globalThis.fetch
const originalKvRestApiUrl = process.env.KV_REST_API_URL
const originalKvRestApiToken = process.env.KV_REST_API_TOKEN
const originalDailyCap = process.env.ID8_PROVIDER_DAILY_CALL_CAP
const originalGooglePlacesApiKey = process.env.GOOGLE_PLACES_API_KEY
const originalFieldProvider = process.env.ID8_FIELD_PROVIDER

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function restoreEnv(): void {
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
  if (originalDailyCap === undefined) {
    delete process.env.ID8_PROVIDER_DAILY_CALL_CAP
  } else {
    process.env.ID8_PROVIDER_DAILY_CALL_CAP = originalDailyCap
  }
  if (originalGooglePlacesApiKey === undefined) {
    delete process.env.GOOGLE_PLACES_API_KEY
  } else {
    process.env.GOOGLE_PLACES_API_KEY = originalGooglePlacesApiKey
  }
  if (originalFieldProvider === undefined) {
    delete process.env.ID8_FIELD_PROVIDER
  } else {
    process.env.ID8_FIELD_PROVIDER = originalFieldProvider
  }
}

function createResponse() {
  return {
    headers: {} as Record<string, string>,
    payload: null as ReadinessPayload | null,
    statusCode: null as number | null,
    status(statusCode: number) {
      this.statusCode = statusCode
      return this
    },
    json(payload: unknown) {
      this.payload = payload as ReadinessPayload
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value
    },
  }
}

function createMockUpstashFetch(params?: { fail?: boolean; used?: number }) {
  const commands: unknown[][] = []
  const fetchImpl = async (_input: string, init: {
    body: string
    headers: Record<string, string>
    method: 'POST'
  }) => {
    const command = JSON.parse(init.body) as unknown[]
    commands.push(command)
    if (params?.fail) {
      return {
        ok: false,
        status: 503,
        async text() {
          return JSON.stringify({ error: 'unavailable' })
        },
      }
    }
    const name = String(command[0]).toUpperCase()
    const result = name === 'GET' ? params?.used ?? 0 : null
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({ result })
      },
    }
  }
  return {
    commands,
    fetchImpl,
  }
}

async function callReadiness(method = 'GET'): Promise<ReturnType<typeof createResponse>> {
  const response = createResponse()
  await fieldLedgerReadinessHandler(
    {
      method,
    },
    response,
  )
  return response
}

function resetReadinessEnv(): void {
  delete process.env.KV_REST_API_URL
  delete process.env.KV_REST_API_TOKEN
  delete process.env.ID8_PROVIDER_DAILY_CALL_CAP
  delete process.env.GOOGLE_PLACES_API_KEY
  delete process.env.ID8_FIELD_PROVIDER
}

function assertNoSecrets(payload: ReadinessPayload, secrets: string[]): void {
  const serialized = JSON.stringify(payload)
  for (const secret of secrets) {
    assert(!serialized.includes(secret), `Readiness response must not expose secret value ${secret}.`)
  }
  assert(!serialized.includes('KV_REST_API_TOKEN'), 'Readiness response must not expose secret env names.')
  assert(!serialized.includes('GOOGLE_PLACES_API_KEY'), 'Readiness response must not expose provider key names.')
}

function assertReadOnlyCommands(commands: unknown[][]): void {
  assert(commands.length === 1, `Readiness must issue exactly one KV read, received ${commands.length}.`)
  assert(commands.every((command) => String(command[0]).toUpperCase() === 'GET'), 'Readiness must only issue KV GET commands.')
  assert(
    !commands.some((command) => ['EVAL', 'INCR', 'EXPIRE', 'RPUSH', 'SET', 'DEL'].includes(String(command[0]).toUpperCase())),
    'Readiness must not mutate KV, reserve budget, log calls, or touch cache.',
  )
}

async function assertMissingKvEnvFailsSafely(): Promise<void> {
  resetReadinessEnv()
  const response = await callReadiness()
  assert(response.statusCode === 503, 'Missing KV env must return 503.')
  assert(response.payload?.ok === false, 'Missing KV env must return ok:false.')
  assert(response.payload?.reasons.includes('missing_kv_env'), 'Missing KV env must use missing_kv_env.')
  assert(response.payload?.diagnostics.providerCallAttempted === false, 'Readiness must not call provider.')
  assert(response.payload?.diagnostics.budgetReserved === false, 'Readiness must not reserve budget.')
  assert(response.payload?.diagnostics.kvMutationAttempted === false, 'Readiness must not mutate KV.')
  assertNoSecrets(response.payload, ['super-secret-kv-token'])
  process.stdout.write('missing KV env safe failure: passed\n')
}

async function assertInvalidDailyCapFailsSafely(): Promise<void> {
  resetReadinessEnv()
  process.env.KV_REST_API_URL = 'https://example-upstash.invalid'
  process.env.KV_REST_API_TOKEN = 'super-secret-kv-token'
  process.env.ID8_PROVIDER_DAILY_CALL_CAP = 'not-a-number'
  const mockUpstash = createMockUpstashFetch()
  globalThis.fetch = mockUpstash.fetchImpl as typeof fetch

  const response = await callReadiness()
  assert(response.statusCode === 503, 'Invalid daily cap must return 503.')
  assert(response.payload?.ok === false, 'Invalid daily cap must return ok:false.')
  assert(response.payload?.reasons.includes('invalid_budget_cap'), 'Invalid daily cap must use invalid_budget_cap.')
  assert(response.payload?.budgetCap.valid === false, 'Invalid daily cap must be reported as invalid.')
  assert(mockUpstash.commands.length === 0, 'Invalid daily cap must not touch KV.')
  assertNoSecrets(response.payload, ['super-secret-kv-token'])
  process.stdout.write('invalid daily cap safe failure: passed\n')
}

async function assertMockedKvSuccessIsReadOnlyAndSafe(): Promise<void> {
  resetReadinessEnv()
  process.env.KV_REST_API_URL = 'https://example-upstash.invalid'
  process.env.KV_REST_API_TOKEN = 'super-secret-kv-token'
  process.env.GOOGLE_PLACES_API_KEY = 'super-secret-provider-key'
  process.env.ID8_FIELD_PROVIDER = 'google_places_text_search'
  process.env.ID8_PROVIDER_DAILY_CALL_CAP = '32'
  const mockUpstash = createMockUpstashFetch({ used: 7 })
  globalThis.fetch = mockUpstash.fetchImpl as typeof fetch

  const response = await callReadiness()
  assert(response.statusCode === 200, 'Mocked KV readiness success must return 200.')
  assert(response.payload?.ok === true, 'Mocked KV readiness success must return ok:true.')
  assert(response.payload?.service === 'field_ledger_readiness', 'Readiness payload must identify the service.')
  assert(response.payload?.storeMode === 'durable_kv', 'Readiness payload must report durable_kv store mode.')
  assert(response.payload?.kvConfigured === true, 'Readiness payload must report configured KV.')
  assert(response.payload?.durableStoreAvailable === true, 'Readiness payload must report available durable store.')
  assert(response.payload?.readinessCheck === 'passed', 'Readiness check must pass.')
  assert(response.payload?.budgetCap.cap === 32, 'Readiness payload must report parsed cap.')
  assert(response.payload?.budget?.used === 7, 'Readiness payload must report read-only budget usage.')
  assert(response.payload?.budget?.remaining === 25, 'Readiness payload must report read-only remaining budget.')
  assert(response.payload?.diagnostics.providerCallAttempted === false, 'Readiness must not call provider.')
  assert(response.payload?.diagnostics.budgetReserved === false, 'Readiness must not reserve budget.')
  assert(response.payload?.diagnostics.kvMutationAttempted === false, 'Readiness must not mutate KV.')
  assertReadOnlyCommands(mockUpstash.commands)
  assertNoSecrets(response.payload, ['super-secret-kv-token', 'super-secret-provider-key'])
  process.stdout.write('mocked KV success read-only safe response: passed\n')
}

async function assertMockedKvFailureIsSafe(): Promise<void> {
  resetReadinessEnv()
  process.env.KV_REST_API_URL = 'https://example-upstash.invalid'
  process.env.KV_REST_API_TOKEN = 'super-secret-kv-token'
  process.env.ID8_PROVIDER_DAILY_CALL_CAP = '32'
  const mockUpstash = createMockUpstashFetch({ fail: true })
  globalThis.fetch = mockUpstash.fetchImpl as typeof fetch

  const response = await callReadiness()
  assert(response.statusCode === 503, 'Mocked KV failure must return 503.')
  assert(response.payload?.ok === false, 'Mocked KV failure must return ok:false.')
  assert(response.payload?.reasons.includes('readiness_check_unavailable'), 'Mocked KV failure must use readiness_check_unavailable.')
  assert(response.payload?.durableStoreAvailable === true, 'Constructed store should be reported separately from failed readiness.')
  assert(response.payload?.diagnostics.providerCallAttempted === false, 'Readiness failure must not call provider.')
  assert(response.payload?.diagnostics.budgetReserved === false, 'Readiness failure must not reserve budget.')
  assert(response.payload?.diagnostics.kvMutationAttempted === false, 'Readiness failure must not mutate KV.')
  assertReadOnlyCommands(mockUpstash.commands)
  assertNoSecrets(response.payload, ['super-secret-kv-token'])
  process.stdout.write('mocked KV failure safe response: passed\n')
}

async function assertInvalidMethodDoesNotTouchKv(): Promise<void> {
  resetReadinessEnv()
  process.env.KV_REST_API_URL = 'https://example-upstash.invalid'
  process.env.KV_REST_API_TOKEN = 'super-secret-kv-token'
  const mockUpstash = createMockUpstashFetch()
  globalThis.fetch = mockUpstash.fetchImpl as typeof fetch

  const response = await callReadiness('POST')
  assert(response.statusCode === 405, 'Invalid readiness method must return 405.')
  assert(response.payload?.reasons.includes('invalid_method'), 'Invalid method must use invalid_method.')
  assert(mockUpstash.commands.length === 0, 'Invalid method must not touch KV.')
  assertNoSecrets(response.payload, ['super-secret-kv-token'])
  process.stdout.write('invalid method does not touch KV: passed\n')
}

async function main(): Promise<void> {
  await assertMissingKvEnvFailsSafely()
  await assertInvalidDailyCapFailsSafely()
  await assertMockedKvSuccessIsReadOnlyAndSafe()
  await assertMockedKvFailureIsSafe()
  await assertInvalidMethodDoesNotTouchKv()
  process.stdout.write('field ledger readiness endpoint: passed\n')
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
