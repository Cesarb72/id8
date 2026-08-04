import assert from 'node:assert/strict'
import { sanJoseVenues } from '../src/data/venues.ts'
import {
  buildApplicationConciergeIntent,
  projectConciergeIntentToIntentInput,
} from '../src/app/concierge/conciergeIntentAdapter.ts'
import { approveFormalSwapFinalRoute } from '../src/app/services/sandbox/formalSwapFinalRouteApproval.ts'
import {
  applyPreviewSwapCommit,
  type PreviewSwapStateLike,
  type SwapCommitPlanSnapshotLike,
  type SwapCompatibilityResultLike,
  type SwapReplacementCanonicalLike,
} from '../src/app/services/sandbox/sandboxSwapService.ts'
import { buildCanonicalSurpriseC1RouteShapeContract } from '../src/domain/arc/buildCanonicalSurpriseC1RouteShapeContract.ts'
import { patchFinalRouteStop } from '../src/domain/artifacts/runtimeRouteProjection.ts'
import { getArcStopBaseVenueId } from '../src/domain/candidates/candidateIdentity.ts'
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
import { projectItinerary } from '../src/domain/itinerary/projectItinerary.ts'
import { runGeneratePlan } from '../src/domain/runGeneratePlan.ts'
import type { ArcCandidate, ArcStop } from '../src/domain/types/arc.ts'
import type { RuntimeRouteArtifact, RuntimeRouteStop } from '../src/domain/artifacts/runtimeRouteArtifact.ts'
import type { ExperienceLens } from '../src/domain/types/experienceLens.ts'
import type { IntentProfile, RouteShapeContract } from '../src/domain/types/intent.ts'
import type { Itinerary, ItineraryStop, UserStopRole } from '../src/domain/types/itinerary.ts'

let fetchCalls = 0
globalThis.fetch = ((input: RequestInfo | URL) => {
  fetchCalls += 1
  throw new Error(`Formal swap final-route approval proof must not call providers: ${String(input)}`)
}) as typeof fetch

interface FormalSwapPlanSnapshot extends SwapCommitPlanSnapshotLike {
  intentProfile: IntentProfile
  lens: ExperienceLens
}

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

function internalRoleFor(role: UserStopRole): ArcStop['role'] {
  if (role === 'start') return 'warmup'
  if (role === 'highlight') return 'peak'
  if (role === 'windDown') return 'cooldown'
  return 'wildcard'
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function routeSignature(candidate: ArcCandidate): string {
  return candidate.stops
    .map((stop) => `${stop.role}:${getArcStopBaseVenueId(stop)}`)
    .join('|')
}

function stopForRole(itinerary: Itinerary, role: UserStopRole): ItineraryStop {
  const stop = itinerary.stops.find((entry) => entry.role === role)
  assert(stop, `Expected itinerary stop for ${role}.`)
  return stop
}

function runtimeStop(stop: ItineraryStop, stopIndex: number): RuntimeRouteStop {
  const latitude = stop.latitude ?? 37.333 + stopIndex * 0.001
  const longitude = stop.longitude ?? -121.89 - stopIndex * 0.001
  return {
    id: `runtime:${stop.role}:${stop.venueId}`,
    sourceStopId: stop.id,
    displayName: stop.venueName,
    providerRecordId: `provider:${stop.venueId}`,
    latitude,
    longitude,
    address: stop.formattedAddress ?? `${stop.venueName}, San Jose, CA`,
    role: stop.role,
    stopIndex,
    venueId: stop.venueId,
    title: stop.title,
    subtitle: stop.subtitle,
    neighborhood: stop.neighborhood,
    driveMinutes: stop.driveMinutes,
    imageUrl: stop.imageUrl,
  }
}

function runtimeRoute(itinerary: Itinerary, selectedDirectionId: string): RuntimeRouteArtifact {
  const stops = itinerary.stops.map(runtimeStop)
  return {
    routeId: `runtime:${itinerary.id}`,
    selectedDirectionId,
    location: itinerary.city,
    persona: 'romantic',
    vibe: itinerary.vibes[0] ?? 'cozy',
    stops,
    activeStopIndex: 0,
    routeHeadline: itinerary.story.headline,
    routeSummary: itinerary.story.subtitle,
    mapMarkers: stops.map((stop) => ({
      id: `marker:${stop.id}`,
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

function replacementCanonical(stop: ItineraryStop): SwapReplacementCanonicalLike {
  return {
    displayName: stop.venueName,
    providerRecordId: `provider:${stop.venueId}`,
    latitude: stop.latitude ?? 37.333,
    longitude: stop.longitude ?? -121.89,
    addressLine: stop.formattedAddress ?? `${stop.venueName}, San Jose, CA`,
    city: stop.city,
    neighborhood: stop.neighborhood,
  }
}

function swapSnapshot(params: {
  role: UserStopRole
  proposedCandidate: ArcCandidate
  intent: IntentProfile
  lens: ExperienceLens
  finalRoute: RuntimeRouteArtifact
}): PreviewSwapStateLike {
  const swappedItinerary = projectItinerary(params.proposedCandidate, params.intent, params.lens)
  const candidateStop = stopForRole(swappedItinerary, params.role)
  const originalStop = stopForRole(swappedItinerary, params.role)
  const targetStop = params.finalRoute.stops.find((stop) => stop.role === params.role)
  assert(targetStop, `Expected final route target stop for ${params.role}.`)
  return {
    role: params.role,
    targetRouteId: params.finalRoute.routeId,
    targetStopId: targetStop.id,
    targetStopIndex: targetStop.stopIndex,
    targetRole: params.role,
    swapBeforeStopId: targetStop.id,
    requestedReplacementId: candidateStop.venueId,
    originalStop,
    candidateStop,
    replacementCanonical: replacementCanonical(candidateStop),
    swappedArc: params.proposedCandidate,
    swappedItinerary,
  }
}

function passCompatibility(): SwapCompatibilityResultLike {
  return {
    swapCompatibilityPassed: true,
    swapCompatibilityReason: 'fixture-compatible',
    swapCompatibilityRejectClass: 'none',
    preservedRole: true,
    preservedDistrict: true,
    preservedFamily: true,
    preservedFeasibility: true,
    softDirectionDriftDetected: false,
  }
}

function commitSwap(params: {
  role: UserStopRole
  proposedCandidate: ArcCandidate
  planSnapshot: FormalSwapPlanSnapshot
  finalRoute: RuntimeRouteArtifact
  approve: boolean
  staleRouteId?: string
}): {
  patchedCount: number
  approvedCount: number
  result?: ReturnType<typeof applyPreviewSwapCommit<FormalSwapPlanSnapshot, SwapReplacementCanonicalLike, SwapCompatibilityResultLike>>
  error?: unknown
} {
  let patchedCount = 0
  let approvedCount = 0
  const snapshot = swapSnapshot({
    role: params.role,
    proposedCandidate: params.proposedCandidate,
    intent: params.planSnapshot.intentProfile,
    lens: params.planSnapshot.lens,
    finalRoute: params.finalRoute,
  })
  if (params.staleRouteId) {
    snapshot.targetRouteId = params.staleRouteId
  }
  try {
    const result = applyPreviewSwapCommit(
      {
        role: params.role,
        swapSnapshot: snapshot,
        planSnapshot: params.planSnapshot,
        finalRouteSnapshot: params.finalRoute,
        routeVersionAtClick: 3,
        canonicalStopByRole: {
          [params.role]: snapshot.replacementCanonical,
        },
      },
      {
        applyCanonicalIdentityToItinerary: (itinerary) => itinerary,
        evaluateSwapCompatibility: passCompatibility,
        ...(params.approve
          ? {
              approveFormalSwapFinalRoute: ({
                role,
                planSnapshot,
                proposedCandidate,
                routeShapeContract,
              }) => {
                approvedCount += 1
                return approveFormalSwapFinalRoute({
                  targetRole: role,
                  proposedCandidate,
                  intent: planSnapshot.intentProfile,
                  crewPolicy: getCrewPolicy(planSnapshot.intentProfile.crew),
                  lens: planSnapshot.lens,
                  routeShapeContract,
                })
              },
            }
          : {}),
        patchFinalRouteStop: (patchParams) => {
          patchedCount += 1
          return patchFinalRouteStop(patchParams)
        },
        getSharedItineraryStopFallbackImageUrl: () => 'https://example.test/fallback.jpg',
        hydrateRuntimeRouteStopDisplayFields: ({ stop }) => ({
          title: stop.title,
          subtitle: stop.subtitle,
          driveMinutes: stop.driveMinutes,
          imageUrl: stop.imageUrl,
        }),
        getNonEmptyRuntimeRouteString: (value) => (value?.trim() ? value : null),
        getPreviewSwapFeedback: () => 'Swap preview applied.',
      },
    )
    return { patchedCount, approvedCount, result }
  } catch (error) {
    return { patchedCount, approvedCount, error }
  }
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

function scatterNeighborhoods(candidate: ArcCandidate, id: string): ArcCandidate {
  const next = clone(candidate)
  next.id = id
  next.stops.forEach((stop, index) => {
    stop.scoredVenue.venue.neighborhood = `Far Proof ${index + 1}`
    stop.scoredVenue.venue.driveMinutes = 28 + index
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

async function buildWorld() {
  const conciergeIntent = buildApplicationConciergeIntent({
    mode: 'surprise',
    persona: 'romantic',
    primaryVibe: 'cultured',
    city: 'San Jose',
  })
  const canonicalInterpretationBundle = buildCanonicalInterpretationBundle({
    conciergeIntent,
    interpretationSource: 'scripts.formal_swap_final_route_approval',
  })
  const districtPreview = await buildDistrictOpportunityProfiles({
    locationQuery: 'San Jose',
    includeDebug: true,
  })
  const contractGateWorld = buildContractGateWorldFromCanonical({
    canonicalInterpretationBundle,
    ranked: districtPreview.ranked,
    source: 'scripts.formal_swap_final_route_approval',
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
    seedVenues: sanJoseVenues,
    sourceMode: 'curated' as const,
    sourceModeOverrideApplied: true,
    debugMode: false,
    experienceContract: canonicalInterpretationBundle.experienceContract,
    contractConstraints: canonicalInterpretationBundle.contractConstraints,
    canonicalInterpretationBundle,
    rankedDistrictPockets: districtPreview.ranked,
    contractGateWorld,
    strategyAdmissibleWorlds,
  }
  const active = await runGeneratePlan(input, {
    ...commonOptions,
    routeShapeContract,
  })
  const repeated = await runGeneratePlan(input, {
    ...commonOptions,
    routeShapeContract,
  })
  return {
    active,
    repeated,
    routeShapeContract,
    selectedDirectionId: selectedDirection.id,
  }
}

const world = await buildWorld()
const finalRoute = runtimeRoute(world.active.itinerary, world.selectedDirectionId)
const planSnapshot: FormalSwapPlanSnapshot = {
  ...world.active,
  selectedDirectionPreviewContext: {
    label: 'Formal swap final-route approval proof',
  },
  selectedDirectionContract: {
    id: finalRoute.selectedDirectionId,
  },
  routeShapeContract: world.routeShapeContract,
}

const passStart = commitSwap({
  role: 'start',
  proposedCandidate: world.active.selectedArc,
  planSnapshot,
  finalRoute,
  approve: true,
})
assert(passStart.result, 'Passing Start swap must commit.')
assert.equal(passStart.patchedCount, 1, 'Passing Start swap must patch after approval.')
assert.equal(passStart.approvedCount, 1, 'Passing Start swap must run final-route approval.')
assert.equal(
  passStart.result.nextSelectedArc.scoreBreakdown.experienceCompositionStamp?.requirementSource,
  'route_shape_contract',
)

const failStart = commitSwap({
  role: 'start',
  proposedCandidate: weakenComposition(world.active.selectedArc, 'formal-swap:start:c1-fail'),
  planSnapshot,
  finalRoute,
  approve: true,
})
assert(failStart.error instanceof Error, 'Failing Start swap must refuse.')
assert.equal(failStart.patchedCount, 0, 'Failing Start swap must refuse before patch.')
assert.match(String(failStart.error), /final route approval \(taste\)/)

const passWindDown = commitSwap({
  role: 'windDown',
  proposedCandidate: world.active.selectedArc,
  planSnapshot,
  finalRoute,
  approve: true,
})
assert(passWindDown.result, 'Passing Wind-down swap must commit.')
assert.equal(passWindDown.patchedCount, 1, 'Passing Wind-down swap must patch after approval.')
assert.equal(passWindDown.approvedCount, 1, 'Passing Wind-down swap must run final-route approval.')

const failWindDown = commitSwap({
  role: 'windDown',
  proposedCandidate: weakenComposition(world.active.selectedArc, 'formal-swap:windDown:c1-fail'),
  planSnapshot,
  finalRoute,
  approve: true,
})
assert(failWindDown.error instanceof Error, 'Failing Wind-down swap must refuse.')
assert.equal(failWindDown.patchedCount, 0, 'Failing Wind-down swap must refuse before patch.')
assert.match(String(failWindDown.error), /final route approval \(taste\)/)

const bearingsFailure = approveFormalSwapFinalRoute({
  targetRole: 'start',
  proposedCandidate: scatterNeighborhoods(world.active.selectedArc, 'formal-swap:bearings-fail'),
  intent: world.active.intentProfile,
  crewPolicy: getCrewPolicy(world.active.intentProfile.crew),
  lens: world.active.lens,
  routeShapeContract: world.routeShapeContract,
})
assert.equal(bearingsFailure.status, 'rejected')
assert.equal(bearingsFailure.refusalOwner, 'bearings')

const greatStopFailure = approveFormalSwapFinalRoute({
  targetRole: 'windDown',
  proposedCandidate: staleFieldCandidate(world.active.selectedArc, 'formal-swap:great-stop-fail'),
  intent: world.active.intentProfile,
  crewPolicy: getCrewPolicy(world.active.intentProfile.crew),
  lens: world.active.lens,
  routeShapeContract: world.routeShapeContract,
})
assert.equal(greatStopFailure.status, 'rejected')
assert.equal(greatStopFailure.refusalOwner, 'great_stop')

const staleProposal = commitSwap({
  role: 'start',
  proposedCandidate: world.active.selectedArc,
  planSnapshot,
  finalRoute,
  approve: true,
  staleRouteId: 'runtime:stale-route',
})
assert(staleProposal.error instanceof Error, 'Stale proposal must refuse.')
assert.equal(staleProposal.approvedCount, 0, 'Stale proposal must refuse before approval.')
assert.equal(staleProposal.patchedCount, 0, 'Stale proposal must refuse before patch.')
assert.match(String(staleProposal.error), /Swap preview is stale/)

const compatibilityCaller = commitSwap({
  role: 'start',
  proposedCandidate: weakenComposition(world.active.selectedArc, 'formal-swap:compatibility-no-carrier'),
  planSnapshot,
  finalRoute,
  approve: false,
})
assert(compatibilityCaller.result, 'Compatibility caller without approval dependency must still commit.')
assert.equal(compatibilityCaller.approvedCount, 0)
assert.equal(compatibilityCaller.patchedCount, 1)

const deterministicA = approveFormalSwapFinalRoute({
  targetRole: 'start',
  proposedCandidate: world.active.selectedArc,
  intent: world.active.intentProfile,
  crewPolicy: getCrewPolicy(world.active.intentProfile.crew),
  lens: world.active.lens,
  routeShapeContract: world.routeShapeContract,
})
const deterministicB = approveFormalSwapFinalRoute({
  targetRole: 'start',
  proposedCandidate: world.active.selectedArc,
  intent: world.active.intentProfile,
  crewPolicy: getCrewPolicy(world.active.intentProfile.crew),
  lens: world.active.lens,
  routeShapeContract: world.routeShapeContract,
})
assert.deepEqual(
  {
    status: deterministicA.status,
    signature:
      deterministicA.status === 'approved' ? routeSignature(deterministicA.approvedCandidate) : null,
    diagnostics: deterministicA.diagnostics,
  },
  {
    status: deterministicB.status,
    signature:
      deterministicB.status === 'approved' ? routeSignature(deterministicB.approvedCandidate) : null,
    diagnostics: deterministicB.diagnostics,
  },
  'Equivalent formal swap approval must be deterministic.',
)
assert.equal(routeSignature(world.active.selectedArc), routeSignature(world.repeated.selectedArc))
assert.equal(fetchCalls, 0, 'No provider calls are allowed.')

console.log(
  JSON.stringify(
    {
      result: 'PASS',
      proof: 'formal-swap-final-route-approval',
      seam:
        'applyPreviewSwapCommit -> approveFormalSwapFinalRoute -> Taste -> Bearings -> Waypoint C1 -> Great Stop -> patchFinalRouteStop',
      routeShapeContractId: world.routeShapeContract.id,
      passing: {
        start: passStart.result.nextSelectedArc.scoreBreakdown.experienceCompositionStamp?.status,
        windDown:
          passWindDown.result.nextSelectedArc.scoreBreakdown.experienceCompositionStamp?.status,
      },
      refusing: {
        start: String(failStart.error),
        windDown: String(failWindDown.error),
        bearings: bearingsFailure,
        greatStop: greatStopFailure,
        stale: String(staleProposal.error),
      },
      compatibility: {
        approvedCount: compatibilityCaller.approvedCount,
        patchedCount: compatibilityCaller.patchedCount,
      },
      determinism: {
        routeSignature: routeSignature(world.active.selectedArc),
        repeatedRouteSignature: routeSignature(world.repeated.selectedArc),
      },
      providerCalls: fetchCalls,
    },
    null,
    2,
  ),
)
