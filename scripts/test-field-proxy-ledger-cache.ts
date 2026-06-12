import {
  buildFieldTextSearchCacheKey,
  buildFieldQueryHash,
} from '../api/field/_lib/fieldCacheKeys.ts'
import {
  MockFieldLedgerStore,
  checkFieldCacheAndBudget,
  createFieldLedgerStoreFromEnv,
} from '../api/field/_lib/fieldLedgerStore.ts'
import type {
  FieldTextSearchRequest,
  FieldTextSearchResponse,
} from '../src/domain/field/fieldProxyTypes.ts'

const originalFetch = globalThis.fetch
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

async function main(): Promise<void> {
  globalThis.fetch = fetchTrap

  assert(
    createFieldLedgerStoreFromEnv() === null,
    'P0-B2 hosted ledger factory must fail closed until durable store is provisioned.',
  )
  process.stdout.write('missing durable store fails closed: passed\n')

  await assertCacheHitCostsZeroCalls()
  await assertCacheMissReservesBudget()
  await assertDailyCapExhausted()

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
  })
