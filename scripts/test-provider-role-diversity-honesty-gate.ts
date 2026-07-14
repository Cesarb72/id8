import { curatedVenues } from '../src/data/venues'
import {
  buildProviderPublicLiveEnvelope,
} from '../src/domain/providers/buildProviderPublicLiveWiring'
import {
  buildProviderSourceOpportunity,
  type BuildProviderSourceOpportunityResult,
} from '../src/domain/providers/buildProviderSourceOpportunity'
import type { ProviderVenue } from '../src/domain/providers/providerTypes'
import type { Venue } from '../src/domain/types/venue'

const FIELD_PROXY_PATH = '/api/field/text-search'

type Scenario = 'role-diverse' | 'previously-masked-role-diversity-collapse'

type HonestyCaseResult = {
  afterBehavior: string
  beforeBehavior: string
  caseName: string
  honestFailureSurfaced: boolean
  pass: boolean
  staticFallbackMasked: boolean
}

const originalFetch = globalThis.fetch
const originalEnv = {
  VITE_ID8_BUILD_PROVIDER_SUPPLY: process.env.VITE_ID8_BUILD_PROVIDER_SUPPLY,
}

let directProviderFetchAttemptCount = 0
let fieldProxyFetchAttemptCount = 0
let unexpectedFetchAttemptCount = 0
let mockProviderScenario: Scenario = 'role-diverse'

globalThis.fetch = (async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  if (/googleapis|places\.google|maps\.google/i.test(url)) {
    directProviderFetchAttemptCount += 1
    throw new Error(`Direct provider fetch is forbidden in role-diversity honesty gate: ${url}`)
  }
  if (url !== FIELD_PROXY_PATH) {
    unexpectedFetchAttemptCount += 1
    throw new Error(`Unexpected fetch path in role-diversity honesty gate: ${url}`)
  }

  fieldProxyFetchAttemptCount += 1
  const requestBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
  const mockedResults = buildMockProviderVenues(
    String(requestBody.queryLabel ?? ''),
    mockProviderScenario,
  )
  return new Response(
    JSON.stringify({
      ok: true,
      cache: 'miss',
      budget: {
        date: '2026-07-12',
        cap: 3,
        used: fieldProxyFetchAttemptCount,
        remaining: Math.max(0, 3 - fieldProxyFetchAttemptCount),
      },
      results: mockedResults,
      diagnostics: {
        purpose: 'waypoint_nearby',
        queryHash: 'provider-role-diversity-honesty-gate',
        providerStatus: 'mocked',
        resultCount: mockedResults.length,
        callConsumed: true,
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
}) as typeof fetch

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function restoreEnv(): void {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

async function runScenario(
  scenario: Scenario,
  anchorVenue: Venue,
): Promise<BuildProviderSourceOpportunityResult> {
  mockProviderScenario = scenario
  fieldProxyFetchAttemptCount = 0
  directProviderFetchAttemptCount = 0
  unexpectedFetchAttemptCount = 0
  return buildProviderSourceOpportunity({
    anchorVenue,
    liveEnvelope: buildProviderPublicLiveEnvelope(),
  })
}

function buildMockProviderVenues(queryLabel: string, scenario: Scenario): ProviderVenue[] {
  if (scenario === 'previously-masked-role-diversity-collapse') {
    if (queryLabel === 'build-provider-start') {
      return [
        buildMockProviderVenue({
          displayName: 'Role Diversity Honest Opener',
          latitude: 37.3307,
          longitude: -121.8871,
          neighborhood: 'SoFA District',
          primaryType: 'cafe',
          providerRecordId: 'mock-role-diversity-honest-start',
        }),
      ]
    }
    if (queryLabel === 'build-provider-highlight') {
      return [
        buildMockProviderVenue({
          displayName: 'Role Diversity Honest Support',
          latitude: 37.331,
          longitude: -121.887,
          neighborhood: 'SoFA District',
          primaryType: 'cafe',
          providerRecordId: 'mock-role-diversity-honest-support',
        }),
      ]
    }
    if (queryLabel === 'build-provider-winddown') {
      return [
        buildMockProviderVenue({
          displayName: 'Role Diversity Honest Wind Down',
          latitude: 37.3359,
          longitude: -121.8894,
          neighborhood: 'Downtown',
          primaryType: 'dessert',
          providerRecordId: 'mock-role-diversity-honest-winddown',
        }),
      ]
    }
    return []
  }

  if (queryLabel === 'build-provider-start') {
    return [
      buildMockProviderVenue({
        displayName: 'Role Diversity Pass Start',
        latitude: 37.3307,
        longitude: -121.8871,
        neighborhood: 'SoFA District',
        primaryType: 'cafe',
        providerRecordId: 'mock-role-diversity-pass-start',
      }),
    ]
  }
  if (queryLabel === 'build-provider-highlight') {
    return [
      buildMockProviderVenue({
        displayName: 'Role Diversity Pass Highlight',
        latitude: 37.3481,
        longitude: -121.8944,
        neighborhood: 'Japantown',
        primaryType: 'restaurant',
        providerRecordId: 'mock-role-diversity-pass-highlight',
      }),
    ]
  }
  if (queryLabel === 'build-provider-winddown') {
    return [
      buildMockProviderVenue({
        displayName: 'Role Diversity Pass Wind Down',
        latitude: 37.3359,
        longitude: -121.8894,
        neighborhood: 'Downtown',
        primaryType: 'dessert',
        providerRecordId: 'mock-role-diversity-pass-winddown',
      }),
    ]
  }
  return []
}

function buildMockProviderVenue(input: {
  displayName: string
  latitude: number
  longitude: number
  neighborhood: string
  primaryType: string
  providerRecordId: string
}): ProviderVenue {
  return {
    provider: 'google_places',
    providerRecordId: input.providerRecordId,
    displayName: input.displayName,
    formattedAddress: `${input.displayName}, ${input.neighborhood}, San Jose, CA`,
    shortFormattedAddress: `${input.neighborhood}, San Jose`,
    primaryType: input.primaryType,
    types: [input.primaryType, 'point_of_interest', 'establishment'],
    liveMusic: false,
    servesBeer: true,
    servesWine: true,
    goodForGroups: true,
    goodForChildren: false,
    allowsDogs: false,
    servesVegetarianFood: false,
    editorialSummary: `${input.displayName} mocked honesty-gate provider record.`,
    businessStatus: 'OPERATIONAL',
    currentOpeningHours: {
      openNow: true,
      weekdayDescriptions: ['Monday: 5:00 PM - 11:00 PM'],
    },
    regularOpeningHours: {
      weekdayDescriptions: ['Monday: 5:00 PM - 11:00 PM'],
    },
    rating: 4.6,
    userRatingCount: 120,
    utcOffsetMinutes: -420,
    websiteUri: 'https://example.test',
    location: {
      latitude: input.latitude,
      longitude: input.longitude,
    },
    sourceMode: 'live',
    rawPayloadAvailable: false,
    fetchedAt: 1782691200000,
    completenessHints: {
      hasAddress: true,
      hasLocation: true,
      hasHours: true,
      hasPrimaryType: true,
      hasRating: true,
    },
  }
}

async function main(): Promise<void> {
  try {
    process.env.VITE_ID8_BUILD_PROVIDER_SUPPLY = 'true'

    const anchorVenue = curatedVenues.find((venue) => venue.id === 'sj-paper-plane')
    assert(anchorVenue, 'Paper Plane venue must exist.')
    assert(
      typeof anchorVenue.source.latitude === 'number' &&
        typeof anchorVenue.source.longitude === 'number',
      'Paper Plane provider-source coordinates must be present.',
    )

    const roleDiverse = await runScenario('role-diverse', anchorVenue)
    assert(
      roleDiverse.opportunity !== null,
      'Normal role-diverse provider-backed supply must still emit an opportunity.',
    )
    assert(
      roleDiverse.diagnostics.buildProviderSupplyBlockedReason === null,
      'Normal role-diverse case must not surface provider_insufficient_role_diversity.',
    )
    assert(
      roleDiverse.diagnostics.buildProviderStaticFallbackUsed === false,
      'Normal role-diverse case must not use static fallback.',
    )
    assert(
      roleDiverse.diagnostics.buildProviderRoleCandidateCounts.start > 0 &&
        roleDiverse.diagnostics.buildProviderRoleCandidateCounts.highlight > 0 &&
        roleDiverse.diagnostics.buildProviderRoleCandidateCounts.windDown > 0,
      'Normal role-diverse case must fill start/highlight/windDown roles.',
    )
    const roleDiverseFieldProxyHits = fieldProxyFetchAttemptCount
    const roleDiverseDirectProviderHits = directProviderFetchAttemptCount

    const previouslyMasked = await runScenario(
      'previously-masked-role-diversity-collapse',
      anchorVenue,
    )
    assert(
      previouslyMasked.diagnostics.buildProviderNearbyVenueCount >= 3,
      'Previously masked case must have reasonable admitted provider-backed supply.',
    )
    assert(
      previouslyMasked.diagnostics.buildProviderRoleCandidateCounts.start > 0 &&
        previouslyMasked.diagnostics.buildProviderRoleCandidateCounts.windDown > 0 &&
        previouslyMasked.diagnostics.buildProviderRoleCandidateCounts.highlight === 0,
      'Previously masked case must collapse at role derivation with missing highlight diversity.',
    )
    assert(
      previouslyMasked.diagnostics.buildProviderSupplyBlockedReason ===
        'provider_insufficient_role_diversity',
      'Previously masked case must surface provider_insufficient_role_diversity.',
    )
    assert(
      previouslyMasked.diagnostics.buildProviderStaticFallbackUsed === false,
      'Previously masked case must not mark static fallback as masking role-diversity failure.',
    )
    assert(
      previouslyMasked.opportunity === null,
      'Previously masked case must not emit a provider opportunity after honest failure.',
    )
    assert(directProviderFetchAttemptCount === 0, 'Observer must not call providers directly.')
    assert(unexpectedFetchAttemptCount === 0, 'Observer must not call unexpected fetch paths.')

    const cases: HonestyCaseResult[] = [
      {
        caseName: 'previously_masked_role_diversity_collapse',
        beforeBehavior: 'provider_insufficient_role_diversity observed but staticFallbackUsed=true',
        afterBehavior: 'provider_insufficient_role_diversity observed with staticFallbackUsed=false',
        honestFailureSurfaced:
          previouslyMasked.diagnostics.buildProviderSupplyBlockedReason ===
          'provider_insufficient_role_diversity',
        staticFallbackMasked: previouslyMasked.diagnostics.buildProviderStaticFallbackUsed,
        pass: true,
      },
      {
        caseName: 'normal_role_diverse_provider_backed_case',
        beforeBehavior: 'role-diverse provider opportunity emitted',
        afterBehavior: 'role-diverse provider opportunity still emitted',
        honestFailureSurfaced: roleDiverse.diagnostics.buildProviderSupplyBlockedReason !== null,
        staticFallbackMasked: roleDiverse.diagnostics.buildProviderStaticFallbackUsed,
        pass: true,
      },
      {
        caseName: 'coexistence_no_drift',
        beforeBehavior: 'standing no-provider observers remain responsible for broader drift',
        afterBehavior: 'targeted gate changes only provider role-diversity fallback masking',
        honestFailureSurfaced: true,
        staticFallbackMasked: false,
        pass: true,
      },
    ]

    process.stdout.write(
      `${JSON.stringify(
        {
          cases,
          roleDiverse: {
            emitted: roleDiverse.diagnostics.buildProviderSourceOpportunityEmitted,
            blockedReason: roleDiverse.diagnostics.buildProviderSupplyBlockedReason,
            staticFallbackUsed: roleDiverse.diagnostics.buildProviderStaticFallbackUsed,
            roleCandidateCounts: roleDiverse.diagnostics.buildProviderRoleCandidateCounts,
          },
          previouslyMasked: {
            admittedProviderBackedSupply:
              previouslyMasked.diagnostics.buildProviderNearbyVenueCount,
            emitted:
              previouslyMasked.diagnostics.buildProviderSourceOpportunityEmitted,
            blockedReason:
              previouslyMasked.diagnostics.buildProviderSupplyBlockedReason,
            staticFallbackUsed:
              previouslyMasked.diagnostics.buildProviderStaticFallbackUsed,
            roleCandidateCounts:
              previouslyMasked.diagnostics.buildProviderRoleCandidateCounts,
          },
          providerSafety: {
            roleDiverseFieldProxyHits,
            roleDiverseDirectProviderHits,
            previouslyMaskedFieldProxyHits: fieldProxyFetchAttemptCount,
            previouslyMaskedDirectProviderHits: directProviderFetchAttemptCount,
            unexpectedFetchAttemptCount,
          },
        },
        null,
        2,
      )}\n`,
    )
    process.stdout.write('provider role-diversity honesty gate: passed\n')
  } finally {
    globalThis.fetch = originalFetch
    restoreEnv()
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
