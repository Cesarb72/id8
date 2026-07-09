import { buildLockInputFromRouteAuthoritySnapshot, buildRouteAuthoritySnapshot } from '../src/app/services/routeAuthority/routeAuthorityService.ts'
import { buildLockedLiveArtifactPayload } from '../src/app/services/live/liveSessionHandoff.ts'
import { buildApplicationConciergeIntent, projectConciergeIntentToIntentInput } from '../src/app/concierge/conciergeIntentAdapter.ts'
import { buildCanonicalInterpretationBundle } from '../src/domain/interpretation/buildCanonicalInterpretationBundle.ts'
import { buildContractGateWorldFromCanonical } from '../src/domain/bearings/buildContractGateWorld.ts'
import { buildStrategyAdmissibleWorlds } from '../src/domain/bearings/buildStrategyAdmissibleWorlds.ts'
import { buildStopTypeCandidateBoardFromContract } from '../src/domain/interpretation/discovery/stopTypeCandidateBoard.ts'
import { buildFinalRoute } from '../src/domain/artifacts/runtimeRouteProjection.ts'
import type { RuntimeRouteArtifact } from '../src/domain/artifacts/runtimeRouteArtifact.ts'
import { validateLockedLiveArtifactSessionPayload } from '../src/domain/live/validateLiveArtifact.ts'
import { CLOSED_PREVIEW_LIVE_ENVELOPE } from '../src/domain/retrieval/liveEnvelope.ts'
import { runGeneratePlan, type GeneratePlanResult } from '../src/domain/runGeneratePlan.ts'
import type { ConciergeIntent, ContractConstraints, PersonaMode, VibeAnchor } from '../src/domain/types/intent.ts'
import type { Itinerary, UserStopRole } from '../src/domain/types/itinerary.ts'
import type { RankedPocket } from '../src/engines/district/types/districtTypes.ts'
import { buildDistrictOpportunityProfiles } from '../src/domain/interpretation/district/intelligence/buildDistrictOpportunityProfiles.ts'

type FamilyScenarioId = 'family_lively' | 'family_cultured'

type FetchCounters = {
  fetchCallCount: number
  fieldProxyHits: number
  browserProviderHits: number
  lceProviderHits: number
}

interface FamilyScenarioConfig {
  id: FamilyScenarioId
  persona: Extract<PersonaMode, 'family'>
  vibe: Extract<VibeAnchor, 'lively' | 'cultured'>
  expectedStrategyFamily: FamilyScenarioId
  expectedHardFailureReasons: string[]
}

interface FamilyScenarioProof {
  scenario: FamilyScenarioId
  resolvable: boolean
  routeIds: string[]
  routeNames: string[]
  routeCategories: string[]
  routeAuthorityStatus: string
  lockInputSource: string | null
  hardGateEvidence: string[]
  constraintPosture: ConciergeIntent['constraintPosture']
  strategyWorldCount: number
  candidateBoardScenarioFamily: string | null
  finalRouteSourceCoverageComplete: boolean
  runtimeRouteArtifactShapeUnchanged: boolean
  noNightlifeLeak: boolean
  providerValve: FetchCounters
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const originalFetch = globalThis.fetch
const fetchCounters: FetchCounters = {
  fetchCallCount: 0,
  fieldProxyHits: 0,
  browserProviderHits: 0,
  lceProviderHits: 0,
}

globalThis.fetch = (async (input) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  fetchCounters.fetchCallCount += 1
  if (url.includes('/api/field/text-search')) {
    fetchCounters.fieldProxyHits += 1
  }
  if (/googleapis|places\.google|maps\.google/i.test(url)) {
    fetchCounters.browserProviderHits += 1
  }
  if (/\/api\/lce|lce/i.test(url)) {
    fetchCounters.lceProviderHits += 1
  }
  throw new Error(`Family local proof must not call fetch/providers: ${url}`)
}) as typeof fetch

const scenarios: FamilyScenarioConfig[] = [
  {
    id: 'family_lively',
    persona: 'family',
    vibe: 'lively',
    expectedStrategyFamily: 'family_lively',
    expectedHardFailureReasons: ['family_compatibility_required', 'bounded_energy_required'],
  },
  {
    id: 'family_cultured',
    persona: 'family',
    vibe: 'cultured',
    expectedStrategyFamily: 'family_cultured',
    expectedHardFailureReasons: ['learning_anchor_required'],
  },
]

try {
  const proofs = []
  for (const scenario of scenarios) {
    proofs.push(await runFamilyScenarioProof(scenario))
  }

  assert(fetchCounters.fetchCallCount === 0, 'Provider valve must remain closed locally.')
  assert(fetchCounters.fieldProxyHits === 0, 'Family proof must not hit Field proxy.')
  assert(fetchCounters.browserProviderHits === 0, 'Family proof must not hit browser providers.')
  assert(fetchCounters.lceProviderHits === 0, 'Family proof must not hit LCE providers.')

  process.stdout.write('phase2 family local proof: passed\n')
  process.stdout.write(`${JSON.stringify({ proofs, providerValve: fetchCounters }, null, 2)}\n`)
} finally {
  globalThis.fetch = originalFetch
}

async function runFamilyScenarioProof(config: FamilyScenarioConfig): Promise<FamilyScenarioProof> {
  const conciergeIntent = buildApplicationConciergeIntent({
    mode: 'curate',
    persona: config.persona,
    primaryVibe: config.vibe,
    city: 'San Jose',
    objectiveOccasion: 'connect',
  })
  assertCompleteFamilyConciergeIntent(conciergeIntent, config)

  const canonicalInterpretationBundle = buildCanonicalInterpretationBundle({
    conciergeIntent,
    interpretationSource: 'scripts.test-phase2-family-local-proof',
  })
  assert(
    canonicalInterpretationBundle.strategyFamily === config.expectedStrategyFamily,
    `${config.id} must resolve ${config.expectedStrategyFamily}.`,
  )
  assert(
    canonicalInterpretationBundle.experienceContract.persona === 'family',
    `${config.id} ExperienceContract must preserve Family persona.`,
  )
  assert(
    canonicalInterpretationBundle.contractConstraints.kidEngagementRequired,
    `${config.id} ContractConstraints must require kid engagement.`,
  )
  assert(
    canonicalInterpretationBundle.contractConstraints.requireRecoveryWindows,
    `${config.id} ContractConstraints must require recovery windows.`,
  )
  assert(
    !canonicalInterpretationBundle.contractConstraints.allowLateHighEnergy,
    `${config.id} ContractConstraints must disallow late high energy.`,
  )
  assert(
    canonicalInterpretationBundle.contractConstraints.movementTolerance === 'compressed',
    `${config.id} ContractConstraints must keep compressed movement.`,
  )

  const hardGateWorld = buildContractGateWorldFromCanonical({
    canonicalInterpretationBundle,
    ranked: nightlifeOnlyPocket(),
    source: 'scripts.test-phase2-family-local-proof.hard-gate-fixture',
  })
  const hardGateEvidence = hardGateWorld.hardRequirementResults.flatMap(
    (entry) => entry.hardFailureReasons,
  )
  for (const reason of config.expectedHardFailureReasons) {
    assert(
      hardGateEvidence.includes(reason),
      `${config.id} must expose ${reason} hard gate evidence.`,
    )
  }

  const districtPreview = await buildDistrictOpportunityProfiles({
    locationQuery: 'San Jose',
    includeDebug: true,
  })
  const contractGateWorld = buildContractGateWorldFromCanonical({
    canonicalInterpretationBundle,
    ranked: districtPreview.ranked,
    source: 'scripts.test-phase2-family-local-proof',
  })
  assert(
    contractGateWorld.debug.contractGateWorldPresent,
    `${config.id} ContractGateWorld must be present.`,
  )
  assert(
    contractGateWorld.debug.strategyFamily === config.expectedStrategyFamily,
    `${config.id} Bearings must consume ${config.expectedStrategyFamily}.`,
  )

  const strategyAdmissibleWorlds = buildStrategyAdmissibleWorlds({ contractGateWorld })
  assert(strategyAdmissibleWorlds.length > 0, `${config.id} must produce StrategyAdmissibleWorld[].`)
  assert(
    strategyAdmissibleWorlds.every((world) => world.strategyFamily === config.expectedStrategyFamily),
    `${config.id} StrategyAdmissibleWorld[] must preserve Family strategy family.`,
  )

  const candidateBoard = await buildStopTypeCandidateBoardFromContract({
    conciergeIntent,
    canonicalInterpretationBundle,
    contractConstraints: canonicalInterpretationBundle.contractConstraints,
    contractGateWorld,
    locationQuery: 'San Jose',
    sourceMode: 'curated',
    liveEnvelope: CLOSED_PREVIEW_LIVE_ENVELOPE,
  })
  assert(candidateBoard, `${config.id} canonical candidate board must build.`)
  assert(
    candidateBoard.scenarioFamily === config.expectedStrategyFamily,
    `${config.id} candidate board must use Family strategy family.`,
  )
  assert(
    candidateBoard.debug?.fieldDiscoveryContract?.inputSource === 'canonical_contract',
    `${config.id} candidate board must use canonical_contract input.`,
  )

  const projectedInput = projectConciergeIntentToIntentInput({
    conciergeIntent,
    mode: 'curate',
    city: 'San Jose',
    distanceMode: 'nearby',
  })
  const result = await runGeneratePlan(projectedInput, {
    sourceMode: 'curated',
    sourceModeOverrideApplied: true,
    debugMode: false,
    vibeTasteProfileScoring: 'off',
    occasionScoring: 'off',
    whenSpatialScoring: 'off',
    experienceContract: canonicalInterpretationBundle.experienceContract,
    contractConstraints: canonicalInterpretationBundle.contractConstraints,
    canonicalInterpretationBundle,
    contractGateWorld,
    strategyAdmissibleWorlds,
  })
  assertGeneratedFamilyRoute(result, canonicalInterpretationBundle.contractConstraints, config)

  const finalRoute = buildRuntimeRoute(result, config)
  const routeAuthority = buildRouteAuthoritySnapshot({
    contractEntryArtifact: result.contractEntryArtifact,
    runtimeRouteArtifact: finalRoute,
    selectedDirectionId: finalRoute.selectedDirectionId,
    selectedArtifactId: result.contractEntryArtifact.id,
    selectedClusterConfirmation: `Family ${config.vibe} generated route is ready for Review.`,
    itinerary: result.itinerary,
  })
  assert(routeAuthority.validationStatus === 'valid', `${config.id} routeAuthority must be valid.`)
  const lockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot: routeAuthority,
    activeRole: 'start',
    fallbackCity: result.intentProfile.city,
  })
  assert(lockInput.ok, `${config.id} lock input must be available.`)
  assert(
    lockInput.diagnostics.lockInputSource === 'contract_entry_artifact.runtime_route_artifact',
    `${config.id} lock input must come from canonical generated truth.`,
  )

  const pageLocalOnlyLockInput = buildLockInputFromRouteAuthoritySnapshot({
    snapshot: buildRouteAuthoritySnapshot({
      pageLocalFinalRoute: finalRoute,
      selectedClusterConfirmation: `Family ${config.vibe} page-local route.`,
      itinerary: result.itinerary,
    }),
    activeRole: 'start',
    fallbackCity: result.intentProfile.city,
  })
  assert(!pageLocalOnlyLockInput.ok, `${config.id} page-local finalRoute must not become authority.`)

  const lockSafeSourceIds = new Set(lockInput.input.lockSafeItineraryStops.map((stop) => stop.id))
  const finalRouteSourceCoverageComplete = finalRoute.stops.every((stop) =>
    lockSafeSourceIds.has(stop.sourceStopId),
  )
  assert(
    finalRouteSourceCoverageComplete,
    `${config.id} every finalRoute sourceStopId must have an itinerary companion.`,
  )

  const payload = buildLockedLiveArtifactPayload({
    ...lockInput.input,
    lockedAt: 1,
    sessionId: `phase2-family-${config.id}`,
  })
  const liveValidation = validateLockedLiveArtifactSessionPayload(payload)
  assert(liveValidation.ok, `${config.id} locked live artifact payload must validate.`)

  return {
    scenario: config.id,
    resolvable: true,
    routeIds: routeIds(result.itinerary),
    routeNames: routeNames(result.itinerary),
    routeCategories: routeCategories(result.itinerary),
    routeAuthorityStatus: routeAuthority.validationStatus,
    lockInputSource: lockInput.diagnostics.lockInputSource,
    hardGateEvidence,
    constraintPosture: conciergeIntent.constraintPosture,
    strategyWorldCount: strategyAdmissibleWorlds.length,
    candidateBoardScenarioFamily: candidateBoard.scenarioFamily,
    finalRouteSourceCoverageComplete,
    runtimeRouteArtifactShapeUnchanged: true,
    noNightlifeLeak: true,
    providerValve: { ...fetchCounters },
  }
}

function assertCompleteFamilyConciergeIntent(
  conciergeIntent: ConciergeIntent,
  config: FamilyScenarioConfig,
): void {
  assert(conciergeIntent.id.startsWith('cintent_v0_1'), `${config.id} must produce ConciergeIntent.`)
  assert(conciergeIntent.intentMode === 'curated', `${config.id} intent mode must be curated.`)
  assert(
    conciergeIntent.objective.primary === 'stabilize_selected_direction',
    `${config.id} objective must stabilize selected direction.`,
  )
  assert(conciergeIntent.controlPosture.mode === 'guided_assist', `${config.id} control posture must populate.`)
  assert(conciergeIntent.experienceProfile.persona === 'family', `${config.id} persona must be Family.`)
  assert(conciergeIntent.experienceProfile.vibe === config.vibe, `${config.id} vibe must be ${config.vibe}.`)
  assert(conciergeIntent.anchorPosture.mode === 'none', `${config.id} anchor posture must populate as none.`)
  assert(conciergeIntent.constraintPosture.structureRigidity === 'tight', `${config.id} structure must be tight.`)
  assert(
    Boolean(conciergeIntent.constraintPosture.swapTolerance),
    `${config.id} swap tolerance must be populated.`,
  )
  assert(conciergeIntent.realityPosture.certaintyPriority === 'high', `${config.id} certainty must be high.`)
}

function assertGeneratedFamilyRoute(
  result: GeneratePlanResult,
  constraints: ContractConstraints,
  config: FamilyScenarioConfig,
): void {
  const stops = coreStops(result.itinerary)
  assert(stops.length === 3, `${config.id} generated route must include start/highlight/windDown.`)
  const roles = stops.map((stop) => stop.role)
  assert(roles.join('|') === 'start|highlight|windDown', `${config.id} generated route roles must be ordered.`)
  assert(result.intentProfile.persona === 'family', `${config.id} generated IntentProfile must preserve Family.`)
  assert(result.intentProfile.primaryAnchor === config.vibe, `${config.id} generated IntentProfile must preserve vibe.`)
  assert(
    result.trace.canonicalInterpretationIngress?.supplied === true,
    `${config.id} generation must receive canonical interpretation.`,
  )
  assert(
    result.trace.boundaryDiagnostics.waypointContractTrace?.primaryInput === 'contract_context',
    `${config.id} Waypoint must use contract_context.`,
  )
  assert(
    !routeHasNightlifeLeak(result.itinerary),
    `${config.id} generated route must not contain cocktail/nightlife/bar leakage. route=${routeNames(result.itinerary).join(' -> ')}`,
  )
  assert(
    result.itinerary.totalRouteFriction <= 8,
    `${config.id} route friction must stay bounded for Family. friction=${result.itinerary.totalRouteFriction}`,
  )
  assert(
    constraints.requireRecoveryWindows && !constraints.allowLateHighEnergy,
    `${config.id} family recovery/no-late-high-energy constraints must remain active.`,
  )
}

function buildRuntimeRoute(result: GeneratePlanResult, config: FamilyScenarioConfig): RuntimeRouteArtifact {
  const selectedDirectionId =
    result.contractEntryArtifact.selection.directionId ??
    result.intentProfile.selectedDirectionContext?.directionId ??
    `phase2-family-${config.id}`
  const finalRoute = buildFinalRoute({
    itinerary: result.itinerary,
    canonicalStopByRole: buildCanonicalStopIdentityByRole(result.itinerary),
    selectedDirectionId,
    city: result.intentProfile.city,
    persona: result.intentProfile.persona,
    vibe: result.intentProfile.primaryAnchor,
    activeRole: 'start',
    mode: 'curate',
    routeHeadline: result.itinerary.storySpine?.title ?? result.itinerary.title,
    routeSummary: result.itinerary.storySpine?.routeSummary ?? result.itinerary.shareSummary,
  })
  assert(finalRoute, `${config.id} RuntimeRouteArtifact must build from generated itinerary.`)
  assertRuntimeRouteArtifactShape(finalRoute)
  return finalRoute
}

function buildCanonicalStopIdentityByRole(
  itinerary: Itinerary,
): Parameters<typeof buildFinalRoute>[0]['canonicalStopByRole'] {
  const canonicalStopByRole: Parameters<typeof buildFinalRoute>[0]['canonicalStopByRole'] = {}
  for (const stop of itinerary.stops) {
    canonicalStopByRole[stop.role] = {
      displayName: stop.venueName,
      providerRecordId: `provider:${stop.venueId}`,
      latitude: stop.latitude ?? 37.33,
      longitude: stop.longitude ?? -121.89,
      addressLine: stop.formattedAddress ?? `${stop.venueName}, San Jose, CA`,
      neighborhood: stop.neighborhood,
    }
  }
  return canonicalStopByRole
}

function assertRuntimeRouteArtifactShape(route: RuntimeRouteArtifact): void {
  const expectedKeys = [
    'activeStopIndex',
    'liveNotices',
    'location',
    'mapMarkers',
    'persona',
    'routeHeadline',
    'routeId',
    'routeSummary',
    'selectedDirectionId',
    'stops',
    'updatedAt',
    'vibe',
  ]
  assert(
    JSON.stringify(Object.keys(route).sort()) === JSON.stringify(expectedKeys.sort()),
    'RuntimeRouteArtifact shape must remain unchanged.',
  )
  assert(route.stops.length >= 3, 'RuntimeRouteArtifact must contain route stops.')
  assert(route.mapMarkers.length === route.stops.length, 'RuntimeRouteArtifact markers must match stops.')
}

function coreStops(itinerary: Itinerary): Itinerary['stops'] {
  return itinerary.stops
    .filter((stop) => stop.role === 'start' || stop.role === 'highlight' || stop.role === 'windDown')
    .sort((left, right) => roleOrder(left.role) - roleOrder(right.role))
}

function roleOrder(role: UserStopRole): number {
  if (role === 'start') {
    return 0
  }
  if (role === 'highlight') {
    return 1
  }
  if (role === 'windDown') {
    return 2
  }
  return 3
}

function routeIds(itinerary: Itinerary): string[] {
  return coreStops(itinerary).map((stop) => stop.venueId)
}

function routeNames(itinerary: Itinerary): string[] {
  return coreStops(itinerary).map((stop) => stop.venueName)
}

function routeCategories(itinerary: Itinerary): string[] {
  return coreStops(itinerary).map((stop) => stop.category)
}

function routeHasNightlifeLeak(itinerary: Itinerary): boolean {
  const blocked = ['bar', 'cocktail', 'club', 'nightlife', 'late-night', 'live_music']
  return coreStops(itinerary).some((stop) => {
    const tokens = [
      stop.category,
      stop.subcategory,
      ...stop.tags,
      ...stop.vibeTags,
      ...(stop.reasonLabels ?? []),
    ].map((value) => String(value).toLowerCase())
    return tokens.some((token) => blocked.some((blockedToken) => token.includes(blockedToken)))
  })
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
    reasons: ['phase2_family_local_proof_fixture'],
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
        provenance: ['phase2_family_local_proof_fixture'],
        generatedAtIso: '2026-07-01T00:00:00.000Z',
        identityKind: 'known_neighborhood',
        origin: 'primary',
        truthTier: 'primary',
        isDegradedFallback: false,
        fallbackPenaltyApplied: 0,
        clusteringSource: 'primary',
        originNotes: ['phase2_family_local_proof_fixture'],
      },
    },
  }
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
