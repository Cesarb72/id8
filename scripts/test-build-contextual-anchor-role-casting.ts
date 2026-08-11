import {
  buildBuildCardTruthModel,
  type BuildApprovedPayloadReference,
} from '../src/app/services/canonicalPublicRouteTruthService.ts'
import { evaluateBuildCandidateAdmission } from '../src/app/services/buildCandidateAdmission/buildCandidateAdmissionService.ts'
import { buildAnchorTruthContract } from '../src/domain/artifacts/buildAnchorTruthContract.ts'
import { buildCanonicalInterpretationBundle } from '../src/domain/interpretation/buildCanonicalInterpretationBundle.ts'
import type { GeneratePlanResult } from '../src/domain/runGeneratePlan.ts'
import type { ArcCandidate, ScoredVenue } from '../src/domain/types/arc.ts'
import type {
  AnchorRole,
  IntentInput,
  IntentProfile,
  RouteShapeContract,
} from '../src/domain/types/intent.ts'
import type { Itinerary, ItineraryStop, UserStopRole } from '../src/domain/types/itinerary.ts'
import type { RuntimeRouteArtifact, RuntimeRouteStop } from '../src/domain/artifacts/runtimeRouteArtifact.ts'
import type { Venue } from '../src/domain/types/venue.ts'
import {
  BuildAnchorRoleCastingSelectionError,
  buildContractDrivenBuildWaypointPlan,
} from '../src/domain/waypoint/buildContractDrivenBuildWaypointPlan.ts'
import {
  buildApplicationConciergeIntent,
  projectConciergeIntentToIntentInput,
} from '../src/app/concierge/conciergeIntentAdapter.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const originalFetch = globalThis.fetch
let fetchAttemptCount = 0

globalThis.fetch = (async (input) => {
  fetchAttemptCount += 1
  throw new Error(`Network/fetch is forbidden in contextual role-casting proof: ${String(input)}`)
}) as typeof fetch

const selectedDirection = {
  id: 'downtown-paper-plane',
  label: 'Downtown Paper Plane',
  subtitle: 'Cocktail anchor with compact support',
  pocketId: 'downtown',
  pocketLabel: 'Downtown',
  archetype: 'cocktail_anchor',
  identity: 'lively_downtown_anchor',
  experienceFamily: 'nightlife',
  familyConfidence: 0.9,
  cluster: 'lively',
  greatStopSignal: null,
} as any

const selectedDirectionContext = {
  selectedDirectionId: 'downtown-paper-plane',
  selectedPocketId: 'downtown',
  directionId: 'downtown-paper-plane',
  pocketId: 'downtown',
  identity: 'lively_downtown_anchor',
} as any

try {
  const recoveryPassProof = await runSoftFeasibleRecoveryPassProof()
  const missingRoleProof = await runMissingRoleContextualCastingProof()
  const integratedMissingRoleRecoveryProof = await runMissingRoleRecoveryIntegrationProof()
  const explicitRoleProof = await runExplicitRoleProtectionProof()
  const candidateDefaultedProof = runCandidateDefaultedProof()
  const zeroWinnerProof = await runZeroWinnerProof()

  assert(fetchAttemptCount === 0, 'Contextual role-casting proof must not attempt fetch/network.')

  process.stdout.write('build contextual anchor role casting proof: passed\n')
  process.stdout.write(
    `${JSON.stringify(
      {
        recoveryPassProof,
        missingRoleProof,
        integratedMissingRoleRecoveryProof,
        explicitRoleProof,
        candidateDefaultedProof,
        zeroWinnerProof,
        fetchAttemptCount,
        providerAttemptCount: 0,
      },
      null,
      2,
    )}\n`,
  )
} finally {
  globalThis.fetch = originalFetch
}

async function runMissingRoleContextualCastingProof(): Promise<Record<string, unknown>> {
  const conciergeIntent = buildApplicationConciergeIntent({
    mode: 'build',
    persona: 'friends',
    primaryVibe: 'lively',
    city: 'San Jose',
    anchor: {
      venueId: 'sj-paper-plane',
    },
    anchorDisplayName: 'Paper Plane',
    anchorRoleResolutionSource: 'missing',
  })
  assert(
    conciergeIntent.anchorPosture.roleHint === undefined,
    'Missing Build anchor role must remain missing before Waypoint casting.',
  )
  const canonicalInterpretationBundle = buildCanonicalInterpretationBundle({
    conciergeIntent,
    selectedDirectionContext,
    interpretationSource: 'test.move3.contextualRoleCasting',
  })
  const plannerRolesSeen: string[] = []
  const plan = await buildContractDrivenBuildWaypointPlan({
    ...buildInputFixture({
      conciergeIntent,
      canonicalInterpretationBundle,
      anchor: { venueId: 'sj-paper-plane', roleResolutionSource: 'missing' } as any,
      buildAnchorTruthContract: buildAnchorTruthContract({
        identity: {
          venueId: 'sj-paper-plane',
          displayName: 'Paper Plane',
        },
        role: {
          role: null,
          roleResolutionSource: 'missing',
        },
      }),
      requiredBuildAnchor: null,
    }),
    runPlanBuild: async (input) => {
      plannerRolesSeen.push(input.anchor?.role ?? 'missing')
      return buildGeneratePlanResult(input)
    },
  })
  const casting = plan.diagnostics.buildAnchorRoleCasting
  assert(casting?.owner === 'waypoint', 'Waypoint must own contextual role-casting diagnostics.')
  assert(
    plannerRolesSeen.join('|') === 'start|highlight|windDown',
    `Missing role must attempt Start/Highlight/Wind-down without defaulting to Highlight; saw ${plannerRolesSeen.join('|')}.`,
  )
  assert(casting.selectedRole === 'highlight', 'Paper Plane fixture should contextually select Highlight.')
  assert(
    casting.attemptedOutcomes.length === 3 &&
      casting.attemptedOutcomes.every((outcome) => outcome.status === 'completed'),
    'All three contextual role variants must reach the selector as completed outcomes.',
  )
  assert(
    plan.nextFinalRoute.stops.some(
      (stop) => stop.role === 'highlight' && stop.venueId === 'sj-paper-plane',
    ),
    'Selected contextual cast route must preserve Paper Plane in the selected role.',
  )
  assert(
    plan.postParityContractEntryArtifact.anchorRole === 'highlight',
    'Generated ContractEntryArtifact must carry selected-route inferred role truth.',
  )
  assert(
    plan.diagnostics.greatStopGatePostRepairVerification?.status === 'PASS',
    'Contextual cast winner must pass normal post-repair Great Stop.',
  )
  return {
    plannerRolesSeen,
    selectedRole: casting.selectedRole,
    attemptedOutcomes: casting.attemptedOutcomes,
    finalRoute: plan.nextFinalRoute.stops.map((stop) => `${stop.role}:${stop.venueId}`),
    reviewRouteArtifactRole: plan.postParityContractEntryArtifact.anchorRole,
    greatStopStatus: plan.diagnostics.greatStopGatePostRepairVerification?.status,
  }
}

async function runSoftFeasibleRecoveryPassProof(): Promise<Record<string, unknown>> {
  const conciergeIntent = buildApplicationConciergeIntent({
    mode: 'build',
    persona: 'friends',
    primaryVibe: 'lively',
    city: 'San Jose',
    anchor: {
      venueId: 'sj-paper-plane',
      role: 'highlight',
    },
    anchorDisplayName: 'Paper Plane',
    anchorRoleResolutionSource: 'explicit',
    buildSoftFeasibleRecovery: {
      action: 'take_bigger_night',
      originatingMovementProfile: {
        radius: 'balanced',
        maxTransitionMinutes: 18,
        neighborhoodContinuity: 'preferred',
      },
    },
  })
  const canonicalInterpretationBundle = buildCanonicalInterpretationBundle({
    conciergeIntent,
    selectedDirectionContext,
    interpretationSource: 'test.move3.softFeasibleRecoveryPass',
  })
  const routeShapeAttemptMinutes: number[] = []
  const anchorContract = buildAnchorTruthContract({
    identity: {
      venueId: 'sj-paper-plane',
      displayName: 'Paper Plane',
    },
    role: {
      role: 'highlight',
      roleResolutionSource: 'explicit',
    },
  })
  const plan = await buildContractDrivenBuildWaypointPlan({
    ...buildInputFixture({
      conciergeIntent,
      canonicalInterpretationBundle,
      anchor: { venueId: 'sj-paper-plane', role: 'highlight', roleResolutionSource: 'explicit' } as any,
      requiredBuildAnchor: {
        venueId: 'sj-paper-plane',
        role: 'highlight',
      },
      buildAnchorTruthContract: anchorContract,
    }),
    runPlanBuild: async (input, options) => {
      const maxTransitionMinutes =
        options?.routeShapeContract?.movementProfile.maxTransitionMinutes ?? 0
      routeShapeAttemptMinutes.push(maxTransitionMinutes)
      return buildGeneratePlanResult(input, {
        forcePlaceRightFailure: maxTransitionMinutes < 32,
      })
    },
  })
  assert(
    routeShapeAttemptMinutes.join('|') === '24|32',
    `Recovery should freshly evaluate ordered Bigger attempts and stop on first PASS; saw ${routeShapeAttemptMinutes.join('|')}.`,
  )
  assert(
    plan.diagnostics.greatStopGatePostRepairVerification?.status === 'PASS',
    'Recovery winner must pass normal post-repair Great Stop.',
  )
  assert(
    plan.nextFinalRoute.stops.some(
      (stop) => stop.role === 'highlight' && stop.venueId === 'sj-paper-plane',
    ),
    'Recovery winner must preserve the hard required anchor.',
  )
  const admission = evaluateBuildCandidateAdmission({
    mode: 'build',
    anchorContract,
    contractEntryArtifact: plan.postParityContractEntryArtifact,
    runtimeRouteArtifact: plan.nextFinalRoute,
    buildParked: {
      providerSelectionAllowed: true,
      providerMergedIntoVisiblePool: true,
    },
  })
  assert(admission.admitted, 'Recovery winner must pass Build anchor admission.')
  const approvedPayload: BuildApprovedPayloadReference = {
    artifactId: plan.postParityContractEntryArtifact.id,
    selectedDirectionId: plan.nextFinalRoute.selectedDirectionId,
    finalRoute: plan.nextFinalRoute,
    selectedClusterConfirmation: 'Generated recovery route is ready for Review.',
    itinerary: plan.canonicalItinerary,
    sourceKind: 'static',
  }
  const truth = buildBuildCardTruthModel({
    artifact: plan.postParityContractEntryArtifact,
    selectedCandidateArtifact: null,
    selectedArtifactId: plan.postParityContractEntryArtifact.id,
    selectedDirectionId: plan.postParityContractEntryArtifact.selection.directionId,
    approvedPayload,
    candidateAdmission: admission,
    anchorTruthContract: anchorContract,
    selectedAnchorRequiredRole: 'highlight',
    sourceKind: 'static',
    routeReplacementAdmitted: false,
    buildProviderSelectionAllowed: true,
    buildProviderMergedIntoVisiblePool: true,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert(truth.reviewEligible, 'Recovery winner must reach Review through normal Build truth.')
  assert(
    truth.diagnostics.approvedPayloadArtifactId === plan.postParityContractEntryArtifact.id,
    'Review truth must bind to the exact passing generated artifact.',
  )
  return {
    action: 'take_bigger_night',
    routeShapeAttemptMinutes,
    greatStopStatus: plan.diagnostics.greatStopGatePostRepairVerification?.status,
    finalRoute: plan.nextFinalRoute.stops.map((stop) => `${stop.role}:${stop.venueId}`),
    reviewEligible: truth.reviewEligible,
    approvedPayloadArtifactId: truth.diagnostics.approvedPayloadArtifactId,
    generatedArtifactId: plan.postParityContractEntryArtifact.id,
  }
}

async function runMissingRoleRecoveryIntegrationProof(): Promise<Record<string, unknown>> {
  const conciergeIntent = buildApplicationConciergeIntent({
    mode: 'build',
    persona: 'friends',
    primaryVibe: 'lively',
    city: 'San Jose',
    anchor: {
      venueId: 'sj-paper-plane',
    },
    anchorDisplayName: 'Paper Plane',
    anchorRoleResolutionSource: 'missing',
    buildSoftFeasibleRecovery: {
      action: 'take_bigger_night',
      originatingMovementProfile: {
        radius: 'balanced',
        maxTransitionMinutes: 18,
        neighborhoodContinuity: 'preferred',
      },
    },
  })
  const canonicalInterpretationBundle = buildCanonicalInterpretationBundle({
    conciergeIntent,
    selectedDirectionContext,
    interpretationSource: 'test.move3.integratedMissingRoleRecovery',
  })
  const routeShapeAttempts: string[] = []
  const missingAnchorContract = buildAnchorTruthContract({
    identity: {
      venueId: 'sj-paper-plane',
      displayName: 'Paper Plane',
    },
    role: {
      role: null,
      roleResolutionSource: 'missing',
    },
  })
  const plan = await buildContractDrivenBuildWaypointPlan({
    ...buildInputFixture({
      conciergeIntent,
      canonicalInterpretationBundle,
      anchor: { venueId: 'sj-paper-plane', roleResolutionSource: 'missing' } as any,
      requiredBuildAnchor: null,
      buildAnchorTruthContract: missingAnchorContract,
    }),
    runPlanBuild: async (input, options) => {
      const maxTransitionMinutes =
        options?.routeShapeContract?.movementProfile.maxTransitionMinutes ?? 0
      routeShapeAttempts.push(`${input.anchor?.role ?? 'missing'}:${maxTransitionMinutes}`)
      return buildGeneratePlanResult(input, {
        forcePlaceRightFailure: maxTransitionMinutes < 32,
      })
    },
  })
  const casting = plan.diagnostics.buildAnchorRoleCasting
  assert(casting?.owner === 'waypoint', 'Integrated proof must use Waypoint contextual casting.')
  assert(
    casting.selectedRole === 'highlight',
    'Integrated missing-role recovery should contextually select Highlight for Paper Plane.',
  )
  assert(
    plan.diagnostics.greatStopGatePostRepairVerification?.status === 'PASS',
    'Integrated missing-role recovery winner must pass Great Stop.',
  )
  const selectedRoleContract = buildAnchorTruthContract({
    identity: {
      venueId: 'sj-paper-plane',
      displayName: 'Paper Plane',
    },
    role: {
      role: casting.selectedRole,
      roleResolutionSource: 'inferred',
    },
  })
  const admission = evaluateBuildCandidateAdmission({
    mode: 'build',
    anchorContract: selectedRoleContract,
    contractEntryArtifact: plan.postParityContractEntryArtifact,
    runtimeRouteArtifact: plan.nextFinalRoute,
    buildParked: {
      providerSelectionAllowed: true,
      providerMergedIntoVisiblePool: true,
    },
  })
  assert(admission.admitted, 'Integrated recovery winner must pass Build admission.')
  const approvedPayload: BuildApprovedPayloadReference = {
    artifactId: plan.postParityContractEntryArtifact.id,
    selectedDirectionId: plan.nextFinalRoute.selectedDirectionId,
    finalRoute: plan.nextFinalRoute,
    selectedClusterConfirmation: 'Integrated contextual recovery route is ready for Review.',
    itinerary: plan.canonicalItinerary,
    sourceKind: 'static',
  }
  const truth = buildBuildCardTruthModel({
    artifact: plan.postParityContractEntryArtifact,
    selectedCandidateArtifact: null,
    selectedArtifactId: plan.postParityContractEntryArtifact.id,
    selectedDirectionId: plan.postParityContractEntryArtifact.selection.directionId,
    approvedPayload,
    candidateAdmission: admission,
    anchorTruthContract: selectedRoleContract,
    selectedAnchorRequiredRole: casting.selectedRole,
    sourceKind: 'static',
    routeReplacementAdmitted: false,
    buildProviderSelectionAllowed: true,
    buildProviderMergedIntoVisiblePool: true,
    activeRole: 'start',
    fallbackCity: 'San Jose',
  })
  assert(truth.reviewEligible, 'Integrated contextual recovery must reach Review eligibility.')
  assert(
    truth.diagnostics.lockInputAvailable,
    'Integrated contextual recovery must provide Lock input.',
  )
  assert(
    truth.diagnostics.approvedPayloadArtifactId === plan.postParityContractEntryArtifact.id,
    'Integrated Review truth must bind to the exact generated artifact.',
  )
  return {
    routeShapeAttempts,
    selectedRole: casting.selectedRole,
    selectorRule: casting.selectorRule,
    greatStopStatus: plan.diagnostics.greatStopGatePostRepairVerification?.status,
    finalRoute: plan.nextFinalRoute.stops.map((stop) => `${stop.role}:${stop.venueId}`),
    reviewEligible: truth.reviewEligible,
    lockInputAvailable: truth.diagnostics.lockInputAvailable,
    routeAuthorityStatus: truth.diagnostics.routeAuthorityStatus,
    approvedPayloadArtifactId: truth.diagnostics.approvedPayloadArtifactId,
    generatedArtifactId: plan.postParityContractEntryArtifact.id,
  }
}

async function runExplicitRoleProtectionProof(): Promise<Record<string, unknown>> {
  const conciergeIntent = buildApplicationConciergeIntent({
    mode: 'build',
    persona: 'friends',
    primaryVibe: 'lively',
    city: 'San Jose',
    anchor: {
      venueId: 'sj-paper-plane',
      role: 'windDown',
    },
    anchorDisplayName: 'Paper Plane',
    anchorRoleResolutionSource: 'explicit',
  })
  const canonicalInterpretationBundle = buildCanonicalInterpretationBundle({
    conciergeIntent,
    selectedDirectionContext,
    interpretationSource: 'test.move3.explicitRoleProtection',
  })
  const plannerRolesSeen: string[] = []
  const plan = await buildContractDrivenBuildWaypointPlan({
    ...buildInputFixture({
      conciergeIntent,
      canonicalInterpretationBundle,
      anchor: { venueId: 'sj-paper-plane', role: 'windDown', roleResolutionSource: 'explicit' } as any,
      requiredBuildAnchor: {
        venueId: 'sj-paper-plane',
        role: 'windDown',
      },
      buildAnchorTruthContract: buildAnchorTruthContract({
        identity: {
          venueId: 'sj-paper-plane',
          displayName: 'Paper Plane',
        },
        role: {
          role: 'windDown',
          roleResolutionSource: 'explicit',
        },
      }),
    }),
    runPlanBuild: async (input) => {
      plannerRolesSeen.push(input.anchor?.role ?? 'missing')
      return buildGeneratePlanResult(input)
    },
  })
  assert(
    plannerRolesSeen.join('|') === 'windDown',
    `Explicit role must run exactly once without recast; saw ${plannerRolesSeen.join('|')}.`,
  )
  assert(
    !plan.diagnostics.buildAnchorRoleCasting,
    'Explicit user-authored role must not enter contextual casting.',
  )
  assert(
    plan.nextFinalRoute.stops.some(
      (stop) => stop.role === 'windDown' && stop.venueId === 'sj-paper-plane',
    ),
    'Explicit windDown role must remain hard in the final route.',
  )
  return {
    plannerRolesSeen,
    finalRoute: plan.nextFinalRoute.stops.map((stop) => `${stop.role}:${stop.venueId}`),
    castingDiagnosticsPresent: Boolean(plan.diagnostics.buildAnchorRoleCasting),
  }
}

function runCandidateDefaultedProof(): Record<string, unknown> {
  const contract = buildAnchorTruthContract({
    identity: {
      venueId: 'sj-paper-plane',
      displayName: 'Paper Plane',
    },
    role: {
      role: 'highlight',
      roleResolutionSource: 'defaulted_highlight',
    },
  })
  assert(
    contract.requiredRole === undefined,
    'Candidate-defaulted Highlight must not become a required/authored Build anchor role.',
  )
  assert(
    contract.candidateRole === 'highlight' &&
      contract.diagnostics.reasons.includes('anchor_role_defaulted_highlight'),
    'Candidate-defaulted Highlight must remain warning/candidate evidence.',
  )
  return {
    requiredRole: contract.requiredRole ?? null,
    candidateRole: contract.candidateRole ?? null,
    roleResolutionSource: contract.roleResolutionSource,
    reasons: contract.diagnostics.reasons,
  }
}

async function runZeroWinnerProof(): Promise<Record<string, unknown>> {
  const conciergeIntent = buildApplicationConciergeIntent({
    mode: 'build',
    persona: 'friends',
    primaryVibe: 'lively',
    city: 'San Jose',
    anchor: {
      venueId: 'sj-paper-plane',
    },
    anchorDisplayName: 'Paper Plane',
    anchorRoleResolutionSource: 'missing',
  })
  const canonicalInterpretationBundle = buildCanonicalInterpretationBundle({
    conciergeIntent,
    selectedDirectionContext,
    interpretationSource: 'test.move3.zeroWinner',
  })
  try {
    await buildContractDrivenBuildWaypointPlan({
      ...buildInputFixture({
        conciergeIntent,
        canonicalInterpretationBundle,
        anchor: { venueId: 'sj-paper-plane', roleResolutionSource: 'missing' } as any,
        buildAnchorTruthContract: buildAnchorTruthContract({
          identity: {
            venueId: 'sj-paper-plane',
            displayName: 'Paper Plane',
          },
          role: {
            role: null,
            roleResolutionSource: 'missing',
          },
        }),
        requiredBuildAnchor: null,
      }),
      runPlanBuild: async (input) => {
        throw new Error(`unviable_cast:${input.anchor?.role ?? 'missing'}`)
      },
    })
  } catch (error) {
    assert(
      error instanceof BuildAnchorRoleCastingSelectionError,
      'Zero-winner contextual casting must terminate with the local Waypoint selection error.',
    )
    assert(
      error.attemptedOutcomes.length === 3 &&
        error.attemptedOutcomes.every((outcome) => outcome.status === 'rejected'),
      'Zero-winner contextual casting must report all three rejected outcomes.',
    )
    assert(
      error.attemptedOutcomes
        .map((outcome) => outcome.role)
        .join('|') === 'start|highlight|windDown',
      'Zero-winner contextual casting must not fall back to Highlight.',
    )
    return {
      errorName: error.name,
      attemptedOutcomes: error.attemptedOutcomes,
    }
  }
  throw new Error('Zero-winner contextual casting unexpectedly produced a route.')
}

function buildInputFixture(params: {
  conciergeIntent: ReturnType<typeof buildApplicationConciergeIntent>
  canonicalInterpretationBundle: ReturnType<typeof buildCanonicalInterpretationBundle>
  anchor: IntentInput['anchor']
  requiredBuildAnchor: Parameters<typeof buildContractDrivenBuildWaypointPlan>[0]['requiredBuildAnchor']
  buildAnchorTruthContract: Parameters<typeof buildContractDrivenBuildWaypointPlan>[0]['buildAnchorTruthContract']
}): Parameters<typeof buildContractDrivenBuildWaypointPlan>[0] {
  return {
    conciergeIntent: params.conciergeIntent,
    canonicalInterpretationBundle: params.canonicalInterpretationBundle,
    mode: 'build',
    city: 'San Jose',
    district: 'Downtown',
    distanceMode: 'nearby',
    selectedDirectionContext,
    selectedDirectionContextForValidation: selectedDirectionContext,
    selectedDirectionContract: selectedDirection,
    selectedDirectionContractForValidation: selectedDirection,
    selectedDirectionId: selectedDirection.id,
    expectedDirectionIdentity: 'lively_downtown_anchor' as any,
    discoveryPreferences: [
      { venueId: 'sj-petiscos', role: 'start' },
      { venueId: 'sj-paper-plane', role: 'highlight' },
      { venueId: 'sj-hedley-club-lounge', role: 'windDown' },
    ],
    anchor: params.anchor,
    sourceMode: 'static',
    sourceModeOverrideApplied: true,
    persona: 'friends',
    vibe: 'lively',
    requiredBuildAnchor: params.requiredBuildAnchor,
    buildAnchorTruthContract: params.buildAnchorTruthContract,
    greatStopGateLocationClass: 'L1 Dense',
    postPlannerDependencies: {
      buildPassthroughStrongCurationTastePass: ({ itinerary, selectedArc, scoredVenues }) =>
        buildStrongCurationPassFixture({ itinerary, selectedArc, scoredVenues }),
      applyStrongCurationTastePass: ({ itinerary, selectedArc, scoredVenues }) =>
        buildStrongCurationPassFixture({ itinerary, selectedArc, scoredVenues }),
      enforceFullStopRealityContract: async ({ itinerary, selectedArc, scoredVenues }) => ({
        itinerary,
        selectedArc,
        scoredVenues,
        canonicalStopByRole: buildCanonicalStopIdentityByRole(getRouteIdsByItinerary(itinerary)),
        rejectedStopRoles: [],
      }),
      applyCanonicalIdentityToItinerary: (itinerary) => itinerary,
      assessDirectionContractBuildability: () =>
        ({
          expectedDirectionIdentity: 'lively_downtown_anchor',
          contractBuildabilityStatus: 'sufficient',
          missingRoleForContract: null,
          candidatePoolSufficiencyByRole: {
            start: 1,
            highlight: 1,
            windDown: 1,
          },
        }) as any,
      validateDirectionRouteContract: () =>
        ({
          valid: true,
          validatorMode: 'build',
          generationDriftReason: null,
          directionAlignmentScore: 1,
          contractBuildabilityStatus: 'sufficient',
          candidatePoolSufficiencyByRole: {
            start: 1,
            highlight: 1,
            windDown: 1,
          },
          expectedDirectionIdentity: 'lively_downtown_anchor',
          observedDirectionIdentity: 'lively_downtown_anchor',
          fallbackApplied: false,
          lowAlignment: false,
          hardAlignmentFailure: false,
          materialAlignmentFailure: false,
          severeGreatStopRisk: false,
          missingRoleForContract: null,
          thinPoolRelaxationTrace: {
            validationOutcome: 'accepted_without_relaxation',
          },
        }) as any,
      resolveRouteCopy: ({ canonicalItinerary }) => ({
        routeHeadline: 'Paper Plane Night',
        routeSummary: canonicalItinerary.stops.map((stop) => stop.venueName).join(' to '),
      }),
    },
  }
}

function buildGeneratePlanResult(
  input: IntentInput,
  options?: {
    forcePlaceRightFailure?: boolean
  },
): GeneratePlanResult {
  const anchorRole = (input.anchor?.role ?? 'highlight') as AnchorRole
  const routeIds = getRouteIdsForAnchorRole(anchorRole)
  const intentProfile: IntentProfile = {
    crew: 'socialite',
    persona: input.persona,
    personaSource: 'explicit',
    primaryAnchor: input.primaryVibe ?? 'lively',
    city: input.city,
    district: input.district,
    distanceMode: input.distanceMode,
    prefersHiddenGems: false,
    refinementModes: input.refinementModes ?? [],
    mode: 'build',
    planningMode: 'user-led',
    anchor: {
      venueId: input.anchor?.venueId ?? 'sj-paper-plane',
      role: anchorRole,
    },
    discoveryPreferences: input.discoveryPreferences,
    selectedDirectionContext: input.selectedDirectionContext,
  }
  const itinerary = buildItinerary(routeIds)
  const selectedArc = buildSelectedArc(routeIds, {
    forcePlaceRightFailure: options?.forcePlaceRightFailure === true,
  })
  const scoredVenues = selectedArc.stops.map((stop) => stop.scoredVenue)
  const trace = {
    intent: intentProfile,
    lens: {
      tone: 'lively',
      discoveryBias: 'reliable',
      movementTolerance: 'nearby',
    },
    rankingEngine: 'move3-contextual-role-proof',
    selectedArcId: selectedArc.id,
    selectedDistrictId: 'downtown',
    selectedDistrictLabel: 'Downtown',
    selectedDistrictReason: 'Contract-driven downtown Paper Plane route.',
    retrievalDiagnostics: {
      liveSource: {
        effectiveMode: 'curated',
        provider: 'static-corpus',
        liveFetchAttempted: false,
        liveFetchSucceeded: false,
        countsBySource: {
          curated: scoredVenues.length,
          live: 0,
        },
        liveQueryLabelsUsed: [],
      },
    },
    stopExplainability: {
      highlight: {
        selectedBecause: 'Paper Plane is the selected contextual Build anchor.',
      },
    },
    canonicalInterpretationIngress: {
      supplied: true,
      plannerIntentAuthoritative: false,
    },
  } as any
  return {
    itinerary,
    selectedArc,
    scoredVenues,
    contractEntryArtifact: buildArtifact({
      id: `generated_contract_driven_${anchorRole}`,
      sourceOpportunityId: `generated_contract_driven_${anchorRole}`,
      routeIds,
      anchorRole,
      routeSummary: itinerary.stops.map((stop) => stop.venueName).join(' to '),
    }),
    intentProfile,
    lens: {
      tone: 'lively',
      discoveryBias: 'reliable',
      movementTolerance: 'nearby',
    } as any,
    trace,
  }
}

function getRouteIdsForAnchorRole(role: AnchorRole): Record<'start' | 'highlight' | 'windDown', string> {
  return {
    start: role === 'start' ? 'sj-paper-plane' : 'sj-petiscos',
    highlight: role === 'highlight' ? 'sj-paper-plane' : 'sj-good-karma',
    windDown: role === 'windDown' ? 'sj-paper-plane' : 'sj-hedley-club-lounge',
  }
}

function getRouteIdsByItinerary(itinerary: Itinerary): Record<'start' | 'highlight' | 'windDown', string> {
  return {
    start: itinerary.stops.find((stop) => stop.role === 'start')?.venueId ?? 'missing-start',
    highlight:
      itinerary.stops.find((stop) => stop.role === 'highlight')?.venueId ?? 'missing-highlight',
    windDown:
      itinerary.stops.find((stop) => stop.role === 'windDown')?.venueId ?? 'missing-windDown',
  }
}

function buildStrongCurationPassFixture(params: {
  itinerary: Itinerary
  selectedArc: ArcCandidate
  scoredVenues: ScoredVenue[]
}) {
  return {
    itinerary: params.itinerary,
    selectedArc: params.selectedArc,
    scoredVenues: params.scoredVenues,
    qualificationByCandidateId: {},
    personaVibeTasteBiasSummary: 'local contextual role proof',
    thinPoolHighlightFallbackApplied: false,
    highlightPoolCountBefore: 2,
    highlightPoolCountAfter: 2,
    rolePoolCountByRoleBefore: {
      start: 2,
      highlight: 2,
      windDown: 2,
    },
    rolePoolCountByRoleAfter: {
      start: 2,
      highlight: 2,
      windDown: 2,
    },
    signatureHighlightShortlistCount: 1,
    signatureHighlightShortlistIds: ['sj-paper-plane'],
    highlightShortlistScoreSummary: 'sj-paper-plane:0.94',
    selectedHighlightFromShortlist: true,
    selectedHighlightShortlistRank: 1,
    fallbackToQualifiedHighlightPool: false,
    upstreamPoolSelectionApplied: false,
    postGenerationRepairCount: 0,
    rolePoolVenueIdsByRole: {
      start: ['sj-petiscos', 'sj-paper-plane'],
      highlight: ['sj-paper-plane', 'sj-good-karma'],
      windDown: ['sj-hedley-club-lounge', 'sj-paper-plane'],
    },
    rolePoolVenueIdsCombined: ['sj-petiscos', 'sj-paper-plane', 'sj-good-karma', 'sj-hedley-club-lounge'],
    thinPoolRelaxationTrace: {
      validationOutcome: 'accepted_without_relaxation',
    },
  }
}

function buildSelectedArc(
  routeIds: Record<'start' | 'highlight' | 'windDown', string>,
  options?: {
    forcePlaceRightFailure?: boolean
  },
): ArcCandidate {
  const stops = [
    { role: 'warmup' as const, scoredVenue: buildScoredVenue(routeIds.start) },
    { role: 'peak' as const, scoredVenue: buildScoredVenue(routeIds.highlight) },
    { role: 'cooldown' as const, scoredVenue: buildScoredVenue(routeIds.windDown) },
  ]
  return {
    id: `arc_${routeIds.start}_${routeIds.highlight}_${routeIds.windDown}`,
    stops,
    hasWildcard: false,
    totalScore: Number(
      (
        stops.reduce((sum, stop) => sum + stop.scoredVenue.roleScores[stop.role], 0) / stops.length
      ).toFixed(3),
    ),
    scoreBreakdown: {
      routeMomentVerdict: {
        strongMomentPresent: true,
        momentQualityNote: 'Strong selected highlight with clean support.',
        momentStrengthVerdict: {
          score: 0.88,
          reason: 'strong contextual highlight',
        },
        peakSuitability: {
          score: 0.9,
        },
        flatArcRisk: {
          level: 'none',
          penalty: 0,
          score: 0,
        },
        momentPreservationStatus: 'preserved',
      },
      localSupplySufficient: true,
    },
    spatial: {
      score: 0.96,
      homeClusterId: 'downtown-core',
      clusterEscapeCount: 0,
      repeatedClusterEscapeCount: 0,
      longTransitionCount: 0,
      transitions: [
        {
          fromVenueId: routeIds.start,
          toVenueId: routeIds.highlight,
          driveGap: options?.forcePlaceRightFailure ? 26 : 4,
          sameCluster: !options?.forcePlaceRightFailure,
          longTransition: options?.forcePlaceRightFailure === true,
          notes: [],
        },
        {
          fromVenueId: routeIds.highlight,
          toVenueId: routeIds.windDown,
          driveGap: options?.forcePlaceRightFailure ? 24 : 5,
          sameCluster: !options?.forcePlaceRightFailure,
          longTransition: options?.forcePlaceRightFailure === true,
          notes: [],
        },
      ],
      clusterAssignments: [
        {
          venueId: routeIds.start,
          clusterId: 'downtown-core',
          neighborhood: 'Downtown',
        },
        {
          venueId: routeIds.highlight,
          clusterId: options?.forcePlaceRightFailure ? 'midtown' : 'downtown-core',
          neighborhood: options?.forcePlaceRightFailure ? 'Midtown' : 'Downtown',
        },
        {
          venueId: routeIds.windDown,
          clusterId: options?.forcePlaceRightFailure ? 'willow-glen' : 'downtown-core',
          neighborhood: options?.forcePlaceRightFailure ? 'Willow Glen' : 'Downtown',
        },
      ],
    },
  } as unknown as ArcCandidate
}

function buildScoredVenue(venueId: string): ScoredVenue {
  const venue = buildVenue(venueId)
  const roleScores =
    venueId === 'sj-paper-plane'
      ? { warmup: 0.62, peak: 0.96, wildcard: 0.7, cooldown: 0.68 }
      : venueId === 'sj-petiscos'
        ? { warmup: 0.86, peak: 0.58, wildcard: 0.62, cooldown: 0.56 }
        : venueId === 'sj-hedley-club-lounge'
          ? { warmup: 0.58, peak: 0.66, wildcard: 0.62, cooldown: 0.88 }
          : { warmup: 0.76, peak: 0.82, wildcard: 0.66, cooldown: 0.62 }
  return {
    venue,
    candidateIdentity: {
      candidateId: `${venueId}:base`,
      baseVenueId: venueId,
      kind: 'base',
      traceLabel: `${venueId}:base`,
    },
    momentIdentity: {
      type: 'anchor',
      id: `${venueId}:moment`,
      label: venue.name,
    },
    fitBreakdown: {
      anchorFit: 0.9,
      crewFit: 0.9,
      proximityFit: 0.9,
      budgetFit: 0.9,
      uniquenessFit: 0.8,
      hiddenGemFit: 0.7,
    },
    fitScore: 0.86,
    hiddenGemScore: 0.5,
    lensCompatibility: 0.88,
    contextSpecificity: {
      overall: 0.82,
      personaSignal: 0.82,
      vibeSignal: 0.84,
      lensSignal: 0.8,
      byRole: roleScores,
    },
    dominanceControl: {
      universalityScore: 0.2,
      flaggedUniversal: false,
      byRole: {
        warmup: 0.2,
        peak: 0.2,
        wildcard: 0.2,
        cooldown: 0.2,
      },
    },
    roleContract: {} as any,
    stopShapeFit: {
      start: roleScores.warmup,
      highlight: roleScores.peak,
      surprise: roleScores.wildcard,
      windDown: roleScores.cooldown,
    },
    vibeAuthority: {} as any,
    highlightValidity: {} as any,
    roleScores,
    taste: {
      signals: {} as any,
      modeAlignment: {
        score: 0.86,
        penalty: 0,
        lane: venueId === 'sj-paper-plane' ? 'social' : venueId === 'sj-hedley-club-lounge' ? 'relaxed' : 'culinary',
        tier: 'strong',
        supportiveTagScore: 0.8,
        lanePriorityScore: 0.8,
      },
      fallbackPenalty: {
        signalScore: 0,
        appliedPenalty: 0,
        applied: false,
        strongerAlternativePresent: false,
        reason: 'none',
      },
      rolePoolInfluence: {
        warmup: {
          tasteBonus: 0,
          roleSuitabilityContribution: 0,
          momentContribution: 0,
          highlightPlausibilityBonus: 0,
          modeAlignmentContribution: 0,
          modeAlignmentPenalty: 0,
        },
        peak: {
          tasteBonus: 0,
          roleSuitabilityContribution: 0,
          momentContribution: 0,
          highlightPlausibilityBonus: 0,
          modeAlignmentContribution: 0,
          modeAlignmentPenalty: 0,
        },
        wildcard: {
          tasteBonus: 0,
          roleSuitabilityContribution: 0,
          momentContribution: 0,
          highlightPlausibilityBonus: 0,
          modeAlignmentContribution: 0,
          modeAlignmentPenalty: 0,
        },
        cooldown: {
          tasteBonus: 0,
          roleSuitabilityContribution: 0,
          momentContribution: 0,
          highlightPlausibilityBonus: 0,
          modeAlignmentContribution: 0,
          modeAlignmentPenalty: 0,
        },
      },
    },
  } as ScoredVenue
}

function buildVenue(id: string): Venue {
  const names: Record<string, string> = {
    'sj-paper-plane': 'Paper Plane',
    'sj-petiscos': 'Petiscos',
    'sj-good-karma': 'Good Karma',
    'sj-hedley-club-lounge': 'Hedley Club Lounge',
  }
  const category: Venue['category'] =
    id === 'sj-petiscos' || id === 'sj-good-karma'
      ? 'restaurant'
      : id === 'sj-hedley-club-lounge'
        ? 'bar'
        : 'bar'
  return {
    id,
    name: names[id] ?? id,
    city: 'San Jose',
    neighborhood: 'Downtown',
    driveMinutes: 4,
    category,
    subcategory: category === 'restaurant' ? 'dining' : 'cocktails',
    priceTier: '$$',
    tags: ['downtown', 'nightlife'],
    useCases: ['socialite'],
    vibeTags: ['lively'],
    energyLevel: id === 'sj-hedley-club-lounge' ? 0.42 : id === 'sj-paper-plane' ? 0.82 : 0.58,
    socialDensity: 0.72,
    uniquenessScore: 0.74,
    distinctivenessScore: 0.76,
    underexposureScore: 0.48,
    shareabilityScore: 0.72,
    isChain: false,
    localSignals: {
      localFavoriteScore: 0.8,
      neighborhoodPrideScore: 0.8,
      repeatVisitorScore: 0.7,
    },
    roleAffinity: {
      warmup: 0.7,
      peak: id === 'sj-paper-plane' ? 0.96 : 0.76,
      wildcard: 0.7,
      cooldown: id === 'sj-hedley-club-lounge' ? 0.9 : 0.68,
    },
    imageUrl: '/test.jpg',
    shortDescription: `${names[id] ?? id} local proof venue.`,
    narrativeFlavor: 'Local proof venue.',
    isHiddenGem: false,
    isActive: true,
    highlightCapable: true,
    durationProfile: {
      durationClass: 'standard',
      estimatedMinutes: 45,
    },
    settings: {
      socialDensity: 0.72,
      highlightCapabilityTier: 'highlight-capable',
      highlightConfidence: 0.85,
      supportOnly: false,
      connectiveOnly: false,
      setting: 'indoor',
      familyFriendly: false,
      adultSocial: true,
      dateFriendly: true,
      eventCapable: false,
      musicCapable: false,
      performanceCapable: false,
      routeFootprint: 'compact',
    },
    signature: {
      chainLike: false,
      genericScore: 0.1,
      signatureScore: 0.82,
    },
    source: {
      normalizedFromRawType: 'seed',
      sourceOrigin: 'curated',
      curatedSubtype: 'seed',
      providerRecordId: `provider:${id}`,
      formattedAddress: `${names[id] ?? id}, Downtown, San Jose`,
      latitude: 37.33,
      longitude: -121.89,
      sourceConfidence: 1,
      completenessScore: 1,
      qualityScore: 1,
      openNow: true,
      hoursKnown: true,
      likelyOpenForCurrentWindow: true,
      businessStatus: 'OPERATIONAL',
      timeConfidence: 1,
      hoursPressureLevel: 'low',
      hoursPressureNotes: [],
      hoursDemotionApplied: false,
      hoursSuppressionApplied: false,
      sourceTypes: ['seed'],
      missingFields: [],
      inferredFields: [],
      qualityGateStatus: 'approved',
      qualityGateNotes: [],
      approvalBlockers: [],
      demotionReasons: [],
      suppressionReasons: [],
      runtimeHoursPlanWindowProofStatus: 'open_for_plan_window',
      runtimeHoursPlanWindowSource: 'static',
    },
  } as Venue
}

function buildCanonicalStopIdentityByRole(routeIds: Record<'start' | 'highlight' | 'windDown', string>) {
  return {
    start: buildCanonicalStopIdentity(routeIds.start),
    highlight: buildCanonicalStopIdentity(routeIds.highlight),
    windDown: buildCanonicalStopIdentity(routeIds.windDown),
  }
}

function buildCanonicalStopIdentity(venueId: string) {
  const stop = buildRuntimeStop('start', venueId, 0)
  return {
    displayName: stop.displayName,
    providerRecordId: `provider:${venueId}`,
    latitude: stop.latitude,
    longitude: stop.longitude,
    addressLine: stop.address,
    city: 'San Jose',
    neighborhood: stop.neighborhood,
  }
}

function buildRuntimeStop(role: UserStopRole, venueId: string, stopIndex: number): RuntimeRouteStop {
  const venue = buildVenue(venueId)
  return {
    id: `${role}:${venueId}`,
    sourceStopId: `${role}:${venueId}`,
    displayName: venue.name,
    latitude: venue.source.latitude,
    longitude: venue.source.longitude,
    address: venue.source.formattedAddress,
    role,
    stopIndex,
    venueId,
    providerRecordId: venue.source.providerRecordId,
    title: role === 'highlight' ? 'Cocktail anchor' : 'Support stop',
    subtitle: 'Downtown',
    neighborhood: venue.neighborhood,
    driveMinutes: venue.driveMinutes,
    imageUrl: venue.imageUrl,
  }
}

function buildRuntimeRoute(params: {
  routeIds: Record<'start' | 'highlight' | 'windDown', string>
  routeSummary: string
}): RuntimeRouteArtifact {
  const stops = [
    buildRuntimeStop('start', params.routeIds.start, 0),
    buildRuntimeStop('highlight', params.routeIds.highlight, 1),
    buildRuntimeStop('windDown', params.routeIds.windDown, 2),
  ]
  return {
    routeId: 'build-runtime-contextual-role-proof',
    selectedDirectionId: selectedDirection.id,
    location: 'San Jose',
    persona: 'friends',
    vibe: 'lively',
    stops,
    activeStopIndex: 0,
    routeHeadline: 'Paper Plane Night',
    routeSummary: params.routeSummary,
    mapMarkers: stops.map((stop) => ({
      id: stop.id,
      displayName: stop.displayName,
      role: stop.role,
      stopIndex: stop.stopIndex,
      latitude: stop.latitude,
      longitude: stop.longitude,
    })),
    liveNotices: [],
    updatedAt: 1,
  }
}

function buildItineraryStop(role: UserStopRole, venueId: string): ItineraryStop {
  const stop = buildRuntimeStop(role, venueId, role === 'start' ? 0 : role === 'highlight' ? 1 : 2)
  const venue = buildVenue(venueId)
  return {
    id: stop.sourceStopId,
    role,
    title: role === 'start' ? 'Start' : role === 'highlight' ? 'Highlight' : 'Wind Down',
    venueId,
    venueName: stop.displayName,
    formattedAddress: stop.address,
    latitude: stop.latitude,
    longitude: stop.longitude,
    city: 'San Jose',
    category: venue.category,
    subcategory: venue.subcategory,
    priceTier: venue.priceTier,
    tags: venue.tags,
    vibeTags: venue.vibeTags,
    neighborhood: venue.neighborhood,
    driveMinutes: venue.driveMinutes,
    durationClass: venue.durationProfile.durationClass,
    estimatedDurationMinutes: venue.durationProfile.estimatedMinutes,
    estimatedDurationLabel: '45 min',
    subtitle: stop.subtitle,
    imageUrl: stop.imageUrl,
    stopInsider: {
      roleReason: 'contextual role proof',
      localSignal: 'static local proof',
      selectionReason: 'deterministic proof fixture',
    },
  }
}

function buildItinerary(routeIds: Record<'start' | 'highlight' | 'windDown', string>): Itinerary {
  const stops = [
    buildItineraryStop('start', routeIds.start),
    buildItineraryStop('highlight', routeIds.highlight),
    buildItineraryStop('windDown', routeIds.windDown),
  ]
  return {
    id: 'itinerary-contextual-role-proof',
    title: 'Paper Plane Night',
    city: 'San Jose',
    neighborhood: 'Downtown',
    crew: 'socialite',
    vibes: ['lively'],
    stops,
    transitions: [],
    totalRouteFriction: 0.2,
    estimatedTotalMinutes: 150,
    estimatedTotalLabel: '2.5 hours',
    routeFeelLabel: 'Easy',
    story: {
      headline: 'Paper Plane Night',
      subtitle: 'Downtown cocktails',
    },
    storySpine: {
      title: 'Paper Plane Night',
      phases: [],
      routeSummary: stops.map((stop) => stop.venueName).join(' to '),
    },
    shareSummary: stops.map((stop) => stop.venueName).join(' to '),
  }
}

function buildArtifact(params: {
  id: string
  sourceOpportunityId: string
  routeIds: Record<'start' | 'highlight' | 'windDown', string>
  anchorRole: AnchorRole
  routeSummary: string
}) {
  const runtimeRoute = buildRuntimeRoute({
    routeIds: params.routeIds,
    routeSummary: params.routeSummary,
  })
  const anchorStop = runtimeRoute.stops.find((stop) => stop.role === params.anchorRole)
  return {
    id: params.id,
    sourceOpportunityId: params.sourceOpportunityId,
    sourceMode: 'curated',
    anchorVenueId: anchorStop?.venueId ?? 'sj-paper-plane',
    anchorRole: params.anchorRole,
    anchorName: anchorStop?.displayName ?? 'Paper Plane',
    routeTitle: 'Paper Plane Night',
    flavorLine: 'Cocktails with a compact downtown arc.',
    routeSummary: params.routeSummary,
    traits: ['cocktails', 'downtown'],
    storySpine: {
      start: runtimeRoute.stops[0]?.displayName ?? 'Missing start',
      highlight: runtimeRoute.stops[1]?.displayName ?? 'Missing highlight',
      windDown: runtimeRoute.stops[2]?.displayName ?? 'Missing wind-down',
    },
    districtLine: 'Downtown San Jose',
    districtAnchorLine: 'Downtown',
    authorityLine: 'Build candidate fixture.',
    whyChooseLine: 'Keeps the required anchor in the route.',
    selection: {
      directionId: selectedDirection.id,
      pocketId: 'downtown',
    },
    enrichment: {
      validationStatus: 'valid',
      canonicalRouteRoleCoverage: {
        start: runtimeRoute.stops[0]?.displayName,
        highlight: runtimeRoute.stops[1]?.displayName,
        windDown: runtimeRoute.stops[2]?.displayName,
        support: runtimeRoute.stops.map((stop) => ({
          role: stop.role,
          name: stop.displayName,
          venueId: stop.venueId,
        })),
      },
      runtimeLockEligibility: {
        eligible: true,
        status: 'eligible',
        rejectionReasons: [],
        buildMetadata: {
          canBuildRuntimeRoute: true,
        },
      },
    },
  } as any
}
