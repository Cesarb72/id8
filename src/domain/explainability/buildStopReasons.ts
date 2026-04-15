import { inverseRoleProjection, roleProjection } from '../config/roleProjection'
import { computeRouteShapeBias } from '../taste/computeRouteShapeBias'
import { computeSupportStopVibeFit } from '../taste/computeSupportStopVibeFit'
import { computeRefinementDelta } from '../refinement/computeRefinementDelta'
import {
  getArcStopBaseVenueId,
  getScoredVenueBaseVenueId,
  getScoredVenueCandidateId,
} from '../candidates/candidateIdentity'
import { buildRejectedReason } from './buildRejectedReason'
import { buildUserReasonLabels } from './buildUserReasonLabels'
import { getSelectionConfidence } from './getSelectionConfidence'
import type { RolePools } from '../arc/buildRolePools'
import type { ArcCandidate, ScoredVenue } from '../types/arc'
import type {
  RolePoolDiagnostics,
  SelectionStrengthLabel,
  StopExplainabilityDiagnostics,
} from '../types/diagnostics'
import type { ExperienceLens, LensStopRole } from '../types/experienceLens'
import type { IntentProfile } from '../types/intent'
import type { UserStopRole } from '../types/itinerary'
import type { RefinementMode } from '../types/refinement'
import type { RefinementOutcome, StopDelta } from '../types/refinementOutcome'
import type { StarterPack } from '../types/starterPack'
import type { InternalRole } from '../types/venue'

interface BuildStopReasonsInput {
  selectedArc: ArcCandidate
  arcCandidates: ArcCandidate[]
  scoredVenues: ScoredVenue[]
  rolePools: RolePools
  intent: IntentProfile
  lens: ExperienceLens
  starterPack?: StarterPack
  baselineArc?: ArcCandidate
  previousStopExplainability?: Partial<Record<UserStopRole, StopExplainabilityDiagnostics>>
  refinementPathContext?: {
    targetedRoles: UserStopRole[]
    primaryTargetRole?: UserStopRole
    targetRoleExistedInVisiblePlan: boolean
    targetRoleSelectionReason: string
    targetedCandidateCount: number
    targetedChangeSucceeded: boolean
    fullPlanFallbackUsed: boolean
    winnerInertiaDetected: boolean
    winnerInertiaReduced: boolean
    winnerInertiaNotes: string[]
  }
}

interface BuildStopReasonsResult {
  rolePoolDiagnostics: Partial<Record<UserStopRole, RolePoolDiagnostics>>
  stopExplainability: Partial<Record<UserStopRole, StopExplainabilityDiagnostics>>
  starterPackInfluenceSummary: string[]
  planVibeDiagnostics: {
    supportStopVibeFit: number
    routeShapeBiasApplied: string
    routeShapeBiasScore: number
    selectedHighlightAdventureRead?: string
    outdoorVsUrbanNotes: string[]
  }
  refinementOutcome?: RefinementOutcome
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function roleToLensStop(role: InternalRole): LensStopRole {
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

function formatCategory(value: string): string {
  return value.replace('_', ' ')
}

function getExperienceFamily(candidate: ScoredVenue): string {
  return candidate.taste.signals.experienceFamily
}

function formatRoleTitle(role: UserStopRole): string {
  if (role === 'start') {
    return 'Start'
  }
  if (role === 'highlight') {
    return 'Highlight'
  }
  if (role === 'surprise') {
    return 'Surprise'
  }
  return 'Wind Down'
}

function roleCandidateScore(candidate: ScoredVenue, role: InternalRole): number {
  const lensStop = roleToLensStop(role)
  const highlightValidityLift =
    role === 'peak'
      ? candidate.highlightValidity.validityLevel === 'valid'
        ? 0.14
        : candidate.highlightValidity.validityLevel === 'fallback'
          ? 0.04
          : -0.18
      : 0
  return clamp01(
    candidate.roleScores[role] * 0.56 +
      candidate.fitScore * 0.2 +
      candidate.lensCompatibility * 0.16 +
      candidate.stopShapeFit[lensStop] * 0.08 +
      highlightValidityLift,
  )
}

function getRolePoolForRole(role: InternalRole, pools: RolePools): ScoredVenue[] {
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

function getFallbackLabel(
  confidence: number,
  fallbackUsed: boolean,
  rolePoolSize: number,
  strongCandidateCount: number,
): SelectionStrengthLabel {
  if (fallbackUsed) {
    return 'Fallback pick'
  }
  if (confidence >= 80) {
    return 'Strong fit'
  }
  if (confidence >= 60 && rolePoolSize >= 4 && strongCandidateCount >= 2) {
    return 'Acceptable fit'
  }
  return 'Limited local options'
}

function getTopConfidenceBand(
  selectedConfidence: number,
  rolePoolSize: number,
  strongCandidateCount: number,
): 'strong' | 'medium' | 'weak' {
  if (selectedConfidence >= 80 && rolePoolSize >= 4 && strongCandidateCount >= 2) {
    return 'strong'
  }
  if (selectedConfidence >= 60 && rolePoolSize >= 3) {
    return 'medium'
  }
  return 'weak'
}

function getWeakPoolReason(
  rolePoolSize: number,
  strongCandidateCount: number,
  fallbackUsed: boolean,
  topConfidenceBand: 'strong' | 'medium' | 'weak',
): string | undefined {
  if (fallbackUsed) {
    return 'Selected stop was outside strict role pool.'
  }
  if (rolePoolSize < 3) {
    return 'Very small role pool.'
  }
  if (strongCandidateCount < 2) {
    return 'Few strong candidates for this role.'
  }
  if (topConfidenceBand === 'weak') {
    return 'Top candidate confidence is weak.'
  }
  return undefined
}

function getPreferredCandidateStillLostReason(
  role: InternalRole,
  preferredVenueId: string | undefined,
  preferredCandidateSurvivedToArc: boolean | undefined,
  arcCandidates: ArcCandidate[],
  selectedArc: ArcCandidate,
): string | undefined {
  if (!preferredVenueId) {
    return undefined
  }
  if (preferredCandidateSurvivedToArc === false) {
    return 'Preferred selected venue dropped before arc assembly.'
  }

  const selectedUsesPreferred = selectedArc.stops.some(
    (stop) => stop.role === role && stop.scoredVenue.venue.id === preferredVenueId,
  )
  if (selectedUsesPreferred || preferredCandidateSurvivedToArc !== true) {
    return undefined
  }

  const preferredArc = [...arcCandidates]
    .filter((candidate) =>
      candidate.stops.some(
        (stop) => stop.role === role && stop.scoredVenue.venue.id === preferredVenueId,
      ),
    )
    .sort((left, right) => right.totalScore - left.totalScore)[0]

  if (!preferredArc) {
    return 'Preferred selected venue never formed a viable final arc.'
  }

  const spatialDelta = selectedArc.spatial.score - preferredArc.spatial.score
  if (spatialDelta >= 0.04) {
    return 'Preferred selected venue still lost on route spatial coherence.'
  }

  const pacingDelta =
    (selectedArc.scoreBreakdown.durationPacingScore ?? 0) -
    (preferredArc.scoreBreakdown.durationPacingScore ?? 0)
  const transitionDelta =
    (selectedArc.scoreBreakdown.transitionSmoothnessScore ?? 0) -
    (preferredArc.scoreBreakdown.transitionSmoothnessScore ?? 0)
  if (pacingDelta >= 0.04 || transitionDelta >= 0.04) {
    return 'Preferred selected venue still lost on pacing and stop-to-stop flow.'
  }

  const categoryPenaltyDelta =
    (preferredArc.scoreBreakdown.categoryDiversityPenalty ?? 0) -
    (selectedArc.scoreBreakdown.categoryDiversityPenalty ?? 0)
  if (categoryPenaltyDelta >= 0.03) {
    return 'Preferred selected venue still lost on route category repetition.'
  }

  const highlightValidityDelta =
    (selectedArc.scoreBreakdown.highlightValidityScore ?? 0) -
    (preferredArc.scoreBreakdown.highlightValidityScore ?? 0)
  if (role === 'peak' && highlightValidityDelta >= 0.06) {
    return 'Preferred selected venue still lost on stronger highlight validity in the final route.'
  }

  return 'Preferred selected venue still lost on stronger overall arc coherence.'
}

function getStarterPackImpact(
  starterPack: StarterPack | undefined,
  role: UserStopRole,
  venue: ScoredVenue,
): string[] {
  if (!starterPack) {
    return []
  }

  const impact: string[] = []
  const preset = starterPack.lensPreset
  const normalizedTags = new Set(venue.venue.tags.map((tag) => tag.toLowerCase()))
  if (preset) {
    const roleShape = preset.preferredStopShapes?.[role]

    if (preset.preferredCategories?.includes(venue.venue.category)) {
      impact.push(`Starter pack boosted ${formatCategory(venue.venue.category)} fit`)
    }
    if (
      preset.preferredTags?.some((tag) =>
        normalizedTags.has(tag.toLowerCase()),
      )
    ) {
      impact.push('Starter pack matched preferred local tags')
    }
    if (roleShape?.preferredCategories?.includes(venue.venue.category)) {
      impact.push(
        `Starter pack preferred ${formatRoleTitle(role).toLowerCase()} ${formatCategory(venue.venue.category)}`,
      )
    }
    if (role === 'windDown' && preset.windDown?.preferredCategories?.includes(venue.venue.category)) {
      impact.push('Starter pack boosted wind-down pairing')
    }
    if (preset.discoveryBias === 'high' && venue.venue.isHiddenGem) {
      impact.push('Starter pack boosted hidden gem priority')
    }
  }

  const internalRole = inverseRoleProjection[role]
  const roleContract = venue.roleContract[internalRole]
  if (starterPack.roleContracts?.[role]) {
    if (roleContract.satisfied) {
      impact.push(`Starter pack ${formatRoleTitle(role).toLowerCase()} contract matched`)
    } else {
      impact.push(`Starter pack ${formatRoleTitle(role).toLowerCase()} contract relaxed`)
    }
  }

  if (impact.length === 0) {
    impact.push(`Starter pack lens shaped this ${formatRoleTitle(role).toLowerCase()} stop`)
  }

  return [...new Set(impact)].slice(0, 3)
}

function buildSelectedBecause(
  fallbackUsed: boolean,
  roleFit: number,
  vibeMatch: number,
  personaMatch: number,
  proximityMatch: number,
  lensCompatibility: number,
  starterPackImpact: string[],
  refinementImpact: string[],
): string {
  if (fallbackUsed) {
    return 'Best available option from a limited local pool.'
  }

  const rankedSignals: Array<{ label: string; score: number }> = [
    { label: 'role fit', score: roleFit },
    { label: 'vibe match', score: vibeMatch },
    { label: 'persona fit', score: personaMatch },
    { label: 'nearby fit', score: proximityMatch },
    { label: 'lens compatibility', score: lensCompatibility },
  ].sort((left, right) => right.score - left.score)

  const topSignal = rankedSignals[0]?.label ?? 'fit'
  const secondSignal = rankedSignals[1]?.label ?? 'coherence'
  const addons = [starterPackImpact[0], refinementImpact[0]].filter(Boolean)

  return `Selected for strong ${topSignal} and ${secondSignal}.${addons.length > 0 ? ` ${addons[0]}.` : ''}`
}

function getMaterialRefinementImpact(
  role: InternalRole,
  venue: ScoredVenue,
  modes: RefinementMode[],
  stopDelta: StopDelta | undefined,
): string[] {
  if (!stopDelta?.materialChange) {
    return []
  }

  const impact: string[] = []
  if (modes.includes('more-exciting') && (role === 'peak' || role === 'wildcard')) {
    impact.push('Adjusted for a more energetic outing')
  }
  if (modes.includes('more-relaxed') && (role === 'warmup' || role === 'cooldown')) {
    impact.push('Adjusted for More Relaxed')
  }
  if (modes.includes('closer-by') && venue.fitBreakdown.proximityFit >= 0.62) {
    impact.push('Adjusted for Closer By')
  }
  if (modes.includes('more-unique') && (venue.venue.isHiddenGem || venue.hiddenGemScore >= 0.68)) {
    impact.push('Adjusted for More Unique')
  }
  if (modes.includes('little-fancier') && venue.venue.priceTier !== '$') {
    impact.push('Adjusted for A Little Fancier')
  }
  if (impact.length === 0) {
    impact.push('Refinement rebalanced this stop')
  }
  return [...new Set(impact)].slice(0, 2)
}

export function buildStopReasons({
  selectedArc,
  arcCandidates,
  scoredVenues,
  rolePools,
  intent,
  lens,
  starterPack,
  baselineArc,
  previousStopExplainability,
  refinementPathContext,
}: BuildStopReasonsInput): BuildStopReasonsResult {
  const rolePoolDiagnostics: Partial<Record<UserStopRole, RolePoolDiagnostics>> = {}
  const stopExplainability: Partial<Record<UserStopRole, StopExplainabilityDiagnostics>> = {}
  const starterPackInfluenceSummary = new Set<string>()
  const supportStopVibeFit = computeSupportStopVibeFit(selectedArc.stops, intent)
  const routeShapeBias = computeRouteShapeBias(selectedArc.stops, intent, lens)
  const selectedHighlight = selectedArc.stops.find((stop) => stop.role === 'peak')

  for (const [index, stop] of selectedArc.stops.entries()) {
    const role = stop.role
    const userRole = roleProjection[role]
    const selected = stop.scoredVenue
    const pacingStop = selectedArc.pacing.stops[index]
    const rolePool = getRolePoolForRole(role, rolePools)
    const contractPool = rolePools.contractPoolStatus[role]
    const rankedForRole = [...scoredVenues].sort(
      (left, right) => roleCandidateScore(right, role) - roleCandidateScore(left, role),
    )
    const selectedScore = roleCandidateScore(selected, role)
    const selectedRank =
      rankedForRole.findIndex(
        (item) => getScoredVenueCandidateId(item) === getScoredVenueCandidateId(selected),
      ) + 1
    const runnerUp = rankedForRole.find(
      (item) => getScoredVenueCandidateId(item) !== getScoredVenueCandidateId(selected),
    )
    const runnerUpScore = runnerUp ? roleCandidateScore(runnerUp, role) : undefined
    const rolePoolSize = rolePool.length
    const strongCandidateCount = rolePool.filter(
      (item) => item.roleScores[role] >= 0.72 && item.lensCompatibility >= 0.52,
    ).length
    const categoryDistribution = rolePool.reduce<Partial<Record<string, number>>>((acc, item) => {
      const category = item.venue.category
      acc[category] = (acc[category] ?? 0) + 1
      return acc
    }, {})
    const familyDistribution = rolePool.reduce<Partial<Record<string, number>>>((acc, item) => {
      const family = getExperienceFamily(item)
      acc[family] = (acc[family] ?? 0) + 1
      return acc
    }, {})
    const categoryDiversityCount = Object.keys(categoryDistribution).length
    const familyEntries = Object.entries(familyDistribution).sort(
      (left, right) => (right[1] ?? 0) - (left[1] ?? 0) || left[0].localeCompare(right[0]),
    )
    const dominantFamilyEntry = familyEntries[0]
    const familyDiversityCount = familyEntries.length
    const fallbackUsed = !rolePool.some(
      (item) => getScoredVenueCandidateId(item) === getScoredVenueCandidateId(selected),
    )
    const confidence = getSelectionConfidence({
      selectedScore,
      roleFit: selected.roleScores[role],
      lensCompatibility: selected.lensCompatibility,
      runnerUpScore,
      rolePoolSize,
      strongCandidateCount,
      fallbackUsed,
    })
    const topConfidenceBand = getTopConfidenceBand(confidence, rolePoolSize, strongCandidateCount)
    const weakPoolReason = getWeakPoolReason(
      rolePoolSize,
      strongCandidateCount,
      fallbackUsed,
      topConfidenceBand,
    )
    const selectedContextSpecificity = Number((selected.contextSpecificity.byRole[role] * 100).toFixed(1))
    const selectedDominancePenalty = Number((selected.dominanceControl.byRole[role] * 100).toFixed(1))
    const selectedUniversalityScore = Number((selected.dominanceControl.universalityScore * 100).toFixed(1))
    const preferredCandidateSurvivedToArc =
      contractPool.preferredDiscoveryVenueAdmitted && contractPool.preferredDiscoveryVenueId
        ? arcCandidates.some((candidate) =>
            candidate.stops.some(
              (arcStop) =>
                arcStop.role === role &&
                getArcStopBaseVenueId(arcStop) === contractPool.preferredDiscoveryVenueId,
            ),
          )
        : undefined
    const preferredCandidateDroppedPreAssembly =
      typeof preferredCandidateSurvivedToArc === 'boolean'
        ? !preferredCandidateSurvivedToArc
        : undefined
    const preferredContractOverrideApplied =
      contractPool.preferredDiscoveryVenueAdmitted === true &&
      preferredCandidateSurvivedToArc === true
    const selectedContractOverrideApplied =
      preferredContractOverrideApplied &&
      contractPool.preferredDiscoveryVenueId === getScoredVenueBaseVenueId(selected)
    const preferredContractOverrideRole = preferredContractOverrideApplied ? userRole : undefined
    const selectedContractOverrideRole = selectedContractOverrideApplied ? userRole : undefined
    const selectedCandidateStillLostReason = getPreferredCandidateStillLostReason(
      role,
      contractPool.preferredDiscoveryVenueId,
      preferredCandidateSurvivedToArc,
      arcCandidates,
      selectedArc,
    )
    const selectedContract = selected.roleContract[role]
    const selectedContractSatisfied = selectedContract.satisfied || selectedContractOverrideApplied
    const selectedViolatesContract =
      selectedContractOverrideApplied
        ? false
        : selectedContract.strength !== 'none' && !selectedContract.satisfied
    const tasteInfluence = selected.taste.rolePoolInfluence[role]
    const contractRelaxed = contractPool.contractRelaxed || selectedViolatesContract
    const contractFallbackReason =
      selectedContractOverrideApplied
        ? undefined
        : contractPool.fallbackReason ??
          (selectedViolatesContract
            ? `${selectedContract.contractLabel} relaxed for selected stop due to limited alternatives.`
            : undefined)
    const highlightFallbackReason =
      role === 'peak' && contractPool.fallbackUsedBecauseNoValidHighlight
        ? 'No fully valid highlight candidates were available in the local pool.'
        : undefined
    const resolvedWeakPoolReason = weakPoolReason ?? contractFallbackReason ?? highlightFallbackReason
    const weakPool = Boolean(resolvedWeakPoolReason)
    const fallbackLabel = getFallbackLabel(confidence, fallbackUsed, rolePoolSize, strongCandidateCount)
    const moreContextSpecificChallengerExists = rankedForRole.some((candidate) => {
      if (getScoredVenueCandidateId(candidate) === getScoredVenueCandidateId(selected)) {
        return false
      }
      const challengerSpecificity = candidate.contextSpecificity.byRole[role]
      const challengerScore = roleCandidateScore(candidate, role)
      return challengerSpecificity >= selected.contextSpecificity.byRole[role] + 0.09 && challengerScore >= selectedScore - 0.05
    })
    const starterPackImpact = getStarterPackImpact(starterPack, userRole, selected)
    const supportFit = supportStopVibeFit.byRole[role]
    const rejectedAlternatives = rankedForRole
      .filter(
        (item) => getScoredVenueCandidateId(item) !== getScoredVenueCandidateId(selected),
      )
      .slice(0, 6)
      .map((candidate) => ({
        venueId: candidate.venue.id,
        venueName: candidate.venue.name,
        score: Number((roleCandidateScore(candidate, role) * 100).toFixed(1)),
        rejectionReasons: buildRejectedReason({
          role,
          candidate,
          selected,
          currentArc: selectedArc,
          intent,
          lens,
        }),
      }))
      .slice(0, 3)

    const rejectionReasons = rejectedAlternatives
      .flatMap((item) => item.rejectionReasons)
      .filter((value, index, array) => array.indexOf(value) === index)
      .slice(0, 3)

    for (const item of starterPackImpact) {
      starterPackInfluenceSummary.add(item)
    }

      rolePoolDiagnostics[userRole] = {
      rolePoolSize,
      rolePoolCandidateIds: rolePool.map((item) => getScoredVenueCandidateId(item)),
      strongCandidateCount,
      categoryDiversityCount,
      categoryDistribution,
      familyDiversityCount,
      familyDistribution,
      dominantFamily: dominantFamilyEntry?.[0],
      dominantFamilyShare:
        dominantFamilyEntry && rolePoolSize > 0
          ? (dominantFamilyEntry[1] ?? 0) / rolePoolSize
          : undefined,
      topConfidenceBand,
      weakPool,
      weakPoolReason: resolvedWeakPoolReason,
      selectedVenueId: selected.venue.id,
      selectedScore: Number((selectedScore * 100).toFixed(1)),
      runnerUpVenueId: runnerUp?.venue.id,
      runnerUpScore:
        typeof runnerUpScore === 'number'
          ? Number((runnerUpScore * 100).toFixed(1))
          : undefined,
      fallbackUsed,
      fallbackLabel,
      roleContractLabel: selectedContract.contractLabel,
      roleContractStrength: selectedContract.strength,
      contractStrictCandidateCount: contractPool.strictCandidateCount,
      contractRelaxedCandidateCount: contractPool.relaxedCandidateCount,
      contractSatisfied: contractPool.contractSatisfied || preferredContractOverrideApplied,
      contractRelaxed,
      contractFallbackReason: preferredContractOverrideApplied ? undefined : contractFallbackReason,
      bestContractCandidateId: contractPool.bestContractCandidateId,
      preferredDiscoveryVenueId: contractPool.preferredDiscoveryVenueId,
      preferredDiscoveryVenueAdmitted: contractPool.preferredDiscoveryVenueAdmitted,
      preferredDiscoveryVenueRejectedReason: contractPool.preferredDiscoveryVenueRejectedReason,
      preferredCandidateSurvivedToArc,
      preferredCandidateDroppedPreAssembly,
      selectedContractOverrideApplied: preferredContractOverrideApplied,
      selectedContractOverrideRole: preferredContractOverrideRole,
      selectedCandidateStillLostReason,
      selectedContractSatisfied,
      selectedViolatesContract,
      highlightValidCandidateCount: contractPool.validCandidateCount,
      highlightFallbackCandidateCount: contractPool.fallbackCandidateCount,
      highlightInvalidCandidateCount: contractPool.invalidCandidateCount,
      fallbackUsedBecauseNoValidHighlight: contractPool.fallbackUsedBecauseNoValidHighlight,
      bestValidHighlightCandidateId: contractPool.bestValidHighlightCandidateId,
      bestValidHighlightChallengerId: contractPool.bestValidHighlightChallengerId,
      selectedHighlightValidityLevel:
        role === 'peak' ? selected.highlightValidity.validityLevel : undefined,
      selectedHighlightValidForIntent:
        role === 'peak' ? selected.highlightValidity.validForIntent : undefined,
      selectedHighlightIsFallback:
        role === 'peak' ? selected.highlightValidity.validityLevel === 'fallback' : undefined,
      selectedHighlightViolatesIntent:
        role === 'peak' ? selected.highlightValidity.validityLevel === 'invalid' : undefined,
      selectedHighlightVetoReason:
        role === 'peak' ? selected.highlightValidity.vetoReason : undefined,
      packLiteralRequirementSatisfied:
        role === 'peak' ? selected.highlightValidity.packLiteralRequirementSatisfied : undefined,
    }

    stopExplainability[userRole] = {
      role: userRole,
      venueId: selected.venue.id,
      venueName: selected.venue.name,
      normalizedCategory: selected.venue.category,
      normalizedSubcategory: selected.venue.subcategory,
      durationClass: pacingStop?.durationClass ?? 'M',
      estimatedDurationMinutes: pacingStop?.estimatedDurationMinutes ?? 75,
      socialDensity: selected.venue.socialDensity,
      highlightCapability: selected.venue.settings.highlightCapabilityTier,
      qualityGateStatus: selected.venue.source.qualityGateStatus,
      sourceOrigin: selected.venue.source.sourceOrigin,
      sourceProvider: selected.venue.source.provider,
      sourceProviderRecordId: selected.venue.source.providerRecordId,
      sourceQueryLabel: selected.venue.source.sourceQueryLabel,
      openNow: selected.venue.source.openNow,
      hoursKnown: selected.venue.source.hoursKnown,
      likelyOpenForCurrentWindow: selected.venue.source.likelyOpenForCurrentWindow,
      businessStatus: selected.venue.source.businessStatus,
      timeConfidence: Number((selected.venue.source.timeConfidence * 100).toFixed(1)),
      hoursPressureLevel: selected.venue.source.hoursPressureLevel,
      hoursDemotionApplied: selected.venue.source.hoursDemotionApplied,
      hoursSuppressionApplied: selected.venue.source.hoursSuppressionApplied,
      sourceConfidence: Number((selected.venue.source.sourceConfidence * 100).toFixed(1)),
      completenessScore: Number((selected.venue.source.completenessScore * 100).toFixed(1)),
      normalizedFromRawType: selected.venue.source.normalizedFromRawType,
      missingFields: selected.venue.source.missingFields,
      inferredFields: selected.venue.source.inferredFields,
      qualityGateNotes: [
        ...selected.venue.source.hoursPressureNotes,
        ...selected.venue.source.qualityGateNotes,
        ...selected.venue.source.suppressionReasons,
      ],
      reasonTags: buildUserReasonLabels({
        role: userRole,
        venue: selected,
        intent,
        starterPackTitle: starterPack?.title,
        starterPackImpact,
        refinementImpact: [],
        fallbackLabel,
      }),
      selectedBecause: buildSelectedBecause(
        fallbackUsed,
        selected.roleScores[role],
        selected.fitBreakdown.anchorFit,
        selected.fitBreakdown.crewFit,
        selected.fitBreakdown.proximityFit,
        selected.lensCompatibility,
        starterPackImpact,
        [],
      ),
      rejectionReasons,
      refinementImpact: [],
      starterPackImpact,
      roleScore: Number((selected.roleScores[role] * 100).toFixed(1)),
      selectedScore: Number((selectedScore * 100).toFixed(1)),
      roleRankingPosition: selectedRank > 0 ? selectedRank : rankedForRole.length,
      lensCompatibility: Number((selected.lensCompatibility * 100).toFixed(1)),
      personaMatch: Number((selected.fitBreakdown.crewFit * 100).toFixed(1)),
      vibeMatch: Number((selected.fitBreakdown.anchorFit * 100).toFixed(1)),
      proximityMatch: Number((selected.fitBreakdown.proximityFit * 100).toFixed(1)),
      selectionConfidence: confidence,
      tasteInfluenceApplied: true,
      tasteBonus: Number((tasteInfluence.tasteBonus * 100).toFixed(1)),
      tasteRoleSuitabilityContribution: Number(
        (tasteInfluence.roleSuitabilityContribution * 100).toFixed(1),
      ),
      tasteHighlightPlausibilityBonus:
        role === 'peak'
          ? Number((tasteInfluence.highlightPlausibilityBonus * 100).toFixed(1))
          : undefined,
      contextSpecificity: selectedContextSpecificity,
      dominancePenalty: selectedDominancePenalty,
      universalityScore: selectedUniversalityScore,
      universalWinnerFlag: selected.dominanceControl.flaggedUniversal,
      moreContextSpecificChallengerExists,
      fallbackLabel,
      fallbackUsed,
      runnerUpVenueId: runnerUp?.venue.id,
      runnerUpScore:
        typeof runnerUpScore === 'number'
          ? Number((runnerUpScore * 100).toFixed(1))
          : undefined,
      rejectedAlternatives,
      roleContractLabel: selectedContract.contractLabel,
      roleContractStrength: selectedContract.strength,
      selectedContractOverrideApplied,
      selectedContractOverrideRole,
      contractSatisfied: selectedContractSatisfied,
      contractRelaxed,
      contractFallbackReason,
      bestContractCandidateId: contractPool.bestContractCandidateId,
      selectedViolatesContract,
      contractMatchedSignals: selectedContractOverrideApplied
        ? [...selectedContract.matchedSignals, 'user-selected discovery contract override applied']
        : selectedContract.matchedSignals,
      contractViolationReasons: selectedContractOverrideApplied ? [] : selectedContract.violations,
      vibeAuthority: Number((selected.vibeAuthority.overall * 100).toFixed(1)),
      highlightVibeFit: Number((selected.vibeAuthority.byRole.highlight * 100).toFixed(1)),
      windDownVibeFit: Number((selected.vibeAuthority.byRole.windDown * 100).toFixed(1)),
      highlightPackPressure: Number((selected.vibeAuthority.packPressure.highlight * 100).toFixed(1)),
      highlightPressureSource: selected.vibeAuthority.pressureSource.highlight,
      musicSupportSource: selected.vibeAuthority.musicSupportSource,
      highlightValidForIntent:
        role === 'peak' ? selected.highlightValidity.validForIntent : undefined,
      highlightValidityLevel:
        role === 'peak' ? selected.highlightValidity.validityLevel : undefined,
      highlightCandidateTier:
        role === 'peak' ? selected.highlightValidity.candidateTier : undefined,
      highlightVetoReason:
        role === 'peak' ? selected.highlightValidity.vetoReason : undefined,
      packLiteralRequirementSatisfied:
        role === 'peak' ? selected.highlightValidity.packLiteralRequirementSatisfied : undefined,
      fallbackUsedBecauseNoValidHighlight:
        role === 'peak' ? contractPool.fallbackUsedBecauseNoValidHighlight : undefined,
      bestValidHighlightChallenger:
        role === 'peak' ? contractPool.bestValidHighlightChallengerId : undefined,
      selectedHighlightViolatesIntent:
        role === 'peak' ? selected.highlightValidity.validityLevel === 'invalid' : undefined,
      selectedHighlightIsFallback:
        role === 'peak' ? selected.highlightValidity.validityLevel === 'fallback' : undefined,
      highlightMatchedSignals:
        role === 'peak' ? selected.highlightValidity.matchedSignals : undefined,
      highlightViolationReasons:
        role === 'peak'
          ? [
              ...selected.highlightValidity.violations,
              ...selected.highlightValidity.personaVetoes,
              ...selected.highlightValidity.contextVetoes,
            ]
          : undefined,
      supportStopVibeFit:
        role === 'warmup' || role === 'cooldown'
          ? Number(((supportFit?.score ?? 0) * 100).toFixed(1))
          : role === 'peak'
            ? Number((supportStopVibeFit.overall * 100).toFixed(1))
            : undefined,
      supportStopVibeEffect:
        role === 'warmup' || role === 'cooldown'
          ? supportFit?.effect
          : role === 'peak'
            ? supportStopVibeFit.effect
            : undefined,
      supportStopVibeNotes:
        role === 'warmup' || role === 'cooldown'
          ? supportFit?.notes
          : role === 'peak'
            ? supportStopVibeFit.notes
            : undefined,
      routeShapeBiasApplied: role === 'peak' ? routeShapeBias.appliedLabel : undefined,
      outdoorVsUrbanRead:
        role === 'peak' ? selected.vibeAuthority.adventureRead : undefined,
      outdoorVsUrbanNotes:
        role === 'peak' ? selected.vibeAuthority.adventureNotes : undefined,
    }
  }

  const refinementOutcome = computeRefinementDelta({
    requestedModes: intent.refinementModes ?? [],
    nextArc: selectedArc,
    previousArc: baselineArc,
    nextStopExplainability: stopExplainability,
    previousStopExplainability,
    targetedRoles: refinementPathContext?.targetedRoles,
    primaryTargetRole: refinementPathContext?.primaryTargetRole,
    targetRoleExistedInVisiblePlan: refinementPathContext?.targetRoleExistedInVisiblePlan,
    targetRoleSelectionReason: refinementPathContext?.targetRoleSelectionReason,
    targetedCandidateCount: refinementPathContext?.targetedCandidateCount,
    targetedChangeSucceeded: refinementPathContext?.targetedChangeSucceeded,
    fullPlanFallbackUsed: refinementPathContext?.fullPlanFallbackUsed,
    winnerInertiaDetected: refinementPathContext?.winnerInertiaDetected,
    winnerInertiaReduced: refinementPathContext?.winnerInertiaReduced,
    winnerInertiaNotes: refinementPathContext?.winnerInertiaNotes,
  })

  if (refinementOutcome) {
    for (const delta of refinementOutcome.stopDeltas) {
      const explainability = stopExplainability[delta.role]
      if (!explainability) {
        continue
      }
      const internalRole = inverseRoleProjection[delta.role]
      const selectedStop = selectedArc.stops.find((stop) => stop.role === internalRole)
      if (!selectedStop) {
        continue
      }
      const refinementImpact = getMaterialRefinementImpact(
        internalRole,
        selectedStop.scoredVenue,
        refinementOutcome.requestedModes,
        delta,
      )
      explainability.refinementImpact = refinementImpact
      explainability.reasonTags = buildUserReasonLabels({
        role: delta.role,
        venue: selectedStop.scoredVenue,
        intent,
        starterPackTitle: starterPack?.title,
        starterPackImpact: explainability.starterPackImpact,
        refinementImpact,
        fallbackLabel: explainability.fallbackLabel,
      })
      explainability.selectedBecause = buildSelectedBecause(
        explainability.fallbackUsed,
        selectedStop.scoredVenue.roleScores[internalRole],
        selectedStop.scoredVenue.fitBreakdown.anchorFit,
        selectedStop.scoredVenue.fitBreakdown.crewFit,
        selectedStop.scoredVenue.fitBreakdown.proximityFit,
        selectedStop.scoredVenue.lensCompatibility,
        explainability.starterPackImpact,
        refinementImpact,
      )
      explainability.scoreDeltaFromBaseline = delta.scoreDelta
    }
  }

  return {
    rolePoolDiagnostics,
    stopExplainability,
    starterPackInfluenceSummary: [...starterPackInfluenceSummary].slice(0, 6),
    planVibeDiagnostics: {
      supportStopVibeFit: Number((supportStopVibeFit.overall * 100).toFixed(1)),
      routeShapeBiasApplied: routeShapeBias.appliedLabel,
      routeShapeBiasScore: Number((routeShapeBias.score * 100).toFixed(1)),
      selectedHighlightAdventureRead: selectedHighlight?.scoredVenue.vibeAuthority.adventureRead,
      outdoorVsUrbanNotes: selectedHighlight?.scoredVenue.vibeAuthority.adventureNotes ?? [],
    },
    refinementOutcome,
  }
}
