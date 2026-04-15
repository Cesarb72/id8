import { previewDistrictRecommendations } from '../src/domain/previewDistrictRecommendations'
import { getHospitalityScenarioContract } from '../src/domain/interpretation/taste/scenarioContracts'
import { buildExperienceContractFromScenarioContract } from '../src/domain/interpretation/contracts/experienceContract'
import { applyScenarioContractToAggregation } from '../src/domain/interpretation/taste/applyScenarioContractToOpportunityAggregation'
import { applyExperienceContractToAggregation } from '../src/domain/interpretation/taste/applyExperienceContractToOpportunityAggregation'
import type {
  TasteOpportunityAggregation,
  TasteOpportunityRoleCandidate,
} from '../src/domain/interpretation/taste/aggregateTasteOpportunityFromVenues'

type ExplorationControlState = {
  exploration: 'focused' | 'exploratory'
  discovery: 'reliable' | 'discover'
  highlight: 'casual' | 'standout'
}

const DEFAULT_ECS_STATE: ExplorationControlState = {
  exploration: 'focused',
  discovery: 'reliable',
  highlight: 'standout',
}

type AggregationMoment = TasteOpportunityAggregation['moments']['primary'][number]
type AggregationMomentType = AggregationMoment['momentType']
type AggregationRole = 'start' | 'highlight' | 'windDown'

type MomentVenueStats = {
  maxStrength: number
  anchor: number
  supporting: number
  temporal: number
  discovery: number
  community: number
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function shiftHighlightPotential(
  value: TasteOpportunityAggregation['summary']['highlightPotential'],
  direction: 'up' | 'down',
): TasteOpportunityAggregation['summary']['highlightPotential'] {
  if (direction === 'up') {
    if (value === 'low') return 'medium'
    if (value === 'medium') return 'high'
    return 'high'
  }
  if (value === 'high') return 'medium'
  if (value === 'medium') return 'low'
  return 'low'
}

function shiftDiscoveryBalance(
  value: TasteOpportunityAggregation['summary']['discoveryBalance'],
  direction: 'toward_discover' | 'toward_reliable',
): TasteOpportunityAggregation['summary']['discoveryBalance'] {
  if (direction === 'toward_discover') {
    if (value === 'familiar') return 'balanced'
    if (value === 'balanced') return 'novel'
    return 'novel'
  }
  if (value === 'novel') return 'balanced'
  if (value === 'balanced') return 'familiar'
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

function buildMomentVenueStats(moments: AggregationMoment[]): Map<string, MomentVenueStats> {
  const statsByVenue = new Map<string, MomentVenueStats>()
  moments.forEach((moment) => {
    if (!moment.venueId) return
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

function getMomentEcsScore(moment: AggregationMoment, ecs: ExplorationControlState): number {
  let score = moment.strength * 0.72 + moment.intentFit * 0.2 + moment.timingRelevance * 0.08
  if (ecs.exploration === 'focused') {
    if (moment.momentType === 'anchor') score += 0.08
    else if (moment.momentType === 'supporting') score += 0.04
  } else {
    if (moment.momentType === 'discovery') score += 0.11
    else if (moment.momentType === 'community') score += 0.09
    else if (moment.momentType === 'temporal') score += 0.05
    else if (moment.momentType === 'anchor') score -= 0.03
  }
  if (ecs.discovery === 'discover') {
    if (moment.momentType === 'discovery') score += 0.16
    else if (moment.momentType === 'community') score += 0.12
    else if (moment.momentType === 'anchor') score -= 0.05
  } else if (moment.momentType === 'anchor') score += 0.1
  else if (moment.momentType === 'supporting') score += 0.05

  if (ecs.highlight === 'standout') {
    if (moment.momentType === 'anchor') score += 0.14
    else if (moment.momentType === 'temporal') score += 0.06
  } else if (moment.momentType === 'anchor') score -= 0.1
  else if (moment.momentType === 'supporting') score += 0.07

  return score
}

function reshapeMoments(
  moments: TasteOpportunityAggregation['moments'],
  ecs: ExplorationControlState,
): TasteOpportunityAggregation['moments'] {
  const combined = [...moments.primary, ...moments.secondary]
  if (combined.length === 0) return { primary: [], secondary: [] }
  const ranked = combined
    .slice()
    .sort((left, right) => {
      const scoreDiff = getMomentEcsScore(right, ecs) - getMomentEcsScore(left, ecs)
      if (scoreDiff !== 0) return scoreDiff
      if (right.strength !== left.strength) return right.strength - left.strength
      return left.id.localeCompare(right.id)
    })
  const primaryCount = Math.max(1, moments.primary.length)
  const secondaryCount = moments.secondary.length
  return {
    primary: ranked.slice(0, primaryCount),
    secondary: ranked.slice(primaryCount, primaryCount + secondaryCount),
  }
}

function getRoleCandidateEcsScore(
  candidate: TasteOpportunityRoleCandidate,
  role: AggregationRole,
  statsByVenue: Map<string, MomentVenueStats>,
  ecs: ExplorationControlState,
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
    if (hasAnchor) score += 0.03
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
    score += hasAnchor ? 0.08 : 0
    score += hasSupporting ? 0.05 : 0
    score -= hasDiscovery ? 0.03 : 0
  }
  const highlightWeight = role === 'highlight' ? 1 : 0.45
  if (ecs.highlight === 'standout') {
    score += highlightWeight * (hasAnchor ? 0.12 : 0)
    score += highlightWeight * (hasTemporal ? 0.05 : 0)
    score += highlightWeight * candidate.score * 0.04
    if (role === 'highlight' && candidate.venueId === strongestHighlightVenueId) score += 0.05
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
  ecs: ExplorationControlState,
  strongestHighlightVenueId: string | undefined,
): TasteOpportunityRoleCandidate[] {
  return candidates
    .slice()
    .sort((left, right) => {
      const scoreDiff =
        getRoleCandidateEcsScore(right, role, statsByVenue, ecs, strongestHighlightVenueId) -
        getRoleCandidateEcsScore(left, role, statsByVenue, ecs, strongestHighlightVenueId)
      if (scoreDiff !== 0) return scoreDiff
      if (right.score !== left.score) return right.score - left.score
      return left.venueName.localeCompare(right.venueName)
    })
}

function inferHighlightTier(
  candidate: TasteOpportunityRoleCandidate | undefined,
  originalStrongestHighlight: TasteOpportunityAggregation['anchors']['strongestHighlight'],
): number | undefined {
  if (!candidate) return undefined
  if (originalStrongestHighlight?.venueId === candidate.venueId) return originalStrongestHighlight.tier
  if (candidate.score >= 0.72) return 1
  if (candidate.score >= 0.56) return 2
  return 3
}

function applyExplorationControlsToAggregation(
  aggregation: TasteOpportunityAggregation,
  ecs: ExplorationControlState,
): TasteOpportunityAggregation {
  const nextMoments = reshapeMoments(aggregation.moments, ecs)
  const momentStatsByVenue = buildMomentVenueStats([...nextMoments.primary, ...nextMoments.secondary])
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
  const strongestHighlightTier = inferHighlightTier(strongestHighlight, aggregation.anchors.strongestHighlight)
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

const city = 'San Jose'
const persona = 'romantic'
const vibes = ['cozy', 'lively', 'cultured'] as const

for (const vibe of vibes) {
  const result = await previewDistrictRecommendations({
    city,
    persona,
    primaryVibe: vibe,
    budget: '$$',
  })
  const scenario = getHospitalityScenarioContract({ city, persona, vibe })
  const experience = buildExperienceContractFromScenarioContract(scenario)
  const ecs = DEFAULT_ECS_STATE

  const cards = result.recommendedDistricts
    .filter((district) => Boolean(district.tasteAggregation))
    .map((district) => {
      const base = district.tasteAggregation!
      const scenarioShaped = applyScenarioContractToAggregation(base, scenario)
      const experienceShaped = applyExperienceContractToAggregation(scenarioShaped, experience)
      const shaped = applyExplorationControlsToAggregation(experienceShaped, ecs)
      const anchor = shaped.anchors.strongestHighlight
      const start = shaped.ingredients.startCandidates[0]
      const wind = shaped.ingredients.windDownCandidates[0]
      const primaryMomentTypes = shaped.moments.primary.slice(0, 4).map((moment) => moment.momentType)
      return {
        district: district.name,
        anchor: anchor?.venueName ?? null,
        anchorScore: anchor?.score ?? null,
        start: start?.venueName ?? null,
        windDown: wind?.venueName ?? null,
        summary: shaped.summary,
        moments: primaryMomentTypes,
      }
    })
    .slice(0, 4)

  console.log('\n===', `${city} | ${persona} | ${vibe}`, '===')
  for (const card of cards) {
    console.log(JSON.stringify(card))
  }
}
