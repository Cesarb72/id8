import { runGeneratePlan } from '../runGeneratePlan'
import type { SourceMode } from '../types/sourceMode'
import type { StarterPack } from '../types/starterPack'
import type { IntentInput } from '../types/intent'
import { buildContinuationDisplayItinerary } from './buildContinuationDisplayItinerary'
import { deriveNextContext } from './deriveNextContext'
import type { ExplorationPlan } from './types'

interface PlanExplorationOptions {
  starterPack?: StarterPack
  debugMode?: boolean
  strictShape?: boolean
  sourceMode?: SourceMode
  sourceModeOverrideApplied?: boolean
}

export async function planExploration(
  input: IntentInput,
  options: PlanExplorationOptions = {},
): Promise<ExplorationPlan> {
  const arc1 = await runGeneratePlan(input, {
    starterPack: options.starterPack,
    debugMode: options.debugMode,
    strictShape: options.strictShape,
    sourceMode: options.sourceMode,
    sourceModeOverrideApplied: options.sourceModeOverrideApplied,
  })
  const transition = deriveNextContext(arc1)
  const arc2 = await runGeneratePlan(transition.nextIntent, {
    starterPack: options.starterPack,
    debugMode: options.debugMode,
    strictShape: options.strictShape,
    sourceMode: options.sourceMode,
    sourceModeOverrideApplied: options.sourceModeOverrideApplied,
  })

  return {
    arc1,
    transition,
    arc2,
    displayItinerary: buildContinuationDisplayItinerary({
      arc1,
      transition,
      arc2,
      displayItinerary: arc2.itinerary,
    }),
  }
}
