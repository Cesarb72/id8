import assert from 'node:assert/strict'
import { sanJoseVenues } from '../src/data/venues.ts'
import {
  buildApplicationConciergeIntent,
  projectConciergeIntentToIntentInput,
} from '../src/app/concierge/conciergeIntentAdapter.ts'
import { runPlanBuildWithLegacyPlaceRightFallback } from '../src/app/services/arcApplicationService.ts'
import { buildCanonicalSurpriseC1RouteShapeContract } from '../src/domain/arc/buildCanonicalSurpriseC1RouteShapeContract.ts'
import {
  getArcStopBaseVenueId,
  getArcStopCandidateId,
} from '../src/domain/candidates/candidateIdentity.ts'
import { buildContractGateWorldFromCanonical } from '../src/domain/bearings/buildContractGateWorld.ts'
import { buildStrategyAdmissibleWorlds } from '../src/domain/bearings/buildStrategyAdmissibleWorlds.ts'
import { buildDirectionCandidates, type DirectionCandidate } from '../src/domain/direction/buildDirectionCandidates.ts'
import { buildCanonicalInterpretationBundle } from '../src/domain/interpretation/buildCanonicalInterpretationBundle.ts'
import { buildDistrictOpportunityProfiles } from '../src/domain/interpretation/district/intelligence/buildDistrictOpportunityProfiles.ts'
import {
  buildDirectionPlanningSelection,
  buildIntentSelectedDirectionContext,
  buildResolvedDirectionContext,
} from '../src/domain/interpretation/direction/selectedDirectionProjection.ts'
import { getCrewPolicy } from '../src/domain/intent/getCrewPolicy.ts'
import { approveFinalRouteCandidate } from '../src/domain/routeApproval/approveFinalRouteCandidate.ts'
import type { GeneratePlanResult, RunGeneratePlanOptions } from '../src/domain/runGeneratePlan.ts'
import type { ArcCandidate } from '../src/domain/types/arc.ts'
import type { RefinementMode } from '../src/domain/types/refinement.ts'
import type { Venue } from '../src/domain/types/venue.ts'

let fetchCalls = 0
globalThis.fetch = ((input: RequestInfo | URL) => {
  fetchCalls += 1
  throw new Error(`Targeted refinement final-route approval proof must not call providers: ${String(input)}`)
}) as typeof fetch

const refinementModes: RefinementMode[] = [
  'little-fancier',
  'more-exciting',
  'more-relaxed',
  'closer-by',
  'more-unique',
]

function directionSelectionFromCandidate(candidate: DirectionCandidate) {
  return buildDirectionPlanningSelection({
    id: candidate.id,
    label: candidate.label,
    subtitle: candidate.subtitle,
    pocketId: candidate.pocketId,
    pocketLabel: candidate.pocketLabel,
    archetype: candidate.archetype,
    cluster: candidate.cluster,
    experienceFamily: candidate.experienceFamily,
    familyConfidence: candidate.familyConfidence,
    laneIdentity: candidate.contrastProfile.laneIdentity,
    macroLane: candidate.contrastProfile.macroLane,
  })
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function candidateSignature(candidate: ArcCandidate): string {
  return candidate.stops.map((stop) => `${stop.role}:${getArcStopCandidateId(stop)}`).join('|')
}

function baseRouteSignature(candidate: ArcCandidate): string {
  return candidate.stops.map((stop) => `${stop.role}:${getArcStopBaseVenueId(stop)}`).join('|')
}

function itinerarySignature(result: GeneratePlanResult): string {
  const roleToInternal = {
    start: 'warmup',
    highlight: 'peak',
    surprise: 'wildcard',
    windDown: 'cooldown',
  } as const
  return result.itinerary.stops
    .map((stop) => `${roleToInternal[stop.role]}:${stop.venueId}`)
    .join('|')
}

function weakenComposition(candidate: ArcCandidate, id: string): ArcCandidate {
  const next = clone(candidate)
  next.id = id
  next.stops.forEach((stop) => {
    stop.scoredVenue.roleScores = {
      warmup: 0.08,
      peak: 0.08,
      wildcard: 0.08,
      cooldown: 0.08,
    }
    stop.scoredVenue.stopShapeFit = {
      start: 0.08,
      highlight: 0.08,
      surprise: 0.08,
      windDown: 0.08,
    }
    stop.scoredVenue.vibeAuthority.overall = 0.08
    stop.scoredVenue.vibeAuthority.byRole = {
      start: 0.08,
      highlight: 0.08,
      surprise: 0.08,
      windDown: 0.08,
    }
    stop.scoredVenue.contextSpecificity.overall = 0.08
    stop.scoredVenue.contextSpecificity.byRole = {
      warmup: 0.08,
      peak: 0.08,
      wildcard: 0.08,
      cooldown: 0.08,
    }
    stop.scoredVenue.taste.signals.momentPotential.score = 0.08
    stop.scoredVenue.taste.signals.momentIntensity.score = 0.08
    stop.scoredVenue.taste.signals.primaryExperienceArchetype = 'generic_mismatch' as never
    stop.scoredVenue.momentIdentity = {
      type: 'support' as never,
      strength: 'light',
    }
    stop.scoredVenue.highlightValidity.validityLevel = 'invalid'
  })
  return next
}

function staleFieldCandidate(candidate: ArcCandidate, id: string): ArcCandidate {
  const next = clone(candidate)
  next.id = id
  const target = next.stops.find((stop) => stop.role === 'cooldown') ?? next.stops[0]
  assert(target, 'Expected at least one stop for stale Field proof.')
  target.scoredVenue.venue.source.sourceConfidence = 0
  return next
}

function closedVenueCandidate(candidate: ArcCandidate, id: string): ArcCandidate {
  const next = clone(candidate)
  next.id = id
  const target = next.stops.find((stop) => stop.role === 'cooldown') ?? next.stops[0]
  assert(target, 'Expected at least one stop for closed-stop proof.')
  target.scoredVenue.venue.isActive = false
  return next
}

async function buildWorld(seedVenues: Venue[] = sanJoseVenues) {
  const conciergeIntent = buildApplicationConciergeIntent({
    mode: 'surprise',
    persona: 'romantic',
    primaryVibe: 'cultured',
    city: 'San Jose',
  })
  const canonicalInterpretationBundle = buildCanonicalInterpretationBundle({
    conciergeIntent,
    interpretationSource: 'scripts.targeted_refinement_final_route_approval',
  })
  const districtPreview = await buildDistrictOpportunityProfiles({
    locationQuery: 'San Jose',
    includeDebug: true,
  })
  const contractGateWorld = buildContractGateWorldFromCanonical({
    canonicalInterpretationBundle,
    ranked: districtPreview.ranked,
    source: 'scripts.targeted_refinement_final_route_approval',
  })
  const strategyAdmissibleWorlds = buildStrategyAdmissibleWorlds({ contractGateWorld })
  const directionCandidates = buildDirectionCandidates({
    ranked: districtPreview.ranked,
    debug: districtPreview.debug,
    contractGateWorld,
    strategyAdmissibleWorlds,
    context: {
      persona: 'romantic',
      vibe: 'cultured',
      experienceContract: canonicalInterpretationBundle.experienceContract,
      contractConstraints: canonicalInterpretationBundle.contractConstraints,
    },
  })
  assert(directionCandidates.length > 0, 'Expected a canonical direction.')
  const selectedDirection = directionSelectionFromCandidate(directionCandidates[0]!)
  const selectedDirectionContext = buildResolvedDirectionContext(selectedDirection)
  assert(selectedDirectionContext, 'Expected resolved selected direction context.')
  const routeShapeContract = buildCanonicalSurpriseC1RouteShapeContract({
    conciergeIntent,
    canonicalInterpretationBundle,
    selectedDirection,
    selectedDirectionContext,
  })
  const input = projectConciergeIntentToIntentInput({
    conciergeIntent,
    mode: 'surprise',
    city: 'San Jose',
    district: selectedDirection.pocketLabel,
    distanceMode: 'nearby',
    selectedDirectionContext: buildIntentSelectedDirectionContext(selectedDirection),
  })
  const commonOptions = {
    seedVenues,
    sourceMode: 'curated' as const,
    sourceModeOverrideApplied: true,
    debugMode: false,
    experienceContract: canonicalInterpretationBundle.experienceContract,
    contractConstraints: canonicalInterpretationBundle.contractConstraints,
    canonicalInterpretationBundle,
    rankedDistrictPockets: districtPreview.ranked,
    contractGateWorld,
    strategyAdmissibleWorlds,
  } satisfies RunGeneratePlanOptions
  const baseline = await runPlanBuildWithLegacyPlaceRightFallback(input, {
    ...commonOptions,
    routeShapeContract,
  })
  return {
    conciergeIntent,
    input,
    commonOptions,
    routeShapeContract,
    baseline,
  }
}

async function runRefinement(
  world: Awaited<ReturnType<typeof buildWorld>>,
  mode: RefinementMode,
  options: Partial<RunGeneratePlanOptions> = {},
) {
  const input = {
    ...world.input,
    refinementModes: [mode],
  }
  return runPlanBuildWithLegacyPlaceRightFallback(input, {
    ...world.commonOptions,
    routeShapeContract: world.routeShapeContract,
    baselineArc: world.baseline.selectedArc,
    baselineTrace: world.baseline.trace,
    baselineItineraryId: world.baseline.itinerary.id,
    ...options,
  })
}

const world = await buildWorld()
const repeatedBaseline = await runPlanBuildWithLegacyPlaceRightFallback(world.input, {
  ...world.commonOptions,
  routeShapeContract: world.routeShapeContract,
})
assert.equal(candidateSignature(world.baseline.selectedArc), candidateSignature(repeatedBaseline.selectedArc))

const refinementResults = []
for (const mode of refinementModes) {
  const active = await runRefinement(world, mode)
  refinementResults.push({
    mode,
    active,
    approval: active.trace.targetedRefinementFinalRouteApproval,
    outcome: active.trace.refinementOutcome,
  })
}

const passing = refinementResults.find(
  (entry) =>
    entry.approval?.status === 'approved' &&
    entry.outcome?.targetedChangeSucceeded === true &&
    (entry.outcome.changedStopCount ?? 0) > 0,
)
const rejectedProductionRefinements = refinementResults.filter(
  (entry) => entry.approval?.status === 'rejected',
)
assert(
  rejectedProductionRefinements.length > 0,
  'Expected at least one production-boundary targeted refinement refusal.',
)
for (const rejected of rejectedProductionRefinements) {
  assert(rejected.outcome, `Expected refinement outcome for rejected mode ${rejected.mode}.`)
  assert.equal(
    candidateSignature(rejected.active.selectedArc),
    candidateSignature(world.baseline.selectedArc),
    `Rejected active-carrier refinement ${rejected.mode} must preserve the previous approved route.`,
  )
  assert.equal(
    rejected.outcome.targetedChangeSucceeded,
    false,
    `Rejected active-carrier refinement ${rejected.mode} must not mark targeted success.`,
  )
  assert.equal(rejected.outcome.changedStopCount, 0)
  assert(
    rejected.outcome.winnerInertiaNotes.some((note) =>
      note.includes(`approval refused by ${rejected.approval?.refusalOwner}`),
    ),
    `Rejected active-carrier refinement ${rejected.mode} must retain structured owner evidence.`,
  )
}
assert(passing, 'Expected at least one active-carrier targeted refinement to be approved.')
assert(passing.approval?.status === 'approved')
assert(passing.outcome, 'Expected refinement outcome diagnostics.')
assert.equal(
  passing.approval.diagnostics.assessedRouteSignature,
  passing.approval.diagnostics.approvedRouteSignature,
)
assert.equal(candidateSignature(passing.active.selectedArc), passing.approval.diagnostics.approvedRouteSignature)
assert.equal(baseRouteSignature(passing.active.selectedArc), itinerarySignature(passing.active))
assert.equal(
  passing.active.selectedArc.scoreBreakdown.experienceCompositionStamp?.requirementSource,
  'route_shape_contract',
)
assert.equal(passing.approval.diagnostics.tasteStatus, 'pass')
assert.equal(passing.approval.diagnostics.bearingsStatus, 'pass')
assert.equal(passing.approval.diagnostics.waypointC1Approval?.topCandidate?.eligible, true)
assert.equal(passing.approval.diagnostics.greatStop?.selectedCandidateId, passing.active.selectedArc.id)

const multiRolePassing = refinementResults.find(
  (entry) =>
    entry.approval?.status === 'approved' &&
    (entry.outcome?.targetedRoles.length ?? 0) > 1,
)
assert(multiRolePassing, 'Expected a production-reachable multi-role targeting order.')

const compatibility = await runPlanBuildWithLegacyPlaceRightFallback(
  {
    ...world.input,
    refinementModes: [passing.mode],
  },
  {
    ...world.commonOptions,
    baselineArc: world.baseline.selectedArc,
    baselineTrace: world.baseline.trace,
    baselineItineraryId: world.baseline.itinerary.id,
  },
)
assert.equal(
  compatibility.trace.targetedRefinementFinalRouteApproval,
  undefined,
  'Compatibility caller without active C1 carrier must keep legacy targeted-refinement behavior.',
)

const tasteFailure = approveFinalRouteCandidate({
  source: 'scripts.targeted_refinement_final_route_approval.taste_failure',
  targetRole: passing.outcome.primaryTargetRole,
  proposedCandidate: weakenComposition(passing.active.selectedArc, 'targeted-refinement:taste-fail'),
  intent: passing.active.intentProfile,
  crewPolicy: getCrewPolicy(passing.active.intentProfile.crew),
  lens: passing.active.lens,
  routeShapeContract: world.routeShapeContract,
})
assert.equal(tasteFailure.status, 'rejected')
assert.equal(tasteFailure.refusalOwner, 'taste')

const bearingsFailure = approveFinalRouteCandidate({
  source: 'scripts.targeted_refinement_final_route_approval.bearings_failure',
  targetRole: passing.outcome.primaryTargetRole,
  proposedCandidate: closedVenueCandidate(passing.active.selectedArc, 'targeted-refinement:bearings-fail'),
  intent: passing.active.intentProfile,
  crewPolicy: getCrewPolicy(passing.active.intentProfile.crew),
  lens: passing.active.lens,
  routeShapeContract: world.routeShapeContract,
})
assert.equal(bearingsFailure.status, 'rejected')
assert.equal(bearingsFailure.refusalOwner, 'bearings')
assert(
  bearingsFailure.diagnostics.bearingsReasonCodes.includes('place_right:open_closed_viability_failed'),
)

const greatStopFailure = approveFinalRouteCandidate({
  source: 'scripts.targeted_refinement_final_route_approval.great_stop_failure',
  targetRole: passing.outcome.primaryTargetRole,
  proposedCandidate: staleFieldCandidate(passing.active.selectedArc, 'targeted-refinement:great-stop-fail'),
  intent: passing.active.intentProfile,
  crewPolicy: getCrewPolicy(passing.active.intentProfile.crew),
  lens: passing.active.lens,
  routeShapeContract: world.routeShapeContract,
})
assert.equal(greatStopFailure.status, 'rejected')
assert.equal(greatStopFailure.refusalOwner, 'great_stop')
assert.equal(greatStopFailure.reason, 'real:unusable_source')

const changedRoles = Array.from(
  new Set(
    refinementResults.flatMap((entry) =>
      entry.outcome?.stopDeltas
        .filter((delta) => delta.changed)
        .map((delta) => delta.role) ?? [],
    ),
  ),
).sort()
assert(changedRoles.length > 0, 'Expected at least one production-reachable targeted role mutation.')

assert.equal(fetchCalls, 0, 'No provider calls are allowed.')

console.log(
  JSON.stringify(
    {
      result: 'PASS',
      proof: 'targeted-refinement-final-route-approval',
      seam:
        'runPlanBuildWithLegacyPlaceRightFallback -> runGeneratePlan -> applyTargetedRefinement -> approveFinalRouteCandidate -> selectedArc',
      routeShapeContractId: world.routeShapeContract.id,
      baselineRouteSignature: candidateSignature(world.baseline.selectedArc),
      passing: {
        mode: passing.mode,
        primaryTargetRole: passing.outcome.primaryTargetRole,
        targetedRoles: passing.outcome.targetedRoles,
        changedStopCount: passing.outcome.changedStopCount,
        approvedRouteSignature: passing.approval.diagnostics.approvedRouteSignature,
      },
      productionReachableChangedRoles: changedRoles,
      modes: refinementResults.map((entry) => ({
        mode: entry.mode,
        targetedRoles: entry.outcome?.targetedRoles,
        primaryTargetRole: entry.outcome?.primaryTargetRole,
        changedStopCount: entry.outcome?.changedStopCount,
        approvalStatus: entry.approval?.status,
        refusalOwner: entry.approval?.status === 'rejected' ? entry.approval.refusalOwner : undefined,
        selectedRouteSignature: candidateSignature(entry.active.selectedArc),
      })),
      refusing: {
        taste: tasteFailure,
        bearings: bearingsFailure,
        greatStop: greatStopFailure,
      },
      compatibility: {
        approvalDiagnosticPresent: Boolean(compatibility.trace.targetedRefinementFinalRouteApproval),
        selectedRouteSignature: candidateSignature(compatibility.selectedArc),
      },
      determinism: {
        routeSignature: candidateSignature(world.baseline.selectedArc),
        repeatedRouteSignature: candidateSignature(repeatedBaseline.selectedArc),
      },
      providerCalls: fetchCalls,
    },
    null,
    2,
  ),
)
