import type { VibeShapedDirectionCandidate } from './applyVibeShaping'
import type { DirectionCandidate, DirectionCluster } from './buildDirectionCandidates'
import type { VibeAnchor } from '../types/intent'

type SelectionMode =
  | 'winner_strength'
  | 'guardrail_lane_alignment'
  | 'safe_adjacent'
  | 'different_angle'
  | 'score_fallback'

export interface DistinctDirectionSelectionDecision {
  pocketId: string
  cluster: DirectionCluster
  macroLane: string
  experienceFamily: string
  selectionRank: number
  selectionMode: SelectionMode
  finalScore: number
  confidence: number
  maxSimilarityToSelected: number
  similarityToWinner?: number
  similarityToSlot2?: number
  sameLaneAsWinner?: boolean
  diversityLift: number
  similarityPenalty: number
  contrastScore: number
  winnerStrengthBonus?: number
  adjustedScore: number
}

export interface DistinctDirectionSelectionDebug {
  candidatePoolSize: number
  candidatePoolPocketIds: string[]
  shapedPoolPocketIds: string[]
  preShapeTop3PocketIds: string[]
  postShapeTop3PocketIds: string[]
  elevatedPocketIds: string[]
  droppedPocketIds: string[]
  compositionChangedByShaping: boolean
  strongestShapedId?: string
  strongestShapedRank?: number
  correctedWinnerId?: string
  strongestShapedPreserved: boolean
  slot1GuardrailApplied: boolean
  selectedFamilies: string[]
  familyDiversityApplied: boolean
  fallbackUsed: boolean
  laneCollapseRisk: boolean
  laneSeparatedSlot3: boolean
  laneSeparationReason?: string
  top1RawSeparation: number
  top1AdjustedSeparation: number
  selectionDecisions: DistinctDirectionSelectionDecision[]
}

interface SelectBestDistinctDirectionsInput {
  candidates: VibeShapedDirectionCandidate[]
  preShapeCandidates?: DirectionCandidate[]
  requestedVibe?: VibeAnchor
  finalLimit?: number
}

export interface SelectBestDistinctDirectionsResult {
  finalists: VibeShapedDirectionCandidate[]
  debug: DistinctDirectionSelectionDebug
}

const DEFAULT_FINAL_LIMIT = 3
const SLOT1_GUARDRAIL_MAX_SCORE_MARGIN = 0.028
const SLOT1_GUARDRAIL_MIN_ALIGNMENT_GAP = 0.14
const FAMILY_DIVERSITY_VIABILITY_BAND = 0.065

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function toFixed(value: number): number {
  return Number(value.toFixed(3))
}

function compareCandidates(
  left: VibeShapedDirectionCandidate,
  right: VibeShapedDirectionCandidate,
): number {
  if (right.finalScore !== left.finalScore) {
    return right.finalScore - left.finalScore
  }
  if (right.confidence !== left.confidence) {
    return right.confidence - left.confidence
  }
  return left.pocketId.localeCompare(right.pocketId)
}

function getSetSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) {
    return 0
  }
  let intersectionCount = 0
  for (const value of left) {
    if (right.has(value)) {
      intersectionCount += 1
    }
  }
  const unionCount = new Set([...left, ...right]).size
  return unionCount > 0 ? clamp(intersectionCount / unionCount, 0, 1) : 0
}

function getTagSet(candidate: VibeShapedDirectionCandidate): Set<string> {
  return new Set(
    candidate.derivedFrom.experientialTags
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag.length > 0),
  )
}

function normalizeMomentSeed(seed: string): string {
  return seed.trim().toLowerCase().replace(/\s*->\s*/g, ' then ')
}

function getSeedSet(candidate: VibeShapedDirectionCandidate): Set<string> {
  return new Set(
    candidate.derivedFrom.momentSeeds
      .map((seed) => normalizeMomentSeed(seed))
      .filter((seed) => seed.length > 0),
  )
}

function getMixSimilarity(
  left: VibeShapedDirectionCandidate,
  right: VibeShapedDirectionCandidate,
): number {
  const leftMix = left.derivedFrom.hospitalityMix
  const rightMix = right.derivedFrom.hospitalityMix
  const distance =
    Math.abs(leftMix.drinks - rightMix.drinks) +
    Math.abs(leftMix.dining - rightMix.dining) +
    Math.abs(leftMix.culture - rightMix.culture) +
    Math.abs(leftMix.cafe - rightMix.cafe) +
    Math.abs(leftMix.activity - rightMix.activity)

  return clamp(1 - distance / 2, 0, 1)
}

function getAmbianceSimilarity(
  left: VibeShapedDirectionCandidate,
  right: VibeShapedDirectionCandidate,
): number {
  const leftAmbiance = left.derivedFrom.ambianceProfile
  const rightAmbiance = right.derivedFrom.ambianceProfile
  const matches =
    Number(leftAmbiance.energy === rightAmbiance.energy) +
    Number(leftAmbiance.intimacy === rightAmbiance.intimacy) +
    Number(leftAmbiance.noise === rightAmbiance.noise)

  return clamp(matches / 3, 0, 1)
}

function getLaneIdentitySimilarity(leftIdentity: string, rightIdentity: string): number {
  if (leftIdentity === rightIdentity) {
    return 1
  }
  const leftFamily = leftIdentity.split('_')[0]
  const rightFamily = rightIdentity.split('_')[0]
  if (leftFamily === rightFamily) {
    return 0.62
  }
  if (
    (leftIdentity === 'district_core' && rightIdentity === 'lively_core') ||
    (leftIdentity === 'lively_core' && rightIdentity === 'district_core') ||
    (leftIdentity === 'social_mixed' && rightIdentity === 'lively_core') ||
    (leftIdentity === 'lively_core' && rightIdentity === 'social_mixed')
  ) {
    return 0.56
  }
  return 0.22
}

function getMomentumProfileSimilarity(leftProfile: string, rightProfile: string): number {
  if (leftProfile === rightProfile) {
    return 1
  }
  if (
    (leftProfile === 'fast_build' && rightProfile === 'steady_build') ||
    (leftProfile === 'steady_build' && rightProfile === 'fast_build') ||
    (leftProfile === 'focused_flow' && rightProfile === 'steady_build') ||
    (leftProfile === 'steady_build' && rightProfile === 'focused_flow')
  ) {
    return 0.58
  }
  if (
    (leftProfile === 'soft_start' && rightProfile === 'focused_flow') ||
    (leftProfile === 'focused_flow' && rightProfile === 'soft_start') ||
    (leftProfile === 'late_pull' && rightProfile === 'fast_build') ||
    (leftProfile === 'fast_build' && rightProfile === 'late_pull')
  ) {
    return 0.45
  }
  return 0.2
}

function getCandidateSimilarity(
  left: VibeShapedDirectionCandidate,
  right: VibeShapedDirectionCandidate,
): number {
  const mixSimilarity = getMixSimilarity(left, right)
  const ambianceSimilarity = getAmbianceSimilarity(left, right)
  const tagSimilarity = getSetSimilarity(getTagSet(left), getTagSet(right))
  const seedSimilarity = getSetSimilarity(getSeedSet(left), getSeedSet(right))
  const clusterSimilarity = left.cluster === right.cluster ? 1 : 0
  const laneIdentitySimilarity = getLaneIdentitySimilarity(
    left.contrastProfile.laneIdentity,
    right.contrastProfile.laneIdentity,
  )
  const momentumSimilarity = getMomentumProfileSimilarity(
    left.contrastProfile.momentumProfile,
    right.contrastProfile.momentumProfile,
  )

  return clamp(
    mixSimilarity * 0.31 +
      ambianceSimilarity * 0.17 +
      tagSimilarity * 0.12 +
      seedSimilarity * 0.08 +
      laneIdentitySimilarity * 0.2 +
      momentumSimilarity * 0.08 +
      clusterSimilarity * 0.04,
    0,
    1,
  )
}

function getMaxSimilarityToSelection(
  candidate: VibeShapedDirectionCandidate,
  selected: VibeShapedDirectionCandidate[],
): number {
  if (selected.length === 0) {
    return 0
  }
  return selected.reduce((maxSimilarity, selectedCandidate) => {
    const similarity = getCandidateSimilarity(candidate, selectedCandidate)
    return similarity > maxSimilarity ? similarity : maxSimilarity
  }, 0)
}

function getTopThreePocketIds(candidates: DirectionCandidate[]): string[] {
  return candidates.slice(0, 3).map((candidate) => candidate.pocketId)
}

function hasFlowSeed(candidate: VibeShapedDirectionCandidate): boolean {
  return candidate.derivedFrom.momentSeeds.some((seed) => /->|→|\bthen\b/i.test(seed))
}

function hasTag(candidate: VibeShapedDirectionCandidate, tag: string): boolean {
  const normalizedTag = tag.toLowerCase()
  return candidate.derivedFrom.experientialTags.some(
    (value) => value.toLowerCase() === normalizedTag,
  )
}

function toLevelScore(value: 'low' | 'medium' | 'high'): number {
  if (value === 'high') {
    return 1
  }
  if (value === 'medium') {
    return 0.62
  }
  return 0.24
}

function getLivelyLaneAlignment(candidate: VibeShapedDirectionCandidate): number {
  const mix = candidate.derivedFrom.hospitalityMix
  const ambiance = candidate.derivedFrom.ambianceProfile
  const momentumScore =
    candidate.derivedFrom.momentPotential * 0.55 + (hasFlowSeed(candidate) ? 0.45 : 0)
  const energyScore = toLevelScore(ambiance.energy)
  const activityPresence = mix.activity * 0.56 + mix.drinks * 0.44
  const culturalCalmPenalty =
    ambiance.noise === 'low' && mix.culture > mix.activity && mix.activity < 0.26 ? 0.12 : 0

  return clamp(
    activityPresence * 0.44 + momentumScore * 0.31 + energyScore * 0.25 - culturalCalmPenalty,
    0,
    1,
  )
}

function getCozyLaneAlignment(candidate: VibeShapedDirectionCandidate): number {
  const mix = candidate.derivedFrom.hospitalityMix
  const ambiance = candidate.derivedFrom.ambianceProfile
  const intimacyScore = toLevelScore(ambiance.intimacy)
  const lowNoiseScore = ambiance.noise === 'low' ? 1 : ambiance.noise === 'medium' ? 0.66 : 0.25
  const lowEnergyScore = ambiance.energy === 'low' ? 1 : ambiance.energy === 'medium' ? 0.68 : 0.2
  const comfortMix = clamp(mix.dining + mix.cafe, 0, 1)
  const frictionPenalty =
    mix.activity > 0.4 && ambiance.energy === 'high'
      ? 0.2
      : mix.activity > 0.34
        ? 0.1
        : 0

  return clamp(
    intimacyScore * 0.27 +
      lowNoiseScore * 0.24 +
      lowEnergyScore * 0.19 +
      comfortMix * 0.3 -
      frictionPenalty,
    0,
    1,
  )
}

function getCulturedLaneAlignment(candidate: VibeShapedDirectionCandidate): number {
  const mix = candidate.derivedFrom.hospitalityMix
  const ambiance = candidate.derivedFrom.ambianceProfile
  const curatedSignal =
    Number(hasTag(candidate, 'arts-adjacent')) +
    Number(hasTag(candidate, 'curated')) +
    Number(hasTag(candidate, 'intentional'))
  const intentionality = hasFlowSeed(candidate) ? 1 : curatedSignal > 0 ? 0.7 : 0.35
  const curiositySignal = candidate.derivedFrom.momentSeeds.some((seed) =>
    /gallery|museum|historic|architecture|wander|detour/i.test(seed),
  )
    ? 1
    : 0.45
  const lowChaos =
    ambiance.noise === 'high'
      ? 0.2
      : ambiance.noise === 'medium'
        ? 0.68
        : ambiance.energy === 'high'
          ? 0.56
          : 1

  return clamp(
    mix.culture * 0.42 + intentionality * 0.24 + curiositySignal * 0.18 + lowChaos * 0.16,
    0,
    1,
  )
}

function getLaneAlignmentScore(
  candidate: VibeShapedDirectionCandidate,
  vibe: VibeAnchor | undefined,
): number {
  if (vibe === 'lively') {
    return getLivelyLaneAlignment(candidate)
  }
  if (vibe === 'cozy') {
    return getCozyLaneAlignment(candidate)
  }
  if (vibe === 'cultured') {
    return getCulturedLaneAlignment(candidate)
  }
  return candidate.finalScore
}

function getSignatureStrength(candidate: VibeShapedDirectionCandidate): number {
  const mix = candidate.derivedFrom.hospitalityMix
  const tags = getTagSet(candidate)
  const mixValues = [mix.drinks, mix.dining, mix.culture, mix.cafe, mix.activity]
  const maxMix = Math.max(...mixValues)
  const minMix = Math.min(...mixValues)
  const mixShape = clamp(maxMix - minMix, 0, 1)
  const mixBreadth = clamp(mixValues.filter((value) => value >= 0.14).length / 5, 0, 1)
  const tagBreadth = clamp(tags.size / 6, 0, 1)
  const distinctiveTagSignal =
    ['arts-adjacent', 'mixed-program', 'intentional', 'curated', 'offbeat'].filter((tag) =>
      tags.has(tag),
    ).length / 5

  return clamp(
    mixShape * 0.24 + mixBreadth * 0.24 + tagBreadth * 0.18 + distinctiveTagSignal * 0.34,
    0,
    1,
  )
}

function getMomentSupportStrength(candidate: VibeShapedDirectionCandidate): number {
  const seedCount = candidate.derivedFrom.momentSeeds.filter((seed) => seed.trim().length > 0).length
  const seedSupport = seedCount >= 3 ? 1 : seedCount >= 2 ? 0.74 : seedCount === 1 ? 0.46 : 0.24

  return clamp(
    candidate.derivedFrom.momentPotential * 0.6 +
      seedSupport * 0.2 +
      (hasFlowSeed(candidate) ? 0.2 : 0),
    0,
    1,
  )
}

function getRouteSupportConfidence(candidate: VibeShapedDirectionCandidate): number {
  const mix = candidate.derivedFrom.hospitalityMix
  const laneCount = [mix.drinks, mix.dining, mix.culture, mix.cafe, mix.activity].filter(
    (value) => value >= 0.16,
  ).length
  const laneSupport = clamp(laneCount / 4, 0, 1)
  const ambiance = candidate.derivedFrom.ambianceProfile
  const pacingSupport =
    ambiance.noise === 'high' && ambiance.energy === 'high'
      ? 0.36
      : ambiance.noise === 'high'
        ? 0.52
        : 0.78

  return clamp(candidate.confidence * 0.58 + laneSupport * 0.24 + pacingSupport * 0.18, 0, 1)
}

function getFrictionMismatch(
  candidate: VibeShapedDirectionCandidate,
  vibe: VibeAnchor | undefined,
): number {
  const mix = candidate.derivedFrom.hospitalityMix
  const ambiance = candidate.derivedFrom.ambianceProfile

  if (vibe === 'lively') {
    return clamp(
      (ambiance.energy === 'low' ? 0.42 : 0) +
        (mix.activity + mix.drinks < 0.36 ? 0.32 : 0) +
        (ambiance.noise === 'low' && mix.culture > mix.activity ? 0.24 : 0),
      0,
      1,
    )
  }
  if (vibe === 'cozy') {
    return clamp(
      (ambiance.noise === 'high' ? 0.4 : 0) +
        (ambiance.energy === 'high' ? 0.32 : 0) +
        (mix.activity > 0.42 ? 0.24 : 0),
      0,
      1,
    )
  }
  if (vibe === 'cultured') {
    return clamp(
      (mix.culture < 0.16 ? 0.34 : 0) +
        (ambiance.noise === 'high' ? 0.3 : 0) +
        (mix.activity > 0.45 ? 0.2 : 0),
      0,
      1,
    )
  }
  return 0
}

function getWinnerStrengthBonus(
  candidate: VibeShapedDirectionCandidate,
  vibe: VibeAnchor | undefined,
): number {
  const laneAlignment = getLaneAlignmentScore(candidate, vibe)
  const signatureStrength = getSignatureStrength(candidate)
  const districtIdentityStrength = candidate.contrastProfile.districtIdentityStrength
  const momentSupport = getMomentSupportStrength(candidate)
  const routeSupport = getRouteSupportConfidence(candidate)
  const frictionMismatch = getFrictionMismatch(candidate, vibe)
  const coherentActivation =
    laneAlignment >= 0.58 &&
    signatureStrength >= 0.52 &&
    districtIdentityStrength >= 0.54 &&
    momentSupport >= 0.56 &&
    routeSupport >= 0.56
      ? 1
      : 0

  const rawBonus =
    laneAlignment * 0.028 +
    signatureStrength * 0.016 +
    districtIdentityStrength * 0.024 +
    momentSupport * 0.022 +
    routeSupport * 0.02 +
    coherentActivation * 0.016 -
    frictionMismatch * 0.05

  return clamp(rawBonus, 0, 0.085)
}

function buildSlot1Decision(
  candidate: VibeShapedDirectionCandidate,
  mode: SelectionMode,
  winnerStrengthBonus: number,
): DistinctDirectionSelectionDecision {
  return {
    pocketId: candidate.pocketId,
    cluster: candidate.cluster,
    macroLane: candidate.contrastProfile.macroLane,
    experienceFamily: candidate.experienceFamily,
    selectionRank: 1,
    selectionMode: mode,
    finalScore: toFixed(candidate.finalScore),
    confidence: toFixed(candidate.confidence),
    maxSimilarityToSelected: 0,
    diversityLift: 0,
    similarityPenalty: 0,
    contrastScore: 0,
    winnerStrengthBonus: toFixed(winnerStrengthBonus),
    adjustedScore: toFixed(candidate.finalScore + winnerStrengthBonus),
  }
}

function buildFallbackDecision(
  candidate: VibeShapedDirectionCandidate,
  selected: VibeShapedDirectionCandidate[],
  selectionRank: number,
): DistinctDirectionSelectionDecision {
  const maxSimilarityToSelected = getMaxSimilarityToSelection(candidate, selected)
  const diversityLift = (1 - maxSimilarityToSelected) * 0.04
  const adjustedScore = candidate.finalScore + diversityLift
  return {
    pocketId: candidate.pocketId,
    cluster: candidate.cluster,
    macroLane: candidate.contrastProfile.macroLane,
    experienceFamily: candidate.experienceFamily,
    selectionRank,
    selectionMode: 'score_fallback',
    finalScore: toFixed(candidate.finalScore),
    confidence: toFixed(candidate.confidence),
    maxSimilarityToSelected: toFixed(maxSimilarityToSelected),
    diversityLift: toFixed(diversityLift),
    similarityPenalty: 0,
    contrastScore: toFixed(1 - maxSimilarityToSelected),
    adjustedScore: toFixed(adjustedScore),
  }
}

function buildSlot2Decision(
  candidate: VibeShapedDirectionCandidate,
  winner: VibeShapedDirectionCandidate,
  vibe: VibeAnchor | undefined,
): DistinctDirectionSelectionDecision {
  const similarityToWinner = getCandidateSimilarity(candidate, winner)
  const laneAlignment = getLaneAlignmentScore(candidate, vibe)
  const safeWindow = clamp(1 - Math.abs(similarityToWinner - 0.5) / 0.5, 0, 1)
  const laneIdentityDifferent =
    candidate.contrastProfile.laneIdentity !== winner.contrastProfile.laneIdentity
  const momentumProfileDifferent =
    candidate.contrastProfile.momentumProfile !== winner.contrastProfile.momentumProfile
  const districtIdentityDelta = Math.abs(
    candidate.contrastProfile.districtIdentityStrength -
      winner.contrastProfile.districtIdentityStrength,
  )
  const adjacencyLift = safeWindow * 0.042
  const diversityLift =
    (1 - similarityToWinner) * 0.014 +
    (laneIdentityDifferent ? 0.018 : 0) +
    (momentumProfileDifferent ? 0.013 : 0) +
    districtIdentityDelta * 0.022
  const similarityPenalty =
    (similarityToWinner > 0.84 ? (similarityToWinner - 0.84) * 0.22 : 0) +
    (similarityToWinner > 0.74 && candidate.cluster === winner.cluster ? 0.016 : 0) +
    (similarityToWinner < 0.14 ? 0.02 : 0) +
    (!laneIdentityDifferent && !momentumProfileDifferent ? 0.024 : 0)
  const adjustedScore =
    candidate.finalScore + adjacencyLift + diversityLift + laneAlignment * 0.015 - similarityPenalty

  return {
    pocketId: candidate.pocketId,
    cluster: candidate.cluster,
    macroLane: candidate.contrastProfile.macroLane,
    experienceFamily: candidate.experienceFamily,
    selectionRank: 2,
    selectionMode: 'safe_adjacent',
    finalScore: toFixed(candidate.finalScore),
    confidence: toFixed(candidate.confidence),
    maxSimilarityToSelected: toFixed(similarityToWinner),
    similarityToWinner: toFixed(similarityToWinner),
    sameLaneAsWinner:
      candidate.contrastProfile.macroLane === winner.contrastProfile.macroLane,
    diversityLift: toFixed(adjacencyLift + diversityLift),
    similarityPenalty: toFixed(similarityPenalty),
    contrastScore: toFixed(1 - similarityToWinner),
    adjustedScore: toFixed(adjustedScore),
  }
}

function buildSlot3Decision(
  candidate: VibeShapedDirectionCandidate,
  winner: VibeShapedDirectionCandidate,
  slot2: VibeShapedDirectionCandidate | undefined,
  vibe: VibeAnchor | undefined,
): DistinctDirectionSelectionDecision {
  const similarityToWinner = getCandidateSimilarity(candidate, winner)
  const similarityToSlot2 = slot2 ? getCandidateSimilarity(candidate, slot2) : 0
  const laneAlignment = getLaneAlignmentScore(candidate, vibe)
  const laneIdentityDifferentFromWinner =
    candidate.contrastProfile.laneIdentity !== winner.contrastProfile.laneIdentity
  const laneIdentityDifferentFromSlot2 = slot2
    ? candidate.contrastProfile.laneIdentity !== slot2.contrastProfile.laneIdentity
    : true
  const momentumDifferentFromWinner =
    candidate.contrastProfile.momentumProfile !== winner.contrastProfile.momentumProfile
  const momentumDifferentFromSlot2 = slot2
    ? candidate.contrastProfile.momentumProfile !== slot2.contrastProfile.momentumProfile
    : true
  const contrastEligibleBoost = candidate.contrastProfile.contrastEligible ? 0.065 : 0
  const districtIdentityStrengthBoost =
    candidate.contrastProfile.districtIdentityStrength * 0.028
  const laneDifferenceBoost =
    (laneIdentityDifferentFromWinner ? 0.03 : 0) +
    (laneIdentityDifferentFromSlot2 ? 0.018 : 0)
  const momentumDifferenceBoost =
    (momentumDifferentFromWinner ? 0.018 : 0) +
    (momentumDifferentFromSlot2 ? 0.012 : 0)
  const contrastLift =
    (1 - similarityToWinner) * 0.05 +
    (1 - similarityToSlot2) * 0.03 +
    contrastEligibleBoost +
    districtIdentityStrengthBoost +
    laneDifferenceBoost +
    momentumDifferenceBoost
  const similarityPenalty =
    (similarityToWinner > 0.66 ? (similarityToWinner - 0.66) * 0.28 : 0) +
    (similarityToSlot2 > 0.72 ? (similarityToSlot2 - 0.72) * 0.18 : 0) +
    (!laneIdentityDifferentFromWinner && !momentumDifferentFromWinner ? 0.08 : 0) +
    (!candidate.contrastProfile.contrastEligible && similarityToWinner > 0.62 ? 0.085 : 0)
  const scoreGap = winner.finalScore - candidate.finalScore
  const viabilityPenalty =
    (scoreGap > 0.34 ? (scoreGap - 0.34) * 0.22 + 0.015 : 0) +
    (candidate.confidence < 0.72 ? (0.72 - candidate.confidence) * 0.08 : 0)
  const adjustedScore =
    candidate.finalScore + contrastLift + laneAlignment * 0.02 - similarityPenalty - viabilityPenalty
  const maxSimilarityToSelected = slot2
    ? Math.max(similarityToWinner, similarityToSlot2)
    : similarityToWinner

  return {
    pocketId: candidate.pocketId,
    cluster: candidate.cluster,
    macroLane: candidate.contrastProfile.macroLane,
    experienceFamily: candidate.experienceFamily,
    selectionRank: 3,
    selectionMode: 'different_angle',
    finalScore: toFixed(candidate.finalScore),
    confidence: toFixed(candidate.confidence),
    maxSimilarityToSelected: toFixed(maxSimilarityToSelected),
    similarityToWinner: toFixed(similarityToWinner),
    similarityToSlot2: slot2 ? toFixed(similarityToSlot2) : undefined,
    sameLaneAsWinner:
      candidate.contrastProfile.macroLane === winner.contrastProfile.macroLane,
    diversityLift: toFixed(contrastLift),
    similarityPenalty: toFixed(similarityPenalty + viabilityPenalty),
    contrastScore: toFixed(1 - similarityToWinner),
    adjustedScore: toFixed(adjustedScore),
  }
}

function pickByDecision(
  candidates: VibeShapedDirectionCandidate[],
  decisionBuilder: (candidate: VibeShapedDirectionCandidate) => DistinctDirectionSelectionDecision,
): { candidate: VibeShapedDirectionCandidate; decision: DistinctDirectionSelectionDecision } | undefined {
  const scored = candidates.map((candidate) => ({
    candidate,
    decision: decisionBuilder(candidate),
  }))
  return scored.sort((left, right) => {
    if (right.decision.adjustedScore !== left.decision.adjustedScore) {
      return right.decision.adjustedScore - left.decision.adjustedScore
    }
    return compareCandidates(left.candidate, right.candidate)
  })[0]
}

type FamilyAwarePickResult = {
  pick?: { candidate: VibeShapedDirectionCandidate; decision: DistinctDirectionSelectionDecision }
  familyDiversityApplied: boolean
  fallbackUsed: boolean
}

function pickByDecisionWithFamilyDiversity(params: {
  candidates: VibeShapedDirectionCandidate[]
  selectedFamilies: Set<string>
  decisionBuilder: (candidate: VibeShapedDirectionCandidate) => DistinctDirectionSelectionDecision
  viabilityBand?: number
}): FamilyAwarePickResult {
  const scored = params.candidates
    .map((candidate) => ({
      candidate,
      decision: params.decisionBuilder(candidate),
    }))
    .sort((left, right) => {
      if (right.decision.adjustedScore !== left.decision.adjustedScore) {
        return right.decision.adjustedScore - left.decision.adjustedScore
      }
      return compareCandidates(left.candidate, right.candidate)
    })

  const bestOverall = scored[0]
  if (!bestOverall) {
    return {
      pick: undefined,
      familyDiversityApplied: false,
      fallbackUsed: false,
    }
  }

  const selectedFamilies = params.selectedFamilies
  const needsDiversity = selectedFamilies.has(bestOverall.candidate.experienceFamily)
  if (!needsDiversity || selectedFamilies.size === 0) {
    return {
      pick: bestOverall,
      familyDiversityApplied: false,
      fallbackUsed: false,
    }
  }

  const bestDifferentFamily = scored.find(
    (entry) => !selectedFamilies.has(entry.candidate.experienceFamily),
  )
  if (!bestDifferentFamily) {
    return {
      pick: bestOverall,
      familyDiversityApplied: false,
      fallbackUsed: true,
    }
  }

  const viabilityBand = params.viabilityBand ?? FAMILY_DIVERSITY_VIABILITY_BAND
  const withinBand =
    bestOverall.decision.adjustedScore - bestDifferentFamily.decision.adjustedScore <=
    viabilityBand

  if (withinBand) {
    return {
      pick: bestDifferentFamily,
      familyDiversityApplied: true,
      fallbackUsed: false,
    }
  }

  return {
    pick: bestOverall,
    familyDiversityApplied: false,
    fallbackUsed: true,
  }
}

function detectLaneCollapseRisk(
  winner: VibeShapedDirectionCandidate | undefined,
  slot2: VibeShapedDirectionCandidate | undefined,
  remainingCandidates: VibeShapedDirectionCandidate[],
): boolean {
  if (!winner || !slot2) {
    return false
  }
  const winnerLane = winner.contrastProfile.macroLane
  if (slot2.contrastProfile.macroLane === winnerLane) {
    return true
  }
  const topRemaining = remainingCandidates
    .slice()
    .sort(compareCandidates)
    .slice(0, 3)
  const sameLaneCount = topRemaining.filter(
    (candidate) => candidate.contrastProfile.macroLane === winnerLane,
  ).length
  return sameLaneCount >= 2
}

function pickSlot3WithLaneSeparation(params: {
  remaining: VibeShapedDirectionCandidate[]
  winner: VibeShapedDirectionCandidate
  slot2?: VibeShapedDirectionCandidate
  vibe?: VibeAnchor
  laneCollapseRisk: boolean
  selectedFamilies: Set<string>
}):
  | {
      candidate: VibeShapedDirectionCandidate
      decision: DistinctDirectionSelectionDecision
      laneSeparatedSlot3: boolean
      laneSeparationReason?: string
      familyDiversityApplied: boolean
      fallbackUsed: boolean
    }
  | undefined {
  const bestOverallPick = pickByDecisionWithFamilyDiversity({
    candidates: params.remaining,
    selectedFamilies: params.selectedFamilies,
    decisionBuilder: (candidate) =>
      params.slot2
        ? buildSlot3Decision(candidate, params.winner, params.slot2, params.vibe)
        : buildFallbackDecision(candidate, [params.winner], 3),
  })
  if (!bestOverallPick.pick) {
    return undefined
  }

  if (!params.laneCollapseRisk) {
    return {
      ...bestOverallPick.pick,
      laneSeparatedSlot3:
        bestOverallPick.pick.candidate.contrastProfile.macroLane !== params.winner.contrastProfile.macroLane,
      laneSeparationReason: 'lane_collapse_risk_not_detected',
      familyDiversityApplied: bestOverallPick.familyDiversityApplied,
      fallbackUsed: bestOverallPick.fallbackUsed,
    }
  }

  const differentLaneCandidates = params.remaining.filter(
    (candidate) => candidate.contrastProfile.macroLane !== params.winner.contrastProfile.macroLane,
  )
  if (differentLaneCandidates.length === 0) {
    return {
      ...bestOverallPick.pick,
      laneSeparatedSlot3: false,
      laneSeparationReason: 'no_different_macro_lane_candidate',
      familyDiversityApplied: bestOverallPick.familyDiversityApplied,
      fallbackUsed: bestOverallPick.fallbackUsed,
    }
  }

  const bestDifferentLanePick = pickByDecisionWithFamilyDiversity({
    candidates: differentLaneCandidates,
    selectedFamilies: params.selectedFamilies,
    decisionBuilder: (candidate) =>
      params.slot2
        ? buildSlot3Decision(candidate, params.winner, params.slot2, params.vibe)
        : buildFallbackDecision(candidate, [params.winner], 3),
  })
  if (!bestDifferentLanePick.pick) {
    return {
      ...bestOverallPick.pick,
      laneSeparatedSlot3: false,
      laneSeparationReason: 'different_lane_not_scored',
      familyDiversityApplied: bestOverallPick.familyDiversityApplied,
      fallbackUsed: bestOverallPick.fallbackUsed,
    }
  }

  const viableBandSatisfied =
    bestDifferentLanePick.pick.candidate.confidence >= 0.68 &&
    bestDifferentLanePick.pick.candidate.finalScore >= bestOverallPick.pick.candidate.finalScore - 0.12 &&
    bestDifferentLanePick.pick.decision.adjustedScore >= bestOverallPick.pick.decision.adjustedScore - 0.09

  if (viableBandSatisfied) {
    return {
      ...bestDifferentLanePick.pick,
      laneSeparatedSlot3: true,
      laneSeparationReason: 'preferred_viable_different_macro_lane',
      familyDiversityApplied:
        bestDifferentLanePick.familyDiversityApplied || bestOverallPick.familyDiversityApplied,
      fallbackUsed: bestDifferentLanePick.fallbackUsed || bestOverallPick.fallbackUsed,
    }
  }

  return {
    ...bestOverallPick.pick,
    laneSeparatedSlot3: false,
    laneSeparationReason: 'different_lane_not_within_viable_band',
    familyDiversityApplied: bestOverallPick.familyDiversityApplied,
    fallbackUsed: bestOverallPick.fallbackUsed,
  }
}

export function selectBestDistinctDirections({
  candidates,
  preShapeCandidates,
  requestedVibe,
  finalLimit = DEFAULT_FINAL_LIMIT,
}: SelectBestDistinctDirectionsInput): SelectBestDistinctDirectionsResult {
  const rankedCandidates = candidates.slice().sort(compareCandidates)
  const effectiveFinalLimit = clamp(Math.floor(finalLimit), 1, DEFAULT_FINAL_LIMIT)
  const selected: VibeShapedDirectionCandidate[] = []
  const decisions: DistinctDirectionSelectionDecision[] = []
  const selectedFamilies = new Set<string>()
  let familyDiversityApplied = false
  let fallbackUsed = false

  const remainingByPocketId = new Map(
    rankedCandidates.map((candidate) => [candidate.pocketId, candidate] as const),
  )

  const strongestShaped = rankedCandidates[0]
  const resolvedVibe = requestedVibe ?? strongestShaped?.shapingDebug?.vibe
  const withWinnerStrength = rankedCandidates
    .map((candidate) => {
      const winnerStrengthBonus = getWinnerStrengthBonus(candidate, resolvedVibe)
      return {
        candidate,
        winnerStrengthBonus,
        winnerAdjustedScore: candidate.finalScore + winnerStrengthBonus,
      }
    })
    .sort((left, right) => {
      if (right.winnerAdjustedScore !== left.winnerAdjustedScore) {
        return right.winnerAdjustedScore - left.winnerAdjustedScore
      }
      return compareCandidates(left.candidate, right.candidate)
    })

  let slot1 = withWinnerStrength[0]?.candidate
  let slot1WinnerStrengthBonus = withWinnerStrength[0]?.winnerStrengthBonus ?? 0
  let slot1GuardrailApplied = false

  if (slot1 && resolvedVibe && rankedCandidates.length > 1) {
    const strongestLaneAlignment = getLaneAlignmentScore(slot1, resolvedVibe)
    const lanePreferred = rankedCandidates
      .filter((candidate) => candidate.pocketId !== slot1?.pocketId)
      .map((candidate) => ({
        candidate,
        alignment: getLaneAlignmentScore(candidate, resolvedVibe),
      }))
      .sort((left, right) => {
        if (right.alignment !== left.alignment) {
          return right.alignment - left.alignment
        }
        return compareCandidates(left.candidate, right.candidate)
      })[0]

    if (lanePreferred) {
      const scoreMargin = slot1.finalScore - lanePreferred.candidate.finalScore
      const alignmentGap = lanePreferred.alignment - strongestLaneAlignment
      if (
        scoreMargin <= SLOT1_GUARDRAIL_MAX_SCORE_MARGIN &&
        alignmentGap >= SLOT1_GUARDRAIL_MIN_ALIGNMENT_GAP
      ) {
        slot1 = lanePreferred.candidate
        slot1WinnerStrengthBonus = getWinnerStrengthBonus(slot1, resolvedVibe)
        slot1GuardrailApplied = true
      }
    }
  }

  if (slot1) {
    selected.push(slot1)
    selectedFamilies.add(slot1.experienceFamily)
    decisions.push(
      buildSlot1Decision(
        slot1,
        slot1GuardrailApplied ? 'guardrail_lane_alignment' : 'winner_strength',
        slot1WinnerStrengthBonus,
      ),
    )
    remainingByPocketId.delete(slot1.pocketId)
  }

  if (selected.length < effectiveFinalLimit) {
    const remaining = [...remainingByPocketId.values()]
    const slot2Pick = pickByDecisionWithFamilyDiversity({
      candidates: remaining,
      selectedFamilies,
      decisionBuilder: (candidate) =>
        buildSlot2Decision(candidate, selected[0], resolvedVibe),
    })
    if (slot2Pick.pick) {
      selected.push(slot2Pick.pick.candidate)
      selectedFamilies.add(slot2Pick.pick.candidate.experienceFamily)
      decisions.push(slot2Pick.pick.decision)
      remainingByPocketId.delete(slot2Pick.pick.candidate.pocketId)
      familyDiversityApplied = familyDiversityApplied || slot2Pick.familyDiversityApplied
      fallbackUsed = fallbackUsed || slot2Pick.fallbackUsed
    }
  }

  const laneCollapseRisk = detectLaneCollapseRisk(
    selected[0],
    selected[1],
    [...remainingByPocketId.values()],
  )
  let laneSeparatedSlot3 = false
  let laneSeparationReason: string | undefined

  if (selected.length < effectiveFinalLimit) {
    const remaining = [...remainingByPocketId.values()]
    const slot3Pick = selected.length >= 2
      ? pickSlot3WithLaneSeparation({
          remaining,
          winner: selected[0],
          slot2: selected[1],
          vibe: resolvedVibe,
          laneCollapseRisk,
          selectedFamilies,
        })
      : pickByDecisionWithFamilyDiversity({
          candidates: remaining,
          selectedFamilies,
          decisionBuilder: (candidate) =>
            buildFallbackDecision(candidate, selected, selected.length + 1),
        })
    if (slot3Pick) {
      const picked = 'pick' in slot3Pick ? slot3Pick.pick : slot3Pick
      if (picked) {
        selected.push(picked.candidate)
        selectedFamilies.add(picked.candidate.experienceFamily)
        decisions.push(picked.decision)
        remainingByPocketId.delete(picked.candidate.pocketId)
      }
      if ('laneSeparatedSlot3' in slot3Pick) {
        laneSeparatedSlot3 = slot3Pick.laneSeparatedSlot3
        laneSeparationReason = slot3Pick.laneSeparationReason
        familyDiversityApplied = familyDiversityApplied || slot3Pick.familyDiversityApplied
        fallbackUsed = fallbackUsed || slot3Pick.fallbackUsed
      } else if ('familyDiversityApplied' in slot3Pick) {
        familyDiversityApplied = familyDiversityApplied || slot3Pick.familyDiversityApplied
        fallbackUsed = fallbackUsed || slot3Pick.fallbackUsed
        if (picked && selected[0]) {
          laneSeparatedSlot3 =
            picked.candidate.contrastProfile.macroLane !== selected[0].contrastProfile.macroLane
        }
      } else if (picked && selected[0]) {
        laneSeparatedSlot3 =
          picked.candidate.contrastProfile.macroLane !== selected[0].contrastProfile.macroLane
      }
    }
  }

  while (selected.length < effectiveFinalLimit && remainingByPocketId.size > 0) {
    const remaining = [...remainingByPocketId.values()]
    const fallback = pickByDecisionWithFamilyDiversity({
      candidates: remaining,
      selectedFamilies,
      decisionBuilder: (candidate) =>
        buildFallbackDecision(candidate, selected, selected.length + 1),
    })
    if (!fallback.pick) {
      break
    }
    selected.push(fallback.pick.candidate)
    selectedFamilies.add(fallback.pick.candidate.experienceFamily)
    decisions.push(fallback.pick.decision)
    remainingByPocketId.delete(fallback.pick.candidate.pocketId)
    familyDiversityApplied = familyDiversityApplied || fallback.familyDiversityApplied
    fallbackUsed = fallbackUsed || fallback.fallbackUsed
  }

  const preShapePool = preShapeCandidates ?? []
  const preShapeTop3PocketIds = getTopThreePocketIds(preShapePool)
  const postShapeTop3PocketIds = rankedCandidates.slice(0, 3).map((candidate) => candidate.pocketId)
  const elevatedPocketIds = postShapeTop3PocketIds.filter(
    (pocketId) => !preShapeTop3PocketIds.includes(pocketId),
  )
  const droppedPocketIds = preShapeTop3PocketIds.filter(
    (pocketId) => !postShapeTop3PocketIds.includes(pocketId),
  )

  const rawSecond = rankedCandidates[1]
  const adjustedSecond = withWinnerStrength.find(
    (entry) => entry.candidate.pocketId !== selected[0]?.pocketId,
  )

  return {
    finalists: selected,
    debug: {
      candidatePoolSize: preShapePool.length > 0 ? preShapePool.length : rankedCandidates.length,
      candidatePoolPocketIds: preShapePool.map((candidate) => candidate.pocketId),
      shapedPoolPocketIds: rankedCandidates.map((candidate) => candidate.pocketId),
      preShapeTop3PocketIds,
      postShapeTop3PocketIds,
      elevatedPocketIds,
      droppedPocketIds,
      compositionChangedByShaping: elevatedPocketIds.length > 0 || droppedPocketIds.length > 0,
      strongestShapedId: strongestShaped?.pocketId,
      strongestShapedRank: strongestShaped ? 1 : undefined,
      correctedWinnerId: selected[0]?.pocketId,
      strongestShapedPreserved:
        strongestShaped !== undefined && selected[0]?.pocketId === strongestShaped.pocketId,
      slot1GuardrailApplied,
      selectedFamilies: Array.from(selectedFamilies),
      familyDiversityApplied,
      fallbackUsed,
      laneCollapseRisk,
      laneSeparatedSlot3,
      laneSeparationReason,
      top1RawSeparation: toFixed(
        strongestShaped && rawSecond ? strongestShaped.finalScore - rawSecond.finalScore : 0,
      ),
      top1AdjustedSeparation: toFixed(
        selected[0] && adjustedSecond
          ? selected[0].finalScore +
              getWinnerStrengthBonus(selected[0], resolvedVibe) -
              adjustedSecond.winnerAdjustedScore
          : 0,
      ),
      selectionDecisions: decisions,
    },
  }
}
