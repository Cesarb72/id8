import assert from 'node:assert/strict'

import { buildRolePools, type RolePools } from '../src/domain/arc/buildRolePools.ts'
import {
  getScoredVenueBaseVenueId,
  getScoredVenueCandidateId,
} from '../src/domain/candidates/candidateIdentity.ts'
import { compareStrongestCandidatesByRole } from '../src/domain/debug/compareStrongestCandidatesByRole.ts'
import { buildLiveAttritionTrace } from '../src/domain/debug/buildLiveAttritionTrace.ts'
import { buildExperienceLens } from '../src/domain/intent/buildExperienceLens.ts'
import { getCrewPolicy } from '../src/domain/intent/getCrewPolicy.ts'
import { buildCandidateAdmissibilityDiagnostic } from '../src/domain/bearings/buildCandidateAdmissibilityDiagnostics.ts'
import { buildFieldLiveCandidateSurvivalDiagnostics } from '../src/domain/retrieval/retrieveVenues.ts'
import type { RetrieveVenuesResult } from '../src/domain/retrieval/retrieveVenues.ts'
import type { ArcCandidate, ArcStop, ScoredVenue } from '../src/domain/types/arc.ts'
import type { CrewPolicy } from '../src/domain/types/crewPolicies.ts'
import type { ExperienceLens } from '../src/domain/types/experienceLens.ts'
import type { HighlightValidityEvaluation } from '../src/domain/types/highlightValidity.ts'
import type { IntentProfile } from '../src/domain/types/intent.ts'
import type { UserStopRole } from '../src/domain/types/itinerary.ts'
import type {
  BearingsCandidateAdmissibilityDiagnostic,
  FieldToBearingsProvisionalHandoffDiagnostic,
  LiveCompetitionStage,
  LiveQueryCandidateDispositionDiagnostics,
  RoleCompetitionDiagnostics,
} from '../src/domain/types/diagnostics.ts'
import type { InternalRole, Venue, VenueCategory } from '../src/domain/types/venue.ts'
import {
  AUTHORITATIVE_STAGE0_EVIDENCE_ROW_COUNT,
  AUTHORITATIVE_STAGE0_EVIDENCE_SHA256,
  validateIdentityEvidenceCorpusFile,
} from './identityEvidenceCorpusGuard.ts'

const CORPUS_PATH =
  'src/domain/field/corpus/evidence/provider-corpus-real-1781057364783/provider-corpus-snapshot.provider.json'

const originalFetch = globalThis.fetch
let providerCallsAttempted = 0
globalThis.fetch = (async (input) => {
  providerCallsAttempted += 1
  throw new Error(`A4-3 support-role characterization must not call fetch: ${String(input)}`)
}) as typeof fetch

type Availability = 'observed' | 'not_yet_evaluated' | 'not_applicable' | 'not_retained'
type RetentionStrategy =
  | 'retained'
  | 'referenced'
  | 'composed'
  | 'derived'
  | 'legitimately_unavailable'
  | 'unexpectedly_missing'
type CaseStatus = 'PASS' | 'PARTIAL' | 'FAIL' | 'NOT COVERED' | 'NOT APPLICABLE'
type AdequacyStatus = 'PASS' | 'FAIL' | 'NOT COVERED' | 'NOT APPLICABLE'

interface SupportCandidateEvidenceRow {
  runId: string
  role: UserStopRole
  sourceObservationIdentity: string | 'not_retained' | 'not_applicable'
  physicalBaseVenueId: string | 'not_retained' | 'not_applicable'
  candidateId: string | 'not_retained' | 'not_applicable'
  provenance: string | 'not_retained' | 'not_applicable'
  candidateEntryLayer: string
  gateCarrier: string
  producingLayer: string
  evidenceAvailability: Availability
  disposition: string
  stableReasonCode: string | 'not_retained' | 'not_applicable'
  downstreamConsequence: string
  reachesNextGate: boolean
  contributesToAggregate: boolean
  participatesInFallbackOrMasking: boolean
  retentionStrategy: RetentionStrategy
}

interface CharacterizationResult {
  corpus: {
    rowCount: number
    canonicalSha256: string
  }
  providerCallsAttempted: number
  productionBuildersInvoked: string[]
  candidateRows: SupportCandidateEvidenceRow[]
  aggregateChecks: Array<{
    name: string
    recomputed: number | string
    reported: number | string
    parity: boolean | 'unrecomputable'
    reason?: string
  }>
  caseResults: Record<string, CaseStatus>
  adequacy: Record<string, AdequacyStatus>
  gaps: Array<{
    missingEvidence: string
    firstCarrier: string
    rightfulOwner: string
    proofCompositionCanSolve: boolean
    runtimeEnrichmentRequired: boolean
    sharedContractWorkRequired: boolean
    approvalBoundary: string
  }>
  firstMissingCarrierDecision: string
}

const roleOrder: InternalRole[] = ['warmup', 'peak', 'wildcard', 'cooldown']

function roleRecord(defaultValue: number, override?: Partial<Record<InternalRole, number>>): Record<InternalRole, number> {
  return {
    warmup: override?.warmup ?? defaultValue,
    peak: override?.peak ?? defaultValue,
    wildcard: override?.wildcard ?? defaultValue,
    cooldown: override?.cooldown ?? defaultValue,
  }
}

function lensRoleRecord(defaultValue: number): Record<'start' | 'highlight' | 'surprise' | 'windDown', number> {
  return {
    start: defaultValue,
    highlight: defaultValue,
    surprise: defaultValue,
    windDown: defaultValue,
  }
}

function intent(): IntentProfile {
  return {
    mode: 'build',
    planningMode: 'system-led',
    persona: 'socialite',
    primaryAnchor: 'lively',
    primaryVibe: 'lively',
    city: 'San Jose',
    neighborhood: 'Downtown',
    district: 'Downtown',
    distanceMode: 'nearby',
    budget: '$$',
    discoveryPreferences: [],
  } as unknown as IntentProfile
}

const proofIntent = intent()
const crewPolicy = getCrewPolicy('socialite') as unknown as CrewPolicy
const lens = buildExperienceLens({ intent: proofIntent }) as unknown as ExperienceLens

function roleInfluence(): ScoredVenue['taste']['rolePoolInfluence'] {
  return Object.fromEntries(
    roleOrder.map((role) => [
      role,
      {
        tasteBonus: 0.04,
        roleSuitabilityContribution: 0.03,
        momentContribution: role === 'peak' ? 0.05 : 0.01,
        highlightPlausibilityBonus: role === 'peak' ? 0.05 : 0,
        modeAlignmentContribution: 0.03,
        modeAlignmentPenalty: 0,
      },
    ]),
  ) as ScoredVenue['taste']['rolePoolInfluence']
}

function roleContracts(): ScoredVenue['roleContract'] {
  return Object.fromEntries(
    roleOrder.map((role) => [
      role,
      {
        contractLabel: `${role} proof contract`,
        strength: 'none',
        score: 0.82,
        satisfied: true,
        matchedSignals: [],
        violations: [],
      },
    ]),
  ) as unknown as ScoredVenue['roleContract']
}

function venue(params: {
  id: string
  name: string
  sourceOrigin?: 'live' | 'curated'
  category?: VenueCategory
  providerRecordId?: string
  energyLevel?: number
  qualityGateStatus?: 'approved' | 'demoted' | 'suppressed'
  sourceConfidence?: number
  completenessScore?: number
  qualityScore?: number
  signatureScore?: number
  genericScore?: number
  likelyOpenForCurrentWindow?: boolean
  timeConfidence?: number
}): Venue {
  return {
    id: params.id,
    name: params.name,
    city: 'San Jose',
    neighborhood: 'Downtown',
    driveMinutes: 8,
    category: params.category ?? 'bar',
    subcategory: 'proof-fixture',
    priceTier: '$$',
    tags: ['social', 'local', 'conversation'],
    useCases: ['socialite'],
    vibeTags: ['cozy', 'lively'],
    energyLevel: params.energyLevel ?? 3,
    socialDensity: 0.64,
    uniquenessScore: 0.58,
    distinctivenessScore: 0.62,
    underexposureScore: 0.44,
    shareabilityScore: 0.58,
    isChain: false,
    localSignals: {
      localFavoriteScore: 0.62,
      neighborhoodPrideScore: 0.6,
      repeatVisitorScore: 0.55,
    },
    roleAffinity: roleRecord(0.74),
    imageUrl: '',
    shortDescription: `${params.name} A4-3 fixture.`,
    narrativeFlavor: `${params.name} A4-3 characterization fixture.`,
    isHiddenGem: false,
    isActive: true,
    highlightCapable: true,
    durationProfile: {
      durationClass: 'M',
      estimatedMinutes: 45,
    },
    settings: {
      socialDensity: 0.64,
      highlightCapabilityTier: 'highlight-capable',
      highlightConfidence: 0.7,
      supportOnly: false,
      connectiveOnly: false,
      setting: 'indoor',
      familyFriendly: false,
      adultSocial: true,
      dateFriendly: true,
      eventCapable: false,
      musicCapable: false,
      performanceCapable: false,
      routeFootprint: 'compact',
    },
    signature: {
      chainLike: false,
      signatureScore: params.signatureScore ?? 0.62,
      genericScore: params.genericScore ?? 0.34,
    },
    source: {
      normalizedFromRawType: params.sourceOrigin === 'live' ? 'raw-place' : 'seed',
      sourceOrigin: params.sourceOrigin ?? 'curated',
      provider: params.sourceOrigin === 'live' ? 'google-places' : undefined,
      providerRecordId: params.providerRecordId,
      formattedAddress: '100 Test Way, San Jose, CA',
      latitude: 37.332,
      longitude: -121.889,
      sourceQueryLabel: params.sourceOrigin === 'live' ? 'a4-3-support-proof' : undefined,
      rating: params.sourceOrigin === 'live' ? 4.5 : undefined,
      reviewCount: params.sourceOrigin === 'live' ? 120 : undefined,
      sourceConfidence: params.sourceConfidence ?? 0.78,
      completenessScore: params.completenessScore ?? 0.72,
      qualityScore: params.qualityScore ?? 0.76,
      openNow: params.likelyOpenForCurrentWindow ?? true,
      hoursKnown: true,
      likelyOpenForCurrentWindow: params.likelyOpenForCurrentWindow ?? true,
      businessStatus: 'operational',
      timeConfidence: params.timeConfidence ?? 0.82,
      hoursPressureLevel: 'likely-open',
      hoursPressureNotes: [],
      hoursDemotionApplied: false,
      hoursSuppressionApplied: params.qualityGateStatus === 'suppressed',
      sourceTypes: [params.category ?? 'bar'],
      missingFields: [],
      inferredFields: [],
      qualityGateStatus: params.qualityGateStatus ?? 'approved',
      qualityGateNotes: [],
      approvalBlockers: [],
      demotionReasons: params.qualityGateStatus === 'demoted' ? ['proof_demotion'] : [],
      suppressionReasons: params.qualityGateStatus === 'suppressed' ? ['proof_suppression'] : [],
    },
  }
}

function scoredCandidate(params: {
  rawVenueId: string
  candidateId: string
  baseVenueId: string
  name: string
  sourceOrigin?: 'live' | 'curated'
  providerRecordId?: string
  roleScores?: Partial<Record<InternalRole, number>>
  lensCompatibility?: number
  stopShapeFit?: Partial<Record<'start' | 'highlight' | 'surprise' | 'windDown', number>>
  highlightValidity?: HighlightValidityEvaluation['validityLevel']
  sourceConfidence?: number
  completenessScore?: number
  qualityScore?: number
  signatureScore?: number
  genericScore?: number
  qualityGateStatus?: 'approved' | 'demoted' | 'suppressed'
}): ScoredVenue {
  const roleScores = roleRecord(0.76, params.roleScores)
  const stopShapeFit = {
    ...lensRoleRecord(0.76),
    ...params.stopShapeFit,
  }
  const lensCompatibility = params.lensCompatibility ?? 0.76
  return {
    candidateIdentity: {
      candidateId: params.candidateId,
      baseVenueId: params.baseVenueId,
      kind: 'base',
      traceLabel: params.name,
    },
    venue: venue({
      id: params.rawVenueId,
      name: params.name,
      sourceOrigin: params.sourceOrigin ?? 'curated',
      providerRecordId: params.providerRecordId,
      sourceConfidence: params.sourceConfidence,
      completenessScore: params.completenessScore,
      qualityScore: params.qualityScore,
      signatureScore: params.signatureScore,
      genericScore: params.genericScore,
      qualityGateStatus: params.qualityGateStatus,
    }),
    momentIdentity: {
      type: 'none',
      strength: 'none',
    },
    fitBreakdown: {
      anchorFit: 0.74,
      crewFit: 0.74,
      proximityFit: 0.74,
      budgetFit: 0.74,
      uniquenessFit: 0.74,
      hiddenGemFit: 0.45,
    },
    fitScore: 0.78,
    hiddenGemScore: 0.42,
    lensCompatibility,
    contextSpecificity: {
      overall: 0.7,
      personaSignal: 0.7,
      vibeSignal: 0.7,
      lensSignal: 0.7,
      byRole: roleRecord(0.72),
    },
    dominanceControl: {
      universalityScore: 0.2,
      flaggedUniversal: false,
      byRole: roleRecord(0.08),
    },
    roleContract: roleContracts(),
    stopShapeFit,
    vibeAuthority: {
      primary: 0.7,
      secondary: 0.62,
      overall: 0.68,
      packPressure: { highlight: 0.5 },
      byRole: lensRoleRecord(0.7),
      pressureSource: { highlight: 'candidate' },
      musicSupportSource: 'none',
      adventureRead: 'none',
      adventureReadScores: { outdoor: 0, urban: 0 },
      adventureNotes: [],
    },
    highlightValidity: {
      validForIntent: params.highlightValidity !== 'invalid',
      validityLevel: params.highlightValidity ?? 'valid',
      fallbackEligible: params.highlightValidity === 'fallback',
      packLiteralRequirementSatisfied: params.highlightValidity !== 'invalid',
      candidateTier: params.highlightValidity === 'invalid' ? 'connective-only' : 'highlight-capable',
      matchedSignals: [],
      personaVetoes: [],
      contextVetoes: [],
      violations: [],
    } as HighlightValidityEvaluation,
    roleScores,
    taste: {
      signals: {
        energy: 0.6,
        socialDensity: 0.64,
        intimacy: 0.58,
        lingerFactor: 0.62,
        destinationFactor: 0.64,
        experientialFactor: 0.66,
        conversationFriendliness: 0.72,
        outdoorStrength: 0.1,
        interactiveStrength: 0.6,
        durationEstimate: 'medium',
        highlightTier: 2,
        venuePersonality: { tags: ['social', 'lingering'] },
        roleSuitability: {
          start: roleScores.warmup,
          highlight: roleScores.peak,
          surprise: roleScores.wildcard,
          windDown: roleScores.cooldown,
        },
        momentIntensity: {
          score: 0.58,
          tier: 'standard',
          drivers: [],
        },
        momentPotential: {
          score: 0.62,
          source: 'inferred',
          tier: 'standard',
          drivers: [],
        },
        momentIdentity: {
          type: 'linger',
          strength: 'medium',
        },
        momentTier: 'support',
        momentEnrichment: {
          temporalEnergy: 0.2,
          socialEnergy: 0.3,
          ambientUniqueness: 0.25,
          culturalDepth: 0.2,
          highlightSurfaceBoost: 0.2,
          signals: [],
        },
        hyperlocalActivation: {
          activationTypes: [],
          temporalRelevance: 0,
          temporalLabel: 'background',
          recurrenceShape: 'ambient',
          intensityContribution: 0,
          contractCompatibilityHints: [],
          interpretationImpact: {
            highlightSuitability: 0,
            momentPotential: 0,
            novelty: 0,
            momentIntensity: 0,
            familyRefinements: [],
          },
          temporalCompatibility: {
            timePresenceState: 'none',
            roleAdjustments: {
              warmup: 0,
              peak: 0,
              wildcard: 0,
              cooldown: 0,
            },
            materiallyChangesViability: false,
            signals: [],
          },
          signals: [],
          materiallyChangesHighlightPotential: false,
          materiallyChangesInterpretation: false,
        },
        anchorStrength: 0.66,
        primaryExperienceArchetype: 'social',
        baseExperienceFamily: 'social',
        experienceFamily: 'social',
        experienceFamilyExpanded: false,
        momentElevationPotential: 0,
        isElevatedMomentCandidate: false,
        experienceArchetypes: ['social'],
        romanticSignals: {
          ambiance: 0.2,
          ambientExperience: 0.2,
          scenic: 0.1,
          intimacy: 0.2,
          linger: 0.2,
          destination: 0.2,
          experiential: 0.2,
          quietConversation: 0.2,
          sharedActivity: 0.2,
        },
        romanticScore: 0.2,
        romanticFlavor: 'none',
        isRomanticMomentCandidate: false,
        noveltyWeight: 0.32,
        categorySpecificity: 0.58,
        personalityStrength: 0.62,
        debug: {
          sourceMode: 'rule_inferred',
          supportingSignals: [],
          confidence: 0.7,
          seedCalibratedApplied: false,
          interpretationStrategy: 'rule_inferred',
        },
      },
      modeAlignment: {
        score: 0.7,
        penalty: 0,
        lane: 'social',
        tier: 'good',
        supportiveTagScore: 0.7,
        lanePriorityScore: 0.7,
      },
      fallbackPenalty: {
        signalScore: 0,
        appliedPenalty: 0,
        applied: false,
        strongerAlternativePresent: false,
        reason: 'fixture',
      },
      rolePoolInfluence: roleInfluence(),
    },
  } as unknown as ScoredVenue
}

function contractPoolStatus(): RolePools['contractPoolStatus'] {
  return Object.fromEntries(
    roleOrder.map((role) => [
      role,
      {
        role,
        contractLabel: `${role} proof contract`,
        contractStrength: 'none',
        contractSatisfied: true,
        contractRelaxed: false,
        strictCandidateCount: 0,
        relaxedCandidateCount: 0,
        standardCandidatesCount: 0,
        preferredCandidatesCount: 0,
        recoveredHighlightCandidatesCount: 0,
        recoveredCentralMomentHighlight: false,
      },
    ]),
  ) as unknown as RolePools['contractPoolStatus']
}

function rolePools(params: Partial<Record<InternalRole, ScoredVenue[]>>): RolePools {
  return {
    warmup: params.warmup ?? [],
    peak: params.peak ?? [],
    wildcard: params.wildcard ?? [],
    cooldown: params.cooldown ?? [],
    contractPoolStatus: contractPoolStatus(),
  }
}

function arc(id: string, stops: ArcStop[], totalScore = 0.72): ArcCandidate {
  return {
    id,
    stops,
    totalScore,
    scoreBreakdown: {
      roleFlowScore: totalScore,
      geographyScore: totalScore,
      highlightValidityScore: totalScore,
      highlightVibeScore: totalScore,
      supportStopVibeScore: totalScore,
      transitionSmoothnessScore: totalScore,
      awkwardPacingPenalty: 0,
    },
    pacing: {},
    spatial: {},
    hasWildcard: stops.some((stop) => stop.role === 'wildcard'),
  } as ArcCandidate
}

function comparisonInput(params: {
  scoredVenues: ScoredVenue[]
  rolePools: RolePools
  selectedArc: ArcCandidate
  arcCandidates?: ArcCandidate[]
}) {
  return compareStrongestCandidatesByRole({
    scoredVenues: params.scoredVenues,
    rolePools: params.rolePools,
    selectedArc: params.selectedArc,
    arcCandidates: params.arcCandidates ?? [],
    lens,
  })
}

function retrieveResult(params: {
  fetchedCount: number
  mappedCount?: number
  normalizedCount?: number
  approvedCount?: number
  demotedCount?: number
  suppressedCount?: number
  dedupedLiveCount?: number
  liveDedupedAgainstCuratedCount?: number
  liveNoveltyCollapsedCount?: number
  finalLive: number
  finalCurated: number
}): RetrieveVenuesResult {
  return {
    venues: [],
    totalVenueCount: params.finalLive + params.finalCurated,
    lensCompatibleCount: params.finalLive + params.finalCurated,
    excludedByQualityGate: [],
    fallbackRelaxationApplied: 'none',
    sourceMode: {
      requestedMode: 'hybrid',
      effectiveMode: 'hybrid',
      debugOverrideApplied: false,
      fallbackToCurated: false,
      liveFetchAttempted: false,
      liveFetchSucceeded: true,
      queryCount: 0,
      labelsConsidered: 0,
      labelsAdmitted: 0,
      centersConsidered: 0,
      centersAdmitted: 0,
      dispatchQueriesPlanned: 0,
      dispatchQueriesAttempted: 0,
      dispatchQueriesPlannedWithinCap: true,
      liveQueryTemplatesUsed: [],
      liveQueryLabelsUsed: [],
      liveCandidatesByQuery: [],
      liveRoleIntentQueryNotes: [],
      fetchedCount: params.fetchedCount,
      rawFetchedCount: params.fetchedCount,
      mappedCount: params.mappedCount ?? params.fetchedCount,
      mappedDroppedCount: 0,
      mappedDropReasons: {},
      normalizedCount: params.normalizedCount ?? params.fetchedCount,
      dedupedByPlaceIdCount: 0,
      normalizationDroppedCount: 0,
      normalizationDropReasons: {},
      acceptedCount: params.approvedCount ?? params.fetchedCount,
      acceptanceDroppedCount: 0,
      acceptanceDropReasons: {},
      approvedCount: params.approvedCount ?? params.fetchedCount,
      demotedCount: params.demotedCount ?? 0,
      suppressedCount: params.suppressedCount ?? 0,
      liveHoursDemotedCount: 0,
      liveHoursSuppressedCount: 0,
      partialFailure: false,
      errors: [],
      countsBySource: {
        curated: params.finalCurated,
        live: params.finalLive,
      },
      dedupedCount: params.dedupedLiveCount ?? 0,
      dedupedLiveCount: params.dedupedLiveCount ?? 0,
      liveDedupedAgainstCuratedCount: params.liveDedupedAgainstCuratedCount ?? 0,
      liveNoveltyCollapsedCount: params.liveNoveltyCollapsedCount ?? 0,
      dedupeLosses: [],
      liveTrustBreakdown: {
        topApprovedBlockers: [],
        topSuppressionReasons: [],
        topDedupeReasons: [],
        strongestApprovalFailures: [],
        strongestSuppressedCandidates: [],
        strongestDedupedCandidates: [],
      },
      devGreatStopFixturesEnvRaw: '',
      devGreatStopFixturesEnabled: false,
      devGreatStopFixtureCount: 0,
      devGreatStopFixtureVenueIds: [],
    },
    stageCounts: {
      totalSeed: params.finalCurated,
      active: params.finalCurated,
      qualityApproved: params.finalCurated,
      qualityDemoted: 0,
      qualitySuppressed: 0,
      curatedSeed: params.finalCurated,
      liveFetched: params.fetchedCount,
      liveMapped: params.mappedCount ?? params.fetchedCount,
      liveNormalized: params.normalizedCount ?? params.fetchedCount,
      liveApproved: params.approvedCount ?? params.fetchedCount,
      liveDemoted: params.demotedCount ?? 0,
      liveSuppressed: params.suppressedCount ?? 0,
      liveHoursDemoted: 0,
      liveHoursSuppressed: 0,
      cityMatch: params.finalLive + params.finalCurated,
      geographyMatch: params.finalLive + params.finalCurated,
      lensStrict: params.finalLive + params.finalCurated,
      lensSoft: 0,
      finalRetrieved: params.finalLive + params.finalCurated,
      neighborhoodPreferred: params.finalLive + params.finalCurated,
      dedupedMerged: params.dedupedLiveCount ?? 0,
      dedupedLive: params.dedupedLiveCount ?? 0,
      finalCurated: params.finalCurated,
      finalLive: params.finalLive,
    },
  } as RetrieveVenuesResult
}

function queryCandidate(candidate: ScoredVenue): LiveQueryCandidateDispositionDiagnostics {
  return {
    name: candidate.venue.name,
    venueId: candidate.venue.id,
    providerPlaceId: candidate.venue.source.providerRecordId,
    fieldCandidateClass: 'canonical_live_candidate',
    proofEligible: true,
    diagnosticOnly: false,
    sourceStage: 'pocket_filter',
    sourceOrigin: 'live',
    sourceMode: 'hybrid',
    sourceTypes: ['bar'],
    providerResultSummary: true,
    normalizedResult: true,
    candidateBoardAdmission: true,
    pocketFilter: 'admitted',
    filterVerdict: 'kept',
    hasLocationEvidence: true,
    hasFormattedAddressEvidence: true,
    hasProviderIdEvidence: true,
  }
}

function rejectedQueryCandidate(): LiveQueryCandidateDispositionDiagnostics {
  return {
    name: 'Field Rejected Support',
    venueId: 'live-field-rejected',
    providerPlaceId: 'places/live-field-rejected',
    fieldCandidateClass: 'provisional_live_candidate',
    proofEligible: false,
    diagnosticOnly: true,
    sourceStage: 'pocket_filter',
    sourceOrigin: 'live',
    sourceMode: 'hybrid',
    sourceTypes: ['bar'],
    providerResultSummary: true,
    normalizedResult: true,
    candidateBoardAdmission: false,
    pocketFilter: 'outside_pocket_envelope',
    filterVerdict: 'rejected_outside_selected_envelope',
    hasLocationEvidence: true,
    hasFormattedAddressEvidence: true,
    hasProviderIdEvidence: true,
  }
}

function provisionalHandoff(params: {
  hasLocation: boolean
  pocketVerdict: FieldToBearingsProvisionalHandoffDiagnostic['pocketVerdict']
}): FieldToBearingsProvisionalHandoffDiagnostic {
  return {
    candidateClass: 'provisional_live_candidate',
    proofEligible: false,
    diagnosticOnly: true,
    sourceEvidenceStatus: params.hasLocation ? 'source_evidence_available' : 'source_evidence_incomplete',
    hasProviderPlaceId: true,
    hasFormattedAddress: true,
    hasLocation: params.hasLocation,
    hasCategoriesTypes: true,
    hasHoursOpenStatus: true,
    hasRating: true,
    hasUserRatingCount: true,
    selectedPocketEnvelope: 'Downtown proof pocket',
    activePocketId: 'downtown-proof',
    activePocketLabel: 'Downtown',
    distanceFromPocketCenterM: params.hasLocation ? 1900 : undefined,
    pocketRadiusThresholdM: 1200,
    distanceMargin: params.hasLocation
      ? { status: 'outside_by', meters: 700 }
      : { status: 'unknown' },
    pocketVerdict: params.pocketVerdict,
    primaryProvisionalReason: params.pocketVerdict,
    futureOwnerHint: 'bearings_spatial_admissibility_required',
    currentOwner: 'Field evidence / source diagnostics',
  }
}

function userRoleFromInternal(role: InternalRole): UserStopRole {
  if (role === 'warmup') return 'start'
  if (role === 'peak') return 'highlight'
  if (role === 'wildcard') return 'surprise'
  return 'windDown'
}

function rowFromScored(params: {
  runId: string
  role: InternalRole
  candidate: ScoredVenue
  gateCarrier: string
  producingLayer: string
  disposition: string
  reason: string
  reachesNextGate: boolean
  contributesToAggregate: boolean
  retentionStrategy?: RetentionStrategy
  masking?: boolean
}): SupportCandidateEvidenceRow {
  return {
    runId: params.runId,
    role: userRoleFromInternal(params.role),
    sourceObservationIdentity: 'not_retained',
    physicalBaseVenueId: getScoredVenueBaseVenueId(params.candidate),
    candidateId: getScoredVenueCandidateId(params.candidate),
    provenance: params.candidate.venue.source.providerRecordId ?? params.candidate.venue.source.sourceOrigin,
    candidateEntryLayer: 'scoredVenues',
    gateCarrier: params.gateCarrier,
    producingLayer: params.producingLayer,
    evidenceAvailability: 'observed',
    disposition: params.disposition,
    stableReasonCode: params.reason,
    downstreamConsequence: params.reachesNextGate ? 'candidate remains available' : 'candidate stops before next proven gate',
    reachesNextGate: params.reachesNextGate,
    contributesToAggregate: params.contributesToAggregate,
    participatesInFallbackOrMasking: params.masking ?? false,
    retentionStrategy: params.retentionStrategy ?? 'retained',
  }
}

function firstStopFromComparison(
  comparison: RoleCompetitionDiagnostics,
): LiveCompetitionStage | 'not_retained' {
  return comparison.strongestLiveLostAtStage ?? 'not_retained'
}

function assertNoProviderCalls(): void {
  assert.equal(providerCallsAttempted, 0, 'A4-3 proof must not attempt provider calls.')
}

function runCharacterization(): CharacterizationResult {
  const corpus = validateIdentityEvidenceCorpusFile(CORPUS_PATH, {
    expectedRowCount: AUTHORITATIVE_STAGE0_EVIDENCE_ROW_COUNT,
    expectedSha256: AUTHORITATIVE_STAGE0_EVIDENCE_SHA256,
    label: 'A4-3 authoritative provider evidence corpus',
  })

  const retainedLive = scoredCandidate({
    rawVenueId: 'live-support-retained-raw',
    candidateId: 'candidate:live-support-retained',
    baseVenueId: 'base-live-support-retained',
    name: 'Live Support Retained',
    sourceOrigin: 'live',
    providerRecordId: 'places/live-support-retained',
    roleScores: { warmup: 0.92, cooldown: 0.82 },
  })
  const secondLive = scoredCandidate({
    rawVenueId: 'live-support-second-raw',
    candidateId: 'candidate:live-support-second',
    baseVenueId: 'base-live-support-second',
    name: 'Live Support Second',
    sourceOrigin: 'live',
    providerRecordId: 'places/live-support-second',
    roleScores: { warmup: 0.84, cooldown: 0.76 },
  })
  const rolePoolLoss = scoredCandidate({
    rawVenueId: 'live-support-role-pool-loss-raw',
    candidateId: 'candidate:live-support-role-pool-loss',
    baseVenueId: 'base-live-support-role-pool-loss',
    name: 'Live Support Role Pool Loss',
    sourceOrigin: 'live',
    providerRecordId: 'places/live-support-role-pool-loss',
    roleScores: { warmup: 0.3, cooldown: 0.28 },
    lensCompatibility: 0.34,
  })
  const invalidHighlight = scoredCandidate({
    rawVenueId: 'live-support-highlight-invalid-raw',
    candidateId: 'candidate:live-support-highlight-invalid',
    baseVenueId: 'base-live-support-highlight-invalid',
    name: 'Live Support Highlight Invalid',
    sourceOrigin: 'live',
    providerRecordId: 'places/live-support-highlight-invalid',
    roleScores: { peak: 0.82 },
    highlightValidity: 'invalid',
  })
  const curatedWinner = scoredCandidate({
    rawVenueId: 'curated-support-winner',
    candidateId: 'candidate:curated-support-winner',
    baseVenueId: 'curated-support-winner',
    name: 'Curated Support Winner',
    sourceOrigin: 'curated',
    roleScores: { warmup: 0.86, peak: 0.86, cooldown: 0.86 },
  })

  const productionBuiltPools = buildRolePools(
    [retainedLive, secondLive, curatedWinner],
    crewPolicy,
    lens,
    proofIntent,
  )
  assert(
    productionBuiltPools.warmup.some(
      (candidate) => getScoredVenueCandidateId(candidate) === getScoredVenueCandidateId(retainedLive),
    ),
    'Production role-pool builder must retain the primary live support fixture.',
  )
  assert(
    productionBuiltPools.warmup.some(
      (candidate) => getScoredVenueCandidateId(candidate) === getScoredVenueCandidateId(secondLive),
    ),
    'Production role-pool builder must retain the second live support fixture.',
  )

  const selectedCurated = arc('selected-curated', [{ role: 'warmup', scoredVenue: curatedWinner }])
  const retainedComparison = comparisonInput({
    scoredVenues: [retainedLive, secondLive, curatedWinner],
    rolePools: productionBuiltPools,
    selectedArc: selectedCurated,
    arcCandidates: [],
  })
  const retainedStart = retainedComparison.roleCompetitionByRole.start
  assert(retainedStart, 'Role competition must produce start comparison.')
  assert(retainedStart.strongestLive?.venueId === retainedLive.venue.id, 'Strongest live support must be retained.')
  assert.equal(retainedStart.liveEnteredRolePool, true)

  const zeroPools = rolePools({})
  const zeroComparison = comparisonInput({
    scoredVenues: [rolePoolLoss, curatedWinner],
    rolePools: zeroPools,
    selectedArc: selectedCurated,
    arcCandidates: [],
  })
  const zeroStart = zeroComparison.roleCompetitionByRole.start
  assert(zeroStart, 'Role competition must produce zero start comparison.')
  assert.equal(zeroStart.liveEnteredRolePool, false)
  assert.equal(firstStopFromComparison(zeroStart), 'role-pool')

  const highlightPools = rolePools({ peak: [curatedWinner] })
  const highlightComparison = comparisonInput({
    scoredVenues: [invalidHighlight, curatedWinner],
    rolePools: highlightPools,
    selectedArc: arc('selected-highlight-curated', [{ role: 'peak', scoredVenue: curatedWinner }]),
    arcCandidates: [],
  })
  const highlight = highlightComparison.roleCompetitionByRole.highlight
  assert(highlight, 'Role competition must produce highlight comparison.')
  assert.equal(firstStopFromComparison(highlight), 'highlight-validity')

  const fieldRejected = rejectedQueryCandidate()
  const bearings = buildCandidateAdmissibilityDiagnostic(
    provisionalHandoff({
      hasLocation: true,
      pocketVerdict: 'rejected_outside_selected_envelope',
    }),
  )
  assert(bearings, 'Bearings provisional admissibility diagnostic must be produced.')
  assert.equal(bearings.overallStatus, 'bearings_provisional_only')
  assert.equal(bearings.spatialAdmissibilityStatus, 'bearings_outside_selected_envelope')

  const suppressedVenue = venue({
    id: 'live-support-survival-suppressed',
    name: 'Live Support Survival Suppressed',
    sourceOrigin: 'live',
    providerRecordId: 'places/live-support-survival-suppressed',
    qualityGateStatus: 'suppressed',
  })
  const survival = buildFieldLiveCandidateSurvivalDiagnostics([suppressedVenue])[0]
  assert(survival, 'Field live survival diagnostic must be produced.')
  assert.equal(survival.status, 'blocked_suppressed')

  const attrition = buildLiveAttritionTrace({
    retrieval: retrieveResult({
      fetchedCount: 1,
      approvedCount: 1,
      finalLive: 1,
      finalCurated: 1,
    }),
    scoredVenues: [rolePoolLoss, curatedWinner],
    rolePools: zeroPools,
    arcCandidates: [],
    selectedArc: selectedCurated,
    roleCompetitionByRole: zeroComparison.roleCompetitionByRole,
  })
  assert.equal(attrition.liveEnteredRolePoolStart, 0)
  assert.equal(attrition.liveRejectedByRolePoolCount, 1)

  const candidateRows: SupportCandidateEvidenceRow[] = [
    rowFromScored({
      runId: 'a4-3-role-competition-retained',
      role: 'warmup',
      candidate: retainedLive,
      gateCarrier: 'RolePools.warmup -> RoleCompetitionDiagnostics.start.strongestLive',
      producingLayer: 'role-pool assembly / retrieval live competitiveness',
      disposition: 'retained_as_strongest_live_support',
      reason: retainedStart.strongestLiveLossReason ?? 'curated won final role comparison',
      reachesNextGate: true,
      contributesToAggregate: true,
    }),
    rowFromScored({
      runId: 'a4-3-role-competition-retained',
      role: 'warmup',
      candidate: secondLive,
      gateCarrier: 'RolePools.warmup',
      producingLayer: 'role-pool assembly',
      disposition: 'retained_in_role_pool_not_retained_by_role_competition_summary',
      reason: 'non_strongest_candidate_not_projected_into_role_competition',
      reachesNextGate: false,
      contributesToAggregate: true,
      retentionStrategy: 'referenced',
    }),
    rowFromScored({
      runId: 'a4-3-role-pool-zero',
      role: 'warmup',
      candidate: rolePoolLoss,
      gateCarrier: 'RoleCompetitionDiagnostics.start',
      producingLayer: 'role-pool assembly / retrieval live competitiveness',
      disposition: 'evaluated_rejected',
      reason: zeroStart.strongestLiveLossReason ?? 'role_pool_stop',
      reachesNextGate: false,
      contributesToAggregate: true,
    }),
    rowFromScored({
      runId: 'a4-3-highlight-validity',
      role: 'peak',
      candidate: invalidHighlight,
      gateCarrier: 'RoleCompetitionDiagnostics.highlight',
      producingLayer: 'role competition',
      disposition: 'evaluated_rejected',
      reason: highlight.strongestLiveLossReason ?? 'highlight_validity_stop',
      reachesNextGate: false,
      contributesToAggregate: true,
    }),
    {
      runId: 'a4-3-field-rejected-before-scoring',
      role: 'start',
      sourceObservationIdentity: fieldRejected.providerPlaceId ?? 'not_retained',
      physicalBaseVenueId: 'not_retained',
      candidateId: fieldRejected.venueId ?? 'not_retained',
      provenance: fieldRejected.providerPlaceId ?? 'not_retained',
      candidateEntryLayer: 'LiveQueryCandidateDispositionDiagnostics',
      gateCarrier: 'liveCandidatesByQuery.candidates',
      producingLayer: 'Field',
      evidenceAvailability: 'observed',
      disposition: fieldRejected.filterVerdict ?? 'not_retained',
      stableReasonCode: fieldRejected.filterVerdict ?? 'not_retained',
      downstreamConsequence: 'does not reach scoring or role competition',
      reachesNextGate: false,
      contributesToAggregate: false,
      participatesInFallbackOrMasking: false,
      retentionStrategy: 'retained',
    },
    {
      runId: 'a4-3-bearings-provisional',
      role: 'start',
      sourceObservationIdentity: 'composed_from_containing_live_query_row',
      physicalBaseVenueId: 'not_retained',
      candidateId: 'not_retained',
      provenance: 'composed_from_containing_live_query_row',
      candidateEntryLayer: 'FieldToBearingsProvisionalHandoffDiagnostic',
      gateCarrier: 'BearingsCandidateAdmissibilityDiagnostic',
      producingLayer: 'Bearings',
      evidenceAvailability: 'observed',
      disposition: bearings.overallStatus,
      stableReasonCode: bearings.blockReason ?? bearings.upgradeRequirement,
      downstreamConsequence: 'diagnostic-only provisional candidate does not reach route eligibility',
      reachesNextGate: false,
      contributesToAggregate: false,
      participatesInFallbackOrMasking: false,
      retentionStrategy: 'composed',
    },
    {
      runId: 'a4-3-survival-suppressed',
      role: 'start',
      sourceObservationIdentity: suppressedVenue.source.providerRecordId ?? 'not_retained',
      physicalBaseVenueId: suppressedVenue.id,
      candidateId: 'not_applicable',
      provenance: suppressedVenue.source.providerRecordId ?? 'not_retained',
      candidateEntryLayer: 'FieldLiveCandidateSurvivalDiagnostic',
      gateCarrier: 'FieldLiveCandidateSurvivalDiagnostic',
      producingLayer: 'Field/retrieval',
      evidenceAvailability: 'observed',
      disposition: survival.status,
      stableReasonCode: survival.dropReason,
      downstreamConsequence: 'does not enter scored role-pool evidence',
      reachesNextGate: false,
      contributesToAggregate: false,
      participatesInFallbackOrMasking: false,
      retentionStrategy: 'retained',
    },
  ]

  const recomputedStartRolePool = productionBuiltPools.warmup.filter(
    (candidate) => candidate.venue.source.sourceOrigin === 'live',
  ).length
  const zeroRemainingAfterRolePool = [rolePoolLoss].filter((candidate) =>
    zeroPools.warmup.some((item) => getScoredVenueCandidateId(item) === getScoredVenueCandidateId(candidate)),
  ).length
  assert.equal(zeroRemainingAfterRolePool, 0)

  assert(
    candidateRows.every((row) => row.evidenceAvailability !== 'not_yet_evaluated' || row.reachesNextGate),
    'not_yet_evaluated must not be used for retained-but-missing evidence.',
  )
  assert(
    candidateRows.some((row) => row.disposition === 'retained_in_role_pool_not_retained_by_role_competition_summary'),
    'Proof must retain the non-strongest support candidate observability gap.',
  )
  assertNoProviderCalls()

  return {
    corpus: {
      rowCount: corpus.rowCount,
      canonicalSha256: corpus.canonicalSha256,
    },
    providerCallsAttempted,
    productionBuildersInvoked: [
      'buildRolePools',
      'compareStrongestCandidatesByRole',
      'buildLiveAttritionTrace',
      'buildCandidateAdmissibilityDiagnostic',
      'buildFieldLiveCandidateSurvivalDiagnostics',
    ],
    candidateRows,
    aggregateChecks: [
      {
        name: 'live warmup role-pool count',
        recomputed: recomputedStartRolePool,
        reported: productionBuiltPools.warmup.filter(
          (candidate) => candidate.venue.source.sourceOrigin === 'live',
        ).length,
        parity:
          recomputedStartRolePool ===
          productionBuiltPools.warmup.filter(
            (candidate) => candidate.venue.source.sourceOrigin === 'live',
          ).length,
      },
      {
        name: 'support-role zero after role-pool gate',
        recomputed: zeroRemainingAfterRolePool,
        reported: attrition.liveEnteredRolePoolStart,
        parity: zeroRemainingAfterRolePool === attrition.liveEnteredRolePoolStart,
      },
      {
        name: 'all support candidates represented in RoleCompetitionDiagnostics',
        recomputed: candidateRows.filter((row) => row.runId === 'a4-3-role-competition-retained').length,
        reported: retainedStart.strongestLive ? 1 : 0,
        parity: 'unrecomputable',
        reason: 'RoleCompetitionDiagnostics retains strongest live/curated candidates, not every role-pool candidate row.',
      },
    ],
    caseResults: {
      'eligible support candidate retained through role competition': 'PASS',
      'support candidate rejected before scoring': 'PASS',
      'support candidate rejected by evaluated Bearings gate': 'PASS',
      'support candidate excluded during retrieval or survival': 'PASS',
      'support candidate excluded during scoring or role competition': 'PASS',
      'multiple support candidates entering one role pool': 'PARTIAL',
      'nonzero support-role result': 'PASS',
      'support-role zero': 'PASS',
      'legitimately unevaluated downstream gates': 'PASS',
      'fallback/static/demo/Sandbox/compatibility/Application could mask zero': 'NOT COVERED',
    },
    adequacy: {
      deterministic: 'PASS',
      'key-based': 'PASS',
      'non-positional': 'PASS',
      'non-name-based': 'PASS',
      'non-authoritative': 'PASS',
      'owner-preserving': 'PASS',
      'valid for static-only': 'PASS',
      'valid for provider-only retained fixture': 'PASS',
      'valid for static/provider convergence': 'NOT COVERED',
      'valid for same-name/different-address': 'NOT COVERED',
      'valid when several observations share baseVenueId': 'NOT COVERED',
      'able to retain rejected candidate rows': 'PASS',
      'able to attribute producing layer': 'PASS',
      'able to distinguish not_yet_evaluated from not_retained': 'PASS',
      'able to reconstruct first-zero without route-success inference': 'PASS',
      'able to retain every role-pool candidate row inside RoleCompetitionDiagnostics': 'FAIL',
    },
    gaps: [
      {
        missingEvidence: 'non-strongest support role-pool candidate rows are not retained inside RoleCompetitionDiagnostics',
        firstCarrier: 'RoleCompetitionDiagnostics',
        rightfulOwner: 'role-pool assembly / retrieval live competitiveness',
        proofCompositionCanSolve: true,
        runtimeEnrichmentRequired: false,
        sharedContractWorkRequired: false,
        approvalBoundary: 'none for A4-3; proof composes RolePools plus scoredVenues and reports RoleCompetition as summary-only',
      },
      {
        missingEvidence: 'role-pool threshold/policy source is not retained on support rejection projection',
        firstCarrier: 'SupportRoleRejectionDiagnostic proof-local projection',
        rightfulOwner: 'role-pool assembly',
        proofCompositionCanSolve: false,
        runtimeEnrichmentRequired: false,
        sharedContractWorkRequired: false,
        approvalBoundary: 'future proof-fixture or bounded runtime diagnostic approval required before any carrier edit',
      },
    ],
    firstMissingCarrierDecision:
      'NO SUPPORT-ROLE RUNTIME ENRICHMENT REQUIRED - PROOF COMPOSITION SUFFICIENT',
  }
}

try {
  const result = runCharacterization()
  assertNoProviderCalls()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
} finally {
  globalThis.fetch = originalFetch
}
