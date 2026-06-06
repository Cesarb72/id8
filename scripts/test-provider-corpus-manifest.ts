import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  providerCorpusGate1StarterIds,
  providerCorpusManifest,
  providerCorpusRequiredBuildAnchorFamilies,
  providerCorpusScenarioFamilies,
  type ProviderCorpusCategoryFamily,
  type ProviderCorpusManifestEntry,
  type ProviderCorpusRole,
} from '../src/domain/providers/providerCorpusManifest.ts'
import { createLiveGoogleVenueId } from '../src/domain/providers/admitLiveVenueIdentity.ts'
import type { ProviderVenue } from '../src/domain/providers/providerTypes.ts'
import { normalizeVenue } from '../src/domain/normalize/normalizeVenue.ts'
import type { RawPlace } from '../src/domain/types/rawPlace.ts'
import type { Venue, VenueCategory } from '../src/domain/types/venue.ts'

interface MockCorpusRecord {
  entry: ProviderCorpusManifestEntry
  providerVenue: ProviderVenue
  rawPlace: RawPlace
  venue: Venue
}

interface CorpusCompilerDiagnostics {
  buildAnchorFamilies: string[]
  categoryFamilies: string[]
  duplicateProviderRecordIds: string[]
  fetchCallCount: number
  gate1RequiredQueryCount: number
  manifestQueryCount: number
  providerOnlyIdentityFailures: string[]
  roles: string[]
  runtimeImportHits: string[]
  scenarioFamilies: string[]
  starters: string[]
  surpriseHighlightCategoryFamilies: string[]
  uniqueProviderRecordCount: number
}

const originalFetch = globalThis.fetch
let fetchCallCount = 0

const fetchTrap: typeof fetch = async () => {
  fetchCallCount += 1
  throw new Error('Provider corpus manifest test must not call fetch.')
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
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
  if (category === 'live_music') {
    return 'live_music_venue'
  }
  if (category === 'activity') {
    return 'amusement_center'
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
  if (category === 'bar' || category === 'restaurant') {
    return '$$'
  }
  return '$'
}

function buildProviderRecordId(entry: ProviderCorpusManifestEntry): string {
  if (entry.label === 'ice-cream-gelato') {
    return 'mock_sj_dessert_shared'
  }
  if (entry.label === 'dessert-late-night') {
    return 'mock_sj_dessert_shared'
  }
  return `mock_sj_${entry.label.replace(/[^a-z0-9]+/g, '_')}`
}

function buildMockProviderVenue(entry: ProviderCorpusManifestEntry): ProviderVenue {
  const category = categoryForFamily(entry.expectedCategoryFamily)
  const providerRecordId = buildProviderRecordId(entry)
  const latitude = 37.333 + providerCorpusManifest.entries.indexOf(entry) * 0.004
  const longitude = -121.89 + providerCorpusManifest.entries.indexOf(entry) * 0.003
  const primaryType = primaryTypeForCategory(category)
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
    displayName: `Mock ${entry.label}`,
    fetchedAt: 1_778_000_000_000,
    formattedAddress: `100 ${entry.label} Way, San Jose, CA`,
    location: {
      latitude: Number(latitude.toFixed(5)),
      longitude: Number(longitude.toFixed(5)),
    },
    primaryType,
    provider: 'google_places',
    providerRecordId,
    rating: 4.5,
    rawPayloadAvailable: false,
    regularOpeningHours: {
      weekdayDescriptions: ['Monday: 10:00 AM - 10:00 PM'],
    },
    shortFormattedAddress: 'San Jose, CA',
    sourceMode: 'live',
    types: uniqueSorted([primaryType, category, entry.expectedCategoryFamily]),
    userRatingCount: 128,
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
    shortDescription: `${providerVenue.displayName} is a mocked corpus candidate for ${entry.expectedCategoryFamily}.`,
    narrativeFlavor: `${providerVenue.displayName} is available only inside the mocked corpus compiler.`,
    imageUrl: '',
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

function compileMockCorpus(): MockCorpusRecord[] {
  return providerCorpusManifest.entries.map((entry) => {
    const providerVenue = buildMockProviderVenue(entry)
    const rawPlace = buildRawPlace(entry, providerVenue)
    return {
      entry,
      providerVenue,
      rawPlace,
      venue: normalizeVenue(rawPlace),
    }
  })
}

function collectDuplicates(records: MockCorpusRecord[]): string[] {
  const counts = new Map<string, number>()
  for (const record of records) {
    counts.set(
      record.providerVenue.providerRecordId,
      (counts.get(record.providerVenue.providerRecordId) ?? 0) + 1,
    )
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([providerRecordId]) => providerRecordId)
    .sort((left, right) => left.localeCompare(right))
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

function findRuntimeManifestImports(): string[] {
  const srcRoot = join(process.cwd(), 'src')
  const manifestPath = join(srcRoot, 'domain', 'providers', 'providerCorpusManifest.ts')
  const offlineSchemaPaths = new Set([
    manifestPath,
    join(srcRoot, 'domain', 'providers', 'providerCorpusArtifact.ts'),
    join(srcRoot, 'domain', 'providers', 'providerCorpusReviewReport.ts'),
  ])
  return findSourceFiles(srcRoot)
    .filter((filePath) => !offlineSchemaPaths.has(filePath))
    .filter((filePath) => readFileSync(filePath, 'utf8').includes('providerCorpusManifest'))
    .map((filePath) => relative(process.cwd(), filePath).replace(/\\/g, '/'))
}

function buildDiagnostics(records: MockCorpusRecord[]): CorpusCompilerDiagnostics {
  const roles = uniqueSorted(
    providerCorpusManifest.entries.flatMap((entry) => entry.expectedRoles),
  )
  const starters = uniqueSorted(
    providerCorpusManifest.entries.flatMap((entry) => entry.supportedStarters),
  )
  const scenarioFamilies = uniqueSorted(
    providerCorpusManifest.entries.flatMap((entry) => entry.supportedScenarioFamilies),
  )
  const buildAnchorFamilies = uniqueSorted(
    providerCorpusManifest.entries.flatMap((entry) => entry.supportedBuildAnchorFamilies),
  )
  const categoryFamilies = uniqueSorted(
    providerCorpusManifest.entries.map((entry) => entry.expectedCategoryFamily),
  )
  const surpriseHighlightCategoryFamilies = uniqueSorted(
    providerCorpusManifest.entries
      .filter((entry) => entry.surpriseHighlightSupport)
      .map((entry) => entry.expectedCategoryFamily),
  )
  const duplicateProviderRecordIds = collectDuplicates(records)
  const uniqueProviderRecordCount = new Set(
    records.map((record) => record.providerVenue.providerRecordId),
  ).size
  const providerOnlyIdentityFailures = records
    .filter((record) => !record.rawPlace.id.startsWith('live_google_'))
    .map((record) => record.rawPlace.id)

  return {
    buildAnchorFamilies,
    categoryFamilies,
    duplicateProviderRecordIds,
    fetchCallCount,
    gate1RequiredQueryCount: providerCorpusManifest.entries.filter((entry) => entry.gate1Required)
      .length,
    manifestQueryCount: providerCorpusManifest.entries.length,
    providerOnlyIdentityFailures,
    roles,
    runtimeImportHits: findRuntimeManifestImports(),
    scenarioFamilies,
    starters,
    surpriseHighlightCategoryFamilies,
    uniqueProviderRecordCount,
  }
}

function assertIncludesAll(label: string, actual: string[], expected: string[]): void {
  const missing = expected.filter((value) => !actual.includes(value))
  assert(missing.length === 0, `${label}: missing ${missing.join(', ')}`)
}

function validateManifest(records: MockCorpusRecord[], diagnostics: CorpusCompilerDiagnostics): void {
  assert(
    providerCorpusManifest.entries.length === providerCorpusManifest.expectedQueryCount,
    `Expected ${providerCorpusManifest.expectedQueryCount} manifest entries, received ${providerCorpusManifest.entries.length}.`,
  )
  assert(diagnostics.manifestQueryCount === 12, 'Expected exactly 12 corpus retrieval queries.')
  assert(diagnostics.gate1RequiredQueryCount === 12, 'Expected all 12 queries to be Gate 1 required.')
  assert(
    providerCorpusManifest.entries.every((entry) => entry.purpose === 'retrieval_supply'),
    'Expected every corpus query to use retrieval_supply.',
  )
  assert(
    providerCorpusManifest.entries.every((entry) => entry.maxCenters === 1 && entry.maxCalls === 1),
    'Expected each Gate 1 corpus query to declare maxCenters=1 and maxCalls=1.',
  )
  assertIncludesAll('Curate starter coverage', diagnostics.starters, providerCorpusGate1StarterIds)
  assertIncludesAll('Persona/vibe scenario coverage', diagnostics.scenarioFamilies, providerCorpusScenarioFamilies)
  assertIncludesAll(
    'Build anchor family coverage',
    diagnostics.buildAnchorFamilies,
    providerCorpusRequiredBuildAnchorFamilies,
  )
  assertIncludesAll('Role coverage', diagnostics.roles, [
    'highlight',
    'start',
    'support',
    'windDown',
  ] satisfies ProviderCorpusRole[])
  assert(
    diagnostics.categoryFamilies.length === 12,
    `Expected 12 category families, received ${diagnostics.categoryFamilies.length}.`,
  )
  assert(
    diagnostics.surpriseHighlightCategoryFamilies.length >= 6,
    `Expected at least 6 Surprise highlight families, received ${diagnostics.surpriseHighlightCategoryFamilies.length}.`,
  )
  assert(
    diagnostics.duplicateProviderRecordIds.length === 1 &&
      diagnostics.duplicateProviderRecordIds[0] === 'mock_sj_dessert_shared',
    `Expected one mocked duplicate provider id, received ${diagnostics.duplicateProviderRecordIds.join(', ') || 'none'}.`,
  )
  assert(
    diagnostics.uniqueProviderRecordCount === records.length - 1,
    `Expected dedupe to remove one duplicate provider id, unique=${diagnostics.uniqueProviderRecordCount}, total=${records.length}.`,
  )
  assert(
    diagnostics.providerOnlyIdentityFailures.length === 0,
    `Expected all provider-only ids to use live_google_<providerRecordId>, failures=${diagnostics.providerOnlyIdentityFailures.join(', ')}`,
  )
  assert(
    diagnostics.runtimeImportHits.length === 0,
    `Expected no hosted/runtime imports of providerCorpusManifest, found ${diagnostics.runtimeImportHits.join(', ')}`,
  )
  assert(fetchCallCount === 0, `Expected fetch not to be called, received ${fetchCallCount}.`)

  for (const record of records) {
    assert(record.rawPlace.rawType === 'place', `${record.entry.label}: expected RawPlace.`)
    assert(record.rawPlace.sourceOrigin === 'live', `${record.entry.label}: expected live sourceOrigin.`)
    assert(record.rawPlace.provider === 'google-places', `${record.entry.label}: expected google-places provider.`)
    assert(
      record.rawPlace.providerRecordId === record.providerVenue.providerRecordId,
      `${record.entry.label}: expected raw provider id to match mocked provider id.`,
    )
    assert(
      record.venue.source.providerRecordId === record.providerVenue.providerRecordId,
      `${record.entry.label}: expected normalized venue provider id to match mocked provider id.`,
    )
    assert(
      typeof record.venue.source.latitude === 'number' &&
        typeof record.venue.source.longitude === 'number',
      `${record.entry.label}: expected normalized venue coordinates.`,
    )
  }
}

function main(): void {
  globalThis.fetch = fetchTrap
  const records = compileMockCorpus()
  const diagnostics = buildDiagnostics(records)
  validateManifest(records, diagnostics)
  process.stdout.write('provider corpus manifest mocked compiler: passed\n')
  process.stdout.write(`${JSON.stringify(diagnostics, null, 2)}\n`)
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
