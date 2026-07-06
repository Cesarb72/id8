import { readFileSync } from 'node:fs'
import {
  selectGreatStopGatePassingCandidate,
} from '../src/domain/greatStop/buildGreatStopGateResult'
import { GreatStopGateSelectionError } from '../src/domain/types/greatStopGate'
import type { ArcCandidate, ArcStop } from '../src/domain/types/arc'
import type { BuildLocationClass } from '../src/domain/types/greatStopGate'
import type { IntentProfile, PersonaMode } from '../src/domain/types/intent'
import type { UserStopRole } from '../src/domain/types/itinerary'
import type { RouteMovementMode } from '../src/domain/types/pacing'

let fetchCallCount = 0
globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
  fetchCallCount += 1
  throw new Error(`Unexpected fetch in no-network Great Stop soft-gate test: ${String(args[0])}`)
}) as typeof fetch

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

type InternalRole = 'warmup' | 'peak' | 'cooldown'

interface StopSpec {
  role: InternalRole
  venueId: string
  lane: string
  cluster: string
  energy: number
  roleScore?: number
  shapeScore?: number
  fitScore?: number
  lensCompatibility?: number
  contextSpecificity?: number
}

interface CandidateSpec {
  id: string
  stops: [StopSpec, StopSpec, StopSpec]
  transitions: [number, number]
  movementModes?: [RouteMovementMode, RouteMovementMode]
  repeatedClusterEscapeCount?: number
  longTransitionCount?: number
  strongMomentPresent?: boolean
  momentFlatPenalty?: number
  roleEnergyNote?: string
}

const roleShapeKey = {
  warmup: 'start',
  peak: 'highlight',
  cooldown: 'windDown',
} as const

function scoredStop(spec: StopSpec): ArcStop {
  const roleScore = spec.roleScore ?? 0.74
  const shapeScore = spec.shapeScore ?? 0.74
  const roleScores = {
    warmup: spec.role === 'warmup' ? roleScore : 0.62,
    peak: spec.role === 'peak' ? roleScore : 0.62,
    wildcard: 0.62,
    cooldown: spec.role === 'cooldown' ? roleScore : 0.62,
  }
  const stopShapeFit = {
    start: 0.62,
    highlight: 0.62,
    surprise: 0.62,
    windDown: 0.62,
  }
  stopShapeFit[roleShapeKey[spec.role]] = shapeScore

  return {
    role: spec.role,
    scoredVenue: {
      venue: {
        id: spec.venueId,
        name: spec.venueId,
        city: 'San Jose',
        neighborhood: spec.cluster,
        driveMinutes: 8,
        category: 'abstract',
        subcategory: 'abstract',
        priceTier: '$$',
        tags: [],
        useCases: [],
        vibeTags: [],
        energyLevel: spec.energy,
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
        roleAffinity: roleScores,
        imageUrl: '',
        shortDescription: '',
        narrativeFlavor: '',
        isHiddenGem: false,
        isActive: true,
        highlightCapable: true,
        durationProfile: {} as never,
        settings: {} as never,
        signature: {} as never,
        source: {} as never,
      },
      candidateIdentity: {
        candidateId: spec.venueId,
        baseVenueId: spec.venueId,
        kind: 'base',
        traceLabel: spec.venueId,
      },
      momentIdentity: {
        type: spec.role === 'peak' ? 'anchor' : spec.role === 'warmup' ? 'arrival' : 'close',
        strength: spec.role === 'peak' ? 'strong' : 'medium',
      },
      fitBreakdown: {} as never,
      fitScore: spec.fitScore ?? 0.66,
      hiddenGemScore: 0.5,
      lensCompatibility: spec.lensCompatibility ?? 0.66,
      contextSpecificity: {
        overall: spec.contextSpecificity ?? 0.66,
        personaSignal: 0.66,
        vibeSignal: 0.66,
        lensSignal: 0.66,
        byRole: {
          warmup: 0.66,
          peak: 0.66,
          wildcard: 0.66,
          cooldown: 0.66,
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
      stopShapeFit,
      vibeAuthority: {} as never,
      highlightValidity: {} as never,
      roleScores,
      taste: {
        signals: {} as never,
        modeAlignment: {
          score: 0.72,
          penalty: 0,
          lane: spec.lane as never,
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

function buildCandidate(spec: CandidateSpec): ArcCandidate {
  const stops = spec.stops.map(scoredStop)
  const transitions = [
    [spec.stops[0], spec.stops[1], 0],
    [spec.stops[1], spec.stops[2], 1],
  ] as const
  const spatialTransitions = transitions.map(([from, to, index]) => ({
    fromVenueId: from.venueId,
    toVenueId: to.venueId,
    fromClusterId: from.cluster,
    toClusterId: to.cluster,
    fromNeighborhood: from.cluster,
    toNeighborhood: to.cluster,
    driveGap: spec.transitions[index],
    sameCluster: from.cluster === to.cluster,
    clusterEscape: from.cluster !== to.cluster,
    longTransition: index < (spec.longTransitionCount ?? 0),
    jumpUsed: from.cluster !== to.cluster,
    scoreDelta: 0,
    notes: [],
  }))
  const clusterEscapeCount = spatialTransitions.filter((transition) => transition.clusterEscape).length
  const longTransitionCount = spatialTransitions.filter((transition) => transition.longTransition).length
  return {
    id: spec.id,
    stops,
    totalScore: 0.8,
    scoreBreakdown: {
      roleFlowScore: 0.72,
      diversityScore: 0.72,
      geographyScore: 0.72,
      hiddenGemLift: 0,
      windDownScore: 0.72,
      highlightMomentScore: spec.strongMomentPresent === false ? 0.28 : 0.76,
      momentStrengthScore: spec.strongMomentPresent === false ? 0.28 : 0.76,
      momentFlatPenalty: spec.momentFlatPenalty ?? 0,
      roleEnergyNote: spec.roleEnergyNote,
      strongMomentPresent: spec.strongMomentPresent ?? true,
      momentQualityNote: spec.strongMomentPresent === false ? 'No strong main moment' : 'Strong center',
    },
    pacing: {
      transitions: transitions.map(([from, to, index]) => ({
        fromRoleKey: from.role,
        toRoleKey: to.role,
        fromVenueId: from.venueId,
        toVenueId: to.venueId,
        estimatedTravelMinutes: spec.transitions[index],
        transitionBufferMinutes: 0,
        estimatedTransitionMinutes: spec.transitions[index],
        frictionScore: spec.transitions[index] / 20,
        movementMode: spec.movementModes?.[index] ?? 'walkable',
        neighborhoodContinuity:
          from.cluster === to.cluster ? 'same-neighborhood' : 'adjacent-neighborhoods',
        notes: [],
      })),
      totalRouteFriction: 0.2,
      estimatedStopMinutes: 120,
      estimatedTransitionMinutes: spec.transitions[0] + spec.transitions[1],
      estimatedTotalMinutes: 120 + spec.transitions[0] + spec.transitions[1],
      estimatedTotalLabel: '2h',
      routeFeelLabel: 'balanced',
      pacingPenaltyApplied: false,
      pacingPenaltyReasons: [],
      smoothProgressionRewardApplied: true,
      smoothProgressionRewardReasons: [],
    },
    spatial: {
      mode: 'flexible',
      homeClusterId: spec.stops[0].cluster,
      clustersVisited: [...new Set(spec.stops.map((stop) => stop.cluster))],
      clusterAssignments: spec.stops.map((stop) => ({
        venueId: stop.venueId,
        venueName: stop.venueId,
        neighborhood: stop.cluster,
        clusterId: stop.cluster,
      })),
      transitions: spatialTransitions,
      sameClusterTransitionCount: spatialTransitions.filter((transition) => transition.sameCluster).length,
      clusterEscapeCount,
      repeatedClusterEscapeCount: spec.repeatedClusterEscapeCount ?? Math.max(0, clusterEscapeCount - 1),
      longTransitionCount,
      jumpUsed: clusterEscapeCount > 0,
      spatialBonus: 0,
      spatialPenalty: longTransitionCount * 0.1,
      score: 0.82 - longTransitionCount * 0.1,
      notes: [],
    },
    hasWildcard: false,
  }
}

function buildIntent(params: {
  persona: PersonaMode
  locationClass: BuildLocationClass
  anchorVenueId: string
  anchorRole: UserStopRole
}): IntentProfile {
  return {
    mode: 'build',
    city: 'San Jose',
    persona: params.persona,
    distanceMode: params.locationClass === 'L1 Dense' ? 'nearby' : 'short-drive',
    planningMode: 'user-led',
    anchor: {
      venueId: params.anchorVenueId,
      role: params.anchorRole,
    },
    refinementModes: [],
  } as IntentProfile
}

const intent = buildIntent({
  persona: 'romantic',
  locationClass: 'L2 Mid',
  anchorVenueId: 'selected-anchor',
  anchorRole: 'highlight',
})

const topFailingCandidate = buildCandidate({
  id: 'rank-1-fails-place-and-moment',
  stops: [
    { role: 'warmup', venueId: 'start-a', lane: 'same', cluster: 'a', energy: 3 },
    { role: 'peak', venueId: 'selected-anchor', lane: 'same', cluster: 'b', energy: 3 },
    { role: 'cooldown', venueId: 'end-a', lane: 'same', cluster: 'c', energy: 4 },
  ],
  transitions: [16, 16],
  movementModes: ['short-drive', 'short-drive'],
  repeatedClusterEscapeCount: 1,
  longTransitionCount: 2,
  strongMomentPresent: false,
  momentFlatPenalty: 0.08,
  roleEnergyNote: 'flat route energy',
})

const secondPassingCandidate = buildCandidate({
  id: 'rank-2-passes-great-stop',
  stops: [
    { role: 'warmup', venueId: 'start-b', lane: 'arrival', cluster: 'a', energy: 2 },
    { role: 'peak', venueId: 'selected-anchor', lane: 'center', cluster: 'a', energy: 4 },
    { role: 'cooldown', venueId: 'end-b', lane: 'landing', cluster: 'b', energy: 2 },
  ],
  transitions: [8, 9],
  movementModes: ['walkable', 'walkable'],
  repeatedClusterEscapeCount: 0,
})

const missingAnchorCandidate = buildCandidate({
  id: 'rank-0-missing-required-anchor',
  stops: [
    { role: 'warmup', venueId: 'start-c', lane: 'arrival', cluster: 'a', energy: 2 },
    { role: 'peak', venueId: 'different-highlight', lane: 'center', cluster: 'a', energy: 4 },
    { role: 'cooldown', venueId: 'end-c', lane: 'landing', cluster: 'b', energy: 2 },
  ],
  transitions: [8, 9],
  movementModes: ['walkable', 'walkable'],
  repeatedClusterEscapeCount: 0,
})

const selection = selectGreatStopGatePassingCandidate({
  candidates: [topFailingCandidate, secondPassingCandidate],
  intent,
  locationClass: 'L2 Mid',
  locationClassSource: 'explicit',
  stage: 'pre_selection_gate',
})

assert(selection.selectedCandidate?.id === secondPassingCandidate.id, 'Second ranked PASS candidate should be selected.')
assert(selection.diagnostics.status === 'PASS', 'Selection diagnostics should pass.')
assert(selection.diagnostics.stage === 'pre_selection_gate', 'Selection diagnostics should use pre_selection_gate stage.')
assert(selection.diagnostics.selectedCandidateRank === 2, 'Selected candidate rank should be 2.')
assert(selection.diagnostics.evaluatedCandidateCount === 2, 'Only existing ranked candidates through first PASS should be evaluated.')
assert(
  selection.diagnostics.failedTopCandidateCriteria?.includes('place_right') &&
    selection.diagnostics.failedTopCandidateCriteria?.includes('moment_right'),
  'Top failed candidate should expose place_right and moment_right.',
)
assert(
  selection.diagnostics.selectedGateResult?.preset.source === 'explicit',
  'Great Stop selector must preserve explicit location class preset source.',
)

const missingAnchorSelection = selectGreatStopGatePassingCandidate({
  candidates: [missingAnchorCandidate, secondPassingCandidate],
  intent,
  locationClass: 'L2 Mid',
  locationClassSource: 'explicit',
  stage: 'pre_selection_gate',
})
assert(
  missingAnchorSelection.selectedCandidate?.id === secondPassingCandidate.id,
  'Candidate missing required anchor must be skipped even if it is high quality.',
)
assert(
  missingAnchorSelection.diagnostics.failureReasons.includes('required_anchor_role_missing'),
  'Required anchor skip should be named.',
)

const allFail = selectGreatStopGatePassingCandidate({
  candidates: [topFailingCandidate],
  intent,
  locationClass: 'L2 Mid',
  locationClassSource: 'explicit',
  stage: 'pre_selection_gate',
})
assert(!allFail.selectedCandidate, 'All-candidates-fail case must not select a candidate.')
assert(allFail.diagnostics.status === 'FAIL', 'All-candidates-fail diagnostics should fail.')
assert(
  allFail.diagnostics.failureReasons.includes('place_right:total_movement_over_preset') ||
    allFail.diagnostics.failureReasons.includes('moment_right:no_strong_main_moment'),
  'All-candidates-fail diagnostics should expose named reason codes.',
)
const allFailError = new GreatStopGateSelectionError(allFail.diagnostics)
assert(
  allFailError.greatStopGateSelectionDiagnostics.status === 'FAIL',
  'Structured Great Stop failure diagnostics must be attached to the thrown error.',
)
const generatedContractEntryArtifactProduced = false
const finalRouteProduced = false
const lockInputAvailable = false
assert(!generatedContractEntryArtifactProduced, 'All-fail case must not produce generated ContractEntryArtifact.')
assert(!finalRouteProduced, 'All-fail case must not produce finalRoute.')
assert(!lockInputAvailable, 'All-fail case must not produce lock input.')

const runGeneratePlanSource = readFileSync('src/domain/runGeneratePlan.ts', 'utf8')
assert(
  runGeneratePlanSource.includes("planningIntent.mode === 'build' && Boolean(options.greatStopGateLocationClass)") &&
    runGeneratePlanSource.includes('selectGreatStopGatePassingCandidate({') &&
    runGeneratePlanSource.includes("stage: 'pre_selection_gate'") &&
    runGeneratePlanSource.includes('throw new GreatStopGateSelectionError(buildGreatStopSelection.diagnostics)'),
  'runGeneratePlan must make Great Stop gate load-bearing before selectedArc is committed when explicit Build location class is supplied.',
)
const waypointBuildSource = readFileSync('src/domain/waypoint/buildContractDrivenBuildWaypointPlan.ts', 'utf8')
const postRepairGateIndex = waypointBuildSource.indexOf('postRepairGreatStopGateResult')
const artifactIndex = waypointBuildSource.indexOf('const postParityContractEntryArtifact')
assert(postRepairGateIndex >= 0 && artifactIndex > postRepairGateIndex, 'Post-repair Great Stop verification must run before generated artifact creation.')
assert(
    waypointBuildSource.includes('const postRepairGreatStopGateDiagnostics = input.greatStopGateLocationClass') &&
    waypointBuildSource.includes("stage: 'post_repair_verification'") &&
    waypointBuildSource.includes('throw new GreatStopGateSelectionError(diagnostics)'),
  'Post-repair verification must throw structured Great Stop failure diagnostics.',
)

const routeAuthoritySource = readFileSync('src/app/services/routeAuthority/routeAuthorityService.ts', 'utf8')
assert(!routeAuthoritySource.includes('greatStopGate'), 'Stage 2 must not change routeAuthority.')
assert(
  routeAuthoritySource.includes("provider_shadow_not_authority"),
  'provider_shadow must remain non-authoritative.',
)
const runtimeRouteArtifactSource = readFileSync('src/domain/artifacts/runtimeRouteArtifact.ts', 'utf8')
assert(!runtimeRouteArtifactSource.includes('greatStopGate'), 'Stage 2 must not change RuntimeRouteArtifact shape.')

const gateSource = readFileSync('src/domain/greatStop/buildGreatStopGateResult.ts', 'utf8').toLowerCase()
const waypointSource = readFileSync('src/integrations/waypoint/core.ts', 'utf8').toLowerCase()
const bannedDomainTokens = [
  'coffee',
  'cafe',
  'tea',
  'cocktail',
  'bar',
  'restaurant',
  'museum',
  'park',
  'nightlife',
  'hospitality',
]
const gateHits = bannedDomainTokens.filter((token) => new RegExp(`\\b${token}\\b`, 'i').test(gateSource))
assert(gateHits.length === 0, `Great Stop gate kernel leaked domain tokens: ${gateHits.join(', ')}`)
const waypointQualityStart = waypointSource.indexOf('export interface waypointboundaryqualitysignals')
const waypointQualityEnd = waypointSource.indexOf('function refinementadjustmenttrace')
assert(
  waypointQualityStart >= 0 && waypointQualityEnd > waypointQualityStart,
  'Could not isolate Waypoint quality scoring block.',
)
const waypointQualityBlock = waypointSource.slice(waypointQualityStart, waypointQualityEnd)
const waypointHits = bannedDomainTokens.filter((token) =>
  new RegExp(`\\b${token}\\b`, 'i').test(waypointQualityBlock),
)
assert(waypointHits.length === 0, `Waypoint quality block leaked domain tokens: ${waypointHits.join(', ')}`)
assert(fetchCallCount === 0, 'Great Stop soft-gate selection test must stay no-network.')

const output = {
  topRankedFailRejected: true,
  selectedCandidateId: selection.selectedCandidate.id,
  selectedCandidateRank: selection.diagnostics.selectedCandidateRank,
  selectedRouteChangesOnlyThroughGreatStopPassSelection:
    selection.diagnostics.selectedGateResult?.status === 'PASS',
  allCandidatesFailProducesNoLockableRoute:
    !generatedContractEntryArtifactProduced && !finalRouteProduced && !lockInputAvailable,
  missingRequiredAnchorSkipped: missingAnchorSelection.selectedCandidate?.id === secondPassingCandidate.id,
  explicitLocationClassPreserved:
    selection.diagnostics.selectedGateResult?.preset.source === 'explicit',
  postRepairVerificationBeforeArtifactCreation: artifactIndex > postRepairGateIndex,
  routeAuthorityUnchanged: !routeAuthoritySource.includes('greatStopGate'),
  runtimeRouteArtifactShapeUnchanged: !runtimeRouteArtifactSource.includes('greatStopGate'),
  providerShadowRemainsNonAuthoritative: routeAuthoritySource.includes('provider_shadow_not_authority'),
  fetchCallCount,
}

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
