import { buildPlanStoryContext } from './buildPlanNarrative'
import type { IntentProfile } from '../types/intent'
import type { Itinerary } from '../types/itinerary'

type PlanStoryInput = Pick<
  Itinerary,
  'city' | 'neighborhood' | 'stops' | 'estimatedTotalLabel' | 'routeFeelLabel' | 'totalRouteFriction'
>

function isLingeringCategory(category?: string): boolean {
  return category === 'dessert' || category === 'cafe' || category === 'park'
}

export function buildPlanSubtitle(intent: IntentProfile, itinerary: PlanStoryInput): string {
  const story = buildPlanStoryContext(intent, itinerary)
  const start = story.startStop
  const windDown = story.windDownStop

  const opening =
    start && start.driveMinutes <= 10
      ? 'Start close by'
      : story.routeShape === 'wandering'
        ? 'Open with a little room to settle in'
        : 'Open without stretching the route'

  const middle = story.hasSurprise
    ? 'leave space to wander a little around the middle'
    : story.routeShape === 'tight'
      ? 'let the centerpiece carry the route'
      : 'build into a stronger centerpiece'

  const finish =
    windDown && isLingeringCategory(windDown.category)
      ? 'then finish somewhere worth lingering.'
      : story.routeShape === 'tight'
        ? 'then close out nearby.'
        : 'then land on an easy finish.'

  return `${story.routeFeelLabel}, ${story.estimatedTotalLabel}. ${opening}, ${middle}, ${finish}`
}
