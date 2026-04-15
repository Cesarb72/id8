export type PlaceEntity = {
  id: string
  name: string
  location: { lat: number; lng: number }
  type: 'venue' | 'program' | 'hub' | 'event' | 'service'
  categories: string[]
  tags?: string[]
  metadata?: {
    hours?: unknown
    capacity?: number
    organizationType?: string
    address?: string
    neighborhood?: string
    sublocality?: string
    street?: string
    pseudoGeo?: {
      normalizedNeighborhoodKey: string
      anchorKey: string
      jitterRadiusM: number
    }
  }
  signals?: {
    popularity?: number
    activity?: number
    trust?: number
    openNow?: boolean
  }
}

export type DistrictEngineContext = {
  vertical?: 'generic' | 'hospitality' | 'community' | 'food_system' | 'events'
}

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

export function getDistrictFallbackPenalty(origin: PocketOrigin): number {
  if (origin === 'fallback_recluster') {
    return 0.03
  }
  if (origin === 'synthetic_fallback') {
    return 0.08
  }
  if (origin === 'promoted_reject') {
    return 0.11
  }
  return 0
}

export type BuildDistrictOpportunityProfilesInput = {
  locationQuery: string
  userLatLng?: { lat: number; lng: number }
  searchRadiusM?: number
  maxEntities?: number
  includeDebug?: boolean
}

export type ResolveLocationInput = {
  locationQuery: string
  userLatLng?: DistrictPoint
  searchRadiusM?: number
}

export type ResolvedLocation = {
  query: string
  normalizedQuery: string
  displayLabel: string
  center: DistrictPoint
  radiusM: number
  confidence: 'high' | 'medium' | 'low'
  source:
    | 'user_lat_lng'
    | 'query_lookup'
    | 'query_coordinates'
    | 'default_fallback'
    | 'unresolved_query'
  meta: {
    city?: string
    neighborhood?: string
    countryCode?: string
    unresolvedReason?: string
    geocoder: string
    resolvedAtIso: string
  }
}

export type FetchPlaceEntitiesInput = {
  resolvedLocation: ResolvedLocation
  maxEntities?: number
  searchRadiusM?: number
}

export type DistrictEntityRetrievalMode =
  | 'curated'
  | 'hybrid_live'
  | 'hybrid_live_plus_bootstrap'
  | 'hybrid_bootstrap'
  | 'none'

export type DistrictEntityRetrievalDiagnostics = {
  mode: DistrictEntityRetrievalMode
  city: string
  curatedCount: number
  liveRawFetchedCount: number
  liveFetchedCount: number
  liveMappedCount: number
  liveMappedDroppedCount: number
  liveMapDropReasons: Record<string, number>
  liveNormalizedCount: number
  liveNormalizationDroppedCount: number
  liveNormalizationDropReasons: Record<string, number>
  liveAcceptedPreGeoCount: number
  liveAcceptedCount: number
  liveSuppressedCount: number
  liveSuppressionReasons: Record<string, number>
  geoBucketCount: number
  dominantAreaShare: number
  geoSpreadScore: number
  geoDiversityDownsampledCount: number
  bootstrapCount: number
  selectedCount: number
  notes: string[]
}

export type FetchPlaceEntitiesResult = {
  entities: PlaceEntity[]
  retrieval: DistrictEntityRetrievalDiagnostics
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

export type RawPocket = {
  id: string
  origin: PocketOrigin
  entities: PlaceEntity[]
  entityIds: string[]
  categoryCounts: Record<string, number>
  laneDiversityScore: number
  geometry: RawPocketGeometryMetrics
  originMeta: {
    clusteringSource: PocketClusteringSource
    stageNotes: string[]
    sourcePocketId?: string
    fallbackReasonCode?: PocketFallbackReasonCode
  }
  clusteringMeta: {
    epsM: number
    minPoints: number
    maxRadiusCapM: number
    radiusCapExceeded: boolean
  }
  meta: {
    provenance: string[]
    truthTier: DistrictPocketTruthTier
    isDegradedFallback: boolean
    formedAtIso: string
  }
}

export type PocketViabilityClass = 'strong' | 'usable' | 'weak' | 'reject'

export type PocketViabilitySignals = {
  entityCount: number
  categoryDiversity: number
  densityScore: number
  walkabilityScore: number
  compactnessScore: number
  radiusPenalty: number
}

export type ViablePocket = RawPocket & {
  viability: {
    classification: PocketViabilityClass
    score: number
    reasons: string[]
    signals: PocketViabilitySignals
    thresholds: {
      minEntities: number
      softMinEntities: number
      hardRejectBelow: number
      hardMaxCentroidDistanceM: number
    }
  }
}

export type ApplyPocketViabilityRulesResult = {
  evaluated: ViablePocket[]
  accepted: ViablePocket[]
  rejected: ViablePocket[]
}

export type PocketRefinementAction = {
  action: 'split' | 'merge' | 'keep'
  note: string
}

export type RefinedPocket = ViablePocket & {
  refinement: {
    status: 'unchanged' | 'split' | 'merged'
    actions: PocketRefinementAction[]
  }
}

export type PocketIdentity = {
  pocketLabel: string
  kind: 'inferred' | 'known_neighborhood' | 'unknown'
  confidence: number
  signals: Record<string, number | string | boolean>
  rationale: string[]
}

export type IdentifiedPocket = RefinedPocket & {
  identity: PocketIdentity
}

export type DistrictFieldSignals = {
  entityCount: number
  categoryDiversity: number
  density: number
  walkability: number
  viability: number
}

export type DistrictScoreBreakdown = {
  fieldScore: number
  viabilityBonus: number
  totalScore: number
}

export type DistrictAppSignals = {
  directionSignals?: {
    northSouthBias: number
    eastWestBias: number
    dominantAxis: 'north_south' | 'east_west' | 'balanced'
  }
  tasteSignals?: Record<string, number>
}

export type DistrictTasteSignals = {
  experientialTags: string[]
  hospitalityMix: {
    drinks: number
    dining: number
    culture: number
    cafe: number
    activity: number
  }
  ambianceProfile: {
    energy: 'low' | 'medium' | 'high'
    intimacy: 'low' | 'medium' | 'high'
    noise: 'low' | 'medium' | 'high'
  }
  momentSeeds: string[]
  momentPotential: number
}

export type DistrictMicroPocket = {
  id: string
  centroid: DistrictPoint
  radiusM: number
  entityIds: string[]
  dominantCategories: string[]
  dominantLanes: string[]
  coherenceScore: number
  identityStrength: number
  activationStrength: number
  environmentalInfluencePotential: number
  anchorCandidateIds: string[]
  reasonSignals: string[]
}

export type DistrictIdentityAnchor = {
  entityId: string
  entityName: string
  score: number
  reasons: string[]
}

export type DistrictHyperlocalProfile = {
  primaryMicroPocket: DistrictMicroPocket
  secondaryMicroPockets: DistrictMicroPocket[]
  primaryAnchor?: DistrictIdentityAnchor
  secondaryAnchors: DistrictIdentityAnchor[]
  whyHereSignals: string[]
  localSpecificityScore: number
}

export type DistrictOpportunityProfile = {
  pocketId: string
  label: string
  centroid: DistrictPoint
  radiusM: number
  entityCount: number
  categories: string[]
  classification: PocketViabilityClass
  coreSignals: DistrictFieldSignals
  tasteSignals: DistrictTasteSignals
  score: DistrictScoreBreakdown
  appSignals?: DistrictAppSignals
  hyperlocal?: DistrictHyperlocalProfile
  meta: {
    vertical: NonNullable<DistrictEngineContext['vertical']>
    provenance: string[]
    generatedAtIso: string
    identityKind: PocketIdentity['kind']
    origin: PocketOrigin
    truthTier: DistrictPocketTruthTier
    isDegradedFallback: boolean
    fallbackPenaltyApplied: number
    fallbackReasonCode?: PocketFallbackReasonCode
    clusteringSource: PocketClusteringSource
    originNotes: string[]
    sourcePocketId?: string
  }
}

export type RankedPocket = {
  rank: number
  score: number
  baseScore: number
  degradedPenaltyApplied: number
  reasons: string[]
  profile: DistrictOpportunityProfile
}

export type RankAndSelectPocketsResult = {
  ranked: RankedPocket[]
  selected: RankedPocket[]
}

export type DistrictDebugPocketTrace = {
  pocketId: string
  origin: PocketOrigin
  truthTier: DistrictPocketTruthTier
  isDegradedFallback: boolean
  fallbackPenaltyApplied: number
  fallbackReasonCode?: PocketFallbackReasonCode
  clusteringSource: PocketClusteringSource
  classification: PocketViabilityClass
  finalRank?: number
  finalScore?: number
  selected: boolean
  stageNotes: string[]
  notes: string[]
  hyperlocal?: {
    microPocketCount: number
    selectedMicroPocketId?: string
    activationStrength?: number
    environmentalInfluencePotential?: number
    anchorRanking: Array<{ entityId: string; score: number }>
    whyHereSignals: string[]
    localSpecificityScore?: number
  }
  metrics?: Partial<RawPocketGeometryMetrics>
  signals?: Record<string, number | string | boolean>
  composition?: {
    topCategories: Array<{ key: string; count: number }>
    dominantLanes: Array<{ key: string; count: number }>
    categoryDiversityCount: number
    laneDiversityCount: number
    laneDiversityScore: number
    representativeEntityNames: string[]
  }
}

export type DistrictDebugRejectedPocket = {
  pocketId: string
  origin: PocketOrigin
  truthTier: DistrictPocketTruthTier
  isDegradedFallback: boolean
  fallbackReasonCode?: PocketFallbackReasonCode
  clusteringSource: PocketClusteringSource
  entityCount: number
  rejectionReasonSummary: string
  rejectionReasons: string[]
  geometry: {
    centroid: DistrictPoint
    maxDistanceFromCentroidM: number
    avgDistanceFromCentroidM: number
    maxPairwiseDistanceM: number
    bboxWidthM: number
    bboxHeightM: number
    elongationRatio: number
    areaM2: number
    densityEntitiesPerKm2: number
  }
}

export type DistrictDebugTrace = {
  enabled: boolean
  pipelineSteps: string[]
  location: ResolvedLocation
  retrieval: DistrictEntityRetrievalDiagnostics
  entityCount: number
  clustering: {
    primary: DistrictClusteringConfig & { clusters: number }
    fallback?: DistrictClusteringConfig & { clusters: number; applied: boolean }
  }
  pathFlags: {
    usedFallbackClustering: boolean
    usedSyntheticFallback: boolean
    usedPromotedReject: boolean
  }
  pocketDiagnostics: {
    rawPocketCount: number
    rawPocketSizes: Array<{
      pocketId: string
      entityCount: number
      origin: PocketOrigin
      truthTier: DistrictPocketTruthTier
      isDegradedFallback: boolean
      fallbackReasonCode?: PocketFallbackReasonCode
      clusteringSource: PocketClusteringSource
    }>
    viablePocketCount: number
    rejectedPocketCount: number
    rejectedPockets: DistrictDebugRejectedPocket[]
  }
  stageNotes: string[]
  pocketTraces: DistrictDebugPocketTrace[]
  summary: string[]
}

export type BuildDistrictOpportunityProfilesResult = {
  location: ResolvedLocation
  retrieval: DistrictEntityRetrievalDiagnostics
  entities: PlaceEntity[]
  rawPockets: RawPocket[]
  viablePockets: ViablePocket[]
  rejectedPockets: ViablePocket[]
  refinedPockets: RefinedPocket[]
  identifiedPockets: IdentifiedPocket[]
  profiles: DistrictOpportunityProfile[]
  ranked: RankedPocket[]
  selected: RankedPocket[]
  meta: {
    version: string
    context: Required<DistrictEngineContext>
    provenance: string[]
  }
  debug?: DistrictDebugTrace
}
