import { normalizeRawPlace } from '../normalize/normalizeRawPlace'
import type {
  FieldProxyMode,
  FieldProxyPurpose,
  FieldTextSearchRequest,
  FieldTextSearchResponse,
} from '../field/fieldProxyTypes'
import {
  createBlockedProviderTrace,
  createProviderCallTrace,
  summarizeProviderCallLedger,
  type ProviderCallLedger,
  type ProviderCallPurpose,
  type ProviderCallTrace,
} from './providerCallTrace'
import type { ProviderVenue } from './providerTypes'
import type { GooglePlaceRecord } from '../field/googlePlaceRecord'
import {
  getGooglePlacesConfig,
  isDevOrSandboxCloseoutFlow,
} from '../sources/getSourceMode'
import { mapLivePlaceToRawPlace } from '../sources/mapLivePlaceToRawPlace'
import type { LivePlaceKind } from '../sources/buildLiveQueryPlan'
import type { SourceMode } from '../types/sourceMode'
import type { Venue } from '../types/venue'

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

type FieldProxyRequestContext = FieldTextSearchRequest['context']

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

function mapProviderPurposeToFieldPurpose(
  purpose: ProviderCallPurpose,
): FieldProxyPurpose | null {
  if (
    purpose === 'retrieval_supply' ||
    purpose === 'anchor_search' ||
    purpose === 'waypoint_nearby'
  ) {
    return purpose
  }
  if (purpose === 'build_anchor_nearby') {
    return 'waypoint_nearby'
  }
  return null
}

function buildFieldRequest<TQuery extends ProviderTextSearchQuery>(input: {
  city?: string
  context?: FieldProxyRequestContext
  mode?: FieldProxyMode
  purpose: FieldProxyPurpose
  query: TQuery
}): FieldTextSearchRequest {
  const circle = input.query.locationBias?.circle
  return {
    purpose: input.purpose,
    city: input.city ?? 'San Jose',
    mode: input.mode ?? 'build',
    queryLabel: input.query.queryLabel,
    textQuery: input.query.textQuery,
    ...(circle
      ? {
          center: {
            lat: circle.center.latitude,
            lng: circle.center.longitude,
          },
          radiusMeters: circle.radius,
        }
      : {}),
    ...(input.query.pageSize ? { pageSize: input.query.pageSize } : {}),
    ...(input.context ? { context: input.context } : {}),
  }
}

function buildFieldProxyDiagnostics(input: {
  attemptedHttpRequestCount: number
  blockedByEnv: boolean
  failureReason?: string
  mappedCount: number
  purpose: ProviderCallPurpose
  queryCount: number
  requestPath: string
  resultCount: number
  sourceMode?: SourceMode
  status: 'succeeded' | 'failed'
}): ProviderAdapterDiagnostics {
  const trace = createProviderCallTrace({
    purpose: input.purpose,
    status: input.status,
    attempted: true,
    blockedByEnv: input.blockedByEnv,
    fallbackUsed: input.status === 'failed',
    queryCount: input.queryCount,
    resultCount: input.resultCount,
    mappedCount: input.mappedCount,
    suppressedCount: 0,
    billableCallCount: input.status === 'succeeded' ? input.queryCount : 0,
    attemptedHttpRequestCount: input.attemptedHttpRequestCount,
    failureReason: input.failureReason,
    sourceMode: input.sourceMode,
  })
  return {
    attempted: true,
    blockedByEnv: input.blockedByEnv,
    provider: 'google-places',
    callPurpose: input.purpose,
    queryCount: input.queryCount,
    resultCount: input.resultCount,
    mappedCount: input.mappedCount,
    suppressedCount: 0,
    failureReason: input.failureReason,
    fallbackUsed: input.status === 'failed',
    keyPresent: false,
    requestPath: input.requestPath,
    sourceMode: input.sourceMode,
    trace,
    ledger: summarizeProviderCallLedger([trace]),
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
}): Promise<ProviderTextSearchResult<T>> {
  const config = getGooglePlacesConfig()

  if (isDevOrSandboxCloseoutFlow()) {
    return {
      diagnostics: buildBlockedDiagnostics(
        input.callPurpose,
        config.requestPath,
        false,
        'Live provider disabled in dev/sandbox closeout flow.',
        input.sourceMode,
      ),
      errors: [],
      queryCounts: [],
      results: [],
    }
  }

  if (input.sourceMode === 'curated') {
    return {
      diagnostics: buildBlockedDiagnostics(
        input.callPurpose,
        config.requestPath,
        false,
        'Live provider disabled because sourceMode is curated.',
        input.sourceMode,
      ),
      errors: [],
      queryCounts: [],
      results: [],
    }
  }

  const fieldPurpose = mapProviderPurposeToFieldPurpose(input.callPurpose)
  if (!fieldPurpose) {
    return {
      diagnostics: buildBlockedDiagnostics(
        input.callPurpose,
        config.requestPath,
        false,
        `Field proxy does not support provider purpose "${input.callPurpose}".`,
        input.sourceMode,
      ),
      errors: [],
      queryCounts: [],
      results: [],
    }
  }

  if (typeof fetch !== 'function') {
    return {
      diagnostics: buildBlockedDiagnostics(
        input.callPurpose,
        config.requestPath,
        false,
        'Field proxy fetch runtime is unavailable.',
        input.sourceMode,
      ),
      errors: [],
      queryCounts: [],
      results: [],
    }
  }

  const results: T[] = []
  const queryCounts: ProviderTextSearchResult<T>['queryCounts'] = []
  const errors: string[] = []
  let fetchedCount = 0
  let attemptedHttpRequestCount = 0

  // Apply envelope caps: trim queries if maxProviderCalls provided
  let queries = input.queries.slice()
  if (input.envelope?.maxQueryLabels != null) {
    if (input.envelope.maxQueryLabels <= 0) {
      queries = []
    } else {
      const allowedLabels = new Set(
        queries.map((q) => q.queryLabel).slice(0, input.envelope.maxQueryLabels),
      )
      queries = queries.filter((q) => allowedLabels.has(q.queryLabel))
    }
  }
  if (input.envelope?.maxProviderCalls != null && input.envelope.maxProviderCalls >= 0) {
    queries = queries.slice(0, input.envelope.maxProviderCalls)
  }

  // Deduplicate identical queries in-flight to avoid overlapping proxy calls
  const seen = new Set<string>()

  for (const query of queries) {
    attemptedHttpRequestCount += 1
    const dedupeKey = JSON.stringify({ label: query.queryLabel, query: query.textQuery })
    if (seen.has(dedupeKey)) {
      continue
    }
    seen.add(dedupeKey)
    let response: Response
    try {
      response = await fetch(config.requestPath, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          buildFieldRequest({
            city: input.city,
            context: input.context,
            mode: input.mode,
            purpose: fieldPurpose,
            query,
          }),
        ),
      })
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Field proxy request failed.')
      continue
    }

    let payload: FieldTextSearchResponse
    try {
      payload = (await response.json()) as FieldTextSearchResponse
    } catch {
      errors.push(`Field proxy returned non-JSON response (${response.status}).`)
      continue
    }

    // Fail-fast on budget exhaustion or provider rate limit signals
    const fatalCodes = new Set(['daily_cap_exhausted', 'provider_rate_limited'])
    if (response.status === 429 || fatalCodes.has(payload.diagnostics.errorCode ?? '') || fatalCodes.has(payload.diagnostics.blockedReason ?? '')) {
      const reason = payload.diagnostics.errorCode ?? payload.diagnostics.blockedReason ?? `field_proxy_http_${response.status}`
      errors.push(reason)
      // stop immediately to avoid further budget consumption
      break
    }
    if (!response.ok || payload.ok !== true) {
      errors.push(
        payload.diagnostics.errorCode ??
          payload.diagnostics.blockedReason ??
          `field_proxy_http_${response.status}`,
      )
      continue
    }

    queryCounts.push({
      queryLabel: query.queryLabel,
      resultCount: payload.results.length,
    })
    fetchedCount += payload.results.length
    payload.results.forEach((place, index) => {
      const mapped = input.mapPlace(place, { index, query })
      if (mapped) {
        results.push(mapped)
      }
    })
  }

  if (queryCounts.length > 0) {
    return {
      diagnostics: buildFieldProxyDiagnostics({
        attemptedHttpRequestCount,
        blockedByEnv: false,
        mappedCount: results.length,
        purpose: input.callPurpose,
        queryCount: input.queries.length,
        requestPath: config.requestPath,
        resultCount: fetchedCount,
        sourceMode: input.sourceMode,
        status: errors.length > 0 ? 'failed' : 'succeeded',
      }),
      errors,
      queryCounts,
      results,
    }
  }

  return {
    diagnostics: buildFieldProxyDiagnostics({
      attemptedHttpRequestCount,
      blockedByEnv: false,
      failureReason: errors[0] ?? 'Field proxy returned no usable results.',
      mappedCount: 0,
      purpose: input.callPurpose,
      queryCount: input.queries.length,
      requestPath: config.requestPath,
      resultCount: 0,
      sourceMode: input.sourceMode,
      status: 'failed',
    }),
    errors,
    queryCounts: [],
    results: [],
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
    city: input.city,
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
    mode: 'build',
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
      config.requestPath,
      false,
      `Place details lookup is not activated for provider id "${input.providerId}".`,
      input.sourceMode,
    ),
    place: null,
  }
}
