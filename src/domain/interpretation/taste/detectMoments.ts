import type {
  DetectedMoment,
  DetectedMomentType,
  TasteHappeningsSignals,
  TasteHoursStatus,
  TasteSignals,
} from './types'

export type DetectMomentInput = {
  venueId: string
  venueName: string
  districtId?: string
  districtLabel?: string
  tasteSignals: TasteSignals
  context?: {
    persona?: string
    vibe?: string
    timeWindow?: string
  }
  sourceFlags?: {
    eventCapable?: boolean
    musicCapable?: boolean
    performanceCapable?: boolean
    highlightCapable?: boolean
    hasHappyHour?: boolean
  }
  hoursStatus?: TasteHoursStatus | string
  hoursConfidence?: number
  happenings?: TasteHappeningsSignals
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function toFixed(value: number): number {
  return Number(clamp(value, 0, 1).toFixed(3))
}

function getHappeningsSignal(
  happenings: TasteHappeningsSignals | undefined,
  key: keyof TasteHappeningsSignals,
): number {
  return clamp(happenings?.[key] ?? 0, 0, 1)
}

function parseWindowLabel(timeWindow: string | undefined): string {
  const token = (timeWindow ?? '').trim().toLowerCase()
  if (!token) {
    return 'flexible'
  }
  if (
    token.includes('late') ||
    token.includes('night') ||
    token.includes('after')
  ) {
    return 'late'
  }
  if (
    token.includes('morning') ||
    token.includes('brunch') ||
    token.includes('lunch')
  ) {
    return 'day'
  }
  if (token.includes('even')) {
    return 'evening'
  }
  return 'flexible'
}

function getHoursAvailabilityScore(
  hoursStatus: DetectMomentInput['hoursStatus'],
  hoursConfidence: number | undefined,
): number {
  const status = (hoursStatus ?? 'unknown').toString().toLowerCase()
  const confidence = clamp(hoursConfidence ?? 0.5, 0, 1)
  if (status === 'open') {
    return toFixed(0.85 * confidence + 0.15)
  }
  if (status === 'likely_open') {
    return toFixed(0.72 * confidence + 0.1)
  }
  if (status === 'uncertain' || status === 'unknown') {
    return toFixed(0.42 * confidence + 0.1)
  }
  if (status === 'likely_closed') {
    return toFixed(0.2 * confidence)
  }
  return 0
}

function getIntentFit(input: DetectMomentInput): number {
  const { tasteSignals, context } = input
  const happenings = input.happenings
  const vibe = (context?.vibe ?? '').toLowerCase()
  const persona = (context?.persona ?? '').toLowerCase()
  const base = clamp(
    tasteSignals.experientialFactor * 0.22 +
      tasteSignals.momentPotential.score * 0.2 +
      tasteSignals.momentIntensity.score * 0.16 +
      tasteSignals.roleSuitability.highlight * 0.18 +
      tasteSignals.roleSuitability.start * 0.12 +
      tasteSignals.roleSuitability.windDown * 0.12,
    0,
    1,
  )

  let vibeFit = base
  if (vibe.includes('lively')) {
    vibeFit = clamp(
      tasteSignals.energy * 0.34 +
        tasteSignals.socialDensity * 0.22 +
        tasteSignals.momentIntensity.score * 0.22 +
        tasteSignals.roleSuitability.highlight * 0.22,
      0,
      1,
    )
  } else if (
    vibe.includes('cozy') ||
    vibe.includes('chill') ||
    vibe.includes('calm')
  ) {
    vibeFit = clamp(
      tasteSignals.intimacy * 0.3 +
        tasteSignals.conversationFriendliness * 0.24 +
        (1 - tasteSignals.energy) * 0.22 +
        tasteSignals.roleSuitability.windDown * 0.14 +
        tasteSignals.lingerFactor * 0.1,
      0,
      1,
    )
  } else if (vibe.includes('cultured')) {
    vibeFit = clamp(
      tasteSignals.momentEnrichment.culturalDepth * 0.34 +
        tasteSignals.experientialFactor * 0.24 +
        tasteSignals.destinationFactor * 0.18 +
        tasteSignals.momentPotential.score * 0.14 +
        tasteSignals.roleSuitability.highlight * 0.1,
      0,
      1,
    )
  } else if (vibe.includes('playful')) {
    vibeFit = clamp(
      tasteSignals.interactiveStrength * 0.34 +
        tasteSignals.socialDensity * 0.22 +
        tasteSignals.momentPotential.score * 0.2 +
        tasteSignals.energy * 0.14 +
        tasteSignals.noveltyWeight * 0.1,
      0,
      1,
    )
  } else if (vibe.includes('adventurous')) {
    vibeFit = clamp(
      tasteSignals.noveltyWeight * 0.34 +
        tasteSignals.experientialFactor * 0.24 +
        tasteSignals.outdoorStrength * 0.16 +
        tasteSignals.momentPotential.score * 0.14 +
        tasteSignals.interactiveStrength * 0.12,
      0,
      1,
    )
  }

  let personaFit = base
  if (persona.includes('romantic')) {
    personaFit = clamp(
      tasteSignals.romanticScore * 0.46 +
        tasteSignals.intimacy * 0.22 +
        tasteSignals.conversationFriendliness * 0.16 +
        tasteSignals.lingerFactor * 0.12 +
        getHappeningsSignal(happenings, 'culturalAnchorPotential') * 0.04,
      0,
      1,
    )
  } else if (persona.includes('friends') || persona.includes('social')) {
    personaFit = clamp(
      tasteSignals.socialDensity * 0.34 +
        tasteSignals.energy * 0.28 +
        tasteSignals.interactiveStrength * 0.2 +
        tasteSignals.roleSuitability.highlight * 0.18,
      0,
      1,
    )
  } else if (persona.includes('family')) {
    personaFit = clamp(
      tasteSignals.conversationFriendliness * 0.28 +
        tasteSignals.lingerFactor * 0.22 +
        (1 - tasteSignals.energy) * 0.2 +
        tasteSignals.interactiveStrength * 0.16 +
        tasteSignals.roleSuitability.start * 0.14,
      0,
      1,
    )
  }

  return toFixed(
    clamp(
      base * 0.2 +
        vibeFit * 0.43 +
        personaFit * 0.33 +
        getHappeningsSignal(happenings, 'currentRelevance') * 0.02 +
        getHappeningsSignal(happenings, 'hotspotStrength') * 0.02,
      0,
      1,
    ),
  )
}

function getTimingRelevance(input: DetectMomentInput): number {
  const signals = input.tasteSignals
  const sourceFlags = input.sourceFlags
  const happenings = input.happenings
  const windowLabel = parseWindowLabel(input.context?.timeWindow)
  const hoursAvailability = getHoursAvailabilityScore(
    input.hoursStatus,
    input.hoursConfidence,
  )
  const hasEvent = Boolean(
    sourceFlags?.eventCapable ||
      signals.hyperlocalActivation.activationTypes.includes('live_performance') ||
      signals.hyperlocalActivation.activationTypes.includes('seasonal_market'),
  )
  const hasPerformance = Boolean(
    sourceFlags?.performanceCapable ||
      sourceFlags?.musicCapable ||
      signals.hyperlocalActivation.activationTypes.includes('cultural_activation'),
  )
  const happyHourBonus =
    sourceFlags?.hasHappyHour && (windowLabel === 'evening' || windowLabel === 'late')
      ? 0.08
      : 0
  const temporalWindowBonus =
    windowLabel === 'late'
      ? sourceFlags?.musicCapable || sourceFlags?.performanceCapable
        ? 0.1
        : 0.03
      : windowLabel === 'day'
        ? signals.roleSuitability.start * 0.06
        : 0.04

  return toFixed(
    clamp(
      signals.hyperlocalActivation.temporalRelevance * 0.42 +
        hoursAvailability * 0.26 +
        (hasEvent ? 0.14 : 0) +
        (hasPerformance ? 0.1 : 0) +
        getHappeningsSignal(happenings, 'lateNightPotential') * 0.06 +
        getHappeningsSignal(happenings, 'currentRelevance') * 0.06 +
        happyHourBonus +
        temporalWindowBonus,
      0,
      1,
    ),
  )
}

function getSourceType(
  momentType: DetectedMomentType,
  input: DetectMomentInput,
): 'venue' | 'event' | 'hybrid' {
  const eventLike = Boolean(
    input.sourceFlags?.eventCapable ||
      input.sourceFlags?.musicCapable ||
      input.sourceFlags?.performanceCapable ||
      input.sourceFlags?.hasHappyHour,
  )
  if (momentType === 'temporal' && eventLike) {
    return 'event'
  }
  if (eventLike) {
    return 'hybrid'
  }
  return 'venue'
}

function getDescriptors(tasteSignals: TasteSignals): NonNullable<DetectedMoment['descriptors']> {
  const energy =
    tasteSignals.energy >= 0.68
      ? 'lively'
      : tasteSignals.energy <= 0.42
        ? 'calm'
        : 'balanced'
  const tone =
    tasteSignals.intimacy >= 0.62
      ? 'intimate'
      : tasteSignals.socialDensity >= 0.64
        ? 'social'
        : 'mixed'
  const pacing =
    tasteSignals.lingerFactor >= 0.62
      ? 'linger'
      : tasteSignals.momentIntensity.score >= 0.68
        ? 'build'
        : 'steady'
  return { energy, tone, pacing }
}

function buildDetectedMoment(
  input: DetectMomentInput,
  momentType: DetectedMomentType,
  strength: number,
  timingRelevance: number,
  intentFit: number,
  reason: string,
): DetectedMoment {
  const windowLabel = parseWindowLabel(input.context?.timeWindow)
  const hasEvent = Boolean(
    input.sourceFlags?.eventCapable ||
      input.tasteSignals.hyperlocalActivation.activationTypes.includes('live_performance'),
  )
  const hasPerformance = Boolean(
    input.sourceFlags?.performanceCapable || input.sourceFlags?.musicCapable,
  )

  return {
    id: `moment:${input.venueId}:${momentType}`,
    title: input.venueName,
    venueId: input.venueId,
    districtId: input.districtId,
    sourceType: getSourceType(momentType, input),
    momentType,
    strength: toFixed(strength),
    timingRelevance: toFixed(timingRelevance),
    intentFit: toFixed(intentFit),
    roleFit: {
      start: toFixed(input.tasteSignals.roleSuitability.start),
      highlight: toFixed(input.tasteSignals.roleSuitability.highlight),
      windDown: toFixed(input.tasteSignals.roleSuitability.windDown),
    },
    reason,
    descriptors: getDescriptors(input.tasteSignals),
    liveContext: {
      hasEvent,
      hasHappyHour: Boolean(input.sourceFlags?.hasHappyHour),
      hasPerformance,
      timeWindowLabel: windowLabel,
    },
  }
}

function detectAnchorMoment(
  input: DetectMomentInput,
  timingRelevance: number,
  intentFit: number,
): DetectedMoment | null {
  const signals = input.tasteSignals
  const happenings = input.happenings
  const tierScore = signals.highlightTier === 1 ? 1 : signals.highlightTier === 2 ? 0.72 : 0.44
  const anchorStrength = clamp(
    signals.roleSuitability.highlight * 0.34 +
      tierScore * 0.2 +
      signals.anchorStrength * 0.18 +
      signals.momentIntensity.score * 0.16 +
      signals.momentPotential.score * 0.08 +
      getHappeningsSignal(happenings, 'majorVenueStrength') * 0.03 +
      getHappeningsSignal(happenings, 'culturalAnchorPotential') * 0.03 +
      getHappeningsSignal(happenings, 'hotspotStrength') * 0.02 +
      intentFit * 0.04,
    0,
    1,
  )
  if (anchorStrength < 0.62) {
    return null
  }
  return buildDetectedMoment(
    input,
    'anchor',
    anchorStrength,
    timingRelevance,
    intentFit,
    'Strong central fit for tonight\'s route shape',
  )
}

function detectSupportingMoment(
  input: DetectMomentInput,
  timingRelevance: number,
  intentFit: number,
): DetectedMoment | null {
  const signals = input.tasteSignals
  const supportStrength = clamp(
    Math.max(signals.roleSuitability.start, signals.roleSuitability.windDown) * 0.44 +
      signals.conversationFriendliness * 0.14 +
      signals.lingerFactor * 0.14 +
      signals.intimacy * 0.1 +
      (1 - signals.energy) * 0.08 +
      intentFit * 0.1,
    0,
    1,
  )
  if (supportStrength < 0.54) {
    return null
  }
  const reason =
    signals.roleSuitability.start >= signals.roleSuitability.windDown
      ? 'Good early stop with a softer pace'
      : 'Strong closer fit that supports a calm landing'
  return buildDetectedMoment(
    input,
    'supporting',
    supportStrength,
    timingRelevance,
    intentFit,
    reason,
  )
}

function detectTemporalMoment(
  input: DetectMomentInput,
  timingRelevance: number,
  intentFit: number,
): DetectedMoment | null {
  const signals = input.tasteSignals
  const happenings = input.happenings
  const temporalSignalsPresent = Boolean(
    input.sourceFlags?.eventCapable ||
      input.sourceFlags?.musicCapable ||
      input.sourceFlags?.performanceCapable ||
      input.sourceFlags?.hasHappyHour ||
      getHappeningsSignal(happenings, 'eventPotential') >= 0.48 ||
      getHappeningsSignal(happenings, 'lateNightPotential') >= 0.48 ||
      signals.hyperlocalActivation.temporalLabel !== 'background',
  )
  if (!temporalSignalsPresent) {
    return null
  }
  const strength = clamp(
    timingRelevance * 0.56 +
      Math.max(signals.momentPotential.score, signals.momentIntensity.score) * 0.2 +
      signals.roleSuitability.highlight * 0.12 +
      getHappeningsSignal(happenings, 'currentRelevance') * 0.08 +
      getHappeningsSignal(happenings, 'lateNightPotential') * 0.06 +
      intentFit * 0.12,
    0,
    1,
  )
  if (strength < 0.58) {
    return null
  }
  return buildDetectedMoment(
    input,
    'temporal',
    strength,
    timingRelevance,
    intentFit,
    'More relevant in the current time window',
  )
}

function detectDiscoveryMoment(
  input: DetectMomentInput,
  timingRelevance: number,
  intentFit: number,
): DetectedMoment | null {
  const signals = input.tasteSignals
  const happenings = input.happenings
  const discoveryStrength = clamp(
    signals.noveltyWeight * 0.34 +
      signals.categorySpecificity * 0.24 +
      signals.personalityStrength * 0.18 +
      signals.momentPotential.score * 0.14 +
      signals.experientialFactor * 0.06 +
      getHappeningsSignal(happenings, 'hiddenGemStrength') * 0.04,
    0,
    1,
  )
  const roleUsable =
    Math.max(
      signals.roleSuitability.start,
      signals.roleSuitability.highlight,
      signals.roleSuitability.windDown,
    ) >= 0.45
  if (discoveryStrength < 0.6 || !roleUsable) {
    return null
  }
  return buildDetectedMoment(
    input,
    'discovery',
    discoveryStrength,
    timingRelevance,
    intentFit,
    'High-discovery option with usable role fit',
  )
}

function detectCommunityMoment(
  input: DetectMomentInput,
  timingRelevance: number,
  intentFit: number,
): DetectedMoment | null {
  const signals = input.tasteSignals
  const happenings = input.happenings
  const hintScore = signals.hyperlocalActivation.contractCompatibilityHints.length >= 2 ? 0.1 : 0
  const activationScore =
    signals.hyperlocalActivation.activationTypes.includes('social_ritual') ||
    signals.hyperlocalActivation.activationTypes.includes('cultural_activation')
      ? 0.12
      : 0
  const communityStrength = clamp(
    signals.momentEnrichment.culturalDepth * 0.33 +
      signals.conversationFriendliness * 0.2 +
      signals.lingerFactor * 0.16 +
      signals.experientialFactor * 0.11 +
      getHappeningsSignal(happenings, 'culturalAnchorPotential') * 0.08 +
      getHappeningsSignal(happenings, 'eventPotential') * 0.04 +
      hintScore +
      activationScore +
      intentFit * 0.1,
    0,
    1,
  )
  if (communityStrength < 0.57) {
    return null
  }
  return buildDetectedMoment(
    input,
    'community',
    communityStrength,
    timingRelevance,
    intentFit,
    'Community-forward signal with strong local context',
  )
}

function getMomentPriority(moment: DetectedMoment): number {
  if (moment.momentType === 'anchor') {
    return 5
  }
  if (moment.momentType === 'temporal') {
    return 4
  }
  if (moment.momentType === 'discovery') {
    return 3
  }
  if (moment.momentType === 'community') {
    return 2
  }
  return 1
}

export function detectMomentsFromTaste(input: DetectMomentInput): DetectedMoment[] {
  const intentFit = getIntentFit(input)
  const timingRelevance = getTimingRelevance(input)
  const candidates = [
    detectAnchorMoment(input, timingRelevance, intentFit),
    detectSupportingMoment(input, timingRelevance, intentFit),
    detectTemporalMoment(input, timingRelevance, intentFit),
    detectDiscoveryMoment(input, timingRelevance, intentFit),
    detectCommunityMoment(input, timingRelevance, intentFit),
  ].filter((candidate): candidate is DetectedMoment => Boolean(candidate))

  if (candidates.length === 0) {
    return []
  }

  return candidates
    .sort((left, right) => {
      if (right.strength !== left.strength) {
        return right.strength - left.strength
      }
      return getMomentPriority(right) - getMomentPriority(left)
    })
    .slice(0, 2)
}
