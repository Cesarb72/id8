import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { strict as assert } from 'node:assert'

import { scoreAnchoredRoleFit } from '../src/domain/arc/scoreAnchoredRoleFit'
import type { InternalRole, ScoredVenue } from '../src/domain/types/arc'

const projectRoot = process.cwd()
const sandboxPagePath = join(projectRoot, 'src/pages/SandboxConciergePage.tsx')
const publicPagePath = join(projectRoot, 'src/pages/PublicConciergePage.tsx')

const fetchCalls: string[] = []
const originalFetch = globalThis.fetch

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  fetchCalls.push(url)
  throw new Error(`Provider/network call blocked by observer: ${url}`)
}) as typeof fetch

type AppShadowPath =
  | 'canonical_repair'
  | 'signature_highlight_shortlist'
  | 'strong_curation_role_pool'
  | 'role_pool_repair'
  | 'swap_ordering'
  | 'swap_identity_hydration'

type RoleEligibility = {
  score: number
  hoursCompatible: boolean
  reasons: string[]
}

type CandidateQualification = {
  roleEligibility: {
    start: RoleEligibility
    highlight: RoleEligibility
    windDown: RoleEligibility
  }
  highlightQualificationScore: number
  highlightQualificationReasons: string[]
}

type FixtureCandidate = ScoredVenue & {
  diagnostics: {
    driveMinutes: number
    qualification: CandidateQualification
  }
}

const roleScores = (
  defaultValue: number,
  overrides: Partial<Record<InternalRole, number>> = {},
): Record<InternalRole, number> => ({
  warmup: defaultValue,
  peak: defaultValue,
  wildcard: defaultValue,
  cooldown: defaultValue,
  ...overrides,
})

const roleSpecificity = (
  defaultValue: number,
  overrides: Partial<Record<InternalRole, number>> = {},
): Record<InternalRole, number> => ({
  warmup: defaultValue,
  peak: defaultValue,
  wildcard: defaultValue,
  cooldown: defaultValue,
  ...overrides,
})

const roleContract = (
  defaultScore: number,
  overrides: Partial<Record<InternalRole, number>> = {},
): Record<InternalRole, { score: number }> => ({
  warmup: { score: overrides.warmup ?? defaultScore },
  peak: { score: overrides.peak ?? defaultScore },
  wildcard: { score: overrides.wildcard ?? defaultScore },
  cooldown: { score: overrides.cooldown ?? defaultScore },
})

const qualification = (
  baseScore: number,
  overrides: Partial<{
    start: number
    highlight: number
    windDown: number
    highlightQualificationScore: number
  }> = {},
): CandidateQualification => ({
  roleEligibility: {
    start: {
      score: overrides.start ?? baseScore,
      hoursCompatible: true,
      reasons: [],
    },
    highlight: {
      score: overrides.highlight ?? baseScore,
      hoursCompatible: true,
      reasons: [],
    },
    windDown: {
      score: overrides.windDown ?? baseScore,
      hoursCompatible: true,
      reasons: [],
    },
  },
  highlightQualificationScore: overrides.highlightQualificationScore ?? overrides.highlight ?? baseScore,
  highlightQualificationReasons: [],
})

const makeCandidate = (params: {
  id: string
  name: string
  sourceOrigin?: string
  providerRecordId?: string
  hasCoordinates?: boolean
  fitScore: number
  roleScores: Record<InternalRole, number>
  contextSpecificity: Record<InternalRole, number>
  roleContract: Record<InternalRole, { score: number }>
  experientialFactor: number
  categorySpecificity: number
  personalityStrength: number
  hiddenGemScore: number
  uniquenessFit: number
  stopShapeFit: {
    start: number
    highlight: number
    surprise: number
    windDown: number
  }
  modeAlignment: number
  roleSuitability: {
    start: number
    highlight: number
    windDown: number
    surprise: number
  }
  momentIntensity: number
  momentPotential: number
  momentElevationPotential: number
  destinationFactor: number
  signatureScore: number
  vibeAuthorityHighlight: number
  highlightValidity: number
  genericPenaltySignals?: {
    universalityScore?: number
    fallbackPenalty?: number
    flaggedUniversal?: boolean
  }
  driveMinutes: number
  qualification: CandidateQualification
}): FixtureCandidate => {
  const latitude = params.hasCoordinates === false ? undefined : 37.33
  const longitude = params.hasCoordinates === false ? undefined : -121.89

  return {
    venue: {
      id: params.id,
      name: params.name,
      category: 'restaurant',
      categories: ['restaurant'],
      source: {
        sourceOrigin: params.sourceOrigin ?? 'field',
        providerRecordId: params.providerRecordId,
        latitude,
        longitude,
      },
      signature: {
        signatureScore: params.signatureScore,
      },
    },
    candidateIdentity: {
      kind: 'venue',
      baseVenueId: params.id,
    },
    roleScores: params.roleScores,
    fitScore: params.fitScore,
    contextSpecificity: {
      byRole: params.contextSpecificity,
    },
    roleContract: params.roleContract,
    taste: {
      modeAlignment: {
        score: params.modeAlignment,
      },
      signals: {
        experientialFactor: params.experientialFactor,
        categorySpecificity: params.categorySpecificity,
        personalityStrength: params.personalityStrength,
        destinationFactor: params.destinationFactor,
        roleSuitability: params.roleSuitability,
        momentIntensity: {
          score: params.momentIntensity,
        },
        momentPotential: {
          score: params.momentPotential,
        },
        momentElevationPotential: params.momentElevationPotential,
        durationEstimate: 'moderate',
        lingerFactor: params.roleSuitability.windDown,
        intimacy: params.roleSuitability.windDown * 0.82,
        conversationFriendliness: params.roleSuitability.windDown * 0.88,
      },
      fallbackPenalty: {
        signalScore: params.genericPenaltySignals?.fallbackPenalty ?? 0,
      },
    },
    hiddenGemScore: params.hiddenGemScore,
    fitBreakdown: {
      uniquenessFit: params.uniquenessFit,
    },
    stopShapeFit: params.stopShapeFit,
    vibeAuthority: {
      byRole: {
        highlight: params.vibeAuthorityHighlight,
      },
    },
    highlightValidity: {
      validityLevel: params.highlightValidity,
      validForIntent: params.highlightValidity >= 0.55,
      packLiteralRequirementSatisfied: params.highlightValidity >= 0.6,
    },
    dominanceControl: {
      universalityScore: params.genericPenaltySignals?.universalityScore ?? 0,
      flaggedUniversal: params.genericPenaltySignals?.flaggedUniversal ?? false,
    },
    diagnostics: {
      driveMinutes: params.driveMinutes,
      qualification: params.qualification,
    },
  } as FixtureCandidate
}

const candidates = [
  makeCandidate({
    id: 'signal-led-highlight',
    name: 'Signal Led Highlight',
    providerRecordId: 'google-signal-led',
    fitScore: 0.86,
    roleScores: roleScores(0.5, { peak: 0.72, warmup: 0.54, cooldown: 0.46 }),
    contextSpecificity: roleSpecificity(0.62, { peak: 0.86, warmup: 0.6, cooldown: 0.54 }),
    roleContract: roleContract(0.56, { peak: 0.88, warmup: 0.55, cooldown: 0.5 }),
    experientialFactor: 0.9,
    categorySpecificity: 0.84,
    personalityStrength: 0.86,
    hiddenGemScore: 0.82,
    uniquenessFit: 0.76,
    stopShapeFit: {
      start: 0.54,
      highlight: 0.9,
      surprise: 0.78,
      windDown: 0.45,
    },
    modeAlignment: 0.84,
    roleSuitability: {
      start: 0.54,
      highlight: 0.92,
      windDown: 0.42,
      surprise: 0.72,
    },
    momentIntensity: 0.92,
    momentPotential: 0.9,
    momentElevationPotential: 0.9,
    destinationFactor: 0.88,
    signatureScore: 0.9,
    vibeAuthorityHighlight: 0.84,
    highlightValidity: 0.88,
    driveMinutes: 12,
    qualification: qualification(0.6, {
      start: 0.56,
      highlight: 0.9,
      windDown: 0.48,
      highlightQualificationScore: 0.91,
    }),
  }),
  makeCandidate({
    id: 'raw-role-score-generic',
    name: 'Downtown Restaurant',
    sourceOrigin: 'fallback_seed',
    hasCoordinates: false,
    fitScore: 0.74,
    roleScores: roleScores(0.5, { peak: 0.92, warmup: 0.64, cooldown: 0.58 }),
    contextSpecificity: roleSpecificity(0.46, { peak: 0.42, warmup: 0.48, cooldown: 0.44 }),
    roleContract: roleContract(0.48, { peak: 0.52, warmup: 0.5, cooldown: 0.48 }),
    experientialFactor: 0.48,
    categorySpecificity: 0.4,
    personalityStrength: 0.38,
    hiddenGemScore: 0.26,
    uniquenessFit: 0.24,
    stopShapeFit: {
      start: 0.48,
      highlight: 0.42,
      surprise: 0.34,
      windDown: 0.5,
    },
    modeAlignment: 0.58,
    roleSuitability: {
      start: 0.58,
      highlight: 0.5,
      windDown: 0.5,
      surprise: 0.36,
    },
    momentIntensity: 0.45,
    momentPotential: 0.46,
    momentElevationPotential: 0.42,
    destinationFactor: 0.38,
    signatureScore: 0.42,
    vibeAuthorityHighlight: 0.36,
    highlightValidity: 0.36,
    genericPenaltySignals: {
      universalityScore: 0.88,
      fallbackPenalty: 0.8,
      flaggedUniversal: true,
    },
    driveMinutes: 5,
    qualification: qualification(0.54, {
      start: 0.56,
      highlight: 0.48,
      windDown: 0.52,
      highlightQualificationScore: 0.48,
    }),
  }),
  makeCandidate({
    id: 'warmup-context-fit',
    name: 'Warmup Context Fit',
    providerRecordId: 'google-warmup-fit',
    fitScore: 0.82,
    roleScores: roleScores(0.5, { warmup: 0.78, peak: 0.52, cooldown: 0.56 }),
    contextSpecificity: roleSpecificity(0.64, { warmup: 0.86, peak: 0.56, cooldown: 0.58 }),
    roleContract: roleContract(0.58, { warmup: 0.84, peak: 0.52, cooldown: 0.54 }),
    experientialFactor: 0.72,
    categorySpecificity: 0.72,
    personalityStrength: 0.68,
    hiddenGemScore: 0.62,
    uniquenessFit: 0.58,
    stopShapeFit: {
      start: 0.88,
      highlight: 0.52,
      surprise: 0.48,
      windDown: 0.55,
    },
    modeAlignment: 0.76,
    roleSuitability: {
      start: 0.86,
      highlight: 0.48,
      windDown: 0.54,
      surprise: 0.48,
    },
    momentIntensity: 0.56,
    momentPotential: 0.58,
    momentElevationPotential: 0.54,
    destinationFactor: 0.58,
    signatureScore: 0.56,
    vibeAuthorityHighlight: 0.44,
    highlightValidity: 0.5,
    driveMinutes: 10,
    qualification: qualification(0.64, {
      start: 0.86,
      highlight: 0.48,
      windDown: 0.54,
      highlightQualificationScore: 0.48,
    }),
  }),
  makeCandidate({
    id: 'cooldown-easy-finish',
    name: 'Cooldown Easy Finish',
    providerRecordId: 'google-cooldown',
    fitScore: 0.8,
    roleScores: roleScores(0.5, { cooldown: 0.8, warmup: 0.54, peak: 0.48 }),
    contextSpecificity: roleSpecificity(0.64, { cooldown: 0.86, warmup: 0.54, peak: 0.5 }),
    roleContract: roleContract(0.58, { cooldown: 0.86, warmup: 0.52, peak: 0.48 }),
    experientialFactor: 0.64,
    categorySpecificity: 0.7,
    personalityStrength: 0.66,
    hiddenGemScore: 0.58,
    uniquenessFit: 0.54,
    stopShapeFit: {
      start: 0.5,
      highlight: 0.46,
      surprise: 0.42,
      windDown: 0.9,
    },
    modeAlignment: 0.74,
    roleSuitability: {
      start: 0.5,
      highlight: 0.42,
      windDown: 0.88,
      surprise: 0.4,
    },
    momentIntensity: 0.44,
    momentPotential: 0.5,
    momentElevationPotential: 0.48,
    destinationFactor: 0.48,
    signatureScore: 0.52,
    vibeAuthorityHighlight: 0.38,
    highlightValidity: 0.42,
    driveMinutes: 6,
    qualification: qualification(0.62, {
      start: 0.52,
      highlight: 0.42,
      windDown: 0.88,
      highlightQualificationScore: 0.42,
    }),
  }),
]

const round = (value: number): number => Number(value.toFixed(6))

const assertSourceContains = (source: string, needle: string, label: string) => {
  assert.ok(source.includes(needle), `${label} missing source marker: ${needle}`)
}

const roleToInternalRole = {
  start: 'warmup',
  highlight: 'peak',
  windDown: 'cooldown',
} as const

const rankByAnchoredRoleFit = (role: InternalRole) =>
  [...candidates]
    .sort((left, right) => {
      const leftScore = scoreAnchoredRoleFit(left, role)
      const rightScore = scoreAnchoredRoleFit(right, role)
      return rightScore - leftScore || left.venue.name.localeCompare(right.venue.name)
    })
    .map((candidate) => ({
      id: candidate.venue.id,
      score: round(scoreAnchoredRoleFit(candidate, role)),
    }))

const scoreSignatureHighlightShortlistCandidate = (candidate: FixtureCandidate): number => {
  const signals = candidate.taste.signals
  const qualification = candidate.diagnostics.qualification
  const score =
    qualification.highlightQualificationScore * 0.38 +
    signals.roleSuitability.highlight * 0.16 +
    signals.momentIntensity.score * 0.13 +
    signals.destinationFactor * 0.11 +
    signals.experientialFactor * 0.1 +
    candidate.venue.signature.signatureScore * 0.08 +
    scoreAnchoredRoleFit(candidate, 'peak') * 0.04

  return score
}

const rankSignatureHighlightShortlist = () =>
  [...candidates]
    .map((candidate) => ({
      id: candidate.venue.id,
      score: round(scoreSignatureHighlightShortlistCandidate(candidate)),
    }))
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))

const scoreStrongCurationRoleCandidate = (
  candidate: FixtureCandidate,
  role: 'start' | 'highlight' | 'windDown',
): number => {
  const qualification = candidate.diagnostics.qualification

  if (role === 'highlight') {
    return (
      qualification.highlightQualificationScore * 0.64 +
      scoreAnchoredRoleFit(candidate, 'peak') * 0.36 +
      (qualification.highlightQualificationReasons.length === 0 ? 0.04 : 0)
    )
  }

  if (role === 'start') {
    return (
      qualification.roleEligibility.start.score * 0.48 +
      scoreAnchoredRoleFit(candidate, 'warmup') * 0.52 +
      (qualification.roleEligibility.start.hoursCompatible ? 0.03 : 0)
    )
  }

  return (
    qualification.roleEligibility.windDown.score * 0.46 +
    scoreAnchoredRoleFit(candidate, 'cooldown') * 0.54 +
    (qualification.roleEligibility.windDown.hoursCompatible ? 0.03 : 0)
  )
}

const rankStrongCurationRolePool = (role: 'start' | 'highlight' | 'windDown') =>
  [...candidates]
    .map((candidate) => ({
      id: candidate.venue.id,
      score: round(scoreStrongCurationRoleCandidate(candidate, role)),
    }))
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))

const scoreRolePoolRepairCandidate = (
  candidate: FixtureCandidate,
  role: 'start' | 'highlight' | 'windDown',
): number => {
  const qualification = candidate.diagnostics.qualification
  const roleScoreKey = roleToInternalRole[role]

  if (role === 'highlight') {
    return qualification.highlightQualificationScore * 0.55 + scoreAnchoredRoleFit(candidate, roleScoreKey) * 0.45
  }

  return qualification.roleEligibility[role].score * 0.4 + scoreAnchoredRoleFit(candidate, roleScoreKey) * 0.6
}

const rankRolePoolRepair = (role: 'start' | 'highlight' | 'windDown') =>
  [...candidates]
    .map((candidate) => ({
      id: candidate.venue.id,
      score: round(scoreRolePoolRepairCandidate(candidate, role)),
    }))
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))

const rankSwapCandidates = (role: InternalRole, stopDriveMinutes: number) =>
  [...candidates]
    .map((candidate) => {
      const proximity = 1 - Math.min(1, Math.abs(candidate.diagnostics.driveMinutes - stopDriveMinutes) / 24)
      return {
        id: candidate.venue.id,
        score: round(scoreAnchoredRoleFit(candidate, role) * 0.9 + proximity * 0.1),
      }
    })
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))

const assertOrder = (
  label: AppShadowPath,
  observed: Array<{ id: string; score: number }>,
  expectedIds: string[],
) => {
  assert.deepEqual(
    observed.map((entry) => entry.id),
    expectedIds,
    `${label} ordering drifted`,
  )
}

try {
  const sandboxSource = readFileSync(sandboxPagePath, 'utf8')
  const publicSource = readFileSync(publicPagePath, 'utf8')

  assertSourceContains(sandboxSource, "import { scoreAnchoredRoleFit } from '../domain/arc/scoreAnchoredRoleFit'", 'Sandbox page')
  assertSourceContains(sandboxSource, 'function enforceFullStopRealityContract', 'Canonical repair path')
  assertSourceContains(sandboxSource, 'scoreAnchoredRoleFit(left, roleScoreKey)', 'Canonical repair path')
  assertSourceContains(sandboxSource, "scoreAnchoredRoleFit(candidate, 'peak') * 0.04", 'Signature highlight shortlist')
  assertSourceContains(sandboxSource, "scoreAnchoredRoleFit(candidate, 'peak') * 0.36", 'Strong curation highlight pool')
  assertSourceContains(sandboxSource, "scoreAnchoredRoleFit(candidate, 'warmup') * 0.52", 'Strong curation start pool')
  assertSourceContains(sandboxSource, "scoreAnchoredRoleFit(candidate, 'cooldown') * 0.54", 'Strong curation wind-down pool')
  assertSourceContains(sandboxSource, 'scoreAnchoredRoleFit(left, role) * 0.9 + leftProximity * 0.1', 'Swap ordering')
  assertSourceContains(sandboxSource, 'scoreAnchoredRoleFit(left, internalRole)', 'Swap identity hydration')
  assertSourceContains(publicSource, '<SandboxConciergePage surface="public"', 'Public concierge wrapper')

  const canonicalRepair = rankByAnchoredRoleFit('peak')
  const signatureHighlightShortlist = rankSignatureHighlightShortlist()
  const strongHighlightPool = rankStrongCurationRolePool('highlight')
  const strongStartPool = rankStrongCurationRolePool('start')
  const strongWindDownPool = rankStrongCurationRolePool('windDown')
  const rolePoolHighlightRepair = rankRolePoolRepair('highlight')
  const rolePoolStartRepair = rankRolePoolRepair('start')
  const swapOrdering = rankSwapCandidates('peak', 8)
  const swapIdentityHydration = rankByAnchoredRoleFit('cooldown')

  assertOrder('canonical_repair', canonicalRepair, [
    'signal-led-highlight',
    'warmup-context-fit',
    'cooldown-easy-finish',
    'raw-role-score-generic',
  ])
  assertOrder('signature_highlight_shortlist', signatureHighlightShortlist, [
    'signal-led-highlight',
    'warmup-context-fit',
    'cooldown-easy-finish',
    'raw-role-score-generic',
  ])
  assertOrder('strong_curation_role_pool', strongHighlightPool, [
    'signal-led-highlight',
    'warmup-context-fit',
    'cooldown-easy-finish',
    'raw-role-score-generic',
  ])
  assertOrder('strong_curation_role_pool', strongStartPool, [
    'warmup-context-fit',
    'signal-led-highlight',
    'cooldown-easy-finish',
    'raw-role-score-generic',
  ])
  assertOrder('strong_curation_role_pool', strongWindDownPool, [
    'cooldown-easy-finish',
    'warmup-context-fit',
    'signal-led-highlight',
    'raw-role-score-generic',
  ])
  assertOrder('role_pool_repair', rolePoolHighlightRepair, [
    'signal-led-highlight',
    'warmup-context-fit',
    'cooldown-easy-finish',
    'raw-role-score-generic',
  ])
  assertOrder('role_pool_repair', rolePoolStartRepair, [
    'warmup-context-fit',
    'signal-led-highlight',
    'cooldown-easy-finish',
    'raw-role-score-generic',
  ])
  assertOrder('swap_ordering', swapOrdering, [
    'signal-led-highlight',
    'warmup-context-fit',
    'cooldown-easy-finish',
    'raw-role-score-generic',
  ])
  assertOrder('swap_identity_hydration', swapIdentityHydration, [
    'cooldown-easy-finish',
    'warmup-context-fit',
    'signal-led-highlight',
    'raw-role-score-generic',
  ])

  const shadowPathClassification = [
    {
      path: 'canonical_repair',
      ownerSignalConsumed: 'Taste-authored role/meaning signals plus provider identity breadcrumbs',
      appAuthoredAction: 'replacement candidate ordering',
      replacementExists: 'partial; Gate 1 action policy covers recovery class but not this public-page repair call site',
      phase4SafeAction: 'observer only',
      phase5Blocked: true,
    },
    {
      path: 'signature_highlight_shortlist',
      ownerSignalConsumed: 'Taste highlight qualification, moment, destination, and anchored role fit signals',
      appAuthoredAction: 'public-page shortlist ranking',
      replacementExists: 'no direct owner pipeline replacement',
      phase4SafeAction: 'observer only',
      phase5Blocked: true,
    },
    {
      path: 'strong_curation_role_pool',
      ownerSignalConsumed: 'Taste/Bearings qualification values and anchored role fit',
      appAuthoredAction: 'public-page role-pool weighting',
      replacementExists: 'domain Arc role pools exist, but this page still authors a parallel pool',
      phase4SafeAction: 'observer only',
      phase5Blocked: true,
    },
    {
      path: 'role_pool_repair',
      ownerSignalConsumed: 'Taste role qualification and anchored role fit',
      appAuthoredAction: 'fallback role-pool repair ordering',
      replacementExists: 'partial; Waypoint policy covers Arc-side repair, not this page call site',
      phase4SafeAction: 'observer only',
      phase5Blocked: true,
    },
    {
      path: 'swap_ordering',
      ownerSignalConsumed: 'anchored role fit and proximity',
      appAuthoredAction: 'swap candidate ordering',
      replacementExists: 'held for Gate 2 / LCE steering',
      phase4SafeAction: 'observer only',
      phase5Blocked: true,
    },
    {
      path: 'swap_identity_hydration',
      ownerSignalConsumed: 'anchored role fit and raw role score threshold',
      appAuthoredAction: 'swap identity candidate hydration ordering',
      replacementExists: 'held for Gate 2 / LCE steering',
      phase4SafeAction: 'observer only',
      phase5Blocked: true,
    },
  ] as const

  assert.equal(fetchCalls.length, 0, 'observer made provider/network calls')

  console.log(
    JSON.stringify(
      {
        observer: 'application scoreAnchoredRoleFit impact',
        publicConciergeUsesSandbox: true,
        appShadowPaths: shadowPathClassification,
        outputs: {
          canonicalRepair,
          signatureHighlightShortlist,
          strongHighlightPool,
          strongStartPool,
          strongWindDownPool,
          rolePoolHighlightRepair,
          rolePoolStartRepair,
          swapOrdering,
          swapIdentityHydration,
        },
        providerNetworkCalls: fetchCalls.length,
      },
      null,
      2,
    ),
  )
} finally {
  globalThis.fetch = originalFetch
}
