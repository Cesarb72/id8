import type {
  GreatStopGateCriterion,
  GreatStopGateSelectionDiagnostics,
} from '../../domain/types/greatStopGate'
import type {
  AnchorRole,
  BuildSoftFeasibleRecoveryAction,
  RouteShapeContract,
} from '../../domain/types/intent'
import {
  classifyBuildPlaceRightRecoveryCounterfactuals,
  type BuildPlaceRightRecoveryEvidence,
} from '../../domain/bearings/buildRoutePlaceRightVerdictForArcCandidate'

export type GreatStopRecoverySurfaceMode = 'surprise' | 'build'
export type BuildSoftFeasibleRecoveryAnchorRoleProvenance =
  | 'explicit'
  | 'inferred'
  | 'defaulted_highlight'
  | 'missing'

export interface BuildSoftFeasibleRecoveryBinding {
  mode: 'build'
  intentId: string | null
  anchorVenueId: string | null
  anchorRole: AnchorRole | null
  anchorRoleProvenance: BuildSoftFeasibleRecoveryAnchorRoleProvenance
  selectedCandidateArtifactId: string | null
  assessedRouteId: string | null
  originatingMovementProfile: RouteShapeContract['movementProfile'] | null
  evidenceFingerprint: string
  eligibilityClassification: 'SOFT_FEASIBLE'
}

export interface BuildSoftFeasibleRecoveryActionBinding {
  action: BuildSoftFeasibleRecoveryAction
  recoveryStateBinding: BuildSoftFeasibleRecoveryBinding
}

export type BuildSoftFeasibleRecoveryActionBindingValidationReason =
  | 'valid'
  | 'missing_action_binding'
  | 'action_mismatch'
  | 'action_unavailable'
  | 'missing_originating_posture'
  | 'stale_recovery_state'

export interface BuildSoftFeasibleRecoveryActionBindingValidation {
  valid: boolean
  reason: BuildSoftFeasibleRecoveryActionBindingValidationReason
}

export interface GreatStopRecoverySurfaceModel {
  active: boolean
  mode: GreatStopRecoverySurfaceMode
  reasonCode: 'great_stop_failed'
  failedCriteria: GreatStopGateCriterion[]
  failedCriteriaLabels: string[]
  userFacingRecoveryReason: string
  title: string
  copy: string
  buildSoftFeasibleRecovery?: {
    classification: 'SOFT_FEASIBLE'
    evidence: BuildPlaceRightRecoveryEvidence
    binding: BuildSoftFeasibleRecoveryBinding
    actions: Array<{
      action: BuildSoftFeasibleRecoveryAction
      label: string
      copy: string
      binding: BuildSoftFeasibleRecoveryActionBinding
    }>
  }
}

const criterionLabels: Record<GreatStopGateCriterion, string> = {
  real: 'Real',
  role_right: 'Role',
  intent_right: 'Intent',
  place_right: 'Place',
  moment_right: 'Moment',
}

function uniqueCriteria(values: readonly GreatStopGateCriterion[]): GreatStopGateCriterion[] {
  return [...new Set(values)]
}

function requiredAnchorSurvivedForFailureDetail(
  detail: NonNullable<
    NonNullable<GreatStopGateSelectionDiagnostics['greatStopCandidateFailureDetails']>['nearestToPassCandidate']
  >,
): boolean | null {
  if (detail.requiredAnchorPresent === false || detail.requiredAnchorRoleCorrect === false) {
    return false
  }
  if (detail.requiredAnchorPresent === true || detail.requiredAnchorRoleCorrect === true) {
    return true
  }
  return null
}

function buildSoftFeasibleRecoveryEvidence(
  diagnostics?: GreatStopGateSelectionDiagnostics | null,
): BuildPlaceRightRecoveryEvidence | null {
  if (!diagnostics) {
    return null
  }
  const selectedGate = diagnostics.selectedGateResult
  if (selectedGate?.failedCriteria.includes('place_right')) {
    const selectedEvidence = classifyBuildPlaceRightRecoveryCounterfactuals({
      counterfactuals: selectedGate.diagnostics.placeRightDiagnosticCounterfactuals,
      productionReasonCodes: selectedGate.criteria.placeRight.reasons,
      requiredAnchorSurvived: selectedGate.requiredAnchor?.survived ?? null,
      productionStatus: selectedGate.criteria.placeRight.passed ? 'pass' : 'fail',
      hardReasonCodes: selectedGate.diagnostics.placeRightClauseAttribution?.hardFailureReasons,
    })
    if (selectedEvidence.classification === 'SOFT_FEASIBLE') {
      return selectedEvidence
    }
  }
  const candidateDetails = [
    diagnostics.greatStopCandidateFailureDetails?.nearestToPassCandidate,
    ...(diagnostics.greatStopCandidateFailureDetails?.topFailingCandidates ?? []),
  ].filter((detail): detail is NonNullable<typeof detail> => Boolean(detail))
  for (const detail of candidateDetails) {
    if (!detail.failedCriteria.includes('place_right')) {
      continue
    }
    const evidence = classifyBuildPlaceRightRecoveryCounterfactuals({
      counterfactuals: detail.placeRightDiagnosticCounterfactuals,
      productionReasonCodes: detail.failureReasons,
      requiredAnchorSurvived: requiredAnchorSurvivedForFailureDetail(detail),
    })
    if (evidence.classification === 'SOFT_FEASIBLE') {
      return evidence
    }
  }
  return null
}

function buildSoftFeasibleRecoveryActionBinding(params: {
  action: BuildSoftFeasibleRecoveryAction
  recoveryStateBinding: BuildSoftFeasibleRecoveryBinding
}): BuildSoftFeasibleRecoveryActionBinding {
  return {
    action: params.action,
    recoveryStateBinding: params.recoveryStateBinding,
  }
}

function buildSoftFeasibleRecoveryActions(
  recoveryStateBinding: BuildSoftFeasibleRecoveryBinding,
): GreatStopRecoverySurfaceModel['buildSoftFeasibleRecovery']['actions'] {
  return [
    {
      action: 'take_bigger_night',
      label: 'Take the bigger night',
      copy: 'Open up the route for more movement and possibility.',
      binding: buildSoftFeasibleRecoveryActionBinding({
        action: 'take_bigger_night',
        recoveryStateBinding,
      }),
    },
    {
      action: 'try_tighter_route',
      label: 'Try a tighter route',
      copy: 'Rebuild the night with stops that stay closer together.',
      binding: buildSoftFeasibleRecoveryActionBinding({
        action: 'try_tighter_route',
        recoveryStateBinding,
      }),
    },
  ]
}

function readAssessedRouteId(diagnostics?: GreatStopGateSelectionDiagnostics | null): string | null {
  return (
    diagnostics?.selectedGateResult?.routeId ??
    diagnostics?.selectedCandidateId ??
    diagnostics?.bestFailingCandidateSummary?.candidateId ??
    diagnostics?.greatStopCandidateFailureDetails?.nearestToPassCandidate?.candidateId ??
    null
  )
}

function buildRecoveryEvidenceFingerprint(params: {
  diagnostics?: GreatStopGateSelectionDiagnostics | null
  evidence: BuildPlaceRightRecoveryEvidence
}): string {
  return JSON.stringify({
    evidence: params.evidence,
    selectedGateResult: params.diagnostics?.selectedGateResult
      ? {
          routeId: params.diagnostics.selectedGateResult.routeId,
          status: params.diagnostics.selectedGateResult.status,
          failedCriteria: params.diagnostics.selectedGateResult.failedCriteria,
          reasons: params.diagnostics.selectedGateResult.reasons,
          requiredAnchor: params.diagnostics.selectedGateResult.requiredAnchor ?? null,
          placeRightPassed:
            params.diagnostics.selectedGateResult.criteria.placeRight.passed,
          placeRightReasons:
            params.diagnostics.selectedGateResult.criteria.placeRight.reasons,
          placeRightCounterfactuals:
            params.diagnostics.selectedGateResult.diagnostics
              .placeRightDiagnosticCounterfactuals ?? null,
          placeRightHardReasons:
            params.diagnostics.selectedGateResult.diagnostics
              .placeRightClauseAttribution?.hardFailureReasons ?? null,
        }
      : null,
    selectedCandidateId: params.diagnostics?.selectedCandidateId ?? null,
    bestFailingCandidateSummary: params.diagnostics?.bestFailingCandidateSummary
      ? {
          candidateId: params.diagnostics.bestFailingCandidateSummary.candidateId,
          rank: params.diagnostics.bestFailingCandidateSummary.rank,
          signature: params.diagnostics.bestFailingCandidateSummary.signature,
          stopVenueIdsByRole:
            params.diagnostics.bestFailingCandidateSummary.stopVenueIdsByRole,
          failedCriteria: params.diagnostics.bestFailingCandidateSummary.failedCriteria,
          reasons: params.diagnostics.bestFailingCandidateSummary.reasons,
        }
      : null,
    nearestToPassCandidate:
      params.diagnostics?.greatStopCandidateFailureDetails?.nearestToPassCandidate
        ? {
            candidateId:
              params.diagnostics.greatStopCandidateFailureDetails.nearestToPassCandidate
                .candidateId,
            rank:
              params.diagnostics.greatStopCandidateFailureDetails.nearestToPassCandidate.rank,
            signature:
              params.diagnostics.greatStopCandidateFailureDetails.nearestToPassCandidate
                .signature,
            stopIds:
              params.diagnostics.greatStopCandidateFailureDetails.nearestToPassCandidate
                .stopIds,
            baseVenueIds:
              params.diagnostics.greatStopCandidateFailureDetails.nearestToPassCandidate
                .baseVenueIds,
            failedCriteria:
              params.diagnostics.greatStopCandidateFailureDetails.nearestToPassCandidate
                .failedCriteria,
            failureReasons:
              params.diagnostics.greatStopCandidateFailureDetails.nearestToPassCandidate
                .failureReasons,
            placeRightCounterfactuals:
              params.diagnostics.greatStopCandidateFailureDetails.nearestToPassCandidate
                .placeRightDiagnosticCounterfactuals ?? null,
          }
        : null,
  })
}

function buildSoftFeasibleRecoveryBinding(params: {
  diagnostics?: GreatStopGateSelectionDiagnostics | null
  evidence: BuildPlaceRightRecoveryEvidence
  buildIntentId?: string | null
  buildAnchorVenueId?: string | null
  buildAnchorRole?: AnchorRole | null
  buildAnchorRoleProvenance?: BuildSoftFeasibleRecoveryAnchorRoleProvenance | null
  selectedCandidateArtifactId?: string | null
  originatingMovementProfile?: RouteShapeContract['movementProfile'] | null
}): BuildSoftFeasibleRecoveryBinding {
  return {
    mode: 'build',
    intentId: params.buildIntentId ?? null,
    anchorVenueId: params.buildAnchorVenueId ?? null,
    anchorRole: params.buildAnchorRole ?? null,
    anchorRoleProvenance: params.buildAnchorRoleProvenance ?? 'missing',
    selectedCandidateArtifactId: params.selectedCandidateArtifactId ?? null,
    assessedRouteId: readAssessedRouteId(params.diagnostics),
    originatingMovementProfile: params.originatingMovementProfile ?? null,
    evidenceFingerprint: buildRecoveryEvidenceFingerprint({
      diagnostics: params.diagnostics,
      evidence: params.evidence,
    }),
    eligibilityClassification: 'SOFT_FEASIBLE',
  }
}

export function areBuildSoftFeasibleRecoveryBindingsEqual(
  left?: BuildSoftFeasibleRecoveryBinding | null,
  right?: BuildSoftFeasibleRecoveryBinding | null,
): boolean {
  if (!left || !right) {
    return false
  }
  return JSON.stringify(left) === JSON.stringify(right)
}

export function validateBuildSoftFeasibleRecoveryActionBinding(params: {
  clickedAction: BuildSoftFeasibleRecoveryAction
  submittedBinding?: BuildSoftFeasibleRecoveryActionBinding | null
  currentRecoveryBinding?: BuildSoftFeasibleRecoveryBinding | null
  currentlyOfferedActions: readonly BuildSoftFeasibleRecoveryAction[]
}): BuildSoftFeasibleRecoveryActionBindingValidation {
  if (!params.submittedBinding?.action) {
    return { valid: false, reason: 'missing_action_binding' }
  }
  if (params.submittedBinding.action !== params.clickedAction) {
    return { valid: false, reason: 'action_mismatch' }
  }
  if (!params.currentlyOfferedActions.includes(params.submittedBinding.action)) {
    return { valid: false, reason: 'action_unavailable' }
  }
  if (!params.submittedBinding.recoveryStateBinding.originatingMovementProfile) {
    return { valid: false, reason: 'missing_originating_posture' }
  }
  if (
    !areBuildSoftFeasibleRecoveryBindingsEqual(
      params.submittedBinding.recoveryStateBinding,
      params.currentRecoveryBinding,
    )
  ) {
    return { valid: false, reason: 'stale_recovery_state' }
  }
  return { valid: true, reason: 'valid' }
}

export function buildGreatStopRecoverySurfaceModel(params: {
  mode: GreatStopRecoverySurfaceMode
  diagnostics?: GreatStopGateSelectionDiagnostics | null
  failureClassification?: string | null
  buildAnchorName?: string | null
  buildIntentId?: string | null
  buildAnchorVenueId?: string | null
  buildAnchorRole?: AnchorRole | null
  buildAnchorRoleProvenance?: BuildSoftFeasibleRecoveryAnchorRoleProvenance | null
  selectedCandidateArtifactId?: string | null
  originatingMovementProfile?: RouteShapeContract['movementProfile'] | null
}): GreatStopRecoverySurfaceModel {
  const failedCriteria = uniqueCriteria([
    ...(params.diagnostics?.failedTopCandidateCriteria ?? []),
    ...(params.diagnostics?.bestFailingCandidateSummary?.failedCriteria ?? []),
  ])
  const failedCriteriaLabels = failedCriteria.map((criterion) => criterionLabels[criterion])
  const active =
    params.diagnostics?.status === 'FAIL' || Boolean(params.failureClassification)
  const buildSoftFeasibleRecovery =
    params.mode === 'build'
      ? buildSoftFeasibleRecoveryEvidence(params.diagnostics)
      : null
  const criteriaPhrase =
    failedCriteriaLabels.length > 0
      ? failedCriteriaLabels.join(', ')
      : 'Great Stop criteria'
  const buildAnchorName = params.buildAnchorName?.trim() || 'your anchor'
  const buildRecovery =
    buildSoftFeasibleRecovery?.classification === 'SOFT_FEASIBLE'
      ? (() => {
          const binding = buildSoftFeasibleRecoveryBinding({
            diagnostics: params.diagnostics,
            evidence: buildSoftFeasibleRecovery,
            buildIntentId: params.buildIntentId,
            buildAnchorVenueId: params.buildAnchorVenueId,
            buildAnchorRole: params.buildAnchorRole,
            buildAnchorRoleProvenance: params.buildAnchorRoleProvenance,
            selectedCandidateArtifactId: params.selectedCandidateArtifactId,
            originatingMovementProfile: params.originatingMovementProfile,
          })
          return {
          classification: 'SOFT_FEASIBLE' as const,
          evidence: buildSoftFeasibleRecovery,
          binding,
          actions: buildSoftFeasibleRecoveryActions(binding),
        }
        })()
      : undefined

  return {
    active,
    mode: params.mode,
    reasonCode: 'great_stop_failed',
    failedCriteria,
    failedCriteriaLabels,
    userFacingRecoveryReason: `great_stop_failed: ${criteriaPhrase}`,
    title:
      buildRecovery
        ? 'This night needs a little more room'
        : params.mode === 'build'
        ? "We can't stand behind this route yet."
        : "We can't stand behind this surprise yet.",
    copy: buildRecovery
      ? `We can keep ${buildAnchorName} and try the night in one of two ways.`
      : `Reason: great_stop_failed. The route did not pass ${criteriaPhrase}. Try another option or regenerate before review.`,
    ...(buildRecovery ? { buildSoftFeasibleRecovery: buildRecovery } : {}),
  }
}
