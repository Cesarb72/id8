import {
  searchPlaces,
  type ProviderTextSearchQuery,
} from '../src/domain/providers/ProviderAdapter.ts'
import type { ProviderCallPurpose } from '../src/domain/providers/providerCallTrace.ts'
import type { SourceMode } from '../src/domain/types/sourceMode.ts'

type NoCallResult = {
  ok: true
}

const managedEnvKeys = [
  'VITE_GOOGLE_PLACES_API_KEY',
  'VITE_PROVIDER_API_KEY',
  'GOOGLE_PLACES_API_KEY',
]

const originalEnvValues = new Map(
  managedEnvKeys.map((key) => [key, process.env[key]] as const),
)
const originalFetch = globalThis.fetch
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
let fetchCallCount = 0

const blockedFetch: typeof fetch = async () => {
  fetchCallCount += 1
  throw new Error('fetch should not be called by provider governance no-call tests.')
}

const fieldProxyFailClosedFetch: typeof fetch = async (input, init) => {
  fetchCallCount += 1
  const url = String(input)
  assert(url === '/api/field/text-search', `Expected Field proxy path, received ${url}.`)
  assert(!url.includes('places.googleapis.com'), 'Browser must not call Google Places.')
  const body = JSON.parse(String(init?.body)) as { purpose?: string }
  return {
    ok: false,
    status: 503,
    async json() {
      return {
        ok: false,
        cache: 'miss',
        budget: {
          date: '2026-06-13',
          cap: 32,
          used: 0,
          remaining: 32,
        },
        results: [],
        diagnostics: {
          purpose: body.purpose ?? 'retrieval_supply',
          queryHash: 'mock-query-hash',
          blockedReason: 'field_proxy_not_activated',
          errorCode: 'field_proxy_not_activated',
          resultCount: 0,
          callConsumed: false,
        },
      }
    },
  } as Response
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

function resetEnv(): void {
  for (const key of managedEnvKeys) {
    delete process.env[key]
  }
}

function setRoute(pathname: string | null): void {
  if (!pathname) {
    if (originalWindowDescriptor) {
      Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
    } else {
      Reflect.deleteProperty(globalThis, 'window')
    }
    return
  }

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: {
        pathname,
      },
    },
  })
}

function buildQueries(count: number): ProviderTextSearchQuery[] {
  return Array.from({ length: count }, (_, index) => ({
    fieldMask: 'places.id,places.displayName',
    queryLabel: `no-call-${index}`,
    textQuery: 'Paper Plane San Jose',
  }))
}

async function runSearch(input: {
  callPurpose?: ProviderCallPurpose
  queryCount?: number
  sourceMode?: SourceMode
}): Promise<string | undefined> {
  const result = await searchPlaces<NoCallResult, ProviderTextSearchQuery>({
    callPurpose: input.callPurpose ?? 'anchor_search',
    mapPlace: () => ({ ok: true }),
    queries: buildQueries(input.queryCount ?? 1),
    sourceMode: input.sourceMode,
  })
  return result.diagnostics.failureReason
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

async function expectBlockedWithoutFetch(params: {
  name: string
  expectedReason: string
  run: () => Promise<string | undefined>
}): Promise<void> {
  fetchCallCount = 0
  const failureReason = await params.run()
  assert(
    failureReason?.includes(params.expectedReason) === true,
    `${params.name}: expected reason to include "${params.expectedReason}", received "${failureReason ?? 'none'}".`,
  )
  assert(fetchCallCount === 0, `${params.name}: expected fetch not to be called.`)
  process.stdout.write(`${params.name}: passed\n`)
}

async function expectFieldProxyOnly(params: {
  name: string
  expectedReason: string
  expectedFetchCount: number
  run: () => Promise<string | undefined>
}): Promise<void> {
  fetchCallCount = 0
  globalThis.fetch = fieldProxyFailClosedFetch
  const failureReason = await params.run()
  assert(
    failureReason?.includes(params.expectedReason) === true,
    `${params.name}: expected reason to include "${params.expectedReason}", received "${failureReason ?? 'none'}".`,
  )
  assert(
    fetchCallCount === params.expectedFetchCount,
    `${params.name}: expected ${params.expectedFetchCount} Field proxy fetch(es), received ${fetchCallCount}.`,
  )
  process.stdout.write(`${params.name}: passed\n`)
  globalThis.fetch = blockedFetch
}

async function main(): Promise<void> {
  globalThis.fetch = blockedFetch

  resetEnv()
  setRoute('/')
  await expectFieldProxyOnly({
    name: 'browser provider path uses Field proxy',
    expectedReason: 'field_proxy_not_activated',
    expectedFetchCount: 1,
    run: () => runSearch({ sourceMode: 'live' }),
  })

  resetEnv()
  setRoute('/')
  await expectBlockedWithoutFetch({
    name: 'sourceMode curated',
    expectedReason: 'sourceMode is curated',
    run: () => runSearch({ sourceMode: 'curated' }),
  })

  resetEnv()
  setRoute('/')
  await expectFieldProxyOnly({
    name: 'browser provider path uses Field proxy with multiple queries',
    expectedReason: 'field_proxy_not_activated',
    expectedFetchCount: 2,
    run: () => runSearch({ queryCount: 2, sourceMode: 'live' }),
  })

  resetEnv()
  setRoute('/dev/start/build')
  await expectBlockedWithoutFetch({
    name: 'dev route hard block',
    expectedReason: 'dev/sandbox closeout flow',
    run: () => runSearch({ sourceMode: 'live' }),
  })

  resetEnv()
  setRoute('/sandbox/start/build')
  await expectBlockedWithoutFetch({
    name: 'sandbox route hard block',
    expectedReason: 'dev/sandbox closeout flow',
    run: () => runSearch({ sourceMode: 'live' }),
  })
}

main()
  .finally(() => {
    globalThis.fetch = originalFetch
    setRoute(null)
    restoreEnv()
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
