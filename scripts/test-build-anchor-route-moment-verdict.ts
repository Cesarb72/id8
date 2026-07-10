import { runGeneratePlan } from '../src/domain/runGeneratePlan.ts'
import { sanJoseVenues } from '../src/data/venues.ts'
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

function toSelectedAnchorEvidence(): TasteRouteMomentSelectedAnchorEvidence {
  return {
    selectedAnchorBaseVenueId: SELECTED_ANCHOR_BASE_VENUE_ID,
    requiredRole: REQUIRED_ROLE,
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

function readRouteShape(selectedArc: ArcCandidate): 'build_peak_taper' | 'flat' | 'inconclusive' {
  const start = selectedArc.stops.find((stop) => stop.role === 'warmup')
  const peak = selectedArc.stops.find((stop) => stop.role === 'peak')
  const windDown = selectedArc.stops.find((stop) => stop.role === 'cooldown')
  if (!start || !peak || !windDown) {
    return 'inconclusive'
  }
  if (
    getArcStopBaseVenueId(peak) === SELECTED_ANCHOR_BASE_VENUE_ID &&
    peak.scoredVenue.venue.energyLevel >= start.scoredVenue.venue.energyLevel &&
    windDown.scoredVenue.venue.energyLevel <= peak.scoredVenue.venue.energyLevel
  ) {
    return 'build_peak_taper'
  }
  if (
    selectedArc.scoreBreakdown.roleEnergyNote?.toLowerCase().includes('flat') ||
    selectedArc.scoreBreakdown.strongMomentPresent === false
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
}): 'ownership_and_behavior_realized' | 'ownership_moved_behavior_flat' | 'observer_incomplete' | 'mixed' {
  const tasteMarksIntendedPeak = params.anchorAsPeakCandidacy === 'intended_peak'
  const verdictStrongEnough =
    params.strongMomentPresent &&
    (params.momentPreservationStatus === 'preserved' ||
      params.momentPreservationStatus === 'partial')
  if (tasteMarksIntendedPeak && params.anchorIsPeak && verdictStrongEnough) {
    return params.routeShapeRead === 'build_peak_taper'
      ? 'ownership_and_behavior_realized'
      : 'mixed'
  }
  if (tasteMarksIntendedPeak || params.anchorIsPeak || params.routeShapeRead === 'build_peak_taper') {
    return 'mixed'
  }
  return 'ownership_moved_behavior_flat'
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
  const greatStop = buildGreatStopGateResult({
    selectedArc,
    intent: result.intentProfile,
    routePacing: buildGreatStopRoutePacingDiagnostics(selectedArc),
    locationClass: 'L2 Mid',
    locationClassSource: 'explicit',
  })
  const routeShapeRead = readRouteShape(selectedArc)
  const classification = classify({
    anchorIsPeak,
    routeShapeRead,
    anchorAsPeakCandidacy: routeMoment.verdict.anchorAsPeakCandidacy,
    momentPreservationStatus: routeMoment.verdict.momentPreservationStatus,
    strongMomentPresent: routeMoment.verdict.strongMomentPresent,
  })

  const observation = {
    observer: 'build_anchor_route_moment_verdict',
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
    tasteRouteMomentVerdict: routeMoment.verdict,
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
    greatStopMomentRight: {
      status: greatStop.criteria.momentRight.passed ? 'PASS' : 'FAIL',
      reasons: greatStop.criteria.momentRight.reasons,
      diagnostics: greatStop.diagnostics.strongMoment,
    },
    classification,
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
    classification !== 'observer_incomplete',
    'Observer harness must produce a complete classification.',
  )
} finally {
  globalThis.fetch = originalFetch
}
