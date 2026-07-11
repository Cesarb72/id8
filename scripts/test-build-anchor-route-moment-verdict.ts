import { runGeneratePlan } from '../src/domain/runGeneratePlan.ts'
import { sanJoseVenues } from '../src/data/venues.ts'
import { buildRoutePlaceRightVerdictForArcCandidate } from '../src/domain/bearings/buildRoutePlaceRightVerdictForArcCandidate.ts'
import { computeFieldRealVerdictForArcCandidate } from '../src/domain/field/computeFieldRealVerdict.ts'
import {
  computeRouteMomentVerdict,
  type TasteRouteMomentAvailableCandidateEvidence,
  type TasteRouteMomentSelectedAnchorEvidence,
  type TasteRouteMomentStopEvidence,
} from '../src/domain/interpretation/taste/computeRouteMomentVerdict.ts'
import {
  buildGreatStopGateResult,
  buildGreatStopRoutePacingDiagnostics,
} from '../src/domain/greatStop/buildGreatStopGateResult.ts'
import {
  getArcStopBaseVenueId,
  getScoredVenueBaseVenueId,
  getScoredVenueCandidateId,
} from '../src/domain/candidates/candidateIdentity.ts'
import type { ArcCandidate, ArcStop, ScoredVenue } from '../src/domain/types/arc.ts'
import type { IntentInput } from '../src/domain/types/intent.ts'
import type { InternalRole } from '../src/domain/types/venue.ts'
import type { RoutePacingDiagnostics } from '../src/domain/types/diagnostics.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const originalFetch = globalThis.fetch
let fetchCallCount = 0

globalThis.fetch = (async () => {
  fetchCallCount += 1
  throw new Error('test-build-anchor-route-moment-verdict must not call fetch.')
}) as typeof fetch

const SELECTED_ANCHOR_BASE_VENUE_ID = 'sj-adega-wine-atelier'
const SELECTED_ANCHOR_DISPLAY_NAME = 'Adega'
const REQUIRED_ROLE = 'highlight' as const

function getRoleFitScore(stop: ArcStop): number {
  if (stop.role === 'warmup') {
    return stop.scoredVenue.roleScores.warmup
  }
  if (stop.role === 'peak') {
    return stop.scoredVenue.roleScores.peak
  }
  if (stop.role === 'wildcard') {
    return stop.scoredVenue.roleScores.wildcard
  }
  return stop.scoredVenue.roleScores.cooldown
}

function getStopShapeFitScore(stop: ArcStop): number {
  if (stop.role === 'warmup') {
    return stop.scoredVenue.stopShapeFit.start
  }
  if (stop.role === 'peak') {
    return stop.scoredVenue.stopShapeFit.highlight
  }
  if (stop.role === 'wildcard') {
    return stop.scoredVenue.stopShapeFit.surprise
  }
  return stop.scoredVenue.stopShapeFit.windDown
}

function toRouteMomentStopEvidence(stop: ArcStop): TasteRouteMomentStopEvidence {
  return {
    role: stop.role,
    candidateVenueId: getArcStopBaseVenueId(stop),
    momentIdentity: stop.scoredVenue.momentIdentity,
    momentPotential: stop.scoredVenue.taste.signals.momentPotential,
    momentIntensity: stop.scoredVenue.taste.signals.momentIntensity,
    primaryExperienceArchetype: stop.scoredVenue.taste.signals.primaryExperienceArchetype,
    anchorStrength: stop.scoredVenue.taste.signals.anchorStrength,
    roleFitScore: getRoleFitScore(stop),
    stopShapeFitScore: getStopShapeFitScore(stop),
    highlightValidity: stop.scoredVenue.highlightValidity.validityLevel,
  }
}

function toAvailableCandidateEvidence(
  candidate: ScoredVenue,
): TasteRouteMomentAvailableCandidateEvidence {
  return {
    candidateVenueId: getScoredVenueBaseVenueId(candidate),
    momentIdentity: candidate.momentIdentity,
    momentPotential: candidate.taste.signals.momentPotential,
  }
}

function uniqueScoredVenues(candidates: readonly ScoredVenue[]): ScoredVenue[] {
  return [
    ...new Map(
      candidates.map((candidate) => [getScoredVenueCandidateId(candidate), candidate] as const),
    ).values(),
  ]
}

function toSelectedAnchorEvidence(
  selectedAnchorBaseVenueId = SELECTED_ANCHOR_BASE_VENUE_ID,
  requiredRole = REQUIRED_ROLE,
): TasteRouteMomentSelectedAnchorEvidence {
  return {
    selectedAnchorBaseVenueId,
    requiredRole,
  }
}

function userRoleFor(role: InternalRole): 'start' | 'highlight' | 'surprise' | 'windDown' {
  if (role === 'warmup') return 'start'
  if (role === 'peak') return 'highlight'
  if (role === 'cooldown') return 'windDown'
  return 'surprise'
}

function summarizeStop(stop: ArcStop) {
  return {
    internalRole: stop.role,
    generatedRole: userRoleFor(stop.role),
    venueId: stop.scoredVenue.venue.id,
    baseVenueId: getArcStopBaseVenueId(stop),
    displayName: stop.scoredVenue.venue.name,
    providerRecordId: stop.scoredVenue.venue.source.providerRecordId,
    energyLevel: stop.scoredVenue.venue.energyLevel,
    roleFitScore: getRoleFitScore(stop),
    stopShapeFitScore: getStopShapeFitScore(stop),
    momentIdentity: stop.scoredVenue.momentIdentity,
    momentPotentialScore: stop.scoredVenue.taste.signals.momentPotential.score,
    momentIntensity: stop.scoredVenue.taste.signals.momentIntensity,
    anchorStrength: stop.scoredVenue.taste.signals.anchorStrength,
    highlightValidity: stop.scoredVenue.highlightValidity.validityLevel,
  }
}

function readRouteShape(
  selectedArc: ArcCandidate,
  expectedPeakBaseVenueId: string,
): 'build_peak_taper' | 'flat' | 'inconclusive' {
  const start = selectedArc.stops.find((stop) => stop.role === 'warmup')
  const peak = selectedArc.stops.find((stop) => stop.role === 'peak')
  const windDown = selectedArc.stops.find((stop) => stop.role === 'cooldown')
  if (!start || !peak || !windDown) {
    return 'inconclusive'
  }
  if (
    getArcStopBaseVenueId(peak) === expectedPeakBaseVenueId &&
    peak.scoredVenue.venue.energyLevel >= start.scoredVenue.venue.energyLevel &&
    windDown.scoredVenue.venue.energyLevel <= peak.scoredVenue.venue.energyLevel
  ) {
    return 'build_peak_taper'
  }
  if (
    selectedArc.scoreBreakdown.strongMomentPresent === false ||
    (selectedArc.scoreBreakdown.momentFlatPenalty ?? 0) > 0
  ) {
    return 'flat'
  }
  return 'inconclusive'
}

function classify(params: {
  anchorIsPeak: boolean
  routeShapeRead: ReturnType<typeof readRouteShape>
  anchorAsPeakCandidacy: string
  momentPreservationStatus: string
  strongMomentPresent: boolean
  momentRightPassed: boolean
}): 'ownership_and_behavior_realized' | 'ownership_moved_behavior_flat' | 'observer_incomplete' | 'mixed' {
  const tasteMarksIntendedPeak = params.anchorAsPeakCandidacy === 'intended_peak'
  const verdictStrongEnough =
    params.strongMomentPresent &&
    params.momentPreservationStatus === 'preserved'
  if (tasteMarksIntendedPeak && params.anchorIsPeak && verdictStrongEnough && params.momentRightPassed) {
    return params.routeShapeRead === 'build_peak_taper'
      ? 'ownership_and_behavior_realized'
      : 'mixed'
  }
  if (tasteMarksIntendedPeak || params.anchorIsPeak || params.routeShapeRead === 'build_peak_taper') {
    return 'mixed'
  }
  return 'ownership_moved_behavior_flat'
}

function summarizeVerdict(routeMoment: ReturnType<typeof computeRouteMomentVerdict>) {
  return {
    peakCandidateVenueId: routeMoment.verdict.peakCandidateVenueId,
    anchorAsPeakCandidacy: routeMoment.verdict.anchorAsPeakCandidacy,
    peakSuitability: routeMoment.verdict.peakSuitability,
    momentStrengthVerdict: routeMoment.verdict.momentStrengthVerdict,
    momentPreservationStatus: routeMoment.verdict.momentPreservationStatus,
    strongMomentPresent: routeMoment.verdict.strongMomentPresent,
    flatArcRisk: routeMoment.verdict.flatArcRisk,
    momentQualityNote: routeMoment.verdict.momentQualityNote,
  }
}

function summarizeMomentRight(greatStop: ReturnType<typeof buildGreatStopGateResult>) {
  return {
    status: greatStop.criteria.momentRight.passed ? 'PASS' : 'FAIL',
    reasons: greatStop.criteria.momentRight.reasons,
    diagnostics: greatStop.diagnostics.strongMoment,
  }
}

function syntheticStop(
  role: TasteRouteMomentStopEvidence['role'],
  candidateVenueId: string,
  params: {
    displayName: string
    energyLevel: number
    momentIdentity: TasteRouteMomentStopEvidence['momentIdentity']
    momentPotentialScore: number
    momentIntensity: TasteRouteMomentStopEvidence['momentIntensity']
    primaryExperienceArchetype: TasteRouteMomentStopEvidence['primaryExperienceArchetype']
    anchorStrength?: number
  },
): TasteRouteMomentStopEvidence {
  return {
    role,
    candidateVenueId,
    momentIdentity: params.momentIdentity,
    momentPotential: {
      score: params.momentPotentialScore,
      drivers: [],
    },
    momentIntensity: params.momentIntensity,
    primaryExperienceArchetype: params.primaryExperienceArchetype,
    anchorStrength: params.anchorStrength ?? 0.6,
    roleFitScore: 1,
    stopShapeFitScore: 0.8,
    highlightValidity: 'valid',
  }
}

function toSyntheticArcCandidate(
  id: string,
  stops: readonly TasteRouteMomentStopEvidence[],
  routeMoment: ReturnType<typeof computeRouteMomentVerdict>,
): ArcCandidate {
  const arcStops = stops.map((stop, index) => ({
    role: stop.role,
    scoredVenue: {
      candidateIdentity: {
        kind: 'venue',
        candidateId: stop.candidateVenueId,
        baseVenueId: stop.candidateVenueId,
        traceLabel: stop.candidateVenueId,
      },
      venue: {
        id: stop.candidateVenueId,
        name: stop.candidateVenueId,
        energyLevel: index === 1 ? 3 : index === 0 ? 2 : 1,
        source: {
          normalizedFromRawType: 'seed',
          sourceOrigin: 'curated',
          curatedSubtype: 'manual-custom',
          providerRecordId: `synthetic:${stop.candidateVenueId}`,
          sourceConfidence: 0.95,
          completenessScore: 0.95,
          qualityScore: 0.95,
          openNow: true,
          hoursKnown: true,
          likelyOpenForCurrentWindow: true,
          businessStatus: 'operational',
          timeConfidence: 0.95,
          hoursPressureLevel: 'strong-open',
          hoursPressureNotes: [],
          hoursDemotionApplied: false,
          hoursSuppressionApplied: false,
          sourceTypes: ['test'],
          missingFields: [],
          inferredFields: [],
          qualityGateStatus: 'approved',
          qualityGateNotes: [],
          approvalBlockers: [],
          demotionReasons: [],
          suppressionReasons: [],
        },
      },
      momentIdentity: stop.momentIdentity,
      taste: {
        signals: {
          momentPotential: stop.momentPotential,
          momentIntensity: stop.momentIntensity,
          primaryExperienceArchetype: stop.primaryExperienceArchetype,
          anchorStrength: stop.anchorStrength,
        },
        modeAlignment: {
          lane: stop.momentIdentity.type,
          score: 0.8,
        },
      },
      fitScore: 0.8,
      lensCompatibility: 0.8,
      contextSpecificity: {
        overall: 0.8,
      },
      roleScores: {
        warmup: stop.role === 'warmup' ? 1 : 0.4,
        peak: stop.role === 'peak' ? 1 : 0.4,
        wildcard: stop.role === 'wildcard' ? 1 : 0.4,
        cooldown: stop.role === 'cooldown' ? 1 : 0.4,
      },
      stopShapeFit: {
        start: stop.role === 'warmup' ? 0.8 : 0.4,
        highlight: stop.role === 'peak' ? 0.8 : 0.4,
        surprise: stop.role === 'wildcard' ? 0.8 : 0.4,
        windDown: stop.role === 'cooldown' ? 0.8 : 0.4,
      },
      highlightValidity: {
        validityLevel: stop.highlightValidity ?? 'valid',
      },
    },
  })) as ArcStop[]

  return {
    id,
    stops: arcStops,
    totalScore: routeMoment.score,
    scoreBreakdown: {
      roleFlowScore: 1,
      diversityScore: 1,
      geographyScore: 1,
      hiddenGemLift: 0,
      windDownScore: 1,
      highlightMomentScore: routeMoment.highlightMomentScore,
      momentStrengthScore: routeMoment.score,
      momentVarianceScore: routeMoment.varianceScore,
      momentFlatPenalty: routeMoment.flatPenalty + routeMoment.penalty,
      roleEnergyNote: 'legacy debug only',
      strongMomentPresent: routeMoment.strongMomentPresent,
      momentQualityNote: routeMoment.qualityNote,
    },
    pacing: {} as ArcCandidate['pacing'],
    spatial: {
      score: 1,
      notes: [],
      transitions: [],
      clusterAssignments: arcStops.map((stop, index) => ({
        venueId: getArcStopBaseVenueId(stop),
        clusterId: `synthetic-${index}`,
      })),
      clusterEscapeCount: 0,
      repeatedClusterEscapeCount: 0,
      longTransitionCount: 0,
    } as ArcCandidate['spatial'],
    hasWildcard: false,
  }
}

function syntheticPacing(): RoutePacingDiagnostics {
  return {
    transitions: [
      {
        fromRole: 'start',
        toRole: 'highlight',
        fromVenueId: 'synthetic-start',
        toVenueId: 'synthetic-peak',
        estimatedTravelMinutes: 4,
        transitionBufferMinutes: 0,
        estimatedTransitionMinutes: 4,
        frictionScore: 0.2,
        movementMode: 'walkable',
        neighborhoodContinuity: 'same-neighborhood',
        notes: [],
      },
      {
        fromRole: 'highlight',
        toRole: 'windDown',
        fromVenueId: 'synthetic-peak',
        toVenueId: 'synthetic-end',
        estimatedTravelMinutes: 4,
        transitionBufferMinutes: 0,
        estimatedTransitionMinutes: 4,
        frictionScore: 0.2,
        movementMode: 'walkable',
        neighborhoodContinuity: 'same-neighborhood',
        notes: [],
      },
    ],
    totalRouteFriction: 0.4,
    estimatedStopMinutes: 90,
    estimatedTransitionMinutes: 8,
    estimatedTotalMinutes: 98,
    estimatedTotalLabel: '98m',
    routeFeelLabel: 'synthetic',
    pacingPenaltyApplied: false,
    pacingPenaltyReasons: [],
    smoothProgressionRewardApplied: true,
    smoothProgressionRewardReasons: ['synthetic smooth progression'],
  }
}

function observeSyntheticCase(params: {
  caseId: string
  stops: readonly TasteRouteMomentStopEvidence[]
  selectedAnchor?: TasteRouteMomentSelectedAnchorEvidence
  expectedPeakBaseVenueId: string
}) {
  const routeMoment = computeRouteMomentVerdict({
    stops: params.stops,
    selectedAnchor: params.selectedAnchor,
  })
  const selectedArc = toSyntheticArcCandidate(params.caseId, params.stops, routeMoment)
  const intent = {
    mode: 'build',
    city: 'San Jose',
    persona: 'friends',
    distanceMode: 'nearby',
    planningMode: 'user-led',
    anchor: params.selectedAnchor
      ? {
          venueId: params.selectedAnchor.selectedAnchorBaseVenueId,
          role: params.selectedAnchor.requiredRole,
        }
      : undefined,
    refinementModes: [],
  } as IntentInput
  const routePacing = syntheticPacing()
  const greatStop = buildGreatStopGateResult({
    selectedArc,
    intent,
    routePacing,
    placeRightVerdict: buildRoutePlaceRightVerdictForArcCandidate({
      candidate: selectedArc,
      intent,
      routePacing,
      locationClass: 'L1 Dense',
    }),
    fieldRealVerdict: computeFieldRealVerdictForArcCandidate(selectedArc),
    locationClass: 'L1 Dense',
    locationClassSource: 'explicit',
  })
  return {
    route: selectedArc.stops.map(summarizeStop),
    routeShapeRead: readRouteShape(selectedArc, params.expectedPeakBaseVenueId),
    tasteRouteMomentVerdict: summarizeVerdict(routeMoment),
    greatStopMomentRight: summarizeMomentRight(greatStop),
  }
}

try {
  const selectedAnchor = sanJoseVenues.find(
    (venue) => venue.id === SELECTED_ANCHOR_BASE_VENUE_ID,
  )
  assert(selectedAnchor, 'Adega must exist in the curated San Jose venue corpus.')

  const input: IntentInput = {
    mode: 'build',
    planningMode: 'user-led',
    persona: 'romantic',
    primaryVibe: 'cozy',
    secondaryVibe: 'lively',
    city: 'San Jose',
    district: 'Little Portugal',
    distanceMode: 'short-drive',
    anchor: {
      venueId: SELECTED_ANCHOR_BASE_VENUE_ID,
      role: REQUIRED_ROLE,
    },
    discoveryPreferences: [
      {
        venueId: SELECTED_ANCHOR_BASE_VENUE_ID,
        role: REQUIRED_ROLE,
      },
    ],
  }

  const result = await runGeneratePlan(input, {
    seedVenues: sanJoseVenues,
    sourceMode: 'curated',
    sourceModeOverrideApplied: true,
    debugMode: false,
  })

  const selectedArc = result.selectedArc
  const routeStops = selectedArc.stops.map(summarizeStop)
  const anchorStop = selectedArc.stops.find(
    (stop) => getArcStopBaseVenueId(stop) === SELECTED_ANCHOR_BASE_VENUE_ID,
  )
  const peakStop = selectedArc.stops.find((stop) => stop.role === 'peak')
  const anchorIsPeak = Boolean(anchorStop && anchorStop.role === 'peak')
  const availableCandidates = uniqueScoredVenues(result.scoredVenues).map(
    toAvailableCandidateEvidence,
  )
  const routeMoment = computeRouteMomentVerdict({
    stops: selectedArc.stops.map(toRouteMomentStopEvidence),
    availableCandidates,
    selectedAnchor: toSelectedAnchorEvidence(),
    tasteModeId: result.lens.tasteMode?.id,
  })
  const routePacing = buildGreatStopRoutePacingDiagnostics(selectedArc)
  const greatStop = buildGreatStopGateResult({
    selectedArc,
    intent: result.intentProfile,
    routePacing,
    placeRightVerdict: buildRoutePlaceRightVerdictForArcCandidate({
      candidate: selectedArc,
      intent: result.intentProfile,
      routePacing,
      locationClass: 'L2 Mid',
    }),
    fieldRealVerdict: computeFieldRealVerdictForArcCandidate(selectedArc),
    locationClass: 'L2 Mid',
    locationClassSource: 'explicit',
  })
  const routeShapeRead = readRouteShape(selectedArc, SELECTED_ANCHOR_BASE_VENUE_ID)
  const classification = classify({
    anchorIsPeak,
    routeShapeRead,
    anchorAsPeakCandidacy: routeMoment.verdict.anchorAsPeakCandidacy,
    momentPreservationStatus: routeMoment.verdict.momentPreservationStatus,
    strongMomentPresent: routeMoment.verdict.strongMomentPresent,
    momentRightPassed: greatStop.criteria.momentRight.passed,
  })
  const flatRouteGuard = observeSyntheticCase({
    caseId: 'flat_route_guard',
    expectedPeakBaseVenueId: 'synthetic-flat-peak',
    stops: [
      syntheticStop('warmup', 'synthetic-flat-start', {
        displayName: 'Flat Start',
        energyLevel: 2,
        momentIdentity: { type: 'linger', strength: 'light' },
        momentPotentialScore: 0.18,
        momentIntensity: { score: 0.24, tier: 'standard', drivers: [] },
        primaryExperienceArchetype: 'dining',
      }),
      syntheticStop('peak', 'synthetic-flat-peak', {
        displayName: 'Flat Peak',
        energyLevel: 2,
        momentIdentity: { type: 'linger', strength: 'light' },
        momentPotentialScore: 0.2,
        momentIntensity: { score: 0.28, tier: 'standard', drivers: [] },
        primaryExperienceArchetype: 'drinks',
      }),
      syntheticStop('cooldown', 'synthetic-flat-end', {
        displayName: 'Flat End',
        energyLevel: 2,
        momentIdentity: { type: 'linger', strength: 'light' },
        momentPotentialScore: 0.18,
        momentIntensity: { score: 0.22, tier: 'standard', drivers: [] },
        primaryExperienceArchetype: 'sweet',
      }),
    ],
  })
  const strongPeakGeneralization = observeSyntheticCase({
    caseId: 'strong_peak_generalization',
    expectedPeakBaseVenueId: 'synthetic-jazz-cellar',
    selectedAnchor: toSelectedAnchorEvidence('synthetic-jazz-cellar', 'highlight'),
    stops: [
      syntheticStop('warmup', 'synthetic-gallery-start', {
        displayName: 'Gallery Start',
        energyLevel: 2,
        momentIdentity: { type: 'arrival', strength: 'light' },
        momentPotentialScore: 0.28,
        momentIntensity: { score: 0.36, tier: 'standard', drivers: [] },
        primaryExperienceArchetype: 'culture',
      }),
      syntheticStop('peak', 'synthetic-jazz-cellar', {
        displayName: 'Synthetic Jazz Cellar',
        energyLevel: 3,
        momentIdentity: { type: 'anchor', strength: 'strong' },
        momentPotentialScore: 0.82,
        momentIntensity: { score: 0.9, tier: 'exceptional', drivers: ['synthetic peak'] },
        primaryExperienceArchetype: 'culture',
        anchorStrength: 0.92,
      }),
      syntheticStop('cooldown', 'synthetic-dessert-end', {
        displayName: 'Dessert End',
        energyLevel: 1,
        momentIdentity: { type: 'close', strength: 'light' },
        momentPotentialScore: 0.3,
        momentIntensity: { score: 0.38, tier: 'standard', drivers: [] },
        primaryExperienceArchetype: 'sweet',
      }),
    ],
  })

  const observation = {
    observer: 'build_anchor_route_moment_verdict_three_route',
    cases: {
      adegaFix: {
        anchorIdentity: {
          selectedAnchorDisplayName: SELECTED_ANCHOR_DISPLAY_NAME,
          selectedAnchorCanonicalBaseVenueId: SELECTED_ANCHOR_BASE_VENUE_ID,
          providerRecordId: selectedAnchor.source.providerRecordId,
          providerRecordIdProvenanceOnly: true,
          requiredRole: REQUIRED_ROLE,
          generatedRouteRole: anchorStop ? userRoleFor(anchorStop.role) : null,
        },
        routeShape: {
          generatedRoute: routeStops,
          selectedAnchorIsPeak: anchorIsPeak,
          peakBaseVenueId: peakStop ? getArcStopBaseVenueId(peakStop) : null,
          routeShapeRead,
        },
        tasteRouteMomentVerdict: summarizeVerdict(routeMoment),
        routeMomentCompatibilityValues: {
          highlightMomentScore: routeMoment.highlightMomentScore,
          momentStrengthScore: routeMoment.score,
          momentVarianceScore: routeMoment.varianceScore,
          momentFlatPenalty: routeMoment.flatPenalty + routeMoment.penalty,
          strongMomentPresent: routeMoment.strongMomentPresent,
          momentQualityNote: routeMoment.qualityNote,
          availableCount: routeMoment.availableCount,
          presentCount: routeMoment.presentCount,
          availableCandidateSource: 'runGeneratePlan.result.scoredVenues',
        },
        arcCompatibilityFields: {
          highlightMomentScore: selectedArc.scoreBreakdown.highlightMomentScore,
          momentStrengthScore: selectedArc.scoreBreakdown.momentStrengthScore,
          momentVarianceScore: selectedArc.scoreBreakdown.momentVarianceScore,
          momentFlatPenalty: selectedArc.scoreBreakdown.momentFlatPenalty,
          strongMomentPresent: selectedArc.scoreBreakdown.strongMomentPresent,
          momentQualityNote: selectedArc.scoreBreakdown.momentQualityNote,
          missedPeakPenalty: selectedArc.scoreBreakdown.missedPeakPenalty,
          missedPeakApplied: selectedArc.scoreBreakdown.missedPeakApplied,
        },
        greatStopMomentRight: summarizeMomentRight(greatStop),
        classification,
      },
      flatRouteGuard: {
        ...flatRouteGuard,
        classification:
          flatRouteGuard.greatStopMomentRight.status === 'FAIL' &&
          flatRouteGuard.tasteRouteMomentVerdict.flatArcRisk.level !== 'none'
            ? 'flat_guard_preserved'
            : 'mixed',
      },
      strongPeakGeneralization: {
        ...strongPeakGeneralization,
        classification:
          strongPeakGeneralization.tasteRouteMomentVerdict.anchorAsPeakCandidacy ===
            'intended_peak' &&
          strongPeakGeneralization.greatStopMomentRight.status === 'PASS'
            ? 'strong_peak_generalized'
            : 'mixed',
      },
    },
    providerNetworkCounts: {
      fetchCallCount,
      retrievalLiveFetchAttempted:
        result.trace.retrievalDiagnostics.liveSource.liveFetchAttempted,
    },
  }

  process.stdout.write(`${JSON.stringify(observation, null, 2)}\n`)

  assert(fetchCallCount === 0, `Expected fetchCallCount 0, got ${fetchCallCount}.`)
  assert(
    result.trace.retrievalDiagnostics.liveSource.liveFetchAttempted === false,
    'Observer harness must not attempt live provider fetch.',
  )
  assert(anchorStop, 'Selected Build anchor must appear in the generated route.')
  assert(
    routeMoment.verdict.source === 'taste',
    'TasteRouteMomentVerdict must be Taste-authored.',
  )
  assert(
    routeMoment.verdict.peakCandidateVenueId != null,
    'Observer harness must expose peakCandidateVenueId.',
  )
  assert(
    routeMoment.verdict.anchorAsPeakCandidacy === 'intended_peak',
    'Adega selected Build highlight must be the intended peak when Taste verdict is strong and preserved.',
  )
  assert(
    greatStop.criteria.momentRight.passed,
    'Adega Moment-Right must pass when Taste verdict is strong, preserved, and flat risk is none.',
  )
  assert(
    !greatStop.criteria.momentRight.reasons.includes('moment_right:dead_flat_arc'),
    'Great Stop Moment-Right must not emit the old dead-flat reason from roleEnergyNote.',
  )
  assert(
    flatRouteGuard.tasteRouteMomentVerdict.flatArcRisk.level !== 'none',
    'Flat guard must be authored as flat risk by Taste.',
  )
  assert(
    flatRouteGuard.greatStopMomentRight.status === 'FAIL',
    'Flat guard must fail Moment-Right through the Taste-derived stamp.',
  )
  assert(
    flatRouteGuard.greatStopMomentRight.reasons.includes('moment_right:taste_flat_arc_risk'),
    'Flat guard must fail from Taste flat arc risk, not roleEnergyNote.',
  )
  assert(
    strongPeakGeneralization.tasteRouteMomentVerdict.anchorAsPeakCandidacy ===
      'intended_peak',
    'Non-Adega strong selected peak must generalize as intended_peak.',
  )
  assert(
    strongPeakGeneralization.greatStopMomentRight.status === 'PASS',
    'Non-Adega strong peak must pass Moment-Right.',
  )
} finally {
  globalThis.fetch = originalFetch
}
