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
  keyEnvKey: 'VITE_GOOGLE_PLACES_API_KEY',
  mockedOutputRoot: 'tmp/provider-corpus/mock',
  modeEnvKey: 'ID8_PROVIDER_CORPUS_BUILD_MODE',
  retrievalActivationEnvKey:
    providerGovernanceConfig.activationEnvKeys.retrieval_supply ??
    'VITE_ID8_PROVIDER_ENABLE_RETRIEVAL_SUPPLY',
}

export type ProviderCorpusBuildHarnessMode = 'mocked' | 'live'

export type ProviderCorpusBuildPreflightBlockCode =
  | 'approval_flag_present_in_mocked_mode'
  | 'dirty_git_status'
  | 'details_lookup_not_allowed'
  | 'live_execution_not_approved'
  | 'live_execution_not_implemented'
  | 'manifest_missing'
  | 'manifest_query_count_invalid'
  | 'manifest_query_malformed'
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
  fetchCallCount: 0
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
  env?: Record<string, string | undefined>
  manifest?: ProviderCorpusManifest
  outputRoot?: string
  runId?: string
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
  const outputRoot = input.outputRoot ?? providerCorpusBuildHarnessConfig.mockedOutputRoot
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
    if (gitStatusShort.length > 0) {
      addBlock(blockers, 'dirty_git_status', 'Live corpus build requires a clean git worktree.')
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
    if (!parseBooleanEnv(env[providerCorpusBuildHarnessConfig.approvalEnvKey])) {
      addBlock(
        blockers,
        'live_execution_not_approved',
        `${providerCorpusBuildHarnessConfig.approvalEnvKey} is required and is not set.`,
      )
    }
    addBlock(
      blockers,
      'live_execution_not_implemented',
      'Real provider corpus execution remains blocked; this harness only supports mocked execution.',
    )
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
): RawPlace {
  const category = categoryForFamily(entry.expectedCategoryFamily)
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
    driveMinutes: 8,
    priceTier: priceForCategory(category),
    tags: uniqueSorted([
      entry.expectedCategoryFamily,
      ...entry.expectedRoles,
      ...entry.supportedBuildAnchorFamilies,
    ]),
    shortDescription: `${providerVenue.displayName} is a mocked harness venue for ${entry.expectedCategoryFamily}.`,
    narrativeFlavor: `${providerVenue.displayName} exists only in the mocked corpus build harness.`,
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
    currentOpeningHoursText: providerVenue.currentOpeningHours?.weekdayDescriptions,
    regularOpeningHoursText: providerVenue.regularOpeningHours?.weekdayDescriptions,
    latitude: providerVenue.location?.latitude,
    longitude: providerVenue.location?.longitude,
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
    normalizedVenue: normalizeVenue(rawPlace),
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
  if (resolvedRoot === resolvedTmp || !resolvedRoot.startsWith(`${resolvedTmp}\\`) && !resolvedRoot.startsWith(`${resolvedTmp}/`)) {
    throw new Error(`Refusing to remove output outside tmp/: ${outputRoot}`)
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
    fetchCallCount: 0,
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

export function modeFromEnv(env: Record<string, string | undefined> = process.env): ProviderCorpusBuildHarnessMode {
  return env[providerCorpusBuildHarnessConfig.modeEnvKey] === 'live' ? 'live' : 'mocked'
}

export function isDirectRun(metaUrl: string): boolean {
  return process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(metaUrl) : false
}
