import type {
  ExperienceMode,
  PersonaMode,
  SelectedDirectionContext,
  VibeAnchor,
} from '../../types/intent'
import type {
  TasteExperienceArchetype,
  TasteRole,
  TasteVenueCategory,
} from './types'
import type {
  TasteRouteMeaningCompatibilityStatus,
  TasteRouteMeaningFitStrength,
  TasteRouteMeaningRolePoolEvidence,
  TasteRouteMeaningSignalComponent,
  TasteRouteMeaningVenueId,
} from './routeMeaningVerdict'

const easyHangCompatibleContextTokens = new Set([
  'easy_hang',
  'friends_cozy',
  'easy_hang_night',
])

const easyHangHardIncompatibleSignals = new Set([
  'activity',
  'centerpiece',
  'cocktails',
  'jazz',
  'late_night',
  'live',
  'live_music',
  'museum',
  'park',
])

export interface RolePoolMeaningContextInput {
  mode?: ExperienceMode
  persona?: PersonaMode | null
  contractPersona?: PersonaMode
  contractVibe?: VibeAnchor
  selectedDirectionContext?: SelectedDirectionContext
}

export type RolePoolPeakWorthinessStatus =
  | 'peak_worthy'
  | 'near_peak'
  | 'weak_peak'
  | 'passive_peak'
  | 'not_peak'

export type RolePoolCentralMomentQualityStatus =
  | 'central_moment'
  | 'possible_central_moment'
  | 'weak_central_moment'
  | 'not_central_moment'

export interface RolePoolMeaningCandidateInput {
  candidateVenueId?: TasteRouteMeaningVenueId
  category: TasteVenueCategory | string
  subcategory?: string
  tags: readonly string[]
  vibeTags: readonly string[]
  energy: number
  socialDensity: number
  intimacy: number
  lingerFactor: number
  destinationFactor: number
  experientialFactor: number
  conversationFriendliness: number
  interactiveStrength: number
  durationEstimate?: string
  roleSuitability: Partial<Record<TasteRole, number>>
  momentIntensityScore: number
  momentPotentialScore: number
  anchorStrength: number
  primaryExperienceArchetype?: TasteExperienceArchetype
}

export interface RolePoolMeaningContextEvidence {
  source: 'taste'
  persona?: PersonaMode
  vibe?: VibeAnchor
  easyHang: {
    active: boolean
    contextTokens: readonly string[]
    compatibility: TasteRouteMeaningCompatibilityStatus
  }
}

export interface RolePoolMeaningCandidateEvidence {
  source: 'taste'
  candidateVenueId?: TasteRouteMeaningVenueId
  hardIncompatibleSignals: readonly string[]
  hardIncompatible: boolean
  nightlifeLike: number
  calmness: number
  quickStopLeaning: boolean
  isPassiveHospitalityPeak: boolean
  isFriendsLivelyBasecamp: boolean
  isEasyHangBasecampCategory: boolean
  categoryArchetype: {
    category: TasteVenueCategory | string
    subcategory?: string
    tags: readonly string[]
    vibeTags: readonly string[]
    primaryExperienceArchetype?: TasteExperienceArchetype
    isPassiveHospitalityPeak: boolean
    isGenericHospitalityHighlight: boolean
    isSoftRomanticSupportArchetype: boolean
  }
  roleSuitability: Partial<Record<TasteRole, number>>
  social: {
    density: number
    conversationFriendliness: number
    energy: number
  }
  romantic: {
    cozyCompatible: boolean
    livelyCompatible: boolean
    intimacy: number
    linger: number
    destination: number
    experiential: number
    momentIntensity: number
  }
  family: {
    boundedEnergyCompatible: boolean
    nightlifeConflict: boolean
    calmness: number
    energy: number
    socialDensity: number
    interactiveStrength: number
  }
  expressionActivation: {
    energy: number
    socialDensity: number
    interactiveStrength: number
    momentIntensity: number
    momentPotential: number
    anchorStrength: number
    activationQuality: number
    expressionQuality: number
  }
  peakWorthiness: {
    source: 'taste'
    score: number
    status: RolePoolPeakWorthinessStatus
    candidatePeakSuitability: TasteRouteMeaningFitStrength
    weakPeak: boolean
    passivePeak: boolean
    reasons: readonly string[]
    components: readonly TasteRouteMeaningSignalComponent<number | string | boolean>[]
  }
  centralMomentQuality: {
    source: 'taste'
    score: number
    status: RolePoolCentralMomentQualityStatus
    weakPeak: boolean
    passivePeak: boolean
    reasons: readonly string[]
    components: readonly TasteRouteMeaningSignalComponent<number | string | boolean>[]
  }
}

export interface RolePoolMeaningEvidence {
  source: 'taste'
  role?: TasteRole
  context: RolePoolMeaningContextEvidence
  candidate: RolePoolMeaningCandidateEvidence
  rolePoolEvidence: TasteRouteMeaningRolePoolEvidence
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function normalizeSemanticToken(value: unknown): string {
  return typeof value === 'string'
    ? value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
    : ''
}

function buildSemanticTokenSet(values: readonly unknown[]): Set<string> {
  const tokens = new Set<string>()

  for (const value of values) {
    const normalized = normalizeSemanticToken(value)
    if (!normalized) {
      continue
    }
    tokens.add(normalized)
    for (const part of normalized.split('_')) {
      if (part) {
        tokens.add(part)
      }
    }
  }

  return tokens
}

function scoreToFitStrength(score: number): TasteRouteMeaningFitStrength {
  if (score >= 0.75) {
    return 'strong'
  }
  if (score >= 0.55) {
    return 'medium'
  }
  if (score >= 0.35) {
    return 'light'
  }
  if (score >= 0.15) {
    return 'weak'
  }
  return 'conflict'
}

function toComponent(
  key: string,
  value: number | string | boolean,
  label?: string,
): TasteRouteMeaningSignalComponent<number | string | boolean> {
  return {
    source: 'taste',
    key,
    label,
    value,
  }
}

function scoreToPeakWorthinessStatus(params: {
  score: number
  weakPeak: boolean
  passivePeak: boolean
}): RolePoolPeakWorthinessStatus {
  if (params.weakPeak) {
    return 'weak_peak'
  }
  if (params.passivePeak) {
    return 'passive_peak'
  }
  if (params.score >= 0.7) {
    return 'peak_worthy'
  }
  if (params.score >= 0.56) {
    return 'near_peak'
  }
  return 'not_peak'
}

function scoreToCentralMomentQualityStatus(params: {
  score: number
  weakPeak: boolean
  passivePeak: boolean
}): RolePoolCentralMomentQualityStatus {
  if (params.weakPeak || params.passivePeak) {
    return 'weak_central_moment'
  }
  if (params.score >= 0.64) {
    return 'central_moment'
  }
  if (params.score >= 0.52) {
    return 'possible_central_moment'
  }
  return 'not_central_moment'
}

export function computeRolePoolMeaningContextEvidence(
  input: RolePoolMeaningContextInput,
): RolePoolMeaningContextEvidence {
  const persona = input.persona ?? input.contractPersona
  const contextTokens = [
    ...buildSemanticTokenSet([
      input.selectedDirectionContext?.directionId,
      input.selectedDirectionContext?.label,
      input.selectedDirectionContext?.archetype,
      input.selectedDirectionContext?.identity,
      input.selectedDirectionContext?.cluster,
    ]),
  ]
  const active =
    input.mode === 'build' &&
    persona === 'friends' &&
    contextTokens.some((token) => easyHangCompatibleContextTokens.has(token))

  return {
    source: 'taste',
    persona: persona ?? undefined,
    vibe: input.contractVibe,
    easyHang: {
      active,
      contextTokens,
      compatibility: active ? 'compatible' : 'unknown',
    },
  }
}

export function computeRolePoolCandidateMeaningEvidence(
  input: RolePoolMeaningCandidateInput,
): RolePoolMeaningCandidateEvidence {
  const candidateSignals = buildSemanticTokenSet([
    input.category,
    input.subcategory,
    ...input.tags,
    ...input.vibeTags,
  ])
  const hardIncompatibleSignals = [...easyHangHardIncompatibleSignals].filter((signal) =>
    candidateSignals.has(signal),
  )
  const nightlifeLike = clamp01(
    input.energy * 0.45 +
      input.socialDensity * 0.4 +
      (input.category === 'bar' ||
      input.category === 'live_music' ||
      candidateSignals.has('late_night')
        ? 0.15
        : 0),
  )
  const calmness = clamp01(
    (1 - input.energy) * 0.35 +
      (1 - input.socialDensity) * 0.2 +
      input.intimacy * 0.2 +
      input.lingerFactor * 0.15 +
      input.conversationFriendliness * 0.1,
  )
  const quickStopLeaning =
    input.durationEstimate === 'quick' ||
    (input.lingerFactor < 0.34 &&
      input.destinationFactor < 0.52 &&
      input.experientialFactor < 0.56)
  const isEasyHangBasecampCategory =
    input.category === 'restaurant' ||
    input.category === 'bar' ||
    input.category === 'cafe' ||
    input.category === 'activity'
  const isPassiveHospitalityPeak =
    input.primaryExperienceArchetype === 'dining' ||
    input.primaryExperienceArchetype === 'drinks' ||
    input.primaryExperienceArchetype === 'sweet'
  const isGenericHospitalityHighlight =
    isPassiveHospitalityPeak ||
    input.category === 'restaurant' ||
    input.category === 'cafe' ||
    input.category === 'dessert' ||
    input.category === 'bar'
  const isSoftRomanticSupportArchetype =
    input.primaryExperienceArchetype === 'drinks' ||
    input.primaryExperienceArchetype === 'sweet' ||
    input.primaryExperienceArchetype === 'culture' ||
    input.primaryExperienceArchetype === 'social' ||
    input.category === 'cafe' ||
    input.category === 'dessert'
  const activationQuality = clamp01(
    input.momentPotentialScore * 0.32 +
      input.momentIntensityScore * 0.28 +
      input.interactiveStrength * 0.16 +
      input.experientialFactor * 0.14 +
      input.socialDensity * 0.1,
  )
  const expressionQuality = clamp01(
    input.interactiveStrength * 0.28 +
      input.socialDensity * 0.2 +
      input.energy * 0.16 +
      input.momentIntensityScore * 0.16 +
      input.momentPotentialScore * 0.12 +
      input.anchorStrength * 0.08,
  )
  const highlightRoleSuitability = input.roleSuitability.highlight ?? 0
  const peakWorthinessScore = clamp01(
    input.momentPotentialScore * 0.32 +
      input.momentIntensityScore * 0.28 +
      input.anchorStrength * 0.18 +
      highlightRoleSuitability * 0.14 +
      input.experientialFactor * 0.08,
  )
  const centralMomentQualityScore = clamp01(
    input.momentIntensityScore * 0.34 +
      input.momentPotentialScore * 0.24 +
      input.anchorStrength * 0.16 +
      input.experientialFactor * 0.14 +
      input.destinationFactor * 0.08 +
      highlightRoleSuitability * 0.04,
  )
  const passivePeak =
    isPassiveHospitalityPeak &&
    input.momentPotentialScore < 0.66 &&
    input.anchorStrength < 0.58
  const weakPeak =
    input.momentPotentialScore < 0.56 &&
    input.momentIntensityScore < 0.58 &&
    input.anchorStrength < 0.54
  const peakWorthinessStatus = scoreToPeakWorthinessStatus({
    score: peakWorthinessScore,
    weakPeak,
    passivePeak,
  })
  const centralMomentQualityStatus = scoreToCentralMomentQualityStatus({
    score: centralMomentQualityScore,
    weakPeak,
    passivePeak,
  })
  const weakPassiveReasons = [
    ...(weakPeak ? ['weak_peak_evidence'] : []),
    ...(passivePeak ? ['passive_peak_evidence'] : []),
  ]
  const peakWorthinessComponents = [
    toComponent('moment_potential', input.momentPotentialScore, 'Moment potential'),
    toComponent('moment_intensity', input.momentIntensityScore, 'Moment intensity'),
    toComponent('anchor_strength', input.anchorStrength, 'Anchor strength'),
    toComponent(
      'highlight_role_suitability',
      highlightRoleSuitability,
      'Highlight role suitability',
    ),
    toComponent('experiential_factor', input.experientialFactor, 'Experiential factor'),
    toComponent('weak_peak', weakPeak, 'Weak peak evidence'),
    toComponent('passive_peak', passivePeak, 'Passive peak evidence'),
  ]
  const centralMomentQualityComponents = [
    toComponent('moment_intensity', input.momentIntensityScore, 'Moment intensity'),
    toComponent('moment_potential', input.momentPotentialScore, 'Moment potential'),
    toComponent('anchor_strength', input.anchorStrength, 'Anchor strength'),
    toComponent('experiential_factor', input.experientialFactor, 'Experiential factor'),
    toComponent('destination_factor', input.destinationFactor, 'Destination factor'),
    toComponent(
      'highlight_role_suitability',
      highlightRoleSuitability,
      'Highlight role suitability',
    ),
    toComponent('weak_peak', weakPeak, 'Weak peak evidence'),
    toComponent('passive_peak', passivePeak, 'Passive peak evidence'),
  ]

  return {
    source: 'taste',
    candidateVenueId: input.candidateVenueId,
    hardIncompatibleSignals,
    hardIncompatible: hardIncompatibleSignals.length > 0,
    nightlifeLike,
    calmness,
    quickStopLeaning,
    isPassiveHospitalityPeak,
    isFriendsLivelyBasecamp: isEasyHangBasecampCategory,
    isEasyHangBasecampCategory,
    categoryArchetype: {
      category: input.category,
      subcategory: input.subcategory,
      tags: input.tags,
      vibeTags: input.vibeTags,
      primaryExperienceArchetype: input.primaryExperienceArchetype,
      isPassiveHospitalityPeak,
      isGenericHospitalityHighlight,
      isSoftRomanticSupportArchetype,
    },
    roleSuitability: input.roleSuitability,
    social: {
      density: input.socialDensity,
      conversationFriendliness: input.conversationFriendliness,
      energy: input.energy,
    },
    romantic: {
      cozyCompatible: input.intimacy >= 0.5 || input.lingerFactor >= 0.5,
      livelyCompatible: input.momentIntensityScore >= 0.56 && input.energy >= 0.42,
      intimacy: input.intimacy,
      linger: input.lingerFactor,
      destination: input.destinationFactor,
      experiential: input.experientialFactor,
      momentIntensity: input.momentIntensityScore,
    },
    family: {
      boundedEnergyCompatible: input.energy <= 0.82 && nightlifeLike <= 0.88,
      nightlifeConflict: nightlifeLike > 0.88,
      calmness,
      energy: input.energy,
      socialDensity: input.socialDensity,
      interactiveStrength: input.interactiveStrength,
    },
    expressionActivation: {
      energy: input.energy,
      socialDensity: input.socialDensity,
      interactiveStrength: input.interactiveStrength,
      momentIntensity: input.momentIntensityScore,
      momentPotential: input.momentPotentialScore,
      anchorStrength: input.anchorStrength,
      activationQuality,
      expressionQuality,
    },
    peakWorthiness: {
      source: 'taste',
      score: peakWorthinessScore,
      status: peakWorthinessStatus,
      candidatePeakSuitability: scoreToFitStrength(peakWorthinessScore),
      weakPeak,
      passivePeak,
      reasons:
        weakPassiveReasons.length > 0
          ? weakPassiveReasons
          : [`peak_worthiness:${peakWorthinessStatus}`],
      components: peakWorthinessComponents,
    },
    centralMomentQuality: {
      source: 'taste',
      score: centralMomentQualityScore,
      status: centralMomentQualityStatus,
      weakPeak,
      passivePeak,
      reasons:
        weakPassiveReasons.length > 0
          ? weakPassiveReasons
          : [`central_moment_quality:${centralMomentQualityStatus}`],
      components: centralMomentQualityComponents,
    },
  }
}

export function computeRolePoolMeaningEvidence(input: {
  role?: TasteRole
  context: RolePoolMeaningContextInput
  candidate: RolePoolMeaningCandidateInput
}): RolePoolMeaningEvidence {
  const context = computeRolePoolMeaningContextEvidence(input.context)
  const candidate = computeRolePoolCandidateMeaningEvidence(input.candidate)
  const easyHangCompatibility =
    context.easyHang.active && candidate.hardIncompatible
      ? 'conflict'
      : context.easyHang.active
        ? 'compatible'
        : 'unknown'

  return {
    source: 'taste',
    role: input.role,
    context,
    candidate,
    rolePoolEvidence: {
      role: input.role,
      candidateVenueId: input.candidate.candidateVenueId,
      roleSuitability: {
        start:
          typeof candidate.roleSuitability.start === 'number'
            ? {
                score: candidate.roleSuitability.start,
                strength: scoreToFitStrength(candidate.roleSuitability.start),
              }
            : undefined,
        highlight:
          typeof candidate.roleSuitability.highlight === 'number'
            ? {
                score: candidate.roleSuitability.highlight,
                strength: scoreToFitStrength(candidate.roleSuitability.highlight),
              }
            : undefined,
        windDown:
          typeof candidate.roleSuitability.windDown === 'number'
            ? {
                score: candidate.roleSuitability.windDown,
                strength: scoreToFitStrength(candidate.roleSuitability.windDown),
              }
            : undefined,
        surprise:
          typeof candidate.roleSuitability.surprise === 'number'
            ? {
                score: candidate.roleSuitability.surprise,
                strength: scoreToFitStrength(candidate.roleSuitability.surprise),
              }
            : undefined,
      },
      easyHangCompatibility,
      easyHangActive: context.easyHang.active,
      hardIncompatibleSignals: candidate.hardIncompatibleSignals,
      socialEvidence: [
        toComponent('social_density', candidate.social.density, 'Social density'),
        toComponent(
          'conversation_friendliness',
          candidate.social.conversationFriendliness,
          'Conversation friendliness',
        ),
        toComponent('nightlife_like', candidate.nightlifeLike, 'Nightlife-like pressure'),
      ],
      romanticEvidence: [
        toComponent('romantic_cozy_compatible', candidate.romantic.cozyCompatible),
        toComponent('romantic_lively_compatible', candidate.romantic.livelyCompatible),
        toComponent('romantic_intimacy', candidate.romantic.intimacy),
        toComponent('romantic_linger', candidate.romantic.linger),
        toComponent('romantic_destination', candidate.romantic.destination),
        toComponent('romantic_experiential', candidate.romantic.experiential),
        toComponent('romantic_moment_intensity', candidate.romantic.momentIntensity),
      ],
      familyEvidence: [
        toComponent('bounded_energy_compatible', candidate.family.boundedEnergyCompatible),
        toComponent('nightlife_conflict', candidate.family.nightlifeConflict),
        toComponent('family_calmness', candidate.family.calmness),
        toComponent('family_energy', candidate.family.energy),
        toComponent('family_social_density', candidate.family.socialDensity),
        toComponent('family_interactive_strength', candidate.family.interactiveStrength),
      ],
      categoryVibeEvidence: [
        toComponent('category', input.candidate.category),
        ...(input.candidate.subcategory
          ? [toComponent('subcategory', input.candidate.subcategory)]
          : []),
        ...(input.candidate.primaryExperienceArchetype
          ? [
              toComponent(
                'primary_experience_archetype',
                input.candidate.primaryExperienceArchetype,
              ),
            ]
          : []),
        toComponent('passive_hospitality_peak', candidate.isPassiveHospitalityPeak),
        toComponent(
          'generic_hospitality_highlight',
          candidate.categoryArchetype.isGenericHospitalityHighlight,
        ),
        toComponent(
          'soft_romantic_support_archetype',
          candidate.categoryArchetype.isSoftRomanticSupportArchetype,
        ),
      ],
    },
  }
}
