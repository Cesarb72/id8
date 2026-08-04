import assert from 'node:assert/strict'
import { sanJoseVenues } from '../src/data/venues.ts'
import {
  buildApplicationConciergeIntent,
  projectConciergeIntentToIntentInput,
} from '../src/app/concierge/conciergeIntentAdapter.ts'
import {
  applyPreviewSwapCommit,
  type PreviewSwapStateLike,
  type SwapCommitPlanSnapshotLike,
  type SwapCompatibilityResultLike,
  type SwapReplacementCanonicalLike,
} from '../src/app/services/sandbox/sandboxSwapService.ts'
import { buildCanonicalSurpriseC1RouteShapeContract } from '../src/domain/arc/buildCanonicalSurpriseC1RouteShapeContract.ts'
import { getRoleAlternatives } from '../src/domain/arc/getRoleAlternatives.ts'
import { swapArcStop } from '../src/domain/arc/swapArcStop.ts'
import { patchFinalRouteStop } from '../src/domain/artifacts/runtimeRouteProjection.ts'
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
import { projectItinerary } from '../src/domain/itinerary/projectItinerary.ts'
import { approveFinalRouteCandidate } from '../src/domain/routeApproval/approveFinalRouteCandidate.ts'
import { runGeneratePlan } from '../src/domain/runGeneratePlan.ts'
import type { ArcCandidate, ArcStop } from '../src/domain/types/arc.ts'
import type { RuntimeRouteArtifact, RuntimeRouteStop } from '../src/domain/artifacts/runtimeRouteArtifact.ts'
import type { ExperienceLens } from '../src/domain/types/experienceLens.ts'
import type { IntentProfile, RouteShapeContract } from '../src/domain/types/intent.ts'
import type { Itinerary, ItineraryStop, UserStopRole } from '../src/domain/types/itinerary.ts'

let fetchCalls = 0
globalThis.fetch = ((input: RequestInfo | URL) => {
  fetchCalls += 1
  throw new Error(
    `Legacy support replacement final-route approval proof must not call providers: ${String(input)}`,
  )
}) as typeof fetch

interface LegacySupportPlanSnapshot extends SwapCommitPlanSnapshotLike {
  intentProfile?: IntentProfile
  lens?: ExperienceLens
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

function candidateRouteSignature(candidate: ArcCandidate): string {
  return candidate.stops
    .map((stop) => `${stop.role}:${getArcStopCandidateId(stop)}`)
    .join('|')
}

function baseRouteSignature(candidate: ArcCandidate): string {
  return candidate.stops
    .map((stop) => `${stop.role}:${getArcStopBaseVenueId(stop)}`)
    .join('|')
}

function baseIdForRole(candidate: ArcCandidate, role: UserStopRole): string {
  const internalRole = internalRoleFor(role)
  const stop = candidate.stops.find((entry) => entry.role === internalRole)
  assert(stop, `Expected candidate stop for ${role}.`)
  return getArcStopBaseVenueId(stop)
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
  const originalStop = candidateStop
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

function commitLegacySupportReplacement(params: {
  role: UserStopRole
  proposedCandidate: ArcCandidate
  planSnapshot: LegacySupportPlanSnapshot
  finalRoute: RuntimeRouteArtifact
  projectionIntent: IntentProfile
  projectionLens: ExperienceLens
  staleRouteId?: string
}): {
  patchedCount: number
  result?: ReturnType<
    typeof applyPreviewSwapCommit<
      LegacySupportPlanSnapshot,
      SwapReplacementCanonicalLike,
      SwapCompatibilityResultLike
    >
  >
  error?: unknown
} {
  let patchedCount = 0
  const snapshot = swapSnapshot({
    role: params.role,
    proposedCandidate: params.proposedCandidate,
    intent: params.projectionIntent,
    lens: params.projectionLens,
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
        routeVersionAtClick: 7,
        canonicalStopByRole: {
          [params.role]: snapshot.replacementCanonical,
        },
      },
      {
        applyCanonicalIdentityToItinerary: (itinerary) => itinerary,
        evaluateSwapCompatibility: passCompatibility,
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
        getPreviewSwapFeedback: () => 'Legacy support replacement applied.',
      },
    )
    return { patchedCount, result }
  } catch (error) {
    return { patchedCount, error }
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
    stop.scoredVenue.venue.neighborhood = `Far Legacy Proof ${index + 1}`
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
    interpretationSource: 'scripts.legacy_support_replacement_final_route_approval',
  })
  const districtPreview = await buildDistrictOpportunityProfiles({
    locationQuery: 'San Jose',
    includeDebug: true,
  })
  const contractGateWorld = buildContractGateWorldFromCanonical({
    canonicalInterpretationBundle,
    ranked: districtPreview.ranked,
    source: 'scripts.legacy_support_replacement_final_route_approval',
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

type BuiltWorld = Awaited<ReturnType<typeof buildWorld>>

function supportReplacementCandidate(params: {
  world: BuiltWorld
  role: Extract<UserStopRole, 'start' | 'windDown'>
}): ArcCandidate {
  const { world, role } = params
  const internalRole = internalRoleFor(role)
  const originalBaseId = baseIdForRole(world.active.selectedArc, role)
  const highlightBaseId = baseIdForRole(world.active.selectedArc, 'highlight')
  const alternatives = getRoleAlternatives({
    role: internalRole,
    currentArc: world.active.selectedArc,
    scoredVenues: world.active.scoredVenues,
    intent: world.active.intentProfile,
    crewPolicy: getCrewPolicy(world.active.intentProfile.crew),
    lens: world.active.lens,
    limit: 12,
  })
  assert(alternatives.length > 0, `Expected support alternatives for ${role}.`)
  for (const alternative of alternatives) {
    const swapped = swapArcStop({
      currentArc: world.active.selectedArc,
      role: internalRole,
      replacement: alternative.scoredVenue,
      intent: world.active.intentProfile,
      crewPolicy: getCrewPolicy(world.active.intentProfile.crew),
      lens: world.active.lens,
    })
    if (!swapped) {
      continue
    }
    if (baseIdForRole(swapped, role) === originalBaseId) {
      continue
    }
    if (baseIdForRole(swapped, 'highlight') !== highlightBaseId) {
      continue
    }
    const approval = approveFinalRouteCandidate({
      source: 'scripts.legacy_support_replacement_final_route_approval.candidate_selection',
      targetRole: role,
      proposedCandidate: swapped,
      intent: world.active.intentProfile,
      crewPolicy: getCrewPolicy(world.active.intentProfile.crew),
      lens: world.active.lens,
      routeShapeContract: world.routeShapeContract,
    })
    if (approval.status === 'approved') {
      return swapped
    }
  }
  assert.fail(`Expected an owner-approved ${role} support replacement candidate.`)
}

function assertApprovedCommit(params: {
  role: Extract<UserStopRole, 'start' | 'windDown'>
  result: NonNullable<ReturnType<typeof commitLegacySupportReplacement>['result']>
  previousArc: ArcCandidate
  proposedCandidate: ArcCandidate
}): void {
  const { role, result, previousArc, proposedCandidate } = params
  const diagnostics = result.swapDebugBreadcrumb.finalRouteApproval
  assert(diagnostics, `Expected final-route approval diagnostics for ${role}.`)
  assert.equal(diagnostics.source, 'app.services.sandbox.applyPreviewSwapCommit.legacySupportReplacementFinalRouteApproval')
  assert.equal(diagnostics.targetRole, role)
  assert.equal(diagnostics.tasteStatus, 'pass')
  assert.equal(diagnostics.bearingsStatus, 'pass')
  assert.equal(diagnostics.waypointC1Approval?.topCandidate?.eligible, true)
  assert.equal(diagnostics.greatStop?.status, 'PASS')
  assert.equal(diagnostics.proposedRouteSignature, candidateRouteSignature(proposedCandidate))
  assert.equal(diagnostics.assessedRouteSignature, diagnostics.proposedRouteSignature)
  assert.equal(diagnostics.approvedRouteSignature, candidateRouteSignature(result.nextSelectedArc))
  assert.equal(result.swapDebugBreadcrumb.swapCommitSucceeded, true)
  assert.equal(result.nextSelectedArc.scoreBreakdown.experienceCompositionStamp?.status, 'pass')
  assert.equal(
    result.nextSelectedArc.scoreBreakdown.experienceCompositionStamp?.requirementSource,
    'route_shape_contract',
  )
  if (role === 'start') {
    assert.equal(
      result.nextSelectedArc.scoreBreakdown.experienceCompositionStamp?.startPreparesHighlight.status,
      'pass',
    )
  } else {
    assert.equal(
      result.nextSelectedArc.scoreBreakdown.experienceCompositionStamp?.windDownResolvesHighlight.status,
      'pass',
    )
  }
  assert.equal(
    baseIdForRole(result.nextSelectedArc, 'highlight'),
    baseIdForRole(previousArc, 'highlight'),
    'Support replacement must preserve the selected Highlight.',
  )
  assert.notEqual(
    baseIdForRole(result.nextSelectedArc, role),
    baseIdForRole(previousArc, role),
    'Support replacement must prove an actual replacement.',
  )
  assert.equal(baseIdForRole(result.nextSelectedArc, role), baseIdForRole(proposedCandidate, role))
  const finalRouteStop = result.nextFinalRoute.stops.find((stop) => stop.role === role)
  assert(finalRouteStop, `Expected runtime route stop for ${role}.`)
  assert.equal(finalRouteStop.venueId, baseIdForRole(result.nextSelectedArc, role))
  assert.equal(stopForRole(result.nextItinerary, role).venueId, baseIdForRole(result.nextSelectedArc, role))
}

const world = await buildWorld()
const finalRoute = runtimeRoute(world.active.itinerary, world.selectedDirectionId)
const activePlanSnapshot: LegacySupportPlanSnapshot = {
  ...world.active,
  selectedDirectionPreviewContext: {
    label: 'Legacy support replacement final-route approval proof',
  },
  selectedDirectionContract: {
    id: finalRoute.selectedDirectionId,
  },
  routeShapeContract: world.routeShapeContract,
}
const compatibilityPlanSnapshot: LegacySupportPlanSnapshot = {
  itinerary: world.active.itinerary,
  selectedArc: world.active.selectedArc,
  selectedDirectionPreviewContext: activePlanSnapshot.selectedDirectionPreviewContext,
  selectedDirectionContract: activePlanSnapshot.selectedDirectionContract,
  routeShapeContract: world.routeShapeContract,
}

const startReplacement = supportReplacementCandidate({ world, role: 'start' })
const windDownReplacement = supportReplacementCandidate({ world, role: 'windDown' })

const passStart = commitLegacySupportReplacement({
  role: 'start',
  proposedCandidate: startReplacement,
  planSnapshot: activePlanSnapshot,
  finalRoute,
  projectionIntent: world.active.intentProfile,
  projectionLens: world.active.lens,
})
assert(passStart.result, 'Passing Start replacement must commit.')
assert.equal(passStart.patchedCount, 1, 'Passing Start replacement must patch after approval.')
assertApprovedCommit({
  role: 'start',
  result: passStart.result,
  previousArc: world.active.selectedArc,
  proposedCandidate: startReplacement,
})

const failStart = commitLegacySupportReplacement({
  role: 'start',
  proposedCandidate: weakenComposition(startReplacement, 'legacy-support:start:taste-fail'),
  planSnapshot: activePlanSnapshot,
  finalRoute,
  projectionIntent: world.active.intentProfile,
  projectionLens: world.active.lens,
})
assert(failStart.error instanceof Error, 'Failing Start replacement must refuse.')
assert.equal(failStart.patchedCount, 0, 'Failing Start replacement must refuse before patch.')
assert.match(String(failStart.error), /final route approval \(taste\)/)
assert.equal(baseRouteSignature(world.active.selectedArc), baseRouteSignature(activePlanSnapshot.selectedArc))

const passWindDown = commitLegacySupportReplacement({
  role: 'windDown',
  proposedCandidate: windDownReplacement,
  planSnapshot: activePlanSnapshot,
  finalRoute,
  projectionIntent: world.active.intentProfile,
  projectionLens: world.active.lens,
})
assert(passWindDown.result, 'Passing Wind-down replacement must commit.')
assert.equal(passWindDown.patchedCount, 1, 'Passing Wind-down replacement must patch after approval.')
assertApprovedCommit({
  role: 'windDown',
  result: passWindDown.result,
  previousArc: world.active.selectedArc,
  proposedCandidate: windDownReplacement,
})

const failWindDown = commitLegacySupportReplacement({
  role: 'windDown',
  proposedCandidate: weakenComposition(windDownReplacement, 'legacy-support:windDown:taste-fail'),
  planSnapshot: activePlanSnapshot,
  finalRoute,
  projectionIntent: world.active.intentProfile,
  projectionLens: world.active.lens,
})
assert(failWindDown.error instanceof Error, 'Failing Wind-down replacement must refuse.')
assert.equal(failWindDown.patchedCount, 0, 'Failing Wind-down replacement must refuse before patch.')
assert.match(String(failWindDown.error), /final route approval \(taste\)/)

const bearingsFailure = commitLegacySupportReplacement({
  role: 'start',
  proposedCandidate: scatterNeighborhoods(startReplacement, 'legacy-support:bearings-fail'),
  planSnapshot: activePlanSnapshot,
  finalRoute,
  projectionIntent: world.active.intentProfile,
  projectionLens: world.active.lens,
})
assert(bearingsFailure.error instanceof Error, 'Bearings failure must refuse.')
assert.equal(bearingsFailure.patchedCount, 0, 'Bearings failure must refuse before patch.')
assert.match(String(bearingsFailure.error), /final route approval \(bearings\)/)

const greatStopFailure = commitLegacySupportReplacement({
  role: 'windDown',
  proposedCandidate: staleFieldCandidate(windDownReplacement, 'legacy-support:great-stop-fail'),
  planSnapshot: activePlanSnapshot,
  finalRoute,
  projectionIntent: world.active.intentProfile,
  projectionLens: world.active.lens,
})
assert(greatStopFailure.error instanceof Error, 'Great Stop failure must refuse.')
assert.equal(greatStopFailure.patchedCount, 0, 'Great Stop failure must refuse before patch.')
assert.match(String(greatStopFailure.error), /final route approval \(great_stop\)/)

const staleProposal = commitLegacySupportReplacement({
  role: 'start',
  proposedCandidate: startReplacement,
  planSnapshot: activePlanSnapshot,
  finalRoute,
  projectionIntent: world.active.intentProfile,
  projectionLens: world.active.lens,
  staleRouteId: 'runtime:stale-route',
})
assert(staleProposal.error instanceof Error, 'Stale proposal must refuse.')
assert.equal(staleProposal.patchedCount, 0, 'Stale proposal must refuse before patch.')
assert.match(String(staleProposal.error), /Swap preview is stale/)

const compatibilityCaller = commitLegacySupportReplacement({
  role: 'start',
  proposedCandidate: weakenComposition(startReplacement, 'legacy-support:compatibility-no-carrier'),
  planSnapshot: compatibilityPlanSnapshot,
  finalRoute,
  projectionIntent: world.active.intentProfile,
  projectionLens: world.active.lens,
})
assert(compatibilityCaller.result, 'No-carrier compatibility caller must keep existing behavior.')
assert.equal(compatibilityCaller.patchedCount, 1)
assert.equal(compatibilityCaller.result.swapDebugBreadcrumb.finalRouteApproval, undefined)

const deterministicA = commitLegacySupportReplacement({
  role: 'start',
  proposedCandidate: startReplacement,
  planSnapshot: activePlanSnapshot,
  finalRoute,
  projectionIntent: world.active.intentProfile,
  projectionLens: world.active.lens,
})
const deterministicB = commitLegacySupportReplacement({
  role: 'start',
  proposedCandidate: startReplacement,
  planSnapshot: activePlanSnapshot,
  finalRoute,
  projectionIntent: world.active.intentProfile,
  projectionLens: world.active.lens,
})
assert(deterministicA.result)
assert(deterministicB.result)
assert.deepEqual(
  {
    approval: deterministicA.result.swapDebugBreadcrumb.finalRouteApproval,
    selected: candidateRouteSignature(deterministicA.result.nextSelectedArc),
    finalRouteIds: deterministicA.result.nextFinalRoute.stops.map((stop) => stop.venueId),
  },
  {
    approval: deterministicB.result.swapDebugBreadcrumb.finalRouteApproval,
    selected: candidateRouteSignature(deterministicB.result.nextSelectedArc),
    finalRouteIds: deterministicB.result.nextFinalRoute.stops.map((stop) => stop.venueId),
  },
  'Equivalent legacy support replacement approval must be deterministic.',
)
assert.equal(baseRouteSignature(world.active.selectedArc), baseRouteSignature(world.repeated.selectedArc))
assert.equal(fetchCalls, 0, 'No provider calls are allowed.')

console.log(
  JSON.stringify(
    {
      result: 'PASS',
      proof: 'legacy-support-replacement-final-route-approval',
      seam:
        'applyPreviewSwapCommit active carrier -> approveFinalRouteCandidate -> Taste -> Bearings -> Waypoint C1 -> Great Stop -> patchFinalRouteStop',
      routeShapeContractId: world.routeShapeContract.id,
      passing: {
        start: {
          before: baseIdForRole(world.active.selectedArc, 'start'),
          after: baseIdForRole(passStart.result.nextSelectedArc, 'start'),
          prepares:
            passStart.result.nextSelectedArc.scoreBreakdown.experienceCompositionStamp
              ?.startPreparesHighlight.status,
        },
        windDown: {
          before: baseIdForRole(world.active.selectedArc, 'windDown'),
          after: baseIdForRole(passWindDown.result.nextSelectedArc, 'windDown'),
          resolves:
            passWindDown.result.nextSelectedArc.scoreBreakdown.experienceCompositionStamp
              ?.windDownResolvesHighlight.status,
        },
      },
      refusing: {
        start: String(failStart.error),
        windDown: String(failWindDown.error),
        bearings: String(bearingsFailure.error),
        greatStop: String(greatStopFailure.error),
        stale: String(staleProposal.error),
      },
      compatibility: {
        finalRouteApproval:
          compatibilityCaller.result.swapDebugBreadcrumb.finalRouteApproval ?? 'not_fabricated',
        patchedCount: compatibilityCaller.patchedCount,
      },
      determinism: {
        routeSignature: baseRouteSignature(world.active.selectedArc),
        repeatedRouteSignature: baseRouteSignature(world.repeated.selectedArc),
      },
      providerCalls: fetchCalls,
    },
    null,
    2,
  ),
)
