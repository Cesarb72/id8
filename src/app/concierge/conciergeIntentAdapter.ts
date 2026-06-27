import type { StarterPack } from '../../domain/types/starterPack'
import type {
  AnchorRole,
  ConciergeIntent,
  ConciergeObjectiveOccasion,
  DistanceMode,
  ExperienceMode,
  IntentInput,
  PersonaMode,
  PlanAnchor,
  PreferredDiscoveryVenue,
  SelectedDirectionContext,
  VibeAnchor,
} from '../../domain/types/intent'
import type { RefinementMode } from '../../domain/types/refinement'

type ConciergeIntentAdapterMode = ExperienceMode

export interface BuildApplicationConciergeIntentParams {
  mode: ConciergeIntentAdapterMode
  persona: PersonaMode
  primaryVibe: VibeAnchor
  city: string
  objectiveOccasion?: ConciergeObjectiveOccasion
  starterPack?: StarterPack | null
  anchor?: PlanAnchor | null
}

export interface ProjectConciergeIntentToIntentInputParams {
  conciergeIntent: ConciergeIntent
  mode: ExperienceMode
  city: string
  district?: string
  neighborhood?: string
  distanceMode: DistanceMode
  refinementModes?: RefinementMode[]
  discoveryPreferences?: PreferredDiscoveryVenue[]
  selectedDirectionContext?: SelectedDirectionContext
  anchor?: PlanAnchor | null
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
}): ConciergeIntent['anchorPosture'] {
  const { mode, city, starterPack, anchor } = params
  if (mode === 'build') {
    return {
      mode: 'hard',
      anchorType: 'venue',
      anchorValue: anchor?.venueId,
      roleHint: anchor?.role ?? 'highlight',
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
  const seedToken =
    params.mode === 'curate' && params.starterPack
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
      occasion: params.objectiveOccasion ?? (params.mode === 'surprise' ? 'explore' : 'connect'),
    },
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
    },
    realityPosture: {
      liveSignalPriority: 'high',
      coherencePriority,
      noveltyPriority,
      certaintyPriority,
    },
  }
}

function projectAnchorFromConciergeIntent(
  conciergeIntent: ConciergeIntent,
): PlanAnchor | undefined {
  if (
    conciergeIntent.anchorPosture.mode !== 'hard' ||
    conciergeIntent.anchorPosture.anchorType !== 'venue' ||
    !conciergeIntent.anchorPosture.anchorValue
  ) {
    return undefined
  }
  const roleHint = conciergeIntent.anchorPosture.roleHint
  return {
    venueId: conciergeIntent.anchorPosture.anchorValue,
    role: (roleHint ?? 'highlight') as AnchorRole,
  }
}

export function projectConciergeIntentToIntentInput(
  params: ProjectConciergeIntentToIntentInputParams,
): IntentInput {
  const projectedAnchor = params.anchor ?? projectAnchorFromConciergeIntent(params.conciergeIntent)
  return {
    mode: params.mode,
    planningMode:
      params.conciergeIntent.controlPosture.mode === 'user_directed'
        ? 'user-led'
        : 'engine-led',
    persona: params.conciergeIntent.experienceProfile.persona,
    primaryVibe: params.conciergeIntent.experienceProfile.vibe,
    city: params.city,
    district: params.district,
    neighborhood: params.neighborhood,
    distanceMode: params.distanceMode,
    refinementModes: params.refinementModes,
    selectedDirectionContext: params.selectedDirectionContext,
    discoveryPreferences: params.discoveryPreferences,
    anchor: projectedAnchor,
  }
}
