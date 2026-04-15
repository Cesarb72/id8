import type {
  DistrictPoint,
  ResolveLocationInput,
  ResolvedLocation,
} from '../types/districtTypes'
import { getPseudoCityCenter } from './pseudoCityCenter'

const DEFAULT_RADIUS_M = 2500
const MIN_RADIUS_M = 400
const MAX_RADIUS_M = 12000

const SAN_JOSE_CENTER: DistrictPoint = {
  lat: 37.3382,
  lng: -121.8863,
}

const DENVER_CENTER: DistrictPoint = {
  lat: 39.7392,
  lng: -104.9903,
}

type LocationHint = {
  tokens: string[]
  center: DistrictPoint
  radiusM: number
  city: string
  neighborhood?: string
}

const LOCATION_HINTS: LocationHint[] = [
  {
    tokens: ['san jose', 'sanjose'],
    center: SAN_JOSE_CENTER,
    radiusM: 5000,
    city: 'San Jose',
  },
  {
    tokens: ['downtown san jose', 'san jose downtown'],
    center: { lat: 37.3352, lng: -121.8863 },
    radiusM: 2200,
    city: 'San Jose',
    neighborhood: 'Downtown',
  },
  {
    tokens: ['sofa'],
    center: { lat: 37.3329, lng: -121.8883 },
    radiusM: 1800,
    city: 'San Jose',
    neighborhood: 'SoFA District',
  },
  {
    tokens: ['santana row', 'santana'],
    center: { lat: 37.3208, lng: -121.9482 },
    radiusM: 1800,
    city: 'San Jose',
    neighborhood: 'Santana Row',
  },
  {
    tokens: ['willow glen'],
    center: { lat: 37.3051, lng: -121.9019 },
    radiusM: 2000,
    city: 'San Jose',
    neighborhood: 'Willow Glen',
  },
  {
    tokens: ['japantown', 'j town', 'j-town'],
    center: { lat: 37.3489, lng: -121.8945 },
    radiusM: 1700,
    city: 'San Jose',
    neighborhood: 'Japantown',
  },
  {
    tokens: ['denver', 'denver co', 'denver colorado', 'denver, co'],
    center: DENVER_CENTER,
    radiusM: 6200,
    city: 'Denver',
  },
  {
    tokens: ['lodo', 'lo do', 'lower downtown', 'downtown denver'],
    center: { lat: 39.7527, lng: -104.9993 },
    radiusM: 2200,
    city: 'Denver',
    neighborhood: 'Downtown / LoDo',
  },
  {
    tokens: ['rino', 'ri no', 'river north'],
    center: { lat: 39.7688, lng: -104.9799 },
    radiusM: 2100,
    city: 'Denver',
    neighborhood: 'RiNo',
  },
  {
    tokens: ['cherry creek'],
    center: { lat: 39.7197, lng: -104.9522 },
    radiusM: 2000,
    city: 'Denver',
    neighborhood: 'Cherry Creek',
  },
  {
    tokens: ['highlands', 'lohi', 'lo hi'],
    center: { lat: 39.7583, lng: -105.013 },
    radiusM: 2100,
    city: 'Denver',
    neighborhood: 'Highlands / LoHi',
  },
]

const AMBIGUOUS_QUERIES = new Set([
  'downtown',
  'midtown',
  'uptown',
  'city center',
  'city centre',
])

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function toTitleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')
}

function parseCityStateQuery(query: string): { city: string; stateCode: string } | undefined {
  const match = query
    .trim()
    .match(/^([a-zA-Z][a-zA-Z .'-]{1,})\s*,\s*([a-zA-Z]{2})$/)
  if (!match) {
    return undefined
  }
  const city = toTitleCase(match[1].trim().replace(/\s+/g, ' '))
  const stateCode = match[2].toUpperCase()
  if (!city || !stateCode) {
    return undefined
  }
  return { city, stateCode }
}

function parseLatLngQuery(query: string): DistrictPoint | undefined {
  const match = query.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/)
  if (!match) {
    return undefined
  }

  const lat = Number(match[1])
  const lng = Number(match[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return undefined
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return undefined
  }

  return { lat, lng }
}

function resolveFromHint(normalizedQuery: string): LocationHint | undefined {
  const matches = LOCATION_HINTS.filter((hint) =>
    hint.tokens.some((token) => normalizedQuery.includes(token)),
  )
  if (matches.length === 0) {
    return undefined
  }
  return matches.sort((left, right) => {
    const leftTokenLength = Math.max(...left.tokens.map((token) => token.length))
    const rightTokenLength = Math.max(...right.tokens.map((token) => token.length))
    if (rightTokenLength !== leftTokenLength) {
      return rightTokenLength - leftTokenLength
    }
    return left.city.localeCompare(right.city)
  })[0]
}

export function resolveLocation(input: ResolveLocationInput): ResolvedLocation {
  const normalizedQuery = normalizeQuery(input.locationQuery)
  const nowIso = new Date().toISOString()

  if (input.userLatLng) {
    return {
      query: input.locationQuery,
      normalizedQuery,
      displayLabel: input.locationQuery.trim() || 'Current location',
      center: input.userLatLng,
      radiusM: clamp(input.searchRadiusM ?? DEFAULT_RADIUS_M, MIN_RADIUS_M, MAX_RADIUS_M),
      confidence: 'high',
      source: 'user_lat_lng',
      meta: {
        geocoder: 'manual-user-location',
        resolvedAtIso: nowIso,
      },
    }
  }

  const parsedLatLng = parseLatLngQuery(normalizedQuery)
  if (parsedLatLng) {
    return {
      query: input.locationQuery,
      normalizedQuery,
      displayLabel: input.locationQuery.trim(),
      center: parsedLatLng,
      radiusM: clamp(input.searchRadiusM ?? DEFAULT_RADIUS_M, MIN_RADIUS_M, MAX_RADIUS_M),
      confidence: 'medium',
      source: 'query_coordinates',
      meta: {
        geocoder: 'query-coordinate-parser',
        resolvedAtIso: nowIso,
      },
    }
  }

  if (!normalizedQuery) {
    return {
      query: input.locationQuery,
      normalizedQuery,
      displayLabel: 'Location required',
      center: SAN_JOSE_CENTER,
      radiusM: clamp(input.searchRadiusM ?? DEFAULT_RADIUS_M, MIN_RADIUS_M, MAX_RADIUS_M),
      confidence: 'low',
      source: 'unresolved_query',
      meta: {
        geocoder: 'heuristic-location-hints',
        unresolvedReason: 'Enter a city or neighborhood (for example: "San Jose, CA" or "Denver, CO").',
        resolvedAtIso: nowIso,
      },
    }
  }

  const hint = resolveFromHint(normalizedQuery)
  if (hint) {
    return {
      query: input.locationQuery,
      normalizedQuery,
      displayLabel: hint.neighborhood ? `${hint.neighborhood}, ${hint.city}` : hint.city,
      center: hint.center,
      radiusM: clamp(input.searchRadiusM ?? hint.radiusM, MIN_RADIUS_M, MAX_RADIUS_M),
      confidence: normalizedQuery.length > 0 ? 'medium' : 'low',
      source: 'query_lookup',
      meta: {
        city: hint.city,
        neighborhood: hint.neighborhood,
        countryCode: 'US',
        geocoder: 'heuristic-location-hints',
        resolvedAtIso: nowIso,
      },
    }
  }

  const parsedCityState = parseCityStateQuery(input.locationQuery)
  if (parsedCityState) {
    return {
      query: input.locationQuery,
      normalizedQuery,
      displayLabel: `${parsedCityState.city}, ${parsedCityState.stateCode}`,
      center: getPseudoCityCenter(parsedCityState.city),
      radiusM: clamp(input.searchRadiusM ?? 6200, MIN_RADIUS_M, MAX_RADIUS_M),
      confidence: 'low',
      source: 'query_lookup',
      meta: {
        city: parsedCityState.city,
        countryCode: 'US',
        geocoder: 'heuristic-city-state-parser',
        resolvedAtIso: nowIso,
      },
    }
  }

  const unresolvedReason = AMBIGUOUS_QUERIES.has(normalizedQuery)
    ? 'Location is ambiguous. Include city/state (for example: "Downtown San Jose" or "Downtown Denver").'
    : `Could not resolve "${input.locationQuery.trim()}". Try "City, ST".`

  return {
    query: input.locationQuery,
    normalizedQuery,
    displayLabel: input.locationQuery.trim() || 'Unresolved location',
    center: SAN_JOSE_CENTER,
    radiusM: clamp(input.searchRadiusM ?? DEFAULT_RADIUS_M, MIN_RADIUS_M, MAX_RADIUS_M),
    confidence: 'low',
    source: 'unresolved_query',
    meta: {
      geocoder: 'heuristic-location-hints',
      unresolvedReason,
      resolvedAtIso: nowIso,
    },
  }
}
