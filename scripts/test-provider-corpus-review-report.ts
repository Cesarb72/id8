import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type {
  ProviderCorpusArtifact,
  ProviderCorpusArtifactVenue,
} from '../src/domain/providers/providerCorpusArtifact.ts'
import {
  providerCorpusGate1StarterIds,
  providerCorpusManifest,
  providerCorpusRequiredBuildAnchorFamilies,
  providerCorpusScenarioFamilies,
  type ProviderCorpusCategoryFamily,
  type ProviderCorpusManifestEntry,
  type ProviderCorpusRole,
} from '../src/domain/providers/providerCorpusManifest.ts'
import {
  buildProviderCorpusReviewReport,
  type ProviderCorpusReviewRiskFlagCode,
} from '../src/domain/providers/providerCorpusReviewReport.ts'
import { createLiveGoogleVenueId } from '../src/domain/providers/admitLiveVenueIdentity.ts'
import type { ProviderCallLedger } from '../src/domain/providers/providerCallTrace.ts'
import type { ProviderVenue } from '../src/domain/providers/providerTypes.ts'
import { normalizeVenue } from '../src/domain/normalize/normalizeVenue.ts'
import type { RawPlace } from '../src/domain/types/rawPlace.ts'
import type { VenueCategory } from '../src/domain/types/venue.ts'

const originalFetch = globalThis.fetch
let fetchCallCount = 0

const fetchTrap: typeof fetch = async () => {
  fetchCallCount += 1
  throw new Error('Provider corpus review report test must not call fetch.')
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function uniqueSorted<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

function addDays(isoDate: string, days: number): string {
  const timestamp = Date.parse(isoDate)
  return new Date(timestamp + days * 24 * 60 * 60 * 1000).toISOString()
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
    displayName: `Mock Review ${entry.label}`,
    fetchedAt: 1_778_000_000_000,
    formattedAddress: `400 ${entry.label} Way, San Jose, CA`,
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
    shortDescription: `${providerVenue.displayName} is a mocked report venue for ${entry.expectedCategoryFamily}.`,
    narrativeFlavor: `${providerVenue.displayName} exists only in the mocked review report validator.`,
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

function buildMockVenue(entry: ProviderCorpusManifestEntry, generatedAt: string): ProviderCorpusArtifactVenue {
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

function buildMockLedger(overrides: Partial<ProviderCallLedger> = {}): ProviderCallLedger {
  return {
    byPurpose: {
      anchor_search: 0,
      build_anchor_nearby: 0,
      details_lookup: 0,
      retrieval_supply: 0,
      waypoint_nearby: 0,
      ...(overrides.byPurpose ?? {}),
    },
    totalAttempted: overrides.totalAttempted ?? 0,
    totalAttemptedHttpRequests: overrides.totalAttemptedHttpRequests ?? 0,
    totalBillable: overrides.totalBillable ?? 0,
    totalBlocked: overrides.totalBlocked ?? 0,
    totalFailed: overrides.totalFailed ?? 0,
    traces: overrides.traces ?? [],
  }
}

function buildMockArtifact(): ProviderCorpusArtifact {
  const generatedAt = '2026-06-06T12:00:00.000Z'
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
      roles: uniqueSorted(
        providerCorpusManifest.entries.flatMap((entry) => entry.expectedRoles),
      ),
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
    providerLedgerSummary: buildMockLedger(),
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

function buildIncompleteArtifact(healthy: ProviderCorpusArtifact): ProviderCorpusArtifact {
  const incompleteQueries = healthy.queries.slice(0, -1)
  return {
    ...healthy,
    coverageReport: {
      ...healthy.coverageReport,
      buildAnchorFamilies: healthy.coverageReport.buildAnchorFamilies.filter((family) => family !== 'wine'),
      curateStarters: healthy.coverageReport.curateStarters.filter((starter) => starter !== 'wine-slow-evening'),
      roles: healthy.coverageReport.roles.filter((role) => role !== 'windDown'),
      scenarioFamilies: healthy.coverageReport.scenarioFamilies.filter((scenario) => scenario !== 'family_cultured'),
      surpriseSupported: false,
    },
    dedupeReport: {
      ...healthy.dedupeReport,
      dedupedVenueIds: [],
    },
    dropReasons: {
      normalizationDropped: {
        missing_coordinates: 2,
      },
      providerMappedDropped: {},
      runtimeSafetyBlocked: {},
    },
    manifestQueryCount: incompleteQueries.length,
    providerLedgerSummary: buildMockLedger({
      totalBillable: 1,
    }),
    queries: incompleteQueries,
    venues: healthy.venues.slice(0, 4),
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

function findRuntimeReviewReportImports(): string[] {
  const srcRoot = join(process.cwd(), 'src')
  const reportPath = join(srcRoot, 'domain', 'providers', 'providerCorpusReviewReport.ts')
  return findSourceFiles(srcRoot)
    .filter((filePath) => filePath !== reportPath)
    .filter((filePath) => readFileSync(filePath, 'utf8').includes('providerCorpusReviewReport'))
    .map((filePath) => relative(process.cwd(), filePath).replace(/\\/g, '/'))
}

function assertIncludesAll(label: string, actual: string[], expected: string[]): void {
  const missing = expected.filter((value) => !actual.includes(value))
  assert(missing.length === 0, `${label}: missing ${missing.join(', ')}`)
}

function assertRiskFlagsInclude(actualCodes: ProviderCorpusReviewRiskFlagCode[], expectedCodes: ProviderCorpusReviewRiskFlagCode[]): void {
  const missing = expectedCodes.filter((code) => !actualCodes.includes(code))
  assert(missing.length === 0, `Expected risk flags missing: ${missing.join(', ')}`)
}

function validateHealthyReport(artifact: ProviderCorpusArtifact): void {
  const report = buildProviderCorpusReviewReport(artifact, {
    now: '2026-06-06T13:00:00.000Z',
    runtimeImportHits: [],
  })
  assert(report.reportVersion === 'provider-corpus-review.v1', 'Expected report v1.')
  assert(report.artifactVersion === artifact.artifactVersion, 'Expected artifact version to carry through.')
  assert(report.manifestQueryCount === 12, 'Expected 12 manifest queries.')
  assert(report.queryLedger.length === 12, 'Expected all 12 query ledger entries.')
  assert(report.venueCount === artifact.venues.length, 'Expected venue count to match artifact.')
  assert(
    report.uniqueProviderRecordCount === artifact.dedupeReport.uniqueVenueCount,
    'Expected unique provider record count to match artifact dedupe report.',
  )
  assert(report.dedupeSummary.dedupedVenueCount === 1, 'Expected mocked dedupe summary to retain one dedupe entry.')
  assert(report.dropReasonSummary.totalDropped === 0, 'Expected no drops in healthy mocked report.')
  assertIncludesAll('Curate starter coverage', report.curateStarterCoverage, providerCorpusGate1StarterIds)
  assertIncludesAll(
    'Build anchor family coverage',
    report.buildAnchorFamilyCoverage,
    providerCorpusRequiredBuildAnchorFamilies,
  )
  assertIncludesAll(
    'Persona/vibe scenario coverage',
    report.personaVibeScenarioCoverage,
    providerCorpusScenarioFamilies,
  )
  assertIncludesAll('Role coverage', report.roleCoverage, [
    'highlight',
    'start',
    'support',
    'windDown',
  ] satisfies ProviderCorpusRole[])
  assert(report.surpriseSupportCoverage.supported, 'Expected Surprise support.')
  assert(report.riskFlags.length === 0, `Expected no healthy risk flags, received ${report.riskFlags.map((flag) => flag.code).join(', ')}`)
  assert(report.gate1Readiness === 'ready', `Expected ready report, received ${report.gate1Readiness}.`)
  assert(report.goNoGoRecommendation === 'go_for_gate_1_review', 'Expected go recommendation for healthy mocked report.')
  assert(report.providerLedgerSummary.totalAttempted === 0, 'Expected totalAttempted 0.')
  assert(report.providerLedgerSummary.totalBillable === 0, 'Expected totalBillable 0.')
  assert(fetchCallCount === 0, `Expected fetch not to be called, received ${fetchCallCount}.`)
}

function validateIncompleteReport(artifact: ProviderCorpusArtifact): void {
  const report = buildProviderCorpusReviewReport(artifact, {
    now: '2026-06-06T13:00:00.000Z',
    runtimeImportHits: ['src/app/AppShell.tsx'],
  })
  const codes = report.riskFlags.map((flag) => flag.code)
  assertRiskFlagsInclude(codes, [
    'missing_required_query',
    'low_venue_count',
    'insufficient_role_coverage',
    'missing_curate_starter_coverage',
    'missing_surprise_support',
    'missing_build_anchor_family_coverage',
    'missing_persona_vibe_scenario_coverage',
    'duplicate_provider_identity_issues',
    'billable_calls_above_expected',
    'runtime_import_not_allowed_violation',
    'dropped_venues_above_threshold',
  ])
  assert(report.gate1Readiness === 'blocked', `Expected blocked incomplete report, received ${report.gate1Readiness}.`)
  assert(report.goNoGoRecommendation === 'no_go', 'Expected no-go recommendation for incomplete report.')
}

function main(): void {
  globalThis.fetch = fetchTrap
  const healthyArtifact = buildMockArtifact()
  validateHealthyReport(healthyArtifact)
  validateIncompleteReport(buildIncompleteArtifact(healthyArtifact))
  const runtimeImportHits = findRuntimeReviewReportImports()
  assert(
    runtimeImportHits.length === 0,
    `Expected no runtime imports of providerCorpusReviewReport, found ${runtimeImportHits.join(', ')}`,
  )
  process.stdout.write('provider corpus review report mocked validation: passed\n')
  process.stdout.write(
    `${JSON.stringify(
      {
        fetchCallCount,
        healthyGate1Readiness: buildProviderCorpusReviewReport(healthyArtifact, {
          now: '2026-06-06T13:00:00.000Z',
          runtimeImportHits: [],
        }).gate1Readiness,
        healthyRiskFlagCount: buildProviderCorpusReviewReport(healthyArtifact, {
          now: '2026-06-06T13:00:00.000Z',
          runtimeImportHits: [],
        }).riskFlags.length,
        incompleteGate1Readiness: buildProviderCorpusReviewReport(
          buildIncompleteArtifact(healthyArtifact),
          {
            now: '2026-06-06T13:00:00.000Z',
            runtimeImportHits: ['src/app/AppShell.tsx'],
          },
        ).gate1Readiness,
        manifestQueryCount: healthyArtifact.manifestQueryCount,
        providerLedgerSummary: healthyArtifact.providerLedgerSummary,
        runtimeImportHits,
      },
      null,
      2,
    )}\n`,
  )
}

try {
  main()
} catch (error: unknown) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
} finally {
  globalThis.fetch = originalFetch
}
