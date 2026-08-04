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
  type TasteExperienceCompositionCandidateAssessment,
  type TasteExperienceCompositionCandidateEvidence,
  type TasteExperienceCompositionRelationshipAssessment,
  type TasteExperienceCompositionStamp,
} from '../src/domain/interpretation/taste/computeExperienceCompositionStamp.ts'
import type { TasteRouteMomentVerdict } from '../src/domain/interpretation/taste/routeMomentVerdict.ts'
import { runGeneratePlan } from '../src/domain/runGeneratePlan.ts'
import type { ArcStop } from '../src/domain/types/arc.ts'
import type { PersonaMode, RouteShapeContract, RouteShapeRole, VibeAnchor } from '../src/domain/types/intent.ts'

const cases = [
  { id: 'romantic-cultured', persona: 'romantic', vibe: 'cultured' },
  { id: 'family-cozy', persona: 'family', vibe: 'cozy' },
] as const satisfies readonly {
  id: string
  persona: Extract<PersonaMode, 'romantic' | 'family'>
  vibe: Extract<VibeAnchor, 'cultured' | 'cozy'>
}[]

let fetchCalls = 0
globalThis.fetch = ((input: RequestInfo | URL) => {
  fetchCalls += 1
  throw new Error(`C1 Taste assessment proof must not call providers: ${String(input)}`)
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

function routeSignature(stops: readonly ArcStop[]): string {
  return stops.map((stop) => `${stop.role}:${getArcStopCandidateId(stop)}`).join('|')
}

function routeStop(stops: readonly ArcStop[], role: ArcStop['role']): ArcStop {
  const stop = stops.find((entry) => entry.role === role)
  assert(stop, `Selected route must include ${role}.`)
  return stop
}

function assessmentSummary(
  assessment: TasteExperienceCompositionCandidateAssessment,
): {
  candidateId: string | null
  status: TasteExperienceCompositionStamp['status']
  score: number
  relationship?: string
  minimumStatus?: string
  dimensions: string[]
  reasons: string[]
  matchedTraits: string[]
  missingRequiredTraits: string[]
} {
  return {
    candidateId: assessment.candidateId,
    status: assessment.status,
    score: assessment.score,
    relationship: assessment.requirement?.relationship,
    minimumStatus: assessment.requirement?.minimumStatus,
    dimensions: assessment.dimensions.map(
      (dimension) => `${dimension.dimension}:${dimension.status}:${dimension.score}`,
    ),
    reasons: [...assessment.reasons],
    matchedTraits: [...assessment.matchedTraits],
    missingRequiredTraits: [...assessment.missingRequiredTraits],
  }
}

function relationshipSummary(
  relationship: TasteExperienceCompositionRelationshipAssessment,
): {
  sourceCandidateId: string | null
  targetCandidateId: string | null
  status: TasteExperienceCompositionStamp['status']
  score: number
  dimensions: string[]
  reasons: string[]
} {
  return {
    sourceCandidateId: relationship.sourceCandidateId,
    targetCandidateId: relationship.targetCandidateId,
    status: relationship.status,
    score: relationship.score,
    dimensions: relationship.dimensions.map(
      (dimension) => `${dimension.dimension}:${dimension.status}:${dimension.score}`,
    ),
    reasons: [...relationship.reasons],
  }
}

function requirementSummary(routeShapeContract: RouteShapeContract): Record<RouteShapeRole, unknown> {
  return {
    start: routeShapeContract.roleProfile.start.compositionRequirement,
    highlight: routeShapeContract.roleProfile.highlight.compositionRequirement,
    windDown: routeShapeContract.roleProfile.windDown.compositionRequirement,
  }
}

function assertSelectedRouteParity(
  stamp: TasteExperienceCompositionStamp,
  selectedStops: readonly ArcStop[],
  caseId: string,
): void {
  const start = routeStop(selectedStops, 'warmup')
  const highlight = routeStop(selectedStops, 'peak')
  const windDown = routeStop(selectedStops, 'cooldown')
  assert.equal(
    stamp.startContribution.candidateId,
    getArcStopCandidateId(start),
    `${caseId} Start assessment must refer to the selected warmup stop.`,
  )
  assert.equal(
    stamp.highlightContribution.candidateId,
    getArcStopCandidateId(highlight),
    `${caseId} Highlight assessment must refer to the selected peak stop.`,
  )
  assert.equal(
    stamp.windDownContribution.candidateId,
    getArcStopCandidateId(windDown),
    `${caseId} Wind-down assessment must refer to the selected cooldown stop.`,
  )
  assert.equal(
    stamp.startPreparesHighlight.sourceCandidateId,
    getArcStopCandidateId(start),
    `${caseId} Start-prepares relationship source must be the selected warmup stop.`,
  )
  assert.equal(
    stamp.startPreparesHighlight.targetCandidateId,
    getArcStopCandidateId(highlight),
    `${caseId} Start-prepares relationship target must be the selected peak stop.`,
  )
  assert.equal(
    stamp.windDownResolvesHighlight.sourceCandidateId,
    getArcStopCandidateId(windDown),
    `${caseId} Wind-down-resolves relationship source must be the selected cooldown stop.`,
  )
  assert.equal(
    stamp.windDownResolvesHighlight.targetCandidateId,
    getArcStopCandidateId(highlight),
    `${caseId} Wind-down-resolves relationship target must be the selected peak stop.`,
  )
  assert.equal(
    stamp.peakEvidenceReference.candidateId,
    getArcStopCandidateId(highlight),
    `${caseId} peak evidence reference must be the selected peak stop.`,
  )
}

function comparableStamp(stamp: TasteExperienceCompositionStamp): unknown {
  return {
    status: stamp.status,
    score: stamp.score,
    requirementSource: stamp.requirementSource,
    routeShapeContractId: stamp.routeShapeContractId,
    start: assessmentSummary(stamp.startContribution),
    highlight: assessmentSummary(stamp.highlightContribution),
    windDown: assessmentSummary(stamp.windDownContribution),
    startPreparesHighlight: relationshipSummary(stamp.startPreparesHighlight),
    windDownResolvesHighlight: relationshipSummary(stamp.windDownResolvesHighlight),
    peakEvidenceReference: stamp.peakEvidenceReference,
    wildcard: stamp.wildcard,
    reasons: stamp.reasons,
    unavailableEvidence: stamp.unavailableEvidence,
  }
}

function badMomentVerdict(highlight: TasteExperienceCompositionCandidateEvidence): TasteRouteMomentVerdict {
  return {
    source: 'taste',
    provenance: [{ source: 'taste', key: 'move2_gate3g_slice3_negative_peak_reference' }],
    peakCandidateVenueId: highlight.candidateId,
    anchorAsPeakCandidacy: 'supporting_anchor',
    peakSuitability: {
      score: 0.12,
      tier: 'standard',
    },
    momentStrengthVerdict: {
      strength: 'light',
      score: 0.12,
      reason: 'Synthetic active-C1 negative proof supplies a non-peak highlight.',
    },
    momentPreservationStatus: 'missed',
    strongMomentPresent: false,
    flatArcRisk: {
      level: 'high',
      score: 0.9,
      varianceScore: 0.1,
      penalty: 0,
      reasons: ['synthetic_negative_flat_arc'],
    },
    missedPeakReason: {
      applied: true,
      code: 'selected_peak_too_weak',
      reason: 'Synthetic highlight lacks peak evidence.',
    },
    availableMomentEvidence: {
      availableHighMomentCount: 0,
      availableStrongMomentCount: 0,
      highMomentVenueIds: [],
      strongMomentVenueIds: [],
    },
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
    momentQualityNote: 'Synthetic active-C1 negative proof.',
  }
}

function weakEvidence(role: RouteShapeRole): TasteExperienceCompositionCandidateEvidence {
  return {
    role,
    candidateId: `slice3_negative:${role}`,
    venueName: `Slice 3 negative ${role}`,
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

function runIntentionalNegativeProof(routeShapeContract: RouteShapeContract): {
  routeIdentity: string
  status: TasteExperienceCompositionStamp['status']
  score: number
  reasonCodes: string[]
  unavailableEvidence: string[]
  start: ReturnType<typeof assessmentSummary>
  highlight: ReturnType<typeof assessmentSummary>
  windDown: ReturnType<typeof assessmentSummary>
  startPreparesHighlight: ReturnType<typeof relationshipSummary>
  windDownResolvesHighlight: ReturnType<typeof relationshipSummary>
} {
  const stops = [weakEvidence('start'), weakEvidence('highlight'), weakEvidence('windDown')]
  const stamp = computeTasteExperienceCompositionStamp({
    routeShapeContract,
    stops,
    routeMomentVerdict: badMomentVerdict(stops[1]!),
  })
  assert.equal(stamp.requirementSource, 'route_shape_contract')
  assert.equal(stamp.routeShapeContractId, routeShapeContract.id)
  assert.equal(stamp.status, 'fail', `Intentional active-C1 negative proof must fail; received ${stamp.status}.`)
  assert(
    stamp.reasons.includes('composition_contribution_mismatch') ||
      stamp.reasons.includes('composition_unclear_highlight_peak') ||
      stamp.reasons.includes('composition_relational_mismatch') ||
      stamp.reasons.includes('composition_excessive_energy_mismatch'),
    'Intentional active-C1 negative proof must retain a specific Taste-authored reason.',
  )
  assert(
    !stamp.unavailableEvidence.includes('composition_requirements_missing'),
    'Intentional active-C1 negative proof must not fail by missing requirements.',
  )
  return {
    routeIdentity: stops.map((stop) => `${stop.role}:${stop.candidateId}`).join('|'),
    status: stamp.status,
    score: stamp.score,
    reasonCodes: [...stamp.reasons],
    unavailableEvidence: [...stamp.unavailableEvidence],
    start: assessmentSummary(stamp.startContribution),
    highlight: assessmentSummary(stamp.highlightContribution),
    windDown: assessmentSummary(stamp.windDownContribution),
    startPreparesHighlight: relationshipSummary(stamp.startPreparesHighlight),
    windDownResolvesHighlight: relationshipSummary(stamp.windDownResolvesHighlight),
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
    interpretationSource: 'scripts.move2.gate3g.c1_taste_assessment',
  })
  const districtPreview = await buildDistrictOpportunityProfiles({
    locationQuery: 'San Jose',
    includeDebug: true,
  })
  const contractGateWorld = buildContractGateWorldFromCanonical({
    canonicalInterpretationBundle,
    ranked: districtPreview.ranked,
    source: 'scripts.move2.gate3g.c1_taste_assessment',
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
  const activeStamp = active.selectedArc.scoreBreakdown.experienceCompositionStamp
  const repeatedStamp = repeated.selectedArc.scoreBreakdown.experienceCompositionStamp
  const compatibilityStamp = compatibility.selectedArc.scoreBreakdown.experienceCompositionStamp
  assert(activeStamp, `${spec.id} active selected route must carry a composition stamp.`)
  assert(repeatedStamp, `${spec.id} repeated selected route must carry a composition stamp.`)
  assert(compatibilityStamp, `${spec.id} compatibility selected route must carry a composition stamp.`)
  assert.equal(activeStamp.requirementSource, 'route_shape_contract')
  assert.equal(activeStamp.routeShapeContractId, routeShapeContract.id)
  assert(
    !activeStamp.unavailableEvidence.includes('composition_requirements_missing'),
    `${spec.id} active stamp must not report missing C1 requirements.`,
  )
  assertSelectedRouteParity(activeStamp, active.selectedArc.stops, spec.id)
  assert.deepEqual(
    {
      routeSignature: routeSignature(active.selectedArc.stops),
      stamp: comparableStamp(activeStamp),
    },
    {
      routeSignature: routeSignature(repeated.selectedArc.stops),
      stamp: comparableStamp(repeatedStamp),
    },
    `${spec.id} repeated equivalent active execution must produce identical selected route and Taste assessment.`,
  )
  assert.equal(compatibilityStamp.requirementSource, 'unavailable')
  assert(
    compatibilityStamp.unavailableEvidence.includes('composition_requirements_missing'),
    `${spec.id} compatibility caller without carrier must retain composition_requirements_missing.`,
  )

  return {
    caseId: spec.id,
    projectionId: routeShapeContract.interpretationC1Projection?.projectionId,
    routeShapeContractId: routeShapeContract.id,
    selectedDirectionId: selectedDirection.id,
    selectedRouteIdentity: {
      selectedArcId: active.selectedArc.id,
      routeSignature: routeSignature(active.selectedArc.stops),
      totalScore: active.selectedArc.totalScore,
    },
    selectedStops: {
      start: {
        candidateId: getArcStopCandidateId(routeStop(active.selectedArc.stops, 'warmup')),
        venueName: routeStop(active.selectedArc.stops, 'warmup').scoredVenue.venue.name,
      },
      highlight: {
        candidateId: getArcStopCandidateId(routeStop(active.selectedArc.stops, 'peak')),
        venueName: routeStop(active.selectedArc.stops, 'peak').scoredVenue.venue.name,
      },
      windDown: {
        candidateId: getArcStopCandidateId(routeStop(active.selectedArc.stops, 'cooldown')),
        venueName: routeStop(active.selectedArc.stops, 'cooldown').scoredVenue.venue.name,
      },
    },
    requirements: requirementSummary(routeShapeContract),
    stamp: {
      source: activeStamp.source,
      requirementSource: activeStamp.requirementSource,
      routeShapeContractId: activeStamp.routeShapeContractId,
      status: activeStamp.status,
      score: activeStamp.score,
      reasonCodes: [...activeStamp.reasons],
      unavailableEvidence: [...activeStamp.unavailableEvidence],
      startContribution: assessmentSummary(activeStamp.startContribution),
      highlightContribution: assessmentSummary(activeStamp.highlightContribution),
      windDownContribution: assessmentSummary(activeStamp.windDownContribution),
      startPreparesHighlight: relationshipSummary(activeStamp.startPreparesHighlight),
      peakEvidenceReference: activeStamp.peakEvidenceReference,
      windDownResolvesHighlight: relationshipSummary(activeStamp.windDownResolvesHighlight),
    },
    compatibility: {
      selectedArcId: compatibility.selectedArc.id,
      routeSignature: routeSignature(compatibility.selectedArc.stops),
      requirementSource: compatibilityStamp.requirementSource,
      status: compatibilityStamp.status,
      reasonCodes: [...compatibilityStamp.reasons],
      unavailableEvidence: [...compatibilityStamp.unavailableEvidence],
    },
    deterministicRepeat: {
      routeSignature: routeSignature(repeated.selectedArc.stops),
      stampMatches: true,
    },
    negative: runIntentionalNegativeProof(routeShapeContract),
    winnerImpactFromCarrier: {
      selectedWinnerChanged: active.selectedArc.id !== compatibility.selectedArc.id,
      selectedRouteChanged: routeSignature(active.selectedArc.stops) !== routeSignature(compatibility.selectedArc.stops),
      selectedScoreChanged: active.selectedArc.totalScore !== compatibility.selectedArc.totalScore,
      activeTotalScore: active.selectedArc.totalScore,
      compatibilityTotalScore: compatibility.selectedArc.totalScore,
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
      proof: 'move-2-gate-3g-c1-taste-assessment',
      tasteOwner: 'src/domain/interpretation/taste/computeExperienceCompositionStamp.ts',
      statusSemantics: {
        pass: 'Taste status for scores at or above the tolerance pass floor.',
        soft: 'Taste status for scores below pass and at or above the tolerance soft floor, or a pass base status softened by one controlled wildcard.',
        fail: 'Taste status for scores below the tolerance soft floor, multiple wildcards, or the weakest subassessment being fail.',
        unavailable: 'Taste status when requirements, candidate evidence, or route-moment verdict evidence required for assessment is missing.',
      },
      waypointEnforcementBaseline:
        'Current Waypoint preserves the stamp as evidence but does not reject candidates on C1 assessment status in Slice 3.',
      cases: results,
      providerCalls: fetchCalls,
    },
    null,
    2,
  ),
)
