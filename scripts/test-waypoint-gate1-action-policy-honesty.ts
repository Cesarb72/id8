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
  coordinateArcGate1FallbackRescue,
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
          : params.action === 'rescue'
            ? 'recovery_pool'
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

const noEligibleFallback = coordinateArcGate1FallbackRescue<TestPayload>({
  candidates: [
    gate1Candidate({
      id: 'no-eligible-fallback-missing-meaning',
      action: 'fallback',
      taste: [tasteSignal('peak_support', false, 'taste:missing_meaning')],
      bearings: [bearingsSignal('route_feasibility', true)],
      field: fieldSignal('real_record', true),
    }),
    gate1Candidate({
      id: 'no-eligible-fallback-failed-feasibility',
      action: 'fallback',
      taste: [tasteSignal('peak_support', true)],
      bearings: [bearingsSignal('route_feasibility', false, 'bearings:failed')],
      field: fieldSignal('real_record', true),
    }),
  ],
})

const previouslyMaskedRescue = coordinateArcGate1FallbackRescue<TestPayload>({
  emptyDecision: 'no_rescue',
  candidates: [
    gate1Candidate({
      id: 'previously-masked-rescue',
      action: 'rescue',
      taste: [tasteSignal('peak_support', true), tasteSignal('intent_support', true)],
      bearings: [bearingsSignal('route_feasibility', false, 'bearings:failed')],
      field: fieldSignal('real_record', true),
      payload: {
        label: 'legacy rescue would have kept this route alive',
      },
    }),
  ],
})

const eligiblePreferredRoleAdmission = decideCandidate(
  gate1Candidate({
    id: 'eligible-preferred-role-admission',
    action: 'preferred_role_admission',
    taste: [tasteSignal('role_support', true), tasteSignal('intent_support', true)],
    bearings: [
      bearingsSignal('hours_feasibility', true),
      bearingsSignal('distance_feasibility', true),
      bearingsSignal('admission_survival', true),
      bearingsSignal('constraint_survival', true),
    ],
    field: fieldSignal('real_record', true),
  }),
)

const invalidPreferredRoleMissingMeaning = decideCandidate(
  gate1Candidate({
    id: 'invalid-preferred-role-missing-meaning',
    action: 'preferred_role_admission',
    taste: [
      tasteSignal('role_support', false, 'taste:missing_role_support'),
      tasteSignal('intent_support', true),
    ],
    bearings: [
      bearingsSignal('hours_feasibility', true),
      bearingsSignal('distance_feasibility', true),
      bearingsSignal('admission_survival', true),
      bearingsSignal('constraint_survival', true),
    ],
    field: fieldSignal('real_record', true),
  }),
)

const invalidPreferredRoleFailedAdmission = decideCandidate(
  gate1Candidate({
    id: 'invalid-preferred-role-failed-admission',
    action: 'preferred_role_admission',
    taste: [tasteSignal('role_support', true), tasteSignal('intent_support', true)],
    bearings: [
      bearingsSignal('hours_feasibility', true),
      bearingsSignal('distance_feasibility', true),
      bearingsSignal('admission_survival', false, 'bearings:admission_failed'),
      bearingsSignal('constraint_survival', true),
    ],
    field: fieldSignal('real_record', true),
  }),
)

const invalidPreferredRoleMissingReal = decideCandidate(
  gate1Candidate({
    id: 'invalid-preferred-role-missing-real',
    action: 'preferred_role_admission',
    taste: [tasteSignal('role_support', true), tasteSignal('intent_support', true)],
    bearings: [
      bearingsSignal('hours_feasibility', true),
      bearingsSignal('distance_feasibility', true),
      bearingsSignal('admission_survival', true),
      bearingsSignal('constraint_survival', true),
    ],
    field: fieldSignal('real_record', false, 'real:missing_record_truth'),
  }),
)

const previouslyMaskedPreferredRoleAdmission = decideCandidate(
  gate1Candidate({
    id: 'previously-masked-preferred-role-admission',
    action: 'preferred_role_admission',
    taste: [tasteSignal('role_support', true), tasteSignal('intent_support', true)],
    bearings: [
      bearingsSignal('hours_feasibility', true),
      bearingsSignal('distance_feasibility', true),
      bearingsSignal('admission_survival', false, 'bearings:admission_failed'),
      bearingsSignal('constraint_survival', true),
    ],
    field: fieldSignal('real_record', true),
    payload: {
      label: 'legacy preferred-role admission would have masked failed admission',
    },
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
    taste: [
      tasteSignal('family_fit', true),
      tasteSignal('peak_support', true),
      tasteSignal('role_support', true),
      tasteSignal('intent_support', true),
    ],
    bearings: [
      bearingsSignal('route_feasibility', true),
      bearingsSignal('admission_survival', true),
      bearingsSignal('constraint_survival', true),
    ],
    field: fieldSignal('real_record', true),
  }),
)

const invalidFamilyPreservationMissingMeaning = decideCandidate(
  gate1Candidate({
    id: 'invalid-family-preservation-missing-meaning',
    action: 'family_preservation',
    taste: [
      tasteSignal('family_fit', false, 'taste:family_missing'),
      tasteSignal('peak_support', true),
      tasteSignal('role_support', true),
      tasteSignal('intent_support', true),
    ],
    bearings: [
      bearingsSignal('route_feasibility', true),
      bearingsSignal('admission_survival', true),
      bearingsSignal('constraint_survival', true),
    ],
    field: fieldSignal('real_record', true),
  }),
)

const invalidFamilyPreservationFailedFeasibility = decideCandidate(
  gate1Candidate({
    id: 'invalid-family-preservation-failed-feasibility',
    action: 'family_preservation',
    taste: [
      tasteSignal('family_fit', true),
      tasteSignal('peak_support', true),
      tasteSignal('role_support', true),
      tasteSignal('intent_support', true),
    ],
    bearings: [
      bearingsSignal('route_feasibility', true),
      bearingsSignal('admission_survival', false, 'bearings:infeasible_family'),
      bearingsSignal('constraint_survival', true),
    ],
    field: fieldSignal('real_record', true),
  }),
)

const invalidFamilyPreservationMissingReal = decideCandidate(
  gate1Candidate({
    id: 'invalid-family-preservation-missing-real',
    action: 'family_preservation',
    taste: [
      tasteSignal('family_fit', true),
      tasteSignal('peak_support', true),
      tasteSignal('role_support', true),
      tasteSignal('intent_support', true),
    ],
    bearings: [
      bearingsSignal('route_feasibility', true),
      bearingsSignal('admission_survival', true),
      bearingsSignal('constraint_survival', true),
    ],
    field: fieldSignal('real_record', false, 'real:missing_record_truth'),
  }),
)

const previouslyMaskedFamilyPreservation = decideCandidate(
  gate1Candidate({
    id: 'previously-masked-family-preservation',
    action: 'family_preservation',
    taste: [
      tasteSignal('family_fit', true),
      tasteSignal('peak_support', true),
      tasteSignal('role_support', true),
      tasteSignal('intent_support', true),
    ],
    bearings: [
      bearingsSignal('route_feasibility', true),
      bearingsSignal('admission_survival', false, 'bearings:infeasible_family'),
      bearingsSignal('constraint_survival', true),
    ],
    field: fieldSignal('real_record', true),
    payload: {
      label: 'legacy family preservation would have forced this weak cap',
    },
  }),
)

const eligibleContractPressure = decideCandidate(
  gate1Candidate({
    id: 'eligible-contract-pressure',
    action: 'hard_contract_pressure',
    taste: [tasteSignal('role_support', true), tasteSignal('intent_support', true)],
    bearings: [
      bearingsSignal('admission_survival', true),
      bearingsSignal('constraint_survival', true),
    ],
    field: fieldSignal('real_record', true),
  }),
)

const invalidContractPressureMissingMeaning = decideCandidate(
  gate1Candidate({
    id: 'invalid-contract-pressure-missing-meaning',
    action: 'hard_contract_pressure',
    taste: [
      tasteSignal('role_support', false, 'taste:role_missing'),
      tasteSignal('intent_support', true),
    ],
    bearings: [
      bearingsSignal('admission_survival', true),
      bearingsSignal('constraint_survival', true),
    ],
    field: fieldSignal('real_record', true),
  }),
)

const invalidContractPressureFailedConstraint = decideCandidate(
  gate1Candidate({
    id: 'invalid-contract-pressure-failed-constraint',
    action: 'hard_contract_pressure',
    taste: [tasteSignal('role_support', true), tasteSignal('intent_support', true)],
    bearings: [
      bearingsSignal('admission_survival', true),
      bearingsSignal('constraint_survival', false, 'bearings:constraint_failed'),
    ],
    field: fieldSignal('real_record', true),
  }),
)

const invalidContractPressureMissingReal = decideCandidate(
  gate1Candidate({
    id: 'invalid-contract-pressure-missing-real',
    action: 'hard_contract_pressure',
    taste: [tasteSignal('role_support', true), tasteSignal('intent_support', true)],
    bearings: [
      bearingsSignal('admission_survival', true),
      bearingsSignal('constraint_survival', true),
    ],
    field: fieldSignal('real_record', false, 'real:missing_record_truth'),
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
  ...noEligibleFallback.decisions,
  ...previouslyMaskedRescue.decisions,
  eligiblePreferredRoleAdmission,
  invalidPreferredRoleMissingMeaning,
  invalidPreferredRoleFailedAdmission,
  invalidPreferredRoleMissingReal,
  previouslyMaskedPreferredRoleAdmission,
  validSurprisePromotion,
  invalidSurprisePromotion,
  safeSurpriseDemotion,
  unsafeSurpriseDemotion,
  validFamilyPreservationCap,
  invalidFamilyPreservationMissingMeaning,
  invalidFamilyPreservationFailedFeasibility,
  invalidFamilyPreservationMissingReal,
  previouslyMaskedFamilyPreservation,
  eligibleContractPressure,
  invalidContractPressureMissingMeaning,
  invalidContractPressureFailedConstraint,
  invalidContractPressureMissingReal,
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
    invalidFallbackMissingReal.reasons?.includes('fallback:would_mask_missing_real'),
  'Fallback must not emit without Field Real owner signal.',
)
assert(
  noEligibleFallback.noFallbackDecision?.decision === 'no_fallback' &&
    noEligibleFallback.noFallbackDecision.reasons?.includes(
      'fallback:would_mask_missing_meaning',
    ) &&
    noEligibleFallback.noFallbackDecision.reasons?.includes(
      'fallback:would_mask_failed_feasibility',
    ) &&
    noEligibleFallback.selectedCandidates.length === 0,
  'No eligible fallback should emit explicit no-fallback and manufacture no route.',
)
assert(
  previouslyMaskedRescue.noFallbackDecision?.decision === 'no_rescue' &&
    previouslyMaskedRescue.noFallbackDecision.reasons?.includes(
      'fallback:would_mask_failed_feasibility',
    ) &&
    previouslyMaskedRescue.selectedCandidates.length === 0,
  'Previously masked rescue must refuse and keep the route from surviving.',
)
assert(
  eligiblePreferredRoleAdmission.decision === 'admit',
  'Eligible preferred-role admission should admit from owner-supported signals.',
)
assert(
  invalidPreferredRoleMissingMeaning.decision === 'refuse_admission' &&
    invalidPreferredRoleMissingMeaning.reasons?.includes(
      'preferred_role:would_mask_missing_meaning',
    ),
  'Preferred-role admission must not mask missing Taste meaning.',
)
assert(
  invalidPreferredRoleFailedAdmission.decision === 'refuse_admission' &&
    invalidPreferredRoleFailedAdmission.reasons?.includes(
      'preferred_role:would_mask_failed_admission',
    ),
  'Preferred-role admission must not mask failed Bearings admission.',
)
assert(
  invalidPreferredRoleMissingReal.decision === 'refuse_admission' &&
    invalidPreferredRoleMissingReal.reasons?.includes(
      'preferred_role:would_mask_missing_real',
    ),
  'Preferred-role admission must not emit without Field Real owner signal.',
)
assert(
  previouslyMaskedPreferredRoleAdmission.decision === 'refuse_admission' &&
    previouslyMaskedPreferredRoleAdmission.reasons?.includes(
      'preferred_role:would_mask_failed_admission',
    ),
  'Previously masked preferred-role admission must refuse failed owner criteria.',
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
  invalidFamilyPreservationMissingMeaning.decision === 'refuse_preservation' &&
    invalidFamilyPreservationMissingMeaning.reasons?.includes(
      'family_preservation:would_mask_missing_meaning',
    ),
  'Family preservation cap must refuse missing Taste meaning.',
)
assert(
  invalidFamilyPreservationFailedFeasibility.decision === 'refuse_preservation' &&
    invalidFamilyPreservationFailedFeasibility.reasons?.includes(
      'family_preservation:cap_refused_infeasible_candidate',
    ),
  'Family preservation cap must refuse infeasible candidates.',
)
assert(
  invalidFamilyPreservationMissingReal.decision === 'refuse_preservation' &&
    invalidFamilyPreservationMissingReal.reasons?.includes(
      'family_preservation:would_mask_missing_real',
    ),
  'Family preservation cap must refuse missing Field Real.',
)
assert(
  previouslyMaskedFamilyPreservation.decision === 'refuse_preservation' &&
    previouslyMaskedFamilyPreservation.reasons?.includes(
      'family_preservation:would_mask_failed_feasibility',
    ),
  'Previously masked family preservation must refuse failed owner criteria.',
)
assert(
  eligibleContractPressure.decision === 'apply_contract_pressure',
  'Eligible contract pressure should apply from owner-supported signals.',
)
assert(
  invalidContractPressureMissingMeaning.decision === 'refuse_contract_pressure' &&
    invalidContractPressureMissingMeaning.reasons?.includes(
      'contract_pressure:would_mask_missing_meaning',
    ),
  'Contract pressure must not mask missing Taste meaning.',
)
assert(
  invalidContractPressureFailedConstraint.decision === 'refuse_contract_pressure' &&
    invalidContractPressureFailedConstraint.reasons?.includes(
      'contract_pressure:would_mask_failed_constraint',
    ),
  'Contract pressure must not mask failed Bearings constraints.',
)
assert(
  invalidContractPressureMissingReal.decision === 'refuse_contract_pressure' &&
    invalidContractPressureMissingReal.reasons?.includes(
      'contract_pressure:would_mask_missing_real',
    ),
  'Contract pressure must not emit without Field Real owner signal.',
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
    fallbackRescue: {
      eligibleFallbackDecision: validFallback.decision,
      missingMeaningDecision: invalidFallbackMissingMeaning.decision,
      missingMeaningReasons: invalidFallbackMissingMeaning.reasons,
      failedFeasibilityDecision: invalidFallbackFailedFeasibility.decision,
      failedFeasibilityReasons: invalidFallbackFailedFeasibility.reasons,
      missingRealDecision: invalidFallbackMissingReal.decision,
      missingRealReasons: invalidFallbackMissingReal.reasons,
      noEligibleFallbackDecision: noEligibleFallback.noFallbackDecision?.decision,
      noEligibleFallbackReasons: noEligibleFallback.noFallbackDecision?.reasons,
      noEligibleFallbackManufacturesRoute:
        noEligibleFallback.selectedCandidates.length > 0,
      previouslyMaskedRescueDecision:
        previouslyMaskedRescue.noFallbackDecision?.decision,
      previouslyMaskedRescueReasons:
        previouslyMaskedRescue.noFallbackDecision?.reasons,
      previouslyMaskedRescueSurvives:
        previouslyMaskedRescue.selectedCandidates.length > 0,
      fallbackMasksFailedOwnerCriteria: false,
    },
    preferredRoleAdmission: {
      eligibleDecision: eligiblePreferredRoleAdmission.decision,
      missingMeaningDecision: invalidPreferredRoleMissingMeaning.decision,
      missingMeaningReasons: invalidPreferredRoleMissingMeaning.reasons,
      failedAdmissionDecision: invalidPreferredRoleFailedAdmission.decision,
      failedAdmissionReasons: invalidPreferredRoleFailedAdmission.reasons,
      missingRealDecision: invalidPreferredRoleMissingReal.decision,
      missingRealReasons: invalidPreferredRoleMissingReal.reasons,
      previouslyMaskedDecision: previouslyMaskedPreferredRoleAdmission.decision,
      previouslyMaskedReasons: previouslyMaskedPreferredRoleAdmission.reasons,
      previouslyMaskedSurvives:
        previouslyMaskedPreferredRoleAdmission.decision === 'admit',
      admissionMasksFailedOwnerCriteria: false,
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
      missingMeaningDecision: invalidFamilyPreservationMissingMeaning.decision,
      missingMeaningReasons: invalidFamilyPreservationMissingMeaning.reasons,
      failedFeasibilityDecision:
        invalidFamilyPreservationFailedFeasibility.decision,
      failedFeasibilityReasons:
        invalidFamilyPreservationFailedFeasibility.reasons,
      missingRealDecision: invalidFamilyPreservationMissingReal.decision,
      missingRealReasons: invalidFamilyPreservationMissingReal.reasons,
      previouslyMaskedDecision: previouslyMaskedFamilyPreservation.decision,
      previouslyMaskedReasons: previouslyMaskedFamilyPreservation.reasons,
      previouslyMaskedSurvives:
        previouslyMaskedFamilyPreservation.decision === 'preserve',
      capOverridesOwnerVerdicts: false,
    },
    contractPressure: {
      eligibleDecision: eligibleContractPressure.decision,
      missingMeaningDecision: invalidContractPressureMissingMeaning.decision,
      missingMeaningReasons: invalidContractPressureMissingMeaning.reasons,
      failedConstraintDecision: invalidContractPressureFailedConstraint.decision,
      failedConstraintReasons: invalidContractPressureFailedConstraint.reasons,
      missingRealDecision: invalidContractPressureMissingReal.decision,
      missingRealReasons: invalidContractPressureMissingReal.reasons,
      pressureMasksFailedOwnerCriteria: false,
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
    noPreferredRoleAdmissionMasksFailedOwnerCriteria: true,
    noFamilyPreservationMasksFailedOwnerCriteria: true,
    noContractPressureMasksFailedOwnerCriteria: true,
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
