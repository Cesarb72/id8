import { readFileSync } from 'node:fs'
import {
  coordinateArcRolePoolOrdering,
  getArcRolePoolCandidateLimit,
  limitArcRolePoolCandidates,
  projectArcRolePools,
} from '../src/integrations/waypoint/coordination/coordinateArcRolePools'
import type { ScoredVenue } from '../src/domain/types/arc'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

let fetchCallCount = 0
globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
  fetchCallCount += 1
  throw new Error(`Unexpected fetch in Waypoint role-pool ordering parity test: ${String(args[0])}`)
}) as typeof fetch

function candidate(id: string, fitScore: number): ScoredVenue {
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
    fitScore,
  } as ScoredVenue
}

function candidateId(candidate: ScoredVenue): string {
  return candidate.candidateIdentity.candidateId
}

function signature(candidates: readonly ScoredVenue[]): string {
  return candidates
    .map((item) => `${candidateId(item)}:${item.isAnchor === true ? 'anchor' : 'plain'}`)
    .join('|')
}

function legacyRank(
  candidates: readonly ScoredVenue[],
  scores: ReadonlyMap<string, number>,
): ScoredVenue[] {
  return [...candidates].sort((left, right) => {
    return (
      (scores.get(candidateId(right)) ?? 0) -
        (scores.get(candidateId(left)) ?? 0) ||
      right.fitScore - left.fitScore
    )
  })
}

function legacyRankWithPreference(params: {
  ranked: readonly ScoredVenue[]
  preferredCandidate?: ScoredVenue
  includePreferredCandidate: boolean
}): ScoredVenue[] {
  return params.includePreferredCandidate && params.preferredCandidate
    ? [
        { ...params.preferredCandidate, isAnchor: true },
        ...params.ranked.filter(
          (candidate) => candidateId(candidate) !== candidateId(params.preferredCandidate!),
        ),
      ]
    : [...params.ranked]
}

const roleCandidates = [
  candidate('fit-tiebreaker', 0.92),
  candidate('score-leader', 0.74),
  candidate('low-score', 0.99),
  candidate('preferred-support', 0.65),
  candidate('middle-score', 0.8),
]
const selectionScores = new Map([
  ['fit-tiebreaker', 0.8],
  ['score-leader', 0.91],
  ['low-score', 0.4],
  ['preferred-support', 0.72],
  ['middle-score', 0.8],
])

const legacyRanked = legacyRank(roleCandidates, selectionScores)
const ordering = coordinateArcRolePoolOrdering({
  candidates: roleCandidates,
  preferredCandidate: roleCandidates[3],
  includePreferredCandidate: true,
  getCandidateId: candidateId,
  getSelectionScore: (item) => selectionScores.get(candidateId(item)) ?? 0,
  getTieBreakScore: (item) => item.fitScore,
  projectPreferredCandidate: (item) => ({ ...item, isAnchor: true }),
})
const legacyWithPreference = legacyRankWithPreference({
  ranked: legacyRanked,
  preferredCandidate: roleCandidates[3],
  includePreferredCandidate: true,
})

assert(
  signature(ordering.ranked) === signature(legacyRanked),
  'Role-pool ordering changed.',
)
assert(
  signature(ordering.rankedWithPreference) === signature(legacyWithPreference),
  'Preferred-candidate projection/order changed.',
)

const regularLimit = getArcRolePoolCandidateLimit('warmup', false)
const boostedLimit = getArcRolePoolCandidateLimit('cooldown', true)
assert(regularLimit === 14, 'Regular role-pool cap changed.')
assert(boostedLimit === 16, 'Boosted role-pool cap changed.')
assert(
  limitArcRolePoolCandidates(ordering.rankedWithPreference, 3).length === 3,
  'Role-pool cap slicing changed.',
)
assert(
  signature(limitArcRolePoolCandidates(ordering.rankedWithPreference, 3)) ===
    signature(legacyWithPreference.slice(0, 3)),
  'Capped role-pool ordering changed.',
)

const projected = projectArcRolePools({
  warmup: {
    candidates: [candidate('warmup-a', 0.8)],
    status: { role: 'warmup', contractLabel: 'warmup', contractStrength: 'none', contractSatisfied: true, contractRelaxed: false },
  },
  peak: {
    candidates: [candidate('peak-a', 0.9)],
    status: { role: 'peak', contractLabel: 'peak', contractStrength: 'none', contractSatisfied: true, contractRelaxed: false },
  },
  wildcard: {
    candidates: [candidate('wildcard-a', 0.7)],
    status: { role: 'wildcard', contractLabel: 'wildcard', contractStrength: 'none', contractSatisfied: true, contractRelaxed: false },
  },
  cooldown: {
    candidates: [candidate('cooldown-a', 0.6)],
    status: { role: 'cooldown', contractLabel: 'cooldown', contractStrength: 'none', contractSatisfied: true, contractRelaxed: false },
  },
})
assert(projected.warmup.length === 1, 'Warmup projection changed.')
assert(projected.peak.length === 1, 'Peak projection changed.')
assert(projected.wildcard.length === 1, 'Wildcard projection changed.')
assert(projected.cooldown.length === 1, 'Cooldown projection changed.')
assert(projected.contractPoolStatus.peak.role === 'peak', 'Contract status projection changed.')

const helperSource = readFileSync(
  'src/integrations/waypoint/coordination/coordinateArcRolePools.ts',
  'utf8',
)
const forbiddenResidue = [
  'family',
  'romantic',
  'fallback',
  'preserve',
  'recovery',
  'Taste',
  'Bearings',
  'Field',
  'GreatStop',
  'fetch(',
  'provider',
]
const residueMatches = forbiddenResidue.filter((term) => helperSource.includes(term))
assert(residueMatches.length === 0, `Owner or Gate 1 residue moved into Waypoint: ${residueMatches.join(', ')}`)

console.log(
  JSON.stringify(
    {
      observer: 'waypoint_role_pool_ordering_parity',
      status: 'PASS',
      rolePoolOrderingPreserved: true,
      preferredProjectionPreserved: true,
      regularCap: regularLimit,
      boostedCap: boostedLimit,
      capsPreserved: true,
      compatibilityProjectionPreserved: true,
      gate1PolicyMoved: false,
      ownerLogicMovedIntoWaypoint: false,
      providerNetworkCalls: fetchCallCount,
    },
    null,
    2,
  ),
)
