import {
  buildAnchorSelectionFromSearchResult,
  canonicalizeBuildAnchorSelection,
  deriveBuildPlannerAnchor,
  deriveRequiredBuildAnchorForPostPlanner,
  selectBuildAnchorVenue,
} from '../src/app/services/buildAnchorOrchestrationService'
import {
  assertSelectableAnchorSearchResult,
  isSelectableAnchorSearchResult,
  materializeProviderAnchorSearchResults,
  searchAnchorVenues,
  type AnchorSearchResult,
  type SelectableAnchorSearchResult,
} from '../src/domain/search/searchAnchorVenues'
import type { StaticCanonicalVenueIdentity } from '../src/domain/interpretation/venueIdentity'
import type {
  ProviderAnchorSearchObservationResult,
  ProviderAnchorSearchSourceEvidence,
} from '../src/domain/providers/ProviderAdapter'
import type { ProviderVenue } from '../src/domain/providers/providerTypes'
import type { RawPlace } from '../src/domain/types/rawPlace'

const FIELD_PROXY_PATH = '/api/field/text-search'

type Ordering = 'original' | 'reversed' | 'shuffled'

const originalFetch = globalThis.fetch
let ordering: Ordering = 'original'
let fieldProxyFetchAttemptCount = 0
let directProviderFetchAttemptCount = 0
let hostedFetchAttemptCount = 0

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function assertThrows(fn: () => unknown, message: string): void {
  let threw = false
  try {
    fn()
  } catch {
    threw = true
  }
  assert(threw, message)
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
    types: input.types ?? [input.primaryType, 'restaurant', 'point_of_interest', 'establishment'],
    liveMusic: input.primaryType === 'bar' || input.primaryType === 'restaurant',
    servesBeer: true,
    servesWine: true,
    goodForGroups: true,
    goodForChildren: false,
    allowsDogs: false,
    servesVegetarianFood: true,
    editorialSummary: `${input.displayName} mocked Stage 2D provider observation.`,
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
    websiteUri: 'https://example.test/stage-2d',
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
      types: ['bar', 'restaurant', 'point_of_interest', 'establishment'],
    }),
    providerVenue({
      displayName: 'Stage 2D Provider Only',
      formattedAddress: '200 Proof St, San Jose, CA 95113',
      latitude: 37.3312,
      longitude: -121.8878,
      primaryType: 'restaurant',
      providerRecordId: 'stage2d-provider-only',
    }),
    providerVenue({
      displayName: 'Stage 2D Duplicate A',
      formattedAddress: '310 Duplicate St, San Jose, CA 95113',
      latitude: 37.332,
      longitude: -121.889,
      primaryType: 'bar',
      providerRecordId: 'stage2d-duplicate-a',
      types: ['bar', 'restaurant', 'point_of_interest', 'establishment'],
    }),
    providerVenue({
      displayName: 'Stage 2D Duplicate B Different Name',
      formattedAddress: '310 Duplicate St, San Jose, CA 95113',
      latitude: 37.3321,
      longitude: -121.8891,
      primaryType: 'restaurant',
      providerRecordId: 'stage2d-duplicate-b',
    }),
    providerVenue({
      displayName: 'Stage 2D Food Hall',
      formattedAddress: '400 Market St, San Jose, CA 95113',
      latitude: 37.333,
      longitude: -121.8895,
      primaryType: 'restaurant',
      providerRecordId: 'stage2d-pending-food-hall',
      types: ['food_court', 'restaurant', 'point_of_interest', 'establishment'],
    }),
    providerVenue({
      displayName: 'Stage 2D Coordinate Only',
      latitude: 37.334,
      longitude: -121.89,
      primaryType: 'bar',
      providerRecordId: 'stage2d-pending-coordinate-only',
      types: ['bar', 'restaurant', 'point_of_interest', 'establishment'],
    }),
    providerVenue({
      displayName: 'Twin Cafe',
      formattedAddress: '501 Twin St, San Jose, CA 95113',
      latitude: 37.335,
      longitude: -121.891,
      primaryType: 'restaurant',
      providerRecordId: 'stage2d-twin-a',
    }),
    providerVenue({
      displayName: 'Twin Cafe',
      formattedAddress: '502 Twin St, San Jose, CA 95113',
      latitude: 37.336,
      longitude: -121.892,
      primaryType: 'restaurant',
      providerRecordId: 'stage2d-twin-b',
    }),
    providerVenue({
      displayName: 'Stage 2D Missing Id',
      formattedAddress: '900 Missing Id St, San Jose, CA 95113',
      latitude: 37.337,
      longitude: -121.893,
      primaryType: 'restaurant',
      providerRecordId: '',
    }),
  ]
}

function orderProviderObservations(observations: ProviderVenue[], variant: Ordering): ProviderVenue[] {
  if (variant === 'reversed') {
    return observations.slice().reverse()
  }
  if (variant === 'shuffled') {
    return [
      observations[3]!,
      observations[0]!,
      observations[6]!,
      observations[2]!,
      observations[5]!,
      observations[1]!,
      observations[8]!,
      observations[4]!,
      observations[7]!,
    ]
  }
  return observations.slice()
}

function installMockFetch(): void {
  globalThis.fetch = (async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (/googleapis|places\.google|maps\.google/i.test(url)) {
      directProviderFetchAttemptCount += 1
      throw new Error(`Direct provider fetch is forbidden in Stage 2D proof: ${url}`)
    }
    if (url !== FIELD_PROXY_PATH) {
      hostedFetchAttemptCount += 1
      throw new Error(`Unexpected hosted fetch is forbidden in Stage 2D proof: ${url}`)
    }

    fieldProxyFetchAttemptCount += 1
    const mockedResults = orderProviderObservations(buildProviderObservations(), ordering)
    return new Response(
      JSON.stringify({
        ok: true,
        cache: 'miss',
        budget: {
          date: '2026-07-29',
          cap: 3,
          used: fieldProxyFetchAttemptCount,
          remaining: Math.max(0, 3 - fieldProxyFetchAttemptCount),
        },
        diagnostics: {
          source: 'mock-stage-2d',
          requestBody: JSON.parse(String(init?.body ?? '{}')),
        },
        results: mockedResults,
      }),
      {
        headers: { 'content-type': 'application/json' },
        status: 200,
      },
    )
  }) as typeof fetch
}

function selectableResults(results: AnchorSearchResult[]): SelectableAnchorSearchResult[] {
  return results.filter(isSelectableAnchorSearchResult)
}

function providerRecordIdFor(result: SelectableAnchorSearchResult): string | undefined {
  return result.venue.source.providerRecordId
}

function isProviderLooking(value: string | undefined): boolean {
  return Boolean(value && value.trim().toLowerCase().startsWith('live_google_'))
}

function snapshot(results: AnchorSearchResult[]): Record<string, string> {
  const entries = selectableResults(results)
    .map((result) => [
      providerRecordIdFor(result) ?? result.identity.fieldSourceIdentity ?? result.venue.id,
      result.venue.id,
    ] as const)
    .sort((left, right) => left[0].localeCompare(right[0]))
  return Object.fromEntries(entries)
}

function rawPlace(input: {
  id: string
  name: string
  providerRecordId: string
  formattedAddress: string
}): RawPlace {
  return {
    rawType: 'place',
    id: input.id,
    name: input.name,
    city: 'San Jose',
    neighborhood: 'Downtown',
    driveMinutes: 10,
    categoryHint: 'restaurant',
    subcategoryHint: 'restaurant',
    placeTypes: ['restaurant', 'point_of_interest', 'establishment'],
    sourceTypes: ['restaurant', 'point_of_interest', 'establishment'],
    sourceOrigin: 'live',
    provider: 'google-places',
    providerRecordId: input.providerRecordId,
    sourceQueryLabel: 'stage-2d-ambiguous',
    queryTerms: ['stage', '2d'],
    formattedAddress: input.formattedAddress,
    latitude: 37.34,
    longitude: -121.89,
  }
}

function sourceEvidence(raw: RawPlace): ProviderAnchorSearchSourceEvidence {
  return {
    displayName: raw.name,
    formattedAddress: raw.formattedAddress,
    providerRecordId: raw.providerRecordId,
    stableEvidenceKey: `${raw.providerRecordId}\u001f${raw.name}\u001f${raw.formattedAddress}`,
    types: raw.sourceTypes ?? [],
  }
}

function observation(raw: RawPlace): ProviderAnchorSearchObservationResult {
  return {
    kind: 'raw_observation',
    fieldSourceIdentity: raw.id,
    providerRecordId: raw.providerRecordId!,
    rawPlace: raw,
    sourceEvidence: sourceEvidence(raw),
    subtitle: raw.formattedAddress ?? raw.neighborhood ?? raw.city ?? raw.name,
  }
}

async function runSearch(variant: Ordering): Promise<AnchorSearchResult[]> {
  ordering = variant
  return searchAnchorVenues({
    query: 'stage 2d anchor',
    city: 'San Jose',
    chip: 'restaurant',
    sourceMode: 'live',
  })
}

async function main(): Promise<void> {
  installMockFetch()
  try {
    const fallbackResults = await searchAnchorVenues({
      query: 'Paper Plane',
      city: 'San Jose',
    })
    const fallbackSelectable = selectableResults(fallbackResults)
    assert(fallbackSelectable.length > 0, 'static curated fallback should return selectable anchors')
    assert(
      fallbackSelectable.some((result) => result.venue.id === 'sj-paper-plane'),
      'static curated anchor should preserve existing canonical ID',
    )

    const originalResults = await runSearch('original')
    const reversedResults = await runSearch('reversed')
    const shuffledResults = await runSearch('shuffled')
    assert(
      JSON.stringify(snapshot(originalResults)) === JSON.stringify(snapshot(reversedResults)),
      'provider-only selectable identity should be stable under reversed input order',
    )
    assert(
      JSON.stringify(snapshot(originalResults)) === JSON.stringify(snapshot(shuffledResults)),
      'provider-only selectable identity should be stable under shuffled input order',
    )

    const selectables = selectableResults(originalResults)
    const diagnostics = originalResults.filter((result) => !isSelectableAnchorSearchResult(result))
    const haberdasher = selectables.find((result) => providerRecordIdFor(result) === 'ChIJkV6TlrDMj4ARIPxsqSMrdr4')
    assert(haberdasher?.venue.id === 'sj-haberdasher', 'static-converged provider anchor should use static baseVenueId')
    assert(
      haberdasher.venue.source.providerRecordId === 'ChIJkV6TlrDMj4ARIPxsqSMrdr4',
      'static-converged providerRecordId should remain provenance',
    )

    const providerOnly = selectables.find((result) => providerRecordIdFor(result) === 'stage2d-provider-only')
    assert(providerOnly, 'valid provider-only anchor should be selectable')
    assert(!isProviderLooking(providerOnly.venue.id), 'provider-only selectable ID should not be live_google_*')
    assert(providerOnly.venue.id !== 'stage2d-provider-only', 'providerRecordId must not become route identity')
    assert(
      providerOnly.venue.id === snapshot(reversedResults)['stage2d-provider-only'] &&
        providerOnly.venue.id === snapshot(shuffledResults)['stage2d-provider-only'],
      'provider-only resolved identity should repeat across runs and ordering',
    )

    const duplicate = selectables.find((result) =>
      result.identity.duplicateGroupMemberSourceIdentities.some((id) =>
        id.includes('stage2d-duplicate-a') || id.includes('stage2d-duplicate-b'),
      ),
    )
    assert(duplicate, 'duplicate same-place provider observations should materialize one selectable anchor')
    const duplicateSelectables = selectables.filter((result) =>
      result.identity.duplicateGroupMemberSourceIdentities.some((id) =>
        id.includes('stage2d-duplicate-a') || id.includes('stage2d-duplicate-b'),
      ),
    )
    assert(
      duplicateSelectables.length === 1,
      'duplicate same-place provider observations should have exactly one selectable representative',
    )
    assert(
      duplicate.identity.duplicateGroupMemberSourceIdentities.length === 2,
      'duplicate selectable anchor should retain both source observation identities',
    )
    const duplicateNonRepresentativeIds = duplicate.identity.duplicateGroupMemberSourceIdentities
      .filter((fieldSourceIdentity) => fieldSourceIdentity !== duplicate.identity.fieldSourceIdentity)
    assert(
      duplicateNonRepresentativeIds.length === 1,
      'duplicate convergence should identify exactly one non-representative source observation',
    )
    const duplicateNonRepresentativeDiagnostics = diagnostics.filter((result) =>
      duplicateNonRepresentativeIds.includes(result.disposition.fieldSourceIdentity ?? ''),
    )
    assert(
      duplicateNonRepresentativeDiagnostics.length === duplicateNonRepresentativeIds.length,
      'each duplicate non-representative should have an explicit diagnostic-only result',
    )
    for (const diagnostic of duplicateNonRepresentativeDiagnostics) {
      assert(diagnostic.kind === 'diagnostic', 'duplicate non-representative should be diagnostic kind')
      assert(diagnostic.diagnosticOnly === true, 'duplicate non-representative should be diagnostic-only')
      assert(diagnostic.routeIdentityEligible === false, 'duplicate non-representative should not be route-eligible')
      assert(!('venue' in diagnostic), 'duplicate non-representative diagnostic should not expose a Venue')
      assertThrows(
        () => buildAnchorSelectionFromSearchResult(diagnostic),
        'duplicate non-representative should not select through Build anchor helper',
      )
      const duplicateSelection = null
      const duplicateSelectedVenue = selectBuildAnchorVenue({
        isBuildWrapperActive: true,
        selectedBuildAnchor: duplicateSelection,
        buildAnchorResults: [diagnostic],
        selectedBuildAnchorResult: diagnostic,
      })
      const duplicatePlannerAnchor = deriveBuildPlannerAnchor({
        isBuildWrapperActive: true,
        selectedBuildAnchor: duplicateSelection,
      })
      const duplicatePostPlannerAnchor = deriveRequiredBuildAnchorForPostPlanner({
        isBuildWrapperActive: true,
        selectedBuildAnchor: duplicateSelection,
        buildPlannerAnchor: duplicatePlannerAnchor,
      })
      assert(!duplicateSelectedVenue, 'duplicate non-representative should not become a selected or seed Venue')
      assert(!duplicatePlannerAnchor, 'duplicate non-representative should not become a planner anchor')
      assert(!duplicatePostPlannerAnchor, 'duplicate non-representative should not become a required post-planner anchor')
    }

    const twinIds = selectables
      .filter((result) => ['stage2d-twin-a', 'stage2d-twin-b'].includes(providerRecordIdFor(result) ?? ''))
      .map((result) => result.venue.id)
    assert(twinIds.length === 2 && new Set(twinIds).size === 2, 'same-name different-address observations should remain distinct')

    assert(
      diagnostics.some((result) =>
        result.disposition.admission?.retainedInterpretationEvidence.pendingReason ===
        'multi_venue_address_without_unit_data',
      ),
      'multi-tenant missing discriminator should be diagnostic-only',
    )
    assert(
      diagnostics.some((result) => result.disposition.reason === 'rejected_pending_identity'),
      'pending identity should carry a Bearings rejection disposition',
    )
    assert(
      diagnostics.some((result) => result.disposition.reason === 'missing_place_id'),
      'missing providerRecordId should be retained as diagnostic-only evidence',
    )

    const ambiguousRaw = rawPlace({
      id: 'live_google_stage2d_ambiguous',
      name: 'Stage 2D Ambiguous',
      providerRecordId: 'stage2d-ambiguous-provider',
      formattedAddress: '10 Ambiguous St, San Jose, CA 95113',
    })
    const ambiguousStaticCanonicals: StaticCanonicalVenueIdentity[] = [
      {
        baseVenueId: 'sj-stage2d-ambiguous-a',
        providerRecordIds: ['stage2d-ambiguous-provider'],
      },
      {
        baseVenueId: 'sj-stage2d-ambiguous-b',
        providerRecordIds: ['stage2d-ambiguous-provider'],
      },
    ]
    const ambiguousResults = materializeProviderAnchorSearchResults(
      [observation(ambiguousRaw)],
      { staticCanonicalsForResolution: ambiguousStaticCanonicals },
    )
    const ambiguousDiagnostic = ambiguousResults.find((result) => !isSelectableAnchorSearchResult(result))
    assert(ambiguousDiagnostic?.kind === 'diagnostic', 'ambiguous identity should be diagnostic-only')
    assert(
      ambiguousDiagnostic.disposition.reason === 'rejected_ambiguous_identity',
      'ambiguous identity should carry the Bearings ambiguous rejection disposition',
    )
    let directAssertResult: unknown
    let directAssertError: unknown
    try {
      directAssertResult = assertSelectableAnchorSearchResult(ambiguousDiagnostic)
    } catch (error) {
      directAssertError = error
    }
    assert(
      directAssertError instanceof Error &&
        directAssertError.message === 'Diagnostic-only anchor search result cannot be selected.',
      'assertSelectableAnchorSearchResult should throw deterministically for diagnostic input',
    )
    assert(!directAssertResult, 'assertSelectableAnchorSearchResult should not return a selectable result for diagnostic input')
    assert(!('venue' in ambiguousDiagnostic), 'assertSelectableAnchorSearchResult diagnostic input should not expose a Venue')
    assert(
      ambiguousDiagnostic.routeIdentityEligible === false &&
        ambiguousDiagnostic.diagnosticOnly === true &&
        ambiguousDiagnostic.kind === 'diagnostic',
      'assertSelectableAnchorSearchResult diagnostic input should not synthesize or substitute route identity',
    )
    assertThrows(
      () => buildAnchorSelectionFromSearchResult(ambiguousDiagnostic),
      'ambiguous diagnostic should not enter App selection',
    )

    const admitted = providerOnly
    const selection = buildAnchorSelectionFromSearchResult(admitted)
    const selectedVenue = selectBuildAnchorVenue({
      isBuildWrapperActive: true,
      selectedBuildAnchor: selection,
      buildAnchorResults: originalResults,
      selectedBuildAnchorResult: admitted,
    })
    assert(selectedVenue, 'admitted anchor should be selectable through Build anchor helper')
    const plannerAnchor = deriveBuildPlannerAnchor({
      isBuildWrapperActive: true,
      selectedBuildAnchor: selection,
    })
    const postPlannerAnchor = deriveRequiredBuildAnchorForPostPlanner({
      isBuildWrapperActive: true,
      selectedBuildAnchor: selection,
      buildPlannerAnchor: plannerAnchor,
    })
    const selectedIds = [
      admitted.venue.id,
      selection.venueId,
      selectedVenue.id,
      selectedVenue.id,
      plannerAnchor?.venueId,
      postPlannerAnchor?.venueId,
    ]
    assert(
      selectedIds.every((id) => id === admitted.venue.id),
      'selected result, intent anchor, selected Venue, seed Venue, planner anchor, and post-planner anchor IDs should match',
    )

    for (const result of diagnostics) {
      assertThrows(
        () => buildAnchorSelectionFromSearchResult(result),
        'diagnostic-only observations should not select through Build anchor helper',
      )
    }
    assert(
      canonicalizeBuildAnchorSelection({
        venueId: 'live_google_stage2d_hostile',
        name: 'Hostile Provider Identity',
        category: 'restaurant',
        city: 'San Jose',
        neighborhood: 'Downtown',
        providerRecordId: 'stage2d-hostile-provider',
      }) === null,
      'live_google_* route identity should be rejected by Build anchor selection canonicalization',
    )
    assert(
      canonicalizeBuildAnchorSelection({
        venueId: 'stage2d-hostile-provider',
        name: 'Hostile Provider Identity',
        category: 'restaurant',
        city: 'San Jose',
        neighborhood: 'Downtown',
        providerRecordId: 'stage2d-hostile-provider',
      }) === null,
      'providerRecordId route identity should be rejected by Build anchor selection canonicalization',
    )

    assert(
      selectables.every((result) => !isProviderLooking(result.venue.id)),
      'no selectable Stage 2D result should carry live_google_* route identity',
    )
    assert(
      selectables.every((result) => result.venue.id !== result.venue.source.providerRecordId),
      'no selectable Stage 2D result should carry providerRecordId as route identity',
    )

    const dispositionKeys = new Set<string>()
    for (const result of selectables) {
      result.identity.duplicateGroupMemberSourceIdentities.forEach((identity) =>
        dispositionKeys.add(identity),
      )
    }
    for (const result of diagnostics) {
      dispositionKeys.add(
        result.disposition.fieldSourceIdentity ??
          result.disposition.drop?.sourceEvidence.stableEvidenceKey ??
          result.disposition.reason,
      )
    }
    assert(
      dispositionKeys.size === buildProviderObservations().length,
      'every mocked provider observation should have an explicit resolution/admission disposition',
    )
    assert(directProviderFetchAttemptCount === 0, 'direct provider calls should remain zero')
    assert(hostedFetchAttemptCount === 0, 'hosted calls should remain zero')

    console.log('stage 2d build anchor identity ingress proof PASS')
    console.log(`selectable=${selectables.length}`)
    console.log(`diagnostic=${diagnostics.length}`)
    console.log(`fieldProxyFetchAttempts=${fieldProxyFetchAttemptCount}`)
  } finally {
    globalThis.fetch = originalFetch
  }
}

void main().catch((error) => {
  globalThis.fetch = originalFetch
  console.error(error)
  process.exit(1)
})
