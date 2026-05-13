import { normalizeRawPlace } from '../normalize/normalizeRawPlace'
import {
  getGooglePlacesConfig,
  hasGooglePlacesConfig,
  isDevOrSandboxCloseoutFlow,
} from '../sources/getSourceMode'
import {
  mapLivePlaceToRawPlace,
  type GooglePlaceRecord,
} from '../sources/mapLivePlaceToRawPlace'
import type { LivePlaceKind } from '../sources/buildLiveQueryPlan'
import type { RawPlace } from '../types/rawPlace'
import type { SourceMode } from '../types/sourceMode'
import type { Venue } from '../types/venue'

export type ProviderCallPurpose =
  | 'anchor_search'
  | 'retrieval_supply'
  | 'waypoint_nearby'
  | 'details_lookup'

export interface ProviderAdapterDiagnostics {
  attempted: boolean
  blockedByEnv: boolean
  provider: 'google-places'
  callPurpose: ProviderCallPurpose
  queryCount: number
  resultCount: number
  mappedCount: number
  suppressedCount: number
  failureReason?: string
  fallbackUsed: boolean
  keyPresent: boolean
  requestPath: string
  sourceMode?: SourceMode
}

export interface ProviderPlaceRecord extends GooglePlaceRecord {}

export interface ProviderTextSearchQuery {
  queryLabel: string
  textQuery: string
  fieldMask: string
  pageSize?: number
  rankPreference?: 'RELEVANCE' | 'DISTANCE'
  locationBias?: {
    circle: {
      center: {
        latitude: number
        longitude: number
      }
      radius: number
    }
  }
}

export interface ProviderTextSearchResult<T> {
  diagnostics: ProviderAdapterDiagnostics
  errors: string[]
  queryCounts: Array<{
    queryLabel: string
    resultCount: number
  }>
  results: T[]
}

export interface ProviderAnchorSearchResult {
  subtitle: string
  venue: Venue
}

export interface ProviderNearbyPlaceSummary {
  coordinates: [number, number]
  name: string
  primaryType?: string
  providerRecordId: string
  types: string[]
}

function buildBlockedDiagnostics(
  callPurpose: ProviderCallPurpose,
  requestPath: string,
  keyPresent: boolean,
  failureReason: string,
  sourceMode?: SourceMode,
): ProviderAdapterDiagnostics {
  return {
    attempted: false,
    blockedByEnv: true,
    provider: 'google-places',
    callPurpose,
    queryCount: 0,
    resultCount: 0,
    mappedCount: 0,
    suppressedCount: 0,
    failureReason,
    fallbackUsed: true,
    keyPresent,
    requestPath,
    sourceMode,
  }
}

async function queryGoogleTextSearch(
  query: ProviderTextSearchQuery,
  apiKey: string,
  endpoint: string,
  languageCode: string,
  regionCode: string,
): Promise<ProviderPlaceRecord[]> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': query.fieldMask,
    },
    body: JSON.stringify({
      textQuery: query.textQuery,
      pageSize: query.pageSize,
      languageCode,
      regionCode,
      rankPreference: query.rankPreference,
      locationBias: query.locationBias,
    }),
  })

  if (!response.ok) {
    throw new Error(`${query.queryLabel} query failed (${response.status})`)
  }

  const payload = (await response.json()) as { places?: ProviderPlaceRecord[] }
  return (payload.places ?? []).filter(
    (place) => place.businessStatus !== 'CLOSED_PERMANENTLY',
  )
}

export async function searchPlaces<T, TQuery extends ProviderTextSearchQuery>(input: {
  callPurpose: ProviderCallPurpose
  mapPlace: (
    place: ProviderPlaceRecord,
    context: { index: number; query: TQuery },
  ) => T | undefined
  queries: TQuery[]
  sourceMode?: SourceMode
}): Promise<ProviderTextSearchResult<T>> {
  const config = getGooglePlacesConfig()
  const keyPresent = hasGooglePlacesConfig() && Boolean(config.apiKey)

  if (isDevOrSandboxCloseoutFlow()) {
    return {
      diagnostics: buildBlockedDiagnostics(
        input.callPurpose,
        config.endpoint,
        keyPresent,
        'Live provider disabled in dev/sandbox closeout flow.',
        input.sourceMode,
      ),
      errors: [],
      queryCounts: [],
      results: [],
    }
  }

  if (!keyPresent || !config.apiKey) {
    return {
      diagnostics: buildBlockedDiagnostics(
        input.callPurpose,
        config.endpoint,
        keyPresent,
        'Live provider disabled because the Google Places API key is missing.',
        input.sourceMode,
      ),
      errors: [],
      queryCounts: [],
      results: [],
    }
  }

  const settled = await Promise.allSettled(
    input.queries.map(async (query) => ({
      places: await queryGoogleTextSearch(
        query,
        config.apiKey!,
        config.endpoint,
        config.languageCode,
        config.regionCode,
      ),
      query,
    })),
  )

  const errors: string[] = []
  const queryCounts: Array<{ queryLabel: string; resultCount: number }> = []
  const results: T[] = []
  let resultCount = 0

  for (const settledResult of settled) {
    if (settledResult.status === 'rejected') {
      errors.push(
        settledResult.reason instanceof Error
          ? settledResult.reason.message
          : String(settledResult.reason),
      )
      continue
    }

    const { places, query } = settledResult.value
    queryCounts.push({
      queryLabel: query.queryLabel,
      resultCount: places.length,
    })
    resultCount += places.length
    places.forEach((place, index) => {
      const mapped = input.mapPlace(place, { index, query })
      if (mapped) {
        results.push(mapped)
      }
    })
  }

  return {
    diagnostics: {
      attempted: true,
      blockedByEnv: false,
      provider: 'google-places',
      callPurpose: input.callPurpose,
      queryCount: input.queries.length,
      resultCount,
      mappedCount: results.length,
      suppressedCount: Math.max(0, resultCount - results.length),
      failureReason:
        results.length === 0 && errors.length > 0
          ? errors[0]
          : undefined,
      fallbackUsed: false,
      keyPresent,
      requestPath: config.endpoint,
      sourceMode: input.sourceMode,
    },
    errors,
    queryCounts,
    results,
  }
}

export async function searchAnchorPlaces(input: {
  city: string
  fieldMask: string
  neighborhood?: string
  pageSize?: number
  queryTerms: string[]
  requestedKind: LivePlaceKind
  textQuery: string
}): Promise<ProviderTextSearchResult<ProviderAnchorSearchResult>> {
  return searchPlaces({
    callPurpose: 'anchor_search',
    mapPlace: (place, { index }) => {
      const rawPlace = mapLivePlaceToRawPlace(place, {
        city: input.city,
        neighborhood: input.neighborhood,
        requestedKind: input.requestedKind,
        queryLabel: 'anchor-search',
        queryTerms: input.queryTerms,
        rank: index,
      })
      if (!rawPlace) {
        return undefined
      }

      const anchorName = rawPlace.name.trim()
      return {
        venue: normalizeRawPlace({
          ...rawPlace,
          driveMinutes: input.neighborhood ? 10 : 12,
          shortDescription:
            place.editorialSummary?.text?.trim() ??
            `${anchorName} was selected as a user-led plan anchor.`,
          narrativeFlavor: `${anchorName} is the chosen anchor for a user-led outing.`,
        }),
        subtitle:
          place.shortFormattedAddress ??
          place.formattedAddress ??
          rawPlace.neighborhood ??
          input.city,
      }
    },
    queries: [
      {
        fieldMask: input.fieldMask,
        pageSize: input.pageSize,
        queryLabel: 'anchor-search',
        rankPreference: 'RELEVANCE',
        textQuery: input.textQuery,
      },
    ],
  })
}

export async function getNearbyPlaces(input: {
  fieldMask: string
  limit?: number
  queries: Array<{
    radiusM: number
    queryLabel: string
    textQuery: string
    waypointCoordinates: [number, number]
  }>
}): Promise<ProviderTextSearchResult<ProviderNearbyPlaceSummary>> {
  const limit = input.limit ?? 6
  return searchPlaces({
    callPurpose: 'waypoint_nearby',
    mapPlace: (place) => {
      const providerRecordId = place.id?.trim()
      const name = place.displayName?.text?.trim()
      const latitude = place.location?.latitude
      const longitude = place.location?.longitude
      if (!providerRecordId || !name || typeof latitude !== 'number' || typeof longitude !== 'number') {
        return undefined
      }
      return {
        coordinates: [longitude, latitude],
        name,
        primaryType: place.primaryType,
        providerRecordId,
        types: place.types ?? [],
      }
    },
    queries: input.queries.map((query) => ({
      fieldMask: input.fieldMask,
      locationBias: {
        circle: {
          center: {
            latitude: query.waypointCoordinates[1],
            longitude: query.waypointCoordinates[0],
          },
          radius: query.radiusM,
        },
      },
      pageSize: limit,
      queryLabel: query.queryLabel,
      rankPreference: 'DISTANCE',
      textQuery: query.textQuery,
    })),
  })
}

export async function getPlaceDetails(input: {
  providerId: string
  sourceMode?: SourceMode
}): Promise<{
  diagnostics: ProviderAdapterDiagnostics
  place: null
}> {
  const config = getGooglePlacesConfig()
  return {
    diagnostics: buildBlockedDiagnostics(
      'details_lookup',
      config.endpoint,
      Boolean(config.apiKey),
      `Place details lookup is not activated for provider id "${input.providerId}".`,
      input.sourceMode,
    ),
    place: null,
  }
}
