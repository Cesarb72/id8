import { getTimeWindowSignal } from '../retrieval/getTimeWindowSignal'
import { normalizeVenue } from '../normalize/normalizeVenue'
import { searchPlaces } from '../providers/ProviderAdapter'
import type { ProviderVenue } from '../providers/providerTypes'
import { buildLiveQueryPlan, type LivePlaceKind } from './buildLiveQueryPlan'
import { getGooglePlacesConfig } from './getSourceMode'
import {
  mapLivePlaceToRawPlaceWithDiagnostics,
  type MapLivePlaceDropReason,
} from './mapLivePlaceToRawPlace'
import type { IntentProfile } from '../types/intent'
import type { QualityGateStatus } from '../types/normalization'
import type { RawPlace } from '../types/rawPlace'
import type { SourceMode } from '../types/sourceMode'
import type { StarterPack } from '../types/starterPack'
import type { Venue } from '../types/venue'
import type { LiveRetrievalPocketHint } from '../retrieval/liveEnvelope'

type LivePlaceMapperInput = Parameters<typeof mapLivePlaceToRawPlaceWithDiagnostics>[0]

interface QueryCenter {
  id: 'core' | 'north' | 'south' | 'east' | 'west' | 'pocket'
  lat: number
  lng: number
  source?: LiveRetrievalPocketHint['source']
  pocketId?: string
  label?: string
}

interface LiveCandidatesByQueryDiagnostics {
  label: string
  template: string
  roleHint: string
  fetchedCount: number
  mappedCount: number
  normalizedCount: number
  approvedCount: number
  demotedCount: number
  suppressedCount: number
  candidates?: Array<{
    name: string
    venueId?: string
    providerPlaceId?: string
    sourceTypes: string[]
    providerResultSummary: boolean
    normalizedResult: boolean
    candidateBoardAdmission: boolean
    pocketFilter: 'admitted' | 'outside_pocket_envelope' | 'not_applicable' | 'unknown_drop_stage'
    dropReason?: string
  }>
}

export interface LiveSourceDiagnostics {
  attempted: boolean
  provider: 'google-places'
  queryLocationLabel: string
  queryCentersCount: number
  queryCentersUsed: Array<{ id: string; lat: number; lng: number }>
  queryRadiusM: number
  pocketHint?: LiveRetrievalPocketHint
  pocketCenteredRetrievalApplied: boolean
  pocketFilterReason?: string
  pocketFilterInputCount: number
  pocketFilterInsideEnvelopeCount: number
  pocketFilterCoordinateClusterCount: number
  pocketFilterDroppedCount: number
  requestedKinds: LivePlaceKind[]
  queryCount: number
  labelsConsidered: number
  labelsAdmitted: number
  centersConsidered: number
  centersAdmitted: number
  dispatchQueriesPlanned: number
  dispatchQueriesAttempted: number
  dispatchQueriesPlannedWithinCap: boolean
  liveQueryTemplatesUsed: string[]
  liveQueryLabelsUsed: string[]
  liveCandidatesByQuery: LiveCandidatesByQueryDiagnostics[]
  liveRoleIntentQueryNotes: string[]
  fetchedCount: number
  rawFetchedCount: number
  mappedCount: number
  mappedDroppedCount: number
  mappedDropReasons: Record<MapLivePlaceDropReason, number>
  normalizedCount: number
  dedupedByPlaceIdCount: number
  normalizationDroppedCount: number
  normalizationDropReasons: Record<string, number>
  acceptedCount: number
  acceptanceDroppedCount: number
  acceptanceDropReasons: Record<string, number>
  approvedCount: number
  demotedCount: number
  suppressedCount: number
  usableCount: number
  partialFailure: boolean
  success: boolean
  failureReason?: string
  failureCategory?:
    | 'disabled_dev_closeout'
    | 'missing_api_key'
    | 'request_failure'
    | 'partial_failure'
    | 'attrition_or_empty'
  errors: string[]
}

export interface FetchLivePlacesResult {
  venues: Venue[]
  diagnostics: LiveSourceDiagnostics
}

export interface FetchLivePlacesOptions {
  liveQueryLabels?: string[]
  maxQueryCenters?: number
  pocketHint?: LiveRetrievalPocketHint
  sourceMode?: SourceMode
  envelope?: {
    maxProviderCalls?: number
    maxQueryLabels?: number
  }
  stepBCurateLiveSmokeActive?: boolean
}

const googleFieldMask = [
  'places.id',
  'places.displayName',
  'places.primaryType',
  'places.types',
  'places.liveMusic',
  'places.servesBeer',
  'places.servesWine',
  'places.goodForGroups',
  'places.goodForChildren',
  'places.allowsDogs',
  'places.servesVegetarianFood',
  'places.formattedAddress',
  'places.shortFormattedAddress',
  'places.addressComponents',
  'places.editorialSummary',
  'places.businessStatus',
  'places.currentOpeningHours.openNow',
  'places.currentOpeningHours.weekdayDescriptions',
  'places.currentOpeningHours.periods',
  'places.priceLevel',
  'places.regularOpeningHours.weekdayDescriptions',
  'places.regularOpeningHours.periods',
  'places.rating',
  'places.userRatingCount',
  'places.utcOffsetMinutes',
  'places.websiteUri',
  'places.location',
].join(',')

const KNOWN_CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  'san jose': { lat: 37.3382, lng: -121.8863 },
  denver: { lat: 39.7392, lng: -104.9903 },
  austin: { lat: 30.2672, lng: -97.7431 },
}

const POCKET_QUERY_RADIUS_MIN_M = 650
const POCKET_QUERY_RADIUS_MAX_M = 1200
const POCKET_RADIUS_BUFFER_M = 240
const COORDINATE_CLUSTER_MAX_PAIRWISE_M = 650
const COORDINATE_CLUSTER_MIN_VENUES = 3

function normalizeCity(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\./g, '')
  const [head] = normalized.split(',')
  return (head ?? normalized).replace(/\s+/g, ' ').trim()
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function hashToUnit(value: string): number {
  return hashString(value) / 4294967295
}

function getCityCenter(city: string): { lat: number; lng: number } {
  const cityKey = normalizeCity(city)
  const known = KNOWN_CITY_CENTERS[cityKey]
  if (known) {
    return known
  }
  const lat = 30.5 + hashToUnit(`${cityKey}:lat`) * 11.5
  const lng = -121.5 + hashToUnit(`${cityKey}:lng`) * 23.5
  return { lat: Number(lat.toFixed(4)), lng: Number(lng.toFixed(4)) }
}

function metersToLatDegrees(meters: number): number {
  return meters / 111320
}

function metersToLngDegrees(meters: number, latitude: number): number {
  const latRadians = (latitude * Math.PI) / 180
  const metersPerDegree = 111320 * Math.max(0.2, Math.cos(latRadians))
  return meters / metersPerDegree
}

function deriveQueryCenters(city: string, maxCenters: number, offsetM: number): QueryCenter[] {
  const center = getCityCenter(city)
  const latOffset = metersToLatDegrees(offsetM)
  const lngOffset = metersToLngDegrees(offsetM, center.lat)
  const allCenters: QueryCenter[] = [
    {
      id: 'core',
      lat: Number(center.lat.toFixed(5)),
      lng: Number(center.lng.toFixed(5)),
    },
    {
      id: 'north',
      lat: Number((center.lat + latOffset).toFixed(5)),
      lng: Number(center.lng.toFixed(5)),
    },
    {
      id: 'east',
      lat: Number(center.lat.toFixed(5)),
      lng: Number((center.lng + lngOffset).toFixed(5)),
    },
    {
      id: 'south',
      lat: Number((center.lat - latOffset).toFixed(5)),
      lng: Number(center.lng.toFixed(5)),
    },
    {
      id: 'west',
      lat: Number(center.lat.toFixed(5)),
      lng: Number((center.lng - lngOffset).toFixed(5)),
    },
  ]
  return allCenters.slice(0, Math.max(1, Math.min(5, maxCenters)))
}

function derivePocketQueryCenter(hint: LiveRetrievalPocketHint): QueryCenter {
  return {
    id: 'pocket',
    lat: Number(hint.centroid.lat.toFixed(5)),
    lng: Number(hint.centroid.lng.toFixed(5)),
    source: hint.source,
    pocketId: hint.pocketId,
    label: hint.pocketLabel,
  }
}

function getPocketQueryRadiusM(hint: LiveRetrievalPocketHint | undefined, fallbackRadiusM: number): number {
  if (!hint) {
    return fallbackRadiusM
  }
  return Math.min(
    POCKET_QUERY_RADIUS_MAX_M,
    Math.max(POCKET_QUERY_RADIUS_MIN_M, Math.ceil(hint.radiusM + POCKET_RADIUS_BUFFER_M)),
  )
}

function distanceM(
  left: { lat: number; lng: number },
  right: { lat: number; lng: number },
): number {
  const earthRadiusM = 6371000
  const toRadians = (value: number) => (value * Math.PI) / 180
  const deltaLat = toRadians(right.lat - left.lat)
  const deltaLng = toRadians(right.lng - left.lng)
  const leftLat = toRadians(left.lat)
  const rightLat = toRadians(right.lat)
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(leftLat) * Math.cos(rightLat) * Math.sin(deltaLng / 2) ** 2
  return 2 * earthRadiusM * Math.asin(Math.sqrt(haversine))
}

function getVenueCoordinates(venue: Venue): { lat: number; lng: number } | undefined {
  const latitude = venue.source.latitude
  const longitude = venue.source.longitude
  if (
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude)
  ) {
    return undefined
  }
  return { lat: latitude, lng: longitude }
}

function findCoherentCoordinateCluster(venues: Venue[]): Venue[] {
  const coordinateVenues = venues.filter((venue) => getVenueCoordinates(venue))
  let bestCluster: Venue[] = []

  for (const anchor of coordinateVenues) {
    const anchorCoordinates = getVenueCoordinates(anchor)
    if (!anchorCoordinates) {
      continue
    }
    const cluster = coordinateVenues.filter((candidate) => {
      const candidateCoordinates = getVenueCoordinates(candidate)
      return (
        candidateCoordinates &&
        distanceM(anchorCoordinates, candidateCoordinates) <= COORDINATE_CLUSTER_MAX_PAIRWISE_M
      )
    })
    if (cluster.length > bestCluster.length) {
      bestCluster = cluster
    }
  }

  if (bestCluster.length < COORDINATE_CLUSTER_MIN_VENUES) {
    return []
  }

  const internallyCoherent = bestCluster.every((left) => {
    const leftCoordinates = getVenueCoordinates(left)
    return (
      leftCoordinates &&
      bestCluster.every((right) => {
        const rightCoordinates = getVenueCoordinates(right)
        return (
          rightCoordinates &&
          distanceM(leftCoordinates, rightCoordinates) <= COORDINATE_CLUSTER_MAX_PAIRWISE_M
        )
      })
    )
  })

  return internallyCoherent ? bestCluster : []
}

function applyPocketFilter(venues: Venue[], hint: LiveRetrievalPocketHint | undefined): {
  venues: Venue[]
  reason?: string
  inputCount: number
  insideEnvelopeCount: number
  coordinateClusterCount: number
  droppedCount: number
} {
  if (!hint) {
    return {
      venues,
      inputCount: venues.length,
      insideEnvelopeCount: 0,
      coordinateClusterCount: 0,
      droppedCount: 0,
    }
  }

  const envelopeRadiusM = getPocketQueryRadiusM(hint, POCKET_QUERY_RADIUS_MIN_M)
  const insideEnvelope = venues.filter((venue) => {
    const coordinates = getVenueCoordinates(venue)
    return coordinates && distanceM(hint.centroid, coordinates) <= envelopeRadiusM
  })
  const coordinateCluster =
    insideEnvelope.length >= COORDINATE_CLUSTER_MIN_VENUES
      ? []
      : findCoherentCoordinateCluster(venues.filter((venue) => !insideEnvelope.includes(venue)))
  const selected =
    insideEnvelope.length > 0
      ? insideEnvelope
      : coordinateCluster.length > 0
        ? coordinateCluster
        : []
  const selectedIds = new Set(selected.map((venue) => venue.id))

  return {
    venues: selected,
    reason:
      selected.length === 0
        ? 'no_viable_pocket'
        : insideEnvelope.length > 0
          ? 'pocket_envelope_admitted'
          : 'coordinate_only_cluster_admitted',
    inputCount: venues.length,
    insideEnvelopeCount: insideEnvelope.length,
    coordinateClusterCount: coordinateCluster.length,
    droppedCount: venues.filter((venue) => !selectedIds.has(venue.id)).length,
  }
}

function countByGateStatus(venues: Venue[], status: QualityGateStatus): number {
  return venues.filter((venue) => venue.source.qualityGateStatus === status).length
}

function emptyMapDropReasons(): Record<MapLivePlaceDropReason, number> {
  return {
    missing_name: 0,
    missing_place_id: 0,
    unsupported_category: 0,
  }
}

function incrementBucket(counter: Record<string, number>, key: string): void {
  counter[key] = (counter[key] ?? 0) + 1
}

function formatLocationLabel(intent: IntentProfile): string {
  return intent.neighborhood ? `${intent.neighborhood}, ${intent.city}` : intent.city
}

function gateStatusRank(status: QualityGateStatus): number {
  if (status === 'approved') {
    return 3
  }
  if (status === 'demoted') {
    return 2
  }
  return 1
}

function compareVenueQuality(left: Venue, right: Venue): number {
  const gateDelta =
    gateStatusRank(left.source.qualityGateStatus) - gateStatusRank(right.source.qualityGateStatus)
  if (gateDelta !== 0) {
    return gateDelta
  }
  if (left.source.qualityScore !== right.source.qualityScore) {
    return left.source.qualityScore - right.source.qualityScore
  }
  if (left.source.sourceConfidence !== right.source.sourceConfidence) {
    return left.source.sourceConfidence - right.source.sourceConfidence
  }
  if (left.source.completenessScore !== right.source.completenessScore) {
    return left.source.completenessScore - right.source.completenessScore
  }
  return right.id.localeCompare(left.id)
}

function dedupeByPlaceId(venues: Venue[]): { venues: Venue[]; dropped: number } {
  const bestByKey = new Map<string, Venue>()
  for (const venue of venues) {
    const key =
      venue.source.providerRecordId ??
      `${normalizeCity(venue.city)}|${venue.name.trim().toLowerCase()}|${venue.category}`
    const existing = bestByKey.get(key)
    if (!existing || compareVenueQuality(venue, existing) > 0) {
      bestByKey.set(key, venue)
    }
  }
  const deduped = [...bestByKey.values()].sort((left, right) => left.id.localeCompare(right.id))
  return {
    venues: deduped,
    dropped: Math.max(0, venues.length - deduped.length),
  }
}

function normalizeRawPlaces(
  rawPlaces: RawPlace[],
  intent: IntentProfile,
): {
  venues: Venue[]
  droppedCount: number
  droppedReasons: Record<string, number>
} {
  const timeWindowSignal = getTimeWindowSignal(intent)
  const venues: Venue[] = []
  let droppedCount = 0
  const droppedReasons: Record<string, number> = {}

  for (const rawPlace of rawPlaces) {
    try {
      venues.push(
        normalizeVenue(rawPlace, {
          timeWindowSignal,
        }),
      )
    } catch (error) {
      droppedCount += 1
      const reason =
        error instanceof Error && error.message
          ? `normalize_error:${error.message.split(':')[0]}`
          : 'normalize_error:unknown'
      incrementBucket(droppedReasons, reason)
    }
  }

  return {
    venues,
    droppedCount,
    droppedReasons,
  }
}

function countSuppressionReasons(venues: Venue[]): Record<string, number> {
  const reasons: Record<string, number> = {}
  for (const venue of venues) {
    if (venue.source.qualityGateStatus !== 'suppressed') {
      continue
    }
    if (venue.source.suppressionReasons.length === 0) {
      incrementBucket(reasons, 'suppressed_without_reason')
      continue
    }
    for (const reason of venue.source.suppressionReasons) {
      incrementBucket(reasons, reason)
    }
  }
  return reasons
}

function adaptProviderVenueToLivePlaceMapperInput(
  place: ProviderVenue,
): LivePlaceMapperInput {
  return {
    businessStatus: place.businessStatus,
    currentOpeningHours: place.currentOpeningHours
      ? {
          openNow: place.currentOpeningHours.openNow,
          periods: place.currentOpeningHours.periods,
          weekdayDescriptions: place.currentOpeningHours.weekdayDescriptions,
        }
      : undefined,
    displayName: {
      text: place.displayName,
    },
    liveMusic: place.liveMusic,
    editorialSummary: place.editorialSummary
      ? {
          text: place.editorialSummary,
        }
      : undefined,
    formattedAddress: place.formattedAddress,
    goodForChildren: place.goodForChildren,
    goodForGroups: place.goodForGroups,
    id: place.providerRecordId,
    location: place.location,
    primaryType: place.primaryType,
    rating: place.rating,
    regularOpeningHours: place.regularOpeningHours
      ? {
          periods: place.regularOpeningHours.periods,
          weekdayDescriptions: place.regularOpeningHours.weekdayDescriptions,
        }
      : undefined,
    allowsDogs: place.allowsDogs,
    servesBeer: place.servesBeer,
    servesVegetarianFood: place.servesVegetarianFood,
    servesWine: place.servesWine,
    shortFormattedAddress: place.shortFormattedAddress,
    types: place.types,
    userRatingCount: place.userRatingCount,
    utcOffsetMinutes: place.utcOffsetMinutes,
    websiteUri: place.websiteUri,
  }
}

export async function fetchLivePlaces(
  intent: IntentProfile,
  starterPack?: StarterPack,
  options: FetchLivePlacesOptions = {},
): Promise<FetchLivePlacesResult> {
  const config = getGooglePlacesConfig()
  const pocketHint = starterPack?.id === 'coffee-books' ? options.pocketHint : undefined
  const queryLocationLabel = pocketHint?.locationLabel ?? formatLocationLabel(intent)
  const allBaseQueryPlan = buildLiveQueryPlan(intent, starterPack, {
    ...(pocketHint?.locationLabel ? { locationLabelOverride: pocketHint.locationLabel } : {}),
  })
  const allowedLabels = new Set(options.liveQueryLabels ?? [])
  const baseQueryPlanBeforeEnvelope =
    allowedLabels.size > 0
      ? allBaseQueryPlan.filter((entry) => allowedLabels.has(entry.label))
      : allBaseQueryPlan
  const maxQueryLabels =
    typeof options.envelope?.maxQueryLabels === 'number'
      ? Math.max(0, options.envelope.maxQueryLabels)
      : baseQueryPlanBeforeEnvelope.length
  const baseQueryPlan = baseQueryPlanBeforeEnvelope.slice(0, maxQueryLabels)
  const queryCentersBeforeEnvelope = pocketHint
    ? [derivePocketQueryCenter(pocketHint)]
    : deriveQueryCenters(
        intent.city,
        config.maxCenters,
        config.centerOffsetM,
      )
  const maxQueryCenters =
    typeof options.maxQueryCenters === 'number'
      ? Math.max(0, options.maxQueryCenters)
      : queryCentersBeforeEnvelope.length
  const queryCenters = queryCentersBeforeEnvelope.slice(0, maxQueryCenters)
  const maxProviderCalls =
    typeof options.envelope?.maxProviderCalls === 'number'
      ? Math.max(0, options.envelope.maxProviderCalls)
      : Number.POSITIVE_INFINITY
  const queryRadiusM = getPocketQueryRadiusM(pocketHint, config.queryRadiusM)
  const queryPlan: Array<
    (typeof baseQueryPlan)[number] & {
      center: QueryCenter
      label: string
      radiusM: number
    }
  > = []
  for (const entry of baseQueryPlan) {
    for (const center of queryCenters) {
      if (queryPlan.length >= maxProviderCalls) {
        break
      }
      queryPlan.push({
        ...entry,
        label: `${entry.label}@${center.id}`,
        center,
        radiusM: queryRadiusM,
      })
    }
    if (queryPlan.length >= maxProviderCalls) {
      break
    }
  }
  const dispatchQueriesPlannedWithinCap =
    typeof options.envelope?.maxProviderCalls === 'number'
      ? queryPlan.length <= Math.max(0, options.envelope.maxProviderCalls)
      : true
  const queryTemplatesUsed = [...new Set(queryPlan.map((entry) => entry.template))]
  const queryLabelsUsed = queryPlan.map((entry) => entry.label)
  const roleIntentQueryNotes = [...new Set(baseQueryPlan.flatMap((entry) => entry.notes))]
  const requestedKindsForPlan = [...new Set(baseQueryPlan.map((entry) => entry.kind))]

  const providerResults = await searchPlaces({
    callPurpose: 'retrieval_supply',
    city: intent.city,
    context: {
      ...(starterPack?.id ? { starterId: starterPack.id } : {}),
      ...(intent.primaryAnchor ? { vibe: intent.primaryAnchor } : {}),
      ...(intent.persona ? { persona: intent.persona } : {}),
      ...(intent.timeWindow ? { timeWindow: intent.timeWindow } : {}),
      ...(intent.neighborhood ? { neighborhood: intent.neighborhood } : {}),
    },
    mapPlace: (place, { index, query }) => {
      const mapped = mapLivePlaceToRawPlaceWithDiagnostics(
        adaptProviderVenueToLivePlaceMapperInput(place),
        {
          city: intent.city,
          neighborhood: intent.neighborhood,
          requestedKind: query.kind,
          queryLabel: query.queryLabel,
          queryTerms: query.queryTerms,
          rank: index,
        },
      )
      return {
        dropReason: mapped.dropReason,
        queryLabel: query.queryLabel,
        rawPlace: mapped.rawPlace,
      }
    },
    queries: queryPlan.map((query) => ({
      fieldMask: googleFieldMask,
      locationBias: {
        circle: {
          center: {
            latitude: query.center.lat,
            longitude: query.center.lng,
          },
          radius: query.radiusM,
        },
      },
      pageSize: config.pageSize,
      queryLabel: query.label,
      rankPreference: 'RELEVANCE',
      ...query,
    })),
    mode: intent.mode,
    sourceMode: options.sourceMode,
    envelope: options.envelope,
  })
  const dispatchQueriesAttempted =
    providerResults.diagnostics.trace?.attemptedHttpRequestCount ?? 0
  if (options.stepBCurateLiveSmokeActive) {
    console.info('[ID8 STEP B] Curate live dispatch cap', {
      maxProviderCalls: options.envelope?.maxProviderCalls,
      maxQueryLabels: options.envelope?.maxQueryLabels,
      maxCenters: options.maxQueryCenters,
      labelsConsidered: baseQueryPlanBeforeEnvelope.length,
      labelsAdmitted: baseQueryPlan.length,
      centersConsidered: queryCentersBeforeEnvelope.length,
      centersAdmitted: queryCenters.length,
      dispatchQueriesPlanned: queryPlan.length,
      dispatchQueriesAttempted,
      assertion: `dispatch queries planned <= ${options.envelope?.maxProviderCalls ?? 'unbounded'}`,
      dispatchQueriesPlannedWithinCap,
    })
  }

  if (providerResults.diagnostics.blockedByEnv) {
    return {
      venues: [],
      diagnostics: {
        attempted: false,
        provider: 'google-places',
        queryLocationLabel,
        queryCentersCount: queryCenters.length,
        queryCentersUsed: queryCenters,
        queryRadiusM,
        ...(pocketHint ? { pocketHint } : {}),
        pocketCenteredRetrievalApplied: Boolean(pocketHint),
        pocketFilterInputCount: 0,
        pocketFilterInsideEnvelopeCount: 0,
        pocketFilterCoordinateClusterCount: 0,
        pocketFilterDroppedCount: 0,
        requestedKinds: requestedKindsForPlan,
        queryCount: 0,
        labelsConsidered: baseQueryPlanBeforeEnvelope.length,
        labelsAdmitted: baseQueryPlan.length,
        centersConsidered: queryCentersBeforeEnvelope.length,
        centersAdmitted: queryCenters.length,
        dispatchQueriesPlanned: queryPlan.length,
        dispatchQueriesAttempted,
        dispatchQueriesPlannedWithinCap,
        liveQueryTemplatesUsed: queryTemplatesUsed,
        liveQueryLabelsUsed: queryLabelsUsed,
        liveCandidatesByQuery: [],
        liveRoleIntentQueryNotes: roleIntentQueryNotes,
        fetchedCount: 0,
        rawFetchedCount: 0,
        mappedCount: 0,
        mappedDroppedCount: 0,
        mappedDropReasons: emptyMapDropReasons(),
        normalizedCount: 0,
        dedupedByPlaceIdCount: 0,
        normalizationDroppedCount: 0,
        normalizationDropReasons: {},
        acceptedCount: 0,
        acceptanceDroppedCount: 0,
        acceptanceDropReasons: {},
        approvedCount: 0,
        demotedCount: 0,
        suppressedCount: 0,
        usableCount: 0,
        partialFailure: false,
        success: false,
        failureReason: providerResults.diagnostics.failureReason,
        failureCategory: providerResults.diagnostics.keyPresent
          ? 'disabled_dev_closeout'
          : 'missing_api_key',
        errors: [],
      },
    }
  }

  const errors = providerResults.errors
  let fetchedCount = 0
  const rawPlaces: RawPlace[] = []
  const mappedCountByQuery = new Map<string, number>()
  const fetchedCountByQuery = new Map<string, number>()
  const mappedDropReasons = emptyMapDropReasons()
  let mappedDroppedCount = 0

  providerResults.queryCounts.forEach(({ queryLabel, resultCount }) => {
    fetchedCount += resultCount
    fetchedCountByQuery.set(queryLabel, resultCount)
  })

  for (const result of providerResults.results) {
    if (result.rawPlace) {
      rawPlaces.push(result.rawPlace)
      mappedCountByQuery.set(
        result.queryLabel,
        (mappedCountByQuery.get(result.queryLabel) ?? 0) + 1,
      )
    } else if (result.dropReason) {
      mappedDroppedCount += 1
      mappedDropReasons[result.dropReason] = (mappedDropReasons[result.dropReason] ?? 0) + 1
    }
  }

  const normalized = normalizeRawPlaces(rawPlaces, intent)
  const deduped = dedupeByPlaceId(normalized.venues)
  const pocketFiltered = applyPocketFilter(deduped.venues, pocketHint)
  const venues = pocketFiltered.venues
  const selectedVenueIds = new Set(venues.map((venue) => venue.id))
  const normalizedVenueIds = new Set(normalized.venues.map((venue) => venue.id))
  const successfulQueries = providerResults.queryCounts.length
  const liveCandidatesByQuery: LiveCandidatesByQueryDiagnostics[] = queryPlan.map((query) => {
    const mapped = rawPlaces.filter((rawPlace) => rawPlace.sourceQueryLabel === query.label)
    const normalizedForQuery = normalized.venues.filter(
      (venue) => venue.source.sourceQueryLabel === query.label,
    )
    const normalizedByRawId = new Map(normalizedForQuery.map((venue) => [venue.id, venue]))
    const candidates = mapped.map((rawPlace) => {
      const normalizedVenue = normalizedByRawId.get(rawPlace.id)
      const normalizedResult = Boolean(normalizedVenue)
      const candidateBoardAdmission = Boolean(normalizedVenue && selectedVenueIds.has(normalizedVenue.id))
      const pocketFilter: NonNullable<
        LiveCandidatesByQueryDiagnostics['candidates']
      >[number]['pocketFilter'] =
        !pocketHint
          ? 'not_applicable'
          : candidateBoardAdmission
            ? 'admitted'
            : normalizedResult
              ? 'outside_pocket_envelope'
              : 'unknown_drop_stage'
      return {
        name: rawPlace.name,
        venueId: normalizedVenue?.id ?? rawPlace.id,
        ...((normalizedVenue?.source.providerRecordId ?? rawPlace.providerRecordId)
          ? { providerPlaceId: normalizedVenue?.source.providerRecordId ?? rawPlace.providerRecordId }
          : {}),
        sourceTypes: normalizedVenue?.source.sourceTypes ?? rawPlace.sourceTypes ?? [],
        providerResultSummary: true,
        normalizedResult,
        candidateBoardAdmission,
        pocketFilter,
        ...(!normalizedResult && !normalizedVenueIds.has(rawPlace.id)
          ? { dropReason: 'normalization_or_dedupe_drop' }
          : pocketFilter === 'outside_pocket_envelope'
            ? { dropReason: pocketFiltered.reason ?? 'outside_pocket_envelope' }
            : {}),
      }
    })
    return {
      label: query.label,
      template: query.template,
      roleHint: query.roleHint,
      fetchedCount: fetchedCountByQuery.get(query.label) ?? 0,
      mappedCount: mappedCountByQuery.get(query.label) ?? mapped.length,
      normalizedCount: normalizedForQuery.length,
      approvedCount: countByGateStatus(normalizedForQuery, 'approved'),
      demotedCount: countByGateStatus(normalizedForQuery, 'demoted'),
      suppressedCount: countByGateStatus(normalizedForQuery, 'suppressed'),
      candidates,
    }
  })

  return {
    venues,
    diagnostics: {
      attempted: true,
      provider: 'google-places',
      queryLocationLabel,
      queryCentersCount: queryCenters.length,
      queryCentersUsed: queryCenters,
      queryRadiusM,
      ...(pocketHint ? { pocketHint } : {}),
      pocketCenteredRetrievalApplied: Boolean(pocketHint),
      ...(pocketFiltered.reason ? { pocketFilterReason: pocketFiltered.reason } : {}),
      pocketFilterInputCount: pocketFiltered.inputCount,
      pocketFilterInsideEnvelopeCount: pocketFiltered.insideEnvelopeCount,
      pocketFilterCoordinateClusterCount: pocketFiltered.coordinateClusterCount,
      pocketFilterDroppedCount: pocketFiltered.droppedCount,
      requestedKinds: requestedKindsForPlan,
      queryCount: queryPlan.length,
      labelsConsidered: baseQueryPlanBeforeEnvelope.length,
      labelsAdmitted: baseQueryPlan.length,
      centersConsidered: queryCentersBeforeEnvelope.length,
      centersAdmitted: queryCenters.length,
      dispatchQueriesPlanned: queryPlan.length,
      dispatchQueriesAttempted,
      dispatchQueriesPlannedWithinCap,
      liveQueryTemplatesUsed: queryTemplatesUsed,
      liveQueryLabelsUsed: queryLabelsUsed,
      liveCandidatesByQuery,
      liveRoleIntentQueryNotes: roleIntentQueryNotes,
      fetchedCount,
      rawFetchedCount: fetchedCount,
      mappedCount: rawPlaces.length,
      mappedDroppedCount,
      mappedDropReasons,
      normalizedCount: venues.length,
      dedupedByPlaceIdCount: deduped.dropped,
      normalizationDroppedCount: normalized.droppedCount,
      normalizationDropReasons: normalized.droppedReasons,
      acceptedCount: venues.length - countByGateStatus(venues, 'suppressed'),
      acceptanceDroppedCount: countByGateStatus(venues, 'suppressed'),
      acceptanceDropReasons: countSuppressionReasons(venues),
      approvedCount: countByGateStatus(venues, 'approved'),
      demotedCount: countByGateStatus(venues, 'demoted'),
      suppressedCount: countByGateStatus(venues, 'suppressed'),
      usableCount: venues.length - countByGateStatus(venues, 'suppressed'),
      partialFailure: errors.length > 0 && successfulQueries > 0,
      success: successfulQueries > 0,
      failureReason:
        successfulQueries === 0 && errors.length > 0
          ? errors[0]
          : undefined,
      failureCategory:
        successfulQueries === 0 && errors.length > 0
          ? 'request_failure'
          : errors.length > 0 && successfulQueries > 0
            ? 'partial_failure'
            : venues.length - countByGateStatus(venues, 'suppressed') === 0
              ? 'attrition_or_empty'
              : undefined,
      errors,
    },
  }
}
