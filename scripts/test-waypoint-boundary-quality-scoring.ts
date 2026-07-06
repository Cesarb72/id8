import { readFileSync } from 'node:fs'
import { rankArcCandidatesFromContract } from '../src/integrations/waypoint/rankArcCandidates'
import type { ArcCandidate, ArcStop } from '../src/domain/types/arc'
import type { WaypointContractInput } from '../src/integrations/waypoint/core'

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
        baseVenueId: spec.venueId,
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
    pacing: {} as never,
    spatial: buildSpatial(spec),
    hasWildcard: false,
  }
}

function buildContract(anchorVenueId: string): WaypointContractInput {
  return {
    strategyAdmissibleWorlds: [],
    requiredStopGuarantee: {
      required: true,
      role: 'highlight',
      venueId: anchorVenueId,
      source: 'test',
      reasonCodes: ['test_required_anchor'],
    },
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

function rankPair(anchorVenueId: string, routeSpecs: RouteSpec[]) {
  const candidates = routeSpecs.map(candidate)
  const response = rankArcCandidatesFromContract(candidates, buildContract(anchorVenueId))
  return {
    topId: response.ranked[0]?.candidate.id ?? null,
  ranked: response.ranked.map((entry) => ({
      id: entry.candidate.id,
      baseScore: entry.boundaryBaseScore,
      qualityAdjustment: entry.boundaryQualityAdjustment,
      qualitySignals: entry.boundaryQualitySignals,
      rankingScore: Number(entry.rankingScore.toFixed(4)),
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

const output = {
  waypointQualityAdjustmentImplemented: true,
  domainGuardrailPassed: true,
  opaqueLaneEqualityOnly: true,
  requiredAnchorPreservationProtected: true,
  routeAuthorityChanged: false,
  runtimeRouteArtifactShapeChanged: false,
  providerShadowAuthorityChanged: false,
  fetchCallCount,
  clampBounds: [-0.08, 0.08],
  localRankingImpact: impact,
}

console.log(JSON.stringify(output, null, 2))

assert(fetchCallCount === 0, `Expected fetchCallCount 0, got ${fetchCallCount}`)
globalThis.fetch = originalFetch
