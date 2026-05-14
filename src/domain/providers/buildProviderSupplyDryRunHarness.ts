import { curatedVenues } from '../../data/venues'
import { getGooglePlacesConfig } from '../sources/getSourceMode'
import type {
  BuildProviderSourceOpportunityDiagnostics,
  BuildProviderSourceOpportunityResult,
} from './buildProviderSourceOpportunity'
import {
  buildProviderSourceOpportunity,
  buildProviderSourceOpportunityConfig,
} from './buildProviderSourceOpportunity'
import type { ProviderCanonicalVenueMapping } from './providerCanonicalVenueMapping'
import type { ProviderCompletenessGateResult } from './providerCompletenessGate'
import type { SupplyEquivalenceResult } from './supplyEquivalence'

const DRY_RUN_ENV_FLAG = 'ID8_BUILD_PROVIDER_SUPPLY_DRY_RUN'
const TARGET_CANONICAL_VENUE_ID = 'sj-paper-plane'
const TARGET_PROVIDER_RECORD_ID = 'ChIJ2XdOpLzMj4ARkdRQg4ZRVTY'
const TARGET_DISPLAY_NAME = 'Paper Plane'

export type BuildProviderSupplyDryRunBlockedReason =
  | 'dry_run_disabled'
  | 'anchor_not_found'
  | 'provider_config_missing'
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
  providerTrace: BuildProviderSourceOpportunityDiagnostics['trace']
  providerLedger: BuildProviderSourceOpportunityDiagnostics['ledger']
  suppressionReasons: string[]
  canonicalMappingSummaries: BuildProviderSupplyDryRunCanonicalMappingSummary[]
  completenessSummaries: BuildProviderSupplyDryRunCompletenessSummary[]
  equivalenceSummaries: BuildProviderSupplyDryRunEquivalenceSummary[]
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
    providerTrace: null,
    providerLedger: null,
    suppressionReasons: [],
    canonicalMappingSummaries: [],
    completenessSummaries: [],
    equivalenceSummaries: [],
  }
}

function summarizeCanonicalMappings(
  canonicalMappings: ProviderCanonicalVenueMapping[],
): BuildProviderSupplyDryRunCanonicalMappingSummary[] {
  return canonicalMappings.map((mapping) => ({
    providerRecordId: mapping.providerRecordId,
    canonicalVenueId: mapping.canonicalVenueId,
    matchMethod: mapping.matchMethod,
    confidence: mapping.confidence,
  }))
}

function summarizeCompleteness(
  completeness: ProviderCompletenessGateResult[],
): BuildProviderSupplyDryRunCompletenessSummary[] {
  return completeness.map((result) => ({
    providerRecordId: result.providerRecordId ?? null,
    canonicalVenueId: result.canonicalVenueId ?? null,
    status: result.status,
    confidence: result.confidence,
    failureReason: result.failureReason,
    suppressionReasons: result.suppressionReasons,
    warnings: result.warnings,
  }))
}

function summarizeEquivalence(
  equivalence: SupplyEquivalenceResult[],
): BuildProviderSupplyDryRunEquivalenceSummary[] {
  return equivalence.map((result) => ({
    providerRecordId: result.providerRecordId ?? null,
    canonicalVenueId: result.canonicalVenueId ?? null,
    status: result.status,
    equivalent: result.equivalent,
    warnings: result.warnings,
    blockingReasons: result.blockingReasons,
    requiresFallback: result.requiresFallback,
    fallbackReason: result.fallbackReason,
  }))
}

function resolveTargetAnchor() {
  return curatedVenues.find((venue) => venue.id === TARGET_CANONICAL_VENUE_ID) ?? null
}

function detectMissingProviderConfig(): boolean {
  return !getGooglePlacesConfig().apiKey
}

function buildReportFromResult(
  result: BuildProviderSourceOpportunityResult,
  requestedAt: number,
): BuildProviderSupplyDryRunReport {
  const diagnostics = result.diagnostics

  return {
    runId: buildRunId(requestedAt),
    anchor: {
      canonicalVenueId:
        diagnostics.buildProviderAnchorCanonicalVenueId ?? TARGET_CANONICAL_VENUE_ID,
      providerRecordId:
        diagnostics.buildProviderAnchorProviderRecordId ?? TARGET_PROVIDER_RECORD_ID,
      displayName: TARGET_DISPLAY_NAME,
    },
    emitted: diagnostics.buildProviderSourceOpportunityEmitted,
    blockedReason: diagnostics.buildProviderSupplyBlockedReason ?? undefined,
    nearbyVenueCount: diagnostics.buildProviderNearbyVenueCount,
    suppressedVenueCount: diagnostics.buildProviderSuppressedVenueCount,
    roleCandidateCounts: diagnostics.buildProviderRoleCandidateCounts,
    opportunityId: result.opportunity?.id,
    providerTrace: diagnostics.trace,
    providerLedger: diagnostics.ledger,
    suppressionReasons: diagnostics.suppressionReasons,
    canonicalMappingSummaries: summarizeCanonicalMappings(diagnostics.canonicalMappings),
    completenessSummaries: summarizeCompleteness(diagnostics.completeness),
    equivalenceSummaries: summarizeEquivalence(diagnostics.equivalence),
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

  const anchorVenue = resolveTargetAnchor()
  if (!anchorVenue) {
    return {
      ...baseReport,
      blockedReason: 'anchor_not_found',
    }
  }

  const previousBuildProviderSupplyEnv =
    process.env[buildProviderSourceOpportunityConfig.envFlag]
  process.env[buildProviderSourceOpportunityConfig.envFlag] = '1'

  try {
    const result = await buildProviderSourceOpportunity({
      anchorVenue,
      pageSize: buildProviderSourceOpportunityConfig.pageSize,
      radiusM: buildProviderSourceOpportunityConfig.radiusM,
    })
    const report = buildReportFromResult(result, requestedAt)

    if (detectMissingProviderConfig() && report.blockedReason === 'provider_request_blocked') {
      return {
        ...report,
        blockedReason: 'provider_config_missing',
      }
    }

    return report
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
  dryRunEnvFlag: DRY_RUN_ENV_FLAG,
  maxProviderRequestsPerRun: buildProviderSourceOpportunityConfig.maxProviderRequestsPerAttempt,
  pageSize: buildProviderSourceOpportunityConfig.pageSize,
  purpose: buildProviderSourceOpportunityConfig.purpose,
  radiusM: buildProviderSourceOpportunityConfig.radiusM,
  target: {
    canonicalVenueId: TARGET_CANONICAL_VENUE_ID,
    providerRecordId: TARGET_PROVIDER_RECORD_ID,
    displayName: TARGET_DISPLAY_NAME,
  },
}
