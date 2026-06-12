import type { FieldTextSearchResponse } from '../../../src/domain/field/fieldProxyTypes.js'

const fieldLedgerKeyPrefix = 'id8:field:v1'
const fieldCacheTtlMs = 24 * 60 * 60 * 1000
const fieldBudgetTtlSeconds = 3 * 24 * 60 * 60
const fieldCallLogTtlSeconds = 14 * 24 * 60 * 60

type RedisCommand = Array<string | number>

type FetchLike = (
  input: string,
  init: {
    method: 'POST'
    headers: Record<string, string>
    body: string
  },
) => Promise<{
  ok: boolean
  status: number
  text: () => Promise<string>
}>

interface UpstashRedisResponse<T> {
  result?: T
  error?: string
}

export interface FieldLedgerBudgetSnapshot {
  date: string
  cap: number
  used: number
  remaining: number
}

export interface FieldLedgerCacheEntry {
  response: FieldTextSearchResponse
  expiresAt: number
}

export interface FieldLedgerCallLogEntry {
  date: string
  queryHash: string
  purpose: string
  cache: 'hit' | 'miss'
  callConsumed: boolean
  blockedReason?: string
  providerStatus?: string
  resultCount: number
  requestedAt: number
}

export interface FieldLedgerStore {
  getCachedResponse(cacheKey: string, now: number): Promise<FieldLedgerCacheEntry | null>
  setCachedResponse(cacheKey: string, entry: FieldLedgerCacheEntry): Promise<void>
  getBudgetSnapshot(date: string, cap: number): Promise<FieldLedgerBudgetSnapshot>
  reserveCall(date: string, cap: number): Promise<
    | {
        ok: true
        budget: FieldLedgerBudgetSnapshot
      }
    | {
        ok: false
        budget: FieldLedgerBudgetSnapshot
        blockedReason: 'daily_cap_exhausted'
      }
  >
  logCall(entry: FieldLedgerCallLogEntry): Promise<void>
}

export type FieldLedgerCacheCheckResult =
  | {
      status: 'hit'
      response: FieldTextSearchResponse
      budget: FieldLedgerBudgetSnapshot
    }
  | {
      status: 'miss'
      budget: FieldLedgerBudgetSnapshot
    }
  | {
      status: 'cap_exhausted'
      budget: FieldLedgerBudgetSnapshot
    }

export type FieldLedgerCacheReadResult =
  | {
      status: 'hit'
      response: FieldTextSearchResponse
      budget: FieldLedgerBudgetSnapshot
    }
  | {
      status: 'miss'
      budget: FieldLedgerBudgetSnapshot
    }

export type FieldLedgerReservationResult =
  | {
      status: 'reserved'
      budget: FieldLedgerBudgetSnapshot
    }
  | {
      status: 'cap_exhausted'
      budget: FieldLedgerBudgetSnapshot
    }

function normalizeUpstashUrl(url: string): string {
  return url.trim().replace(/\/+$/g, '')
}

function buildBudgetKey(date: string): string {
  return `${fieldLedgerKeyPrefix}:budget:${date}`
}

function buildLogKey(date: string): string {
  return `${fieldLedgerKeyPrefix}:calls:${date}`
}

function buildCacheStorageKey(cacheKey: string): string {
  return `${fieldLedgerKeyPrefix}:cache:${cacheKey}`
}

function isFieldLedgerCacheEntry(value: unknown): value is FieldLedgerCacheEntry {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const candidate = value as Partial<FieldLedgerCacheEntry>
  return (
    typeof candidate.expiresAt === 'number' &&
    typeof candidate.response === 'object' &&
    candidate.response !== null
  )
}

function parseRedisNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function parseReserveCallResult(value: unknown): { allowed: boolean; used: number } {
  if (!Array.isArray(value) || value.length < 2) {
    return {
      allowed: false,
      used: 0,
    }
  }
  return {
    allowed: parseRedisNumber(value[0]) === 1,
    used: parseRedisNumber(value[1]),
  }
}

function isSupportedRestUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export function createFieldLedgerStoreFromEnv(): FieldLedgerStore | null {
  const url = process.env.KV_REST_API_URL?.trim()
  const token = process.env.KV_REST_API_TOKEN?.trim()
  if (!url || !token || !isSupportedRestUrl(url) || typeof fetch !== 'function') {
    return null
  }
  return new UpstashFieldLedgerStore({
    fetchImpl: fetch,
    token,
    url,
  })
}

export async function checkFieldCacheAndBudget(params: {
  store: FieldLedgerStore
  cacheKey: string
  date: string
  cap: number
  now: number
  queryHash: string
  purpose: string
}): Promise<FieldLedgerCacheCheckResult> {
  const cached = await readFieldCachedResponse({
    store: params.store,
    cacheKey: params.cacheKey,
    date: params.date,
    cap: params.cap,
    now: params.now,
    queryHash: params.queryHash,
    purpose: params.purpose,
    logCacheHit: true,
  })
  if (cached.status === 'hit') {
    return cached
  }

  const reservation = await reserveFieldProviderCallBudget(params)
  if (reservation.status === 'cap_exhausted') {
    return reservation
  }

  return {
    status: 'miss',
    budget: reservation.budget,
  }
}

export async function readFieldCachedResponse(params: {
  store: FieldLedgerStore
  cacheKey: string
  date: string
  cap: number
  now: number
  queryHash: string
  purpose: string
  logCacheHit: boolean
}): Promise<FieldLedgerCacheReadResult> {
  const cached = await params.store.getCachedResponse(params.cacheKey, params.now)
  if (cached) {
    const budget = await params.store.getBudgetSnapshot(params.date, params.cap)
    if (params.logCacheHit) {
      await params.store.logCall({
        date: params.date,
        queryHash: params.queryHash,
        purpose: params.purpose,
        cache: 'hit',
        callConsumed: false,
        resultCount: cached.response.diagnostics.resultCount,
        requestedAt: params.now,
      })
    }
    return {
      status: 'hit',
      response: {
        ...cached.response,
        cache: 'hit',
        budget,
        diagnostics: {
          ...cached.response.diagnostics,
          callConsumed: false,
        },
      },
      budget,
    }
  }

  return {
    status: 'miss',
    budget: await params.store.getBudgetSnapshot(params.date, params.cap),
  }
}

export async function reserveFieldProviderCallBudget(params: {
  store: FieldLedgerStore
  date: string
  cap: number
  now: number
  queryHash: string
  purpose: string
}): Promise<FieldLedgerReservationResult> {
  const reservation = await params.store.reserveCall(params.date, params.cap)
  if (!reservation.ok) {
    await params.store.logCall({
      date: params.date,
      queryHash: params.queryHash,
      purpose: params.purpose,
      cache: 'miss',
      callConsumed: false,
      blockedReason: reservation.blockedReason,
      resultCount: 0,
      requestedAt: params.now,
    })
    return {
      status: 'cap_exhausted',
      budget: reservation.budget,
    }
  }

  await params.store.logCall({
    date: params.date,
    queryHash: params.queryHash,
    purpose: params.purpose,
    cache: 'miss',
    callConsumed: true,
    resultCount: 0,
    requestedAt: params.now,
  })

  return {
    status: 'reserved',
    budget: reservation.budget,
  }
}

export class MockFieldLedgerStore implements FieldLedgerStore {
  private readonly cache = new Map<string, FieldLedgerCacheEntry>()
  private usedByDate = new Map<string, number>()
  readonly callLog: FieldLedgerCallLogEntry[] = []

  constructor(initial?: {
    usedByDate?: Record<string, number>
    cacheEntries?: Record<string, FieldLedgerCacheEntry>
  }) {
    for (const [date, used] of Object.entries(initial?.usedByDate ?? {})) {
      this.usedByDate.set(date, used)
    }
    for (const [cacheKey, entry] of Object.entries(initial?.cacheEntries ?? {})) {
      this.cache.set(cacheKey, entry)
    }
  }

  async getCachedResponse(cacheKey: string, now: number): Promise<FieldLedgerCacheEntry | null> {
    const entry = this.cache.get(cacheKey)
    if (!entry) {
      return null
    }
    if (entry.expiresAt <= now) {
      this.cache.delete(cacheKey)
      return null
    }
    return entry
  }

  async setCachedResponse(cacheKey: string, entry: FieldLedgerCacheEntry): Promise<void> {
    this.cache.set(cacheKey, entry)
  }

  async getBudgetSnapshot(date: string, cap: number): Promise<FieldLedgerBudgetSnapshot> {
    const used = this.usedByDate.get(date) ?? 0
    return {
      date,
      cap,
      used,
      remaining: Math.max(0, cap - used),
    }
  }

  async reserveCall(date: string, cap: number): Promise<
    | {
        ok: true
        budget: FieldLedgerBudgetSnapshot
      }
    | {
        ok: false
        budget: FieldLedgerBudgetSnapshot
        blockedReason: 'daily_cap_exhausted'
      }
  > {
    const snapshot = await this.getBudgetSnapshot(date, cap)
    if (snapshot.remaining <= 0) {
      return {
        ok: false,
        budget: snapshot,
        blockedReason: 'daily_cap_exhausted',
      }
    }
    const nextUsed = snapshot.used + 1
    this.usedByDate.set(date, nextUsed)
    return {
      ok: true,
      budget: {
        date,
        cap,
        used: nextUsed,
        remaining: Math.max(0, cap - nextUsed),
      },
    }
  }

  async logCall(entry: FieldLedgerCallLogEntry): Promise<void> {
    this.callLog.push(entry)
  }
}

export class UpstashFieldLedgerStore implements FieldLedgerStore {
  private readonly fetchImpl: FetchLike
  private readonly token: string
  private readonly url: string

  constructor(params: {
    fetchImpl?: FetchLike
    token: string
    url: string
  }) {
    const fetchImpl = params.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined)
    if (!fetchImpl) {
      throw new Error('Field ledger store fetch runtime is unavailable.')
    }
    this.fetchImpl = fetchImpl
    this.token = params.token
    this.url = normalizeUpstashUrl(params.url)
  }

  private async command<T>(command: RedisCommand): Promise<T | null> {
    const response = await this.fetchImpl(this.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    })
    const text = await response.text()
    let payload: UpstashRedisResponse<T>
    try {
      payload = text ? (JSON.parse(text) as UpstashRedisResponse<T>) : {}
    } catch {
      throw new Error(`Field ledger store returned invalid JSON (${response.status}).`)
    }
    if (!response.ok || payload.error) {
      throw new Error(`Field ledger store command failed (${response.status}).`)
    }
    return payload.result ?? null
  }

  async getCachedResponse(cacheKey: string, now: number): Promise<FieldLedgerCacheEntry | null> {
    const serialized = await this.command<string>(['GET', buildCacheStorageKey(cacheKey)])
    if (!serialized) {
      return null
    }
    let entry: unknown
    try {
      entry = JSON.parse(serialized)
    } catch {
      return null
    }
    if (!isFieldLedgerCacheEntry(entry)) {
      return null
    }
    if (entry.expiresAt <= now) {
      await this.command(['DEL', buildCacheStorageKey(cacheKey)])
      return null
    }
    return entry
  }

  async setCachedResponse(cacheKey: string, entry: FieldLedgerCacheEntry): Promise<void> {
    const ttlMs = Math.max(1, entry.expiresAt - Date.now())
    await this.command([
      'SET',
      buildCacheStorageKey(cacheKey),
      JSON.stringify(entry),
      'PX',
      ttlMs,
    ])
  }

  async getBudgetSnapshot(date: string, cap: number): Promise<FieldLedgerBudgetSnapshot> {
    const used = parseRedisNumber(await this.command<string | number>(['GET', buildBudgetKey(date)]))
    return {
      date,
      cap,
      used,
      remaining: Math.max(0, cap - used),
    }
  }

  async reserveCall(date: string, cap: number): Promise<
    | {
        ok: true
        budget: FieldLedgerBudgetSnapshot
      }
    | {
        ok: false
        budget: FieldLedgerBudgetSnapshot
        blockedReason: 'daily_cap_exhausted'
      }
  > {
    const reservation = parseReserveCallResult(
      await this.command<unknown>([
        'EVAL',
        [
          "local used = tonumber(redis.call('GET', KEYS[1]) or '0')",
          "local cap = tonumber(ARGV[1])",
          'if used >= cap then return {0, used} end',
          "used = redis.call('INCR', KEYS[1])",
          "redis.call('EXPIRE', KEYS[1], ARGV[2])",
          'return {1, used}',
        ].join('\n'),
        1,
        buildBudgetKey(date),
        cap,
        fieldBudgetTtlSeconds,
      ]),
    )
    const budget = {
      date,
      cap,
      used: reservation.used,
      remaining: Math.max(0, cap - reservation.used),
    }
    if (!reservation.allowed) {
      return {
        ok: false,
        budget,
        blockedReason: 'daily_cap_exhausted',
      }
    }
    return {
      ok: true,
      budget,
    }
  }

  async logCall(entry: FieldLedgerCallLogEntry): Promise<void> {
    const logKey = buildLogKey(entry.date)
    await this.command(['RPUSH', logKey, JSON.stringify(entry)])
    await this.command(['EXPIRE', logKey, fieldCallLogTtlSeconds])
  }
}

export const fieldLedgerStoreConfig = {
  budgetTtlSeconds: fieldBudgetTtlSeconds,
  cacheTtlMs: fieldCacheTtlMs,
  keyPrefix: fieldLedgerKeyPrefix,
}
