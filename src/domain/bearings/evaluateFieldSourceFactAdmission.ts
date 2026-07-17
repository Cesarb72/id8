import type { FieldSourceFactProjection } from '../field/projectFieldSourceFacts'

export type BearingsFieldSourceFactAdmissionFailureReason =
  | 'quality_gate_not_approved'
  | 'hours_suppressed'

export interface BearingsFieldSourceFactAdmissionResult {
  admitted: boolean
  failureReasons: BearingsFieldSourceFactAdmissionFailureReason[]
  qualityApproved: boolean
  hoursAdmitted: boolean
}

export function evaluateFieldSourceFactAdmission(
  facts: FieldSourceFactProjection,
): BearingsFieldSourceFactAdmissionResult {
  const failureReasons: BearingsFieldSourceFactAdmissionFailureReason[] = []
  const qualityApproved = facts.quality.qualityGateStatus === 'approved'
  const hoursAdmitted = !facts.availability.hoursSuppressionApplied

  if (!qualityApproved) {
    failureReasons.push('quality_gate_not_approved')
  }
  if (!hoursAdmitted) {
    failureReasons.push('hours_suppressed')
  }

  return {
    admitted: failureReasons.length === 0,
    failureReasons,
    qualityApproved,
    hoursAdmitted,
  }
}
