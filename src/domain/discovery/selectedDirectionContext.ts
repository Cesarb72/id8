import type { SelectedDirectionContext } from '../types/intent'
import type { DiscoveryDirection } from './getDiscoveryCandidates'

export function getDirectionLeadVenueIds(direction: DiscoveryDirection): string[] {
  return Array.from(
    new Set(
      direction.groups
        .map((group) => group.candidates[0]?.venueId)
        .filter((value): value is string => Boolean(value)),
    ),
  )
}

export function toSelectedDirectionContext(
  direction: DiscoveryDirection,
): SelectedDirectionContext {
  return {
    directionId: direction.id,
    label: direction.title,
    subtitle: direction.narrative,
    pocketId: direction.id,
  }
}

export function resolveSelectedDirectionContextFromDiscoverySelection(
  selectedVenueIds: string[],
  discoveryDirections?: DiscoveryDirection[],
): SelectedDirectionContext | undefined {
  if (selectedVenueIds.length === 0 || !discoveryDirections || discoveryDirections.length === 0) {
    return undefined
  }

  for (const direction of discoveryDirections) {
    const leadVenueIds = getDirectionLeadVenueIds(direction)
    if (leadVenueIds.length === 0) {
      continue
    }
    if (!leadVenueIds.every((venueId) => selectedVenueIds.includes(venueId))) {
      continue
    }
    return toSelectedDirectionContext(direction)
  }

  return undefined
}
