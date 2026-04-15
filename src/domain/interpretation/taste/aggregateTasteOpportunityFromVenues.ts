import { detectMomentsFromTaste } from './detectMoments'
import type { DetectedMoment, TasteHappeningsSignals, TasteSignals } from './types'

export type TasteAggregatedVenueInput = {
  venueId: string
  venueName: string
  districtId?: string
  districtLabel?: string
  lat?: number
  lng?: number
  fitScore?: number
  tasteSignals: TasteSignals
  context?: {
    persona?: string
    vibe?: string
    timeWindow?: string
  }
  sourceFlags?: {
    eventCapable?: boolean
    musicCapable?: boolean
    performanceCapable?: boolean
    highlightCapable?: boolean
    hasHappyHour?: boolean
  }
  hoursStatus?: string
  hoursConfidence?: number
  happenings?: TasteHappeningsSignals
}

export type TasteOpportunityRoleCandidate = {
  venueId: string
  venueName: string
  reason: string
  score: number
}

export type TasteOpportunityAggregation = {
  summary: {
    dominantEnergy: 'calm' | 'balanced' | 'lively'
    dominantSocialDensity: 'intimate' | 'mixed' | 'social'
    movementProfile: 'tight' | 'moderate' | 'spread'
    highlightPotential: 'low' | 'medium' | 'high'
    discoveryBalance: 'familiar' | 'balanced' | 'novel'
  }
  ingredients: {
    startCandidates: TasteOpportunityRoleCandidate[]
    highlightCandidates: TasteOpportunityRoleCandidate[]
    windDownCandidates: TasteOpportunityRoleCandidate[]
  }
  signatures: {
    openerTypes: string[]
    highlightTypes: string[]
    windDownTypes: string[]
    archetypes: string[]
    momentIdentities: string[]
  }
  anchors: {
    strongestStart?: TasteOpportunityRoleCandidate
    strongestHighlight?: TasteOpportunityRoleCandidate & { tier: number }
    strongestWindDown?: TasteOpportunityRoleCandidate
  }
  moments: {
    primary: DetectedMoment[]
    secondary: DetectedMoment[]
  }
  diagnostics: {
    venueCount: number
    roleCoverage: {
      start: number
      highlight: number
      windDown: number
    }
    familyDistribution: Record<string, number>
    momentDistribution: Record<string, number>
  }
}

type RoleName = 'start' | 'highlight' | 'windDown'

const DEFAULT_MAX_ROLE_CANDIDATES = 4

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function toFixed(value: number): number {
  return Number(value.toFixed(3))
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function weightedAverage(values: Array<{ value: number; weight: number }>): number {
  if (values.length === 0) {
    return 0
  }
  const denominator = values.reduce((sum, entry) => sum + entry.weight, 0)
  if (denominator <= 0) {
    return 0
  }
  return values.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / denominator
}

function getFitWeight(input: TasteAggregatedVenueInput): number {
  return clamp((input.fitScore ?? 0.5) * 0.5 + 0.5, 0.4, 1)
}

function getHappeningsMetric(
  input: TasteAggregatedVenueInput,
  key: keyof TasteHappeningsSignals,
): number {
  return clamp(input.happenings?.[key] ?? 0, 0, 1)
}

function getHighlightTierScore(tier: number): number {
  if (tier === 1) {
    return 1
  }
  if (tier === 2) {
    return 0.72
  }
  return 0.44
}

function getArchetypeLabel(archetype: TasteSignals['primaryExperienceArchetype']): string {
  if (archetype === 'dining') {
    return 'dining-led'
  }
  if (archetype === 'drinks') {
    return 'drinks-led'
  }
  if (archetype === 'sweet') {
    return 'dessert-led'
  }
  if (archetype === 'outdoor') {
    return 'outdoor-led'
  }
  if (archetype === 'activity') {
    return 'activity-led'
  }
  if (archetype === 'culture') {
    return 'culture-led'
  }
  if (archetype === 'scenic') {
    return 'scenic-led'
  }
  return 'social-led'
}

function buildRoleReason(
  role: RoleName,
  input: TasteAggregatedVenueInput,
  score: number,
): string {
  const signals = input.tasteSignals
  const archetype = getArchetypeLabel(signals.primaryExperienceArchetype)
  if (role === 'start') {
    if (signals.momentIdentity.type === 'arrival' || signals.momentIdentity.type === 'explore') {
      return `easy-entry ${archetype} with clear opener fit`
    }
    return `strong opener fit with steady social entry`
  }
  if (role === 'highlight') {
    if (signals.highlightTier === 1) {
      return `signature highlight read with strong anchor pull`
    }
    if (signals.momentIntensity.tier === 'exceptional' || signals.momentIntensity.tier === 'signature') {
      return `high-intensity centerpiece with durable peak fit`
    }
    return score >= 0.62
      ? `balanced central moment with reliable highlight fit`
      : `supporting highlight option in current pool`
  }
  if (signals.momentIdentity.type === 'close' || signals.energy <= 0.45) {
    return `soft landing profile with calmer closing read`
  }
  return `wind-down compatible stop with stable close fit`
}

function scoreRoleCandidate(role: RoleName, input: TasteAggregatedVenueInput): number {
  const signals = input.tasteSignals
  const fitWeight = getFitWeight(input)
  if (role === 'start') {
    return clamp(
      signals.roleSuitability.start * 0.56 +
        signals.conversationFriendliness * 0.12 +
        signals.intimacy * 0.11 +
        (1 - signals.energy) * 0.09 +
        signals.lingerFactor * 0.07 +
        getHappeningsMetric(input, 'currentRelevance') * 0.03 +
        getHappeningsMetric(input, 'hotspotStrength') * 0.03 +
        fitWeight * 0.05,
      0,
      1,
    )
  }
  if (role === 'highlight') {
    return clamp(
      signals.roleSuitability.highlight * 0.42 +
        getHighlightTierScore(signals.highlightTier) * 0.14 +
        signals.anchorStrength * 0.12 +
        signals.momentIntensity.score * 0.11 +
        signals.momentPotential.score * 0.09 +
        signals.destinationFactor * 0.06 +
        signals.experientialFactor * 0.04 +
        getHappeningsMetric(input, 'majorVenueStrength') * 0.03 +
        getHappeningsMetric(input, 'culturalAnchorPotential') * 0.03 +
        getHappeningsMetric(input, 'eventPotential') * 0.02 +
        fitWeight * 0.02,
      0,
      1,
    )
  }
  return clamp(
    signals.roleSuitability.windDown * 0.5 +
      signals.intimacy * 0.14 +
      signals.conversationFriendliness * 0.12 +
      (1 - signals.energy) * 0.1 +
      signals.lingerFactor * 0.09 +
      getHappeningsMetric(input, 'lateNightPotential') * 0.03 +
      getHappeningsMetric(input, 'currentRelevance') * 0.03 +
      fitWeight * 0.05,
    0,
    1,
  )
}

function countByKey(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, key) => {
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
}

function topKeys(values: string[], limit: number): string[] {
  const distribution = countByKey(values)
  return Object.entries(distribution)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([key]) => key)
}

function toRoleCandidate(role: RoleName, input: TasteAggregatedVenueInput): TasteOpportunityRoleCandidate {
  const score = scoreRoleCandidate(role, input)
  return {
    venueId: input.venueId,
    venueName: input.venueName,
    reason: buildRoleReason(role, input, score),
    score: toFixed(score),
  }
}

function getRoleCandidates(
  role: RoleName,
  inputs: TasteAggregatedVenueInput[],
  limit: number,
): TasteOpportunityRoleCandidate[] {
  return inputs
    .map((input) => toRoleCandidate(role, input))
    .sort((left, right) => right.score - left.score || left.venueName.localeCompare(right.venueName))
    .slice(0, limit)
}

function getDominantEnergy(inputs: TasteAggregatedVenueInput[]): 'calm' | 'balanced' | 'lively' {
  const value = weightedAverage(
    inputs.map((input) => ({ value: input.tasteSignals.energy, weight: getFitWeight(input) })),
  )
  if (value <= 0.42) {
    return 'calm'
  }
  if (value >= 0.64) {
    return 'lively'
  }
  return 'balanced'
}

function getDominantSocialDensity(
  inputs: TasteAggregatedVenueInput[],
): 'intimate' | 'mixed' | 'social' {
  const socialDensity = weightedAverage(
    inputs.map((input) => ({ value: input.tasteSignals.socialDensity, weight: getFitWeight(input) })),
  )
  const intimacy = weightedAverage(
    inputs.map((input) => ({ value: input.tasteSignals.intimacy, weight: getFitWeight(input) })),
  )
  if (intimacy >= 0.62 && socialDensity <= 0.58) {
    return 'intimate'
  }
  if (socialDensity >= 0.62) {
    return 'social'
  }
  return 'mixed'
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180
}

function distanceKm(left: { lat: number; lng: number }, right: { lat: number; lng: number }): number {
  const earthRadiusKm = 6371
  const dLat = toRadians(right.lat - left.lat)
  const dLng = toRadians(right.lng - left.lng)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(left.lat)) *
      Math.cos(toRadians(right.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadiusKm * c
}

function getMovementProfile(
  inputs: TasteAggregatedVenueInput[],
): 'tight' | 'moderate' | 'spread' {
  const withCoordinates = inputs.filter(
    (input) => typeof input.lat === 'number' && typeof input.lng === 'number',
  ) as Array<TasteAggregatedVenueInput & { lat: number; lng: number }>
  if (withCoordinates.length >= 3) {
    let maxDistance = 0
    for (let index = 0; index < withCoordinates.length; index += 1) {
      for (let cursor = index + 1; cursor < withCoordinates.length; cursor += 1) {
        maxDistance = Math.max(
          maxDistance,
          distanceKm(withCoordinates[index], withCoordinates[cursor]),
        )
      }
    }
    if (maxDistance <= 0.9) {
      return 'tight'
    }
    if (maxDistance >= 2.2) {
      return 'spread'
    }
    return 'moderate'
  }

  const avgConversation = average(inputs.map((input) => input.tasteSignals.conversationFriendliness))
  const avgIntimacy = average(inputs.map((input) => input.tasteSignals.intimacy))
  const avgEnergy = average(inputs.map((input) => input.tasteSignals.energy))
  const avgSocialDensity = average(inputs.map((input) => input.tasteSignals.socialDensity))
  const tightSignal =
    avgConversation * 0.34 + avgIntimacy * 0.28 + (1 - avgEnergy) * 0.2 + (1 - avgSocialDensity) * 0.18
  const spreadSignal =
    avgEnergy * 0.38 + avgSocialDensity * 0.32 + (1 - avgConversation) * 0.18 + (1 - avgIntimacy) * 0.12
  if (tightSignal - spreadSignal >= 0.08) {
    return 'tight'
  }
  if (spreadSignal - tightSignal >= 0.12) {
    return 'spread'
  }
  return 'moderate'
}

function getHighlightPotential(inputs: TasteAggregatedVenueInput[]): 'low' | 'medium' | 'high' {
  const topHighlight = getRoleCandidates('highlight', inputs, 1)[0]
  const topScore = topHighlight?.score ?? 0
  if (topScore >= 0.72) {
    return 'high'
  }
  if (topScore >= 0.52) {
    return 'medium'
  }
  return 'low'
}

function getDiscoveryBalance(inputs: TasteAggregatedVenueInput[]): 'familiar' | 'balanced' | 'novel' {
  const noveltySignal = weightedAverage(
    inputs.map((input) => ({
      value:
        input.tasteSignals.noveltyWeight * 0.55 +
        input.tasteSignals.momentPotential.score * 0.2 +
        input.tasteSignals.experientialFactor * 0.15 +
        input.tasteSignals.momentIntensity.score * 0.05 +
        getHappeningsMetric(input, 'hiddenGemStrength') * 0.05 +
        getHappeningsMetric(input, 'eventPotential') * 0.03 +
        getHappeningsMetric(input, 'culturalAnchorPotential') * 0.02,
      weight: getFitWeight(input),
    })),
  )
  if (noveltySignal >= 0.66) {
    return 'novel'
  }
  if (noveltySignal <= 0.42) {
    return 'familiar'
  }
  return 'balanced'
}

function getRoleSignature(role: RoleName, input: TasteAggregatedVenueInput): string {
  const signals = input.tasteSignals
  if (role === 'start') {
    if (signals.primaryExperienceArchetype === 'scenic' || signals.primaryExperienceArchetype === 'outdoor') {
      return 'scenic opener'
    }
    if (signals.momentIdentity.type === 'arrival') {
      return 'arrival-led opener'
    }
    if (signals.conversationFriendliness >= 0.62) {
      return 'conversation opener'
    }
    return 'steady opener'
  }
  if (role === 'highlight') {
    if (signals.highlightTier === 1) {
      return 'signature centerpiece'
    }
    if (signals.primaryExperienceArchetype === 'culture') {
      return 'cultural centerpiece'
    }
    if (signals.primaryExperienceArchetype === 'activity' || signals.primaryExperienceArchetype === 'social') {
      return 'lively centerpiece'
    }
    return 'balanced centerpiece'
  }
  if (signals.momentIdentity.type === 'close') {
    return 'clean close'
  }
  if (signals.intimacy >= 0.6 || signals.energy <= 0.45) {
    return 'soft landing'
  }
  return 'steady landing'
}

function getStrongestHighlightCandidate(
  candidates: TasteOpportunityRoleCandidate[],
  inputById: Map<string, TasteAggregatedVenueInput>,
): (TasteOpportunityRoleCandidate & { tier: number }) | undefined {
  const top = candidates[0]
  if (!top) {
    return undefined
  }
  const source = inputById.get(top.venueId)
  return source
    ? {
        ...top,
        tier: source.tasteSignals.highlightTier,
      }
    : {
        ...top,
        tier: 3,
    }
}

function getMomentTypePrimaryBoost(momentType: DetectedMoment['momentType']): number {
  if (momentType === 'anchor') {
    return 0.18
  }
  if (momentType === 'temporal') {
    return 0.12
  }
  if (momentType === 'discovery') {
    return 0.08
  }
  if (momentType === 'community') {
    return 0.07
  }
  return 0.02
}

function getMomentPriority(momentType: DetectedMoment['momentType']): number {
  if (momentType === 'anchor') {
    return 5
  }
  if (momentType === 'temporal') {
    return 4
  }
  if (momentType === 'discovery') {
    return 3
  }
  if (momentType === 'community') {
    return 2
  }
  return 1
}

function buildAggregatedMoments(
  inputs: TasteAggregatedVenueInput[],
): TasteOpportunityAggregation['moments'] {
  const allMoments = inputs.flatMap((input) =>
    detectMomentsFromTaste({
      venueId: input.venueId,
      venueName: input.venueName,
      districtId: input.districtId,
      districtLabel: input.districtLabel,
      tasteSignals: input.tasteSignals,
      context: input.context,
      sourceFlags: input.sourceFlags,
      hoursStatus: input.hoursStatus,
      hoursConfidence: input.hoursConfidence,
      happenings: input.happenings,
    }),
  )
  if (allMoments.length === 0) {
    return { primary: [], secondary: [] }
  }

  const ranked = allMoments
    .slice()
    .sort((left, right) => {
      const leftPrimaryScore =
        left.strength * 0.7 +
        left.intentFit * 0.2 +
        left.timingRelevance * 0.1 +
        getMomentTypePrimaryBoost(left.momentType)
      const rightPrimaryScore =
        right.strength * 0.7 +
        right.intentFit * 0.2 +
        right.timingRelevance * 0.1 +
        getMomentTypePrimaryBoost(right.momentType)
      if (rightPrimaryScore !== leftPrimaryScore) {
        return rightPrimaryScore - leftPrimaryScore
      }
      if (right.strength !== left.strength) {
        return right.strength - left.strength
      }
      return getMomentPriority(right.momentType) - getMomentPriority(left.momentType)
    })

  const primary: DetectedMoment[] = []
  const secondary: DetectedMoment[] = []
  for (const moment of ranked) {
    const primaryEligible =
      (moment.momentType === 'anchor' ||
        moment.momentType === 'temporal' ||
        moment.momentType === 'discovery' ||
        moment.momentType === 'community') &&
      moment.strength >= 0.58
    if (primaryEligible && primary.length < 4) {
      primary.push(moment)
      continue
    }
    if (secondary.length < 4 && moment.strength >= 0.5) {
      secondary.push(moment)
    }
  }

  if (primary.length === 0 && ranked[0]) {
    primary.push(ranked[0])
  }

  return {
    primary,
    secondary,
  }
}

export function aggregateTasteOpportunityFromVenues(
  inputs: TasteAggregatedVenueInput[],
): TasteOpportunityAggregation {
  const cleanInputs = inputs.filter((input) => Boolean(input?.tasteSignals))
  if (cleanInputs.length === 0) {
    return {
      summary: {
        dominantEnergy: 'balanced',
        dominantSocialDensity: 'mixed',
        movementProfile: 'moderate',
        highlightPotential: 'low',
        discoveryBalance: 'balanced',
      },
      ingredients: {
        startCandidates: [],
        highlightCandidates: [],
        windDownCandidates: [],
      },
      signatures: {
        openerTypes: [],
        highlightTypes: [],
        windDownTypes: [],
        archetypes: [],
        momentIdentities: [],
      },
      anchors: {},
      moments: {
        primary: [],
        secondary: [],
      },
      diagnostics: {
        venueCount: 0,
        roleCoverage: { start: 0, highlight: 0, windDown: 0 },
        familyDistribution: {},
        momentDistribution: {},
      },
    }
  }

  const startCandidates = getRoleCandidates('start', cleanInputs, DEFAULT_MAX_ROLE_CANDIDATES)
  const highlightCandidates = getRoleCandidates('highlight', cleanInputs, DEFAULT_MAX_ROLE_CANDIDATES)
  const windDownCandidates = getRoleCandidates('windDown', cleanInputs, DEFAULT_MAX_ROLE_CANDIDATES)
  const moments = buildAggregatedMoments(cleanInputs)
  const inputById = new Map(cleanInputs.map((input) => [input.venueId, input] as const))

  const archetypes = topKeys(
    cleanInputs.map((input) => input.tasteSignals.primaryExperienceArchetype),
    5,
  )
  const momentIdentities = topKeys(
    cleanInputs.map(
      (input) =>
        `${input.tasteSignals.momentIdentity.type}:${input.tasteSignals.momentIdentity.strength}`,
    ),
    5,
  )
  const familyDistribution = countByKey(
    cleanInputs.map((input) => input.tasteSignals.experienceFamily || 'unknown'),
  )
  const momentDistribution = countByKey(
    cleanInputs.map((input) => input.tasteSignals.momentIdentity.type),
  )

  return {
    summary: {
      dominantEnergy: getDominantEnergy(cleanInputs),
      dominantSocialDensity: getDominantSocialDensity(cleanInputs),
      movementProfile: getMovementProfile(cleanInputs),
      highlightPotential: getHighlightPotential(cleanInputs),
      discoveryBalance: getDiscoveryBalance(cleanInputs),
    },
    ingredients: {
      startCandidates,
      highlightCandidates,
      windDownCandidates,
    },
    signatures: {
      openerTypes: topKeys(startCandidates.map((candidate) => getRoleSignature('start', inputById.get(candidate.venueId)!)), 4),
      highlightTypes: topKeys(
        highlightCandidates.map((candidate) => getRoleSignature('highlight', inputById.get(candidate.venueId)!)),
        4,
      ),
      windDownTypes: topKeys(
        windDownCandidates.map((candidate) => getRoleSignature('windDown', inputById.get(candidate.venueId)!)),
        4,
      ),
      archetypes,
      momentIdentities,
    },
    anchors: {
      strongestStart: startCandidates[0],
      strongestHighlight: getStrongestHighlightCandidate(highlightCandidates, inputById),
      strongestWindDown: windDownCandidates[0],
    },
    moments,
    diagnostics: {
      venueCount: cleanInputs.length,
      roleCoverage: {
        start: cleanInputs.filter((input) => input.tasteSignals.roleSuitability.start >= 0.56)
          .length,
        highlight: cleanInputs.filter(
          (input) => input.tasteSignals.roleSuitability.highlight >= 0.6,
        ).length,
        windDown: cleanInputs.filter(
          (input) => input.tasteSignals.roleSuitability.windDown >= 0.56,
        ).length,
      },
      familyDistribution,
      momentDistribution,
    },
  }
}
