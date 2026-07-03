import { curatedVenues } from '../src/data/venues.ts'
import { providerCanonicalVenueSeeds } from '../src/domain/providers/providerCanonicalVenueSeeds.ts'

type Phase4BuildAnchor = {
  canonicalVenueId: string
  displayName: string
  expectedAddress?: string
  expectedLatitude?: number
  expectedLongitude?: number
  expectedProviderRecordId: string
}

const phase4BuildAnchors: Phase4BuildAnchor[] = [
  {
    canonicalVenueId: 'sj-haberdasher',
    displayName: 'Haberdasher',
    expectedAddress: '43 W San Salvador St, San Jose, CA 95113, USA',
    expectedLatitude: 37.32991507979461,
    expectedLongitude: -121.88654414825072,
    expectedProviderRecordId: 'ChIJkV6TlrDMj4ARIPxsqSMrdr4',
  },
  {
    canonicalVenueId: 'sj-paper-plane',
    displayName: 'Paper Plane',
    expectedProviderRecordId: 'ChIJ2XdOpLzMj4ARkdRQg4ZRVTY',
  },
  {
    canonicalVenueId: 'sj-tech-interactive',
    displayName: 'The Tech Interactive',
    expectedAddress: '201 S Market St, San Jose, CA 95113, USA',
    expectedLatitude: 37.33150162687056,
    expectedLongitude: -121.8902328140428,
    expectedProviderRecordId: 'ChIJR8HI1brMj4ARBnFq5rlvpx4',
  },
  {
    canonicalVenueId: 'sj-adega-wine-atelier',
    displayName: 'Adega',
    expectedAddress: '1614 Alum Rock Ave, San Jose, CA 95116, USA',
    expectedLatitude: 37.351766378228994,
    expectedLongitude: -121.85844716899318,
    expectedProviderRecordId: 'ChIJC797reHMj4ARSaQDCMuHWSQ',
  },
  {
    canonicalVenueId: 'sj-miniboss',
    displayName: 'MINIBOSS',
    expectedAddress: '52 E Santa Clara St, San Jose, CA 95113, USA',
    expectedLatitude: 37.336808400082525,
    expectedLongitude: -121.8893379180668,
    expectedProviderRecordId: 'ChIJ399WwE7Nj4ARngCc39Ai0Hw',
  },
  {
    canonicalVenueId: 'sj-happy-hollow',
    displayName: 'Happy Hollow Park & Zoo',
    expectedAddress: '748 Story Rd, San Jose, CA 95112, USA',
    expectedLatitude: 37.32626737055341,
    expectedLongitude: -121.86086606899416,
    expectedProviderRecordId: 'ChIJ36tnEywzjoARhS4v9dlu5EU',
  },
  {
    canonicalVenueId: 'sj-evergreen-coffee-company',
    displayName: 'Evergreen Coffee Company',
    expectedAddress: '4075 Evergreen Village Square #150, San Jose, CA 95135, USA',
    expectedLatitude: 37.315445420756696,
    expectedLongitude: -121.77378393177693,
    expectedProviderRecordId: 'ChIJsSB7paktjoARICgN717BTP4',
  },
  {
    canonicalVenueId: 'sj-village-grill',
    displayName: 'Village Grill',
    expectedAddress: '4075 Evergreen Village Square #120, San Jose, CA 95135, USA',
    expectedLatitude: 37.31438909671919,
    expectedLongitude: -121.77320854504963,
    expectedProviderRecordId: 'ChIJsSB7paktjoARQkvhs1bkjTI',
  },
  {
    canonicalVenueId: 'sj-alum-rock-park',
    displayName: 'Alum Rock Park',
    expectedAddress: '15350 Penitencia Creek Rd, San Jose, CA 95127, USA',
    expectedLatitude: 37.395578945098094,
    expectedLongitude: -121.82526828737421,
    expectedProviderRecordId: 'ChIJ-ZogKrvMj4ARKrML-5D1a88',
  },
]

const originalFetch = globalThis.fetch
const fetchAttempts: string[] = []

globalThis.fetch = (async (input) => {
  fetchAttempts.push(String(input))
  throw new Error('Phase 4 Build anchor readiness test must not call fetch.')
}) as typeof fetch

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function sameCoordinate(actual: number | undefined, expected: number): boolean {
  return isFiniteNumber(actual) && Math.abs(actual - expected) < 0.000000000001
}

function preFetchBlockedReason(input: {
  canonicalVenueId: string | null
  providerRecordFound: boolean
  coordinatesMissing: boolean
}): string | null {
  if (!input.canonicalVenueId) {
    return 'anchor_canonical_identity_missing'
  }
  if (!input.providerRecordFound) {
    return 'anchor_provider_record_missing'
  }
  if (input.coordinatesMissing) {
    return 'anchor_coordinates_missing'
  }
  return null
}

try {
  for (const anchor of phase4BuildAnchors) {
    const matches = curatedVenues.filter((venue) => venue.id === anchor.canonicalVenueId)
    assert(
      matches.length === 1,
      `${anchor.canonicalVenueId}: expected exactly one static venue, found ${matches.length}.`,
    )

    const venue = matches[0]!
    assert(
      venue.name === anchor.displayName,
      `${anchor.canonicalVenueId}: expected display name "${anchor.displayName}", received "${venue.name}".`,
    )

    if (anchor.expectedAddress) {
      assert(
        venue.source.formattedAddress === anchor.expectedAddress,
        `${anchor.canonicalVenueId}: expected address "${anchor.expectedAddress}", received "${venue.source.formattedAddress ?? 'none'}".`,
      )
    }

    if (anchor.expectedLatitude !== undefined) {
      assert(
        sameCoordinate(venue.source.latitude, anchor.expectedLatitude),
        `${anchor.canonicalVenueId}: expected latitude ${anchor.expectedLatitude}, received ${venue.source.latitude ?? 'none'}.`,
      )
    }

    if (anchor.expectedLongitude !== undefined) {
      assert(
        sameCoordinate(venue.source.longitude, anchor.expectedLongitude),
        `${anchor.canonicalVenueId}: expected longitude ${anchor.expectedLongitude}, received ${venue.source.longitude ?? 'none'}.`,
      )
    }

    const coordinatesMissing = !(
      isFiniteNumber(venue.source.latitude) && isFiniteNumber(venue.source.longitude)
    )
    assert(!coordinatesMissing, `${anchor.canonicalVenueId}: coordinatesMissing must be false.`)

    const seeds = providerCanonicalVenueSeeds.filter(
      (seed) => seed.provider === 'google-places' && seed.canonicalVenueId === anchor.canonicalVenueId,
    )
    assert(
      seeds.length === 1,
      `${anchor.canonicalVenueId}: expected exactly one provider seed, found ${seeds.length}.`,
    )

    const seed = seeds[0]!
    assert(
      seed.providerRecordId === anchor.expectedProviderRecordId,
      `${anchor.canonicalVenueId}: expected providerRecordId "${anchor.expectedProviderRecordId}", received "${seed.providerRecordId}".`,
    )
    assert(seed.confidence === 1, `${anchor.canonicalVenueId}: confidence must be 1.`)
    assert(
      seed.matchMethod === 'manual_seed',
      `${anchor.canonicalVenueId}: matchMethod must be manual_seed.`,
    )

    const providerRecordFound = seed.providerRecordId.trim().length > 0
    assert(providerRecordFound, `${anchor.canonicalVenueId}: providerRecordFound must be true.`)

    const blockedReason = preFetchBlockedReason({
      canonicalVenueId: venue.id,
      providerRecordFound,
      coordinatesMissing,
    })
    assert(
      blockedReason === null,
      `${anchor.canonicalVenueId}: expected no local pre-fetch block, received ${blockedReason}.`,
    )

    process.stdout.write(
      `${anchor.canonicalVenueId}: providerRecordFound=true coordinatesMissing=false preFetchBlocked=false\n`,
    )
  }

  assert(fetchAttempts.length === 0, `Expected zero fetch calls, received ${fetchAttempts.length}.`)
  assert(
    !fetchAttempts.some((attempt) => attempt.includes('/api/field/text-search')),
    'Readiness test must not call /api/field/text-search.',
  )
  process.stdout.write('Phase 4 Build anchor data readiness passed with zero network calls.\n')
} finally {
  globalThis.fetch = originalFetch
}
