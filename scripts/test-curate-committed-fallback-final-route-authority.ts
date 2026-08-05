import assert from 'node:assert/strict'
import { sanJoseVenues } from '../src/data/venues.ts'
import { starterPacks } from '../src/data/starterPacks.ts'
import {
  buildApplicationConciergeIntent,
  projectConciergeIntentToIntentInput,
} from '../src/app/concierge/conciergeIntentAdapter.ts'
import {
  buildCurateCommittedRouteFallbackDecision,
  validateCurateCommittedRouteFallbackShownRouteAuthority,
} from '../src/app/services/curate/buildCurateCommittedRouteFallback.ts'
import { buildContractGateWorldFromCanonical } from '../src/domain/bearings/buildContractGateWorld.ts'
import { buildStrategyAdmissibleWorlds } from '../src/domain/bearings/buildStrategyAdmissibleWorlds.ts'
import { getArcStopBaseVenueId } from '../src/domain/candidates/candidateIdentity.ts'
import { buildRouteShapeContract } from '../src/domain/arc/directionPlanning.ts'
import { buildDirectionCandidates, type DirectionCandidate } from '../src/domain/direction/buildDirectionCandidates.ts'
import { buildCanonicalInterpretationBundle } from '../src/domain/interpretation/buildCanonicalInterpretationBundle.ts'
import { buildDistrictOpportunityProfiles } from '../src/domain/interpretation/district/intelligence/buildDistrictOpportunityProfiles.ts'
import {
  buildDirectionPlanningSelection,
  buildIntentSelectedDirectionContext,
  buildResolvedDirectionContext,
} from '../src/domain/interpretation/direction/selectedDirectionProjection.ts'
import { projectItinerary } from '../src/domain/itinerary/projectItinerary.ts'
import { runGeneratePlan, type GeneratePlanResult } from '../src/domain/runGeneratePlan.ts'
import type { ArcCandidate } from '../src/domain/types/arc.ts'
import type { RouteShapeContract } from '../src/domain/types/intent.ts'
import type { RuntimeRouteArtifact } from '../src/domain/artifacts/runtimeRouteArtifact.ts'

let fetchCalls = 0
globalThis.fetch = ((input: RequestInfo | URL) => {
  fetchCalls += 1
  throw new Error(
    `Curate committed-fallback final-route authority proof must not call providers: ${String(input)}`,
  )
}) as typeof fetch

const previousFallbackFlag = process.env.VITE_ID8_ENABLE_FIELD_STATIC_PROVIDER_CORPUS_CURATE
process.env.VITE_ID8_ENABLE_FIELD_STATIC_PROVIDER_CORPUS_CURATE = '1'

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

function baseRouteSignature(candidate: ArcCandidate): string {
  return candidate.stops
    .map((stop) => `${stop.role}:${getArcStopBaseVenueId(stop)}`)
    .join('|')
}

function shownSignature(result: GeneratePlanResult, candidate: ArcCandidate): string {
  return projectItinerary(candidate, result.intentProfile, result.lens)
    .stops.map((stop) => `${stop.role}:${stop.venueId}`)
    .join('|')
}

function withCandidate(result: GeneratePlanResult, selectedArc: ArcCandidate): GeneratePlanResult {
  return {
    ...result,
    selectedArc,
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
    stop.scoredVenue.venue.neighborhood = `Curate Authority Far ${index + 1}`
    stop.scoredVenue.venue.driveMinutes = 28 + index
  })
  return next
}

function staleFieldCandidate(candidate: ArcCandidate, id: string): ArcCandidate {
  const next = clone(candidate)
  next.id = id
  const target = next.stops.find((stop) => stop.role === 'peak') ?? next.stops[0]
  assert(target, 'Expected at least one stop for stale Field proof.')
  target.scoredVenue.venue.source.sourceConfidence = 0
  return next
}

function runtimeRouteFromCandidate(candidate: ArcCandidate): RuntimeRouteArtifact {
  const stops = ([
    ['start', 'warmup'],
    ['highlight', 'peak'],
    ['windDown', 'cooldown'],
  ] as const).map(([runtimeRole, arcRole], index) => {
    const stop = candidate.stops.find((entry) => entry.role === arcRole)
    assert(stop, `Expected ${arcRole} stop.`)
    const baseVenueId = getArcStopBaseVenueId(stop)
    const venue = stop.scoredVenue.venue as typeof stop.scoredVenue.venue & {
      coordinates?: { lat?: number; lng?: number }
      latitude?: number
      longitude?: number
      addressLine?: string
    }
    return {
      id: baseVenueId,
      sourceStopId: baseVenueId,
      displayName: venue.name,
      providerRecordId: baseVenueId,
      latitude: venue.coordinates?.lat ?? venue.latitude ?? 37.33 + index * 0.001,
      longitude: venue.coordinates?.lng ?? venue.longitude ?? -121.89 - index * 0.001,
      address: venue.addressLine ?? venue.address ?? 'San Jose',
      role: runtimeRole,
      stopIndex: index,
      venueId: baseVenueId,
      title: venue.name,
      subtitle: venue.category,
      neighborhood: venue.neighborhood,
      driveMinutes: venue.driveMinutes,
      imageUrl: venue.imageUrl ?? '',
    }
  })
  return {
    routeId: 'curate-fallback-authority-proof',
    selectedDirectionId: world.selectedDirection.id,
    location: 'San Jose',
    persona: world.result.intentProfile.persona ?? 'romantic',
    vibe: world.result.intentProfile.primaryAnchor,
    stops,
    activeStopIndex: 0,
    routeHeadline: 'Curate fallback authority proof',
    routeSummary: 'Provider-free proof route.',
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

async function buildWorld() {
  const starterPack = starterPacks.find((starter) => starter.id === 'cozy-date-night')
  assert(starterPack, 'Expected cozy-date-night starter pack.')
  const conciergeIntent = buildApplicationConciergeIntent({
    mode: 'curate',
    persona: starterPack.personaBias ?? 'romantic',
    primaryVibe: starterPack.primaryAnchor,
    secondaryVibe: starterPack.secondaryAnchors?.[0],
    city: 'San Jose',
  })
  const canonicalInterpretationBundle = buildCanonicalInterpretationBundle({
    conciergeIntent,
    interpretationSource: 'scripts.curate_committed_fallback_final_route_authority',
  })
  const districtPreview = await buildDistrictOpportunityProfiles({
    locationQuery: 'San Jose',
    includeDebug: true,
  })
  const contractGateWorld = buildContractGateWorldFromCanonical({
    canonicalInterpretationBundle,
    ranked: districtPreview.ranked,
    source: 'scripts.curate_committed_fallback_final_route_authority',
  })
  const strategyAdmissibleWorlds = buildStrategyAdmissibleWorlds({ contractGateWorld })
  const directionCandidates = buildDirectionCandidates({
    ranked: districtPreview.ranked,
    debug: districtPreview.debug,
    contractGateWorld,
    strategyAdmissibleWorlds,
    context: {
      persona: starterPack.personaBias ?? 'romantic',
      vibe: starterPack.primaryAnchor,
      experienceContract: canonicalInterpretationBundle.experienceContract,
      contractConstraints: canonicalInterpretationBundle.contractConstraints,
    },
  })
  assert(directionCandidates.length > 0, 'Expected a canonical direction.')
  const selectedDirection = directionSelectionFromCandidate(directionCandidates[0]!)
  const selectedDirectionContext = buildResolvedDirectionContext(selectedDirection)
  assert(selectedDirectionContext, 'Expected resolved selected direction context.')
  const routeShapeContract = buildRouteShapeContract({
    conciergeIntent,
    contractConstraints: canonicalInterpretationBundle.contractConstraints,
    selectedDirection,
    selectedDirectionContext,
  })
  const input = projectConciergeIntentToIntentInput({
    conciergeIntent,
    mode: 'curate',
    city: 'San Jose',
    district: selectedDirection.pocketLabel,
    distanceMode: starterPack.distanceMode ?? 'nearby',
    selectedDirectionContext: buildIntentSelectedDirectionContext(selectedDirection),
  })
  const result = await runGeneratePlan(input, {
    starterPack,
    seedVenues: sanJoseVenues,
    sourceMode: 'curated',
    sourceModeOverrideApplied: true,
    debugMode: false,
    experienceContract: canonicalInterpretationBundle.experienceContract,
    contractConstraints: canonicalInterpretationBundle.contractConstraints,
    canonicalInterpretationBundle,
    rankedDistrictPockets: districtPreview.ranked,
    contractGateWorld,
    strategyAdmissibleWorlds,
    routeShapeContract,
  })
  return {
    starterPack,
    selectedDirection,
    routeShapeContract,
    result,
  }
}

function decide(params: {
  result: GeneratePlanResult
  routeShapeContract?: RouteShapeContract | null
  selectedDirectionId?: string
}) {
  return buildCurateCommittedRouteFallbackDecision({
    starterPack: world.starterPack,
    result: params.result,
    selectedDirectionId: params.selectedDirectionId ?? world.selectedDirection.id,
    selectedPocketId: world.selectedDirection.pocketId,
    routeShapeContract: params.routeShapeContract,
  })
}

const world = await buildWorld()

const approved = decide({
  result: world.result,
  routeShapeContract: world.routeShapeContract,
})
assert.equal(approved.status, 'accepted')
assert.equal(approved.finalRouteApproval.status, 'approved')
assert.equal(
  approved.finalRouteApproval.diagnostics.source,
  'app.curate.committedRouteFallbackFinalRouteAuthority',
)
assert.equal(approved.finalRouteApproval.diagnostics.tasteStatus, 'pass')
assert.equal(approved.finalRouteApproval.diagnostics.bearingsStatus, 'pass')
assert.equal(approved.finalRouteApproval.diagnostics.waypointC1Approval?.topCandidate?.eligible, true)
assert.equal(approved.finalRouteApproval.diagnostics.greatStop?.status, 'PASS')
assert.equal(baseRouteSignature(approved.approvedCandidate), baseRouteSignature(world.result.selectedArc))
assert.equal(
  shownSignature(world.result, approved.approvedCandidate),
  shownSignature(world.result, world.result.selectedArc),
)
assert.equal(
  approved.artifact.enrichment?.runtimeLockEligibility?.eligible,
  true,
  'Accepted fallback artifact must carry existing runtime eligibility.',
)
const shownAuthority = validateCurateCommittedRouteFallbackShownRouteAuthority({
  decision: approved,
  finalRoute: runtimeRouteFromCandidate(approved.approvedCandidate),
})
assert.equal(shownAuthority.status, 'accepted')

const missingApproval = decide({
  result: world.result,
})
assert.equal(missingApproval.status, 'rejected')
assert.equal(missingApproval.rejectedReason, 'missing_route_shape_contract')

const mismatchedRuntimeRoute = runtimeRouteFromCandidate(approved.approvedCandidate)
mismatchedRuntimeRoute.stops[1] = {
  ...mismatchedRuntimeRoute.stops[1]!,
  venueId: 'curate-authority-mismatched-highlight',
}
const identityMismatch =
  validateCurateCommittedRouteFallbackShownRouteAuthority({
    decision: approved,
    finalRoute: mismatchedRuntimeRoute,
  })
assert.equal(identityMismatch.status, 'rejected')
assert.equal(identityMismatch.rejectedReason, 'final_route_identity_mismatch')

const tasteRefusal = decide({
  result: withCandidate(
    world.result,
    weakenComposition(world.result.selectedArc, 'curate-fallback:taste-fail'),
  ),
  routeShapeContract: world.routeShapeContract,
})
assert.equal(tasteRefusal.status, 'rejected')
assert.equal(tasteRefusal.rejectedReason, 'taste_final_route_refused')

const bearingsRefusal = decide({
  result: withCandidate(
    world.result,
    scatterNeighborhoods(world.result.selectedArc, 'curate-fallback:bearings-fail'),
  ),
  routeShapeContract: world.routeShapeContract,
})
assert.equal(bearingsRefusal.status, 'rejected')
assert.equal(bearingsRefusal.rejectedReason, 'bearings_final_route_refused')

const greatStopRefusal = decide({
  result: withCandidate(
    world.result,
    staleFieldCandidate(world.result.selectedArc, 'curate-fallback:great-stop-fail'),
  ),
  routeShapeContract: world.routeShapeContract,
})
assert.equal(greatStopRefusal.status, 'rejected')
assert.equal(greatStopRefusal.rejectedReason, 'great_stop_final_route_refused')

const staleProjection = decide({
  result: world.result,
  routeShapeContract: world.routeShapeContract,
  selectedDirectionId: 'stale-direction',
})
assert.equal(staleProjection.status, 'rejected')
assert.equal(staleProjection.rejectedReason, 'stale_projection')

const deterministicA = decide({
  result: world.result,
  routeShapeContract: world.routeShapeContract,
})
const deterministicB = decide({
  result: world.result,
  routeShapeContract: world.routeShapeContract,
})
assert.deepEqual(
  {
    status: deterministicA.status,
    routeStops: deterministicA.routeStops,
    signature:
      deterministicA.status === 'accepted'
        ? baseRouteSignature(deterministicA.approvedCandidate)
        : null,
  },
  {
    status: deterministicB.status,
    routeStops: deterministicB.routeStops,
    signature:
      deterministicB.status === 'accepted'
        ? baseRouteSignature(deterministicB.approvedCandidate)
        : null,
  },
)

assert.equal(fetchCalls, 0, 'No provider calls are allowed.')
process.env.VITE_ID8_ENABLE_FIELD_STATIC_PROVIDER_CORPUS_CURATE = previousFallbackFlag

console.log(
  JSON.stringify(
    {
      result: 'PASS',
      proof: 'curate-committed-fallback-final-route-authority',
      seam:
        'Curate committed fallback -> buildCurateCommittedRouteFallbackDecision -> approveFinalRouteCandidate -> Taste -> Bearings -> Waypoint C1 -> Great Stop',
      approved: {
        routeShapeContractId: world.routeShapeContract.id,
        routeSignature: baseRouteSignature(approved.approvedCandidate),
        shownSignature: shownSignature(world.result, approved.approvedCandidate),
        runtimeEligible: approved.artifact.enrichment?.runtimeLockEligibility?.eligible,
      },
      refusing: {
        missingApproval,
        identityMismatch,
        tasteRefusal,
        bearingsRefusal,
        greatStopRefusal,
        staleProjection,
      },
      determinism: {
        routeStops: deterministicA.routeStops,
      },
      providerCalls: fetchCalls,
    },
    null,
    2,
  ),
)
