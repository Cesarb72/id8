import type { PersonaMode, VibeAnchor } from '../../types/intent'
import type {
  TasteExperienceArchetype,
  TasteExperienceFamily,
  TasteVenueCategory,
} from './types'
import type {
  TasteRouteMeaningCompatibilityStatus,
  TasteRouteMeaningFitStrength,
  TasteRouteMeaningScoreVerdict,
  TasteRouteMeaningSignalComponent,
  TasteRouteMeaningStopEvidence,
  TasteRouteMeaningStopRole,
  TasteRouteMeaningVenueId,
  TasteRouteMeaningVerdict,
} from './routeMeaningVerdict'

export interface TasteRouteMeaningStopEvidenceInput {
  role: TasteRouteMeaningStopRole
  candidateVenueId: TasteRouteMeaningVenueId
  experienceFamily?: TasteExperienceFamily
  primaryExperienceArchetype?: TasteExperienceArchetype
  category?: TasteVenueCategory
  roleFitScore?: number
  stopShapeFitScore?: number
  contextSpecificityScore?: number
  vibeFitScore?: number
}

export interface RouteMeaningCompatibilityValues {
  vibeCoherenceScore: number
  highlightVibeScore: number
  supportStopVibeScore: number
  categoryDiversityScore: number
  categoryDiversityBonus: number
  categoryDiversityPenalty: number
  repeatedCategoryCount: number
  categoryDiversityNotes: readonly string[]
  roleAwareCategoryLift: number
  familyAlignmentBoost: number
  familyMismatchPenalty: number
  romanticContractScore: number
  romanticContractPenalty: number
  romanticContractSatisfied: boolean
  romanticContractFeasible: boolean
  romanticHighlightCandidatesFeasible: number
  romanticHighlightArbitrationResult: string
  familyCompetitionScore: number
  familyCompetitionPenalty: number
  familyCompetitionActive: boolean
  familyCompetitionEligibleFamilies: readonly string[]
  familyCompetitionLeadingFamily?: string
  familyCompetitionTopSpread: number
  familyCompetitionThreshold: number
  familyCompetitionWinnerMode: string
  expressionWidth: string
  expressionWidthReason: string
  expressionWidthFamilyCount: number
  expressionWidthCompetitiveFamilyCount: number
  expressionWidthIntensitySpread: number
  expressionWidthPeakPoolSize: number
  expressionWidthFallbackReliance: boolean
  expressionReleaseScore: number
  expressionReleasePenalty: number
  expressionReleaseEligible: boolean
  expressionReleaseReason: string
  expressionReleaseEliteFamilies: readonly string[]
  expressionReleaseSelectedFamily?: string
  activationMomentElevationScore: number
  activationMomentElevationPenalty: number
  activationMomentElevationEligible: boolean
  activationMomentElevationApplied: boolean
  activationMomentElevationReason: string
  activationMomentElevationCandidateFamilies: readonly string[]
}

export interface ComputeRouteMeaningVerdictInput {
  requestedPersona?: PersonaMode | null
  requestedPrimaryVibe?: VibeAnchor
  requestedSecondaryVibes?: readonly VibeAnchor[]
  stops: readonly TasteRouteMeaningStopEvidenceInput[]
  compatibility: RouteMeaningCompatibilityValues
}

export interface ComputeRouteMeaningVerdictResult
  extends RouteMeaningCompatibilityValues {
  verdict: TasteRouteMeaningVerdict
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function average(values: readonly Array<number | undefined>): number | undefined {
  const numericValues = values.filter((value): value is number => typeof value === 'number')

  if (numericValues.length === 0) {
    return undefined
  }

  return clamp01(
    numericValues.reduce((total, value) => total + value, 0) / numericValues.length,
  )
}

function scoreToStrength(score: number | undefined): TasteRouteMeaningFitStrength {
  if (score === undefined) {
    return 'unknown'
  }
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

function toScoreVerdict(
  score: number | undefined,
  reasons?: readonly string[],
  components?: readonly TasteRouteMeaningSignalComponent[],
): TasteRouteMeaningScoreVerdict {
  const normalizedScore = typeof score === 'number' ? clamp01(score) : undefined

  return {
    score: normalizedScore,
    strength: scoreToStrength(normalizedScore),
    reasons: reasons && reasons.length > 0 ? reasons : undefined,
    components: components && components.length > 0 ? components : undefined,
  }
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

function getRoleSuitability(
  stops: readonly TasteRouteMeaningStopEvidenceInput[],
): Partial<Record<TasteRouteMeaningStopRole, TasteRouteMeaningScoreVerdict>> {
  const roles: TasteRouteMeaningStopRole[] = ['start', 'highlight', 'windDown', 'surprise']

  return roles.reduce<Partial<Record<TasteRouteMeaningStopRole, TasteRouteMeaningScoreVerdict>>>(
    (result, role) => {
      const roleScore = average(
        stops.filter((stop) => stop.role === role).map((stop) => stop.roleFitScore),
      )

      if (roleScore !== undefined) {
        result[role] = toScoreVerdict(roleScore)
      }

      return result
    },
    {},
  )
}

function getDominantPersona(
  routeFitByPersona: Partial<Record<PersonaMode, TasteRouteMeaningScoreVerdict>>,
): PersonaMode | 'mixed' | 'unknown' {
  const entries = Object.entries(routeFitByPersona)
    .map(([persona, verdict]) => ({
      persona: persona as PersonaMode,
      score: verdict.score,
    }))
    .filter((entry): entry is { persona: PersonaMode; score: number } =>
      typeof entry.score === 'number',
    )
    .sort((left, right) => right.score - left.score)

  if (entries.length === 0) {
    return 'unknown'
  }

  if (entries.length > 1 && entries[0].score - entries[1].score < 0.08) {
    return 'mixed'
  }

  return entries[0].persona
}

function getHospitalityMix(
  stops: readonly TasteRouteMeaningStopEvidenceInput[],
): Partial<Record<TasteExperienceArchetype, number>> | undefined {
  if (stops.length === 0) {
    return undefined
  }

  const mix = stops.reduce<Partial<Record<TasteExperienceArchetype, number>>>(
    (result, stop) => {
      if (!stop.primaryExperienceArchetype) {
        return result
      }

      result[stop.primaryExperienceArchetype] =
        (result[stop.primaryExperienceArchetype] ?? 0) + 1
      return result
    },
    {},
  )

  Object.keys(mix).forEach((key) => {
    const archetype = key as TasteExperienceArchetype
    mix[archetype] = (mix[archetype] ?? 0) / stops.length
  })

  return mix
}

function getRepeatedCategories(
  stops: readonly TasteRouteMeaningStopEvidenceInput[],
): TasteVenueCategory[] | undefined {
  const counts = stops.reduce<Partial<Record<TasteVenueCategory, number>>>(
    (result, stop) => {
      if (!stop.category) {
        return result
      }

      result[stop.category] = (result[stop.category] ?? 0) + 1
      return result
    },
    {},
  )
  const repeated = Object.entries(counts)
    .filter(([, count]) => (count ?? 0) > 1)
    .map(([category]) => category as TasteVenueCategory)

  return repeated.length > 0 ? repeated : undefined
}

function getDominantCategories(
  stops: readonly TasteRouteMeaningStopEvidenceInput[],
): TasteVenueCategory[] | undefined {
  const categories = stops
    .map((stop) => stop.category)
    .filter((category): category is TasteVenueCategory => Boolean(category))

  if (categories.length === 0) {
    return undefined
  }

  const counts = categories.reduce<Partial<Record<TasteVenueCategory, number>>>(
    (result, category) => {
      result[category] = (result[category] ?? 0) + 1
      return result
    },
    {},
  )
  const maxCount = Math.max(...Object.values(counts).map((count) => count ?? 0))

  return Object.entries(counts)
    .filter(([, count]) => count === maxCount)
    .map(([category]) => category as TasteVenueCategory)
}

function getSocialSignalScore(
  stops: readonly TasteRouteMeaningStopEvidenceInput[],
): number | undefined {
  if (stops.length === 0) {
    return undefined
  }

  const socialStops = stops.filter(
    (stop) =>
      stop.primaryExperienceArchetype === 'social' ||
      stop.experienceFamily?.toLowerCase().includes('social'),
  ).length

  return clamp01(socialStops / stops.length)
}

function getCompatibilityStatus(score: number | undefined): TasteRouteMeaningCompatibilityStatus {
  if (score === undefined) {
    return 'unknown'
  }
  if (score >= 0.65) {
    return 'compatible'
  }
  if (score >= 0.35) {
    return 'partial'
  }
  return 'conflict'
}

function toStopEvidence(
  stop: TasteRouteMeaningStopEvidenceInput,
): TasteRouteMeaningStopEvidence {
  return {
    role: stop.role,
    candidateVenueId: stop.candidateVenueId,
    experienceFamily: stop.experienceFamily,
    primaryExperienceArchetype: stop.primaryExperienceArchetype,
    category: stop.category,
    components: [
      ...(typeof stop.roleFitScore === 'number'
        ? [toComponent('role_fit_score', clamp01(stop.roleFitScore), 'Role fit')]
        : []),
      ...(typeof stop.stopShapeFitScore === 'number'
        ? [toComponent('stop_shape_fit_score', clamp01(stop.stopShapeFitScore), 'Stop shape fit')]
        : []),
      ...(typeof stop.contextSpecificityScore === 'number'
        ? [
            toComponent(
              'context_specificity_score',
              clamp01(stop.contextSpecificityScore),
              'Context specificity',
            ),
          ]
        : []),
      ...(typeof stop.vibeFitScore === 'number'
        ? [toComponent('vibe_fit_score', clamp01(stop.vibeFitScore), 'Vibe fit')]
        : []),
    ],
  }
}

export function computeRouteMeaningVerdict(
  input: ComputeRouteMeaningVerdictInput,
): ComputeRouteMeaningVerdictResult {
  const compatibility = input.compatibility
  const routeRoleFit = average(input.stops.map((stop) => stop.roleFitScore))
  const contextSpecificity = average(input.stops.map((stop) => stop.contextSpecificityScore))
  const lensCompatibility = average([
    compatibility.vibeCoherenceScore,
    compatibility.supportStopVibeScore,
    compatibility.roleAwareCategoryLift,
  ])
  const socialSignalScore = getSocialSignalScore(input.stops)
  const socialFit =
    input.requestedPersona === 'friends'
      ? average([
          socialSignalScore,
          compatibility.supportStopVibeScore,
          compatibility.vibeCoherenceScore,
        ])
      : socialSignalScore
  const romanticFit = clamp01(
    compatibility.romanticContractScore - compatibility.romanticContractPenalty,
  )
  const familyFit = clamp01(
    compatibility.familyCompetitionScore -
      compatibility.familyCompetitionPenalty +
      compatibility.familyAlignmentBoost -
      compatibility.familyMismatchPenalty,
  )
  const routeFitByPersona: Partial<Record<PersonaMode, TasteRouteMeaningScoreVerdict>> = {
    romantic: toScoreVerdict(romanticFit),
    friends: toScoreVerdict(socialFit),
    family: toScoreVerdict(familyFit),
  }
  const dominantPersona = input.requestedPersona ?? getDominantPersona(routeFitByPersona)
  const dominantPersonaFit =
    input.requestedPersona && routeFitByPersona[input.requestedPersona]
      ? routeFitByPersona[input.requestedPersona]
      : toScoreVerdict(undefined)
  const categoryMeaningScore = clamp01(
    compatibility.categoryDiversityScore +
      compatibility.categoryDiversityBonus +
      compatibility.roleAwareCategoryLift -
      compatibility.categoryDiversityPenalty,
  )

  return {
    ...compatibility,
    verdict: {
      source: 'taste',
      provenance: [
        {
          source: 'taste',
          key: 'route_meaning_verdict',
          reason:
            'Taste owns route-level persona, role, intent, vibe, category, and social meaning.',
        },
      ],
      stops: input.stops.map(toStopEvidence),
      personaVerdict: {
        requestedPersona: input.requestedPersona ?? undefined,
        dominantPersona,
        dominantPersonaFit,
        routeFitByPersona,
      },
      roleVerdict: {
        routeRoleFit: toScoreVerdict(routeRoleFit),
        stopRoleFit: input.stops.map((stop) => ({
          role: stop.role,
          candidateVenueId: stop.candidateVenueId,
          roleFit: toScoreVerdict(stop.roleFitScore),
          shapeFit: toScoreVerdict(stop.stopShapeFitScore),
        })),
        roleSuitability: getRoleSuitability(input.stops),
        roleRightReady: false,
      },
      intentVerdict: {
        routeIntentFit: toScoreVerdict(
          average([routeRoleFit, contextSpecificity, lensCompatibility]),
        ),
        lensCompatibility: toScoreVerdict(lensCompatibility),
        contextSpecificity: toScoreVerdict(contextSpecificity),
        intentRightReady: false,
      },
      vibeVerdict: {
        requestedPrimaryVibe: input.requestedPrimaryVibe,
        requestedSecondaryVibes: input.requestedSecondaryVibes,
        vibeCoherence: toScoreVerdict(compatibility.vibeCoherenceScore),
        highlightVibeFit: toScoreVerdict(compatibility.highlightVibeScore),
        supportStopVibeFit: toScoreVerdict(compatibility.supportStopVibeScore),
      },
      categoryVerdict: {
        categoryMeaning: toScoreVerdict(categoryMeaningScore),
        categoryDiversity: toScoreVerdict(compatibility.categoryDiversityScore),
        repeatedCategories: getRepeatedCategories(input.stops),
        dominantCategories: getDominantCategories(input.stops),
        hospitalityMix: getHospitalityMix(input.stops),
      },
      socialVerdict: {
        friendsSocialFit: toScoreVerdict(socialFit),
        easyHangCompatibility:
          input.requestedPersona === 'friends'
            ? getCompatibilityStatus(socialFit)
            : 'unknown',
        groupSocialMomentum: toScoreVerdict(socialSignalScore),
      },
      romanticVerdict: {
        romanticRouteFit: toScoreVerdict(romanticFit),
        romanticHighlightSuitability: toScoreVerdict(compatibility.romanticContractScore),
      },
      familyVerdict: {
        familyRouteFit: toScoreVerdict(familyFit),
        familyCompatibility: getCompatibilityStatus(familyFit),
      },
      compatibility: {
        arcScoreBreakdown: {
          vibeCoherenceScore: compatibility.vibeCoherenceScore,
          highlightVibeScore: compatibility.highlightVibeScore,
          supportStopVibeScore: compatibility.supportStopVibeScore,
          categoryDiversityScore: compatibility.categoryDiversityScore,
          categoryDiversityBonus: compatibility.categoryDiversityBonus,
          categoryDiversityPenalty: compatibility.categoryDiversityPenalty,
          repeatedCategoryCount: compatibility.repeatedCategoryCount,
          roleAwareCategoryLift: compatibility.roleAwareCategoryLift,
          familyAlignmentBoost: compatibility.familyAlignmentBoost,
          familyMismatchPenalty: compatibility.familyMismatchPenalty,
          romanticContractScore: compatibility.romanticContractScore,
          romanticContractPenalty: compatibility.romanticContractPenalty,
          romanticContractSatisfied: compatibility.romanticContractSatisfied,
          romanticContractFeasible: compatibility.romanticContractFeasible,
          romanticHighlightCandidatesFeasible:
            compatibility.romanticHighlightCandidatesFeasible,
          romanticHighlightArbitrationResult:
            compatibility.romanticHighlightArbitrationResult,
          familyCompetitionScore: compatibility.familyCompetitionScore,
          familyCompetitionPenalty: compatibility.familyCompetitionPenalty,
          familyCompetitionActive: compatibility.familyCompetitionActive,
          familyCompetitionTopSpread: compatibility.familyCompetitionTopSpread,
          familyCompetitionThreshold: compatibility.familyCompetitionThreshold,
          familyCompetitionWinnerMode: compatibility.familyCompetitionWinnerMode,
          expressionWidth: compatibility.expressionWidth,
          expressionWidthReason: compatibility.expressionWidthReason,
          expressionWidthFamilyCount: compatibility.expressionWidthFamilyCount,
          expressionWidthCompetitiveFamilyCount:
            compatibility.expressionWidthCompetitiveFamilyCount,
          expressionWidthIntensitySpread: compatibility.expressionWidthIntensitySpread,
          expressionWidthPeakPoolSize: compatibility.expressionWidthPeakPoolSize,
          expressionWidthFallbackReliance: compatibility.expressionWidthFallbackReliance,
          expressionReleaseScore: compatibility.expressionReleaseScore,
          expressionReleasePenalty: compatibility.expressionReleasePenalty,
          expressionReleaseEligible: compatibility.expressionReleaseEligible,
          expressionReleaseReason: compatibility.expressionReleaseReason,
          activationMomentElevationScore: compatibility.activationMomentElevationScore,
          activationMomentElevationPenalty: compatibility.activationMomentElevationPenalty,
          activationMomentElevationEligible:
            compatibility.activationMomentElevationEligible,
          activationMomentElevationApplied: compatibility.activationMomentElevationApplied,
          activationMomentElevationReason: compatibility.activationMomentElevationReason,
        },
        debugSummaries: [
          'ArcScoreBreakdown compatibility fields preserved while Taste owns route meaning verdict.',
        ],
      },
    },
  }
}
