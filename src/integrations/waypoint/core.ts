/**
 * ARC BOUNDARY: Waypoint integration seam (host side).
 *
 * Owns:
 * - deterministic ranking boundary contract for Arc candidates
 * - host-safe serialization of ranking inputs/outputs
 *
 * Does NOT own:
 * - interpretation semantics
 * - feasibility/admissibility gating
 * - product copy/presentation logic
 */
import { deterministicTiebreaker } from '../../lib/ids'
import type { ArcCandidate } from '../../domain/types/arc'
import { getArcStopBaseVenueId } from '../../domain/candidates/candidateIdentity'
import type { ContractGateWorld } from '../../domain/bearings/buildContractGateWorld'
import type { StrategyAdmissibleWorld } from '../../domain/bearings/buildStrategyAdmissibleWorlds'
import type { CanonicalInterpretationBundle } from '../../domain/interpretation/buildCanonicalInterpretationBundle'
import type {
  AnchorRole,
  GreatStopDownstreamSignal,
  IntentProfile,
  RouteShapeContract,
} from '../../domain/types/intent'

export interface WaypointRankRequest {
  candidates: ArcCandidate[]
  intent: IntentProfile
}

export interface WaypointContractInput {
  canonicalInterpretationBundle?: CanonicalInterpretationBundle
  strategyAdmissibleWorlds: StrategyAdmissibleWorld[]
  requiredStopGuarantee: ContractGateWorld['requiredStopGuarantee']
  routeShapeContract?: RouteShapeContract
  normalizedContext: {
    pacing?: CanonicalInterpretationBundle['normalizedIntent']['experienceProfile']['pacing']
    anchorPosture?: CanonicalInterpretationBundle['normalizedIntent']['anchorPosture']
    objective?: CanonicalInterpretationBundle['normalizedIntent']['objective']
    starterLineage?: CanonicalInterpretationBundle['normalizedIntent']['starterLineage']
    anchorLineage?: CanonicalInterpretationBundle['normalizedIntent']['anchorLineage']
    candidateLineage?: CanonicalInterpretationBundle['normalizedIntent']['candidateLineage']
  }
  compatibilityIntent: IntentProfile
  source: 'canonical_contract' | 'compatibility_projection'
}

export interface WaypointContractTrace {
  supplied: boolean
  primaryInput: 'contract_context' | 'intent_profile_compatibility'
  canonicalInterpretationSupplied: boolean
  strategyWorldCount: number
  strategyIds: string[]
  requiredStopConsumed: boolean
  requiredStopRequired: boolean
  requiredStopRole?: AnchorRole
  requiredStopVenueId?: string
  requiredStopSource?: string
  requiredStopReasonCodes: string[]
  requiredStopSurvivingCandidateCount: number
  topCandidatePreservesRequiredStop?: boolean
  normalizedObjectivePrimary?: string
  normalizedPacing?: string
  anchorPostureMode?: string
  candidateLineageSource?: string
}

export interface WaypointRankedCandidate {
  candidate: ArcCandidate
  rankingScore: number
  boundaryBaseScore: number
  boundaryQualityAdjustment: number
  boundaryQualitySignals: WaypointBoundaryQualitySignals
  routeShapeCompactnessAdjustment: number
  routeShapeCompactnessSignals: WaypointRouteShapeCompactnessSignals
  refinementNudge: number
  refinementTokensApplied: string[]
  refinementTokenDeltas: Record<string, number>
  tiebreaker: number
}

export interface WaypointRouteShapeCompactnessSignals {
  active: boolean
  activationReason: string
  movementRadius?: RouteShapeContract['movementProfile']['radius']
  maxTransitionMinutes?: number
  neighborhoodContinuity?: RouteShapeContract['movementProfile']['neighborhoodContinuity']
  preservePriorityIncludesMovement: boolean
  totalMovementEstimate: number
  totalMovementLimit?: number
  maxSingleTransitionEstimate: number
  maxTransitionLimit?: number
  clusterEscapeCount: number
  repeatedClusterEscapeCount: number
  extraClusterEscapeCount: number
  backtrackDetected: boolean
  longTransitionCount: number
  driveLikeMovementDetected: boolean
  compactCandidate: boolean
  reasonSummary: string[]
  compactBonus: number
  compactnessPenalty: number
  adjustment: number
}

export interface WaypointBoundaryQualitySignals {
  supportLaneVarianceScore: number
  laneRepetitionPenalty: number
  clusterCoherenceScore: number
  movementFrictionPenalty: number
  arcProgressionScore: number
  requiredAnchorPreservationNeutrality: number
  totalAdjustment: number
}

export interface WaypointRankResponse {
  ranked: WaypointRankedCandidate[]
  engine: 'local-deterministic-boundary'
  qualityContext?: {
    greatStopRiskTier: GreatStopDownstreamSignal['riskTier']
    greatStopFailedStopCount: number
    greatStopSevereFailureCount: number
    greatStopSuppressionRecommended: boolean
    greatStopPenaltyHint: number
    reasonCodes: string[]
  }
  refinementNudgeSummary: {
    requestedTokens: string[]
    adjustedCandidateCount: number
    minAdjustment: number
    maxAdjustment: number
    averageAdjustment: number
    hostVocabularyMappingApplied: boolean
  }
  contractTrace: WaypointContractTrace
}

function roleToInternal(role: AnchorRole | undefined): 'warmup' | 'peak' | 'cooldown' | undefined {
  if (role === 'start') {
    return 'warmup'
  }
  if (role === 'highlight') {
    return 'peak'
  }
  if (role === 'windDown') {
    return 'cooldown'
  }
  return undefined
}

function priceToNumber(priceTier: '$' | '$$' | '$$$' | '$$$$'): number {
  if (priceTier === '$') {
    return 1
  }
  if (priceTier === '$$') {
    return 2
  }
  if (priceTier === '$$$') {
    return 3
  }
  return 4
}

function averagePrice(candidate: ArcCandidate): number {
  const total = candidate.stops.reduce(
    (sum, stop) => sum + priceToNumber(stop.scoredVenue.venue.priceTier),
    0,
  )
  return total / candidate.stops.length
}

function driveSpread(candidate: ArcCandidate): number {
  const drives = candidate.stops.map((stop) => stop.scoredVenue.venue.driveMinutes)
  return Math.max(...drives) - Math.min(...drives)
}

function candidateDeterministicKey(candidate: ArcCandidate): string {
  return candidate.stops
    .map((stop) => `${stop.role}:${stop.scoredVenue.venue.id}`)
    .join('|')
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function roundToFour(value: number): number {
  return Number(value.toFixed(4))
}

function countRepeatedPairs(values: string[], isProtectedIndex: (index: number) => boolean): {
  repeatedPairs: number
  protectedPairs: number
} {
  let repeatedPairs = 0
  let protectedPairs = 0
  for (let left = 0; left < values.length; left += 1) {
    for (let right = left + 1; right < values.length; right += 1) {
      if (values[left] !== values[right]) {
        continue
      }
      if (isProtectedIndex(left) || isProtectedIndex(right)) {
        protectedPairs += 1
      } else {
        repeatedPairs += 1
      }
    }
  }
  return { repeatedPairs, protectedPairs }
}

function candidateStopMatchesRequiredGuarantee(params: {
  stop: ArcCandidate['stops'][number]
  internalRole: 'warmup' | 'peak' | 'cooldown'
  venueId: string
}): boolean {
  return (
    params.stop.role === params.internalRole &&
    (getArcStopBaseVenueId(params.stop) === params.venueId ||
      params.stop.scoredVenue.venue.id === params.venueId)
  )
}

function waypointBoundaryQualityTrace(
  candidate: ArcCandidate,
  contract: WaypointContractInput | undefined,
): WaypointBoundaryQualitySignals {
  const coreStops = candidate.stops.filter(
    (stop) => stop.role === 'warmup' || stop.role === 'peak' || stop.role === 'cooldown',
  )
  const guarantee = contract?.requiredStopGuarantee
  const requiredRole = roleToInternal(guarantee?.role)
  const isRequiredStopIndex = (index: number): boolean => {
    const stop = coreStops[index]
    return Boolean(
      stop &&
        guarantee?.required &&
        guarantee.venueId &&
        requiredRole &&
        candidateStopMatchesRequiredGuarantee({
          stop,
          internalRole: requiredRole,
          venueId: guarantee.venueId,
        }),
    )
  }
  const lanes = coreStops.map((stop) => String(stop.scoredVenue.taste.modeAlignment.lane))
  const uniqueLaneCount = new Set(lanes).size
  const laneDiversityRatio =
    lanes.length > 1 ? (uniqueLaneCount - 1) / Math.max(1, lanes.length - 1) : 0.5
  const repeatedLanePairs = countRepeatedPairs(lanes, isRequiredStopIndex)
  const supportLaneVarianceScore = clamp((laneDiversityRatio - 0.5) * 0.06, -0.03, 0.03)
  const laneRepetitionPenalty = clamp(
    repeatedLanePairs.repeatedPairs * 0.018 + repeatedLanePairs.protectedPairs * 0.009,
    0,
    0.054,
  )

  const transitionCount = Math.max(1, candidate.spatial.transitions.length)
  const sameClusterRate = candidate.spatial.sameClusterTransitionCount / transitionCount
  const longTransitionRate = candidate.spatial.longTransitionCount / transitionCount
  const clusterCoherenceScore = clamp(
    sameClusterRate * 0.03 +
      (candidate.spatial.clustersVisited.length <= 2 ? 0.012 : 0) +
      (candidate.spatial.longTransitionCount === 0 ? 0.012 : 0),
    0,
    0.054,
  )
  const movementFrictionPenalty = clamp(
    longTransitionRate * 0.035 +
      candidate.spatial.repeatedClusterEscapeCount * 0.02 +
      Math.max(0, candidate.spatial.clusterEscapeCount - 1) * 0.012 +
      candidate.spatial.spatialPenalty * 0.02,
    0,
    0.064,
  )

  const warmup = coreStops.find((stop) => stop.role === 'warmup')
  const peak = coreStops.find((stop) => stop.role === 'peak')
  const cooldown = coreStops.find((stop) => stop.role === 'cooldown')
  let arcProgressionScore = 0
  if (warmup && peak && cooldown) {
    const supportRoleAverage =
      (warmup.scoredVenue.roleScores.warmup + cooldown.scoredVenue.roleScores.cooldown) / 2
    const peakRoleAdvantage = clamp01((peak.scoredVenue.roleScores.peak - supportRoleAverage + 0.4) / 0.8)
    const roleShapeAverage =
      (warmup.scoredVenue.stopShapeFit.start +
        peak.scoredVenue.stopShapeFit.highlight +
        cooldown.scoredVenue.stopShapeFit.windDown) /
      3
    const peakEnergy = peak.scoredVenue.venue.energyLevel
    const warmupEnergy = warmup.scoredVenue.venue.energyLevel
    const cooldownEnergy = cooldown.scoredVenue.venue.energyLevel
    const energyProgression =
      (peakEnergy >= warmupEnergy ? 0.34 : 0) +
      (cooldownEnergy <= peakEnergy ? 0.34 : 0) +
      (peakEnergy > Math.max(warmupEnergy, cooldownEnergy) ? 0.32 : 0)
    const progressionQuality = clamp01(
      peakRoleAdvantage * 0.36 + roleShapeAverage * 0.34 + energyProgression * 0.3,
    )
    arcProgressionScore = clamp((progressionQuality - 0.5) * 0.08, -0.04, 0.04)
  }

  const requiredAnchorPreservationNeutrality =
    guarantee?.required && guarantee.venueId && requiredRole ? 0 : 0
  const totalAdjustment = clamp(
    supportLaneVarianceScore +
      clusterCoherenceScore +
      arcProgressionScore +
      requiredAnchorPreservationNeutrality -
      laneRepetitionPenalty -
      movementFrictionPenalty,
    -0.08,
    0.08,
  )

  return {
    supportLaneVarianceScore: roundToFour(supportLaneVarianceScore),
    laneRepetitionPenalty: roundToFour(laneRepetitionPenalty),
    clusterCoherenceScore: roundToFour(clusterCoherenceScore),
    movementFrictionPenalty: roundToFour(movementFrictionPenalty),
    arcProgressionScore: roundToFour(arcProgressionScore),
    requiredAnchorPreservationNeutrality,
    totalAdjustment: roundToFour(totalAdjustment),
  }
}

function refinementAdjustmentTrace(candidate: ArcCandidate, intent: IntentProfile): {
  totalAdjustment: number
  tokensApplied: string[]
  tokenDeltas: Record<string, number>
} {
  // OBSERVE(arc-boundary): refinement weighting is currently host-vocabulary aware.
  // Keep deterministic behavior, but validate whether these knobs should be passed in from wrappers.
  const refinements = new Set(intent.refinementModes ?? [])
  let adjustment = 0
  const tokenDeltas: Record<string, number> = {}
  const addDelta = (token: string, delta: number) => {
    adjustment += delta
    tokenDeltas[token] = (tokenDeltas[token] ?? 0) + delta
  }

  if (refinements.has('more-exciting')) {
    const peak = candidate.stops.find((stop) => stop.role === 'peak')
    const wildcard = candidate.stops.find((stop) => stop.role === 'wildcard')
    addDelta('more-exciting', (peak?.scoredVenue.venue.energyLevel ?? 0) * 0.005)
    addDelta('more-exciting', (wildcard?.scoredVenue.venue.energyLevel ?? 0) * 0.004)
  }
  if (refinements.has('more-unique')) {
    const uniquenessAverage =
      candidate.stops.reduce((sum, stop) => sum + stop.scoredVenue.venue.uniquenessScore, 0) /
      candidate.stops.length
    addDelta('more-unique', uniquenessAverage * 0.04)
  }
  if (refinements.has('little-fancier')) {
    addDelta('little-fancier', averagePrice(candidate) * 0.018)
  }
  if (refinements.has('closer-by')) {
    addDelta('closer-by', Math.max(0, 0.04 - driveSpread(candidate) * 0.0025))
  }
  if (refinements.has('more-relaxed')) {
    const cooldown = candidate.stops[candidate.stops.length - 1]
    addDelta('more-relaxed', Math.max(0, (4 - cooldown.scoredVenue.venue.energyLevel) * 0.01))
  }

  return {
    totalAdjustment: adjustment,
    tokensApplied: Object.keys(tokenDeltas),
    tokenDeltas,
  }
}

function candidatePreservesRequiredStop(
  candidate: ArcCandidate,
  contract: WaypointContractInput | undefined,
): boolean {
  const guarantee = contract?.requiredStopGuarantee
  const internalRole = roleToInternal(guarantee?.role)
  if (!guarantee?.required || !guarantee.venueId || !internalRole) {
    return false
  }
  const venueId = guarantee.venueId
  return candidate.stops.some(
    (stop) =>
      candidateStopMatchesRequiredGuarantee({
        stop,
        internalRole,
        venueId,
      }),
  )
}

function requiredStopRankingAdjustment(
  candidate: ArcCandidate,
  contract: WaypointContractInput | undefined,
): number {
  const guarantee = contract?.requiredStopGuarantee
  if (!guarantee?.required || !guarantee.venueId || !guarantee.role) {
    return 0
  }
  return candidatePreservesRequiredStop(candidate, contract) ? 0.25 : -0.4
}

function transitionMinutes(candidate: ArcCandidate): number[] {
  const pacingTransitions = candidate.pacing?.transitions ?? []
  if (pacingTransitions.length > 0) {
    return pacingTransitions.map((transition) =>
      Math.max(0, transition.estimatedTransitionMinutes),
    )
  }

  return candidate.spatial.transitions.map((transition) => Math.max(0, transition.driveGap))
}

function detectClusterBacktrack(candidate: ArcCandidate): boolean {
  const clusters = candidate.spatial.clusterAssignments.map((assignment) => assignment.clusterId)
  const visited = new Set<string>()
  let previous: string | undefined
  for (const cluster of clusters) {
    if (cluster !== previous && visited.has(cluster)) {
      return true
    }
    visited.add(cluster)
    previous = cluster
  }
  return false
}

function anchorAdjacentSameClusterRate(
  candidate: ArcCandidate,
  contract: WaypointContractInput | undefined,
): number {
  const guarantee = contract?.requiredStopGuarantee
  const requiredRole = roleToInternal(guarantee?.role)
  if (!guarantee?.required || !guarantee.venueId || !requiredRole) {
    return 0
  }
  const requiredIndex = candidate.stops.findIndex((stop) =>
    candidateStopMatchesRequiredGuarantee({
      stop,
      internalRole: requiredRole,
      venueId: guarantee.venueId!,
    }),
  )
  if (requiredIndex < 0) {
    return 0
  }

  const assignments = candidate.spatial.clusterAssignments
  const requiredCluster = assignments[requiredIndex]?.clusterId
  if (!requiredCluster) {
    return 0
  }
  const adjacent = [assignments[requiredIndex - 1], assignments[requiredIndex + 1]].filter(
    (assignment): assignment is NonNullable<typeof assignment> => Boolean(assignment),
  )
  if (adjacent.length === 0) {
    return 0
  }
  return (
    adjacent.filter((assignment) => assignment.clusterId === requiredCluster).length /
    adjacent.length
  )
}

function evaluateRouteShapeCompactness(
  candidate: ArcCandidate,
  contract: WaypointContractInput | undefined,
): WaypointRouteShapeCompactnessSignals {
  const minutes = transitionMinutes(candidate)
  const totalMovement = minutes.reduce((sum, value) => sum + value, 0)
  const maxTransition = minutes.reduce((max, value) => Math.max(max, value), 0)
  const repeatedEscapeCount = candidate.spatial.repeatedClusterEscapeCount
  const extraClusterEscapeCount = Math.max(0, candidate.spatial.clusterEscapeCount - 1)
  const backtrackDetected = detectClusterBacktrack(candidate)
  const driveLikeMovementDetected = candidate.spatial.longTransitionCount > 0
  const routeShapeContract = contract?.routeShapeContract
  if (!routeShapeContract) {
    return {
      active: false,
      activationReason: 'route_shape_contract_missing',
      preservePriorityIncludesMovement: false,
      totalMovementEstimate: totalMovement,
      maxSingleTransitionEstimate: maxTransition,
      clusterEscapeCount: candidate.spatial.clusterEscapeCount,
      repeatedClusterEscapeCount: repeatedEscapeCount,
      extraClusterEscapeCount,
      backtrackDetected,
      longTransitionCount: candidate.spatial.longTransitionCount,
      driveLikeMovementDetected,
      compactCandidate: false,
      reasonSummary: ['route_shape_contract_missing'],
      compactBonus: 0,
      compactnessPenalty: 0,
      adjustment: 0,
    }
  }
  const movementProfile = routeShapeContract.movementProfile
  const movementPriority = routeShapeContract.mutationProfile.preservePriority.includes('movement')
  const tightProfile =
    movementProfile.radius === 'tight' &&
    movementProfile.neighborhoodContinuity === 'strict' &&
    movementPriority
  if (!tightProfile) {
    const reasonSummary = [
      movementProfile.radius === 'tight' ? null : 'radius_not_tight',
      movementProfile.neighborhoodContinuity === 'strict' ? null : 'continuity_not_strict',
      movementPriority ? null : 'movement_not_preserved',
    ].filter((reason): reason is string => Boolean(reason))
    return {
      active: false,
      activationReason: reasonSummary.join('|') || 'compactness_not_required',
      movementRadius: movementProfile.radius,
      maxTransitionMinutes: movementProfile.maxTransitionMinutes,
      neighborhoodContinuity: movementProfile.neighborhoodContinuity,
      preservePriorityIncludesMovement: movementPriority,
      totalMovementEstimate: totalMovement,
      maxSingleTransitionEstimate: maxTransition,
      clusterEscapeCount: candidate.spatial.clusterEscapeCount,
      repeatedClusterEscapeCount: repeatedEscapeCount,
      extraClusterEscapeCount,
      backtrackDetected,
      longTransitionCount: candidate.spatial.longTransitionCount,
      driveLikeMovementDetected,
      compactCandidate: false,
      reasonSummary,
      compactBonus: 0,
      compactnessPenalty: 0,
      adjustment: 0,
    }
  }

  const transitionCount = Math.max(1, minutes.length)
  const maxTransitionLimit = Math.max(1, movementProfile.maxTransitionMinutes)
  const totalMovementLimit = maxTransitionLimit * transitionCount * 0.86
  const totalOverageRatio = Math.max(0, totalMovement - totalMovementLimit) / totalMovementLimit
  const maxTransitionOverageRatio =
    Math.max(0, maxTransition - maxTransitionLimit) / maxTransitionLimit
  const sameClusterRate =
    candidate.spatial.sameClusterTransitionCount / Math.max(1, candidate.spatial.transitions.length)
  const anchorNearSupportRate = anchorAdjacentSameClusterRate(candidate, contract)

  const compactBonus = clamp(
    sameClusterRate * 0.025 +
      anchorNearSupportRate * 0.025 +
      (totalOverageRatio === 0 && maxTransitionOverageRatio === 0 ? 0.02 : 0),
    0,
    0.07,
  )
  const compactnessPenalty = clamp(
    totalOverageRatio * 0.16 +
      maxTransitionOverageRatio * 0.18 +
      repeatedEscapeCount * 0.07 +
      extraClusterEscapeCount * 0.04 +
      (backtrackDetected ? 0.09 : 0) +
      candidate.spatial.longTransitionCount * 0.035,
    0,
    0.34,
  )
  const reasonSummary = [
    totalOverageRatio > 0 ? 'total_movement_over_tight_limit' : null,
    maxTransitionOverageRatio > 0 ? 'max_transition_over_tight_limit' : null,
    repeatedEscapeCount > 0 ? 'repeated_cluster_escape' : null,
    extraClusterEscapeCount > 0 ? 'extra_cluster_escape' : null,
    backtrackDetected ? 'backtrack_detected' : null,
    candidate.spatial.longTransitionCount > 0 ? 'long_transition_detected' : null,
    compactBonus > 0 ? 'compact_support_bonus' : null,
  ].filter((reason): reason is string => Boolean(reason))
  const compactCandidate =
    totalOverageRatio === 0 &&
    maxTransitionOverageRatio === 0 &&
    repeatedEscapeCount === 0 &&
    extraClusterEscapeCount === 0 &&
    !backtrackDetected &&
    candidate.spatial.longTransitionCount === 0

  return {
    active: true,
    activationReason: 'tight_strict_movement_preserved',
    movementRadius: movementProfile.radius,
    maxTransitionMinutes: movementProfile.maxTransitionMinutes,
    neighborhoodContinuity: movementProfile.neighborhoodContinuity,
    preservePriorityIncludesMovement: movementPriority,
    totalMovementEstimate: totalMovement,
    totalMovementLimit: Number(totalMovementLimit.toFixed(2)),
    maxSingleTransitionEstimate: maxTransition,
    maxTransitionLimit,
    clusterEscapeCount: candidate.spatial.clusterEscapeCount,
    repeatedClusterEscapeCount: repeatedEscapeCount,
    extraClusterEscapeCount,
    backtrackDetected,
    longTransitionCount: candidate.spatial.longTransitionCount,
    driveLikeMovementDetected,
    compactCandidate,
    reasonSummary,
    compactBonus: Number(compactBonus.toFixed(4)),
    compactnessPenalty: Number(compactnessPenalty.toFixed(4)),
    adjustment: Number((compactBonus - compactnessPenalty).toFixed(4)),
  }
}

function buildContractTrace(params: {
  contract?: WaypointContractInput
  ranked: WaypointRankedCandidate[]
}): WaypointContractTrace {
  const { contract, ranked } = params
  if (!contract) {
    return {
      supplied: false,
      primaryInput: 'intent_profile_compatibility',
      canonicalInterpretationSupplied: false,
      strategyWorldCount: 0,
      strategyIds: [],
      requiredStopConsumed: false,
      requiredStopRequired: false,
      requiredStopReasonCodes: [],
      requiredStopSurvivingCandidateCount: 0,
    }
  }

  const requiredStopSurvivingCandidateCount = ranked.filter((entry) =>
    candidatePreservesRequiredStop(entry.candidate, contract),
  ).length
  return {
    supplied: true,
    primaryInput: 'contract_context',
    canonicalInterpretationSupplied: Boolean(contract.canonicalInterpretationBundle),
    strategyWorldCount: contract.strategyAdmissibleWorlds.length,
    strategyIds: contract.strategyAdmissibleWorlds.map((world) => world.strategyId),
    requiredStopConsumed: contract.requiredStopGuarantee.required,
    requiredStopRequired: contract.requiredStopGuarantee.required,
    requiredStopRole: contract.requiredStopGuarantee.role,
    requiredStopVenueId: contract.requiredStopGuarantee.venueId,
    requiredStopSource: contract.requiredStopGuarantee.source,
    requiredStopReasonCodes: [...contract.requiredStopGuarantee.reasonCodes],
    requiredStopSurvivingCandidateCount,
    topCandidatePreservesRequiredStop:
      ranked.length > 0 ? candidatePreservesRequiredStop(ranked[0]!.candidate, contract) : undefined,
    normalizedObjectivePrimary: contract.normalizedContext.objective?.primary,
    normalizedPacing: contract.normalizedContext.pacing,
    anchorPostureMode: contract.normalizedContext.anchorPosture?.mode,
    candidateLineageSource: contract.normalizedContext.candidateLineage?.source,
  }
}

function rankWithWaypointBoundaryInternal(
  request: WaypointRankRequest & { contract?: WaypointContractInput },
): WaypointRankResponse {
  // Canonical coordination seam: consumes pre-built candidates and returns deterministic ordering only.
  const ranked = request.candidates
    .map((candidate) => {
      const boundaryBaseScore = candidate.totalScore
      const refinementTrace = refinementAdjustmentTrace(candidate, request.intent)
      const tiebreaker = deterministicTiebreaker(candidateDeterministicKey(candidate)) * 0.01
      const routeShapeCompactnessSignals = evaluateRouteShapeCompactness(
        candidate,
        request.contract,
      )
      const contractAdjustment =
        requiredStopRankingAdjustment(candidate, request.contract) +
        routeShapeCompactnessSignals.adjustment
      const qualityTrace = waypointBoundaryQualityTrace(candidate, request.contract)
      const rankingScore =
        boundaryBaseScore +
        qualityTrace.totalAdjustment +
        refinementTrace.totalAdjustment +
        contractAdjustment +
        tiebreaker
      return {
        candidate,
        rankingScore,
        boundaryBaseScore,
        boundaryQualityAdjustment: qualityTrace.totalAdjustment,
        boundaryQualitySignals: qualityTrace,
        routeShapeCompactnessAdjustment: routeShapeCompactnessSignals.adjustment,
        routeShapeCompactnessSignals,
        refinementNudge: refinementTrace.totalAdjustment,
        refinementTokensApplied: refinementTrace.tokensApplied,
        refinementTokenDeltas: refinementTrace.tokenDeltas,
        tiebreaker,
      }
    })
    .sort((left, right) => right.rankingScore - left.rankingScore)
  const adjustments = ranked.map((entry) => entry.refinementNudge)
  const minAdjustment = adjustments.length > 0 ? Math.min(...adjustments) : 0
  const maxAdjustment = adjustments.length > 0 ? Math.max(...adjustments) : 0
  const averageAdjustment =
    adjustments.length > 0
      ? adjustments.reduce((sum, value) => sum + value, 0) / adjustments.length
      : 0
  const greatStopSignal = request.intent.selectedDirectionContext?.greatStopSignal

  return {
    ranked,
    engine: 'local-deterministic-boundary',
    qualityContext: greatStopSignal
      ? {
          greatStopRiskTier: greatStopSignal.riskTier,
          greatStopFailedStopCount: greatStopSignal.failedStopCount,
          greatStopSevereFailureCount: greatStopSignal.severeFailureCount,
          greatStopSuppressionRecommended: greatStopSignal.suppressionRecommended,
          greatStopPenaltyHint: greatStopSignal.degradedConfidencePenalty,
          reasonCodes: [...greatStopSignal.reasonCodes],
        }
      : undefined,
    refinementNudgeSummary: {
      requestedTokens: [...new Set(request.intent.refinementModes ?? [])],
      adjustedCandidateCount: adjustments.filter((value) => Math.abs(value) > 0).length,
      minAdjustment: Number(minAdjustment.toFixed(4)),
      maxAdjustment: Number(maxAdjustment.toFixed(4)),
      averageAdjustment: Number(averageAdjustment.toFixed(4)),
      hostVocabularyMappingApplied: (request.intent.refinementModes?.length ?? 0) > 0,
    },
    contractTrace: buildContractTrace({ contract: request.contract, ranked }),
  }
}

export function rankWithWaypointBoundary(request: WaypointRankRequest): WaypointRankResponse {
  return rankWithWaypointBoundaryInternal(request)
}

export function rankWithWaypointBoundaryFromContract(request: {
  candidates: ArcCandidate[]
  contract: WaypointContractInput
}): WaypointRankResponse {
  return rankWithWaypointBoundaryInternal({
    candidates: request.candidates,
    intent: request.contract.compatibilityIntent,
    contract: request.contract,
  })
}
