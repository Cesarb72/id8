import { fetchLivePlaces } from '../src/domain/sources/fetchLivePlaces.ts'
import type { FieldTextSearchRequest, FieldTextSearchResponse } from '../src/domain/field/fieldProxyTypes.ts'

const originalFetch = globalThis.fetch

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

async function main(): Promise<void> {
  const requests: FieldTextSearchRequest[] = []
  globalThis.fetch = (async (input, init) => {
    const url = String(input)
    assert(url === '/api/field/text-search', `Expected Field proxy path, received ${url}.`)
    const body = JSON.parse(String(init?.body)) as FieldTextSearchRequest
    requests.push(body)
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          ok: true,
          cache: 'miss',
          budget: {
            date: '2026-06-19',
            cap: 32,
            used: requests.length,
            remaining: Math.max(0, 32 - requests.length),
          },
          results: [],
          diagnostics: {
            purpose: body.purpose,
            queryHash: 'mock-query-hash',
            providerStatus: 'mocked_field_proxy',
            resultCount: 0,
            callConsumed: true,
          },
        } satisfies FieldTextSearchResponse
      },
    } as Response
  }) as typeof fetch

  const result = await fetchLivePlaces(
    {
      city: 'San Jose',
      crew: 'romantic',
      mode: 'curate',
      primaryAnchor: 'cozy',
      secondaryAnchor: 'cultured',
      timeWindow: 'evening',
    } as any,
    undefined,
    {
      maxQueryCenters: 3,
      sourceMode: 'live',
      envelope: {
        maxProviderCalls: 3,
        maxQueryLabels: 3,
      },
      stepBCurateLiveSmokeActive: true,
    },
  )

  assert(
    result.diagnostics.labelsConsidered === 7,
    `Expected 7 labels before envelope, received ${result.diagnostics.labelsConsidered}.`,
  )
  assert(
    result.diagnostics.labelsAdmitted === 3,
    `Expected 3 labels admitted, received ${result.diagnostics.labelsAdmitted}.`,
  )
  assert(
    result.diagnostics.centersConsidered === 3,
    `Expected 3 centers considered, received ${result.diagnostics.centersConsidered}.`,
  )
  assert(
    result.diagnostics.centersAdmitted === 3,
    `Expected 3 centers admitted, received ${result.diagnostics.centersAdmitted}.`,
  )
  assert(
    result.diagnostics.dispatchQueriesPlanned === 3,
    `Expected dispatch plan capped to 3 before ProviderAdapter, received ${result.diagnostics.dispatchQueriesPlanned}.`,
  )
  assert(
    result.diagnostics.dispatchQueriesPlannedWithinCap,
    'Expected dispatch plan cap assertion to pass.',
  )
  assert(requests.length === 3, `Expected exactly 3 mocked proxy calls, received ${requests.length}.`)

  process.stdout.write(
    [
      'step b pre-expansion dispatch cap: passed',
      `labels ${result.diagnostics.labelsConsidered} -> ${result.diagnostics.labelsAdmitted}`,
      `centers ${result.diagnostics.centersConsidered} -> ${result.diagnostics.centersAdmitted}`,
      `dispatch ${result.diagnostics.dispatchQueriesPlanned}`,
      `attempted ${result.diagnostics.dispatchQueriesAttempted}`,
    ].join(' | ') + '\n',
  )
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
