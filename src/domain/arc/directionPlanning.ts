/**
 * ARC BOUNDARY: Waypoint coordination contracts and structural validators.
 *
 * Owns:
 * - planning handoff interfaces (selected direction context)
 * - route shape contract and role invariants
 * - structural route/swap compatibility checks
 *
 * Does NOT own:
 * - interpretation semantic authorship
 * - bearings feasibility/admissibility truth
 * - product copy decisions
 */
import type {
  DirectionContractBuildability,
  DirectionCoreRole,
} from '../bearings/assessDirectionContractBuildability'
import {
  inferDirectionIdentityFromSignals,
  inferObservedDirectionIdentity,
} from '../interpretation/direction/directionIdentity'
import type {
  ConciergeIntent,
  ContractConstraints,
  DirectionExperienceFamily,
  DirectionIdentity,
  GreatStopDownstreamSignal,
  ResolvedDirectionContext,
  SelectedDirectionContext,
  RoleInvariantProfile,
  RouteInvariantIntensity,
  RouteInvariantTrait,
  RouteShapeContract,
  RouteShapeRole,
  RoleProfile,
} from '../types/intent'
import type { Itinerary, ItineraryStop, UserStopRole } from '../types/itinerary'

export type DirectionIdentityMode = DirectionIdentity

export interface DirectionPlanningSelection {
  id: string
  label: string
  pocketId: string
  pocketLabel: string
  archetype: string
  cluster: 'lively' | 'chill' | 'explore'
  identity: DirectionIdentityMode
  experienceFamily?: DirectionExperienceFamily
  familyConfidence?: number
  greatStopSignal?: GreatStopDownstreamSignal
}

export interface BuildDirectionPlanningSelectionInput {
  id: string
  label: string
  pocketId?: string
  pocketLabel?: string
  archetype?: string
  cluster: 'lively' | 'chill' | 'explore'
  experienceFamily?: DirectionExperienceFamily
  familyConfidence?: number
  subtitle?: string
  laneIdentity?: string
  macroLane?: string
  greatStopSignal?: GreatStopDownstreamSignal
}

export interface DirectionContractValidationResult {
  valid: boolean
  generationDriftReason: string | null
  expectedDirectionIdentity: DirectionIdentityMode
  observedDirectionIdentity: DirectionIdentityMode
  contractBuildabilityStatus: DirectionContractBuildability['contractBuildabilityStatus']
  missingRoleForContract: DirectionCoreRole | null
  candidatePoolSufficiencyByRole: Record<DirectionCoreRole, number>
  fallbackApplied: boolean
  greatStopQuality?: SelectedDirectionContext['greatStopSignal']
  thinPoolRelaxationTrace?: {
    triggered: boolean
    expectedDirectionIdentity: DirectionIdentityMode
    observedDirectionIdentity: DirectionIdentityMode
    contractBuildabilityStatus: DirectionContractBuildability['contractBuildabilityStatus']
    missingRoleForContract: DirectionCoreRole | null
    candidatePoolSufficiencyByRole: Record<DirectionCoreRole, number>
    relaxationReason?: string
    relaxedRule?: string
    validationOutcome: 'accepted_with_relaxation' | 'accepted_without_relaxation' | 'rejected'
  }
}

export interface HardStructuralSwapCompatibilityInput {
  role: UserStopRole
  targetRole: UserStopRole
  targetStopIndex: number
  hasTargetSlotAtIndex: boolean
  targetSlotRoleAtIndex?: UserStopRole
  requestedReplacementId: string | null | undefined
  candidateStop: ItineraryStop
  originalStop: ItineraryStop
  canonicalItinerary: Itinerary
  baselineItinerary: Itinerary
  routeShapeContract: RouteShapeContract
  requireReplacementCanonicalProvider: boolean
  replacementCanonicalProviderId?: string
}

export interface HardStructuralSwapCompatibilitySuccess {
  passed: true
  preservedRole: boolean
  preservedFeasibility: boolean
  transitionsWithinShape: boolean
  preferredRoleTraitMissing: RouteInvariantTrait[]
}

export interface HardStructuralSwapCompatibilityFailure {
  passed: false
  reason: string
  hardRejectCode: string
  preservedRole: boolean
  preservedFeasibility: boolean
}

export type HardStructuralSwapCompatibilityEvaluation =
  | HardStructuralSwapCompatibilitySuccess
  | HardStructuralSwapCompatibilityFailure

function toTagSet(tags: string[]): Set<string> {
  return new Set(tags.map((tag) => tag.toLowerCase()))
}

export function buildDirectionPlanningSelection(
  input: BuildDirectionPlanningSelectionInput,
): DirectionPlanningSelection {
  return {
    id: input.id,
    label: input.label,
    pocketId: input.pocketId ?? input.id,
    pocketLabel: input.pocketLabel ?? input.label,
    archetype: input.archetype ?? input.cluster,
    cluster: input.cluster,
    identity: inferDirectionIdentityFromSignals({
      experienceFamily: input.experienceFamily,
      cluster: input.cluster,
      archetype: input.archetype,
      label: input.label,
      subtitle: input.subtitle,
      laneIdentity: input.laneIdentity,
      macroLane: input.macroLane,
    }),
    experienceFamily: input.experienceFamily,
    familyConfidence: input.familyConfidence,
    greatStopSignal: input.greatStopSignal,
  }
}

export function buildIntentSelectedDirectionContext(
  selectedDirection?: DirectionPlanningSelection,
): SelectedDirectionContext | undefined {
  // Canonical planning handoff artifact: wrappers pass this downstream, they do not assemble it.
  if (!selectedDirection) {
    return undefined
  }
  return {
    directionId: selectedDirection.id,
    label: selectedDirection.label,
    pocketId: selectedDirection.pocketId,
    archetype: selectedDirection.archetype,
    identity: selectedDirection.identity,
    family: selectedDirection.experienceFamily,
    familyConfidence: selectedDirection.familyConfidence,
    cluster: selectedDirection.cluster,
    greatStopSignal: selectedDirection.greatStopSignal,
  }
}

export function buildResolvedDirectionContext(
  selectedDirection?: DirectionPlanningSelection,
): ResolvedDirectionContext | undefined {
  if (!selectedDirection) {
    return undefined
  }
  return {
    selectedDirectionId: selectedDirection.id,
    selectedPocketId: selectedDirection.pocketId,
    label: selectedDirection.label,
    archetype: selectedDirection.archetype,
    identity: selectedDirection.identity,
    greatStopSignal: selectedDirection.greatStopSignal,
  }
}

function getRouteShapeRoleProfile(
  role: RouteShapeRole,
  selectedDirection: DirectionPlanningSelection,
  conciergeIntent: ConciergeIntent,
  contractConstraints: ContractConstraints,
): RoleProfile {
  const { persona, pacing, socialEnergy } = conciergeIntent.experienceProfile
  const { swapTolerance } = conciergeIntent.constraintPosture
  const controlMode = conciergeIntent.controlPosture.mode
  const escalationMode = contractConstraints.requireEscalation
  const strictContinuity = contractConstraints.requireContinuity
  const strongCenter = contractConstraints.highlightPressure === 'strong'
  const distributedCenter = contractConstraints.highlightPressure === 'distributed'
  if (role === 'start') {
    return {
      intent: 'set-tone',
      energyLevel:
        contractConstraints.requireRecoveryWindows || strictContinuity
          ? 'low'
          : socialEnergy === 'high' || selectedDirection.cluster === 'lively'
            ? 'medium'
            : 'low',
      pacing: escalationMode || pacing === 'quick' ? 'quick' : 'balanced',
      variability:
        controlMode === 'user_directed'
          ? 'flexible'
          : controlMode === 'assistant_led'
            ? 'fixed'
            : 'guided-flex',
    }
  }
  if (role === 'highlight') {
    return {
      intent: 'centerpiece',
      energyLevel:
        distributedCenter && !escalationMode
          ? 'medium'
          : strongCenter || escalationMode || socialEnergy === 'high'
            ? 'high'
            : selectedDirection.cluster === 'chill'
              ? 'medium'
              : 'high',
      pacing: escalationMode ? 'quick' : 'balanced',
      variability:
        swapTolerance === 'high'
          ? 'flexible'
          : swapTolerance === 'medium'
            ? 'guided-flex'
            : 'fixed',
    }
  }
  return {
    intent: 'landing',
    energyLevel: 'low',
    pacing:
      contractConstraints.windDownStrictness === 'soft_required' ||
      pacing === 'linger' ||
      persona === 'romantic'
        ? 'linger'
        : 'balanced',
    variability: controlMode === 'assistant_led' ? 'fixed' : 'guided-flex',
  }
}

function dedupeInvariantTraits(traits: RouteInvariantTrait[]): RouteInvariantTrait[] {
  return [...new Set(traits)]
}

export function buildRouteRoleInvariants(params: {
  selectedDirection: DirectionPlanningSelection
  selectedDirectionContext: ResolvedDirectionContext
  conciergeIntent: ConciergeIntent
  contractConstraints: ContractConstraints
  arcShape: RouteShapeContract['arcShape']
  movementProfile: RouteShapeContract['movementProfile']
}): RouteShapeContract['roleInvariants'] {
  const {
    selectedDirection,
    selectedDirectionContext,
    conciergeIntent,
    contractConstraints,
    arcShape,
    movementProfile,
  } = params
  const archetypeHint = `${selectedDirectionContext.archetype} ${selectedDirectionContext.label}`.toLowerCase()
  const culturalLean =
    /culture|museum|gallery|ritual|explore|curated/.test(archetypeHint) ||
    selectedDirection.cluster === 'explore'
  const livelyLean =
    /lively|social|eventful|playful|night/.test(archetypeHint) ||
    selectedDirection.cluster === 'lively'
  const calmLean =
    selectedDirection.cluster === 'chill' ||
    conciergeIntent.experienceProfile.vibe === 'cozy' ||
    conciergeIntent.experienceProfile.vibe === 'chill'
  const tightMovement = movementProfile.radius === 'tight'
  const fastArc = arcShape === 'fast_open_strong_center_clean_landing'

  const startPreferred = dedupeInvariantTraits([
    contractConstraints.requireContinuity ? 'continuity' : 'contrast',
    calmLean ? 'calm' : 'social',
    tightMovement ? 'low_friction' : 'continuity',
    contractConstraints.requireRecoveryWindows ? 'buffer' : 'contrast',
  ])
  const highlightPreferred = dedupeInvariantTraits([
    culturalLean ? 'cultural' : 'social',
    livelyLean || fastArc || contractConstraints.requireEscalation ? 'lively' : 'continuity',
    contractConstraints.highlightPressure === 'distributed' ? 'social' : 'continuity',
  ])
  const windDownPreferred = dedupeInvariantTraits([
    'settling',
    'continuity',
    calmLean ? 'calm' : 'buffer',
    contractConstraints.requireRecoveryWindows ? 'buffer' : 'continuity',
  ])

  return {
    start: {
      requiredTraits: dedupeInvariantTraits([
        'low_friction',
        ...(contractConstraints.requireContinuity ? (['continuity'] as RouteInvariantTrait[]) : []),
      ]),
      preferredTraits: startPreferred,
      forbiddenTraits: contractConstraints.allowLateHighEnergy
        ? ['centerpiece']
        : ['centerpiece', 'late_night'],
      minRelativeIntensity: 'low',
      maxRelativeIntensity: 'medium',
      allowSwapToWeaker: true,
      allowEscalation: false,
    },
    highlight: {
      requiredTraits:
        contractConstraints.highlightPressure === 'distributed'
          ? ['continuity']
          : ['centerpiece'],
      preferredTraits: highlightPreferred,
      forbiddenTraits: contractConstraints.highlightPressure === 'distributed' ? [] : ['buffer'],
      minRelativeIntensity: 'medium',
      maxRelativeIntensity: 'at_most_highlight',
      allowSwapToWeaker: false,
      allowEscalation: contractConstraints.requireEscalation,
    },
    windDown: {
      requiredTraits: dedupeInvariantTraits([
        'continuity',
        ...(contractConstraints.requireRecoveryWindows ? (['settling'] as RouteInvariantTrait[]) : []),
      ]),
      preferredTraits: windDownPreferred,
      forbiddenTraits: contractConstraints.allowLateHighEnergy
        ? ['centerpiece']
        : ['centerpiece', 'late_night'],
      minRelativeIntensity: 'low',
      maxRelativeIntensity:
        contractConstraints.windDownStrictness === 'flexible'
          ? 'at_most_highlight'
          : 'below_highlight',
      allowSwapToWeaker: true,
      allowEscalation: false,
    },
    surprise: {
      requiredTraits: ['contrast'],
      preferredTraits: ['continuity'],
      forbiddenTraits: ['centerpiece'],
      minRelativeIntensity: 'low',
      maxRelativeIntensity: 'at_most_highlight',
      allowSwapToWeaker: true,
      allowEscalation: false,
    },
    support: {
      requiredTraits: ['continuity'],
      preferredTraits: ['buffer', 'low_friction'],
      forbiddenTraits: ['centerpiece'],
      minRelativeIntensity: 'low',
      maxRelativeIntensity: 'medium',
      allowSwapToWeaker: true,
      allowEscalation: false,
    },
  }
}

export function buildRouteShapeContract(params: {
  selectedDirection: DirectionPlanningSelection
  selectedDirectionContext: ResolvedDirectionContext
  conciergeIntent: ConciergeIntent
  contractConstraints: ContractConstraints
}): RouteShapeContract {
  const { selectedDirection, selectedDirectionContext, conciergeIntent, contractConstraints } = params
  console.assert(
    selectedDirectionContext.selectedDirectionId === selectedDirection.id,
    '[ARC-BOUNDARY] route shape requires consistent planning lineage (selection -> resolved context).',
  )
  const arcShape =
    contractConstraints.requireEscalation
      ? 'fast_open_strong_center_clean_landing'
      : contractConstraints.peakCountModel === 'cumulative' || selectedDirection.cluster === 'explore'
        ? 'focused_open_social_center_clean_landing'
        : 'steady_open_curated_center_soft_landing'
  const travelTolerance = conciergeIntent.constraintPosture.travelTolerance
  const movementRadius: RouteShapeContract['movementProfile']['radius'] =
    contractConstraints.movementTolerance === 'contained' ||
    contractConstraints.movementTolerance === 'compressed' ||
    travelTolerance === 'tight'
      ? 'tight'
      : contractConstraints.movementTolerance === 'moderate' || travelTolerance === 'balanced'
        ? 'balanced'
        : 'open'
  const movementProfile: RouteShapeContract['movementProfile'] = {
    radius: movementRadius,
    maxTransitionMinutes:
      movementRadius === 'tight'
        ? contractConstraints.movementTolerance === 'contained'
          ? 14
          : 18
        : movementRadius === 'balanced'
          ? 24
          : 32,
    neighborhoodContinuity:
      contractConstraints.requireContinuity || movementRadius === 'tight'
        ? 'strict'
        : movementRadius === 'balanced'
          ? 'preferred'
          : 'flexible',
  }
  const swapFlexibility: RouteShapeContract['mutationProfile']['swapFlexibility'] = contractConstraints
    .windDownStrictness === 'flexible'
    ? 'high'
    : contractConstraints.requireContinuity && contractConstraints.highlightPressure === 'strong'
      ? 'low'
      : conciergeIntent.constraintPosture.swapTolerance
  const roleProfile: Record<RouteShapeRole, RoleProfile> = {
    start: getRouteShapeRoleProfile('start', selectedDirection, conciergeIntent, contractConstraints),
    highlight: getRouteShapeRoleProfile('highlight', selectedDirection, conciergeIntent, contractConstraints),
    windDown: getRouteShapeRoleProfile('windDown', selectedDirection, conciergeIntent, contractConstraints),
  }
  const roleInvariants = buildRouteRoleInvariants({
    selectedDirection,
    selectedDirectionContext,
    conciergeIntent,
    contractConstraints,
    arcShape,
    movementProfile,
  })
  const preservePriority: Array<'role' | 'feasibility' | 'district' | 'family' | 'movement'> = [
    'role',
    'feasibility',
    'movement',
  ]
  if (
    conciergeIntent.realityPosture.coherencePriority !== 'low' ||
    conciergeIntent.constraintPosture.structureRigidity !== 'flexible'
  ) {
    preservePriority.push('district')
  }
  if (
    conciergeIntent.realityPosture.coherencePriority === 'high' ||
    conciergeIntent.constraintPosture.structureRigidity === 'tight'
  ) {
    preservePriority.push('family')
  }

  return {
    id: `rshape_v1_${selectedDirectionContext.selectedDirectionId}_${conciergeIntent.id}_${contractConstraints.id}`,
    arcShape,
    roleProfile,
    roleInvariants,
    movementProfile,
    mutationProfile: {
      swapFlexibility,
      allowedRoles: ['start', 'highlight', 'windDown'],
      preservePriority,
    },
    expansionProfile: {
      supportsNearbyExtensions: true,
      preferredExpansionRole:
        conciergeIntent.experienceProfile.explorationTolerance === 'high' ||
        selectedDirection.cluster === 'lively'
          ? 'highlight'
          : 'windDown',
      lateNightTolerance:
        contractConstraints.allowLateHighEnergy ||
        conciergeIntent.experienceProfile.socialEnergy === 'high'
          ? 'high'
          : contractConstraints.requireRecoveryWindows ||
              conciergeIntent.experienceProfile.socialEnergy === 'low'
            ? 'low'
            : 'medium',
    },
  }
}

export function validateDirectionRouteContract(params: {
  selectedDirectionContext?: ResolvedDirectionContext
  selectedDirection?: Pick<DirectionPlanningSelection, 'identity'>
  itinerary: Itinerary
  buildability: DirectionContractBuildability
}): DirectionContractValidationResult {
  // Canonical coordination validator: checks route adherence against planning lineage.
  // It should remain structural; meaning/buildability policy should be delegated by engine ownership.
  const { selectedDirectionContext, selectedDirection, itinerary, buildability } = params
  const hasHighlight = itinerary.stops.some((stop) => stop.role === 'highlight')
  const expectedDirectionIdentity =
    selectedDirectionContext?.identity ?? selectedDirection?.identity ?? 'exploratory'
  const greatStopQuality = selectedDirectionContext?.greatStopSignal
  const observedDirectionIdentity = inferObservedDirectionIdentity({
    itinerary,
    expectedDirectionIdentity,
  })

  if (!hasHighlight) {
    return {
      valid: false,
      generationDriftReason: 'missing highlight role in generated itinerary',
      expectedDirectionIdentity,
      observedDirectionIdentity,
      contractBuildabilityStatus: buildability.contractBuildabilityStatus,
      missingRoleForContract: buildability.missingRoleForContract,
      candidatePoolSufficiencyByRole: buildability.candidatePoolSufficiencyByRole,
      fallbackApplied: false,
      greatStopQuality,
      thinPoolRelaxationTrace: {
        triggered: false,
        expectedDirectionIdentity,
        observedDirectionIdentity,
        contractBuildabilityStatus: buildability.contractBuildabilityStatus,
        missingRoleForContract: buildability.missingRoleForContract,
        candidatePoolSufficiencyByRole: buildability.candidatePoolSufficiencyByRole,
        validationOutcome: 'rejected',
      },
    }
  }
  const identityMismatch = observedDirectionIdentity !== expectedDirectionIdentity
  if (identityMismatch) {
    if (buildability.contractBuildabilityStatus === 'thin') {
      return {
        valid: true,
        generationDriftReason: 'thin_pool_identity_relaxation',
        expectedDirectionIdentity,
        observedDirectionIdentity,
        contractBuildabilityStatus: buildability.contractBuildabilityStatus,
        missingRoleForContract: buildability.missingRoleForContract,
        candidatePoolSufficiencyByRole: buildability.candidatePoolSufficiencyByRole,
        fallbackApplied: true,
        greatStopQuality,
        thinPoolRelaxationTrace: {
          triggered: true,
          expectedDirectionIdentity,
          observedDirectionIdentity,
          contractBuildabilityStatus: buildability.contractBuildabilityStatus,
          missingRoleForContract: buildability.missingRoleForContract,
          candidatePoolSufficiencyByRole: buildability.candidatePoolSufficiencyByRole,
          relaxationReason: 'identity_mismatch_with_thin_role_supply',
          relaxedRule: 'identity_mismatch_softened_when_contract_buildability_is_thin',
          validationOutcome: 'accepted_with_relaxation',
        },
      }
    }
    return {
      valid: false,
      generationDriftReason: 'identity_mismatch',
      expectedDirectionIdentity,
      observedDirectionIdentity,
      contractBuildabilityStatus: buildability.contractBuildabilityStatus,
      missingRoleForContract: buildability.missingRoleForContract,
      candidatePoolSufficiencyByRole: buildability.candidatePoolSufficiencyByRole,
      fallbackApplied: false,
      greatStopQuality,
      thinPoolRelaxationTrace: {
        triggered: false,
        expectedDirectionIdentity,
        observedDirectionIdentity,
        contractBuildabilityStatus: buildability.contractBuildabilityStatus,
        missingRoleForContract: buildability.missingRoleForContract,
        candidatePoolSufficiencyByRole: buildability.candidatePoolSufficiencyByRole,
        validationOutcome: 'rejected',
      },
    }
  }
  return {
    valid: true,
    generationDriftReason: null,
    expectedDirectionIdentity,
    observedDirectionIdentity,
    contractBuildabilityStatus: buildability.contractBuildabilityStatus,
    missingRoleForContract: buildability.missingRoleForContract,
    candidatePoolSufficiencyByRole: buildability.candidatePoolSufficiencyByRole,
    fallbackApplied: false,
    greatStopQuality,
    thinPoolRelaxationTrace: {
      triggered: false,
      expectedDirectionIdentity,
      observedDirectionIdentity,
      contractBuildabilityStatus: buildability.contractBuildabilityStatus,
      missingRoleForContract: buildability.missingRoleForContract,
      candidatePoolSufficiencyByRole: buildability.candidatePoolSufficiencyByRole,
      validationOutcome: 'accepted_without_relaxation',
    },
  }
}

function getStopIntensity(stop: Pick<ItineraryStop, 'category' | 'tags'> | undefined): RouteInvariantIntensity {
  if (!stop) {
    return 'medium'
  }
  const tags = toTagSet(stop.tags)
  if (
    tags.has('late-night') ||
    tags.has('night-owl') ||
    tags.has('high-energy') ||
    tags.has('buzzing')
  ) {
    return 'high'
  }
  if (
    stop.category === 'live_music' ||
    stop.category === 'event' ||
    ['live', 'music', 'jazz', 'performance'].some((tag) => tags.has(tag))
  ) {
    return 'high'
  }
  if (
    stop.category === 'cafe' ||
    stop.category === 'dessert' ||
    stop.category === 'park' ||
    ['quiet', 'cozy', 'tea', 'conversation', 'walk-up'].some((tag) => tags.has(tag))
  ) {
    return 'low'
  }
  return 'medium'
}

function toIntensityRank(intensity: RouteInvariantIntensity): number {
  if (intensity === 'low') {
    return 1
  }
  if (intensity === 'medium') {
    return 2
  }
  return 3
}

function getStopInvariantTraits(stop: ItineraryStop): Set<RouteInvariantTrait> {
  const traits = new Set<RouteInvariantTrait>()
  const tags = toTagSet(stop.tags)
  const intensity = getStopIntensity(stop)

  if (
    stop.driveMinutes <= 10 ||
    stop.category === 'cafe' ||
    stop.category === 'dessert' ||
    ['quick-start', 'walk-up', 'coffee', 'tea-room'].some((tag) => tags.has(tag))
  ) {
    traits.add('low_friction')
  }
  if (stop.driveMinutes <= 16) {
    traits.add('continuity')
  }
  if (
    stop.category === 'live_music' ||
    stop.category === 'event' ||
    stop.category === 'bar' ||
    ['jazz', 'performance', 'chef-led', 'tasting', 'signature', 'cocktails', 'social'].some((tag) =>
      tags.has(tag),
    )
  ) {
    traits.add('centerpiece')
  }
  if (
    stop.category === 'bar' ||
    ['social', 'cocktails', 'live', 'music', 'lively'].some((tag) => tags.has(tag))
  ) {
    traits.add('social')
  }
  if (
    stop.category === 'museum' ||
    stop.category === 'activity' ||
    ['culture', 'gallery', 'curated'].some((tag) => tags.has(tag))
  ) {
    traits.add('cultural')
  }
  if (
    stop.category === 'cafe' ||
    stop.category === 'dessert' ||
    stop.category === 'park' ||
    ['buffer', 'transition', 'coffee', 'pastry'].some((tag) => tags.has(tag))
  ) {
    traits.add('buffer')
  }
  if (
    stop.category === 'dessert' ||
    ['quiet', 'cozy', 'tea', 'conversation', 'wind-down', 'dessert'].some((tag) => tags.has(tag))
  ) {
    traits.add('settling')
    traits.add('calm')
  }
  if (
    intensity === 'high' ||
    ['late-night', 'night-owl', 'high-energy', 'buzzing', 'lively'].some((tag) => tags.has(tag))
  ) {
    traits.add('lively')
  }
  if (tags.has('late-night') || tags.has('night-owl')) {
    traits.add('late_night')
  }
  if (
    ['explore', 'experimental', 'creative', 'unexpected', 'adventure'].some((tag) =>
      tags.has(tag),
    )
  ) {
    traits.add('contrast')
  }
  if (
    traits.has('social') ||
    traits.has('cultural') ||
    traits.has('calm') ||
    traits.has('buffer')
  ) {
    traits.add('continuity')
  }
  return traits
}

function getRoleInvariantProfileForSwap(
  role: UserStopRole,
  contract: RouteShapeContract,
): RoleInvariantProfile | undefined {
  if (role === 'start') {
    return contract.roleInvariants.start
  }
  if (role === 'highlight') {
    return contract.roleInvariants.highlight
  }
  if (role === 'windDown') {
    return contract.roleInvariants.windDown
  }
  const roleToken = role as string
  if (roleToken === 'surprise') {
    return contract.roleInvariants.surprise
  }
  if (roleToken === 'support') {
    return contract.roleInvariants.support
  }
  return undefined
}

export function evaluateHardStructuralSwapCompatibility(
  params: HardStructuralSwapCompatibilityInput,
): HardStructuralSwapCompatibilityEvaluation {
  // Canonical Waypoint structural swap gate: enforces role/order/movement invariants.
  const {
    role,
    targetRole,
    targetStopIndex,
    hasTargetSlotAtIndex,
    targetSlotRoleAtIndex,
    requestedReplacementId,
    candidateStop,
    originalStop,
    canonicalItinerary,
    baselineItinerary,
    routeShapeContract,
    requireReplacementCanonicalProvider,
    replacementCanonicalProviderId,
  } = params
  const roleSequenceBefore = baselineItinerary.stops.map((stop) => stop.role).join('>')
  const roleSequenceAfter = canonicalItinerary.stops.map((stop) => stop.role).join('>')
  const hasHighlight = canonicalItinerary.stops.some((stop) => stop.role === 'highlight')
  const roleAllowedByShape =
    (role === 'start' || role === 'highlight' || role === 'windDown') &&
    routeShapeContract.mutationProfile.allowedRoles.includes(role)
  const movementLimit = Math.max(routeShapeContract.movementProfile.maxTransitionMinutes, 1)
  const movementFlexAllowance =
    routeShapeContract.mutationProfile.swapFlexibility === 'high'
      ? 6
      : routeShapeContract.mutationProfile.swapFlexibility === 'medium'
        ? 3
        : 0
  const hardMovementLimit = movementLimit + movementFlexAllowance
  const transitionsWithinShape = canonicalItinerary.transitions.every(
    (transition) =>
      Number.isFinite(transition.estimatedTravelMinutes) &&
      transition.estimatedTravelMinutes >= 0 &&
      transition.estimatedTravelMinutes <= movementLimit,
  )
  const transitionsFeasible = canonicalItinerary.transitions.every(
    (transition) =>
      Number.isFinite(transition.estimatedTravelMinutes) &&
      transition.estimatedTravelMinutes >= 0 &&
      transition.estimatedTravelMinutes <= hardMovementLimit,
  )
  const preservedRole =
    targetRole === role &&
    candidateStop.role === role &&
    canonicalItinerary.stops.some((stop) => stop.role === role) &&
    roleAllowedByShape
  const preservedFeasibility =
    transitionsFeasible &&
    hasHighlight &&
    canonicalItinerary.stops.length === baselineItinerary.stops.length &&
    roleSequenceBefore === roleSequenceAfter
  const fail = (
    hardRejectCode: string,
    reason: string,
    nextPreservedRole = preservedRole,
  ): HardStructuralSwapCompatibilityFailure => ({
    passed: false,
    reason,
    hardRejectCode,
    preservedRole: nextPreservedRole,
    preservedFeasibility,
  })

  if (!hasTargetSlotAtIndex) {
    return fail(
      'target_slot_missing',
      `Swap rejected: route slot ${targetStopIndex} is unavailable for ${role}.`,
      false,
    )
  }
  if (targetSlotRoleAtIndex && targetSlotRoleAtIndex !== role) {
    return fail(
      'target_role_mismatch',
      `Swap rejected: slot ${targetStopIndex} now maps to ${targetSlotRoleAtIndex}, expected ${role}.`,
      false,
    )
  }
  if (!requestedReplacementId) {
    return fail('replacement_id_missing', 'Swap rejected: replacement id is missing.', false)
  }
  if (candidateStop.venueId !== requestedReplacementId) {
    return fail(
      'replacement_id_mismatch',
      `Swap rejected: requested ${requestedReplacementId} but candidate resolved to ${candidateStop.venueId}.`,
      false,
    )
  }
  if (candidateStop.role !== role) {
    return fail(
      'replacement_role_mismatch',
      `Swap rejected: candidate role ${candidateStop.role} does not match requested role ${role}.`,
      false,
    )
  }
  if (
    requireReplacementCanonicalProvider &&
    (!replacementCanonicalProviderId || !replacementCanonicalProviderId.trim())
  ) {
    return fail(
      'replacement_missing_canonical_provider',
      `Swap rejected: replacement ${candidateStop.venueName} is missing canonical provider identity.`,
      false,
    )
  }
  if (!preservedRole) {
    return fail(
      'role_not_preserved',
      `Swap rejected: route would no longer preserve ${role} role semantics.`,
      false,
    )
  }
  if (!hasHighlight) {
    return fail(
      'highlight_missing',
      'Swap rejected: resulting itinerary no longer has a highlight stop.',
    )
  }
  if (roleSequenceBefore !== roleSequenceAfter) {
    return fail(
      'role_sequence_changed',
      `Swap rejected: role sequence changed (${roleSequenceBefore} -> ${roleSequenceAfter}).`,
    )
  }
  if (!transitionsFeasible) {
    return fail(
      'movement_limit_exceeded',
      `Swap rejected: transitions exceed structural movement envelope (${hardMovementLimit} min).`,
    )
  }

  const roleInvariant = getRoleInvariantProfileForSwap(role, routeShapeContract)
  let preferredRoleTraitMissing: RouteInvariantTrait[] = []
  if (roleInvariant) {
    const replacementTraits = getStopInvariantTraits(candidateStop)
    const originalTraits = getStopInvariantTraits(originalStop)

    const requiredMissing = roleInvariant.requiredTraits.filter(
      (trait) => !replacementTraits.has(trait),
    )
    if (requiredMissing.length > 0) {
      return fail(
        'required_invariant_missing',
        `Swap rejected: ${role} replacement is missing required traits (${requiredMissing.join(', ')}).`,
      )
    }
    const forbiddenTriggered = roleInvariant.forbiddenTraits.filter((trait) =>
      replacementTraits.has(trait),
    )
    if (forbiddenTriggered.length > 0) {
      return fail(
        'forbidden_invariant_triggered',
        `Swap rejected: ${role} replacement violates forbidden traits (${forbiddenTriggered.join(', ')}).`,
      )
    }

    if (roleInvariant.minRelativeIntensity) {
      const replacementIntensity = toIntensityRank(getStopIntensity(candidateStop))
      const minIntensity = toIntensityRank(roleInvariant.minRelativeIntensity)
      if (replacementIntensity < minIntensity) {
        return fail(
          'intensity_below_min',
          `Swap rejected: ${role} replacement intensity is below ${roleInvariant.minRelativeIntensity}.`,
        )
      }
    }

    if (roleInvariant.maxRelativeIntensity) {
      const replacementIntensity = toIntensityRank(getStopIntensity(candidateStop))
      const maxRelative = roleInvariant.maxRelativeIntensity
      if (maxRelative === 'low' || maxRelative === 'medium' || maxRelative === 'high') {
        const maxIntensity = toIntensityRank(maxRelative)
        if (replacementIntensity > maxIntensity) {
          return fail(
            'intensity_above_max',
            `Swap rejected: ${role} replacement intensity exceeds ${maxRelative}.`,
          )
        }
      }
      if (maxRelative === 'below_highlight') {
        const highlightStop = canonicalItinerary.stops.find((stop) => stop.role === 'highlight')
        const highlightIntensity = toIntensityRank(getStopIntensity(highlightStop))
        if (replacementIntensity >= highlightIntensity) {
          return fail(
            'intensity_not_below_highlight',
            `Swap rejected: ${role} replacement must stay below highlight intensity.`,
          )
        }
      }
      if (maxRelative === 'at_most_highlight') {
        const highlightStop = canonicalItinerary.stops.find((stop) => stop.role === 'highlight')
        const highlightIntensity = toIntensityRank(getStopIntensity(highlightStop))
        if (replacementIntensity > highlightIntensity) {
          return fail(
            'intensity_above_highlight',
            `Swap rejected: ${role} replacement exceeds highlight intensity ceiling.`,
          )
        }
      }
    }

    if (!roleInvariant.allowSwapToWeaker) {
      const replacementIntensity = toIntensityRank(getStopIntensity(candidateStop))
      const originalIntensity = toIntensityRank(getStopIntensity(originalStop))
      if (replacementIntensity < originalIntensity) {
        return fail(
          'weaker_swap_disallowed',
          `Swap rejected: ${role} cannot downgrade intensity under current contract.`,
        )
      }
    }

    preferredRoleTraitMissing = roleInvariant.preferredTraits.filter(
      (trait) => originalTraits.has(trait) && !replacementTraits.has(trait),
    )
  }

  return {
    passed: true,
    preservedRole,
    preservedFeasibility,
    transitionsWithinShape,
    preferredRoleTraitMissing,
  }
}
