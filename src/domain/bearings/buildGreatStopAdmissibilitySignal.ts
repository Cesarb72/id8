import type { BuiltScenarioNightEvaluation } from '../interpretation/construction/scenarioBuilder'
import type {
  GreatStopDownstreamSignal,
  GreatStopFailureCriterion,
} from '../types/intent'

const SEVERE_CRITERIA: Array<GreatStopFailureCriterion> = ['real', 'place_right', 'moment_right']

function emptyCriterionCounts(): Record<GreatStopFailureCriterion, number> {
  return {
    real: 0,
    role_right: 0,
    intent_right: 0,
    place_right: 0,
    moment_right: 0,
  }
}

function toFixed(value: number): number {
  return Number(value.toFixed(3))
}

export function buildGreatStopAdmissibilitySignal(
  evaluation?: BuiltScenarioNightEvaluation,
): GreatStopDownstreamSignal | undefined {
  if (!evaluation) {
    return undefined
  }

  const failedCriteriaCounts = emptyCriterionCounts()
  evaluation.stopEvaluations.forEach((stopEvaluation) => {
    stopEvaluation.evaluation.failedCriteria.forEach((criterion) => {
      failedCriteriaCounts[criterion] += 1
    })
  })

  const severeCriteriaCounts = {
    real: failedCriteriaCounts.real,
    place_right: failedCriteriaCounts.place_right,
    moment_right: failedCriteriaCounts.moment_right,
  }
  const severeFailureCount =
    severeCriteriaCounts.real + severeCriteriaCounts.place_right + severeCriteriaCounts.moment_right
  const failedStopCount = evaluation.failedStops.length
  const totalStopCount = evaluation.stopEvaluations.length
  const riskTier =
    severeFailureCount >= 2 || severeCriteriaCounts.real > 0
      ? 'severe'
      : failedStopCount > 0
        ? 'warning'
        : 'none'
  const suppressionRecommended =
    severeCriteriaCounts.real > 0 ||
    severeFailureCount >= 3 ||
    (severeFailureCount >= 2 && failedStopCount >= 2)
  const degradedConfidencePenalty = toFixed(
    Math.min(0.26, severeFailureCount * 0.06 + Math.max(0, failedStopCount - severeFailureCount) * 0.02),
  )
  const reasonCodes: string[] = []
  if (!evaluation.passesGreatStopStandard) {
    reasonCodes.push('great_stop:night_failed')
  }
  if (severeCriteriaCounts.real > 0) {
    reasonCodes.push('great_stop:real_failure')
  }
  if (severeCriteriaCounts.place_right > 0) {
    reasonCodes.push('great_stop:place_failure')
  }
  if (severeCriteriaCounts.moment_right > 0) {
    reasonCodes.push('great_stop:moment_failure')
  }
  if (suppressionRecommended) {
    reasonCodes.push('great_stop:suppression_recommended')
  } else if (!evaluation.passesGreatStopStandard) {
    reasonCodes.push('great_stop:degrade_recommended')
  }

  return {
    source: 'scenario_great_stop',
    available: true,
    passesNight: evaluation.passesGreatStopStandard,
    totalStopCount,
    failedStopCount,
    severeFailureCount,
    failedCriteriaCounts,
    severeCriteriaCounts,
    riskTier,
    suppressionRecommended,
    degradedConfidencePenalty,
    reasonCodes,
    notes: evaluation.notes ?? [],
  }
}

