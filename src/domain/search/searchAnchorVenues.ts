import { normalizeRawPlace } from '../normalize/normalizeRawPlace'
import {
  getGooglePlacesConfig,
  hasGooglePlacesConfig,
  isDevOrSandboxCloseoutFlow,
} from '../sources/getSourceMode'
import { curatedVenues } from '../../data/venues'
import {
  mapLivePlaceToRawPlace,
  type GooglePlaceRecord,
} from '../sources/mapLivePlaceToRawPlace'
import type { LivePlaceKind } from '../sources/buildLiveQueryPlan'
import type { Venue } from '../types/venue'

export type AnchorSearchChip = 'restaurant' | 'movie' | 'drinks' | 'park' | 'activity'

export interface AnchorSearchResult {
  venue: Venue
  subtitle: string
}

const googleFieldMask = [
  'places.id',
  'places.displayName',
  'places.primaryType',
  'places.types',
  'places.formattedAddress',
  'places.shortFormattedAddress',
  'places.addressComponents',
  'places.editorialSummary',
  'places.businessStatus',
  'places.currentOpeningHours.openNow',
  'places.currentOpeningHours.weekdayDescriptions',
  'places.currentOpeningHours.periods',
  'places.priceLevel',
  'places.regularOpeningHours.weekdayDescriptions',
  'places.regularOpeningHours.periods',
  'places.rating',
  'places.userRatingCount',
  'places.utcOffsetMinutes',
  'places.websiteUri',
  'places.location',
].join(',')

function normalizeValue(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_]+/g, '-')
}

function normalizeCity(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\./g, '')
  const [head] = normalized.split(',')
  return (head ?? normalized).trim()
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function mapChipToQueryHint(chip?: AnchorSearchChip): string | undefined {
  if (chip === 'restaurant') {
    return 'restaurant'
  }
  if (chip === 'movie') {
    return 'movie theater'
  }
  if (chip === 'drinks') {
    return 'cocktail bar'
  }
  if (chip === 'park') {
    return 'park'
  }
  if (chip === 'activity') {
    return 'activity'
  }
  return undefined
}

function buildTextQuery(
  query: string,
  city: string,
  neighborhood?: string,
  chip?: AnchorSearchChip,
): string {
  const locationLabel = neighborhood ? `${neighborhood}, ${city}` : city
  const hint = mapChipToQueryHint(chip)
  return hint ? `${query} ${hint} in ${locationLabel}` : `${query} in ${locationLabel}`
}

function mapChipToRequestedKind(chip?: AnchorSearchChip): LivePlaceKind {
  if (chip === 'drinks') {
    return 'bar'
  }
  if (chip === 'park') {
    return 'park'
  }
  if (chip === 'movie' || chip === 'activity') {
    return 'activity'
  }
  return 'restaurant'
}

function buildAnchorQueryTerms(query: string, chip?: AnchorSearchChip): string[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3)
    .slice(0, 4)
  const chipHint = mapChipToQueryHint(chip)
  return unique(chipHint ? [...terms, chipHint] : terms)
}

function mapGooglePlaceToVenue(
  place: GooglePlaceRecord,
  rank: number,
  query: string,
  city: string,
  neighborhood?: string,
  chip?: AnchorSearchChip,
): Venue | undefined {
  const requestedKind = mapChipToRequestedKind(chip)
  const queryTerms = buildAnchorQueryTerms(query, chip)
  const rawPlace = mapLivePlaceToRawPlace(place, {
    city,
    neighborhood,
    requestedKind,
    queryLabel: 'anchor-search',
    queryTerms,
    rank,
  })
  if (!rawPlace) {
    return undefined
  }

  const anchorName = rawPlace.name.trim()
  return normalizeRawPlace({
    ...rawPlace,
    driveMinutes: neighborhood ? 10 : 12,
    shortDescription:
      place.editorialSummary?.text?.trim() ??
      `${anchorName} was selected as a user-led plan anchor.`,
    narrativeFlavor: `${anchorName} is the chosen anchor for a user-led outing.`,
  })
}

async function searchGooglePlaces(
  query: string,
  city: string,
  neighborhood?: string,
  chip?: AnchorSearchChip,
): Promise<AnchorSearchResult[]> {
  const config = getGooglePlacesConfig()
  if (!config.apiKey) {
    return []
  }

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': config.apiKey,
      'X-Goog-FieldMask': googleFieldMask,
    },
    body: JSON.stringify({
      textQuery: buildTextQuery(query, city, neighborhood, chip),
      pageSize: Math.min(config.pageSize, 6),
      languageCode: config.languageCode,
      regionCode: config.regionCode,
      rankPreference: 'RELEVANCE',
    }),
  })

  if (!response.ok) {
    throw new Error(`Anchor search failed (${response.status})`)
  }

  const payload = (await response.json()) as { places?: GooglePlaceRecord[] }
  return (payload.places ?? [])
    .map((place, index) => {
      const venue = mapGooglePlaceToVenue(place, index, query, city, neighborhood, chip)
      if (!venue) {
        return undefined
      }
      return {
        venue,
        subtitle: place.shortFormattedAddress ?? place.formattedAddress ?? venue.neighborhood,
      }
    })
    .filter((value): value is AnchorSearchResult => Boolean(value))
}

function scoreFallbackVenue(
  venue: Venue,
  query: string,
  chip?: AnchorSearchChip,
): number {
  const normalizedQuery = query.trim().toLowerCase()
  const haystack = [
    venue.name,
    venue.category,
    venue.subcategory,
    venue.shortDescription,
    ...venue.tags,
  ]
    .join(' ')
    .toLowerCase()
  const nameMatch = venue.name.toLowerCase().includes(normalizedQuery) ? 4 : 0
  const textMatch = haystack.includes(normalizedQuery) ? 2 : 0
  const chipMatch =
    chip === 'drinks'
      ? venue.category === 'bar'
      : chip === 'restaurant'
        ? venue.category === 'restaurant'
        : chip === 'park'
          ? venue.category === 'park'
          : chip === 'movie' || chip === 'activity'
            ? venue.category === 'activity' || venue.category === 'event' || venue.category === 'museum'
            : false
  return nameMatch + textMatch + (chipMatch ? 1 : 0)
}

function searchFallbackVenues(
  query: string,
  city: string,
  neighborhood?: string,
  chip?: AnchorSearchChip,
): AnchorSearchResult[] {
  return curatedVenues
    .filter((venue) => normalizeCity(venue.city) === normalizeCity(city))
    .filter((venue) => !neighborhood || venue.neighborhood.toLowerCase().includes(neighborhood.toLowerCase()))
    .map((venue) => ({
      venue,
      score: scoreFallbackVenue(venue, query, chip),
      subtitle: `${venue.neighborhood} - ${venue.category.replace('_', ' ')}`,
    }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || left.venue.driveMinutes - right.venue.driveMinutes)
    .slice(0, 6)
    .map(({ venue, subtitle }) => ({ venue, subtitle }))
}

export async function searchAnchorVenues(input: {
  query: string
  city: string
  neighborhood?: string
  chip?: AnchorSearchChip
}): Promise<AnchorSearchResult[]> {
  const trimmedQuery = input.query.trim()
  if (trimmedQuery.length < 2) {
    return []
  }

  if (isDevOrSandboxCloseoutFlow()) {
    return searchFallbackVenues(trimmedQuery, input.city, input.neighborhood, input.chip)
  }

  if (!hasGooglePlacesConfig()) {
    return searchFallbackVenues(trimmedQuery, input.city, input.neighborhood, input.chip)
  }

  try {
    const googleResults = await searchGooglePlaces(
      trimmedQuery,
      input.city,
      input.neighborhood,
      input.chip,
    )
    if (googleResults.length > 0) {
      return googleResults
    }
  } catch (error) {
    void error
  }

  return searchFallbackVenues(trimmedQuery, input.city, input.neighborhood, input.chip)
}
