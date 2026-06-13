import type { FieldTextSearchRequest } from '../../../src/domain/field/fieldProxyTypes.js'
import type {
  ProviderVenue,
  ProviderVenueOpeningHours,
} from '../../../src/domain/providers/providerTypes.js'
import type { FieldRequestValidationFailureReason } from './fieldRequestValidation.js'

type ProviderVenueOpeningPeriod = NonNullable<ProviderVenueOpeningHours['periods']>[number]

export const fieldTextSearchProviderActivationValue = 'google_places_text_search'
export const googleTextSearchEndpoint = 'https://places.googleapis.com/v1/places:searchText'
export const googleTextSearchFieldMask = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.types',
  'places.primaryType',
  'places.businessStatus',
  'places.rating',
  'places.userRatingCount',
  'places.regularOpeningHours',
].join(',')

export type FieldTextSearchProviderErrorCode =
  | 'provider_key_missing'
  | 'provider_rate_limited'
  | 'provider_unavailable'
  | 'provider_error'

export type FieldTextSearchProviderResult =
  | {
      ok: true
      providerStatus: 'google_places_text_search' | 'mocked'
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

type FieldTextSearchProviderEnv = Partial<
  Pick<NodeJS.ProcessEnv, 'GOOGLE_PLACES_API_KEY' | 'ID8_FIELD_PROVIDER'>
>

export interface ServerGooglePlacesKeyState {
  keyPresent: boolean
  providerActivationPresent: boolean
}

export function readServerGooglePlacesKeyState(
  env: FieldTextSearchProviderEnv = process.env,
): ServerGooglePlacesKeyState {
  return {
    keyPresent: Boolean(env.GOOGLE_PLACES_API_KEY?.trim()),
    providerActivationPresent:
      env.ID8_FIELD_PROVIDER?.trim() === fieldTextSearchProviderActivationValue,
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

export type FieldTextSearchProviderActivation =
  | {
      status: 'inactive'
    }
  | {
      status: 'missing_key'
      errorCode: 'provider_key_missing'
    }
  | {
      status: 'active'
      provider: FieldTextSearchProvider
    }

export function createFieldTextSearchProviderActivationFromEnv(
  env: FieldTextSearchProviderEnv = process.env,
  fetchImpl: typeof fetch | undefined = globalThis.fetch,
): FieldTextSearchProviderActivation {
  const key = env.GOOGLE_PLACES_API_KEY?.trim()
  const providerActivated =
    env.ID8_FIELD_PROVIDER?.trim() === fieldTextSearchProviderActivationValue

  if (!providerActivated) {
    return { status: 'inactive' }
  }
  if (!key) {
    return {
      status: 'missing_key',
      errorCode: 'provider_key_missing',
    }
  }
  return {
    status: 'active',
    provider: new GooglePlacesTextSearchProvider({
      apiKey: key,
      fetchImpl,
    }),
  }
}

export function createFieldTextSearchProviderFromEnv(
  env: FieldTextSearchProviderEnv = process.env,
  fetchImpl: typeof fetch | undefined = globalThis.fetch,
): FieldTextSearchProvider | null {
  const activation = createFieldTextSearchProviderActivationFromEnv(env, fetchImpl)
  return activation.status === 'active' ? activation.provider : null
}

export function buildGoogleTextSearchRequestBody(
  request: FieldTextSearchRequest,
): Record<string, unknown> {
  return {
    textQuery: request.textQuery,
    ...(request.pageSize ? { pageSize: request.pageSize } : {}),
    ...(request.center
      ? {
          locationBias: {
            circle: {
              center: {
                latitude: request.center.lat,
                longitude: request.center.lng,
              },
              radius: request.radiusMeters ?? 5000,
            },
          },
        }
      : {}),
  }
}

interface GooglePlacesTextSearchProviderParams {
  apiKey: string
  fetchImpl?: typeof fetch
}

interface GoogleTextSearchResponse {
  places?: GoogleTextSearchPlace[]
}

interface GoogleTextSearchPlace {
  id?: unknown
  displayName?: unknown
  formattedAddress?: unknown
  location?: unknown
  types?: unknown
  primaryType?: unknown
  businessStatus?: unknown
  rating?: unknown
  userRatingCount?: unknown
  regularOpeningHours?: unknown
}

interface GoogleTextSearchDisplayName {
  text?: unknown
}

interface GoogleTextSearchLocation {
  latitude?: unknown
  longitude?: unknown
}

interface GoogleTextSearchPeriodPoint {
  day?: unknown
  hour?: unknown
  minute?: unknown
}

interface GoogleTextSearchPeriod {
  open?: unknown
  close?: unknown
}

interface GoogleTextSearchOpeningHours {
  openNow?: unknown
  weekdayDescriptions?: unknown
  periods?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function getDisplayName(value: unknown): string | undefined {
  if (isRecord(value)) {
    return getString((value as GoogleTextSearchDisplayName).text)
  }
  return getString(value)
}

function getStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }
  const strings = value.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0,
  )
  return strings.length > 0 ? strings : undefined
}

function getLocation(value: unknown): ProviderVenue['location'] | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  const latitude = getNumber((value as GoogleTextSearchLocation).latitude)
  const longitude = getNumber((value as GoogleTextSearchLocation).longitude)
  return latitude === undefined || longitude === undefined ? undefined : { latitude, longitude }
}

function getPeriodPoint(value: unknown): ProviderVenueOpeningPeriod['open'] {
  if (!isRecord(value)) {
    return undefined
  }
  const day = getNumber((value as GoogleTextSearchPeriodPoint).day)
  const hour = getNumber((value as GoogleTextSearchPeriodPoint).hour)
  const minute = getNumber((value as GoogleTextSearchPeriodPoint).minute)
  if (day === undefined || hour === undefined || minute === undefined) {
    return undefined
  }
  return { day, hour, minute }
}

function getOpeningHours(value: unknown): ProviderVenueOpeningHours | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  const hours = value as GoogleTextSearchOpeningHours
  const openNow = typeof hours.openNow === 'boolean' ? hours.openNow : undefined
  const weekdayDescriptions = getStringArray(hours.weekdayDescriptions)
  const periods = Array.isArray(hours.periods)
    ? hours.periods
        .filter(isRecord)
        .map((period): ProviderVenueOpeningPeriod => ({
          open: getPeriodPoint((period as GoogleTextSearchPeriod).open),
          close: getPeriodPoint((period as GoogleTextSearchPeriod).close),
        }))
        .filter((period) => period.open || period.close)
    : undefined
  const normalized = {
    ...(openNow !== undefined ? { openNow } : {}),
    ...(weekdayDescriptions ? { weekdayDescriptions } : {}),
    ...(periods && periods.length > 0 ? { periods } : {}),
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined
}

function normalizeGooglePlace(place: GoogleTextSearchPlace, index: number, fetchedAt: number): ProviderVenue {
  const providerRecordId = getString(place.id) ?? `google-text-search-${index + 1}`
  const displayName = getDisplayName(place.displayName) ?? providerRecordId
  const formattedAddress = getString(place.formattedAddress)
  const types = getStringArray(place.types)
  const primaryType = getString(place.primaryType)
  const businessStatus = getString(place.businessStatus)
  const rating = getNumber(place.rating)
  const userRatingCount = getNumber(place.userRatingCount)
  const location = getLocation(place.location)
  const regularOpeningHours = getOpeningHours(place.regularOpeningHours)

  return {
    provider: 'google_places',
    providerRecordId,
    displayName,
    ...(formattedAddress ? { formattedAddress } : {}),
    ...(primaryType ? { primaryType } : {}),
    ...(types ? { types } : {}),
    ...(businessStatus ? { businessStatus } : {}),
    ...(regularOpeningHours ? { regularOpeningHours } : {}),
    ...(rating !== undefined ? { rating } : {}),
    ...(userRatingCount !== undefined ? { userRatingCount } : {}),
    ...(location ? { location } : {}),
    sourceMode: 'live',
    rawPayloadAvailable: false,
    fetchedAt,
    completenessHints: {
      hasAddress: Boolean(formattedAddress),
      hasHours: Boolean(regularOpeningHours),
      hasLocation: Boolean(location),
      hasPrimaryType: Boolean(primaryType),
      hasRating: rating !== undefined,
    },
  }
}

class GooglePlacesTextSearchProvider implements FieldTextSearchProvider {
  private readonly apiKey: string
  private readonly fetchImpl?: typeof fetch

  constructor(params: GooglePlacesTextSearchProviderParams) {
    this.apiKey = params.apiKey
    this.fetchImpl = params.fetchImpl
  }

  async searchText(request: FieldTextSearchRequest): Promise<FieldTextSearchProviderResult> {
    if (typeof this.fetchImpl !== 'function') {
      return {
        ok: false,
        providerStatus: 'fetch_unavailable',
        errorCode: 'provider_unavailable',
      }
    }

    let response: Response
    try {
      response = await this.fetchImpl(googleTextSearchEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': googleTextSearchFieldMask,
        },
        body: JSON.stringify(buildGoogleTextSearchRequestBody(request)),
      })
    } catch {
      return {
        ok: false,
        providerStatus: 'network_error',
        errorCode: 'provider_unavailable',
      }
    }

    if (response.status === 429) {
      return {
        ok: false,
        providerStatus: 'rate_limited',
        errorCode: 'provider_rate_limited',
      }
    }
    if (!response.ok) {
      return {
        ok: false,
        providerStatus: response.status >= 500 ? 'unavailable' : 'failed',
        errorCode: response.status >= 500 ? 'provider_unavailable' : 'provider_error',
      }
    }

    let payload: GoogleTextSearchResponse
    try {
      payload = (await response.json()) as GoogleTextSearchResponse
    } catch {
      return {
        ok: false,
        providerStatus: 'invalid_json',
        errorCode: 'provider_error',
      }
    }

    const places = Array.isArray(payload.places) ? payload.places.filter(isRecord) : []
    const fetchedAt = Date.now()
    return {
      ok: true,
      providerStatus: 'google_places_text_search',
      results: places.map((place, index) =>
        normalizeGooglePlace(place as GoogleTextSearchPlace, index, fetchedAt),
      ),
    }
  }
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
