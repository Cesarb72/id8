import {
  computeRolePoolCandidateMeaningEvidence,
  computeRolePoolMeaningContextEvidence,
  computeRolePoolMeaningEvidence,
  type RolePoolMeaningCandidateEvidence,
  type RolePoolMeaningCandidateInput,
  type RolePoolMeaningContextEvidence,
  type RolePoolMeaningContextInput,
  type RolePoolMeaningEvidence,
} from './computeRolePoolMeaningEvidence'
import type {
  TasteRolePoolCandidateMeaningEvidence,
  TasteRolePoolMeaningView,
} from './tasteRolePoolMeaningView'
import type { TasteRouteMeaningStopRole } from './routeMeaningVerdict'
import type { ScoredVenue } from '../../types/arc'
import type { Venue } from '../../types/venue'

export interface TasteRolePoolMeaningCandidateRequest {
  role?: TasteRouteMeaningStopRole
  candidate: RolePoolMeaningCandidateInput
}

export interface ComputeTasteRolePoolMeaningViewInput {
  context: RolePoolMeaningContextInput
  candidates: readonly TasteRolePoolMeaningCandidateRequest[]
}

export interface ComputeTasteRolePoolMeaningViewResult {
  view: TasteRolePoolMeaningView
  foundation: readonly RolePoolMeaningEvidence[]
}

function buildRoleSuitabilityMeaning(
  evidence: RolePoolMeaningEvidence,
): TasteRolePoolCandidateMeaningEvidence<'role_suitability_meaning'> {
  return {
    source: 'taste',
    kind: 'role_suitability_meaning',
    candidateVenueId: evidence.candidate.candidateVenueId,
    role: evidence.role,
    candidateEvidence: evidence.candidate,
    rolePoolEvidence: evidence.rolePoolEvidence,
  }
}

function buildEasyHangMeaning(
  evidence: RolePoolMeaningEvidence,
): TasteRolePoolCandidateMeaningEvidence<'easy_hang_meaning'> {
  return {
    source: 'taste',
    kind: 'easy_hang_meaning',
    candidateVenueId: evidence.candidate.candidateVenueId,
    role: evidence.role,
    compatibility: evidence.rolePoolEvidence.easyHangCompatibility,
    reasons: evidence.candidate.hardIncompatibleSignals,
    candidateEvidence: evidence.candidate,
    rolePoolEvidence: evidence.rolePoolEvidence,
  }
}

function buildRomanticRoleMeaning(
  evidence: RolePoolMeaningEvidence,
): TasteRolePoolCandidateMeaningEvidence<'romantic_role_meaning'> {
  return {
    source: 'taste',
    kind: 'romantic_role_meaning',
    candidateVenueId: evidence.candidate.candidateVenueId,
    role: evidence.role,
    compatibility:
      evidence.candidate.romantic.cozyCompatible ||
      evidence.candidate.romantic.livelyCompatible
        ? 'compatible'
        : 'partial',
    components: evidence.rolePoolEvidence.romanticEvidence,
    candidateEvidence: evidence.candidate,
    rolePoolEvidence: evidence.rolePoolEvidence,
  }
}

function buildFamilyRoleMeaning(
  evidence: RolePoolMeaningEvidence,
): TasteRolePoolCandidateMeaningEvidence<'family_role_meaning'> {
  return {
    source: 'taste',
    kind: 'family_role_meaning',
    candidateVenueId: evidence.candidate.candidateVenueId,
    role: evidence.role,
    compatibility: evidence.candidate.family.nightlifeConflict
      ? 'conflict'
      : evidence.candidate.family.boundedEnergyCompatible
        ? 'compatible'
        : 'partial',
    components: evidence.rolePoolEvidence.familyEvidence,
    candidateEvidence: evidence.candidate,
    rolePoolEvidence: evidence.rolePoolEvidence,
  }
}

function buildCategoryArchetypeMeaning(
  evidence: RolePoolMeaningEvidence,
): TasteRolePoolCandidateMeaningEvidence<'category_archetype_meaning'> {
  return {
    source: 'taste',
    kind: 'category_archetype_meaning',
    candidateVenueId: evidence.candidate.candidateVenueId,
    role: evidence.role,
    components: evidence.rolePoolEvidence.categoryVibeEvidence,
    candidateEvidence: evidence.candidate,
    rolePoolEvidence: evidence.rolePoolEvidence,
  }
}

function buildPeakWorthinessMeaning(
  evidence: RolePoolMeaningEvidence,
): TasteRolePoolCandidateMeaningEvidence<'peak_worthiness'> {
  const peakWorthiness = evidence.candidate.peakWorthiness

  return {
    source: 'taste',
    kind: 'peak_worthiness',
    candidateVenueId: evidence.candidate.candidateVenueId,
    role: evidence.role,
    score: peakWorthiness.score,
    strength: peakWorthiness.candidatePeakSuitability,
    reasons: peakWorthiness.reasons,
    components: peakWorthiness.components,
    candidateEvidence: evidence.candidate,
    rolePoolEvidence: evidence.rolePoolEvidence,
  }
}

function buildCentralMomentQualityMeaning(
  evidence: RolePoolMeaningEvidence,
): TasteRolePoolCandidateMeaningEvidence<'central_moment_quality'> {
  const centralMomentQuality = evidence.candidate.centralMomentQuality

  return {
    source: 'taste',
    kind: 'central_moment_quality',
    candidateVenueId: evidence.candidate.candidateVenueId,
    role: evidence.role,
    score: centralMomentQuality.score,
    compatibility:
      centralMomentQuality.status === 'central_moment'
        ? 'compatible'
        : centralMomentQuality.status === 'possible_central_moment'
          ? 'partial'
          : 'conflict',
    reasons: centralMomentQuality.reasons,
    components: centralMomentQuality.components,
    candidateEvidence: evidence.candidate,
    rolePoolEvidence: evidence.rolePoolEvidence,
  }
}

function buildExpressionActivationMeaning(
  evidence: RolePoolMeaningEvidence,
): TasteRolePoolCandidateMeaningEvidence<'expression_activation_meaning'> {
  const expressionActivation = evidence.candidate.expressionActivation

  return {
    source: 'taste',
    kind: 'expression_activation_meaning',
    candidateVenueId: evidence.candidate.candidateVenueId,
    role: evidence.role,
    score: Math.max(
      expressionActivation.activationQuality,
      expressionActivation.expressionQuality,
    ),
    components: [
      {
        source: 'taste',
        key: 'candidate_energy',
        label: 'Candidate energy',
        value: expressionActivation.energy,
      },
      {
        source: 'taste',
        key: 'candidate_social_density',
        label: 'Candidate social density',
        value: expressionActivation.socialDensity,
      },
      {
        source: 'taste',
        key: 'candidate_interactive_strength',
        label: 'Candidate interactive strength',
        value: expressionActivation.interactiveStrength,
      },
      {
        source: 'taste',
        key: 'candidate_moment_intensity',
        label: 'Candidate moment intensity',
        value: expressionActivation.momentIntensity,
      },
      {
        source: 'taste',
        key: 'candidate_moment_potential',
        label: 'Candidate moment potential',
        value: expressionActivation.momentPotential,
      },
      {
        source: 'taste',
        key: 'candidate_anchor_strength',
        label: 'Candidate anchor strength',
        value: expressionActivation.anchorStrength,
      },
      {
        source: 'taste',
        key: 'candidate_activation_quality',
        label: 'Candidate activation quality',
        value: expressionActivation.activationQuality,
      },
      {
        source: 'taste',
        key: 'candidate_expression_quality',
        label: 'Candidate expression quality',
        value: expressionActivation.expressionQuality,
      },
    ],
    candidateEvidence: evidence.candidate,
    rolePoolEvidence: evidence.rolePoolEvidence,
  }
}

function groupByRole(
  candidates: readonly TasteRolePoolCandidateMeaningEvidence[],
): TasteRolePoolMeaningView['rolePools'] {
  const rolePools: NonNullable<TasteRolePoolMeaningView['rolePools']> = {}

  for (const candidate of candidates) {
    if (!candidate.role) {
      continue
    }
    rolePools[candidate.role] = [...(rolePools[candidate.role] ?? []), candidate]
  }

  return rolePools
}

export function computeTasteRolePoolMeaningView(
  input: ComputeTasteRolePoolMeaningViewInput,
): ComputeTasteRolePoolMeaningViewResult {
  const contextEvidence = computeRolePoolMeaningContextEvidence(input.context)
  const foundation = input.candidates.map((entry) =>
    computeRolePoolMeaningEvidence({
      role: entry.role,
      context: input.context,
      candidate: entry.candidate,
    }),
  )
  const candidates = foundation.flatMap((evidence) => [
    buildRoleSuitabilityMeaning(evidence),
    buildEasyHangMeaning(evidence),
    buildRomanticRoleMeaning(evidence),
    buildFamilyRoleMeaning(evidence),
    buildCategoryArchetypeMeaning(evidence),
    buildPeakWorthinessMeaning(evidence),
    buildCentralMomentQualityMeaning(evidence),
    buildExpressionActivationMeaning(evidence),
  ])

  return {
    foundation,
    view: {
      source: 'taste',
      scope: 'candidate_set_pre_coordination',
      provenance: [
        {
          source: 'taste',
          key: 'computeRolePoolMeaningEvidence',
          label: 'Taste role-pool meaning evidence',
        },
      ],
      context: {
        source: 'taste',
        contextInput: input.context,
        contextEvidence,
      },
      candidates,
      rolePools: groupByRole(candidates),
      foundation,
    },
  }
}

export function computeTasteRolePoolMeaningForCandidate(input: {
  role?: TasteRouteMeaningStopRole
  context: RolePoolMeaningContextInput
  candidate: RolePoolMeaningCandidateInput
}): RolePoolMeaningEvidence {
  return computeTasteRolePoolMeaningView({
    context: input.context,
    candidates: [{ role: input.role, candidate: input.candidate }],
  }).foundation[0]!
}

export function toTasteRolePoolMeaningCandidateInput(
  candidate: ScoredVenue,
): RolePoolMeaningCandidateInput {
  const signals = candidate.taste.signals

  return {
    candidateVenueId: candidate.candidateIdentity.baseVenueId,
    category: candidate.venue.category,
    subcategory: candidate.venue.subcategory,
    tags: candidate.venue.tags,
    vibeTags: candidate.venue.vibeTags,
    energy: signals.energy,
    socialDensity: signals.socialDensity,
    intimacy: signals.intimacy,
    lingerFactor: signals.lingerFactor,
    destinationFactor: signals.destinationFactor,
    experientialFactor: signals.experientialFactor,
    conversationFriendliness: signals.conversationFriendliness,
    interactiveStrength: signals.interactiveStrength,
    durationEstimate: signals.durationEstimate,
    roleSuitability: signals.roleSuitability,
    momentIntensityScore: signals.momentIntensity.score,
    momentPotentialScore: signals.momentPotential.score,
    anchorStrength: signals.anchorStrength,
    primaryExperienceArchetype: signals.primaryExperienceArchetype,
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function durationClassToEstimate(
  durationClass: Venue['durationProfile']['durationClass'],
): string {
  if (durationClass === 'XS' || durationClass === 'S') {
    return 'quick'
  }
  if (durationClass === 'L' || durationClass === 'XL') {
    return 'extended'
  }
  return 'standard'
}

function durationClassToLingerFactor(
  durationClass: Venue['durationProfile']['durationClass'],
): number {
  return {
    XS: 0.28,
    S: 0.42,
    M: 0.58,
    L: 0.74,
    XL: 0.88,
  }[durationClass]
}

export function toTasteRolePoolMeaningCandidateInputFromVenue(
  venue: Venue,
): RolePoolMeaningCandidateInput {
  const energy = clamp01(venue.energyLevel / 5)
  const socialDensity = clamp01(venue.socialDensity / 5)
  const lingerFactor = durationClassToLingerFactor(venue.durationProfile.durationClass)
  const destinationFactor = clamp01(
    venue.signature.signatureScore * 0.62 +
      venue.distinctivenessScore * 0.18 +
      (venue.highlightCapable ? 0.08 : 0),
  )
  const experientialFactor = clamp01(
    venue.distinctivenessScore * 0.34 +
      venue.uniquenessScore * 0.22 +
      venue.shareabilityScore * 0.14 +
      (venue.settings.eventCapable ||
      venue.settings.musicCapable ||
      venue.settings.performanceCapable
        ? 0.1
        : 0) +
      (venue.highlightCapable ? 0.08 : 0),
  )
  const conversationFriendliness = clamp01(
    0.62 +
      (venue.settings.dateFriendly ? 0.1 : 0) +
      (venue.category === 'cafe' || venue.category === 'dessert' || venue.category === 'park'
        ? 0.08
        : 0) -
      energy * 0.22 -
      socialDensity * 0.12 -
      (venue.settings.musicCapable ? 0.06 : 0),
  )

  return {
    candidateVenueId: venue.id,
    category: venue.category,
    subcategory: venue.subcategory,
    tags: venue.tags,
    vibeTags: venue.vibeTags,
    energy,
    socialDensity,
    intimacy: clamp01(
      0.56 +
        (venue.settings.dateFriendly ? 0.12 : 0) +
        (venue.category === 'cafe' || venue.category === 'dessert' || venue.category === 'park'
          ? 0.08
          : 0) -
        socialDensity * 0.3 -
        energy * 0.18,
    ),
    lingerFactor,
    destinationFactor,
    experientialFactor,
    conversationFriendliness,
    interactiveStrength: clamp01(
      (venue.settings.eventCapable ? 0.32 : 0) +
        (venue.settings.performanceCapable ? 0.24 : 0) +
        (venue.settings.musicCapable ? 0.18 : 0) +
        socialDensity * 0.18 +
        energy * 0.08,
    ),
    durationEstimate: durationClassToEstimate(venue.durationProfile.durationClass),
    roleSuitability: {
      start: venue.roleAffinity.warmup,
      highlight: venue.roleAffinity.peak,
      windDown: venue.roleAffinity.cooldown,
      surprise: venue.roleAffinity.wildcard,
    },
    momentIntensityScore: clamp01(
      venue.shareabilityScore * 0.28 +
        venue.uniquenessScore * 0.2 +
        experientialFactor * 0.2 +
        socialDensity * 0.16 +
        energy * 0.16,
    ),
    momentPotentialScore: clamp01(
      venue.distinctivenessScore * 0.28 +
        venue.uniquenessScore * 0.24 +
        venue.shareabilityScore * 0.18 +
        destinationFactor * 0.16 +
        experientialFactor * 0.14,
    ),
    anchorStrength: clamp01(
      venue.localSignals.localFavoriteScore * 0.34 +
        venue.localSignals.neighborhoodPrideScore * 0.22 +
        venue.signature.signatureScore * 0.26 +
        venue.distinctivenessScore * 0.18,
    ),
  }
}

export function computeTasteRolePoolMeaningForVenue(input: {
  role?: TasteRouteMeaningStopRole
  venue: Venue
}): RolePoolMeaningEvidence {
  return computeTasteRolePoolMeaningForCandidate({
    role: input.role,
    context: {},
    candidate: toTasteRolePoolMeaningCandidateInputFromVenue(input.venue),
  })
}

export function computeTasteRolePoolContextMeaning(
  input: RolePoolMeaningContextInput,
): RolePoolMeaningContextEvidence {
  return computeRolePoolMeaningContextEvidence(input)
}

export function computeTasteRolePoolCandidateMeaning(
  input: RolePoolMeaningCandidateInput,
): RolePoolMeaningCandidateEvidence {
  return computeRolePoolCandidateMeaningEvidence(input)
}
