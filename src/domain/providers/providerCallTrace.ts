import type { SourceMode } from '../types/sourceMode'

export type ProviderCallPurpose =
  | 'anchor_search'
  | 'retrieval_supply'
  | 'waypoint_nearby'
  | 'details_lookup'

export type ProviderCallStatus =
  | 'blocked'
  | 'attempted'
  | 'succeeded'
  | 'failed'
  | 'fallback'

export interface ProviderCallTrace {
  requestId: string
  provider: 'google-places'
  purpose: ProviderCallPurpose
  status: ProviderCallStatus
  attempted: boolean
  blockedByEnv: boolean
  blockedReason?: string
  fallbackUsed: boolean
  queryCount: number
  resultCount: number
  mappedCount: number
  suppressedCount: number
  billableCallCount: number
  failureReason?: string
  requestedAt: number
  sourceMode?: SourceMode
}

export interface ProviderCallLedger {
  traces: ProviderCallTrace[]
  totalAttempted: number
  totalBillable: number
  totalBlocked: number
  totalFailed: number
  byPurpose: Record<ProviderCallPurpose, number>
}

function buildRequestId(purpose: ProviderCallPurpose, requestedAt: number): string {
  return `${purpose}-${requestedAt}-${Math.random().toString(36).slice(2, 8)}`
}

export function createProviderCallTrace(input: {
  purpose: ProviderCallPurpose
  status: ProviderCallStatus
  attempted: boolean
  blockedByEnv: boolean
  fallbackUsed: boolean
  queryCount: number
  resultCount: number
  mappedCount: number
  suppressedCount: number
  billableCallCount: number
  requestedAt?: number
  blockedReason?: string
  failureReason?: string
  sourceMode?: SourceMode
}): ProviderCallTrace {
  const requestedAt = input.requestedAt ?? Date.now()
  return {
    requestId: buildRequestId(input.purpose, requestedAt),
    provider: 'google-places',
    purpose: input.purpose,
    status: input.status,
    attempted: input.attempted,
    blockedByEnv: input.blockedByEnv,
    blockedReason: input.blockedReason,
    fallbackUsed: input.fallbackUsed,
    queryCount: input.queryCount,
    resultCount: input.resultCount,
    mappedCount: input.mappedCount,
    suppressedCount: input.suppressedCount,
    billableCallCount: input.billableCallCount,
    failureReason: input.failureReason,
    requestedAt,
    sourceMode: input.sourceMode,
  }
}

export function createBlockedProviderTrace(input: {
  purpose: ProviderCallPurpose
  blockedReason: string
  fallbackUsed: boolean
  requestedAt?: number
  sourceMode?: SourceMode
}): ProviderCallTrace {
  return createProviderCallTrace({
    purpose: input.purpose,
    status: 'blocked',
    attempted: false,
    blockedByEnv: true,
    blockedReason: input.blockedReason,
    fallbackUsed: input.fallbackUsed,
    queryCount: 0,
    resultCount: 0,
    mappedCount: 0,
    suppressedCount: 0,
    billableCallCount: 0,
    requestedAt: input.requestedAt,
    sourceMode: input.sourceMode,
  })
}

export function summarizeProviderCallLedger(
  traces: ProviderCallTrace[],
): ProviderCallLedger {
  const byPurpose: Record<ProviderCallPurpose, number> = {
    anchor_search: 0,
    retrieval_supply: 0,
    waypoint_nearby: 0,
    details_lookup: 0,
  }

  traces.forEach((trace) => {
    byPurpose[trace.purpose] += 1
  })

  return {
    traces,
    totalAttempted: traces.filter((trace) => trace.attempted).length,
    totalBillable: traces.reduce((sum, trace) => sum + trace.billableCallCount, 0),
    totalBlocked: traces.filter((trace) => trace.blockedByEnv).length,
    totalFailed: traces.filter((trace) => trace.status === 'failed').length,
    byPurpose,
  }
}
