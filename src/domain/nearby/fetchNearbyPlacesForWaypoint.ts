import type { HoursPeriod } from '../types/hours'
import type { UserStopRole } from '../types/itinerary'
import { createLiveGoogleVenueId } from '../providers/admitLiveVenueIdentity'
import {
  searchPlaces,
  type ProviderTextSearchQuery,
} from '../providers/ProviderAdapter'
import type { ProviderVenue } from '../providers/providerTypes'
import {
  CLOSED_RUNTIME_LIVE_ENVELOPE,
  type LiveProviderEnvelope,
} from '../retrieval/liveEnvelope'
import { getGooglePlacesConfig } from '../sources/getSourceMode'

export interface NearbyPlaceSource {
  normalizedFromRawType: 'raw-place'
  sourceOrigin: 'live'
  provider: 'google-places'
  providerRecordId: string
  sourceQueryLabel: string
}

interface NearbyPlaceOpeningHours {
  openNow?: boolean
  periods?: HoursPeriod[]
  weekdayDescriptions?: string[]
}

export interface NearbyPlaceRecord {
  id: string
  providerRecordId: string
  name: string
  category: 'nightlife' | 'dessert' | 'cafe' | 'fallback'
  minutesAway: number
  coordinates: [number, number]
  openNow?: boolean
  hoursStatus: 'open' | 'closed' | 'unknown'
  freshnessNote?: string
  freshnessWarning?: string
  currentOpeningHours?: NearbyPlaceOpeningHours
  regularOpeningHours?: NearbyPlaceOpeningHours
  sourceOrigin: 'live'
  provider: 'google-places'
  normalizedFromRawType: 'raw-place'
  sourceQueryLabel: string
  source: NearbyPlaceSource
}

interface NearbyWaypointInput {
  role: UserStopRole
  name: string
  coordinates: [number, number]
}

interface GoogleNearbyPlaceRecord {
  id?: string
  displayName?: { text?: string }
  primaryType?: string
  types?: string[]
}

interface NearbyFetchQueryDiagnostic {
  queryText: string
  status: 'ok' | 'error'
  responseCount: number
  error?: string
}

export interface NearbyFetchDiagnostic {
  places: NearbyPlaceRecord[]
  reason:
    | 'ok'
    | 'dev-closeout-offline-mode'
    | 'missing-api-key'
    | 'runtime-provider-disabled'
    | 'request-error'
    | 'zero-results'
    | 'filtered-out'
  requestPath: string
  keyPresent: boolean
  role: UserStopRole
  waypointName: string
  queryDiagnostics: NearbyFetchQueryDiagnostic[]
  rawResultCount: number
  parsedCount: number
  nearbyFreshnessSuppressedCount: number
  nearbyFreshnessUnknownCount: number
  nearbyFreshnessOpenCount: number
  nearbyFreshnessSuppressionReasons: string[]
}

const NEARBY_LIMIT_BY_ROLE: Record<UserStopRole, number> = {
  start: 4,
  highlight: 6,
  windDown: 5,
  surprise: 4,
}

const NEARBY_RADIUS_BY_ROLE: Record<UserStopRole, number> = {
  start: 900,
  highlight: 700,
  windDown: 950,
  surprise: 850,
}

const NEARBY_QUERIES_BY_ROLE: Record<UserStopRole, string[]> = {
  start: ['coffee shop', 'cafe', 'bakery'],
  highlight: ['cocktail bar', 'live music venue', 'nightlife'],
  windDown: ['dessert shop', 'gelato', 'tea house'],
  surprise: ['cocktail bar', 'dessert shop', 'cafe'],
}

function normalizeType(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_]+/g, '-')
}

function classifyNearbyCategory(place: GoogleNearbyPlaceRecord): NearbyPlaceRecord['category'] {
  const types = [place.primaryType, ...(place.types ?? [])]
    .filter((value): value is string => Boolean(value))
    .map(normalizeType)

  if (
    types.some((value) =>
      ['bar', 'cocktail-bar', 'night-club', 'pub', 'live-music-venue'].includes(value),
    )
  ) {
    return 'nightlife'
  }
  if (
    types.some((value) =>
      ['dessert-shop', 'ice-cream-shop', 'bakery', 'pastry-shop'].includes(value),
    )
  ) {
    return 'dessert'
  }
  if (
    types.some((value) =>
      ['cafe', 'coffee-shop', 'tea-house', 'brunch-restaurant'].includes(value),
    )
  ) {
    return 'cafe'
  }
  return 'fallback'
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180
}

function computeDistanceMeters(from: [number, number], to: [number, number]): number {
  const [fromLng, fromLat] = from
  const [toLng, toLat] = to
  const earthRadiusMeters = 6371000
  const deltaLat = toRadians(toLat - fromLat)
  const deltaLng = toRadians(toLng - fromLng)
  const fromLatRadians = toRadians(fromLat)
  const toLatRadians = toRadians(toLat)
  const haversine =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(fromLatRadians) *
      Math.cos(toLatRadians) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2)
  const angularDistance = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  return earthRadiusMeters * angularDistance
}

function estimateMinutesAway(distanceMeters: number): number {
  const walkingMetersPerMinute = 85
  return Math.max(1, Math.round(distanceMeters / walkingMetersPerMinute))
}

function buildNearbyPlaceRecord(params: {
  providerRecordId: string
  name: string
  category: NearbyPlaceRecord['category']
  minutesAway: number
  coordinates: [number, number]
  openNow?: boolean
  hoursStatus: NearbyPlaceRecord['hoursStatus']
  freshnessNote?: string
  freshnessWarning?: string
  currentOpeningHours?: NearbyPlaceOpeningHours
  regularOpeningHours?: NearbyPlaceOpeningHours
  role: UserStopRole
}): NearbyPlaceRecord {
  const providerRecordId = params.providerRecordId.trim()
  const sourceQueryLabel = `nearby-${params.role}`
  const source: NearbyPlaceSource = {
    normalizedFromRawType: 'raw-place',
    sourceOrigin: 'live',
    provider: 'google-places',
    providerRecordId,
    sourceQueryLabel,
  }
  return {
    id: createLiveGoogleVenueId(providerRecordId),
    providerRecordId,
    name: params.name.trim(),
    category: params.category,
    minutesAway: params.minutesAway,
    coordinates: params.coordinates,
    openNow: params.openNow,
    hoursStatus: params.hoursStatus,
    freshnessNote: params.freshnessNote,
    freshnessWarning: params.freshnessWarning,
    currentOpeningHours: params.currentOpeningHours,
    regularOpeningHours: params.regularOpeningHours,
    sourceOrigin: source.sourceOrigin,
    provider: source.provider,
    normalizedFromRawType: source.normalizedFromRawType,
    sourceQueryLabel: source.sourceQueryLabel,
    source,
  }
}

type NearbyFreshnessEvaluation =
  | {
      status: 'open'
      openNow?: boolean
      note: string
      warning?: string
    }
  | {
      status: 'closed'
      openNow?: boolean
      suppressionReason: string
    }
  | {
      status: 'unknown'
      openNow?: boolean
      note: string
      warning: string
    }

function getMinutesSinceWeekStart(date: Date): number {
  return date.getDay() * 1440 + date.getHours() * 60 + date.getMinutes()
}

function toWeekMinute(day: number, hour: number, minute: number): number {
  return day * 1440 + hour * 60 + minute
}

function normalizePeriods(
  periods: HoursPeriod[] | undefined,
): Array<{ start: number; end: number }> {
  if (!periods || periods.length === 0) {
    return []
  }

  const normalized: Array<{ start: number; end: number }> = []
  for (const period of periods) {
    if (
      period.open?.day === undefined ||
      period.open.hour === undefined ||
      period.open.minute === undefined
    ) {
      continue
    }
    const start = toWeekMinute(period.open.day, period.open.hour, period.open.minute)
    const closeDay = period.close?.day
    const closeHour = period.close?.hour
    const closeMinute = period.close?.minute

    if (
      closeDay === undefined ||
      closeHour === undefined ||
      closeMinute === undefined
    ) {
      continue
    }

    let end = toWeekMinute(closeDay, closeHour, closeMinute)
    if (end <= start) {
      end += 7 * 1440
    }
    normalized.push({ start, end })
  }
  return normalized
}

function inferHoursStatusFromRegularPeriods(
  periods: HoursPeriod[] | undefined,
  now: Date,
): 'open' | 'closed' | 'unknown' {
  const normalizedPeriods = normalizePeriods(periods)
  if (normalizedPeriods.length === 0) {
    return 'unknown'
  }

  const currentMinute = getMinutesSinceWeekStart(now)
  const weekMinutes = 7 * 1440
  const comparableMinutes = [currentMinute, currentMinute + weekMinutes]
  const isOpen = normalizedPeriods.some((period) =>
    comparableMinutes.some((minute) => minute >= period.start && minute < period.end),
  )

  return isOpen ? 'open' : 'closed'
}

function toSafeOpeningHours(
  openingHours:
    | ProviderVenue['currentOpeningHours']
    | ProviderVenue['regularOpeningHours']
    | undefined,
): NearbyPlaceOpeningHours | undefined {
  if (!openingHours) {
    return undefined
  }
  return {
    openNow: openingHours.openNow,
    periods: openingHours.periods,
    weekdayDescriptions: openingHours.weekdayDescriptions,
  }
}

function evaluateNearbyFreshness(
  providerVenue: ProviderVenue,
  now: Date,
): NearbyFreshnessEvaluation {
  const currentOpenNow = providerVenue.currentOpeningHours?.openNow
  if (currentOpenNow === true) {
    return {
      status: 'open',
      openNow: true,
      note: 'Allowed because currentOpeningHours.openNow reported open.',
    }
  }
  if (currentOpenNow === false) {
    return {
      status: 'closed',
      openNow: false,
      suppressionReason: 'Suppressed because currentOpeningHours.openNow reported closed.',
    }
  }

  const inferredStatus = inferHoursStatusFromRegularPeriods(
    providerVenue.regularOpeningHours?.periods,
    now,
  )
  if (inferredStatus === 'open') {
    return {
      status: 'open',
      note: 'Allowed because regularOpeningHours periods inferred open now.',
      warning: 'Current open-now signal unavailable; using regular hours inference.',
    }
  }
  if (inferredStatus === 'closed') {
    return {
      status: 'closed',
      suppressionReason: 'Suppressed because regularOpeningHours periods inferred closed now.',
    }
  }

  return {
    status: 'unknown',
    note: 'Allowed with unknown freshness because no clear open-now signal was available.',
    warning: 'Hours unknown for this nearby candidate.',
  }
}

export async function fetchNearbyPlacesForWaypoint(
  waypoint: NearbyWaypointInput,
  options: { runtimeLiveEnvelope?: LiveProviderEnvelope } = {},
): Promise<NearbyFetchDiagnostic> {
  const runtimeLiveEnvelope = options.runtimeLiveEnvelope ?? CLOSED_RUNTIME_LIVE_ENVELOPE
  if (runtimeLiveEnvelope.liveProviderAllowed !== true) {
    return {
      places: [],
      reason: 'runtime-provider-disabled',
      requestPath: getGooglePlacesConfig().requestPath,
      keyPresent: false,
      role: waypoint.role,
      waypointName: waypoint.name,
      queryDiagnostics: [],
      rawResultCount: 0,
      parsedCount: 0,
      nearbyFreshnessSuppressedCount: 0,
      nearbyFreshnessUnknownCount: 0,
      nearbyFreshnessOpenCount: 0,
      nearbyFreshnessSuppressionReasons: [],
    }
  }

  const fieldMask = [
    'places.id',
    'places.displayName',
    'places.primaryType',
    'places.types',
    'places.currentOpeningHours.openNow',
    'places.currentOpeningHours.weekdayDescriptions',
    'places.currentOpeningHours.periods',
    'places.regularOpeningHours.weekdayDescriptions',
    'places.regularOpeningHours.periods',
    'places.location',
  ].join(',')
  const nearbyQueries = NEARBY_QUERIES_BY_ROLE[waypoint.role] ?? NEARBY_QUERIES_BY_ROLE.highlight
  const nearbyRadius = NEARBY_RADIUS_BY_ROLE[waypoint.role] ?? 850
  const nearbyLimit = NEARBY_LIMIT_BY_ROLE[waypoint.role] ?? 4
  const providerResults = await searchPlaces<
    {
      coordinates: [number, number]
      currentOpeningHours?: NearbyPlaceOpeningHours
      displayName: string
      openNow?: boolean
      primaryType?: string
      providerRecordId: string
      regularOpeningHours?: NearbyPlaceOpeningHours
      types: string[]
    },
    ProviderTextSearchQuery
  >({
    callPurpose: 'waypoint_nearby',
    mapPlace: (place) => {
      const latitude = place.location?.latitude
      const longitude = place.location?.longitude
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return undefined
      }
      return {
        coordinates: [longitude, latitude],
        currentOpeningHours: toSafeOpeningHours(place.currentOpeningHours),
        displayName: place.displayName,
        openNow: place.currentOpeningHours?.openNow,
        primaryType: place.primaryType,
        providerRecordId: place.providerRecordId,
        regularOpeningHours: toSafeOpeningHours(place.regularOpeningHours),
        types: place.types ?? [],
      }
    },
    queries: nearbyQueries.map((queryText) => ({
      fieldMask,
      locationBias: {
        circle: {
          center: {
            latitude: waypoint.coordinates[1],
            longitude: waypoint.coordinates[0],
          },
          radius: nearbyRadius,
        },
      },
      pageSize: 6,
      queryLabel: `nearby-${waypoint.role}-${normalizeType(queryText)}`,
      rankPreference: 'DISTANCE',
      textQuery: `${queryText} near ${waypoint.name}, San Jose`,
    })),
    envelope: {
      maxProviderCalls: runtimeLiveEnvelope.maxProviderCalls,
      maxQueryLabels: runtimeLiveEnvelope.maxQueryLabels,
    },
  })
  const { diagnostics } = providerResults
  const requestPath = diagnostics.requestPath
  const keyPresent = diagnostics.keyPresent

  if (diagnostics.blockedByEnv) {
    return {
      places: [],
      reason: keyPresent ? 'dev-closeout-offline-mode' : 'missing-api-key',
      requestPath,
      keyPresent,
      role: waypoint.role,
      waypointName: waypoint.name,
      queryDiagnostics: [],
      rawResultCount: 0,
      parsedCount: 0,
      nearbyFreshnessSuppressedCount: 0,
      nearbyFreshnessUnknownCount: 0,
      nearbyFreshnessOpenCount: 0,
      nearbyFreshnessSuppressionReasons: [],
    }
  }

  const byId = new Map<string, NearbyPlaceRecord>()
  const rawResultCount = diagnostics.resultCount
  let nearbyFreshnessSuppressedCount = 0
  let nearbyFreshnessUnknownCount = 0
  let nearbyFreshnessOpenCount = 0
  const nearbyFreshnessSuppressionReasons: string[] = []
  const now = new Date()
  const queryDiagnostics: NearbyFetchQueryDiagnostic[] = nearbyQueries.map((queryText, index) => ({
    queryText,
    status: providerResults.errors[index] ? 'error' : 'ok',
    responseCount: providerResults.queryCounts[index]?.resultCount ?? 0,
    error: providerResults.errors[index],
  }))

  for (const place of providerResults.results) {
    if (byId.has(place.providerRecordId)) {
      continue
    }
    const freshness = evaluateNearbyFreshness(
      {
        provider: 'google_places',
        providerRecordId: place.providerRecordId,
        displayName: place.displayName,
        currentOpeningHours: place.currentOpeningHours,
        fetchedAt: now.getTime(),
        rawPayloadAvailable: false,
        regularOpeningHours: place.regularOpeningHours,
        sourceMode: 'live',
        completenessHints: {
          hasAddress: false,
          hasHours: Boolean(
            place.currentOpeningHours?.weekdayDescriptions?.length ||
              place.regularOpeningHours?.weekdayDescriptions?.length,
          ),
          hasLocation: true,
          hasPrimaryType: Boolean(place.primaryType),
          hasRating: false,
        },
        location: {
          latitude: place.coordinates[1],
          longitude: place.coordinates[0],
        },
        primaryType: place.primaryType,
        types: place.types,
      },
      now,
    )
    if (freshness.status === 'closed') {
      nearbyFreshnessSuppressedCount += 1
      nearbyFreshnessSuppressionReasons.push(freshness.suppressionReason)
      continue
    }
    const minutesAway = estimateMinutesAway(
      computeDistanceMeters(waypoint.coordinates, place.coordinates),
    )
    if (freshness.status === 'open') {
      nearbyFreshnessOpenCount += 1
    } else {
      nearbyFreshnessUnknownCount += 1
    }
    byId.set(
      place.providerRecordId,
      buildNearbyPlaceRecord({
        providerRecordId: place.providerRecordId,
        name: place.displayName,
        category: classifyNearbyCategory({
          primaryType: place.primaryType,
          types: place.types,
        }),
        minutesAway,
        coordinates: place.coordinates,
        openNow: freshness.openNow,
        hoursStatus: freshness.status,
        freshnessNote: freshness.note,
        freshnessWarning: freshness.warning,
        currentOpeningHours: place.currentOpeningHours,
        regularOpeningHours: place.regularOpeningHours,
        role: waypoint.role,
      }),
    )
  }

  const places = Array.from(byId.values()).slice(0, nearbyLimit)
  const parsedCount = places.length
  const reason: NearbyFetchDiagnostic['reason'] =
    parsedCount > 0
      ? 'ok'
      : providerResults.errors.length > 0
        ? 'request-error'
        : rawResultCount === 0
          ? 'zero-results'
          : 'filtered-out'

  return {
    places,
    reason,
    requestPath,
    keyPresent,
    role: waypoint.role,
    waypointName: waypoint.name,
    queryDiagnostics,
    rawResultCount,
    parsedCount,
    nearbyFreshnessSuppressedCount,
    nearbyFreshnessUnknownCount,
    nearbyFreshnessOpenCount,
    nearbyFreshnessSuppressionReasons,
  }
}
