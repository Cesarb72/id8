import {
  searchPlaces,
  type ProviderTextSearchQuery,
  type ProviderTextSearchResult,
} from '../providers/ProviderAdapter'
import type { ProviderCallPurpose } from '../providers/providerCallTrace'
import type { ProviderVenue } from '../providers/providerTypes'
import type { SourceMode } from '../types/sourceMode'
import type { FieldProxyMode, FieldTextSearchRequest } from './fieldProxyTypes'

type FieldProxyRequestContext = FieldTextSearchRequest['context']

export interface ExecuteFieldProviderTextSearchInput<
  T,
  TQuery extends ProviderTextSearchQuery,
> {
  callPurpose: ProviderCallPurpose
  city?: string
  context?: FieldProxyRequestContext
  mapPlace: (
    place: ProviderVenue,
    context: { index: number; query: TQuery },
  ) => T | undefined
  mode?: FieldProxyMode
  queries: TQuery[]
  sourceMode?: SourceMode
  envelope?: {
    maxProviderCalls?: number
    maxQueryLabels?: number
  }
}

export function executeFieldProviderTextSearch<
  T,
  TQuery extends ProviderTextSearchQuery,
>(
  input: ExecuteFieldProviderTextSearchInput<T, TQuery>,
): Promise<ProviderTextSearchResult<T>> {
  return searchPlaces(input)
}
