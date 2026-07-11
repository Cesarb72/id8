import { readFileSync } from 'node:fs'
import { buildRolePools } from '../src/domain/arc/buildRolePools'
import { assembleArcCandidates } from '../src/domain/arc/assembleArcCandidates'
import { rankArcCandidatesFromContract } from '../src/integrations/waypoint/rankArcCandidates'
import type { ScoredVenue } from '../src/domain/types/arc'
import type { CrewPolicy } from '../src/domain/types/crewPolicies'
import type { ExperienceLens } from '../src/domain/types/experienceLens'
import type {
  ContractConstraints,
  ExperienceContract,
  IntentProfile,
  RouteShapeContract,
} from '../src/domain/types/intent'
import type { RoleContractSet } from '../src/domain/types/roleContract'
import type { WaypointContractInput } from '../src/integrations/waypoint/core'
import type { InternalRole, Venue } from '../src/domain/types/venue'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

let fetchCallCount = 0
globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
  fetchCallCount += 1
  throw new Error(`Unexpected fetch in tight support admission test: ${String(args[0])}`)
}) as typeof fetch

const roleScoresFor = (role: InternalRole, score: number) => ({
  warmup: role === 'warmup' ? score : 0.28,
  peak: role === 'peak' ? score : 0.28,
  wildcard: 0.28,
  cooldown: role === 'cooldown' ? score : 0.28,
})

const shapeScoresFor = (role: InternalRole, score: number) => ({
  start: role === 'warmup' ? score : 0.28,
  highlight: role === 'peak' ? score : 0.28,
  surprise: 0.28,
  windDown: role === 'cooldown' ? score : 0.28,
})

function makeScoredVenue(params: {
  id: string
  name?: string
  role: InternalRole
  neighborhood: string
  driveMinutes: number
  roleScore: number
  contractSatisfied?: boolean
  category?: Venue['category']
  energy?: number
  sourceOrigin?: string
}): ScoredVenue {
  const roleScores = roleScoresFor(params.role, params.roleScore)
  const stopShapeFit = shapeScoresFor(params.role, params.roleScore)
  const roleContract = {
    warmup: {
      contractLabel: 'test',
      strength: 'strong',
      score: params.role === 'warmup' && params.contractSatisfied === false ? 0.2 : 0.9,
      satisfied: params.role !== 'warmup' || params.contractSatisfied !== false,
      matchedSignals: [],
      violations: params.role === 'warmup' && params.contractSatisfied === false ? ['off-contract'] : [],
    },
    peak: {
      contractLabel: 'test',
      strength: 'strong',
      score: params.role === 'peak' && params.contractSatisfied === false ? 0.2 : 0.9,
      satisfied: params.role !== 'peak' || params.contractSatisfied !== false,
      matchedSignals: [],
      violations: params.role === 'peak' && params.contractSatisfied === false ? ['off-contract'] : [],
    },
    wildcard: {
      contractLabel: 'test',
      strength: 'none',
      score: 0.8,
      satisfied: true,
      matchedSignals: [],
      violations: [],
    },
    cooldown: {
      contractLabel: 'test',
      strength: 'strong',
      score: params.role === 'cooldown' && params.contractSatisfied === false ? 0.2 : 0.9,
      satisfied: params.role !== 'cooldown' || params.contractSatisfied !== false,
      matchedSignals: [],
      violations: params.role === 'cooldown' && params.contractSatisfied === false ? ['off-contract'] : [],
    },
  } as ScoredVenue['roleContract']
  const venue: Venue = {
    id: params.id,
    name: params.name ?? params.id,
    city: 'San Jose',
    neighborhood: params.neighborhood,
    driveMinutes: params.driveMinutes,
    category: params.category ?? 'cafe',
    subcategory: 'test',
    priceTier: '$$',
    tags: [],
    useCases: [],
    vibeTags: [],
    energyLevel: params.energy ?? 0.5,
    socialDensity: 0.45,
    uniquenessScore: 0.55,
    distinctivenessScore: 0.55,
    underexposureScore: 0.4,
    shareabilityScore: 0.45,
    isChain: false,
    localSignals: {
      localFavoriteScore: 0.6,
      neighborhoodPrideScore: 0.7,
      repeatVisitorScore: 0.5,
    },
    roleAffinity: roleScores,
    imageUrl: '',
    shortDescription: '',
    narrativeFlavor: '',
    isHiddenGem: false,
    isActive: true,
    highlightCapable: true,
    durationProfile: {} as never,
    settings: {} as never,
    signature: { signatureScore: 0.6 } as never,
    source: {
      sourceOrigin: params.sourceOrigin ?? 'curated',
      businessStatus: 'operational',
      likelyOpenForCurrentWindow: true,
      timeConfidence: 0.2,
    } as never,
  }
  return {
    venue,
    candidateIdentity: {
      candidateId: params.id,
      baseVenueId: params.id,
      kind: 'base',
      traceLabel: params.name ?? params.id,
    },
    momentIdentity: {
      type: params.role === 'peak' ? 'anchor' : params.role === 'warmup' ? 'arrival' : 'close',
      strength: params.role === 'peak' ? 'strong' : 'medium',
    },
    fitBreakdown: {
      anchorFit: 0.6,
      crewFit: 0.6,
      proximityFit: 0.6,
      budgetFit: 0.6,
      uniquenessFit: 0.6,
      hiddenGemFit: 0.4,
    },
    fitScore: 0.62,
    hiddenGemScore: 0.4,
    lensCompatibility: 0.62,
    contextSpecificity: {
      overall: 0.62,
      personaSignal: 0.62,
      vibeSignal: 0.62,
      lensSignal: 0.62,
      byRole: {
        warmup: 0.62,
        peak: 0.62,
        wildcard: 0.62,
        cooldown: 0.62,
      },
    },
    dominanceControl: {
      universalityScore: 0.1,
      flaggedUniversal: false,
      byRole: {
        warmup: 0.1,
        peak: 0.1,
        wildcard: 0.1,
        cooldown: 0.1,
      },
    },
    roleContract,
    stopShapeFit,
    vibeAuthority: {
      primary: 0.6,
      secondary: 0.5,
      overall: 0.6,
      packPressure: { highlight: 0.5 },
      byRole: {
        start: 0.62,
        highlight: 0.62,
        surprise: 0.62,
        windDown: 0.62,
      },
      pressureSource: { highlight: 'primary' },
      musicSupportSource: 'none',
      adventureRead: 'urban',
      adventureReadScores: { outdoor: 0.1, urban: 0.6 },
      adventureNotes: [],
    } as never,
    highlightValidity: {
      validityLevel: 'valid',
      packLiteralRequirementSatisfied: true,
      packLiteralRequirementLabel: '',
      personaVetoes: [],
      contextVetoes: [],
      violations: [],
    } as never,
    roleScores,
    taste: {
      signals: {
        energy: params.energy ?? 0.5,
        socialDensity: 0.45,
        intimacy: 0.62,
        lingerFactor: 0.62,
        destinationFactor: params.role === 'peak' ? 0.75 : 0.4,
        experientialFactor: params.role === 'peak' ? 0.72 : 0.35,
        conversationFriendliness: 0.7,
        anchorStrength: params.role === 'peak' ? 0.8 : 0.35,
        interactiveStrength: 0.4,
        durationEstimate: 'linger',
        isRomanticMomentCandidate: params.role === 'peak',
        primaryExperienceArchetype: params.role === 'peak' ? 'dining' : 'coffee',
        experienceArchetypes: params.role === 'peak' ? ['dining'] : ['sweet'],
        categorySpecificity: 0.68,
        personalityStrength: 0.62,
        momentPotential: { score: params.role === 'peak' ? 0.8 : 0.35 },
        momentIntensity: { score: params.role === 'peak' ? 0.68 : 0.35 },
        momentEnrichment: { ambientUniqueness: 0.55 },
        romanticSignals: {
          ambiance: 0.62,
          ambientExperience: 0.6,
          scenic: 0.35,
          intimacy: 0.62,
        },
        roleSuitability: {
          start: params.role === 'warmup' ? params.roleScore : 0.55,
          highlight: params.role === 'peak' ? params.roleScore : 0.55,
          surprise: 0.55,
          windDown: params.role === 'cooldown' ? params.roleScore : 0.55,
        },
        momentTier: params.role === 'peak' ? 'anchor' : 'support',
      } as never,
      modeAlignment: {
        score: 0.68,
        penalty: 0,
        lane: params.category ?? 'cafe',
        tier: 'primary',
        supportiveTagScore: 0,
        lanePriorityScore: 0,
      } as never,
      fallbackPenalty: {
        signalScore: 0,
        appliedPenalty: 0,
        applied: false,
        strongerAlternativePresent: false,
        reason: '',
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
  }
}

const crewPolicy: CrewPolicy = {
  id: 'test',
  label: 'Test',
  blockedCategories: [],
  preferredCategories: [],
  budgetSensitivity: 'balanced',
  pace: 'balanced',
} as never

const lens: ExperienceLens = {
  id: 'test-lens',
  label: 'Test lens',
  tasteMode: { id: 'coffee-date' },
  windDownExpectation: {
    preferredCategories: ['cafe', 'dessert'],
    discouragedCategories: [],
  },
} as never

const roleContracts: RoleContractSet = {
  sourceLabels: ['test'],
  byRole: {
    start: {
      label: 'Start support contract',
      role: 'start',
      strength: 'strong',
      requiredCategories: ['restaurant'],
      preferredCategories: [],
      discouragedCategories: [],
      requiredTags: [],
      preferredTags: [],
      discouragedTags: [],
    },
    highlight: {
      label: 'Highlight contract',
      role: 'highlight',
      strength: 'strong',
      requiredCategories: ['restaurant'],
      preferredCategories: [],
      discouragedCategories: [],
      requiredTags: [],
      preferredTags: [],
      discouragedTags: [],
    },
    surprise: {
      label: 'Surprise contract',
      role: 'surprise',
      strength: 'none',
      requiredCategories: [],
      preferredCategories: [],
      discouragedCategories: [],
      requiredTags: [],
      preferredTags: [],
      discouragedTags: [],
    },
    windDown: {
      label: 'Wind-down support contract',
      role: 'windDown',
      strength: 'strong',
      requiredCategories: ['restaurant'],
      preferredCategories: [],
      discouragedCategories: [],
      requiredTags: [],
      preferredTags: [],
      discouragedTags: [],
    },
  },
}

const intent: IntentProfile = {
  id: 'test-build-tight-support',
  mode: 'build',
  persona: 'romantic',
  planningMode: 'user-led',
  city: 'San Jose',
  primaryAnchor: 'cozy',
  distanceMode: 'nearby',
  budget: 'balanced',
  anchor: {
    venueId: 'sj-anchor',
    role: 'highlight',
  },
} as never

const experienceContract: ExperienceContract = {
  id: 'test-contract',
  persona: 'romantic',
  vibe: 'cozy',
  coordinationMode: 'staged',
  contractIdentity: 'romantic_cozy',
  summary: '',
  actStructure: { actCount: 3, actPattern: [] },
  highlightModel: 'single',
  highlightType: 'dining',
  movementStyle: 'contained',
  socialPosture: 'intimate',
  pacingStyle: 'linger',
  constraintPriority: {
    logistics: 'high',
    biologicalRhythm: 'medium',
    adultPayoffRequired: true,
    recoveryNodesRequired: true,
    lateNightAllowed: false,
  },
  venuePressure: {
    demandStrongCenterpiece: true,
    allowDistributedHighlight: false,
    requireCulturalAnchor: false,
    requireGroupBasecamp: false,
    requireKidEngagement: false,
  },
  occasionSemantics: {} as never,
  debug: { derivedFrom: [], contractReasonSummary: '', occasionReasonSummary: '' },
}

const contractConstraints: ContractConstraints = {
  id: 'test-constraints',
  experienceContractId: 'test-contract',
  peakCountModel: 'single',
  requireEscalation: false,
  requireContinuity: true,
  requireRecoveryWindows: true,
  maxEnergyDropTolerance: 'low',
  socialDensityBand: 'low',
  movementTolerance: 'contained',
  allowLateHighEnergy: false,
  windDownStrictness: 'soft_required',
  highlightPressure: 'strong',
  multiAnchorAllowed: false,
  groupBasecampPreferred: false,
  kidEngagementRequired: false,
  adultPayoffRequired: true,
  debug: { derivedFrom: [], constraintReasonSummary: '' },
}

const routeShapeContract: RouteShapeContract = {
  id: 'test-route-shape',
  arcShape: 'steady_open_curated_center_soft_landing',
  roleProfile: {
    start: { intent: 'set-tone', energyLevel: 'low', pacing: 'linger', variability: 'guided-flex' },
    highlight: { intent: 'centerpiece', energyLevel: 'medium', pacing: 'linger', variability: 'fixed' },
    windDown: { intent: 'landing', energyLevel: 'low', pacing: 'linger', variability: 'guided-flex' },
  },
  roleInvariants: {
    start: { requiredTraits: ['continuity'], preferredTraits: [], forbiddenTraits: [], allowSwapToWeaker: false, allowEscalation: false },
    highlight: { requiredTraits: ['centerpiece'], preferredTraits: [], forbiddenTraits: [], allowSwapToWeaker: false, allowEscalation: false },
    windDown: { requiredTraits: ['continuity'], preferredTraits: [], forbiddenTraits: [], allowSwapToWeaker: false, allowEscalation: false },
  },
  movementProfile: {
    radius: 'tight',
    maxTransitionMinutes: 14,
    neighborhoodContinuity: 'strict',
  },
  mutationProfile: {
    swapFlexibility: 'low',
    allowedRoles: ['start', 'highlight', 'windDown'],
    preservePriority: ['role', 'feasibility', 'movement'],
  },
  expansionProfile: {
    supportsNearbyExtensions: false,
    preferredExpansionRole: 'windDown',
    lateNightTolerance: 'low',
  },
}

function makeWorld(includeNearSupports: boolean): ScoredVenue[] {
  return [
    makeScoredVenue({
      id: 'sj-anchor',
      name: 'Required Anchor',
      role: 'peak',
      neighborhood: 'anchor-neighborhood',
      driveMinutes: 4,
      roleScore: 0.88,
      category: 'restaurant',
      contractSatisfied: true,
    }),
    ...Array.from({ length: 4 }, (_, index) =>
      makeScoredVenue({
        id: `far-start-${index}`,
        role: 'warmup',
        neighborhood: `far-start-${index}`,
        driveMinutes: 8 + index,
        roleScore: 0.84,
        category: 'restaurant',
        contractSatisfied: true,
      }),
    ),
    ...Array.from({ length: 4 }, (_, index) =>
      makeScoredVenue({
        id: `far-wind-${index}`,
        role: 'cooldown',
        neighborhood: `far-wind-${index}`,
        driveMinutes: 8 + index,
        roleScore: 0.84,
        category: 'restaurant',
        contractSatisfied: true,
        energy: 0.38,
      }),
    ),
    ...(includeNearSupports
      ? [
          makeScoredVenue({
            id: 'near-start',
            role: 'warmup',
            neighborhood: 'anchor-neighborhood',
            driveMinutes: 4,
            roleScore: 0.5,
            category: 'cafe',
            contractSatisfied: false,
          }),
          makeScoredVenue({
            id: 'near-wind',
            role: 'cooldown',
            neighborhood: 'anchor-neighborhood',
            driveMinutes: 4,
            roleScore: 0.5,
            category: 'dessert',
            contractSatisfied: false,
            energy: 0.3,
          }),
        ]
      : []),
  ]
}

function buildPools(scoredVenues: ScoredVenue[]) {
  return buildRolePools(
    scoredVenues,
    crewPolicy,
    lens,
    intent,
    roleContracts,
    true,
    contractConstraints,
    experienceContract,
  )
}

const poolsWithNearSupports = buildPools(makeWorld(true))
const startNearAdmitted = poolsWithNearSupports.warmup.some(
  (candidate) => candidate.candidateIdentity.baseVenueId === 'near-start',
)
const windDownNearAdmitted = poolsWithNearSupports.cooldown.some(
  (candidate) => candidate.candidateIdentity.baseVenueId === 'near-wind',
)
assert(startNearAdmitted, 'Tight Build start support should admit same-neighborhood support.')
assert(windDownNearAdmitted, 'Tight Build windDown support should admit same-neighborhood support.')
assert(
  poolsWithNearSupports.contractPoolStatus.warmup.nearAnchorSupportCandidateCountBeforeAdmission === 0,
  'Near start support should prove admission changed the role pool.',
)
assert(
  (poolsWithNearSupports.contractPoolStatus.warmup.nearAnchorSupportCandidateCountAfterAdmission ?? 0) > 0,
  'Near start support after-admission count must be exposed.',
)
assert(
  (poolsWithNearSupports.contractPoolStatus.cooldown.nearAnchorSupportCandidateCountAfterAdmission ?? 0) > 0,
  'Near windDown support after-admission count must be exposed.',
)

const arcAssembly = assembleArcCandidates(
  makeWorld(true),
  intent,
  crewPolicy,
  lens,
  poolsWithNearSupports,
  { routeShapeContract },
)
const anchorNearCandidate = arcAssembly.preTop40Candidates?.find((candidate) => {
  const ids = candidate.stops.map((stop) => stop.scoredVenue.candidateIdentity.baseVenueId)
  return ids.includes('sj-anchor') && ids.includes('near-start') && ids.includes('near-wind')
})
assert(
  anchorNearCandidate,
  'Assembly should be able to produce an anchor-preserving candidate with near supports.',
)

const waypointInput: WaypointContractInput = {
  strategyAdmissibleWorlds: [],
  requiredStopGuarantee: {
    source: 'test',
    required: true,
    role: 'highlight',
    venueId: 'sj-anchor',
    reasonCodes: ['test'],
  },
  routeShapeContract,
  normalizedContext: {},
  compatibilityIntent: intent,
  source: 'compatibility_projection',
}
const ranked = rankArcCandidatesFromContract([anchorNearCandidate], waypointInput).ranked[0]
assert(
  ranked?.routeShapeCompactnessSignals.compactCandidate ||
    ranked?.routeShapeCompactnessSignals.clusterEscapeCount === 0,
  'Anchor-preserving near-support candidate should be compact or near-compact under tight route shape.',
)

const poolsWithoutNearSupports = buildPools(makeWorld(false))
assert(
  poolsWithoutNearSupports.contractPoolStatus.warmup.supportSupplyMissing === true,
  'Missing start support supply must be diagnosed.',
)
assert(
  poolsWithoutNearSupports.contractPoolStatus.cooldown.supportSupplyMissing === true,
  'Missing windDown support supply must be diagnosed.',
)
assert(
  poolsWithoutNearSupports.warmup.length > 0 && poolsWithoutNearSupports.cooldown.length > 0,
  'Broad supports must remain available as fallback when near-anchor support is missing.',
)

const buildRolePoolsSource = readFileSync('src/domain/arc/buildRolePools.ts', 'utf8')
const routeSupportFeasibilitySource = readFileSync(
  'src/domain/bearings/evaluateRouteSupportFeasibility.ts',
  'utf8',
)
const routePlaceRightContractSource = readFileSync(
  'src/domain/bearings/routePlaceRightContract.ts',
  'utf8',
)
const rolePoolTasteMeaningSource = readFileSync(
  'src/domain/interpretation/taste/computeRolePoolMeaningEvidence.ts',
  'utf8',
)
const routeAuthoritySource = readFileSync(
  'src/app/services/routeAuthority/routeAuthorityService.ts',
  'utf8',
)
const runtimeRouteArtifactSource = readFileSync(
  'src/domain/artifacts/runtimeRouteArtifact.ts',
  'utf8',
)
const providerSource = readFileSync(
  'src/domain/providers/buildProviderSourceOpportunity.ts',
  'utf8',
)
const greatStopSource = readFileSync(
  'src/domain/greatStop/buildGreatStopGateResult.ts',
  'utf8',
)

assert(
  buildRolePoolsSource.includes('isTightBuildSupportAdmissionActive') &&
    buildRolePoolsSource.includes("movementTolerance === 'contained'") &&
    buildRolePoolsSource.includes('contractConstraints.requireContinuity'),
  'Patch must be generic tight Build support admission logic.',
)
assert(
  buildRolePoolsSource.includes('evaluateRouteSupportFeasibility') &&
    buildRolePoolsSource.includes('DistrictRoutePlaceFacts') &&
    buildRolePoolsSource.includes("source: 'district'") &&
    buildRolePoolsSource.includes('gw1-bearings-2-compatibility-projection'),
  'Tight support admission must consume a DistrictRoutePlaceFacts input before Bearings judges support feasibility.',
)
assert(
  routeSupportFeasibilitySource.includes('districtFacts.supportProximity') &&
    routeSupportFeasibilitySource.includes('districtFacts.anchorSupportRelationships') &&
    routeSupportFeasibilitySource.includes('districtFacts.structuralConfidence') &&
    routeSupportFeasibilitySource.includes('districtFacts.compactness') &&
    routeSupportFeasibilitySource.includes('districtFacts.clusterCoherence') &&
    routeSupportFeasibilitySource.includes("source: 'bearings'") &&
    routeSupportFeasibilitySource.includes('consumedDistrictProvenance'),
  'Bearings support helper must judge from District structural facts and emit Bearings provenance.',
)
assert(
  !routeSupportFeasibilitySource.includes('venue.neighborhood') &&
    !routeSupportFeasibilitySource.includes('ScoredVenue') &&
    !routeSupportFeasibilitySource.includes('getScoredVenueBaseVenueId'),
  'Bearings support helper must not recompute same-neighborhood/proximity from raw candidates.',
)
assert(
  routePlaceRightContractSource.includes('export interface DistrictRoutePlaceFacts') &&
    routePlaceRightContractSource.includes('export interface BearingsRouteFeasibilityVerdict'),
  'Route Place-Right contract must keep District facts and Bearings verdicts distinct.',
)
assert(
  buildRolePoolsSource.includes('computeRolePoolMeaningEvidence') &&
    rolePoolTasteMeaningSource.includes("source: 'taste'") &&
    rolePoolTasteMeaningSource.includes('easyHangHardIncompatibleSignals') &&
    rolePoolTasteMeaningSource.includes('computeRolePoolMeaningEvidence'),
  'Role-pool meaning evidence must be Taste-authored while buildRolePools remains the consumer.',
)
assert(
  !buildRolePoolsSource.includes('Adega') &&
    !buildRolePoolsSource.includes('Qishr') &&
    !buildRolePoolsSource.includes('Little Portugal'),
  'Patch must not special-case venues or neighborhoods.',
)
assert(
  routeAuthoritySource.includes("provider_shadow_not_authority") &&
    !routeAuthoritySource.includes('tightSupportAdmission'),
  'routeAuthority must remain unchanged.',
)
assert(
  runtimeRouteArtifactSource.includes('export interface RuntimeRouteArtifact') &&
    !runtimeRouteArtifactSource.includes('tightSupportAdmission'),
  'RuntimeRouteArtifact shape must remain unchanged.',
)
assert(
  providerSource.includes('maxProviderCalls') || providerSource.includes('DEFAULT_NEARBY_RADIUS_M'),
  'Provider source file should remain the existing provider envelope implementation.',
)
assert(
  greatStopSource.includes('maxComfortableTotalMovementMinutes: 24') &&
    greatStopSource.includes("driveLikeMovement: 'limited'"),
  'Great Stop thresholds must remain unchanged.',
)
assert(fetchCallCount === 0, 'No fetch calls should occur in tight support admission test.')

const output = {
  tightSupportAdmissionActive: poolsWithNearSupports.contractPoolStatus.warmup.tightSupportAdmissionActive === true,
  requiredAnchorPreserved: Boolean(anchorNearCandidate),
  nearAnchorStartAdmitted: startNearAdmitted,
  nearAnchorWindDownAdmitted: windDownNearAdmitted,
  startNearBeforeAdmission:
    poolsWithNearSupports.contractPoolStatus.warmup.nearAnchorSupportCandidateCountBeforeAdmission,
  startNearAfterAdmission:
    poolsWithNearSupports.contractPoolStatus.warmup.nearAnchorSupportCandidateCountAfterAdmission,
  windDownNearAfterAdmission:
    poolsWithNearSupports.contractPoolStatus.cooldown.nearAnchorSupportCandidateCountAfterAdmission,
  broadSupportsRemainFallback:
    poolsWithoutNearSupports.warmup.length > 0 && poolsWithoutNearSupports.cooldown.length > 0,
  supportSupplyMissingWhenAbsent:
    poolsWithoutNearSupports.contractPoolStatus.warmup.supportSupplyMissing === true &&
    poolsWithoutNearSupports.contractPoolStatus.cooldown.supportSupplyMissing === true,
  compactAnchorPreservingCandidateAssembled: Boolean(anchorNearCandidate),
  districtFactsConsumedByBearings:
    buildRolePoolsSource.includes('DistrictRoutePlaceFacts') &&
    routeSupportFeasibilitySource.includes('districtFacts.supportProximity'),
  bearingsSupportVerdictProvenance:
    routeSupportFeasibilitySource.includes("source: 'bearings'") &&
    routeSupportFeasibilitySource.includes('consumedDistrictProvenance'),
  bearingsRecomputesDistrictFacts: false,
  providerCallEnvelopeChanged: false,
  greatStopThresholdsUnchanged: true,
  routeAuthorityUnchanged: true,
  runtimeRouteArtifactShapeUnchanged: true,
  providerShadowRemainsNonAuthoritative: true,
  fetchCallCount,
}

console.log(JSON.stringify(output, null, 2))
