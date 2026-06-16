import { getDiscoveryCandidates } from '../src/domain/discovery/getDiscoveryCandidates'

const originalFetch = globalThis.fetch
let fetchCalled = false
globalThis.fetch = (async () => {
  fetchCalled = true
  throw new Error('fetch must not be called during discovery preview')
}) as typeof fetch

async function main(): Promise<void> {
  // minimal intent input; normalizeIntent will fill defaults
  const input: any = {
    city: 'San Jose',
    mode: 'curate',
    primaryVibe: 'cozy',
  }

  const groups = await getDiscoveryCandidates(input, {
    liveEnvelope: { liveProviderAllowed: false, maxProviderCalls: 0, maxCenters: 0 },
  })

  if (fetchCalled) {
    throw new Error('Field proxy was called during discovery preview')
  }

  process.stdout.write('discovery preview no-live-field: passed\n')
}

main().catch((err) => {
  const message = err instanceof Error ? err.stack ?? err.message : String(err)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
}).finally(() => {
  globalThis.fetch = originalFetch
})
