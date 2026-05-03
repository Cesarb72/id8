import type {
  TasteOpportunityAggregation,
  TasteOpportunityRoleCandidate,
} from './taste/aggregateTasteOpportunityFromVenues'
import { applyExperienceContractToAggregation } from './taste/applyExperienceContractToOpportunityAggregation'
import { applyScenarioContractToAggregation } from './taste/applyScenarioContractToOpportunityAggregation'
import type { ExperienceContract as InterpretationExperienceContract } from './contracts/experienceContract'
import {
  deriveStep2AuthoritySignals,
  type Step2AuthoritySignals,
} from './taste/step2AuthorityConviction'
import type { HospitalityScenarioContract } from './taste/scenarioContracts'
import type {
  CityOpportunityHappening,
  CityOpportunityStopOption,
  VerifiedCityOpportunity,
} from './verifiedCityOpportunity'

export interface LiveDistrictOpportunityBuilderEcsState {
  exploration: 'focused' | 'exploratory'
  discovery: 'reliable' | 'discover'
  highlight: 'casual' | 'standout'
}

export interface LiveDistrictOpportunityBuilderDistrictInput {
  id: string
  name: string
  matchSignal?: string
  tasteAggregation?: TasteOpportunityAggregation
}

export interface LiveDistrictOpportunityBuilderDirectionInput {
  id: string
  card: {
    title: string
  }
  debugMeta?: {
    confidence?: number
  }
}

export interface BuildLiveDistrictVerifiedCityOpportunityParams {
  district: LiveDistrictOpportunityBuilderDistrictInput
  directionCards: LiveDistrictOpportunityBuilderDirectionInput[]
  scenarioContract: HospitalityScenarioContract | null
  experienceContract: InterpretationExperienceContract | null
  ecsState: LiveDistrictOpportunityBuilderEcsState
  city: string
  persona: string
  vibe: string
  personaLabel: string
  vibeLabel: string
  roleProjectionDepth: number
  secondaryDistricts?: string[]
}

export interface ScoredVerifiedCityOpportunity {
  card: VerifiedCityOpportunity
  score: number
}

type AggregatedMoment = TasteOpportunityAggregation['moments']['primary'][number]
type AggregationMomentType = AggregatedMoment['momentType']
type AggregationRole = 'start' | 'highlight' | 'windDown'

type MomentVenueStats = {
  maxStrength: number
  anchor: number
  supporting: number
  temporal: number
  discovery: number
  community: number
}

export function buildLiveDistrictVerifiedCityOpportunity(
  params: BuildLiveDistrictVerifiedCityOpportunityParams,
): ScoredVerifiedCityOpportunity | null {
  const {
    district,
    directionCards,
    scenarioContract,
    experienceContract,
    ecsState,
    city,
    persona,
    vibe,
    personaLabel,
    vibeLabel,
    roleProjectionDepth,
    secondaryDistricts,
  } = params
  const representativeDirection = directionCards.slice().sort((left, right) => {
    const leftScore = left.debugMeta?.confidence ?? 0
    const rightScore = right.debugMeta?.confidence ?? 0
    if (rightScore !== leftScore) {
      return rightScore - leftScore
    }
    return left.id.localeCompare(right.id)
  })[0]
  const scenarioShapedAggregation = district.tasteAggregation
    ? applyScenarioContractToAggregation(district.tasteAggregation, scenarioContract)
    : undefined
  const experienceShapedAggregation = scenarioShapedAggregation
    ? applyExperienceContractToAggregation(scenarioShapedAggregation, experienceContract)
    : undefined
  const aggregation = experienceShapedAggregation
    ? applyExplorationControlsToAggregation(experienceShapedAggregation, ecsState)
    : undefined
  const anchorCandidate = aggregation?.anchors.strongestHighlight
  const hasRealAnchor = Boolean(anchorCandidate?.venueId && anchorCandidate.venueName)
  if (!hasRealAnchor) {
    return null
  }
  const startCandidates = aggregation?.ingredients.startCandidates ?? []
  const closeCandidates = aggregation?.ingredients.windDownCandidates ?? []
  const highlightCandidates = aggregation?.ingredients.highlightCandidates ?? []
  const hasSupportStructure = startCandidates.length > 0 || closeCandidates.length > 0
  if (!hasSupportStructure) {
    return null
  }

  const fallbackAnchorName =
    representativeDirection?.card.title ??
    aggregation?.ingredients.highlightCandidates[0]?.venueName ??
    district.name
  const anchorName = anchorCandidate?.venueName ?? fallbackAnchorName
  const confidenceLine = getNightOptionConfidenceLine(aggregation)
  const anchorMoment = getAnchorMoment(aggregation, anchorCandidate?.venueId)
  const starts = toCityOpportunityStopOptions(startCandidates, 'start', roleProjectionDepth)
  const closes = toCityOpportunityStopOptions(closeCandidates, 'windDown', roleProjectionDepth)
  const highlightAlternates = toCityOpportunityHighlightAlternates(
    highlightCandidates,
    anchorCandidate?.venueId,
    roleProjectionDepth,
  )
  const nearbyHappenings = getCityOpportunityHappenings(aggregation)
  const authoritySignals = buildCityOpportunityAuthoritySignals({
    aggregation,
    anchorMoment,
    starts,
    closes,
    happenings: nearbyHappenings,
    city,
    persona,
    vibe,
  })
  const whyTonightStrength = buildWhyTonightStrength({
    authoritySignals,
    happenings: nearbyHappenings,
    anchorMoment,
    aggregation,
  })
  const cozyAuthorityStrength = buildCozyAuthorityStrength({
    authoritySignals,
    anchorName,
    starts,
    closes,
    happenings: nearbyHappenings,
  })
  const highWhyTonight = whyTonightStrength >= 0.64
  const highCozyAuthority =
    isRomanticCozyMode({
      persona,
      vibe,
      scenarioContract,
    }) && cozyAuthorityStrength >= 0.62
  const whyTonightProofLine = buildWhyTonightProofLine({
    authoritySignals,
    whyTonightStrength,
    cozyAuthorityStrength,
    happenings: nearbyHappenings,
    scenarioContract,
  })
  const hasSupportStops = starts.length > 0 && closes.length > 0
  const verificationReasons = getVerifiedAnchorReasons({
    aggregation,
    anchorMoment,
    confidenceLine,
    hasSupportStops,
  })
  const card: VerifiedCityOpportunity = {
    id: `step2_city_opportunity_${district.id}`,
    flavor: getVerifiedOpportunityFlavor(
      aggregation,
      representativeDirection?.card.title ?? 'Intent-matched',
      scenarioContract,
    ),
    anchor: {
      venueId: anchorCandidate?.venueId ?? `anchor_${district.id}`,
      name: anchorName,
      district: district.name,
      sourceType: anchorMoment?.sourceType,
      timingLabel: getMomentTimingLabel(anchorMoment),
      verificationReasons,
    },
    starts,
    highlightAlternates: highlightAlternates.length > 0 ? highlightAlternates : undefined,
    closes,
    nearbyHappenings,
    districtContext: {
      primaryDistrict: district.name,
      secondaryDistricts:
        secondaryDistricts && secondaryDistricts.length > 0 ? secondaryDistricts : undefined,
    },
    fit: {
      persona: personaLabel,
      vibe: vibeLabel,
      confidenceLine,
      matchLine: district.matchSignal,
    },
    storySpine: {
      start: starts[0]?.name ?? anchorName,
      highlight: anchorName,
      windDown: closes[0]?.name ?? closeCandidates[0]?.venueName ?? starts[0]?.name ?? anchorName,
    },
    selection: {
      pocketId: district.id,
      directionId: representativeDirection?.id,
    },
    survivorSignals: {
      whyTonightStrength,
      cozyAuthorityStrength,
      highWhyTonight,
      highCozyAuthority,
    },
    excellence: {
      score: 0,
      threshold: 0,
      passes: false,
      anchorStrength: 0,
      startQuality: 0,
      windDownQuality: 0,
      supportCoherence: 0,
      scenarioAlignment: 0,
      experienceAlignment: 0,
      localAuthority: 0,
      modeExcellence: 0,
    },
    whyTonightProofLine,
  }
  const score = getCityOpportunitySurfaceScore({
    aggregation,
    anchorReasons: verificationReasons,
    anchorMoment,
    hasRealAnchor,
    starts,
    closes,
    happenings: nearbyHappenings,
    representativeDirection,
    ecsState,
    scenarioContract,
    experienceContract,
    city,
    persona,
    vibe,
    authoritySignalsOverride: authoritySignals,
  })
  const anchorBaseScore =
    aggregation?.anchors.strongestHighlight?.score ??
    aggregation?.ingredients.highlightCandidates[0]?.score ??
    0.44
  const anchorStrength = clampScore(
    anchorBaseScore * 0.58 + authoritySignals.anchorConviction * 0.42,
  )
  const startQuality = clampScore(
    getStopAverageScore(starts) * 0.58 +
      getRoleContractFitScore('start', starts, scenarioContract) * 0.22 +
      authoritySignals.startConviction * 0.2,
  )
  const windDownQuality = clampScore(
    getStopAverageScore(closes) * 0.54 +
      getRoleContractFitScore('windDown', closes, scenarioContract) * 0.22 +
      authoritySignals.windDownConviction * 0.24,
  )
  const scenarioAlignment = getScenarioAlignmentScore({
    contract: scenarioContract,
    aggregation,
    anchorName: aggregation?.anchors.strongestHighlight?.venueName ?? anchorName,
    anchorMoment,
    starts,
    closes,
    happenings: nearbyHappenings,
  })
  const experienceAlignment = getExperienceContractAlignmentScore({
    contract: experienceContract,
    aggregation,
    starts,
    closes,
    happenings: nearbyHappenings,
  })
  const supportCoherence = getStorySpineCoherenceScore({
    aggregation,
    anchorName: aggregation?.anchors.strongestHighlight?.venueName ?? anchorName,
    starts,
    closes,
    startQuality,
    windDownQuality,
  })
  const localAuthority = clampScore(
    authoritySignals.overallAuthority * 0.52 +
      authoritySignals.anchorConviction * 0.2 +
      authoritySignals.happeningAuthority * 0.12 +
      authoritySignals.whyTonightPressure * 0.16,
  )
  const modeExcellence = buildModeExcellenceStrength({
    scenarioContract,
    authoritySignals,
    whyTonightStrength,
    cozyAuthorityStrength,
    anchorName,
    starts,
    closes,
  })
  const excellenceThreshold = buildStep2ExcellenceThreshold({
    scenarioContract,
  })
  const excellenceScore = buildStep2ExcellenceScore({
    anchorStrength,
    startQuality,
    windDownQuality,
    supportCoherence,
    scenarioAlignment,
    experienceAlignment,
    localAuthority,
    whyTonightStrength,
    modeExcellence,
    existingSurfaceScore: score,
    scenarioContract,
  })
  const passesExcellence = isStep2ExcellenceCandidate({
    excellenceScore,
    threshold: excellenceThreshold,
    anchorStrength,
    startQuality,
    windDownQuality,
    supportCoherence,
    scenarioContract,
    modeExcellence,
  })
  card.excellence = {
    score: excellenceScore,
    threshold: excellenceThreshold,
    passes: passesExcellence,
    anchorStrength,
    startQuality,
    windDownQuality,
    supportCoherence,
    scenarioAlignment,
    experienceAlignment,
    localAuthority,
    modeExcellence,
  }
  return { card, score }
}

function getNightOptionConfidenceLine(
  aggregation: TasteOpportunityAggregation | undefined,
): string {
  if (!aggregation) {
    return 'Balanced movement with reliable route support'
  }
  const movement =
    aggregation.summary.movementProfile === 'tight'
      ? 'Tight movement'
      : aggregation.summary.movementProfile === 'spread'
        ? 'More open movement'
        : 'Balanced movement'
  const highlightConfidence =
    aggregation.summary.highlightPotential === 'high'
      ? 'high anchor confidence'
      : aggregation.summary.highlightPotential === 'medium'
        ? 'steady anchor confidence'
        : 'emerging anchor confidence'
  return `${movement} with ${highlightConfidence}`
}

function getNightOptionAnchorReason(
  aggregation: TasteOpportunityAggregation | undefined,
): string | undefined {
  const raw =
    aggregation?.anchors.strongestHighlight?.reason ??
    aggregation?.moments.primary[0]?.reason
  if (!raw) {
    return undefined
  }
  const normalized = raw.trim()
  if (!normalized) {
    return undefined
  }
  return normalized.charAt(0).toLowerCase() + normalized.slice(1)
}

function toLowerSentence(value: string): string {
  const normalized = value.trim()
  if (!normalized) {
    return ''
  }
  return normalized.charAt(0).toLowerCase() + normalized.slice(1)
}

function toSentenceCase(value: string): string {
  const normalized = value.trim()
  if (!normalized) {
    return ''
  }
  const sentence = normalized.charAt(0).toUpperCase() + normalized.slice(1)
  return sentence.endsWith('.') ? sentence : `${sentence}.`
}

function toConciseRoleReason(
  role: 'start' | 'windDown',
  rawReason: string | undefined,
  fallbackReason: string,
): string {
  const reason = (rawReason ?? '').toLowerCase()
  if (role === 'start') {
    if (reason.includes('easy') || reason.includes('entry')) {
      return 'easier opener'
    }
    if (reason.includes('conversation') || reason.includes('social')) {
      return 'social opener'
    }
    if (reason.includes('steady')) {
      return 'steady opener'
    }
    if (reason.includes('nearby')) {
      return 'nearby opener'
    }
    return fallbackReason
  }
  if (reason.includes('soft') || reason.includes('calm') || reason.includes('landing')) {
    return 'softer ending'
  }
  if (reason.includes('quiet')) {
    return 'quiet finish'
  }
  if (reason.includes('steady')) {
    return 'steady close'
  }
  if (reason.includes('nearby')) {
    return 'nearby close'
  }
  return fallbackReason
}

function getAnchorMoment(
  aggregation: TasteOpportunityAggregation | undefined,
  anchorVenueId: string | undefined,
): AggregatedMoment | undefined {
  if (!aggregation || !anchorVenueId) {
    return undefined
  }
  const pooled = [...aggregation.moments.primary, ...aggregation.moments.secondary]
  return pooled.find((moment) => moment.venueId === anchorVenueId)
}

function getMomentTimingLabel(moment: AggregatedMoment | undefined): string | undefined {
  if (!moment) {
    return undefined
  }
  const windowLabel = (moment.liveContext?.timeWindowLabel ?? '').toLowerCase()
  if (moment.liveContext?.hasHappyHour) {
    return 'Happy hour timing'
  }
  if (moment.liveContext?.hasPerformance) {
    return 'Performance timing'
  }
  if (windowLabel === 'late') {
    return 'Late-night relevant'
  }
  if (windowLabel === 'evening') {
    return 'Tonight relevant'
  }
  if (windowLabel === 'day') {
    return 'Day-to-evening option'
  }
  if (moment.momentType === 'temporal') {
    return 'Good right now'
  }
  return undefined
}

function getVerifiedOpportunityFlavor(
  aggregation: TasteOpportunityAggregation | undefined,
  fallbackLabel: string,
  scenarioContract: HospitalityScenarioContract | null,
): string {
  if (scenarioContract?.persona === 'romantic') {
    if (scenarioContract.vibe === 'cozy') {
      return 'Intimate romantic night'
    }
    if (scenarioContract.vibe === 'lively') {
      return 'Pulse-forward romantic night'
    }
    if (scenarioContract.vibe === 'cultured') {
      return 'Curated romantic night'
    }
  }
  const normalizedFallback = normalizeQualityText(fallbackLabel)
  if (normalizedFallback.includes('cultural') || normalizedFallback.includes('gallery')) {
    return 'Cultural-led night'
  }
  if (normalizedFallback.includes('live') || normalizedFallback.includes('lively')) {
    return 'Live-energy night'
  }
  if (aggregation?.summary.dominantEnergy === 'lively') {
    return 'Lively anchored night'
  }
  if (aggregation?.summary.dominantEnergy === 'calm') {
    return 'Calm anchored night'
  }
  return 'Intent-matched night'
}

function getVerifiedAnchorReasons(params: {
  aggregation: TasteOpportunityAggregation | undefined
  anchorMoment: AggregatedMoment | undefined
  confidenceLine: string
  hasSupportStops: boolean
}): string[] {
  const { aggregation, anchorMoment, confidenceLine, hasSupportStops } = params
  const reasons: string[] = []
  const canonicalReason = getCityOpportunityAnchorReason(aggregation)
  if (canonicalReason) {
    reasons.push(toSentenceCase(canonicalReason))
  }
  if (aggregation?.summary.highlightPotential === 'high') {
    reasons.push('High-confidence highlight nearby.')
  } else if (aggregation?.summary.highlightPotential === 'medium') {
    reasons.push('Reliable highlight with steady support.')
  }
  if (anchorMoment?.momentType === 'discovery') {
    reasons.push('Discovery-worthy anchor for tonight.')
  }
  if (anchorMoment?.momentType === 'temporal') {
    reasons.push('Timing-relevant anchor for tonight.')
  }
  if (anchorMoment?.momentType === 'community') {
    reasons.push('Community energy around this anchor.')
  }
  const timingLabel = getMomentTimingLabel(anchorMoment)
  if (timingLabel) {
    reasons.push(`${timingLabel}.`)
  }
  if (hasSupportStops) {
    reasons.push('Easy start and close nearby.')
  }
  if (reasons.length === 0) {
    reasons.push(toSentenceCase(confidenceLine))
  }
  return Array.from(new Set(reasons)).slice(0, 2)
}

function getCityOpportunityAnchorReason(
  aggregation: TasteOpportunityAggregation | undefined,
): string {
  const canonical = getNightOptionAnchorReason(aggregation)
  if (canonical) {
    return canonical
  }
  return 'strong central fit for your intent'
}

function toCityOpportunityStopOptions(
  candidates: TasteOpportunityRoleCandidate[] | undefined,
  role: 'start' | 'windDown',
  maxCount = 2,
): CityOpportunityStopOption[] {
  return (candidates ?? [])
    .slice(0, maxCount)
    .map((candidate) => ({
      venueId: candidate.venueId,
      name: candidate.venueName,
      reason: toConciseRoleReason(
        role,
        candidate.reason,
        role === 'start' ? 'easy opener' : 'softer ending',
      ),
      score: candidate.score,
    }))
    .filter((candidate) => candidate.name.trim().length > 0)
}

function toCityOpportunityHighlightAlternates(
  candidates: TasteOpportunityRoleCandidate[] | undefined,
  selectedAnchorVenueId: string | undefined,
  maxCount = 2,
): CityOpportunityStopOption[] {
  return (candidates ?? [])
    .filter((candidate) => candidate.venueId !== selectedAnchorVenueId)
    .slice(0, maxCount)
    .map((candidate) => ({
      venueId: candidate.venueId,
      name: candidate.venueName,
      reason: toLowerSentence(candidate.reason) || 'strong centerpiece option',
      score: candidate.score,
    }))
    .filter((candidate) => candidate.name.trim().length > 0)
}

function getCityOpportunityHappenings(
  aggregation: TasteOpportunityAggregation | undefined,
): CityOpportunityHappening[] {
  if (!aggregation) {
    return []
  }
  const priorityByType: Record<AggregatedMoment['momentType'], number> = {
    temporal: 5,
    discovery: 4,
    community: 3,
    supporting: 2,
    anchor: 1,
  }
  return [...aggregation.moments.primary, ...aggregation.moments.secondary]
    .filter((moment) => moment.momentType !== 'anchor' && moment.strength >= 0.6)
    .sort((left, right) => {
      const priorityDiff =
        (priorityByType[right.momentType] ?? 0) -
        (priorityByType[left.momentType] ?? 0)
      if (priorityDiff !== 0) {
        return priorityDiff
      }
      if (right.strength !== left.strength) {
        return right.strength - left.strength
      }
      return left.id.localeCompare(right.id)
    })
    .filter((moment, index, all) => all.findIndex((entry) => entry.title === moment.title) === index)
    .slice(0, 2)
    .map((moment) => ({
      id: moment.id,
      name: moment.title,
      type: moment.momentType,
      timingLabel: getMomentTimingLabel(moment),
      timeWindowLabel: moment.liveContext?.timeWindowLabel,
      strength: moment.strength,
      hasEvent: moment.liveContext?.hasEvent,
      hasPerformance: moment.liveContext?.hasPerformance,
      hasHappyHour: moment.liveContext?.hasHappyHour,
      reason:
        moment.momentType === 'temporal'
          ? 'timely nearby moment'
          : moment.momentType === 'discovery'
            ? 'discovery pull nearby'
            : moment.momentType === 'community'
              ? 'community energy nearby'
              : toLowerSentence(moment.reason) || 'relevant nearby moment',
    }))
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

function matchesScenarioVenue(name: string | undefined, venues: string[] | undefined): boolean {
  if (!name || !venues || venues.length === 0) {
    return false
  }
  return venues.some((entry) => hasLoosePhraseMatch(name, entry))
}

function toHighlightTierScore(tier: number | undefined, fallbackScore: number): number {
  if (tier === 1) {
    return 1
  }
  if (tier === 2) {
    return 0.72
  }
  if (tier === 3) {
    return 0.44
  }
  return clampScore(fallbackScore)
}

function toHighlightPotentialScore(
  value: TasteOpportunityAggregation['summary']['highlightPotential'] | undefined,
): number {
  if (value === 'high') {
    return 1
  }
  if (value === 'medium') {
    return 0.72
  }
  return 0.44
}

function toMovementTightnessScore(
  value: TasteOpportunityAggregation['summary']['movementProfile'] | undefined,
): number {
  if (value === 'tight') {
    return 1
  }
  if (value === 'moderate') {
    return 0.76
  }
  return 0.52
}

function toDiscoveryBalanceScore(
  value: TasteOpportunityAggregation['summary']['discoveryBalance'] | undefined,
): number {
  if (value === 'novel') {
    return 1
  }
  if (value === 'balanced') {
    return 0.68
  }
  return 0.42
}

function getStopAverageScore(options: CityOpportunityStopOption[]): number {
  if (options.length === 0) {
    return 0
  }
  const scored = options
    .slice(0, 2)
    .map((entry) => entry.score ?? 0.5)
  if (scored.length === 0) {
    return 0
  }
  return clampScore(scored.reduce((sum, value) => sum + value, 0) / scored.length)
}

function getRoleContractFitScore(
  role: 'start' | 'windDown',
  options: CityOpportunityStopOption[],
  contract: HospitalityScenarioContract | null,
): number {
  if (!contract) {
    return 0.56
  }
  const targetRule = contract.stopRules.find((rule) => rule.stopType === role)
  if (!targetRule) {
    return 0.56
  }
  if (options.length === 0) {
    return 0
  }
  const corpus = normalizeQualityText(
    options
      .slice(0, 2)
      .map((entry) => `${entry.name} ${entry.reason}`)
      .join(' '),
  )
  if (!corpus) {
    return 0
  }
  const candidateSignals = [targetRule.purpose, ...(targetRule.examples ?? [])]
  const matchedSignals = candidateSignals.filter((signal) => hasLoosePhraseMatch(corpus, signal)).length
  const baseMatch = candidateSignals.length > 0 ? matchedSignals / candidateSignals.length : 0

  const lexicalBoost =
    role === 'start'
      ? ['opener', 'entry', 'social', 'aperitivo', 'cocktail'].some((token) => corpus.includes(token))
        ? 0.16
        : 0
      : ['close', 'nightcap', 'late', 'quiet', 'soft', 'landing'].some((token) =>
            corpus.includes(token),
          )
        ? 0.16
        : 0

  return clampScore(baseMatch * 0.7 + lexicalBoost + 0.22)
}

function getHiddenGemPresenceScore(params: {
  contract: HospitalityScenarioContract | null
  anchorName: string | undefined
  starts: CityOpportunityStopOption[]
  closes: CityOpportunityStopOption[]
  happenings: CityOpportunityHappening[]
}): number {
  const { contract, anchorName, starts, closes, happenings } = params
  if (!contract) {
    return 0.5
  }
  const preferred = contract.hiddenGemRules.preferredHiddenGemVenues ?? []
  if (preferred.length === 0) {
    return 0.5
  }
  const surfaceNames = [
    anchorName ?? '',
    ...starts.slice(0, 2).map((entry) => entry.name),
    ...closes.slice(0, 2).map((entry) => entry.name),
    ...happenings.slice(0, 2).map((entry) => entry.name),
  ]
  const matches = surfaceNames.filter((name) => matchesScenarioVenue(name, preferred)).length
  if (matches > 0) {
    return clampScore(0.72 + Math.min(matches, 2) * 0.14)
  }
  if ((contract.hiddenGemRules.minimumHiddenGemStops ?? 0) > 0) {
    return 0.26
  }
  return 0.46
}

function getMomentBiasAlignmentScore(
  aggregation: TasteOpportunityAggregation | undefined,
  anchorMoment: AggregatedMoment | undefined,
  happenings: CityOpportunityHappening[],
  contract: HospitalityScenarioContract | null,
): number {
  if (!aggregation || !contract?.selectionBias?.momentTypeBoosts) {
    return 0.5
  }
  const boosts = contract.selectionBias.momentTypeBoosts
  const entries = Object.entries(boosts).filter(([, value]) => typeof value === 'number' && value > 0)
  if (entries.length === 0) {
    return 0.5
  }
  const maxBoost = Math.max(...entries.map(([, value]) => value as number), 0.01)
  const happeningTypes = happenings.map((entry) => entry.type).filter(Boolean)
  const anchorType = anchorMoment?.momentType
  const weightedTypeMatch = entries.reduce((sum, [momentType, boostValue]) => {
    const normalizedBoost = (boostValue as number) / maxBoost
    const matchesAnchor = anchorType === momentType
    const matchesHappening = happeningTypes.includes(momentType)
    return sum + (matchesAnchor || matchesHappening ? normalizedBoost : 0)
  }, 0)
  const normalizedMatch = weightedTypeMatch / entries.length
  const discoveryBalanceScore = toDiscoveryBalanceScore(aggregation.summary.discoveryBalance)
  return clampScore(normalizedMatch * 0.78 + discoveryBalanceScore * 0.22)
}

function getStorySpineCoherenceScore(params: {
  aggregation: TasteOpportunityAggregation | undefined
  anchorName: string
  starts: CityOpportunityStopOption[]
  closes: CityOpportunityStopOption[]
  startQuality: number
  windDownQuality: number
}): number {
  const { aggregation, anchorName, starts, closes, startQuality, windDownQuality } = params
  const topStart = starts[0]?.name?.trim() ?? ''
  const topClose = closes[0]?.name?.trim() ?? ''
  const normalizedAnchor = anchorName.trim().toLowerCase()
  const normalizedStart = topStart.toLowerCase()
  const normalizedClose = topClose.toLowerCase()
  const hasBothSupport = starts.length > 0 && closes.length > 0
  const supportCoverage = hasBothSupport ? 1 : starts.length > 0 || closes.length > 0 ? 0.58 : 0
  const uniqueCount = new Set([normalizedAnchor, normalizedStart, normalizedClose].filter(Boolean)).size
  const distinctness = uniqueCount >= 3 ? 1 : uniqueCount === 2 ? 0.62 : 0.22
  const supportStrength = clampScore((startQuality + windDownQuality) / 2)
  const movementTightness = toMovementTightnessScore(aggregation?.summary.movementProfile)
  return clampScore(
    supportCoverage * 0.38 +
      distinctness * 0.26 +
      supportStrength * 0.24 +
      movementTightness * 0.12,
  )
}

function getDiscoveryLocalStrengthScore(
  aggregation: TasteOpportunityAggregation | undefined,
  happenings: CityOpportunityHappening[],
  hiddenGemPresence: number,
): number {
  const happeningStrength = happenings
    .slice(0, 2)
    .reduce((sum, happening) => {
      const baseTypeScore =
        happening.type === 'temporal'
          ? 0.92
          : happening.type === 'discovery'
            ? 0.88
            : happening.type === 'community'
              ? 0.82
              : 0.58
      return sum + baseTypeScore * (happening.strength ?? 0.62)
    }, 0)
  const normalizedHappenings = happenings.length > 0 ? happeningStrength / happenings.length : 0
  const discoveryBalance = toDiscoveryBalanceScore(aggregation?.summary.discoveryBalance)
  return clampScore(
    normalizedHappenings * 0.58 + discoveryBalance * 0.24 + hiddenGemPresence * 0.18,
  )
}

function getScenarioAlignmentScore(params: {
  contract: HospitalityScenarioContract | null
  aggregation: TasteOpportunityAggregation | undefined
  anchorName: string
  anchorMoment: AggregatedMoment | undefined
  starts: CityOpportunityStopOption[]
  closes: CityOpportunityStopOption[]
  happenings: CityOpportunityHappening[]
}): number {
  const { contract, aggregation, anchorName, anchorMoment, starts, closes, happenings } = params
  if (!contract) {
    return 0.56
  }
  const preferredAnchors = [
    ...(contract.anchorRules.defaultPrimaryAnchors ?? []),
    ...(contract.anchorRules.stronglyPreferredVenues ?? []),
  ]
  const avoidAnchors = contract.anchorRules.avoidVenues ?? []
  const anchorPreference =
    matchesScenarioVenue(anchorName, preferredAnchors)
      ? 1
      : matchesScenarioVenue(anchorName, avoidAnchors)
        ? 0.1
        : 0.52
  const startFit = getRoleContractFitScore('start', starts, contract)
  const windDownFit = getRoleContractFitScore('windDown', closes, contract)
  const hiddenGemPresence = getHiddenGemPresenceScore({
    contract,
    anchorName,
    starts,
    closes,
    happenings,
  })
  const momentBiasAlignment = getMomentBiasAlignmentScore(
    aggregation,
    anchorMoment,
    happenings,
    contract,
  )
  const roleBoosts = contract.selectionBias?.roleBoosts
  const roleBias =
    roleBoosts != null
      ? clampScore(
          ((roleBoosts.start ?? 0) + (roleBoosts.highlight ?? 0) + (roleBoosts.windDown ?? 0)) /
            0.24,
        )
      : 0.5
  const avoidPenalty =
    matchesScenarioVenue(anchorName, avoidAnchors) ||
    starts.some((entry) => matchesScenarioVenue(entry.name, avoidAnchors)) ||
    closes.some((entry) => matchesScenarioVenue(entry.name, avoidAnchors))
      ? 0.22
      : 0

  return clampScore(
    anchorPreference * 0.34 +
      startFit * 0.2 +
      windDownFit * 0.2 +
      hiddenGemPresence * 0.14 +
      momentBiasAlignment * 0.08 +
      roleBias * 0.04 -
      avoidPenalty,
  )
}

function getExperienceContractAlignmentScore(params: {
  contract: InterpretationExperienceContract | null
  aggregation: TasteOpportunityAggregation | undefined
  starts: CityOpportunityStopOption[]
  closes: CityOpportunityStopOption[]
  happenings: CityOpportunityHappening[]
}): number {
  const { contract, aggregation, starts, closes, happenings } = params
  if (!contract || !aggregation) {
    return 0.56
  }

  let score = 0.56
  const energy = aggregation.summary.dominantEnergy
  const socialDensity = aggregation.summary.dominantSocialDensity
  const movement = aggregation.summary.movementProfile
  const discovery = aggregation.summary.discoveryBalance
  const highlightPotential = aggregation.summary.highlightPotential
  const hasTemporal = happenings.some((entry) => entry.type === 'temporal')
  const hasDiscoveryLike = happenings.some(
    (entry) => entry.type === 'discovery' || entry.type === 'community',
  )
  const supportCoverage = starts.length > 0 && closes.length > 0 ? 1 : 0.62

  if (
    contract.coordinationMode === 'pulse' ||
    contract.highlightModel === 'multi_peak' ||
    contract.pacingStyle === 'escalating'
  ) {
    score += energy === 'lively' ? 0.18 : energy === 'balanced' ? 0.08 : -0.12
    score +=
      highlightPotential === 'high'
        ? 0.08
        : highlightPotential === 'medium'
          ? 0.03
          : -0.08
    score += movement === 'spread' || movement === 'moderate' ? 0.06 : -0.04
    score += hasTemporal ? 0.06 : -0.03
  }

  if (
    contract.coordinationMode === 'depth' ||
    contract.highlightModel === 'earned_peak' ||
    contract.pacingStyle === 'slow_build'
  ) {
    score += energy === 'calm' ? 0.14 : energy === 'balanced' ? 0.04 : -0.08
    score += socialDensity === 'intimate' ? 0.1 : socialDensity === 'mixed' ? 0.03 : -0.05
    score += movement === 'tight' || movement === 'moderate' ? 0.06 : -0.05
    score += discovery === 'balanced' ? 0.04 : discovery === 'familiar' ? 0.02 : -0.02
  }

  if (
    contract.coordinationMode === 'narrative' ||
    contract.highlightModel === 'reflective_peak' ||
    contract.pacingStyle === 'deliberate'
  ) {
    score += discovery === 'novel' ? 0.14 : discovery === 'balanced' ? 0.06 : -0.08
    score += energy === 'calm' || energy === 'balanced' ? 0.06 : -0.05
    score += movement === 'moderate' || movement === 'spread' ? 0.05 : -0.03
    score += hasDiscoveryLike ? 0.06 : -0.02
    score += hasTemporal ? -0.02 : 0
  }

  if (contract.socialPosture === 'shared_pulse') {
    score += socialDensity === 'social' ? 0.08 : socialDensity === 'mixed' ? 0.03 : -0.06
  } else if (contract.socialPosture === 'intimate') {
    score += socialDensity === 'intimate' ? 0.08 : socialDensity === 'mixed' ? 0.02 : -0.05
  } else if (contract.socialPosture === 'reflective') {
    score += hasDiscoveryLike ? 0.05 : 0
  }

  score += supportCoverage * 0.05
  return clampScore(score)
}

function getLiveEventRelevanceScore(params: {
  aggregation: TasteOpportunityAggregation | undefined
  anchorMoment: AggregatedMoment | undefined
  happenings: CityOpportunityHappening[]
  scenarioContract: HospitalityScenarioContract | null
}): number {
  const { aggregation, anchorMoment, happenings, scenarioContract } = params
  const allMoments = aggregation ? [...aggregation.moments.primary, ...aggregation.moments.secondary] : []
  const temporalMoments = allMoments.filter((moment) => moment.momentType === 'temporal')
  const temporalDensity = allMoments.length > 0 ? temporalMoments.length / allMoments.length : 0
  const momentTimingSignal =
    temporalMoments.length > 0
      ? clampScore(
          temporalMoments.reduce((sum, moment) => sum + moment.timingRelevance, 0) /
            temporalMoments.length,
        )
      : 0
  const anchorTimingSignal = clampScore(anchorMoment?.timingRelevance ?? 0)
  const happeningEventSignal = happenings.some((entry) => entry.hasEvent) ? 1 : 0
  const happeningPerformanceSignal = happenings.some((entry) => entry.hasPerformance) ? 1 : 0
  const happeningHappyHourSignal = happenings.some((entry) => entry.hasHappyHour) ? 1 : 0
  const happeningLateSignal = happenings.some((entry) =>
    normalizeQualityText(entry.timeWindowLabel ?? entry.timingLabel).includes('late'),
  )
    ? 1
    : 0
  const happeningTonightSignal = happenings.some((entry) => {
    const timing = normalizeQualityText(entry.timeWindowLabel ?? entry.timingLabel)
    return timing.includes('evening') || timing.includes('tonight') || timing.includes('late')
  })
    ? 1
    : 0
  const happeningTemporalStrength =
    happenings.length > 0
      ? clampScore(
          happenings
            .filter((entry) => entry.type === 'temporal')
            .reduce((sum, entry) => sum + (entry.strength ?? 0.62), 0) /
            Math.max(
              1,
              happenings.filter((entry) => entry.type === 'temporal').length,
            ),
        )
      : 0

  const baseLiveScore = clampScore(
    temporalDensity * 0.2 +
      momentTimingSignal * 0.18 +
      anchorTimingSignal * 0.16 +
      happeningEventSignal * 0.12 +
      happeningPerformanceSignal * 0.12 +
      happeningHappyHourSignal * 0.08 +
      happeningLateSignal * 0.08 +
      happeningTonightSignal * 0.06 +
      happeningTemporalStrength * 0.1,
  )
  if (scenarioContract?.vibe === 'lively') {
    return clampScore(
      baseLiveScore * 0.6 +
        happeningPerformanceSignal * 0.14 +
        happeningLateSignal * 0.12 +
        happeningHappyHourSignal * 0.08 +
        happeningEventSignal * 0.06,
    )
  }
  if (scenarioContract?.vibe === 'cultured') {
    const culturalTemporalSignal = happenings.some(
      (entry) =>
        entry.type === 'community' || entry.type === 'discovery' || entry.hasPerformance,
    )
      ? 1
      : 0
    return clampScore(
      baseLiveScore * 0.64 +
        culturalTemporalSignal * 0.14 +
        happeningPerformanceSignal * 0.1 +
        happeningEventSignal * 0.06 +
        happeningTonightSignal * 0.06,
    )
  }
  const quietTonightSignal = happenings.some((entry) => {
    const reason = normalizeQualityText(entry.reason)
    return (
      reason.includes('quiet') ||
      reason.includes('soft') ||
      reason.includes('landing') ||
      reason.includes('nightcap')
    )
  })
    ? 1
    : 0
  return clampScore(
    baseLiveScore * 0.56 +
      quietTonightSignal * 0.16 +
      happeningLateSignal * 0.1 +
      happeningHappyHourSignal * 0.06 +
      anchorTimingSignal * 0.12,
  )
}

function getCloserAuthorityLift(params: {
  scenarioContract: HospitalityScenarioContract | null
  windDownQuality: number
  authoritySignals: Step2AuthoritySignals
  closes: CityOpportunityStopOption[]
  happenings: CityOpportunityHappening[]
}): number {
  const { scenarioContract, windDownQuality, authoritySignals, closes, happenings } = params
  const closeCorpus = normalizeQualityText(
    closes
      .slice(0, 2)
      .map((entry) => `${entry.name} ${entry.reason}`)
      .join(' '),
  )
  const closeLiveSignal = happenings.some(
    (entry) =>
      entry.hasHappyHour ||
      entry.hasEvent ||
      entry.hasPerformance ||
      normalizeQualityText(entry.timeWindowLabel ?? entry.timingLabel).includes('late'),
  )
    ? 1
    : 0
  if (scenarioContract?.vibe === 'lively') {
    const livelyCloseSignal =
      closeLiveSignal ||
      closeCorpus.includes('late') ||
      closeCorpus.includes('nightcap') ||
      closeCorpus.includes('cocktail')
        ? 1
        : 0
    return clampScore(
      windDownQuality * 0.5 +
        authoritySignals.windDownConviction * 0.3 +
        authoritySignals.nightlifeConviction * 0.12 +
        livelyCloseSignal * 0.08,
    )
  }
  if (scenarioContract?.vibe === 'cultured') {
    const reflectiveCloseSignal =
      closeCorpus.includes('wine') ||
      closeCorpus.includes('quiet') ||
      closeCorpus.includes('reflective') ||
      closeCorpus.includes('soft')
        ? 1
        : 0
    return clampScore(
      windDownQuality * 0.44 +
        authoritySignals.windDownConviction * 0.28 +
        authoritySignals.culturalConviction * 0.18 +
        reflectiveCloseSignal * 0.1,
    )
  }
  const cozyCloseSignal =
    closeCorpus.includes('soft') ||
    closeCorpus.includes('quiet') ||
    closeCorpus.includes('landing') ||
    closeCorpus.includes('nightcap')
      ? 1
      : 0
  return clampScore(
    windDownQuality * 0.42 +
      authoritySignals.windDownConviction * 0.3 +
      authoritySignals.hiddenGemConviction * 0.2 +
      cozyCloseSignal * 0.08,
  )
}

function getSyntheticNamingPenalty(
  anchorName: string | undefined,
  starts: CityOpportunityStopOption[],
  closes: CityOpportunityStopOption[],
): number {
  const corpus = normalizeQualityText(
    [
      anchorName ?? '',
      ...starts.slice(0, 2).map((entry) => entry.name),
      ...closes.slice(0, 2).map((entry) => entry.name),
    ].join(' '),
  )
  if (!corpus) {
    return 0
  }
  const syntheticTokens = [
    'microcrawl',
    'sketchbook',
    'drop',
    'proto',
    'prototype',
    'sandbox',
    'testbed',
    'simulator',
  ]
  const syntheticHits = syntheticTokens.filter((token) => corpus.includes(token)).length
  if (syntheticHits === 0) {
    return 0
  }
  return Math.min(0.12, syntheticHits * 0.045)
}

function getCityOpportunitySurfaceScore(params: {
  aggregation: TasteOpportunityAggregation | undefined
  anchorReasons: string[]
  anchorMoment: AggregatedMoment | undefined
  hasRealAnchor: boolean
  starts: CityOpportunityStopOption[]
  closes: CityOpportunityStopOption[]
  happenings: CityOpportunityHappening[]
  representativeDirection?: LiveDistrictOpportunityBuilderDirectionInput
  ecsState: LiveDistrictOpportunityBuilderEcsState
  scenarioContract: HospitalityScenarioContract | null
  experienceContract: InterpretationExperienceContract | null
  city: string
  persona: string
  vibe: string
  authoritySignalsOverride?: Step2AuthoritySignals
}): number {
  const {
    aggregation,
    anchorReasons,
    anchorMoment,
    hasRealAnchor,
    starts,
    closes,
    happenings,
    representativeDirection,
    ecsState,
    scenarioContract,
    experienceContract,
    city,
    persona,
    vibe,
  } = params
  const authoritySignals =
    params.authoritySignalsOverride ??
    deriveStep2AuthoritySignals({
      city,
      persona,
      vibe,
      anchorName: aggregation?.anchors.strongestHighlight?.venueName,
      anchorReason: aggregation?.anchors.strongestHighlight?.reason ?? anchorMoment?.reason,
      anchorTimingRelevance: anchorMoment?.timingRelevance,
      anchorLiveContext: anchorMoment?.liveContext,
      starts: starts.map((entry) => ({ name: entry.name, reason: entry.reason })),
      closes: closes.map((entry) => ({ name: entry.name, reason: entry.reason })),
      happenings: happenings.map((entry) => ({
        name: entry.name,
        type: entry.type,
        reason: entry.reason,
        timingLabel: entry.timingLabel,
        timeWindowLabel: entry.timeWindowLabel,
        strength: entry.strength,
        hasEvent: entry.hasEvent,
        hasPerformance: entry.hasPerformance,
        hasHappyHour: entry.hasHappyHour,
      })),
      summary: aggregation?.summary,
    })
  const anchorScore =
    aggregation?.anchors.strongestHighlight?.score ??
    aggregation?.ingredients.highlightCandidates[0]?.score ??
    0.44
  const intentFitSignal =
    anchorMoment?.intentFit ??
    aggregation?.moments.primary[0]?.intentFit ??
    aggregation?.moments.secondary[0]?.intentFit ??
    0.52
  const directionConfidence = representativeDirection?.debugMeta?.confidence ?? 0
  const highlightTierScore = toHighlightTierScore(
    aggregation?.anchors.strongestHighlight?.tier,
    anchorScore,
  )
  const highlightPotentialScore = toHighlightPotentialScore(
    aggregation?.summary.highlightPotential,
  )
  const anchorMomentStrength = anchorMoment?.strength ?? 0.56
  const anchorConviction = clampScore(
    anchorScore * 0.4 +
      highlightTierScore * 0.2 +
      intentFitSignal * 0.2 +
      anchorMomentStrength * 0.12 +
      highlightPotentialScore * 0.08 +
      authoritySignals.anchorConviction * 0.1,
  )

  const startQuality = clampScore(
    getStopAverageScore(starts) * 0.58 +
      getRoleContractFitScore('start', starts, scenarioContract) * 0.22 +
      authoritySignals.startConviction * 0.2,
  )
  const windDownQuality = clampScore(
    getStopAverageScore(closes) * 0.54 +
      getRoleContractFitScore('windDown', closes, scenarioContract) * 0.22 +
      authoritySignals.windDownConviction * 0.24,
  )

  const hiddenGemPresence = getHiddenGemPresenceScore({
    contract: scenarioContract,
    anchorName: aggregation?.anchors.strongestHighlight?.venueName,
    starts,
    closes,
    happenings,
  })
  const scenarioAlignment = getScenarioAlignmentScore({
    contract: scenarioContract,
    aggregation,
    anchorName: aggregation?.anchors.strongestHighlight?.venueName ?? '',
    anchorMoment,
    starts,
    closes,
    happenings,
  })
  const experienceAlignment = getExperienceContractAlignmentScore({
    contract: experienceContract,
    aggregation,
    starts,
    closes,
    happenings,
  })
  const storySpineCoherence = getStorySpineCoherenceScore({
    aggregation,
    anchorName: aggregation?.anchors.strongestHighlight?.venueName ?? '',
    starts,
    closes,
    startQuality,
    windDownQuality,
  })
  const discoveryLocalStrength = clampScore(
    getDiscoveryLocalStrengthScore(aggregation, happenings, hiddenGemPresence) * 0.62 +
      authoritySignals.discoveryConviction * 0.18 +
      authoritySignals.culturalConviction * 0.1 +
      authoritySignals.happeningAuthority * 0.1,
  )
  const liveEventRelevance = getLiveEventRelevanceScore({
    aggregation,
    anchorMoment,
    happenings,
    scenarioContract,
  })
  const closerAuthorityLift = getCloserAuthorityLift({
    scenarioContract,
    windDownQuality,
    authoritySignals,
    closes,
    happenings,
  })
  const proximityScore = clampScore(
    directionConfidence * 0.58 +
      toMovementTightnessScore(aggregation?.summary.movementProfile) * 0.42,
  )
  const verificationScore = Math.min(anchorReasons.length, 2) / 2
  const supportCoverageScore =
    starts.length > 0 && closes.length > 0 ? 1 : starts.length > 0 || closes.length > 0 ? 0.58 : 0
  const genericPenalty =
    starts.length === 0 || closes.length === 0
      ? 0.14
      : starts[0]?.name?.trim().toLowerCase() === closes[0]?.name?.trim().toLowerCase()
        ? 0.08
        : 0
  const weakSupportPenalty =
    (startQuality < 0.5 ? 0.06 : 0) + (windDownQuality < 0.5 ? 0.06 : 0)
  const syntheticNamingPenalty = getSyntheticNamingPenalty(
    aggregation?.anchors.strongestHighlight?.venueName,
    starts,
    closes,
  )
  const authorityMismatchPenalty =
    authoritySignals.overallAuthority < 0.42
      ? 0.1
      : authoritySignals.overallAuthority < 0.52
        ? 0.05
        : 0
  const contractMismatchPenalty =
    experienceAlignment < 0.48
      ? 0.08
      : experienceAlignment < 0.56
        ? 0.04
        : 0
  const scenarioAuthorityLift =
    scenarioContract?.vibe === 'lively'
      ? authoritySignals.nightlifeConviction * 0.16 +
        authoritySignals.majorEventConviction * 0.12 +
        authoritySignals.happeningAuthority * 0.06 +
        liveEventRelevance * 0.12 +
        authoritySignals.whyTonightPressure * 0.1
      : scenarioContract?.vibe === 'cultured'
        ? authoritySignals.culturalConviction * 0.18 +
          authoritySignals.discoveryConviction * 0.12 +
          authoritySignals.majorEventConviction * 0.08 +
          liveEventRelevance * 0.1 +
          authoritySignals.whyTonightPressure * 0.08
        : authoritySignals.hiddenGemConviction * 0.16 +
          authoritySignals.windDownConviction * 0.12 +
          authoritySignals.discoveryConviction * 0.07 +
          liveEventRelevance * 0.06 +
          authoritySignals.whyTonightPressure * 0.08
  const scenarioAuthorityPenalty =
    scenarioContract?.vibe === 'lively'
      ? authoritySignals.nightlifeConviction < 0.22 &&
        authoritySignals.majorEventConviction < 0.16
        ? 0.08
        : 0
      : scenarioContract?.vibe === 'cultured'
        ? authoritySignals.culturalConviction < 0.24 &&
          authoritySignals.discoveryConviction < 0.2
          ? 0.08
          : 0
        : authoritySignals.hiddenGemConviction < 0.22 &&
            authoritySignals.windDownConviction < 0.32
          ? 0.06
          : 0

  const highlightEcsBias =
    ecsState.highlight === 'standout' ? anchorConviction * 0.07 : (1 - anchorConviction) * 0.03
  const discoveryEcsBias =
    ecsState.discovery === 'discover'
      ? discoveryLocalStrength * 0.08
      : (1 - discoveryLocalStrength) * 0.02 + supportCoverageScore * 0.01
  const explorationEcsBias =
    ecsState.exploration === 'exploratory'
      ? discoveryLocalStrength * 0.05 + (1 - proximityScore) * 0.03
      : storySpineCoherence * 0.03 + proximityScore * 0.02

  const anchorPresenceScore = hasRealAnchor ? 0.08 : -0.2
  return (
    anchorConviction * 0.28 +
    scenarioAlignment * 0.2 +
    experienceAlignment * 0.16 +
    storySpineCoherence * 0.14 +
    startQuality * 0.1 +
    windDownQuality * 0.08 +
    discoveryLocalStrength * 0.07 +
    closerAuthorityLift * 0.07 +
    liveEventRelevance * 0.06 +
    proximityScore * 0.03 +
    verificationScore * 0.02 +
    anchorPresenceScore +
    highlightEcsBias +
    discoveryEcsBias +
    explorationEcsBias +
    scenarioAuthorityLift +
    supportCoverageScore * 0.03 -
    genericPenalty -
    weakSupportPenalty -
    syntheticNamingPenalty -
    contractMismatchPenalty -
    authorityMismatchPenalty -
    scenarioAuthorityPenalty
  )
}

function buildCityOpportunityAuthoritySignals(params: {
  aggregation: TasteOpportunityAggregation | undefined
  anchorMoment: AggregatedMoment | undefined
  starts: CityOpportunityStopOption[]
  closes: CityOpportunityStopOption[]
  happenings: CityOpportunityHappening[]
  city: string
  persona: string
  vibe: string
}): Step2AuthoritySignals {
  const { aggregation, anchorMoment, starts, closes, happenings, city, persona, vibe } = params
  return deriveStep2AuthoritySignals({
    city,
    persona,
    vibe,
    anchorName: aggregation?.anchors.strongestHighlight?.venueName,
    anchorReason: aggregation?.anchors.strongestHighlight?.reason ?? anchorMoment?.reason,
    anchorTimingRelevance: anchorMoment?.timingRelevance,
    anchorLiveContext: anchorMoment?.liveContext,
    starts: starts.map((entry) => ({ name: entry.name, reason: entry.reason })),
    closes: closes.map((entry) => ({ name: entry.name, reason: entry.reason })),
    happenings: happenings.map((entry) => ({
      name: entry.name,
      type: entry.type,
      reason: entry.reason,
      timingLabel: entry.timingLabel,
      timeWindowLabel: entry.timeWindowLabel,
      strength: entry.strength,
      hasEvent: entry.hasEvent,
      hasPerformance: entry.hasPerformance,
      hasHappyHour: entry.hasHappyHour,
    })),
    summary: aggregation?.summary,
  })
}

function buildWhyTonightStrength(params: {
  authoritySignals: Step2AuthoritySignals
  happenings: CityOpportunityHappening[]
  anchorMoment: AggregatedMoment | undefined
  aggregation: TasteOpportunityAggregation | undefined
}): number {
  const { authoritySignals, happenings, anchorMoment, aggregation } = params
  const hasTemporal = happenings.some((entry) => entry.type === 'temporal')
  const hasPerformance = happenings.some((entry) => entry.hasPerformance)
  const hasEvent = happenings.some((entry) => entry.hasEvent)
  const hasHappyHour = happenings.some((entry) => entry.hasHappyHour)
  const lateSignal = happenings.some((entry) =>
    normalizeQualityText(entry.timeWindowLabel ?? entry.timingLabel).includes('late'),
  )
    ? 1
    : 0
  const happeningStrength =
    happenings.length > 0
      ? clampScore(
          happenings.slice(0, 2).reduce((sum, entry) => sum + (entry.strength ?? 0.58), 0) /
            Math.min(2, happenings.length),
        )
      : 0
  const temporalDensity =
    aggregation && aggregation.moments.primary.length + aggregation.moments.secondary.length > 0
      ? clampScore(
          [...aggregation.moments.primary, ...aggregation.moments.secondary].filter(
            (moment) => moment.momentType === 'temporal',
          ).length /
            ([...aggregation.moments.primary, ...aggregation.moments.secondary].length || 1),
        )
      : 0

  const liveContextSignal = clampScore(
    (hasTemporal ? 0.26 : 0) +
      (hasPerformance ? 0.22 : 0) +
      (hasEvent ? 0.18 : 0) +
      (hasHappyHour ? 0.12 : 0) +
      (lateSignal ? 0.14 : 0),
  )

  return clampScore(
    authoritySignals.whyTonightPressure * 0.44 +
      authoritySignals.happeningAuthority * 0.2 +
      happeningStrength * 0.12 +
      temporalDensity * 0.1 +
      clampScore(anchorMoment?.timingRelevance ?? 0) * 0.06 +
      liveContextSignal * 0.08,
  )
}

function buildCozyAuthorityStrength(params: {
  authoritySignals: Step2AuthoritySignals
  anchorName: string
  starts: CityOpportunityStopOption[]
  closes: CityOpportunityStopOption[]
  happenings: CityOpportunityHappening[]
}): number {
  const { authoritySignals, anchorName, starts, closes, happenings } = params
  const cozyCorpus = normalizeQualityText(
    [
      anchorName,
      ...starts.map((entry) => entry.name),
      ...closes.map((entry) => `${entry.name} ${entry.reason}`),
    ]
      .filter(Boolean)
      .join(' '),
  )
  const cozyLexicalSignal =
    ['cozy', 'intimate', 'quiet', 'soft', 'landing', 'nightcap', 'garden', 'tea', 'wine', 'romantic'].some(
      (token) => cozyCorpus.includes(token),
    )
      ? 1
      : 0
  const knownCozyAuthoritySignal =
    [
      'la foret',
      'hakone gardens',
      'hedley club lounge',
      'japanese friendship garden',
      'willow glen',
    ].some((entry) => hasLoosePhraseMatch(anchorName, entry))
      ? 1
      : 0
  const quietHappeningSignal = happenings.some((entry) => {
    const reason = normalizeQualityText(entry.reason)
    return reason.includes('quiet') || reason.includes('soft') || reason.includes('discovery')
  })
    ? 1
    : 0

  return clampScore(
    authoritySignals.hiddenGemConviction * 0.28 +
      authoritySignals.windDownConviction * 0.24 +
      authoritySignals.anchorConviction * 0.16 +
      authoritySignals.discoveryConviction * 0.1 +
      cozyLexicalSignal * 0.12 +
      knownCozyAuthoritySignal * 0.06 +
      quietHappeningSignal * 0.04,
  )
}

function buildWhyTonightProofLine(params: {
  authoritySignals: Step2AuthoritySignals
  whyTonightStrength: number
  cozyAuthorityStrength: number
  happenings: CityOpportunityHappening[]
  scenarioContract: HospitalityScenarioContract | null
}): string | undefined {
  const {
    authoritySignals,
    whyTonightStrength,
    cozyAuthorityStrength,
    happenings,
    scenarioContract,
  } = params
  if (whyTonightStrength < 0.58) {
    return undefined
  }
  if (happenings.some((entry) => entry.hasPerformance)) {
    return 'Performance-capable highlight energy nearby tonight.'
  }
  if (happenings.some((entry) => entry.hasEvent)) {
    return 'Eventful nearby momentum makes tonight stronger.'
  }
  if (
    happenings.some((entry) =>
      normalizeQualityText(entry.timeWindowLabel ?? entry.timingLabel).includes('late'),
    ) ||
    happenings.some((entry) => entry.hasHappyHour)
  ) {
    return 'Late-night momentum is strong nearby right now.'
  }
  if (scenarioContract?.vibe === 'cultured' && authoritySignals.culturalConviction >= 0.5) {
    return 'Cultural highlights are active nearby tonight.'
  }
  if (scenarioContract?.vibe === 'cozy' && cozyAuthorityStrength >= 0.62) {
    return 'Quiet hidden-gem authority fits tonight especially well.'
  }
  return 'Strong tonight relevance across this local sequence.'
}

function buildModeExcellenceStrength(params: {
  scenarioContract: HospitalityScenarioContract | null
  authoritySignals: Step2AuthoritySignals
  whyTonightStrength: number
  cozyAuthorityStrength: number
  anchorName: string
  starts: CityOpportunityStopOption[]
  closes: CityOpportunityStopOption[]
}): number {
  const {
    scenarioContract,
    authoritySignals,
    whyTonightStrength,
    cozyAuthorityStrength,
    anchorName,
    starts,
    closes,
  } = params
  const supportCorpus = normalizeQualityText(
    [
      anchorName,
      ...starts.map((entry) => `${entry.name} ${entry.reason}`),
      ...closes.map((entry) => `${entry.name} ${entry.reason}`),
    ].join(' '),
  )

  if (scenarioContract?.vibe === 'lively') {
    const nightlifeLexicalSignal =
      ['nightlife', 'cocktail', 'late', 'live', 'music', 'performance', 'pulse'].some((token) =>
        supportCorpus.includes(token),
      )
        ? 1
        : 0
    return clampScore(
      authoritySignals.nightlifeConviction * 0.36 +
        authoritySignals.majorEventConviction * 0.24 +
        whyTonightStrength * 0.28 +
        nightlifeLexicalSignal * 0.12,
    )
  }

  if (scenarioContract?.vibe === 'cultured') {
    const culturalLexicalSignal =
      ['cultural', 'museum', 'gallery', 'theatre', 'opera', 'discovery', 'reflective'].some(
        (token) => supportCorpus.includes(token),
      )
        ? 1
        : 0
    return clampScore(
      authoritySignals.culturalConviction * 0.38 +
        authoritySignals.discoveryConviction * 0.28 +
        authoritySignals.majorEventConviction * 0.12 +
        whyTonightStrength * 0.12 +
        culturalLexicalSignal * 0.1,
    )
  }

  const cozyLexicalSignal =
    ['cozy', 'intimate', 'soft', 'quiet', 'nightcap', 'garden', 'wine', 'tea', 'hidden gem'].some(
      (token) => supportCorpus.includes(token),
    )
      ? 1
      : 0
  const genericPromenadePenalty =
    supportCorpus.includes('promenade') &&
    !supportCorpus.includes('intimate') &&
    !supportCorpus.includes('romantic') &&
    !supportCorpus.includes('wine') &&
    !supportCorpus.includes('tea')
      ? 0.08
      : 0
  return clampScore(
    authoritySignals.hiddenGemConviction * 0.34 +
      authoritySignals.windDownConviction * 0.22 +
      cozyAuthorityStrength * 0.22 +
      whyTonightStrength * 0.1 +
      cozyLexicalSignal * 0.12 -
      genericPromenadePenalty,
  )
}

function buildStep2ExcellenceThreshold(params: {
  scenarioContract: HospitalityScenarioContract | null
}): number {
  const { scenarioContract } = params
  if (scenarioContract?.vibe === 'cozy') {
    return 0.68
  }
  if (scenarioContract?.vibe === 'lively') {
    return 0.66
  }
  if (scenarioContract?.vibe === 'cultured') {
    return 0.66
  }
  return 0.65
}

function buildStep2ExcellenceScore(params: {
  anchorStrength: number
  startQuality: number
  windDownQuality: number
  supportCoherence: number
  scenarioAlignment: number
  experienceAlignment: number
  localAuthority: number
  whyTonightStrength: number
  modeExcellence: number
  existingSurfaceScore: number
  scenarioContract: HospitalityScenarioContract | null
}): number {
  const {
    anchorStrength,
    startQuality,
    windDownQuality,
    supportCoherence,
    scenarioAlignment,
    experienceAlignment,
    localAuthority,
    whyTonightStrength,
    modeExcellence,
    existingSurfaceScore,
    scenarioContract,
  } = params

  const weakSupportPenalty =
    (startQuality < 0.52 ? 0.06 : 0) +
    (windDownQuality < 0.54 ? 0.06 : 0) +
    (supportCoherence < 0.56 ? 0.06 : 0)
  const weakAnchorPenalty =
    anchorStrength < 0.56 ? 0.09 : anchorStrength < 0.62 ? 0.05 : 0
  const weakAuthorityPenalty = localAuthority < 0.52 ? 0.07 : 0

  const modePenalty =
    scenarioContract?.vibe === 'cozy'
      ? modeExcellence < 0.58
        ? 0.08
        : 0
      : scenarioContract?.vibe === 'lively'
        ? modeExcellence < 0.54
          ? 0.08
          : 0
        : scenarioContract?.vibe === 'cultured'
          ? modeExcellence < 0.56
            ? 0.08
            : 0
          : 0

  return clampScore(
    anchorStrength * 0.2 +
      scenarioAlignment * 0.14 +
      experienceAlignment * 0.12 +
      startQuality * 0.11 +
      windDownQuality * 0.14 +
      supportCoherence * 0.1 +
      localAuthority * 0.1 +
      whyTonightStrength * 0.09 +
      modeExcellence * 0.1 +
      clampScore(existingSurfaceScore) * 0.04 -
      weakSupportPenalty -
      weakAnchorPenalty -
      weakAuthorityPenalty -
      modePenalty,
  )
}

function isStep2ExcellenceCandidate(params: {
  excellenceScore: number
  threshold: number
  anchorStrength: number
  startQuality: number
  windDownQuality: number
  supportCoherence: number
  scenarioContract: HospitalityScenarioContract | null
  modeExcellence: number
}): boolean {
  const {
    excellenceScore,
    threshold,
    anchorStrength,
    startQuality,
    windDownQuality,
    supportCoherence,
    scenarioContract,
    modeExcellence,
  } = params

  if (anchorStrength < 0.54) {
    return false
  }
  if (startQuality < 0.46 || windDownQuality < 0.5) {
    return false
  }
  if (supportCoherence < 0.5) {
    return false
  }

  if (scenarioContract?.vibe === 'cozy') {
    if (modeExcellence < 0.58 || windDownQuality < 0.56) {
      return false
    }
  } else if (scenarioContract?.vibe === 'lively') {
    if (modeExcellence < 0.54 || anchorStrength < 0.58) {
      return false
    }
  } else if (scenarioContract?.vibe === 'cultured') {
    if (modeExcellence < 0.56 || anchorStrength < 0.56) {
      return false
    }
  }

  return excellenceScore >= threshold
}

function isRomanticCozyMode(params: {
  persona: string
  vibe: string
  scenarioContract: HospitalityScenarioContract | null
}): boolean {
  const { persona, vibe, scenarioContract } = params
  const normalizedPersona = normalizeQualityText(persona)
  const normalizedVibe = normalizeQualityText(vibe)
  const scenarioMatch =
    scenarioContract?.persona === 'romantic' && scenarioContract.vibe === 'cozy'
  return scenarioMatch || (normalizedPersona.includes('romantic') && normalizedVibe.includes('cozy'))
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function shiftHighlightPotential(
  value: TasteOpportunityAggregation['summary']['highlightPotential'],
  direction: 'up' | 'down',
): TasteOpportunityAggregation['summary']['highlightPotential'] {
  if (direction === 'up') {
    if (value === 'low') {
      return 'medium'
    }
    if (value === 'medium') {
      return 'high'
    }
    return 'high'
  }
  if (value === 'high') {
    return 'medium'
  }
  if (value === 'medium') {
    return 'low'
  }
  return 'low'
}

function shiftDiscoveryBalance(
  value: TasteOpportunityAggregation['summary']['discoveryBalance'],
  direction: 'toward_discover' | 'toward_reliable',
): TasteOpportunityAggregation['summary']['discoveryBalance'] {
  if (direction === 'toward_discover') {
    if (value === 'familiar') {
      return 'balanced'
    }
    if (value === 'balanced') {
      return 'novel'
    }
    return 'novel'
  }
  if (value === 'novel') {
    return 'balanced'
  }
  if (value === 'balanced') {
    return 'familiar'
  }
  return 'familiar'
}

function incrementMomentTypeStat(stats: MomentVenueStats, momentType: AggregationMomentType): void {
  if (momentType === 'anchor') {
    stats.anchor += 1
    return
  }
  if (momentType === 'supporting') {
    stats.supporting += 1
    return
  }
  if (momentType === 'temporal') {
    stats.temporal += 1
    return
  }
  if (momentType === 'discovery') {
    stats.discovery += 1
    return
  }
  stats.community += 1
}

function buildMomentVenueStats(moments: AggregatedMoment[]): Map<string, MomentVenueStats> {
  const statsByVenue = new Map<string, MomentVenueStats>()
  moments.forEach((moment) => {
    if (!moment.venueId) {
      return
    }
    const existing = statsByVenue.get(moment.venueId) ?? {
      maxStrength: 0,
      anchor: 0,
      supporting: 0,
      temporal: 0,
      discovery: 0,
      community: 0,
    }
    existing.maxStrength = Math.max(existing.maxStrength, moment.strength)
    incrementMomentTypeStat(existing, moment.momentType)
    statsByVenue.set(moment.venueId, existing)
  })
  return statsByVenue
}

function getMomentEcsScore(moment: AggregatedMoment, ecs: LiveDistrictOpportunityBuilderEcsState): number {
  let score = moment.strength * 0.72 + moment.intentFit * 0.2 + moment.timingRelevance * 0.08
  if (ecs.exploration === 'focused') {
    if (moment.momentType === 'anchor') {
      score += 0.05
    } else if (moment.momentType === 'supporting') {
      score += 0.04
    } else if (moment.momentType === 'discovery' || moment.momentType === 'community') {
      score += 0.02
    }
  } else {
    if (moment.momentType === 'discovery') {
      score += 0.11
    } else if (moment.momentType === 'community') {
      score += 0.09
    } else if (moment.momentType === 'temporal') {
      score += 0.05
    } else if (moment.momentType === 'anchor') {
      score -= 0.03
    }
  }
  if (ecs.discovery === 'discover') {
    if (moment.momentType === 'discovery') {
      score += 0.16
    } else if (moment.momentType === 'community') {
      score += 0.12
    } else if (moment.momentType === 'anchor') {
      score -= 0.05
    }
  } else if (moment.momentType === 'anchor') {
    score += 0.06
  } else if (moment.momentType === 'supporting') {
    score += 0.05
  } else if (moment.momentType === 'discovery' || moment.momentType === 'community') {
    score += 0.02
  }
  if (ecs.highlight === 'standout') {
    if (moment.momentType === 'anchor') {
      score += 0.08
    } else if (moment.momentType === 'temporal') {
      score += 0.04
    } else if (moment.momentType === 'discovery') {
      score += 0.02
    }
  } else if (moment.momentType === 'anchor') {
    score -= 0.1
  } else if (moment.momentType === 'supporting') {
    score += 0.07
  }
  return score
}

function reshapeMoments(
  moments: TasteOpportunityAggregation['moments'],
  ecs: LiveDistrictOpportunityBuilderEcsState,
): TasteOpportunityAggregation['moments'] {
  const combined = [...moments.primary, ...moments.secondary]
  if (combined.length === 0) {
    return { primary: [], secondary: [] }
  }
  const ranked = combined
    .slice()
    .sort((left, right) => {
      const scoreDiff = getMomentEcsScore(right, ecs) - getMomentEcsScore(left, ecs)
      if (scoreDiff !== 0) {
        return scoreDiff
      }
      if (right.strength !== left.strength) {
        return right.strength - left.strength
      }
      return left.id.localeCompare(right.id)
    })
  const diversified =
    ecs.exploration === 'exploratory'
      ? (() => {
          const usedVenueIds = new Set<string>()
          const prioritized: AggregatedMoment[] = []
          const overflow: AggregatedMoment[] = []
          ranked.forEach((moment) => {
            if (moment.venueId && !usedVenueIds.has(moment.venueId)) {
              usedVenueIds.add(moment.venueId)
              prioritized.push(moment)
              return
            }
            overflow.push(moment)
          })
          return [...prioritized, ...overflow]
        })()
      : ranked
  const primaryCount = Math.max(1, moments.primary.length)
  const secondaryCount = moments.secondary.length
  return {
    primary: diversified.slice(0, primaryCount),
    secondary: diversified.slice(primaryCount, primaryCount + secondaryCount),
  }
}

function getRoleCandidateEcsScore(
  candidate: TasteOpportunityRoleCandidate,
  role: AggregationRole,
  statsByVenue: Map<string, MomentVenueStats>,
  ecs: LiveDistrictOpportunityBuilderEcsState,
  strongestHighlightVenueId: string | undefined,
): number {
  const stats = statsByVenue.get(candidate.venueId)
  const hasAnchor = (stats?.anchor ?? 0) > 0
  const hasSupporting = (stats?.supporting ?? 0) > 0
  const hasDiscovery = (stats?.discovery ?? 0) > 0
  const hasCommunity = (stats?.community ?? 0) > 0
  const hasTemporal = (stats?.temporal ?? 0) > 0
  let score = candidate.score
  if (ecs.exploration === 'focused') {
    score += candidate.score * 0.06
    if (hasAnchor) {
      score += 0.03
    }
  } else {
    score += hasDiscovery || hasCommunity ? 0.1 : 0
    score += hasTemporal ? 0.04 : 0
    score += hasAnchor ? -0.04 : 0.03
    score += (1 - candidate.score) * 0.03
  }
  if (ecs.discovery === 'discover') {
    score += hasDiscovery ? 0.12 : 0
    score += hasCommunity ? 0.08 : 0
    score -= hasAnchor && !hasDiscovery && !hasCommunity ? 0.05 : 0
  } else {
    score += hasAnchor ? 0.05 : 0
    score += hasSupporting ? 0.05 : 0
    score += hasDiscovery ? 0.01 : 0
    score += hasCommunity ? 0.01 : 0
  }
  const highlightWeight = role === 'highlight' ? 1 : 0.45
  if (ecs.highlight === 'standout') {
    score += highlightWeight * (hasAnchor ? 0.07 : 0)
    score += highlightWeight * (hasTemporal ? 0.04 : 0)
    score += highlightWeight * (hasDiscovery ? 0.015 : 0)
    score += highlightWeight * candidate.score * 0.04
    if (role === 'highlight' && candidate.venueId === strongestHighlightVenueId) {
      score += 0.05
    }
  } else {
    score -= highlightWeight * (hasAnchor ? 0.08 : 0)
    score += highlightWeight * (hasSupporting ? 0.06 : 0)
    score += highlightWeight * (hasDiscovery ? 0.04 : 0)
    score += highlightWeight * (1 - candidate.score) * 0.05
  }
  score += (stats?.maxStrength ?? 0) * 0.03
  return clampScore(score)
}

function reshapeRoleCandidates(
  candidates: TasteOpportunityRoleCandidate[],
  role: AggregationRole,
  statsByVenue: Map<string, MomentVenueStats>,
  ecs: LiveDistrictOpportunityBuilderEcsState,
  strongestHighlightVenueId: string | undefined,
): TasteOpportunityRoleCandidate[] {
  return candidates
    .slice()
    .sort((left, right) => {
      const scoreDiff =
        getRoleCandidateEcsScore(right, role, statsByVenue, ecs, strongestHighlightVenueId) -
        getRoleCandidateEcsScore(left, role, statsByVenue, ecs, strongestHighlightVenueId)
      if (scoreDiff !== 0) {
        return scoreDiff
      }
      if (right.score !== left.score) {
        return right.score - left.score
      }
      return left.venueName.localeCompare(right.venueName)
    })
}

function inferHighlightTier(
  candidate: TasteOpportunityRoleCandidate | undefined,
  originalStrongestHighlight: TasteOpportunityAggregation['anchors']['strongestHighlight'],
): number | undefined {
  if (!candidate) {
    return undefined
  }
  if (originalStrongestHighlight?.venueId === candidate.venueId) {
    return originalStrongestHighlight.tier
  }
  if (candidate.score >= 0.72) {
    return 1
  }
  if (candidate.score >= 0.56) {
    return 2
  }
  return 3
}

function applyExplorationControlsToAggregation(
  aggregation: TasteOpportunityAggregation,
  ecs: LiveDistrictOpportunityBuilderEcsState,
): TasteOpportunityAggregation {
  const nextMoments = reshapeMoments(aggregation.moments, ecs)
  const momentStatsByVenue = buildMomentVenueStats([
    ...nextMoments.primary,
    ...nextMoments.secondary,
  ])
  const strongestHighlightVenueId = aggregation.anchors.strongestHighlight?.venueId

  const startCandidates = reshapeRoleCandidates(
    aggregation.ingredients.startCandidates,
    'start',
    momentStatsByVenue,
    ecs,
    strongestHighlightVenueId,
  )
  const highlightCandidates = reshapeRoleCandidates(
    aggregation.ingredients.highlightCandidates,
    'highlight',
    momentStatsByVenue,
    ecs,
    strongestHighlightVenueId,
  )
  const windDownCandidates = reshapeRoleCandidates(
    aggregation.ingredients.windDownCandidates,
    'windDown',
    momentStatsByVenue,
    ecs,
    strongestHighlightVenueId,
  )

  const strongestHighlight = highlightCandidates[0]
  const strongestHighlightTier = inferHighlightTier(
    strongestHighlight,
    aggregation.anchors.strongestHighlight,
  )
  const nextMovementProfile =
    ecs.exploration === 'exploratory'
      ? aggregation.summary.movementProfile === 'tight'
        ? 'moderate'
        : aggregation.summary.movementProfile
      : aggregation.summary.movementProfile === 'spread'
        ? 'moderate'
        : aggregation.summary.movementProfile
  const nextHighlightPotential =
    ecs.highlight === 'standout'
      ? shiftHighlightPotential(aggregation.summary.highlightPotential, 'up')
      : shiftHighlightPotential(aggregation.summary.highlightPotential, 'down')
  const nextDiscoveryBalance =
    ecs.discovery === 'discover'
      ? shiftDiscoveryBalance(aggregation.summary.discoveryBalance, 'toward_discover')
      : shiftDiscoveryBalance(aggregation.summary.discoveryBalance, 'toward_reliable')

  return {
    ...aggregation,
    summary: {
      ...aggregation.summary,
      movementProfile: nextMovementProfile,
      highlightPotential: nextHighlightPotential,
      discoveryBalance: nextDiscoveryBalance,
    },
    ingredients: {
      startCandidates,
      highlightCandidates,
      windDownCandidates,
    },
    anchors: {
      strongestStart: startCandidates[0],
      strongestHighlight:
        strongestHighlight && typeof strongestHighlightTier === 'number'
          ? {
              ...strongestHighlight,
              tier: strongestHighlightTier,
            }
          : undefined,
      strongestWindDown: windDownCandidates[0],
    },
    moments: nextMoments,
  }
}
