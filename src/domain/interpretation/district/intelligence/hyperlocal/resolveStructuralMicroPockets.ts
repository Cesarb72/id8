import { dbscan } from '../clustering/dbscan'
import { centroidOf, haversineDistanceM } from '../../../../shared/geo/geoDistance'
import type {
  IdentifiedPocket,
  PlaceEntity,
} from '../../../../../engines/district/types/districtTypes'

type CountEntry = {
  key: string
  count: number
}

type StructuralMicroPocket = {
  id: string
  entities: PlaceEntity[]
  centroid: { lat: number; lng: number }
  radiusM: number
  categoryCounts: CountEntry[]
  laneCounts: CountEntry[]
  dominantCategories: string[]
  dominantLanes: string[]
  categoryDiversity: number
  laneDiversity: number
  compactness: number
  categoryDominance: number
  laneDominance: number
  coherenceScore: number
  densitySignal: number
  categoryMixAdaptability: number
}

type ResolveStructuralMicroPocketsResult = {
  structuralMicroPockets: StructuralMicroPocket[]
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function countByKey(values: string[]): CountEntry[] {
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

function buildStructuralMicroPocket(
  pocketId: string,
  entities: PlaceEntity[],
  index: number,
): StructuralMicroPocket {
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
  const categoryMixAdaptability = clamp(
    categoryCounts.filter((entry) => entry.count >= 1).length / 6,
    0,
    1,
  )

  return {
    id: `${pocketId}-micro-${index + 1}`,
    entities,
    centroid,
    radiusM,
    categoryCounts,
    laneCounts,
    dominantCategories,
    dominantLanes,
    categoryDiversity,
    laneDiversity,
    compactness,
    categoryDominance,
    laneDominance,
    coherenceScore,
    densitySignal,
    categoryMixAdaptability,
  }
}

export function resolveStructuralMicroPockets(
  pocket: IdentifiedPocket,
): ResolveStructuralMicroPocketsResult {
  const entities = pocket.entities
  if (entities.length <= 2) {
    return {
      structuralMicroPockets: [buildStructuralMicroPocket(pocket.id, entities, 0)],
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
    .map((cluster, index) => buildStructuralMicroPocket(pocket.id, cluster.points, index))
    .filter((microPocket) => microPocket.entities.length > 0)

  if (clustered.length === 0) {
    return {
      structuralMicroPockets: [buildStructuralMicroPocket(pocket.id, entities, 0)],
    }
  }

  return {
    structuralMicroPockets: clustered,
  }
}
