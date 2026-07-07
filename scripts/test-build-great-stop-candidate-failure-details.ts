import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  selectGreatStopGatePassingCandidate,
} from '../src/domain/greatStop/buildGreatStopGateResult'
import type { ArcCandidate, ArcStop } from '../src/domain/types/arc'
import type { IntentProfile } from '../src/domain/types/intent'
import type { RouteMovementMode } from '../src/domain/types/pacing'

let fetchCallCount = 0
globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
  fetchCallCount += 1
  throw new Error(`Unexpected fetch in no-network Great Stop candidate detail test: ${String(args[0])}`)
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
  baseVenueId?: string
  name: string
  cluster: string
  lane: string
  energy: number
  roleScore?: number
  shapeScore?: number
}

interface CandidateSpec {
  id: string
  stops: [StopSpec, StopSpec, StopSpec]
  transitions: [number, number]
  movementModes?: [RouteMovementMode, RouteMovementMode]
  longTransitionCount?: number
  repeatedClusterEscapeCount?: number
  totalScore?: number
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
        name: spec.name,
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
        source: {
          sourceOrigin: spec.venueId.startsWith('live_') ? 'provider' : 'curated',
          provider: spec.venueId.startsWith('live_') ? 'google-places' : undefined,
          providerRecordId: spec.venueId.startsWith('live_') ? `${spec.name}-provider-record` : undefined,
        } as never,
      },
      candidateIdentity: {
        candidateId: `${spec.venueId}::candidate`,
        baseVenueId: spec.baseVenueId ?? spec.venueId,
        kind: 'base',
        traceLabel: spec.name,
      },
      momentIdentity: {
        type: spec.role === 'peak' ? 'anchor' : spec.role === 'warmup' ? 'arrival' : 'close',
        strength: spec.role === 'peak' ? 'strong' : 'medium',
      },
      fitBreakdown: {} as never,
      fitScore: 0.66,
      hiddenGemScore: 0.5,
      lensCompatibility: 0.66,
      contextSpecificity: {
        overall: 0.66,
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
      highlightValidity: {
        validityLevel: 'valid',
        packLiteralRequirementSatisfied: false,
        packLiteralRequirementLabel: '',
        personaVetoes: [],
        contextVetoes: [],
        violations: [],
      } as never,
      roleScores,
      taste: {
        signals: {
          momentIntensity: {
            score: spec.role === 'peak' ? 0.76 : 0.42,
          },
        } as never,
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
    totalScore: spec.totalScore ?? 0.8,
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
        venueName: stop.name,
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

function candidate(
  id: string,
  transitions: [number, number],
  params: Partial<CandidateSpec> = {},
): ArcCandidate {
  return buildCandidate({
    id,
    stops: [
      {
        role: 'warmup',
        venueId: `start-${id}`,
        name: `Start ${id}`,
        lane: 'arrival',
        cluster: params.stops?.[0]?.cluster ?? 'north',
        energy: 2,
      },
      {
        role: 'peak',
        venueId: 'live_google_adega-provider-record',
        baseVenueId: 'sj-adega-wine-atelier',
        name: 'Adega',
        lane: 'center',
        cluster: params.stops?.[1]?.cluster ?? 'central',
        energy: params.stops?.[1]?.energy ?? 4,
      },
      {
        role: 'cooldown',
        venueId: `end-${id}`,
        name: `End ${id}`,
        lane: params.stops?.[2]?.lane ?? 'landing',
        cluster: params.stops?.[2]?.cluster ?? 'south',
        energy: params.stops?.[2]?.energy ?? 2,
      },
    ],
    transitions,
    movementModes: params.movementModes,
    repeatedClusterEscapeCount: params.repeatedClusterEscapeCount,
    longTransitionCount: params.longTransitionCount,
    strongMomentPresent: params.strongMomentPresent,
    momentFlatPenalty: params.momentFlatPenalty,
    roleEnergyNote: params.roleEnergyNote,
    totalScore: params.totalScore,
  })
}

const intent = {
  mode: 'build',
  city: 'San Jose',
  persona: 'romantic',
  distanceMode: 'short-drive',
  planningMode: 'user-led',
  anchor: {
    venueId: 'sj-adega-wine-atelier',
    role: 'highlight',
  },
  refinementModes: [],
} as IntentProfile

const candidates = [
  candidate('rank-1-place-and-moment', [16, 16], {
    movementModes: ['short-drive', 'short-drive'],
    repeatedClusterEscapeCount: 1,
    longTransitionCount: 2,
    strongMomentPresent: false,
    momentFlatPenalty: 0.08,
    roleEnergyNote: 'flat route energy',
  }),
  candidate('rank-2-nearest-moment-only', [8, 8], {
    stops: [
      { role: 'warmup', venueId: '', name: '', lane: '', cluster: 'central', energy: 2 },
      { role: 'peak', venueId: '', name: '', lane: '', cluster: 'central', energy: 4 },
      { role: 'cooldown', venueId: '', name: '', lane: 'arrival', cluster: 'central', energy: 5 },
    ],
    strongMomentPresent: false,
    momentFlatPenalty: 0.08,
    roleEnergyNote: 'flat route energy',
  }),
  candidate('rank-3-movement-only', [15, 10], {
    movementModes: ['short-drive', 'walkable'],
    longTransitionCount: 1,
    stops: [
      { role: 'warmup', venueId: '', name: '', lane: '', cluster: 'north', energy: 2 },
      { role: 'peak', venueId: '', name: '', lane: '', cluster: 'central', energy: 4 },
      { role: 'cooldown', venueId: '', name: '', lane: 'landing', cluster: 'central', energy: 2 },
    ],
  }),
  candidate('rank-4-place-and-moment', [20, 18], {
    movementModes: ['short-drive', 'short-drive'],
    repeatedClusterEscapeCount: 1,
    longTransitionCount: 2,
    strongMomentPresent: false,
    momentFlatPenalty: 0.08,
    roleEnergyNote: 'flat route energy',
  }),
  candidate('rank-5-moment-only', [7, 7], {
    stops: [
      { role: 'warmup', venueId: '', name: '', lane: '', cluster: 'central', energy: 2 },
      { role: 'peak', venueId: '', name: '', lane: '', cluster: 'central', energy: 3 },
      { role: 'cooldown', venueId: '', name: '', lane: 'landing', cluster: 'central', energy: 5 },
    ],
    roleEnergyNote: 'flat route energy',
  }),
  candidate('rank-6-extra-failing-capped', [30, 30], {
    movementModes: ['short-drive', 'short-drive'],
    repeatedClusterEscapeCount: 1,
    longTransitionCount: 2,
    strongMomentPresent: false,
    momentFlatPenalty: 0.08,
    roleEnergyNote: 'flat route energy',
  }),
]

const selection = selectGreatStopGatePassingCandidate({
  candidates,
  intent,
  locationClass: 'L2 Mid',
  locationClassSource: 'explicit',
  stage: 'pre_selection_gate',
})

assert(!selection.selectedCandidate, 'All failing candidates must not produce a selected Great Stop candidate.')
assert(selection.diagnostics.status === 'FAIL', 'Selection diagnostics should fail.')
assert(selection.diagnostics.passingCandidateCount === 0, 'No candidate should pass.')
assert(
  selection.diagnostics.failedTopCandidateCriteria?.includes('place_right') &&
    selection.diagnostics.failedTopCandidateCriteria.includes('moment_right'),
  'Top failing candidate criteria should remain place_right and moment_right.',
)

const details = selection.diagnostics.greatStopCandidateFailureDetails
assert(details, 'Great Stop FAIL diagnostics must expose candidate-level failure details.')
assert(details.evaluatedCandidateCount === 6, 'Failure details must count every evaluated candidate.')
assert(details.passingCandidateCount === 0, 'Failure details must preserve passing count.')
assert(details.detailCandidateLimit === 5, 'Failure details must expose the deterministic cap.')
assert(details.topFailingCandidates.length === 5, 'Top failing candidate details must be capped.')
assert(
  details.nearestToPassCandidate?.candidateId === 'rank-5-moment-only',
  'Nearest-to-pass candidate should be selected by lowest failure severity, not first rank.',
)
assert(
  details.nearestToPassCandidate.routeNames.join(' -> ') ===
    'Start rank-5-moment-only -> Adega -> End rank-5-moment-only',
  'Nearest-to-pass detail must include route names.',
)
assert(
  details.nearestToPassCandidate.stopIds.includes('live_google_adega-provider-record') &&
    details.nearestToPassCandidate.baseVenueIds.includes('sj-adega-wine-atelier'),
  'Candidate details must expose raw stop ids and base venue ids.',
)
assert(
  details.nearestToPassCandidate.requiredAnchorPresent === true &&
    details.nearestToPassCandidate.requiredAnchorRole === 'highlight' &&
    details.nearestToPassCandidate.requiredAnchorRoleCorrect === true,
  'Candidate details must expose required-anchor survival and credited role.',
)
assert(
  details.topFailingCandidates[0]?.totalMovementEstimate === 32 &&
    details.topFailingCandidates[0]?.maxSingleTransitionEstimate === 16 &&
    details.topFailingCandidates[0]?.clusterPath.join('>') === 'north>central>south' &&
    details.topFailingCandidates[0]?.backtrackDetected === true &&
    details.topFailingCandidates[0]?.driveLikeMovementDetected === true,
  'Top failing detail must expose movement totals, max transition, cluster path, backtrack, and drive-like movement.',
)
assert(
  details.topFailingCandidates[0]?.momentFailureReasons.includes('moment_right:dead_flat_arc') &&
    details.topFailingCandidates[0]?.roleEnergyNote === 'flat route energy',
  'Top failing detail must expose moment failure reasons and role energy note.',
)
assert(
  details.topFailingCandidates[0]?.scoreSummary.totalScore === 0.8 &&
    details.topFailingCandidates[0]?.scoreSummary.highlightMomentScore === 0.28,
  'Top failing detail must expose safe score summary values.',
)
assert(
  details.candidatesFailingOnlyOneCriterionCount >= 3 &&
    details.candidatesFailingOnlyMovementCount === 1 &&
    details.candidatesFailingOnlyMomentCount >= 2 &&
    details.candidatesFailingBothPlaceAndMomentCount >= 3,
  'Failure details must aggregate one-criterion, movement-only, moment-only, and place+moment counts.',
)
assert(
  details.repeatedFailureReasonCounts['place_right:total_movement_over_preset'] === 4 &&
    details.repeatedFailureReasonCounts['moment_right:dead_flat_arc'] >= 4,
  'Failure details must aggregate repeated reasons instead of relying on huge repeated strings.',
)
assert(
  details.requiredAnchorPreservedCount === 6 &&
    details.compactnessCandidateCount === 2 &&
    details.backtrackPatternCount === 3,
  'Failure details must expose required-anchor, compactness, and backtrack aggregate counts.',
)
assert(
  selection.diagnostics.failureReasons.filter(
    (reason) => reason === 'place_right:total_movement_over_preset',
  ).length > 1,
  'Existing full failureReasons remains unchanged for compatibility.',
)

const repoRoot = process.cwd()
const routeAuthoritySource = readFileSync(
  join(repoRoot, 'src/app/services/routeAuthority/routeAuthorityService.ts'),
  'utf8',
)
const runtimeRouteArtifactSource = readFileSync(
  join(repoRoot, 'src/domain/artifacts/runtimeRouteArtifact.ts'),
  'utf8',
)
const gateSource = readFileSync(
  join(repoRoot, 'src/domain/greatStop/buildGreatStopGateResult.ts'),
  'utf8',
)

assert(
  gateSource.includes("maxComfortableTotalMovementMinutes: 24") &&
    gateSource.includes("maxSingleTransitionMinutes: 14") &&
    gateSource.includes("driveLikeMovement: 'limited'"),
  'Great Stop L2 Mid thresholds must remain unchanged.',
)
assert(
  routeAuthoritySource.includes('provider_shadow_not_authority'),
  'provider_shadow must remain non-authoritative.',
)
assert(
  !routeAuthoritySource.includes('greatStopCandidateFailureDetails'),
  'Candidate failure diagnostics must not patch routeAuthority.',
)
assert(
  !runtimeRouteArtifactSource.includes('greatStopCandidateFailureDetails'),
  'RuntimeRouteArtifact shape must not absorb Great Stop candidate failure diagnostics.',
)

const output = {
  greatStopCandidateFailureDetailsPresent: true,
  evaluatedCandidateCount: details.evaluatedCandidateCount,
  passingCandidateCount: details.passingCandidateCount,
  detailCandidateLimit: details.detailCandidateLimit,
  topFailingCandidateCount: details.topFailingCandidates.length,
  nearestToPassCandidate: details.nearestToPassCandidate?.candidateId,
  nearestRouteNames: details.nearestToPassCandidate?.routeNames,
  nearestStopIds: details.nearestToPassCandidate?.stopIds,
  nearestBaseVenueIds: details.nearestToPassCandidate?.baseVenueIds,
  firstFailingCandidateMovement: {
    totalMovementEstimate: details.topFailingCandidates[0]?.totalMovementEstimate,
    maxSingleTransitionEstimate: details.topFailingCandidates[0]?.maxSingleTransitionEstimate,
    clusterPath: details.topFailingCandidates[0]?.clusterPath,
    clusterEscapeCount: details.topFailingCandidates[0]?.clusterEscapeCount,
    backtrackDetected: details.topFailingCandidates[0]?.backtrackDetected,
    driveLikeMovementDetected: details.topFailingCandidates[0]?.driveLikeMovementDetected,
  },
  firstFailingCandidateMoment: {
    momentFailureReasons: details.topFailingCandidates[0]?.momentFailureReasons,
    roleEnergyNote: details.topFailingCandidates[0]?.roleEnergyNote,
  },
  aggregateCounts: {
    candidatesFailingOnlyOneCriterionCount: details.candidatesFailingOnlyOneCriterionCount,
    candidatesFailingOnlyMovementCount: details.candidatesFailingOnlyMovementCount,
    candidatesFailingOnlyMomentCount: details.candidatesFailingOnlyMomentCount,
    candidatesFailingBothPlaceAndMomentCount:
      details.candidatesFailingBothPlaceAndMomentCount,
    requiredAnchorPreservedCount: details.requiredAnchorPreservedCount,
    compactnessCandidateCount: details.compactnessCandidateCount,
    backtrackPatternCount: details.backtrackPatternCount,
  },
  repeatedFailureReasonCounts: details.repeatedFailureReasonCounts,
  greatStopBehaviorUnchanged: !selection.selectedCandidate && selection.diagnostics.status === 'FAIL',
  greatStopThresholdsUnchanged: true,
  routeAuthorityUnchanged: !routeAuthoritySource.includes('greatStopCandidateFailureDetails'),
  runtimeRouteArtifactShapeUnchanged: !runtimeRouteArtifactSource.includes('greatStopCandidateFailureDetails'),
  providerShadowRemainsNonAuthoritative: routeAuthoritySource.includes('provider_shadow_not_authority'),
  fetchCallCount,
}

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
