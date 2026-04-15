import { normalizeRawPlace } from '../normalize/normalizeRawPlace'
import { getGooglePlacesConfig, hasGooglePlacesConfig } from '../sources/getSourceMode'
import { curatedVenues } from '../../data/venues'
import type { GooglePlaceRecord } from '../sources/mapLivePlaceToRawPlace'
import type { RawPlace } from '../types/rawPlace'
import type { Venue, VenueCategory } from '../types/venue'

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

function hasAny(values: string[], candidates: string[]): boolean {
  return candidates.some((candidate) => values.includes(candidate))
}

function getNormalizedTypes(place: GooglePlaceRecord): string[] {
  return unique(
    [place.primaryType, ...(place.types ?? [])]
      .filter((value): value is string => Boolean(value))
      .map(normalizeValue)
      .filter(
        (value) =>
          !['food', 'establishment', 'point-of-interest', 'store', 'tourist-attraction'].includes(
            value,
          ),
      ),
  )
}

function resolveAnchorCategory(placeTypes: string[], chip?: AnchorSearchChip): VenueCategory {
  if (hasAny(placeTypes, ['bar', 'cocktail-bar', 'wine-bar', 'pub', 'brewery', 'sports-bar'])) {
    return 'bar'
  }
  if (hasAny(placeTypes, ['cafe', 'coffee-shop', 'tea-house', 'espresso-bar'])) {
    return 'cafe'
  }
  if (
    hasAny(placeTypes, ['restaurant', 'brunch-restaurant', 'fine-dining-restaurant']) ||
    placeTypes.some((type) => type.endsWith('-restaurant'))
  ) {
    return 'restaurant'
  }
  if (hasAny(placeTypes, ['park', 'national-park', 'dog-park', 'garden', 'playground'])) {
    return 'park'
  }
  if (hasAny(placeTypes, ['museum', 'art-gallery'])) {
    return 'museum'
  }
  if (hasAny(placeTypes, ['concert-hall', 'event-venue', 'amphitheater'])) {
    return 'event'
  }
  if (
    hasAny(placeTypes, [
      'movie-theater',
      'bowling-alley',
      'mini-golf-course',
      'escape-room-center',
      'arcade',
      'tourist-attraction',
    ])
  ) {
    return 'activity'
  }

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

function getAddressComponent(
  components: GooglePlaceRecord['addressComponents'],
  candidates: string[],
): string | undefined {
  return components?.find((component) =>
    component.types?.some((type) => candidates.includes(normalizeValue(type))),
  )?.longText
}

function inferCity(place: GooglePlaceRecord, fallback: string): string {
  return (
    getAddressComponent(place.addressComponents, ['locality']) ??
    getAddressComponent(place.addressComponents, ['administrative-area-level-2']) ??
    fallback
  )
}

function inferNeighborhood(place: GooglePlaceRecord, fallback?: string): string | undefined {
  return (
    getAddressComponent(place.addressComponents, ['neighborhood']) ??
    getAddressComponent(place.addressComponents, ['sublocality-level-1', 'sublocality']) ??
    place.shortFormattedAddress?.split(',')[0]?.trim() ??
    fallback
  )
}

function mapPriceTier(priceLevel: string | undefined): RawPlace['priceTier'] {
  if (priceLevel === 'PRICE_LEVEL_FREE' || priceLevel === 'PRICE_LEVEL_INEXPENSIVE') {
    return '$'
  }
  if (priceLevel === 'PRICE_LEVEL_MODERATE') {
    return '$$'
  }
  if (priceLevel === 'PRICE_LEVEL_EXPENSIVE') {
    return '$$$'
  }
  if (priceLevel === 'PRICE_LEVEL_VERY_EXPENSIVE') {
    return '$$$$'
  }
  return '$$'
}

function mapGooglePlaceToVenue(
  place: GooglePlaceRecord,
  city: string,
  neighborhood?: string,
  chip?: AnchorSearchChip,
): Venue | undefined {
  const name = place.displayName?.text?.trim()
  const placeId = place.id?.trim()
  if (!name || !placeId) {
    return undefined
  }

  const placeTypes = getNormalizedTypes(place)
  const category = resolveAnchorCategory(placeTypes, chip)
  const rawPlace: RawPlace = {
    rawType: 'place',
    id: `live_google_${placeId}`,
    name,
    city: inferCity(place, city),
    neighborhood: inferNeighborhood(place, neighborhood) ?? city,
    driveMinutes: neighborhood ? 10 : 12,
    priceTier: mapPriceTier(place.priceLevel),
    tags: unique([
      ...placeTypes,
      ...(chip ? [chip] : []),
      ...(place.editorialSummary?.text
        ?.toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 4)
        .slice(0, 5) ?? []),
    ]).slice(0, 12),
    shortDescription:
      place.editorialSummary?.text?.trim() ?? `${name} was selected as a user-led plan anchor.`,
    narrativeFlavor: `${name} is the chosen anchor for a user-led outing.`,
    imageUrl: '',
    categoryHint: category,
    subcategoryHint: placeTypes[0] ?? category,
    placeTypes,
    sourceTypes: placeTypes,
    normalizedFromRawType: 'raw-place',
    sourceOrigin: 'live',
    provider: 'google-places',
    providerRecordId: placeId,
    sourceQueryLabel: 'anchor-search',
    queryTerms: chip ? [chip] : undefined,
    sourceConfidence: 0.88,
    formattedAddress: place.formattedAddress,
    rating: place.rating,
    ratingCount: place.userRatingCount,
    openNow: place.currentOpeningHours?.openNow,
    businessStatus: place.businessStatus,
    hoursPeriods: undefined,
    currentOpeningHoursText: place.currentOpeningHours?.weekdayDescriptions,
    regularOpeningHoursText: place.regularOpeningHours?.weekdayDescriptions,
    utcOffsetMinutes: place.utcOffsetMinutes,
    latitude: place.location?.latitude,
    longitude: place.location?.longitude,
  }

  return normalizeRawPlace(rawPlace)
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
    .map((place) => {
      const venue = mapGooglePlaceToVenue(place, city, neighborhood, chip)
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
      subtitle: `${venue.neighborhood} · ${venue.category.replace('_', ' ')}`,
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
    console.error(error)
  }

  return searchFallbackVenues(trimmedQuery, input.city, input.neighborhood, input.chip)
}
