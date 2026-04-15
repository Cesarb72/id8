import { computeTransitionFriction } from './computeTransitionFriction'
import { estimateStopDuration } from './estimateStopDuration'
import { getRouteFeelLabel } from './getRouteFeelLabel'
import type { ArcStop } from '../types/arc'
import type { IntentProfile } from '../types/intent'
import type { RoutePacingAnalysis } from '../types/pacing'

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function formatEstimatedTotalLabel(minutes: number): string {
  const rounded = Math.max(30, Math.round(minutes / 15) * 15)
  const hours = Math.floor(rounded / 60)
  const remainder = rounded % 60

  if (rounded < 60) {
    return `about ${rounded} min`
  }
  if (remainder === 0) {
    return `about ${hours} hour${hours === 1 ? '' : 's'}`
  }
  if (remainder === 30) {
    return `about ${hours}.5 hours`
  }
  return `about ${hours} hour${hours === 1 ? '' : 's'} ${remainder} min`
}

function computeOutingLengthScore(estimatedTotalMinutes: number, intent: IntentProfile): number {
  const preferredCap = intent.distanceMode === 'nearby' ? 240 : 285
  if (estimatedTotalMinutes >= 135 && estimatedTotalMinutes <= preferredCap) {
    return 1
  }
  if (estimatedTotalMinutes >= 110 && estimatedTotalMinutes <= preferredCap + 35) {
    return 0.76
  }
  if (estimatedTotalMinutes >= 90 && estimatedTotalMinutes <= preferredCap + 60) {
    return 0.52
  }
  return 0.3
}

function computePacingBalance(
  stops: ReturnType<typeof estimateStopDuration>[],
  transitions: RoutePacingAnalysis['transitions'],
): Pick<
  RoutePacingAnalysis,
  | 'pacingScore'
  | 'awkwardPacingPenalty'
  | 'pacingPenaltyApplied'
  | 'pacingPenaltyReasons'
  | 'smoothProgressionRewardApplied'
  | 'smoothProgressionRewardReasons'
> {
  const reasons: string[] = []
  const rewards: string[] = []
  let score = 0.58
  let penalty = 0

  const start = stops[0]
  const highlight = stops.find((stop) => stop.roleKey === 'peak')
  const windDown = stops[stops.length - 1]
  const longStopCount = stops.filter((stop) => stop.estimatedDurationMinutes >= 100).length

  if (start && highlight && start.estimatedDurationMinutes < highlight.estimatedDurationMinutes) {
    score += 0.16
    rewards.push('start ramps into a fuller highlight')
  } else if (start && highlight) {
    penalty += 0.12
    reasons.push('opening stop is as heavy as the highlight')
  }

  if (
    highlight &&
    windDown &&
    windDown.estimatedDurationMinutes <= highlight.estimatedDurationMinutes &&
    windDown.estimatedDurationMinutes <= 90
  ) {
    score += 0.14
    rewards.push('route lands on a shorter finish')
  } else if (highlight && windDown && windDown.estimatedDurationMinutes > highlight.estimatedDurationMinutes + 10) {
    penalty += 0.1
    reasons.push('finish lingers longer than the main highlight')
  }

  if (longStopCount >= 3) {
    penalty += 0.18
    reasons.push('too many long stops stack into a heavy outing')
  } else if (longStopCount <= 1) {
    score += 0.08
    rewards.push('stop lengths stay light enough to keep momentum')
  }

  for (const transition of transitions) {
    if (transition.frictionScore >= 4) {
      penalty += 0.08
      reasons.push('one transition is disruptive enough to break flow')
      break
    }
  }

  for (const transition of transitions) {
    if (transition.frictionScore <= 1) {
      score += 0.05
      rewards.push('at least one handoff feels seamless')
      break
    }
  }

  if (
    transitions.every((transition) => transition.frictionScore <= 2) &&
    transitions.some((transition) => transition.neighborhoodContinuity === 'same-neighborhood')
  ) {
    score += 0.12
    rewards.push('route clusters cleanly enough to feel lived-in')
  }

  return {
    pacingScore: clamp01(score - penalty * 0.45),
    awkwardPacingPenalty: clamp01(penalty),
    pacingPenaltyApplied: reasons.length > 0,
    pacingPenaltyReasons: [...new Set(reasons)],
    smoothProgressionRewardApplied: rewards.length > 0,
    smoothProgressionRewardReasons: [...new Set(rewards)],
  }
}

export function computeRouteDuration(
  stops: ArcStop[],
  intent: IntentProfile,
): RoutePacingAnalysis {
  const stopDurations = stops.map((stop) => estimateStopDuration(stop))
  const transitions = stops.slice(0, -1).map((stop, index) => {
    const priorDistinctNeighborhoods = new Set(
      stops
        .slice(0, index + 1)
        .map((item) => item.scoredVenue.venue.neighborhood),
    ).size

    return computeTransitionFriction({
      fromStop: stop,
      toStop: stops[index + 1]!,
      fromDuration: stopDurations[index]!,
      toDuration: stopDurations[index + 1]!,
      priorDistinctNeighborhoods,
    })
  })

  const estimatedStopMinutes = stopDurations.reduce(
    (sum, stop) => sum + stop.estimatedDurationMinutes,
    0,
  )
  const estimatedTransitionMinutes = transitions.reduce(
    (sum, transition) => sum + transition.estimatedTransitionMinutes,
    0,
  )
  const estimatedTotalMinutes = estimatedStopMinutes + estimatedTransitionMinutes
  const totalRouteFriction = transitions.reduce((sum, transition) => sum + transition.frictionScore, 0)
  const averageTransitionFriction =
    transitions.length > 0 ? Number((totalRouteFriction / transitions.length).toFixed(2)) : 0
  const transitionSmoothnessScore = clamp01(
    1 - totalRouteFriction / Math.max(4, transitions.length * 4),
  )
  const outingLengthScore = computeOutingLengthScore(estimatedTotalMinutes, intent)
  const pacingBalance = computePacingBalance(stopDurations, transitions)

  return {
    stops: stopDurations,
    transitions,
    estimatedStopMinutes,
    estimatedTransitionMinutes,
    estimatedTotalMinutes,
    estimatedTotalLabel: formatEstimatedTotalLabel(estimatedTotalMinutes),
    totalRouteFriction,
    averageTransitionFriction,
    routeFeelLabel: getRouteFeelLabel({
      estimatedTotalMinutes,
      averageTransitionFriction,
      totalRouteFriction,
      transitionCount: transitions.length,
    }),
    pacingScore: pacingBalance.pacingScore,
    transitionSmoothnessScore,
    outingLengthScore,
    awkwardPacingPenalty: pacingBalance.awkwardPacingPenalty,
    pacingPenaltyApplied: pacingBalance.pacingPenaltyApplied,
    pacingPenaltyReasons: pacingBalance.pacingPenaltyReasons,
    smoothProgressionRewardApplied: pacingBalance.smoothProgressionRewardApplied,
    smoothProgressionRewardReasons: pacingBalance.smoothProgressionRewardReasons,
  }
}
