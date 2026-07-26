import type {
  BearingsCandidateAdmissibilityDiagnostic,
  BearingsCandidateAdmissibilityStatus,
  BearingsCandidateSourceEvidenceStatus,
  BearingsDistrictSpatialStructureStatus,
  FieldToBearingsProvisionalHandoffDiagnostic,
} from '../types/diagnostics'

export interface BearingsCandidateAdmissibilityRollups {
  bearingsCandidateAdmissibilityDiagnosticCount: number
  bearingsSpatialAdmissibilityRequiredCount: number
  bearingsPlanTimeHoursFeasibilityRequiredCount: number
  bearingsMovementFeasibilityRequiredCount: number
  bearingsPlaceRightRequiredCount: number
  bearingsBlockedCandidateCount: number
  bearingsProvisionalOnlyCandidateCount: number
  bearingsOutsideEnvelopeCount: number
  bearingsMissingLocationCount: number
  bearingsAdmissibilityNotEvaluatedCount: number
  bearingsCandidateUpgradeRequiredCount: number
}

function resolveSpatialStatus(
  handoff: FieldToBearingsProvisionalHandoffDiagnostic,
): BearingsCandidateAdmissibilityStatus {
  if (!handoff.hasLocation || handoff.pocketVerdict === 'rejected_missing_location') {
    return 'bearings_missing_location'
  }
  if (handoff.pocketVerdict === 'rejected_outside_selected_envelope') {
    return 'bearings_outside_selected_envelope'
  }
  return 'bearings_spatial_admissibility_required'
}

function resolveOverallStatus(
  spatialStatus: BearingsCandidateAdmissibilityStatus,
): BearingsCandidateAdmissibilityStatus {
  if (spatialStatus === 'bearings_missing_location') {
    return 'bearings_blocked'
  }
  return 'bearings_provisional_only'
}

function resolveSourceEvidenceStatus(
  handoff: FieldToBearingsProvisionalHandoffDiagnostic,
): BearingsCandidateSourceEvidenceStatus {
  return handoff.sourceEvidenceStatus === 'source_evidence_available'
    ? 'bearings_source_evidence_available'
    : 'bearings_source_evidence_incomplete'
}

function resolveDistrictSpatialStructureStatus(
  handoff: FieldToBearingsProvisionalHandoffDiagnostic,
): BearingsDistrictSpatialStructureStatus {
  return handoff.selectedPocketEnvelope || handoff.activePocketId || handoff.activePocketLabel
    ? 'district_spatial_structure_available'
    : 'district_spatial_structure_missing'
}

function resolveDistanceMarginInterpretation(
  handoff: FieldToBearingsProvisionalHandoffDiagnostic,
): BearingsCandidateAdmissibilityDiagnostic['distanceMarginInterpretation'] {
  if (handoff.distanceMargin.status === 'outside_by') {
    return 'outside_selected_envelope'
  }
  if (handoff.distanceMargin.status === 'inside_by') {
    return 'inside_field_envelope_but_not_bearings_evaluated'
  }
  return 'unknown'
}

export function buildCandidateAdmissibilityDiagnostic(
  handoff: FieldToBearingsProvisionalHandoffDiagnostic | undefined,
): BearingsCandidateAdmissibilityDiagnostic | undefined {
  if (!handoff) {
    return undefined
  }

  const spatialAdmissibilityStatus = resolveSpatialStatus(handoff)
  const overallStatus = resolveOverallStatus(spatialAdmissibilityStatus)
  const blockedMissingLocation = spatialAdmissibilityStatus === 'bearings_missing_location'
  const outsideSelectedEnvelope = spatialAdmissibilityStatus === 'bearings_outside_selected_envelope'

  return {
    owner: 'Bearings',
    inputSource: 'fieldToBearingsProvisionalHandoff',
    candidateClass: 'provisional_live_candidate',
    proofEligible: false,
    diagnosticOnly: true,
    behaviorImpact: false,
    routeEligibilityChanged: false,
    overallStatus,
    spatialAdmissibilityStatus,
    sourceEvidenceStatus: resolveSourceEvidenceStatus(handoff),
    districtSpatialStructureStatus: resolveDistrictSpatialStructureStatus(handoff),
    planTimeHoursFeasibilityStatus: 'bearings_plan_time_hours_feasibility_required',
    movementFeasibilityStatus: handoff.hasLocation
      ? 'bearings_movement_feasibility_required'
      : 'bearings_admissibility_not_evaluated',
    placeRightStatus: handoff.hasLocation
      ? 'bearings_place_right_required'
      : 'bearings_admissibility_not_evaluated',
    requiredStopSurvivalStatus: 'bearings_admissibility_not_evaluated',
    distanceMarginInterpretation: resolveDistanceMarginInterpretation(handoff),
    fieldCurrentHoursEvidenceStatus: handoff.hasHoursOpenStatus
      ? 'field_current_hours_evidence_available'
      : 'field_current_hours_evidence_missing',
    upgradeRequirement: blockedMissingLocation
      ? 'blocked_missing_location'
      : outsideSelectedEnvelope
        ? 'blocked_outside_selected_envelope'
        : 'future_bearings_admissibility_evaluation_required',
    ...(blockedMissingLocation
      ? { blockReason: 'missing_location' as const }
      : outsideSelectedEnvelope
        ? { blockReason: 'outside_selected_envelope' as const }
        : {}),
    notes: [
      'diagnostic_only_bearings_candidate_admissibility_evaluator',
      'field_current_reality_not_collapsed_into_bearings_plan_time_feasibility',
      'district_spatial_structure_not_collapsed_into_route_admission',
      'no_route_artifact_or_lock_eligibility_change',
    ],
  }
}

export function buildCandidateAdmissibilityRollups(
  diagnostics: readonly BearingsCandidateAdmissibilityDiagnostic[],
): BearingsCandidateAdmissibilityRollups {
  const notEvaluatedStatuses = (diagnostic: BearingsCandidateAdmissibilityDiagnostic): number =>
    [
      diagnostic.movementFeasibilityStatus,
      diagnostic.placeRightStatus,
      diagnostic.requiredStopSurvivalStatus,
    ].filter((status) => status === 'bearings_admissibility_not_evaluated').length

  return {
    bearingsCandidateAdmissibilityDiagnosticCount: diagnostics.length,
    bearingsSpatialAdmissibilityRequiredCount: diagnostics.filter(
      (diagnostic) =>
        diagnostic.spatialAdmissibilityStatus === 'bearings_spatial_admissibility_required' ||
        diagnostic.spatialAdmissibilityStatus === 'bearings_outside_selected_envelope' ||
        diagnostic.spatialAdmissibilityStatus === 'bearings_missing_location',
    ).length,
    bearingsPlanTimeHoursFeasibilityRequiredCount: diagnostics.filter(
      (diagnostic) =>
        diagnostic.planTimeHoursFeasibilityStatus === 'bearings_plan_time_hours_feasibility_required',
    ).length,
    bearingsMovementFeasibilityRequiredCount: diagnostics.filter(
      (diagnostic) =>
        diagnostic.movementFeasibilityStatus === 'bearings_movement_feasibility_required',
    ).length,
    bearingsPlaceRightRequiredCount: diagnostics.filter(
      (diagnostic) => diagnostic.placeRightStatus === 'bearings_place_right_required',
    ).length,
    bearingsBlockedCandidateCount: diagnostics.filter(
      (diagnostic) => diagnostic.overallStatus === 'bearings_blocked',
    ).length,
    bearingsProvisionalOnlyCandidateCount: diagnostics.filter(
      (diagnostic) => diagnostic.overallStatus === 'bearings_provisional_only',
    ).length,
    bearingsOutsideEnvelopeCount: diagnostics.filter(
      (diagnostic) => diagnostic.spatialAdmissibilityStatus === 'bearings_outside_selected_envelope',
    ).length,
    bearingsMissingLocationCount: diagnostics.filter(
      (diagnostic) => diagnostic.spatialAdmissibilityStatus === 'bearings_missing_location',
    ).length,
    bearingsAdmissibilityNotEvaluatedCount: diagnostics.reduce(
      (count, diagnostic) => count + notEvaluatedStatuses(diagnostic),
      0,
    ),
    bearingsCandidateUpgradeRequiredCount: diagnostics.filter(
      (diagnostic) =>
        diagnostic.upgradeRequirement === 'future_bearings_admissibility_evaluation_required' ||
        diagnostic.upgradeRequirement === 'blocked_outside_selected_envelope',
    ).length,
  }
}
