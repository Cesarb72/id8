import type { LivePlaceKind } from './buildLiveQueryPlan'
import type { HoursPeriod } from '../types/hours'
import type { RawPlace } from '../types/rawPlace'
import type { VenueCategory } from '../types/venue'

export interface GooglePlaceRecord {
  id?: string
  displayName?: {
    text?: string
  }
  primaryType?: string
  types?: string[]
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

type GoogleHoursPeriod = {
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
}

interface MapLivePlaceContext {
  city: string
  neighborhood?: string
  requestedKind: LivePlaceKind
  queryLabel: string
  queryTerms: string[]
  rank: number
}

export type MapLivePlaceDropReason =
  | 'missing_name'
  | 'missing_place_id'
  | 'unsupported_category'

const ignoredTypes = new Set([
  'food',
  'establishment',
  'point-of-interest',
  'store',
  'tourist-attraction',
])

function normalizeValue(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_]+/g, '-')
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function mapHoursPeriods(
  periods: GoogleHoursPeriod[] | undefined,
): HoursPeriod[] | undefined {
  if (!periods || periods.length === 0) {
    return undefined
  }

  return periods
    .map((period) => ({
      open: period.open?.day === undefined || period.open.hour === undefined || period.open.minute === undefined
        ? undefined
        : {
            day: period.open.day,
            hour: period.open.hour,
            minute: period.open.minute,
          },
      close: period.close?.day === undefined || period.close.hour === undefined || period.close.minute === undefined
        ? undefined
        : {
            day: period.close.day,
            hour: period.close.hour,
            minute: period.close.minute,
          },
    }))
    .filter((period) => period.open || period.close)
}

function getNormalizedTypes(place: GooglePlaceRecord): string[] {
  return unique(
    [place.primaryType, ...(place.types ?? [])]
      .filter((value): value is string => Boolean(value))
      .map(normalizeValue)
      .filter((value) => !ignoredTypes.has(value)),
  )
}

function hasAny(values: string[], candidates: string[]): boolean {
  return candidates.some((candidate) => values.includes(candidate))
}

function resolveCategory(
  placeTypes: string[],
  requestedKind: LivePlaceKind,
): VenueCategory | undefined {
  if (hasAny(placeTypes, ['bar', 'cocktail-bar', 'wine-bar', 'pub', 'brewery', 'sports-bar'])) {
    return 'bar'
  }
  if (hasAny(placeTypes, ['cafe', 'coffee-shop', 'tea-house', 'espresso-bar'])) {
    return 'cafe'
  }
  if (
    hasAny(placeTypes, [
      'dessert-shop',
      'ice-cream-shop',
      'bakery',
      'pastry-shop',
      'chocolate-shop',
    ])
  ) {
    return 'dessert'
  }
  if (hasAny(placeTypes, ['museum', 'art-gallery', 'history-museum', 'science-museum'])) {
    return 'museum'
  }
  if (
    hasAny(placeTypes, [
      'park',
      'national-park',
      'dog-park',
      'garden',
      'botanical-garden',
      'hiking-area',
      'trailhead',
      'state-park',
    ])
  ) {
    return 'park'
  }
  if (
    hasAny(placeTypes, ['event-venue', 'concert-hall', 'amphitheater', 'performing-arts-theater'])
  ) {
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
  if (
    hasAny(placeTypes, ['restaurant', 'brunch-restaurant', 'fine-dining-restaurant']) ||
    placeTypes.some((type) => type.endsWith('-restaurant'))
  ) {
    return 'restaurant'
  }
  if (hasAny(placeTypes, ['fast-food-restaurant', 'meal-takeaway', 'meal-delivery'])) {
    return 'restaurant'
  }
  if (requestedKind === 'dessert') {
    return 'dessert'
  }
  if (requestedKind === 'museum') {
    return 'museum'
  }
  if (requestedKind === 'park') {
    return 'park'
  }
  if (requestedKind === 'activity') {
    return 'activity'
  }
  return requestedKind
}

function getAddressComponent(
  components: GooglePlaceRecord['addressComponents'],
  candidates: string[],
): string | undefined {
  return components?.find((component) =>
    component.types?.some((type) => candidates.includes(normalizeValue(type))),
  )?.longText
}

function inferNeighborhood(
  place: GooglePlaceRecord,
  fallback?: string,
): string | undefined {
  const fromComponents =
    getAddressComponent(place.addressComponents, ['neighborhood']) ??
    getAddressComponent(place.addressComponents, ['sublocality-level-1', 'sublocality']) ??
    getAddressComponent(place.addressComponents, ['postal-town'])

  if (fromComponents) {
    return fromComponents
  }

  const address = place.shortFormattedAddress ?? place.formattedAddress
  if (!address) {
    return fallback
  }

  const firstSegment = address.split(',')[0]?.trim()
  return firstSegment && firstSegment.length >= 3 ? firstSegment : fallback
}

function inferCity(place: GooglePlaceRecord, fallback: string): string {
  return (
    getAddressComponent(place.addressComponents, ['locality']) ??
    getAddressComponent(place.addressComponents, ['administrative-area-level-2']) ??
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

function inferSummaryKeywords(summary: string): string[] {
  const normalized = summary.toLowerCase()
  const matches: string[] = []
  const keywordMap: Array<[string, string]> = [
    ['patio', 'outdoor-seating'],
    ['rooftop', 'rooftop'],
    ['cocktail', 'cocktails'],
    ['wine', 'wine'],
    ['coffee', 'coffee'],
    ['espresso', 'espresso-bar'],
    ['tea', 'tea-house'],
    ['brunch', 'brunch'],
    ['dessert', 'dessert'],
    ['intimate', 'intimate'],
    ['cozy', 'cozy'],
    ['craft', 'craft'],
    ['local', 'local'],
    ['seasonal', 'seasonal'],
    ['chef', 'chef-led'],
    ['quiet', 'quiet'],
    ['lively', 'social'],
  ]

  for (const [needle, tag] of keywordMap) {
    if (normalized.includes(needle)) {
      matches.push(tag)
    }
  }

  return matches
}

function inferTags(
  placeTypes: string[],
  summary: string,
  requestedKind: LivePlaceKind,
  queryTerms: string[],
): string[] {
  const tags = new Set<string>(placeTypes)
  tags.add(requestedKind)
  for (const tag of inferSummaryKeywords(summary)) {
    tags.add(tag)
  }
  for (const tag of queryTerms) {
    tags.add(normalizeValue(tag))
  }
  return [...tags].slice(0, 10)
}

function inferIsChain(
  name: string,
  placeTypes: string[],
  ratingCount: number,
  tags: string[],
): boolean {
  if (hasAny(placeTypes, ['fast-food-restaurant', 'meal-takeaway', 'meal-delivery'])) {
    return true
  }
  if (/#\d+/.test(name)) {
    return true
  }
  const strongLocalSignal = tags.some((tag) =>
    ['local', 'artisan', 'chef-led', 'craft', 'seasonal', 'intimate'].includes(tag),
  )
  return ratingCount >= 1800 && !strongLocalSignal && name.trim().split(/\s+/).length <= 2
}

function inferDriveMinutes(
  context: MapLivePlaceContext,
  placeNeighborhood?: string,
): number {
  const rankPenalty = Math.min(context.rank, 5)
  const normalizedIntentNeighborhood = context.neighborhood
    ? normalizeValue(context.neighborhood)
    : undefined
  const normalizedPlaceNeighborhood = placeNeighborhood
    ? normalizeValue(placeNeighborhood)
    : undefined
  const sameNeighborhood =
    Boolean(normalizedIntentNeighborhood) &&
    Boolean(normalizedPlaceNeighborhood) &&
    normalizedIntentNeighborhood === normalizedPlaceNeighborhood
  let base = 11
  if (context.requestedKind === 'bar') {
    base = 10
  } else if (context.requestedKind === 'restaurant') {
    base = 12
  } else if (context.requestedKind === 'cafe') {
    base = 9
  } else if (context.requestedKind === 'dessert') {
    base = 9
  } else if (context.requestedKind === 'park') {
    base = 13
  } else if (context.requestedKind === 'museum') {
    base = 12
  } else if (context.requestedKind === 'activity') {
    base = 11
  }

  if (sameNeighborhood) {
    base -= 3
  }
  if (!placeNeighborhood) {
    base += 2
  }

  return Math.max(6, Math.min(22, base + rankPenalty * 2))
}

function buildShortDescription(category: VenueCategory, summary: string): string {
  if (summary) {
    return summary
  }
  if (category === 'bar') {
    return 'Live place result with bar-forward social energy.'
  }
  if (category === 'cafe') {
    return 'Live place result suited to a softer coffee or cafe stop.'
  }
  if (category === 'dessert') {
    return 'Live place result suited to a softer dessert or sweet stop.'
  }
  if (category === 'park') {
    return 'Live place result that can support a walkable reset moment.'
  }
  if (category === 'museum') {
    return 'Live place result with culturally distinct discovery utility.'
  }
  if (category === 'activity' || category === 'event') {
    return 'Live place result with activity or event momentum potential.'
  }
  return 'Live place result that fits the current dining slice.'
}

function buildNarrativeFlavor(category: VenueCategory, tags: string[]): string {
  if (category === 'bar') {
    return tags.includes('intimate')
      ? 'A live-discovered bar with enough signal to support a focused social moment.'
      : 'A live-discovered bar that can supplement the current route without overpowering it.'
  }
  if (category === 'cafe') {
    return 'A live-discovered cafe that reads as a plausible opening or wind-down move.'
  }
  if (category === 'dessert') {
    return 'A live-discovered dessert lane that can land a route with softer pacing.'
  }
  if (category === 'park') {
    return 'A live-discovered park lane that improves reset and movement flow in sequence.'
  }
  if (category === 'museum') {
    return 'A live-discovered cultural venue with discovery-forward district value.'
  }
  if (category === 'activity' || category === 'event') {
    return 'A live-discovered activity lane that can add momentum without dominating the route.'
  }
  return 'A live-discovered restaurant with enough structured signal to enter the route pool safely.'
}

function inferSourceConfidence(
  place: GooglePlaceRecord,
  tags: string[],
  neighborhood?: string,
  requestedKind?: LivePlaceKind,
): number {
  const summaryPresent = Boolean(place.editorialSummary?.text)
  const rating = place.rating ?? 0
  const ratingCount = place.userRatingCount ?? 0
  const ratingCountScore = Math.min(ratingCount / 650, 1)
  const neighborhoodScore = neighborhood ? 0.08 : 0
  const summaryScore = summaryPresent ? 0.12 : 0
  const typeScore = Math.min(tags.length / 10, 1) * 0.14
  const websiteScore = place.websiteUri ? 0.05 : 0
  const hoursScore =
    (place.currentOpeningHours?.weekdayDescriptions?.length ?? 0) > 0 ||
    (place.regularOpeningHours?.weekdayDescriptions?.length ?? 0) > 0
      ? 0.05
      : 0
  const kindAlignmentScore =
    requestedKind && tags.includes(requestedKind)
      ? 0.03
      : 0

  return Number(
    Math.max(
      0.48,
      Math.min(
        0.94,
        0.5 +
          rating / 10 +
          ratingCountScore * 0.18 +
          neighborhoodScore +
          summaryScore +
          typeScore +
          websiteScore +
          hoursScore +
          kindAlignmentScore,
      ),
    ).toFixed(2),
  )
}

export function mapLivePlaceToRawPlaceWithDiagnostics(
  place: GooglePlaceRecord,
  context: MapLivePlaceContext,
): { rawPlace?: RawPlace; dropReason?: MapLivePlaceDropReason } {
  const name = place.displayName?.text?.trim()
  const placeId = place.id?.trim()
  if (!name) {
    return { dropReason: 'missing_name' }
  }
  if (!placeId) {
    return { dropReason: 'missing_place_id' }
  }

  const placeTypes = getNormalizedTypes(place)
  const category = resolveCategory(placeTypes, context.requestedKind)
  if (!category) {
    return { dropReason: 'unsupported_category' }
  }

  const summary = place.editorialSummary?.text?.trim() ?? ''
  const neighborhood = inferNeighborhood(place, context.neighborhood)
  const city = inferCity(place, context.city)
  const tags = inferTags(placeTypes, summary, context.requestedKind, context.queryTerms)
  const ratingCount = place.userRatingCount ?? 0
  const isChain = inferIsChain(name, placeTypes, ratingCount, tags)
  const sourceConfidence = inferSourceConfidence(place, tags, neighborhood, context.requestedKind)

  return {
    rawPlace: {
      rawType: 'place',
      id: `live_google_${placeId}`,
      name,
      city,
      neighborhood: neighborhood ?? context.city,
      driveMinutes: inferDriveMinutes(context, neighborhood),
      priceTier: mapPriceTier(place.priceLevel),
      tags,
      shortDescription: buildShortDescription(category, summary),
      narrativeFlavor: buildNarrativeFlavor(category, tags),
      imageUrl: '',
      categoryHint: category,
      subcategoryHint: placeTypes[0] ?? context.requestedKind,
      placeTypes,
      sourceTypes: placeTypes,
      normalizedFromRawType: 'raw-place',
      sourceOrigin: 'live',
      provider: 'google-places',
      providerRecordId: placeId,
      sourceQueryLabel: context.queryLabel,
      queryTerms: context.queryTerms,
      sourceConfidence,
      isChain,
      formattedAddress: place.formattedAddress,
      rating: place.rating,
      ratingCount,
      openNow: place.currentOpeningHours?.openNow,
      businessStatus: place.businessStatus,
      hoursPeriods:
        mapHoursPeriods(place.currentOpeningHours?.periods) ??
        mapHoursPeriods(place.regularOpeningHours?.periods),
      currentOpeningHoursText: place.currentOpeningHours?.weekdayDescriptions,
      regularOpeningHoursText: place.regularOpeningHours?.weekdayDescriptions,
      utcOffsetMinutes: place.utcOffsetMinutes,
      latitude: place.location?.latitude,
      longitude: place.location?.longitude,
    },
  }
}

export function mapLivePlaceToRawPlace(
  place: GooglePlaceRecord,
  context: MapLivePlaceContext,
): RawPlace | undefined {
  return mapLivePlaceToRawPlaceWithDiagnostics(place, context).rawPlace
}
