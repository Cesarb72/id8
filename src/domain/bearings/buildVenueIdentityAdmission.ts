import type {
  BearingsVenueIdentityAdmissionGroupDiagnostic,
  BearingsVenueIdentityAdmissionObservationDiagnostic,
  BearingsVenueIdentityAdmissionRejectionReason,
  BearingsVenueIdentityRouteAdmissionStatus,
  FieldInterpretationVenueIdentityHandoff,
} from '../types/diagnostics'
import type { RawPlace } from '../types/rawPlace'

export interface BearingsVenueIdentityAdmissionResult {
  observations: BearingsVenueIdentityAdmissionObservationDiagnostic[]
  groups: BearingsVenueIdentityAdmissionGroupDiagnostic[]
  observationsByFieldSourceIdentity: Map<string, BearingsVenueIdentityAdmissionObservationDiagnostic>
}

export interface BearingsAdmittedVenueIdentityRouteSupply {
  rawPlaces: RawPlace[]
  routeNormalizationIdByRawId: Map<string, string>
}

function isLiveGoogleIdentity(value: string): boolean {
  return value.trim().toLowerCase().startsWith('live_google_')
}

function isProviderDerivedIdentity(
  resolvedBaseVenueId: string,
  handoff: FieldInterpretationVenueIdentityHandoff,
): boolean {
  const normalized = resolvedBaseVenueId.trim().toLowerCase()
  const providerRecordId = handoff.providerProvenance.providerRecordId?.trim().toLowerCase()
  const fieldSourceIdentity = handoff.fieldSourceIdentity.trim().toLowerCase()
  return (
    isLiveGoogleIdentity(normalized) ||
    normalized === fieldSourceIdentity ||
    Boolean(providerRecordId && normalized === providerRecordId)
  )
}

function stableRepresentativeKey(handoff: FieldInterpretationVenueIdentityHandoff): string {
  return [
    handoff.sourceFacts.name,
    handoff.sourceFacts.formattedAddress ?? '',
    handoff.sourceFacts.city ?? '',
    handoff.sourceFacts.neighborhood ?? '',
    typeof handoff.sourceFacts.latitude === 'number' ? handoff.sourceFacts.latitude.toFixed(6) : '',
    typeof handoff.sourceFacts.longitude === 'number' ? handoff.sourceFacts.longitude.toFixed(6) : '',
    handoff.providerProvenance.provider ?? '',
    handoff.providerProvenance.providerRecordId ?? '',
    handoff.fieldSourceIdentity,
  ].join('\u001f')
}

function buildRetainedInterpretationEvidence(
  handoff: FieldInterpretationVenueIdentityHandoff,
): BearingsVenueIdentityAdmissionObservationDiagnostic['retainedInterpretationEvidence'] {
  return {
    algorithmVersion: handoff.algorithmVersion,
    ...(handoff.physicalPlaceKeyVersion ? { physicalPlaceKeyVersion: handoff.physicalPlaceKeyVersion } : {}),
    ...(handoff.physicalPlaceKeySerialization
      ? { physicalPlaceKeySerialization: handoff.physicalPlaceKeySerialization }
      : {}),
    ...(handoff.pendingReason ? { pendingReason: handoff.pendingReason } : {}),
    ...(handoff.ambiguityReason ? { ambiguityReason: handoff.ambiguityReason } : {}),
  }
}

function buildRejectedObservation(
  handoff: FieldInterpretationVenueIdentityHandoff,
  routeAdmissionStatus: BearingsVenueIdentityRouteAdmissionStatus,
  admissionRejectionReasons: BearingsVenueIdentityAdmissionRejectionReason[],
): BearingsVenueIdentityAdmissionObservationDiagnostic {
  return {
    owner: 'Bearings',
    inputSource: 'fieldInterpretationVenueIdentityHandoff',
    fieldSourceIdentity: handoff.fieldSourceIdentity,
    providerProvenance: handoff.providerProvenance,
    interpretationIdentityResolutionStatus: handoff.identityResolutionStatus,
    ...(handoff.resolvedBaseVenueId ? { resolvedBaseVenueId: handoff.resolvedBaseVenueId } : {}),
    routeAdmissionStatus,
    routeIdentityEligible: false,
    diagnosticOnly: true,
    admissionRejectionReasons,
    duplicateGroupMemberSourceIdentities: [handoff.fieldSourceIdentity],
    duplicateGroupSize: 1,
    materializedRouteRepresentation: false,
    retainedFieldEvidence: handoff.sourceFacts,
    retainedInterpretationEvidence: buildRetainedInterpretationEvidence(handoff),
  }
}

function classifyAdmission(
  handoff: FieldInterpretationVenueIdentityHandoff,
): {
  routeAdmissionStatus: BearingsVenueIdentityRouteAdmissionStatus
  admissionRejectionReasons: BearingsVenueIdentityAdmissionRejectionReason[]
} {
  if (handoff.identityResolutionStatus === 'pending') {
    return {
      routeAdmissionStatus: 'rejected_pending_identity',
      admissionRejectionReasons: ['identity_resolution_pending'],
    }
  }
  if (handoff.identityResolutionStatus === 'ambiguous') {
    return {
      routeAdmissionStatus: 'rejected_ambiguous_identity',
      admissionRejectionReasons: ['identity_resolution_ambiguous'],
    }
  }
  if (
    handoff.identityResolutionStatus !== 'resolved_static' &&
    handoff.identityResolutionStatus !== 'resolved_provider_only'
  ) {
    return {
      routeAdmissionStatus: 'rejected_inconsistent_identity_evidence',
      admissionRejectionReasons: ['identity_resolution_status_not_admissible'],
    }
  }
  if (!handoff.resolvedBaseVenueId?.trim()) {
    return {
      routeAdmissionStatus: 'rejected_missing_resolved_baseVenueId',
      admissionRejectionReasons: ['missing_resolved_baseVenueId'],
    }
  }

  const rejectionReasons: BearingsVenueIdentityAdmissionRejectionReason[] = []
  if (isLiveGoogleIdentity(handoff.resolvedBaseVenueId)) {
    rejectionReasons.push('live_google_identity_form_not_route_bearing')
  }
  if (handoff.resolvedBaseVenueId === handoff.fieldSourceIdentity) {
    rejectionReasons.push('resolved_baseVenueId_conflicts_with_field_source_identity')
  }
  if (handoff.resolvedBaseVenueId === handoff.providerProvenance.providerRecordId) {
    rejectionReasons.push('resolved_baseVenueId_conflicts_with_providerRecordId')
  }
  if (isProviderDerivedIdentity(handoff.resolvedBaseVenueId, handoff)) {
    rejectionReasons.push('provider_derived_resolved_baseVenueId')
  }
  if (rejectionReasons.length > 0) {
    return {
      routeAdmissionStatus: 'rejected_provider_derived_identity',
      admissionRejectionReasons: [...new Set(rejectionReasons)],
    }
  }

  return {
    routeAdmissionStatus:
      handoff.identityResolutionStatus === 'resolved_static'
        ? 'admitted_resolved_static'
        : 'admitted_resolved_provider_only',
    admissionRejectionReasons: [],
  }
}

function buildAdmittedObservation(params: {
  handoff: FieldInterpretationVenueIdentityHandoff
  groupMembers: string[]
  materializedRouteRepresentation: boolean
}): BearingsVenueIdentityAdmissionObservationDiagnostic {
  const { handoff, groupMembers, materializedRouteRepresentation } = params
  const classification = classifyAdmission(handoff)
  return {
    owner: 'Bearings',
    inputSource: 'fieldInterpretationVenueIdentityHandoff',
    fieldSourceIdentity: handoff.fieldSourceIdentity,
    providerProvenance: handoff.providerProvenance,
    interpretationIdentityResolutionStatus: handoff.identityResolutionStatus,
    resolvedBaseVenueId: handoff.resolvedBaseVenueId,
    routeAdmissionStatus: classification.routeAdmissionStatus,
    routeIdentityEligible: true,
    diagnosticOnly: false,
    admissionRejectionReasons: [],
    canonicalDuplicateGroupKey: handoff.resolvedBaseVenueId,
    duplicateGroupMemberSourceIdentities: groupMembers,
    duplicateGroupSize: groupMembers.length,
    materializedRouteRepresentation,
    ...(materializedRouteRepresentation ? { materializedVenueId: handoff.resolvedBaseVenueId } : {}),
    retainedFieldEvidence: handoff.sourceFacts,
    retainedInterpretationEvidence: buildRetainedInterpretationEvidence(handoff),
  }
}

function buildGroup(
  resolvedBaseVenueId: string,
  handoffs: FieldInterpretationVenueIdentityHandoff[],
): BearingsVenueIdentityAdmissionGroupDiagnostic {
  const orderedMembers = handoffs
    .map((handoff) => handoff.fieldSourceIdentity)
    .sort((left, right) => left.localeCompare(right))
  const representative = handoffs
    .slice()
    .sort((left, right) => stableRepresentativeKey(left).localeCompare(stableRepresentativeKey(right)))[0]
  if (!representative) {
    throw new Error(`missing representative for admitted identity ${resolvedBaseVenueId}`)
  }
  return {
    owner: 'Bearings',
    inputSource: 'fieldInterpretationVenueIdentityHandoff',
    resolvedBaseVenueId,
    routeIdentityEligible: true,
    materializationStatus: 'materialized',
    representativeFieldSourceIdentity: representative.fieldSourceIdentity,
    memberFieldSourceIdentities: orderedMembers,
    memberCount: orderedMembers.length,
    retainedEvidence: handoffs
      .slice()
      .sort((left, right) => left.fieldSourceIdentity.localeCompare(right.fieldSourceIdentity))
      .map((handoff) => ({
        fieldSourceIdentity: handoff.fieldSourceIdentity,
        providerProvenance: handoff.providerProvenance,
        sourceFacts: handoff.sourceFacts,
        interpretation: {
          identityResolutionStatus: handoff.identityResolutionStatus,
          algorithmVersion: handoff.algorithmVersion,
          ...(handoff.physicalPlaceKeyVersion ? { physicalPlaceKeyVersion: handoff.physicalPlaceKeyVersion } : {}),
          ...(handoff.physicalPlaceKeySerialization
            ? { physicalPlaceKeySerialization: handoff.physicalPlaceKeySerialization }
            : {}),
        },
      })),
  }
}

export function buildVenueIdentityAdmissionDiagnostics(
  handoffs: Iterable<FieldInterpretationVenueIdentityHandoff>,
): BearingsVenueIdentityAdmissionResult {
  const admittedByCanonical = new Map<string, FieldInterpretationVenueIdentityHandoff[]>()
  const rejectedObservations: BearingsVenueIdentityAdmissionObservationDiagnostic[] = []

  for (const handoff of [...handoffs].sort((left, right) =>
    left.fieldSourceIdentity.localeCompare(right.fieldSourceIdentity),
  )) {
    const classification = classifyAdmission(handoff)
    if (
      classification.routeAdmissionStatus === 'admitted_resolved_static' ||
      classification.routeAdmissionStatus === 'admitted_resolved_provider_only'
    ) {
      admittedByCanonical.set(handoff.resolvedBaseVenueId!, [
        ...(admittedByCanonical.get(handoff.resolvedBaseVenueId!) ?? []),
        handoff,
      ])
      continue
    }
    rejectedObservations.push(
      buildRejectedObservation(
        handoff,
        classification.routeAdmissionStatus,
        classification.admissionRejectionReasons,
      ),
    )
  }

  const groups = [...admittedByCanonical.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([resolvedBaseVenueId, groupHandoffs]) => buildGroup(resolvedBaseVenueId, groupHandoffs))

  const observations: BearingsVenueIdentityAdmissionObservationDiagnostic[] = [
    ...rejectedObservations,
    ...groups.flatMap((group) => {
      const groupHandoffs = admittedByCanonical.get(group.resolvedBaseVenueId) ?? []
      let materializedRepresentationAssigned = false
      return groupHandoffs
        .slice()
        .sort((left, right) => stableRepresentativeKey(left).localeCompare(stableRepresentativeKey(right)))
        .map((handoff) => {
          const materializedRouteRepresentation =
            !materializedRepresentationAssigned &&
            handoff.fieldSourceIdentity === group.representativeFieldSourceIdentity
          if (materializedRouteRepresentation) {
            materializedRepresentationAssigned = true
          }
          return buildAdmittedObservation({
            handoff,
            groupMembers: group.memberFieldSourceIdentities,
            materializedRouteRepresentation,
          })
        })
    }),
  ].sort((left, right) => left.fieldSourceIdentity.localeCompare(right.fieldSourceIdentity))

  return {
    observations,
    groups,
    observationsByFieldSourceIdentity: new Map(
      observations.map((observation) => [observation.fieldSourceIdentity, observation]),
    ),
  }
}

export function buildAdmittedVenueIdentityRouteSupplyRawPlaces(params: {
  admissionResult: BearingsVenueIdentityAdmissionResult
  rawPlaces: RawPlace[]
}): BearingsAdmittedVenueIdentityRouteSupply {
  const rawPlaceByFieldSourceIdentity = new Map(
    params.rawPlaces.map((rawPlace) => [rawPlace.id, rawPlace]),
  )
  const admittedRawPlaces: RawPlace[] = []
  const routeNormalizationIdByRawId = new Map<string, string>()

  for (const group of params.admissionResult.groups) {
    const representative = rawPlaceByFieldSourceIdentity.get(group.representativeFieldSourceIdentity)
    if (!representative) {
      continue
    }
    admittedRawPlaces.push({
      ...representative,
      id: group.resolvedBaseVenueId,
    })
    routeNormalizationIdByRawId.set(representative.id, group.resolvedBaseVenueId)
  }

  return {
    rawPlaces: admittedRawPlaces.sort((left, right) => left.id.localeCompare(right.id)),
    routeNormalizationIdByRawId,
  }
}
