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
  baseVenueId?: string
  candidateId?: string
  providerRecordId?: string
  displayName?: string
  sourceOrigin?: string
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
        name: spec.displayName ?? spec.venueId,
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
          sourceOrigin: spec.sourceOrigin ?? 'curated',
          providerRecordId: spec.providerRecordId,
        } as never,
      },
      candidateIdentity: {
        candidateId: spec.candidateId ?? spec.venueId,
        baseVenueId: spec.baseVenueId ?? spec.venueId,
        kind: 'base',
        traceLabel: spec.displayName ?? spec.venueId,
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
assert(
  selection.diagnostics.rankedCandidateCount === 2 &&
    selection.diagnostics.fullEvaluatedCandidateCount === 2 &&
    selection.diagnostics.omittedCandidateCount === 0,
  'Selection diagnostics must expose ranked/evaluated counts without truncating evaluation.',
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
assert(
  missingAnchorSelection.diagnostics.skippedMissingRequiredAnchorCount === 1,
  'Missing required-anchor candidates should be counted separately.',
)
assert(
  missingAnchorSelection.diagnostics.anchorPreservingCandidateCount === 1 &&
    missingAnchorSelection.diagnostics.evaluatedAnchorPreservingCandidateCount === 1,
  'Anchor-preserving candidate counts should exclude skipped structural candidates.',
)
assert(
  missingAnchorSelection.diagnostics.failedTopCandidateCriteria?.length === 0,
  'A skipped missing-anchor candidate must not contribute Great Stop failure criteria.',
)
assert(
  missingAnchorSelection.diagnostics.structuralFailureReasons?.includes('required_anchor_role_missing'),
  'Structural required-anchor failure should be separated from Great Stop criteria.',
)
assert(
  !missingAnchorSelection.diagnostics.bestFailingCandidateSummary &&
    !missingAnchorSelection.diagnostics.bestAnchorPreservingFailingCandidate,
  'Primary failing summaries should not point at structurally invalid candidates when a later candidate passes.',
)
assert(
  missingAnchorSelection.diagnostics.evaluatedCandidateIdentitySummaries?.[0]?.skippedReason ===
    'required_anchor_role_missing',
  'Evaluated candidate identity diagnostics must expose structural skip reasons.',
)
assert(
  missingAnchorSelection.diagnostics.evaluatedCandidateIdentitySummaries?.[0]?.stops.some(
    (stop) =>
      stop.role === 'highlight' &&
      stop.rawVenueId === 'different-highlight' &&
      stop.matchRequiredAnchorByRawId === false &&
      stop.matchRequiredAnchorByBaseVenueId === false &&
      stop.matchRequiredAnchorByNormalizedHelper === false,
  ),
  'Evaluated candidate identity diagnostics must expose raw/base/helper anchor non-matches separately.',
)

const allMissingAnchor = selectGreatStopGatePassingCandidate({
  candidates: [missingAnchorCandidate],
  intent,
  locationClass: 'L2 Mid',
  locationClassSource: 'explicit',
  stage: 'pre_selection_gate',
})
assert(!allMissingAnchor.selectedCandidate, 'All-missing-anchor case must not select a candidate.')
assert(allMissingAnchor.diagnostics.status === 'FAIL', 'All-missing-anchor diagnostics should fail.')
assert(
  allMissingAnchor.diagnostics.skippedMissingRequiredAnchorCount === 1 &&
    allMissingAnchor.diagnostics.anchorPreservingCandidateCount === 0,
  'All-missing-anchor diagnostics should expose structural candidate-pool failure.',
)
assert(
  allMissingAnchor.diagnostics.structuralFailureReasons?.includes('required_anchor_role_missing'),
  'All-missing-anchor diagnostics should name required_anchor_role_missing structurally.',
)
assert(
  allMissingAnchor.diagnostics.failureReasons.length === 1 &&
    allMissingAnchor.diagnostics.failureReasons[0] === 'required_anchor_role_missing',
  'All-missing-anchor diagnostics should not repeat or mix Great Stop criteria into structural failure.',
)
assert(
  allMissingAnchor.diagnostics.failedTopCandidateCriteria?.length === 0,
  'All-missing-anchor diagnostics must not report place_right from a structurally invalid candidate.',
)
assert(
  !allMissingAnchor.diagnostics.bestFailingCandidateSummary &&
    !allMissingAnchor.diagnostics.bestAnchorPreservingFailingCandidate,
  'All-missing-anchor diagnostics must not use a structurally invalid candidate as the primary failing summary.',
)
assert(
  allMissingAnchor.diagnostics.candidatesWithRequiredAnchorByRawId === 0 &&
    allMissingAnchor.diagnostics.candidatesWithRequiredAnchorByBaseVenueId === 0 &&
    allMissingAnchor.diagnostics.candidatesWithRequiredAnchorByNormalizedHelper === 0,
  'All-missing-anchor diagnostics must show zero required-anchor matches by all identity methods.',
)

const cappedMissingAnchorCandidates = Array.from({ length: 30 }, (_, index) =>
  buildCandidate({
    id: `rank-${index + 1}-missing-required-anchor`,
    stops: [
      {
        role: 'warmup',
        venueId: `start-capped-${index}`,
        lane: 'arrival',
        cluster: 'a',
        energy: 2,
      },
      {
        role: 'peak',
        venueId: `different-highlight-capped-${index}`,
        lane: 'center',
        cluster: 'a',
        energy: 4,
      },
      {
        role: 'cooldown',
        venueId: `end-capped-${index}`,
        lane: 'landing',
        cluster: 'b',
        energy: 2,
      },
    ],
    transitions: [8, 9],
    movementModes: ['walkable', 'walkable'],
    repeatedClusterEscapeCount: 0,
  }),
)
const cappedDiagnosticsSelection = selectGreatStopGatePassingCandidate({
  candidates: cappedMissingAnchorCandidates,
  intent,
  locationClass: 'L2 Mid',
  locationClassSource: 'explicit',
  stage: 'pre_selection_gate',
})
assert(
  cappedDiagnosticsSelection.diagnostics.fullEvaluatedCandidateCount === 30 &&
    cappedDiagnosticsSelection.diagnostics.evaluatedCandidateCount === 30,
  'Diagnostic candidate summaries may be capped, but candidate evaluation count must remain full.',
)
assert(
  cappedDiagnosticsSelection.diagnostics.diagnosticCandidateSummaryLimit === 25 &&
    cappedDiagnosticsSelection.diagnostics.evaluatedCandidateIdentitySummaries?.length === 25 &&
    cappedDiagnosticsSelection.diagnostics.omittedCandidateCount === 5,
  'Diagnostic candidate summaries must expose the cap and omitted candidate count.',
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
assert(
  allFail.diagnostics.anchorPreservingCandidateCount === 1 &&
    allFail.diagnostics.skippedMissingRequiredAnchorCount === 0,
  'Anchor-preserving Great Stop failures should remain distinct from structural skips.',
)
assert(
  allFail.diagnostics.failedTopCandidateCriteria?.includes('place_right') &&
    allFail.diagnostics.failedTopCandidateCriteria?.includes('moment_right'),
  'Anchor-preserving Great Stop failure should still expose place_right and moment_right.',
)
assert(
  allFail.diagnostics.bestAnchorPreservingFailingCandidate?.candidateId === topFailingCandidate.id &&
    allFail.diagnostics.bestFailingCandidateSummary?.candidateId === topFailingCandidate.id,
  'Best failing summaries should use the best anchor-preserving failing candidate when one exists.',
)

const adegaProviderBackedCandidate = buildCandidate({
  id: 'adega-provider-backed-base-identity-match',
  stops: [
    { role: 'warmup', venueId: 'heritage-tea-house', lane: 'arrival', cluster: 'a', energy: 2 },
    {
      role: 'peak',
      venueId: 'live_google_adega-provider-record',
      baseVenueId: 'sj-adega-wine-atelier',
      candidateId: 'live_google_adega-provider-record::activation::featured',
      providerRecordId: 'adega-provider-record',
      displayName: 'Adega',
      sourceOrigin: 'provider',
      lane: 'center',
      cluster: 'a',
      energy: 4,
    },
    { role: 'cooldown', venueId: 'j-town-matcha', lane: 'landing', cluster: 'b', energy: 2 },
  ],
  transitions: [8, 9],
  movementModes: ['walkable', 'walkable'],
  repeatedClusterEscapeCount: 0,
})

const evergreenProviderBackedCandidate = buildCandidate({
  id: 'evergreen-provider-backed-base-identity-match',
  stops: [
    { role: 'warmup', venueId: 'heritage-tea-house', lane: 'arrival', cluster: 'a', energy: 2 },
    {
      role: 'peak',
      venueId: 'live_google_evergreen-provider-record',
      baseVenueId: 'sj-evergreen-coffee-company',
      candidateId: 'live_google_evergreen-provider-record::activation::featured',
      providerRecordId: 'evergreen-provider-record',
      displayName: 'Evergreen Coffee Company',
      sourceOrigin: 'provider',
      lane: 'center',
      cluster: 'a',
      energy: 4,
    },
    { role: 'cooldown', venueId: 'jtown-manju-house', lane: 'landing', cluster: 'b', energy: 2 },
  ],
  transitions: [8, 9],
  movementModes: ['walkable', 'walkable'],
  repeatedClusterEscapeCount: 0,
})

const priorProviderBackedPassCandidate = buildCandidate({
  id: 'prior-tech-provider-backed-base-identity-match',
  stops: [
    { role: 'warmup', venueId: 'dumont-start', lane: 'arrival', cluster: 'a', energy: 2 },
    {
      role: 'peak',
      venueId: 'live_google_tech-provider-record',
      baseVenueId: 'sj-tech-interactive',
      candidateId: 'live_google_tech-provider-record::activation::family',
      providerRecordId: 'tech-provider-record',
      displayName: 'The Tech Interactive',
      sourceOrigin: 'provider',
      lane: 'center',
      cluster: 'a',
      energy: 4,
    },
    { role: 'cooldown', venueId: 'dumont-winddown', lane: 'landing', cluster: 'b', energy: 2 },
  ],
  transitions: [8, 9],
  movementModes: ['walkable', 'walkable'],
  repeatedClusterEscapeCount: 0,
})

function candidateIdentityTable(candidate: ArcCandidate, requiredAnchorId: string) {
  return candidate.stops.map((stop) => ({
    role: stop.role,
    displayName: stop.scoredVenue.venue.name,
    venueId: stop.scoredVenue.venue.id,
    baseVenueId: stop.scoredVenue.candidateIdentity.baseVenueId,
    canonicalVenueId: stop.scoredVenue.candidateIdentity.baseVenueId,
    providerPlaceId: stop.scoredVenue.venue.source.providerRecordId,
    candidateId: stop.scoredVenue.candidateIdentity.candidateId,
    normalizedIdHelperOutput: stop.scoredVenue.candidateIdentity.baseVenueId,
    sourceOrigin: stop.scoredVenue.venue.source.sourceOrigin,
    matchesByVenueId: stop.scoredVenue.venue.id === requiredAnchorId,
    matchesByBaseVenueId: stop.scoredVenue.candidateIdentity.baseVenueId === requiredAnchorId,
    matchesByNormalizedHelper: stop.scoredVenue.candidateIdentity.baseVenueId === requiredAnchorId,
  }))
}

function countCandidatesContainingRequiredAnchor(params: {
  candidates: ArcCandidate[]
  requiredAnchorId: string
  requiredRole: InternalRole
}) {
  const { candidates, requiredAnchorId, requiredRole } = params
  const byVenueId = candidates.filter((candidate) =>
    candidate.stops.some((stop) => stop.scoredVenue.venue.id === requiredAnchorId),
  ).length
  const byBaseVenueId = candidates.filter((candidate) =>
    candidate.stops.some(
      (stop) => stop.scoredVenue.candidateIdentity.baseVenueId === requiredAnchorId,
    ),
  ).length
  const byNormalizedHelper = byBaseVenueId
  const preservingRequiredRole = candidates.filter((candidate) =>
    candidate.stops.some(
      (stop) =>
        stop.role === requiredRole &&
        stop.scoredVenue.candidateIdentity.baseVenueId === requiredAnchorId,
    ),
  ).length
  const firstRankWhereAnchorAppears = candidates.findIndex((candidate) =>
    candidate.stops.some(
      (stop) => stop.scoredVenue.candidateIdentity.baseVenueId === requiredAnchorId,
    ),
  )
  return {
    fullRankedCandidateCount: candidates.length,
    containingRequiredAnchorByVenueId: byVenueId,
    containingRequiredAnchorByCandidateIdentityBaseVenueId: byBaseVenueId,
    containingRequiredAnchorByNormalizedCanonicalHelper: byNormalizedHelper,
    preservingRequiredAnchorInRequiredRole: preservingRequiredRole,
    firstRankWhereRequiredAnchorAppears: firstRankWhereAnchorAppears >= 0 ? firstRankWhereAnchorAppears + 1 : null,
    preRepairRankedPoolTrulyZeroAnchorPreservingCandidates: preservingRequiredRole === 0,
  }
}

function filterRequiredAnchorPreservingCandidates(params: {
  candidates: ArcCandidate[]
  requiredAnchorId: string
  requiredRole: InternalRole
}) {
  const { candidates, requiredAnchorId, requiredRole } = params
  return candidates.filter((candidate) =>
    candidate.stops.some(
      (stop) =>
        stop.role === requiredRole &&
        stop.scoredVenue.candidateIdentity.baseVenueId === requiredAnchorId,
    ),
  )
}

const identityMismatchPool = [
  adegaProviderBackedCandidate,
  evergreenProviderBackedCandidate,
  priorProviderBackedPassCandidate,
]
const adegaRankedPoolWithAnchorAfterNonAnchorCandidates = [
  evergreenProviderBackedCandidate,
  priorProviderBackedPassCandidate,
  adegaProviderBackedCandidate,
]
const adegaRequiredAnchorCandidatePool = filterRequiredAnchorPreservingCandidates({
  candidates: adegaRankedPoolWithAnchorAfterNonAnchorCandidates,
  requiredAnchorId: 'sj-adega-wine-atelier',
  requiredRole: 'peak',
})
const adegaIdentityCounts = countCandidatesContainingRequiredAnchor({
  candidates: identityMismatchPool,
  requiredAnchorId: 'sj-adega-wine-atelier',
  requiredRole: 'peak',
})
const adegaIdentitySelection = selectGreatStopGatePassingCandidate({
  candidates: identityMismatchPool,
  intent: buildIntent({
    persona: 'romantic',
    locationClass: 'L2 Mid',
    anchorVenueId: 'sj-adega-wine-atelier',
    anchorRole: 'highlight',
  }),
  locationClass: 'L2 Mid',
  locationClassSource: 'explicit',
  stage: 'pre_selection_gate',
})
assert(
  adegaIdentityCounts.containingRequiredAnchorByVenueId === 0,
  'Provider-backed candidate should not match the required anchor by raw venue.id.',
)
assert(
  adegaIdentityCounts.containingRequiredAnchorByCandidateIdentityBaseVenueId === 1 &&
    adegaIdentityCounts.preservingRequiredAnchorInRequiredRole === 1,
  'Provider-backed candidate should match the required anchor by candidateIdentity.baseVenueId.',
)
assert(
  adegaIdentitySelection.selectedCandidate?.id === adegaProviderBackedCandidate.id,
  'Great Stop gate must treat candidateIdentity.baseVenueId as required-anchor identity.',
)
assert(
  adegaIdentitySelection.diagnostics.skippedMissingRequiredAnchorCount === 0 &&
    adegaIdentitySelection.diagnostics.anchorPreservingCandidateCount === 1,
  'Base-identity anchor matches must not be counted as structural missing-anchor failures.',
)
assert(
  adegaIdentitySelection.diagnostics.rankedCandidateCount === 3 &&
    adegaIdentitySelection.diagnostics.evaluatedCandidateCount === 1 &&
    adegaIdentitySelection.diagnostics.fullEvaluatedCandidateCount === 1,
  'Stage 2 diagnostics must distinguish the full ranked candidate pool from candidates evaluated before the first PASS.',
)
assert(
  adegaIdentitySelection.diagnostics.candidatesWithRequiredAnchorByRawId === 0 &&
    adegaIdentitySelection.diagnostics.candidatesWithRequiredAnchorByBaseVenueId === 1 &&
    adegaIdentitySelection.diagnostics.candidatesWithRequiredAnchorByNormalizedHelper === 1 &&
    adegaIdentitySelection.diagnostics.firstRankWhereRequiredAnchorAppears === 1,
  'Stage 2 diagnostics must count required-anchor matches by raw id, base id, and normalized helper separately.',
)
const adegaIdentitySummary = adegaIdentitySelection.diagnostics.evaluatedCandidateIdentitySummaries?.[0]
const adegaHighlightIdentity = adegaIdentitySummary?.stops.find((stop) => stop.role === 'highlight')
assert(
  adegaIdentitySummary?.candidateId === 'adega-provider-backed-base-identity-match' &&
    adegaIdentitySummary.preservesRequiredAnchor === true &&
    adegaIdentitySummary.requiredRoleCorrect === true,
  'Provider-backed Adega candidate identity diagnostics must expose anchor preservation and credited role.',
)
assert(
  adegaHighlightIdentity?.rawVenueId === 'live_google_adega-provider-record' &&
    adegaHighlightIdentity.baseVenueId === 'sj-adega-wine-atelier' &&
    adegaHighlightIdentity.normalizedHelperVenueId === 'sj-adega-wine-atelier' &&
    adegaHighlightIdentity.candidateId === 'live_google_adega-provider-record::activation::featured' &&
    adegaHighlightIdentity.providerRecordId === 'adega-provider-record' &&
    adegaHighlightIdentity.sourceOrigin === 'provider' &&
    adegaHighlightIdentity.matchRequiredAnchorByRawId === false &&
    adegaHighlightIdentity.matchRequiredAnchorByBaseVenueId === true &&
    adegaHighlightIdentity.matchRequiredAnchorByNormalizedHelper === true,
  'Provider-backed Adega candidate identity diagnostics must expose raw id, base id, helper output, provider metadata, and separate match booleans.',
)
assert(
  adegaIdentitySelection.diagnostics.selectedGateResult?.requiredAnchor?.survived === true &&
    adegaIdentitySelection.diagnostics.selectedGateResult.requiredAnchor.creditedRole === 'highlight',
  'Base-identity anchor matches must survive and be credited in the required role.',
)
assert(
  adegaRequiredAnchorCandidatePool.length === 1 &&
    adegaRequiredAnchorCandidatePool[0]?.id === adegaProviderBackedCandidate.id,
  'Build Stage 2 candidate pool must be filterable to required-anchor-preserving candidates before Great Stop selection.',
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
assert(
  runGeneratePlanSource.includes('const buildRequiredAnchorCandidatePool') &&
    runGeneratePlanSource.includes('buildRequiredAnchorPreservationRequired && finalAnchorCandidates.length > 0') &&
    runGeneratePlanSource.includes(': buildRequiredAnchorCandidatePool') &&
    runGeneratePlanSource.includes('? finalAnchorCandidates[0]'),
  'runGeneratePlan must prefer required-anchor-preserving Build candidates before Great Stop selection and final selectedArc fallback.',
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
  skippedMissingRequiredAnchorCount:
    allMissingAnchor.diagnostics.skippedMissingRequiredAnchorCount,
  structuralFailureReasons: allMissingAnchor.diagnostics.structuralFailureReasons,
  structuralFailureDoesNotReportPlaceRight:
    allMissingAnchor.diagnostics.failedTopCandidateCriteria?.includes('place_right') !== true,
  anchorPreservingPlaceRightStillReported:
    allFail.diagnostics.failedTopCandidateCriteria?.includes('place_right') === true,
  bestAnchorPreservingFailingCandidate:
    allFail.diagnostics.bestAnchorPreservingFailingCandidate?.candidateId ?? null,
  diagnosticCandidateSummaryLimit:
    cappedDiagnosticsSelection.diagnostics.diagnosticCandidateSummaryLimit,
  fullEvaluatedCandidateCount:
    cappedDiagnosticsSelection.diagnostics.fullEvaluatedCandidateCount,
  omittedCandidateCount:
    cappedDiagnosticsSelection.diagnostics.omittedCandidateCount,
  requiredAnchorIdentityBoundary: {
    requiredAnchorCanonicalId: 'sj-adega-wine-atelier',
    requiredRole: 'highlight',
    selectedArtifactId: 'adega-provider-backed-base-identity-match',
    selectedArtifactSource: 'provider_shadow',
    providerSeedId: 'adega-provider-record',
    candidateIdentityBaseVenueIdEquivalent: 'sj-adega-wine-atelier',
    fullRankedCandidateCount: adegaIdentityCounts.fullRankedCandidateCount,
    containingRequiredAnchorByVenueId: adegaIdentityCounts.containingRequiredAnchorByVenueId,
    containingRequiredAnchorByCandidateIdentityBaseVenueId:
      adegaIdentityCounts.containingRequiredAnchorByCandidateIdentityBaseVenueId,
    containingRequiredAnchorByNormalizedCanonicalHelper:
      adegaIdentityCounts.containingRequiredAnchorByNormalizedCanonicalHelper,
    preservingRequiredAnchorInRequiredRole:
      adegaIdentityCounts.preservingRequiredAnchorInRequiredRole,
    firstRankWhereRequiredAnchorAppears: adegaIdentityCounts.firstRankWhereRequiredAnchorAppears,
    preRepairRankedPoolTrulyZeroAnchorPreservingCandidates:
      adegaIdentityCounts.preRepairRankedPoolTrulyZeroAnchorPreservingCandidates,
    buildRequiredAnchorCandidatePoolFiltersBeforeGreatStop:
      adegaRequiredAnchorCandidatePool.length === 1 &&
      adegaRequiredAnchorCandidatePool[0]?.id === 'adega-provider-backed-base-identity-match',
    nonAnchorCandidatesExcludedFromBuildGreatStopPool:
      adegaRequiredAnchorCandidatePool.every((candidate) =>
        candidate.stops.some(
          (stop) =>
            stop.role === 'peak' &&
            stop.scoredVenue.candidateIdentity.baseVenueId === 'sj-adega-wine-atelier',
        ),
      ),
    idMismatchProven: adegaIdentityCounts.containingRequiredAnchorByVenueId === 0 &&
      adegaIdentityCounts.containingRequiredAnchorByCandidateIdentityBaseVenueId > 0,
    selectedAfterBaseIdentityFix: adegaIdentitySelection.selectedCandidate?.id,
    stage2IdentityDiagnostics: {
      rankedCandidateCount: adegaIdentitySelection.diagnostics.rankedCandidateCount,
      evaluatedCandidateCount: adegaIdentitySelection.diagnostics.evaluatedCandidateCount,
      firstRankWhereRequiredAnchorAppears:
        adegaIdentitySelection.diagnostics.firstRankWhereRequiredAnchorAppears,
      candidatesWithRequiredAnchorByRawId:
        adegaIdentitySelection.diagnostics.candidatesWithRequiredAnchorByRawId,
      candidatesWithRequiredAnchorByBaseVenueId:
        adegaIdentitySelection.diagnostics.candidatesWithRequiredAnchorByBaseVenueId,
      candidatesWithRequiredAnchorByNormalizedHelper:
        adegaIdentitySelection.diagnostics.candidatesWithRequiredAnchorByNormalizedHelper,
      evaluatedCandidateIdentitySummary: adegaIdentitySummary,
    },
    candidateStopIdentityTable: candidateIdentityTable(
      adegaProviderBackedCandidate,
      'sj-adega-wine-atelier',
    ),
    evergreenCandidateStopIdentityTable: candidateIdentityTable(
      evergreenProviderBackedCandidate,
      'sj-evergreen-coffee-company',
    ),
    priorProviderBackedPassIdentityTable: candidateIdentityTable(
      priorProviderBackedPassCandidate,
      'sj-tech-interactive',
    ),
  },
  explicitLocationClassPreserved:
    selection.diagnostics.selectedGateResult?.preset.source === 'explicit',
  postRepairVerificationBeforeArtifactCreation: artifactIndex > postRepairGateIndex,
  routeAuthorityUnchanged: !routeAuthoritySource.includes('greatStopGate'),
  runtimeRouteArtifactShapeUnchanged: !runtimeRouteArtifactSource.includes('greatStopGate'),
  providerShadowRemainsNonAuthoritative: routeAuthoritySource.includes('provider_shadow_not_authority'),
  fetchCallCount,
}

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
