import { curatedVenues } from '../../data/venues'
import type {
  ProviderCallLedger,
  ProviderCallTrace,
} from './providerCallTrace'
import {
  resolveCanonicalVenueIdForProviderVenue,
  type ProviderCanonicalVenueMapping,
} from './providerCanonicalVenueMapping'
import {
  evaluateProviderVenueCompleteness,
  type ProviderCompletenessGateResult,
} from './providerCompletenessGate'
import {
  evaluateSupplyEquivalence,
  type SupplyEquivalenceResult,
} from './supplyEquivalence'
import {
  searchPlaces,
  type ProviderAdapterDiagnostics,
  type ProviderTextSearchQuery,
} from './ProviderAdapter'
import type { ProviderVenue } from './providerTypes'

export interface ProviderDryRunResultEntry {
  providerRecordId: string
  displayName: string
  canonicalMapping: ProviderCanonicalVenueMapping
  completeness: ProviderCompletenessGateResult
  equivalence: SupplyEquivalenceResult
}

export interface ProviderDryRunReport {
  runId: string
  query: string
  requestedAt: number
  provider: 'google-places'
  purpose: 'anchor_search'
  blocked: boolean
  failureReason?: string
  rawResultCount: number
  providerVenueCount: number
  trace: ProviderCallTrace
  ledger: ProviderCallLedger
  results: ProviderDryRunResultEntry[]
}

export interface ProviderDryRunHarnessOptions {
  query?: string
}

const DEFAULT_CITY = 'San Jose'
const DEFAULT_QUERY = 'Paper Plane San Jose'
const DEFAULT_NEIGHBORHOOD = 'Downtown'
const DEFAULT_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.primaryType',
  'places.types',
  'places.formattedAddress',
  'places.shortFormattedAddress',
  'places.addressComponents',
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
const DEFAULT_QUERY_TERMS = ['paper', 'plane', 'cocktail', 'bar']
const DRY_RUN_ENV_FLAG = 'ID8_PROVIDER_DRY_RUN'

let dryRunExecuted = false

function buildRunId(requestedAt: number): string {
  return `provider-dry-run-${requestedAt}`
}

function assertDryRunEnabled(): void {
  if (process.env[DRY_RUN_ENV_FLAG] !== '1') {
    throw new Error(
      `Provider dry run refused. Set ${DRY_RUN_ENV_FLAG}=1 to allow one controlled provider request.`,
    )
  }
}

function assertSingleRun(): void {
  if (dryRunExecuted) {
    throw new Error('Provider dry run refused because one provider request has already been issued in this process.')
  }
  dryRunExecuted = true
}

function getRequiredTrace(diagnostics: ProviderAdapterDiagnostics): ProviderCallTrace {
  if (!diagnostics.trace) {
    throw new Error('Provider dry run expected adapter trace diagnostics to be present.')
  }
  return diagnostics.trace
}

function getRequiredLedger(diagnostics: ProviderAdapterDiagnostics): ProviderCallLedger {
  if (!diagnostics.ledger) {
    throw new Error('Provider dry run expected adapter ledger diagnostics to be present.')
  }
  return diagnostics.ledger
}

function buildQuery(query: string): ProviderTextSearchQuery {
  return {
    fieldMask: DEFAULT_FIELD_MASK,
    pageSize: 5,
    queryLabel: 'provider-dry-run-anchor-search',
    rankPreference: 'RELEVANCE',
    textQuery: query,
  }
}

export async function runProviderDryRunHarness(
  options?: ProviderDryRunHarnessOptions,
): Promise<ProviderDryRunReport> {
  assertDryRunEnabled()
  assertSingleRun()

  const query = options?.query?.trim() || DEFAULT_QUERY
  const requestedAt = Date.now()

  const providerSearch = await searchPlaces<ProviderVenue, ProviderTextSearchQuery>({
    callPurpose: 'anchor_search',
    mapPlace: (place) => place,
    queries: [buildQuery(query)],
    sourceMode: 'live',
  })

  const trace = getRequiredTrace(providerSearch.diagnostics)
  const ledger = getRequiredLedger(providerSearch.diagnostics)

  const results = providerSearch.results.map((providerVenue) => {
    const canonicalMapping = resolveCanonicalVenueIdForProviderVenue({
      matchedAt: requestedAt,
      providerVenue,
      staticVenues: curatedVenues,
    })
    const completeness = evaluateProviderVenueCompleteness({
      canonicalMapping,
      providerVenue,
    })
    const equivalence = evaluateSupplyEquivalence({
      canonicalMapping,
      gateResult: completeness,
      kind: 'live',
    })

    return {
      providerRecordId: providerVenue.providerRecordId,
      displayName: providerVenue.displayName,
      canonicalMapping,
      completeness,
      equivalence,
    }
  })

  return {
    runId: buildRunId(requestedAt),
    query,
    requestedAt,
    provider: 'google-places',
    purpose: 'anchor_search',
    blocked: providerSearch.diagnostics.blockedByEnv,
    failureReason: providerSearch.diagnostics.failureReason,
    rawResultCount: providerSearch.diagnostics.resultCount,
    providerVenueCount: providerSearch.results.length,
    trace,
    ledger,
    results,
  }
}

export const providerDryRunHarnessConfig = {
  city: DEFAULT_CITY,
  dryRunEnvFlag: DRY_RUN_ENV_FLAG,
  fieldMask: DEFAULT_FIELD_MASK,
  maxRequestsPerRun: 1,
  neighborhood: DEFAULT_NEIGHBORHOOD,
  pageSize: 5,
  purpose: 'anchor_search' as const,
  query: DEFAULT_QUERY,
  queryTerms: DEFAULT_QUERY_TERMS,
}
