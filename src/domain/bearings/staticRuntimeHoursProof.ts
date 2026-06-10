import { RUNTIME_HOURS_VALIDATION_REQUIRED } from '../field/corpus/types'
import type { PromotedFieldProviderCorpusVenue } from '../field/corpus/types'
import type { HoursPeriod, PlanningTimeWindowSignal } from '../types/hours'

export type BearingsRuntimeHoursPlanWindowProofStatus =
  | 'not_required'
  | 'open_for_plan_window'
  | 'closed_for_plan_window'
  | 'unknown_for_plan_window'

export interface BearingsStaticRuntimeHoursProofResult {
  status: BearingsRuntimeHoursPlanWindowProofStatus
  required: boolean
  proofSource: PromotedFieldProviderCorpusVenue['runtimeHoursProof']['proofSource']
  structuredPeriodCount: number
  textHoursAvailable: boolean
  planningWindowLabel?: string
}

function toWeeklyMinute(day: number, hour: number, minute: number): number {
  return day * 24 * 60 + hour * 60 + minute
}

function isOpenDuringPlanningWindow(
  periods: HoursPeriod[],
  planningWindow: PlanningTimeWindowSignal,
): boolean {
  const targetMinute = toWeeklyMinute(
    planningWindow.day,
    planningWindow.hour,
    planningWindow.minute,
  )

  for (const period of periods) {
    if (!period.open || !period.close) {
      continue
    }

    let openMinute = toWeeklyMinute(
      period.open.day,
      period.open.hour,
      period.open.minute,
    )
    let closeMinute = toWeeklyMinute(
      period.close.day,
      period.close.hour,
      period.close.minute,
    )

    if (closeMinute <= openMinute) {
      closeMinute += 7 * 24 * 60
    }

    const adjustedTarget =
      targetMinute < openMinute ? targetMinute + 7 * 24 * 60 : targetMinute
    if (adjustedTarget >= openMinute && adjustedTarget < closeMinute) {
      return true
    }
  }

  return false
}

function venueRequiresRuntimeHoursProof(
  promotedVenue: PromotedFieldProviderCorpusVenue,
): boolean {
  return (
    promotedVenue.venue.source.bearingsValidationRequirements?.includes(
      RUNTIME_HOURS_VALIDATION_REQUIRED,
    ) === true
  )
}

export function evaluateStaticRuntimeHoursProof(
  promotedVenue: PromotedFieldProviderCorpusVenue,
  planningWindow: PlanningTimeWindowSignal | undefined,
): BearingsStaticRuntimeHoursProofResult {
  const required = venueRequiresRuntimeHoursProof(promotedVenue)
  const runtimeHoursProof = promotedVenue.runtimeHoursProof

  if (!required) {
    return {
      status: 'not_required',
      required,
      proofSource: runtimeHoursProof.proofSource,
      structuredPeriodCount: runtimeHoursProof.structuredPeriods.length,
      textHoursAvailable: runtimeHoursProof.textHoursAvailable,
      planningWindowLabel: planningWindow?.label,
    }
  }

  if (!planningWindow) {
    return {
      status: 'unknown_for_plan_window',
      required,
      proofSource: runtimeHoursProof.proofSource,
      structuredPeriodCount: runtimeHoursProof.structuredPeriods.length,
      textHoursAvailable: runtimeHoursProof.textHoursAvailable,
      planningWindowLabel: undefined,
    }
  }

  if (runtimeHoursProof.structuredPeriods.length === 0) {
    return {
      status: 'unknown_for_plan_window',
      required,
      proofSource: runtimeHoursProof.proofSource,
      structuredPeriodCount: 0,
      textHoursAvailable: runtimeHoursProof.textHoursAvailable,
      planningWindowLabel: planningWindow.label,
    }
  }

  return {
    status: isOpenDuringPlanningWindow(
      runtimeHoursProof.structuredPeriods,
      planningWindow,
    )
      ? 'open_for_plan_window'
      : 'closed_for_plan_window',
    required,
    proofSource: runtimeHoursProof.proofSource,
    structuredPeriodCount: runtimeHoursProof.structuredPeriods.length,
    textHoursAvailable: runtimeHoursProof.textHoursAvailable,
    planningWindowLabel: planningWindow.label,
  }
}
