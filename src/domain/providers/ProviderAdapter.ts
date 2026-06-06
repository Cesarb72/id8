import { normalizeRawPlace } from '../normalize/normalizeRawPlace'
import {
  createBlockedProviderTrace,
  createProviderCallTrace,
  summarizeProviderCallLedger,
  type ProviderCallLedger,
  type ProviderCallPurpose,
  type ProviderCallTrace,
} from './providerCallTrace'
import type { ProviderVenue } from './providerTypes'
import {
  getGooglePlacesConfig,
  hasGooglePlacesConfig,
  isDevOrSandboxCloseoutFlow,
} from '../sources/getSourceMode'
import { mapLivePlaceToRawPlace } from '../sources/mapLivePlaceToRawPlace'
import { evaluateProviderGovernancePreflight } from './providerGovernance'
import type { LivePlaceKind } from '../sources/buildLiveQueryPlan'
import type { SourceMode } from '../types/sourceMode'
import type { Venue } from '../types/venue'

interface GooglePlaceRecord {
  id?: string
  displayName?: {
    text?: string
  }
  primaryType?: string
  types?: string[]
  liveMusic?: boolean
  servesBeer?: boolean
  servesWine?: boolean
  goodForGroups?: boolean
  goodForChildren?: boolean
  allowsDogs?: boolean
  servesVegetarianFood?: boolean
  formattedAddress?: string
  shortFormattedAddress?: string
  addressComponents?: Array<{
    longText?: string
    shortText?: string
    types?: string[]
  }>
  editorialSummary?: {
    text?: string
  }
  businessStatus?: string
  currentOpeningHours?: {
    openNow?: boolean
    weekdayDescriptions?: string[]
    periods?: Array<{
      open?: {
        day?: number
        hour?: number
        minute?: number
      }
      close?: {
        day?: number
        hour?: number
        minute?: number
      }
    }>
  }
  regularOpeningHours?: {
    weekdayDescriptions?: string[]
    periods?: Array<{
      open?: {
        day?: number
        hour?: number
        minute?: number
      }
      close?: {
        day?: number
        hour?: number
        minute?: number
      }
    }>
  }
  priceLevel?: string
  rating?: number
  userRatingCount?: number
  websiteUri?: string
  utcOffsetMinutes?: number
  location?: {
    latitude?: number
    longitude?: number
  }
}

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
  trace?: ProviderCallTrace
  ledger?: ProviderCallLedger
}

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
  const trace = createBlockedProviderTrace({
    purpose: callPurpose,
    blockedReason: failureReason,
    fallbackUsed: true,
    sourceMode,
  })
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
    trace,
    ledger: summarizeProviderCallLedger([trace]),
  }
}

async function queryGoogleTextSearch(
  query: ProviderTextSearchQuery,
  apiKey: string,
  endpoint: string,
  languageCode: string,
  regionCode: string,
): Promise<GooglePlaceRecord[]> {
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
    let providerStatus: string | undefined
    let providerMessage: string | undefined

    try {
      const errorPayload = (await response.json()) as {
        error?: {
          status?: string
          message?: string
          code?: number
        }
      }
      providerStatus = errorPayload.error?.status
      providerMessage = errorPayload.error?.message?.trim()
    } catch {
      providerStatus = undefined
      providerMessage = undefined
    }

    const diagnosticParts = [`${query.queryLabel} query failed (${response.status})`]
    if (providerStatus) {
      diagnosticParts.push(`provider_status=${providerStatus}`)
    }
    if (providerMessage) {
      diagnosticParts.push(`provider_message=${providerMessage}`)
    }

    throw new Error(diagnosticParts.join(' | '))
  }

  const payload = (await response.json()) as { places?: GooglePlaceRecord[] }
  return (payload.places ?? []).filter(
    (place) => place.businessStatus !== 'CLOSED_PERMANENTLY',
  )
}

function mapGooglePlaceRecordToProviderVenue(
  place: GooglePlaceRecord,
  fetchedAt: number,
): ProviderVenue | undefined {
  const providerRecordId = place.id?.trim()
  const displayName = place.displayName?.text?.trim()
  if (!providerRecordId || !displayName) {
    return undefined
  }

  const currentPeriods = place.currentOpeningHours?.periods?.map((period) => ({
    close:
      period.close?.day === undefined ||
      period.close.hour === undefined ||
      period.close.minute === undefined
        ? undefined
        : {
            day: period.close.day,
            hour: period.close.hour,
            minute: period.close.minute,
          },
    open:
      period.open?.day === undefined ||
      period.open.hour === undefined ||
      period.open.minute === undefined
        ? undefined
        : {
            day: period.open.day,
            hour: period.open.hour,
            minute: period.open.minute,
          },
  }))
  const regularPeriods = place.regularOpeningHours?.periods?.map((period) => ({
    close:
      period.close?.day === undefined ||
      period.close.hour === undefined ||
      period.close.minute === undefined
        ? undefined
        : {
            day: period.close.day,
            hour: period.close.hour,
            minute: period.close.minute,
          },
    open:
      period.open?.day === undefined ||
      period.open.hour === undefined ||
      period.open.minute === undefined
        ? undefined
        : {
            day: period.open.day,
            hour: period.open.hour,
            minute: period.open.minute,
          },
  }))
  const location =
    typeof place.location?.latitude === 'number' &&
    typeof place.location?.longitude === 'number'
      ? {
          latitude: place.location.latitude,
          longitude: place.location.longitude,
        }
      : undefined

  return {
    businessStatus: place.businessStatus,
    completenessHints: {
      hasAddress: Boolean(place.formattedAddress?.trim()),
      hasHours:
        Boolean(place.currentOpeningHours?.weekdayDescriptions?.length) ||
        Boolean(place.regularOpeningHours?.weekdayDescriptions?.length),
      hasLocation: Boolean(location),
      hasPrimaryType: Boolean(place.primaryType?.trim()),
      hasRating: typeof place.rating === 'number',
    },
    currentOpeningHours: {
      openNow: place.currentOpeningHours?.openNow,
      periods: currentPeriods,
      weekdayDescriptions: place.currentOpeningHours?.weekdayDescriptions,
    },
    liveMusic: place.liveMusic,
    displayName,
    editorialSummary: place.editorialSummary?.text?.trim(),
    fetchedAt,
    formattedAddress: place.formattedAddress,
    goodForChildren: place.goodForChildren,
    goodForGroups: place.goodForGroups,
    location,
    primaryType: place.primaryType,
    provider: 'google_places',
    providerRecordId,
    rating: place.rating,
    rawPayloadAvailable: false,
    regularOpeningHours: {
      periods: regularPeriods,
      weekdayDescriptions: place.regularOpeningHours?.weekdayDescriptions,
    },
    allowsDogs: place.allowsDogs,
    servesBeer: place.servesBeer,
    servesVegetarianFood: place.servesVegetarianFood,
    servesWine: place.servesWine,
    shortFormattedAddress: place.shortFormattedAddress,
    sourceMode: 'live',
    types: place.types,
    userRatingCount: place.userRatingCount,
    utcOffsetMinutes: place.utcOffsetMinutes,
    websiteUri: place.websiteUri,
  }
}

function mapProviderVenueToGooglePlaceRecord(place: ProviderVenue): GooglePlaceRecord {
  return {
    businessStatus: place.businessStatus,
    currentOpeningHours: place.currentOpeningHours
      ? {
          openNow: place.currentOpeningHours.openNow,
          periods: place.currentOpeningHours.periods,
          weekdayDescriptions: place.currentOpeningHours.weekdayDescriptions,
        }
      : undefined,
    displayName: {
      text: place.displayName,
    },
    liveMusic: place.liveMusic,
    editorialSummary: place.editorialSummary
      ? {
          text: place.editorialSummary,
        }
      : undefined,
    formattedAddress: place.formattedAddress,
    goodForChildren: place.goodForChildren,
    goodForGroups: place.goodForGroups,
    id: place.providerRecordId,
    location: place.location,
    primaryType: place.primaryType,
    rating: place.rating,
    regularOpeningHours: place.regularOpeningHours
      ? {
          periods: place.regularOpeningHours.periods,
          weekdayDescriptions: place.regularOpeningHours.weekdayDescriptions,
        }
      : undefined,
    allowsDogs: place.allowsDogs,
    servesBeer: place.servesBeer,
    servesVegetarianFood: place.servesVegetarianFood,
    servesWine: place.servesWine,
    shortFormattedAddress: place.shortFormattedAddress,
    types: place.types,
    userRatingCount: place.userRatingCount,
    utcOffsetMinutes: place.utcOffsetMinutes,
    websiteUri: place.websiteUri,
  }
}

export async function searchPlaces<T, TQuery extends ProviderTextSearchQuery>(input: {
  callPurpose: ProviderCallPurpose
  mapPlace: (
    place: ProviderVenue,
    context: { index: number; query: TQuery },
  ) => T | undefined
  queries: TQuery[]
  sourceMode?: SourceMode
}): Promise<ProviderTextSearchResult<T>> {
  const requestedAt = Date.now()
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

  const governance = evaluateProviderGovernancePreflight({
    purpose: input.callPurpose,
    queryCount: input.queries.length,
    sourceMode: input.sourceMode,
  })
  if (!governance.allowed) {
    return {
      diagnostics: buildBlockedDiagnostics(
        input.callPurpose,
        config.endpoint,
        keyPresent,
        governance.blockedReason ?? 'Provider call blocked by provider governance.',
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

  const settled = await Promise.all(
    input.queries.map(async (query) => {
      try {
        const places = await queryGoogleTextSearch(
          query,
          config.apiKey!,
          config.endpoint,
          config.languageCode,
          config.regionCode,
        )
        return {
          attemptedHttpRequestCount: 1,
          places,
          query,
          status: 'fulfilled' as const,
        }
      } catch (error) {
        return {
          attemptedHttpRequestCount: 1,
          error:
            error instanceof Error
              ? error.message
              : String(error),
          query,
          status: 'rejected' as const,
        }
      }
    }),
  )

  const errors: string[] = []
  const queryCounts: Array<{ queryLabel: string; resultCount: number }> = []
  const results: T[] = []
  let resultCount = 0
  let attemptedHttpRequestCount = 0
  const fetchedAt = Date.now()

  for (const settledResult of settled) {
    attemptedHttpRequestCount += settledResult.attemptedHttpRequestCount

    if (settledResult.status === 'rejected') {
      errors.push(settledResult.error)
      continue
    }

    const { places, query } = settledResult
    queryCounts.push({
      queryLabel: query.queryLabel,
      resultCount: places.length,
    })
    resultCount += places.length
    places.forEach((place, index) => {
      const providerVenue = mapGooglePlaceRecordToProviderVenue(place, fetchedAt)
      if (!providerVenue) {
        return
      }
      const mapped = input.mapPlace(providerVenue, { index, query })
      if (mapped) {
        results.push(mapped)
      }
    })
  }

  const trace = createProviderCallTrace({
    purpose: input.callPurpose,
    status:
      errors.length > 0 && results.length === 0
        ? 'failed'
        : 'succeeded',
    attempted: true,
    blockedByEnv: false,
    fallbackUsed: false,
    queryCount: input.queries.length,
    resultCount,
    mappedCount: results.length,
    suppressedCount: Math.max(0, resultCount - results.length),
    // Preserve the existing "fulfilled provider query" semantics for now.
    billableCallCount: queryCounts.length,
    // Count every outbound fetch attempt, including failed/non-OK responses.
    attemptedHttpRequestCount,
    requestedAt,
    failureReason:
      results.length === 0 && errors.length > 0
        ? errors[0]
        : undefined,
    sourceMode: input.sourceMode,
  })

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
      trace,
      ledger: summarizeProviderCallLedger([trace]),
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
  sourceMode?: SourceMode
  textQuery: string
}): Promise<ProviderTextSearchResult<ProviderAnchorSearchResult>> {
  return searchPlaces({
    callPurpose: 'anchor_search',
    mapPlace: (place, { index }) => {
      const rawPlace = mapLivePlaceToRawPlace(mapProviderVenueToGooglePlaceRecord(place), {
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
            place.editorialSummary ??
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
    sourceMode: input.sourceMode,
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
      const latitude = place.location?.latitude
      const longitude = place.location?.longitude
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return undefined
      }
      return {
        coordinates: [longitude, latitude],
        name: place.displayName,
        primaryType: place.primaryType,
        providerRecordId: place.providerRecordId,
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
