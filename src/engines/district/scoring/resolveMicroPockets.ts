import { dbscan } from '../clustering/dbscan'
import { centroidOf, haversineDistanceM } from '../clustering/geoDistance'
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

function countByKey(values: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count
      }
      return left.key.localeCompare(right.key)
    })
}

function getPrimaryCategory(entity: PlaceEntity): string {
  return entity.categories[0] ?? entity.type
}

function getMicroRadiusM(entities: PlaceEntity[], centroid: { lat: number; lng: number }): number {
  if (entities.length === 0) {
    return 0
  }
  return entities.reduce((maxValue, entity) => {
    const distance = haversineDistanceM(entity.location, centroid)
    return distance > maxValue ? distance : maxValue
  }, 0)
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
  pocketId: string,
  entities: PlaceEntity[],
  index: number,
): DistrictMicroPocket {
  const centroid = centroidOf(entities.map((entity) => entity.location))
  const radiusM = getMicroRadiusM(entities, centroid)
  const categoryCounts = countByKey(entities.map((entity) => getPrimaryCategory(entity)))
  const laneCounts = countByKey(entities.map((entity) => entity.type))
  const dominantCategories = categoryCounts.slice(0, 3).map((entry) => entry.key)
  const dominantLanes = laneCounts.slice(0, 3).map((entry) => entry.key)
  const categoryDiversity = clamp(categoryCounts.length / 5, 0, 1)
  const laneDiversity = clamp(laneCounts.length / 4, 0, 1)
  const compactness = clamp(1 - radiusM / 260, 0, 1)
  const categoryDominance =
    entities.length > 0 ? categoryCounts[0].count / entities.length : 0
  const laneDominance = entities.length > 0 ? laneCounts[0].count / entities.length : 0
  const coherenceScore = clamp(
    compactness * 0.34 +
      (1 - categoryDominance) * 0.16 +
      (1 - laneDominance) * 0.15 +
      categoryDiversity * 0.18 +
      laneDiversity * 0.17,
    0,
    1,
  )
  const densitySignal = clamp(
    (entities.length / Math.max(1, Math.pow(Math.max(55, radiusM), 2))) * 4200,
    0,
    1,
  )
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
    coherenceScore * 0.3 +
      categoryDiversity * 0.18 +
      laneDiversity * 0.14 +
      (experienceForwardSignal >= 0.55 ? 0.2 : 0.09) +
      (categoryDiversity >= 0.6 && laneDiversity >= 0.5 ? 0.18 : 0.08),
    0,
    1,
  )
  const activationStrength = clamp(
    densitySignal * 0.42 +
      categoryDiversity * 0.2 +
      laneDiversity * 0.14 +
      compactness * 0.12 +
      experienceForwardSignal * 0.12,
    0,
    1,
  )
  const categoryMixAdaptability = clamp(
    categoryCounts.filter((entry) => entry.count >= 1).length / 6,
    0,
    1,
  )
  const environmentalInfluencePotential = clamp(
    activationStrength * 0.48 +
      categoryMixAdaptability * 0.24 +
      categoryDiversity * 0.16 +
      densitySignal * 0.12,
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
  if (compactness >= 0.58) {
    reasonSignals.push('tight_walkable_micro_pocket')
  }
  if (reasonSignals.length === 0) {
    reasonSignals.push('baseline_micro_pocket')
  }

  return {
    id: `${pocketId}-micro-${index + 1}`,
    centroid,
    radiusM: toFixed(radiusM),
    entityIds: entities.map((entity) => entity.id),
    dominantCategories,
    dominantLanes,
    coherenceScore: toFixed(coherenceScore),
    identityStrength: toFixed(identityStrength),
    activationStrength: toFixed(activationStrength),
    environmentalInfluencePotential: toFixed(environmentalInfluencePotential),
    anchorCandidateIds: computeAnchorCandidateIds(
      entities,
      dominantCategories,
      dominantLanes,
      centroid,
      radiusM,
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
  const entities = pocket.entities
  if (entities.length <= 2) {
    return {
      microPockets: rankMicroPockets([buildMicroPocket(pocket.id, entities, 0)]),
    }
  }

  const epsM = clamp(pocket.geometry.maxDistanceFromCentroidM * 0.42, 70, 180)
  const minPoints = entities.length >= 9 ? 3 : 2
  const clustering = dbscan({
    points: entities,
    epsM,
    minPoints,
    distance: (left, right) => haversineDistanceM(left.location, right.location),
  })

  const clustered = clustering.clusters
    .map((cluster, index) => buildMicroPocket(pocket.id, cluster.points, index))
    .filter((microPocket) => microPocket.entityIds.length > 0)

  if (clustered.length === 0) {
    return {
      microPockets: rankMicroPockets([buildMicroPocket(pocket.id, entities, 0)]),
    }
  }

  return {
    microPockets: rankMicroPockets(clustered),
  }
}
