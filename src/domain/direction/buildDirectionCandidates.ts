import type {
  DistrictDebugTrace,
  DistrictOpportunityProfile,
  RankedPocket,
} from '../../engines/district/types/districtTypes'
import type {
  ContractConstraints,
  ExperienceContract,
  PersonaMode,
  VibeAnchor,
} from '../types/intent'
import {
  detectExperienceFamily,
  type ExperienceFamily,
} from '../directions/detectExperienceFamily'
import { type ContractGateWorld } from '../bearings/buildContractGateWorld'
import {
  type DirectionStrategyFamily as BearingsDirectionStrategyFamily,
  type DirectionStrategyId as BearingsDirectionStrategyId,
  type DirectionStrategyAnchorShape,
  type DirectionStrategyDensityShape,
  resolveDirectionStrategiesForFamily,
  type DirectionStrategyDefinition,
  type DirectionStrategyExplorationShape,
  type DirectionStrategyPeakShape,
  type DirectionStrategySocialShape,
  type StrategyAdmissibleWorld,
} from '../bearings/buildStrategyAdmissibleWorlds'

export type DirectionCluster = 'lively' | 'chill' | 'explore'
export type DirectionArchetype = 'lively' | 'chill' | 'cultural' | 'social'
export type DirectionLaneIdentity =
  | 'lively_core'
  | 'lively_arts'
  | 'cozy_neighborhood'
  | 'cultured_compact'
  | 'social_mixed'
  | 'calm_upscale'
  | 'outdoor_adjacent'
  | 'district_core'
  | 'neighborhood_pocket'
export type DirectionMomentumProfile =
  | 'fast_build'
  | 'steady_build'
  | 'soft_start'
  | 'focused_flow'
  | 'late_pull'
export type DirectionNarrativeMode =
  | 'intimate_centerpiece'
  | 'pulse_multi_peak'
  | 'cultural_arc'
  | 'group_momentum'
  | 'group_distributed'
  | 'family_enrichment'
  | 'family_play'
  | 'family_balanced'
  | 'contract_adaptive'
  | 'legacy_adaptive'
export type DirectionMacroLane =
  | 'lively'
  | 'cozy'
  | 'cultured'
  | 'neighborhood'
  | 'social_mixed'
  | 'calm'
export type DirectionStrategyFamily = BearingsDirectionStrategyFamily
export type DirectionStrategyId = BearingsDirectionStrategyId

export interface StrategyConstraintStatus {
  required: 'pass' | 'fail'
  preferred: number
  suppressed: 'triggered' | 'not_triggered'
}

export interface DirectionContrastProfile {
  laneIdentity: DirectionLaneIdentity
  macroLane: DirectionMacroLane
  districtIdentityStrength: number
  momentumProfile: DirectionMomentumProfile
  contrastEligible: boolean
  contrastReason?: string
}

export interface DirectionCandidate {
  id: string
  label: string
  subtitle: string
  supportLine: string
  archetype: DirectionArchetype
  cluster: DirectionCluster
  pocketId: string
  pocketLabel: string
  directionExperienceIdentity: string
  directionPrimaryIdentitySource: string
  directionPeakModel: string
  directionMovementStyle: string
  directionDistrictSupportSummary: string
  directionStrategyId: DirectionStrategyId
  directionStrategyLabel: string
  directionStrategyFamily: DirectionStrategyFamily
  directionStrategySummary: string
  directionStrategySource: string
  directionCollapseGuardApplied: boolean
  directionStrategyOverlapSummary: string
  strategyConstraintStatus?: StrategyConstraintStatus
  strategyPoolSize?: number
  strategyRejectedCount?: number
  strategyHardGuardStatus?: 'pass' | 'degraded'
  strategyHardGuardReason?: string
  contractGateApplied?: boolean
  contractGateSummary?: string
  contractGateStrengthSummary?: string
  contractGateRejectedCount?: number
  contractGateAllowedPreview?: string[]
  contractGateSuppressedPreview?: string[]
  directionContractGateStatus?: string
  directionContractGateReasonSummary?: string
  strategyWorldSource?: string
  selectedStrategyWorldId?: string
  strategyWorldSummary?: string
  strategyWorldAdmittedCount?: number
  strategyWorldSuppressedCount?: number
  strategyWorldRejectedCount?: number
  strategyWorldAllowedPreview?: string
  strategyWorldSuppressedPreview?: string
  directionStrategyWorldDebug?: StrategyAdmissibleWorld['debug']
  directionStrategyWorldStatus?: string
  directionStrategyWorldReasonSummary?: string
  directionNarrativeSource: string
  directionNarrativeMode: DirectionNarrativeMode
  directionNarrativeSummary: string
  directionNarrativeSupport: string
  confidence: number
  reasons: string[]
  highlights: string[]
  nearbyExamples: string[]
  contrastProfile: DirectionContrastProfile
  experienceFamily: ExperienceFamily
  familyConfidence: number
  richnessDebug?: {
    richnessBoostApplied: number
    similarityPenaltyApplied: number
    composedCandidateAccepted?: boolean
    composedCandidateRejected?: boolean
    richnessContrastReason?: string
  }
  derivedFrom: {
    experientialTags: string[]
    ambianceProfile: DistrictOpportunityProfile['tasteSignals']['ambianceProfile']
    hospitalityMix: DistrictOpportunityProfile['tasteSignals']['hospitalityMix']
    momentSeeds: string[]
    momentPotential: number
    hyperlocal?: DistrictOpportunityProfile['hyperlocal']
  }
}

type BuildDirectionCandidatesInput = {
  ranked: RankedPocket[]
  debug?: DistrictDebugTrace
  candidatePoolLimit?: number
  contractGateWorld: ContractGateWorld
  strategyAdmissibleWorlds: StrategyAdmissibleWorld[]
  context?: {
    persona?: PersonaMode
    vibe?: VibeAnchor
    experienceContract?: ExperienceContract
    contractConstraints?: ContractConstraints
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function toFixed(value: number): number {
  return Number(clamp(value, 0, 1).toFixed(3))
}

function toTitleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const DEFAULT_CANDIDATE_POOL_LIMIT = 10
const MIN_CANDIDATE_POOL_LIMIT = 3
const MAX_CANDIDATE_POOL_LIMIT = 12
const TARGET_DIRECTION_CANDIDATES = 3
const MAX_COMPOSED_CANDIDATES = 1
const MIN_BASELINE_VIABILITY = 0.42
const MIN_BASELINE_CONFIDENCE = 0.45
const COMPOSED_MAX_DISTANCE_M = 2400
const COMPOSED_MIN_IDENTITY_OVERLAP = 0.34
const MIN_RICHNESS_GAIN = 0.06
const RICHNESS_SIMILARITY_BLOCK = 0.86
const MIN_COMPOSED_FAMILY_CONFIDENCE = 0.52
const STRATEGY_OVERLAP_BLOCK = 0.66
const STRATEGY_POOL_WINDOW = 18

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

function getDominantMixKey(
  mix: DistrictOpportunityProfile['tasteSignals']['hospitalityMix'],
): keyof DistrictOpportunityProfile['tasteSignals']['hospitalityMix'] {
  return (Object.entries(mix).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1]
    }
    return left[0].localeCompare(right[0])
  })[0]?.[0] ?? 'activity') as keyof DistrictOpportunityProfile['tasteSignals']['hospitalityMix']
}

function deriveArchetype(
  profile: DistrictOpportunityProfile,
): DirectionArchetype {
  const mix = profile.tasteSignals.hospitalityMix
  const tags = new Set(profile.tasteSignals.experientialTags)
  const ambiance = profile.tasteSignals.ambianceProfile
  const dominantMix = getDominantMixKey(mix)

  if (
    tags.has('arts-adjacent') &&
    (tags.has('mixed-program') ||
      profile.tasteSignals.momentSeeds.some((seed) =>
        seed.toLowerCase().includes('gallery -> wine bar'),
      ))
  ) {
    return 'cultural'
  }
  if (
    (ambiance.energy === 'high' || tags.has('lively')) &&
    (mix.drinks >= 0.24 || mix.activity >= 0.3)
  ) {
    return 'lively'
  }
  if (
    (ambiance.energy === 'low' || ambiance.noise === 'low') &&
    (mix.cafe + mix.dining >= 0.42)
  ) {
    return 'chill'
  }
  if (
    dominantMix === 'drinks' ||
    dominantMix === 'activity' ||
    mix.drinks + mix.activity >= 0.5
  ) {
    return 'social'
  }
  if (mix.cafe + mix.dining >= 0.46) {
    return 'chill'
  }
  return 'cultural'
}

function getPreferredCluster(archetype: DirectionArchetype): DirectionCluster {
  if (archetype === 'chill') {
    return 'chill'
  }
  if (archetype === 'cultural') {
    return 'explore'
  }
  return 'lively'
}

function resolveCandidatePoolLimit(
  requestedLimit: number | undefined,
  availableCount: number,
): number {
  if (availableCount <= 0) {
    return 0
  }

  const normalizedRequested =
    typeof requestedLimit === 'number' && Number.isFinite(requestedLimit)
      ? Math.floor(requestedLimit)
      : DEFAULT_CANDIDATE_POOL_LIMIT
  const boundedRequested = clamp(
    normalizedRequested,
    MIN_CANDIDATE_POOL_LIMIT,
    MAX_CANDIDATE_POOL_LIMIT,
  )
  return Math.min(availableCount, boundedRequested)
}

function buildLabel(archetype: DirectionArchetype, pocketLabel: string): string {
  const cleanedPocketLabel = pocketLabel.replace(/\s+pocket$/i, '').trim()
  if (archetype === 'lively') {
    return `Playful ${cleanedPocketLabel}`
  }
  if (archetype === 'chill') {
    return `Easy ${cleanedPocketLabel}`
  }
  if (archetype === 'social') {
    return `Social ${cleanedPocketLabel}`
  }
  return `Curated ${cleanedPocketLabel}`
}

function buildSubtitle(
  archetype: DirectionArchetype,
  profile: DistrictOpportunityProfile,
): string {
  const dominantMix = getDominantMixKey(profile.tasteSignals.hospitalityMix)
  const energy = profile.tasteSignals.ambianceProfile.energy
  return `${toTitleCase(archetype)} direction from ${profile.label} (${energy} energy, ${dominantMix}-leaning).`
}

function getStrategyDensityTargetValue(shape: DirectionStrategyDensityShape): number {
  if (shape === 'low') {
    return 0.28
  }
  if (shape === 'medium') {
    return 0.5
  }
  if (shape === 'medium_high') {
    return 0.68
  }
  return 0.84
}

function getStrategyExplorationTargetValue(shape: DirectionStrategyExplorationShape): number {
  if (shape === 'low') {
    return 0.28
  }
  if (shape === 'medium') {
    return 0.56
  }
  return 0.82
}

function getSocialShapeTargetValue(shape: DirectionStrategySocialShape): number {
  if (shape === 'intimate') {
    return 0.24
  }
  if (shape === 'balanced') {
    return 0.5
  }
  if (shape === 'social') {
    return 0.82
  }
  return 0.42
}

function getAnchorShapeTargetValue(shape: DirectionStrategyAnchorShape): number {
  if (shape === 'distributed') {
    return 0.42
  }
  if (shape === 'moderate') {
    return 0.62
  }
  return 0.84
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

function getPeakShapeTargetValue(shape: DirectionStrategyPeakShape): number {
  if (shape === 'single') {
    return 0.78
  }
  if (shape === 'multi') {
    return 0.72
  }
  if (shape === 'cumulative') {
    return 0.64
  }
  return 0.5
}

function getPeakModelStrength(peakModel: string): number {
  if (peakModel === 'single-peak') {
    return 0.78
  }
  if (peakModel === 'multi-peak') {
    return 0.72
  }
  if (peakModel === 'cumulative') {
    return 0.64
  }
  return 0.5
}

function getMovementShapeFit(
  strategy: DirectionStrategyDefinition,
  features: DirectionStrategyFeatures,
): number {
  if (strategy.movementShape === 'contained') {
    return clamp(features.compactness * 0.7 + features.walkability * 0.3, 0, 1)
  }
  if (strategy.movementShape === 'exploratory') {
    return clamp(features.explorationPotential * 0.75 + (1 - features.compactness) * 0.25, 0, 1)
  }
  if (strategy.movementShape === 'anchored') {
    return clamp(features.anchorPotential * 0.7 + features.compactness * 0.3, 0, 1)
  }
  return clamp(1 - Math.abs(features.compactness - 0.56) * 1.7, 0, 1)
}

function getDistanceFit(current: number, target: number): number {
  return clamp(1 - Math.abs(current - target) * 1.9, 0, 1)
}

function getStrategyKeywordBonus(
  strategy: DirectionStrategyDefinition,
  features: DirectionStrategyFeatures,
): number {
  const id = strategy.id
  let bonus = 0
  if (id.includes('exploratory') || id.includes('roaming') || id.includes('wandering') || id.includes('roam')) {
    bonus += features.explorationPotential * 0.08
  }
  if (id.includes('anchor')) {
    bonus += features.anchorPotential * 0.08
  }
  if (id.includes('contained') || id.includes('intimate') || id.includes('clustered') || id.includes('reset')) {
    bonus += features.compactness * 0.07 + features.calmness * 0.04
  }
  if (id.includes('scenic') || id.includes('reflective')) {
    bonus += features.scenicPotential * 0.08 + features.culturalPotential * 0.03
  }
  if (id.includes('culture') || id.includes('learning') || id.includes('enrichment') || id.includes('discussion')) {
    bonus += features.culturalPotential * 0.1
  }
  if (id.includes('group') || id.includes('social') || id.includes('crawl') || id.includes('basecamp')) {
    bonus += features.socialDensity * 0.07
  }
  if (id.includes('family') || id.includes('dual_track')) {
    bonus += features.familyPotential * 0.09
  }
  return clamp(bonus, 0, 0.18)
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

function getStrategyContractMatch(
  strategy: DirectionStrategyDefinition,
  context: BuildDirectionCandidatesInput['context'],
): number {
  const constraints = context?.contractConstraints
  if (!constraints) {
    return 0.5
  }
  const peakMatch = constraints.peakCountModel === strategy.peakShape ? 1 : 0
  const densityTarget: DirectionStrategyDensityShape =
    constraints.socialDensityBand === 'high'
      ? 'high'
      : constraints.socialDensityBand === 'medium_high'
        ? 'medium_high'
        : constraints.socialDensityBand === 'medium'
          ? 'medium'
          : 'low'
  const densityMatch = densityTarget === strategy.densityShape ? 1 : 0
  const movementMatch =
    (constraints.movementTolerance === 'contained' && strategy.movementShape === 'contained') ||
    (constraints.movementTolerance === 'exploratory' && strategy.movementShape === 'exploratory') ||
    (constraints.movementTolerance === 'moderate' && strategy.movementShape === 'balanced') ||
    (constraints.movementTolerance === 'compressed' && (strategy.movementShape === 'contained' || strategy.movementShape === 'anchored'))
      ? 1
      : 0
  return clamp(peakMatch * 0.45 + densityMatch * 0.3 + movementMatch * 0.25, 0, 1)
}

function scoreEntryForStrategy(params: {
  entry: RankedPocket
  candidate: DirectionCandidate
  strategy: DirectionStrategyDefinition
  context: BuildDirectionCandidatesInput['context']
}): number {
  const { entry, candidate, strategy, context } = params
  const features = getDirectionStrategyFeatures(entry)
  const movementFit = getMovementShapeFit(strategy, features)
  const densityFit = getDistanceFit(features.socialDensity, getStrategyDensityTargetValue(strategy.densityShape))
  const socialFit = getDistanceFit(features.socialDensity, getSocialShapeTargetValue(strategy.socialShape))
  const explorationFit = getDistanceFit(
    features.explorationPotential,
    getStrategyExplorationTargetValue(strategy.explorationShape),
  )
  const anchorValue =
    strategy.anchorShape === 'distributed'
      ? features.distributedPotential
      : features.anchorPotential
  const anchorFit = getDistanceFit(anchorValue, getAnchorShapeTargetValue(strategy.anchorShape))
  const peakFit = getDistanceFit(
    getPeakModelStrength(candidate.directionPeakModel),
    getPeakShapeTargetValue(strategy.peakShape),
  )
  const contractMatch = getStrategyContractMatch(strategy, context)
  const keywordBonus = getStrategyKeywordBonus(strategy, features)
  const base = clamp(
    candidate.confidence * 0.44 +
      entry.score * 0.16 +
      movementFit * 0.11 +
      densityFit * 0.08 +
      socialFit * 0.06 +
      explorationFit * 0.07 +
      anchorFit * 0.08 +
      peakFit * 0.04 +
      contractMatch * 0.06 +
      keywordBonus,
    0,
    1,
  )
  return toFixed(base)
}

function getDirectionPeakModelLabel(
  experienceContract: ExperienceContract | undefined,
  contractConstraints: ContractConstraints | undefined,
): string {
  const model = contractConstraints?.peakCountModel ?? experienceContract?.highlightModel
  if (!model) {
    return 'adaptive-peak'
  }
  if (model === 'single' || model === 'single_peak') {
    return 'single-peak'
  }
  if (model === 'multi' || model === 'multi_peak') {
    return 'multi-peak'
  }
  if (model === 'cumulative') {
    return 'cumulative'
  }
  return 'distributed'
}

function getDirectionMovementStyleLabel(
  experienceContract: ExperienceContract | undefined,
  contractConstraints: ContractConstraints | undefined,
): string {
  const movement = contractConstraints?.movementTolerance ?? experienceContract?.movementStyle
  if (!movement) {
    return 'balanced movement'
  }
  if (movement === 'contained') {
    return 'contained movement'
  }
  if (movement === 'compressed') {
    return 'low-friction movement'
  }
  if (movement === 'moderate') {
    return 'moderate movement'
  }
  if (movement === 'exploratory') {
    return 'exploratory movement'
  }
  if (movement === 'momentum') {
    return 'momentum movement'
  }
  if (movement === 'curated_progression') {
    return 'curated progression'
  }
  return 'balanced movement'
}

function getMovementIdentityPrefix(
  experienceContract: ExperienceContract | undefined,
  contractConstraints: ContractConstraints | undefined,
): string {
  const movement = contractConstraints?.movementTolerance ?? experienceContract?.movementStyle
  if (movement === 'contained') {
    return 'Contained'
  }
  if (movement === 'compressed') {
    return 'Low-friction'
  }
  if (movement === 'exploratory') {
    return 'Exploratory'
  }
  if (movement === 'momentum') {
    return 'Momentum'
  }
  if (movement === 'curated_progression') {
    return 'Curated'
  }
  return 'Balanced'
}

function getExperienceSubjectToken(experienceContract: ExperienceContract | undefined): string {
  const posture = experienceContract?.socialPosture
  if (posture === 'family_unit' || posture === 'parallel_tracks') {
    return 'family'
  }
  if (posture === 'group_internal' || posture === 'social') {
    return 'group'
  }
  if (posture === 'intimate') {
    return 'romantic'
  }
  return 'social'
}

function getExperienceCorePhrase(
  experienceContract: ExperienceContract | undefined,
  contractConstraints: ContractConstraints | undefined,
): string {
  const mode = experienceContract?.coordinationMode
  const peakModel = getDirectionPeakModelLabel(experienceContract, contractConstraints)
  if (mode === 'depth') {
    return 'centerpiece'
  }
  if (mode === 'pulse') {
    return 'pulse night'
  }
  if (mode === 'narrative') {
    return 'cultural arc'
  }
  if (mode === 'hang') {
    return 'hang loop'
  }
  if (mode === 'momentum') {
    return 'momentum crawl'
  }
  if (mode === 'enrichment') {
    return 'enrichment arc'
  }
  if (mode === 'balance') {
    return 'reset loop'
  }
  if (mode === 'play') {
    return 'play loop'
  }
  if (peakModel === 'single-peak') {
    return 'centerpiece night'
  }
  if (peakModel === 'multi-peak') {
    return 'peak run'
  }
  if (peakModel === 'cumulative') {
    return 'story arc'
  }
  return 'social loop'
}

function compactTitle(value: string, maxWords = 5): string {
  const words = value
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, maxWords)
  if (words.length === 0) {
    return 'Local experience'
  }
  const normalized = words.join(' ').replace(/\s+/g, ' ')
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function deriveDirectionExperienceIdentity(params: {
  profile: DistrictOpportunityProfile
  experienceContract?: ExperienceContract
  contractConstraints?: ContractConstraints
  strategy?: DirectionStrategyDefinition
}): {
  identity: string
  primaryIdentitySource: string
} {
  const { experienceContract, contractConstraints, strategy } = params
  if (strategy) {
    return {
      identity: strategy.label,
      primaryIdentitySource: `strategy:${strategy.id}|family:${strategy.family}`,
    }
  }
  if (!experienceContract || !contractConstraints) {
    return {
      identity: buildLabel(deriveArchetype(params.profile), params.profile.label),
      primaryIdentitySource: 'legacy_pocket_label',
    }
  }

  const movementPrefix = getMovementIdentityPrefix(experienceContract, contractConstraints)
  const subject = getExperienceSubjectToken(experienceContract)
  const core = getExperienceCorePhrase(experienceContract, contractConstraints)
  const coreLower = core.toLowerCase()
  const includeMovement =
    !(movementPrefix.toLowerCase() === 'momentum' && coreLower.includes('momentum'))
  const includeSubject = !coreLower.includes(subject)
  const tokens = [
    includeMovement ? movementPrefix : undefined,
    includeSubject ? subject : undefined,
    core,
  ].filter((value): value is string => Boolean(value))

  return {
    identity: compactTitle(tokens.join(' ')),
    primaryIdentitySource: `contract:${experienceContract.coordinationMode}|peak:${contractConstraints.peakCountModel}|movement:${contractConstraints.movementTolerance}`,
  }
}

function getSocialDensityBandSupport(
  socialDensity: number,
  band: ContractConstraints['socialDensityBand'] | undefined,
): string {
  if (!band) {
    return socialDensity >= 0.66 ? 'socially active pocket' : 'steady social density'
  }
  if (band === 'low') {
    return socialDensity <= 0.5 ? 'lower-density pocket' : 'density kept in check'
  }
  if (band === 'medium') {
    return socialDensity >= 0.36 && socialDensity <= 0.72
      ? 'balanced social density'
      : 'mid-density support'
  }
  if (band === 'medium_high') {
    return socialDensity >= 0.54 ? 'higher social density support' : 'rising social density'
  }
  return socialDensity >= 0.68 ? 'high-density social pocket' : 'social density building'
}

function getMovementSupport(profile: DistrictOpportunityProfile): string {
  if (profile.radiusM <= 170 && profile.coreSignals.walkability >= 0.6) {
    return 'short moves across clustered stops'
  }
  if (profile.radiusM <= 220 && profile.coreSignals.walkability >= 0.5) {
    return 'moderate transitions stay coherent'
  }
  if (profile.radiusM > 260) {
    return 'wider spread supports exploratory pacing'
  }
  return 'district layout supports steady flow'
}

function getPeakSupport(
  profile: DistrictOpportunityProfile,
  experienceContract: ExperienceContract | undefined,
  contractConstraints: ContractConstraints | undefined,
): string {
  const peakModel = getDirectionPeakModelLabel(experienceContract, contractConstraints)
  const momentPotential = profile.tasteSignals.momentPotential
  const mix = profile.tasteSignals.hospitalityMix
  if (peakModel === 'single-peak') {
    return momentPotential >= 0.62 || mix.dining + mix.culture >= 0.5
      ? 'clear centerpiece runway'
      : 'single-peak center support'
  }
  if (peakModel === 'multi-peak') {
    return momentPotential >= 0.58 || mix.drinks + mix.activity >= 0.5
      ? 'multiple peak options'
      : 'multi-peak sequencing support'
  }
  if (peakModel === 'cumulative') {
    return mix.culture >= 0.2 ? 'layered cultural progression' : 'cumulative arc support'
  }
  return mix.activity + mix.drinks + mix.cafe >= 0.58
    ? 'distributed anchor coverage'
    : 'distributed peak flexibility'
}

function getContractFitSignal(entry: RankedPocket): string | undefined {
  const fitReason = entry.reasons.find((reason) => reason.startsWith('Contract fit '))
  if (!fitReason) {
    return undefined
  }
  return fitReason.replace(/^Contract fit\s*/i, '').trim()
}

function deriveDirectionDistrictSupportSummary(params: {
  entry: RankedPocket
  experienceContract?: ExperienceContract
  contractConstraints?: ContractConstraints
  strategy?: DirectionStrategyDefinition
}): string {
  const { entry, experienceContract, contractConstraints, strategy } = params
  const profile = entry.profile
  const movementSupport = getMovementSupport(profile)
  const peakSupport = getPeakSupport(profile, experienceContract, contractConstraints)
  const densitySupport = getSocialDensityBandSupport(
    profile.tasteSignals.ambianceProfile.energy === 'high'
      ? Math.max(profile.tasteSignals.hospitalityMix.drinks + profile.tasteSignals.hospitalityMix.activity, 0.62)
      : profile.tasteSignals.hospitalityMix.drinks + profile.tasteSignals.hospitalityMix.activity,
    contractConstraints?.socialDensityBand,
  )
  const contractFitSignal = getContractFitSignal(entry)
  const supportParts = [
    strategy?.summary ? truncateStrategySummary(strategy.summary) : undefined,
    movementSupport,
    peakSupport,
    contractConstraints?.requireRecoveryWindows ? 'recovery-compatible cadence' : densitySupport,
    contractFitSignal,
  ].filter((value): value is string => Boolean(value))
  return supportParts.slice(0, 3).join(', ')
}

function truncateStrategySummary(summary: string): string {
  const normalized = summary.replace(/\s+/g, ' ').trim()
  if (normalized.length <= 66) {
    return normalized
  }
  return `${normalized.slice(0, 63)}...`
}

function deriveDirectionSubtitle(params: {
  profile: DistrictOpportunityProfile
  districtSupportSummary: string
}): string {
  return `${params.profile.label} | ${params.districtSupportSummary}`
}

function getNarrativePeakPhrase(peakModel: string): string {
  if (peakModel === 'single-peak') {
    return 'earned centerpiece'
  }
  if (peakModel === 'multi-peak') {
    return 'multiple peaks'
  }
  if (peakModel === 'cumulative') {
    return 'cumulative progression'
  }
  return 'distributed peaks'
}

function getNarrativeMovementPhrase(movementStyle: string): string {
  if (movementStyle === 'contained movement') {
    return 'contained movement'
  }
  if (movementStyle === 'low-friction movement') {
    return 'clustered low-friction movement'
  }
  if (movementStyle === 'exploratory movement') {
    return 'exploratory movement'
  }
  if (movementStyle === 'moderate movement') {
    return 'moderate movement'
  }
  if (movementStyle === 'momentum movement') {
    return 'momentum-led movement'
  }
  if (movementStyle === 'curated progression') {
    return 'curated progression'
  }
  return 'balanced movement'
}

function getNarrativeLandingPhrase(
  contractConstraints: ContractConstraints | undefined,
): string {
  if (!contractConstraints) {
    return 'controlled landing'
  }
  if (contractConstraints.windDownStrictness === 'soft_required') {
    return 'soft landing'
  }
  if (contractConstraints.windDownStrictness === 'controlled') {
    return contractConstraints.allowLateHighEnergy ? 'controlled late taper' : 'controlled taper'
  }
  return 'flexible close'
}

function formatActToken(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((token) => token.toLowerCase())
    .join(' ')
}

function getNarrativeActEdge(
  experienceContract: ExperienceContract | undefined,
): string | undefined {
  const actPattern = experienceContract?.actStructure.actPattern ?? []
  if (actPattern.length < 2) {
    return undefined
  }
  const first = formatActToken(actPattern[0])
  const last = formatActToken(actPattern[actPattern.length - 1])
  return `${first} -> ${last}`
}

function deriveDirectionNarrativeMode(params: {
  experienceContract: ExperienceContract | undefined
  contractConstraints: ContractConstraints | undefined
}): DirectionNarrativeMode {
  const { experienceContract, contractConstraints } = params
  if (!experienceContract || !contractConstraints) {
    return 'legacy_adaptive'
  }

  const familyPosture =
    experienceContract.socialPosture === 'family_unit' ||
    experienceContract.socialPosture === 'parallel_tracks'
  const groupPosture =
    experienceContract.socialPosture === 'group_internal' ||
    experienceContract.socialPosture === 'social'

  if (
    experienceContract.socialPosture === 'intimate' &&
    contractConstraints.peakCountModel === 'single'
  ) {
    return 'intimate_centerpiece'
  }
  if (
    groupPosture && experienceContract.coordinationMode === 'momentum'
  ) {
    return 'group_momentum'
  }
  if (
    contractConstraints.peakCountModel === 'multi' &&
    contractConstraints.requireEscalation
  ) {
    return 'pulse_multi_peak'
  }
  if (
    groupPosture &&
    (experienceContract.coordinationMode === 'hang' ||
      contractConstraints.peakCountModel === 'distributed')
  ) {
    return 'group_distributed'
  }
  if (
    experienceContract.coordinationMode === 'narrative' ||
    (experienceContract.coordinationMode === 'enrichment' && !familyPosture) ||
    contractConstraints.peakCountModel === 'cumulative'
  ) {
    return familyPosture ? 'family_enrichment' : 'cultural_arc'
  }
  if (familyPosture && experienceContract.coordinationMode === 'play') {
    return 'family_play'
  }
  if (familyPosture) {
    return 'family_balanced'
  }
  return 'contract_adaptive'
}

function deriveDirectionNarrativeSummary(params: {
  experienceContract: ExperienceContract | undefined
  contractConstraints: ContractConstraints | undefined
  directionPeakModel: string
  directionMovementStyle: string
  directionExperienceIdentity: string
  directionDistrictSupportSummary: string
  strategy?: DirectionStrategyDefinition
}): {
  source: string
  mode: DirectionNarrativeMode
  summary: string
  support: string
} {
  const {
    experienceContract,
    contractConstraints,
    directionPeakModel,
    directionMovementStyle,
    directionExperienceIdentity,
    directionDistrictSupportSummary,
    strategy,
  } = params
  const mode = deriveDirectionNarrativeMode({
    experienceContract,
    contractConstraints,
  })
  const peakPhrase = getNarrativePeakPhrase(directionPeakModel)
  const movementPhrase = getNarrativeMovementPhrase(directionMovementStyle)
  const landingPhrase = getNarrativeLandingPhrase(contractConstraints)
  const socialDensityPhrase =
    contractConstraints?.socialDensityBand === 'high' ||
    contractConstraints?.socialDensityBand === 'medium_high'
      ? 'rising social density'
      : contractConstraints?.socialDensityBand === 'low'
        ? 'lower social density'
        : 'balanced social density'
  const recoveryPhrase = contractConstraints?.requireRecoveryWindows
    ? 'recovery windows built in'
    : 'continuity held between stops'
  const actEdge = getNarrativeActEdge(experienceContract)
  const actPhrase = actEdge ? `Act flow: ${actEdge}.` : ''
  const support = `${directionDistrictSupportSummary}. ${actPhrase}`.trim()
  const strategyPrefix = strategy ? `${strategy.summary} ` : ''

  if (mode === 'intimate_centerpiece') {
    return {
      source: 'contract_constraints:intimate_centerpiece',
      mode,
      summary: `${strategyPrefix}Earned centerpiece with ${movementPhrase}, ${landingPhrase}, and intimate continuity.`.trim(),
      support,
    }
  }
  if (mode === 'pulse_multi_peak') {
    return {
      source: 'contract_constraints:pulse_multi_peak',
      mode,
      summary: `${strategyPrefix}${peakPhrase} with stronger pulse, ${socialDensityPhrase}, and ${landingPhrase}.`.trim(),
      support,
    }
  }
  if (mode === 'group_momentum') {
    return {
      source: 'contract_constraints:group_momentum',
      mode,
      summary: `${strategyPrefix}Group momentum route with ${peakPhrase}, basecamp handoffs, crawl-capable flow, and ${landingPhrase}.`.trim(),
      support,
    }
  }
  if (mode === 'group_distributed') {
    return {
      source: 'contract_constraints:group_distributed',
      mode,
      summary: `${strategyPrefix}Distributed group anchors with ${movementPhrase} and flexible social carry-forward.`.trim(),
      support,
    }
  }
  if (mode === 'family_enrichment') {
    return {
      source: 'contract_constraints:family_enrichment',
      mode,
      summary: `${strategyPrefix}Structured enrichment arc with clustered movement, dual-track value, learning anchors, and decompression built in.`.trim(),
      support,
    }
  }
  if (mode === 'family_play') {
    return {
      source: 'contract_constraints:family_play',
      mode,
      summary: `${strategyPrefix}Active family loop with ${movementPhrase}, engagement peaks, and ${recoveryPhrase}.`.trim(),
      support,
    }
  }
  if (mode === 'family_balanced') {
    return {
      source: 'contract_constraints:family_balanced',
      mode,
      summary: `${strategyPrefix}Balanced family flow with ${peakPhrase}, ${movementPhrase}, and ${recoveryPhrase}.`.trim(),
      support,
    }
  }
  if (mode === 'cultural_arc') {
    return {
      source: 'contract_constraints:cultural_arc',
      mode,
      summary: `${strategyPrefix}Reflective cultural arc with ${peakPhrase}, ${movementPhrase}, and ${landingPhrase}.`.trim(),
      support,
    }
  }
  if (mode === 'contract_adaptive') {
    return {
      source: 'contract_constraints:adaptive',
      mode,
      summary: `${strategyPrefix}${directionExperienceIdentity} with ${peakPhrase}, ${movementPhrase}, and ${landingPhrase}.`.trim(),
      support,
    }
  }

  return {
    source: 'legacy_adaptive',
    mode,
    summary: `${strategyPrefix}${directionExperienceIdentity} shaped by local fit and stable pacing.`.trim(),
    support,
  }
}

function buildReasons(profile: DistrictOpportunityProfile): string[] {
  const reasons = [
    `${profile.entityCount} places clustered in ${profile.label}.`,
    `Tags: ${profile.tasteSignals.experientialTags.slice(0, 3).join(', ') || 'balanced'}.`,
    `Ambiance: ${profile.tasteSignals.ambianceProfile.energy} energy, ${profile.tasteSignals.ambianceProfile.noise} noise.`,
  ]
  return reasons.slice(0, 3)
}

function buildHighlights(profile: DistrictOpportunityProfile): string[] {
  const highlights = [
    ...profile.tasteSignals.momentSeeds.slice(0, 2),
    ...profile.categories.slice(0, 2).map((category) => `${toTitleCase(category)} pocket`),
  ]
  return Array.from(new Set(highlights)).slice(0, 3)
}

function buildNearbyExamples(
  pocketId: string,
  debug: DistrictDebugTrace | undefined,
): string[] {
  const trace = debug?.pocketTraces.find((entry) => entry.pocketId === pocketId)
  return trace?.composition?.representativeEntityNames.slice(0, 3) ?? []
}

function hasFlowSeed(seeds: string[]): boolean {
  return seeds.some((seed) => /->|→|\bthen\b/i.test(seed))
}

function hasLateSeed(seeds: string[]): boolean {
  return seeds.some((seed) => /(late|night|cocktail|wine bar|music|after)/i.test(seed))
}

function getLaneIdentity(
  archetype: DirectionArchetype,
  profile: DistrictOpportunityProfile,
): DirectionLaneIdentity {
  const mix = profile.tasteSignals.hospitalityMix
  const ambiance = profile.tasteSignals.ambianceProfile
  const tags = new Set(profile.tasteSignals.experientialTags.map((tag) => tag.toLowerCase()))
  const hasOutdoor =
    profile.categories.includes('park') ||
    profile.categories.includes('outdoor') ||
    tags.has('outdoor')
  if (hasOutdoor) {
    return 'outdoor_adjacent'
  }

  if (archetype === 'lively') {
    if (mix.culture >= 0.2 || tags.has('arts-adjacent')) {
      return 'lively_arts'
    }
    if (mix.activity + mix.drinks >= 0.56) {
      return 'lively_core'
    }
    return 'social_mixed'
  }

  if (archetype === 'cultural') {
    if (mix.culture >= 0.24 && ambiance.noise !== 'high') {
      return 'cultured_compact'
    }
    if (mix.activity + mix.drinks >= 0.44) {
      return 'lively_arts'
    }
    return 'district_core'
  }

  if (archetype === 'chill') {
    if (mix.dining + mix.cafe >= 0.46 && ambiance.noise === 'low') {
      return 'cozy_neighborhood'
    }
    if (mix.dining >= 0.28 && mix.culture >= 0.16) {
      return 'calm_upscale'
    }
    return 'neighborhood_pocket'
  }

  if (mix.activity + mix.drinks >= 0.52) {
    return 'social_mixed'
  }
  return 'district_core'
}

function getDistrictIdentityStrength(profile: DistrictOpportunityProfile): number {
  const mix = profile.tasteSignals.hospitalityMix
  const tags = new Set(profile.tasteSignals.experientialTags.map((tag) => tag.toLowerCase()))
  const mixValues = [mix.drinks, mix.dining, mix.culture, mix.cafe, mix.activity]
  const maxMix = Math.max(...mixValues)
  const minMix = Math.min(...mixValues)
  const mixShape = clamp(maxMix - minMix, 0, 1)
  const categoryBreadth = clamp(profile.categories.length / 5, 0, 1)
  const distinctiveTags =
    ['arts-adjacent', 'mixed-program', 'intentional', 'curated', 'activity-led', 'intimate'].filter(
      (tag) => tags.has(tag),
    ).length / 6
  const momentSupport = profile.tasteSignals.momentPotential
  const viability = profile.coreSignals.viability
  const activityDominancePenalty = mix.activity > 0.48 && mix.culture < 0.18 ? 0.12 : 0

  return toFixed(
    clamp(
      mixShape * 0.22 +
        categoryBreadth * 0.19 +
        distinctiveTags * 0.24 +
        momentSupport * 0.19 +
        viability * 0.16 -
        activityDominancePenalty,
      0,
      1,
    ),
  )
}

function getMomentumProfile(
  archetype: DirectionArchetype,
  profile: DistrictOpportunityProfile,
): DirectionMomentumProfile {
  const mix = profile.tasteSignals.hospitalityMix
  const ambiance = profile.tasteSignals.ambianceProfile
  const seeds = profile.tasteSignals.momentSeeds
  const socialMomentum = mix.activity + mix.drinks

  if (socialMomentum >= 0.56 && (ambiance.energy === 'high' || hasFlowSeed(seeds))) {
    return 'fast_build'
  }
  if (hasLateSeed(seeds) && socialMomentum >= 0.38) {
    return 'late_pull'
  }
  if (archetype === 'cultural' || mix.culture >= 0.22 || hasFlowSeed(seeds)) {
    return 'focused_flow'
  }
  if (ambiance.energy === 'low' || ambiance.noise === 'low') {
    return 'soft_start'
  }
  return 'steady_build'
}

function getMacroLane(
  archetype: DirectionArchetype,
  laneIdentity: DirectionLaneIdentity,
  profile: DistrictOpportunityProfile,
): DirectionMacroLane {
  const ambiance = profile.tasteSignals.ambianceProfile
  const mix = profile.tasteSignals.hospitalityMix

  if (laneIdentity === 'lively_core' || laneIdentity === 'lively_arts') {
    return 'lively'
  }
  if (laneIdentity === 'cozy_neighborhood') {
    return 'cozy'
  }
  if (laneIdentity === 'cultured_compact') {
    return 'cultured'
  }
  if (laneIdentity === 'social_mixed') {
    return 'social_mixed'
  }
  if (laneIdentity === 'calm_upscale') {
    return 'calm'
  }
  if (laneIdentity === 'outdoor_adjacent' || laneIdentity === 'neighborhood_pocket') {
    return ambiance.energy === 'low' || ambiance.noise === 'low'
      ? 'calm'
      : 'neighborhood'
  }

  if (archetype === 'cultural' || mix.culture >= 0.22) {
    return 'cultured'
  }
  if (archetype === 'chill') {
    return ambiance.noise === 'low' ? 'cozy' : 'calm'
  }
  if (archetype === 'social') {
    return 'social_mixed'
  }
  return 'lively'
}

function getContrastProfile(
  archetype: DirectionArchetype,
  profile: DistrictOpportunityProfile,
): DirectionContrastProfile {
  const laneIdentity = getLaneIdentity(archetype, profile)
  const macroLane = getMacroLane(archetype, laneIdentity, profile)
  const districtIdentityStrength = getDistrictIdentityStrength(profile)
  const momentumProfile = getMomentumProfile(archetype, profile)
  const viability = profile.coreSignals.viability
  const laneSpecificIdentity =
    laneIdentity !== 'district_core' &&
    laneIdentity !== 'social_mixed' &&
    laneIdentity !== 'lively_core'
  const momentumSpecific =
    momentumProfile === 'focused_flow' ||
    momentumProfile === 'soft_start' ||
    momentumProfile === 'late_pull'

  const contrastEligible =
    viability >= 0.58 &&
    districtIdentityStrength >= 0.56 &&
    (laneSpecificIdentity || momentumSpecific)

  let contrastReason: string | undefined
  if (contrastEligible) {
    contrastReason = laneSpecificIdentity
      ? 'lane_identity_distinct'
      : 'momentum_profile_distinct'
  } else if (viability < 0.58) {
    contrastReason = 'viability_too_low'
  } else if (districtIdentityStrength < 0.56) {
    contrastReason = 'identity_too_generic'
  } else {
    contrastReason = 'contrast_signal_too_weak'
  }

  return {
    laneIdentity,
    macroLane,
    districtIdentityStrength,
    momentumProfile,
    contrastEligible,
    contrastReason,
  }
}

interface DirectionStrategyRuntimeMeta {
  strategy?: DirectionStrategyDefinition
  collapseGuardApplied?: boolean
  overlapSummary?: string
  strategySource?: string
  strategyConstraintStatus?: StrategyConstraintStatus
  strategyPoolSize?: number
  strategyRejectedCount?: number
  strategyHardGuardStatus?: 'pass' | 'degraded'
  strategyHardGuardReason?: string
  contractGateApplied?: boolean
  contractGateSummary?: string
  contractGateStrengthSummary?: string
  contractGateRejectedCount?: number
  contractGateAllowedPreview?: string[]
  contractGateSuppressedPreview?: string[]
  directionContractGateStatus?: string
  directionContractGateReasonSummary?: string
  strategyWorldSource?: string
  selectedStrategyWorldId?: string
  strategyWorldSummary?: string
  strategyWorldAdmittedCount?: number
  strategyWorldSuppressedCount?: number
  strategyWorldRejectedCount?: number
  strategyWorldAllowedPreview?: string
  strategyWorldSuppressedPreview?: string
  directionStrategyWorldDebug?: StrategyAdmissibleWorld['debug']
  directionStrategyWorldStatus?: string
  directionStrategyWorldReasonSummary?: string
}

function buildDirectionCandidateFromRanked(
  entry: RankedPocket,
  input: BuildDirectionCandidatesInput,
  strategyMeta?: DirectionStrategyRuntimeMeta,
): DirectionCandidate {
  const profile = entry.profile
  const experienceContract = input.context?.experienceContract
  const contractConstraints = input.context?.contractConstraints
  const strategy = strategyMeta?.strategy
  const archetype = deriveArchetype(profile)
  const cluster = getPreferredCluster(archetype)
  const confidence = toFixed(entry.score * 0.7 + profile.coreSignals.viability * 0.3)
  const contrastProfile = getContrastProfile(archetype, profile)
  const experienceIdentity = deriveDirectionExperienceIdentity({
    profile,
    experienceContract,
    contractConstraints,
    strategy,
  })
  const directionPeakModel = getDirectionPeakModelLabel(experienceContract, contractConstraints)
  const directionMovementStyle = getDirectionMovementStyleLabel(
    experienceContract,
    contractConstraints,
  )
  const districtSupportSummary = deriveDirectionDistrictSupportSummary({
    entry,
    experienceContract,
    contractConstraints,
    strategy,
  })
  const narrative = deriveDirectionNarrativeSummary({
    experienceContract,
    contractConstraints,
    directionPeakModel,
    directionMovementStyle,
    directionExperienceIdentity: experienceIdentity.identity,
    directionDistrictSupportSummary: districtSupportSummary,
    strategy,
  })
  const experienceFamily = detectExperienceFamily(
    {
      dominantCategories:
        profile.hyperlocal?.primaryMicroPocket.dominantCategories ??
        profile.categories.slice(0, 3),
      whyHereSignals:
        profile.hyperlocal?.whyHereSignals ??
        profile.hyperlocal?.primaryMicroPocket.reasonSignals ??
        [],
      activationStrength: profile.hyperlocal?.primaryMicroPocket.activationStrength,
      environmentalInfluencePotential:
        profile.hyperlocal?.primaryMicroPocket.environmentalInfluencePotential,
      momentPotential: profile.tasteSignals.momentPotential,
      ambianceProfile: profile.tasteSignals.ambianceProfile,
      hospitalityMix: profile.tasteSignals.hospitalityMix,
      experientialTags: profile.tasteSignals.experientialTags,
    },
    {
      persona: input.context?.persona,
      vibe: input.context?.vibe,
    },
  )

  return {
    id: `direction-${profile.pocketId}`,
    label: experienceIdentity.identity,
    subtitle: deriveDirectionSubtitle({
      profile,
      districtSupportSummary,
    }),
    supportLine: districtSupportSummary,
    archetype,
    cluster,
    pocketId: profile.pocketId,
    pocketLabel: profile.label,
    directionExperienceIdentity: experienceIdentity.identity,
    directionPrimaryIdentitySource: experienceIdentity.primaryIdentitySource,
    directionPeakModel,
    directionMovementStyle,
    directionDistrictSupportSummary: districtSupportSummary,
    directionStrategyId: strategy?.id ?? 'adaptive_balance',
    directionStrategyLabel: strategy?.label ?? 'Adaptive balanced night',
    directionStrategyFamily: strategy?.family ?? 'adaptive',
    directionStrategySummary:
      strategy?.summary ?? 'Balanced movement with one clear center and stable flow.',
    directionStrategySource:
      strategyMeta?.strategySource ??
      (strategy ? 'strategy_layer:persona_vibe_contract' : 'strategy_layer:fallback_adaptive'),
    directionCollapseGuardApplied: Boolean(strategyMeta?.collapseGuardApplied),
    directionStrategyOverlapSummary: strategyMeta?.overlapSummary ?? 'not_evaluated',
    strategyConstraintStatus: strategyMeta?.strategyConstraintStatus,
    strategyPoolSize: strategyMeta?.strategyPoolSize,
    strategyRejectedCount: strategyMeta?.strategyRejectedCount,
    strategyHardGuardStatus: strategyMeta?.strategyHardGuardStatus,
    strategyHardGuardReason: strategyMeta?.strategyHardGuardReason,
    contractGateApplied: strategyMeta?.contractGateApplied,
    contractGateSummary: strategyMeta?.contractGateSummary,
    contractGateStrengthSummary: strategyMeta?.contractGateStrengthSummary,
    contractGateRejectedCount: strategyMeta?.contractGateRejectedCount,
    contractGateAllowedPreview: strategyMeta?.contractGateAllowedPreview,
    contractGateSuppressedPreview: strategyMeta?.contractGateSuppressedPreview,
    directionContractGateStatus: strategyMeta?.directionContractGateStatus,
    directionContractGateReasonSummary: strategyMeta?.directionContractGateReasonSummary,
    strategyWorldSource: strategyMeta?.strategyWorldSource,
    selectedStrategyWorldId: strategyMeta?.selectedStrategyWorldId,
    strategyWorldSummary: strategyMeta?.strategyWorldSummary,
    strategyWorldAdmittedCount: strategyMeta?.strategyWorldAdmittedCount,
    strategyWorldSuppressedCount: strategyMeta?.strategyWorldSuppressedCount,
    strategyWorldRejectedCount: strategyMeta?.strategyWorldRejectedCount,
    strategyWorldAllowedPreview: strategyMeta?.strategyWorldAllowedPreview,
    strategyWorldSuppressedPreview: strategyMeta?.strategyWorldSuppressedPreview,
    directionStrategyWorldDebug: strategyMeta?.directionStrategyWorldDebug,
    directionStrategyWorldStatus: strategyMeta?.directionStrategyWorldStatus,
    directionStrategyWorldReasonSummary: strategyMeta?.directionStrategyWorldReasonSummary,
    directionNarrativeSource: narrative.source,
    directionNarrativeMode: narrative.mode,
    directionNarrativeSummary: narrative.summary,
    directionNarrativeSupport: narrative.support,
    confidence,
    reasons: buildReasons(profile),
    highlights: buildHighlights(profile),
    nearbyExamples: buildNearbyExamples(profile.pocketId, input.debug),
    contrastProfile,
    experienceFamily: experienceFamily.family,
    familyConfidence: experienceFamily.confidence,
    richnessDebug: {
      richnessBoostApplied: 0,
      similarityPenaltyApplied: 0,
    },
    derivedFrom: {
      experientialTags: profile.tasteSignals.experientialTags,
      ambianceProfile: profile.tasteSignals.ambianceProfile,
      hospitalityMix: profile.tasteSignals.hospitalityMix,
      momentSeeds: profile.tasteSignals.momentSeeds,
      momentPotential: profile.tasteSignals.momentPotential,
      hyperlocal: profile.hyperlocal,
    },
  }
}

function hasBaselineCandidateQuality(
  candidate: DirectionCandidate,
  profile: DistrictOpportunityProfile,
): boolean {
  if (profile.classification === 'reject') {
    return false
  }
  if (profile.coreSignals.viability < MIN_BASELINE_VIABILITY) {
    return false
  }
  if (candidate.confidence < MIN_BASELINE_CONFIDENCE) {
    return false
  }
  return true
}

function toLevelScore(value: 'low' | 'medium' | 'high'): number {
  if (value === 'high') {
    return 1
  }
  if (value === 'medium') {
    return 0.6
  }
  return 0.2
}

function scoreToLevel(value: number): 'low' | 'medium' | 'high' {
  if (value >= 0.72) {
    return 'high'
  }
  if (value >= 0.42) {
    return 'medium'
  }
  return 'low'
}

function haversineDistanceM(
  left: DistrictOpportunityProfile['centroid'],
  right: DistrictOpportunityProfile['centroid'],
): number {
  const toRadians = (value: number) => (value * Math.PI) / 180
  const earthRadiusM = 6371000
  const dLat = toRadians(right.lat - left.lat)
  const dLng = toRadians(right.lng - left.lng)
  const lat1 = toRadians(left.lat)
  const lat2 = toRadians(right.lat)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const a = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng
  return 2 * earthRadiusM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getSetOverlap(left: string[], right: string[]): number {
  const leftSet = new Set(left.map((value) => value.toLowerCase()))
  const rightSet = new Set(right.map((value) => value.toLowerCase()))
  if (leftSet.size === 0 || rightSet.size === 0) {
    return 0
  }
  let intersection = 0
  for (const value of leftSet) {
    if (rightSet.has(value)) {
      intersection += 1
    }
  }
  const unionSize = new Set([...leftSet, ...rightSet]).size
  return unionSize > 0 ? intersection / unionSize : 0
}

function getCandidateDominantCategories(candidate: DirectionCandidate): string[] {
  return (
    candidate.derivedFrom.hyperlocal?.primaryMicroPocket.dominantCategories ??
    []
  ).slice(0, 4)
}

function getCandidateAnchorKey(candidate: DirectionCandidate): string | undefined {
  return (
    candidate.derivedFrom.hyperlocal?.primaryAnchor?.entityId ??
    candidate.derivedFrom.hyperlocal?.primaryAnchor?.entityName ??
    undefined
  )
}

function getCandidatePocketTypeBucket(
  candidate: DirectionCandidate,
): 'compact' | 'balanced' | 'broad' {
  const radius = candidate.derivedFrom.hyperlocal?.primaryMicroPocket.radiusM
  if (typeof radius !== 'number') {
    return 'balanced'
  }
  if (radius <= 120) {
    return 'compact'
  }
  if (radius <= 200) {
    return 'balanced'
  }
  return 'broad'
}

function getCandidateSimilarity(left: DirectionCandidate, right: DirectionCandidate): number {
  const sameFamily = left.experienceFamily === right.experienceFamily ? 1 : 0
  const sameArchetype = left.archetype === right.archetype ? 1 : 0
  const categoryOverlap = getSetOverlap(
    getCandidateDominantCategories(left),
    getCandidateDominantCategories(right),
  )
  const samePocketType =
    getCandidatePocketTypeBucket(left) === getCandidatePocketTypeBucket(right) ? 1 : 0
  const leftAnchor = getCandidateAnchorKey(left)
  const rightAnchor = getCandidateAnchorKey(right)
  const sameAnchor = leftAnchor && rightAnchor && leftAnchor === rightAnchor ? 1 : 0

  return clamp(
    sameFamily * 0.31 +
      sameArchetype * 0.24 +
      categoryOverlap * 0.27 +
      samePocketType * 0.12 +
      sameAnchor * 0.06,
    0,
    1,
  )
}

function getStrategyOverlapScore(
  left: DirectionCandidate,
  right: DirectionCandidate,
): number {
  const similarity = getCandidateSimilarity(left, right)
  const samePeak = left.directionPeakModel === right.directionPeakModel ? 0.08 : 0
  const sameMovement = left.directionMovementStyle === right.directionMovementStyle ? 0.08 : 0
  const sameMomentum =
    left.contrastProfile.momentumProfile === right.contrastProfile.momentumProfile ? 0.08 : 0
  return clamp(similarity + samePeak + sameMovement + sameMomentum, 0, 1)
}

function normalizeWithinPool(
  values: number[],
): number[] {
  if (values.length === 0) {
    return []
  }
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  if (maxValue <= minValue) {
    return values.map(() => 0.5)
  }
  return values.map((value) => clamp((value - minValue) / (maxValue - minValue), 0, 1))
}

function buildStrategyCandidates(
  params: {
    input: BuildDirectionCandidatesInput
    sortedRanked: RankedPocket[]
    entryCandidateByPocketId: Map<string, { entry: RankedPocket; candidate: DirectionCandidate }>
    strategyAdmissibleWorlds: StrategyAdmissibleWorld[]
  },
): DirectionCandidate[] {
  const fallbackFamily = params.strategyAdmissibleWorlds[0]?.strategyFamily
  const fallbackStrategies = fallbackFamily
    ? resolveDirectionStrategiesForFamily(fallbackFamily)
    : []
  const hasBearingsWorlds = params.strategyAdmissibleWorlds.length > 0
  const strategyWorldById = new Map(
    params.strategyAdmissibleWorlds.map((world) => [world.strategyId, world] as const),
  )
  const seededStrategyPlan = (
    hasBearingsWorlds
      ? params.strategyAdmissibleWorlds
          .map((world) => {
            const worldStrategies = resolveDirectionStrategiesForFamily(world.strategyFamily)
            const strategy = worldStrategies.find((entry) => entry.id === world.strategyId)
            if (!strategy) {
              return undefined
            }
            return { strategy, strategyWorld: world }
          })
          .filter(
            (
              value,
            ): value is { strategy: DirectionStrategyDefinition; strategyWorld: StrategyAdmissibleWorld } =>
              Boolean(value),
          )
      : fallbackStrategies.map((strategy) => ({
          strategy,
          strategyWorld: undefined,
        }))
  ).slice(0, TARGET_DIRECTION_CANDIDATES)
  const strategyPlan = seededStrategyPlan.slice()
  if (strategyPlan.length < TARGET_DIRECTION_CANDIDATES) {
    const seededIds = new Set(strategyPlan.map((entry) => entry.strategy.id))
    for (const fallbackStrategy of fallbackStrategies) {
      if (seededIds.has(fallbackStrategy.id)) {
        continue
      }
      strategyPlan.push({
        strategy: fallbackStrategy,
        strategyWorld: strategyWorldById.get(fallbackStrategy.id),
      })
      seededIds.add(fallbackStrategy.id)
      if (strategyPlan.length >= TARGET_DIRECTION_CANDIDATES) {
        break
      }
    }
  }

  if (strategyPlan.length < TARGET_DIRECTION_CANDIDATES) {
    if (!hasBearingsWorlds) {
      return []
    }
    if (strategyPlan.length === 0) {
      return []
    }
  }

  const selected: DirectionCandidate[] = []
  const selectedPocketIds = new Set<string>()
  const fallbackSeedPool = params.sortedRanked.slice(
    0,
    Math.max(STRATEGY_POOL_WINDOW, TARGET_DIRECTION_CANDIDATES * 6),
  )

  for (const planEntry of strategyPlan) {
    const strategy = planEntry.strategy
    const strategyWorld = planEntry.strategyWorld ?? strategyWorldById.get(strategy.id)
    const strategyWorldPrimarySeed =
      strategyWorld?.admittedPockets.length
        ? strategyWorld.admittedPockets
        : strategyWorld
          ? [...strategyWorld.suppressedPockets, ...strategyWorld.rejectedPockets]
          : []
    const strategySeedPool =
      strategyWorld
        ? strategyWorldPrimarySeed
        : fallbackSeedPool

    if (strategyWorld && strategySeedPool.length === 0) {
      continue
    }

    const baseOptions = strategySeedPool
      .map((entry) => {
        const base = params.entryCandidateByPocketId.get(entry.profile.pocketId)
        if (!base) {
          return undefined
        }
        if (selectedPocketIds.has(base.candidate.pocketId)) {
          return undefined
        }
        const shouldEnforceBaselineQuality = !hasBearingsWorlds || !strategyWorld
        if (
          shouldEnforceBaselineQuality &&
          !hasBaselineCandidateQuality(base.candidate, base.entry.profile)
        ) {
          return undefined
        }
        if (
          !shouldEnforceBaselineQuality &&
          base.entry.profile.classification === 'reject'
        ) {
          return undefined
        }
        const strategyWorldDecision = strategyWorld?.decisionByPocketId[entry.profile.pocketId]
        return {
          entry: base.entry,
          baseCandidate: base.candidate,
          strategyWorldDecision,
        }
      })
      .filter(
        (
          value,
        ): value is {
          entry: RankedPocket
          baseCandidate: DirectionCandidate
          strategyWorldDecision?: StrategyAdmissibleWorld['decisionByPocketId'][string]
        } => Boolean(value),
      )

    if (baseOptions.length === 0) {
      continue
    }

    const strategyPoolSize =
      strategyWorld?.debug.admittedCount ??
      baseOptions.length
    const strategyRejectedCount = strategyWorld
      ? strategyWorld.debug.rejectedCount + strategyWorld.debug.suppressedCount
      : Math.max(0, params.sortedRanked.length - strategyPoolSize)
    const strategyFallbackApplied = !strategyWorld
    const strategyFallbackReason = strategyFallbackApplied
      ? hasBearingsWorlds
        ? 'bearings_world_missing_for_strategy'
        : 'no_strategy_worlds_provided'
      : strategyWorld.admittedPockets.length > 0
        ? 'strategy_world_admitted_pool'
        : 'strategy_world_degraded_pool'
    const rawScoredOptions = baseOptions.map((option) => {
      const rawStrategyScore = scoreEntryForStrategy({
        entry: option.entry,
        candidate: option.baseCandidate,
        strategy,
        context: params.input.context,
      })
      const worldShapeScore =
        option.strategyWorldDecision?.shapeScore ??
        option.entry.score
      return {
        ...option,
        rawStrategyScore,
        worldShapeScore,
      }
    })
    const normalizedRawScores = normalizeWithinPool(
      rawScoredOptions.map((option) => option.rawStrategyScore),
    )
    const normalizedWorldShapeScores = normalizeWithinPool(
      rawScoredOptions.map((option) => option.worldShapeScore),
    )
    const scoredOptions = rawScoredOptions
      .map((option, index) => {
        const strategyScore = toFixed(
          clamp(
            normalizedRawScores[index] * 0.76 +
              normalizedWorldShapeScores[index] * 0.24,
            0,
            1,
          ),
        )
        return {
          ...option,
          strategyScore,
        }
      })
      .sort((left, right) => {
        if (right.strategyScore !== left.strategyScore) {
          return right.strategyScore - left.strategyScore
        }
        return left.entry.rank - right.entry.rank
      })

    const selectionPool = scoredOptions
    if (selectionPool.length === 0) {
      continue
    }

    let chosenIndex = 0
    let chosenOverlapSummary = 'no_overlap_reference'
    if (selected.length > 0) {
      for (let index = 0; index < selectionPool.length; index += 1) {
        const option = selectionPool[index]
        const overlapRows = selected.map((current) => ({
          strategyId: current.directionStrategyId,
          overlap: getStrategyOverlapScore(option.baseCandidate, current),
        }))
        const maxOverlap = overlapRows.reduce(
          (maxValue, row) => (row.overlap > maxValue ? row.overlap : maxValue),
          0,
        )
        const mostOverlapping = overlapRows.sort((left, right) => right.overlap - left.overlap)[0]
        const overlapSummary = mostOverlapping
          ? `max:${maxOverlap.toFixed(2)} vs ${mostOverlapping.strategyId}`
          : 'no_overlap_reference'
        if (maxOverlap < STRATEGY_OVERLAP_BLOCK) {
          chosenIndex = index
          chosenOverlapSummary = overlapSummary
          break
        }
        if (index === selectionPool.length - 1) {
          chosenIndex = 0
          chosenOverlapSummary = overlapSummary
        }
      }
    }

    const chosen = selectionPool[chosenIndex]
    if (!chosen) {
      continue
    }
    const worldDecision = chosen.strategyWorldDecision
    const hardGuardStatus =
      worldDecision && !worldDecision.hardGuardPassed ? 'degraded' : 'pass'
    const hardGuardReason =
      hardGuardStatus === 'degraded'
        ? `degraded:${worldDecision?.hardGuardReason ?? 'strategy_world_hard_guard_failed'}`
        : worldDecision?.hardGuardReason ?? 'strategy_world_hard_guard_passed'
    const strategyConstraintStatus: StrategyConstraintStatus = {
      required: worldDecision?.requiredPass === false ? 'fail' : 'pass',
      preferred: worldDecision?.preferredScore ?? 0.5,
      suppressed:
        worldDecision?.suppressedTriggered ? 'triggered' : 'not_triggered',
    }
    const strategyCandidate = buildDirectionCandidateFromRanked(
      chosen.entry,
      params.input,
      {
        strategy,
        collapseGuardApplied: chosenIndex > 0,
        overlapSummary: chosenOverlapSummary,
        strategySource:
          strategyWorld
            ? `strategy_layer:${strategy.family}|world:${strategyWorld.source}|score:${chosen.strategyScore.toFixed(3)}|raw:${chosen.rawStrategyScore.toFixed(3)}`
            : `strategy_layer:${strategy.family}|fallback:${strategyFallbackReason}|score:${chosen.strategyScore.toFixed(3)}|raw:${chosen.rawStrategyScore.toFixed(3)}`,
        strategyConstraintStatus,
        strategyPoolSize,
        strategyRejectedCount,
        strategyHardGuardStatus: hardGuardStatus,
        strategyHardGuardReason: hardGuardReason,
        contractGateApplied: chosen.baseCandidate.contractGateApplied,
        contractGateSummary: chosen.baseCandidate.contractGateSummary,
        contractGateStrengthSummary: chosen.baseCandidate.contractGateStrengthSummary,
        contractGateRejectedCount: chosen.baseCandidate.contractGateRejectedCount,
        contractGateAllowedPreview: chosen.baseCandidate.contractGateAllowedPreview,
        contractGateSuppressedPreview: chosen.baseCandidate.contractGateSuppressedPreview,
        directionContractGateStatus: chosen.baseCandidate.directionContractGateStatus,
        directionContractGateReasonSummary:
          chosen.baseCandidate.directionContractGateReasonSummary,
        strategyWorldSource: strategyWorld?.source,
        selectedStrategyWorldId: strategyWorld?.strategyId,
        strategyWorldSummary: strategyWorld?.summary,
        strategyWorldAdmittedCount: strategyWorld?.debug.admittedCount,
        strategyWorldSuppressedCount: strategyWorld?.debug.suppressedCount,
        strategyWorldRejectedCount: strategyWorld?.debug.rejectedCount,
        strategyWorldAllowedPreview: strategyWorld?.debug.allowedPreview,
        strategyWorldSuppressedPreview: strategyWorld?.debug.suppressedPreview,
        directionStrategyWorldDebug: strategyWorld?.debug,
        directionStrategyWorldStatus:
          worldDecision?.status ?? 'not_evaluated',
        directionStrategyWorldReasonSummary:
          worldDecision?.reasonSummary ?? strategyFallbackReason,
      },
    )
    selected.push(strategyCandidate)
    selectedPocketIds.add(strategyCandidate.pocketId)
  }

  return selected
}

function getRichnessAssessment(
  candidate: DirectionCandidate,
  existing: DirectionCandidate[],
): {
  richnessBoostApplied: number
  similarityPenaltyApplied: number
  contrastReason: string
  maxSimilarity: number
  netRichness: number
} {
  if (existing.length === 0) {
    return {
      richnessBoostApplied: 0.08,
      similarityPenaltyApplied: 0,
      contrastReason: 'seed_candidate',
      maxSimilarity: 0,
      netRichness: 0.08,
    }
  }

  let maxSimilarity = 0
  let familyContrast = 0
  let archetypeContrast = 0
  let anchorContrast = 0
  let categoryContrast = 0

  const candidateCategories = getCandidateDominantCategories(candidate)
  const candidateAnchor = getCandidateAnchorKey(candidate)
  for (const existingCandidate of existing) {
    const similarity = getCandidateSimilarity(candidate, existingCandidate)
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity
    }
    if (candidate.experienceFamily !== existingCandidate.experienceFamily) {
      familyContrast += 1
    }
    if (candidate.archetype !== existingCandidate.archetype) {
      archetypeContrast += 1
    }
    if (
      candidateAnchor &&
      getCandidateAnchorKey(existingCandidate) &&
      candidateAnchor !== getCandidateAnchorKey(existingCandidate)
    ) {
      anchorContrast += 1
    }
    const overlap = getSetOverlap(
      candidateCategories,
      getCandidateDominantCategories(existingCandidate),
    )
    if (overlap < 0.38) {
      categoryContrast += 1
    }
  }

  const denominator = existing.length
  const familyContrastScore = familyContrast / denominator
  const archetypeContrastScore = archetypeContrast / denominator
  const anchorContrastScore = anchorContrast / denominator
  const categoryContrastScore = categoryContrast / denominator
  const richnessBoostApplied =
    familyContrastScore * 0.04 +
    archetypeContrastScore * 0.028 +
    anchorContrastScore * 0.018 +
    categoryContrastScore * 0.022 +
    (1 - maxSimilarity) * 0.026
  const similarityPenaltyApplied = maxSimilarity > 0.62 ? (maxSimilarity - 0.62) * 0.11 : 0
  const netRichness = richnessBoostApplied - similarityPenaltyApplied
  const contrastReason =
    familyContrastScore >= 0.6
      ? 'family_contrast'
      : archetypeContrastScore >= 0.6
        ? 'archetype_contrast'
        : categoryContrastScore >= 0.6
          ? 'category_contrast'
          : anchorContrastScore >= 0.6
            ? 'anchor_contrast'
            : 'low_contrast'

  return {
    richnessBoostApplied: toFixed(richnessBoostApplied),
    similarityPenaltyApplied: toFixed(similarityPenaltyApplied),
    contrastReason,
    maxSimilarity: toFixed(maxSimilarity),
    netRichness: toFixed(netRichness),
  }
}

function hasConflictingFamilyExtremes(
  left: DirectionCandidate,
  right: DirectionCandidate,
): boolean {
  const calmFamilies = new Set<ExperienceFamily>([
    'ambient',
    'intimate',
    'ritual',
    'indulgent',
  ])
  const highFamilies = new Set<ExperienceFamily>([
    'eventful',
    'social',
    'playful',
  ])
  const leftCalm = calmFamilies.has(left.experienceFamily)
  const rightCalm = calmFamilies.has(right.experienceFamily)
  const leftHigh = highFamilies.has(left.experienceFamily)
  const rightHigh = highFamilies.has(right.experienceFamily)
  const polarityConflict = (leftCalm && rightHigh) || (leftHigh && rightCalm)
  if (!polarityConflict) {
    return false
  }
  const leftEnergy = left.derivedFrom.ambianceProfile.energy
  const rightEnergy = right.derivedFrom.ambianceProfile.energy
  return (
    (leftEnergy === 'low' && rightEnergy === 'high') ||
    (leftEnergy === 'high' && rightEnergy === 'low')
  )
}

function areComposableCandidates(
  leftEntry: RankedPocket,
  rightEntry: RankedPocket,
  leftCandidate: DirectionCandidate,
  rightCandidate: DirectionCandidate,
): boolean {
  if (leftCandidate.pocketId === rightCandidate.pocketId) {
    return false
  }
  if (hasConflictingFamilyExtremes(leftCandidate, rightCandidate)) {
    return false
  }
  const adjacent =
    haversineDistanceM(leftEntry.profile.centroid, rightEntry.profile.centroid) <=
    COMPOSED_MAX_DISTANCE_M
  const identityOverlap =
    getSetOverlap(leftEntry.profile.categories, rightEntry.profile.categories) >=
    COMPOSED_MIN_IDENTITY_OVERLAP
  const identityStrengthNear =
    Math.abs(
      leftCandidate.contrastProfile.districtIdentityStrength -
        rightCandidate.contrastProfile.districtIdentityStrength,
    ) <= 0.18
  return adjacent || identityOverlap || identityStrengthNear
}

function buildComposedCandidate(
  leftEntry: RankedPocket,
  rightEntry: RankedPocket,
  leftCandidate: DirectionCandidate,
  rightCandidate: DirectionCandidate,
  input: BuildDirectionCandidatesInput,
  existingSingles: DirectionCandidate[],
): DirectionCandidate | undefined {
  if (!areComposableCandidates(leftEntry, rightEntry, leftCandidate, rightCandidate)) {
    return undefined
  }

  const primary =
    leftCandidate.confidence >= rightCandidate.confidence ? leftCandidate : rightCandidate
  const secondary = primary.pocketId === leftCandidate.pocketId ? rightCandidate : leftCandidate
  const primaryProfile =
    primary.pocketId === leftEntry.profile.pocketId ? leftEntry.profile : rightEntry.profile
  const secondaryProfile =
    secondary.pocketId === leftEntry.profile.pocketId ? leftEntry.profile : rightEntry.profile

  const mergedMix = {
    drinks: toFixed(
      primary.derivedFrom.hospitalityMix.drinks * 0.56 +
        secondary.derivedFrom.hospitalityMix.drinks * 0.44,
    ),
    dining: toFixed(
      primary.derivedFrom.hospitalityMix.dining * 0.56 +
        secondary.derivedFrom.hospitalityMix.dining * 0.44,
    ),
    culture: toFixed(
      primary.derivedFrom.hospitalityMix.culture * 0.56 +
        secondary.derivedFrom.hospitalityMix.culture * 0.44,
    ),
    cafe: toFixed(
      primary.derivedFrom.hospitalityMix.cafe * 0.56 +
        secondary.derivedFrom.hospitalityMix.cafe * 0.44,
    ),
    activity: toFixed(
      primary.derivedFrom.hospitalityMix.activity * 0.56 +
        secondary.derivedFrom.hospitalityMix.activity * 0.44,
    ),
  }

  const mergedAmbiance = {
    energy: scoreToLevel(
      toLevelScore(primary.derivedFrom.ambianceProfile.energy) * 0.56 +
        toLevelScore(secondary.derivedFrom.ambianceProfile.energy) * 0.44,
    ),
    intimacy: scoreToLevel(
      toLevelScore(primary.derivedFrom.ambianceProfile.intimacy) * 0.56 +
        toLevelScore(secondary.derivedFrom.ambianceProfile.intimacy) * 0.44,
    ),
    noise: scoreToLevel(
      toLevelScore(primary.derivedFrom.ambianceProfile.noise) * 0.56 +
        toLevelScore(secondary.derivedFrom.ambianceProfile.noise) * 0.44,
    ),
  }

  const mergedTags = Array.from(
    new Set([
      ...primary.derivedFrom.experientialTags,
      ...secondary.derivedFrom.experientialTags,
    ]),
  ).slice(0, 8)
  const mergedSeeds = Array.from(
    new Set([...primary.derivedFrom.momentSeeds, ...secondary.derivedFrom.momentSeeds]),
  ).slice(0, 4)
  const mergedMomentPotential = toFixed(
    primary.derivedFrom.momentPotential * 0.56 +
      secondary.derivedFrom.momentPotential * 0.44,
  )
  const composedConfidence = toFixed(
    primary.confidence * 0.56 + secondary.confidence * 0.44,
  )
  const dominantCategories = Array.from(
    new Set([
      ...(primaryProfile.hyperlocal?.primaryMicroPocket.dominantCategories ??
        primaryProfile.categories),
      ...(secondaryProfile.hyperlocal?.primaryMicroPocket.dominantCategories ??
        secondaryProfile.categories),
    ]),
  ).slice(0, 4)
  const whyHereSignals = Array.from(
    new Set([
      ...(primaryProfile.hyperlocal?.whyHereSignals ??
        primaryProfile.hyperlocal?.primaryMicroPocket.reasonSignals ??
        []),
      ...(secondaryProfile.hyperlocal?.whyHereSignals ??
        secondaryProfile.hyperlocal?.primaryMicroPocket.reasonSignals ??
        []),
    ]),
  ).slice(0, 4)
  const activationStrength = toFixed(
    (primaryProfile.hyperlocal?.primaryMicroPocket.activationStrength ?? 0.5) * 0.56 +
      (secondaryProfile.hyperlocal?.primaryMicroPocket.activationStrength ?? 0.5) *
        0.44,
  )
  const environmentalInfluencePotential = toFixed(
    (primaryProfile.hyperlocal?.primaryMicroPocket.environmentalInfluencePotential ?? 0.5) *
      0.56 +
      (secondaryProfile.hyperlocal?.primaryMicroPocket.environmentalInfluencePotential ??
        0.5) *
        0.44,
  )
  const composedFamily = detectExperienceFamily(
    {
      dominantCategories,
      whyHereSignals,
      activationStrength,
      environmentalInfluencePotential,
      momentPotential: mergedMomentPotential,
      ambianceProfile: mergedAmbiance,
      hospitalityMix: mergedMix,
      experientialTags: mergedTags,
    },
    {
      persona: input.context?.persona,
      vibe: input.context?.vibe,
    },
  )
  const composedPocketId = `${primary.pocketId}__${secondary.pocketId}`
  const composedIdentity = compactTitle(`${primary.directionExperienceIdentity} blend`, 6)
  const composedSupportLine = `Two compatible pockets support ${primary.directionPeakModel} with ${primary.directionMovementStyle}.`
  const composedNarrativeSummary = `${composedIdentity} keeps ${primary.directionPeakModel}, ${primary.directionMovementStyle}, and controlled progression.`
  const composedNarrativeSupport = `${composedSupportLine} Act flow remains coherent across both pockets.`
  const composedCandidate: DirectionCandidate = {
    id: `direction-${composedPocketId}`,
    label: composedIdentity,
    subtitle: `${primary.pocketLabel} + ${secondary.pocketLabel} | ${composedSupportLine}`,
    supportLine: composedSupportLine,
    archetype: primary.archetype,
    cluster: primary.cluster,
    pocketId: composedPocketId,
    pocketLabel: `${primary.pocketLabel} + ${secondary.pocketLabel}`,
    directionExperienceIdentity: composedIdentity,
    directionPrimaryIdentitySource: `${primary.directionPrimaryIdentitySource}|composed`,
    directionPeakModel: primary.directionPeakModel,
    directionMovementStyle: primary.directionMovementStyle,
    directionDistrictSupportSummary: composedSupportLine,
    directionStrategyId: primary.directionStrategyId,
    directionStrategyLabel: primary.directionStrategyLabel,
    directionStrategyFamily: primary.directionStrategyFamily,
    directionStrategySummary: primary.directionStrategySummary,
    directionStrategySource: `${primary.directionStrategySource}|composed`,
    directionCollapseGuardApplied: primary.directionCollapseGuardApplied,
    directionStrategyOverlapSummary: primary.directionStrategyOverlapSummary,
    strategyConstraintStatus: primary.strategyConstraintStatus,
    strategyPoolSize: primary.strategyPoolSize,
    strategyRejectedCount: primary.strategyRejectedCount,
    strategyHardGuardStatus: primary.strategyHardGuardStatus,
    strategyHardGuardReason: primary.strategyHardGuardReason,
    contractGateApplied: primary.contractGateApplied,
    contractGateSummary: primary.contractGateSummary,
    contractGateStrengthSummary: primary.contractGateStrengthSummary,
    contractGateRejectedCount: primary.contractGateRejectedCount,
    contractGateAllowedPreview: primary.contractGateAllowedPreview,
    contractGateSuppressedPreview: primary.contractGateSuppressedPreview,
    directionContractGateStatus: primary.directionContractGateStatus,
    directionContractGateReasonSummary: primary.directionContractGateReasonSummary,
    directionNarrativeSource: `${primary.directionNarrativeSource}|composed`,
    directionNarrativeMode: primary.directionNarrativeMode,
    directionNarrativeSummary: composedNarrativeSummary,
    directionNarrativeSupport: composedNarrativeSupport,
    confidence: composedConfidence,
    reasons: Array.from(
      new Set([
        ...primary.reasons.slice(0, 2),
        ...secondary.reasons.slice(0, 2),
        'Composed from two compatible nearby pockets to preserve viable choice depth.',
      ]),
    ).slice(0, 3),
    highlights: Array.from(
      new Set([...primary.highlights.slice(0, 2), ...secondary.highlights.slice(0, 2)]),
    ).slice(0, 3),
    nearbyExamples: Array.from(
      new Set([
        ...primary.nearbyExamples.slice(0, 2),
        ...secondary.nearbyExamples.slice(0, 2),
      ]),
    ).slice(0, 3),
    contrastProfile: {
      laneIdentity: primary.contrastProfile.laneIdentity,
      macroLane: primary.contrastProfile.macroLane,
      districtIdentityStrength: toFixed(
        (primary.contrastProfile.districtIdentityStrength +
          secondary.contrastProfile.districtIdentityStrength) /
          2,
      ),
      momentumProfile: primary.contrastProfile.momentumProfile,
      contrastEligible:
        primary.contrastProfile.contrastEligible ||
        secondary.contrastProfile.contrastEligible,
      contrastReason: 'composed_secondary_survival',
    },
    experienceFamily: composedFamily.family,
    familyConfidence: composedFamily.confidence,
    richnessDebug: {
      richnessBoostApplied: 0,
      similarityPenaltyApplied: 0,
      composedCandidateAccepted: false,
      composedCandidateRejected: true,
      richnessContrastReason: 'composed_coherence_not_evaluated',
    },
    derivedFrom: {
      experientialTags: mergedTags,
      ambianceProfile: mergedAmbiance,
      hospitalityMix: mergedMix,
      momentSeeds: mergedSeeds,
      momentPotential: mergedMomentPotential,
      hyperlocal: primary.derivedFrom.hyperlocal ?? secondary.derivedFrom.hyperlocal,
    },
  }

  const hasInterpretableIdentity =
    dominantCategories.length >= 2 ||
    whyHereSignals.length >= 1 ||
    mergedTags.length >= 3
  const hasCohesiveExpressionInputs =
    mergedSeeds.length >= 1 &&
    composedCandidate.label.length <= 100 &&
    composedCandidate.pocketLabel.length <= 80
  const maxSimilarityToSingles = existingSingles.reduce((maxValue, existingCandidate) => {
    const similarity = getCandidateSimilarity(composedCandidate, existingCandidate)
    return similarity > maxValue ? similarity : maxValue
  }, 0)
  const coherent =
    hasInterpretableIdentity &&
    hasCohesiveExpressionInputs &&
    composedFamily.confidence >= MIN_COMPOSED_FAMILY_CONFIDENCE &&
    maxSimilarityToSingles < RICHNESS_SIMILARITY_BLOCK

  const assessment = getRichnessAssessment(composedCandidate, existingSingles)
  composedCandidate.richnessDebug = {
    richnessBoostApplied: assessment.richnessBoostApplied,
    similarityPenaltyApplied: assessment.similarityPenaltyApplied,
    composedCandidateAccepted: coherent && assessment.netRichness >= MIN_RICHNESS_GAIN,
    composedCandidateRejected: !(coherent && assessment.netRichness >= MIN_RICHNESS_GAIN),
    richnessContrastReason:
      coherent && assessment.netRichness >= MIN_RICHNESS_GAIN
        ? `composed_${assessment.contrastReason}`
        : 'composed_low_coherence',
  }

  if (!coherent || assessment.netRichness < MIN_RICHNESS_GAIN) {
    return undefined
  }

  return composedCandidate
}

export function buildDirectionCandidates(
  input: BuildDirectionCandidatesInput,
): DirectionCandidate[] {
  const sortedRanked = input.ranked
    .slice()
    .sort((left, right) => left.rank - right.rank)
  const contractGateWorld = input.contractGateWorld
  const strategyAdmissibleWorlds = input.strategyAdmissibleWorlds
  const gatedRanked = contractGateWorld.admittedPockets
  const gateDecisionByPocketId = new Map(
    Object.entries(contractGateWorld.decisionByPocketId).map(([pocketId, decision]) => [
      pocketId,
      decision,
    ]),
  )
  const poolLimit = resolveCandidatePoolLimit(
    input.candidatePoolLimit,
    gatedRanked.length,
  )
  const entryCandidateByPocketId = new Map<
    string,
    { entry: RankedPocket; candidate: DirectionCandidate }
  >()
  for (const entry of gatedRanked) {
    const gateDecision = gateDecisionByPocketId.get(entry.profile.pocketId)
    entryCandidateByPocketId.set(entry.profile.pocketId, {
      entry,
      candidate: buildDirectionCandidateFromRanked(entry, input, {
        contractGateApplied: contractGateWorld.debug.applied,
        contractGateSummary: contractGateWorld.gateSummary,
        contractGateStrengthSummary: contractGateWorld.gateStrengthSummary,
        contractGateRejectedCount: contractGateWorld.debug.rejectedCount,
        contractGateAllowedPreview: contractGateWorld.debug.allowedPreview,
        contractGateSuppressedPreview: contractGateWorld.debug.suppressedPreview,
        directionContractGateStatus: gateDecision?.status ?? 'allowed',
        directionContractGateReasonSummary: gateDecision?.reasonSummary ?? 'gate_not_evaluated',
      }),
    })
  }

  const strategyCandidates = buildStrategyCandidates({
    input,
    sortedRanked: gatedRanked,
    entryCandidateByPocketId,
    strategyAdmissibleWorlds,
  })
  const strategyWorldsPresent = strategyAdmissibleWorlds.length > 0
  const allStrategyWorldsCollapsedOrEmpty =
    strategyWorldsPresent &&
    strategyAdmissibleWorlds.every(
      (world) =>
        world.debug.survivabilityStatus === 'collapsed' &&
        world.admittedPockets.length === 0 &&
        world.suppressedPockets.length === 0 &&
        world.rejectedPockets.length === 0,
    )
  const preserveStrategyBackedCandidates =
    strategyWorldsPresent &&
    !allStrategyWorldsCollapsedOrEmpty &&
    strategyCandidates.length > 0
  if (strategyCandidates.length >= TARGET_DIRECTION_CANDIDATES) {
    return strategyCandidates.slice(0, TARGET_DIRECTION_CANDIDATES)
  }

  const candidates: DirectionCandidate[] = preserveStrategyBackedCandidates
    ? [...strategyCandidates]
    : gatedRanked
        .slice(0, poolLimit)
        .map((entry) => entryCandidateByPocketId.get(entry.profile.pocketId)?.candidate)
        .filter((candidate): candidate is DirectionCandidate => Boolean(candidate))

  const selectedPocketIds = new Set(candidates.map((candidate) => candidate.pocketId))

  while (candidates.length < TARGET_DIRECTION_CANDIDATES) {
    const remainingPool = gatedRanked
      .slice(poolLimit)
      .map((entry) => entryCandidateByPocketId.get(entry.profile.pocketId))
      .filter(
        (entry): entry is { entry: RankedPocket; candidate: DirectionCandidate } =>
          Boolean(entry),
      )
      .filter(({ entry, candidate }) => {
        if (selectedPocketIds.has(candidate.pocketId)) {
          return false
        }
        if (!hasBaselineCandidateQuality(candidate, entry.profile)) {
          return false
        }
        return true
      })
      .map(({ entry, candidate }) => {
        const assessment = getRichnessAssessment(candidate, candidates)
        const richnessAdjustedScore =
          candidate.confidence +
          assessment.richnessBoostApplied -
          assessment.similarityPenaltyApplied
        return {
          entry,
          candidate: {
            ...candidate,
            richnessDebug: {
              richnessBoostApplied: assessment.richnessBoostApplied,
              similarityPenaltyApplied: assessment.similarityPenaltyApplied,
              richnessContrastReason: assessment.contrastReason,
            },
          },
          netRichness: assessment.netRichness,
          maxSimilarity: assessment.maxSimilarity,
          richnessAdjustedScore: toFixed(richnessAdjustedScore),
        }
      })
      .filter((entry) => entry.netRichness >= MIN_RICHNESS_GAIN)
      .filter((entry) => entry.maxSimilarity < RICHNESS_SIMILARITY_BLOCK)
      .sort((left, right) => {
        if (right.richnessAdjustedScore !== left.richnessAdjustedScore) {
          return right.richnessAdjustedScore - left.richnessAdjustedScore
        }
        if (right.netRichness !== left.netRichness) {
          return right.netRichness - left.netRichness
        }
        return left.entry.rank - right.entry.rank
      })

    const bestNext = remainingPool[0]
    if (!bestNext) {
      break
    }
    candidates.push(bestNext.candidate)
    selectedPocketIds.add(bestNext.candidate.pocketId)
  }

  if (candidates.length < TARGET_DIRECTION_CANDIDATES) {
    const composedCandidates: DirectionCandidate[] = []
    const candidateEntries = [...entryCandidateByPocketId.values()].filter(({ entry, candidate }) =>
      hasBaselineCandidateQuality(candidate, entry.profile),
    )
    for (let leftIndex = 0; leftIndex < candidateEntries.length; leftIndex += 1) {
      if (composedCandidates.length >= MAX_COMPOSED_CANDIDATES) {
        break
      }
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < candidateEntries.length;
        rightIndex += 1
      ) {
        const left = candidateEntries[leftIndex]
        const right = candidateEntries[rightIndex]
        const composed = buildComposedCandidate(
          left.entry,
          right.entry,
          left.candidate,
          right.candidate,
          input,
          candidates,
        )
        if (!composed) {
          continue
        }
        const assessment = getRichnessAssessment(composed, candidates)
        if (
          assessment.netRichness < MIN_RICHNESS_GAIN ||
          assessment.maxSimilarity >= RICHNESS_SIMILARITY_BLOCK
        ) {
          continue
        }
        const composedWithDebug: DirectionCandidate = {
          ...composed,
          richnessDebug: {
            richnessBoostApplied: assessment.richnessBoostApplied,
            similarityPenaltyApplied: assessment.similarityPenaltyApplied,
            composedCandidateAccepted: true,
            composedCandidateRejected: false,
            richnessContrastReason: `composed_${assessment.contrastReason}`,
          },
        }
        if (
          candidates.some((candidate) => candidate.pocketId === composedWithDebug.pocketId) ||
          composedCandidates.some((candidate) => candidate.pocketId === composedWithDebug.pocketId)
        ) {
          continue
        }
        composedCandidates.push(composedWithDebug)
        if (
          candidates.length + composedCandidates.length >= TARGET_DIRECTION_CANDIDATES ||
          composedCandidates.length >= MAX_COMPOSED_CANDIDATES
        ) {
          break
        }
      }
    }
    candidates.push(...composedCandidates.slice(0, MAX_COMPOSED_CANDIDATES))
  }

  return candidates
}
