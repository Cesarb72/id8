import type {
  ApplyPocketViabilityRulesResult,
  DistrictClusteringConfig,
  DistrictDebugTrace,
  DistrictEntityRetrievalDiagnostics,
  DistrictOpportunityProfile,
  IdentifiedPocket,
  PocketClusteringSource,
  PocketOrigin,
  RankedPocket,
  RawPocket,
  RefinedPocket,
  ResolvedLocation,
} from '../types/districtTypes'
import { getDistrictPocketTruthTier, isFallbackPocketOrigin } from '../types/districtTypes'

type BuildDistrictDebugTraceInput = {
  location: ResolvedLocation
  retrieval: DistrictEntityRetrievalDiagnostics
  entityCount: number
  rawPockets: RawPocket[]
  viability: ApplyPocketViabilityRulesResult
  refinedPockets: RefinedPocket[]
  identifiedPockets: IdentifiedPocket[]
  profiles: DistrictOpportunityProfile[]
  ranked: RankedPocket[]
  selected: RankedPocket[]
  primaryClustering: DistrictClusteringConfig & { clusters: number }
  fallbackClustering?: DistrictClusteringConfig & { clusters: number; applied: boolean }
  pathFlags: {
    usedFallbackClustering: boolean
    usedSyntheticFallback: boolean
    usedPromotedReject: boolean
  }
  stageNotes: string[]
}

function getRejectionReasonSummary(reasons: string[]): string {
  const explicitReject = reasons.find((reason) => reason.startsWith('Rejected:'))
  if (explicitReject) {
    return explicitReject
  }
  const classificationReject = reasons.find((reason) => reason.includes('Rejected pocket:'))
  if (classificationReject) {
    return classificationReject
  }
  return reasons[reasons.length - 1] ?? 'Rejected pocket without explicit reason.'
}

function toSortedCountEntries(
  counts: Record<string, number>,
  limit: number,
): Array<{ key: string; count: number }> {
  return Object.entries(counts)
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1]
      }
      return left[0].localeCompare(right[0])
    })
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }))
}

function buildLaneCounts(pocket: RawPocket): Record<string, number> {
  return pocket.entities.reduce<Record<string, number>>((accumulator, entity) => {
    const laneKey = entity.type
    accumulator[laneKey] = (accumulator[laneKey] ?? 0) + 1
    return accumulator
  }, {})
}

function buildCompositionSnapshot(pocket: RawPocket): {
  topCategories: Array<{ key: string; count: number }>
  dominantLanes: Array<{ key: string; count: number }>
  categoryDiversityCount: number
  laneDiversityCount: number
  laneDiversityScore: number
  representativeEntityNames: string[]
} {
  const laneCounts = buildLaneCounts(pocket)
  const representativeEntityNames = [...pocket.entities]
    .map((entity) => entity.name)
    .sort((left, right) => left.localeCompare(right))
    .slice(0, 5)

  return {
    topCategories: toSortedCountEntries(pocket.categoryCounts, 4),
    dominantLanes: toSortedCountEntries(laneCounts, 4),
    categoryDiversityCount: Object.keys(pocket.categoryCounts).length,
    laneDiversityCount: Object.keys(laneCounts).length,
    laneDiversityScore: pocket.laneDiversityScore,
    representativeEntityNames,
  }
}

function formatReasonBuckets(reasons: Record<string, number>): string {
  const entries = Object.entries(reasons)
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 3)
    .map(([reason, count]) => `${reason} (${count})`)
  return entries.length > 0 ? entries.join(', ') : 'none'
}

function toHyperlocalSnapshot(profile: DistrictOpportunityProfile | undefined): {
  microPocketCount: number
  selectedMicroPocketId?: string
  activationStrength?: number
  environmentalInfluencePotential?: number
  anchorRanking: Array<{ entityId: string; score: number }>
  whyHereSignals: string[]
  localSpecificityScore?: number
} | undefined {
  if (!profile?.hyperlocal) {
    return undefined
  }
  const primary = profile.hyperlocal.primaryMicroPocket
  const secondary = profile.hyperlocal.secondaryMicroPockets
  const anchorRanking = [
    ...(profile.hyperlocal.primaryAnchor
      ? [
          {
            entityId: profile.hyperlocal.primaryAnchor.entityId,
            score: profile.hyperlocal.primaryAnchor.score,
          },
        ]
      : []),
    ...profile.hyperlocal.secondaryAnchors.map((anchor) => ({
      entityId: anchor.entityId,
      score: anchor.score,
    })),
  ].slice(0, 4)

  return {
    microPocketCount: 1 + secondary.length,
    selectedMicroPocketId: primary.id,
    activationStrength: primary.activationStrength,
    environmentalInfluencePotential: primary.environmentalInfluencePotential,
    anchorRanking,
    whyHereSignals: profile.hyperlocal.whyHereSignals,
    localSpecificityScore: profile.hyperlocal.localSpecificityScore,
  }
}

export function buildDistrictDebugTrace(
  input: BuildDistrictDebugTraceInput,
): DistrictDebugTrace {
  const rankedByPocketId = new Map(input.ranked.map((entry) => [entry.profile.pocketId, entry]))
  const selectedPocketIds = new Set(input.selected.map((entry) => entry.profile.pocketId))
  const profileByPocketId = new Map(input.profiles.map((profile) => [profile.pocketId, profile]))
  const rawPocketSizes = input.rawPockets.map((pocket) => ({
    pocketId: pocket.id,
    entityCount: pocket.entities.length,
    origin: pocket.origin as PocketOrigin,
    truthTier: getDistrictPocketTruthTier(pocket.origin),
    isDegradedFallback: isFallbackPocketOrigin(pocket.origin),
    fallbackReasonCode: pocket.originMeta.fallbackReasonCode,
    clusteringSource: pocket.originMeta.clusteringSource as PocketClusteringSource,
  }))
  const rejectedPockets = input.viability.rejected.map((pocket) => ({
    pocketId: pocket.id,
    origin: pocket.origin,
    truthTier: getDistrictPocketTruthTier(pocket.origin),
    isDegradedFallback: isFallbackPocketOrigin(pocket.origin),
    fallbackReasonCode: pocket.originMeta.fallbackReasonCode,
    clusteringSource: pocket.originMeta.clusteringSource,
    entityCount: pocket.entities.length,
    rejectionReasonSummary: getRejectionReasonSummary(pocket.viability.reasons),
    rejectionReasons: pocket.viability.reasons,
    geometry: {
      centroid: pocket.geometry.centroid,
      maxDistanceFromCentroidM: pocket.geometry.maxDistanceFromCentroidM,
      avgDistanceFromCentroidM: pocket.geometry.avgDistanceFromCentroidM,
      maxPairwiseDistanceM: pocket.geometry.maxPairwiseDistanceM,
      bboxWidthM: pocket.geometry.bboxWidthM,
      bboxHeightM: pocket.geometry.bboxHeightM,
      elongationRatio: pocket.geometry.elongationRatio,
      areaM2: pocket.geometry.areaM2,
      densityEntitiesPerKm2: pocket.geometry.densityEntitiesPerKm2,
    },
  }))
  const rawPocketSizeSummary =
    rawPocketSizes.length > 0
      ? rawPocketSizes
          .map(
            (entry) =>
              `${entry.pocketId} (${entry.entityCount}, ${entry.origin}/${entry.clusteringSource}, ${entry.truthTier})`,
          )
          .join('; ')
      : 'none'

  const pocketTraces = input.viability.evaluated.map((pocket) => ({
    pocketId: pocket.id,
    origin: pocket.origin,
    truthTier: getDistrictPocketTruthTier(pocket.origin),
    isDegradedFallback: isFallbackPocketOrigin(pocket.origin),
    fallbackPenaltyApplied:
      profileByPocketId.get(pocket.id)?.meta.fallbackPenaltyApplied ?? 0,
    fallbackReasonCode: pocket.originMeta.fallbackReasonCode,
    clusteringSource: pocket.originMeta.clusteringSource,
    classification: pocket.viability.classification,
    finalRank: rankedByPocketId.get(pocket.id)?.rank,
    finalScore: rankedByPocketId.get(pocket.id)?.score,
    selected: selectedPocketIds.has(pocket.id),
    stageNotes: pocket.originMeta.stageNotes,
    notes: pocket.viability.reasons,
    hyperlocal: toHyperlocalSnapshot(profileByPocketId.get(pocket.id)),
    metrics: {
      maxDistanceFromCentroidM: pocket.geometry.maxDistanceFromCentroidM,
      avgDistanceFromCentroidM: pocket.geometry.avgDistanceFromCentroidM,
      maxPairwiseDistanceM: pocket.geometry.maxPairwiseDistanceM,
      bboxWidthM: pocket.geometry.bboxWidthM,
      bboxHeightM: pocket.geometry.bboxHeightM,
      areaM2: pocket.geometry.areaM2,
      effectiveAreaM2ForDensity: pocket.geometry.effectiveAreaM2ForDensity,
      densityAreaFloorApplied: pocket.geometry.densityAreaFloorApplied,
      densityClamped: pocket.geometry.densityClamped,
      densityEntitiesPerKm2: pocket.geometry.densityEntitiesPerKm2,
    },
    signals: {
      viabilityScore: pocket.viability.score,
      categoryDiversity: pocket.viability.signals.categoryDiversity,
      walkabilityScore: pocket.viability.signals.walkabilityScore,
      densityScore: pocket.viability.signals.densityScore,
      compactnessScore: pocket.viability.signals.compactnessScore,
      origin: pocket.origin,
      localSpecificityScore:
        profileByPocketId.get(pocket.id)?.hyperlocal?.localSpecificityScore,
    },
    composition: buildCompositionSnapshot(pocket),
  }))

  return {
    enabled: true,
    pipelineSteps: [
      'resolveLocation',
      'fetchPlaceEntities',
      'formRawPockets',
      'applyPocketViabilityRules',
      'refinePocketsWithSplitMerge',
      'inferPocketIdentity',
      'assemblePocketProfiles',
      'rankAndSelectPockets',
      'buildDistrictDebugTrace',
    ],
    location: input.location,
    retrieval: input.retrieval,
    entityCount: input.entityCount,
    clustering: {
      primary: input.primaryClustering,
      fallback: input.fallbackClustering,
    },
    pathFlags: input.pathFlags,
    pocketDiagnostics: {
      rawPocketCount: input.rawPockets.length,
      rawPocketSizes,
      viablePocketCount: input.viability.accepted.length,
      rejectedPocketCount: input.viability.rejected.length,
      rejectedPockets,
    },
    stageNotes: input.stageNotes,
    pocketTraces,
    summary: [
      `Retrieval mode: ${input.retrieval.mode}. City: ${input.retrieval.city || 'unknown'}. Selected entities: ${input.retrieval.selectedCount}.`,
      `Live attrition: raw ${input.retrieval.liveRawFetchedCount}, mapped ${input.retrieval.liveMappedCount}, normalized ${input.retrieval.liveNormalizedCount}, accepted ${input.retrieval.liveAcceptedCount}, suppressed ${input.retrieval.liveSuppressedCount}, bootstrap ${input.retrieval.bootstrapCount}.`,
      `Live drops: map ${input.retrieval.liveMappedDroppedCount} [${formatReasonBuckets(input.retrieval.liveMapDropReasons)}], normalize ${input.retrieval.liveNormalizationDroppedCount} [${formatReasonBuckets(input.retrieval.liveNormalizationDropReasons)}], suppression reasons [${formatReasonBuckets(input.retrieval.liveSuppressionReasons)}].`,
      `Geo spread: buckets ${input.retrieval.geoBucketCount}, dominant share ${input.retrieval.dominantAreaShare.toFixed(3)}, spread score ${input.retrieval.geoSpreadScore.toFixed(3)}, downsampled ${input.retrieval.geoDiversityDownsampledCount}.`,
      `Entities fetched: ${input.entityCount}.`,
      `Raw pockets: ${input.rawPockets.length}.`,
      `Raw pocket sizes: ${rawPocketSizeSummary}.`,
      `Viable pockets: ${input.viability.accepted.length}. Rejected pockets: ${input.viability.rejected.length}.`,
      `Refined pockets: ${input.refinedPockets.length}. Identified pockets: ${input.identifiedPockets.length}.`,
      `Profiles: ${input.profiles.length}. Ranked outputs: ${input.ranked.length}.`,
      `Fallback used: ${input.pathFlags.usedFallbackClustering}. Synthetic fallback used: ${input.pathFlags.usedSyntheticFallback}. Promoted reject used: ${input.pathFlags.usedPromotedReject}.`,
    ],
  }
}
