/**
 * ARC BOUNDARY: canonical Surprise C1 transport helper.
 *
 * Constructs the existing RouteShapeContract carrier only after canonical
 * Surprise direction and Interpretation inputs are resolved. Meaning authority
 * remains with ConciergeIntent / ExperienceContract / ContractConstraints.
 */
import { buildRouteShapeContract } from './directionPlanning'
import type { CanonicalInterpretationBundle } from '../interpretation/buildCanonicalInterpretationBundle'
import type { DirectionPlanningSelection } from '../interpretation/direction/selectedDirectionProjection'
import type {
  ConciergeIntent,
  ResolvedDirectionContext,
  RouteShapeContract,
} from '../types/intent'

export interface BuildCanonicalSurpriseC1RouteShapeContractInput {
  conciergeIntent: ConciergeIntent
  canonicalInterpretationBundle: CanonicalInterpretationBundle
  selectedDirection: DirectionPlanningSelection
  selectedDirectionContext: ResolvedDirectionContext
}

export function buildCanonicalSurpriseC1RouteShapeContract(
  input: BuildCanonicalSurpriseC1RouteShapeContractInput,
): RouteShapeContract {
  const {
    conciergeIntent,
    canonicalInterpretationBundle,
    selectedDirection,
    selectedDirectionContext,
  } = input
  console.assert(
    conciergeIntent.intentMode === 'surprise',
    '[ARC-BOUNDARY] canonical Surprise C1 transport requires Surprise ConciergeIntent.',
  )
  console.assert(
    canonicalInterpretationBundle.normalizedIntent.id === conciergeIntent.id,
    '[ARC-BOUNDARY] canonical Surprise C1 transport requires aligned ConciergeIntent.',
  )
  console.assert(
    selectedDirectionContext.selectedDirectionId === selectedDirection.id,
    '[ARC-BOUNDARY] canonical Surprise C1 transport requires aligned selected Direction.',
  )
  return buildRouteShapeContract({
    selectedDirection,
    selectedDirectionContext,
    conciergeIntent,
    contractConstraints: canonicalInterpretationBundle.contractConstraints,
  })
}
