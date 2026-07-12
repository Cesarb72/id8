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
import {
  computeTasteRolePoolCandidateMeaning,
  computeTasteRolePoolContextMeaning,
  computeTasteRolePoolMeaningForCandidate,
} from '../interpretation/taste/computeTasteRolePoolMeaningView'
import type {
  RolePoolMeaningCandidateEvidence,
  RolePoolMeaningCandidateInput,
  RolePoolMeaningContextInput,
} from '../interpretation/taste/computeRolePoolMeaningEvidence'
import type { InternalRole } from '../types/venue'
import type { PreferredDiscoveryAdmissionRejectionReason } from '../types/roleContract'
import {
  getScoredVenueBaseVenueId,
  getScoredVenueCandidateId,
} from '../candidates/candidateIdentity'
import {
  evaluateRouteSupportFeasibility,
  type RouteSupportFeasibilityVerdict,
} from '../bearings/evaluateRouteSupportFeasibility'
import type {
  BearingsRouteStopRole,
  DistrictRoutePlaceFacts,
} from '../bearings/routePlaceRightContract'
import {
  evaluatePeakCandidateFeasibility,
  type PeakCandidateFeasibilityVerdict,
} from '../bearings/evaluateArcRouteMovementFeasibility'
import {
  coordinateArcPeakRecovery,
  type ArcPeakRecoveryReviewedCandidate,
} from '../../integrations/waypoint/coordination/coordinateArcPeakRecovery'
import {
  coordinateArcRolePoolOrdering,
  getArcRolePoolCandidateLimit,
  limitArcRolePoolCandidates,
  projectArcRolePools,
} from '../../integrations/waypoint/coordination/coordinateArcRolePools'
import { coordinateArcGate1ActionCandidate } from '../../integrations/waypoint/coordination/coordinateArcGate1ActionPolicy'
import type { ArcGate1ActionRefusalReason } from '../../integrations/waypoint/coordination/arcGate1ActionPolicyView'
import type {
  ArcPeakRecoveryBearingsFeasibilitySignal,
  ArcPeakRecoveryCandidate,
  ArcPeakRecoveryTasteCentralMomentQualitySignal,
  ArcPeakRecoveryTastePeakWorthinessSignal,
} from '../../integrations/waypoint/coordination/arcPeakRecoveryCoordinationView'
import type { TasteRolePoolCandidateMeaningEvidence } from '../interpretation/taste/tasteRolePoolMeaningView'
import { projectGate1ActionCandidate } from './projectGate1OwnerSignals'

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

const CENTRAL_MOMENT_RECOVERY_BOOST = 0.06
const CENTRAL_MOMENT_FAMILY_ALIGNMENT_BOOST = 0.04
const CENTRAL_MOMENT_FAMILY_MISMATCH_PENALTY = 0.04
const starterScopedSoftHighlightStarterIds = new Set([
  'dessert-conversation',
  'coffee-books',
])

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

function getStarterScopedSoftHighlightStarterId(
  roleContracts?: RoleContractSet,
): string | undefined {
  return roleContracts?.sourceLabels.find((label) =>
    starterScopedSoftHighlightStarterIds.has(label),
  )
}

function isStarterScopedSoftHighlightCandidate(
  candidate: ScoredVenue,
  starterId: string,
): boolean {
  if (!starterScopedSoftHighlightStarterIds.has(starterId)) {
    return false
  }
  return (
    candidate.highlightValidity.validityLevel === 'valid' &&
    candidate.highlightValidity.packLiteralRequirementSatisfied === true &&
    candidate.roleContract.peak.satisfied &&
    candidate.highlightValidity.personaVetoes.length === 0 &&
    candidate.highlightValidity.contextVetoes.length === 0 &&
    candidate.highlightValidity.violations.length === 0
  )
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

function toRolePoolMeaningContext(
  intent?: IntentProfile,
  experienceContract?: ExperienceContract,
): RolePoolMeaningContextInput {
  return {
    mode: intent?.mode,
    persona: intent?.persona,
    contractPersona: experienceContract?.persona,
    contractVibe: experienceContract?.vibe,
    selectedDirectionContext: intent?.selectedDirectionContext,
  }
}

function toRolePoolMeaningCandidateEvidence(
  candidate: ScoredVenue,
): RolePoolMeaningCandidateInput {
  const signals = candidate.taste.signals

  return {
    candidateVenueId: getScoredVenueBaseVenueId(candidate),
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

function isBuildFriendsEasyHangContext(
  intent?: IntentProfile,
  experienceContract?: ExperienceContract,
): boolean {
  return computeTasteRolePoolContextMeaning(
    toRolePoolMeaningContext(intent, experienceContract),
  ).easyHang.active
}

function getEasyHangHardIncompatibleSignals(candidate: ScoredVenue): string[] {
  return [
    ...getTasteRolePoolCandidateMeaning(candidate).hardIncompatibleSignals,
  ]
}

function isEasyHangHardIncompatibleCandidate(candidate: ScoredVenue): boolean {
  return getTasteRolePoolCandidateMeaning(candidate).hardIncompatible
}

function getTasteRolePoolCandidateMeaning(
  candidate: ScoredVenue,
): RolePoolMeaningCandidateEvidence {
  return computeTasteRolePoolCandidateMeaning(
    toRolePoolMeaningCandidateEvidence(candidate),
  )
}

function getCategoryArchetypeMeaning(candidate: ScoredVenue) {
  return getTasteRolePoolCandidateMeaning(candidate).categoryArchetype
}

function getPeakMomentPotentialScore(candidate: ScoredVenue): number {
  return getTasteRolePoolCandidateMeaning(candidate).expressionActivation.momentPotential
}

function getPeakMomentIntensityScore(candidate: ScoredVenue): number {
  return getTasteRolePoolCandidateMeaning(candidate).expressionActivation.momentIntensity
}

function getPeakAnchorStrength(candidate: ScoredVenue): number {
  return getTasteRolePoolCandidateMeaning(candidate).expressionActivation.anchorStrength
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
    getPeakMomentPotentialScore(item) >= 0.62 &&
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
  const meaningEvidence = computeTasteRolePoolMeaningForCandidate({
    role: lensRole,
    context: toRolePoolMeaningContext(intent),
    candidate: toRolePoolMeaningCandidateEvidence(candidate),
  })
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
      ? getPeakMomentPotentialScore(candidate) * 0.32 +
        getPeakMomentIntensityScore(candidate) * 0.14 +
        getMomentIntensityTierBoost(candidate.taste.signals.momentIntensity) * 0.9
      : role === 'wildcard'
        ? getPeakMomentPotentialScore(candidate) * 0.06 +
          getPeakMomentIntensityScore(candidate) * 0.03
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
    role === 'peak' && meaningEvidence.candidate.categoryArchetype.isPassiveHospitalityPeak
  const modeSpecificPassiveHighlightPenalty =
    role === 'peak' &&
    (lens.tasteMode?.id === 'activity-led' || lens.tasteMode?.id === 'scenic-outdoor') &&
    passivePeakArchetype &&
    getPeakMomentPotentialScore(candidate) < 0.55
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

interface TightSupportAdmissionTrace {
  active: boolean
  reason: string
  requiredAnchorBaseVenueId?: string
  requiredAnchorNeighborhood?: string
  candidates: ScoredVenue[]
  candidateCountBeforeAdmission: number
  candidateCountAfterAdmission?: number
  supportSupplyMissing: boolean
  bearingsVerdict?: RouteSupportFeasibilityVerdict
}

function uniqueScoredVenues(candidates: ScoredVenue[]): ScoredVenue[] {
  return [
    ...new Map(
      candidates.map((candidate) => [
        getScoredVenueCandidateId(candidate),
        candidate,
      ] as const),
    ).values(),
  ]
}

function isTightBuildSupportAdmissionActive(
  intent: IntentProfile | undefined,
  contractConstraints: ContractConstraints | undefined,
): boolean {
  return Boolean(
    intent?.mode === 'build' &&
      intent.planningMode === 'user-led' &&
      intent.anchor?.venueId &&
      contractConstraints &&
      (contractConstraints.movementTolerance === 'contained' ||
        contractConstraints.movementTolerance === 'compressed') &&
      contractConstraints.requireContinuity,
  )
}

function buildTightSupportDistrictRoutePlaceFacts(params: {
  requiredAnchorBaseVenueId?: string
  requiredAnchorNeighborhood?: string
  role: InternalRole
  supportCandidates: ScoredVenue[]
}): DistrictRoutePlaceFacts {
  const {
    requiredAnchorBaseVenueId,
    requiredAnchorNeighborhood,
    role,
    supportCandidates,
  } = params
  const sameNeighborhoodSupportBaseVenueIds =
    requiredAnchorBaseVenueId && requiredAnchorNeighborhood
      ? supportCandidates
          .filter((candidate) => candidate.venue.neighborhood === requiredAnchorNeighborhood)
          .map((candidate) => getScoredVenueBaseVenueId(candidate))
      : []
  const missingFactReasons = [
    ...(requiredAnchorBaseVenueId ? [] : ['required_anchor_base_venue_id_missing']),
    ...(requiredAnchorNeighborhood ? [] : ['required_anchor_neighborhood_missing']),
    'route_compactness_not_required_for_support_admission',
    'cluster_coherence_not_required_for_support_admission',
  ]

  return {
    stopBaseVenueIds: [
      ...(requiredAnchorBaseVenueId ? [requiredAnchorBaseVenueId] : []),
      ...supportCandidates.map((candidate) => getScoredVenueBaseVenueId(candidate)),
    ],
    requiredStopBaseVenueIds: requiredAnchorBaseVenueId ? [requiredAnchorBaseVenueId] : [],
    sameNeighborhood: {
      allStopsSameNeighborhood:
        Boolean(requiredAnchorNeighborhood) &&
        supportCandidates.every(
          (candidate) => candidate.venue.neighborhood === requiredAnchorNeighborhood,
        ),
      neighborhoods: requiredAnchorNeighborhood ? [requiredAnchorNeighborhood] : [],
      mismatchedStopBaseVenueIds:
        requiredAnchorNeighborhood
          ? supportCandidates
              .filter((candidate) => candidate.venue.neighborhood !== requiredAnchorNeighborhood)
              .map((candidate) => getScoredVenueBaseVenueId(candidate))
          : undefined,
      confidence: requiredAnchorNeighborhood ? 1 : 0,
      missingFactReasons: requiredAnchorNeighborhood ? [] : ['required_anchor_neighborhood_missing'],
    },
    clusterCoherence: {
      clusterIds: [],
      confidence: 0,
      missingFactReasons: ['cluster_coherence_not_required_for_support_admission'],
    },
    compactness: {
      confidence: 0,
      missingFactReasons: ['route_compactness_not_required_for_support_admission'],
    },
    supportProximity:
      requiredAnchorBaseVenueId && requiredAnchorNeighborhood
        ? supportCandidates.map((candidate) => ({
            supportBaseVenueId: getScoredVenueBaseVenueId(candidate),
            supportRole: role as BearingsRouteStopRole,
            anchorBaseVenueId: requiredAnchorBaseVenueId,
            sameNeighborhood: candidate.venue.neighborhood === requiredAnchorNeighborhood,
            confidence: 1,
          }))
        : [],
    anchorSupportRelationships:
      requiredAnchorBaseVenueId && requiredAnchorNeighborhood
        ? [
            {
              anchorBaseVenueId: requiredAnchorBaseVenueId,
              supportBaseVenueIds: sameNeighborhoodSupportBaseVenueIds,
              sameNeighborhoodSupportCount: sameNeighborhoodSupportBaseVenueIds.length,
              confidence: 1,
            },
          ]
        : [],
    structuralConfidence: {
      status: requiredAnchorBaseVenueId && requiredAnchorNeighborhood ? 'partial' : 'missing',
      missingFactReasons,
      notes: [
        'Compatibility projection from existing candidate District neighborhood facts for tight support admission.',
      ],
    },
    provenance: {
      source: 'district',
      version: 'gw1-bearings-2-compatibility-projection',
      notes: [
        'Projected in buildRolePools until a route-level District place-facts producer exists.',
      ],
    },
  }
}

function buildTightSupportAdmissionTrace(params: {
  scoredVenues: ScoredVenue[]
  role: InternalRole
  lensRole: LensStopRole
  crewPolicy: CrewPolicy
  intent?: IntentProfile
  contractConstraints?: ContractConstraints
}): TightSupportAdmissionTrace {
  const { scoredVenues, role, lensRole, crewPolicy, intent, contractConstraints } = params
  const active =
    (role === 'warmup' || role === 'cooldown') &&
    isTightBuildSupportAdmissionActive(intent, contractConstraints)

  if (!active) {
    return {
      active: false,
      reason: 'not_tight_build_support_context',
      candidates: [],
      candidateCountBeforeAdmission: 0,
      supportSupplyMissing: false,
    }
  }

  const requiredAnchorBaseVenueId = intent?.anchor?.venueId
  const anchorVenue = requiredAnchorBaseVenueId
    ? scoredVenues.find(
        (candidate) => getScoredVenueBaseVenueId(candidate) === requiredAnchorBaseVenueId,
      )
    : undefined
  const requiredAnchorNeighborhood = anchorVenue?.venue.neighborhood
  const roleEligibleSupportCandidates = scoredVenues.filter((candidate) => {
    if (getScoredVenueBaseVenueId(candidate) === requiredAnchorBaseVenueId) {
      return false
    }
    return (
      isBaseRoleCandidate(
        candidate,
        role,
        lensRole,
        crewPolicy,
        roleThresholds[role] - 0.13,
        0.24,
        0.24,
        0.28,
        4,
      ) && !isPreferredRoleSeverelyIncompatible(candidate, role)
    )
  })
  const districtFacts = buildTightSupportDistrictRoutePlaceFacts({
    requiredAnchorBaseVenueId,
    requiredAnchorNeighborhood,
    role,
    supportCandidates: roleEligibleSupportCandidates,
  })
  const bearingsVerdict = evaluateRouteSupportFeasibility({
    districtFacts,
    role: role as BearingsRouteStopRole,
    requiredAnchorBaseVenueId,
  })

  if (!requiredAnchorBaseVenueId || !requiredAnchorNeighborhood) {
    return {
      active: true,
      reason: bearingsVerdict.reason,
      requiredAnchorBaseVenueId,
      requiredAnchorNeighborhood,
      candidates: [],
      candidateCountBeforeAdmission: 0,
      supportSupplyMissing: bearingsVerdict.supportSupplyMissing,
      bearingsVerdict,
    }
  }

  const admissibleSupportBaseVenueIds = new Set(bearingsVerdict.admissibleSupportBaseVenueIds)
  const candidates = roleEligibleSupportCandidates.filter((candidate) =>
    admissibleSupportBaseVenueIds.has(getScoredVenueBaseVenueId(candidate)),
  )

  return {
    active: true,
    reason: bearingsVerdict.reason,
    requiredAnchorBaseVenueId,
    requiredAnchorNeighborhood,
    candidates,
    candidateCountBeforeAdmission: 0,
    supportSupplyMissing: bearingsVerdict.supportSupplyMissing,
    bearingsVerdict,
  }
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
  const feasibility = evaluatePeakCandidateFeasibility({
    candidate,
    intent,
    anchoredPeakBaseVenueId: getAnchorVenueId(intent, 'peak'),
    allowMeaningfulStretch: true,
    isMeaningfulStretchCandidate: isMeaningfulMomentStretchCandidate,
    minimumProximityFitWithoutIntent: 0.48,
    evaluateHoursPressure: true,
    evaluateRouteTime: false,
    requireHighlightValidity: true,
    requireHighlightVetoClear: true,
    requirePeakContract: true,
  })
  if (!feasibility.feasible) {
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
  const peakDistanceFeasibility = evaluatePeakCandidateFeasibility({
    candidate,
    intent,
    allowMeaningfulStretch: true,
    isMeaningfulStretchCandidate: isMeaningfulMomentStretchCandidate,
    minimumProximityFitWithoutIntent: 0.48,
    evaluateHoursPressure: false,
    evaluateRouteTime: false,
    requireHighlightValidity: false,
    requireHighlightVetoClear: false,
    requirePeakContract: false,
  })
  if (!peakDistanceFeasibility.distanceFeasible) {
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
  return getCategoryArchetypeMeaning(candidate).isGenericHospitalityHighlight
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
  const categoryArchetype = getCategoryArchetypeMeaning(candidate)
  const archetype = categoryArchetype.primaryExperienceArchetype
  const softSupportArchetype = categoryArchetype.isSoftRomanticSupportArchetype

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

function isPassivePeakArchetype(candidate: ScoredVenue): boolean {
  return getCategoryArchetypeMeaning(candidate).isPassiveHospitalityPeak
}

function getPeakChallengeNeighborhood(candidate: ScoredVenue): string {
  return candidate.venue.neighborhood.trim().toLowerCase()
}

function getPeakChallengeSignature(candidate: ScoredVenue): string {
  return [
    getExperienceFamily(candidate),
    candidate.taste.modeAlignment.lane,
    getCategoryArchetypeMeaning(candidate).primaryExperienceArchetype,
    candidate.momentIdentity.type,
    getPeakChallengeNeighborhood(candidate),
  ].join('|')
}

function computePeakChallengeDiversity(
  leader: ScoredVenue,
  candidate: ScoredVenue,
): number {
  let score = 0
  if (getExperienceFamily(candidate) !== getExperienceFamily(leader)) {
    score += 1.2
  }
  if (candidate.taste.modeAlignment.lane !== leader.taste.modeAlignment.lane) {
    score += 0.9
  }
  if (
    getCategoryArchetypeMeaning(candidate).primaryExperienceArchetype !==
    getCategoryArchetypeMeaning(leader).primaryExperienceArchetype
  ) {
    score += 0.85
  }
  if (candidate.momentIdentity.type !== leader.momentIdentity.type) {
    score += 0.65
  }
  if (getPeakChallengeNeighborhood(candidate) !== getPeakChallengeNeighborhood(leader)) {
    score += 0.5
  }
  return score
}

function isSurprisePeakChallengeCandidate(params: {
  candidate: ScoredVenue
  leader: ScoredVenue
  selectionScoreByCandidateId: Map<string, number>
  bestScore: number
}): boolean {
  const { candidate, leader, selectionScoreByCandidateId, bestScore } = params
  if (candidate.highlightValidity.validityLevel !== 'valid') {
    return false
  }

  const score =
    selectionScoreByCandidateId.get(getScoredVenueCandidateId(candidate)) ?? Number.NEGATIVE_INFINITY
  const scoreGap = bestScore - score
  if (scoreGap > 0.17) {
    return false
  }

  if (
    candidate.roleScores.peak < roleThresholds.peak - 0.03 ||
    candidate.stopShapeFit.highlight < 0.34
  ) {
    return false
  }

  const momentPotential = getPeakMomentPotentialScore(candidate)
  const momentIntensity = getPeakMomentIntensityScore(candidate)
  const specificity = candidate.contextSpecificity.byRole.peak
  const authority = candidate.vibeAuthority.byRole.highlight
  const diversity = computePeakChallengeDiversity(leader, candidate)
  const passive = isPassivePeakArchetype(candidate)
  const strongCenterpiece =
    candidate.momentIdentity.strength === 'strong' &&
    (candidate.momentIdentity.type === 'anchor' || candidate.momentIdentity.type === 'explore')
  const viabilityScore =
    (momentPotential >= 0.62 ? 0.8 : 0) +
    (momentIntensity >= 0.62 ? 0.8 : 0) +
    (specificity >= 0.48 ? 0.55 : 0) +
    (authority >= 0.56 ? 0.55 : 0) +
    (strongCenterpiece ? 0.45 : 0) -
    (candidate.taste.fallbackPenalty.applied ? 0.5 : 0) -
    (passive && momentPotential < 0.66 && !strongCenterpiece ? 0.35 : 0)

  return diversity >= 1.75 && viabilityScore >= 1.75
}

function selectSurprisePeakCandidatesWithDiversity(
  selectedCandidates: ScoredVenue[],
  rankedCandidates: ScoredVenue[],
  selectionScoreByCandidateId: Map<string, number>,
  limit: number,
): ScoredVenue[] {
  if (selectedCandidates.length <= 1 || rankedCandidates.length <= limit) {
    return selectedCandidates
  }

  const leader = selectedCandidates[0]
  if (!leader || leader.highlightValidity.validityLevel !== 'valid') {
    return selectedCandidates
  }

  const bestScore =
    selectionScoreByCandidateId.get(getScoredVenueCandidateId(leader)) ?? Number.NEGATIVE_INFINITY
  const rankIndexByCandidateId = new Map(
    rankedCandidates.map((candidate, index) => [getScoredVenueCandidateId(candidate), index] as const),
  )
  const selectedIds = new Set(
    selectedCandidates.map((candidate) => getScoredVenueCandidateId(candidate)),
  )
  const candidateWindow = rankedCandidates.slice(0, Math.min(rankedCandidates.length, limit + 10))

  const existingChallengers = selectedCandidates.slice(1).filter((candidate) =>
    isSurprisePeakChallengeCandidate({
      candidate,
      leader,
      selectionScoreByCandidateId,
      bestScore,
    }),
  )
  if (existingChallengers.length >= 2) {
    return selectedCandidates
  }

  const challengerSignatures = new Set(existingChallengers.map(getPeakChallengeSignature))
  const challengers = candidateWindow
    .filter((candidate) => getScoredVenueCandidateId(candidate) !== getScoredVenueCandidateId(leader))
    .filter((candidate) =>
      isSurprisePeakChallengeCandidate({
        candidate,
        leader,
        selectionScoreByCandidateId,
        bestScore,
      }),
    )
    .filter((candidate) => !challengerSignatures.has(getPeakChallengeSignature(candidate)))
    .sort((left, right) => {
      const diversityDelta =
        computePeakChallengeDiversity(leader, right) - computePeakChallengeDiversity(leader, left)
      if (diversityDelta !== 0) {
        return diversityDelta
      }
      const scoreDelta =
        (selectionScoreByCandidateId.get(getScoredVenueCandidateId(right)) ?? 0) -
        (selectionScoreByCandidateId.get(getScoredVenueCandidateId(left)) ?? 0)
      if (scoreDelta !== 0) {
        return scoreDelta
      }
      return (
        (rankIndexByCandidateId.get(getScoredVenueCandidateId(left)) ?? 0) -
        (rankIndexByCandidateId.get(getScoredVenueCandidateId(right)) ?? 0)
      )
    })

  if (challengers.length === 0) {
    return selectedCandidates
  }

  const selected = [...selectedCandidates]
  for (const challenger of challengers) {
    if (selectedIds.has(getScoredVenueCandidateId(challenger))) {
      continue
    }
    if (selected.length >= limit && existingChallengers.length >= 2) {
      break
    }

    let replacementIndex = -1
    let replacementPriority = Number.POSITIVE_INFINITY
    for (let index = selected.length - 1; index > 0; index -= 1) {
      const candidate = selected[index]
      if (!candidate || candidate.isAnchor) {
        continue
      }
      const diversityPenalty = computePeakChallengeDiversity(leader, candidate)
      const candidateScore =
        selectionScoreByCandidateId.get(getScoredVenueCandidateId(candidate)) ?? Number.NEGATIVE_INFINITY
      const rankIndex = rankIndexByCandidateId.get(getScoredVenueCandidateId(candidate)) ?? index
      const replacementScore = diversityPenalty * 10 + candidateScore - rankIndex * 0.001
      if (replacementScore < replacementPriority) {
        replacementPriority = replacementScore
        replacementIndex = index
      }
    }

    if (replacementIndex === -1) {
      continue
    }

    selectedIds.delete(getScoredVenueCandidateId(selected[replacementIndex]))
    selected[replacementIndex] = challenger
    selectedIds.add(getScoredVenueCandidateId(challenger))
    existingChallengers.push(challenger)
    challengerSignatures.add(getPeakChallengeSignature(challenger))
    if (existingChallengers.length >= 2) {
      break
    }
  }

  return selected.sort((left, right) => {
    return (
      (rankIndexByCandidateId.get(getScoredVenueCandidateId(left)) ?? 0) -
      (rankIndexByCandidateId.get(getScoredVenueCandidateId(right)) ?? 0)
    )
  })
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

interface CentralMomentRecoveryCoordinationPayload {
  candidate: ScoredVenue
  recoveryScore: number
  familyAdjustment: number
  recoveryReason: string
}

interface CentralMomentRecoveryCandidateReview {
  reviewedCandidate: ArcPeakRecoveryReviewedCandidate
  waypointCandidate?: ArcPeakRecoveryCandidate<CentralMomentRecoveryCoordinationPayload>
}

function toPeakWorthinessAssessment(
  evidence: ReturnType<typeof computeTasteRolePoolMeaningForCandidate>,
): TasteRolePoolCandidateMeaningEvidence<'peak_worthiness'> {
  const peakWorthiness = evidence.candidate.peakWorthiness

  return {
    source: 'taste',
    kind: 'peak_worthiness',
    candidateVenueId: evidence.candidate.candidateVenueId,
    role: 'highlight',
    score: peakWorthiness.score,
    strength: peakWorthiness.candidatePeakSuitability,
    reasons: peakWorthiness.reasons,
    components: peakWorthiness.components,
    candidateEvidence: evidence.candidate,
    rolePoolEvidence: evidence.rolePoolEvidence,
  }
}

function toCentralMomentQualityAssessment(
  evidence: ReturnType<typeof computeTasteRolePoolMeaningForCandidate>,
): TasteRolePoolCandidateMeaningEvidence<'central_moment_quality'> {
  const centralMomentQuality = evidence.candidate.centralMomentQuality

  return {
    source: 'taste',
    kind: 'central_moment_quality',
    candidateVenueId: evidence.candidate.candidateVenueId,
    role: 'highlight',
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

function evaluateCentralMomentRecoveryCandidate(params: {
  candidate: ScoredVenue
  intent?: IntentProfile
  recoveryScore: number
  familyAdjustment: number
}): CentralMomentRecoveryCandidateReview {
  const candidateId = getScoredVenueCandidateId(params.candidate)
  const tasteEvidence = computeTasteRolePoolMeaningForCandidate({
    role: 'highlight',
    context: toRolePoolMeaningContext(params.intent),
    candidate: toRolePoolMeaningCandidateEvidence(params.candidate),
  })
  const peakWorthiness = tasteEvidence.candidate.peakWorthiness
  const centralMomentQuality = tasteEvidence.candidate.centralMomentQuality
  const feasibility = evaluatePeakCandidateFeasibility({
    candidate: params.candidate,
    intent: params.intent,
    allowMeaningfulStretch: true,
    isMeaningfulStretchCandidate: isMeaningfulMomentStretchCandidate,
    minimumProximityFitWithoutIntent: 0.4,
    evaluateHoursPressure: true,
    evaluateRouteTime: false,
    requireHighlightValidity: true,
    requireHighlightVetoClear: false,
    requirePeakContract: true,
  })
  const reviewedCandidate: ArcPeakRecoveryReviewedCandidate = {
    candidateId,
    tastePeakAssessment: {
      source: 'taste',
      status: peakWorthiness.status,
      reasons: peakWorthiness.reasons,
    },
    bearingsPeakFeasibility: {
      source: 'bearings',
      feasible: feasibility.feasible,
      reasons: feasibility.reasons,
    },
  }

  if (peakWorthiness.status !== 'peak_worthy' || !feasibility.feasible) {
    return { reviewedCandidate }
  }

  const peakWorthinessSignal: ArcPeakRecoveryTastePeakWorthinessSignal = {
    source: 'taste',
    key: 'taste_peak_worthiness',
    label: 'Taste peak-worthiness',
    value: true,
    status: 'peak_worthy',
    assessment: toPeakWorthinessAssessment(tasteEvidence),
  }
  const centralMomentQualitySignal: ArcPeakRecoveryTasteCentralMomentQualitySignal = {
    source: 'taste',
    key: 'taste_central_moment_quality',
    label: 'Taste central-moment quality',
    value:
      centralMomentQuality.status === 'central_moment' ||
      centralMomentQuality.status === 'possible_central_moment',
    status: centralMomentQuality.status,
    assessment: toCentralMomentQualityAssessment(tasteEvidence),
  }
  const bearingsFeasibilitySignal: ArcPeakRecoveryBearingsFeasibilitySignal = {
    source: 'bearings',
    key: 'bearings_peak_feasibility',
    label: 'Bearings peak feasibility',
    value: true,
    verdict: feasibility as PeakCandidateFeasibilityVerdict & {
      feasible: true
    },
  }
  const recoveryReason =
    params.familyAdjustment > 0
      ? 'central_moment_recovery_family_aligned'
      : params.familyAdjustment < 0
        ? 'central_moment_recovery_family_mismatch_tolerated'
        : 'central_moment_recovery'
  const waypointCandidate: ArcPeakRecoveryCandidate<CentralMomentRecoveryCoordinationPayload> = {
    id: candidateId,
    payload: {
      candidate: params.candidate,
      recoveryScore: params.recoveryScore,
      familyAdjustment: params.familyAdjustment,
      recoveryReason,
    },
    identity: {
      candidateId,
      baseVenueId: getScoredVenueBaseVenueId(params.candidate),
      traceLabel: params.candidate.candidateIdentity.traceLabel,
    },
    roleContext: {
      candidateRole: 'peak',
      rolePoolRole: 'peak',
    },
    coordinationContext: {
      context: 'recovery_pool_candidate',
      requestReason: 'empty_standard_peak_pool',
    },
    deterministicTieBreakKey: candidateId,
    tastePeakWorthiness: peakWorthinessSignal,
    tasteCentralMomentQuality: centralMomentQualitySignal,
    bearingsPeakFeasibility: bearingsFeasibilitySignal,
    signals: [
      peakWorthinessSignal,
      centralMomentQualitySignal,
      bearingsFeasibilitySignal,
    ],
    compatibility: {
      source: 'compat',
      legacyReasonCodes: [recoveryReason],
      oldScoreFields: {
        recoveryScore: params.recoveryScore,
        familyAdjustment: params.familyAdjustment,
      },
    },
  }

  return {
    reviewedCandidate,
    waypointCandidate,
  }
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
  intent?: IntentProfile,
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
        getPeakMomentIntensityScore(candidate) >= 0.68 &&
        getPeakMomentPotentialScore(candidate) >= 0.56 &&
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
    return intent?.mode === 'surprise'
      ? selectSurprisePeakCandidatesWithDiversity(
          initial,
          rankedCandidates,
          selectionScoreByCandidateId,
          limit,
        )
      : initial
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

  const familyPreserved = selected.sort((left, right) => {
    return (
      (rankIndexByCandidateId.get(getScoredVenueCandidateId(left)) ?? 0) -
      (rankIndexByCandidateId.get(getScoredVenueCandidateId(right)) ?? 0)
    )
  })

  return intent?.mode === 'surprise'
    ? selectSurprisePeakCandidatesWithDiversity(
        familyPreserved,
        rankedCandidates,
        selectionScoreByCandidateId,
        limit,
      )
    : familyPreserved
}

function getPeakStrongMomentSelectionBias(
  candidate: ScoredVenue,
  intent: IntentProfile | undefined,
  hasFeasibleStrongPeakMoment: boolean,
): number {
  if (isFeasibleStrongPeakMomentCandidate(candidate, intent)) {
    const archetype = getCategoryArchetypeMeaning(candidate).primaryExperienceArchetype
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
      getPeakMomentPotentialScore(candidate) * 0.08 +
      getPeakMomentIntensityScore(candidate) * 0.08 +
      getMomentIntensityTierBoost(candidate.taste.signals.momentIntensity) * 0.8 +
      experientialArchetypeBoost
    )
  }

  if (!hasFeasibleStrongPeakMoment || !isPeakHighlightFeasibleCandidate(candidate, intent)) {
    return 0
  }

  const categoryArchetype = getCategoryArchetypeMeaning(candidate)
  const archetype = categoryArchetype.primaryExperienceArchetype
  const passiveHospitalityFallback = categoryArchetype.isPassiveHospitalityPeak
  const weakMomentPenalty =
    candidate.momentIdentity.strength === 'medium'
      ? candidate.momentIdentity.type === 'anchor' ||
        candidate.momentIdentity.type === 'explore'
        ? 0.04
        : 0.08
      : 0.12
  const passiveFallbackPenalty =
    passiveHospitalityFallback
      ? getPeakMomentPotentialScore(candidate) < 0.62
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

  const archetype = getCategoryArchetypeMeaning(candidate).primaryExperienceArchetype
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
        getPeakMomentPotentialScore(candidate) * 0.1 +
        getPeakMomentIntensityScore(candidate) * 0.08 +
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
        getPeakMomentPotentialScore(candidate) * 0.04 +
        getPeakMomentIntensityScore(candidate) * 0.03
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

  const categoryArchetype = getCategoryArchetypeMeaning(candidate)
  const cocktailBarPenalty =
    categoryArchetype.category === 'bar' || categoryArchetype.tags.includes('cocktails')
      ? 0.05
      : 0
  const lowMomentPenalty =
    getPeakMomentPotentialScore(candidate) < 0.64
      ? 0.05
      : getPeakMomentPotentialScore(candidate) < 0.72
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
    return 0.18 + getPeakMomentPotentialScore(candidate) * 0.06
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
  const categoryArchetype = getCategoryArchetypeMeaning(candidate)
  const archetype = categoryArchetype.primaryExperienceArchetype
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
    (categoryArchetype.category === 'activity' || archetype === 'activity') &&
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

  const categoryArchetype = getCategoryArchetypeMeaning(candidate)
  const archetype = categoryArchetype.primaryExperienceArchetype
  const experientialArchetypeBoost =
    archetype === 'activity' || archetype === 'scenic'
      ? 0.24
      : archetype === 'outdoor' || archetype === 'culture'
        ? 0.2
        : archetype === 'social'
          ? 0.12
          : 0
  const passiveHospitalityPenalty = categoryArchetype.isPassiveHospitalityPeak
    ? 0.18
    : 0

  return (
    getPeakMomentPotentialScore(candidate) * 0.58 +
    getPeakMomentIntensityScore(candidate) * 0.24 +
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

  if (isAnchorCandidateForRole(candidate, role, intent)) {
    return {
      preferredVenueId,
      admittedCandidate: candidate,
    }
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

function preferredRoleAdmissionRejectedReason(
  reason?: ArcGate1ActionRefusalReason,
  legacyReason?: PreferredDiscoveryAdmissionRejectionReason,
): PreferredDiscoveryAdmissionRejectionReason {
  if (legacyReason) {
    return legacyReason
  }
  if (reason === 'preferred_role:would_mask_failed_admission') {
    return 'rejected_hours'
  }
  if (reason === 'preferred_role:would_mask_missing_meaning') {
    return 'rejected_role_fit'
  }
  if (reason === 'preferred_role:would_mask_missing_real') {
    return 'rejected_context'
  }
  return 'rejected_role_fit'
}

function coordinatePreferredRoleAdmission(params: {
  candidate: ScoredVenue | undefined
  role: InternalRole
  intent?: IntentProfile
  legacyAdmission: PreferredRoleAdmissionDecision
}): PreferredRoleAdmissionDecision {
  const { candidate, role, intent, legacyAdmission } = params
  if (!candidate) {
    return legacyAdmission
  }

  const decision = coordinateArcGate1ActionCandidate(
    projectGate1ActionCandidate({
      id: `preferred-role:${role}:${getScoredVenueCandidateId(candidate)}`,
      action: 'preferred_role_admission',
      candidate,
      role,
      intent,
      routeContext: 'role_pool',
      deterministicTieBreakKey: `preferred-role:${role}:${getScoredVenueCandidateId(candidate)}`,
    }),
  )

  if (decision.decision !== 'admit') {
    return {
      preferredVenueId: legacyAdmission.preferredVenueId,
      rejectedReason: preferredRoleAdmissionRejectedReason(
        decision.reasons?.[0],
        legacyAdmission.rejectedReason,
      ),
    }
  }

  return {
    preferredVenueId: legacyAdmission.preferredVenueId,
    admittedCandidate: legacyAdmission.admittedCandidate ?? candidate,
    hoursRelaxed: legacyAdmission.hoursRelaxed,
    hoursRelaxationReason: legacyAdmission.hoursRelaxationReason,
  }
}

function clampContractScore(value: number): number {
  return Math.max(-0.42, Math.min(0.42, value))
}

function computeContractRolePressure(params: {
  candidate: ScoredVenue
  role: InternalRole
  intent?: IntentProfile
  contractConstraints?: ContractConstraints
  experienceContract?: ExperienceContract
}): { scoreAdjustment: number; hardReject: boolean } {
  const { candidate, role, intent, contractConstraints, experienceContract } = params
  if (!contractConstraints || !experienceContract) {
    return { scoreAdjustment: 0, hardReject: false }
  }

  const meaningEvidence = computeTasteRolePoolMeaningForCandidate({
    role: roleToLensStop(role),
    context: toRolePoolMeaningContext(intent, experienceContract),
    candidate: toRolePoolMeaningCandidateEvidence(candidate),
  })
  const socialDensity = meaningEvidence.candidate.social.density
  const energy = meaningEvidence.candidate.family.energy
  const intimacy = meaningEvidence.candidate.romantic.intimacy
  const linger = meaningEvidence.candidate.romantic.linger
  const destination = meaningEvidence.candidate.romantic.destination
  const experiential = meaningEvidence.candidate.romantic.experiential
  const windDownFit = meaningEvidence.candidate.roleSuitability.windDown ?? 0
  const startFit = meaningEvidence.candidate.roleSuitability.start ?? 0
  const highlightFit = meaningEvidence.candidate.roleSuitability.highlight ?? 0
  const momentIntensity = meaningEvidence.candidate.romantic.momentIntensity
  const driveMinutes = candidate.venue.driveMinutes
  const nightlifeLike = meaningEvidence.candidate.nightlifeLike
  const calmness = meaningEvidence.candidate.calmness
  const quickStopLeaning = meaningEvidence.candidate.quickStopLeaning

  let scoreAdjustment = 0
  let hardReject = false

  if (
    role !== 'wildcard' &&
    isBuildFriendsEasyHangContext(intent, experienceContract) &&
    meaningEvidence.candidate.hardIncompatible
  ) {
    return {
      scoreAdjustment: -0.42,
      hardReject: true,
    }
  }

  if (role === 'warmup') {
    scoreAdjustment += (startFit - 0.5) * 0.18
    scoreAdjustment +=
      (meaningEvidence.candidate.social.conversationFriendliness - 0.5) * 0.12
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
      const basecampLike = meaningEvidence.candidate.isFriendsLivelyBasecamp
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
      scoreAdjustment += (highlightFit - 0.5) * 0.14
      scoreAdjustment += (socialDensity - 0.5) * 0.08
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
      scoreAdjustment += (getPeakAnchorStrength(candidate) - 0.5) * 0.08
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
      scoreAdjustment += (meaningEvidence.candidate.family.interactiveStrength - 0.5) * 0.08
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
  const legacyPreferredAdmission = evaluatePreferredRoleAdmission(
    preferredCandidate,
    role,
    lensRole,
    crewPolicy,
    intent,
  )
  const preferredAdmission = coordinatePreferredRoleAdmission({
    candidate: preferredCandidate,
    role,
    intent,
    legacyAdmission: legacyPreferredAdmission,
  })
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
  const starterScopedSoftHighlightStarterId =
    role === 'peak' ? getStarterScopedSoftHighlightStarterId(roleContracts) : undefined
  const starterScopedSoftHighlightCandidates = starterScopedSoftHighlightStarterId
    ? roleCandidates.filter((candidate) =>
        isStarterScopedSoftHighlightCandidate(
          candidate,
          starterScopedSoftHighlightStarterId,
        ),
      )
    : []
  if (role === 'peak') {
    if (starterScopedSoftHighlightCandidates.length >= 2) {
      roleCandidates = starterScopedSoftHighlightCandidates
      fallbackReason =
        fallbackReason ??
        `${roleContract.label} retained starter-scoped soft highlights.`
    } else {
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
  }
  const localSupplySufficient = intent
    ? scoredVenues.some(
        (item) =>
          isPeakHighlightFeasibleCandidate(item, intent) &&
          isWithinStrictNearbyWindow(item.venue.driveMinutes, intent.distanceMode) &&
          item.momentIdentity.strength === 'strong' &&
          item.roleScores.peak >= 0.64 &&
          item.stopShapeFit.highlight >= 0.4 &&
          getPeakMomentPotentialScore(item) >= 0.66,
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
    const centralMomentRecoveryReviews = scoredVenues.map((candidate) => {
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

        return evaluateCentralMomentRecoveryCandidate({
          candidate,
          recoveryScore,
          familyAdjustment,
          intent,
        })
      })
    const recoveryCoordination = coordinateArcPeakRecovery({
      candidates: centralMomentRecoveryReviews
        .map((review) => review.waypointCandidate)
        .filter(
          (
            candidate,
          ): candidate is ArcPeakRecoveryCandidate<CentralMomentRecoveryCoordinationPayload> =>
            Boolean(candidate),
        ),
      reviewedCandidates: centralMomentRecoveryReviews.map(
        (review) => review.reviewedCandidate,
      ),
      selectLimit: cooldownBoosted ? 8 : 6,
      getCoordinationScore: (candidate) => candidate.payload?.recoveryScore ?? 0,
      getRecoveryReason: (candidate) => candidate.payload?.recoveryReason,
    })

    if (recoveryCoordination.selectedCandidates.length > 0) {
      roleCandidates = recoveryCoordination.selectedCandidates.map((entry) => ({
        ...entry.payload!.candidate,
        recoveredCentralMomentHighlight: true,
        centralMomentRecoveryReason:
          entry.payload!.recoveryReason,
      }))
      usedRecoveredCentralMomentHighlight = true
      recoveredHighlightCandidatesCount =
        recoveryCoordination.selectedCandidates.length
      centralMomentRecoveryReason =
        recoveryCoordination.recoveryReason ??
        'no_standard_peak_candidates_central_moment_recovery_activated'
      contractRelaxed = true
      fallbackReason =
        fallbackReason ??
        'Central-moment highlight recovery activated: no standard peak survived in local supply.'
    } else {
      centralMomentRecoveryReason = recoveryCoordination.emptyPoolOutcome
    }
  }

  const easyHangHardSignalFiltered =
    isBuildFriendsEasyHangContext(intent, experienceContract) &&
    role !== 'wildcard'
      ? roleCandidates.filter((candidate) => !isEasyHangHardIncompatibleCandidate(candidate))
      : roleCandidates
  if (easyHangHardSignalFiltered.length !== roleCandidates.length) {
    roleCandidates = easyHangHardSignalFiltered
    fallbackReason =
      fallbackReason ??
      `${roleContract.label} excluded hard-incompatible easy-hang signals before arc assembly.`
  }

  const tightSupportAdmissionTrace = buildTightSupportAdmissionTrace({
    scoredVenues,
    role,
    lensRole,
    crewPolicy,
    intent,
    contractConstraints,
  })
  const tightSupportCandidates = tightSupportAdmissionTrace.active
    ? tightSupportAdmissionTrace.candidates.filter(
        (candidate) =>
          !(
            isBuildFriendsEasyHangContext(intent, experienceContract) &&
            isEasyHangHardIncompatibleCandidate(candidate)
          ),
      )
    : []
  const tightSupportCandidateIds = new Set(
    tightSupportCandidates.map((candidate) => getScoredVenueCandidateId(candidate)),
  )
  const tightSupportCandidateCountBeforeAdmission = roleCandidates.filter((candidate) =>
    tightSupportCandidateIds.has(getScoredVenueCandidateId(candidate)),
  ).length
  if (tightSupportCandidates.length > 0) {
    roleCandidates = uniqueScoredVenues([...tightSupportCandidates, ...roleCandidates])
    fallbackReason =
      fallbackReason ??
      `${roleContract.label} preserved same-neighborhood supports for tight Build movement.`
  }

  const scopedPeakCandidateIds =
    role === 'peak'
      ? new Set(roleCandidates.map((candidate) => getScoredVenueCandidateId(candidate)))
      : undefined
  const preferredAdmissionScopedOut = Boolean(
    preferredAdmission.admittedCandidate &&
      role === 'peak' &&
      scopedPeakCandidateIds &&
      !scopedPeakCandidateIds.has(
        getScoredVenueCandidateId(preferredAdmission.admittedCandidate),
      ) &&
      !isAnchorCandidateForRole(preferredAdmission.admittedCandidate, role, intent),
  )
  const allowPreferredAdmission =
    !preferredAdmission.admittedCandidate ||
    role !== 'peak' ||
    !scopedPeakCandidateIds ||
    scopedPeakCandidateIds.has(
      getScoredVenueCandidateId(preferredAdmission.admittedCandidate),
    ) ||
    isAnchorCandidateForRole(preferredAdmission.admittedCandidate, role, intent) ||
    preferredAdmissionScopedOut
  if (preferredAdmissionScopedOut) {
    contractRelaxed = true
    fallbackReason =
      fallbackReason ??
      'Peak discovery preference admitted after generic highlight scope.'
  }
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
        intent,
      }),
    ] as const),
  )
  const preferredAdmissionHardRejected = Boolean(
    allowPreferredAdmission &&
      preferredAdmission.admittedCandidate &&
      contractPressureByCandidateId.get(
        getScoredVenueCandidateId(preferredAdmission.admittedCandidate),
      )?.hardReject,
  )
  const finalAllowPreferredAdmission =
    allowPreferredAdmission && !preferredAdmissionHardRejected
  if (preferredAdmissionHardRejected) {
    contractRelaxed = true
    fallbackReason =
      fallbackReason ??
      `${roleContract.label} kept generic highlight scope: selected discovery venue was contract-incompatible.`
  }
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
        (tightSupportCandidateIds.has(getScoredVenueCandidateId(candidate)) ? 0.75 : 0) +
        (contractPressureByCandidateId.get(getScoredVenueCandidateId(candidate))?.scoreAdjustment ?? 0) +
        (role === 'peak' && candidate.recoveredCentralMomentHighlight
          ? CENTRAL_MOMENT_RECOVERY_BOOST +
            getCentralMomentFamilyAdjustment(candidate, intent)
          : 0),
    ] as const),
  )
  const rolePoolLimit = getArcRolePoolCandidateLimit(role, cooldownBoosted)
  const rolePoolOrdering = coordinateArcRolePoolOrdering({
    candidates: roleCandidates,
    preferredCandidate: preferredAdmission.admittedCandidate,
    includePreferredCandidate: finalAllowPreferredAdmission,
    getCandidateId: getScoredVenueCandidateId,
    getSelectionScore: (candidate) =>
      selectionScoreByCandidateId.get(getScoredVenueCandidateId(candidate)) ?? 0,
    getTieBreakScore: (candidate) => candidate.fitScore,
    projectPreferredCandidate: (candidate) => markRoleCandidate(candidate, intent, role),
  })
  const ranked = rolePoolOrdering.ranked

  if (
    enforceContract &&
    finalAllowPreferredAdmission &&
    preferredAdmission.admittedCandidate &&
    !preferredAdmission.admittedCandidate.roleContract[role].satisfied
  ) {
    contractRelaxed = true
    fallbackReason =
      fallbackReason ?? `${roleContract.label} relaxed to admit the selected discovery venue.`
  }

  const rankedWithPreference = rolePoolOrdering.rankedWithPreference
  const limitedRanked =
    role === 'peak'
      ? selectPeakCandidatesWithFamilyPreservation(
          rankedWithPreference,
          selectionScoreByCandidateId,
          rolePoolLimit,
          intent,
        )
      : limitArcRolePoolCandidates(rankedWithPreference, rolePoolLimit)
  const tightSupportCandidateCountAfterAdmission = tightSupportAdmissionTrace.active
    ? limitedRanked.filter((candidate) =>
        tightSupportCandidateIds.has(getScoredVenueCandidateId(candidate)),
      ).length
    : undefined

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
      tightSupportAdmissionActive: tightSupportAdmissionTrace.active,
      tightSupportAdmissionReason: tightSupportAdmissionTrace.reason,
      requiredAnchorBaseVenueId: tightSupportAdmissionTrace.requiredAnchorBaseVenueId,
      requiredAnchorNeighborhood: tightSupportAdmissionTrace.requiredAnchorNeighborhood,
      nearAnchorSupportCandidateCountBeforeAdmission: tightSupportAdmissionTrace.active
        ? tightSupportCandidateCountBeforeAdmission
        : undefined,
      nearAnchorSupportCandidateCountAfterAdmission:
        tightSupportCandidateCountAfterAdmission,
      nearAnchorSupportCandidateIds: tightSupportAdmissionTrace.active
        ? tightSupportCandidates.map((candidate) => getScoredVenueBaseVenueId(candidate))
        : undefined,
      supportSupplyMissing: tightSupportAdmissionTrace.active
        ? tightSupportCandidateCountAfterAdmission === 0
        : undefined,
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

  return projectArcRolePools({
    warmup,
    peak,
    wildcard,
    cooldown,
  }) as RolePools
}
