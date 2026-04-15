import type { Itinerary, ItineraryTransition, UserStopRole } from '../types/itinerary'

export type DistrictFlowTransition = 'stay_local' | 'short_move' | 'district_shift'
export type DistrictFlowRole = 'start' | 'highlight' | 'windDown'

export interface DistrictFlowStep {
  district: string
  role: DistrictFlowRole
  reason: string
  transitionFromPrev?: DistrictFlowTransition
}

interface NarrativeAnchor {
  district: string
  role: DistrictFlowRole
  stopIndex: number
}

function getDistrictLabel(itinerary: Itinerary, stopIndex: number): string {
  return itinerary.stops[stopIndex]?.neighborhood || itinerary.neighborhood || itinerary.city
}

function findRoleIndex(itinerary: Itinerary, role: UserStopRole): number {
  return itinerary.stops.findIndex((stop) => stop.role === role)
}

function buildSingleDistrictStep(itinerary: Itinerary): DistrictFlowStep[] {
  const highlightIndex = findRoleIndex(itinerary, 'highlight')
  const district = getDistrictLabel(itinerary, Math.max(highlightIndex, 0))

  return [
    {
      district,
      role: 'highlight',
      reason: 'Everything stays anchored here.',
    },
  ]
}

function buildStructuralAnchors(itinerary: Itinerary): NarrativeAnchor[] {
  const roles: DistrictFlowRole[] = ['start', 'highlight', 'windDown']
  const anchors = roles
    .map((role) => {
      const stopIndex = findRoleIndex(itinerary, role)
      if (stopIndex < 0) {
        return undefined
      }
      return {
        district: getDistrictLabel(itinerary, stopIndex),
        role,
        stopIndex,
      }
    })
    .filter((anchor): anchor is NarrativeAnchor => Boolean(anchor))

  return anchors.sort((left, right) => left.stopIndex - right.stopIndex)
}

function classifySingleTransition(transition: ItineraryTransition): DistrictFlowTransition {
  if (transition.neighborhoodContinuity === 'same-neighborhood') {
    return 'stay_local'
  }
  if (
    transition.neighborhoodContinuity === 'adjacent-neighborhoods' ||
    transition.estimatedTravelMinutes <= 12
  ) {
    return 'short_move'
  }
  return 'district_shift'
}

function classifyTransitionRange(
  itinerary: Itinerary,
  fromStopIndex: number,
  toStopIndex: number,
): DistrictFlowTransition {
  const transitions = itinerary.transitions.slice(fromStopIndex, toStopIndex)

  if (transitions.length === 0) {
    return 'stay_local'
  }

  if (transitions.some((transition) => classifySingleTransition(transition) === 'district_shift')) {
    return 'district_shift'
  }
  if (transitions.some((transition) => classifySingleTransition(transition) === 'short_move')) {
    return 'short_move'
  }
  return 'stay_local'
}

function buildReason(role: DistrictFlowRole, steps: NarrativeAnchor[], index: number): string {
  if (steps.length === 1) {
    return 'Everything stays anchored here.'
  }
  if (role === 'start') {
    return 'Good density to get started.'
  }
  if (role === 'windDown') {
    return 'Quieter area to wind down.'
  }

  const startDistrict = steps[0]?.district
  const endDistrict = steps[steps.length - 1]?.district
  if (steps[index]?.district === startDistrict || steps[index]?.district === endDistrict) {
    return 'This is where the night finds its center.'
  }
  return 'Strong center of activity.'
}

export function deriveDistrictFlowNarrative(itinerary: Itinerary): DistrictFlowStep[] {
  if (itinerary.stops.length === 0) {
    return []
  }

  const districts = new Set(
    itinerary.stops.map((stop) => stop.neighborhood || itinerary.neighborhood || itinerary.city),
  )
  if (districts.size <= 1) {
    return buildSingleDistrictStep(itinerary)
  }

  const anchors = buildStructuralAnchors(itinerary).slice(0, 3)

  return anchors.map((anchor, index) => ({
    district: anchor.district,
    role: anchor.role,
    reason: buildReason(anchor.role, anchors, index),
    transitionFromPrev:
      index > 0
        ? classifyTransitionRange(itinerary, anchors[index - 1]!.stopIndex, anchor.stopIndex)
        : undefined,
  }))
}
