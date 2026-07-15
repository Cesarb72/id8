import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { strict as assert } from 'node:assert'

import {
  buildSteeringSwapProposalDisplay,
  STEERING_SWAP_DISPLAY_LIMIT,
} from '../src/app/steering/steeringProposalDisplay'
import {
  coordinateSteeringPrelockSwapProposals,
  type SteeringSwapCandidateProjection,
} from '../src/integrations/waypoint/coordination/coordinateSteeringPrelockProposals'
import type {
  SteeringPrelockRefusalClass,
  SteeringStopIdentity,
} from '../src/integrations/waypoint/coordination/steeringPrelockProposal'

const projectRoot = process.cwd()
const readSource = (relativePath: string) =>
  readFileSync(join(projectRoot, relativePath), 'utf8')

const displaySource = readSource('src/app/steering/steeringProposalDisplay.ts')
const routeSpineSource = readSource('src/components/journey/RouteSpine.tsx')
const nearbyNodeSource = readSource('src/components/journey/NearbyNodeGroup.tsx')
const sandboxSource = readSource('src/pages/SandboxConciergePage.tsx')
const coordinatorSource = readSource(
  'src/integrations/waypoint/coordination/coordinateSteeringPrelockProposals.ts',
)

let fetchCallCount = 0
const originalFetch = globalThis.fetch
globalThis.fetch = ((input: RequestInfo | URL) => {
  fetchCallCount += 1
  throw new Error(`Unexpected provider/network call in steering UI display observer: ${String(input)}`)
}) as typeof fetch

function assertContains(source: string, marker: string, label: string): void {
  assert.ok(source.includes(marker), `${label} missing marker: ${marker}`)
}

function assertExcludes(source: string, marker: string, label: string): void {
  assert.ok(!source.includes(marker), `${label} should not contain marker: ${marker}`)
}

function fieldIdentity(params: {
  baseVenueId: string
  displayName: string
  providerRecordId?: string
  neighborhood?: string
}): SteeringStopIdentity {
  return {
    source: 'field',
    baseVenueId: params.baseVenueId,
    venueId: params.baseVenueId,
    displayName: params.displayName,
    providerRecordId: params.providerRecordId,
    neighborhood: params.neighborhood,
    identityStatus: 'resolved',
  }
}

const currentStopIdentity = fieldIdentity({
  baseVenueId: 'sj-current-highlight',
  displayName: 'Current Highlight',
  providerRecordId: 'live_google_current_highlight',
  neighborhood: 'Downtown',
})

function projection(params: {
  baseVenueId: string
  displayName: string
  providerRecordId: string
  neighborhood: string
  roleFit: number
  movementDelta: number
}): SteeringSwapCandidateProjection {
  return {
    candidateKey: `candidate:${params.baseVenueId}`,
    currentStopIdentity,
    candidateIdentity: fieldIdentity({
      baseVenueId: params.baseVenueId,
      displayName: params.displayName,
      providerRecordId: params.providerRecordId,
      neighborhood: params.neighborhood,
    }),
    roleFitEvidence: [
      {
        source: 'taste',
        key: 'role_suitability',
        authority: 'owner_evidence',
        value: params.roleFit,
        role: 'highlight',
        verdict: params.roleFit >= 0.72 ? 'strong_fit' : 'acceptable_fit',
        ownerReasons: ['taste:role_score'],
      },
    ],
    feasibility: [
      {
        source: 'bearings',
        key: 'admission',
        authority: 'owner_evidence',
        value: true,
        status: 'feasible',
        ownerReasons: ['bearings:swap_projection_survived'],
      },
    ],
    movementDelta: {
      source: 'bearings',
      key: 'movement_delta',
      authority: 'owner_evidence',
      value: params.movementDelta,
      currentTravelMinutes: 10,
      candidateTravelMinutes: 10 + params.movementDelta,
      deltaMinutes: params.movementDelta,
      direction: params.movementDelta < 0 ? 'shorter' : params.movementDelta > 0 ? 'longer' : 'same',
      originAware: false,
      ownerReasons: ['bearings:drive_minutes_delta'],
    },
    tieBreakKey: params.baseVenueId,
  }
}

const expectedRefusalMessages: Record<
  Extract<
    SteeringPrelockRefusalClass,
    | 'role_fit_too_weak'
    | 'no_admissible_replacement'
    | 'movement_would_get_worse'
    | 'identity_provenance_missing'
  >,
  string
> = {
  role_fit_too_weak: 'No strong enough swap for this stop yet.',
  no_admissible_replacement: 'No replacement clears the route constraints right now.',
  movement_would_get_worse: 'Available swaps would make the route harder to move through.',
  identity_provenance_missing: "I can't verify a route-safe identity for this replacement.",
}

function buildRefusalDisplayFor(
  candidate: SteeringSwapCandidateProjection,
  options?: {
    allowMovementWorsening?: boolean
  },
) {
  const refused = coordinateSteeringPrelockSwapProposals({
    targetRole: 'highlight',
    currentStopIdentity,
    candidates: [candidate],
    allowMovementWorsening: options?.allowMovementWorsening,
  })
  return buildSteeringSwapProposalDisplay({
    currentStopLabel: 'Current Highlight',
    currentRole: 'highlight',
    coordination: refused,
  })
}

try {
  assertContains(
    sandboxSource,
    'buildSteeringSwapProposalDisplay',
    'Sandbox review display projection',
  )
  assertContains(
    sandboxSource,
    'steeringProposalsByRole={steeringProposalsByRole}',
    'Sandbox RouteSpine steering display handoff',
  )
  assertContains(
    sandboxSource,
    'coordinateSteeringPrelockSwapProposals',
    'Sandbox display source of truth',
  )
  assertContains(
    sandboxSource,
    'projectSteeringSwapCandidateForCoordination',
    'Sandbox steering identity projection',
  )
  assertContains(routeSpineSource, 'steeringProposalsByRole', 'RouteSpine steering display prop')
  assertContains(nearbyNodeSource, 'steeringProposalDisplay', 'NearbyNodeGroup display prop')
  assertContains(nearbyNodeSource, '<article', 'Steering proposal display row')
  assertContains(nearbyNodeSource, 'data-route-identity', 'Steering proposal route identity marker')
  assertContains(nearbyNodeSource, 'steering-proposal-refusal', 'Steering refusal display marker')
  const steeringDisplayBlock = nearbyNodeSource.slice(
    nearbyNodeSource.indexOf('steering-proposal-list'),
    nearbyNodeSource.indexOf('{!displayOnly && !visibleKind'),
  )
  assertExcludes(steeringDisplayBlock, 'onClick', 'Steering proposal display block')
  assertExcludes(steeringDisplayBlock, 'onApplySwap', 'Steering proposal display block')
  assertExcludes(displaySource, '.sort(', 'Application display projection')
  assertExcludes(displaySource, 'scoreAnchoredRoleFit', 'Application display projection')
  assertExcludes(coordinatorSource, 'scoreAnchoredRoleFit', 'Waypoint steering coordinator')
  assert.equal(STEERING_SWAP_DISPLAY_LIMIT, 3, 'display limit must remain three')

  const coordination = coordinateSteeringPrelockSwapProposals({
    targetRole: 'highlight',
    currentStopIdentity,
    candidates: [
      projection({
        baseVenueId: 'sj-best-swap',
        displayName: 'Best Swap',
        providerRecordId: 'live_google_best_swap',
        neighborhood: 'SoFA',
        roleFit: 0.9,
        movementDelta: -4,
      }),
      projection({
        baseVenueId: 'sj-second-swap',
        displayName: 'Second Swap',
        providerRecordId: 'live_google_second_swap',
        neighborhood: 'Downtown',
        roleFit: 0.8,
        movementDelta: -2,
      }),
      projection({
        baseVenueId: 'sj-third-swap',
        displayName: 'Third Swap',
        providerRecordId: 'live_google_third_swap',
        neighborhood: 'Japantown',
        roleFit: 0.72,
        movementDelta: 0,
      }),
      projection({
        baseVenueId: 'sj-fourth-swap',
        displayName: 'Fourth Swap',
        providerRecordId: 'live_google_fourth_swap',
        neighborhood: 'Downtown',
        roleFit: 0.7,
        movementDelta: 0,
      }),
    ],
  })
  const display = buildSteeringSwapProposalDisplay({
    currentStopLabel: 'Current Highlight',
    currentRole: 'highlight',
    coordination,
  })

  assert.equal(display.currentStopLabel, 'Current Highlight')
  assert.equal(display.currentRoleLabel, 'Highlight')
  assert.deepEqual(
    display.proposals.map((proposal) => proposal.routeIdentity),
    ['sj-best-swap', 'sj-second-swap', 'sj-third-swap'],
    'Display must preserve Waypoint rank order and cap at three proposals.',
  )
  assert.equal(display.proposals.length, 3)
  assert.equal(display.proposals[0]?.displayName, 'Best Swap')
  assert.equal(display.proposals[0]?.area, 'SoFA')
  assert.notEqual(display.proposals[0]?.routeIdentity, 'live_google_best_swap')
  assert.equal(display.proposals[0]?.roleFitLabel, 'Strong role fit')
  assert.equal(display.proposals[0]?.feasibilityLabel, 'Route constraints clear')
  assert.equal(display.proposals[0]?.movementLabel, '4 min easier movement')
  assert.deepEqual(display.proposals[0]?.ownerEvidence, ['taste', 'bearings', 'field'])
  assert.equal(display.refusal, undefined)

  const refusalDisplays = {
    role_fit_too_weak: buildRefusalDisplayFor({
      ...projection({
        baseVenueId: 'sj-weak-swap',
        displayName: 'Weak Swap',
        providerRecordId: 'live_google_weak_swap',
        neighborhood: 'Downtown',
        roleFit: 0.2,
        movementDelta: -2,
      }),
      roleFitEvidence: [
        {
          source: 'taste',
          key: 'role_suitability',
          authority: 'owner_evidence',
          value: 0.2,
          role: 'highlight',
          verdict: 'weak_fit',
          ownerReasons: ['taste:role_fit_too_weak'],
        },
      ],
    }),
    no_admissible_replacement: buildRefusalDisplayFor({
      ...projection({
        baseVenueId: 'sj-infeasible-swap',
        displayName: 'Infeasible Swap',
        providerRecordId: 'live_google_infeasible_swap',
        neighborhood: 'Downtown',
        roleFit: 0.8,
        movementDelta: -2,
      }),
      feasibility: [
        {
          source: 'bearings',
          key: 'admission',
          authority: 'owner_evidence',
          value: false,
          status: 'infeasible',
          ownerReasons: ['bearings:admission_failed'],
        },
      ],
    }),
    movement_would_get_worse: buildRefusalDisplayFor(
      projection({
        baseVenueId: 'sj-harder-move-swap',
        displayName: 'Harder Move Swap',
        providerRecordId: 'live_google_harder_move_swap',
        neighborhood: 'Downtown',
        roleFit: 0.8,
        movementDelta: 7,
      }),
      { allowMovementWorsening: false },
    ),
    identity_provenance_missing: buildRefusalDisplayFor({
      ...projection({
        baseVenueId: 'sj-missing-identity-swap',
        displayName: 'Missing Identity Swap',
        providerRecordId: 'live_google_missing_identity_swap',
        neighborhood: 'Downtown',
        roleFit: 0.8,
        movementDelta: -2,
      }),
      candidateIdentity: {
        source: 'field',
        venueId: 'sj-missing-identity-swap',
        displayName: 'Missing Identity Swap',
        providerRecordId: 'live_google_missing_identity_swap',
        neighborhood: 'Downtown',
        identityStatus: 'partial',
        missingIdentityReasons: ['field:baseVenueId_missing'],
      },
    }),
  }

  const refusalMatrix = Object.entries(refusalDisplays).map(([refusalClass, refusalDisplay]) => {
    const expectedClass = refusalClass as keyof typeof expectedRefusalMessages
    assert.equal(refusalDisplay.proposals.length, 0, `${refusalClass} must not show fake alternatives.`)
    assert.equal(refusalDisplay.refusal?.refusalClass, expectedClass)
    assert.equal(refusalDisplay.refusal?.message, expectedRefusalMessages[expectedClass])
    assert.ok(refusalDisplay.refusal?.message, `${refusalClass} must render a message.`)
    return {
      refusalReason: expectedClass,
      distinctMessageRenders: true,
      messageText: refusalDisplay.refusal.message,
      coveredByObserver: true,
      pass: true,
    }
  })
  assert.equal(
    new Set(refusalMatrix.map((entry) => entry.messageText)).size,
    Object.keys(expectedRefusalMessages).length,
    'All required refusal messages must be distinct.',
  )

  assert.equal(fetchCallCount, 0, 'observer made provider/network calls')

  console.log(
    JSON.stringify(
      {
        observer: 'steering_ui_proposal_display',
        display: {
          currentStop: display.currentStopLabel,
          currentRole: display.currentRoleLabel,
          visibleAlternativeCount: display.proposals.length,
          maxVisibleAlternatives: STEERING_SWAP_DISPLAY_LIMIT,
          rankOrder: display.proposals.map((proposal) => proposal.routeIdentity),
          firstProposalEvidence: display.proposals[0]?.ownerEvidence,
          providerIdPromotedToRouteIdentity: false,
        },
        refusalMatrix,
        boundary: {
          consumesWaypointCoordinator: true,
          displayOnlyNoApply: true,
          noAppLocalOrdering: true,
          noAppIdentityHydration: true,
          noFakeAlternatives: true,
        },
        providerNetworkCalls: fetchCallCount,
      },
      null,
      2,
    ),
  )
} finally {
  globalThis.fetch = originalFetch
}
