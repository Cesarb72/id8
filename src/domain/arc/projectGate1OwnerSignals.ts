import {
  evaluatePeakCandidateFeasibility,
  type PeakCandidateFeasibilityVerdict,
} from '../bearings/evaluateArcRouteMovementFeasibility'
import { isMeaningfulMomentStretchCandidate } from '../constraints/localStretchPolicy'
import {
  computeFieldRealVerdict,
  type FieldRealStopInput,
} from '../field/computeFieldRealVerdict'
import type { FieldRealVerdict } from '../field/fieldRealVerdict'
import {
  computeTasteRolePoolMeaningForCandidate,
  toTasteRolePoolMeaningCandidateInput,
} from '../interpretation/taste/computeTasteRolePoolMeaningView'
import type { RolePoolMeaningEvidence } from '../interpretation/taste/computeRolePoolMeaningEvidence'
import type { TasteRouteMeaningStopRole } from '../interpretation/taste/routeMeaningVerdict'
import type {
  ArcCandidate,
  ScoredVenue,
} from '../types/arc'
import type { IntentProfile } from '../types/intent'
import type { VenueSourceMetadata } from '../types/normalization'
import type { InternalRole } from '../types/venue'
import type {
  ArcGate1ActionCandidate,
  ArcGate1ActionEligibility,
  ArcGate1ActionKind,
  ArcGate1BearingsActionSignal,
  ArcGate1CompatibilityPayload,
  ArcGate1FieldActionSignal,
  ArcGate1RoleRouteContext,
  ArcGate1RouteContext,
  ArcGate1TasteActionSignal,
  OwnerProvenancedGate1ActionSignal,
} from '../../integrations/waypoint/coordination/arcGate1ActionPolicyView'

export interface Gate1OwnerSignalProjection {
  source: 'arc_adapter'
  taste: readonly [ArcGate1TasteActionSignal, ...ArcGate1TasteActionSignal[]]
  bearings: readonly [
    ArcGate1BearingsActionSignal,
    ...ArcGate1BearingsActionSignal[],
  ]
  field: ArcGate1FieldActionSignal
  ownerSignals: readonly OwnerProvenancedGate1ActionSignal[]
  tasteEvidence: RolePoolMeaningEvidence
  bearingsFeasibility: PeakCandidateFeasibilityVerdict
  fieldRealVerdict: FieldRealVerdict
  missingOwnerSignals: readonly string[]
}

export interface ProjectGate1OwnerSignalsInput<
  TAction extends ArcGate1ActionKind = ArcGate1ActionKind,
> {
  candidate: ScoredVenue
  action: TAction
  role?: InternalRole
  intent?: IntentProfile
  routeCandidate?: ArcCandidate
  compatibility?: ArcGate1CompatibilityPayload
  routeContext?: ArcGate1RouteContext
}

export interface ProjectGate1ActionCandidateInput<
  TAction extends ArcGate1ActionKind = ArcGate1ActionKind,
>
  extends ProjectGate1OwnerSignalsInput<TAction> {
  id?: string
  deterministicTieBreakKey?: string
}

function toTasteStopRole(role?: InternalRole): TasteRouteMeaningStopRole | undefined {
  if (role === 'warmup') {
    return 'start'
  }
  if (role === 'peak') {
    return 'highlight'
  }
  if (role === 'wildcard') {
    return 'surprise'
  }
  if (role === 'cooldown') {
    return 'windDown'
  }
  return undefined
}

function roleScore(candidate: ScoredVenue, role?: InternalRole): number {
  return role ? candidate.roleScores[role] : candidate.fitScore
}

function stopShapeScore(candidate: ScoredVenue, role?: InternalRole): number {
  if (role === 'warmup') {
    return candidate.stopShapeFit.start
  }
  if (role === 'peak') {
    return candidate.stopShapeFit.highlight
  }
  if (role === 'wildcard') {
    return candidate.stopShapeFit.surprise
  }
  if (role === 'cooldown') {
    return candidate.stopShapeFit.windDown
  }
  return Math.max(
    candidate.stopShapeFit.start,
    candidate.stopShapeFit.highlight,
    candidate.stopShapeFit.surprise,
    candidate.stopShapeFit.windDown,
  )
}

function candidateRole(input: ProjectGate1OwnerSignalsInput): InternalRole | undefined {
  if (input.role) {
    return input.role
  }
  if (
    input.action === 'surprise_promotion' ||
    input.action === 'surprise_demotion'
  ) {
    return 'wildcard'
  }
  if (
    input.action === 'fallback' ||
    input.action === 'romantic_fallback' ||
    input.action === 'hard_contract_pressure' ||
    input.action === 'rescue'
  ) {
    return 'peak'
  }
  return undefined
}

function defaultRouteContext(
  action: ArcGate1ActionKind,
): ArcGate1RouteContext {
  if (action === 'fallback' || action === 'romantic_fallback') {
    return 'partial_fallback_route'
  }
  if (
    action === 'preferred_role_admission' ||
    action === 'hard_contract_pressure'
  ) {
    return 'role_pool'
  }
  if (action === 'rescue') {
    return 'recovery_pool'
  }
  return 'preservation_pool'
}

function tasteSignal(
  key: ArcGate1TasteActionSignal['key'],
  value: boolean,
  reason: string,
  signalValue?: number | string | boolean,
): ArcGate1TasteActionSignal {
  return {
    source: 'taste',
    key,
    authority: 'owner_signal',
    value: signalValue ?? value,
    reason,
  }
}

function bearingsSignal(
  key: ArcGate1BearingsActionSignal['key'],
  value: boolean,
  reason: string,
  signalValue?: number | string | boolean,
): ArcGate1BearingsActionSignal {
  return {
    source: 'bearings',
    key,
    authority: 'owner_signal',
    value: signalValue ?? value,
    reason,
  }
}

function fieldSignal(
  key: ArcGate1FieldActionSignal['key'],
  value: boolean,
  reason: string,
): ArcGate1FieldActionSignal {
  return {
    source: 'field',
    key,
    authority: 'owner_signal',
    value,
    reason,
  }
}

function projectTasteSignals(
  evidence: RolePoolMeaningEvidence,
  candidate: ScoredVenue,
  role?: InternalRole,
): readonly [ArcGate1TasteActionSignal, ...ArcGate1TasteActionSignal[]] {
  const peakWorthiness = evidence.candidate.peakWorthiness
  const centralMomentQuality = evidence.candidate.centralMomentQuality
  const roleFit = roleScore(candidate, role)
  const shapeFit = stopShapeScore(candidate, role)
  const roleSupport = roleFit >= 0.5 && shapeFit >= 0.3
  const familyFit =
    evidence.candidate.family.boundedEnergyCompatible &&
    !evidence.candidate.family.nightlifeConflict
  const romanticSupport =
    evidence.candidate.romantic.cozyCompatible ||
    evidence.candidate.romantic.livelyCompatible ||
    evidence.candidate.categoryArchetype.isSoftRomanticSupportArchetype
  const surpriseWorthiness =
    candidate.roleScores.wildcard >= 0.5 &&
    evidence.candidate.expressionActivation.expressionQuality >= 0.4
  const peakSupport =
    peakWorthiness.status === 'peak_worthy' ||
    peakWorthiness.status === 'near_peak' ||
    peakWorthiness.status === 'weak_peak' ||
    peakWorthiness.status === 'passive_peak'
  const centralMomentSupport =
    centralMomentQuality.status === 'central_moment' ||
    centralMomentQuality.status === 'possible_central_moment' ||
    centralMomentQuality.status === 'weak_central_moment'
  const intentSupport =
    candidate.lensCompatibility >= 0.38 &&
    candidate.contextSpecificity.overall >= 0.3

  return [
    tasteSignal('family_fit', familyFit, familyFit ? 'family_fit:pass' : 'family_fit:fail'),
    tasteSignal(
      'romantic_support',
      romanticSupport,
      romanticSupport ? 'romantic_support:pass' : 'romantic_support:fail',
    ),
    tasteSignal(
      'surprise_worthiness',
      surpriseWorthiness,
      surpriseWorthiness ? 'surprise_worthiness:pass' : 'surprise_worthiness:fail',
    ),
    tasteSignal(
      'peak_support',
      peakSupport,
      `peak_support:${peakWorthiness.status}`,
      peakWorthiness.score,
    ),
    tasteSignal(
      'central_moment_support',
      centralMomentSupport,
      `central_moment_support:${centralMomentQuality.status}`,
      centralMomentQuality.score,
    ),
    tasteSignal(
      'role_support',
      roleSupport,
      roleSupport ? 'role_support:pass' : 'role_support:fail',
      roleFit,
    ),
    tasteSignal(
      'intent_support',
      intentSupport,
      intentSupport ? 'intent_support:pass' : 'intent_support:fail',
      candidate.lensCompatibility,
    ),
  ]
}

function routeCompactnessFeasible(routeCandidate?: ArcCandidate): boolean {
  if (!routeCandidate) {
    return false
  }
  return (
    routeCandidate.spatial.score >= 0.48 &&
    routeCandidate.spatial.longTransitionCount <= 1 &&
    routeCandidate.spatial.repeatedClusterEscapeCount <= 1
  )
}

function routeFeasible(
  feasibility: PeakCandidateFeasibilityVerdict,
  routeCandidate?: ArcCandidate,
): boolean {
  if (!routeCandidate) {
    return feasibility.feasible
  }
  return feasibility.feasible && routeCandidate.spatial.score >= 0.4
}

function projectBearingsSignals(
  feasibility: PeakCandidateFeasibilityVerdict,
  routeCandidate?: ArcCandidate,
): readonly [
  ArcGate1BearingsActionSignal,
  ...ArcGate1BearingsActionSignal[],
] {
  const compactnessFeasible = routeCompactnessFeasible(routeCandidate)
  const routeIsFeasible = routeFeasible(feasibility, routeCandidate)
  const placeRightFeasible =
    compactnessFeasible &&
    routeIsFeasible &&
    (routeCandidate?.scoreBreakdown.localSupplySufficient ?? true)
  const movementFeasible =
    feasibility.distanceFeasible &&
    feasibility.routeTimeFeasible &&
    (routeCandidate?.spatial.longTransitionCount ?? 0) <= 1
  const admissionSurvived = feasibility.feasible
  const constraintsSurvived = feasibility.constraintsFeasible

  return [
    bearingsSignal(
      'route_feasibility',
      routeIsFeasible,
      routeIsFeasible ? 'route_feasibility:pass' : 'route_feasibility:fail',
    ),
    bearingsSignal(
      'compactness_feasibility',
      compactnessFeasible,
      routeCandidate
        ? compactnessFeasible
          ? 'compactness_feasibility:pass'
          : 'compactness_feasibility:fail'
        : 'compactness_feasibility:route_candidate_missing',
      routeCandidate?.spatial.score ?? false,
    ),
    bearingsSignal(
      'place_right_feasibility',
      placeRightFeasible,
      placeRightFeasible ? 'place_right_feasibility:pass' : 'place_right_feasibility:fail',
    ),
    bearingsSignal(
      'hours_feasibility',
      feasibility.hoursFeasible,
      feasibility.hoursFeasible ? 'hours_feasibility:pass' : 'hours_feasibility:fail',
    ),
    bearingsSignal(
      'distance_feasibility',
      feasibility.distanceFeasible,
      feasibility.distanceFeasible ? 'distance_feasibility:pass' : 'distance_feasibility:fail',
    ),
    bearingsSignal(
      'movement_feasibility',
      movementFeasible,
      movementFeasible ? 'movement_feasibility:pass' : 'movement_feasibility:fail',
    ),
    bearingsSignal(
      'admission_survival',
      admissionSurvived,
      admissionSurvived ? 'admission_survival:pass' : 'admission_survival:fail',
    ),
    bearingsSignal(
      'constraint_survival',
      constraintsSurvived,
      constraintsSurvived ? 'constraint_survival:pass' : 'constraint_survival:fail',
    ),
  ]
}

function fieldStopInput(candidate: ScoredVenue, role?: InternalRole): FieldRealStopInput {
  const source = candidate.venue.source as Partial<VenueSourceMetadata>
  const fieldVenue = {
    ...candidate.venue,
    source: {
      ...source,
      sourceOrigin: source.sourceOrigin ?? 'curated',
      normalizedFromRawType: source.normalizedFromRawType ?? 'seed',
      sourceConfidence: source.sourceConfidence ?? 1,
      completenessScore: source.completenessScore ?? 1,
      qualityScore: source.qualityScore ?? 1,
      hoursKnown: source.hoursKnown ?? false,
      likelyOpenForCurrentWindow: source.likelyOpenForCurrentWindow ?? false,
      businessStatus: source.businessStatus ?? 'unknown',
      timeConfidence: source.timeConfidence ?? 0,
      hoursPressureLevel: source.hoursPressureLevel ?? 'unknown',
      hoursPressureNotes: source.hoursPressureNotes ?? [],
      hoursDemotionApplied: source.hoursDemotionApplied ?? false,
      hoursSuppressionApplied: source.hoursSuppressionApplied ?? false,
      sourceTypes: source.sourceTypes ?? [],
      missingFields: source.missingFields ?? [],
      inferredFields: source.inferredFields ?? [],
      qualityGateStatus: source.qualityGateStatus ?? 'approved',
      qualityGateNotes: source.qualityGateNotes ?? [],
      approvalBlockers: source.approvalBlockers ?? [],
      demotionReasons: source.demotionReasons ?? [],
      suppressionReasons: source.suppressionReasons ?? [],
    } satisfies VenueSourceMetadata,
  }

  return {
    role: role ?? 'candidate',
    venue: fieldVenue,
    candidateIdentity: candidate.candidateIdentity,
  }
}

function projectFieldSignal(verdict: FieldRealVerdict): ArcGate1FieldActionSignal {
  return fieldSignal(
    'real_record',
    verdict.status === 'pass',
    verdict.failureReasons.length > 0
      ? verdict.failureReasons.join('|')
      : `real_record:${verdict.status}`,
  )
}

function projectAdditionalFieldSignals(
  verdict: FieldRealVerdict,
): readonly ArcGate1FieldActionSignal[] {
  return [
    fieldSignal(
      'active_record',
      verdict.status === 'pass' &&
        verdict.availabilityStatus === 'available_from_record' &&
        verdict.suppressionStatus === 'not_suppressed' &&
        verdict.stalenessStatus === 'current',
      `active_record:${verdict.availabilityStatus}`,
    ),
    fieldSignal(
      'resolved_identity',
      verdict.identityUsable && verdict.sourceUsable && verdict.provenanceValid,
      verdict.identityUsable && verdict.sourceUsable && verdict.provenanceValid
        ? 'resolved_identity:pass'
        : verdict.failureReasons.join('|') || 'resolved_identity:fail',
    ),
  ]
}

function missingOwnerSignals(
  projection: {
    taste: readonly ArcGate1TasteActionSignal[]
    bearings: readonly ArcGate1BearingsActionSignal[]
    field: ArcGate1FieldActionSignal
  },
): string[] {
  return [
    ...projection.taste
      .filter((signal) => signal.value === false)
      .map((signal) => `taste:${signal.key}`),
    ...projection.bearings
      .filter((signal) => signal.value === false)
      .map((signal) => `bearings:${signal.key}`),
    ...(projection.field.value === false ? [`field:${projection.field.key}`] : []),
  ]
}

export function projectGate1OwnerSignals(
  input: ProjectGate1OwnerSignalsInput,
): Gate1OwnerSignalProjection {
  const role = candidateRole(input)
  const tasteEvidence = computeTasteRolePoolMeaningForCandidate({
    role: toTasteStopRole(role),
    context: {
      mode: input.intent?.mode,
      persona: input.intent?.persona ?? null,
      contractPersona: undefined,
      contractVibe: undefined,
      selectedDirectionContext: input.intent?.selectedDirectionContext,
    },
    candidate: toTasteRolePoolMeaningCandidateInput(input.candidate),
  })
  const bearingsFeasibility = evaluatePeakCandidateFeasibility({
    candidate: input.candidate,
    intent: input.intent,
    anchoredPeakBaseVenueId:
      input.intent?.planningMode === 'user-led' && input.intent.anchor?.role === 'highlight'
        ? input.intent.anchor.venueId
        : undefined,
    allowMeaningfulStretch: true,
    isMeaningfulStretchCandidate: isMeaningfulMomentStretchCandidate,
    minimumProximityFitWithoutIntent: 0.48,
    evaluateHoursPressure: true,
    evaluateRouteTime: true,
    requireHighlightValidity: role === 'peak' || input.action === 'surprise_promotion',
    requireHighlightVetoClear: input.action !== 'fallback',
    requirePeakContract:
      role === 'peak' ||
      input.action === 'hard_contract_pressure' ||
      input.action === 'rescue',
  })
  const fieldRealVerdict = computeFieldRealVerdict([
    fieldStopInput(input.candidate, role),
  ])
  const taste = projectTasteSignals(tasteEvidence, input.candidate, role)
  const bearings = projectBearingsSignals(bearingsFeasibility, input.routeCandidate)
  const field = projectFieldSignal(fieldRealVerdict)
  const extraFieldSignals = projectAdditionalFieldSignals(fieldRealVerdict)
  const ownerSignals = [...taste, ...bearings, field, ...extraFieldSignals]

  return {
    source: 'arc_adapter',
    taste,
    bearings,
    field,
    ownerSignals,
    tasteEvidence,
    bearingsFeasibility,
    fieldRealVerdict,
    missingOwnerSignals: missingOwnerSignals({ taste, bearings, field }),
  }
}

export function projectGate1ActionCandidate<
  TAction extends ArcGate1ActionKind,
>(
  input: ProjectGate1ActionCandidateInput<TAction>,
): ArcGate1ActionCandidate<TAction, ScoredVenue> {
  const projection = projectGate1OwnerSignals(input)
  const role = candidateRole(input)
  const id = input.id ?? input.candidate.candidateIdentity.candidateId
  const roleRouteContext: ArcGate1RoleRouteContext = {
    routeContext: input.routeContext ?? defaultRouteContext(input.action),
    candidateRole: role,
    routeShape: input.routeCandidate
      ? input.routeCandidate.hasWildcard
        ? 'wildcard'
        : 'core'
      : input.action === 'fallback'
        ? 'partial'
        : undefined,
  }

  const eligibility = {
    taste: projection.taste,
    bearings: projection.bearings,
    field: projection.field,
  } as ArcGate1ActionEligibility<TAction>

  return {
    id,
    action: input.action,
    payload: input.candidate,
    identity: {
      candidateId: input.candidate.candidateIdentity.candidateId,
      baseVenueId: input.candidate.candidateIdentity.baseVenueId,
      traceLabel: input.candidate.candidateIdentity.traceLabel,
    },
    roleRouteContext,
    deterministicTieBreakKey:
      input.deterministicTieBreakKey ?? input.candidate.candidateIdentity.candidateId,
    eligibility,
    ownerSignals: projection.ownerSignals,
    compatibility: input.compatibility,
  }
}
