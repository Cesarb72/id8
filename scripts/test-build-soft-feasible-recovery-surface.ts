import {
  areBuildSoftFeasibleRecoveryBindingsEqual,
  buildGreatStopRecoverySurfaceModel,
  validateBuildSoftFeasibleRecoveryActionBinding,
  type BuildSoftFeasibleRecoveryActionBinding,
} from '../src/app/services/greatStopRecoverySurface'
import type { BearingsPlaceRightDiagnosticCounterfactuals } from '../src/domain/bearings/routePlaceRightContract'
import type { GreatStopGateSelectionDiagnostics } from '../src/domain/types/greatStopGate'
import type { RouteShapeContract } from '../src/domain/types/intent'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

let fetchCallCount = 0
globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
  fetchCallCount += 1
  throw new Error(`Unexpected fetch in Build soft-feasible recovery surface test: ${String(args[0])}`)
}) as typeof fetch

function counterfactuals(): BearingsPlaceRightDiagnosticCounterfactuals {
  const baseVerdict = {
    placeRightReady: true,
    status: 'fail',
    reasons: ['place_right:cluster_escape_structure'],
    distanceBurden: {
      status: 'fail',
      burden: 'high',
      reasonCodes: ['place_right:cluster_escape_structure'],
      notes: ['total:30', 'max:15'],
    },
    movementToleranceFit: { status: 'fail', reasonCodes: ['place_right:cluster_escape_structure'] },
    stretchAdmissibility: { status: 'not_applicable', reasonCodes: [] },
    supportProximityVerdict: { status: 'fail', reasonCodes: ['place_right:poor_support_proximity'] },
    supportSupplyBuildabilityVerdict: { status: 'pass', reasonCodes: [] },
    requiredStopSurvivalVerdict: { status: 'pass', reasonCodes: [] },
    openClosedViabilityVerdict: { status: 'pass', reasonCodes: [] },
    stopEvidence: [],
    routeEvidence: {
      status: 'fail',
      distanceBurden: {
        status: 'fail',
        burden: 'high',
        reasonCodes: ['place_right:cluster_escape_structure'],
        notes: ['total:30', 'max:15'],
      },
      movementToleranceFit: { status: 'fail', reasonCodes: ['place_right:cluster_escape_structure'] },
      stretchAdmissibility: { status: 'not_applicable', reasonCodes: [] },
      supportProximity: { status: 'fail', reasonCodes: ['place_right:poor_support_proximity'] },
      supportSupplyBuildability: { status: 'pass', reasonCodes: [] },
      requiredStopSurvival: { status: 'pass', reasonCodes: [] },
      openClosedViability: { status: 'pass', reasonCodes: [] },
      reasonCodes: ['place_right:cluster_escape_structure'],
    },
    compatibility: {
      greatStopPlaceRightStatus: 'fail',
      greatStopPlaceRightReasonCodes: ['place_right:cluster_escape_structure'],
    },
    provenance: {
      source: 'bearings',
      version: 'test',
      notes: [],
    },
    supportWorldDiagnostics: {
      evaluationMode: {
        softClauseMode: 'enforce',
        hardClauseMode: 'enforce',
      },
      softClausesObservedOnly: [],
      hardClausesEnforced: ['place_right:required_stop_survival_failed'],
      clauseEvidence: [
        {
          clause: 'cluster_escape_structure',
          disposition: 'soft',
          result: 'fail',
          subjectIds: ['adega'],
          factualInputs: {},
          relationship: 'independent_root',
        },
      ],
      supplyFunnel: {
        enteringPlaceRight: { total: 3, byRole: {}, candidateIds: ['start', 'adega', 'wind'] },
        afterHardConstraints: { total: 3, byRole: {}, candidateIds: ['start', 'adega', 'wind'] },
        afterSoftConstraints: { total: 0, byRole: {}, candidateIds: [] },
        hardRejectedCandidates: [],
        softRejectedCandidates: [{ candidateId: 'route-1', reason: 'place_right:cluster_escape_structure' }],
        requiredStopSurvival: [
          {
            requiredStopBaseVenueId: 'adega',
            requiredRole: 'highlight',
            result: 'pass',
            relationship: 'independent_root',
            enteringSupportCount: 2,
            hardSurvivorCount: 2,
            softSurvivorCount: 0,
          },
        ],
        finalSupportWorld: {
          buildable: false,
          relationship: 'independent_root',
          reasonCodes: ['place_right:cluster_escape_structure'],
        },
      },
      retainedProductionReasons: ['place_right:cluster_escape_structure'],
      observedOnlyReasons: [],
    },
  } as const

  return {
    allClausesEnforced: baseVerdict,
    softClausesObserveOnly: {
      ...baseVerdict,
      status: 'pass',
      reasons: [],
      compatibility: {
        greatStopPlaceRightStatus: 'pass',
        greatStopPlaceRightReasonCodes: [],
      },
      supportWorldDiagnostics: {
        ...baseVerdict.supportWorldDiagnostics,
        evaluationMode: {
          softClauseMode: 'observe_only',
          hardClauseMode: 'enforce',
        },
        softClausesObservedOnly: ['place_right:cluster_escape_structure'],
        supplyFunnel: {
          ...baseVerdict.supportWorldDiagnostics.supplyFunnel,
          finalSupportWorld: {
            buildable: true,
            relationship: 'independent_root',
            reasonCodes: [],
          },
        },
        observedOnlyReasons: ['place_right:cluster_escape_structure'],
      },
    },
  } as BearingsPlaceRightDiagnosticCounterfactuals
}

function buildDiagnostics(requiredAnchorSurvived: boolean): GreatStopGateSelectionDiagnostics {
  return {
    status: 'FAIL',
    stage: 'pre_selection_gate',
    evaluatedCandidateCount: 1,
    failedTopCandidateCriteria: ['place_right'],
    failureReasons: ['place_right:cluster_escape_structure'],
    passingCandidateCount: 0,
    selectedGateResult: {
      status: 'FAIL',
      failedCriteria: ['place_right'],
      reasons: ['place_right:cluster_escape_structure'],
      routeId: 'route-1',
      requiredAnchor: {
        venueId: 'adega',
        role: 'highlight',
        survived: requiredAnchorSurvived,
      },
      criteria: {
        real: { passed: true, reasons: [] },
        roleRight: { passed: true, reasons: [] },
        intentRight: { passed: true, reasons: [] },
        placeRight: { passed: false, reasons: ['place_right:cluster_escape_structure'] },
        momentRight: { passed: true, reasons: [] },
      },
      preset: {
        persona: 'romantic',
        locationClass: 'L2 Mid',
        travelTolerance: 'tight',
        source: 'explicit',
      },
      diagnostics: {
        movement: {
          totalEstimatedTransitionMinutes: 30,
          maxSingleTransitionMinutes: 15,
          transitionCount: 2,
          driveLikeMovement: true,
          transitionLimitMinutes: 14,
          totalLimitMinutes: 24,
        },
        clusterCoherence: {
          clusterEscapeCount: 2,
          repeatedClusterEscapeCount: 0,
          longTransitionCount: 1,
          maxClusterEscapes: 1,
          spatialScore: 0,
          notes: [],
        },
        zigzagOrBacktrack: { detected: false },
        arcProgression: {
          startPresent: true,
          highlightPresent: true,
          windDownPresent: true,
          peakRoleAdvantage: 0,
          supportAverageRoleFit: 1,
          energyProgressionValid: true,
        },
        laneVariance: {
          uniqueLaneCount: 3,
          laneRepetitionCount: 0,
          supportLaneVariance: 2,
        },
        strongMoment: { present: true },
        placeRightDiagnosticCounterfactuals: counterfactuals(),
      },
    },
  }
}

const originatingMovementProfile: RouteShapeContract['movementProfile'] = {
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
}

const softModel = buildGreatStopRecoverySurfaceModel({
  mode: 'build',
  diagnostics: buildDiagnostics(true),
  buildAnchorName: 'Adega',
  buildIntentId: 'cintent-build-adega',
  buildAnchorVenueId: 'adega',
  buildAnchorRole: 'highlight',
  buildAnchorRoleProvenance: 'explicit',
  selectedCandidateArtifactId: 'candidate-artifact-1',
  originatingMovementProfile,
})
assert(softModel.active, 'Build recovery model should be active for failed diagnostics.')
assert(
  softModel.buildSoftFeasibleRecovery?.classification === 'SOFT_FEASIBLE',
  'Build recovery model should expose SOFT_FEASIBLE evidence.',
)
assert(
  softModel.buildSoftFeasibleRecovery.actions.map((action) => action.action).join('|') ===
    'take_bigger_night|try_tighter_route',
  'Build recovery model should expose the two authorized actions in deterministic order.',
)
assert(
  softModel.title === 'This night needs a little more room',
  'Build recovery heading must render the founder-locked copy exactly.',
)
assert(
  softModel.copy === 'We can keep Adega and try the night in one of two ways.',
  'Build recovery body must render the founder-locked copy exactly with the anchor name.',
)
assert(
  softModel.buildSoftFeasibleRecovery.actions[0]?.copy ===
    'Open up the route for more movement and possibility.' &&
    softModel.buildSoftFeasibleRecovery.actions[1]?.copy ===
      'Rebuild the night with stops that stay closer together.',
  'Build recovery action descriptions must render the founder-locked copy exactly.',
)
assert(
  softModel.buildSoftFeasibleRecovery.binding.intentId === 'cintent-build-adega' &&
    softModel.buildSoftFeasibleRecovery.binding.anchorVenueId === 'adega' &&
    softModel.buildSoftFeasibleRecovery.binding.anchorRole === 'highlight' &&
    softModel.buildSoftFeasibleRecovery.binding.anchorRoleProvenance === 'explicit' &&
    softModel.buildSoftFeasibleRecovery.binding.selectedCandidateArtifactId ===
      'candidate-artifact-1' &&
    softModel.buildSoftFeasibleRecovery.binding.assessedRouteId === 'route-1' &&
    softModel.buildSoftFeasibleRecovery.binding.originatingMovementProfile
      ?.maxTransitionMinutes === 24 &&
    softModel.buildSoftFeasibleRecovery.binding.eligibilityClassification === 'SOFT_FEASIBLE',
  'Build recovery binding must preserve current intent, anchor, role, candidate, route, posture, and eligibility identity.',
)
assert(
  softModel.buildSoftFeasibleRecovery.binding.evidenceFingerprint.includes(
    'place_right:cluster_escape_structure',
  ),
  'Build recovery binding must include the evidence fingerprint that admitted the recovery surface.',
)
const sameSoftModel = buildGreatStopRecoverySurfaceModel({
  mode: 'build',
  diagnostics: buildDiagnostics(true),
  buildAnchorName: 'Adega',
  buildIntentId: 'cintent-build-adega',
  buildAnchorVenueId: 'adega',
  buildAnchorRole: 'highlight',
  buildAnchorRoleProvenance: 'explicit',
  selectedCandidateArtifactId: 'candidate-artifact-1',
  originatingMovementProfile,
})
assert(
  areBuildSoftFeasibleRecoveryBindingsEqual(
    softModel.buildSoftFeasibleRecovery.binding,
    sameSoftModel.buildSoftFeasibleRecovery?.binding,
  ),
  'Identical current recovery state must compare equal before applying a recovery click.',
)
const staleAnchorModel = buildGreatStopRecoverySurfaceModel({
  mode: 'build',
  diagnostics: buildDiagnostics(true),
  buildAnchorName: 'Adega',
  buildIntentId: 'cintent-build-adega',
  buildAnchorVenueId: 'nirvana-soul',
  buildAnchorRole: 'highlight',
  buildAnchorRoleProvenance: 'explicit',
  selectedCandidateArtifactId: 'candidate-artifact-1',
  originatingMovementProfile,
})
assert(
  !areBuildSoftFeasibleRecoveryBindingsEqual(
    softModel.buildSoftFeasibleRecovery.binding,
    staleAnchorModel.buildSoftFeasibleRecovery?.binding,
  ),
  'Changed anchor identity must stale a recovery click before generation.',
)
const stalePostureModel = buildGreatStopRecoverySurfaceModel({
  mode: 'build',
  diagnostics: buildDiagnostics(true),
  buildAnchorName: 'Adega',
  buildIntentId: 'cintent-build-adega',
  buildAnchorVenueId: 'adega',
  buildAnchorRole: 'highlight',
  buildAnchorRoleProvenance: 'explicit',
  selectedCandidateArtifactId: 'candidate-artifact-1',
  originatingMovementProfile: {
    ...originatingMovementProfile,
    radius: 'open',
    maxTransitionMinutes: 32,
    neighborhoodContinuity: 'flexible',
  },
})
assert(
  !areBuildSoftFeasibleRecoveryBindingsEqual(
    softModel.buildSoftFeasibleRecovery.binding,
    stalePostureModel.buildSoftFeasibleRecovery?.binding,
  ),
  'Changed originating movement posture must stale a recovery click before generation.',
)

const biggerAction = softModel.buildSoftFeasibleRecovery.actions.find(
  (action) => action.action === 'take_bigger_night',
)
const tighterAction = softModel.buildSoftFeasibleRecovery.actions.find(
  (action) => action.action === 'try_tighter_route',
)
assert(biggerAction, 'Bigger recovery action must be rendered.')
assert(tighterAction, 'Tighter recovery action must be rendered.')

function observeActionBindingValidation(params: {
  name: string
  clickedAction: string
  submittedBinding?: BuildSoftFeasibleRecoveryActionBinding | null
  currentModel?: typeof softModel
  expectedValid: boolean
  expectedReason: string
}): {
  name: string
  validationResult: string
  reason: string
  generationInvocationCount: number
  routeReachedReview: boolean
} {
  const currentRecovery = (params.currentModel ?? softModel).buildSoftFeasibleRecovery
  const validation = validateBuildSoftFeasibleRecoveryActionBinding({
    clickedAction: params.clickedAction as never,
    submittedBinding: params.submittedBinding,
    currentRecoveryBinding: currentRecovery?.binding,
    currentlyOfferedActions: currentRecovery?.actions.map((action) => action.action) ?? [],
  })
  assert(
    validation.valid === params.expectedValid && validation.reason === params.expectedReason,
    `${params.name} expected ${String(params.expectedValid)}:${params.expectedReason}, received ${String(validation.valid)}:${validation.reason}.`,
  )
  return {
    name: params.name,
    validationResult: validation.valid ? 'passes' : 'rejects',
    reason: validation.reason,
    generationInvocationCount: validation.valid ? 1 : 0,
    routeReachedReview: false,
  }
}

const actionBindingMatrix = [
  observeActionBindingValidation({
    name: 'Bigger binding + Bigger click',
    clickedAction: 'take_bigger_night',
    submittedBinding: biggerAction.binding,
    expectedValid: true,
    expectedReason: 'valid',
  }),
  observeActionBindingValidation({
    name: 'Tighter binding + Tighter click',
    clickedAction: 'try_tighter_route',
    submittedBinding: tighterAction.binding,
    expectedValid: true,
    expectedReason: 'valid',
  }),
  observeActionBindingValidation({
    name: 'Bigger binding + Tighter click',
    clickedAction: 'try_tighter_route',
    submittedBinding: biggerAction.binding,
    expectedValid: false,
    expectedReason: 'action_mismatch',
  }),
  observeActionBindingValidation({
    name: 'Tighter binding + Bigger click',
    clickedAction: 'take_bigger_night',
    submittedBinding: tighterAction.binding,
    expectedValid: false,
    expectedReason: 'action_mismatch',
  }),
  observeActionBindingValidation({
    name: 'Missing action identity',
    clickedAction: 'take_bigger_night',
    submittedBinding: {
      recoveryStateBinding: biggerAction.binding.recoveryStateBinding,
    } as never,
    expectedValid: false,
    expectedReason: 'missing_action_binding',
  }),
  observeActionBindingValidation({
    name: 'Unsupported unavailable action',
    clickedAction: 'unsupported_action',
    submittedBinding: {
      ...biggerAction.binding,
      action: 'unsupported_action',
    } as never,
    expectedValid: false,
    expectedReason: 'action_unavailable',
  }),
  observeActionBindingValidation({
    name: 'Action match with stale anchor',
    clickedAction: 'take_bigger_night',
    submittedBinding: biggerAction.binding,
    currentModel: staleAnchorModel,
    expectedValid: false,
    expectedReason: 'stale_recovery_state',
  }),
  observeActionBindingValidation({
    name: 'Exact full match',
    clickedAction: 'take_bigger_night',
    submittedBinding: biggerAction.binding,
    expectedValid: true,
    expectedReason: 'valid',
  }),
]

const hardModel = buildGreatStopRecoverySurfaceModel({
  mode: 'build',
  diagnostics: buildDiagnostics(false),
  buildAnchorName: 'Adega',
})
assert(
  hardModel.buildSoftFeasibleRecovery == null,
  'Hard required-anchor failure must not expose soft-feasible recovery actions.',
)

const surpriseModel = buildGreatStopRecoverySurfaceModel({
  mode: 'surprise',
  diagnostics: buildDiagnostics(true),
})
assert(
  surpriseModel.buildSoftFeasibleRecovery == null,
  'Surprise recovery surface must not expose Build soft-feasible actions.',
)

assert(fetchCallCount === 0, 'Build soft-feasible recovery surface test must not call fetch.')

console.log(
  JSON.stringify(
    {
      pass: true,
      fetchCallCount,
      actionCount: softModel.buildSoftFeasibleRecovery.actions.length,
      softClassification: softModel.buildSoftFeasibleRecovery.classification,
      actionBindingMatrix,
    },
    null,
    2,
  ),
)
