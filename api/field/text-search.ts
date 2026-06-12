import {
  buildFieldProxyBlockedResponse,
  getFieldProxyBudgetSnapshot,
  parseFieldProxyJsonBody,
  validateFieldProxyMethod,
  validateFieldTextSearchRequestBody,
  type FieldRequestValidationFailureReason,
} from './_lib/fieldRequestValidation.js'
import { buildFieldTextSearchCacheKey, buildFieldQueryHash } from './_lib/fieldCacheKeys.js'
import { checkFieldCacheAndBudget, createFieldLedgerStoreFromEnv } from './_lib/fieldLedgerStore.js'
import {
  createFieldTextSearchProviderFromEnv,
  mapProviderErrorToBlockedReason,
} from './_lib/fieldTextSearchProvider.js'

interface FieldProxyRequest {
  method?: string
  body?: unknown
}

interface FieldProxyResponse {
  status: (statusCode: number) => FieldProxyResponse
  json: (payload: unknown) => void
  setHeader?: (name: string, value: string) => void
}

function sendBlockedResponse(
  response: FieldProxyResponse,
  statusCode: number,
  reason: FieldRequestValidationFailureReason,
): void {
  response.status(statusCode).json(
    buildFieldProxyBlockedResponse({
      reason,
    }),
  )
}

async function handleFieldTextSearchRequest(
  request: FieldProxyRequest,
  response: FieldProxyResponse,
): Promise<void> {
  response.setHeader?.('Cache-Control', 'no-store')

  const methodFailure = validateFieldProxyMethod(request.method)
  if (methodFailure && !methodFailure.ok) {
    sendBlockedResponse(response, methodFailure.statusCode, methodFailure.reason)
    return
  }

  const parsedBody = parseFieldProxyJsonBody(request.body)
  if (!parsedBody.ok) {
    sendBlockedResponse(response, parsedBody.statusCode, parsedBody.reason)
    return
  }

  const validation = validateFieldTextSearchRequestBody(parsedBody.body)
  if (!validation.ok) {
    sendBlockedResponse(response, validation.statusCode, validation.reason)
    return
  }

  const store = createFieldLedgerStoreFromEnv()
  if (!store) {
    response.status(503).json(
      buildFieldProxyBlockedResponse({
        request: validation.request,
        reason: 'durable_store_unavailable',
      }),
    )
    return
  }

  const budget = getFieldProxyBudgetSnapshot()
  const queryHash = buildFieldQueryHash(validation.request.textQuery)
  const cacheKey = buildFieldTextSearchCacheKey({
    date: budget.date,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'local',
    request: validation.request,
  })
  let cacheResult: Awaited<ReturnType<typeof checkFieldCacheAndBudget>>
  try {
    cacheResult = await checkFieldCacheAndBudget({
      store,
      cacheKey,
      date: budget.date,
      cap: budget.cap,
      now: Date.now(),
      queryHash,
      purpose: validation.request.purpose,
    })
  } catch {
    response.status(503).json(
      buildFieldProxyBlockedResponse({
        request: validation.request,
        reason: 'durable_store_unavailable',
      }),
    )
    return
  }

  if (cacheResult.status === 'hit') {
    response.status(200).json(cacheResult.response)
    return
  }

  if (cacheResult.status === 'cap_exhausted') {
    response.status(429).json(
      buildFieldProxyBlockedResponse({
        request: validation.request,
        reason: 'daily_cap_exhausted',
        budget: cacheResult.budget,
      }),
    )
    return
  }

  const provider = createFieldTextSearchProviderFromEnv()
  if (!provider) {
    response.status(503).json(
      buildFieldProxyBlockedResponse({
        request: validation.request,
        reason: 'field_proxy_not_activated',
        budget: cacheResult.budget,
      }),
    )
    return
  }

  const providerResult = await provider.searchText(validation.request)
  if (!providerResult.ok) {
    const reason = mapProviderErrorToBlockedReason(providerResult.errorCode)
    const blockedResponse = buildFieldProxyBlockedResponse({
      request: validation.request,
      reason,
      budget: cacheResult.budget,
    })
    response.status(reason === 'provider_rate_limited' ? 429 : 503).json({
      ...blockedResponse,
      diagnostics: {
        ...blockedResponse.diagnostics,
        providerStatus: providerResult.providerStatus,
        callConsumed: true,
      },
    })
    return
  }

  const providerResponse = {
    ok: true,
    cache: 'miss' as const,
    budget: cacheResult.budget,
    results: providerResult.results,
    diagnostics: {
      purpose: validation.request.purpose,
      queryHash,
      providerStatus: providerResult.providerStatus,
      resultCount: providerResult.results.length,
      callConsumed: true,
    },
  }
  try {
    await store.setCachedResponse(
      cacheKey,
      {
        response: providerResponse,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      },
    )
  } catch {
    response.status(503).json(
      buildFieldProxyBlockedResponse({
        request: validation.request,
        reason: 'durable_store_unavailable',
        budget: cacheResult.budget,
      }),
    )
    return
  }
  response.status(200).json(providerResponse)
}

function logFieldProxyFailClosed(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[field-proxy] fail-closed response emitted: ${message}`)
}

export default async function handler(
  request: FieldProxyRequest,
  response: FieldProxyResponse,
): Promise<void> {
  try {
    await handleFieldTextSearchRequest(request, response)
  } catch (error) {
    logFieldProxyFailClosed(error)
    response.status(503).json(
      buildFieldProxyBlockedResponse({
        reason: 'durable_store_unavailable',
      }),
    )
  }
}
