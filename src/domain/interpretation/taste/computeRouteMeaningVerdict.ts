import type { PersonaMode, VibeAnchor } from '../../types/intent'
import type {
  TasteExperienceArchetype,
  TasteExperienceFamily,
  TasteVenueCategory,
} from './types'
import type {
  TasteRouteMeaningCompatibilityStatus,
  TasteRouteMeaningFitStrength,
  TasteRouteMeaningIntentRightFailureEvidence,
  TasteRouteMeaningIntentRightVerdict,
  TasteRouteMeaningRoleRightFailureEvidence,
  TasteRouteMeaningRoleRightVerdict,
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
  routeFitScore?: number
  lensCompatibilityScore?: number
  roleFitScore?: number
  stopShapeFitScore?: number
  contextSpecificityScore?: number
  vibeFitScore?: number
}

export type RouteMeaningRomanticHighlightArbitrationResult =
  | 'romantic_highlight_won'
  | 'generic_cozy_highlight_won'
  | 'non_generic_highlight_won'
  | 'no_romantic_alternative_available'

export type RouteMeaningFamilyCompetitionWinnerMode =
  | 'single_family_only'
  | 'clear_family_lead'
  | 'competitive_field_best_family_won'
  | 'competitive_field_alternate_family_won'
  | 'competitive_field_non_competing_family_won'

export type RouteMeaningExpressionWidth = 'narrow' | 'moderate' | 'broad'

export interface RouteMeaningCompatibilityValues {
  vibeCoherenceScore: number
  highlightVibeScore: number
  supportStopVibeScore: number
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
  romanticHighlightArbitrationResult: RouteMeaningRomanticHighlightArbitrationResult
  familyCompetitionScore: number
  familyCompetitionPenalty: number
  familyCompetitionActive: boolean
  familyCompetitionEligibleFamilies: readonly string[]
  familyCompetitionLeadingFamily?: string
  familyCompetitionTopSpread: number
  familyCompetitionThreshold: number
  familyCompetitionWinnerMode: RouteMeaningFamilyCompetitionWinnerMode
  expressionWidth: RouteMeaningExpressionWidth
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

export const ROLE_RIGHT_ROLE_FIT_THRESHOLD = 0.5
export const ROLE_RIGHT_SHAPE_FIT_THRESHOLD = 0.34
const INTENT_RIGHT_ROUTE_FIT_THRESHOLD = 0.42
export const INTENT_RIGHT_LENS_COMPATIBILITY_THRESHOLD = 0.38
export const INTENT_RIGHT_CONTEXT_SPECIFICITY_THRESHOLD = 0.3

export type TasteRoleIntentCoreCriterion = 'role_right' | 'intent_right'
export type TasteRoleIntentCoreField =
  | 'role_fit'
  | 'stop_shape_fit'
  | 'route_fit'
  | 'lens_compatibility'
  | 'context_specificity'

export interface TasteRoleIntentCoreFailure {
  criterion: TasteRoleIntentCoreCriterion
  field: TasteRoleIntentCoreField
  role: TasteRouteMeaningStopRole
  candidateVenueId: TasteRouteMeaningVenueId
  score: number
  threshold: number
  reason: string
  evidencePresent: true
}

export interface TasteRoleIntentCoreMissingEvidence {
  criterion: TasteRoleIntentCoreCriterion
  field: TasteRoleIntentCoreField
  role: TasteRouteMeaningStopRole
  candidateVenueId: TasteRouteMeaningVenueId
  evidencePresent: false
}

export interface TasteRoleIntentCoreResult {
  owner: 'taste'
  coreFunctionName: 'evaluateTasteRoleIntentCore'
  role: TasteRouteMeaningStopRole
  candidateVenueId: TasteRouteMeaningVenueId
  scores: {
    roleFit: number | undefined
    stopShapeFit: number | undefined
    routeFit: number | undefined
    lensCompatibility: number | undefined
    contextSpecificity: number | undefined
  }
  thresholds: {
    roleFit: number
    stopShapeFit: number
    routeFit: number
    lensCompatibility: number
    contextSpecificity: number
  }
  roleRight: {
    ready: boolean
    failures: readonly TasteRoleIntentCoreFailure[]
    missingEvidence: readonly TasteRoleIntentCoreMissingEvidence[]
  }
  intentRight: {
    ready: boolean
    failures: readonly TasteRoleIntentCoreFailure[]
    missingEvidence: readonly TasteRoleIntentCoreMissingEvidence[]
  }
}

export interface TasteRoleIntentCoreOptions {
  roleRight?: boolean
  intentRight?: {
    routeFit?: boolean
    lensCompatibility?: boolean
    contextSpecificity?: boolean
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function average(values: ReadonlyArray<number | undefined>): number | undefined {
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

function buildCoreMissingEvidence(params: {
  criterion: TasteRoleIntentCoreCriterion
  field: TasteRoleIntentCoreField
  stop: TasteRouteMeaningStopEvidenceInput
}): TasteRoleIntentCoreMissingEvidence {
  return {
    criterion: params.criterion,
    field: params.field,
    role: params.stop.role,
    candidateVenueId: params.stop.candidateVenueId,
    evidencePresent: false,
  }
}

function evaluateTasteRoleIntentCoreField(params: {
  criterion: TasteRoleIntentCoreCriterion
  field: TasteRoleIntentCoreField
  stop: TasteRouteMeaningStopEvidenceInput
  score: number | undefined
  threshold: number
  reason: string
}): {
  failure?: TasteRoleIntentCoreFailure
  missingEvidence?: TasteRoleIntentCoreMissingEvidence
} {
  if (typeof params.score !== 'number') {
    return {
      missingEvidence: buildCoreMissingEvidence({
        criterion: params.criterion,
        field: params.field,
        stop: params.stop,
      }),
    }
  }
  if (params.score < params.threshold) {
    return {
      failure: {
        criterion: params.criterion,
        field: params.field,
        role: params.stop.role,
        candidateVenueId: params.stop.candidateVenueId,
        score: params.score,
        threshold: params.threshold,
        reason: params.reason,
        evidencePresent: true,
      },
    }
  }
  return {}
}

export function evaluateTasteRoleIntentCore(params: {
  stop: TasteRouteMeaningStopEvidenceInput
  options: TasteRoleIntentCoreOptions
}): TasteRoleIntentCoreResult {
  const { stop, options } = params
  const roleRightFailures: TasteRoleIntentCoreFailure[] = []
  const roleRightMissingEvidence: TasteRoleIntentCoreMissingEvidence[] = []
  const intentRightFailures: TasteRoleIntentCoreFailure[] = []
  const intentRightMissingEvidence: TasteRoleIntentCoreMissingEvidence[] = []

  const applyResult = (
    target: TasteRoleIntentCoreCriterion,
    result: ReturnType<typeof evaluateTasteRoleIntentCoreField>,
  ): void => {
    if (target === 'role_right') {
      if (result.failure) roleRightFailures.push(result.failure)
      if (result.missingEvidence) roleRightMissingEvidence.push(result.missingEvidence)
      return
    }
    if (result.failure) intentRightFailures.push(result.failure)
    if (result.missingEvidence) intentRightMissingEvidence.push(result.missingEvidence)
  }

  if (options.roleRight === true) {
    applyResult(
      'role_right',
      evaluateTasteRoleIntentCoreField({
        criterion: 'role_right',
        field: 'role_fit',
        stop,
        score: stop.roleFitScore,
        threshold: ROLE_RIGHT_ROLE_FIT_THRESHOLD,
        reason: `role_right:low_role_fit:${stop.role}`,
      }),
    )
    applyResult(
      'role_right',
      evaluateTasteRoleIntentCoreField({
        criterion: 'role_right',
        field: 'stop_shape_fit',
        stop,
        score: stop.stopShapeFitScore,
        threshold: ROLE_RIGHT_SHAPE_FIT_THRESHOLD,
        reason: `role_right:low_shape_fit:${stop.role}`,
      }),
    )
  }

  if (options.intentRight?.routeFit === true) {
    applyResult(
      'intent_right',
      evaluateTasteRoleIntentCoreField({
        criterion: 'intent_right',
        field: 'route_fit',
        stop,
        score: stop.routeFitScore,
        threshold: INTENT_RIGHT_ROUTE_FIT_THRESHOLD,
        reason: `intent_right:low_fit:${stop.role}`,
      }),
    )
  }
  if (options.intentRight?.lensCompatibility === true) {
    applyResult(
      'intent_right',
      evaluateTasteRoleIntentCoreField({
        criterion: 'intent_right',
        field: 'lens_compatibility',
        stop,
        score: stop.lensCompatibilityScore,
        threshold: INTENT_RIGHT_LENS_COMPATIBILITY_THRESHOLD,
        reason: `intent_right:low_lens_compatibility:${stop.role}`,
      }),
    )
  }
  if (options.intentRight?.contextSpecificity === true) {
    applyResult(
      'intent_right',
      evaluateTasteRoleIntentCoreField({
        criterion: 'intent_right',
        field: 'context_specificity',
        stop,
        score: stop.contextSpecificityScore,
        threshold: INTENT_RIGHT_CONTEXT_SPECIFICITY_THRESHOLD,
        reason: `intent_right:low_context_specificity:${stop.role}`,
      }),
    )
  }

  return {
    owner: 'taste',
    coreFunctionName: 'evaluateTasteRoleIntentCore',
    role: stop.role,
    candidateVenueId: stop.candidateVenueId,
    scores: {
      roleFit: stop.roleFitScore,
      stopShapeFit: stop.stopShapeFitScore,
      routeFit: stop.routeFitScore,
      lensCompatibility: stop.lensCompatibilityScore,
      contextSpecificity: stop.contextSpecificityScore,
    },
    thresholds: {
      roleFit: ROLE_RIGHT_ROLE_FIT_THRESHOLD,
      stopShapeFit: ROLE_RIGHT_SHAPE_FIT_THRESHOLD,
      routeFit: INTENT_RIGHT_ROUTE_FIT_THRESHOLD,
      lensCompatibility: INTENT_RIGHT_LENS_COMPATIBILITY_THRESHOLD,
      contextSpecificity: INTENT_RIGHT_CONTEXT_SPECIFICITY_THRESHOLD,
    },
    roleRight: {
      ready:
        options.roleRight !== true ||
        roleRightMissingEvidence.length === 0,
      failures: roleRightFailures,
      missingEvidence: roleRightMissingEvidence,
    },
    intentRight: {
      ready:
        !options.intentRight ||
        intentRightMissingEvidence.length === 0,
      failures: intentRightFailures,
      missingEvidence: intentRightMissingEvidence,
    },
  }
}

function buildRoleRightFailureEvidence(params: {
  stop: TasteRouteMeaningStopEvidenceInput
  evidenceType: TasteRouteMeaningRoleRightFailureEvidence['evidenceType']
  score: number
  threshold: number
  reason: string
}): TasteRouteMeaningRoleRightFailureEvidence {
  const label =
    params.evidenceType === 'low_role_fit' ? 'Role fit below Role-Right threshold' : 'Shape fit below Role-Right threshold'

  return {
    role: params.stop.role,
    candidateVenueId: params.stop.candidateVenueId,
    reason: params.reason,
    score: clamp01(params.score),
    threshold: params.threshold,
    evidenceType: params.evidenceType,
    components: [
      toComponent(
        params.evidenceType,
        clamp01(params.score),
        label,
      ),
      toComponent(`${params.evidenceType}_threshold`, params.threshold, 'Role-Right threshold'),
    ],
  }
}

export function computeRouteMeaningRoleRightVerdict(
  stops: readonly TasteRouteMeaningStopEvidenceInput[],
): TasteRouteMeaningRoleRightVerdict {
  const coreResults = stops.map((stop) => ({
    stop,
    core: evaluateTasteRoleIntentCore({
      stop,
      options: { roleRight: true },
    }),
  }))
  const stopEvidence = coreResults.map(({ stop, core }) => {
    const lowRoleReasons = core.roleRight.failures
      .filter((failure) => failure.field === 'role_fit')
      .map((failure) => failure.reason)
    const lowShapeReasons = core.roleRight.failures
      .filter((failure) => failure.field === 'stop_shape_fit')
      .map((failure) => failure.reason)
    const roleRightReasons = [...lowRoleReasons, ...lowShapeReasons]
    const conflictEvidence = core.roleRight.failures.map((failure) =>
      failure.field === 'role_fit'
        ? toComponent('role_fit_score', clamp01(failure.score), 'Low role fit')
        : toComponent('stop_shape_fit_score', clamp01(failure.score), 'Low stop shape fit'),
    )

    return {
      role: stop.role,
      candidateVenueId: stop.candidateVenueId,
      roleFit: toScoreVerdict(stop.roleFitScore, lowRoleReasons),
      shapeFit: toScoreVerdict(stop.stopShapeFitScore, lowShapeReasons),
      lowRoleReasons: lowRoleReasons.length > 0 ? lowRoleReasons : undefined,
      lowShapeReasons: lowShapeReasons.length > 0 ? lowShapeReasons : undefined,
      roleRightReasons: roleRightReasons.length > 0 ? roleRightReasons : undefined,
      conflictEvidence: conflictEvidence.length > 0 ? conflictEvidence : undefined,
    }
  })
  const lowRoleEvidence = coreResults.flatMap(({ stop, core }) =>
    core.roleRight.failures
      .filter((failure) => failure.field === 'role_fit')
      .map((failure) =>
        buildRoleRightFailureEvidence({
          stop,
          evidenceType: 'low_role_fit',
          score: failure.score,
          threshold: failure.threshold,
          reason: failure.reason,
        }),
      ),
  )
  const lowShapeEvidence = coreResults.flatMap(({ stop, core }) =>
    core.roleRight.failures
      .filter((failure) => failure.field === 'stop_shape_fit')
      .map((failure) =>
        buildRoleRightFailureEvidence({
          stop,
          evidenceType: 'low_shape_fit',
          score: failure.score,
          threshold: failure.threshold,
          reason: failure.reason,
        }),
      ),
  )
  const reasons = [
    ...lowRoleEvidence.map((evidence) => evidence.reason),
    ...lowShapeEvidence.map((evidence) => evidence.reason),
  ]
  const ready = coreResults.every(({ core }) => core.roleRight.ready)

  return {
    status: ready ? (reasons.length === 0 ? 'pass' : 'fail') : 'unknown',
    ready,
    reasons,
    roleFitThreshold: ROLE_RIGHT_ROLE_FIT_THRESHOLD,
    shapeFitThreshold: ROLE_RIGHT_SHAPE_FIT_THRESHOLD,
    lowRoleEvidence,
    lowShapeEvidence,
    stopEvidence,
  }
}

function buildIntentRightFailureEvidence(params: {
  stop: TasteRouteMeaningStopEvidenceInput
  evidenceType: TasteRouteMeaningIntentRightFailureEvidence['evidenceType']
  score: number
  threshold: number
  reason: string
}): TasteRouteMeaningIntentRightFailureEvidence {
  const label =
    params.evidenceType === 'low_fit'
      ? 'Route fit below Intent-Right threshold'
      : params.evidenceType === 'low_lens_compatibility'
        ? 'Lens compatibility below Intent-Right threshold'
        : 'Context specificity below Intent-Right threshold'

  return {
    role: params.stop.role,
    candidateVenueId: params.stop.candidateVenueId,
    reason: params.reason,
    score: clamp01(params.score),
    threshold: params.threshold,
    evidenceType: params.evidenceType,
    components: [
      toComponent(
        params.evidenceType,
        clamp01(params.score),
        label,
      ),
      toComponent(
        `${params.evidenceType}_threshold`,
        params.threshold,
        'Intent-Right threshold',
      ),
    ],
  }
}

export function computeRouteMeaningIntentRightVerdict(
  stops: readonly TasteRouteMeaningStopEvidenceInput[],
): TasteRouteMeaningIntentRightVerdict {
  const coreResults = stops.map((stop) => ({
    stop,
    core: evaluateTasteRoleIntentCore({
      stop,
      options: {
        intentRight: {
          routeFit: true,
          lensCompatibility: true,
          contextSpecificity: true,
        },
      },
    }),
  }))
  const stopEvidence = coreResults.map(({ stop, core }) => {
    const lowFitReasons = core.intentRight.failures
      .filter((failure) => failure.field === 'route_fit')
      .map((failure) => failure.reason)
    const lowLensCompatibilityReasons = core.intentRight.failures
      .filter((failure) => failure.field === 'lens_compatibility')
      .map((failure) => failure.reason)
    const lowContextSpecificityReasons = core.intentRight.failures
      .filter((failure) => failure.field === 'context_specificity')
      .map((failure) => failure.reason)
    const intentRightReasons = [
      ...lowFitReasons,
      ...lowLensCompatibilityReasons,
      ...lowContextSpecificityReasons,
    ]
    const conflictEvidence = core.intentRight.failures.map((failure) => {
      if (failure.field === 'route_fit') {
        return toComponent('route_fit_score', clamp01(failure.score), 'Low route fit')
      }
      if (failure.field === 'lens_compatibility') {
        return toComponent(
          'lens_compatibility_score',
          clamp01(failure.score),
          'Low lens compatibility',
        )
      }
      return toComponent(
        'context_specificity_score',
        clamp01(failure.score),
        'Low context specificity',
      )
    })

    return {
      role: stop.role,
      candidateVenueId: stop.candidateVenueId,
      routeFit: toScoreVerdict(stop.routeFitScore, lowFitReasons),
      lensCompatibility: toScoreVerdict(
        stop.lensCompatibilityScore,
        lowLensCompatibilityReasons,
      ),
      contextSpecificity: toScoreVerdict(
        stop.contextSpecificityScore,
        lowContextSpecificityReasons,
      ),
      lowFitReasons: lowFitReasons.length > 0 ? lowFitReasons : undefined,
      lowLensCompatibilityReasons:
        lowLensCompatibilityReasons.length > 0 ? lowLensCompatibilityReasons : undefined,
      lowContextSpecificityReasons:
        lowContextSpecificityReasons.length > 0 ? lowContextSpecificityReasons : undefined,
      intentRightReasons: intentRightReasons.length > 0 ? intentRightReasons : undefined,
      conflictEvidence: conflictEvidence.length > 0 ? conflictEvidence : undefined,
    }
  })
  const lowFitEvidence = coreResults.flatMap(({ stop, core }) =>
    core.intentRight.failures
      .filter((failure) => failure.field === 'route_fit')
      .map((failure) =>
        buildIntentRightFailureEvidence({
          stop,
          evidenceType: 'low_fit',
          score: failure.score,
          threshold: failure.threshold,
          reason: failure.reason,
        }),
      ),
  )
  const lowLensCompatibilityEvidence = coreResults.flatMap(({ stop, core }) =>
    core.intentRight.failures
      .filter((failure) => failure.field === 'lens_compatibility')
      .map((failure) =>
        buildIntentRightFailureEvidence({
          stop,
          evidenceType: 'low_lens_compatibility',
          score: failure.score,
          threshold: failure.threshold,
          reason: failure.reason,
        }),
      ),
  )
  const lowContextSpecificityEvidence = coreResults.flatMap(({ stop, core }) =>
    core.intentRight.failures
      .filter((failure) => failure.field === 'context_specificity')
      .map((failure) =>
        buildIntentRightFailureEvidence({
          stop,
          evidenceType: 'low_context_specificity',
          score: failure.score,
          threshold: failure.threshold,
          reason: failure.reason,
        }),
      ),
  )
  const reasons = [
    ...lowFitEvidence.map((evidence) => evidence.reason),
    ...lowLensCompatibilityEvidence.map((evidence) => evidence.reason),
    ...lowContextSpecificityEvidence.map((evidence) => evidence.reason),
  ]
  const ready = coreResults.every(({ core }) => core.intentRight.ready)

  return {
    status: ready ? (reasons.length === 0 ? 'pass' : 'fail') : 'unknown',
    ready,
    reasons,
    routeFitThreshold: INTENT_RIGHT_ROUTE_FIT_THRESHOLD,
    lensCompatibilityThreshold: INTENT_RIGHT_LENS_COMPATIBILITY_THRESHOLD,
    contextSpecificityThreshold: INTENT_RIGHT_CONTEXT_SPECIFICITY_THRESHOLD,
    lowFitEvidence,
    lowLensCompatibilityEvidence,
    lowContextSpecificityEvidence,
    stopEvidence,
  }
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
      ...(typeof stop.routeFitScore === 'number'
        ? [toComponent('route_fit_score', clamp01(stop.routeFitScore), 'Route fit')]
        : []),
      ...(typeof stop.lensCompatibilityScore === 'number'
        ? [
            toComponent(
              'lens_compatibility_score',
              clamp01(stop.lensCompatibilityScore),
              'Lens compatibility',
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
  const roleRightVerdict = computeRouteMeaningRoleRightVerdict(input.stops)
  const intentRightVerdict = computeRouteMeaningIntentRightVerdict(input.stops)
  const routeRoleFit = average(input.stops.map((stop) => stop.roleFitScore))
  const routeFit = average(input.stops.map((stop) => stop.routeFitScore))
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
  const requestedPersonaFit = input.requestedPersona
    ? routeFitByPersona[input.requestedPersona]
    : undefined
  const dominantPersonaFit: TasteRouteMeaningScoreVerdict =
    requestedPersonaFit ?? toScoreVerdict(undefined)
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
        stopRoleFit: roleRightVerdict.stopEvidence,
        roleSuitability: getRoleSuitability(input.stops),
        lowRoleReasons:
          roleRightVerdict.lowRoleEvidence.length > 0
            ? roleRightVerdict.lowRoleEvidence.map((evidence) => evidence.reason)
            : undefined,
        lowShapeReasons:
          roleRightVerdict.lowShapeEvidence.length > 0
            ? roleRightVerdict.lowShapeEvidence.map((evidence) => evidence.reason)
            : undefined,
        roleConflictEvidence: [
          ...roleRightVerdict.lowRoleEvidence.flatMap((evidence) => evidence.components ?? []),
          ...roleRightVerdict.lowShapeEvidence.flatMap((evidence) => evidence.components ?? []),
        ],
        roleRightReady: roleRightVerdict.ready,
        roleRightVerdict,
      },
      intentVerdict: {
        routeIntentFit: toScoreVerdict(
          average([routeFit ?? routeRoleFit, contextSpecificity, lensCompatibility]),
        ),
        lensCompatibility: toScoreVerdict(lensCompatibility),
        contextSpecificity: toScoreVerdict(contextSpecificity),
        stopIntentFit: intentRightVerdict.stopEvidence,
        lowFitReasons:
          intentRightVerdict.lowFitEvidence.length > 0
            ? intentRightVerdict.lowFitEvidence.map((evidence) => evidence.reason)
            : undefined,
        lowLensCompatibilityReasons:
          intentRightVerdict.lowLensCompatibilityEvidence.length > 0
            ? intentRightVerdict.lowLensCompatibilityEvidence.map((evidence) => evidence.reason)
            : undefined,
        lowContextSpecificityReasons:
          intentRightVerdict.lowContextSpecificityEvidence.length > 0
            ? intentRightVerdict.lowContextSpecificityEvidence.map((evidence) => evidence.reason)
            : undefined,
        intentConflictEvidence: [
          ...intentRightVerdict.lowFitEvidence.flatMap((evidence) => evidence.components ?? []),
          ...intentRightVerdict.lowLensCompatibilityEvidence.flatMap(
            (evidence) => evidence.components ?? [],
          ),
          ...intentRightVerdict.lowContextSpecificityEvidence.flatMap(
            (evidence) => evidence.components ?? [],
          ),
        ],
        intentRightReady: intentRightVerdict.ready,
        intentRightVerdict,
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
          arcContrastScore: compatibility.arcContrastScore,
          highlightCenteringScore: compatibility.highlightCenteringScore,
          roleEnergyScore: compatibility.roleEnergyScore,
          roleEnergyPenalty: compatibility.roleEnergyPenalty,
          roleEnergyNote: compatibility.roleEnergyNote,
          lensCoherenceScore: compatibility.lensCoherenceScore,
          contextSpecificityLift: compatibility.contextSpecificityLift,
          dominancePenalty: compatibility.dominancePenalty,
          fakeCompletenessPenalty: compatibility.fakeCompletenessPenalty,
          fakeCompletenessApplied: compatibility.fakeCompletenessApplied,
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
        greatStopRoleRightInputs: {
          roleRightReady: roleRightVerdict.ready,
          roleRightVerdict: roleRightVerdict.status,
          roleFitThreshold: roleRightVerdict.roleFitThreshold,
          shapeFitThreshold: roleRightVerdict.shapeFitThreshold,
          lowRoleFailureCount: roleRightVerdict.lowRoleEvidence.length,
          lowShapeFailureCount: roleRightVerdict.lowShapeEvidence.length,
          roleRightFailureCount: roleRightVerdict.reasons.length,
          roleRightReasons: roleRightVerdict.reasons.join('|'),
        },
        greatStopIntentRightInputs: {
          intentRightReady: intentRightVerdict.ready,
          intentRightVerdict: intentRightVerdict.status,
          routeFitThreshold: intentRightVerdict.routeFitThreshold,
          lensCompatibilityThreshold: intentRightVerdict.lensCompatibilityThreshold,
          contextSpecificityThreshold: intentRightVerdict.contextSpecificityThreshold,
          lowFitFailureCount: intentRightVerdict.lowFitEvidence.length,
          lowLensCompatibilityFailureCount:
            intentRightVerdict.lowLensCompatibilityEvidence.length,
          lowContextSpecificityFailureCount:
            intentRightVerdict.lowContextSpecificityEvidence.length,
          intentRightFailureCount: intentRightVerdict.reasons.length,
          intentRightReasons: intentRightVerdict.reasons.join('|'),
        },
        debugSummaries: [
          'ArcScoreBreakdown compatibility fields preserved while Taste owns route meaning verdict.',
          'Great Stop Role-Right compatibility inputs are Taste-authored for stamp alignment.',
          'Great Stop Intent-Right compatibility inputs are Taste-authored for future stamp alignment.',
        ],
      },
    },
  }
}
