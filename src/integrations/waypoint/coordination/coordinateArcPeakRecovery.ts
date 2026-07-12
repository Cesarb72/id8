import type {
  ArcPeakRecoveryAdapterInput,
  ArcPeakRecoveryCandidate,
  ArcPeakRecoveryPoolView,
} from './arcPeakRecoveryCoordinationView'

export type ArcPeakRecoveryDiagnosticReason =
  | 'taste_peak_assessment_missing'
  | 'taste_peak_assessment_failed'
  | 'bearings_peak_feasibility_missing'
  | 'bearings_peak_feasibility_failed'
  | 'recovery_pool_empty'
  | 'recovered_peak_selected'

export interface ArcPeakRecoveryExcludedCandidateDiagnostic {
  candidateId: string
  reason: ArcPeakRecoveryDiagnosticReason
  ownerSource?: 'taste' | 'bearings'
  ownerReasons?: readonly string[]
}

export interface ArcPeakRecoveryReviewedCandidate {
  candidateId: string
  tastePeakAssessment?:
    | {
        source: 'taste'
        status: 'peak_worthy'
        reasons?: readonly string[]
      }
    | {
        source: 'taste'
        status: Exclude<string, 'peak_worthy'>
        reasons?: readonly string[]
      }
  bearingsPeakFeasibility?:
    | {
        source: 'bearings'
        feasible: true
        reasons?: readonly string[]
      }
    | {
        source: 'bearings'
        feasible: false
        reasons?: readonly string[]
      }
}

export interface CoordinateArcPeakRecoveryInput<TPayload = unknown>
  extends ArcPeakRecoveryAdapterInput<TPayload> {
  selectLimit?: number
  reviewedCandidates?: readonly ArcPeakRecoveryReviewedCandidate[]
  getCoordinationScore?: (
    candidate: ArcPeakRecoveryCandidate<TPayload>,
  ) => number
  getRecoveryReason?: (
    candidate: ArcPeakRecoveryCandidate<TPayload>,
  ) => string | undefined
}

export interface CoordinateArcPeakRecoveryResult<TPayload = unknown> {
  pool: ArcPeakRecoveryPoolView<TPayload>
  selectedCandidates: readonly ArcPeakRecoveryCandidate<TPayload>[]
  outcome: 'recovered_peak_selected' | 'no_recovery'
  emptyPoolOutcome?: 'no_recovery'
  recoveryReason?: string
  diagnostics: readonly ArcPeakRecoveryExcludedCandidateDiagnostic[]
}

function buildPoolView<TPayload>(
  input: ArcPeakRecoveryAdapterInput<TPayload>,
): ArcPeakRecoveryPoolView<TPayload> {
  return {
    eligibleCandidates: input.candidates,
    emptyPool: input.candidates.length === 0,
    emptyPoolOutcome: 'no_recovery',
    compatibility: input.compatibility,
  }
}

function compareRecoveryCandidates<TPayload>(
  getCoordinationScore:
    | ((candidate: ArcPeakRecoveryCandidate<TPayload>) => number)
    | undefined,
  left: ArcPeakRecoveryCandidate<TPayload>,
  right: ArcPeakRecoveryCandidate<TPayload>,
): number {
  const leftScore = getCoordinationScore?.(left) ?? 0
  const rightScore = getCoordinationScore?.(right) ?? 0
  const scoreDelta = rightScore - leftScore
  if (scoreDelta !== 0) {
    return scoreDelta
  }

  return left.deterministicTieBreakKey.localeCompare(
    right.deterministicTieBreakKey,
  )
}

function buildReviewedCandidateDiagnostics(
  reviewedCandidates: readonly ArcPeakRecoveryReviewedCandidate[] | undefined,
): ArcPeakRecoveryExcludedCandidateDiagnostic[] {
  if (!reviewedCandidates) {
    return []
  }

  return reviewedCandidates.flatMap((candidate) => {
    const diagnostics: ArcPeakRecoveryExcludedCandidateDiagnostic[] = []

    if (!candidate.tastePeakAssessment) {
      diagnostics.push({
        candidateId: candidate.candidateId,
        reason: 'taste_peak_assessment_missing',
        ownerSource: 'taste',
      })
    } else if (candidate.tastePeakAssessment.status !== 'peak_worthy') {
      diagnostics.push({
        candidateId: candidate.candidateId,
        reason: 'taste_peak_assessment_failed',
        ownerSource: 'taste',
        ownerReasons: candidate.tastePeakAssessment.reasons,
      })
    }

    if (!candidate.bearingsPeakFeasibility) {
      diagnostics.push({
        candidateId: candidate.candidateId,
        reason: 'bearings_peak_feasibility_missing',
        ownerSource: 'bearings',
      })
    } else if (!candidate.bearingsPeakFeasibility.feasible) {
      diagnostics.push({
        candidateId: candidate.candidateId,
        reason: 'bearings_peak_feasibility_failed',
        ownerSource: 'bearings',
        ownerReasons: candidate.bearingsPeakFeasibility.reasons,
      })
    }

    return diagnostics
  })
}

export function coordinateArcPeakRecovery<TPayload = unknown>(
  input: CoordinateArcPeakRecoveryInput<TPayload>,
): CoordinateArcPeakRecoveryResult<TPayload> {
  const pool = buildPoolView(input)
  const reviewedDiagnostics = buildReviewedCandidateDiagnostics(
    input.reviewedCandidates,
  )

  if (pool.emptyPool) {
    return {
      pool,
      selectedCandidates: [],
      outcome: 'no_recovery',
      emptyPoolOutcome: 'no_recovery',
      diagnostics: [
        ...reviewedDiagnostics,
        {
          candidateId: input.currentPeakCandidateId ?? 'none',
          reason: 'recovery_pool_empty',
        },
      ],
    }
  }

  const selectLimit = input.selectLimit ?? pool.eligibleCandidates.length
  const selectedCandidates = [...pool.eligibleCandidates]
    .sort((left, right) =>
      compareRecoveryCandidates(input.getCoordinationScore, left, right),
    )
    .slice(0, selectLimit)
  const selectedCandidate = selectedCandidates[0]

  return {
    pool,
    selectedCandidates,
    outcome: 'recovered_peak_selected',
    recoveryReason: selectedCandidate
      ? input.getRecoveryReason?.(selectedCandidate) ?? 'recovered_peak_selected'
      : undefined,
    diagnostics: [
      ...reviewedDiagnostics,
      ...selectedCandidates.map((candidate) => ({
        candidateId: candidate.id,
        reason: 'recovered_peak_selected' as const,
      })),
    ],
  }
}
