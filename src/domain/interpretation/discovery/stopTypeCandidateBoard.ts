import { getRoleContract } from '../../contracts/getRoleContract'
import { getCrewPolicy } from '../../intent/getCrewPolicy'
import { buildExperienceLens } from '../../intent/buildExperienceLens'
import { normalizeIntent } from '../../intent/normalizeIntent'
import { retrieveVenues } from '../../retrieval/retrieveVenues'
import { scoreVenueCollection } from '../../retrieval/scoreVenueFit'
import type { ScoredVenue } from '../../types/arc'
import type { BudgetPreference, DistanceMode, PersonaMode, VibeAnchor } from '../../types/intent'
import type { SourceMode } from '../../types/sourceMode'
import type { Venue, VenueCategory } from '../../types/venue'

export type ScenarioFamily =
  | 'romantic_cozy'
  | 'romantic_lively'
  | 'romantic_cultured'
  | 'friends_cozy'
  | 'friends_lively'
  | 'friends_cultured'
  | 'family_cozy'
  | 'family_lively'
  | 'family_cultured'

export type StopType =
  | 'neighborhood_walk'
  | 'casual_daytime_food'
  | 'atmospheric_experience'
  | 'intimate_dinner'
  | 'nightcap'
  | 'aperitivo'
  | 'energetic_dinner'
  | 'performance_anchor'
  | 'cocktail_bar'
  | 'late_night_food'
  | 'cultural_institution'
  | 'atmospheric_detour'
  | 'thoughtful_wine_or_lunch'
  | 'performance_or_fine_dining'
  | 'atmospheric_nightcap'
  | 'casual_group_food'
  | 'low_key_experience'
  | 'neighborhood_dive_or_pub'
  | 'group_gathering_point'
  | 'group_activity_anchor'
  | 'late_energy_venue'
  | 'wine_or_craft_debrief'
  | 'group_dinner'
  | 'cultured_closer'
  | 'family_wander'
  | 'family_lunch'
  | 'gentle_experience'
  | 'easy_dinner'
  | 'high_energy_anchor'
  | 'outdoor_reset'
  | 'casual_group_lunch'
  | 'afternoon_neighborhood_or_cultural'
  | 'primary_cultural_institution'
  | 'debrief_stop'
  | 'secondary_cultural_stop'
  | 'thematic_lunch'
  | 'adult_payoff_dinner'

export type StopTypeCandidate = {
  venueId: string
  name: string
  city?: string
  address?: string
  district?: string
  neighborhoodLabel?: string
  stopType: StopType
  venueCategory?: VenueCategory
  venueSubcategory?: string
  shortDescription?: string
  sourceTypes?: string[]
  venueTags?: string[]
  sourceType?: 'venue' | 'event' | 'hybrid'
  hoursKnown?: boolean
  openNow?: boolean
  authorityScore: number
  hiddenGemScore: number
  currentRelevance: number
  eventPotential?: number
  performancePotential?: number
  liveNightlifePotential?: number
  culturalAnchorPotential?: number
  lateNightPotential?: number
  majorVenueStrength?: number
  roleFit: {
    start?: number
    highlight?: number
    windDown?: number
  }
  reasons: string[]
}

export type StopTypeCandidateBoard = {
  city: string
  persona: string
  vibe: string
  scenarioFamily: ScenarioFamily
  requiredStopTypes: StopType[]
  candidatesByStopType: Record<StopType, StopTypeCandidate[]>
}

type BuildStopTypeCandidateBoardInput = {
  city: string
  persona: string
  vibe: string
  scoredVenues: ScoredVenue[]
}

type BuildStopTypeCandidateBoardFromIntentInput = {
  city: string
  persona: PersonaMode | string
  vibe: VibeAnchor | string
  distanceMode?: DistanceMode
  budget?: BudgetPreference
  sourceMode?: SourceMode
}

type StopTypeFitResult = {
  fit: number
  reasons: string[]
}

type VenueSignals = {
  authorityScore: number
  hiddenGemScore: number
  currentRelevance: number
  eventPotential: number
  performancePotential: number
  liveNightlifePotential: number
  culturalAnchorPotential: number
  lateNightPotential: number
  majorVenueStrength: number
  roleFit: {
    start: number
    highlight: number
    windDown: number
  }
}

const STOP_TYPES_BY_SCENARIO_FAMILY: Record<ScenarioFamily, StopType[]> = {
  romantic_cozy: [
    'neighborhood_walk',
    'casual_daytime_food',
    'atmospheric_experience',
    'intimate_dinner',
    'nightcap',
  ],
  romantic_lively: [
    'aperitivo',
    'energetic_dinner',
    'performance_anchor',
    'cocktail_bar',
    'late_night_food',
  ],
  romantic_cultured: [
    'cultural_institution',
    'atmospheric_detour',
    'thoughtful_wine_or_lunch',
    'performance_or_fine_dining',
    'atmospheric_nightcap',
  ],
  friends_cozy: [
    'neighborhood_walk',
    'casual_group_food',
    'low_key_experience',
    'neighborhood_dive_or_pub',
  ],
  friends_lively: [
    'group_gathering_point',
    'group_activity_anchor',
    'cocktail_bar',
    'late_energy_venue',
    'late_night_food',
  ],
  friends_cultured: [
    'cultural_institution',
    'atmospheric_detour',
    'wine_or_craft_debrief',
    'group_dinner',
    'cultured_closer',
  ],
  family_cozy: [
    'family_wander',
    'family_lunch',
    'gentle_experience',
    'easy_dinner',
  ],
  family_lively: [
    'high_energy_anchor',
    'outdoor_reset',
    'casual_group_lunch',
    'afternoon_neighborhood_or_cultural',
  ],
  family_cultured: [
    'primary_cultural_institution',
    'debrief_stop',
    'secondary_cultural_stop',
    'thematic_lunch',
    'adult_payoff_dinner',
  ],
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeCity(value: string): string {
  const normalized = normalizeToken(value).replace(/\./g, '')
  const [head] = normalized.split(',')
  return (head ?? normalized).trim()
}

function parsePersona(value: string): PersonaMode | null {
  const normalized = normalizeToken(value)
  if (normalized.includes('romantic')) {
    return 'romantic'
  }
  if (normalized.includes('friend')) {
    return 'friends'
  }
  if (normalized.includes('family')) {
    return 'family'
  }
  return null
}

function parseVibe(value: string): VibeAnchor | null {
  const normalized = normalizeToken(value)
  const supported: VibeAnchor[] = [
    'cozy',
    'lively',
    'cultured',
    'chill',
    'playful',
    'adventurous-outdoor',
    'adventurous-urban',
  ]
  return supported.find((vibe) => normalized === vibe || normalized.includes(vibe)) ?? null
}

export function resolveScenarioFamily(input: {
  city: string
  persona: string
  vibe: string
}): ScenarioFamily | null {
  const city = normalizeCity(input.city)
  const persona = parsePersona(input.persona)
  const vibe = parseVibe(input.vibe)
  if (city !== 'san jose' || !persona || !vibe) {
    return null
  }

  const vibeBucket =
    vibe === 'cozy' || vibe === 'chill'
      ? 'cozy'
      : vibe === 'lively' || vibe === 'playful'
        ? 'lively'
        : vibe === 'cultured' || vibe === 'adventurous-outdoor' || vibe === 'adventurous-urban'
          ? 'cultured'
          : null
  if (!vibeBucket) {
    return null
  }
  if (persona === 'romantic') {
    return `romantic_${vibeBucket}`
  }
  if (persona === 'friends') {
    return `friends_${vibeBucket}`
  }
  if (persona === 'family') {
    return `family_${vibeBucket}`
  }
  return null
}

export function getScenarioRequiredStopTypes(scenarioFamily: ScenarioFamily): StopType[] {
  return [...STOP_TYPES_BY_SCENARIO_FAMILY[scenarioFamily]]
}

function uniqueLowerTokens(venue: Venue): Set<string> {
  const seed = [
    venue.name,
    venue.subcategory,
    venue.shortDescription,
    venue.narrativeFlavor,
    venue.category,
    venue.neighborhood,
    ...venue.tags,
    ...venue.vibeTags,
    ...venue.source.sourceTypes,
  ]
    .filter(Boolean)
    .join(' ')
  return new Set(
    normalizeToken(seed)
      .split(' ')
      .map((token) => token.trim())
      .filter(Boolean),
  )
}

function hasAnyToken(tokens: Set<string>, values: string[]): boolean {
  return values.some((value) => tokens.has(normalizeToken(value)))
}

function hasAnyPhrase(value: string, phrases: string[]): boolean {
  const normalized = normalizeToken(value)
  return phrases.some((phrase) => normalized.includes(normalizeToken(phrase)))
}

function toSourceType(scoredVenue: ScoredVenue): 'venue' | 'event' | 'hybrid' {
  if (scoredVenue.candidateIdentity.kind === 'moment') {
    if (scoredVenue.candidateIdentity.momentSourceType === 'event') {
      return 'event'
    }
    if (scoredVenue.candidateIdentity.momentSourceType === 'hybrid') {
      return 'hybrid'
    }
  }
  return scoredVenue.venue.source.sourceOrigin === 'live' ? 'hybrid' : 'venue'
}

function getVenueSignals(scoredVenue: ScoredVenue): VenueSignals {
  const happenings = scoredVenue.venue.source.happenings
  const roleStart = clamp01(scoredVenue.roleScores.warmup)
  const roleHighlight = clamp01(scoredVenue.roleScores.peak)
  const roleWindDown = clamp01(scoredVenue.roleScores.cooldown)
  const authorityScore = clamp01(
    scoredVenue.fitScore * 0.34 +
      scoredVenue.taste.signals.anchorStrength * 0.2 +
      scoredVenue.vibeAuthority.overall * 0.16 +
      roleHighlight * 0.14 +
      scoredVenue.venue.source.qualityScore * 0.16,
  )
  return {
    authorityScore,
    hiddenGemScore: clamp01(
      scoredVenue.hiddenGemScore * 0.55 +
        scoredVenue.venue.underexposureScore * 0.2 +
        (happenings?.hiddenGemStrength ?? 0) * 0.25,
    ),
    currentRelevance: clamp01(happenings?.currentRelevance ?? 0),
    eventPotential: clamp01(happenings?.eventPotential ?? 0),
    performancePotential: clamp01(happenings?.performancePotential ?? 0),
    liveNightlifePotential: clamp01(happenings?.liveNightlifePotential ?? 0),
    culturalAnchorPotential: clamp01(happenings?.culturalAnchorPotential ?? 0),
    lateNightPotential: clamp01(happenings?.lateNightPotential ?? 0),
    majorVenueStrength: clamp01(happenings?.majorVenueStrength ?? 0),
    roleFit: {
      start: roleStart,
      highlight: roleHighlight,
      windDown: roleWindDown,
    },
  }
}

function getFamilyAlignment(
  scenarioFamily: ScenarioFamily,
  venueSignals: VenueSignals,
  scoredVenue: ScoredVenue,
): number {
  const socialConversation =
    scoredVenue.taste.signals.socialSignals?.conversationFriendliness ?? 0
  const socialActivity = scoredVenue.taste.signals.socialSignals?.activityScore ?? 0
  if (scenarioFamily === 'romantic_cozy') {
    return clamp01(
      venueSignals.hiddenGemScore * 0.28 +
        scoredVenue.taste.signals.romanticSignals.intimacy * 0.2 +
        scoredVenue.taste.signals.romanticSignals.ambiance * 0.18 +
        venueSignals.roleFit.windDown * 0.16 +
        venueSignals.currentRelevance * 0.08 +
        venueSignals.authorityScore * 0.1,
    )
  }
  if (scenarioFamily === 'romantic_lively') {
    return clamp01(
      venueSignals.liveNightlifePotential * 0.28 +
        venueSignals.eventPotential * 0.18 +
        venueSignals.performancePotential * 0.16 +
        venueSignals.lateNightPotential * 0.14 +
        venueSignals.roleFit.highlight * 0.14 +
        venueSignals.currentRelevance * 0.1,
    )
  }
  if (scenarioFamily === 'romantic_cultured') {
    return clamp01(
      venueSignals.culturalAnchorPotential * 0.32 +
        venueSignals.performancePotential * 0.14 +
        scoredVenue.taste.signals.momentEnrichment.culturalDepth * 0.14 +
        venueSignals.hiddenGemScore * 0.1 +
        venueSignals.roleFit.highlight * 0.16 +
        venueSignals.currentRelevance * 0.14,
    )
  }
  if (scenarioFamily === 'friends_cozy') {
    return clamp01(
      venueSignals.roleFit.start * 0.2 +
        venueSignals.roleFit.windDown * 0.24 +
        socialConversation * 0.24 +
        venueSignals.hiddenGemScore * 0.14 +
        venueSignals.authorityScore * 0.1 +
        (1 - scoredVenue.venue.energyLevel / 5) * 0.08,
    )
  }
  if (scenarioFamily === 'friends_lively') {
    return clamp01(
      venueSignals.liveNightlifePotential * 0.26 +
        venueSignals.eventPotential * 0.18 +
        venueSignals.performancePotential * 0.16 +
        venueSignals.currentRelevance * 0.14 +
        venueSignals.roleFit.highlight * 0.14 +
        socialActivity * 0.12,
    )
  }
  if (scenarioFamily === 'friends_cultured') {
    return clamp01(
      venueSignals.culturalAnchorPotential * 0.24 +
        venueSignals.performancePotential * 0.14 +
        socialConversation * 0.18 +
        scoredVenue.taste.signals.momentEnrichment.culturalDepth * 0.16 +
        venueSignals.roleFit.highlight * 0.14 +
        venueSignals.authorityScore * 0.14,
    )
  }
  if (scenarioFamily === 'family_cozy') {
    return clamp01(
      venueSignals.roleFit.start * 0.22 +
        socialConversation * 0.16 +
        venueSignals.currentRelevance * 0.14 +
        venueSignals.authorityScore * 0.14 +
        (1 - scoredVenue.venue.energyLevel / 5) * 0.18 +
        venueSignals.culturalAnchorPotential * 0.16,
    )
  }
  if (scenarioFamily === 'family_lively') {
    return clamp01(
      venueSignals.eventPotential * 0.2 +
        venueSignals.performancePotential * 0.16 +
        venueSignals.currentRelevance * 0.16 +
        venueSignals.roleFit.highlight * 0.18 +
        socialActivity * 0.2 +
        venueSignals.authorityScore * 0.1,
    )
  }
  return clamp01(
    venueSignals.culturalAnchorPotential * 0.26 +
      venueSignals.performancePotential * 0.14 +
      scoredVenue.taste.signals.momentEnrichment.culturalDepth * 0.2 +
      venueSignals.currentRelevance * 0.12 +
      venueSignals.roleFit.highlight * 0.14 +
      socialConversation * 0.14,
  )
}

function getStopTypeFit(
  scoredVenue: ScoredVenue,
  stopType: StopType,
  scenarioFamily: ScenarioFamily,
): StopTypeFitResult {
  const venue = scoredVenue.venue
  const tokens = uniqueLowerTokens(venue)
  const signals = getVenueSignals(scoredVenue)
  const isRestaurantLike =
    venue.category === 'restaurant' || venue.category === 'cafe' || venue.category === 'dessert'
  const isPerformanceLike =
    venue.category === 'live_music' ||
    venue.settings.performanceCapable ||
    venue.settings.musicCapable ||
    signals.performancePotential >= 0.58
  const scenicLike = hasAnyToken(tokens, ['garden', 'walk', 'stroll', 'scenic', 'promenade', 'park'])
  const socialConversation =
    scoredVenue.taste.signals.socialSignals?.conversationFriendliness ?? 0
  const reasons: string[] = []
  let fit = 0

  switch (stopType) {
    case 'neighborhood_walk': {
      fit = clamp01(
        (venue.category === 'park' ? 0.34 : 0) +
          (venue.category === 'event' ? 0.12 : 0) +
          (scenicLike ? 0.28 : 0) +
          (hasAnyToken(tokens, ['market', 'walkable', 'neighborhood']) ? 0.14 : 0) +
          signals.roleFit.start * 0.06 +
          signals.roleFit.windDown * 0.06,
      )
      if (scenicLike) reasons.push('scenic or stroll-forward')
      if (hasAnyToken(tokens, ['market', 'walkable'])) reasons.push('walkable neighborhood flow')
      break
    }
    case 'casual_daytime_food': {
      fit = clamp01(
        (venue.category === 'cafe' ? 0.4 : 0) +
          (venue.category === 'dessert' ? 0.24 : 0) +
          (isRestaurantLike ? 0.12 : 0) +
          (hasAnyToken(tokens, ['coffee', 'tea', 'bakery', 'lunch', 'brunch']) ? 0.2 : 0) +
          (venue.energyLevel <= 3 ? 0.08 : 0),
      )
      if (hasAnyToken(tokens, ['coffee', 'tea', 'bakery'])) reasons.push('low-friction daytime food signal')
      if (venue.energyLevel <= 3) reasons.push('calmer daytime pacing')
      break
    }
    case 'atmospheric_experience': {
      fit = clamp01(
        (scenicLike ? 0.26 : 0) +
          (venue.category === 'park' ? 0.26 : 0) +
          (venue.category === 'museum' ? 0.16 : 0) +
          (signals.hiddenGemScore * 0.14) +
          (signals.culturalAnchorPotential * 0.1) +
          (hasAnyToken(tokens, ['atmospheric', 'discovery', 'reflective', 'garden']) ? 0.08 : 0),
      )
      if (venue.category === 'park' || scenicLike) reasons.push('atmospheric place character')
      if (signals.hiddenGemScore >= 0.58) reasons.push('hidden-gem discovery signal')
      break
    }
    case 'intimate_dinner': {
      fit = clamp01(
        (venue.category === 'restaurant' ? 0.34 : 0) +
          (venue.category === 'bar' ? 0.1 : 0) +
          (signals.roleFit.highlight * 0.2) +
          (hasAnyToken(tokens, ['intimate', 'romantic', 'conversation', 'wine', 'chef led', 'tasting']) ? 0.24 : 0) +
          (scoredVenue.taste.signals.romanticSignals.intimacy * 0.12),
      )
      if (venue.category === 'restaurant') reasons.push('dinner-capable anchor')
      if (hasAnyToken(tokens, ['intimate', 'romantic', 'conversation'])) reasons.push('intimate dinner tone')
      break
    }
    case 'nightcap': {
      fit = clamp01(
        (venue.category === 'bar' ? 0.36 : 0) +
          (venue.category === 'live_music' ? 0.14 : 0) +
          (signals.roleFit.windDown * 0.2) +
          (hasAnyToken(tokens, ['nightcap', 'jazz', 'cocktail', 'wine', 'lounge', 'quiet']) ? 0.2 : 0) +
          (signals.lateNightPotential * 0.1),
      )
      if (venue.category === 'bar') reasons.push('nightcap-ready bar profile')
      if (hasAnyToken(tokens, ['jazz', 'wine', 'lounge'])) reasons.push('soft landing atmosphere')
      break
    }
    case 'aperitivo': {
      fit = clamp01(
        (venue.category === 'bar' ? 0.28 : 0) +
          (venue.category === 'restaurant' ? 0.1 : 0) +
          (signals.roleFit.start * 0.2) +
          (hasAnyToken(tokens, ['happy', 'hour', 'aperitivo', 'small', 'plates', 'cocktail']) ? 0.26 : 0) +
          (signals.currentRelevance * 0.16),
      )
      if (hasAnyToken(tokens, ['happy', 'hour', 'aperitivo'])) reasons.push('early-evening energy setter')
      if (signals.roleFit.start >= 0.6) reasons.push('strong opener fit')
      break
    }
    case 'energetic_dinner': {
      fit = clamp01(
        (venue.category === 'restaurant' ? 0.26 : 0) +
          (venue.category === 'event' ? 0.08 : 0) +
          (signals.roleFit.highlight * 0.2) +
          (venue.energyLevel >= 3 ? 0.12 : 0) +
          (hasAnyToken(tokens, ['social', 'lively', 'buzz', 'energetic', 'chef']) ? 0.18 : 0) +
          (signals.liveNightlifePotential * 0.16),
      )
      if (venue.category === 'restaurant') reasons.push('highlight dinner structure')
      if (signals.liveNightlifePotential >= 0.55) reasons.push('lively handoff potential')
      break
    }
    case 'performance_anchor': {
      fit = clamp01(
        (isPerformanceLike ? 0.36 : 0) +
          (venue.category === 'event' ? 0.14 : 0) +
          (signals.performancePotential * 0.2) +
          (signals.majorVenueStrength * 0.16) +
          (signals.roleFit.highlight * 0.14),
      )
      if (isPerformanceLike) reasons.push('performance-capable anchor')
      if (signals.majorVenueStrength >= 0.55) reasons.push('major timed gravity')
      break
    }
    case 'cocktail_bar': {
      fit = clamp01(
        (venue.category === 'bar' ? 0.36 : 0) +
          (signals.liveNightlifePotential * 0.22) +
          (signals.roleFit.windDown * 0.16) +
          (hasAnyToken(tokens, ['cocktail', 'bar', 'lounge', 'night']) ? 0.2 : 0) +
          (signals.currentRelevance * 0.06),
      )
      if (venue.category === 'bar') reasons.push('cocktail-forward nightlife lane')
      if (signals.liveNightlifePotential >= 0.56) reasons.push('nightlife continuity signal')
      break
    }
    case 'late_night_food': {
      fit = clamp01(
        (isRestaurantLike ? 0.24 : 0) +
          (signals.lateNightPotential * 0.28) +
          (signals.currentRelevance * 0.16) +
          (hasAnyToken(tokens, ['late', 'night', 'post', 'food', 'ramen', 'dessert']) ? 0.2 : 0) +
          (signals.roleFit.windDown * 0.12),
      )
      if (signals.lateNightPotential >= 0.56) reasons.push('late-night food potential')
      if (isRestaurantLike) reasons.push('post-show food compatibility')
      break
    }
    case 'cultural_institution': {
      fit = clamp01(
        (venue.category === 'museum' ? 0.38 : 0) +
          (venue.category === 'activity' ? 0.12 : 0) +
          (signals.culturalAnchorPotential * 0.24) +
          (hasAnyToken(tokens, ['museum', 'gallery', 'historic', 'heritage', 'cultural']) ? 0.18 : 0) +
          (signals.roleFit.highlight * 0.08),
      )
      if (venue.category === 'museum') reasons.push('institutional cultural anchor')
      if (signals.culturalAnchorPotential >= 0.56) reasons.push('high cultural authority')
      break
    }
    case 'atmospheric_detour': {
      fit = clamp01(
        (scenicLike ? 0.3 : 0) +
          (venue.category === 'park' ? 0.2 : 0) +
          (signals.hiddenGemScore * 0.2) +
          (signals.roleFit.start * 0.08) +
          (signals.roleFit.windDown * 0.08) +
          (hasAnyToken(tokens, ['reflective', 'detour', 'stroll', 'discovery']) ? 0.14 : 0),
      )
      if (scenicLike) reasons.push('short atmospheric detour potential')
      if (signals.hiddenGemScore >= 0.58) reasons.push('detour-worthy hidden gem')
      break
    }
    case 'thoughtful_wine_or_lunch': {
      fit = clamp01(
        (venue.category === 'bar' ? 0.18 : 0) +
          (isRestaurantLike ? 0.18 : 0) +
          (hasAnyToken(tokens, ['wine', 'lunch', 'conversation', 'thoughtful', 'quiet']) ? 0.28 : 0) +
          (signals.roleFit.start * 0.12) +
          (signals.roleFit.windDown * 0.12) +
          (signals.authorityScore * 0.12),
      )
      if (hasAnyToken(tokens, ['wine', 'lunch'])) reasons.push('wine/lunch conversational fit')
      if (signals.roleFit.start >= 0.58 || signals.roleFit.windDown >= 0.58) reasons.push('supports thoughtful pacing')
      break
    }
    case 'performance_or_fine_dining': {
      const fineDiningSignal =
        venue.category === 'restaurant' &&
        (venue.priceTier === '$$$' || venue.priceTier === '$$$$') &&
        (hasAnyToken(tokens, ['tasting', 'chef', 'fine', 'romantic', 'signature']) ||
          hasAnyPhrase(venue.subcategory, ['fine dining', 'tasting']))
      fit = clamp01(
        (isPerformanceLike ? 0.28 : 0) +
          (fineDiningSignal ? 0.26 : 0) +
          (signals.roleFit.highlight * 0.18) +
          (signals.authorityScore * 0.14) +
          (signals.majorVenueStrength * 0.14),
      )
      if (isPerformanceLike) reasons.push('performance-led highlight option')
      if (fineDiningSignal) reasons.push('fine-dining gravity option')
      break
    }
    case 'atmospheric_nightcap': {
      fit = clamp01(
        (venue.category === 'bar' ? 0.24 : 0) +
          (venue.category === 'park' ? 0.14 : 0) +
          (signals.roleFit.windDown * 0.22) +
          (signals.hiddenGemScore * 0.14) +
          (hasAnyToken(tokens, ['atmospheric', 'nightcap', 'reflective', 'wine', 'jazz', 'lounge', 'quiet']) ? 0.2 : 0) +
          (signals.lateNightPotential * 0.06),
      )
      if (signals.roleFit.windDown >= 0.58) reasons.push('reflective close compatibility')
      if (hasAnyToken(tokens, ['wine', 'jazz', 'quiet', 'lounge'])) reasons.push('atmospheric landing tone')
      break
    }
    case 'casual_group_food': {
      fit = clamp01(
        (isRestaurantLike ? 0.3 : 0) +
          (venue.category === 'bar' ? 0.08 : 0) +
          (hasAnyToken(tokens, ['group', 'sharing', 'casual', 'pizza', 'taco', 'brewery']) ? 0.24 : 0) +
          (signals.roleFit.start * 0.14) +
          (signals.currentRelevance * 0.12) +
          (signals.authorityScore * 0.12),
      )
      if (isRestaurantLike) reasons.push('group-friendly food base')
      if (hasAnyToken(tokens, ['sharing', 'casual', 'group'])) reasons.push('casual group table signal')
      break
    }
    case 'low_key_experience': {
      fit = clamp01(
        (venue.category === 'activity' ? 0.2 : 0) +
          (venue.category === 'park' ? 0.2 : 0) +
          (signals.roleFit.windDown * 0.18) +
          (hasAnyToken(tokens, ['arcade', 'board', 'lounge', 'quiet', 'low key', 'hang']) ? 0.24 : 0) +
          ((signals.hiddenGemScore + signals.currentRelevance) * 0.09),
      )
      if (hasAnyToken(tokens, ['quiet', 'hang', 'lounge'])) reasons.push('low-key social reset')
      if (signals.roleFit.windDown >= 0.56) reasons.push('late-sequence comfort fit')
      break
    }
    case 'neighborhood_dive_or_pub': {
      fit = clamp01(
        (venue.category === 'bar' ? 0.34 : 0) +
          (signals.roleFit.windDown * 0.2) +
          (signals.liveNightlifePotential * 0.14) +
          (hasAnyToken(tokens, ['pub', 'dive', 'tap', 'local', 'tavern']) ? 0.24 : 0) +
          (signals.hiddenGemScore * 0.08),
      )
      if (venue.category === 'bar') reasons.push('pub/dive-ready lane')
      if (hasAnyToken(tokens, ['pub', 'dive', 'tavern'])) reasons.push('neighborhood pub signal')
      break
    }
    case 'group_gathering_point': {
      fit = clamp01(
        (venue.category === 'bar' ? 0.2 : 0) +
          (venue.category === 'restaurant' ? 0.14 : 0) +
          (venue.category === 'event' ? 0.14 : 0) +
          (signals.roleFit.start * 0.2) +
          (hasAnyToken(tokens, ['gather', 'meet', 'plaza', 'market', 'social']) ? 0.2 : 0) +
          (signals.currentRelevance * 0.12),
      )
      if (signals.roleFit.start >= 0.58) reasons.push('group launch fit')
      if (hasAnyToken(tokens, ['market', 'social', 'meet'])) reasons.push('gathering point signal')
      break
    }
    case 'group_activity_anchor': {
      fit = clamp01(
        (venue.category === 'activity' ? 0.28 : 0) +
          (venue.category === 'event' ? 0.2 : 0) +
          (isPerformanceLike ? 0.12 : 0) +
          (signals.roleFit.highlight * 0.18) +
          (signals.eventPotential * 0.12) +
          (hasAnyToken(tokens, ['game', 'activity', 'bowling', 'karaoke', 'live']) ? 0.1 : 0),
      )
      if (venue.category === 'activity' || venue.category === 'event') reasons.push('activity anchor capacity')
      if (signals.roleFit.highlight >= 0.56) reasons.push('centerpiece activity fit')
      break
    }
    case 'late_energy_venue': {
      fit = clamp01(
        (venue.category === 'bar' ? 0.24 : 0) +
          (venue.category === 'event' ? 0.14 : 0) +
          (signals.liveNightlifePotential * 0.2) +
          (signals.lateNightPotential * 0.18) +
          (signals.roleFit.windDown * 0.14) +
          (hasAnyToken(tokens, ['late', 'dance', 'dj', 'music', 'energy']) ? 0.1 : 0),
      )
      if (signals.liveNightlifePotential >= 0.58 || signals.lateNightPotential >= 0.58) {
        reasons.push('late energy continuity')
      }
      break
    }
    case 'wine_or_craft_debrief': {
      fit = clamp01(
        (venue.category === 'bar' ? 0.2 : 0) +
          (venue.category === 'restaurant' ? 0.14 : 0) +
          (signals.roleFit.windDown * 0.18) +
          (signals.authorityScore * 0.12) +
          (hasAnyToken(tokens, ['wine', 'craft', 'brew', 'conversation', 'debrief']) ? 0.24 : 0) +
          (socialConversation * 0.12),
      )
      if (hasAnyToken(tokens, ['wine', 'craft', 'conversation'])) reasons.push('debrief-friendly setting')
      break
    }
    case 'group_dinner': {
      fit = clamp01(
        (venue.category === 'restaurant' ? 0.34 : 0) +
          (signals.roleFit.highlight * 0.16) +
          (signals.roleFit.windDown * 0.12) +
          (signals.authorityScore * 0.14) +
          (hasAnyToken(tokens, ['group', 'dinner', 'table', 'family style', 'shared']) ? 0.16 : 0) +
          (signals.currentRelevance * 0.08),
      )
      if (venue.category === 'restaurant') reasons.push('group dinner anchor')
      break
    }
    case 'cultured_closer': {
      fit = clamp01(
        (venue.category === 'museum' ? 0.16 : 0) +
          (venue.category === 'bar' ? 0.16 : 0) +
          (venue.category === 'live_music' ? 0.16 : 0) +
          (signals.roleFit.windDown * 0.2) +
          (signals.culturalAnchorPotential * 0.14) +
          (hasAnyToken(tokens, ['gallery', 'jazz', 'nightcap', 'closing', 'reflective']) ? 0.18 : 0),
      )
      if (signals.roleFit.windDown >= 0.56) reasons.push('cultured close compatibility')
      break
    }
    case 'family_wander': {
      fit = clamp01(
        (venue.category === 'park' ? 0.34 : 0) +
          (venue.category === 'museum' ? 0.12 : 0) +
          (signals.roleFit.start * 0.2) +
          (hasAnyToken(tokens, ['walk', 'garden', 'trail', 'outdoor', 'family']) ? 0.24 : 0) +
          (1 - venue.energyLevel / 5) * 0.1,
      )
      if (venue.category === 'park') reasons.push('family wander setting')
      break
    }
    case 'family_lunch': {
      fit = clamp01(
        (isRestaurantLike ? 0.3 : 0) +
          (venue.category === 'cafe' ? 0.14 : 0) +
          (signals.roleFit.start * 0.16) +
          (hasAnyToken(tokens, ['lunch', 'family', 'kid', 'casual']) ? 0.22 : 0) +
          (signals.authorityScore * 0.1) +
          (1 - venue.energyLevel / 5) * 0.08,
      )
      if (hasAnyToken(tokens, ['lunch', 'family', 'kid'])) reasons.push('family lunch fit')
      break
    }
    case 'gentle_experience': {
      fit = clamp01(
        (venue.category === 'museum' ? 0.2 : 0) +
          (venue.category === 'park' ? 0.18 : 0) +
          (venue.category === 'activity' ? 0.14 : 0) +
          (signals.roleFit.highlight * 0.16) +
          (signals.culturalAnchorPotential * 0.1) +
          (hasAnyToken(tokens, ['gentle', 'interactive', 'family', 'learning']) ? 0.22 : 0),
      )
      if (hasAnyToken(tokens, ['family', 'learning', 'interactive'])) reasons.push('gentle family experience')
      break
    }
    case 'easy_dinner': {
      fit = clamp01(
        (venue.category === 'restaurant' ? 0.34 : 0) +
          (signals.roleFit.windDown * 0.18) +
          (hasAnyToken(tokens, ['easy', 'family', 'dinner', 'casual']) ? 0.22 : 0) +
          (signals.currentRelevance * 0.1) +
          (1 - venue.energyLevel / 5) * 0.12,
      )
      if (venue.category === 'restaurant') reasons.push('easy dinner anchor')
      break
    }
    case 'high_energy_anchor': {
      fit = clamp01(
        (venue.category === 'activity' ? 0.24 : 0) +
          (venue.category === 'event' ? 0.2 : 0) +
          (signals.eventPotential * 0.14) +
          (signals.performancePotential * 0.1) +
          (signals.roleFit.highlight * 0.18) +
          (hasAnyToken(tokens, ['play', 'interactive', 'active', 'sports', 'arcade']) ? 0.14 : 0),
      )
      if (signals.roleFit.highlight >= 0.56) reasons.push('high-energy centerpiece')
      break
    }
    case 'outdoor_reset': {
      fit = clamp01(
        (venue.category === 'park' ? 0.3 : 0) +
          (scenicLike ? 0.18 : 0) +
          (signals.roleFit.windDown * 0.18) +
          (hasAnyToken(tokens, ['outdoor', 'garden', 'reset', 'walk']) ? 0.22 : 0) +
          (1 - venue.energyLevel / 5) * 0.12,
      )
      if (venue.category === 'park' || scenicLike) reasons.push('outdoor reset option')
      break
    }
    case 'casual_group_lunch': {
      fit = clamp01(
        (isRestaurantLike ? 0.3 : 0) +
          (venue.category === 'cafe' ? 0.1 : 0) +
          (signals.roleFit.start * 0.16) +
          (hasAnyToken(tokens, ['lunch', 'group', 'casual', 'family']) ? 0.24 : 0) +
          (signals.currentRelevance * 0.1) +
          (signals.authorityScore * 0.1),
      )
      if (hasAnyToken(tokens, ['lunch', 'group', 'casual'])) reasons.push('casual group lunch signal')
      break
    }
    case 'afternoon_neighborhood_or_cultural': {
      fit = clamp01(
        (venue.category === 'museum' ? 0.2 : 0) +
          (venue.category === 'park' ? 0.16 : 0) +
          (signals.culturalAnchorPotential * 0.18) +
          (signals.roleFit.windDown * 0.16) +
          (hasAnyToken(tokens, ['neighborhood', 'cultural', 'afternoon', 'market']) ? 0.2 : 0) +
          (signals.hiddenGemScore * 0.1),
      )
      if (signals.culturalAnchorPotential >= 0.52) reasons.push('afternoon cultural handoff')
      break
    }
    case 'primary_cultural_institution': {
      fit = clamp01(
        (venue.category === 'museum' ? 0.4 : 0) +
          (signals.culturalAnchorPotential * 0.24) +
          (signals.roleFit.start * 0.14) +
          (hasAnyToken(tokens, ['museum', 'institution', 'gallery', 'cultural']) ? 0.16 : 0) +
          (signals.authorityScore * 0.06),
      )
      if (venue.category === 'museum') reasons.push('primary cultural institution fit')
      break
    }
    case 'debrief_stop': {
      fit = clamp01(
        (venue.category === 'cafe' ? 0.24 : 0) +
          (venue.category === 'bar' ? 0.12 : 0) +
          (signals.roleFit.windDown * 0.16) +
          (hasAnyToken(tokens, ['debrief', 'coffee', 'conversation', 'pause']) ? 0.26 : 0) +
          (socialConversation * 0.14) +
          (signals.currentRelevance * 0.08),
      )
      if (hasAnyToken(tokens, ['coffee', 'conversation', 'pause'])) reasons.push('debrief pacing support')
      break
    }
    case 'secondary_cultural_stop': {
      fit = clamp01(
        (venue.category === 'museum' ? 0.28 : 0) +
          (venue.category === 'activity' ? 0.12 : 0) +
          (signals.culturalAnchorPotential * 0.22) +
          (signals.roleFit.highlight * 0.16) +
          (hasAnyToken(tokens, ['cultural', 'history', 'gallery', 'learning']) ? 0.16 : 0) +
          (signals.hiddenGemScore * 0.06),
      )
      if (signals.culturalAnchorPotential >= 0.54) reasons.push('secondary cultural reinforcement')
      break
    }
    case 'thematic_lunch': {
      fit = clamp01(
        (isRestaurantLike ? 0.28 : 0) +
          (signals.roleFit.start * 0.14) +
          (signals.authorityScore * 0.12) +
          (hasAnyToken(tokens, ['thematic', 'regional', 'chef', 'lunch']) ? 0.24 : 0) +
          (signals.culturalAnchorPotential * 0.12) +
          (signals.currentRelevance * 0.1),
      )
      if (hasAnyToken(tokens, ['regional', 'thematic', 'lunch'])) reasons.push('thematic lunch support')
      break
    }
    case 'adult_payoff_dinner': {
      fit = clamp01(
        (venue.category === 'restaurant' ? 0.34 : 0) +
          (signals.roleFit.windDown * 0.16) +
          (signals.authorityScore * 0.16) +
          (signals.currentRelevance * 0.08) +
          (hasAnyToken(tokens, ['chef', 'tasting', 'signature', 'dinner', 'payoff']) ? 0.18 : 0) +
          ((venue.priceTier === '$$$' || venue.priceTier === '$$$$') ? 0.08 : 0),
      )
      if (hasAnyToken(tokens, ['chef', 'tasting', 'signature'])) reasons.push('adult payoff dinner signal')
      break
    }
    default:
      fit = 0
  }

  const familyAlignment = getFamilyAlignment(scenarioFamily, signals, scoredVenue)
  const scenarioAdjustedFit = clamp01(fit * 0.72 + familyAlignment * 0.28)
  if (scenarioAdjustedFit >= 0.56 && reasons.length === 0) {
    reasons.push('strong scenario-aware stop-type fit')
  }
  return { fit: scenarioAdjustedFit, reasons: reasons.slice(0, 3) }
}

function buildQualityFilterPass(params: {
  stopTypeFit: number
  authorityScore: number
  hiddenGemScore: number
  currentRelevance: number
  scenarioRelevance: number
}): boolean {
  const { stopTypeFit, authorityScore, hiddenGemScore, currentRelevance, scenarioRelevance } = params
  return (
    stopTypeFit >= 0.62 ||
    authorityScore >= 0.68 ||
    hiddenGemScore >= 0.68 ||
    currentRelevance >= 0.68 ||
    scenarioRelevance >= 0.66
  )
}

function dedupeByVenue(scoredVenues: ScoredVenue[]): ScoredVenue[] {
  const bestByVenueId = new Map<string, ScoredVenue>()
  for (const scoredVenue of scoredVenues) {
    const existing = bestByVenueId.get(scoredVenue.venue.id)
    if (!existing || scoredVenue.fitScore > existing.fitScore) {
      bestByVenueId.set(scoredVenue.venue.id, scoredVenue)
    }
  }
  return [...bestByVenueId.values()]
}

function emptyCandidatesByStopType(requiredStopTypes: StopType[]): Record<StopType, StopTypeCandidate[]> {
  return requiredStopTypes.reduce(
    (acc, stopType) => {
      acc[stopType] = []
      return acc
    },
    {} as Record<StopType, StopTypeCandidate[]>,
  )
}

function getCandidateRankScore(params: {
  stopTypeFit: number
  scenarioRelevance: number
  signals: VenueSignals
}): number {
  const { stopTypeFit, scenarioRelevance, signals } = params
  return (
    stopTypeFit * 0.42 +
    scenarioRelevance * 0.2 +
    signals.authorityScore * 0.18 +
    signals.hiddenGemScore * 0.08 +
    signals.currentRelevance * 0.06 +
    signals.roleFit.highlight * 0.06
  )
}

function toCandidateReasons(params: {
  baseReasons: string[]
  scenarioRelevance: number
  signals: VenueSignals
}): string[] {
  const { baseReasons, scenarioRelevance, signals } = params
  const reasons = [...baseReasons]
  if (signals.authorityScore >= 0.66) {
    reasons.push('authority-backed venue for this stop type')
  }
  if (signals.hiddenGemScore >= 0.64) {
    reasons.push('hidden-gem strength')
  }
  if (signals.currentRelevance >= 0.62) {
    reasons.push('strong current relevance')
  }
  if (signals.performancePotential >= 0.6) {
    reasons.push('performance-capable signal')
  }
  if (signals.culturalAnchorPotential >= 0.6) {
    reasons.push('cultural-anchor signal')
  }
  if (signals.liveNightlifePotential >= 0.6) {
    reasons.push('nightlife continuity signal')
  }
  if (scenarioRelevance >= 0.68) {
    reasons.push('high scenario relevance')
  }
  return [...new Set(reasons)].slice(0, 3)
}

function asRecordByStopType(
  board: Record<StopType, Array<StopTypeCandidate & { __rankScore: number }>>,
): Record<StopType, StopTypeCandidate[]> {
  const next = {} as Record<StopType, StopTypeCandidate[]>
  ;(Object.keys(board) as StopType[]).forEach((stopType) => {
    next[stopType] = board[stopType]
      .slice()
      .sort((left, right) => {
        if (right.__rankScore !== left.__rankScore) {
          return right.__rankScore - left.__rankScore
        }
        if (right.authorityScore !== left.authorityScore) {
          return right.authorityScore - left.authorityScore
        }
        if (right.currentRelevance !== left.currentRelevance) {
          return right.currentRelevance - left.currentRelevance
        }
        return left.name.localeCompare(right.name)
      })
      .slice(0, 5)
      .map(({ __rankScore, ...candidate }) => candidate)
  })
  return next
}

export function buildStopTypeCandidateBoard(
  input: BuildStopTypeCandidateBoardInput,
): StopTypeCandidateBoard | null {
  const scenarioFamily = resolveScenarioFamily({
    city: input.city,
    persona: input.persona,
    vibe: input.vibe,
  })
  if (!scenarioFamily) {
    return null
  }

  const requiredStopTypes = getScenarioRequiredStopTypes(scenarioFamily)
  const scored = dedupeByVenue(input.scoredVenues)
  const candidatesByStopType = emptyCandidatesByStopType(requiredStopTypes)
  const rankedBoard = emptyCandidatesByStopType(requiredStopTypes) as Record<
    StopType,
    Array<StopTypeCandidate & { __rankScore: number }>
  >

  for (const scoredVenue of scored) {
    const signals = getVenueSignals(scoredVenue)
    for (const stopType of requiredStopTypes) {
      const fitResult = getStopTypeFit(scoredVenue, stopType, scenarioFamily)
      const scenarioRelevance = clamp01(
        fitResult.fit * 0.62 + getFamilyAlignment(scenarioFamily, signals, scoredVenue) * 0.38,
      )
      const passQuality = buildQualityFilterPass({
        stopTypeFit: fitResult.fit,
        authorityScore: signals.authorityScore,
        hiddenGemScore: signals.hiddenGemScore,
        currentRelevance: signals.currentRelevance,
        scenarioRelevance,
      })
      if (!passQuality) {
        continue
      }

      const candidate: StopTypeCandidate & { __rankScore: number } = {
        venueId: scoredVenue.venue.id,
        name: scoredVenue.venue.name,
        city: scoredVenue.venue.city,
        address: scoredVenue.venue.source.formattedAddress,
        district: scoredVenue.venue.neighborhood,
        neighborhoodLabel: scoredVenue.venue.neighborhood,
        stopType,
        venueCategory: scoredVenue.venue.category,
        venueSubcategory: scoredVenue.venue.subcategory,
        shortDescription: scoredVenue.venue.shortDescription,
        sourceTypes: scoredVenue.venue.source.sourceTypes,
        venueTags: scoredVenue.venue.tags,
        sourceType: toSourceType(scoredVenue),
        hoursKnown: scoredVenue.venue.source.hoursKnown,
        openNow: scoredVenue.venue.source.openNow,
        authorityScore: signals.authorityScore,
        hiddenGemScore: signals.hiddenGemScore,
        currentRelevance: signals.currentRelevance,
        eventPotential: signals.eventPotential,
        performancePotential: signals.performancePotential,
        liveNightlifePotential: signals.liveNightlifePotential,
        culturalAnchorPotential: signals.culturalAnchorPotential,
        lateNightPotential: signals.lateNightPotential,
        majorVenueStrength: signals.majorVenueStrength,
        roleFit: {
          start: signals.roleFit.start,
          highlight: signals.roleFit.highlight,
          windDown: signals.roleFit.windDown,
        },
        reasons: toCandidateReasons({
          baseReasons: fitResult.reasons,
          scenarioRelevance,
          signals,
        }),
        __rankScore: getCandidateRankScore({
          stopTypeFit: fitResult.fit,
          scenarioRelevance,
          signals,
        }),
      }
      rankedBoard[stopType].push(candidate)
    }
  }

  const orderedBoard = asRecordByStopType(rankedBoard)
  requiredStopTypes.forEach((stopType) => {
    candidatesByStopType[stopType] = orderedBoard[stopType]
  })

  return {
    city: input.city,
    persona: input.persona,
    vibe: input.vibe,
    scenarioFamily,
    requiredStopTypes,
    candidatesByStopType,
  }
}

export async function buildStopTypeCandidateBoardFromIntent(
  input: BuildStopTypeCandidateBoardFromIntentInput,
): Promise<StopTypeCandidateBoard | null> {
  const persona = parsePersona(input.persona)
  const vibe = parseVibe(input.vibe)
  if (!persona || !vibe) {
    return null
  }
  const scenarioFamily = resolveScenarioFamily({
    city: input.city,
    persona,
    vibe,
  })
  if (!scenarioFamily) {
    return null
  }

  const intent = normalizeIntent({
    persona,
    primaryVibe: vibe,
    city: input.city,
    distanceMode: input.distanceMode ?? 'nearby',
    budget: input.budget ?? 'balanced',
    mode: 'build',
  })
  const lens = buildExperienceLens({ intent })
  const retrieval = await retrieveVenues(intent, lens, {
    requestedSourceMode: input.sourceMode ?? 'curated',
  })
  const scoredVenues = scoreVenueCollection(
    retrieval.venues,
    intent,
    getCrewPolicy(intent.crew),
    lens,
    getRoleContract({ intent }),
  )
  return buildStopTypeCandidateBoard({
    city: input.city,
    persona,
    vibe,
    scoredVenues,
  })
}
