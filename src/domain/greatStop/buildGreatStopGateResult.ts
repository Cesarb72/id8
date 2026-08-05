import type { ArcCandidate, ArcStop } from '../types/arc'
import type { RoutePacingDiagnostics, TransitionExplainabilityDiagnostics } from '../types/diagnostics'
import type {
  BuildLocationClass,
  GreatStopCandidateFailureDetails,
  GreatStopCompactnessRankingDiagnostics,
  GreatStopGateCandidateFailureDetail,
  GreatStopGateCandidateSummary,
  GreatStopGateCandidateIdentityDiagnostic,
  GreatStopCriterionResult,
  GreatStopGateResult,
  GreatStopGatePresetSource,
  GreatStopGateRolePoolIdentityDiagnostics,
  GreatStopGateSelectionDiagnostics,
  GreatStopGateSelectionStage,
  GreatStopGateStatus,
  GreatStopTravelTolerance,
} from '../types/greatStopGate'
import type {
  DistanceMode,
  IntentProfile,
  PersonaMode,
  RouteShapePlaceRightMovementProfile,
} from '../types/intent'
import type { UserStopRole } from '../types/itinerary'
import type { BearingsPlaceRightVerdict } from '../bearings/routePlaceRightContract'
import type { FieldRealVerdict } from '../field/fieldRealVerdict'
import { roleProjection } from '../config/roleProjection'
import { getArcStopBaseVenueId } from '../candidates/candidateIdentity'
import {
  computeRouteMeaningIntentRightVerdict,
  computeRouteMeaningRoleRightVerdict,
} from '../interpretation/taste/computeRouteMeaningVerdict'
import type { TasteRouteMeaningStopEvidenceInput } from '../interpretation/taste/computeRouteMeaningVerdict'
import type { TasteRouteMomentVerdict } from '../interpretation/taste/routeMomentVerdict'

const DIAGNOSTIC_CANDIDATE_SUMMARY_LIMIT = 25
const GREAT_STOP_FAILURE_DETAIL_LIMIT = 5

interface PlaceRightPreset {
  travelTolerance: GreatStopTravelTolerance
  maxComfortableTotalMovementMinutes: number
  maxSingleTransitionMinutes: number
  maxClusterEscapes: number
  driveLikeMovement: 'discouraged' | 'limited' | 'acceptable'
}

const PLACE_RIGHT_PRESETS: Record<PersonaMode, Record<BuildLocationClass, PlaceRightPreset>> = {
  romantic: {
    'L1 Dense': {
      travelTolerance: 'tight',
      maxComfortableTotalMovementMinutes: 18,
      maxSingleTransitionMinutes: 10,
      maxClusterEscapes: 1,
      driveLikeMovement: 'discouraged',
    },
    'L2 Mid': {
      travelTolerance: 'tight',
      maxComfortableTotalMovementMinutes: 24,
      maxSingleTransitionMinutes: 14,
      maxClusterEscapes: 1,
      driveLikeMovement: 'limited',
    },
    'L3 Sparse': {
      travelTolerance: 'expanded',
      maxComfortableTotalMovementMinutes: 32,
      maxSingleTransitionMinutes: 18,
      maxClusterEscapes: 2,
      driveLikeMovement: 'acceptable',
    },
  },
  friends: {
    'L1 Dense': {
      travelTolerance: 'balanced',
      maxComfortableTotalMovementMinutes: 24,
      maxSingleTransitionMinutes: 12,
      maxClusterEscapes: 1,
      driveLikeMovement: 'limited',
    },
    'L2 Mid': {
      travelTolerance: 'balanced',
      maxComfortableTotalMovementMinutes: 32,
      maxSingleTransitionMinutes: 16,
      maxClusterEscapes: 2,
      driveLikeMovement: 'acceptable',
    },
    'L3 Sparse': {
      travelTolerance: 'expanded',
      maxComfortableTotalMovementMinutes: 42,
      maxSingleTransitionMinutes: 22,
      maxClusterEscapes: 2,
      driveLikeMovement: 'acceptable',
    },
  },
  family: {
    'L1 Dense': {
      travelTolerance: 'tight',
      maxComfortableTotalMovementMinutes: 18,
      maxSingleTransitionMinutes: 10,
      maxClusterEscapes: 1,
      driveLikeMovement: 'discouraged',
    },
    'L2 Mid': {
      travelTolerance: 'tight',
      maxComfortableTotalMovementMinutes: 24,
      maxSingleTransitionMinutes: 14,
      maxClusterEscapes: 1,
      driveLikeMovement: 'limited',
    },
    'L3 Sparse': {
      travelTolerance: 'expanded',
      maxComfortableTotalMovementMinutes: 34,
      maxSingleTransitionMinutes: 18,
      maxClusterEscapes: 2,
      driveLikeMovement: 'acceptable',
    },
  },
}

function round(value: number): number {
  return Number(value.toFixed(3))
}

export function inferBuildLocationClass(distanceMode: DistanceMode): BuildLocationClass {
  return distanceMode === 'nearby' ? 'L1 Dense' : 'L2 Mid'
}

function criterion(passed: boolean, reasons: string[]): GreatStopCriterionResult {
  return { passed, reasons }
}

function internalRoleFor(role: UserStopRole | undefined): ArcStop['role'] | undefined {
  if (role === 'start') return 'warmup'
  if (role === 'highlight') return 'peak'
  if (role === 'windDown') return 'cooldown'
  return undefined
}

function roleFor(stop: ArcStop): UserStopRole {
  return roleProjection[stop.role]
}

function getRoleStop(candidate: ArcCandidate, role: ArcStop['role']): ArcStop | undefined {
  return candidate.stops.find((stop) => stop.role === role)
}

function evaluateRealFromField(verdict?: FieldRealVerdict): GreatStopCriterionResult {
  if (!verdict) {
    return criterion(false, ['real:field_verdict_missing'])
  }

  if (!verdict.realReady || verdict.status === 'unknown') {
    return criterion(
      false,
      verdict.failureReasons.length > 0
        ? [...verdict.failureReasons]
        : ['real:field_verdict_not_ready'],
    )
  }

  if (verdict.status === 'pass') {
    return criterion(true, [])
  }

  return criterion(
    false,
    verdict.failureReasons.length > 0
      ? [...verdict.failureReasons]
      : ['real:field_verdict_failed'],
  )
}

function getStopShapeFitScore(stop: ArcStop): number | undefined {
  const role = roleFor(stop)
  if (role === 'start') {
    return stop.scoredVenue.stopShapeFit.start
  }
  if (role === 'highlight') {
    return stop.scoredVenue.stopShapeFit.highlight
  }
  if (role === 'windDown') {
    return stop.scoredVenue.stopShapeFit.windDown
  }
  return stop.scoredVenue.stopShapeFit.surprise
}

function toRoleRightStopEvidence(stop: ArcStop): TasteRouteMeaningStopEvidenceInput {
  return {
    role: roleFor(stop),
    candidateVenueId: getArcStopBaseVenueId(stop),
    roleFitScore: stop.scoredVenue.roleScores[stop.role],
    stopShapeFitScore: getStopShapeFitScore(stop),
    contextSpecificityScore: stop.scoredVenue.contextSpecificity.overall,
  }
}

function toIntentRightStopEvidence(stop: ArcStop): TasteRouteMeaningStopEvidenceInput {
  return {
    role: roleFor(stop),
    candidateVenueId: getArcStopBaseVenueId(stop),
    routeFitScore: stop.scoredVenue.fitScore,
    lensCompatibilityScore: stop.scoredVenue.lensCompatibility,
    contextSpecificityScore: stop.scoredVenue.contextSpecificity.overall,
  }
}

function evaluateRoleRight(candidate: ArcCandidate): GreatStopCriterionResult {
  const roleRightVerdict = computeRouteMeaningRoleRightVerdict(
    candidate.stops.map(toRoleRightStopEvidence),
  )
  if (!roleRightVerdict.ready || roleRightVerdict.status === 'unknown') {
    return criterion(false, ['role_right:taste_verdict_not_ready'])
  }
  if (roleRightVerdict.status === 'pass') {
    return criterion(true, [])
  }
  return criterion(
    false,
    roleRightVerdict.reasons.length > 0
      ? [...roleRightVerdict.reasons]
      : ['role_right:taste_verdict_failed'],
  )
}

function evaluateIntentRight(candidate: ArcCandidate): GreatStopCriterionResult {
  const intentRightVerdict = computeRouteMeaningIntentRightVerdict(
    candidate.stops.map(toIntentRightStopEvidence),
  )
  if (!intentRightVerdict.ready || intentRightVerdict.status === 'unknown') {
    return criterion(false, ['intent_right:taste_verdict_not_ready'])
  }
  if (intentRightVerdict.status === 'pass') {
    return criterion(true, [])
  }
  return criterion(
    false,
    intentRightVerdict.reasons.length > 0
      ? [...intentRightVerdict.reasons]
      : ['intent_right:taste_verdict_failed'],
  )
}

function evaluatePlaceRightFromBearings(params: {
  persona: PersonaMode
  locationClass: BuildLocationClass
  verdict?: BearingsPlaceRightVerdict
  placeRightTolerance?: RouteShapePlaceRightMovementProfile
}): {
  result: GreatStopCriterionResult
  diagnostics: Pick<
    GreatStopGateResult['diagnostics'],
    | 'movement'
    | 'clusterCoherence'
    | 'zigzagOrBacktrack'
    | 'placeRightClauseAttribution'
    | 'placeRightSupportWorldDiagnostics'
    | 'placeRightDiagnosticCounterfactuals'
  >
  preset: PlaceRightPreset
} {
  const preset = params.placeRightTolerance
    ? {
        travelTolerance: params.placeRightTolerance.travelTolerance,
        maxComfortableTotalMovementMinutes:
          params.placeRightTolerance.maxComfortableTotalMovementMinutes,
        maxSingleTransitionMinutes: params.placeRightTolerance.maxSingleTransitionMinutes,
        maxClusterEscapes: params.placeRightTolerance.maxClusterEscapes,
        driveLikeMovement: params.placeRightTolerance.driveLikeMovement,
      }
    : PLACE_RIGHT_PRESETS[params.persona][params.locationClass]
  const verdict = params.verdict
  const reasons =
    verdict?.compatibility.greatStopPlaceRightReasonCodes ??
    verdict?.reasons ??
    ['place_right:bearings_verdict_missing']
  const ready = verdict?.placeRightReady === true && verdict.status !== 'unknown'
  const passed = ready && verdict.status === 'pass'
  const failureReasons = passed
    ? []
    : reasons.length > 0
      ? reasons
      : ready
        ? ['place_right:bearings_verdict_failed']
        : verdict
          ? ['place_right:bearings_verdict_not_ready']
          : ['place_right:bearings_verdict_missing']
  const routeReasonCodes = verdict?.routeEvidence.reasonCodes ?? verdict?.reasons ?? []
  const districtNotes =
    verdict?.provenance.notes?.filter((note) => note.startsWith('consumed-district-')) ?? []
  const transitionMinutes = verdict?.distanceBurden.notes ?? []
  const parseDiagnosticNumber = (prefix: string): number => {
    const value = Number(
      transitionMinutes.find((note) => note.startsWith(prefix))?.replace(prefix, '') ?? 0,
    )
    return Number.isFinite(value) ? value : 0
  }
  const totalEstimatedTransitionMinutes = parseDiagnosticNumber('total:')
  const maxTransition = parseDiagnosticNumber('max:')
  const driveLikeMovement = verdict?.distanceBurden.burden === 'high'
  const backtrackDetected = routeReasonCodes.includes('place_right:backtrack_structure')
  const clusterEscapeDetected = routeReasonCodes.includes('place_right:cluster_escape_structure')

  return {
    result: criterion(passed, failureReasons),
    preset,
    diagnostics: {
      movement: {
        totalEstimatedTransitionMinutes,
        maxSingleTransitionMinutes: maxTransition,
        transitionCount: verdict?.distanceBurden.reasonCodes.length ?? 0,
        driveLikeMovement,
        transitionLimitMinutes: preset.maxSingleTransitionMinutes,
        totalLimitMinutes: preset.maxComfortableTotalMovementMinutes,
      },
      clusterCoherence: {
        clusterEscapeCount: clusterEscapeDetected ? preset.maxClusterEscapes + 1 : 0,
        repeatedClusterEscapeCount: backtrackDetected ? 1 : 0,
        longTransitionCount:
          routeReasonCodes.includes('place_right:low_route_compactness') || driveLikeMovement
            ? 1
            : 0,
        maxClusterEscapes: preset.maxClusterEscapes,
        spatialScore: passed ? 1 : 0,
        notes: [
          'source:bearings_place_right_verdict',
          `bearings_status:${verdict?.status ?? 'missing'}`,
          ...districtNotes,
          ...routeReasonCodes,
        ],
      },
      zigzagOrBacktrack: {
        detected: backtrackDetected,
        ...(backtrackDetected ? { reason: 'place_right:backtrack_structure' } : {}),
      },
      placeRightClauseAttribution: verdict?.clauseAttribution,
      placeRightSupportWorldDiagnostics: verdict?.supportWorldDiagnostics,
      placeRightDiagnosticCounterfactuals: verdict?.diagnosticCounterfactuals,
    },
  }
}

function laneDiagnostics(candidate: ArcCandidate): GreatStopGateResult['diagnostics']['laneVariance'] {
  const lanes = candidate.stops.map((stop) => String(stop.scoredVenue.taste.modeAlignment.lane))
  const laneCounts = new Map<string, number>()
  for (const lane of lanes) laneCounts.set(lane, (laneCounts.get(lane) ?? 0) + 1)
  const laneRepetitionCount = [...laneCounts.values()].reduce(
    (sum, count) => sum + Math.max(0, count - 1),
    0,
  )
  const supportLanes = candidate.stops
    .filter((stop) => stop.role !== 'peak')
    .map((stop) => String(stop.scoredVenue.taste.modeAlignment.lane))
  return {
    uniqueLaneCount: laneCounts.size,
    laneRepetitionCount,
    supportLaneVariance: new Set(supportLanes).size,
  }
}

function arcProgressionDiagnostics(
  candidate: ArcCandidate,
): GreatStopGateResult['diagnostics']['arcProgression'] {
  const start = getRoleStop(candidate, 'warmup')
  const highlight = getRoleStop(candidate, 'peak')
  const windDown = getRoleStop(candidate, 'cooldown')
  const supportAverageRoleFit =
    start && windDown
      ? (start.scoredVenue.roleScores.warmup + windDown.scoredVenue.roleScores.cooldown) / 2
      : 0
  const peakRoleAdvantage = highlight
    ? highlight.scoredVenue.roleScores.peak - supportAverageRoleFit
    : 0
  const energyProgressionValid = Boolean(
    start &&
      highlight &&
      windDown &&
      highlight.scoredVenue.venue.energyLevel >= start.scoredVenue.venue.energyLevel &&
      windDown.scoredVenue.venue.energyLevel <= highlight.scoredVenue.venue.energyLevel,
  )
  return {
    startPresent: Boolean(start),
    highlightPresent: Boolean(highlight),
    windDownPresent: Boolean(windDown),
    peakRoleAdvantage: round(peakRoleAdvantage),
    supportAverageRoleFit: round(supportAverageRoleFit),
    energyProgressionValid,
  }
}

function evaluateMomentRight(candidate: ArcCandidate): {
  result: GreatStopCriterionResult
  diagnostics: Pick<GreatStopGateResult['diagnostics'], 'arcProgression' | 'laneVariance' | 'strongMoment'>
} {
  const arcProgression = arcProgressionDiagnostics(candidate)
  const laneVariance = laneDiagnostics(candidate)
  const verdict = candidate.scoreBreakdown.routeMomentVerdict
  if (!verdict) {
    return {
      result: criterion(false, ['moment_right:taste_verdict_missing']),
      diagnostics: {
        arcProgression,
        laneVariance,
        strongMoment: {
          present: false,
        },
      },
    }
  }

  const momentFlatPenalty = verdict.flatArcRisk.penalty ?? verdict.flatArcRisk.score ?? 0
  const strongMoment = {
    present: verdict.strongMomentPresent,
    note: verdict.momentQualityNote ?? verdict.momentStrengthVerdict.reason,
    highlightMomentScore: verdict.peakSuitability.score,
    momentStrengthScore: verdict.momentStrengthVerdict.score,
    momentFlatPenalty,
  }
  const reasons = reasonsFromTasteRouteMomentVerdict(verdict)
  return {
    result: criterion(reasons.length === 0, reasons),
    diagnostics: {
      arcProgression,
      laneVariance,
      strongMoment,
    },
  }
}

function reasonsFromTasteRouteMomentVerdict(verdict: TasteRouteMomentVerdict): string[] {
  const reasons: string[] = []
  if (!verdict.strongMomentPresent) {
    reasons.push('moment_right:no_strong_main_moment')
  }
  if (verdict.flatArcRisk.level !== 'none') {
    reasons.push('moment_right:taste_flat_arc_risk')
  }
  if (verdict.momentPreservationStatus === 'unknown') {
    reasons.push('moment_right:taste_verdict_unknown')
  }
  return reasons
}

function creditedAnchorRole(params: {
  candidate: ArcCandidate
  venueId?: string
}): UserStopRole | undefined {
  if (!params.venueId) return undefined
  const venueId = params.venueId
  const stop = params.candidate.stops.find((entry) => stopMatchesRequiredAnchor(entry, venueId))
  return stop ? roleFor(stop) : undefined
}

function stopMatchesRequiredAnchor(stop: ArcStop, venueId: string): boolean {
  return getArcStopBaseVenueId(stop) === venueId || stop.scoredVenue.venue.id === venueId
}

export function buildGreatStopRoutePacingDiagnostics(
  candidate: ArcCandidate,
): RoutePacingDiagnostics {
  const candidatePacing = candidate.pacing as Partial<ArcCandidate['pacing']> | undefined
  if (!candidatePacing?.transitions) {
    const transitions: TransitionExplainabilityDiagnostics[] = candidate.spatial.transitions.map((transition, index) => {
      const fromStop = candidate.stops[index]
      const toStop = candidate.stops[index + 1]
      const estimatedTransitionMinutes = Math.max(0, transition.driveGap ?? 0)
      return {
        fromRole: fromStop ? roleFor(fromStop) : 'start',
        toRole: toStop ? roleFor(toStop) : 'highlight',
        fromVenueId: transition.fromVenueId,
        toVenueId: transition.toVenueId,
        estimatedTravelMinutes: estimatedTransitionMinutes,
        transitionBufferMinutes: 0,
        estimatedTransitionMinutes,
        frictionScore: estimatedTransitionMinutes / 20,
        movementMode: transition.longTransition ? 'short-drive' : 'walkable',
        neighborhoodContinuity: transition.sameCluster ? 'same-neighborhood' : 'adjacent-neighborhoods',
        notes: [...transition.notes],
      }
    })
    const estimatedTransitionMinutes = transitions.reduce(
      (sum, transition) => sum + transition.estimatedTransitionMinutes,
      0,
    )
    return {
      transitions,
      totalRouteFriction: 0,
      estimatedStopMinutes: 0,
      estimatedTransitionMinutes,
      estimatedTotalMinutes: estimatedTransitionMinutes,
      estimatedTotalLabel: `${estimatedTransitionMinutes}m`,
      routeFeelLabel: 'diagnostic',
      pacingPenaltyApplied: false,
      pacingPenaltyReasons: [],
      smoothProgressionRewardApplied: false,
      smoothProgressionRewardReasons: [],
    }
  }
  return {
    transitions: candidatePacing.transitions.map((transition) => ({
      fromRole: roleProjection[transition.fromRoleKey as ArcStop['role']],
      toRole: roleProjection[transition.toRoleKey as ArcStop['role']],
      fromVenueId: transition.fromVenueId,
      toVenueId: transition.toVenueId,
      estimatedTravelMinutes: transition.estimatedTravelMinutes,
      transitionBufferMinutes: transition.transitionBufferMinutes,
      estimatedTransitionMinutes: transition.estimatedTransitionMinutes,
      frictionScore: transition.frictionScore,
      movementMode: transition.movementMode,
      neighborhoodContinuity: transition.neighborhoodContinuity,
      notes: transition.notes,
    })),
    totalRouteFriction: candidatePacing.totalRouteFriction ?? 0,
    estimatedStopMinutes: candidatePacing.estimatedStopMinutes ?? 0,
    estimatedTransitionMinutes: candidatePacing.estimatedTransitionMinutes ?? 0,
    estimatedTotalMinutes: candidatePacing.estimatedTotalMinutes ?? 0,
    estimatedTotalLabel: candidatePacing.estimatedTotalLabel ?? 'n/a',
    routeFeelLabel: candidatePacing.routeFeelLabel ?? 'diagnostic',
    pacingPenaltyApplied: candidatePacing.pacingPenaltyApplied ?? false,
    pacingPenaltyReasons: candidatePacing.pacingPenaltyReasons ?? [],
    smoothProgressionRewardApplied: candidatePacing.smoothProgressionRewardApplied ?? false,
    smoothProgressionRewardReasons: candidatePacing.smoothProgressionRewardReasons ?? [],
  }
}

export function buildGreatStopGateResult(params: {
  selectedArc: ArcCandidate
  intent: IntentProfile
  routePacing: RoutePacingDiagnostics
  placeRightVerdict?: BearingsPlaceRightVerdict
  fieldRealVerdict?: FieldRealVerdict
  locationClass?: BuildLocationClass
  locationClassSource?: GreatStopGatePresetSource
  placeRightTolerance?: RouteShapePlaceRightMovementProfile
}): GreatStopGateResult {
  const { selectedArc, intent } = params
  const persona = intent.persona ?? 'friends'
  const locationClass = params.locationClass ?? inferBuildLocationClass(intent.distanceMode)
  const locationClassSource: GreatStopGatePresetSource = params.locationClass
    ? params.locationClassSource ?? 'explicit'
    : 'inferred_from_distance_mode'
  const placeRight = evaluatePlaceRightFromBearings({
    persona,
    locationClass,
    verdict: params.placeRightVerdict,
    placeRightTolerance: params.placeRightTolerance,
  })
  const momentRight = evaluateMomentRight(selectedArc)
  const requiredAnchorRole = intent.anchor?.role
  const requiredAnchorVenueId = intent.anchor?.venueId
  const requiredAnchorInternalRole = internalRoleFor(requiredAnchorRole)
  const creditedRole = creditedAnchorRole({
    candidate: selectedArc,
    venueId: requiredAnchorVenueId,
  })
  const requiredAnchor =
    requiredAnchorVenueId && requiredAnchorRole
      ? {
          venueId: requiredAnchorVenueId,
          role: requiredAnchorRole,
          survived: Boolean(
            creditedRole &&
              (!requiredAnchorInternalRole ||
                selectedArc.stops.some(
                  (stop) =>
                    stop.role === requiredAnchorInternalRole &&
                    stopMatchesRequiredAnchor(stop, requiredAnchorVenueId),
                )),
          ),
          creditedRole,
        }
      : undefined
  const real = evaluateRealFromField(params.fieldRealVerdict)
  const roleRight = evaluateRoleRight(selectedArc)
  const intentRight = evaluateIntentRight(selectedArc)
  const criteria = {
    real,
    roleRight,
    intentRight,
    placeRight: placeRight.result,
    momentRight: momentRight.result,
  }
  const failedCriteria = [
    ...(criteria.real.passed ? [] : ['real' as const]),
    ...(criteria.roleRight.passed ? [] : ['role_right' as const]),
    ...(criteria.intentRight.passed ? [] : ['intent_right' as const]),
    ...(criteria.placeRight.passed ? [] : ['place_right' as const]),
    ...(criteria.momentRight.passed ? [] : ['moment_right' as const]),
  ]
  const reasons = [
    ...criteria.real.reasons,
    ...criteria.roleRight.reasons,
    ...criteria.intentRight.reasons,
    ...criteria.placeRight.reasons,
    ...criteria.momentRight.reasons,
  ]
  return {
    status: failedCriteria.length === 0 ? 'PASS' : 'FAIL',
    failedCriteria,
    reasons,
    routeId: selectedArc.id,
    requiredAnchor,
    criteria,
    preset: {
      persona,
      locationClass,
      travelTolerance: placeRight.preset.travelTolerance,
      source: locationClassSource,
    },
    diagnostics: {
      movement: placeRight.diagnostics.movement,
      clusterCoherence: placeRight.diagnostics.clusterCoherence,
      zigzagOrBacktrack: placeRight.diagnostics.zigzagOrBacktrack,
      arcProgression: momentRight.diagnostics.arcProgression,
      laneVariance: momentRight.diagnostics.laneVariance,
      strongMoment: momentRight.diagnostics.strongMoment,
      placeRightClauseAttribution: placeRight.diagnostics.placeRightClauseAttribution,
      placeRightSupportWorldDiagnostics:
        placeRight.diagnostics.placeRightSupportWorldDiagnostics,
      placeRightDiagnosticCounterfactuals:
        placeRight.diagnostics.placeRightDiagnosticCounterfactuals,
    },
  }
}

function buildCandidateSignature(candidate: ArcCandidate): string {
  return candidate.stops
    .map((stop) => `${roleFor(stop)}:${stop.scoredVenue.venue.id}`)
    .join('|')
}

function candidateContainsRequiredAnchorByRawId(
  candidate: ArcCandidate,
  requiredAnchorVenueId?: string,
): boolean {
  return Boolean(
    requiredAnchorVenueId &&
      candidate.stops.some((stop) => stop.scoredVenue.venue.id === requiredAnchorVenueId),
  )
}

function candidateContainsRequiredAnchorByBaseVenueId(
  candidate: ArcCandidate,
  requiredAnchorVenueId?: string,
): boolean {
  return Boolean(
    requiredAnchorVenueId &&
      candidate.stops.some(
        (stop) => stop.scoredVenue.candidateIdentity.baseVenueId === requiredAnchorVenueId,
      ),
  )
}

function candidateContainsRequiredAnchorByNormalizedHelper(
  candidate: ArcCandidate,
  requiredAnchorVenueId?: string,
): boolean {
  return Boolean(
    requiredAnchorVenueId &&
      candidate.stops.some((stop) => getArcStopBaseVenueId(stop) === requiredAnchorVenueId),
  )
}

function firstRankWhereRequiredAnchorAppears(
  candidates: ArcCandidate[],
  requiredAnchorVenueId?: string,
): number | undefined {
  if (!requiredAnchorVenueId) return undefined
  const index = candidates.findIndex((candidate) =>
    candidateContainsRequiredAnchorByNormalizedHelper(candidate, requiredAnchorVenueId),
  )
  return index >= 0 ? index + 1 : undefined
}

function buildCandidateSummary(params: {
  candidate: ArcCandidate
  rank: number
  result: GreatStopGateResult
}): GreatStopGateCandidateSummary {
  const stopVenueIdsByRole: Partial<Record<UserStopRole, string>> = {}
  for (const stop of params.candidate.stops) {
    stopVenueIdsByRole[roleFor(stop)] = stop.scoredVenue.venue.id
  }
  return {
    candidateId: params.candidate.id,
    rank: params.rank,
    signature: buildCandidateSignature(params.candidate),
    stopVenueIdsByRole,
    requiredAnchorPreserved: params.result.requiredAnchor?.survived,
    requiredAnchorRoleCorrect: params.result.requiredAnchor
      ? params.result.requiredAnchor.survived &&
        params.result.requiredAnchor.creditedRole === params.result.requiredAnchor.role
      : undefined,
    failedCriteria: [...params.result.failedCriteria],
    reasons: [...params.result.reasons],
  }
}

function buildCandidateIdentityDiagnostic(params: {
  candidate: ArcCandidate
  rank: number
  result: GreatStopGateResult
  skippedForRequiredAnchor: boolean
  requiredAnchorVenueId?: string
}): GreatStopGateCandidateIdentityDiagnostic {
  const requiredAnchorVenueId = params.requiredAnchorVenueId
  const requiredAnchorPreserved = params.result.requiredAnchor?.survived
  const requiredAnchorRoleCorrect = params.result.requiredAnchor
    ? params.result.requiredAnchor.survived &&
      params.result.requiredAnchor.creditedRole === params.result.requiredAnchor.role
    : undefined
  return {
    candidateId: params.candidate.id,
    rank: params.rank,
    signature: buildCandidateSignature(params.candidate),
    skippedReason: params.skippedForRequiredAnchor
      ? 'required_anchor_role_missing'
      : undefined,
    preservesRequiredAnchor: requiredAnchorPreserved,
    requiredRoleCorrect: requiredAnchorRoleCorrect,
    structuralFailureReasons: params.skippedForRequiredAnchor
      ? ['required_anchor_role_missing']
      : [],
    failedCriteria: [...params.result.failedCriteria],
    reasons: [...params.result.reasons],
    stops: params.candidate.stops.map((stop) => {
      const rawVenueId = stop.scoredVenue.venue.id
      const baseVenueId = stop.scoredVenue.candidateIdentity.baseVenueId
      const normalizedHelperVenueId = getArcStopBaseVenueId(stop)
      return {
        role: roleFor(stop),
        name: stop.scoredVenue.venue.name,
        rawVenueId,
        baseVenueId,
        normalizedHelperVenueId,
        candidateId: stop.scoredVenue.candidateIdentity.candidateId,
        provider: stop.scoredVenue.venue.source.provider,
        providerRecordId: stop.scoredVenue.venue.source.providerRecordId,
        sourceOrigin: stop.scoredVenue.venue.source.sourceOrigin,
        matchRequiredAnchorByRawId: requiredAnchorVenueId
          ? rawVenueId === requiredAnchorVenueId
          : undefined,
        matchRequiredAnchorByBaseVenueId: requiredAnchorVenueId
          ? baseVenueId === requiredAnchorVenueId
          : undefined,
        matchRequiredAnchorByNormalizedHelper: requiredAnchorVenueId
          ? normalizedHelperVenueId === requiredAnchorVenueId
          : undefined,
      }
    }),
  }
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)]
}

function roundScore(value: number | undefined): number | undefined {
  return typeof value === 'number' ? round(value) : undefined
}

function buildFailureDetail(params: {
  candidate: ArcCandidate
  rank: number
  result: GreatStopGateResult
}): GreatStopGateCandidateFailureDetail {
  const { candidate, rank, result } = params
  return {
    rank,
    candidateId: candidate.id,
    signature: buildCandidateSignature(candidate),
    routeNames: candidate.stops.map((stop) => stop.scoredVenue.venue.name),
    stopIds: candidate.stops.map((stop) => stop.scoredVenue.venue.id),
    baseVenueIds: candidate.stops.map((stop) => getArcStopBaseVenueId(stop)),
    creditedRoles: candidate.stops.map((stop) => roleFor(stop)),
    requiredAnchorPresent: result.requiredAnchor?.survived,
    requiredAnchorRole: result.requiredAnchor?.role,
    requiredAnchorRoleCorrect: result.requiredAnchor
      ? result.requiredAnchor.survived &&
        result.requiredAnchor.creditedRole === result.requiredAnchor.role
      : undefined,
    failedCriteria: [...result.failedCriteria],
    failureReasons: uniqueStrings(result.reasons),
    totalMovementEstimate: result.diagnostics.movement.totalEstimatedTransitionMinutes,
    maxSingleTransitionEstimate: result.diagnostics.movement.maxSingleTransitionMinutes,
    transitionLimitMinutes: result.diagnostics.movement.transitionLimitMinutes,
    totalLimitMinutes: result.diagnostics.movement.totalLimitMinutes,
    clusterPath: result.routeId
      ? candidate.spatial.clusterAssignments.map((assignment) => assignment.clusterId)
      : [],
    clusterEscapeCount: result.diagnostics.clusterCoherence.clusterEscapeCount,
    backtrackDetected: result.diagnostics.zigzagOrBacktrack.detected,
    driveLikeMovementDetected: result.diagnostics.movement.driveLikeMovement,
    placeRightClauseAttribution: result.diagnostics.placeRightClauseAttribution,
    placeRightSupportWorldDiagnostics: result.diagnostics.placeRightSupportWorldDiagnostics,
    placeRightDiagnosticCounterfactuals: result.diagnostics.placeRightDiagnosticCounterfactuals,
    momentFailureReasons: [...result.criteria.momentRight.reasons],
    roleEnergyNote: candidate.scoreBreakdown.roleEnergyNote,
    scoreSummary: {
      totalScore: round(candidate.totalScore),
      geographyScore: roundScore(candidate.scoreBreakdown.geographyScore),
      roleFlowScore: roundScore(candidate.scoreBreakdown.roleFlowScore),
      diversityScore: roundScore(candidate.scoreBreakdown.diversityScore),
      windDownScore: roundScore(candidate.scoreBreakdown.windDownScore),
      highlightMomentScore: roundScore(candidate.scoreBreakdown.highlightMomentScore),
      momentStrengthScore: roundScore(candidate.scoreBreakdown.momentStrengthScore),
      momentFlatPenalty: roundScore(candidate.scoreBreakdown.momentFlatPenalty),
    },
  }
}

function failureSeverity(entry: {
  result: GreatStopGateResult
}): number {
  const movement = entry.result.diagnostics.movement
  const cluster = entry.result.diagnostics.clusterCoherence
  const movementOverage =
    Math.max(0, movement.totalEstimatedTransitionMinutes - movement.totalLimitMinutes) +
    Math.max(0, movement.maxSingleTransitionMinutes - movement.transitionLimitMinutes)
  const clusterOverage = Math.max(0, cluster.clusterEscapeCount - cluster.maxClusterEscapes)
  const backtrackPenalty = entry.result.diagnostics.zigzagOrBacktrack.detected ? 1 : 0
  return (
    entry.result.failedCriteria.length * 100 +
    uniqueStrings(entry.result.reasons).length * 10 +
    movementOverage +
    clusterOverage * 3 +
    backtrackPenalty
  )
}

function buildCandidateFailureDetails(params: {
  evaluated: Array<{
    candidate: ArcCandidate
    rank: number
    result: GreatStopGateResult
    skippedForRequiredAnchor: boolean
  }>
  passingCandidateCount: number
}): GreatStopCandidateFailureDetails {
  const anchorPreservingEntries = params.evaluated.filter(
    (entry) => !entry.skippedForRequiredAnchor,
  )
  const anchorPreservingFailingEntries = anchorPreservingEntries.filter(
    (entry) => entry.result.status === 'FAIL',
  )
  const sortedByNearestToPass = [...anchorPreservingFailingEntries].sort((left, right) => {
    const severityDelta = failureSeverity(left) - failureSeverity(right)
    return severityDelta !== 0 ? severityDelta : left.rank - right.rank
  })
  const repeatedFailureReasonCounts: Record<string, number> = {}
  for (const entry of anchorPreservingFailingEntries) {
    for (const reason of uniqueStrings(entry.result.reasons)) {
      repeatedFailureReasonCounts[reason] = (repeatedFailureReasonCounts[reason] ?? 0) + 1
    }
  }
  const topFailingEntries = anchorPreservingFailingEntries.slice(
    0,
    GREAT_STOP_FAILURE_DETAIL_LIMIT,
  )

  return {
    evaluatedCandidateCount: params.evaluated.length,
    passingCandidateCount: params.passingCandidateCount,
    detailCandidateLimit: GREAT_STOP_FAILURE_DETAIL_LIMIT,
    nearestToPassCandidate: sortedByNearestToPass[0]
      ? buildFailureDetail(sortedByNearestToPass[0])
      : undefined,
    topFailingCandidates: topFailingEntries.map((entry) => buildFailureDetail(entry)),
    candidatesFailingOnlyOneCriterionCount: anchorPreservingFailingEntries.filter(
      (entry) => entry.result.failedCriteria.length === 1,
    ).length,
    candidatesFailingOnlyMovementCount: anchorPreservingFailingEntries.filter(
      (entry) =>
        entry.result.failedCriteria.length === 1 &&
        entry.result.failedCriteria[0] === 'place_right',
    ).length,
    candidatesFailingOnlyMomentCount: anchorPreservingFailingEntries.filter(
      (entry) =>
        entry.result.failedCriteria.length === 1 &&
        entry.result.failedCriteria[0] === 'moment_right',
    ).length,
    candidatesFailingBothPlaceAndMomentCount: anchorPreservingFailingEntries.filter(
      (entry) =>
        entry.result.failedCriteria.includes('place_right') &&
        entry.result.failedCriteria.includes('moment_right'),
    ).length,
    repeatedFailureReasonCounts,
    requiredAnchorPreservedCount: anchorPreservingEntries.length,
    compactnessCandidateCount: anchorPreservingEntries.filter(
      (entry) => entry.result.criteria.placeRight.passed,
    ).length,
    backtrackPatternCount: anchorPreservingEntries.filter(
      (entry) => entry.result.diagnostics.zigzagOrBacktrack.detected,
    ).length,
  }
}

export function selectGreatStopGatePassingCandidate(params: {
  candidates: ArcCandidate[]
  intent: IntentProfile
  locationClass?: BuildLocationClass
  locationClassSource?: GreatStopGatePresetSource
  placeRightTolerance?: RouteShapePlaceRightMovementProfile
  placeRightVerdictForCandidate?: (candidate: ArcCandidate) => BearingsPlaceRightVerdict
  fieldRealVerdictForCandidate?: (candidate: ArcCandidate) => FieldRealVerdict
  stage: GreatStopGateSelectionStage
  rolePoolIdentityDiagnostics?: GreatStopGateRolePoolIdentityDiagnostics
  compactnessRankingDiagnostics?: GreatStopCompactnessRankingDiagnostics
}): {
  selectedCandidate?: ArcCandidate
  diagnostics: GreatStopGateSelectionDiagnostics
} {
  const evaluated: Array<{
    candidate: ArcCandidate
    rank: number
    result: GreatStopGateResult
    skippedForRequiredAnchor: boolean
  }> = []
  let passingCandidateCount = 0
  const requiredAnchorVenueId = params.intent.anchor?.venueId

  const buildSelectionDiagnostics = (selectionParams: {
    status: GreatStopGateStatus
    selectedCandidate?: ArcCandidate
    selectedCandidateRank?: number
    selectedGateResult?: GreatStopGateResult
  }): GreatStopGateSelectionDiagnostics => {
    const anchorPreservingEntries = evaluated.filter((entry) => !entry.skippedForRequiredAnchor)
    const anchorPreservingFailingEntries = anchorPreservingEntries.filter(
      (entry) => entry.result.status === 'FAIL',
    )
    const skippedMissingRequiredAnchorCount = evaluated.filter(
      (entry) => entry.skippedForRequiredAnchor,
    ).length
    const structuralFailureReasons =
      skippedMissingRequiredAnchorCount > 0 ? ['required_anchor_role_missing'] : []
    const bestAnchorPreservingFailingEntry = anchorPreservingFailingEntries[0]
    const bestFailingEntry = bestAnchorPreservingFailingEntry
    const failedTopCandidateCriteria = bestAnchorPreservingFailingEntry?.result.failedCriteria ?? []
    const failureReasons =
      evaluated.length === 0
        ? ['no_ranked_candidates_available']
        : [
            ...structuralFailureReasons,
            ...anchorPreservingFailingEntries.flatMap((entry) => entry.result.reasons),
          ]
    const fullEvaluatedCandidateCount = evaluated.length
    const evaluatedCandidateIdentitySummaries = evaluated
      .slice(0, DIAGNOSTIC_CANDIDATE_SUMMARY_LIMIT)
      .map((entry) =>
        buildCandidateIdentityDiagnostic({
          candidate: entry.candidate,
          rank: entry.rank,
          result: entry.result,
          skippedForRequiredAnchor: entry.skippedForRequiredAnchor,
          requiredAnchorVenueId,
        }),
      )
    const omittedCandidateCount = Math.max(
      0,
      fullEvaluatedCandidateCount - evaluatedCandidateIdentitySummaries.length,
    )
    const greatStopCandidateFailureDetails =
      selectionParams.status === 'FAIL'
        ? buildCandidateFailureDetails({
            evaluated,
            passingCandidateCount,
          })
        : undefined

    return {
      status: selectionParams.status,
      stage: params.stage,
      selectedCandidateId: selectionParams.selectedCandidate?.id,
      selectedCandidateRank: selectionParams.selectedCandidateRank,
      rankedCandidateCount: params.candidates.length,
      evaluatedCandidateCount: evaluated.length,
      fullEvaluatedCandidateCount,
      diagnosticCandidateSummaryLimit: DIAGNOSTIC_CANDIDATE_SUMMARY_LIMIT,
      omittedCandidateCount,
      skippedMissingRequiredAnchorCount,
      anchorPreservingCandidateCount: anchorPreservingEntries.length,
      evaluatedAnchorPreservingCandidateCount: anchorPreservingEntries.length,
      firstRankWhereRequiredAnchorAppears: firstRankWhereRequiredAnchorAppears(
        params.candidates,
        requiredAnchorVenueId,
      ),
      candidatesWithRequiredAnchorByRawId: params.candidates.filter((candidate) =>
        candidateContainsRequiredAnchorByRawId(candidate, requiredAnchorVenueId),
      ).length,
      candidatesWithRequiredAnchorByBaseVenueId: params.candidates.filter((candidate) =>
        candidateContainsRequiredAnchorByBaseVenueId(candidate, requiredAnchorVenueId),
      ).length,
      candidatesWithRequiredAnchorByNormalizedHelper: params.candidates.filter((candidate) =>
        candidateContainsRequiredAnchorByNormalizedHelper(candidate, requiredAnchorVenueId),
      ).length,
      evaluatedCandidateIdentitySummaries,
      rolePoolIdentityDiagnostics: params.rolePoolIdentityDiagnostics,
      failedTopCandidateCriteria,
      failureReasons,
      bestFailingCandidateSummary: bestFailingEntry
        ? buildCandidateSummary({
            candidate: bestFailingEntry.candidate,
            rank: bestFailingEntry.rank,
            result: bestFailingEntry.result,
          })
        : undefined,
      bestAnchorPreservingFailingCandidate: bestAnchorPreservingFailingEntry
        ? buildCandidateSummary({
            candidate: bestAnchorPreservingFailingEntry.candidate,
            rank: bestAnchorPreservingFailingEntry.rank,
            result: bestAnchorPreservingFailingEntry.result,
          })
        : undefined,
      greatStopCandidateFailureDetails,
      compactnessRankingDiagnostics: params.compactnessRankingDiagnostics,
      structuralFailureReasons,
      passingCandidateCount,
      selectedGateResult: selectionParams.selectedGateResult,
    }
  }

  for (let index = 0; index < params.candidates.length; index += 1) {
    const candidate = params.candidates[index]!
    const result = buildGreatStopGateResult({
      selectedArc: candidate,
      intent: params.intent,
      routePacing: buildGreatStopRoutePacingDiagnostics(candidate),
      placeRightVerdict: params.placeRightVerdictForCandidate?.(candidate),
      fieldRealVerdict: params.fieldRealVerdictForCandidate?.(candidate),
      locationClass: params.locationClass,
      locationClassSource: params.locationClassSource,
      placeRightTolerance: params.placeRightTolerance,
    })
    const skippedForRequiredAnchor =
      result.requiredAnchor != null &&
      (!result.requiredAnchor.survived ||
        result.requiredAnchor.creditedRole !== result.requiredAnchor.role)
    evaluated.push({
      candidate,
      rank: index + 1,
      result,
      skippedForRequiredAnchor,
    })
    if (!skippedForRequiredAnchor && result.status === 'PASS') {
      passingCandidateCount += 1
      return {
        selectedCandidate: candidate,
        diagnostics: buildSelectionDiagnostics({
          status: 'PASS',
          selectedCandidateRank: index + 1,
          selectedCandidate: candidate,
          selectedGateResult: result,
        }),
      }
    }
  }

  return {
    diagnostics: buildSelectionDiagnostics({
      status: 'FAIL',
      selectedGateResult: evaluated[0]?.result,
    }),
  }
}

export const buildGreatStopGatePlaceRightPresets = PLACE_RIGHT_PRESETS
