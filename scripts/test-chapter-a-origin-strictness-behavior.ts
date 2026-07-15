import assert from 'node:assert/strict'

import {
  computeArcWhenSpatialScorePressure,
  evaluatePeakCandidateFeasibility,
  isPeakDistanceFeasible,
  resolveIntentOriginMovementPosture,
} from '../src/domain/bearings/evaluateArcRouteMovementFeasibility.ts'
import { projectOriginMovementPosture } from '../src/domain/bearings/projectOriginMovementPosture.ts'
import { buildWhenSignalProfile } from '../src/domain/when/whenSignalProfile.ts'
import { resolveLocation } from '../src/engines/district/location/resolveLocation.ts'
import type { ScoredVenue } from '../src/domain/types/arc.ts'
import type { IntentProfile } from '../src/domain/types/intent.ts'
import type { SpatialCoherenceAnalysis } from '../src/domain/types/spatial.ts'
import type {
  MovementOriginPrecision,
  MovementOriginSource,
} from '../src/engines/district/types/districtTypes.ts'

let providerCallCount = 0
const originalFetch = globalThis.fetch

globalThis.fetch = (async (input) => {
  providerCallCount += 1
  throw new Error(`Chapter A A4 origin strictness observer must not call fetch: ${String(input)}`)
}) as typeof fetch

type OriginCase = {
  case: string
  originPrecision: MovementOriginPrecision
  originSource: MovementOriginSource
  driveMinutes: number
  proximityFit: number
  expectedStrictness: string
  expectedRadiusPosture: string
  expectedDistanceFeasible: boolean
  expectedAdjustedLimit?: number
  expectedCaptureNeeded: boolean
  expectedAllowsTight: boolean
}

function buildIntent(
  originPrecision: MovementOriginPrecision,
  originSource: MovementOriginSource,
): IntentProfile {
  return {
    crew: 'romantic',
    persona: 'romantic',
    personaSource: 'explicit',
    primaryAnchor: 'cozy',
    city: 'San Jose',
    distanceMode: 'nearby',
    prefersHiddenGems: false,
    mode: 'curate',
    planningMode: 'engine-led',
    originPrecision,
    originSource,
  } as IntentProfile
}

function buildLegacyMarkerlessIntent(): IntentProfile {
  return {
    crew: 'romantic',
    persona: 'romantic',
    personaSource: 'explicit',
    primaryAnchor: 'cozy',
    city: 'San Jose',
    distanceMode: 'nearby',
    prefersHiddenGems: false,
    mode: 'curate',
    planningMode: 'engine-led',
  } as IntentProfile
}

function buildCandidate(driveMinutes: number, proximityFit: number): ScoredVenue {
  return {
    venue: {
      name: 'Chapter A Origin Fixture',
      driveMinutes,
      source: {},
    },
    fitBreakdown: {
      proximityFit,
    },
    candidateIdentity: {
      candidateId: `origin-fixture-${driveMinutes}`,
      baseVenueId: `origin-fixture-${driveMinutes}`,
      kind: 'base',
      traceLabel: `origin fixture ${driveMinutes}`,
    },
    roleContract: {
      peak: {
        strength: 'none',
        satisfied: true,
        score: 0.7,
      },
    },
    highlightValidity: {
      validityLevel: 'valid',
      personaVetoes: [],
      contextVetoes: [],
      violations: [],
    },
  } as ScoredVenue
}

function buildSpatialFixture(): SpatialCoherenceAnalysis {
  return {
    mode: 'walkable',
    homeClusterId: 'downtown',
    clustersVisited: ['downtown', 'sofa'],
    clusterAssignments: [],
    transitions: [
      {
        fromClusterId: 'downtown',
        toClusterId: 'downtown',
        kind: 'same_cluster',
      },
      {
        fromClusterId: 'downtown',
        toClusterId: 'sofa',
        kind: 'cluster_escape',
      },
    ],
    sameClusterTransitionCount: 1,
    clusterEscapeCount: 1,
    repeatedClusterEscapeCount: 0,
    longTransitionCount: 0,
    jumpUsed: true,
    spatialBonus: 0,
    spatialPenalty: 0,
    score: 0.72,
    notes: [],
  } as SpatialCoherenceAnalysis
}

function buildWalkableWhenProfile() {
  return buildWhenSignalProfile({
    whenPosture: 'now_doable_tonight',
    whenPostureSource: 'user_supplied',
    durationMinutes: 150,
    durationSource: 'user_supplied',
    spatialMode: 'WALKABLE',
    flexibilitySource: 'user_supplied',
  })
}

function assertOriginCase(testCase: OriginCase): Record<string, unknown> {
  const intent = buildIntent(testCase.originPrecision, testCase.originSource)
  const candidate = buildCandidate(testCase.driveMinutes, testCase.proximityFit)
  const posture = resolveIntentOriginMovementPosture(intent)
  const directProjection = projectOriginMovementPosture({
    originPrecision: testCase.originPrecision,
    originSource: testCase.originSource,
  })
  assert.deepEqual(posture, directProjection)
  assert.equal(posture?.strictness, testCase.expectedStrictness)
  assert.equal(posture?.movementRadiusPosture, testCase.expectedRadiusPosture)
  assert.equal(posture?.captureNeeded, testCase.expectedCaptureNeeded)
  assert.equal(posture?.allowsTightWalkableClaims, testCase.expectedAllowsTight)

  const distanceFeasible = isPeakDistanceFeasible(candidate, intent, {
    allowMeaningfulStretch: false,
  })
  const feasibility = evaluatePeakCandidateFeasibility({
    candidate,
    intent,
    allowMeaningfulStretch: false,
    evaluateRouteTime: false,
    requireHighlightValidity: false,
    requireHighlightVetoClear: false,
    requirePeakContract: false,
  })
  assert.equal(distanceFeasible, testCase.expectedDistanceFeasible)
  assert.equal(feasibility.distanceFeasible, testCase.expectedDistanceFeasible)
  assert.equal(
    feasibility.originAdjustedDistanceLimitMinutes,
    testCase.expectedAdjustedLimit,
    `${testCase.case} adjusted limit drifted.`,
  )

  const pressure = computeArcWhenSpatialScorePressure({
    intent,
    spatial: buildSpatialFixture(),
    options: {
      whenSpatialScoring: 'soft_curate_spatial',
      whenSignalProfile: buildWalkableWhenProfile(),
    },
  })
  assert.equal(pressure.originMovementStrictness, testCase.expectedStrictness)
  assert.equal(pressure.originMovementRadiusPosture, testCase.expectedRadiusPosture)
  assert.equal(pressure.originAllowsTightWalkableClaims, testCase.expectedAllowsTight)
  if (testCase.expectedAllowsTight) {
    assert.match(pressure.reason, /walkable preference/)
    assert.doesNotMatch(pressure.reason, /blocks tight walkable claims/)
  } else {
    assert.match(pressure.reason, /blocks tight walkable claims/)
    assert.match(pressure.reason, /flexible preference/)
  }

  return {
    case: testCase.case,
    marker: `${testCase.originPrecision}/${testCase.originSource}`,
    strictness: posture?.strictness,
    radiusPosture: posture?.movementRadiusPosture,
    captureNeeded: posture?.captureNeeded,
    allowsTightWalkableClaims: posture?.allowsTightWalkableClaims,
    distanceFeasible,
    adjustedLimitMinutes: feasibility.originAdjustedDistanceLimitMinutes ?? 'legacy',
    spatialReason: pressure.reason,
  }
}

function assertTwoLensComparison(): Array<Record<string, unknown>> {
  const candidate = buildCandidate(24, 0.5)
  const markerlessIntent = buildLegacyMarkerlessIntent()
  const preciseIntent = buildIntent('precise', 'geolocation')
  const neighborhoodIntent = buildIntent('neighborhood', 'neighborhood_fallback')
  const cityIntent = buildIntent('city', 'city_fallback')
  const unknownIntent = buildIntent('unknown', 'unknown')

  const markerlessFeasible = isPeakDistanceFeasible(candidate, markerlessIntent, {
    allowMeaningfulStretch: false,
  })
  const preciseFeasible = isPeakDistanceFeasible(candidate, preciseIntent, {
    allowMeaningfulStretch: false,
  })
  const neighborhoodFeasible = isPeakDistanceFeasible(candidate, neighborhoodIntent, {
    allowMeaningfulStretch: false,
  })
  const cityFeasible = isPeakDistanceFeasible(candidate, cityIntent, {
    allowMeaningfulStretch: false,
  })
  const unknownFeasible = isPeakDistanceFeasible(candidate, unknownIntent, {
    allowMeaningfulStretch: false,
  })

  assert.equal(markerlessFeasible, false)
  assert.equal(preciseFeasible, false)
  assert.equal(neighborhoodFeasible, true)
  assert.equal(cityFeasible, true)
  assert.equal(unknownFeasible, true)

  const cityPressure = computeArcWhenSpatialScorePressure({
    intent: cityIntent,
    spatial: buildSpatialFixture(),
    options: {
      whenSpatialScoring: 'soft_curate_spatial',
      whenSignalProfile: buildWalkableWhenProfile(),
    },
  })
  const precisePressure = computeArcWhenSpatialScorePressure({
    intent: preciseIntent,
    spatial: buildSpatialFixture(),
    options: {
      whenSpatialScoring: 'soft_curate_spatial',
      whenSignalProfile: buildWalkableWhenProfile(),
    },
  })
  assert.notEqual(cityPressure.reason, precisePressure.reason)

  return [
    {
      lens: 'legacy markerless',
      marker: 'none/none',
      distanceFeasible: markerlessFeasible,
      note: 'Current runtime callers without origin markers keep canonical nearby strictness.',
    },
    {
      lens: 'precise marker',
      marker: 'precise/geolocation',
      distanceFeasible: preciseFeasible,
      note: 'Precise user origin preserves strict tight walkable claims.',
    },
    {
      lens: 'neighborhood fallback marker',
      marker: 'neighborhood/neighborhood_fallback',
      distanceFeasible: neighborhoodFeasible,
      note: 'Neighborhood fallback softens fake precise strictness to medium origin posture.',
    },
    {
      lens: 'city fallback marker',
      marker: 'city/city_fallback',
      distanceFeasible: cityFeasible,
      note: 'City fallback softens fake precise strictness to broad/soft posture.',
    },
    {
      lens: 'unknown omitted marker',
      marker: 'unknown/unknown',
      distanceFeasible: unknownFeasible,
      note: 'Unknown origin remains softest and does not dead-end route supply.',
    },
  ]
}

function assertPseudoCityCenter(): Record<string, unknown> {
  const location = resolveLocation({ locationQuery: 'Reno, NV' })
  assert.equal(location.originPrecision, 'city')
  assert.equal(location.originSource, 'city_fallback')
  const intent = buildIntent(location.originPrecision, location.originSource)
  const candidate = buildCandidate(24, 0.5)
  const distanceFeasible = isPeakDistanceFeasible(candidate, intent, {
    allowMeaningfulStretch: false,
  })
  const posture = resolveIntentOriginMovementPosture(intent)
  assert.equal(posture?.strictness, 'broad')
  assert.equal(posture?.movementRadiusPosture, 'soft')
  assert.equal(distanceFeasible, true)

  return {
    case: 'parsed pseudo city center',
    marker: `${location.originPrecision}/${location.originSource}`,
    strictness: posture?.strictness,
    radiusPosture: posture?.movementRadiusPosture,
    distanceFeasible,
    note: 'Pseudo city centers are broad/soft and cannot become fake precise movement origins.',
  }
}

function main(): void {
  try {
    const originRows = [
      assertOriginCase({
        case: 'precise geolocation',
        originPrecision: 'precise',
        originSource: 'geolocation',
        driveMinutes: 24,
        proximityFit: 0.5,
        expectedStrictness: 'strict',
        expectedRadiusPosture: 'tight',
        expectedDistanceFeasible: false,
        expectedAdjustedLimit: undefined,
        expectedCaptureNeeded: false,
        expectedAllowsTight: true,
      }),
      assertOriginCase({
        case: 'explicit origin',
        originPrecision: 'precise',
        originSource: 'explicit_origin',
        driveMinutes: 24,
        proximityFit: 0.5,
        expectedStrictness: 'strict',
        expectedRadiusPosture: 'tight',
        expectedDistanceFeasible: false,
        expectedAdjustedLimit: undefined,
        expectedCaptureNeeded: false,
        expectedAllowsTight: true,
      }),
      assertOriginCase({
        case: 'neighborhood fallback',
        originPrecision: 'neighborhood',
        originSource: 'neighborhood_fallback',
        driveMinutes: 24,
        proximityFit: 0.5,
        expectedStrictness: 'medium',
        expectedRadiusPosture: 'medium',
        expectedDistanceFeasible: true,
        expectedAdjustedLimit: 18,
        expectedCaptureNeeded: false,
        expectedAllowsTight: false,
      }),
      assertOriginCase({
        case: 'city fallback',
        originPrecision: 'city',
        originSource: 'city_fallback',
        driveMinutes: 24,
        proximityFit: 0.5,
        expectedStrictness: 'broad',
        expectedRadiusPosture: 'soft',
        expectedDistanceFeasible: true,
        expectedAdjustedLimit: 28,
        expectedCaptureNeeded: false,
        expectedAllowsTight: false,
      }),
      assertOriginCase({
        case: 'unknown / omitted origin',
        originPrecision: 'unknown',
        originSource: 'unknown',
        driveMinutes: 24,
        proximityFit: 0.5,
        expectedStrictness: 'softest',
        expectedRadiusPosture: 'softest',
        expectedDistanceFeasible: true,
        expectedAdjustedLimit: 28,
        expectedCaptureNeeded: true,
        expectedAllowsTight: false,
      }),
    ]
    const twoLensRows = assertTwoLensComparison()
    const pseudoCityRow = assertPseudoCityCenter()
    assert.equal(providerCallCount, 0, 'Chapter A A4 observer must not call providers.')

    console.info('Chapter A A4 origin strictness behavior')
    console.table(originRows)
    console.info('Chapter A A4 two-lens strictness comparison')
    console.table(twoLensRows)
    console.info('Chapter A A4 pseudo-city center behavior')
    console.table([pseudoCityRow])
    console.info(`provider/network calls: ${providerCallCount}`)
  } finally {
    globalThis.fetch = originalFetch
  }
}

main()
