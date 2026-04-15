import { curatedMoments } from '../../data/moments'
import { normalizeVenue } from '../normalize/normalizeVenue'
import type { Moment, MomentTimeWindow, MomentType } from '../types/moment'
import type { IntentProfile } from '../types/intent'
import type { Venue, VenueCategory } from '../types/venue'

interface MomentVenueRecord {
  moment: Moment
  venue: Venue
}

const MOMENT_TYPE_BASE_CATEGORY: Record<MomentType, VenueCategory> = {
  live_performance: 'live_music',
  social_ritual: 'activity',
  tasting: 'restaurant',
  cultural_activation: 'museum',
  seasonal_activation: 'event',
  scenic_moment: 'park',
}

const MOMENT_TYPE_ROLE_AFFINITY: Record<
  MomentType,
  { warmup: number; peak: number; wildcard: number; cooldown: number }
> = {
  live_performance: { warmup: 0.34, peak: 0.92, wildcard: 0.86, cooldown: 0.28 },
  social_ritual: { warmup: 0.7, peak: 0.66, wildcard: 0.79, cooldown: 0.46 },
  tasting: { warmup: 0.62, peak: 0.88, wildcard: 0.54, cooldown: 0.7 },
  cultural_activation: { warmup: 0.58, peak: 0.83, wildcard: 0.74, cooldown: 0.44 },
  seasonal_activation: { warmup: 0.54, peak: 0.86, wildcard: 0.81, cooldown: 0.36 },
  scenic_moment: { warmup: 0.74, peak: 0.78, wildcard: 0.4, cooldown: 0.9 },
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function normalizeForMatch(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function getIntentTimeWindow(intent: IntentProfile): MomentTimeWindow | undefined {
  const value = normalizeForMatch(intent.timeWindow)
  if (!value) {
    return undefined
  }
  if (
    value.includes('late') ||
    value.includes('night') ||
    value.includes('after') ||
    value.includes('midnight')
  ) {
    return 'late'
  }
  if (
    value.includes('day') ||
    value.includes('morning') ||
    value.includes('afternoon') ||
    value.includes('brunch')
  ) {
    return 'day'
  }
  if (
    value.includes('evening') ||
    value.includes('dinner') ||
    value.includes('sunset') ||
    value.includes('tonight')
  ) {
    return 'evening'
  }
  return undefined
}

function computeTimeWindowFit(
  momentWindow: MomentTimeWindow,
  intentWindow: MomentTimeWindow | undefined,
): number {
  if (!intentWindow) {
    return momentWindow === 'flexible' ? 0.8 : 0.62
  }
  if (momentWindow === 'flexible') {
    return 0.9
  }
  if (momentWindow === intentWindow) {
    return 1
  }
  if (
    (momentWindow === 'evening' && intentWindow === 'late') ||
    (momentWindow === 'late' && intentWindow === 'evening')
  ) {
    return 0.72
  }
  return 0.45
}

function getDistrictDriveFallback(
  district: string | undefined,
  venues: Venue[],
): { neighborhood: string; driveMinutes: number; category: VenueCategory } {
  const fallback = {
    neighborhood: district?.trim() || 'Downtown',
    driveMinutes: 12,
    category: 'event' as VenueCategory,
  }
  if (!district) {
    return fallback
  }

  const districtKey = normalizeForMatch(district)
  const matches = venues.filter(
    (venue) =>
      normalizeForMatch(venue.neighborhood) === districtKey ||
      normalizeForMatch(venue.neighborhood).includes(districtKey) ||
      districtKey.includes(normalizeForMatch(venue.neighborhood)),
  )
  if (matches.length === 0) {
    return fallback
  }

  const driveMinutes = Math.round(
    matches.reduce((sum, venue) => sum + venue.driveMinutes, 0) / matches.length,
  )
  return {
    neighborhood: matches[0].neighborhood,
    driveMinutes,
    category: matches[0].category,
  }
}

function toMomentVenue(moment: Moment, venuePool: Venue[]): Venue | undefined {
  const parent = moment.parentPlaceId
    ? venuePool.find((venue) => venue.id === moment.parentPlaceId)
    : undefined
  const districtFallback = getDistrictDriveFallback(moment.district, venuePool)
  const baseCategory =
    parent?.category ?? MOMENT_TYPE_BASE_CATEGORY[moment.momentType] ?? districtFallback.category
  const baseRoleAffinity = MOMENT_TYPE_ROLE_AFFINITY[moment.momentType]
  const energyLevel = Math.max(1, Math.min(5, Math.round(moment.energy * 5)))
  const socialDensity = clamp01(
    moment.momentType === 'social_ritual' || moment.momentType === 'seasonal_activation'
      ? 0.58 + moment.energy * 0.36
      : 0.34 + moment.energy * 0.32,
  )
  const roleAffinity = {
    warmup: clamp01(
      baseRoleAffinity.warmup +
        (moment.timeWindow === 'day' ? 0.08 : 0) +
        (moment.timeWindow === 'late' ? -0.06 : 0),
    ),
    peak: clamp01(
      baseRoleAffinity.peak +
        moment.uniquenessScore * 0.08 +
        moment.romanticPotential * 0.05,
    ),
    wildcard: clamp01(
      baseRoleAffinity.wildcard +
        (moment.momentType === 'seasonal_activation' ? 0.05 : 0) +
        (moment.uniquenessScore - 0.6) * 0.06,
    ),
    cooldown: clamp01(
      baseRoleAffinity.cooldown +
        moment.romanticPotential * 0.08 +
        (moment.timeWindow === 'late' ? 0.05 : 0),
    ),
  }

  return normalizeVenue({
    rawType: 'place',
    id: `moment-${moment.id}`,
    name: moment.title,
    city: parent?.city ?? 'San Jose',
    neighborhood: parent?.neighborhood ?? districtFallback.neighborhood,
    driveMinutes: parent?.driveMinutes ?? districtFallback.driveMinutes,
    priceTier: parent?.priceTier ?? '$$',
    tags: [
      'moment-node',
      moment.momentType,
      `window-${moment.timeWindow}`,
      ...(parent?.tags.slice(0, 2) ?? []),
    ],
    shortDescription: `${moment.title} gives the route a why-now pulse in ${moment.timeWindow} hours.`,
    narrativeFlavor: `Curated ${moment.momentType.replace(/_/g, ' ')} moment with high-now relevance.`,
    imageUrl: parent?.imageUrl,
    isActive: true,
    categoryHint: baseCategory,
    subcategoryHint: moment.momentType,
    sourceTypes: ['moment', moment.momentType, moment.sourceType],
    normalizedFromRawType: 'seed',
    sourceOrigin: 'curated',
    sourceConfidence: moment.sourceType === 'curated' ? 0.95 : 0.82,
    useCases: parent?.useCases,
    vibeTags: parent?.vibeTags,
    energyLevel,
    socialDensity,
    uniquenessScore: moment.uniquenessScore,
    distinctivenessScore: clamp01(moment.uniquenessScore + 0.06),
    underexposureScore: clamp01(moment.uniquenessScore + (moment.sourceType === 'curated' ? 0.04 : -0.04)),
    shareabilityScore: clamp01(0.52 + moment.uniquenessScore * 0.38),
    isHiddenGem: moment.uniquenessScore >= 0.75,
    isChain: false,
    roleAffinity,
    localSignals: parent?.localSignals,
    familyFriendly: parent?.settings.familyFriendly,
    adultSocial: parent?.settings.adultSocial,
    dateFriendly: moment.romanticPotential >= 0.6 || parent?.settings.dateFriendly,
    eventCapable: true,
    performanceCapable:
      moment.momentType === 'live_performance' || moment.momentType === 'cultural_activation',
    musicCapable: moment.momentType === 'live_performance' || parent?.settings.musicCapable,
  })
}

interface MomentSelectionParams {
  intent: IntentProfile
  venuePool: Venue[]
}

function selectMomentsForIntent(params: MomentSelectionParams): Moment[] {
  const intentWindow = getIntentTimeWindow(params.intent)
  const venueById = new Map(params.venuePool.map((venue) => [venue.id, venue] as const))
  const neighborhoodKey = normalizeForMatch(params.intent.neighborhood)
  const distanceCap = params.intent.distanceMode === 'nearby' ? 12 : 16
  const perTypeCap = params.intent.distanceMode === 'nearby' ? 3 : 4

  const ranked = curatedMoments
    .map((moment) => {
      const parent = moment.parentPlaceId ? venueById.get(moment.parentPlaceId) : undefined
      const neighborhoodMatch =
        neighborhoodKey.length > 0 &&
        (normalizeForMatch(moment.district) === neighborhoodKey ||
          normalizeForMatch(parent?.neighborhood) === neighborhoodKey)
      const driveMinutes = parent?.driveMinutes ?? getDistrictDriveFallback(moment.district, params.venuePool).driveMinutes
      const timeWindowFit = computeTimeWindowFit(moment.timeWindow, intentWindow)
      const distanceFit =
        params.intent.distanceMode === 'nearby'
          ? driveMinutes <= distanceCap
            ? 1
            : driveMinutes <= 18
              ? 0.72
              : 0.4
          : driveMinutes <= 22
            ? 0.9
            : 0.62

      const score =
        timeWindowFit * 0.34 +
        distanceFit * 0.24 +
        moment.uniquenessScore * 0.22 +
        moment.energy * 0.08 +
        (neighborhoodMatch ? 0.18 : 0) +
        (params.intent.persona === 'romantic' ? moment.romanticPotential * 0.14 : 0) +
        (moment.sourceType === 'curated' ? 0.04 : 0)

      return {
        moment,
        score,
      }
    })
    .sort((left, right) => right.score - left.score)

  const selected: Moment[] = []
  const countsByType = new Map<MomentType, number>()
  const maxCount = params.intent.distanceMode === 'nearby' ? 10 : 14

  for (const item of ranked) {
    if (selected.length >= maxCount) {
      break
    }
    const currentTypeCount = countsByType.get(item.moment.momentType) ?? 0
    if (currentTypeCount >= perTypeCap) {
      continue
    }
    selected.push(item.moment)
    countsByType.set(item.moment.momentType, currentTypeCount + 1)
  }

  return selected
}

export function deriveMomentVenueRecords(params: MomentSelectionParams): MomentVenueRecord[] {
  if (normalizeForMatch(params.intent.city) !== 'san jose') {
    return []
  }

  return selectMomentsForIntent(params)
    .map((moment) => {
      const venue = toMomentVenue(moment, params.venuePool)
      return venue
        ? {
            moment,
            venue,
          }
        : undefined
    })
    .filter((record): record is MomentVenueRecord => Boolean(record))
}
