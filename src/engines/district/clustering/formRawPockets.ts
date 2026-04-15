import { dbscan } from './dbscan'
import {
  centroidOf,
  computeBoundingBoxMetrics,
  haversineDistanceM,
} from './geoDistance'
import {
  getDistrictPocketTruthTier,
  isFallbackPocketOrigin,
} from '../types/districtTypes'
import type {
  DistrictClusteringConfig,
  PocketFallbackReasonCode,
  PocketClusteringSource,
  PocketOrigin,
  PlaceEntity,
  RawPocket,
  RawPocketGeometryMetrics,
} from '../types/districtTypes'

type FormRawPocketsInput = {
  entities: PlaceEntity[]
  clustering: DistrictClusteringConfig
  origin?: PocketOrigin
  clusteringSource?: PocketClusteringSource
  fallbackReasonCode?: PocketFallbackReasonCode
  stageNotes?: string[]
}

type BuildRawPocketOptions = {
  pocketId?: string
  origin: PocketOrigin
  clusteringSource: PocketClusteringSource
  stageNotes?: string[]
  sourcePocketId?: string
  fallbackReasonCode?: PocketFallbackReasonCode
}

const ZERO_GEOMETRY: RawPocketGeometryMetrics = {
  centroid: { lat: 0, lng: 0 },
  maxDistanceFromCentroidM: 0,
  avgDistanceFromCentroidM: 0,
  maxPairwiseDistanceM: 0,
  bboxWidthM: 0,
  bboxHeightM: 0,
  elongationRatio: 1,
  areaM2: 0,
  effectiveAreaM2ForDensity: 0,
  densityAreaFloorApplied: false,
  densityClamped: false,
  densityEntitiesPerKm2: 0,
}

const MIN_EFFECTIVE_DENSITY_AREA_M2 = 25_000
const MAX_DENSITY_PER_KM2 = 450

function toFixedNumber(value: number): number {
  return Number(value.toFixed(2))
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function getCategoryKey(entity: PlaceEntity): string {
  return entity.categories[0] ?? entity.type
}

function computeCategoryCounts(entities: PlaceEntity[]): Record<string, number> {
  return entities.reduce<Record<string, number>>((accumulator, entity) => {
    const key = getCategoryKey(entity)
    accumulator[key] = (accumulator[key] ?? 0) + 1
    return accumulator
  }, {})
}

function computeLaneDiversityScore(entities: PlaceEntity[]): number {
  if (entities.length === 0) {
    return 0
  }
  const uniqueCategories = new Set(entities.map(getCategoryKey))
  return clamp(uniqueCategories.size / Math.min(entities.length, 6), 0, 1)
}

function computeMaxPairwiseDistanceM(entities: PlaceEntity[]): number {
  if (entities.length <= 1) {
    return 0
  }

  let maxDistanceM = 0
  for (let left = 0; left < entities.length; left += 1) {
    for (let right = left + 1; right < entities.length; right += 1) {
      const distanceM = haversineDistanceM(entities[left].location, entities[right].location)
      if (distanceM > maxDistanceM) {
        maxDistanceM = distanceM
      }
    }
  }

  return maxDistanceM
}

function computeGeometryMetrics(entities: PlaceEntity[]): RawPocketGeometryMetrics {
  if (entities.length === 0) {
    return ZERO_GEOMETRY
  }

  const points = entities.map((entity) => entity.location)
  const centroid = centroidOf(points)
  const distancesFromCentroidM = points.map((point) => haversineDistanceM(point, centroid))
  const maxDistanceFromCentroidM =
    distancesFromCentroidM.length === 0 ? 0 : Math.max(...distancesFromCentroidM)
  const avgDistanceFromCentroidM =
    distancesFromCentroidM.length === 0
      ? 0
      : distancesFromCentroidM.reduce((sum, distanceM) => sum + distanceM, 0) /
        distancesFromCentroidM.length
  const maxPairwiseDistanceM = computeMaxPairwiseDistanceM(entities)
  const { widthM: bboxWidthM, heightM: bboxHeightM } = computeBoundingBoxMetrics(points)
  const shortestAxis = Math.max(1, Math.min(bboxWidthM, bboxHeightM))
  const longestAxis = Math.max(bboxWidthM, bboxHeightM)
  const elongationRatio = longestAxis / shortestAxis
  const areaM2 = bboxWidthM * bboxHeightM
  // Guardrail: tiny bbox artifacts can explode density. Use an effective area floor for density only.
  const effectiveAreaM2ForDensity = Math.max(areaM2, MIN_EFFECTIVE_DENSITY_AREA_M2)
  const densityAreaFloorApplied = areaM2 < MIN_EFFECTIVE_DENSITY_AREA_M2
  const rawDensityEntitiesPerKm2 = entities.length / (effectiveAreaM2ForDensity / 1_000_000)
  const densityEntitiesPerKm2 = Math.min(rawDensityEntitiesPerKm2, MAX_DENSITY_PER_KM2)
  const densityClamped = rawDensityEntitiesPerKm2 > MAX_DENSITY_PER_KM2

  return {
    centroid,
    maxDistanceFromCentroidM: toFixedNumber(maxDistanceFromCentroidM),
    avgDistanceFromCentroidM: toFixedNumber(avgDistanceFromCentroidM),
    maxPairwiseDistanceM: toFixedNumber(maxPairwiseDistanceM),
    bboxWidthM: toFixedNumber(bboxWidthM),
    bboxHeightM: toFixedNumber(bboxHeightM),
    elongationRatio: toFixedNumber(elongationRatio),
    areaM2: toFixedNumber(areaM2),
    effectiveAreaM2ForDensity: toFixedNumber(effectiveAreaM2ForDensity),
    densityAreaFloorApplied,
    densityClamped,
    densityEntitiesPerKm2: toFixedNumber(densityEntitiesPerKm2),
  }
}

function hashString(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function buildStableRawPocketId(entities: PlaceEntity[]): string {
  const sortedEntityIds = [...entities.map((entity) => entity.id)].sort()
  const signature = sortedEntityIds.join('|')
  return `raw-pocket-${hashString(signature)}`
}

export function buildRawPocketFromEntities(
  entities: PlaceEntity[],
  clustering: DistrictClusteringConfig,
  options: BuildRawPocketOptions,
): RawPocket {
  const geometry = computeGeometryMetrics(entities)
  const pocketId = options.pocketId ?? buildStableRawPocketId(entities)
  const truthTier = getDistrictPocketTruthTier(options.origin)
  const isDegradedFallback = isFallbackPocketOrigin(options.origin)
  return {
    id: pocketId,
    origin: options.origin,
    entities,
    entityIds: entities.map((entity) => entity.id),
    categoryCounts: computeCategoryCounts(entities),
    laneDiversityScore: toFixedNumber(computeLaneDiversityScore(entities)),
    geometry,
    originMeta: {
      clusteringSource: options.clusteringSource,
      stageNotes: options.stageNotes ?? [],
      sourcePocketId: options.sourcePocketId,
      fallbackReasonCode: options.fallbackReasonCode,
    },
    clusteringMeta: {
      epsM: clustering.epsM,
      minPoints: clustering.minPoints,
      maxRadiusCapM: clustering.maxRadiusCapM,
      radiusCapExceeded: geometry.maxDistanceFromCentroidM > clustering.maxRadiusCapM,
    },
    meta: {
      provenance: [
        'geo-dbscan',
        'cluster-geometry-metrics',
        `origin:${options.origin}`,
        `clustering-source:${options.clusteringSource}`,
        `truth-tier:${truthTier}`,
        ...(options.fallbackReasonCode
          ? [`fallback-reason:${options.fallbackReasonCode}`]
          : []),
      ],
      truthTier,
      isDegradedFallback,
      formedAtIso: new Date().toISOString(),
    },
  }
}

export function formRawPockets(input: FormRawPocketsInput): RawPocket[] {
  if (input.entities.length === 0) {
    return []
  }

  const clusteringResult = dbscan({
    points: input.entities,
    epsM: input.clustering.epsM,
    minPoints: input.clustering.minPoints,
    distance: (left, right) => haversineDistanceM(left.location, right.location),
  })

  return clusteringResult.clusters
    .map((cluster) =>
      buildRawPocketFromEntities(cluster.points, input.clustering, {
        origin: input.origin ?? 'primary',
        clusteringSource: input.clusteringSource ?? 'primary',
        fallbackReasonCode: input.fallbackReasonCode,
        stageNotes: input.stageNotes,
      }),
    )
    .sort((left, right) => {
      if (right.entities.length !== left.entities.length) {
        return right.entities.length - left.entities.length
      }
      return left.id.localeCompare(right.id)
    })
}
