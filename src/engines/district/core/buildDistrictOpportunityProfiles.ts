import { formRawPockets, buildRawPocketFromEntities } from '../clustering/formRawPockets'
import { buildDistrictDebugTrace } from '../debug/buildDistrictDebugTrace'
import { fetchPlaceEntities } from '../entities/fetchPlaceEntities'
import { inferPocketIdentity } from '../identity/inferPocketIdentity'
import { resolveLocation } from '../location/resolveLocation'
import { rankAndSelectPockets } from '../ranking/rankAndSelectPockets'
import { refinePocketsWithSplitMerge } from '../refinement/refinePocketsWithSplitMerge'
import { assemblePocketProfiles } from '../scoring/assemblePocketProfiles'
import {
  getDistrictPocketTruthTier,
  isFallbackPocketOrigin,
} from '../types/districtTypes'
import type {
  ApplyPocketViabilityRulesResult,
  BuildDistrictOpportunityProfilesInput,
  BuildDistrictOpportunityProfilesResult,
  DistrictClusteringConfig,
  DistrictEngineContext,
  ViablePocket,
} from '../types/districtTypes'
import { applyPocketViabilityRules } from '../viability/applyPocketViabilityRules'

const PRIMARY_CLUSTERING: DistrictClusteringConfig = {
  epsM: 180,
  minPoints: 5,
  maxRadiusCapM: 600,
}

const FALLBACK_CLUSTERING: DistrictClusteringConfig = {
  epsM: 240,
  minPoints: 3,
  maxRadiusCapM: 600,
}

function withDefaultContext(context: DistrictEngineContext = {}): Required<DistrictEngineContext> {
  return {
    vertical: context.vertical ?? 'generic',
  }
}

function pickBestPocket(pockets: ViablePocket[]): ViablePocket | undefined {
  return [...pockets].sort((left, right) => {
    if (right.viability.score !== left.viability.score) {
      return right.viability.score - left.viability.score
    }
    if (right.entities.length !== left.entities.length) {
      return right.entities.length - left.entities.length
    }
    return left.id.localeCompare(right.id)
  })[0]
}

function promoteBestReject(
  viability: ApplyPocketViabilityRulesResult,
): ApplyPocketViabilityRulesResult {
  const bestRejected = pickBestPocket(viability.rejected)
  if (!bestRejected) {
    return viability
  }

  const promoted: ViablePocket = {
    ...bestRejected,
    origin: 'promoted_reject',
    originMeta: {
      ...bestRejected.originMeta,
      stageNotes: [
        ...bestRejected.originMeta.stageNotes,
        `Promoted from rejected pocket with prior origin "${bestRejected.origin}".`,
      ],
      sourcePocketId: bestRejected.id,
      fallbackReasonCode: 'promoted_reject_non_empty_output',
    },
    meta: {
      ...bestRejected.meta,
      provenance: [...bestRejected.meta.provenance, 'promoted-reject', 'truth-tier:degraded_fallback'],
      truthTier: getDistrictPocketTruthTier('promoted_reject'),
      isDegradedFallback: isFallbackPocketOrigin('promoted_reject'),
    },
    viability: {
      ...bestRejected.viability,
      classification: 'weak',
      reasons: [
        ...bestRejected.viability.reasons,
        'Sparse fallback promotion applied to avoid empty district output.',
      ],
    },
  }

  return {
    evaluated: viability.evaluated.map((pocket) =>
      pocket.id === promoted.id ? promoted : pocket,
    ),
    accepted: [promoted],
    rejected: viability.rejected.filter((pocket) => pocket.id !== promoted.id),
  }
}

export async function buildDistrictOpportunityProfiles(
  input: BuildDistrictOpportunityProfilesInput,
  context: DistrictEngineContext = {},
): Promise<BuildDistrictOpportunityProfilesResult> {
  const resolvedContext = withDefaultContext(context)
  const stageNotes: string[] = []
  let usedFallbackClustering = false
  let usedSyntheticFallback = false
  let usedPromotedReject = false

  const location = resolveLocation({
    locationQuery: input.locationQuery,
    userLatLng: input.userLatLng,
    searchRadiusM: input.searchRadiusM,
  })

  if (location.source === 'unresolved_query') {
    stageNotes.push(
      location.meta.unresolvedReason ??
        'Location query could not be resolved to a known city or neighborhood.',
    )
    const emptyViability: ApplyPocketViabilityRulesResult = {
      evaluated: [],
      accepted: [],
      rejected: [],
    }
    const debug = input.includeDebug
      ? buildDistrictDebugTrace({
          location,
          retrieval: {
            mode: 'none',
            city: location.meta.city ?? '',
            curatedCount: 0,
            liveRawFetchedCount: 0,
            liveFetchedCount: 0,
            liveMappedCount: 0,
            liveMappedDroppedCount: 0,
            liveMapDropReasons: {},
            liveNormalizedCount: 0,
            liveNormalizationDroppedCount: 0,
            liveNormalizationDropReasons: {},
            liveAcceptedPreGeoCount: 0,
            liveAcceptedCount: 0,
            liveSuppressedCount: 0,
            liveSuppressionReasons: {},
            geoBucketCount: 0,
            dominantAreaShare: 0,
            geoSpreadScore: 0,
            geoDiversityDownsampledCount: 0,
            bootstrapCount: 0,
            selectedCount: 0,
            notes: [
              location.meta.unresolvedReason ??
                'Location query could not be resolved for district retrieval.',
            ],
          },
          entityCount: 0,
          rawPockets: [],
          viability: emptyViability,
          refinedPockets: [],
          identifiedPockets: [],
          profiles: [],
          ranked: [],
          selected: [],
          primaryClustering: {
            ...PRIMARY_CLUSTERING,
            clusters: 0,
          },
          fallbackClustering: undefined,
          pathFlags: {
            usedFallbackClustering: false,
            usedSyntheticFallback: false,
            usedPromotedReject: false,
          },
          stageNotes,
        })
      : undefined

    return {
      location,
      retrieval: {
        mode: 'none',
        city: location.meta.city ?? '',
        curatedCount: 0,
        liveRawFetchedCount: 0,
        liveFetchedCount: 0,
        liveMappedCount: 0,
        liveMappedDroppedCount: 0,
        liveMapDropReasons: {},
        liveNormalizedCount: 0,
        liveNormalizationDroppedCount: 0,
        liveNormalizationDropReasons: {},
        liveAcceptedPreGeoCount: 0,
        liveAcceptedCount: 0,
        liveSuppressedCount: 0,
        liveSuppressionReasons: {},
        geoBucketCount: 0,
        dominantAreaShare: 0,
        geoSpreadScore: 0,
        geoDiversityDownsampledCount: 0,
        bootstrapCount: 0,
        selectedCount: 0,
        notes: [
          location.meta.unresolvedReason ??
            'Location query could not be resolved for district retrieval.',
        ],
      },
      entities: [],
      rawPockets: [],
      viablePockets: [],
      rejectedPockets: [],
      refinedPockets: [],
      identifiedPockets: [],
      profiles: [],
      ranked: [],
      selected: [],
      meta: {
        version: 'district-engine-phase-1-3',
        context: resolvedContext,
        provenance: [
          'location-conditioned-pocket-inference',
          'geo-dbscan',
          'viability-deterministic-rules',
          'typed-debug-trace',
          'location-unresolved',
        ],
      },
      debug,
    }
  }

  const entityFetch = await fetchPlaceEntities({
    resolvedLocation: location,
    maxEntities: input.maxEntities,
    searchRadiusM: input.searchRadiusM,
  })
  const entities = entityFetch.entities

  const primaryRawPockets = formRawPockets({
    entities,
    clustering: PRIMARY_CLUSTERING,
    origin: 'primary',
    clusteringSource: 'primary',
    stageNotes: ['Primary DBSCAN clustering pass.'],
  })
  let rawPockets = primaryRawPockets
  let viability = applyPocketViabilityRules(rawPockets)

  let fallbackClustering:
    | (DistrictClusteringConfig & { clusters: number; applied: boolean })
    | undefined

  if (viability.accepted.length === 0 && entities.length >= 3) {
    usedFallbackClustering = true
    stageNotes.push('Fallback reclustering applied after no accepted primary pockets.')
    const fallbackRaw = formRawPockets({
      entities,
      clustering: FALLBACK_CLUSTERING,
      origin: 'fallback_recluster',
      clusteringSource: 'fallback',
      fallbackReasonCode: 'recluster_no_primary_viable',
      stageNotes: ['Fallback DBSCAN clustering pass with relaxed min points and radius.'],
    })
    const fallbackViability = applyPocketViabilityRules(fallbackRaw)

    fallbackClustering = {
      ...FALLBACK_CLUSTERING,
      clusters: fallbackRaw.length,
      applied: true,
    }

    if (fallbackRaw.length > 0) {
      rawPockets = fallbackRaw
      viability = fallbackViability
    }
  }

  if (rawPockets.length === 0 && entities.length >= 3) {
    usedSyntheticFallback = true
    stageNotes.push('Synthetic fallback pocket created because clustering returned no pockets.')
    const synthetic = buildRawPocketFromEntities(
      entities.slice(0, Math.min(8, entities.length)),
      FALLBACK_CLUSTERING,
      {
        pocketId: 'raw-pocket-synthetic-1',
        origin: 'synthetic_fallback',
        clusteringSource: 'synthetic',
        fallbackReasonCode: 'synthetic_no_clusters',
        stageNotes: ['Synthetic fallback pocket assembled from nearest entities.'],
      },
    )
    rawPockets = [synthetic]
    viability = applyPocketViabilityRules(rawPockets)
    fallbackClustering = {
      ...FALLBACK_CLUSTERING,
      clusters: rawPockets.length,
      applied: true,
    }
  }

  if (viability.accepted.length === 0 && entities.length >= 3 && viability.rejected.length > 0) {
    viability = promoteBestReject(viability)
    usedPromotedReject = true
    stageNotes.push('Promoted best rejected pocket to weak to preserve non-empty output.')
  }

  const refinedPockets = refinePocketsWithSplitMerge(viability.accepted)
  const identifiedPockets = inferPocketIdentity(refinedPockets)
  const profiles = assemblePocketProfiles(identifiedPockets, resolvedContext)
  const ranking = rankAndSelectPockets(profiles)

  const debug = input.includeDebug
      ? buildDistrictDebugTrace({
          location,
          retrieval: entityFetch.retrieval,
          entityCount: entities.length,
          rawPockets,
        viability,
        refinedPockets,
        identifiedPockets,
        profiles,
        ranked: ranking.ranked,
        selected: ranking.selected,
        primaryClustering: {
          ...PRIMARY_CLUSTERING,
          clusters: primaryRawPockets.length,
        },
        fallbackClustering,
        pathFlags: {
          usedFallbackClustering,
          usedSyntheticFallback,
          usedPromotedReject,
        },
        stageNotes,
      })
    : undefined

  return {
    location,
    retrieval: entityFetch.retrieval,
    entities,
    rawPockets,
    viablePockets: viability.accepted,
    rejectedPockets: viability.rejected,
    refinedPockets,
    identifiedPockets,
    profiles,
    ranked: ranking.ranked,
    selected: ranking.selected,
    meta: {
      version: 'district-engine-phase-1-3',
      context: resolvedContext,
      provenance: [
        'location-conditioned-pocket-inference',
        'geo-dbscan',
        'viability-deterministic-rules',
        'typed-debug-trace',
      ],
    },
    debug,
  }
}
