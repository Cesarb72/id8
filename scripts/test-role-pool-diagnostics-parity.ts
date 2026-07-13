import { starterPacks } from '../src/data/starterPacks.ts'
import { sanJoseVenues } from '../src/data/venues.ts'
import { buildRolePools } from '../src/domain/arc/buildRolePools.ts'
import { buildCurateFailedStarterDiagnostics } from '../src/domain/diagnostics/buildCurateFailedStarterDiagnostics.ts'
import { FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY } from '../src/domain/field/corpus/fieldStaticProviderCorpusConfig.ts'
import { runGeneratePlan } from '../src/domain/runGeneratePlan.ts'
import type { ScoredVenue } from '../src/domain/types/arc.ts'
import type { CrewPolicy } from '../src/domain/types/crewPolicies.ts'
import type { RolePoolDiagnostics } from '../src/domain/types/diagnostics.ts'
import type { ExperienceLens } from '../src/domain/types/experienceLens.ts'
import type { IntentInput } from '../src/domain/types/intent.ts'
import type {
  ContractConstraints,
  ExperienceContract,
  IntentProfile,
} from '../src/domain/types/intent.ts'
import type { UserStopRole } from '../src/domain/types/itinerary.ts'
import {
  projectRolePoolDiagnosticsStatus,
  type RoleContractSet,
  type RolePoolCompatibilityStatus,
  type RolePoolDiagnosticsStatus,
} from '../src/domain/types/roleContract.ts'
import type { StarterPack } from '../src/domain/types/starterPack.ts'
import type { InternalRole, Venue } from '../src/domain/types/venue.ts'

const originalFetch = globalThis.fetch
const originalCorpusFlag = process.env[FIELD_STATIC_PROVIDER_CORPUS_CURATE_ENV_KEY]
const originalSourceMode = process.env.VITE_ID8_SOURCE_MODE
const originalGoogleKey = process.env.VITE_GOOGLE_PLACES_API_KEY

let fetchCallCount = 0

globalThis.fetch = (async (input) => {
  fetchCallCount += 1
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  throw new Error(`Role-pool diagnostics parity observer must not call fetch: ${url}`)
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

function findStarterPack(id: string): StarterPack {
  const starterPack = starterPacks.find((candidate) => candidate.id === id)
  assert(starterPack, `Missing starter pack fixture: ${id}`)
  return starterPack
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

function makeDiagnosticScoredVenue(params: {
  id: string
  role: InternalRole
  roleScore: number
  neighborhood?: string
  driveMinutes?: number
  category?: Venue['category']
  contractSatisfied?: boolean
  energy?: number
  momentPotential?: number
  momentIntensity?: number
  anchorStrength?: number
  experientialFactor?: number
  destinationFactor?: number
  sourceOrigin?: string
}): ScoredVenue {
  const roleScores = roleScoresFor(params.role, params.roleScore)
  const stopShapeFit = shapeScoresFor(params.role, params.roleScore)
  const contractSatisfied = params.contractSatisfied ?? true
  const category = params.category ?? 'cafe'
  const energy = params.energy ?? 0.48
  const momentPotential = params.momentPotential ?? (params.role === 'peak' ? 0.8 : 0.35)
  const momentIntensity = params.momentIntensity ?? (params.role === 'peak' ? 0.72 : 0.35)
  const anchorStrength = params.anchorStrength ?? (params.role === 'peak' ? 0.82 : 0.35)
  const experientialFactor =
    params.experientialFactor ?? (params.role === 'peak' ? 0.78 : 0.35)
  const destinationFactor =
    params.destinationFactor ?? (params.role === 'peak' ? 0.74 : 0.4)
  const contractFor = (role: InternalRole) => ({
    contractLabel: 'diagnostics fixture contract',
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
    neighborhood: params.neighborhood ?? 'diagnostics-neighborhood',
    driveMinutes: params.driveMinutes ?? 4,
    category,
    subcategory: 'diagnostics',
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
      businessStatus: 'operational',
      likelyOpenForCurrentWindow: true,
      timeConfidence: 0.2,
      openNow: true,
      hoursKnown: true,
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
    lensCompatibility: 0.68,
    contextSpecificity: {
      overall: 0.68,
      personaSignal: 0.68,
      vibeSignal: 0.68,
      lensSignal: 0.68,
      byRole: {
        warmup: 0.68,
        peak: 0.68,
        wildcard: 0.68,
        cooldown: 0.68,
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
        contractLabel: 'diagnostics fixture contract',
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

const diagnosticCrewPolicy: CrewPolicy = {
  id: 'diagnostics',
  label: 'Diagnostics',
  blockedCategories: [],
  preferredCategories: [],
  budgetSensitivity: 'balanced',
  pace: 'balanced',
} as never

const diagnosticLens: ExperienceLens = {
  id: 'diagnostics-lens',
  label: 'Diagnostics lens',
  tasteMode: { id: 'coffee-date' },
  windDownExpectation: {
    preferredCategories: ['cafe', 'dessert'],
    discouragedCategories: [],
  },
} as never

const diagnosticIntent: IntentProfile = {
  id: 'diagnostics-build',
  mode: 'build',
  persona: 'romantic',
  planningMode: 'user-led',
  city: 'San Jose',
  primaryAnchor: 'cozy',
  distanceMode: 'nearby',
  budget: 'balanced',
  anchor: {
    venueId: 'diagnostics-anchor',
    role: 'highlight',
  },
} as never

const diagnosticRoleContracts: RoleContractSet = {
  sourceLabels: ['diagnostics'],
  byRole: {
    start: {
      label: 'Diagnostics start contract',
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
      label: 'Diagnostics highlight contract',
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
      label: 'Diagnostics surprise contract',
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
      label: 'Diagnostics wind-down contract',
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

const diagnosticContractConstraints: ContractConstraints = {
  id: 'diagnostics-constraints',
  experienceContractId: 'diagnostics-contract',
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

const diagnosticExperienceContract: ExperienceContract = {
  id: 'diagnostics-contract',
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

function summarizeTightSupportStatus(
  status: RolePoolCompatibilityStatus | RolePoolDiagnosticsStatus,
) {
  return {
    role: status.role,
    tightSupportAdmissionActive: status.tightSupportAdmissionActive,
    tightSupportAdmissionReason: status.tightSupportAdmissionReason,
    requiredAnchorBaseVenueId: status.requiredAnchorBaseVenueId,
    requiredAnchorNeighborhood: status.requiredAnchorNeighborhood,
    nearAnchorSupportCandidateCountBeforeAdmission:
      status.nearAnchorSupportCandidateCountBeforeAdmission,
    nearAnchorSupportCandidateCountAfterAdmission:
      status.nearAnchorSupportCandidateCountAfterAdmission,
    nearAnchorSupportCandidateIds: status.nearAnchorSupportCandidateIds,
    supportSupplyMissing: status.supportSupplyMissing,
  }
}

function buildTightSupportEmittedFixture() {
  const pools = buildRolePools(
    [
      makeDiagnosticScoredVenue({
        id: 'diagnostics-anchor',
        role: 'peak',
        roleScore: 0.88,
        neighborhood: 'anchor-neighborhood',
        category: 'restaurant',
      }),
      makeDiagnosticScoredVenue({
        id: 'near-start',
        role: 'warmup',
        roleScore: 0.5,
        neighborhood: 'anchor-neighborhood',
        category: 'cafe',
        contractSatisfied: false,
      }),
      makeDiagnosticScoredVenue({
        id: 'near-wind',
        role: 'cooldown',
        roleScore: 0.5,
        neighborhood: 'anchor-neighborhood',
        category: 'dessert',
        contractSatisfied: false,
        energy: 0.3,
      }),
      makeDiagnosticScoredVenue({
        id: 'far-start',
        role: 'warmup',
        roleScore: 0.84,
        neighborhood: 'far-start',
        category: 'restaurant',
      }),
      makeDiagnosticScoredVenue({
        id: 'far-wind',
        role: 'cooldown',
        roleScore: 0.84,
        neighborhood: 'far-wind',
        category: 'restaurant',
        energy: 0.35,
      }),
    ],
    diagnosticCrewPolicy,
    diagnosticLens,
    diagnosticIntent,
    diagnosticRoleContracts,
    true,
    diagnosticContractConstraints,
    diagnosticExperienceContract,
  )
  const warmupCompatibility = summarizeTightSupportStatus(pools.contractPoolStatus.warmup)
  const cooldownCompatibility = summarizeTightSupportStatus(pools.contractPoolStatus.cooldown)
  const warmupDiagnostics = summarizeTightSupportStatus(
    projectRolePoolDiagnosticsStatus(pools.contractPoolStatus.warmup),
  )
  const cooldownDiagnostics = summarizeTightSupportStatus(
    projectRolePoolDiagnosticsStatus(pools.contractPoolStatus.cooldown),
  )

  assertDeepEqual(
    warmupDiagnostics,
    warmupCompatibility,
    'Tight-support warmup diagnostics bucket projection',
  )
  assertDeepEqual(
    cooldownDiagnostics,
    cooldownCompatibility,
    'Tight-support cooldown diagnostics bucket projection',
  )

  return {
    warmup: warmupCompatibility,
    cooldown: cooldownCompatibility,
  }
}

function summarizeRecoveredCentralMomentStatus(status: RolePoolCompatibilityStatus) {
  return {
    role: status.role,
    contractRelaxed: status.contractRelaxed,
    fallbackReason: status.fallbackReason,
    relaxedCandidateCount: status.relaxedCandidateCount,
    recoveredCentralMomentHighlight: status.recoveredCentralMomentHighlight,
    recoveredHighlightCandidatesCount: status.recoveredHighlightCandidatesCount,
    centralMomentRecoveryReason: status.centralMomentRecoveryReason,
    selectedCandidateRecovered: status.recoveredCentralMomentHighlight === true,
  }
}

function summarizeRecoveredCentralMomentDiagnostics(
  status: RolePoolCompatibilityStatus | RolePoolDiagnosticsStatus,
) {
  return {
    role: status.role,
    relaxedCandidateCount: status.relaxedCandidateCount,
    recoveredCentralMomentHighlight: status.recoveredCentralMomentHighlight,
    recoveredHighlightCandidatesCount: status.recoveredHighlightCandidatesCount,
    centralMomentRecoveryReason: status.centralMomentRecoveryReason,
    selectedCandidateRecovered: status.recoveredCentralMomentHighlight === true,
  }
}

function buildRecoveredCentralMomentEmittedFixture() {
  const pools = buildRolePools(
    [
      makeDiagnosticScoredVenue({
        id: 'recovered-central-moment',
        role: 'peak',
        roleScore: 0.12,
        neighborhood: 'anchor-neighborhood',
        category: 'restaurant',
        momentPotential: 0.96,
        momentIntensity: 0.96,
        anchorStrength: 0.96,
        experientialFactor: 0.96,
        destinationFactor: 0.92,
      }),
    ],
    diagnosticCrewPolicy,
    diagnosticLens,
    diagnosticIntent,
    diagnosticRoleContracts,
    true,
    diagnosticContractConstraints,
    diagnosticExperienceContract,
  )

  const selectedPeak = pools.peak[0]
  const peakCompatibility = summarizeRecoveredCentralMomentStatus(
    pools.contractPoolStatus.peak,
  )
  const peakCompatibilityDiagnostics = summarizeRecoveredCentralMomentDiagnostics(
    pools.contractPoolStatus.peak,
  )
  const peakDiagnostics = summarizeRecoveredCentralMomentDiagnostics(
    projectRolePoolDiagnosticsStatus(pools.contractPoolStatus.peak),
  )

  assertDeepEqual(
    peakDiagnostics,
    peakCompatibilityDiagnostics,
    'Recovered-central-moment diagnostics bucket projection',
  )

  return {
    peak: peakCompatibility,
    selectedPeak: selectedPeak
      ? {
          candidateId: selectedPeak.candidateIdentity.baseVenueId,
          recoveredCentralMomentHighlight: selectedPeak.recoveredCentralMomentHighlight,
          centralMomentRecoveryReason: selectedPeak.centralMomentRecoveryReason,
        }
      : undefined,
  }
}

function summarizeRolePoolDiagnostics(
  diagnostics: Partial<Record<UserStopRole, RolePoolDiagnostics>>,
) {
  return {
    roles: (['start', 'highlight', 'surprise', 'windDown'] as const).filter(
      (role) => diagnostics[role] !== undefined,
    ),
    start: summarizeRoleDiagnostic(diagnostics.start),
    highlight: summarizeRoleDiagnostic(diagnostics.highlight),
    windDown: summarizeRoleDiagnostic(diagnostics.windDown),
  }
}

function summarizeRoleDiagnostic(diagnostic: RolePoolDiagnostics | undefined) {
  if (!diagnostic) {
    return undefined
  }
  return {
    rolePoolSize: diagnostic.rolePoolSize,
    strongCandidateCount: diagnostic.strongCandidateCount,
    categoryDiversityCount: diagnostic.categoryDiversityCount,
    topConfidenceBand: diagnostic.topConfidenceBand,
    weakPool: diagnostic.weakPool,
    weakPoolReason: diagnostic.weakPoolReason,
    selectedVenueId: diagnostic.selectedVenueId,
    selectedScore: diagnostic.selectedScore,
    runnerUpVenueId: diagnostic.runnerUpVenueId,
    runnerUpScore: diagnostic.runnerUpScore,
    fallbackUsed: diagnostic.fallbackUsed,
    fallbackLabel: diagnostic.fallbackLabel,
    roleContractLabel: diagnostic.roleContractLabel,
    roleContractStrength: diagnostic.roleContractStrength,
    contractStrictCandidateCount: diagnostic.contractStrictCandidateCount,
    contractRelaxedCandidateCount: diagnostic.contractRelaxedCandidateCount,
    contractSatisfied: diagnostic.contractSatisfied,
    contractRelaxed: diagnostic.contractRelaxed,
    contractFallbackReason: diagnostic.contractFallbackReason,
    bestContractCandidateId: diagnostic.bestContractCandidateId,
    preferredDiscoveryVenueId: diagnostic.preferredDiscoveryVenueId,
    preferredDiscoveryVenueAdmitted: diagnostic.preferredDiscoveryVenueAdmitted,
    preferredDiscoveryVenueRejectedReason: diagnostic.preferredDiscoveryVenueRejectedReason,
    preferredCandidateSurvivedToArc: diagnostic.preferredCandidateSurvivedToArc,
    preferredCandidateDroppedPreAssembly: diagnostic.preferredCandidateDroppedPreAssembly,
    selectedContractOverrideApplied: diagnostic.selectedContractOverrideApplied,
    selectedContractOverrideRole: diagnostic.selectedContractOverrideRole,
    selectedCandidateStillLostReason: diagnostic.selectedCandidateStillLostReason,
    selectedContractSatisfied: diagnostic.selectedContractSatisfied,
    selectedViolatesContract: diagnostic.selectedViolatesContract,
    highlightValidCandidateCount: diagnostic.highlightValidCandidateCount,
    highlightFallbackCandidateCount: diagnostic.highlightFallbackCandidateCount,
    highlightInvalidCandidateCount: diagnostic.highlightInvalidCandidateCount,
    fallbackUsedBecauseNoValidHighlight: diagnostic.fallbackUsedBecauseNoValidHighlight,
    bestValidHighlightCandidateId: diagnostic.bestValidHighlightCandidateId,
    bestValidHighlightChallengerId: diagnostic.bestValidHighlightChallengerId,
    selectedHighlightValidityLevel: diagnostic.selectedHighlightValidityLevel,
    selectedHighlightValidForIntent: diagnostic.selectedHighlightValidForIntent,
    selectedHighlightIsFallback: diagnostic.selectedHighlightIsFallback,
    selectedHighlightViolatesIntent: diagnostic.selectedHighlightViolatesIntent,
    selectedHighlightVetoReason: diagnostic.selectedHighlightVetoReason,
    packLiteralRequirementSatisfied: diagnostic.packLiteralRequirementSatisfied,
  }
}

function summarizeCompactnessDiagnostics(trace: Awaited<ReturnType<typeof runGeneratePlan>>['trace']) {
  const diagnostics = trace.buildCandidatePoolCompactnessDiagnostics
  if (!diagnostics) {
    return undefined
  }
  return {
    fullAssembledCandidateCount: diagnostics.fullAssembledCandidateCount,
    anchorPreservingAssembledCandidateCount: diagnostics.anchorPreservingAssembledCandidateCount,
    preTop40CandidateCount: diagnostics.preTop40CandidateCount,
    postTop40CandidateCount: diagnostics.postTop40CandidateCount,
    rolePoolNearAnchorSupportVisibility: diagnostics.rolePoolNearAnchorSupportVisibility,
  }
}

function summarizeFallbackTrace(trace: Awaited<ReturnType<typeof runGeneratePlan>>['trace']) {
  const fallback = trace.buildFallbackTrace
  if (!fallback) {
    return undefined
  }
  return {
    fullArcCandidatesCount: fallback.fullArcCandidatesCount,
    partialArcCandidatesCount: fallback.partialArcCandidatesCount,
    highlightOnlyCandidatesCount: fallback.highlightOnlyCandidatesCount,
    bestFullArcFound: fallback.bestFullArcFound,
    bestPartialArcFound: fallback.bestPartialArcFound,
    bestHighlightOnlyFound: fallback.bestHighlightOnlyFound,
    usedRecoveredCentralMomentHighlight: fallback.usedRecoveredCentralMomentHighlight,
    recoveredHighlightCandidatesCount: fallback.recoveredHighlightCandidatesCount,
    centralMomentRecoveryReason: fallback.centralMomentRecoveryReason,
    selectedFallbackType: fallback.selectedFallbackType,
    fallbackFailureReason: fallback.fallbackFailureReason,
  }
}

function summarizeFailedStarterRoleStatus(
  diagnostics: Awaited<ReturnType<typeof buildCurateFailedStarterDiagnostics>>,
) {
  const highlight = diagnostics.rolePools.highlight.contractStatus
  const highlightDiagnosticsStatus = projectRolePoolDiagnosticsStatus(highlight)
  return {
    starterId: diagnostics.starterId,
    startCount: diagnostics.rolePools.start.count,
    highlightCount: diagnostics.rolePools.highlight.count,
    windDownCount: diagnostics.rolePools.windDown.count,
    highlightStatus: {
      role: highlight.role,
      contractLabel: highlight.contractLabel,
      contractStrength: highlight.contractStrength,
      contractSatisfied: highlight.contractSatisfied,
      contractRelaxed: highlight.contractRelaxed,
      fallbackReason: highlight.fallbackReason,
      strictCandidateCount: highlight.strictCandidateCount,
      relaxedCandidateCount: highlight.relaxedCandidateCount,
      bestContractCandidateId: highlight.bestContractCandidateId,
      validCandidateCount: highlight.validCandidateCount,
      fallbackCandidateCount: highlight.fallbackCandidateCount,
      invalidCandidateCount: highlight.invalidCandidateCount,
      fallbackUsedBecauseNoValidHighlight: highlight.fallbackUsedBecauseNoValidHighlight,
      bestValidHighlightCandidateId: highlight.bestValidHighlightCandidateId,
      bestValidHighlightChallengerId: highlight.bestValidHighlightChallengerId,
      recoveredCentralMomentHighlight: highlight.recoveredCentralMomentHighlight,
      recoveredHighlightCandidatesCount: highlight.recoveredHighlightCandidatesCount,
      centralMomentRecoveryReason: highlight.centralMomentRecoveryReason,
    },
    highlightDiagnosticsStatus,
  }
}

async function main(): Promise<void> {
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
  const failedStarter = await buildCurateFailedStarterDiagnostics(
    findStarterPack('dessert-conversation'),
  )

  const observed = {
    route: generated.selectedArc.stops.map((stop) => ({
      role: stop.role,
      venueId: stop.scoredVenue.candidateIdentity.baseVenueId,
    })),
    rolePoolDiagnostics: summarizeRolePoolDiagnostics(generated.trace.rolePoolDiagnostics),
    compactnessDiagnostics: summarizeCompactnessDiagnostics(generated.trace),
    fallbackTrace: summarizeFallbackTrace(generated.trace),
    failedStarter: summarizeFailedStarterRoleStatus(failedStarter),
    tightSupportEmittedTrace: buildTightSupportEmittedFixture(),
    recoveredCentralMomentEmittedTrace: buildRecoveredCentralMomentEmittedFixture(),
  }

  const expected = {
    route: [
      { role: 'warmup', venueId: 'sj-voyager-coffee' },
      { role: 'peak', venueId: 'sj-adega-wine-atelier' },
      { role: 'wildcard', venueId: 'moment::sofa-jazz-alley-set' },
      { role: 'cooldown', venueId: 'sj-orchard-artisan-gelato' },
    ],
    rolePoolDiagnostics: {
      roles: ['start', 'highlight', 'surprise', 'windDown'],
      start: {
        rolePoolSize: 14,
        strongCandidateCount: 10,
        categoryDiversityCount: 3,
        topConfidenceBand: 'strong',
        weakPool: false,
        selectedVenueId: 'sj-voyager-coffee',
        selectedScore: 91.5,
        runnerUpVenueId: 'sj-sketchbook-supper-club',
        runnerUpScore: 92.7,
        fallbackUsed: false,
        fallbackLabel: 'Strong fit',
        roleContractLabel: 'Resolved romantic start contract',
        roleContractStrength: 'strong',
        contractStrictCandidateCount: 19,
        contractRelaxedCandidateCount: 19,
        contractSatisfied: true,
        contractRelaxed: false,
        bestContractCandidateId: 'sj-little-portugal-pastry-bar',
        selectedContractOverrideApplied: false,
        selectedContractSatisfied: true,
        selectedViolatesContract: false,
      },
      highlight: {
        rolePoolSize: 9,
        strongCandidateCount: 1,
        categoryDiversityCount: 3,
        topConfidenceBand: 'medium',
        weakPool: true,
        weakPoolReason: 'Few strong candidates for this role.',
        selectedVenueId: 'sj-adega-wine-atelier',
        selectedScore: 100,
        runnerUpVenueId: 'sj-petiscos',
        runnerUpScore: 100,
        fallbackUsed: false,
        fallbackLabel: 'Strong fit',
        roleContractLabel: 'Resolved romantic highlight contract',
        roleContractStrength: 'strong',
        contractStrictCandidateCount: 31,
        contractRelaxedCandidateCount: 8,
        contractSatisfied: true,
        contractRelaxed: false,
        bestContractCandidateId: 'sj-petiscos',
        preferredDiscoveryVenueId: 'sj-adega-wine-atelier',
        preferredDiscoveryVenueAdmitted: true,
        preferredCandidateSurvivedToArc: true,
        preferredCandidateDroppedPreAssembly: false,
        selectedContractOverrideApplied: true,
        selectedContractOverrideRole: 'highlight',
        selectedContractSatisfied: true,
        selectedViolatesContract: false,
        highlightValidCandidateCount: 47,
        highlightFallbackCandidateCount: 5,
        highlightInvalidCandidateCount: 9,
        fallbackUsedBecauseNoValidHighlight: false,
        bestValidHighlightCandidateId: 'sj-petiscos',
        bestValidHighlightChallengerId: 'sj-lunas-mexican-kitchen',
        selectedHighlightValidityLevel: 'valid',
        selectedHighlightValidForIntent: true,
        selectedHighlightIsFallback: false,
        selectedHighlightViolatesIntent: false,
        packLiteralRequirementSatisfied: true,
      },
      windDown: {
        rolePoolSize: 16,
        strongCandidateCount: 13,
        categoryDiversityCount: 3,
        topConfidenceBand: 'strong',
        weakPool: false,
        selectedVenueId: 'sj-orchard-artisan-gelato',
        selectedScore: 92.3,
        runnerUpVenueId: 'sj-willow-glen-bakehouse',
        runnerUpScore: 92.5,
        fallbackUsed: false,
        fallbackLabel: 'Strong fit',
        roleContractLabel: 'Resolved romantic wind-down contract',
        roleContractStrength: 'strong',
        contractStrictCandidateCount: 19,
        contractRelaxedCandidateCount: 19,
        contractSatisfied: true,
        contractRelaxed: false,
        bestContractCandidateId: 'sj-little-portugal-pastry-bar',
        selectedContractOverrideApplied: false,
        selectedContractSatisfied: true,
        selectedViolatesContract: false,
      },
    },
    failedStarter: {
      starterId: 'dessert-conversation',
      startCount: 14,
      highlightCount: 14,
      windDownCount: 16,
      highlightStatus: {
        role: 'peak',
        contractLabel: 'Dessert & Conversation highlight contract',
        contractStrength: 'hard',
        contractSatisfied: true,
        contractRelaxed: false,
        fallbackReason: 'Dessert & Conversation highlight contract retained starter-scoped soft highlights.',
        strictCandidateCount: 34,
        relaxedCandidateCount: 34,
        bestContractCandidateId: 'live_google_ChIJW5Ondc_Lj4ARJAwUecl7o3s',
        validCandidateCount: 34,
        fallbackCandidateCount: 19,
        invalidCandidateCount: 7,
        fallbackUsedBecauseNoValidHighlight: false,
        bestValidHighlightCandidateId: 'live_google_ChIJW5Ondc_Lj4ARJAwUecl7o3s',
        bestValidHighlightChallengerId: 'live_google_ChIJ-bROCHLLj4AR7F3uIwQLL3w',
        recoveredCentralMomentHighlight: false,
        recoveredHighlightCandidatesCount: 0,
      },
      highlightDiagnosticsStatus: {
        role: 'peak',
        contractLabel: 'Dessert & Conversation highlight contract',
        contractStrength: 'hard',
        strictCandidateCount: 34,
        relaxedCandidateCount: 34,
        bestContractCandidateId: 'live_google_ChIJW5Ondc_Lj4ARJAwUecl7o3s',
        validCandidateCount: 34,
        fallbackCandidateCount: 19,
        invalidCandidateCount: 7,
        fallbackUsedBecauseNoValidHighlight: false,
        bestValidHighlightCandidateId: 'live_google_ChIJW5Ondc_Lj4ARJAwUecl7o3s',
        bestValidHighlightChallengerId: 'live_google_ChIJ-bROCHLLj4AR7F3uIwQLL3w',
        recoveredCentralMomentHighlight: false,
        recoveredHighlightCandidatesCount: 0,
        tightSupportAdmissionActive: false,
        tightSupportAdmissionReason: 'not_tight_build_support_context',
      },
    },
    tightSupportEmittedTrace: {
      warmup: {
        role: 'warmup',
        tightSupportAdmissionActive: true,
        tightSupportAdmissionReason: 'tight_build_same_neighborhood_support_available',
        requiredAnchorBaseVenueId: 'diagnostics-anchor',
        requiredAnchorNeighborhood: 'anchor-neighborhood',
        nearAnchorSupportCandidateCountBeforeAdmission: 1,
        nearAnchorSupportCandidateCountAfterAdmission: 1,
        nearAnchorSupportCandidateIds: ['near-start'],
        supportSupplyMissing: false,
      },
      cooldown: {
        role: 'cooldown',
        tightSupportAdmissionActive: true,
        tightSupportAdmissionReason: 'tight_build_same_neighborhood_support_available',
        requiredAnchorBaseVenueId: 'diagnostics-anchor',
        requiredAnchorNeighborhood: 'anchor-neighborhood',
        nearAnchorSupportCandidateCountBeforeAdmission: 1,
        nearAnchorSupportCandidateCountAfterAdmission: 1,
        nearAnchorSupportCandidateIds: ['near-wind'],
        supportSupplyMissing: false,
      },
    },
    recoveredCentralMomentEmittedTrace: {
      peak: {
        role: 'peak',
        contractRelaxed: true,
        fallbackReason: 'Diagnostics highlight contract relaxed: no contract-true local candidates.',
        relaxedCandidateCount: 1,
        recoveredCentralMomentHighlight: true,
        recoveredHighlightCandidatesCount: 1,
        centralMomentRecoveryReason: 'central_moment_recovery',
        selectedCandidateRecovered: true,
      },
      selectedPeak: {
        candidateId: 'recovered-central-moment',
        recoveredCentralMomentHighlight: true,
        centralMomentRecoveryReason: 'central_moment_recovery',
      },
    },
  }

  assertDeepEqual(observed, expected, 'Role-pool diagnostics parity snapshot')
  assert(
    observed.tightSupportEmittedTrace.warmup.tightSupportAdmissionActive === true &&
      observed.tightSupportEmittedTrace.cooldown.tightSupportAdmissionActive === true,
    'Tight-support emitted diagnostics must be present in the observer fixture.',
  )
  assert(
    observed.recoveredCentralMomentEmittedTrace.peak.recoveredCentralMomentHighlight === true &&
      observed.recoveredCentralMomentEmittedTrace.selectedPeak?.recoveredCentralMomentHighlight === true,
    'Recovered-central-moment emitted diagnostics must be present in the observer fixture.',
  )
  assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)

  process.stdout.write(
    `${JSON.stringify(
      {
        observer: 'role_pool_diagnostics_parity',
        status: 'PASS',
        diagnosticsFieldsCovered: {
          strictRelaxedCounts: true,
          bestCandidateIds: true,
          highlightValidityDiagnostics: true,
          selectedHighlightValidity: true,
          failedStarterDiagnostics: true,
          diagnosticsBucketProjection: true,
          tightSupportDiagnostics: true,
          recoveredCentralMomentTrace: true,
          generationTraceRolePoolDiagnosticsShape: true,
        },
        caveats: {
          representativeGeneratedRoute:
            observed.compactnessDiagnostics === undefined && observed.fallbackTrace === undefined
              ? 'held diagnostics are covered by targeted emitted fixtures; representative route still does not emit them'
              : 'representative route emitted at least one held diagnostic',
        },
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
