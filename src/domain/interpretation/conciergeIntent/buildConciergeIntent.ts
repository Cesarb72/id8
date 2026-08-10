import type { StarterPack } from '../../types/starterPack'
import type {
  ConciergeIntent,
  ConciergeIntentCandidateLineage,
  ConciergeObjectiveOccasion,
  ExperienceMode,
  PersonaMode,
  PlanAnchor,
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
