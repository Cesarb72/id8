import type { PlanningTimeWindowSignal } from '../types/hours'
import type {
  BearingsRuntimeHoursPlanWindowProofStatus,
  BearingsStaticRuntimeHoursProofResult,
} from './staticRuntimeHoursProof'

export type BearingsHoursTimeSpecificity = 'explicit' | 'unspecified'

export type BearingsHoursAdmissibilityStatus =
  | 'admissible'
  | 'blocked'
  | 'admissible_with_unknown_hours'
  | 'admissible_with_unspecified_time_relaxation'

export type BearingsHoursAdmissibilityReason =
  | 'not_required'
  | 'open_for_plan_window'
  | 'closed_for_plan_window'
  | 'unknown_for_plan_window'
  | 'explicit_time_requires_known_open_hours'
  | 'unspecified_time_allows_unknown_hours'

export interface BearingsHoursAdmissibilityDiagnostics {
  proofStatus: BearingsRuntimeHoursPlanWindowProofStatus
  required: boolean
  proofSource: BearingsStaticRuntimeHoursProofResult['proofSource']
  structuredPeriodCount: number
  textHoursAvailable: boolean
  planningWindow?: {
    day: number
    hour: number
    minute: number
    label: string
    source?: PlanningTimeWindowSignal['source']
    usesIntentWindow: boolean
  }
  relaxationApplied: boolean
}

export interface BearingsHoursAdmissibilityResult {
  status: BearingsHoursAdmissibilityStatus
  reason: BearingsHoursAdmissibilityReason
  timeSpecificity: BearingsHoursTimeSpecificity
  admitted: boolean
  diagnostics: BearingsHoursAdmissibilityDiagnostics
}

export interface EvaluateHoursAdmissibilityInput {
  proof: BearingsStaticRuntimeHoursProofResult
  planningWindow?: PlanningTimeWindowSignal
  timeSpecificity?: BearingsHoursTimeSpecificity
}

export function resolveHoursTimeSpecificity(
  planningWindow: PlanningTimeWindowSignal | undefined,
): BearingsHoursTimeSpecificity {
  return planningWindow?.usesIntentWindow ? 'explicit' : 'unspecified'
}

function buildDiagnostics(params: {
  proof: BearingsStaticRuntimeHoursProofResult
  planningWindow?: PlanningTimeWindowSignal
  relaxationApplied: boolean
}): BearingsHoursAdmissibilityDiagnostics {
  const planningWindow = params.planningWindow
  return {
    proofStatus: params.proof.status,
    required: params.proof.required,
    proofSource: params.proof.proofSource,
    structuredPeriodCount: params.proof.structuredPeriodCount,
    textHoursAvailable: params.proof.textHoursAvailable,
    planningWindow: planningWindow
      ? {
          day: planningWindow.day,
          hour: planningWindow.hour,
          minute: planningWindow.minute,
          label: planningWindow.label,
          source: planningWindow.source,
          usesIntentWindow: planningWindow.usesIntentWindow,
        }
      : undefined,
    relaxationApplied: params.relaxationApplied,
  }
}

export function evaluateHoursAdmissibility(
  input: EvaluateHoursAdmissibilityInput,
): BearingsHoursAdmissibilityResult {
  const timeSpecificity =
    input.timeSpecificity ?? resolveHoursTimeSpecificity(input.planningWindow)
  const proof = input.proof

  if (proof.status === 'closed_for_plan_window') {
    return {
      status: 'blocked',
      reason: 'closed_for_plan_window',
      timeSpecificity,
      admitted: false,
      diagnostics: buildDiagnostics({
        proof,
        planningWindow: input.planningWindow,
        relaxationApplied: false,
      }),
    }
  }

  if (proof.status === 'unknown_for_plan_window') {
    if (timeSpecificity === 'explicit') {
      return {
        status: 'blocked',
        reason: 'explicit_time_requires_known_open_hours',
        timeSpecificity,
        admitted: false,
        diagnostics: buildDiagnostics({
          proof,
          planningWindow: input.planningWindow,
          relaxationApplied: false,
        }),
      }
    }

    return {
      status: 'admissible_with_unspecified_time_relaxation',
      reason: 'unspecified_time_allows_unknown_hours',
      timeSpecificity,
      admitted: true,
      diagnostics: buildDiagnostics({
        proof,
        planningWindow: input.planningWindow,
        relaxationApplied: true,
      }),
    }
  }

  return {
    status: 'admissible',
    reason: proof.status,
    timeSpecificity,
    admitted: true,
    diagnostics: buildDiagnostics({
      proof,
      planningWindow: input.planningWindow,
      relaxationApplied: false,
    }),
  }
}
