import type {
  ConciergeIntent,
  ContractConstraints,
  DirectionExperienceFamily,
  ResolvedDirectionContext,
  RouteShapeArcShape,
} from '../../types/intent'
import type { DirectionIdentityMode, DirectionPlanningSelection } from './selectedDirectionProjection'

export interface DirectionRouteShapeComposition {
  source: 'direction'
  selectedDirectionId: string
  selectedPocketId: string
  selectedDirectionIdentity: DirectionIdentityMode
  selectedDirection: Pick<
    DirectionPlanningSelection,
    | 'id'
    | 'label'
    | 'pocketId'
    | 'pocketLabel'
    | 'archetype'
    | 'cluster'
    | 'identity'
    | 'experienceFamily'
    | 'familyConfidence'
  >
  selectedDirectionContext: Pick<
    ResolvedDirectionContext,
    'selectedDirectionId' | 'selectedPocketId' | 'label' | 'archetype' | 'identity'
  >
  conciergeIntentId: ConciergeIntent['id']
  contractConstraintsId: ContractConstraints['id']
  intendedArcShape: RouteShapeArcShape
  experienceFamily?: DirectionExperienceFamily
  familyConfidence?: number
  compositionPosture: {
    requireEscalation: boolean
    peakCountModel: ContractConstraints['peakCountModel']
    highlightPressure: ContractConstraints['highlightPressure']
    requireContinuity: boolean
  }
}
