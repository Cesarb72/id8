import { starterPacks } from '../src/data/starterPacks.ts'
import { buildExperienceLens } from '../src/domain/intent/buildExperienceLens.ts'
import { normalizeIntent } from '../src/domain/intent/normalizeIntent.ts'
import {
  providerGovernanceConfig,
} from '../src/domain/providers/providerGovernance.ts'
import {
  providerProofGateConfig,
  resolveCurateProofSourceMode,
} from '../src/domain/providers/providerProofGate.ts'
import { retrieveVenues } from '../src/domain/retrieval/retrieveVenues.ts'
import type { ExperienceMode, IntentInput, IntentProfile } from '../src/domain/types/intent.ts'
import type { SourceMode } from '../src/domain/types/sourceMode.ts'
import type { StarterPack } from '../src/domain/types/starterPack.ts'

const googleKeyEnvKey = 'VITE_GOOGLE_PLACES_API_KEY'
const retrievalActivationEnvKey = providerGovernanceConfig.activationEnvKeys.retrieval_supply
const retrievalBudgetCapEnvKey =
  providerGovernanceConfig.budgetCapEnvKeys.byPurpose.retrieval_supply
const proofEnabledEnvKey = providerProofGateConfig.dessertConversation.enabledEnvKey

if (!retrievalActivationEnvKey || !retrievalBudgetCapEnvKey) {
  throw new Error('Expected retrieval_supply governance env keys to be configured.')
}

const managedEnvKeys = [
  googleKeyEnvKey,
  proofEnabledEnvKey,
  retrievalActivationEnvKey,
  retrievalBudgetCapEnvKey,
]

const originalEnvValues = new Map(
  managedEnvKeys.map((key) => [key, process.env[key]] as const),
)
const originalFetch = globalThis.fetch
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')

let fetchCallCount = 0
const fetchTextQueries: string[] = []

const mockedProviderFetch: typeof fetch = async (_input, init) => {
  fetchCallCount += 1
  const body = typeof init?.body === 'string'
    ? (JSON.parse(init.body) as { textQuery?: string })
    : {}
  if (body.textQuery) {
    fetchTextQueries.push(body.textQuery)
  }
  return new Response(JSON.stringify({ places: [] }), {
    headers: {
      'Content-Type': 'application/json',
    },
    status: 200,
  })
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
        search: '',
      },
    },
  })
}

function setProofReadyEnv(): void {
  process.env[googleKeyEnvKey] = 'test-key-not-used'
  process.env[proofEnabledEnvKey] = '1'
  process.env[retrievalActivationEnvKey] = '1'
  process.env[retrievalBudgetCapEnvKey] = '1'
}

function getStarterPack(id: string): StarterPack {
  const starterPack = starterPacks.find((pack) => pack.id === id)
  if (!starterPack) {
    throw new Error(`Expected starter pack "${id}" to exist.`)
  }
  return starterPack
}

function buildIntent(mode: ExperienceMode): IntentProfile {
  const input: IntentInput = {
    city: 'San Jose',
    distanceMode: 'nearby',
    mode,
    persona: 'romantic',
    prefersHiddenGems: false,
    primaryVibe: 'chill',
  }
  return normalizeIntent(input)
}

async function runRetrieval(params: {
  mode: ExperienceMode
  requestedSourceMode: SourceMode
  starterPack?: StarterPack
}): Promise<{
  liveFetchAttempted: boolean
  liveQueryLabelsUsed: string[]
  queryCount: number
}> {
  const intent = buildIntent(params.mode)
  const lens = buildExperienceLens({
    intent,
    starterPack: params.starterPack,
  })
  const result = await retrieveVenues(intent, lens, {
    requestedSourceMode: params.requestedSourceMode,
    sourceModeOverrideApplied: true,
    starterPack: params.starterPack,
  })
  return {
    liveFetchAttempted: result.sourceMode.liveFetchAttempted,
    liveQueryLabelsUsed: result.sourceMode.liveQueryLabelsUsed,
    queryCount: result.sourceMode.queryCount,
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function resetFetchTracking(): void {
  fetchCallCount = 0
  fetchTextQueries.length = 0
}

function assertBridgeSourceMode(params: {
  name: string
  mode: ExperienceMode
  starterPack?: StarterPack
  expectedSourceMode: SourceMode
}): SourceMode {
  const sourceMode = resolveCurateProofSourceMode({
    mode: params.mode,
    starterPack: params.starterPack,
  })
  assert(
    sourceMode === params.expectedSourceMode,
    `${params.name}: expected bridge source mode ${params.expectedSourceMode}, received ${sourceMode}.`,
  )
  return sourceMode
}

async function expectNoProviderCall(params: {
  name: string
  run: () => Promise<void>
}): Promise<void> {
  resetFetchTracking()
  await params.run()
  assert(fetchCallCount === 0, `${params.name}: expected fetch not to be called.`)
  process.stdout.write(`${params.name}: passed\n`)
}

async function main(): Promise<void> {
  globalThis.fetch = mockedProviderFetch
  const dessertStarter = getStarterPack(providerProofGateConfig.dessertConversation.starterId)
  const coffeeStarter = getStarterPack('coffee-books')

  resetEnv()
  setRoute('/')
  process.env[googleKeyEnvKey] = 'test-key-not-used'
  process.env[retrievalActivationEnvKey] = '1'
  process.env[retrievalBudgetCapEnvKey] = '1'
  await expectNoProviderCall({
    name: 'proof env absent bridge',
    run: async () => {
      const requestedSourceMode = assertBridgeSourceMode({
        name: 'proof env absent bridge',
        mode: 'curate',
        starterPack: dessertStarter,
        expectedSourceMode: 'curated',
      })
      const result = await runRetrieval({
        mode: 'curate',
        requestedSourceMode,
        starterPack: dessertStarter,
      })
      assert(!result.liveFetchAttempted, 'Expected live fetch not to be attempted.')
    },
  })

  resetEnv()
  setRoute('/')
  setProofReadyEnv()
  await expectNoProviderCall({
    name: 'non-dessert starter bridge',
    run: async () => {
      const requestedSourceMode = assertBridgeSourceMode({
        name: 'non-dessert starter bridge',
        mode: 'curate',
        starterPack: coffeeStarter,
        expectedSourceMode: 'curated',
      })
      const result = await runRetrieval({
        mode: 'curate',
        requestedSourceMode,
        starterPack: coffeeStarter,
      })
      assert(!result.liveFetchAttempted, 'Expected live fetch not to be attempted.')
    },
  })

  resetEnv()
  setRoute('/')
  setProofReadyEnv()
  await expectNoProviderCall({
    name: 'surprise mode bridge',
    run: async () => {
      const requestedSourceMode = assertBridgeSourceMode({
        name: 'surprise mode bridge',
        mode: 'surprise',
        starterPack: dessertStarter,
        expectedSourceMode: 'curated',
      })
      const result = await runRetrieval({
        mode: 'surprise',
        requestedSourceMode,
        starterPack: dessertStarter,
      })
      assert(!result.liveFetchAttempted, 'Expected live fetch not to be attempted.')
    },
  })

  resetEnv()
  setRoute('/')
  setProofReadyEnv()
  await expectNoProviderCall({
    name: 'build mode bridge',
    run: async () => {
      const requestedSourceMode = assertBridgeSourceMode({
        name: 'build mode bridge',
        mode: 'build',
        starterPack: dessertStarter,
        expectedSourceMode: 'curated',
      })
      const result = await runRetrieval({
        mode: 'build',
        requestedSourceMode,
        starterPack: dessertStarter,
      })
      assert(!result.liveFetchAttempted, 'Expected live fetch not to be attempted.')
    },
  })

  resetEnv()
  setRoute('/dev/start/curate')
  setProofReadyEnv()
  await expectNoProviderCall({
    name: 'dev route',
    run: async () => {
      const result = await runRetrieval({
        mode: 'curate',
        requestedSourceMode: 'hybrid',
        starterPack: dessertStarter,
      })
      assert(!result.liveFetchAttempted, 'Expected live fetch not to be attempted.')
    },
  })

  resetEnv()
  setRoute('/sandbox/start/curate')
  setProofReadyEnv()
  await expectNoProviderCall({
    name: 'sandbox route',
    run: async () => {
      const result = await runRetrieval({
        mode: 'curate',
        requestedSourceMode: 'hybrid',
        starterPack: dessertStarter,
      })
      assert(!result.liveFetchAttempted, 'Expected live fetch not to be attempted.')
    },
  })

  resetEnv()
  setRoute('/')
  setProofReadyEnv()
  resetFetchTracking()
  const allowedSourceMode = assertBridgeSourceMode({
    name: 'dessert proof allowed bridge',
    mode: 'curate',
    starterPack: dessertStarter,
    expectedSourceMode: 'hybrid',
  })
  const allowed = await runRetrieval({
    mode: 'curate',
    requestedSourceMode: allowedSourceMode,
    starterPack: dessertStarter,
  })
  assert(allowed.liveFetchAttempted, 'Expected live fetch to be attempted for allowed proof.')
  assert(fetchCallCount === 1, `Expected one mocked provider call, received ${fetchCallCount}.`)
  assert(allowed.queryCount === 1, `Expected one retrieval query, received ${allowed.queryCount}.`)
  assert(
    allowed.liveQueryLabelsUsed.length === 1 &&
      allowed.liveQueryLabelsUsed[0] === `${providerProofGateConfig.dessertConversation.liveQueryLabel}@core`,
    `Expected only dessert-winddown@core, received ${allowed.liveQueryLabelsUsed.join(', ') || 'none'}.`,
  )
  assert(
    fetchTextQueries.length === 1 && fetchTextQueries[0]?.toLowerCase().includes('dessert'),
    `Expected dessert provider text query, received ${fetchTextQueries.join(', ') || 'none'}.`,
  )
  process.stdout.write('dessert proof allowed retrieval_supply: passed\n')
}

main()
  .finally(() => {
    globalThis.fetch = originalFetch
    setRoute(null)
    restoreEnv()
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
