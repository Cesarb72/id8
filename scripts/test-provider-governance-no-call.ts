import {
  searchPlaces,
  type ProviderTextSearchQuery,
} from '../src/domain/providers/ProviderAdapter.ts'
import {
  providerGovernanceConfig,
} from '../src/domain/providers/providerGovernance.ts'
import type { ProviderCallPurpose } from '../src/domain/providers/providerCallTrace.ts'
import type { SourceMode } from '../src/domain/types/sourceMode.ts'

type NoCallResult = {
  ok: true
}

const googleKeyEnvKey = 'VITE_GOOGLE_PLACES_API_KEY'
const anchorActivationEnvKey = providerGovernanceConfig.activationEnvKeys.anchor_search
const globalBudgetCapEnvKey = providerGovernanceConfig.budgetCapEnvKeys.global

if (!anchorActivationEnvKey) {
  throw new Error('Expected anchor_search activation env key to be configured.')
}

const managedEnvKeys = [
  googleKeyEnvKey,
  anchorActivationEnvKey,
  globalBudgetCapEnvKey,
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

function setProviderReadyEnv(): void {
  process.env[googleKeyEnvKey] = 'test-key-not-used'
  process.env[anchorActivationEnvKey] = '1'
  process.env[globalBudgetCapEnvKey] = '1'
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

async function main(): Promise<void> {
  globalThis.fetch = blockedFetch

  resetEnv()
  setRoute('/')
  process.env[googleKeyEnvKey] = 'test-key-not-used'
  process.env[globalBudgetCapEnvKey] = '1'
  await expectBlockedWithoutFetch({
    name: 'activation flags absent',
    expectedReason: anchorActivationEnvKey,
    run: () => runSearch({ sourceMode: 'live' }),
  })

  resetEnv()
  setRoute('/')
  setProviderReadyEnv()
  await expectBlockedWithoutFetch({
    name: 'sourceMode curated',
    expectedReason: 'sourceMode is curated',
    run: () => runSearch({ sourceMode: 'curated' }),
  })

  resetEnv()
  setRoute('/')
  process.env[googleKeyEnvKey] = 'test-key-not-used'
  process.env[anchorActivationEnvKey] = '1'
  await expectBlockedWithoutFetch({
    name: 'budget exceeded',
    expectedReason: 'Provider call budget blocked',
    run: () => runSearch({ sourceMode: 'live' }),
  })

  resetEnv()
  setRoute('/dev/start/build')
  setProviderReadyEnv()
  await expectBlockedWithoutFetch({
    name: 'dev route hard block',
    expectedReason: 'dev/sandbox closeout flow',
    run: () => runSearch({ sourceMode: 'live' }),
  })

  resetEnv()
  setRoute('/sandbox/start/build')
  setProviderReadyEnv()
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
