import {
  buildArcCoreStops,
  buildArcWildcardStops,
  coordinateArcCoreRouteShapes,
  projectArcCandidateAssembly,
  rankArcCandidatesForAssembly,
} from '../src/integrations/waypoint/coordination/coordinateArcCandidateAssembly'
import type { ArcCandidate, ArcStop, ScoredVenue } from '../src/domain/types/arc'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

let fetchCallCount = 0
globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
  fetchCallCount += 1
  throw new Error(`Unexpected fetch in Waypoint candidate assembly parity test: ${String(args[0])}`)
}) as typeof fetch

function candidate(id: string): ScoredVenue {
  return {
    candidateIdentity: {
      candidateId: id,
      baseVenueId: id,
      kind: 'base',
      traceLabel: id,
    },
    venue: {
      id,
      name: id,
    },
  } as ScoredVenue
}

function legacyCoreStops(
  warmup: ScoredVenue,
  peak: ScoredVenue,
  cooldown: ScoredVenue,
): ArcStop[] {
  return [
    { role: 'warmup', scoredVenue: warmup },
    { role: 'peak', scoredVenue: peak },
    { role: 'cooldown', scoredVenue: cooldown },
  ]
}

function legacyWildcardStops(stops: ArcStop[], wildcard: ScoredVenue): ArcStop[] {
  return [
    stops[0],
    stops[1],
    { role: 'wildcard', scoredVenue: wildcard },
    stops[2],
  ]
}

function routeSignature(stops: readonly ArcStop[]): string {
  return stops
    .map((stop) => `${stop.role}:${stop.scoredVenue.candidateIdentity.candidateId}`)
    .join('|')
}

function fakeArcCandidate(params: {
  id: string
  totalScore: number
  promotionOutcome?: NonNullable<ArcCandidate['surpriseInjection']>['promotionOutcome']
  candidateTier?: NonNullable<ArcCandidate['surpriseInjection']>['candidateTier']
}): ArcCandidate {
  return {
    id: params.id,
    stops: [],
    totalScore: params.totalScore,
    scoreBreakdown: {},
    pacing: {},
    spatial: {},
    hasWildcard: Boolean(params.candidateTier),
    ...(params.candidateTier
      ? {
          surpriseInjection: {
            candidateTier: params.candidateTier,
            gateProbability: 1,
            gateScore: 0,
            spatialScore: 1,
            scoreDeltaFromBase: 0,
            allowedTradeoff: 0,
            acceptanceBonusApplied: false,
            acceptanceBonusValue: 0,
            selectionReason: 'test',
            promotionOutcome: params.promotionOutcome,
            tasteSignals: {
              venueId: params.id,
              venueName: params.id,
              experientialFactor: 1,
              noveltyWeight: 1,
              roleSuitability: 1,
              supportingSignals: [],
            },
          },
        }
      : {}),
  } as ArcCandidate
}

const warmups = [candidate('warmup-a'), candidate('warmup-b')]
const peaks = [candidate('peak-a'), candidate('peak-b')]
const cooldowns = [candidate('cooldown-a')]
const routeShapes = coordinateArcCoreRouteShapes({
  warmupCandidates: warmups,
  peakCandidates: peaks,
  cooldownCandidates: cooldowns,
})
const legacyRouteShapes = warmups.flatMap((warmup) =>
  peaks.flatMap((peak) =>
    cooldowns.map((cooldown) => legacyCoreStops(warmup, peak, cooldown)),
  ),
)

assert(routeShapes.length === legacyRouteShapes.length, 'Core route shape count changed.')
for (let index = 0; index < routeShapes.length; index += 1) {
  assert(
    routeSignature(routeShapes[index]!.stops) === routeSignature(legacyRouteShapes[index]!),
    `Core route shape order changed at index ${index}.`,
  )
}

const coreStops = buildArcCoreStops(warmups[0]!, peaks[0]!, cooldowns[0]!)
assert(
  routeSignature(coreStops) === routeSignature(legacyCoreStops(warmups[0]!, peaks[0]!, cooldowns[0]!)),
  'Core stop sequence changed.',
)

const wildcard = candidate('wildcard-a')
assert(
  routeSignature(buildArcWildcardStops(coreStops, wildcard)) ===
    routeSignature(legacyWildcardStops(coreStops, wildcard)),
  'Wildcard insertion sequence changed.',
)

const projected = projectArcCandidateAssembly({
  id: 'arc-test',
  stops: coreStops,
  totalScore: 0.72,
  scoreBreakdown: {} as ArcCandidate['scoreBreakdown'],
  pacing: {} as ArcCandidate['pacing'],
  spatial: {} as ArcCandidate['spatial'],
  hasWildcard: false,
})
assert(projected.id === 'arc-test', 'Projected Arc candidate id changed.')
assert(projected.totalScore === 0.72, 'Projected Arc candidate score changed.')
assert(routeSignature(projected.stops) === routeSignature(coreStops), 'Projected Arc route changed.')
assert(projected.hasWildcard === false, 'Projected Arc wildcard flag changed.')

const ranked = rankArcCandidatesForAssembly([
  fakeArcCandidate({ id: 'plain-high', totalScore: 0.91 }),
  fakeArcCandidate({ id: 'promoted-tie', totalScore: 0.9, candidateTier: 'nearStrong', promotionOutcome: 'promoted_to_highlight' }),
  fakeArcCandidate({ id: 'strong-tier-tie', totalScore: 0.9, candidateTier: 'strong' }),
  fakeArcCandidate({ id: 'near-tier-tie', totalScore: 0.9, candidateTier: 'nearStrong' }),
  fakeArcCandidate({ id: 'plain-low', totalScore: 0.88 }),
])

assert(
  ranked.map((item) => item.id).join('|') ===
    'plain-high|promoted-tie|strong-tier-tie|near-tier-tie|plain-low',
  'Candidate assembly ordering changed.',
)

console.log(
  JSON.stringify(
    {
      observer: 'waypoint_candidate_assembly_parity',
      status: 'PASS',
      coreRouteShapeCount: routeShapes.length,
      routeShapeSequencePreserved: true,
      wildcardSequencePreserved: true,
      candidateProjectionPreserved: true,
      candidateOrderingPreserved: true,
      gate1PolicyMoved: false,
      gate2PolicyMoved: false,
      providerNetworkCalls: fetchCallCount,
    },
    null,
    2,
  ),
)
