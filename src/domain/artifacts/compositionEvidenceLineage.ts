import { getArcStopBaseVenueId } from '../candidates/candidateIdentity'
import type { TasteExperienceCompositionStamp } from '../interpretation/taste/computeExperienceCompositionStamp'
import type { ArcCandidate } from '../types/arc'
import type { GreatStopGateResult, GreatStopGateSelectionDiagnostics } from '../types/greatStopGate'
import type { RouteShapeContract } from '../types/intent'
import type { UserStopRole } from '../types/itinerary'
import type { GenerationDiagnostics } from '../types/diagnostics'
import type { RuntimeRouteArtifact } from './runtimeRouteArtifact'

export type CompositionEvidenceLineageSchemaVersion = 'composition_evidence_lineage.v0_1'

export interface CompositionEvidenceRouteIdentity {
  start: string
  highlight: string
  windDown: string
}

export interface CompositionEvidenceLineageInputCarrier {
  routeShapeContractId: string
  conciergeIntentId?: string
  experienceContractId?: string
  contractConstraintsId?: string
  routeShapeProjectionId?: string
  selectedDirectionId?: string
  selectedPocketId?: string
}

export interface CompositionEvidenceLineageTasteSummary {
  source: TasteExperienceCompositionStamp['source']
  status: TasteExperienceCompositionStamp['status']
  requirementSource: TasteExperienceCompositionStamp['requirementSource']
  routeShapeContractId?: string
  score: number
  startContributionStatus: TasteExperienceCompositionStamp['startContribution']['status']
  highlightContributionStatus: TasteExperienceCompositionStamp['highlightContribution']['status']
  windDownContributionStatus: TasteExperienceCompositionStamp['windDownContribution']['status']
  startPreparesHighlightStatus: TasteExperienceCompositionStamp['startPreparesHighlight']['status']
  windDownResolvesHighlightStatus: TasteExperienceCompositionStamp['windDownResolvesHighlight']['status']
  reasonCodes: string[]
  unavailableEvidence: string[]
}

export interface CompositionEvidenceLineageWaypointSummary {
  enforcementActive: boolean
  routeShapeContractId?: string
  projectionId?: string
  selectedCandidateId?: string
  selectedCandidateRank?: number
  eligibleCandidateCount?: number
  failureReasons: string[]
}

export interface CompositionEvidenceLineageBearingsSummary {
  status: 'pass' | 'fail' | 'unavailable'
  reasonCodes: string[]
}

export interface CompositionEvidenceLineageGreatStopSummary {
  status: 'PASS' | 'FAIL'
  selectedCandidateId?: string
  selectedCandidateRank?: number
  failedCriteria: string[]
  reasonCodes: string[]
}

export interface CompositionEvidenceLineage {
  schemaVersion: CompositionEvidenceLineageSchemaVersion
  source: 'contract_entry_artifact.generation' | 'final_route_approval'
  approvedAt: number
  approvedCandidateId: string
  approvedRouteIdentitySignature: string
  approvedRouteIdentity: CompositionEvidenceRouteIdentity
  inputCarrier: CompositionEvidenceLineageInputCarrier
  taste: CompositionEvidenceLineageTasteSummary
  waypoint: CompositionEvidenceLineageWaypointSummary
  bearings: CompositionEvidenceLineageBearingsSummary
  greatStop: CompositionEvidenceLineageGreatStopSummary
}

export interface CompositionEvidenceLineageValidationResult {
  ok: boolean
  reasons: string[]
}

const CORE_ROLES: Array<keyof CompositionEvidenceRouteIdentity> = [
  'start',
  'highlight',
  'windDown',
]

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))]
}

function routeIdentitySignature(identity: CompositionEvidenceRouteIdentity): string {
  return CORE_ROLES.map((role) => `${role}:${identity[role]}`).join('|')
}

function routeIdentityFromCandidate(candidate: ArcCandidate): CompositionEvidenceRouteIdentity | null {
  const start = candidate.stops.find((stop) => stop.role === 'warmup')
  const highlight = candidate.stops.find((stop) => stop.role === 'peak')
  const windDown = candidate.stops.find((stop) => stop.role === 'cooldown')
  if (!start || !highlight || !windDown) {
    return null
  }
  return {
    start: getArcStopBaseVenueId(start),
    highlight: getArcStopBaseVenueId(highlight),
    windDown: getArcStopBaseVenueId(windDown),
  }
}

export function buildCompositionEvidenceRouteIdentitySignature(
  identity: CompositionEvidenceRouteIdentity,
): string {
  return routeIdentitySignature(identity)
}

export function getCompositionEvidenceRouteIdentityFromRuntimeRoute(
  finalRoute: RuntimeRouteArtifact,
): CompositionEvidenceRouteIdentity | null {
  const identity: Partial<CompositionEvidenceRouteIdentity> = {}
  for (const stop of finalRoute.stops) {
    if (stop.role === 'start' || stop.role === 'highlight' || stop.role === 'windDown') {
      identity[stop.role] = stop.venueId
    }
  }
  if (!identity.start || !identity.highlight || !identity.windDown) {
    return null
  }
  return {
    start: identity.start,
    highlight: identity.highlight,
    windDown: identity.windDown,
  }
}

function inputCarrierFromRouteShapeContract(
  routeShapeContract: RouteShapeContract,
): CompositionEvidenceLineageInputCarrier {
  const projection = routeShapeContract.interpretationC1Projection
  return {
    routeShapeContractId: routeShapeContract.id,
    ...(projection?.conciergeIntentId ? { conciergeIntentId: projection.conciergeIntentId } : {}),
    ...(projection?.experienceContractId ? { experienceContractId: projection.experienceContractId } : {}),
    ...(projection?.contractConstraintsId ? { contractConstraintsId: projection.contractConstraintsId } : {}),
    ...(projection?.projectionId ? { routeShapeProjectionId: projection.projectionId } : {}),
    ...(projection?.selectedDirectionId ? { selectedDirectionId: projection.selectedDirectionId } : {}),
    ...(projection?.selectedPocketId ? { selectedPocketId: projection.selectedPocketId } : {}),
  }
}

function buildTasteSummary(
  stamp: TasteExperienceCompositionStamp,
): CompositionEvidenceLineageTasteSummary {
  return {
    source: stamp.source,
    status: stamp.status,
    requirementSource: stamp.requirementSource,
    ...(stamp.routeShapeContractId ? { routeShapeContractId: stamp.routeShapeContractId } : {}),
    score: stamp.score,
    startContributionStatus: stamp.startContribution.status,
    highlightContributionStatus: stamp.highlightContribution.status,
    windDownContributionStatus: stamp.windDownContribution.status,
    startPreparesHighlightStatus: stamp.startPreparesHighlight.status,
    windDownResolvesHighlightStatus: stamp.windDownResolvesHighlight.status,
    reasonCodes: unique(stamp.reasons),
    unavailableEvidence: unique(stamp.unavailableEvidence),
  }
}

type WaypointC1ApprovalDiagnostics = NonNullable<
  GreatStopGateSelectionDiagnostics['waypointC1Approval']
>
type WaypointC1ApprovalCandidateDiagnostic = NonNullable<
  WaypointC1ApprovalDiagnostics['topCandidate']
>

function findSelectedWaypointCandidateDiagnostic(
  waypoint: WaypointC1ApprovalDiagnostics | undefined,
  selectedCandidateId: string,
): WaypointC1ApprovalCandidateDiagnostic | undefined {
  if (!waypoint) {
    return undefined
  }
  const diagnostics = [
    waypoint.topCandidate,
    waypoint.firstEligibleCandidate,
    ...waypoint.ineligibleCandidates,
  ].filter(
    (candidate): candidate is WaypointC1ApprovalCandidateDiagnostic => Boolean(candidate),
  )
  return diagnostics.find((candidate) => candidate.candidateId === selectedCandidateId)
}

function selectedRouteWaypointFailureReasons(params: {
  diagnostics: GreatStopGateSelectionDiagnostics | undefined
  selectedCandidateId: string
}): string[] {
  const waypoint = params.diagnostics?.waypointC1Approval
  if (!waypoint) {
    return unique(params.diagnostics?.failureReasons ?? [])
  }
  const selectedDiagnostic = findSelectedWaypointCandidateDiagnostic(
    waypoint,
    params.selectedCandidateId,
  )
  if (selectedDiagnostic) {
    return selectedDiagnostic.eligible
      ? []
      : unique(selectedDiagnostic.ineligibilityReasons)
  }
  if (waypoint.selectedCandidateId === params.selectedCandidateId) {
    return []
  }
  return unique(waypoint.failureReasons)
}

function buildWaypointSummary(
  diagnostics: GreatStopGateSelectionDiagnostics | undefined,
  selectedCandidateId: string,
): CompositionEvidenceLineageWaypointSummary {
  const waypoint = diagnostics?.waypointC1Approval
  const selectedDiagnostic = findSelectedWaypointCandidateDiagnostic(
    waypoint,
    selectedCandidateId,
  )
  return {
    enforcementActive: Boolean(waypoint?.enforcementActive),
    ...(waypoint?.routeShapeContractId ? { routeShapeContractId: waypoint.routeShapeContractId } : {}),
    ...(waypoint?.projectionId ? { projectionId: waypoint.projectionId } : {}),
    selectedCandidateId,
    ...(selectedDiagnostic?.rank
      ? { selectedCandidateRank: selectedDiagnostic.rank }
      : waypoint?.selectedCandidateId === selectedCandidateId && waypoint.selectedCandidateRank
        ? { selectedCandidateRank: waypoint.selectedCandidateRank }
        : {}),
    ...(waypoint ? { eligibleCandidateCount: waypoint.eligibleCandidateCount } : {}),
    failureReasons: selectedRouteWaypointFailureReasons({
      diagnostics,
      selectedCandidateId,
    }),
  }
}

function buildBearingsSummary(
  gate: GreatStopGateResult | undefined,
): CompositionEvidenceLineageBearingsSummary {
  const placeRight = gate?.criteria.placeRight
  if (!placeRight) {
    return {
      status: 'unavailable',
      reasonCodes: ['missing_great_stop_place_right_criterion'],
    }
  }
  return {
    status: placeRight.passed ? 'pass' : 'fail',
    reasonCodes: unique(placeRight.reasons),
  }
}

function buildGreatStopSummary(params: {
  gate: GreatStopGateResult
  selectionDiagnostics?: GreatStopGateSelectionDiagnostics
}): CompositionEvidenceLineageGreatStopSummary {
  return {
    status: params.gate.status,
    ...(params.selectionDiagnostics?.selectedCandidateId
      ? { selectedCandidateId: params.selectionDiagnostics.selectedCandidateId }
      : {}),
    ...(params.selectionDiagnostics?.selectedCandidateRank
      ? { selectedCandidateRank: params.selectionDiagnostics.selectedCandidateRank }
      : {}),
    failedCriteria: [...params.gate.failedCriteria],
    reasonCodes: unique(params.gate.reasons),
  }
}

export function buildCompositionEvidenceLineageFromGeneration(params: {
  selectedArc: ArcCandidate
  diagnostics: GenerationDiagnostics
  routeShapeContract?: RouteShapeContract
  approvedAt?: number
}): CompositionEvidenceLineage | null {
  const { selectedArc, diagnostics, routeShapeContract } = params
  if (!routeShapeContract) {
    return null
  }
  const tasteStamp = selectedArc.scoreBreakdown.experienceCompositionStamp
  const greatStopGate = diagnostics.greatStopGateResult
  const routeIdentity = routeIdentityFromCandidate(selectedArc)
  if (!tasteStamp || !greatStopGate || !routeIdentity) {
    return null
  }

  return {
    schemaVersion: 'composition_evidence_lineage.v0_1',
    source: 'contract_entry_artifact.generation',
    approvedAt: params.approvedAt ?? Date.now(),
    approvedCandidateId: selectedArc.id,
    approvedRouteIdentitySignature: routeIdentitySignature(routeIdentity),
    approvedRouteIdentity: routeIdentity,
    inputCarrier: inputCarrierFromRouteShapeContract(routeShapeContract),
    taste: buildTasteSummary(tasteStamp),
    waypoint: buildWaypointSummary(diagnostics.greatStopGateSelectionDiagnostics, selectedArc.id),
    bearings: buildBearingsSummary(greatStopGate),
    greatStop: buildGreatStopSummary({
      gate: greatStopGate,
      selectionDiagnostics: diagnostics.greatStopGateSelectionDiagnostics,
    }),
  }
}

export function validateCompositionEvidenceLineageForFinalRoute(params: {
  lineage: CompositionEvidenceLineage | null | undefined
  finalRoute: RuntimeRouteArtifact
  selectedDirectionId?: string | null
}): CompositionEvidenceLineageValidationResult {
  const reasons: string[] = []
  const { lineage, finalRoute } = params
  if (!lineage) {
    return {
      ok: false,
      reasons: ['missing_composition_evidence_lineage'],
    }
  }
  if (lineage.schemaVersion !== 'composition_evidence_lineage.v0_1') {
    reasons.push('composition_evidence_lineage_schema_version_mismatch')
  }
  const finalRouteIdentity = getCompositionEvidenceRouteIdentityFromRuntimeRoute(finalRoute)
  if (!finalRouteIdentity) {
    reasons.push('composition_evidence_final_route_identity_missing')
  } else if (
    routeIdentitySignature(finalRouteIdentity) !== lineage.approvedRouteIdentitySignature ||
    routeIdentitySignature(lineage.approvedRouteIdentity) !== lineage.approvedRouteIdentitySignature
  ) {
    reasons.push('composition_evidence_route_identity_mismatch')
  }
  if (
    params.selectedDirectionId?.trim() &&
    lineage.inputCarrier.selectedDirectionId &&
    lineage.inputCarrier.selectedDirectionId !== params.selectedDirectionId
  ) {
    reasons.push('composition_evidence_selected_direction_mismatch')
  }
  if (lineage.taste.requirementSource !== 'route_shape_contract') {
    reasons.push('composition_evidence_taste_requirement_unavailable')
  }
  if (lineage.taste.status === 'fail' || lineage.taste.status === 'unavailable') {
    reasons.push('composition_evidence_taste_not_approved')
  }
  if (
    lineage.taste.routeShapeContractId &&
    lineage.taste.routeShapeContractId !== lineage.inputCarrier.routeShapeContractId
  ) {
    reasons.push('composition_evidence_route_shape_contract_mismatch')
  }
  if (!lineage.waypoint.enforcementActive) {
    reasons.push('composition_evidence_waypoint_c1_not_enforced')
  }
  if (lineage.waypoint.failureReasons.length > 0) {
    reasons.push('composition_evidence_waypoint_c1_failed')
  }
  if (lineage.bearings.status !== 'pass') {
    reasons.push('composition_evidence_bearings_not_pass')
  }
  if (lineage.greatStop.status !== 'PASS') {
    reasons.push('composition_evidence_great_stop_not_pass')
  }
  return {
    ok: reasons.length === 0,
    reasons,
  }
}

export function cloneCompositionEvidenceLineage(
  lineage: CompositionEvidenceLineage,
): CompositionEvidenceLineage {
  return JSON.parse(JSON.stringify(lineage)) as CompositionEvidenceLineage
}
