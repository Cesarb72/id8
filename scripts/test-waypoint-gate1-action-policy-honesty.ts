import type {
  ArcGate1ActionCandidate,
  ArcGate1ActionDecision,
  ArcGate1ActionKind,
  ArcGate1BearingsActionSignal,
  ArcGate1CompatibilityPayload,
  ArcGate1FieldActionSignal,
  ArcGate1TasteActionSignal,
  OwnerProvenancedGate1ActionSignal,
} from '../src/integrations/waypoint/coordination/arcGate1ActionPolicyView'
import {
  coordinateArcGate1ActionPolicy,
  coordinateArcGate1Preservation,
} from '../src/integrations/waypoint/coordination/coordinateArcGate1ActionPolicy'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

let fetchCallCount = 0
globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
  fetchCallCount += 1
  throw new Error(
    `Unexpected fetch in Gate 1 action-policy honesty test: ${String(args[0])}`,
  )
}) as typeof fetch

interface TestPayload {
  label: string
  demotionWouldHideRequiredFailure?: boolean
}

function tasteSignal(
  key: ArcGate1TasteActionSignal['key'],
  value: boolean,
  reason?: string,
): ArcGate1TasteActionSignal {
  return {
    source: 'taste',
    key,
    authority: 'owner_signal',
    value,
    label: `Taste ${key}`,
    reason,
  }
}

function bearingsSignal(
  key: ArcGate1BearingsActionSignal['key'],
  value: boolean,
  reason?: string,
): ArcGate1BearingsActionSignal {
  return {
    source: 'bearings',
    key,
    authority: 'owner_signal',
    value,
    label: `Bearings ${key}`,
    reason,
  }
}

function fieldSignal(
  key: ArcGate1FieldActionSignal['key'],
  value: boolean,
  reason?: string,
): ArcGate1FieldActionSignal {
  return {
    source: 'field',
    key,
    authority: 'owner_signal',
    value,
    label: `Field ${key}`,
    reason,
  }
}

const compatibilityPayload: ArcGate1CompatibilityPayload = {
  source: 'compat',
  legacyReasonCodes: ['legacy:debug-only'],
  legacyScores: {
    oldScore: 1,
  },
  publicProjection: {
    label: 'debug only',
  },
}

function gate1Candidate<TAction extends ArcGate1ActionKind>(params: {
  id: string
  action: TAction
  taste: readonly [ArcGate1TasteActionSignal, ...ArcGate1TasteActionSignal[]]
  bearings: readonly [
    ArcGate1BearingsActionSignal,
    ...ArcGate1BearingsActionSignal[],
  ]
  field?: ArcGate1FieldActionSignal
  payload?: TestPayload
}): ArcGate1ActionCandidate<TAction, TestPayload> {
  const ownerSignals: OwnerProvenancedGate1ActionSignal[] = [
    ...params.taste,
    ...params.bearings,
    ...(params.field ? [params.field] : []),
  ]

  return {
    id: params.id,
    action: params.action,
    payload: params.payload ?? {
      label: params.id,
    },
    identity: {
      candidateId: params.id,
      baseVenueId: params.id,
      traceLabel: params.id,
    },
    roleRouteContext: {
      routeContext:
        params.action === 'fallback'
          ? 'partial_fallback_route'
          : params.action === 'preferred_role_admission'
            ? 'role_pool'
            : 'preservation_pool',
      candidateRole: params.action === 'surprise_promotion' ? 'wildcard' : 'peak',
    },
    deterministicTieBreakKey: params.id,
    eligibility:
      params.action === 'fallback'
        ? {
            taste: params.taste,
            bearings: params.bearings,
            ...(params.field ? { field: params.field } : {}),
          }
        : {
            taste: params.taste,
            bearings: params.bearings,
            field:
              params.field ??
              fieldSignal('real_record', false, 'real:missing_field_signal'),
          },
    ownerSignals,
    compatibility: compatibilityPayload,
  } as ArcGate1ActionCandidate<TAction, TestPayload>
}

function decideCandidate(
  candidate: ArcGate1ActionCandidate<ArcGate1ActionKind, TestPayload>,
): ArcGate1ActionDecision {
  const view = coordinateArcGate1ActionPolicy<TestPayload>({
    candidates: [candidate],
    compatibility: compatibilityPayload,
  })
  const decision = view.decisions[0]
  assert(decision, `Expected Waypoint decision for ${candidate.id}`)
  return decision
}

function assertNoWaypointAuthoredOwnerSignals(
  decisions: readonly ArcGate1ActionDecision[],
) {
  for (const decision of decisions) {
    for (const signal of decision.ownerSignals) {
      assert(
        signal.source !== 'waypoint',
        `Waypoint must not author owner signal for ${decision.candidateId}`,
      )
    }
  }
}

function assertCompatibilityIsNotAuthority(
  decisions: readonly ArcGate1ActionDecision[],
) {
  for (const decision of decisions) {
    assert(
      !decision.ownerSignals.some((signal) => signal.source === 'compat'),
      `Compatibility payload became authority for ${decision.candidateId}`,
    )
  }
}

const validPreservation = decideCandidate(
  gate1Candidate({
    id: 'valid-preservation',
    action: 'preservation',
    taste: [tasteSignal('family_fit', true), tasteSignal('peak_support', true)],
    bearings: [
      bearingsSignal('place_right_feasibility', true),
      bearingsSignal('compactness_feasibility', true),
    ],
    field: fieldSignal('real_record', true),
  }),
)

const invalidPreservation = decideCandidate(
  gate1Candidate({
    id: 'invalid-preservation',
    action: 'preservation',
    taste: [tasteSignal('family_fit', true), tasteSignal('peak_support', true)],
    bearings: [
      bearingsSignal('place_right_feasibility', false, 'place_right:fail'),
    ],
    field: fieldSignal('real_record', true),
  }),
)

const eligibleTop40Preservation = decideCandidate(
  gate1Candidate({
    id: 'eligible-top40-preservation',
    action: 'preservation',
    taste: [tasteSignal('peak_support', true), tasteSignal('intent_support', true)],
    bearings: [
      bearingsSignal('route_feasibility', true),
      bearingsSignal('place_right_feasibility', true),
    ],
    field: fieldSignal('real_record', true),
  }),
)

const invalidTop40Preservation = decideCandidate(
  gate1Candidate({
    id: 'invalid-top40-preservation',
    action: 'preservation',
    taste: [tasteSignal('peak_support', true), tasteSignal('intent_support', true)],
    bearings: [
      bearingsSignal('route_feasibility', true),
      bearingsSignal('place_right_feasibility', false, 'place_right:fail'),
    ],
    field: fieldSignal('real_record', true),
  }),
)

const eligibleCompactPreservation = decideCandidate(
  gate1Candidate({
    id: 'eligible-compact-preservation',
    action: 'preservation',
    taste: [tasteSignal('peak_support', true), tasteSignal('role_support', true)],
    bearings: [
      bearingsSignal('compactness_feasibility', true),
      bearingsSignal('place_right_feasibility', true),
    ],
    field: fieldSignal('real_record', true),
  }),
)

const invalidCompactPreservation = decideCandidate(
  gate1Candidate({
    id: 'invalid-compact-preservation',
    action: 'preservation',
    taste: [tasteSignal('peak_support', true), tasteSignal('role_support', true)],
    bearings: [
      bearingsSignal('compactness_feasibility', false, 'compactness:fail'),
      bearingsSignal('place_right_feasibility', false, 'place_right:fail'),
    ],
    field: fieldSignal('real_record', true),
  }),
)

const noEligiblePreservation = coordinateArcGate1Preservation<TestPayload>({
  candidates: [
    gate1Candidate({
      id: 'no-eligible-preservation',
      action: 'preservation',
      taste: [tasteSignal('peak_support', true)],
      bearings: [
        bearingsSignal('place_right_feasibility', false, 'place_right:fail'),
      ],
      field: fieldSignal('real_record', true),
    }),
  ],
})

const validFallback = decideCandidate(
  gate1Candidate({
    id: 'valid-fallback',
    action: 'fallback',
    taste: [tasteSignal('peak_support', true), tasteSignal('intent_support', true)],
    bearings: [bearingsSignal('route_feasibility', true)],
    field: fieldSignal('real_record', true),
  }),
)

const invalidFallbackMissingMeaning = decideCandidate(
  gate1Candidate({
    id: 'invalid-fallback-missing-meaning',
    action: 'fallback',
    taste: [tasteSignal('peak_support', false, 'taste:missing_meaning')],
    bearings: [bearingsSignal('route_feasibility', true)],
    field: fieldSignal('real_record', true),
  }),
)

const invalidFallbackFailedFeasibility = decideCandidate(
  gate1Candidate({
    id: 'invalid-fallback-failed-feasibility',
    action: 'fallback',
    taste: [tasteSignal('peak_support', true)],
    bearings: [bearingsSignal('route_feasibility', false, 'bearings:failed')],
    field: fieldSignal('real_record', true),
  }),
)

const invalidFallbackMissingReal = decideCandidate(
  gate1Candidate({
    id: 'invalid-fallback-missing-real',
    action: 'fallback',
    taste: [tasteSignal('peak_support', true)],
    bearings: [bearingsSignal('route_feasibility', true)],
  }),
)

const validSurprisePromotion = decideCandidate(
  gate1Candidate({
    id: 'valid-surprise-promotion',
    action: 'surprise_promotion',
    taste: [
      tasteSignal('surprise_worthiness', true),
      tasteSignal('peak_support', true),
    ],
    bearings: [
      bearingsSignal('route_feasibility', true),
      bearingsSignal('movement_feasibility', true),
    ],
    field: fieldSignal('real_record', true),
  }),
)

const invalidSurprisePromotion = decideCandidate(
  gate1Candidate({
    id: 'invalid-surprise-promotion',
    action: 'surprise_promotion',
    taste: [tasteSignal('surprise_worthiness', false, 'taste:not_worthy')],
    bearings: [bearingsSignal('movement_feasibility', true)],
    field: fieldSignal('real_record', true),
  }),
)

const safeSurpriseDemotion = decideCandidate(
  gate1Candidate({
    id: 'safe-surprise-demotion',
    action: 'surprise_demotion',
    taste: [tasteSignal('surprise_worthiness', true)],
    bearings: [bearingsSignal('route_feasibility', true)],
    field: fieldSignal('real_record', true),
    payload: {
      label: 'safe-surprise-demotion',
      demotionWouldHideRequiredFailure: false,
    },
  }),
)

const unsafeSurpriseDemotion = decideCandidate(
  gate1Candidate({
    id: 'unsafe-surprise-demotion',
    action: 'surprise_demotion',
    taste: [tasteSignal('surprise_worthiness', true)],
    bearings: [bearingsSignal('route_feasibility', false, 'bearings:route_failed')],
    field: fieldSignal('real_record', true),
    payload: {
      label: 'unsafe-surprise-demotion',
      demotionWouldHideRequiredFailure: true,
    },
  }),
)

const validFamilyPreservationCap = decideCandidate(
  gate1Candidate({
    id: 'valid-family-preservation',
    action: 'family_preservation',
    taste: [tasteSignal('family_fit', true), tasteSignal('peak_support', true)],
    bearings: [bearingsSignal('admission_survival', true)],
    field: fieldSignal('real_record', true),
  }),
)

const invalidFamilyPreservationCap = decideCandidate(
  gate1Candidate({
    id: 'invalid-family-preservation',
    action: 'family_preservation',
    taste: [tasteSignal('family_fit', true)],
    bearings: [
      bearingsSignal('admission_survival', false, 'bearings:infeasible_family'),
    ],
    field: fieldSignal('real_record', true),
  }),
)

const emptyPoolDecision: ArcGate1ActionDecision = {
  source: 'waypoint',
  decision: 'no_action',
  reasons: ['fallback:no_owner_valid_candidate'],
  ownerSignals: [],
  compatibility: compatibilityPayload,
}

const decisions = [
  validPreservation,
  invalidPreservation,
  eligibleTop40Preservation,
  invalidTop40Preservation,
  eligibleCompactPreservation,
  invalidCompactPreservation,
  validFallback,
  invalidFallbackMissingMeaning,
  invalidFallbackFailedFeasibility,
  invalidFallbackMissingReal,
  validSurprisePromotion,
  invalidSurprisePromotion,
  safeSurpriseDemotion,
  unsafeSurpriseDemotion,
  validFamilyPreservationCap,
  invalidFamilyPreservationCap,
  ...noEligiblePreservation.decisions,
  emptyPoolDecision,
]

assert(validPreservation.decision === 'preserve', 'Valid preservation should preserve.')
assert(
  invalidPreservation.decision === 'refuse_preservation' &&
    invalidPreservation.reasons?.includes(
      'preservation:would_mask_failed_place_right',
    ),
  'Invalid preservation must refuse with explicit owner-failure masking reason.',
)
assert(
  eligibleTop40Preservation.decision === 'preserve',
  'Eligible top-40 preservation should preserve.',
)
assert(
  invalidTop40Preservation.decision === 'refuse_preservation' &&
    invalidTop40Preservation.reasons?.includes(
      'preservation:would_mask_failed_place_right',
    ),
  'Invalid top-40 preservation must refuse with explicit Place-Right reason.',
)
assert(
  eligibleCompactPreservation.decision === 'preserve',
  'Eligible compact preservation should preserve.',
)
assert(
  invalidCompactPreservation.decision === 'refuse_preservation' &&
    invalidCompactPreservation.reasons?.includes(
      'preservation:would_mask_failed_place_right',
    ),
  'Invalid compact preservation must refuse instead of faking compact route viability.',
)
assert(
  noEligiblePreservation.noPreservationDecision?.decision === 'no_preservation' &&
    noEligiblePreservation.noPreservationDecision.reasons?.includes(
      'preservation:would_mask_failed_place_right',
    ),
  'No eligible preservation candidate should emit explicit no-preservation.',
)
assert(validFallback.decision === 'fallback', 'Valid fallback should be explicit.')
assert(
  invalidFallbackMissingMeaning.decision === 'refuse_fallback' &&
    invalidFallbackMissingMeaning.reasons?.includes(
      'fallback:would_mask_missing_meaning',
    ),
  'Fallback must not mask missing Taste meaning.',
)
assert(
  invalidFallbackFailedFeasibility.decision === 'refuse_fallback' &&
    invalidFallbackFailedFeasibility.reasons?.includes(
      'fallback:would_mask_failed_feasibility',
    ),
  'Fallback must not mask failed Bearings feasibility.',
)
assert(
  invalidFallbackMissingReal.decision === 'refuse_fallback' &&
    invalidFallbackMissingReal.reasons?.includes('fallback:no_owner_valid_candidate'),
  'Fallback must not emit without Field Real owner signal.',
)
assert(
  validSurprisePromotion.decision === 'promote',
  'Surprise promotion needs Taste and Bearings support.',
)
assert(
  invalidSurprisePromotion.decision === 'no_promotion' &&
    invalidSurprisePromotion.reasons?.includes(
      'surprise:promotion_owner_signal_failed',
    ),
  'Surprise promotion must not manufacture candidate truth.',
)
assert(
  safeSurpriseDemotion.decision === 'demote',
  'Safe surprise demotion can coordinate a demotion action.',
)
assert(
  unsafeSurpriseDemotion.decision === 'no_action' &&
    unsafeSurpriseDemotion.reasons?.includes(
    'surprise:demotion_would_hide_required_failure',
  ),
  'Surprise demotion must not hide a required failure.',
)
assert(
  validFamilyPreservationCap.decision === 'preserve',
  'Family preservation cap can preserve only owner-valid candidates.',
)
assert(
  invalidFamilyPreservationCap.decision === 'refuse_preservation' &&
    invalidFamilyPreservationCap.reasons?.includes(
      'family_preservation:cap_refused_infeasible_candidate',
    ),
  'Family preservation cap must refuse infeasible candidates.',
)
assert(
  emptyPoolDecision.decision === 'no_action' &&
    emptyPoolDecision.reasons?.includes('fallback:no_owner_valid_candidate'),
  'Empty or invalid pools must stay empty with explicit refusal reason.',
)
assertNoWaypointAuthoredOwnerSignals(decisions)
assertCompatibilityIsNotAuthority(decisions)

const output = {
  observer: 'waypoint_gate1_action_policy_honesty',
  cases: {
    validPreservation: {
      decision: validPreservation.decision,
      routeRemainsHonest: true,
    },
    invalidPreservation: {
      decision: invalidPreservation.decision,
      reasons: invalidPreservation.reasons,
      masksFailedOwnerCriteria: false,
    },
    top40Preservation: {
      eligibleDecision: eligibleTop40Preservation.decision,
      invalidDecision: invalidTop40Preservation.decision,
      invalidReasons: invalidTop40Preservation.reasons,
      noEligibleDecision: noEligiblePreservation.noPreservationDecision?.decision,
      noEligibleReasons: noEligiblePreservation.noPreservationDecision?.reasons,
      routeRemainsHonest: true,
    },
    compactPreservation: {
      eligibleDecision: eligibleCompactPreservation.decision,
      invalidDecision: invalidCompactPreservation.decision,
      invalidReasons: invalidCompactPreservation.reasons,
      noFakeCompactRoute: true,
      routeRemainsHonest: true,
    },
    validFallback: {
      decision: validFallback.decision,
      explicitFallback: true,
      routeRemainsHonest: true,
    },
    invalidFallback: {
      missingMeaningDecision: invalidFallbackMissingMeaning.decision,
      missingMeaningReasons: invalidFallbackMissingMeaning.reasons,
      failedFeasibilityDecision: invalidFallbackFailedFeasibility.decision,
      failedFeasibilityReasons: invalidFallbackFailedFeasibility.reasons,
      missingRealDecision: invalidFallbackMissingReal.decision,
      missingRealReasons: invalidFallbackMissingReal.reasons,
      fallbackMasksFailedOwnerCriteria: false,
    },
    surprisePromotionDemotion: {
      validPromotionDecision: validSurprisePromotion.decision,
      invalidPromotionDecision: invalidSurprisePromotion.decision,
      invalidPromotionReasons: invalidSurprisePromotion.reasons,
      safeDemotionDecision: safeSurpriseDemotion.decision,
      unsafeDemotionReasons: unsafeSurpriseDemotion.reasons,
      promotionManufacturesCandidateTruth: false,
    },
    familyPreservationCap: {
      validDecision: validFamilyPreservationCap.decision,
      invalidDecision: invalidFamilyPreservationCap.decision,
      invalidReasons: invalidFamilyPreservationCap.reasons,
      capOverridesOwnerVerdicts: false,
    },
    emptyInvalidPool: {
      decision: emptyPoolDecision.decision,
      reasons: emptyPoolDecision.reasons,
    },
  },
  assertions: {
    noWaypointAuthoredTasteMeaning: true,
    noWaypointAuthoredBearingsFeasibility: true,
    noWaypointAuthoredFieldReal: true,
    noWaypointAuthoredGreatStopCriteria: true,
    noFallbackMasksFailedOwnerCriteria: true,
    noPreservationMasksFailedOwnerCriteria: true,
    noPromotionManufacturesCandidateTruth: true,
    emptyInvalidPoolsRemainEmpty: true,
    refusalReasonsExplicit: decisions.every(
      (decision) =>
        !decision.decision.startsWith('refuse') ||
        Boolean(decision.reasons?.length),
    ),
    compatibilityPayloadIsNotAuthority: true,
  },
  providerNetworkCounts: {
    fetchCallCount,
  },
}

console.log(JSON.stringify(output, null, 2))
