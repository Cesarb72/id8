import assert from 'node:assert/strict'

import {
  buildCandidateAdmissibilityDiagnostic,
} from '../src/domain/bearings/buildCandidateAdmissibilityDiagnostics.ts'
import {
  buildVenueIdentityAdmissionDiagnostics,
} from '../src/domain/bearings/buildVenueIdentityAdmission.ts'
import { curatedVenues } from '../src/data/venues.ts'
import { buildExperienceLens } from '../src/domain/intent/buildExperienceLens.ts'
import { normalizeIntent } from '../src/domain/intent/normalizeIntent.ts'
import { normalizeVenue } from '../src/domain/normalize/normalizeVenue.ts'
import {
  dedupeVenues,
  getAdmittedRouteVenueIdentity,
} from '../src/domain/retrieval/dedupeVenues.ts'
import {
  buildFieldLiveCandidateSurvivalDiagnostics,
  retrieveVenues,
} from '../src/domain/retrieval/retrieveVenues.ts'
import {
  buildBearingsAdmittedRouteSupplyRawPlaces,
  resolveStage2AFieldInterpretationVenueIdentityHandoffs,
  type Stage2AFieldIdentityResolutionInput,
} from '../src/domain/sources/fetchLivePlaces.ts'
import type { FieldTextSearchResponse } from '../src/domain/field/fieldProxyTypes.ts'
import type { StaticCanonicalVenueIdentity } from '../src/domain/interpretation/venueIdentity/index.ts'
import type { ProviderCanonicalVenueMapping } from '../src/domain/providers/providerCanonicalVenueMapping.ts'
import type {
  BearingsCandidateAdmissibilityDiagnostic,
  BearingsVenueIdentityAdmissionObservationDiagnostic,
  FieldInterpretationVenueIdentityHandoff,
  FieldToBearingsProvisionalHandoffDiagnostic,
  LiveQueryCandidateDispositionDiagnostics,
} from '../src/domain/types/diagnostics.ts'
import type { RawPlace } from '../src/domain/types/rawPlace.ts'
import type { Venue } from '../src/domain/types/venue.ts'
import {
  AUTHORITATIVE_STAGE0_EVIDENCE_ROW_COUNT,
  AUTHORITATIVE_STAGE0_EVIDENCE_SHA256,
  validateIdentityEvidenceCorpusFile,
} from './identityEvidenceCorpusGuard.ts'

const CORPUS_PATH =
  'src/domain/field/corpus/evidence/provider-corpus-real-1781057364783/provider-corpus-snapshot.provider.json'

type EvidenceAvailability =
  | 'observed'
  | 'not_yet_evaluated'
  | 'not_applicable'
  | 'not_observed'
  | 'not_retained'

type ValueHandling =
  | 'retained_from_owner'
  | 'referenced'
  | 'composed'
  | 'derived'
  | 'legitimately_unavailable'
  | 'missing_unexpectedly'

interface ProofProviderProvenance {
  provider?: string
  providerRecordId?: string
  sourceQueryLabel?: string
  sourceMode?: string
}

interface ProofLocalEvidenceRow {
  runId: string
  carrier: string
  sourceObservationIdentity?: string
  providerProvenance?: ProofProviderProvenance
  resolvedBaseVenueId?: string
  candidateId?: string
  identityResolutionStatus?: string
  samePlaceGroupMembership?: string[]
  districtPocketEvidence?: string
  gateOwner: string
  gateName: string
  evidenceAvailability: EvidenceAvailability
  gateDisposition?: string
  reason?: string
  downstreamConsequence?: string
  producingLayer: string
  valueHandling: ValueHandling
}

interface CharacterizationResults {
  proofRows: ProofLocalEvidenceRow[]
  gaps: string[]
  providerCallsAttempted: number
  fieldProxyCalls: number
  aggregateChecks: Array<{
    name: string
    recomputed: number
    reported: number
  }>
}

function rawPlace(input: {
  id: string
  name: string
  providerRecordId?: string
  formattedAddress?: string
  latitude?: number
  longitude?: number
  sourceTypes?: string[]
  sourceQueryLabel?: string
}): RawPlace {
  return {
    rawType: 'place',
    id: input.id,
    name: input.name,
    city: 'San Jose',
    neighborhood: 'Downtown',
    driveMinutes: 6,
    priceTier: '$$',
    tags: ['proof'],
    shortDescription: 'A4 proof source observation.',
    narrativeFlavor: 'A4 proof source observation.',
    categoryHint: 'cafe',
    subcategoryHint: 'coffee_shop',
    sourceTypes: input.sourceTypes ?? ['cafe', 'point_of_interest', 'establishment'],
    normalizedFromRawType: 'raw-place',
    sourceOrigin: 'live',
    provider: 'google-places',
    ...(input.providerRecordId ? { providerRecordId: input.providerRecordId } : {}),
    ...(input.sourceQueryLabel ? { sourceQueryLabel: input.sourceQueryLabel } : {}),
    ...(input.formattedAddress ? { formattedAddress: input.formattedAddress } : {}),
    ...(typeof input.latitude === 'number' ? { latitude: input.latitude } : {}),
    ...(typeof input.longitude === 'number' ? { longitude: input.longitude } : {}),
  }
}

function mapping(providerRecordId: string, canonicalVenueId: string): ProviderCanonicalVenueMapping {
  return {
    provider: 'google-places',
    providerRecordId,
    canonicalVenueId,
    matchMethod: 'provider_id',
    confidence: 1,
  }
}

function staticCanonical(
  baseVenueId: string,
  name: string,
  formattedAddress: string,
  providerRecordIds: string[] = [],
): StaticCanonicalVenueIdentity {
  return {
    baseVenueId,
    canonicalCityKey: 'san-jose',
    name,
    formattedAddress,
    providerRecordIds,
  }
}

function admissionDisposition(
  admission: BearingsVenueIdentityAdmissionObservationDiagnostic,
): string {
  if (admission.routeIdentityEligible) {
    return 'admitted'
  }
  if (admission.routeAdmissionStatus.includes('ambiguous')) {
    return 'ambiguous'
  }
  if (admission.routeAdmissionStatus.includes('provider_derived')) {
    return 'invalid'
  }
  return 'rejected'
}

function provisionalDisposition(
  handoff: FieldToBearingsProvisionalHandoffDiagnostic,
): string {
  if (handoff.pocketVerdict === 'rejected_outside_selected_envelope') {
    return 'rejected'
  }
  if (handoff.pocketVerdict === 'rejected_missing_location') {
    return 'rejected'
  }
  return 'provisional'
}

function bearingsDisposition(
  diagnostic: BearingsCandidateAdmissibilityDiagnostic,
): string {
  if (diagnostic.overallStatus === 'bearings_blocked') {
    return 'rejected'
  }
  return 'provisional'
}

function handoffRow(runId: string, handoff: FieldInterpretationVenueIdentityHandoff): ProofLocalEvidenceRow {
  return {
    runId,
    carrier: 'FieldInterpretationVenueIdentityHandoff',
    sourceObservationIdentity: handoff.fieldSourceIdentity,
    providerProvenance: handoff.providerProvenance,
    ...(handoff.resolvedBaseVenueId ? { resolvedBaseVenueId: handoff.resolvedBaseVenueId } : {}),
    identityResolutionStatus: handoff.identityResolutionStatus,
    gateOwner: 'Interpretation',
    gateName: 'identity_resolution',
    evidenceAvailability: 'observed',
    gateDisposition: handoff.identityResolutionStatus,
    reason: handoff.pendingReason ?? handoff.ambiguityReason,
    producingLayer: 'Field/Interpretation',
    valueHandling: 'retained_from_owner',
  }
}

function admissionRow(
  runId: string,
  admission: BearingsVenueIdentityAdmissionObservationDiagnostic,
): ProofLocalEvidenceRow {
  return {
    runId,
    carrier: 'BearingsVenueIdentityAdmissionObservationDiagnostic',
    sourceObservationIdentity: admission.fieldSourceIdentity,
    providerProvenance: admission.providerProvenance,
    ...(admission.resolvedBaseVenueId ? { resolvedBaseVenueId: admission.resolvedBaseVenueId } : {}),
    identityResolutionStatus: admission.interpretationIdentityResolutionStatus,
    samePlaceGroupMembership: admission.duplicateGroupMemberSourceIdentities,
    gateOwner: admission.owner,
    gateName: 'identity_route_admission',
    evidenceAvailability: 'observed',
    gateDisposition: admissionDisposition(admission),
    reason: admission.admissionRejectionReasons[0],
    downstreamConsequence: admission.materializedRouteRepresentation
      ? 'materialized_route_representation'
      : admission.routeIdentityEligible
        ? 'retained_duplicate_or_diagnostic_only'
        : 'not_materialized',
    producingLayer: 'Bearings',
    valueHandling: 'retained_from_owner',
  }
}

function liveCandidateRow(
  runId: string,
  candidate: LiveQueryCandidateDispositionDiagnostics,
): ProofLocalEvidenceRow {
  const handoff = candidate.venueIdentityHandoff
  const admission = candidate.bearingsVenueIdentityAdmission
  return {
    runId,
    carrier: 'LiveQueryCandidateDispositionDiagnostics',
    sourceObservationIdentity: handoff?.fieldSourceIdentity,
    providerProvenance: {
      provider: handoff?.providerProvenance.provider,
      providerRecordId: handoff?.providerProvenance.providerRecordId ?? candidate.providerPlaceId,
      sourceQueryLabel: handoff?.providerProvenance.sourceQueryLabel,
      sourceMode: candidate.sourceMode,
    },
    resolvedBaseVenueId: admission?.resolvedBaseVenueId ?? handoff?.resolvedBaseVenueId,
    identityResolutionStatus: handoff?.identityResolutionStatus,
    samePlaceGroupMembership: admission?.duplicateGroupMemberSourceIdentities,
    districtPocketEvidence: candidate.selectedPocketEnvelope,
    gateOwner: 'Field',
    gateName: 'live_query_candidate_disposition',
    evidenceAvailability: handoff ? 'observed' : 'not_retained',
    gateDisposition: candidate.fieldCandidateClass,
    reason: candidate.dropReason ?? candidate.filterVerdict,
    downstreamConsequence: candidate.proofEligible ? 'proof_eligible' : 'diagnostic_only',
    producingLayer: 'Field/retrieval',
    valueHandling: handoff ? 'composed' : 'missing_unexpectedly',
  }
}

function assertNoNameOnlyCorrelation(row: ProofLocalEvidenceRow): void {
  assert(
    Boolean(row.sourceObservationIdentity || row.resolvedBaseVenueId || row.candidateId),
    `${row.carrier} attempted correlation without observation, physical, or wrapper identity`,
  )
}

function buildIdentityTopologyProofRows(): ProofLocalEvidenceRow[] {
  const staticAddress = '72 S 1st St, San Jose, CA 95113'
  const staticCanonicals = [
    staticCanonical('sj-paper-plane', 'Paper Plane', staticAddress, ['provider-static-paper']),
  ]
  const sameNameLeft = rawPlace({
    id: 'a4_same_name_left',
    name: 'Twin Coffee',
    providerRecordId: 'provider-twin-left',
    formattedAddress: '100 First St, San Jose, CA 95113',
    sourceQueryLabel: 'a4_same_name',
  })
  const sameNameRight = rawPlace({
    id: 'a4_same_name_right',
    name: 'Twin Coffee',
    providerRecordId: 'provider-twin-right',
    formattedAddress: '200 Second St, San Jose, CA 95113',
    sourceQueryLabel: 'a4_same_name',
  })
  const providerOnlyA = rawPlace({
    id: 'a4_provider_duplicate_a',
    name: 'Fountain Alley Social',
    providerRecordId: 'provider-only-a',
    formattedAddress: '30 Fountain Alley, San Jose, CA 95113',
    sourceQueryLabel: 'a4_provider_only',
  })
  const providerOnlyB = rawPlace({
    id: 'a4_provider_duplicate_b',
    name: 'Fountain Alley Games',
    providerRecordId: 'provider-only-b',
    formattedAddress: '30 Fountain Alley, San Jose, CA 95113',
    sourceQueryLabel: 'a4_provider_only',
  })
  const staticMapped = rawPlace({
    id: 'a4_static_observation',
    name: 'Paper Plane',
    providerRecordId: 'provider-static-paper',
    formattedAddress: staticAddress,
    sourceQueryLabel: 'a4_static',
  })
  const staticByNameAddress = rawPlace({
    id: 'a4_static_provider_observation',
    name: 'Paper Plane',
    providerRecordId: 'provider-static-paper-alternate',
    formattedAddress: staticAddress,
    sourceQueryLabel: 'a4_static',
  })
  const ambiguous = rawPlace({
    id: 'a4_ambiguous_observation',
    name: 'Ambiguous Stage A4',
    providerRecordId: 'provider-ambiguous-a4',
    formattedAddress: '10 Match St, San Jose, CA 95113',
    sourceQueryLabel: 'a4_ambiguous',
  })
  const inputs: Stage2AFieldIdentityResolutionInput[] = [
    { rawPlace: staticMapped, canonicalMapping: mapping('provider-static-paper', 'sj-paper-plane') },
    { rawPlace: staticByNameAddress, staticCanonicalsForResolution: staticCanonicals },
    { rawPlace: providerOnlyA },
    { rawPlace: providerOnlyB },
    { rawPlace: sameNameLeft },
    { rawPlace: sameNameRight },
    {
      rawPlace: ambiguous,
      staticCanonicalsForResolution: [
        staticCanonical('sj-ambiguous-a', 'Ambiguous Stage A4', '10 Match St, San Jose, CA 95113', [
          'provider-ambiguous-a4',
        ]),
        staticCanonical('sj-ambiguous-b', 'Ambiguous Stage A4', '10 Match St, San Jose, CA 95113', [
          'provider-ambiguous-a4',
        ]),
      ],
    },
  ]

  const handoffs = resolveStage2AFieldInterpretationVenueIdentityHandoffs(inputs)
  const handoffRows = [...handoffs.values()].map((handoff) =>
    handoffRow('identity-topology', handoff),
  )
  const admissionResult = buildVenueIdentityAdmissionDiagnostics(handoffs.values())

  const staticA = handoffs.get(staticMapped.id)
  const staticB = handoffs.get(staticByNameAddress.id)
  assert.equal(staticA?.fieldSourceIdentity, staticMapped.id)
  assert.equal(staticB?.fieldSourceIdentity, staticByNameAddress.id)
  assert.equal(staticA?.resolvedBaseVenueId, 'sj-paper-plane')
  assert.equal(staticB?.resolvedBaseVenueId, 'sj-paper-plane')
  assert.notEqual(staticA?.fieldSourceIdentity, staticB?.fieldSourceIdentity)

  const providerA = handoffs.get(providerOnlyA.id)
  const providerB = handoffs.get(providerOnlyB.id)
  assert.equal(providerA?.identityResolutionStatus, 'resolved_provider_only')
  assert.equal(providerB?.identityResolutionStatus, 'resolved_provider_only')
  assert.equal(providerA?.resolvedBaseVenueId, providerB?.resolvedBaseVenueId)
  assert.notEqual(providerA?.fieldSourceIdentity, providerB?.fieldSourceIdentity)

  const sameNameA = handoffs.get(sameNameLeft.id)
  const sameNameB = handoffs.get(sameNameRight.id)
  assert.equal(sameNameA?.sourceFacts.name, sameNameB?.sourceFacts.name)
  assert.notEqual(sameNameA?.resolvedBaseVenueId, sameNameB?.resolvedBaseVenueId)

  const ambiguousHandoff = handoffs.get(ambiguous.id)
  assert.equal(ambiguousHandoff?.identityResolutionStatus, 'ambiguous')

  const hostileHandoff: FieldInterpretationVenueIdentityHandoff = {
    fieldSourceIdentity: 'a4_hostile_observation',
    providerProvenance: {
      provider: 'google-places',
      providerRecordId: 'a4-hostile-provider-id',
      sourceQueryLabel: 'a4_invalid',
    },
    sourceFacts: {
      name: 'Hostile Provider Identity',
      city: 'San Jose',
      neighborhood: 'Downtown',
      formattedAddress: '99 Hostile St, San Jose, CA 95113',
      sourceTypes: ['cafe'],
    },
    identityResolutionStatus: 'resolved_provider_only',
    resolvedBaseVenueId: 'live_google_a4-hostile-provider-id',
    algorithmVersion: 'venue_identity_resolution.v1',
    physicalPlaceKeyVersion: 'physical_place_key.v1',
    physicalPlaceKeySerialization:
      'physical_place_key.v1\ncity=san-jose\naddress=99 hostile street san jose ca 95113\ndiscriminator=none',
    issuedProviderOnlyCanonicalsSource: 'empty_stage_2a_no_durable_registry',
  }
  const invalidAdmission = buildVenueIdentityAdmissionDiagnostics([hostileHandoff]).observations[0]
  assert.equal(invalidAdmission?.routeAdmissionStatus, 'rejected_provider_derived_identity')

  const routeSupply = buildBearingsAdmittedRouteSupplyRawPlaces({
    rawPlaces: inputs.map((input) => input.rawPlace),
    admissionResult,
  })
  const staticRouteMappings = [
    routeSupply.routeNormalizationIdByRawId.get(staticMapped.id),
    routeSupply.routeNormalizationIdByRawId.get(staticByNameAddress.id),
  ].filter((value): value is string => Boolean(value))
  assert.equal(
    staticRouteMappings.length,
    1,
    'same-place static convergence should materialize one representative',
  )
  assert.equal(
    staticRouteMappings[0],
    'sj-paper-plane',
  )

  const admissionRows = admissionResult.observations.map((admission) =>
    admissionRow('identity-topology', admission),
  )
  const invalidRow = admissionRow('identity-topology', invalidAdmission!)
  const groupRows = admissionResult.groups.map((group): ProofLocalEvidenceRow => ({
    runId: 'identity-topology',
    carrier: 'BearingsVenueIdentityAdmissionGroupDiagnostic',
    sourceObservationIdentity: group.representativeFieldSourceIdentity,
    resolvedBaseVenueId: group.resolvedBaseVenueId,
    samePlaceGroupMembership: group.memberFieldSourceIdentities,
    gateOwner: group.owner,
    gateName: 'same_place_identity_group',
    evidenceAvailability: 'observed',
    gateDisposition: 'retained',
    downstreamConsequence: 'one_materialized_route_representation',
    producingLayer: 'Bearings',
    valueHandling: 'retained_from_owner',
  }))

  for (const row of [...handoffRows, ...admissionRows, invalidRow, ...groupRows]) {
    assertNoNameOnlyCorrelation(row)
  }

  return [...handoffRows, ...admissionRows, invalidRow, ...groupRows]
}

function buildManualProvisionalRows(): ProofLocalEvidenceRow[] {
  const handoff: FieldToBearingsProvisionalHandoffDiagnostic = {
    candidateClass: 'provisional_live_candidate',
    proofEligible: false,
    diagnosticOnly: true,
    sourceEvidenceStatus: 'source_evidence_available',
    hasProviderPlaceId: true,
    hasFormattedAddress: true,
    hasLocation: true,
    hasCategoriesTypes: true,
    hasHoursOpenStatus: true,
    hasRating: true,
    hasUserRatingCount: true,
    selectedPocketEnvelope: 'Downtown San Jose (650m)',
    activePocketId: 'downtown-san-jose',
    activePocketLabel: 'Downtown San Jose',
    distanceFromPocketCenterM: 900,
    pocketRadiusThresholdM: 650,
    distanceMargin: { status: 'outside_by', meters: 250 },
    pocketVerdict: 'rejected_outside_selected_envelope',
    primaryProvisionalReason: 'outside_selected_pocket_envelope',
    futureOwnerHint: 'bearings_spatial_admissibility_required',
    currentOwner: 'Field evidence / source diagnostics',
  }
  const diagnostic = buildCandidateAdmissibilityDiagnostic(handoff)
  assert(diagnostic, 'expected Bearings diagnostic from provisional handoff')
  assert.equal(diagnostic.owner, 'Bearings')
  assert.equal(diagnostic.routeEligibilityChanged, false)
  assert.equal(diagnostic.behaviorImpact, false)
  assert.equal(diagnostic.spatialAdmissibilityStatus, 'bearings_outside_selected_envelope')
  assert.equal(diagnostic.planTimeHoursFeasibilityStatus, 'bearings_plan_time_hours_feasibility_required')
  assert.equal(diagnostic.requiredStopSurvivalStatus, 'bearings_admissibility_not_evaluated')

  return [
    {
      runId: 'manual-provisional',
      carrier: 'FieldToBearingsProvisionalHandoffDiagnostic',
      providerProvenance: { providerRecordId: undefined },
      districtPocketEvidence: handoff.selectedPocketEnvelope,
      gateOwner: 'Field',
      gateName: 'field_to_bearings_provisional_handoff',
      evidenceAvailability: 'observed',
      gateDisposition: provisionalDisposition(handoff),
      reason: handoff.primaryProvisionalReason,
      downstreamConsequence: 'requires_bearings_admissibility',
      producingLayer: 'Field',
      valueHandling: 'retained_from_owner',
    },
    {
      runId: 'manual-provisional',
      carrier: 'BearingsCandidateAdmissibilityDiagnostic',
      districtPocketEvidence: handoff.selectedPocketEnvelope,
      gateOwner: diagnostic.owner,
      gateName: 'candidate_admissibility',
      evidenceAvailability: 'observed',
      gateDisposition: bearingsDisposition(diagnostic),
      reason: diagnostic.blockReason ?? diagnostic.upgradeRequirement,
      downstreamConsequence: diagnostic.upgradeRequirement,
      producingLayer: 'Bearings',
      valueHandling: 'derived',
    },
    {
      runId: 'manual-provisional',
      carrier: 'BearingsCandidateAdmissibilityDiagnostic',
      gateOwner: diagnostic.owner,
      gateName: 'required_stop_survival',
      evidenceAvailability: 'not_yet_evaluated',
      gateDisposition: undefined,
      reason: diagnostic.requiredStopSurvivalStatus,
      producingLayer: 'Bearings',
      valueHandling: 'legitimately_unavailable',
    },
  ]
}

function localVenue(input: {
  id: string
  name?: string
  sourceOrigin?: Venue['source']['sourceOrigin']
  providerRecordId?: string
  qualityGateStatus?: Venue['source']['qualityGateStatus']
  sourceOverrides?: Partial<Venue['source']>
}): Venue {
  const base = curatedVenues[0]!
  return {
    ...base,
    id: input.id,
    name: input.name ?? 'A4 Local Venue',
    source: {
      ...base.source,
      normalizedFromRawType: 'raw-place',
      sourceOrigin: input.sourceOrigin ?? 'curated',
      provider: input.providerRecordId ? 'google-places' : undefined,
      providerRecordId: input.providerRecordId,
      formattedAddress: '100 A4 Proof St, San Jose, CA 95113',
      latitude: 37.335,
      longitude: -121.889,
      sourceConfidence: 0.9,
      completenessScore: 0.9,
      qualityScore: 0.85,
      openNow: true,
      hoursKnown: true,
      likelyOpenForCurrentWindow: true,
      timeConfidence: 0.8,
      hoursPressureLevel: 'none',
      hoursPressureNotes: [],
      hoursDemotionApplied: false,
      hoursSuppressionApplied: false,
      sourceTypes: ['cafe', 'point_of_interest', 'establishment'],
      missingFields: [],
      inferredFields: [],
      qualityGateStatus: input.qualityGateStatus ?? 'approved',
      qualityGateNotes: [],
      approvalBlockers: [],
      demotionReasons: input.qualityGateStatus === 'demoted' ? ['a4_demoted'] : [],
      suppressionReasons: input.qualityGateStatus === 'suppressed' ? ['a4_suppressed'] : [],
      ...input.sourceOverrides,
    },
  }
}

function buildDedupeAndSurvivalRows(): ProofLocalEvidenceRow[] {
  const curated = localVenue({
    id: 'a4-shared-canonical',
    name: 'A4 Shared Room',
    sourceOrigin: 'curated',
  })
  const live = localVenue({
    id: 'a4-shared-canonical',
    name: 'A4 Shared Room Live',
    sourceOrigin: 'live',
    providerRecordId: 'places/a4-shared-canonical',
  })
  const dedupe = dedupeVenues([curated, live])
  assert.equal(dedupe.dedupedCount, 1)
  assert.equal(dedupe.losses.length, 1)
  const loss = dedupe.losses[0]!
  assert.equal(loss.duplicateReason, 'same admitted canonical route identity')
  assert.equal(getAdmittedRouteVenueIdentity(dedupe.venues[0]!), 'a4-shared-canonical')

  const approvedLive = localVenue({
    id: 'a4-survival-approved',
    sourceOrigin: 'live',
    providerRecordId: 'places/a4-survival-approved',
  })
  const missingEvidenceLive = localVenue({
    id: 'a4-survival-missing-address',
    sourceOrigin: 'live',
    providerRecordId: 'places/a4-survival-missing-address',
    sourceOverrides: { formattedAddress: undefined },
  })
  const survival = buildFieldLiveCandidateSurvivalDiagnostics([
    approvedLive,
    missingEvidenceLive,
  ])
  const approved = survival.find((diagnostic) => diagnostic.venueId === approvedLive.id)
  const missing = survival.find((diagnostic) => diagnostic.venueId === missingEvidenceLive.id)
  assert.equal(approved?.status, 'eligible')
  assert.equal(missing?.status, 'blocked_missing_evidence')

  return [
    {
      runId: 'dedupe-survival',
      carrier: 'LiveDedupeLossDiagnostics',
      resolvedBaseVenueId: loss.keptVenueId,
      gateOwner: 'retrieval',
      gateName: 'dedupe',
      evidenceAvailability: 'not_retained',
      gateDisposition: 'deduplicated',
      reason: loss.duplicateReason,
      downstreamConsequence: `removed=${loss.removedVenueId};kept=${loss.keptVenueId}`,
      producingLayer: 'retrieval',
      valueHandling: 'derived',
    },
    ...survival.map((diagnostic): ProofLocalEvidenceRow => ({
      runId: 'dedupe-survival',
      carrier: 'FieldLiveCandidateSurvivalDiagnostic',
      sourceObservationIdentity: diagnostic.venueId,
      providerProvenance: {
        providerRecordId: diagnostic.hasProviderPlaceId ? `places/${diagnostic.venueId}` : undefined,
      },
      gateOwner: 'Field',
      gateName: 'live_candidate_survival',
      evidenceAvailability: diagnostic.hasFormattedAddress ? 'observed' : 'not_observed',
      gateDisposition: diagnostic.status === 'eligible' ? 'retained' : 'dropped',
      reason: diagnostic.dropReason,
      downstreamConsequence: diagnostic.proofEligible ? 'retrieval_visible' : 'excluded',
      producingLayer: 'Field/retrieval',
      valueHandling: 'retained_from_owner',
    })),
  ]
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
        editorialSummary: 'A local craft coffee shop with quiet tables and book-friendly pacing.',
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
      queryHash: `a4-${queryLabel}`,
      providerStatus: 'mocked',
      resultCount: 3,
      callConsumed: false,
    },
  }
}

async function buildLiveQueryRows(): Promise<{
  rows: ProofLocalEvidenceRow[]
  aggregateChecks: CharacterizationResults['aggregateChecks']
  fieldProxyCalls: number
}> {
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
        description: 'No-provider diagnostic starter pack for A4 topology characterization.',
        primaryAnchor: 'cozy',
        distanceMode: 'nearby',
      },
    })
    assert.equal(fieldProxyCalls, 1)
    assert.equal(retrieval.sourceMode.liveFetchAttempted, true)
    assert.equal(retrieval.sourceMode.liveCandidatesByQuery.length, 1)
    const candidates = retrieval.sourceMode.liveCandidatesByQuery.flatMap(
      (query) => query.candidates ?? [],
    )
    assert(candidates.length > 0, 'expected retained live query candidate rows')

    const outside = candidates.find((candidate) =>
      candidate.name.includes('Outside Envelope Coffee'),
    )
    assert(outside, 'expected outside-envelope candidate')
    assert.equal(outside.fieldCandidateClass, 'provisional_live_candidate')
    assert(outside.venueIdentityHandoff, 'live query row should nest identity handoff')
    assert(outside.bearingsVenueIdentityAdmission, 'live query row should nest Bearings identity admission')
    assert(outside.fieldToBearingsProvisionalHandoff, 'outside row should nest provisional handoff')
    assert(outside.bearingsCandidateAdmissibility, 'outside row should nest Bearings admissibility')
    assert.equal(outside.bearingsCandidateAdmissibility.routeEligibilityChanged, false)
    assert.equal(
      outside.bearingsCandidateAdmissibility.requiredStopSurvivalStatus,
      'bearings_admissibility_not_evaluated',
    )

    const missingLocation = candidates.find((candidate) =>
      candidate.name.includes('Missing Location Coffee'),
    )
    assert(missingLocation, 'expected missing-location candidate')
    assert.equal(missingLocation.fieldCandidateClass, 'blocked_live_candidate')
    assert.equal(missingLocation.fieldToBearingsProvisionalHandoff, undefined)
    assert.equal(missingLocation.bearingsCandidateAdmissibility, undefined)

    const rollups = retrieval.sourceMode.liveDiagnosticRollups
    assert(rollups, 'expected live diagnostic rollups')
    const recomputedOutside = candidates.filter(
      (candidate) => candidate.filterVerdict === 'rejected_outside_selected_envelope',
    ).length
    const recomputedProvisional = candidates.filter(
      (candidate) => candidate.fieldCandidateClass === 'provisional_live_candidate',
    ).length
    const recomputedHandoffs = candidates.filter(
      (candidate) => Boolean(candidate.fieldToBearingsProvisionalHandoff),
    ).length
    const recomputedBearings = candidates.filter(
      (candidate) => Boolean(candidate.bearingsCandidateAdmissibility),
    ).length
    assert.equal(recomputedOutside, rollups.rejectedOutsideSelectedEnvelopeCount)
    assert.equal(recomputedProvisional, rollups.provisionalLiveCandidateCount)
    assert.equal(recomputedHandoffs, rollups.provisionalHandoffCandidateCount)
    assert.equal(recomputedBearings, rollups.bearingsCandidateAdmissibilityDiagnosticCount)

    return {
      rows: candidates.map((candidate) => liveCandidateRow('live-query-topology', candidate)),
      fieldProxyCalls,
      aggregateChecks: [
        {
          name: 'rejectedOutsideSelectedEnvelopeCount',
          recomputed: recomputedOutside,
          reported: rollups.rejectedOutsideSelectedEnvelopeCount,
        },
        {
          name: 'provisionalLiveCandidateCount',
          recomputed: recomputedProvisional,
          reported: rollups.provisionalLiveCandidateCount,
        },
        {
          name: 'provisionalHandoffCandidateCount',
          recomputed: recomputedHandoffs,
          reported: rollups.provisionalHandoffCandidateCount,
        },
        {
          name: 'bearingsCandidateAdmissibilityDiagnosticCount',
          recomputed: recomputedBearings,
          reported: rollups.bearingsCandidateAdmissibilityDiagnosticCount,
        },
      ],
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}

function assertMaskingBoundaries(rows: ProofLocalEvidenceRow[]): void {
  assert(
    rows.some((row) => row.providerProvenance?.providerRecordId),
    'expected provider provenance to be present in characterized rows',
  )
  assert(
    rows.some((row) => row.resolvedBaseVenueId === 'sj-paper-plane'),
    'expected static supply characterization',
  )
  assert(
    rows.some((row) => row.carrier === 'LiveQueryCandidateDispositionDiagnostics'),
    'expected provider-backed live query characterization',
  )
  assert(
    rows.every((row) => row.gateOwner !== 'Application'),
    'Application must not author characterization truth',
  )
}

async function main(): Promise<void> {
  const corpus = validateIdentityEvidenceCorpusFile(CORPUS_PATH, {
    expectedRowCount: AUTHORITATIVE_STAGE0_EVIDENCE_ROW_COUNT,
    expectedSha256: AUTHORITATIVE_STAGE0_EVIDENCE_SHA256,
    label: 'A4-1 topology characterization corpus guard',
  })
  assert.equal(corpus.rowCount, 96)

  const identityRows = buildIdentityTopologyProofRows()
  const provisionalRows = buildManualProvisionalRows()
  const dedupeAndSurvivalRows = buildDedupeAndSurvivalRows()
  const liveQuery = await buildLiveQueryRows()
  const proofRows = [
    ...identityRows,
    ...provisionalRows,
    ...dedupeAndSurvivalRows,
    ...liveQuery.rows,
  ]

  for (const row of proofRows.filter((candidate) => candidate.carrier !== 'LiveDedupeLossDiagnostics')) {
    if (
      row.carrier === 'FieldToBearingsProvisionalHandoffDiagnostic' ||
      row.carrier === 'BearingsCandidateAdmissibilityDiagnostic'
    ) {
      continue
    }
    assertNoNameOnlyCorrelation(row)
  }
  assertMaskingBoundaries(proofRows)

  const gaps = [
    'FieldToBearingsProvisionalHandoffDiagnostic does not retain source observation identity or provider provenance outside its containing live query row.',
    'BearingsCandidateAdmissibilityDiagnostic does not retain source observation identity or provider provenance outside its containing live query row.',
    'FieldLiveCandidateSurvivalDiagnostic retains venue id and evidence booleans, but not the upstream Field/Interpretation handoff.',
    'LiveDedupeLossDiagnostics retains kept/removed venue ids, but not upstream source observation identity.',
    'Role/support rejection diagnostics remain proof-runner-local or post-hoc and were not covered by this provider-free characterization slice.',
  ]

  const result: CharacterizationResults = {
    proofRows,
    gaps,
    providerCallsAttempted: 0,
    fieldProxyCalls: liveQuery.fieldProxyCalls,
    aggregateChecks: liveQuery.aggregateChecks,
  }

  console.log('a4 candidate evidence topology characterization proof PASS')
  console.log(`corpus observations=${corpus.rowCount}`)
  console.log(`corpus sha256=${corpus.canonicalSha256}`)
  console.log(`proof rows=${result.proofRows.length}`)
  console.log(`provider calls attempted=${result.providerCallsAttempted}`)
  console.log(`mocked field proxy calls=${result.fieldProxyCalls}`)
  console.log(
    `aggregate parity=${result.aggregateChecks
      .map((check) => `${check.name}:${check.recomputed}/${check.reported}`)
      .join(',')}`,
  )
  console.log(`expected gaps=${result.gaps.length}`)
  for (const gap of result.gaps) {
    console.log(`gap=${gap}`)
  }
  console.log('a4 closure pass=no')
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
