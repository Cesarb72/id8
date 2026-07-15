import {
  getStretchDistanceStatus,
  isOutsideStrictNearbyButWithinBoundedStretch,
  isWithinStrictNearbyWindow,
} from '../constraints/localStretchPolicy'
import type { ArcStop, ScoredVenue } from '../types/arc'
import type { IntentProfile } from '../types/intent'
import type { SpatialCoherenceAnalysis } from '../types/spatial'
import { computeRoleAwareHoursPressure } from '../retrieval/computeRoleAwareHoursPressure'
import type {
  WhenSignalProfile,
  WhenSpatialScoringMode,
} from '../when/whenSignalProfile'
import {
  projectOriginMovementPosture,
  type OriginMovementPostureProjection,
} from './projectOriginMovementPosture'

export interface ArcWhenSpatialScorePressure {
  mode: WhenSpatialScoringMode
  movementPreference?: WhenSignalProfile['movementPreference']
  originMovementStrictness?: OriginMovementPostureProjection['strictness']
  originMovementRadiusPosture?: OriginMovementPostureProjection['movementRadiusPosture']
  originAllowsTightWalkableClaims?: boolean
  scoreDelta: number
  positiveSignal: number
  negativeSignal: number
  reason: string
}

export interface ArcLocalStretchPolicy {
  localSupplySufficient: boolean
  strictNearbyFailed: boolean
  stretchApplied: boolean
  reason: string
  candidateSetBasis: string
  strictNearbyMeaningfulCount: number
  boundedStretchMeaningfulCount: number
  localSupplyDerivedFrom: string
  strictNearbyFailedDerivedFrom: string
  stretchedCandidateName?: string
  stretchedCandidateDistanceStatus?: string
  score: number
  penalty: number
}

export interface ComputeArcLocalStretchPolicyInput {
  stops: ArcStop[]
  intent: IntentProfile
  rolePoolCandidates?: ScoredVenue[]
  hasPeakConstraintConflict: (candidate: ScoredVenue) => boolean
  hasPeakAnchorConflict: (candidate: ScoredVenue, intent: IntentProfile) => boolean
  isMeaningfulStretchCandidate: (candidate: ScoredVenue, intent: IntentProfile) => boolean
  scoreMeaningfulMomentStretchCandidate: (candidate: ScoredVenue) => number
}

export interface PeakCandidateFeasibilityVerdict {
  feasible: boolean
  distanceFeasible: boolean
  routeTimeFeasible: boolean
  hoursFeasible: boolean
  anchorFeasible: boolean
  constraintsFeasible: boolean
  originMovementPosture?: OriginMovementPostureProjection
  originAdjustedDistanceLimitMinutes?: number
  reasons: string[]
  provenance: {
    source: 'bearings'
    version: string
  }
}

export interface EvaluatePeakCandidateFeasibilityInput {
  candidate: ScoredVenue
  intent?: IntentProfile
  anchoredPeakBaseVenueId?: string
  allowMeaningfulStretch?: boolean
  isMeaningfulStretchCandidate?: (candidate: ScoredVenue, intent: IntentProfile) => boolean
  minimumProximityFitWithoutIntent?: number
  evaluateHoursPressure?: boolean
  evaluateRouteTime?: boolean
  requireHighlightValidity?: boolean
  requireHighlightVetoClear?: boolean
  requirePeakContract?: boolean
}

const BEARINGS_PEAK_CANDIDATE_FEASIBILITY_VERSION = 'crux-step-3'

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function roundToThousandths(value: number): number {
  return Number(value.toFixed(3))
}

const emptyWhenSpatialScorePressure: ArcWhenSpatialScorePressure = {
  mode: 'off',
  scoreDelta: 0,
  positiveSignal: 0,
  negativeSignal: 0,
  reason: 'when spatial scoring off',
}

function getArcStopCandidateId(stop: ArcStop): string {
  return stop.scoredVenue.candidateIdentity.candidateId
}

function hasIntentOriginMarker(intent: IntentProfile): boolean {
  return Boolean(intent.originPrecision || intent.originSource)
}

export function resolveIntentOriginMovementPosture(
  intent: IntentProfile,
): OriginMovementPostureProjection | undefined {
  if (!hasIntentOriginMarker(intent)) {
    return undefined
  }
  return projectOriginMovementPosture({
    originPrecision: intent.originPrecision,
    originSource: intent.originSource,
  })
}

function getOriginAdjustedDistanceLimitMinutes(
  originMovementPosture: OriginMovementPostureProjection | undefined,
): number | undefined {
  if (!originMovementPosture || originMovementPosture.allowsTightWalkableClaims) {
    return undefined
  }
  if (!originMovementPosture.valid) {
    return 0
  }
  if (originMovementPosture.movementRadiusPosture === 'medium') {
    return 18
  }
  if (originMovementPosture.movementRadiusPosture === 'soft') {
    return 28
  }
  if (originMovementPosture.movementRadiusPosture === 'softest') {
    return 28
  }
  return undefined
}

function isOriginAdjustedDistanceFeasible(
  candidate: ScoredVenue,
  originMovementPosture: OriginMovementPostureProjection,
): boolean {
  const adjustedLimit = getOriginAdjustedDistanceLimitMinutes(originMovementPosture)
  if (adjustedLimit === 0) {
    return false
  }
  if (adjustedLimit !== undefined && candidate.venue.driveMinutes <= adjustedLimit) {
    return true
  }
  if (originMovementPosture.movementRadiusPosture === 'softest') {
    return candidate.fitBreakdown.proximityFit >= 0.32
  }
  if (originMovementPosture.movementRadiusPosture === 'soft') {
    return candidate.fitBreakdown.proximityFit >= 0.42
  }
  if (originMovementPosture.movementRadiusPosture === 'medium') {
    return candidate.fitBreakdown.proximityFit >= 0.48
  }
  return false
}

export function isPeakRouteTimeFeasible(candidate: ScoredVenue): boolean {
  const source = candidate.venue.source
  if (
    source.businessStatus === 'temporarily-closed' ||
    source.businessStatus === 'closed-permanently'
  ) {
    return false
  }
  if (
    source.sourceOrigin === 'live' &&
    source.timeConfidence >= 0.68 &&
    source.likelyOpenForCurrentWindow === false
  ) {
    return false
  }
  return true
}

export function isPeakDistanceFeasible(
  candidate: ScoredVenue,
  intent: IntentProfile,
  options: {
    allowMeaningfulStretch?: boolean
    isMeaningfulStretchCandidate?: (candidate: ScoredVenue, intent: IntentProfile) => boolean
  } = {},
): boolean {
  if (intent.distanceMode !== 'nearby') {
    return candidate.fitBreakdown.proximityFit >= 0.48
  }

  const originMovementPosture = resolveIntentOriginMovementPosture(intent)
  if (originMovementPosture && !originMovementPosture.allowsTightWalkableClaims) {
    return isOriginAdjustedDistanceFeasible(candidate, originMovementPosture)
  }

  if (isWithinStrictNearbyWindow(candidate.venue.driveMinutes, intent.distanceMode)) {
    return true
  }
  if (
    isOutsideStrictNearbyButWithinBoundedStretch(
      candidate.venue.driveMinutes,
      intent.distanceMode,
    ) &&
    options.allowMeaningfulStretch &&
    options.isMeaningfulStretchCandidate
  ) {
    return options.isMeaningfulStretchCandidate(candidate, intent)
  }
  return false
}

function isPeakHoursFeasible(candidate: ScoredVenue): boolean {
  const source = candidate.venue.source
  if (
    source.businessStatus === 'temporarily-closed' ||
    source.businessStatus === 'closed-permanently'
  ) {
    return false
  }
  if (source.sourceOrigin !== 'live') {
    return true
  }

  const roleHours = computeRoleAwareHoursPressure(candidate.venue, 'peak')
  if (!source.likelyOpenForCurrentWindow && source.timeConfidence >= 0.68) {
    return false
  }
  return roleHours.penalty < 0.18
}

export function evaluatePeakCandidateFeasibility(
  input: EvaluatePeakCandidateFeasibilityInput,
): PeakCandidateFeasibilityVerdict {
  const {
    candidate,
    intent,
    anchoredPeakBaseVenueId,
    allowMeaningfulStretch = true,
    isMeaningfulStretchCandidate,
    minimumProximityFitWithoutIntent = 0.48,
    evaluateHoursPressure = false,
    evaluateRouteTime = true,
    requireHighlightValidity = true,
    requireHighlightVetoClear = true,
    requirePeakContract = true,
  } = input

  const distanceFeasible = intent
    ? isPeakDistanceFeasible(candidate, intent, {
        allowMeaningfulStretch,
        isMeaningfulStretchCandidate,
      })
    : candidate.fitBreakdown.proximityFit >= minimumProximityFitWithoutIntent
  const routeTimeFeasible = evaluateRouteTime ? isPeakRouteTimeFeasible(candidate) : true
  const hoursFeasible = evaluateHoursPressure ? isPeakHoursFeasible(candidate) : true
  const anchorFeasible =
    !anchoredPeakBaseVenueId ||
    anchoredPeakBaseVenueId === candidate.candidateIdentity.baseVenueId
  const peakContractConflict =
    candidate.roleContract.peak.strength === 'hard' && !candidate.roleContract.peak.satisfied
  const highlightValidityFeasible =
    !requireHighlightValidity || candidate.highlightValidity.validityLevel !== 'invalid'
  const highlightVetoFeasible =
    !requireHighlightVetoClear ||
    (candidate.highlightValidity.personaVetoes.length === 0 &&
      candidate.highlightValidity.contextVetoes.length === 0 &&
      candidate.highlightValidity.violations.length === 0)
  const contractFeasible = !requirePeakContract || !peakContractConflict
  const constraintsFeasible =
    highlightValidityFeasible && highlightVetoFeasible && contractFeasible
  const reasons = [
    ...(distanceFeasible ? [] : ['peak_feasibility:distance']),
    ...(routeTimeFeasible ? [] : ['peak_feasibility:route_time']),
    ...(hoursFeasible ? [] : ['peak_feasibility:hours']),
    ...(anchorFeasible ? [] : ['peak_feasibility:anchor_conflict']),
    ...(highlightValidityFeasible ? [] : ['peak_feasibility:invalid_highlight']),
    ...(highlightVetoFeasible ? [] : ['peak_feasibility:highlight_veto']),
    ...(contractFeasible ? [] : ['peak_feasibility:hard_contract_conflict']),
  ]

  return {
    feasible:
      distanceFeasible &&
      routeTimeFeasible &&
      hoursFeasible &&
      anchorFeasible &&
      constraintsFeasible,
    distanceFeasible,
    routeTimeFeasible,
    hoursFeasible,
    anchorFeasible,
    constraintsFeasible,
    originMovementPosture: intent
      ? resolveIntentOriginMovementPosture(intent)
      : undefined,
    originAdjustedDistanceLimitMinutes: intent
      ? getOriginAdjustedDistanceLimitMinutes(resolveIntentOriginMovementPosture(intent))
      : undefined,
    reasons,
    provenance: {
      source: 'bearings',
      version: BEARINGS_PEAK_CANDIDATE_FEASIBILITY_VERSION,
    },
  }
}

export function computeArcWhenSpatialScorePressure(params: {
  intent: IntentProfile
  spatial: SpatialCoherenceAnalysis
  options?: {
    whenSpatialScoring?: WhenSpatialScoringMode
    whenSignalProfile?: WhenSignalProfile
  }
}): ArcWhenSpatialScorePressure {
  const mode = params.options?.whenSpatialScoring ?? 'off'
  const whenSignalProfile = params.options?.whenSignalProfile
  if (mode !== 'soft_curate_spatial' || params.intent.mode !== 'curate' || !whenSignalProfile) {
    return emptyWhenSpatialScorePressure
  }

  const { spatial } = params
  const originMovementPosture = resolveIntentOriginMovementPosture(params.intent)
  const transitionCount = Math.max(1, spatial.transitions.length)
  const sameClusterRate = spatial.sameClusterTransitionCount / transitionCount
  const clusterEscapeRate = spatial.clusterEscapeCount / transitionCount
  const longTransitionRate = spatial.longTransitionCount / transitionCount
  const movementPreference = whenSignalProfile.movementPreference
  const effectiveMovementPreference =
    movementPreference === 'walkable' &&
    originMovementPosture &&
    !originMovementPosture.allowsTightWalkableClaims
      ? 'flexible'
      : movementPreference
  const originReason =
    originMovementPosture && !originMovementPosture.allowsTightWalkableClaims
      ? `; origin ${originMovementPosture.strictness}/${originMovementPosture.movementRadiusPosture} blocks tight walkable claims`
      : ''
  const originFields = originMovementPosture
    ? {
        originMovementStrictness: originMovementPosture.strictness,
        originMovementRadiusPosture: originMovementPosture.movementRadiusPosture,
        originAllowsTightWalkableClaims:
          originMovementPosture.allowsTightWalkableClaims,
      }
    : {}

  if (effectiveMovementPreference === 'walkable') {
    const positiveSignal = clamp01(
      sameClusterRate * 0.46 +
        (spatial.clustersVisited.length <= 1 ? 0.36 : 0) +
        (spatial.clusterEscapeCount === 0 ? 0.18 : 0),
    )
    const negativeSignal = clamp01(
      longTransitionRate * 0.48 +
        spatial.repeatedClusterEscapeCount * 0.22 +
        Math.max(0, spatial.clusterEscapeCount - 1) * 0.16,
    )
    return {
      mode,
      movementPreference,
      ...originFields,
      scoreDelta: clamp((positiveSignal - negativeSignal) * 0.03, -0.03, 0.03),
      positiveSignal: roundToThousandths(positiveSignal),
      negativeSignal: roundToThousandths(negativeSignal),
      reason:
        positiveSignal >= negativeSignal
          ? `walkable preference favored tighter same-cluster route${originReason}`
          : `walkable preference penalized long or repeated cluster movement${originReason}`,
    }
  }

  const positiveSignal = clamp01(
    (spatial.clusterEscapeCount > 0 ? 0.32 : 0) +
      (spatial.clustersVisited.length > 1 ? 0.26 : 0) +
      (spatial.jumpUsed ? 0.12 : 0) +
      (spatial.clusterEscapeCount > 0 && spatial.longTransitionCount <= 1 ? 0.18 : 0),
  )
  const negativeSignal = clamp01(
    Math.max(0, spatial.longTransitionCount - 1) * 0.3 +
      Math.max(0, spatial.repeatedClusterEscapeCount - 1) * 0.22 +
      (spatial.clusterEscapeCount === 0 ? 0.08 : 0) +
      Math.max(0, clusterEscapeRate - 0.7) * 0.14,
  )
  return {
    mode,
    movementPreference,
    ...originFields,
    scoreDelta: clamp((positiveSignal - negativeSignal) * 0.03, -0.03, 0.03),
    positiveSignal: roundToThousandths(positiveSignal),
    negativeSignal: roundToThousandths(negativeSignal),
    reason:
      positiveSignal >= negativeSignal
        ? `flexible preference favored justified cross-cluster breadth${originReason}`
        : `flexible preference penalized excessive or repeated long movement${originReason}`,
  }
}

export function computeArcLocalStretchPolicy(
  input: ComputeArcLocalStretchPolicyInput,
): ArcLocalStretchPolicy {
  const {
    stops,
    intent,
    hasPeakAnchorConflict,
    hasPeakConstraintConflict,
    isMeaningfulStretchCandidate,
    scoreMeaningfulMomentStretchCandidate,
  } = input

  if (intent.distanceMode !== 'nearby') {
    return {
      localSupplySufficient: true,
      strictNearbyFailed: false,
      stretchApplied: false,
      reason: 'not needed',
      candidateSetBasis: 'not applicable outside nearby mode',
      strictNearbyMeaningfulCount: 0,
      boundedStretchMeaningfulCount: 0,
      localSupplyDerivedFrom: 'nearby mode inactive',
      strictNearbyFailedDerivedFrom: 'nearby mode inactive',
      score: 0,
      penalty: 0,
    }
  }

  const pooledCandidates = input.rolePoolCandidates ?? []
  const uniqueCandidates =
    pooledCandidates.length > 0
      ? pooledCandidates
      : [
          ...new Map(
            stops.map((stop) => [getArcStopCandidateId(stop), stop.scoredVenue] as const),
          ).values(),
        ]
  const feasibleMeaningfulCandidates = uniqueCandidates.filter(
    (candidate) =>
      isPeakRouteTimeFeasible(candidate) &&
      !hasPeakConstraintConflict(candidate) &&
      !hasPeakAnchorConflict(candidate, intent) &&
      isPeakDistanceFeasible(candidate, intent, {
        allowMeaningfulStretch: true,
        isMeaningfulStretchCandidate,
      }) &&
      candidate.roleScores.peak >= 0.64 &&
      candidate.stopShapeFit.highlight >= 0.4 &&
      (candidate.momentIdentity.strength === 'strong' ||
        isMeaningfulStretchCandidate(candidate, intent)),
  )
  const originMovementPosture = resolveIntentOriginMovementPosture(intent)
  const originSoftened = Boolean(
    originMovementPosture && !originMovementPosture.allowsTightWalkableClaims,
  )
  const localMeaningfulCandidates = feasibleMeaningfulCandidates.filter((candidate) =>
    originSoftened
      ? isPeakDistanceFeasible(candidate, intent, {
          allowMeaningfulStretch: true,
          isMeaningfulStretchCandidate,
        })
      : isWithinStrictNearbyWindow(candidate.venue.driveMinutes, intent.distanceMode),
  )
  const boundedMeaningfulCandidates = originSoftened
    ? []
    : feasibleMeaningfulCandidates.filter((candidate) =>
        isOutsideStrictNearbyButWithinBoundedStretch(
          candidate.venue.driveMinutes,
          intent.distanceMode,
        ) && isMeaningfulStretchCandidate(candidate, intent),
      )
  const bestLocalMeaningful = [...localMeaningfulCandidates].sort((left, right) => {
    return (
      scoreMeaningfulMomentStretchCandidate(right) -
        scoreMeaningfulMomentStretchCandidate(left) ||
      right.fitScore - left.fitScore
    )
  })[0]
  const bestBoundedMeaningful = [...boundedMeaningfulCandidates].sort((left, right) => {
    return (
      scoreMeaningfulMomentStretchCandidate(right) -
        scoreMeaningfulMomentStretchCandidate(left) ||
      right.fitScore - left.fitScore
    )
  })[0]
  const localSupplySufficient = Boolean(bestLocalMeaningful)
  const strictNearbyFailed = !localSupplySufficient && Boolean(bestBoundedMeaningful)
  const stretchedStop = stops.find(
    (stop) =>
      isOutsideStrictNearbyButWithinBoundedStretch(
        stop.scoredVenue.venue.driveMinutes,
        intent.distanceMode,
      ) && isMeaningfulStretchCandidate(stop.scoredVenue, intent),
  )
  const stretchApplied = strictNearbyFailed && Boolean(stretchedStop)

  return {
    localSupplySufficient,
    strictNearbyFailed,
    stretchApplied,
    reason: stretchApplied
      ? 'stronger bounded candidate used'
      : strictNearbyFailed
        ? 'no local strong moment'
        : 'not needed',
    candidateSetBasis: 'arc scorer unique role-pool candidates after peak feasibility gate',
    strictNearbyMeaningfulCount: localMeaningfulCandidates.length,
    boundedStretchMeaningfulCount: boundedMeaningfulCandidates.length,
    localSupplyDerivedFrom: localSupplySufficient
      ? `${originSoftened ? 'origin-adjusted' : 'strict nearby'} meaningful count = ${localMeaningfulCandidates.length}`
      : `${originSoftened ? 'origin-adjusted' : 'strict nearby'} meaningful count = 0`,
    strictNearbyFailedDerivedFrom: strictNearbyFailed
      ? `${originSoftened ? 'origin-adjusted' : 'strict nearby'} meaningful count = 0, bounded stretch count = ${boundedMeaningfulCandidates.length}`
      : boundedMeaningfulCandidates.length > 0
        ? `${originSoftened ? 'origin-adjusted' : 'strict nearby'} meaningful count = ${localMeaningfulCandidates.length}, bounded stretch count = ${boundedMeaningfulCandidates.length}`
        : 'bounded stretch count = 0',
    stretchedCandidateName: stretchedStop?.scoredVenue.venue.name,
    stretchedCandidateDistanceStatus:
      stretchedStop ? getStretchDistanceStatus(stretchedStop.scoredVenue, intent) : undefined,
    score: stretchApplied ? 0.06 : 0,
    penalty: strictNearbyFailed && bestBoundedMeaningful && !stretchApplied ? 0.04 : 0,
  }
}
