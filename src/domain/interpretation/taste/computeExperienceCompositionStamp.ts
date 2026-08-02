import type {
  ExperienceCompositionDimension,
  RoleCompositionRequirement,
  RouteInvariantTrait,
  RouteShapeContract,
  RouteShapeRole,
} from '../../types/intent'
import type { TasteRouteMomentVerdict } from './routeMomentVerdict'

export type TasteExperienceCompositionStatus = 'pass' | 'soft' | 'fail' | 'unavailable'

export type TasteExperienceCompositionReasonCode =
  | 'composition_requirements_missing'
  | 'composition_incomplete_route_shape'
  | 'composition_candidate_evidence_missing'
  | 'composition_weak_start_preparation'
  | 'composition_unclear_highlight_peak'
  | 'composition_weak_wind_down_resolution'
  | 'composition_excessive_energy_mismatch'
  | 'composition_contribution_mismatch'
  | 'composition_relational_mismatch'
  | 'composition_controlled_wildcard_accepted'
  | 'composition_unsupported_wildcard'
  | 'composition_taste_moment_verdict_missing'

export interface TasteExperienceCompositionCandidateEvidence {
  role: RouteShapeRole | 'surprise'
  candidateId: string
  venueName: string
  category: string
  tags: readonly string[]
  neighborhood?: string
  energyScore: number
  roleFitScore: number
  stopShapeFitScore: number
  vibeFitScore: number
  intentFitScore: number
  momentScore: number
  momentIntensityScore: number
  primaryExperienceArchetype: string
  momentIdentityType?: string
  isWildcard?: boolean
  highlightValidity?: 'valid' | 'fallback' | 'invalid' | 'unknown'
}

export interface TasteExperienceCompositionDimensionResult {
  dimension: ExperienceCompositionDimension
  status: TasteExperienceCompositionStatus
  score: number
  reasons: TasteExperienceCompositionReasonCode[]
}

export interface TasteExperienceCompositionCandidateAssessment {
  role: RouteShapeRole
  candidateId: string | null
  venueName: string | null
  requirement?: RoleCompositionRequirement
  status: TasteExperienceCompositionStatus
  score: number
  dimensions: TasteExperienceCompositionDimensionResult[]
  reasons: TasteExperienceCompositionReasonCode[]
  matchedTraits: RouteInvariantTrait[]
  missingRequiredTraits: RouteInvariantTrait[]
}

export type TasteExperienceCompositionRelationshipKind =
  | 'start_prepares_highlight'
  | 'wind_down_resolves_highlight'

export interface TasteExperienceCompositionRelationshipAssessment {
  kind: TasteExperienceCompositionRelationshipKind
  status: TasteExperienceCompositionStatus
  score: number
  sourceCandidateId: string | null
  targetCandidateId: string | null
  dimensions: TasteExperienceCompositionDimensionResult[]
  reasons: TasteExperienceCompositionReasonCode[]
}

export interface TasteExperienceCompositionPeakReference {
  source: 'taste_route_moment_verdict' | 'unavailable'
  status: TasteExperienceCompositionStatus
  score: number
  candidateId?: string
  reasons: TasteExperienceCompositionReasonCode[]
}

export interface TasteExperienceCompositionStamp {
  source: 'taste.experience_composition.v0_1'
  status: TasteExperienceCompositionStatus
  score: number
  requirementSource: 'route_shape_contract' | 'unavailable'
  routeShapeContractId?: string
  startContribution: TasteExperienceCompositionCandidateAssessment
  highlightContribution: TasteExperienceCompositionCandidateAssessment
  windDownContribution: TasteExperienceCompositionCandidateAssessment
  startPreparesHighlight: TasteExperienceCompositionRelationshipAssessment
  windDownResolvesHighlight: TasteExperienceCompositionRelationshipAssessment
  peakEvidenceReference: TasteExperienceCompositionPeakReference
  wildcard: {
    present: boolean
    controlled: boolean
    candidateIds: string[]
    reasons: TasteExperienceCompositionReasonCode[]
  }
  reasons: TasteExperienceCompositionReasonCode[]
  unavailableEvidence: TasteExperienceCompositionReasonCode[]
}

export interface ComputeTasteExperienceCompositionStampInput {
  routeShapeContract?: RouteShapeContract
  stops: readonly TasteExperienceCompositionCandidateEvidence[]
  routeMomentVerdict?: TasteRouteMomentVerdict
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(1, value))
}

function round(value: number): number {
  return Math.round(clamp01(value) * 1000) / 1000
}

function statusForScore(
  score: number,
  tolerance: RoleCompositionRequirement['tolerance'] = 'balanced',
): TasteExperienceCompositionStatus {
  const passFloor = tolerance === 'strict' ? 0.72 : tolerance === 'flexible' ? 0.62 : 0.66
  const softFloor = tolerance === 'strict' ? 0.56 : tolerance === 'flexible' ? 0.42 : 0.48
  if (score >= passFloor) {
    return 'pass'
  }
  if (score >= softFloor) {
    return 'soft'
  }
  return 'fail'
}

function weakestStatus(statuses: TasteExperienceCompositionStatus[]): TasteExperienceCompositionStatus {
  if (statuses.includes('unavailable')) return 'unavailable'
  if (statuses.includes('fail')) return 'fail'
  if (statuses.includes('soft')) return 'soft'
  return 'pass'
}

function uniqueReasons(
  reasons: readonly TasteExperienceCompositionReasonCode[],
): TasteExperienceCompositionReasonCode[] {
  return [...new Set(reasons)]
}

function getCoreStop(
  stops: readonly TasteExperienceCompositionCandidateEvidence[],
  role: RouteShapeRole,
): TasteExperienceCompositionCandidateEvidence | undefined {
  return stops.find((stop) => stop.role === role)
}

function normalizedText(stop: TasteExperienceCompositionCandidateEvidence): string {
  return [stop.category, stop.primaryExperienceArchetype, stop.momentIdentityType, ...stop.tags]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function inferTraits(stop: TasteExperienceCompositionCandidateEvidence): RouteInvariantTrait[] {
  const text = normalizedText(stop)
  const traits: RouteInvariantTrait[] = []
  if (stop.energyScore <= 0.44 || /quiet|calm|cozy|garden|tea|book|park|conversation/.test(text)) {
    traits.push('calm')
  }
  if (stop.energyScore >= 0.6 || /bar|cocktail|music|arcade|live|night|event|social/.test(text)) {
    traits.push('lively', 'social')
  }
  if (/museum|gallery|theater|theatre|jazz|book|library|culture|cultural|art/.test(text)) {
    traits.push('cultural')
  }
  if (/cafe|coffee|park|garden|walk|restaurant|dessert|patio|book/.test(text)) {
    traits.push('low_friction')
  }
  if (stop.momentScore >= 0.68 || stop.momentIntensityScore >= 0.68 || stop.highlightValidity === 'valid') {
    traits.push('centerpiece')
  }
  if (stop.role === 'windDown' || stop.energyScore <= 0.46 || /settle|linger|dessert|wine|tea|close/.test(text)) {
    traits.push('settling', 'buffer')
  }
  if (/contrast|surprise|novel|different|wildcard|explore/.test(text) || stop.isWildcard) {
    traits.push('contrast')
  }
  traits.push('continuity')
  if (/late|night|bar|cocktail/.test(text) && stop.energyScore >= 0.58) {
    traits.push('late_night')
  }
  return [...new Set(traits)]
}

function scoreTraitFit(
  stop: TasteExperienceCompositionCandidateEvidence,
  requirement: RoleCompositionRequirement,
  invariants: RouteShapeContract['roleInvariants'][RouteShapeRole],
): {
  score: number
  matchedTraits: RouteInvariantTrait[]
  missingRequiredTraits: RouteInvariantTrait[]
  reasons: TasteExperienceCompositionReasonCode[]
} {
  const traits = inferTraits(stop)
  const matchedRequired = invariants.requiredTraits.filter((trait) => traits.includes(trait))
  const missingRequiredTraits = invariants.requiredTraits.filter((trait) => !traits.includes(trait))
  const matchedPreferred = invariants.preferredTraits.filter((trait) => traits.includes(trait))
  const requiredScore =
    invariants.requiredTraits.length === 0
      ? 1
      : matchedRequired.length / invariants.requiredTraits.length
  const preferredScore =
    invariants.preferredTraits.length === 0
      ? 0.72
      : matchedPreferred.length / invariants.preferredTraits.length
  const forbiddenHit = invariants.forbiddenTraits.some((trait) => traits.includes(trait))
  const score = clamp01(requiredScore * 0.6 + preferredScore * 0.34 - (forbiddenHit ? 0.18 : 0))
  const reasons: TasteExperienceCompositionReasonCode[] = []
  if (missingRequiredTraits.length > 0 || forbiddenHit) {
    reasons.push('composition_contribution_mismatch')
  }
  if (requirement.relationship === 'performs_peak' && !traits.includes('centerpiece')) {
    reasons.push('composition_unclear_highlight_peak')
  }
  return {
    score,
    matchedTraits: [...new Set([...matchedRequired, ...matchedPreferred])],
    missingRequiredTraits,
    reasons,
  }
}

function scoreEnergyFit(
  stop: TasteExperienceCompositionCandidateEvidence,
  requirement: RoleCompositionRequirement,
  highlight?: TasteExperienceCompositionCandidateEvidence,
): number {
  const target =
    requirement.role === 'highlight'
      ? 0.72
      : requirement.role === 'start'
        ? 0.42
        : 0.36
  const targetScore = clamp01(1 - Math.abs(stop.energyScore - target) / 0.7)
  if (!highlight || requirement.role === 'highlight') {
    return targetScore
  }
  if (requirement.role === 'start') {
    return clamp01(targetScore * 0.65 + (stop.energyScore <= highlight.energyScore + 0.14 ? 0.35 : 0))
  }
  return clamp01(targetScore * 0.55 + (stop.energyScore <= highlight.energyScore ? 0.45 : 0))
}

function dimensionResult(
  dimension: ExperienceCompositionDimension,
  score: number,
  tolerance: RoleCompositionRequirement['tolerance'],
  reasons: TasteExperienceCompositionReasonCode[] = [],
): TasteExperienceCompositionDimensionResult {
  return {
    dimension,
    status: statusForScore(score, tolerance),
    score: round(score),
    reasons: uniqueReasons(reasons),
  }
}

function unavailableCandidateAssessment(role: RouteShapeRole): TasteExperienceCompositionCandidateAssessment {
  return {
    role,
    candidateId: null,
    venueName: null,
    status: 'unavailable',
    score: 0,
    dimensions: [],
    reasons: ['composition_candidate_evidence_missing'],
    matchedTraits: [],
    missingRequiredTraits: [],
  }
}

function assessCandidateContribution(params: {
  role: RouteShapeRole
  stop?: TasteExperienceCompositionCandidateEvidence
  requirement?: RoleCompositionRequirement
  invariants?: RouteShapeContract['roleInvariants'][RouteShapeRole]
  highlight?: TasteExperienceCompositionCandidateEvidence
  routeMomentVerdict?: TasteRouteMomentVerdict
}): TasteExperienceCompositionCandidateAssessment {
  const { role, stop, requirement, invariants, highlight, routeMomentVerdict } = params
  if (!stop) {
    return unavailableCandidateAssessment(role)
  }
  if (!requirement || !invariants) {
    return {
      ...unavailableCandidateAssessment(role),
      candidateId: stop.candidateId,
      venueName: stop.venueName,
      reasons: ['composition_requirements_missing'],
    }
  }

  const traitFit = scoreTraitFit(stop, requirement, invariants)
  const energyFit = scoreEnergyFit(stop, requirement, highlight)
  const peakReference =
    role === 'highlight'
      ? routeMomentVerdict
        ? clamp01(
            (routeMomentVerdict.peakSuitability.score ?? 0) * 0.62 +
              (routeMomentVerdict.strongMomentPresent ? 0.28 : 0) +
              (stop.highlightValidity === 'valid' ? 0.1 : 0),
          )
        : 0
      : 0.64
  const dimensions: TasteExperienceCompositionDimensionResult[] = requirement.dimensions.map(
    (dimension) => {
      if (dimension === 'role_fit') return dimensionResult(dimension, stop.roleFitScore, requirement.tolerance)
      if (dimension === 'intent_fit') return dimensionResult(dimension, stop.intentFitScore, requirement.tolerance)
      if (dimension === 'vibe_fit') return dimensionResult(dimension, stop.vibeFitScore, requirement.tolerance)
      if (dimension === 'peak_strength') {
        return dimensionResult(
          dimension,
          peakReference,
          requirement.tolerance,
          peakReference > 0 ? [] : ['composition_taste_moment_verdict_missing'],
        )
      }
      if (dimension === 'pacing_condition' || dimension === 'resolution_landing') {
        return dimensionResult(
          dimension,
          energyFit,
          requirement.tolerance,
          energyFit >= 0.48 ? [] : ['composition_excessive_energy_mismatch'],
        )
      }
      if (dimension === 'controlled_novelty') {
        const noveltyScore = stop.isWildcard ? 0.66 : 0.74
        return dimensionResult(dimension, noveltyScore, requirement.tolerance)
      }
      return dimensionResult(dimension, traitFit.score, requirement.tolerance, traitFit.reasons)
    },
  )
  const dimensionScore =
    dimensions.length > 0
      ? dimensions.reduce((sum, dimension) => sum + dimension.score, 0) / dimensions.length
      : 0
  const score = clamp01(
    stop.roleFitScore * 0.22 +
      stop.stopShapeFitScore * 0.18 +
      stop.vibeFitScore * 0.16 +
      stop.intentFitScore * 0.14 +
      traitFit.score * 0.14 +
      energyFit * 0.08 +
      peakReference * (role === 'highlight' ? 0.08 : 0.02) +
      dimensionScore * 0.06,
  )
  const reasons = uniqueReasons([
    ...traitFit.reasons,
    ...dimensions.flatMap((dimension) => dimension.reasons),
    ...(role === 'highlight' && !routeMomentVerdict
      ? (['composition_taste_moment_verdict_missing'] as TasteExperienceCompositionReasonCode[])
      : []),
  ])
  return {
    role,
    candidateId: stop.candidateId,
    venueName: stop.venueName,
    requirement,
    status: statusForScore(score, requirement.tolerance),
    score: round(score),
    dimensions,
    reasons,
    matchedTraits: traitFit.matchedTraits,
    missingRequiredTraits: traitFit.missingRequiredTraits,
  }
}

function sameNeighborhoodScore(
  source: TasteExperienceCompositionCandidateEvidence,
  target: TasteExperienceCompositionCandidateEvidence,
): number {
  if (!source.neighborhood || !target.neighborhood) {
    return 0.62
  }
  return source.neighborhood === target.neighborhood ? 0.82 : 0.48
}

function sharedTraitScore(
  source: TasteExperienceCompositionCandidateEvidence,
  target: TasteExperienceCompositionCandidateEvidence,
): number {
  const sourceTraits = inferTraits(source)
  const targetTraits = inferTraits(target)
  const shared = sourceTraits.filter((trait) => targetTraits.includes(trait))
  return clamp01(shared.length / Math.max(3, Math.min(sourceTraits.length, targetTraits.length)))
}

function assessRelationship(params: {
  kind: TasteExperienceCompositionRelationshipKind
  source?: TasteExperienceCompositionCandidateEvidence
  target?: TasteExperienceCompositionCandidateEvidence
  sourceAssessment: TasteExperienceCompositionCandidateAssessment
  targetAssessment: TasteExperienceCompositionCandidateAssessment
  requirement?: RoleCompositionRequirement
}): TasteExperienceCompositionRelationshipAssessment {
  const { kind, source, target, sourceAssessment, targetAssessment, requirement } = params
  if (!source || !target || !requirement) {
    return {
      kind,
      status: 'unavailable',
      score: 0,
      sourceCandidateId: source?.candidateId ?? null,
      targetCandidateId: target?.candidateId ?? null,
      dimensions: [],
      reasons: [
        !requirement ? 'composition_requirements_missing' : 'composition_candidate_evidence_missing',
      ],
    }
  }
  const continuity = clamp01(sharedTraitScore(source, target) * 0.52 + sameNeighborhoodScore(source, target) * 0.48)
  const sourceBelowTarget = source.energyScore <= target.energyScore + 0.12
  const targetResolvesSource =
    kind === 'wind_down_resolves_highlight'
      ? source.energyScore <= target.energyScore + (requirement.tolerance === 'flexible' ? 0.16 : 0)
      : sourceBelowTarget
  const energyScore = targetResolvesSource ? 0.78 : 0.28
  const sourceTraits = inferTraits(source)
  const relationTraitScore =
    kind === 'wind_down_resolves_highlight'
      ? sourceTraits.includes('settling') || sourceTraits.includes('buffer')
        ? 0.78
        : 0.46
      : sourceTraits.includes('low_friction') || sourceTraits.includes('continuity')
        ? 0.78
        : 0.46
  const score = clamp01(
    sourceAssessment.score * 0.32 +
      targetAssessment.score * 0.18 +
      continuity * 0.24 +
      energyScore * 0.16 +
      relationTraitScore * 0.1,
  )
  const reasons: TasteExperienceCompositionReasonCode[] = []
  if (score < 0.48) {
    reasons.push(
      kind === 'start_prepares_highlight'
        ? 'composition_weak_start_preparation'
        : 'composition_weak_wind_down_resolution',
    )
  }
  if (!targetResolvesSource) {
    reasons.push('composition_excessive_energy_mismatch')
  }
  if (continuity < 0.46) {
    reasons.push('composition_relational_mismatch')
  }
  const dimensions = [
    dimensionResult('relationship_continuity', continuity, requirement.tolerance, continuity < 0.46 ? ['composition_relational_mismatch'] : []),
    dimensionResult('pacing_condition', energyScore, requirement.tolerance, targetResolvesSource ? [] : ['composition_excessive_energy_mismatch']),
    dimensionResult(
      kind === 'wind_down_resolves_highlight' ? 'resolution_landing' : 'intent_fit',
      relationTraitScore,
      requirement.tolerance,
    ),
  ]
  return {
    kind,
    status: statusForScore(score, requirement.tolerance),
    score: round(score),
    sourceCandidateId: source.candidateId,
    targetCandidateId: target.candidateId,
    dimensions,
    reasons: uniqueReasons(reasons),
  }
}

function buildPeakEvidenceReference(
  highlight?: TasteExperienceCompositionCandidateEvidence,
  routeMomentVerdict?: TasteRouteMomentVerdict,
): TasteExperienceCompositionPeakReference {
  if (!highlight || !routeMomentVerdict) {
    return {
      source: 'unavailable',
      status: 'unavailable',
      score: 0,
      reasons: ['composition_taste_moment_verdict_missing'],
    }
  }
  const score = clamp01(
    routeMomentVerdict.peakSuitability.score * 0.7 +
      (routeMomentVerdict.strongMomentPresent ? 0.2 : 0) +
      (highlight.highlightValidity === 'valid' ? 0.1 : 0),
  )
  return {
    source: 'taste_route_moment_verdict',
    status: statusForScore(score),
    score: round(score),
    candidateId: highlight.candidateId,
    reasons: score >= 0.48 ? [] : ['composition_unclear_highlight_peak'],
  }
}

export function computeTasteExperienceCompositionStamp(
  input: ComputeTasteExperienceCompositionStampInput,
): TasteExperienceCompositionStamp {
  const start = getCoreStop(input.stops, 'start')
  const highlight = getCoreStop(input.stops, 'highlight')
  const windDown = getCoreStop(input.stops, 'windDown')
  const routeShapeContract = input.routeShapeContract
  const wildcardStops = input.stops.filter((stop) => stop.isWildcard || stop.role === 'surprise')
  const wildcardReasons: TasteExperienceCompositionReasonCode[] =
    wildcardStops.length === 0
      ? []
      : wildcardStops.length === 1
        ? ['composition_controlled_wildcard_accepted']
        : ['composition_unsupported_wildcard']

  const startContribution = assessCandidateContribution({
    role: 'start',
    stop: start,
    requirement: routeShapeContract?.roleProfile.start.compositionRequirement,
    invariants: routeShapeContract?.roleInvariants.start,
    highlight,
    routeMomentVerdict: input.routeMomentVerdict,
  })
  const highlightContribution = assessCandidateContribution({
    role: 'highlight',
    stop: highlight,
    requirement: routeShapeContract?.roleProfile.highlight.compositionRequirement,
    invariants: routeShapeContract?.roleInvariants.highlight,
    highlight,
    routeMomentVerdict: input.routeMomentVerdict,
  })
  const windDownContribution = assessCandidateContribution({
    role: 'windDown',
    stop: windDown,
    requirement: routeShapeContract?.roleProfile.windDown.compositionRequirement,
    invariants: routeShapeContract?.roleInvariants.windDown,
    highlight,
    routeMomentVerdict: input.routeMomentVerdict,
  })
  const startPreparesHighlight = assessRelationship({
    kind: 'start_prepares_highlight',
    source: start,
    target: highlight,
    sourceAssessment: startContribution,
    targetAssessment: highlightContribution,
    requirement: routeShapeContract?.roleProfile.start.compositionRequirement,
  })
  const windDownResolvesHighlight = assessRelationship({
    kind: 'wind_down_resolves_highlight',
    source: windDown,
    target: highlight,
    sourceAssessment: windDownContribution,
    targetAssessment: highlightContribution,
    requirement: routeShapeContract?.roleProfile.windDown.compositionRequirement,
  })
  const peakEvidenceReference = buildPeakEvidenceReference(highlight, input.routeMomentVerdict)
  const reasons = uniqueReasons([
    ...startContribution.reasons,
    ...highlightContribution.reasons,
    ...windDownContribution.reasons,
    ...startPreparesHighlight.reasons,
    ...windDownResolvesHighlight.reasons,
    ...peakEvidenceReference.reasons,
    ...wildcardReasons,
  ])
  const statuses = [
    startContribution.status,
    highlightContribution.status,
    windDownContribution.status,
    startPreparesHighlight.status,
    windDownResolvesHighlight.status,
    peakEvidenceReference.status,
  ]
  const baseStatus = weakestStatus(statuses)
  const status =
    wildcardStops.length > 1
      ? 'fail'
      : baseStatus === 'pass' && wildcardStops.length === 1
        ? 'soft'
        : baseStatus
  const availableScores = [
    startContribution.score,
    highlightContribution.score,
    windDownContribution.score,
    startPreparesHighlight.score,
    windDownResolvesHighlight.score,
    peakEvidenceReference.score,
  ].filter((score) => score > 0)
  const score =
    availableScores.length > 0
      ? availableScores.reduce((sum, value) => sum + value, 0) / availableScores.length
      : 0
  const unavailableEvidence = reasons.filter(
    (reason) =>
      reason === 'composition_requirements_missing' ||
      reason === 'composition_candidate_evidence_missing' ||
      reason === 'composition_taste_moment_verdict_missing',
  )

  return {
    source: 'taste.experience_composition.v0_1',
    status,
    score: round(score),
    requirementSource: routeShapeContract ? 'route_shape_contract' : 'unavailable',
    routeShapeContractId: routeShapeContract?.id,
    startContribution,
    highlightContribution,
    windDownContribution,
    startPreparesHighlight,
    windDownResolvesHighlight,
    peakEvidenceReference,
    wildcard: {
      present: wildcardStops.length > 0,
      controlled: wildcardStops.length <= 1,
      candidateIds: wildcardStops.map((stop) => stop.candidateId),
      reasons: wildcardReasons,
    },
    reasons,
    unavailableEvidence: uniqueReasons(unavailableEvidence),
  }
}
