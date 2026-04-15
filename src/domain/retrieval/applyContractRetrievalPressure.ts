import type { ScoredVenue } from '../types/arc'
import type { ContractConstraints, ExperienceContract } from '../types/intent'

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function clampRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function dedupeIds(ids: string[]): string[] {
  return [...new Set(ids)]
}

function getTagSet(candidate: ScoredVenue): Set<string> {
  return new Set(candidate.venue.tags.map((tag) => tag.toLowerCase()))
}

function hasAnyTag(tags: Set<string>, checks: string[]): boolean {
  return checks.some((check) => tags.has(check))
}

function getNightlifePressure(candidate: ScoredVenue): number {
  const tags = getTagSet(candidate)
  const signals = candidate.taste.signals
  const lateSignal =
    hasAnyTag(tags, [
      'late-night',
      'nightlife',
      'night-owl',
      'dance',
      'dj',
      'club',
      'live-music',
      'concert',
      'cocktails',
    ]) || candidate.venue.category === 'bar' || candidate.venue.category === 'live_music'
  return clamp01(
    signals.energy * 0.45 +
      signals.socialDensity * 0.4 +
      signals.interactiveStrength * 0.15 +
      (lateSignal ? 0.14 : 0),
  )
}

function getCalmnessPressure(candidate: ScoredVenue): number {
  const signals = candidate.taste.signals
  return clamp01(
    (1 - signals.energy) * 0.32 +
      (1 - signals.socialDensity) * 0.18 +
      signals.intimacy * 0.2 +
      signals.lingerFactor * 0.2 +
      signals.conversationFriendliness * 0.1,
  )
}

function getDestinationStrength(candidate: ScoredVenue): number {
  const signals = candidate.taste.signals
  return clamp01(
    signals.destinationFactor * 0.4 +
      signals.experientialFactor * 0.22 +
      signals.anchorStrength * 0.22 +
      signals.momentPotential.score * 0.16,
  )
}

function isQuickStopLeaning(candidate: ScoredVenue): boolean {
  const signals = candidate.taste.signals
  return (
    signals.durationEstimate === 'quick' ||
    (signals.lingerFactor < 0.34 &&
      signals.destinationFactor < 0.54 &&
      signals.experientialFactor < 0.56)
  )
}

function getSocialBandPenalty(
  socialDensity: number,
  band: ContractConstraints['socialDensityBand'],
): number {
  if (band === 'low') {
    return socialDensity > 0.82 ? 0.2 : socialDensity > 0.72 ? 0.1 : 0
  }
  if (band === 'medium') {
    return socialDensity < 0.26 || socialDensity > 0.86 ? 0.08 : 0
  }
  if (band === 'medium_high') {
    return socialDensity < 0.34 ? 0.1 : 0
  }
  return socialDensity < 0.4 ? 0.12 : 0
}

function getMovementPenalty(
  driveMinutes: number,
  movementTolerance: ContractConstraints['movementTolerance'],
): number {
  if (movementTolerance === 'contained') {
    return driveMinutes > 26 ? 0.16 : driveMinutes > 20 ? 0.08 : 0
  }
  if (movementTolerance === 'compressed') {
    return driveMinutes > 30 ? 0.14 : driveMinutes > 24 ? 0.07 : 0
  }
  if (movementTolerance === 'moderate') {
    return driveMinutes > 34 ? 0.08 : 0
  }
  return 0
}

function getContractInfluenceSummary(
  experienceContract: ExperienceContract,
  constraints: ContractConstraints,
): string {
  const retrievalMode =
    experienceContract.persona === 'romantic' &&
    (experienceContract.vibe === 'cozy' || experienceContract.vibe === 'chill')
      ? 'cozy_suppressed_noise'
      : experienceContract.persona === 'romantic' && experienceContract.vibe === 'lively'
        ? 'pulse_prefers_escalation'
        : experienceContract.persona === 'friends' && experienceContract.vibe === 'lively'
          ? 'group_momentum_expanded_social'
          : experienceContract.persona === 'family'
            ? 'family_recovery_low_friction'
            : 'balanced_contract_shaping'
  const highlightMode =
    constraints.highlightPressure === 'strong'
      ? 'destination_required'
      : constraints.highlightPressure === 'distributed'
        ? 'distributed_highlight'
        : 'moderate_anchor'
  return `retrieval:${retrievalMode}|highlight:${highlightMode}|windDown:${constraints.windDownStrictness}`
}

function evaluateContractGlobalPressure(
  candidate: ScoredVenue,
  experienceContract: ExperienceContract,
  constraints: ContractConstraints,
): { multiplier: number; hardReject: boolean } {
  const signals = candidate.taste.signals
  const nightlife = getNightlifePressure(candidate)
  const calmness = getCalmnessPressure(candidate)
  const destination = getDestinationStrength(candidate)
  const quickStop = isQuickStopLeaning(candidate)

  let multiplier = 1
  let hardReject = false

  if (
    experienceContract.persona === 'romantic' &&
    (experienceContract.vibe === 'cozy' || experienceContract.vibe === 'chill')
  ) {
    multiplier += (calmness - 0.5) * 0.24
    multiplier += (signals.intimacy - 0.5) * 0.2
    multiplier += (signals.lingerFactor - 0.5) * 0.16
    multiplier += (destination - 0.5) * 0.14
    multiplier -= nightlife * 0.24
    if (quickStop) {
      multiplier -= 0.12
    }
    if (nightlife > 0.9 && quickStop && destination < 0.5) {
      hardReject = true
    }
  } else if (experienceContract.persona === 'romantic' && experienceContract.vibe === 'lively') {
    multiplier += nightlife * 0.2
    multiplier += signals.momentIntensity.score * 0.16
    multiplier += signals.roleSuitability.highlight * 0.1
    multiplier -= calmness * 0.08
    if (signals.energy < 0.26 && signals.socialDensity < 0.34) {
      hardReject = true
    }
  } else if (experienceContract.persona === 'friends' && experienceContract.vibe === 'lively') {
    multiplier += signals.socialDensity * 0.18
    multiplier += signals.energy * 0.14
    multiplier += signals.conversationFriendliness * 0.08
    if (constraints.groupBasecampPreferred) {
      multiplier +=
        candidate.venue.category === 'restaurant' ||
        candidate.venue.category === 'bar' ||
        candidate.venue.category === 'cafe'
          ? 0.06
          : 0
    }
  } else if (experienceContract.persona === 'family') {
    multiplier += calmness * 0.18
    multiplier += signals.conversationFriendliness * 0.1
    multiplier += signals.roleSuitability.windDown * 0.08
    multiplier -= nightlife * 0.18
    multiplier -= getMovementPenalty(candidate.venue.driveMinutes, constraints.movementTolerance)
    if (
      constraints.kidEngagementRequired &&
      nightlife > 0.88 &&
      signals.energy > 0.82 &&
      signals.roleSuitability.start < 0.46
    ) {
      hardReject = true
    }
  }

  const socialPenalty = getSocialBandPenalty(signals.socialDensity, constraints.socialDensityBand)
  multiplier -= socialPenalty
  multiplier -= getMovementPenalty(candidate.venue.driveMinutes, constraints.movementTolerance)

  if (!constraints.allowLateHighEnergy && nightlife > 0.84) {
    multiplier -= 0.14
    if (nightlife > 0.92 && signals.roleSuitability.windDown < 0.44) {
      hardReject = true
    }
  }

  if (constraints.requireRecoveryWindows && calmness < 0.28) {
    multiplier -= 0.14
  }

  if (constraints.highlightPressure === 'strong' && destination < 0.32) {
    multiplier -= 0.06
  }

  if (constraints.windDownStrictness === 'soft_required') {
    multiplier += signals.roleSuitability.windDown >= 0.5 ? 0.05 : -0.06
  }

  return {
    multiplier: clampRange(multiplier, 0.62, 1.26),
    hardReject,
  }
}

export interface ContractRetrievalPressureResult {
  scoredVenues: ScoredVenue[]
  retrievalContractApplied: boolean
  retrievedVenueIds: string[]
  contractInfluenceSummary: string
}

export function applyContractRetrievalPressure(params: {
  scoredVenues: ScoredVenue[]
  experienceContract?: ExperienceContract
  contractConstraints?: ContractConstraints
}): ContractRetrievalPressureResult {
  const { scoredVenues, experienceContract, contractConstraints } = params
  if (!experienceContract || !contractConstraints || scoredVenues.length === 0) {
    return {
      scoredVenues,
      retrievalContractApplied: false,
      retrievedVenueIds: dedupeIds(scoredVenues.map((candidate) => candidate.venue.id)),
      contractInfluenceSummary: 'retrieval:none|highlight:none|windDown:none',
    }
  }

  const evaluated = scoredVenues.map((candidate) => {
    const pressure = evaluateContractGlobalPressure(
      candidate,
      experienceContract,
      contractConstraints,
    )
    const fitMultiplier = pressure.multiplier
    const roleMultiplierStart = clampRange(
      fitMultiplier + (pressure.multiplier >= 1 ? 0.04 : -0.02),
      0.66,
      1.3,
    )
    const roleMultiplierHighlight = clampRange(
      fitMultiplier +
        (contractConstraints.highlightPressure === 'strong' ? 0.08 : 0.04) -
        (contractConstraints.highlightPressure === 'distributed' ? 0.02 : 0),
      0.62,
      1.34,
    )
    const roleMultiplierWindDown = clampRange(
      fitMultiplier +
        (contractConstraints.windDownStrictness === 'soft_required' ? 0.07 : 0.03),
      0.66,
      1.3,
    )

    return {
      candidate: {
        ...candidate,
        fitScore: clamp01(candidate.fitScore * fitMultiplier),
        roleScores: {
          ...candidate.roleScores,
          warmup: clamp01(candidate.roleScores.warmup * roleMultiplierStart),
          peak: clamp01(candidate.roleScores.peak * roleMultiplierHighlight),
          cooldown: clamp01(candidate.roleScores.cooldown * roleMultiplierWindDown),
        },
        stopShapeFit: {
          ...candidate.stopShapeFit,
          start: clamp01(candidate.stopShapeFit.start * roleMultiplierStart),
          highlight: clamp01(candidate.stopShapeFit.highlight * roleMultiplierHighlight),
          windDown: clamp01(candidate.stopShapeFit.windDown * roleMultiplierWindDown),
        },
      } satisfies ScoredVenue,
      hardReject: pressure.hardReject && candidate.candidateIdentity.kind !== 'moment',
    }
  })

  const keptIfRejected = evaluated.filter((entry) => !entry.hardReject).map((entry) => entry.candidate)
  const minimumSafePool = Math.min(14, Math.max(8, Math.floor(scoredVenues.length * 0.45)))
  const useHardRejectFiltering = keptIfRejected.length >= minimumSafePool
  const shapedCandidates = (useHardRejectFiltering ? keptIfRejected : evaluated.map((entry) => entry.candidate))
    .sort((left, right) => right.fitScore - left.fitScore)

  return {
    scoredVenues: shapedCandidates,
    retrievalContractApplied: true,
    retrievedVenueIds: dedupeIds(
      shapedCandidates
        .filter((candidate) => candidate.candidateIdentity.kind !== 'moment')
        .map((candidate) => candidate.venue.id),
    ),
    contractInfluenceSummary: getContractInfluenceSummary(
      experienceContract,
      contractConstraints,
    ),
  }
}
