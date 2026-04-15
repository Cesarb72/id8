import type { ExperienceContract } from '../contracts/experienceContract'
import type {
  TasteOpportunityAggregation,
  TasteOpportunityRoleCandidate,
} from './aggregateTasteOpportunityFromVenues'
import type { DetectedMoment, DetectedMomentType } from './types'

type ScenarioStopRole = 'start' | 'highlight' | 'windDown'

type VenueMomentStats = {
  maxStrength: number
  averageIntentFit: number
  averageTimingRelevance: number
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
    const current = statsByVenueId.get(moment.venueId) ?? {
      maxStrength: 0,
      averageIntentFit: 0,
      averageTimingRelevance: 0,
      anchor: 0,
      supporting: 0,
      temporal: 0,
      discovery: 0,
      community: 0,
    }
    const count =
      current.anchor + current.supporting + current.temporal + current.discovery + current.community
    current.maxStrength = Math.max(current.maxStrength, moment.strength)
    current.averageIntentFit =
      (current.averageIntentFit * count + moment.intentFit) / Math.max(1, count + 1)
    current.averageTimingRelevance =
      (current.averageTimingRelevance * count + moment.timingRelevance) / Math.max(1, count + 1)
    incrementMomentType(current, moment.momentType)
    statsByVenueId.set(moment.venueId, current)
  })
  return statsByVenueId
}

function getMomentSignalBoost(
  stats: VenueMomentStats | undefined,
  role: ScenarioStopRole,
  contract: ExperienceContract,
): number {
  if (!stats) {
    return 0
  }
  let boost = 0
  if (role === 'highlight') {
    boost += stats.anchor * 0.055
    boost += stats.temporal * 0.024
    boost += stats.maxStrength * 0.06
  } else if (role === 'start') {
    boost += stats.supporting * 0.04
    boost += stats.discovery * 0.028
    boost += stats.averageIntentFit * 0.042
  } else {
    boost += stats.supporting * 0.042
    boost += stats.community * 0.026
    boost += (1 - stats.maxStrength) * 0.02
  }

  if (contract.highlightModel === 'earned_peak') {
    if (role === 'start' || role === 'windDown') {
      boost += stats.supporting * 0.03
      boost += stats.averageIntentFit * 0.03
    }
    if (role === 'highlight') {
      boost += stats.anchor * 0.032
    }
  } else if (contract.highlightModel === 'multi_peak') {
    boost += stats.temporal * 0.018
    boost += stats.anchor * 0.02
  } else if (contract.highlightModel === 'reflective_peak') {
    boost += stats.discovery * 0.026
    boost += stats.community * 0.022
    if (role === 'highlight') {
      boost -= stats.temporal * 0.014
    }
  } else if (contract.highlightModel === 'distributed') {
    boost += stats.supporting * 0.02
    boost -= stats.anchor * 0.01
  } else if (contract.highlightModel === 'single_peak') {
    boost += role === 'highlight' ? stats.anchor * 0.03 : -stats.anchor * 0.01
  }

  if (contract.movementStyle === 'contained' || contract.movementStyle === 'compressed') {
    boost += stats.supporting * 0.016
    boost -= stats.discovery * 0.014
  } else if (contract.movementStyle === 'exploratory') {
    boost += stats.discovery * 0.03
    boost += stats.community * 0.024
  } else if (contract.movementStyle === 'momentum_based') {
    boost += stats.temporal * 0.03
    boost += stats.anchor * 0.017
  }

  if (contract.pacingStyle === 'slow_build') {
    boost += role === 'start' ? 0.055 : 0
    boost += role === 'highlight' ? -0.014 : 0
  } else if (contract.pacingStyle === 'escalating') {
    boost += role === 'highlight' ? 0.052 : 0
    boost += role === 'windDown' ? 0.017 : 0
    boost += stats.temporal * 0.017
  } else if (contract.pacingStyle === 'deliberate') {
    boost += stats.discovery * 0.019
    boost += stats.supporting * 0.014
  } else if (contract.pacingStyle === 'recovery_led') {
    boost += role === 'windDown' ? 0.05 : 0
  } else if (contract.pacingStyle === 'elastic') {
    boost += stats.discovery * 0.009 + stats.temporal * 0.009
  }

  if (contract.socialPosture === 'intimate') {
    boost += role === 'start' || role === 'windDown' ? 0.028 : 0
    boost += stats.averageIntentFit * 0.018
  } else if (contract.socialPosture === 'shared_pulse') {
    boost += role === 'highlight' ? 0.036 : 0
    boost += stats.temporal * 0.02
  } else if (contract.socialPosture === 'reflective') {
    boost += stats.discovery * 0.022
    boost += stats.community * 0.015
  } else if (contract.socialPosture === 'group_social') {
    boost += stats.community * 0.02
  } else if (contract.socialPosture === 'family_rhythm') {
    boost += stats.supporting * 0.016
  }

  if (contract.coordinationMode === 'depth') {
    boost += role === 'highlight' ? 0.026 : 0.024
  } else if (contract.coordinationMode === 'pulse') {
    boost += role === 'highlight' ? 0.036 : 0.012
    boost += stats.temporal * 0.016
  } else if (contract.coordinationMode === 'narrative') {
    boost += stats.discovery * 0.021
    boost += stats.community * 0.018
  } else if (contract.coordinationMode === 'momentum') {
    boost += stats.temporal * 0.017
  } else if (contract.coordinationMode === 'play') {
    boost += stats.discovery * 0.015
  } else if (contract.coordinationMode === 'enrichment') {
    boost += stats.discovery * 0.014 + stats.supporting * 0.011
  } else if (contract.coordinationMode === 'balance') {
    boost += stats.supporting * 0.013
  } else if (contract.coordinationMode === 'hang') {
    boost += role === 'windDown' ? 0.018 : 0.01
  }

  return boost
}

function scoreRoleCandidate(
  candidate: TasteOpportunityRoleCandidate,
  role: ScenarioStopRole,
  contract: ExperienceContract,
  statsByVenueId: Map<string, VenueMomentStats>,
): number {
  const stats = statsByVenueId.get(candidate.venueId)
  const normalizedBoost = getMomentSignalBoost(stats, role, contract)
  let score = candidate.score + (normalizedBoost - 0.14) * 0.52
  if (contract.constraintPriorities.includes('tone_coherence') && stats) {
    score += stats.averageIntentFit * 0.02
  }
  if (contract.constraintPriorities.includes('friction_control')) {
    if (contract.movementStyle === 'contained' || contract.movementStyle === 'compressed') {
      score += role === 'start' || role === 'windDown' ? 0.01 : 0.006
    } else if (contract.movementStyle === 'exploratory') {
      score += stats ? stats.discovery * 0.01 : 0
    }
  }
  if (contract.constraintPriorities.includes('recovery') && role === 'windDown') {
    score += 0.012
  }
  if (contract.constraintPriorities.includes('capacity') && role === 'highlight') {
    score += stats ? stats.temporal * 0.01 : 0
  }
  if (stats) {
    if (
      contract.coordinationMode === 'pulse' ||
      contract.highlightModel === 'multi_peak' ||
      contract.pacingStyle === 'escalating'
    ) {
      const nightlifeSignal = stats.anchor + stats.temporal
      const reflectiveSignal = stats.discovery + stats.community
      if (nightlifeSignal >= reflectiveSignal + 1) {
        score += 0.03
      } else if (reflectiveSignal > nightlifeSignal) {
        score -= 0.03
      }
    }
    if (
      contract.coordinationMode === 'narrative' ||
      contract.highlightModel === 'reflective_peak' ||
      contract.pacingStyle === 'deliberate'
    ) {
      const reflectiveSignal = stats.discovery + stats.community
      const pulseSignal = stats.anchor + stats.temporal
      if (reflectiveSignal >= pulseSignal) {
        score += 0.04
      } else if (pulseSignal >= reflectiveSignal + 1) {
        score -= 0.035
      }
    }
    if (
      contract.coordinationMode === 'depth' ||
      contract.highlightModel === 'earned_peak' ||
      contract.pacingStyle === 'slow_build'
    ) {
      if (role !== 'highlight') {
        score += stats.supporting * 0.02
        score -= stats.temporal * 0.02
      }
      if (role === 'highlight' && stats.anchor > 0 && stats.supporting === 0) {
        score -= 0.018
      }
    }
  }
  if (candidate.score >= 0.84 && normalizedBoost > 0.3) {
    score -= 0.02
  }
  return clampScore(score)
}

function reshapeRoleCandidates(
  candidates: TasteOpportunityRoleCandidate[],
  role: ScenarioStopRole,
  contract: ExperienceContract,
  statsByVenueId: Map<string, VenueMomentStats>,
): TasteOpportunityRoleCandidate[] {
  return candidates
    .map((candidate) => ({
      ...candidate,
      score: toFixed(scoreRoleCandidate(candidate, role, contract, statsByVenueId)),
    }))
    .sort((left, right) => right.score - left.score || left.venueName.localeCompare(right.venueName))
}

function scoreMoment(moment: DetectedMoment, contract: ExperienceContract): number {
  let score = moment.strength * 0.58 + moment.intentFit * 0.28 + moment.timingRelevance * 0.14
  if (contract.highlightModel === 'earned_peak') {
    if (moment.momentType === 'anchor') {
      score += 0.072
    }
    if (moment.momentType === 'supporting') {
      score += 0.038
    }
  } else if (contract.highlightModel === 'multi_peak') {
    if (moment.momentType === 'anchor') {
      score += 0.052
    }
    if (moment.momentType === 'temporal') {
      score += 0.044
    }
  } else if (contract.highlightModel === 'reflective_peak') {
    if (moment.momentType === 'discovery' || moment.momentType === 'community') {
      score += 0.062
    }
    if (moment.momentType === 'temporal') {
      score -= 0.012
    }
  } else if (contract.highlightModel === 'distributed') {
    if (moment.momentType === 'supporting') {
      score += 0.03
    }
  }

  if (contract.movementStyle === 'exploratory') {
    if (moment.momentType === 'discovery' || moment.momentType === 'community') {
      score += 0.036
    }
  } else if (contract.movementStyle === 'contained' || contract.movementStyle === 'compressed') {
    if (moment.momentType === 'discovery') {
      score -= 0.014
    }
    if (moment.momentType === 'supporting') {
      score += 0.013
    }
  } else if (contract.movementStyle === 'momentum_based') {
    if (moment.momentType === 'temporal') {
      score += 0.034
    }
  }

  if (contract.pacingStyle === 'slow_build') {
    if (moment.momentType === 'supporting') {
      score += 0.03
    }
    if (moment.momentType === 'anchor') {
      score += 0.02
    }
  } else if (contract.pacingStyle === 'escalating') {
    if (moment.momentType === 'anchor' || moment.momentType === 'temporal') {
      score += 0.045
    }
  } else if (contract.pacingStyle === 'deliberate') {
    if (moment.momentType === 'discovery' || moment.momentType === 'community') {
      score += 0.033
    }
  } else if (contract.pacingStyle === 'recovery_led') {
    if (moment.momentType === 'supporting') {
      score += 0.02
    }
  }

  if (contract.socialPosture === 'intimate') {
    if (moment.momentType === 'supporting' || moment.momentType === 'anchor') {
      score += 0.018
    }
  } else if (contract.socialPosture === 'shared_pulse') {
    if (moment.momentType === 'anchor' || moment.momentType === 'temporal') {
      score += 0.025
    }
  } else if (contract.socialPosture === 'reflective') {
    if (moment.momentType === 'discovery' || moment.momentType === 'community') {
      score += 0.024
    }
  }

  if (
    contract.coordinationMode === 'pulse' ||
    contract.highlightModel === 'multi_peak' ||
    contract.pacingStyle === 'escalating'
  ) {
    if (moment.momentType === 'anchor' || moment.momentType === 'temporal') {
      score += 0.03
    } else if (moment.momentType === 'discovery' || moment.momentType === 'community') {
      score -= 0.016
    }
  }

  if (
    contract.coordinationMode === 'narrative' ||
    contract.highlightModel === 'reflective_peak' ||
    contract.pacingStyle === 'deliberate'
  ) {
    if (moment.momentType === 'discovery' || moment.momentType === 'community') {
      score += 0.042
    } else if (moment.momentType === 'temporal') {
      score -= 0.03
    } else if (moment.momentType === 'anchor') {
      score -= 0.012
    }
  }

  if (
    contract.coordinationMode === 'depth' ||
    contract.highlightModel === 'earned_peak' ||
    contract.pacingStyle === 'slow_build'
  ) {
    if (moment.momentType === 'supporting') {
      score += 0.035
    }
    if (moment.momentType === 'temporal') {
      score -= 0.026
    }
  }

  return clampScore(score)
}

function reshapeMoments(
  moments: TasteOpportunityAggregation['moments'],
  contract: ExperienceContract,
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
  if (candidate.score >= 0.76) {
    return 1
  }
  if (candidate.score >= 0.6) {
    return 2
  }
  return 3
}

function deriveMovementProfile(
  original: TasteOpportunityAggregation['summary']['movementProfile'],
  contract: ExperienceContract,
): TasteOpportunityAggregation['summary']['movementProfile'] {
  if (contract.movementStyle === 'contained' || contract.movementStyle === 'compressed') {
    if (original === 'spread') {
      return 'moderate'
    }
    return 'tight'
  }
  if (contract.movementStyle === 'exploratory') {
    if (original === 'tight') {
      return 'moderate'
    }
    return 'spread'
  }
  if (contract.movementStyle === 'momentum_based') {
    return original === 'tight' ? 'moderate' : original
  }
  return original
}

function shiftHighlightPotential(
  original: TasteOpportunityAggregation['summary']['highlightPotential'],
  direction: 'up' | 'down',
): TasteOpportunityAggregation['summary']['highlightPotential'] {
  const sequence: Array<TasteOpportunityAggregation['summary']['highlightPotential']> = [
    'low',
    'medium',
    'high',
  ]
  const index = sequence.indexOf(original)
  if (index < 0) {
    return original
  }
  if (direction === 'up') {
    return sequence[Math.min(sequence.length - 1, index + 1)]
  }
  return sequence[Math.max(0, index - 1)]
}

function deriveHighlightPotential(
  original: TasteOpportunityAggregation['summary']['highlightPotential'],
  strongestHighlightScore: number | undefined,
  contract: ExperienceContract,
): TasteOpportunityAggregation['summary']['highlightPotential'] {
  if (typeof strongestHighlightScore !== 'number') {
    return original
  }
  if (strongestHighlightScore >= 0.72) {
    return contract.highlightModel === 'reflective_peak'
      ? shiftHighlightPotential('high', 'down')
      : 'high'
  }
  if (strongestHighlightScore >= 0.54) {
    return 'medium'
  }
  const baseline = 'low'
  if (contract.highlightModel === 'multi_peak' || contract.highlightModel === 'earned_peak') {
    return shiftHighlightPotential(baseline, 'up')
  }
  return baseline
}

function deriveDiscoveryBalance(
  original: TasteOpportunityAggregation['summary']['discoveryBalance'],
  moments: TasteOpportunityAggregation['moments'],
  contract: ExperienceContract,
): TasteOpportunityAggregation['summary']['discoveryBalance'] {
  const all = [...moments.primary, ...moments.secondary]
  if (all.length === 0) {
    return original
  }
  const discoveryLike = all.filter(
    (moment) => moment.momentType === 'discovery' || moment.momentType === 'community',
  ).length
  const ratio = discoveryLike / all.length
  if (contract.movementStyle === 'exploratory' || contract.coordinationMode === 'narrative') {
    if (ratio >= 0.32) {
      return 'novel'
    }
    return ratio >= 0.18 ? 'balanced' : original
  }
  if (contract.movementStyle === 'contained' || contract.movementStyle === 'compressed') {
    if (ratio <= 0.12) {
      return 'familiar'
    }
    return ratio <= 0.28 ? 'balanced' : original
  }
  if (ratio >= 0.4) {
    return 'novel'
  }
  if (ratio >= 0.2) {
    return 'balanced'
  }
  return 'familiar'
}

export function applyExperienceContractToAggregation(
  aggregation: TasteOpportunityAggregation,
  contract: ExperienceContract | null,
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
      movementProfile: deriveMovementProfile(aggregation.summary.movementProfile, contract),
      highlightPotential: deriveHighlightPotential(
        aggregation.summary.highlightPotential,
        strongestHighlight?.score,
        contract,
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
