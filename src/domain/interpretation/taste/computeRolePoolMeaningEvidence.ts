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
  roleSuitability: Partial<Record<TasteRole, number>>
  social: {
    density: number
    conversationFriendliness: number
    energy: number
  }
  romantic: {
    cozyCompatible: boolean
    livelyCompatible: boolean
  }
  family: {
    boundedEnergyCompatible: boolean
    nightlifeConflict: boolean
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

function scoreToCompatibility(score: number): TasteRouteMeaningCompatibilityStatus {
  if (score >= 0.65) {
    return 'compatible'
  }
  if (score >= 0.35) {
    return 'partial'
  }
  return 'conflict'
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
    roleSuitability: input.roleSuitability,
    social: {
      density: input.socialDensity,
      conversationFriendliness: input.conversationFriendliness,
      energy: input.energy,
    },
    romantic: {
      cozyCompatible: input.intimacy >= 0.5 || input.lingerFactor >= 0.5,
      livelyCompatible: input.momentIntensityScore >= 0.56 && input.energy >= 0.42,
    },
    family: {
      boundedEnergyCompatible: input.energy <= 0.82 && nightlifeLike <= 0.88,
      nightlifeConflict: nightlifeLike > 0.88,
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
      ],
      familyEvidence: [
        toComponent('bounded_energy_compatible', candidate.family.boundedEnergyCompatible),
        toComponent('nightlife_conflict', candidate.family.nightlifeConflict),
      ],
      categoryVibeEvidence: [
        toComponent('category', input.candidate.category),
        toComponent('passive_hospitality_peak', candidate.isPassiveHospitalityPeak),
      ],
    },
  }
}
