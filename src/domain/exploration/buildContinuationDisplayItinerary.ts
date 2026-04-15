import { buildShareSummary } from '../itinerary/buildShareSummary'
import { generateStorySpine } from '../itinerary/generateStorySpine'
import { getRouteFeelLabel } from '../taste/getRouteFeelLabel'
import { createId } from '../../lib/ids'
import type { GeneratePlanResult } from '../runGeneratePlan'
import type { Itinerary, ItineraryStop, ItineraryTransition } from '../types/itinerary'
import type { ExplorationPlan } from './types'

function formatEstimatedTotalLabel(minutes: number): string {
  const rounded = Math.max(30, Math.round(minutes / 15) * 15)
  const hours = Math.floor(rounded / 60)
  const remainder = rounded % 60

  if (rounded < 60) {
    return `about ${rounded} min`
  }
  if (remainder === 0) {
    return `about ${hours} hour${hours === 1 ? '' : 's'}`
  }
  if (remainder === 30) {
    return `about ${hours}.5 hours`
  }
  return `about ${hours} hour${hours === 1 ? '' : 's'} ${remainder} min`
}

function isSoftExtensionStop(result: GeneratePlanResult, index: number): boolean {
  const stop = result.itinerary.stops[index]
  const arcStop = result.selectedArc.stops[index]?.scoredVenue.venue
  if (!stop || !arcStop) {
    return false
  }

  if (stop.role === 'start' || stop.role === 'highlight') {
    return false
  }
  if (
    stop.category === 'restaurant' ||
    stop.category === 'live_music' ||
    stop.category === 'event' ||
    stop.category === 'museum'
  ) {
    return false
  }
  if (stop.category === 'dessert' || stop.category === 'park') {
    return true
  }
  if (stop.category === 'cafe') {
    return arcStop.energyLevel <= 3 && stop.estimatedDurationMinutes <= 80
  }
  if (stop.category === 'bar') {
    return arcStop.energyLevel <= 3 && stop.estimatedDurationMinutes <= 95
  }
  return false
}

function isCompactEligibleStop(result: GeneratePlanResult, index: number): boolean {
  const stop = result.itinerary.stops[index]
  const arcStop = result.selectedArc.stops[index]?.scoredVenue.venue
  if (!stop || !arcStop) {
    return false
  }

  if (stop.role === 'start') {
    return false
  }
  if (
    stop.category === 'restaurant' ||
    stop.category === 'live_music' ||
    stop.category === 'event' ||
    stop.category === 'museum'
  ) {
    return false
  }
  if (stop.category === 'dessert' || stop.category === 'park') {
    return true
  }
  if (stop.category === 'cafe') {
    return arcStop.energyLevel <= 3 && stop.estimatedDurationMinutes <= 90
  }
  if (stop.category === 'bar') {
    return arcStop.energyLevel <= 3 && stop.estimatedDurationMinutes <= 105
  }
  return false
}

function isCompactLandingStop(result: GeneratePlanResult, index: number): boolean {
  const stop = result.itinerary.stops[index]
  const arcStop = result.selectedArc.stops[index]?.scoredVenue.venue
  if (!stop || !arcStop) {
    return false
  }

  return (
    stop.role === 'windDown' &&
    (
      stop.category === 'park' ||
      stop.category === 'dessert' ||
      stop.category === 'cafe' ||
      (stop.category === 'bar' && arcStop.energyLevel <= 2)
    )
  )
}

function canUseCompactPair(
  result: GeneratePlanResult,
  firstIndex: number,
  secondIndex: number,
): boolean {
  const firstStop = result.itinerary.stops[firstIndex]
  const secondStop = result.itinerary.stops[secondIndex]
  const firstVenue = result.selectedArc.stops[firstIndex]?.scoredVenue.venue
  const secondVenue = result.selectedArc.stops[secondIndex]?.scoredVenue.venue
  if (!firstStop || !secondStop || !firstVenue || !secondVenue) {
    return false
  }

  return (
    secondIndex === firstIndex + 1 &&
    isCompactEligibleStop(result, firstIndex) &&
    isCompactEligibleStop(result, secondIndex) &&
    isCompactLandingStop(result, secondIndex) &&
    secondVenue.energyLevel <= firstVenue.energyLevel &&
    firstStop.category !== 'restaurant'
  )
}

function pickCompactStopIndices(
  result: GeneratePlanResult,
  maxStops: number,
): number[] {
  const isEligibleStop = maxStops === 1 ? isSoftExtensionStop : isCompactEligibleStop
  const lastIndex = result.itinerary.stops.length - 1
  if (lastIndex < 0) {
    return []
  }

  let pivotIndex = lastIndex
  while (pivotIndex >= 0 && !isEligibleStop(result, pivotIndex)) {
    pivotIndex -= 1
  }

  if (pivotIndex < 0) {
    return [lastIndex]
  }

  if (maxStops === 1) {
    return [pivotIndex]
  }

  const previousIndex = pivotIndex - 1
  if (previousIndex >= 0 && canUseCompactPair(result, previousIndex, pivotIndex)) {
    return [previousIndex, pivotIndex]
  }

  return [pivotIndex]
}

function buildCompactStory(
  plan: ExplorationPlan,
  stops: ItineraryStop[],
): Itinerary['story'] {
  const lead = stops[0]
  const continuationLabel = lead?.venueName ?? 'one more stop'
  if (plan.transition.continuationMode === 'CONTINUATION_FRAGMENT') {
    return {
      headline: 'A softer next move after the main outing.',
      subtitle:
        plan.transition.vibeShift === 'LAND'
          ? `Add ${continuationLabel} only if the night still has room for an easy finish.`
          : `Add ${continuationLabel} as a light continuation instead of starting a new route.`,
    }
  }

  return {
    headline: 'A compact next chapter after the main outing.',
    subtitle: `Keep it to ${stops.length === 1 ? 'one soft stop' : 'two soft beats'} so the continuation stays believable and does not restart the night.`,
  }
}

function buildCompactItinerary(
  plan: ExplorationPlan,
  maxStops: number,
): Itinerary {
  const indices = pickCompactStopIndices(plan.arc2, maxStops)
  const stops = indices
    .map((index) => plan.arc2.itinerary.stops[index])
    .filter(Boolean) as ItineraryStop[]
  const transitions =
    indices.length === 2 && indices[1] === indices[0] + 1
      ? [plan.arc2.itinerary.transitions[indices[0]!]]
          .filter(Boolean) as ItineraryTransition[]
      : []
  const estimatedStopMinutes = stops.reduce((sum, stop) => sum + stop.estimatedDurationMinutes, 0)
  const estimatedTransitionMinutes = transitions.reduce(
    (sum, transition) => sum + transition.estimatedTransitionMinutes,
    0,
  )
  const estimatedTotalMinutes = estimatedStopMinutes + estimatedTransitionMinutes
  const totalRouteFriction = transitions.reduce((sum, transition) => sum + transition.frictionScore, 0)
  const averageTransitionFriction =
    transitions.length > 0 ? Number((totalRouteFriction / transitions.length).toFixed(2)) : 0
  const neighborhoods = [...new Set(stops.map((stop) => stop.neighborhood))]
  const itineraryWithoutSummary: Omit<Itinerary, 'shareSummary'> = {
    id: createId('itinerary'),
    title:
      plan.transition.continuationMode === 'CONTINUATION_FRAGMENT'
        ? 'Optional Next Move'
        : 'Optional Next Chapter',
    city: plan.arc2.itinerary.city,
    neighborhood: neighborhoods.length === 1 ? neighborhoods[0] : plan.arc2.itinerary.neighborhood,
    crew: plan.arc2.itinerary.crew,
    vibes: [plan.transition.nextPrimaryVibe],
    stops,
    transitions,
    totalRouteFriction,
    estimatedTotalMinutes,
    estimatedTotalLabel: formatEstimatedTotalLabel(estimatedTotalMinutes),
    routeFeelLabel:
      transitions.length === 0
        ? plan.transition.continuationMode === 'CONTINUATION_FRAGMENT'
          ? 'A light optional landing'
          : 'A compact optional continuation'
        : getRouteFeelLabel({
            estimatedTotalMinutes,
            averageTransitionFriction,
            totalRouteFriction,
            transitionCount: transitions.length,
          }),
    story: buildCompactStory(plan, stops),
    storySpine: generateStorySpine(
      {
        stops,
        transitions,
        totalRouteFriction,
      },
      {
        vibe: plan.transition.nextPrimaryVibe,
        crew: plan.arc2.itinerary.crew,
        persona: plan.arc2.intentProfile.persona,
      },
    ),
  }

  return {
    ...itineraryWithoutSummary,
    shareSummary: buildShareSummary(itineraryWithoutSummary),
  }
}

export function buildContinuationDisplayItinerary(plan: ExplorationPlan): Itinerary {
  if (plan.transition.continuationMode === 'CONTINUATION_FRAGMENT') {
    return buildCompactItinerary(plan, 1)
  }
  if (plan.transition.continuationMode === 'COMPACT_CONTINUATION') {
    return buildCompactItinerary(plan, 2)
  }
  return plan.arc2.itinerary
}
