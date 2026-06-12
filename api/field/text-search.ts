import {
  buildFieldProxyBlockedResponse,
  getFieldProxyBudgetSnapshot,
  parseFieldProxyJsonBody,
  validateFieldProxyMethod,
  validateFieldTextSearchRequestBody,
  type FieldRequestValidationFailureReason,
} from './_lib/fieldRequestValidation'
import { buildFieldTextSearchCacheKey, buildFieldQueryHash } from './_lib/fieldCacheKeys'
import { checkFieldCacheAndBudget, createFieldLedgerStoreFromEnv } from './_lib/fieldLedgerStore'

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

export default async function handler(
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
  const cacheResult = await checkFieldCacheAndBudget({
    store,
    cacheKey: buildFieldTextSearchCacheKey({
      date: budget.date,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'local',
      request: validation.request,
    }),
    date: budget.date,
    cap: budget.cap,
    now: Date.now(),
    queryHash,
    purpose: validation.request.purpose,
  })

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

  response.status(503).json(
    buildFieldProxyBlockedResponse({
      request: validation.request,
      reason: 'field_proxy_not_activated',
      budget: cacheResult.budget,
    }),
  )
}
