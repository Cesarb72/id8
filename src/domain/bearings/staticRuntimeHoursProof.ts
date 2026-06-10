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

function isValidPeriodPoint(point: HoursPeriod['open']): boolean {
  return (
    point !== undefined &&
    Number.isInteger(point.day) &&
    point.day >= 0 &&
    point.day <= 6 &&
    Number.isInteger(point.hour) &&
    point.hour >= 0 &&
    point.hour <= 23 &&
    Number.isInteger(point.minute) &&
    point.minute >= 0 &&
    point.minute <= 59
  )
}

function isValidPlanningWindow(planningWindow: PlanningTimeWindowSignal): boolean {
  return isValidPeriodPoint({
    day: planningWindow.day,
    hour: planningWindow.hour,
    minute: planningWindow.minute,
  })
}

function isOpenDuringPlanningWindow(
  periods: HoursPeriod[],
  planningWindow: PlanningTimeWindowSignal,
): boolean | undefined {
  if (!isValidPlanningWindow(planningWindow)) {
    return undefined
  }

  const targetMinute = toWeeklyMinute(
    planningWindow.day,
    planningWindow.hour,
    planningWindow.minute,
  )
  let validPeriodCount = 0

  for (const period of periods) {
    if (!isValidPeriodPoint(period.open) || !isValidPeriodPoint(period.close)) {
      continue
    }
    validPeriodCount += 1

    let openMinute = toWeeklyMinute(
      period.open!.day,
      period.open!.hour,
      period.open!.minute,
    )
    let closeMinute = toWeeklyMinute(
      period.close!.day,
      period.close!.hour,
      period.close!.minute,
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

  if (validPeriodCount === 0) {
    return undefined
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

  const openDuringWindow = isOpenDuringPlanningWindow(
    runtimeHoursProof.structuredPeriods,
    planningWindow,
  )

  return {
    status:
      openDuringWindow === undefined
        ? 'unknown_for_plan_window'
        : openDuringWindow
          ? 'open_for_plan_window'
          : 'closed_for_plan_window',
    required,
    proofSource: runtimeHoursProof.proofSource,
    structuredPeriodCount: runtimeHoursProof.structuredPeriods.length,
    textHoursAvailable: runtimeHoursProof.textHoursAvailable,
    planningWindowLabel: planningWindow.label,
  }
}
