import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  searchPlaces,
  type ProviderTextSearchQuery,
  type ProviderTextSearchResult,
} from '../src/domain/providers/ProviderAdapter.ts'
import {
  type ProviderCorpusArtifact,
  type ProviderCorpusArtifactVenue,
  validateProviderCorpusArtifact,
} from '../src/domain/providers/providerCorpusArtifact.ts'
import {
  providerCorpusManifest,
  type ProviderCorpusCategoryFamily,
  type ProviderCorpusManifest,
  type ProviderCorpusManifestEntry,
} from '../src/domain/providers/providerCorpusManifest.ts'
import {
  buildProviderCorpusReviewReport,
  type ProviderCorpusReviewReport,
} from '../src/domain/providers/providerCorpusReviewReport.ts'
import { createLiveGoogleVenueId } from '../src/domain/providers/admitLiveVenueIdentity.ts'
import type { ProviderCallLedger } from '../src/domain/providers/providerCallTrace.ts'
import { providerGovernanceConfig } from '../src/domain/providers/providerGovernance.ts'
import type { ProviderVenue } from '../src/domain/providers/providerTypes.ts'
import { normalizeVenue } from '../src/domain/normalize/normalizeVenue.ts'
import type { RawPlace } from '../src/domain/types/rawPlace.ts'
import type { VenueCategory } from '../src/domain/types/venue.ts'

export const providerCorpusBuildHarnessConfig = {
  approvalEnvKey: 'ID8_PROVIDER_CORPUS_BUILD_APPROVED',
  budgetCapEnvKey:
    providerGovernanceConfig.budgetCapEnvKeys.byPurpose.retrieval_supply ??
    'VITE_ID8_PROVIDER_RETRIEVAL_SUPPLY_BILLABLE_CALL_CAP',
  expectedTextSearchEndpointPath: '/v1/places:searchText',
  keyEnvKey: 'VITE_GOOGLE_PLACES_API_KEY',
  mockedLiveOutputRoot: 'tmp/provider-corpus/mock-live',
  mockedOutputRoot: 'tmp/provider-corpus/mock',
  modeEnvKey: 'ID8_PROVIDER_CORPUS_BUILD_MODE',
  realOutputDeleteApprovalEnvKey: 'ID8_PROVIDER_CORPUS_REAL_OUTPUT_DELETE_APPROVED',
  realOutputRoot: 'tmp/provider-corpus/real/san-jose',
  retrievalActivationEnvKey:
    providerGovernanceConfig.activationEnvKeys.retrieval_supply ??
    'VITE_ID8_PROVIDER_ENABLE_RETRIEVAL_SUPPLY',
  sourceModeEnvKey: 'VITE_ID8_SOURCE_MODE',
}

export type ProviderCorpusBuildHarnessMode = 'mocked' | 'live'

export type ProviderCorpusBuildPreflightBlockCode =
  | 'approval_flag_present_in_mocked_mode'
  | 'dirty_git_status'
  | 'details_lookup_not_allowed'
  | 'invalid_budget_cap'
  | 'invalid_source_mode'
  | 'live_execution_not_approved'
  | 'live_mode_not_selected'
  | 'manifest_missing'
  | 'manifest_query_count_invalid'
  | 'manifest_query_malformed'
  | 'missing_budget_cap'
  | 'missing_provider_key'
  | 'missing_retrieval_activation'
  | 'output_path_not_tmp_only'
  | 'provider_key_present_in_mocked_mode'
  | 'query_max_calls_invalid'
  | 'query_max_centers_invalid'
  | 'runtime_import_detected'
  | 'runtime_import_allowed_not_false'
  | 'tmp_not_ignored'

export interface ProviderCorpusBuildPreflightBlock {
  code: ProviderCorpusBuildPreflightBlockCode
  detail: string
}

export interface ProviderCorpusBuildPreflightResult {
  allowed: boolean
  blockers: ProviderCorpusBuildPreflightBlock[]
  manifestQueryCount: number
  mode: ProviderCorpusBuildHarnessMode
  outputRoot: string
  runtimeImportHits: string[]
  tmpIgnored: boolean
}

export interface ProviderCorpusBuildHarnessDiagnostics {
  attemptedHttpRequestCount: number
  billableCallCount: number
  mode: ProviderCorpusBuildHarnessMode
  outputRoot: string
  runId: string
  runtimeImportHits: string[]
  tmpIgnored: boolean
}

export interface ProviderCorpusBuildHarnessResult {
  artifact: ProviderCorpusArtifact
  diagnostics: ProviderCorpusBuildHarnessDiagnostics
  ledger: ProviderCallLedger
  outputPaths: {
    artifact: string
    diagnostics: string
    ledger: string
    report: string
  }
  preflight: ProviderCorpusBuildPreflightResult
  report: ProviderCorpusReviewReport
}

export interface ProviderCorpusBuildPreflightInput {
  env?: Record<string, string | undefined>
  gitStatusShort?: string
  manifest?: ProviderCorpusManifest
  mode: ProviderCorpusBuildHarnessMode
  outputRoot?: string
  runtimeImportAllowed?: boolean
  runtimeImportHits?: string[]
  tmpIgnored?: boolean
}

export interface RunProviderCorpusBuildHarnessInput {
  allowMockedLiveOutputRoot?: boolean
  env?: Record<string, string | undefined>
  gitStatusShort?: string
  manifest?: ProviderCorpusManifest
  outputRoot?: string
  runId?: string
}

interface LiveCorpusVenueResult {
  entry: ProviderCorpusManifestEntry
  providerVenue: ProviderVenue
  queryResultCount: number
  rank: number
}

function addBlock(
  blockers: ProviderCorpusBuildPreflightBlock[],
  code: ProviderCorpusBuildPreflightBlockCode,
  detail: string,
): void {
  blockers.push({ code, detail })
}

function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) {
    return false
  }
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function parseNonNegativeInteger(value: string | undefined): number | undefined {
  if (!value?.trim()) {
    return undefined
  }
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined
}

function normalizePathForGit(path: string): string {
  return path.replace(/\\/g, '/')
}

function isTmpOnlyPath(path: string): boolean {
  const normalized = normalizePathForGit(path).replace(/^\.\/+/, '')
  return normalized === 'tmp' || normalized.startsWith('tmp/')
}

export function getGitStatusShort(path?: string): string {
  const args = path ? ['status', '--short', '--', path] : ['status', '--short']
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

export function isGitIgnored(path: string): boolean {
  try {
    execFileSync('git', ['check-ignore', '-q', '--', path], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function findSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const fullPath = join(directory, name)
    const stats = statSync(fullPath)
    if (stats.isDirectory()) {
      return findSourceFiles(fullPath)
    }
    if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      return [fullPath]
    }
    return []
  })
}

export function findRuntimeProviderCorpusImports(): string[] {
  const srcRoot = join(process.cwd(), 'src')
  const allowedOfflineFiles = new Set([
    join(srcRoot, 'domain', 'field', 'corpus', 'promoteProviderCorpus.ts'),
    join(srcRoot, 'domain', 'field', 'corpus', 'types.ts'),
    join(srcRoot, 'domain', 'providers', 'providerCorpusArtifact.ts'),
    join(srcRoot, 'domain', 'providers', 'providerCorpusManifest.ts'),
    join(srcRoot, 'domain', 'providers', 'providerCorpusReviewReport.ts'),
  ])
  return findSourceFiles(srcRoot)
    .filter((filePath) => !allowedOfflineFiles.has(filePath))
    .filter((filePath) => {
      const source = readFileSync(filePath, 'utf8')
      return source.includes('providerCorpusArtifact') || source.includes('providerCorpusReviewReport')
    })
    .map((filePath) => normalizePathForGit(relative(process.cwd(), filePath)))
}

function validateManifest(
  manifest: ProviderCorpusManifest | undefined,
  blockers: ProviderCorpusBuildPreflightBlock[],
): number {
  if (!manifest) {
    addBlock(blockers, 'manifest_missing', 'Provider corpus manifest is missing.')
    return 0
  }

  const queryCount = manifest.entries.length
  if (manifest.expectedQueryCount !== 12 || queryCount !== 12) {
    addBlock(
      blockers,
      'manifest_query_count_invalid',
      `Expected 12 Gate 1 queries, received expectedQueryCount=${manifest.expectedQueryCount}, entries=${queryCount}.`,
    )
  }

  for (const entry of manifest.entries) {
    if (!entry.label.trim() || !entry.queryText.trim() || !entry.gate1Required) {
      addBlock(blockers, 'manifest_query_malformed', `Malformed manifest query: ${entry.label || '<missing label>'}.`)
    }
    if (entry.purpose !== 'retrieval_supply') {
      addBlock(
        blockers,
        'details_lookup_not_allowed',
        `${entry.label}: only retrieval_supply is allowed for Gate 1 corpus builds.`,
      )
    }
    if (entry.maxCenters !== 1) {
      addBlock(blockers, 'query_max_centers_invalid', `${entry.label}: maxCenters must be 1.`)
    }
    if (entry.maxCalls !== 1) {
      addBlock(blockers, 'query_max_calls_invalid', `${entry.label}: maxCalls must be 1.`)
    }
  }

  return queryCount
}

export function evaluateProviderCorpusBuildPreflight(
  input: ProviderCorpusBuildPreflightInput,
): ProviderCorpusBuildPreflightResult {
  const env = input.env ?? process.env
  const outputRoot =
    input.outputRoot ??
    (input.mode === 'live'
      ? providerCorpusBuildHarnessConfig.realOutputRoot
      : providerCorpusBuildHarnessConfig.mockedOutputRoot)
  const ignoredProbePath = normalizePathForGit(join(outputRoot, '.gitkeep'))
  const tmpIgnored = input.tmpIgnored ?? isGitIgnored(ignoredProbePath)
  const runtimeImportHits = input.runtimeImportHits ?? findRuntimeProviderCorpusImports()
  const blockers: ProviderCorpusBuildPreflightBlock[] = []
  const manifestQueryCount = validateManifest(input.manifest, blockers)

  if (!isTmpOnlyPath(outputRoot)) {
    addBlock(blockers, 'output_path_not_tmp_only', `Output root must be under tmp/: ${outputRoot}.`)
  }

  if (!tmpIgnored) {
    addBlock(blockers, 'tmp_not_ignored', `Mocked output path is not ignored by git: ${ignoredProbePath}.`)
  }

  if ((input.runtimeImportAllowed ?? false) !== false) {
    addBlock(blockers, 'runtime_import_allowed_not_false', 'runtimeImportAllowed must remain false.')
  }

  if (runtimeImportHits.length > 0) {
    addBlock(
      blockers,
      'runtime_import_detected',
      `Runtime imports of corpus artifact/report are not allowed: ${runtimeImportHits.join(', ')}.`,
    )
  }

  if (input.mode === 'mocked') {
    if (env[providerCorpusBuildHarnessConfig.keyEnvKey]?.trim()) {
      addBlock(
        blockers,
        'provider_key_present_in_mocked_mode',
        `${providerCorpusBuildHarnessConfig.keyEnvKey} must be absent in mocked mode.`,
      )
    }
    if (env[providerCorpusBuildHarnessConfig.approvalEnvKey]?.trim()) {
      addBlock(
        blockers,
        'approval_flag_present_in_mocked_mode',
        `${providerCorpusBuildHarnessConfig.approvalEnvKey} must be absent in mocked mode.`,
      )
    }
  } else {
    const gitStatusShort = input.gitStatusShort ?? getGitStatusShort()
    const budgetCap = parseNonNegativeInteger(env[providerCorpusBuildHarnessConfig.budgetCapEnvKey])
    if (gitStatusShort.length > 0) {
      addBlock(blockers, 'dirty_git_status', 'Live corpus build requires a clean git worktree.')
    }
    if (env[providerCorpusBuildHarnessConfig.modeEnvKey] !== 'live') {
      addBlock(
        blockers,
        'live_mode_not_selected',
        `${providerCorpusBuildHarnessConfig.modeEnvKey} must be live for live corpus execution.`,
      )
    }
    if (!env[providerCorpusBuildHarnessConfig.keyEnvKey]?.trim()) {
      addBlock(
        blockers,
        'missing_provider_key',
        `${providerCorpusBuildHarnessConfig.keyEnvKey} is required for live corpus build preflight.`,
      )
    }
    if (!parseBooleanEnv(env[providerCorpusBuildHarnessConfig.retrievalActivationEnvKey])) {
      addBlock(
        blockers,
        'missing_retrieval_activation',
        `${providerCorpusBuildHarnessConfig.retrievalActivationEnvKey} must explicitly activate retrieval_supply.`,
      )
    }
    if (budgetCap === undefined) {
      addBlock(
        blockers,
        'missing_budget_cap',
        `${providerCorpusBuildHarnessConfig.budgetCapEnvKey} must be set to 12 or less.`,
      )
    } else if (budgetCap > 12) {
      addBlock(
        blockers,
        'invalid_budget_cap',
        `${providerCorpusBuildHarnessConfig.budgetCapEnvKey} must be 12 or less, received ${budgetCap}.`,
      )
    }
    if (env[providerCorpusBuildHarnessConfig.sourceModeEnvKey] !== 'hybrid') {
      addBlock(
        blockers,
        'invalid_source_mode',
        `${providerCorpusBuildHarnessConfig.sourceModeEnvKey} must be hybrid for operator live execution.`,
      )
    }
    if (!parseBooleanEnv(env[providerCorpusBuildHarnessConfig.approvalEnvKey])) {
      addBlock(
        blockers,
        'live_execution_not_approved',
        `${providerCorpusBuildHarnessConfig.approvalEnvKey} is required and is not set.`,
      )
    }
  }

  return {
    allowed: blockers.length === 0,
    blockers,
    manifestQueryCount,
    mode: input.mode,
    outputRoot,
    runtimeImportHits,
    tmpIgnored,
  }
}

function uniqueSorted<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

function addDays(isoDate: string, days: number): string {
  return new Date(Date.parse(isoDate) + days * 24 * 60 * 60 * 1000).toISOString()
}

function categoryForFamily(family: ProviderCorpusCategoryFamily): VenueCategory {
  switch (family) {
    case 'arcade_activity':
    case 'family_activity':
      return 'activity'
    case 'cocktail_nightlife':
    case 'wine_intimate':
      return 'bar'
    case 'coffee_books':
      return 'cafe'
    case 'cultural_spaces':
      return 'museum'
    case 'dessert_pastry':
    case 'ice_cream':
      return 'dessert'
    case 'dining':
    case 'street_food':
      return 'restaurant'
    case 'live_music':
      return 'live_music'
    case 'parks_outdoor':
      return 'park'
  }
}

function primaryTypeForCategory(category: VenueCategory): string {
  if (category === 'activity') {
    return 'amusement_center'
  }
  if (category === 'live_music') {
    return 'live_music_venue'
  }
  if (category === 'museum') {
    return 'museum'
  }
  if (category === 'park') {
    return 'park'
  }
  return category
}

function priceForCategory(category: VenueCategory): RawPlace['priceTier'] {
  return category === 'bar' || category === 'restaurant' ? '$$' : '$'
}

function buildProviderRecordId(entry: ProviderCorpusManifestEntry): string {
  if (entry.label === 'dessert-late-night' || entry.label === 'ice-cream-gelato') {
    return 'mock_sj_dessert_shared'
  }
  return `mock_sj_${entry.label.replace(/[^a-z0-9]+/g, '_')}`
}

function buildMockProviderVenue(entry: ProviderCorpusManifestEntry): ProviderVenue {
  const category = categoryForFamily(entry.expectedCategoryFamily)
  const primaryType = primaryTypeForCategory(category)
  const providerRecordId = buildProviderRecordId(entry)
  const entryIndex = providerCorpusManifest.entries.indexOf(entry)
  return {
    completenessHints: {
      hasAddress: true,
      hasHours: true,
      hasLocation: true,
      hasPrimaryType: true,
      hasRating: true,
    },
    currentOpeningHours: {
      openNow: true,
      periods: [
        {
          open: { day: 1, hour: 10, minute: 0 },
          close: { day: 1, hour: 22, minute: 0 },
        },
      ],
      weekdayDescriptions: ['Monday: 10:00 AM - 10:00 PM'],
    },
    displayName: `Mock Harness ${entry.label}`,
    fetchedAt: 1_778_000_000_000,
    formattedAddress: `600 ${entry.label} Way, San Jose, CA`,
    location: {
      latitude: Number((37.33 + entryIndex * 0.004).toFixed(5)),
      longitude: Number((-121.89 + entryIndex * 0.003).toFixed(5)),
    },
    primaryType,
    provider: 'google_places',
    providerRecordId,
    rating: 4.4,
    rawPayloadAvailable: false,
    regularOpeningHours: {
      periods: [
        {
          open: { day: 1, hour: 9, minute: 0 },
          close: { day: 1, hour: 21, minute: 0 },
        },
      ],
      weekdayDescriptions: ['Monday: 10:00 AM - 10:00 PM'],
    },
    shortFormattedAddress: 'San Jose, CA',
    sourceMode: 'live',
    types: uniqueSorted([primaryType, category, entry.expectedCategoryFamily]),
    userRatingCount: 144,
  }
}

function buildRawPlace(
  entry: ProviderCorpusManifestEntry,
  providerVenue: ProviderVenue,
  rank = 0,
  descriptionSource = 'mocked harness',
): RawPlace {
  const category = categoryForFamily(entry.expectedCategoryFamily)
  const hoursPeriods = providerVenue.currentOpeningHours?.periods?.length
    ? providerVenue.currentOpeningHours.periods
    : providerVenue.regularOpeningHours?.periods
  return {
    rawType: 'place',
    id: createLiveGoogleVenueId(providerVenue.providerRecordId),
    name: providerVenue.displayName,
    city: 'San Jose',
    neighborhood: entry.queryText.includes('Willow Glen')
      ? 'Willow Glen'
      : entry.queryText.includes('SoFa')
        ? 'SoFa District'
        : 'Downtown',
    driveMinutes: 8 + Math.min(rank, 4),
    priceTier: priceForCategory(category),
    tags: uniqueSorted([
      entry.expectedCategoryFamily,
      ...entry.expectedRoles,
      ...entry.supportedBuildAnchorFamilies,
    ]),
    shortDescription: `${providerVenue.displayName} is a ${descriptionSource} venue for ${entry.expectedCategoryFamily}.`,
    narrativeFlavor: `${providerVenue.displayName} was mapped by the ${descriptionSource} corpus build harness.`,
    categoryHint: category,
    subcategoryHint: providerVenue.primaryType,
    placeTypes: providerVenue.types,
    sourceTypes: providerVenue.types,
    normalizedFromRawType: 'raw-place',
    sourceOrigin: 'live',
    provider: 'google-places',
    providerRecordId: providerVenue.providerRecordId,
    sourceQueryLabel: entry.label,
    queryTerms: entry.queryText.toLowerCase().split(/\s+/).filter((token) => token.length > 2),
    sourceConfidence: 0.86,
    formattedAddress: providerVenue.formattedAddress,
    rating: providerVenue.rating,
    ratingCount: providerVenue.userRatingCount,
    openNow: providerVenue.currentOpeningHours?.openNow,
    businessStatus: 'OPERATIONAL',
    hoursPeriods,
    currentOpeningHoursText: providerVenue.currentOpeningHours?.weekdayDescriptions,
    regularOpeningHoursText: providerVenue.regularOpeningHours?.weekdayDescriptions,
    latitude: providerVenue.location?.latitude,
    longitude: providerVenue.location?.longitude,
  }
}

function buildProviderCorpusVenue(
  result: LiveCorpusVenueResult,
  generatedAt: string,
): ProviderCorpusArtifactVenue {
  const rawPlace = buildRawPlace(result.entry, result.providerVenue, result.rank, 'provider')
  return {
    fetchedAt: result.providerVenue.fetchedAt,
    generatedAt,
    id: rawPlace.id,
    normalizedVenue: normalizeVenue(rawPlace, { qualityGateContext: 'offline-provider-corpus' }),
    provider: 'google-places',
    providerRecordId: result.providerVenue.providerRecordId,
    rawPlace,
    runtimeSafety: {
      reasons: [
        'provider_payload_mapped_through_provider_adapter',
        'provider_identity_present',
        'coordinates_present',
        'normalized_after_live_preflight',
      ],
      status: 'safe_for_future_runtime_ingestion',
    },
    sourceQueryLabel: result.entry.label,
    sourceQueryText: result.entry.queryText,
    support: {
      buildAnchorFamilies: result.entry.supportedBuildAnchorFamilies,
      categoryFamily: result.entry.expectedCategoryFamily,
      roles: result.entry.expectedRoles,
      scenarioFamilies: result.entry.supportedScenarioFamilies,
      starters: result.entry.supportedStarters,
      surpriseHighlightSupport: result.entry.surpriseHighlightSupport,
    },
  }
}

function buildMockVenue(
  entry: ProviderCorpusManifestEntry,
  generatedAt: string,
): ProviderCorpusArtifactVenue {
  const providerVenue = buildMockProviderVenue(entry)
  const rawPlace = buildRawPlace(entry, providerVenue)
  return {
    fetchedAt: providerVenue.fetchedAt,
    generatedAt,
    id: rawPlace.id,
    normalizedVenue: normalizeVenue(rawPlace, { qualityGateContext: 'offline-provider-corpus' }),
    provider: 'google-places',
    providerRecordId: providerVenue.providerRecordId,
    rawPlace,
    runtimeSafety: {
      reasons: [
        'mocked_provider_payload',
        'provider_identity_present',
        'coordinates_present',
        'normalized_without_provider_call',
      ],
      status: 'safe_for_future_runtime_ingestion',
    },
    sourceQueryLabel: entry.label,
    sourceQueryText: entry.queryText,
    support: {
      buildAnchorFamilies: entry.supportedBuildAnchorFamilies,
      categoryFamily: entry.expectedCategoryFamily,
      roles: entry.expectedRoles,
      scenarioFamilies: entry.supportedScenarioFamilies,
      starters: entry.supportedStarters,
      surpriseHighlightSupport: entry.surpriseHighlightSupport,
    },
  }
}

function collectDuplicateProviderRecordIds(venues: ProviderCorpusArtifactVenue[]): string[] {
  const counts = new Map<string, number>()
  for (const venue of venues) {
    counts.set(venue.providerRecordId, (counts.get(venue.providerRecordId) ?? 0) + 1)
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([providerRecordId]) => providerRecordId)
    .sort((left, right) => left.localeCompare(right))
}

function buildZeroCallLedger(): ProviderCallLedger {
  return {
    byPurpose: {
      anchor_search: 0,
      build_anchor_nearby: 0,
      details_lookup: 0,
      retrieval_supply: 0,
      waypoint_nearby: 0,
    },
    totalAttempted: 0,
    totalAttemptedHttpRequests: 0,
    totalBillable: 0,
    totalBlocked: 0,
    totalFailed: 0,
    traces: [],
  }
}

function combineProviderLedgers(ledgers: ProviderCallLedger[]): ProviderCallLedger {
  return {
    byPurpose: {
      anchor_search: ledgers.reduce((sum, ledger) => sum + ledger.byPurpose.anchor_search, 0),
      build_anchor_nearby: ledgers.reduce((sum, ledger) => sum + ledger.byPurpose.build_anchor_nearby, 0),
      details_lookup: ledgers.reduce((sum, ledger) => sum + ledger.byPurpose.details_lookup, 0),
      retrieval_supply: ledgers.reduce((sum, ledger) => sum + ledger.byPurpose.retrieval_supply, 0),
      waypoint_nearby: ledgers.reduce((sum, ledger) => sum + ledger.byPurpose.waypoint_nearby, 0),
    },
    totalAttempted: ledgers.reduce((sum, ledger) => sum + ledger.totalAttempted, 0),
    totalAttemptedHttpRequests: ledgers.reduce(
      (sum, ledger) => sum + ledger.totalAttemptedHttpRequests,
      0,
    ),
    totalBillable: ledgers.reduce((sum, ledger) => sum + ledger.totalBillable, 0),
    totalBlocked: ledgers.reduce((sum, ledger) => sum + ledger.totalBlocked, 0),
    totalFailed: ledgers.reduce((sum, ledger) => sum + ledger.totalFailed, 0),
    traces: ledgers.flatMap((ledger) => ledger.traces),
  }
}

function buildDedupeReport(venues: ProviderCorpusArtifactVenue[]): ProviderCorpusArtifact['dedupeReport'] {
  const duplicateProviderRecordIds = collectDuplicateProviderRecordIds(venues)
  const dedupedVenueIds = duplicateProviderRecordIds.flatMap((providerRecordId) => {
    const duplicates = venues.filter((venue) => venue.providerRecordId === providerRecordId)
    const keptVenue = duplicates[0]
    if (!keptVenue) {
      return []
    }
    return duplicates.slice(1).map((venue) => ({
      droppedVenueId: venue.id,
      keptVenueId: keptVenue.id,
      providerRecordId,
      reason: 'duplicate_provider_record_id' as const,
    }))
  })
  return {
    dedupedVenueIds,
    duplicateProviderRecordIds,
    inputVenueCount: venues.length,
    uniqueVenueCount: new Set(venues.map((venue) => venue.providerRecordId)).size,
  }
}

function buildCoverageReport(): ProviderCorpusArtifact['coverageReport'] {
  const surpriseHighlightCategoryFamilies = uniqueSorted(
    providerCorpusManifest.entries
      .filter((entry) => entry.surpriseHighlightSupport)
      .map((entry) => entry.expectedCategoryFamily),
  )
  return {
    buildAnchorFamilies: uniqueSorted(
      providerCorpusManifest.entries.flatMap((entry) => entry.supportedBuildAnchorFamilies),
    ),
    categoryFamilies: uniqueSorted(
      providerCorpusManifest.entries.map((entry) => entry.expectedCategoryFamily),
    ),
    curateStarters: uniqueSorted(
      providerCorpusManifest.entries.flatMap((entry) => entry.supportedStarters),
    ),
    manifestQueryLabels: providerCorpusManifest.entries.map((entry) => entry.label),
    roles: uniqueSorted(providerCorpusManifest.entries.flatMap((entry) => entry.expectedRoles)),
    scenarioFamilies: uniqueSorted(
      providerCorpusManifest.entries.flatMap((entry) => entry.supportedScenarioFamilies),
    ),
    surpriseHighlightCategoryFamilies,
    surpriseSupported: surpriseHighlightCategoryFamilies.length >= 6,
  }
}

function buildProviderCorpusArtifactFromResults(input: {
  generatedAt: string
  ledger: ProviderCallLedger
  queryResultCounts: Map<string, number>
  results: LiveCorpusVenueResult[]
}): ProviderCorpusArtifact {
  const venues = input.results.map((result) => buildProviderCorpusVenue(result, input.generatedAt))
  return {
    artifactVersion: 'provider-corpus-snapshot.v1',
    city: 'San Jose',
    coverageReport: buildCoverageReport(),
    dedupeReport: buildDedupeReport(venues),
    dropReasons: {
      normalizationDropped: {},
      providerMappedDropped: {},
      runtimeSafetyBlocked: {},
    },
    freshnessPolicy: {
      generatedAt: input.generatedAt,
      maxAgeDays: 30,
      reviewBy: addDays(input.generatedAt, 30),
      staleAction: 'review_before_runtime_ingestion',
    },
    generatedAt: input.generatedAt,
    manifestQueryCount: providerCorpusManifest.entries.length,
    manifestVersion: 'provider-corpus-manifest.v1',
    providerLedgerSummary: input.ledger,
    queries: providerCorpusManifest.entries.map((entry) => ({
      billableCallCount: input.queryResultCounts.has(entry.label) ? 1 : 0,
      expectedCategoryFamily: entry.expectedCategoryFamily,
      expectedRoles: entry.expectedRoles,
      gate1Required: entry.gate1Required,
      label: entry.label,
      maxCalls: entry.maxCalls,
      maxCenters: entry.maxCenters,
      mockedResultCount: 0,
      providerResultCount: input.queryResultCounts.get(entry.label) ?? 0,
      purpose: entry.purpose,
      queryText: entry.queryText,
    })),
    runtimeImportAllowed: false,
    source: 'provider',
    venues,
  }
}

export function buildMockedProviderCorpusArtifact(
  generatedAt = new Date().toISOString(),
): ProviderCorpusArtifact {
  const venues = providerCorpusManifest.entries.map((entry) => buildMockVenue(entry, generatedAt))
  const duplicateProviderRecordIds = collectDuplicateProviderRecordIds(venues)
  const keptVenueId = createLiveGoogleVenueId('mock_sj_dessert_shared')
  const dedupedVenueIds = duplicateProviderRecordIds.flatMap((providerRecordId) => {
    const duplicates = venues.filter((venue) => venue.providerRecordId === providerRecordId)
    return duplicates.slice(1).map((venue) => ({
      droppedVenueId: venue.id,
      keptVenueId,
      providerRecordId,
      reason: 'duplicate_provider_record_id' as const,
    }))
  })
  const surpriseHighlightCategoryFamilies = uniqueSorted(
    providerCorpusManifest.entries
      .filter((entry) => entry.surpriseHighlightSupport)
      .map((entry) => entry.expectedCategoryFamily),
  )

  return {
    artifactVersion: 'provider-corpus-snapshot.v1',
    city: 'San Jose',
    coverageReport: {
      buildAnchorFamilies: uniqueSorted(
        providerCorpusManifest.entries.flatMap((entry) => entry.supportedBuildAnchorFamilies),
      ),
      categoryFamilies: uniqueSorted(
        providerCorpusManifest.entries.map((entry) => entry.expectedCategoryFamily),
      ),
      curateStarters: uniqueSorted(
        providerCorpusManifest.entries.flatMap((entry) => entry.supportedStarters),
      ),
      manifestQueryLabels: providerCorpusManifest.entries.map((entry) => entry.label),
      roles: uniqueSorted(providerCorpusManifest.entries.flatMap((entry) => entry.expectedRoles)),
      scenarioFamilies: uniqueSorted(
        providerCorpusManifest.entries.flatMap((entry) => entry.supportedScenarioFamilies),
      ),
      surpriseHighlightCategoryFamilies,
      surpriseSupported: surpriseHighlightCategoryFamilies.length >= 6,
    },
    dedupeReport: {
      dedupedVenueIds,
      duplicateProviderRecordIds,
      inputVenueCount: venues.length,
      uniqueVenueCount: new Set(venues.map((venue) => venue.providerRecordId)).size,
    },
    dropReasons: {
      normalizationDropped: {},
      providerMappedDropped: {},
      runtimeSafetyBlocked: {},
    },
    freshnessPolicy: {
      generatedAt,
      maxAgeDays: 30,
      reviewBy: addDays(generatedAt, 30),
      staleAction: 'review_before_runtime_ingestion',
    },
    generatedAt,
    manifestQueryCount: providerCorpusManifest.entries.length,
    manifestVersion: 'provider-corpus-manifest.v1',
    providerLedgerSummary: buildZeroCallLedger(),
    queries: providerCorpusManifest.entries.map((entry) => ({
      billableCallCount: 0,
      expectedCategoryFamily: entry.expectedCategoryFamily,
      expectedRoles: entry.expectedRoles,
      gate1Required: entry.gate1Required,
      label: entry.label,
      maxCalls: entry.maxCalls,
      maxCenters: entry.maxCenters,
      mockedResultCount: 1,
      providerResultCount: 0,
      purpose: entry.purpose,
      queryText: entry.queryText,
    })),
    runtimeImportAllowed: false,
    source: 'mocked',
    venues,
  }
}

function assertValidArtifact(artifact: ProviderCorpusArtifact): void {
  const validation = validateProviderCorpusArtifact(artifact)
  if (!validation.valid) {
    throw new Error(`Mocked corpus artifact validation failed: ${validation.errors.join('; ')}`)
  }
}

function assertValidReviewReport(report: ProviderCorpusReviewReport): void {
  if (report.reportVersion !== 'provider-corpus-review.v1') {
    throw new Error('Mocked review report version is invalid.')
  }
  if (report.gate1Readiness === 'blocked') {
    throw new Error(`Mocked review report is blocked: ${report.riskFlags.map((flag) => flag.code).join(', ')}`)
  }
}

function writeJsonFile(path: string, value: unknown): void {
  if (!isTmpOnlyPath(path)) {
    throw new Error(`Refusing to write outside tmp/: ${path}`)
  }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export function removeMockedCorpusOutput(outputRoot = providerCorpusBuildHarnessConfig.mockedOutputRoot): void {
  const resolvedRoot = resolve(outputRoot)
  const resolvedTmp = resolve('tmp')
  const resolvedRealOutputRoot = resolve(providerCorpusBuildHarnessConfig.realOutputRoot)
  if (resolvedRoot === resolvedTmp || !resolvedRoot.startsWith(`${resolvedTmp}\\`) && !resolvedRoot.startsWith(`${resolvedTmp}/`)) {
    throw new Error(`Refusing to remove output outside tmp/: ${outputRoot}`)
  }
  if (
    resolvedRoot === resolvedRealOutputRoot &&
    process.env[providerCorpusBuildHarnessConfig.realOutputDeleteApprovalEnvKey] !== '1'
  ) {
    throw new Error(
      `Refusing to remove shared real corpus output root without ${providerCorpusBuildHarnessConfig.realOutputDeleteApprovalEnvKey}=1: ${outputRoot}`,
    )
  }
  if (existsSync(resolvedRoot)) {
    rmSync(resolvedRoot, { force: true, recursive: true })
  }
}

export function runMockedProviderCorpusBuildHarness(
  input: RunProviderCorpusBuildHarnessInput = {},
): ProviderCorpusBuildHarnessResult {
  const outputRoot = input.outputRoot ?? providerCorpusBuildHarnessConfig.mockedOutputRoot
  const preflight = evaluateProviderCorpusBuildPreflight({
    env: input.env,
    manifest: input.manifest ?? providerCorpusManifest,
    mode: 'mocked',
    outputRoot,
  })

  if (!preflight.allowed) {
    throw new Error(`Mocked corpus build preflight blocked: ${preflight.blockers.map((blocker) => blocker.code).join(', ')}`)
  }

  const runId = input.runId ?? `mock-provider-corpus-${Date.now()}`
  const artifact = buildMockedProviderCorpusArtifact('2026-06-06T12:00:00.000Z')
  assertValidArtifact(artifact)
  const report = buildProviderCorpusReviewReport(artifact, {
    now: '2026-06-06T13:00:00.000Z',
    runtimeImportHits: preflight.runtimeImportHits,
  })
  assertValidReviewReport(report)

  const diagnostics: ProviderCorpusBuildHarnessDiagnostics = {
    attemptedHttpRequestCount: 0,
    billableCallCount: 0,
    mode: 'mocked',
    outputRoot,
    runId,
    runtimeImportHits: preflight.runtimeImportHits,
    tmpIgnored: preflight.tmpIgnored,
  }
  const outputDirectory = join(outputRoot, runId)
  const outputPaths = {
    artifact: normalizePathForGit(join(outputDirectory, 'provider-corpus-snapshot.mock.json')),
    diagnostics: normalizePathForGit(join(outputDirectory, 'provider-corpus-diagnostics.mock.json')),
    ledger: normalizePathForGit(join(outputDirectory, 'provider-corpus-ledger.mock.json')),
    report: normalizePathForGit(join(outputDirectory, 'provider-corpus-review.mock.json')),
  }

  writeJsonFile(outputPaths.artifact, artifact)
  writeJsonFile(outputPaths.report, report)
  writeJsonFile(outputPaths.ledger, artifact.providerLedgerSummary)
  writeJsonFile(outputPaths.diagnostics, diagnostics)

  return {
    artifact,
    diagnostics,
    ledger: artifact.providerLedgerSummary,
    outputPaths,
    preflight,
    report,
  }
}

function assertNoKeyLeak(value: unknown, key: string): void {
  if (!key.trim()) {
    return
  }
  const serialized = JSON.stringify(value)
  if (serialized.includes(key)) {
    throw new Error('Refusing to emit output containing provider key material.')
  }
}

function assertLiveLedgerWithinCaps(ledger: ProviderCallLedger): void {
  if (ledger.totalAttempted > 12) {
    throw new Error(`Provider attempted calls exceeded cap: ${ledger.totalAttempted}.`)
  }
  if (ledger.totalAttemptedHttpRequests > 12) {
    throw new Error(`Provider attempted HTTP requests exceeded cap: ${ledger.totalAttemptedHttpRequests}.`)
  }
  if (ledger.totalBillable > 12) {
    throw new Error(`Provider billable calls exceeded cap: ${ledger.totalBillable}.`)
  }
  const nonRetrievalTrace = ledger.traces.find((trace) => trace.purpose !== 'retrieval_supply')
  if (nonRetrievalTrace) {
    throw new Error(`Unexpected provider purpose in live corpus ledger: ${nonRetrievalTrace.purpose}.`)
  }
}

function assertExpectedTextSearchEndpoint(result: ProviderTextSearchResult<LiveCorpusVenueResult>): void {
  const requestPath = result.diagnostics.requestPath
  if (!requestPath.includes(providerCorpusBuildHarnessConfig.expectedTextSearchEndpointPath)) {
    throw new Error(`Unexpected provider endpoint for corpus build: ${requestPath}.`)
  }
}

function buildCorpusTextSearchQuery(entry: ProviderCorpusManifestEntry): ProviderTextSearchQuery {
  return {
    fieldMask: [
      'places.id',
      'places.displayName',
      'places.primaryType',
      'places.types',
      'places.formattedAddress',
      'places.shortFormattedAddress',
      'places.location',
      'places.rating',
      'places.userRatingCount',
      'places.currentOpeningHours.openNow',
      'places.currentOpeningHours.weekdayDescriptions',
      'places.currentOpeningHours.periods',
      'places.regularOpeningHours.weekdayDescriptions',
      'places.regularOpeningHours.periods',
      'places.businessStatus',
      'places.editorialSummary',
      'places.websiteUri',
    ].join(','),
    pageSize: 8,
    queryLabel: entry.label,
    rankPreference: 'RELEVANCE',
    textQuery: entry.queryText,
  }
}

export async function runLiveProviderCorpusBuildHarness(
  input: RunProviderCorpusBuildHarnessInput = {},
): Promise<ProviderCorpusBuildHarnessResult> {
  const outputRoot = input.outputRoot ?? providerCorpusBuildHarnessConfig.realOutputRoot
  const env = input.env ?? process.env
  const preflight = evaluateProviderCorpusBuildPreflight({
    env,
    gitStatusShort: input.gitStatusShort,
    manifest: input.manifest ?? providerCorpusManifest,
    mode: 'live',
    outputRoot,
  })

  if (!preflight.allowed) {
    throw new Error(`Live corpus build preflight blocked: ${preflight.blockers.map((blocker) => blocker.code).join(', ')}`)
  }

  const key = env[providerCorpusBuildHarnessConfig.keyEnvKey] ?? ''
  const generatedAt = new Date().toISOString()
  const ledgers: ProviderCallLedger[] = []
  const providerResults: LiveCorpusVenueResult[] = []
  const queryResultCounts = new Map<string, number>()

  for (const entry of providerCorpusManifest.entries) {
    const result = await searchPlaces<LiveCorpusVenueResult, ProviderTextSearchQuery>({
      callPurpose: 'retrieval_supply',
      mapPlace: (providerVenue, context) => ({
        entry,
        providerVenue,
        queryResultCount: 0,
        rank: context.index,
      }),
      queries: [buildCorpusTextSearchQuery(entry)],
      sourceMode: 'hybrid',
    })

    assertExpectedTextSearchEndpoint(result)
    if (result.errors.length > 0) {
      throw new Error(`Provider corpus query failed for ${entry.label}: ${result.errors.join('; ')}`)
    }
    if (result.diagnostics.ledger) {
      ledgers.push(result.diagnostics.ledger)
    }
    const resultCount = result.queryCounts.find((query) => query.queryLabel === entry.label)?.resultCount ?? 0
    queryResultCounts.set(entry.label, resultCount)
    providerResults.push(
      ...result.results.map((providerResult) => ({
        ...providerResult,
        queryResultCount: resultCount,
      })),
    )
  }

  const ledger = combineProviderLedgers(ledgers)
  assertLiveLedgerWithinCaps(ledger)
  const artifact = buildProviderCorpusArtifactFromResults({
    generatedAt,
    ledger,
    queryResultCounts,
    results: providerResults,
  })
  assertValidArtifact(artifact)
  const report = buildProviderCorpusReviewReport(artifact, {
    now: generatedAt,
    runtimeImportHits: preflight.runtimeImportHits,
  })
  assertValidReviewReport(report)

  const runId = input.runId ?? `provider-corpus-real-${Date.now()}`
  const diagnostics: ProviderCorpusBuildHarnessDiagnostics = {
    attemptedHttpRequestCount: ledger.totalAttemptedHttpRequests,
    billableCallCount: ledger.totalBillable,
    mode: 'live',
    outputRoot,
    runId,
    runtimeImportHits: preflight.runtimeImportHits,
    tmpIgnored: preflight.tmpIgnored,
  }
  const outputDirectory = join(outputRoot, runId)
  const outputPaths = {
    artifact: normalizePathForGit(join(outputDirectory, 'provider-corpus-snapshot.provider.json')),
    diagnostics: normalizePathForGit(join(outputDirectory, 'provider-corpus-diagnostics.provider.json')),
    ledger: normalizePathForGit(join(outputDirectory, 'provider-corpus-ledger.provider.json')),
    report: normalizePathForGit(join(outputDirectory, 'provider-corpus-review.provider.json')),
  }

  const allowedLiveOutputRoots = [
    providerCorpusBuildHarnessConfig.realOutputRoot,
    ...(input.allowMockedLiveOutputRoot ? [providerCorpusBuildHarnessConfig.mockedLiveOutputRoot] : []),
  ]
  for (const path of Object.values(outputPaths)) {
    if (!allowedLiveOutputRoots.some((root) => path.startsWith(`${root}/`))) {
      throw new Error(`Refusing to write live corpus output outside approved tmp roots: ${path}`)
    }
  }

  assertNoKeyLeak(artifact, key)
  assertNoKeyLeak(report, key)
  assertNoKeyLeak(ledger, key)
  assertNoKeyLeak(diagnostics, key)
  writeJsonFile(outputPaths.artifact, artifact)
  writeJsonFile(outputPaths.report, report)
  writeJsonFile(outputPaths.ledger, ledger)
  writeJsonFile(outputPaths.diagnostics, diagnostics)

  return {
    artifact,
    diagnostics,
    ledger,
    outputPaths,
    preflight,
    report,
  }
}

export function modeFromEnv(env: Record<string, string | undefined> = process.env): ProviderCorpusBuildHarnessMode {
  return env[providerCorpusBuildHarnessConfig.modeEnvKey] === 'live' ? 'live' : 'mocked'
}

export function isDirectRun(metaUrl: string): boolean {
  return process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(metaUrl) : false
}
