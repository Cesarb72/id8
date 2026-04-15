import type { PersonaMode } from '../types/intent'
import type { DirectionCandidate } from './buildDirectionCandidates'

export interface PersonaShapingDebugMeta {
  persona: PersonaMode
  personaBoost: number
  finalScore: number
}

export interface PersonaShapedDirectionCandidate extends DirectionCandidate {
  finalScore: number
  shapingDebug?: PersonaShapingDebugMeta
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function toFixed(value: number): number {
  return Number(value.toFixed(3))
}

function computeEnvironmentQuality(candidate: DirectionCandidate): number {
  const tags = new Set(candidate.derivedFrom.experientialTags.map((tag) => tag.toLowerCase()))
  const mix = candidate.derivedFrom.hospitalityMix
  const ambiance = candidate.derivedFrom.ambianceProfile
  const culturePresence = mix.culture >= 0.2 ? 0.18 : mix.culture >= 0.1 ? 0.09 : 0
  const intimacyNoisePair =
    ambiance.intimacy === 'high' && ambiance.noise === 'low'
      ? 0.18
      : ambiance.intimacy === 'high' || ambiance.noise === 'low'
        ? 0.08
        : 0
  const curatedSignal = ['arts-adjacent', 'curated', 'intentional', 'intimate', 'cultural'].some(
    (tag) => tags.has(tag),
  )
    ? 0.12
    : 0

  return clamp(culturePresence + intimacyNoisePair + curatedSignal, 0, 1)
}

function hasFlowSignal(seed: string): boolean {
  const lowered = seed.toLowerCase()
  return lowered.includes('->') || lowered.includes('\u2192') || lowered.includes(' then ')
}

function computeSequenceQuality(candidate: DirectionCandidate): number {
  const mix = candidate.derivedFrom.hospitalityMix
  const momentSeeds = candidate.derivedFrom.momentSeeds.filter((seed) => seed.trim().length > 0)
  const seedMultiplicity = momentSeeds.length >= 3 ? 0.24 : momentSeeds.length >= 2 ? 0.16 : 0
  const flowSignal = momentSeeds.some((seed) => hasFlowSignal(seed)) ? 0.18 : 0
  const diversityCount = Object.values(mix).filter((value) => value >= 0.16).length
  const diversityWithoutActivityDominance =
    mix.activity <= 0.45 && diversityCount >= 3 ? 0.12 : mix.activity <= 0.5 && diversityCount >= 2 ? 0.06 : 0

  return clamp(seedMultiplicity + flowSignal + diversityWithoutActivityDominance, 0, 1)
}

function computeMixDiversityScore(candidate: DirectionCandidate): number {
  const mix = candidate.derivedFrom.hospitalityMix
  const diversityCount = Object.values(mix).filter((value) => value >= 0.14).length
  return clamp(diversityCount / 5, 0, 1)
}

function computeLaneDiversityProxy(candidate: DirectionCandidate): number {
  const mix = candidate.derivedFrom.hospitalityMix
  const laneCount = Object.values(mix).filter((value) => value >= 0.2).length
  return clamp(laneCount / 5, 0, 1)
}

function computeMovementFriendlyScore(candidate: DirectionCandidate): number {
  const seeds = candidate.derivedFrom.momentSeeds.filter((seed) => seed.trim().length > 0)
  const flowSignal = seeds.some((seed) => hasFlowSignal(seed)) ? 0.45 : 0
  const multiStageSignal = seeds.length >= 2 ? 0.35 : 0
  const activitySignal = candidate.derivedFrom.hospitalityMix.activity > 0.34 ? 0.2 : 0
  return clamp(flowSignal + multiStageSignal + activitySignal, 0, 1)
}

function softenRomanticSubtitle(subtitle: string): string {
  const withShared = subtitle.replace(/direction from/i, 'shared direction from')
  if (/shared|intentional|together|built/i.test(withShared)) {
    return withShared
  }
  return `${withShared} Built for intentional time together.`
}

function softenFriendsSubtitle(subtitle: string): string {
  if (/social|energetic|group|momentum/i.test(subtitle)) {
    return subtitle
  }
  return `${subtitle} Built for social momentum across stops.`
}

function hasSeedTerm(seeds: string[], terms: string[]): boolean {
  return seeds.some((seed) => terms.some((term) => seed.includes(term)))
}

function shouldPreserveExperienceSubtitle(candidate: DirectionCandidate): boolean {
  return (
    candidate.directionPrimaryIdentitySource.startsWith('contract:') ||
    candidate.directionPrimaryIdentitySource.startsWith('strategy:')
  )
}

export function applyPersonaShaping(
  candidates: DirectionCandidate[],
  persona: PersonaMode,
): PersonaShapedDirectionCandidate[] {
  const shaped = candidates.map((candidate) => {
    if (persona === 'family') {
      const mix = candidate.derivedFrom.hospitalityMix
      const ambiance = candidate.derivedFrom.ambianceProfile
      const tags = new Set(candidate.derivedFrom.experientialTags.map((tag) => tag.toLowerCase()))
      const sequenceQuality = computeSequenceQuality(candidate)
      const movementFriendly = computeMovementFriendlyScore(candidate)
      const mixDiversity = computeMixDiversityScore(candidate)
      const laneDiversity = computeLaneDiversityProxy(candidate)
      const seeds = candidate.derivedFrom.momentSeeds
        .filter((seed) => seed.trim().length > 0)
        .map((seed) => seed.toLowerCase())
      const momentSeedCount = seeds.length
      const hasFlowSeed = seeds.some((seed) => hasFlowSignal(seed))
      const hasNightlifeSeed = hasSeedTerm(seeds, [
        'late',
        'night',
        'bar',
        'cocktail',
        'club',
        'after',
        'music',
      ])
      const hasLearningSeed = hasSeedTerm(seeds, [
        'gallery',
        'museum',
        'historic',
        'architecture',
        'science',
        'art',
        'exhibit',
      ])
      const hasOpenAirRecoverySeed = hasSeedTerm(seeds, ['stroll', 'walk', 'park', 'coffee', 'dessert'])
      const hasNightlifeContinuationSeed = hasSeedTerm(seeds, ['wine bar', 'cocktail', 'bar', 'late', 'night'])
      const lowFrictionEnvironment = ambiance.noise !== 'high' && ambiance.energy !== 'high'
      const activityAnchored = mix.activity >= 0.3 || tags.has('activity-led')
      const recoverySupport = clamp(
        (ambiance.noise === 'low' ? 0.42 : ambiance.noise === 'medium' ? 0.28 : 0) +
          (mix.dining + mix.cafe) * 0.35 +
          sequenceQuality * 0.22 +
          (momentSeedCount >= 2 ? 0.18 : 0) +
          (hasFlowSeed ? 0.12 : 0),
        0,
        1,
      )
      const chaosLoad = clamp(
        (ambiance.noise === 'high' ? 0.35 : ambiance.noise === 'medium' ? 0.18 : 0) +
          (mix.activity > 0.46 ? 0.24 : mix.activity > 0.4 ? 0.14 : 0) +
          (tags.has('mixed-program') ? 0.18 : 0) +
          (hasNightlifeSeed ? 0.12 : 0),
        0,
        1,
      )
      const wonderLearningProxy = clamp(
        mix.culture * 0.52 +
          sequenceQuality * 0.34 +
          (hasLearningSeed ? 0.2 : 0) +
          (tags.has('arts-adjacent') ? 0.18 : 0) +
          (momentSeedCount >= 3 ? 0.11 : momentSeedCount >= 2 ? 0.06 : 0) -
          chaosLoad,
        0,
        1,
      )
      const lowFrictionContinuation = clamp(
        sequenceQuality * 0.45 +
          movementFriendly * 0.18 +
          recoverySupport * 0.35 +
          (hasFlowSeed ? 0.14 : 0) +
          (hasOpenAirRecoverySeed ? 0.07 : 0) -
          (hasNightlifeContinuationSeed ? 0.12 : 0),
        0,
        1,
      )

      const flowContinuityBoost =
        sequenceQuality * 0.14 +
        movementFriendly * 0.07 +
        (momentSeedCount >= 3 ? 0.05 : momentSeedCount >= 2 ? 0.025 : 0)
      const interactiveAnchorBoost =
        (activityAnchored ? mix.activity * 0.04 : 0) +
        (tags.has('activity-led') ? 0.012 : 0) +
        (ambiance.energy === 'medium' || ambiance.energy === 'high' ? 0.008 : 0)
      const lowFrictionBoost =
        (ambiance.noise === 'low' ? 0.05 : ambiance.noise === 'medium' ? 0.03 : 0) +
        (ambiance.energy === 'low' ? 0.045 : ambiance.energy === 'medium' ? 0.028 : 0) +
        (mix.dining * 0.07 + mix.cafe * 0.08)
      const resetRecoveryBoost =
        recoverySupport * 0.05 +
        (ambiance.energy === 'low' ? 0.02 : ambiance.energy === 'medium' ? 0.01 : 0)
      const lowFrictionContinuationBoost = lowFrictionContinuation * 0.04
      const manageableTransitionsBoost =
        movementFriendly * 0.03 +
        (hasFlowSeed ? 0.012 : 0) +
        (momentSeedCount >= 2 ? 0.01 : 0)
      const balancedEnergyBoost =
        ambiance.energy === 'medium' &&
        ambiance.noise !== 'high' &&
        mix.activity >= 0.24 &&
        mix.activity <= 0.46 &&
        mix.dining + mix.cafe >= 0.22
          ? 0.018
          : ambiance.energy === 'high' && recoverySupport >= 0.55
            ? 0.012
            : 0
      const moderateAmbientBoost =
        (ambiance.energy === 'medium' || ambiance.energy === 'low') &&
        (ambiance.noise === 'medium' || ambiance.noise === 'low')
          ? 0.012
          : 0
      const adultPayoffBoost =
        mix.culture >= 0.18 &&
        ambiance.intimacy !== 'low' &&
        ambiance.noise !== 'high' &&
        recoverySupport >= 0.55
          ? 0.05
          : mix.culture >= 0.14 && ambiance.noise !== 'high'
            ? 0.024
            : 0
      const wonderLearningBoost = wonderLearningProxy * 0.05
      const momentPotentialPacedBoost =
        candidate.derivedFrom.momentPotential * (lowFrictionEnvironment ? 0.028 : 0.012) +
        (sequenceQuality >= 0.45 ? 0.012 : 0)
      const cultureContextBoost =
        (lowFrictionEnvironment ? mix.culture * 0.065 : mix.culture * 0.02) +
        (tags.has('arts-adjacent') && lowFrictionEnvironment ? 0.02 : 0) +
        (hasLearningSeed && lowFrictionEnvironment ? 0.015 : 0)
      const moderateDiversityBoost =
        mixDiversity >= 0.5 && mixDiversity <= 0.8
          ? 0.03
          : laneDiversity >= 0.4 && laneDiversity <= 0.75
            ? 0.015
            : 0
      const intimacySoftBoost =
        ambiance.intimacy === 'high' ? 0.006 : ambiance.intimacy === 'medium' ? 0.003 : 0

      const highEnergyPenalty =
        ambiance.energy === 'high' && recoverySupport < 0.55
          ? 0.085
          : ambiance.energy === 'high'
            ? 0.04
            : 0
      const highNoisePenalty =
        ambiance.noise === 'high'
          ? 0.095
          : ambiance.noise === 'medium' && mix.activity > 0.42 && recoverySupport < 0.55
            ? 0.03
            : 0
      const activityDominancePenalty =
        mix.activity > 0.48 ? 0.07 : mix.activity > 0.4 ? 0.03 : mix.activity > 0.34 ? 0.015 : 0
      const activityLedPenalty =
        tags.has('activity-led') && mix.culture < 0.22
          ? 0.07
          : tags.has('activity-led') && lowFrictionEnvironment && sequenceQuality >= 0.28
            ? 0.04
            : tags.has('activity-led')
              ? 0.055
              : 0
      const fragmentationPenalty =
        (sequenceQuality < 0.28 ? 0.05 : sequenceQuality < 0.4 ? 0.03 : 0) +
        (momentSeedCount < 2 ? 0.03 : 0) +
        (momentSeedCount >= 2 && !hasFlowSeed && movementFriendly < 0.55 ? 0.015 : 0)
      const mixedProgramChaosPenalty =
        tags.has('mixed-program') && mixDiversity > 0.85 && sequenceQuality < 0.6 && wonderLearningProxy < 0.58
          ? 0.08
          : tags.has('mixed-program') && sequenceQuality < 0.45
            ? 0.045
            : 0
      const highNoiseWeakCulturePenalty =
        ambiance.noise === 'high' && mix.culture < 0.24
          ? 0.065
          : ambiance.noise === 'medium' && mix.culture < 0.18
            ? 0.02
            : 0
      const drinksNightlifePenalty =
        (mix.drinks > 0.24
          ? 0.045
          : mix.drinks > 0.18
            ? 0.028
            : mix.drinks > 0.14 && ambiance.energy === 'high'
              ? 0.03
              : 0) +
        (hasNightlifeSeed ? 0.018 : 0)
      const nightlifeContinuationPenalty =
        hasNightlifeContinuationSeed && (mix.culture < 0.26 || recoverySupport < 0.55)
          ? 0.03
          : hasNightlifeContinuationSeed
            ? 0.015
            : 0
      const weakLandingPenalty =
        recoverySupport < 0.45 && momentSeedCount < 2
          ? 0.035
          : recoverySupport < 0.5 && sequenceQuality < 0.35
            ? 0.02
            : 0
      const brittleFlowPenalty =
        lowFrictionContinuation < 0.5 && sequenceQuality < 0.4
          ? 0.03
          : lowFrictionContinuation < 0.6 && movementFriendly < 0.55
            ? 0.015
            : 0
      const highFrictionMovementPenalty =
        movementFriendly < 0.45 && sequenceQuality < 0.38 ? 0.025 : 0
      const antiSaturationOffset = 0.335

      const personaBoostRaw =
        flowContinuityBoost +
        interactiveAnchorBoost +
        lowFrictionBoost +
        resetRecoveryBoost +
        lowFrictionContinuationBoost +
        manageableTransitionsBoost +
        balancedEnergyBoost +
        moderateAmbientBoost +
        adultPayoffBoost +
        wonderLearningBoost +
        momentPotentialPacedBoost +
        cultureContextBoost +
        moderateDiversityBoost +
        intimacySoftBoost -
        highEnergyPenalty -
        highNoisePenalty -
        activityDominancePenalty -
        activityLedPenalty -
        fragmentationPenalty -
        mixedProgramChaosPenalty -
        highNoiseWeakCulturePenalty -
        drinksNightlifePenalty -
        nightlifeContinuationPenalty -
        weakLandingPenalty -
        brittleFlowPenalty -
        highFrictionMovementPenalty -
        antiSaturationOffset
      const personaBoost = clamp(personaBoostRaw, -0.12, 0.12)
      const finalScore = candidate.confidence + personaBoost

      return {
        ...candidate,
        finalScore,
        shapingDebug: {
          persona,
          personaBoost: toFixed(personaBoost),
          finalScore: toFixed(finalScore),
        },
      }
    }

    if (persona === 'friends') {
      const mix = candidate.derivedFrom.hospitalityMix
      const ambiance = candidate.derivedFrom.ambianceProfile
      const tags = new Set(candidate.derivedFrom.experientialTags.map((tag) => tag.toLowerCase()))
      const sequenceQuality = computeSequenceQuality(candidate)
      const mixDiversity = computeMixDiversityScore(candidate)
      const laneDiversity = computeLaneDiversityProxy(candidate)
      const movementFriendly = computeMovementFriendlyScore(candidate)
      const seeds = candidate.derivedFrom.momentSeeds
        .filter((seed) => seed.trim().length > 0)
        .map((seed) => seed.toLowerCase())
      const momentSeedCount = seeds.length
      const lateNightSupport =
        hasSeedTerm(seeds, ['late', 'night', 'wine bar', 'cocktail', 'bar', 'music', 'after']) ||
        mix.drinks >= 0.16
      const sceneEdgeSignal =
        hasSeedTerm(seeds, ['detour', 'wander', 'gallery', 'speakeasy', 'offbeat']) ||
        tags.has('mixed-program') ||
        tags.has('lively')
      const eventPresenceSignal =
        hasSeedTerm(seeds, ['performance', 'music', 'show', 'event', 'gallery']) ||
        tags.has('arts-adjacent')
      const culturalAnchorSignal =
        hasSeedTerm(seeds, ['gallery', 'museum', 'historic', 'architecture', 'performance']) ||
        tags.has('arts-adjacent')
      const curiositySignal =
        hasSeedTerm(seeds, ['detour', 'wander', 'surprise', 'offbeat', 'speakeasy']) ||
        tags.has('mixed-program')

      const socialEnergyBoost =
        mix.activity * 0.14 +
        mix.drinks * 0.12 +
        (ambiance.energy === 'high' ? 0.04 : ambiance.energy === 'medium' ? 0.03 : 0)
      const varietyBoost = mixDiversity * 0.04 + laneDiversity * 0.025
      const momentumBoost =
        movementFriendly * 0.04 +
        sequenceQuality * 0.025 +
        candidate.derivedFrom.momentPotential * 0.03 +
        (momentSeedCount >= 3 ? 0.03 : momentSeedCount >= 2 ? 0.02 : 0)
      const groupAssemblyBoost = (mix.dining + mix.cafe) * 0.03 + (mix.activity >= 0.34 ? 0.015 : 0)
      const lateNightBoost = lateNightSupport ? 0.02 : 0
      const sceneCredibilityBoost =
        (sceneEdgeSignal ? 0.02 : 0) +
        (eventPresenceSignal ? 0.015 : 0) +
        (tags.has('activity-led') ? 0.01 : 0)
      const mixedProgramMomentumBoost =
        tags.has('mixed-program') && movementFriendly >= 0.55
          ? 0.02
          : tags.has('mixed-program')
            ? 0.01
            : 0
      const cultureCuriosityBoost =
        mix.culture * 0.05 +
        (tags.has('arts-adjacent') ? 0.02 : 0) +
        (culturalAnchorSignal ? 0.015 : 0) +
        (curiositySignal ? 0.01 : 0)
      const conversationSpaceBoost =
        (ambiance.noise === 'low' ? 0.02 : ambiance.noise === 'medium' ? 0.014 : 0) +
        (mix.dining + mix.cafe + mix.culture) * 0.03 +
        (mix.activity < 0.4 ? 0.012 : 0) +
        sequenceQuality * 0.015
      const atmosphericMemoryBoost =
        candidate.derivedFrom.momentPotential * 0.015 +
        (momentSeedCount >= 3 ? 0.015 : 0) +
        (culturalAnchorSignal && momentSeedCount >= 2 ? 0.01 : 0)
      const lowNoiseSoftBoost =
        ambiance.noise === 'medium' ? 0.012 : ambiance.noise === 'low' ? 0.008 : 0
      const intimacySoftBoost =
        ambiance.intimacy === 'high' ? 0.003 : ambiance.intimacy === 'medium' ? 0.0015 : 0

      const deadEnergyPenalty = ambiance.energy === 'low' ? 0.06 : 0
      const weakMomentumPenalty =
        movementFriendly < 0.45 && sequenceQuality < 0.4
          ? 0.05
          : movementFriendly < 0.55 && sequenceQuality < 0.45
            ? 0.02
            : 0
      const narrowPenalty = mixDiversity < 0.45 ? 0.05 : mixDiversity < 0.6 ? 0.02 : 0
      const noContinuationPenalty =
        !lateNightSupport && mix.activity < 0.34 && mix.drinks < 0.14 ? 0.045 : 0
      const overlyQuietPenalty = ambiance.noise === 'low' && ambiance.energy === 'low' ? 0.04 : 0
      const overlyIntimatePenalty =
        ambiance.intimacy === 'high' && ambiance.energy === 'low' && ambiance.noise === 'low' ? 0.03 : 0
      const chaoticNoisePenalty =
        tags.has('mixed-program') && ambiance.noise === 'high' && movementFriendly < 0.5 ? 0.03 : 0
      const genericActivityPenalty =
        tags.has('activity-led') && mix.culture < 0.24 ? 0.065 : mix.activity > 0.44 && mix.culture < 0.2 ? 0.03 : 0
      const highNoiseWeakCulturePenalty =
        ambiance.noise === 'high' && mix.culture < 0.22
          ? 0.05
          : ambiance.noise === 'medium' && mix.culture < 0.16
            ? 0.02
            : 0
      const broadSocialNoAnchorPenalty =
        mix.activity + mix.drinks > 0.55 && !culturalAnchorSignal && !curiositySignal ? 0.04 : 0
      const lowMemoryPenalty =
        momentSeedCount < 2 && candidate.derivedFrom.momentPotential < 0.9 && !culturalAnchorSignal ? 0.03 : 0
      const antiSaturationOffset = 0.22

      const personaBoostRaw =
        socialEnergyBoost +
        varietyBoost +
        momentumBoost +
        groupAssemblyBoost +
        lateNightBoost +
        sceneCredibilityBoost +
        mixedProgramMomentumBoost +
        cultureCuriosityBoost +
        conversationSpaceBoost +
        atmosphericMemoryBoost +
        lowNoiseSoftBoost +
        intimacySoftBoost -
        deadEnergyPenalty -
        weakMomentumPenalty -
        narrowPenalty -
        noContinuationPenalty -
        overlyQuietPenalty -
        overlyIntimatePenalty -
        chaoticNoisePenalty -
        genericActivityPenalty -
        highNoiseWeakCulturePenalty -
        broadSocialNoAnchorPenalty -
        lowMemoryPenalty -
        antiSaturationOffset
      const personaBoost = clamp(personaBoostRaw, -0.12, 0.12)
      const finalScore = candidate.confidence + personaBoost

      return {
        ...candidate,
        subtitle: shouldPreserveExperienceSubtitle(candidate)
          ? candidate.subtitle
          : softenFriendsSubtitle(candidate.subtitle),
        finalScore,
        shapingDebug: {
          persona,
          personaBoost: toFixed(personaBoost),
          finalScore: toFixed(finalScore),
        },
      }
    }

    if (persona !== 'romantic') {
      return {
        ...candidate,
        finalScore: candidate.confidence,
      }
    }

    const mix = candidate.derivedFrom.hospitalityMix
    const ambiance = candidate.derivedFrom.ambianceProfile
    const tags = new Set(candidate.derivedFrom.experientialTags.map((tag) => tag.toLowerCase()))
    const environmentQuality = computeEnvironmentQuality(candidate)
    const sequenceQuality = computeSequenceQuality(candidate)
    const activityDominancePenalty = mix.activity > 0.5 ? 0.09 : mix.activity > 0.38 ? 0.06 : 0
    const activityLedPenalty = tags.has('activity-led') ? 0.04 : 0
    const chaoticMixedProgram =
      tags.has('mixed-program') &&
      (mix.activity > 0.38 || ambiance.energy === 'high' || ambiance.noise === 'high')
    const mixedProgramPenalty = chaoticMixedProgram ? 0.1 : tags.has('mixed-program') ? 0.09 : 0
    const noisePenalty =
      ambiance.noise === 'high'
        ? 0.08
        : ambiance.noise === 'medium'
          ? 0.02 + (mix.activity >= 0.38 ? 0.02 : 0)
          : 0
    const personaBoostRaw =
      (ambiance.intimacy === 'high' ? 0.06 : ambiance.intimacy === 'medium' ? 0.03 : 0) +
      candidate.derivedFrom.momentPotential * 0.02 +
      environmentQuality * 0.15 +
      sequenceQuality * 0.16 +
      mix.culture * 0.03 +
      mix.dining * 0.03 -
      activityDominancePenalty -
      activityLedPenalty -
      mixedProgramPenalty -
      noisePenalty
    const personaBoost = clamp(personaBoostRaw, -0.12, 0.12)
    const finalScore = candidate.confidence + personaBoost

    return {
      ...candidate,
      subtitle: shouldPreserveExperienceSubtitle(candidate)
        ? candidate.subtitle
        : softenRomanticSubtitle(candidate.subtitle),
      finalScore,
      shapingDebug: {
        persona,
        personaBoost: toFixed(personaBoost),
        finalScore: toFixed(finalScore),
      },
    }
  })

  if (persona !== 'romantic' && persona !== 'friends' && persona !== 'family') {
    return shaped
  }

  return shaped.slice().sort((left, right) => {
    if (right.finalScore !== left.finalScore) {
      return right.finalScore - left.finalScore
    }
    if (right.confidence !== left.confidence) {
      return right.confidence - left.confidence
    }
    return left.pocketId.localeCompare(right.pocketId)
  })
}

