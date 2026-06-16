import { getDiscoveryCandidates } from '../src/domain/discovery/getDiscoveryCandidates'

const originalFetch = globalThis.fetch
let fetchCalled = false
globalThis.fetch = (async () => {
  fetchCalled = true
  throw new Error('Field proxy must not be called for dry preview envelope')
}) as typeof fetch

async function main(): Promise<void> {
  await getDiscoveryCandidates(
    {
      city: 'San Jose',
      mode: 'curate',
      primaryVibe: 'cozy',
    } as any,
    {
      liveEnvelope: {
        liveProviderAllowed: false,
        maxProviderCalls: 0,
      },
    },
  )

  if (fetchCalled) {
    throw new Error('Field proxy was called during dry preview envelope')
  }

  process.stdout.write('public field proxy call envelope: passed\n')
}

main().catch((error) => {
  process.stderr.write(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exitCode = 1
}).finally(() => {
  globalThis.fetch = originalFetch
})
