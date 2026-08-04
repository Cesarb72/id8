import assert from 'node:assert/strict'
import { buildWaypointRouteCompetitionEvidence } from '../src/integrations/waypoint/coordination/buildWaypointRouteCompetitionEvidence.ts'
import type { ArcCandidate, ArcScoreBreakdown, ScoredVenue } from '../src/domain/types/arc.ts'
import type { Itinerary } from '../src/domain/types/itinerary.ts'
import type { WaypointRankedCandidate } from '../src/integrations/waypoint/core.ts'

function scoredVenue(id: string): ScoredVenue {
  return {
    venue: {
      id,
      name: id,
      category: 'culture',
    },
    candidateIdentity: {
      candidateId: `candidate-${id}`,
      baseVenueId: `base-${id}`,
      kind: 'base',
      traceLabel: id,
    },
  } as ScoredVenue
}

function scoreBreakdown(overrides: Partial<ArcScoreBreakdown> = {}): ArcScoreBreakdown {
  return {
    roleFlowScore: 0.9,
    diversityScore: 0.8,
    geographyScore: 0.86,
    spatialCoherenceScore: 0.86,
    hiddenGemLift: 0.1,
    windDownScore: 0.7,
    routeMomentVerdict: {
      verdict: 'strong',
      score: 0.91,
    } as ArcScoreBreakdown['routeMomentVerdict'],
    experienceCompositionStamp: {
      source: 'taste.experience_composition.v0_1',
      verdict: 'aligned',
    } as ArcScoreBreakdown['experienceCompositionStamp'],
    highlightMomentScore: 0.92,
    momentStrengthScore: 0.9,
    momentVarianceScore: 0.72,
    strongMomentPresent: true,
    ...overrides,
  }
}

function candidate(
  id: string,
  stopIds: [string, string, string],
  options: {
    totalScore?: number
    hasWildcard?: boolean
    promotionOutcome?: 'promoted_to_highlight' | 'held_score'
    score?: Partial<ArcScoreBreakdown>
  } = {},
): ArcCandidate {
  return {
    id,
    stops: [
      { role: 'warmup', scoredVenue: scoredVenue(stopIds[0]) },
      { role: 'peak', scoredVenue: scoredVenue(stopIds[1]) },
      { role: 'cooldown', scoredVenue: scoredVenue(stopIds[2]) },
    ],
    totalScore: options.totalScore ?? 0.8,
    scoreBreakdown: scoreBreakdown(options.score),
    pacing: {
      transitions: [],
      totalRouteFriction: 0.1,
      estimatedStopMinutes: 120,
      estimatedTransitionMinutes: 20,
      estimatedTotalMinutes: 140,
      estimatedTotalLabel: '2h 20m',
      routeFeelLabel: 'smooth',
      pacingPenaltyApplied: false,
      pacingPenaltyReasons: [],
      smoothProgressionRewardApplied: true,
      smoothProgressionRewardReasons: [],
    } as ArcCandidate['pacing'],
    spatial: {
      score: 0.86,
      spatialBonus: 0,
      spatialPenalty: 0,
    } as ArcCandidate['spatial'],
    hasWildcard: options.hasWildcard ?? false,
    ...(options.promotionOutcome
      ? {
          surpriseInjection: {
            candidateTier: 'strong',
            gateProbability: 1,
            gateScore: 1,
            spatialScore: 0.9,
            scoreDeltaFromBase: 0.1,
            allowedTradeoff: 0.2,
            acceptanceBonusApplied: false,
            acceptanceBonusValue: 0,
            selectionReason: 'fixture',
            promotionOutcome: options.promotionOutcome,
            tasteSignals: {
              venueId: stopIds[1],
              venueName: stopIds[1],
              experientialFactor: 0.8,
              noveltyWeight: 0.7,
              roleSuitability: 0.9,
              supportingSignals: [],
            },
          },
        }
      : {}),
  }
}

function ranked(candidateInput: ArcCandidate, score: number): WaypointRankedCandidate {
  return {
    candidate: candidateInput,
    rankingScore: score,
    boundaryBaseScore: candidateInput.totalScore,
    boundaryQualityAdjustment: 0.02,
    boundaryQualitySignals: {
      supportLaneVarianceScore: 0.8,
      laneRepetitionPenalty: 0,
      clusterCoherenceScore: 0.7,
      movementFrictionPenalty: 0,
      arcProgressionScore: 0.9,
      requiredAnchorPreservationNeutrality: 0,
      totalAdjustment: 0.02,
    },
    routeShapeCompactnessAdjustment: 0,
    routeShapeCompactnessSignals: {
      active: true,
      activationReason: 'fixture',
      preservePriorityIncludesMovement: true,
      totalMovementEstimate: 20,
      maxSingleTransitionEstimate: 12,
      clusterEscapeCount: 0,
      repeatedClusterEscapeCount: 0,
      extraClusterEscapeCount: 0,
      backtrackDetected: false,
      longTransitionCount: 0,
      driveLikeMovementDetected: false,
      compactCandidate: true,
      reasonSummary: [],
      compactBonus: 0,
      compactnessPenalty: 0,
      adjustment: 0,
    },
    refinementNudge: 0,
    refinementTokensApplied: [],
    refinementTokenDeltas: {},
    tiebreaker: 0.001,
  }
}

function itineraryFor(route: ArcCandidate): Itinerary {
  return {
    id: 'itinerary-fixture',
    stops: route.stops.map((stop) => ({
      role:
        stop.role === 'warmup'
          ? 'start'
          : stop.role === 'peak'
            ? 'highlight'
            : stop.role === 'cooldown'
              ? 'windDown'
              : 'surprise',
      venueId: stop.scoredVenue.venue.id,
    })),
  } as Itinerary
}

const promise = {
  supplied: true,
  strategyFamily: 'fixture_strategy',
  experienceContractId: 'experience-contract-fixture',
  contractConstraintsId: 'contract-constraints-fixture',
}

const contractTrace = {
  supplied: true,
  primaryInput: 'contract_context',
  canonicalInterpretationSupplied: true,
  strategyWorldCount: 1,
  strategyIds: ['strategy-fixture'],
  requiredStopConsumed: false,
  requiredStopRequired: false,
  requiredStopReasonCodes: [],
  requiredStopSurvivingCandidateCount: 0,
} as const

function baseEvidence(overrides: Partial<Parameters<typeof buildWaypointRouteCompetitionEvidence>[0]> = {}) {
  const winner = candidate('arc-1', ['start-a', 'highlight-a', 'wind-a'])
  const runnerUp = candidate('arc-2', ['start-a', 'highlight-b', 'wind-a'])
  const third = candidate('arc-3', ['start-c', 'highlight-b', 'wind-d'], {
    hasWildcard: true,
    promotionOutcome: 'promoted_to_highlight',
  })
  const rankedEntries = [ranked(winner, 1.003), ranked(runnerUp, 0.952), ranked(third, 0.91)]
  return {
    winner,
    runnerUp,
    third,
    input: {
      preTop40Candidates: [winner, runnerUp, third],
      assembledCandidates: [winner, runnerUp, third],
      finalBoundaryCandidates: [winner, runnerUp, third],
      finalRankedEntries: rankedEntries,
      selectedCandidate: winner,
      itinerary: itineraryFor(winner),
      greatStopGateResult: {
        routeId: winner.id,
      } as Parameters<typeof buildWaypointRouteCompetitionEvidence>[0]['greatStopGateResult'],
      waypointContractTrace: contractTrace,
      canonicalInterpretationIngress: promise,
      ...overrides,
    },
  }
}

{
  const { input } = baseEvidence()
  const originalOrder = input.finalRankedEntries.map((entry) => entry.candidate.id)
  const diagnostics = buildWaypointRouteCompetitionEvidence(input)
  assert.deepEqual(
    input.finalRankedEntries.map((entry) => entry.candidate.id),
    originalOrder,
    'diagnostic builder must not mutate production ranking order',
  )
  assert.equal(diagnostics.globalStrongestStatus, 'GLOBAL_STRONGEST_PROVEN')
  assert.equal(diagnostics.rankedPopulationComplete, true)
  assert.equal(diagnostics.selectedRank, 1)
  assert.equal(diagnostics.finalRankedPopulation.entries.length, 3)
  assert.equal(diagnostics.comparisonRows[0]?.candidateId, 'arc-1')
  assert.equal(
    diagnostics.comparisonRows[1]?.purposes.includes('immediate_ranked_runner_up'),
    true,
  )
  assert.equal(
    diagnostics.comparisonRows[1]?.purposes.includes('first_different_highlight'),
    true,
  )
  assert.equal(diagnostics.comparisonRows.length, 3)
  assert.deepEqual(
    diagnostics.comparisonRows[0]?.tasteEvidence.routeMomentVerdict,
    input.selectedCandidate?.scoreBreakdown.routeMomentVerdict,
  )
  assert.deepEqual(
    diagnostics.comparisonRows[0]?.bearingsEvidence.spatial,
    input.selectedCandidate?.spatial,
  )
  assert.equal(
    diagnostics.comparisonRows[0]?.interpretationPromiseIdentity?.experienceContractId,
    'experience-contract-fixture',
  )
  assert.equal(diagnostics.approvalContinuityStatus, 'UNAVAILABLE_WITHOUT_PROTECTED_INSTRUMENTATION')
}

{
  const { winner, runnerUp } = baseEvidence()
  const diagnostics = buildWaypointRouteCompetitionEvidence({
    ...baseEvidence().input,
    preTop40Candidates: [
      candidate('arc-0', ['start-z', 'highlight-z', 'wind-z']),
      winner,
      runnerUp,
    ],
    assembledCandidates: [winner, runnerUp],
    finalBoundaryCandidates: [winner, runnerUp],
    finalRankedEntries: [ranked(winner, 1), ranked(runnerUp, 0.9)],
    selectedCandidate: winner,
    itinerary: itineraryFor(winner),
    greatStopGateResult: { routeId: winner.id } as Parameters<
      typeof buildWaypointRouteCompetitionEvidence
    >[0]['greatStopGateResult'],
  })
  assert.equal(diagnostics.top40Truncated, true)
  assert.equal(diagnostics.globalStrongestStatus, 'GLOBAL_STRONGEST_NOT_PROVEN')
  assert(diagnostics.globalStrongestFailureReasons.includes('pre_ranking_population_truncated'))
}

{
  const { input, winner, runnerUp } = baseEvidence()
  const diagnostics = buildWaypointRouteCompetitionEvidence({
    ...input,
    finalBoundaryCandidates: [winner, runnerUp],
    finalRankedEntries: [ranked(winner, 1)],
  })
  assert.equal(diagnostics.rankedPopulationComplete, false)
  assert(diagnostics.globalStrongestFailureReasons.includes('ranked_population_incomplete'))
}

{
  const { input, winner, runnerUp } = baseEvidence()
  const diagnostics = buildWaypointRouteCompetitionEvidence({
    ...input,
    finalRankedEntries: [ranked(runnerUp, 1), ranked(winner, 0.9)],
    selectedCandidate: winner,
    itinerary: itineraryFor(winner),
    greatStopGateResult: { routeId: winner.id } as Parameters<
      typeof buildWaypointRouteCompetitionEvidence
    >[0]['greatStopGateResult'],
  })
  assert.equal(diagnostics.selectedRank, 2)
  assert.equal(diagnostics.selectedFirstWithinFinalRankedPopulation, false)
  assert(diagnostics.globalStrongestFailureReasons.includes('selected_not_first'))
}

{
  const tied = Array.from({ length: 4 }, (_, index) =>
    candidate(`tie-${index}`, [`start-${index}`, `highlight-${index}`, `wind-${index}`]),
  )
  const input = {
    ...baseEvidence().input,
    preTop40Candidates: tied,
    assembledCandidates: tied,
    finalBoundaryCandidates: tied,
    finalRankedEntries: tied.map((item) => ranked(item, 1)),
    selectedCandidate: tied[0],
    itinerary: itineraryFor(tied[0]!),
    greatStopGateResult: { routeId: tied[0]!.id } as Parameters<
      typeof buildWaypointRouteCompetitionEvidence
    >[0]['greatStopGateResult'],
    rowCap: 2,
  }
  const diagnostics = buildWaypointRouteCompetitionEvidence(input)
  assert.equal(diagnostics.rowTruncation.truncated, true)
  assert(diagnostics.globalStrongestFailureReasons.includes('tie_population_truncated'))
  assert.equal(diagnostics.globalStrongestStatus, 'GLOBAL_STRONGEST_NOT_PROVEN')
}

{
  const { input, winner } = baseEvidence({
    greatStopGateResult: { routeId: 'different-route' } as Parameters<
      typeof buildWaypointRouteCompetitionEvidence
    >[0]['greatStopGateResult'],
  })
  const diagnostics = buildWaypointRouteCompetitionEvidence(input)
  assert.equal(diagnostics.assessedRouteMatchesSelected, false)
  assert(diagnostics.globalStrongestFailureReasons.includes('assessed_route_mismatch'))

  const shownMismatch = buildWaypointRouteCompetitionEvidence({
    ...input,
    greatStopGateResult: { routeId: winner.id } as Parameters<
      typeof buildWaypointRouteCompetitionEvidence
    >[0]['greatStopGateResult'],
    itinerary: {
      ...itineraryFor(winner),
      stops: [{ venueId: 'wrong' }],
    } as Itinerary,
  })
  assert.equal(shownMismatch.shownRouteMatchesSelected, false)
  assert(shownMismatch.globalStrongestFailureReasons.includes('shown_route_mismatch'))
}

{
  const missingTaste = candidate('missing-taste', ['start-a', 'highlight-a', 'wind-a'], {
    score: {
      routeMomentVerdict: undefined,
      experienceCompositionStamp: undefined,
    },
  })
  const diagnostics = buildWaypointRouteCompetitionEvidence({
    ...baseEvidence().input,
    preTop40Candidates: [missingTaste],
    assembledCandidates: [missingTaste],
    finalBoundaryCandidates: [missingTaste],
    finalRankedEntries: [ranked(missingTaste, 1)],
    selectedCandidate: missingTaste,
    itinerary: itineraryFor(missingTaste),
    greatStopGateResult: { routeId: missingTaste.id } as Parameters<
      typeof buildWaypointRouteCompetitionEvidence
    >[0]['greatStopGateResult'],
  })
  assert(diagnostics.globalStrongestFailureReasons.includes('evidence_missing'))
  assert.equal(diagnostics.globalStrongestStatus, 'GLOBAL_STRONGEST_NOT_PROVEN')
}

console.log('Gate 3B route-competition evidence fixture tests passed.')
