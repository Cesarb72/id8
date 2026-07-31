import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { buildRolePools, type RolePools } from '../src/domain/arc/buildRolePools.ts'
import { buildLiveAttritionTrace } from '../src/domain/debug/buildLiveAttritionTrace.ts'
import { compareStrongestCandidatesByRole } from '../src/domain/debug/compareStrongestCandidatesByRole.ts'
import { buildExperienceLens } from '../src/domain/intent/buildExperienceLens.ts'
import { getCrewPolicy } from '../src/domain/intent/getCrewPolicy.ts'
import { normalizeIntent } from '../src/domain/intent/normalizeIntent.ts'
import { retrieveVenues, type RetrieveVenuesResult } from '../src/domain/retrieval/retrieveVenues.ts'
import type { FieldTextSearchResponse } from '../src/domain/field/fieldProxyTypes.ts'
import type { ArcCandidate, ScoredVenue } from '../src/domain/types/arc.ts'
import type { CrewPolicy } from '../src/domain/types/crewPolicies.ts'
import type { ExperienceLens } from '../src/domain/types/experienceLens.ts'
import type { UserStopRole } from '../src/domain/types/itinerary.ts'
import type {
  LiveAttritionTraceDiagnostics,
  LiveQueryCandidateDispositionDiagnostics,
  RoleCompetitionDiagnostics,
} from '../src/domain/types/diagnostics.ts'
import type { InternalRole, Venue, VenueCategory } from '../src/domain/types/venue.ts'

type A6Judgment = 'A6 PRODUCTION EVIDENCE GAP PROVEN - BOUNDED CARRIER ENRICHMENT REQUIRED'

interface CandidateContinuityRow {
  scenario: string
  candidateId: string
  canonicalBaseVenueId: string
  providerProvenance: string
  requestedRole: UserStopRole
  fieldSourceStatus: string
  interpretationIdentityStatus: string
  districtStructureStatus: string
  bearingsDecision: string
  bearingsReason: string
  scoredPresence: 'present' | 'absent'
  rolePoolMembership: 'entered' | 'not_entered' | 'not_applicable'
  competitionState: string
  selectedState: 'selected' | 'not_selected' | 'not_applicable'
  firstZeroOrRemovalStage: string
  owningLayer: string
  routeConsequence: string
  maskingCheck: string
}

interface AggregateCheck {
  scenario: string
  aggregate: string
  productionAggregate: number | string
  recomputedFromRows: number | string
  match: boolean | 'unrecomputable'
  missingEvidence: string
}

interface A6ProofResult {
  judgment: A6Judgment
  providerCallsAttempted: number
  fieldProxyCalls: number
  candidateRows: CandidateContinuityRow[]
  aggregateChecks: AggregateCheck[]
  carrierFindings: string[]
  residueFindings: string[]
  limitations: string[]
}

const judgment: A6Judgment =
  'A6 PRODUCTION EVIDENCE GAP PROVEN - BOUNDED CARRIER ENRICHMENT REQUIRED'

const supportRoles: UserStopRole[] = ['start', 'windDown']
const roleByUserRole: Record<UserStopRole, InternalRole> = {
  start: 'warmup',
  highlight: 'peak',
  surprise: 'wildcard',
  windDown: 'cooldown',
}

const intent = normalizeIntent({
  city: 'San Jose',
  primaryVibe: 'cozy',
  persona: 'romantic',
  timeOfDay: 'evening',
  distanceMode: 'nearby',
  groupSize: 2,
})
const lens = buildExperienceLens({ intent })
const crewPolicy = getCrewPolicy(intent.persona) as CrewPolicy

function providerRecord(
  providerRecordId: string,
  displayName: string,
  formattedAddress: string,
  location?: { latitude: number; longitude: number },
): FieldTextSearchResponse['results'][number] {
  return {
    provider: 'google_places',
    providerRecordId,
    displayName,
    formattedAddress,
    shortFormattedAddress: formattedAddress,
    primaryType: 'cafe',
    types: ['cafe', 'coffee_shop', 'establishment'],
    businessStatus: 'OPERATIONAL',
    currentOpeningHours: {
      openNow: true,
      weekdayDescriptions: ['Friday: 7:00 AM - 10:00 PM'],
    },
    regularOpeningHours: {
      openNow: true,
      weekdayDescriptions: ['Friday: 7:00 AM - 10:00 PM'],
    },
    rating: 4.7,
    userRatingCount: 240,
    ...(location ? { location } : {}),
    sourceMode: 'live',
    rawPayloadAvailable: false,
    fetchedAt: Date.UTC(2026, 6, 24),
    completenessHints: {
      hasAddress: true,
      hasLocation: Boolean(location),
      hasHours: true,
      hasPrimaryType: true,
      hasRating: true,
    },
  }
}

function buildUpstreamRejectedFieldResponse(queryLabel: string): FieldTextSearchResponse {
  return {
    ok: true,
    cache: 'miss',
    budget: {
      date: '2026-07-24',
      cap: 13,
      used: 0,
      remaining: 13,
    },
    results: [
      providerRecord(
        'a6-provider-outside',
        'A6 Outside Support Coffee',
        '500 Far Away Ave, San Jose, CA 95113',
        { latitude: 37.365, longitude: -121.925 },
      ),
      providerRecord(
        'a6-provider-near-boundary',
        'A6 Near Boundary Support Coffee',
        '16 South 1st St, San Jose, CA 95113',
        { latitude: 37.3426, longitude: -121.8895 },
      ),
      providerRecord(
        'a6-provider-missing-location',
        'A6 Missing Location Support Coffee',
        '77 South 1st St, San Jose, CA 95113',
      ),
    ],
    diagnostics: {
      purpose: 'retrieval_supply',
      queryHash: `a6-${queryLabel}`,
      providerStatus: 'mocked',
      resultCount: 3,
      callConsumed: false,
    },
  }
}

function roleScoresFor(role: InternalRole, score: number): Record<InternalRole, number> {
  return {
    warmup: role === 'warmup' ? score : 0.34,
    peak: role === 'peak' ? score : 0.34,
    wildcard: role === 'wildcard' ? score : 0.34,
    cooldown: role === 'cooldown' ? score : 0.34,
  }
}

function shapeScoresFor(role: InternalRole, score: number): Record<'start' | 'highlight' | 'surprise' | 'windDown', number> {
  return {
    start: role === 'warmup' ? score : 0.34,
    highlight: role === 'peak' ? score : 0.34,
    surprise: role === 'wildcard' ? score : 0.34,
    windDown: role === 'cooldown' ? score : 0.34,
  }
}

function roleContractFor(role: InternalRole, targetRole: InternalRole): ScoredVenue['roleContract'][InternalRole] {
  return {
    contractLabel: `${targetRole} A6 contract`,
    strength: 'none',
    score: role === targetRole ? 0.9 : 0.62,
    satisfied: true,
    matchedSignals: [],
    violations: [],
  }
}

function rolePoolInfluence(): ScoredVenue['taste']['rolePoolInfluence'] {
  return {
    warmup: {
      tasteBonus: 0.04,
      roleSuitabilityContribution: 0.03,
      momentContribution: 0.01,
      highlightPlausibilityBonus: 0,
      modeAlignmentContribution: 0.03,
      modeAlignmentPenalty: 0,
    },
    peak: {
      tasteBonus: 0.04,
      roleSuitabilityContribution: 0.03,
      momentContribution: 0.04,
      highlightPlausibilityBonus: 0.05,
      modeAlignmentContribution: 0.03,
      modeAlignmentPenalty: 0,
    },
    wildcard: {
      tasteBonus: 0.04,
      roleSuitabilityContribution: 0.03,
      momentContribution: 0.01,
      highlightPlausibilityBonus: 0,
      modeAlignmentContribution: 0.03,
      modeAlignmentPenalty: 0,
    },
    cooldown: {
      tasteBonus: 0.04,
      roleSuitabilityContribution: 0.03,
      momentContribution: 0.01,
      highlightPlausibilityBonus: 0,
      modeAlignmentContribution: 0.03,
      modeAlignmentPenalty: 0,
    },
  }
}

function scoredVenue(params: {
  id: string
  role: InternalRole
  sourceOrigin: 'live' | 'curated'
  roleScore: number
  category?: VenueCategory
  sourceConfidence?: number
  completenessScore?: number
  qualityScore?: number
  likelyOpenForCurrentWindow?: boolean
  timeConfidence?: number
}): ScoredVenue {
  const roleScores = roleScoresFor(params.role, params.roleScore)
  const stopShapeFit = shapeScoresFor(params.role, params.roleScore)
  const sourceOrigin = params.sourceOrigin
  const category = params.category ?? 'cafe'
  const sourceConfidence = params.sourceConfidence ?? 0.88
  const completenessScore = params.completenessScore ?? 0.86
  const qualityScore = params.qualityScore ?? 0.84
  const venue: Venue = {
    id: params.id,
    name: params.id,
    city: 'San Jose',
    neighborhood: 'Downtown',
    driveMinutes: 4,
    category,
    subcategory: 'a6 proof',
    priceTier: '$$',
    tags: ['coffee'],
    useCases: [],
    vibeTags: ['cozy'],
    energyLevel: params.role === 'cooldown' ? 0.42 : 0.5,
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
    signature: {
      signatureScore: sourceOrigin === 'live' ? 0.82 : 0.7,
      genericScore: 0.18,
    } as never,
    source: {
      sourceOrigin,
      sourceMode: sourceOrigin,
      provider: sourceOrigin === 'live' ? 'google-places' : 'curated',
      providerRecordId: sourceOrigin === 'live' ? `provider:${params.id}` : undefined,
      sourceQueryLabel: sourceOrigin === 'live' ? 'a6-support-role@pocket' : undefined,
      formattedAddress: `${params.id}, San Jose, CA 95113`,
      latitude: 37.3345,
      longitude: -121.8895,
      businessStatus: 'operational',
      qualityGateStatus: 'approved',
      likelyOpenForCurrentWindow: params.likelyOpenForCurrentWindow ?? true,
      timeConfidence: params.timeConfidence ?? 0.82,
      openNow: true,
      hoursKnown: true,
      sourceConfidence,
      completenessScore,
      qualityScore,
      sourceTypes: ['cafe', 'coffee_shop'],
      missingFields: [],
      inferredFields: [],
      qualityGateNotes: [],
      approvalBlockers: [],
      demotionReasons: [],
      suppressionReasons: [],
      hoursPressureNotes: [],
      hoursDemotionApplied: false,
      hoursSuppressionApplied: false,
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
    fitScore: 0.72,
    hiddenGemScore: 0.4,
    lensCompatibility: 0.74,
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
      warmup: roleContractFor('warmup', params.role),
      peak: roleContractFor('peak', params.role),
      wildcard: roleContractFor('wildcard', params.role),
      cooldown: roleContractFor('cooldown', params.role),
    },
    stopShapeFit,
    vibeAuthority: {
      primary: 0.68,
      secondary: 0.58,
      overall: 0.68,
      packPressure: { highlight: 0.5 },
      byRole: {
        start: stopShapeFit.start,
        highlight: stopShapeFit.highlight,
        surprise: stopShapeFit.surprise,
        windDown: stopShapeFit.windDown,
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
      candidateTier: 'support-only',
    } as never,
    roleScores,
    taste: {
      signals: {
        energy: 0.48,
        socialDensity: 0.48,
        intimacy: 0.68,
        lingerFactor: 0.68,
        destinationFactor: 0.38,
        experientialFactor: 0.38,
        conversationFriendliness: 0.7,
        anchorStrength: 0.35,
        interactiveStrength: 0.58,
        durationEstimate: 'linger',
        isRomanticMomentCandidate: false,
        romanticSignals: {
          intimacy: 0.68,
          ambiance: 0.62,
          ambientExperience: 0.58,
          scenic: 0.18,
          sharedActivity: 0.2,
        },
        momentEnrichment: {
          ambientUniqueness: 0.54,
          culturalDepth: 0.24,
          socialEnergy: 0.46,
          signals: {},
        },
        momentTier: 'support',
        primaryExperienceArchetype: 'coffee',
        experienceFamily: 'ambient_indoor',
        experienceArchetypes: ['sweet'],
        categorySpecificity: 0.68,
        personalityStrength: 0.68,
        momentPotential: { score: 0.35 },
        momentIntensity: { score: 0.35 },
        roleSuitability: {
          start: roleScores.warmup,
          highlight: roleScores.peak,
          surprise: roleScores.wildcard,
          windDown: roleScores.cooldown,
        },
        supportingSignals: ['a6-proof-fixture'],
      } as never,
      modeAlignment: {
        score: 0.68,
        penalty: 0,
        lane: 'supporting',
        tier: 'supporting',
        supportiveTagScore: 0.5,
        lanePriorityScore: 0.5,
      } as never,
      fallbackPenalty: {
        signalScore: 0,
        appliedPenalty: 0,
        applied: false,
        strongerAlternativePresent: false,
        reason: 'none',
      },
      rolePoolInfluence: rolePoolInfluence(),
    },
  }
}

function arcCandidate(id: string, stops: Array<{ role: InternalRole; scoredVenue: ScoredVenue }>, totalScore: number): ArcCandidate {
  return {
    id,
    stops,
    totalScore,
    scoreBreakdown: {
      roleFlowScore: 0.8,
      diversityScore: 0.75,
      geographyScore: 0.75,
      hiddenGemLift: 0.1,
      windDownScore: 0.72,
    },
    pacing: { stops: [] } as never,
    spatial: {} as never,
    hasWildcard: stops.some((stop) => stop.role === 'wildcard'),
  }
}

function retrievalStub(params: {
  fetched: number
  mapped: number
  normalized: number
  approved: number
  demoted?: number
  suppressed?: number
  liveScored: number
}): RetrieveVenuesResult {
  return {
    venues: [],
    totalVenueCount: 0,
    lensCompatibleCount: 0,
    excludedByQualityGate: [],
    fallbackRelaxationApplied: 'none',
    sourceMode: {
      requestedMode: 'hybrid',
      effectiveMode: 'hybrid',
      debugOverrideApplied: true,
      fallbackToCurated: false,
      liveFetchAttempted: true,
      liveFetchSucceeded: true,
      provider: 'google-places',
      queryLocationLabel: 'San Jose',
      queryCentersCount: 1,
      queryCentersUsed: [],
      queryRadiusM: 890,
      pocketCenteredRetrievalApplied: true,
      queryCount: 1,
      labelsConsidered: 1,
      labelsAdmitted: 1,
      centersConsidered: 1,
      centersAdmitted: 1,
      dispatchQueriesPlanned: 1,
      dispatchQueriesAttempted: 1,
      dispatchQueriesPlannedWithinCap: true,
      liveQueryTemplatesUsed: ['a6-support-role'],
      liveQueryLabelsUsed: ['a6-support-role@pocket'],
      liveCandidatesByQuery: [],
      liveRoleIntentQueryNotes: [],
      fetchedCount: params.fetched,
      rawFetchedCount: params.fetched,
      mappedCount: params.mapped,
      mappedDroppedCount: 0,
      mappedDropReasons: {},
      normalizedCount: params.normalized,
      dedupedByPlaceIdCount: 0,
      normalizationDroppedCount: 0,
      normalizationDropReasons: {},
      acceptedCount: params.approved + (params.demoted ?? 0),
      acceptanceDroppedCount: 0,
      acceptanceDropReasons: {},
      approvedCount: params.approved,
      demotedCount: params.demoted ?? 0,
      suppressedCount: params.suppressed ?? 0,
      usableCount: params.liveScored,
      liveHoursDemotedCount: 0,
      liveHoursSuppressedCount: 0,
      partialFailure: false,
      errors: [],
      countsBySource: {
        curated: 0,
        live: params.liveScored,
      },
      dedupedCount: 0,
      dedupedLiveCount: 0,
      liveDedupedAgainstCuratedCount: 0,
      liveNoveltyCollapsedCount: 0,
      dedupeLosses: [],
      liveTrustBreakdown: {
        topApprovedBlockers: [],
        topSuppressionReasons: [],
        topDedupeReasons: [],
        strongestApprovalFailures: [],
        strongestSuppressedCandidates: [],
        strongestDedupedCandidates: [],
      },
      liveUsableInventory: params.liveScored > 0,
      fallbackUsed: false,
      fallbackSources: [],
      inventoryTruth: params.liveScored > 0 ? 'real_live' : 'live_failed_empty',
      liveFailureVisible: params.liveScored === 0,
      fixtureInjectionUsed: false,
      bootstrapInjectionUsed: false,
      defaultCityFallbackUsed: false,
      providerAuthoritySummary: {},
      liveCandidateSurvivalDiagnostics: [],
      liveDiagnosticRollups: {
        pocketFilterKeptCount: 0,
        pocketFilterRejectedCount: 0,
        rejectedOutsideSelectedEnvelopeCount: 0,
        rejectedMissingLocationCount: 0,
        rejectedUnknownDistanceCount: 0,
        qualityApprovedCount: params.approved,
        qualityDemotedCount: params.demoted ?? 0,
        qualitySuppressedCount: params.suppressed ?? 0,
        qualityBlockedMissingEvidenceCount: 0,
        hoursDemotedCount: 0,
        hoursSuppressedCount: 0,
        liveSurvivalEligibleCount: params.liveScored,
        canonicalLiveCandidateCount: params.liveScored,
        provisionalLiveCandidateCount: 0,
        blockedLiveCandidateCount: 0,
        curatedStaticCandidateCount: 0,
        provisionalHandoffCandidateCount: 0,
        provisionalHandoffWithLocationCount: 0,
        provisionalHandoffWithFormattedAddressCount: 0,
        provisionalHandoffOutsideEnvelopeCount: 0,
        provisionalHandoffMissingLocationCount: 0,
        provisionalHandoffRequiresBearingsAdmissibilityCount: 0,
        bearingsCandidateAdmissibilityDiagnosticCount: 0,
        bearingsSpatialAdmissibilityRequiredCount: 0,
        bearingsPlanTimeHoursFeasibilityRequiredCount: 0,
        bearingsMovementFeasibilityRequiredCount: 0,
        bearingsPlaceRightRequiredCount: 0,
        bearingsBlockedCandidateCount: 0,
        bearingsProvisionalOnlyCandidateCount: 0,
        bearingsOutsideEnvelopeCount: 0,
        bearingsMissingLocationCount: 0,
        bearingsAdmissibilityNotEvaluatedCount: 0,
        bearingsCandidateUpgradeRequiredCount: 0,
        q5LegitimatelyOutsideEnvelopeCount: 0,
        q5NearBoundaryOrAmbiguousCount: 0,
        q5PossiblyFalseDropCount: 0,
        q5InsufficientDataCount: 0,
        q5UnknownExact22DueToMissingSavedCandidateDetailsCount: 0,
      },
    },
    stageCounts: {
      totalSeed: params.liveScored,
      active: params.liveScored,
      qualityApproved: params.approved,
      qualityDemoted: params.demoted ?? 0,
      qualitySuppressed: params.suppressed ?? 0,
      curatedSeed: 0,
      liveFetched: params.fetched,
      liveMapped: params.mapped,
      liveNormalized: params.normalized,
      liveApproved: params.approved,
      liveDemoted: params.demoted ?? 0,
      liveSuppressed: params.suppressed ?? 0,
      liveHoursDemoted: 0,
      liveHoursSuppressed: 0,
      cityMatch: params.liveScored,
      geographyMatch: params.liveScored,
      lensStrict: params.liveScored,
      lensSoft: params.liveScored,
      finalRetrieved: params.liveScored,
      neighborhoodPreferred: 0,
      dedupedMerged: 0,
      dedupedLive: 0,
      finalCurated: 0,
      finalLive: params.liveScored,
    },
  } as unknown as RetrieveVenuesResult
}

function allCandidates(result: Awaited<ReturnType<typeof retrieveVenues>>): LiveQueryCandidateDispositionDiagnostics[] {
  return result.sourceMode.liveCandidatesByQuery.flatMap((query) => query.candidates ?? [])
}

function rowForUpstreamCandidate(
  candidate: LiveQueryCandidateDispositionDiagnostics,
): CandidateContinuityRow {
  const identityStatus = candidate.venueIdentityHandoff?.identityResolutionStatus ?? 'not_retained'
  const bearings = candidate.bearingsCandidateAdmissibility
  const fieldReason =
    candidate.dropReason ??
    candidate.pocketProofDiagnostic?.fieldSourceDecision.reason ??
    candidate.filterVerdict ??
    'not_retained'
  const firstStage =
    candidate.filterVerdict === 'rejected_outside_selected_envelope'
      ? 'Bearings diagnostic-only outside-envelope consequence'
      : candidate.filterVerdict === 'rejected_missing_location'
        ? 'Field/District spatial evidence missing before Bearings candidate admissibility'
        : 'upstream candidate did not reach scoring'
  return {
    scenario: 'upstream-rejected',
    candidateId: candidate.venueId ?? 'not_retained',
    canonicalBaseVenueId: candidate.venueIdentityHandoff?.resolvedBaseVenueId ?? 'not_retained',
    providerProvenance: candidate.providerPlaceId ?? 'not_retained',
    requestedRole: 'start',
    fieldSourceStatus: candidate.fieldCandidateClass,
    interpretationIdentityStatus: identityStatus,
    districtStructureStatus: candidate.selectedPocketEnvelope ?? 'not_retained',
    bearingsDecision: bearings?.spatialAdmissibilityStatus ?? 'not_applicable',
    bearingsReason: bearings?.blockReason ?? fieldReason,
    scoredPresence: 'absent',
    rolePoolMembership: 'not_applicable',
    competitionState: 'not_reached',
    selectedState: 'not_applicable',
    firstZeroOrRemovalStage: firstStage,
    owningLayer: bearings?.owner ?? 'Field evidence / District structure',
    routeConsequence: candidate.candidateBoardAdmission ? 'unexpectedly_route_eligible' : 'not_route_eligible',
    maskingCheck: 'no_later_layer_reintroduced_candidate',
  }
}

function rowForScoredCandidate(params: {
  scenario: string
  candidate: ScoredVenue
  role: UserStopRole
  rolePools: RolePools
  selectedArc: ArcCandidate
  roleCompetition?: RoleCompetitionDiagnostics
}): CandidateContinuityRow {
  const internalRole = roleByUserRole[params.role]
  const rolePool = params.rolePools[internalRole === 'warmup' ? 'warmup' : internalRole === 'cooldown' ? 'cooldown' : internalRole]
  const enteredPool = rolePool.some((candidate) => candidate.venue.id === params.candidate.venue.id)
  const selected = params.selectedArc.stops.some(
    (stop) => stop.role === internalRole && stop.scoredVenue.venue.id === params.candidate.venue.id,
  )
  const strongestLiveId = params.roleCompetition?.strongestLive?.venueId
  const competitionState =
    selected
      ? 'selected_winner'
      : strongestLiveId === params.candidate.venue.id
        ? params.roleCompetition?.strongestLiveLostAtStage ?? 'strongest_live_state_retained'
        : enteredPool
          ? 'entered_pool_but_non_strongest_state_not_retained_in_role_competition'
          : 'scored_but_not_role_pool_state_not_retained_as_candidate_row'
  return {
    scenario: params.scenario,
    candidateId: params.candidate.candidateIdentity.candidateId,
    canonicalBaseVenueId: params.candidate.candidateIdentity.baseVenueId,
    providerProvenance: params.candidate.venue.source.providerRecordId ?? 'curated',
    requestedRole: params.role,
    fieldSourceStatus: params.candidate.venue.source.sourceOrigin,
    interpretationIdentityStatus: 'candidateIdentity.baseVenueId present',
    districtStructureStatus: 'not_retained_on_role_competition_candidate',
    bearingsDecision: 'not_retained_on_role_competition_candidate',
    bearingsReason: 'not_retained_on_role_competition_candidate',
    scoredPresence: 'present',
    rolePoolMembership: enteredPool ? 'entered' : 'not_entered',
    competitionState,
    selectedState: selected ? 'selected' : 'not_selected',
    firstZeroOrRemovalStage: selected
      ? 'selected-winner'
      : enteredPool
        ? 'role-pool competition or final-route-winner'
        : 'role-pool',
    owningLayer: 'Waypoint',
    routeConsequence: selected ? 'selected_route_stop' : 'not_selected_route_stop',
    maskingCheck: 'production diagnostics do not reclassify as Field/Bearings zero',
  }
}

async function runUpstreamRejectedCase(): Promise<{
  fieldProxyCalls: number
  providerCallsConsumed: number
  rows: CandidateContinuityRow[]
}> {
  const originalFetch = globalThis.fetch
  let fieldProxyCalls = 0
  let providerCallsConsumed = 0
  globalThis.fetch = (async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    assert(
      url === '/api/field/text-search' || url.endsWith('/api/field/text-search'),
      `unexpected no-provider fetch url: ${url}`,
    )
    fieldProxyCalls += 1
    const body = typeof init?.body === 'string'
      ? (JSON.parse(init.body) as { queryLabel?: string })
      : {}
    const response = buildUpstreamRejectedFieldResponse(body.queryLabel ?? 'unknown')
    providerCallsConsumed += response.diagnostics.callConsumed ? 1 : 0
    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  }) as typeof fetch

  try {
    const retrieval = await retrieveVenues(intent, lens, {
      requestedSourceMode: 'live',
      sourceModeOverrideApplied: true,
      liveEnvelope: {
        liveProviderAllowed: true,
        maxProviderCalls: 1,
        maxQueryLabels: 1,
        maxCenters: 1,
      },
      livePocketHint: {
        pocketId: 'downtown-san-jose',
        pocketLabel: 'Downtown San Jose',
        centroid: { lat: 37.3345, lng: -121.8895 },
        radiusM: 650,
        source: 'district_intelligence',
        city: 'San Jose',
        locationLabel: 'Downtown San Jose, San Jose',
      },
      starterPack: {
        id: 'coffee-books',
        title: 'Coffee & Books',
        description: 'No-provider A6 upstream-rejection proof starter pack.',
        primaryAnchor: 'cozy',
        distanceMode: 'nearby',
      },
    })

    assert.equal(fieldProxyCalls, 1)
    assert.equal(providerCallsConsumed, 0)
    const rows = allCandidates(retrieval).map(rowForUpstreamCandidate)
    assert(rows.length >= 3, 'expected upstream rejected provider rows')
    assert(
      rows.some((row) => row.bearingsDecision === 'bearings_outside_selected_envelope'),
      'outside-envelope Bearings diagnostic row must be retained',
    )
    assert(
      rows.some((row) => row.bearingsReason === 'field_source_pocket_filter_missing_location'),
      'missing-location row must remain distinguishable from outside-envelope rejection',
    )
    return { fieldProxyCalls, providerCallsConsumed, rows }
  } finally {
    globalThis.fetch = originalFetch
  }
}

function runRoleCompetitionCase(): {
  rows: CandidateContinuityRow[]
  aggregateChecks: AggregateCheck[]
  attrition: LiveAttritionTraceDiagnostics
  roleCompetition: Partial<Record<UserStopRole, RoleCompetitionDiagnostics>>
} {
  const liveStartStrong = scoredVenue({
    id: 'a6-live-start-strongest',
    role: 'warmup',
    sourceOrigin: 'live',
    roleScore: 0.92,
    sourceConfidence: 0.9,
  })
  const liveStartMiddle = scoredVenue({
    id: 'a6-live-start-middle',
    role: 'warmup',
    sourceOrigin: 'live',
    roleScore: 0.82,
    sourceConfidence: 0.84,
  })
  const liveStartThird = scoredVenue({
    id: 'a6-live-start-third',
    role: 'warmup',
    sourceOrigin: 'live',
    roleScore: 0.76,
    sourceConfidence: 0.82,
  })
  const liveStartTooWeak = scoredVenue({
    id: 'a6-live-start-scored-not-pool',
    role: 'warmup',
    sourceOrigin: 'live',
    roleScore: 0.18,
    sourceConfidence: 0.72,
  })
  const curatedStartWinner = scoredVenue({
    id: 'a6-curated-start-winner',
    role: 'warmup',
    sourceOrigin: 'curated',
    roleScore: 0.96,
  })
  const liveWindDown = scoredVenue({
    id: 'a6-live-winddown-survivor',
    role: 'cooldown',
    sourceOrigin: 'live',
    roleScore: 0.84,
  })
  const curatedWindDownWinner = scoredVenue({
    id: 'a6-curated-winddown-winner',
    role: 'cooldown',
    sourceOrigin: 'curated',
    roleScore: 0.94,
  })

  const scoredVenues = [
    liveStartStrong,
    liveStartMiddle,
    liveStartThird,
    liveStartTooWeak,
    curatedStartWinner,
    liveWindDown,
    curatedWindDownWinner,
  ]
  const rolePools = buildRolePools(scoredVenues, crewPolicy, lens, intent)
  assert(
    rolePools.warmup.filter((candidate) => candidate.venue.source.sourceOrigin === 'live').length >= 3,
    'expected at least three live start candidates to enter the production role pool',
  )
  assert(
    !rolePools.warmup.some((candidate) => candidate.venue.id === liveStartTooWeak.venue.id),
    'weak scored candidate should be absent from the production role pool',
  )

  const selectedArc = arcCandidate(
    'a6-selected-curated-route',
    [
      { role: 'warmup', scoredVenue: curatedStartWinner },
      { role: 'cooldown', scoredVenue: curatedWindDownWinner },
    ],
    0.96,
  )
  const liveStartArc = arcCandidate(
    'a6-live-start-loses-final',
    [
      { role: 'warmup', scoredVenue: liveStartStrong },
      { role: 'cooldown', scoredVenue: curatedWindDownWinner },
    ],
    0.88,
  )
  const liveWindDownArc = arcCandidate(
    'a6-live-winddown-loses-final',
    [
      { role: 'warmup', scoredVenue: curatedStartWinner },
      { role: 'cooldown', scoredVenue: liveWindDown },
    ],
    0.84,
  )
  const arcCandidates = [selectedArc, liveStartArc, liveWindDownArc]
  const roleCompetition = compareStrongestCandidatesByRole({
    scoredVenues,
    rolePools,
    arcCandidates,
    selectedArc,
    lens: lens as ExperienceLens,
  }).roleCompetitionByRole
  const attrition = buildLiveAttritionTrace({
    retrieval: retrievalStub({
      fetched: 7,
      mapped: 7,
      normalized: 7,
      approved: 5,
      liveScored: 5,
    }),
    scoredVenues,
    rolePools,
    arcCandidates,
    selectedArc,
    roleCompetitionByRole: roleCompetition,
  })

  const startCompetition = roleCompetition.start
  assert(startCompetition, 'start role competition diagnostics must be produced')
  assert.equal(startCompetition.strongestLive?.venueId, liveStartStrong.venue.id)
  assert.equal(
    JSON.stringify(startCompetition).includes(liveStartMiddle.venue.id),
    false,
    'RoleCompetitionDiagnostics must not masquerade as a full live-candidate ledger',
  )
  assert.equal(attrition.liveEnteredRolePoolStart >= 3, true)
  assert.equal(attrition.liveRejectedByRolePoolCount >= 1, true)

  const rows = scoredVenues
    .filter((candidate) => candidate.venue.source.sourceOrigin === 'live')
    .flatMap((candidate) =>
      supportRoles.map((role) =>
        rowForScoredCandidate({
          scenario: 'role-competition',
          candidate,
          role,
          rolePools,
          selectedArc,
          roleCompetition: roleCompetition[role],
        }),
      ),
    )
  const startRows = rows.filter((row) => row.requestedRole === 'start')
  const startPoolRows = startRows.filter((row) => row.rolePoolMembership === 'entered')
  const productionRoleCompetitionLedger = startCompetition.strongestLive ? 1 : 0

  return {
    rows,
    aggregateChecks: [
      {
        scenario: 'role-competition',
        aggregate: 'live start role-pool rows',
        productionAggregate: attrition.liveEnteredRolePoolStart,
        recomputedFromRows: startPoolRows.length,
        match: attrition.liveEnteredRolePoolStart === startPoolRows.length,
        missingEvidence: 'none inside RolePools while proof has direct RolePools access',
      },
      {
        scenario: 'role-competition',
        aggregate: 'RoleCompetitionDiagnostics live candidate ledger rows',
        productionAggregate: productionRoleCompetitionLedger,
        recomputedFromRows: startRows.filter((row) => row.fieldSourceStatus === 'live').length,
        match: false,
        missingEvidence:
          'RoleCompetitionDiagnostics retains strongestLive/strongestCurated only, not all support-role candidate rows.',
      },
      {
        scenario: 'role-competition',
        aggregate: 'LiveAttritionTrace candidate-level first-zero rows',
        productionAggregate: attrition.liveRejectedByRolePoolCount,
        recomputedFromRows: 'unrecomputable from LiveAttritionTrace alone',
        match: 'unrecomputable',
        missingEvidence:
          'LiveAttritionTrace stores stage counts and notes, not candidate IDs, provenance, or per-candidate loss owners.',
      },
    ],
    attrition,
    roleCompetition,
  }
}

function runNoSourcedCase(): {
  aggregateChecks: AggregateCheck[]
  attrition: LiveAttritionTraceDiagnostics
  roleCompetition: Partial<Record<UserStopRole, RoleCompetitionDiagnostics>>
} {
  const curatedStart = scoredVenue({
    id: 'a6-curated-only-start',
    role: 'warmup',
    sourceOrigin: 'curated',
    roleScore: 0.86,
  })
  const rolePools = buildRolePools([curatedStart], crewPolicy, lens, intent)
  const selectedArc = arcCandidate(
    'a6-curated-only-route',
    [{ role: 'warmup', scoredVenue: curatedStart }],
    0.86,
  )
  const roleCompetition = compareStrongestCandidatesByRole({
    scoredVenues: [curatedStart],
    rolePools,
    arcCandidates: [selectedArc],
    selectedArc,
    lens,
  }).roleCompetitionByRole
  const attrition = buildLiveAttritionTrace({
    retrieval: retrievalStub({
      fetched: 0,
      mapped: 0,
      normalized: 0,
      approved: 0,
      liveScored: 0,
    }),
    scoredVenues: [curatedStart],
    rolePools,
    arcCandidates: [selectedArc],
    selectedArc,
    roleCompetitionByRole: roleCompetition,
  })
  assert.equal(attrition.liveFetchedCount, 0)
  assert.equal(attrition.liveEnteredRolePoolStart, 0)
  assert.equal(roleCompetition.start?.outcome, 'no-live-candidate')
  return {
    aggregateChecks: [
      {
        scenario: 'no-sourced-live',
        aggregate: 'live source population',
        productionAggregate: attrition.liveFetchedCount,
        recomputedFromRows: 0,
        match: true,
        missingEvidence: 'no candidate rows expected for authentic source zero',
      },
      {
        scenario: 'no-sourced-live',
        aggregate: 'start live role-pool population',
        productionAggregate: attrition.liveEnteredRolePoolStart,
        recomputedFromRows: 0,
        match: true,
        missingEvidence: 'none for source-zero distinction; source zero is aggregate-only by definition',
      },
    ],
    attrition,
    roleCompetition,
  }
}

function assertCarrierSourceShapes(): string[] {
  const diagnosticsSource = readFileSync('src/domain/types/diagnostics.ts', 'utf8')
  assert(diagnosticsSource.includes('strongestLive?: RoleCompetitionCandidateDiagnostics'))
  assert(!diagnosticsSource.includes('allLiveCandidates?:'))
  assert(diagnosticsSource.includes('export interface LiveAttritionStageEntry'))
  assert(diagnosticsSource.includes('liveCount: number'))
  assert(diagnosticsSource.includes('export interface RolePoolDiagnostics'))
  assert(diagnosticsSource.includes('rolePoolCandidateIds?: string[]'))

  const rolePoolsSource = readFileSync('src/domain/arc/buildRolePools.ts', 'utf8')
  assert(rolePoolsSource.includes('limitArcRolePoolCandidates'))
  assert(rolePoolsSource.includes('rolePoolLimit'))

  const competitionSource = readFileSync('src/domain/debug/compareStrongestCandidatesByRole.ts', 'utf8')
  assert(competitionSource.includes('const strongestLive = pickTopCandidate'))
  assert(competitionSource.includes('roleCompetitionByRole[userRole]'))
  assert(!competitionSource.includes('allLiveCandidates'))

  const attritionSource = readFileSync('src/domain/debug/buildLiveAttritionTrace.ts', 'utf8')
  assert(attritionSource.includes('liveRejectedByRolePoolCount'))
  assert(attritionSource.includes('stages.push'))

  return [
    'RolePools: production-authoritative Waypoint role-pool candidate arrays after filtering/order/cap; retains pool entrants only.',
    'RoleCompetitionDiagnostics: diagnostic-only strongest-live/strongest-curated summary; does not retain complete support-role candidate rows.',
    'LiveAttritionTrace: diagnostic-only aggregate stage counts and notes; no candidate IDs/provenance/loss-owner rows.',
    'RolePoolDiagnostics: diagnostic/Application explainability summary; retains rolePoolCandidateIds but not full candidate evidence or per-candidate loss reasons.',
  ]
}

function assertResidueGuards(): string[] {
  const sessionStoreSource = readFileSync('src/app/state/sessionStore.ts', 'utf8')
  assert(sessionStoreSource.includes('scoredVenues'))

  const buildDebugSource = readFileSync('src/app/debug/buildEngineDebugSnapshot.ts', 'utf8')
  assert(buildDebugSource.includes('strongest'))
  assert(buildDebugSource.includes('role-pool'))

  const sandboxPreviewSource = readFileSync(
    'src/app/services/sandbox/curatePreviewQualificationService.ts',
    'utf8',
  )
  assert(sandboxPreviewSource.includes('repairRequested'))

  const routeAuthoritySource = readFileSync('src/app/services/routeAuthority/routeAuthorityService.ts', 'utf8')
  assert(routeAuthoritySource.includes('static_candidate_not_authority'))
  assert(routeAuthoritySource.includes('provider_shadow_not_authority'))

  return [
    'LEGITIMATE CURRENT PATH: sessionStore can retain scoredVenues for Application state, but it is not the authoritative role-competition evidence carrier.',
    'LEGITIMATE CURRENT PATH: buildEngineDebugSnapshot displays strongest/summary diagnostics; it does not repair support-role zero truth.',
    'COMPATIBILITY PATH - STILL REQUIRED: sandbox preview repair remains preview-scoped compatibility debt and must not be used as A6 evidence.',
    'COMPATIBILITY PATH - STILL REQUIRED: routeAuthority rejects static/provider-shadow/candidate-draft authority and cannot populate support-role competition.',
  ]
}

function stable(result: A6ProofResult): string {
  return JSON.stringify({
    candidateRows: result.candidateRows,
    aggregateChecks: result.aggregateChecks,
    carrierFindings: result.carrierFindings,
    limitations: result.limitations,
  })
}

async function runOnce(): Promise<A6ProofResult> {
  const upstream = await runUpstreamRejectedCase()
  const roleCompetition = runRoleCompetitionCase()
  const noSourced = runNoSourcedCase()
  const candidateRows = [...upstream.rows, ...roleCompetition.rows]
  const aggregateChecks = [
    ...roleCompetition.aggregateChecks,
    ...noSourced.aggregateChecks,
    {
      scenario: 'upstream-rejected',
      aggregate: 'upstream rejected provider rows',
      productionAggregate: upstream.rows.length,
      recomputedFromRows: upstream.rows.length,
      match: true,
      missingEvidence:
        'role assignment beyond source query intent is unavailable because rejected candidates never reach role-pool competition',
    },
  ]
  assert(
    aggregateChecks.some((check) => check.match === 'unrecomputable'),
    'A6 proof must preserve the honest aggregate/row reconstruction limitation',
  )
  assert(
    candidateRows.some((row) => row.competitionState.includes('non_strongest')),
    'non-strongest candidate continuity limitation must be observable',
  )
  assert(
    candidateRows.some((row) => row.firstZeroOrRemovalStage === 'role-pool'),
    'scored-but-not-role-pool limitation must be observable',
  )

  return {
    judgment,
    providerCallsAttempted: upstream.providerCallsConsumed,
    fieldProxyCalls: upstream.fieldProxyCalls,
    candidateRows,
    aggregateChecks,
    carrierFindings: assertCarrierSourceShapes(),
    residueFindings: assertResidueGuards(),
    limitations: [
      'Complete support-role candidate rows do not survive in RoleCompetitionDiagnostics.',
      'LiveAttritionTrace cannot identify candidate-level first-zero/removal stage from its own retained evidence.',
      'RolePoolDiagnostics exposes rolePoolCandidateIds and summary counts but not full identity/provenance/Bearings/loss-owner rows.',
      'Scored-but-not-role-pool candidates can be characterized only by comparing scoredVenues to RolePools, not by reading a retained production exclusion row.',
      'Strongest-candidate evidence is useful but cannot stand in for non-winning/non-strongest support-role candidates.',
    ],
  }
}

async function run(): Promise<void> {
  const first = await runOnce()
  const second = await runOnce()
  assert.equal(first.providerCallsAttempted, 0)
  assert.equal(second.providerCallsAttempted, 0)
  assert.equal(stable(first), stable(second))
  console.log(JSON.stringify(first, null, 2))
  console.log('A6 support-role zero evidence characterization: PASS')
  console.log(`judgment=${first.judgment}`)
  console.log(`providerCallsAttempted=${first.providerCallsAttempted}`)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
