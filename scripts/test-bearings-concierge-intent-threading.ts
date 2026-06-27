import {
  buildContractGateWorldFromCanonical,
  type ContractGateWorld,
} from '../src/domain/bearings/buildContractGateWorld.ts'
import { buildStrategyAdmissibleWorlds } from '../src/domain/bearings/buildStrategyAdmissibleWorlds.ts'
import { buildCanonicalInterpretationBundle } from '../src/domain/interpretation/buildCanonicalInterpretationBundle.ts'
import type { ConciergeIntentCandidateLineage, PlanAnchor } from '../src/domain/types/intent.ts'
import type { RankedPocket } from '../src/engines/district/types/districtTypes.ts'
import { buildApplicationConciergeIntent } from '../src/app/concierge/conciergeIntentAdapter.ts'

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
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
    reasons: ['focused_bearings_fixture'],
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
        provenance: ['focused_bearings_fixture'],
        generatedAtIso: '2026-06-27T00:00:00.000Z',
        identityKind: 'known_neighborhood',
        origin: 'primary',
        truthTier: 'primary',
        isDegradedFallback: false,
        fallbackPenaltyApplied: 0,
        clusteringSource: 'primary',
        originNotes: ['focused_bearings_fixture'],
      },
    },
  }
}

function buildWorldForIntent(params: {
  mode: 'curate' | 'build'
  persona: 'romantic' | 'friends' | 'family'
  primaryVibe: 'cozy' | 'lively' | 'playful' | 'cultured' | 'chill'
  anchor?: PlanAnchor
  candidateLineage?: ConciergeIntentCandidateLineage
  ranked: RankedPocket[]
}): ContractGateWorld {
  const conciergeIntent = buildApplicationConciergeIntent({
    mode: params.mode,
    persona: params.persona,
    primaryVibe: params.primaryVibe,
    city: 'San Jose',
    objectiveOccasion: 'connect',
    anchor: params.anchor ?? null,
    anchorDisplayName: params.anchor?.venueId === 'sj-paper-plane' ? 'Paper Plane' : null,
    candidateLineage: params.candidateLineage ?? null,
  })
  const canonicalInterpretationBundle = buildCanonicalInterpretationBundle({
    conciergeIntent,
    interpretationSource: 'scripts.test-bearings-concierge-intent-threading',
  })
  return buildContractGateWorldFromCanonical({
    canonicalInterpretationBundle,
    ranked: params.ranked,
    source: 'scripts.test-bearings-concierge-intent-threading',
  })
}

function assertFamilyHardGating(): void {
  const world = buildWorldForIntent({
    mode: 'curate',
    persona: 'family',
    primaryVibe: 'lively',
    ranked: [
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
    ],
  })

  const hardFailures = world.hardRequirementResults.flatMap(
    (entry) => entry.hardFailureReasons,
  )
  assert(
    hardFailures.includes('family_compatibility_required'),
    'Family persona must keep hard family compatibility gating.',
  )
  assert(
    hardFailures.includes('bounded_energy_required'),
    'Family lively persona must keep bounded energy hard gating.',
  )
}

function assertBuildAnchorGuaranteeAndStrategyWorlds(): void {
  const candidateLineage: ConciergeIntentCandidateLineage = {
    source: 'selected_candidate_route_artifact',
    candidateArtifactId: 'step2_static_build_paper_plane',
    directionId: 'build_paper_plane_contract',
    pocketId: 'sofa-market',
    sourceOpportunityId: 'paper-plane-static-card',
    anchorVenueId: 'sj-paper-plane',
    anchorRole: 'highlight',
    lineageSummary: 'Petiscos -> Paper Plane -> Hedley Club Lounge',
  }
  const world = buildWorldForIntent({
    mode: 'build',
    persona: 'romantic',
    primaryVibe: 'lively',
    anchor: {
      venueId: 'sj-paper-plane',
      role: 'highlight',
    },
    candidateLineage,
    ranked: [
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
    ],
  })

  assert(world.requiredStopGuarantee.required, 'Build anchor must declare a required stop.')
  assert(
    world.requiredStopGuarantee.venueId === 'sj-paper-plane',
    'Required-stop guarantee must preserve the anchor venue id.',
  )
  assert(
    world.requiredStopGuarantee.role === 'highlight',
    'Required-stop guarantee must preserve the anchor role.',
  )
  assert(
    world.requiredStopGuarantee.reasonCodes.includes('required_stop_non_negotiable'),
    'Required-stop guarantee must carry non-negotiable survival reason code.',
  )
  assert(
    world.debug.buildGeographyPolicy?.status === 'soft_warning',
    'Build hard-anchor geography must be represented as a soft warning.',
  )
  assert(
    world.debug.buildGeographyPolicy.reasonCodes.includes('not_curate_hard_district_blocker'),
    'Build hard-anchor geography must not become a Curate hard district blocker.',
  )

  const strategyWorlds = buildStrategyAdmissibleWorlds({ contractGateWorld: world })
  assert(strategyWorlds.length > 0, 'Strategy worlds should derive from ContractGateWorld.')
  assert(
    strategyWorlds.every((strategyWorld) => strategyWorld.strategyFamily === world.debug.strategyFamily),
    'Strategy worlds must derive strategy family from ContractGateWorld.',
  )
  assert(
    strategyWorlds.every(
      (strategyWorld) =>
        strategyWorld.requiredStopGuarantee.venueId ===
        world.requiredStopGuarantee.venueId,
    ),
    'Strategy worlds must carry required-stop guarantee metadata from ContractGateWorld.',
  )
}

function main(): void {
  assertFamilyHardGating()
  assertBuildAnchorGuaranteeAndStrategyWorlds()
  console.info('PASS bearings ConciergeIntent threading focused test')
}

main()
