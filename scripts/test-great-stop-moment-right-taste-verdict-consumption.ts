import { readFileSync } from 'node:fs'

import { buildGreatStopGateResult } from '../src/domain/greatStop/buildGreatStopGateResult'
import type { TasteRouteMomentVerdict } from '../src/domain/interpretation/taste/routeMomentVerdict'
import type { ArcCandidate, ArcStop } from '../src/domain/types/arc'
import type { RoutePacingDiagnostics } from '../src/domain/types/diagnostics'
import type { IntentProfile } from '../src/domain/types/intent'

let fetchCallCount = 0
globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
  fetchCallCount += 1
  throw new Error(`Unexpected fetch in Great Stop moment-right consumption proof: ${String(args[0])}`)
}) as typeof fetch

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function tasteMomentVerdict(params: {
  strongMomentPresent: boolean
  flatArcRiskPenalty: number
  momentPreservationStatus?: TasteRouteMomentVerdict['momentPreservationStatus']
}): TasteRouteMomentVerdict {
  const flatArcRiskLevel = params.flatArcRiskPenalty > 0 ? 'medium' : 'none'
  const momentPreservationStatus =
    params.momentPreservationStatus ??
    (params.flatArcRiskPenalty > 0
      ? 'flat'
      : params.strongMomentPresent
        ? 'preserved'
        : 'missed')

  return {
    source: 'taste',
    provenance: [
      {
        source: 'taste',
        key: 'moment_right_consumption_proof',
        reason: 'Retained TasteRouteMomentVerdict consumed by Great Stop.',
      },
    ],
    peakCandidateVenueId: 'peak',
    anchorAsPeakCandidacy: params.strongMomentPresent ? 'intended_peak' : 'unknown',
    peakSuitability: {
      score: params.strongMomentPresent ? 0.86 : 0.18,
      tier: params.strongMomentPresent ? 'strong' : 'standard',
    },
    momentStrengthVerdict: {
      strength: params.strongMomentPresent ? 'strong' : 'light',
      score: params.strongMomentPresent ? 0.86 : 0.18,
      reason: params.strongMomentPresent ? 'Taste strong peak retained.' : 'Taste found no strong peak.',
    },
    momentPreservationStatus,
    strongMomentPresent: params.strongMomentPresent,
    flatArcRisk: {
      level: flatArcRiskLevel,
      score: params.flatArcRiskPenalty,
      varianceScore: params.flatArcRiskPenalty > 0 ? 0.2 : 0.82,
      penalty: params.flatArcRiskPenalty,
      reasons: params.flatArcRiskPenalty > 0 ? ['moment_right:taste_flat_arc_risk'] : [],
    },
    missedPeakReason: {
      applied: false,
      code: 'none',
    },
    availableMomentEvidence: {
      availableHighMomentCount: params.strongMomentPresent ? 1 : 0,
      availableStrongMomentCount: params.strongMomentPresent ? 1 : 0,
      highMomentVenueIds: params.strongMomentPresent ? ['peak'] : [],
      strongMomentVenueIds: params.strongMomentPresent ? ['peak'] : [],
    },
    peakRoleEvidence: {
      candidateVenueId: 'peak',
      roleFitScore: 0.92,
      stopShapeFitScore: 0.88,
      highlightValidity: 'valid',
    },
    anchorStrengthEvidence: {
      candidateVenueId: 'peak',
      anchorStrength: params.strongMomentPresent ? 0.91 : 0.24,
      momentIdentityType: 'anchor',
      momentIdentityStrength: params.strongMomentPresent ? 'strong' : 'light',
      momentPotentialScore: params.strongMomentPresent ? 0.86 : 0.18,
      momentIntensityScore: params.strongMomentPresent ? 0.86 : 0.18,
    },
    momentQualityNote: params.strongMomentPresent
      ? 'Taste strong peak retained.'
      : 'Taste found no strong peak.',
  }
}

function stop(role: ArcStop['role'], venueId: string, energyLevel: number): ArcStop {
  return {
    role,
    scoredVenue: {
      candidateIdentity: {
        kind: 'base',
        candidateId: venueId,
        baseVenueId: venueId,
        traceLabel: venueId,
      },
      venue: {
        id: venueId,
        name: venueId,
        energyLevel,
        source: {
          sourceOrigin: 'curated',
          sourceConfidence: 1,
          openNow: true,
          businessStatus: 'operational',
        },
      },
      fitScore: 0.9,
      lensCompatibility: 0.9,
      contextSpecificity: {
        overall: 0.9,
      },
      roleScores: {
        warmup: role === 'warmup' ? 0.9 : 0.7,
        peak: role === 'peak' ? 0.9 : 0.7,
        wildcard: 0.7,
        cooldown: role === 'cooldown' ? 0.9 : 0.7,
      },
      stopShapeFit: {
        start: role === 'warmup' ? 0.9 : 0.7,
        highlight: role === 'peak' ? 0.9 : 0.7,
        surprise: 0.7,
        windDown: role === 'cooldown' ? 0.9 : 0.7,
      },
      taste: {
        modeAlignment: {
          lane: role,
        },
      },
    },
  } as ArcStop
}

function candidate(params: {
  id: string
  routeMomentVerdict?: TasteRouteMomentVerdict
  scalarStrongMomentPresent: boolean
  scalarMomentFlatPenalty: number
}): ArcCandidate {
  return {
    id: params.id,
    stops: [stop('warmup', 'start', 2), stop('peak', 'peak', 4), stop('cooldown', 'end', 1)],
    totalScore: 0.8,
    scoreBreakdown: {
      roleFlowScore: 0.8,
      diversityScore: 0.8,
      geographyScore: 0.8,
      hiddenGemLift: 0,
      windDownScore: 0.8,
      highlightMomentScore: params.scalarStrongMomentPresent ? 0.9 : 0.1,
      momentStrengthScore: params.scalarStrongMomentPresent ? 0.9 : 0.1,
      momentFlatPenalty: params.scalarMomentFlatPenalty,
      routeMomentVerdict: params.routeMomentVerdict,
      strongMomentPresent: params.scalarStrongMomentPresent,
      momentQualityNote: params.scalarStrongMomentPresent
        ? 'Scalar says strong.'
        : 'Scalar says weak.',
    },
    pacing: {} as ArcCandidate['pacing'],
    spatial: {
      score: 1,
      notes: [],
      transitions: [],
      clusterAssignments: [],
      clusterEscapeCount: 0,
      repeatedClusterEscapeCount: 0,
      longTransitionCount: 0,
    } as ArcCandidate['spatial'],
    hasWildcard: false,
  }
}

const intent = {
  mode: 'build',
  city: 'San Jose',
  persona: 'friends',
  distanceMode: 'nearby',
  planningMode: 'user-led',
  refinementModes: [],
} as IntentProfile

const routePacing = {
  transitions: [],
  totalRouteFriction: 0,
  estimatedStopMinutes: 90,
  estimatedTransitionMinutes: 0,
  estimatedTotalMinutes: 90,
  estimatedTotalLabel: '90m',
  routeFeelLabel: 'proof',
  pacingPenaltyApplied: false,
  pacingPenaltyReasons: [],
  smoothProgressionRewardApplied: true,
  smoothProgressionRewardReasons: [],
} as RoutePacingDiagnostics

const tastePassScalarFail = buildGreatStopGateResult({
  selectedArc: candidate({
    id: 'taste-pass-scalar-fail',
    routeMomentVerdict: tasteMomentVerdict({
      strongMomentPresent: true,
      flatArcRiskPenalty: 0,
    }),
    scalarStrongMomentPresent: false,
    scalarMomentFlatPenalty: 0.9,
  }),
  intent,
  routePacing,
})

assert(
  tastePassScalarFail.criteria.momentRight.passed === true,
  'Moment-Right must pass from retained Taste verdict even when scalar remnants say fail.',
)
assert(
  tastePassScalarFail.diagnostics.strongMoment.note === 'Taste strong peak retained.',
  'Moment-Right diagnostics must project retained Taste verdict detail.',
)

const tasteFailScalarPass = buildGreatStopGateResult({
  selectedArc: candidate({
    id: 'taste-fail-scalar-pass',
    routeMomentVerdict: tasteMomentVerdict({
      strongMomentPresent: false,
      flatArcRiskPenalty: 0,
    }),
    scalarStrongMomentPresent: true,
    scalarMomentFlatPenalty: 0,
  }),
  intent,
  routePacing,
})

assert(
  tasteFailScalarPass.criteria.momentRight.passed === false,
  'Moment-Right must fail from retained Taste verdict even when scalar remnants say pass.',
)
assert(
  tasteFailScalarPass.criteria.momentRight.reasons.join('|') ===
    'moment_right:no_strong_main_moment',
  'No-strong-moment reason must be sourced from retained Taste verdict truth.',
)

const tasteFlatRisk = buildGreatStopGateResult({
  selectedArc: candidate({
    id: 'taste-flat-risk',
    routeMomentVerdict: tasteMomentVerdict({
      strongMomentPresent: true,
      flatArcRiskPenalty: 0.12,
    }),
    scalarStrongMomentPresent: true,
    scalarMomentFlatPenalty: 0,
  }),
  intent,
  routePacing,
})

assert(
  tasteFlatRisk.criteria.momentRight.reasons.includes('moment_right:taste_flat_arc_risk'),
  'Flat-arc reason must be sourced from retained Taste verdict risk.',
)

const tasteUnknown = buildGreatStopGateResult({
  selectedArc: candidate({
    id: 'taste-unknown',
    routeMomentVerdict: tasteMomentVerdict({
      strongMomentPresent: true,
      flatArcRiskPenalty: 0,
      momentPreservationStatus: 'unknown',
    }),
    scalarStrongMomentPresent: true,
    scalarMomentFlatPenalty: 0,
  }),
  intent,
  routePacing,
})

assert(
  tasteUnknown.criteria.momentRight.reasons.includes('moment_right:taste_verdict_unknown'),
  'Unavailable Taste moment state must remain explicit and must not be converted into a pass.',
)

const missingTasteVerdict = buildGreatStopGateResult({
  selectedArc: candidate({
    id: 'missing-taste-verdict',
    scalarStrongMomentPresent: true,
    scalarMomentFlatPenalty: 0,
  }),
  intent,
  routePacing,
})

assert(
  missingTasteVerdict.criteria.momentRight.reasons.join('|') ===
    'moment_right:taste_verdict_missing',
  'Missing Taste verdict must not fall back to scalar moment remnants.',
)

const gateSource = readFileSync('src/domain/greatStop/buildGreatStopGateResult.ts', 'utf8')
const evaluateMomentRightSource = gateSource.slice(
  gateSource.indexOf('function evaluateMomentRight'),
  gateSource.indexOf('function creditedAnchorRole'),
)

assert(
  evaluateMomentRightSource.includes('candidate.scoreBreakdown.routeMomentVerdict'),
  'Great Stop must consume retained TasteRouteMomentVerdict from the candidate wire.',
)
assert(
  !evaluateMomentRightSource.includes('candidate.scoreBreakdown.strongMomentPresent') &&
    !evaluateMomentRightSource.includes('candidate.scoreBreakdown.momentFlatPenalty') &&
    !evaluateMomentRightSource.includes('candidate.scoreBreakdown.momentQualityNote') &&
    !evaluateMomentRightSource.includes('candidate.scoreBreakdown.momentStrengthScore'),
  'Great Stop Moment-Right must not infer lifecycle state from scalar scoreBreakdown remnants.',
)

assert(fetchCallCount === 0, `Expected provider fetch count 0, got ${fetchCallCount}.`)

process.stdout.write(
  JSON.stringify(
    {
      proof: 'great_stop_moment_right_taste_verdict_consumption',
      scalarInferenceBypassed: true,
      missingEvidenceExplicit: true,
      retainedTasteProvenance:
        tastePassScalarFail.criteria.momentRight.passed &&
        tasteFailScalarPass.criteria.momentRight.reasons.includes(
          'moment_right:no_strong_main_moment',
        ),
      providerCallsAttempted: fetchCallCount,
    },
    null,
    2,
  ),
)
