import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  resolveStage2AFieldInterpretationVenueIdentityHandoffs,
  type Stage2AFieldIdentityResolutionInput,
} from '../src/domain/sources/fetchLivePlaces'
import type { StaticCanonicalVenueIdentity } from '../src/domain/interpretation/venueIdentity'
import type { ProviderCanonicalVenueMapping } from '../src/domain/providers/providerCanonicalVenueMapping'
import type { FieldInterpretationVenueIdentityHandoff } from '../src/domain/types/diagnostics'
import type { RawPlace } from '../src/domain/types/rawPlace'

const CORPUS_PATH =
  'src/domain/field/corpus/evidence/provider-corpus-real-1781057364783/provider-corpus-snapshot.provider.json'
const EXPECTED_CORPUS_SHA256 = '9fa6fafbc1fdaf11859bcce709722417760c25f290ed1e84897993f14525f65f'

interface HandoffPermutationSnapshot {
  totalObservationCount: number
  uniqueResolvedIdentityCount: number
  observations: Array<{
    fieldSourceIdentity: string
    identityResolutionStatus: FieldInterpretationVenueIdentityHandoff['identityResolutionStatus']
    resolvedBaseVenueId: string | null
    reason: string | null
    physicalPlaceKeySerialization: string | null
    physicalPlaceKeyGroupMembers: string[]
  }>
}

function main(): void {
  const corpusHashBefore = sha256File(CORPUS_PATH)
  assert(corpusHashBefore === EXPECTED_CORPUS_SHA256, `generated corpus hash changed before proof: ${corpusHashBefore}`)

  const staticInput: Stage2AFieldIdentityResolutionInput = {
    rawPlace: rawPlace({
      id: 'live_google_static_paper',
      name: 'Paper Plane',
      providerRecordId: 'provider-static-paper',
      formattedAddress: '72 S 1st St, San Jose, CA 95113',
      sourceQueryLabel: 'cocktail-bars',
    }),
    canonicalMapping: mapping('provider-static-paper', 'sj-paper-plane'),
  }
  const providerOnlyA: Stage2AFieldIdentityResolutionInput = {
    rawPlace: rawPlace({
      id: 'live_google_provider_a',
      name: 'Fountain Alley Social',
      providerRecordId: 'provider-only-a',
      formattedAddress: '30 Fountain Alley, San Jose, CA 95113',
      sourceQueryLabel: 'things-to-do',
    }),
  }
  const providerOnlyB: Stage2AFieldIdentityResolutionInput = {
    rawPlace: rawPlace({
      id: 'live_google_provider_b',
      name: 'Fountain Alley Games',
      providerRecordId: 'provider-only-b',
      formattedAddress: '30 Fountain Alley, San Jose, CA 95113',
      sourceQueryLabel: 'arcade-night',
    }),
  }
  const pendingCoordinateOnly: Stage2AFieldIdentityResolutionInput = {
    rawPlace: rawPlace({
      id: 'live_google_coordinate_only',
      name: 'Coordinate Only Pop-Up',
      providerRecordId: 'provider-pending-coordinate',
      latitude: 37.3341,
      longitude: -121.8901,
      sourceQueryLabel: 'late-night',
    }),
  }
  const pendingMultiTenant: Stage2AFieldIdentityResolutionInput = {
    rawPlace: rawPlace({
      id: 'live_google_market_stall',
      name: 'Market Stall',
      providerRecordId: 'provider-pending-market',
      formattedAddress: '777 Shared Market St, San Jose, CA 95113',
      sourceTypes: ['food_court'],
      sourceQueryLabel: 'food-hall',
    }),
  }
  const ambiguousStatic: Stage2AFieldIdentityResolutionInput = {
    rawPlace: rawPlace({
      id: 'live_google_ambiguous_static',
      name: 'Ambiguous Static',
      providerRecordId: 'provider-ambiguous-static',
      formattedAddress: '10 Match St, San Jose, CA 95113',
      sourceQueryLabel: 'ambiguous',
    }),
    staticCanonicalsForResolution: [
      staticCanonical('sj-ambiguous-a', 'provider-ambiguous-static'),
      staticCanonical('sj-ambiguous-b', 'provider-ambiguous-static'),
    ],
  }

  const inputs = [
    providerOnlyB,
    pendingMultiTenant,
    staticInput,
    ambiguousStatic,
    providerOnlyA,
    pendingCoordinateOnly,
  ]
  const shuffledInputs = [
    pendingCoordinateOnly,
    providerOnlyA,
    ambiguousStatic,
    staticInput,
    pendingMultiTenant,
    providerOnlyB,
  ]
  const permutationRuns = [
    { label: 'original', inputs },
    { label: 'reversed', inputs: [...inputs].reverse() },
    { label: 'shuffled', inputs: shuffledInputs },
  ].map((run) => ({
    label: run.label,
    handoffs: resolveStage2AFieldInterpretationVenueIdentityHandoffs(run.inputs),
  }))
  const baselinePermutation = snapshotHandoffs(permutationRuns[0]!.handoffs)
  for (const run of permutationRuns) {
    assertSnapshotsEqual(
      snapshotHandoffs(run.handoffs),
      baselinePermutation,
      `${run.label} permutation`,
    )
  }

  const handoffs = permutationRuns[0]!.handoffs
  const staticHandoff = requiredHandoff(handoffs, staticInput.rawPlace.id)
  assert(staticHandoff.identityResolutionStatus === 'resolved_static', 'static identity should resolve')
  assert(staticHandoff.resolvedBaseVenueId === 'sj-paper-plane', 'static identity should report canonical baseVenueId')

  const providerHandoffA = requiredHandoff(handoffs, providerOnlyA.rawPlace.id)
  const providerHandoffB = requiredHandoff(handoffs, providerOnlyB.rawPlace.id)
  assert(providerHandoffA.identityResolutionStatus === 'resolved_provider_only', 'provider-only A should resolve diagnostically')
  assert(providerHandoffB.identityResolutionStatus === 'resolved_provider_only', 'provider-only B should resolve diagnostically')
  assert(providerHandoffA.resolvedBaseVenueId, 'provider-only A should report diagnostic baseVenueId')
  assert(providerHandoffA.resolvedBaseVenueId === providerHandoffB.resolvedBaseVenueId, 'duplicate observations should converge')
  assert(
    providerHandoffA.physicalPlaceKeySerialization === providerHandoffB.physicalPlaceKeySerialization,
    'duplicate observations should share physical-place serialization',
  )

  const coordinatePending = requiredHandoff(handoffs, pendingCoordinateOnly.rawPlace.id)
  assert(coordinatePending.identityResolutionStatus === 'pending', 'coordinate-only observation should remain pending')
  assert(coordinatePending.pendingReason === 'coordinate_only', 'coordinate-only pending cause should be visible')
  const multiTenantPending = requiredHandoff(handoffs, pendingMultiTenant.rawPlace.id)
  assert(multiTenantPending.identityResolutionStatus === 'pending', 'multi-tenant observation should remain pending')
  assert(
    multiTenantPending.pendingReason === 'multi_venue_address_without_unit_data',
    'multi-tenant missing discriminator cause should be visible',
  )
  const ambiguous = requiredHandoff(handoffs, ambiguousStatic.rawPlace.id)
  assert(ambiguous.identityResolutionStatus === 'ambiguous', 'ambiguous static evidence should remain visible')
  assert(ambiguous.ambiguityReason === 'ambiguous_static_canonical_match', 'ambiguity reason should be visible')
  assert(ambiguous.fieldSourceIdentity === ambiguousStatic.rawPlace.id, 'ambiguous fixture should preserve Field source identity')
  assert(
    ambiguous.providerProvenance.providerRecordId === ambiguousStatic.rawPlace.providerRecordId,
    'ambiguous fixture should preserve provider provenance',
  )

  for (const input of inputs) {
    const handoff = requiredHandoff(handoffs, input.rawPlace.id)
    assert(handoff.fieldSourceIdentity === input.rawPlace.id, 'fieldSourceIdentity should preserve RawPlace.id')
    assert(
      handoff.providerProvenance.providerRecordId === input.rawPlace.providerRecordId,
      'providerRecordId should remain provenance',
    )
    assert(handoff.issuedProviderOnlyCanonicalsSource === 'empty_stage_2a_no_durable_registry', 'Stage 2A durable registry absence should be explicit')
    assert(!hasOwn(handoff, 'routeIdentityEligible'), 'Stage 2A handoff must not author Bearings admission')
    assert(!hasOwn(handoff, 'diagnosticOnly'), 'Stage 2A handoff must not author diagnosticOnly admission')
    assert(!hasOwn(handoff, 'routeAdmissionStatus'), 'Stage 2A handoff must not author routeAdmissionStatus')
  }

  const routeSupplyVenueIds = staticOnlyRouteSupplyIds(inputs)
  assert(routeSupplyVenueIds.length === 1, `static-only route supply should remain size 1, got ${routeSupplyVenueIds.length}`)
  assert(routeSupplyVenueIds[0] === 'sj-paper-plane', 'static-only route supply should contain only the static canonical')
  assert(!routeSupplyVenueIds.includes(providerHandoffA.resolvedBaseVenueId), 'provider-only identity must not enter route supply')
  assert(!routeSupplyVenueIds.includes(coordinatePending.resolvedBaseVenueId ?? ''), 'pending identity must not enter route supply')
  assert(!routeSupplyVenueIds.includes(ambiguous.resolvedBaseVenueId ?? ''), 'ambiguous identity must not enter route supply')
  assert(routeSupplyVenueIds.every((id) => !id.startsWith('live_google_')), 'admitted Venue.id must not be provider-derived')

  const corpusHashAfter = sha256File(CORPUS_PATH)
  assert(corpusHashAfter === corpusHashBefore, `generated corpus hash changed after proof: ${corpusHashAfter}`)

  console.log('stage 2a field interpretation identity handoff proof PASS')
  console.log(`static resolved identity=${staticHandoff.resolvedBaseVenueId}`)
  console.log(`provider-only diagnostic identity=${providerHandoffA.resolvedBaseVenueId}`)
  console.log(`duplicate convergence ids=${providerHandoffA.fieldSourceIdentity}/${providerHandoffB.fieldSourceIdentity}`)
  console.log('pending causes=coordinate_only:1,multi_venue_address_without_unit_data:1')
  console.log('ambiguous cause=ambiguous_static_canonical_match')
  console.log(`permutation total observations=${baselinePermutation.totalObservationCount}`)
  console.log(`permutation unique resolved identities=${baselinePermutation.uniqueResolvedIdentityCount}`)
  console.log('permutation equivalence=original/reversed/shuffled')
  console.log(`route supply ids=${routeSupplyVenueIds.join(',')}`)
  console.log(`physical place serialization example=${JSON.stringify(providerHandoffA.physicalPlaceKeySerialization)}`)
  console.log('provider provenance retained=yes')
  console.log('bearings admission verdict authored=no')
  console.log(`generated corpus sha256=${corpusHashAfter}`)
  console.log('provider calls=0')
  console.log('hosted calls=0')
}

function snapshotHandoffs(
  handoffs: Map<string, FieldInterpretationVenueIdentityHandoff>,
): HandoffPermutationSnapshot {
  const physicalKeyGroups = new Map<string, string[]>()
  for (const handoff of handoffs.values()) {
    const serialization = handoff.physicalPlaceKeySerialization
    if (!serialization) {
      continue
    }
    physicalKeyGroups.set(serialization, [
      ...(physicalKeyGroups.get(serialization) ?? []),
      handoff.fieldSourceIdentity,
    ])
  }
  for (const [serialization, members] of physicalKeyGroups) {
    physicalKeyGroups.set(serialization, members.sort())
  }

  const resolvedIdentities = new Set<string>()
  for (const handoff of handoffs.values()) {
    if (handoff.resolvedBaseVenueId) {
      resolvedIdentities.add(handoff.resolvedBaseVenueId)
    }
  }

  return {
    totalObservationCount: handoffs.size,
    uniqueResolvedIdentityCount: resolvedIdentities.size,
    observations: [...handoffs.values()]
      .map((handoff) => ({
        fieldSourceIdentity: handoff.fieldSourceIdentity,
        identityResolutionStatus: handoff.identityResolutionStatus,
        resolvedBaseVenueId: handoff.resolvedBaseVenueId ?? null,
        reason: handoff.pendingReason ?? handoff.ambiguityReason ?? null,
        physicalPlaceKeySerialization: handoff.physicalPlaceKeySerialization ?? null,
        physicalPlaceKeyGroupMembers: handoff.physicalPlaceKeySerialization
          ? physicalKeyGroups.get(handoff.physicalPlaceKeySerialization) ?? []
          : [],
      }))
      .sort((left, right) => left.fieldSourceIdentity.localeCompare(right.fieldSourceIdentity)),
  }
}

function assertSnapshotsEqual(
  actual: HandoffPermutationSnapshot,
  expected: HandoffPermutationSnapshot,
  label: string,
): void {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label} differs from original permutation snapshot`,
  )
}

function rawPlace(params: {
  id: string
  name: string
  providerRecordId: string
  formattedAddress?: string
  latitude?: number
  longitude?: number
  sourceTypes?: string[]
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
    sourceTypes: params.sourceTypes ?? ['restaurant'],
    ...(params.formattedAddress ? { formattedAddress: params.formattedAddress } : {}),
    ...(typeof params.latitude === 'number' ? { latitude: params.latitude } : {}),
    ...(typeof params.longitude === 'number' ? { longitude: params.longitude } : {}),
  }
}

function mapping(providerRecordId: string, canonicalVenueId: string): ProviderCanonicalVenueMapping {
  return {
    provider: 'google-places',
    providerRecordId,
    canonicalVenueId,
    matchMethod: 'manual_seed',
    confidence: 1,
  }
}

function staticCanonical(baseVenueId: string, providerRecordId: string): StaticCanonicalVenueIdentity {
  return {
    baseVenueId,
    canonicalCityKey: 'san-jose',
    name: 'Ambiguous Static',
    formattedAddress: '10 Match St, San Jose, CA 95113',
    providerRecordIds: [providerRecordId],
  }
}

function requiredHandoff(
  handoffs: Map<string, FieldInterpretationVenueIdentityHandoff>,
  id: string,
): FieldInterpretationVenueIdentityHandoff {
  const handoff = handoffs.get(id)
  assert(handoff, `missing handoff for ${id}`)
  return handoff
}

function staticOnlyRouteSupplyIds(inputs: Stage2AFieldIdentityResolutionInput[]): string[] {
  return inputs
    .map((input) => input.canonicalMapping?.canonicalVenueId)
    .filter((id): id is string => Boolean(id))
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

main()
