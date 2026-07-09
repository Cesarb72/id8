import { loadFieldSourceVenues } from '../../../domain/field/loadFieldSourceVenues'
import { haversineDistanceM } from '../clustering/geoDistance'
import type {
  FetchPlaceEntitiesInput,
  FetchPlaceEntitiesResult,
  PlaceEntity,
} from '../types/districtTypes'
import { admitDistrictEntities } from './admitDistrictEntities'

const DEFAULT_MAX_ENTITIES = 120
const MIN_MAX_ENTITIES = 20
const MAX_MAX_ENTITIES = 500

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function uniqueById(entities: PlaceEntity[]): PlaceEntity[] {
  const seen = new Set<string>()
  const deduped: PlaceEntity[] = []

  for (const entity of entities) {
    if (seen.has(entity.id)) {
      continue
    }
    seen.add(entity.id)
    deduped.push(entity)
  }

  return deduped
}

function countBlockedStatuses(
  blocked: FetchPlaceEntitiesResult['blockedEntities'],
): FetchPlaceEntitiesResult['retrieval']['blockedStatusCounts'] {
  return blocked.reduce<FetchPlaceEntitiesResult['retrieval']['blockedStatusCounts']>(
    (counts, entry) => {
      counts[entry.admissionStatus] = (counts[entry.admissionStatus] ?? 0) + 1
      return counts
    },
    {},
  )
}

export async function fetchPlaceEntities(
  input: FetchPlaceEntitiesInput,
): Promise<FetchPlaceEntitiesResult> {
  const fieldSources = await loadFieldSourceVenues({
    city: input.resolvedLocation.meta.city,
  })
  const {
    cityHint,
    curatedCityVenues,
    hasCuratedCoverage,
    sourceVenues,
    hybridDiagnostics,
  } = fieldSources
  let retrieval: FetchPlaceEntitiesResult['retrieval'] = {
    mode: hasCuratedCoverage ? 'curated' : 'none',
    city: input.resolvedLocation.meta.city ?? cityHint,
    curatedCount: curatedCityVenues.length,
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
    admittedCount: 0,
    blockedCount: 0,
    blockedStatusCounts: {},
    blockedEntities: [],
    notes: hasCuratedCoverage
      ? ['Curated city inventory used for district entity retrieval.']
      : ['No curated coverage found for requested city.'],
  }

  if (hybridDiagnostics) {
    retrieval = {
      mode: hybridDiagnostics.mode,
      city: hybridDiagnostics.city,
      curatedCount: curatedCityVenues.length,
      liveRawFetchedCount: hybridDiagnostics.liveRawFetched,
      liveFetchedCount: hybridDiagnostics.liveRawFetched,
      liveMappedCount: hybridDiagnostics.liveMapped,
      liveMappedDroppedCount: hybridDiagnostics.liveMappedDropped,
      liveMapDropReasons: hybridDiagnostics.liveMapDropReasons,
      liveNormalizedCount: hybridDiagnostics.liveNormalized,
      liveNormalizationDroppedCount: hybridDiagnostics.liveNormalizationDropped,
      liveNormalizationDropReasons: hybridDiagnostics.liveNormalizationDropReasons,
      liveAcceptedPreGeoCount: hybridDiagnostics.liveAcceptedPreGeo,
      liveAcceptedCount: hybridDiagnostics.liveAccepted,
      liveSuppressedCount: hybridDiagnostics.liveSuppressed,
      liveSuppressionReasons: hybridDiagnostics.liveSuppressionReasons,
      geoBucketCount: hybridDiagnostics.geoBucketCount,
      dominantAreaShare: hybridDiagnostics.dominantAreaShare,
      geoSpreadScore: hybridDiagnostics.geoSpreadScore,
      geoDiversityDownsampledCount: hybridDiagnostics.geoDiversityDownsampledCount,
      bootstrapCount: hybridDiagnostics.bootstrapCount,
      selectedCount: hybridDiagnostics.selectedCount,
      admittedCount: 0,
      blockedCount: 0,
      blockedStatusCounts: {},
      blockedEntities: [],
      notes: hybridDiagnostics.notes,
    }
  }

  const seeded = sourceVenues
  const admission = admitDistrictEntities(seeded)
  const normalized = uniqueById(admission.admitted.map((entry) => entry.entity))
  const maxEntities = clamp(
    input.maxEntities ?? DEFAULT_MAX_ENTITIES,
    MIN_MAX_ENTITIES,
    MAX_MAX_ENTITIES,
  )
  const searchRadiusM = input.searchRadiusM ?? input.resolvedLocation.radiusM

  const withDistance = normalized
    .map((entity) => ({
      entity,
      distanceM: haversineDistanceM(entity.location, input.resolvedLocation.center),
    }))
    .sort((left, right) => {
      if (left.distanceM !== right.distanceM) {
        return left.distanceM - right.distanceM
      }
      const leftPopularity = left.entity.signals?.popularity ?? 0
      const rightPopularity = right.entity.signals?.popularity ?? 0
      return rightPopularity - leftPopularity
    })

  const inRadius = withDistance.filter((item) => item.distanceM <= searchRadiusM)
  const selected =
    inRadius.length >= 3
      ? inRadius.slice(0, maxEntities)
      : withDistance.slice(0, Math.min(maxEntities, withDistance.length))
  const selectedEntityIds = new Set(selected.map((item) => item.entity.id))
  const admittedEntities = admission.admitted.filter((entry) =>
    selectedEntityIds.has(entry.entity.id),
  )
  const blockedStatusCounts = countBlockedStatuses(admission.blocked)
  const retrievalNotes = [...retrieval.notes]
  if (admission.blocked.length > 0) {
    retrievalNotes.push(
      `District admission blocked ${admission.blocked.length} live venues before clustering.`,
    )
  }

  return {
    entities: selected.map((item) => item.entity),
    admittedEntities,
    blockedEntities: admission.blocked,
    retrieval: {
      ...retrieval,
      selectedCount: selected.length,
      admittedCount: admittedEntities.length,
      blockedCount: admission.blocked.length,
      blockedStatusCounts,
      blockedEntities: admission.blocked,
      notes: retrievalNotes,
    },
  }
}
