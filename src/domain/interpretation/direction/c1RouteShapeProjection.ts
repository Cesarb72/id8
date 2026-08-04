/**
 * ARC BOUNDARY: Interpretation-owned C1 route-composition projection.
 *
 * Owns typed Start/Highlight/Wind-down contribution requirements derived from
 * ConciergeIntent, ContractConstraints, and selected Direction truth.
 *
 * Does NOT own:
 * - route selection
 * - candidate scoring
 * - movement feasibility
 * - lifecycle durability
 */
import type {
  ConciergeIntent,
  ContractConstraints,
  ResolvedDirectionContext,
  RoleCompositionRequirement,
  RoleProfile,
  RouteInvariantTrait,
  RouteShapeContract,
  RouteShapeRole,
} from '../../types/intent'
import type { DirectionPlanningSelection } from './selectedDirectionProjection'

export interface InterpretationC1RouteShapeProjection {
  source: 'interpretation.c1_route_shape_projection.v0_1'
  projectionId: string
  provenance: NonNullable<RouteShapeContract['interpretationC1Projection']>
  roleProfile: Record<RouteShapeRole, RoleProfile>
  roleInvariants: RouteShapeContract['roleInvariants']
}

function normalizeC1Vibe(
  vibe: ConciergeIntent['experienceProfile']['vibe'],
): NonNullable<RouteShapeContract['interpretationC1Projection']>['normalizedVibe'] {
  if (vibe === 'cozy' || vibe === 'chill') {
    return 'cozy'
  }
  if (vibe === 'lively' || vibe === 'playful') {
    return 'lively'
  }
  return 'cultured'
}

function dedupeCompositionDimensions(
  dimensions: RoleCompositionRequirement['dimensions'],
): RoleCompositionRequirement['dimensions'] {
  return [...new Set(dimensions)]
}

function buildRoleCompositionRequirement(params: {
  role: RouteShapeRole
  selectedDirection: DirectionPlanningSelection
  conciergeIntent: ConciergeIntent
  contractConstraints: ContractConstraints
}): RoleCompositionRequirement {
  const { role, selectedDirection, conciergeIntent, contractConstraints } = params
  const { persona, explorationTolerance, socialEnergy } = conciergeIntent.experienceProfile
  const normalizedVibe = normalizeC1Vibe(conciergeIntent.experienceProfile.vibe)
  const family = selectedDirection.cluster
  const movementTight =
    contractConstraints.movementTolerance === 'contained' ||
    contractConstraints.movementTolerance === 'compressed'
  const tolerance: RoleCompositionRequirement['tolerance'] =
    contractConstraints.requireContinuity ||
    contractConstraints.highlightPressure === 'strong' ||
    movementTight
      ? 'strict'
      : contractConstraints.windDownStrictness === 'flexible' ||
          explorationTolerance === 'high'
        ? 'flexible'
        : 'balanced'
  const personaDimensions: RoleCompositionRequirement['dimensions'] = [
    persona === 'family' ? 'spatial_condition' : 'social_condition',
    persona === 'romantic' ? 'sensory_condition' : 'relationship_continuity',
  ]
  const vibeDimensions: RoleCompositionRequirement['dimensions'] =
    normalizedVibe === 'cultured'
      ? ['sensory_condition', 'relationship_continuity']
      : normalizedVibe === 'lively'
        ? ['social_condition', 'controlled_novelty']
        : ['pacing_condition', 'resolution_landing']
  const routeDimensions: RoleCompositionRequirement['dimensions'] = [
    movementTight ? 'spatial_condition' : 'relationship_continuity',
    family === 'explore' ? 'controlled_novelty' : 'vibe_fit',
    socialEnergy === 'high' ? 'social_condition' : 'pacing_condition',
  ]

  if (role === 'start') {
    return {
      source: 'interpretation.route_shape_contract',
      role,
      relationship: 'prepares_selected_highlight',
      dimensions: dedupeCompositionDimensions([
        'role_fit',
        'intent_fit',
        'vibe_fit',
        'pacing_condition',
        'relationship_continuity',
        ...personaDimensions,
        ...vibeDimensions,
        ...routeDimensions,
      ]),
      minimumStatus: tolerance === 'strict' ? 'pass' : 'soft',
      tolerance,
      reasonCodes: [
        `persona:${persona}`,
        `vibe:${normalizedVibe}`,
        `highlightPressure:${contractConstraints.highlightPressure}`,
      ],
    }
  }

  if (role === 'highlight') {
    return {
      source: 'interpretation.route_shape_contract',
      role,
      relationship: 'performs_peak',
      dimensions: dedupeCompositionDimensions([
        'role_fit',
        'intent_fit',
        'vibe_fit',
        'peak_strength',
        'sensory_condition',
        ...personaDimensions,
        ...vibeDimensions,
      ]),
      minimumStatus: 'pass',
      tolerance,
      reasonCodes: [
        `persona:${persona}`,
        `vibe:${normalizedVibe}`,
        `peakCount:${contractConstraints.peakCountModel}`,
        `highlightPressure:${contractConstraints.highlightPressure}`,
      ],
    }
  }

  return {
    source: 'interpretation.route_shape_contract',
    role,
    relationship: 'resolves_selected_highlight',
    dimensions: dedupeCompositionDimensions([
      'role_fit',
      'intent_fit',
      'vibe_fit',
      'pacing_condition',
      'resolution_landing',
      'relationship_continuity',
      ...personaDimensions,
      ...vibeDimensions,
      ...routeDimensions,
    ]),
    minimumStatus: tolerance === 'strict' ? 'pass' : 'soft',
    tolerance,
    reasonCodes: [
      `persona:${persona}`,
      `vibe:${normalizedVibe}`,
      `windDown:${contractConstraints.windDownStrictness}`,
      `recovery:${String(contractConstraints.requireRecoveryWindows)}`,
    ],
  }
}

function getRouteShapeRoleProfile(params: {
  role: RouteShapeRole
  selectedDirection: DirectionPlanningSelection
  conciergeIntent: ConciergeIntent
  contractConstraints: ContractConstraints
}): RoleProfile {
  const { role, selectedDirection, conciergeIntent, contractConstraints } = params
  const { persona, pacing, socialEnergy } = conciergeIntent.experienceProfile
  const { swapTolerance } = conciergeIntent.constraintPosture
  const controlMode = conciergeIntent.controlPosture.mode
  const escalationMode = contractConstraints.requireEscalation
  const strictContinuity = contractConstraints.requireContinuity
  const strongCenter = contractConstraints.highlightPressure === 'strong'
  const distributedCenter = contractConstraints.highlightPressure === 'distributed'
  const compositionRequirement = buildRoleCompositionRequirement({
    role,
    selectedDirection,
    conciergeIntent,
    contractConstraints,
  })
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
      compositionRequirement,
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
      compositionRequirement,
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
    compositionRequirement,
  }
}

function dedupeInvariantTraits(traits: RouteInvariantTrait[]): RouteInvariantTrait[] {
  return [...new Set(traits)]
}

function buildRouteRoleInvariants(params: {
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

export function buildInterpretationC1RouteShapeProjection(params: {
  selectedDirection: DirectionPlanningSelection
  selectedDirectionContext: ResolvedDirectionContext
  conciergeIntent: ConciergeIntent
  contractConstraints: ContractConstraints
  arcShape: RouteShapeContract['arcShape']
  movementProfile: RouteShapeContract['movementProfile']
}): InterpretationC1RouteShapeProjection {
  const {
    selectedDirection,
    selectedDirectionContext,
    conciergeIntent,
    contractConstraints,
    arcShape,
    movementProfile,
  } = params
  const normalizedVibe = normalizeC1Vibe(conciergeIntent.experienceProfile.vibe)
  const projectionId = [
    'c1proj_v0_1',
    selectedDirectionContext.selectedDirectionId,
    conciergeIntent.id,
    contractConstraints.id,
  ].join('_')
  const roleProfile: Record<RouteShapeRole, RoleProfile> = {
    start: getRouteShapeRoleProfile({
      role: 'start',
      selectedDirection,
      conciergeIntent,
      contractConstraints,
    }),
    highlight: getRouteShapeRoleProfile({
      role: 'highlight',
      selectedDirection,
      conciergeIntent,
      contractConstraints,
    }),
    windDown: getRouteShapeRoleProfile({
      role: 'windDown',
      selectedDirection,
      conciergeIntent,
      contractConstraints,
    }),
  }
  const roleInvariants = buildRouteRoleInvariants({
    selectedDirection,
    selectedDirectionContext,
    conciergeIntent,
    contractConstraints,
    arcShape,
    movementProfile,
  })
  return {
    source: 'interpretation.c1_route_shape_projection.v0_1',
    projectionId,
    provenance: {
      source: 'interpretation.c1_route_shape_projection.v0_1',
      projectionId,
      authority: 'concierge_intent_experience_contract_constraints',
      conciergeIntentId: conciergeIntent.id,
      experienceContractId: contractConstraints.experienceContractId,
      contractConstraintsId: contractConstraints.id,
      selectedDirectionId: selectedDirectionContext.selectedDirectionId,
      selectedPocketId: selectedDirectionContext.selectedPocketId,
      persona: conciergeIntent.experienceProfile.persona,
      vibe: conciergeIntent.experienceProfile.vibe,
      normalizedVibe,
      roleRequirementIds: {
        start: `${projectionId}_start`,
        highlight: `${projectionId}_highlight`,
        windDown: `${projectionId}_windDown`,
      },
    },
    roleProfile,
    roleInvariants,
  }
}
