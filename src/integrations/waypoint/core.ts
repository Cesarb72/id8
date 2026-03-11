import {
  generateIdeaDatePlan,
  type AnchorType,
  type CrewType,
  type MagicRefinement,
} from '../../../../waypoint/lib/core/index'

export type { Plan } from '../../../../waypoint/lib/core/index'

export type WaypointSmokeTestInput = {
  crew: CrewType
  anchor: AnchorType
  magicRefinement: MagicRefinement
}

export type WaypointSmokeTestResult = {
  planId: string
  cacheKey: string
  wildcardInjected: 0 | 1
  stopCount: number
  planTitle: string
  appliedChecks: {
    nonPredictable: boolean
    cohesiveArc: boolean
    crewGuardrails: boolean
  }
  reportNotes: string[]
}

const defaultSmokeInput: WaypointSmokeTestInput = {
  crew: 'friends',
  anchor: 'creative',
  magicRefinement: 'more_unique',
}

export function generateSmokeTestPlan(
  input: Partial<WaypointSmokeTestInput> = {}
): WaypointSmokeTestResult {
  const mergedInput: WaypointSmokeTestInput = {
    ...defaultSmokeInput,
    ...input,
  }
  const result = generateIdeaDatePlan(mergedInput)

  return {
    planId: result.planId,
    cacheKey: result.cacheKey,
    wildcardInjected: result.report.wildcardInjected,
    stopCount: result.plan.stops.length,
    planTitle: result.plan.title,
    appliedChecks: result.report.applied,
    reportNotes: result.report.notes.slice(0, 5),
  }
}
