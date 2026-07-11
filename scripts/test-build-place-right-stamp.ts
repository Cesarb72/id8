import { readFileSync } from 'node:fs'
import { evaluateRoutePlaceRightEvidence } from '../src/domain/bearings/evaluateRoutePlaceRightEvidence'
import type {
  BearingsRouteFeasibilityInput,
  BearingsRouteFeasibilityVerdict,
  DistrictRoutePlaceFacts,
} from '../src/domain/bearings/routePlaceRightContract'

globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
  throw new Error(`Unexpected fetch in no-network Place-Right evidence test: ${String(args[0])}`)
}) as typeof fetch

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function districtFacts(overrides: Partial<DistrictRoutePlaceFacts> = {}): DistrictRoutePlaceFacts {
  const base: DistrictRoutePlaceFacts = {
    routeId: 'place-right-good',
    candidateId: 'place-right-good-candidate',
    stopBaseVenueIds: ['good-start', 'good-anchor', 'good-end'],
    requiredStopBaseVenueIds: ['good-anchor'],
    sameNeighborhood: {
      allStopsSameNeighborhood: true,
      neighborhoods: ['Downtown'],
      mismatchedStopBaseVenueIds: [],
      confidence: 1,
      missingFactReasons: [],
    },
    clusterCoherence: {
      homeClusterId: 'downtown',
      clusterIds: ['downtown'],
      clusterEscapeCount: 0,
      repeatedClusterEscapeCount: 0,
      longTransitionCount: 0,
      backtrackDetected: false,
      confidence: 1,
      missingFactReasons: [],
    },
    compactness: {
      compactnessScore: 0.84,
      routeRadiusM: 240,
      maxPairwiseDistanceM: 410,
      confidence: 1,
      missingFactReasons: [],
    },
    supportProximity: [
      {
        supportBaseVenueId: 'good-start',
        supportRole: 'warmup',
        anchorBaseVenueId: 'good-anchor',
        sameNeighborhood: true,
        sameCluster: true,
        distanceMeters: 160,
        confidence: 1,
        missingFactReasons: [],
      },
      {
        supportBaseVenueId: 'good-end',
        supportRole: 'cooldown',
        anchorBaseVenueId: 'good-anchor',
        sameNeighborhood: true,
        sameCluster: true,
        distanceMeters: 180,
        confidence: 1,
        missingFactReasons: [],
      },
    ],
    anchorSupportRelationships: [
      {
        anchorBaseVenueId: 'good-anchor',
        supportBaseVenueIds: ['good-start', 'good-end'],
        sameNeighborhoodSupportCount: 2,
        sameClusterSupportCount: 2,
        nearestSupportDistanceMeters: 160,
        confidence: 1,
        missingFactReasons: [],
      },
    ],
    structuralConfidence: {
      status: 'complete',
      missingFactReasons: [],
      notes: ['synthetic District facts for Place-Right observer'],
    },
    provenance: {
      source: 'district',
      version: 'test-district-place-facts',
      evidenceIds: ['test-district-place-facts'],
    },
  }

  return {
    ...base,
    ...overrides,
  }
}

function inputFor(facts: DistrictRoutePlaceFacts): BearingsRouteFeasibilityInput {
  const anchorBaseVenueId = facts.requiredStopBaseVenueIds?.[0] ?? 'good-anchor'
  return {
    routeId: facts.routeId,
    candidateId: facts.candidateId,
    districtFacts: facts,
    roleFacts: facts.stopBaseVenueIds.map((baseVenueId) => ({
      baseVenueId,
      routeRole: baseVenueId === anchorBaseVenueId ? 'highlight' : 'support',
      isRequiredStop: baseVenueId === anchorBaseVenueId,
      isSelectedAnchor: baseVenueId === anchorBaseVenueId,
    })),
    requiredStopFacts: [
      {
        baseVenueId: anchorBaseVenueId,
        requiredRole: 'highlight',
        survivalRequired: true,
        source: 'build_anchor',
      },
    ],
    openClosedFacts: facts.stopBaseVenueIds.map((baseVenueId) => ({
      baseVenueId,
      status: 'open',
      confidence: 1,
    })),
    distanceFacts: {
      totalEstimatedTransitionMinutes: 10,
      maxSingleTransitionMinutes: 5,
      transitions: [],
      reasonCodes: [],
    },
    movementContract: {
      tolerance: 'contained',
      travelPosture: 'walkable',
      requireContinuity: true,
      reasonCodes: [],
    },
    supportSupplyFacts: [
      {
        role: 'support',
        anchorBaseVenueId,
        nearbyCandidateCount: facts.anchorSupportRelationships[0]?.sameNeighborhoodSupportCount ?? 0,
        supportSupplyMissing:
          (facts.anchorSupportRelationships[0]?.sameNeighborhoodSupportCount ?? 0) === 0,
        reasonCodes: [],
      },
    ],
  }
}

function summarize(verdict: BearingsRouteFeasibilityVerdict) {
  return {
    placeRightReady: verdict.placeRightReady,
    status: verdict.status,
    reasons: verdict.reasons,
    districtSource: verdict.provenance.notes?.find((note) =>
      note.startsWith('consumed-district-source:'),
    ),
    bearingsSource: verdict.provenance.source,
    compatibilityStatus: verdict.compatibility.greatStopPlaceRightStatus,
    compatibilityReasons: verdict.compatibility.greatStopPlaceRightReasonCodes,
  }
}

const goodFacts = districtFacts()
const goodVerdict = evaluateRoutePlaceRightEvidence(inputFor(goodFacts))

const spatialFailureFacts = districtFacts({
  routeId: 'place-right-spatial-failure',
  candidateId: 'place-right-spatial-failure-candidate',
  stopBaseVenueIds: ['scattered-start', 'scattered-anchor', 'scattered-end'],
  requiredStopBaseVenueIds: ['scattered-anchor'],
  sameNeighborhood: {
    allStopsSameNeighborhood: false,
    neighborhoods: ['Downtown', 'Japantown', 'Willow Glen'],
    mismatchedStopBaseVenueIds: ['scattered-start', 'scattered-end'],
    confidence: 1,
    missingFactReasons: [],
  },
  clusterCoherence: {
    homeClusterId: 'downtown',
    clusterIds: ['downtown', 'japantown', 'willow-glen'],
    clusterEscapeCount: 3,
    repeatedClusterEscapeCount: 1,
    longTransitionCount: 2,
    backtrackDetected: true,
    confidence: 1,
    missingFactReasons: [],
  },
  compactness: {
    compactnessScore: 0.24,
    routeRadiusM: 2800,
    maxPairwiseDistanceM: 5200,
    confidence: 1,
    missingFactReasons: [],
  },
  supportProximity: [
    {
      supportBaseVenueId: 'scattered-start',
      supportRole: 'warmup',
      anchorBaseVenueId: 'scattered-anchor',
      sameNeighborhood: false,
      sameCluster: false,
      distanceMeters: 2400,
      confidence: 1,
      missingFactReasons: [],
    },
  ],
  anchorSupportRelationships: [
    {
      anchorBaseVenueId: 'scattered-anchor',
      supportBaseVenueIds: ['scattered-start'],
      sameNeighborhoodSupportCount: 0,
      sameClusterSupportCount: 0,
      nearestSupportDistanceMeters: 2400,
      confidence: 1,
      missingFactReasons: [],
    },
  ],
})
const spatialFailureVerdict = evaluateRoutePlaceRightEvidence(inputFor(spatialFailureFacts))

const requiredStopFailureFacts = districtFacts({
  routeId: 'place-right-required-stop-failure',
  candidateId: 'place-right-required-stop-failure-candidate',
  stopBaseVenueIds: ['isolated-start', 'isolated-anchor', 'isolated-end'],
  requiredStopBaseVenueIds: ['isolated-anchor'],
  supportProximity: [],
  anchorSupportRelationships: [
    {
      anchorBaseVenueId: 'isolated-anchor',
      supportBaseVenueIds: [],
      sameNeighborhoodSupportCount: 0,
      sameClusterSupportCount: 0,
      confidence: 1,
      missingFactReasons: [],
    },
  ],
})
const requiredStopFailureVerdict = evaluateRoutePlaceRightEvidence(
  inputFor(requiredStopFailureFacts),
)

assert(goodFacts.provenance.source === 'district', 'Good route District facts must be District-authored.')
assert(goodVerdict.provenance.source === 'bearings', 'Good route verdict must be Bearings-authored.')
assert(goodVerdict.placeRightReady === true, 'Good route must be Place-Right ready.')
assert(goodVerdict.status === 'pass', `Good route should pass, got ${goodVerdict.status}.`)
assert(goodVerdict.reasons.length === 0, 'Good route should not emit Place-Right fail reasons.')

assert(
  spatialFailureFacts.provenance.source === 'district',
  'Spatial failure District facts must be District-authored.',
)
assert(
  spatialFailureVerdict.provenance.source === 'bearings',
  'Spatial failure verdict must be Bearings-authored.',
)
assert(spatialFailureVerdict.status === 'fail', 'Spatial incoherence route must fail.')
assert(
  spatialFailureVerdict.reasons.includes('place_right:low_route_compactness') &&
    spatialFailureVerdict.reasons.includes('place_right:scattered_neighborhoods') &&
    spatialFailureVerdict.reasons.includes('place_right:cluster_escape_structure') &&
    spatialFailureVerdict.reasons.includes('place_right:backtrack_structure') &&
    spatialFailureVerdict.reasons.includes('place_right:poor_support_proximity'),
  'Spatial failure must include compactness, neighborhood, cluster/backtrack, and support proximity reasons.',
)

assert(
  requiredStopFailureFacts.provenance.source === 'district',
  'Required-stop failure District facts must be District-authored.',
)
assert(
  requiredStopFailureVerdict.provenance.source === 'bearings',
  'Required-stop failure verdict must be Bearings-authored.',
)
assert(requiredStopFailureVerdict.status === 'fail', 'Required-stop survival route must fail.')
assert(
  requiredStopFailureVerdict.reasons.includes('place_right:required_stop_survival_failed') &&
    requiredStopFailureVerdict.reasons.includes('place_right:support_supply_not_buildable'),
  'Required-stop failure must include survival and support buildability reasons.',
)

const helperSource = readFileSync('src/domain/bearings/evaluateRoutePlaceRightEvidence.ts', 'utf8')
assert(
  helperSource.includes('districtFacts.compactness') &&
    helperSource.includes('districtFacts.clusterCoherence') &&
    helperSource.includes('districtFacts.supportProximity') &&
    helperSource.includes('districtFacts.anchorSupportRelationships'),
  'Bearings Place-Right helper must consume District facts.',
)
assert(
  !helperSource.includes('ScoredVenue') &&
    !helperSource.includes('venue.neighborhood') &&
    !helperSource.includes('selectedArc.spatial'),
  'Bearings Place-Right helper must not recompute District structure from raw Arc/candidate inputs.',
)

const greatStopSource = readFileSync('src/domain/greatStop/buildGreatStopGateResult.ts', 'utf8')
assert(
  greatStopSource.includes('function evaluatePlaceRight') &&
    greatStopSource.includes('spatial: selectedArc.spatial') &&
    !greatStopSource.includes('evaluateRoutePlaceRightEvidence') &&
    !greatStopSource.includes('BearingsPlaceRightVerdict'),
  'BEARINGS-3 must leave Great Stop Place-Right legacy/unwired.',
)

const output = {
  observer: 'build_place_right_evidence_guard',
  cases: {
    goodRoute: summarize(goodVerdict),
    spatialIncoherenceFailure: summarize(spatialFailureVerdict),
    requiredStopSurvivalFailure: summarize(requiredStopFailureVerdict),
  },
  districtFactsConsumedNotRecomputed: true,
  bearingsProvenancePresent: true,
  greatStopPlaceRightRemainsUnwired: true,
  providerNetworkCounts: {
    fetchCallCount: 0,
  },
}

console.log(JSON.stringify(output, null, 2))
