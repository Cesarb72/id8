import type { CrewPolicy } from '../types/crewPolicies'
import type { Venue } from '../types/venue'

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function scoreCrewFit(venue: Venue, crewPolicy: CrewPolicy): number {
  if (crewPolicy.blockedCategories.includes(venue.category)) {
    return 0
  }

  const preferredScore = crewPolicy.preferredCategories.includes(venue.category) ? 1 : 0.55
  const discouragedPenalty = crewPolicy.discouragedCategories.includes(venue.category) ? 0.28 : 0
  const useCaseScore = venue.useCases.includes(crewPolicy.crew) ? 1 : 0.6
  const energyDistance = Math.abs(venue.energyLevel - crewPolicy.targetEnergy)
  const energyScore = clamp01(1 - energyDistance / 4)
  const vibeMatchScore = venue.vibeTags.some((tag) => crewPolicy.preferredVibes?.includes(tag))
    ? 1
    : 0.58

  return clamp01(
    preferredScore * 0.35 +
      useCaseScore * 0.3 +
      energyScore * 0.2 +
      vibeMatchScore * 0.15 -
      discouragedPenalty,
  )
}
