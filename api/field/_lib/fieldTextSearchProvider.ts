import type { FieldTextSearchRequest } from '../../../src/domain/field/fieldProxyTypes'
import type { ProviderVenue } from '../../../src/domain/providers/providerTypes'
import type { FieldRequestValidationFailureReason } from './fieldRequestValidation'

export type FieldTextSearchProviderErrorCode =
  | 'provider_key_missing'
  | 'provider_rate_limited'
  | 'provider_unavailable'
  | 'provider_error'

export type FieldTextSearchProviderResult =
  | {
      ok: true
      providerStatus: 'mocked'
      results: ProviderVenue[]
    }
  | {
      ok: false
      providerStatus: string
      errorCode: FieldTextSearchProviderErrorCode
    }

export interface FieldTextSearchProvider {
  searchText(request: FieldTextSearchRequest): Promise<FieldTextSearchProviderResult>
}

export interface ServerGooglePlacesKeyState {
  keyPresent: boolean
}

export function readServerGooglePlacesKeyState(
  env: Pick<NodeJS.ProcessEnv, 'GOOGLE_PLACES_API_KEY'> = process.env,
): ServerGooglePlacesKeyState {
  return {
    keyPresent: Boolean(env.GOOGLE_PLACES_API_KEY?.trim()),
  }
}

export function mapProviderErrorToBlockedReason(
  errorCode: FieldTextSearchProviderErrorCode,
): FieldRequestValidationFailureReason {
  if (errorCode === 'provider_key_missing') {
    return 'provider_key_missing'
  }
  if (errorCode === 'provider_rate_limited') {
    return 'provider_rate_limited'
  }
  if (errorCode === 'provider_unavailable') {
    return 'provider_unavailable'
  }
  return 'provider_error'
}

export function createFieldTextSearchProviderFromEnv(): FieldTextSearchProvider | null {
  // P0-B3 defines the provider seam only. Do not activate a hosted provider until
  // C-suite approves real server-side Google Text Search wiring.
  return null
}

function buildMockProviderVenue(
  request: FieldTextSearchRequest,
  index: number,
): ProviderVenue {
  const fetchedAt = 1_780_000_000_000 + index
  return {
    provider: 'google_places',
    providerRecordId: `mock-provider-record-${request.purpose}-${index + 1}`,
    displayName: `${request.queryLabel} mock venue ${index + 1}`,
    formattedAddress: '1 Mock Plaza, San Jose, CA',
    shortFormattedAddress: 'San Jose, CA',
    primaryType: 'restaurant',
    types: ['restaurant', 'point_of_interest', 'establishment'],
    location: request.center
      ? {
          latitude: request.center.lat,
          longitude: request.center.lng,
        }
      : {
          latitude: 37.3382,
          longitude: -121.8863,
        },
    sourceMode: 'live',
    rawPayloadAvailable: false,
    fetchedAt,
    completenessHints: {
      hasAddress: true,
      hasHours: false,
      hasLocation: true,
      hasPrimaryType: true,
      hasRating: false,
    },
  }
}

export function createMockFieldTextSearchProvider(params: {
  keyPresent?: boolean
  providerStatus?: 'mocked' | 'rate_limited' | 'unavailable' | 'failed'
  resultCount?: number
} = {}): FieldTextSearchProvider {
  return {
    async searchText(request) {
      if (params.keyPresent === false) {
        return {
          ok: false,
          providerStatus: 'missing_key',
          errorCode: 'provider_key_missing',
        }
      }
      if (params.providerStatus === 'rate_limited') {
        return {
          ok: false,
          providerStatus: 'rate_limited',
          errorCode: 'provider_rate_limited',
        }
      }
      if (params.providerStatus === 'unavailable') {
        return {
          ok: false,
          providerStatus: 'unavailable',
          errorCode: 'provider_unavailable',
        }
      }
      if (params.providerStatus === 'failed') {
        return {
          ok: false,
          providerStatus: 'failed',
          errorCode: 'provider_error',
        }
      }
      const resultCount = params.resultCount ?? 1
      return {
        ok: true,
        providerStatus: 'mocked',
        results: Array.from({ length: resultCount }, (_, index) =>
          buildMockProviderVenue(request, index),
        ),
      }
    },
  }
}
