import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  type ProviderCorpusArtifact,
  type ProviderCorpusArtifactVenue,
  validateProviderCorpusArtifact,
} from '../src/domain/providers/providerCorpusArtifact.ts'
import {
  providerCorpusManifest,
  type ProviderCorpusCategoryFamily,
  type ProviderCorpusManifestEntry,
} from '../src/domain/providers/providerCorpusManifest.ts'
import { createLiveGoogleVenueId } from '../src/domain/providers/admitLiveVenueIdentity.ts'
import type { ProviderCallLedger } from '../src/domain/providers/providerCallTrace.ts'
import type { ProviderVenue } from '../src/domain/providers/providerTypes.ts'
import { normalizeVenue } from '../src/domain/normalize/normalizeVenue.ts'
import type { RawPlace } from '../src/domain/types/rawPlace.ts'
import type { VenueCategory } from '../src/domain/types/venue.ts'

const outputDirectory = join(process.cwd(), 'tmp', 'provider-corpus-roundtrip')
const outputPath = join(outputDirectory, 'mock-provider-corpus-artifact.json')
const originalFetch = globalThis.fetch
let fetchCallCount = 0

const fetchTrap: typeof fetch = async () => {
  fetchCallCount += 1
  throw new Error('Provider corpus artifact round-trip test must not call fetch.')
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
    displayName: `Mock Roundtrip ${entry.label}`,
    fetchedAt: 1_778_000_000_000,
    formattedAddress: `300 ${entry.label} Way, San Jose, CA`,
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
    shortDescription: `${providerVenue.displayName} is a mocked artifact venue for ${entry.expectedCategoryFamily}.`,
    narrativeFlavor: `${providerVenue.displayName} exists only in the mocked writer/reader round-trip validator.`,
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

function buildMockLedger(): ProviderCallLedger {
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

function findRuntimeArtifactImportHits(): string[] {
  const srcRoot = join(process.cwd(), 'src')
  const artifactPath = join(srcRoot, 'domain', 'providers', 'providerCorpusArtifact.ts')
  return findSourceFiles(srcRoot)
    .filter((filePath) => filePath !== artifactPath)
    .filter((filePath) => readFileSync(filePath, 'utf8').includes('mock-provider-corpus-artifact'))
    .map((filePath) => relative(process.cwd(), filePath).replace(/\\/g, '/'))
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(value)
}

function validateRoundTrip(original: ProviderCorpusArtifact, loaded: ProviderCorpusArtifact): void {
  const validation = validateProviderCorpusArtifact(loaded)
  assert(validation.valid, `Round-trip artifact validation failed: ${validation.errors.join('; ')}`)
  assert(loaded.artifactVersion === original.artifactVersion, 'artifactVersion was not preserved.')
  assert(loaded.manifestQueryCount === original.manifestQueryCount, 'manifestQueryCount was not preserved.')
  assert(canonicalJson(loaded.queries) === canonicalJson(original.queries), 'query references were not preserved.')
  assert(
    canonicalJson(loaded.venues.map((venue) => venue.id)) ===
      canonicalJson(original.venues.map((venue) => venue.id)),
    'venue ids were not preserved.',
  )
  assert(canonicalJson(loaded.dedupeReport) === canonicalJson(original.dedupeReport), 'dedupeReport was not preserved.')
  assert(
    canonicalJson(loaded.coverageReport) === canonicalJson(original.coverageReport),
    'coverageReport was not preserved.',
  )
  assert(
    canonicalJson(loaded.providerLedgerSummary) === canonicalJson(original.providerLedgerSummary),
    'providerLedgerSummary was not preserved.',
  )
  assert(
    canonicalJson(loaded.freshnessPolicy) === canonicalJson(original.freshnessPolicy),
    'freshnessPolicy was not preserved.',
  )
  assert(loaded.runtimeImportAllowed === false, 'runtimeImportAllowed must remain false.')
  assert(loaded.providerLedgerSummary.totalAttempted === 0, 'Expected totalAttempted to remain 0.')
  assert(loaded.providerLedgerSummary.totalBillable === 0, 'Expected totalBillable to remain 0.')
  assert(
    loaded.providerLedgerSummary.totalAttemptedHttpRequests === 0,
    'Expected totalAttemptedHttpRequests to remain 0.',
  )
  assert(fetchCallCount === 0, `Expected fetch not to be called, received ${fetchCallCount}.`)
  const runtimeImportHits = findRuntimeArtifactImportHits()
  assert(
    runtimeImportHits.length === 0,
    `Expected no runtime src imports of generated artifact, found ${runtimeImportHits.join(', ')}`,
  )
}

function cleanupOutput(): void {
  rmSync(outputDirectory, {
    force: true,
    recursive: true,
  })
}

function main(): void {
  globalThis.fetch = fetchTrap
  cleanupOutput()
  mkdirSync(outputDirectory, { recursive: true })
  const artifact = buildMockArtifact()
  writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
  const loaded = JSON.parse(readFileSync(outputPath, 'utf8')) as ProviderCorpusArtifact
  validateRoundTrip(artifact, loaded)
  cleanupOutput()
  process.stdout.write('provider corpus artifact writer/reader round-trip: passed\n')
  process.stdout.write(
    `${JSON.stringify(
      {
        artifactVersion: loaded.artifactVersion,
        dedupeDuplicateProviderRecordIds: loaded.dedupeReport.duplicateProviderRecordIds,
        fetchCallCount,
        manifestQueryCount: loaded.manifestQueryCount,
        outputPath: relative(process.cwd(), outputPath).replace(/\\/g, '/'),
        providerLedgerSummary: loaded.providerLedgerSummary,
        runtimeImportAllowed: loaded.runtimeImportAllowed,
        runtimeImportHits: findRuntimeArtifactImportHits(),
        temporaryOutputRemoved: !statSyncSafe(outputPath),
        venueCount: loaded.venues.length,
      },
      null,
      2,
    )}\n`,
  )
}

function statSyncSafe(pathname: string): boolean {
  try {
    statSync(pathname)
    return true
  } catch {
    return false
  }
}

try {
  main()
} catch (error: unknown) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
  cleanupOutput()
} finally {
  globalThis.fetch = originalFetch
}
