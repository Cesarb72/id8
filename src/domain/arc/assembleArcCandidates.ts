import { createId } from '../../lib/ids'
import {
  isRomanticPersonaContractActive,
  satisfiesRomanticPersonaHighlightContract,
} from '../contracts/romanticPersonaContract'
import {
  getArcStopBaseVenueId,
  getArcStopCandidateId,
  getScoredVenueBaseVenueId,
  getScoredVenueCandidateId,
} from '../candidates/candidateIdentity'
import { isCandidateWithinActiveDistanceWindow } from '../constraints/localStretchPolicy'
import { buildRolePools, type RolePools } from './buildRolePools'
import {
  getInvalidArcCombinationReasons,
  hasArcGeographyViolation,
  isValidArcCombination,
} from './isValidArcCombination'
import {
  isArcViable,
  scoreArcAssembly,
  type ScoreArcAssemblyOptions,
} from './scoreArcAssembly'
import {
  buildArcWildcardStops,
  coordinateArcCoreRouteShapes,
  projectArcCandidateAssembly,
  rankArcCandidatesForAssembly,
} from '../../integrations/waypoint/coordination/coordinateArcCandidateAssembly'
import type {
  ArcCandidate,
  AnchorArcTraceDiagnostics,
  ArcStop,
  ArcTop40PreservationDiagnostics,
  AssembleArcCandidatesResult,
  ArcAssemblySurpriseDiagnostics,
  ScoredVenue,
  SurpriseInjectionMetadata,
} from '../types/arc'
import type { CrewPolicy } from '../types/crewPolicies'
import type { ExperienceLens } from '../types/experienceLens'
import type { IntentProfile } from '../types/intent'
import type { InternalRole } from '../types/venue'

function scoreSupportReadability(
  support: ScoredVenue,
  peak: ScoredVenue,
  role: 'warmup' | 'cooldown',
): number {
  const roleScore = role === 'warmup' ? support.roleScores.warmup : support.roleScores.cooldown
  const shapeScore =
    role === 'warmup' ? support.stopShapeFit.start : support.stopShapeFit.windDown
  const categoryContrast =
    support.venue.category === peak.venue.category ? -0.08 : 0.1
  const archetypeContrast =
    support.taste.signals.primaryExperienceArchetype ===
    peak.taste.signals.primaryExperienceArchetype
      ? -0.07
      : 0.09
  const energyContrast =
    role === 'warmup'
      ? Math.max(
          0,
          (peak.venue.energyLevel - support.venue.energyLevel + 1) / 4,
        )
      : Math.max(
          0,
          (support.venue.energyLevel <= peak.venue.energyLevel
            ? peak.venue.energyLevel - support.venue.energyLevel + 1
            : 0) / 4,
        )
  const intensityContrast =
    role === 'warmup'
      ? Math.max(
          0,
          peak.taste.signals.momentIntensity.score -
            support.taste.signals.momentIntensity.score,
        )
      : Math.max(
          0,
          peak.taste.signals.momentIntensity.score -
            support.taste.signals.momentIntensity.score +
            0.04,
        )
  return (
    roleScore * 0.46 +
    shapeScore * 0.24 +
    energyContrast * 0.14 +
    intensityContrast * 0.12 +
    categoryContrast +
    archetypeContrast
  )
}

function getBestSupportStop(
  supports: ScoredVenue[],
  peak: ScoredVenue,
  role: 'warmup' | 'cooldown',
): ScoredVenue | undefined {
  const candidates = supports
    .filter((support) => support.venue.id !== peak.venue.id)
    .sort((left, right) => {
      const scoreDelta =
        scoreSupportReadability(right, peak, role) -
        scoreSupportReadability(left, peak, role)
      if (scoreDelta !== 0) {
        return scoreDelta
      }
      return getScoredVenueCandidateId(left).localeCompare(
        getScoredVenueCandidateId(right),
      )
    })
  return candidates[0]
}

function buildPartialFallbackCandidates(
  pools: RolePools,
  intent: IntentProfile,
  crewPolicy: CrewPolicy,
  lens: ExperienceLens,
  scoringOptions?: ScoreArcAssemblyOptions,
): ArcCandidate[] {
  const candidates: ArcCandidate[] = []
  const candidateKeys = new Set<string>()
  const peaks = pools.peak.slice(0, 12)

  for (const peak of peaks) {
    const highlightIntensity = peak.taste.signals.momentIntensity.score
    const bestWarmup = getBestSupportStop(pools.warmup, peak, 'warmup')
    const bestCooldown = getBestSupportStop(pools.cooldown, peak, 'cooldown')

    const twoStopOptions: ArcStop[][] = []
    if (bestWarmup) {
      twoStopOptions.push([
        { role: 'warmup', scoredVenue: bestWarmup },
        { role: 'peak', scoredVenue: peak },
      ])
    }
    if (bestCooldown) {
      twoStopOptions.push([
        { role: 'peak', scoredVenue: peak },
        { role: 'cooldown', scoredVenue: bestCooldown },
      ])
    }

    for (const stops of twoStopOptions) {
      const hasHighlight = stops.some((stop) => stop.role === 'peak')
      const supportingStopsCount = stops.filter(
        (stop) => stop.role === 'warmup' || stop.role === 'cooldown',
      ).length
      if (
        !isArcViable({
          hasHighlight,
          highlightIntensity,
          supportingStopsCount,
        })
      ) {
        continue
      }
      const invalidReasons = getInvalidArcCombinationReasons(
        stops,
        intent,
        crewPolicy,
        lens,
      )
      if (invalidReasons.length > 0) {
        continue
      }
      const score = scoreArcAssembly(stops, intent, crewPolicy, lens, pools, scoringOptions)
      const key = buildDiagnosticArcId(stops)
      if (candidateKeys.has(key)) {
        continue
      }
      candidateKeys.add(key)
      candidates.push({
        id: createId('arc_partial'),
        stops,
        totalScore: score.totalScore,
        scoreBreakdown: score.scoreBreakdown,
        pacing: score.pacing,
        spatial: score.spatial,
        hasWildcard: false,
      })
    }

    if (highlightIntensity >= 0.8) {
      const highlightOnlyStops: ArcStop[] = [{ role: 'peak', scoredVenue: peak }]
      const invalidReasons = getInvalidArcCombinationReasons(
        highlightOnlyStops,
        intent,
        crewPolicy,
        lens,
      )
      if (invalidReasons.length === 0) {
        const key = buildDiagnosticArcId(highlightOnlyStops)
        if (!candidateKeys.has(key)) {
          const score = scoreArcAssembly(
            highlightOnlyStops,
            intent,
            crewPolicy,
            lens,
            pools,
            scoringOptions,
          )
          candidateKeys.add(key)
          candidates.push({
            id: createId('arc_highlight_only'),
            stops: highlightOnlyStops,
            totalScore: score.totalScore,
            scoreBreakdown: score.scoreBreakdown,
            pacing: score.pacing,
            spatial: score.spatial,
            hasWildcard: false,
          })
        }
      }
    }
  }

  return candidates
}

function roundToHundredths(value: number): number {
  return Number(value.toFixed(2))
}

type SurprisePromotionOutcome = NonNullable<
  SurpriseInjectionMetadata['promotionOutcome']
>

interface SurprisePromotionAssessment {
  promotedStops?: ArcStop[]
  promotedScore?: ReturnType<typeof scoreArcAssembly>
  outcome?: SurprisePromotionOutcome
  demotedHighlightDisposition?: SurpriseInjectionMetadata['demotedHighlightDisposition']
}

function buildDiagnosticArcId(stops: ArcStop[]): string {
  return stops.map((stop) => `${stop.role}:${getArcStopCandidateId(stop)}`).join('|')
}

const preferredDiscoveryRoleOrder: InternalRole[] = ['peak', 'warmup', 'cooldown']

function toInternalRole(role: 'start' | 'highlight' | 'windDown'): InternalRole {
  if (role === 'start') {
    return 'warmup'
  }
  if (role === 'highlight') {
    return 'peak'
  }
  return 'cooldown'
}

function getSurpriseGateProbability(lens: ExperienceLens): number {
  if (lens.discoveryBias === 'high') {
    return 0.42
  }
  if (lens.discoveryBias === 'medium') {
    return 0.36
  }
  return 0.28
}

function getSurpriseComparisonGateProbability(
  candidateTier: 'strong' | 'nearStrong',
  lens: ExperienceLens,
): number {
  const baseProbability = getSurpriseGateProbability(lens)
  if (candidateTier === 'strong') {
    return baseProbability
  }

  return Math.min(0.54, baseProbability + 0.16)
}

function getAllowedSurpriseScoreTradeoff(lens: ExperienceLens): number {
  if (lens.discoveryBias === 'high') {
    return 0.025
  }
  if (lens.discoveryBias === 'medium') {
    return 0.018
  }
  return 0.012
}

function getSurpriseAcceptanceBonus(candidate: ScoredVenue): number {
  const taste = candidate.taste.signals
  const strongExperiential = taste.experientialFactor >= 0.82
  const strongNovelty = taste.noveltyWeight >= 0.78
  const strongRoleFit = taste.roleSuitability.surprise >= 0.74
  const strongSignalCount = [strongExperiential, strongNovelty, strongRoleFit].filter(Boolean).length

  if (strongSignalCount === 3) {
    return 0.01
  }
  if (strongSignalCount === 2) {
    return 0.005
  }
  return 0
}

function getSurpriseCandidateTier(
  candidate: ScoredVenue,
  lens: ExperienceLens,
): 'strong' | 'nearStrong' | null {
  const taste = candidate.taste.signals
  const minimumStrongRoleScore = lens.discoveryBias === 'high' ? 0.6 : 0.64
  const isStrong =
    candidate.roleScores.wildcard >= minimumStrongRoleScore &&
    candidate.stopShapeFit.surprise >= 0.48 &&
    taste.roleSuitability.surprise >= 0.62 &&
    (taste.experientialFactor >= 0.68 || taste.noveltyWeight >= 0.66)
  if (isStrong) {
    return 'strong'
  }

  const isNearStrong =
    candidate.roleScores.wildcard >= 0.55 &&
    candidate.stopShapeFit.surprise >= 0.44 &&
    taste.roleSuitability.surprise >= 0.58 &&
    (taste.experientialFactor >= 0.65 || taste.noveltyWeight >= 0.63)
  return isNearStrong ? 'nearStrong' : null
}

function computeHighlightPromotionAlignmentScore(candidate: ScoredVenue): number {
  const validityWeight =
    candidate.highlightValidity.validityLevel === 'valid'
      ? 1
      : candidate.highlightValidity.validityLevel === 'fallback'
        ? 0.78
        : 0.34
  return (
    candidate.roleScores.peak * 0.42 +
    candidate.stopShapeFit.highlight * 0.16 +
    candidate.taste.signals.momentPotential.score * 0.22 +
    candidate.taste.signals.anchorStrength * 0.12 +
    (candidate.momentIdentity.strength === 'strong'
      ? 0.1
      : candidate.momentIdentity.strength === 'medium'
        ? 0.04
        : 0) +
    (candidate.momentIdentity.type === 'anchor' ||
    candidate.momentIdentity.type === 'explore'
      ? 0.08
      : 0)
  ) * validityWeight
}

function isGenericHospitalityFallbackHighlight(candidate: ScoredVenue): boolean {
  const archetype = candidate.taste.signals.primaryExperienceArchetype
  return (
    (archetype === 'dining' || archetype === 'drinks' || archetype === 'sweet') &&
    candidate.momentIdentity.strength !== 'strong'
  )
}

function getRomanticPromotionAdvantage(
  wildcard: ScoredVenue,
  currentHighlight: ScoredVenue,
  lens: ExperienceLens,
): number {
  if (
    !isRomanticPersonaContractActive(lens) ||
    !satisfiesRomanticPersonaHighlightContract(wildcard, lens)
  ) {
    return 0
  }

  let advantage = 0.04
  if (
    wildcard.momentIdentity.type === 'anchor' ||
    wildcard.momentIdentity.type === 'explore'
  ) {
    advantage += 0.02
  }
  if (isGenericHospitalityFallbackHighlight(currentHighlight)) {
    advantage += 0.04
  }
  if (satisfiesRomanticPersonaHighlightContract(currentHighlight, lens)) {
    advantage -= 0.05
  }

  return Math.max(0, advantage)
}

function isHighlightPromotionHoursOk(candidate: ScoredVenue): boolean {
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

function getHighlightPromotionBlockReason(
  candidate: ScoredVenue,
  intent: IntentProfile,
): SurprisePromotionOutcome | undefined {
  if (
    intent.planningMode === 'user-led' &&
    intent.anchor?.venueId &&
    (intent.anchor.role ?? 'highlight') === 'highlight' &&
    intent.anchor.venueId !== getScoredVenueBaseVenueId(candidate)
  ) {
    return 'held_constraint'
  }
  if (
    !isCandidateWithinActiveDistanceWindow(candidate, intent, {
      allowMeaningfulStretch: true,
    }) ||
    !isHighlightPromotionHoursOk(candidate)
  ) {
    return 'held_constraint'
  }

  const hardContractConflict =
    candidate.roleContract.peak.strength === 'hard' && !candidate.roleContract.peak.satisfied
  if (
    candidate.highlightValidity.validityLevel === 'invalid' ||
    candidate.highlightValidity.personaVetoes.length > 0 ||
    candidate.highlightValidity.contextVetoes.length > 0 ||
    candidate.highlightValidity.violations.length > 0 ||
    hardContractConflict
  ) {
    return 'held_role_invalid'
  }

  if (candidate.roleScores.peak < 0.58 || candidate.stopShapeFit.highlight < 0.34) {
    return 'held_role_invalid'
  }

  return undefined
}

function shouldKeepDemotedHighlightAsSurprise(
  baseStops: ArcStop[],
  promotedHighlight: ScoredVenue,
): boolean {
  const demotedHighlight = baseStops[1]?.scoredVenue
  if (!demotedHighlight) {
    return false
  }
  if (
    demotedHighlight.roleScores.wildcard < 0.55 ||
    demotedHighlight.stopShapeFit.surprise < 0.4
  ) {
    return false
  }

  const demotedArchetype = demotedHighlight.taste.signals.primaryExperienceArchetype
  const promotedArchetype = promotedHighlight.taste.signals.primaryExperienceArchetype
  const repeatedWithPromoted =
    demotedHighlight.venue.category === promotedHighlight.venue.category &&
    demotedArchetype === promotedArchetype
  const repeatedWithSupport = [baseStops[0], baseStops[2]].some(
    (stop) =>
      stop.scoredVenue.venue.category === demotedHighlight.venue.category &&
      stop.scoredVenue.taste.signals.primaryExperienceArchetype === demotedArchetype,
  )

  return !(
    (repeatedWithPromoted || repeatedWithSupport) &&
    demotedHighlight.taste.signals.momentPotential.score < 0.68
  )
}

function buildPromotedSurpriseStops(
  baseStops: ArcStop[],
  promotedHighlight: ScoredVenue,
  demotedHighlightDisposition: SurpriseInjectionMetadata['demotedHighlightDisposition'],
): ArcStop[] {
  const warmup = baseStops[0]!
  const demotedHighlight = baseStops[1]!
  const cooldown = baseStops[2]!

  if (demotedHighlightDisposition === 'surprise') {
    return [
      warmup,
      { role: 'peak', scoredVenue: promotedHighlight },
      { role: 'wildcard', scoredVenue: demotedHighlight.scoredVenue },
      cooldown,
    ]
  }

  return [warmup, { role: 'peak', scoredVenue: promotedHighlight }, cooldown]
}

function evaluateSurprisePromotion(params: {
  baseStops: ArcStop[]
  wildcard: ScoredVenue
  intent: IntentProfile
  crewPolicy: CrewPolicy
  lens: ExperienceLens
  pools: RolePools
  scoringOptions?: ScoreArcAssemblyOptions
}): SurprisePromotionAssessment {
  const currentHighlight = params.baseStops[1]?.scoredVenue
  if (!currentHighlight) {
    return {}
  }
  if (params.wildcard.momentIdentity.strength !== 'strong') {
    return { outcome: 'held_role_invalid' }
  }

  const blockReason = getHighlightPromotionBlockReason(params.wildcard, params.intent)
  if (blockReason) {
    return { outcome: blockReason }
  }

  const romanticPromotionAdvantage = getRomanticPromotionAdvantage(
    params.wildcard,
    currentHighlight,
    params.lens,
  )
  if (
    computeHighlightPromotionAlignmentScore(params.wildcard) + romanticPromotionAdvantage <=
    computeHighlightPromotionAlignmentScore(currentHighlight) + 0.03
  ) {
    return { outcome: 'held_role_invalid' }
  }

  const dispositions: Array<SurpriseInjectionMetadata['demotedHighlightDisposition']> =
    shouldKeepDemotedHighlightAsSurprise(params.baseStops, params.wildcard)
      ? ['surprise', 'removed']
      : ['removed']
  const promotedCandidates = dispositions
    .map((demotedHighlightDisposition) => {
      const promotedStops = buildPromotedSurpriseStops(
        params.baseStops,
        params.wildcard,
        demotedHighlightDisposition,
      )
      if (
        getInvalidArcCombinationReasons(
          promotedStops,
          params.intent,
          params.crewPolicy,
          params.lens,
        ).length > 0
      ) {
        return null
      }

      const promotedScore = scoreArcAssembly(
        promotedStops,
        params.intent,
        params.crewPolicy,
        params.lens,
        params.pools,
        params.scoringOptions,
      )
      return {
        promotedStops,
        promotedScore,
        demotedHighlightDisposition,
      }
    })
    .filter(
      (
        candidate,
      ): candidate is {
        promotedStops: ArcStop[]
        promotedScore: ReturnType<typeof scoreArcAssembly>
        demotedHighlightDisposition: SurpriseInjectionMetadata['demotedHighlightDisposition']
      } => Boolean(candidate),
    )
    .sort((left, right) => right.promotedScore.totalScore - left.promotedScore.totalScore)

  const bestPromotion = promotedCandidates[0]
  if (!bestPromotion) {
    return { outcome: 'held_constraint' }
  }

  return {
    promotedStops: bestPromotion.promotedStops,
    promotedScore: bestPromotion.promotedScore,
    demotedHighlightDisposition: bestPromotion.demotedHighlightDisposition,
  }
}

function stableGateScore(seed: string): number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) % 1000) / 1000
}

function isSurpriseSpatiallyFeasible(
  wildcardStops: ArcStop[],
  wildcardCandidate: ReturnType<typeof scoreArcAssembly>,
  candidateTier: 'strong' | 'nearStrong',
): boolean {
  const wildcardVenueId = wildcardStops[2]?.scoredVenue.venue.id
  const relatedTransitions = wildcardCandidate.spatial.transitions.filter(
    (transition) =>
      transition.fromVenueId === wildcardVenueId ||
      transition.toVenueId === wildcardVenueId,
  )
  if (relatedTransitions.length === 0) {
    return false
  }

  if (wildcardCandidate.spatial.mode === 'walkable') {
    const relatedLongTransitions = relatedTransitions.filter(
      (transition) => transition.longTransition,
    )
    const strictWalkableFeasibility =
      wildcardCandidate.spatial.score >= 0.72 &&
      wildcardCandidate.spatial.repeatedClusterEscapeCount === 0 &&
      relatedLongTransitions.length === 0 &&
      (relatedTransitions.some((transition) => transition.sameCluster) ||
        wildcardCandidate.spatial.jumpUsed)
    if (strictWalkableFeasibility) {
      return true
    }

    if (candidateTier !== 'nearStrong') {
      return false
    }

    return (
      wildcardCandidate.spatial.score >= 0.7 &&
      wildcardCandidate.spatial.repeatedClusterEscapeCount === 0 &&
      relatedLongTransitions.length <= 1 &&
      relatedLongTransitions.every((transition) => transition.driveGap <= 9) &&
      (relatedTransitions.some((transition) => transition.sameCluster) ||
        wildcardCandidate.spatial.jumpUsed)
    )
  }

  return (
    wildcardCandidate.spatial.score >= 0.68 &&
    wildcardCandidate.spatial.repeatedClusterEscapeCount <= 1 &&
    relatedTransitions.filter((transition) => transition.longTransition).length <= 1 &&
    Math.max(...relatedTransitions.map((transition) => transition.driveGap)) <= 12
  )
}

function buildSurpriseInjectionMetadata(
  wildcard: ScoredVenue,
  candidateTier: 'strong' | 'nearStrong',
  gateProbability: number,
  gateScore: number,
  wildcardScore: ReturnType<typeof scoreArcAssembly>,
  scoreDeltaFromBase: number,
  allowedTradeoff: number,
  acceptanceBonusValue: number,
  promotion?: {
    outcome?: SurprisePromotionOutcome
    note?: string
    demotedHighlightDisposition?: SurpriseInjectionMetadata['demotedHighlightDisposition']
  },
): SurpriseInjectionMetadata {
  const taste = wildcard.taste.signals
  return {
    candidateTier,
    gateProbability: roundToHundredths(gateProbability),
    gateScore: roundToHundredths(gateScore),
    spatialScore: wildcardScore.spatial.score,
    scoreDeltaFromBase: roundToHundredths(scoreDeltaFromBase),
    allowedTradeoff: roundToHundredths(allowedTradeoff),
    acceptanceBonusApplied: acceptanceBonusValue > 0,
    acceptanceBonusValue: roundToHundredths(acceptanceBonusValue),
    selectionReason:
      `${wildcard.venue.name} cleared the surprise gate with strong experiential/novelty read, ` +
      `held spatial coherence after the highlight, and stayed within the allowed score tradeoff.`,
    promotionOutcome: promotion?.outcome,
    promotionNote: promotion?.note,
    demotedHighlightDisposition: promotion?.demotedHighlightDisposition,
    tasteSignals: {
      venueId: wildcard.venue.id,
      venueName: wildcard.venue.name,
      experientialFactor: roundToHundredths(taste.experientialFactor),
      noveltyWeight: roundToHundredths(taste.noveltyWeight),
      roleSuitability: roundToHundredths(taste.roleSuitability.surprise),
      supportingSignals: taste.debug.supportingSignals.slice(0, 4),
    },
  }
}

function candidateMatchesPreferredRole(
  candidate: ArcCandidate,
  role: InternalRole,
  venueId: string,
): boolean {
  return candidate.stops.some(
    (stop) => stop.role === role && getArcStopBaseVenueId(stop) === venueId,
  )
}

function stopsMatchRole(stops: ArcStop[], role: InternalRole, venueId: string): boolean {
  return stops.some(
    (stop) => stop.role === role && getArcStopBaseVenueId(stop) === venueId,
  )
}

function updateBestAnchorDiagnostic(
  current:
    | {
        id?: string
        score?: number
      }
    | undefined,
  candidateId: string,
  score: number,
): { id?: string; score?: number } {
  if (typeof current?.score !== 'number' || score > current.score) {
    return {
      id: candidateId,
      score: roundToHundredths(score),
    }
  }

  return current
}

interface ArcTop40PreservationResult {
  candidates: ArcCandidate[]
  diagnostics?: ArcTop40PreservationDiagnostics
}

function routeForCandidate(candidate: ArcCandidate): string {
  return candidate.stops.map((stop) => stop.scoredVenue.venue.name).join(' -> ')
}

function detectClusterBacktrack(candidate: ArcCandidate): boolean {
  const clusters = candidate.spatial.clusterAssignments.map((assignment) => assignment.clusterId)
  const seen = new Set<string>()
  let previous: string | undefined
  for (const cluster of clusters) {
    if (cluster === previous) {
      continue
    }
    if (seen.has(cluster)) {
      return true
    }
    seen.add(cluster)
    previous = cluster
  }
  return false
}

function isTightBuildCompactPreservationActive(
  intent: IntentProfile,
  scoringOptions?: ScoreArcAssemblyOptions,
): boolean {
  const routeShapeContract = scoringOptions?.routeShapeContract
  return Boolean(
    intent.mode === 'build' &&
      intent.planningMode === 'user-led' &&
      intent.anchor?.venueId &&
      routeShapeContract?.movementProfile.radius === 'tight' &&
      routeShapeContract.movementProfile.neighborhoodContinuity === 'strict' &&
      routeShapeContract.mutationProfile.preservePriority.includes('movement'),
  )
}

function isTightCompactAnchorCandidate(
  candidate: ArcCandidate,
  intent: IntentProfile,
  scoringOptions?: ScoreArcAssemblyOptions,
): boolean {
  const routeShapeContract = scoringOptions?.routeShapeContract
  const anchorVenueId = intent.anchor?.venueId
  if (!routeShapeContract || !anchorVenueId) {
    return false
  }
  const anchorRole = toInternalRole(intent.anchor?.role ?? 'highlight')
  if (!candidateMatchesPreferredRole(candidate, anchorRole, anchorVenueId)) {
    return false
  }

  const minutes = candidate.spatial.transitions.map((transition) =>
    Math.max(0, transition.driveGap),
  )
  const transitionCount = Math.max(1, minutes.length)
  const totalMovement = minutes.reduce((sum, value) => sum + value, 0)
  const maxTransition = minutes.reduce((max, value) => Math.max(max, value), 0)
  const maxTransitionLimit = Math.max(1, routeShapeContract.movementProfile.maxTransitionMinutes)
  const totalMovementLimit = maxTransitionLimit * transitionCount * 0.86
  const repeatedEscapeCount = candidate.spatial.repeatedClusterEscapeCount
  const extraClusterEscapeCount = Math.max(0, candidate.spatial.clusterEscapeCount - 1)

  return (
    totalMovement <= totalMovementLimit &&
    maxTransition <= maxTransitionLimit &&
    repeatedEscapeCount === 0 &&
    extraClusterEscapeCount === 0 &&
    !detectClusterBacktrack(candidate) &&
    candidate.spatial.longTransitionCount === 0
  )
}

function compareTightCompactAnchorCandidates(
  left: ArcCandidate,
  right: ArcCandidate,
): number {
  const leftThreeStop = left.stops.length === 3 ? 1 : 0
  const rightThreeStop = right.stops.length === 3 ? 1 : 0
  if (rightThreeStop !== leftThreeStop) {
    return rightThreeStop - leftThreeStop
  }
  const leftWildcard = left.hasWildcard ? 1 : 0
  const rightWildcard = right.hasWildcard ? 1 : 0
  if (leftWildcard !== rightWildcard) {
    return leftWildcard - rightWildcard
  }
  const leftMovement = left.spatial.transitions.reduce(
    (sum, transition) => sum + Math.max(0, transition.driveGap),
    0,
  )
  const rightMovement = right.spatial.transitions.reduce(
    (sum, transition) => sum + Math.max(0, transition.driveGap),
    0,
  )
  if (leftMovement !== rightMovement) {
    return leftMovement - rightMovement
  }
  const leftMaxTransition = left.spatial.transitions.reduce(
    (max, transition) => Math.max(max, transition.driveGap),
    0,
  )
  const rightMaxTransition = right.spatial.transitions.reduce(
    (max, transition) => Math.max(max, transition.driveGap),
    0,
  )
  if (leftMaxTransition !== rightMaxTransition) {
    return leftMaxTransition - rightMaxTransition
  }
  if (left.spatial.clusterEscapeCount !== right.spatial.clusterEscapeCount) {
    return left.spatial.clusterEscapeCount - right.spatial.clusterEscapeCount
  }
  const scoreDelta = right.totalScore - left.totalScore
  if (scoreDelta !== 0) {
    return scoreDelta
  }
  return left.id.localeCompare(right.id)
}

export function preservePreferredArcCandidates(
  rankedCandidates: ArcCandidate[],
  pools: RolePools,
  intent: IntentProfile,
  limit: number,
  scoringOptions?: ScoreArcAssemblyOptions,
): ArcTop40PreservationResult {
  if (rankedCandidates.length <= limit) {
    return { candidates: rankedCandidates }
  }

  const preferredArcCandidates: ArcCandidate[] = []
  const preferredArcIds = new Set<string>()

  if (intent.planningMode === 'user-led' && intent.anchor?.venueId) {
    const anchorRole = toInternalRole(intent.anchor.role ?? 'highlight')
    const anchorStatus = pools.contractPoolStatus[anchorRole]
    if (
      anchorStatus.preferredDiscoveryVenueAdmitted &&
      anchorStatus.preferredDiscoveryVenueId === intent.anchor.venueId
    ) {
      const anchorArc = rankedCandidates.find((candidate) =>
        candidateMatchesPreferredRole(candidate, anchorRole, intent.anchor!.venueId),
      )
      if (anchorArc) {
        preferredArcIds.add(anchorArc.id)
        preferredArcCandidates.push(anchorArc)
      }
    }
  }

  for (const role of preferredDiscoveryRoleOrder) {
    const status = pools.contractPoolStatus[role]
    if (!status.preferredDiscoveryVenueAdmitted || !status.preferredDiscoveryVenueId) {
      continue
    }

    const preferredArc = rankedCandidates.find((candidate) =>
      candidateMatchesPreferredRole(
        candidate,
        role,
        status.preferredDiscoveryVenueId!,
      ),
    )
    if (!preferredArc || preferredArcIds.has(preferredArc.id)) {
      continue
    }

    preferredArcIds.add(preferredArc.id)
    preferredArcCandidates.push(preferredArc)
  }

  const topCandidates = rankedCandidates.slice(0, limit)
  const topCandidateIds = new Set(topCandidates.map((candidate) => candidate.id))
  const missingPreferredArcCandidates = preferredArcCandidates.filter(
    (candidate) => !topCandidateIds.has(candidate.id),
  )
  const tightCompactCandidates = isTightBuildCompactPreservationActive(intent, scoringOptions)
    ? rankedCandidates
        .filter((candidate) => isTightCompactAnchorCandidate(candidate, intent, scoringOptions))
        .sort(compareTightCompactAnchorCandidates)
        .slice(0, 3)
    : []
  const tightCompactCandidateIds = new Set(
    tightCompactCandidates.map((candidate) => candidate.id),
  )
  const missingTightCompactCandidates = tightCompactCandidates.filter(
    (candidate) => !topCandidateIds.has(candidate.id),
  )

  if (
    missingPreferredArcCandidates.length === 0 &&
    missingTightCompactCandidates.length === 0
  ) {
    return { candidates: topCandidates }
  }

  const preservationCandidates = [
    ...missingPreferredArcCandidates,
    ...missingTightCompactCandidates.filter(
      (candidate) => !missingPreferredArcCandidates.some((item) => item.id === candidate.id),
    ),
  ]
  const missingPreservedArcIds = new Set(
    preservationCandidates.map((candidate) => candidate.id),
  )
  const retainedTopCandidates = rankedCandidates
    .filter((candidate) => !missingPreservedArcIds.has(candidate.id))
    .slice(0, Math.max(0, limit - preservationCandidates.length))

  const finalCandidates = [...retainedTopCandidates, ...preservationCandidates]
  const rankedIndex = new Map(
    rankedCandidates.map((candidate, index) => [candidate.id, index] as const),
  )
  const sortedFinalCandidates = finalCandidates.sort(
    (left, right) => (rankedIndex.get(left.id) ?? 0) - (rankedIndex.get(right.id) ?? 0),
  )
  const finalCandidateIds = new Set(sortedFinalCandidates.map((candidate) => candidate.id))
  const replacedCandidateIds = topCandidates
    .filter((candidate) => !finalCandidateIds.has(candidate.id))
    .map((candidate) => candidate.id)
  const preservedCompactCandidates = tightCompactCandidates.filter((candidate) =>
    finalCandidateIds.has(candidate.id),
  )

  return {
    candidates: sortedFinalCandidates,
    diagnostics:
      tightCompactCandidates.length > 0
        ? {
            compactCandidatesPreservedIntoTop40Count:
              preservedCompactCandidates.length,
            placeRightCandidatesPreservedIntoTop40Count:
              preservedCompactCandidates.length,
            preservedCompactCandidateIds: preservedCompactCandidates.map(
              (candidate) => candidate.id,
            ),
            preservedCompactCandidateRoutes:
              preservedCompactCandidates.map(routeForCandidate),
            replacedCandidateIds,
            replacedCandidateCount: replacedCandidateIds.length,
            candidatePreservationReason:
              preservedCompactCandidates.length > 0
                ? 'preserved_due_to_tight_compact_anchor_candidate'
                : undefined,
          }
        : undefined,
  }
}

export function assembleArcCandidates(
  scoredVenues: ScoredVenue[],
  intent: IntentProfile,
  crewPolicy: CrewPolicy,
  lens: ExperienceLens,
  prebuiltPools?: RolePools,
  scoringOptions?: ScoreArcAssemblyOptions,
): AssembleArcCandidatesResult {
  const pools = prebuiltPools ?? buildRolePools(scoredVenues, crewPolicy, lens)
  const anchorRole =
    intent.planningMode === 'user-led' && intent.anchor?.venueId
      ? toInternalRole(intent.anchor.role ?? 'highlight')
      : undefined
  const anchorVenueId =
    intent.planningMode === 'user-led' ? intent.anchor?.venueId : undefined
  let preValidationAnchorArcCount = 0
  let postValidationAnchorArcCount = 0
  let invalidatedAnchorArcCount = 0
  let geographyViolationCount = 0
  const invalidatedAnchorArcReasons: Record<string, number> = {}
  let bestPreValidationAnchorArc:
    | {
        id?: string
        score?: number
      }
    | undefined
  let bestValidatedAnchorArc:
    | {
        id?: string
        score?: number
      }
    | undefined
  const strongSurpriseCandidates = pools.wildcard.filter(
    (candidate) => getSurpriseCandidateTier(candidate, lens) === 'strong',
  )
  const nearStrongSurpriseCandidates = pools.wildcard.filter(
    (candidate) => getSurpriseCandidateTier(candidate, lens) === 'nearStrong',
  )
  const surpriseCandidates = [...strongSurpriseCandidates, ...nearStrongSurpriseCandidates]
  const strongSurpriseIds = new Set(
    strongSurpriseCandidates.map((candidate) => getScoredVenueCandidateId(candidate)),
  )
  const gateProbability = getSurpriseGateProbability(lens)
  const surpriseDiagnostics: ArcAssemblySurpriseDiagnostics = {
    surpriseCandidateCount: surpriseCandidates.length,
    surpriseCandidateTierBreakdown: {
      strong: strongSurpriseCandidates.length,
      nearStrong: nearStrongSurpriseCandidates.length,
    },
    gateProbability: roundToHundredths(gateProbability),
    generatedSurpriseArcCount: 0,
    comparedSurpriseArcTierBreakdown: {
      strong: 0,
      nearStrong: 0,
    },
    rejectedByProbabilityCount: 0,
    rejectedBySpatialCount: 0,
    rejectedBySpatialNearStrongCount: 0,
    rejectedByScoreCount: 0,
    bestRejectedScoreDelta: undefined,
    bestRejectedAllowedTradeoff: undefined,
    bestRejectedAcceptanceBonusValue: undefined,
  }
  const candidates: ArcCandidate[] = []

  for (const coreRoute of coordinateArcCoreRouteShapes({
    warmupCandidates: pools.warmup,
    peakCandidates: pools.peak,
    cooldownCandidates: pools.cooldown,
  })) {
        const { warmup, peak, cooldown, stops: baseStops } = coreRoute
        const baseIncludesAnchor =
          anchorRole && anchorVenueId
            ? stopsMatchRole(baseStops, anchorRole, anchorVenueId)
            : false
        if (baseIncludesAnchor) {
          preValidationAnchorArcCount += 1
          if (hasArcGeographyViolation(baseStops, intent, crewPolicy, lens)) {
            geographyViolationCount += 1
          }
          const diagnosticScore = scoreArcAssembly(
            baseStops,
            intent,
            crewPolicy,
            lens,
            pools,
            scoringOptions,
          )
          bestPreValidationAnchorArc = updateBestAnchorDiagnostic(
            bestPreValidationAnchorArc,
            buildDiagnosticArcId(baseStops),
            diagnosticScore.totalScore,
          )
        }
        const baseInvalidationReasons = getInvalidArcCombinationReasons(
          baseStops,
          intent,
          crewPolicy,
          lens,
        )
        if (baseInvalidationReasons.length > 0) {
          if (baseIncludesAnchor) {
            invalidatedAnchorArcCount += 1
            for (const reason of baseInvalidationReasons) {
              invalidatedAnchorArcReasons[reason] =
                (invalidatedAnchorArcReasons[reason] ?? 0) + 1
            }
          }
          continue
        }

        const baseScore = scoreArcAssembly(
          baseStops,
          intent,
          crewPolicy,
          lens,
          pools,
          scoringOptions,
        )
        const baseCandidate = projectArcCandidateAssembly({
          id: createId('arc'),
          stops: baseStops,
          totalScore: baseScore.totalScore,
          scoreBreakdown: baseScore.scoreBreakdown,
          pacing: baseScore.pacing,
          spatial: baseScore.spatial,
          hasWildcard: false,
        })
        candidates.push(baseCandidate)
        if (baseIncludesAnchor) {
          postValidationAnchorArcCount += 1
          bestValidatedAnchorArc = updateBestAnchorDiagnostic(
            bestValidatedAnchorArc,
            baseCandidate.id,
            baseCandidate.totalScore,
          )
        }

        for (const wildcard of surpriseCandidates) {
          const candidateTier = strongSurpriseIds.has(getScoredVenueCandidateId(wildcard))
            ? 'strong'
            : 'nearStrong'
          const wildcardStops = buildArcWildcardStops(baseStops, wildcard)
          const promotionAssessment = evaluateSurprisePromotion({
            baseStops,
            wildcard,
            intent,
            crewPolicy,
            lens,
            pools,
            scoringOptions,
          })
          const wildcardIncludesAnchor =
            anchorRole && anchorVenueId
              ? stopsMatchRole(wildcardStops, anchorRole, anchorVenueId)
              : false
          const promotedIncludesAnchor =
            anchorRole &&
            anchorVenueId &&
            promotionAssessment.promotedStops
              ? stopsMatchRole(promotionAssessment.promotedStops, anchorRole, anchorVenueId)
              : false
          if (wildcardIncludesAnchor) {
            preValidationAnchorArcCount += 1
            if (hasArcGeographyViolation(wildcardStops, intent, crewPolicy, lens)) {
              geographyViolationCount += 1
            }
            const diagnosticScore = scoreArcAssembly(
              wildcardStops,
              intent,
              crewPolicy,
              lens,
              pools,
              scoringOptions,
            )
            bestPreValidationAnchorArc = updateBestAnchorDiagnostic(
              bestPreValidationAnchorArc,
              buildDiagnosticArcId(wildcardStops),
              diagnosticScore.totalScore,
            )
          }
          let heldWildcardCandidate: ArcCandidate | undefined
          let heldWildcardComparableScore = baseScore.totalScore

          const wildcardInvalidationReasons = getInvalidArcCombinationReasons(
            wildcardStops,
            intent,
            crewPolicy,
            lens,
          )
          if (wildcardInvalidationReasons.length > 0) {
            if (wildcardIncludesAnchor) {
              invalidatedAnchorArcCount += 1
              for (const reason of wildcardInvalidationReasons) {
                invalidatedAnchorArcReasons[reason] =
                  (invalidatedAnchorArcReasons[reason] ?? 0) + 1
              }
            }
          } else {
            const wildcardScore = scoreArcAssembly(
              wildcardStops,
              intent,
              crewPolicy,
              lens,
              pools,
              scoringOptions,
            )
            if (!isSurpriseSpatiallyFeasible(wildcardStops, wildcardScore, candidateTier)) {
              surpriseDiagnostics.rejectedBySpatialCount += 1
              if (candidateTier === 'nearStrong') {
                surpriseDiagnostics.rejectedBySpatialNearStrongCount += 1
              }
            } else {
              const gateSeed = [
                intent.city,
                intent.mode,
                intent.distanceMode,
                getScoredVenueCandidateId(warmup),
                getScoredVenueCandidateId(peak),
                getScoredVenueCandidateId(cooldown),
                getScoredVenueCandidateId(wildcard),
              ].join('|')
              const gateScore = stableGateScore(gateSeed)
              const appliedGateProbability = getSurpriseComparisonGateProbability(
                candidateTier,
                lens,
              )
              if (gateScore > appliedGateProbability) {
                surpriseDiagnostics.rejectedByProbabilityCount += 1
              } else {
                surpriseDiagnostics.comparedSurpriseArcTierBreakdown[candidateTier] += 1

                const acceptanceBonusValue = getSurpriseAcceptanceBonus(wildcard)
                const allowedTradeoff =
                  getAllowedSurpriseScoreTradeoff(lens) + acceptanceBonusValue
                const scoreDeltaFromBase = wildcardScore.totalScore - baseScore.totalScore
                const surpriseWorthAdding = scoreDeltaFromBase >= -allowedTradeoff
                if (!surpriseWorthAdding) {
                  surpriseDiagnostics.rejectedByScoreCount += 1
                  if (
                    typeof surpriseDiagnostics.bestRejectedScoreDelta !== 'number' ||
                    scoreDeltaFromBase > surpriseDiagnostics.bestRejectedScoreDelta
                  ) {
                    surpriseDiagnostics.bestRejectedScoreDelta =
                      roundToHundredths(scoreDeltaFromBase)
                    surpriseDiagnostics.bestRejectedAllowedTradeoff =
                      roundToHundredths(allowedTradeoff)
                    surpriseDiagnostics.bestRejectedAcceptanceBonusValue =
                      roundToHundredths(acceptanceBonusValue)
                  }
                } else {
                  heldWildcardComparableScore = wildcardScore.totalScore
                  heldWildcardCandidate = projectArcCandidateAssembly({
                    id: createId('arc'),
                    stops: wildcardStops,
                    totalScore: wildcardScore.totalScore,
                    scoreBreakdown: wildcardScore.scoreBreakdown,
                    pacing: wildcardScore.pacing,
                    spatial: wildcardScore.spatial,
                    hasWildcard: true,
                    surpriseInjection: buildSurpriseInjectionMetadata(
                      wildcard,
                      candidateTier,
                      appliedGateProbability,
                      gateScore,
                      wildcardScore,
                      scoreDeltaFromBase,
                      allowedTradeoff,
                      acceptanceBonusValue,
                    ),
                  })
                }
              }
            }
          }

          const promotedSurpriseWins =
            Boolean(promotionAssessment.promotedStops && promotionAssessment.promotedScore) &&
            promotionAssessment.promotedScore!.totalScore >=
              heldWildcardComparableScore - 0.002

          if (
            promotionAssessment.promotedStops &&
            promotionAssessment.promotedScore &&
            promotedSurpriseWins
          ) {
            surpriseDiagnostics.generatedSurpriseArcCount += 1
            const promotedCandidate = projectArcCandidateAssembly({
              id: createId('arc'),
              stops: promotionAssessment.promotedStops,
              totalScore: promotionAssessment.promotedScore.totalScore,
              scoreBreakdown: promotionAssessment.promotedScore.scoreBreakdown,
              pacing: promotionAssessment.promotedScore.pacing,
              spatial: promotionAssessment.promotedScore.spatial,
              hasWildcard: promotionAssessment.promotedStops.some(
                (stop) => stop.role === 'wildcard',
              ),
              surpriseInjection: buildSurpriseInjectionMetadata(
                wildcard,
                candidateTier,
                1,
                0,
                promotionAssessment.promotedScore,
                promotionAssessment.promotedScore.totalScore - baseScore.totalScore,
                0,
                0,
                {
                  outcome: 'promoted_to_highlight',
                  note: `Surprise promoted to Highlight | previous highlight ${promotionAssessment.demotedHighlightDisposition === 'surprise' ? 'moved to Surprise' : 'removed'}`,
                  demotedHighlightDisposition:
                    promotionAssessment.demotedHighlightDisposition,
                },
              ),
            })
            candidates.push(promotedCandidate)
            if (promotedIncludesAnchor) {
              postValidationAnchorArcCount += 1
              bestValidatedAnchorArc = updateBestAnchorDiagnostic(
                bestValidatedAnchorArc,
                promotedCandidate.id,
                promotedCandidate.totalScore,
              )
            }
            continue
          }

          if (heldWildcardCandidate) {
            surpriseDiagnostics.generatedSurpriseArcCount += 1
            const existingSurpriseInjection = heldWildcardCandidate.surpriseInjection!
            const finalizedHeldWildcardCandidate: ArcCandidate = {
              ...heldWildcardCandidate,
              surpriseInjection: {
                ...existingSurpriseInjection,
                promotionOutcome:
                  promotionAssessment.promotedStops && promotionAssessment.promotedScore
                    ? 'held_score'
                    : promotionAssessment.outcome,
                promotionNote:
                  promotionAssessment.promotedStops && promotionAssessment.promotedScore
                    ? 'Surprise held (reason: score)'
                    : promotionAssessment.outcome === 'held_constraint'
                      ? 'Surprise held (reason: constraint)'
                      : promotionAssessment.outcome === 'held_role_invalid'
                        ? 'Surprise held (reason: role invalid)'
                        : undefined,
              },
            }
            candidates.push(finalizedHeldWildcardCandidate)
            if (wildcardIncludesAnchor) {
              postValidationAnchorArcCount += 1
              bestValidatedAnchorArc = updateBestAnchorDiagnostic(
                bestValidatedAnchorArc,
                finalizedHeldWildcardCandidate.id,
                finalizedHeldWildcardCandidate.totalScore,
              )
            }
          }
        }
  }

  if (candidates.length === 0) {
    const partialFallbackCandidates = buildPartialFallbackCandidates(
      pools,
      intent,
      crewPolicy,
      lens,
      scoringOptions,
    )
    candidates.push(...partialFallbackCandidates)
  }

  const rankedCandidates = rankArcCandidatesForAssembly(candidates)
  const top40Preservation = preservePreferredArcCandidates(
    rankedCandidates,
    pools,
    intent,
    40,
    scoringOptions,
  )
  const prunedCandidates = top40Preservation.candidates
  const postPruneAnchorCandidates =
    anchorRole && anchorVenueId
      ? prunedCandidates.filter((candidate) =>
          candidateMatchesPreferredRole(candidate, anchorRole, anchorVenueId),
        )
      : []
  const bestPrunedAnchorArc = postPruneAnchorCandidates[0]
  const anchorTrace: AnchorArcTraceDiagnostics | undefined =
    anchorRole && anchorVenueId
      ? {
          anchorRole,
          anchorVenueId,
          anchorGeographyRelaxed: geographyViolationCount > 0,
          geographyViolationCount,
          preValidationAnchorArcCount,
          postValidationAnchorArcCount,
          postPruneAnchorArcCount: postPruneAnchorCandidates.length,
          invalidatedAnchorArcCount,
          invalidatedAnchorArcReasons,
          anchorArcTrimmedByTopN:
            postValidationAnchorArcCount > postPruneAnchorCandidates.length,
          anchorArcTrimmedByWhichStage:
            postValidationAnchorArcCount > postPruneAnchorCandidates.length
              ? 'top_n'
              : undefined,
          bestPreValidationAnchorArcId: bestPreValidationAnchorArc?.id,
          bestPreValidationAnchorArcScore: bestPreValidationAnchorArc?.score,
          bestValidatedAnchorArcId: bestValidatedAnchorArc?.id,
          bestValidatedAnchorArcScore: bestValidatedAnchorArc?.score,
          bestPrunedAnchorArcId: bestPrunedAnchorArc?.id,
          bestPrunedAnchorArcScore:
            typeof bestPrunedAnchorArc?.totalScore === 'number'
              ? roundToHundredths(bestPrunedAnchorArc.totalScore)
              : undefined,
        }
      : undefined

  return {
    candidates: prunedCandidates,
    preTop40Candidates: rankedCandidates,
    top40PreservationDiagnostics: top40Preservation.diagnostics,
    surpriseDiagnostics,
    anchorTrace,
  }
}
