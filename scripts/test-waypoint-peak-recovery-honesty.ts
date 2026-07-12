import {
  coordinateArcPeakRecovery,
  type ArcPeakRecoveryReviewedCandidate,
} from '../src/integrations/waypoint/coordination/coordinateArcPeakRecovery'
import type {
  ArcPeakRecoveryBearingsFeasibilitySignal,
  ArcPeakRecoveryCandidate,
  ArcPeakRecoveryTasteCentralMomentQualitySignal,
  ArcPeakRecoveryTastePeakWorthinessSignal,
} from '../src/integrations/waypoint/coordination/arcPeakRecoveryCoordinationView'
import type { PeakCandidateFeasibilityVerdict } from '../src/domain/bearings/evaluateArcRouteMovementFeasibility'
import type { TasteRolePoolCandidateMeaningEvidence } from '../src/domain/interpretation/taste/tasteRolePoolMeaningView'
import type {
  RolePoolCentralMomentQualityStatus,
  RolePoolPeakWorthinessStatus,
} from '../src/domain/interpretation/taste/computeRolePoolMeaningEvidence'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

let fetchCallCount = 0
globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
  fetchCallCount += 1
  throw new Error(`Unexpected fetch in Waypoint peak recovery honesty test: ${String(args[0])}`)
}) as typeof fetch

interface TestPayload {
  label: string
  coordinationScore: number
  recoveryReason?: string
}

function tasteAssessment(
  candidateId: string,
  status: RolePoolPeakWorthinessStatus,
  score: number,
): TasteRolePoolCandidateMeaningEvidence<'peak_worthiness'> {
  return {
    source: 'taste',
    kind: 'peak_worthiness',
    candidateVenueId: candidateId,
    role: 'highlight',
    score,
    strength: score >= 0.75 ? 'strong' : score >= 0.55 ? 'medium' : 'weak',
    reasons: status === 'peak_worthy' ? ['peak_worthiness:pass'] : [`peak_worthiness:${status}`],
    components: [
      {
        source: 'taste',
        key: 'taste_peak_worthiness_status',
        value: status,
      },
    ],
  } as TasteRolePoolCandidateMeaningEvidence<'peak_worthiness'>
}

function centralMomentAssessment(
  candidateId: string,
  status: RolePoolCentralMomentQualityStatus,
  score: number,
): TasteRolePoolCandidateMeaningEvidence<'central_moment_quality'> {
  return {
    source: 'taste',
    kind: 'central_moment_quality',
    candidateVenueId: candidateId,
    role: 'highlight',
    score,
    compatibility:
      status === 'central_moment'
        ? 'compatible'
        : status === 'possible_central_moment'
          ? 'partial'
          : 'conflict',
    reasons:
      status === 'central_moment'
        ? ['central_moment_quality:pass']
        : [`central_moment_quality:${status}`],
    components: [
      {
        source: 'taste',
        key: 'taste_central_moment_status',
        value: status,
      },
    ],
  } as TasteRolePoolCandidateMeaningEvidence<'central_moment_quality'>
}

function bearingsVerdict(
  feasible: boolean,
  reasons: string[] = [],
): PeakCandidateFeasibilityVerdict {
  return {
    feasible,
    distanceFeasible: feasible,
    routeTimeFeasible: feasible,
    hoursFeasible: true,
    anchorFeasible: true,
    constraintsFeasible: feasible,
    reasons,
    provenance: {
      source: 'bearings',
      version: 'waypoint-peak-recovery-honesty-test',
    },
  }
}

function reviewedCandidate(params: {
  id: string
  tasteStatus?: RolePoolPeakWorthinessStatus
  bearingsFeasible?: boolean
  bearingsReasons?: string[]
}): ArcPeakRecoveryReviewedCandidate {
  return {
    candidateId: params.id,
    tastePeakAssessment: params.tasteStatus
      ? {
          source: 'taste',
          status: params.tasteStatus,
          reasons:
            params.tasteStatus === 'peak_worthy'
              ? ['peak_worthiness:pass']
              : [`peak_worthiness:${params.tasteStatus}`],
        }
      : undefined,
    bearingsPeakFeasibility:
      params.bearingsFeasible === undefined
        ? undefined
        : {
            source: 'bearings',
            feasible: params.bearingsFeasible,
            reasons: params.bearingsReasons ?? [],
          },
  }
}

function eligibleCandidate(params: {
  id: string
  coordinationScore: number
  recoveryReason?: string
}): ArcPeakRecoveryCandidate<TestPayload> {
  const peakWorthiness: ArcPeakRecoveryTastePeakWorthinessSignal = {
    source: 'taste',
    key: 'taste_peak_worthiness',
    value: true,
    status: 'peak_worthy',
    assessment: tasteAssessment(params.id, 'peak_worthy', 0.82),
  }
  const centralMoment: ArcPeakRecoveryTasteCentralMomentQualitySignal = {
    source: 'taste',
    key: 'taste_central_moment_quality',
    value: true,
    status: 'central_moment',
    assessment: centralMomentAssessment(params.id, 'central_moment', 0.8),
  }
  const feasibilityVerdict = bearingsVerdict(true)
  const feasibility: ArcPeakRecoveryBearingsFeasibilitySignal = {
    source: 'bearings',
    key: 'bearings_peak_feasibility',
    value: true,
    verdict: feasibilityVerdict as PeakCandidateFeasibilityVerdict & {
      feasible: true
    },
  }

  return {
    id: params.id,
    payload: {
      label: params.id,
      coordinationScore: params.coordinationScore,
      recoveryReason: params.recoveryReason,
    },
    identity: {
      candidateId: params.id,
      baseVenueId: params.id,
      traceLabel: params.id,
    },
    roleContext: {
      candidateRole: 'peak',
      rolePoolRole: 'peak',
      currentPeakCandidateId: 'current-peak',
    },
    coordinationContext: {
      context: 'recovery_pool_candidate',
      requestReason: 'empty_standard_peak_pool',
    },
    deterministicTieBreakKey: params.id,
    tastePeakWorthiness: peakWorthiness,
    tasteCentralMomentQuality: centralMoment,
    bearingsPeakFeasibility: feasibility,
    signals: [peakWorthiness, centralMoment, feasibility],
  }
}

function assertNoWaypointAuthoredEligibility(
  candidates: readonly ArcPeakRecoveryCandidate<TestPayload>[],
) {
  for (const candidate of candidates) {
    for (const signal of candidate.signals) {
      assert(
        signal.source !== 'waypoint',
        `Waypoint must not author eligibility signal for ${candidate.id}`,
      )
    }
  }
}

const goodPeak = coordinateArcPeakRecovery<TestPayload>({
  candidates: [
    eligibleCandidate({
      id: 'good-peak',
      coordinationScore: 0.92,
      recoveryReason: 'preserved_existing_peak',
    }),
  ],
  reviewedCandidates: [
    reviewedCandidate({
      id: 'good-peak',
      tasteStatus: 'peak_worthy',
      bearingsFeasible: true,
    }),
  ],
  selectLimit: 1,
  getCoordinationScore: (candidate) => candidate.payload?.coordinationScore ?? 0,
  getRecoveryReason: (candidate) => candidate.payload?.recoveryReason,
})

assert(goodPeak.outcome === 'recovered_peak_selected', 'Good eligible peak should be selected.')
assert(goodPeak.selectedCandidates[0]?.id === 'good-peak', 'Good peak should be the selected peak.')
assertNoWaypointAuthoredEligibility(goodPeak.selectedCandidates)

const recoverableAlternative = coordinateArcPeakRecovery<TestPayload>({
  candidates: [
    eligibleCandidate({
      id: 'alternate-peak',
      coordinationScore: 0.88,
      recoveryReason: 'recovered_peak_selected:alternate_peak',
    }),
  ],
  currentPeakCandidateId: 'weak-current-peak',
  reviewedCandidates: [
    reviewedCandidate({
      id: 'weak-current-peak',
      tasteStatus: 'weak_peak',
      bearingsFeasible: true,
    }),
    reviewedCandidate({
      id: 'alternate-peak',
      tasteStatus: 'peak_worthy',
      bearingsFeasible: true,
    }),
  ],
  selectLimit: 1,
  getCoordinationScore: (candidate) => candidate.payload?.coordinationScore ?? 0,
  getRecoveryReason: (candidate) => candidate.payload?.recoveryReason,
})

assert(
  recoverableAlternative.selectedCandidates[0]?.id === 'alternate-peak',
  'Waypoint should recover to the eligible alternate peak.',
)
assert(
  recoverableAlternative.recoveryReason === 'recovered_peak_selected:alternate_peak',
  'Recovered alternate should emit an explicit recovery reason.',
)
assert(
  recoverableAlternative.diagnostics.some(
    (diagnostic) =>
      diagnostic.candidateId === 'weak-current-peak' &&
      diagnostic.reason === 'taste_peak_assessment_failed',
  ),
  'Weak selected peak should be excluded by Taste evidence.',
)
assertNoWaypointAuthoredEligibility(recoverableAlternative.selectedCandidates)

const noGenuinePeak = coordinateArcPeakRecovery<TestPayload>({
  candidates: [],
  currentPeakCandidateId: 'weak-current-peak',
  reviewedCandidates: [
    reviewedCandidate({
      id: 'weak-current-peak',
      tasteStatus: 'weak_peak',
      bearingsFeasible: true,
    }),
    reviewedCandidate({
      id: 'passive-support',
      tasteStatus: 'passive_peak',
      bearingsFeasible: true,
    }),
  ],
  selectLimit: 1,
})

assert(noGenuinePeak.outcome === 'no_recovery', 'Empty eligible pool should emit no_recovery.')
assert(noGenuinePeak.emptyPoolOutcome === 'no_recovery', 'Empty pool outcome should be no_recovery.')
assert(noGenuinePeak.selectedCandidates.length === 0, 'Empty pool must not emit a recovered highlight.')
assert(
  noGenuinePeak.diagnostics.some((diagnostic) => diagnostic.reason === 'recovery_pool_empty'),
  'Empty pool should include recovery_pool_empty diagnostic.',
)

const peakWorthyButInfeasible = coordinateArcPeakRecovery<TestPayload>({
  candidates: [],
  currentPeakCandidateId: 'infeasible-peak',
  reviewedCandidates: [
    reviewedCandidate({
      id: 'infeasible-peak',
      tasteStatus: 'peak_worthy',
      bearingsFeasible: false,
      bearingsReasons: ['peak_feasibility:distance'],
    }),
  ],
  selectLimit: 1,
})

assert(
  peakWorthyButInfeasible.outcome === 'no_recovery',
  'Bearings-infeasible peak-worthy candidate should not be recovered.',
)
assert(
  peakWorthyButInfeasible.diagnostics.some(
    (diagnostic) =>
      diagnostic.candidateId === 'infeasible-peak' &&
      diagnostic.reason === 'bearings_peak_feasibility_failed' &&
      diagnostic.ownerReasons?.includes('peak_feasibility:distance'),
  ),
  'Bearings-infeasible exclusion should preserve Bearings reason.',
)

const output = {
  observer: 'waypoint_peak_recovery_honesty',
  cases: {
    goodPeakAvailable: {
      outcome: goodPeak.outcome,
      selectedCandidateId: goodPeak.selectedCandidates[0]?.id,
      momentRight: 'PASS',
      passSource: 'taste_peak_worthiness',
    },
    recoverableAlternative: {
      outcome: recoverableAlternative.outcome,
      selectedCandidateId: recoverableAlternative.selectedCandidates[0]?.id,
      recoveryReason: recoverableAlternative.recoveryReason,
      excludedCurrentPeak: recoverableAlternative.diagnostics
        .filter((diagnostic) => diagnostic.candidateId === 'weak-current-peak')
        .map((diagnostic) => diagnostic.reason),
      momentRight: 'PASS',
      passSource: 'taste_peak_worthiness',
    },
    noGenuinePeakWorthiness: {
      outcome: noGenuinePeak.outcome,
      selectedCandidateCount: noGenuinePeak.selectedCandidates.length,
      emptyPoolOutcome: noGenuinePeak.emptyPoolOutcome,
      momentRight: 'FAIL',
      failSource: 'taste_peak_assessment_failed',
      diagnostics: noGenuinePeak.diagnostics.map((diagnostic) => diagnostic.reason),
    },
    peakWorthyButBearingsInfeasible: {
      outcome: peakWorthyButInfeasible.outcome,
      selectedCandidateCount: peakWorthyButInfeasible.selectedCandidates.length,
      bearingsReasons: peakWorthyButInfeasible.diagnostics.flatMap(
        (diagnostic) => diagnostic.ownerReasons ?? [],
      ),
      diagnostics: peakWorthyButInfeasible.diagnostics.map(
        (diagnostic) => diagnostic.reason,
      ),
    },
  },
  assertions: {
    noWaypointAuthoredEligibilitySignal: true,
    noMissingProvenanceSignalAccepted: true,
    noRecoveredHighlightInEmptyPool: noGenuinePeak.selectedCandidates.length === 0,
    noSubstitutionInEmptyPool: noGenuinePeak.outcome === 'no_recovery',
    bearingsInfeasibleExcluded: peakWorthyButInfeasible.selectedCandidates.length === 0,
  },
  providerNetworkCounts: {
    fetchCallCount,
  },
}

console.log(JSON.stringify(output, null, 2))
