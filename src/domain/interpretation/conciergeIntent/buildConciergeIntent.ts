import type { StarterPack } from '../../types/starterPack'
import type {
  ConciergeIntent,
  ConciergeIntentCandidateLineage,
  ConciergeObjectiveOccasion,
  BuildSoftFeasibleRecoveryAction,
  BuildSoftFeasibleRecoveryChoice,
  ExperienceMode,
  PersonaMode,
  PlanAnchor,
  RouteShapeContract,
  VibeAnchor,
} from '../../types/intent'

type ConciergeIntentAdapterMode = ExperienceMode
export type BuildAnchorRoleProvenanceSource =
  | 'explicit'
  | 'inferred'
  | 'defaulted_highlight'
  | 'missing'

type AnchorPostureWithRoleProvenance = ConciergeIntent['anchorPosture'] & {
  roleResolutionSource?: BuildAnchorRoleProvenanceSource
}

type AnchorLineageWithRoleProvenance = ConciergeIntent['anchorLineage'] & {
  roleResolutionSource?: BuildAnchorRoleProvenanceSource
}

type PlanAnchorWithRoleProvenance = PlanAnchor & {
  roleResolutionSource?: BuildAnchorRoleProvenanceSource
}

export interface BuildApplicationConciergeIntentParams {
  mode: ConciergeIntentAdapterMode
  persona: PersonaMode
  primaryVibe: VibeAnchor
  city: string
  objectiveOccasion?: ConciergeObjectiveOccasion
  objectiveSource?: ConciergeIntent['objectiveSource']
  starterPack?: StarterPack | null
  anchor?: PlanAnchor | null
  anchorDisplayName?: string | null
  anchorRoleResolutionSource?: BuildAnchorRoleProvenanceSource
  candidateLineage?: ConciergeIntentCandidateLineage | null
  buildSoftFeasibleRecovery?: {
    action: BuildSoftFeasibleRecoveryAction
    originatingMovementProfile: RouteShapeContract['movementProfile']
  } | null
}

function normalizeConciergeIntentToken(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) {
    return 'na'
  }
  const token = normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return token.length > 0 ? token : 'na'
}

function getConciergeSocialEnergy(vibe: VibeAnchor): ConciergeIntent['experienceProfile']['socialEnergy'] {
  if (vibe === 'lively' || vibe === 'playful') {
    return 'high'
  }
  if (vibe === 'cozy' || vibe === 'chill') {
    return 'low'
  }
  return 'medium'
}

function getConciergeExplorationTolerance(params: {
  persona: PersonaMode
  vibe: VibeAnchor
}): ConciergeIntent['experienceProfile']['explorationTolerance'] {
  const { persona, vibe } = params
  if (
    vibe === 'adventurous-outdoor' ||
    vibe === 'adventurous-urban' ||
    vibe === 'cultured'
  ) {
    return 'high'
  }
  if (vibe === 'chill' || vibe === 'cozy' || persona === 'family') {
    return 'low'
  }
  return 'medium'
}

function getConciergePacing(params: {
  persona: PersonaMode
  vibe: VibeAnchor
}): ConciergeIntent['experienceProfile']['pacing'] {
  const { persona, vibe } = params
  if (vibe === 'lively' || vibe === 'playful') {
    return 'quick'
  }
  if (vibe === 'chill' && persona !== 'family') {
    return 'linger'
  }
  if (persona === 'romantic' && (vibe === 'cozy' || vibe === 'chill')) {
    return 'linger'
  }
  return 'balanced'
}

function getModeIntentFields(mode: ConciergeIntentAdapterMode): {
  intentMode: ConciergeIntent['intentMode']
  objectivePrimary: ConciergeIntent['objective']['primary']
  controlMode: ConciergeIntent['controlPosture']['mode']
} {
  if (mode === 'surprise') {
    return {
      intentMode: 'surprise',
      objectivePrimary: 'discover_route_shape',
      controlMode: 'assistant_led',
    }
  }
  if (mode === 'build') {
    return {
      intentMode: 'anchored',
      objectivePrimary: 'lock_anchor_and_sequence',
      controlMode: 'user_directed',
    }
  }
  return {
    intentMode: 'curated',
    objectivePrimary: 'stabilize_selected_direction',
    controlMode: 'guided_assist',
  }
}

function getAnchorPosture(params: {
  mode: ConciergeIntentAdapterMode
  city: string
  starterPack?: StarterPack | null
  anchor?: PlanAnchor | null
  anchorRoleResolutionSource?: BuildAnchorRoleProvenanceSource
}): AnchorPostureWithRoleProvenance {
  const { mode, city, starterPack, anchor } = params
  if (mode === 'build') {
    const anchorRoleProvenance = anchor as PlanAnchorWithRoleProvenance | null | undefined
    const roleResolutionSource = anchor?.role
      ? params.anchorRoleResolutionSource ?? anchorRoleProvenance?.roleResolutionSource ?? 'explicit'
      : 'missing'
    return {
      mode: 'hard',
      anchorType: 'venue',
      anchorValue: anchor?.venueId,
      ...(anchor?.role ? { roleHint: anchor.role } : {}),
      roleResolutionSource,
      timeBound: 'tonight',
    }
  }
  if (mode === 'curate' && starterPack) {
    return {
      mode: 'soft',
      anchorType: 'none',
      anchorValue: starterPack.id,
      timeBound: 'tonight',
    }
  }
  return {
    mode: 'none',
    anchorType: 'none',
    anchorValue: city.trim() || undefined,
    timeBound: 'tonight',
  }
}

function getStarterLineage(
  params: BuildApplicationConciergeIntentParams,
): ConciergeIntent['starterLineage'] {
  if (params.mode === 'surprise') {
    return {
      source: 'system_seeded',
    }
  }
  if (params.mode === 'curate' && params.starterPack) {
    return {
      source: 'starter_pack',
      starterPackId: params.starterPack.id,
      title: params.starterPack.title,
      personaBias: params.starterPack.personaBias,
      primaryAnchor: params.starterPack.primaryAnchor,
      secondaryAnchors: params.starterPack.secondaryAnchors,
    }
  }
  return {
    source: 'none',
  }
}

function getAnchorLineage(
  params: BuildApplicationConciergeIntentParams,
): AnchorLineageWithRoleProvenance {
  if (params.mode === 'build' && params.anchor?.venueId) {
    const anchorRoleProvenance = params.anchor as PlanAnchorWithRoleProvenance
    const roleResolutionSource = params.anchor.role
      ? params.anchorRoleResolutionSource ?? anchorRoleProvenance.roleResolutionSource ?? 'explicit'
      : 'missing'
    return {
      source: 'build_anchor',
      anchorId: params.anchor.venueId,
      displayName: params.anchorDisplayName ?? undefined,
      ...(params.anchor.role ? { roleHint: params.anchor.role } : {}),
      roleResolutionSource,
      required: true,
    }
  }
  if (params.mode === 'curate' && params.starterPack) {
    return {
      source: 'starter_seeded',
      anchorId: params.starterPack.id,
      displayName: params.starterPack.title,
      required: false,
    }
  }
  if (params.mode === 'surprise') {
    return {
      source: 'system_seeded',
      required: false,
    }
  }
  return {
    source: 'none',
    required: false,
  }
}

function getCandidateLineage(
  params: BuildApplicationConciergeIntentParams,
): ConciergeIntent['candidateLineage'] {
  return params.candidateLineage ?? {
    source: 'none',
  }
}

const INTERPRETATION_BUILD_RECOVERY_MOVEMENT_POSTURE_ORDER: Array<
  Omit<RouteShapeContract['movementProfile'], 'placeRightTolerance'>
> = [
  {
    radius: 'tight',
    maxTransitionMinutes: 14,
    neighborhoodContinuity: 'strict',
  },
  {
    radius: 'balanced',
    maxTransitionMinutes: 18,
    neighborhoodContinuity: 'preferred',
  },
  {
    radius: 'balanced',
    maxTransitionMinutes: 24,
    neighborhoodContinuity: 'preferred',
  },
  {
    radius: 'open',
    maxTransitionMinutes: 32,
    neighborhoodContinuity: 'flexible',
  },
]

function movementPostureRank(movementProfile: RouteShapeContract['movementProfile']): number {
  const exactIndex = INTERPRETATION_BUILD_RECOVERY_MOVEMENT_POSTURE_ORDER.findIndex(
    (posture) =>
      posture.radius === movementProfile.radius &&
      posture.maxTransitionMinutes === movementProfile.maxTransitionMinutes &&
      posture.neighborhoodContinuity === movementProfile.neighborhoodContinuity,
  )
  if (exactIndex >= 0) {
    return exactIndex
  }
  const radiusRank =
    movementProfile.radius === 'tight' ? 0 : movementProfile.radius === 'balanced' ? 1 : 3
  const transitionRank =
    movementProfile.maxTransitionMinutes <= 14
      ? 0
      : movementProfile.maxTransitionMinutes <= 18
        ? 1
        : movementProfile.maxTransitionMinutes <= 24
          ? 2
          : 3
  const continuityRank =
    movementProfile.neighborhoodContinuity === 'strict'
      ? 0
      : movementProfile.neighborhoodContinuity === 'preferred'
        ? 2
        : 3
  return Math.max(radiusRank, transitionRank, continuityRank)
}

function buildRecoveryMovementProfile(
  action: BuildSoftFeasibleRecoveryAction,
  movementProfile: Omit<RouteShapeContract['movementProfile'], 'placeRightTolerance'>,
): RouteShapeContract['movementProfile'] {
  if (movementProfile.radius === 'open') {
    return {
      ...movementProfile,
      placeRightTolerance: {
        source: 'interpretation_contract_constraints',
        travelTolerance: 'expanded',
        maxComfortableTotalMovementMinutes: 42,
        maxSingleTransitionMinutes: 22,
        maxClusterEscapes: 2,
        driveLikeMovement: 'acceptable',
        reasonCodes: [
          'place_right_movement_profile:interpretation_authored',
          'build_soft_feasible_recovery:take_bigger_night',
        ],
      },
    }
  }
  if (movementProfile.radius === 'balanced') {
    return {
      ...movementProfile,
      placeRightTolerance: {
        source: 'interpretation_contract_constraints',
        travelTolerance: 'balanced',
        maxComfortableTotalMovementMinutes:
          movementProfile.maxTransitionMinutes === 18 ? 24 : 32,
        maxSingleTransitionMinutes:
          movementProfile.maxTransitionMinutes === 18 ? 14 : 16,
        maxClusterEscapes: movementProfile.maxTransitionMinutes === 18 ? 1 : 2,
        driveLikeMovement:
          movementProfile.maxTransitionMinutes === 18 ? 'limited' : 'acceptable',
        reasonCodes: [
          'place_right_movement_profile:interpretation_authored',
          `build_soft_feasible_recovery:${action}`,
        ],
      },
    }
  }
  return {
    ...movementProfile,
    placeRightTolerance: {
      source: 'interpretation_contract_constraints',
      travelTolerance: 'tight',
      maxComfortableTotalMovementMinutes: 18,
      maxSingleTransitionMinutes: 10,
      maxClusterEscapes: 1,
      driveLikeMovement: 'discouraged',
      reasonCodes: [
        'place_right_movement_profile:interpretation_authored',
        'build_soft_feasible_recovery:try_tighter_route',
      ],
    },
  }
}

function buildSoftFeasibleRecoveryAttempts(
  params: NonNullable<BuildApplicationConciergeIntentParams['buildSoftFeasibleRecovery']>,
): BuildSoftFeasibleRecoveryChoice['orderedRouteShapeAttempts'] {
  const originRank = movementPostureRank(params.originatingMovementProfile)
  const candidatePostures =
    params.action === 'take_bigger_night'
      ? INTERPRETATION_BUILD_RECOVERY_MOVEMENT_POSTURE_ORDER.filter(
          (posture) => movementPostureRank(posture) > originRank,
        )
      : INTERPRETATION_BUILD_RECOVERY_MOVEMENT_POSTURE_ORDER.filter(
          (posture) => movementPostureRank(posture) < originRank,
        )
  return candidatePostures.map((movementProfile, index) => ({
    source: 'interpretation_build_soft_feasible_recovery' as const,
    action: params.action,
    attemptId: `build_soft_feasible_recovery:${params.action}:${index + 1}`,
    order: index,
    movementProfile: buildRecoveryMovementProfile(params.action, movementProfile),
    relationToOrigin:
      params.action === 'take_bigger_night'
        ? 'broader_than_origin'
        : 'tighter_than_origin',
    reasonCodes: [
      'build_soft_feasible_recovery:interpretation_projected_route_shape',
      `build_soft_feasible_recovery:${params.action}`,
    ],
  }))
}

function buildSoftFeasibleRecoveryChoice(
  params: BuildApplicationConciergeIntentParams,
): BuildSoftFeasibleRecoveryChoice | undefined {
  if (params.mode !== 'build' || !params.buildSoftFeasibleRecovery) {
    return undefined
  }
  const action = params.buildSoftFeasibleRecovery.action
  return {
    source: 'application_great_stop_recovery_surface',
    action,
    originatingMovementProfile: params.buildSoftFeasibleRecovery.originatingMovementProfile,
    orderedRouteShapeAttempts: buildSoftFeasibleRecoveryAttempts(
      params.buildSoftFeasibleRecovery,
    ),
    reasonCodes: [
      'great_stop_failed:place_right_soft_feasible',
      `build_soft_feasible_recovery:${action}`,
    ],
  }
}

export function buildApplicationConciergeIntent(
  params: BuildApplicationConciergeIntentParams,
): ConciergeIntent {
  const persona = params.starterPack?.personaBias ?? params.persona
  const vibe = params.starterPack?.primaryAnchor ?? params.primaryVibe
  const { intentMode, objectivePrimary, controlMode } = getModeIntentFields(params.mode)
  const socialEnergy = getConciergeSocialEnergy(vibe)
  const explorationTolerance = getConciergeExplorationTolerance({ persona, vibe })
  const pacing = getConciergePacing({ persona, vibe })
  const travelTolerance: ConciergeIntent['constraintPosture']['travelTolerance'] =
    params.starterPack?.distanceMode === 'nearby' || vibe === 'lively'
      ? 'tight'
      : vibe === 'chill' || vibe === 'cozy'
        ? 'flexible'
        : 'balanced'
  const structureRigidity: ConciergeIntent['constraintPosture']['structureRigidity'] =
    persona === 'family' ? 'tight' : persona === 'friends' ? 'flexible' : 'balanced'
  const swapTolerance: ConciergeIntent['constraintPosture']['swapTolerance'] =
    persona === 'friends' || vibe === 'lively' || vibe === 'playful'
      ? 'high'
      : persona === 'family'
        ? 'low'
        : 'medium'
  const coherencePriority: ConciergeIntent['realityPosture']['coherencePriority'] =
    structureRigidity === 'tight' ? 'high' : structureRigidity === 'balanced' ? 'medium' : 'low'
  const noveltyPriority: ConciergeIntent['realityPosture']['noveltyPriority'] =
    explorationTolerance === 'high'
      ? 'high'
      : explorationTolerance === 'low'
        ? 'low'
        : 'medium'
  const certaintyPriority: ConciergeIntent['realityPosture']['certaintyPriority'] =
    persona === 'family' ? 'high' : 'medium'
  const objectiveDefaulted = params.objectiveOccasion == null
  const objectiveOccasion = params.objectiveOccasion ?? 'connect'
  const objectiveSource = params.objectiveSource ?? (objectiveDefaulted ? 'defaulted' : 'user_supplied')
  const buildRecoveryChoice = buildSoftFeasibleRecoveryChoice(params)
  const seedToken =
    params.candidateLineage?.candidateArtifactId
      ? `candidate_${normalizeConciergeIntentToken(params.candidateLineage.candidateArtifactId)}`
      : params.mode === 'curate' && params.starterPack
        ? `starter_${normalizeConciergeIntentToken(params.starterPack.id)}`
        : params.mode === 'build'
          ? `anchor_${normalizeConciergeIntentToken(params.anchor?.venueId)}`
          : 'system_seeded'
  const id = [
    'cintent_v0_1',
    intentMode,
    controlMode,
    persona,
    vibe,
    normalizeConciergeIntentToken(params.city),
    seedToken,
  ].join('_')

  return {
    id,
    intentMode,
    objective: {
      primary: objectivePrimary,
      occasion: objectiveOccasion,
    },
    objectiveDefaulted,
    objectiveSource,
    controlPosture: {
      mode: controlMode,
    },
    experienceProfile: {
      persona,
      vibe,
      pacing,
      socialEnergy,
      explorationTolerance,
    },
    anchorPosture: getAnchorPosture(params),
    constraintPosture: {
      travelTolerance,
      structureRigidity,
      swapTolerance,
      ...(buildRecoveryChoice
        ? { buildSoftFeasibleRecoveryChoice: buildRecoveryChoice }
        : {}),
    },
    realityPosture: {
      liveSignalPriority: 'high',
      coherencePriority,
      noveltyPriority,
      certaintyPriority,
    },
    starterLineage: getStarterLineage(params),
    anchorLineage: getAnchorLineage(params),
    candidateLineage: getCandidateLineage(params),
  }
}
