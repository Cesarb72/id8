import { readFileSync } from 'node:fs'
import { rankArcCandidatesFromContract } from '../src/integrations/waypoint/rankArcCandidates'
import type { ArcCandidate, ArcStop } from '../src/domain/types/arc'
import type { WaypointContractInput } from '../src/integrations/waypoint/core'
import type { RoutePacingAnalysis } from '../src/domain/types/pacing'
import type { RouteShapeContract } from '../src/domain/types/intent'

let fetchCallCount = 0
const originalFetch = globalThis.fetch
globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
  fetchCallCount += 1
  throw new Error(`Unexpected fetch in no-network Waypoint quality test: ${String(args[0])}`)
}) as typeof fetch

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

type InternalRole = 'warmup' | 'peak' | 'cooldown'

interface StopSpec {
  venueId: string
  baseVenueId?: string
  role: InternalRole
  lane: string
  cluster: string
  energy: number
  roleScore: number
  shapeScore: number
}

interface RouteSpec {
  id: string
  baseScore: number
  stops: [StopSpec, StopSpec, StopSpec]
  longTransitionCount?: number
  repeatedClusterEscapeCount?: number
  spatialPenalty?: number
  transitionMinutes?: number[]
}

const roleShapeKey = {
  warmup: 'start',
  peak: 'highlight',
  cooldown: 'windDown',
} as const

function scoredStop(spec: StopSpec): ArcStop {
  const roleScores = {
    warmup: spec.role === 'warmup' ? spec.roleScore : 0.58,
    peak: spec.role === 'peak' ? spec.roleScore : 0.58,
    wildcard: 0.58,
    cooldown: spec.role === 'cooldown' ? spec.roleScore : 0.58,
  }
  const stopShapeFit = {
    start: spec.role === 'warmup' ? spec.shapeScore : 0.58,
    highlight: spec.role === 'peak' ? spec.shapeScore : 0.58,
    surprise: 0.58,
    windDown: spec.role === 'cooldown' ? spec.shapeScore : 0.58,
  }
  stopShapeFit[roleShapeKey[spec.role]] = spec.shapeScore

  return {
    role: spec.role,
    scoredVenue: {
      venue: {
        id: spec.venueId,
        name: spec.venueId,
        city: 'San Jose',
        neighborhood: spec.cluster,
        driveMinutes: spec.cluster === 'cluster-a' ? 4 : spec.cluster === 'cluster-b' ? 8 : 14,
        category: 'event',
        subcategory: 'abstract',
        priceTier: '$$',
        tags: [],
        useCases: [],
        vibeTags: [],
        energyLevel: spec.energy,
        socialDensity: 0.5,
        uniquenessScore: 0.5,
        distinctivenessScore: 0.5,
        underexposureScore: 0.5,
        shareabilityScore: 0.5,
        isChain: false,
        localSignals: {
          localFavoriteScore: 0.5,
          neighborhoodPrideScore: 0.5,
          repeatVisitorScore: 0.5,
        },
        roleAffinity: roleScores,
        imageUrl: '',
        shortDescription: '',
        narrativeFlavor: '',
        isHiddenGem: false,
        isActive: true,
        highlightCapable: true,
        durationProfile: {} as never,
        settings: {} as never,
        signature: {} as never,
        source: {} as never,
      },
      candidateIdentity: {
        candidateId: spec.venueId,
        baseVenueId: spec.baseVenueId ?? spec.venueId,
        kind: 'base',
        traceLabel: spec.venueId,
      },
      momentIdentity: {
        type: spec.role === 'peak' ? 'anchor' : spec.role === 'warmup' ? 'arrival' : 'close',
        strength: spec.role === 'peak' ? 'strong' : 'medium',
      },
      fitBreakdown: {} as never,
      fitScore: 0.6,
      hiddenGemScore: 0.5,
      lensCompatibility: 0.6,
      contextSpecificity: {
        overall: 0.6,
        personaSignal: 0.6,
        vibeSignal: 0.6,
        lensSignal: 0.6,
        byRole: {
          warmup: 0.6,
          peak: 0.6,
          wildcard: 0.6,
          cooldown: 0.6,
        },
      },
      dominanceControl: {
        universalityScore: 0.2,
        flaggedUniversal: false,
        byRole: {
          warmup: 0.2,
          peak: 0.2,
          wildcard: 0.2,
          cooldown: 0.2,
        },
      },
      roleContract: {
        warmup: {} as never,
        peak: {} as never,
        wildcard: {} as never,
        cooldown: {} as never,
      },
      stopShapeFit,
      vibeAuthority: {} as never,
      highlightValidity: {} as never,
      roleScores,
      taste: {
        signals: {} as never,
        modeAlignment: {
          score: 0.72,
          penalty: 0,
          lane: spec.lane as never,
          tier: 'primary',
          supportiveTagScore: 0,
          lanePriorityScore: 0,
        },
        fallbackPenalty: {
          signalScore: 0,
          appliedPenalty: 0,
          applied: false,
          strongerAlternativePresent: false,
          reason: '',
        },
        rolePoolInfluence: {
          warmup: {} as never,
          peak: {} as never,
          wildcard: {} as never,
          cooldown: {} as never,
        },
      },
    },
  }
}

function buildSpatial(spec: RouteSpec): ArcCandidate['spatial'] {
  const clusters = spec.stops.map((stop) => stop.cluster)
  const transitions = [
    [spec.stops[0], spec.stops[1]],
    [spec.stops[1], spec.stops[2]],
  ].map(([from, to], index) => {
    const sameCluster = from.cluster === to.cluster
    const longTransition = index < (spec.longTransitionCount ?? 0)
    return {
      fromVenueId: from.venueId,
      toVenueId: to.venueId,
      fromClusterId: from.cluster,
      toClusterId: to.cluster,
      fromNeighborhood: from.cluster,
      toNeighborhood: to.cluster,
      driveGap: sameCluster ? 2 : longTransition ? 14 : 7,
      sameCluster,
      clusterEscape: !sameCluster,
      longTransition,
      jumpUsed: !sameCluster,
      scoreDelta: 0,
      notes: [],
    }
  })
  const clusterEscapeCount = transitions.filter((transition) => transition.clusterEscape).length
  const longTransitionCount = transitions.filter((transition) => transition.longTransition).length
  const sameClusterTransitionCount = transitions.filter((transition) => transition.sameCluster).length

  return {
    mode: 'flexible',
    homeClusterId: clusters[0],
    clustersVisited: [...new Set(clusters)],
    clusterAssignments: spec.stops.map((stop) => ({
      venueId: stop.venueId,
      venueName: stop.venueId,
      neighborhood: stop.cluster,
      clusterId: stop.cluster,
    })),
    transitions,
    sameClusterTransitionCount,
    clusterEscapeCount,
    repeatedClusterEscapeCount: spec.repeatedClusterEscapeCount ?? Math.max(0, clusterEscapeCount - 1),
    longTransitionCount,
    jumpUsed: clusterEscapeCount > 0,
    spatialBonus: sameClusterTransitionCount > 0 ? 0.05 : 0,
    spatialPenalty: spec.spatialPenalty ?? longTransitionCount * 0.18,
    score: 0.72 - longTransitionCount * 0.12 - Math.max(0, clusterEscapeCount - 1) * 0.08,
    notes: [],
  }
}

function buildPacing(spec: RouteSpec): RoutePacingAnalysis {
  const transitionMinutes =
    spec.transitionMinutes ??
    [spec.longTransitionCount && spec.longTransitionCount > 0 ? 16 : 8, 7]
  const transitions = transitionMinutes.map((minutes, index) => {
    const from = spec.stops[Math.min(index, spec.stops.length - 1)]!
    const to = spec.stops[Math.min(index + 1, spec.stops.length - 1)]!
    return {
      fromRoleKey: from.role,
      toRoleKey: to.role,
      fromVenueId: from.venueId,
      toVenueId: to.venueId,
      estimatedTravelMinutes: minutes,
      transitionBufferMinutes: 0,
      estimatedTransitionMinutes: minutes,
      frictionScore: minutes > 14 ? 4 : minutes > 10 ? 3 : 1,
      movementMode: minutes > 14 ? 'short-drive' : 'walkable',
      neighborhoodContinuity:
        from.cluster === to.cluster ? 'same-neighborhood' : 'spread',
      energyDelta: Math.abs(from.energy - to.energy),
      notes: [],
    }
  })
  const estimatedTransitionMinutes = transitions.reduce(
    (sum, transition) => sum + transition.estimatedTransitionMinutes,
    0,
  )
  const totalRouteFriction = transitions.reduce(
    (sum, transition) => sum + transition.frictionScore,
    0,
  )

  return {
    stops: spec.stops.map((stop) => ({
      roleKey: stop.role,
      venueId: stop.venueId,
      durationClass: 'M',
      estimatedDurationMinutes: 60,
    })),
    transitions,
    estimatedStopMinutes: 180,
    estimatedTransitionMinutes,
    estimatedTotalMinutes: 180 + estimatedTransitionMinutes,
    estimatedTotalLabel: `${180 + estimatedTransitionMinutes} min`,
    totalRouteFriction,
    averageTransitionFriction:
      transitions.length > 0 ? totalRouteFriction / transitions.length : 0,
    routeFeelLabel: 'test route',
    pacingScore: 0.7,
    transitionSmoothnessScore: 0.7,
    outingLengthScore: 0.7,
    awkwardPacingPenalty: 0,
    pacingPenaltyApplied: false,
    pacingPenaltyReasons: [],
    smoothProgressionRewardApplied: false,
    smoothProgressionRewardReasons: [],
  }
}

function candidate(spec: RouteSpec): ArcCandidate {
  return {
    id: spec.id,
    stops: spec.stops.map(scoredStop),
    totalScore: spec.baseScore,
    scoreBreakdown: {
      roleFlowScore: 0.7,
      diversityScore: 0.7,
      geographyScore: 0.7,
      hiddenGemLift: 0,
      windDownScore: 0.7,
    },
    pacing: buildPacing(spec),
    spatial: buildSpatial(spec),
    hasWildcard: false,
  }
}

const roleInvariant = {
  requiredTraits: [],
  preferredTraits: [],
  forbiddenTraits: [],
  allowSwapToWeaker: false,
  allowEscalation: false,
}

const tightStrictMovementRouteShapeContract: RouteShapeContract = {
  id: 'test-tight-strict-movement-contract',
  arcShape: 'fast_open_strong_center_clean_landing',
  roleProfile: {
    start: {
      intent: 'set-tone',
      energyLevel: 'low',
      pacing: 'quick',
      variability: 'fixed',
    },
    highlight: {
      intent: 'centerpiece',
      energyLevel: 'medium',
      pacing: 'linger',
      variability: 'fixed',
    },
    windDown: {
      intent: 'landing',
      energyLevel: 'low',
      pacing: 'quick',
      variability: 'fixed',
    },
  },
  roleInvariants: {
    start: roleInvariant,
    highlight: roleInvariant,
    windDown: roleInvariant,
  },
  movementProfile: {
    radius: 'tight',
    maxTransitionMinutes: 14,
    neighborhoodContinuity: 'strict',
  },
  mutationProfile: {
    swapFlexibility: 'low',
    allowedRoles: ['start', 'highlight', 'windDown'],
    preservePriority: ['role', 'movement', 'feasibility'],
  },
  expansionProfile: {
    supportsNearbyExtensions: false,
    preferredExpansionRole: 'windDown',
    lateNightTolerance: 'low',
  },
}

const balancedMovementRouteShapeContract: RouteShapeContract = {
  ...tightStrictMovementRouteShapeContract,
  id: 'test-balanced-movement-contract',
  movementProfile: {
    radius: 'balanced',
    maxTransitionMinutes: 24,
    neighborhoodContinuity: 'preferred',
  },
}

const nonMovementPreservingRouteShapeContract: RouteShapeContract = {
  ...tightStrictMovementRouteShapeContract,
  id: 'test-tight-strict-no-movement-preserve-contract',
  mutationProfile: {
    ...tightStrictMovementRouteShapeContract.mutationProfile,
    preservePriority: ['role', 'feasibility'],
  },
}

function buildContract(
  anchorVenueId: string,
  routeShapeContract?: RouteShapeContract,
): WaypointContractInput {
  return {
    strategyAdmissibleWorlds: [],
    requiredStopGuarantee: {
      required: true,
      role: 'highlight',
      venueId: anchorVenueId,
      source: 'test',
      reasonCodes: ['test_required_anchor'],
    },
    routeShapeContract,
    normalizedContext: {},
    compatibilityIntent: {
      mode: 'build',
      city: 'San Jose',
      persona: 'friends',
      distanceMode: 'nearby',
      planningMode: 'user-led',
      anchor: {
        venueId: anchorVenueId,
        role: 'highlight',
      },
      refinementModes: [],
    } as never,
    source: 'canonical_contract',
  }
}

function rankPair(
  anchorVenueId: string,
  routeSpecs: RouteSpec[],
  routeShapeContract?: RouteShapeContract,
) {
  const candidates = routeSpecs.map(candidate)
  const response = rankArcCandidatesFromContract(
    candidates,
    buildContract(anchorVenueId, routeShapeContract),
  )
  return {
    topId: response.ranked[0]?.candidate.id ?? null,
    ranked: response.ranked.map((entry) => ({
      id: entry.candidate.id,
      baseScore: entry.boundaryBaseScore,
      qualityAdjustment: entry.boundaryQualityAdjustment,
      qualitySignals: entry.boundaryQualitySignals,
      compactnessAdjustment: entry.routeShapeCompactnessAdjustment,
      compactnessSignals: entry.routeShapeCompactnessSignals,
      rankingScore: Number(entry.rankingScore.toFixed(4)),
      spatial: {
        clustersVisited: entry.candidate.spatial.clustersVisited,
        clusterEscapeCount: entry.candidate.spatial.clusterEscapeCount,
        repeatedClusterEscapeCount: entry.candidate.spatial.repeatedClusterEscapeCount,
      },
      movement: {
        total: entry.candidate.pacing.estimatedTransitionMinutes,
        maxTransition: Math.max(
          ...entry.candidate.pacing.transitions.map(
            (transition) => transition.estimatedTransitionMinutes,
          ),
        ),
      },
    })),
    contractTrace: response.contractTrace,
  }
}

function makeRoute(id: string, baseScore: number, anchorVenueId: string, lanes: [string, string, string], clusters: [string, string, string], options?: Partial<RouteSpec>): RouteSpec {
  return {
    id,
    baseScore,
    stops: [
      {
        venueId: `${id}-start`,
        role: 'warmup',
        lane: lanes[0],
        cluster: clusters[0],
        energy: options?.id === 'flat' ? 3 : 2,
        roleScore: 0.7,
        shapeScore: 0.74,
      },
      {
        venueId: anchorVenueId,
        role: 'peak',
        lane: lanes[1],
        cluster: clusters[1],
        energy: 4,
        roleScore: 0.86,
        shapeScore: 0.88,
      },
      {
        venueId: `${id}-end`,
        role: 'cooldown',
        lane: lanes[2],
        cluster: clusters[2],
        energy: options?.id === 'flat' ? 4 : 2,
        roleScore: 0.72,
        shapeScore: 0.76,
      },
    ],
    ...options,
  }
}

function topByBase(routeSpecs: RouteSpec[]): string {
  return [...routeSpecs].sort((left, right) => right.baseScore - left.baseScore)[0]!.id
}

function assertDomainGuardrail() {
  const source = readFileSync('src/integrations/waypoint/core.ts', 'utf8')
  const start = source.indexOf('export interface WaypointBoundaryQualitySignals')
  const end = source.indexOf('function refinementAdjustmentTrace')
  assert(start >= 0 && end > start, 'Could not isolate Waypoint boundary quality implementation.')
  const implementation = source.slice(start, end).toLowerCase()
  const banned = [
    'coffee',
    'cafe',
    'tea',
    'cocktail',
    'bar',
    'restaurant',
    'museum',
    'park',
    'nightlife',
    'family',
    'hospitality',
  ]
  const hits = banned.filter((token) => new RegExp(`\\b${token}\\b`, 'i').test(implementation))
  assert(hits.length === 0, `Waypoint boundary quality implementation contains domain tokens: ${hits.join(', ')}`)
}

const adegaSpecs = [
  makeRoute(
    'adega-before-thin',
    0.79,
    'sj-adega-wine-atelier',
    ['lane-soft', 'lane-peak', 'lane-soft'],
    ['cluster-a', 'cluster-b', 'cluster-c'],
    { longTransitionCount: 2, repeatedClusterEscapeCount: 1, spatialPenalty: 0.32 },
  ),
  makeRoute(
    'adega-domain-agnostic-alternative',
    0.775,
    'sj-adega-wine-atelier',
    ['lane-entry', 'lane-peak', 'lane-close'],
    ['cluster-a', 'cluster-a', 'cluster-b'],
    { longTransitionCount: 0, repeatedClusterEscapeCount: 0, spatialPenalty: 0.02 },
  ),
]
const minibossSpecs = [
  makeRoute(
    'miniboss-before-thin',
    0.785,
    'sj-miniboss',
    ['lane-soft', 'lane-peak', 'lane-soft'],
    ['cluster-a', 'cluster-b', 'cluster-c'],
    { longTransitionCount: 1, repeatedClusterEscapeCount: 1, spatialPenalty: 0.24 },
  ),
  makeRoute(
    'miniboss-domain-agnostic-alternative',
    0.772,
    'sj-miniboss',
    ['lane-entry', 'lane-peak', 'lane-close'],
    ['cluster-b', 'cluster-b', 'cluster-b'],
    { longTransitionCount: 0, repeatedClusterEscapeCount: 0, spatialPenalty: 0.01 },
  ),
]
const happyHollowSpecs = [
  makeRoute(
    'happy-hollow-before-thin',
    0.788,
    'sj-happy-hollow',
    ['lane-soft', 'lane-peak', 'lane-soft'],
    ['cluster-a', 'cluster-b', 'cluster-c'],
    { longTransitionCount: 1, repeatedClusterEscapeCount: 1, spatialPenalty: 0.22 },
  ),
  makeRoute(
    'happy-hollow-domain-agnostic-alternative',
    0.774,
    'sj-happy-hollow',
    ['lane-entry', 'lane-peak', 'lane-close'],
    ['cluster-b', 'cluster-b', 'cluster-c'],
    { longTransitionCount: 0, repeatedClusterEscapeCount: 0, spatialPenalty: 0.02 },
  ),
]
const evergreenSpecs = [
  makeRoute(
    'evergreen-current-pass',
    0.79,
    'sj-evergreen-coffee-company',
    ['lane-entry', 'lane-peak', 'lane-close'],
    ['cluster-a', 'cluster-a', 'cluster-b'],
    { longTransitionCount: 0, repeatedClusterEscapeCount: 0, spatialPenalty: 0.02 },
  ),
  makeRoute(
    'evergreen-regression-candidate',
    0.786,
    'sj-evergreen-coffee-company',
    ['lane-soft', 'lane-peak', 'lane-soft'],
    ['cluster-a', 'cluster-b', 'cluster-c'],
    { longTransitionCount: 1, repeatedClusterEscapeCount: 1, spatialPenalty: 0.24 },
  ),
]

const cases = [
  { cell: 'Adega', anchor: 'sj-adega-wine-atelier', specs: adegaSpecs, expectedTop: 'adega-domain-agnostic-alternative' },
  { cell: 'MINIBOSS', anchor: 'sj-miniboss', specs: minibossSpecs, expectedTop: 'miniboss-domain-agnostic-alternative' },
  { cell: 'Happy Hollow', anchor: 'sj-happy-hollow', specs: happyHollowSpecs, expectedTop: 'happy-hollow-domain-agnostic-alternative' },
  { cell: 'Evergreen no-regression', anchor: 'sj-evergreen-coffee-company', specs: evergreenSpecs, expectedTop: 'evergreen-current-pass' },
]

assertDomainGuardrail()

const impact = cases.map((entry) => {
  const ranked = rankPair(entry.anchor, entry.specs)
  assert(ranked.topId === entry.expectedTop, `${entry.cell} expected ${entry.expectedTop} to win, got ${ranked.topId}`)
  assert(ranked.contractTrace.topCandidatePreservesRequiredStop === true, `${entry.cell} top candidate must preserve required anchor.`)
  return {
    cell: entry.cell,
    oldTopByBaseScoreOnly: topByBase(entry.specs),
    newTopWithWaypointQuality: ranked.topId,
    topCandidatePreservesRequiredAnchor: ranked.contractTrace.topCandidatePreservesRequiredStop,
    ranked: ranked.ranked,
  }
})

const opaqueLaneA = rankPair('anchor-opaque', [
  makeRoute('opaque-varied-a', 0.75, 'anchor-opaque', ['opaque-a', 'opaque-b', 'opaque-c'], ['cluster-a', 'cluster-a', 'cluster-a']),
]).ranked[0]!.qualityAdjustment
const opaqueLaneB = rankPair('anchor-opaque', [
  makeRoute('opaque-varied-b', 0.75, 'anchor-opaque', ['opaque-x', 'opaque-y', 'opaque-z'], ['cluster-a', 'cluster-a', 'cluster-a']),
]).ranked[0]!.qualityAdjustment
assert(opaqueLaneA === opaqueLaneB, 'Lane scoring should depend on equality/difference pattern, not lane token meaning.')

const repeatedLane = rankPair('anchor-opaque', [
  makeRoute('opaque-repeated', 0.75, 'anchor-opaque', ['opaque-a', 'opaque-a', 'opaque-a'], ['cluster-a', 'cluster-a', 'cluster-a']),
]).ranked[0]!
const variedLane = rankPair('anchor-opaque', [
  makeRoute('opaque-varied', 0.75, 'anchor-opaque', ['opaque-a', 'opaque-b', 'opaque-c'], ['cluster-a', 'cluster-a', 'cluster-a']),
]).ranked[0]!
assert(
  variedLane.qualitySignals.supportLaneVarianceScore >
    repeatedLane.qualitySignals.supportLaneVarianceScore &&
    variedLane.qualitySignals.laneRepetitionPenalty <
      repeatedLane.qualitySignals.laneRepetitionPenalty,
  'Lane variance should improve lane signals over repeated opaque lane identity.',
)

const providerBackedRequiredStop = rankPair('sj-adega-wine-atelier', [
  {
    id: 'provider-backed-base-id-required-stop',
    baseScore: 0.75,
    stops: [
      {
        venueId: 'provider-start',
        role: 'warmup',
        lane: 'opaque-a',
        cluster: 'cluster-a',
        energy: 2,
        roleScore: 0.72,
        shapeScore: 0.74,
      },
      {
        venueId: 'live_google_adega-provider-record',
        baseVenueId: 'sj-adega-wine-atelier',
        role: 'peak',
        lane: 'opaque-b',
        cluster: 'cluster-a',
        energy: 4,
        roleScore: 0.88,
        shapeScore: 0.9,
      },
      {
        venueId: 'provider-close',
        role: 'cooldown',
        lane: 'opaque-c',
        cluster: 'cluster-a',
        energy: 2,
        roleScore: 0.73,
        shapeScore: 0.76,
      },
    ],
  },
])
assert(
  providerBackedRequiredStop.contractTrace.requiredStopSurvivingCandidateCount === 1,
  'Waypoint required-stop guarantee must count provider-backed candidates by candidateIdentity.baseVenueId.',
)
assert(
  providerBackedRequiredStop.contractTrace.topCandidatePreservesRequiredStop === true,
  'Waypoint required-stop guarantee must recognize canonical base identity, not only raw venue.id.',
)

const tightL2CompactnessRanking = rankPair(
  'sj-adega-wine-atelier',
  [
    makeRoute(
      'tight-l2-cross-cluster-backtracking-45-24',
      0.86,
      'sj-adega-wine-atelier',
      ['opaque-a', 'opaque-b', 'opaque-c'],
      ['cluster-a', 'cluster-b', 'cluster-a'],
      {
        longTransitionCount: 2,
        repeatedClusterEscapeCount: 1,
        spatialPenalty: 0.36,
        transitionMinutes: [18, 14, 13],
      },
    ),
    makeRoute(
      'tight-l2-compact-anchor-near',
      0.77,
      'sj-adega-wine-atelier',
      ['opaque-a', 'opaque-b', 'opaque-c'],
      ['cluster-a', 'cluster-a', 'cluster-a'],
      {
        longTransitionCount: 0,
        repeatedClusterEscapeCount: 0,
        spatialPenalty: 0.01,
        transitionMinutes: [8, 7, 6],
      },
    ),
  ],
  tightStrictMovementRouteShapeContract,
)
assert(
  tightL2CompactnessRanking.topId === 'tight-l2-compact-anchor-near',
  'Tight/strict L2 movement contract must rank compact anchor-preserving candidates ahead of cross-cluster backtracking candidates.',
)
const tightL2BacktrackingCandidate = tightL2CompactnessRanking.ranked.find(
  (entry) => entry.id === 'tight-l2-cross-cluster-backtracking-45-24',
)
const tightL2CompactCandidate = tightL2CompactnessRanking.ranked.find(
  (entry) => entry.id === 'tight-l2-compact-anchor-near',
)
assert(
  tightL2BacktrackingCandidate?.movement.total === 45 &&
    tightL2BacktrackingCandidate.movement.maxTransition === 18,
  'The modeled over-budget candidate must represent the hosted 45/24 and 18/14 movement failure shape.',
)
assert(
  tightL2CompactCandidate?.compactnessSignals.active === true &&
    tightL2CompactCandidate.compactnessSignals.activationReason ===
      'tight_strict_movement_preserved',
  'Compactness diagnostics must expose activation for tight/strict movement-preserving route shape.',
)
assert(
  tightL2CompactCandidate.compactnessAdjustment > 0,
  'Compact candidate must expose a positive compactness adjustment.',
)
assert(
  tightL2BacktrackingCandidate.compactnessAdjustment < 0 &&
    tightL2BacktrackingCandidate.compactnessSignals.reasonSummary.includes(
      'total_movement_over_tight_limit',
    ) &&
    tightL2BacktrackingCandidate.compactnessSignals.reasonSummary.includes(
      'backtrack_detected',
    ),
  'Over-budget backtracking candidate must expose compactness penalty reasons.',
)
assert(
  tightL2BacktrackingCandidate.spatial.repeatedClusterEscapeCount > 0,
  'The modeled over-budget candidate must carry a backtracking/repeated-cluster pattern.',
)
assert(
  tightL2CompactCandidate &&
    tightL2BacktrackingCandidate.rankingScore < tightL2CompactCandidate.rankingScore,
  'Over-budget backtracking candidate must be deprioritized behind compact same/near-cluster support.',
)
const balancedContractRanking = rankPair(
  'sj-adega-wine-atelier',
  [
    makeRoute(
      'balanced-contract-candidate',
      0.77,
      'sj-adega-wine-atelier',
      ['opaque-a', 'opaque-b', 'opaque-c'],
      ['cluster-a', 'cluster-a', 'cluster-a'],
    ),
  ],
  balancedMovementRouteShapeContract,
)
assert(
  balancedContractRanking.ranked[0]?.compactnessSignals.active === false &&
    balancedContractRanking.ranked[0].compactnessAdjustment === 0,
  'Compactness adjustment must not activate for non-tight route shapes.',
)
const noMovementPreserveRanking = rankPair(
  'sj-adega-wine-atelier',
  [
    makeRoute(
      'no-movement-preserve-candidate',
      0.77,
      'sj-adega-wine-atelier',
      ['opaque-a', 'opaque-b', 'opaque-c'],
      ['cluster-a', 'cluster-a', 'cluster-a'],
    ),
  ],
  nonMovementPreservingRouteShapeContract,
)
assert(
  noMovementPreserveRanking.ranked[0]?.compactnessSignals.active === false &&
    noMovementPreserveRanking.ranked[0].compactnessSignals.activationReason ===
      'movement_not_preserved',
  'Compactness adjustment must not activate without movement preserve priority.',
)

const source = readFileSync('src/integrations/waypoint/core.ts', 'utf8')
const routeAuthoritySource = readFileSync(
  'src/app/services/routeAuthority/routeAuthorityService.ts',
  'utf8',
)
const runtimeRouteArtifactSource = readFileSync(
  'src/domain/artifacts/runtimeRouteArtifact.ts',
  'utf8',
)
const greatStopSource = readFileSync('src/domain/greatStop/buildGreatStopGateResult.ts', 'utf8')
assert(
  source.includes('evaluateRouteShapeCompactness') &&
    source.includes("movementProfile.radius === 'tight'") &&
    source.includes("movementProfile.neighborhoodContinuity === 'strict'") &&
    source.includes("preservePriority.includes('movement')"),
  'Waypoint compactness ranking must be driven by route-shape movement contract fields.',
)
assert(
  source.includes('requiredStopRankingAdjustment(candidate, request.contract) +') &&
    source.includes('routeShapeCompactnessSignals.adjustment'),
  'Compactness must adjust deterministic ranking before Great Stop selection.',
)
assert(
  greatStopSource.includes('maxComfortableTotalMovementMinutes: 24') &&
    greatStopSource.includes('maxSingleTransitionMinutes: 14'),
  'Great Stop thresholds must remain unchanged.',
)
assert(
  routeAuthoritySource.includes("reasons.push('provider_shadow_not_authority')"),
  'routeAuthority must still reject provider_shadow as non-authority.',
)
assert(
  runtimeRouteArtifactSource.includes('export interface RuntimeRouteArtifact') &&
    !runtimeRouteArtifactSource.includes('routeShapeCompactnessAdjustment'),
  'RuntimeRouteArtifact shape must remain unchanged.',
)

const output = {
  waypointQualityAdjustmentImplemented: true,
  routeShapeCompactnessAdjustmentImplemented: true,
  domainGuardrailPassed: true,
  opaqueLaneEqualityOnly: true,
  requiredAnchorPreservationProtected: true,
  providerBackedRequiredStopRecognizedByBaseVenueId: true,
  tightL2CompactnessRanking,
  compactCandidateOutranksCrossClusterBacktrackingCandidate:
    tightL2CompactnessRanking.topId === 'tight-l2-compact-anchor-near',
  movement45Over24CandidateDeprioritized:
    tightL2BacktrackingCandidate?.movement.total === 45 &&
    tightL2BacktrackingCandidate.movement.maxTransition === 18 &&
    tightL2CompactCandidate !== undefined &&
    tightL2BacktrackingCandidate.rankingScore < tightL2CompactCandidate.rankingScore,
  compactnessActivationVisible:
    tightL2CompactCandidate?.compactnessSignals.active === true,
  compactnessScoreVisible:
    typeof tightL2CompactCandidate?.compactnessAdjustment === 'number' &&
    typeof tightL2BacktrackingCandidate?.compactnessAdjustment === 'number',
  compactnessPenaltyReasonVisible:
    tightL2BacktrackingCandidate?.compactnessSignals.reasonSummary.includes(
      'total_movement_over_tight_limit',
    ) === true,
  compactnessInactiveForNonTight:
    balancedContractRanking.ranked[0]?.compactnessSignals.active === false,
  compactnessInactiveWithoutMovementPreserve:
    noMovementPreserveRanking.ranked[0]?.compactnessSignals.active === false,
  routeAuthorityChanged: !routeAuthoritySource.includes(
    "reasons.push('provider_shadow_not_authority')",
  ),
  runtimeRouteArtifactShapeChanged: runtimeRouteArtifactSource.includes(
    'routeShapeCompactnessAdjustment',
  ),
  providerShadowAuthorityChanged: !routeAuthoritySource.includes(
    'provider_shadow_not_authority',
  ),
  greatStopThresholdsUnchanged:
    greatStopSource.includes('maxComfortableTotalMovementMinutes: 24') &&
    greatStopSource.includes('maxSingleTransitionMinutes: 14'),
  fetchCallCount,
  clampBounds: [-0.08, 0.08],
  localRankingImpact: impact,
}

console.log(JSON.stringify(output, null, 2))

assert(fetchCallCount === 0, `Expected fetchCallCount 0, got ${fetchCallCount}`)
globalThis.fetch = originalFetch
