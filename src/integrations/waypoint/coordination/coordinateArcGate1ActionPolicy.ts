import type {
  ArcGate1ActionCandidate,
  ArcGate1ActionDecision,
  ArcGate1ActionDecisionKind,
  ArcGate1ActionKind,
  ArcGate1ActionPolicyInput,
  ArcGate1ActionPolicyView,
  ArcGate1ActionRefusalReason,
  OwnerProvenancedGate1ActionSignal,
} from './arcGate1ActionPolicyView'

function signalPassed(signal: OwnerProvenancedGate1ActionSignal): boolean {
  if (signal.value === false) {
    return false
  }
  if (typeof signal.reason === 'string' && signal.reason.endsWith(':fail')) {
    return false
  }
  return true
}

function allSignalsPassed(
  signals: readonly OwnerProvenancedGate1ActionSignal[],
): boolean {
  return signals.length > 0 && signals.every(signalPassed)
}

function hasFailedSignal(
  candidate: ArcGate1ActionCandidate,
  source: OwnerProvenancedGate1ActionSignal['source'],
  key?: string,
): boolean {
  return candidate.ownerSignals.some(
    (signal) =>
      signal.source === source &&
      (!key || signal.key === key) &&
      !signalPassed(signal),
  )
}

function buildDecision(
  candidate: ArcGate1ActionCandidate,
  decision: ArcGate1ActionDecisionKind,
  reasons?: readonly ArcGate1ActionRefusalReason[],
): ArcGate1ActionDecision {
  return {
    source: 'waypoint',
    candidateId: candidate.id,
    decision,
    reasons,
    ownerSignals: candidate.ownerSignals,
    compatibility: candidate.compatibility,
  }
}

export function coordinateArcGate1ActionPolicy<TPayload = unknown>(
  input: ArcGate1ActionPolicyInput<TPayload>,
): ArcGate1ActionPolicyView<TPayload> {
  const decisions = input.candidates.map((candidate) =>
    coordinateArcGate1ActionCandidate(
      candidate as ArcGate1ActionCandidate<ArcGate1ActionKind>,
    ),
  )
  const refusalReasons = decisions.flatMap((decision) => decision.reasons ?? [])
  const noActionDecision = decisions.find(
    (decision) =>
      decision.decision === 'no_action' ||
      decision.decision === 'no_preservation' ||
      decision.decision === 'no_fallback' ||
      decision.decision === 'no_promotion',
  )?.decision as ArcGate1ActionPolicyView<TPayload>['noActionDecision']

  return {
    input,
    decisions,
    refusalReasons,
    noActionDecision,
    compatibility: input.compatibility,
  }
}

export function coordinateArcGate1ActionCandidate(
  candidate: ArcGate1ActionCandidate,
): ArcGate1ActionDecision {
  const passed = allSignalsPassed(candidate.ownerSignals)

  if (candidate.action === 'preservation') {
    return passed
      ? buildDecision(candidate, 'preserve')
      : buildDecision(candidate, 'refuse_preservation', [
          hasFailedSignal(candidate, 'bearings', 'place_right_feasibility')
            ? 'preservation:would_mask_failed_place_right'
            : 'preservation:owner_signal_failed',
        ])
  }

  if (candidate.action === 'fallback') {
    return passed && candidate.ownerSignals.some((signal) => signal.source === 'field')
      ? buildDecision(candidate, 'fallback')
      : buildDecision(candidate, 'refuse_fallback', [
          hasFailedSignal(candidate, 'taste')
            ? 'fallback:would_mask_missing_meaning'
            : hasFailedSignal(candidate, 'bearings')
              ? 'fallback:would_mask_failed_feasibility'
              : 'fallback:no_owner_valid_candidate',
        ])
  }

  if (candidate.action === 'surprise_promotion') {
    return passed
      ? buildDecision(candidate, 'promote')
      : buildDecision(candidate, 'no_promotion', [
          'surprise:promotion_owner_signal_failed',
        ])
  }

  if (candidate.action === 'surprise_demotion') {
    return passed
      ? buildDecision(candidate, 'demote')
      : buildDecision(candidate, 'no_action', [
          'surprise:demotion_would_hide_required_failure',
        ])
  }

  if (candidate.action === 'family_preservation') {
    return passed
      ? buildDecision(candidate, 'preserve')
      : buildDecision(candidate, 'refuse_preservation', [
          hasFailedSignal(candidate, 'bearings')
            ? 'family_preservation:cap_refused_infeasible_candidate'
            : 'family_preservation:owner_signal_failed',
        ])
  }

  if (candidate.action === 'preferred_role_admission') {
    return passed
      ? buildDecision(candidate, 'admit')
      : buildDecision(candidate, 'refuse_admission', [
          'preservation:owner_signal_failed',
        ])
  }

  return passed
    ? buildDecision(candidate, 'preserve')
    : buildDecision(candidate, 'no_action', ['preservation:owner_signal_failed'])
}

export interface ArcGate1SurprisePromotionOption<TPayload> {
  promotionCandidate: ArcGate1ActionCandidate<'surprise_promotion'>
  demotionCandidate?: ArcGate1ActionCandidate<'surprise_demotion'>
  payload: TPayload
  promotedScore: number
  heldComparableScore: number
  scoreTolerance?: number
  deterministicTieBreakKey: string
}

export interface CoordinateArcGate1SurprisePromotionInput<TPayload> {
  options: readonly ArcGate1SurprisePromotionOption<TPayload>[]
}

export interface CoordinateArcGate1SurprisePromotionResult<TPayload> {
  decision: ArcGate1ActionDecision
  demotionDecision?: ArcGate1ActionDecision
  selectedOption?: ArcGate1SurprisePromotionOption<TPayload>
  rejectedDecisions: readonly ArcGate1ActionDecision[]
}

export function coordinateArcGate1SurprisePromotion<TPayload>(
  input: CoordinateArcGate1SurprisePromotionInput<TPayload>,
): CoordinateArcGate1SurprisePromotionResult<TPayload> {
  const orderedOptions = [...input.options].sort((left, right) => {
    const scoreDelta = right.promotedScore - left.promotedScore
    if (scoreDelta !== 0) {
      return scoreDelta
    }
    return left.deterministicTieBreakKey.localeCompare(
      right.deterministicTieBreakKey,
    )
  })
  const rejectedDecisions: ArcGate1ActionDecision[] = []

  for (const option of orderedOptions) {
    const promotionDecision = coordinateArcGate1ActionCandidate(
      option.promotionCandidate,
    )
    if (promotionDecision.decision !== 'promote') {
      rejectedDecisions.push(promotionDecision)
      continue
    }

    if (
      option.promotedScore <
      option.heldComparableScore - (option.scoreTolerance ?? 0)
    ) {
      rejectedDecisions.push(
        buildDecision(option.promotionCandidate, 'no_promotion', [
          'surprise:promotion_score_not_competitive',
        ]),
      )
      continue
    }

    const demotionDecision = option.demotionCandidate
      ? coordinateArcGate1ActionCandidate(option.demotionCandidate)
      : undefined
    if (demotionDecision && demotionDecision.decision !== 'demote') {
      rejectedDecisions.push(demotionDecision)
      continue
    }

    return {
      decision: promotionDecision,
      demotionDecision,
      selectedOption: option,
      rejectedDecisions,
    }
  }

  return {
    decision: {
      source: 'waypoint',
      decision: 'no_promotion',
      reasons:
        rejectedDecisions[0]?.reasons ?? ['surprise:promotion_owner_signal_failed'],
      ownerSignals: rejectedDecisions.flatMap((decision) => decision.ownerSignals),
    },
    rejectedDecisions,
  }
}
