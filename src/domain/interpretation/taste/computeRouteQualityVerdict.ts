import type { ArcStop } from '../../types/arc'

export interface TasteRouteQualityVerdict {
  vibeCoherenceScore: number
  highlightVibeScore: number
  arcContrastScore: number
  highlightCenteringScore: number
  roleEnergyScore: number
  roleEnergyPenalty: number
  roleEnergyNote: string
  lensCoherenceScore: number
  contextSpecificityLift: number
  dominancePenalty: number
  fakeCompletenessPenalty: number
  fakeCompletenessApplied: boolean
}

const FAKE_COMPLETENESS_PENALTY = 0.08

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function getPrimaryExperienceArchetype(stop: ArcStop) {
  return stop.scoredVenue.taste.signals.primaryExperienceArchetype
}

function getMomentIdentity(stop: ArcStop) {
  return stop.scoredVenue.momentIdentity
}

function computeVibeCoherence(stops: readonly ArcStop[]): number {
  const values = stops.map((stop) => {
    if (stop.role === 'warmup') {
      return stop.scoredVenue.vibeAuthority.byRole.start
    }
    if (stop.role === 'peak') {
      return stop.scoredVenue.vibeAuthority.byRole.highlight
    }
    if (stop.role === 'wildcard') {
      return stop.scoredVenue.vibeAuthority.byRole.surprise
    }
    return stop.scoredVenue.vibeAuthority.byRole.windDown
  })
  return clamp01(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function computeHighlightVibeScore(stops: readonly ArcStop[]): number {
  const highlight = stops.find((stop) => stop.role === 'peak')
  if (!highlight) {
    return 0
  }
  return clamp01(highlight.scoredVenue.vibeAuthority.byRole.highlight)
}

function computeArcContrastScore(stops: readonly ArcStop[]): number {
  const warmup = stops.find((stop) => stop.role === 'warmup')
  const highlight = stops.find((stop) => stop.role === 'peak')
  const cooldown = stops.find((stop) => stop.role === 'cooldown')
  if (!warmup || !highlight || !cooldown) {
    return 0
  }

  const startPeakCategoryContrast =
    warmup.scoredVenue.venue.category === highlight.scoredVenue.venue.category ? 0.34 : 1
  const peakCooldownCategoryContrast =
    highlight.scoredVenue.venue.category === cooldown.scoredVenue.venue.category ? 0.3 : 1
  const startPeakArchetypeContrast =
    getPrimaryExperienceArchetype(warmup) === getPrimaryExperienceArchetype(highlight)
      ? 0.28
      : 1
  const peakCooldownArchetypeContrast =
    getPrimaryExperienceArchetype(highlight) === getPrimaryExperienceArchetype(cooldown)
      ? 0.26
      : 1
  const startPeakEnergyContrast = clamp01(
    (highlight.scoredVenue.venue.energyLevel - warmup.scoredVenue.venue.energyLevel + 1) / 4,
  )
  const peakCooldownEnergyContrast = clamp01(
    (highlight.scoredVenue.venue.energyLevel - cooldown.scoredVenue.venue.energyLevel + 1) / 4,
  )
  const startPeakAnchorSeparation = clamp01(
    0.5 +
      (highlight.scoredVenue.taste.signals.anchorStrength -
        warmup.scoredVenue.taste.signals.anchorStrength) *
        1.2,
  )
  const peakCooldownAnchorSeparation = clamp01(
    0.5 +
      (highlight.scoredVenue.taste.signals.anchorStrength -
        cooldown.scoredVenue.taste.signals.anchorStrength) *
        1.1,
  )
  const flattenedStartPenalty =
    warmup.scoredVenue.venue.category === highlight.scoredVenue.venue.category &&
    getPrimaryExperienceArchetype(warmup) === getPrimaryExperienceArchetype(highlight) &&
    Math.abs(
      warmup.scoredVenue.venue.energyLevel - highlight.scoredVenue.venue.energyLevel,
    ) <= 1
      ? 0.14
      : 0
  const flattenedEndPenalty =
    highlight.scoredVenue.venue.category === cooldown.scoredVenue.venue.category &&
    getPrimaryExperienceArchetype(highlight) === getPrimaryExperienceArchetype(cooldown) &&
    Math.abs(
      highlight.scoredVenue.venue.energyLevel - cooldown.scoredVenue.venue.energyLevel,
    ) <= 1
      ? 0.16
      : 0

  return clamp01(
    startPeakCategoryContrast * 0.12 +
      peakCooldownCategoryContrast * 0.12 +
      startPeakArchetypeContrast * 0.12 +
      peakCooldownArchetypeContrast * 0.12 +
      startPeakEnergyContrast * 0.16 +
      peakCooldownEnergyContrast * 0.18 +
      startPeakAnchorSeparation * 0.09 +
      peakCooldownAnchorSeparation * 0.09 +
      0.08 -
      flattenedStartPenalty -
      flattenedEndPenalty,
  )
}

function computeHighlightCenteringScore(stops: readonly ArcStop[]): number {
  const warmup = stops.find((stop) => stop.role === 'warmup')
  const highlight = stops.find((stop) => stop.role === 'peak')
  const cooldown = stops.find((stop) => stop.role === 'cooldown')
  if (!warmup || !highlight || !cooldown) {
    return 0
  }

  const supportAnchorAverage =
    (warmup.scoredVenue.taste.signals.anchorStrength +
      cooldown.scoredVenue.taste.signals.anchorStrength) /
    2
  const supportRoleAverage =
    (warmup.scoredVenue.roleScores.warmup + cooldown.scoredVenue.roleScores.cooldown) / 2
  const offPeakStrongMoment = stops.some(
    (stop) => stop.role !== 'peak' && getMomentIdentity(stop).strength === 'strong',
  )
  const highlightMomentPenalty =
    highlight.scoredVenue.momentIdentity.strength !== 'strong' && offPeakStrongMoment
      ? 0.22
      : highlight.scoredVenue.momentIdentity.type !== 'anchor' &&
          highlight.scoredVenue.momentIdentity.type !== 'explore'
        ? 0.1
        : 0

  return clamp01(
    0.5 +
      (highlight.scoredVenue.taste.signals.anchorStrength - supportAnchorAverage) * 0.7 +
      (highlight.scoredVenue.roleScores.peak - supportRoleAverage) * 0.22 +
      highlight.scoredVenue.taste.signals.momentPotential.score * 0.12 +
      highlight.scoredVenue.taste.signals.categorySpecificity * 0.1 +
      highlight.scoredVenue.taste.signals.personalityStrength * 0.1 -
      highlightMomentPenalty,
  )
}

function computeRoleEnergyBalance(stops: readonly ArcStop[]): {
  score: number
  penalty: number
  note: string
} {
  const warmup = stops.find((stop) => stop.role === 'warmup')
  const highlight = stops.find((stop) => stop.role === 'peak')
  const cooldown = stops.find((stop) => stop.role === 'cooldown')
  if (!warmup || !highlight || !cooldown) {
    return { score: 0, penalty: 0, note: 'flat arc detected' }
  }

  const startMoment = getMomentIdentity(warmup)
  const highlightMoment = getMomentIdentity(highlight)
  const windDownMoment = getMomentIdentity(cooldown)
  const distinctEnds =
    getPrimaryExperienceArchetype(warmup) !== getPrimaryExperienceArchetype(cooldown)
  const startEntry =
    (startMoment.type === 'arrival' || startMoment.type === 'explore') &&
    startMoment.strength !== 'strong'
  const highlightPeak =
    highlightMoment.strength === 'strong' &&
    (highlightMoment.type === 'anchor' || highlightMoment.type === 'explore')
  const windDownResolution =
    windDownMoment.type === 'close' ||
    (windDownMoment.type === 'linger' && windDownMoment.strength !== 'strong')
  const energyRampPreserved =
    highlightPeak &&
    startMoment.strength !== 'strong' &&
    windDownMoment.strength !== 'strong'
  const softStartFallback =
    (startMoment.type === 'close' || startMoment.type === 'linger') &&
    startMoment.strength !== 'strong'
  const flatLightArc =
    startMoment.strength !== 'strong' &&
    highlightMoment.strength !== 'strong' &&
    windDownMoment.strength !== 'strong'
  const invertedStrongArc =
    startMoment.strength === 'strong' &&
    highlightMoment.strength === 'strong' &&
    windDownMoment.strength === 'strong'

  return {
    score: clamp01(
      (distinctEnds ? 0.08 : 0) +
        (energyRampPreserved ? 0.12 : 0) +
        (startEntry ? 0.05 : 0) +
        (windDownResolution ? 0.05 : 0),
    ),
    penalty: clamp01(
      (flatLightArc ? 0.05 : 0) +
        (invertedStrongArc ? 0.07 : 0) +
        (softStartFallback ? 0.035 : 0) +
        (!windDownResolution ? 0.025 : 0) +
        (!windDownResolution && windDownMoment.strength === 'strong' ? 0.03 : 0),
    ),
    note: energyRampPreserved
      ? 'ramp-up preserved'
      : softStartFallback
        ? 'soft start fallback'
        : 'flat arc detected',
  }
}

function computeLensCoherence(stops: readonly ArcStop[]): number {
  const values = stops.map((stop) => {
    if (stop.role === 'warmup') {
      return stop.scoredVenue.stopShapeFit.start
    }
    if (stop.role === 'peak') {
      return stop.scoredVenue.stopShapeFit.highlight
    }
    if (stop.role === 'wildcard') {
      return stop.scoredVenue.stopShapeFit.surprise
    }
    return stop.scoredVenue.stopShapeFit.windDown
  })
  return clamp01(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function computeContextSpecificityLift(stops: readonly ArcStop[]): number {
  const values = stops.map((stop) => stop.scoredVenue.contextSpecificity.byRole[stop.role])
  return clamp01(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function computeDominancePenalty(stops: readonly ArcStop[]): number {
  const values = stops.map((stop) => {
    const base = stop.scoredVenue.dominanceControl.byRole[stop.role]
    return stop.role === 'peak' ? base * 1.35 : stop.role === 'wildcard' ? base * 1.15 : base
  })
  return clamp01(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function computeFakeCompletenessPenalty(stops: readonly ArcStop[]): {
  penalty: number
  applied: boolean
} {
  const warmup = stops.find((stop) => stop.role === 'warmup')
  const highlight = stops.find((stop) => stop.role === 'peak')
  const cooldown = stops.find((stop) => stop.role === 'cooldown')
  if (!warmup || !highlight || !cooldown) {
    return {
      penalty: 0,
      applied: false,
    }
  }

  const highlightIntensity = highlight.scoredVenue.taste.signals.momentIntensity.score
  const warmupIntensity = warmup.scoredVenue.taste.signals.momentIntensity.score
  const cooldownIntensity = cooldown.scoredVenue.taste.signals.momentIntensity.score
  const warmupWeakDuplicate =
    warmup.scoredVenue.venue.category === highlight.scoredVenue.venue.category &&
    warmup.scoredVenue.taste.signals.primaryExperienceArchetype ===
      highlight.scoredVenue.taste.signals.primaryExperienceArchetype &&
    Math.abs(warmupIntensity - highlightIntensity) <= 0.1 &&
    warmupIntensity <= 0.58
  const cooldownWeakDuplicate =
    cooldown.scoredVenue.venue.category === highlight.scoredVenue.venue.category &&
    cooldown.scoredVenue.taste.signals.primaryExperienceArchetype ===
      highlight.scoredVenue.taste.signals.primaryExperienceArchetype &&
    Math.abs(cooldownIntensity - highlightIntensity) <= 0.1 &&
    cooldownIntensity <= 0.58
  const weakEscalation = highlightIntensity - warmupIntensity < 0.06
  const weakTaper = highlightIntensity - cooldownIntensity < 0.05

  const applied =
    (warmupWeakDuplicate && weakEscalation) ||
    (cooldownWeakDuplicate && weakTaper) ||
    cooldownIntensity > highlightIntensity
  return {
    penalty: applied ? FAKE_COMPLETENESS_PENALTY : 0,
    applied,
  }
}

export function computeRouteQualityVerdict(stops: readonly ArcStop[]): TasteRouteQualityVerdict {
  const roleEnergyBalance = computeRoleEnergyBalance(stops)
  const fakeCompleteness = computeFakeCompletenessPenalty(stops)

  return {
    vibeCoherenceScore: computeVibeCoherence(stops),
    highlightVibeScore: computeHighlightVibeScore(stops),
    arcContrastScore: computeArcContrastScore(stops),
    highlightCenteringScore: computeHighlightCenteringScore(stops),
    roleEnergyScore: roleEnergyBalance.score,
    roleEnergyPenalty: roleEnergyBalance.penalty,
    roleEnergyNote: roleEnergyBalance.note,
    lensCoherenceScore: computeLensCoherence(stops),
    contextSpecificityLift: computeContextSpecificityLift(stops),
    dominancePenalty: computeDominancePenalty(stops),
    fakeCompletenessPenalty: fakeCompleteness.penalty,
    fakeCompletenessApplied: fakeCompleteness.applied,
  }
}
