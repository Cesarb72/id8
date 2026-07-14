import { loadFieldSourceVenues } from '../src/domain/field/loadFieldSourceVenues'
import { haversineDistanceM } from '../src/domain/shared/geo/geoDistance'
import { fetchPlaceEntities } from '../src/engines/district/entities/fetchPlaceEntities'
import { admitDistrictEntities } from '../src/engines/district/entities/admitDistrictEntities'
import type {
  FetchPlaceEntitiesInput,
  FetchPlaceEntitiesResult,
  PlaceEntity,
  ResolvedLocation,
} from '../src/engines/district/types/districtTypes'

const DEFAULT_MAX_ENTITIES = 120
const MIN_MAX_ENTITIES = 20
const MAX_MAX_ENTITIES = 500

let fieldProxyHits = 0
let browserProviderHits = 0
let lceProviderHits = 0
let unexpectedFetchHits = 0

const originalFetch = globalThis.fetch

globalThis.fetch = (async (input) => {
  const url = String(input)
  if (url.includes('/api/field/text-search')) {
    fieldProxyHits += 1
    throw new Error('Field source-packet parity must not call /api/field/text-search.')
  }
  if (url.includes('places.googleapis.com')) {
    browserProviderHits += 1
    throw new Error('Field source-packet parity must not call the browser provider.')
  }
  if (url.includes('/api/nearby') || url.includes('waypoint_nearby')) {
    lceProviderHits += 1
    throw new Error('Field source-packet parity must not call LCE/Waypoint nearby provider paths.')
  }
  unexpectedFetchHits += 1
  throw new Error(`Unexpected fetch during Field source-packet parity: ${url}`)
}) as typeof fetch

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function uniqueById(entities: PlaceEntity[]): PlaceEntity[] {
  const seen = new Set<string>()
  const deduped: PlaceEntity[] = []
  for (const entity of entities) {
    if (seen.has(entity.id)) {
      continue
    }
    seen.add(entity.id)
    deduped.push(entity)
  }
  return deduped
}

function countBlockedStatuses(
  blocked: FetchPlaceEntitiesResult['blockedEntities'],
): FetchPlaceEntitiesResult['retrieval']['blockedStatusCounts'] {
  return blocked.reduce<FetchPlaceEntitiesResult['retrieval']['blockedStatusCounts']>(
    (counts, entry) => {
      counts[entry.admissionStatus] = (counts[entry.admissionStatus] ?? 0) + 1
      return counts
    },
    {},
  )
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  const actualJson = JSON.stringify(actual)
  const expectedJson = JSON.stringify(expected)
  assert(actualJson === expectedJson, `${message}\nactual=${actualJson}\nexpected=${expectedJson}`)
}

function buildResolvedLocation(city: string): ResolvedLocation {
  return {
    query: city,
    normalizedQuery: city.trim().toLowerCase(),
    displayLabel: city,
    center: { lat: 37.3382, lng: -121.8863 },
    radiusM: 5000,
    confidence: 'high',
    source: 'query_lookup',
    meta: {
      city,
      geocoder: 'field-source-packet-parity',
      resolvedAtIso: '2026-07-12T00:00:00.000Z',
    },
  }
}

async function projectFetchPlaceEntitiesCompatibility(
  input: FetchPlaceEntitiesInput,
): Promise<{
  blockedCount: number
  blockedStatusCounts: FetchPlaceEntitiesResult['retrieval']['blockedStatusCounts']
  entityIds: string[]
  admittedEntityIds: string[]
  selectedCount: number
}> {
  const fieldSources = await loadFieldSourceVenues({
    city: input.resolvedLocation.meta.city,
  })
  const admission = admitDistrictEntities(fieldSources.sourceVenues)
  const normalized = uniqueById(admission.admitted.map((entry) => entry.entity))
  const maxEntities = clamp(
    input.maxEntities ?? DEFAULT_MAX_ENTITIES,
    MIN_MAX_ENTITIES,
    MAX_MAX_ENTITIES,
  )
  const searchRadiusM = input.searchRadiusM ?? input.resolvedLocation.radiusM

  const withDistance = normalized
    .map((entity) => ({
      entity,
      distanceM: haversineDistanceM(entity.location, input.resolvedLocation.center),
    }))
    .sort((left, right) => {
      if (left.distanceM !== right.distanceM) {
        return left.distanceM - right.distanceM
      }
      const leftPopularity = left.entity.signals?.popularity ?? 0
      const rightPopularity = right.entity.signals?.popularity ?? 0
      return rightPopularity - leftPopularity
    })

  const inRadius = withDistance.filter((item) => item.distanceM <= searchRadiusM)
  const selected =
    inRadius.length >= 3
      ? inRadius.slice(0, maxEntities)
      : withDistance.slice(0, Math.min(maxEntities, withDistance.length))
  const selectedEntityIds = new Set(selected.map((item) => item.entity.id))
  const admittedEntities = admission.admitted.filter((entry) =>
    selectedEntityIds.has(entry.entity.id),
  )

  return {
    blockedCount: admission.blocked.length,
    blockedStatusCounts: countBlockedStatuses(admission.blocked),
    entityIds: selected.map((item) => item.entity.id),
    admittedEntityIds: admittedEntities.map((entry) => entry.entity.id),
    selectedCount: selected.length,
  }
}

async function assertCuratedSourceLoading(): Promise<void> {
  const sanJose = await loadFieldSourceVenues({ city: 'San Jose' })
  const normalizedVariant = await loadFieldSourceVenues({ city: ' San Jose, CA ' })

  assert(sanJose.cityHint === 'san jose', 'San Jose city hint must normalize to san jose.')
  assert(
    normalizedVariant.cityHint === sanJose.cityHint,
    'City normalization must ignore surrounding whitespace and comma suffixes.',
  )
  assert(sanJose.hasCuratedCoverage, 'San Jose must keep curated coverage.')
  assert(sanJose.curatedCityVenues.length === 72, 'San Jose curated source count changed.')
  assert(sanJose.sourceVenues.length === 72, 'San Jose source venue count changed.')
  assert(!sanJose.hybridDiagnostics, 'San Jose curated path must not emit hybrid diagnostics.')
  assertEqual(
    normalizedVariant.sourceVenues.map((venue) => venue.id),
    sanJose.sourceVenues.map((venue) => venue.id),
    'Normalized San Jose source venue IDs must match canonical San Jose source IDs.',
  )
}

async function assertHybridClosedEnvelope(): Promise<void> {
  const boise = await loadFieldSourceVenues({ city: 'Boise' })
  const diagnostics = boise.hybridDiagnostics

  assert(boise.cityHint === 'boise', 'Uncovered city hint must normalize.')
  assert(boise.curatedCityVenues.length === 0, 'Boise fixture must remain uncovered by curated corpus.')
  assert(!boise.hasCuratedCoverage, 'Uncovered city must not report curated coverage.')
  assert(diagnostics?.mode === 'hybrid_bootstrap', 'Closed-envelope hybrid path must use bootstrap.')
  assert(diagnostics.liveAttempted === false, 'Closed-envelope hybrid path must not attempt live retrieval.')
  assert(diagnostics.liveRawFetched === 0, 'Closed-envelope hybrid path must fetch zero live records.')
  assert(diagnostics.liveAccepted === 0, 'Closed-envelope hybrid path must accept zero live records.')
  assert(diagnostics.bootstrapCount === 20, 'Closed-envelope bootstrap count changed.')
  assert(diagnostics.selectedCount === 20, 'Closed-envelope selected source count changed.')
  assert(boise.sourceVenues.length === 20, 'Closed-envelope source venue count changed.')
}

async function assertFetchPlaceEntitiesCompatibility(): Promise<void> {
  const input: FetchPlaceEntitiesInput = {
    resolvedLocation: buildResolvedLocation('San Jose'),
    maxEntities: 40,
  }
  const actual = await fetchPlaceEntities(input)
  const expected = await projectFetchPlaceEntitiesCompatibility(input)

  assert(actual.retrieval.mode === 'curated', 'San Jose entity retrieval mode changed.')
  assert(actual.retrieval.curatedCount === 72, 'San Jose entity retrieval curated count changed.')
  assert(actual.retrieval.selectedCount === expected.selectedCount, 'Selected count changed.')
  assert(actual.retrieval.admittedCount === expected.admittedEntityIds.length, 'Admitted count changed.')
  assert(actual.retrieval.blockedCount === expected.blockedCount, 'Blocked count changed.')
  assertEqual(
    actual.retrieval.blockedStatusCounts,
    expected.blockedStatusCounts,
    'Blocked status diagnostics changed.',
  )
  assertEqual(
    actual.entities.map((entity) => entity.id),
    expected.entityIds,
    'Selected entity IDs/order changed.',
  )
  assertEqual(
    actual.admittedEntities.map((entry) => entry.entity.id),
    expected.admittedEntityIds,
    'Admitted entity compatibility projection changed.',
  )
  assert(actual.blockedEntities.length === 0, 'Curated San Jose path must not block source entities.')
}

async function main(): Promise<void> {
  try {
    await assertCuratedSourceLoading()
    await assertHybridClosedEnvelope()
    await assertFetchPlaceEntitiesCompatibility()

    assert(fieldProxyHits === 0, 'Field proxy hit count must remain zero.')
    assert(browserProviderHits === 0, 'Browser provider hit count must remain zero.')
    assert(lceProviderHits === 0, 'LCE provider hit count must remain zero.')
    assert(unexpectedFetchHits === 0, 'No fetch calls are expected in source-packet parity.')

    process.stdout.write(
      `${JSON.stringify(
        {
          curated: {
            cityHint: 'san jose',
            sourceVenueCount: 72,
          },
          hybridClosedEnvelope: {
            mode: 'hybrid_bootstrap',
            liveAttempted: false,
            sourceVenueCount: 20,
          },
          fetchPlaceEntitiesCompatibility: {
            mode: 'curated',
            sourceVenueCount: 72,
            selectedCount: 40,
            blockedCount: 0,
          },
          providerSafety: {
            fieldProxyHits,
            browserProviderHits,
            lceProviderHits,
            unexpectedFetchHits,
          },
        },
        null,
        2,
      )}\n`,
    )
    process.stdout.write('field source-packet parity: passed\n')
  } finally {
    globalThis.fetch = originalFetch
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
