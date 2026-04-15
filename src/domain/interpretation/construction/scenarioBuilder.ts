import type {
  ScenarioFamily,
  StopType,
  StopTypeCandidate,
  StopTypeCandidateBoard,
} from '../discovery/stopTypeCandidateBoard'
import { getScenarioRequiredStopTypes } from '../discovery/stopTypeCandidateBoard'
import type { VenueCategory } from '../../types/venue'

export type BuiltScenarioStopPosition =
  | 'start'
  | 'mid'
  | 'highlight'
  | 'windDown'
  | 'closer'

export type GreatStopCriterion =
  | 'real'
  | 'role_right'
  | 'intent_right'
  | 'place_right'
  | 'moment_right'

export type GreatStopEvaluation = {
  isReal: boolean
  isRoleRight: boolean
  isIntentRight: boolean
  isPlaceRight: boolean
  isMomentRight: boolean
  failedCriteria: GreatStopCriterion[]
  notes?: string[]
}

export type BuiltScenarioNightEvaluation = {
  stopEvaluations: Array<{
    venueId: string
    name: string
    evaluation: GreatStopEvaluation
  }>
  passesGreatStopStandard: boolean
  failedStops: string[]
  notes?: string[]
}

export type BuiltScenarioStop = {
  position: BuiltScenarioStopPosition
  stopType: StopType
  venueId: string
  name: string
  address?: string
  district?: string
  neighborhoodLabel?: string
  venueTypeLabel?: string
  sourceType?: 'venue' | 'event' | 'hybrid'
  factualSummary?: string
  venueFeatures?: string[]
  serviceOptions?: string[]
  isHiddenGem?: boolean
  authorityScore: number
  currentRelevance: number
  reasons: string[]
  momentLabel: string
  whyThisStop: string
  whyTonight?: string
  venueCategory?: VenueCategory
  venueSubcategory?: string
  sourceTypes?: string[]
  roleFit: {
    start?: number
    highlight?: number
    windDown?: number
  }
  eventPotential?: number
  performancePotential?: number
  liveNightlifePotential?: number
  culturalAnchorPotential?: number
  lateNightPotential?: number
  majorVenueStrength?: number
  evaluation?: GreatStopEvaluation
}

export type BuiltScenarioNight = {
  id: string
  city: string
  persona: string
  vibe: string
  scenarioFamily: ScenarioFamily
  title: string
  flavorLine: string
  stops: BuiltScenarioStop[]
  whyThisWorks: string
  complete: boolean
  missingStopTypes?: StopType[]
  evaluation?: BuiltScenarioNightEvaluation
}

type BuilderOptions = {
  minNights?: number
  maxNights?: number
}

type CandidateNight = {
  stops: BuiltScenarioStop[]
  score: number
  anchorAuthority: number
  startQuality: number
  landingQuality: number
  hiddenGemPresence: number
  currentRelevance: number
  districtPlausibility: number
  roleDiscipline: number
}

function getHighlightStopName(night: CandidateNight): string {
  const highlight = night.stops[Math.min(2, night.stops.length - 1)]
  return highlight?.name ?? 'n/a'
}

const POSITION_BY_INDEX: BuiltScenarioStopPosition[] = [
  'start',
  'mid',
  'highlight',
  'windDown',
  'closer',
]

const SCENARIO_FLAVOR_LINE: Record<ScenarioFamily, string> = {
  romantic_cozy: 'Intimate romantic night',
  romantic_lively: 'Pulse-forward romantic night',
  romantic_cultured: 'Curated romantic night',
  friends_cozy: 'Low-key friends night',
  friends_lively: 'High-energy friends night',
  friends_cultured: 'Curated friends night',
  family_cozy: 'Gentle family night',
  family_lively: 'Active family outing',
  family_cultured: 'Cultural family sequence',
}

const STOP_TYPE_POSITION_EXPECTATION: Record<StopType, BuiltScenarioStopPosition> = {
  neighborhood_walk: 'start',
  casual_daytime_food: 'mid',
  atmospheric_experience: 'highlight',
  intimate_dinner: 'windDown',
  nightcap: 'closer',
  aperitivo: 'start',
  energetic_dinner: 'mid',
  performance_anchor: 'highlight',
  cocktail_bar: 'windDown',
  late_night_food: 'closer',
  cultural_institution: 'start',
  atmospheric_detour: 'mid',
  thoughtful_wine_or_lunch: 'highlight',
  performance_or_fine_dining: 'windDown',
  atmospheric_nightcap: 'closer',
  casual_group_food: 'mid',
  low_key_experience: 'highlight',
  neighborhood_dive_or_pub: 'windDown',
  group_gathering_point: 'start',
  group_activity_anchor: 'mid',
  late_energy_venue: 'windDown',
  wine_or_craft_debrief: 'highlight',
  group_dinner: 'windDown',
  cultured_closer: 'closer',
  family_wander: 'start',
  family_lunch: 'mid',
  gentle_experience: 'highlight',
  easy_dinner: 'windDown',
  high_energy_anchor: 'start',
  outdoor_reset: 'mid',
  casual_group_lunch: 'highlight',
  afternoon_neighborhood_or_cultural: 'windDown',
  primary_cultural_institution: 'start',
  debrief_stop: 'mid',
  secondary_cultural_stop: 'highlight',
  thematic_lunch: 'windDown',
  adult_payoff_dinner: 'closer',
}

const ROLE_FIT_KEY_BY_POSITION: Record<BuiltScenarioStopPosition, keyof BuiltScenarioStop['roleFit']> = {
  start: 'start',
  mid: 'start',
  highlight: 'highlight',
  windDown: 'windDown',
  closer: 'windDown',
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

function toSentenceCase(value: string): string {
  if (!value) {
    return value
  }
  return value[0].toUpperCase() + value.slice(1)
}

function isSyntheticName(value: string): boolean {
  const normalized = normalizeToken(value)
  return (
    normalized.includes('microcrawl') ||
    normalized.includes('sketchbook') ||
    normalized.includes('drop') ||
    normalized.includes('proto') ||
    normalized.includes('testbed') ||
    normalized.includes('simulator')
  )
}

function pickTitle(scenarioFamily: ScenarioFamily, highlightName: string): string {
  if (!isSyntheticName(highlightName)) {
    return `Evening at ${highlightName}`
  }
  if (scenarioFamily === 'romantic_cozy') {
    return 'Romantic Cozy Sequence'
  }
  if (scenarioFamily === 'romantic_lively') {
    return 'Romantic Lively Sequence'
  }
  if (scenarioFamily === 'romantic_cultured') {
    return 'Romantic Cultured Sequence'
  }
  if (scenarioFamily === 'friends_cozy') {
    return 'Friends Cozy Sequence'
  }
  if (scenarioFamily === 'friends_lively') {
    return 'Friends Lively Sequence'
  }
  if (scenarioFamily === 'friends_cultured') {
    return 'Friends Cultured Sequence'
  }
  if (scenarioFamily === 'family_cozy') {
    return 'Family Cozy Sequence'
  }
  if (scenarioFamily === 'family_lively') {
    return 'Family Lively Sequence'
  }
  return 'Family Cultured Sequence'
}

function getWhyThisWorks(stops: BuiltScenarioStop[]): string {
  const start = stops[0]
  const highlight = stops[Math.min(2, stops.length - 1)]
  const closer = stops[stops.length - 1]
  return `Starts at ${start.name}, centers on ${highlight.name}, and lands cleanly at ${closer.name}.`
}

function mapCategoryToVenueTypeLabel(category?: VenueCategory, subcategory?: string): string | undefined {
  const normalizedSubcategory = normalizeToken(subcategory ?? '')
  if (normalizedSubcategory.includes('jazz')) return 'jazz lounge'
  if (normalizedSubcategory.includes('cocktail')) return 'cocktail bar'
  if (normalizedSubcategory.includes('wine')) return 'wine bar'
  if (normalizedSubcategory.includes('garden')) return 'Japanese garden'
  if (normalizedSubcategory.includes('museum')) return 'cultural museum'
  if (normalizedSubcategory.includes('fine dining') || normalizedSubcategory.includes('tasting')) {
    return 'chef-driven restaurant'
  }

  if (category === 'restaurant') return 'restaurant'
  if (category === 'bar') return 'bar'
  if (category === 'cafe') return 'cafe'
  if (category === 'dessert') return 'dessert spot'
  if (category === 'museum') return 'cultural museum'
  if (category === 'live_music') return 'live music venue'
  if (category === 'park') return 'urban park'
  if (category === 'event') return 'event venue'
  if (category === 'activity') return 'activity venue'
  return undefined
}

function deriveVenueFeatures(candidate: StopTypeCandidate): string[] | undefined {
  const tokens = new Set(
    [...(candidate.venueTags ?? []), ...(candidate.sourceTypes ?? [])]
      .map((entry) => normalizeToken(entry))
      .filter(Boolean),
  )
  const features: string[] = []
  if ([...tokens].some((token) => token.includes('live music') || token.includes('music_venue'))) {
    features.push('live music')
  }
  if ([...tokens].some((token) => token.includes('outdoor') || token.includes('garden') || token.includes('park'))) {
    features.push('outdoor setting')
  }
  if ([...tokens].some((token) => token.includes('historic') || token.includes('museum') || token.includes('gallery'))) {
    features.push('cultural programming')
  }
  if (candidate.hiddenGemScore >= 0.66) {
    features.push('local-favorite profile')
  }
  return features.length > 0 ? features.slice(0, 3) : undefined
}

function deriveServiceOptions(candidate: StopTypeCandidate): string[] | undefined {
  const tokens = new Set(
    [...(candidate.venueTags ?? []), ...(candidate.sourceTypes ?? [])]
      .map((entry) => normalizeToken(entry))
      .filter(Boolean),
  )
  const options: string[] = []
  if ([...tokens].some((token) => token.includes('dine in') || token.includes('restaurant'))) {
    options.push('dine-in')
  }
  if ([...tokens].some((token) => token.includes('takeout') || token.includes('take out'))) {
    options.push('takeout')
  }
  if ([...tokens].some((token) => token.includes('delivery'))) {
    options.push('delivery')
  }
  if ([...tokens].some((token) => token.includes('reservation') || token.includes('book'))) {
    options.push('reservations')
  }
  return options.length > 0 ? options.slice(0, 3) : undefined
}

function buildFactualSummary(candidate: StopTypeCandidate): string | undefined {
  const venueTypeLabel = mapCategoryToVenueTypeLabel(candidate.venueCategory, candidate.venueSubcategory)
  const district = candidate.district?.trim()
  const summary = candidate.shortDescription?.trim()
  if (venueTypeLabel && district && summary) {
    return `${toSentenceCase(venueTypeLabel)} in ${district}. ${summary}`
  }
  if (venueTypeLabel && district) {
    return `${toSentenceCase(venueTypeLabel)} in ${district}.`
  }
  if (summary) {
    return summary
  }
  if (venueTypeLabel) {
    return toSentenceCase(venueTypeLabel)
  }
  return undefined
}

function buildMomentLabel(scenarioFamily: ScenarioFamily, stop: BuiltScenarioStop): string {
  if (scenarioFamily === 'romantic_cozy') {
    if (stop.position === 'start') return 'Quiet neighborhood opener'
    if (stop.position === 'mid') return 'Comfort-forward bridge'
    if (stop.position === 'highlight') return 'Warm atmospheric centerpiece'
    if (stop.position === 'windDown') return 'Intimate dinner settle-in'
    return 'Soft reflective landing'
  }
  if (scenarioFamily === 'romantic_lively') {
    if (stop.position === 'start') return 'Low-pressure social launch'
    if (stop.position === 'mid') return 'Energy-building dinner'
    if (stop.position === 'highlight') return 'Peak live-energy anchor'
    if (stop.position === 'windDown') return 'Nightlife continuation'
    return 'Late-night closeout'
  }
  if (scenarioFamily === 'romantic_cultured') {
    if (stop.position === 'start') return 'Cultural opener'
    if (stop.position === 'mid') return 'Context-setting detour'
    if (stop.position === 'highlight') return 'Strongest cultural anchor tonight'
    if (stop.position === 'windDown') return 'Performance or fine-dining peak'
    return 'Soft reflective landing'
  }
  if (scenarioFamily === 'friends_cozy') {
    if (stop.position === 'start') return 'Neighborhood meetup start'
    if (stop.position === 'mid') return 'Casual group table'
    if (stop.position === 'highlight') return 'Low-key shared anchor'
    if (stop.position === 'windDown') return 'Neighborhood pub wind-down'
    return 'Local close'
  }
  if (scenarioFamily === 'friends_lively') {
    if (stop.position === 'start') return 'Group launch point'
    if (stop.position === 'mid') return 'Activity anchor push'
    if (stop.position === 'highlight') return 'Cocktail energy peak'
    if (stop.position === 'windDown') return 'Late-energy continuation'
    return 'Post-peak food close'
  }
  if (scenarioFamily === 'friends_cultured') {
    if (stop.position === 'start') return 'Culture-led opener'
    if (stop.position === 'mid') return 'Atmospheric connective stop'
    if (stop.position === 'highlight') return 'Debrief and perspective shift'
    if (stop.position === 'windDown') return 'Group dinner anchor'
    return 'Cultured closer'
  }
  if (scenarioFamily === 'family_cozy') {
    if (stop.position === 'start') return 'Gentle family opener'
    if (stop.position === 'mid') return 'Easy lunch bridge'
    if (stop.position === 'highlight') return 'Low-stress shared experience'
    if (stop.position === 'windDown') return 'Comfortable dinner landing'
    return 'Soft family close'
  }
  if (scenarioFamily === 'family_lively') {
    if (stop.position === 'start') return 'High-energy kickoff'
    if (stop.position === 'mid') return 'Outdoor reset window'
    if (stop.position === 'highlight') return 'Casual lunch regroup'
    if (stop.position === 'windDown') return 'Neighborhood or cultural taper'
    return 'Family closeout'
  }
  if (stop.position === 'start') return 'Primary cultural opener'
  if (stop.position === 'mid') return 'Debrief bridge'
  if (stop.position === 'highlight') return 'Secondary cultural anchor'
  if (stop.position === 'windDown') return 'Thematic lunch progression'
  return 'Adult-payoff dinner close'
}

function buildSignalReason(stop: BuiltScenarioStop): string {
  const nightlifeSignal = Math.max(stop.liveNightlifePotential ?? 0, stop.lateNightPotential ?? 0)
  const culturalSignal = Math.max(stop.culturalAnchorPotential ?? 0, stop.performancePotential ?? 0)
  const eventSignal = stop.eventPotential ?? 0
  if (stop.authorityScore >= 0.72) {
    return 'high authority signal for this role'
  }
  if (stop.currentRelevance >= 0.64) {
    return 'strong current relevance signal'
  }
  if (nightlifeSignal >= 0.6) {
    return 'clear nightlife momentum signal'
  }
  if (culturalSignal >= 0.6) {
    return 'clear cultural authority signal'
  }
  if (eventSignal >= 0.6) {
    return 'event timing signal is active'
  }
  if (stop.isHiddenGem) {
    return 'hidden-gem profile strengthens distinctiveness'
  }
  return 'balanced quality signals across authority and fit'
}

function buildRoleReason(stop: BuiltScenarioStop): string {
  if (stop.position === 'highlight') {
    return `${stop.name} holds the anchor moment`
  }
  if (stop.position === 'start') {
    return `${stop.name} opens the sequence cleanly`
  }
  if (stop.position === 'mid') {
    return `${stop.name} keeps momentum between opener and anchor`
  }
  if (stop.position === 'windDown') {
    return `${stop.name} transitions out of the peak`
  }
  return `${stop.name} closes the route without breaking tone`
}

function buildWhyTonight(scenarioFamily: ScenarioFamily, stop: BuiltScenarioStop): string | undefined {
  if (stop.currentRelevance >= 0.66) {
    return 'Current relevance is strong for tonight.'
  }
  if (
    scenarioFamily === 'romantic_lively' &&
    Math.max(stop.eventPotential ?? 0, stop.performancePotential ?? 0, stop.liveNightlifePotential ?? 0) >= 0.62
  ) {
    return 'Live/nightlife signals are active tonight.'
  }
  if (
    (scenarioFamily === 'romantic_cultured' ||
      scenarioFamily === 'friends_cultured' ||
      scenarioFamily === 'family_cultured') &&
    Math.max(stop.culturalAnchorPotential ?? 0, stop.performancePotential ?? 0) >= 0.62
  ) {
    return 'Cultural programming signal is active tonight.'
  }
  if (
    (scenarioFamily === 'friends_lively' || scenarioFamily === 'family_lively') &&
    Math.max(stop.eventPotential ?? 0, stop.liveNightlifePotential ?? 0, stop.performancePotential ?? 0) >= 0.62
  ) {
    return 'High-energy event signal is active tonight.'
  }
  if (
    (scenarioFamily === 'friends_cozy' || scenarioFamily === 'family_cozy') &&
    stop.authorityScore >= 0.68 &&
    stop.currentRelevance >= 0.5
  ) {
    return 'Reliable local fit makes this timing work tonight.'
  }
  if (scenarioFamily === 'romantic_cozy' && stop.isHiddenGem && stop.authorityScore >= 0.7) {
    return 'Local-favorite authority makes this timing strong tonight.'
  }
  return undefined
}

function withPreviewContract(
  scenarioFamily: ScenarioFamily,
  stops: BuiltScenarioStop[],
): BuiltScenarioStop[] {
  return stops.map((stop) => ({
    ...stop,
    momentLabel: buildMomentLabel(scenarioFamily, stop),
    whyThisStop: `${buildRoleReason(stop)}; ${buildSignalReason(stop)}.`,
    whyTonight: buildWhyTonight(scenarioFamily, stop),
  }))
}

function toBuiltStop(
  candidate: StopTypeCandidate,
  position: BuiltScenarioStopPosition,
): BuiltScenarioStop {
  const venueTypeLabel = mapCategoryToVenueTypeLabel(candidate.venueCategory, candidate.venueSubcategory)
  return {
    position,
    stopType: candidate.stopType,
    venueId: candidate.venueId,
    name: candidate.name,
    address: candidate.address,
    district: candidate.district,
    neighborhoodLabel: candidate.neighborhoodLabel,
    venueTypeLabel,
    sourceType: candidate.sourceType,
    factualSummary: buildFactualSummary(candidate),
    venueFeatures: deriveVenueFeatures(candidate),
    serviceOptions: deriveServiceOptions(candidate),
    isHiddenGem: candidate.hiddenGemScore >= 0.66,
    authorityScore: candidate.authorityScore,
    currentRelevance: candidate.currentRelevance,
    reasons: candidate.reasons.slice(0, 2),
    momentLabel: '',
    whyThisStop: '',
    whyTonight: undefined,
    venueCategory: candidate.venueCategory,
    venueSubcategory: candidate.venueSubcategory,
    sourceTypes: candidate.sourceTypes,
    roleFit: {
      start: candidate.roleFit.start,
      highlight: candidate.roleFit.highlight,
      windDown: candidate.roleFit.windDown,
    },
    eventPotential: candidate.eventPotential,
    performancePotential: candidate.performancePotential,
    liveNightlifePotential: candidate.liveNightlifePotential,
    culturalAnchorPotential: candidate.culturalAnchorPotential,
    lateNightPotential: candidate.lateNightPotential,
    majorVenueStrength: candidate.majorVenueStrength,
  }
}

function getStopQuality(stop: BuiltScenarioStop): number {
  const hiddenGemLift = stop.isHiddenGem ? 0.08 : 0
  return clamp01(stop.authorityScore * 0.68 + stop.currentRelevance * 0.24 + hiddenGemLift)
}

function getRoleFitScore(stop: BuiltScenarioStop): number {
  const roleFitKey = ROLE_FIT_KEY_BY_POSITION[stop.position]
  return clamp01(stop.roleFit[roleFitKey] ?? 0)
}

function getRoleFitThreshold(
  scenarioFamily: ScenarioFamily,
  position: BuiltScenarioStopPosition,
): number {
  let threshold = 0.34
  if (position === 'start') threshold = 0.36
  if (position === 'highlight') threshold = 0.5
  if (position === 'windDown') threshold = 0.42
  if (position === 'closer') threshold = 0.4

  if (scenarioFamily === 'friends_lively' || scenarioFamily === 'romantic_lively') {
    if (position === 'highlight' || position === 'windDown' || position === 'closer') {
      threshold += 0.04
    }
  }
  if (
    scenarioFamily === 'romantic_cultured' ||
    scenarioFamily === 'friends_cultured' ||
    scenarioFamily === 'family_cultured'
  ) {
    if (position === 'highlight' || position === 'windDown' || position === 'closer') {
      threshold += 0.03
    }
  }
  return threshold
}

function getRoleDiscipline(
  scenarioFamily: ScenarioFamily,
  stops: BuiltScenarioStop[],
): number {
  if (stops.length === 0) {
    return 0
  }
  const values = stops.map((stop) => {
    const score = getRoleFitScore(stop)
    const threshold = getRoleFitThreshold(scenarioFamily, stop.position)
    return clamp01(score >= threshold ? 0.7 + score * 0.3 : score * 0.8)
  })
  return clamp01(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function getDistrictPlausibility(stops: BuiltScenarioStop[]): number {
  const districts = stops.map((stop) => normalizeToken(stop.district ?? '')).filter(Boolean)
  if (districts.length === 0) {
    return 0.62
  }
  let transitions = 0
  for (let index = 1; index < districts.length; index += 1) {
    if (districts[index] !== districts[index - 1]) {
      transitions += 1
    }
  }
  const uniqueCount = new Set(districts).size
  const transitionPenalty = transitions >= 4 ? 0.18 : transitions === 3 ? 0.1 : transitions === 2 ? 0.04 : 0
  const spreadPenalty = uniqueCount >= 5 ? 0.2 : uniqueCount === 4 ? 0.14 : uniqueCount === 3 ? 0.05 : 0
  const dominantShare =
    Math.max(...Object.values(districts.reduce<Record<string, number>>((acc, district) => {
      acc[district] = (acc[district] ?? 0) + 1
      return acc
    }, {}))) / districts.length
  const dominantPenalty = dominantShare < 0.4 ? 0.12 : dominantShare < 0.5 ? 0.06 : 0
  return clamp01(0.94 - transitionPenalty - spreadPenalty - dominantPenalty)
}

function getScenarioCoherence(
  scenarioFamily: ScenarioFamily,
  stops: BuiltScenarioStop[],
): number {
  const highlight = stops[Math.min(2, stops.length - 1)]
  const start = stops[0]
  const closer = stops[stops.length - 1]
  const reasonCorpus = normalizeToken(
    stops
      .flatMap((stop) => [stop.name, ...stop.reasons])
      .join(' '),
  )

  if (scenarioFamily === 'romantic_cozy') {
    const cozySignal =
      ['cozy', 'intimate', 'quiet', 'garden', 'wine', 'tea', 'nightcap'].some((token) =>
        reasonCorpus.includes(token),
      )
        ? 1
        : 0
    return clamp01(
      highlight.authorityScore * 0.28 +
        getStopQuality(closer) * 0.28 +
        getStopQuality(start) * 0.18 +
        cozySignal * 0.16 +
        (highlight.isHiddenGem ? 0.1 : 0),
    )
  }

  if (scenarioFamily === 'romantic_lively') {
    const livelySignal =
      ['performance', 'nightlife', 'cocktail', 'late', 'event'].some((token) =>
        reasonCorpus.includes(token),
      )
        ? 1
        : 0
    return clamp01(
      highlight.authorityScore * 0.34 +
        highlight.currentRelevance * 0.2 +
        getStopQuality(stops[3] ?? closer) * 0.16 +
        getStopQuality(closer) * 0.14 +
        livelySignal * 0.16,
    )
  }
  if (scenarioFamily === 'romantic_cultured' || scenarioFamily === 'friends_cultured' || scenarioFamily === 'family_cultured') {
    const culturalSignal =
      ['cultural', 'museum', 'gallery', 'institution', 'performance', 'reflective'].some((token) =>
        reasonCorpus.includes(token),
      )
        ? 1
        : 0
    return clamp01(
      highlight.authorityScore * 0.3 +
        getStopQuality(stops[0]) * 0.2 +
        getStopQuality(stops[1] ?? stops[0]) * 0.14 +
        getStopQuality(closer) * 0.14 +
        culturalSignal * 0.22,
    )
  }
  if (scenarioFamily === 'friends_lively' || scenarioFamily === 'family_lively') {
    const energySignal =
      ['event', 'activity', 'late', 'night', 'cocktail', 'live'].some((token) =>
        reasonCorpus.includes(token),
      )
        ? 1
        : 0
    return clamp01(
      highlight.authorityScore * 0.28 +
        getStopQuality(stops[0]) * 0.16 +
        getStopQuality(stops[1] ?? stops[0]) * 0.14 +
        getStopQuality(closer) * 0.2 +
        energySignal * 0.22,
    )
  }
  const socialSignal =
    ['group', 'casual', 'family', 'neighborhood', 'conversation', 'easy'].some((token) =>
      reasonCorpus.includes(token),
    )
      ? 1
      : 0
  return clamp01(
    highlight.authorityScore * 0.24 +
      getStopQuality(stops[0]) * 0.18 +
      getStopQuality(stops[1] ?? stops[0]) * 0.16 +
      getStopQuality(closer) * 0.2 +
      socialSignal * 0.22,
  )
}

function getCandidateNightScore(
  scenarioFamily: ScenarioFamily,
  stops: BuiltScenarioStop[],
): CandidateNight {
  const highlightIndex = Math.min(2, stops.length - 1)
  const highlight = stops[highlightIndex]
  const landingStops = stops.slice(Math.max(0, stops.length - 2))
  const landingQuality = clamp01(
    landingStops.reduce((sum, stop) => sum + getStopQuality(stop), 0) /
      Math.max(1, landingStops.length),
  )
  const anchorAuthority = highlight?.authorityScore ?? 0
  const startQuality = getStopQuality(stops[0])
  const hiddenGemPresence = clamp01(
    stops.filter((stop) => stop.isHiddenGem).length / Math.max(1, stops.length),
  )
  const currentRelevance = clamp01(
    stops.reduce((sum, stop) => sum + stop.currentRelevance, 0) / Math.max(1, stops.length),
  )
  const districtPlausibility = getDistrictPlausibility(stops)
  const roleDiscipline = getRoleDiscipline(scenarioFamily, stops)
  const scenarioCoherence = getScenarioCoherence(scenarioFamily, stops)
  const syntheticPenalty =
    stops.filter((stop) => isSyntheticName(stop.name)).length > 0
      ? 0.08
      : 0
  const score = clamp01(
    anchorAuthority * 0.22 +
      scenarioCoherence * 0.18 +
      startQuality * 0.1 +
      landingQuality * 0.12 +
      hiddenGemPresence * 0.05 +
      currentRelevance * 0.08 +
      districtPlausibility * 0.16 +
      roleDiscipline * 0.16 -
      syntheticPenalty,
  )
  return {
    stops,
    score,
    anchorAuthority,
    startQuality,
    landingQuality,
    hiddenGemPresence,
    currentRelevance,
    districtPlausibility,
    roleDiscipline,
  }
}

function dedupeByVenueId(candidates: StopTypeCandidate[]): StopTypeCandidate[] {
  const seen = new Set<string>()
  const deduped: StopTypeCandidate[] = []
  for (const candidate of candidates) {
    if (seen.has(candidate.venueId)) {
      continue
    }
    deduped.push(candidate)
    seen.add(candidate.venueId)
  }
  return deduped
}

function buildStopTypePools(
  board: StopTypeCandidateBoard,
  requiredStopTypes: StopType[],
): Record<StopType, StopTypeCandidate[]> {
  const pools = {} as Record<StopType, StopTypeCandidate[]>
  for (const stopType of requiredStopTypes) {
    pools[stopType] = dedupeByVenueId(board.candidatesByStopType[stopType] ?? []).slice(0, 5)
  }
  return pools
}

function hasAnyMissingPool(
  requiredStopTypes: StopType[],
  pools: Record<StopType, StopTypeCandidate[]>,
): StopType[] {
  return requiredStopTypes.filter((stopType) => pools[stopType].length === 0)
}

function buildCandidateNightCombinations(params: {
  scenarioFamily: ScenarioFamily
  requiredStopTypes: StopType[]
  pools: Record<StopType, StopTypeCandidate[]>
}): CandidateNight[] {
  const { scenarioFamily, requiredStopTypes, pools } = params
  const candidateNights: CandidateNight[] = []
  const stopCount = requiredStopTypes.length

  function rankCandidateCoherence(
    candidate: StopTypeCandidate,
    selectedStops: BuiltScenarioStop[],
    index: number,
  ): number {
    const district = normalizeToken(candidate.district ?? '')
    if (!district || selectedStops.length === 0) {
      return 0
    }
    const selectedDistricts = selectedStops
      .map((stop) => normalizeToken(stop.district ?? ''))
      .filter(Boolean)
    const previousDistrict = selectedDistricts[selectedDistricts.length - 1]
    const districtCounts = selectedDistricts.reduce<Record<string, number>>((acc, entry) => {
      acc[entry] = (acc[entry] ?? 0) + 1
      return acc
    }, {})
    const dominantDistrict = Object.entries(districtCounts)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0]
    let boost = 0
    if (district === previousDistrict) {
      boost += 0.2
    }
    if (district === dominantDistrict) {
      boost += index >= 2 ? 0.24 : 0.14
    }
    return boost
  }

  function walk(
    index: number,
    selectedStops: BuiltScenarioStop[],
    usedVenueIds: Set<string>,
  ): void {
    if (index >= stopCount) {
      candidateNights.push(getCandidateNightScore(scenarioFamily, selectedStops))
      return
    }
    const stopType = requiredStopTypes[index]
    const position = POSITION_BY_INDEX[index] ?? 'mid'
    const pool = pools[stopType]
    const nonDuplicateFirst = pool.filter((candidate) => !usedVenueIds.has(candidate.venueId))
    const fallbackDuplicates = pool.filter((candidate) => usedVenueIds.has(candidate.venueId))
    const orderedPool = (nonDuplicateFirst.length > 0 ? nonDuplicateFirst : fallbackDuplicates)
      .slice()
      .sort((left, right) => {
        const rightScore =
          rankCandidateCoherence(right, selectedStops, index) +
          (right.roleFit[position === 'highlight' ? 'highlight' : position === 'start' || position === 'mid' ? 'start' : 'windDown'] ?? 0) * 0.16
        const leftScore =
          rankCandidateCoherence(left, selectedStops, index) +
          (left.roleFit[position === 'highlight' ? 'highlight' : position === 'start' || position === 'mid' ? 'start' : 'windDown'] ?? 0) * 0.16
        if (rightScore !== leftScore) {
          return rightScore - leftScore
        }
        return left.venueId.localeCompare(right.venueId)
      })
    const nonSyntheticPool = orderedPool.filter((candidate) => !isSyntheticName(candidate.name))
    const identityPool = nonSyntheticPool.length > 0 ? nonSyntheticPool : orderedPool
    const strictRoleCandidates = identityPool.filter((candidate) => {
      const stop = toBuiltStop(candidate, position)
      return getRoleFitScore(stop) >= getRoleFitThreshold(scenarioFamily, position)
    })
    const walkPool = strictRoleCandidates.length > 0 ? strictRoleCandidates : identityPool
    for (const candidate of walkPool) {
      const stop = toBuiltStop(candidate, position)
      const nextUsed = new Set(usedVenueIds)
      nextUsed.add(candidate.venueId)
      walk(index + 1, [...selectedStops, stop], nextUsed)
    }
  }

  walk(0, [], new Set<string>())
  return candidateNights
}

function overlapScore(left: CandidateNight, right: CandidateNight): number {
  const leftVenues = new Set(left.stops.map((stop) => stop.venueId))
  const rightVenues = new Set(right.stops.map((stop) => stop.venueId))
  const sharedVenues = [...leftVenues].filter((venueId) => rightVenues.has(venueId)).length
  const sharedDistricts =
    new Set(left.stops.map((stop) => normalizeToken(stop.district ?? ''))).size > 0 &&
    new Set(right.stops.map((stop) => normalizeToken(stop.district ?? ''))).size > 0
      ? left.stops.filter((stop, index) => {
          const rightStop = right.stops[index]
          return normalizeToken(stop.district ?? '') === normalizeToken(rightStop?.district ?? '')
        }).length
      : 0
  const baseline = Math.max(1, Math.max(left.stops.length, right.stops.length))
  return clamp01((sharedVenues / baseline) * 0.78 + (sharedDistricts / baseline) * 0.22)
}

function sharedVenueCount(left: CandidateNight, right: CandidateNight): number {
  const leftVenues = new Set(left.stops.map((stop) => stop.venueId))
  const rightVenues = new Set(right.stops.map((stop) => stop.venueId))
  return [...leftVenues].filter((venueId) => rightVenues.has(venueId)).length
}

function selectDistinctNights(
  candidates: CandidateNight[],
  targetCount: number,
): CandidateNight[] {
  if (candidates.length <= targetCount) {
    return candidates
  }
  const sorted = candidates
    .slice()
    .sort((left, right) => right.score - left.score || getHighlightStopName(left).localeCompare(getHighlightStopName(right)))
  const selected: CandidateNight[] = []
  if (sorted.length > 0) {
    selected.push(sorted[0])
  }

  while (selected.length < targetCount) {
    const remaining = sorted.filter((candidate) => !selected.includes(candidate))
    if (remaining.length === 0) {
      break
    }
    const scoredRemaining = remaining
      .map((candidate) => {
        const maxOverlap = selected.reduce(
          (max, existing) => Math.max(max, overlapScore(candidate, existing)),
          0,
        )
        const maxSharedVenues = selected.reduce(
          (max, existing) => Math.max(max, sharedVenueCount(candidate, existing)),
          0,
        )
        const blockedAsNearDuplicate = maxSharedVenues >= 4
        const adjusted = candidate.score - maxOverlap * 0.22 - (blockedAsNearDuplicate ? 0.5 : 0)
        return { candidate, adjusted, blockedAsNearDuplicate, maxOverlap }
      })
      .sort((left, right) => {
        if (right.adjusted !== left.adjusted) {
          return right.adjusted - left.adjusted
        }
        if (right.maxOverlap !== left.maxOverlap) {
          return left.maxOverlap - right.maxOverlap
        }
        return right.candidate.score - left.candidate.score
      })
    const next = scoredRemaining.find((entry) => !entry.blockedAsNearDuplicate)
    if (next) {
      selected.push(next.candidate)
      continue
    }
    if (selected.length >= 2) {
      break
    }
    selected.push(scoredRemaining[0].candidate)
  }
  return selected.slice(0, targetCount)
}

function ensureHiddenGemVariant(
  selected: CandidateNight[],
  allCandidates: CandidateNight[],
): CandidateNight[] {
  if (selected.length <= 1) {
    return selected
  }
  const hasHiddenGemLean = selected.some((night) => night.hiddenGemPresence >= 0.45)
  if (hasHiddenGemLean) {
    return selected
  }
  const hiddenGemCandidate = allCandidates
    .filter((night) => night.hiddenGemPresence >= 0.45)
    .sort((left, right) => right.score - left.score || getHighlightStopName(left).localeCompare(getHighlightStopName(right)))[0]
  if (!hiddenGemCandidate) {
    return selected
  }
  const weakestIndex = selected
    .map((night, index) => ({ index, score: night.score }))
    .sort((left, right) => left.score - right.score)[0]?.index
  if (weakestIndex == null) {
    return selected
  }
  const next = selected.slice()
  next[weakestIndex] = hiddenGemCandidate
  return next
}

function getIntentRight(scenarioFamily: ScenarioFamily, stop: BuiltScenarioStop): boolean {
  const reasonCorpus = normalizeToken([stop.name, stop.whyThisStop, ...stop.reasons].join(' '))
  if (scenarioFamily === 'romantic_cozy') {
    return (
      stop.isHiddenGem === true ||
      stop.authorityScore >= 0.56 ||
      reasonCorpus.includes('cozy') ||
      reasonCorpus.includes('intimate') ||
      reasonCorpus.includes('atmospheric')
    )
  }
  if (scenarioFamily === 'romantic_lively') {
    return (
      Math.max(stop.liveNightlifePotential ?? 0, stop.eventPotential ?? 0, stop.performancePotential ?? 0) >= 0.5 ||
      stop.currentRelevance >= 0.55 ||
      reasonCorpus.includes('nightlife') ||
      reasonCorpus.includes('performance') ||
      reasonCorpus.includes('cocktail')
    )
  }
  if (scenarioFamily === 'friends_lively') {
    return (
      Math.max(stop.liveNightlifePotential ?? 0, stop.eventPotential ?? 0, stop.performancePotential ?? 0) >= 0.48 ||
      stop.currentRelevance >= 0.52 ||
      reasonCorpus.includes('group') ||
      reasonCorpus.includes('activity') ||
      reasonCorpus.includes('energy')
    )
  }
  if (scenarioFamily === 'friends_cozy' || scenarioFamily === 'family_cozy') {
    return (
      stop.authorityScore >= 0.5 ||
      stop.currentRelevance >= 0.44 ||
      reasonCorpus.includes('casual') ||
      reasonCorpus.includes('easy') ||
      reasonCorpus.includes('neighborhood') ||
      reasonCorpus.includes('family')
    )
  }
  if (scenarioFamily === 'family_lively') {
    return (
      Math.max(stop.eventPotential ?? 0, stop.performancePotential ?? 0) >= 0.46 ||
      stop.authorityScore >= 0.52 ||
      reasonCorpus.includes('active') ||
      reasonCorpus.includes('outdoor') ||
      reasonCorpus.includes('group')
    )
  }
  if (scenarioFamily === 'family_cultured') {
    if (stop.stopType === 'debrief_stop') {
      return (
        stop.authorityScore >= 0.48 ||
        stop.currentRelevance >= 0.44 ||
        reasonCorpus.includes('debrief') ||
        reasonCorpus.includes('coffee') ||
        reasonCorpus.includes('conversation') ||
        reasonCorpus.includes('pause')
      )
    }
    if (stop.stopType === 'thematic_lunch') {
      return (
        stop.venueCategory === 'restaurant' ||
        stop.venueCategory === 'cafe' ||
        stop.authorityScore >= 0.5 ||
        reasonCorpus.includes('thematic') ||
        reasonCorpus.includes('regional') ||
        reasonCorpus.includes('lunch')
      )
    }
  }
  return (
    Math.max(stop.culturalAnchorPotential ?? 0, stop.performancePotential ?? 0) >= 0.48 ||
    stop.venueCategory === 'museum' ||
    reasonCorpus.includes('cultural') ||
    reasonCorpus.includes('museum') ||
    reasonCorpus.includes('institution')
  )
}

function getExpectedPositionForStop(
  scenarioFamily: ScenarioFamily,
  stopType: StopType,
): BuiltScenarioStopPosition {
  const familyStopTypes = getScenarioRequiredStopTypes(scenarioFamily)
  const familyIndex = familyStopTypes.findIndex((entry) => entry === stopType)
  if (familyIndex >= 0) {
    return POSITION_BY_INDEX[Math.min(familyIndex, POSITION_BY_INDEX.length - 1)] ?? 'mid'
  }
  return STOP_TYPE_POSITION_EXPECTATION[stopType]
}

function getPlaceRight(stop: BuiltScenarioStop, stops: BuiltScenarioStop[]): boolean {
  const districts = stops.map((entry) => normalizeToken(entry.district ?? '')).filter(Boolean)
  const district = normalizeToken(stop.district ?? '')
  if (!district) {
    return false
  }
  if (districts.length <= 2) {
    return true
  }
  const uniqueDistricts = new Set(districts)
  if (uniqueDistricts.size <= 3) {
    return true
  }
  const sharedCount = districts.filter((entry) => entry === district).length
  return sharedCount >= 2
}

function getMomentRight(stop: BuiltScenarioStop): boolean {
  if (stop.position === 'highlight') {
    return stop.authorityScore >= 0.6 || stop.currentRelevance >= 0.56
  }
  if (stop.position === 'windDown' || stop.position === 'closer') {
    return (
      stop.currentRelevance >= 0.46 ||
      stop.isHiddenGem === true ||
      Math.max(stop.lateNightPotential ?? 0, stop.liveNightlifePotential ?? 0) >= 0.46
    )
  }
  return stop.authorityScore >= 0.44 || stop.currentRelevance >= 0.4
}

export function evaluateBuiltScenarioStop(params: {
  scenarioFamily: ScenarioFamily
  stop: BuiltScenarioStop
  stops: BuiltScenarioStop[]
}): GreatStopEvaluation {
  const { scenarioFamily, stop, stops } = params
  const hasName = stop.name.trim().length >= 2 && !isSyntheticName(stop.name)
  const hasIdentityField = Boolean(stop.address?.trim() || stop.district?.trim() || stop.neighborhoodLabel?.trim())
  const isReal = Boolean(stop.venueId.trim()) && hasName && hasIdentityField

  const expectedPosition = getExpectedPositionForStop(scenarioFamily, stop.stopType)
  const roleFitScore = getRoleFitScore(stop)
  const roleFitThreshold = getRoleFitThreshold(scenarioFamily, stop.position)
  const isRoleRight = expectedPosition === stop.position && roleFitScore >= roleFitThreshold

  const isIntentRight = getIntentRight(scenarioFamily, stop)
  const isPlaceRight = getPlaceRight(stop, stops)
  const isMomentRight = getMomentRight(stop)

  const failedCriteria: GreatStopCriterion[] = []
  if (!isReal) failedCriteria.push('real')
  if (!isRoleRight) failedCriteria.push('role_right')
  if (!isIntentRight) failedCriteria.push('intent_right')
  if (!isPlaceRight) failedCriteria.push('place_right')
  if (!isMomentRight) failedCriteria.push('moment_right')

  const notes = failedCriteria.length > 0 ? [`failed ${failedCriteria.join(', ')}`] : undefined

  return {
    isReal,
    isRoleRight,
    isIntentRight,
    isPlaceRight,
    isMomentRight,
    failedCriteria,
    notes,
  }
}

export function evaluateBuiltScenarioNight(params: {
  scenarioFamily: ScenarioFamily
  stops: BuiltScenarioStop[]
}): BuiltScenarioNightEvaluation {
  const stopEvaluations = params.stops.map((stop) => {
    const evaluation = evaluateBuiltScenarioStop({
      scenarioFamily: params.scenarioFamily,
      stop,
      stops: params.stops,
    })
    return {
      venueId: stop.venueId,
      name: stop.name,
      evaluation,
    }
  })

  const failedStops = stopEvaluations
    .filter((entry) => entry.evaluation.failedCriteria.length > 0)
    .map((entry) => entry.venueId)

  return {
    stopEvaluations,
    passesGreatStopStandard: failedStops.length === 0,
    failedStops,
    notes:
      failedStops.length > 0
        ? [`${failedStops.length}/${params.stops.length} stops failed at least one Great Stop criterion.`]
        : ['All stops pass Great Stop criteria.'],
  }
}

export function buildScenarioNightsFromCandidateBoard(
  board: StopTypeCandidateBoard,
  options: BuilderOptions = {},
): BuiltScenarioNight[] {
  const minNights = Math.max(2, options.minNights ?? 3)
  const maxNights = Math.max(minNights, Math.min(4, options.maxNights ?? 4))
  const requiredStopTypes = board.requiredStopTypes
  const pools = buildStopTypePools(board, requiredStopTypes)
  const missingStopTypes = hasAnyMissingPool(requiredStopTypes, pools)
  if (missingStopTypes.length > 0) {
    return [
      {
        id: `built_${board.scenarioFamily}_incomplete`,
        city: board.city,
        persona: board.persona,
        vibe: board.vibe,
        scenarioFamily: board.scenarioFamily,
        title: `${SCENARIO_FLAVOR_LINE[board.scenarioFamily]} (incomplete)`,
        flavorLine: SCENARIO_FLAVOR_LINE[board.scenarioFamily],
        stops: [],
        whyThisWorks: 'Required stop-type candidates are missing for this scenario.',
        complete: false,
        missingStopTypes,
        evaluation: {
          stopEvaluations: [],
          passesGreatStopStandard: false,
          failedStops: missingStopTypes,
          notes: ['Cannot evaluate Great Stop quality because required stop-type candidates are missing.'],
        },
      },
    ]
  }

  const candidateNights = buildCandidateNightCombinations({
    scenarioFamily: board.scenarioFamily,
    requiredStopTypes,
    pools,
  })
  const coherentCandidates = candidateNights.filter((night) => night.districtPlausibility >= 0.66)
  const rankingPool =
    coherentCandidates.length >= Math.max(2, minNights) ? coherentCandidates : candidateNights
  const rankedCandidates = rankingPool
    .slice()
    .sort((left, right) => right.score - left.score || getHighlightStopName(left).localeCompare(getHighlightStopName(right)))

  const desiredCount =
    rankedCandidates.length >= maxNights
      ? maxNights
      : rankedCandidates.length >= minNights
        ? minNights
        : Math.max(1, rankedCandidates.length)

  let selected = selectDistinctNights(rankedCandidates, desiredCount)
  selected = ensureHiddenGemVariant(selected, rankedCandidates)

  return selected.map((night, index) => {
    const stopsWithContract = withPreviewContract(board.scenarioFamily, night.stops)
    const evaluation = evaluateBuiltScenarioNight({
      scenarioFamily: board.scenarioFamily,
      stops: stopsWithContract,
    })
    const evaluatedStops = stopsWithContract.map((stop, stopIndex) => {
      const stopEvaluation = evaluation.stopEvaluations[stopIndex]?.evaluation
      return {
        ...stop,
        evaluation: stopEvaluation,
      }
    })

    const highlight = evaluatedStops[2]
    return {
      id: `built_${board.scenarioFamily}_${index + 1}`,
      city: board.city,
      persona: board.persona,
      vibe: board.vibe,
      scenarioFamily: board.scenarioFamily,
      title: pickTitle(board.scenarioFamily, highlight?.name ?? 'local highlight'),
      flavorLine: SCENARIO_FLAVOR_LINE[board.scenarioFamily],
      stops: evaluatedStops,
      whyThisWorks: getWhyThisWorks(evaluatedStops),
      complete: true,
      evaluation,
    }
  })
}
