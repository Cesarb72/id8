import { buildApplicationConciergeIntent } from '../src/domain/interpretation/conciergeIntent/buildConciergeIntent'
import { getArcStopBaseVenueId } from '../src/domain/candidates/candidateIdentity'
import { runGeneratePlan } from '../src/domain/runGeneratePlan'
import { sanJoseVenues } from '../src/data/venues'
import { GreatStopGateSelectionError } from '../src/domain/types/greatStopGate'
import {
  applyBuildSoftFeasibleRecoveryRouteShape,
  buildBuildSoftFeasibleRecoveryRouteShapeAttempts,
} from '../src/domain/waypoint/buildContractDrivenBuildWaypointPlan'
import fs from 'node:fs'
import type { IntentInput, RouteShapeContract } from '../src/domain/types/intent'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

let fetchCallCount = 0
globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
  fetchCallCount += 1
  throw new Error(`Unexpected fetch in Build soft-feasible recovery carrier test: ${String(args[0])}`)
}) as typeof fetch

const baseRouteShapeContract: RouteShapeContract = {
  id: 'route-shape-test',
  arcShape: 'steady_open_curated_center_soft_landing',
  roleProfile: {
    start: {
      intent: 'set-tone',
      energyLevel: 'low',
      pacing: 'balanced',
      variability: 'fixed',
      compositionRequirement: {
        source: 'interpretation.route_shape_contract',
        role: 'start',
        relationship: 'opens_experience',
        dimensions: ['role_fit', 'intent_fit', 'pacing_condition'],
        minimumStatus: 'soft',
        tolerance: 'balanced',
        reasonCodes: ['test:build_soft_feasible_recovery_execution'],
      },
    },
    highlight: {
      intent: 'centerpiece',
      energyLevel: 'medium',
      pacing: 'linger',
      variability: 'fixed',
      compositionRequirement: {
        source: 'interpretation.route_shape_contract',
        role: 'highlight',
        relationship: 'performs_peak',
        dimensions: ['role_fit', 'intent_fit', 'peak_strength'],
        minimumStatus: 'soft',
        tolerance: 'balanced',
        reasonCodes: ['test:build_soft_feasible_recovery_execution'],
      },
    },
    windDown: {
      intent: 'landing',
      energyLevel: 'low',
      pacing: 'linger',
      variability: 'fixed',
      compositionRequirement: {
        source: 'interpretation.route_shape_contract',
        role: 'windDown',
        relationship: 'resolves_selected_highlight',
        dimensions: ['role_fit', 'intent_fit', 'resolution_landing'],
        minimumStatus: 'soft',
        tolerance: 'balanced',
        reasonCodes: ['test:build_soft_feasible_recovery_execution'],
      },
    },
  },
  roleInvariants: {
    start: {
      requiredTraits: [],
      preferredTraits: [],
      forbiddenTraits: [],
      allowSwapToWeaker: false,
      allowEscalation: false,
    },
    highlight: {
      requiredTraits: ['centerpiece'],
      preferredTraits: [],
      forbiddenTraits: [],
      allowSwapToWeaker: false,
      allowEscalation: false,
    },
    windDown: {
      requiredTraits: [],
      preferredTraits: ['settling'],
      forbiddenTraits: [],
      allowSwapToWeaker: false,
      allowEscalation: false,
    },
  },
  movementProfile: {
    radius: 'balanced',
    maxTransitionMinutes: 24,
    neighborhoodContinuity: 'preferred',
    placeRightTolerance: {
      source: 'interpretation_contract_constraints',
      travelTolerance: 'balanced',
      maxComfortableTotalMovementMinutes: 24,
      maxSingleTransitionMinutes: 14,
      maxClusterEscapes: 1,
      driveLikeMovement: 'limited',
      reasonCodes: ['place_right_movement_profile:interpretation_authored'],
    },
  },
  mutationProfile: {
    swapFlexibility: 'low',
    allowedRoles: ['start', 'highlight', 'windDown'],
    preservePriority: ['role', 'feasibility', 'movement'],
  },
  expansionProfile: {
    supportsNearbyExtensions: false,
    preferredExpansionRole: 'windDown',
    lateNightTolerance: 'low',
  },
}

const noRecoveryIntent = buildApplicationConciergeIntent({
  mode: 'build',
  persona: 'romantic',
  primaryVibe: 'cozy',
  city: 'San Jose',
  anchor: { venueId: 'adega', role: 'highlight' },
})
assert(
  noRecoveryIntent.constraintPosture.buildSoftFeasibleRecoveryChoice == null,
  'Default Build intent must not carry a soft-feasible recovery choice.',
)
assert(
  applyBuildSoftFeasibleRecoveryRouteShape(baseRouteShapeContract, noRecoveryIntent) ===
    baseRouteShapeContract,
  'Waypoint should preserve the original route-shape contract when no recovery choice exists.',
)

const biggerNightIntent = buildApplicationConciergeIntent({
  mode: 'build',
  persona: 'romantic',
  primaryVibe: 'cozy',
  city: 'San Jose',
  anchor: { venueId: 'adega', role: 'highlight' },
  buildSoftFeasibleRecovery: {
    action: 'take_bigger_night',
    originatingMovementProfile: baseRouteShapeContract.movementProfile,
  },
})
const biggerNightContract = applyBuildSoftFeasibleRecoveryRouteShape(
  baseRouteShapeContract,
  biggerNightIntent,
)
const biggerNightAttempts = buildBuildSoftFeasibleRecoveryRouteShapeAttempts(
  baseRouteShapeContract,
  biggerNightIntent,
)
const tightOriginRouteShapeContract: RouteShapeContract = {
  ...baseRouteShapeContract,
  movementProfile: {
    ...baseRouteShapeContract.movementProfile,
    radius: 'tight',
    maxTransitionMinutes: 14,
    neighborhoodContinuity: 'strict',
  },
}
const biggerNightFromTightOriginIntent = buildApplicationConciergeIntent({
  mode: 'build',
  persona: 'romantic',
  primaryVibe: 'cozy',
  city: 'San Jose',
  anchor: { venueId: 'adega', role: 'highlight' },
  buildSoftFeasibleRecovery: {
    action: 'take_bigger_night',
    originatingMovementProfile: tightOriginRouteShapeContract.movementProfile,
  },
})
const biggerNightFromTightOriginAttempts = buildBuildSoftFeasibleRecoveryRouteShapeAttempts(
  {
    ...baseRouteShapeContract,
    movementProfile: {
      ...baseRouteShapeContract.movementProfile,
      radius: 'tight',
      maxTransitionMinutes: 14,
      neighborhoodContinuity: 'strict',
    },
  },
  biggerNightFromTightOriginIntent,
)
assert(
  biggerNightIntent.constraintPosture.buildSoftFeasibleRecoveryChoice?.source ===
    'application_great_stop_recovery_surface',
  'Recovery choice source must record the Application surface as the user-choice carrier.',
)
assert(
  biggerNightContract.movementProfile.radius === 'open' &&
    biggerNightContract.movementProfile.neighborhoodContinuity === 'flexible',
  'Take-the-bigger-night recovery must project the Interpretation-authored open route shape.',
)
assert(
  biggerNightContract.movementProfile.placeRightTolerance?.travelTolerance === 'expanded',
  'Take-the-bigger-night recovery must expand only through existing place-right movement fields.',
)
assert(
  biggerNightContract.movementProfile.placeRightTolerance.reasonCodes.includes(
    'build_soft_feasible_recovery:take_bigger_night',
  ),
  'Route-shape override must preserve recovery provenance reason codes.',
)
assert(
  biggerNightAttempts.map((attempt) => attempt.movementProfile.radius).join('|') === 'open',
  'Waypoint must consume the Interpretation-authored bigger-night attempt for the current origin only.',
)
assert(
  biggerNightFromTightOriginAttempts.map((attempt) => attempt.movementProfile.radius).join('|') ===
    'balanced|balanced|open' &&
    biggerNightFromTightOriginAttempts.map((attempt) => attempt.movementProfile.maxTransitionMinutes).join('|') ===
      '18|24|32' &&
    biggerNightFromTightOriginAttempts.map((attempt) => attempt.movementProfile.neighborhoodContinuity).join('|') ===
      'preferred|preferred|flexible',
  'Interpretation must author bigger-night attempts least broad to broader in deterministic order.',
)

const tighterRouteIntent = buildApplicationConciergeIntent({
  mode: 'build',
  persona: 'romantic',
  primaryVibe: 'cozy',
  city: 'San Jose',
  anchor: { venueId: 'adega', role: 'highlight' },
  buildSoftFeasibleRecovery: {
    action: 'try_tighter_route',
    originatingMovementProfile: baseRouteShapeContract.movementProfile,
  },
})
const tighterRouteContract = applyBuildSoftFeasibleRecoveryRouteShape(
  baseRouteShapeContract,
  tighterRouteIntent,
)
const tighterRouteAttempts = buildBuildSoftFeasibleRecoveryRouteShapeAttempts(
  baseRouteShapeContract,
  tighterRouteIntent,
)
assert(
  tighterRouteContract.movementProfile.radius === 'tight' &&
    tighterRouteContract.movementProfile.neighborhoodContinuity === 'strict',
  'Try-tighter-route recovery must project the Interpretation-authored tight route shape.',
)
assert(
  tighterRouteContract.movementProfile.placeRightTolerance?.driveLikeMovement === 'discouraged',
  'Try-tighter-route recovery must keep movement constraints in existing Bearings-readable fields.',
)
assert(
  tighterRouteAttempts.map((attempt) => attempt.movementProfile.maxTransitionMinutes).join('|') ===
    '14|18',
  'Try-tighter-route attempts must search most compact to less compact and exclude the origin.',
)

const noTighterAttempts = buildBuildSoftFeasibleRecoveryRouteShapeAttempts(
  tightOriginRouteShapeContract,
  buildApplicationConciergeIntent({
    mode: 'build',
    persona: 'romantic',
    primaryVibe: 'cozy',
    city: 'San Jose',
    anchor: { venueId: 'adega', role: 'highlight' },
    buildSoftFeasibleRecovery: {
      action: 'try_tighter_route',
      originatingMovementProfile: tightOriginRouteShapeContract.movementProfile,
    },
  }),
)
assert(
  tighterRouteIntent.constraintPosture.buildSoftFeasibleRecoveryChoice
    ?.orderedRouteShapeAttempts[0]?.movementProfile.radius === 'tight',
  'Interpretation must place the most compact tighter-route attempt first.',
)
const waypointSource = fs.readFileSync(
  'src/domain/waypoint/buildContractDrivenBuildWaypointPlan.ts',
  'utf8',
)
assert(
  !waypointSource.includes('BUILD_RECOVERY_MOVEMENT_POSTURE_ORDER') &&
    !waypointSource.includes('buildRecoveryPlaceRightTolerance') &&
    !waypointSource.includes('applyBuildRecoveryMovementPosture'),
  'Waypoint must not own recovery posture order, tolerance policy, or posture application semantics.',
)
const interpretationSource = fs.readFileSync(
  'src/domain/interpretation/conciergeIntent/buildConciergeIntent.ts',
  'utf8',
)
assert(
  interpretationSource.includes('INTERPRETATION_BUILD_RECOVERY_MOVEMENT_POSTURE_ORDER'),
  'Interpretation must own the ordered recovery posture candidate set.',
)
assert(
  noTighterAttempts.length === 0,
  'Try-tighter-route must honestly fail when no strictly tighter posture exists.',
)

const actualRecoveryExecutionInput: IntentInput = {
  mode: 'build',
  planningMode: 'user-led',
  persona: 'romantic',
  primaryVibe: 'cozy',
  secondaryVibe: 'lively',
  city: 'San Jose',
  district: 'Little Portugal',
  distanceMode: 'short-drive',
  anchor: {
    venueId: 'sj-adega-wine-atelier',
    role: 'highlight',
  },
  discoveryPreferences: [
    {
      venueId: 'sj-adega-wine-atelier',
      role: 'highlight',
    },
  ],
}

async function runActualRecoveryExecutionObserver(): Promise<
  Array<{
    action: string
    order: number
    radius: string
    maxTransitionMinutes: number
    routeNames: string[]
    routeVenueIds: string[]
    executionStatus: 'completed' | 'rejected'
    greatStopStatus: string
    failedCriteria: string[]
    failureReasons: string[]
    requiredAnchorSurvived: boolean | null
  }>
> {
  const attempts = [
    ...biggerNightAttempts.map((attempt, order) => ({
      action: 'take_bigger_night',
      order,
      routeShapeContract: attempt,
    })),
    ...tighterRouteAttempts.map((attempt, order) => ({
      action: 'try_tighter_route',
      order,
      routeShapeContract: attempt,
    })),
  ]
  const observations = []
  for (const attempt of attempts) {
    try {
      const result = await runGeneratePlan(actualRecoveryExecutionInput, {
        seedVenues: sanJoseVenues,
        sourceMode: 'curated',
        sourceModeOverrideApplied: true,
        debugMode: false,
        includePlaceRightDiagnosticCounterfactuals: true,
        routeShapeContract: attempt.routeShapeContract,
      })
      const greatStop = result.trace.greatStopGateResult
      assert(greatStop, 'Actual recovery execution must expose a Great Stop result.')
      const routeVenueIds = result.selectedArc.stops.map(getArcStopBaseVenueId)
      assert(
        routeVenueIds.includes('sj-adega-wine-atelier'),
        'Actual recovery execution must preserve the selected Build anchor in generated route truth.',
      )
      observations.push({
        action: attempt.action,
        order: attempt.order,
        radius: attempt.routeShapeContract.movementProfile.radius,
        maxTransitionMinutes: attempt.routeShapeContract.movementProfile.maxTransitionMinutes,
        routeNames: result.selectedArc.stops.map((stop) => stop.scoredVenue.venue.name),
        routeVenueIds,
        executionStatus: 'completed' as const,
        greatStopStatus: greatStop.status,
        failedCriteria: greatStop.failedCriteria,
        failureReasons: greatStop.reasons,
        requiredAnchorSurvived: greatStop.requiredAnchor?.survived ?? null,
      })
    } catch (error) {
      if (!(error instanceof GreatStopGateSelectionError)) {
        throw error
      }
      const selectedGate = error.greatStopGateSelectionDiagnostics.selectedGateResult
      assert(
        selectedGate,
        'Rejected actual recovery execution must expose the selected Great Stop gate result.',
      )
      const routeVenueIds =
        error.greatStopGateSelectionDiagnostics.evaluatedCandidateIdentitySummaries?.[0]?.stops.map(
          (stop) => stop.baseVenueId,
        ) ?? []
      assert(
        routeVenueIds.includes('sj-adega-wine-atelier'),
        'Rejected actual recovery execution must preserve the selected Build anchor in candidate truth.',
      )
      observations.push({
        action: attempt.action,
        order: attempt.order,
        radius: attempt.routeShapeContract.movementProfile.radius,
        maxTransitionMinutes: attempt.routeShapeContract.movementProfile.maxTransitionMinutes,
        routeNames:
          error.greatStopGateSelectionDiagnostics.evaluatedCandidateIdentitySummaries?.[0]?.stops.map(
            (stop) => stop.name,
          ) ?? [],
        routeVenueIds,
        executionStatus: 'rejected' as const,
        greatStopStatus: selectedGate.status,
        failedCriteria: selectedGate.failedCriteria,
        failureReasons: selectedGate.reasons,
        requiredAnchorSurvived: selectedGate.requiredAnchor?.survived ?? null,
      })
    }
  }
  return observations
}

const actualRecoveryExecution = await runActualRecoveryExecutionObserver()
assert(
  actualRecoveryExecution.map((entry) => `${entry.action}:${entry.maxTransitionMinutes}`).join('|') ===
    'take_bigger_night:32|try_tighter_route:14|try_tighter_route:18',
  'Actual recovery execution observer must run the Interpretation-authored attempts in deterministic order.',
)
assert(fetchCallCount === 0, 'Build soft-feasible recovery carrier test must not call fetch.')

console.log(
  JSON.stringify(
    {
      pass: true,
      fetchCallCount,
      biggerNightRadius: biggerNightContract.movementProfile.radius,
      tighterRouteRadius: tighterRouteContract.movementProfile.radius,
      actualRecoveryExecution,
    },
    null,
    2,
  ),
)
