import assert from 'node:assert/strict'
import { sanJoseVenues } from '../src/data/venues.ts'
import {
  buildApplicationConciergeIntent,
  projectConciergeIntentToIntentInput,
} from '../src/app/concierge/conciergeIntentAdapter.ts'
import { buildCanonicalSurpriseC1RouteShapeContract } from '../src/domain/arc/buildCanonicalSurpriseC1RouteShapeContract.ts'
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
import { runGeneratePlan } from '../src/domain/runGeneratePlan.ts'
import type { PersonaMode, RouteShapeContract, VibeAnchor } from '../src/domain/types/intent.ts'

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
  throw new Error(`C1 Surprise transport proof must not call providers: ${String(input)}`)
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

function routeSignature(result: Awaited<ReturnType<typeof runGeneratePlan>>): string {
  return result.selectedArc.stops
    .map((stop) => `${stop.role}:${stop.scoredVenue.venue.id}`)
    .join('|')
}

function assertCarrierDepth(routeShapeContract: RouteShapeContract): void {
  assert(routeShapeContract.interpretationC1Projection, 'C1 projection provenance must be present.')
  assert.equal(
    routeShapeContract.interpretationC1Projection.authority,
    'concierge_intent_experience_contract_constraints',
  )
  assert.equal(routeShapeContract.roleProfile.start.compositionRequirement?.relationship, 'prepares_selected_highlight')
  assert.equal(routeShapeContract.roleProfile.highlight.compositionRequirement?.relationship, 'performs_peak')
  assert.equal(routeShapeContract.roleProfile.windDown.compositionRequirement?.relationship, 'resolves_selected_highlight')
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
    interpretationSource: 'scripts.move2.gate3g.c1_surprise_transport',
  })
  const districtPreview = await buildDistrictOpportunityProfiles({
    locationQuery: 'San Jose',
    includeDebug: true,
  })
  const contractGateWorld = buildContractGateWorldFromCanonical({
    canonicalInterpretationBundle,
    ranked: districtPreview.ranked,
    source: 'scripts.move2.gate3g.c1_surprise_transport',
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
  assertCarrierDepth(routeShapeContract)
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
  const compatibility = await runGeneratePlan(input, commonOptions)
  const activeStamp = active.selectedArc.scoreBreakdown.experienceCompositionStamp
  const compatibilityStamp = compatibility.selectedArc.scoreBreakdown.experienceCompositionStamp
  assert(activeStamp, `${spec.id} active selected route must carry a composition stamp.`)
  assert.equal(activeStamp.requirementSource, 'route_shape_contract')
  assert.equal(activeStamp.routeShapeContractId, routeShapeContract.id)
  assert(
    activeStamp.unavailableEvidence.every((reason) => reason !== 'composition_requirements_missing'),
    `${spec.id} active stamp must not report missing requirements.`,
  )
  assert(activeStamp.startContribution.requirement, `${spec.id} Start requirement must be visible.`)
  assert(activeStamp.highlightContribution.requirement, `${spec.id} Highlight requirement must be visible.`)
  assert(activeStamp.windDownContribution.requirement, `${spec.id} Wind-down requirement must be visible.`)
  assert.equal(activeStamp.startPreparesHighlight.kind, 'start_prepares_highlight')
  assert.equal(activeStamp.windDownResolvesHighlight.kind, 'wind_down_resolves_highlight')
  assert.equal(compatibilityStamp?.requirementSource, 'unavailable')
  assert(
    compatibilityStamp?.unavailableEvidence.includes('composition_requirements_missing'),
    `${spec.id} compatibility caller without carrier must remain unavailable.`,
  )
  const repeated = buildCanonicalSurpriseC1RouteShapeContract({
    conciergeIntent,
    canonicalInterpretationBundle,
    selectedDirection,
    selectedDirectionContext,
  })
  assert.deepEqual(
    {
      id: routeShapeContract.id,
      projection: routeShapeContract.interpretationC1Projection,
      roleProfile: routeShapeContract.roleProfile,
      roleInvariants: routeShapeContract.roleInvariants,
    },
    {
      id: repeated.id,
      projection: repeated.interpretationC1Projection,
      roleProfile: repeated.roleProfile,
      roleInvariants: repeated.roleInvariants,
    },
    `${spec.id} repeated equivalent inputs must produce identical carrier content.`,
  )
  return {
    caseId: spec.id,
    routeShapeContractId: routeShapeContract.id,
    projectionId: routeShapeContract.interpretationC1Projection?.projectionId,
    selectedDirectionId: selectedDirection.id,
    activeRequirementSource: activeStamp.requirementSource,
    compatibilityRequirementSource: compatibilityStamp?.requirementSource,
    activeSelectedArcId: active.selectedArc.id,
    compatibilitySelectedArcId: compatibility.selectedArc.id,
    activeRouteSignature: routeSignature(active),
    compatibilityRouteSignature: routeSignature(compatibility),
    selectedWinnerChanged: active.selectedArc.id !== compatibility.selectedArc.id,
    selectedRouteChanged: routeSignature(active) !== routeSignature(compatibility),
    selectedScoreChanged: active.selectedArc.totalScore !== compatibility.selectedArc.totalScore,
    activeTotalScore: active.selectedArc.totalScore,
    compatibilityTotalScore: compatibility.selectedArc.totalScore,
    providerCalls: fetchCalls,
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
      cases: results,
      providerCalls: fetchCalls,
    },
    null,
    2,
  ),
)
