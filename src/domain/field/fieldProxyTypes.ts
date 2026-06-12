import type { ProviderVenue } from '../providers/providerTypes.js'

export type FieldProxyPurpose =
  | 'retrieval_supply'
  | 'anchor_search'
  | 'waypoint_nearby'
  | 'field_refresh'

export type FieldProxyMode = 'curate' | 'surprise' | 'build'

export interface FieldTextSearchRequest {
  purpose: FieldProxyPurpose
  city: string
  mode: FieldProxyMode
  queryLabel: string
  textQuery: string
  center?: { lat: number; lng: number }
  radiusMeters?: number
  pageSize?: number
  context?: {
    starterId?: string
    vibe?: string
    persona?: string
    timeWindow?: string
    neighborhood?: string
    sessionId?: string
  }
}

export interface FieldTextSearchResponse {
  ok: boolean
  cache: 'hit' | 'miss'
  budget: {
    date: string
    cap: number
    used: number
    remaining: number
  }
  results: ProviderVenue[]
  diagnostics: {
    purpose: FieldProxyPurpose
    queryHash: string
    providerStatus?: string
    blockedReason?: string
    errorCode?: string
    resultCount: number
    callConsumed: boolean
  }
}
