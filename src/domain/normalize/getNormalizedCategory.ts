import type { RawVenueInput } from '../types/rawPlace'
import type { VenueCategory } from '../types/venue'

export interface NormalizedCategoryResult {
  category: VenueCategory
  subcategory: string
}

function normalizeValue(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_]+/g, '-')
}

function firstMatch(values: string[], candidates: string[]): string | undefined {
  return values.find((value) => candidates.includes(value))
}

function firstSuffixMatch(values: string[], suffix: string): string | undefined {
  return values.find((value) => value.endsWith(suffix))
}

export function getNormalizedCategory(raw: RawVenueInput): NormalizedCategoryResult {
  if (raw.categoryHint) {
    return {
      category: raw.categoryHint,
      subcategory: raw.subcategoryHint ?? raw.categoryHint,
    }
  }

  const rawTypes = [
    ...(raw.rawType === 'place' ? raw.placeTypes ?? [] : raw.eventTypes ?? []),
    ...(raw.sourceTypes ?? []),
    ...(raw.tags ?? []),
  ].map(normalizeValue)

  const dessertType = firstMatch(rawTypes, ['dessert', 'bakery', 'ice-cream', 'gelato', 'pastry'])
  if (dessertType) {
    return { category: 'dessert', subcategory: dessertType }
  }

  const cafeType = firstMatch(rawTypes, [
    'cafe',
    'coffee',
    'coffee-shop',
    'tea-room',
    'tea-house',
    'espresso-bar',
  ])
  if (cafeType) {
    return { category: 'cafe', subcategory: cafeType }
  }

  const barType = firstMatch(rawTypes, [
    'bar',
    'cocktail-bar',
    'wine-bar',
    'lounge',
    'brewery',
    'winery',
    'pub',
    'beer-hall',
    'sports-bar',
  ])
  if (barType) {
    return { category: 'bar', subcategory: barType }
  }

  const musicType = firstMatch(rawTypes, ['live_music', 'music-venue', 'concert', 'performance', 'small-stage'])
  if (musicType) {
    return { category: 'live_music', subcategory: musicType }
  }

  const museumType = firstMatch(rawTypes, ['museum', 'gallery', 'exhibit'])
  if (museumType) {
    return { category: 'museum', subcategory: museumType }
  }

  const parkType = firstMatch(rawTypes, ['park', 'garden', 'trail', 'viewpoint', 'greenhouse'])
  if (parkType) {
    return { category: 'park', subcategory: parkType }
  }

  const activityType = firstMatch(rawTypes, [
    'activity',
    'arcade',
    'games',
    'board-games',
    'karaoke',
    'mini-golf',
    'studio',
    'guided',
    'photo-walk',
  ])
  if (activityType) {
    return { category: 'activity', subcategory: activityType }
  }

  const eventType = firstMatch(rawTypes, [
    'event',
    'market',
    'festival',
    'fair',
    'pop-up',
    'gallery-crawl',
    'observatory',
    'stargazing',
  ])
  if (eventType || raw.rawType === 'event') {
    return { category: 'event', subcategory: eventType ?? 'event' }
  }

  const restaurantType =
    firstMatch(rawTypes, ['restaurant', 'food', 'tapas', 'bistro', 'food-hall']) ??
    firstSuffixMatch(rawTypes, '-restaurant')
  return {
    category: 'restaurant',
    subcategory: restaurantType ?? 'restaurant',
  }
}
