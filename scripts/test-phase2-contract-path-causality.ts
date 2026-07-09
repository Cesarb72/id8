import { buildApplicationConciergeIntent } from '../src/app/concierge/conciergeIntentAdapter.ts'
import {
  buildBuildCardTruthModel,
} from '../src/app/services/canonicalPublicRouteTruthService.ts'
import { evaluateBuildCandidateAdmission } from '../src/app/services/buildCandidateAdmission/buildCandidateAdmissionService.ts'
import { buildAnchorTruthContract } from '../src/domain/artifacts/buildAnchorTruthContract.ts'
import type { ContractEntryArtifact } from '../src/domain/artifacts/contractEntryArtifact.ts'
import type { RuntimeRouteArtifact, RuntimeRouteStop } from '../src/domain/artifacts/runtimeRouteArtifact.ts'
import {
  buildContractGateWorldFromCanonical,
  type ContractGateWorld,
} from '../src/domain/bearings/buildContractGateWorld.ts'
import {
  buildStrategyAdmissibleWorlds,
  type StrategyAdmissibleWorld,
} from '../src/domain/bearings/buildStrategyAdmissibleWorlds.ts'
import { buildCanonicalInterpretationBundle } from '../src/domain/interpretation/buildCanonicalInterpretationBundle.ts'
import {
  buildStopTypeCandidateBoardFromContract,
  buildStopTypeCandidateBoardFromIntent,
  type StopTypeCandidateBoard,
} from '../src/domain/interpretation/discovery/stopTypeCandidateBoard.ts'
import { buildLceRuntimeContract } from '../src/domain/lce/lceRuntimeContract.ts'
import { CLOSED_PREVIEW_LIVE_ENVELOPE } from '../src/domain/retrieval/liveEnvelope.ts'
import type { ArcCandidate, ArcStop } from '../src/domain/types/arc.ts'
import type {
  ConciergeIntent,
  ConciergeIntentCandidateLineage,
  IntentProfile,
  PersonaMode,
  PlanAnchor,
  VibeAnchor,
} from '../src/domain/types/intent.ts'
import type { UserStopRole } from '../src/domain/types/itinerary.ts'
import type { StarterPack } from '../src/domain/types/starterPack.ts'
import { buildDistrictOpportunityProfiles } from '../src/domain/interpretation/district/intelligence/buildDistrictOpportunityProfiles.ts'
import type { RankedPocket } from '../src/engines/district/types/districtTypes.ts'
import {
  rankArcCandidatesFromContract,
  rankArcCandidatesWithDiagnostics,
} from '../src/integrations/waypoint/rankArcCandidates.ts'

const originalFetch = globalThis.fetch
let fetchCallCount = 0

globalThis.fetch = (async () => {
  fetchCallCount += 1
  throw new Error('Phase 2 contract-path causality harness must not call fetch/providers.')
}) as typeof fetch

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const buildRouteIds = {
  start: 'sj-petiscos',
  highlight: 'sj-paper-plane',
  windDown: 'sj-hedley-club-lounge',
}

const curateGreenRouteIds = [
  'sj-willow-court-wine-bar',
  'sj-theatre-district-jazz-cellar',
  'sj-hedley-club-lounge',
] as const

function starterPack(params: {
  id: string
  title: string
  personaBias: PersonaMode
  primaryAnchor: VibeAnchor
  secondaryAnchors?: VibeAnchor[]
}): StarterPack {
  return {
    id: params.id,
    title: params.title,
    description: `${params.title} test starter`,
    personaBias: params.personaBias,
    primaryAnchor: params.primaryAnchor,
    secondaryAnchors: params.secondaryAnchors,
    distanceMode: 'nearby',
  }
}

function rankedPocket(params: {
  id: string
  label: string
  rank: number
  score: number
  radiusM: number
  categories: string[]
  tags: string[]
  seeds: string[]
  hospitalityMix: {
    drinks: number
    dining: number
    culture: number
    cafe: number
    activity: number
  }
  ambiance: {
    energy: 'low' | 'medium' | 'high'
    intimacy: 'low' | 'medium' | 'high'
    noise: 'low' | 'medium' | 'high'
  }
  momentPotential: number
  core?: Partial<RankedPocket['profile']['coreSignals']>
}): RankedPocket {
  const entityCount = params.core?.entityCount ?? 14
  return {
    rank: params.rank,
    score: params.score,
    baseScore: params.score,
    degradedPenaltyApplied: 0,
    reasons: ['phase2_contract_causality_fixture'],
    profile: {
      pocketId: params.id,
      label: params.label,
      centroid: { lat: 37.333, lng: -121.889 },
      radiusM: params.radiusM,
      entityCount,
      categories: params.categories,
      classification: 'viable',
      coreSignals: {
        entityCount,
        categoryDiversity: params.core?.categoryDiversity ?? 0.68,
        density: params.core?.density ?? 0.72,
        walkability: params.core?.walkability ?? 0.74,
        viability: params.core?.viability ?? 0.82,
      },
      tasteSignals: {
        experientialTags: params.tags,
        hospitalityMix: params.hospitalityMix,
        ambianceProfile: params.ambiance,
        momentSeeds: params.seeds,
        momentPotential: params.momentPotential,
      },
      score: {
        fieldScore: params.score,
        viabilityBonus: 0.05,
        totalScore: params.score,
      },
      meta: {
        vertical: 'hospitality',
        provenance: ['phase2_contract_causality_fixture'],
        generatedAtIso: '2026-06-27T00:00:00.000Z',
        identityKind: 'known_neighborhood',
        origin: 'primary',
        truthTier: 'primary',
        isDegradedFallback: false,
        fallbackPenaltyApplied: 0,
        clusteringSource: 'primary',
        originNotes: ['phase2_contract_causality_fixture'],
      },
    },
  }
}

function fixturePockets(): RankedPocket[] {
  return [
    rankedPocket({
      id: 'sofa-market',
      label: 'SoFA Market',
      rank: 1,
      score: 0.86,
      radiusM: 850,
      categories: ['restaurant', 'cocktail', 'music', 'lounge'],
      tags: ['date', 'cocktail', 'walkable', 'late'],
      seeds: ['dinner -> cocktails -> lounge'],
      hospitalityMix: {
        drinks: 0.82,
        dining: 0.72,
        culture: 0.32,
        cafe: 0.12,
        activity: 0.24,
      },
      ambiance: {
        energy: 'high',
        intimacy: 'medium',
        noise: 'medium',
      },
      momentPotential: 0.82,
    }),
    rankedPocket({
      id: 'arts-district',
      label: 'Arts District',
      rank: 2,
      score: 0.8,
      radiusM: 780,
      categories: ['museum', 'gallery', 'cafe', 'restaurant'],
      tags: ['arts', 'curated', 'gallery', 'learning'],
      seeds: ['gallery then cafe then reflective dinner'],
      hospitalityMix: {
        drinks: 0.24,
        dining: 0.48,
        culture: 0.9,
        cafe: 0.58,
        activity: 0.34,
      },
      ambiance: {
        energy: 'medium',
        intimacy: 'medium',
        noise: 'low',
      },
      momentPotential: 0.72,
    }),
    rankedPocket({
      id: 'family-reset-pocket',
      label: 'Family Reset Pocket',
      rank: 3,
      score: 0.78,
      radiusM: 620,
      categories: ['park', 'cafe', 'museum', 'restaurant'],
      tags: ['family', 'kid', 'stroller', 'friendly', 'reset'],
      seeds: ['play then reset then easy meal'],
      hospitalityMix: {
        drinks: 0.08,
        dining: 0.44,
        culture: 0.34,
        cafe: 0.52,
        activity: 0.58,
      },
      ambiance: {
        energy: 'medium',
        intimacy: 'medium',
        noise: 'low',
      },
      momentPotential: 0.66,
    }),
  ]
}

function nightlifeOnlyPocket(): RankedPocket[] {
  return [
    rankedPocket({
      id: 'nightlife-heavy-pocket',
      label: 'Nightlife Heavy Pocket',
      rank: 1,
      score: 0.78,
      radiusM: 1450,
      categories: ['bar', 'cocktail', 'club'],
      tags: ['nightlife', 'cocktail', 'late', 'loud'],
      seeds: ['late cocktails then club energy'],
      hospitalityMix: {
        drinks: 0.9,
        dining: 0.15,
        culture: 0.08,
        cafe: 0.02,
        activity: 0.05,
      },
      ambiance: {
        energy: 'high',
        intimacy: 'low',
        noise: 'high',
      },
      momentPotential: 0.36,
      core: {
        categoryDiversity: 0.28,
        density: 0.7,
        walkability: 0.3,
      },
    }),
  ]
}

function compatibilityIntent(params: {
  mode: 'surprise' | 'curate' | 'build'
  persona: PersonaMode
  primaryAnchor: VibeAnchor
  city?: string
}): IntentProfile {
  return {
    crew:
      params.persona === 'romantic'
        ? 'romantic'
        : params.persona === 'friends'
          ? 'socialite'
          : 'curator',
    persona: params.persona,
    primaryAnchor: params.primaryAnchor,
    city: params.city ?? 'San Jose',
    distanceMode: 'nearby',
    prefersHiddenGems: false,
    mode: params.mode,
    planningMode: params.mode === 'build' ? 'user-led' : 'engine-led',
  }
}

function buildChain(params: {
  mode: 'surprise' | 'curate' | 'build'
  persona: PersonaMode
  primaryVibe: VibeAnchor
  objectiveOccasion?: 'explore' | 'connect' | 'celebrate'
  starterPack?: StarterPack
  anchor?: PlanAnchor
  anchorDisplayName?: string
  candidateLineage?: ConciergeIntentCandidateLineage
  ranked?: RankedPocket[]
}): {
  conciergeIntent: ConciergeIntent
  contractGateWorld: ContractGateWorld
  strategyAdmissibleWorlds: StrategyAdmissibleWorld[]
} {
  const conciergeIntent = buildApplicationConciergeIntent({
    mode: params.mode,
    persona: params.persona,
    primaryVibe: params.primaryVibe,
    city: 'San Jose',
    objectiveOccasion: params.objectiveOccasion ?? (params.mode === 'surprise' ? 'explore' : 'connect'),
    starterPack: params.starterPack ?? null,
    anchor: params.anchor ?? null,
    anchorDisplayName: params.anchorDisplayName ?? null,
    candidateLineage: params.candidateLineage ?? null,
  })
  const canonicalInterpretationBundle = buildCanonicalInterpretationBundle({
    conciergeIntent,
    interpretationSource: 'scripts.test-phase2-contract-path-causality',
  })
  const contractGateWorld = buildContractGateWorldFromCanonical({
    canonicalInterpretationBundle,
    ranked: params.ranked ?? fixturePockets(),
    source: 'scripts.test-phase2-contract-path-causality',
  })
  const strategyAdmissibleWorlds = buildStrategyAdmissibleWorlds({ contractGateWorld })
  return {
    conciergeIntent,
    contractGateWorld,
    strategyAdmissibleWorlds,
  }
}

function arcStop(role: ArcStop['role'], venueId: string, energyLevel = 3): ArcStop {
  return {
    role,
    scoredVenue: {
      venue: {
        id: venueId,
        name: venueId,
        priceTier: '$$',
        driveMinutes: 4,
        energyLevel,
        uniquenessScore: 0.6,
      },
    },
  } as unknown as ArcStop
}

function arcCandidate(
  id: string,
  stopIds: readonly [string, string, string],
  totalScore: number,
): ArcCandidate {
  return {
    id,
    totalScore,
    stops: [
      arcStop('warmup', stopIds[0]),
      arcStop('peak', stopIds[1], 5),
      arcStop('cooldown', stopIds[2]),
    ],
    hasWildcard: false,
  } as unknown as ArcCandidate
}

function rankFromContract(params: {
  candidates: ArcCandidate[]
  chain: ReturnType<typeof buildChain>
  compatibility: IntentProfile
}) {
  const canonicalInterpretationBundle = buildCanonicalInterpretationBundle({
    conciergeIntent: params.chain.conciergeIntent,
    interpretationSource: 'scripts.test-phase2-contract-path-causality.waypoint',
  })
  return rankArcCandidatesFromContract(params.candidates, {
    canonicalInterpretationBundle,
    strategyAdmissibleWorlds: params.chain.strategyAdmissibleWorlds,
    requiredStopGuarantee: params.chain.contractGateWorld.requiredStopGuarantee,
    normalizedContext: {
      pacing: params.chain.conciergeIntent.experienceProfile.pacing,
      anchorPosture: params.chain.conciergeIntent.anchorPosture,
      objective: params.chain.conciergeIntent.objective,
      starterLineage: params.chain.conciergeIntent.starterLineage,
      anchorLineage: params.chain.conciergeIntent.anchorLineage,
      candidateLineage: params.chain.conciergeIntent.candidateLineage,
    },
    compatibilityIntent: params.compatibility,
    source: 'canonical_contract',
  })
}

function contractArtifact(params: {
  preserved: boolean
}): ContractEntryArtifact {
  const storySpine = params.preserved
    ? {
        start: 'Petiscos',
        highlight: 'Paper Plane',
        windDown: 'Hedley Club Lounge',
      }
    : {
        start: 'Heritage Tea House',
        highlight: 'Paper Plane',
        windDown: 'Jtown Matcha Kissaten',
      }
  const support = params.preserved
    ? [
        { role: 'start', name: 'Petiscos', venueId: buildRouteIds.start },
        { role: 'highlight', name: 'Paper Plane', venueId: buildRouteIds.highlight },
        { role: 'windDown', name: 'Hedley Club Lounge', venueId: buildRouteIds.windDown },
      ]
    : [
        { role: 'start', name: 'Heritage Tea House', venueId: 'sj-heritage-tea-house' },
        { role: 'highlight', name: 'Paper Plane', venueId: buildRouteIds.highlight },
        { role: 'windDown', name: 'Jtown Matcha Kissaten', venueId: 'sj-jtown-matcha-kissaten' },
      ]
  return {
    id: params.preserved ? 'contract_entry_generated_paper_plane' : 'contract_entry_drifted_paper_plane',
    sourceOpportunityId: 'step2_static_build_paper_plane',
    sourceMode: 'curated',
    anchorVenueId: buildRouteIds.highlight,
    anchorRole: 'highlight',
    anchorName: 'Paper Plane',
    routeTitle: 'Paper Plane',
    flavorLine: 'Cocktail-led downtown night',
    routeSummary: `${storySpine.start} to Paper Plane to ${storySpine.windDown}.`,
    traits: ['focused', 'reliable', 'standout'],
    storySpine,
    districtLine: 'Mostly in Downtown Pocket',
    districtAnchorLine: 'District anchor: Downtown',
    authorityLine: 'Paper Plane can hold the highlight role.',
    whyChooseLine: 'Short downtown movement with a high-confidence cocktail center.',
    selection: {
      directionId: 'downtown-paper-plane',
      pocketId: 'downtown',
    },
    enrichment: {
      canonicalRouteRoleCoverage: {
        ...storySpine,
        support,
      },
    },
  }
}

function runtimeStop(role: UserStopRole, venueId: string, stopIndex: number, displayName: string): RuntimeRouteStop {
  return {
    id: `${role}:${venueId}`,
    sourceStopId: `${role}:${venueId}`,
    displayName,
    latitude: 37.33,
    longitude: -121.89,
    address: '1 Test Way',
    role,
    stopIndex,
    venueId,
    title: displayName,
    subtitle: 'Downtown',
    neighborhood: 'Downtown',
    driveMinutes: 4,
    imageUrl: '/test.jpg',
  }
}

function runtimeRoute(params: { preserved: boolean; persona?: PersonaMode; vibe?: VibeAnchor }): RuntimeRouteArtifact {
  const stops = params.preserved
    ? [
        runtimeStop('start', buildRouteIds.start, 0, 'Petiscos'),
        runtimeStop('highlight', buildRouteIds.highlight, 1, 'Paper Plane'),
        runtimeStop('windDown', buildRouteIds.windDown, 2, 'Hedley Club Lounge'),
      ]
    : [
        runtimeStop('start', 'sj-heritage-tea-house', 0, 'Heritage Tea House'),
        runtimeStop('highlight', buildRouteIds.highlight, 1, 'Paper Plane'),
        runtimeStop('windDown', 'sj-jtown-matcha-kissaten', 2, 'Jtown Matcha Kissaten'),
      ]
  return {
    routeId: params.preserved ? 'runtime-paper-plane-preserved' : 'runtime-paper-plane-drifted',
    selectedDirectionId: 'downtown-paper-plane',
    location: 'San Jose',
    persona: params.persona ?? 'romantic',
    vibe: params.vibe ?? 'lively',
    stops,
    activeStopIndex: 0,
    routeHeadline: 'Paper Plane night',
    routeSummary: stops.map((stop) => stop.displayName).join(' to '),
    mapMarkers: stops.map((stop) => ({
      id: stop.id,
      displayName: stop.displayName,
      role: stop.role,
      stopIndex: stop.stopIndex,
      latitude: stop.latitude,
      longitude: stop.longitude,
    })),
    liveNotices: [],
    updatedAt: 1,
  }
}

function assertBuildContractPath(): void {
  const candidateLineage: ConciergeIntentCandidateLineage = {
    source: 'selected_candidate_route_artifact',
    candidateArtifactId: 'step2_static_build_paper_plane',
    directionId: 'build_paper_plane_contract',
    pocketId: 'downtown',
    sourceOpportunityId: 'paper-plane-static-card',
    anchorVenueId: buildRouteIds.highlight,
    anchorRole: 'highlight',
    lineageSummary: 'Petiscos -> Paper Plane -> Hedley Club Lounge',
  }
  const chain = buildChain({
    mode: 'build',
    persona: 'romantic',
    primaryVibe: 'lively',
    anchor: {
      venueId: buildRouteIds.highlight,
      role: 'highlight',
    },
    anchorDisplayName: 'Paper Plane',
    candidateLineage,
  })
  assert(chain.conciergeIntent.intentMode === 'anchored', 'Build must produce anchored ConciergeIntent.')
  assert(chain.conciergeIntent.anchorPosture.mode === 'hard', 'Build must produce hard anchor posture.')
  assert(chain.contractGateWorld.requiredStopGuarantee.required, 'Build must declare a required stop.')
  assert(
    chain.contractGateWorld.requiredStopGuarantee.venueId === buildRouteIds.highlight,
    'Build required-stop guarantee must preserve Paper Plane venue id.',
  )
  assert(
    chain.contractGateWorld.requiredStopGuarantee.role === 'highlight',
    'Build required-stop guarantee must preserve highlight role.',
  )
  assert(
    chain.contractGateWorld.debug.buildGeographyPolicy?.status === 'soft_warning',
    'Build geography must remain soft warning metadata.',
  )
  assert(
    chain.contractGateWorld.debug.buildGeographyPolicy.reasonCodes.includes('not_curate_hard_district_blocker'),
    'Build geography must not become a Curate hard blocker.',
  )

  const preserved = arcCandidate(
    'preserved-paper-plane-contract',
    [buildRouteIds.start, buildRouteIds.highlight, buildRouteIds.windDown],
    0.55,
  )
  const drift = arcCandidate(
    'stale-higher-score-missing-anchor',
    ['sj-heritage-tea-house', 'sj-alt-cocktail-anchor', 'sj-jtown-matcha-kissaten'],
    0.82,
  )
  const staleCompatibility = compatibilityIntent({
    mode: 'build',
    persona: 'family',
    primaryAnchor: 'cozy',
  })
  const contractRanking = rankFromContract({
    candidates: [drift, preserved],
    chain,
    compatibility: staleCompatibility,
  })
  assert(
    contractRanking.contractTrace.primaryInput === 'contract_context',
    'Build Waypoint ranking must use contract context as primary input.',
  )
  assert(contractRanking.contractTrace.requiredStopConsumed, 'Build Waypoint must consume required-stop metadata.')
  assert(
    contractRanking.contractTrace.topCandidatePreservesRequiredStop === true,
    'Build required-stop pressure must keep Paper Plane highlight candidate on top.',
  )
  assert(
    contractRanking.ranked[0]?.candidate.id === 'preserved-paper-plane-contract',
    'Build contract ranking must overcome stale higher-score drift when required stop is missing.',
  )
  const compatibilityRanking = rankArcCandidatesWithDiagnostics([drift, preserved], staleCompatibility)
  assert(
    compatibilityRanking.contractTrace.primaryInput === 'intent_profile_compatibility',
    'Legacy Build ranking without contract context must identify itself as compatibility-only.',
  )
  assert(
    compatibilityRanking.ranked[0]?.candidate.id === 'stale-higher-score-missing-anchor',
    'Compatibility-only Build ranking demonstrates the stale projection would otherwise win.',
  )

  const anchorContract = buildAnchorTruthContract({
    identity: {
      venueId: buildRouteIds.highlight,
      sourceVenueId: buildRouteIds.highlight,
      displayName: 'Paper Plane',
      sourceOrigin: 'static',
      provider: 'static-corpus',
    },
    role: {
      role: 'highlight',
      roleResolutionSource: 'explicit',
    },
  })
  const preservedArtifact = contractArtifact({ preserved: true })
  const selectedCandidateArtifact = contractArtifact({ preserved: true })
  const preservedRoute = runtimeRoute({ preserved: true })
  const preservedAdmission = evaluateBuildCandidateAdmission({
    mode: 'build',
    anchorContract,
    contractEntryArtifact: preservedArtifact,
    runtimeRouteArtifact: preservedRoute,
    buildParked: {
      providerSelectionAllowed: true,
      providerMergedIntoVisiblePool: true,
    },
  })
  const preservedTruth = buildBuildCardTruthModel({
    artifact: preservedArtifact,
    selectedCandidateArtifact,
    selectedArtifactId: preservedArtifact.id,
    selectedDirectionId: preservedArtifact.selection.directionId,
    approvedPayload: {
      artifactId: preservedArtifact.id,
      selectedDirectionId: preservedRoute.selectedDirectionId,
      finalRoute: preservedRoute,
      selectedClusterConfirmation: 'Paper Plane generated route preserves selected contract.',
      itinerary: null,
      sourceKind: 'static',
    },
    candidateAdmission: preservedAdmission,
    anchorTruthContract: anchorContract,
    selectedAnchorRequiredRole: 'highlight',
    sourceKind: 'static',
    buildProviderSelectionAllowed: true,
    buildProviderMergedIntoVisiblePool: true,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert(preservedTruth.routeAuthorityLockReady, 'Preserved Build contract must become routeAuthority lock-ready.')
  assert(
    preservedTruth.diagnostics.routeAuthorityBuildReasons.includes('build_candidate_contract_preserved'),
    'Build routeAuthority must report candidate contract preservation.',
  )

  const driftArtifact = contractArtifact({ preserved: false })
  const driftRoute = runtimeRoute({ preserved: false })
  const driftAdmission = evaluateBuildCandidateAdmission({
    mode: 'build',
    anchorContract,
    contractEntryArtifact: driftArtifact,
    runtimeRouteArtifact: driftRoute,
    buildParked: {
      providerSelectionAllowed: true,
      providerMergedIntoVisiblePool: true,
    },
  })
  const driftTruth = buildBuildCardTruthModel({
    artifact: driftArtifact,
    selectedCandidateArtifact,
    selectedArtifactId: driftArtifact.id,
    selectedDirectionId: driftArtifact.selection.directionId,
    approvedPayload: {
      artifactId: driftArtifact.id,
      selectedDirectionId: driftRoute.selectedDirectionId,
      finalRoute: driftRoute,
      selectedClusterConfirmation: 'Paper Plane generated route drifted.',
      itinerary: null,
      sourceKind: 'static',
    },
    candidateAdmission: driftAdmission,
    anchorTruthContract: anchorContract,
    selectedAnchorRequiredRole: 'highlight',
    sourceKind: 'static',
    buildProviderSelectionAllowed: true,
    buildProviderMergedIntoVisiblePool: true,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert(!driftTruth.routeAuthorityLockReady, 'Build routeAuthority must reject selected-contract drift.')
  assert(
    driftTruth.diagnostics.routeAuthorityBuildReasons.includes('build_candidate_contract_drifted'),
    'Build drift rejection must report build_candidate_contract_drifted.',
  )
}

async function assertSurpriseContractPath(): Promise<void> {
  const chain = buildChain({
    mode: 'surprise',
    persona: 'romantic',
    primaryVibe: 'lively',
    objectiveOccasion: 'explore',
  })
  const perturbed = buildChain({
    mode: 'surprise',
    persona: 'friends',
    primaryVibe: 'cultured',
    objectiveOccasion: 'celebrate',
  })
  assert(chain.conciergeIntent.starterLineage.source === 'system_seeded', 'Surprise must be system seeded.')
  assert(chain.conciergeIntent.candidateLineage.source === 'none', 'Surprise must not require selected candidate lineage.')
  assert(
    chain.contractGateWorld.debug.strategyFamily !== perturbed.contractGateWorld.debug.strategyFamily,
    'Surprise contract perturbation must change Bearings strategy family.',
  )

  const districtPreview = await buildDistrictOpportunityProfiles({
    locationQuery: 'San Jose',
    includeDebug: true,
  })
  const canonicalBoard = await buildStopTypeCandidateBoardFromContract({
    conciergeIntent: chain.conciergeIntent,
    canonicalInterpretationBundle: buildCanonicalInterpretationBundle({
      conciergeIntent: chain.conciergeIntent,
      interpretationSource: 'scripts.test-phase2-contract-path-causality.surprise.field',
    }),
    contractConstraints: buildCanonicalInterpretationBundle({
      conciergeIntent: chain.conciergeIntent,
      interpretationSource: 'scripts.test-phase2-contract-path-causality.surprise.constraints',
    }).contractConstraints,
    contractGateWorld: buildContractGateWorldFromCanonical({
      canonicalInterpretationBundle: buildCanonicalInterpretationBundle({
        conciergeIntent: chain.conciergeIntent,
        interpretationSource: 'scripts.test-phase2-contract-path-causality.surprise.gate',
      }),
      ranked: districtPreview.ranked,
      source: 'scripts.test-phase2-contract-path-causality.surprise.gate',
    }),
    locationQuery: 'San Jose',
    sourceMode: 'curated',
    liveEnvelope: CLOSED_PREVIEW_LIVE_ENVELOPE,
  })
  assert(canonicalBoard, 'Surprise canonical Field board should build.')
  assert(
    canonicalBoard.debug?.fieldDiscoveryContract?.inputSource === 'canonical_contract',
    'Surprise Field board must report canonical contract input.',
  )
  const staleBoard = await buildStopTypeCandidateBoardFromIntent({
    city: 'San Jose',
    mode: 'surprise',
    persona: 'family',
    vibe: 'cultured',
    sourceMode: 'curated',
    liveEnvelope: CLOSED_PREVIEW_LIVE_ENVELOPE,
  })
  assert(staleBoard, 'Stale Surprise compatibility board should build for shadow comparison.')
  assert(
    canonicalBoard.scenarioFamily !== staleBoard.scenarioFamily,
    'Surprise canonical contract board must not be controlled by stale compatibility projection.',
  )

  const ranking = rankFromContract({
    candidates: [
      arcCandidate('surprise-romantic-route', curateGreenRouteIds, 0.72),
      arcCandidate('surprise-family-shadow-route', ['sj-family-park', 'sj-family-museum', 'sj-family-cafe'], 0.74),
    ],
    chain,
    compatibility: compatibilityIntent({
      mode: 'surprise',
      persona: 'family',
      primaryAnchor: 'cultured',
    }),
  })
  assert(
    ranking.contractTrace.primaryInput === 'contract_context' &&
      ranking.contractTrace.normalizedObjectivePrimary === 'discover_route_shape',
    'Surprise Waypoint trace must consume canonical objective from contract context.',
  )
}

async function assertCurateContractPath(): Promise<void> {
  const coffeeBooks = starterPack({
    id: 'coffee-books',
    title: 'Coffee & Books',
    personaBias: 'romantic',
    primaryAnchor: 'cultured',
    secondaryAnchors: ['cozy'],
  })
  const chain = buildChain({
    mode: 'curate',
    persona: 'friends',
    primaryVibe: 'lively',
    starterPack: coffeeBooks,
  })
  assert(chain.conciergeIntent.starterLineage.source === 'starter_pack', 'Curate must carry starter lineage.')
  assert(
    chain.conciergeIntent.experienceProfile.persona === 'romantic' &&
      chain.conciergeIntent.experienceProfile.vibe === 'cultured',
    'Curate starter lineage must normalize persona/vibe into ConciergeIntent.',
  )
  assert(
    chain.contractGateWorld.debug.strategyFamily === 'romantic_cultured',
    'Coffee/Books Curate contract must resolve romantic_cultured from canonical intent.',
  )

  const districtPreview = await buildDistrictOpportunityProfiles({
    locationQuery: 'San Jose',
    includeDebug: true,
  })
  const interpretation = buildCanonicalInterpretationBundle({
    conciergeIntent: chain.conciergeIntent,
    interpretationSource: 'scripts.test-phase2-contract-path-causality.curate',
  })
  const world = buildContractGateWorldFromCanonical({
    canonicalInterpretationBundle: interpretation,
    ranked: districtPreview.ranked,
    source: 'scripts.test-phase2-contract-path-causality.curate',
  })
  const canonicalBoard = await buildStopTypeCandidateBoardFromContract({
    conciergeIntent: chain.conciergeIntent,
    canonicalInterpretationBundle: interpretation,
    contractConstraints: interpretation.contractConstraints,
    contractGateWorld: world,
    locationQuery: 'San Jose',
    sourceMode: 'curated',
    liveEnvelope: CLOSED_PREVIEW_LIVE_ENVELOPE,
    starterPack: coffeeBooks,
  })
  assert(canonicalBoard, 'Curate canonical Field board should build.')
  assert(
    canonicalBoard.scenarioFamily === 'romantic_cultured',
    'Curate canonical Field board must preserve Coffee/Books romantic_cultured family.',
  )
  assert(
    canonicalBoard.debug?.fieldDiscoveryContract?.inputSource === 'canonical_contract',
    'Curate Field board must report canonical contract input.',
  )
  const staleBoard = await buildStopTypeCandidateBoardFromIntent({
    city: 'Oakland',
    mode: 'curate',
    persona: 'family',
    vibe: 'lively',
    sourceMode: 'curated',
    liveEnvelope: CLOSED_PREVIEW_LIVE_ENVELOPE,
  })
  assert(
    staleBoard === null || canonicalBoard.scenarioFamily !== staleBoard.scenarioFamily,
    'Curate stale raw persona/vibe/city must not override canonical starter contract.',
  )

  const greenCandidate = arcCandidate('curate-green-route', curateGreenRouteIds, 0.7)
  const driftCandidate = arcCandidate(
    'curate-stale-shadow-route',
    ['sj-family-park', 'sj-family-museum', 'sj-family-cafe'],
    0.69,
  )
  const ranking = rankFromContract({
    candidates: [greenCandidate, driftCandidate],
    chain,
    compatibility: compatibilityIntent({
      mode: 'curate',
      persona: 'family',
      primaryAnchor: 'lively',
      city: 'Oakland',
    }),
  })
  assert(
    ranking.contractTrace.primaryInput === 'contract_context',
    'Curate Waypoint must consume contract context as primary input.',
  )
  assert(
    ranking.ranked[0]?.candidate.id === 'curate-green-route',
    'Curate green route identity must remain stable in the contract-path proof.',
  )
}

async function assertFamilyContractPath(): Promise<void> {
  const familyLively = buildChain({
    mode: 'curate',
    persona: 'family',
    primaryVibe: 'lively',
    ranked: nightlifeOnlyPocket(),
  })
  const familyCultured = buildChain({
    mode: 'curate',
    persona: 'family',
    primaryVibe: 'cultured',
    ranked: nightlifeOnlyPocket(),
  })
  const familyLivelyFailures = familyLively.contractGateWorld.hardRequirementResults.flatMap(
    (entry) => entry.hardFailureReasons,
  )
  const familyCulturedFailures = familyCultured.contractGateWorld.hardRequirementResults.flatMap(
    (entry) => entry.hardFailureReasons,
  )
  assert(
    familyLivelyFailures.includes('family_compatibility_required'),
    'Family/Lively must preserve hard family compatibility gating.',
  )
  assert(
    familyCulturedFailures.includes('learning_anchor_required'),
    'Family/Cultured must preserve its hard learning-anchor logistical gate.',
  )
  assert(
    familyLively.contractGateWorld.debug.strategyFamily === 'family_lively',
    'Family/Lively must resolve family_lively strategy family.',
  )
  assert(
    familyCultured.contractGateWorld.debug.strategyFamily === 'family_cultured',
    'Family/Cultured must resolve family_cultured strategy family.',
  )

  const districtPreview = await buildDistrictOpportunityProfiles({
    locationQuery: 'San Jose',
    includeDebug: true,
  })
  async function familyBoard(chain: ReturnType<typeof buildChain>): Promise<StopTypeCandidateBoard> {
    const interpretation = buildCanonicalInterpretationBundle({
      conciergeIntent: chain.conciergeIntent,
      interpretationSource: 'scripts.test-phase2-contract-path-causality.family',
    })
    const world = buildContractGateWorldFromCanonical({
      canonicalInterpretationBundle: interpretation,
      ranked: districtPreview.ranked,
      source: 'scripts.test-phase2-contract-path-causality.family',
    })
    const board = await buildStopTypeCandidateBoardFromContract({
      conciergeIntent: chain.conciergeIntent,
      canonicalInterpretationBundle: interpretation,
      contractConstraints: interpretation.contractConstraints,
      contractGateWorld: world,
      locationQuery: 'San Jose',
      sourceMode: 'curated',
      liveEnvelope: CLOSED_PREVIEW_LIVE_ENVELOPE,
    })
    assert(board, 'Family canonical board should build.')
    return board
  }
  const livelyBoard = await familyBoard(familyLively)
  const culturedBoard = await familyBoard(familyCultured)
  assert(
    livelyBoard.scenarioFamily === 'family_lively' &&
      culturedBoard.scenarioFamily === 'family_cultured',
    'Family expression must differ by Lively/Cultured contract family.',
  )
  assert(
    JSON.stringify(livelyBoard.requiredStopTypes) !== JSON.stringify(culturedBoard.requiredStopTypes),
    'Family Lively/Cultured should differ by experience expression without weakening family gating.',
  )

  const ranking = rankFromContract({
    candidates: [
      arcCandidate('family-contract-route', ['sj-family-park', 'sj-family-museum', 'sj-family-cafe'], 0.7),
      arcCandidate('romantic-shadow-route', curateGreenRouteIds, 0.71),
    ],
    chain: familyLively,
    compatibility: compatibilityIntent({
      mode: 'curate',
      persona: 'romantic',
      primaryAnchor: 'lively',
    }),
  })
  assert(
    ranking.contractTrace.primaryInput === 'contract_context' &&
      familyLively.strategyAdmissibleWorlds.every((world) => world.strategyFamily === 'family_lively'),
    'Non-family compatibility projection must not bypass Family contract strategy worlds.',
  )
}

function assertLceRuntimeContractPath(chain: ReturnType<typeof buildChain>): void {
  const route = runtimeRoute({
    preserved: true,
    persona: chain.conciergeIntent.experienceProfile.persona,
    vibe: chain.conciergeIntent.experienceProfile.vibe,
  })
  const lceContract = buildLceRuntimeContract({
    source: 'scripts.test-phase2-contract-path-causality',
    mutationKind: 'swap',
    phase: 'preview',
    targetRole: 'highlight',
    runtimeRouteArtifact: route,
    runtimeFieldReality: {
      source: 'static_runtime_fixture',
      role: 'highlight',
      venueId: route.stops[1]?.venueId,
      available: true,
      reasonCodes: ['phase2_contract_path_fixture'],
    },
    conciergeIntent: chain.conciergeIntent,
    compatibilityIntentProfile: compatibilityIntent({
      mode:
        chain.conciergeIntent.intentMode === 'anchored'
          ? 'build'
          : chain.conciergeIntent.intentMode === 'surprise'
            ? 'surprise'
            : 'curate',
      persona: 'family',
      primaryAnchor: 'cozy',
    }),
    userConfirmed: false,
  })
  assert(lceContract.diagnostics.consumedRuntimeRouteArtifact, 'LCE must consume RuntimeRouteArtifact.')
  assert(lceContract.diagnostics.consumedConciergeIntent, 'LCE must consume ConciergeIntent.')
  assert(!lceContract.diagnostics.silentMutationAllowed, 'LCE must never allow silent mutation.')
}

async function main(): Promise<void> {
  try {
    assertBuildContractPath()
    await assertSurpriseContractPath()
    await assertCurateContractPath()
    await assertFamilyContractPath()

    const crossModeChains = [
      buildChain({ mode: 'build', persona: 'romantic', primaryVibe: 'lively', anchor: { venueId: buildRouteIds.highlight, role: 'highlight' } }),
      buildChain({ mode: 'surprise', persona: 'romantic', primaryVibe: 'lively' }),
      buildChain({ mode: 'curate', persona: 'romantic', primaryVibe: 'cultured', starterPack: starterPack({
        id: 'coffee-books',
        title: 'Coffee & Books',
        personaBias: 'romantic',
        primaryAnchor: 'cultured',
      }) }),
    ]
    crossModeChains.forEach((chain) => {
      assert(chain.conciergeIntent.id.startsWith('cintent_v0_1'), 'Every mode must produce ConciergeIntent.')
      assert(
        chain.contractGateWorld.debug.contractGateWorldPresent,
        'Every mode must produce ContractGateWorld from canonical Interpretation.',
      )
      assert(chain.strategyAdmissibleWorlds.length > 0, 'Every mode must produce StrategyAdmissibleWorld[].')
      assertLceRuntimeContractPath(chain)
    })
    assert(fetchCallCount === 0, `Expected zero fetch/provider calls, received ${fetchCallCount}.`)
    process.stdout.write(
      `phase2 contract-path causality: passed\n${JSON.stringify(
        {
          buildRouteIds: Object.values(buildRouteIds),
          curateGreenRouteIds,
          fetchCallCount,
          modesCovered: ['build', 'surprise', 'curate', 'family_lively', 'family_cultured'],
          proofKinds: [
            'contract_perturbation',
            'compatibility_shadow',
            'trace_assertion',
            'negative_route_authority_drift_rejection',
          ],
        },
        null,
        2,
      )}\n`,
    )
  } finally {
    globalThis.fetch = originalFetch
  }
}

main().catch((error) => {
  globalThis.fetch = originalFetch
  console.error(error)
  process.exit(1)
})
