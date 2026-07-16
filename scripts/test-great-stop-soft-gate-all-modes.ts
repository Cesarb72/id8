import { readFileSync } from 'node:fs'
import {
  buildRouteRecommendationLifecycleDiagnostics,
} from '../src/app/services/routeRecommendationLifecycle.ts'
import {
  selectGreatStopGatePassingCandidate,
} from '../src/domain/greatStop/buildGreatStopGateResult.ts'
import {
  GreatStopGateSelectionError,
  type BuildLocationClass,
} from '../src/domain/types/greatStopGate.ts'
import type { BearingsPlaceRightVerdict } from '../src/domain/bearings/routePlaceRightContract.ts'
import type { FieldRealVerdict } from '../src/domain/field/fieldRealVerdict.ts'
import type { ArcCandidate, ArcStop } from '../src/domain/types/arc.ts'
import type { ExperienceMode, IntentProfile, PersonaMode } from '../src/domain/types/intent.ts'

const originalFetch = globalThis.fetch
let fetchCallCount = 0

globalThis.fetch = (async (input) => {
  fetchCallCount += 1
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  throw new Error(`Great Stop all-modes soft-gate observer must not call fetch: ${url}`)
}) as typeof fetch

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function fieldRealPass(): FieldRealVerdict {
  return {
    realReady: true,
    status: 'pass',
    identityUsable: true,
    sourceUsable: true,
    provenanceValid: true,
    availabilityKnown: true,
    availabilityStatus: 'available_from_record',
    stalenessStatus: 'current',
    suppressionStatus: 'not_suppressed',
    failureReasons: [],
    stopEvidence: [],
    routeEvidence: {
      stopCount: 3,
      failingStopCount: 0,
      unknownStopCount: 0,
      failureReasons: [],
    },
    provenance: {
      source: 'field',
      evaluatedFrom: 'already_retrieved_record_truth',
      notes: ['synthetic-owner-verdict'],
    },
    compatibility: {
      greatStopRealInputs: {
        realReady: true,
        realVerdict: 'pass',
        realFailureReasons: [],
        unusableStopCount: 0,
        unknownStopCount: 0,
      },
    },
  }
}

function placeRightVerdict(status: 'pass' | 'fail'): BearingsPlaceRightVerdict {
  const reasons = status === 'pass' ? [] : ['place_right:synthetic_no_passing_candidate']
  return {
    placeRightReady: true,
    status,
    reasons,
    distanceBurden: {
      status,
      burden: status === 'pass' ? 'low' : 'high',
      reasonCodes: reasons,
      notes: status === 'pass' ? ['total:8', 'max:4'] : ['total:40', 'max:20'],
    },
    movementToleranceFit: { status, reasonCodes: reasons },
    stretchAdmissibility: { status: 'not_applicable', reasonCodes: [] },
    supportProximityVerdict: { status, reasonCodes: reasons },
    supportSupplyBuildabilityVerdict: { status, reasonCodes: reasons },
    requiredStopSurvivalVerdict: { status, reasonCodes: reasons },
    openClosedViabilityVerdict: { status: 'pass', reasonCodes: [] },
    stopEvidence: [],
    routeEvidence: {
      status,
      distanceBurden: {
        status,
        burden: status === 'pass' ? 'low' : 'high',
        reasonCodes: reasons,
        notes: status === 'pass' ? ['total:8', 'max:4'] : ['total:40', 'max:20'],
      },
      movementToleranceFit: { status, reasonCodes: reasons },
      stretchAdmissibility: { status: 'not_applicable', reasonCodes: [] },
      supportProximity: { status, reasonCodes: reasons },
      supportSupplyBuildability: { status, reasonCodes: reasons },
      requiredStopSurvival: { status, reasonCodes: reasons },
      openClosedViability: { status: 'pass', reasonCodes: [] },
      reasonCodes: reasons,
    },
    compatibility: {
      greatStopPlaceRightStatus: status,
      greatStopPlaceRightReasonCodes: reasons,
    },
    provenance: {
      source: 'bearings',
      version: 'synthetic-owner-verdict',
      notes: ['synthetic-owner-verdict'],
    },
  }
}

function buildStop(params: {
  role: ArcStop['role']
  venueId: string
  lane: string
  cluster: string
  energy: number
  roleScore?: number
  shapeScore?: number
  fitScore?: number
  lensCompatibility?: number
  contextSpecificity?: number
}): ArcStop {
  const roleScore = params.roleScore ?? 0.82
  const shapeScore = params.shapeScore ?? 0.82
  const fitScore = params.fitScore ?? 0.82
  const lensCompatibility = params.lensCompatibility ?? 0.82
  const contextSpecificity = params.contextSpecificity ?? 0.82
  return {
    role: params.role,
    scoredVenue: {
      venue: {
        id: params.venueId,
        name: params.venueId,
        city: 'San Jose',
        neighborhood: params.cluster,
        driveMinutes: 4,
        category: 'abstract',
        subcategory: 'abstract',
        priceTier: '$$',
        tags: [],
        useCases: [],
        vibeTags: [],
        energyLevel: params.energy,
        socialDensity: 0.5,
        uniquenessScore: 0.5,
        distinctivenessScore: 0.5,
        underexposureScore: 0.5,
        shareabilityScore: 0.5,
        isChain: false,
        localSignals: {
          localFavoriteScore: 0.5,
          neighborhoodPrideScore: 0.5,
          repeatVisitorScore: 0.5,
        },
        roleAffinity: {
          warmup: roleScore,
          peak: roleScore,
          wildcard: roleScore,
          cooldown: roleScore,
        },
        imageUrl: '',
        shortDescription: '',
        narrativeFlavor: '',
        isHiddenGem: false,
        isActive: true,
        highlightCapable: true,
        durationProfile: {} as never,
        settings: {} as never,
        signature: {} as never,
        source: {
          sourceOrigin: 'curated',
        } as never,
      },
      candidateIdentity: {
        candidateId: params.venueId,
        baseVenueId: params.venueId,
        kind: 'base',
        traceLabel: params.venueId,
      },
      momentIdentity: {
        type: params.role === 'peak' ? 'anchor' : params.role === 'warmup' ? 'arrival' : 'close',
        strength: params.role === 'peak' ? 'strong' : 'medium',
      },
      fitBreakdown: {} as never,
      fitScore,
      hiddenGemScore: 0.5,
      lensCompatibility,
      contextSpecificity: {
        overall: contextSpecificity,
        personaSignal: contextSpecificity,
        vibeSignal: contextSpecificity,
        lensSignal: contextSpecificity,
        byRole: {
          warmup: contextSpecificity,
          peak: contextSpecificity,
          wildcard: contextSpecificity,
          cooldown: contextSpecificity,
        },
      },
      dominanceControl: {
        universalityScore: 0.2,
        flaggedUniversal: false,
        byRole: {
          warmup: 0.2,
          peak: 0.2,
          wildcard: 0.2,
          cooldown: 0.2,
        },
      },
      roleContract: {
        warmup: {} as never,
        peak: {} as never,
        wildcard: {} as never,
        cooldown: {} as never,
      },
      stopShapeFit: {
        start: shapeScore,
        highlight: shapeScore,
        surprise: shapeScore,
        windDown: shapeScore,
      },
      vibeAuthority: {} as never,
      highlightValidity: {} as never,
      roleScores: {
        warmup: roleScore,
        peak: roleScore,
        wildcard: roleScore,
        cooldown: roleScore,
      },
      taste: {
        signals: {} as never,
        modeAlignment: {
          score: 0.82,
          penalty: 0,
          lane: params.lane as never,
          tier: 'primary',
          supportiveTagScore: 0,
          lanePriorityScore: 0,
        },
        fallbackPenalty: {
          signalScore: 0,
          appliedPenalty: 0,
          applied: false,
          strongerAlternativePresent: false,
          reason: '',
        },
        rolePoolInfluence: {
          warmup: {} as never,
          peak: {} as never,
          wildcard: {} as never,
          cooldown: {} as never,
        },
      },
    },
  }
}

function buildCandidate(id: string, options?: { pass?: boolean }): ArcCandidate {
  const pass = options?.pass !== false
  const stops = [
    buildStop({ role: 'warmup', venueId: `${id}-start`, lane: 'arrival', cluster: 'a', energy: 2 }),
    buildStop({ role: 'peak', venueId: `${id}-highlight`, lane: 'center', cluster: 'a', energy: 4 }),
    buildStop({ role: 'cooldown', venueId: `${id}-winddown`, lane: 'landing', cluster: 'a', energy: 2 }),
  ]
  const transitions = [
    [stops[0]!, stops[1]!, 0],
    [stops[1]!, stops[2]!, 1],
  ] as const

  return {
    id,
    stops,
    totalScore: pass ? 0.9 : 0.5,
    scoreBreakdown: {
      roleFlowScore: 0.82,
      diversityScore: 0.82,
      geographyScore: 0.82,
      hiddenGemLift: 0,
      windDownScore: 0.82,
      highlightMomentScore: pass ? 0.82 : 0.2,
      momentStrengthScore: pass ? 0.82 : 0.2,
      momentFlatPenalty: pass ? 0 : 0.2,
      strongMomentPresent: pass,
      momentQualityNote: pass ? 'Strong center' : 'No strong center',
    },
    pacing: {
      transitions: transitions.map(([from, to]) => ({
        fromRoleKey: from.role,
        toRoleKey: to.role,
        fromVenueId: from.scoredVenue.venue.id,
        toVenueId: to.scoredVenue.venue.id,
        estimatedTravelMinutes: pass ? 4 : 20,
        transitionBufferMinutes: 0,
        estimatedTransitionMinutes: pass ? 4 : 20,
        frictionScore: pass ? 0.1 : 1,
        movementMode: pass ? 'walkable' : 'short-drive',
        neighborhoodContinuity: pass ? 'same-neighborhood' : 'adjacent-neighborhoods',
        notes: [],
      })),
      totalRouteFriction: pass ? 0.1 : 1,
      estimatedStopMinutes: 120,
      estimatedTransitionMinutes: pass ? 8 : 40,
      estimatedTotalMinutes: pass ? 128 : 160,
      estimatedTotalLabel: '2h',
      routeFeelLabel: pass ? 'balanced' : 'strained',
      pacingPenaltyApplied: !pass,
      pacingPenaltyReasons: pass ? [] : ['synthetic strained route'],
      smoothProgressionRewardApplied: pass,
      smoothProgressionRewardReasons: pass ? ['synthetic smooth route'] : [],
    },
    spatial: {
      mode: 'flexible',
      homeClusterId: 'a',
      clustersVisited: pass ? ['a'] : ['a', 'b', 'c'],
      clusterAssignments: stops.map((stop) => ({
        venueId: stop.scoredVenue.venue.id,
        venueName: stop.scoredVenue.venue.name,
        neighborhood: pass ? 'a' : stop.role,
        clusterId: pass ? 'a' : stop.role,
      })),
      transitions: transitions.map(([from, to], index) => ({
        fromVenueId: from.scoredVenue.venue.id,
        toVenueId: to.scoredVenue.venue.id,
        fromClusterId: pass ? 'a' : from.role,
        toClusterId: pass ? 'a' : to.role,
        fromNeighborhood: pass ? 'a' : from.role,
        toNeighborhood: pass ? 'a' : to.role,
        driveGap: pass ? 4 : 20,
        sameCluster: pass,
        clusterEscape: !pass,
        longTransition: !pass,
        jumpUsed: !pass,
        scoreDelta: 0,
        notes: index === 0 && !pass ? ['synthetic movement failure'] : [],
      })),
      sameClusterTransitionCount: pass ? 2 : 0,
      clusterEscapeCount: pass ? 0 : 2,
      repeatedClusterEscapeCount: pass ? 0 : 1,
      longTransitionCount: pass ? 0 : 2,
      jumpUsed: !pass,
      spatialBonus: pass ? 0.1 : 0,
      spatialPenalty: pass ? 0 : 0.2,
      score: pass ? 0.9 : 0.3,
      notes: [],
    },
    hasWildcard: false,
  }
}

function buildIntent(mode: ExperienceMode, persona: PersonaMode, locationClass?: BuildLocationClass): IntentProfile {
  return {
    crew: persona === 'romantic' ? 'romantic' : persona === 'family' ? 'curator' : 'socialite',
    persona,
    primaryAnchor: persona === 'family' ? 'playful' : persona === 'romantic' ? 'cozy' : 'lively',
    city: 'San Jose',
    distanceMode: locationClass === 'L1 Dense' ? 'nearby' : 'short-drive',
    prefersHiddenGems: false,
    refinementModes: [],
    mode,
    planningMode: mode === 'build' ? 'user-led' : 'engine-led',
  }
}

function runSoftGateModeCase(params: {
  mode: ExperienceMode
  persona: PersonaMode
  locationClass?: BuildLocationClass
}) {
  const passingTopCandidate = buildCandidate(`${params.mode}-top-pass`)
  const failingCandidate = buildCandidate(`${params.mode}-fail`, { pass: false })
  const intent = buildIntent(params.mode, params.persona, params.locationClass)
  const selection = selectGreatStopGatePassingCandidate({
    candidates: [passingTopCandidate, failingCandidate],
    intent,
    locationClass: params.locationClass,
    locationClassSource: params.locationClass ? 'explicit' : undefined,
    placeRightVerdictForCandidate: (candidate) =>
      candidate.id === passingTopCandidate.id ? placeRightVerdict('pass') : placeRightVerdict('fail'),
    fieldRealVerdictForCandidate: fieldRealPass,
    stage: 'pre_selection_gate',
  })

  assert(selection.diagnostics.status === 'PASS', `${params.mode} soft-gate should pass.`)
  assert(
    selection.selectedCandidate?.id === passingTopCandidate.id,
    `${params.mode} should preserve an already-passing top candidate.`,
  )
  assert(
    selection.diagnostics.selectedCandidateRank === 1,
    `${params.mode} should preserve route parity when rank 1 already passes.`,
  )
  assert(
    selection.diagnostics.selectedGateResult?.preset.source ===
      (params.locationClass ? 'explicit' : 'inferred_from_distance_mode'),
    `${params.mode} should use location class only as preset information.`,
  )

  return {
    mode: params.mode,
    softGateActive: true,
    locationPresetSource: selection.diagnostics.selectedGateResult?.preset.source,
    locationClass: selection.diagnostics.selectedGateResult?.preset.locationClass,
    routeParityPreserved: selection.selectedCandidate?.id === passingTopCandidate.id,
    providerCalls: fetchCallCount,
    pass: true,
  }
}

function assertNoPassingCandidateFailsClosed() {
  const intent = buildIntent('curate', 'romantic')
  const selection = selectGreatStopGatePassingCandidate({
    candidates: [buildCandidate('all-fail-a', { pass: false }), buildCandidate('all-fail-b', { pass: false })],
    intent,
    placeRightVerdictForCandidate: () => placeRightVerdict('fail'),
    fieldRealVerdictForCandidate: fieldRealPass,
    stage: 'pre_selection_gate',
  })
  assert(selection.diagnostics.status === 'FAIL', 'All-fail pool must produce structured FAIL diagnostics.')
  assert(!selection.selectedCandidate, 'All-fail pool must not select a candidate.')
  const lifecycle = buildRouteRecommendationLifecycleDiagnostics({
    generatedContractEntryArtifactPresent: true,
    finalRoutePresent: true,
    greatStopStatus: 'FAIL',
    routeAuthorityStatus: 'valid',
    lockInputAvailable: true,
    reviewEligible: true,
    lockEligible: true,
  })
  assert(lifecycle.phase === 'great_stop_failed', 'All-fail route must enter Great Stop failure lifecycle.')
  assert(!lifecycle.reviewEligible, 'All-fail route must not be reviewable.')
  assert(!lifecycle.lockEligible, 'All-fail route must not be lockable.')
  const error = new GreatStopGateSelectionError(selection.diagnostics)
  assert(
    error.greatStopGateSelectionDiagnostics.status === 'FAIL',
    'Structured Great Stop failure diagnostics must be attached to the error.',
  )

  return {
    softGateExhausted: true,
    selectedCandidate: null,
    lifecyclePhase: lifecycle.phase,
    reviewEligible: lifecycle.reviewEligible,
    lockEligible: lifecycle.lockEligible,
  }
}

function assertSourceWiring() {
  const runGeneratePlanSource = readFileSync('src/domain/runGeneratePlan.ts', 'utf8')
  const waypointBuildSource = readFileSync(
    'src/domain/waypoint/buildContractDrivenBuildWaypointPlan.ts',
    'utf8',
  )

  assert(
    !runGeneratePlanSource.includes("planningIntent.mode === 'build' && Boolean(options.greatStopGateLocationClass)"),
    'Soft-gate activation must not be coupled to Build mode plus explicit location class.',
  )
  assert(
    runGeneratePlanSource.includes('const greatStopSelectionActive = true') &&
      runGeneratePlanSource.includes('const greatStopCandidatePool =') &&
      runGeneratePlanSource.includes('curateHardCommitRequired') &&
      runGeneratePlanSource.includes('selectGreatStopGatePassingCandidate({') &&
      runGeneratePlanSource.includes('locationClass: options.greatStopGateLocationClass') &&
      runGeneratePlanSource.includes("locationClassSource: options.greatStopGateLocationClass ? 'explicit' : undefined"),
    'runGeneratePlan must run Great Stop pre-selection independently from optional preset input.',
  )
  assert(
    !waypointBuildSource.includes('const postRepairGreatStopGateDiagnostics = input.greatStopGateLocationClass') &&
      waypointBuildSource.includes('const postRepairGreatStopGateDiagnostics = (() => {') &&
      waypointBuildSource.includes("locationClassSource: input.greatStopGateLocationClass ? 'explicit' : undefined"),
    'Post-repair Great Stop verification must not be activated by location class.',
  )
}

try {
  assertSourceWiring()
  const modeCoverage = [
    runSoftGateModeCase({ mode: 'build', persona: 'romantic', locationClass: 'L3 Sparse' }),
    runSoftGateModeCase({ mode: 'curate', persona: 'friends' }),
    runSoftGateModeCase({ mode: 'surprise', persona: 'family' }),
  ]
  const noPassingCandidate = assertNoPassingCandidateFailsClosed()
  assert(fetchCallCount === 0, `Expected provider silence, fetch called ${fetchCallCount} time(s).`)

  process.stdout.write(
    `${JSON.stringify(
      {
        observer: 'great_stop_soft_gate_all_modes',
        softGateActivation: 'always_on_for_build_curate_surprise',
        locationClassRole: 'preset_only',
        providerCalls: fetchCallCount,
        modeCoverage,
        noPassingCandidate,
      },
      null,
      2,
    )}\n`,
  )
} finally {
  globalThis.fetch = originalFetch
}
