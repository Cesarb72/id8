import type { ArcCandidate, ArcStop } from '../types/arc'
import type { RoutePacingDiagnostics } from '../types/diagnostics'
import type {
  BuildLocationClass,
  GreatStopCriterionResult,
  GreatStopGateResult,
  GreatStopGatePresetSource,
  GreatStopTravelTolerance,
} from '../types/greatStopGate'
import type { DistanceMode, IntentProfile, PersonaMode } from '../types/intent'
import type { UserStopRole } from '../types/itinerary'
import type { SpatialCoherenceAnalysis } from '../types/spatial'
import { roleProjection } from '../config/roleProjection'

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
  const stop = params.candidate.stops.find((entry) => entry.scoredVenue.venue.id === params.venueId)
  return stop ? roleFor(stop) : undefined
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
  const requiredAnchorInternalRole = internalRoleFor(requiredAnchorRole)
  const creditedRole = creditedAnchorRole({
    candidate: selectedArc,
    venueId: intent.anchor?.venueId,
  })
  const requiredAnchor =
    intent.anchor?.venueId && requiredAnchorRole
      ? {
          venueId: intent.anchor.venueId,
          role: requiredAnchorRole,
          survived: Boolean(
            creditedRole &&
              (!requiredAnchorInternalRole ||
                selectedArc.stops.some(
                  (stop) =>
                    stop.role === requiredAnchorInternalRole &&
                    stop.scoredVenue.venue.id === intent.anchor?.venueId,
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

export const buildGreatStopGatePlaceRightPresets = PLACE_RIGHT_PRESETS
