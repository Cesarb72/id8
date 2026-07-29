import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { buildVenueIdentityAdmissionDiagnostics } from '../src/domain/bearings/buildVenueIdentityAdmission'
import { normalizeVenue } from '../src/domain/normalize/normalizeVenue'
import {
  buildBearingsAdmittedRouteSupplyRawPlaces,
} from '../src/domain/sources/fetchLivePlaces'
import {
  normalizeVenueIdentityEvidence,
  resolveVenueIdentity,
  type StaticCanonicalVenueIdentity,
  type VenueIdentityResolution,
  type VenueIdentityResolutionContext,
  type VenueIdentityResolutionEvidence,
} from '../src/domain/interpretation/venueIdentity'
import type {
  BearingsVenueIdentityAdmissionObservationDiagnostic,
  FieldInterpretationVenueIdentityHandoff,
} from '../src/domain/types/diagnostics'
import type { RawPlace } from '../src/domain/types/rawPlace'

const CORPUS_PATH =
  'src/domain/field/corpus/evidence/provider-corpus-real-1781057364783/provider-corpus-snapshot.provider.json'
const EXPECTED_CORPUS_SHA256 = '9fa6fafbc1fdaf11859bcce709722417760c25f290ed1e84897993f14525f65f'
const EXPECTED_CORPUS_COUNT = 96

const STATIC_CANONICALS: StaticCanonicalVenueIdentity[] = [
  {
    baseVenueId: 'sj-paper-plane',
    name: 'Paper Plane',
    canonicalCityKey: 'san-jose',
    formattedAddress: '72 S 1st St, San Jose, CA 95113',
    providerRecordIds: ['ChIJ2XdOpLzMj4ARkdRQg4ZRVTY'],
  },
  {
    baseVenueId: 'sj-haberdasher',
    name: 'Haberdasher',
    canonicalCityKey: 'san-jose',
    formattedAddress: '43 W San Salvador St, San Jose, CA 95113',
    providerRecordIds: ['ChIJkV6TlrDMj4ARIPxsqSMrdr4'],
  },
  {
    baseVenueId: 'sj-miniboss',
    name: 'MINIBOSS',
    canonicalCityKey: 'san-jose',
    formattedAddress: '52 E Santa Clara St, San Jose, CA 95113',
    providerRecordIds: ['ChIJ399WwE7Nj4ARngCc39Ai0Hw'],
  },
  {
    baseVenueId: 'sj-tech-interactive',
    name: 'The Tech Interactive',
    canonicalCityKey: 'san-jose',
    formattedAddress: '201 S Market St, San Jose, CA 95113',
    providerRecordIds: ['ChIJR8HI1brMj4ARBnFq5rlvpx4'],
  },
]

const STATIC_ROWS = new Set([2, 7, 42, 64])
const DUPLICATE_PAIRS: Array<[number, number]> = [
  [5, 15],
  [18, 50],
  [19, 73],
  [27, 85],
  [53, 74],
]

interface ProviderCorpusSnapshot {
  venues: ProviderCorpusVenue[]
}

interface ProviderCorpusVenue {
  rawPlace: RawPlace
  provider: string
  providerRecordId: string
  support: {
    categoryFamily?: string
  }
}

interface CorpusRow {
  row: number
  rawPlace: RawPlace
  handoff: FieldInterpretationVenueIdentityHandoff
}

interface AdmissionSnapshot {
  observationCount: number
  emittedVenueIds: string[]
  groups: Array<{
    resolvedBaseVenueId: string
    representativeFieldSourceIdentity: string
    memberFieldSourceIdentities: string[]
  }>
  observations: Array<{
    fieldSourceIdentity: string
    routeAdmissionStatus: string
    routeIdentityEligible: boolean
    diagnosticOnly: boolean
    resolvedBaseVenueId: string | null
    materializedRouteRepresentation: boolean
    materializedVenueId: string | null
    duplicateGroupMemberSourceIdentities: string[]
    admissionRejectionReasons: string[]
  }>
}

function main(): void {
  const corpusBytes = readFileSync(CORPUS_PATH)
  const corpusHash = createHash('sha256').update(corpusBytes).digest('hex')
  assert(corpusHash === EXPECTED_CORPUS_SHA256, `corpus hash changed: ${corpusHash}`)

  const corpus = JSON.parse(corpusBytes.toString('utf8')) as ProviderCorpusSnapshot
  assert(corpus.venues.length === EXPECTED_CORPUS_COUNT, `expected 96 corpus observations, got ${corpus.venues.length}`)

  const context = buildResolutionContext(corpus.venues.map(venueToEvidence))
  const corpusRows = corpus.venues.map((venue, index) => buildCorpusRow(venue, index + 1, context))
  const corpusHandoffs = corpusRows.map((row) => row.handoff)
  const corpusAdmission = buildVenueIdentityAdmissionDiagnostics(corpusHandoffs)

  const staticAdmissions = corpusAdmission.observations.filter(
    (observation) => observation.routeAdmissionStatus === 'admitted_resolved_static',
  )
  const providerOnlyAdmissions = corpusAdmission.observations.filter(
    (observation) => observation.routeAdmissionStatus === 'admitted_resolved_provider_only',
  )
  const pendingRejections = corpusAdmission.observations.filter(
    (observation) => observation.routeAdmissionStatus === 'rejected_pending_identity',
  )
  const providerOnlyGroups = corpusAdmission.groups.filter((group) =>
    group.memberFieldSourceIdentities.some((id) =>
      providerOnlyAdmissions.some((observation) => observation.fieldSourceIdentity === id),
    ),
  )
  const staticGroups = corpusAdmission.groups.filter((group) =>
    group.memberFieldSourceIdentities.some((id) =>
      staticAdmissions.some((observation) => observation.fieldSourceIdentity === id),
    ),
  )

  assert(staticAdmissions.length === 4, `expected four resolved-static observations, got ${staticAdmissions.length}`)
  assert(staticGroups.length === 4, `expected four unique resolved-static identities, got ${staticGroups.length}`)
  assert(providerOnlyAdmissions.length === 82, `expected 82 provider-only observation admissions, got ${providerOnlyAdmissions.length}`)
  assert(providerOnlyGroups.length === 77, `expected 77 provider-only unique identities, got ${providerOnlyGroups.length}`)
  assert(pendingRejections.length === 10, `expected ten pending rejection observations, got ${pendingRejections.length}`)
  assert(
    pendingRejections.every((observation) => !observation.materializedRouteRepresentation),
    'pending observations must not materialize route venues',
  )

  for (const observation of [...staticAdmissions, ...providerOnlyAdmissions]) {
    assert(observation.resolvedBaseVenueId, `admitted observation missing resolvedBaseVenueId: ${observation.fieldSourceIdentity}`)
    assert(!isProviderDerived(observation), `admitted ID is provider-derived: ${observation.resolvedBaseVenueId}`)
  }

  const rawPlaces = corpusRows.map((row) => row.rawPlace)
  const routeSupply = buildBearingsAdmittedRouteSupplyRawPlaces({
    rawPlaces,
    admissionResult: corpusAdmission,
  })
  const emittedVenues = routeSupply.rawPlaces.map((rawPlace) => normalizeVenue(rawPlace))
  const emittedVenueIds = emittedVenues.map((venue) => venue.id)
  const uniqueEmittedVenueIds = new Set(emittedVenueIds)

  assert(emittedVenueIds.length === corpusAdmission.groups.length, 'one route venue should emit per admitted canonical group')
  assert(uniqueEmittedVenueIds.size === emittedVenueIds.length, 'no canonical identity should be emitted more than once')
  assert(emittedVenueIds.every((id) => !id.startsWith('live_google_')), 'emitted Venue.id must not use live_google_*')
  assert(
    emittedVenueIds.every((id) => corpusAdmission.groups.some((group) => group.resolvedBaseVenueId === id)),
    'every emitted Venue.id must be a Bearings-admitted canonical identity',
  )
  assert(
    emittedVenues.every((venue) => venue.source.providerRecordId && venue.id !== venue.source.providerRecordId),
    'providerRecordId must remain provenance and not become Venue.id',
  )

  for (const [left, right] of DUPLICATE_PAIRS) {
    const leftObservation = admissionByRow(corpusRows, corpusAdmission.observations, left)
    const rightObservation = admissionByRow(corpusRows, corpusAdmission.observations, right)
    assert(
      leftObservation.resolvedBaseVenueId === rightObservation.resolvedBaseVenueId,
      `duplicate pair ${left}/${right} did not converge`,
    )
    const groupMaterializedCount = corpusAdmission.observations.filter(
      (observation) =>
        observation.resolvedBaseVenueId === leftObservation.resolvedBaseVenueId &&
        observation.materializedRouteRepresentation,
    ).length
    const groupMemberIds = corpusAdmission.observations
      .filter((observation) => observation.resolvedBaseVenueId === leftObservation.resolvedBaseVenueId)
      .map((observation) => `${observation.fieldSourceIdentity}:${observation.materializedRouteRepresentation ? 'materialized' : 'retained'}`)
      .join(',')
    assert(
      groupMaterializedCount === 1,
      `duplicate group for ${left}/${right} should materialize exactly one representative, got ${groupMaterializedCount}; members=${groupMemberIds}`,
    )
  }

  const ambiguousRawPlace = rawPlace({
    id: 'live_google_ambiguous_stage_2b',
    name: 'Ambiguous Stage 2B',
    providerRecordId: 'provider-ambiguous-stage-2b',
    formattedAddress: '10 Match St, San Jose, CA 95113',
    sourceQueryLabel: 'ambiguous',
  })
  const ambiguousHandoff = handoffFromResolution(
    ambiguousRawPlace,
    resolveVenueIdentity({
      evidence: venueToEvidence({
        rawPlace: ambiguousRawPlace,
        provider: 'google-places',
        providerRecordId: ambiguousRawPlace.providerRecordId!,
        support: { categoryFamily: 'dining' },
      }),
      context: {
        staticCanonicals: [
          staticCanonical('sj-ambiguous-a', ambiguousRawPlace.providerRecordId!),
          staticCanonical('sj-ambiguous-b', ambiguousRawPlace.providerRecordId!),
        ],
        issuedProviderOnlyCanonicals: [],
      },
    }),
  )
  const hostileRawPlace = rawPlace({
    id: 'live_google_hostile_source',
    name: 'Hostile Provider ID',
    providerRecordId: 'hostile-provider-id',
    formattedAddress: '99 Hostile St, San Jose, CA 95113',
    sourceQueryLabel: 'hostile',
  })
  const hostileHandoff: FieldInterpretationVenueIdentityHandoff = {
    fieldSourceIdentity: hostileRawPlace.id,
    providerProvenance: {
      provider: 'google-places',
      providerRecordId: hostileRawPlace.providerRecordId,
      sourceQueryLabel: hostileRawPlace.sourceQueryLabel,
    },
    sourceFacts: {
      name: hostileRawPlace.name,
      city: hostileRawPlace.city,
      neighborhood: hostileRawPlace.neighborhood,
      formattedAddress: hostileRawPlace.formattedAddress,
      sourceTypes: hostileRawPlace.sourceTypes ?? [],
    },
    identityResolutionStatus: 'resolved_provider_only',
    resolvedBaseVenueId: 'live_google_hostile_source',
    algorithmVersion: 'venue_identity_resolution.v1',
    physicalPlaceKeyVersion: 'physical_place_key.v1',
    physicalPlaceKeySerialization:
      'physical_place_key.v1\ncity=san-jose\naddress=99 hostile street san jose ca 95113\ndiscriminator=none',
    issuedProviderOnlyCanonicalsSource: 'empty_stage_2a_no_durable_registry',
  }

  const combinedHandoffs = [...corpusHandoffs, ambiguousHandoff, hostileHandoff]
  const combinedRawPlaces = [...rawPlaces, ambiguousRawPlace, hostileRawPlace]
  const combinedAdmission = buildVenueIdentityAdmissionDiagnostics(combinedHandoffs)
  const ambiguousAdmission = requiredAdmission(
    combinedAdmission.observations,
    ambiguousRawPlace.id,
  )
  const hostileAdmission = requiredAdmission(combinedAdmission.observations, hostileRawPlace.id)
  assert(ambiguousAdmission.routeAdmissionStatus === 'rejected_ambiguous_identity', 'ambiguous observation should be rejected')
  assert(ambiguousAdmission.diagnosticOnly, 'ambiguous observation should be diagnostic-only')
  assert(!ambiguousAdmission.materializedRouteRepresentation, 'ambiguous observation must not materialize')
  assert(
    ambiguousAdmission.providerProvenance.providerRecordId === ambiguousRawPlace.providerRecordId,
    'ambiguous rejection should retain provider provenance',
  )
  assert(hostileAdmission.routeAdmissionStatus === 'rejected_provider_derived_identity', 'hostile live_google_* ID should be rejected')
  assert(
    hostileAdmission.admissionRejectionReasons.includes('live_google_identity_form_not_route_bearing'),
    'hostile live_google_* rejection reason should be explicit',
  )

  const combinedRouteSupply = buildBearingsAdmittedRouteSupplyRawPlaces({
    rawPlaces: combinedRawPlaces,
    admissionResult: combinedAdmission,
  })
  assert(
    combinedRouteSupply.rawPlaces.every((place) => place.id !== hostileHandoff.resolvedBaseVenueId),
    'hostile provider-derived identity must not enter route supply',
  )
  assert(
    combinedAdmission.observations.length === combinedHandoffs.length,
    'candidate evidence should remain for every observation',
  )

  const permutationRuns = [
    { label: 'original', handoffs: combinedHandoffs, rawPlaces: combinedRawPlaces },
    { label: 'reversed', handoffs: [...combinedHandoffs].reverse(), rawPlaces: [...combinedRawPlaces].reverse() },
    { label: 'shuffled', handoffs: shuffleDeterministically(combinedHandoffs), rawPlaces: shuffleDeterministically(combinedRawPlaces) },
  ].map((run) => ({
    label: run.label,
    snapshot: snapshotAdmission(run.handoffs, run.rawPlaces),
  }))
  const baseline = permutationRuns[0]!.snapshot
  for (const run of permutationRuns) {
    assert(
      JSON.stringify(run.snapshot) === JSON.stringify(baseline),
      `${run.label} admission snapshot differed from original`,
    )
  }

  const pendingCauseCounts = countBy(
    pendingRejections.map((observation) => observation.retainedInterpretationEvidence.pendingReason ?? 'unknown'),
  )
  const corpusHashAfter = createHash('sha256').update(readFileSync(CORPUS_PATH)).digest('hex')
  assert(corpusHashAfter === corpusHash, `corpus hash changed after proof: ${corpusHashAfter}`)

  console.log('stage 2b bearings venue identity admission proof PASS')
  console.log(`corpus observations=${corpus.venues.length}`)
  console.log(`corpus sha256=${corpusHashAfter}`)
  console.log(`resolved static observations=${staticAdmissions.length}`)
  console.log(`unique resolved static identities=${staticGroups.length}`)
  console.log(`resolved provider-only observations=${providerOnlyAdmissions.length}/92`)
  console.log(`unique resolved provider-only identities=${providerOnlyGroups.length}`)
  console.log(`pending rejections=${pendingRejections.length} causes=${formatCounts(pendingCauseCounts)}`)
  console.log(`ambiguous synthetic rejection=${ambiguousAdmission.routeAdmissionStatus}`)
  console.log(`hostile live_google rejection=${hostileAdmission.routeAdmissionStatus}`)
  console.log('duplicate convergence pairs=5/15,18/50,19/73,27/85,53/74')
  console.log('determinism=original/reversed/shuffled equivalent')
  console.log(`emitted canonical venue count=${emittedVenueIds.length}`)
  console.log(`emitted static venue count=${staticGroups.length}`)
  console.log(`emitted provider-only venue count=${providerOnlyGroups.length}`)
  console.log(`emitted venue ids sample=${emittedVenueIds.slice(0, 8).join(',')}`)
  console.log('emitted live_google ids=0')
  console.log('candidate evidence retained for every observation=yes')
  console.log('provider calls=0')
  console.log('hosted calls=0')
}

function buildCorpusRow(
  venue: ProviderCorpusVenue,
  row: number,
  context: VenueIdentityResolutionContext,
): CorpusRow {
  const rawPlace = venue.rawPlace
  return {
    row,
    rawPlace,
    handoff: handoffFromResolution(
      rawPlace,
      resolveVenueIdentity({
        evidence: venueToEvidence(venue),
        context,
      }),
    ),
  }
}

function handoffFromResolution(
  rawPlace: RawPlace,
  resolution: VenueIdentityResolution,
): FieldInterpretationVenueIdentityHandoff {
  const resolvedBaseVenueId =
    resolution.status === 'static_canonical' || resolution.status === 'provider_only_canonical'
      ? resolution.baseVenueId
      : undefined
  const physicalPlaceKey =
    'physicalPlaceKey' in resolution ? resolution.physicalPlaceKey : undefined
  const physicalPlaceKeySerialization =
    'physicalPlaceKeySerialization' in resolution
      ? resolution.physicalPlaceKeySerialization
      : undefined
  return {
    fieldSourceIdentity: rawPlace.id,
    providerProvenance: {
      ...(rawPlace.provider ? { provider: rawPlace.provider } : {}),
      ...(rawPlace.providerRecordId ? { providerRecordId: rawPlace.providerRecordId } : {}),
      ...(rawPlace.sourceQueryLabel ? { sourceQueryLabel: rawPlace.sourceQueryLabel } : {}),
    },
    sourceFacts: {
      name: rawPlace.name,
      ...(rawPlace.city ? { city: rawPlace.city } : {}),
      ...(rawPlace.neighborhood ? { neighborhood: rawPlace.neighborhood } : {}),
      ...(rawPlace.formattedAddress ? { formattedAddress: rawPlace.formattedAddress } : {}),
      ...(typeof rawPlace.latitude === 'number' && typeof rawPlace.longitude === 'number'
        ? { latitude: rawPlace.latitude, longitude: rawPlace.longitude }
        : {}),
      sourceTypes: rawPlace.sourceTypes ?? rawPlace.placeTypes ?? [],
    },
    identityResolutionStatus:
      resolution.status === 'static_canonical'
        ? 'resolved_static'
        : resolution.status === 'provider_only_canonical'
          ? 'resolved_provider_only'
          : resolution.status,
    ...(resolvedBaseVenueId ? { resolvedBaseVenueId } : {}),
    ...(resolution.status === 'pending' ? { pendingReason: resolution.pendingReason } : {}),
    ...(resolution.status === 'ambiguous' ? { ambiguityReason: resolution.pendingReason } : {}),
    algorithmVersion: resolution.algorithmVersion,
    ...(physicalPlaceKey?.identityKeyVersion ? { physicalPlaceKeyVersion: physicalPlaceKey.identityKeyVersion } : {}),
    ...(physicalPlaceKeySerialization ? { physicalPlaceKeySerialization } : {}),
    issuedProviderOnlyCanonicalsSource: 'empty_stage_2a_no_durable_registry',
  }
}

function buildResolutionContext(evidenceRows: VenueIdentityResolutionEvidence[]): VenueIdentityResolutionContext {
  const normalizedRows = evidenceRows.map((evidence) => normalizeVenueIdentityEvidence(evidence))
  const addressGroups = new Map<string, Set<string>>()

  for (const evidence of normalizedRows) {
    if (!evidence.normalizedQualifiedStreetAddress || !evidence.hasQualifiedStreetAddress) {
      continue
    }
    const group = addressGroups.get(evidence.normalizedQualifiedStreetAddress) ?? new Set<string>()
    group.add(evidence.normalizedVenueName)
    addressGroups.set(evidence.normalizedQualifiedStreetAddress, group)
  }

  const requiredDiscriminatorAddressKeys = new Set<string>()
  for (const evidence of normalizedRows) {
    if (!evidence.normalizedQualifiedStreetAddress) {
      continue
    }
    const hasExplicitMultiTenantSignal =
      (evidence.sourceTypes ?? []).some((type) => type === 'food_court') ||
      evidence.normalizedVenueName.includes('food hall') ||
      evidence.normalizedVenueName.includes('food truck') ||
      /\bmarket\b/.test(evidence.normalizedVenueName) ||
      evidence.normalizedVenueName.includes('valley fair')
    const distinctNamesAtAddress = (addressGroups.get(evidence.normalizedQualifiedStreetAddress)?.size ?? 0) > 1
    if (hasExplicitMultiTenantSignal || distinctNamesAtAddress) {
      requiredDiscriminatorAddressKeys.add(evidence.normalizedQualifiedStreetAddress)
    }
  }

  return {
    staticCanonicals: STATIC_CANONICALS,
    requiredDiscriminatorAddressKeys: [...requiredDiscriminatorAddressKeys],
  }
}

function venueToEvidence(venue: ProviderCorpusVenue): VenueIdentityResolutionEvidence {
  return {
    displayName: venue.rawPlace.name,
    city: venue.rawPlace.city,
    locality: venue.rawPlace.neighborhood,
    formattedAddress: venue.rawPlace.formattedAddress,
    coordinates:
      typeof venue.rawPlace.latitude === 'number' && typeof venue.rawPlace.longitude === 'number'
        ? { lat: venue.rawPlace.latitude, lng: venue.rawPlace.longitude }
        : undefined,
    categoryFamily: venue.support.categoryFamily,
    sourceTypes: venue.rawPlace.sourceTypes ?? venue.rawPlace.placeTypes,
    providerProvenance: {
      provider: venue.provider,
      providerRecordId: venue.providerRecordId,
    },
  }
}

function staticCanonical(baseVenueId: string, providerRecordId: string): StaticCanonicalVenueIdentity {
  return {
    baseVenueId,
    canonicalCityKey: 'san-jose',
    name: 'Ambiguous Stage 2B',
    formattedAddress: '10 Match St, San Jose, CA 95113',
    providerRecordIds: [providerRecordId],
  }
}

function admissionByRow(
  corpusRows: CorpusRow[],
  observations: BearingsVenueIdentityAdmissionObservationDiagnostic[],
  row: number,
): BearingsVenueIdentityAdmissionObservationDiagnostic {
  const fieldSourceIdentity = corpusRows.find((entry) => entry.row === row)?.rawPlace.id
  assert(fieldSourceIdentity, `missing corpus row ${row}`)
  return requiredAdmission(observations, fieldSourceIdentity)
}

function requiredAdmission(
  observations: BearingsVenueIdentityAdmissionObservationDiagnostic[],
  fieldSourceIdentity: string,
): BearingsVenueIdentityAdmissionObservationDiagnostic {
  const observation = observations.find((entry) => entry.fieldSourceIdentity === fieldSourceIdentity)
  assert(observation, `missing admission observation for ${fieldSourceIdentity}`)
  return observation
}

function snapshotAdmission(
  handoffs: FieldInterpretationVenueIdentityHandoff[],
  rawPlaces: RawPlace[],
): AdmissionSnapshot {
  const admissionResult = buildVenueIdentityAdmissionDiagnostics(handoffs)
  const routeSupply = buildBearingsAdmittedRouteSupplyRawPlaces({
    rawPlaces,
    admissionResult,
  })
  return {
    observationCount: admissionResult.observations.length,
    emittedVenueIds: routeSupply.rawPlaces.map((place) => place.id).sort((left, right) => left.localeCompare(right)),
    groups: admissionResult.groups.map((group) => ({
      resolvedBaseVenueId: group.resolvedBaseVenueId,
      representativeFieldSourceIdentity: group.representativeFieldSourceIdentity,
      memberFieldSourceIdentities: group.memberFieldSourceIdentities,
    })),
    observations: admissionResult.observations.map((observation) => ({
      fieldSourceIdentity: observation.fieldSourceIdentity,
      routeAdmissionStatus: observation.routeAdmissionStatus,
      routeIdentityEligible: observation.routeIdentityEligible,
      diagnosticOnly: observation.diagnosticOnly,
      resolvedBaseVenueId: observation.resolvedBaseVenueId ?? null,
      materializedRouteRepresentation: observation.materializedRouteRepresentation,
      materializedVenueId: observation.materializedVenueId ?? null,
      duplicateGroupMemberSourceIdentities: observation.duplicateGroupMemberSourceIdentities,
      admissionRejectionReasons: observation.admissionRejectionReasons,
    })),
  }
}

function shuffleDeterministically<T>(values: T[]): T[] {
  return values
    .map((value, index) => ({ value, key: (index * 17 + 11) % values.length }))
    .sort((left, right) => left.key - right.key)
    .map((entry) => entry.value)
}

function rawPlace(params: {
  id: string
  name: string
  providerRecordId: string
  formattedAddress?: string
  sourceQueryLabel: string
}): RawPlace {
  return {
    rawType: 'place',
    id: params.id,
    name: params.name,
    city: 'San Jose',
    neighborhood: 'Downtown',
    provider: 'google-places',
    providerRecordId: params.providerRecordId,
    sourceOrigin: 'live',
    sourceQueryLabel: params.sourceQueryLabel,
    categoryHint: 'restaurant',
    sourceTypes: ['restaurant'],
    ...(params.formattedAddress ? { formattedAddress: params.formattedAddress } : {}),
  }
}

function isProviderDerived(observation: BearingsVenueIdentityAdmissionObservationDiagnostic): boolean {
  const id = observation.resolvedBaseVenueId?.toLowerCase() ?? ''
  const providerRecordId = observation.providerProvenance.providerRecordId?.toLowerCase()
  return (
    id.startsWith('live_google_') ||
    id === observation.fieldSourceIdentity.toLowerCase() ||
    Boolean(providerRecordId && id === providerRecordId)
  )
}

function countBy(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1
  }
  return counts
}

function formatCounts(counts: Record<string, number>): string {
  return Object.entries(counts)
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([key, count]) => `${key}:${count}`)
    .join(',')
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

main()
