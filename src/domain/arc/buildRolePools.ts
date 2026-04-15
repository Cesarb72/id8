import type { ScoredVenue } from '../types/arc'
import type { CrewPolicy } from '../types/crewPolicies'
import type {
  ExperienceLens,
  LensStopRole,
} from '../types/experienceLens'
import type { IntentProfile } from '../types/intent'
import type { ContractConstraints, ExperienceContract } from '../types/intent'
import type {
  AnchorHoursRelaxationReason,
  RoleContractPoolStatus,
  RoleContractRule,
  RoleContractSet,
  RoleContractStrength,
} from '../types/roleContract'
import { detectTemporalMode } from '../constraints/detectTemporalMode'
import {
  isRomanticPersonaContractActive,
  requiresRomanticPersonaMoment,
  scopeRomanticHighlightCandidatesByMomentTier,
  satisfiesRomanticPersonaHighlightContract,
} from '../contracts/romanticPersonaContract'
import {
  isCandidateWithinActiveDistanceWindow,
  isMeaningfulMomentStretchCandidate,
  isOutsideStrictNearbyButWithinBoundedStretch,
  isWithinStrictNearbyWindow,
} from '../constraints/localStretchPolicy'
import { computeHybridLiveLift } from '../retrieval/computeHybridLiveLift'
import { computeRoleAwareHoursPressure } from '../retrieval/computeRoleAwareHoursPressure'
import { computeRoleAwareLiveLift } from '../retrieval/computeRoleAwareLiveLift'
import {
  getHighlightArchetypeLift,
  getMomentIntensityTierBoost,
} from '../taste/experienceSignals'
import type { TasteMomentIdentity } from '../interpretation/taste/types'
import type { InternalRole } from '../types/venue'
import type { PreferredDiscoveryAdmissionRejectionReason } from '../types/roleContract'
import {
  getScoredVenueBaseVenueId,
  getScoredVenueCandidateId,
} from '../candidates/candidateIdentity'

export interface RolePools {
  warmup: ScoredVenue[]
  peak: ScoredVenue[]
  wildcard: ScoredVenue[]
  cooldown: ScoredVenue[]
  contractPoolStatus: Record<InternalRole, RoleContractPoolStatus>
}

export interface RolePoolRankingBreakdown {
  score: number
  roleFitContribution: number
  tasteContribution: number
  tasteRoleSuitabilityContribution: number
  momentContribution: number
  highlightPlausibilityContribution: number
  modeAlignmentContribution: number
  modeAlignmentPenaltyContribution: number
  discoveryPreferenceContribution: number
  fitContribution: number
  lensContribution: number
  stopShapeContribution: number
  vibeContribution: number
  contextContribution: number
  dominancePenaltyContribution: number
  highlightValidityContribution: number
  contractBonusContribution: number
  contractPenaltyContribution: number
  rolePoolLiftContribution: number
  roleLiftContribution: number
  rolePromotionContribution: number
  cooldownPreferenceContribution: number
}

export const roleThresholds: Record<InternalRole, number> = {
  warmup: 0.56,
  peak: 0.63,
  wildcard: 0.57,
  cooldown: 0.6,
}

const CENTRAL_MOMENT_MIN_INTENSITY = 0.52
const CENTRAL_MOMENT_MIN_QUALITY = 0.56
const CENTRAL_MOMENT_RECOVERY_BOOST = 0.06
const CENTRAL_MOMENT_FAMILY_ALIGNMENT_BOOST = 0.04
const CENTRAL_MOMENT_FAMILY_MISMATCH_PENALTY = 0.04

export function roleToLensStop(role: InternalRole): LensStopRole {
  if (role === 'warmup') {
    return 'start'
  }
  if (role === 'peak') {
    return 'highlight'
  }
  if (role === 'wildcard') {
    return 'surprise'
  }
  return 'windDown'
}

function defaultRoleContractRule(role: LensStopRole): RoleContractRule {
  return {
    label: `Default ${role} contract`,
    role,
    strength: 'none',
    requiredCategories: [],
    preferredCategories: [],
    discouragedCategories: [],
    requiredTags: [],
    preferredTags: [],
    discouragedTags: [],
  }
}

function strengthRank(value: RoleContractStrength): number {
  if (value === 'none') {
    return 0
  }
  if (value === 'soft') {
    return 1
  }
  if (value === 'strong') {
    return 2
  }
  return 3
}

function contractMinCount(role: InternalRole, strictShapeEnabled: boolean): number {
  const base = role === 'peak' ? 3 : role === 'cooldown' ? 2 : 1
  return strictShapeEnabled ? base + 1 : base
}

function contractWeight(
  role: InternalRole,
  strength: RoleContractStrength,
): {
  boost: number
  penalty: number
} {
  if (strength === 'none') {
    return { boost: 0, penalty: 0 }
  }
  const strengthWeight = strength === 'soft' ? 0.45 : strength === 'strong' ? 1 : 1.2
  const boostBase = role === 'peak' ? 0.24 : role === 'cooldown' ? 0.18 : role === 'warmup' ? 0.14 : 0.08
  const penaltyBase =
    role === 'peak' ? 0.32 : role === 'cooldown' ? 0.26 : role === 'warmup' ? 0.2 : 0.14
  return {
    boost: boostBase * strengthWeight,
    penalty: penaltyBase * strengthWeight,
  }
}

function getPreferredDiscoveryVenueId(
  intent: IntentProfile | undefined,
  role: InternalRole,
): string | undefined {
  const preferredRole =
    role === 'warmup'
      ? 'start'
      : role === 'peak'
        ? 'highlight'
        : role === 'cooldown'
          ? 'windDown'
          : undefined
  if (!preferredRole) {
    return undefined
  }
  return intent?.discoveryPreferences?.find(
    (preference) => preference.role === preferredRole,
  )?.venueId
}

function getAnchorVenueId(
  intent: IntentProfile | undefined,
  role: InternalRole,
): string | undefined {
  if (intent?.planningMode !== 'user-led' || !intent.anchor?.venueId) {
    return undefined
  }

  const anchorRole = intent.anchor.role ?? 'highlight'
  if (
    (role === 'warmup' && anchorRole === 'start') ||
    (role === 'peak' && anchorRole === 'highlight') ||
    (role === 'cooldown' && anchorRole === 'windDown')
  ) {
    return intent.anchor.venueId
  }

  return undefined
}

function markRoleCandidate(
  candidate: ScoredVenue,
  intent: IntentProfile | undefined,
  role: InternalRole,
): ScoredVenue {
  return getAnchorVenueId(intent, role) === getScoredVenueBaseVenueId(candidate)
    ? { ...candidate, isAnchor: true }
    : candidate
}

function isBaseRoleCandidate(
  item: ScoredVenue,
  role: InternalRole,
  lensRole: LensStopRole,
  crewPolicy: CrewPolicy,
  minRoleScore: number,
  minLensCompatibility: number,
  minShapeFit: number,
  minHighlightVibeFit: number,
  cooldownMaxEnergy: number,
): boolean {
  const peakMomentException =
    role === 'peak' &&
    item.taste.signals.momentPotential.score >= 0.62 &&
    (item.taste.signals.primaryExperienceArchetype === 'outdoor' ||
      item.taste.signals.primaryExperienceArchetype === 'scenic' ||
      item.taste.signals.primaryExperienceArchetype === 'activity' ||
      item.taste.signals.primaryExperienceArchetype === 'culture' ||
      item.taste.signals.primaryExperienceArchetype === 'social')
  if (item.roleScores[role] < minRoleScore) {
    return false
  }
  if (item.lensCompatibility < (peakMomentException ? minLensCompatibility - 0.08 : minLensCompatibility)) {
    return false
  }
  if (item.stopShapeFit[lensRole] < (peakMomentException ? minShapeFit - 0.12 : minShapeFit)) {
    return false
  }
  if (
    role === 'peak' &&
    item.vibeAuthority.byRole.highlight <
      (peakMomentException ? minHighlightVibeFit - 0.16 : minHighlightVibeFit)
  ) {
    return false
  }
  if (crewPolicy.blockedCategories.includes(item.venue.category)) {
    return false
  }
  if (role === 'cooldown' && item.venue.energyLevel > cooldownMaxEnergy) {
    return false
  }
  return true
}

export function getRolePoolForRole(role: InternalRole, pools: RolePools): ScoredVenue[] {
  if (role === 'warmup') {
    return pools.warmup
  }
  if (role === 'peak') {
    return pools.peak
  }
  if (role === 'wildcard') {
    return pools.wildcard
  }
  return pools.cooldown
}

export function computeRolePoolRankingBreakdown(
  candidate: ScoredVenue,
  role: InternalRole,
  lens: ExperienceLens,
  intent?: IntentProfile,
): RolePoolRankingBreakdown {
  const lensRole = roleToLensStop(role)
  const roleSpecificityWeight = role === 'peak' ? 0.24 : 0.18
  const roleDominanceWeight = role === 'peak' ? 0.24 : 0.18
  const liveLift = computeHybridLiveLift(candidate.venue)
  const roleAwareLiveLift = computeRoleAwareLiveLift(candidate, role)
  const tasteInfluence = candidate.taste.rolePoolInfluence[role]
  const contract = candidate.roleContract[role]
  const contractInfluence = contractWeight(role, contract.strength)
  const momentContribution =
    getMomentRolePreference(candidate.momentIdentity, role) *
    (role === 'peak' ? 0.4 : role === 'cooldown' ? 0.18 : role === 'warmup' ? 0.16 : 0.1)
  const highlightValidityContribution =
    role === 'peak'
      ? candidate.highlightValidity.validityLevel === 'valid'
        ? 0.34
        : candidate.highlightValidity.validityLevel === 'fallback'
          ? 0.09
          : -0.5
      : 0
  const cooldownPreferenceContribution =
    role === 'cooldown' &&
    lens.windDownExpectation.preferredCategories.includes(candidate.venue.category)
      ? 0.08
      : 0
  const discoveryPreference = intent?.discoveryPreferences?.find(
    (preference) => preference.venueId === getScoredVenueBaseVenueId(candidate),
  )
  const discoveryPreferenceContribution = discoveryPreference
    ? discoveryPreference.role === 'highlight' && role === 'peak'
      ? 0.42
      : discoveryPreference.role === 'start' && role === 'warmup'
        ? 0.32
        : discoveryPreference.role === 'windDown' && role === 'cooldown'
          ? 0.32
          : -0.12
    : 0

  const roleFitContribution = candidate.roleScores[role] * 0.45
  const highlightMomentContribution =
    role === 'peak'
      ? candidate.taste.signals.momentPotential.score * 0.32 +
        candidate.taste.signals.momentIntensity.score * 0.14 +
        getMomentIntensityTierBoost(candidate.taste.signals.momentIntensity) * 0.9
      : role === 'wildcard'
        ? candidate.taste.signals.momentPotential.score * 0.06 +
          candidate.taste.signals.momentIntensity.score * 0.03
        : 0
  const highlightArchetypeContribution =
    role === 'peak'
      ? getHighlightArchetypeLift(
          candidate.taste.signals,
          lens.tasteMode?.id,
        ) * 1.8
      : 0
  const genericFallbackPenaltyContribution =
    role === 'peak'
      ? candidate.taste.fallbackPenalty.appliedPenalty * 1.6
      : 0
  const passivePeakArchetype =
    role === 'peak' &&
    (candidate.taste.signals.primaryExperienceArchetype === 'dining' ||
      candidate.taste.signals.primaryExperienceArchetype === 'drinks' ||
      candidate.taste.signals.primaryExperienceArchetype === 'sweet')
  const modeSpecificPassiveHighlightPenalty =
    role === 'peak' &&
    (lens.tasteMode?.id === 'activity-led' || lens.tasteMode?.id === 'scenic-outdoor') &&
    passivePeakArchetype &&
    candidate.taste.signals.momentPotential.score < 0.55
      ? 0.18
      : 0
  const tasteContribution = tasteInfluence.tasteBonus + highlightMomentContribution
  const tasteRoleSuitabilityContribution =
    tasteInfluence.roleSuitabilityContribution
  const highlightPlausibilityContribution =
    role === 'peak'
      ? tasteInfluence.highlightPlausibilityBonus +
        tasteInfluence.momentContribution +
        highlightArchetypeContribution -
        genericFallbackPenaltyContribution -
        modeSpecificPassiveHighlightPenalty
      : 0
  const modeAlignmentContribution = tasteInfluence.modeAlignmentContribution
  const modeAlignmentPenaltyContribution = tasteInfluence.modeAlignmentPenalty
  const roleAlignmentWeight =
    role === 'peak' ? 1.72 : role === 'warmup' ? 1.28 : role === 'wildcard' ? 1.06 : 1
  const fitContribution = candidate.fitScore * 0.18
  const lensContribution = candidate.lensCompatibility * 0.22
  const stopShapeContribution = candidate.stopShapeFit[lensRole] * 0.15
  const vibeContribution =
    candidate.vibeAuthority.byRole[lensRole] * (role === 'peak' ? 0.34 : 0.16)
  const contextContribution = candidate.contextSpecificity.byRole[role] * roleSpecificityWeight
  const dominancePenaltyContribution =
    candidate.dominanceControl.byRole[role] * roleDominanceWeight
  const contractBonusContribution = contract.score * contractInfluence.boost
  const contractPenaltyContribution = contract.satisfied
    ? 0
    : (1 - contract.score) * contractInfluence.penalty
  const rolePoolLiftContribution = liveLift.rolePoolLift
  const roleLiftContribution = liveLift.roleLiftByRole[role]
  const rolePromotionContribution = roleAwareLiveLift.promotion

  const score =
    roleFitContribution +
    tasteContribution +
    highlightPlausibilityContribution +
    modeAlignmentContribution * roleAlignmentWeight -
    modeAlignmentPenaltyContribution * roleAlignmentWeight +
    discoveryPreferenceContribution +
    fitContribution +
    lensContribution +
    stopShapeContribution +
    vibeContribution +
    contextContribution -
    dominancePenaltyContribution +
    momentContribution +
    highlightValidityContribution +
    contractBonusContribution -
    contractPenaltyContribution +
    rolePoolLiftContribution +
    roleLiftContribution +
    rolePromotionContribution +
    cooldownPreferenceContribution

  return {
    score,
    roleFitContribution,
    tasteContribution,
    tasteRoleSuitabilityContribution,
    momentContribution,
    highlightPlausibilityContribution,
    modeAlignmentContribution,
    modeAlignmentPenaltyContribution,
    discoveryPreferenceContribution,
    fitContribution,
    lensContribution,
    stopShapeContribution,
    vibeContribution,
    contextContribution,
    dominancePenaltyContribution,
    highlightValidityContribution,
    contractBonusContribution,
    contractPenaltyContribution,
    rolePoolLiftContribution,
    roleLiftContribution,
    rolePromotionContribution,
    cooldownPreferenceContribution,
  }
}

export function computeRolePoolRankingScore(
  candidate: ScoredVenue,
  role: InternalRole,
  lens: ExperienceLens,
  intent?: IntentProfile,
): number {
  return computeRolePoolRankingBreakdown(candidate, role, lens, intent).score
}

interface RoleCandidateSelection {
  candidates: ScoredVenue[]
  status: RoleContractPoolStatus
}

interface PreferredRoleAdmissionDecision {
  preferredVenueId?: string
  admittedCandidate?: ScoredVenue
  rejectedReason?: PreferredDiscoveryAdmissionRejectionReason
  hoursRelaxed?: boolean
  hoursRelaxationReason?: AnchorHoursRelaxationReason
}

function isPreferredRoleCandidateFeasible(
  candidate: ScoredVenue,
  role: InternalRole,
  lensRole: LensStopRole,
  crewPolicy: CrewPolicy,
): boolean {
  if (
    !isBaseRoleCandidate(
      candidate,
      role,
      lensRole,
      crewPolicy,
      roleThresholds[role] - 0.13,
      0.24,
      0.24,
      0.28,
      4,
    )
  ) {
    return false
  }
  if (role === 'peak' && candidate.highlightValidity.validityLevel === 'invalid') {
    return false
  }
  return true
}

function isPeakHighlightFeasibleCandidate(
  candidate: ScoredVenue,
  intent?: IntentProfile,
): boolean {
  const anchoredPeakVenueId = getAnchorVenueId(intent, 'peak')
  const hardContractConflict =
    candidate.roleContract.peak.strength === 'hard' && !candidate.roleContract.peak.satisfied
  if (anchoredPeakVenueId && anchoredPeakVenueId !== getScoredVenueBaseVenueId(candidate)) {
    return false
  }
  if (candidate.highlightValidity.validityLevel === 'invalid') {
    return false
  }
  if (intent && !isCandidateWithinActiveDistanceWindow(candidate, intent, { allowMeaningfulStretch: true })) {
    return false
  }
  if (!intent && candidate.fitBreakdown.proximityFit < 0.48) {
    return false
  }
  if (isPreferredRoleHoursInfeasible(candidate, 'peak')) {
    return false
  }
  if (
    candidate.highlightValidity.personaVetoes.length > 0 ||
    candidate.highlightValidity.contextVetoes.length > 0 ||
    candidate.highlightValidity.violations.length > 0 ||
    hardContractConflict
  ) {
    return false
  }
  return candidate.roleScores.peak >= 0.58 && candidate.stopShapeFit.highlight >= 0.34
}

function isFeasibleStrongPeakMomentCandidate(
  candidate: ScoredVenue,
  intent?: IntentProfile,
): boolean {
  return (
    isPeakHighlightFeasibleCandidate(candidate, intent) &&
    candidate.momentIdentity.strength === 'strong' &&
    (candidate.momentIdentity.type === 'anchor' ||
      candidate.momentIdentity.type === 'explore')
  )
}

function isWarmupAnchorConflict(
  candidate: ScoredVenue,
  intent?: IntentProfile,
): boolean {
  if (intent?.planningMode !== 'user-led' || !intent.anchor?.venueId) {
    return false
  }

  const anchorRole = intent.anchor.role ?? 'highlight'
  return anchorRole === 'start' && intent.anchor.venueId !== getScoredVenueBaseVenueId(candidate)
}

function isFeasibleRomanticMomentPoolCandidate(
  candidate: ScoredVenue,
  intent?: IntentProfile,
): boolean {
  if (!candidate.taste.signals.isRomanticMomentCandidate) {
    return false
  }
  if (intent && !isCandidateWithinActiveDistanceWindow(candidate, intent, { allowMeaningfulStretch: true })) {
    return false
  }
  if (!intent && candidate.fitBreakdown.proximityFit < 0.48) {
    return false
  }

  const highlightFeasible = isPeakHighlightFeasibleCandidate(candidate, intent)
  const warmupFeasible =
    !isWarmupAnchorConflict(candidate, intent) &&
    !isPreferredRoleHoursInfeasible(candidate, 'warmup') &&
    candidate.roleScores.warmup >= roleThresholds.warmup - 0.02 &&
    candidate.stopShapeFit.start >= 0.3 &&
    candidate.momentIdentity.type !== 'close'
  const wildcardFeasible =
    !isPreferredRoleHoursInfeasible(candidate, 'wildcard') &&
    candidate.roleScores.wildcard >= roleThresholds.wildcard - 0.02 &&
    candidate.stopShapeFit.surprise >= 0.44

  return highlightFeasible || warmupFeasible || wildcardFeasible
}

function isGenericHospitalityHighlightCandidate(candidate: ScoredVenue): boolean {
  const archetype = candidate.taste.signals.primaryExperienceArchetype
  return (
    archetype === 'dining' ||
    archetype === 'drinks' ||
    archetype === 'sweet' ||
    candidate.venue.category === 'restaurant' ||
    candidate.venue.category === 'cafe' ||
    candidate.venue.category === 'dessert' ||
    candidate.venue.category === 'bar'
  )
}

function isFeasibleRomanticHighlightPoolCandidate(
  candidate: ScoredVenue,
  lens: ExperienceLens,
  intent?: IntentProfile,
): boolean {
  return (
    satisfiesRomanticPersonaHighlightContract(candidate, lens) &&
    isPeakHighlightFeasibleCandidate(candidate, intent)
  )
}

function getRomanticHighlightSupportSelectionBias(
  candidate: ScoredVenue,
  role: InternalRole,
  feasibleRomanticHighlights: ScoredVenue[],
): number {
  if (role !== 'warmup' || feasibleRomanticHighlights.length === 0) {
    return 0
  }

  const maximumPeakEnergy = Math.max(
    ...feasibleRomanticHighlights.map((romanticHighlight) => romanticHighlight.venue.energyLevel),
  )
  const sameNeighborhood = feasibleRomanticHighlights.some(
    (romanticHighlight) => romanticHighlight.venue.neighborhood === candidate.venue.neighborhood,
  )
  const nearestDriveGap = Math.min(
    ...feasibleRomanticHighlights.map((romanticHighlight) =>
      Math.abs(romanticHighlight.venue.driveMinutes - candidate.venue.driveMinutes),
    ),
  )
  const archetype = candidate.taste.signals.primaryExperienceArchetype
  const softSupportArchetype =
    archetype === 'drinks' ||
    archetype === 'sweet' ||
    archetype === 'culture' ||
    archetype === 'social' ||
    candidate.venue.category === 'cafe' ||
    candidate.venue.category === 'dessert'

  if (candidate.venue.energyLevel > maximumPeakEnergy) {
    return -0.18
  }

  return (
    0.1 +
    (sameNeighborhood ? 0.08 : nearestDriveGap <= 3 ? 0.05 : nearestDriveGap <= 6 ? 0.02 : 0) +
    (softSupportArchetype ? 0.06 : 0) -
    (candidate.taste.signals.isRomanticMomentCandidate ? 0.06 : 0) -
    (archetype === 'dining' ? 0.08 : 0)
  )
}

function getExperienceFamily(candidate: ScoredVenue): string {
  return candidate.taste.signals.experienceFamily
}

function areDirectionFamiliesCompatible(
  selectedFamily: string,
  highlightFamily: string,
): boolean {
  if (selectedFamily === highlightFamily) {
    return true
  }
  const compatibleFamilies: Record<string, string[]> = {
    social: ['eventful', 'playful'],
    cultural: ['ritual', 'exploratory', 'ambient'],
    playful: ['social', 'exploratory', 'eventful'],
    intimate: ['ambient', 'ritual', 'indulgent'],
    exploratory: ['playful', 'cultural', 'ambient'],
    ambient: ['intimate', 'ritual', 'exploratory', 'indulgent'],
    eventful: ['social', 'playful'],
    ritual: ['intimate', 'cultural', 'indulgent', 'ambient'],
    indulgent: ['intimate', 'ritual', 'ambient'],
  }
  return compatibleFamilies[selectedFamily]?.includes(highlightFamily) ?? false
}

function getCentralMomentFamilyAdjustment(
  candidate: ScoredVenue,
  intent?: IntentProfile,
): number {
  const selectedFamily = intent?.selectedDirectionContext?.family
  const selectedFamilyConfidence = intent?.selectedDirectionContext?.familyConfidence ?? 0
  if (!selectedFamily || selectedFamilyConfidence < 0.58) {
    return 0
  }
  const candidateFamily = getExperienceFamily(candidate)
  if (candidateFamily === selectedFamily) {
    return CENTRAL_MOMENT_FAMILY_ALIGNMENT_BOOST
  }
  if (areDirectionFamiliesCompatible(selectedFamily, candidateFamily)) {
    return CENTRAL_MOMENT_FAMILY_ALIGNMENT_BOOST * 0.65
  }
  return -CENTRAL_MOMENT_FAMILY_MISMATCH_PENALTY
}

function isRecoverableCentralMomentHighlightCandidate(
  candidate: ScoredVenue,
  intent?: IntentProfile,
): boolean {
  const hardContractConflict =
    candidate.roleContract.peak.strength === 'hard' && !candidate.roleContract.peak.satisfied
  if (hardContractConflict) {
    return false
  }
  if (
    candidate.highlightValidity.validityLevel === 'invalid' ||
    isPreferredRoleHoursInfeasible(candidate, 'peak')
  ) {
    return false
  }
  if (
    intent &&
    !isCandidateWithinActiveDistanceWindow(candidate, intent, {
      allowMeaningfulStretch: true,
    })
  ) {
    return false
  }
  if (!intent && candidate.fitBreakdown.proximityFit < 0.4) {
    return false
  }
  if (
    candidate.taste.signals.momentIntensity.score < CENTRAL_MOMENT_MIN_INTENSITY ||
    candidate.fitScore < CENTRAL_MOMENT_MIN_QUALITY
  ) {
    return false
  }
  if (
    candidate.roleScores.peak < roleThresholds.peak - 0.11 ||
    candidate.stopShapeFit.highlight < 0.28
  ) {
    return false
  }
  const weakGenericCandidate =
    isGenericHospitalityHighlightCandidate(candidate) &&
    candidate.taste.signals.momentPotential.score < 0.56 &&
    candidate.taste.signals.anchorStrength < 0.54 &&
    candidate.contextSpecificity.byRole.peak < 0.44
  if (weakGenericCandidate) {
    return false
  }
  const coherentIdentity =
    candidate.taste.signals.anchorStrength >= 0.52 ||
    candidate.taste.signals.categorySpecificity >= 0.54 ||
    candidate.taste.signals.personalityStrength >= 0.56 ||
    candidate.contextSpecificity.byRole.peak >= 0.44
  return coherentIdentity
}

function computeRomanticCenterpieceConviction(candidate: ScoredVenue): number {
  const signals = candidate.taste.signals
  const enrichment = signals.momentEnrichment
  const atmosphericDepth = Math.max(
    signals.romanticSignals.ambiance,
    signals.romanticSignals.ambientExperience,
    enrichment.ambientUniqueness,
  )
  const destinationFeel = Math.max(
    signals.destinationFactor,
    signals.anchorStrength,
    signals.momentPotential.score,
  )
  const lingerGravity = Math.max(
    signals.lingerFactor,
    (signals.lingerFactor + signals.conversationFriendliness) / 2,
  )
  const memorability = Math.max(
    candidate.venue.uniquenessScore,
    candidate.venue.distinctivenessScore,
    signals.momentIntensity.score,
  )
  return Math.max(
    0,
    Math.min(
      1,
      destinationFeel * 0.28 +
        atmosphericDepth * 0.22 +
        lingerGravity * 0.14 +
        memorability * 0.18 +
        Math.max(candidate.venue.underexposureScore, candidate.hiddenGemScore) * 0.1,
    ),
  )
}

function computeRoleSelectionScore(params: {
  candidate: ScoredVenue
  role: InternalRole
  lens: ExperienceLens
  intent?: IntentProfile
  hasFeasibleStrongPeakMoment: boolean
  hasFeasibleRomanticMoment: boolean
  feasibleRomanticHighlights: ScoredVenue[]
  localSupplySufficient: boolean
  strictNearbyFailed: boolean
}): number {
  const peakBias =
    params.role === 'peak'
      ? getPeakMomentPriority(params.candidate, params.lens) +
        getPeakStrongMomentSelectionBias(
          params.candidate,
          params.intent,
          params.hasFeasibleStrongPeakMoment,
        )
      : 0
  const energyBias =
    params.role === 'warmup'
      ? getWarmupEnergySelectionBias(params.candidate, params.hasFeasibleStrongPeakMoment)
      : params.role === 'cooldown'
        ? getCooldownEnergySelectionBias(params.candidate)
        : 0
  const romanticBias = getRomanticMomentSelectionBias(
    params.candidate,
    params.role,
    params.lens,
    params.intent,
    params.hasFeasibleRomanticMoment,
  )
  const stretchBias = getLocalStretchSelectionBias(
    params.candidate,
    params.role,
    params.intent,
    params.localSupplySufficient,
    params.strictNearbyFailed,
  )
  const romanticSupportBias = getRomanticHighlightSupportSelectionBias(
    params.candidate,
    params.role,
    params.feasibleRomanticHighlights,
  )

  return (
    computeRolePoolRankingScore(params.candidate, params.role, params.lens, params.intent) +
    peakBias +
    energyBias +
    romanticBias +
    romanticSupportBias +
    stretchBias
  )
}

function selectPeakCandidatesWithFamilyPreservation(
  rankedCandidates: ScoredVenue[],
  selectionScoreByCandidateId: Map<string, number>,
  limit: number,
): ScoredVenue[] {
  if (rankedCandidates.length <= limit) {
    return rankedCandidates.slice(0, limit)
  }

  const initial = rankedCandidates.slice(0, limit)
  const availableFamilies = new Set(
    rankedCandidates.slice(0, Math.min(rankedCandidates.length, limit + 8)).map(getExperienceFamily),
  )
  if (availableFamilies.size <= 1) {
    return initial
  }

  const rankIndexByCandidateId = new Map(
    rankedCandidates.map((candidate, index) => [getScoredVenueCandidateId(candidate), index] as const),
  )
  const familyCounts = new Map<string, number>()
  for (const candidate of initial) {
    const family = getExperienceFamily(candidate)
    familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1)
  }

  const bestScore =
    selectionScoreByCandidateId.get(getScoredVenueCandidateId(rankedCandidates[0]!)) ?? 0
  const familyLeaders = new Map<string, ScoredVenue>()
  for (const candidate of rankedCandidates.slice(0, Math.min(rankedCandidates.length, limit + 8))) {
    const family = getExperienceFamily(candidate)
    if (familyLeaders.has(family)) {
      continue
    }
    familyLeaders.set(family, candidate)
  }

  const alternateFamilyLeaders = [...familyLeaders.values()]
    .filter((candidate) => {
      if (
        initial.some(
          (selected) =>
            getScoredVenueCandidateId(selected) === getScoredVenueCandidateId(candidate),
        )
      ) {
        return false
      }
      if (familyCounts.has(getExperienceFamily(candidate))) {
        return false
      }
      const scoreGap =
        bestScore -
        (selectionScoreByCandidateId.get(getScoredVenueCandidateId(candidate)) ?? 0)
      return (
        scoreGap <= 0.18 &&
        candidate.taste.signals.momentIntensity.score >= 0.68 &&
        candidate.taste.signals.momentPotential.score >= 0.56 &&
        candidate.roleScores.peak >= roleThresholds.peak - 0.03 &&
        candidate.stopShapeFit.highlight >= 0.34
      )
    })
    .sort((left, right) => {
      return (
        (selectionScoreByCandidateId.get(getScoredVenueCandidateId(right)) ?? 0) -
          (selectionScoreByCandidateId.get(getScoredVenueCandidateId(left)) ?? 0) ||
        (rankIndexByCandidateId.get(getScoredVenueCandidateId(left)) ?? 0) -
          (rankIndexByCandidateId.get(getScoredVenueCandidateId(right)) ?? 0)
      )
    })
    .slice(0, 2)

  if (alternateFamilyLeaders.length === 0) {
    return initial
  }

  const selected = [...initial]
  const selectedIds = new Set(selected.map((candidate) => getScoredVenueCandidateId(candidate)))
  for (const leader of alternateFamilyLeaders) {
    if (selectedIds.has(getScoredVenueCandidateId(leader))) {
      continue
    }

    let replacementIndex = -1
    for (let index = selected.length - 1; index > 0; index -= 1) {
      const candidate = selected[index]
      const family = getExperienceFamily(candidate)
      if (candidate.isAnchor || (familyCounts.get(family) ?? 0) <= 1) {
        continue
      }
      replacementIndex = index
      break
    }

    if (replacementIndex === -1) {
      continue
    }

    const removed = selected[replacementIndex]
    const removedFamily = getExperienceFamily(removed)
    familyCounts.set(removedFamily, Math.max(0, (familyCounts.get(removedFamily) ?? 1) - 1))
    selectedIds.delete(getScoredVenueCandidateId(removed))
    selected[replacementIndex] = leader
    const leaderFamily = getExperienceFamily(leader)
    familyCounts.set(leaderFamily, (familyCounts.get(leaderFamily) ?? 0) + 1)
    selectedIds.add(getScoredVenueCandidateId(leader))
  }

  return selected.sort((left, right) => {
    return (
      (rankIndexByCandidateId.get(getScoredVenueCandidateId(left)) ?? 0) -
      (rankIndexByCandidateId.get(getScoredVenueCandidateId(right)) ?? 0)
    )
  })
}

function getPeakStrongMomentSelectionBias(
  candidate: ScoredVenue,
  intent: IntentProfile | undefined,
  hasFeasibleStrongPeakMoment: boolean,
): number {
  if (isFeasibleStrongPeakMomentCandidate(candidate, intent)) {
    const archetype = candidate.taste.signals.primaryExperienceArchetype
    const cozyRomanticMode =
      intent?.persona === 'romantic' && intent.primaryAnchor === 'cozy'
    const experientialArchetypeBoost =
      cozyRomanticMode
        ? archetype === 'dining' || archetype === 'drinks'
          ? 0.1
          : archetype === 'culture' || archetype === 'social'
            ? 0.08
            : archetype === 'activity' || archetype === 'scenic'
              ? 0.06
              : archetype === 'outdoor'
                ? 0.04
                : 0
        : archetype === 'activity' || archetype === 'scenic'
          ? 0.1
          : archetype === 'outdoor' || archetype === 'culture'
            ? 0.08
            : archetype === 'social'
              ? 0.05
              : 0
    return (
      0.24 +
      candidate.taste.signals.momentPotential.score * 0.08 +
      candidate.taste.signals.momentIntensity.score * 0.08 +
      getMomentIntensityTierBoost(candidate.taste.signals.momentIntensity) * 0.8 +
      experientialArchetypeBoost
    )
  }

  if (!hasFeasibleStrongPeakMoment || !isPeakHighlightFeasibleCandidate(candidate, intent)) {
    return 0
  }

  const archetype = candidate.taste.signals.primaryExperienceArchetype
  const passiveHospitalityFallback =
    archetype === 'dining' || archetype === 'drinks' || archetype === 'sweet'
  const weakMomentPenalty =
    candidate.momentIdentity.strength === 'medium'
      ? candidate.momentIdentity.type === 'anchor' ||
        candidate.momentIdentity.type === 'explore'
        ? 0.04
        : 0.08
      : 0.12
  const passiveFallbackPenalty =
    passiveHospitalityFallback
      ? candidate.taste.signals.momentPotential.score < 0.62
        ? 0.14
        : 0.08
      : 0
  const lowIntensityPenalty =
    candidate.taste.signals.momentIntensity.tier === 'standard'
      ? 0.05
      : candidate.taste.signals.momentIntensity.tier === 'strong'
        ? 0.02
        : 0

  return -(weakMomentPenalty + passiveFallbackPenalty + lowIntensityPenalty)
}

function getRomanticMomentSelectionBias(
  candidate: ScoredVenue,
  role: InternalRole,
  lens: ExperienceLens,
  intent: IntentProfile | undefined,
  hasFeasibleRomanticMoment: boolean,
): number {
  if (!requiresRomanticPersonaMoment(lens) || !hasFeasibleRomanticMoment) {
    return 0
  }

  const archetype = candidate.taste.signals.primaryExperienceArchetype
  const candidateIsRomantic =
    role === 'peak'
      ? isFeasibleRomanticHighlightPoolCandidate(candidate, lens, intent)
      : isFeasibleRomanticMomentPoolCandidate(candidate, intent)

  if (candidateIsRomantic) {
    if (role === 'peak') {
      const conviction = computeRomanticCenterpieceConviction(candidate)
      const cozyRomanticMode =
        intent?.persona === 'romantic' && intent.primaryAnchor === 'cozy'
      const experientialArchetypeBoost =
        cozyRomanticMode
          ? archetype === 'dining' || archetype === 'drinks'
            ? 0.09
            : archetype === 'culture' || archetype === 'social'
              ? 0.06
              : archetype === 'activity' || archetype === 'scenic'
                ? 0.03
                : archetype === 'outdoor'
                  ? 0.02
                  : 0
          : archetype === 'activity' || archetype === 'scenic'
            ? 0.06
            : archetype === 'outdoor' || archetype === 'culture'
              ? 0.04
              : archetype === 'social'
                ? 0.02
                : 0
      const convictionBias =
        cozyRomanticMode
          ? conviction >= 0.66
            ? 0.08 + (conviction - 0.66) * 0.12
            : -0.08 - (0.66 - conviction) * 0.08
          : 0
      return (
        0.24 +
        candidate.taste.signals.momentPotential.score * 0.1 +
        candidate.taste.signals.momentIntensity.score * 0.08 +
        getMomentIntensityTierBoost(candidate.taste.signals.momentIntensity) * 0.6 +
        (candidate.momentIdentity.type === 'anchor' ||
        candidate.momentIdentity.type === 'explore'
          ? 0.08
          : 0) +
        experientialArchetypeBoost +
        convictionBias
      )
    }
    if (role === 'warmup') {
      return (
        0.04 +
        (candidate.momentIdentity.type === 'arrival' ||
        candidate.momentIdentity.type === 'explore' ||
        candidate.momentIdentity.type === 'transition'
          ? 0.03
          : 0)
      )
    }
    if (role === 'wildcard') {
      return (
        0.08 +
        candidate.taste.signals.momentPotential.score * 0.04 +
        candidate.taste.signals.momentIntensity.score * 0.03
      )
    }
    return 0.02
  }

  if (role !== 'peak') {
    return 0
  }

  if (!isPeakHighlightFeasibleCandidate(candidate, intent)) {
    return 0
  }
  if (candidate.taste.signals.isRomanticMomentCandidate) {
    return 0
  }
  if (!isGenericHospitalityHighlightCandidate(candidate)) {
    return 0
  }

  const cocktailBarPenalty =
    candidate.venue.category === 'bar' || candidate.venue.tags.includes('cocktails') ? 0.05 : 0
  const lowMomentPenalty =
    candidate.taste.signals.momentPotential.score < 0.64
      ? 0.05
      : candidate.taste.signals.momentPotential.score < 0.72
        ? 0.03
        : 0
  const lowIntensityPenalty =
    candidate.taste.signals.momentIntensity.tier === 'standard'
      ? 0.05
      : candidate.taste.signals.momentIntensity.tier === 'strong'
        ? 0.02
        : 0
  const weakPeakMomentPenalty =
    candidate.momentIdentity.type === 'anchor' || candidate.momentIdentity.type === 'explore'
      ? candidate.momentIdentity.strength === 'strong'
        ? 0
        : 0.03
      : 0.06

  return -(
    0.18 +
    cocktailBarPenalty +
    lowMomentPenalty +
    lowIntensityPenalty +
    weakPeakMomentPenalty
  )
}

function getLocalStretchSelectionBias(
  candidate: ScoredVenue,
  role: InternalRole,
  intent: IntentProfile | undefined,
  localSupplySufficient: boolean,
  strictNearbyFailed: boolean,
): number {
  if (
    role !== 'peak' ||
    !intent ||
    intent.distanceMode !== 'nearby' ||
    !isOutsideStrictNearbyButWithinBoundedStretch(candidate.venue.driveMinutes, intent.distanceMode)
  ) {
    return 0
  }

  if (!isMeaningfulMomentStretchCandidate(candidate, intent)) {
    return -0.24
  }

  if (strictNearbyFailed) {
    return 0.18 + candidate.taste.signals.momentPotential.score * 0.06
  }

  return localSupplySufficient ? -0.2 : -0.08
}

function getWarmupEnergySelectionBias(
  candidate: ScoredVenue,
  hasFeasibleStrongPeakMoment: boolean,
): number {
  if (!hasFeasibleStrongPeakMoment) {
    return 0
  }

  const momentIdentity = candidate.momentIdentity
  const archetype = candidate.taste.signals.primaryExperienceArchetype
  const softClosingMoment =
    (momentIdentity.type === 'close' || momentIdentity.type === 'linger') &&
    momentIdentity.strength !== 'strong'
  const arrivalExploreMoment =
    momentIdentity.type === 'arrival' || momentIdentity.type === 'explore'
  const interactiveLight =
    archetype === 'activity' &&
    candidate.venue.energyLevel <= 3 &&
    momentIdentity.strength !== 'strong'
  const socialEntry =
    archetype === 'social' &&
    (momentIdentity.type === 'arrival' ||
      momentIdentity.type === 'explore' ||
      momentIdentity.type === 'transition')
  const casualActivity =
    (candidate.venue.category === 'activity' || archetype === 'activity') &&
    candidate.venue.energyLevel <= 3

  return (
    (arrivalExploreMoment ? 0.13 : 0) +
    (interactiveLight ? 0.08 : 0) +
    (socialEntry ? 0.05 : 0) +
    (casualActivity ? 0.045 : 0) -
    (softClosingMoment ? 0.2 : 0)
  )
}

function getCooldownEnergySelectionBias(candidate: ScoredVenue): number {
  const momentIdentity = candidate.momentIdentity
  const closeLingerBoost =
    momentIdentity.type === 'close'
      ? 0.11
      : momentIdentity.type === 'linger'
        ? 0.08
        : 0
  const secondPeakPenalty =
    (momentIdentity.type === 'anchor' || momentIdentity.type === 'explore') &&
    momentIdentity.strength === 'strong'
      ? 0.16
      : (momentIdentity.type === 'anchor' || momentIdentity.type === 'explore') &&
          momentIdentity.strength === 'medium'
        ? 0.05
        : 0

  return closeLingerBoost - secondPeakPenalty
}

function getPeakMomentPriority(
  candidate: ScoredVenue,
  lens: ExperienceLens,
): number {
  if (
    lens.tasteMode?.id !== 'activity-led' &&
    lens.tasteMode?.id !== 'scenic-outdoor' &&
    lens.tasteMode?.id !== 'highlight-centered'
  ) {
    return 0
  }

  const archetype = candidate.taste.signals.primaryExperienceArchetype
  const experientialArchetypeBoost =
    archetype === 'activity' || archetype === 'scenic'
      ? 0.24
      : archetype === 'outdoor' || archetype === 'culture'
        ? 0.2
        : archetype === 'social'
          ? 0.12
          : 0
  const passiveHospitalityPenalty =
    archetype === 'dining' || archetype === 'drinks' || archetype === 'sweet'
      ? 0.18
      : 0

  return (
    candidate.taste.signals.momentPotential.score * 0.58 +
    candidate.taste.signals.momentIntensity.score * 0.24 +
    getMomentIntensityTierBoost(candidate.taste.signals.momentIntensity) * 0.8 +
    (candidate.momentIdentity.strength === 'strong'
      ? 0.18
      : candidate.momentIdentity.strength === 'medium'
        ? 0.05
        : -0.08) +
    (candidate.momentIdentity.type === 'anchor'
      ? 0.18
      : candidate.momentIdentity.type === 'explore'
        ? 0.14
        : candidate.momentIdentity.type === 'transition'
          ? -0.06
          : -0.1) +
    experientialArchetypeBoost -
    passiveHospitalityPenalty
  )
}

function getMomentRolePreference(
  momentIdentity: TasteMomentIdentity,
  role: InternalRole,
): number {
  const typeWeight =
    role === 'warmup'
      ? momentIdentity.type === 'arrival'
        ? 1
        : momentIdentity.type === 'explore'
          ? 0.82
          : momentIdentity.type === 'transition'
            ? 0.74
            : momentIdentity.type === 'linger'
              ? 0.5
              : momentIdentity.type === 'close'
                ? 0.34
                : 0.28
      : role === 'peak'
        ? momentIdentity.type === 'anchor'
          ? 1
          : momentIdentity.type === 'explore'
            ? 0.88
            : momentIdentity.type === 'transition'
              ? 0.56
              : momentIdentity.type === 'linger'
                ? 0.42
                : momentIdentity.type === 'arrival'
                  ? 0.36
                  : 0.3
        : role === 'cooldown'
          ? momentIdentity.type === 'close'
            ? 1
            : momentIdentity.type === 'linger'
              ? 0.9
              : momentIdentity.type === 'transition'
                ? 0.62
                : momentIdentity.type === 'arrival'
                  ? 0.38
                  : momentIdentity.type === 'explore'
                    ? 0.32
                    : 0.24
          : momentIdentity.type === 'explore'
            ? 0.94
            : momentIdentity.type === 'transition'
              ? 0.82
              : momentIdentity.type === 'anchor'
                ? 0.62
                : momentIdentity.type === 'linger'
                  ? 0.5
                  : momentIdentity.type === 'arrival'
                    ? 0.48
                    : 0.34
  const strengthAdjustment =
    role === 'warmup'
      ? momentIdentity.strength === 'light'
        ? 0.12
        : momentIdentity.strength === 'medium'
          ? 0.08
          : -0.05
      : role === 'peak'
        ? momentIdentity.strength === 'strong'
          ? 0.2
          : momentIdentity.strength === 'medium'
            ? 0.06
            : -0.14
        : role === 'cooldown'
          ? momentIdentity.strength === 'light'
            ? 0.12
            : momentIdentity.strength === 'medium'
              ? 0.08
              : -0.08
          : momentIdentity.strength === 'strong'
            ? 0.04
            : momentIdentity.strength === 'medium'
              ? 0.04
              : 0
  return Math.max(0, Math.min(1, typeWeight + strengthAdjustment))
}

function isPreferredRoleHoursInfeasible(
  candidate: ScoredVenue,
  role: InternalRole,
): boolean {
  if (
    candidate.venue.source.businessStatus === 'temporarily-closed' ||
    candidate.venue.source.businessStatus === 'closed-permanently'
  ) {
    return true
  }
  if (candidate.venue.source.sourceOrigin !== 'live') {
    return false
  }

  const roleHours = computeRoleAwareHoursPressure(candidate.venue, role)
  if (
    !candidate.venue.source.likelyOpenForCurrentWindow &&
    candidate.venue.source.timeConfidence >= (role === 'peak' ? 0.68 : 0.82)
  ) {
    return true
  }

  return role === 'peak' ? roleHours.penalty >= 0.18 : roleHours.penalty >= 0.05
}

function isAnchorCandidateForRole(
  candidate: ScoredVenue,
  role: InternalRole,
  intent?: IntentProfile,
): boolean {
  return getAnchorVenueId(intent, role) === getScoredVenueBaseVenueId(candidate)
}

function shouldRelaxAnchorHoursRejection(
  candidate: ScoredVenue,
  role: InternalRole,
  intent?: IntentProfile,
): boolean {
  if (
    !intent ||
    intent.planningMode !== 'user-led' ||
    detectTemporalMode(intent) === 'explicit' ||
    !isAnchorCandidateForRole(candidate, role, intent)
  ) {
    return false
  }

  if (
    candidate.venue.source.businessStatus === 'temporarily-closed' ||
    candidate.venue.source.businessStatus === 'closed-permanently'
  ) {
    return false
  }

  return candidate.venue.source.sourceOrigin === 'live'
}

function isPreferredRoleContextIncompatible(
  candidate: ScoredVenue,
  role: InternalRole,
  crewPolicy: CrewPolicy,
): boolean {
  if (crewPolicy.blockedCategories.includes(candidate.venue.category)) {
    return true
  }

  if (candidate.lensCompatibility < 0.18) {
    return true
  }

  if (role !== 'peak') {
    return false
  }

  const vetoReason = candidate.highlightValidity.vetoReason?.toLowerCase() ?? ''
  if (
    vetoReason.includes('closed for the current planning window') ||
    vetoReason.includes('temporarily-closed') ||
    vetoReason.includes('closed-permanently')
  ) {
    return false
  }

  return (
    candidate.highlightValidity.personaVetoes.length > 0 ||
    candidate.highlightValidity.contextVetoes.length > 0
  )
}

function isPreferredRoleStructuralMismatch(
  candidate: ScoredVenue,
  role: InternalRole,
  lensRole: LensStopRole,
): boolean {
  if (candidate.stopShapeFit[lensRole] < 0.16) {
    return true
  }

  if (role === 'cooldown' && candidate.venue.energyLevel > 4) {
    return true
  }

  if (role !== 'peak') {
    return false
  }

  return (
    candidate.highlightValidity.candidateTier === 'connective-only' ||
    (Boolean(candidate.highlightValidity.packLiteralRequirementLabel) &&
      !candidate.highlightValidity.packLiteralRequirementSatisfied &&
      candidate.highlightValidity.validityLevel === 'invalid')
  )
}

function isPreferredRoleSeverelyIncompatible(
  candidate: ScoredVenue,
  role: InternalRole,
): boolean {
  if (candidate.roleScores[role] < roleThresholds[role] - 0.18) {
    return true
  }

  if (role !== 'peak') {
    return (
      candidate.roleContract[role].strength === 'hard' &&
      !candidate.roleContract[role].satisfied
    )
  }

  if (candidate.highlightValidity.validityLevel !== 'invalid') {
    return false
  }

  return candidate.highlightValidity.candidateTier !== 'connective-only'
}

function evaluatePreferredRoleAdmission(
  candidate: ScoredVenue | undefined,
  role: InternalRole,
  lensRole: LensStopRole,
  crewPolicy: CrewPolicy,
  intent?: IntentProfile,
): PreferredRoleAdmissionDecision {
  const preferredVenueId = candidate ? getScoredVenueBaseVenueId(candidate) : undefined

  if (!candidate) {
    return { preferredVenueId }
  }

  if (isPreferredRoleHoursInfeasible(candidate, role)) {
    if (shouldRelaxAnchorHoursRejection(candidate, role, intent)) {
      return {
        preferredVenueId,
        admittedCandidate: candidate,
        hoursRelaxed: true,
        hoursRelaxationReason: 'no_explicit_time',
      }
    }
    return { preferredVenueId, rejectedReason: 'rejected_hours' }
  }

  if (isPreferredRoleContextIncompatible(candidate, role, crewPolicy)) {
    return { preferredVenueId, rejectedReason: 'rejected_context' }
  }

  if (isPreferredRoleStructuralMismatch(candidate, role, lensRole)) {
    return { preferredVenueId, rejectedReason: 'rejected_structure' }
  }

  if (
    !isPreferredRoleCandidateFeasible(candidate, role, lensRole, crewPolicy) ||
    isPreferredRoleSeverelyIncompatible(candidate, role)
  ) {
    return { preferredVenueId, rejectedReason: 'rejected_role_fit' }
  }

  return {
    preferredVenueId,
    admittedCandidate: candidate,
  }
}

function clampContractScore(value: number): number {
  return Math.max(-0.42, Math.min(0.42, value))
}

function computeContractRolePressure(params: {
  candidate: ScoredVenue
  role: InternalRole
  contractConstraints?: ContractConstraints
  experienceContract?: ExperienceContract
}): { scoreAdjustment: number; hardReject: boolean } {
  const { candidate, role, contractConstraints, experienceContract } = params
  if (!contractConstraints || !experienceContract) {
    return { scoreAdjustment: 0, hardReject: false }
  }

  const signals = candidate.taste.signals
  const socialDensity = signals.socialDensity
  const energy = signals.energy
  const intimacy = signals.intimacy
  const linger = signals.lingerFactor
  const destination = signals.destinationFactor
  const experiential = signals.experientialFactor
  const windDownFit = signals.roleSuitability.windDown
  const startFit = signals.roleSuitability.start
  const highlightFit = signals.roleSuitability.highlight
  const momentIntensity = signals.momentIntensity.score
  const category = candidate.venue.category
  const driveMinutes = candidate.venue.driveMinutes
  const tags = new Set(candidate.venue.tags.map((tag) => tag.toLowerCase()))
  const nightlifeLike =
    energy * 0.45 +
    socialDensity * 0.4 +
    ((category === 'bar' || category === 'live_music' || tags.has('late-night')) ? 0.15 : 0)
  const calmness =
    (1 - energy) * 0.35 +
    (1 - socialDensity) * 0.2 +
    intimacy * 0.2 +
    linger * 0.15 +
    signals.conversationFriendliness * 0.1
  const quickStopLeaning =
    signals.durationEstimate === 'quick' ||
    (linger < 0.34 && destination < 0.52 && experiential < 0.56)

  let scoreAdjustment = 0
  let hardReject = false

  if (role === 'warmup') {
    scoreAdjustment += (startFit - 0.5) * 0.18
    scoreAdjustment += (signals.conversationFriendliness - 0.5) * 0.12
    if (contractConstraints.requireContinuity) {
      scoreAdjustment += (calmness - 0.5) * 0.12
    }
    if (contractConstraints.socialDensityBand === 'low' && socialDensity > 0.78) {
      scoreAdjustment -= 0.16
    }
    if (contractConstraints.socialDensityBand === 'high' && socialDensity < 0.34) {
      scoreAdjustment -= 0.08
    }
    if (
      (contractConstraints.movementTolerance === 'contained' ||
        contractConstraints.movementTolerance === 'compressed') &&
      driveMinutes > 26
    ) {
      scoreAdjustment -= 0.12
      if (driveMinutes > 34 && contractConstraints.requireContinuity) {
        hardReject = true
      }
    }
    if (
      experienceContract.persona === 'romantic' &&
      (experienceContract.vibe === 'cozy' || experienceContract.vibe === 'chill')
    ) {
      scoreAdjustment += (intimacy - 0.5) * 0.12
      scoreAdjustment += (linger - 0.5) * 0.08
      if (nightlifeLike > 0.86 && quickStopLeaning) {
        hardReject = true
      }
    }
    if (experienceContract.persona === 'friends' && experienceContract.vibe === 'lively') {
      const basecampLike =
        category === 'restaurant' || category === 'bar' || category === 'cafe' || category === 'activity'
      scoreAdjustment += basecampLike ? 0.08 : 0
    }
    if (experienceContract.persona === 'family') {
      scoreAdjustment += (calmness - 0.5) * 0.16
      if (nightlifeLike > 0.88 && socialDensity > 0.82) {
        hardReject = true
      }
    }
  }

  if (role === 'peak') {
    if (contractConstraints.highlightPressure === 'strong') {
      scoreAdjustment += (Math.max(destination, experiential) - 0.5) * 0.26
    } else if (contractConstraints.highlightPressure === 'distributed') {
      scoreAdjustment += (signals.roleSuitability.highlight - 0.5) * 0.14
      scoreAdjustment += (signals.socialDensity - 0.5) * 0.08
    } else {
      scoreAdjustment += (highlightFit - 0.5) * 0.12
    }

    if (contractConstraints.peakCountModel === 'single') {
      scoreAdjustment += (Math.max(destination, experiential) - 0.5) * 0.12
      if (quickStopLeaning) {
        scoreAdjustment -= 0.1
      }
    } else if (contractConstraints.peakCountModel === 'multi') {
      scoreAdjustment += (energy - 0.5) * 0.12
      scoreAdjustment += (momentIntensity - 0.5) * 0.1
    } else if (contractConstraints.peakCountModel === 'distributed') {
      scoreAdjustment += (socialDensity - 0.5) * 0.1
    } else {
      scoreAdjustment += (signals.anchorStrength - 0.5) * 0.08
    }

    if (contractConstraints.requireEscalation) {
      scoreAdjustment += (momentIntensity - 0.5) * 0.12
      if (energy < 0.3 && socialDensity < 0.34) {
        hardReject = true
      }
    }

    if (
      experienceContract.persona === 'romantic' &&
      (experienceContract.vibe === 'cozy' || experienceContract.vibe === 'chill')
    ) {
      const centerpieceCapable =
        destination >= 0.58 || experiential >= 0.64 || candidate.highlightValidity.validityLevel === 'valid'
      scoreAdjustment += centerpieceCapable ? 0.14 : -0.16
      if (!centerpieceCapable && nightlifeLike > 0.8 && quickStopLeaning) {
        hardReject = true
      }
      if (nightlifeLike > 0.9 && socialDensity > 0.86) {
        hardReject = true
      }
    } else if (experienceContract.persona === 'romantic' && experienceContract.vibe === 'lively') {
      const escalationCapable = momentIntensity >= 0.56 && energy >= 0.42
      scoreAdjustment += escalationCapable ? 0.12 : -0.12
      if (!contractConstraints.allowLateHighEnergy && nightlifeLike > 0.9) {
        hardReject = true
      }
    } else if (experienceContract.persona === 'friends' && experienceContract.vibe === 'lively') {
      scoreAdjustment += (socialDensity - 0.5) * 0.12
      scoreAdjustment += (energy - 0.5) * 0.1
    } else if (experienceContract.persona === 'family') {
      scoreAdjustment += (calmness - 0.5) * 0.12
      scoreAdjustment += (signals.interactiveStrength - 0.5) * 0.08
      if (nightlifeLike > 0.88 && energy > 0.82) {
        hardReject = true
      }
    }
  }

  if (role === 'cooldown') {
    scoreAdjustment += (windDownFit - 0.5) * 0.2
    scoreAdjustment += (linger - 0.5) * 0.12
    scoreAdjustment += (calmness - 0.5) * 0.14
    if (contractConstraints.windDownStrictness === 'soft_required') {
      scoreAdjustment += (calmness - 0.5) * 0.16
      if (energy > 0.82 && socialDensity > 0.78 && windDownFit < 0.44) {
        hardReject = true
      }
    } else if (contractConstraints.windDownStrictness === 'controlled') {
      if (energy > 0.88 && windDownFit < 0.42) {
        hardReject = true
      }
    }
    if (contractConstraints.maxEnergyDropTolerance === 'low' && energy > 0.86) {
      scoreAdjustment -= 0.12
    }
    if (experienceContract.persona === 'family' && calmness < 0.34) {
      scoreAdjustment -= 0.16
      if (nightlifeLike > 0.84 && windDownFit < 0.44) {
        hardReject = true
      }
    }
  }

  if (!contractConstraints.allowLateHighEnergy && nightlifeLike > 0.9) {
    scoreAdjustment -= 0.14
    if (role !== 'peak' && windDownFit < 0.44) {
      hardReject = true
    }
  }

  return {
    scoreAdjustment: clampContractScore(scoreAdjustment),
    hardReject,
  }
}

function pickRoleCandidates(
  scoredVenues: ScoredVenue[],
  role: InternalRole,
  crewPolicy: CrewPolicy,
  lens: ExperienceLens,
  intent?: IntentProfile,
  roleContracts?: RoleContractSet,
  strictShapeEnabled = false,
  contractConstraints?: ContractConstraints,
  experienceContract?: ExperienceContract,
): RoleCandidateSelection {
  const lensRole = roleToLensStop(role)
  const cooldownBoosted = role === 'cooldown'
  const refinementTightening = intent?.refinementModes?.includes('closer-by') ? 0.03 : 0
  const roleContract = roleContracts?.byRole[lensRole] ?? defaultRoleContractRule(lensRole)
  const enforceContract = strengthRank(roleContract.strength) >= strengthRank('strong')
  const minContractCandidates = contractMinCount(role, strictShapeEnabled)
  const strictCandidates = scoredVenues.filter((item) =>
    isBaseRoleCandidate(
      item,
      role,
      lensRole,
      crewPolicy,
      roleThresholds[role] - refinementTightening,
      0.36,
      0.4,
      0.45,
      3,
    ),
  )
  const strictValidHighlightCandidates =
    role === 'peak'
      ? strictCandidates.filter((item) => item.highlightValidity.validityLevel === 'valid')
      : []
  const strictFallbackHighlightCandidates =
    role === 'peak'
      ? strictCandidates.filter((item) => item.highlightValidity.validityLevel === 'fallback')
      : []
  const strictInvalidHighlightCandidates =
    role === 'peak'
      ? strictCandidates.filter((item) => item.highlightValidity.validityLevel === 'invalid')
      : []

  let validityScopedStrictCandidates = strictCandidates
  let fallbackUsedBecauseNoValidHighlight = false
  if (role === 'peak') {
    if (strictValidHighlightCandidates.length > 0) {
      validityScopedStrictCandidates = strictValidHighlightCandidates
    } else if (strictFallbackHighlightCandidates.length > 0) {
      validityScopedStrictCandidates = strictFallbackHighlightCandidates
      fallbackUsedBecauseNoValidHighlight = true
    }
  }

  const contractStrictCandidates = validityScopedStrictCandidates.filter(
    (item) => item.roleContract[role].satisfied,
  )

  let fallbackReason: string | undefined
  let contractRelaxed = false
  let workingStrictCandidates = validityScopedStrictCandidates
  if (role === 'peak' && fallbackUsedBecauseNoValidHighlight) {
    fallbackReason = 'Highlight validity relaxed: no fully valid highlight candidates available.'
  }
  if (enforceContract && contractStrictCandidates.length >= minContractCandidates) {
    workingStrictCandidates = contractStrictCandidates
  } else if (enforceContract) {
    contractRelaxed = true
    fallbackReason =
      contractStrictCandidates.length === 0
        ? `${roleContract.label} relaxed: no contract-true local candidates.`
        : `${roleContract.label} relaxed: only ${contractStrictCandidates.length} contract-true candidates available.`
  }

  const relaxedCandidates =
    workingStrictCandidates.length >= 6
      ? workingStrictCandidates
      : scoredVenues.filter((item) =>
          isBaseRoleCandidate(
            item,
            role,
            lensRole,
            crewPolicy,
            roleThresholds[role] - 0.08,
            0.3,
            0.32,
            0.36,
            4,
          ),
        )
  const validityScopedRelaxedCandidates =
    role === 'peak'
      ? (() => {
          if (relaxedCandidates.some((item) => item.highlightValidity.validityLevel === 'valid')) {
            return relaxedCandidates.filter((item) => item.highlightValidity.validityLevel === 'valid')
          }
          const nonInvalidCandidates = relaxedCandidates.filter(
            (item) => item.highlightValidity.validityLevel !== 'invalid',
          )
          return nonInvalidCandidates.length > 0 ? nonInvalidCandidates : relaxedCandidates
        })()
      : relaxedCandidates
  const contractAwareRelaxedCandidates =
    enforceContract && !contractRelaxed
      ? validityScopedRelaxedCandidates.filter((item) => item.roleContract[role].satisfied)
      : validityScopedRelaxedCandidates

  const expandedCandidates =
    contractAwareRelaxedCandidates.length >= 4
      ? contractAwareRelaxedCandidates
      : scoredVenues.filter((item) =>
          isBaseRoleCandidate(
            item,
            role,
            lensRole,
            crewPolicy,
            roleThresholds[role] - 0.13,
            0.24,
            0.24,
            0.28,
            4,
          ),
        )
  const validityScopedExpandedCandidates =
    role === 'peak'
      ? (() => {
          if (expandedCandidates.some((item) => item.highlightValidity.validityLevel === 'valid')) {
            return expandedCandidates.filter((item) => item.highlightValidity.validityLevel === 'valid')
          }
          const nonInvalidCandidates = expandedCandidates.filter(
            (item) => item.highlightValidity.validityLevel !== 'invalid',
          )
          return nonInvalidCandidates.length > 0 ? nonInvalidCandidates : expandedCandidates
        })()
      : expandedCandidates

  const contractAwareExpandedCandidates =
    enforceContract && !contractRelaxed
      ? validityScopedExpandedCandidates.filter((item) => item.roleContract[role].satisfied)
      : validityScopedExpandedCandidates

  const preferredVenueId =
    getAnchorVenueId(intent, role) ?? getPreferredDiscoveryVenueId(intent, role)
  const preferredCandidate = preferredVenueId
    ? scoredVenues.find((item) => getScoredVenueBaseVenueId(item) === preferredVenueId)
    : undefined
  const preferredAdmission = evaluatePreferredRoleAdmission(
    preferredCandidate,
    role,
    lensRole,
    crewPolicy,
    intent,
  )
  const hasFeasibleStrongPeakMoment = scoredVenues.some((item) =>
    isFeasibleStrongPeakMomentCandidate(item, intent),
  )
  const hasFeasibleRomanticMoment = scoredVenues.some((item) =>
    isFeasibleRomanticMomentPoolCandidate(item, intent),
  )
  const feasibleRomanticHighlights = scoredVenues.filter((item) =>
    isFeasibleRomanticHighlightPoolCandidate(item, lens, intent),
  )
  const personaContractRequiresRomanticHighlight =
    role === 'peak' &&
    requiresRomanticPersonaMoment(lens) &&
    feasibleRomanticHighlights.length > 0
  const warmupNeedsRomanticSupportRelaxation =
    role === 'warmup' &&
    isRomanticPersonaContractActive(lens) &&
    feasibleRomanticHighlights.length > 0 &&
    !contractAwareExpandedCandidates.some(
      (item) =>
        item.venue.energyLevel <=
          Math.max(...feasibleRomanticHighlights.map((romanticHighlight) => romanticHighlight.venue.energyLevel)) &&
        !item.taste.signals.isRomanticMomentCandidate,
    )
  let roleCandidates =
    warmupNeedsRomanticSupportRelaxation
      ? [
          ...new Map(
            [...contractAwareExpandedCandidates, ...validityScopedExpandedCandidates].map((item) => [
              getScoredVenueCandidateId(item),
              item,
            ] as const),
          ).values(),
        ]
      : contractAwareExpandedCandidates
  if (personaContractRequiresRomanticHighlight) {
    const romanticHighlightCandidates = [
      ...new Map(
        roleCandidates
          .filter((item) => isFeasibleRomanticHighlightPoolCandidate(item, lens, intent))
          .map((item) => [getScoredVenueCandidateId(item), item] as const),
      ).values(),
    ]
    if (romanticHighlightCandidates.length > 0) {
      roleCandidates = romanticHighlightCandidates
      contractRelaxed = true
      fallbackReason =
        fallbackReason ?? `${roleContract.label} shaped by romantic persona contract.`
    }
  }
  if (role === 'peak') {
    const scopedByMomentTier = scopeRomanticHighlightCandidatesByMomentTier(
      roleCandidates,
      lens,
    )
    if (scopedByMomentTier.candidates.length > 0) {
      roleCandidates = scopedByMomentTier.candidates
      if (scopedByMomentTier.appliedTier === 'anchor') {
        fallbackReason =
          fallbackReason ?? 'Romantic highlight scope enforced: anchor-tier moments only.'
      } else if (scopedByMomentTier.appliedTier === 'builder') {
        fallbackReason =
          fallbackReason ??
          'Romantic highlight scope fallback: no anchor-tier moments, using builder-tier moments.'
      } else if (scopedByMomentTier.appliedTier === 'support') {
        fallbackReason =
          fallbackReason ??
          'Romantic highlight scope fallback: no anchor/builder moments, support-tier retained.'
      }
    }
  }
  const localSupplySufficient = intent
    ? scoredVenues.some(
        (item) =>
          isPeakHighlightFeasibleCandidate(item, intent) &&
          isWithinStrictNearbyWindow(item.venue.driveMinutes, intent.distanceMode) &&
          item.momentIdentity.strength === 'strong' &&
          item.roleScores.peak >= 0.64 &&
          item.stopShapeFit.highlight >= 0.4 &&
          item.taste.signals.momentPotential.score >= 0.66,
      )
    : false
  const strictNearbyFailed =
    !localSupplySufficient &&
    (intent ? scoredVenues.some((item) => isMeaningfulMomentStretchCandidate(item, intent)) : false)
  let usedRecoveredCentralMomentHighlight = false
  let recoveredHighlightCandidatesCount = 0
  let centralMomentRecoveryReason: string | undefined

  if (warmupNeedsRomanticSupportRelaxation) {
    contractRelaxed = true
    fallbackReason =
      fallbackReason ?? `${roleContract.label} relaxed to preserve a feasible romantic highlight.`
  }

  if (role === 'peak' && roleCandidates.length === 0) {
    const recoveredCentralMomentCandidates = scoredVenues
      .filter((candidate) => isRecoverableCentralMomentHighlightCandidate(candidate, intent))
      .map((candidate) => {
        const familyAdjustment = getCentralMomentFamilyAdjustment(candidate, intent)
        const recoveryScore =
          computeRoleSelectionScore({
            candidate,
            role,
            lens,
            intent,
            hasFeasibleStrongPeakMoment,
            hasFeasibleRomanticMoment,
            feasibleRomanticHighlights,
            localSupplySufficient,
            strictNearbyFailed,
          }) +
          CENTRAL_MOMENT_RECOVERY_BOOST +
          familyAdjustment
        return {
          candidate: {
            ...candidate,
            recoveredCentralMomentHighlight: true,
            centralMomentRecoveryReason:
              familyAdjustment > 0
                ? 'central_moment_recovery_family_aligned'
                : familyAdjustment < 0
                  ? 'central_moment_recovery_family_mismatch_tolerated'
                  : 'central_moment_recovery',
          } satisfies ScoredVenue,
          recoveryScore,
          familyAdjustment,
        }
      })
      .sort((left, right) => {
        const scoreDelta = right.recoveryScore - left.recoveryScore
        if (scoreDelta !== 0) {
          return scoreDelta
        }
        const familyDelta = right.familyAdjustment - left.familyAdjustment
        if (familyDelta !== 0) {
          return familyDelta
        }
        return getScoredVenueCandidateId(left.candidate).localeCompare(
          getScoredVenueCandidateId(right.candidate),
        )
      })
      .slice(0, cooldownBoosted ? 8 : 6)

    if (recoveredCentralMomentCandidates.length > 0) {
      roleCandidates = recoveredCentralMomentCandidates.map((entry) => entry.candidate)
      usedRecoveredCentralMomentHighlight = true
      recoveredHighlightCandidatesCount = recoveredCentralMomentCandidates.length
      centralMomentRecoveryReason =
        'no_standard_peak_candidates_central_moment_recovery_activated'
      contractRelaxed = true
      fallbackReason =
        fallbackReason ??
        'Central-moment highlight recovery activated: no standard peak survived in local supply.'
    }
  }

  const scopedPeakCandidateIds =
    role === 'peak'
      ? new Set(roleCandidates.map((candidate) => getScoredVenueCandidateId(candidate)))
      : undefined
  const allowPreferredAdmission =
    !preferredAdmission.admittedCandidate ||
    role !== 'peak' ||
    !scopedPeakCandidateIds ||
    scopedPeakCandidateIds.has(
      getScoredVenueCandidateId(preferredAdmission.admittedCandidate),
    ) ||
    isAnchorCandidateForRole(preferredAdmission.admittedCandidate, role, intent)
  const scoredRoleCandidates =
    allowPreferredAdmission &&
    preferredAdmission.admittedCandidate &&
    !roleCandidates.some(
      (candidate) =>
        getScoredVenueCandidateId(candidate) ===
        getScoredVenueCandidateId(preferredAdmission.admittedCandidate!),
    )
      ? [...roleCandidates, preferredAdmission.admittedCandidate]
      : roleCandidates
  const contractPressureByCandidateId = new Map<
    string,
    ReturnType<typeof computeContractRolePressure>
  >(
    scoredRoleCandidates.map((candidate) => [
      getScoredVenueCandidateId(candidate),
      computeContractRolePressure({
        candidate,
        role,
        contractConstraints,
        experienceContract,
      }),
    ] as const),
  )
  const hardRejectedCandidates = roleCandidates.filter(
    (candidate) => contractPressureByCandidateId.get(getScoredVenueCandidateId(candidate))?.hardReject,
  )
  if (hardRejectedCandidates.length > 0) {
    const contractEligibleCandidates = roleCandidates.filter(
      (candidate) =>
        !contractPressureByCandidateId.get(getScoredVenueCandidateId(candidate))?.hardReject,
    )
    const minPostContractPool =
      role === 'peak' ? 4 : role === 'cooldown' ? 3 : role === 'warmup' ? 3 : 2
    if (contractEligibleCandidates.length >= minPostContractPool) {
      roleCandidates = contractEligibleCandidates
    } else {
      contractRelaxed = true
      fallbackReason =
        fallbackReason ??
        `${roleContract.label} relaxed: contract hard-gating left only ${contractEligibleCandidates.length} ${role} candidates.`
    }
  }
  const selectionScoreByCandidateId = new Map(
    scoredRoleCandidates.map((candidate) => [
      getScoredVenueCandidateId(candidate),
      computeRoleSelectionScore({
        candidate,
        role,
        lens,
        intent,
        hasFeasibleStrongPeakMoment,
        hasFeasibleRomanticMoment,
        feasibleRomanticHighlights,
        localSupplySufficient,
        strictNearbyFailed,
      }) +
        (contractPressureByCandidateId.get(getScoredVenueCandidateId(candidate))?.scoreAdjustment ?? 0) +
        (role === 'peak' && candidate.recoveredCentralMomentHighlight
          ? CENTRAL_MOMENT_RECOVERY_BOOST +
            getCentralMomentFamilyAdjustment(candidate, intent)
          : 0),
    ] as const),
  )
  const ranked = [...roleCandidates].sort((left, right) => {
    return (
      (selectionScoreByCandidateId.get(getScoredVenueCandidateId(right)) ?? 0) -
        (selectionScoreByCandidateId.get(getScoredVenueCandidateId(left)) ?? 0) ||
      right.fitScore - left.fitScore
    )
  })

  if (
    enforceContract &&
    allowPreferredAdmission &&
    preferredAdmission.admittedCandidate &&
    !preferredAdmission.admittedCandidate.roleContract[role].satisfied
  ) {
    contractRelaxed = true
    fallbackReason =
      fallbackReason ?? `${roleContract.label} relaxed to admit the selected discovery venue.`
  }

  const rankedWithPreference = allowPreferredAdmission && preferredAdmission.admittedCandidate
    ? [
        markRoleCandidate(preferredAdmission.admittedCandidate, intent, role),
        ...ranked.filter(
          (item) =>
            getScoredVenueCandidateId(item) !==
            getScoredVenueCandidateId(preferredAdmission.admittedCandidate!),
        ),
      ]
    : ranked
  const limitedRanked =
    role === 'peak'
      ? selectPeakCandidatesWithFamilyPreservation(
          rankedWithPreference,
          selectionScoreByCandidateId,
          cooldownBoosted ? 16 : 14,
        )
      : rankedWithPreference.slice(0, cooldownBoosted ? 16 : 14)

  if (
    enforceContract &&
    limitedRanked.length > 0 &&
    !limitedRanked.some((item) => item.roleContract[role].satisfied)
  ) {
    contractRelaxed = true
    fallbackReason = fallbackReason ?? `${roleContract.label} relaxed: no selected candidates satisfied the contract.`
  }

  const bestContractCandidateId = [...contractStrictCandidates].sort(
    (left, right) => right.roleScores[role] - left.roleScores[role],
  )[0]?.venue.id
  const bestValidHighlightCandidateId =
    role === 'peak'
      ? [...expandedCandidates]
          .filter((item) => item.highlightValidity.validityLevel === 'valid')
          .sort((left, right) => right.roleScores.peak - left.roleScores.peak)[0]?.venue.id
      : undefined
  const bestValidHighlightChallengerId =
    role === 'peak'
      ? [...expandedCandidates]
          .filter((item) => item.highlightValidity.validityLevel === 'valid')
          .sort((left, right) => right.roleScores.peak - left.roleScores.peak)[1]?.venue.id
      : undefined
  return {
    candidates: limitedRanked,
    status: {
      role,
      contractLabel: roleContract.label,
      contractStrength: roleContract.strength,
      contractSatisfied:
        roleContract.strength === 'none'
          ? true
          : roleContract.strength === 'soft'
            ? contractStrictCandidates.length > 0
            : contractStrictCandidates.length >= minContractCandidates,
      contractRelaxed,
      fallbackReason,
      preferredDiscoveryVenueId: preferredAdmission.preferredVenueId,
      preferredDiscoveryVenueAdmitted: preferredAdmission.admittedCandidate
        ? true
        : preferredAdmission.preferredVenueId
          ? false
          : undefined,
      preferredDiscoveryVenueRejectedReason: preferredAdmission.rejectedReason,
      preferredDiscoveryVenueHoursRelaxed: preferredAdmission.hoursRelaxed,
      preferredDiscoveryVenueHoursRelaxationReason:
        preferredAdmission.hoursRelaxationReason,
      strictCandidateCount: contractStrictCandidates.length,
      relaxedCandidateCount: ranked.length,
      bestContractCandidateId,
      validCandidateCount: role === 'peak' ? strictValidHighlightCandidates.length : undefined,
      fallbackCandidateCount: role === 'peak' ? strictFallbackHighlightCandidates.length : undefined,
      invalidCandidateCount: role === 'peak' ? strictInvalidHighlightCandidates.length : undefined,
      fallbackUsedBecauseNoValidHighlight: role === 'peak' ? fallbackUsedBecauseNoValidHighlight : undefined,
      bestValidHighlightCandidateId,
      bestValidHighlightChallengerId,
      recoveredCentralMomentHighlight:
        role === 'peak' ? usedRecoveredCentralMomentHighlight : undefined,
      recoveredHighlightCandidatesCount:
        role === 'peak' ? recoveredHighlightCandidatesCount : undefined,
      centralMomentRecoveryReason:
        role === 'peak' ? centralMomentRecoveryReason : undefined,
    },
  }
}

export function buildRolePools(
  scoredVenues: ScoredVenue[],
  crewPolicy: CrewPolicy,
  lens: ExperienceLens,
  intent?: IntentProfile,
  roleContracts?: RoleContractSet,
  strictShapeEnabled = false,
  contractConstraints?: ContractConstraints,
  experienceContract?: ExperienceContract,
): RolePools {
  const warmup = pickRoleCandidates(
    scoredVenues,
    'warmup',
    crewPolicy,
    lens,
    intent,
    roleContracts,
    strictShapeEnabled,
    contractConstraints,
    experienceContract,
  )
  const peak = pickRoleCandidates(
    scoredVenues,
    'peak',
    crewPolicy,
    lens,
    intent,
    roleContracts,
    strictShapeEnabled,
    contractConstraints,
    experienceContract,
  )
  const wildcard = pickRoleCandidates(
    scoredVenues,
    'wildcard',
    crewPolicy,
    lens,
    intent,
    roleContracts,
    strictShapeEnabled,
    contractConstraints,
    experienceContract,
  )
  const cooldown = pickRoleCandidates(
    scoredVenues,
    'cooldown',
    crewPolicy,
    lens,
    intent,
    roleContracts,
    strictShapeEnabled,
    contractConstraints,
    experienceContract,
  )

  return {
    warmup: warmup.candidates,
    peak: peak.candidates,
    wildcard: wildcard.candidates,
    cooldown: cooldown.candidates,
    contractPoolStatus: {
      warmup: warmup.status,
      peak: peak.status,
      wildcard: wildcard.status,
      cooldown: cooldown.status,
    },
  }
}
