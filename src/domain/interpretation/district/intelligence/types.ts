export type DistrictPoint = {
  lat: number
  lng: number
}

export type DistrictClusteringConfig = {
  epsM: number
  minPoints: number
  maxRadiusCapM: number
}

export type PocketOrigin =
  | 'primary'
  | 'fallback_recluster'
  | 'synthetic_fallback'
  | 'promoted_reject'

export type PocketClusteringSource = 'primary' | 'fallback' | 'synthetic'

export type PocketFallbackReasonCode =
  | 'recluster_no_primary_viable'
  | 'synthetic_no_clusters'
  | 'promoted_reject_non_empty_output'

export type DistrictPocketTruthTier = 'primary' | 'degraded_fallback'

export function isFallbackPocketOrigin(origin: PocketOrigin): boolean {
  return origin !== 'primary'
}

export function getDistrictPocketTruthTier(
  origin: PocketOrigin,
): DistrictPocketTruthTier {
  return isFallbackPocketOrigin(origin) ? 'degraded_fallback' : 'primary'
}

export type RawPocketGeometryMetrics = {
  centroid: DistrictPoint
  maxDistanceFromCentroidM: number
  avgDistanceFromCentroidM: number
  maxPairwiseDistanceM: number
  bboxWidthM: number
  bboxHeightM: number
  elongationRatio: number
  areaM2: number
  effectiveAreaM2ForDensity: number
  densityAreaFloorApplied: boolean
  densityClamped: boolean
  densityEntitiesPerKm2: number
}

export type PocketIdentity = {
  pocketLabel: string
  kind: 'inferred' | 'known_neighborhood' | 'unknown'
  confidence: number
  signals: Record<string, number | string | boolean>
  rationale: string[]
}
