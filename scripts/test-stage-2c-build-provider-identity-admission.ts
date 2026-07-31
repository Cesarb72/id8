import {
  AUTHORITATIVE_STAGE0_EVIDENCE_ROW_COUNT,
  AUTHORITATIVE_STAGE0_EVIDENCE_SHA256,
  validateIdentityEvidenceCorpusFile,
} from './identityEvidenceCorpusGuard'
import { buildVenueIdentityAdmissionDiagnostics } from '../src/domain/bearings/buildVenueIdentityAdmission'
import { curatedVenues } from '../src/data/venues'
import { resolveFieldInterpretationVenueIdentityHandoffs } from '../src/domain/field/resolveFieldInterpretationVenueIdentityHandoffs'
import {
  buildProviderSourceOpportunity,
  type BuildProviderSourceOpportunityResult,
} from '../src/domain/providers/buildProviderSourceOpportunity'
import type { ProviderVenue } from '../src/domain/providers/providerTypes'
import type { StaticCanonicalVenueIdentity } from '../src/domain/interpretation/venueIdentity'
import type { FieldInterpretationVenueIdentityHandoff } from '../src/domain/types/diagnostics'
import type { RawPlace } from '../src/domain/types/rawPlace'

const FIELD_PROXY_PATH = '/api/field/text-search'
const CORPUS_PATH =
  'src/domain/field/corpus/evidence/provider-corpus-real-1781057364783/provider-corpus-snapshot.provider.json'
const EXPECTED_CORPUS_SHA256 = AUTHORITATIVE_STAGE0_EVIDENCE_SHA256
const EXPECTED_CORPUS_COUNT = AUTHORITATIVE_STAGE0_EVIDENCE_ROW_COUNT

const originalFetch = globalThis.fetch
const originalSupplyFlag = process.env.VITE_ID8_BUILD_PROVIDER_SUPPLY

type Ordering = 'original' | 'reversed' | 'shuffled'

interface ScenarioSnapshot {
  admissionBySource: Record<string, {
    diagnosticOnly: boolean
    duplicateGroupMemberSourceIdentities: string[]
    duplicateGroupSize: number
    materializedRouteRepresentation: boolean
    materializedVenueId: string | null
    resolvedBaseVenueId: string | null
    routeAdmissionStatus: string
    routeIdentityEligible: boolean
  }>
  emittedVenueIds: string[]
  groupMembership: Array<{
    memberFieldSourceIdentities: string[]
    representativeFieldSourceIdentity: string
    resolvedBaseVenueId: string
  }>
  handoffBySource: Record<string, {
    ambiguityReason: string | null
    identityResolutionStatus: string
    pendingReason: string | null
    physicalPlaceKeySerialization: string | null
    resolvedBaseVenueId: string | null
  }>
  observationCount: number
  uniqueResolvedIdentityCount: number
}

let ordering: Ordering = 'original'
let directProviderFetchAttemptCount = 0
let hostedFetchAttemptCount = 0
let fieldProxyFetchAttemptCount = 0

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function providerVenue(input: {
  displayName: string
  formattedAddress?: string
  latitude?: number
  longitude?: number
  primaryType: string
  providerRecordId: string
  types?: string[]
}): ProviderVenue {
  return {
    provider: 'google_places',
    providerRecordId: input.providerRecordId,
    displayName: input.displayName,
    ...(input.formattedAddress ? { formattedAddress: input.formattedAddress } : {}),
    ...(input.formattedAddress ? { shortFormattedAddress: input.formattedAddress.split(',')[0] } : {}),
    primaryType: input.primaryType,
    types: input.types ?? [input.primaryType, 'point_of_interest', 'establishment'],
    liveMusic: input.primaryType === 'bar' || input.primaryType === 'restaurant',
    servesBeer: true,
    servesWine: true,
    goodForGroups: true,
    goodForChildren: false,
    allowsDogs: false,
    servesVegetarianFood: input.primaryType === 'restaurant',
    editorialSummary: `${input.displayName} mocked Stage 2C provider observation.`,
    businessStatus: 'OPERATIONAL',
    currentOpeningHours: {
      openNow: true,
      weekdayDescriptions: ['Monday: 5:00 PM - 11:00 PM'],
    },
    regularOpeningHours: {
      weekdayDescriptions: ['Monday: 5:00 PM - 11:00 PM'],
    },
    rating: 4.6,
    userRatingCount: 140,
    utcOffsetMinutes: -420,
    websiteUri: 'https://example.test/stage-2c',
    ...(typeof input.latitude === 'number' && typeof input.longitude === 'number'
      ? { location: { latitude: input.latitude, longitude: input.longitude } }
      : {}),
    sourceMode: 'live',
    rawPayloadAvailable: false,
    fetchedAt: 1782691200000,
    completenessHints: {
      hasAddress: Boolean(input.formattedAddress),
      hasLocation: typeof input.latitude === 'number' && typeof input.longitude === 'number',
      hasHours: true,
      hasPrimaryType: true,
      hasRating: true,
    },
  }
}

function buildProviderObservations(): ProviderVenue[] {
  return [
    providerVenue({
      displayName: 'Haberdasher',
      formattedAddress: '43 W San Salvador St, San Jose, CA 95113',
      latitude: 37.331,
      longitude: -121.8889,
      primaryType: 'bar',
      providerRecordId: 'ChIJkV6TlrDMj4ARIPxsqSMrdr4',
    }),
    providerVenue({
      displayName: 'Stage 2C Provider Start',
      formattedAddress: '100 Proof St, San Jose, CA 95113',
      latitude: 37.3307,
      longitude: -121.8871,
      primaryType: 'cafe',
      providerRecordId: 'stage2c-provider-start',
    }),
    providerVenue({
      displayName: 'Stage 2C Provider Highlight',
      formattedAddress: '200 Proof St, San Jose, CA 95113',
      latitude: 37.3312,
      longitude: -121.8878,
      primaryType: 'restaurant',
      providerRecordId: 'stage2c-provider-highlight',
    }),
    providerVenue({
      displayName: 'Stage 2C Provider Wind Down',
      formattedAddress: '300 Proof St, San Jose, CA 95113',
      latitude: 37.3317,
      longitude: -121.8882,
      primaryType: 'dessert',
      providerRecordId: 'stage2c-provider-winddown',
    }),
    providerVenue({
      displayName: 'Stage 2C Duplicate A',
      formattedAddress: '400 Proof St, San Jose, CA 95113',
      latitude: 37.332,
      longitude: -121.889,
      primaryType: 'bar',
      providerRecordId: 'stage2c-duplicate-a',
    }),
    providerVenue({
      displayName: 'Stage 2C Duplicate B Different Name',
      formattedAddress: '400 Proof St, San Jose, CA 95113',
      latitude: 37.3321,
      longitude: -121.8891,
      primaryType: 'restaurant',
      providerRecordId: 'stage2c-duplicate-b',
    }),
    providerVenue({
      displayName: 'Stage 2C Food Hall',
      formattedAddress: '500 Proof St, San Jose, CA 95113',
      latitude: 37.333,
      longitude: -121.8895,
      primaryType: 'food_court',
      providerRecordId: 'stage2c-pending-food-hall',
      types: ['food_court', 'restaurant', 'point_of_interest', 'establishment'],
    }),
    providerVenue({
      displayName: 'Stage 2C Coordinate Only',
      latitude: 37.334,
      longitude: -121.89,
      primaryType: 'bar',
      providerRecordId: 'stage2c-pending-coordinate-only',
    }),
  ]
}

function orderProviderObservations(observations: ProviderVenue[], variant: Ordering): ProviderVenue[] {
  if (variant === 'reversed') {
    return observations.slice().reverse()
  }
  if (variant === 'shuffled') {
    return [observations[3]!, observations[0]!, observations[6]!, observations[2]!, observations[5]!, observations[1]!, observations[7]!, observations[4]!]
  }
  return observations.slice()
}

function installMockFetch(): void {
  globalThis.fetch = (async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (/googleapis|places\.google|maps\.google/i.test(url)) {
      directProviderFetchAttemptCount += 1
      throw new Error(`Direct provider fetch is forbidden in Stage 2C proof: ${url}`)
    }
    if (url !== FIELD_PROXY_PATH) {
      hostedFetchAttemptCount += 1
      throw new Error(`Unexpected hosted fetch is forbidden in Stage 2C proof: ${url}`)
    }

    fieldProxyFetchAttemptCount += 1
    const requestBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
    const mockedResults = orderProviderObservations(buildProviderObservations(), ordering)

    return new Response(
      JSON.stringify({
        ok: true,
        cache: 'miss',
        budget: {
          date: '2026-07-28',
          cap: 3,
          used: fieldProxyFetchAttemptCount,
          remaining: Math.max(0, 3 - fieldProxyFetchAttemptCount),
        },
        results: mockedResults,
        diagnostics: {
          purpose: 'waypoint_nearby',
          queryHash: `stage-2c-${String(requestBody.queryLabel ?? 'unknown')}-${ordering}`,
          providerStatus: 'mocked',
          resultCount: mockedResults.length,
          callConsumed: false,
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
}

async function runBuildScenario(variant: Ordering): Promise<BuildProviderSourceOpportunityResult> {
  ordering = variant
  const anchorVenue = curatedVenues.find((venue) => venue.id === 'sj-paper-plane')
  assert(anchorVenue, 'Paper Plane static anchor must exist.')
  return buildProviderSourceOpportunity({
    anchorVenue,
    liveEnvelope: {
      liveProviderAllowed: true,
      maxProviderCalls: 1,
      maxQueryLabels: 1,
      maxCenters: 1,
    },
    pageSize: 10,
  })
}

function snapshotResult(result: BuildProviderSourceOpportunityResult): ScenarioSnapshot {
  const diagnostics = result.diagnostics
  const admissionBySource = Object.fromEntries(
    diagnostics.venueIdentityAdmissions.map((observation) => [
      observation.fieldSourceIdentity,
      {
        diagnosticOnly: observation.diagnosticOnly,
        duplicateGroupMemberSourceIdentities: observation.duplicateGroupMemberSourceIdentities,
        duplicateGroupSize: observation.duplicateGroupSize,
        materializedRouteRepresentation: observation.materializedRouteRepresentation,
        materializedVenueId: observation.materializedVenueId ?? null,
        resolvedBaseVenueId: observation.resolvedBaseVenueId ?? null,
        routeAdmissionStatus: observation.routeAdmissionStatus,
        routeIdentityEligible: observation.routeIdentityEligible,
      },
    ]),
  )
  const handoffBySource = Object.fromEntries(
    diagnostics.venueIdentityHandoffs.map((handoff) => [
      handoff.fieldSourceIdentity,
      {
        ambiguityReason: handoff.ambiguityReason ?? null,
        identityResolutionStatus: handoff.identityResolutionStatus,
        pendingReason: handoff.pendingReason ?? null,
        physicalPlaceKeySerialization: handoff.physicalPlaceKeySerialization ?? null,
        resolvedBaseVenueId: handoff.resolvedBaseVenueId ?? null,
      },
    ]),
  )
  return {
    admissionBySource,
    emittedVenueIds: result.opportunity?.nearbyCandidates.map((venue) => venue.id).sort() ?? [],
    groupMembership: diagnostics.venueIdentityAdmissionGroups.map((group) => ({
      memberFieldSourceIdentities: group.memberFieldSourceIdentities,
      representativeFieldSourceIdentity: group.representativeFieldSourceIdentity,
      resolvedBaseVenueId: group.resolvedBaseVenueId,
    })),
    handoffBySource,
    observationCount: diagnostics.venueIdentityAdmissions.length,
    uniqueResolvedIdentityCount: new Set(
      diagnostics.venueIdentityAdmissions
        .map((observation) => observation.resolvedBaseVenueId)
        .filter((value): value is string => Boolean(value)),
    ).size,
  }
}

function assertStableSnapshots(snapshots: ScenarioSnapshot[]): void {
  const [first, ...rest] = snapshots
  assert(first, 'expected at least one snapshot')
  for (const snapshot of rest) {
    assert(
      JSON.stringify(snapshot) === JSON.stringify(first),
      `order-independent snapshot drifted:\n${JSON.stringify(first, null, 2)}\n${JSON.stringify(snapshot, null, 2)}`,
    )
  }
}

function assertBuildScenario(result: BuildProviderSourceOpportunityResult): void {
  const diagnostics = result.diagnostics
  const reviewsByProviderRecord = new Map(
    diagnostics.nearbyCandidateReviews.map((review) => [review.providerRecordId, review]),
  )
  assert(diagnostics.venueIdentityHandoffs.length === 8, 'every provider observation needs a Field/Interpretation handoff')
  assert(diagnostics.venueIdentityAdmissions.length === 8, 'every provider observation needs a Bearings admission diagnostic')
  assert(result.opportunity !== null, 'Stage 2C role-diverse provider path should emit an opportunity')

  const staticReview = reviewsByProviderRecord.get('ChIJkV6TlrDMj4ARIPxsqSMrdr4')
  assert(staticReview?.identityResolutionStatus === 'resolved_static', 'static provider observation must resolve static')
  assert(staticReview.resolvedBaseVenueId === 'sj-haberdasher', 'static provider observation must retain Haberdasher ID')
  assert(staticReview.emittedVenueId === 'sj-haberdasher', 'static emitted Venue.id must equal static baseVenueId')

  const providerOnlyReview = reviewsByProviderRecord.get('stage2c-provider-start')
  assert(providerOnlyReview?.identityResolutionStatus === 'resolved_provider_only', 'provider-only observation must resolve provider-only')
  assert(providerOnlyReview.resolvedBaseVenueId, 'provider-only observation needs resolvedBaseVenueId')
  assert(providerOnlyReview.resolvedBaseVenueId !== 'stage2c-provider-start', 'provider-only ID must not equal providerRecordId')
  assert(!providerOnlyReview.resolvedBaseVenueId.startsWith('live_google_'), 'provider-only ID must not use live_google_*')

  const foodHallReview = reviewsByProviderRecord.get('stage2c-pending-food-hall')
  assert(foodHallReview?.identityResolutionStatus === 'pending', 'food hall must remain pending')
  assert(foodHallReview.pendingReason === 'multi_venue_address_without_unit_data', 'food hall pending cause must remain visible')
  assert(foodHallReview.routeIdentityEligible === false, 'pending food hall must not be route eligible')
  assert(foodHallReview.emittedVenueId === undefined, 'pending food hall must not emit a Venue')

  const coordinateOnlyReview = reviewsByProviderRecord.get('stage2c-pending-coordinate-only')
  assert(coordinateOnlyReview?.pendingReason === 'coordinate_only', 'coordinate-only observation must remain pending')
  assert(coordinateOnlyReview.emittedVenueId === undefined, 'coordinate-only observation must not emit a Venue')

  const duplicateA = reviewsByProviderRecord.get('stage2c-duplicate-a')
  const duplicateB = reviewsByProviderRecord.get('stage2c-duplicate-b')
  assert(duplicateA?.resolvedBaseVenueId, 'duplicate A needs resolvedBaseVenueId')
  assert(duplicateA.resolvedBaseVenueId === duplicateB?.resolvedBaseVenueId, 'duplicate observations must converge')
  const duplicateMembers = duplicateA.duplicateGroupMemberSourceIdentities ?? []
  assert(duplicateMembers.includes('stage2c-duplicate-a') && duplicateMembers.includes('stage2c-duplicate-b'), 'duplicate group must retain both observations')
  assert(
    [duplicateA, duplicateB].filter((review) => review?.materializedRouteRepresentation).length === 1,
    'duplicate group must materialize exactly one representative',
  )

  const emittedVenueIds = result.opportunity.nearbyCandidates.map((venue) => venue.id)
  assert(emittedVenueIds.length === 5, `expected five emitted canonical Venues, got ${emittedVenueIds.length}: ${emittedVenueIds.join(', ')}`)
  for (const venue of result.opportunity.nearbyCandidates) {
    const admittedObservation = diagnostics.venueIdentityAdmissions.find(
      (observation) => observation.materializedVenueId === venue.id,
    )
    assert(admittedObservation, `emitted Venue.id lacks Bearings admission: ${venue.id}`)
    assert(admittedObservation.resolvedBaseVenueId === venue.id, `emitted Venue.id must equal resolvedBaseVenueId: ${venue.id}`)
    assert(!venue.id.startsWith('live_google_'), `emitted Venue.id must not use live_google_*: ${venue.id}`)
    assert(venue.source.providerRecordId && venue.id !== venue.source.providerRecordId, `providerRecordId must remain provenance only: ${venue.id}`)
  }

  const roleVenueIds = [
    ...result.opportunity.roleCandidates.start,
    ...result.opportunity.roleCandidates.highlight,
    ...result.opportunity.roleCandidates.windDown,
  ].map((venue) => venue.id)
  assert(roleVenueIds.length > 0, 'role pools must receive admitted canonical provider supply')
  assert(roleVenueIds.every((id) => emittedVenueIds.includes(id)), 'role pools must be drawn only from emitted canonical Venues')
  assert(roleVenueIds.every((id) => !id.startsWith('live_google_')), 'role pools must not contain live_google_*')
  assert(roleVenueIds.every((id) => !buildProviderObservations().some((venue) => venue.providerRecordId === id)), 'role pools must not contain providerRecordId identities')
}

function rawPlace(input: {
  id: string
  name: string
  formattedAddress?: string
  providerRecordId: string
}): RawPlace {
  return {
    rawType: 'place',
    id: input.id,
    name: input.name,
    city: 'San Jose',
    neighborhood: 'Downtown',
    formattedAddress: input.formattedAddress,
    categoryHint: 'dining',
    sourceTypes: ['restaurant', 'point_of_interest', 'establishment'],
    sourceOrigin: 'live',
    provider: 'google-places',
    providerRecordId: input.providerRecordId,
    sourceQueryLabel: 'stage-2c-synthetic',
    latitude: 37.33,
    longitude: -121.88,
  }
}

function assertSyntheticAmbiguousAndHostile(): void {
  const ambiguousRawPlace = rawPlace({
    id: 'stage2c-ambiguous-source',
    name: 'Stage 2C Ambiguous',
    formattedAddress: '900 Ambiguous St, San Jose, CA 95113',
    providerRecordId: 'stage2c-ambiguous-provider',
  })
  const staticCanonicals: StaticCanonicalVenueIdentity[] = [
    {
      baseVenueId: 'sj-stage2c-ambiguous-a',
      providerRecordIds: ['stage2c-ambiguous-provider'],
    },
    {
      baseVenueId: 'sj-stage2c-ambiguous-b',
      providerRecordIds: ['stage2c-ambiguous-provider'],
    },
  ]
  const ambiguousHandoff = resolveFieldInterpretationVenueIdentityHandoffs([
    {
      rawPlace: ambiguousRawPlace,
      staticCanonicalsForResolution: staticCanonicals,
    },
  ]).get(ambiguousRawPlace.id)
  assert(ambiguousHandoff, 'ambiguous synthetic handoff must be present')
  assert(ambiguousHandoff.identityResolutionStatus === 'ambiguous', 'synthetic handoff must be ambiguous')
  const ambiguousAdmission = buildVenueIdentityAdmissionDiagnostics([ambiguousHandoff]).observations[0]
  assert(ambiguousAdmission, 'ambiguous synthetic admission diagnostic must be present')
  assert(ambiguousAdmission.routeAdmissionStatus === 'rejected_ambiguous_identity', 'ambiguous identity must be rejected by Bearings')
  assert(ambiguousAdmission.routeIdentityEligible === false, 'ambiguous identity must not be route eligible')
  assert(ambiguousAdmission.diagnosticOnly === true, 'ambiguous identity must remain diagnostic-only')
  assert(!ambiguousAdmission.materializedRouteRepresentation, 'ambiguous identity must not materialize')

  const hostileHandoff: FieldInterpretationVenueIdentityHandoff = {
    fieldSourceIdentity: 'stage2c-hostile-source',
    providerProvenance: {
      provider: 'google-places',
      providerRecordId: 'stage2c-hostile-provider',
      sourceQueryLabel: 'stage-2c-hostile',
    },
    sourceFacts: {
      name: 'Stage 2C Hostile',
      city: 'San Jose',
      neighborhood: 'Downtown',
      formattedAddress: '901 Hostile St, San Jose, CA 95113',
      latitude: 37.33,
      longitude: -121.88,
      sourceTypes: ['bar', 'point_of_interest', 'establishment'],
    },
    identityResolutionStatus: 'resolved_provider_only',
    resolvedBaseVenueId: 'live_google_stage2c-hostile-provider',
    algorithmVersion: 'venue_identity_resolution.v1',
    physicalPlaceKeyVersion: 'physical_place_key.v1',
    physicalPlaceKeySerialization: 'physical_place_key.v1\ncity=san-jose\naddress=901 hostile st\n'+
      'discriminator=none',
    issuedProviderOnlyCanonicalsSource: 'empty_stage_2a_no_durable_registry',
  }
  const hostileAdmission = buildVenueIdentityAdmissionDiagnostics([hostileHandoff]).observations[0]
  assert(hostileAdmission, 'hostile admission diagnostic must be present')
  assert(hostileAdmission.routeAdmissionStatus === 'rejected_provider_derived_identity', 'live_google_* must be rejected by Bearings')
  assert(hostileAdmission.routeIdentityEligible === false, 'hostile identity must not be route eligible')
  assert(hostileAdmission.diagnosticOnly === true, 'hostile identity must remain diagnostic-only')
  assert(!hostileAdmission.materializedRouteRepresentation, 'hostile identity must not materialize')
}

async function main(): Promise<void> {
  try {
    process.env.VITE_ID8_BUILD_PROVIDER_SUPPLY = 'true'
    installMockFetch()

    const corpusHash = validateIdentityEvidenceCorpusFile(CORPUS_PATH, {
      expectedRowCount: EXPECTED_CORPUS_COUNT,
      expectedSha256: EXPECTED_CORPUS_SHA256,
      label: 'Stage 0 identity evidence before Stage 2C proof',
    }).canonicalSha256

    const original = await runBuildScenario('original')
    const reversed = await runBuildScenario('reversed')
    const shuffled = await runBuildScenario('shuffled')

    assertBuildScenario(original)
    assertBuildScenario(reversed)
    assertBuildScenario(shuffled)
    assertStableSnapshots([snapshotResult(original), snapshotResult(reversed), snapshotResult(shuffled)])
    assertSyntheticAmbiguousAndHostile()

    assert(directProviderFetchAttemptCount === 0, `direct provider calls occurred: ${directProviderFetchAttemptCount}`)
    assert(hostedFetchAttemptCount === 0, `hosted fetch calls occurred: ${hostedFetchAttemptCount}`)

    process.stdout.write(
      JSON.stringify(
        {
          proof: 'stage_2c_build_provider_identity_admission',
          resolvedStatic: {
            providerRecordId: 'ChIJkV6TlrDMj4ARIPxsqSMrdr4',
            emittedVenueId: 'sj-haberdasher',
          },
          emittedVenueIds: original.opportunity?.nearbyCandidates.map((venue) => venue.id).sort() ?? [],
          providerOnlyCleanObservations: original.diagnostics.venueIdentityAdmissions.filter(
            (observation) => observation.routeAdmissionStatus === 'admitted_resolved_provider_only',
          ).length,
          pendingObservations: original.diagnostics.venueIdentityAdmissions.filter(
            (observation) => observation.routeAdmissionStatus === 'rejected_pending_identity',
          ).length,
          duplicateGroupCount: original.diagnostics.venueIdentityAdmissionGroups.filter(
            (group) => group.memberCount > 1,
          ).length,
          orderIndependence: 'original_reversed_shuffled_pass',
          syntheticAmbiguous: 'rejected_ambiguous_identity',
          hostileLiveGoogle: 'rejected_provider_derived_identity',
          directProviderFetchAttemptCount,
          hostedFetchAttemptCount,
          fieldProxyFetchAttemptCount,
          preservedCorpusHash: corpusHash,
        },
        null,
        2,
      ) + '\n',
    )
    process.stdout.write('stage 2c build provider identity admission: passed\n')
  } finally {
    globalThis.fetch = originalFetch
    if (originalSupplyFlag === undefined) {
      delete process.env.VITE_ID8_BUILD_PROVIDER_SUPPLY
    } else {
      process.env.VITE_ID8_BUILD_PROVIDER_SUPPLY = originalSupplyFlag
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
