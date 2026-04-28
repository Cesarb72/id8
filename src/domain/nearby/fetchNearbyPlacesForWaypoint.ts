import type { UserStopRole } from '../types/itinerary'
import {
  getGooglePlacesConfig,
  hasGooglePlacesConfig,
  isDevOrSandboxCloseoutFlow,
} from '../sources/getSourceMode'

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

interface GoogleNearbySearchResponse {
  places?: GoogleNearbyPlaceRecord[]
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
  const config = getGooglePlacesConfig()
  const keyPresent = Boolean(config.apiKey)
  const requestPath = config.endpoint
  if (isDevOrSandboxCloseoutFlow()) {
    return {
      places: [],
      reason: 'dev-closeout-offline-mode',
      requestPath,
      keyPresent,
      role: waypoint.role,
      waypointName: waypoint.name,
      queryDiagnostics: [],
      rawResultCount: 0,
      parsedCount: 0,
    }
  }
  if (!hasGooglePlacesConfig() || !keyPresent) {
    return {
      places: [],
      reason: 'missing-api-key',
      requestPath,
      keyPresent,
      role: waypoint.role,
      waypointName: waypoint.name,
      queryDiagnostics: [],
      rawResultCount: 0,
      parsedCount: 0,
    }
  }

  const nearbyQueries = NEARBY_QUERIES_BY_ROLE[waypoint.role] ?? NEARBY_QUERIES_BY_ROLE.highlight
  const nearbyRadius = NEARBY_RADIUS_BY_ROLE[waypoint.role] ?? 850
  const nearbyLimit = NEARBY_LIMIT_BY_ROLE[waypoint.role] ?? 4
  const fieldMask = [
    'places.id',
    'places.displayName',
    'places.primaryType',
    'places.types',
    'places.location',
  ].join(',')

  const settled = await Promise.allSettled(
    nearbyQueries.map(async (queryText) => {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': config.apiKey!,
          'X-Goog-FieldMask': fieldMask,
        },
        body: JSON.stringify({
          textQuery: `${queryText} near ${waypoint.name}, San Jose`,
          pageSize: 6,
          languageCode: config.languageCode,
          regionCode: config.regionCode,
          rankPreference: 'DISTANCE',
          locationBias: {
            circle: {
              center: {
                latitude: waypoint.coordinates[1],
                longitude: waypoint.coordinates[0],
              },
              radius: nearbyRadius,
            },
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`Nearby query failed (${response.status})`)
      }

      const payload = (await response.json()) as GoogleNearbySearchResponse
      return payload.places ?? []
    }),
  )

  const byId = new Map<string, NearbyPlaceRecord>()
  let requestErrorCount = 0
  let rawResultCount = 0
  const queryDiagnostics: NearbyFetchQueryDiagnostic[] = []

  for (let index = 0; index < settled.length; index += 1) {
    const result = settled[index]
    const queryText = nearbyQueries[index] ?? 'unknown'
    if (result.status !== 'fulfilled') {
      requestErrorCount += 1
      queryDiagnostics.push({
        queryText,
        status: 'error',
        responseCount: 0,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      })
      continue
    }
    queryDiagnostics.push({
      queryText,
      status: 'ok',
      responseCount: result.value.length,
    })
    rawResultCount += result.value.length
    for (const place of result.value) {
      const id = place.id?.trim()
      const name = place.displayName?.text?.trim()
      const latitude = place.location?.latitude
      const longitude = place.location?.longitude
      if (!id || !name || typeof latitude !== 'number' || typeof longitude !== 'number') {
        continue
      }
      if (byId.has(id)) {
        continue
      }
      const coordinates: [number, number] = [longitude, latitude]
      const minutesAway = estimateMinutesAway(
        computeDistanceMeters(waypoint.coordinates, coordinates),
      )
      byId.set(
        id,
        buildNearbyPlaceRecord({
          providerRecordId: id,
          name,
          category: classifyNearbyCategory(place),
          minutesAway,
          coordinates,
          role: waypoint.role,
        }),
      )
    }
  }

  const places = Array.from(byId.values()).slice(0, nearbyLimit)
  const parsedCount = places.length
  const reason: NearbyFetchDiagnostic['reason'] =
    parsedCount > 0
      ? 'ok'
      : requestErrorCount > 0
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
