import { sanJoseVenues } from '../src/data/venues.ts'
import { assembleArcCandidates } from '../src/domain/arc/assembleArcCandidates.ts'
import { buildRolePools } from '../src/domain/arc/buildRolePools.ts'
import { scoreArcAssembly } from '../src/domain/arc/scoreArcAssembly.ts'
import { FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY } from '../src/domain/field/corpus/fieldStaticProviderCorpusConfig.ts'
import { runGeneratePlan } from '../src/domain/runGeneratePlan.ts'
import type { ScoredVenue } from '../src/domain/types/arc.ts'
import type { CrewPolicy } from '../src/domain/types/crewPolicies.ts'
import type { ExperienceLens } from '../src/domain/types/experienceLens.ts'
import type {
  ContractConstraints,
  ExperienceContract,
  IntentInput,
  IntentProfile,
} from '../src/domain/types/intent.ts'
import type {
  RoleContractSet,
  RolePoolCompatibilityStatus,
} from '../src/domain/types/roleContract.ts'
import { projectRolePoolAdmissionStatus } from '../src/domain/types/roleContract.ts'
import type { InternalRole, Venue } from '../src/domain/types/venue.ts'

const originalFetch = globalThis.fetch
const originalCorpusFlag = process.env[FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY]
const originalSourceMode = process.env.VITE_ID8_SOURCE_MODE
const originalGoogleKey = process.env.VITE_GOOGLE_PLACES_API_KEY

let fetchCallCount = 0

globalThis.fetch = (async (input) => {
  fetchCallCount += 1
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  throw new Error(`Role-pool admission parity observer must not call fetch: ${url}`)
}) as typeof fetch

process.env[FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY] = '1'
process.env.VITE_ID8_SOURCE_MODE = 'curated'
delete process.env.VITE_GOOGLE_PLACES_API_KEY

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function assertDeepEqual<T>(actual: T, expected: T, label: string): void {
  const actualJson = JSON.stringify(actual, null, 2)
  const expectedJson = JSON.stringify(expected, null, 2)
  assert(actualJson === expectedJson, `${label} changed.\nExpected:\n${expectedJson}\nActual:\n${actualJson}`)
}

function summarizeAdmissionStatus(
  status: RolePoolCompatibilityStatus | ReturnType<typeof projectRolePoolAdmissionStatus>,
) {
  return {
    role: status.role,
    contractLabel: status.contractLabel,
    contractStrength: status.contractStrength,
    contractSatisfied: status.contractSatisfied,
    contractRelaxed: status.contractRelaxed,
    fallbackReason: status.fallbackReason,
    preferredDiscoveryVenueId: status.preferredDiscoveryVenueId,
    preferredDiscoveryVenueAdmitted: status.preferredDiscoveryVenueAdmitted,
    preferredDiscoveryVenueRejectedReason: status.preferredDiscoveryVenueRejectedReason,
    preferredDiscoveryVenueHoursRelaxed: status.preferredDiscoveryVenueHoursRelaxed,
    preferredDiscoveryVenueHoursRelaxationReason:
      status.preferredDiscoveryVenueHoursRelaxationReason,
    tightSupportAdmissionActive: status.tightSupportAdmissionActive,
    tightSupportAdmissionReason: status.tightSupportAdmissionReason,
    requiredAnchorBaseVenueId: status.requiredAnchorBaseVenueId,
    requiredAnchorNeighborhood: status.requiredAnchorNeighborhood,
    supportSupplyMissing: status.supportSupplyMissing,
  }
}

function assertAdmissionProjection(status: RolePoolCompatibilityStatus, label: string) {
  assertDeepEqual(
    summarizeAdmissionStatus(projectRolePoolAdmissionStatus(status)),
    summarizeAdmissionStatus(status),
    `${label} admission bucket projection`,
  )
}

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

function makeAdmissionScoredVenue(params: {
  id: string
  role: InternalRole
  roleScore: number
  neighborhood?: string
  driveMinutes?: number
  category?: Venue['category']
  contractSatisfied?: boolean
  lensCompatibility?: number
  energy?: number
  momentPotential?: number
  momentIntensity?: number
  anchorStrength?: number
  experientialFactor?: number
  destinationFactor?: number
  sourceOrigin?: string
  businessStatus?: string
  likelyOpenForCurrentWindow?: boolean
  hoursKnown?: boolean
  openNow?: boolean
  timeConfidence?: number
}): ScoredVenue {
  const roleScores = roleScoresFor(params.role, params.roleScore)
  const stopShapeFit = shapeScoresFor(params.role, params.roleScore)
  const contractSatisfied = params.contractSatisfied ?? true
  const category = params.category ?? 'restaurant'
  const energy = params.energy ?? 0.5
  const lensCompatibility = params.lensCompatibility ?? 0.68
  const momentPotential = params.momentPotential ?? (params.role === 'peak' ? 0.82 : 0.35)
  const momentIntensity = params.momentIntensity ?? (params.role === 'peak' ? 0.72 : 0.35)
  const anchorStrength = params.anchorStrength ?? (params.role === 'peak' ? 0.82 : 0.35)
  const experientialFactor =
    params.experientialFactor ?? (params.role === 'peak' ? 0.78 : 0.35)
  const destinationFactor =
    params.destinationFactor ?? (params.role === 'peak' ? 0.74 : 0.4)
  const contractFor = (role: InternalRole) => ({
    contractLabel: 'admission fixture contract',
    strength: 'strong',
    score: role === params.role && !contractSatisfied ? 0.2 : 0.9,
    satisfied: role !== params.role || contractSatisfied,
    matchedSignals: [],
    violations: role === params.role && !contractSatisfied ? ['off-contract'] : [],
  })
  const venue: Venue = {
    id: params.id,
    name: params.id,
    city: 'San Jose',
    neighborhood: params.neighborhood ?? 'admission-neighborhood',
    driveMinutes: params.driveMinutes ?? 4,
    category,
    subcategory: 'admission-fixture',
    priceTier: '$$',
    tags: [],
    useCases: [],
    vibeTags: [],
    energyLevel: energy,
    socialDensity: 0.48,
    uniquenessScore: 0.62,
    distinctivenessScore: 0.62,
    underexposureScore: 0.4,
    shareabilityScore: 0.48,
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
    settings: { highlightCapabilityTier: 'capable' } as never,
    signature: { signatureScore: 0.6 } as never,
    source: {
      sourceOrigin: params.sourceOrigin ?? 'curated',
      businessStatus: params.businessStatus ?? 'operational',
      likelyOpenForCurrentWindow: params.likelyOpenForCurrentWindow ?? true,
      timeConfidence: params.timeConfidence ?? 0.2,
      openNow: params.openNow,
      hoursKnown: params.hoursKnown ?? true,
      sourceTypes: [],
      sourceQueryLabel: 'admission fixture',
    } as never,
  }

  return {
    venue,
    candidateIdentity: {
      candidateId: params.id,
      baseVenueId: params.id,
      kind: 'base',
      traceLabel: params.id,
    },
    momentIdentity: {
      type: params.role === 'peak' ? 'anchor' : params.role === 'warmup' ? 'arrival' : 'close',
      strength: params.role === 'peak' ? 'strong' : 'medium',
    },
    fitBreakdown: {
      anchorFit: 0.68,
      crewFit: 0.68,
      proximityFit: 0.72,
      budgetFit: 0.62,
      uniquenessFit: 0.62,
      hiddenGemFit: 0.4,
    },
    fitScore: 0.68,
    hiddenGemScore: 0.4,
    lensCompatibility,
    contextSpecificity: {
      overall: lensCompatibility,
      personaSignal: lensCompatibility,
      vibeSignal: lensCompatibility,
      lensSignal: lensCompatibility,
      byRole: {
        warmup: lensCompatibility,
        peak: lensCompatibility,
        wildcard: lensCompatibility,
        cooldown: lensCompatibility,
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
    roleContract: {
      warmup: contractFor('warmup'),
      peak: contractFor('peak'),
      wildcard: {
        contractLabel: 'admission fixture contract',
        strength: 'none',
        score: 0.8,
        satisfied: true,
        matchedSignals: [],
        violations: [],
      },
      cooldown: contractFor('cooldown'),
    } as ScoredVenue['roleContract'],
    stopShapeFit,
    vibeAuthority: {
      primary: 0.62,
      secondary: 0.5,
      overall: 0.62,
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
      validForIntent: true,
      packLiteralRequirementSatisfied: true,
      packLiteralRequirementLabel: '',
      personaVetoes: [],
      contextVetoes: [],
      violations: [],
    } as never,
    roleScores,
    taste: {
      signals: {
        energy,
        socialDensity: 0.48,
        intimacy: 0.68,
        lingerFactor: 0.68,
        destinationFactor,
        experientialFactor,
        conversationFriendliness: 0.7,
        anchorStrength,
        interactiveStrength: 0.58,
        durationEstimate: 'linger',
        isRomanticMomentCandidate: params.role === 'peak',
        primaryExperienceArchetype: params.role === 'peak' ? 'dining' : 'coffee',
        experienceArchetypes: params.role === 'peak' ? ['dining'] : ['sweet'],
        categorySpecificity: 0.68,
        personalityStrength: 0.68,
        momentPotential: { score: momentPotential },
        momentIntensity: { score: momentIntensity },
        momentEnrichment: { ambientUniqueness: 0.55 },
        romanticSignals: {
          ambiance: 0.68,
          ambientExperience: 0.68,
          scenic: 0.35,
          intimacy: 0.68,
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
        lane: category,
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

const admissionCrewPolicy: CrewPolicy = {
  id: 'admission-fixture',
  label: 'Admission fixture',
  blockedCategories: [],
  preferredCategories: [],
  budgetSensitivity: 'balanced',
  pace: 'balanced',
} as never

const admissionLens: ExperienceLens = {
  id: 'admission-lens',
  label: 'Admission lens',
  tasteMode: { id: 'coffee-date' },
  windDownExpectation: {
    preferredCategories: ['cafe', 'dessert', 'restaurant'],
    discouragedCategories: [],
  },
} as never

const admissionRoleContracts: RoleContractSet = {
  sourceLabels: ['admission-fixture'],
  byRole: {
    start: {
      label: 'Admission start contract',
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
      label: 'Admission highlight contract',
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
      label: 'Admission surprise contract',
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
      label: 'Admission wind-down contract',
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

const admissionContractConstraints: ContractConstraints = {
  id: 'admission-constraints',
  experienceContractId: 'admission-contract',
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

const admissionExperienceContract: ExperienceContract = {
  id: 'admission-contract',
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

function buildPools(scoredVenues: ScoredVenue[], intent: IntentProfile) {
  return buildRolePools(
    scoredVenues,
    admissionCrewPolicy,
    admissionLens,
    intent,
    admissionRoleContracts,
    true,
    admissionContractConstraints,
    admissionExperienceContract,
  )
}

function baseIntent(overrides?: Partial<IntentProfile>): IntentProfile {
  return {
    id: 'admission-fixture',
    mode: 'build',
    persona: 'romantic',
    planningMode: 'user-led',
    city: 'San Jose',
    primaryAnchor: 'cozy',
    distanceMode: 'nearby',
    budget: 'balanced',
    ...overrides,
  } as IntentProfile
}

function baseWorld(params?: { preferredId?: string; preferred?: ScoredVenue }): ScoredVenue[] {
  const preferred =
    params?.preferred ??
    makeAdmissionScoredVenue({
      id: params?.preferredId ?? 'preferred-highlight',
      role: 'peak',
      roleScore: 0.88,
      contractSatisfied: false,
      category: 'restaurant',
    })
  return [
    makeAdmissionScoredVenue({
      id: 'start-support',
      role: 'warmup',
      roleScore: 0.84,
      category: 'restaurant',
    }),
    preferred,
    makeAdmissionScoredVenue({
      id: 'generic-highlight',
      role: 'peak',
      roleScore: 0.86,
      category: 'restaurant',
    }),
    makeAdmissionScoredVenue({
      id: 'wind-support',
      role: 'cooldown',
      roleScore: 0.84,
      category: 'restaurant',
      energy: 0.35,
    }),
  ]
}

function idsInCandidates(candidates: readonly { stops: readonly { scoredVenue: ScoredVenue }[] }[]) {
  return new Set(
    candidates.flatMap((candidate) =>
      candidate.stops.map((stop) => stop.scoredVenue.candidateIdentity.baseVenueId),
    ),
  )
}

function assertPreferredAdmissionFixture() {
  const intent = baseIntent({
    discoveryPreferences: [{ venueId: 'preferred-highlight', role: 'highlight' }],
  })
  const world = baseWorld()
  const pools = buildPools(world, intent)
  const status = pools.contractPoolStatus.peak
  assertAdmissionProjection(status, 'preferred-admitted peak')

  assert(status.preferredDiscoveryVenueId === 'preferred-highlight', 'Preferred id changed.')
  assert(status.preferredDiscoveryVenueAdmitted === true, 'Preferred venue should be admitted.')
  assert(status.preferredDiscoveryVenueRejectedReason === undefined, 'Admitted preferred venue should not carry rejection.')
  assert(
    pools.peak.some((candidate) => candidate.candidateIdentity.baseVenueId === 'preferred-highlight'),
    'Admitted preferred venue must survive role-pool admission.',
  )

  const preferredPeak = pools.peak.find(
    (candidate) => candidate.candidateIdentity.baseVenueId === 'preferred-highlight',
  )
  assert(preferredPeak, 'Missing preferred peak candidate after admission.')
  const warmup = pools.warmup[0]
  const cooldown = pools.cooldown[0]
  assert(warmup && cooldown, 'Preferred admission fixture must have support stops.')

  const stops = [
    { role: 'warmup' as const, scoredVenue: warmup },
    { role: 'peak' as const, scoredVenue: preferredPeak },
    { role: 'cooldown' as const, scoredVenue: cooldown },
  ]
  const withPools = scoreArcAssembly(
    stops,
    intent,
    admissionCrewPolicy,
    admissionLens,
    pools,
  )
  const withoutPools = scoreArcAssembly(stops, intent, admissionCrewPolicy, admissionLens)

  assert(
    withoutPools.scoreBreakdown.contractOverrideApplied === false,
    'Control score should not apply preferred-discovery override without role-pool admission truth.',
  )
  assert(
    withPools.scoreBreakdown.contractOverrideApplied === true &&
      withPools.scoreBreakdown.contractOverrideRoles.includes('peak'),
    'Preferred-discovery score override must remain applied from admission status.',
  )

  return {
    admission: summarizeAdmissionStatus(status),
    preferredSurvivedRolePool: true,
    scoreOverride: {
      controlApplied: withoutPools.scoreBreakdown.contractOverrideApplied,
      admittedApplied: withPools.scoreBreakdown.contractOverrideApplied,
      roles: withPools.scoreBreakdown.contractOverrideRoles,
    },
  }
}

function assertPreferredRejectionFixture() {
  const rejectedPreferred = makeAdmissionScoredVenue({
    id: 'rejected-highlight',
    role: 'peak',
    roleScore: 0.12,
    lensCompatibility: 0.1,
    category: 'restaurant',
  })
  const intent = baseIntent({
    discoveryPreferences: [{ venueId: 'rejected-highlight', role: 'highlight' }],
  })
  const world = baseWorld({ preferred: rejectedPreferred })
  const pools = buildPools(world, intent)
  const status = pools.contractPoolStatus.peak
  assertAdmissionProjection(status, 'preferred-rejected peak')

  assert(status.preferredDiscoveryVenueId === 'rejected-highlight', 'Rejected preferred id changed.')
  assert(status.preferredDiscoveryVenueAdmitted === false, 'Rejected preferred venue should not be admitted.')
  assert(
    status.preferredDiscoveryVenueRejectedReason === 'rejected_context' ||
      status.preferredDiscoveryVenueRejectedReason === 'rejected_role_fit',
    'Rejected preferred venue must expose an admission rejection reason.',
  )
  assert(
    !pools.peak.some((candidate) => candidate.candidateIdentity.baseVenueId === 'rejected-highlight'),
    'Rejected preferred venue must not survive role-pool admission.',
  )

  const assembled = assembleArcCandidates(
    world,
    intent,
    admissionCrewPolicy,
    admissionLens,
    pools,
  )
  const assembledIds = idsInCandidates(assembled.candidates)
  assert(!assembledIds.has('rejected-highlight'), 'Rejected preferred venue must not survive arc assembly.')

  return {
    admission: summarizeAdmissionStatus(status),
    rejectedPreferredSurvivedRolePool: false,
    rejectedPreferredSurvivedArcAssembly: false,
    assembledCandidateCount: assembled.candidates.length,
  }
}

function assertContractRelaxedFixture() {
  const intent = baseIntent()
  const pools = buildPools(
    [
      makeAdmissionScoredVenue({
        id: 'recovered-central-moment',
        role: 'peak',
        roleScore: 0.12,
        category: 'restaurant',
        contractSatisfied: false,
        momentPotential: 0.96,
        momentIntensity: 0.96,
        anchorStrength: 0.96,
        experientialFactor: 0.96,
        destinationFactor: 0.92,
      }),
    ],
    intent,
  )
  const status = pools.contractPoolStatus.peak
  assertAdmissionProjection(status, 'contract-relaxed peak')
  assert(status.contractSatisfied === false, 'Contract-relaxed fixture should not satisfy the strict contract.')
  assert(status.contractRelaxed === true, 'Contract-relaxed fixture should expose relaxed admission.')
  assert(typeof status.fallbackReason === 'string', 'Contract-relaxed fixture must expose fallback reason.')

  return summarizeAdmissionStatus(status)
}

function assertHoursRelaxationFixture() {
  const intent = baseIntent({
    anchor: {
      venueId: 'hours-relaxed-anchor',
      role: 'highlight',
    },
    discoveryPreferences: [{ venueId: 'hours-relaxed-anchor', role: 'highlight' }],
  })
  const pools = buildPools(
    baseWorld({
      preferred: makeAdmissionScoredVenue({
        id: 'hours-relaxed-anchor',
        role: 'peak',
        roleScore: 0.9,
        category: 'restaurant',
        sourceOrigin: 'live',
        likelyOpenForCurrentWindow: false,
        hoursKnown: false,
        openNow: undefined,
        timeConfidence: 0.7,
      }),
    }),
    intent,
  )
  const status = pools.contractPoolStatus.peak
  assertAdmissionProjection(status, 'hours-relaxation peak')
  assert(
    status.preferredDiscoveryVenueHoursRelaxed === true ||
      status.preferredDiscoveryVenueHoursRelaxed === undefined,
    'Hours relaxation field must remain either current relaxed truth or absent.',
  )
  if (status.preferredDiscoveryVenueHoursRelaxed === true) {
    assert(
      status.preferredDiscoveryVenueHoursRelaxationReason === 'no_explicit_time',
      'Hours relaxation reason changed.',
    )
  }

  return summarizeAdmissionStatus(status)
}

function assertTightSupportFixture() {
  const intent = baseIntent({
    anchor: {
      venueId: 'tight-anchor',
      role: 'highlight',
    },
  })
  const world = [
    makeAdmissionScoredVenue({
      id: 'tight-anchor',
      role: 'peak',
      roleScore: 0.88,
      neighborhood: 'anchor-neighborhood',
      category: 'restaurant',
    }),
    makeAdmissionScoredVenue({
      id: 'near-start',
      role: 'warmup',
      roleScore: 0.5,
      neighborhood: 'anchor-neighborhood',
      category: 'cafe',
      contractSatisfied: false,
    }),
    makeAdmissionScoredVenue({
      id: 'near-wind',
      role: 'cooldown',
      roleScore: 0.5,
      neighborhood: 'anchor-neighborhood',
      category: 'dessert',
      contractSatisfied: false,
      energy: 0.3,
    }),
    makeAdmissionScoredVenue({
      id: 'far-start',
      role: 'warmup',
      roleScore: 0.84,
      neighborhood: 'far-start',
      category: 'restaurant',
    }),
    makeAdmissionScoredVenue({
      id: 'far-wind',
      role: 'cooldown',
      roleScore: 0.84,
      neighborhood: 'far-wind',
      category: 'restaurant',
      energy: 0.35,
    }),
  ]
  const pools = buildPools(world, intent)
  const warmup = pools.contractPoolStatus.warmup
  const cooldown = pools.contractPoolStatus.cooldown
  assertAdmissionProjection(warmup, 'tight-support warmup')
  assertAdmissionProjection(cooldown, 'tight-support cooldown')
  assert(warmup.tightSupportAdmissionActive === true, 'Warmup tight-support admission should be active.')
  assert(cooldown.tightSupportAdmissionActive === true, 'Cooldown tight-support admission should be active.')
  assert(
    warmup.supportSupplyMissing === false && cooldown.supportSupplyMissing === false,
    'Near support fixture should not report missing support supply.',
  )

  const missingSupportPools = buildPools(
    world.filter(
      (candidate) =>
        candidate.candidateIdentity.baseVenueId !== 'near-start' &&
        candidate.candidateIdentity.baseVenueId !== 'near-wind',
    ),
    intent,
  )
  assertAdmissionProjection(
    missingSupportPools.contractPoolStatus.warmup,
    'tight-support missing warmup',
  )
  assertAdmissionProjection(
    missingSupportPools.contractPoolStatus.cooldown,
    'tight-support missing cooldown',
  )
  assert(
    missingSupportPools.contractPoolStatus.warmup.supportSupplyMissing === true &&
      missingSupportPools.contractPoolStatus.cooldown.supportSupplyMissing === true,
    'Missing near support fixture should preserve support-supply missing status.',
  )

  return {
    warmup: summarizeAdmissionStatus(warmup),
    cooldown: summarizeAdmissionStatus(cooldown),
    missingSupport: {
      warmup: summarizeAdmissionStatus(missingSupportPools.contractPoolStatus.warmup),
      cooldown: summarizeAdmissionStatus(missingSupportPools.contractPoolStatus.cooldown),
    },
  }
}

async function assertGeneratedPreferredTrace() {
  const input: IntentInput = {
    mode: 'build',
    planningMode: 'user-led',
    persona: 'romantic',
    primaryVibe: 'cozy',
    secondaryVibe: 'lively',
    city: 'San Jose',
    district: 'Little Portugal',
    distanceMode: 'short-drive',
    anchor: {
      venueId: 'sj-adega-wine-atelier',
      role: 'highlight',
    },
    discoveryPreferences: [
      {
        venueId: 'sj-adega-wine-atelier',
        role: 'highlight',
      },
    ],
  }
  const generated = await runGeneratePlan(input, {
    seedVenues: sanJoseVenues,
    sourceMode: 'curated',
    sourceModeOverrideApplied: true,
    debugMode: false,
  })
  const routeIds = generated.selectedArc.stops.map(
    (stop) => stop.scoredVenue.candidateIdentity.baseVenueId,
  )
  const highlightDiagnostics = generated.trace.rolePoolDiagnostics.highlight
  assert(routeIds.includes('sj-adega-wine-atelier'), 'Adega preferred anchor must survive route generation.')
  assert(highlightDiagnostics, 'Generated route must expose highlight diagnostics.')
  assert(
    highlightDiagnostics.preferredDiscoveryVenueId === 'sj-adega-wine-atelier' &&
      highlightDiagnostics.preferredDiscoveryVenueAdmitted === true,
    'Generated trace preferred-discovery admission changed.',
  )
  assert(
    highlightDiagnostics.selectedContractOverrideApplied === true,
    'Generated trace score override proof changed.',
  )

  return {
    route: generated.selectedArc.stops.map((stop) => ({
      role: stop.role,
      venueId: stop.scoredVenue.candidateIdentity.baseVenueId,
    })),
    highlightPreferred: {
      preferredDiscoveryVenueId: highlightDiagnostics.preferredDiscoveryVenueId,
      preferredDiscoveryVenueAdmitted: highlightDiagnostics.preferredDiscoveryVenueAdmitted,
      preferredDiscoveryVenueRejectedReason:
        highlightDiagnostics.preferredDiscoveryVenueRejectedReason,
      selectedContractOverrideApplied:
        highlightDiagnostics.selectedContractOverrideApplied,
      preferredCandidateSurvivedToArc:
        highlightDiagnostics.preferredCandidateSurvivedToArc,
    },
  }
}

async function main(): Promise<void> {
  const observed = {
    generatedPreferredTrace: await assertGeneratedPreferredTrace(),
    preferredAdmitted: assertPreferredAdmissionFixture(),
    preferredRejected: assertPreferredRejectionFixture(),
    contractRelaxed: assertContractRelaxedFixture(),
    hoursRelaxation: assertHoursRelaxationFixture(),
    tightSupport: assertTightSupportFixture(),
  }

  assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)

  process.stdout.write(
    `${JSON.stringify(
      {
        observer: 'role_pool_admission_parity',
        status: 'PASS',
        admissionFieldsCovered: {
          contractSatisfied: true,
          contractRelaxed: true,
          fallbackReason: true,
          preferredDiscoveryVenueId: true,
          preferredDiscoveryVenueAdmitted: true,
          preferredDiscoveryVenueRejectedReason: true,
          preferredDiscoveryVenueHoursRelaxed: true,
          preferredDiscoveryVenueHoursRelaxationReason: true,
          tightSupportAdmissionActive: true,
          tightSupportAdmissionReason: true,
          requiredAnchorBaseVenueId: true,
          requiredAnchorNeighborhood: true,
          supportSupplyMissing: true,
        },
        behaviorAdjacentProof: {
          preferredAdmittedSurvives: true,
          preferredRejectedDoesNotSurvive: true,
          preferredDiscoveryScoreOverridePreserved: true,
          contractRelaxedFallbackReasonPreserved: true,
          tightSupportSupportSupplyPreserved: true,
        },
        observed,
        providerNetworkCounts: { fetchCallCount },
      },
      null,
      2,
    )}\n`,
  )
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
  .finally(() => {
    globalThis.fetch = originalFetch
    if (originalCorpusFlag === undefined) {
      delete process.env[FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY]
    } else {
      process.env[FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY] = originalCorpusFlag
    }
    if (originalSourceMode === undefined) {
      delete process.env.VITE_ID8_SOURCE_MODE
    } else {
      process.env.VITE_ID8_SOURCE_MODE = originalSourceMode
    }
    if (originalGoogleKey === undefined) {
      delete process.env.VITE_GOOGLE_PLACES_API_KEY
    } else {
      process.env.VITE_GOOGLE_PLACES_API_KEY = originalGoogleKey
    }
  })
