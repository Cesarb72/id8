import { curatedVenues } from '../../data/venues'
import type { ContractConstraints } from '../types/intent'
import type { EngineSourceMode } from '../types/sourceMode'
import { dedupeStringIds } from '../utils/dedupeStringIds'
import type {
  BuiltScenarioNight,
  BuiltScenarioStop,
  BuiltScenarioStopPosition,
  StarterSemanticRepresentation,
} from './construction/scenarioBuilder'
import { devGreatStopFixtureVenueIds } from '../sources/devGreatStopFixtures'

export type CityOpportunityStopOption = {
  venueId: string
  name: string
  address?: string
  reason: string
  isOpenNow?: boolean
  score?: number
}

export type CityOpportunityHappening = {
  id: string
  name: string
  type?: string
  timingLabel?: string
  timeWindowLabel?: string
  reason: string
  strength?: number
  hasEvent?: boolean
  hasPerformance?: boolean
  hasHappyHour?: boolean
}

export type BuiltScenarioPreviewStop = {
  venueId: string
  name: string
  position: BuiltScenarioStop['position']
  stopType: BuiltScenarioStop['stopType']
  momentLabel: string
  whyThisStop: string
  whyTonight?: string
  address?: string
  district?: string
  neighborhoodLabel?: string
  venueTypeLabel?: string
  factualSummary?: string
  venueFeatures?: string[]
  serviceOptions?: string[]
  sourceType?: BuiltScenarioStop['sourceType']
  evaluation?: BuiltScenarioStop['evaluation']
}

export type BuiltScenarioNightPreviewModel = {
  nightId: string
  title: string
  flavorLine: string
  whyThisWorks: string
  evaluation?: BuiltScenarioNight['evaluation']
  starterSemanticRepresentation?: StarterSemanticRepresentation
  stops: BuiltScenarioPreviewStop[]
}

export type VerifiedCityOpportunity = {
  id: string
  sourceMode: EngineSourceMode
  flavor: string
  anchor: {
    venueId: string
    name: string
    address?: string
    district: string
    sourceType?: 'venue' | 'event' | 'hybrid'
    isOpenNow?: boolean
    timingLabel?: string
    verificationReasons: string[]
  }
  starts: CityOpportunityStopOption[]
  highlightAlternates?: CityOpportunityStopOption[]
  closes: CityOpportunityStopOption[]
  nearbyHappenings: CityOpportunityHappening[]
  districtContext: {
    primaryDistrict: string
    secondaryDistricts?: string[]
  }
  fit: {
    persona: string
    vibe: string
    confidenceLine: string
    matchLine?: string
  }
  storySpine: {
    start: string
    highlight: string
    windDown: string
  }
  selection: {
    pocketId?: string
    directionId?: string
  }
  survivorSignals: {
    whyTonightStrength: number
    cozyAuthorityStrength: number
    highWhyTonight: boolean
    highCozyAuthority: boolean
  }
  excellence: {
    score: number
    threshold: number
    passes: boolean
    anchorStrength: number
    startQuality: number
    windDownQuality: number
    supportCoherence: number
    scenarioAlignment: number
    experienceAlignment: number
    localAuthority: number
    modeExcellence: number
  }
  whyTonightProofLine?: string
  scenarioWindDownDebug?: {
    originalVenueId: string | null
    originalName: string | null
    originalRoleEligible: boolean
    repairApplied: boolean
    repairReplacementVenueId: string | null
    repairReplacementName: string | null
    repairSource: string | null
    repairReason: string | null
    finalVenueId: string | null
    finalName: string | null
    finalRoleEligible: boolean
  }
  starterSemanticRepresentation?: StarterSemanticRepresentation
  scenarioNight?: BuiltScenarioNight
  scenarioPreviewModel?: BuiltScenarioNightPreviewModel
}

interface ScenarioDirectionCardHint {
  id: string
  debugMeta?: {
    pocketId?: string
    confidence?: number
  }
}

export function mapBuiltScenarioNightToVerifiedOpportunity(params: {
  night: BuiltScenarioNight
  districtDiscoveryCards: Array<{ id: string; name: string }>
  directionCards: ScenarioDirectionCardHint[]
  personaLabel: string
  vibeLabel: string
  expandedProjection?: boolean
  contractConstraints?: ContractConstraints
}): VerifiedCityOpportunity | null {
  const {
    night,
    districtDiscoveryCards,
    directionCards,
    personaLabel,
    vibeLabel,
    expandedProjection = false,
    contractConstraints,
  } = params
  if (!night.complete || night.stops.length === 0) {
    return null
  }
  const firstStop = night.stops[0]
  const highlightStop = getScenarioHighlightStop(night) ?? firstStop
  const dominantDistrict =
    highlightStop.district ??
    getDominantScenarioDistrict(night) ??
    districtDiscoveryCards[0]?.name ??
    'San Jose'
  const resolvedWindDown = resolveScenarioWindDownSelection({
    night,
    primaryDistrict: dominantDistrict,
    contractConstraints,
  })
  const windDownStop = resolvedWindDown.finalStop ?? resolvedWindDown.originalStop
  if (!highlightStop || !windDownStop) {
    return null
  }
  const secondaryDistricts = uniqueStopNames(
    night.stops
      .map((stop) => stop.district)
      .filter((entry) => !hasLoosePhraseMatch(entry ?? '', dominantDistrict)),
  ).slice(0, 2)
  const startProjectionStops = expandedProjection
    ? night.stops.filter((stop) => stop.position === 'start' || stop.position === 'mid').slice(0, 4)
    : [firstStop]
  const closeProjectionStops = expandedProjection
    ? dedupeStringIds([
        windDownStop.venueId,
        ...night.stops
          .filter((stop) => stop.position === 'windDown' || stop.position === 'closer')
          .map((stop) => stop.venueId),
      ])
        .map(
          (venueId) =>
            [windDownStop, ...night.stops].find((stop) => stop.venueId === venueId) ?? null,
        )
        .filter((stop): stop is BuiltScenarioStop => Boolean(stop))
        .slice(0, 4)
    : [windDownStop]
  const starts: CityOpportunityStopOption[] = startProjectionStops.map((stop) => ({
    venueId: stop.venueId,
    name: stop.name,
    address: stop.address,
    reason: stop.whyThisStop || stop.reasons[0] || 'Strong scenario start.',
    score: clampScore(stop.authorityScore * 0.62 + stop.currentRelevance * 0.38),
  }))
  const closes: CityOpportunityStopOption[] = closeProjectionStops.map((stop) => ({
    venueId: stop.venueId,
    name: stop.name,
    address: stop.address,
    reason: stop.whyThisStop || stop.reasons[0] || 'Strong scenario landing.',
    score: clampScore(stop.authorityScore * 0.58 + stop.currentRelevance * 0.42),
  }))
  const highlightAlternates: CityOpportunityStopOption[] | undefined = expandedProjection
    ? night.stops
        .filter((stop) => stop.venueId !== highlightStop.venueId)
        .sort((left, right) => {
          const leftScore = left.roleFit.highlight ?? 0
          const rightScore = right.roleFit.highlight ?? 0
          if (rightScore !== leftScore) {
            return rightScore - leftScore
          }
          return left.name.localeCompare(right.name)
        })
        .slice(0, 4)
        .map((stop) => ({
          venueId: stop.venueId,
          name: stop.name,
          address: stop.address,
          reason: stop.whyThisStop || stop.reasons[0] || 'Strong scenario centerpiece option.',
          score: clampScore((stop.roleFit.highlight ?? 0) * 0.68 + stop.currentRelevance * 0.32),
        }))
    : undefined
  const whyTonightStrength = clampScore(
    night.stops.reduce((sum, stop) => sum + stop.currentRelevance, 0) /
      Math.max(1, night.stops.length),
  )
  const cozyAuthorityStrength = clampScore(
    highlightStop.authorityScore * 0.74 + (highlightStop.isHiddenGem ? 0.18 : 0.08),
  )
  const selection = buildScenarioSelectionContext({
    night,
    districtDiscoveryCards,
    directionCards,
  })

  return {
    id: `step2_scenario_${night.id}`,
    sourceMode: 'bootstrap',
    flavor: night.flavorLine,
    anchor: {
      venueId: highlightStop.venueId,
      name: highlightStop.name,
      address: highlightStop.address,
      district: highlightStop.district ?? dominantDistrict,
      sourceType: highlightStop.sourceType,
      verificationReasons: highlightStop.reasons.slice(0, 2),
    },
    starts,
    highlightAlternates,
    closes,
    nearbyHappenings: [],
    districtContext: {
      primaryDistrict: dominantDistrict,
      secondaryDistricts: secondaryDistricts.length > 0 ? secondaryDistricts : undefined,
    },
    fit: {
      persona: personaLabel,
      vibe: vibeLabel,
      confidenceLine: night.whyThisWorks,
      matchLine: night.title,
    },
    storySpine: {
      start: firstStop.name,
      highlight: highlightStop.name,
      windDown: windDownStop.name,
    },
    selection,
    survivorSignals: {
      whyTonightStrength,
      cozyAuthorityStrength,
      highWhyTonight: whyTonightStrength >= 0.64,
      highCozyAuthority: cozyAuthorityStrength >= 0.62,
    },
    excellence: {
      score: clampScore(highlightStop.authorityScore * 0.52 + whyTonightStrength * 0.48),
      threshold: 0.62,
      passes: true,
      anchorStrength: highlightStop.authorityScore,
      startQuality: starts[0]?.score ?? 0.62,
      windDownQuality: closes[0]?.score ?? 0.62,
      supportCoherence: 0.78,
      scenarioAlignment: 0.84,
      experienceAlignment: 0.82,
      localAuthority: highlightStop.authorityScore,
      modeExcellence: 0.8,
    },
    whyTonightProofLine: buildScenarioCanonicalWhyTonightProofLine(night),
    scenarioWindDownDebug: {
      originalVenueId: resolvedWindDown.originalStop?.venueId ?? null,
      originalName: resolvedWindDown.originalStop?.name ?? null,
      originalRoleEligible: isBuiltScenarioStopRoleEligibleForWindDown({
        stop: resolvedWindDown.originalStop,
        contractConstraints,
      }),
      repairApplied: resolvedWindDown.repairApplied,
      repairReplacementVenueId: resolvedWindDown.repairReplacement?.venueId ?? null,
      repairReplacementName: resolvedWindDown.repairReplacement?.name ?? null,
      repairSource: resolvedWindDown.repairSource,
      repairReason: resolvedWindDown.repairReason,
      finalVenueId: resolvedWindDown.finalStop?.venueId ?? windDownStop.venueId,
      finalName: resolvedWindDown.finalStop?.name ?? windDownStop.name,
      finalRoleEligible: isBuiltScenarioStopRoleEligibleForWindDown({
        stop: resolvedWindDown.finalStop ?? windDownStop,
        contractConstraints,
      }),
    },
    starterSemanticRepresentation: night.starterSemanticRepresentation,
    scenarioNight: night,
    scenarioPreviewModel: mapBuiltScenarioNightToPreviewModel(night),
  }
}

function getScenarioStopByPosition(
  night: BuiltScenarioNight,
  position: BuiltScenarioStopPosition,
): BuiltScenarioStop | undefined {
  return night.stops.find((stop) => stop.position === position)
}

function getScenarioHighlightStop(night: BuiltScenarioNight): BuiltScenarioStop | undefined {
  return (
    getScenarioStopByPosition(night, 'highlight') ??
    night.stops[Math.min(2, Math.max(0, night.stops.length - 1))]
  )
}

function getDominantScenarioDistrict(night: BuiltScenarioNight): string | undefined {
  const counts = new Map<string, { label: string; count: number }>()
  for (const stop of night.stops) {
    const district = stop.district?.trim()
    if (!district) {
      continue
    }
    const key = normalizeQualityText(district)
    const current = counts.get(key)
    if (current) {
      current.count += 1
    } else {
      counts.set(key, { label: district, count: 1 })
    }
  }
  return [...counts.values()].sort(
    (left, right) => right.count - left.count || left.label.localeCompare(right.label),
  )[0]?.label
}

function mapBuiltScenarioStopToPreviewStop(stop: BuiltScenarioStop): BuiltScenarioPreviewStop {
  return {
    venueId: stop.venueId,
    name: stop.name,
    position: stop.position,
    stopType: stop.stopType,
    momentLabel: stop.momentLabel,
    whyThisStop: stop.whyThisStop,
    whyTonight: stop.whyTonight,
    address: stop.address,
    district: stop.district,
    neighborhoodLabel: stop.neighborhoodLabel,
    venueTypeLabel: stop.venueTypeLabel,
    factualSummary: stop.factualSummary,
    venueFeatures: stop.venueFeatures,
    serviceOptions: stop.serviceOptions,
    sourceType: stop.sourceType,
    evaluation: stop.evaluation,
  }
}

function mapBuiltScenarioNightToPreviewModel(
  night: BuiltScenarioNight,
): BuiltScenarioNightPreviewModel {
  return {
    nightId: night.id,
    title: night.title,
    flavorLine: night.flavorLine,
    whyThisWorks: night.whyThisWorks,
    evaluation: night.evaluation,
    starterSemanticRepresentation: night.starterSemanticRepresentation,
    stops: night.stops.map(mapBuiltScenarioStopToPreviewStop),
  }
}

function buildScenarioCanonicalWhyTonightProofLine(
  night: BuiltScenarioNight,
): string | undefined {
  const directStopSignal = night.stops.find((stop) => Boolean(stop.whyTonight))?.whyTonight
  if (directStopSignal) {
    return directStopSignal
  }
  if (night.evaluation?.passesGreatStopStandard === false) {
    return night.evaluation.notes?.[0]
  }
  return undefined
}

function buildScenarioSelectionContext(params: {
  night: BuiltScenarioNight
  districtDiscoveryCards: Array<{ id: string; name: string }>
  directionCards: ScenarioDirectionCardHint[]
}): { pocketId?: string; directionId?: string } {
  const { night, districtDiscoveryCards, directionCards } = params
  const highlightDistrict = getScenarioHighlightStop(night)?.district
  const dominantDistrict = getDominantScenarioDistrict(night)
  const districtHint = highlightDistrict ?? dominantDistrict
  if (!districtHint) {
    return {}
  }
  const matchedDistrict = districtDiscoveryCards.find((entry) =>
    hasLoosePhraseMatch(entry.name, districtHint),
  )
  if (!matchedDistrict) {
    return {}
  }
  const fallbackDirection = directionCards
    .filter((entry) => {
      const pocketId = entry.debugMeta?.pocketId ?? entry.id
      return pocketId === matchedDistrict.id
    })
    .sort((left, right) => {
      const leftScore = left.debugMeta?.confidence ?? 0
      const rightScore = right.debugMeta?.confidence ?? 0
      if (rightScore !== leftScore) {
        return rightScore - leftScore
      }
      return left.id.localeCompare(right.id)
    })[0]
  return {
    pocketId: matchedDistrict.id,
    directionId: fallbackDirection?.id,
  }
}

function isScenarioWindDownPreferredCategory(
  category: BuiltScenarioStop['venueCategory'],
): boolean {
  return (
    category === 'restaurant' ||
    category === 'bar' ||
    category === 'cafe' ||
    category === 'dessert'
  )
}

function isScenarioWindDownDisallowedCategory(
  category: BuiltScenarioStop['venueCategory'],
): boolean {
  return (
    category === 'event' ||
    category === 'museum' ||
    category === 'activity' ||
    category === 'live_music'
  )
}

function isBuiltScenarioStopRoleEligibleForWindDown(params: {
  stop: BuiltScenarioStop | undefined
  contractConstraints?: ContractConstraints
}): boolean {
  const { stop, contractConstraints } = params
  if (!stop) {
    return false
  }
  const category =
    stop.venueCategory ?? curatedVenues.find((venue) => venue.id === stop.venueId)?.category
  const roleFitWindDown = stop.roleFit.windDown ?? 0
  const roleFitHighlight = stop.roleFit.highlight ?? 0
  const isPreferredCategory = isScenarioWindDownPreferredCategory(category)
  if (isScenarioWindDownDisallowedCategory(category)) {
    return false
  }
  if (stop.sourceType === 'event') {
    return false
  }
  if ((stop.eventPotential ?? 0) >= 0.58 || (stop.performancePotential ?? 0) >= 0.66) {
    return false
  }
  if (roleFitWindDown < 0.5) {
    return false
  }
  if (!isPreferredCategory && roleFitWindDown < 0.62) {
    return false
  }
  if (roleFitHighlight >= roleFitWindDown + 0.12) {
    return false
  }
  if (
    contractConstraints?.windDownStrictness === 'soft_required' &&
    roleFitWindDown < (isPreferredCategory ? 0.56 : 0.64)
  ) {
    return false
  }
  return true
}

function scoreBuiltScenarioStopForWindDown(params: {
  stop: BuiltScenarioStop
  sameNightFixture: boolean
  sameDistrictFixture: boolean
}): number {
  const { stop, sameNightFixture, sameDistrictFixture } = params
  const category =
    stop.venueCategory ?? curatedVenues.find((venue) => venue.id === stop.venueId)?.category
  let score = stop.roleFit.windDown ?? 0
  if (sameNightFixture) {
    score += 0.3
  } else if (sameDistrictFixture) {
    score += 0.18
  }
  if (stop.position === 'closer') {
    score += 0.08
  } else if (stop.position === 'windDown') {
    score += 0.12
  }
  if (isScenarioWindDownPreferredCategory(category)) {
    score += 0.08
  }
  if (stop.currentRelevance >= 0.6) {
    score += 0.03
  }
  if (stop.authorityScore >= 0.6) {
    score += 0.02
  }
  return score
}

function buildScenarioWindDownFallbackStop(params: {
  venueId: string
  primaryDistrict: string
}): BuiltScenarioStop | null {
  const venue = curatedVenues.find((entry) => entry.id === params.venueId)
  if (!venue) {
    return null
  }
  return {
    position: 'closer',
    stopType: 'nightcap',
    venueId: venue.id,
    name: venue.name,
    address: undefined,
    district: venue.neighborhood || params.primaryDistrict,
    neighborhoodLabel: venue.neighborhood,
    venueTypeLabel: venue.subcategory,
    sourceType: 'venue',
    factualSummary: venue.shortDescription,
    venueFeatures: undefined,
    serviceOptions: undefined,
    isHiddenGem: venue.isHiddenGem,
    authorityScore: venue.localSignals.localFavoriteScore,
    currentRelevance: 0.56,
    reasons: [venue.narrativeFlavor || venue.shortDescription || 'Valid wind-down fallback.'],
    momentLabel: 'Repaired wind-down landing',
    whyThisStop: venue.narrativeFlavor || venue.shortDescription || 'Valid wind-down fallback.',
    whyTonight: undefined,
    venueCategory: venue.category,
    venueSubcategory: venue.subcategory,
    sourceTypes: venue.tags,
    roleFit: {
      windDown: venue.roleAffinity.cooldown,
      highlight: venue.roleAffinity.peak,
      start: venue.roleAffinity.warmup,
    },
    eventPotential: 0,
    performancePotential: 0,
    liveNightlifePotential: venue.category === 'bar' ? 0.32 : 0,
    culturalAnchorPotential: 0,
    lateNightPotential: venue.tags.some((tag) => tag.toLowerCase().includes('late')) ? 0.22 : 0,
    majorVenueStrength: 0,
    evaluation: undefined,
  }
}

function resolveScenarioWindDownSelection(params: {
  night: BuiltScenarioNight
  primaryDistrict: string
  contractConstraints?: ContractConstraints
}): {
  originalStop: BuiltScenarioStop | undefined
  finalStop: BuiltScenarioStop | null
  repairApplied: boolean
  repairReplacement: BuiltScenarioStop | null
  repairSource: string | null
  repairReason: string | null
} {
  const { night, primaryDistrict, contractConstraints } = params
  const originalStop =
    getScenarioStopByPosition(night, 'closer') ?? night.stops[night.stops.length - 1]
  const originalRoleEligible = isBuiltScenarioStopRoleEligibleForWindDown({
    stop: originalStop,
    contractConstraints,
  })
  if (originalRoleEligible && originalStop) {
    return {
      originalStop,
      finalStop: originalStop,
      repairApplied: false,
      repairReplacement: null,
      repairSource: null,
      repairReason: null,
    }
  }

  const highlightStop = getScenarioHighlightStop(night)
  const startStop = getScenarioStopByPosition(night, 'start') ?? night.stops[0]
  const blockedIds = new Set(
    [startStop?.venueId, highlightStop?.venueId].filter(
      (value): value is string => Boolean(value),
    ),
  )
  const fixtureIdSet = new Set(devGreatStopFixtureVenueIds)
  const eligibleSameNightFixture = night.stops
    .filter((stop) => fixtureIdSet.has(stop.venueId))
    .filter((stop) => !blockedIds.has(stop.venueId))
    .filter((stop) =>
      isBuiltScenarioStopRoleEligibleForWindDown({
        stop,
        contractConstraints,
      }),
    )
    .sort(
      (left, right) =>
        scoreBuiltScenarioStopForWindDown({
          stop: right,
          sameNightFixture: true,
          sameDistrictFixture: true,
        }) -
          scoreBuiltScenarioStopForWindDown({
            stop: left,
            sameNightFixture: true,
            sameDistrictFixture: true,
          }) || left.name.localeCompare(right.name),
    )
  if (eligibleSameNightFixture[0]) {
    return {
      originalStop,
      finalStop: eligibleSameNightFixture[0],
      repairApplied: true,
      repairReplacement: eligibleSameNightFixture[0],
      repairSource: 'same_scenario_fixture',
      repairReason: 'original_windDown_not_role_eligible',
    }
  }

  const eligibleDistrictFixture = devGreatStopFixtureVenueIds
    .map((venueId) => buildScenarioWindDownFallbackStop({ venueId, primaryDistrict }))
    .filter((stop): stop is BuiltScenarioStop => Boolean(stop))
    .filter((stop) => !blockedIds.has(stop.venueId))
    .filter(
      (stop) =>
        hasLoosePhraseMatch(stop.district ?? '', primaryDistrict) ||
        hasLoosePhraseMatch(stop.neighborhoodLabel ?? '', primaryDistrict),
    )
    .filter((stop) =>
      isBuiltScenarioStopRoleEligibleForWindDown({
        stop,
        contractConstraints,
      }),
    )
    .sort(
      (left, right) =>
        scoreBuiltScenarioStopForWindDown({
          stop: right,
          sameNightFixture: false,
          sameDistrictFixture: true,
        }) -
          scoreBuiltScenarioStopForWindDown({
            stop: left,
            sameNightFixture: false,
            sameDistrictFixture: true,
          }) || left.name.localeCompare(right.name),
    )
  if (eligibleDistrictFixture[0]) {
    return {
      originalStop,
      finalStop: eligibleDistrictFixture[0],
      repairApplied: true,
      repairReplacement: eligibleDistrictFixture[0],
      repairSource: 'same_district_fixture',
      repairReason: 'original_windDown_not_role_eligible',
    }
  }

  const eligibleSameNightSupport = night.stops
    .filter((stop) => !blockedIds.has(stop.venueId))
    .filter((stop) =>
      isBuiltScenarioStopRoleEligibleForWindDown({
        stop,
        contractConstraints,
      }),
    )
    .sort(
      (left, right) =>
        scoreBuiltScenarioStopForWindDown({
          stop: right,
          sameNightFixture: false,
          sameDistrictFixture: false,
        }) -
          scoreBuiltScenarioStopForWindDown({
            stop: left,
            sameNightFixture: false,
            sameDistrictFixture: false,
          }) || left.name.localeCompare(right.name),
    )
  if (eligibleSameNightSupport[0]) {
    return {
      originalStop,
      finalStop: eligibleSameNightSupport[0],
      repairApplied: true,
      repairReplacement: eligibleSameNightSupport[0],
      repairSource: 'same_scenario_support',
      repairReason: 'original_windDown_not_role_eligible',
    }
  }

  return {
    originalStop,
    finalStop: null,
    repairApplied: false,
    repairReplacement: null,
    repairSource: null,
    repairReason: 'no_role_eligible_windDown_available',
  }
}

function uniqueStopNames(names: Array<string | undefined>): string[] {
  const seen = new Set<string>()
  const ordered: string[] = []
  names.forEach((name) => {
    const trimmed = (name ?? '').trim()
    if (!trimmed) {
      return
    }
    const key = trimmed.toLowerCase()
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    ordered.push(trimmed)
  })
  return ordered
}

function normalizeQualityText(value: string | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasLoosePhraseMatch(value: string, phrase: string): boolean {
  const left = normalizeQualityText(value)
  const right = normalizeQualityText(phrase)
  if (!left || !right) {
    return false
  }
  return left.includes(right) || right.includes(left)
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(1, value))
}
