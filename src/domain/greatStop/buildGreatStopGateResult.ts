import type { ArcCandidate, ArcStop } from '../types/arc'
import type { RoutePacingDiagnostics, TransitionExplainabilityDiagnostics } from '../types/diagnostics'
import type {
  BuildLocationClass,
  GreatStopCandidateFailureDetails,
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
import type { DistanceMode, IntentProfile, PersonaMode } from '../types/intent'
import type { UserStopRole } from '../types/itinerary'
import type { SpatialCoherenceAnalysis } from '../types/spatial'
import { roleProjection } from '../config/roleProjection'
import { getArcStopBaseVenueId } from '../candidates/candidateIdentity'

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

function stopIdentityUsable(stop: ArcStop): boolean {
  const venue = stop.scoredVenue.venue
  return Boolean(venue.id.trim() && venue.name.trim() && venue.isActive !== false)
}

function evaluateReal(candidate: ArcCandidate): GreatStopCriterionResult {
  const unusableStops = candidate.stops.filter((stop) => !stopIdentityUsable(stop))
  return criterion(
    unusableStops.length === 0,
    unusableStops.map((stop) => `real:unusable_stop:${roleFor(stop)}`),
  )
}

function evaluateRoleRight(candidate: ArcCandidate): GreatStopCriterionResult {
  const reasons: string[] = []
  for (const stop of candidate.stops) {
    const role = roleFor(stop)
    const roleScore = stop.scoredVenue.roleScores[stop.role]
    const shapeScore =
      role === 'start'
        ? stop.scoredVenue.stopShapeFit.start
        : role === 'highlight'
          ? stop.scoredVenue.stopShapeFit.highlight
          : role === 'windDown'
            ? stop.scoredVenue.stopShapeFit.windDown
            : stop.scoredVenue.stopShapeFit.surprise
    if (roleScore < 0.5) reasons.push(`role_right:low_role_fit:${role}`)
    if (shapeScore < 0.34) reasons.push(`role_right:low_shape_fit:${role}`)
  }
  return criterion(reasons.length === 0, reasons)
}

function evaluateIntentRight(candidate: ArcCandidate): GreatStopCriterionResult {
  const reasons: string[] = []
  for (const stop of candidate.stops) {
    const role = roleFor(stop)
    if (stop.scoredVenue.fitScore < 0.42) reasons.push(`intent_right:low_fit:${role}`)
    if (stop.scoredVenue.lensCompatibility < 0.38) {
      reasons.push(`intent_right:low_lens_compatibility:${role}`)
    }
    if (stop.scoredVenue.contextSpecificity.overall < 0.3) {
      reasons.push(`intent_right:low_context_specificity:${role}`)
    }
  }
  return criterion(reasons.length === 0, reasons)
}

function totalTransitionMinutes(routePacing: RoutePacingDiagnostics): number {
  return routePacing.transitions.reduce(
    (sum, transition) => sum + transition.estimatedTransitionMinutes,
    0,
  )
}

function maxSingleTransitionMinutes(routePacing: RoutePacingDiagnostics): number {
  return routePacing.transitions.reduce(
    (max, transition) => Math.max(max, transition.estimatedTransitionMinutes),
    0,
  )
}

function detectZigzagOrBacktrack(spatial: SpatialCoherenceAnalysis): {
  detected: boolean
  reason?: string
} {
  if (spatial.repeatedClusterEscapeCount > 0) {
    return { detected: true, reason: 'place_right:repeated_cluster_escape' }
  }
  const clusters = spatial.clusterAssignments.map((assignment) => assignment.clusterId)
  for (let index = 2; index < clusters.length; index += 1) {
    if (clusters[index] === clusters[index - 2] && clusters[index] !== clusters[index - 1]) {
      return { detected: true, reason: 'place_right:backtrack_cluster_pattern' }
    }
  }
  return { detected: false }
}

function evaluatePlaceRight(params: {
  persona: PersonaMode
  locationClass: BuildLocationClass
  spatial: SpatialCoherenceAnalysis
  routePacing: RoutePacingDiagnostics
}): {
  result: GreatStopCriterionResult
  diagnostics: Pick<
    GreatStopGateResult['diagnostics'],
    'movement' | 'clusterCoherence' | 'zigzagOrBacktrack'
  >
  preset: PlaceRightPreset
} {
  const preset = PLACE_RIGHT_PRESETS[params.persona][params.locationClass]
  const totalEstimatedTransitionMinutes = totalTransitionMinutes(params.routePacing)
  const maxTransition = maxSingleTransitionMinutes(params.routePacing)
  const driveLikeMovement =
    params.spatial.longTransitionCount > 0 ||
    params.routePacing.transitions.some((transition) => transition.movementMode !== 'walkable')
  const zigzagOrBacktrack = detectZigzagOrBacktrack(params.spatial)
  const reasons: string[] = []

  if (totalEstimatedTransitionMinutes > preset.maxComfortableTotalMovementMinutes) {
    reasons.push('place_right:total_movement_over_preset')
  }
  if (maxTransition > preset.maxSingleTransitionMinutes) {
    reasons.push('place_right:single_transition_over_preset')
  }
  if (params.spatial.clusterEscapeCount > preset.maxClusterEscapes) {
    reasons.push('place_right:cluster_escapes_over_preset')
  }
  if (zigzagOrBacktrack.detected && zigzagOrBacktrack.reason) {
    reasons.push(zigzagOrBacktrack.reason)
  }
  if (driveLikeMovement && preset.driveLikeMovement === 'discouraged') {
    reasons.push('place_right:drive_like_movement_discouraged')
  }
  if (
    driveLikeMovement &&
    preset.driveLikeMovement === 'limited' &&
    (params.spatial.longTransitionCount > 1 || maxTransition > preset.maxSingleTransitionMinutes)
  ) {
    reasons.push('place_right:drive_like_movement_over_limited_preset')
  }

  return {
    result: criterion(reasons.length === 0, reasons),
    preset,
    diagnostics: {
      movement: {
        totalEstimatedTransitionMinutes,
        maxSingleTransitionMinutes: maxTransition,
        transitionCount: params.routePacing.transitions.length,
        driveLikeMovement,
        transitionLimitMinutes: preset.maxSingleTransitionMinutes,
        totalLimitMinutes: preset.maxComfortableTotalMovementMinutes,
      },
      clusterCoherence: {
        clusterEscapeCount: params.spatial.clusterEscapeCount,
        repeatedClusterEscapeCount: params.spatial.repeatedClusterEscapeCount,
        longTransitionCount: params.spatial.longTransitionCount,
        maxClusterEscapes: preset.maxClusterEscapes,
        spatialScore: params.spatial.score,
        notes: [...params.spatial.notes],
      },
      zigzagOrBacktrack,
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
  const strongMoment = {
    present: candidate.scoreBreakdown.strongMomentPresent === true,
    note: candidate.scoreBreakdown.momentQualityNote,
    highlightMomentScore: candidate.scoreBreakdown.highlightMomentScore,
    momentStrengthScore: candidate.scoreBreakdown.momentStrengthScore,
    momentFlatPenalty: candidate.scoreBreakdown.momentFlatPenalty,
  }
  const reasons: string[] = []
  if (!arcProgression.startPresent || !arcProgression.highlightPresent || !arcProgression.windDownPresent) {
    reasons.push('moment_right:missing_three_beat_progression')
  }
  if (arcProgression.peakRoleAdvantage < -0.05) {
    reasons.push('moment_right:highlight_not_main_moment')
  }
  if (!arcProgression.energyProgressionValid) {
    reasons.push('moment_right:energy_progression_invalid')
  }
  if (laneVariance.supportLaneVariance <= 1 && laneVariance.laneRepetitionCount > 0) {
    reasons.push('moment_right:low_support_contrast')
  }
  if (candidate.scoreBreakdown.roleEnergyNote?.toLowerCase().includes('flat')) {
    reasons.push('moment_right:dead_flat_arc')
  }
  if (candidate.scoreBreakdown.strongMomentPresent === false) {
    reasons.push('moment_right:no_strong_main_moment')
  }
  if ((candidate.scoreBreakdown.momentFlatPenalty ?? 0) >= 0.06) {
    reasons.push('moment_right:moment_flat_penalty')
  }
  if (candidate.spatial.longTransitionCount > 0 && !strongMoment.present) {
    reasons.push('moment_right:movement_without_moment_payoff')
  }
  return {
    result: criterion(reasons.length === 0, reasons),
    diagnostics: {
      arcProgression,
      laneVariance,
      strongMoment,
    },
  }
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
  locationClass?: BuildLocationClass
  locationClassSource?: GreatStopGatePresetSource
}): GreatStopGateResult {
  const { selectedArc, intent } = params
  const persona = intent.persona ?? 'friends'
  const locationClass = params.locationClass ?? inferBuildLocationClass(intent.distanceMode)
  const locationClassSource: GreatStopGatePresetSource = params.locationClass
    ? params.locationClassSource ?? 'explicit'
    : 'inferred_from_distance_mode'
  const placeRight = evaluatePlaceRight({
    persona,
    locationClass,
    spatial: selectedArc.spatial,
    routePacing: params.routePacing,
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
  const real = evaluateReal(selectedArc)
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
  stage: GreatStopGateSelectionStage
  rolePoolIdentityDiagnostics?: GreatStopGateRolePoolIdentityDiagnostics
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
      locationClass: params.locationClass,
      locationClassSource: params.locationClassSource,
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
