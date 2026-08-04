import assert from 'node:assert/strict'
import { buildRouteShapeContract } from '../src/domain/arc/directionPlanning.ts'
import { buildCanonicalInterpretationBundle } from '../src/domain/interpretation/buildCanonicalInterpretationBundle.ts'
import { buildApplicationConciergeIntent } from '../src/domain/interpretation/conciergeIntent/buildConciergeIntent.ts'
import {
  buildDirectionPlanningSelection,
  buildResolvedDirectionContext,
} from '../src/domain/interpretation/direction/selectedDirectionProjection.ts'
import type { PersonaMode, RouteShapeContract, VibeAnchor } from '../src/domain/types/intent.ts'

const personas = ['romantic', 'friends', 'family'] as const satisfies readonly PersonaMode[]
const vibes = ['cozy', 'lively', 'cultured'] as const satisfies readonly Extract<
  VibeAnchor,
  'cozy' | 'lively' | 'cultured'
>[]
const expectedRelationships = {
  start: 'prepares_selected_highlight',
  highlight: 'performs_peak',
  windDown: 'resolves_selected_highlight',
} as const

let fetchCalls = 0
globalThis.fetch = ((input: RequestInfo | URL) => {
  fetchCalls += 1
  throw new Error(`C1 interpretation projection proof must not call providers: ${String(input)}`)
}) as typeof fetch

function clusterFor(vibe: (typeof vibes)[number]): 'lively' | 'chill' | 'explore' {
  if (vibe === 'lively') return 'lively'
  if (vibe === 'cultured') return 'explore'
  return 'chill'
}

function buildContract(persona: PersonaMode, vibe: (typeof vibes)[number]): RouteShapeContract {
  const conciergeIntent = buildApplicationConciergeIntent({
    mode: 'surprise',
    persona,
    primaryVibe: vibe,
    city: 'San Jose',
    objectiveOccasion: 'connect',
  })
  const canonicalInterpretationBundle = buildCanonicalInterpretationBundle({
    conciergeIntent,
    interpretationSource: 'scripts.move2.gate3g.c1_interpretation_projection',
  })
  const selectedDirection = buildDirectionPlanningSelection({
    id: `gate3g_${persona}_${vibe}_direction`,
    label: `Gate 3G ${persona} ${vibe}`,
    pocketId: `gate3g_${persona}_${vibe}_pocket`,
    pocketLabel: `Gate 3G ${persona} ${vibe} pocket`,
    archetype: `${persona}_${vibe}`,
    cluster: clusterFor(vibe),
  })
  const selectedDirectionContext = buildResolvedDirectionContext(selectedDirection)
  assert(selectedDirectionContext, 'Selected direction context must resolve.')
  return buildRouteShapeContract({
    selectedDirection,
    selectedDirectionContext,
    conciergeIntent,
    contractConstraints: canonicalInterpretationBundle.contractConstraints,
  })
}

function assertStructurallyDeep(contract: RouteShapeContract): void {
  const projection = contract.interpretationC1Projection
  assert(projection, 'RouteShapeContract must carry Interpretation C1 projection provenance.')
  assert.equal(projection.source, 'interpretation.c1_route_shape_projection.v0_1')
  assert.equal(projection.authority, 'concierge_intent_experience_contract_constraints')
  for (const role of ['start', 'highlight', 'windDown'] as const) {
    const requirement = contract.roleProfile[role].compositionRequirement
    assert(requirement, `${role} must carry a typed composition requirement.`)
    assert.equal(requirement.source, 'interpretation.route_shape_contract')
    assert.equal(requirement.role, role)
    assert.equal(requirement.relationship, expectedRelationships[role])
    assert(
      requirement.dimensions.length >= 5,
      `${role} requirement should retain multi-dimensional structure.`,
    )
    assert(
      requirement.reasonCodes.includes(`persona:${projection.persona}`),
      `${role} requirement must cite persona-specific owner truth.`,
    )
    assert(
      requirement.reasonCodes.includes(`vibe:${projection.normalizedVibe}`),
      `${role} requirement must cite vibe-specific owner truth.`,
    )
    assert.equal(
      projection.roleRequirementIds[role],
      `${projection.projectionId}_${role}`,
      `${role} requirement id must be deterministic.`,
    )
  }
  assert(contract.roleInvariants.start.requiredTraits.length > 0)
  assert(contract.roleInvariants.start.preferredTraits.length > 0)
  assert(contract.roleInvariants.highlight.requiredTraits.length > 0)
  assert(contract.roleInvariants.highlight.preferredTraits.length > 0)
  assert(contract.roleInvariants.windDown.requiredTraits.length > 0)
  assert(contract.roleInvariants.windDown.preferredTraits.length > 0)
}

const fingerprints = new Set<string>()
const projectionIds = new Set<string>()
const rows: Array<{
  persona: PersonaMode
  vibe: string
  projectionId: string
  roleDepth: number
}> = []

for (const persona of personas) {
  for (const vibe of vibes) {
    const first = buildContract(persona, vibe)
    const second = buildContract(persona, vibe)
    assert.deepEqual(
      {
        c1: first.interpretationC1Projection,
        roleProfile: first.roleProfile,
        roleInvariants: first.roleInvariants,
      },
      {
        c1: second.interpretationC1Projection,
        roleProfile: second.roleProfile,
        roleInvariants: second.roleInvariants,
      },
      `${persona}/${vibe} C1 projection must be deterministic.`,
    )
    assertStructurallyDeep(first)
    const projection = first.interpretationC1Projection
    assert(projection)
    projectionIds.add(projection.projectionId)
    fingerprints.add(JSON.stringify({
      persona: projection.persona,
      vibe: projection.normalizedVibe,
      roleProfile: first.roleProfile,
      roleInvariants: first.roleInvariants,
    }))
    rows.push({
      persona,
      vibe,
      projectionId: projection.projectionId,
      roleDepth: Object.values(first.roleProfile).filter((profile) => profile.compositionRequirement)
        .length,
    })
  }
}

assert.equal(rows.length, 9, 'All nine persona/vibe combinations must be covered.')
assert.equal(projectionIds.size, 9, 'Projection identity must be unique per persona/vibe direction input.')
assert.equal(fingerprints.size, 9, 'Projection content must not collapse into a universal default.')
for (const persona of personas) {
  assert.equal(
    rows.filter((row) => row.persona === persona && row.roleDepth === 3).length,
    3,
    `${persona} must retain Start/Highlight/Wind-down structural depth for all vibes.`,
  )
}
assert.equal(fetchCalls, 0, 'No provider calls are allowed.')

console.log(
  JSON.stringify(
    {
      result: 'PASS',
      projectionRows: rows,
      uniqueProjectionIds: projectionIds.size,
      uniqueFingerprints: fingerprints.size,
      providerCalls: fetchCalls,
    },
    null,
    2,
  ),
)
