import type {
  LiveProviderEnvelope,
  LiveRetrievalPocketHint,
} from '../../../domain/retrieval/liveEnvelope'

export type StepBPreSupplyHoldReason =
  | 'pre_supply_proof_target_id_missing'
  | 'pre_supply_scenario_starter_family_missing'
  | 'pre_supply_selected_direction_id_missing'
  | 'pre_supply_selected_pocket_id_missing'
  | 'pre_supply_live_pocket_hint_missing'
  | 'pre_supply_selected_direction_unavailable_for_target_pocket'
  | 'pre_supply_selected_pocket_unavailable_for_target'
  | 'pre_supply_live_pocket_hint_unavailable_for_target'
  | 'pre_supply_cross_pocket_policy_missing'
  | 'pre_supply_provider_envelope_missing'
  | 'pre_supply_provider_valve_readiness_missing'

export type StepBPreSupplyReadiness = {
  diagnosticOnly: true
  status: 'ready' | 'held'
  holdReason: StepBPreSupplyHoldReason | null
  proofTargetId: string | null
  scenarioFamily: string | null
  starterPackId: string | null
  scenarioStarterFamilyAvailable: boolean
  selectedDirectionId: string | null
  selectedPocketId: string | null
  livePocketHint: LiveRetrievalPocketHint | null
  livePocketHintAvailable: boolean
  crossPocketAllowed: boolean | null
  crossPocketPolicyAvailable: boolean
  envelope: Pick<LiveProviderEnvelope, 'maxProviderCalls' | 'maxQueryLabels' | 'maxCenters'> | null
  envelopeReady: boolean
  providerValveExpectedMode: string | null
  providerValveReady: boolean
  notRequiredBeforeSupply: readonly [
    'field_results',
    'selected_proof_stop',
    'starterSemanticRepresentation',
    'selected_stop_semantic_proof',
    'ContractEntryArtifact',
    'Great_Stop_approval',
    'Review_Lock_eligibility',
  ]
}

export function evaluateStepBPreSupplyReadiness(params: {
  proofTargetId?: string | null
  scenarioFamily?: string | null
  starterPackId?: string | null
  selectedDirectionId?: string | null
  selectedPocketId?: string | null
  livePocketHint?: LiveRetrievalPocketHint | null
  crossPocketAllowed?: boolean | null
  envelope?: Pick<LiveProviderEnvelope, 'maxProviderCalls' | 'maxQueryLabels' | 'maxCenters'> | null
  providerValveExpectedMode?: string | null
  providerValveReady?: boolean
  carrierResolutionHoldReason?: StepBPreSupplyHoldReason | null
}): StepBPreSupplyReadiness {
  const proofTargetId = params.proofTargetId?.trim() || null
  const scenarioFamily = params.scenarioFamily?.trim() || null
  const starterPackId = params.starterPackId?.trim() || null
  const selectedDirectionId = params.selectedDirectionId?.trim() || null
  const selectedPocketId = params.selectedPocketId?.trim() || null
  const livePocketHint = params.livePocketHint ?? null
  const crossPocketPolicyAvailable = typeof params.crossPocketAllowed === 'boolean'
  const envelope = params.envelope ?? null
  const envelopeReady =
    envelope?.maxProviderCalls === 3 &&
    envelope.maxQueryLabels === 3 &&
    envelope.maxCenters === 1
  const providerValveExpectedMode = params.providerValveExpectedMode?.trim() || null
  const providerValveReady = params.providerValveReady === true
  const carrierResolutionHoldReason = params.carrierResolutionHoldReason ?? null
  const holdReason: StepBPreSupplyHoldReason | null =
    !proofTargetId
      ? 'pre_supply_proof_target_id_missing'
      : !scenarioFamily || !starterPackId
        ? 'pre_supply_scenario_starter_family_missing'
        : !selectedDirectionId
          ? carrierResolutionHoldReason ??
            'pre_supply_selected_direction_id_missing'
          : !selectedPocketId
            ? carrierResolutionHoldReason ??
              'pre_supply_selected_pocket_id_missing'
            : !livePocketHint
              ? carrierResolutionHoldReason ??
                'pre_supply_live_pocket_hint_missing'
              : !crossPocketPolicyAvailable
                ? 'pre_supply_cross_pocket_policy_missing'
                : !envelopeReady
                  ? 'pre_supply_provider_envelope_missing'
                  : !providerValveReady || !providerValveExpectedMode
                    ? 'pre_supply_provider_valve_readiness_missing'
                    : null

  return {
    diagnosticOnly: true,
    status: holdReason ? 'held' : 'ready',
    holdReason,
    proofTargetId,
    scenarioFamily,
    starterPackId,
    scenarioStarterFamilyAvailable: Boolean(scenarioFamily && starterPackId),
    selectedDirectionId,
    selectedPocketId,
    livePocketHint,
    livePocketHintAvailable: Boolean(livePocketHint),
    crossPocketAllowed: crossPocketPolicyAvailable ? params.crossPocketAllowed ?? null : null,
    crossPocketPolicyAvailable,
    envelope,
    envelopeReady,
    providerValveExpectedMode,
    providerValveReady,
    notRequiredBeforeSupply: [
      'field_results',
      'selected_proof_stop',
      'starterSemanticRepresentation',
      'selected_stop_semantic_proof',
      'ContractEntryArtifact',
      'Great_Stop_approval',
      'Review_Lock_eligibility',
    ],
  }
}

export type StepBPostSupplyProofStage =
  | 'before_supply'
  | 'during_supply'
  | 'after_supply_materialization'
  | 'great_stop'
  | 'application_card_gate'
  | 'passed'

export type StepBPostSupplyProof = {
  diagnosticOnly: true
  status: 'pending' | 'failed' | 'passed'
  stage: StepBPostSupplyProofStage
  fieldSupplyStatus: 'not_started' | 'returned' | 'failed'
  bearingsDistrictAdmissionStatus: 'not_run' | 'ran'
  selectedProofStopPresent: boolean
  selectedProofStopPocketId: string | null
  starterSemanticRepresentationStatus: string | null
  contractEntryArtifactMaterialized: boolean
  hardPocketAssertionStatus: string | null
  greatStopStatus: string | null
  reviewLockEligible: boolean
  failureReason: string | null
}

export function evaluateStepBPostSupplyProofGate(params: {
  fieldSupplyStatus: StepBPostSupplyProof['fieldSupplyStatus']
  bearingsDistrictAdmissionStatus: StepBPostSupplyProof['bearingsDistrictAdmissionStatus']
  selectedProofStopPresent?: boolean
  selectedProofStopPocketId?: string | null
  starterSemanticRepresentationStatus?: string | null
  contractEntryArtifactMaterialized?: boolean
  hardPocketAssertionStatus?: string | null
  greatStopStatus?: string | null
  reviewLockEligible?: boolean
}): StepBPostSupplyProof {
  const selectedProofStopPresent = params.selectedProofStopPresent === true
  const starterSemanticRepresentationStatus =
    params.starterSemanticRepresentationStatus?.trim() || null
  const contractEntryArtifactMaterialized =
    params.contractEntryArtifactMaterialized === true
  const hardPocketAssertionStatus = params.hardPocketAssertionStatus?.trim() || null
  const greatStopStatus = params.greatStopStatus?.trim() || null
  const reviewLockEligible = params.reviewLockEligible === true

  let status: StepBPostSupplyProof['status'] = 'passed'
  let stage: StepBPostSupplyProofStage = 'passed'
  let failureReason: string | null = null

  if (params.fieldSupplyStatus === 'not_started') {
    status = 'pending'
    stage = 'before_supply'
    failureReason = 'field_supply_not_started'
  } else if (params.fieldSupplyStatus === 'failed') {
    status = 'failed'
    stage = 'during_supply'
    failureReason = 'field_supply_failed'
  } else if (params.bearingsDistrictAdmissionStatus !== 'ran') {
    status = 'pending'
    stage = 'after_supply_materialization'
    failureReason = 'bearings_district_admission_not_run'
  } else if (!selectedProofStopPresent) {
    status = 'failed'
    stage = 'after_supply_materialization'
    failureReason = 'selected_proof_stop_missing'
  } else if (starterSemanticRepresentationStatus !== 'represented') {
    status = 'failed'
    stage = 'after_supply_materialization'
    failureReason = 'starter_semantic_representation_missing'
  } else if (!contractEntryArtifactMaterialized) {
    status = 'failed'
    stage = 'after_supply_materialization'
    failureReason = 'contract_entry_artifact_not_materialized'
  } else if (hardPocketAssertionStatus !== 'passed') {
    status = 'failed'
    stage = 'after_supply_materialization'
    failureReason = 'hard_pocket_assertion_not_passed'
  } else if (greatStopStatus !== 'approved') {
    status = 'failed'
    stage = 'great_stop'
    failureReason = 'great_stop_not_approved'
  } else if (!reviewLockEligible) {
    status = 'failed'
    stage = 'application_card_gate'
    failureReason = 'review_lock_not_eligible'
  }

  return {
    diagnosticOnly: true,
    status,
    stage,
    fieldSupplyStatus: params.fieldSupplyStatus,
    bearingsDistrictAdmissionStatus: params.bearingsDistrictAdmissionStatus,
    selectedProofStopPresent,
    selectedProofStopPocketId: params.selectedProofStopPocketId ?? null,
    starterSemanticRepresentationStatus,
    contractEntryArtifactMaterialized,
    hardPocketAssertionStatus,
    greatStopStatus,
    reviewLockEligible,
    failureReason,
  }
}
