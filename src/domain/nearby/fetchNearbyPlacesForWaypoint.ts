import type { UserStopRole } from '../types/itinerary'
import { getNearbyPlaces } from '../providers/ProviderAdapter'

export interface NearbyPlaceSource {
  normalizedFromRawType: 'raw-place'
  sourceOrigin: 'live'
  provider: 'google-places'
  providerRecordId: string
  sourceQueryLabel: string
}

export interface NearbyPlaceRecord {
  id: string
  providerRecordId: string
  name: string
  category: 'nightlife' | 'dessert' | 'cafe' | 'fallback'
  minutesAway: number
  coordinates: [number, number]
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
  location?: {
    latitude?: number
    longitude?: number
  }
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
    id: `live_google_${providerRecordId}`,
    providerRecordId,
    name: params.name.trim(),
    category: params.category,
    minutesAway: params.minutesAway,
    coordinates: params.coordinates,
    sourceOrigin: source.sourceOrigin,
    provider: source.provider,
    normalizedFromRawType: source.normalizedFromRawType,
    sourceQueryLabel: source.sourceQueryLabel,
    source,
  }
}

export async function fetchNearbyPlacesForWaypoint(
  waypoint: NearbyWaypointInput,
): Promise<NearbyFetchDiagnostic> {
  const fieldMask = [
    'places.id',
    'places.displayName',
    'places.primaryType',
    'places.types',
    'places.location',
  ].join(',')
  const nearbyQueries = NEARBY_QUERIES_BY_ROLE[waypoint.role] ?? NEARBY_QUERIES_BY_ROLE.highlight
  const nearbyRadius = NEARBY_RADIUS_BY_ROLE[waypoint.role] ?? 850
  const nearbyLimit = NEARBY_LIMIT_BY_ROLE[waypoint.role] ?? 4
  const providerResults = await getNearbyPlaces({
    fieldMask,
    limit: 6,
    queries: nearbyQueries.map((queryText) => ({
      queryLabel: `nearby-${waypoint.role}-${normalizeType(queryText)}`,
      radiusM: nearbyRadius,
      textQuery: `${queryText} near ${waypoint.name}, San Jose`,
      waypointCoordinates: waypoint.coordinates,
    })),
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
    }
  }

  const byId = new Map<string, NearbyPlaceRecord>()
  const rawResultCount = diagnostics.resultCount
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
    const minutesAway = estimateMinutesAway(
      computeDistanceMeters(waypoint.coordinates, place.coordinates),
    )
    byId.set(
      place.providerRecordId,
      buildNearbyPlaceRecord({
        providerRecordId: place.providerRecordId,
        name: place.name,
        category: classifyNearbyCategory({
          primaryType: place.primaryType,
          types: place.types,
        }),
        minutesAway,
        coordinates: place.coordinates,
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
  }
}
