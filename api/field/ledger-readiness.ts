import {
  createFieldLedgerStoreFromEnv,
  type FieldLedgerBudgetSnapshot,
} from './_lib/fieldLedgerStore.js'

interface FieldLedgerReadinessRequest {
  method?: string
}

interface FieldLedgerReadinessResponse {
  status: (statusCode: number) => FieldLedgerReadinessResponse
  json: (payload: unknown) => void
  setHeader?: (name: string, value: string) => void
}

type FieldLedgerReadinessReason =
  | 'invalid_method'
  | 'missing_kv_env'
  | 'durable_store_unavailable'
  | 'invalid_budget_cap'
  | 'readiness_check_unavailable'

interface FieldLedgerReadinessPayload {
  ok: boolean
  service: 'field_ledger_readiness'
  storeMode: 'durable_kv' | 'unavailable'
  kvConfigured: boolean
  durableStoreAvailable: boolean
  readinessCheck: 'passed' | 'failed' | 'skipped'
  budgetCap: {
    configured: boolean
    valid: boolean
    cap: number | null
  }
  budget?: FieldLedgerBudgetSnapshot
  reasons: FieldLedgerReadinessReason[]
  warnings: FieldLedgerReadinessReason[]
  diagnostics: {
    providerCallAttempted: false
    budgetReserved: false
    kvMutationAttempted: false
  }
}

const defaultBudgetCap = 32

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function parseReadinessBudgetCap(): FieldLedgerReadinessPayload['budgetCap'] {
  const rawCap = process.env.ID8_PROVIDER_DAILY_CALL_CAP?.trim()
  if (!rawCap) {
    return {
      configured: false,
      valid: true,
      cap: defaultBudgetCap,
    }
  }

  const parsed = Number.parseInt(rawCap, 10)
  if (!Number.isFinite(parsed) || parsed <= 0 || String(parsed) !== rawCap) {
    return {
      configured: true,
      valid: false,
      cap: null,
    }
  }

  return {
    configured: true,
    valid: true,
    cap: parsed,
  }
}

function buildReadinessPayload(params: {
  ok: boolean
  kvConfigured: boolean
  durableStoreAvailable: boolean
  readinessCheck: FieldLedgerReadinessPayload['readinessCheck']
  budgetCap: FieldLedgerReadinessPayload['budgetCap']
  budget?: FieldLedgerBudgetSnapshot
  reasons?: FieldLedgerReadinessReason[]
  warnings?: FieldLedgerReadinessReason[]
}): FieldLedgerReadinessPayload {
  return {
    ok: params.ok,
    service: 'field_ledger_readiness',
    storeMode: params.durableStoreAvailable ? 'durable_kv' : 'unavailable',
    kvConfigured: params.kvConfigured,
    durableStoreAvailable: params.durableStoreAvailable,
    readinessCheck: params.readinessCheck,
    budgetCap: params.budgetCap,
    ...(params.budget ? { budget: params.budget } : {}),
    reasons: params.reasons ?? [],
    warnings: params.warnings ?? [],
    diagnostics: {
      providerCallAttempted: false,
      budgetReserved: false,
      kvMutationAttempted: false,
    },
  }
}

async function handleFieldLedgerReadinessRequest(
  request: FieldLedgerReadinessRequest,
  response: FieldLedgerReadinessResponse,
): Promise<void> {
  response.setHeader?.('Cache-Control', 'no-store')

  if (request.method !== 'GET') {
    response.status(405).json(
      buildReadinessPayload({
        ok: false,
        kvConfigured: Boolean(process.env.KV_REST_API_URL?.trim() && process.env.KV_REST_API_TOKEN?.trim()),
        durableStoreAvailable: false,
        readinessCheck: 'skipped',
        budgetCap: parseReadinessBudgetCap(),
        reasons: ['invalid_method'],
      }),
    )
    return
  }

  const kvConfigured = Boolean(process.env.KV_REST_API_URL?.trim() && process.env.KV_REST_API_TOKEN?.trim())
  const budgetCap = parseReadinessBudgetCap()
  if (!budgetCap.valid) {
    response.status(503).json(
      buildReadinessPayload({
        ok: false,
        kvConfigured,
        durableStoreAvailable: false,
        readinessCheck: 'skipped',
        budgetCap,
        reasons: ['invalid_budget_cap'],
      }),
    )
    return
  }

  if (!kvConfigured) {
    response.status(503).json(
      buildReadinessPayload({
        ok: false,
        kvConfigured: false,
        durableStoreAvailable: false,
        readinessCheck: 'skipped',
        budgetCap,
        reasons: ['missing_kv_env'],
      }),
    )
    return
  }

  const store = createFieldLedgerStoreFromEnv()
  if (!store) {
    response.status(503).json(
      buildReadinessPayload({
        ok: false,
        kvConfigured,
        durableStoreAvailable: false,
        readinessCheck: 'failed',
        budgetCap,
        reasons: ['durable_store_unavailable'],
      }),
    )
    return
  }

  try {
    const budget = await store.getBudgetSnapshot(todayIsoDate(), budgetCap.cap ?? defaultBudgetCap)
    response.status(200).json(
      buildReadinessPayload({
        ok: true,
        kvConfigured,
        durableStoreAvailable: true,
        readinessCheck: 'passed',
        budgetCap,
        budget,
      }),
    )
  } catch {
    response.status(503).json(
      buildReadinessPayload({
        ok: false,
        kvConfigured,
        durableStoreAvailable: true,
        readinessCheck: 'failed',
        budgetCap,
        reasons: ['readiness_check_unavailable'],
      }),
    )
  }
}

export default async function handler(
  request: FieldLedgerReadinessRequest,
  response: FieldLedgerReadinessResponse,
): Promise<void> {
  await handleFieldLedgerReadinessRequest(request, response)
}
