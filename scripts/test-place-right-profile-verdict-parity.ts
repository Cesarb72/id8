import { buildGreatStopGateResult } from '../src/domain/greatStop/buildGreatStopGateResult'
import { buildPlaceRightMovementProfile } from '../src/domain/interpretation/buildPlaceRightMovementProfile'
import type { BearingsPlaceRightVerdict } from '../src/domain/bearings/routePlaceRightContract'
import type { FieldRealVerdict } from '../src/domain/field/fieldRealVerdict'
import type { ArcCandidate, ArcStop } from '../src/domain/types/arc'
import type { RoutePacingDiagnostics } from '../src/domain/types/diagnostics'
import type { BuildLocationClass } from '../src/domain/types/greatStopGate'
import type { IntentProfile, PersonaMode } from '../src/domain/types/intent'

type VerdictStatus = 'pass' | 'fail'

interface ParityCase {
  case: string
  persona: PersonaMode
  locationClass: BuildLocationClass
  verdictStatus: VerdictStatus
}

const personas: PersonaMode[] = ['romantic', 'friends', 'family']
const locationClasses: BuildLocationClass[] = ['L1 Dense', 'L2 Mid', 'L3 Sparse']

const matrixCases: ParityCase[] = [
  { case: 'Build matrix Adega', persona: 'romantic', locationClass: 'L2 Mid', verdictStatus: 'fail' },
  { case: 'Build matrix MINIBOSS', persona: 'friends', locationClass: 'L2 Mid', verdictStatus: 'fail' },
  { case: 'Build matrix Happy Hollow', persona: 'family', locationClass: 'L2 Mid', verdictStatus: 'fail' },
  { case: 'Build matrix Village Grill', persona: 'friends', locationClass: 'L3 Sparse', verdictStatus: 'fail' },
  {
    case: 'Build matrix Evergreen Coffee Company',
    persona: 'romantic',
    locationClass: 'L3 Sparse',
    verdictStatus: 'fail',
  },
  { case: 'Build matrix Alum Rock Park', persona: 'family', locationClass: 'L3 Sparse', verdictStatus: 'fail' },
  { case: 'Build matrix The Tech Interactive', persona: 'family', locationClass: 'L1 Dense', verdictStatus: 'fail' },
  { case: 'Build matrix Haberdasher', persona: 'romantic', locationClass: 'L1 Dense', verdictStatus: 'fail' },
]

const cases: ParityCase[] = [
  ...personas.flatMap((persona) =>
    locationClasses.flatMap((locationClass) => [
      {
        case: `${persona} ${locationClass} representative pass`,
        persona,
        locationClass,
        verdictStatus: 'pass' as const,
      },
      {
        case: `${persona} ${locationClass} representative fail`,
        persona,
        locationClass,
        verdictStatus: 'fail' as const,
      },
    ]),
  ),
  ...matrixCases,
]

const originalFetch = globalThis.fetch
let fetchCallCount = 0

globalThis.fetch = (async (input) => {
  fetchCallCount += 1
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  throw new Error(`Place-Right profile verdict parity observer must not call fetch: ${url}`)
}) as typeof fetch

function fieldRealPass(): FieldRealVerdict {
  return {
    realReady: true,
    status: 'pass',
    identityUsable: true,
    sourceUsable: true,
    provenanceValid: true,
    availabilityKnown: true,
    availabilityStatus: 'available_from_record',
    stalenessStatus: 'current',
    suppressionStatus: 'not_suppressed',
    failureReasons: [],
    stopEvidence: [],
    routeEvidence: {
      stopCount: 3,
      failingStopCount: 0,
      unknownStopCount: 0,
      failureReasons: [],
    },
    provenance: {
      source: 'field',
      evaluatedFrom: 'already_retrieved_record_truth',
      notes: ['synthetic-owner-verdict'],
    },
    compatibility: {
      greatStopRealInputs: {
        realReady: true,
        realVerdict: 'pass',
        realFailureReasons: [],
        unusableStopCount: 0,
        unknownStopCount: 0,
      },
    },
  }
}

function placeRightVerdict(status: VerdictStatus): BearingsPlaceRightVerdict {
  const reasons = status === 'pass' ? [] : ['place_right:synthetic_profile_parity_failure']
  return {
    placeRightReady: true,
    status,
    reasons,
    distanceBurden: {
      status,
      burden: status === 'pass' ? 'low' : 'high',
      reasonCodes: reasons,
      notes: status === 'pass' ? ['total:8', 'max:4'] : ['total:40', 'max:20'],
    },
    movementToleranceFit: { status, reasonCodes: reasons },
    stretchAdmissibility: { status: 'not_applicable', reasonCodes: [] },
    supportProximityVerdict: { status, reasonCodes: reasons },
    supportSupplyBuildabilityVerdict: { status, reasonCodes: reasons },
    requiredStopSurvivalVerdict: { status, reasonCodes: reasons },
    openClosedViabilityVerdict: { status: 'pass', reasonCodes: [] },
    stopEvidence: [],
    routeEvidence: {
      status,
      distanceBurden: {
        status,
        burden: status === 'pass' ? 'low' : 'high',
        reasonCodes: reasons,
        notes: status === 'pass' ? ['total:8', 'max:4'] : ['total:40', 'max:20'],
      },
      movementToleranceFit: { status, reasonCodes: reasons },
      stretchAdmissibility: { status: 'not_applicable', reasonCodes: [] },
      supportProximity: { status, reasonCodes: reasons },
      supportSupplyBuildability: { status, reasonCodes: reasons },
      requiredStopSurvival: { status, reasonCodes: reasons },
      openClosedViability: { status: 'pass', reasonCodes: [] },
      reasonCodes: reasons,
    },
    compatibility: {
      greatStopPlaceRightStatus: status,
      greatStopPlaceRightReasonCodes: reasons,
    },
    provenance: {
      source: 'bearings',
      version: 'synthetic-owner-verdict',
      notes: ['synthetic-owner-verdict'],
    },
  }
}

function buildStop(params: {
  role: ArcStop['role']
  venueId: string
  lane: string
  energy: number
}): ArcStop {
  const roleScore = 0.82
  const shapeScore = 0.82
  const contextSpecificity = 0.82
  return {
    role: params.role,
    scoredVenue: {
      venue: {
        id: params.venueId,
        name: params.venueId,
        city: 'San Jose',
        neighborhood: 'a',
        driveMinutes: 4,
        category: 'abstract',
        subcategory: 'abstract',
        priceTier: '$$',
        tags: [],
        useCases: [],
        vibeTags: [],
        energyLevel: params.energy,
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
        roleAffinity: {
          warmup: roleScore,
          peak: roleScore,
          wildcard: roleScore,
          cooldown: roleScore,
        },
        imageUrl: '',
        shortDescription: '',
        narrativeFlavor: '',
        isHiddenGem: false,
        isActive: true,
        highlightCapable: true,
        durationProfile: {} as never,
        settings: {} as never,
        signature: {} as never,
        source: {
          sourceOrigin: 'curated',
        } as never,
      },
      candidateIdentity: {
        candidateId: params.venueId,
        baseVenueId: params.venueId,
        kind: 'base',
        traceLabel: params.venueId,
      },
      momentIdentity: {
        type: params.role === 'peak' ? 'anchor' : params.role === 'warmup' ? 'arrival' : 'close',
        strength: params.role === 'peak' ? 'strong' : 'medium',
      },
      fitBreakdown: {} as never,
      fitScore: 0.82,
      hiddenGemScore: 0.5,
      lensCompatibility: 0.82,
      contextSpecificity: {
        overall: contextSpecificity,
        personaSignal: contextSpecificity,
        vibeSignal: contextSpecificity,
        lensSignal: contextSpecificity,
        byRole: {
          warmup: contextSpecificity,
          peak: contextSpecificity,
          wildcard: contextSpecificity,
          cooldown: contextSpecificity,
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
      stopShapeFit: {
        start: shapeScore,
        highlight: shapeScore,
        surprise: shapeScore,
        windDown: shapeScore,
      },
      vibeAuthority: {} as never,
      highlightValidity: {} as never,
      roleScores: {
        warmup: roleScore,
        peak: roleScore,
        wildcard: roleScore,
        cooldown: roleScore,
      },
      taste: {
        signals: {} as never,
        modeAlignment: {
          score: 0.82,
          penalty: 0,
          lane: params.lane as never,
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

function buildCandidate(caseName: string): ArcCandidate {
  const id = caseName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const stops = [
    buildStop({ role: 'warmup', venueId: `${id}-start`, lane: 'arrival', energy: 2 }),
    buildStop({ role: 'peak', venueId: `${id}-highlight`, lane: 'center', energy: 4 }),
    buildStop({ role: 'cooldown', venueId: `${id}-winddown`, lane: 'landing', energy: 2 }),
  ]
  return {
    id,
    stops,
    totalScore: 0.9,
    scoreBreakdown: {
      roleFlowScore: 0.82,
      diversityScore: 0.82,
      geographyScore: 0.82,
      hiddenGemLift: 0,
      windDownScore: 0.82,
      highlightMomentScore: 0.82,
      momentStrengthScore: 0.82,
      momentFlatPenalty: 0,
      strongMomentPresent: true,
      momentQualityNote: 'Strong center',
    },
    pacing: {} as never,
    spatial: {
      mode: 'flexible',
      homeClusterId: 'a',
      clustersVisited: ['a'],
      clusterAssignments: stops.map((stop) => ({
        venueId: stop.scoredVenue.venue.id,
        venueName: stop.scoredVenue.venue.name,
        neighborhood: 'a',
        clusterId: 'a',
      })),
      transitions: [],
      sameClusterTransitionCount: 2,
      clusterEscapeCount: 0,
      repeatedClusterEscapeCount: 0,
      longTransitionCount: 0,
      jumpUsed: false,
      spatialBonus: 0.1,
      spatialPenalty: 0,
      score: 0.9,
      notes: [],
    },
    hasWildcard: false,
  }
}

function buildRoutePacing(): RoutePacingDiagnostics {
  return {
    transitions: [
      {
        fromRole: 'start',
        toRole: 'highlight',
        fromVenueId: 'start',
        toVenueId: 'highlight',
        estimatedTravelMinutes: 4,
        transitionBufferMinutes: 0,
        estimatedTransitionMinutes: 4,
        frictionScore: 0.1,
        movementMode: 'walkable',
        neighborhoodContinuity: 'same-neighborhood',
        notes: [],
      },
      {
        fromRole: 'highlight',
        toRole: 'windDown',
        fromVenueId: 'highlight',
        toVenueId: 'winddown',
        estimatedTravelMinutes: 4,
        transitionBufferMinutes: 0,
        estimatedTransitionMinutes: 4,
        frictionScore: 0.1,
        movementMode: 'walkable',
        neighborhoodContinuity: 'same-neighborhood',
        notes: [],
      },
    ],
    totalRouteFriction: 0.1,
    estimatedStopMinutes: 120,
    estimatedTransitionMinutes: 8,
    estimatedTotalMinutes: 128,
    estimatedTotalLabel: '2h',
    routeFeelLabel: 'balanced',
    pacingPenaltyApplied: false,
    pacingPenaltyReasons: [],
    smoothProgressionRewardApplied: true,
    smoothProgressionRewardReasons: ['synthetic smooth route'],
  }
}

function buildIntent(testCase: ParityCase, anchorVenueId: string): IntentProfile {
  return {
    crew:
      testCase.persona === 'romantic'
        ? 'romantic'
        : testCase.persona === 'family'
          ? 'curator'
          : 'socialite',
    persona: testCase.persona,
    primaryAnchor:
      testCase.persona === 'family' ? 'playful' : testCase.persona === 'romantic' ? 'cozy' : 'lively',
    city: 'San Jose',
    distanceMode: testCase.locationClass === 'L1 Dense' ? 'nearby' : 'short-drive',
    mode: 'build',
    planningMode: 'user-led',
    anchor: {
      venueId: anchorVenueId,
      role: 'highlight',
    },
    refinementModes: [],
  } as IntentProfile
}

function stable(value: unknown): string {
  return JSON.stringify(value)
}

function placeDiagnostics(result: ReturnType<typeof buildGreatStopGateResult>) {
  return {
    preset: result.preset,
    criterion: result.criteria.placeRight,
    movement: result.diagnostics.movement,
    clusterCoherence: result.diagnostics.clusterCoherence,
    zigzagOrBacktrack: result.diagnostics.zigzagOrBacktrack,
  }
}

try {
  const rows = cases.map((testCase) => {
    const candidate = buildCandidate(testCase.case)
    const peakVenueId = candidate.stops.find((stop) => stop.role === 'peak')!.scoredVenue.venue.id
    const intent = buildIntent(testCase, peakVenueId)
    const common = {
      selectedArc: candidate,
      intent,
      routePacing: buildRoutePacing(),
      placeRightVerdict: placeRightVerdict(testCase.verdictStatus),
      fieldRealVerdict: fieldRealPass(),
      locationClass: testCase.locationClass,
      locationClassSource: 'explicit' as const,
    }
    const oldResult = buildGreatStopGateResult(common)
    const newResult = buildGreatStopGateResult({
      ...common,
      placeRightTolerance: buildPlaceRightMovementProfile({
        persona: testCase.persona,
        locationClass: testCase.locationClass,
      }),
    })
    const oldDiagnostics = placeDiagnostics(oldResult)
    const newDiagnostics = placeDiagnostics(newResult)
    const verdictMatch =
      oldResult.status === newResult.status &&
      stable(oldResult.failedCriteria) === stable(newResult.failedCriteria) &&
      stable(oldResult.reasons) === stable(newResult.reasons) &&
      stable(oldResult.criteria.placeRight) === stable(newResult.criteria.placeRight)
    const diagnosticsMatch = stable(oldDiagnostics) === stable(newDiagnostics)
    return {
      case: testCase.case,
      persona: testCase.persona,
      locationClass: testCase.locationClass,
      oldVerdict: oldResult.criteria.placeRight.passed ? 'PASS' : 'FAIL',
      newVerdict: newResult.criteria.placeRight.passed ? 'PASS' : 'FAIL',
      oldDiagnostics,
      newDiagnostics,
      verdictMatch,
      diagnosticsMatch,
      match: verdictMatch && diagnosticsMatch,
    }
  })

  const mismatches = rows.filter((row) => !row.match)
  const verdictMismatches = rows.filter((row) => !row.verdictMatch)
  const diagnosticMismatches = rows.filter((row) => !row.diagnosticsMatch)

  console.log(
    JSON.stringify(
      {
        summary: {
          totalCases: rows.length,
          verdictMismatches: verdictMismatches.length,
          diagnosticMismatches: diagnosticMismatches.length,
          mismatches: mismatches.length,
          providerCalls: fetchCallCount,
        },
        rows,
      },
      null,
      2,
    ),
  )

  if (mismatches.length > 0) {
    throw new Error('Place-Right profile verdict/diagnostic parity drift detected.')
  }
} finally {
  globalThis.fetch = originalFetch
}
