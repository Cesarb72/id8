import type {
  BearingsCandidateAdmissibilityDiagnostic,
  BearingsCandidateAdmissibilityStatus,
  BearingsOutsideEnvelopeCorrectnessClassification,
  BearingsCandidateSourceEvidenceStatus,
  BearingsDistrictSpatialStructureStatus,
  FieldToBearingsProvisionalHandoffDiagnostic,
} from '../types/diagnostics'

const Q5_NEAR_BOUNDARY_MARGIN_M = 75

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
  q5LegitimatelyOutsideEnvelopeCount: number
  q5NearBoundaryOrAmbiguousCount: number
  q5PossiblyFalseDropCount: number
  q5InsufficientDataCount: number
  q5UnknownExact22DueToMissingSavedCandidateDetailsCount: number
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

function resolveQ5Classification(
  handoff: FieldToBearingsProvisionalHandoffDiagnostic,
): BearingsOutsideEnvelopeCorrectnessClassification {
  if (handoff.pocketVerdict !== 'rejected_outside_selected_envelope') {
    return handoff.pocketVerdict === 'rejected_missing_location' ? 'insufficient_data' : 'not_applicable'
  }
  if (handoff.distanceMargin.status === 'inside_by') {
    return 'possibly_false_drop'
  }
  if (
    handoff.distanceMargin.status !== 'outside_by' ||
    typeof handoff.distanceMargin.meters !== 'number' ||
    typeof handoff.distanceFromPocketCenterM !== 'number' ||
    typeof handoff.pocketRadiusThresholdM !== 'number'
  ) {
    return 'insufficient_data'
  }
  if (handoff.distanceMargin.meters <= Q5_NEAR_BOUNDARY_MARGIN_M) {
    return 'near_boundary_or_ambiguous'
  }
  return 'legitimately_outside_envelope'
}

function buildQ5Notes(params: {
  handoff: FieldToBearingsProvisionalHandoffDiagnostic
  classification: BearingsOutsideEnvelopeCorrectnessClassification
}): string[] {
  const notes = ['q5_correctness_check_diagnostic_only']
  if (params.handoff.pocketVerdict !== 'rejected_outside_selected_envelope') {
    notes.push('not_an_outside_envelope_verdict')
  }
  if (params.classification === 'near_boundary_or_ambiguous') {
    notes.push(`outside_margin_within_${Q5_NEAR_BOUNDARY_MARGIN_M}m_near_boundary_threshold`)
  }
  if (params.classification === 'possibly_false_drop') {
    notes.push('field_outside_verdict_conflicts_with_inside_distance_margin')
  }
  if (params.classification === 'insufficient_data') {
    notes.push('missing_distance_margin_or_envelope_evidence_for_exact_correctness')
  }
  if (params.classification === 'legitimately_outside_envelope') {
    notes.push('distance_margin_places_candidate_beyond_selected_envelope')
  }
  return notes
}

function buildQ5CorrectnessDiagnostic(
  handoff: FieldToBearingsProvisionalHandoffDiagnostic,
): BearingsCandidateAdmissibilityDiagnostic['q5OutsideEnvelopeCorrectness'] {
  const classification = resolveQ5Classification(handoff)
  const evidenceBasis =
    handoff.pocketVerdict !== 'rejected_outside_selected_envelope'
      ? 'not_outside_envelope_verdict'
      : handoff.distanceMargin.status === 'inside_by'
        ? 'field_verdict_contradicts_margin'
        : classification === 'insufficient_data'
          ? 'missing_distance_or_envelope'
          : 'distance_margin'

  return {
    diagnosticOnly: true,
    classification,
    evidenceBasis,
    nearBoundaryThresholdM: Q5_NEAR_BOUNDARY_MARGIN_M,
    notes: buildQ5Notes({ handoff, classification }),
  }
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
    q5OutsideEnvelopeCorrectness: buildQ5CorrectnessDiagnostic(handoff),
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
    q5LegitimatelyOutsideEnvelopeCount: diagnostics.filter(
      (diagnostic) =>
        diagnostic.q5OutsideEnvelopeCorrectness.classification === 'legitimately_outside_envelope',
    ).length,
    q5NearBoundaryOrAmbiguousCount: diagnostics.filter(
      (diagnostic) =>
        diagnostic.q5OutsideEnvelopeCorrectness.classification === 'near_boundary_or_ambiguous',
    ).length,
    q5PossiblyFalseDropCount: diagnostics.filter(
      (diagnostic) => diagnostic.q5OutsideEnvelopeCorrectness.classification === 'possibly_false_drop',
    ).length,
    q5InsufficientDataCount: diagnostics.filter(
      (diagnostic) => diagnostic.q5OutsideEnvelopeCorrectness.classification === 'insufficient_data',
    ).length,
    q5UnknownExact22DueToMissingSavedCandidateDetailsCount: 0,
  }
}
