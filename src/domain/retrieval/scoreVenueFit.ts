import { scoreAnchorFit } from './scoreAnchorFit'
import { scoreBudgetFit } from './scoreBudgetFit'
import { scoreCrewFit } from './scoreCrewFit'
import { scoreHiddenGemFit } from './scoreHiddenGemFit'
import { scoreLensCompatibility, scoreLensStopShapeCompatibility } from './scoreLensCompatibility'
import { scoreProximityFit } from './scoreProximityFit'
import { scoreContextSpecificity } from './scoreContextSpecificity'
import { scoreDominancePenalty } from './scoreDominancePenalty'
import { computeHybridLiveLift } from './computeHybridLiveLift'
import { computeLiveQualityFairness } from './computeLiveQualityFairness'
import { computeRoleAwareHoursPressure } from './computeRoleAwareHoursPressure'
import { scoreUniquenessFit } from './scoreUniquenessFit'
import { evaluateRoleContract } from '../contracts/evaluateRoleContract'
import { evaluateHighlightValidity } from '../contracts/evaluateHighlightValidity'
import { requiresRomanticPersonaMoment } from '../contracts/romanticPersonaContract'
import { mapVenueToTasteInput } from '../interpretation/taste/mapVenueToTasteInput'
import { interpretVenueTaste } from '../interpretation/taste/interpretVenueTaste'
import { computeVibeAuthority } from '../taste/computeVibeAuthority'
import {
  assessGenericHospitalityFallbackPenalty,
  getGenericHospitalityFallbackPenalty,
  getHighlightArchetypeLift,
  getMomentIntensityTierBoost,
} from '../taste/experienceSignals'
import { getTasteModeAlignment } from '../taste/selectTasteMode'
import { deriveMomentVenueRecords } from '../moments/deriveMomentVenues'
import type { ScoredVenue } from '../types/arc'
import type { CrewPolicy } from '../types/crewPolicies'
import type { ExperienceLens } from '../types/experienceLens'
import type { LensStopRole } from '../types/experienceLens'
import type { IntentProfile } from '../types/intent'
import type { RoleContractEvaluation, RoleContractRule, RoleContractSet } from '../types/roleContract'
import type { StarterPack } from '../types/starterPack'
import type { InternalRole } from '../types/venue'
import type { Venue } from '../types/venue'
import type {
  TasteMomentIdentity,
  TasteMomentIntensityTier,
} from '../interpretation/taste/types'

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

type WeightShape = {
  anchor: number
  crew: number
  vibe: number
  proximity: number
  budget: number
  uniqueness: number
  hiddenGem: number
  lens: number
}

function getScoreWeights(intent: IntentProfile, lens: ExperienceLens): WeightShape {
  const weights: WeightShape = {
    anchor: 0.22,
    crew: 0.21,
    vibe: 0.18,
    proximity: 0.16,
    budget: 0.11,
    uniqueness: 0.08,
    hiddenGem: 0.04,
    lens: 0.1,
  }

  const refinements = new Set(intent.refinementModes ?? [])
  const refinementLeverageMultiplier = refinements.size > 0 ? 1.35 : 1
  if (refinements.has('more-unique')) {
    weights.uniqueness += 0.08 * refinementLeverageMultiplier
    weights.hiddenGem += 0.04 * refinementLeverageMultiplier
  }
  if (refinements.has('closer-by')) {
    weights.proximity += 0.1 * refinementLeverageMultiplier
  }
  if (refinements.has('more-exciting')) {
    weights.hiddenGem += 0.08 * refinementLeverageMultiplier
    weights.uniqueness += 0.05 * refinementLeverageMultiplier
    weights.lens += 0.04 * refinementLeverageMultiplier
    weights.vibe += 0.06 * refinementLeverageMultiplier
  }
  if (refinements.has('little-fancier')) {
    weights.crew += 0.04 * refinementLeverageMultiplier
    weights.budget += 0.06 * refinementLeverageMultiplier
  }
  if (refinements.has('more-relaxed')) {
    weights.proximity += 0.05 * refinementLeverageMultiplier
    weights.anchor += 0.04 * refinementLeverageMultiplier
    weights.vibe += 0.05 * refinementLeverageMultiplier
  }
  if (intent.mode === 'surprise') {
    weights.hiddenGem += 0.12
    weights.uniqueness += 0.08
    weights.lens += 0.03
    weights.anchor -= 0.03
  }
  if (intent.mode === 'curate') {
    weights.anchor += 0.05
    weights.crew += 0.04
    weights.vibe += 0.07
    weights.lens += 0.12
    weights.hiddenGem += lens.discoveryBias === 'high' ? 0.06 : 0.02
  }
  if (lens.discoveryBias === 'high') {
    weights.hiddenGem += 0.05
    weights.uniqueness += 0.04
  }

  return weights
}

function normalizeWeightedScore(
  scores: Record<keyof WeightShape, number>,
  weights: WeightShape,
): number {
  const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0)
  if (totalWeight === 0) {
    return 0
  }
  return (
    (scores.anchor * weights.anchor +
      scores.crew * weights.crew +
      scores.vibe * weights.vibe +
      scores.proximity * weights.proximity +
      scores.budget * weights.budget +
      scores.uniqueness * weights.uniqueness +
      scores.hiddenGem * weights.hiddenGem +
      scores.lens * weights.lens) /
    totalWeight
  )
}

function hasAnyTag(venue: Venue, tags: string[]): boolean {
  const normalized = new Set(venue.tags.map((tag) => tag.toLowerCase()))
  return tags.some((tag) => normalized.has(tag.toLowerCase()))
}

function textIncludesAny(value: string | undefined, terms: string[]): boolean {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) {
    return false
  }
  return terms.some((term) => normalized.includes(term.toLowerCase()))
}

function computeRomanticCenterpieceConvictionScore(
  venue: Venue,
  signals: ReturnType<typeof interpretVenueTaste>,
): number {
  const atmosphericDepth = Math.max(
    signals.romanticSignals.ambiance,
    signals.romanticSignals.ambientExperience,
    signals.momentEnrichment.ambientUniqueness,
  )
  const destinationFeel = Math.max(
    signals.destinationFactor,
    signals.anchorStrength,
    signals.momentPotential.score,
  )
  const lingerGravity = Math.max(
    signals.lingerFactor,
    (signals.lingerFactor + signals.conversationFriendliness) / 2,
  )
  const memorability = Math.max(
    venue.uniquenessScore,
    venue.distinctivenessScore,
    signals.momentIntensity.score,
  )
  const hiddenGemPull = Math.max(venue.underexposureScore, venue.localSignals.localFavoriteScore)
  const chefLedSignal =
    venue.category === 'restaurant' &&
    (hasAnyTag(venue, ['chef-led', 'tasting-menu', 'wine-pairing', 'reservation', 'omakase']) ||
      textIncludesAny(venue.subcategory, ['tasting', 'omakase', 'atelier', 'degustation']))
  const viewBackedDiningSignal =
    (signals.primaryExperienceArchetype === 'dining' ||
      signals.primaryExperienceArchetype === 'drinks' ||
      signals.primaryExperienceArchetype === 'sweet') &&
    signals.romanticSignals.scenic >= 0.52 &&
    signals.romanticSignals.intimacy >= 0.56 &&
    atmosphericDepth >= 0.56

  return clamp01(
    destinationFeel * 0.28 +
      atmosphericDepth * 0.22 +
      lingerGravity * 0.14 +
      memorability * 0.18 +
      hiddenGemPull * 0.1 +
      (chefLedSignal ? 0.08 : 0) +
      (viewBackedDiningSignal ? 0.08 : 0),
  )
}

function defaultRoleContractRule(role: LensStopRole): RoleContractRule {
  return {
    label: `Default ${role} contract`,
    role,
    strength: 'none',
    requiredCategories: [],
    preferredCategories: [],
    discouragedCategories: [],
    requiredTags: [],
    preferredTags: [],
    discouragedTags: [],
  }
}

function contractStrengthWeight(value: RoleContractEvaluation['strength']): number {
  if (value === 'none') {
    return 0
  }
  if (value === 'soft') {
    return 0.55
  }
  if (value === 'strong') {
    return 1
  }
  return 1.22
}

function roleContractInfluence(
  role: InternalRole,
  evaluation: RoleContractEvaluation,
): {
  bonus: number
  penalty: number
} {
  const strengthWeight = contractStrengthWeight(evaluation.strength)
  if (strengthWeight === 0) {
    return { bonus: 0, penalty: 0 }
  }

  const bonusWeight =
    role === 'peak' ? 0.26 : role === 'cooldown' ? 0.2 : role === 'warmup' ? 0.16 : 0.1
  const penaltyWeight =
    role === 'peak' ? 0.34 : role === 'cooldown' ? 0.28 : role === 'warmup' ? 0.22 : 0.16

  const bonus = evaluation.score * bonusWeight * strengthWeight
  const penalty = evaluation.satisfied ? 0 : (1 - evaluation.score) * penaltyWeight * strengthWeight
  return {
    bonus,
    penalty,
  }
}

function roundToThousandths(value: number): number {
  return Number(value.toFixed(3))
}

function moderateBandScore(value: number, target: number, spread: number): number {
  return clamp01(1 - Math.abs(value - target) / spread)
}

function getMomentRolePreference(
  momentIdentity: TasteMomentIdentity,
  role: LensStopRole,
): number {
  const typeWeight =
    role === 'start'
      ? momentIdentity.type === 'arrival'
        ? 1
        : momentIdentity.type === 'explore'
          ? 0.82
          : momentIdentity.type === 'transition'
            ? 0.72
            : momentIdentity.type === 'linger'
              ? 0.5
              : momentIdentity.type === 'close'
                ? 0.36
                : 0.3
      : role === 'highlight'
        ? momentIdentity.type === 'anchor'
          ? 1
          : momentIdentity.type === 'explore'
            ? 0.86
            : momentIdentity.type === 'transition'
              ? 0.56
              : momentIdentity.type === 'linger'
                ? 0.44
                : momentIdentity.type === 'arrival'
                  ? 0.38
                  : 0.34
        : role === 'windDown'
          ? momentIdentity.type === 'close'
            ? 1
            : momentIdentity.type === 'linger'
              ? 0.9
              : momentIdentity.type === 'transition'
                ? 0.64
                : momentIdentity.type === 'arrival'
                  ? 0.4
                  : momentIdentity.type === 'explore'
                    ? 0.34
                    : 0.28
          : momentIdentity.type === 'explore'
            ? 0.92
            : momentIdentity.type === 'transition'
              ? 0.8
              : momentIdentity.type === 'anchor'
                ? 0.62
                : momentIdentity.type === 'linger'
                  ? 0.54
                  : momentIdentity.type === 'arrival'
                    ? 0.5
                    : 0.38
  const strengthAdjustment =
    role === 'start'
      ? momentIdentity.strength === 'light'
        ? 0.12
        : momentIdentity.strength === 'medium'
          ? 0.08
          : momentIdentity.type === 'arrival' || momentIdentity.type === 'explore'
            ? 0
            : -0.06
      : role === 'highlight'
        ? momentIdentity.strength === 'strong'
          ? 0.18
          : momentIdentity.strength === 'medium'
            ? 0.06
            : -0.12
        : role === 'windDown'
          ? momentIdentity.strength === 'light'
            ? 0.12
            : momentIdentity.strength === 'medium'
              ? 0.08
              : -0.08
          : momentIdentity.strength === 'strong'
            ? 0.04
            : momentIdentity.strength === 'medium'
              ? 0.04
              : 0

  return clamp01(typeWeight + strengthAdjustment)
}

function deriveTasteRolePoolInfluence(
  tasteSignals: ReturnType<typeof interpretVenueTaste>,
): ScoredVenue['taste']['rolePoolInfluence'] {
  const moderateStartEnergy = moderateBandScore(tasteSignals.energy, 0.44, 0.38)
  const moderateStartSocial = moderateBandScore(
    tasteSignals.socialDensity,
    0.5,
    0.36,
  )
  const calmWindDownEnergy = 1 - tasteSignals.energy

  const warmupRoleSuitabilityContribution =
    tasteSignals.roleSuitability.start * 0.024
  const peakRoleSuitabilityContribution =
    tasteSignals.roleSuitability.highlight * 0.03
  const wildcardRoleSuitabilityContribution =
    tasteSignals.roleSuitability.surprise * 0.024
  const cooldownRoleSuitabilityContribution =
    tasteSignals.roleSuitability.windDown * 0.016
  const warmupMomentContribution = getMomentRolePreference(
    tasteSignals.momentIdentity,
    'start',
  ) * 0.018
  const peakMomentContribution = getMomentRolePreference(
    tasteSignals.momentIdentity,
    'highlight',
  ) * 0.024
  const wildcardMomentContribution = getMomentRolePreference(
    tasteSignals.momentIdentity,
    'surprise',
  ) * 0.018
  const cooldownMomentContribution = getMomentRolePreference(
    tasteSignals.momentIdentity,
    'windDown',
  ) * 0.02
  const intensityTierBoost = getMomentIntensityTierBoost(tasteSignals.momentIntensity)
  const intensityScore = tasteSignals.momentIntensity.score

  return {
    warmup: {
      tasteBonus: roundToThousandths(
        tasteSignals.conversationFriendliness * 0.03 +
          moderateStartEnergy * 0.018 +
          moderateStartSocial * 0.016 +
          tasteSignals.categorySpecificity * 0.008 +
          intensityScore * 0.006 +
          warmupMomentContribution +
          warmupRoleSuitabilityContribution,
      ),
      roleSuitabilityContribution: roundToThousandths(
        warmupRoleSuitabilityContribution,
      ),
      momentContribution: roundToThousandths(warmupMomentContribution),
      highlightPlausibilityBonus: 0,
      modeAlignmentContribution: 0,
      modeAlignmentPenalty: 0,
    },
    peak: {
      tasteBonus: roundToThousandths(
        tasteSignals.destinationFactor * 0.022 +
        tasteSignals.experientialFactor * 0.022 +
        tasteSignals.energy * 0.012 +
          tasteSignals.momentPotential.score * 0.014 +
          intensityScore * 0.02 +
          tasteSignals.anchorStrength * 0.038 +
          tasteSignals.personalityStrength * 0.016 +
          tasteSignals.categorySpecificity * 0.012 +
          peakMomentContribution +
          peakRoleSuitabilityContribution,
      ),
      roleSuitabilityContribution: roundToThousandths(
        peakRoleSuitabilityContribution,
      ),
      momentContribution: roundToThousandths(peakMomentContribution),
      highlightPlausibilityBonus: roundToThousandths(
        (tasteSignals.highlightTier === 1
          ? 0.022
          : tasteSignals.highlightTier === 2
            ? 0.008
            : 0) +
          intensityTierBoost * 0.42 +
          Math.max(0, intensityScore - 0.62) * 0.08 +
          Math.max(0, tasteSignals.anchorStrength - 0.72) * 0.04,
      ),
      modeAlignmentContribution: 0,
      modeAlignmentPenalty: 0,
    },
    wildcard: {
      tasteBonus: roundToThousandths(
          tasteSignals.experientialFactor * 0.028 +
          tasteSignals.noveltyWeight * 0.028 +
          tasteSignals.momentPotential.score * 0.014 +
          intensityScore * 0.012 +
          wildcardMomentContribution +
          wildcardRoleSuitabilityContribution,
      ),
      roleSuitabilityContribution: roundToThousandths(
        wildcardRoleSuitabilityContribution,
      ),
      momentContribution: roundToThousandths(wildcardMomentContribution),
      highlightPlausibilityBonus: 0,
      modeAlignmentContribution: 0,
      modeAlignmentPenalty: 0,
    },
    cooldown: {
      tasteBonus: roundToThousandths(
        tasteSignals.intimacy * 0.024 +
          tasteSignals.conversationFriendliness * 0.024 +
          tasteSignals.lingerFactor * 0.02 +
          calmWindDownEnergy * 0.014 +
          intensityScore * 0.006 +
          Math.max(0, tasteSignals.categorySpecificity - tasteSignals.anchorStrength) *
            0.008 +
          cooldownMomentContribution +
          cooldownRoleSuitabilityContribution,
      ),
      roleSuitabilityContribution: roundToThousandths(
        cooldownRoleSuitabilityContribution,
      ),
      momentContribution: roundToThousandths(cooldownMomentContribution),
      highlightPlausibilityBonus: 0,
      modeAlignmentContribution: 0,
      modeAlignmentPenalty: 0,
    },
  }
}

function formatActivationTraceLabel(
  candidate: ScoredVenue,
  activationType: NonNullable<
    ScoredVenue['taste']['signals']['hyperlocalActivation']['primaryActivationType']
  >,
): string {
  return `${candidate.venue.name} | ${activationType.replace(/_/g, ' ')}`
}

function computeHyperlocalVariantLift(candidate: ScoredVenue): number {
  const activation = candidate.taste.signals.hyperlocalActivation
  const impact = activation.interpretationImpact
  return clamp01(
    activation.intensityContribution * 0.42 +
      impact.highlightSuitability * 0.34 +
      impact.momentIntensity * 0.26 +
      impact.momentPotential * 0.22 +
      impact.novelty * 0.12,
  )
}

function isHyperlocalVariantContractPlausible(
  candidate: ScoredVenue,
  lens: ExperienceLens,
): boolean {
  const activation = candidate.taste.signals.hyperlocalActivation
  const hints = new Set(activation.contractCompatibilityHints)
  const signals = candidate.taste.signals

  if (
    activation.primaryActivationType === 'social_ritual' &&
    signals.socialDensity >= 0.84 &&
    signals.intimacy < 0.5
  ) {
    return false
  }

  if (
    activation.primaryActivationType === 'live_performance' &&
    signals.energy >= 0.86 &&
    signals.intimacy < 0.46 &&
    !hints.has('romantic_ambient')
  ) {
    return false
  }

  if (!requiresRomanticPersonaMoment(lens)) {
    return true
  }

  return (
    hints.has('romantic_ambient') ||
    hints.has('cozy_anchor') ||
    signals.isRomanticMomentCandidate ||
    (activation.primaryActivationType === 'tasting_activation' &&
      (hints.has('cozy_anchor') || hints.has('curated_highlight')) &&
      signals.intimacy >= 0.42 &&
      signals.energy <= 0.62)
  )
}

function shouldInjectHyperlocalVariant(
  candidate: ScoredVenue,
  lens: ExperienceLens,
): boolean {
  const activation = candidate.taste.signals.hyperlocalActivation
  const impact = activation.interpretationImpact
  const variantLift = computeHyperlocalVariantLift(candidate)
  const strongImpact =
    impact.highlightSuitability >= 0.04 ||
    impact.momentIntensity >= 0.04 ||
    impact.momentPotential >= 0.04
  const highlightReady =
    candidate.roleScores.peak >= 0.54 &&
    candidate.stopShapeFit.highlight >= 0.24 &&
    candidate.highlightValidity.validityLevel !== 'invalid'
  const lowSignalGeneric =
    candidate.taste.fallbackPenalty.signalScore >= 0.18 &&
    candidate.taste.signals.experientialFactor < 0.64 &&
    candidate.taste.signals.momentIntensity.score < 0.72

  if (!activation.primaryActivationType) {
    return false
  }
  if (!activation.materiallyChangesHighlightPotential || !activation.materiallyChangesInterpretation) {
    return false
  }
  if (activation.intensityContribution < 0.32 || variantLift < 0.18) {
    return false
  }
  if (!strongImpact || !highlightReady || lowSignalGeneric) {
    return false
  }
  return isHyperlocalVariantContractPlausible(candidate, lens)
}

function createHyperlocalActivationVariant(
  candidate: ScoredVenue,
  lens: ExperienceLens,
): ScoredVenue | undefined {
  const activation = candidate.taste.signals.hyperlocalActivation
  const activationType = activation.primaryActivationType
  if (!activationType || !shouldInjectHyperlocalVariant(candidate, lens)) {
    return undefined
  }

  const variantLift = computeHyperlocalVariantLift(candidate)
  const highlightLift = Math.min(
    0.11,
    0.028 +
      activation.interpretationImpact.highlightSuitability * 0.16 +
      activation.interpretationImpact.momentIntensity * 0.12 +
      activation.intensityContribution * 0.08,
  )
  const fitLift = Math.min(
    0.055,
    0.012 +
      activation.interpretationImpact.highlightSuitability * 0.06 +
      activation.interpretationImpact.momentPotential * 0.04,
  )
  const warmupLift =
    activationType === 'seasonal_market' || activationType === 'social_ritual'
      ? Math.min(0.05, 0.014 + activation.interpretationImpact.momentPotential * 0.08)
      : activationType === 'ambient_activation' || activationType === 'tasting_activation'
        ? Math.min(0.035, activation.interpretationImpact.highlightSuitability * 0.05)
        : 0
  const wildcardLift =
    activationType === 'live_performance' ||
    activationType === 'seasonal_market' ||
    activationType === 'cultural_activation'
      ? Math.min(0.07, 0.018 + activation.interpretationImpact.novelty * 0.1)
      : 0
  const cooldownLift =
    activationType === 'ambient_activation' || activationType === 'tasting_activation'
      ? Math.min(0.04, 0.01 + activation.interpretationImpact.highlightSuitability * 0.05)
      : 0
  const fallbackRelief = Math.min(
    0.08,
    activation.intensityContribution * 0.12 +
      activation.interpretationImpact.highlightSuitability * 0.14,
  )
  const meaningfulDifference =
    highlightLift >= 0.05 || fitLift >= 0.03 || wildcardLift >= 0.04

  if (!meaningfulDifference) {
    return undefined
  }

  const ambianceBoost =
    activationType === 'ambient_activation'
      ? 0.12
      : activationType === 'tasting_activation'
        ? 0.1
        : activationType === 'live_performance'
          ? 0.08
          : activationType === 'cultural_activation'
            ? 0.05
            : 0.02
  const intimacyBoost =
    activationType === 'tasting_activation'
      ? 0.09
      : activationType === 'ambient_activation'
        ? 0.05
        : activationType === 'live_performance'
          ? 0.04
          : 0.02
  const ambientExperienceBoost =
    activationType === 'ambient_activation' || activationType === 'live_performance'
      ? 0.08
      : activationType === 'tasting_activation' || activationType === 'cultural_activation'
        ? 0.06
        : 0.03
  const ambientUniquenessBoost =
    activationType === 'ambient_activation' || activationType === 'tasting_activation'
      ? 0.12
      : activationType === 'live_performance'
        ? 0.08
        : 0.04
  const culturalDepthBoost =
    activationType === 'cultural_activation'
      ? 0.1
      : activationType === 'live_performance'
        ? 0.05
        : 0.02
  const momentPotentialBoost = Math.min(
    0.08,
    activation.interpretationImpact.momentPotential * 0.34 +
      activation.intensityContribution * 0.04,
  )
  const momentIntensityBoost = Math.min(
    0.06,
    activation.interpretationImpact.momentIntensity * 0.24 +
      activation.intensityContribution * 0.03,
  )
  const variantMomentPotential = clamp01(
    candidate.taste.signals.momentPotential.score + momentPotentialBoost,
  )
  const variantMomentIntensity = clamp01(
    candidate.taste.signals.momentIntensity.score + momentIntensityBoost,
  )
  const variantMomentIntensityTier: TasteMomentIntensityTier =
    variantMomentIntensity >= 0.9
      ? 'signature'
      : variantMomentIntensity >= 0.8
        ? 'exceptional'
        : variantMomentIntensity >= 0.64
          ? 'strong'
          : 'standard'
  const variantRomanticSignals = {
    ...candidate.taste.signals.romanticSignals,
    intimacy: clamp01(candidate.taste.signals.romanticSignals.intimacy + intimacyBoost),
    ambiance: clamp01(candidate.taste.signals.romanticSignals.ambiance + ambianceBoost),
    ambientExperience: clamp01(
      candidate.taste.signals.romanticSignals.ambientExperience + ambientExperienceBoost,
    ),
  }
  const variantMomentEnrichment = {
    ...candidate.taste.signals.momentEnrichment,
    ambientUniqueness: clamp01(
      candidate.taste.signals.momentEnrichment.ambientUniqueness + ambientUniquenessBoost,
    ),
    culturalDepth: clamp01(
      candidate.taste.signals.momentEnrichment.culturalDepth + culturalDepthBoost,
    ),
    signals: [
      ...new Set([
        ...candidate.taste.signals.momentEnrichment.signals,
        'activation-shaped variant',
      ]),
    ],
  }
  const variantRomanticScore = clamp01(
    candidate.taste.signals.romanticScore +
      ambianceBoost * 0.42 +
      intimacyBoost * 0.32 +
      ambientExperienceBoost * 0.26,
  )
  const variantMomentElevationPotential = clamp01(
    candidate.taste.signals.momentElevationPotential +
      activation.interpretationImpact.highlightSuitability * 0.14 +
      activation.interpretationImpact.momentIntensity * 0.12 +
      activation.interpretationImpact.momentPotential * 0.1 +
      activation.intensityContribution * 0.08,
  )
  const variantElevatedMomentCandidate =
    candidate.taste.signals.isElevatedMomentCandidate ||
    (activation.materiallyChangesInterpretation &&
      activation.materiallyChangesHighlightPotential &&
      variantMomentElevationPotential >= 0.5 &&
      variantMomentIntensity >= 0.78 &&
      variantMomentPotential >= 0.58)
  const variantSignals = {
    ...candidate.taste.signals,
    momentPotential: {
      ...candidate.taste.signals.momentPotential,
      score: variantMomentPotential,
    },
    momentIntensity: {
      ...candidate.taste.signals.momentIntensity,
      score: variantMomentIntensity,
      tier: variantMomentIntensityTier,
      drivers: [
        ...new Set([
          ...candidate.taste.signals.momentIntensity.drivers,
          'hyperlocal activation',
        ]),
      ],
    },
    momentEnrichment: variantMomentEnrichment,
    romanticSignals: variantRomanticSignals,
    romanticScore: variantRomanticScore,
    momentElevationPotential: variantMomentElevationPotential,
    isElevatedMomentCandidate: variantElevatedMomentCandidate,
    momentElevationReason: variantElevatedMomentCandidate
      ? 'activation variant elevated into true moment contention'
      : candidate.taste.signals.momentElevationReason,
    isRomanticMomentCandidate:
      candidate.taste.signals.isRomanticMomentCandidate ||
      (variantRomanticSignals.ambiance >= 0.58 &&
        variantMomentIntensity >= 0.68 &&
        candidate.taste.signals.energy <= 0.68 &&
        candidate.taste.signals.socialDensity <= 0.78),
  }

  return {
    ...candidate,
    candidateIdentity: {
      candidateId: `${candidate.venue.id}::activation::${activationType}`,
      baseVenueId: candidate.venue.id,
      kind: 'hyperlocal_activation',
      activationType,
      traceLabel: formatActivationTraceLabel(candidate, activationType),
    },
    fitScore: clamp01(candidate.fitScore + fitLift),
    hiddenGemScore: clamp01(
      candidate.hiddenGemScore + activation.interpretationImpact.novelty * 0.04,
    ),
    lensCompatibility: clamp01(
      candidate.lensCompatibility +
        activation.interpretationImpact.highlightSuitability * 0.04,
    ),
    stopShapeFit: {
      ...candidate.stopShapeFit,
      highlight: clamp01(candidate.stopShapeFit.highlight + highlightLift * 0.9),
      surprise: clamp01(candidate.stopShapeFit.surprise + wildcardLift * 0.7),
      start: clamp01(candidate.stopShapeFit.start + warmupLift * 0.4),
      windDown: clamp01(candidate.stopShapeFit.windDown + cooldownLift * 0.5),
    },
    roleScores: {
      warmup: clamp01(candidate.roleScores.warmup + warmupLift),
      peak: clamp01(candidate.roleScores.peak + highlightLift),
      wildcard: clamp01(candidate.roleScores.wildcard + wildcardLift),
      cooldown: clamp01(candidate.roleScores.cooldown + cooldownLift),
    },
    taste: {
      ...candidate.taste,
      signals: variantSignals,
      fallbackPenalty: {
        ...candidate.taste.fallbackPenalty,
        signalScore: clamp01(candidate.taste.fallbackPenalty.signalScore - fallbackRelief),
        appliedPenalty: 0,
        applied: false,
        strongerAlternativePresent: false,
        strongerAlternativeName: undefined,
        reason: `activation variant ready | lift ${roundToThousandths(variantLift)}`,
      },
    },
  }
}

export function scoreVenueFit(
  venue: Venue,
  intent: IntentProfile,
  crewPolicy: CrewPolicy,
  lens: ExperienceLens,
  roleContracts?: RoleContractSet,
  starterPack?: StarterPack,
): ScoredVenue {
  const anchorFit = scoreAnchorFit(venue, intent)
  const crewFit = scoreCrewFit(venue, crewPolicy)
  const proximityFit = scoreProximityFit(venue, intent)
  const budgetFit = scoreBudgetFit(venue, intent.budget)
  const uniquenessFit = scoreUniquenessFit(venue, intent)
  const lensCompatibility = scoreLensCompatibility(venue, intent, lens)
  const provisionalFit =
    anchorFit * 0.25 +
    crewFit * 0.23 +
    proximityFit * 0.2 +
    budgetFit * 0.11 +
    uniquenessFit * 0.1 +
    lensCompatibility * 0.11
  const hiddenGemFit = scoreHiddenGemFit(venue, provisionalFit, intent)

  const weights = getScoreWeights(intent, lens)

  const stopShapeFit = {
    start: scoreLensStopShapeCompatibility(venue, lens, 'start'),
    highlight: scoreLensStopShapeCompatibility(venue, lens, 'highlight'),
    surprise: scoreLensStopShapeCompatibility(venue, lens, 'surprise'),
    windDown: scoreLensStopShapeCompatibility(venue, lens, 'windDown'),
  }
  const contextSpecificity = scoreContextSpecificity({
    venue,
    intent,
    crewPolicy,
    lens,
    fitBreakdown: {
      anchorFit,
      crewFit,
    },
    stopShapeFit,
  })
  const dominanceControl = scoreDominancePenalty({
    venue,
    contextSpecificityByRole: contextSpecificity.byRole,
  })
  const roleContract: Record<InternalRole, RoleContractEvaluation> = {
    warmup: evaluateRoleContract(
      venue,
      roleContracts?.byRole.start ?? defaultRoleContractRule('start'),
    ),
    peak: evaluateRoleContract(
      venue,
      roleContracts?.byRole.highlight ?? defaultRoleContractRule('highlight'),
    ),
    wildcard: evaluateRoleContract(
      venue,
      roleContracts?.byRole.surprise ?? defaultRoleContractRule('surprise'),
    ),
    cooldown: evaluateRoleContract(
      venue,
      roleContracts?.byRole.windDown ?? defaultRoleContractRule('windDown'),
    ),
  }
  const warmupContractInfluence = roleContractInfluence('warmup', roleContract.warmup)
  const peakContractInfluence = roleContractInfluence('peak', roleContract.peak)
  const wildcardContractInfluence = roleContractInfluence('wildcard', roleContract.wildcard)
  const cooldownContractInfluence = roleContractInfluence('cooldown', roleContract.cooldown)
  const vibeAuthority = computeVibeAuthority(venue, intent, lens, starterPack)
  const highlightValidity = evaluateHighlightValidity({
    venue,
    intent,
    starterPack,
  })
  const tasteSignals = interpretVenueTaste(mapVenueToTasteInput(venue), {
    timeWindow: intent.timeWindow,
    persona: intent.persona ?? undefined,
    vibe: intent.primaryAnchor ?? undefined,
  })
  const startMomentRoleFit = getMomentRolePreference(tasteSignals.momentIdentity, 'start')
  const highlightMomentRoleFit = getMomentRolePreference(
    tasteSignals.momentIdentity,
    'highlight',
  )
  const surpriseMomentRoleFit = getMomentRolePreference(
    tasteSignals.momentIdentity,
    'surprise',
  )
  const windDownMomentRoleFit = getMomentRolePreference(
    tasteSignals.momentIdentity,
    'windDown',
  )
  const tasteRolePoolInfluence = deriveTasteRolePoolInfluence(tasteSignals)
  const protectedByUserConstraint =
    intent.anchor?.venueId === venue.id ||
    Boolean(intent.discoveryPreferences?.some((preference) => preference.venueId === venue.id))
  const genericHospitalityFallbackSignal = getGenericHospitalityFallbackPenalty({
    venueCategory: venue.category,
    signatureGenericScore: venue.signature.genericScore,
    uniquenessScore: venue.uniquenessScore,
    distinctivenessScore: venue.distinctivenessScore,
    protectedCandidate: protectedByUserConstraint,
    signals: tasteSignals,
    tasteModeId: lens.tasteMode?.id,
  })
  const tasteModeAlignment = getTasteModeAlignment(venue, lens.tasteMode, {
    protectedCandidate: protectedByUserConstraint,
  })
  const tasteModeWeight = lens.tasteMode?.alignmentWeight ?? 0
  const strongAlignmentFitBonus =
    tasteModeAlignment.tier === 'primary'
      ? tasteModeWeight * 0.42
      : tasteModeAlignment.tier === 'supporting'
        ? tasteModeWeight * 0.16
        : 0
  const tasteModeFitBonus =
    tasteModeAlignment.overall * tasteModeWeight + strongAlignmentFitBonus
  const tasteModeFitPenalty = tasteModeAlignment.penalty
  const primaryAlignmentMultiplier =
    tasteModeAlignment.tier === 'primary'
      ? 1.42
      : tasteModeAlignment.tier === 'supporting'
        ? 1.12
        : 1
  const modeAlignmentRoleInfluence = {
    warmup: roundToThousandths(
      tasteModeAlignment.byRole.start * 1.22 * primaryAlignmentMultiplier +
        tasteModeAlignment.lanePriorityScore * tasteModeWeight * 0.2 +
        (tasteModeAlignment.tier === 'primary'
          ? 0.062
          : tasteModeAlignment.tier === 'supporting'
            ? 0.026
            : 0),
    ),
    peak: roundToThousandths(
      tasteModeAlignment.byRole.highlight * 1.42 * primaryAlignmentMultiplier +
        tasteModeAlignment.lanePriorityScore * tasteModeWeight * 0.28 +
        (tasteModeAlignment.tier === 'primary'
          ? 0.11
          : tasteModeAlignment.tier === 'supporting'
            ? 0.045
            : 0),
    ),
    wildcard: roundToThousandths(
      tasteModeAlignment.byRole.surprise * 1.14 * primaryAlignmentMultiplier +
        tasteModeAlignment.lanePriorityScore * tasteModeWeight * 0.13,
    ),
    cooldown: roundToThousandths(
      tasteModeAlignment.byRole.windDown * 1.14 * primaryAlignmentMultiplier +
        tasteModeAlignment.lanePriorityScore * tasteModeWeight * 0.12,
    ),
  }
  const modeAlignmentRolePenalty = {
    warmup: roundToThousandths(tasteModeFitPenalty * 0.36),
    peak: roundToThousandths(tasteModeFitPenalty * 0.4),
    wildcard: roundToThousandths(tasteModeFitPenalty * 0.28),
    cooldown: roundToThousandths(tasteModeFitPenalty * 0.32),
  }
  const startLightModeAlignmentBoost =
    lens.tasteMode &&
    (tasteModeAlignment.byRole.start >= 0.42 ||
      (tasteModeAlignment.overall >= 0.44 && tasteModeAlignment.tier === 'supporting'))
      ? tasteModeWeight *
        (tasteModeAlignment.tier === 'primary'
          ? 0.06
          : tasteModeAlignment.tier === 'supporting'
            ? 0.038
            : 0.024)
      : 0
  const windDownSoftModeAlignmentBoost =
    lens.tasteMode &&
    (tasteModeAlignment.byRole.windDown >= 0.4 ||
      (tasteModeAlignment.overall >= 0.42 && tasteModeAlignment.tier === 'supporting'))
      ? tasteModeWeight *
        (tasteModeAlignment.tier === 'primary'
          ? 0.05
          : tasteModeAlignment.tier === 'supporting'
            ? 0.034
            : 0.022)
      : 0
  tasteRolePoolInfluence.warmup.modeAlignmentContribution = modeAlignmentRoleInfluence.warmup
  tasteRolePoolInfluence.peak.modeAlignmentContribution = modeAlignmentRoleInfluence.peak
  tasteRolePoolInfluence.wildcard.modeAlignmentContribution = modeAlignmentRoleInfluence.wildcard
  tasteRolePoolInfluence.cooldown.modeAlignmentContribution = modeAlignmentRoleInfluence.cooldown
  tasteRolePoolInfluence.warmup.modeAlignmentPenalty = modeAlignmentRolePenalty.warmup
  tasteRolePoolInfluence.peak.modeAlignmentPenalty = modeAlignmentRolePenalty.peak
  tasteRolePoolInfluence.wildcard.modeAlignmentPenalty = modeAlignmentRolePenalty.wildcard
  tasteRolePoolInfluence.cooldown.modeAlignmentPenalty = modeAlignmentRolePenalty.cooldown
  const discoveryPreference = intent.discoveryPreferences?.find(
    (preference) => preference.venueId === venue.id,
  )
  const discoveryFitBonus = discoveryPreference
    ? discoveryPreference.role === 'highlight'
      ? 0.09
      : 0.07
    : 0
  const universalityFitPenalty =
    dominanceControl.universalityScore * (1 - contextSpecificity.overall) * 0.08
  const isLiveSource = venue.source.sourceOrigin === 'live'
  const strongLiveWindow =
    isLiveSource &&
    venue.source.likelyOpenForCurrentWindow &&
    venue.source.timeConfidence >= 0.72 &&
    venue.source.qualityGateStatus === 'approved'
  const softLiveWindow =
    isLiveSource &&
    venue.source.likelyOpenForCurrentWindow &&
    venue.source.timeConfidence >= 0.52
  const weakLiveWindow =
    isLiveSource &&
    !venue.source.likelyOpenForCurrentWindow &&
    venue.source.timeConfidence >= 0.65
  const liveNoveltyLift =
    isLiveSource &&
    venue.source.qualityGateStatus === 'approved' &&
    venue.source.qualityScore >= 0.72 &&
    venue.signature.signatureScore >= 0.6
      ? 0.035
      : 0
  const hybridLiveLift = computeHybridLiveLift(venue)
  const liveFairness = computeLiveQualityFairness(venue)
  const warmupHoursPressure = computeRoleAwareHoursPressure(venue, 'warmup')
  const peakHoursPressure = computeRoleAwareHoursPressure(venue, 'peak')
  const wildcardHoursPressure = computeRoleAwareHoursPressure(venue, 'wildcard')
  const cooldownHoursPressure = computeRoleAwareHoursPressure(venue, 'cooldown')
  const fitScore = clamp01(
    normalizeWeightedScore(
      {
        anchor: anchorFit,
        crew: crewFit,
        vibe: vibeAuthority.overall,
        proximity: proximityFit,
        budget: budgetFit,
        uniqueness: uniquenessFit,
        hiddenGem: hiddenGemFit,
        lens: lensCompatibility,
      },
      weights,
    ) +
      discoveryFitBonus +
      (venue.source.sourceOrigin === 'curated' ? 0.003 : 0) +
      (strongLiveWindow ? 0.06 : softLiveWindow ? 0.025 : 0) +
      hybridLiveLift.fitLift +
      liveNoveltyLift +
      tasteModeFitBonus +
      liveFairness.fitBonus +
      venue.source.qualityScore * 0.05 +
      venue.source.sourceConfidence * 0.03 +
      venue.signature.signatureScore * 0.04 +
      contextSpecificity.overall * 0.08 -
      (venue.source.sourceOrigin === 'live' && venue.source.sourceConfidence < 0.62 && !liveFairness.supportRecoveryEligible ? 0.01 : 0) -
      (weakLiveWindow ? 0.06 : 0) -
      (isLiveSource && !venue.source.hoursKnown
        ? liveFairness.supportRecoveryEligible
          ? 0.004
          : venue.source.qualityGateStatus === 'approved'
            ? 0.01
            : 0.018
        : 0) -
      tasteModeFitPenalty -
      universalityFitPenalty -
      venue.signature.genericScore * 0.06 -
      (venue.source.qualityGateStatus === 'demoted' ? 0.05 : 0),
  )
  const hiddenGemScore = clamp01(
    hiddenGemFit * (1 + crewPolicy.hiddenGemBias) + (intent.prefersHiddenGems ? 0.03 : 0),
  )

  const energyFactor = venue.energyLevel / 5
  const refinements = new Set(intent.refinementModes ?? [])
  const peakEnergyLift = refinements.has('more-exciting') ? 0.14 : 0
  const relaxedPenalty = refinements.has('more-relaxed') ? 0.1 : 0
  const wildcardLift = refinements.has('more-exciting') ? 0.12 : 0
  const closerByPenalty = refinements.has('closer-by') ? venue.driveMinutes / 30 * 0.14 : 0
  const uniqueLift = refinements.has('more-unique') ? venue.distinctivenessScore * 0.08 : 0
  const fancyLift =
    refinements.has('little-fancier') && venue.priceTier !== '$'
      ? 0.06
      : refinements.has('little-fancier')
        ? -0.04
        : 0
  const discoveryLift = lens.discoveryBias === 'high' ? 0.08 : lens.discoveryBias === 'medium' ? 0.04 : 0
  const isNightlifeCoded =
    venue.category === 'bar' || venue.category === 'live_music' || hasAnyTag(venue, ['late-night', 'party'])
  const isRomanticTone =
    venue.category === 'dessert' ||
    venue.category === 'cafe' ||
    venue.category === 'live_music' ||
    venue.category === 'park' ||
    hasAnyTag(venue, ['cozy', 'intimate', 'design-forward', 'listening', 'calm'])
  const isFamilyFriendly =
    (venue.category === 'park' ||
      venue.category === 'museum' ||
      venue.category === 'cafe' ||
      venue.category === 'dessert' ||
      venue.category === 'activity' ||
      venue.category === 'event') &&
    !isNightlifeCoded
  const genericCategory = venue.category === 'restaurant' || venue.category === 'cafe'
  const genericHighlightCategory =
    venue.category === 'restaurant' ||
    venue.category === 'cafe' ||
    venue.category === 'dessert'
  const formalDiningVenue =
    venue.category === 'restaurant' &&
    (hasAnyTag(venue, [
      'chef-led',
      'reservation',
      'tasting-menu',
      'wine-pairing',
      'omakase',
    ]) ||
      textIncludesAny(venue.subcategory, ['omakase', 'degustation', 'tasting', 'atelier']))
  const adultNightlifeVenue =
    venue.category === 'bar' &&
    (hasAnyTag(venue, ['cocktails', 'dj', 'late-night', 'rooftop', 'speakeasy']) ||
      tasteSignals.energy >= 0.68)
  const formalDiningPressure = clamp01(
    (formalDiningVenue ? 0.72 : 0) +
      (venue.priceTier === '$$$$' ? 0.22 : venue.priceTier === '$$$' ? 0.1 : 0) +
      (tasteSignals.anchorStrength >= 0.8 ? 0.08 : 0) -
      (venue.settings.familyFriendly ? 0.4 : 0),
  )
  const adultNightlifePressure = clamp01(
    (adultNightlifeVenue ? 0.8 : 0) +
      (isNightlifeCoded ? 0.12 : 0) -
      (venue.settings.familyFriendly ? 0.42 : 0),
  )
  const casualExplorationContext =
    intent.primaryAnchor === 'adventurous-urban' ||
    intent.primaryAnchor === 'adventurous-outdoor' ||
    intent.primaryAnchor === 'playful' ||
    intent.primaryAnchor === 'chill'
  const contextualAdultPressure = Math.max(formalDiningPressure, adultNightlifePressure)
  const startIntentionalityBonus =
    clamp01(
      tasteSignals.roleSuitability.start * 0.55 +
        tasteSignals.conversationFriendliness * 0.25 +
        (1 - tasteSignals.energy) * 0.2,
    ) * 0.05
  const windDownIntentionalityBonus =
    clamp01(
      tasteSignals.roleSuitability.windDown * 0.5 +
        tasteSignals.intimacy * 0.25 +
        (1 - tasteSignals.energy) * 0.25,
    ) * 0.05
  const softClosingStartMoment =
    (tasteSignals.momentIdentity.type === 'close' ||
      tasteSignals.momentIdentity.type === 'linger') &&
    tasteSignals.momentIdentity.strength !== 'strong'
  const arrivalExploreStartMoment =
    tasteSignals.momentIdentity.type === 'arrival' ||
    tasteSignals.momentIdentity.type === 'explore'
  const interactiveLightStart =
    tasteSignals.primaryExperienceArchetype === 'activity' &&
    venue.energyLevel <= 3 &&
    tasteSignals.momentIdentity.strength !== 'strong'
  const socialEntryStart =
    tasteSignals.primaryExperienceArchetype === 'social' &&
    (tasteSignals.momentIdentity.type === 'arrival' ||
      tasteSignals.momentIdentity.type === 'explore' ||
      tasteSignals.momentIdentity.type === 'transition')
  const casualActivityStart =
    (venue.category === 'activity' ||
      tasteSignals.primaryExperienceArchetype === 'activity') &&
    venue.energyLevel <= 3
  const startEnergyEntryLift =
    (arrivalExploreStartMoment ? 0.05 : 0) +
    (interactiveLightStart ? 0.04 : 0) +
    (socialEntryStart ? 0.03 : 0) +
    (casualActivityStart ? 0.025 : 0)
  const softClosingStartPenalty = softClosingStartMoment ? 0.055 : 0
  const windDownCloseLingerBoost =
    tasteSignals.momentIdentity.type === 'close'
      ? 0.06
      : tasteSignals.momentIdentity.type === 'linger'
        ? 0.045
        : 0
  const windDownSecondPeakPenalty =
    (tasteSignals.momentIdentity.type === 'anchor' ||
      tasteSignals.momentIdentity.type === 'explore') &&
    tasteSignals.momentIdentity.strength === 'strong'
      ? 0.11
      : (tasteSignals.momentIdentity.type === 'anchor' ||
            tasteSignals.momentIdentity.type === 'explore') &&
          tasteSignals.momentIdentity.strength === 'medium'
        ? 0.04
        : 0
  const startAnchorPenalty = Math.max(0, tasteSignals.anchorStrength - 0.76) * 0.14
  const windDownAnchorPenalty = Math.max(0, tasteSignals.anchorStrength - 0.72) * 0.14
  const highlightAnchorStrengthLift = tasteSignals.anchorStrength * 0.21
  const highlightPersonalityLift = tasteSignals.personalityStrength * 0.12
  const highlightSpecificityLift = tasteSignals.categorySpecificity * 0.1
  const momentIntensityLift =
    tasteSignals.momentIntensity.score * 0.18 +
    getMomentIntensityTierBoost(tasteSignals.momentIntensity) * 0.9
  const passiveHighlightArchetype =
    tasteSignals.primaryExperienceArchetype === 'dining' ||
    tasteSignals.primaryExperienceArchetype === 'drinks' ||
    tasteSignals.primaryExperienceArchetype === 'sweet'
  const modeSpecificPassiveHighlightPenalty =
    (lens.tasteMode?.id === 'activity-led' || lens.tasteMode?.id === 'scenic-outdoor') &&
    passiveHighlightArchetype &&
    tasteSignals.momentPotential.score < 0.55
      ? 0.1
      : lens.tasteMode?.id === 'highlight-centered' &&
          passiveHighlightArchetype &&
          tasteSignals.momentPotential.score < 0.48
        ? 0.05
        : 0
  const highlightMomentLift = tasteSignals.momentPotential.score * 0.22
  const strongHighlightMomentLift =
    tasteSignals.momentIdentity.strength === 'strong' &&
    (tasteSignals.momentIdentity.type === 'anchor' ||
      tasteSignals.momentIdentity.type === 'explore')
      ? 0.16
      : 0
  const highlightArchetypeLift = getHighlightArchetypeLift(
    tasteSignals,
    lens.tasteMode?.id,
  ) * 1.1
  const supportRoleCollisionPenalty =
    Math.max(0, tasteSignals.roleSuitability.start - tasteSignals.roleSuitability.highlight) *
      0.1 +
    Math.max(0, tasteSignals.roleSuitability.windDown - tasteSignals.roleSuitability.highlight) *
      0.1
  const genericHighlightPenalty =
    (genericHighlightCategory ? 0.12 : 0.05) *
      Math.max(0, 0.72 - tasteSignals.anchorStrength) +
    modeSpecificPassiveHighlightPenalty +
    (highlightMomentRoleFit < 0.54 ? 0.09 : 0) +
    (passiveHighlightArchetype && tasteSignals.momentIdentity.strength !== 'strong' ? 0.04 : 0) +
    (genericHighlightCategory && tasteSignals.momentPotential.score < 0.46 ? 0.035 : 0)
  const cozyRomanticHighlightMode =
    crewPolicy.crew === 'romantic' && intent.primaryAnchor === 'cozy'
  const romanticCenterpieceConviction = computeRomanticCenterpieceConvictionScore(
    venue,
    tasteSignals,
  )
  const romanticAmbientRichness = Math.max(
    tasteSignals.romanticSignals.ambiance,
    tasteSignals.romanticSignals.ambientExperience,
    tasteSignals.momentEnrichment.ambientUniqueness,
  )
  const hospitalityHighlightArchetype =
    tasteSignals.primaryExperienceArchetype === 'dining' ||
    tasteSignals.primaryExperienceArchetype === 'drinks' ||
    tasteSignals.primaryExperienceArchetype === 'sweet'
  const intimateDiningHighlightSignal =
    hospitalityHighlightArchetype &&
    tasteSignals.romanticSignals.intimacy >= 0.6 &&
    romanticAmbientRichness >= 0.58 &&
    tasteSignals.experientialFactor >= 0.62
  const viewBackedDiningHighlightSignal =
    hospitalityHighlightArchetype &&
    tasteSignals.romanticSignals.scenic >= 0.5 &&
    tasteSignals.romanticSignals.intimacy >= 0.56 &&
    romanticAmbientRichness >= 0.54
  const lowChaosHighIntimacySignal =
    tasteSignals.energy <= 0.68 &&
    tasteSignals.socialDensity <= 0.72 &&
    tasteSignals.romanticSignals.intimacy >= 0.64 &&
    romanticAmbientRichness >= 0.52
  const romanticAtmosphericHighlightBoost =
    cozyRomanticHighlightMode &&
    (intimateDiningHighlightSignal || viewBackedDiningHighlightSignal || lowChaosHighIntimacySignal)
      ? Math.min(
          0.22,
          0.06 +
            Math.max(0, romanticAmbientRichness - 0.52) * 0.12 +
            Math.max(0, tasteSignals.romanticSignals.intimacy - 0.58) * 0.1 +
            Math.max(0, tasteSignals.experientialFactor - 0.6) * 0.08,
        )
      : 0
  const scenicPrimaryHighlightCandidate =
    tasteSignals.primaryExperienceArchetype === 'outdoor' ||
    tasteSignals.primaryExperienceArchetype === 'scenic' ||
    tasteSignals.experienceFamily === 'outdoor_scenic'
  const scenicDepthLowForCozyRomantic =
    scenicPrimaryHighlightCandidate &&
    romanticAmbientRichness < 0.56 &&
    tasteSignals.romanticSignals.intimacy < 0.62 &&
    tasteSignals.momentEnrichment.culturalDepth < 0.46 &&
    tasteSignals.experientialFactor < 0.66
  const cozyRomanticScenicModeration =
    cozyRomanticHighlightMode && scenicPrimaryHighlightCandidate
      ? 0.04 +
        (scenicDepthLowForCozyRomantic
          ? 0.12 +
            Math.max(0, 0.56 - romanticAmbientRichness) * 0.08 +
            Math.max(0, 0.62 - tasteSignals.romanticSignals.intimacy) * 0.06
          : 0)
      : 0
  const genericDiningWithoutDateSignal =
    cozyRomanticHighlightMode &&
    hospitalityHighlightArchetype &&
    !intimateDiningHighlightSignal &&
    !viewBackedDiningHighlightSignal &&
    romanticAmbientRichness < 0.56 &&
    tasteSignals.romanticSignals.intimacy < 0.64 &&
    tasteSignals.momentEnrichment.culturalDepth < 0.48 &&
    tasteSignals.anchorStrength < 0.7 &&
    venue.signature.genericScore >= 0.4
  const romanticGenericDiningSuppression = genericDiningWithoutDateSignal ? 0.18 : 0
  const romanticCenterpieceHighlightBoost =
    cozyRomanticHighlightMode &&
    romanticCenterpieceConviction >= 0.64 &&
    (intimateDiningHighlightSignal || viewBackedDiningHighlightSignal || tasteSignals.anchorStrength >= 0.68)
      ? 0.06 +
        Math.max(0, romanticCenterpieceConviction - 0.64) * 0.22 +
        Math.max(0, tasteSignals.momentIntensity.score - 0.72) * 0.08
      : 0
  const romanticLowConvictionPenalty =
    cozyRomanticHighlightMode &&
    romanticCenterpieceConviction < 0.62 &&
    hospitalityHighlightArchetype &&
    !viewBackedDiningHighlightSignal
      ? 0.08 + Math.max(0, 0.62 - romanticCenterpieceConviction) * 0.2
      : 0
  const discoveryWarmupBoost =
    discoveryPreference?.role === 'start'
      ? 0.24
      : discoveryPreference?.role === 'highlight'
        ? -0.08
        : discoveryPreference?.role === 'windDown'
          ? -0.05
          : 0
  const discoveryPeakBoost =
    discoveryPreference?.role === 'highlight'
      ? 0.34
      : discoveryPreference?.role === 'start' || discoveryPreference?.role === 'windDown'
        ? -0.08
        : 0
  const discoveryCooldownBoost =
    discoveryPreference?.role === 'windDown'
      ? 0.24
      : discoveryPreference?.role === 'highlight'
        ? -0.08
        : discoveryPreference?.role === 'start'
          ? -0.05
          : 0
  const romanticGenericPenalty =
    crewPolicy.crew === 'romantic' && genericCategory && !isRomanticTone ? 0.09 : 0
  const familyNightlifePenalty = crewPolicy.crew === 'curator' && isNightlifeCoded ? 0.17 : 0
  const isDateCoded =
    hasAnyTag(venue, ['intimate', 'date-night', 'romantic', 'chef-led']) ||
    venue.category === 'dessert'
  const romanticPlayfulStartPenalty =
    crewPolicy.crew === 'romantic' &&
    venue.category === 'activity' &&
    !refinements.has('more-exciting')
      ? 0.13
      : 0
  const romanticHighlightGuardrailPenalty =
    crewPolicy.crew === 'romantic' && genericCategory && !isRomanticTone ? 0.16 : 0
  const familyHighlightNightlifePenalty =
    crewPolicy.crew === 'curator' && (isNightlifeCoded || venue.category === 'bar') ? 0.22 : 0
  const familyHighlightDatePenalty = crewPolicy.crew === 'curator' && isDateCoded ? 0.11 : 0
  const familyGenericPenalty =
    crewPolicy.crew === 'curator' && genericCategory && !isFamilyFriendly ? 0.12 : 0
  const familyFormalDiningPenalty =
    crewPolicy.crew === 'curator' ? formalDiningPressure * 0.16 : 0
  const familyFormalHighlightPenalty =
    crewPolicy.crew === 'curator' ? formalDiningPressure * 0.3 : 0
  const familyAdultNightlifePenalty =
    crewPolicy.crew === 'curator' ? adultNightlifePressure * 0.18 : 0
  const familyAdultNightlifeHighlightPenalty =
    crewPolicy.crew === 'curator' ? adultNightlifePressure * 0.34 : 0
  const familyFormalWildcardPenalty =
    crewPolicy.crew === 'curator' ? formalDiningPressure * 0.24 : 0
  const familyAdultNightlifeWildcardPenalty =
    crewPolicy.crew === 'curator' ? adultNightlifePressure * 0.28 : 0
  const casualExplorationFormalPenalty =
    casualExplorationContext ? formalDiningPressure * 0.14 : 0
  const casualExplorationHighlightPenalty =
    casualExplorationContext ? formalDiningPressure * 0.22 : 0
  const casualExplorationAdultNightlifePenalty =
    casualExplorationContext ? adultNightlifePressure * 0.16 : 0
  const casualExplorationWildcardPenalty =
    casualExplorationContext
      ? formalDiningPressure * 0.18 + adultNightlifePressure * 0.18
      : 0
  const supportAdultAnchorPenalty =
    Math.max(0, tasteSignals.anchorStrength - 0.72) * contextualAdultPressure * 0.22
  const wildcardAdultAnchorPenalty =
    Math.max(0, tasteSignals.anchorStrength - 0.66) * contextualAdultPressure * 0.28
  const familyContextBoost = crewPolicy.crew === 'curator' && isFamilyFriendly ? 0.08 : 0
  const romanticContextBoost = crewPolicy.crew === 'romantic' && isRomanticTone ? 0.08 : 0
  const romanticMomentModifierActive = requiresRomanticPersonaMoment(lens)
  const romanticMomentCandidate = romanticMomentModifierActive && tasteSignals.isRomanticMomentCandidate
  const romanticMomentStartLift =
    romanticMomentCandidate &&
    (tasteSignals.momentIdentity.type === 'arrival' ||
      tasteSignals.momentIdentity.type === 'explore' ||
      tasteSignals.momentIdentity.type === 'transition')
      ? 0.05
      : romanticMomentCandidate
        ? 0.02
        : 0
  const romanticMomentHighlightLift =
    romanticMomentCandidate
      ? 0.12 +
        (tasteSignals.momentIdentity.type === 'anchor' ||
        tasteSignals.momentIdentity.type === 'explore'
          ? 0.05
          : 0) +
        (tasteSignals.momentIdentity.strength === 'strong' ? 0.03 : 0) +
        tasteSignals.momentIntensity.score * 0.04 +
        getMomentIntensityTierBoost(tasteSignals.momentIntensity) * 0.2
      : 0
  const romanticMomentWildcardLift = romanticMomentCandidate ? 0.06 : 0
  const romanticFallbackHighlightPenalty =
    romanticMomentModifierActive &&
    !tasteSignals.isRomanticMomentCandidate &&
    passiveHighlightArchetype &&
    tasteSignals.momentIdentity.strength !== 'strong'
      ? 0.05
      : 0
  const friendsMovementBoost =
    crewPolicy.crew === 'socialite' && (isNightlifeCoded || venue.category === 'activity') ? 0.05 : 0
  const universalHighlightPenalty =
    dominanceControl.flaggedUniversal && contextSpecificity.byRole.peak < 0.7 ? 0.04 : 0
  const cozyConversationBoost =
    intent.primaryAnchor === 'cozy' &&
    (venue.category === 'restaurant' ||
      venue.category === 'dessert' ||
      venue.category === 'cafe' ||
      hasAnyTag(venue, ['intimate', 'cozy', 'craft', 'wine']))
      ? 0.12
      : 0
  const cozyMusicPenalty =
    intent.primaryAnchor === 'cozy' &&
    crewPolicy.crew === 'romantic' &&
    (venue.category === 'live_music' || venue.category === 'event')
      ? vibeAuthority.musicSupportSource === 'pack' || vibeAuthority.musicSupportSource === 'both'
        ? 0.04
        : 0.2
      : 0
  const adventurousOutdoorBoost =
    intent.primaryAnchor === 'adventurous-outdoor' &&
    (venue.category === 'park' || hasAnyTag(venue, ['nature', 'walkable', 'scenic', 'viewpoint']))
      ? 0.1
      : 0
  const adventurousUrbanBoost =
    intent.primaryAnchor === 'adventurous-urban' &&
    (hasAnyTag(venue, ['underexposed', 'street-food', 'community', 'local']) ||
      venue.category === 'bar' ||
      venue.category === 'event')
      ? 0.1
      : 0
  const outdoorAdventureLift =
    intent.primaryAnchor === 'adventurous-outdoor' && vibeAuthority.adventureRead === 'outdoor'
      ? 0.12
      : 0
  const outdoorAdventurePenalty =
    intent.primaryAnchor === 'adventurous-outdoor' && vibeAuthority.adventureRead === 'urban'
      ? 0.18
      : intent.primaryAnchor === 'adventurous-outdoor' && vibeAuthority.adventureRead === 'balanced'
        ? 0.06
        : 0
  const urbanAdventureLift =
    intent.primaryAnchor === 'adventurous-urban' && vibeAuthority.adventureRead === 'urban'
      ? 0.12
      : 0
  const urbanAdventurePenalty =
    intent.primaryAnchor === 'adventurous-urban' && vibeAuthority.adventureRead === 'outdoor'
      ? 0.18
      : intent.primaryAnchor === 'adventurous-urban' && vibeAuthority.adventureRead === 'balanced'
        ? 0.06
        : 0
  const highlightVibeMismatchPenalty = Math.max(0, 0.6 - vibeAuthority.byRole.highlight) * 0.24
  const highlightValidityLift =
    highlightValidity.validityLevel === 'valid'
      ? 0.16
      : highlightValidity.validityLevel === 'fallback'
        ? -0.05
        : -0.42
  const highlightTierAdjustment =
    highlightValidity.candidateTier === 'highlight-capable'
      ? 0.04
      : highlightValidity.candidateTier === 'support-only'
        ? -0.03
        : -0.14
  const qualityDemotionPenalty =
    venue.source.qualityGateStatus === 'demoted'
      ? liveFairness.supportRecoveryEligible && venue.settings.highlightCapabilityTier !== 'highlight-capable'
        ? 0.035
        : 0.06
      : 0
  const livePeakTimeLift = strongLiveWindow ? 0.08 : softLiveWindow ? 0.03 : 0
  const livePeakTimePenalty =
    weakLiveWindow
      ? 0.12
      : isLiveSource && !venue.source.hoursKnown && venue.category !== 'restaurant'
        ? liveFairness.supportRecoveryEligible ? 0.012 : 0.03
        : 0
  const packLiteralPenalty =
    highlightValidity.packLiteralRequirementLabel && !highlightValidity.packLiteralRequirementSatisfied
      ? highlightValidity.validityLevel === 'invalid'
        ? 0.24
        : 0.08
      : 0

  const warmup = clamp01(
    fitScore * 0.41 +
      venue.roleAffinity.warmup * 0.24 +
      stopShapeFit.start * 0.24 +
      vibeAuthority.byRole.start * 0.2 +
      contextSpecificity.byRole.warmup * 0.13 +
      lensCompatibility * 0.14 +
      (1 - energyFactor) * 0.05 -
      dominanceControl.byRole.warmup * 0.7 -
      warmupContractInfluence.penalty +
      discoveryWarmupBoost +
      relaxedPenalty * 0.4 -
      closerByPenalty * 0.4 +
      warmupContractInfluence.bonus +
      modeAlignmentRoleInfluence.warmup -
      modeAlignmentRolePenalty.warmup +
      startLightModeAlignmentBoost +
      startMomentRoleFit * 0.08 +
      romanticMomentStartLift +
      startEnergyEntryLift +
      startIntentionalityBonus +
      romanticContextBoost * 0.4 +
      familyContextBoost * 0.35 +
      cozyConversationBoost * 0.45 +
      adventurousOutdoorBoost * 0.3 +
      outdoorAdventureLift * 0.2 -
      outdoorAdventurePenalty * 0.18 +
      adventurousUrbanBoost * 0.3 +
      urbanAdventureLift * 0.16 -
      urbanAdventurePenalty * 0.12 +
      hybridLiveLift.roleLiftByRole.warmup +
      warmupHoursPressure.boost -
      warmupHoursPressure.penalty +
      fancyLift * 0.4 -
      (strongLiveWindow ? 0.02 : 0) -
      romanticGenericPenalty * 0.4 -
      romanticPlayfulStartPenalty -
      familyFormalDiningPenalty -
      familyAdultNightlifePenalty -
      casualExplorationFormalPenalty -
      casualExplorationAdultNightlifePenalty -
      supportAdultAnchorPenalty -
      softClosingStartPenalty -
      startAnchorPenalty -
      (energyFactor > 0.8 ? 0.06 : 0),
  )
  const peak = clamp01(
    fitScore * 0.42 +
      venue.roleAffinity.peak * 0.27 +
      stopShapeFit.highlight * 0.2 +
      vibeAuthority.byRole.highlight * 0.34 +
      vibeAuthority.packPressure.highlight * 0.06 +
      contextSpecificity.byRole.peak * 0.26 +
      contextSpecificity.personaSignal * 0.12 +
      contextSpecificity.vibeSignal * 0.12 +
      lensCompatibility * 0.11 +
      energyFactor * 0.06 +
      discoveryPeakBoost +
      highlightAnchorStrengthLift +
      highlightPersonalityLift +
      highlightSpecificityLift +
      momentIntensityLift +
      highlightMomentLift +
      highlightMomentRoleFit * 0.22 +
      strongHighlightMomentLift +
      romanticMomentHighlightLift +
      highlightArchetypeLift +
      peakEnergyLift -
      dominanceControl.byRole.peak -
      peakContractInfluence.penalty -
      universalHighlightPenalty -
      closerByPenalty * 0.2 +
      peakContractInfluence.bonus +
      modeAlignmentRoleInfluence.peak -
      modeAlignmentRolePenalty.peak +
      familyContextBoost +
      romanticContextBoost * 0.8 +
      cozyConversationBoost +
      adventurousOutdoorBoost * 0.25 +
      outdoorAdventureLift -
      outdoorAdventurePenalty +
      adventurousUrbanBoost * 0.35 +
      urbanAdventureLift -
      urbanAdventurePenalty +
      friendsMovementBoost * 0.4 +
      fancyLift * 0.3 +
      uniqueLift * 0.5 -
      packLiteralPenalty -
      qualityDemotionPenalty -
      livePeakTimePenalty -
      familyNightlifePenalty -
      familyHighlightNightlifePenalty -
      familyAdultNightlifeHighlightPenalty -
      familyHighlightDatePenalty -
      familyFormalHighlightPenalty -
      casualExplorationHighlightPenalty -
      familyGenericPenalty -
      romanticGenericPenalty -
      romanticFallbackHighlightPenalty -
      romanticHighlightGuardrailPenalty -
      genericHighlightPenalty -
      romanticGenericDiningSuppression -
      romanticLowConvictionPenalty -
      cozyRomanticScenicModeration -
      supportRoleCollisionPenalty -
      cozyMusicPenalty +
      romanticAtmosphericHighlightBoost +
      romanticCenterpieceHighlightBoost +
      livePeakTimeLift +
      hybridLiveLift.roleLiftByRole.peak +
      peakHoursPressure.boost -
      peakHoursPressure.penalty +
      highlightTierAdjustment +
      highlightValidityLift -
      highlightVibeMismatchPenalty -
      relaxedPenalty * 0.3,
  )
  const wildcard = clamp01(
    fitScore * 0.3 +
      venue.roleAffinity.wildcard * 0.23 +
      hiddenGemScore * 0.2 +
      venue.distinctivenessScore * 0.12 +
      stopShapeFit.surprise * 0.12 +
      vibeAuthority.byRole.surprise * 0.17 +
      contextSpecificity.byRole.wildcard * 0.18 +
      contextSpecificity.vibeSignal * 0.1 +
      lensCompatibility * 0.1 +
      crewPolicy.wildcardBias * 0.08 +
      wildcardLift +
      discoveryLift -
      (1 - surpriseMomentRoleFit) * 0.06 -
      dominanceControl.byRole.wildcard * 0.9 -
      wildcardContractInfluence.penalty +
      wildcardContractInfluence.bonus +
      modeAlignmentRoleInfluence.wildcard -
      modeAlignmentRolePenalty.wildcard -
      familyNightlifePenalty * 0.65 -
      familyFormalWildcardPenalty -
      familyAdultNightlifeWildcardPenalty -
      casualExplorationWildcardPenalty -
      wildcardAdultAnchorPenalty +
      romanticMomentWildcardLift +
      friendsMovementBoost +
      adventurousUrbanBoost * 0.42 +
      urbanAdventureLift * 0.42 -
      urbanAdventurePenalty * 0.28 +
      adventurousOutdoorBoost * 0.24 +
      outdoorAdventureLift * 0.24 -
      outdoorAdventurePenalty * 0.24 +
      closerByPenalty * 0.2 +
      hybridLiveLift.roleLiftByRole.wildcard +
      wildcardHoursPressure.boost -
      wildcardHoursPressure.penalty +
      fancyLift * 0.2 +
      uniqueLift -
      (strongLiveWindow ? 0.03 : 0) -
      relaxedPenalty * 0.2,
  )
  const cooldown = clamp01(
    fitScore * 0.33 +
      venue.roleAffinity.cooldown * 0.19 +
      stopShapeFit.windDown * 0.28 +
      vibeAuthority.byRole.windDown * 0.22 +
      contextSpecificity.byRole.cooldown * 0.18 +
      contextSpecificity.personaSignal * 0.1 +
      lensCompatibility * 0.13 +
      (1 - energyFactor) * 0.09 +
      proximityFit * 0.08 +
      discoveryCooldownBoost +
      windDownMomentRoleFit * 0.11 +
      windDownSoftModeAlignmentBoost +
      windDownCloseLingerBoost +
      windDownIntentionalityBonus +
      romanticContextBoost * 0.5 +
      familyContextBoost * 0.42 -
      dominanceControl.byRole.cooldown * 0.8 -
      cooldownContractInfluence.penalty +
      cooldownContractInfluence.bonus +
      modeAlignmentRoleInfluence.cooldown -
      modeAlignmentRolePenalty.cooldown -
      fancyLift +
      cozyConversationBoost * 0.4 +
      outdoorAdventureLift * 0.24 -
      outdoorAdventurePenalty * 0.22 +
      urbanAdventureLift * 0.22 -
      urbanAdventurePenalty * 0.18 +
      (refinements.has('more-relaxed') ? 0.06 : 0) +
      hybridLiveLift.roleLiftByRole.cooldown +
      cooldownHoursPressure.boost -
      cooldownHoursPressure.penalty +
      (softLiveWindow ? 0.03 : 0) -
      (crewPolicy.windDownPreferredCategories.includes(venue.category) ? 0.08 : 0) -
      closerByPenalty * 0.5 -
      (crewPolicy.windDownAvoidCategories.includes(venue.category) ? 0.12 : 0) -
      familyFormalDiningPenalty -
      familyAdultNightlifePenalty -
      casualExplorationFormalPenalty -
      casualExplorationAdultNightlifePenalty -
      supportAdultAnchorPenalty -
      windDownSecondPeakPenalty -
      windDownAnchorPenalty -
      (venue.energyLevel >= 4 ? 0.16 : 0),
  )

  return {
    venue,
    candidateIdentity: {
      candidateId: venue.id,
      baseVenueId: venue.id,
      kind: 'base',
      traceLabel: venue.name,
    },
    momentIdentity: tasteSignals.momentIdentity,
    fitBreakdown: {
      anchorFit,
      crewFit,
      proximityFit,
      budgetFit,
      uniquenessFit,
      hiddenGemFit,
    },
    fitScore,
    hiddenGemScore,
    lensCompatibility,
    contextSpecificity,
    dominanceControl,
    roleContract,
    stopShapeFit,
    vibeAuthority,
    highlightValidity,
    roleScores: {
      warmup,
      peak,
      wildcard,
      cooldown,
    },
    taste: {
      signals: tasteSignals,
      modeAlignment: {
        score: tasteModeAlignment.overall,
        penalty: tasteModeAlignment.penalty,
        lane: tasteModeAlignment.lane,
        tier: tasteModeAlignment.tier,
        supportiveTagScore: tasteModeAlignment.supportiveTagScore,
        lanePriorityScore: tasteModeAlignment.lanePriorityScore,
      },
      fallbackPenalty: {
        signalScore: genericHospitalityFallbackSignal,
        appliedPenalty: 0,
        applied: false,
        strongerAlternativePresent: false,
        reason: genericHospitalityFallbackSignal > 0 ? 'awaiting pool comparison' : 'not generic fallback',
      },
      rolePoolInfluence: tasteRolePoolInfluence,
    },
  }
}

export function scoreVenueCollection(
  venues: Venue[],
  intent: IntentProfile,
  crewPolicy: CrewPolicy,
  lens: ExperienceLens,
  roleContracts?: RoleContractSet,
  starterPack?: StarterPack,
): ScoredVenue[] {
  const baseCandidates = venues.map((venue) =>
    scoreVenueFit(venue, intent, crewPolicy, lens, roleContracts, starterPack),
  )
  const momentCandidates = deriveMomentVenueRecords({
    intent,
    venuePool: venues,
  }).map(({ moment, venue }) => {
    const candidate = scoreVenueFit(venue, intent, crewPolicy, lens, roleContracts, starterPack)
    const parentVenueName = moment.parentPlaceId
      ? venues.find((item) => item.id === moment.parentPlaceId)?.name
      : undefined
    return {
      ...candidate,
      candidateIdentity: {
        candidateId: `moment::${moment.id}`,
        baseVenueId: `moment::${moment.id}`,
        kind: 'moment',
        momentId: moment.id,
        momentType: moment.momentType,
        momentSourceType: moment.sourceType,
        parentPlaceId: moment.parentPlaceId,
        traceLabel: parentVenueName
          ? `${moment.title} | ${parentVenueName}`
          : moment.title,
      },
    }
  })
  const injectedVariants = baseCandidates.flatMap((candidate) => {
    const variant = createHyperlocalActivationVariant(candidate, lens)
    return variant ? [variant] : []
  })
  const scored = [...baseCandidates, ...momentCandidates, ...injectedVariants]
  const adjusted = scored.map((candidate) => {
    const fallbackAssessment = assessGenericHospitalityFallbackPenalty(candidate, scored)
    if (fallbackAssessment.appliedPenalty <= 0) {
      return {
        ...candidate,
        taste: {
          ...candidate.taste,
          fallbackPenalty: {
            ...candidate.taste.fallbackPenalty,
            strongerAlternativePresent: fallbackAssessment.strongerAlternativePresent,
            strongerAlternativeName: fallbackAssessment.strongerAlternativeName,
            reason: fallbackAssessment.reason,
          },
        },
      }
    }

    const appliedPenalty = fallbackAssessment.appliedPenalty
    return {
      ...candidate,
      fitScore: clamp01(candidate.fitScore - appliedPenalty * 0.16),
      roleScores: {
        ...candidate.roleScores,
        peak: clamp01(candidate.roleScores.peak - appliedPenalty),
      },
      taste: {
        ...candidate.taste,
        fallbackPenalty: {
          ...candidate.taste.fallbackPenalty,
          appliedPenalty,
          applied: true,
          strongerAlternativePresent: fallbackAssessment.strongerAlternativePresent,
          strongerAlternativeName: fallbackAssessment.strongerAlternativeName,
          reason: fallbackAssessment.reason,
        },
      },
    }
  })

  return adjusted.sort((left, right) => right.fitScore - left.fitScore)
}
