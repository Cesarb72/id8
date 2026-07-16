import type {
  GreatStopGateCriterion,
  GreatStopGateSelectionDiagnostics,
} from '../../domain/types/greatStopGate'

export type GreatStopRecoverySurfaceMode = 'surprise' | 'build'

export interface GreatStopRecoverySurfaceModel {
  active: boolean
  mode: GreatStopRecoverySurfaceMode
  reasonCode: 'great_stop_failed'
  failedCriteria: GreatStopGateCriterion[]
  failedCriteriaLabels: string[]
  userFacingRecoveryReason: string
  title: string
  copy: string
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

export function buildGreatStopRecoverySurfaceModel(params: {
  mode: GreatStopRecoverySurfaceMode
  diagnostics?: GreatStopGateSelectionDiagnostics | null
  failureClassification?: string | null
}): GreatStopRecoverySurfaceModel {
  const failedCriteria = uniqueCriteria([
    ...(params.diagnostics?.failedTopCandidateCriteria ?? []),
    ...(params.diagnostics?.bestFailingCandidateSummary?.failedCriteria ?? []),
  ])
  const failedCriteriaLabels = failedCriteria.map((criterion) => criterionLabels[criterion])
  const active =
    params.diagnostics?.status === 'FAIL' || Boolean(params.failureClassification)
  const criteriaPhrase =
    failedCriteriaLabels.length > 0
      ? failedCriteriaLabels.join(', ')
      : 'Great Stop criteria'

  return {
    active,
    mode: params.mode,
    reasonCode: 'great_stop_failed',
    failedCriteria,
    failedCriteriaLabels,
    userFacingRecoveryReason: `great_stop_failed: ${criteriaPhrase}`,
    title:
      params.mode === 'build'
        ? "We can't stand behind this route yet."
        : "We can't stand behind this surprise yet.",
    copy: `Reason: great_stop_failed. The route did not pass ${criteriaPhrase}. Try another option or regenerate before review.`,
  }
}
