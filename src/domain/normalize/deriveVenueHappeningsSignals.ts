import type { VenueHappeningsSignals } from '../types/normalization'
import type { Venue } from '../types/venue'

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function toFixed01(value: number): number {
  return Number(clamp01(value).toFixed(3))
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase()
}

function collectNormalizedTokens(venue: Venue): Set<string> {
  const summary = `${venue.shortDescription} ${venue.narrativeFlavor} ${venue.subcategory}`
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
  return new Set(
    [...venue.tags, ...venue.vibeTags, ...venue.source.sourceTypes, ...summary.split(/\s+/)]
      .map(normalizeToken)
      .filter(Boolean),
  )
}

function hasAnyToken(tokens: Set<string>, candidates: string[]): boolean {
  return candidates.some((candidate) => tokens.has(candidate))
}

function getCategoryBase(
  venue: Venue,
  values: Partial<Record<Venue['category'], number>>,
  fallback: number,
): number {
  return values[venue.category] ?? fallback
}

export function deriveVenueHappeningsSignals(venue: Venue): VenueHappeningsSignals {
  const tokens = collectNormalizedTokens(venue)
  const eventLikeSignal =
    (venue.settings.eventCapable ? 0.14 : 0) +
    (venue.settings.performanceCapable ? 0.12 : 0) +
    (venue.settings.musicCapable ? 0.1 : 0)
  const currentOpenSignal = venue.source.openNow
    ? 0.12
    : venue.source.likelyOpenForCurrentWindow
      ? 0.08
      : 0
  const highQualitySignal =
    venue.signature.signatureScore * 0.08 +
    venue.source.qualityScore * 0.06 +
    venue.source.sourceConfidence * 0.05

  const hotspotStrength = toFixed01(
    getCategoryBase(
      venue,
      {
        bar: 0.68,
        live_music: 0.72,
        event: 0.66,
        restaurant: 0.56,
        activity: 0.54,
        museum: 0.46,
        cafe: 0.42,
        park: 0.34,
        dessert: 0.36,
      },
      0.45,
    ) +
      venue.energyLevel / 5 * 0.14 +
      venue.socialDensity / 5 * 0.1 +
      venue.shareabilityScore * 0.08 +
      (hasAnyToken(tokens, ['nightlife', 'social', 'crowded', 'district', 'market']) ? 0.08 : 0) +
      highQualitySignal,
  )

  const eventPotential = toFixed01(
    getCategoryBase(
      venue,
      {
        event: 0.82,
        live_music: 0.72,
        activity: 0.5,
        museum: 0.42,
        bar: 0.38,
      },
      0.28,
    ) +
      eventLikeSignal +
      (hasAnyToken(tokens, [
        'event',
        'festival',
        'market',
        'community',
        'popup',
        'program',
        'lineup',
        'showcase',
      ])
        ? 0.1
        : 0) +
      currentOpenSignal * 0.45,
  )

  const performancePotential = toFixed01(
    getCategoryBase(
      venue,
      {
        live_music: 0.84,
        event: 0.64,
        museum: 0.46,
        activity: 0.44,
        bar: 0.34,
      },
      0.22,
    ) +
      (venue.settings.performanceCapable ? 0.14 : 0) +
      (venue.settings.musicCapable ? 0.14 : 0) +
      (hasAnyToken(tokens, [
        'live',
        'music',
        'jazz',
        'concert',
        'performance',
        'theatre',
        'theater',
        'opera',
        'stage',
      ])
        ? 0.12
        : 0),
  )

  const liveNightlifePotential = toFixed01(
    getCategoryBase(
      venue,
      {
        bar: 0.84,
        live_music: 0.78,
        event: 0.58,
        restaurant: 0.36,
        activity: 0.34,
      },
      0.2,
    ) +
      venue.energyLevel / 5 * 0.12 +
      venue.socialDensity / 5 * 0.08 +
      (hasAnyToken(tokens, [
        'late',
        'night',
        'nightcap',
        'cocktail',
        'speakeasy',
        'lounge',
        'after',
        'midnight',
      ])
        ? 0.14
        : 0) +
      currentOpenSignal,
  )

  const culturalAnchorPotential = toFixed01(
    getCategoryBase(
      venue,
      {
        museum: 0.82,
        event: 0.58,
        activity: 0.56,
        live_music: 0.5,
        park: 0.42,
        restaurant: 0.38,
        bar: 0.32,
      },
      0.28,
    ) +
      venue.distinctivenessScore * 0.14 +
      venue.uniquenessScore * 0.08 +
      (hasAnyToken(tokens, [
        'museum',
        'gallery',
        'cultural',
        'historic',
        'theatre',
        'theater',
        'opera',
        'heritage',
      ])
        ? 0.16
        : 0),
  )

  const lateNightPotential = toFixed01(
    getCategoryBase(
      venue,
      {
        bar: 0.74,
        live_music: 0.66,
        event: 0.58,
        restaurant: 0.38,
        dessert: 0.32,
      },
      0.24,
    ) +
      (hasAnyToken(tokens, [
        'late',
        'night',
        'nightcap',
        'after',
        'midnight',
        'open',
      ])
        ? 0.16
        : 0) +
      (venue.source.hoursPressureLevel === 'strong-open' ? 0.1 : 0) +
      (venue.source.hoursPressureLevel === 'likely-open' ? 0.05 : 0) +
      venue.source.timeConfidence * 0.06,
  )

  const currentRelevance = toFixed01(
    0.22 +
      (venue.source.openNow ? 0.28 : 0) +
      (venue.source.likelyOpenForCurrentWindow ? 0.16 : 0) +
      venue.source.timeConfidence * 0.18 +
      eventPotential * 0.08 +
      performancePotential * 0.08 +
      (venue.source.businessStatus === 'operational' ? 0.08 : 0),
  )

  const hiddenGemStrength = toFixed01(
    (venue.isHiddenGem ? 0.48 : 0.16) +
      venue.underexposureScore * 0.22 +
      venue.distinctivenessScore * 0.14 +
      venue.localSignals.localFavoriteScore * 0.1,
  )

  const majorVenueStrength = toFixed01(
    getCategoryBase(
      venue,
      {
        museum: 0.46,
        event: 0.44,
        live_music: 0.4,
      },
      0.22,
    ) +
      venue.signature.signatureScore * 0.16 +
      venue.distinctivenessScore * 0.1 +
      (hasAnyToken(tokens, [
        'arena',
        'stadium',
        'theatre',
        'theater',
        'opera',
        'museum',
        'center',
        'centre',
        'hall',
        'district',
      ])
        ? 0.16
        : 0),
  )

  return {
    hotspotStrength,
    eventPotential,
    performancePotential,
    liveNightlifePotential,
    culturalAnchorPotential,
    lateNightPotential,
    currentRelevance,
    hiddenGemStrength,
    majorVenueStrength,
  }
}
