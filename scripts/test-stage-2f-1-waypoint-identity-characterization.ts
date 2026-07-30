import { buildRolePools, type RolePools } from '../src/domain/arc/buildRolePools.ts'
import { assembleArcCandidates } from '../src/domain/arc/assembleArcCandidates.ts'
import { getInvalidArcCombinationReasons, isValidArcCombination } from '../src/domain/arc/isValidArcCombination.ts'
import { scoreArcAssembly } from '../src/domain/arc/scoreArcAssembly.ts'
import {
  getArcStopBaseVenueId,
  getArcStopCandidateId,
  getScoredVenueBaseVenueId,
  getScoredVenueCandidateId,
} from '../src/domain/candidates/candidateIdentity.ts'
import { computeRefinementDelta } from '../src/domain/refinement/computeRefinementDelta.ts'
import { findTargetedRefinementCandidates } from '../src/domain/refinement/findTargetedRefinementCandidates.ts'
import { buildExperienceLens } from '../src/domain/intent/buildExperienceLens.ts'
import { getCrewPolicy } from '../src/domain/intent/getCrewPolicy.ts'
import { scoreVenueCollection } from '../src/domain/retrieval/scoreVenueFit.ts'
import { runGeneratePlan } from '../src/domain/runGeneratePlan.ts'
import { sanJoseVenues } from '../src/data/venues.ts'
import type { ArcCandidate, ArcStop, ScoredVenue } from '../src/domain/types/arc.ts'
import type { CrewPolicy } from '../src/domain/types/crewPolicies.ts'
import type { ExperienceLens } from '../src/domain/types/experienceLens.ts'
import type { IntentInput, IntentProfile } from '../src/domain/types/intent.ts'
import type { UserStopRole } from '../src/domain/types/itinerary.ts'
import type { RefinementDirective } from '../src/domain/refinement/getRefinementDirective.ts'
import type { InternalRole, Venue } from '../src/domain/types/venue.ts'

type Mode = 'build' | 'curate' | 'surprise'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const originalFetch = globalThis.fetch
let fetchCallCount = 0
globalThis.fetch = (async (input) => {
  fetchCallCount += 1
  throw new Error(`Stage 2F-1 closed-valve characterization must not call fetch: ${String(input)}`)
}) as typeof fetch

const roleOrder: InternalRole[] = ['warmup', 'peak', 'wildcard', 'cooldown']
const lensRoleOrder = ['start', 'highlight', 'surprise', 'windDown'] as const

function roleRecord(defaultValue: number, override?: Partial<Record<InternalRole, number>>): Record<InternalRole, number> {
  return {
    warmup: override?.warmup ?? defaultValue,
    peak: override?.peak ?? defaultValue,
    wildcard: override?.wildcard ?? defaultValue,
    cooldown: override?.cooldown ?? defaultValue,
  }
}

function lensRoleRecord(
  defaultValue: number,
  override?: Partial<Record<(typeof lensRoleOrder)[number], number>>,
): Record<(typeof lensRoleOrder)[number], number> {
  return {
    start: override?.start ?? defaultValue,
    highlight: override?.highlight ?? defaultValue,
    surprise: override?.surprise ?? defaultValue,
    windDown: override?.windDown ?? defaultValue,
  }
}

const crewPolicy = getCrewPolicy('socialite') as unknown as CrewPolicy

function intent(mode: Mode, anchor?: { venueId: string; role: UserStopRole }): IntentProfile {
  return {
    mode,
    planningMode: anchor ? 'user-led' : 'system-led',
    anchor,
    persona: 'socialite',
    primaryAnchor: 'lively',
    primaryVibe: 'lively',
    city: 'San Jose',
    neighborhood: 'Downtown',
    district: 'Downtown',
    distanceMode: 'nearby',
    budget: '$$',
    discoveryPreferences: anchor ? [{ venueId: anchor.venueId, role: anchor.role }] : [],
  } as unknown as IntentProfile
}

const lens = buildExperienceLens({ intent: intent('build') }) as unknown as ExperienceLens

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
        score: 0.82,
        strength: 'none',
        satisfied: true,
        label: `${role} contract`,
        role,
        reasons: [],
      },
    ]),
  ) as ScoredVenue['roleContract']
}

function venue(params: {
  id: string
  name: string
  category?: string
  providerRecordId?: string
  energyLevel?: number
  latitude?: number
  longitude?: number
}): Venue {
  return {
    id: params.id,
    name: params.name,
    city: 'San Jose',
    neighborhood: 'Downtown',
    category: params.category ?? 'bar',
    subcategory: 'cocktail-bar',
    tags: ['social', 'local', 'conversation'],
    useCases: ['socialite'],
    vibeTags: ['warm', 'lively'],
    energyLevel: params.energyLevel ?? 3,
    socialDensity: 0.64,
    uniquenessScore: 0.58,
    priceTier: '$$',
    driveMinutes: 8,
    distinctivenessScore: 0.62,
    underexposureScore: 0.44,
    shareabilityScore: 0.58,
    isChain: false,
    localSignals: {
      localFavoriteScore: 0.62,
      neighborhoodPrideScore: 0.6,
      repeatVisitorScore: 0.55,
    },
    roleAffinity: {
      warmup: 0.78,
      peak: 0.76,
      wildcard: 0.7,
      cooldown: 0.72,
    },
    shortDescription: `${params.name} fixture`,
    narrativeFlavor: `${params.name} characterization fixture`,
    imageUrl: '',
    isHiddenGem: false,
    isActive: true,
    highlightCapable: true,
    durationProfile: {
      durationClass: 'medium',
      estimatedMinutes: 45,
    },
    settings: {
      indoor: true,
      outdoor: false,
      reservationFriendly: false,
      groupFriendly: true,
      conversationFriendly: true,
      lateNight: true,
    },
    signature: {
      liveMusic: false,
      craftCocktails: true,
      scenicView: false,
      artForward: false,
      localInstitution: false,
      interactive: false,
    },
    source: {
      sourceOrigin: params.providerRecordId ? 'live' : 'curated',
      provider: params.providerRecordId ? 'google_places' : undefined,
      providerRecordId: params.providerRecordId,
      sourceTypes: [params.category ?? 'bar'],
      formattedAddress: '100 Test Way, San Jose, CA',
      latitude: params.latitude ?? 37.332,
      longitude: params.longitude ?? -121.889,
    },
  } as unknown as Venue
}

function scoredCandidate(params: {
  rawVenueId: string
  candidateId: string
  baseVenueId: string
  name: string
  kind?: ScoredVenue['candidateIdentity']['kind']
  category?: string
  roleScores?: Partial<Record<InternalRole, number>>
  providerRecordId?: string
  energyLevel?: number
  momentIntensityScore?: number
  parentPlaceId?: string
  activationType?: ScoredVenue['candidateIdentity']['activationType']
  momentId?: string
}): ScoredVenue {
  return {
    candidateIdentity: {
      candidateId: params.candidateId,
      baseVenueId: params.baseVenueId,
      kind: params.kind ?? 'base',
      activationType: params.activationType,
      momentId: params.momentId,
      parentPlaceId: params.parentPlaceId,
      traceLabel: params.name,
    },
    venue: venue({
      id: params.rawVenueId,
      name: params.name,
      category: params.category,
      providerRecordId: params.providerRecordId,
      energyLevel: params.energyLevel,
    }),
    momentIdentity: {
      type: params.kind === 'moment' ? 'anchor' : 'none',
      strength: params.kind === 'moment' ? 'strong' : 'none',
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
    lensCompatibility: 0.76,
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
    stopShapeFit: lensRoleRecord(0.76),
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
      validityLevel: 'valid',
      packLiteralRequirementSatisfied: true,
      personaVetoes: [],
      contextVetoes: [],
      violations: [],
    },
    roleScores: roleRecord(0.74, params.roleScores),
    taste: {
      signals: {
        energy: (params.energyLevel ?? 3) / 5,
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
        venuePersonality: {
          tags: ['social', 'lingering'],
        },
        roleSuitability: {
          start: 0.72,
          highlight: 0.74,
          surprise: 0.66,
          windDown: 0.68,
        },
        momentIntensity: {
          score: params.momentIntensityScore ?? (params.kind === 'moment' ? 0.78 : 0.58),
          tier:
            (params.momentIntensityScore ?? (params.kind === 'moment' ? 0.78 : 0.58)) >= 0.6
              ? 'strong'
              : 'standard',
          drivers: [],
        },
        momentPotential: {
          score: params.kind === 'moment' ? 0.8 : 0.62,
          source: 'inferred',
          tier: params.kind === 'moment' ? 'strong' : 'standard',
          drivers: [],
        },
        momentIdentity: {
          type: params.kind === 'moment' ? 'anchor' : 'linger',
          strength: params.kind === 'moment' ? 'strong' : 'medium',
        },
        momentTier: params.kind === 'moment' ? 'anchor' : 'support',
        momentEnrichment: {
          temporalEnergy: 0.2,
          socialEnergy: 0.3,
          ambientUniqueness: 0.25,
          culturalDepth: 0.2,
          highlightSurfaceBoost: 0.2,
          signals: [],
        },
        hyperlocalActivation: {
          activationTypes: params.kind === 'hyperlocal_activation' ? ['ambient_activation'] : [],
          temporalRelevance: params.kind === 'hyperlocal_activation' ? 0.5 : 0,
          temporalLabel: params.kind === 'hyperlocal_activation' ? 'active' : 'background',
          recurrenceShape: 'ambient',
          intensityContribution: params.kind === 'hyperlocal_activation' ? 0.3 : 0,
          contractCompatibilityHints: [],
          interpretationImpact: {
            highlightSuitability: params.kind === 'hyperlocal_activation' ? 0.2 : 0,
            momentPotential: params.kind === 'hyperlocal_activation' ? 0.2 : 0,
            novelty: params.kind === 'hyperlocal_activation' ? 0.2 : 0,
            momentIntensity: params.kind === 'hyperlocal_activation' ? 0.2 : 0,
            familyRefinements: [],
          },
          temporalCompatibility: {
            timePresenceState: params.kind === 'hyperlocal_activation' ? 'implicit' : 'none',
            roleAdjustments: {
              warmup: 0,
              peak: params.kind === 'hyperlocal_activation' ? 0.05 : 0,
              wildcard: params.kind === 'hyperlocal_activation' ? 0.08 : 0,
              cooldown: 0,
            },
            materiallyChangesViability: false,
            signals: [],
          },
          signals: [],
          materiallyChangesHighlightPotential: params.kind === 'hyperlocal_activation',
          materiallyChangesInterpretation: params.kind === 'hyperlocal_activation',
        },
        anchorStrength: 0.66,
        primaryExperienceArchetype: 'social',
        baseExperienceFamily: 'social',
        experienceFamily: 'social',
        experienceFamilyExpanded: false,
        momentElevationPotential: params.kind === 'moment' ? 0.2 : 0,
        isElevatedMomentCandidate: params.kind === 'moment',
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

function snapshotCandidate(candidate: ScoredVenue) {
  return {
    candidateId: getScoredVenueCandidateId(candidate),
    baseVenueId: getScoredVenueBaseVenueId(candidate),
    rawVenueId: candidate.venue.id,
    kind: candidate.candidateIdentity.kind,
    providerRecordId: candidate.venue.source.providerRecordId,
  }
}

function snapshotPools(pools: RolePools) {
  return {
    warmup: pools.warmup.map(snapshotCandidate),
    peak: pools.peak.map(snapshotCandidate),
    wildcard: pools.wildcard.map(snapshotCandidate),
    cooldown: pools.cooldown.map(snapshotCandidate),
  }
}

function snapshotArc(candidate: ArcCandidate | undefined) {
  return candidate
    ? {
        id: candidate.id,
        totalScore: Number(candidate.totalScore.toFixed(4)),
        stops: candidate.stops.map((stop) => ({
          role: stop.role,
          candidateId: getArcStopCandidateId(stop),
          baseVenueId: getArcStopBaseVenueId(stop),
          rawVenueId: stop.scoredVenue.venue.id,
        })),
      }
    : null
}

function snapshotArcSemantic(candidate: ArcCandidate | undefined) {
  if (!candidate) {
    return null
  }
  return {
    totalScore: Number(candidate.totalScore.toFixed(4)),
    stops: candidate.stops.map((stop) => ({
      role: stop.role,
      candidateId: getArcStopCandidateId(stop),
      baseVenueId: getArcStopBaseVenueId(stop),
      rawVenueId: stop.scoredVenue.venue.id,
    })),
  }
}

function arcStop(role: InternalRole, scoredVenue: ScoredVenue): ArcStop {
  return { role, scoredVenue }
}

function arc(id: string, stops: ArcStop[]): ArcCandidate {
  const scored = scoreArcAssembly(stops, intent('build'), crewPolicy, lens)
  return {
    id,
    stops,
    totalScore: scored.totalScore,
    scoreBreakdown: scored.scoreBreakdown,
    pacing: scored.pacing,
    spatial: scored.spatial,
    hasWildcard: stops.some((stop) => stop.role === 'wildcard'),
  }
}

function runAssemblyCase(label: string, inputCandidates: ScoredVenue[], caseIntent = intent('build')) {
  const pools = buildRolePools(inputCandidates, crewPolicy, lens, caseIntent)
  const assembled = assembleArcCandidates(inputCandidates, caseIntent, crewPolicy, lens, pools)
  const first = assembled.candidates[0]
  return {
    label,
    input: inputCandidates.map(snapshotCandidate),
    pools: snapshotPools(pools),
    assembledCount: assembled.candidates.length,
    assembledArcs: assembled.candidates.map(snapshotArc),
    semanticArcs: assembled.candidates.map(snapshotArcSemantic),
    firstArc: snapshotArc(first),
    firstArcSemantic: snapshotArcSemantic(first),
    anchorTrace: assembled.anchorTrace,
    surpriseDiagnostics: assembled.surpriseDiagnostics,
  }
}

function stable(value: unknown): string {
  return JSON.stringify(value)
}

function comparableArc(value: ReturnType<typeof snapshotArc>) {
  if (!value) {
    return value
  }
  return {
    totalScore: value.totalScore,
    stops: value.stops,
  }
}

function semanticCaseProjection(value: ReturnType<typeof runAssemblyCase>) {
  return {
    pools: value.pools,
    assembledCount: value.assembledCount,
    semanticArcs: value.semanticArcs,
    firstArcSemantic: value.firstArcSemantic,
    anchorTrace: value.anchorTrace
      ? {
          anchorRole: value.anchorTrace.anchorRole,
          anchorVenueId: value.anchorTrace.anchorVenueId,
          preValidationAnchorArcCount: value.anchorTrace.preValidationAnchorArcCount,
          postValidationAnchorArcCount: value.anchorTrace.postValidationAnchorArcCount,
          invalidatedAnchorArcCount: value.anchorTrace.invalidatedAnchorArcCount,
          invalidatedAnchorArcReasons: value.anchorTrace.invalidatedAnchorArcReasons,
        }
      : undefined,
    surpriseDiagnostics: value.surpriseDiagnostics,
  }
}

function sameStable(left: unknown, right: unknown): boolean {
  return stable(left) === stable(right)
}

function sameIgnoringOrder(left: unknown[], right: unknown[]): boolean {
  return sameStable(left.map(stable).sort(), right.map(stable).sort())
}

function compareRolePools(
  left: ReturnType<typeof snapshotPools>,
  right: ReturnType<typeof snapshotPools>,
) {
  return Object.fromEntries(
    roleOrder.map((role) => [
      role,
      {
        orderSame: sameStable(left[role], right[role]),
        membershipSameIgnoringOrder: sameIgnoringOrder(left[role], right[role]),
        left: left[role],
        right: right[role],
      },
    ]),
  )
}

const baseAlpha = scoredCandidate({
  rawVenueId: 'venue-alpha',
  candidateId: 'candidate:venue-alpha',
  baseVenueId: 'base-alpha',
  name: 'Alpha Lounge',
  energyLevel: 2,
  roleScores: { warmup: 0.92, peak: 0.84, cooldown: 0.7 },
})
const momentAlpha = scoredCandidate({
  rawVenueId: 'moment-alpha-raw',
  candidateId: 'moment::alpha-live-music',
  baseVenueId: 'base-alpha',
  name: 'Alpha Live Music Moment',
  kind: 'moment',
  parentPlaceId: 'base-alpha',
  momentId: 'alpha-live-music',
  roleScores: { peak: 0.94, wildcard: 0.85, warmup: 0.64, cooldown: 0.62 },
})
const activationAlpha = scoredCandidate({
  rawVenueId: 'activation-alpha-raw',
  candidateId: 'activation::alpha-night-market',
  baseVenueId: 'base-alpha',
  name: 'Alpha Night Market Activation',
  kind: 'hyperlocal_activation',
  parentPlaceId: 'base-alpha',
  activationType: 'event',
  roleScores: { wildcard: 0.94, peak: 0.82, warmup: 0.62, cooldown: 0.6 },
})
const baseBeta = scoredCandidate({
  rawVenueId: 'venue-beta',
  candidateId: 'candidate:venue-beta',
  baseVenueId: 'base-beta',
  name: 'Beta Social Hall',
  category: 'live_music',
  energyLevel: 5,
  momentIntensityScore: 0.72,
  roleScores: { peak: 0.9, warmup: 0.72, cooldown: 0.68 },
})
const baseGamma = scoredCandidate({
  rawVenueId: 'venue-gamma',
  candidateId: 'candidate:venue-gamma',
  baseVenueId: 'base-gamma',
  name: 'Gamma Dessert Bar',
  category: 'dessert',
  energyLevel: 2,
  roleScores: { cooldown: 0.92, warmup: 0.72, peak: 0.64 },
})
const similarDistinct = scoredCandidate({
  rawVenueId: 'venue-alpha-similar',
  candidateId: 'candidate:venue-alpha-similar',
  baseVenueId: 'base-alpha-distinct-address',
  name: 'Alpha Lounge',
  roleScores: { warmup: 0.88, peak: 0.82, cooldown: 0.72 },
})
const providerProvenance = scoredCandidate({
  rawVenueId: 'admitted-provider-only-venue',
  candidateId: 'candidate:admitted-provider-only-venue',
  baseVenueId: 'venue_physical.v1.city=san-jose.address=100-test-way.discriminator=none',
  name: 'Provider Provenance Cafe',
  category: 'cafe',
  providerRecordId: 'live_google_ChIJ-provider-only-fixture',
  roleScores: { warmup: 0.86, cooldown: 0.78 },
})

async function runPublicGeneration(mode: Mode) {
  const input: IntentInput = {
    mode,
    persona: 'romantic',
    primaryAnchor: mode === 'surprise' ? 'adventurous-urban' : 'cozy',
    primaryVibe: mode === 'surprise' ? 'adventurous-urban' : 'cozy',
    city: 'San Jose',
    district: 'Downtown',
    distanceMode: 'nearby',
    planningMode: mode === 'build' ? 'user-led' : undefined,
    anchor:
      mode === 'build'
        ? {
            venueId: 'sj-haberdasher',
            role: 'highlight',
          }
        : undefined,
  } as IntentInput
  try {
    const result = await runGeneratePlan(input, {
      seedVenues: sanJoseVenues.slice(0, 24),
      sourceMode: 'curated',
      sourceModeOverrideApplied: true,
      debugMode: false,
    })
    return {
      mode,
      status: 'selected' as const,
      selectedArcId: result.selectedArc.id,
      selectedStopCount: result.selectedArc.stops.length,
      selectedStops: result.selectedArc.stops.map((stop) => ({
        role: stop.role,
        candidateId: getArcStopCandidateId(stop),
        baseVenueId: getArcStopBaseVenueId(stop),
        rawVenueId: stop.scoredVenue.venue.id,
      })),
      traceHasRolePools: Boolean(result.trace.rolePools),
      traceHasArcAssembly: Boolean(result.trace.arcAssembly),
    }
  } catch (error) {
    const typed = error as {
      message?: string
      greatStopGateSelectionDiagnostics?: {
        status?: string
        stage?: string
        failureReasons?: string[]
        structuralFailureReasons?: string[]
      }
    }
    return {
      mode,
      status: 'failed_before_selection' as const,
      message: typed.message ?? String(error),
      gateStatus: typed.greatStopGateSelectionDiagnostics?.status,
      gateStage: typed.greatStopGateSelectionDiagnostics?.stage,
      failureReasons:
        typed.greatStopGateSelectionDiagnostics?.failureReasons ??
        typed.greatStopGateSelectionDiagnostics?.structuralFailureReasons ??
        [],
    }
  }
}

async function runPublicBuildAnchorCase(params: {
  label: string
  anchorVenueId: string
  role: UserStopRole
  primaryVibe?: string
  secondaryVibe?: string
  district?: string
  distanceMode?: string
}) {
  const input: IntentInput = {
    mode: 'build',
    planningMode: 'user-led',
    persona: 'romantic',
    primaryAnchor: params.primaryVibe ?? 'cozy',
    primaryVibe: params.primaryVibe ?? 'cozy',
    secondaryVibe: params.secondaryVibe,
    city: 'San Jose',
    district: params.district ?? 'Little Portugal',
    distanceMode: params.distanceMode ?? 'short-drive',
    anchor: {
      venueId: params.anchorVenueId,
      role: params.role,
    },
    discoveryPreferences: [
      {
        venueId: params.anchorVenueId,
        role: params.role,
      },
    ],
  } as IntentInput
  try {
    const result = await runGeneratePlan(input, {
      seedVenues: sanJoseVenues,
      sourceMode: 'curated',
      sourceModeOverrideApplied: true,
      debugMode: false,
    })
    const anchorStop = result.selectedArc.stops.find(
      (stop) => getArcStopBaseVenueId(stop) === params.anchorVenueId,
    )
    return {
      label: params.label,
      status: 'selected' as const,
      requiredAnchorValue: params.anchorVenueId,
      requiredAnchorRole: params.role,
      anchorSurvived: Boolean(anchorStop),
      anchorStop: anchorStop
        ? {
            role: anchorStop.role,
            candidateId: getArcStopCandidateId(anchorStop),
            baseVenueId: getArcStopBaseVenueId(anchorStop),
            rawVenueId: anchorStop.scoredVenue.venue.id,
            kind: anchorStop.scoredVenue.candidateIdentity.kind,
          }
        : null,
      selectedArcId: result.selectedArc.id,
      selectedArcSemantic: snapshotArcSemantic(result.selectedArc),
      selectedStops: result.selectedArc.stops.map((stop) => ({
        role: stop.role,
        candidateId: getArcStopCandidateId(stop),
        baseVenueId: getArcStopBaseVenueId(stop),
        rawVenueId: stop.scoredVenue.venue.id,
        kind: stop.scoredVenue.candidateIdentity.kind,
      })),
      lastProductionBoundary: 'selected_arc_candidate',
      failurePoint: null,
      failureReasons: [],
    }
  } catch (error) {
    const typed = error as {
      message?: string
      greatStopGateSelectionDiagnostics?: {
        status?: string
        stage?: string
        failureReasons?: string[]
        structuralFailureReasons?: string[]
      }
    }
    return {
      label: params.label,
      status: 'failed_before_selection' as const,
      requiredAnchorValue: params.anchorVenueId,
      requiredAnchorRole: params.role,
      anchorSurvived: false,
      anchorStop: null,
      selectedArcId: null,
      selectedArcSemantic: null,
      selectedStops: [],
      lastProductionBoundary: typed.greatStopGateSelectionDiagnostics?.stage ?? 'unknown',
      failurePoint: typed.message ?? String(error),
      failureReasons:
        typed.greatStopGateSelectionDiagnostics?.failureReasons ??
        typed.greatStopGateSelectionDiagnostics?.structuralFailureReasons ??
        [],
    }
  }
}

try {
  const scoredReachability = scoreVenueCollection(
    [baseAlpha.venue, baseBeta.venue, baseGamma.venue],
    intent('build'),
    crewPolicy,
    lens,
  )
  const scoredReachabilityPools = buildRolePools(scoredReachability, crewPolicy, lens, intent('build'))
  const scoredReachabilityAssembly = assembleArcCandidates(
    scoredReachability,
    intent('build'),
    crewPolicy,
    lens,
    scoredReachabilityPools,
  )

  const matrix = [
    runAssemblyCase('base_only', [baseAlpha, baseBeta, baseGamma]),
    runAssemblyCase('base_plus_moment_same_base', [baseAlpha, momentAlpha, baseBeta, baseGamma]),
    runAssemblyCase('base_plus_activation_same_base', [baseAlpha, activationAlpha, baseBeta, baseGamma]),
    runAssemblyCase('base_plus_moment_plus_activation_same_base', [
      baseAlpha,
      momentAlpha,
      activationAlpha,
      baseBeta,
      baseGamma,
    ]),
    runAssemblyCase('presentation_similar_distinct_baseVenueIds', [
      baseAlpha,
      similarDistinct,
      baseBeta,
      baseGamma,
    ]),
    runAssemblyCase(
      'required_build_anchor_wrapper',
      [baseAlpha, momentAlpha, baseBeta, baseGamma],
      intent('build', { venueId: 'base-alpha', role: 'highlight' }),
    ),
    runAssemblyCase(
      'required_build_anchor_base',
      [baseAlpha, baseBeta, baseGamma],
      intent('build', { venueId: 'base-alpha', role: 'start' }),
    ),
    runAssemblyCase('same_physical_venue_in_multiple_role_pools', [
      baseAlpha,
      momentAlpha,
      activationAlpha,
      baseBeta,
      baseGamma,
    ]),
    runAssemblyCase('distinct_wrappers_competing_for_different_roles', [
      momentAlpha,
      activationAlpha,
      baseBeta,
      baseGamma,
    ]),
    runAssemblyCase('provider_source_identity_provenance_only', [
      providerProvenance,
      baseBeta,
      baseGamma,
    ]),
  ]

  const duplicateStops = [
    arcStop('warmup', baseAlpha),
    arcStop('peak', momentAlpha),
    arcStop('cooldown', baseGamma),
  ]
  const distinctStops = [
    arcStop('warmup', baseAlpha),
    arcStop('peak', baseBeta),
    arcStop('cooldown', baseGamma),
  ]
  const duplicateReasons = getInvalidArcCombinationReasons(duplicateStops, intent('build'), crewPolicy, lens)
  const duplicateValid = isValidArcCombination(duplicateStops, intent('build'), crewPolicy, lens)
  const distinctReasons = getInvalidArcCombinationReasons(distinctStops, intent('build'), crewPolicy, lens)
  const distinctValid = isValidArcCombination(distinctStops, intent('build'), crewPolicy, lens)
  assert(!duplicateValid, 'Same physical baseVenueId must be rejected by isValidArcCombination.')
  assert(
    duplicateReasons.includes('duplicate_venue'),
    'Same physical baseVenueId rejection must report duplicate_venue.',
  )

  const repeatedOriginal = runAssemblyCase('repeat_original', [
    baseAlpha,
    momentAlpha,
    activationAlpha,
    baseBeta,
    baseGamma,
    similarDistinct,
  ])
  const repeatedAgain = runAssemblyCase('repeat_again', [
    baseAlpha,
    momentAlpha,
    activationAlpha,
    baseBeta,
    baseGamma,
    similarDistinct,
  ])
  const repeatedSemanticProjection = semanticCaseProjection(repeatedOriginal)
  const repeatedAgainSemanticProjection = semanticCaseProjection(repeatedAgain)
  const repeatedSemanticEqual = sameStable(repeatedSemanticProjection, repeatedAgainSemanticProjection)
  const repeatedGeneratedArcIds = repeatedOriginal.assembledArcs.map((candidate) => candidate?.id)
  const repeatedAgainGeneratedArcIds = repeatedAgain.assembledArcs.map((candidate) => candidate?.id)
  const repeatedGeneratedArcIdsStable = sameStable(repeatedGeneratedArcIds, repeatedAgainGeneratedArcIds)
  assert(
    repeatedSemanticEqual,
    'Identical Stage 2F-1 fixture input must preserve deterministic semantic projection.',
  )

  const reversed = runAssemblyCase('reversed_input_order', [
    similarDistinct,
    baseGamma,
    baseBeta,
    activationAlpha,
    momentAlpha,
    baseAlpha,
  ])
  const reversedSemanticProjection = semanticCaseProjection(reversed)
  const forwardReverseComparison = {
    rolePoolComparison: compareRolePools(repeatedOriginal.pools, reversed.pools),
    rolePoolOrderSame: sameStable(repeatedOriginal.pools, reversed.pools),
    rolePoolMembershipSameIgnoringOrder: roleOrder.every((role) =>
      sameIgnoringOrder(repeatedOriginal.pools[role], reversed.pools[role]),
    ),
    assembledArcSemanticOrderSame: sameStable(repeatedOriginal.semanticArcs, reversed.semanticArcs),
    assembledArcSemanticMembershipSameIgnoringOrder: sameIgnoringOrder(
      repeatedOriginal.semanticArcs,
      reversed.semanticArcs,
    ),
    firstArcSemanticSame: sameStable(repeatedOriginal.firstArcSemantic, reversed.firstArcSemantic),
    generatedArcIdsSame: sameStable(
      repeatedOriginal.assembledArcs.map((candidate) => candidate?.id),
      reversed.assembledArcs.map((candidate) => candidate?.id),
    ),
    classification: 'semantic_equivalence_for_selected_route_with_input_order_sensitive_pool_and_arc_membership_characterized',
  }

  const currentArc = arc('current', [
    arcStop('warmup', baseAlpha),
    arcStop('peak', baseBeta),
    arcStop('cooldown', baseGamma),
  ])
  const nextSamePhysicalDifferentWrapper = arc('next-same-physical-different-wrapper', [
    arcStop('warmup', momentAlpha),
    arcStop('peak', baseBeta),
    arcStop('cooldown', baseGamma),
  ])
  const directive: RefinementDirective = {
    mode: 'more-exciting',
    minRoleScore: 0.1,
  } as RefinementDirective
  const targetedRefinement = findTargetedRefinementCandidates({
    role: 'start',
    currentArc,
    scoredVenues: [baseAlpha, momentAlpha, activationAlpha, baseBeta, baseGamma, similarDistinct],
    intent: intent('build'),
    directive,
  })
  const refinementDelta = computeRefinementDelta({
    requestedModes: ['more-exciting'],
    previousArc: currentArc,
    nextArc: nextSamePhysicalDifferentWrapper,
    nextStopExplainability: {},
  })

  const providerIds = [
    providerProvenance.venue.source.providerRecordId,
    providerProvenance.venue.id,
  ].filter(Boolean) as string[]
  assert(
    providerIds.every((value) => getScoredVenueBaseVenueId(providerProvenance) !== value),
    'Provider/source identity must not become physical baseVenueId.',
  )
  assert(
    getScoredVenueCandidateId(momentAlpha) !== getScoredVenueBaseVenueId(momentAlpha),
    'candidateId and baseVenueId must remain separately observable for wrappers.',
  )
  assert(
    getScoredVenueBaseVenueId(baseAlpha) !== getScoredVenueBaseVenueId(similarDistinct),
    'Presentation-similar distinct admitted identities must remain physically distinct.',
  )

  const weakBuildFixtureAnchor = 'sj-haberdasher'
  const weakBuildSeedVenues = sanJoseVenues.slice(0, 24)
  const weakBuildFixture = {
    label: 'prior_weak_build_fixture',
    requiredAnchorValue: weakBuildFixtureAnchor,
    seedVenueCount: weakBuildSeedVenues.length,
    anchorPresentInSeedVenues: weakBuildSeedVenues.some((venue) => venue.id === weakBuildFixtureAnchor),
    result: await runPublicGeneration('build'),
  }
  const buildBaseAnchor = await runPublicBuildAnchorCase({
    label: 'build_required_anchor_base_candidate',
    anchorVenueId: 'sj-haberdasher',
    role: 'windDown',
    primaryVibe: 'lively',
    district: 'Downtown',
    distanceMode: 'nearby',
  })
  const buildWrapperAnchor = await runPublicBuildAnchorCase({
    label: 'build_required_anchor_wrapper_candidate',
    anchorVenueId: 'sj-municipal-rose-garden-promenade',
    role: 'highlight',
    primaryVibe: 'cozy',
    secondaryVibe: 'lively',
    district: 'Rose Garden',
    distanceMode: 'short-drive',
  })
  const publicGeneration = [
    buildBaseAnchor,
    buildWrapperAnchor,
    await runPublicGeneration('curate'),
    await runPublicGeneration('surprise'),
  ]

  assert(fetchCallCount === 0, `Expected zero provider/hosted fetch calls, received ${fetchCallCount}.`)

  const output = {
    proof: 'stage-2f-1-waypoint-identity-characterization',
    status: 'PASS',
    traceExercised: {
      scoreVenueCollectionCandidateCount: scoredReachability.length,
      scoreVenueCollectionKinds: scoredReachability.map((candidate) => candidate.candidateIdentity.kind),
      buildRolePoolsReached: Object.fromEntries(
        roleOrder.map((role) => [role, scoredReachabilityPools[role].length]),
      ),
      assembleArcCandidatesReached: scoredReachabilityAssembly.candidates.length,
      scoreArcAssemblyReached: Number(scoreArcAssembly(distinctStops, intent('build'), crewPolicy, lens).totalScore.toFixed(4)),
      runGeneratePlanCasesReached: publicGeneration.map((item) => 'mode' in item ? item.mode : item.label),
    },
    buildReachability: {
      weakFixtureRootCause: weakBuildFixture,
      baseAnchor: buildBaseAnchor,
      wrapperAnchor: buildWrapperAnchor,
    },
    fixtureMatrix: matrix,
    contractAssertions: {
      providerSourceIdentityNotRouteBearing: true,
      distinctBaseVenueIdsRemainDistinct: true,
      physicalDuplicatePrevention: {
        duplicateValid,
        duplicateReasons,
        distinctValid,
        distinctReasons,
      },
      candidateIdAndBaseVenueIdObservable: true,
      deterministicRepeatedInput: true,
      providerFetchCalls: fetchCallCount,
    },
    generatedArcIdDeterminism: {
      owner: {
        idFactory: 'src/lib/ids.ts#createId',
        assemblyCallSites:
          'src/domain/arc/assembleArcCandidates.ts uses createId("arc"), createId("arc_partial"), and createId("arc_highlight_only") for ArcCandidate.id.',
        mintingMechanism: 'Date.now().toString(36) plus a module-local running counter.',
        semanticDedupeKey:
          'buildDiagnosticArcId(stops) uses role:getArcStopCandidateId(stop) and is separate from generated ArcCandidate.id.',
      },
      repeatedSemanticEqual,
      repeatedGeneratedArcIdsStable,
      repeatedGeneratedArcIds,
      repeatedAgainGeneratedArcIds,
      semanticSignificance:
        repeatedSemanticEqual && !repeatedGeneratedArcIdsStable
          ? 'generated_container_id_unstable_but_semantic_stage_2f_1_projection_stable_in_repeat_fixture'
          : 'review_required',
    },
    characterizationOnly: {
      reversedInputOrder: {
        semanticProjectionSameAsOriginal: sameStable(repeatedSemanticProjection, reversedSemanticProjection),
        completeComparison: forwardReverseComparison,
        originalFirstArc: repeatedOriginal.firstArc,
        reversedFirstArc: reversed.firstArc,
        repeatedGeneratedArcIdsDiffer: !repeatedGeneratedArcIdsStable,
      },
      targetedRefinementRawVenueIdDependentExclusion: targetedRefinement.map((candidate) => ({
        candidate: snapshotCandidate(candidate.scoredVenue),
        objectiveDelta: candidate.objectiveDelta,
      })),
      refinementChangeAccountingRawVenueIdDependent: {
        changedStopCount: refinementDelta?.changedStopCount,
        stopDeltas: refinementDelta?.stopDeltas,
      },
      sameBaseWrapperSupportExclusion: {
        reachedViaAssemblyAndValidation: true,
        duplicateReasons,
        note:
          'Private getBestSupportStop and fallback support filters compare raw venue.id in code; direct helper output is not exported, so this proof records public assembly/validation effects and code-inspection reachability.',
      },
      runGeneratePlanPrivateRawIdSites: {
        publicModes: publicGeneration,
        note:
          'Private scoredVenueMatchesVenueId, arcStopMatchesVenueId, resolveAnchorVenueIdFromRetrieval, fallback support selection, baseline rehydration, and countChangedStops remain private; this proof reaches runGeneratePlan closed-valve public effects and characterizes targeted refinement/change accounting directly.',
      },
    },
    maskingAssessment: {
      staticCuratedFixturesAlreadyCanonical: true,
      applicationProjectionReached: false,
      routeAuthorityReached: false,
      artifactAuthorityReached: false,
      diagnosticsIncludeCandidateIdAndBaseVenueId: true,
      fallbackMayHideMismatch: 'characterized_only_not_asserted',
    },
  }

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
} finally {
  globalThis.fetch = originalFetch
}
