/**
 * ARC BOUNDARY: Bearings contract gate world.
 *
 * Owns:
 * - admissible/suppressed/rejected world decisions
 * - hard requirement enforcement and gate decision logs
 *
 * Does NOT own:
 * - interpretation semantic identity authorship
 * - route coordination / sequence logic
 */
import type { RankedPocket } from '../../engines/district/types/districtTypes'
import type {
  ContractConstraints,
  ExperienceContract,
  GreatStopDownstreamSignal,
} from '../types/intent'
import {
  normalizeExperienceContractVibe,
  type ExperienceContractVibeAxis,
} from '../interpretation/buildCanonicalInterpretationBundle'
import type {
  DirectionStrategyFamily,
  InterpretationStrategyFamilyResolution,
} from '../interpretation/buildCanonicalInterpretationBundle'

export interface ContractAwarePocketRankingDebug {
  pocketId: string
  baseScore: number
  adjustedScore: number
  contractFitDelta: number
  contractFitLabel: 'strong_fit' | 'balanced_fit' | 'weak_fit'
  contractFitReasons: string[]
}

export interface ContractAwareDistrictRankingResult {
  applied: boolean
  ranked: RankedPocket[]
  pocketDebugById: Record<string, ContractAwarePocketRankingDebug>
}

export interface ContractGatePocketDecisionLog {
  pocketId: string
  status: 'allowed' | 'suppressed' | 'rejected' | 'fallback_admitted'
  allowedScore: number
  preferredScore: number
  suppressedScore: number
  hardPassed: boolean
  reasonSummary: string
  gateAdjustedScore: number
  hardFailureReasons: string[]
  greatStop?: {
    riskTier: GreatStopDownstreamSignal['riskTier']
    failedStopCount: number
    severeFailureCount: number
    suppressionRecommended: boolean
    penaltyApplied: number
    reasonCodes: string[]
  }
}

export interface ContractGateHardRequirementResult {
  pocketId: string
  passed: boolean
  hardFailureReasons: string[]
}

export interface ContractGateWorld {
  contractConstraints: ContractConstraints | null
  gateSummary: string
  gateStrengthSummary: string
  admittedPockets: RankedPocket[]
  suppressedPockets: RankedPocket[]
  rejectedPockets: RankedPocket[]
  hardRequirementResults: ContractGateHardRequirementResult[]
  decisionLog: ContractGatePocketDecisionLog[]
  decisionByPocketId: Record<string, ContractGatePocketDecisionLog>
  contractAwareRanking: ContractAwareDistrictRankingResult
  debug: {
    contractGateWorldPresent: true
    contractGateWorldSource: string
    contractGateWorldSummary: string
    applied: boolean
    rejectedCount: number
    allowedCount: number
    suppressedCount: number
    fallbackAdmittedCount: number
    allowedPreview: string[]
    suppressedPreview: string[]
    rejectedPreview: string[]
    greatStopQuality?: GreatStopDownstreamSignal
    strategyFamilyResolution: {
      resolvedFamily: DirectionStrategyFamily
      canonicalStrategyFamilyProvided: boolean
      canonicalStrategyFamily?: DirectionStrategyFamily
      canonicalStrategyFamilyAmbiguous: boolean
      fallbackPathUsed: boolean
      source: 'interpretation' | 'missing_canonical'
      reasonSummary: string
    }
  }
}

export interface BuildContractGateWorldContext {
  canonicalStrategyFamily?: DirectionStrategyFamily
  canonicalStrategyFamilyResolution?: InterpretationStrategyFamilyResolution
  experienceContract?: ExperienceContract
  contractConstraints?: ContractConstraints
  greatStopAdmissibilitySignal?: GreatStopDownstreamSignal
}

interface BuildContractGateWorldInput {
  ranked: RankedPocket[]
  context?: BuildContractGateWorldContext
  source?: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function toFixed(value: number): number {
  return Number(clamp(value, 0, 1).toFixed(3))
}

function formatSignedScore(value: number): string {
  const normalized = Number(value.toFixed(3))
  return normalized >= 0 ? `+${normalized.toFixed(3)}` : normalized.toFixed(3)
}

interface ContractAwareDistrictPressureTemplate {
  label: string
  preferredDensity: ContractConstraints['socialDensityBand']
  preferCalm: boolean
  preferNightlife: boolean
  preferCulturalAnchor: boolean
  preferBasecamp: boolean
  preferFamilyFriendly: boolean
  suppressNightlife: boolean
  preferExploration: boolean
  preferIntimacy: boolean
  preferMomentum: boolean
  preferContained: boolean
}

const CONTRACT_DISTRICT_PRESSURE_V0_1_MATRIX: Record<
  PersonaMode,
  Record<ExperienceContractVibeAxis, ContractAwareDistrictPressureTemplate>
> = {
  romantic: {
    cozy: {
      label: 'romantic_cozy_contained_intimate',
      preferredDensity: 'low',
      preferCalm: true,
      preferNightlife: false,
      preferCulturalAnchor: true,
      preferBasecamp: false,
      preferFamilyFriendly: false,
      suppressNightlife: true,
      preferExploration: false,
      preferIntimacy: true,
      preferMomentum: false,
      preferContained: true,
    },
    lively: {
      label: 'romantic_lively_pulse_density',
      preferredDensity: 'medium_high',
      preferCalm: false,
      preferNightlife: true,
      preferCulturalAnchor: false,
      preferBasecamp: false,
      preferFamilyFriendly: false,
      suppressNightlife: false,
      preferExploration: false,
      preferIntimacy: true,
      preferMomentum: true,
      preferContained: false,
    },
    cultured: {
      label: 'romantic_cultured_curated_continuity',
      preferredDensity: 'low',
      preferCalm: true,
      preferNightlife: false,
      preferCulturalAnchor: true,
      preferBasecamp: false,
      preferFamilyFriendly: false,
      suppressNightlife: true,
      preferExploration: true,
      preferIntimacy: true,
      preferMomentum: false,
      preferContained: true,
    },
  },
  friends: {
    cozy: {
      label: 'friends_cozy_hang_basecamp',
      preferredDensity: 'medium',
      preferCalm: true,
      preferNightlife: false,
      preferCulturalAnchor: false,
      preferBasecamp: true,
      preferFamilyFriendly: false,
      suppressNightlife: true,
      preferExploration: false,
      preferIntimacy: false,
      preferMomentum: false,
      preferContained: true,
    },
    lively: {
      label: 'friends_lively_momentum_crawl',
      preferredDensity: 'high',
      preferCalm: false,
      preferNightlife: true,
      preferCulturalAnchor: false,
      preferBasecamp: true,
      preferFamilyFriendly: false,
      suppressNightlife: false,
      preferExploration: true,
      preferIntimacy: false,
      preferMomentum: true,
      preferContained: false,
    },
    cultured: {
      label: 'friends_cultured_multi_anchor',
      preferredDensity: 'medium',
      preferCalm: false,
      preferNightlife: false,
      preferCulturalAnchor: true,
      preferBasecamp: false,
      preferFamilyFriendly: false,
      suppressNightlife: true,
      preferExploration: true,
      preferIntimacy: false,
      preferMomentum: false,
      preferContained: false,
    },
  },
  family: {
    cozy: {
      label: 'family_cozy_recovery_compressed',
      preferredDensity: 'low',
      preferCalm: true,
      preferNightlife: false,
      preferCulturalAnchor: false,
      preferBasecamp: false,
      preferFamilyFriendly: true,
      suppressNightlife: true,
      preferExploration: false,
      preferIntimacy: false,
      preferMomentum: false,
      preferContained: true,
    },
    lively: {
      label: 'family_lively_bounded_activity',
      preferredDensity: 'medium',
      preferCalm: false,
      preferNightlife: false,
      preferCulturalAnchor: false,
      preferBasecamp: false,
      preferFamilyFriendly: true,
      suppressNightlife: true,
      preferExploration: false,
      preferIntimacy: false,
      preferMomentum: true,
      preferContained: true,
    },
    cultured: {
      label: 'family_cultured_clustered_enrichment',
      preferredDensity: 'medium',
      preferCalm: true,
      preferNightlife: false,
      preferCulturalAnchor: true,
      preferBasecamp: false,
      preferFamilyFriendly: true,
      suppressNightlife: true,
      preferExploration: true,
      preferIntimacy: false,
      preferMomentum: false,
      preferContained: true,
    },
  },
}


interface ContractAwareDistrictFeatures {
  socialDensity: number
  calmness: number
  nightlife: number
  culturalAnchor: number
  basecamp: number
  familyFriendly: number
  continuity: number
  exploration: number
  momentum: number
  highlightPotential: number
  distributedPotential: number
  intimacy: number
  radiusNorm: number
  movementContainedFit: number
  movementCompressedFit: number
  movementModerateFit: number
  movementExploratoryFit: number
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(1, value))
}

function toAmbianceScore(level: 'low' | 'medium' | 'high'): number {
  if (level === 'low') {
    return 0.16
  }
  if (level === 'medium') {
    return 0.56
  }
  return 0.9
}


function getSocialDensityBandCenter(band: ContractConstraints['socialDensityBand']): number {
  if (band === 'low') {
    return 0.2
  }
  if (band === 'medium') {
    return 0.5
  }
  if (band === 'medium_high') {
    return 0.68
  }
  return 0.86
}

function getBandFit(value: number, band: ContractConstraints['socialDensityBand']): number {
  const center = getSocialDensityBandCenter(band)
  const distance = Math.abs(value - center)
  return clampUnit(1 - distance * 1.8)
}

function hasTokenSignal(values: string[], tokens: string[]): boolean {
  const normalized = values.map((value) => value.toLowerCase())
  return normalized.some((value) => tokens.some((token) => value.includes(token)))
}

function computeContractAwareDistrictFeatures(profile: RankedPocket['profile']): ContractAwareDistrictFeatures {
  const mix = profile.tasteSignals.hospitalityMix
  const ambiance = profile.tasteSignals.ambianceProfile
  const tags = profile.tasteSignals.experientialTags
  const categories = profile.categories
  const energy = toAmbianceScore(ambiance.energy)
  const intimacy = toAmbianceScore(ambiance.intimacy)
  const noise = toAmbianceScore(ambiance.noise)
  const walkability = clampUnit(profile.coreSignals.walkability)
  const density = clampUnit(profile.coreSignals.density)
  const categoryDiversity = clampUnit(profile.coreSignals.categoryDiversity)
  const momentPotential = clampUnit(profile.tasteSignals.momentPotential)
  const localSpecificity = clampUnit(profile.hyperlocal?.localSpecificityScore ?? 0.5)
  const radiusNorm = clampUnit(profile.radiusM / 2200)
  const mixValues = [mix.drinks, mix.dining, mix.culture, mix.cafe, mix.activity].map(clampUnit)
  const mixEvenness = clampUnit(1 - (Math.max(...mixValues) - Math.min(...mixValues)))
  const hasLateSignal =
    hasTokenSignal(tags, ['late', 'night', 'music', 'pulse', 'cocktail']) ||
    hasTokenSignal(categories, ['bar', 'night', 'music', 'club'])
  const hasCulturalSignal =
    hasTokenSignal(tags, ['arts', 'curated', 'gallery', 'museum', 'historic']) ||
    hasTokenSignal(categories, ['museum', 'gallery', 'theater', 'arts'])
  const hasFamilySignal =
    hasTokenSignal(tags, ['family', 'kid', 'play', 'stroller', 'friendly']) ||
    hasTokenSignal(categories, ['park', 'playground', 'zoo', 'aquarium'])
  const hasHangSignal = hasTokenSignal(tags, ['hang', 'social', 'settle', 'neighborhood'])

  const socialDensity = clampUnit(
    (mix.drinks + mix.activity) * 0.52 + energy * 0.18 + noise * 0.15 + density * 0.15,
  )
  const calmness = clampUnit(
    (1 - energy) * 0.28 + (1 - noise) * 0.34 + intimacy * 0.2 + walkability * 0.18,
  )
  const nightlife = clampUnit(
    (mix.drinks + mix.activity) * 0.5 +
      energy * 0.22 +
      noise * 0.14 +
      (hasLateSignal ? 0.14 : 0),
  )
  const culturalAnchor = clampUnit(
    mix.culture * 0.34 +
      (hasCulturalSignal ? 0.18 : 0) +
      localSpecificity * 0.16 +
      momentPotential * 0.14 +
      (profile.meta.identityKind === 'known_neighborhood' ? 0.1 : 0),
  )
  const basecamp = clampUnit(
    (mix.cafe + mix.dining) * 0.36 +
      walkability * 0.24 +
      (1 - radiusNorm) * 0.2 +
      intimacy * 0.1 +
      (hasHangSignal ? 0.1 : 0),
  )
  const continuity = clampUnit(
    (1 - radiusNorm) * 0.4 + walkability * 0.35 + intimacy * 0.1 + momentPotential * 0.15,
  )
  const exploration = clampUnit(
    categoryDiversity * 0.34 +
      localSpecificity * 0.28 +
      mix.culture * 0.14 +
      density * 0.12 +
      radiusNorm * 0.12,
  )
  const momentum = clampUnit(socialDensity * 0.42 + nightlife * 0.33 + exploration * 0.25)
  const highlightPotential = clampUnit(
    momentPotential * 0.3 +
      mix.dining * 0.2 +
      mix.culture * 0.18 +
      mix.activity * 0.12 +
      localSpecificity * 0.1 +
      intimacy * 0.1,
  )
  const distributedPotential = clampUnit(
    categoryDiversity * 0.42 + mixEvenness * 0.28 + exploration * 0.15 + walkability * 0.15,
  )
  const familyFriendly = clampUnit(
    calmness * 0.34 +
      walkability * 0.24 +
      (1 - radiusNorm) * 0.17 +
      (mix.activity * 0.08 + mix.cafe * 0.08 + mix.dining * 0.09) +
      (hasFamilySignal ? 0.12 : 0) -
      nightlife * 0.2,
  )
  const movementContainedFit = clampUnit(
    (1 - radiusNorm) * 0.48 + walkability * 0.32 + calmness * 0.2,
  )
  const movementCompressedFit = clampUnit(
    (1 - radiusNorm) * 0.42 + walkability * 0.33 + basecamp * 0.25,
  )
  const movementModerateFit = clampUnit(
    clampUnit(1 - Math.abs(radiusNorm - 0.45) * 1.8) * 0.5 + walkability * 0.25 + exploration * 0.25,
  )
  const movementExploratoryFit = clampUnit(
    exploration * 0.5 + radiusNorm * 0.2 + density * 0.1 + localSpecificity * 0.2,
  )

  return {
    socialDensity,
    calmness,
    nightlife,
    culturalAnchor,
    basecamp,
    familyFriendly,
    continuity,
    exploration,
    momentum,
    highlightPotential,
    distributedPotential,
    intimacy,
    radiusNorm,
    movementContainedFit,
    movementCompressedFit,
    movementModerateFit,
    movementExploratoryFit,
  }
}

function getMovementFitScore(
  features: ContractAwareDistrictFeatures,
  movementTolerance: ContractConstraints['movementTolerance'],
): number {
  if (movementTolerance === 'contained') {
    return features.movementContainedFit
  }
  if (movementTolerance === 'compressed') {
    return features.movementCompressedFit
  }
  if (movementTolerance === 'moderate') {
    return features.movementModerateFit
  }
  return features.movementExploratoryFit
}

function rankDistrictProfilesWithContract(params: {
  ranked: RankedPocket[]
  experienceContract?: ExperienceContract
  contractConstraints?: ContractConstraints
}): ContractAwareDistrictRankingResult {
  const { ranked, experienceContract, contractConstraints } = params
  if (!experienceContract || !contractConstraints || ranked.length === 0) {
    return {
      applied: false,
      ranked,
      pocketDebugById: {},
    }
  }
  const normalizedVibe = normalizeExperienceContractVibe(experienceContract.vibe)
  const pressureTemplate =
    CONTRACT_DISTRICT_PRESSURE_V0_1_MATRIX[experienceContract.persona][normalizedVibe]

  const evaluated = ranked.map((entry) => {
    const features = computeContractAwareDistrictFeatures(entry.profile)
    const reasons: string[] = []
    let delta = 0
    const register = (contribution: number, positiveReason: string, negativeReason: string): void => {
      delta += contribution
      if (contribution >= 0.045) {
        reasons.push(positiveReason)
      } else if (contribution <= -0.045) {
        reasons.push(negativeReason)
      }
    }

    const socialBandFit = getBandFit(features.socialDensity, contractConstraints.socialDensityBand)
    register(
      (socialBandFit - 0.5) * 0.3,
      `density aligned:${contractConstraints.socialDensityBand}`,
      `density mismatch:${contractConstraints.socialDensityBand}`,
    )

    const movementFit = getMovementFitScore(features, contractConstraints.movementTolerance)
    register(
      (movementFit - 0.5) * 0.28,
      `movement fit:${contractConstraints.movementTolerance}`,
      `movement stretch:${contractConstraints.movementTolerance}`,
    )

    if (pressureTemplate.preferCalm) {
      register((features.calmness - 0.5) * 0.18, 'calm pocket support', 'insufficient calm profile')
    }
    if (pressureTemplate.preferNightlife) {
      register((features.nightlife - 0.5) * 0.18, 'nightlife adjacency support', 'nightlife adjacency thin')
    }
    if (pressureTemplate.suppressNightlife) {
      register((0.5 - features.nightlife) * 0.2, 'nightlife pressure suppressed', 'nightlife pressure too strong')
    }
    if (pressureTemplate.preferCulturalAnchor) {
      register(
        (features.culturalAnchor - 0.5) * 0.2,
        'cultural anchor support',
        'cultural anchor signal thin',
      )
    }
    if (pressureTemplate.preferBasecamp) {
      register((features.basecamp - 0.5) * 0.16, 'basecamp viability support', 'basecamp viability thin')
    }
    if (pressureTemplate.preferFamilyFriendly) {
      register(
        (features.familyFriendly - 0.5) * 0.22,
        'family-friendly recovery support',
        'family-friendly recovery thin',
      )
    }
    if (pressureTemplate.preferExploration) {
      register(
        (features.exploration - 0.5) * 0.14,
        'exploration density support',
        'exploration density thin',
      )
    }
    if (pressureTemplate.preferIntimacy) {
      register((features.intimacy - 0.5) * 0.12, 'intimacy support', 'intimacy thin')
    }
    if (pressureTemplate.preferMomentum) {
      register((features.momentum - 0.5) * 0.14, 'momentum support', 'momentum potential thin')
    }
    if (pressureTemplate.preferContained) {
      register((0.5 - features.radiusNorm) * 0.1, 'contained footprint support', 'footprint too spread')
    }

    if (contractConstraints.requireContinuity) {
      register((features.continuity - 0.5) * 0.2, 'continuity support', 'continuity risk')
    }
    if (contractConstraints.requireEscalation) {
      register((features.momentum - 0.5) * 0.16, 'escalation path support', 'escalation path thin')
    }
    if (contractConstraints.requireRecoveryWindows) {
      register((features.calmness - 0.5) * 0.16, 'recovery window support', 'recovery window thin')
    }
    if (!contractConstraints.allowLateHighEnergy) {
      register((0.5 - features.nightlife) * 0.12, 'late-energy bounded', 'late-energy risk')
    }
    if (contractConstraints.groupBasecampPreferred) {
      register((features.basecamp - 0.5) * 0.1, 'group basecamp support', 'group basecamp weak')
    }
    if (contractConstraints.kidEngagementRequired) {
      register((features.familyFriendly - 0.5) * 0.14, 'kid engagement support', 'kid engagement risk')
    }
    if (contractConstraints.adultPayoffRequired) {
      register((features.highlightPotential - 0.5) * 0.1, 'adult payoff support', 'adult payoff thin')
    }
    if (contractConstraints.multiAnchorAllowed) {
      register(
        (features.distributedPotential - 0.5) * 0.08,
        'multi-anchor friendly',
        'single-anchor leaning',
      )
    }

    if (contractConstraints.highlightPressure === 'strong') {
      register((features.highlightPotential - 0.5) * 0.16, 'strong centerpiece support', 'centerpiece signal thin')
    } else if (contractConstraints.highlightPressure === 'distributed') {
      register(
        (features.distributedPotential - 0.5) * 0.16,
        'distributed highlight support',
        'distributed highlight thin',
      )
    } else {
      register((features.highlightPotential - 0.5) * 0.08, 'moderate anchor support', 'moderate anchor thin')
    }

    if (contractConstraints.peakCountModel === 'single') {
      register((features.highlightPotential - 0.5) * 0.12, 'single-peak viability', 'single-peak instability')
    } else if (contractConstraints.peakCountModel === 'multi') {
      register((features.momentum - 0.5) * 0.12, 'multi-peak viability', 'multi-peak thin')
    } else if (contractConstraints.peakCountModel === 'distributed') {
      register(
        (features.distributedPotential - 0.5) * 0.12,
        'distributed-peak viability',
        'distributed-peak thin',
      )
    } else {
      register(
        ((features.culturalAnchor + features.continuity) / 2 - 0.5) * 0.12,
        'cumulative progression viability',
        'cumulative progression thin',
      )
    }

    if (contractConstraints.maxEnergyDropTolerance === 'low') {
      register(
        ((features.momentum + features.continuity) / 2 - 0.5) * 0.08,
        'low-drop continuity support',
        'energy-drop risk',
      )
    } else if (contractConstraints.maxEnergyDropTolerance === 'high') {
      register(
        (features.distributedPotential - 0.5) * 0.06,
        'high-drop tolerance support',
        'variance tolerance thin',
      )
    }

    if (contractConstraints.windDownStrictness === 'soft_required') {
      register((features.calmness - 0.5) * 0.1, 'soft landing support', 'soft landing thin')
    } else if (contractConstraints.windDownStrictness === 'flexible') {
      register((features.exploration - 0.5) * 0.06, 'flex close support', 'flex close thin')
    }

    const boundedDelta = Math.max(-0.34, Math.min(0.34, delta))
    const adjustedScore = Number((entry.score + boundedDelta).toFixed(4))
    const fitLabel: ContractAwarePocketRankingDebug['contractFitLabel'] =
      boundedDelta >= 0.12 ? 'strong_fit' : boundedDelta <= -0.08 ? 'weak_fit' : 'balanced_fit'
    const fitReasons = reasons.slice(0, 4)

    return {
      entry,
      adjustedScore,
      debug: {
        pocketId: entry.profile.pocketId,
        baseScore: Number(entry.score.toFixed(4)),
        adjustedScore,
        contractFitDelta: Number(boundedDelta.toFixed(4)),
        contractFitLabel: fitLabel,
        contractFitReasons: fitReasons,
      } satisfies ContractAwarePocketRankingDebug,
    }
  })

  evaluated.sort((left, right) => {
    if (right.adjustedScore !== left.adjustedScore) {
      return right.adjustedScore - left.adjustedScore
    }
    if (right.debug.contractFitDelta !== left.debug.contractFitDelta) {
      return right.debug.contractFitDelta - left.debug.contractFitDelta
    }
    return left.entry.rank - right.entry.rank
  })

  const pocketDebugById: Record<string, ContractAwarePocketRankingDebug> = {}
  const reranked: RankedPocket[] = evaluated.map((entry, index) => {
    const contractReasonLine = `Contract fit ${pressureTemplate.label} ${formatSignedScore(entry.debug.contractFitDelta)}`
    pocketDebugById[entry.entry.profile.pocketId] = entry.debug
    return {
      ...entry.entry,
      rank: index + 1,
      score: entry.adjustedScore,
      reasons: [...entry.entry.reasons.slice(0, 3), contractReasonLine],
    }
  })

  return {
    applied: true,
    ranked: reranked,
    pocketDebugById,
  }
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


type ContractGateSignalKey =
  | 'socialDensity'
  | 'multiPeakCapability'
  | 'experientialRichness'
  | 'activationLevel'
  | 'nightlifeAdjacency'
  | 'calmness'
  | 'intimacy'
  | 'containedMovement'
  | 'softLandingCompatibility'
  | 'scenicDestinationIntimacy'
  | 'culturalAnchorStrength'
  | 'reflectiveContinuity'
  | 'thematicProgression'
  | 'groupThroughput'
  | 'lateCapability'
  | 'crawlBasecampCompatibility'
  | 'easyHangComfort'
  | 'moderateDensity'
  | 'conversationalAnchorStrength'
  | 'exploratoryVariety'
  | 'multiAnchorEnrichment'
  | 'familyCompatibility'
  | 'lowFrictionMovement'
  | 'resetRecoverySupport'
  | 'activeEngagement'
  | 'boundedEnergy'
  | 'learningEnrichment'
  | 'clusteredEnrichment'
  | 'decompressionSupport'
  | 'flatCalmOnly'
  | 'utilitarianFoodCluster'
  | 'homogeneousLowContrast'
  | 'loudDiffuseNightlife'
  | 'highChurnNightlife'
  | 'overSocialDensity'
  | 'genericNightlifeFirst'
  | 'lowMeaningFiller'
  | 'quietIntimacyFirst'
  | 'lowCarryMomentum'
  | 'brittleHighPressureNightlife'
  | 'overFormalDestinationIntensity'
  | 'lowSubstanceSocialFiller'
  | 'nightlifeHeavyDistrict'
  | 'highFrictionSpread'
  | 'adultNightlifePulse'
  | 'chaoticLateEnergy'
  | 'nightlifeFirstLowEnrichment'

type ContractGateSignalThresholds = Partial<Record<ContractGateSignalKey, number>>

type ContractGateHardRequirement = {
  signal: ContractGateSignalKey
  min: number
  reason: string
}

type ContractGateProfile = {
  allowedSignals: ContractGateSignalThresholds
  preferredSignals: ContractGateSignalThresholds
  suppressedSignals: ContractGateSignalThresholds
  hardRequirements: ContractGateHardRequirement[]
  gateSummary: string
}

type ContractGatePocketStatus = 'allowed' | 'suppressed' | 'rejected' | 'fallback_admitted'

type ContractGatePocketDecision = {
  status: ContractGatePocketStatus
  allowedScore: number
  preferredScore: number
  suppressedScore: number
  hardPassed: boolean
  reasonSummary: string
  gateAdjustedScore: number
  hardFailureReasons: string[]
  greatStopPenaltyApplied?: number
  greatStopSuppressionApplied?: boolean
}

type ContractGateEvaluationResult = {
  applied: boolean
  summary: string
  strengthSummary: string
  rejectedCount: number
  allowedCount: number
  suppressedCount: number
  fallbackAdmittedCount: number
  allowedPreview: string[]
  suppressedPreview: string[]
  ranked: RankedPocket[]
  decisionByPocketId: Map<string, ContractGatePocketDecision>
}


const TARGET_DIRECTION_CANDIDATES = 3
const CONTRACT_GATE_BOOST_WEIGHT = 0.4
const CONTRACT_GATE_SUPPRESSION_WEIGHT = 0.64
const CONTRACT_GATE_MIN_ALLOWED_SCORE = 0.5
const CONTRACT_GATE_FALLBACK_MIN_SURVIVORS = TARGET_DIRECTION_CANDIDATES + 1
const CONTRACT_GATE_FALLBACK_RATIO_TRIGGER = 0.35
const CONTRACT_GATE_MAX_FALLBACK_ADMITS = 2

const CONTRACT_GATE_LIBRARY: Record<
  Exclude<DirectionStrategyFamily, 'adaptive'>,
  ContractGateProfile
> = {
  romantic_lively: {
    allowedSignals: {
      socialDensity: 0.6,
      multiPeakCapability: 0.58,
      experientialRichness: 0.58,
      activationLevel: 0.6,
      nightlifeAdjacency: 0.52,
    },
    preferredSignals: {
      socialDensity: 0.72,
      multiPeakCapability: 0.68,
      experientialRichness: 0.66,
      activationLevel: 0.7,
      nightlifeAdjacency: 0.62,
    },
    suppressedSignals: {
      flatCalmOnly: 0.48,
      utilitarianFoodCluster: 0.5,
      homogeneousLowContrast: 0.46,
      quietIntimacyFirst: 0.52,
      lowMeaningFiller: 0.52,
      highChurnNightlife: 0.58,
    },
    hardRequirements: [
      { signal: 'experientialRichness', min: 0.5, reason: 'richness_floor' },
      { signal: 'activationLevel', min: 0.5, reason: 'activation_floor' },
      { signal: 'multiPeakCapability', min: 0.48, reason: 'multi_peak_capability_required' },
      { signal: 'socialDensity', min: 0.46, reason: 'social_density_floor' },
    ],
    gateSummary: 'Pulse-capable romantic landscape with social lift, richness, and nightlife coherence.',
  },
  romantic_cozy: {
    allowedSignals: {
      calmness: 0.56,
      intimacy: 0.54,
      containedMovement: 0.54,
      softLandingCompatibility: 0.56,
      scenicDestinationIntimacy: 0.5,
    },
    preferredSignals: {
      calmness: 0.66,
      intimacy: 0.62,
      softLandingCompatibility: 0.64,
      scenicDestinationIntimacy: 0.58,
    },
    suppressedSignals: {
      loudDiffuseNightlife: 0.56,
      highChurnNightlife: 0.56,
      overSocialDensity: 0.66,
    },
    hardRequirements: [
      { signal: 'softLandingCompatibility', min: 0.48, reason: 'soft_landing_required' },
    ],
    gateSummary: 'Intimate calm-first reality with contained movement and soft landing compatibility.',
  },
  romantic_cultured: {
    allowedSignals: {
      culturalAnchorStrength: 0.54,
      reflectiveContinuity: 0.52,
      thematicProgression: 0.5,
    },
    preferredSignals: {
      culturalAnchorStrength: 0.62,
      reflectiveContinuity: 0.6,
      thematicProgression: 0.58,
    },
    suppressedSignals: {
      genericNightlifeFirst: 0.56,
      lowMeaningFiller: 0.56,
    },
    hardRequirements: [
      { signal: 'culturalAnchorStrength', min: 0.46, reason: 'cultural_anchor_required' },
    ],
    gateSummary: 'Culture-forward romantic reality with reflective continuity and thematic discovery.',
  },
  friends_lively: {
    allowedSignals: {
      groupThroughput: 0.54,
      socialDensity: 0.58,
      lateCapability: 0.5,
      crawlBasecampCompatibility: 0.52,
    },
    preferredSignals: {
      groupThroughput: 0.62,
      socialDensity: 0.66,
      lateCapability: 0.58,
      crawlBasecampCompatibility: 0.6,
    },
    suppressedSignals: {
      quietIntimacyFirst: 0.56,
      lowCarryMomentum: 0.56,
    },
    hardRequirements: [
      { signal: 'groupThroughput', min: 0.46, reason: 'group_throughput_required' },
    ],
    gateSummary: 'Group momentum landscape with social throughput, late-capability, and crawl compatibility.',
  },
  friends_cozy: {
    allowedSignals: {
      easyHangComfort: 0.56,
      moderateDensity: 0.5,
      containedMovement: 0.5,
    },
    preferredSignals: {
      easyHangComfort: 0.64,
      moderateDensity: 0.58,
      containedMovement: 0.58,
    },
    suppressedSignals: {
      brittleHighPressureNightlife: 0.56,
      overFormalDestinationIntensity: 0.56,
    },
    hardRequirements: [
      { signal: 'easyHangComfort', min: 0.48, reason: 'hang_comfort_required' },
    ],
    gateSummary: 'Easy-hang group reality with settle-in comfort and moderate social density.',
  },
  friends_cultured: {
    allowedSignals: {
      conversationalAnchorStrength: 0.54,
      exploratoryVariety: 0.5,
      multiAnchorEnrichment: 0.5,
    },
    preferredSignals: {
      conversationalAnchorStrength: 0.62,
      exploratoryVariety: 0.58,
      multiAnchorEnrichment: 0.58,
    },
    suppressedSignals: {
      lowSubstanceSocialFiller: 0.56,
    },
    hardRequirements: [
      { signal: 'conversationalAnchorStrength', min: 0.46, reason: 'conversation_anchor_required' },
    ],
    gateSummary: 'Conversation-led cultural group reality with exploratory enrichment anchors.',
  },
  family_cozy: {
    allowedSignals: {
      lowFrictionMovement: 0.56,
      resetRecoverySupport: 0.58,
      familyCompatibility: 0.54,
    },
    preferredSignals: {
      lowFrictionMovement: 0.64,
      resetRecoverySupport: 0.66,
      familyCompatibility: 0.62,
    },
    suppressedSignals: {
      nightlifeHeavyDistrict: 0.56,
      highFrictionSpread: 0.56,
    },
    hardRequirements: [
      { signal: 'familyCompatibility', min: 0.48, reason: 'family_compatibility_required' },
    ],
    gateSummary: 'Family-calm reality with reset support, low friction movement, and compatible pacing.',
  },
  family_lively: {
    allowedSignals: {
      activeEngagement: 0.52,
      boundedEnergy: 0.5,
      familyCompatibility: 0.52,
      resetRecoverySupport: 0.48,
    },
    preferredSignals: {
      activeEngagement: 0.6,
      boundedEnergy: 0.58,
      familyCompatibility: 0.6,
      resetRecoverySupport: 0.56,
    },
    suppressedSignals: {
      adultNightlifePulse: 0.56,
      chaoticLateEnergy: 0.56,
    },
    hardRequirements: [
      { signal: 'familyCompatibility', min: 0.48, reason: 'family_compatibility_required' },
      { signal: 'boundedEnergy', min: 0.44, reason: 'bounded_energy_required' },
    ],
    gateSummary: 'Active family reality with bounded energy, engagement, and reset compatibility.',
  },
  family_cultured: {
    allowedSignals: {
      learningEnrichment: 0.54,
      clusteredEnrichment: 0.52,
      decompressionSupport: 0.5,
    },
    preferredSignals: {
      learningEnrichment: 0.62,
      clusteredEnrichment: 0.6,
      decompressionSupport: 0.58,
    },
    suppressedSignals: {
      nightlifeFirstLowEnrichment: 0.56,
    },
    hardRequirements: [
      { signal: 'learningEnrichment', min: 0.46, reason: 'learning_anchor_required' },
    ],
    gateSummary: 'Learning-led family reality with clustered enrichment and decompression support.',
  },
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

function resolveStrategyFamilyFromInterpretation(
  context: BuildContractGateWorldContext,
): {
  family: DirectionStrategyFamily
  trace: ContractGateWorld['debug']['strategyFamilyResolution']
} {
  const canonicalResolution = context?.canonicalStrategyFamilyResolution
  const canonicalStrategyFamily =
    canonicalResolution?.resolvedFamily ?? context?.canonicalStrategyFamily
  const canonicalProvided = Boolean(canonicalStrategyFamily)
  const family = canonicalStrategyFamily ?? 'adaptive'
  const canonicalAmbiguous = canonicalResolution?.ambiguous ?? false
  const fallbackPathUsed = canonicalResolution?.fallbackUsed ?? !canonicalProvided
  const reasonSummary =
    canonicalResolution?.reasonSummary ??
    (canonicalProvided
      ? `canonical_strategy_family_received:${canonicalStrategyFamily}`
      : 'canonical_strategy_family_missing')
  return {
    family,
    trace: {
      resolvedFamily: family,
      canonicalStrategyFamilyProvided: canonicalProvided,
      canonicalStrategyFamily,
      canonicalStrategyFamilyAmbiguous: canonicalAmbiguous,
      fallbackPathUsed,
      source: canonicalResolution ? 'interpretation' : 'missing_canonical',
      reasonSummary,
    },
  }
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

function getLaneDiversityScore(
  mix: RankedPocket['profile']['tasteSignals']['hospitalityMix'],
): number {
  const laneValues = [mix.drinks, mix.dining, mix.culture, mix.cafe, mix.activity]
  const activeLaneCount = laneValues.filter((value) => value >= 0.16).length
  const maxLaneValue = Math.max(...laneValues)
  const activeLaneScore = clamp((activeLaneCount - 1) / 4, 0, 1)
  return clamp(activeLaneScore * 0.68 + (1 - maxLaneValue) * 0.32, 0, 1)
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


function getContractGateProfile(
  context: BuildContractGateWorldContext,
  resolvedFamilyOverride?: DirectionStrategyFamily,
): ContractGateProfile | undefined {
  const family = resolvedFamilyOverride ?? resolveStrategyFamilyFromInterpretation(context).family
  if (family === 'adaptive') {
    return undefined
  }
  const source = CONTRACT_GATE_LIBRARY[family]
  const allowedSignals: ContractGateSignalThresholds = { ...source.allowedSignals }
  const preferredSignals: ContractGateSignalThresholds = { ...source.preferredSignals }
  const suppressedSignals: ContractGateSignalThresholds = { ...source.suppressedSignals }
  const hardRequirements = source.hardRequirements.map((requirement) => ({ ...requirement }))
  const constraints = context?.contractConstraints

  const bump = (
    target: ContractGateSignalThresholds,
    key: ContractGateSignalKey,
    delta: number,
  ) => {
    const current = target[key]
    if (typeof current !== 'number') {
      return
    }
    target[key] = toFixed(clamp(current + delta, 0, 1))
  }

  if (constraints?.socialDensityBand === 'high' || constraints?.socialDensityBand === 'medium_high') {
    bump(allowedSignals, 'socialDensity', 0.04)
    bump(preferredSignals, 'socialDensity', 0.05)
    bump(preferredSignals, 'groupThroughput', 0.04)
  } else if (constraints?.socialDensityBand === 'low') {
    bump(allowedSignals, 'socialDensity', -0.06)
    bump(preferredSignals, 'socialDensity', -0.08)
    bump(preferredSignals, 'calmness', 0.04)
    bump(preferredSignals, 'softLandingCompatibility', 0.04)
  }

  if (constraints?.movementTolerance === 'contained' || constraints?.movementTolerance === 'compressed') {
    bump(allowedSignals, 'containedMovement', 0.04)
    bump(preferredSignals, 'containedMovement', 0.05)
    bump(preferredSignals, 'lowFrictionMovement', 0.05)
  } else if (constraints?.movementTolerance === 'exploratory') {
    bump(allowedSignals, 'exploratoryVariety', 0.04)
    bump(preferredSignals, 'exploratoryVariety', 0.05)
    bump(preferredSignals, 'thematicProgression', 0.04)
  }

  if (constraints?.peakCountModel === 'multi') {
    bump(allowedSignals, 'multiPeakCapability', 0.04)
    bump(preferredSignals, 'multiPeakCapability', 0.05)
  } else if (constraints?.peakCountModel === 'single') {
    bump(preferredSignals, 'scenicDestinationIntimacy', 0.04)
    bump(preferredSignals, 'intimacy', 0.03)
  }

  return {
    allowedSignals,
    preferredSignals,
    suppressedSignals,
    hardRequirements,
    gateSummary: source.gateSummary,
  }
}

function getContractGateSignals(
  entry: RankedPocket,
): Record<ContractGateSignalKey, number> {
  const profile = entry.profile
  const features = getDirectionStrategyFeatures(entry)
  const mix = profile.tasteSignals.hospitalityMix
  const tags = new Set(profile.tasteSignals.experientialTags.map((tag) => tag.toLowerCase()))
  const categoryDiversity = clamp(profile.coreSignals.categoryDiversity, 0, 1)
  const density = clamp(profile.coreSignals.density, 0, 1)
  const momentPotential = clamp(profile.tasteSignals.momentPotential, 0, 1)
  const laneDiversity = getLaneDiversityScore(mix)
  const energy = toAmbianceNumeric(profile.tasteSignals.ambianceProfile.energy)
  const noise = toAmbianceNumeric(profile.tasteSignals.ambianceProfile.noise)
  const nightlifeAdjacency = clamp(
    mix.drinks * 0.46 +
      mix.activity * 0.2 +
      (hasLateSeed(profile.tasteSignals.momentSeeds) ? 0.22 : 0) +
      (hasFlowSeed(profile.tasteSignals.momentSeeds) ? 0.12 : 0),
    0,
    1,
  )
  const multiPeakCapability = clamp(
    momentPotential * 0.5 + (mix.activity + mix.drinks) * 0.28 + categoryDiversity * 0.22,
    0,
    1,
  )
  const experientialRichness = clamp(
    momentPotential * 0.36 +
      categoryDiversity * 0.26 +
      laneDiversity * 0.18 +
      clamp(tags.size / 7, 0, 1) * 0.2,
    0,
    1,
  )
  const containedMovement = clamp(features.compactness * 0.58 + features.walkability * 0.42, 0, 1)
  const softLandingCompatibility = clamp(
    features.calmness * 0.5 + (1 - energy) * 0.2 + (mix.cafe + mix.dining) * 0.3,
    0,
    1,
  )
  const scenicDestinationIntimacy = clamp(features.scenicPotential * 0.62 + features.intimacy * 0.38, 0, 1)
  const thematicProgression = clamp(
    (hasFlowSeed(profile.tasteSignals.momentSeeds) ? 0.3 : 0) +
      features.culturalPotential * 0.4 +
      categoryDiversity * 0.3,
    0,
    1,
  )
  const groupThroughput = clamp(
    features.socialDensity * 0.52 + features.distributedPotential * 0.28 + features.walkability * 0.2,
    0,
    1,
  )
  const lateCapability = clamp(
    nightlifeAdjacency * 0.66 + (hasLateSeed(profile.tasteSignals.momentSeeds) ? 0.34 : 0),
    0,
    1,
  )
  const easyHangComfort = clamp(
    features.calmness * 0.34 +
      features.intimacy * 0.2 +
      (mix.dining + mix.cafe) * 0.32 +
      containedMovement * 0.14,
    0,
    1,
  )
  const moderateDensity = clamp(1 - Math.abs(features.socialDensity - 0.56) * 1.9, 0, 1)
  const conversationalAnchorStrength = clamp(
    features.culturalPotential * 0.38 + features.intimacy * 0.28 + features.calmness * 0.34,
    0,
    1,
  )
  const exploratoryVariety = clamp(
    features.explorationPotential * 0.48 + categoryDiversity * 0.26 + laneDiversity * 0.26,
    0,
    1,
  )
  const multiAnchorEnrichment = clamp(
    features.culturalPotential * 0.45 + exploratoryVariety * 0.35 + momentPotential * 0.2,
    0,
    1,
  )
  const familyCompatibility = clamp(
    features.familyPotential * 0.5 + features.calmness * 0.22 + containedMovement * 0.28,
    0,
    1,
  )
  const resetRecoverySupport = clamp(
    features.calmness * 0.52 + containedMovement * 0.28 + familyCompatibility * 0.2,
    0,
    1,
  )
  const activeEngagement = clamp(
    features.familyPotential * 0.42 + features.socialDensity * 0.24 + momentPotential * 0.34,
    0,
    1,
  )
  const boundedEnergy = clamp(
    (1 - Math.abs(energy - 0.58) * 1.8) * 0.58 + containedMovement * 0.42,
    0,
    1,
  )
  const learningEnrichment = clamp(features.culturalPotential * 0.62 + momentPotential * 0.38, 0, 1)
  const clusteredEnrichment = clamp(learningEnrichment * 0.56 + containedMovement * 0.44, 0, 1)
  const decompressionSupport = clamp(features.calmness * 0.56 + (1 - features.socialDensity) * 0.24 + containedMovement * 0.2, 0, 1)
  const lowMeaningFiller = clamp(
    (1 - momentPotential) * 0.38 + (1 - features.culturalPotential) * 0.36 + (1 - categoryDiversity) * 0.26,
    0,
    1,
  )

  return {
    socialDensity: features.socialDensity,
    multiPeakCapability,
    experientialRichness,
    activationLevel: clamp(energy * 0.42 + features.socialDensity * 0.4 + momentPotential * 0.18, 0, 1),
    nightlifeAdjacency,
    calmness: features.calmness,
    intimacy: features.intimacy,
    containedMovement,
    softLandingCompatibility,
    scenicDestinationIntimacy,
    culturalAnchorStrength: clamp(features.culturalPotential * 0.56 + momentPotential * 0.26 + mix.culture * 0.18, 0, 1),
    reflectiveContinuity: clamp(features.calmness * 0.36 + features.culturalPotential * 0.34 + (hasFlowSeed(profile.tasteSignals.momentSeeds) ? 0.3 : 0), 0, 1),
    thematicProgression,
    groupThroughput,
    lateCapability,
    crawlBasecampCompatibility: clamp(containedMovement * 0.46 + features.socialDensity * 0.34 + features.distributedPotential * 0.2, 0, 1),
    easyHangComfort,
    moderateDensity,
    conversationalAnchorStrength,
    exploratoryVariety,
    multiAnchorEnrichment,
    familyCompatibility,
    lowFrictionMovement: containedMovement,
    resetRecoverySupport,
    activeEngagement,
    boundedEnergy,
    learningEnrichment,
    clusteredEnrichment,
    decompressionSupport,
    flatCalmOnly: clamp(features.calmness * 0.58 + (1 - momentPotential) * 0.42, 0, 1),
    utilitarianFoodCluster: clamp((mix.dining + mix.cafe) * 0.54 + (1 - features.culturalPotential) * 0.22 + (1 - momentPotential) * 0.24, 0, 1),
    homogeneousLowContrast: clamp((1 - categoryDiversity) * 0.5 + (1 - laneDiversity) * 0.3 + (1 - features.explorationPotential) * 0.2, 0, 1),
    loudDiffuseNightlife: clamp(features.socialDensity * 0.42 + energy * 0.3 + noise * 0.16 + (1 - features.compactness) * 0.12, 0, 1),
    highChurnNightlife: clamp(features.socialDensity * 0.4 + energy * 0.26 + features.explorationPotential * 0.22 + (1 - features.intimacy) * 0.12, 0, 1),
    overSocialDensity: features.socialDensity,
    genericNightlifeFirst: clamp(nightlifeAdjacency * 0.56 + (1 - features.culturalPotential) * 0.44, 0, 1),
    lowMeaningFiller,
    quietIntimacyFirst: clamp(features.calmness * 0.42 + features.intimacy * 0.34 + (1 - features.socialDensity) * 0.24, 0, 1),
    lowCarryMomentum: clamp((1 - groupThroughput) * 0.7 + (1 - momentPotential) * 0.3, 0, 1),
    brittleHighPressureNightlife: clamp(nightlifeAdjacency * 0.44 + energy * 0.2 + (1 - easyHangComfort) * 0.36, 0, 1),
    overFormalDestinationIntensity: clamp(scenicDestinationIntimacy * 0.5 + (1 - moderateDensity) * 0.3 + (1 - groupThroughput) * 0.2, 0, 1),
    lowSubstanceSocialFiller: clamp(features.socialDensity * 0.44 + (1 - features.culturalPotential) * 0.3 + (1 - momentPotential) * 0.26, 0, 1),
    nightlifeHeavyDistrict: nightlifeAdjacency,
    highFrictionSpread: clamp((1 - features.compactness) * 0.54 + (1 - features.walkability) * 0.26 + features.explorationPotential * 0.2, 0, 1),
    adultNightlifePulse: clamp(nightlifeAdjacency * 0.54 + (1 - familyCompatibility) * 0.46, 0, 1),
    chaoticLateEnergy: clamp(lateCapability * 0.44 + energy * 0.24 + (1 - containedMovement) * 0.32, 0, 1),
    nightlifeFirstLowEnrichment: clamp(nightlifeAdjacency * 0.56 + (1 - learningEnrichment) * 0.44, 0, 1),
  }
}

function evaluateContractGateDecision(params: {
  entry: RankedPocket
  gateProfile: ContractGateProfile
  greatStopSignal?: GreatStopDownstreamSignal
}): ContractGatePocketDecision {
  const { entry, gateProfile, greatStopSignal } = params
  const signals = getContractGateSignals(entry)
  const allowed = evaluateSignalThresholds(signals, gateProfile.allowedSignals)
  const preferred = evaluateSignalThresholds(signals, gateProfile.preferredSignals)
  const suppressed = evaluateSignalThresholds(signals, gateProfile.suppressedSignals)
  const hardFailureReasons = gateProfile.hardRequirements
    .filter((requirement) => signals[requirement.signal] < requirement.min)
    .map((requirement) => requirement.reason)
  const hardPassed = hardFailureReasons.length === 0
  const suppressionScore = suppressed.triggered ? suppressed.score : 0
  const greatStopPenaltyApplied =
    greatStopSignal?.available === true ? greatStopSignal.degradedConfidencePenalty : 0
  const gateAdjustedScore = toFixed(
    clamp(
      entry.score +
        allowed.score * (CONTRACT_GATE_BOOST_WEIGHT * 0.42) +
        preferred.score * (CONTRACT_GATE_BOOST_WEIGHT * 0.58) -
        suppressionScore * CONTRACT_GATE_SUPPRESSION_WEIGHT -
        greatStopPenaltyApplied -
        (hardPassed ? 0 : 0.36),
      0,
      1,
    ),
  )
  const shouldSuppressForGreatStop =
    greatStopSignal?.suppressionRecommended === true &&
    greatStopSignal.severeFailureCount >= 2 &&
    allowed.score < 0.74

  if (!hardPassed) {
    return {
      status: 'rejected',
      allowedScore: allowed.score,
      preferredScore: preferred.score,
      suppressedScore: suppressionScore,
      hardPassed,
      reasonSummary: `hard_requirements_failed:${hardFailureReasons.join('+')}`,
      gateAdjustedScore,
      hardFailureReasons,
      greatStopPenaltyApplied,
      greatStopSuppressionApplied: false,
    }
  }
  if (allowed.score < CONTRACT_GATE_MIN_ALLOWED_SCORE) {
    return {
      status: 'rejected',
      allowedScore: allowed.score,
      preferredScore: preferred.score,
      suppressedScore: suppressionScore,
      hardPassed,
      reasonSummary: 'allowed_floor_not_met',
      gateAdjustedScore,
      hardFailureReasons,
      greatStopPenaltyApplied,
      greatStopSuppressionApplied: false,
    }
  }
  if (preferred.score < 0.42 && allowed.score < 0.58) {
    return {
      status: 'rejected',
      allowedScore: allowed.score,
      preferredScore: preferred.score,
      suppressedScore: suppressionScore,
      hardPassed,
      reasonSummary: 'preferred_fit_too_weak',
      gateAdjustedScore,
      hardFailureReasons,
      greatStopPenaltyApplied,
      greatStopSuppressionApplied: false,
    }
  }
  if (suppressed.triggered && suppressionScore >= 0.56 && allowed.score < 0.64) {
    return {
      status: 'rejected',
      allowedScore: allowed.score,
      preferredScore: preferred.score,
      suppressedScore: suppressionScore,
      hardPassed,
      reasonSummary: 'suppressed_blocked',
      gateAdjustedScore,
      hardFailureReasons,
      greatStopPenaltyApplied,
      greatStopSuppressionApplied: false,
    }
  }
  if (shouldSuppressForGreatStop) {
    return {
      status: 'suppressed',
      allowedScore: allowed.score,
      preferredScore: preferred.score,
      suppressedScore: suppressionScore,
      hardPassed,
      reasonSummary: 'great_stop_severe_suppression',
      gateAdjustedScore,
      hardFailureReasons,
      greatStopPenaltyApplied,
      greatStopSuppressionApplied: true,
    }
  }
  if (
    suppressed.triggered &&
    suppressionScore >= 0.5 &&
    !(preferred.score >= 0.74 && allowed.score >= 0.68)
  ) {
    return {
      status: 'suppressed',
      allowedScore: allowed.score,
      preferredScore: preferred.score,
      suppressedScore: suppressionScore,
      hardPassed,
      reasonSummary: 'suppressed_pressure_strong',
      gateAdjustedScore,
      hardFailureReasons,
      greatStopPenaltyApplied,
      greatStopSuppressionApplied: false,
    }
  }
  if (suppressed.triggered) {
    return {
      status: 'suppressed',
      allowedScore: allowed.score,
      preferredScore: preferred.score,
      suppressedScore: suppressionScore,
      hardPassed,
      reasonSummary: 'suppressed_pressure_moderate',
      gateAdjustedScore,
      hardFailureReasons,
      greatStopPenaltyApplied,
      greatStopSuppressionApplied: false,
    }
  }
  const reasonSummary =
    greatStopSignal?.passesNight === false
      ? 'contract_aligned|great_stop_degraded'
      : 'contract_aligned'
  return {
    status: 'allowed',
    allowedScore: allowed.score,
    preferredScore: preferred.score,
    suppressedScore: suppressionScore,
    hardPassed,
    reasonSummary,
    gateAdjustedScore,
    hardFailureReasons,
    greatStopPenaltyApplied,
    greatStopSuppressionApplied: false,
  }
}

function applyContractGate(params: {
  ranked: RankedPocket[]
  context: BuildContractGateWorldContext
  gateProfileOverride?: ContractGateProfile
}): ContractGateEvaluationResult {
  const { ranked, context, gateProfileOverride } = params
  const gateProfile = gateProfileOverride ?? getContractGateProfile(context)
  if (!gateProfile) {
    return {
      applied: false,
      summary: 'adaptive flow; contract gate not applied',
      strengthSummary: `rejected=0 | allowed=${ranked.length} | suppressed=0 | fallback=0`,
      rejectedCount: 0,
      allowedCount: ranked.length,
      suppressedCount: 0,
      fallbackAdmittedCount: 0,
      allowedPreview: ranked.slice(0, 3).map((entry) => entry.profile.pocketId),
      suppressedPreview: [],
      ranked,
      decisionByPocketId: new Map(
        ranked.map((entry) => [
          entry.profile.pocketId,
          {
            status: 'allowed',
            allowedScore: 0.5,
            preferredScore: 0.5,
            suppressedScore: 0,
            hardPassed: true,
            reasonSummary: 'no_gate_profile',
            gateAdjustedScore: entry.score,
            hardFailureReasons: [],
            greatStopPenaltyApplied: 0,
            greatStopSuppressionApplied: false,
          } as ContractGatePocketDecision,
        ]),
      ),
    }
  }

  const decisionByPocketId = new Map<string, ContractGatePocketDecision>()
  const decorated = ranked.map((entry) => {
    const decision = evaluateContractGateDecision({
      entry,
      gateProfile,
      greatStopSignal: context.greatStopAdmissibilitySignal,
    })
    decisionByPocketId.set(entry.profile.pocketId, decision)
    return { entry, decision }
  })

  const allowed = decorated.filter(({ decision }) => decision.status === 'allowed')
  const suppressed = decorated.filter(({ decision }) => decision.status === 'suppressed')
  const admitted = allowed
    .slice()
    .sort((left, right) => {
      if (right.decision.gateAdjustedScore !== left.decision.gateAdjustedScore) {
        return right.decision.gateAdjustedScore - left.decision.gateAdjustedScore
      }
      return left.entry.rank - right.entry.rank
    })

  const minimumSurvivors = Math.min(ranked.length, Math.max(CONTRACT_GATE_FALLBACK_MIN_SURVIVORS, 4))
  const fallbackRatioGate = admitted.length < Math.ceil(ranked.length * CONTRACT_GATE_FALLBACK_RATIO_TRIGGER)
  if (admitted.length < minimumSurvivors && fallbackRatioGate) {
    const suppressedFallback = suppressed
      .slice()
      .sort((left, right) => {
        if (right.decision.gateAdjustedScore !== left.decision.gateAdjustedScore) {
          return right.decision.gateAdjustedScore - left.decision.gateAdjustedScore
        }
        return left.entry.rank - right.entry.rank
      })
    const suppressedNeeded = Math.min(
      CONTRACT_GATE_MAX_FALLBACK_ADMITS,
      minimumSurvivors - admitted.length,
    )
    suppressedFallback.slice(0, suppressedNeeded).forEach(({ entry, decision }) => {
      decision.status = 'fallback_admitted'
      decision.reasonSummary = `${decision.reasonSummary}|suppressed_fallback_for_coverage`
      admitted.push({ entry, decision })
      decisionByPocketId.set(entry.profile.pocketId, decision)
    })
  }

  if (admitted.length < TARGET_DIRECTION_CANDIDATES) {
    const coverageFallback = decorated
      .filter(
        ({ decision }) =>
          decision.status === 'rejected' &&
          decision.hardPassed &&
          !decision.reasonSummary.startsWith('hard_requirements_failed'),
      )
      .sort((left, right) => {
        if (right.decision.gateAdjustedScore !== left.decision.gateAdjustedScore) {
          return right.decision.gateAdjustedScore - left.decision.gateAdjustedScore
        }
        return left.entry.rank - right.entry.rank
      })
    const needed = Math.min(
      CONTRACT_GATE_MAX_FALLBACK_ADMITS,
      TARGET_DIRECTION_CANDIDATES - admitted.length,
    )
    coverageFallback.slice(0, needed).forEach(({ entry, decision }) => {
      decision.status = 'fallback_admitted'
      decision.reasonSummary = `${decision.reasonSummary}|fallback_admitted_for_coverage`
      admitted.push({ entry, decision })
      decisionByPocketId.set(entry.profile.pocketId, decision)
    })
  }

  if (admitted.length === 0 && ranked.length > 0) {
    ranked.slice(0, Math.min(6, ranked.length)).forEach((entry) => {
      const existingDecision = decisionByPocketId.get(entry.profile.pocketId)
      const fallbackDecision: ContractGatePocketDecision = {
        status: 'fallback_admitted',
        allowedScore: existingDecision?.allowedScore ?? 0,
        preferredScore: existingDecision?.preferredScore ?? 0,
        suppressedScore: existingDecision?.suppressedScore ?? 0,
        hardPassed: existingDecision?.hardPassed ?? false,
        reasonSummary: `${existingDecision?.reasonSummary ?? 'gate_rejected'}|global_fallback_admitted`,
        gateAdjustedScore: existingDecision?.gateAdjustedScore ?? entry.score,
        hardFailureReasons: existingDecision?.hardFailureReasons ?? [],
        greatStopPenaltyApplied: existingDecision?.greatStopPenaltyApplied ?? 0,
        greatStopSuppressionApplied: existingDecision?.greatStopSuppressionApplied ?? false,
      }
      decisionByPocketId.set(entry.profile.pocketId, fallbackDecision)
      admitted.push({ entry, decision: fallbackDecision })
    })
  }

  admitted.sort((left, right) => {
    if (right.decision.gateAdjustedScore !== left.decision.gateAdjustedScore) {
      return right.decision.gateAdjustedScore - left.decision.gateAdjustedScore
    }
    return left.entry.rank - right.entry.rank
  })

  const rejectedCount = decorated.filter(({ decision }) => decision.status === 'rejected').length
  const allowedCount = decorated.filter(({ decision }) => decision.status === 'allowed').length
  const suppressedCount = decorated.filter(({ decision }) => decision.status === 'suppressed').length
  const fallbackAdmittedCount = decorated.filter(
    ({ decision }) => decision.status === 'fallback_admitted',
  ).length
  const strengthSummary = `rejected=${rejectedCount} | allowed=${allowedCount} | suppressed=${suppressedCount} | fallback=${fallbackAdmittedCount}`
  const allowedPreview = admitted.slice(0, 3).map(({ entry }) => entry.profile.pocketId)
  const suppressedPreview = decorated
    .filter(
      ({ decision }) =>
        decision.status === 'suppressed' ||
        decision.reasonSummary.startsWith('suppressed'),
    )
    .slice(0, 3)
    .map(({ entry }) => entry.profile.pocketId)

  return {
    applied: true,
    summary: gateProfile.gateSummary,
    strengthSummary,
    rejectedCount,
    allowedCount,
    suppressedCount,
    fallbackAdmittedCount,
    allowedPreview,
    suppressedPreview,
    ranked: admitted.map(({ entry }) => entry),
    decisionByPocketId,
  }
}


function hasFlowSeed(seeds: string[]): boolean {
  return seeds.some((seed) => /->|→|\bthen\b/i.test(seed))
}

function hasLateSeed(seeds: string[]): boolean {
  return seeds.some((seed) => /(late|night|cocktail|wine bar|music|after)/i.test(seed))
}


export function buildContractGateWorld(input: BuildContractGateWorldInput): ContractGateWorld {
  const hasExperienceContract = Boolean(input.context?.experienceContract)
  const hasContractConstraints = Boolean(input.context?.contractConstraints)
  console.assert(
    hasExperienceContract === hasContractConstraints,
    '[ARC-BOUNDARY] ContractGateWorld expects experienceContract + contractConstraints together.',
  )
  const sortedRanked = input.ranked
    .slice()
    .sort((left, right) => left.rank - right.rank)
  const strategyFamilyResolution = resolveStrategyFamilyFromInterpretation(input.context ?? {})

  const contractAwareRanking = rankDistrictProfilesWithContract({
    ranked: sortedRanked,
    experienceContract: input.context?.experienceContract,
    contractConstraints: input.context?.contractConstraints,
  })

  const gateEvaluation = applyContractGate({
    ranked: contractAwareRanking.ranked,
    context: input.context,
    gateProfileOverride: getContractGateProfile(
      input.context ?? {},
      strategyFamilyResolution.family,
    ),
  })

  const decisionByPocketId: Record<string, ContractGatePocketDecisionLog> = {}
  const greatStopReasonSuffix =
    input.context?.greatStopAdmissibilitySignal?.available &&
    input.context.greatStopAdmissibilitySignal.riskTier !== 'none'
      ? `|great_stop_risk:${input.context.greatStopAdmissibilitySignal.riskTier}`
      : ''
  gateEvaluation.decisionByPocketId.forEach((decision, pocketId) => {
    decisionByPocketId[pocketId] = {
      pocketId,
      status: decision.status,
      allowedScore: decision.allowedScore,
      preferredScore: decision.preferredScore,
      suppressedScore: decision.suppressedScore,
      hardPassed: decision.hardPassed,
      reasonSummary: `${decision.reasonSummary}${greatStopReasonSuffix}`,
      gateAdjustedScore: decision.gateAdjustedScore,
      hardFailureReasons: [...decision.hardFailureReasons],
      greatStop:
        input.context?.greatStopAdmissibilitySignal?.available
          ? {
              riskTier: input.context.greatStopAdmissibilitySignal.riskTier,
              failedStopCount: input.context.greatStopAdmissibilitySignal.failedStopCount,
              severeFailureCount: input.context.greatStopAdmissibilitySignal.severeFailureCount,
              suppressionRecommended:
                input.context.greatStopAdmissibilitySignal.suppressionRecommended,
              penaltyApplied: decision.greatStopPenaltyApplied ?? 0,
              reasonCodes: [...input.context.greatStopAdmissibilitySignal.reasonCodes],
            }
          : undefined,
    }
  })

  const decisionLog = contractAwareRanking.ranked.map((entry) => {
    const decision = decisionByPocketId[entry.profile.pocketId]
    return (
      decision ?? {
        pocketId: entry.profile.pocketId,
        status: 'allowed',
        allowedScore: 0.5,
        preferredScore: 0.5,
        suppressedScore: 0,
        hardPassed: true,
        reasonSummary: `gate_not_evaluated${greatStopReasonSuffix}`,
        gateAdjustedScore: entry.score,
        hardFailureReasons: [],
        greatStop:
          input.context?.greatStopAdmissibilitySignal?.available
            ? {
                riskTier: input.context.greatStopAdmissibilitySignal.riskTier,
                failedStopCount: input.context.greatStopAdmissibilitySignal.failedStopCount,
                severeFailureCount: input.context.greatStopAdmissibilitySignal.severeFailureCount,
                suppressionRecommended:
                  input.context.greatStopAdmissibilitySignal.suppressionRecommended,
                penaltyApplied: 0,
                reasonCodes: [...input.context.greatStopAdmissibilitySignal.reasonCodes],
              }
            : undefined,
      }
    )
  })

  const suppressedPockets = contractAwareRanking.ranked.filter((entry) => {
    const decision = decisionByPocketId[entry.profile.pocketId]
    return decision?.status === 'suppressed'
  })
  const rejectedPockets = contractAwareRanking.ranked.filter((entry) => {
    const decision = decisionByPocketId[entry.profile.pocketId]
    return decision?.status === 'rejected'
  })

  return {
    contractConstraints: input.context?.contractConstraints ?? null,
    gateSummary: gateEvaluation.summary,
    gateStrengthSummary: gateEvaluation.strengthSummary,
    admittedPockets: gateEvaluation.ranked,
    suppressedPockets,
    rejectedPockets,
    hardRequirementResults: decisionLog.map((decision) => ({
      pocketId: decision.pocketId,
      passed: decision.hardPassed,
      hardFailureReasons: [...decision.hardFailureReasons],
    })),
    decisionLog,
    decisionByPocketId,
    contractAwareRanking,
    debug: {
      contractGateWorldPresent: true,
      contractGateWorldSource: input.source ?? 'domain.bearings.buildContractGateWorld',
      contractGateWorldSummary: `${gateEvaluation.summary} | ${gateEvaluation.strengthSummary}`,
      applied: gateEvaluation.applied,
      rejectedCount: gateEvaluation.rejectedCount,
      allowedCount: gateEvaluation.allowedCount,
      suppressedCount: gateEvaluation.suppressedCount,
      fallbackAdmittedCount: gateEvaluation.fallbackAdmittedCount,
      allowedPreview: gateEvaluation.allowedPreview,
      suppressedPreview: gateEvaluation.suppressedPreview,
      rejectedPreview: rejectedPockets.slice(0, 3).map((entry) => entry.profile.pocketId),
      greatStopQuality: input.context?.greatStopAdmissibilitySignal,
      strategyFamilyResolution,
    },
  }
}
