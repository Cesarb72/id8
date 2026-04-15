import type { InternalRole, Venue } from '../types/venue'

interface ScoreDominancePenaltyInput {
  venue: Venue
  contextSpecificityByRole: Record<InternalRole, number>
}

export interface DominancePenaltyScore {
  universalityScore: number
  flaggedUniversal: boolean
  byRole: Record<InternalRole, number>
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function roleAffinityUniversality(venue: Venue): number {
  const values = [
    venue.roleAffinity.warmup,
    venue.roleAffinity.peak,
    venue.roleAffinity.wildcard,
    venue.roleAffinity.cooldown,
  ]
  const max = Math.max(...values)
  const min = Math.min(...values)
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const spreadPenalty = clamp01(1 - (max - min))
  return clamp01(mean * 0.58 + spreadPenalty * 0.42)
}

function genericCategoryWeight(category: Venue['category']): number {
  if (category === 'restaurant' || category === 'cafe') {
    return 1
  }
  if (category === 'dessert' || category === 'activity') {
    return 0.55
  }
  return 0.22
}

export function scoreDominancePenalty({
  venue,
  contextSpecificityByRole,
}: ScoreDominancePenaltyInput): DominancePenaltyScore {
  const universalityScore = roleAffinityUniversality(venue)
  const genericWeight = genericCategoryWeight(venue.category)

  const warmupPenalty = clamp01(
    universalityScore * (1 - contextSpecificityByRole.warmup) * 0.06 + genericWeight * 0.01,
  )
  const peakPenalty = clamp01(
    universalityScore * (1 - contextSpecificityByRole.peak) * 0.2 + genericWeight * 0.07,
  )
  const wildcardPenalty = clamp01(
    universalityScore * (1 - contextSpecificityByRole.wildcard) * 0.12 + genericWeight * 0.03,
  )
  const cooldownPenalty = clamp01(
    universalityScore * (1 - contextSpecificityByRole.cooldown) * 0.08 + genericWeight * 0.02,
  )

  return {
    universalityScore,
    flaggedUniversal:
      universalityScore >= 0.72 &&
      (contextSpecificityByRole.peak < 0.68 || contextSpecificityByRole.wildcard < 0.66),
    byRole: {
      warmup: warmupPenalty,
      peak: peakPenalty,
      wildcard: wildcardPenalty,
      cooldown: cooldownPenalty,
    },
  }
}
