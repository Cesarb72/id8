import { normalizeVenue } from '../src/domain/normalize/normalizeVenue.ts'
import type { QualityGateContext, QualityGateStatus } from '../src/domain/types/normalization.ts'
import type { RawPlace } from '../src/domain/types/rawPlace.ts'
import type { VenueCategory } from '../src/domain/types/venue.ts'

const originalFetch = globalThis.fetch
let fetchCallCount = 0

const offlineTimeSensitiveReason =
  'offline_corpus_time_sensitive_requires_runtime_hours_validation'

const fetchTrap: typeof fetch = async () => {
  fetchCallCount += 1
  throw new Error('Provider corpus quality gate calibration test must not call fetch.')
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function buildStrongProviderPlace(input: {
  businessStatus?: string
  category: VenueCategory
  name: string
  openNow?: boolean
  placeTypes: string[]
  providerRecordId: string
  sourceConfidence?: number
}): RawPlace {
  return {
    rawType: 'place',
    id: `live_google_${input.providerRecordId}`,
    name: input.name,
    city: 'San Jose',
    neighborhood: 'Downtown',
    driveMinutes: 8,
    priceTier: '$$',
    tags: [
      input.category === 'bar' ? 'cocktail' : input.category,
      'highlight',
      'support',
      input.category === 'bar' ? 'windDown' : 'live_music',
    ],
    shortDescription: `${input.name} is a strong provider corpus calibration candidate.`,
    narrativeFlavor: `${input.name} preserves provider identity for offline corpus review.`,
    categoryHint: input.category,
    subcategoryHint: input.placeTypes[0] ?? input.category,
    placeTypes: input.placeTypes,
    sourceTypes: input.placeTypes,
    normalizedFromRawType: 'raw-place',
    sourceOrigin: 'live',
    provider: 'google-places',
    providerRecordId: input.providerRecordId,
    sourceQueryLabel: 'quality-gate-calibration',
    sourceConfidence: input.sourceConfidence ?? 0.86,
    formattedAddress: `100 ${input.name} Way, San Jose, CA`,
    rating: 4.6,
    ratingCount: 500,
    openNow: input.openNow,
    businessStatus: input.businessStatus ?? 'OPERATIONAL',
    currentOpeningHoursText: ['Monday: 5:00 PM - 12:00 AM'],
    regularOpeningHoursText: ['Monday: 5:00 PM - 12:00 AM'],
    latitude: 37.33,
    longitude: -121.89,
  }
}

function normalizeStatus(raw: RawPlace, context?: QualityGateContext): QualityGateStatus {
  return normalizeVenue(raw, context ? { qualityGateContext: context } : {}).source.qualityGateStatus
}

function assertStatus(
  label: string,
  raw: RawPlace,
  expected: QualityGateStatus,
  context?: QualityGateContext,
): void {
  const actual = normalizeStatus(raw, context)
  assert(actual === expected, `${label}: expected ${expected}, received ${actual}`)
}

function main(): void {
  globalThis.fetch = fetchTrap

  const paperPlaneLike = buildStrongProviderPlace({
    category: 'bar',
    name: 'Paper Plane Calibration',
    openNow: false,
    placeTypes: ['cocktail_bar', 'bar', 'restaurant', 'point_of_interest', 'establishment'],
    providerRecordId: 'calibration_paper_plane',
  })
  assertStatus('default closed cocktail venue', paperPlaneLike, 'suppressed')
  const offlinePaperPlane = normalizeVenue(paperPlaneLike, {
    qualityGateContext: 'offline-provider-corpus',
  })
  assert(
    offlinePaperPlane.source.qualityGateStatus === 'demoted',
    `offline closed cocktail venue: expected demoted, received ${offlinePaperPlane.source.qualityGateStatus}`,
  )
  assert(
    offlinePaperPlane.source.demotionReasons.includes(offlineTimeSensitiveReason),
    'offline closed cocktail venue must include machine-readable time-sensitive demotion reason.',
  )
  assert(
    offlinePaperPlane.source.hoursDemotionApplied,
    'offline closed cocktail venue must preserve hours demotion pressure.',
  )
  assert(
    !offlinePaperPlane.source.hoursSuppressionApplied,
    'offline closed cocktail venue must not preserve hours suppression pressure after conversion.',
  )

  const ritzLike = buildStrongProviderPlace({
    category: 'live_music',
    name: 'Ritz Calibration',
    openNow: false,
    placeTypes: ['night_club', 'event_venue', 'bar', 'live_music_venue', 'point_of_interest'],
    providerRecordId: 'calibration_ritz',
  })
  assertStatus('default closed live music venue', ritzLike, 'suppressed')
  const offlineRitz = normalizeVenue(ritzLike, {
    qualityGateContext: 'offline-provider-corpus',
  })
  assert(
    offlineRitz.source.qualityGateStatus === 'demoted',
    `offline closed live music venue: expected demoted, received ${offlineRitz.source.qualityGateStatus}`,
  )
  assert(
    !offlineRitz.source.suppressionReasons.includes('unsupported category for live place ingestion'),
    'offline closed live music venue must not be suppressed solely for live_music category.',
  )

  const sjzLike = buildStrongProviderPlace({
    category: 'live_music',
    name: 'SJZ Break Room Calibration',
    openNow: undefined,
    placeTypes: ['live_music_venue', 'event_venue', 'point_of_interest'],
    providerRecordId: 'calibration_sjz',
  })
  assertStatus('default unknown-hours live music venue', sjzLike, 'suppressed')
  const offlineSjz = normalizeVenue(sjzLike, {
    qualityGateContext: 'offline-provider-corpus',
  })
  assert(
    offlineSjz.source.qualityGateStatus !== 'suppressed',
    `offline unknown-hours live music venue: expected eligible tier, received ${offlineSjz.source.qualityGateStatus}`,
  )
  assert(
    !offlineSjz.source.suppressionReasons.includes('unsupported category for live place ingestion'),
    'offline unknown-hours live music venue must not be suppressed solely for live_music category.',
  )

  const lowConfidenceVenue = buildStrongProviderPlace({
    category: 'live_music',
    name: 'Low Confidence Calibration',
    openNow: undefined,
    placeTypes: ['live_music_venue', 'event_venue'],
    providerRecordId: 'calibration_low_confidence',
    sourceConfidence: 0.3,
  })
  assertStatus(
    'offline low-confidence live music venue',
    lowConfidenceVenue,
    'suppressed',
    'offline-provider-corpus',
  )

  const incompleteVenue: RawPlace = {
    ...buildStrongProviderPlace({
      category: 'live_music',
      name: 'Incomplete Calibration',
      openNow: undefined,
      placeTypes: ['live_music_venue', 'event_venue'],
      providerRecordId: 'calibration_incomplete',
    }),
    city: undefined,
    neighborhood: undefined,
    driveMinutes: undefined,
    shortDescription: undefined,
    narrativeFlavor: undefined,
  }
  assertStatus(
    'offline incomplete live music venue',
    incompleteVenue,
    'suppressed',
    'offline-provider-corpus',
  )

  const permanentlyClosedVenue = buildStrongProviderPlace({
    businessStatus: 'CLOSED_PERMANENTLY',
    category: 'bar',
    name: 'Permanently Closed Calibration',
    openNow: false,
    placeTypes: ['cocktail_bar', 'bar'],
    providerRecordId: 'calibration_closed_permanently',
  })
  assertStatus(
    'offline permanently closed provider venue',
    permanentlyClosedVenue,
    'suppressed',
    'offline-provider-corpus',
  )

  assert(fetchCallCount === 0, `Expected fetch not to be called, received ${fetchCallCount}.`)
  process.stdout.write('provider corpus quality gate calibration: passed\n')
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
