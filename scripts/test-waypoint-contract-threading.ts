import { buildApplicationConciergeIntent } from '../src/app/concierge/conciergeIntentAdapter.ts'
import { rankArcCandidatesFromContract, rankArcCandidatesWithDiagnostics } from '../src/integrations/waypoint/rankArcCandidates.ts'
import { buildCanonicalInterpretationBundle } from '../src/domain/interpretation/buildCanonicalInterpretationBundle.ts'
import type { StrategyAdmissibleWorld } from '../src/domain/bearings/buildStrategyAdmissibleWorlds.ts'
import type { ContractGateWorld } from '../src/domain/bearings/buildContractGateWorld.ts'
import type { ArcCandidate, ArcStop } from '../src/domain/types/arc.ts'
import type { IntentProfile } from '../src/domain/types/intent.ts'

const originalFetch = globalThis.fetch
let fetchCallCount = 0

globalThis.fetch = (async () => {
  fetchCallCount += 1
  throw new Error('Waypoint contract-threading test must not call fetch.')
}) as typeof fetch

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const GREEN_ROUTE_IDS = [
  'sj-willow-court-wine-bar',
  'sj-theatre-district-jazz-cellar',
  'sj-hedley-club-lounge',
] as const

function stop(role: ArcStop['role'], venueId: string): ArcStop {
  return {
    role,
    scoredVenue: {
      venue: {
        id: venueId,
        name: venueId,
      },
    },
  } as unknown as ArcStop
}

function candidate(id: string, stopIds: readonly [string, string, string], totalScore: number): ArcCandidate {
  return {
    id,
    totalScore,
    stops: [
      stop('warmup', stopIds[0]),
      stop('peak', stopIds[1]),
      stop('cooldown', stopIds[2]),
    ],
    hasWildcard: false,
  } as unknown as ArcCandidate
}

function buildCompatibilityIntent(): IntentProfile {
  return {
    crew: 'curator',
    persona: 'romantic',
    primaryAnchor: 'cozy',
    city: 'San Jose',
    distanceMode: 'nearby',
    prefersHiddenGems: false,
    mode: 'curate',
    planningMode: 'engine-led',
  }
}

function buildStrategyWorld(): StrategyAdmissibleWorld {
  return {
    strategyId: 'contained_pulse',
    strategyLabel: 'Contained Pulse',
    strategySummary: 'Contract-admitted contained route world.',
    strategyFamily: 'romantic_cozy',
    source: 'bearings.strategy_admissible_world',
    admittedPockets: [],
    suppressedPockets: [],
    rejectedPockets: [],
    hardRequirementResults: [],
    decisionLog: [],
    decisionByPocketId: {},
    requiredStopGuarantee: {
      role: 'highlight',
      venueId: GREEN_ROUTE_IDS[1],
      source: 'candidate_lineage',
      required: true,
      reasonCodes: ['required_stop_guarantee', 'waypoint_contract_threading_test'],
    },
    summary: 'contained_pulse from ContractGateWorld',
    debug: {
      admittedCount: 0,
      suppressedCount: 0,
      rejectedCount: 0,
      fallbackAdmittedCount: 0,
      totalInputCount: 0,
      hardFailCount: 0,
      suppressedBySignal: {},
      rejectedBySignal: {},
      topFailureReasons: [],
      survivabilityStatus: 'viable',
      sampleDecisions: [],
      allowedPreview: '',
      suppressedPreview: '',
      rejectedPreview: '',
      requiredStopGuarantee: {
        role: 'highlight',
        venueId: GREEN_ROUTE_IDS[1],
        source: 'candidate_lineage',
        required: true,
        reasonCodes: ['required_stop_guarantee', 'waypoint_contract_threading_test'],
      },
    },
  } as StrategyAdmissibleWorld
}

async function main(): Promise<void> {
  try {
    const conciergeIntent = buildApplicationConciergeIntent({
      mode: 'curate',
      persona: 'romantic',
      primaryVibe: 'cozy',
      city: 'San Jose',
      objectiveOccasion: 'connect',
      candidateLineage: {
        source: 'selected_candidate_route_artifact',
        candidateArtifactId: 'contract-entry:curate-green-path:willow-court',
        directionId: 'curate:green-path:willow-court',
        pocketId: 'willow-court',
        anchorVenueId: GREEN_ROUTE_IDS[1],
        anchorRole: 'highlight',
        lineageSummary: 'Willow Court -> Theatre District -> Hedley',
      },
    })
    const canonicalInterpretationBundle = buildCanonicalInterpretationBundle({
      conciergeIntent,
      interpretationSource: 'scripts.test-waypoint-contract-threading',
    })
    const requiredStopGuarantee: ContractGateWorld['requiredStopGuarantee'] = {
      role: 'highlight',
      venueId: GREEN_ROUTE_IDS[1],
      source: 'candidate_lineage',
      required: true,
      reasonCodes: ['required_stop_guarantee', 'waypoint_contract_threading_test'],
    }
    const compatibilityIntent = buildCompatibilityIntent()
    const strategyAdmissibleWorlds = [buildStrategyWorld()]
    const greenCandidate = candidate('green-curate-route', GREEN_ROUTE_IDS, 0.72)
    const driftCandidate = candidate(
      'drifted-route',
      ['sj-willow-court-wine-bar', 'sj-live-music-adega', 'sj-hedley-club-lounge'],
      0.81,
    )

    const contractRanking = rankArcCandidatesFromContract([driftCandidate, greenCandidate], {
      canonicalInterpretationBundle,
      strategyAdmissibleWorlds,
      requiredStopGuarantee,
      normalizedContext: {
        pacing: canonicalInterpretationBundle.normalizedIntent.experienceProfile.pacing,
        anchorPosture: canonicalInterpretationBundle.normalizedIntent.anchorPosture,
        objective: canonicalInterpretationBundle.normalizedIntent.objective,
        starterLineage: canonicalInterpretationBundle.normalizedIntent.starterLineage,
        anchorLineage: canonicalInterpretationBundle.normalizedIntent.anchorLineage,
        candidateLineage: canonicalInterpretationBundle.normalizedIntent.candidateLineage,
      },
      compatibilityIntent,
      source: 'canonical_contract',
    })

    assert(contractRanking.contractTrace.supplied, 'Waypoint must receive contract context.')
    assert(
      contractRanking.contractTrace.primaryInput === 'contract_context',
      'Waypoint contract path must be the primary ranking input.',
    )
    assert(
      contractRanking.contractTrace.strategyWorldCount === 1,
      'Waypoint must receive StrategyAdmissibleWorld[].',
    )
    assert(
      contractRanking.contractTrace.strategyIds.includes('contained_pulse'),
      'Waypoint must preserve strategy world ids in diagnostics.',
    )
    assert(
      contractRanking.contractTrace.requiredStopConsumed,
      'Waypoint must consume required-stop metadata.',
    )
    assert(
      contractRanking.contractTrace.requiredStopRole === 'highlight' &&
        contractRanking.contractTrace.requiredStopVenueId === GREEN_ROUTE_IDS[1],
      'Waypoint must receive required stop role and venue id.',
    )
    assert(
      contractRanking.contractTrace.requiredStopSurvivingCandidateCount === 1,
      'Waypoint must count candidates that preserve the required stop.',
    )
    assert(
      contractRanking.contractTrace.topCandidatePreservesRequiredStop === true,
      'Required stop must survive in the required role after contract-aware ranking.',
    )

    const topRouteIds = contractRanking.ranked[0]!.candidate.stops.map(
      (entry) => entry.scoredVenue.venue.id,
    )
    assert(
      topRouteIds.join(' -> ') === GREEN_ROUTE_IDS.join(' -> '),
      `Curate green route ids must remain unchanged: ${topRouteIds.join(' -> ')}`,
    )

    const compatibilityRanking = rankArcCandidatesWithDiagnostics(
      [driftCandidate, greenCandidate],
      compatibilityIntent,
    )
    assert(
      compatibilityRanking.contractTrace.primaryInput === 'intent_profile_compatibility',
      'Legacy ranking path must remain compatibility-only when contract context is absent.',
    )
    assert(fetchCallCount === 0, `Waypoint threading test must not call fetch (${fetchCallCount}).`)
    process.stdout.write(
      `waypoint contract threading: passed\n${JSON.stringify(
        {
          topRouteIds,
          strategyWorldCount: contractRanking.contractTrace.strategyWorldCount,
          requiredStopRole: contractRanking.contractTrace.requiredStopRole,
          requiredStopVenueId: contractRanking.contractTrace.requiredStopVenueId,
          fetchCallCount,
        },
        null,
        2,
      )}\n`,
    )
  } finally {
    globalThis.fetch = originalFetch
  }
}

main().catch((error) => {
  globalThis.fetch = originalFetch
  console.error(error)
  process.exit(1)
})
