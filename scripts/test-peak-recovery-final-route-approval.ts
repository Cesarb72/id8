import assert from 'node:assert/strict'
import { sanJoseVenues } from '../src/data/venues.ts'
import {
  buildApplicationConciergeIntent,
  projectConciergeIntentToIntentInput,
} from '../src/app/concierge/conciergeIntentAdapter.ts'
import { buildCanonicalSurpriseC1RouteShapeContract } from '../src/domain/arc/buildCanonicalSurpriseC1RouteShapeContract.ts'
import {
  coordinateArcPeakRecovery,
  type ArcPeakRecoveryReviewedCandidate,
} from '../src/integrations/waypoint/coordination/coordinateArcPeakRecovery.ts'
import type {
  ArcPeakRecoveryBearingsFeasibilitySignal,
  ArcPeakRecoveryCandidate,
  ArcPeakRecoveryTasteCentralMomentQualitySignal,
  ArcPeakRecoveryTastePeakWorthinessSignal,
} from '../src/integrations/waypoint/coordination/arcPeakRecoveryCoordinationView.ts'
import {
  getArcStopBaseVenueId,
  getArcStopCandidateId,
} from '../src/domain/candidates/candidateIdentity.ts'
import type { PeakCandidateFeasibilityVerdict } from '../src/domain/bearings/evaluateArcRouteMovementFeasibility.ts'
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
import type { TasteRolePoolCandidateMeaningEvidence } from '../src/domain/interpretation/taste/tasteRolePoolMeaningView.ts'
import { getCrewPolicy } from '../src/domain/intent/getCrewPolicy.ts'
import { projectItinerary } from '../src/domain/itinerary/projectItinerary.ts'
import {
  approvePeakRecoveryFinalRoute,
  arcUsesRecoveredPeak,
  runGeneratePlan,
} from '../src/domain/runGeneratePlan.ts'
import type { ArcCandidate } from '../src/domain/types/arc.ts'
import type { RolePoolPeakWorthinessStatus } from '../src/domain/interpretation/taste/computeRolePoolMeaningEvidence.ts'
import type { IntentProfile, RouteShapeContract } from '../src/domain/types/intent.ts'

let fetchCalls = 0
globalThis.fetch = ((input: RequestInfo | URL) => {
  fetchCalls += 1
  throw new Error(
    `Peak recovery final-route approval proof must not call providers: ${String(input)}`,
  )
}) as typeof fetch

interface RecoveryPayload {
  id: string
  score: number
  reason: string
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

function recoveredPeakCandidate(candidate: ArcCandidate, id: string): ArcCandidate {
  const next = clone(candidate)
  next.id = id
  const peak = next.stops.find((stop) => stop.role === 'peak')
  assert(peak, 'Expected peak stop for recovered candidate.')
  peak.scoredVenue.recoveredCentralMomentHighlight = true
  peak.scoredVenue.centralMomentRecoveryReason = 'central_moment_recovery'
  return next
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
    stop.scoredVenue.venue.neighborhood = `Far Peak Recovery Proof ${index + 1}`
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

function tasteAssessment(
  candidateId: string,
  status: RolePoolPeakWorthinessStatus,
  score: number,
): TasteRolePoolCandidateMeaningEvidence<'peak_worthiness'> {
  return {
    source: 'taste',
    kind: 'peak_worthiness',
    candidateVenueId: candidateId,
    role: 'highlight',
    score,
    strength: score >= 0.75 ? 'strong' : score >= 0.55 ? 'medium' : 'weak',
    reasons: status === 'peak_worthy' ? ['peak_worthiness:pass'] : [`peak_worthiness:${status}`],
    components: [
      {
        source: 'taste',
        key: 'taste_peak_worthiness_status',
        value: status,
      },
    ],
  } as TasteRolePoolCandidateMeaningEvidence<'peak_worthiness'>
}

function centralMomentAssessment(
  candidateId: string,
): TasteRolePoolCandidateMeaningEvidence<'central_moment_quality'> {
  return {
    source: 'taste',
    kind: 'central_moment_quality',
    candidateVenueId: candidateId,
    role: 'highlight',
    score: 0.82,
    compatibility: 'compatible',
    reasons: ['central_moment_quality:pass'],
    components: [
      {
        source: 'taste',
        key: 'taste_central_moment_status',
        value: 'central_moment',
      },
    ],
  } as TasteRolePoolCandidateMeaningEvidence<'central_moment_quality'>
}

function bearingsVerdict(feasible: boolean, reasons: string[] = []): PeakCandidateFeasibilityVerdict {
  return {
    feasible,
    distanceFeasible: feasible,
    routeTimeFeasible: feasible,
    hoursFeasible: true,
    anchorFeasible: true,
    constraintsFeasible: feasible,
    reasons,
    provenance: {
      source: 'bearings',
      version: 'peak-recovery-final-route-approval-proof',
    },
  }
}

function eligibleRecoveryCandidate(params: {
  id: string
  score: number
  reason: string
}): ArcPeakRecoveryCandidate<RecoveryPayload> {
  const peakWorthiness: ArcPeakRecoveryTastePeakWorthinessSignal = {
    source: 'taste',
    key: 'taste_peak_worthiness',
    label: 'Taste peak-worthiness',
    value: true,
    status: 'peak_worthy',
    assessment: tasteAssessment(params.id, 'peak_worthy', 0.84),
  }
  const centralMoment: ArcPeakRecoveryTasteCentralMomentQualitySignal = {
    source: 'taste',
    key: 'taste_central_moment_quality',
    label: 'Taste central-moment quality',
    value: true,
    status: 'central_moment',
    assessment: centralMomentAssessment(params.id),
  }
  const feasible = bearingsVerdict(true) as PeakCandidateFeasibilityVerdict & {
    feasible: true
  }
  const bearings: ArcPeakRecoveryBearingsFeasibilitySignal = {
    source: 'bearings',
    key: 'bearings_peak_feasibility',
    label: 'Bearings peak feasibility',
    value: true,
    verdict: feasible,
  }
  return {
    id: params.id,
    payload: params,
    identity: {
      candidateId: params.id,
      baseVenueId: params.id,
      traceLabel: params.id,
    },
    roleContext: {
      candidateRole: 'peak',
      rolePoolRole: 'peak',
      currentPeakCandidateId: 'weak-current-peak',
    },
    coordinationContext: {
      context: 'recovery_pool_candidate',
      requestReason: 'empty_standard_peak_pool',
    },
    deterministicTieBreakKey: params.id,
    tastePeakWorthiness: peakWorthiness,
    tasteCentralMomentQuality: centralMoment,
    bearingsPeakFeasibility: bearings,
    signals: [peakWorthiness, centralMoment, bearings],
  }
}

function reviewedCandidate(params: {
  id: string
  tasteStatus?: RolePoolPeakWorthinessStatus
  bearingsFeasible?: boolean
  bearingsReasons?: string[]
}): ArcPeakRecoveryReviewedCandidate {
  return {
    candidateId: params.id,
    tastePeakAssessment: params.tasteStatus
      ? {
          source: 'taste',
          status: params.tasteStatus,
          reasons:
            params.tasteStatus === 'peak_worthy'
              ? ['peak_worthiness:pass']
              : [`peak_worthiness:${params.tasteStatus}`],
        }
      : undefined,
    bearingsPeakFeasibility:
      params.bearingsFeasible === undefined
        ? undefined
        : {
            source: 'bearings',
            feasible: params.bearingsFeasible,
            reasons: params.bearingsReasons ?? [],
          },
  }
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
    interpretationSource: 'scripts.peak_recovery_final_route_approval',
  })
  const districtPreview = await buildDistrictOpportunityProfiles({
    locationQuery: 'San Jose',
    includeDebug: true,
  })
  const contractGateWorld = buildContractGateWorldFromCanonical({
    canonicalInterpretationBundle,
    ranked: districtPreview.ranked,
    source: 'scripts.peak_recovery_final_route_approval',
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
  }
}

function approveCandidate(params: {
  proposedCandidate: ArcCandidate
  intent: IntentProfile
  routeShapeContract?: RouteShapeContract
}) {
  return approvePeakRecoveryFinalRoute({
    proposedCandidate: params.proposedCandidate,
    intent: params.intent,
    crewPolicy: getCrewPolicy(params.intent.crew),
    lens: world.active.lens,
    routeShapeContract: params.routeShapeContract,
  })
}

const recoveryOrdering = coordinateArcPeakRecovery<RecoveryPayload>({
  candidates: [
    eligibleRecoveryCandidate({
      id: 'recovery-b',
      score: 0.78,
      reason: 'central_moment_recovery',
    }),
    eligibleRecoveryCandidate({
      id: 'recovery-a',
      score: 0.91,
      reason: 'central_moment_recovery_family_aligned',
    }),
  ],
  currentPeakCandidateId: 'weak-current-peak',
  reviewedCandidates: [
    reviewedCandidate({
      id: 'weak-current-peak',
      tasteStatus: 'weak_peak',
      bearingsFeasible: true,
    }),
    reviewedCandidate({
      id: 'recovery-a',
      tasteStatus: 'peak_worthy',
      bearingsFeasible: true,
    }),
    reviewedCandidate({
      id: 'recovery-b',
      tasteStatus: 'peak_worthy',
      bearingsFeasible: true,
    }),
  ],
  selectLimit: 2,
  getCoordinationScore: (candidate) => candidate.payload?.score ?? 0,
  getRecoveryReason: (candidate) => candidate.payload?.reason,
})
assert.equal(recoveryOrdering.outcome, 'recovered_peak_selected')
assert.deepEqual(
  recoveryOrdering.selectedCandidates.map((candidate) => candidate.id),
  ['recovery-a', 'recovery-b'],
  'Recovery candidate ordering must remain score-then-tie-break deterministic.',
)

const noRecovery = coordinateArcPeakRecovery<RecoveryPayload>({
  candidates: [],
  currentPeakCandidateId: 'weak-current-peak',
  reviewedCandidates: [
    reviewedCandidate({
      id: 'weak-current-peak',
      tasteStatus: 'weak_peak',
      bearingsFeasible: true,
    }),
    reviewedCandidate({
      id: 'infeasible-peak',
      tasteStatus: 'peak_worthy',
      bearingsFeasible: false,
      bearingsReasons: ['peak_feasibility:distance'],
    }),
  ],
  selectLimit: 1,
})
assert.equal(noRecovery.outcome, 'no_recovery')
assert.equal(noRecovery.selectedCandidates.length, 0)
assert(noRecovery.diagnostics.some((entry) => entry.reason === 'recovery_pool_empty'))

const world = await buildWorld()
assert.equal(world.active.trace.peakRecoveryFinalRouteApproval, undefined)
assert.equal(baseRouteSignature(world.active.selectedArc), baseRouteSignature(world.repeated.selectedArc))

const recovered = recoveredPeakCandidate(world.active.selectedArc, 'peak-recovery:pass')
assert.equal(arcUsesRecoveredPeak(recovered), true)
const passing = approveCandidate({
  proposedCandidate: recovered,
  intent: world.active.intentProfile,
  routeShapeContract: world.routeShapeContract,
})
assert(passing, 'Active recovered peak route must run final-route approval.')
assert.equal(passing.status, 'approved')
assert.equal(passing.diagnostics.source, 'domain.runGeneratePlan.peakRecoveryFinalRouteApproval')
assert.equal(passing.diagnostics.targetRole, 'highlight')
assert.equal(passing.diagnostics.proposedRouteSignature, candidateRouteSignature(recovered))
assert.equal(passing.diagnostics.assessedRouteSignature, passing.diagnostics.proposedRouteSignature)
assert.equal(passing.diagnostics.approvedRouteSignature, candidateRouteSignature(passing.approvedCandidate))
assert.equal(passing.diagnostics.tasteStatus, 'pass')
assert.equal(passing.diagnostics.bearingsStatus, 'pass')
assert.equal(passing.diagnostics.waypointC1Approval?.topCandidate?.eligible, true)
assert.equal(passing.diagnostics.greatStop?.status, 'PASS')
assert.equal(
  passing.approvedCandidate.scoreBreakdown.experienceCompositionStamp?.startPreparesHighlight.status,
  'pass',
)
assert.equal(
  passing.approvedCandidate.scoreBreakdown.experienceCompositionStamp?.windDownResolvesHighlight.status,
  'pass',
)
const shown = projectItinerary(
  passing.approvedCandidate,
  world.active.intentProfile,
  world.active.lens,
)
assert.deepEqual(
  shown.stops.map((stop) => stop.venueId),
  passing.approvedCandidate.stops.map((stop) => getArcStopBaseVenueId(stop)),
  'Shown itinerary must preserve approved candidate identities.',
)

const tasteRefusal = approveCandidate({
  proposedCandidate: weakenComposition(recovered, 'peak-recovery:taste-fail'),
  intent: world.active.intentProfile,
  routeShapeContract: world.routeShapeContract,
})
assert(tasteRefusal)
assert.equal(tasteRefusal.status, 'rejected')
assert.equal(tasteRefusal.refusalOwner, 'taste')

const bearingsRefusal = approveCandidate({
  proposedCandidate: scatterNeighborhoods(recovered, 'peak-recovery:bearings-fail'),
  intent: world.active.intentProfile,
  routeShapeContract: world.routeShapeContract,
})
assert(bearingsRefusal)
assert.equal(bearingsRefusal.status, 'rejected')
assert.equal(bearingsRefusal.refusalOwner, 'bearings')

const greatStopRefusal = approveCandidate({
  proposedCandidate: staleFieldCandidate(recovered, 'peak-recovery:great-stop-fail'),
  intent: world.active.intentProfile,
  routeShapeContract: world.routeShapeContract,
})
assert(greatStopRefusal)
assert.equal(greatStopRefusal.status, 'rejected')
assert.equal(greatStopRefusal.refusalOwner, 'great_stop')

const compatibilityNoCarrier = approveCandidate({
  proposedCandidate: recovered,
  intent: world.active.intentProfile,
})
assert.equal(compatibilityNoCarrier, undefined, 'No-carrier recovery must not fabricate approval.')

const deterministicA = approveCandidate({
  proposedCandidate: recovered,
  intent: world.active.intentProfile,
  routeShapeContract: world.routeShapeContract,
})
const deterministicB = approveCandidate({
  proposedCandidate: recovered,
  intent: world.active.intentProfile,
  routeShapeContract: world.routeShapeContract,
})
assert.deepEqual(
  {
    status: deterministicA?.status,
    diagnostics: deterministicA?.diagnostics,
    signature:
      deterministicA?.status === 'approved'
        ? candidateRouteSignature(deterministicA.approvedCandidate)
        : null,
  },
  {
    status: deterministicB?.status,
    diagnostics: deterministicB?.diagnostics,
    signature:
      deterministicB?.status === 'approved'
        ? candidateRouteSignature(deterministicB.approvedCandidate)
        : null,
  },
)
assert.equal(fetchCalls, 0, 'No provider calls are allowed.')

console.log(
  JSON.stringify(
    {
      result: 'PASS',
      proof: 'peak-recovery-final-route-approval',
      seam:
        'runGeneratePlan selected recovered peak -> approvePeakRecoveryFinalRoute -> approveFinalRouteCandidate -> Taste -> Bearings -> Waypoint C1 -> Great Stop',
      routeShapeContractId: world.routeShapeContract.id,
      passing: {
        recoveredHighlight: getArcStopBaseVenueId(
          passing.approvedCandidate.stops.find((stop) => stop.role === 'peak')!,
        ),
        startPrepares:
          passing.approvedCandidate.scoreBreakdown.experienceCompositionStamp
            ?.startPreparesHighlight.status,
        windDownResolves:
          passing.approvedCandidate.scoreBreakdown.experienceCompositionStamp
            ?.windDownResolvesHighlight.status,
        approvedRouteSignature: baseRouteSignature(passing.approvedCandidate),
      },
      refusing: {
        taste: tasteRefusal,
        bearings: bearingsRefusal,
        greatStop: greatStopRefusal,
      },
      recovery: {
        ordering: recoveryOrdering.selectedCandidates.map((candidate) => candidate.id),
        noRecovery: noRecovery.outcome,
        noRecoveryDiagnostics: noRecovery.diagnostics.map((entry) => entry.reason),
      },
      compatibility: {
        approvalFabricated: Boolean(compatibilityNoCarrier),
      },
      determinism: {
        baselineRouteSignature: baseRouteSignature(world.active.selectedArc),
        repeatedRouteSignature: baseRouteSignature(world.repeated.selectedArc),
      },
      providerCalls: fetchCalls,
    },
    null,
    2,
  ),
)
