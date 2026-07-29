import { curatedVenues } from '../src/data/venues'
import { adaptBuildProviderSourceOpportunityToVerifiedOpportunity } from '../src/domain/providers/adaptBuildProviderSourceOpportunityToVerifiedOpportunity'
import {
  buildProviderSourceOpportunity,
  type BuildProviderRoleCandidateReviewSummary,
  type BuildProviderSourceOpportunity,
  type BuildProviderSourceOpportunityResult,
} from '../src/domain/providers/buildProviderSourceOpportunity'
import { buildProviderPublicLiveEnvelope } from '../src/domain/providers/buildProviderPublicLiveWiring'
import type { ProviderVenue } from '../src/domain/providers/providerTypes'
import type { Venue } from '../src/domain/types/venue'

const FIELD_PROXY_PATH = '/api/field/text-search'

type Scenario =
  | 'role-diverse'
  | 'thin-world-provider-insufficient-role-diversity'
  | 'fallback-masked-role-diversity-collapse'

type RoleName = 'start' | 'highlight' | 'windDown'
type RoleBuckets = Record<RoleName, string[]>

type RouteOutput = {
  emitted: boolean
  blockedReason: string | null
  staticFallbackUsed: boolean
  sourceOpportunityAvailable: boolean
  routeShape: 'provider_live_full' | 'none'
  selectedStopIds: {
    anchorId: string | null
    startIds: string[]
    highlightIds: string[]
    windDownIds: string[]
  }
  verifiedRoute: {
    sourceMode: string
    startIds: string[]
    anchorId: string
    highlightIds: string[]
    windDownIds: string[]
    storySpine: {
      start: string
      highlight: string
      windDown: string
    }
  } | null
}

type CaseSummary = {
  caseName: Scenario
  oldRouteOutput: RouteOutput
  newRouteOutput: RouteOutput
  routeMatch: boolean
  roleBucketsMatch: boolean
  fallbackHonestyMatch: boolean
  oldRoleBuckets: RoleBuckets
  newRoleBuckets: RoleBuckets
  countMatch: boolean
  idOrderMatch: boolean
  reasonMatch: boolean
  providerCalls: {
    directProviderFetchAttemptCount: number
    unexpectedFetchAttemptCount: number
  }
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
    throw new Error(`Direct provider fetch is forbidden in 2A-1 parity observer: ${url}`)
  }
  if (url !== FIELD_PROXY_PATH) {
    unexpectedFetchAttemptCount += 1
    throw new Error(`Unexpected fetch path in 2A-1 parity observer: ${url}`)
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
        date: '2026-07-16',
        cap: 3,
        used: fieldProxyFetchAttemptCount,
        remaining: Math.max(0, 3 - fieldProxyFetchAttemptCount),
      },
      results: mockedResults,
      diagnostics: {
        purpose: 'waypoint_nearby',
        queryHash: `provider-role-suitability-taste-consumer-${mockProviderScenario}`,
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

function dedupeIds(ids: string[]): string[] {
  const seen = new Set<string>()
  const deduped: string[] = []
  for (const id of ids) {
    if (seen.has(id)) {
      continue
    }
    seen.add(id)
    deduped.push(id)
  }
  return deduped
}

function deriveLegacyRoleBucketsFromVenues(venues: Venue[]): {
  highlight: Venue[]
  start: Venue[]
  windDown: Venue[]
} {
  return {
    start: dedupeVenueIds(
      venues.filter(
        (venue) =>
          venue.roleAffinity.warmup >= 0.6 &&
          venue.energyLevel <= 4 &&
          venue.source.qualityGateStatus === 'approved' &&
          !venue.source.hoursSuppressionApplied,
      ),
    ),
    highlight: dedupeVenueIds(
      venues.filter(
        (venue) =>
          venue.highlightCapable &&
          venue.roleAffinity.peak >= 0.7 &&
          venue.source.qualityGateStatus === 'approved' &&
          !venue.source.hoursSuppressionApplied,
      ),
    ),
    windDown: dedupeVenueIds(
      venues.filter(
        (venue) =>
          venue.roleAffinity.cooldown >= 0.58 &&
          venue.energyLevel <= 4 &&
          venue.source.qualityGateStatus === 'approved' &&
          !venue.source.hoursSuppressionApplied,
      ),
    ),
  }
}

function dedupeVenueIds(venues: Venue[]): Venue[] {
  const seen = new Set<string>()
  const deduped: Venue[] = []
  for (const venue of venues) {
    if (seen.has(venue.id)) {
      continue
    }
    seen.add(venue.id)
    deduped.push(venue)
  }
  return deduped
}

function deriveLegacyRoleBucketsFromReviews(
  reviews: BuildProviderRoleCandidateReviewSummary[],
): RoleBuckets {
  return {
    start: dedupeIds(
      reviews
        .filter(
          (review) =>
            (review.roleAffinity?.warmup ?? 0) >= 0.6 &&
            (review.energyLevel ?? 0) <= 4 &&
            review.qualityGateStatus === 'approved' &&
            !review.hoursSuppressionApplied,
        )
        .map((review) => review.providerRecordId),
    ),
    highlight: dedupeIds(
      reviews
        .filter(
          (review) =>
            review.highlightCapable &&
            (review.roleAffinity?.peak ?? 0) >= 0.7 &&
            review.qualityGateStatus === 'approved' &&
            !review.hoursSuppressionApplied,
        )
        .map((review) => review.providerRecordId),
    ),
    windDown: dedupeIds(
      reviews
        .filter(
          (review) =>
            (review.roleAffinity?.cooldown ?? 0) >= 0.58 &&
            (review.energyLevel ?? 0) <= 4 &&
            review.qualityGateStatus === 'approved' &&
            !review.hoursSuppressionApplied,
        )
        .map((review) => review.providerRecordId),
    ),
  }
}

function summarizeRoleBucketsFromOpportunity(
  opportunity: BuildProviderSourceOpportunity,
): RoleBuckets {
  return {
    start: opportunity.roleCandidates.start.map((venue) => venue.id),
    highlight: opportunity.roleCandidates.highlight.map((venue) => venue.id),
    windDown: opportunity.roleCandidates.windDown.map((venue) => venue.id),
  }
}

function summarizeVerifiedRoute(
  opportunity: BuildProviderSourceOpportunity | null,
): RouteOutput['verifiedRoute'] {
  if (!opportunity) {
    return null
  }
  const verified = adaptBuildProviderSourceOpportunityToVerifiedOpportunity({
    opportunity,
    diagnostics: {
      buildProviderSourceOpportunityEmitted: true,
    },
  })
  if (!verified) {
    return null
  }
  return {
    sourceMode: verified.sourceMode,
    startIds: verified.starts.map((stop) => stop.venueId),
    anchorId: verified.anchor.venueId,
    highlightIds: verified.highlightAlternates?.map((stop) => stop.venueId) ?? [],
    windDownIds: verified.closes.map((stop) => stop.venueId),
    storySpine: verified.storySpine,
  }
}

function summarizeRouteOutput(
  result: BuildProviderSourceOpportunityResult,
  roleBuckets: RoleBuckets,
  overrideOpportunity?: BuildProviderSourceOpportunity | null,
): RouteOutput {
  const opportunity =
    overrideOpportunity === undefined ? result.opportunity : overrideOpportunity
  return {
    emitted: result.diagnostics.buildProviderSourceOpportunityEmitted,
    blockedReason: result.diagnostics.buildProviderSupplyBlockedReason,
    staticFallbackUsed: result.diagnostics.buildProviderStaticFallbackUsed,
    sourceOpportunityAvailable: opportunity !== null,
    routeShape: opportunity ? 'provider_live_full' : 'none',
    selectedStopIds: {
      anchorId: opportunity?.anchor.venue.id ?? null,
      startIds: roleBuckets.start,
      highlightIds: roleBuckets.highlight,
      windDownIds: roleBuckets.windDown,
    },
    verifiedRoute: summarizeVerifiedRoute(opportunity),
  }
}

function buildLegacyOpportunity(
  opportunity: BuildProviderSourceOpportunity,
): {
  opportunity: BuildProviderSourceOpportunity
  roleBuckets: RoleBuckets
} {
  const legacyRoleCandidates = deriveLegacyRoleBucketsFromVenues(opportunity.nearbyCandidates)
  const roleBuckets = {
    start: legacyRoleCandidates.start.map((venue) => venue.id),
    highlight: legacyRoleCandidates.highlight.map((venue) => venue.id),
    windDown: legacyRoleCandidates.windDown.map((venue) => venue.id),
  }
  return {
    opportunity: {
      ...opportunity,
      roleCandidates: legacyRoleCandidates,
      diagnostics: {
        ...opportunity.diagnostics,
        roleCandidateCounts: {
          start: legacyRoleCandidates.start.length,
          highlight: legacyRoleCandidates.highlight.length,
          windDown: legacyRoleCandidates.windDown.length,
        },
      },
    },
    roleBuckets,
  }
}

function roleBucketsMatch(left: RoleBuckets, right: RoleBuckets): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function countsMatch(left: RoleBuckets, right: RoleBuckets): boolean {
  return (
    left.start.length === right.start.length &&
    left.highlight.length === right.highlight.length &&
    left.windDown.length === right.windDown.length
  )
}

function summarizeLegacyForResult(
  result: BuildProviderSourceOpportunityResult,
): {
  opportunity: BuildProviderSourceOpportunity | null
  routeOutput: RouteOutput
  roleBuckets: RoleBuckets
} {
  if (result.opportunity) {
    const legacy = buildLegacyOpportunity(result.opportunity)
    return {
      opportunity: legacy.opportunity,
      roleBuckets: legacy.roleBuckets,
      routeOutput: summarizeRouteOutput(result, legacy.roleBuckets, legacy.opportunity),
    }
  }

  const roleBuckets = deriveLegacyRoleBucketsFromReviews(
    result.diagnostics.roleCandidateReviewSummaries,
  )
  return {
    opportunity: null,
    roleBuckets,
    routeOutput: summarizeRouteOutput(result, roleBuckets, null),
  }
}

async function runScenario(
  scenario: Scenario,
  anchorVenue: Venue,
): Promise<{
  fieldProxyHits: number
  result: BuildProviderSourceOpportunityResult
}> {
  mockProviderScenario = scenario
  fieldProxyFetchAttemptCount = 0
  directProviderFetchAttemptCount = 0
  unexpectedFetchAttemptCount = 0
  const result = await buildProviderSourceOpportunity({
    anchorVenue,
    liveEnvelope: buildProviderPublicLiveEnvelope(),
  })
  return {
    fieldProxyHits: fieldProxyFetchAttemptCount,
    result,
  }
}

function assertExpectedScenarioOutcome(
  scenario: Scenario,
  result: BuildProviderSourceOpportunityResult,
): void {
  if (scenario === 'role-diverse') {
    assert(result.opportunity !== null, 'Role-diverse case must emit an opportunity.')
    assert(
      result.diagnostics.buildProviderSupplyBlockedReason === null,
      'Role-diverse case must not be blocked.',
    )
    return
  }

  assert(result.opportunity === null, `${scenario} must not emit an opportunity.`)
  assert(
    result.diagnostics.buildProviderSupplyBlockedReason ===
      'provider_insufficient_role_diversity',
    `${scenario} must surface provider_insufficient_role_diversity.`,
  )
  assert(
    result.diagnostics.buildProviderStaticFallbackUsed === false,
    `${scenario} must not mask with static fallback.`,
  )
}

async function summarizeCase(
  scenario: Scenario,
  anchorVenue: Venue,
): Promise<CaseSummary> {
  const { fieldProxyHits, result } = await runScenario(scenario, anchorVenue)
  assertExpectedScenarioOutcome(scenario, result)

  const legacy = summarizeLegacyForResult(result)
  const newRoleBuckets = result.opportunity
    ? summarizeRoleBucketsFromOpportunity(result.opportunity)
    : deriveLegacyRoleBucketsFromReviews(result.diagnostics.roleCandidateReviewSummaries)
  const newRouteOutput = summarizeRouteOutput(result, newRoleBuckets)
  const routeMatch =
    JSON.stringify(legacy.routeOutput) === JSON.stringify(newRouteOutput)
  const idOrderMatch = roleBucketsMatch(legacy.roleBuckets, newRoleBuckets)
  const countMatch = countsMatch(legacy.roleBuckets, newRoleBuckets)
  const fallbackHonestyMatch =
    legacy.routeOutput.blockedReason === newRouteOutput.blockedReason &&
    legacy.routeOutput.staticFallbackUsed === newRouteOutput.staticFallbackUsed &&
    legacy.routeOutput.emitted === newRouteOutput.emitted

  assert(routeMatch, `${scenario} route output drifted after Taste consumer migration.`)
  assert(countMatch, `${scenario} role bucket counts drifted after Taste consumer migration.`)
  assert(idOrderMatch, `${scenario} role bucket IDs/order drifted after Taste consumer migration.`)
  assert(fallbackHonestyMatch, `${scenario} fallback/honesty state drifted.`)
  if (result.opportunity) {
    for (const venue of result.opportunity.nearbyCandidates) {
      const identityAdmission = result.opportunity.diagnostics.venueIdentityAdmissions.find(
        (observation) => observation.materializedVenueId === venue.id,
      )
      assert(
        identityAdmission?.resolvedBaseVenueId === venue.id,
        `${scenario} emitted Venue.id must equal its admitted resolvedBaseVenueId: ${venue.id}`,
      )
      assert(
        !venue.id.startsWith('live_google_'),
        `${scenario} emitted Venue.id must not use live_google_*: ${venue.id}`,
      )
      assert(
        venue.id !== venue.source.providerRecordId,
        `${scenario} emitted Venue.id must not equal providerRecordId: ${venue.id}`,
      )
      assert(
        Boolean(venue.source.providerRecordId),
        `${scenario} emitted Venue must retain providerRecordId provenance: ${venue.id}`,
      )
    }
  }
  assert(directProviderFetchAttemptCount === 0, `${scenario} direct provider calls occurred.`)
  assert(unexpectedFetchAttemptCount === 0, `${scenario} unexpected fetch calls occurred.`)

  return {
    caseName: scenario,
    oldRouteOutput: legacy.routeOutput,
    newRouteOutput,
    routeMatch,
    roleBucketsMatch: idOrderMatch,
    fallbackHonestyMatch,
    oldRoleBuckets: legacy.roleBuckets,
    newRoleBuckets,
    countMatch,
    idOrderMatch,
    reasonMatch:
      legacy.routeOutput.blockedReason === newRouteOutput.blockedReason,
    providerCalls: {
      directProviderFetchAttemptCount,
      unexpectedFetchAttemptCount,
    },
  }
}

function buildMockProviderVenues(queryLabel: string, scenario: Scenario): ProviderVenue[] {
  if (scenario === 'thin-world-provider-insufficient-role-diversity') {
    return [
      buildMockProviderVenue({
        displayName: `Thin World ${queryLabel}`,
        latitude: 37.3307,
        longitude: -121.8871,
        neighborhood: 'SoFA District',
        primaryType: 'cafe',
        providerRecordId: `mock-thin-world-${queryLabel}`,
      }),
    ]
  }

  if (scenario === 'fallback-masked-role-diversity-collapse') {
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
        formattedAddress: '125 S 2nd St, San Jose, CA 95113',
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
        formattedAddress: '565 N 6th St, San Jose, CA 95112',
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
        formattedAddress: '170 W Santa Clara St, San Jose, CA 95113',
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
  formattedAddress?: string
  latitude: number
  longitude: number
  neighborhood: string
  primaryType: string
  providerRecordId: string
}): ProviderVenue {
  const formattedAddress = input.formattedAddress ?? buildQualifiedMockAddress(input.providerRecordId)
  return {
    provider: 'google_places',
    providerRecordId: input.providerRecordId,
    displayName: input.displayName,
    formattedAddress,
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
    editorialSummary: `${input.displayName} mocked 2A-1 provider record.`,
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

function buildQualifiedMockAddress(providerRecordId: string): string {
  const suffix = providerRecordId
    .split('')
    .reduce((sum, character) => sum + character.charCodeAt(0), 0)
  const streetNumber = 700 + (suffix % 200)
  return `${streetNumber} S 2nd St, San Jose, CA 95113`
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

    const cases = [
      await summarizeCase('role-diverse', anchorVenue),
      await summarizeCase(
        'thin-world-provider-insufficient-role-diversity',
        anchorVenue,
      ),
      await summarizeCase('fallback-masked-role-diversity-collapse', anchorVenue),
    ]

    process.stdout.write(
      `${JSON.stringify(
        {
          migration: 'provider_role_suitability_consumes_taste_role_pool_meaning',
          cases,
          providerSafety: {
            directProviderFetchAttemptCount: cases.reduce(
              (sum, entry) => sum + entry.providerCalls.directProviderFetchAttemptCount,
              0,
            ),
            unexpectedFetchAttemptCount: cases.reduce(
              (sum, entry) => sum + entry.providerCalls.unexpectedFetchAttemptCount,
              0,
            ),
          },
        },
        null,
        2,
      )}\n`,
    )
    process.stdout.write('provider role-suitability Taste consumer parity: passed\n')
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
