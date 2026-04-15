import { buildDistrictOpportunityProfiles } from '../src/engines/district'
import { buildCanonicalInterpretationBundle } from '../src/domain/interpretation/buildCanonicalInterpretationBundle'
import { buildContractGateWorld } from '../src/domain/bearings/buildContractGateWorld'
import { buildGreatStopAdmissibilitySignal } from '../src/domain/bearings/buildGreatStopAdmissibilitySignal'
import { runGeneratePlan } from '../src/domain/runGeneratePlan'
import { buildStopTypeCandidateBoardFromIntent } from '../src/domain/interpretation/discovery/stopTypeCandidateBoard'
import { buildScenarioNightsFromCandidateBoard } from '../src/domain/interpretation/construction/scenarioBuilder'

const matrix = [
  { city: 'San Jose', persona: 'romantic', vibe: 'cozy' },
  { city: 'San Jose', persona: 'romantic', vibe: 'lively' },
  { city: 'San Jose', persona: 'romantic', vibe: 'cultured' },
  { city: 'San Jose', persona: 'friends', vibe: 'cozy' },
  { city: 'San Jose', persona: 'friends', vibe: 'lively' },
  { city: 'San Jose', persona: 'friends', vibe: 'cultured' },
  { city: 'San Jose', persona: 'family', vibe: 'cozy' },
  { city: 'San Jose', persona: 'family', vibe: 'lively' },
  { city: 'San Jose', persona: 'family', vibe: 'cultured' },
] as const

const district = await buildDistrictOpportunityProfiles({ locationQuery: 'San Jose', includeDebug: true })

const rows: Array<Record<string, unknown>> = []
for (const scenario of matrix) {
  const board = await buildStopTypeCandidateBoardFromIntent(scenario)
  const nights = board ? buildScenarioNightsFromCandidateBoard(board, { minNights: 3, maxNights: 4 }) : []
  const severeNight =
    nights.find((night) => {
      const evaluation = night.evaluation
      if (!evaluation || evaluation.passesGreatStopStandard) {
        return false
      }
      return evaluation.stopEvaluations.some((entry) =>
        entry.evaluation.failedCriteria.some(
          (criterion) => criterion === 'real' || criterion === 'place_right' || criterion === 'moment_right',
        ),
      )
    }) ?? nights[0]
  const signal = buildGreatStopAdmissibilitySignal(severeNight?.evaluation)

  const canonical = buildCanonicalInterpretationBundle({
    persona: scenario.persona,
    vibe: scenario.vibe,
    city: scenario.city,
    planningMode: 'engine-led',
    entryPoint: 'direction_selection',
    hasAnchor: false,
  })

  const gateWorld = buildContractGateWorld({
    ranked: district.ranked,
    context: {
      canonicalStrategyFamily: canonical.strategyFamily,
      canonicalStrategyFamilyResolution: canonical.strategyFamilyResolution,
      experienceContract: canonical.experienceContract,
      contractConstraints: canonical.contractConstraints,
      greatStopAdmissibilitySignal: signal,
    },
    source: 'tmp.downstream_sweep',
  })

  const greatStopDecisionCount = gateWorld.decisionLog.filter((entry) =>
    entry.reasonSummary.includes('great_stop'),
  ).length
  const severeSuppressionCount = gateWorld.decisionLog.filter((entry) =>
    entry.reasonSummary.includes('great_stop_severe_suppression'),
  ).length

  const planWithSignal = await runGeneratePlan({
    city: scenario.city,
    persona: scenario.persona,
    primaryVibe: scenario.vibe,
    distanceMode: 'nearby',
    selectedDirectionContext: {
      directionId: `d_${scenario.persona}_${scenario.vibe}`,
      pocketId: gateWorld.admittedPockets[0]?.profile.pocketId,
      label: gateWorld.admittedPockets[0]?.profile.label,
      archetype: canonical.strategyFamily,
      identity: 'exploratory',
      cluster: scenario.vibe === 'lively' ? 'lively' : scenario.vibe === 'cozy' ? 'chill' : 'explore',
      greatStopSignal: signal,
    },
  })

  const trace: any = planWithSignal.trace

  rows.push({
    key: `${scenario.city} | ${scenario.persona} | ${scenario.vibe}`,
    signal: signal
      ? {
          riskTier: signal.riskTier,
          failedStopCount: signal.failedStopCount,
          severeFailureCount: signal.severeFailureCount,
          suppressionRecommended: signal.suppressionRecommended,
          penalty: signal.degradedConfidencePenalty,
        }
      : undefined,
    bearings: {
      allowedCount: gateWorld.debug.allowedCount,
      suppressedCount: gateWorld.debug.suppressedCount,
      rejectedCount: gateWorld.debug.rejectedCount,
      fallbackAdmittedCount: gateWorld.debug.fallbackAdmittedCount,
      greatStopDecisionCount,
      severeSuppressionCount,
      greatStopQuality: gateWorld.debug.greatStopQuality,
    },
    waypoint: {
      rankingEngine: trace.rankingEngine,
      traceGreatStopQualityContext: trace.greatStopQualityContext,
      boundaryContributionLevel: trace.boundaryDiagnostics?.boundaryContributionLevel,
    },
  })
}

console.log(JSON.stringify({ rows }, null, 2))
