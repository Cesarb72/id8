import assert from 'node:assert/strict'
import { sanJoseVenues } from '../src/data/venues.ts'
import {
  buildApplicationConciergeIntent,
  projectConciergeIntentToIntentInput,
} from '../src/app/concierge/conciergeIntentAdapter.ts'
import { buildCanonicalSurpriseC1RouteShapeContract } from '../src/domain/arc/buildCanonicalSurpriseC1RouteShapeContract.ts'
import { getArcStopCandidateId } from '../src/domain/candidates/candidateIdentity.ts'
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
import {
  computeTasteExperienceCompositionStamp,
  type TasteExperienceCompositionCandidateEvidence,
  type TasteExperienceCompositionStamp,
} from '../src/domain/interpretation/taste/computeExperienceCompositionStamp.ts'
import type { TasteRouteMomentVerdict } from '../src/domain/interpretation/taste/routeMomentVerdict.ts'
import { runGeneratePlan } from '../src/domain/runGeneratePlan.ts'
import type { ArcCandidate, ArcStop } from '../src/domain/types/arc.ts'
import type { PersonaMode, RouteShapeContract, RouteShapeRole, VibeAnchor } from '../src/domain/types/intent.ts'
import {
  selectWaypointC1ApprovalCandidates,
  type WaypointC1ApprovalDiagnostics,
} from '../src/domain/waypoint/selectWaypointC1ApprovalCandidates.ts'

const cases = [
  {
    id: 'romantic-cultured',
    persona: 'romantic',
    vibe: 'cultured',
    expectedRouteSignature:
      'warmup:sj-voyager-coffee|peak:sj-downtown-listening-room::activation::live_performance|cooldown:sj-orchard-artisan-gelato',
    expectedScore: 0.9646093225730734,
  },
  {
    id: 'family-cozy',
    persona: 'family',
    vibe: 'cozy',
    expectedRouteSignature:
      'warmup:sj-willow-glen-tea-atelier|peak:sj-preserve-botanical-studio|cooldown:sj-willow-glen-bakehouse',
    expectedScore: 0.9623465218659076,
  },
] as const satisfies readonly {
  id: string
  persona: Extract<PersonaMode, 'romantic' | 'family'>
  vibe: Extract<VibeAnchor, 'cultured' | 'cozy'>
  expectedRouteSignature: string
  expectedScore: number
}[]

let fetchCalls = 0
globalThis.fetch = ((input: RequestInfo | URL) => {
  fetchCalls += 1
  throw new Error(`C1 Waypoint enforcement proof must not call providers: ${String(input)}`)
}) as typeof fetch

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

function routeSignature(candidate: ArcCandidate): string {
  return candidate.stops.map((stop) => `${stop.role}:${getArcStopCandidateId(stop)}`).join('|')
}

function c1RoleFor(stop: ArcStop): TasteExperienceCompositionCandidateEvidence['role'] {
  if (stop.role === 'warmup') return 'start'
  if (stop.role === 'peak') return 'highlight'
  if (stop.role === 'wildcard') return 'surprise'
  return 'windDown'
}

function c1EvidenceFor(stop: ArcStop): TasteExperienceCompositionCandidateEvidence {
  return {
    role: c1RoleFor(stop),
    candidateId: getArcStopCandidateId(stop),
    venueName: stop.scoredVenue.venue.name,
    category: stop.scoredVenue.venue.category,
    tags: stop.scoredVenue.venue.tags,
    neighborhood: stop.scoredVenue.venue.neighborhood,
    energyScore: Math.max(0, Math.min(1, stop.scoredVenue.venue.energyLevel / 5)),
    roleFitScore: stop.scoredVenue.roleScores[stop.role],
    stopShapeFitScore:
      stop.role === 'warmup'
        ? stop.scoredVenue.stopShapeFit.start
        : stop.role === 'peak'
          ? stop.scoredVenue.stopShapeFit.highlight
          : stop.role === 'wildcard'
            ? stop.scoredVenue.stopShapeFit.surprise
            : stop.scoredVenue.stopShapeFit.windDown,
    vibeFitScore: stop.scoredVenue.vibeAuthority.overall,
    intentFitScore: stop.scoredVenue.contextSpecificity.byRole[stop.role],
    momentScore: stop.scoredVenue.taste.signals.momentPotential.score,
    momentIntensityScore: stop.scoredVenue.taste.signals.momentIntensity.score,
    primaryExperienceArchetype: stop.scoredVenue.taste.signals.primaryExperienceArchetype,
    momentIdentityType: stop.scoredVenue.momentIdentity.type,
    isWildcard: stop.role === 'wildcard',
    highlightValidity: stop.scoredVenue.highlightValidity.validityLevel,
  }
}

function weakEvidence(role: RouteShapeRole): TasteExperienceCompositionCandidateEvidence {
  return {
    role,
    candidateId: `slice4_negative:${role}`,
    venueName: `Slice 4 negative ${role}`,
    category: role === 'highlight' ? 'cafe' : 'bar',
    tags:
      role === 'highlight'
        ? ['quiet', 'passive', 'generic']
        : ['loud', 'late night', 'disconnected', 'mismatch'],
    neighborhood: role === 'windDown' ? 'Far District' : 'Downtown',
    energyScore: role === 'highlight' ? 0.18 : 0.9,
    roleFitScore: 0.16,
    stopShapeFitScore: 0.14,
    vibeFitScore: 0.18,
    intentFitScore: 0.2,
    momentScore: role === 'highlight' ? 0.1 : 0.16,
    momentIntensityScore: role === 'highlight' ? 0.12 : 0.92,
    primaryExperienceArchetype: 'generic_mismatch',
    momentIdentityType: role === 'highlight' ? 'support' : 'close',
    highlightValidity: role === 'highlight' ? 'invalid' : 'unknown',
  }
}

function badMomentVerdict(highlight: TasteExperienceCompositionCandidateEvidence): TasteRouteMomentVerdict {
  return {
    source: 'taste',
    provenance: [{ source: 'taste', key: 'move2_gate3g_slice4_negative_peak_reference' }],
    peakCandidateVenueId: highlight.candidateId,
    anchorAsPeakCandidacy: 'supporting_anchor',
    peakSuitability: { score: 0.12, tier: 'standard' },
    momentStrengthVerdict: {
      strength: 'light',
      score: 0.12,
      reason: 'Synthetic active-C1 negative proof supplies a non-peak highlight.',
    },
    momentPreservationStatus: 'missed',
    strongMomentPresent: false,
    flatArcRisk: { level: 'high', score: 0.9, varianceScore: 0.1, penalty: 0, reasons: [] },
    missedPeakReason: { applied: true, code: 'selected_peak_too_weak' },
    availableMomentEvidence: { availableHighMomentCount: 0, availableStrongMomentCount: 0 },
    peakRoleEvidence: {
      candidateVenueId: highlight.candidateId,
      roleFitScore: highlight.roleFitScore,
      stopShapeFitScore: highlight.stopShapeFitScore,
      highlightValidity: 'invalid',
    },
    anchorStrengthEvidence: {
      candidateVenueId: highlight.candidateId,
      anchorStrength: 0.12,
      momentIdentityType: 'support',
      momentIdentityStrength: 'light',
      momentPotentialScore: highlight.momentScore,
      momentIntensityScore: highlight.momentIntensityScore,
    },
  }
}

function cloneCandidateWithStamp(
  candidate: ArcCandidate,
  id: string,
  stamp: TasteExperienceCompositionStamp,
): ArcCandidate {
  return {
    ...candidate,
    id,
    scoreBreakdown: {
      ...candidate.scoreBreakdown,
      experienceCompositionStamp: stamp,
    },
  }
}

function failureStamp(routeShapeContract: RouteShapeContract): TasteExperienceCompositionStamp {
  const stops = [weakEvidence('start'), weakEvidence('highlight'), weakEvidence('windDown')]
  const stamp = computeTasteExperienceCompositionStamp({
    routeShapeContract,
    stops,
    routeMomentVerdict: badMomentVerdict(stops[1]!),
  })
  assert.equal(stamp.status, 'fail')
  assert.equal(stamp.requirementSource, 'route_shape_contract')
  return stamp
}

function unavailableStamp(routeShapeContract: RouteShapeContract): TasteExperienceCompositionStamp {
  const stamp = computeTasteExperienceCompositionStamp({
    routeShapeContract,
    stops: [],
  })
  assert.equal(stamp.status, 'unavailable')
  assert.equal(stamp.requirementSource, 'route_shape_contract')
  return stamp
}

function softUnauthorizedStamp(candidate: ArcCandidate, routeShapeContract: RouteShapeContract): TasteExperienceCompositionStamp {
  const highlight = candidate.stops.find((stop) => stop.role === 'peak')
  assert(highlight, 'Expected selected route highlight.')
  const stamp = computeTasteExperienceCompositionStamp({
    routeShapeContract,
    stops: [
      ...candidate.stops.map(c1EvidenceFor),
      {
        ...c1EvidenceFor(highlight),
        role: 'surprise',
        candidateId: 'slice4_soft:wildcard',
        isWildcard: true,
      },
    ],
    routeMomentVerdict: candidate.scoreBreakdown.routeMomentVerdict,
  })
  assert.equal(stamp.status, 'soft')
  assert.equal(stamp.requirementSource, 'route_shape_contract')
  assert(
    [
      stamp.startContribution.requirement,
      stamp.highlightContribution.requirement,
      stamp.windDownContribution.requirement,
    ].every((requirement) => requirement?.minimumStatus !== 'soft'),
    'Current C1 projection must not authorize soft approval for this proof.',
  )
  return stamp
}

function assertC1DiagnosticPass(diagnostics: WaypointC1ApprovalDiagnostics, routeShapeContract: RouteShapeContract): void {
  assert.equal(diagnostics.enforcementActive, true)
  assert.equal(diagnostics.routeShapeContractId, routeShapeContract.id)
  assert.equal(diagnostics.projectionId, routeShapeContract.interpretationC1Projection?.projectionId)
  assert.equal(diagnostics.topCandidate?.eligible, true)
  assert.equal(diagnostics.topCandidate?.tasteStatus, 'pass')
  assert.equal(diagnostics.topCandidate?.requirementSource, 'route_shape_contract')
}

function summarizeC1(diagnostics: WaypointC1ApprovalDiagnostics): unknown {
  return {
    enforcementActive: diagnostics.enforcementActive,
    routeShapeContractId: diagnostics.routeShapeContractId,
    projectionId: diagnostics.projectionId,
    evaluatedCandidateCount: diagnostics.evaluatedCandidateCount,
    eligibleCandidateCount: diagnostics.eligibleCandidateCount,
    ineligibleCandidateCount: diagnostics.ineligibleCandidateCount,
    selectedCandidateRank: diagnostics.selectedCandidateRank,
    topCandidate: diagnostics.topCandidate,
    firstEligibleCandidate: diagnostics.firstEligibleCandidate,
    failureReasons: diagnostics.failureReasons,
    softAuthorizationSource: diagnostics.softAuthorizationSource,
  }
}

async function runCase(spec: (typeof cases)[number]) {
  const conciergeIntent = buildApplicationConciergeIntent({
    mode: 'surprise',
    persona: spec.persona,
    primaryVibe: spec.vibe,
    city: 'San Jose',
  })
  const canonicalInterpretationBundle = buildCanonicalInterpretationBundle({
    conciergeIntent,
    interpretationSource: 'scripts.move2.gate3g.c1_waypoint_enforcement',
  })
  const districtPreview = await buildDistrictOpportunityProfiles({
    locationQuery: 'San Jose',
    includeDebug: true,
  })
  const contractGateWorld = buildContractGateWorldFromCanonical({
    canonicalInterpretationBundle,
    ranked: districtPreview.ranked,
    source: 'scripts.move2.gate3g.c1_waypoint_enforcement',
  })
  const strategyAdmissibleWorlds = buildStrategyAdmissibleWorlds({ contractGateWorld })
  const directionCandidates = buildDirectionCandidates({
    ranked: districtPreview.ranked,
    debug: districtPreview.debug,
    contractGateWorld,
    strategyAdmissibleWorlds,
    context: {
      persona: spec.persona,
      vibe: spec.vibe,
      experienceContract: canonicalInterpretationBundle.experienceContract,
      contractConstraints: canonicalInterpretationBundle.contractConstraints,
    },
  })
  assert(directionCandidates.length > 0, `${spec.id} must resolve a canonical direction.`)
  const selectedDirection = directionSelectionFromCandidate(directionCandidates[0]!)
  const selectedDirectionContext = buildResolvedDirectionContext(selectedDirection)
  assert(selectedDirectionContext, `${spec.id} selected direction context must resolve.`)
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
  const compatibility = await runGeneratePlan(input, commonOptions)
  const c1Diagnostics = active.trace.greatStopGateSelectionDiagnostics?.waypointC1Approval
  assert(c1Diagnostics, `${spec.id} must expose C1 approval diagnostics.`)
  assertC1DiagnosticPass(c1Diagnostics, routeShapeContract)
  assert.equal(routeSignature(active.selectedArc), spec.expectedRouteSignature)
  assert.equal(active.selectedArc.totalScore, spec.expectedScore)
  assert.equal(routeSignature(repeated.selectedArc), spec.expectedRouteSignature)
  assert.equal(repeated.selectedArc.totalScore, spec.expectedScore)
  assert.equal(active.trace.greatStopGateResult.status, 'PASS')
  assert.equal(compatibility.trace.greatStopGateSelectionDiagnostics?.waypointC1Approval?.enforcementActive, false)
  assert.equal(
    active.selectedArc.scoreBreakdown.experienceCompositionStamp?.routeShapeContractId,
    routeShapeContract.id,
  )
  assert.equal(
    active.selectedArc.scoreBreakdown.experienceCompositionStamp?.requirementSource,
    'route_shape_contract',
  )

  const passCandidate = active.selectedArc
  const failCandidate = cloneCandidateWithStamp(
    passCandidate,
    `${passCandidate.id}:c1_fail`,
    failureStamp(routeShapeContract),
  )
  const unavailableCandidate = cloneCandidateWithStamp(
    passCandidate,
    `${passCandidate.id}:c1_unavailable`,
    unavailableStamp(routeShapeContract),
  )
  const softCandidate = cloneCandidateWithStamp(
    passCandidate,
    `${passCandidate.id}:c1_soft`,
    softUnauthorizedStamp(passCandidate, routeShapeContract),
  )
  const failThenPass = selectWaypointC1ApprovalCandidates({
    routeShapeContract,
    candidates: [failCandidate, passCandidate],
  })
  assert.equal(failThenPass.candidates[0]?.id, passCandidate.id)
  assert(failThenPass.diagnostics.failureReasons.includes('c1_status_fail'))
  const unavailableThenPass = selectWaypointC1ApprovalCandidates({
    routeShapeContract,
    candidates: [unavailableCandidate, passCandidate],
  })
  assert.equal(unavailableThenPass.candidates[0]?.id, passCandidate.id)
  assert(unavailableThenPass.diagnostics.failureReasons.includes('c1_status_unavailable'))
  const softThenPass = selectWaypointC1ApprovalCandidates({
    routeShapeContract,
    candidates: [softCandidate, passCandidate],
  })
  assert.equal(softThenPass.candidates[0]?.id, passCandidate.id)
  assert(softThenPass.diagnostics.failureReasons.includes('c1_soft_not_authorized'))
  assert.equal(softThenPass.diagnostics.softAuthorizationSource, 'none')
  const noneEligible = selectWaypointC1ApprovalCandidates({
    routeShapeContract,
    candidates: [failCandidate, unavailableCandidate, softCandidate],
  })
  assert.equal(noneEligible.candidates.length, 0)
  assert(noneEligible.diagnostics.failureReasons.includes('c1_status_fail'))
  assert(noneEligible.diagnostics.failureReasons.includes('c1_status_unavailable'))
  assert(noneEligible.diagnostics.failureReasons.includes('c1_soft_not_authorized'))
  const compatibilitySelection = selectWaypointC1ApprovalCandidates({
    candidates: [unavailableCandidate],
  })
  assert.equal(compatibilitySelection.diagnostics.enforcementActive, false)
  assert.equal(compatibilitySelection.candidates[0]?.id, unavailableCandidate.id)
  assert.equal(failCandidate.totalScore, passCandidate.totalScore)
  assert.equal(unavailableCandidate.totalScore, passCandidate.totalScore)
  assert.equal(softCandidate.totalScore, passCandidate.totalScore)

  return {
    caseId: spec.id,
    routeShapeContractId: routeShapeContract.id,
    projectionId: routeShapeContract.interpretationC1Projection?.projectionId,
    selectedRouteIdentity: {
      selectedArcId: active.selectedArc.id,
      routeSignature: routeSignature(active.selectedArc),
      totalScore: active.selectedArc.totalScore,
    },
    assessedRouteIdentity: {
      routeShapeContractId:
        active.selectedArc.scoreBreakdown.experienceCompositionStamp?.routeShapeContractId,
      requirementSource:
        active.selectedArc.scoreBreakdown.experienceCompositionStamp?.requirementSource,
      tasteStatus: active.selectedArc.scoreBreakdown.experienceCompositionStamp?.status,
      tasteReasonCodes: active.selectedArc.scoreBreakdown.experienceCompositionStamp?.reasons,
    },
    shownRouteIdentity: active.itinerary.stops
      .map((stop) => `${stop.role}:${stop.venueId}`)
      .join('|'),
    waypointC1Approval: summarizeC1(c1Diagnostics),
    failPolicy: summarizeC1(failThenPass.diagnostics),
    unavailablePolicy: summarizeC1(unavailableThenPass.diagnostics),
    softPolicy: summarizeC1(softThenPass.diagnostics),
    honestFailurePolicy: summarizeC1(noneEligible.diagnostics),
    compatibilityPolicy: summarizeC1(compatibilitySelection.diagnostics),
    compatibilitySelectedRoute: {
      selectedArcId: compatibility.selectedArc.id,
      routeSignature: routeSignature(compatibility.selectedArc),
      c1EnforcementActive:
        compatibility.trace.greatStopGateSelectionDiagnostics?.waypointC1Approval?.enforcementActive,
    },
    scoreMutationCheck: {
      passTotalScore: passCandidate.totalScore,
      failCloneTotalScore: failCandidate.totalScore,
      unavailableCloneTotalScore: unavailableCandidate.totalScore,
      softCloneTotalScore: softCandidate.totalScore,
    },
    deterministicRepeat: {
      routeSignature: routeSignature(repeated.selectedArc),
      totalScore: repeated.selectedArc.totalScore,
    },
  }
}

const results = []
for (const spec of cases) {
  results.push(await runCase(spec))
}
assert.equal(fetchCalls, 0, 'No provider calls are allowed.')

console.log(
  JSON.stringify(
    {
      result: 'PASS',
      proof: 'move-2-gate-3g-c1-waypoint-enforcement',
      enforcementSeam:
        'runGeneratePlan -> selectWaypointC1ApprovalCandidates -> selectGreatStopGatePassingCandidate',
      policy: {
        pass: 'eligible',
        fail: 'ineligible',
        unavailable: 'ineligible',
        soft: 'eligible only when role composition requirements explicitly set minimumStatus: soft',
        compatibilityNoCarrier: 'enforcement inactive',
      },
      cases: results,
      providerCalls: fetchCalls,
    },
    null,
    2,
  ),
)
