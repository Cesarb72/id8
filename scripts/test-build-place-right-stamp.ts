import { readFileSync } from 'node:fs'
import { evaluateRoutePlaceRightEvidence } from '../src/domain/bearings/evaluateRoutePlaceRightEvidence'
import { computeFieldRealVerdictForArcCandidate } from '../src/domain/field/computeFieldRealVerdict'
import { buildGreatStopGateResult } from '../src/domain/greatStop/buildGreatStopGateResult'
import type { ArcCandidate, ArcStop } from '../src/domain/types/arc'
import type { RoutePacingDiagnostics } from '../src/domain/types/diagnostics'
import type {
  BearingsRouteFeasibilityInput,
  BearingsRouteFeasibilityVerdict,
  DistrictRoutePlaceFacts,
} from '../src/domain/bearings/routePlaceRightContract'
import type { TasteRouteMomentVerdict } from '../src/domain/interpretation/taste/routeMomentVerdict'
import type { IntentProfile } from '../src/domain/types/intent'

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

function stop(baseVenueId: string, role: ArcStop['role'], name: string): ArcStop {
  return {
    role,
    scoredVenue: {
      venue: {
        id: baseVenueId,
        name,
        category: 'cafe',
        subcategory: 'coffee',
        tags: [],
        vibeTags: [],
        address: '1 Test St',
        neighborhood: 'Downtown',
        coordinates: { lat: 37.33, lng: -121.89 },
        rating: 4.5,
        reviewCount: 100,
        priceLevel: 2,
        isActive: true,
        energyLevel: role === 'peak' ? 0.9 : 0.5,
        source: {
          normalizedFromRawType: 'seed',
          sourceOrigin: 'curated',
          curatedSubtype: 'manual-custom',
          sourceConfidence: 0.95,
          completenessScore: 0.95,
          qualityScore: 0.95,
          openNow: true,
          hoursKnown: true,
          likelyOpenForCurrentWindow: true,
          businessStatus: 'operational',
          timeConfidence: 0.95,
          hoursPressureLevel: 'strong-open',
          hoursPressureNotes: [],
          hoursDemotionApplied: false,
          hoursSuppressionApplied: false,
          sourceTypes: ['test'],
          missingFields: [],
          inferredFields: [],
          qualityGateStatus: 'approved',
          qualityGateNotes: [],
          approvalBlockers: [],
          demotionReasons: [],
          suppressionReasons: [],
        },
      },
      candidateIdentity: {
        candidateId: baseVenueId,
        baseVenueId,
        kind: 'base',
        traceLabel: baseVenueId,
      },
      fitScore: 0.78,
      lensCompatibility: 0.76,
      contextSpecificity: {
        overall: 0.72,
        personaSignal: 0.72,
        vibeSignal: 0.72,
        lensSignal: 0.72,
        byRole: { warmup: 0.72, peak: 0.72, wildcard: 0.72, cooldown: 0.72 },
      },
      roleScores: { warmup: 0.78, peak: 0.82, wildcard: 0.7, cooldown: 0.78 },
      stopShapeFit: { start: 0.78, highlight: 0.82, surprise: 0.7, windDown: 0.78 },
      taste: {
        signals: {},
        modeAlignment: {
          score: 0.8,
          penalty: 0,
          lane: role === 'peak' ? 'main_moment' : 'support',
          tier: 'aligned',
          supportiveTagScore: 0.7,
          lanePriorityScore: 0.7,
        },
        fallbackPenalty: {
          signalScore: 0,
          appliedPenalty: 0,
          applied: false,
          strongerAlternativePresent: false,
          reason: 'none',
        },
        rolePoolInfluence: {
          warmup: {
            tasteBonus: 0,
            roleSuitabilityContribution: 0,
            momentContribution: 0,
            highlightPlausibilityBonus: 0,
            modeAlignmentContribution: 0,
            modeAlignmentPenalty: 0,
          },
          peak: {
            tasteBonus: 0,
            roleSuitabilityContribution: 0,
            momentContribution: 0,
            highlightPlausibilityBonus: 0,
            modeAlignmentContribution: 0,
            modeAlignmentPenalty: 0,
          },
          wildcard: {
            tasteBonus: 0,
            roleSuitabilityContribution: 0,
            momentContribution: 0,
            highlightPlausibilityBonus: 0,
            modeAlignmentContribution: 0,
            modeAlignmentPenalty: 0,
          },
          cooldown: {
            tasteBonus: 0,
            roleSuitabilityContribution: 0,
            momentContribution: 0,
            highlightPlausibilityBonus: 0,
            modeAlignmentContribution: 0,
            modeAlignmentPenalty: 0,
          },
        },
      },
    } as ArcStop['scoredVenue'],
  }
}

function candidateFor(routeId: string, stopIds: string[]): ArcCandidate {
  const peakVenueId = stopIds[1] ?? 'anchor'
  const routeMomentVerdict: TasteRouteMomentVerdict = {
    source: 'taste',
    provenance: [
      {
        source: 'taste',
        key: 'place_right_stamp_fixture_moment_verdict',
        reason: 'Synthetic Taste-authored passing moment verdict.',
      },
    ],
    peakCandidateVenueId: peakVenueId,
    anchorAsPeakCandidacy: 'intended_peak',
    peakSuitability: {
      score: 0.8,
      tier: 'strong',
    },
    momentStrengthVerdict: {
      strength: 'strong',
      score: 0.9,
      reason: 'Synthetic strong moment.',
    },
    momentPreservationStatus: 'preserved',
    strongMomentPresent: true,
    flatArcRisk: {
      level: 'none',
      score: 0,
      varianceScore: 0.8,
      penalty: 0,
      reasons: [],
    },
    missedPeakReason: {
      applied: false,
      code: 'none',
    },
    availableMomentEvidence: {
      availableHighMomentCount: 1,
      availableStrongMomentCount: 1,
      highMomentVenueIds: [peakVenueId],
      strongMomentVenueIds: [peakVenueId],
    },
    peakRoleEvidence: {
      candidateVenueId: peakVenueId,
      roleFitScore: 0.9,
      stopShapeFitScore: 0.8,
      highlightValidity: 'valid',
    },
    anchorStrengthEvidence: {
      candidateVenueId: peakVenueId,
      anchorStrength: 0.9,
      momentIdentityType: 'anchor',
      momentIdentityStrength: 'strong',
      momentPotentialScore: 0.8,
      momentIntensityScore: 0.8,
    },
    momentQualityNote: 'Synthetic strong moment.',
  }

  return {
    id: routeId,
    stops: [
      stop(stopIds[0] ?? 'start', 'warmup', 'Start'),
      stop(stopIds[1] ?? 'anchor', 'peak', 'Anchor'),
      stop(stopIds[2] ?? 'end', 'cooldown', 'End'),
    ],
    totalScore: 0.9,
    scoreBreakdown: {
      roleFlowScore: 0.8,
      diversityScore: 0.8,
      geographyScore: 0.8,
      hiddenGemLift: 0,
      windDownScore: 0.8,
      highlightMomentScore: 0.8,
      momentStrengthScore: 0.9,
      momentVarianceScore: 0.8,
      momentFlatPenalty: 0,
      routeMomentVerdict,
      strongMomentPresent: true,
      momentQualityNote: 'Synthetic strong moment.',
    } as ArcCandidate['scoreBreakdown'],
    pacing: {} as ArcCandidate['pacing'],
    spatial: {
      mode: 'walkable',
      homeClusterId: 'downtown',
      clustersVisited: ['downtown'],
      clusterAssignments: [],
      transitions: [],
      sameClusterTransitionCount: 2,
      clusterEscapeCount: 0,
      repeatedClusterEscapeCount: 0,
      longTransitionCount: 0,
      jumpUsed: false,
      spatialBonus: 0,
      spatialPenalty: 0,
      score: 0.84,
      notes: [],
    },
    hasWildcard: false,
  }
}

function routePacing(): RoutePacingDiagnostics {
  return {
    transitions: [],
    totalRouteFriction: 0,
    estimatedStopMinutes: 0,
    estimatedTransitionMinutes: 10,
    estimatedTotalMinutes: 90,
    estimatedTotalLabel: '90m',
    routeFeelLabel: 'synthetic',
    pacingPenaltyApplied: false,
    pacingPenaltyReasons: [],
    smoothProgressionRewardApplied: true,
    smoothProgressionRewardReasons: [],
  }
}

function gateFor(verdict: BearingsRouteFeasibilityVerdict) {
  const candidate = candidateFor(verdict.routeEvidence.status, verdict.stopEvidence.map((entry) => entry.baseVenueId))
  const anchorBaseVenueId = verdict.stopEvidence[0]?.baseVenueId ?? 'good-anchor'
  const intent: IntentProfile = {
    mode: 'build',
    city: 'San Jose',
    persona: 'friends',
    distanceMode: 'nearby',
    planningMode: 'user-led',
    anchor: { venueId: anchorBaseVenueId, role: 'highlight' },
    refinementModes: [],
  } as IntentProfile
  return buildGreatStopGateResult({
    selectedArc: candidate,
    intent,
    routePacing: routePacing(),
    placeRightVerdict: verdict,
    fieldRealVerdict: computeFieldRealVerdictForArcCandidate(candidate),
    locationClass: 'L1 Dense',
    locationClassSource: 'explicit',
  })
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
const goodGate = gateFor(goodVerdict)
const spatialFailureGate = gateFor(spatialFailureVerdict)
const requiredStopFailureGate = gateFor(requiredStopFailureVerdict)

assert(goodFacts.provenance.source === 'district', 'Good route District facts must be District-authored.')
assert(goodVerdict.provenance.source === 'bearings', 'Good route verdict must be Bearings-authored.')
assert(goodVerdict.placeRightReady === true, 'Good route must be Place-Right ready.')
assert(goodVerdict.status === 'pass', `Good route should pass, got ${goodVerdict.status}.`)
assert(goodVerdict.reasons.length === 0, 'Good route should not emit Place-Right fail reasons.')
assert(goodGate.criteria.placeRight.passed, 'Great Stop Place-Right must pass from Bearings pass verdict.')
assert(goodGate.criteria.momentRight.passed, 'Moment-Right must remain independently passing.')
assert(goodGate.criteria.roleRight.passed, 'Role-Right must remain independently passing.')

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
  spatialFailureGate.failedCriteria.includes('place_right') &&
    spatialFailureGate.criteria.placeRight.reasons.join('|') ===
      spatialFailureVerdict.reasons.join('|'),
  'Great Stop Place-Right must fail from Bearings spatial-incoherence verdict reasons.',
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
assert(
  requiredStopFailureGate.failedCriteria.includes('place_right') &&
    requiredStopFailureGate.criteria.placeRight.reasons.join('|') ===
      requiredStopFailureVerdict.reasons.join('|'),
  'Great Stop Place-Right must fail from Bearings required-stop survival verdict reasons.',
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
  greatStopSource.includes('function evaluatePlaceRightFromBearings') &&
    greatStopSource.includes('BearingsPlaceRightVerdict') &&
    greatStopSource.includes('params.placeRightVerdict') &&
    !greatStopSource.includes('spatial: selectedArc.spatial') &&
    !greatStopSource.includes('place_right:total_movement_over_preset') &&
    !greatStopSource.includes('place_right:drive_like_movement_discouraged'),
  'Great Stop Place-Right must stamp from Bearings verdict without legacy Arc spatial fallback authority.',
)

const output = {
  observer: 'build_place_right_evidence_guard',
  cases: {
    goodRoute: summarize(goodVerdict),
    spatialIncoherenceFailure: summarize(spatialFailureVerdict),
    requiredStopSurvivalFailure: summarize(requiredStopFailureVerdict),
  },
  greatStopStamp: {
    goodRoute: goodGate.criteria.placeRight,
    spatialIncoherenceFailure: spatialFailureGate.criteria.placeRight,
    requiredStopSurvivalFailure: requiredStopFailureGate.criteria.placeRight,
  },
  coexistence: {
    roleRightStillPasses: goodGate.criteria.roleRight.passed,
    momentRightStillPasses: goodGate.criteria.momentRight.passed,
  },
  districtFactsConsumedNotRecomputed: true,
  bearingsProvenancePresent: true,
  greatStopPlaceRightStampsFromBearings: true,
  providerNetworkCounts: {
    fetchCallCount: 0,
  },
}

console.log(JSON.stringify(output, null, 2))
