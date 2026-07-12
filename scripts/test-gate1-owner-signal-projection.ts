import {
  projectGate1ActionCandidate,
  projectGate1OwnerSignals,
} from '../src/domain/arc/projectGate1OwnerSignals'
import type { ArcCandidate, ScoredVenue } from '../src/domain/types/arc'
import type { IntentProfile } from '../src/domain/types/intent'
import type { SpatialCoherenceAnalysis } from '../src/domain/types/spatial'
import type {
  ArcGate1CompatibilityPayload,
  OwnerProvenancedGate1ActionSignal,
} from '../src/integrations/waypoint/coordination/arcGate1ActionPolicyView'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

let fetchCallCount = 0
globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
  fetchCallCount += 1
  throw new Error(
    `Unexpected fetch in Gate 1 owner-signal projection test: ${String(args[0])}`,
  )
}) as typeof fetch

const intent = {
  mode: 'build',
  distanceMode: 'nearby',
  planningMode: 'user-led',
  persona: 'friends',
  anchor: {
    venueId: 'gate1-good',
    role: 'highlight',
  },
  experienceContract: {
    persona: 'friends',
    vibe: 'lively',
  },
  selectedDirectionContext: {
    directionId: 'easy-hang-night',
    label: 'Easy hang night',
    archetype: 'easy_hang',
    identity: 'friends_cozy',
    cluster: 'downtown',
  },
} as IntentProfile

const compatibilityPayload: ArcGate1CompatibilityPayload = {
  source: 'compat',
  legacyReasonCodes: ['legacy:projection-debug-only'],
  legacyScores: {
    compatibilityOnlyScore: 1,
  },
  publicProjection: {
    label: 'not authority',
  },
}

function sourceMetadata(overrides: Partial<ScoredVenue['venue']['source']> = {}) {
  return {
    businessStatus: 'operational',
    sourceOrigin: 'curated',
    normalizedFromRawType: 'seed',
    sourceConfidence: 0.92,
    completenessScore: 0.91,
    qualityScore: 0.9,
    provider: undefined,
    providerRecordId: undefined,
    openNow: true,
    hoursKnown: true,
    likelyOpenForCurrentWindow: true,
    timeConfidence: 0.8,
    qualityGateStatus: 'approved',
    qualityGateNotes: [],
    approvalBlockers: [],
    demotionReasons: [],
    suppressionReasons: [],
    hoursPressureNotes: [],
    hoursSuppressionApplied: false,
    hoursDemotionApplied: false,
    missingFields: [],
    inferredFields: [],
    ...overrides,
  } as ScoredVenue['venue']['source']
}

function candidate(params: {
  id: string
  driveMinutes?: number
  active?: boolean
  businessStatus?: ScoredVenue['venue']['source']['businessStatus']
  sourceOrigin?: ScoredVenue['venue']['source']['sourceOrigin']
  sourceConfidence?: number
  provider?: ScoredVenue['venue']['source']['provider']
  providerRecordId?: string
  highlightValidity?: ScoredVenue['highlightValidity']['validityLevel']
  momentPotential?: number
  momentIntensity?: number
  anchorStrength?: number
  wildcardRoleScore?: number
  peakRoleScore?: number
  category?: string
  tags?: string[]
  vibeTags?: string[]
}): ScoredVenue {
  const momentPotential = params.momentPotential ?? 0.76
  const momentIntensity = params.momentIntensity ?? 0.74
  const anchorStrength = params.anchorStrength ?? 0.72
  const category = params.category ?? 'activity'
  const tags = params.tags ?? ['immersive', 'interactive']
  const vibeTags = params.vibeTags ?? ['lively']
  const sourceOverrides = {
    ...(params.businessStatus !== undefined
      ? { businessStatus: params.businessStatus }
      : {}),
    ...(params.sourceOrigin !== undefined ? { sourceOrigin: params.sourceOrigin } : {}),
    ...(params.sourceConfidence !== undefined
      ? { sourceConfidence: params.sourceConfidence }
      : {}),
    ...(params.provider !== undefined ? { provider: params.provider } : {}),
    ...(params.providerRecordId !== undefined
      ? { providerRecordId: params.providerRecordId }
      : {}),
  }

  return {
    candidateIdentity: {
      candidateId: params.id,
      baseVenueId: params.id,
      kind: 'base',
      traceLabel: params.id,
    },
    venue: {
      id: params.id,
      name: params.id,
      category,
      subcategory: 'experience',
      tags,
      vibeTags,
      energyLevel: 3,
      driveMinutes: params.driveMinutes ?? 8,
      isActive: params.active ?? true,
      source: sourceMetadata(sourceOverrides),
    },
    fitBreakdown: {
      anchorFit: 0.8,
      crewFit: 0.8,
      proximityFit: params.driveMinutes && params.driveMinutes > 18 ? 0.3 : 0.78,
      budgetFit: 0.8,
      uniquenessFit: 0.8,
      hiddenGemFit: 0.7,
    },
    fitScore: 0.78,
    hiddenGemScore: 0.62,
    lensCompatibility: 0.74,
    contextSpecificity: {
      overall: 0.72,
      personaSignal: 0.7,
      vibeSignal: 0.7,
      lensSignal: 0.7,
      byRole: {
        warmup: 0.66,
        peak: 0.74,
        wildcard: 0.7,
        cooldown: 0.66,
      },
    },
    dominanceControl: {
      universalityScore: 0.42,
      flaggedUniversal: false,
      byRole: {
        warmup: 0.3,
        peak: 0.34,
        wildcard: 0.32,
        cooldown: 0.3,
      },
    },
    roleContract: {
      warmup: { strength: 'soft', satisfied: true },
      peak: { strength: 'hard', satisfied: true },
      wildcard: { strength: 'soft', satisfied: true },
      cooldown: { strength: 'soft', satisfied: true },
    },
    stopShapeFit: {
      start: 0.68,
      highlight: 0.76,
      surprise: 0.72,
      windDown: 0.62,
    },
    vibeAuthority: {
      primary: 0.75,
      secondary: 0.7,
      overall: 0.72,
      packPressure: { highlight: 0.7 },
      byRole: {
        start: 0.68,
        highlight: 0.76,
        surprise: 0.72,
        windDown: 0.62,
      },
      pressureSource: { highlight: 'taste' },
      musicSupportSource: 'none',
      adventureRead: 'neutral',
      adventureReadScores: { outdoor: 0.2, urban: 0.7 },
      adventureNotes: [],
    },
    highlightValidity: {
      validityLevel: params.highlightValidity ?? 'valid',
      personaVetoes: [],
      contextVetoes: [],
      violations: [],
    },
    roleScores: {
      warmup: 0.66,
      peak: params.peakRoleScore ?? 0.76,
      wildcard: params.wildcardRoleScore ?? 0.7,
      cooldown: 0.62,
    },
    momentIdentity: {
      type: 'anchor',
      strength: 'strong',
    },
    taste: {
      signals: {
        energy: 0.66,
        socialDensity: 0.64,
        intimacy: 0.46,
        lingerFactor: 0.58,
        destinationFactor: 0.7,
        experientialFactor: 0.76,
        conversationFriendliness: 0.52,
        interactiveStrength: 0.72,
        durationEstimate: 'medium',
        roleSuitability: {
          start: 0.66,
          highlight: params.peakRoleScore ?? 0.76,
          surprise: params.wildcardRoleScore ?? 0.7,
          windDown: 0.62,
        },
        momentIntensity: {
          score: momentIntensity,
          tier: 'strong',
          drivers: ['synthetic'],
        },
        momentPotential: {
          score: momentPotential,
          reasons: ['synthetic'],
        },
        anchorStrength,
        primaryExperienceArchetype: 'activity',
        experienceFamily: 'playful',
        isRomanticMomentCandidate: true,
      },
      modeAlignment: {
        score: 0.7,
        penalty: 0,
        lane: 'social',
        tier: 'aligned',
        supportiveTagScore: 0.7,
        lanePriorityScore: 0.7,
      },
      fallbackPenalty: {
        signalScore: 0,
        appliedPenalty: 0,
        applied: false,
        strongerAlternativePresent: false,
        reason: 'none',
      },
      rolePoolInfluence: {
        warmup: {
          tasteBonus: 0,
          roleSuitabilityContribution: 0,
          momentContribution: 0,
          highlightPlausibilityBonus: 0,
          modeAlignmentContribution: 0,
          modeAlignmentPenalty: 0,
        },
        peak: {
          tasteBonus: 0,
          roleSuitabilityContribution: 0,
          momentContribution: 0,
          highlightPlausibilityBonus: 0,
          modeAlignmentContribution: 0,
          modeAlignmentPenalty: 0,
        },
        wildcard: {
          tasteBonus: 0,
          roleSuitabilityContribution: 0,
          momentContribution: 0,
          highlightPlausibilityBonus: 0,
          modeAlignmentContribution: 0,
          modeAlignmentPenalty: 0,
        },
        cooldown: {
          tasteBonus: 0,
          roleSuitabilityContribution: 0,
          momentContribution: 0,
          highlightPlausibilityBonus: 0,
          modeAlignmentContribution: 0,
          modeAlignmentPenalty: 0,
        },
      },
    },
  } as ScoredVenue
}

function routeCandidate(scoredVenue: ScoredVenue, spatialScore = 0.72): ArcCandidate {
  const spatial: SpatialCoherenceAnalysis = {
    mode: 'walkable',
    homeClusterId: 'downtown',
    clustersVisited: ['downtown'],
    clusterAssignments: [],
    transitions: [],
    sameClusterTransitionCount: 2,
    clusterEscapeCount: 0,
    repeatedClusterEscapeCount: 0,
    longTransitionCount: 0,
    jumpUsed: false,
    spatialBonus: 0.02,
    spatialPenalty: 0,
    score: spatialScore,
    notes: [],
  }

  return {
    id: `route-${scoredVenue.candidateIdentity.candidateId}`,
    stops: [
      {
        role: 'peak',
        scoredVenue,
      },
    ],
    totalScore: 0.8,
    scoreBreakdown: {
      roleFlowScore: 0.8,
      diversityScore: 0.8,
      geographyScore: spatialScore,
      hiddenGemLift: 0,
      windDownScore: 0.6,
      localSupplySufficient: true,
    },
    pacing: {
      durationMinutes: 60,
      score: 0.8,
      notes: [],
    },
    spatial,
    hasWildcard: false,
  } as ArcCandidate
}

function signalSources(signals: readonly OwnerProvenancedGate1ActionSignal[]): string[] {
  return [...new Set(signals.map((signal) => signal.source))].sort()
}

function hasSignal(
  signals: readonly OwnerProvenancedGate1ActionSignal[],
  source: OwnerProvenancedGate1ActionSignal['source'],
  key: string,
): boolean {
  return signals.some((signal) => signal.source === source && signal.key === key)
}

const goodCandidate = candidate({ id: 'gate1-good' })
const goodRoute = routeCandidate(goodCandidate)
const goodProjection = projectGate1OwnerSignals({
  action: 'preservation',
  candidate: goodCandidate,
  role: 'peak',
  intent,
  routeCandidate: goodRoute,
})
const goodActionCandidate = projectGate1ActionCandidate({
  action: 'preservation',
  candidate: goodCandidate,
  role: 'peak',
  intent,
  routeCandidate: goodRoute,
  compatibility: compatibilityPayload,
})

const missingOwnerCandidate = candidate({
  id: 'gate1-missing-owner-signals',
  driveMinutes: 28,
  active: false,
  businessStatus: 'closed-permanently',
  sourceOrigin: 'live',
  sourceConfidence: 0,
  provider: undefined,
  providerRecordId: undefined,
  highlightValidity: 'invalid',
  momentPotential: 0.22,
  momentIntensity: 0.24,
  anchorStrength: 0.2,
  wildcardRoleScore: 0.18,
  peakRoleScore: 0.2,
  category: 'restaurant',
  tags: ['dinner'],
  vibeTags: ['generic'],
})
const missingOwnerProjection = projectGate1OwnerSignals({
  action: 'fallback',
  candidate: missingOwnerCandidate,
  role: 'peak',
  intent: {
    ...intent,
    anchor: {
      venueId: missingOwnerCandidate.candidateIdentity.baseVenueId,
      role: 'highlight',
    },
  } as IntentProfile,
  routeCandidate: routeCandidate(missingOwnerCandidate, 0.28),
})

assert(
  signalSources(goodProjection.ownerSignals).join('|') === 'bearings|field|taste',
  'Projection must include Taste/Bearings/Field owner signals.',
)
assert(
  hasSignal(goodProjection.ownerSignals, 'taste', 'peak_support') &&
    hasSignal(goodProjection.ownerSignals, 'taste', 'central_moment_support') &&
    hasSignal(goodProjection.ownerSignals, 'taste', 'role_support') &&
    hasSignal(goodProjection.ownerSignals, 'taste', 'intent_support'),
  'Taste projection must include Gate 1 meaning support signals.',
)
assert(
  hasSignal(goodProjection.ownerSignals, 'bearings', 'route_feasibility') &&
    hasSignal(goodProjection.ownerSignals, 'bearings', 'place_right_feasibility') &&
    hasSignal(goodProjection.ownerSignals, 'bearings', 'movement_feasibility') &&
    hasSignal(goodProjection.ownerSignals, 'bearings', 'admission_survival'),
  'Bearings projection must include Gate 1 feasibility signals.',
)
assert(
  hasSignal(goodProjection.ownerSignals, 'field', 'real_record') &&
    hasSignal(goodProjection.ownerSignals, 'field', 'active_record') &&
    hasSignal(goodProjection.ownerSignals, 'field', 'resolved_identity'),
  'Field projection must include Gate 1 Real signals.',
)
assert(
  goodProjection.missingOwnerSignals.length === 0,
  'Good candidate should project without missing owner signals.',
)
assert(
  !goodActionCandidate.ownerSignals.some((signal) => signal.source === 'compat'),
  'Compatibility payload must not become owner-signal authority.',
)
assert(
  goodActionCandidate.compatibility?.source === 'compat',
  'Compatibility payload should remain optional payload data.',
)
assert(
  missingOwnerProjection.missingOwnerSignals.some((signal) =>
    signal.startsWith('taste:'),
  ) &&
    missingOwnerProjection.missingOwnerSignals.some((signal) =>
      signal.startsWith('bearings:'),
    ) &&
    missingOwnerProjection.missingOwnerSignals.some((signal) =>
      signal.startsWith('field:'),
    ),
  'Failed owner signals must be visible by owner source.',
)

const output = {
  observer: 'gate1_owner_signal_projection',
  goodProjection: {
    ownerSources: signalSources(goodProjection.ownerSignals),
    tasteSignalCount: goodProjection.taste.length,
    bearingsSignalCount: goodProjection.bearings.length,
    fieldSignal: goodProjection.field.key,
    missingOwnerSignals: goodProjection.missingOwnerSignals,
    compatPayloadIsAuthority: goodActionCandidate.ownerSignals.some(
      (signal) => signal.source === 'compat',
    ),
  },
  missingOwnerProjection: {
    missingOwnerSignals: missingOwnerProjection.missingOwnerSignals,
    tasteFailures: missingOwnerProjection.missingOwnerSignals.filter((signal) =>
      signal.startsWith('taste:'),
    ),
    bearingsFailures: missingOwnerProjection.missingOwnerSignals.filter((signal) =>
      signal.startsWith('bearings:'),
    ),
    fieldFailures: missingOwnerProjection.missingOwnerSignals.filter((signal) =>
      signal.startsWith('field:'),
    ),
  },
  boundaries: {
    tasteAuthorsMeaning: goodProjection.taste.every(
      (signal) => signal.source === 'taste',
    ),
    bearingsAuthorsFeasibility: goodProjection.bearings.every(
      (signal) => signal.source === 'bearings',
    ),
    fieldAuthorsReal: goodProjection.field.source === 'field',
    waypointAuthorsOwnerTruth: false,
    behaviorShellMoved: false,
    publicShapeChanged: false,
  },
  providerNetworkCounts: {
    fetchCallCount,
  },
}

console.log(JSON.stringify(output, null, 2))
