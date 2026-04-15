import { runGeneratePlan } from '../src/domain/runGeneratePlan'
import {
  buildStopTypeCandidateBoardFromIntent,
  resolveScenarioFamily,
  type ScenarioFamily,
} from '../src/domain/interpretation/discovery/stopTypeCandidateBoard'
import { buildScenarioNightsFromCandidateBoard } from '../src/domain/interpretation/construction/scenarioBuilder'
import { buildDistrictOpportunityProfiles } from '../src/engines/district'

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

type MatrixRow = {
  key: string
  resolvedFamily: ScenarioFamily | null
  board: {
    supported: boolean
    requiredStopTypes: string[]
    minCoverage: number
    maxCoverage: number
    zeroCoverageTypes: string[]
  }
  builder: {
    builtNightCount: number
    completeNightCount: number
    passNightCount: number
    failedCriteriaCounts: Record<string, number>
    rationaleCoveragePct: number
    trustCoveragePct: number
  }
  fieldFromPlan: {
    finalRetrieved: number
    qualitySuppressed: number
    finalLive: number
    sourceMode: string
    fallbackToCurated: boolean
    addressKnownPct: number
    formattedAddressKnownPct: number
    happeningsKnownPct: number
    categoryDiversity: number
  }
  districtFromPlan: {
    topDistrictId?: string
    recommendedCount: number
    topScore?: number
  }
  bearingsWaypointFromPlan: {
    boundaryChangedWinner: boolean
    boundaryWarnings: string[]
    boundaryContributionLevel?: string
    rankingEngine: string
  }
}

function round(value: number): number {
  return Number(value.toFixed(3))
}

function pct(numerator: number, denominator: number): number {
  if (!denominator) return 0
  return round((numerator / denominator) * 100)
}

function toCounts<T extends string>(items: T[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] ?? 0) + 1
    return acc
  }, {})
}

const rows: MatrixRow[] = []

for (const scenario of matrix) {
  const key = `${scenario.city} | ${scenario.persona} | ${scenario.vibe}`
  const resolvedFamily = resolveScenarioFamily({
    city: scenario.city,
    persona: scenario.persona,
    vibe: scenario.vibe,
  })

  const board = await buildStopTypeCandidateBoardFromIntent({
    city: scenario.city,
    persona: scenario.persona,
    vibe: scenario.vibe,
  })

  const requiredStopTypes = board?.requiredStopTypes ?? []
  const coverageCounts = requiredStopTypes.map(
    (stopType) => board?.candidatesByStopType[stopType]?.length ?? 0,
  )
  const zeroCoverageTypes = requiredStopTypes.filter(
    (stopType) => (board?.candidatesByStopType[stopType]?.length ?? 0) === 0,
  )

  const builtNights = board ? buildScenarioNightsFromCandidateBoard(board, { minNights: 3, maxNights: 4 }) : []
  const completeNights = builtNights.filter((night) => night.complete)
  const passingNights = completeNights.filter((night) => night.evaluation?.passesGreatStopStandard)
  const stopCount = completeNights.reduce((sum, night) => sum + night.stops.length, 0)
  const rationaleCoveredCount = completeNights.reduce(
    (sum, night) =>
      sum +
      night.stops.filter((stop) => Boolean(stop.momentLabel && stop.whyThisStop)).length,
    0,
  )
  const trustCoveredCount = completeNights.reduce(
    (sum, night) =>
      sum +
      night.stops.filter(
        (stop) => Boolean(stop.venueTypeLabel || stop.factualSummary || stop.address || stop.district),
      ).length,
    0,
  )
  const failedCriteriaCounts = toCounts(
    completeNights.flatMap((night) =>
      night.evaluation?.stopEvaluations.flatMap((entry) => entry.evaluation.failedCriteria) ?? [],
    ),
  )

  const plan = await runGeneratePlan({
    city: scenario.city,
    persona: scenario.persona,
    primaryVibe: scenario.vibe,
    distanceMode: 'nearby',
  })

  const trace: any = plan.trace
  const stageCounts = trace.retrievalDiagnostics?.stageCounts ?? {}
  const liveSource = trace.retrievalDiagnostics?.liveSource ?? {}
  const scoredVenues = plan.scoredVenues ?? []
  const addressKnown = scoredVenues.filter((item: any) => Boolean(item.venue?.address)).length
  const formattedAddressKnown = scoredVenues.filter((item: any) => Boolean(item.venue?.source?.formattedAddress)).length
  const happeningsKnown = scoredVenues.filter((item: any) => Boolean(item.venue?.source?.happenings)).length
  const categories = new Set(scoredVenues.map((item: any) => item.venue?.category).filter(Boolean))

  rows.push({
    key,
    resolvedFamily,
    board: {
      supported: Boolean(board),
      requiredStopTypes,
      minCoverage: coverageCounts.length ? Math.min(...coverageCounts) : 0,
      maxCoverage: coverageCounts.length ? Math.max(...coverageCounts) : 0,
      zeroCoverageTypes,
    },
    builder: {
      builtNightCount: builtNights.length,
      completeNightCount: completeNights.length,
      passNightCount: passingNights.length,
      failedCriteriaCounts,
      rationaleCoveragePct: pct(rationaleCoveredCount, stopCount),
      trustCoveragePct: pct(trustCoveredCount, stopCount),
    },
    fieldFromPlan: {
      finalRetrieved: stageCounts.finalRetrieved ?? 0,
      qualitySuppressed: stageCounts.qualitySuppressed ?? 0,
      finalLive: stageCounts.finalLive ?? 0,
      sourceMode: liveSource.effectiveMode ?? 'unknown',
      fallbackToCurated: Boolean(liveSource.fallbackToCurated),
      addressKnownPct: pct(addressKnown, scoredVenues.length),
      formattedAddressKnownPct: pct(formattedAddressKnown, scoredVenues.length),
      happeningsKnownPct: pct(happeningsKnown, scoredVenues.length),
      categoryDiversity: categories.size,
    },
    districtFromPlan: {
      topDistrictId: trace.recommendedDistricts?.[0]?.districtId,
      recommendedCount: trace.recommendedDistricts?.length ?? 0,
      topScore: trace.recommendedDistricts?.[0]?.score,
    },
    bearingsWaypointFromPlan: {
      boundaryChangedWinner: Boolean(trace.boundaryDiagnostics?.boundaryChangedWinner),
      boundaryWarnings: trace.boundaryDiagnostics?.warnings ?? [],
      boundaryContributionLevel: trace.boundaryDiagnostics?.boundaryContributionLevel,
      rankingEngine: trace.rankingEngine,
    },
  })
}

const districtEngine = await buildDistrictOpportunityProfiles({
  locationQuery: 'San Jose',
  includeDebug: true,
})

const districtSummary = {
  selectedCount: districtEngine.selected.length,
  rankedCount: districtEngine.ranked.length,
  rawPocketCount: districtEngine.rawPockets.length,
  viablePocketCount: districtEngine.viablePockets.length,
  rejectedPocketCount: districtEngine.rejectedPockets.length,
  selectedOrigins: districtEngine.selected.map((entry) => entry.profile.meta.origin),
  selectedDegraded: districtEngine.selected.map((entry) => entry.profile.meta.isDegradedFallback),
  selectedFallbackPenalties: districtEngine.selected.map((entry) => entry.profile.meta.fallbackPenaltyApplied),
  debugPathFlags: districtEngine.debug?.pathFlags,
  debugRejected: districtEngine.debug?.pocketDiagnostics.rejectedPockets.map((p) => ({
    pocketId: p.pocketId,
    origin: p.origin,
    isDegradedFallback: p.isDegradedFallback,
    rejectionReasonSummary: p.rejectionReasonSummary,
  })),
}

console.log(JSON.stringify({ rows, districtSummary }, null, 2))
