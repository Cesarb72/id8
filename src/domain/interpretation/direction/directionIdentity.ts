import type { DirectionExperienceFamily, DirectionIdentity } from '../../types/intent'
import type { Itinerary, ItineraryStop } from '../../types/itinerary'

export type DirectionIdentityMode = DirectionIdentity
export type DirectionIdentityCluster = 'lively' | 'chill' | 'explore'

export interface InferDirectionIdentityFromSignalsInput {
  experienceFamily?: DirectionExperienceFamily | string
  cluster: DirectionIdentityCluster
  archetype?: string
  label?: string
  subtitle?: string
  laneIdentity?: string
  macroLane?: string
}

type IdentitySignalSource = Pick<ItineraryStop, 'category' | 'tags'>

export function isSocialIdentitySignal(source: IdentitySignalSource): boolean {
  const tags = new Set(source.tags.map((tag) => tag.toLowerCase()))
  return (
    source.category === 'bar' ||
    source.category === 'live_music' ||
    ['social', 'live', 'music', 'jazz', 'cocktails'].some((tag) => tags.has(tag))
  )
}

export function isExploratoryIdentitySignal(source: IdentitySignalSource): boolean {
  const tags = new Set(source.tags.map((tag) => tag.toLowerCase()))
  return (
    source.category === 'museum' ||
    source.category === 'activity' ||
    source.category === 'park' ||
    ['culture', 'gallery', 'explore', 'walkable'].some((tag) => tags.has(tag))
  )
}

export function isIntimateIdentitySignal(source: IdentitySignalSource): boolean {
  const tags = new Set(source.tags.map((tag) => tag.toLowerCase()))
  return (
    source.category === 'restaurant' ||
    ['quiet', 'cozy', 'tea', 'dessert', 'courtyard'].some((tag) => tags.has(tag))
  )
}

export function matchesDirectionIdentitySignal(
  source: IdentitySignalSource,
  identity: DirectionIdentityMode,
): boolean {
  if (identity === 'social') {
    return isSocialIdentitySignal(source)
  }
  if (identity === 'exploratory') {
    return isExploratoryIdentitySignal(source)
  }
  return isIntimateIdentitySignal(source)
}

export function inferDirectionIdentityFromSignals(
  params: InferDirectionIdentityFromSignalsInput,
): DirectionIdentityMode {
  const family = params.experienceFamily?.toLowerCase()
  if (family && ['intimate', 'ambient', 'indulgent'].includes(family)) {
    return 'intimate'
  }
  if (family && ['social', 'eventful', 'playful'].includes(family)) {
    return 'social'
  }
  if (family && ['exploratory', 'cultural', 'ritual'].includes(family)) {
    return 'exploratory'
  }
  const laneHint = `${params.cluster} ${params.laneIdentity ?? ''} ${params.macroLane ?? ''} ${
    params.archetype ?? ''
  } ${params.label ?? ''} ${params.subtitle ?? ''}`.toLowerCase()
  if (/intimate|dining|restaurant|ambient|cozy|romantic|wine|courtyard|quiet/.test(laneHint)) {
    return 'intimate'
  }
  if (/lively|social|eventful|activity|night|cocktail|bar|live/.test(laneHint)) {
    return 'social'
  }
  if (/explore|culture|museum|gallery|district|curated/.test(laneHint)) {
    return 'exploratory'
  }
  if (params.cluster === 'chill') {
    return 'intimate'
  }
  if (params.cluster === 'lively') {
    return 'social'
  }
  return 'exploratory'
}

export function inferObservedDirectionIdentity(params: {
  itinerary: Itinerary
  expectedDirectionIdentity?: DirectionIdentityMode
}): DirectionIdentityMode {
  const { itinerary, expectedDirectionIdentity } = params
  const counts: Record<DirectionIdentityMode, number> = {
    social: 0,
    exploratory: 0,
    intimate: 0,
  }
  itinerary.stops.forEach((stop) => {
    if (isSocialIdentitySignal(stop)) {
      counts.social += 1
    }
    if (isExploratoryIdentitySignal(stop)) {
      counts.exploratory += 1
    }
    if (isIntimateIdentitySignal(stop)) {
      counts.intimate += 1
    }
  })
  if (expectedDirectionIdentity && counts[expectedDirectionIdentity] > 0) {
    return expectedDirectionIdentity
  }
  const ranked = (Object.keys(counts) as DirectionIdentityMode[]).sort((left, right) => {
    if (counts[right] !== counts[left]) {
      return counts[right] - counts[left]
    }
    const tiebreakOrder: DirectionIdentityMode[] = ['intimate', 'social', 'exploratory']
    return tiebreakOrder.indexOf(left) - tiebreakOrder.indexOf(right)
  })
  return ranked[0] ?? 'exploratory'
}
