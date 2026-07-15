import type {
  ConciergeIntent,
  ConciergeObjectiveOccasion,
  ConciergeObjectiveSource,
} from '../../types/intent'

export interface ObjectiveVisibilityProjection {
  source: 'interpretation'
  objectiveOccasion: ConciergeObjectiveOccasion
  objectiveSource: ConciergeObjectiveSource
  objectiveDefaulted: boolean
  provenanceOnly: true
  behaviorDriving: false
  userFacingControlRecommended: false
  recommendation: string
}

export function projectObjectiveVisibility(
  conciergeIntent: ConciergeIntent,
): ObjectiveVisibilityProjection {
  const objectiveSource =
    conciergeIntent.objectiveSource ??
    (conciergeIntent.objectiveDefaulted ? 'defaulted' : 'user_supplied')
  const objectiveDefaulted = objectiveSource === 'defaulted'

  return {
    source: 'interpretation',
    objectiveOccasion: conciergeIntent.objective.occasion,
    objectiveSource,
    objectiveDefaulted,
    provenanceOnly: true,
    behaviorDriving: false,
    userFacingControlRecommended: false,
    recommendation:
      'Keep Objective internal until Chapter B composition makes Explore/Connect/Celebrate behavior-distinct.',
  }
}
