import { curatedVenues } from '../../data/venues'
import { normalizeRawPlace } from '../normalize/normalizeRawPlace'
import { mapLivePlaceToRawPlace } from '../sources/mapLivePlaceToRawPlace'
import { getGooglePlacesConfig } from '../sources/getSourceMode'
import type { Venue } from '../types/venue'
import type {
  BuildProviderNearbyCandidateReviewSummary,
  BuildProviderSourceOpportunityDiagnostics,
  BuildProviderSourceOpportunityResult,
} from './buildProviderSourceOpportunity'
import {
  buildProviderSourceOpportunity,
  buildProviderSourceOpportunityConfig,
} from './buildProviderSourceOpportunity'
import {
  searchPlaces,
  type ProviderTextSearchQuery,
} from './ProviderAdapter'
import {
  resolveCanonicalVenueIdForProviderVenue,
  type ProviderCanonicalVenueMapping,
} from './providerCanonicalVenueMapping'
import {
  evaluateProviderVenueCompleteness,
  type ProviderCompletenessGateResult,
} from './providerCompletenessGate'
import {
  summarizeProviderCallLedger,
  type ProviderCallLedger,
  type ProviderCallTrace,
} from './providerCallTrace'
import {
  evaluateSupplyEquivalence,
  type SupplyEquivalenceResult,
} from './supplyEquivalence'
import type { ProviderVenue } from './providerTypes'

const DRY_RUN_ENV_FLAG = 'ID8_BUILD_PROVIDER_SUPPLY_DRY_RUN'
const TARGET_CANONICAL_VENUE_ID = 'sj-paper-plane'
const TARGET_PROVIDER_RECORD_ID = 'ChIJ2XdOpLzMj4ARkdRQg4ZRVTY'
const TARGET_DISPLAY_NAME = 'Paper Plane'
const TARGET_CITY = 'San Jose'
const TARGET_NEIGHBORHOOD = 'Downtown'
const TARGET_QUERY = 'Paper Plane San Jose'
const MAX_PROVIDER_CALLS_PER_RUN = 2
const ANCHOR_SEARCH_QUERY_LABEL = 'build-provider-anchor-search'
const ANCHOR_SEARCH_FIELD_MASK = [
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
const ANCHOR_QUERY_TERMS = ['paper', 'plane', 'cocktail', 'bar']

interface AnchorSearchCandidate {
  providerVenue: ProviderVenue
  venue: Venue
}

export type BuildProviderSupplyDryRunBlockedReason =
  | 'dry_run_disabled'
  | 'anchor_not_found'
  | 'provider_config_missing'
  | 'anchor_search_blocked'
  | 'anchor_search_failed'
  | 'anchor_search_zero_results'
  | 'anchor_search_wrong_venue'
  | 'anchor_completeness_failed'
  | 'anchor_equivalence_failed'
  | 'provider_call_budget_exceeded'
  | BuildProviderSourceOpportunityDiagnostics['buildProviderSupplyBlockedReason']

export interface BuildProviderSupplyDryRunCanonicalMappingSummary {
  providerRecordId: string
  canonicalVenueId: string | null
  matchMethod: ProviderCanonicalVenueMapping['matchMethod']
  confidence: number
}

export interface BuildProviderSupplyDryRunCompletenessSummary {
  providerRecordId: string | null
  canonicalVenueId: string | null
  status: ProviderCompletenessGateResult['status']
  confidence: number
  failureReason?: string
  suppressionReasons: ProviderCompletenessGateResult['suppressionReasons']
  warnings: string[]
}

export interface BuildProviderSupplyDryRunEquivalenceSummary {
  providerRecordId: string | null
  canonicalVenueId: string | null
  status: SupplyEquivalenceResult['status']
  equivalent: boolean
  warnings: SupplyEquivalenceResult['warnings']
  blockingReasons: SupplyEquivalenceResult['blockingReasons']
  requiresFallback?: boolean
  fallbackReason?: SupplyEquivalenceResult['fallbackReason']
}

export interface BuildProviderSupplyDryRunReport {
  runId: string
  anchor: {
    canonicalVenueId: string
    providerRecordId: string
    displayName: string
  }
  emitted: boolean
  blockedReason?: BuildProviderSupplyDryRunBlockedReason
  nearbyVenueCount: number
  suppressedVenueCount: number
  roleCandidateCounts: {
    start: number
    highlight: number
    windDown: number
  }
  opportunityId?: string
  anchorSearchTrace: ProviderCallTrace | null
  buildNearbyTrace: ProviderCallTrace | null
  anchorSearchLedger: ProviderCallLedger | null
  buildNearbyLedger: ProviderCallLedger | null
  providerLedger: ProviderCallLedger | null
  anchorCanonicalMappingSummary: BuildProviderSupplyDryRunCanonicalMappingSummary | null
  anchorCompletenessSummary: BuildProviderSupplyDryRunCompletenessSummary | null
  anchorEquivalenceSummary: BuildProviderSupplyDryRunEquivalenceSummary | null
  suppressionReasons: string[]
  nearbySuppressionReasons: string[]
  nearbyCandidateReviewSummaries: BuildProviderNearbyCandidateReviewSummary[]
  nearbyCanonicalMappingSummaries: BuildProviderSupplyDryRunCanonicalMappingSummary[]
  nearbyCompletenessSummaries: BuildProviderSupplyDryRunCompletenessSummary[]
  nearbyEquivalenceSummaries: BuildProviderSupplyDryRunEquivalenceSummary[]
}

function buildRunId(requestedAt: number): string {
  return `build-provider-supply-dry-run-${requestedAt}`
}

function isDryRunEnabled(): boolean {
  return process.env[DRY_RUN_ENV_FLAG] === '1'
}

function buildBaseReport(requestedAt: number): BuildProviderSupplyDryRunReport {
  return {
    runId: buildRunId(requestedAt),
    anchor: {
      canonicalVenueId: TARGET_CANONICAL_VENUE_ID,
      providerRecordId: TARGET_PROVIDER_RECORD_ID,
      displayName: TARGET_DISPLAY_NAME,
    },
    emitted: false,
    nearbyVenueCount: 0,
    suppressedVenueCount: 0,
    roleCandidateCounts: {
      start: 0,
      highlight: 0,
      windDown: 0,
    },
    anchorSearchTrace: null,
    buildNearbyTrace: null,
    anchorSearchLedger: null,
    buildNearbyLedger: null,
    providerLedger: null,
    anchorCanonicalMappingSummary: null,
    anchorCompletenessSummary: null,
    anchorEquivalenceSummary: null,
    suppressionReasons: [],
    nearbySuppressionReasons: [],
    nearbyCandidateReviewSummaries: [],
    nearbyCanonicalMappingSummaries: [],
    nearbyCompletenessSummaries: [],
    nearbyEquivalenceSummaries: [],
  }
}

function summarizeCanonicalMapping(
  canonicalMapping: ProviderCanonicalVenueMapping,
): BuildProviderSupplyDryRunCanonicalMappingSummary {
  return {
    providerRecordId: canonicalMapping.providerRecordId,
    canonicalVenueId: canonicalMapping.canonicalVenueId,
    matchMethod: canonicalMapping.matchMethod,
    confidence: canonicalMapping.confidence,
  }
}

function summarizeCanonicalMappings(
  canonicalMappings: ProviderCanonicalVenueMapping[],
): BuildProviderSupplyDryRunCanonicalMappingSummary[] {
  return canonicalMappings.map(summarizeCanonicalMapping)
}

function summarizeCompleteness(
  completeness: ProviderCompletenessGateResult,
): BuildProviderSupplyDryRunCompletenessSummary {
  return {
    providerRecordId: completeness.providerRecordId ?? null,
    canonicalVenueId: completeness.canonicalVenueId ?? null,
    status: completeness.status,
    confidence: completeness.confidence,
    failureReason: completeness.failureReason,
    suppressionReasons: completeness.suppressionReasons,
    warnings: completeness.warnings,
  }
}

function summarizeCompletenessList(
  completeness: ProviderCompletenessGateResult[],
): BuildProviderSupplyDryRunCompletenessSummary[] {
  return completeness.map(summarizeCompleteness)
}

function summarizeEquivalence(
  equivalence: SupplyEquivalenceResult,
): BuildProviderSupplyDryRunEquivalenceSummary {
  return {
    providerRecordId: equivalence.providerRecordId ?? null,
    canonicalVenueId: equivalence.canonicalVenueId ?? null,
    status: equivalence.status,
    equivalent: equivalence.equivalent,
    warnings: equivalence.warnings,
    blockingReasons: equivalence.blockingReasons,
    requiresFallback: equivalence.requiresFallback,
    fallbackReason: equivalence.fallbackReason,
  }
}

function summarizeEquivalenceList(
  equivalence: SupplyEquivalenceResult[],
): BuildProviderSupplyDryRunEquivalenceSummary[] {
  return equivalence.map(summarizeEquivalence)
}

function resolveStaticAnchor(): Venue | null {
  return curatedVenues.find((venue) => venue.id === TARGET_CANONICAL_VENUE_ID) ?? null
}

function detectMissingProviderConfig(): boolean {
  return !getGooglePlacesConfig().apiKey
}

function buildAnchorSearchQuery(): ProviderTextSearchQuery {
  return {
    fieldMask: ANCHOR_SEARCH_FIELD_MASK,
    pageSize: 5,
    queryLabel: ANCHOR_SEARCH_QUERY_LABEL,
    rankPreference: 'RELEVANCE',
    textQuery: TARGET_QUERY,
  }
}

function mapProviderVenueToAnchorVenue(providerVenue: ProviderVenue): Venue | undefined {
  const rawPlace = mapLivePlaceToRawPlace(
    {
      id: providerVenue.providerRecordId,
      displayName: { text: providerVenue.displayName },
      primaryType: providerVenue.primaryType,
      types: providerVenue.types,
      liveMusic: providerVenue.liveMusic,
      servesBeer: providerVenue.servesBeer,
      servesWine: providerVenue.servesWine,
      goodForGroups: providerVenue.goodForGroups,
      goodForChildren: providerVenue.goodForChildren,
      allowsDogs: providerVenue.allowsDogs,
      servesVegetarianFood: providerVenue.servesVegetarianFood,
      formattedAddress: providerVenue.formattedAddress,
      shortFormattedAddress: providerVenue.shortFormattedAddress,
      editorialSummary: providerVenue.editorialSummary
        ? { text: providerVenue.editorialSummary }
        : undefined,
      businessStatus: providerVenue.businessStatus,
      currentOpeningHours: providerVenue.currentOpeningHours
        ? {
            openNow: providerVenue.currentOpeningHours.openNow,
            weekdayDescriptions: providerVenue.currentOpeningHours.weekdayDescriptions,
            periods: providerVenue.currentOpeningHours.periods,
          }
        : undefined,
      regularOpeningHours: providerVenue.regularOpeningHours
        ? {
            weekdayDescriptions: providerVenue.regularOpeningHours.weekdayDescriptions,
            periods: providerVenue.regularOpeningHours.periods,
          }
        : undefined,
      rating: providerVenue.rating,
      userRatingCount: providerVenue.userRatingCount,
      websiteUri: providerVenue.websiteUri,
      utcOffsetMinutes: providerVenue.utcOffsetMinutes,
      location: providerVenue.location,
    },
    {
      city: TARGET_CITY,
      neighborhood: TARGET_NEIGHBORHOOD,
      requestedKind: 'bar',
      queryLabel: ANCHOR_SEARCH_QUERY_LABEL,
      queryTerms: ANCHOR_QUERY_TERMS,
      rank: 0,
    },
  )

  if (!rawPlace) {
    return undefined
  }

  return normalizeRawPlace({
    ...rawPlace,
    driveMinutes: 10,
    shortDescription:
      providerVenue.editorialSummary ??
      `${providerVenue.displayName} was selected as the provider-resolved Build anchor.`,
    narrativeFlavor:
      `${providerVenue.displayName} is the provider-resolved anchor for the hidden Build supply dry run.`,
  })
}

function mergeProviderLedger(
  traces: Array<ProviderCallTrace | null>,
): ProviderCallLedger | null {
  const populatedTraces = traces.filter((trace): trace is ProviderCallTrace => trace !== null)
  return populatedTraces.length > 0 ? summarizeProviderCallLedger(populatedTraces) : null
}

function buildAnchorVenueForNearby(params: {
  staticAnchor: Venue
  resolvedAnchorVenue: Venue
}): Venue {
  const { resolvedAnchorVenue, staticAnchor } = params

  return {
    ...staticAnchor,
    source: {
      ...staticAnchor.source,
      provider: 'google-places',
      providerRecordId: TARGET_PROVIDER_RECORD_ID,
      formattedAddress:
        resolvedAnchorVenue.source.formattedAddress ?? staticAnchor.source.formattedAddress,
      latitude: resolvedAnchorVenue.source.latitude,
      longitude: resolvedAnchorVenue.source.longitude,
      sourceQueryLabel: ANCHOR_SEARCH_QUERY_LABEL,
    },
  }
}

function buildAnchorStageReport(params: {
  requestedAt: number
  blockedReason: BuildProviderSupplyDryRunBlockedReason
  anchorSearchTrace: ProviderCallTrace | null
  anchorSearchLedger: ProviderCallLedger | null
  canonicalMapping?: ProviderCanonicalVenueMapping | null
  completeness?: ProviderCompletenessGateResult | null
  equivalence?: SupplyEquivalenceResult | null
}): BuildProviderSupplyDryRunReport {
  return {
    ...buildBaseReport(params.requestedAt),
    blockedReason: params.blockedReason,
    anchorSearchTrace: params.anchorSearchTrace,
    anchorSearchLedger: params.anchorSearchLedger,
    providerLedger: params.anchorSearchTrace
      ? summarizeProviderCallLedger([params.anchorSearchTrace])
      : params.anchorSearchLedger,
    anchorCanonicalMappingSummary: params.canonicalMapping
      ? summarizeCanonicalMapping(params.canonicalMapping)
      : null,
    anchorCompletenessSummary: params.completeness
      ? summarizeCompleteness(params.completeness)
      : null,
    anchorEquivalenceSummary: params.equivalence
      ? summarizeEquivalence(params.equivalence)
      : null,
  }
}

function buildReportFromNearbyResult(params: {
  requestedAt: number
  anchorSearchTrace: ProviderCallTrace
  anchorSearchLedger: ProviderCallLedger
  anchorCanonicalMapping: ProviderCanonicalVenueMapping
  anchorCompleteness: ProviderCompletenessGateResult
  anchorEquivalence: SupplyEquivalenceResult
  nearbyResult: BuildProviderSourceOpportunityResult
}): BuildProviderSupplyDryRunReport {
  const nearbyDiagnostics = params.nearbyResult.diagnostics
  const providerLedger = mergeProviderLedger([
    params.anchorSearchTrace,
    nearbyDiagnostics.trace,
  ])

  return {
    runId: buildRunId(params.requestedAt),
    anchor: {
      canonicalVenueId:
        nearbyDiagnostics.buildProviderAnchorCanonicalVenueId ?? TARGET_CANONICAL_VENUE_ID,
      providerRecordId:
        nearbyDiagnostics.buildProviderAnchorProviderRecordId ?? TARGET_PROVIDER_RECORD_ID,
      displayName: TARGET_DISPLAY_NAME,
    },
    emitted: nearbyDiagnostics.buildProviderSourceOpportunityEmitted,
    blockedReason: nearbyDiagnostics.buildProviderSupplyBlockedReason ?? undefined,
    nearbyVenueCount: nearbyDiagnostics.buildProviderNearbyVenueCount,
    suppressedVenueCount: nearbyDiagnostics.buildProviderSuppressedVenueCount,
    roleCandidateCounts: nearbyDiagnostics.buildProviderRoleCandidateCounts,
    opportunityId: params.nearbyResult.opportunity?.id,
    anchorSearchTrace: params.anchorSearchTrace,
    buildNearbyTrace: nearbyDiagnostics.trace,
    anchorSearchLedger: params.anchorSearchLedger,
    buildNearbyLedger: nearbyDiagnostics.ledger,
    providerLedger,
    anchorCanonicalMappingSummary: summarizeCanonicalMapping(params.anchorCanonicalMapping),
    anchorCompletenessSummary: summarizeCompleteness(params.anchorCompleteness),
    anchorEquivalenceSummary: summarizeEquivalence(params.anchorEquivalence),
    suppressionReasons: nearbyDiagnostics.suppressionReasons,
    nearbySuppressionReasons: nearbyDiagnostics.suppressionReasons,
    nearbyCandidateReviewSummaries: nearbyDiagnostics.nearbyCandidateReviews,
    nearbyCanonicalMappingSummaries: summarizeCanonicalMappings(
      nearbyDiagnostics.canonicalMappings,
    ),
    nearbyCompletenessSummaries: summarizeCompletenessList(
      nearbyDiagnostics.completeness,
    ),
    nearbyEquivalenceSummaries: summarizeEquivalenceList(
      nearbyDiagnostics.equivalence,
    ),
  }
}

function enforceCallBudget(report: BuildProviderSupplyDryRunReport): BuildProviderSupplyDryRunReport {
  if ((report.providerLedger?.totalBillable ?? 0) <= MAX_PROVIDER_CALLS_PER_RUN) {
    return report
  }

  return {
    ...report,
    emitted: false,
    blockedReason: 'provider_call_budget_exceeded',
    opportunityId: undefined,
  }
}

export async function runBuildProviderSupplyDryRunHarness(): Promise<BuildProviderSupplyDryRunReport> {
  const requestedAt = Date.now()
  const baseReport = buildBaseReport(requestedAt)

  if (!isDryRunEnabled()) {
    return {
      ...baseReport,
      blockedReason: 'dry_run_disabled',
    }
  }

  const staticAnchor = resolveStaticAnchor()
  if (!staticAnchor) {
    return {
      ...baseReport,
      blockedReason: 'anchor_not_found',
    }
  }

  const anchorSearch = await searchPlaces<AnchorSearchCandidate, ProviderTextSearchQuery>({
    callPurpose: 'anchor_search',
    mapPlace: (providerVenue) => {
      const venue = mapProviderVenueToAnchorVenue(providerVenue)
      if (!venue) {
        return undefined
      }

      return {
        providerVenue,
        venue,
      }
    },
    queries: [buildAnchorSearchQuery()],
    sourceMode: 'live',
  })

  const anchorSearchTrace = anchorSearch.diagnostics.trace ?? null
  const anchorSearchLedger = anchorSearch.diagnostics.ledger ?? null

  if (anchorSearch.diagnostics.blockedByEnv) {
    return buildAnchorStageReport({
      requestedAt,
      blockedReason: detectMissingProviderConfig()
        ? 'provider_config_missing'
        : 'anchor_search_blocked',
      anchorSearchTrace,
      anchorSearchLedger,
    })
  }

  if (anchorSearch.results.length === 0) {
    return buildAnchorStageReport({
      requestedAt,
      blockedReason:
        anchorSearch.errors.length > 0 ? 'anchor_search_failed' : 'anchor_search_zero_results',
      anchorSearchTrace,
      anchorSearchLedger,
    })
  }

  const matchingAnchorCandidate =
    anchorSearch.results.find(
      (candidate) => candidate.providerVenue.providerRecordId === TARGET_PROVIDER_RECORD_ID,
    ) ?? null

  if (!matchingAnchorCandidate) {
    return buildAnchorStageReport({
      requestedAt,
      blockedReason: 'anchor_search_wrong_venue',
      anchorSearchTrace,
      anchorSearchLedger,
    })
  }

  const anchorCanonicalMapping = resolveCanonicalVenueIdForProviderVenue({
    matchedAt: requestedAt,
    providerVenue: matchingAnchorCandidate.providerVenue,
    staticVenues: curatedVenues,
  })
  const anchorCompleteness = evaluateProviderVenueCompleteness({
    providerVenue: matchingAnchorCandidate.providerVenue,
    canonicalMapping: anchorCanonicalMapping,
    options: {
      requireCanonicalIdentity: true,
    },
  })
  const anchorEquivalence = evaluateSupplyEquivalence(
    {
      kind: 'live',
      gateResult: anchorCompleteness,
      canonicalMapping: anchorCanonicalMapping,
    },
    {
      allowLiveWarningsForEquivalence: false,
    },
  )

  if (
    anchorCanonicalMapping.canonicalVenueId !== TARGET_CANONICAL_VENUE_ID ||
    matchingAnchorCandidate.providerVenue.providerRecordId !== TARGET_PROVIDER_RECORD_ID
  ) {
    return buildAnchorStageReport({
      requestedAt,
      blockedReason: 'anchor_search_wrong_venue',
      anchorSearchTrace,
      anchorSearchLedger,
      canonicalMapping: anchorCanonicalMapping,
      completeness: anchorCompleteness,
      equivalence: anchorEquivalence,
    })
  }

  if (
    typeof matchingAnchorCandidate.venue.source.latitude !== 'number' ||
    typeof matchingAnchorCandidate.venue.source.longitude !== 'number'
  ) {
    return buildAnchorStageReport({
      requestedAt,
      blockedReason: 'anchor_coordinates_missing',
      anchorSearchTrace,
      anchorSearchLedger,
      canonicalMapping: anchorCanonicalMapping,
      completeness: anchorCompleteness,
      equivalence: anchorEquivalence,
    })
  }

  if (anchorCompleteness.status !== 'passed') {
    return buildAnchorStageReport({
      requestedAt,
      blockedReason: 'anchor_completeness_failed',
      anchorSearchTrace,
      anchorSearchLedger,
      canonicalMapping: anchorCanonicalMapping,
      completeness: anchorCompleteness,
      equivalence: anchorEquivalence,
    })
  }

  if (anchorEquivalence.status !== 'equivalent') {
    return buildAnchorStageReport({
      requestedAt,
      blockedReason: 'anchor_equivalence_failed',
      anchorSearchTrace,
      anchorSearchLedger,
      canonicalMapping: anchorCanonicalMapping,
      completeness: anchorCompleteness,
      equivalence: anchorEquivalence,
    })
  }

  const resolvedAnchorVenue = buildAnchorVenueForNearby({
    staticAnchor,
    resolvedAnchorVenue: matchingAnchorCandidate.venue,
  })
  const previousBuildProviderSupplyEnv =
    process.env[buildProviderSourceOpportunityConfig.envFlag]
  process.env[buildProviderSourceOpportunityConfig.envFlag] = '1'

  try {
    const nearbyResult = await buildProviderSourceOpportunity({
      anchorVenue: resolvedAnchorVenue,
      pageSize: buildProviderSourceOpportunityConfig.pageSize,
      radiusM: buildProviderSourceOpportunityConfig.radiusM,
    })

    return enforceCallBudget(
      buildReportFromNearbyResult({
        requestedAt,
        anchorSearchTrace: anchorSearchTrace!,
        anchorSearchLedger: anchorSearchLedger!,
        anchorCanonicalMapping,
        anchorCompleteness,
        anchorEquivalence,
        nearbyResult,
      }),
    )
  } finally {
    if (previousBuildProviderSupplyEnv === undefined) {
      delete process.env[buildProviderSourceOpportunityConfig.envFlag]
    } else {
      process.env[buildProviderSourceOpportunityConfig.envFlag] =
        previousBuildProviderSupplyEnv
    }
  }
}

export const buildProviderSupplyDryRunHarnessConfig = {
  anchorQuery: TARGET_QUERY,
  city: TARGET_CITY,
  dryRunEnvFlag: DRY_RUN_ENV_FLAG,
  fieldMask: ANCHOR_SEARCH_FIELD_MASK,
  maxProviderRequestsPerRun: MAX_PROVIDER_CALLS_PER_RUN,
  neighborhood: TARGET_NEIGHBORHOOD,
  pageSize: buildProviderSourceOpportunityConfig.pageSize,
  purposes: {
    anchorSearch: 'anchor_search' as const,
    buildNearby: buildProviderSourceOpportunityConfig.purpose,
  },
  radiusM: buildProviderSourceOpportunityConfig.radiusM,
  target: {
    canonicalVenueId: TARGET_CANONICAL_VENUE_ID,
    providerRecordId: TARGET_PROVIDER_RECORD_ID,
    displayName: TARGET_DISPLAY_NAME,
  },
}
