import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { buildExperienceLens } from '../src/domain/intent/buildExperienceLens.ts'
import { normalizeIntent } from '../src/domain/intent/normalizeIntent.ts'
import { retrieveVenues } from '../src/domain/retrieval/retrieveVenues.ts'
import type { FieldTextSearchResponse } from '../src/domain/field/fieldProxyTypes.ts'
import type {
  BearingsCandidateAdmissibilityDiagnostic,
  LiveQueryCandidateDispositionDiagnostics,
} from '../src/domain/types/diagnostics.ts'

type A5Decision =
  | 'admitted_route_eligible'
  | 'rejected_outside_envelope'
  | 'rejected_near_boundary_or_ambiguous'
  | 'blocked_before_bearings_missing_location'

interface A5ProofRow {
  name: string
  canonicalVenueId: string
  providerPlaceId: string
  requestedRole: string
  fieldEvidenceStatus: string
  interpretationIdentityStatus: string
  districtPocketId: string
  districtEnvelope: string
  distanceFromPocketCenterM: number | null
  pocketRadiusThresholdM: number | null
  distanceMarginStatus: string
  distanceMarginM: number | null
  bearingsOwner: string
  bearingsDecision: string
  bearingsReason: string
  q5Classification: string
  routeEligibilityConsequence: string
  finalMaskingCheck: string
  decision: A5Decision
}

interface A5ProofResult {
  providerCallsConsumed: number
  fieldProxyCalls: number
  rows: A5ProofRow[]
}

const POCKET = {
  pocketId: 'downtown-san-jose',
  pocketLabel: 'Downtown San Jose',
  centroid: { lat: 37.3345, lng: -121.8895 },
  radiusM: 650,
  source: 'district_intelligence' as const,
  city: 'San Jose',
  locationLabel: 'Downtown San Jose, San Jose',
}

function providerRecord(
  providerRecordId: string,
  displayName: string,
  formattedAddress: string,
  location?: { latitude: number; longitude: number },
): FieldTextSearchResponse['results'][number] {
  return {
    provider: 'google_places',
    providerRecordId,
    displayName,
    formattedAddress,
    shortFormattedAddress: displayName,
    primaryType: 'cafe',
    types: ['cafe', 'coffee_shop', 'establishment'],
    editorialSummary: 'A deterministic no-provider A5 proof fixture with complete Field evidence.',
    businessStatus: 'OPERATIONAL',
    currentOpeningHours: {
      openNow: true,
      weekdayDescriptions: ['Friday: 7:00 AM - 10:00 PM'],
    },
    regularOpeningHours: {
      openNow: true,
      weekdayDescriptions: ['Friday: 7:00 AM - 10:00 PM'],
    },
    rating: 4.7,
    userRatingCount: 240,
    websiteUri: `https://example.invalid/${providerRecordId}`,
    ...(location ? { location } : {}),
    sourceMode: 'live',
    rawPayloadAvailable: false,
    fetchedAt: Date.UTC(2026, 6, 24),
    completenessHints: {
      hasAddress: true,
      hasLocation: Boolean(location),
      hasHours: true,
      hasPrimaryType: true,
      hasRating: true,
    },
  }
}

function buildMockFieldResponse(queryLabel: string): FieldTextSearchResponse {
  return {
    ok: true,
    cache: 'miss',
    budget: {
      date: '2026-07-24',
      cap: 13,
      used: 0,
      remaining: 13,
    },
    results: [
      providerRecord(
        'a5-provider-inside',
        'A5 Inside Envelope Coffee',
        '12 South 1st St, San Jose, CA 95113',
        {
          latitude: 37.3345,
          longitude: -121.8895,
        },
      ),
      providerRecord(
        'a5-provider-outside',
        'A5 Outside Envelope Coffee',
        '500 Far Away Ave, San Jose, CA 95113',
        {
          latitude: 37.365,
          longitude: -121.925,
        },
      ),
      providerRecord(
        'a5-provider-near-boundary',
        'A5 Near Boundary Coffee',
        '16 South 1st St, San Jose, CA 95113',
        {
          latitude: 37.3426,
          longitude: -121.8895,
        },
      ),
      providerRecord(
        'a5-provider-missing-location',
        'A5 Missing Location Coffee',
        '77 South 1st St, San Jose, CA 95113',
      ),
    ],
    diagnostics: {
      purpose: 'retrieval_supply',
      queryHash: `a5-${queryLabel}`,
      providerStatus: 'mocked',
      resultCount: 4,
      callConsumed: false,
    },
  }
}

function allCandidates(
  result: Awaited<ReturnType<typeof retrieveVenues>>,
): LiveQueryCandidateDispositionDiagnostics[] {
  return result.sourceMode.liveCandidatesByQuery.flatMap((query) => query.candidates ?? [])
}

function requireCandidate(
  candidates: LiveQueryCandidateDispositionDiagnostics[],
  providerPlaceId: string,
): LiveQueryCandidateDispositionDiagnostics {
  const candidate = candidates.find((entry) => entry.providerPlaceId === providerPlaceId)
  assert(candidate, `expected candidate for providerPlaceId=${providerPlaceId}`)
  return candidate
}

function requireResolvedIdentity(
  candidate: LiveQueryCandidateDispositionDiagnostics,
): string {
  const resolvedBaseVenueId =
    candidate.venueIdentityHandoff?.resolvedBaseVenueId ?? candidate.venueId
  assert(resolvedBaseVenueId, `expected canonical venue identity for ${candidate.name}`)
  assert.notEqual(
    resolvedBaseVenueId,
    candidate.providerPlaceId,
    `${candidate.name} must not use provider provenance as canonical identity`,
  )
  return resolvedBaseVenueId
}

function fieldEvidenceStatus(candidate: LiveQueryCandidateDispositionDiagnostics): string {
  return [
    candidate.hasProviderIdEvidence ? 'provider_id' : 'missing_provider_id',
    candidate.hasFormattedAddressEvidence ? 'formatted_address' : 'missing_address',
    candidate.hasLocationEvidence ? 'location' : 'missing_location',
    candidate.sourceTypes.length > 0 ? 'source_types' : 'missing_source_types',
  ].join('+')
}

function routeConsequence(candidate: LiveQueryCandidateDispositionDiagnostics): string {
  if (candidate.candidateBoardAdmission && candidate.proofEligible) {
    return 'route_eligible_output'
  }
  if (candidate.filterVerdict === 'rejected_outside_selected_envelope') {
    return 'excluded_from_route_eligible_output'
  }
  if (!candidate.normalizedResult) {
    return 'blocked_before_route_eligible_output'
  }
  return 'diagnostic_only_not_route_eligible'
}

function bearingsDecision(
  candidate: LiveQueryCandidateDispositionDiagnostics,
  diagnostic: BearingsCandidateAdmissibilityDiagnostic | undefined,
): string {
  if (diagnostic) {
    return diagnostic.spatialAdmissibilityStatus
  }
  if (
    candidate.candidateBoardAdmission &&
    candidate.bearingsVenueIdentityAdmission?.routeIdentityEligible
  ) {
    return candidate.bearingsVenueIdentityAdmission.routeAdmissionStatus
  }
  if (candidate.candidateBoardAdmission && candidate.proofEligible) {
    return 'admitted_by_field_source_pocket_filter'
  }
  return 'not_represented_by_current_bearings_candidate_diagnostic'
}

function bearingsReason(
  candidate: LiveQueryCandidateDispositionDiagnostics,
  diagnostic: BearingsCandidateAdmissibilityDiagnostic | undefined,
): string {
  return (
    diagnostic?.blockReason ??
    diagnostic?.upgradeRequirement ??
    (candidate.candidateBoardAdmission &&
    candidate.bearingsVenueIdentityAdmission?.routeIdentityEligible
      ? 'route_identity_eligible'
      : undefined) ??
    candidate.dropReason ??
    candidate.pocketProofDiagnostic?.fieldSourceDecision.reason ??
    'none'
  )
}

function toProofRow(
  candidate: LiveQueryCandidateDispositionDiagnostics,
  decision: A5Decision,
): A5ProofRow {
  const diagnostic = candidate.bearingsCandidateAdmissibility
  const pocket = candidate.pocketProofDiagnostic
  return {
    name: candidate.name,
    canonicalVenueId: requireResolvedIdentity(candidate),
    providerPlaceId: candidate.providerPlaceId ?? 'missing',
    requestedRole: 'start',
    fieldEvidenceStatus: fieldEvidenceStatus(candidate),
    interpretationIdentityStatus:
      candidate.venueIdentityHandoff?.identityResolutionStatus ?? 'not_materialized_after_field_mapping',
    districtPocketId: pocket?.activePocketId ?? 'missing',
    districtEnvelope: candidate.selectedPocketEnvelope ?? 'missing',
    distanceFromPocketCenterM: candidate.candidateDistanceFromPocketCenterM ?? null,
    pocketRadiusThresholdM: candidate.pocketRadiusThresholdM ?? null,
    distanceMarginStatus: candidate.distanceMargin?.status ?? 'unknown',
    distanceMarginM: candidate.distanceMargin?.meters ?? null,
    bearingsOwner:
      diagnostic?.owner ??
      (candidate.candidateBoardAdmission
        ? candidate.bearingsVenueIdentityAdmission?.owner
        : undefined) ??
      'Bearings not reached for this candidate class',
    bearingsDecision: bearingsDecision(candidate, diagnostic),
    bearingsReason: bearingsReason(candidate, diagnostic),
    q5Classification: diagnostic?.q5OutsideEnvelopeCorrectness.classification ?? 'not_applicable',
    routeEligibilityConsequence: routeConsequence(candidate),
    finalMaskingCheck:
      candidate.candidateBoardAdmission || candidate.proofEligible
        ? 'candidate_visible_as_route_eligible'
        : 'no_later_layer_reintroduced_candidate',
    decision,
  }
}

async function runProductionPath(): Promise<A5ProofResult> {
  const originalFetch = globalThis.fetch
  let fieldProxyCalls = 0
  let providerCallsConsumed = 0

  globalThis.fetch = (async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    assert(
      url === '/api/field/text-search' || url.endsWith('/api/field/text-search'),
      `unexpected no-provider fetch url: ${url}`,
    )
    fieldProxyCalls += 1
    const body = typeof init?.body === 'string'
      ? (JSON.parse(init.body) as { queryLabel?: string })
      : {}
    const response = buildMockFieldResponse(body.queryLabel ?? 'unknown')
    providerCallsConsumed += response.diagnostics.callConsumed ? 1 : 0
    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  }) as typeof fetch

  try {
    const intent = normalizeIntent({
      city: 'San Jose',
      primaryVibe: 'cozy',
      persona: 'romantic',
      timeOfDay: 'evening',
      distanceMode: 'nearby',
      groupSize: 2,
    })
    const lens = buildExperienceLens({ intent })
    const retrieval = await retrieveVenues(intent, lens, {
      requestedSourceMode: 'live',
      sourceModeOverrideApplied: true,
      liveEnvelope: {
        liveProviderAllowed: true,
        maxProviderCalls: 1,
        maxQueryLabels: 1,
        maxCenters: 1,
      },
      livePocketHint: POCKET,
      starterPack: {
        id: 'coffee-books',
        title: 'Coffee & Books',
        description: 'No-provider A5 outside-envelope proof starter pack.',
        primaryAnchor: 'cozy',
        distanceMode: 'nearby',
      },
    })

    assert.equal(fieldProxyCalls, 1)
    assert.equal(providerCallsConsumed, 0)
    assert.equal(retrieval.sourceMode.liveFetchAttempted, true)
    assert.equal(retrieval.sourceMode.liveFetchSucceeded, true)
    assert.equal(retrieval.sourceMode.pocketCenteredRetrievalApplied, true)
    assert.equal(retrieval.sourceMode.livePocketHint?.source, 'district_intelligence')
    assert.equal(retrieval.sourceMode.liveFailureVisible, false)

    const candidates = allCandidates(retrieval)
    const inside = requireCandidate(candidates, 'a5-provider-inside')
    const outside = requireCandidate(candidates, 'a5-provider-outside')
    const nearBoundary = requireCandidate(candidates, 'a5-provider-near-boundary')
    const missingLocation = requireCandidate(candidates, 'a5-provider-missing-location')

    assert.equal(inside.fieldCandidateClass, 'canonical_live_candidate')
    assert.equal(inside.candidateBoardAdmission, true)
    assert.equal(inside.proofEligible, true)
    assert.equal(inside.filterVerdict, 'kept')
    assert.equal(inside.bearingsVenueIdentityAdmission?.owner, 'Bearings')
    assert.equal(inside.bearingsVenueIdentityAdmission?.routeIdentityEligible, true)
    assert.equal(
      retrieval.venues.some((venue) => venue.source.providerRecordId === 'a5-provider-inside'),
      true,
    )

    assert.equal(outside.fieldCandidateClass, 'provisional_live_candidate')
    assert.equal(outside.filterVerdict, 'rejected_outside_selected_envelope')
    assert.equal(outside.candidateBoardAdmission, false)
    assert.equal(outside.proofEligible, false)
    assert.equal(outside.bearingsCandidateAdmissibility?.owner, 'Bearings')
    assert.equal(
      outside.bearingsCandidateAdmissibility?.q5OutsideEnvelopeCorrectness.classification,
      'legitimately_outside_envelope',
    )
    assert.equal(outside.bearingsCandidateAdmissibility?.blockReason, 'outside_selected_envelope')
    assert.equal(
      retrieval.venues.some((venue) => venue.source.providerRecordId === 'a5-provider-outside'),
      false,
    )

    assert.equal(nearBoundary.fieldCandidateClass, 'provisional_live_candidate')
    assert.equal(nearBoundary.filterVerdict, 'rejected_outside_selected_envelope')
    assert.equal(nearBoundary.candidateBoardAdmission, false)
    assert.equal(
      nearBoundary.bearingsCandidateAdmissibility?.q5OutsideEnvelopeCorrectness.classification,
      'near_boundary_or_ambiguous',
    )
    assert.equal(
      retrieval.venues.some((venue) => venue.source.providerRecordId === 'a5-provider-near-boundary'),
      false,
    )

    assert.equal(missingLocation.fieldCandidateClass, 'blocked_live_candidate')
    assert.equal(missingLocation.normalizedResult, true)
    assert.equal(missingLocation.filterVerdict, 'rejected_missing_location')
    assert.equal(missingLocation.candidateBoardAdmission, false)
    assert.equal(missingLocation.bearingsCandidateAdmissibility, undefined)
    assert.equal(
      retrieval.venues.some((venue) => venue.source.providerRecordId === 'a5-provider-missing-location'),
      false,
    )

    const rollups = retrieval.sourceMode.liveDiagnosticRollups
    assert.equal(rollups?.pocketFilterKeptCount, 1)
    assert.equal(rollups?.rejectedOutsideSelectedEnvelopeCount, 2)
    assert.equal(rollups?.bearingsCandidateAdmissibilityDiagnosticCount, 2)
    assert.equal(rollups?.q5LegitimatelyOutsideEnvelopeCount, 1)
    assert.equal(rollups?.q5NearBoundaryOrAmbiguousCount, 1)
    assert.equal(rollups?.q5PossiblyFalseDropCount, 0)
    assert.equal(rollups?.q5InsufficientDataCount, 0)

    return {
      providerCallsConsumed,
      fieldProxyCalls,
      rows: [
        toProofRow(inside, 'admitted_route_eligible'),
        toProofRow(outside, 'rejected_outside_envelope'),
        toProofRow(nearBoundary, 'rejected_near_boundary_or_ambiguous'),
        toProofRow(missingLocation, 'blocked_before_bearings_missing_location'),
      ],
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}

function assertResidueGuards(): string[] {
  const retrieveVenuesSource = readFileSync('src/domain/retrieval/retrieveVenues.ts', 'utf8')
  assert(retrieveVenuesSource.includes('fallbackUsed'))
  assert(retrieveVenuesSource.includes('fallbackSources'))
  assert(retrieveVenuesSource.includes('inventoryTruth'))
  assert(retrieveVenuesSource.includes('fixtureInjectionUsed'))

  const routeAuthoritySource = readFileSync('src/app/services/routeAuthority/routeAuthorityService.ts', 'utf8')
  assert(routeAuthoritySource.includes("reasons.push('static_candidate_not_authority')"))
  assert(routeAuthoritySource.includes("reasons.push('provider_shadow_not_authority')"))
  assert(routeAuthoritySource.includes("reasons.push('candidate_draft_not_authority')"))
  assert(routeAuthoritySource.includes("reasons.push(lockBlocked ? 'route_authority_lock_blocked'"))

  const lockHandoffSource = readFileSync('src/app/services/live/contractEntryLockHandoff.ts', 'utf8')
  assert(lockHandoffSource.includes('missing_formatted_address'))
  assert(lockHandoffSource.includes('missing_coordinates'))

  const sandboxPreviewSource = readFileSync(
    'src/app/services/sandbox/curatePreviewQualificationService.ts',
    'utf8',
  )
  assert(sandboxPreviewSource.includes('repairRequested'))
  assert(sandboxPreviewSource.includes('previewScenarioFamily'))

  const phase3ProofSource = readFileSync('scripts/test-phase-3-mvp-proof-gate-live.ts', 'utf8')
  assert(phase3ProofSource.includes('provisionalLeakageGuard'))
  assert(phase3ProofSource.includes('provisionalInScoredVenues=0'))

  return [
    'LEGITIMATE CURRENT PATH: retrieveVenues fallback metadata is visible source-mode truth and does not re-admit rejected A5 provider candidates in this proof.',
    'COMPATIBILITY PATH - STILL REQUIRED: routeAuthority rejects static/provider-shadow/candidate-draft inputs before lock authority.',
    'LEGITIMATE CURRENT PATH: contractEntryLockHandoff fails closed on missing address/coordinates evidence.',
    'COMPATIBILITY PATH - STILL REQUIRED: sandbox curate preview repair is preview-scoped and remains A6 cleanup debt, not an A5 production-path override.',
    'LEGITIMATE CURRENT PATH: phase-3 live proof keeps provisional leakage guarded at the route/Waypoint consumption seam.',
  ]
}

function stableRows(result: A5ProofResult): string {
  return JSON.stringify(result.rows, Object.keys(result.rows[0]).sort())
}

async function run(): Promise<void> {
  const first = await runProductionPath()
  const second = await runProductionPath()
  assert.equal(first.providerCallsConsumed, 0)
  assert.equal(second.providerCallsConsumed, 0)
  assert.equal(first.fieldProxyCalls, 1)
  assert.equal(second.fieldProxyCalls, 1)
  assert.equal(stableRows(first), stableRows(second))

  const rowsByDecision = new Map(first.rows.map((row) => [row.decision, row]))
  assert(rowsByDecision.has('admitted_route_eligible'))
  assert(rowsByDecision.has('rejected_outside_envelope'))
  assert(rowsByDecision.has('rejected_near_boundary_or_ambiguous'))
  assert(rowsByDecision.has('blocked_before_bearings_missing_location'))
  assert.equal(rowsByDecision.get('rejected_outside_envelope')?.bearingsOwner, 'Bearings')
  assert.equal(rowsByDecision.get('rejected_near_boundary_or_ambiguous')?.bearingsOwner, 'Bearings')
  assert.equal(
    rowsByDecision.get('blocked_before_bearings_missing_location')?.bearingsOwner,
    'Bearings not reached for this candidate class',
  )

  const result = {
    providerCallsConsumed: first.providerCallsConsumed + second.providerCallsConsumed,
    fieldProxyCalls: first.fieldProxyCalls + second.fieldProxyCalls,
    cases: first.rows,
    residue: assertResidueGuards(),
  }

  console.log(JSON.stringify(result, null, 2))
  console.log('A5 outside-envelope explanation proof: PASS')
  console.log(`providerCallsConsumed=${result.providerCallsConsumed}`)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
