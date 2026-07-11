import { readFileSync } from 'node:fs'
import { buildRoutePlaceRightVerdictForArcCandidate } from '../src/domain/bearings/buildRoutePlaceRightVerdictForArcCandidate'
import { buildGreatStopGateResult } from '../src/domain/greatStop/buildGreatStopGateResult'
import { computeRouteMeaningVerdict } from '../src/domain/interpretation/taste/computeRouteMeaningVerdict'
import type { ArcCandidate, ArcStop } from '../src/domain/types/arc'
import type { RoutePacingDiagnostics } from '../src/domain/types/diagnostics'
import type {
  BuildLocationClass,
  GreatStopGateCriterion,
  GreatStopGateResult,
} from '../src/domain/types/greatStopGate'
import type { IntentProfile, PersonaMode } from '../src/domain/types/intent'
import type { UserStopRole } from '../src/domain/types/itinerary'
import type { RouteMovementMode } from '../src/domain/types/pacing'

let fetchCallCount = 0
globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
  fetchCallCount += 1
  throw new Error(`Unexpected fetch in no-network Great Stop Gate test: ${String(args[0])}`)
}) as typeof fetch

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

type InternalRole = 'warmup' | 'peak' | 'cooldown'

interface StopSpec {
  venueId: string
  name?: string
  role: InternalRole
  lane: string
  cluster: string
  energy: number
  roleScore?: number
  shapeScore?: number
  fitScore?: number
  lensCompatibility?: number
  contextSpecificity?: number
}

interface GateCase {
  cell: string
  persona: PersonaMode
  locationClass: BuildLocationClass
  anchor: {
    venueId: string
    role: UserStopRole
  }
  stops: [StopSpec, StopSpec, StopSpec]
  transitions: [number, number]
  movementModes?: [RouteMovementMode, RouteMovementMode]
  repeatedClusterEscapeCount?: number
  longTransitionCount?: number
  strongMomentPresent?: boolean
  momentFlatPenalty?: number
  roleEnergyNote?: string
}

const roleShapeKey = {
  warmup: 'start',
  peak: 'highlight',
  cooldown: 'windDown',
} as const

const tasteRoleKey = {
  warmup: 'start',
  peak: 'highlight',
  cooldown: 'windDown',
} as const

function scoredStop(spec: StopSpec): ArcStop {
  const roleScore = spec.roleScore ?? 0.74
  const shapeScore = spec.shapeScore ?? 0.74
  const roleScores = {
    warmup: spec.role === 'warmup' ? roleScore : 0.62,
    peak: spec.role === 'peak' ? roleScore : 0.62,
    wildcard: 0.62,
    cooldown: spec.role === 'cooldown' ? roleScore : 0.62,
  }
  const stopShapeFit = {
    start: 0.62,
    highlight: 0.62,
    surprise: 0.62,
    windDown: 0.62,
  }
  stopShapeFit[roleShapeKey[spec.role]] = shapeScore

  return {
    role: spec.role,
    scoredVenue: {
      venue: {
        id: spec.venueId,
        name: spec.name ?? spec.venueId,
        city: 'San Jose',
        neighborhood: spec.cluster,
        driveMinutes: 8,
        category: 'abstract',
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
      fitScore: spec.fitScore ?? 0.66,
      hiddenGemScore: 0.5,
      lensCompatibility: spec.lensCompatibility ?? 0.66,
      contextSpecificity: {
        overall: spec.contextSpecificity ?? 0.66,
        personaSignal: 0.66,
        vibeSignal: 0.66,
        lensSignal: 0.66,
        byRole: {
          warmup: 0.66,
          peak: 0.66,
          wildcard: 0.66,
          cooldown: 0.66,
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

function buildSpatial(spec: GateCase): ArcCandidate['spatial'] {
  const clusters = spec.stops.map((stop) => stop.cluster)
  const transitions = [
    [spec.stops[0], spec.stops[1]],
    [spec.stops[1], spec.stops[2]],
  ].map(([from, to], index) => {
    const sameCluster = from.cluster === to.cluster
    const longTransition =
      index < (spec.longTransitionCount ?? spec.transitions.filter((minutes) => minutes > 12).length)
    return {
      fromVenueId: from.venueId,
      toVenueId: to.venueId,
      fromClusterId: from.cluster,
      toClusterId: to.cluster,
      fromNeighborhood: from.cluster,
      toNeighborhood: to.cluster,
      driveGap: spec.transitions[index],
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
  return {
    mode: 'flexible',
    homeClusterId: clusters[0],
    clustersVisited: [...new Set(clusters)],
    clusterAssignments: spec.stops.map((stop) => ({
      venueId: stop.venueId,
      venueName: stop.name ?? stop.venueId,
      neighborhood: stop.cluster,
      clusterId: stop.cluster,
    })),
    transitions,
    sameClusterTransitionCount: transitions.filter((transition) => transition.sameCluster).length,
    clusterEscapeCount,
    repeatedClusterEscapeCount: spec.repeatedClusterEscapeCount ?? Math.max(0, clusterEscapeCount - 1),
    longTransitionCount,
    jumpUsed: clusterEscapeCount > 0,
    spatialBonus: 0,
    spatialPenalty: longTransitionCount * 0.1,
    score: 0.82 - longTransitionCount * 0.1,
    notes: [],
  }
}

function buildPacing(spec: GateCase): RoutePacingDiagnostics {
  return {
    transitions: [
      [spec.stops[0], spec.stops[1], 0],
      [spec.stops[1], spec.stops[2], 1],
    ].map(([from, to, index]) => ({
      fromRole: from.role === 'warmup' ? 'start' : from.role === 'peak' ? 'highlight' : 'windDown',
      toRole: to.role === 'warmup' ? 'start' : to.role === 'peak' ? 'highlight' : 'windDown',
      fromVenueId: from.venueId,
      toVenueId: to.venueId,
      estimatedTravelMinutes: spec.transitions[index],
      transitionBufferMinutes: 0,
      estimatedTransitionMinutes: spec.transitions[index],
      frictionScore: spec.transitions[index] / 20,
      movementMode: spec.movementModes?.[index] ?? 'walkable',
      neighborhoodContinuity: from.cluster === to.cluster ? 'same-neighborhood' : 'adjacent-neighborhoods',
      notes: [],
    })),
    totalRouteFriction: 0.2,
    estimatedStopMinutes: 120,
    estimatedTransitionMinutes: spec.transitions[0] + spec.transitions[1],
    estimatedTotalMinutes: 120 + spec.transitions[0] + spec.transitions[1],
    estimatedTotalLabel: '2h',
    routeFeelLabel: 'balanced',
    pacingPenaltyApplied: false,
    pacingPenaltyReasons: [],
    smoothProgressionRewardApplied: true,
    smoothProgressionRewardReasons: [],
  }
}

function buildCandidate(spec: GateCase): ArcCandidate {
  return {
    id: `${spec.cell.toLowerCase().replace(/\s+/g, '-')}-generated-final`,
    stops: spec.stops.map(scoredStop),
    totalScore: 0.78,
    scoreBreakdown: {
      roleFlowScore: 0.72,
      diversityScore: 0.72,
      geographyScore: 0.72,
      hiddenGemLift: 0,
      windDownScore: 0.72,
      highlightMomentScore: spec.strongMomentPresent === false ? 0.28 : 0.76,
      momentStrengthScore: spec.strongMomentPresent === false ? 0.28 : 0.76,
      momentFlatPenalty: spec.momentFlatPenalty ?? 0,
      roleEnergyNote: spec.roleEnergyNote,
      strongMomentPresent: spec.strongMomentPresent ?? true,
      momentQualityNote: spec.strongMomentPresent === false ? 'No strong main moment' : 'Strong center',
    },
    pacing: {} as never,
    spatial: buildSpatial(spec),
    hasWildcard: false,
  }
}

function buildIntent(spec: GateCase): IntentProfile {
  return {
    mode: 'build',
    city: 'San Jose',
    persona: spec.persona,
    distanceMode: spec.locationClass === 'L1 Dense' ? 'nearby' : 'short-drive',
    planningMode: 'user-led',
    anchor: spec.anchor,
    refinementModes: [],
  } as IntentProfile
}

function runGate(spec: GateCase): GreatStopGateResult {
  const selectedArc = buildCandidate(spec)
  const intent = buildIntent(spec)
  const routePacing = buildPacing(spec)
  return buildGreatStopGateResult({
    selectedArc,
    intent,
    routePacing,
    placeRightVerdict: buildRoutePlaceRightVerdictForArcCandidate({
      candidate: selectedArc,
      intent,
      routePacing,
      locationClass: spec.locationClass,
    }),
    locationClass: spec.locationClass,
  })
}

function buildTasteRouteMeaningVerdict(spec: GateCase) {
  return computeRouteMeaningVerdict({
    requestedPersona: spec.persona,
    stops: spec.stops.map((stop) => ({
      role: tasteRoleKey[stop.role],
      candidateVenueId: stop.venueId,
      routeFitScore: stop.fitScore ?? 0.66,
      lensCompatibilityScore: stop.lensCompatibility ?? 0.66,
      roleFitScore: stop.roleScore ?? 0.74,
      stopShapeFitScore: stop.shapeScore ?? 0.74,
      contextSpecificityScore: stop.contextSpecificity ?? 0.66,
      vibeFitScore: 0.72,
    })),
    compatibility: {
      vibeCoherenceScore: 0.72,
      highlightVibeScore: 0.72,
      supportStopVibeScore: 0.72,
      categoryDiversityScore: 0.72,
      categoryDiversityBonus: 0,
      categoryDiversityPenalty: 0,
      repeatedCategoryCount: 0,
      categoryDiversityNotes: [],
      roleAwareCategoryLift: 0,
      familyAlignmentBoost: 0,
      familyMismatchPenalty: 0,
      romanticContractScore: 0.72,
      romanticContractPenalty: 0,
      romanticContractSatisfied: true,
      romanticContractFeasible: true,
      romanticHighlightCandidatesFeasible: 1,
      romanticHighlightArbitrationResult: 'test',
      familyCompetitionScore: 0.72,
      familyCompetitionPenalty: 0,
      familyCompetitionActive: false,
      familyCompetitionEligibleFamilies: [],
      familyCompetitionTopSpread: 0,
      familyCompetitionThreshold: 0,
      familyCompetitionWinnerMode: 'test',
      expressionWidth: 'moderate',
      expressionWidthReason: 'test',
      expressionWidthFamilyCount: 1,
      expressionWidthCompetitiveFamilyCount: 1,
      expressionWidthIntensitySpread: 0,
      expressionWidthPeakPoolSize: 1,
      expressionWidthFallbackReliance: false,
      expressionReleaseScore: 0.72,
      expressionReleasePenalty: 0,
      expressionReleaseEligible: true,
      expressionReleaseReason: 'test',
      expressionReleaseEliteFamilies: [],
      activationMomentElevationScore: 0.72,
      activationMomentElevationPenalty: 0,
      activationMomentElevationEligible: true,
      activationMomentElevationApplied: false,
      activationMomentElevationReason: 'test',
      activationMomentElevationCandidateFamilies: [],
    },
  }).verdict
}

function baselineGateSpec(
  persona: PersonaMode,
  locationClass: BuildLocationClass,
): GateCase {
  return {
    cell: `${persona}_${locationClass}`,
    persona,
    locationClass,
    anchor: { venueId: `${persona}-${locationClass}-anchor`, role: 'highlight' },
    stops: [
      {
        venueId: `${persona}-${locationClass}-start`,
        role: 'warmup',
        lane: 'arrival',
        cluster: 'a',
        energy: 2,
      },
      {
        venueId: `${persona}-${locationClass}-anchor`,
        role: 'peak',
        lane: 'center',
        cluster: locationClass === 'L1 Dense' ? 'a' : 'b',
        energy: 4,
      },
      {
        venueId: `${persona}-${locationClass}-end`,
        role: 'cooldown',
        lane: 'landing',
        cluster: locationClass === 'L3 Sparse' ? 'c' : 'b',
        energy: 2,
      },
    ],
    transitions:
      locationClass === 'L1 Dense'
        ? [7, 7]
        : locationClass === 'L2 Mid'
          ? [11, 11]
          : [16, 16],
    movementModes:
      locationClass === 'L1 Dense'
        ? ['walkable', 'walkable']
        : locationClass === 'L2 Mid'
          ? ['short-drive', 'walkable']
          : ['short-drive', 'short-drive'],
    repeatedClusterEscapeCount: 0,
    longTransitionCount: locationClass === 'L3 Sparse' ? 1 : 0,
  }
}

function includesCriteria(result: GreatStopGateResult, criteria: GreatStopGateCriterion[]): boolean {
  return criteria.every((criterionName) => result.failedCriteria.includes(criterionName))
}

const presetMatrix = (['romantic', 'friends', 'family'] as const).flatMap((matrixPersona) =>
  (['L1 Dense', 'L2 Mid', 'L3 Sparse'] as const).map((locationClass) => {
    const result = runGate(baselineGateSpec(matrixPersona, locationClass))
    assert(
      result.preset.persona === matrixPersona,
      `${matrixPersona} ${locationClass} should use matching persona preset.`,
    )
    assert(
      result.preset.locationClass === locationClass,
      `${matrixPersona} ${locationClass} should use explicit location class preset.`,
    )
    assert(
      result.preset.source === 'explicit',
      `${matrixPersona} ${locationClass} should mark preset source explicit.`,
    )
    return {
      persona: matrixPersona,
      locationClass,
      preset: result.preset,
    }
  }),
)

const evergreen = runGate({
  cell: 'Evergreen',
  persona: 'romantic',
  locationClass: 'L3 Sparse',
  anchor: { venueId: 'sj-evergreen-coffee-company', role: 'highlight' },
  stops: [
    { venueId: 'evergreen-start', role: 'warmup', lane: 'arrival', cluster: 'a', energy: 2 },
    { venueId: 'sj-evergreen-coffee-company', role: 'peak', lane: 'center', cluster: 'a', energy: 4 },
    { venueId: 'evergreen-end', role: 'cooldown', lane: 'landing', cluster: 'b', energy: 2 },
  ],
  transitions: [8, 10],
  movementModes: ['walkable', 'short-drive'],
})

const adegaOld = runGate({
  cell: 'Adega old thin',
  persona: 'romantic',
  locationClass: 'L2 Mid',
  anchor: { venueId: 'sj-adega-wine-atelier', role: 'highlight' },
  stops: [
    { venueId: 'adega-start', role: 'warmup', lane: 'soft', cluster: 'a', energy: 3 },
    { venueId: 'sj-adega-wine-atelier', role: 'peak', lane: 'peak', cluster: 'b', energy: 3 },
    { venueId: 'adega-end', role: 'cooldown', lane: 'soft', cluster: 'c', energy: 4 },
  ],
  transitions: [15, 15],
  movementModes: ['short-drive', 'short-drive'],
  repeatedClusterEscapeCount: 1,
  longTransitionCount: 2,
  strongMomentPresent: false,
  momentFlatPenalty: 0.08,
  roleEnergyNote: 'flat route energy',
})

const minibossOld = runGate({
  cell: 'MINIBOSS old thin',
  persona: 'friends',
  locationClass: 'L2 Mid',
  anchor: { venueId: 'sj-miniboss', role: 'highlight' },
  stops: [
    { venueId: 'miniboss-start', role: 'warmup', lane: 'same', cluster: 'a', energy: 2 },
    { venueId: 'sj-miniboss', role: 'peak', lane: 'same', cluster: 'b', energy: 3 },
    { venueId: 'miniboss-end', role: 'cooldown', lane: 'same', cluster: 'c', energy: 3 },
  ],
  transitions: [7, 7],
  movementModes: ['walkable', 'walkable'],
  repeatedClusterEscapeCount: 0,
  strongMomentPresent: false,
  momentFlatPenalty: 0.08,
  roleEnergyNote: 'flat route energy',
})

const happyHollowOld = runGate({
  cell: 'Happy Hollow old thin',
  persona: 'family',
  locationClass: 'L2 Mid',
  anchor: { venueId: 'sj-happy-hollow', role: 'highlight' },
  stops: [
    { venueId: 'happy-start', role: 'warmup', lane: 'arrival', cluster: 'a', energy: 2 },
    { venueId: 'sj-happy-hollow', role: 'peak', lane: 'center', cluster: 'b', energy: 4 },
    { venueId: 'happy-end', role: 'cooldown', lane: 'landing', cluster: 'c', energy: 2 },
  ],
  transitions: [16, 16],
  movementModes: ['short-drive', 'short-drive'],
  repeatedClusterEscapeCount: 1,
  longTransitionCount: 2,
})

const l1FamilyPlace = runGate({
  cell: 'Family L1 place preset',
  persona: 'family',
  locationClass: 'L1 Dense',
  anchor: { venueId: 'family-anchor', role: 'highlight' },
  stops: [
    { venueId: 'family-start', role: 'warmup', lane: 'arrival', cluster: 'a', energy: 2 },
    { venueId: 'family-anchor', role: 'peak', lane: 'center', cluster: 'b', energy: 4 },
    { venueId: 'family-end', role: 'cooldown', lane: 'landing', cluster: 'b', energy: 2 },
  ],
  transitions: [11, 4],
  movementModes: ['short-drive', 'walkable'],
  longTransitionCount: 1,
})

const roleRightGoodSpec = baselineGateSpec('friends', 'L1 Dense')
const roleRightBadBase = baselineGateSpec('friends', 'L1 Dense')
const roleRightBadSpec: GateCase = {
  ...roleRightBadBase,
  cell: 'Role-Right bad role evidence',
  stops: [
    {
      ...roleRightBadBase.stops[0],
      roleScore: 0.42,
    },
    {
      ...roleRightBadBase.stops[1],
      shapeScore: 0.24,
    },
    roleRightBadBase.stops[2],
  ],
}
const tasteRoleRightGood = buildTasteRouteMeaningVerdict(roleRightGoodSpec)
const tasteRoleRightBad = buildTasteRouteMeaningVerdict(roleRightBadSpec)
const greatStopRoleRightGood = runGate(roleRightGoodSpec)
const greatStopRoleRightBad = runGate(roleRightBadSpec)
const roleRightGeneralizedBadBase = baselineGateSpec('romantic', 'L2 Mid')
const roleRightGeneralizedBadSpec: GateCase = {
  ...roleRightGeneralizedBadBase,
  cell: 'Role-Right generalized bad role evidence',
  stops: [
    roleRightGeneralizedBadBase.stops[0],
    {
      ...roleRightGeneralizedBadBase.stops[1],
      roleScore: 0.31,
    },
    {
      ...roleRightGeneralizedBadBase.stops[2],
      shapeScore: 0.2,
    },
  ],
}
const tasteRoleRightGeneralizedBad = buildTasteRouteMeaningVerdict(
  roleRightGeneralizedBadSpec,
)
const greatStopRoleRightGeneralizedBad = runGate(roleRightGeneralizedBadSpec)
const intentRightGoodSpec = baselineGateSpec('friends', 'L1 Dense')
const intentRightBadBase = baselineGateSpec('friends', 'L1 Dense')
const intentRightBadSpec: GateCase = {
  ...intentRightBadBase,
  cell: 'Intent-Right bad evidence',
  stops: [
    {
      ...intentRightBadBase.stops[0],
      fitScore: 0.31,
    },
    {
      ...intentRightBadBase.stops[1],
      lensCompatibility: 0.27,
    },
    {
      ...intentRightBadBase.stops[2],
      contextSpecificity: 0.22,
    },
  ],
}
const tasteIntentRightGood = buildTasteRouteMeaningVerdict(intentRightGoodSpec)
const tasteIntentRightBad = buildTasteRouteMeaningVerdict(intentRightBadSpec)
const greatStopIntentRightGood = runGate(intentRightGoodSpec)
const greatStopIntentRightBad = runGate(intentRightBadSpec)
const intentRightGeneralizedBadBase = baselineGateSpec('romantic', 'L2 Mid')
const intentRightGeneralizedBadSpec: GateCase = {
  ...intentRightGeneralizedBadBase,
  cell: 'Intent-Right generalized bad evidence',
  stops: [
    {
      ...intentRightGeneralizedBadBase.stops[0],
      contextSpecificity: 0.18,
    },
    {
      ...intentRightGeneralizedBadBase.stops[1],
      fitScore: 0.2,
    },
    {
      ...intentRightGeneralizedBadBase.stops[2],
      lensCompatibility: 0.19,
    },
  ],
}
const tasteIntentRightGeneralizedBad = buildTasteRouteMeaningVerdict(
  intentRightGeneralizedBadSpec,
)
const greatStopIntentRightGeneralizedBad = runGate(intentRightGeneralizedBadSpec)

assert(evergreen.status === 'PASS', `Evergreen-like route should pass, got ${evergreen.status}`)
assert(evergreen.preset.source === 'explicit', 'Evergreen-like L3 route should use explicit L3 Sparse.')
assert(evergreen.requiredAnchor?.survived === true, 'Required anchor should survive in PASS route.')
assert(evergreen.requiredAnchor?.creditedRole === 'highlight', 'Required anchor should be credited as highlight.')
assert(includesCriteria(adegaOld, ['place_right', 'moment_right']), 'Adega-like old route should fail place and moment.')
assert(adegaOld.preset.locationClass === 'L2 Mid', 'Adega-like route should use explicit L2 Mid.')
assert(adegaOld.preset.source === 'explicit', 'Adega-like route should not rely on distanceMode inference.')
assert(includesCriteria(minibossOld, ['moment_right']), 'MINIBOSS-like old route should fail moment.')
assert(happyHollowOld.status === 'FAIL', 'Happy Hollow-like old route should be a named FAIL, not THIN.')
assert(!JSON.stringify(happyHollowOld).includes('THIN_STRICT'), 'Great Stop Gate artifact must not emit THIN_STRICT.')
assert(l1FamilyPlace.status === 'FAIL', 'Family L1 preset should enforce tighter place constraints.')
assert(
  l1FamilyPlace.reasons.includes('place_right:scattered_neighborhoods') ||
    l1FamilyPlace.reasons.includes('place_right:poor_support_proximity'),
  'Family L1 Place-Right should fail from Bearings-authored structural place evidence.',
)
assert(
  tasteRoleRightGood.roleVerdict.roleRightReady === true,
  'Taste Role-Right evidence should be ready for a fully scored route.',
)
assert(
  tasteRoleRightGood.roleVerdict.roleRightVerdict?.status === 'pass',
  'Taste Role-Right evidence should pass for a good-role route.',
)
assert(
  tasteRoleRightGood.roleVerdict.roleRightVerdict.lowRoleEvidence.length === 0 &&
    tasteRoleRightGood.roleVerdict.roleRightVerdict.lowShapeEvidence.length === 0,
  'Good-role route should not emit low-role or low-shape evidence.',
)
assert(
  greatStopRoleRightGood.criteria.roleRight.passed === true &&
    greatStopRoleRightGood.criteria.roleRight.reasons.length === 0,
  'Great Stop Role-Right should pass from Taste verdict for a good-role route.',
)
assert(
  tasteRoleRightBad.roleVerdict.roleRightReady === true,
  'Taste Role-Right evidence should still be ready for a bad-role route.',
)
assert(
  tasteRoleRightBad.roleVerdict.roleRightVerdict?.status === 'fail',
  'Taste Role-Right evidence should fail for bad role/shape fit.',
)
assert(
  tasteRoleRightBad.roleVerdict.roleRightVerdict.reasons.includes(
    'role_right:low_role_fit:start',
  ),
  'Taste Role-Right evidence should include low-role reason.',
)
assert(
  tasteRoleRightBad.roleVerdict.roleRightVerdict.reasons.includes(
    'role_right:low_shape_fit:highlight',
  ),
  'Taste Role-Right evidence should include low-shape reason.',
)
assert(
  tasteRoleRightBad.compatibility?.greatStopRoleRightInputs?.roleRightVerdict === 'fail',
  'Taste compatibility inputs should expose the Role-Right failure verdict for future Great Stop stamping.',
)
assert(
  greatStopRoleRightBad.failedCriteria.includes('role_right') &&
    greatStopRoleRightBad.criteria.roleRight.reasons.join('|') ===
      tasteRoleRightBad.roleVerdict.roleRightVerdict.reasons.join('|'),
  'Great Stop Role-Right should fail from Taste-authored reasons after the 2B rewire.',
)
assert(
  tasteRoleRightGeneralizedBad.roleVerdict.roleRightVerdict?.status === 'fail',
  'Generalized bad-role Taste verdict should fail.',
)
assert(
  greatStopRoleRightGeneralizedBad.failedCriteria.includes('role_right') &&
    greatStopRoleRightGeneralizedBad.criteria.roleRight.reasons.join('|') ===
      tasteRoleRightGeneralizedBad.roleVerdict.roleRightVerdict.reasons.join('|'),
  'A different bad-role route should fail Great Stop Role-Right from Taste evidence.',
)
assert(
  tasteIntentRightGood.intentVerdict.intentRightReady === true,
  'Taste Intent-Right evidence should be ready for a fully scored route.',
)
assert(
  tasteIntentRightGood.intentVerdict.intentRightVerdict?.status === 'pass',
  'Taste Intent-Right evidence should pass for a good route.',
)
assert(
  tasteIntentRightGood.intentVerdict.intentRightVerdict.reasons.length === 0,
  'Good Intent-Right route should not emit failure evidence.',
)
assert(
  tasteIntentRightGood.compatibility?.greatStopIntentRightInputs?.intentRightVerdict === 'pass',
  'Taste compatibility inputs should expose the Intent-Right pass verdict for future Great Stop stamping.',
)
assert(
  greatStopIntentRightGood.criteria.intentRight.passed === true &&
    greatStopIntentRightGood.criteria.intentRight.reasons.length === 0,
  'Great Stop Intent-Right should pass from Taste verdict for a good route.',
)
assert(
  tasteIntentRightBad.intentVerdict.intentRightReady === true,
  'Taste Intent-Right evidence should still be ready for a bad route.',
)
assert(
  tasteIntentRightBad.intentVerdict.intentRightVerdict?.status === 'fail',
  'Taste Intent-Right evidence should fail for low fit/lens/context.',
)
assert(
  tasteIntentRightBad.intentVerdict.intentRightVerdict.reasons.includes(
    'intent_right:low_fit:start',
  ),
  'Taste Intent-Right evidence should include low-fit reason.',
)
assert(
  tasteIntentRightBad.intentVerdict.intentRightVerdict.reasons.includes(
    'intent_right:low_lens_compatibility:highlight',
  ),
  'Taste Intent-Right evidence should include low-lens reason.',
)
assert(
  tasteIntentRightBad.intentVerdict.intentRightVerdict.reasons.includes(
    'intent_right:low_context_specificity:windDown',
  ),
  'Taste Intent-Right evidence should include low-context reason.',
)
assert(
  tasteIntentRightBad.compatibility?.greatStopIntentRightInputs?.intentRightReasons ===
    'intent_right:low_fit:start|intent_right:low_lens_compatibility:highlight|intent_right:low_context_specificity:windDown',
  'Taste compatibility inputs should expose Intent-Right failure reasons for future Great Stop stamping.',
)
assert(
  greatStopIntentRightBad.failedCriteria.includes('intent_right') &&
    greatStopIntentRightBad.criteria.intentRight.reasons.join('|') ===
      tasteIntentRightBad.intentVerdict.intentRightVerdict.reasons.join('|'),
  'Great Stop Intent-Right should fail from Taste-authored reasons after the 2B rewire.',
)
assert(
  tasteIntentRightGeneralizedBad.intentVerdict.intentRightVerdict?.status === 'fail',
  'Generalized bad Intent-Right Taste verdict should fail.',
)
assert(
  greatStopIntentRightGeneralizedBad.failedCriteria.includes('intent_right') &&
    greatStopIntentRightGeneralizedBad.criteria.intentRight.reasons.join('|') ===
      tasteIntentRightGeneralizedBad.intentVerdict.intentRightVerdict.reasons.join('|'),
  'A different bad Intent-Right route should fail Great Stop Intent-Right from Taste evidence.',
)

const gateSource = readFileSync('src/domain/greatStop/buildGreatStopGateResult.ts', 'utf8')
assert(!/provider_shadow|approved_payload|static_candidate|candidate_draft/.test(gateSource), 'Gate evaluator must not depend on non-authority source kinds.')
assert(
  gateSource.includes('function evaluatePlaceRightFromBearings') &&
    gateSource.includes('BearingsPlaceRightVerdict') &&
    gateSource.includes('params.placeRightVerdict') &&
    !gateSource.includes('function evaluatePlaceRight(params') &&
    !gateSource.includes('place_right:drive_like_movement_discouraged') &&
    !gateSource.includes('place_right:total_movement_over_preset'),
  'Great Stop Place-Right must stamp from Bearings verdict without local spatial/preset authority.',
)
assert(
  gateSource.includes('function evaluateRoleRight(candidate: ArcCandidate)') &&
    gateSource.includes('computeRouteMeaningRoleRightVerdict') &&
    gateSource.includes('roleRightVerdict.status') &&
    !gateSource.includes('role_right:low_role_fit:') &&
    !gateSource.includes('role_right:low_shape_fit:') &&
    !gateSource.includes('roleScore < 0.5') &&
    !gateSource.includes('shapeScore < 0.34'),
  'Great Stop Role-Right must stamp from Taste verdict without local threshold re-derivation.',
)
assert(
  gateSource.includes('function evaluateIntentRight(candidate: ArcCandidate)') &&
    gateSource.includes('computeRouteMeaningIntentRightVerdict') &&
    gateSource.includes('intentRightVerdict.status') &&
    !gateSource.includes('stop.scoredVenue.fitScore < 0.42') &&
    !gateSource.includes('stop.scoredVenue.lensCompatibility < 0.38') &&
    !gateSource.includes('stop.scoredVenue.contextSpecificity.overall < 0.3') &&
    !gateSource.includes('intent_right:low_fit:${role}') &&
    !gateSource.includes('intent_right:low_lens_compatibility:${role}') &&
    !gateSource.includes('intent_right:low_context_specificity:${role}'),
  'Great Stop Intent-Right must stamp from Taste verdict without local threshold re-derivation.',
)
const runGeneratePlanSource = readFileSync('src/domain/runGeneratePlan.ts', 'utf8')
assert(
  runGeneratePlanSource.includes('greatStopGateResult: buildGreatStopGateResult({') &&
    runGeneratePlanSource.includes('selectedArc,') &&
    runGeneratePlanSource.includes('routePacing: selectedArcPlaceRight.routePacing') &&
    runGeneratePlanSource.includes('placeRightVerdict: selectedArcPlaceRight.placeRightVerdict') &&
    runGeneratePlanSource.includes('locationClass: options.greatStopGateLocationClass') &&
    runGeneratePlanSource.includes("locationClassSource: options.greatStopGateLocationClass ? 'explicit' : undefined"),
  'runGeneratePlan must emit Great Stop Gate from selected generated arc, Bearings Place-Right verdict, route pacing, and explicit location class when provided.',
)
const diagnosticsSource = readFileSync('src/domain/types/diagnostics.ts', 'utf8')
assert(diagnosticsSource.includes('greatStopGateResult?: GreatStopGateResult'), 'Generation diagnostics must expose Great Stop Gate result.')
const buildWaypointSource = readFileSync('src/domain/waypoint/buildContractDrivenBuildWaypointPlan.ts', 'utf8')
assert(
  buildWaypointSource.includes("greatStopGateLocationClass?: RunGeneratePlanOptions['greatStopGateLocationClass']") &&
    buildWaypointSource.includes('greatStopGateLocationClass: input.greatStopGateLocationClass'),
  'Build contract-driven waypoint path must pass explicit Great Stop location class through to runGeneratePlan.',
)
const sandboxSource = readFileSync('src/pages/SandboxConciergePage.tsx', 'utf8')
assert(
  sandboxSource.includes('readBuildLocationClassQueryValue') &&
    sandboxSource.includes('DEV_CLOSEOUT_BUILD_LOCATION_CLASS_KEY') &&
    sandboxSource.includes('greatStopGateLocationClass: buildLocationClass ?? undefined'),
  'Public Build page must source explicit diagnostic location class and pass it into Build generation.',
)
const routeAuthoritySource = readFileSync(
  'src/app/services/routeAuthority/routeAuthorityService.ts',
  'utf8',
)
assert(!routeAuthoritySource.includes('greatStopGate'), 'Great Stop Gate must not change routeAuthority behavior.')
const runtimeRouteArtifactSource = readFileSync('src/domain/artifacts/runtimeRouteArtifact.ts', 'utf8')
assert(!runtimeRouteArtifactSource.includes('greatStopGate'), 'Great Stop Gate must not change RuntimeRouteArtifact shape.')

const waypointSource = readFileSync('src/integrations/waypoint/core.ts', 'utf8')
const waypointStart = waypointSource.indexOf('export interface WaypointBoundaryQualitySignals')
const waypointEnd = waypointSource.indexOf('function refinementAdjustmentTrace')
assert(waypointStart >= 0 && waypointEnd > waypointStart, 'Could not isolate Waypoint quality scoring block.')
const waypointQualityBlock = waypointSource.slice(waypointStart, waypointEnd).toLowerCase()
const bannedWaypointTokens = [
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
const waypointHits = bannedWaypointTokens.filter((token) =>
  new RegExp(`\\b${token}\\b`, 'i').test(waypointQualityBlock),
)
assert(waypointHits.length === 0, `Waypoint quality block leaked domain tokens: ${waypointHits.join(', ')}`)

const output = {
  artifactEmittedForGeneratedBuildRoutes: true,
  usesGeneratedFinalRouteTruth: true,
  nonAuthoritySourceKindsIgnored: true,
  requiredAnchorSurvivedAndCredited: evergreen.requiredAnchor,
  deterministicResults: {
    evergreenLike: {
      status: evergreen.status,
      failedCriteria: evergreen.failedCriteria,
      reasons: evergreen.reasons,
    },
    adegaLikeOldRoute: {
      status: adegaOld.status,
      failedCriteria: adegaOld.failedCriteria,
      reasons: adegaOld.reasons,
    },
    minibossLikeOldRoute: {
      status: minibossOld.status,
      failedCriteria: minibossOld.failedCriteria,
      reasons: minibossOld.reasons,
    },
    happyHollowLikeOldRoute: {
      status: happyHollowOld.status,
      failedCriteria: happyHollowOld.failedCriteria,
      reasons: happyHollowOld.reasons,
      thinStrictEmitted: false,
    },
  },
  presetsVaryByPersonaAndLocationClass: {
    explicitPresetMatrix: presetMatrix,
    familyL1TravelTolerance: l1FamilyPlace.preset.travelTolerance,
    evergreenL3TravelTolerance: evergreen.preset.travelTolerance,
    familyL1BearingsPlaceReasons: l1FamilyPlace.reasons.filter((reason) =>
      reason.startsWith('place_right:'),
    ),
  },
  adegaUsesExplicitL2Mid: adegaOld.preset.source === 'explicit' && adegaOld.preset.locationClass === 'L2 Mid',
  l3UsesExplicitL3Sparse: evergreen.preset.source === 'explicit' && evergreen.preset.locationClass === 'L3 Sparse',
  momentRightDomainAgnostic: true,
  waypointDomainGuardrailPassed: true,
  tasteRoleRightEvidence: {
    goodRoute: {
      ready: tasteRoleRightGood.roleVerdict.roleRightReady,
      status: tasteRoleRightGood.roleVerdict.roleRightVerdict?.status,
      reasons: tasteRoleRightGood.roleVerdict.roleRightVerdict?.reasons,
      greatStopRoleRightPassed: greatStopRoleRightGood.criteria.roleRight.passed,
      greatStopReasons: greatStopRoleRightGood.criteria.roleRight.reasons,
    },
    badRoute: {
      ready: tasteRoleRightBad.roleVerdict.roleRightReady,
      status: tasteRoleRightBad.roleVerdict.roleRightVerdict?.status,
      reasons: tasteRoleRightBad.roleVerdict.roleRightVerdict?.reasons,
      lowRoleEvidence: tasteRoleRightBad.roleVerdict.roleRightVerdict?.lowRoleEvidence,
      lowShapeEvidence: tasteRoleRightBad.roleVerdict.roleRightVerdict?.lowShapeEvidence,
      greatStopRoleRightPassed: greatStopRoleRightBad.criteria.roleRight.passed,
      greatStopReasons: greatStopRoleRightBad.criteria.roleRight.reasons,
    },
    generalizedBadRoute: {
      ready: tasteRoleRightGeneralizedBad.roleVerdict.roleRightReady,
      status: tasteRoleRightGeneralizedBad.roleVerdict.roleRightVerdict?.status,
      reasons: tasteRoleRightGeneralizedBad.roleVerdict.roleRightVerdict?.reasons,
      greatStopRoleRightPassed:
        greatStopRoleRightGeneralizedBad.criteria.roleRight.passed,
      greatStopReasons: greatStopRoleRightGeneralizedBad.criteria.roleRight.reasons,
    },
    greatStopRoleRightAuthority: 'taste_role_right_verdict',
  },
  tasteIntentRightEvidence: {
    goodRoute: {
      ready: tasteIntentRightGood.intentVerdict.intentRightReady,
      status: tasteIntentRightGood.intentVerdict.intentRightVerdict?.status,
      reasons: tasteIntentRightGood.intentVerdict.intentRightVerdict?.reasons,
      compatibilityInputs: tasteIntentRightGood.compatibility?.greatStopIntentRightInputs,
      greatStopIntentRightPassed: greatStopIntentRightGood.criteria.intentRight.passed,
      greatStopReasons: greatStopIntentRightGood.criteria.intentRight.reasons,
    },
    badRoute: {
      ready: tasteIntentRightBad.intentVerdict.intentRightReady,
      status: tasteIntentRightBad.intentVerdict.intentRightVerdict?.status,
      reasons: tasteIntentRightBad.intentVerdict.intentRightVerdict?.reasons,
      lowFitEvidence: tasteIntentRightBad.intentVerdict.intentRightVerdict?.lowFitEvidence,
      lowLensCompatibilityEvidence:
        tasteIntentRightBad.intentVerdict.intentRightVerdict?.lowLensCompatibilityEvidence,
      lowContextSpecificityEvidence:
        tasteIntentRightBad.intentVerdict.intentRightVerdict?.lowContextSpecificityEvidence,
      compatibilityInputs: tasteIntentRightBad.compatibility?.greatStopIntentRightInputs,
      greatStopIntentRightPassed: greatStopIntentRightBad.criteria.intentRight.passed,
      greatStopReasons: greatStopIntentRightBad.criteria.intentRight.reasons,
    },
    generalizedBadRoute: {
      ready: tasteIntentRightGeneralizedBad.intentVerdict.intentRightReady,
      status: tasteIntentRightGeneralizedBad.intentVerdict.intentRightVerdict?.status,
      reasons: tasteIntentRightGeneralizedBad.intentVerdict.intentRightVerdict?.reasons,
      greatStopIntentRightPassed:
        greatStopIntentRightGeneralizedBad.criteria.intentRight.passed,
      greatStopReasons: greatStopIntentRightGeneralizedBad.criteria.intentRight.reasons,
    },
    greatStopIntentRightAuthority: 'taste_intent_right_verdict',
  },
  routeAuthorityUnchanged: true,
  runtimeRouteArtifactShapeUnchanged: true,
  providerShadowRemainsNonAuthoritative: true,
  fetchCallCount,
}

assert(fetchCallCount === 0, `Expected fetchCallCount 0, got ${fetchCallCount}`)
console.log(JSON.stringify(output, null, 2))
