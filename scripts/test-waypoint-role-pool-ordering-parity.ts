import { readFileSync } from 'node:fs'
import {
  computeRolePoolRankingBreakdown,
  computeRolePoolRankingScore,
} from '../src/domain/arc/buildRolePools'
import {
  coordinateArcRolePoolOrdering,
  getArcRolePoolCandidateLimit,
  limitArcRolePoolCandidates,
  projectArcRolePools,
} from '../src/integrations/waypoint/coordination/coordinateArcRolePools'
import type { ScoredVenue } from '../src/domain/types/arc'
import type { ExperienceLens } from '../src/domain/types/experienceLens'
import type { IntentProfile } from '../src/domain/types/intent'
import type { InternalRole } from '../src/domain/types/venue'

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

interface ScoreCandidateOptions {
  id: string
  category?: string
  roleScores?: Partial<Record<InternalRole, number>>
  tasteBonus?: Partial<Record<InternalRole, number>>
  modeAlignment?: Partial<Record<InternalRole, number>>
  modePenalty?: Partial<Record<InternalRole, number>>
  highlightPlausibility?: number
  momentContribution?: number
  momentPotential?: number
  momentIntensity?: number
  momentTier?: 'standard' | 'strong' | 'exceptional' | 'signature'
  archetype?: string
  fitScore?: number
  lensCompatibility?: number
  shapeFit?: Partial<Record<'start' | 'highlight' | 'surprise' | 'windDown', number>>
  vibeFit?: Partial<Record<'start' | 'highlight' | 'surprise' | 'windDown', number>>
  contextFit?: Partial<Record<InternalRole, number>>
  dominance?: Partial<Record<InternalRole, number>>
  contract?: Partial<Record<InternalRole, { score: number; strength: 'none' | 'soft' | 'strong' | 'required'; satisfied: boolean }>>
  validity?: 'valid' | 'fallback' | 'invalid'
  fallbackPenalty?: number
}

const roleOrder: InternalRole[] = ['warmup', 'peak', 'wildcard', 'cooldown']
const lensRoleOrder = ['start', 'highlight', 'surprise', 'windDown'] as const

function roleRecord(defaultValue: number, override?: Partial<Record<InternalRole, number>>): Record<InternalRole, number> {
  return {
    warmup: override?.warmup ?? defaultValue,
    peak: override?.peak ?? defaultValue,
    wildcard: override?.wildcard ?? defaultValue,
    cooldown: override?.cooldown ?? defaultValue,
  }
}

function lensRoleRecord(
  defaultValue: number,
  override?: Partial<Record<(typeof lensRoleOrder)[number], number>>,
): Record<(typeof lensRoleOrder)[number], number> {
  return {
    start: override?.start ?? defaultValue,
    highlight: override?.highlight ?? defaultValue,
    surprise: override?.surprise ?? defaultValue,
    windDown: override?.windDown ?? defaultValue,
  }
}

function roleInfluence(
  options: ScoreCandidateOptions,
): ScoredVenue['taste']['rolePoolInfluence'] {
  return Object.fromEntries(
    roleOrder.map((role) => [
      role,
      {
        tasteBonus: options.tasteBonus?.[role] ?? 0.04,
        roleSuitabilityContribution: 0.03,
        momentContribution: role === 'peak' ? (options.momentContribution ?? 0.05) : 0.01,
        highlightPlausibilityBonus: role === 'peak' ? (options.highlightPlausibility ?? 0.05) : 0,
        modeAlignmentContribution: options.modeAlignment?.[role] ?? 0.03,
        modeAlignmentPenalty: options.modePenalty?.[role] ?? 0.01,
      },
    ]),
  ) as ScoredVenue['taste']['rolePoolInfluence']
}

function roleContracts(
  options: ScoreCandidateOptions,
): ScoredVenue['roleContract'] {
  return Object.fromEntries(
    roleOrder.map((role) => [
      role,
      {
        score: options.contract?.[role]?.score ?? 0.82,
        strength: options.contract?.[role]?.strength ?? 'none',
        satisfied: options.contract?.[role]?.satisfied ?? true,
        label: `${role} contract`,
        role,
        reasons: [],
      },
    ]),
  ) as ScoredVenue['roleContract']
}

function scoreCandidate(options: ScoreCandidateOptions): ScoredVenue {
  const roleSuitability = {
    start: 0.72,
    highlight: 0.74,
    surprise: 0.62,
    windDown: 0.68,
  }

  return {
    candidateIdentity: {
      candidateId: options.id,
      baseVenueId: options.id,
      kind: 'base',
      traceLabel: options.id,
    },
    venue: {
      id: options.id,
      name: options.id,
      category: options.category ?? 'bar',
      subcategory: 'wine-bar',
      tags: ['conversation', 'local'],
      vibeTags: ['warm', 'social'],
      energyLevel: 3,
      source: {
        sourceOrigin: 'curated',
      },
    },
    momentIdentity: {
      type: options.archetype === 'close' ? 'close' : 'anchor',
      strength: options.momentIntensity && options.momentIntensity < 0.45 ? 'light' : 'strong',
    },
    fitScore: options.fitScore ?? 0.78,
    hiddenGemScore: 0.4,
    lensCompatibility: options.lensCompatibility ?? 0.76,
    contextSpecificity: {
      overall: 0.7,
      personaSignal: 0.7,
      vibeSignal: 0.7,
      lensSignal: 0.7,
      byRole: roleRecord(0.68, options.contextFit),
    },
    dominanceControl: {
      universalityScore: 0.2,
      flaggedUniversal: false,
      byRole: roleRecord(0.14, options.dominance),
    },
    roleContract: roleContracts(options),
    stopShapeFit: lensRoleRecord(0.72, options.shapeFit),
    vibeAuthority: {
      primary: 0.7,
      secondary: 0.62,
      overall: 0.68,
      packPressure: { highlight: 0.5 },
      byRole: lensRoleRecord(0.68, options.vibeFit),
      pressureSource: { highlight: 'candidate' },
      musicSupportSource: 'none',
      adventureRead: 'none',
      adventureReadScores: { outdoor: 0, urban: 0 },
      adventureNotes: [],
    },
    highlightValidity: {
      validityLevel: options.validity ?? 'valid',
      packLiteralRequirementSatisfied: true,
      personaVetoes: [],
      contextVetoes: [],
      violations: [],
    },
    roleScores: roleRecord(0.72, options.roleScores),
    taste: {
      signals: {
        energy: 0.62,
        socialDensity: 0.64,
        intimacy: 0.58,
        lingerFactor: 0.62,
        destinationFactor: 0.64,
        experientialFactor: 0.66,
        conversationFriendliness: 0.72,
        interactiveStrength: 0.6,
        durationEstimate: 'medium',
        roleSuitability,
        momentIntensity: {
          score: options.momentIntensity ?? 0.68,
          tier: options.momentTier ?? 'strong',
          drivers: [],
        },
        momentPotential: {
          score: options.momentPotential ?? 0.72,
          tier: 'strong',
          drivers: [],
        },
        anchorStrength: 0.66,
        primaryExperienceArchetype: options.archetype ?? 'social',
        experienceArchetypes: [options.archetype ?? 'social'],
      },
      modeAlignment: {
        score: 0.7,
        penalty: 0,
        lane: 'social',
        tier: 'good',
        supportiveTagScore: 0.7,
        lanePriorityScore: 0.7,
      },
      fallbackPenalty: {
        signalScore: 0,
        appliedPenalty: options.fallbackPenalty ?? 0,
        applied: (options.fallbackPenalty ?? 0) > 0,
        strongerAlternativePresent: false,
        reason: 'fixture',
      },
      rolePoolInfluence: roleInfluence(options),
    },
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

const scoreParityLens = {
  tasteMode: { id: 'activity-led' },
  windDownExpectation: { preferredCategories: ['dessert', 'cafe', 'bar'] },
} as ExperienceLens
const scoreParityIntent = {
  mode: 'build',
  persona: 'friends',
  discoveryPreferences: [
    { venueId: 'contract-bonus', role: 'highlight' },
    { venueId: 'cooldown-compatible', role: 'windDown' },
  ],
} as IntentProfile

function roleAlignmentWeight(role: InternalRole): number {
  return role === 'peak' ? 1.72 : role === 'warmup' ? 1.28 : role === 'wildcard' ? 1.06 : 1
}

function scoreFromBreakdownFields(
  breakdown: ReturnType<typeof computeRolePoolRankingBreakdown>,
  role: InternalRole,
): number {
  const weight = roleAlignmentWeight(role)

  return (
    breakdown.roleFitContribution +
    breakdown.tasteContribution +
    breakdown.highlightPlausibilityContribution +
    breakdown.modeAlignmentContribution * weight -
    breakdown.modeAlignmentPenaltyContribution * weight +
    breakdown.discoveryPreferenceContribution +
    breakdown.fitContribution +
    breakdown.lensContribution +
    breakdown.stopShapeContribution +
    breakdown.vibeContribution +
    breakdown.contextContribution -
    breakdown.dominancePenaltyContribution +
    breakdown.momentContribution +
    breakdown.highlightValidityContribution +
    breakdown.contractBonusContribution -
    breakdown.contractPenaltyContribution +
    breakdown.rolePoolLiftContribution +
    breakdown.roleLiftContribution +
    breakdown.rolePromotionContribution +
    breakdown.cooldownPreferenceContribution
  )
}

const scoreParityCases: Array<{
  name: string
  role: InternalRole
  candidate: ScoredVenue
}> = [
  {
    name: 'start strong role fit',
    role: 'warmup',
    candidate: scoreCandidate({
      id: 'start-strong-role-fit',
      category: 'cafe',
      roleScores: { warmup: 0.94 },
      shapeFit: { start: 0.9 },
    }),
  },
  {
    name: 'highlight weak role fit',
    role: 'peak',
    candidate: scoreCandidate({
      id: 'highlight-weak-role-fit',
      roleScores: { peak: 0.45 },
      shapeFit: { highlight: 0.48 },
      validity: 'fallback',
    }),
  },
  {
    name: 'highlight high Taste contribution',
    role: 'peak',
    candidate: scoreCandidate({
      id: 'high-taste-contribution',
      tasteBonus: { peak: 0.22 },
      modeAlignment: { peak: 0.12 },
      momentPotential: 0.84,
      momentIntensity: 0.82,
      momentTier: 'exceptional',
    }),
  },
  {
    name: 'highlight moment plausible',
    role: 'peak',
    candidate: scoreCandidate({
      id: 'moment-highlight-plausible',
      highlightPlausibility: 0.18,
      momentContribution: 0.14,
      archetype: 'activity',
      momentPotential: 0.9,
    }),
  },
  {
    name: 'windDown cooldown compatible',
    role: 'cooldown',
    candidate: scoreCandidate({
      id: 'cooldown-compatible',
      category: 'dessert',
      roleScores: { cooldown: 0.86 },
      shapeFit: { windDown: 0.88 },
      vibeFit: { windDown: 0.84 },
    }),
  },
  {
    name: 'highlight contract bonus',
    role: 'peak',
    candidate: scoreCandidate({
      id: 'contract-bonus',
      contract: { peak: { score: 0.95, strength: 'strong', satisfied: true } },
    }),
  },
  {
    name: 'highlight contract penalty',
    role: 'peak',
    candidate: scoreCandidate({
      id: 'contract-penalty',
      contract: { peak: { score: 0.35, strength: 'required', satisfied: false } },
    }),
  },
  {
    name: 'highlight dominance penalty',
    role: 'peak',
    candidate: scoreCandidate({
      id: 'dominance-penalty',
      dominance: { peak: 0.82 },
    }),
  },
]

for (const parityCase of scoreParityCases) {
  const score = computeRolePoolRankingScore(
    parityCase.candidate,
    parityCase.role,
    scoreParityLens,
    scoreParityIntent,
  )
  const breakdown = computeRolePoolRankingBreakdown(
    parityCase.candidate,
    parityCase.role,
    scoreParityLens,
    scoreParityIntent,
  )
  const recomposedScore = scoreFromBreakdownFields(breakdown, parityCase.role)

  assert(
    Math.abs(score - breakdown.score) < 1e-12,
    `Role-pool score/debug split changed score for ${parityCase.name}.`,
  )
  assert(
    Math.abs(score - recomposedScore) < 1e-12,
    `Role-pool score formula projection changed for ${parityCase.name}.`,
  )
}

const debugCompetitionRole: InternalRole = 'peak'
const debugCompetitionCandidates = scoreParityCases
  .filter((entry) => entry.role === debugCompetitionRole)
  .map((entry) => entry.candidate)
const legacyDebugCompetitionOrdering = [...debugCompetitionCandidates].sort(
  (left, right) =>
    computeRolePoolRankingBreakdown(
      right,
      debugCompetitionRole,
      scoreParityLens,
      scoreParityIntent,
    ).score -
    computeRolePoolRankingBreakdown(
      left,
      debugCompetitionRole,
      scoreParityLens,
      scoreParityIntent,
    ).score,
)
const scorePathDebugCompetitionOrdering = [...debugCompetitionCandidates].sort(
  (left, right) =>
    computeRolePoolRankingScore(
      right,
      debugCompetitionRole,
      scoreParityLens,
      scoreParityIntent,
    ) -
    computeRolePoolRankingScore(
      left,
      debugCompetitionRole,
      scoreParityLens,
      scoreParityIntent,
    ),
)

assert(
  signature(legacyDebugCompetitionOrdering) ===
    signature(scorePathDebugCompetitionOrdering),
  'Debug competition ordering changed when sorting through score path.',
)

for (const candidate of debugCompetitionCandidates) {
  const score = computeRolePoolRankingScore(
    candidate,
    debugCompetitionRole,
    scoreParityLens,
    scoreParityIntent,
  )
  const breakdown = computeRolePoolRankingBreakdown(
    candidate,
    debugCompetitionRole,
    scoreParityLens,
    scoreParityIntent,
  )

  assert(
    Math.abs(score - breakdown.score) < 1e-12,
    `Debug competition score path diverged from breakdown score for ${candidateId(candidate)}.`,
  )
  assert(
    typeof breakdown.tasteContribution === 'number' &&
      typeof breakdown.tasteRoleSuitabilityContribution === 'number' &&
      typeof breakdown.highlightPlausibilityContribution === 'number',
    `Debug breakdown diagnostic fields missing for ${candidateId(candidate)}.`,
  )
}

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
      scoreDebugSplitParity: true,
      debugCompetitionOrderingPreserved: true,
      debugSortingScorePathParity: true,
      breakdownDiagnosticFieldsPreserved: true,
      representativeScoreCases: scoreParityCases.map((entry) => entry.name),
      representativeRoles: ['start', 'highlight', 'windDown'],
      gate1PolicyMoved: false,
      ownerLogicMovedIntoWaypoint: false,
      providerNetworkCalls: fetchCallCount,
    },
    null,
    2,
  ),
)
