import type { ProviderCorpusArtifact } from './providerCorpusArtifact'
import {
  providerCorpusGate1StarterIds,
  providerCorpusManifest,
  providerCorpusRequiredBuildAnchorFamilies,
  providerCorpusScenarioFamilies,
  type ProviderCorpusBuildAnchorFamily,
  type ProviderCorpusCategoryFamily,
  type ProviderCorpusRole,
  type ProviderCorpusScenarioFamily,
} from './providerCorpusManifest'
import type { ProviderCallLedger } from './providerCallTrace'

export type ProviderCorpusReviewReadiness = 'ready' | 'needs_review' | 'blocked'
export type ProviderCorpusGoNoGoRecommendation = 'go_for_gate_1_review' | 'review_before_go' | 'no_go'

export type ProviderCorpusReviewRiskFlagCode =
  | 'missing_required_query'
  | 'low_venue_count'
  | 'insufficient_role_coverage'
  | 'missing_curate_starter_coverage'
  | 'missing_surprise_support'
  | 'missing_build_anchor_family_coverage'
  | 'missing_persona_vibe_scenario_coverage'
  | 'duplicate_provider_identity_issues'
  | 'billable_calls_above_expected'
  | 'runtime_import_not_allowed_violation'
  | 'stale_freshness_window'
  | 'dropped_venues_above_threshold'

export type ProviderCorpusReviewRiskSeverity = 'blocker' | 'major' | 'minor'

export interface ProviderCorpusReviewRiskFlag {
  code: ProviderCorpusReviewRiskFlagCode
  detail: string
  severity: ProviderCorpusReviewRiskSeverity
}

export interface ProviderCorpusReviewQueryLedgerEntry {
  billableCallCount: number
  expectedCategoryFamily: ProviderCorpusCategoryFamily
  gate1Required: boolean
  label: string
  maxCalls: number
  mockedResultCount: number
  providerResultCount: number
  queryText: string
}

export interface ProviderCorpusReviewDedupeSummary {
  dedupedVenueCount: number
  duplicateProviderRecordIds: string[]
  inputVenueCount: number
  unresolvedDuplicateProviderRecordIds: string[]
  uniqueProviderRecordCount: number
}

export interface ProviderCorpusReviewDropReasonSummary {
  normalizationDroppedTotal: number
  providerMappedDroppedTotal: number
  runtimeSafetyBlockedTotal: number
  totalDropped: number
}

export interface ProviderCorpusReviewCoverageSummary {
  buildAnchorFamilyCoverage: ProviderCorpusBuildAnchorFamily[]
  categoryFamilyCoverage: ProviderCorpusCategoryFamily[]
  curateStarterCoverage: string[]
  missingBuildAnchorFamilies: ProviderCorpusBuildAnchorFamily[]
  missingCurateStarters: string[]
  missingRoles: ProviderCorpusRole[]
  missingScenarioFamilies: ProviderCorpusScenarioFamily[]
  personaVibeScenarioCoverage: ProviderCorpusScenarioFamily[]
  roleCoverage: ProviderCorpusRole[]
  surpriseSupportCoverage: {
    categoryFamilies: ProviderCorpusCategoryFamily[]
    supported: boolean
  }
}

export interface ProviderCorpusReviewFreshnessSummary {
  generatedAt: string
  maxAgeDays: number
  reviewBy: string
  stale: boolean
}

export interface ProviderCorpusReviewReport {
  reportVersion: 'provider-corpus-review.v1'
  artifactVersion: ProviderCorpusArtifact['artifactVersion']
  city: ProviderCorpusArtifact['city']
  generatedAt: string
  source: ProviderCorpusArtifact['source']
  manifestQueryCount: number
  venueCount: number
  uniqueProviderRecordCount: number
  queryLedger: ProviderCorpusReviewQueryLedgerEntry[]
  providerLedgerSummary: ProviderCallLedger
  dedupeSummary: ProviderCorpusReviewDedupeSummary
  dropReasonSummary: ProviderCorpusReviewDropReasonSummary
  coverageSummary: ProviderCorpusReviewCoverageSummary
  categoryFamilyCoverage: ProviderCorpusCategoryFamily[]
  roleCoverage: ProviderCorpusRole[]
  curateStarterCoverage: string[]
  surpriseSupportCoverage: ProviderCorpusReviewCoverageSummary['surpriseSupportCoverage']
  buildAnchorFamilyCoverage: ProviderCorpusBuildAnchorFamily[]
  personaVibeScenarioCoverage: ProviderCorpusScenarioFamily[]
  freshnessSummary: ProviderCorpusReviewFreshnessSummary
  riskFlags: ProviderCorpusReviewRiskFlag[]
  gate1Readiness: ProviderCorpusReviewReadiness
  goNoGoRecommendation: ProviderCorpusGoNoGoRecommendation
  reviewerChecklist: string[]
}

export interface BuildProviderCorpusReviewReportOptions {
  now?: string
  runtimeImportHits?: string[]
}

const REQUIRED_ROLES: ProviderCorpusRole[] = ['start', 'highlight', 'windDown', 'support']
const MIN_GATE_1_VENUE_COUNT = 12
const DROP_REASON_THRESHOLD = 0

function uniqueSorted<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

function missingValues<T extends string>(actual: T[], expected: T[]): T[] {
  return expected.filter((value) => !actual.includes(value))
}

function sumCounts(record: Record<string, number>): number {
  return Object.values(record).reduce((sum, count) => sum + count, 0)
}

function buildRiskFlag(
  code: ProviderCorpusReviewRiskFlagCode,
  severity: ProviderCorpusReviewRiskSeverity,
  detail: string,
): ProviderCorpusReviewRiskFlag {
  return { code, detail, severity }
}

function buildDedupeSummary(artifact: ProviderCorpusArtifact): ProviderCorpusReviewDedupeSummary {
  const dedupedProviderRecordIds = new Set(
    artifact.dedupeReport.dedupedVenueIds.map((entry) => entry.providerRecordId),
  )
  const unresolvedDuplicateProviderRecordIds = artifact.dedupeReport.duplicateProviderRecordIds
    .filter((providerRecordId) => !dedupedProviderRecordIds.has(providerRecordId))
    .sort((left, right) => left.localeCompare(right))

  return {
    dedupedVenueCount: artifact.dedupeReport.dedupedVenueIds.length,
    duplicateProviderRecordIds: artifact.dedupeReport.duplicateProviderRecordIds,
    inputVenueCount: artifact.dedupeReport.inputVenueCount,
    unresolvedDuplicateProviderRecordIds,
    uniqueProviderRecordCount: artifact.dedupeReport.uniqueVenueCount,
  }
}

function buildDropReasonSummary(artifact: ProviderCorpusArtifact): ProviderCorpusReviewDropReasonSummary {
  const providerMappedDroppedTotal = sumCounts(artifact.dropReasons.providerMappedDropped)
  const normalizationDroppedTotal = sumCounts(artifact.dropReasons.normalizationDropped)
  const runtimeSafetyBlockedTotal = sumCounts(artifact.dropReasons.runtimeSafetyBlocked)
  return {
    normalizationDroppedTotal,
    providerMappedDroppedTotal,
    runtimeSafetyBlockedTotal,
    totalDropped: providerMappedDroppedTotal + normalizationDroppedTotal + runtimeSafetyBlockedTotal,
  }
}

function buildCoverageSummary(artifact: ProviderCorpusArtifact): ProviderCorpusReviewCoverageSummary {
  const roleCoverage = uniqueSorted(artifact.coverageReport.roles)
  const curateStarterCoverage = uniqueSorted(artifact.coverageReport.curateStarters)
  const buildAnchorFamilyCoverage = uniqueSorted(artifact.coverageReport.buildAnchorFamilies)
  const personaVibeScenarioCoverage = uniqueSorted(artifact.coverageReport.scenarioFamilies)
  return {
    buildAnchorFamilyCoverage,
    categoryFamilyCoverage: uniqueSorted(artifact.coverageReport.categoryFamilies),
    curateStarterCoverage,
    missingBuildAnchorFamilies: missingValues(
      buildAnchorFamilyCoverage,
      providerCorpusRequiredBuildAnchorFamilies,
    ),
    missingCurateStarters: missingValues(curateStarterCoverage, providerCorpusGate1StarterIds),
    missingRoles: missingValues(roleCoverage, REQUIRED_ROLES),
    missingScenarioFamilies: missingValues(
      personaVibeScenarioCoverage,
      providerCorpusScenarioFamilies,
    ),
    personaVibeScenarioCoverage,
    roleCoverage,
    surpriseSupportCoverage: {
      categoryFamilies: uniqueSorted(artifact.coverageReport.surpriseHighlightCategoryFamilies),
      supported: artifact.coverageReport.surpriseSupported,
    },
  }
}

function buildFreshnessSummary(
  artifact: ProviderCorpusArtifact,
  nowIso: string,
): ProviderCorpusReviewFreshnessSummary {
  return {
    generatedAt: artifact.freshnessPolicy.generatedAt,
    maxAgeDays: artifact.freshnessPolicy.maxAgeDays,
    reviewBy: artifact.freshnessPolicy.reviewBy,
    stale: Date.parse(nowIso) > Date.parse(artifact.freshnessPolicy.reviewBy),
  }
}

function buildQueryLedger(artifact: ProviderCorpusArtifact): ProviderCorpusReviewQueryLedgerEntry[] {
  return artifact.queries.map((query) => ({
    billableCallCount: query.billableCallCount,
    expectedCategoryFamily: query.expectedCategoryFamily,
    gate1Required: query.gate1Required,
    label: query.label,
    maxCalls: query.maxCalls,
    mockedResultCount: query.mockedResultCount,
    providerResultCount: query.providerResultCount,
    queryText: query.queryText,
  }))
}

function addCoverageRiskFlags(
  riskFlags: ProviderCorpusReviewRiskFlag[],
  coverageSummary: ProviderCorpusReviewCoverageSummary,
): void {
  if (coverageSummary.missingRoles.length > 0) {
    riskFlags.push(
      buildRiskFlag(
        'insufficient_role_coverage',
        'blocker',
        `Missing route roles: ${coverageSummary.missingRoles.join(', ')}.`,
      ),
    )
  }
  if (coverageSummary.missingCurateStarters.length > 0) {
    riskFlags.push(
      buildRiskFlag(
        'missing_curate_starter_coverage',
        'blocker',
        `Missing Curate starters: ${coverageSummary.missingCurateStarters.join(', ')}.`,
      ),
    )
  }
  if (!coverageSummary.surpriseSupportCoverage.supported) {
    riskFlags.push(
      buildRiskFlag(
        'missing_surprise_support',
        'major',
        'Coverage report does not mark Surprise as supported.',
      ),
    )
  }
  if (coverageSummary.missingBuildAnchorFamilies.length > 0) {
    riskFlags.push(
      buildRiskFlag(
        'missing_build_anchor_family_coverage',
        'blocker',
        `Missing Build anchor families: ${coverageSummary.missingBuildAnchorFamilies.join(', ')}.`,
      ),
    )
  }
  if (coverageSummary.missingScenarioFamilies.length > 0) {
    riskFlags.push(
      buildRiskFlag(
        'missing_persona_vibe_scenario_coverage',
        'blocker',
        `Missing persona/vibe scenarios: ${coverageSummary.missingScenarioFamilies.join(', ')}.`,
      ),
    )
  }
}

function resolveReadiness(riskFlags: ProviderCorpusReviewRiskFlag[]): ProviderCorpusReviewReadiness {
  if (riskFlags.some((flag) => flag.severity === 'blocker')) {
    return 'blocked'
  }
  if (riskFlags.length > 0) {
    return 'needs_review'
  }
  return 'ready'
}

function resolveRecommendation(
  readiness: ProviderCorpusReviewReadiness,
): ProviderCorpusGoNoGoRecommendation {
  if (readiness === 'ready') {
    return 'go_for_gate_1_review'
  }
  if (readiness === 'needs_review') {
    return 'review_before_go'
  }
  return 'no_go'
}

function buildReviewerChecklist(): string[] {
  return [
    'Confirm all 12 Gate 1 manifest queries are represented.',
    'Review duplicate provider identities and dedupe decisions.',
    'Review Curate starter, Surprise, Build anchor, role, and persona/vibe coverage.',
    'Confirm provider ledger totals match expected billable-call budget.',
    'Confirm runtimeImportAllowed remains false before runtime ingestion work.',
    'Confirm freshness window has not expired.',
    'Confirm dropped venues and runtime safety blockers are acceptable.',
  ]
}

export function buildProviderCorpusReviewReport(
  artifact: ProviderCorpusArtifact,
  options: BuildProviderCorpusReviewReportOptions = {},
): ProviderCorpusReviewReport {
  const nowIso = options.now ?? new Date().toISOString()
  const queryLedger = buildQueryLedger(artifact)
  const manifestLabels = providerCorpusManifest.entries.map((entry) => entry.label)
  const presentQueryLabels = artifact.queries.map((query) => query.label)
  const missingRequiredQueryLabels = missingValues(presentQueryLabels, manifestLabels)
  const dedupeSummary = buildDedupeSummary(artifact)
  const dropReasonSummary = buildDropReasonSummary(artifact)
  const coverageSummary = buildCoverageSummary(artifact)
  const freshnessSummary = buildFreshnessSummary(artifact, nowIso)
  const riskFlags: ProviderCorpusReviewRiskFlag[] = []

  if (missingRequiredQueryLabels.length > 0 || artifact.manifestQueryCount !== providerCorpusManifest.expectedQueryCount) {
    riskFlags.push(
      buildRiskFlag(
        'missing_required_query',
        'blocker',
        `Missing required manifest queries: ${missingRequiredQueryLabels.join(', ') || 'manifest count mismatch'}.`,
      ),
    )
  }
  if (artifact.venues.length < MIN_GATE_1_VENUE_COUNT) {
    riskFlags.push(
      buildRiskFlag(
        'low_venue_count',
        'major',
        `Venue count ${artifact.venues.length} is below Gate 1 minimum ${MIN_GATE_1_VENUE_COUNT}.`,
      ),
    )
  }

  addCoverageRiskFlags(riskFlags, coverageSummary)

  if (dedupeSummary.unresolvedDuplicateProviderRecordIds.length > 0) {
    riskFlags.push(
      buildRiskFlag(
        'duplicate_provider_identity_issues',
        'major',
        `Duplicate provider ids lack dedupe entries: ${dedupeSummary.unresolvedDuplicateProviderRecordIds.join(', ')}.`,
      ),
    )
  }

  const expectedBillableCalls = queryLedger.reduce((sum, query) => sum + query.maxCalls, 0)
  const billableCallsAboveExpected =
    artifact.source === 'mocked'
      ? artifact.providerLedgerSummary.totalBillable > 0
      : artifact.providerLedgerSummary.totalBillable > expectedBillableCalls
  if (billableCallsAboveExpected) {
    riskFlags.push(
      buildRiskFlag(
        'billable_calls_above_expected',
        'blocker',
        `Billable calls ${artifact.providerLedgerSummary.totalBillable} exceed expected ${artifact.source === 'mocked' ? 0 : expectedBillableCalls}.`,
      ),
    )
  }

  const runtimeImportHits = options.runtimeImportHits ?? []
  if (artifact.runtimeImportAllowed !== false || runtimeImportHits.length > 0) {
    riskFlags.push(
      buildRiskFlag(
        'runtime_import_not_allowed_violation',
        'blocker',
        `Runtime import violation detected: ${runtimeImportHits.join(', ') || 'runtimeImportAllowed not false'}.`,
      ),
    )
  }
  if (freshnessSummary.stale) {
    riskFlags.push(
      buildRiskFlag(
        'stale_freshness_window',
        'major',
        `Artifact review window expired at ${freshnessSummary.reviewBy}.`,
      ),
    )
  }
  if (dropReasonSummary.totalDropped > DROP_REASON_THRESHOLD) {
    riskFlags.push(
      buildRiskFlag(
        'dropped_venues_above_threshold',
        'major',
        `Dropped venue count ${dropReasonSummary.totalDropped} exceeds threshold ${DROP_REASON_THRESHOLD}.`,
      ),
    )
  }

  const gate1Readiness = resolveReadiness(riskFlags)

  return {
    artifactVersion: artifact.artifactVersion,
    buildAnchorFamilyCoverage: coverageSummary.buildAnchorFamilyCoverage,
    categoryFamilyCoverage: coverageSummary.categoryFamilyCoverage,
    city: artifact.city,
    coverageSummary,
    curateStarterCoverage: coverageSummary.curateStarterCoverage,
    dedupeSummary,
    dropReasonSummary,
    freshnessSummary,
    gate1Readiness,
    generatedAt: artifact.generatedAt,
    goNoGoRecommendation: resolveRecommendation(gate1Readiness),
    manifestQueryCount: artifact.manifestQueryCount,
    personaVibeScenarioCoverage: coverageSummary.personaVibeScenarioCoverage,
    providerLedgerSummary: artifact.providerLedgerSummary,
    queryLedger,
    reportVersion: 'provider-corpus-review.v1',
    reviewerChecklist: buildReviewerChecklist(),
    riskFlags,
    roleCoverage: coverageSummary.roleCoverage,
    source: artifact.source,
    surpriseSupportCoverage: coverageSummary.surpriseSupportCoverage,
    uniqueProviderRecordCount: dedupeSummary.uniqueProviderRecordCount,
    venueCount: artifact.venues.length,
  }
}
