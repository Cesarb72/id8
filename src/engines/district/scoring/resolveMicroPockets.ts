import { haversineDistanceM } from '../../../domain/shared/geo/geoDistance'
import { resolveStructuralMicroPockets } from '../../../domain/interpretation/district/intelligence/hyperlocal/resolveStructuralMicroPockets'
import type {
  DistrictMicroPocket,
  IdentifiedPocket,
  PlaceEntity,
} from '../types/districtTypes'

type ResolveMicroPocketsResult = {
  microPockets: DistrictMicroPocket[]
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function toFixed(value: number): number {
  return Number(value.toFixed(3))
}

function getPrimaryCategory(entity: PlaceEntity): string {
  return entity.categories[0] ?? entity.type
}

function computeAnchorCandidateIds(
  entities: PlaceEntity[],
  dominantCategories: string[],
  dominantLanes: string[],
  centroid: { lat: number; lng: number },
  radiusM: number,
): string[] {
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

function buildMicroPocket(
  structuralMicroPocket: ReturnType<typeof resolveStructuralMicroPockets>['structuralMicroPockets'][number],
): DistrictMicroPocket {
  const { entities } = structuralMicroPocket
  const experienceForwardCount = entities.filter(
    (entity) =>
      ['activity', 'event', 'program', 'hub'].includes(entity.type) ||
      entity.categories.some((category) =>
        ['bar', 'restaurant', 'cafe', 'museum', 'event', 'activity'].includes(
          category.toLowerCase(),
        ),
      ),
  ).length
  const experienceForwardSignal = clamp(
    experienceForwardCount / Math.max(1, entities.length),
    0,
    1,
  )
  const identityStrength = clamp(
    structuralMicroPocket.coherenceScore * 0.3 +
      structuralMicroPocket.categoryDiversity * 0.18 +
      structuralMicroPocket.laneDiversity * 0.14 +
      (experienceForwardSignal >= 0.55 ? 0.2 : 0.09) +
      (structuralMicroPocket.categoryDiversity >= 0.6 &&
      structuralMicroPocket.laneDiversity >= 0.5
        ? 0.18
        : 0.08),
    0,
    1,
  )
  const activationStrength = clamp(
    structuralMicroPocket.densitySignal * 0.42 +
      structuralMicroPocket.categoryDiversity * 0.2 +
      structuralMicroPocket.laneDiversity * 0.14 +
      structuralMicroPocket.compactness * 0.12 +
      experienceForwardSignal * 0.12,
    0,
    1,
  )
  const environmentalInfluencePotential = clamp(
    activationStrength * 0.48 +
      structuralMicroPocket.categoryMixAdaptability * 0.24 +
      structuralMicroPocket.categoryDiversity * 0.16 +
      structuralMicroPocket.densitySignal * 0.12,
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
  if (structuralMicroPocket.compactness >= 0.58) {
    reasonSignals.push('tight_walkable_micro_pocket')
  }
  if (reasonSignals.length === 0) {
    reasonSignals.push('baseline_micro_pocket')
  }

  return {
    id: structuralMicroPocket.id,
    centroid: structuralMicroPocket.centroid,
    radiusM: toFixed(structuralMicroPocket.radiusM),
    entityIds: entities.map((entity) => entity.id),
    dominantCategories: structuralMicroPocket.dominantCategories,
    dominantLanes: structuralMicroPocket.dominantLanes,
    coherenceScore: toFixed(structuralMicroPocket.coherenceScore),
    identityStrength: toFixed(identityStrength),
    activationStrength: toFixed(activationStrength),
    environmentalInfluencePotential: toFixed(environmentalInfluencePotential),
    anchorCandidateIds: computeAnchorCandidateIds(
      entities,
      structuralMicroPocket.dominantCategories,
      structuralMicroPocket.dominantLanes,
      structuralMicroPocket.centroid,
      structuralMicroPocket.radiusM,
    ),
    reasonSignals,
  }
}

function rankMicroPockets(microPockets: DistrictMicroPocket[]): DistrictMicroPocket[] {
  return microPockets
    .slice()
    .sort((left, right) => {
      const leftScore =
        left.identityStrength * 0.34 +
        left.activationStrength * 0.31 +
        left.environmentalInfluencePotential * 0.21 +
        left.coherenceScore * 0.14
      const rightScore =
        right.identityStrength * 0.34 +
        right.activationStrength * 0.31 +
        right.environmentalInfluencePotential * 0.21 +
        right.coherenceScore * 0.14
      if (rightScore !== leftScore) {
        return rightScore - leftScore
      }
      if (right.entityIds.length !== left.entityIds.length) {
        return right.entityIds.length - left.entityIds.length
      }
      return left.id.localeCompare(right.id)
    })
}

export function resolveMicroPockets(pocket: IdentifiedPocket): ResolveMicroPocketsResult {
  const structuralResolution = resolveStructuralMicroPockets(pocket)
  return {
    microPockets: rankMicroPockets(
      structuralResolution.structuralMicroPockets.map((structuralMicroPocket) =>
        buildMicroPocket(structuralMicroPocket),
      ),
    ),
  }
}
