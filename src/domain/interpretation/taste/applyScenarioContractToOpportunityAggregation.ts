import type {
  TasteOpportunityAggregation,
  TasteOpportunityRoleCandidate,
} from './aggregateTasteOpportunityFromVenues'
import type {
  HospitalityScenarioContract,
  ScenarioStopRole,
  ScenarioStopRule,
} from './scenarioContracts'
import type { DetectedMoment, DetectedMomentType } from './types'

type VenueMomentStats = {
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

function toFixed(value: number): number {
  return Number(clampScore(value).toFixed(3))
}

function normalizeToken(value: string | undefined | null): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function includesVenueNameMatch(name: string, candidates: string[] | undefined): boolean {
  if (!candidates || candidates.length === 0) {
    return false
  }
  const normalizedName = normalizeToken(name)
  return candidates.some((candidate) => {
    const normalizedCandidate = normalizeToken(candidate)
    if (!normalizedCandidate) {
      return false
    }
    return (
      normalizedName.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedName)
    )
  })
}

function splitMeaningfulTokens(value: string): string[] {
  return normalizeToken(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 4)
}

function hasPatternSignal(corpus: string, pattern: string): boolean {
  const normalizedPattern = normalizeToken(pattern)
  if (!normalizedPattern) {
    return false
  }
  if (corpus.includes(normalizedPattern)) {
    return true
  }
  const tokens = splitMeaningfulTokens(pattern)
  if (tokens.length === 0) {
    return false
  }
  let matched = 0
  tokens.forEach((token) => {
    if (corpus.includes(token)) {
      matched += 1
    }
  })
  return matched >= Math.min(2, tokens.length)
}

function getForbiddenPatternPenalty(
  text: string,
  forbiddenPatterns: string[] | undefined,
): number {
  if (!forbiddenPatterns || forbiddenPatterns.length === 0) {
    return 0
  }
  const corpus = normalizeToken(text)
  if (!corpus) {
    return 0
  }
  let penalty = 0
  forbiddenPatterns.forEach((pattern) => {
    if (hasPatternSignal(corpus, pattern)) {
      penalty += 0.08
    }
  })
  return Math.min(0.24, penalty)
}

function getStopRuleRole(rule: ScenarioStopRule): ScenarioStopRole | null {
  const stopType = normalizeToken(rule.stopType)
  if (stopType.includes('start') || stopType.includes('opener') || rule.position === 1) {
    return 'start'
  }
  if (
    stopType.includes('highlight') ||
    stopType.includes('anchor') ||
    stopType.includes('center') ||
    rule.position === 2
  ) {
    return 'highlight'
  }
  if (
    stopType.includes('wind') ||
    stopType.includes('close') ||
    stopType.includes('nightcap') ||
    rule.position >= 3
  ) {
    return 'windDown'
  }
  return null
}

function getRoleKeywords(contract: HospitalityScenarioContract, role: ScenarioStopRole): string[] {
  const tokens = new Set<string>()
  contract.stopRules.forEach((rule) => {
    const ruleRole = getStopRuleRole(rule)
    if (ruleRole !== role) {
      return
    }
    splitMeaningfulTokens(rule.stopType).forEach((token) => tokens.add(token))
    splitMeaningfulTokens(rule.purpose).forEach((token) => tokens.add(token))
    rule.examples?.forEach((example) =>
      splitMeaningfulTokens(example).forEach((token) => tokens.add(token)),
    )
  })
  return Array.from(tokens)
}

function matchesRoleKeywords(text: string, keywords: string[]): boolean {
  if (keywords.length === 0) {
    return false
  }
  const corpus = normalizeToken(text)
  if (!corpus) {
    return false
  }
  return keywords.some((keyword) => corpus.includes(keyword))
}

function incrementMomentType(stats: VenueMomentStats, momentType: DetectedMomentType): void {
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

function buildVenueMomentStats(moments: DetectedMoment[]): Map<string, VenueMomentStats> {
  const statsByVenueId = new Map<string, VenueMomentStats>()
  moments.forEach((moment) => {
    if (!moment.venueId) {
      return
    }
    const stats = statsByVenueId.get(moment.venueId) ?? {
      maxStrength: 0,
      anchor: 0,
      supporting: 0,
      temporal: 0,
      discovery: 0,
      community: 0,
    }
    stats.maxStrength = Math.max(stats.maxStrength, moment.strength)
    incrementMomentType(stats, moment.momentType)
    statsByVenueId.set(moment.venueId, stats)
  })
  return statsByVenueId
}

function getPreferredVenueBoost(
  venueName: string,
  contract: HospitalityScenarioContract,
  role: ScenarioStopRole,
): number {
  const preferredBoost = contract.selectionBias?.preferredVenueBoost ?? 0.14
  let boost = 0
  if (
    includesVenueNameMatch(venueName, contract.anchorRules.stronglyPreferredVenues) ||
    includesVenueNameMatch(venueName, contract.anchorRules.allowedVenues)
  ) {
    boost += preferredBoost
  }
  if (
    role === 'highlight' &&
    includesVenueNameMatch(venueName, contract.anchorRules.defaultPrimaryAnchors)
  ) {
    boost += preferredBoost * 0.7
  }
  if (
    includesVenueNameMatch(venueName, contract.hiddenGemRules.preferredHiddenGemVenues) &&
    contract.hiddenGemRules.routeLevelHiddenGemBias
  ) {
    boost += (contract.selectionBias?.hiddenGemBoost ?? 0.08) * 0.8
  }
  return boost
}

function getMomentTypeBoost(
  stats: VenueMomentStats | undefined,
  contract: HospitalityScenarioContract,
): number {
  if (!stats) {
    return 0
  }
  const momentTypeBoosts = contract.selectionBias?.momentTypeBoosts
  if (!momentTypeBoosts) {
    return 0
  }
  return (
    (momentTypeBoosts.anchor ?? 0) * Math.min(stats.anchor, 2) +
    (momentTypeBoosts.supporting ?? 0) * Math.min(stats.supporting, 2) +
    (momentTypeBoosts.temporal ?? 0) * Math.min(stats.temporal, 2) +
    (momentTypeBoosts.discovery ?? 0) * Math.min(stats.discovery, 2) +
    (momentTypeBoosts.community ?? 0) * Math.min(stats.community, 2)
  )
}

function scoreRoleCandidate(
  candidate: TasteOpportunityRoleCandidate,
  role: ScenarioStopRole,
  contract: HospitalityScenarioContract,
  statsByVenueId: Map<string, VenueMomentStats>,
  roleKeywords: string[],
): number {
  const stats = statsByVenueId.get(candidate.venueId)
  let score = candidate.score
  score += contract.selectionBias?.roleBoosts?.[role] ?? 0
  score += getPreferredVenueBoost(candidate.venueName, contract, role)
  score += getMomentTypeBoost(stats, contract) * 0.42
  if (contract.hiddenGemRules.routeLevelHiddenGemBias && stats) {
    if (stats.discovery > 0 || stats.community > 0) {
      score += contract.selectionBias?.hiddenGemBoost ?? 0.08
    }
  }
  if (matchesRoleKeywords(`${candidate.venueName} ${candidate.reason}`, roleKeywords)) {
    score += 0.06
  }
  if (includesVenueNameMatch(candidate.venueName, contract.anchorRules.avoidVenues)) {
    score -= 0.24
  }
  score -= getForbiddenPatternPenalty(
    `${candidate.venueName} ${candidate.reason}`,
    contract.anchorRules.forbiddenPatterns,
  )
  if (stats) {
    score += stats.maxStrength * 0.05
  }
  return clampScore(score)
}

function reshapeRoleCandidates(
  candidates: TasteOpportunityRoleCandidate[],
  role: ScenarioStopRole,
  contract: HospitalityScenarioContract,
  statsByVenueId: Map<string, VenueMomentStats>,
): TasteOpportunityRoleCandidate[] {
  const roleKeywords = getRoleKeywords(contract, role)
  return candidates
    .map((candidate) => ({
      ...candidate,
      score: toFixed(
        scoreRoleCandidate(candidate, role, contract, statsByVenueId, roleKeywords),
      ),
    }))
    .sort((left, right) => right.score - left.score || left.venueName.localeCompare(right.venueName))
}

function scoreMoment(moment: DetectedMoment, contract: HospitalityScenarioContract): number {
  const momentTypeBoosts = contract.selectionBias?.momentTypeBoosts ?? {}
  let score = moment.strength * 0.64 + moment.intentFit * 0.22 + moment.timingRelevance * 0.14
  score += momentTypeBoosts[moment.momentType] ?? 0
  if (
    includesVenueNameMatch(moment.title, contract.anchorRules.stronglyPreferredVenues) ||
    includesVenueNameMatch(moment.title, contract.anchorRules.defaultPrimaryAnchors)
  ) {
    score += (contract.selectionBias?.preferredVenueBoost ?? 0.14) * 0.8
  }
  if (
    contract.hiddenGemRules.routeLevelHiddenGemBias &&
    (moment.momentType === 'discovery' || moment.momentType === 'community')
  ) {
    score += contract.selectionBias?.hiddenGemBoost ?? 0.08
  }
  if (includesVenueNameMatch(moment.title, contract.anchorRules.avoidVenues)) {
    score -= 0.22
  }
  score -= getForbiddenPatternPenalty(moment.reason, contract.anchorRules.forbiddenPatterns)
  return clampScore(score)
}

function reshapeMoments(
  moments: TasteOpportunityAggregation['moments'],
  contract: HospitalityScenarioContract,
): TasteOpportunityAggregation['moments'] {
  const combined = [...moments.primary, ...moments.secondary]
  if (combined.length === 0) {
    return moments
  }
  const ranked = combined
    .slice()
    .sort((left, right) => {
      const scoreDiff = scoreMoment(right, contract) - scoreMoment(left, contract)
      if (scoreDiff !== 0) {
        return scoreDiff
      }
      if (right.strength !== left.strength) {
        return right.strength - left.strength
      }
      return left.id.localeCompare(right.id)
    })
  const primaryCount = moments.primary.length
  const secondaryCount = moments.secondary.length
  return {
    primary: ranked.slice(0, primaryCount),
    secondary: ranked.slice(primaryCount, primaryCount + secondaryCount),
  }
}

function deriveHighlightPotential(
  original: TasteOpportunityAggregation['summary']['highlightPotential'],
  highlightScore: number | undefined,
): TasteOpportunityAggregation['summary']['highlightPotential'] {
  if (typeof highlightScore !== 'number') {
    return original
  }
  if (highlightScore >= 0.72) {
    return 'high'
  }
  if (highlightScore >= 0.54) {
    return 'medium'
  }
  return 'low'
}

function deriveDiscoveryBalance(
  original: TasteOpportunityAggregation['summary']['discoveryBalance'],
  moments: TasteOpportunityAggregation['moments'],
  contract: HospitalityScenarioContract,
): TasteOpportunityAggregation['summary']['discoveryBalance'] {
  const allMoments = [...moments.primary, ...moments.secondary]
  if (allMoments.length === 0) {
    return original
  }
  const discoveryLikeCount = allMoments.filter(
    (moment) =>
      moment.momentType === 'discovery' ||
      moment.momentType === 'community' ||
      moment.momentType === 'temporal',
  ).length
  const discoveryRatio = discoveryLikeCount / allMoments.length
  if (discoveryRatio >= 0.5) {
    return 'novel'
  }
  if (discoveryRatio >= 0.28) {
    return 'balanced'
  }
  if (contract.hiddenGemRules.routeLevelHiddenGemBias) {
    return 'balanced'
  }
  return 'familiar'
}

function inferHighlightTier(
  candidate: TasteOpportunityRoleCandidate | undefined,
  original: TasteOpportunityAggregation['anchors']['strongestHighlight'],
): number | undefined {
  if (!candidate) {
    return undefined
  }
  if (original?.venueId === candidate.venueId) {
    return original.tier
  }
  if (candidate.score >= 0.74) {
    return 1
  }
  if (candidate.score >= 0.58) {
    return 2
  }
  return 3
}

export function applyScenarioContractToAggregation(
  aggregation: TasteOpportunityAggregation,
  contract: HospitalityScenarioContract | null,
): TasteOpportunityAggregation {
  if (!contract) {
    return aggregation
  }
  const nextMoments = reshapeMoments(aggregation.moments, contract)
  const statsByVenueId = buildVenueMomentStats([...nextMoments.primary, ...nextMoments.secondary])
  const startCandidates = reshapeRoleCandidates(
    aggregation.ingredients.startCandidates,
    'start',
    contract,
    statsByVenueId,
  )
  const highlightCandidates = reshapeRoleCandidates(
    aggregation.ingredients.highlightCandidates,
    'highlight',
    contract,
    statsByVenueId,
  )
  const windDownCandidates = reshapeRoleCandidates(
    aggregation.ingredients.windDownCandidates,
    'windDown',
    contract,
    statsByVenueId,
  )
  const strongestHighlight = highlightCandidates[0]
  const strongestHighlightTier = inferHighlightTier(
    strongestHighlight,
    aggregation.anchors.strongestHighlight,
  )
  return {
    ...aggregation,
    summary: {
      ...aggregation.summary,
      highlightPotential: deriveHighlightPotential(
        aggregation.summary.highlightPotential,
        strongestHighlight?.score,
      ),
      discoveryBalance: deriveDiscoveryBalance(
        aggregation.summary.discoveryBalance,
        nextMoments,
        contract,
      ),
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
