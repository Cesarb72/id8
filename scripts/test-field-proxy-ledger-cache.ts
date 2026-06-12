import {
  buildFieldTextSearchCacheKey,
  buildFieldQueryHash,
} from '../api/field/_lib/fieldCacheKeys.ts'
import {
  MockFieldLedgerStore,
  UpstashFieldLedgerStore,
  checkFieldCacheAndBudget,
  createFieldLedgerStoreFromEnv,
  fieldLedgerStoreConfig,
} from '../api/field/_lib/fieldLedgerStore.ts'
import type {
  FieldTextSearchRequest,
  FieldTextSearchResponse,
} from '../src/domain/field/fieldProxyTypes.ts'

const originalFetch = globalThis.fetch
const originalKvRestApiUrl = process.env.KV_REST_API_URL
const originalKvRestApiToken = process.env.KV_REST_API_TOKEN
let fetchCallCount = 0

const fetchTrap: typeof fetch = async () => {
  fetchCallCount += 1
  throw new Error('Field proxy ledger/cache tests must not call fetch.')
}

const date = '2026-06-11'
const cap = 32
const now = 1_780_000_000_000
const request: FieldTextSearchRequest = {
  purpose: 'retrieval_supply',
  city: 'San Jose',
  mode: 'curate',
  queryLabel: 'start-intent',
  textQuery: 'coffee near sofa san jose',
  center: {
    lat: 37.3382,
    lng: -121.8863,
  },
  radiusMeters: 5000,
  pageSize: 8,
  context: {
    starterId: 'coffee-books',
    sessionId: 'session-id-not-in-key',
  },
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function buildCachedResponse(): FieldTextSearchResponse {
  return {
    ok: true,
    cache: 'miss',
    budget: {
      date,
      cap,
      used: 4,
      remaining: 28,
    },
    results: [],
    diagnostics: {
      purpose: request.purpose,
      queryHash: buildFieldQueryHash(request.textQuery),
      resultCount: 0,
      callConsumed: true,
    },
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
}

async function assertCacheHitCostsZeroCalls(): Promise<void> {
  const cacheKey = buildFieldTextSearchCacheKey({
    date,
    environment: 'test',
    request,
  })
  const store = new MockFieldLedgerStore({
    usedByDate: {
      [date]: 7,
    },
    cacheEntries: {
      [cacheKey]: {
        response: buildCachedResponse(),
        expiresAt: now + 60_000,
      },
    },
  })

  const result = await checkFieldCacheAndBudget({
    store,
    cacheKey,
    date,
    cap,
    now,
    queryHash: buildFieldQueryHash(request.textQuery),
    purpose: request.purpose,
  })

  assert(result.status === 'hit', 'Cache hit must return hit status.')
  assert(result.response.cache === 'hit', 'Cache hit response must be marked hit.')
  assert(result.response.diagnostics.callConsumed === false, 'Cache hit must not consume a call.')
  assert(result.budget.used === 7, 'Cache hit must preserve budget usage.')
  assert(store.callLog[0]?.cache === 'hit', 'Cache hit must be logged.')
  assert(store.callLog[0]?.callConsumed === false, 'Cache hit log must record no consumption.')
  process.stdout.write('cache hit costs 0 calls: passed\n')
}

async function assertCacheMissReservesBudget(): Promise<void> {
  const cacheKey = buildFieldTextSearchCacheKey({
    date,
    environment: 'test',
    request,
  })
  const store = new MockFieldLedgerStore({
    usedByDate: {
      [date]: 3,
    },
  })

  const result = await checkFieldCacheAndBudget({
    store,
    cacheKey,
    date,
    cap,
    now,
    queryHash: buildFieldQueryHash(request.textQuery),
    purpose: request.purpose,
  })

  assert(result.status === 'miss', 'Cache miss with remaining budget must return miss status.')
  assert(result.budget.used === 4, 'Cache miss must reserve one call.')
  assert(result.budget.remaining === 28, 'Cache miss must decrement remaining budget.')
  assert(store.callLog[0]?.cache === 'miss', 'Cache miss must be logged.')
  assert(store.callLog[0]?.callConsumed === true, 'Cache miss log must record consumption.')
  process.stdout.write('cache miss budget reservation: passed\n')
}

async function assertDailyCapExhausted(): Promise<void> {
  const cacheKey = buildFieldTextSearchCacheKey({
    date,
    environment: 'test',
    request,
  })
  const store = new MockFieldLedgerStore({
    usedByDate: {
      [date]: cap,
    },
  })

  const result = await checkFieldCacheAndBudget({
    store,
    cacheKey,
    date,
    cap,
    now,
    queryHash: buildFieldQueryHash(request.textQuery),
    purpose: request.purpose,
  })

  assert(result.status === 'cap_exhausted', 'Cap exhaustion must block cache misses.')
  assert(result.budget.used === cap, 'Cap exhaustion must not increment usage.')
  assert(result.budget.remaining === 0, 'Cap exhaustion must report zero remaining.')
  assert(store.callLog[0]?.blockedReason === 'daily_cap_exhausted', 'Cap block must be logged.')
  assert(store.callLog[0]?.callConsumed === false, 'Cap block must not consume a call.')
  process.stdout.write('daily cap exhausted: passed\n')
}

function createMockUpstashFetch() {
  const values = new Map<string, string>()
  const ttls = new Map<string, number>()
  const budgetUsedByKey = new Map<string, number>()
  const commands: unknown[][] = []
  const fetchImpl = async (_input: string, init: {
    body: string
    headers: Record<string, string>
    method: 'POST'
  }) => {
    const command = JSON.parse(init.body) as unknown[]
    commands.push(command)
    const name = String(command[0]).toUpperCase()
    let result: unknown = null

    if (name === 'GET') {
      const key = String(command[1])
      result = budgetUsedByKey.has(key) ? budgetUsedByKey.get(key) : values.get(key) ?? null
    } else if (name === 'SET') {
      const key = String(command[1])
      values.set(key, String(command[2]))
      if (String(command[3]).toUpperCase() === 'PX') {
        ttls.set(key, Number(command[4]))
      }
      result = 'OK'
    } else if (name === 'DEL') {
      values.delete(String(command[1]))
      result = 1
    } else if (name === 'EVAL') {
      const key = String(command[3])
      const capValue = Number(command[4])
      const used = budgetUsedByKey.get(key) ?? 0
      if (used >= capValue) {
        result = [0, used]
      } else {
        const nextUsed = used + 1
        budgetUsedByKey.set(key, nextUsed)
        result = [1, nextUsed]
      }
    } else if (name === 'RPUSH') {
      result = 1
    } else if (name === 'EXPIRE') {
      result = 1
    }

    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({ result })
      },
    }
  }

  return {
    budgetUsedByKey,
    commands,
    fetchImpl,
    ttls,
  }
}

async function assertRealStoreFactoryAndRestBehavior(): Promise<void> {
  delete process.env.KV_REST_API_URL
  delete process.env.KV_REST_API_TOKEN
  assert(
    createFieldLedgerStoreFromEnv() === null,
    'Missing KV env must fail closed without creating a store.',
  )

  process.env.KV_REST_API_URL = 'https://example-upstash.invalid'
  process.env.KV_REST_API_TOKEN = 'test-token-not-a-provider-key'
  assert(
    createFieldLedgerStoreFromEnv() !== null,
    'KV env must create a durable ledger store.',
  )

  const mockUpstash = createMockUpstashFetch()
  const store = new UpstashFieldLedgerStore({
    fetchImpl: mockUpstash.fetchImpl,
    token: 'test-token-not-a-provider-key',
    url: 'https://example-upstash.invalid/',
  })
  const cacheKey = buildFieldTextSearchCacheKey({
    date,
    environment: 'preview',
    request,
  })
  const cacheEntry = {
    response: buildCachedResponse(),
    expiresAt: Date.now() + fieldLedgerStoreConfig.cacheTtlMs,
  }

  await store.setCachedResponse(cacheKey, cacheEntry)
  const ttl = [...mockUpstash.ttls.values()][0]
  assert(
    ttl > fieldLedgerStoreConfig.cacheTtlMs - 10_000 &&
      ttl <= fieldLedgerStoreConfig.cacheTtlMs,
    'Real store cache writes must use a 24h PX TTL.',
  )
  const cached = await store.getCachedResponse(cacheKey, Date.now())
  assert(cached?.response.ok === true, 'Real store must read back cached responses.')

  const thirtySecond = await store.reserveCall(date, cap)
  mockUpstash.budgetUsedByKey.set(`id8:field:v1:budget:${date}`, cap - 1)
  const allowedAtCap = await store.reserveCall(date, cap)
  const exhausted = await store.reserveCall(date, cap)
  assert(thirtySecond.ok === true, 'Real store must reserve a first call.')
  assert(allowedAtCap.ok === true, 'Real store must allow the 32nd call.')
  assert(allowedAtCap.budget.used === cap, 'Real store must report used=cap on the 32nd call.')
  assert(exhausted.ok === false, 'Real store must reject calls after the cap.')
  assert(
    exhausted.ok === false && exhausted.blockedReason === 'daily_cap_exhausted',
    'Real store cap exhaustion must use daily_cap_exhausted.',
  )
  assert(
    mockUpstash.commands.some((command) => command[0] === 'EVAL'),
    'Real store budget reservations must use an atomic Redis script.',
  )
  process.stdout.write('real KV REST store behavior: passed\n')
}

async function main(): Promise<void> {
  globalThis.fetch = fetchTrap

  delete process.env.KV_REST_API_URL
  delete process.env.KV_REST_API_TOKEN
  assert(createFieldLedgerStoreFromEnv() === null, 'Missing durable store must fail closed.')
  process.stdout.write('missing durable store fails closed: passed\n')

  await assertCacheHitCostsZeroCalls()
  await assertCacheMissReservesBudget()
  await assertDailyCapExhausted()
  await assertRealStoreFactoryAndRestBehavior()

  assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)
  process.stdout.write('field proxy ledger/cache: passed\n')
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
