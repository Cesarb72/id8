import { curatedVenues } from '../../data/venues'
import { normalizeRawPlace } from '../normalize/normalizeRawPlace'
import type { RawPlace } from '../types/rawPlace'
import type { Venue } from '../types/venue'
import {
  resolveCanonicalVenueIdForProviderVenue,
  type ProviderCanonicalVenueMapping,
} from './providerCanonicalVenueMapping'
import { providerCanonicalVenueSeeds } from './providerCanonicalVenueSeeds'
import {
  evaluateProviderVenueCompleteness,
  type ProviderCompletenessGateResult,
} from './providerCompletenessGate'
import {
  admitLiveVenueIdentity,
  type LiveVenueIdentityAdmissionResult,
} from './admitLiveVenueIdentity'
import {
  searchPlaces,
  type ProviderAdapterDiagnostics,
  type ProviderTextSearchQuery,
} from './ProviderAdapter'
import {
  evaluateSupplyEquivalence,
  type SupplyEquivalenceResult,
} from './supplyEquivalence'
import type {
  ProviderCallLedger,
  ProviderCallTrace,
} from './providerCallTrace'
import type { ProviderVenue } from './providerTypes'
import {
  CLOSED_RUNTIME_LIVE_ENVELOPE,
  type LiveProviderEnvelope,
} from '../retrieval/liveEnvelope'

const BUILD_PROVIDER_SUPPLY_ENV_FLAG = 'VITE_ID8_BUILD_PROVIDER_SUPPLY'
const DEFAULT_NEARBY_RADIUS_M = 900
const DEFAULT_NEARBY_PAGE_SIZE = 5
const BUILD_PROVIDER_ROLE_QUERY_LABELS = {
  start: 'build-provider-start',
  highlight: 'build-provider-highlight',
  windDown: 'build-provider-winddown',
} as const
const BUILD_PROVIDER_QUERY_LABELS = [
  BUILD_PROVIDER_ROLE_QUERY_LABELS.start,
  BUILD_PROVIDER_ROLE_QUERY_LABELS.highlight,
  BUILD_PROVIDER_ROLE_QUERY_LABELS.windDown,
] as const
const DEFAULT_FIELD_MASK = [
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
  'places.editorialSummary',
  'places.businessStatus',
  'places.currentOpeningHours.openNow',
  'places.currentOpeningHours.weekdayDescriptions',
  'places.currentOpeningHours.periods',
  'places.regularOpeningHours.weekdayDescriptions',
  'places.regularOpeningHours.periods',
  'places.rating',
  'places.userRatingCount',
  'places.utcOffsetMinutes',
  'places.websiteUri',
  'places.location',
].join(',')

export type BuildProviderSupplyBlockedReason =
  | 'build_provider_supply_disabled'
  | 'anchor_canonical_identity_missing'
  | 'anchor_provider_record_missing'
  | 'anchor_coordinates_missing'
  | 'provider_request_blocked'
  | 'provider_request_failed'
  | 'provider_zero_results'
  | 'provider_no_admissible_candidates'
  | 'provider_insufficient_role_diversity'
  | 'provider_nearby_not_yet_available'

export interface BuildProviderRoleCandidateCounts {
  start: number
  highlight: number
  windDown: number
}

export type BuildProviderRoleFailureReason =
  | 'warmup_below_threshold'
  | 'peak_below_threshold'
  | 'cooldown_below_threshold'
  | 'energy_above_threshold'
  | 'not_highlight_capable'
  | 'quality_gate_not_approved'
  | 'hours_suppressed'

export interface BuildProviderRoleEligibilityDiagnostic {
  eligible: boolean
  failedReasons: BuildProviderRoleFailureReason[]
}

export interface BuildProviderRoleCandidateReviewSummary {
  providerRecordId: string
  displayName: string
  normalizedCategory?: Venue['category']
  primaryType?: string
  tags: string[]
  energyLevel?: number
  highlightCapable?: boolean
  roleAffinity?: {
    warmup?: number
    peak?: number
    cooldown?: number
  }
  qualityGateStatus?: Venue['source']['qualityGateStatus']
  hoursSuppressionApplied?: boolean
  start: BuildProviderRoleEligibilityDiagnostic
  highlight: BuildProviderRoleEligibilityDiagnostic
  windDown: BuildProviderRoleEligibilityDiagnostic
}

export interface BuildProviderNearbyCandidateReviewSummary {
  providerRecordId: string
  displayName: string
  primaryType: string | null
  normalizedCategory: Venue['category'] | null
  formattedAddress: string | null
  neighborhood: string | null
  canonicalVenueId: string | null
  canonicalMatchMethod: ProviderCanonicalVenueMapping['matchMethod']
  canonicalConfidence: number
  completenessStatus: ProviderCompletenessGateResult['status']
  completenessFailureReason?: string
  equivalenceStatus: SupplyEquivalenceResult['status']
  equivalenceBlockingReasons: SupplyEquivalenceResult['blockingReasons']
  suppressionReasons: string[]
}

export interface BuildProviderSourceOpportunityDiagnostics {
  buildProviderSupplyEnabled: boolean
  buildProviderAnchorCanonicalVenueId: string | null
  buildProviderAnchorProviderRecordId: string | null
  buildProviderAttemptedQueryLabels: string[]
  buildProviderPerLabelResultCounts: Array<{
    queryLabel: string
    resultCount: number
  }>
  buildProviderMergedUniqueResultCount: number
  buildProviderNearbyVenueCount: number
  buildProviderSuppressedVenueCount: number
  buildProviderRoleCandidateCounts: BuildProviderRoleCandidateCounts
  buildProviderSourceOpportunityEmitted: boolean
  buildProviderSupplyBlockedReason: BuildProviderSupplyBlockedReason | null
  buildProviderStaticFallbackUsed: boolean
  buildProviderTraceBillableCallCount: number
  suppressionReasons: string[]
  nearbyCandidateReviews: BuildProviderNearbyCandidateReviewSummary[]
  roleCandidateReviewSummaries: BuildProviderRoleCandidateReviewSummary[]
  canonicalMappings: ProviderCanonicalVenueMapping[]
  completeness: ProviderCompletenessGateResult[]
  equivalence: SupplyEquivalenceResult[]
  trace: ProviderCallTrace | null
  ledger: ProviderCallLedger | null
}

export interface BuildProviderSourceOpportunity {
  id: string
  sourceMode: 'live'
  anchor: {
    canonicalVenueId: string
    providerRecordId: string
    venue: Venue
  }
  nearbyCandidates: Venue[]
  roleCandidates: {
    start: Venue[]
    highlight: Venue[]
    windDown: Venue[]
  }
  diagnostics: {
    canonicalMappings: ProviderCanonicalVenueMapping[]
    completeness: ProviderCompletenessGateResult[]
    equivalence: SupplyEquivalenceResult[]
    trace: ProviderCallTrace
    ledger: ProviderCallLedger
    suppressionReasons: string[]
    roleCandidateCounts: BuildProviderRoleCandidateCounts
  }
}

export interface BuildProviderSourceOpportunityResult {
  diagnostics: BuildProviderSourceOpportunityDiagnostics
  opportunity: BuildProviderSourceOpportunity | null
}

export interface BuildProviderSourceOpportunityInput {
  anchorVenue: Venue
  liveEnvelope?: LiveProviderEnvelope
  pageSize?: number
  radiusM?: number
}

interface BuildProviderMappedVenue {
  providerVenue: ProviderVenue
  rawPlace: RawPlace
  sourceQueryLabel: string
}

interface AdmittedNearbyCandidateReview {
  primaryType?: string
  venue: Venue
}

function getProcessEnvValue(key: string): string | undefined {
  const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env
  return processEnv?.[key]
}

function readEnvValue(key: string): string | undefined {
  const importMetaEnv = (import.meta as ImportMeta & {
    env?: Record<string, string | undefined>
  }).env
  return importMetaEnv?.[key] ?? getProcessEnvValue(key)
}

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined
  }
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }
  return undefined
}

export function isBuildProviderSupplyEnabled(): boolean {
  return parseBooleanEnv(readEnvValue(BUILD_PROVIDER_SUPPLY_ENV_FLAG)) === true
}

function getAnchorCoordinates(anchorVenue: Venue): [number, number] | null {
  const latitude = anchorVenue.source.latitude
  const longitude = anchorVenue.source.longitude
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return null
  }
  return [longitude, latitude]
}

function resolveAnchorProviderRecordId(canonicalVenueId: string): string | null {
  const seed = providerCanonicalVenueSeeds.find(
    (entry) =>
      entry.provider === 'google-places' && entry.canonicalVenueId === canonicalVenueId,
  )
  return seed?.providerRecordId ?? null
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180
}

function computeDistanceMeters(from: [number, number], to: [number, number]): number {
  const [fromLng, fromLat] = from
  const [toLng, toLat] = to
  const earthRadiusMeters = 6371000
  const deltaLat = toRadians(toLat - fromLat)
  const deltaLng = toRadians(toLng - fromLng)
  const fromLatRadians = toRadians(fromLat)
  const toLatRadians = toRadians(toLat)
  const haversine =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(fromLatRadians) *
      Math.cos(toLatRadians) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2)
  const angularDistance = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  return earthRadiusMeters * angularDistance
}

function estimateDriveMinutes(anchorCoordinates: [number, number], venueCoordinates: [number, number]): number {
  const distanceMeters = computeDistanceMeters(anchorCoordinates, venueCoordinates)
  const nearbyMetersPerMinute = 140
  return Math.max(2, Math.min(12, Math.round(distanceMeters / nearbyMetersPerMinute)))
}

function normalizeTag(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_]+/g, '-')
}

function getProviderVenueAtmosphereTags(providerVenue: ProviderVenue): string[] {
  const tags: string[] = []
  if (providerVenue.liveMusic) {
    tags.push('live-music')
  }
  if (providerVenue.servesBeer) {
    tags.push('beer')
  }
  if (providerVenue.servesWine) {
    tags.push('wine')
  }
  if (providerVenue.goodForGroups) {
    tags.push('group')
  }
  if (providerVenue.goodForChildren) {
    tags.push('family-friendly')
  }
  if (providerVenue.allowsDogs) {
    tags.push('dog-friendly')
  }
  if (providerVenue.servesVegetarianFood) {
    tags.push('vegetarian-friendly')
  }
  return tags
}

function inferNeighborhoodFromAddress(
  providerVenue: ProviderVenue,
  fallbackNeighborhood: string,
): string {
  const shortAddress = providerVenue.shortFormattedAddress?.trim()
  if (shortAddress) {
    const firstSegment = shortAddress.split(',')[0]?.trim()
    if (firstSegment && firstSegment.length >= 3) {
      return firstSegment
    }
  }

  const fullAddress = providerVenue.formattedAddress?.trim()
  if (fullAddress) {
    const firstSegment = fullAddress.split(',')[0]?.trim()
    if (firstSegment && firstSegment.length >= 3) {
      return firstSegment
    }
  }

  return fallbackNeighborhood
}

function buildNearbyTextQuery(
  anchorVenue: Venue,
  queryLabel: (typeof BUILD_PROVIDER_QUERY_LABELS)[number],
): string {
  if (queryLabel === BUILD_PROVIDER_ROLE_QUERY_LABELS.start) {
    return `cafes wine bars casual restaurants low key openers near ${anchorVenue.name}, ${anchorVenue.city}`
  }
  if (queryLabel === BUILD_PROVIDER_ROLE_QUERY_LABELS.highlight) {
    return `destination restaurants live music nightlife experiences near ${anchorVenue.name}, ${anchorVenue.city}`
  }
  return `dessert quiet lounges late night cafes relaxed nightcap spots near ${anchorVenue.name}, ${anchorVenue.city}`
}

function buildNearbyQuery(params: {
  anchorCoordinates: [number, number]
  anchorVenue: Venue
  pageSize: number
  queryLabel: (typeof BUILD_PROVIDER_QUERY_LABELS)[number]
  radiusM: number
}): ProviderTextSearchQuery {
  const [longitude, latitude] = params.anchorCoordinates
  return {
    fieldMask: DEFAULT_FIELD_MASK,
    locationBias: {
      circle: {
        center: {
          latitude,
          longitude,
        },
        radius: params.radiusM,
      },
    },
    pageSize: params.pageSize,
    queryLabel: params.queryLabel,
    rankPreference: 'DISTANCE',
    textQuery: buildNearbyTextQuery(params.anchorVenue, params.queryLabel),
  }
}

function buildRoleDiverseNearbyQueries(params: {
  anchorCoordinates: [number, number]
  anchorVenue: Venue
  pageSize: number
  radiusM: number
}): ProviderTextSearchQuery[] {
  return BUILD_PROVIDER_QUERY_LABELS.map((queryLabel) =>
    buildNearbyQuery({
      ...params,
      queryLabel,
    }),
  )
}

function applyBuildProviderQueryEnvelope(
  queries: ProviderTextSearchQuery[],
  liveEnvelope: LiveProviderEnvelope,
): ProviderTextSearchQuery[] {
  let plannedQueries = queries.slice()
  if (liveEnvelope.maxQueryLabels != null) {
    if (liveEnvelope.maxQueryLabels <= 0) {
      plannedQueries = []
    } else {
      const allowedLabels = new Set(
        plannedQueries.map((query) => query.queryLabel).slice(0, liveEnvelope.maxQueryLabels),
      )
      plannedQueries = plannedQueries.filter((query) => allowedLabels.has(query.queryLabel))
    }
  }
  if (liveEnvelope.maxProviderCalls != null && liveEnvelope.maxProviderCalls >= 0) {
    plannedQueries = plannedQueries.slice(0, liveEnvelope.maxProviderCalls)
  }
  return plannedQueries
}

function dedupeProviderSearchResults(
  results: BuildProviderMappedVenue[],
): BuildProviderMappedVenue[] {
  const seen = new Set<string>()
  const deduped: BuildProviderMappedVenue[] = []
  for (const result of results) {
    const key = result.providerVenue.providerRecordId.trim() || result.rawPlace.id
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    deduped.push(result)
  }
  return deduped
}

function mapProviderVenueToRawPlace(params: {
  anchorCoordinates: [number, number]
  anchorVenue: Venue
  providerVenue: ProviderVenue
  sourceQueryLabel: string
}): RawPlace {
  const { anchorCoordinates, anchorVenue, providerVenue } = params
  const venueCoordinates: [number, number] = [
    providerVenue.location?.longitude ?? anchorCoordinates[0],
    providerVenue.location?.latitude ?? anchorCoordinates[1],
  ]
  const normalizedTypes = [providerVenue.primaryType, ...(providerVenue.types ?? [])]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(normalizeTag)
  const atmosphereTags = getProviderVenueAtmosphereTags(providerVenue)
  const neighborhood = inferNeighborhoodFromAddress(providerVenue, anchorVenue.neighborhood)
  return {
    rawType: 'place',
    id: providerVenue.providerRecordId,
    name: providerVenue.displayName,
    city: anchorVenue.city,
    neighborhood,
    driveMinutes: estimateDriveMinutes(anchorCoordinates, venueCoordinates),
    priceTier: '$$',
    tags: [...new Set([...normalizedTypes, ...atmosphereTags])].slice(0, 12),
    shortDescription:
      providerVenue.editorialSummary ??
      `${providerVenue.displayName} surfaced as a nearby live provider candidate around ${anchorVenue.name}.`,
    narrativeFlavor: `${providerVenue.displayName} is a governed nearby live candidate around ${anchorVenue.name}.`,
    isActive: providerVenue.businessStatus !== 'CLOSED_TEMPORARILY',
    sourceTypes: normalizedTypes,
    normalizedFromRawType: 'raw-place',
    sourceOrigin: 'live',
    provider: 'google-places',
    providerRecordId: providerVenue.providerRecordId,
    sourceQueryLabel: params.sourceQueryLabel,
    queryTerms: anchorVenue.name
      .split(/\s+/)
      .map((part) => part.trim().toLowerCase())
      .filter((part) => part.length > 0),
    familyFriendly: providerVenue.goodForChildren ? true : undefined,
    formattedAddress: providerVenue.formattedAddress,
    rating: providerVenue.rating,
    ratingCount: providerVenue.userRatingCount,
    openNow: providerVenue.currentOpeningHours?.openNow,
    businessStatus: providerVenue.businessStatus,
    hoursPeriods: providerVenue.currentOpeningHours?.periods,
    regularOpeningHoursText: providerVenue.regularOpeningHours?.weekdayDescriptions,
    currentOpeningHoursText: providerVenue.currentOpeningHours?.weekdayDescriptions,
    utcOffsetMinutes: providerVenue.utcOffsetMinutes,
    latitude: providerVenue.location?.latitude,
    longitude: providerVenue.location?.longitude,
    placeTypes: normalizedTypes,
  }
}

function normalizeAdmittedProviderVenue(params: {
  rawPlace: RawPlace
  identity: LiveVenueIdentityAdmissionResult
}): Venue {
  const { rawPlace, identity } = params
  if (!identity.venueId) {
    throw new Error('Expected admitted live venue identity to include venueId.')
  }
  return normalizeRawPlace({
    ...rawPlace,
    id: identity.venueId,
  })
}

function getRequiredTrace(diagnostics: ProviderAdapterDiagnostics): ProviderCallTrace {
  if (!diagnostics.trace) {
    throw new Error('Build provider source opportunity expected adapter trace diagnostics.')
  }
  return diagnostics.trace
}

function getRequiredLedger(diagnostics: ProviderAdapterDiagnostics): ProviderCallLedger {
  if (!diagnostics.ledger) {
    throw new Error('Build provider source opportunity expected adapter ledger diagnostics.')
  }
  return diagnostics.ledger
}

function emptyRoleCounts(): BuildProviderRoleCandidateCounts {
  return {
    start: 0,
    highlight: 0,
    windDown: 0,
  }
}

function buildBaseDiagnostics(params: {
  anchorCanonicalVenueId: string | null
  anchorProviderRecordId: string | null
  enabled: boolean
  blockedReason?: BuildProviderSupplyBlockedReason | null
  attemptedQueryLabels?: string[]
  perLabelResultCounts?: Array<{
    queryLabel: string
    resultCount: number
  }>
  mergedUniqueResultCount?: number
  trace?: ProviderCallTrace | null
  ledger?: ProviderCallLedger | null
}): BuildProviderSourceOpportunityDiagnostics {
  return {
    buildProviderSupplyEnabled: params.enabled,
    buildProviderAnchorCanonicalVenueId: params.anchorCanonicalVenueId,
    buildProviderAnchorProviderRecordId: params.anchorProviderRecordId,
    buildProviderAttemptedQueryLabels: params.attemptedQueryLabels ?? [],
    buildProviderPerLabelResultCounts: params.perLabelResultCounts ?? [],
    buildProviderMergedUniqueResultCount: params.mergedUniqueResultCount ?? 0,
    buildProviderNearbyVenueCount: 0,
    buildProviderSuppressedVenueCount: 0,
    buildProviderRoleCandidateCounts: emptyRoleCounts(),
    buildProviderSourceOpportunityEmitted: false,
    buildProviderSupplyBlockedReason: params.blockedReason ?? null,
    buildProviderStaticFallbackUsed: true,
    buildProviderTraceBillableCallCount: params.trace?.billableCallCount ?? 0,
    suppressionReasons: [],
    nearbyCandidateReviews: [],
    roleCandidateReviewSummaries: [],
    canonicalMappings: [],
    completeness: [],
    equivalence: [],
    trace: params.trace ?? null,
    ledger: params.ledger ?? null,
  }
}

function dedupeVenuesById(venues: Venue[]): Venue[] {
  const seen = new Set<string>()
  const deduped: Venue[] = []
  for (const venue of venues) {
    if (seen.has(venue.id)) {
      continue
    }
    seen.add(venue.id)
    deduped.push(venue)
  }
  return deduped
}

function deriveRoleCandidates(venues: Venue[]): {
  highlight: Venue[]
  start: Venue[]
  windDown: Venue[]
} {
  const start = venues.filter(
    (venue) =>
      venue.roleAffinity.warmup >= 0.6 &&
      venue.energyLevel <= 4 &&
      venue.source.qualityGateStatus === 'approved' &&
      !venue.source.hoursSuppressionApplied,
  )
  const highlight = venues.filter(
    (venue) =>
      venue.highlightCapable &&
      venue.roleAffinity.peak >= 0.7 &&
      venue.source.qualityGateStatus === 'approved' &&
      !venue.source.hoursSuppressionApplied,
  )
  const windDown = venues.filter(
    (venue) =>
      venue.roleAffinity.cooldown >= 0.58 &&
      venue.energyLevel <= 4 &&
      venue.source.qualityGateStatus === 'approved' &&
      !venue.source.hoursSuppressionApplied,
  )

  return {
    start: dedupeVenuesById(start),
    highlight: dedupeVenuesById(highlight),
    windDown: dedupeVenuesById(windDown),
  }
}

function buildRoleEligibilityDiagnostic(
  failedReasons: BuildProviderRoleFailureReason[],
): BuildProviderRoleEligibilityDiagnostic {
  return {
    eligible: failedReasons.length === 0,
    failedReasons,
  }
}

function evaluateStartRoleEligibility(
  venue: Venue,
): BuildProviderRoleEligibilityDiagnostic {
  const failedReasons: BuildProviderRoleFailureReason[] = []
  if (venue.roleAffinity.warmup < 0.6) {
    failedReasons.push('warmup_below_threshold')
  }
  if (venue.energyLevel > 4) {
    failedReasons.push('energy_above_threshold')
  }
  if (venue.source.qualityGateStatus !== 'approved') {
    failedReasons.push('quality_gate_not_approved')
  }
  if (venue.source.hoursSuppressionApplied) {
    failedReasons.push('hours_suppressed')
  }
  return buildRoleEligibilityDiagnostic(failedReasons)
}

function evaluateHighlightRoleEligibility(
  venue: Venue,
): BuildProviderRoleEligibilityDiagnostic {
  const failedReasons: BuildProviderRoleFailureReason[] = []
  if (!venue.highlightCapable) {
    failedReasons.push('not_highlight_capable')
  }
  if (venue.roleAffinity.peak < 0.7) {
    failedReasons.push('peak_below_threshold')
  }
  if (venue.source.qualityGateStatus !== 'approved') {
    failedReasons.push('quality_gate_not_approved')
  }
  if (venue.source.hoursSuppressionApplied) {
    failedReasons.push('hours_suppressed')
  }
  return buildRoleEligibilityDiagnostic(failedReasons)
}

function evaluateWindDownRoleEligibility(
  venue: Venue,
): BuildProviderRoleEligibilityDiagnostic {
  const failedReasons: BuildProviderRoleFailureReason[] = []
  if (venue.roleAffinity.cooldown < 0.58) {
    failedReasons.push('cooldown_below_threshold')
  }
  if (venue.energyLevel > 4) {
    failedReasons.push('energy_above_threshold')
  }
  if (venue.source.qualityGateStatus !== 'approved') {
    failedReasons.push('quality_gate_not_approved')
  }
  if (venue.source.hoursSuppressionApplied) {
    failedReasons.push('hours_suppressed')
  }
  return buildRoleEligibilityDiagnostic(failedReasons)
}

function buildRoleCandidateReviewSummaries(
  admittedCandidates: AdmittedNearbyCandidateReview[],
): BuildProviderRoleCandidateReviewSummary[] {
  return admittedCandidates.map(({ primaryType, venue }) => ({
    providerRecordId: venue.source.providerRecordId ?? venue.id,
    displayName: venue.name,
    normalizedCategory: venue.category,
    primaryType,
    tags: venue.tags,
    energyLevel: venue.energyLevel,
    highlightCapable: venue.highlightCapable,
    roleAffinity: {
      warmup: venue.roleAffinity.warmup,
      peak: venue.roleAffinity.peak,
      cooldown: venue.roleAffinity.cooldown,
    },
    qualityGateStatus: venue.source.qualityGateStatus,
    hoursSuppressionApplied: venue.source.hoursSuppressionApplied,
    start: evaluateStartRoleEligibility(venue),
    highlight: evaluateHighlightRoleEligibility(venue),
    windDown: evaluateWindDownRoleEligibility(venue),
  }))
}

function buildRoleCounts(roleCandidates: {
  highlight: Venue[]
  start: Venue[]
  windDown: Venue[]
}): BuildProviderRoleCandidateCounts {
  return {
    start: roleCandidates.start.length,
    highlight: roleCandidates.highlight.length,
    windDown: roleCandidates.windDown.length,
  }
}

export async function buildProviderSourceOpportunity(
  input: BuildProviderSourceOpportunityInput,
): Promise<BuildProviderSourceOpportunityResult> {
  const enabled = isBuildProviderSupplyEnabled()
  const liveEnvelope = input.liveEnvelope ?? CLOSED_RUNTIME_LIVE_ENVELOPE
  const anchorCanonicalVenueId = input.anchorVenue.id?.trim() || null
  const anchorProviderRecordId = anchorCanonicalVenueId
    ? resolveAnchorProviderRecordId(anchorCanonicalVenueId)
    : null

  if (!enabled) {
    return {
      diagnostics: buildBaseDiagnostics({
        anchorCanonicalVenueId,
        anchorProviderRecordId,
        blockedReason: 'build_provider_supply_disabled',
        enabled,
      }),
      opportunity: null,
    }
  }

  if (!anchorCanonicalVenueId) {
    return {
      diagnostics: buildBaseDiagnostics({
        anchorCanonicalVenueId,
        anchorProviderRecordId,
        blockedReason: 'anchor_canonical_identity_missing',
        enabled,
      }),
      opportunity: null,
    }
  }

  if (!anchorProviderRecordId) {
    return {
      diagnostics: buildBaseDiagnostics({
        anchorCanonicalVenueId,
        anchorProviderRecordId,
        blockedReason: 'anchor_provider_record_missing',
        enabled,
      }),
      opportunity: null,
    }
  }

  const anchorCoordinates = getAnchorCoordinates(input.anchorVenue)
  if (!anchorCoordinates) {
    return {
      diagnostics: buildBaseDiagnostics({
        anchorCanonicalVenueId,
        anchorProviderRecordId,
        blockedReason: 'anchor_coordinates_missing',
        enabled,
      }),
      opportunity: null,
    }
  }

  if (liveEnvelope.liveProviderAllowed !== true) {
    return {
      diagnostics: buildBaseDiagnostics({
        anchorCanonicalVenueId,
        anchorProviderRecordId,
        blockedReason: 'provider_request_blocked',
        enabled,
      }),
      opportunity: null,
    }
  }

  const builtProviderQueries = buildRoleDiverseNearbyQueries({
    anchorCoordinates,
    anchorVenue: input.anchorVenue,
    pageSize: Math.min(input.pageSize ?? DEFAULT_NEARBY_PAGE_SIZE, DEFAULT_NEARBY_PAGE_SIZE),
    radiusM: input.radiusM ?? DEFAULT_NEARBY_RADIUS_M,
  })
  const attemptedProviderQueries = applyBuildProviderQueryEnvelope(
    builtProviderQueries,
    liveEnvelope,
  )
  const attemptedQueryLabels = attemptedProviderQueries.map((query) => query.queryLabel)

  const providerSearch = await searchPlaces<BuildProviderMappedVenue, ProviderTextSearchQuery>({
    callPurpose: 'build_anchor_nearby',
    mapPlace: (providerVenue, context) => ({
      providerVenue,
      rawPlace: mapProviderVenueToRawPlace({
        anchorCoordinates,
        anchorVenue: input.anchorVenue,
        providerVenue,
        sourceQueryLabel: context.query.queryLabel,
      }),
      sourceQueryLabel: context.query.queryLabel,
    }),
    queries: attemptedProviderQueries,
    sourceMode: 'live',
    envelope: {
      maxProviderCalls: liveEnvelope.maxProviderCalls,
      maxQueryLabels: liveEnvelope.maxQueryLabels,
    },
  })

  const trace = getRequiredTrace(providerSearch.diagnostics)
  const ledger = getRequiredLedger(providerSearch.diagnostics)
  const baseDiagnostics = buildBaseDiagnostics({
    anchorCanonicalVenueId,
    anchorProviderRecordId,
    enabled,
    attemptedQueryLabels,
    trace,
    ledger,
  })

  if (providerSearch.diagnostics.blockedByEnv) {
    return {
      diagnostics: {
        ...baseDiagnostics,
        buildProviderSupplyBlockedReason: 'provider_request_blocked',
      },
      opportunity: null,
    }
  }

  if (providerSearch.results.length === 0) {
    return {
      diagnostics: {
        ...baseDiagnostics,
        buildProviderPerLabelResultCounts: providerSearch.queryCounts,
        buildProviderSupplyBlockedReason:
          providerSearch.errors.length > 0 ? 'provider_request_failed' : 'provider_zero_results',
      },
      opportunity: null,
    }
  }

  const requestedAt = Date.now()
  const mergedProviderResults = dedupeProviderSearchResults(providerSearch.results)
  const suppressionReasons: string[] = []
  const nearbyCandidateReviews: BuildProviderNearbyCandidateReviewSummary[] = []
  const admittedNearbyCandidates: Venue[] = []
  const admittedNearbyCandidateReviews: AdmittedNearbyCandidateReview[] = []
  const canonicalMappings: ProviderCanonicalVenueMapping[] = []
  const completeness: ProviderCompletenessGateResult[] = []
  const equivalence: SupplyEquivalenceResult[] = []

  for (const candidate of mergedProviderResults) {
    const canonicalMapping = resolveCanonicalVenueIdForProviderVenue({
      matchedAt: requestedAt,
      providerVenue: candidate.providerVenue,
      staticVenues: curatedVenues,
    })
    canonicalMappings.push(canonicalMapping)

    const completenessResult = evaluateProviderVenueCompleteness({
      providerVenue: candidate.providerVenue,
      canonicalMapping,
      options: {
        treatUnresolvedCanonicalIdentityAsDiagnosticOnly: true,
      },
    })
    completeness.push(completenessResult)

    const identityAdmission = admitLiveVenueIdentity({
      providerVenue: candidate.providerVenue,
      canonicalMapping,
      completeness: completenessResult,
      equivalence: null,
      mode: 'product',
      requestedAt,
    })
    const equivalenceResult = evaluateSupplyEquivalence(
      {
        kind: 'live',
        gateResult: completenessResult,
        canonicalMapping,
        canonicalIdentityStatus: identityAdmission.canonicalIdentityStatus,
      },
      {
        allowLiveWarningsForEquivalence: false,
      },
    )
    equivalence.push(equivalenceResult)

    const candidateSuppressionReasons: string[] = []
    if (!canonicalMapping.canonicalVenueId) {
      candidateSuppressionReasons.push('unresolved_canonical_identity_pre_admission')
    }
    if (identityAdmission.admitted) {
      candidateSuppressionReasons.push('live_identity_admitted')
    }
    if (equivalenceResult.status === 'equivalent') {
      candidateSuppressionReasons.push('final_equivalence_passed')
    } else {
      candidateSuppressionReasons.push('final_equivalence_failed')
    }

    const finalAdmissionPassed =
      identityAdmission.admitted && equivalenceResult.status === 'equivalent'
    const admittedVenue = finalAdmissionPassed
      ? normalizeAdmittedProviderVenue({
          rawPlace: candidate.rawPlace,
          identity: identityAdmission,
        })
      : null
    const normalizedCategory = admittedVenue
      ? admittedVenue.category
      : normalizeRawPlace(candidate.rawPlace).category
    const normalizedNeighborhood = admittedVenue?.neighborhood ?? candidate.rawPlace.neighborhood

    if (candidate.providerVenue.providerRecordId === anchorProviderRecordId) {
      candidateSuppressionReasons.push('anchor_self_match')
      suppressionReasons.push(
        `${candidate.providerVenue.providerRecordId}:anchor_self_match`,
      )
    } else if (!finalAdmissionPassed || !admittedVenue) {
      const identityReason =
        equivalenceResult.blockingReasons[0] ??
        identityAdmission.blockingReasons[0] ??
        identityAdmission.warnings[0] ??
        equivalenceResult.status ??
        identityAdmission.canonicalIdentityStatus
      candidateSuppressionReasons.push(
        ...(
          equivalenceResult.blockingReasons.length > 0
            ? equivalenceResult.blockingReasons
            : identityAdmission.blockingReasons.length > 0
              ? identityAdmission.blockingReasons
            : [identityReason]
        ),
      )
      suppressionReasons.push(`${candidate.providerVenue.providerRecordId}:${identityReason}`)
    } else {
      admittedNearbyCandidates.push(admittedVenue)
      admittedNearbyCandidateReviews.push({
        primaryType: candidate.providerVenue.primaryType?.trim() || undefined,
        venue: admittedVenue,
      })
    }

    nearbyCandidateReviews.push({
      providerRecordId: candidate.providerVenue.providerRecordId,
      displayName: candidate.providerVenue.displayName,
      primaryType: candidate.providerVenue.primaryType?.trim() || null,
      normalizedCategory: normalizedCategory ?? null,
      formattedAddress:
        candidate.providerVenue.formattedAddress?.trim() ||
        admittedVenue?.source.formattedAddress?.trim() ||
        null,
      neighborhood: normalizedNeighborhood?.trim() || null,
      canonicalVenueId: canonicalMapping.canonicalVenueId,
      canonicalMatchMethod: canonicalMapping.matchMethod,
      canonicalConfidence: canonicalMapping.confidence,
      completenessStatus: completenessResult.status,
      completenessFailureReason: completenessResult.failureReason,
      equivalenceStatus: equivalenceResult.status,
      equivalenceBlockingReasons: equivalenceResult.blockingReasons,
      suppressionReasons: candidateSuppressionReasons,
    })
  }

  const roleCandidates = deriveRoleCandidates(admittedNearbyCandidates)
  const roleCandidateCounts = buildRoleCounts(roleCandidates)
  const roleCandidateReviewSummaries = buildRoleCandidateReviewSummaries(
    admittedNearbyCandidateReviews,
  )
  const diagnostics: BuildProviderSourceOpportunityDiagnostics = {
    ...baseDiagnostics,
    buildProviderPerLabelResultCounts: providerSearch.queryCounts,
    buildProviderMergedUniqueResultCount: mergedProviderResults.length,
    buildProviderNearbyVenueCount: admittedNearbyCandidates.length,
    buildProviderSuppressedVenueCount: mergedProviderResults.length - admittedNearbyCandidates.length,
    buildProviderRoleCandidateCounts: roleCandidateCounts,
    buildProviderTraceBillableCallCount: trace.billableCallCount,
    suppressionReasons,
    nearbyCandidateReviews,
    roleCandidateReviewSummaries,
    canonicalMappings,
    completeness,
    equivalence,
  }

  if (admittedNearbyCandidates.length === 0) {
    return {
      diagnostics: {
        ...diagnostics,
        buildProviderSupplyBlockedReason: 'provider_no_admissible_candidates',
      },
      opportunity: null,
    }
  }

  if (
    roleCandidateCounts.start === 0 ||
    roleCandidateCounts.highlight === 0 ||
    roleCandidateCounts.windDown === 0
  ) {
    return {
      diagnostics: {
        ...diagnostics,
        buildProviderSupplyBlockedReason: 'provider_insufficient_role_diversity',
      },
      opportunity: null,
    }
  }

  return {
    diagnostics: {
      ...diagnostics,
      buildProviderSourceOpportunityEmitted: true,
      buildProviderSupplyBlockedReason: null,
      buildProviderStaticFallbackUsed: false,
    },
    opportunity: {
      id: `build_provider_live_${anchorCanonicalVenueId}_${requestedAt}`,
      sourceMode: 'live',
      anchor: {
        canonicalVenueId: anchorCanonicalVenueId,
        providerRecordId: anchorProviderRecordId,
        venue: input.anchorVenue,
      },
      nearbyCandidates: admittedNearbyCandidates,
      roleCandidates,
      diagnostics: {
        canonicalMappings,
        completeness,
        equivalence,
        trace,
        ledger,
        suppressionReasons,
        roleCandidateCounts,
      },
    },
  }
}

export const buildProviderSourceOpportunityConfig = {
  envFlag: BUILD_PROVIDER_SUPPLY_ENV_FLAG,
  fieldMask: DEFAULT_FIELD_MASK,
  maxProviderRequestsPerAttempt: 3,
  pageSize: DEFAULT_NEARBY_PAGE_SIZE,
  purpose: 'build_anchor_nearby' as const,
  radiusM: DEFAULT_NEARBY_RADIUS_M,
  queryLabels: BUILD_PROVIDER_QUERY_LABELS,
}
