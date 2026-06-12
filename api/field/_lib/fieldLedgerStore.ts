import type { FieldTextSearchResponse } from '../../../src/domain/field/fieldProxyTypes'

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

export function createFieldLedgerStoreFromEnv(): FieldLedgerStore | null {
  // P0-B2 defines the durable boundary only. Hosted runtime must fail closed
  // until a real KV/Redis implementation is wired in a later approved patch.
  return null
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
  const cached = await params.store.getCachedResponse(params.cacheKey, params.now)
  if (cached) {
    const budget = await params.store.getBudgetSnapshot(params.date, params.cap)
    await params.store.logCall({
      date: params.date,
      queryHash: params.queryHash,
      purpose: params.purpose,
      cache: 'hit',
      callConsumed: false,
      resultCount: cached.response.diagnostics.resultCount,
      requestedAt: params.now,
    })
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

  const reservation = await params.store.reserveCall(params.date, params.cap)
  await params.store.logCall({
    date: params.date,
    queryHash: params.queryHash,
    purpose: params.purpose,
    cache: 'miss',
    callConsumed: reservation.ok,
    blockedReason: reservation.ok ? undefined : reservation.blockedReason,
    resultCount: 0,
    requestedAt: params.now,
  })

  if (!reservation.ok) {
    return {
      status: 'cap_exhausted',
      budget: reservation.budget,
    }
  }

  return {
    status: 'miss',
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
