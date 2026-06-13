import {
  assert,
  buildHostedValidationManifest,
  printValidationManifest,
  readVercelProtectionBypassSecret,
} from './hostedValidationKit.js'

const approvedBlockedReasons = new Set([
  'field_proxy_not_activated',
  'durable_store_unavailable',
  'provider_key_missing',
  'daily_cap_exhausted',
])

interface FieldProxySmokeResponse {
  ok?: unknown
  cache?: unknown
  budget?: {
    used?: unknown
    remaining?: unknown
  }
  results?: unknown
  diagnostics?: {
    blockedReason?: unknown
    errorCode?: unknown
    resultCount?: unknown
    callConsumed?: unknown
    providerStatus?: unknown
  }
}

const smokeBody = {
  purpose: 'retrieval_supply',
  city: 'San Jose',
  mode: 'curate',
  queryLabel: 'ledger-smoke-test-automation',
  textQuery: 'coffee downtown san jose',
  center: { lat: 37.3382, lng: -121.8863 },
  radiusMeters: 5000,
  pageSize: 3,
  context: {
    starterId: 'coffee-books',
    timeWindow: 'evening',
  },
}

async function postFieldProxy(url: string, bypassSecret: string): Promise<{
  status: number
  text: string
  json: FieldProxySmokeResponse
}> {
  const response = await fetch(`${url}/api/field/text-search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-vercel-protection-bypass': bypassSecret,
    },
    body: JSON.stringify(smokeBody),
  })
  const text = await response.text()
  let json: FieldProxySmokeResponse
  try {
    json = JSON.parse(text) as FieldProxySmokeResponse
  } catch {
    json = {}
  }
  return {
    status: response.status,
    text,
    json,
  }
}

function assertStructuredFailClosed(response: {
  status: number
  text: string
  json: FieldProxySmokeResponse
}): void {
  assert(response.status !== 401, 'Preview protection bypass failed.')
  assert(
    !(response.status >= 500 && response.text.trim() === ''),
    'Hosted API returned unstructured server error.',
  )
  assert(response.text.trim().startsWith('{'), 'Hosted API response body must be structured JSON.')
  assert(response.json.ok === false, 'Hosted field proxy must fail closed while provider valve is inactive.')
  assert(
    response.status === 503 || response.status === 429,
    `Hosted field proxy must return controlled fail-closed status, received ${response.status}.`,
  )
  const blockedReason = String(response.json.diagnostics?.blockedReason ?? '')
  assert(
    approvedBlockedReasons.has(blockedReason),
    `Unexpected fail-closed blockedReason: ${blockedReason || 'none'}.`,
  )
  assert(
    response.json.diagnostics?.callConsumed === false,
    'callConsumed must be false while provider is inactive.',
  )
  assert(Array.isArray(response.json.results), 'results must be an array.')
  assert(response.json.results.length === 0, 'Provider results must not be returned while valve is closed.')
}

function getBudgetUsed(response: FieldProxySmokeResponse): number {
  const used = response.budget?.used
  assert(typeof used === 'number' && Number.isFinite(used), 'budget.used must be numeric.')
  return used
}

async function main(): Promise<void> {
  const manifest = buildHostedValidationManifest()
  printValidationManifest(manifest)
  process.stdout.write(`Testing hosted commit: ${manifest.expectedHead}\n`)

  const bypassSecret = readVercelProtectionBypassSecret()
  if (!bypassSecret) {
    process.stdout.write(
      'Hosted script implemented, but hosted bypass validation not run because bypass secret was unavailable.\n',
    )
    return
  }

  const first = await postFieldProxy(manifest.canonicalValidationUrl, bypassSecret)
  assertStructuredFailClosed(first)
  const firstUsed = getBudgetUsed(first.json)

  const second = await postFieldProxy(manifest.canonicalValidationUrl, bypassSecret)
  assertStructuredFailClosed(second)
  const secondUsed = getBudgetUsed(second.json)
  assert(
    secondUsed === firstUsed,
    'budget.used must not increment on repeat inactive-provider request.',
  )

  process.stdout.write(
    `hosted field proxy validation: passed status=${second.status} blockedReason=${String(
      second.json.diagnostics?.blockedReason,
    )} callConsumed=false budget.used=${secondUsed}\n`,
  )
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
