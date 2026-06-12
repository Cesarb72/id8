import { normalizeRawPlace } from '../normalize/normalizeRawPlace'
import {
  createBlockedProviderTrace,
  summarizeProviderCallLedger,
  type ProviderCallLedger,
  type ProviderCallPurpose,
  type ProviderCallTrace,
} from './providerCallTrace'
import type { ProviderVenue } from './providerTypes'
import {
  getGooglePlacesConfig,
  isDevOrSandboxCloseoutFlow,
} from '../sources/getSourceMode'
import { mapLivePlaceToRawPlace } from '../sources/mapLivePlaceToRawPlace'
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

  return {
    diagnostics: buildBlockedDiagnostics(
      input.callPurpose,
      config.requestPath,
      false,
      'Browser Google Places provider path is disabled; use the server Field proxy.',
      input.sourceMode,
    ),
    errors: [],
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
      config.requestPath,
      false,
      `Place details lookup is not activated for provider id "${input.providerId}".`,
      input.sourceMode,
    ),
    place: null,
  }
}
