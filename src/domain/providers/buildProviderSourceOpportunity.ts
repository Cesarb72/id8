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

const BUILD_PROVIDER_SUPPLY_ENV_FLAG = 'VITE_ID8_BUILD_PROVIDER_SUPPLY'
const DEFAULT_NEARBY_RADIUS_M = 900
const DEFAULT_NEARBY_PAGE_SIZE = 5
const DEFAULT_QUERY_LABEL = 'build-provider-nearby'
const DEFAULT_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.primaryType',
  'places.types',
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

export interface BuildProviderSourceOpportunityDiagnostics {
  buildProviderSupplyEnabled: boolean
  buildProviderAnchorCanonicalVenueId: string | null
  buildProviderAnchorProviderRecordId: string | null
  buildProviderNearbyVenueCount: number
  buildProviderSuppressedVenueCount: number
  buildProviderRoleCandidateCounts: BuildProviderRoleCandidateCounts
  buildProviderSourceOpportunityEmitted: boolean
  buildProviderSupplyBlockedReason: BuildProviderSupplyBlockedReason | null
  buildProviderTraceBillableCallCount: number
  suppressionReasons: string[]
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
  pageSize?: number
  radiusM?: number
}

interface BuildProviderMappedVenue {
  providerVenue: ProviderVenue
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

function isBuildProviderSupplyEnabled(): boolean {
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

function buildNearbyTextQuery(anchorVenue: Venue): string {
  return `bars restaurants cafes dessert near ${anchorVenue.name}, ${anchorVenue.city}`
}

function buildNearbyQuery(params: {
  anchorCoordinates: [number, number]
  anchorVenue: Venue
  pageSize: number
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
    queryLabel: DEFAULT_QUERY_LABEL,
    rankPreference: 'DISTANCE',
    textQuery: buildNearbyTextQuery(params.anchorVenue),
  }
}

function mapProviderVenueToVenue(params: {
  anchorCoordinates: [number, number]
  anchorVenue: Venue
  providerVenue: ProviderVenue
}): Venue {
  const { anchorCoordinates, anchorVenue, providerVenue } = params
  const venueCoordinates: [number, number] = [
    providerVenue.location?.longitude ?? anchorCoordinates[0],
    providerVenue.location?.latitude ?? anchorCoordinates[1],
  ]
  const normalizedTypes = [providerVenue.primaryType, ...(providerVenue.types ?? [])]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(normalizeTag)
  const neighborhood = inferNeighborhoodFromAddress(providerVenue, anchorVenue.neighborhood)
  const rawPlace: RawPlace = {
    rawType: 'place',
    id: `live_google_${providerVenue.providerRecordId}`,
    name: providerVenue.displayName,
    city: anchorVenue.city,
    neighborhood,
    driveMinutes: estimateDriveMinutes(anchorCoordinates, venueCoordinates),
    priceTier: '$$',
    tags: normalizedTypes.slice(0, 6),
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
    sourceQueryLabel: DEFAULT_QUERY_LABEL,
    queryTerms: anchorVenue.name
      .split(/\s+/)
      .map((part) => part.trim().toLowerCase())
      .filter((part) => part.length > 0),
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

  return normalizeRawPlace(rawPlace)
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
  trace?: ProviderCallTrace | null
  ledger?: ProviderCallLedger | null
}): BuildProviderSourceOpportunityDiagnostics {
  return {
    buildProviderSupplyEnabled: params.enabled,
    buildProviderAnchorCanonicalVenueId: params.anchorCanonicalVenueId,
    buildProviderAnchorProviderRecordId: params.anchorProviderRecordId,
    buildProviderNearbyVenueCount: 0,
    buildProviderSuppressedVenueCount: 0,
    buildProviderRoleCandidateCounts: emptyRoleCounts(),
    buildProviderSourceOpportunityEmitted: false,
    buildProviderSupplyBlockedReason: params.blockedReason ?? null,
    buildProviderTraceBillableCallCount: params.trace?.billableCallCount ?? 0,
    suppressionReasons: [],
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

  const providerSearch = await searchPlaces<BuildProviderMappedVenue, ProviderTextSearchQuery>({
    callPurpose: 'waypoint_nearby',
    mapPlace: (providerVenue) => ({
      providerVenue,
      venue: mapProviderVenueToVenue({
        anchorCoordinates,
        anchorVenue: input.anchorVenue,
        providerVenue,
      }),
    }),
    queries: [
      buildNearbyQuery({
        anchorCoordinates,
        anchorVenue: input.anchorVenue,
        pageSize: Math.min(input.pageSize ?? DEFAULT_NEARBY_PAGE_SIZE, DEFAULT_NEARBY_PAGE_SIZE),
        radiusM: input.radiusM ?? DEFAULT_NEARBY_RADIUS_M,
      }),
    ],
    sourceMode: 'live',
  })

  const trace = getRequiredTrace(providerSearch.diagnostics)
  const ledger = getRequiredLedger(providerSearch.diagnostics)
  const baseDiagnostics = buildBaseDiagnostics({
    anchorCanonicalVenueId,
    anchorProviderRecordId,
    enabled,
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
        buildProviderSupplyBlockedReason:
          providerSearch.errors.length > 0 ? 'provider_request_failed' : 'provider_zero_results',
      },
      opportunity: null,
    }
  }

  const requestedAt = Date.now()
  const suppressionReasons: string[] = []
  const admittedNearbyCandidates: Venue[] = []
  const canonicalMappings: ProviderCanonicalVenueMapping[] = []
  const completeness: ProviderCompletenessGateResult[] = []
  const equivalence: SupplyEquivalenceResult[] = []

  for (const candidate of providerSearch.results) {
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
        requireCanonicalIdentity: true,
      },
    })
    completeness.push(completenessResult)

    const equivalenceResult = evaluateSupplyEquivalence(
      {
        kind: 'live',
        gateResult: completenessResult,
        canonicalMapping,
      },
      {
        allowLiveWarningsForEquivalence: false,
      },
    )
    equivalence.push(equivalenceResult)

    if (candidate.providerVenue.providerRecordId === anchorProviderRecordId) {
      suppressionReasons.push(
        `${candidate.providerVenue.providerRecordId}:anchor_self_match`,
      )
      continue
    }

    if (completenessResult.status !== 'passed') {
      suppressionReasons.push(
        `${candidate.providerVenue.providerRecordId}:${completenessResult.failureReason ?? completenessResult.status}`,
      )
      continue
    }

    if (equivalenceResult.status !== 'equivalent') {
      const equivalenceReason =
        equivalenceResult.blockingReasons[0] ??
        equivalenceResult.warnings[0] ??
        equivalenceResult.status
      suppressionReasons.push(
        `${candidate.providerVenue.providerRecordId}:${equivalenceReason}`,
      )
      continue
    }

    admittedNearbyCandidates.push(candidate.venue)
  }

  const roleCandidates = deriveRoleCandidates(admittedNearbyCandidates)
  const roleCandidateCounts = buildRoleCounts(roleCandidates)
  const diagnostics: BuildProviderSourceOpportunityDiagnostics = {
    ...baseDiagnostics,
    buildProviderNearbyVenueCount: admittedNearbyCandidates.length,
    buildProviderSuppressedVenueCount: providerSearch.results.length - admittedNearbyCandidates.length,
    buildProviderRoleCandidateCounts: roleCandidateCounts,
    buildProviderTraceBillableCallCount: trace.billableCallCount,
    suppressionReasons,
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
  maxProviderRequestsPerAttempt: 1,
  pageSize: DEFAULT_NEARBY_PAGE_SIZE,
  purpose: 'waypoint_nearby' as const,
  radiusM: DEFAULT_NEARBY_RADIUS_M,
  queryLabel: DEFAULT_QUERY_LABEL,
}
