/**
 * ARC COMPATIBILITY BOUNDARY: Waypoint coordination contracts and structural validators.
 *
 * Owns:
 * - route shape contract and role invariants
 * - structural route/swap compatibility checks
 *
 * Compatibility exports:
 * - selected direction projection from Interpretation/Direction
 *
 * Does NOT own:
 * - selected direction projection authorship
 * - interpretation semantic authorship
 * - bearings feasibility/admissibility truth
 * - product copy decisions
 */
import type {
  DirectionContractBuildability,
  DirectionCoreRole,
} from '../bearings/assessDirectionContractBuildability'
import { inferObservedDirectionIdentity } from '../interpretation/direction/directionIdentity'
import { buildPlaceRightMovementProfile } from '../interpretation/buildPlaceRightMovementProfile'
import type {
  DirectionIdentityMode,
  DirectionPlanningSelection,
} from '../interpretation/direction/selectedDirectionProjection'
export {
  buildDirectionPlanningSelection,
  buildIntentSelectedDirectionContext,
  buildResolvedDirectionContext,
} from '../interpretation/direction/selectedDirectionProjection'
export type {
  BuildDirectionPlanningSelectionInput,
  DirectionIdentityMode,
  DirectionPlanningSelection,
} from '../interpretation/direction/selectedDirectionProjection'
import type {
  ConciergeIntent,
  ContractConstraints,
  ResolvedDirectionContext,
  SelectedDirectionContext,
  RoleInvariantProfile,
  RouteInvariantIntensity,
  RouteInvariantTrait,
  RouteShapeContract,
  RouteShapePlaceRightLocationClass,
  RouteShapeRole,
  RoleProfile,
} from '../types/intent'
import type { Itinerary, ItineraryStop, UserStopRole } from '../types/itinerary'

export interface DirectionContractValidationResult {
  valid: boolean
  validatorMode?: 'surprise' | 'curate' | 'build' | 'unknown'
  generationDriftReason: string | null
  expectedDirectionIdentity: DirectionIdentityMode
  observedDirectionIdentity: DirectionIdentityMode
  directionAlignmentScore?: number
  surpriseSoftAlignmentFloor?: number
  surpriseHardAlignmentFloor?: number
  surpriseMaterialAlignmentFloor?: number
  lowAlignment?: boolean
  hardAlignmentFailure?: boolean
  materialAlignmentFailure?: boolean
  severeGreatStopRisk?: boolean
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

function normalizeAlignmentSignal(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenizeDirectionSignal(value: string | undefined): string[] {
  if (!value) {
    return []
  }
  return normalizeAlignmentSignal(value)
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
}

function tokenMatchesStem(token: string, stems: string[]): boolean {
  return stems.some((stem) => token === stem || token.startsWith(stem))
}

function mapTokenToSemanticChannels(token: string): Array<'social' | 'exploratory' | 'intimate'> {
  const channels = new Set<'social' | 'exploratory' | 'intimate'>()

  if (
    tokenMatchesStem(token, [
      'social',
      'lively',
      'night',
      'party',
      'dance',
      'music',
      'live',
      'buzz',
      'vibrant',
      'bar',
      'cocktail',
      'club',
      'arcade',
      'show',
      'event',
    ])
  ) {
    channels.add('social')
  }
  if (
    tokenMatchesStem(token, [
      'explor',
      'discover',
      'culture',
      'cultur',
      'museum',
      'gallery',
      'art',
      'curat',
      'hidden',
      'market',
      'indie',
      'local',
    ])
  ) {
    channels.add('exploratory')
  }
  if (
    tokenMatchesStem(token, [
      'intimate',
      'cozy',
      'calm',
      'quiet',
      'relax',
      'romantic',
      'lounge',
      'wine',
      'dessert',
      'cafe',
      'patio',
    ])
  ) {
    channels.add('intimate')
  }

  return [...channels]
}

function withSemanticChannels(tokens: string[]): string[] {
  const expanded = new Set<string>()
  for (const token of tokens) {
    expanded.add(token)
    for (const channel of mapTokenToSemanticChannels(token)) {
      expanded.add(`sem:${channel}`)
    }
  }
  return [...expanded]
}

function computeDirectionContextAlignment(params: {
  itinerary: Itinerary
  context: ResolvedDirectionContext
}): number {
  const weightedTokens = new Map<string, number>()
  const addTokens = (tokens: string[], weight: number, includeSemantic = true) => {
    const scopedTokens = includeSemantic ? withSemanticChannels(tokens) : tokens
    for (const token of scopedTokens) {
      const tokenWeight = token.startsWith('sem:') ? weight * 0.92 : weight
      if (tokenWeight <= 0) {
        continue
      }
      weightedTokens.set(token, Math.max(tokenWeight, weightedTokens.get(token) ?? 0))
    }
  }
  const addSemanticIdentityToken = (identity: ResolvedDirectionContext['identity'] | undefined, weight: number) => {
    if (!identity) {
      return
    }
    for (const token of withSemanticChannels(tokenizeDirectionSignal(identity))) {
      weightedTokens.set(token, Math.max(weight, weightedTokens.get(token) ?? 0))
    }
  }
  addTokens(tokenizeDirectionSignal(params.context.label), 1.15)
  addTokens(tokenizeDirectionSignal(params.context.archetype), 1.35)
  addTokens(tokenizeDirectionSignal(params.context.selectedPocketId), 0.35, false)
  addTokens(tokenizeDirectionSignal(params.context.selectedDirectionId), 0.25, false)
  addSemanticIdentityToken(params.context.identity, 1.45)

  if (weightedTokens.size === 0) {
    return 0
  }

  const roleWeightByRole: Partial<Record<UserStopRole, number>> = {
    start: 0.25,
    highlight: 0.5,
    surprise: 0.08,
    windDown: 0.17,
  }
  let weightedMatches = 0
  let weightedPossible = 0
  for (const stop of params.itinerary.stops) {
    const roleWeight = roleWeightByRole[stop.role] ?? 0
    if (roleWeight <= 0) {
      continue
    }
    const stopTokens = new Set<string>(
      withSemanticChannels([
        ...tokenizeDirectionSignal(stop.venueName),
        ...tokenizeDirectionSignal(stop.neighborhood),
        ...tokenizeDirectionSignal(stop.subcategory),
        ...tokenizeDirectionSignal(stop.category),
        ...stop.tags.flatMap((tag) => tokenizeDirectionSignal(tag)),
      ]),
    )
    let stopMatched = 0
    let stopPossible = 0
    for (const [token, tokenWeight] of weightedTokens.entries()) {
      stopPossible += tokenWeight
      if (stopTokens.has(token)) {
        stopMatched += tokenWeight
      }
    }
    if (stopPossible > 0) {
      weightedMatches += roleWeight * (stopMatched / stopPossible)
      weightedPossible += roleWeight
    }
  }
  return weightedPossible > 0 ? Math.max(0, Math.min(1, weightedMatches / weightedPossible)) : 0
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
  placeRightLocationClass?: RouteShapePlaceRightLocationClass
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
    ...(params.placeRightLocationClass
      ? {
          placeRightTolerance: buildPlaceRightMovementProfile({
            persona: conciergeIntent.experienceProfile.persona,
            locationClass: params.placeRightLocationClass,
          }),
        }
      : {}),
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

function normalizeDirectionToken(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function stopHasAnyToken(
  stop: Pick<ItineraryStop, 'category' | 'tags' | 'vibeTags'>,
  tokens: Set<string>,
): boolean {
  const values = [stop.category, ...stop.tags, ...(stop.vibeTags ?? [])]
  return values.some((value) => tokens.has(normalizeDirectionToken(value)))
}

function isEasyHangIntimateCompatibility(params: {
  mode?: 'surprise' | 'curate' | 'build'
  expectedDirectionIdentity: unknown
  observedDirectionIdentity: DirectionIdentityMode
  selectedDirectionContext?: ResolvedDirectionContext
  itinerary: Itinerary
  previewScenarioFamily?: string
}): { compatible: boolean; reason: string } {
  if (params.mode !== 'build') {
    return { compatible: false, reason: 'not_build_mode' }
  }
  if (normalizeDirectionToken(params.expectedDirectionIdentity) !== 'easy_hang') {
    return { compatible: false, reason: 'expected_identity_not_easy_hang' }
  }
  if (params.observedDirectionIdentity !== 'intimate') {
    return { compatible: false, reason: 'observed_identity_not_intimate' }
  }

  const context = params.selectedDirectionContext as
    | (ResolvedDirectionContext & {
        directionId?: string
        pocketId?: string
        cluster?: string
      })
    | undefined
  const contextTokens = [
    context?.selectedDirectionId,
    context?.directionId,
    context?.label,
    context?.archetype,
    context?.cluster,
    params.previewScenarioFamily,
  ]
    .map(normalizeDirectionToken)
    .filter(Boolean)
  const selectedEasyHang =
    contextTokens.includes('easy_hang') ||
    contextTokens.includes('friends_cozy') ||
    contextTokens.some((token) => token.includes('easy hang'))
  if (!selectedEasyHang) {
    return { compatible: false, reason: 'selected_context_not_easy_hang' }
  }

  const start = params.itinerary.stops.find((stop) => stop.role === 'start')
  const highlight = params.itinerary.stops.find((stop) => stop.role === 'highlight')
  const windDown = params.itinerary.stops.find((stop) => stop.role === 'windDown')
  if (!start || !highlight || !windDown) {
    return { compatible: false, reason: 'missing_core_role' }
  }

  const hardIncompatibleTokens = new Set([
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
  if (params.itinerary.stops.some((stop) => stopHasAnyToken(stop, hardIncompatibleTokens))) {
    return { compatible: false, reason: 'hard_incompatible_easy_hang_signal' }
  }

  const lowPressureTokens = new Set([
    'bakery',
    'cafe',
    'casual-american',
    'dessert',
    'friends',
    'group-friendly',
    'neighborhood',
    'provider-backed',
    'relaxed',
    'restaurant',
    'tea',
  ])
  const everyStopLowPressure = [start, highlight, windDown].every((stop) =>
    stopHasAnyToken(stop, lowPressureTokens),
  )
  if (!everyStopLowPressure) {
    return { compatible: false, reason: 'missing_low_pressure_easy_hang_signal' }
  }

  return { compatible: true, reason: 'complete_low_pressure_friends_shape' }
}

export function validateDirectionRouteContract(params: {
  selectedDirectionContext?: ResolvedDirectionContext
  selectedDirection?: Pick<DirectionPlanningSelection, 'identity'>
  itinerary: Itinerary
  buildability: DirectionContractBuildability
  mode?: 'surprise' | 'curate' | 'build'
  previewScenarioFamily?: string
}): DirectionContractValidationResult {
  // Canonical coordination validator: checks route adherence against planning lineage.
  // It should remain structural; meaning/buildability policy should be delegated by engine ownership.
  const { selectedDirectionContext, selectedDirection, itinerary, buildability } = params
  const validatorMode = params.mode ?? 'unknown'
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
      validatorMode,
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
    const easyHangIntimateCompatibility = isEasyHangIntimateCompatibility({
      mode: params.mode,
      expectedDirectionIdentity,
      observedDirectionIdentity,
      selectedDirectionContext,
      itinerary,
      previewScenarioFamily: params.previewScenarioFamily,
    })
    if (easyHangIntimateCompatibility.compatible) {
      return {
        valid: true,
        validatorMode,
        generationDriftReason: 'easy_hang_intimate_semantic_compatibility',
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
          relaxationReason: 'easy_hang_intimate_semantic_compatibility',
          relaxedRule:
            'build_easy_hang_accepts_intimate_identity_when_complete_low_pressure_friends_shape_survives',
          validationOutcome: 'accepted_with_relaxation',
        },
      }
    }
    const culturedSocialIdentityTolerance =
      expectedDirectionIdentity === 'exploratory' &&
      observedDirectionIdentity === 'social' &&
      Boolean(params.previewScenarioFamily?.endsWith('_cultured'))
    if (culturedSocialIdentityTolerance) {
      return {
        valid: true,
        validatorMode,
        generationDriftReason: 'cultured_social_identity_tolerance',
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
          relaxationReason: 'cultured_social_identity_tolerance',
          relaxedRule:
            'exploratory_expected_identity_accepts_social_observed_identity_for_cultured_scenario_family',
          validationOutcome: 'accepted_with_relaxation',
        },
      }
    }
    if (buildability.contractBuildabilityStatus === 'thin') {
      return {
        valid: true,
        validatorMode,
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
      validatorMode,
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
  if (params.mode === 'surprise' && selectedDirectionContext) {
    const directionAlignment = computeDirectionContextAlignment({
      itinerary,
      context: selectedDirectionContext,
    })
    // Surprise-specific calibration:
    // keep hard rejection for materially low alignment, but widen borderline acceptance
    // so forward progression better matches the Step 2 preview contract.
    const surpriseHardAlignmentFloor = 0.06
    const surpriseSoftAlignmentFloor = 0.12
    const surpriseMaterialAlignmentFloor = 0.03
    const lowAlignment = directionAlignment < surpriseSoftAlignmentFloor
    const hardAlignmentFailure = directionAlignment < surpriseHardAlignmentFloor
    const materialAlignmentFailure = directionAlignment < surpriseMaterialAlignmentFloor
    const severeGreatStopRisk =
      greatStopQuality?.suppressionRecommended === true && greatStopQuality?.riskTier === 'severe'
    if (lowAlignment) {
      const canRelaxForThinSupply = buildability.contractBuildabilityStatus === 'thin'
      const canRelaxForBorderlineSufficient =
        buildability.contractBuildabilityStatus === 'sufficient' &&
        !materialAlignmentFailure &&
        !severeGreatStopRisk
      if (canRelaxForThinSupply || canRelaxForBorderlineSufficient) {
        const relaxationReason = canRelaxForThinSupply
          ? 'surprise_direction_alignment_with_thin_role_supply'
          : hardAlignmentFailure
            ? 'surprise_direction_alignment_borderline_with_sufficient_supply'
            : 'surprise_direction_alignment_near_match'
        const relaxedRule = canRelaxForThinSupply
          ? 'surprise_direction_alignment_softened_when_contract_buildability_is_thin'
          : hardAlignmentFailure
            ? 'surprise_direction_alignment_softened_for_borderline_match_with_sufficient_supply'
            : 'surprise_direction_alignment_softened_for_near_match_with_sufficient_supply'
        return {
          valid: true,
          validatorMode,
          generationDriftReason: 'surprise_direction_alignment_relaxed',
          directionAlignmentScore: directionAlignment,
          surpriseSoftAlignmentFloor,
          surpriseHardAlignmentFloor,
          surpriseMaterialAlignmentFloor,
          lowAlignment,
          hardAlignmentFailure,
          materialAlignmentFailure,
          severeGreatStopRisk,
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
            relaxationReason,
            relaxedRule,
            validationOutcome: 'accepted_with_relaxation',
          },
        }
      }
      const rejectionReason = severeGreatStopRisk
        ? 'surprise_direction_alignment_with_severe_great_stop_risk'
        : materialAlignmentFailure
          ? 'surprise_direction_alignment_material_mismatch'
          : 'surprise_direction_alignment_mismatch'
      return {
        valid: false,
        validatorMode,
        generationDriftReason: rejectionReason,
        directionAlignmentScore: directionAlignment,
        surpriseSoftAlignmentFloor,
        surpriseHardAlignmentFloor,
        surpriseMaterialAlignmentFloor,
        lowAlignment,
        hardAlignmentFailure,
        materialAlignmentFailure,
        severeGreatStopRisk,
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
      validatorMode,
      generationDriftReason: null,
      directionAlignmentScore: directionAlignment,
      surpriseSoftAlignmentFloor,
      surpriseHardAlignmentFloor,
      surpriseMaterialAlignmentFloor,
      lowAlignment,
      hardAlignmentFailure,
      materialAlignmentFailure,
      severeGreatStopRisk,
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
  return {
    valid: true,
    validatorMode,
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
