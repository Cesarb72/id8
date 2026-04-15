import { previewDistrictRecommendations } from '../src/domain/previewDistrictRecommendations'
import { getHospitalityScenarioContract } from '../src/domain/interpretation/taste/scenarioContracts'
import { buildExperienceContractFromScenarioContract } from '../src/domain/interpretation/contracts/experienceContract'
import { applyScenarioContractToAggregation } from '../src/domain/interpretation/taste/applyScenarioContractToOpportunityAggregation'
import { applyExperienceContractToAggregation } from '../src/domain/interpretation/taste/applyExperienceContractToOpportunityAggregation'
import { deriveStep2AuthoritySignals } from '../src/domain/interpretation/taste/step2AuthorityConviction'
import type {
  TasteOpportunityAggregation,
  TasteOpportunityRoleCandidate,
} from '../src/domain/interpretation/taste/aggregateTasteOpportunityFromVenues'

type ExplorationControlState = {
  exploration: 'focused' | 'exploratory'
  discovery: 'reliable' | 'discover'
  highlight: 'casual' | 'standout'
}

const ecs: ExplorationControlState = {
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

function toConciseRoleReason(role: 'start' | 'windDown', rawReason: string | undefined, fallbackReason: string): string {
  const reason = (rawReason ?? '').toLowerCase()
  if (role === 'start') {
    if (reason.includes('easy') || reason.includes('entry')) return 'easier opener'
    if (reason.includes('conversation') || reason.includes('social')) return 'social opener'
    if (reason.includes('steady')) return 'steady opener'
    if (reason.includes('nearby')) return 'nearby opener'
    return fallbackReason
  }
  if (reason.includes('soft') || reason.includes('calm') || reason.includes('landing')) return 'soft close'
  if (reason.includes('quiet')) return 'quiet finish'
  if (reason.includes('steady')) return 'steady close'
  if (reason.includes('nearby')) return 'nearby close'
  return fallbackReason
}

function toCityOpportunityStopOptions(
  candidates: TasteOpportunityRoleCandidate[] | undefined,
  role: 'start' | 'windDown',
): Array<{name:string;reason:string;score:number}> {
  return (candidates ?? []).slice(0,2).map((candidate)=>({
    name: candidate.venueName,
    reason: toConciseRoleReason(role, candidate.reason, role==='start' ? 'easy opener' : 'soft close nearby'),
    score: candidate.score,
  }))
}

function getCityOpportunityHappenings(
  aggregation: TasteOpportunityAggregation | undefined,
): Array<{name:string;type?:string;reason:string;timingLabel?:string;strength:number}> {
  if (!aggregation) return []
  const priorityByType: Record<AggregationMoment['momentType'], number> = {
    temporal: 5,
    discovery: 4,
    community: 3,
    supporting: 2,
    anchor: 1,
  }
  return [...aggregation.moments.primary, ...aggregation.moments.secondary]
    .filter((moment) => moment.momentType !== 'anchor' && moment.strength >= 0.6)
    .sort((left, right) => {
      const priorityDiff = (priorityByType[right.momentType] ?? 0) - (priorityByType[left.momentType] ?? 0)
      if (priorityDiff !== 0) return priorityDiff
      if (right.strength !== left.strength) return right.strength - left.strength
      return left.id.localeCompare(right.id)
    })
    .filter((moment, index, all) => all.findIndex((entry) => entry.title === moment.title) === index)
    .slice(0, 2)
    .map((moment) => ({
      name: moment.title,
      type: moment.momentType,
      timingLabel: moment.liveContext?.timeWindowLabel,
      strength: moment.strength,
      reason: moment.reason,
    }))
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

function getMomentEcsScore(moment: AggregationMoment): number {
  let score = moment.strength * 0.72 + moment.intentFit * 0.2 + moment.timingRelevance * 0.08
  if (ecs.exploration === 'focused') {
    if (moment.momentType === 'anchor') score += 0.05
    else if (moment.momentType === 'supporting') score += 0.04
    else if (moment.momentType === 'discovery' || moment.momentType === 'community') score += 0.02
  }
  if (ecs.discovery === 'reliable') {
    if (moment.momentType === 'anchor') score += 0.06
    else if (moment.momentType === 'supporting') score += 0.05
    else if (moment.momentType === 'discovery' || moment.momentType === 'community') score += 0.02
  }
  if (ecs.highlight === 'standout') {
    if (moment.momentType === 'anchor') score += 0.08
    else if (moment.momentType === 'temporal') score += 0.04
    else if (moment.momentType === 'discovery') score += 0.02
  }
  return score
}

function reshapeMoments(moments: TasteOpportunityAggregation['moments']): TasteOpportunityAggregation['moments'] {
  const combined = [...moments.primary, ...moments.secondary]
  if (combined.length === 0) return { primary: [], secondary: [] }
  const ranked = combined
    .slice()
    .sort((left, right) => {
      const scoreDiff = getMomentEcsScore(right) - getMomentEcsScore(left)
      if (scoreDiff !== 0) return scoreDiff
      return left.id.localeCompare(right.id)
    })
  return {
    primary: ranked.slice(0, moments.primary.length),
    secondary: ranked.slice(moments.primary.length, moments.primary.length + moments.secondary.length),
  }
}

function getRoleCandidateEcsScore(candidate: TasteOpportunityRoleCandidate, role: AggregationRole, statsByVenue: Map<string, MomentVenueStats>, strongestHighlightVenueId: string | undefined): number {
  const stats = statsByVenue.get(candidate.venueId)
  const hasAnchor = (stats?.anchor ?? 0) > 0
  const hasSupporting = (stats?.supporting ?? 0) > 0
  const hasDiscovery = (stats?.discovery ?? 0) > 0
  const hasCommunity = (stats?.community ?? 0) > 0
  const hasTemporal = (stats?.temporal ?? 0) > 0
  let score = candidate.score
  score += hasAnchor ? 0.05 : 0
  score += hasSupporting ? 0.05 : 0
  score += hasDiscovery ? 0.01 : 0
  score += hasCommunity ? 0.01 : 0
  const highlightWeight = role === 'highlight' ? 1 : 0.45
  score += highlightWeight * (hasAnchor ? 0.07 : 0)
  score += highlightWeight * (hasTemporal ? 0.04 : 0)
  score += highlightWeight * (hasDiscovery ? 0.015 : 0)
  score += highlightWeight * candidate.score * 0.04
  if (role === 'highlight' && candidate.venueId === strongestHighlightVenueId) {
    score += 0.05
  }
  score += (stats?.maxStrength ?? 0) * 0.03
  return clampScore(score)
}

function reshapeRoleCandidates(candidates: TasteOpportunityRoleCandidate[], role: AggregationRole, statsByVenue: Map<string, MomentVenueStats>, strongestHighlightVenueId: string | undefined): TasteOpportunityRoleCandidate[] {
  return candidates.slice().sort((left, right) => {
    const scoreDiff = getRoleCandidateEcsScore(right, role, statsByVenue, strongestHighlightVenueId) - getRoleCandidateEcsScore(left, role, statsByVenue, strongestHighlightVenueId)
    if (scoreDiff !== 0) return scoreDiff
    return left.venueName.localeCompare(right.venueName)
  })
}

function applyExplorationControlsToAggregation(aggregation: TasteOpportunityAggregation): TasteOpportunityAggregation {
  const nextMoments = reshapeMoments(aggregation.moments)
  const momentStatsByVenue = buildMomentVenueStats([...nextMoments.primary, ...nextMoments.secondary])
  const strongestHighlightVenueId = aggregation.anchors.strongestHighlight?.venueId
  const startCandidates = reshapeRoleCandidates(aggregation.ingredients.startCandidates,'start',momentStatsByVenue,strongestHighlightVenueId)
  const highlightCandidates = reshapeRoleCandidates(aggregation.ingredients.highlightCandidates,'highlight',momentStatsByVenue,strongestHighlightVenueId)
  const windDownCandidates = reshapeRoleCandidates(aggregation.ingredients.windDownCandidates,'windDown',momentStatsByVenue,strongestHighlightVenueId)

  const nextMovementProfile = aggregation.summary.movementProfile === 'spread' ? 'moderate' : aggregation.summary.movementProfile
  const nextHighlightPotential = shiftHighlightPotential(aggregation.summary.highlightPotential, 'up')
  const nextDiscoveryBalance = shiftDiscoveryBalance(aggregation.summary.discoveryBalance, 'toward_reliable')

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
      strongestHighlight: highlightCandidates[0]
        ? {
            ...highlightCandidates[0],
            tier: aggregation.anchors.strongestHighlight?.venueId === highlightCandidates[0].venueId ? aggregation.anchors.strongestHighlight?.tier ?? 1 : highlightCandidates[0].score >= 0.72 ? 1 : highlightCandidates[0].score >= 0.56 ? 2 : 3,
          }
        : undefined,
      strongestWindDown: windDownCandidates[0],
    },
    moments: nextMoments,
  }
}

function vibeAuthorityLift(vibe: string, signals: ReturnType<typeof deriveStep2AuthoritySignals>): number {
  if (vibe === 'lively') {
    return (
      signals.nightlifeConviction * 0.16 +
      signals.majorEventConviction * 0.12 +
      signals.happeningAuthority * 0.06
    )
  }
  if (vibe === 'cultured') {
    return (
      signals.culturalConviction * 0.18 +
      signals.discoveryConviction * 0.12 +
      signals.majorEventConviction * 0.08
    )
  }
  return (
    signals.hiddenGemConviction * 0.16 +
    signals.windDownConviction * 0.12 +
    signals.discoveryConviction * 0.07
  )
}

const city='San Jose'
const persona='romantic'
const vibes=['cozy','lively','cultured'] as const

for (const vibe of vibes) {
  const preview = await previewDistrictRecommendations({ city, persona, primaryVibe: vibe, budget: '$$' })
  const scenario = getHospitalityScenarioContract({ city, persona, vibe })
  const experience = buildExperienceContractFromScenarioContract(scenario)
  const rows = preview.recommendedDistricts
    .filter((d) => Boolean(d.tasteAggregation))
    .map((district) => {
      const base = district.tasteAggregation!
      const shaped = applyExplorationControlsToAggregation(
        applyExperienceContractToAggregation(
          applyScenarioContractToAggregation(base, scenario),
          experience,
        ),
      )
      const starts = toCityOpportunityStopOptions(shaped.ingredients.startCandidates, 'start')
      const closes = toCityOpportunityStopOptions(shaped.ingredients.windDownCandidates, 'windDown')
      const happenings = getCityOpportunityHappenings(shaped)
      const authority = deriveStep2AuthoritySignals({
        city,
        persona,
        vibe,
        anchorName: shaped.anchors.strongestHighlight?.venueName,
        anchorReason: shaped.anchors.strongestHighlight?.reason,
        starts,
        closes,
        happenings,
        summary: shaped.summary,
      })
      const score =
        (shaped.anchors.strongestHighlight?.score ?? 0.44) * 0.32 +
        authority.overallAuthority * 0.26 +
        authority.anchorConviction * 0.14 +
        authority.startConviction * 0.09 +
        authority.windDownConviction * 0.09 +
        vibeAuthorityLift(vibe, authority) +
        (happenings[0]?.strength ?? 0) * 0.04
      return {
        district: district.name,
        anchor: shaped.anchors.strongestHighlight?.venueName ?? null,
        start: starts[0]?.name ?? null,
        windDown: closes[0]?.name ?? null,
        summary: shaped.summary,
        authority,
        score: Number(score.toFixed(3)),
      }
    })
    .sort((a,b)=>b.score-a.score)
    .slice(0,4)

  console.log('\n=== AUTHORITY PROBE', vibe, '===')
  for (const row of rows) {
    console.log(JSON.stringify({
      district: row.district,
      anchor: row.anchor,
      start: row.start,
      windDown: row.windDown,
      score: row.score,
      movement: row.summary.movementProfile,
      energy: row.summary.dominantEnergy,
      discovery: row.summary.discoveryBalance,
      authority: {
        overall: Number(row.authority.overallAuthority.toFixed(3)),
        anchor: Number(row.authority.anchorConviction.toFixed(3)),
        start: Number(row.authority.startConviction.toFixed(3)),
        windDown: Number(row.authority.windDownConviction.toFixed(3)),
        nightlife: Number(row.authority.nightlifeConviction.toFixed(3)),
        cultural: Number(row.authority.culturalConviction.toFixed(3)),
        majorEvent: Number(row.authority.majorEventConviction.toFixed(3)),
      },
    }))
  }
}
