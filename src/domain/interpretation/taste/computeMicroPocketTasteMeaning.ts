import { haversineDistanceM } from '../../shared/geo/geoDistance'
import type { PlaceEntity } from '../../../engines/district/types/districtTypes'

type MicroPocketTasteMeaningInput = {
  entities: PlaceEntity[]
  dominantCategories: string[]
  dominantLanes: string[]
  centroid: { lat: number; lng: number }
  radiusM: number
  coherenceScore: number
  categoryDiversity: number
  laneDiversity: number
  compactness: number
  densitySignal: number
  categoryMixAdaptability: number
}

type MicroPocketTasteMeaningResult = {
  identityStrength: number
  activationStrength: number
  environmentalInfluencePotential: number
  anchorCandidateIds: string[]
  reasonSignals: string[]
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function getPrimaryCategory(entity: PlaceEntity): string {
  return entity.categories[0] ?? entity.type
}

function computeAnchorCandidateIds({
  entities,
  dominantCategories,
  dominantLanes,
  centroid,
  radiusM,
}: Pick<
  MicroPocketTasteMeaningInput,
  'entities' | 'dominantCategories' | 'dominantLanes' | 'centroid' | 'radiusM'
>): string[] {
  if (entities.length === 0) {
    return []
  }
  const supportBandM = Math.max(80, radiusM * 0.8)
  return entities
    .map((entity) => {
      const distanceToCentroid = haversineDistanceM(entity.location, centroid)
      const proximityScore = clamp(1 - distanceToCentroid / Math.max(120, radiusM * 1.2), 0, 1)
      const category = getPrimaryCategory(entity)
      const categoryAlignment = dominantCategories.includes(category) ? 1 : 0.45
      const laneAlignment = dominantLanes.includes(entity.type) ? 1 : 0.5
      const supportCount = entities.filter((candidate) => {
        if (candidate.id === entity.id) {
          return false
        }
        return haversineDistanceM(candidate.location, entity.location) <= supportBandM
      }).length
      const supportDensityScore = clamp(supportCount / Math.max(1, entities.length - 1), 0, 1)
      const experienceForwardSignal =
        ['activity', 'event', 'program', 'hub'].includes(entity.type) ||
        entity.categories.some((value) =>
          ['bar', 'restaurant', 'cafe', 'museum', 'event', 'activity'].includes(
            value.toLowerCase(),
          ),
        )
          ? 1
          : 0.42
      const score =
        proximityScore * 0.34 +
        categoryAlignment * 0.24 +
        laneAlignment * 0.18 +
        supportDensityScore * 0.14 +
        experienceForwardSignal * 0.1
      return {
        entityId: entity.id,
        score,
      }
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }
      return left.entityId.localeCompare(right.entityId)
    })
    .slice(0, 4)
    .map((entry) => entry.entityId)
}

export function computeMicroPocketTasteMeaning(
  input: MicroPocketTasteMeaningInput,
): MicroPocketTasteMeaningResult {
  const experienceForwardCount = input.entities.filter(
    (entity) =>
      ['activity', 'event', 'program', 'hub'].includes(entity.type) ||
      entity.categories.some((category) =>
        ['bar', 'restaurant', 'cafe', 'museum', 'event', 'activity'].includes(
          category.toLowerCase(),
        ),
      ),
  ).length
  const experienceForwardSignal = clamp(
    experienceForwardCount / Math.max(1, input.entities.length),
    0,
    1,
  )
  const identityStrength = clamp(
    input.coherenceScore * 0.3 +
      input.categoryDiversity * 0.18 +
      input.laneDiversity * 0.14 +
      (experienceForwardSignal >= 0.55 ? 0.2 : 0.09) +
      (input.categoryDiversity >= 0.6 && input.laneDiversity >= 0.5 ? 0.18 : 0.08),
    0,
    1,
  )
  const activationStrength = clamp(
    input.densitySignal * 0.42 +
      input.categoryDiversity * 0.2 +
      input.laneDiversity * 0.14 +
      input.compactness * 0.12 +
      experienceForwardSignal * 0.12,
    0,
    1,
  )
  const environmentalInfluencePotential = clamp(
    activationStrength * 0.48 +
      input.categoryMixAdaptability * 0.24 +
      input.categoryDiversity * 0.16 +
      input.densitySignal * 0.12,
    0,
    1,
  )
  const reasonSignals: string[] = []
  if (activationStrength >= 0.62) {
    reasonSignals.push('high_activation_core')
  } else if (activationStrength >= 0.48) {
    reasonSignals.push('steady_activation_base')
  }
  if (identityStrength >= 0.64) {
    reasonSignals.push('identity_forward_mix')
  } else if (identityStrength >= 0.5) {
    reasonSignals.push('identity_coherent_mix')
  }
  if (environmentalInfluencePotential >= 0.6) {
    reasonSignals.push('strong_environmental_influence')
  }
  if (input.compactness >= 0.58) {
    reasonSignals.push('tight_walkable_micro_pocket')
  }
  if (reasonSignals.length === 0) {
    reasonSignals.push('baseline_micro_pocket')
  }

  return {
    identityStrength,
    activationStrength,
    environmentalInfluencePotential,
    anchorCandidateIds: computeAnchorCandidateIds(input),
    reasonSignals,
  }
}
