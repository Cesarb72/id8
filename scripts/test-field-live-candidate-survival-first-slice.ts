import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { curatedVenues } from '../src/data/venues.ts'
import { buildExperienceLens } from '../src/domain/intent/buildExperienceLens.ts'
import { normalizeIntent } from '../src/domain/intent/normalizeIntent.ts'
import {
  buildFieldLiveCandidateSurvivalDiagnostics,
  classifyFieldLiveCandidateSurvival,
  mergeEvidenceBearingLiveCandidatesForRetrieval,
  retrieveVenues,
} from '../src/domain/retrieval/retrieveVenues.ts'
import type { FieldTextSearchResponse } from '../src/domain/field/fieldProxyTypes.ts'
import type { QualityGateStatus } from '../src/domain/types/normalization.ts'
import type { Venue } from '../src/domain/types/venue.ts'

const baseVenue = curatedVenues[0]

function liveVenue(
  id: string,
  qualityGateStatus: QualityGateStatus,
  sourceOverrides: Partial<Venue['source']> = {},
): Venue {
  return {
    ...baseVenue,
    id,
    name: `Live ${id}`,
    city: 'San Jose',
    neighborhood: 'Downtown',
    driveMinutes: 5,
    category: 'cafe',
    subcategory: 'coffee shop',
    isActive: true,
    source: {
      ...baseVenue.source,
      normalizedFromRawType: 'raw-place',
      sourceOrigin: 'live',
      provider: 'google-places',
      providerRecordId: `places/${id}`,
      formattedAddress: `${id} Market St, San Jose, CA`,
      latitude: 37.334 + id.length * 0.001,
      longitude: -121.889 - id.length * 0.001,
      sourceQueryLabel: 'coffee_books_cafe',
      rating: 4.6,
      reviewCount: 128,
      sourceConfidence: 0.92,
      completenessScore: 0.9,
      qualityScore: qualityGateStatus === 'approved' ? 0.86 : 0.58,
      openNow: true,
      hoursKnown: true,
      likelyOpenForCurrentWindow: true,
      timeConfidence: 0.82,
      hoursPressureLevel: 'none',
      hoursPressureNotes: [],
      hoursDemotionApplied: false,
      hoursSuppressionApplied: false,
      sourceTypes: ['cafe', 'coffee_shop'],
      missingFields: [],
      inferredFields: [],
      qualityGateStatus,
      qualityGateNotes: [],
      approvalBlockers: qualityGateStatus === 'approved' ? [] : ['quality_below_approval_floor'],
      demotionReasons: qualityGateStatus === 'demoted' ? ['quality_gate_demoted_for_fixture'] : [],
      suppressionReasons: qualityGateStatus === 'suppressed' ? ['quality_gate_suppressed_for_fixture'] : [],
      ...sourceOverrides,
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
      used: 10,
      remaining: 3,
    },
    results: [
      {
        provider: 'google_places',
        providerRecordId: 'phase-3aj-approved-live-place',
        displayName: 'Phase 3AJ Live Coffee House',
        formattedAddress: '88 South Market St, San Jose, CA',
        shortFormattedAddress: '88 S Market St',
        primaryType: 'cafe',
        types: ['cafe', 'coffee_shop', 'establishment'],
        editorialSummary: 'A local craft coffee shop with quiet tables, evening espresso, and book-friendly pacing.',
        businessStatus: 'OPERATIONAL',
        currentOpeningHours: {
          openNow: true,
          weekdayDescriptions: ['Friday: 7:00 AM - 10:00 PM'],
        },
        regularOpeningHours: {
          openNow: true,
          weekdayDescriptions: ['Friday: 7:00 AM - 10:00 PM'],
        },
        rating: 4.8,
        userRatingCount: 420,
        websiteUri: 'https://example.invalid/phase-3aj-live-coffee',
        location: {
          latitude: 37.3345,
          longitude: -121.8895,
        },
        sourceMode: 'live',
        rawPayloadAvailable: false,
        fetchedAt: Date.UTC(2026, 6, 24),
        completenessHints: {
          hasAddress: true,
          hasLocation: true,
          hasHours: true,
          hasPrimaryType: true,
          hasRating: true,
        },
      },
      {
        provider: 'google_places',
        providerRecordId: 'phase-3aj-demoted-live-place',
        displayName: 'Starbucks',
        formattedAddress: '90 South Market St, San Jose, CA',
        shortFormattedAddress: '90 S Market St',
        primaryType: 'cafe',
        types: ['cafe'],
        businessStatus: 'OPERATIONAL',
        rating: 4.1,
        userRatingCount: 3000,
        location: {
          latitude: 37.3347,
          longitude: -121.8897,
        },
        sourceMode: 'live',
        rawPayloadAvailable: false,
        fetchedAt: Date.UTC(2026, 6, 24),
        completenessHints: {
          hasAddress: true,
          hasLocation: true,
          hasHours: false,
          hasPrimaryType: true,
          hasRating: true,
        },
      },
      {
        provider: 'google_places',
        providerRecordId: 'phase-3an-outside-envelope-live-place',
        displayName: 'Phase 3AN Outside Envelope Coffee',
        formattedAddress: '500 Far Away Ave, San Jose, CA',
        shortFormattedAddress: '500 Far Away Ave',
        primaryType: 'cafe',
        types: ['cafe', 'coffee_shop', 'establishment'],
        businessStatus: 'OPERATIONAL',
        currentOpeningHours: {
          openNow: true,
          weekdayDescriptions: ['Friday: 7:00 AM - 10:00 PM'],
        },
        rating: 4.7,
        userRatingCount: 220,
        location: {
          latitude: 37.365,
          longitude: -121.925,
        },
        sourceMode: 'live',
        rawPayloadAvailable: false,
        fetchedAt: Date.UTC(2026, 6, 24),
        completenessHints: {
          hasAddress: true,
          hasLocation: true,
          hasHours: true,
          hasPrimaryType: true,
          hasRating: true,
        },
      },
      {
        provider: 'google_places',
        providerRecordId: 'phase-3an-missing-location-live-place',
        displayName: 'Phase 3AN Missing Location Coffee',
        formattedAddress: '77 Unknown Block, San Jose, CA',
        shortFormattedAddress: '77 Unknown Block',
        primaryType: 'cafe',
        types: ['cafe', 'coffee_shop', 'establishment'],
        businessStatus: 'OPERATIONAL',
        currentOpeningHours: {
          openNow: true,
          weekdayDescriptions: ['Friday: 7:00 AM - 10:00 PM'],
        },
        rating: 4.5,
        userRatingCount: 180,
        sourceMode: 'live',
        rawPayloadAvailable: false,
        fetchedAt: Date.UTC(2026, 6, 24),
        completenessHints: {
          hasAddress: true,
          hasLocation: false,
          hasHours: true,
          hasPrimaryType: true,
          hasRating: true,
        },
      },
    ],
    diagnostics: {
      purpose: 'retrieval_supply',
      queryHash: `phase-3aj-${queryLabel}`,
      providerStatus: 'mocked',
      resultCount: 4,
      callConsumed: false,
    },
  }
}

async function assertRetrieveVenuesUsesSurvivalCarrier(): Promise<void> {
  const originalFetch = globalThis.fetch
  let fieldProxyCalls = 0
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
    return new Response(JSON.stringify(buildMockFieldResponse(body.queryLabel ?? 'unknown')), {
      headers: {
        'Content-Type': 'application/json',
      },
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
      livePocketHint: {
        pocketId: 'downtown-san-jose',
        pocketLabel: 'Downtown San Jose',
        centroid: { lat: 37.3345, lng: -121.8895 },
        radiusM: 650,
        source: 'district_intelligence',
        city: 'San Jose',
        locationLabel: 'Downtown San Jose, San Jose',
      },
      starterPack: {
        id: 'coffee-books',
        title: 'Coffee & Books',
        description: 'No-provider diagnostic starter pack for Field pocket diagnostics.',
        primaryAnchor: 'cozy',
        distanceMode: 'nearby',
      },
    })
    assert.equal(fieldProxyCalls, 1)
    assert(
      retrieval.venues.some((venue) => venue.source.sourceOrigin === 'live'),
      'retrieveVenues must return approved evidence-bearing live candidates in final Field retrieval visibility.',
    )
    assert.equal(retrieval.stageCounts.finalLive > 0, true)
    assert.equal(retrieval.sourceMode.countsBySource.live > 0, true)
    const survivalDiagnostics = retrieval.sourceMode.liveCandidateSurvivalDiagnostics ?? []
    assert(
      survivalDiagnostics.some(
        (diagnostic) =>
          diagnostic.status === 'eligible' &&
          diagnostic.dropReason === 'admitted_evidence_bearing_live_candidate' &&
          diagnostic.proofEligible === true,
      ),
      'runtime retrieval diagnostics must mark approved evidence-bearing live candidates as admitted.',
    )
    assert(
      survivalDiagnostics.every((diagnostic) => typeof diagnostic.dropReason === 'string'),
      'runtime retrieval diagnostics must expose sanitized live candidate survival/drop reasons.',
    )
    const eligibleDiagnostic = survivalDiagnostics.find(
      (diagnostic) => diagnostic.status === 'eligible',
    )
    assert.equal(eligibleDiagnostic?.qualityVerdict, 'approved')
    assert.equal(eligibleDiagnostic?.primaryQualityReason, 'approved')
    assert.equal(eligibleDiagnostic?.hasProviderPlaceId, true)
    assert.equal(eligibleDiagnostic?.hasFormattedAddress, true)
    assert.equal(eligibleDiagnostic?.hasLocation, true)
    assert.equal(eligibleDiagnostic?.hasCategoriesTypes, true)
    assert.equal(eligibleDiagnostic?.hasHoursOpenStatus, true)
    assert.equal(eligibleDiagnostic?.hasRating, true)
    assert.equal(eligibleDiagnostic?.hasUserRatingCount, true)

    const candidateDiagnostics = retrieval.sourceMode.liveCandidatesByQuery.flatMap(
      (query) => query.candidates ?? [],
    )
    const keptCandidate = candidateDiagnostics.find((candidate) =>
      candidate.name.includes('Live Coffee House'),
    )
    assert.equal(keptCandidate?.filterVerdict, 'kept')
    assert.equal(keptCandidate?.fieldCandidateClass, 'canonical_live_candidate')
    assert.equal(keptCandidate?.proofEligible, true)
    assert.equal(keptCandidate?.diagnosticOnly, false)
    assert.equal(keptCandidate?.hasLocationEvidence, true)
    assert.equal(keptCandidate?.hasFormattedAddressEvidence, true)
    assert.equal(keptCandidate?.hasProviderIdEvidence, true)
    assert.equal(keptCandidate?.distanceMargin?.status, 'inside_by')
    assert.equal(typeof keptCandidate?.candidateDistanceFromPocketCenterM, 'number')
    assert.equal(typeof keptCandidate?.pocketRadiusThresholdM, 'number')
    assert(
      keptCandidate?.selectedPocketEnvelope?.includes('Downtown San Jose'),
      'kept candidate must report the selected pocket envelope.',
    )

    const outsideCandidate = candidateDiagnostics.find((candidate) =>
      candidate.name.includes('Outside Envelope Coffee'),
    )
    assert.equal(outsideCandidate?.filterVerdict, 'rejected_outside_selected_envelope')
    assert.equal(outsideCandidate?.fieldCandidateClass, 'provisional_live_candidate')
    assert.equal(outsideCandidate?.proofEligible, false)
    assert.equal(outsideCandidate?.diagnosticOnly, true)
    assert.equal(outsideCandidate?.dropReason, 'field_source_pocket_filter_outside_selected_envelope')
    assert.equal(outsideCandidate?.hasLocationEvidence, true)
    assert.equal(outsideCandidate?.distanceMargin?.status, 'outside_by')
    assert.equal(
      retrieval.venues.some((venue) => venue.id === outsideCandidate?.venueId),
      false,
      'provisional_live_candidate must remain out of retrieval.venues.',
    )

    const missingLocationCandidate = candidateDiagnostics.find((candidate) =>
      candidate.name.includes('Missing Location Coffee'),
    )
    assert.equal(missingLocationCandidate?.filterVerdict, 'rejected_missing_location')
    assert.equal(missingLocationCandidate?.fieldCandidateClass, 'blocked_live_candidate')
    assert.equal(missingLocationCandidate?.proofEligible, false)
    assert.equal(missingLocationCandidate?.diagnosticOnly, true)
    assert.equal(missingLocationCandidate?.dropReason, 'field_source_pocket_filter_missing_location')
    assert.equal(missingLocationCandidate?.hasLocationEvidence, false)
    assert.equal(missingLocationCandidate?.distanceMargin?.status, 'unknown')

    const rollups = retrieval.sourceMode.liveDiagnosticRollups
    assert.equal(rollups?.rejectedOutsideSelectedEnvelopeCount, 1)
    assert.equal(rollups?.rejectedMissingLocationCount, 1)
    assert.equal(rollups?.liveSurvivalEligibleCount, 1)
    assert.equal(rollups?.canonicalLiveCandidateCount, 1)
    assert.equal(rollups?.provisionalLiveCandidateCount, 1)
    assert.equal(rollups?.blockedLiveCandidateCount >= 1, true)
  } finally {
    globalThis.fetch = originalFetch
  }
}

async function run(): Promise<void> {
  const curatedFallback = {
    ...baseVenue,
    id: 'curated-static-fallback',
    source: {
      ...baseVenue.source,
      sourceOrigin: 'curated',
    },
  } satisfies Venue

  const approvedLive = liveVenue('approved-live', 'approved')
  const demotedLive = liveVenue('demoted-live', 'demoted')
  const suppressedLive = liveVenue('suppressed-live', 'suppressed')
  const missingEvidenceLive = liveVenue('missing-address-live', 'approved', {
    formattedAddress: undefined,
  })

  const approvedDecision = classifyFieldLiveCandidateSurvival(approvedLive)
  assert.equal(approvedDecision.status, 'eligible')
  const approvedDiagnostic = buildFieldLiveCandidateSurvivalDiagnostics([approvedLive])[0]
  assert.equal(approvedDiagnostic.fieldCandidateClass, 'canonical_live_candidate')
  assert.equal(approvedDiagnostic.proofEligible, true)
  assert.equal(approvedDiagnostic.diagnosticOnly, false)
  const approvedMerged = mergeEvidenceBearingLiveCandidatesForRetrieval(
    [curatedFallback],
    [approvedLive],
  )
  assert(
    approvedMerged.some((venue) => venue.id === approvedLive.id),
    'approved evidence-bearing live candidate must survive into Field retrieval visibility.',
  )
  const survivedApproved = approvedMerged.find((venue) => venue.id === approvedLive.id)
  assert.equal(survivedApproved?.source.providerRecordId, approvedLive.source.providerRecordId)
  assert.equal(survivedApproved?.source.formattedAddress, approvedLive.source.formattedAddress)
  assert.equal(survivedApproved?.source.latitude, approvedLive.source.latitude)
  assert.equal(survivedApproved?.source.longitude, approvedLive.source.longitude)
  assert.deepEqual(survivedApproved?.source.sourceTypes, approvedLive.source.sourceTypes)
  assert.equal(survivedApproved?.source.rating, approvedLive.source.rating)
  assert.equal(survivedApproved?.source.reviewCount, approvedLive.source.reviewCount)
  const survivedApprovedSource = survivedApproved?.source as Record<string, unknown> | undefined
  assert.equal(survivedApprovedSource ? 'websiteUri' in survivedApprovedSource : false, false)
  assert.equal(survivedApprovedSource ? 'phone' in survivedApprovedSource : false, false)

  const demotedDecision = classifyFieldLiveCandidateSurvival(demotedLive)
  assert.equal(demotedDecision.status, 'blocked_demoted')
  assert(demotedDecision.reasons.includes('quality_gate_demoted'))
  const demotedDiagnostic = buildFieldLiveCandidateSurvivalDiagnostics([demotedLive])[0]
  assert.equal(demotedDiagnostic.fieldCandidateClass, 'blocked_live_candidate')
  assert.equal(demotedDiagnostic.dropReason, 'retrieval_live_candidate_blocked:demoted')
  assert.equal(demotedDiagnostic.proofEligible, false)
  assert.equal(demotedDiagnostic.diagnosticOnly, true)
  assert.equal(demotedDiagnostic.qualityVerdict, 'demoted')
  assert.equal(demotedDiagnostic.hasProviderPlaceId, true)
  assert.equal(demotedDiagnostic.hasFormattedAddress, true)
  assert.equal(demotedDiagnostic.hasLocation, true)
  assert.equal(demotedDiagnostic.hasCategoriesTypes, true)
  assert.equal(demotedDiagnostic.hasRating, true)
  assert.equal(demotedDiagnostic.hasUserRatingCount, true)
  const demotedMerged = mergeEvidenceBearingLiveCandidatesForRetrieval(
    [curatedFallback],
    [demotedLive],
  )
  assert(
    !demotedMerged.some((venue) => venue.id === demotedLive.id),
    'demoted live candidate must not be silently promoted into canonical retrieval eligibility.',
  )

  const suppressedDecision = classifyFieldLiveCandidateSurvival(suppressedLive)
  assert.equal(suppressedDecision.status, 'blocked_suppressed')
  const suppressedDiagnostic = buildFieldLiveCandidateSurvivalDiagnostics([suppressedLive])[0]
  assert.equal(suppressedDiagnostic.fieldCandidateClass, 'blocked_live_candidate')
  assert.equal(suppressedDiagnostic.proofEligible, false)
  assert.equal(suppressedDiagnostic.diagnosticOnly, true)
  const suppressedMerged = mergeEvidenceBearingLiveCandidatesForRetrieval(
    [curatedFallback],
    [suppressedLive],
  )
  assert(
    !suppressedMerged.some((venue) => venue.id === suppressedLive.id),
    'suppressed live candidate must remain blocked from scored retrieval.',
  )

  const missingEvidenceDecision = classifyFieldLiveCandidateSurvival(missingEvidenceLive)
  assert.equal(missingEvidenceDecision.status, 'blocked_missing_evidence')
  assert(missingEvidenceDecision.reasons.includes('missing_formatted_address'))
  const missingEvidenceDiagnostic = buildFieldLiveCandidateSurvivalDiagnostics([missingEvidenceLive])[0]
  assert.equal(missingEvidenceDiagnostic.fieldCandidateClass, 'blocked_live_candidate')
  assert.equal(missingEvidenceDiagnostic.proofEligible, false)
  assert.equal(missingEvidenceDiagnostic.diagnosticOnly, true)
  const missingEvidenceMerged = mergeEvidenceBearingLiveCandidatesForRetrieval(
    [curatedFallback],
    [missingEvidenceLive],
  )
  assert(
    !missingEvidenceMerged.some((venue) => venue.id === missingEvidenceLive.id),
    'live candidate with missing lock evidence must not be inferred or backfilled.',
  )

  const staticOnly = mergeEvidenceBearingLiveCandidatesForRetrieval([curatedFallback], [])
  assert.equal(staticOnly.length, 1)
  assert.equal(staticOnly[0].source.sourceOrigin, 'curated')
  assert.equal(classifyFieldLiveCandidateSurvival(curatedFallback).status, 'blocked_not_live')
  const curatedDiagnostic = buildFieldLiveCandidateSurvivalDiagnostics([curatedFallback])[0]
  assert.equal(curatedDiagnostic.fieldCandidateClass, 'curated_static_candidate')
  assert.equal(curatedDiagnostic.proofEligible, false)
  assert.equal(curatedDiagnostic.diagnosticOnly, true)

  const lockHandoffSource = readFileSync(
    'src/app/services/live/contractEntryLockHandoff.ts',
    'utf8',
  )
  assert(
    lockHandoffSource.includes('missing_formatted_address'),
    'lock handoff must still fail closed on missing formatted address.',
  )
  assert(
    lockHandoffSource.includes('missing_coordinates'),
    'lock handoff must still fail closed on missing coordinates.',
  )
  const normalizationSource = readFileSync('src/domain/types/normalization.ts', 'utf8')
  const providerTypesSource = readFileSync('src/domain/providers/providerTypes.ts', 'utf8')
  assert(
    providerTypesSource.includes('websiteUri?: string'),
    'ProviderVenue can receive websiteUri before normalization.',
  )
  assert(
    !normalizationSource.includes('websiteUri?:') && !normalizationSource.includes('website?:'),
    'website is not_supported_by_current_field_carrier in VenueSourceMetadata.',
  )
  assert(
    !providerTypesSource.includes('phone') && !normalizationSource.includes('phone'),
    'phone is not_supported_by_current_field_carrier.',
  )
  const liveRunnerSource = readFileSync('scripts/test-phase-3-mvp-proof-gate-live.ts', 'utf8')
  assert(
    liveRunnerSource.includes('provisionalInScoredVenues') &&
      liveRunnerSource.includes('provisionalInSelectedRoute') &&
      liveRunnerSource.includes('provisionalInRetrievalVenues') &&
      liveRunnerSource.includes('provisionalInRolePools') &&
      liveRunnerSource.includes('provisionalArtifactEligible') &&
      liveRunnerSource.includes('provisionalLockEligible'),
    'live proof runner must report whether provisional candidates leak into scored venues or route selection.',
  )

  await assertRetrieveVenuesUsesSurvivalCarrier()

  console.log('phase 3AJ field live candidate survival first slice: PASS')
  console.log('provider calls consumed: 0')
}

await run()
