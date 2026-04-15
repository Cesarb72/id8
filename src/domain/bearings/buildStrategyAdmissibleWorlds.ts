/**
 * ARC BOUNDARY: Bearings strategy admissible worlds.
 *
 * Owns:
 * - per-strategy admissible/suppressed/rejected pocket worlds
 * - strategy hard guards inside the already-gated bearings world
 *
 * Does NOT own:
 * - interpretation semantic authorship
 * - direction card presentation transforms
 */
import type { RankedPocket } from '../../engines/district/types/districtTypes'
import type { GreatStopDownstreamSignal } from '../types/intent'
import type { ContractGateWorld } from './buildContractGateWorld'

type StrategyContractSignalKey =
  | 'highAnchorStrength'
  | 'highlightGravity'
  | 'moderateMovementRadius'
  | 'clearCenterOfGravity'
  | 'evenDensityDistribution'
  | 'lowHighlightEnvironment'
  | 'tightRadiusCluster'
  | 'densityCohesion'
  | 'samePocketViability'
  | 'wideRadiusSpread'
  | 'crossPocketDrift'
  | 'contrastDiversity'
  | 'laneDiversity'
  | 'broadMovementSpread'
  | 'multiPocketPotential'
  | 'overlyTightClustering'
  | 'singleAnchorDominance'

type StrategyContractSignalThresholds = Partial<Record<StrategyContractSignalKey, number>>

type StrategyContractShape = {
  requiredSignals?: StrategyContractSignalThresholds
  preferredSignals?: StrategyContractSignalThresholds
  suppressedSignals?: StrategyContractSignalThresholds
}

export type DirectionStrategyFamily =
  | 'romantic_lively'
  | 'romantic_cozy'
  | 'romantic_cultured'
  | 'friends_lively'
  | 'friends_cozy'
  | 'friends_cultured'
  | 'family_lively'
  | 'family_cozy'
  | 'family_cultured'
  | 'adaptive'

export type DirectionStrategyId =
  | 'contained_pulse'
  | 'exploratory_pulse'
  | 'anchored_pulse'
  | 'intimate_anchor'
  | 'scenic_linger'
  | 'wandering_soft'
  | 'reflective_culture'
  | 'anchored_culture'
  | 'wandering_enrichment'
  | 'group_momentum'
  | 'basecamp_crawl'
  | 'roaming_social'
  | 'easy_hang'
  | 'anchored_hang'
  | 'wandering_hang'
  | 'anchor_pairing'
  | 'exploratory_culture'
  | 'discussion_arc'
  | 'reset_loop'
  | 'anchor_and_rest'
  | 'easy_family_outing'
  | 'active_loop'
  | 'anchored_play'
  | 'roam_and_reset'
  | 'learning_anchor'
  | 'dual_track_day'
  | 'clustered_enrichment'
  | 'adaptive_balance'

export type DirectionStrategyMovementShape =
  | 'contained'
  | 'exploratory'
  | 'anchored'
  | 'balanced'
export type DirectionStrategyDensityShape = 'low' | 'medium' | 'medium_high' | 'high'
export type DirectionStrategyAnchorShape = 'strong' | 'moderate' | 'distributed'
export type DirectionStrategyExplorationShape = 'low' | 'medium' | 'high'
export type DirectionStrategySocialShape = 'intimate' | 'balanced' | 'social' | 'family'
export type DirectionStrategyPeakShape = 'single' | 'multi' | 'cumulative' | 'distributed'

export interface DirectionStrategyDefinition {
  id: DirectionStrategyId
  label: string
  family: DirectionStrategyFamily
  summary: string
  movementShape: DirectionStrategyMovementShape
  densityShape: DirectionStrategyDensityShape
  anchorShape: DirectionStrategyAnchorShape
  explorationShape: DirectionStrategyExplorationShape
  socialShape: DirectionStrategySocialShape
  peakShape: DirectionStrategyPeakShape
}

type StrategyWorldPocketStatus =
  | 'admitted'
  | 'suppressed'
  | 'rejected'
  | 'fallback_admitted'

export interface StrategyWorldPocketDecision {
  pocketId: string
  status: StrategyWorldPocketStatus
  requiredPass: boolean
  preferredScore: number
  suppressedTriggered: boolean
  suppressedScore: number
  shapeScore: number
  hardGuardPassed: boolean
  hardGuardReason: string
  reasonSummary: string
}

export interface StrategyAdmissibleWorld {
  strategyId: DirectionStrategyId
  strategyLabel: string
  strategySummary: string
  strategyFamily: DirectionStrategyFamily
  source: 'bearings.strategy_admissible_world'
  admittedPockets: RankedPocket[]
  suppressedPockets: RankedPocket[]
  rejectedPockets: RankedPocket[]
  hardRequirementResults: Array<{
    pocketId: string
    passed: boolean
    reasons: string[]
  }>
  decisionLog: Array<{
    pocketId: string
    status: 'admitted' | 'suppressed' | 'rejected'
    scoreSummary: string
    reasonSummary: string
  }>
  decisionByPocketId: Record<string, StrategyWorldPocketDecision>
  summary: string
  debug: {
    admittedCount: number
    suppressedCount: number
    rejectedCount: number
    fallbackAdmittedCount: number
    totalInputCount: number
    hardFailCount: number
    suppressedBySignal: Record<string, number>
    rejectedBySignal: Record<string, number>
    topFailureReasons: string[]
    survivabilityStatus: 'viable' | 'weak' | 'collapsed'
    sampleDecisions: {
      pocketId: string
      status: 'admitted' | 'suppressed' | 'rejected'
      reasonSummary: string
    }[]
    allowedPreview: string
    suppressedPreview: string
    rejectedPreview: string
    greatStopQuality?: GreatStopDownstreamSignal
  }
}

interface BuildStrategyAdmissibleWorldsInput {
  contractGateWorld: ContractGateWorld
  strategyFamily: DirectionStrategyFamily
  strategySummary?: string
}

interface DirectionStrategyFeatures {
  compactness: number
  walkability: number
  socialDensity: number
  calmness: number
  intimacy: number
  culturalPotential: number
  scenicPotential: number
  familyPotential: number
  anchorPotential: number
  distributedPotential: number
  explorationPotential: number
}

type StrategyWorldDraftDecision = StrategyWorldPocketDecision & {
  entry: RankedPocket
  fallbackEligible: boolean
}

const STRATEGY_SUPPRESSED_PENALTY_WEIGHT = 0.4
const STRATEGY_REQUIRED_FAIL_PENALTY = 0.34
const STRATEGY_MIN_ADMITTED_SCORE = 0.42
const STRATEGY_MIN_ADMITTED_FOR_NO_FALLBACK = 2
const STRATEGY_WORLD_MAX_FALLBACK_ADMITS = 1
const STRATEGY_WORLD_WINDOW = 18
const EXPLORATORY_REQUIRED_DEGRADE_SCORE_FLOOR = 0.66
const EXPLORATORY_SUPPRESSED_REJECT_SCORE_FLOOR = 0.72

const DIRECTION_STRATEGY_LIBRARY: Record<
  Exclude<DirectionStrategyFamily, 'adaptive'>,
  [DirectionStrategyDefinition, DirectionStrategyDefinition, DirectionStrategyDefinition]
> = {
  romantic_lively: [
    {
      id: 'contained_pulse',
      label: 'Contained pulse night',
      family: 'romantic_lively',
      summary: 'Short moves, compact energy, controlled peaks.',
      movementShape: 'contained',
      densityShape: 'medium_high',
      anchorShape: 'strong',
      explorationShape: 'low',
      socialShape: 'balanced',
      peakShape: 'multi',
    },
    {
      id: 'exploratory_pulse',
      label: 'Exploratory pulse night',
      family: 'romantic_lively',
      summary: 'Broader drift, contrast between peaks, discovery forward.',
      movementShape: 'exploratory',
      densityShape: 'medium',
      anchorShape: 'moderate',
      explorationShape: 'high',
      socialShape: 'balanced',
      peakShape: 'multi',
    },
    {
      id: 'anchored_pulse',
      label: 'Anchored pulse night',
      family: 'romantic_lively',
      summary: 'One strong center with supporting movement around it.',
      movementShape: 'anchored',
      densityShape: 'medium_high',
      anchorShape: 'strong',
      explorationShape: 'medium',
      socialShape: 'balanced',
      peakShape: 'multi',
    },
  ],
  romantic_cozy: [
    {
      id: 'intimate_anchor',
      label: 'Intimate anchor night',
      family: 'romantic_cozy',
      summary: 'Contained centerpiece, low-friction movement, close pacing.',
      movementShape: 'contained',
      densityShape: 'low',
      anchorShape: 'strong',
      explorationShape: 'low',
      socialShape: 'intimate',
      peakShape: 'single',
    },
    {
      id: 'scenic_linger',
      label: 'Scenic linger night',
      family: 'romantic_cozy',
      summary: 'Atmosphere first with slower dwell and softer momentum.',
      movementShape: 'balanced',
      densityShape: 'low',
      anchorShape: 'moderate',
      explorationShape: 'medium',
      socialShape: 'intimate',
      peakShape: 'single',
    },
    {
      id: 'wandering_soft',
      label: 'Wandering soft night',
      family: 'romantic_cozy',
      summary: 'Gentle discovery with continuity over intensity.',
      movementShape: 'exploratory',
      densityShape: 'low',
      anchorShape: 'distributed',
      explorationShape: 'high',
      socialShape: 'intimate',
      peakShape: 'distributed',
    },
  ],
  romantic_cultured: [
    {
      id: 'reflective_culture',
      label: 'Reflective culture arc',
      family: 'romantic_cultured',
      summary: 'Layered cultural progression with reflective pacing.',
      movementShape: 'balanced',
      densityShape: 'low',
      anchorShape: 'moderate',
      explorationShape: 'medium',
      socialShape: 'intimate',
      peakShape: 'cumulative',
    },
    {
      id: 'anchored_culture',
      label: 'Anchored culture arc',
      family: 'romantic_cultured',
      summary: 'Strong cultural center with deliberate orbiting support.',
      movementShape: 'anchored',
      densityShape: 'low',
      anchorShape: 'strong',
      explorationShape: 'low',
      socialShape: 'intimate',
      peakShape: 'cumulative',
    },
    {
      id: 'wandering_enrichment',
      label: 'Wandering enrichment arc',
      family: 'romantic_cultured',
      summary: 'Curated exploration through multiple enrichment anchors.',
      movementShape: 'exploratory',
      densityShape: 'medium',
      anchorShape: 'moderate',
      explorationShape: 'high',
      socialShape: 'intimate',
      peakShape: 'cumulative',
    },
  ],
  friends_lively: [
    {
      id: 'group_momentum',
      label: 'Group momentum run',
      family: 'friends_lively',
      summary: 'Fast social carry-forward with strong collective lift.',
      movementShape: 'balanced',
      densityShape: 'high',
      anchorShape: 'distributed',
      explorationShape: 'medium',
      socialShape: 'social',
      peakShape: 'multi',
    },
    {
      id: 'basecamp_crawl',
      label: 'Basecamp crawl night',
      family: 'friends_lively',
      summary: 'Anchor basecamp with repeatable social loops.',
      movementShape: 'anchored',
      densityShape: 'high',
      anchorShape: 'strong',
      explorationShape: 'low',
      socialShape: 'social',
      peakShape: 'distributed',
    },
    {
      id: 'roaming_social',
      label: 'Roaming social night',
      family: 'friends_lively',
      summary: 'Broader movement with contrast-rich social peaks.',
      movementShape: 'exploratory',
      densityShape: 'medium_high',
      anchorShape: 'distributed',
      explorationShape: 'high',
      socialShape: 'social',
      peakShape: 'multi',
    },
  ],
  friends_cozy: [
    {
      id: 'easy_hang',
      label: 'Easy hang night',
      family: 'friends_cozy',
      summary: 'Low-pressure hang with smooth transitions.',
      movementShape: 'contained',
      densityShape: 'medium',
      anchorShape: 'distributed',
      explorationShape: 'low',
      socialShape: 'balanced',
      peakShape: 'distributed',
    },
    {
      id: 'anchored_hang',
      label: 'Anchored hang night',
      family: 'friends_cozy',
      summary: 'Settle around one dependable social anchor.',
      movementShape: 'anchored',
      densityShape: 'medium',
      anchorShape: 'strong',
      explorationShape: 'low',
      socialShape: 'balanced',
      peakShape: 'distributed',
    },
    {
      id: 'wandering_hang',
      label: 'Wandering hang night',
      family: 'friends_cozy',
      summary: 'Gentle drift with optional anchors and easy close.',
      movementShape: 'exploratory',
      densityShape: 'medium',
      anchorShape: 'distributed',
      explorationShape: 'high',
      socialShape: 'balanced',
      peakShape: 'distributed',
    },
  ],
  friends_cultured: [
    {
      id: 'anchor_pairing',
      label: 'Anchor pairing arc',
      family: 'friends_cultured',
      summary: 'Two strong anchors with clear debrief cadence.',
      movementShape: 'anchored',
      densityShape: 'medium',
      anchorShape: 'strong',
      explorationShape: 'medium',
      socialShape: 'balanced',
      peakShape: 'cumulative',
    },
    {
      id: 'exploratory_culture',
      label: 'Exploratory culture arc',
      family: 'friends_cultured',
      summary: 'Discovery-rich movement through multiple cultural nodes.',
      movementShape: 'exploratory',
      densityShape: 'medium',
      anchorShape: 'moderate',
      explorationShape: 'high',
      socialShape: 'balanced',
      peakShape: 'cumulative',
    },
    {
      id: 'discussion_arc',
      label: 'Discussion-driven arc',
      family: 'friends_cultured',
      summary: 'Conversation-led pacing with structured enrichment beats.',
      movementShape: 'balanced',
      densityShape: 'medium',
      anchorShape: 'moderate',
      explorationShape: 'medium',
      socialShape: 'balanced',
      peakShape: 'cumulative',
    },
  ],
  family_cozy: [
    {
      id: 'reset_loop',
      label: 'Family reset loop',
      family: 'family_cozy',
      summary: 'Engage and recover in a forgiving loop.',
      movementShape: 'contained',
      densityShape: 'low',
      anchorShape: 'distributed',
      explorationShape: 'low',
      socialShape: 'family',
      peakShape: 'distributed',
    },
    {
      id: 'anchor_and_rest',
      label: 'Anchor and rest outing',
      family: 'family_cozy',
      summary: 'One dependable anchor with built-in rest windows.',
      movementShape: 'anchored',
      densityShape: 'low',
      anchorShape: 'strong',
      explorationShape: 'low',
      socialShape: 'family',
      peakShape: 'distributed',
    },
    {
      id: 'easy_family_outing',
      label: 'Easy family outing',
      family: 'family_cozy',
      summary: 'Low-friction movement with steady regroup points.',
      movementShape: 'balanced',
      densityShape: 'low',
      anchorShape: 'distributed',
      explorationShape: 'medium',
      socialShape: 'family',
      peakShape: 'distributed',
    },
  ],
  family_lively: [
    {
      id: 'active_loop',
      label: 'Active family loop',
      family: 'family_lively',
      summary: 'High engagement in bounded movement loops.',
      movementShape: 'contained',
      densityShape: 'medium',
      anchorShape: 'distributed',
      explorationShape: 'medium',
      socialShape: 'family',
      peakShape: 'distributed',
    },
    {
      id: 'anchored_play',
      label: 'Anchored play outing',
      family: 'family_lively',
      summary: 'Play-led center with reset-friendly orbiting stops.',
      movementShape: 'anchored',
      densityShape: 'medium',
      anchorShape: 'strong',
      explorationShape: 'low',
      socialShape: 'family',
      peakShape: 'distributed',
    },
    {
      id: 'roam_and_reset',
      label: 'Roam and reset outing',
      family: 'family_lively',
      summary: 'Active drift with planned reset windows.',
      movementShape: 'exploratory',
      densityShape: 'medium',
      anchorShape: 'distributed',
      explorationShape: 'high',
      socialShape: 'family',
      peakShape: 'distributed',
    },
  ],
  family_cultured: [
    {
      id: 'learning_anchor',
      label: 'Learning anchor day',
      family: 'family_cultured',
      summary: 'Strong learning center with recovery-compatible pacing.',
      movementShape: 'anchored',
      densityShape: 'low',
      anchorShape: 'strong',
      explorationShape: 'low',
      socialShape: 'family',
      peakShape: 'cumulative',
    },
    {
      id: 'dual_track_day',
      label: 'Dual-track enrichment day',
      family: 'family_cultured',
      summary: 'Parallel-track value with synchronized regroup beats.',
      movementShape: 'balanced',
      densityShape: 'medium',
      anchorShape: 'moderate',
      explorationShape: 'medium',
      socialShape: 'family',
      peakShape: 'cumulative',
    },
    {
      id: 'clustered_enrichment',
      label: 'Clustered enrichment day',
      family: 'family_cultured',
      summary: 'Compact cultural nodes with decompression nearby.',
      movementShape: 'contained',
      densityShape: 'low',
      anchorShape: 'moderate',
      explorationShape: 'medium',
      socialShape: 'family',
      peakShape: 'cumulative',
    },
  ],
}

const STRATEGY_CONTRACT_SHAPES: Partial<Record<DirectionStrategyId, StrategyContractShape>> = {
  anchored_pulse: {
    requiredSignals: {
      highAnchorStrength: 0.72,
      highlightGravity: 0.68,
      clearCenterOfGravity: 0.64,
    },
    preferredSignals: {
      moderateMovementRadius: 0.62,
    },
    suppressedSignals: {
      evenDensityDistribution: 0.52,
      lowHighlightEnvironment: 0.46,
      wideRadiusSpread: 0.54,
    },
  },
  contained_pulse: {
    requiredSignals: {
      tightRadiusCluster: 0.72,
      densityCohesion: 0.7,
      samePocketViability: 0.64,
    },
    preferredSignals: {
      samePocketViability: 0.72,
    },
    suppressedSignals: {
      wideRadiusSpread: 0.48,
      crossPocketDrift: 0.48,
      contrastDiversity: 0.62,
    },
  },
  exploratory_pulse: {
    requiredSignals: {
      contrastDiversity: 0.62,
      laneDiversity: 0.56,
      broadMovementSpread: 0.64,
      multiPocketPotential: 0.6,
    },
    preferredSignals: {
      multiPocketPotential: 0.68,
    },
    suppressedSignals: {
      overlyTightClustering: 0.52,
      singleAnchorDominance: 0.54,
    },
  },
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function toFixed(value: number): number {
  return Number(clamp(value, 0, 1).toFixed(3))
}

function toAmbianceNumeric(level: 'low' | 'medium' | 'high'): number {
  if (level === 'low') {
    return 0.2
  }
  if (level === 'medium') {
    return 0.56
  }
  return 0.9
}

function getLaneDiversityScore(
  mix: RankedPocket['profile']['tasteSignals']['hospitalityMix'],
): number {
  const laneValues = [mix.drinks, mix.dining, mix.culture, mix.cafe, mix.activity]
  const activeLaneCount = laneValues.filter((value) => value >= 0.16).length
  const maxLaneValue = Math.max(...laneValues)
  const activeLaneScore = clamp((activeLaneCount - 1) / 4, 0, 1)
  return clamp(activeLaneScore * 0.68 + (1 - maxLaneValue) * 0.32, 0, 1)
}

function getDirectionStrategyFeatures(
  entry: RankedPocket,
): DirectionStrategyFeatures {
  const profile = entry.profile
  const mix = profile.tasteSignals.hospitalityMix
  const ambiance = profile.tasteSignals.ambianceProfile
  const tags = profile.tasteSignals.experientialTags.map((tag) => tag.toLowerCase())
  const categories = profile.categories.map((category) => category.toLowerCase())
  const compactness = clamp(1 - profile.radiusM / 2200, 0, 1)
  const walkability = clamp(profile.coreSignals.walkability, 0, 1)
  const socialDensity = clamp(
    mix.drinks + mix.activity + (ambiance.energy === 'high' ? 0.14 : ambiance.energy === 'medium' ? 0.05 : 0),
    0,
    1,
  )
  const calmness = clamp(
    (1 - toAmbianceNumeric(ambiance.energy)) * 0.52 + (1 - toAmbianceNumeric(ambiance.noise)) * 0.48,
    0,
    1,
  )
  const intimacy = clamp(toAmbianceNumeric(ambiance.intimacy), 0, 1)
  const culturalPotential = clamp(
    mix.culture +
      (tags.some((tag) => tag.includes('arts') || tag.includes('curated') || tag.includes('museum')) ? 0.18 : 0) +
      (categories.some((category) => category.includes('museum') || category.includes('gallery') || category.includes('theater')) ? 0.14 : 0),
    0,
    1,
  )
  const scenicPotential = clamp(
    calmness * 0.58 +
      intimacy * 0.22 +
      (tags.some((tag) => tag.includes('scenic') || tag.includes('calm') || tag.includes('quiet')) ? 0.24 : 0),
    0,
    1,
  )
  const familyPotential = clamp(
    (categories.some((category) => ['park', 'playground', 'aquarium', 'zoo'].includes(category)) ? 0.32 : 0) +
      (tags.some((tag) => tag.includes('family') || tag.includes('kid') || tag.includes('play')) ? 0.28 : 0) +
      calmness * 0.25 +
      walkability * 0.15,
    0,
    1,
  )
  const anchorPotential = clamp(
    profile.tasteSignals.momentPotential * 0.5 +
      mix.dining * 0.25 +
      mix.culture * 0.15 +
      intimacy * 0.1,
    0,
    1,
  )
  const distributedPotential = clamp(
    mix.activity * 0.32 + mix.drinks * 0.28 + mix.cafe * 0.2 + mix.dining * 0.2,
    0,
    1,
  )
  const explorationPotential = clamp(
    (1 - compactness) * 0.42 +
      profile.coreSignals.categoryDiversity * 0.28 +
      profile.coreSignals.density * 0.16 +
      (tags.some((tag) => tag.includes('mixed') || tag.includes('offbeat') || tag.includes('detour')) ? 0.14 : 0),
    0,
    1,
  )
  return {
    compactness,
    walkability,
    socialDensity,
    calmness,
    intimacy,
    culturalPotential,
    scenicPotential,
    familyPotential,
    anchorPotential,
    distributedPotential,
    explorationPotential,
  }
}

function getStrategyContractSignals(
  entry: RankedPocket,
  features: DirectionStrategyFeatures,
): Record<StrategyContractSignalKey, number> {
  const profile = entry.profile
  const mix = profile.tasteSignals.hospitalityMix
  const momentPotential = clamp(profile.tasteSignals.momentPotential, 0, 1)
  const density = clamp(profile.coreSignals.density, 0, 1)
  const categoryDiversity = clamp(profile.coreSignals.categoryDiversity, 0, 1)
  const normalizedRadius = clamp(profile.radiusM / 360, 0, 1)
  const moderateRadius = clamp(1 - Math.abs(profile.radiusM - 185) / 185, 0, 1)
  const clearCenterOfGravity = clamp(
    features.anchorPotential * 0.66 +
      features.compactness * 0.24 +
      momentPotential * 0.1 -
      features.distributedPotential * 0.24,
    0,
    1,
  )
  const tightRadiusCluster = clamp(
    features.compactness * 0.56 + features.walkability * 0.24 + density * 0.2,
    0,
    1,
  )
  const broadMovementSpread = clamp(
    (1 - features.compactness) * 0.52 + features.explorationPotential * 0.48,
    0,
    1,
  )
  const laneDiversity = getLaneDiversityScore(mix)
  const contrastDiversity = clamp(categoryDiversity * 0.64 + laneDiversity * 0.36, 0, 1)

  return {
    highAnchorStrength: clamp(features.anchorPotential * 0.74 + momentPotential * 0.26, 0, 1),
    highlightGravity: clamp(momentPotential * 0.72 + features.anchorPotential * 0.28, 0, 1),
    moderateMovementRadius: moderateRadius,
    clearCenterOfGravity,
    evenDensityDistribution: clamp(
      features.distributedPotential * 0.72 + (1 - clearCenterOfGravity) * 0.28,
      0,
      1,
    ),
    lowHighlightEnvironment: clamp((1 - momentPotential) * 0.66 + (1 - features.anchorPotential) * 0.34, 0, 1),
    tightRadiusCluster,
    densityCohesion: clamp(density * 0.46 + features.walkability * 0.34 + features.compactness * 0.2, 0, 1),
    samePocketViability: clamp(
      density * 0.34 +
        features.walkability * 0.26 +
        features.compactness * 0.2 +
        features.anchorPotential * 0.2,
      0,
      1,
    ),
    wideRadiusSpread: clamp((1 - features.compactness) * 0.72 + normalizedRadius * 0.28, 0, 1),
    crossPocketDrift: clamp(
      (1 - features.compactness) * 0.46 +
        (1 - features.walkability) * 0.24 +
        features.explorationPotential * 0.3,
      0,
      1,
    ),
    contrastDiversity,
    laneDiversity,
    broadMovementSpread,
    multiPocketPotential: clamp(
      broadMovementSpread * 0.58 + contrastDiversity * 0.24 + laneDiversity * 0.18,
      0,
      1,
    ),
    overlyTightClustering: tightRadiusCluster,
    singleAnchorDominance: clamp(
      features.anchorPotential * 0.62 + (1 - features.distributedPotential) * 0.38,
      0,
      1,
    ),
  }
}

function getSignalThresholdPassScore(
  signalValue: number,
  threshold: number,
): number {
  if (threshold <= 0) {
    return 1
  }
  if (signalValue >= threshold) {
    return 1
  }
  return clamp(signalValue / threshold, 0, 1)
}

function evaluateSignalThresholds<TSignalKey extends string>(
  signals: Record<TSignalKey, number>,
  thresholds: Partial<Record<TSignalKey, number>> | undefined,
): {
  pass: boolean
  score: number
  triggered: boolean
} {
  if (!thresholds || Object.keys(thresholds).length === 0) {
    return {
      pass: true,
      score: 0.5,
      triggered: false,
    }
  }

  const entries = Object.entries(thresholds) as Array<[TSignalKey, number]>
  let passCount = 0
  let cumulativeScore = 0
  for (const [key, threshold] of entries) {
    const value = signals[key]
    if (value >= threshold) {
      passCount += 1
    }
    cumulativeScore += getSignalThresholdPassScore(value, threshold)
  }

  return {
    pass: passCount === entries.length,
    score: entries.length > 0 ? toFixed(cumulativeScore / entries.length) : 0.5,
    triggered: passCount > 0,
  }
}

function getSignalsMeetingThresholds<TSignalKey extends string>(
  signals: Record<TSignalKey, number>,
  thresholds: Partial<Record<TSignalKey, number>> | undefined,
): TSignalKey[] {
  if (!thresholds || Object.keys(thresholds).length === 0) {
    return []
  }
  return (Object.entries(thresholds) as Array<[TSignalKey, number]>)
    .filter(([signalKey, threshold]) => signals[signalKey] >= threshold)
    .map(([signalKey]) => signalKey)
}

function getSignalsBelowThresholds<TSignalKey extends string>(
  signals: Record<TSignalKey, number>,
  thresholds: Partial<Record<TSignalKey, number>> | undefined,
): TSignalKey[] {
  if (!thresholds || Object.keys(thresholds).length === 0) {
    return []
  }
  return (Object.entries(thresholds) as Array<[TSignalKey, number]>)
    .filter(([signalKey, threshold]) => signals[signalKey] < threshold)
    .map(([signalKey]) => signalKey)
}

function incrementSignalCount(
  target: Record<string, number>,
  key: string,
): void {
  target[key] = (target[key] ?? 0) + 1
}

function evaluateStrategyHardGuard(strategyId: DirectionStrategyId, signals: Record<StrategyContractSignalKey, number>, momentPotential: number): {
  passed: boolean
  reason: string
} {
  if (strategyId === 'anchored_pulse') {
    const passed =
      signals.highAnchorStrength >= 0.74 ||
      signals.highlightGravity >= 0.72 ||
      signals.clearCenterOfGravity >= 0.68 ||
      momentPotential >= 0.72
    return {
      passed,
      reason: passed ? 'high_anchor_candidate_present' : 'no_high_anchor_candidate',
    }
  }

  if (strategyId === 'contained_pulse') {
    const passed =
      signals.tightRadiusCluster >= 0.72 ||
      signals.densityCohesion >= 0.7 ||
      signals.samePocketViability >= 0.68
    return {
      passed,
      reason: passed ? 'compact_cluster_candidate_present' : 'compactness_threshold_not_met',
    }
  }

  if (strategyId === 'exploratory_pulse') {
    const passedSignals =
      Number(signals.contrastDiversity >= 0.62) +
      Number(signals.broadMovementSpread >= 0.6) +
      Number(signals.laneDiversity >= 0.54) +
      Number(signals.multiPocketPotential >= 0.58)
    const hasExploratoryCoreSignal =
      signals.contrastDiversity >= 0.62 || signals.broadMovementSpread >= 0.6
    const passed = hasExploratoryCoreSignal && passedSignals >= 2
    return {
      passed,
      reason: passed
        ? 'diversity_or_spread_candidate_present'
        : 'diversity_or_spread_threshold_not_met',
    }
  }

  return {
    passed: true,
    reason: 'no_hard_guard_defined',
  }
}

export function resolveDirectionStrategiesForFamily(
  family: DirectionStrategyFamily,
): DirectionStrategyDefinition[] {
  if (family === 'adaptive') {
    return [
      {
        id: 'adaptive_balance',
        label: 'Adaptive balanced night',
        family: 'adaptive',
        summary: 'Balanced movement with one clear center and stable flow.',
        movementShape: 'balanced',
        densityShape: 'medium',
        anchorShape: 'moderate',
        explorationShape: 'medium',
        socialShape: 'balanced',
        peakShape: 'single',
      },
    ]
  }
  return [...DIRECTION_STRATEGY_LIBRARY[family]]
}

function formatPreview(pockets: RankedPocket[]): string {
  return pockets.slice(0, 3).map((entry) => entry.profile.pocketId).join(', ') || 'n/a'
}

function buildStrategyWorld(
  strategy: DirectionStrategyDefinition,
  ranked: RankedPocket[],
  greatStopQuality?: GreatStopDownstreamSignal,
): StrategyAdmissibleWorld {
  const seedPool = ranked.slice(0, Math.max(STRATEGY_WORLD_WINDOW, ranked.length))
  const contractShape = STRATEGY_CONTRACT_SHAPES[strategy.id]
  const suppressedBySignal: Record<string, number> = {}
  const rejectedBySignal: Record<string, number> = {}
  const failureReasonCounts: Record<string, number> = {}
  let hardFailCount = 0
  const draft: StrategyWorldDraftDecision[] = seedPool.map((entry) => {
    const features = getDirectionStrategyFeatures(entry)
    const signals = getStrategyContractSignals(entry, features)
    const required = evaluateSignalThresholds(signals, contractShape?.requiredSignals)
    const preferred = evaluateSignalThresholds(signals, contractShape?.preferredSignals)
    const suppressed = evaluateSignalThresholds(signals, contractShape?.suppressedSignals)
    const requiredFailedSignals = getSignalsBelowThresholds(
      signals,
      contractShape?.requiredSignals,
    )
    const suppressedTriggeredSignals = getSignalsMeetingThresholds(
      signals,
      contractShape?.suppressedSignals,
    )
    const hardGuard = evaluateStrategyHardGuard(
      strategy.id,
      signals,
      entry.profile.tasteSignals.momentPotential,
    )
    const exploratoryPartialRequiredMatch =
      strategy.id === 'exploratory_pulse' &&
      !required.pass &&
      required.score >= EXPLORATORY_REQUIRED_DEGRADE_SCORE_FLOOR &&
      hardGuard.passed
    const suppressedRejectScoreFloor =
      strategy.id === 'exploratory_pulse'
        ? EXPLORATORY_SUPPRESSED_REJECT_SCORE_FLOOR
        : 0.62
    const suppressedPenalty = suppressed.triggered
      ? toFixed(Math.max(0, suppressed.score) * STRATEGY_SUPPRESSED_PENALTY_WEIGHT)
      : 0
    const shapeScore = toFixed(
      clamp(
        entry.score * 0.7 +
          preferred.score * 0.3 -
          suppressedPenalty -
          (required.pass ? 0 : STRATEGY_REQUIRED_FAIL_PENALTY),
        0,
        1,
      ),
    )

    let status: StrategyWorldPocketStatus = 'admitted'
    let reasonSummary = 'strategy_contract_aligned'
    if (!hardGuard.passed) {
      status = 'rejected'
      reasonSummary = `hard_guard_failed:${hardGuard.reason}`
    } else if (!required.pass) {
      if (exploratoryPartialRequiredMatch) {
        status = 'suppressed'
        reasonSummary = 'required_signals_partial_match'
      } else {
        status = 'rejected'
        reasonSummary = 'required_signals_not_met'
      }
    } else if (suppressed.triggered && suppressed.score >= suppressedRejectScoreFloor) {
      status = 'rejected'
      reasonSummary = 'suppressed_blocked'
    } else if (suppressed.triggered || shapeScore < STRATEGY_MIN_ADMITTED_SCORE) {
      status = 'suppressed'
      reasonSummary = suppressed.triggered ? 'suppressed_pressure' : 'shape_score_below_floor'
    }

    if (!hardGuard.passed) {
      hardFailCount += 1
    }
    if (status === 'suppressed') {
      if (suppressedTriggeredSignals.length > 0) {
        for (const signalKey of suppressedTriggeredSignals) {
          incrementSignalCount(suppressedBySignal, signalKey)
        }
      } else {
        incrementSignalCount(suppressedBySignal, reasonSummary)
      }
      incrementSignalCount(failureReasonCounts, reasonSummary)
    }
    if (status === 'rejected') {
      if (!hardGuard.passed) {
        incrementSignalCount(rejectedBySignal, `hardGuard:${hardGuard.reason}`)
      } else if (!required.pass) {
        if (requiredFailedSignals.length > 0) {
          for (const signalKey of requiredFailedSignals) {
            incrementSignalCount(rejectedBySignal, `required:${signalKey}`)
          }
        } else {
          incrementSignalCount(rejectedBySignal, 'required:unknown')
        }
      } else if (suppressedTriggeredSignals.length > 0) {
        for (const signalKey of suppressedTriggeredSignals) {
          incrementSignalCount(rejectedBySignal, `suppressed:${signalKey}`)
        }
      } else {
        incrementSignalCount(rejectedBySignal, reasonSummary)
      }
      incrementSignalCount(failureReasonCounts, reasonSummary)
    }

    return {
      entry,
      pocketId: entry.profile.pocketId,
      status,
      requiredPass: required.pass,
      preferredScore: preferred.score,
      suppressedTriggered: suppressed.triggered,
      suppressedScore: suppressed.score,
      shapeScore,
      hardGuardPassed: hardGuard.passed,
      hardGuardReason: hardGuard.reason,
      reasonSummary,
      fallbackEligible: required.pass || exploratoryPartialRequiredMatch,
    }
  })

  const admitted = draft
    .filter((decision) => decision.status === 'admitted')
    .sort((left, right) => {
      if (right.shapeScore !== left.shapeScore) {
        return right.shapeScore - left.shapeScore
      }
      return left.entry.rank - right.entry.rank
    })
  const suppressed = draft
    .filter((decision) => decision.status === 'suppressed')
    .sort((left, right) => {
      if (right.shapeScore !== left.shapeScore) {
        return right.shapeScore - left.shapeScore
      }
      return left.entry.rank - right.entry.rank
    })
  const rejected = draft
    .filter((decision) => decision.status === 'rejected')
    .sort((left, right) => {
      if (right.shapeScore !== left.shapeScore) {
        return right.shapeScore - left.shapeScore
      }
      return left.entry.rank - right.entry.rank
    })

  let fallbackAdmittedCount = 0
  if (admitted.length < STRATEGY_MIN_ADMITTED_FOR_NO_FALLBACK) {
    const fallbackPool = [...suppressed, ...rejected]
      .filter((decision) => decision.hardGuardPassed)
      .filter((decision) => decision.fallbackEligible)
      .slice(0, STRATEGY_WORLD_MAX_FALLBACK_ADMITS)
    for (const decision of fallbackPool) {
      decision.status = 'fallback_admitted'
      decision.reasonSummary = `${decision.reasonSummary}|fallback_for_strategy_survival`
      admitted.push(decision)
      fallbackAdmittedCount += 1
    }
  }

  admitted.sort((left, right) => {
    if (right.shapeScore !== left.shapeScore) {
      return right.shapeScore - left.shapeScore
    }
    return left.entry.rank - right.entry.rank
  })

  const suppressedPockets = draft
    .filter((decision) => decision.status === 'suppressed')
    .map((decision) => decision.entry)
  const rejectedPockets = draft
    .filter((decision) => decision.status === 'rejected')
    .map((decision) => decision.entry)
  const admittedPockets = admitted.map((decision) => decision.entry)

  const decisionByPocketId = draft.reduce<Record<string, StrategyWorldPocketDecision>>(
    (accumulator, decision) => {
      accumulator[decision.pocketId] = {
        pocketId: decision.pocketId,
        status: decision.status,
        requiredPass: decision.requiredPass,
        preferredScore: decision.preferredScore,
        suppressedTriggered: decision.suppressedTriggered,
        suppressedScore: decision.suppressedScore,
        shapeScore: decision.shapeScore,
        hardGuardPassed: decision.hardGuardPassed,
        hardGuardReason: decision.hardGuardReason,
        reasonSummary: decision.reasonSummary,
      }
      return accumulator
    },
    {},
  )

  const hardRequirementResults = draft.map((decision) => ({
    pocketId: decision.pocketId,
    passed: decision.requiredPass && decision.hardGuardPassed,
    reasons:
      decision.requiredPass && decision.hardGuardPassed
        ? ['pass']
        : [
            decision.requiredPass ? undefined : 'required_signals_not_met',
            decision.hardGuardPassed ? undefined : decision.hardGuardReason,
          ].filter((reason): reason is string => Boolean(reason)),
  }))

  const decisionLog = draft.map((decision) => ({
    pocketId: decision.pocketId,
    status:
      decision.status === 'fallback_admitted'
        ? 'admitted'
        : decision.status,
    scoreSummary: `shape=${decision.shapeScore.toFixed(3)}|required=${
      decision.requiredPass ? 'pass' : 'fail'
    }|preferred=${decision.preferredScore.toFixed(3)}|suppressed=${decision.suppressedScore.toFixed(3)}`,
    reasonSummary: decision.reasonSummary,
  }))
  const topFailureReasons = Object.entries(failureReasonCounts)
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1]
      }
      return left[0].localeCompare(right[0])
    })
    .slice(0, 5)
    .map(([reason, count]) => `${reason}:${count}`)
  const survivabilityStatus: StrategyAdmissibleWorld['debug']['survivabilityStatus'] =
    admittedPockets.length >= 3 ? 'viable' : admittedPockets.length >= 1 ? 'weak' : 'collapsed'
  const sampleDecisions: StrategyAdmissibleWorld['debug']['sampleDecisions'] = decisionLog
    .slice(0, 5)
    .map((decision) => ({
      pocketId: decision.pocketId,
      status: decision.status,
      reasonSummary: decision.reasonSummary,
    }))

  return {
    strategyId: strategy.id,
    strategyLabel: strategy.label,
    strategySummary: strategy.summary,
    strategyFamily: strategy.family,
    source: 'bearings.strategy_admissible_world',
    admittedPockets,
    suppressedPockets,
    rejectedPockets,
    hardRequirementResults,
    decisionLog,
    decisionByPocketId,
    summary: `${strategy.label}: admitted ${admittedPockets.length}, suppressed ${suppressedPockets.length}, rejected ${rejectedPockets.length}`,
    debug: {
      admittedCount: admittedPockets.length,
      suppressedCount: suppressedPockets.length,
      rejectedCount: rejectedPockets.length,
      fallbackAdmittedCount,
      totalInputCount: seedPool.length,
      hardFailCount,
      suppressedBySignal,
      rejectedBySignal,
      topFailureReasons,
      survivabilityStatus,
      sampleDecisions,
      allowedPreview: formatPreview(admittedPockets),
      suppressedPreview: formatPreview(suppressedPockets),
      rejectedPreview: formatPreview(rejectedPockets),
      greatStopQuality,
    },
  }
}

export function buildStrategyAdmissibleWorlds(
  input: BuildStrategyAdmissibleWorldsInput,
): StrategyAdmissibleWorld[] {
  // Canonical bearings seam: strategy worlds must be derived from ContractGateWorld, never raw pockets.
  console.assert(
    input.contractGateWorld.debug.contractGateWorldPresent === true,
    '[ARC-BOUNDARY] strategy admissible worlds require a canonical ContractGateWorld.',
  )
  const strategies = resolveDirectionStrategiesForFamily(input.strategyFamily)
  if (strategies.length === 0) {
    return []
  }
  const ranked = input.contractGateWorld.admittedPockets
  return strategies.map((strategy) => {
    const world = buildStrategyWorld(
      strategy,
      ranked,
      input.contractGateWorld.debug.greatStopQuality,
    )
    if (input.strategySummary) {
      world.summary = `${input.strategySummary} | ${world.summary}`
    }
    return world
  })
}
