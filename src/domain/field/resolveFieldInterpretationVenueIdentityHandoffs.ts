import {
  isCanonicalVenueResolved,
  type ProviderCanonicalVenueMapping,
} from '../providers/providerCanonicalVenueMapping'
import {
  resolveVenueIdentity,
  type StaticCanonicalVenueIdentity,
  type VenueIdentityResolution,
  type VenueIdentityResolutionEvidence,
} from '../interpretation/venueIdentity'
import type { FieldInterpretationVenueIdentityHandoff } from '../types/diagnostics'
import type { RawPlace } from '../types/rawPlace'

export interface FieldIdentityResolutionInput {
  rawPlace: RawPlace
  canonicalMapping?: ProviderCanonicalVenueMapping
  staticCanonicalsForResolution?: StaticCanonicalVenueIdentity[]
}

function buildVenueIdentityResolutionEvidenceFromRawPlace(
  rawPlace: RawPlace,
): VenueIdentityResolutionEvidence {
  return {
    displayName: rawPlace.name,
    ...(rawPlace.city ? { city: rawPlace.city } : {}),
    ...(rawPlace.neighborhood ? { locality: rawPlace.neighborhood } : {}),
    ...(rawPlace.formattedAddress ? { formattedAddress: rawPlace.formattedAddress } : {}),
    ...(typeof rawPlace.latitude === 'number' && typeof rawPlace.longitude === 'number'
      ? { coordinates: { lat: rawPlace.latitude, lng: rawPlace.longitude } }
      : {}),
    ...(rawPlace.subcategoryHint ?? rawPlace.categoryHint
      ? { categoryFamily: rawPlace.subcategoryHint ?? rawPlace.categoryHint }
      : {}),
    sourceTypes: rawPlace.sourceTypes ?? rawPlace.placeTypes ?? [],
    providerProvenance: {
      provider: rawPlace.provider ?? 'google-places',
      ...(rawPlace.providerRecordId ? { providerRecordId: rawPlace.providerRecordId } : {}),
      sourceStopId: rawPlace.id,
      ...(rawPlace.sourceQueryLabel ? { queryLabel: rawPlace.sourceQueryLabel } : {}),
    },
  }
}

function buildStaticCanonicalForResolution(
  mapping: ProviderCanonicalVenueMapping | undefined,
): StaticCanonicalVenueIdentity | undefined {
  if (!mapping || !isCanonicalVenueResolved(mapping)) {
    return undefined
  }
  return {
    baseVenueId: mapping.canonicalVenueId,
    providerRecordIds: [mapping.providerRecordId],
  }
}

function handoffStatusForResolution(
  resolution: VenueIdentityResolution,
): FieldInterpretationVenueIdentityHandoff['identityResolutionStatus'] {
  if (resolution.status === 'static_canonical') {
    return 'resolved_static'
  }
  if (resolution.status === 'provider_only_canonical') {
    return 'resolved_provider_only'
  }
  return resolution.status
}

function buildVenueIdentityHandoff(params: {
  rawPlace: RawPlace
  resolution: VenueIdentityResolution
}): FieldInterpretationVenueIdentityHandoff {
  const { rawPlace, resolution } = params
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
    identityResolutionStatus: handoffStatusForResolution(resolution),
    ...(resolvedBaseVenueId ? { resolvedBaseVenueId } : {}),
    ...(resolution.status === 'pending' ? { pendingReason: resolution.pendingReason } : {}),
    ...(resolution.status === 'ambiguous' ? { ambiguityReason: resolution.pendingReason } : {}),
    algorithmVersion: resolution.algorithmVersion,
    ...(physicalPlaceKey?.identityKeyVersion
      ? { physicalPlaceKeyVersion: physicalPlaceKey.identityKeyVersion }
      : {}),
    ...(physicalPlaceKeySerialization ? { physicalPlaceKeySerialization } : {}),
    issuedProviderOnlyCanonicalsSource: 'empty_stage_2a_no_durable_registry',
  }
}

function resolveFieldInterpretationVenueIdentityHandoffForInput(
  input: FieldIdentityResolutionInput,
): FieldInterpretationVenueIdentityHandoff {
  const staticCanonical = buildStaticCanonicalForResolution(input.canonicalMapping)
  const staticCanonicals = [
    ...(staticCanonical ? [staticCanonical] : []),
    ...(input.staticCanonicalsForResolution ?? []),
  ]
  const resolution = resolveVenueIdentity({
    evidence: buildVenueIdentityResolutionEvidenceFromRawPlace(input.rawPlace),
    context: {
      staticCanonicals,
      issuedProviderOnlyCanonicals: [],
    },
  })
  return buildVenueIdentityHandoff({
    rawPlace: input.rawPlace,
    resolution,
  })
}

export function resolveFieldInterpretationVenueIdentityHandoffs(
  inputs: FieldIdentityResolutionInput[],
): Map<string, FieldInterpretationVenueIdentityHandoff> {
  const preliminary = inputs.map((input) => ({
    input,
    handoff: resolveFieldInterpretationVenueIdentityHandoffForInput(input),
  }))
  const grouped = new Map<string, typeof preliminary>()
  const ungrouped: typeof preliminary = []

  for (const entry of preliminary) {
    const serialization = entry.handoff.physicalPlaceKeySerialization
    if (!serialization || entry.handoff.identityResolutionStatus !== 'resolved_provider_only') {
      ungrouped.push(entry)
      continue
    }
    grouped.set(serialization, [...(grouped.get(serialization) ?? []), entry])
  }

  const handoffsByFieldSourceIdentity = new Map<string, FieldInterpretationVenueIdentityHandoff>()
  for (const entry of ungrouped.sort((left, right) =>
    left.handoff.fieldSourceIdentity.localeCompare(right.handoff.fieldSourceIdentity),
  )) {
    handoffsByFieldSourceIdentity.set(entry.handoff.fieldSourceIdentity, entry.handoff)
  }

  for (const [serialization, entries] of [...grouped.entries()].sort((left, right) =>
    left[0].localeCompare(right[0]),
  )) {
    const canonical = entries
      .slice()
      .sort((left, right) =>
        left.handoff.fieldSourceIdentity.localeCompare(right.handoff.fieldSourceIdentity),
      )[0]!.handoff
    for (const entry of entries) {
      const resolvedBaseVenueId = canonical.resolvedBaseVenueId
      handoffsByFieldSourceIdentity.set(entry.handoff.fieldSourceIdentity, {
        ...entry.handoff,
        ...(resolvedBaseVenueId ? { resolvedBaseVenueId } : {}),
        physicalPlaceKeySerialization: serialization,
      })
    }
  }

  return handoffsByFieldSourceIdentity
}
