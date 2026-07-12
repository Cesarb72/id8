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

function hasPassedSignal(
  candidate: ArcGate1ActionCandidate,
  source: OwnerProvenancedGate1ActionSignal['source'],
  key?: string,
): boolean {
  return candidate.ownerSignals.some(
    (signal) =>
      signal.source === source &&
      (!key || signal.key === key) &&
      signalPassed(signal),
  )
}

function fallbackRefusalReason(
  candidate: ArcGate1ActionCandidate,
): ArcGate1ActionRefusalReason {
  if (hasFailedSignal(candidate, 'taste')) {
    return 'fallback:would_mask_missing_meaning'
  }
  if (hasFailedSignal(candidate, 'bearings')) {
    return 'fallback:would_mask_failed_feasibility'
  }
  if (
    hasFailedSignal(candidate, 'field') ||
    !hasPassedSignal(candidate, 'field', 'real_record')
  ) {
    return 'fallback:would_mask_missing_real'
  }
  return 'fallback:no_owner_valid_candidate'
}

function preferredRoleAdmissionPassed(candidate: ArcGate1ActionCandidate): boolean {
  return (
    hasPassedSignal(candidate, 'taste', 'role_support') &&
    hasPassedSignal(candidate, 'taste', 'intent_support') &&
    hasPassedSignal(candidate, 'bearings', 'hours_feasibility') &&
    hasPassedSignal(candidate, 'bearings', 'distance_feasibility') &&
    hasPassedSignal(candidate, 'bearings', 'admission_survival') &&
    hasPassedSignal(candidate, 'bearings', 'constraint_survival') &&
    hasPassedSignal(candidate, 'field', 'real_record')
  )
}

function preferredRoleAdmissionRefusalReason(
  candidate: ArcGate1ActionCandidate,
): ArcGate1ActionRefusalReason {
  if (
    hasFailedSignal(candidate, 'taste', 'role_support') ||
    hasFailedSignal(candidate, 'taste', 'intent_support')
  ) {
    return 'preferred_role:would_mask_missing_meaning'
  }
  if (
    hasFailedSignal(candidate, 'bearings', 'hours_feasibility') ||
    hasFailedSignal(candidate, 'bearings', 'distance_feasibility') ||
    hasFailedSignal(candidate, 'bearings', 'admission_survival') ||
    hasFailedSignal(candidate, 'bearings', 'constraint_survival') ||
    !hasPassedSignal(candidate, 'bearings', 'admission_survival') ||
    !hasPassedSignal(candidate, 'bearings', 'constraint_survival')
  ) {
    return 'preferred_role:would_mask_failed_admission'
  }
  if (
    hasFailedSignal(candidate, 'field') ||
    !hasPassedSignal(candidate, 'field', 'real_record')
  ) {
    return 'preferred_role:would_mask_missing_real'
  }
  return 'preferred_role:owner_signal_failed'
}

function familyPreservationPassed(candidate: ArcGate1ActionCandidate): boolean {
  return (
    hasPassedSignal(candidate, 'taste', 'family_fit') &&
    hasPassedSignal(candidate, 'taste', 'peak_support') &&
    hasPassedSignal(candidate, 'taste', 'role_support') &&
    hasPassedSignal(candidate, 'taste', 'intent_support') &&
    hasPassedSignal(candidate, 'bearings', 'route_feasibility') &&
    hasPassedSignal(candidate, 'bearings', 'admission_survival') &&
    hasPassedSignal(candidate, 'bearings', 'constraint_survival') &&
    hasPassedSignal(candidate, 'field', 'real_record')
  )
}

function familyPreservationRefusalReasons(
  candidate: ArcGate1ActionCandidate,
): readonly ArcGate1ActionRefusalReason[] {
  if (
    hasFailedSignal(candidate, 'taste', 'family_fit') ||
    hasFailedSignal(candidate, 'taste', 'peak_support') ||
    hasFailedSignal(candidate, 'taste', 'role_support') ||
    hasFailedSignal(candidate, 'taste', 'intent_support')
  ) {
    return ['family_preservation:would_mask_missing_meaning']
  }
  if (
    hasFailedSignal(candidate, 'bearings', 'route_feasibility') ||
    hasFailedSignal(candidate, 'bearings', 'admission_survival') ||
    hasFailedSignal(candidate, 'bearings', 'constraint_survival') ||
    !hasPassedSignal(candidate, 'bearings', 'admission_survival') ||
    !hasPassedSignal(candidate, 'bearings', 'constraint_survival')
  ) {
    return [
      'family_preservation:cap_refused_infeasible_candidate',
      'family_preservation:would_mask_failed_feasibility',
    ]
  }
  if (
    hasFailedSignal(candidate, 'field') ||
    !hasPassedSignal(candidate, 'field', 'real_record')
  ) {
    return ['family_preservation:would_mask_missing_real']
  }
  return ['family_preservation:owner_signal_failed']
}

function contractPressurePassed(candidate: ArcGate1ActionCandidate): boolean {
  return (
    hasPassedSignal(candidate, 'taste', 'role_support') &&
    hasPassedSignal(candidate, 'taste', 'intent_support') &&
    hasPassedSignal(candidate, 'bearings', 'admission_survival') &&
    hasPassedSignal(candidate, 'bearings', 'constraint_survival') &&
    hasPassedSignal(candidate, 'field', 'real_record')
  )
}

function contractPressureRefusalReason(
  candidate: ArcGate1ActionCandidate,
): ArcGate1ActionRefusalReason {
  if (
    hasFailedSignal(candidate, 'taste', 'role_support') ||
    hasFailedSignal(candidate, 'taste', 'intent_support')
  ) {
    return 'contract_pressure:would_mask_missing_meaning'
  }
  if (
    hasFailedSignal(candidate, 'bearings', 'admission_survival') ||
    hasFailedSignal(candidate, 'bearings', 'constraint_survival') ||
    !hasPassedSignal(candidate, 'bearings', 'admission_survival') ||
    !hasPassedSignal(candidate, 'bearings', 'constraint_survival')
  ) {
    return 'contract_pressure:would_mask_failed_constraint'
  }
  if (
    hasFailedSignal(candidate, 'field') ||
    !hasPassedSignal(candidate, 'field', 'real_record')
  ) {
    return 'contract_pressure:would_mask_missing_real'
  }
  return 'contract_pressure:owner_signal_failed'
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

export interface CoordinateArcGate1FallbackRescueInput<TPayload = unknown> {
  candidates: readonly ArcGate1ActionCandidate<'fallback' | 'rescue', TPayload>[]
  emptyDecision?: 'no_fallback' | 'no_rescue'
}

export interface CoordinateArcGate1FallbackRescueResult<TPayload = unknown> {
  decisions: readonly ArcGate1ActionDecision[]
  selectedCandidates: readonly ArcGate1ActionCandidate<'fallback' | 'rescue', TPayload>[]
  refusalReasons: readonly ArcGate1ActionRefusalReason[]
  noFallbackDecision?: ArcGate1ActionDecision
}

export function coordinateArcGate1FallbackRescue<TPayload = unknown>(
  input: CoordinateArcGate1FallbackRescueInput<TPayload>,
): CoordinateArcGate1FallbackRescueResult<TPayload> {
  const decisions = input.candidates.map((candidate) =>
    coordinateArcGate1ActionCandidate(candidate),
  )
  const selectedCandidateIds = new Set(
    decisions
      .filter(
        (decision) =>
          decision.decision === 'fallback' || decision.decision === 'rescue',
      )
      .map((decision) => decision.candidateId)
      .filter((candidateId): candidateId is string => Boolean(candidateId)),
  )
  const selectedCandidates = input.candidates.filter((candidate) =>
    selectedCandidateIds.has(candidate.id),
  )
  const refusalReasons = decisions.flatMap((decision) => decision.reasons ?? [])
  const emptyDecision = input.emptyDecision ?? 'no_fallback'

  return {
    decisions,
    selectedCandidates,
    refusalReasons,
    ...(selectedCandidates.length === 0
      ? {
          noFallbackDecision: {
            source: 'waypoint',
            decision: emptyDecision,
            reasons: refusalReasons.length
              ? refusalReasons
              : ['fallback:no_owner_valid_candidate'],
            ownerSignals: decisions.flatMap((decision) => decision.ownerSignals),
          },
        }
      : {}),
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
      decision.decision === 'no_rescue' ||
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

  if (candidate.action === 'fallback' || candidate.action === 'rescue') {
    const ownerTruthPassed =
      passed && hasPassedSignal(candidate, 'field', 'real_record')
    if (ownerTruthPassed) {
      return buildDecision(
        candidate,
        candidate.action === 'rescue' ? 'rescue' : 'fallback',
      )
    }
    return buildDecision(
      candidate,
      candidate.action === 'rescue' ? 'refuse_rescue' : 'refuse_fallback',
      [fallbackRefusalReason(candidate)],
    )
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
    return familyPreservationPassed(candidate)
      ? buildDecision(candidate, 'preserve')
      : buildDecision(
          candidate,
          'refuse_preservation',
          familyPreservationRefusalReasons(candidate),
        )
  }

  if (candidate.action === 'preferred_role_admission') {
    return preferredRoleAdmissionPassed(candidate)
      ? buildDecision(candidate, 'admit')
      : buildDecision(candidate, 'refuse_admission', [
          preferredRoleAdmissionRefusalReason(candidate),
        ])
  }

  if (candidate.action === 'hard_contract_pressure') {
    return contractPressurePassed(candidate)
      ? buildDecision(candidate, 'apply_contract_pressure')
      : buildDecision(candidate, 'refuse_contract_pressure', [
          contractPressureRefusalReason(candidate),
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

export interface CoordinateArcGate1PreservationInput<TPayload = unknown> {
  candidates: readonly ArcGate1ActionCandidate<'preservation', TPayload>[]
}

export interface CoordinateArcGate1PreservationResult<TPayload = unknown> {
  decisions: readonly ArcGate1ActionDecision[]
  preservedCandidates: readonly ArcGate1ActionCandidate<'preservation', TPayload>[]
  refusalReasons: readonly ArcGate1ActionRefusalReason[]
  noPreservationDecision?: ArcGate1ActionDecision
}

export function coordinateArcGate1Preservation<TPayload = unknown>(
  input: CoordinateArcGate1PreservationInput<TPayload>,
): CoordinateArcGate1PreservationResult<TPayload> {
  const decisions = input.candidates.map((candidate) =>
    coordinateArcGate1ActionCandidate(candidate),
  )
  const preservedCandidateIds = new Set(
    decisions
      .filter((decision) => decision.decision === 'preserve')
      .map((decision) => decision.candidateId)
      .filter((candidateId): candidateId is string => Boolean(candidateId)),
  )
  const preservedCandidates = input.candidates.filter((candidate) =>
    preservedCandidateIds.has(candidate.id),
  )
  const refusalReasons = decisions.flatMap((decision) => decision.reasons ?? [])

  return {
    decisions,
    preservedCandidates,
    refusalReasons,
    ...(input.candidates.length > 0 && preservedCandidates.length === 0
      ? {
          noPreservationDecision: {
            source: 'waypoint',
            decision: 'no_preservation',
            reasons: refusalReasons.length
              ? refusalReasons
              : ['preservation:owner_signal_failed'],
            ownerSignals: decisions.flatMap((decision) => decision.ownerSignals),
          },
        }
      : {}),
  }
}
