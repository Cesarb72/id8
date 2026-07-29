import assert from 'node:assert/strict'

import { curatedMoments } from '../src/data/moments.ts'
import { curatedVenues } from '../src/data/venues.ts'
import {
  buildAdmittedVenueIdentityRouteSupplyRawPlaces,
  buildVenueIdentityAdmissionDiagnostics,
} from '../src/domain/bearings/buildVenueIdentityAdmission.ts'
import { getCrewPolicy } from '../src/domain/intent/getCrewPolicy.ts'
import { buildExperienceLens } from '../src/domain/intent/buildExperienceLens.ts'
import { normalizeIntent } from '../src/domain/intent/normalizeIntent.ts'
import { deriveMomentVenueRecords } from '../src/domain/moments/deriveMomentVenues.ts'
import { normalizeVenue } from '../src/domain/normalize/normalizeVenue.ts'
import { dedupeVenues } from '../src/domain/retrieval/dedupeVenues.ts'
import {
  scoreVenueCollection,
  scoreVenueFit,
} from '../src/domain/retrieval/scoreVenueFit.ts'
import type { ScoredVenue } from '../src/domain/types/arc.ts'
import type { FieldInterpretationVenueIdentityHandoff } from '../src/domain/types/diagnostics.ts'
import type { ExperienceMode, IntentProfile } from '../src/domain/types/intent.ts'
import type { RawPlace } from '../src/domain/types/rawPlace.ts'
import type { Venue } from '../src/domain/types/venue.ts'

type CandidateSnapshot = {
  candidateId: string
  baseVenueId: string
  kind: ScoredVenue['candidateIdentity']['kind']
  venueId: string
  providerRecordId: string | null
  fitScore: number
  roleScores: ScoredVenue['roleScores']
}

type MomentRecord = ReturnType<typeof deriveMomentVenueRecords>[number]

const ALGORITHM_VERSION = 'stage_2e_2_offline_identity_resolution.v1'

function buildIntent(mode: ExperienceMode): IntentProfile {
  return normalizeIntent({
    persona: 'romantic',
    primaryVibe: 'cozy',
    secondaryVibe: 'cultured',
    city: 'San Jose',
    distanceMode: 'nearby',
    mode,
    timeWindow: 'evening',
  })
}

function scoringContext(mode: ExperienceMode = 'build') {
  const intent = buildIntent(mode)
  const lens = buildExperienceLens({ intent })
  const crewPolicy = getCrewPolicy(intent.crew)

  return { intent, lens, crewPolicy }
}

function scoreFixture(venues: Venue[], mode: ExperienceMode = 'build'): ScoredVenue[] {
  const { intent, lens, crewPolicy } = scoringContext(mode)
  return scoreVenueCollection(venues, intent, crewPolicy, lens)
}

function scoreOne(venue: Venue, mode: ExperienceMode = 'build'): ScoredVenue {
  const { intent, lens, crewPolicy } = scoringContext(mode)
  return scoreVenueFit(venue, intent, crewPolicy, lens)
}

function deriveMomentRecords(venues: Venue[], mode: ExperienceMode = 'build'): MomentRecord[] {
  const { intent } = scoringContext(mode)
  return deriveMomentVenueRecords({ intent, venuePool: venues })
}

function snapshotCandidates(candidates: ScoredVenue[]): CandidateSnapshot[] {
  return candidates
    .map((candidate) => ({
      candidateId: candidate.candidateIdentity.candidateId,
      baseVenueId: candidate.candidateIdentity.baseVenueId,
      kind: candidate.candidateIdentity.kind,
      venueId: candidate.venue.id,
      providerRecordId: candidate.venue.source.providerRecordId ?? null,
      fitScore: candidate.fitScore,
      roleScores: candidate.roleScores,
    }))
    .sort((left, right) => left.candidateId.localeCompare(right.candidateId))
}

function wrapperCounts(candidates: ScoredVenue[]): Record<string, number> {
  return candidates.reduce<Record<string, number>>((counts, candidate) => {
    counts[candidate.candidateIdentity.kind] =
      (counts[candidate.candidateIdentity.kind] ?? 0) + 1
    return counts
  }, {})
}

function scoreValueSnapshot(candidate: ScoredVenue): Pick<
  ScoredVenue,
  | 'fitBreakdown'
  | 'fitScore'
  | 'hiddenGemScore'
  | 'lensCompatibility'
  | 'contextSpecificity'
  | 'dominanceControl'
  | 'roleScores'
  | 'stopShapeFit'
> {
  return {
    fitBreakdown: candidate.fitBreakdown,
    fitScore: candidate.fitScore,
    hiddenGemScore: candidate.hiddenGemScore,
    lensCompatibility: candidate.lensCompatibility,
    contextSpecificity: candidate.contextSpecificity,
    dominanceControl: candidate.dominanceControl,
    roleScores: candidate.roleScores,
    stopShapeFit: candidate.stopShapeFit,
  }
}

function byId(id: string): Venue {
  const venue = curatedVenues.find((candidate) => candidate.id === id)
  assert(venue, `missing fixture venue ${id}`)
  return venue
}

function liveVenue(input: {
  id: string
  providerRecordId: string
  name?: string
  formattedAddress?: string
  latitude?: number
  longitude?: number
}): Venue {
  const base = byId('sj-adega-wine-atelier')
  return {
    ...base,
    id: input.id,
    name: input.name ?? base.name,
    source: {
      ...base.source,
      sourceOrigin: 'live',
      provider: 'google-places',
      providerRecordId: input.providerRecordId,
      formattedAddress: input.formattedAddress ?? base.source.formattedAddress,
      latitude: input.latitude ?? base.source.latitude,
      longitude: input.longitude ?? base.source.longitude,
      sourceQueryLabel: 'stage-2e-2-offline-fixture',
    },
  }
}

function rawPlace(input: {
  id: string
  name: string
  formattedAddress: string
  providerRecordId: string
  categoryHint?: RawPlace['categoryHint']
}): RawPlace {
  return {
    rawType: 'place',
    id: input.id,
    name: input.name,
    city: 'San Jose',
    neighborhood: 'Downtown',
    driveMinutes: 7,
    priceTier: '$$',
    categoryHint: input.categoryHint ?? 'bar',
    subcategoryHint: 'stage 2e-2 fixture',
    tags: ['stage-2e-2', 'admitted-ingress'],
    useCases: ['romantic'],
    vibeTags: ['cozy'],
    sourceTypes: ['bar', 'point_of_interest', 'establishment'],
    normalizedFromRawType: 'raw-place',
    sourceOrigin: 'live',
    provider: 'google-places',
    providerRecordId: input.providerRecordId,
    sourceQueryLabel: 'stage-2e-2-admission-boundary',
    sourceConfidence: 0.92,
    formattedAddress: input.formattedAddress,
    latitude: 37.335,
    longitude: -121.889,
    rating: 4.6,
    ratingCount: 120,
    openNow: true,
    businessStatus: 'OPERATIONAL',
    shortDescription: 'Stage 2E-2 admitted-ingress proof fixture.',
    narrativeFlavor: 'Offline fixture preserving upstream admitted identity.',
  }
}

function handoff(input: {
  fieldSourceIdentity: string
  name: string
  providerRecordId?: string
  status: FieldInterpretationVenueIdentityHandoff['identityResolutionStatus']
  resolvedBaseVenueId?: string
  pendingReason?: string
  ambiguityReason?: string
}): FieldInterpretationVenueIdentityHandoff {
  return {
    fieldSourceIdentity: input.fieldSourceIdentity,
    providerProvenance: {
      provider: input.providerRecordId ? 'google-places' : undefined,
      providerRecordId: input.providerRecordId,
      sourceQueryLabel: 'stage-2e-2-admission-boundary',
    },
    sourceFacts: {
      name: input.name,
      city: 'San Jose',
      neighborhood: 'Downtown',
      formattedAddress: '100 Admission Way, San Jose, CA 95113',
      latitude: 37.335,
      longitude: -121.889,
      sourceTypes: ['bar', 'point_of_interest', 'establishment'],
    },
    identityResolutionStatus: input.status,
    resolvedBaseVenueId: input.resolvedBaseVenueId,
    pendingReason: input.pendingReason,
    ambiguityReason: input.ambiguityReason,
    algorithmVersion: ALGORITHM_VERSION,
    physicalPlaceKeyVersion: 'physical_place_key.v1',
    physicalPlaceKeySerialization:
      'physical_place_key.v1\ncity=san-jose\naddress=100-admission-way-san-jose-ca-95113\ndiscriminator=none',
    issuedProviderOnlyCanonicalsSource: 'empty_stage_2a_no_durable_registry',
  }
}

function assertBaseCandidatePreservesAdmittedVenueId(): void {
  const venue = liveVenue({
    id: 'stage2e2-admitted-physical-venue',
    providerRecordId: 'live_google_stage2e2_provider_record',
  })
  const scored = scoreOne(venue)

  assert.equal(scored.candidateIdentity.kind, 'base')
  assert.equal(scored.candidateIdentity.candidateId, venue.id)
  assert.equal(scored.candidateIdentity.baseVenueId, venue.id)
  assert.notEqual(scored.candidateIdentity.baseVenueId, venue.source.providerRecordId)
  assert(!scored.candidateIdentity.baseVenueId.startsWith('live_google_'))
}

function assertMomentCandidateEmissionAndCountDelta(): {
  momentSupplyCount: number
  parentBackedCount: number
  omittedCount: number
  beforeCount: number
  afterCount: number
  wrapperCounts: Record<string, number>
} {
  const records = deriveMomentRecords(curatedVenues)
  const scores = scoreFixture(curatedVenues)
  const momentCandidates = scores.filter(
    (candidate) => candidate.candidateIdentity.kind === 'moment',
  )
  const parentBackedRecords = records.filter((record) =>
    Boolean(
      record.moment.parentPlaceId &&
        curatedVenues.some((venue) => venue.id === record.moment.parentPlaceId),
    ),
  )
  const omittedRecords = records.filter(
    (record) =>
      !record.moment.parentPlaceId ||
      !curatedVenues.some((venue) => venue.id === record.moment.parentPlaceId),
  )
  const emittedMomentIds = new Set(
    momentCandidates.map((candidate) => candidate.candidateIdentity.momentId),
  )

  assert(records.length > 0, 'expected focused fixture to derive moment supply records')
  assert(parentBackedRecords.length > 0, 'expected parent-backed moment supply records')
  assert(omittedRecords.length > 0, 'expected unparented or unresolved-parent moment supply records')
  assert.equal(momentCandidates.length, parentBackedRecords.length)
  assert.equal(records.length - momentCandidates.length, omittedRecords.length)

  for (const record of parentBackedRecords) {
    const emitted = momentCandidates.find(
      (candidate) => candidate.candidateIdentity.momentId === record.moment.id,
    )
    assert(emitted, `parent-backed moment was omitted: ${record.moment.id}`)
    assert.equal(emitted.candidateIdentity.candidateId, `moment::${record.moment.id}`)
    assert.equal(emitted.candidateIdentity.baseVenueId, record.moment.parentPlaceId)
    assert.notEqual(emitted.candidateIdentity.candidateId, emitted.candidateIdentity.baseVenueId)
    assert.equal(emitted.candidateIdentity.parentPlaceId, record.moment.parentPlaceId)
    assert(!emitted.candidateIdentity.baseVenueId.startsWith('moment::'))
    assert(!emitted.candidateIdentity.baseVenueId.startsWith('moment-'))
    assert(!emitted.candidateIdentity.baseVenueId.startsWith('live_google_'))

    const directScore = scoreOne(record.venue)
    assert.deepEqual(scoreValueSnapshot(emitted), scoreValueSnapshot(directScore))
  }

  for (const record of omittedRecords) {
    assert(!emittedMomentIds.has(record.moment.id), `unparented moment was emitted: ${record.moment.id}`)
    assert(curatedMoments.some((moment) => moment.id === record.moment.id && moment.sourceType === record.moment.sourceType))
  }

  const counts = wrapperCounts(scores)
  assert.equal(counts.base, curatedVenues.length)
  assert.equal(counts.moment, parentBackedRecords.length)
  assert((counts.hyperlocal_activation ?? 0) > 0)
  assert.equal(
    curatedVenues.length + records.length + (counts.hyperlocal_activation ?? 0) - scores.length,
    omittedRecords.length,
  )

  return {
    momentSupplyCount: records.length,
    parentBackedCount: parentBackedRecords.length,
    omittedCount: omittedRecords.length,
    beforeCount: curatedVenues.length + records.length + (counts.hyperlocal_activation ?? 0),
    afterCount: scores.length,
    wrapperCounts: counts,
  }
}

function assertSameVenueWrapperStability(): string {
  const scores = scoreFixture(curatedVenues)
  const wrappersByBaseVenueId = new Map<string, ScoredVenue[]>()
  for (const candidate of scores) {
    const candidates = wrappersByBaseVenueId.get(candidate.candidateIdentity.baseVenueId) ?? []
    candidates.push(candidate)
    wrappersByBaseVenueId.set(candidate.candidateIdentity.baseVenueId, candidates)
  }

  const wrapperGroup = [...wrappersByBaseVenueId.entries()].find(([_baseVenueId, candidates]) => {
    const kinds = new Set(candidates.map((candidate) => candidate.candidateIdentity.kind))
    return kinds.has('base') && kinds.has('moment') && kinds.has('hyperlocal_activation')
  })

  assert(wrapperGroup, 'expected one physical Venue to retain base, moment, and activation wrappers')
  const [baseVenueId, candidates] = wrapperGroup
  const candidateIds = new Set(candidates.map((candidate) => candidate.candidateIdentity.candidateId))
  assert(candidateIds.size === candidates.length, 'wrapper candidateIds collapsed')
  assert(candidates.every((candidate) => candidate.candidateIdentity.baseVenueId === baseVenueId))
  assert(candidates.some((candidate) => candidate.candidateIdentity.kind === 'moment'))
  assert(candidates.some((candidate) => candidate.candidateIdentity.kind === 'hyperlocal_activation'))
  return baseVenueId
}

function assertActivationCandidatePreservesBaseVenueIdWhenPresent(): void {
  const scores = scoreFixture(curatedVenues)
  const activationCandidates = scores.filter(
    (candidate) => candidate.candidateIdentity.kind === 'hyperlocal_activation',
  )

  assert(
    activationCandidates.length > 0,
    'expected focused fixture to emit a hyperlocal activation candidate',
  )

  for (const candidate of activationCandidates) {
    assert.equal(candidate.candidateIdentity.baseVenueId, candidate.venue.id)
    assert(
      candidate.candidateIdentity.candidateId.startsWith(`${candidate.venue.id}::activation::`),
      `activation candidateId should remain wrapper-qualified: ${candidate.candidateIdentity.candidateId}`,
    )
    assert.notEqual(candidate.candidateIdentity.candidateId, candidate.candidateIdentity.baseVenueId)
  }
}

function assertPresentationSimilarDistinctVenuesStayDistinct(): void {
  const left = liveVenue({
    id: 'stage2e2-distinct-admitted-a',
    providerRecordId: 'stage2e2-provider-a',
    name: 'Twin Fixture Lounge',
    formattedAddress: '10 Twin St, San Jose, CA 95113',
    latitude: 37.335,
    longitude: -121.889,
  })
  const right = liveVenue({
    id: 'stage2e2-distinct-admitted-b',
    providerRecordId: 'stage2e2-provider-b',
    name: 'Twin Fixture Lounge',
    formattedAddress: '10 Twin St, San Jose, CA 95113',
    latitude: 37.335,
    longitude: -121.889,
  })

  const baseCandidates = scoreFixture([left, right]).filter(
    (candidate) => candidate.candidateIdentity.kind === 'base',
  )

  assert.deepEqual(
    baseCandidates.map((candidate) => candidate.candidateIdentity.baseVenueId).sort(),
    [left.id, right.id],
  )
  assert.deepEqual(
    baseCandidates.map((candidate) => candidate.candidateIdentity.candidateId).sort(),
    [left.id, right.id],
  )
}

function assertProviderProvenanceDoesNotBecomeRouteIdentity(): void {
  const admitted = liveVenue({
    id: 'stage2e2-provider-only-canonical',
    providerRecordId: 'live_google_stage2e2_provider_record',
    name: 'Provider Only Canonical Fixture',
  })
  const liveGoogleHostile = liveVenue({
    id: 'live_google_stage2e2_hostile',
    providerRecordId: 'stage2e2-hostile-provider',
    name: 'Hostile Live Google Fixture',
  })
  const providerRecordHostile = liveVenue({
    id: 'stage2e2-provider-record-hostile',
    providerRecordId: 'stage2e2-provider-record-hostile',
    name: 'Hostile Provider Record Fixture',
  })

  const deduped = dedupeVenues([admitted, liveGoogleHostile, providerRecordHostile])
  assert.deepEqual(deduped.venues.map((venue) => venue.id), [admitted.id])

  const scored = scoreFixture(deduped.venues)
  assert(scored.length > 0)
  for (const candidate of scored) {
    assert.notEqual(candidate.candidateIdentity.baseVenueId, admitted.source.providerRecordId)
    assert.notEqual(candidate.candidateIdentity.candidateId, admitted.source.providerRecordId)
    assert(!candidate.candidateIdentity.baseVenueId.startsWith('live_google_'))
    assert(!candidate.candidateIdentity.candidateId.startsWith('live_google_'))
  }
  assert(
    scored.every((candidate) => candidate.venue.id !== liveGoogleHostile.id),
    'live_google_* diagnostic-only venue reached scoring',
  )
  assert(
    scored.every((candidate) => candidate.venue.id !== providerRecordHostile.id),
    'providerRecordId-as-id diagnostic-only venue reached scoring',
  )
}

function assertAdmissionBoundaryCoverage(): {
  admittedVenueIds: string[]
  diagnosticOnlyCount: number
  routeIdentityEligibleCount: number
} {
  const admittedRaw = rawPlace({
    id: 'field-source-admitted',
    name: 'Admission Boundary Fixture',
    formattedAddress: '100 Admission Way, San Jose, CA 95113',
    providerRecordId: 'stage2e2-admitted-provider-record',
  })
  const pendingRaw = rawPlace({
    id: 'field-source-pending',
    name: 'Pending Boundary Fixture',
    formattedAddress: '200 Admission Way, San Jose, CA 95113',
    providerRecordId: 'stage2e2-pending-provider-record',
  })
  const ambiguousRaw = rawPlace({
    id: 'field-source-ambiguous',
    name: 'Ambiguous Boundary Fixture',
    formattedAddress: '300 Admission Way, San Jose, CA 95113',
    providerRecordId: 'stage2e2-ambiguous-provider-record',
  })
  const liveGoogleRaw = rawPlace({
    id: 'field-source-live-google',
    name: 'Live Google Boundary Fixture',
    formattedAddress: '400 Admission Way, San Jose, CA 95113',
    providerRecordId: 'stage2e2-live-google-provider-record',
  })
  const providerRecordRaw = rawPlace({
    id: 'field-source-provider-record',
    name: 'Provider Record Boundary Fixture',
    formattedAddress: '500 Admission Way, San Jose, CA 95113',
    providerRecordId: 'stage2e2-provider-record-route-id',
  })

  const handoffs = [
    handoff({
      fieldSourceIdentity: admittedRaw.id,
      name: admittedRaw.name,
      providerRecordId: admittedRaw.providerRecordId,
      status: 'resolved_provider_only',
      resolvedBaseVenueId: 'stage2e2-admitted-route-canonical',
    }),
    handoff({
      fieldSourceIdentity: pendingRaw.id,
      name: pendingRaw.name,
      providerRecordId: pendingRaw.providerRecordId,
      status: 'pending',
      pendingReason: 'coordinate_only',
    }),
    handoff({
      fieldSourceIdentity: ambiguousRaw.id,
      name: ambiguousRaw.name,
      providerRecordId: ambiguousRaw.providerRecordId,
      status: 'ambiguous',
      ambiguityReason: 'ambiguous_provider_only_match',
    }),
    handoff({
      fieldSourceIdentity: liveGoogleRaw.id,
      name: liveGoogleRaw.name,
      providerRecordId: liveGoogleRaw.providerRecordId,
      status: 'resolved_provider_only',
      resolvedBaseVenueId: 'live_google_stage2e2_boundary',
    }),
    handoff({
      fieldSourceIdentity: providerRecordRaw.id,
      name: providerRecordRaw.name,
      providerRecordId: providerRecordRaw.providerRecordId,
      status: 'resolved_provider_only',
      resolvedBaseVenueId: providerRecordRaw.providerRecordId,
    }),
  ]

  const admission = buildVenueIdentityAdmissionDiagnostics(handoffs)
  const routeSupply = buildAdmittedVenueIdentityRouteSupplyRawPlaces({
    admissionResult: admission,
    rawPlaces: [admittedRaw, pendingRaw, ambiguousRaw, liveGoogleRaw, providerRecordRaw],
  })
  const admittedVenues = routeSupply.rawPlaces.map((place) => normalizeVenue(place))
  const scored = scoreFixture(admittedVenues)

  assert.deepEqual(routeSupply.rawPlaces.map((place) => place.id), [
    'stage2e2-admitted-route-canonical',
  ])
  assert.equal(admission.groups.length, 1)
  assert.equal(admission.observations.filter((item) => item.routeIdentityEligible).length, 1)
  assert.equal(admission.observations.filter((item) => item.diagnosticOnly).length, 4)
  assert(
    admission.observations.some((item) => item.routeAdmissionStatus === 'rejected_pending_identity'),
  )
  assert(
    admission.observations.some((item) => item.routeAdmissionStatus === 'rejected_ambiguous_identity'),
  )
  assert(
    admission.observations.filter((item) => item.routeAdmissionStatus === 'rejected_provider_derived_identity')
      .length === 2,
  )
  assert(scored.length > 0)
  assert(scored.every((candidate) => candidate.venue.id === 'stage2e2-admitted-route-canonical'))
  assert(
    scored.every(
      (candidate) =>
        candidate.candidateIdentity.baseVenueId === 'stage2e2-admitted-route-canonical',
    ),
  )
  assert(scored.every((candidate) => !candidate.candidateIdentity.baseVenueId.startsWith('live_google_')))
  assert(
    scored.every(
      (candidate) => candidate.candidateIdentity.baseVenueId !== admittedRaw.providerRecordId,
    ),
  )

  return {
    admittedVenueIds: routeSupply.rawPlaces.map((place) => place.id),
    diagnosticOnlyCount: admission.observations.filter((item) => item.diagnosticOnly).length,
    routeIdentityEligibleCount: admission.observations.filter((item) => item.routeIdentityEligible).length,
  }
}

function assertSourceOrderDeterminismAndScoreStability(): void {
  const shuffled = [
    ...curatedVenues.filter((_, index) => index % 2 === 0),
    ...curatedVenues.filter((_, index) => index % 2 === 1),
  ]

  for (const mode of ['build', 'curate', 'surprise'] satisfies ExperienceMode[]) {
    const original = scoreFixture(curatedVenues, mode)
    const reversed = scoreFixture([...curatedVenues].reverse(), mode)
    const deterministicShuffle = scoreFixture(shuffled, mode)

    assert.deepEqual(wrapperCounts(reversed), wrapperCounts(original))
    assert.deepEqual(wrapperCounts(deterministicShuffle), wrapperCounts(original))
    assert.deepEqual(snapshotCandidates(reversed), snapshotCandidates(original))
    assert.deepEqual(snapshotCandidates(deterministicShuffle), snapshotCandidates(original))
  }
}

function main(): void {
  assertBaseCandidatePreservesAdmittedVenueId()
  const countDelta = assertMomentCandidateEmissionAndCountDelta()
  const sameVenueWrapperBaseVenueId = assertSameVenueWrapperStability()
  assertActivationCandidatePreservesBaseVenueIdWhenPresent()
  assertPresentationSimilarDistinctVenuesStayDistinct()
  assertProviderProvenanceDoesNotBecomeRouteIdentity()
  const admissionBoundary = assertAdmissionBoundaryCoverage()
  assertSourceOrderDeterminismAndScoreStability()

  console.log(JSON.stringify({
    countDelta,
    sameVenueWrapperBaseVenueId,
    admissionBoundary,
    forwardFlag:
      'unparented moment candidate exclusion is MVP-scoped and must be revisited when Moment Supply Layer or business_submitted moment pipeline activates',
  }, null, 2))
  console.log('Stage 2E-2 scoring identity guard PASS')
}

main()
