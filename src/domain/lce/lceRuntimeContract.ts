/**
 * ARC BOUNDARY: LCE runtime preservation contract.
 *
 * This module is diagnostic/threading-only for the first LCE pass. It records
 * what runtime truth LCE consumed and whether a mutation is user-confirmed; it
 * does not expand RuntimeRouteArtifact or move lock/session ownership.
 */
import type { RuntimeRouteArtifact } from '../artifacts/runtimeRouteArtifact'
import type {
  ConciergeControlPostureMode,
  ConciergeIntent,
  ConciergeRealityPriority,
  ConciergeSwapTolerance,
  IntentProfile,
  RouteShapeContract,
} from '../types/intent'
import type { UserStopRole } from '../types/itinerary'

export type LceRuntimeMutationKind = 'repair' | 'swap' | 'continuation'
export type LceRuntimeContractPhase = 'detect' | 'alert' | 'preview' | 'confirm'
export type LceRuntimeRouteSource =
  | 'runtime_route_artifact'
  | 'canonical_route'
  | 'planner_arc_itinerary'
  | 'none'

export interface LceRuntimeFieldReality {
  source: 'field_runtime_reality' | 'live_provider_envelope' | 'static_runtime_fixture'
  role?: UserStopRole
  venueId?: string
  available?: boolean
  reasonCodes?: string[]
}

export interface LceRuntimeContractInput {
  source: string
  mutationKind: LceRuntimeMutationKind
  phase: LceRuntimeContractPhase
  targetRole?: UserStopRole | null
  canonicalRoute?: RuntimeRouteArtifact | null
  runtimeRouteArtifact?: RuntimeRouteArtifact | null
  runtimeFieldReality?: LceRuntimeFieldReality | null
  conciergeIntent?: ConciergeIntent | null
  routeShapeContract?: Pick<RouteShapeContract, 'mutationProfile'> | null
  compatibilityIntentProfile?: IntentProfile | null
  userConfirmed?: boolean
}

export interface LceAnchorPreservationDiagnostics {
  required: boolean
  mode: ConciergeIntent['anchorPosture']['mode'] | 'unknown'
  role?: UserStopRole
  venueId?: string
  source: ConciergeIntent['anchorLineage']['source'] | 'compatibility' | 'none'
}

export interface LceRuntimeContractDiagnostics {
  source: string
  consumedRuntimeRouteArtifact: boolean
  consumedCanonicalRoute: boolean
  consumedRuntimeFieldReality: boolean
  consumedConciergeIntent: boolean
  compatibilityIntentProfileUsed: boolean
  routeSource: LceRuntimeRouteSource
  phase: LceRuntimeContractPhase
  mutationKind: LceRuntimeMutationKind
  targetRole?: UserStopRole
  userConfirmationRequired: boolean
  userConfirmed: boolean
  silentMutationAllowed: false
  swapTolerance: ConciergeSwapTolerance
  controlPostureMode: ConciergeControlPostureMode | 'unknown'
  realityPosture: {
    liveSignalPriority: ConciergeRealityPriority | 'unknown'
    coherencePriority: ConciergeRealityPriority | 'unknown'
  }
  anchorPreservation: LceAnchorPreservationDiagnostics
  reasonCodes: string[]
}

export interface LceRuntimeContract {
  route: RuntimeRouteArtifact | null
  diagnostics: LceRuntimeContractDiagnostics
}

export interface LceRuntimeMutationGateResult {
  ok: boolean
  reason?: string
  reasonCodes: string[]
}

function normalizeSwapTolerance(
  input: Pick<LceRuntimeContractInput, 'conciergeIntent' | 'routeShapeContract'>,
): ConciergeSwapTolerance {
  return (
    input.conciergeIntent?.constraintPosture.swapTolerance ??
    input.routeShapeContract?.mutationProfile.swapFlexibility ??
    'medium'
  )
}

function toAnchorRole(role: ConciergeIntent['anchorLineage']['roleHint']): UserStopRole | undefined {
  if (!role) {
    return undefined
  }
  return role === 'windDown' ? 'windDown' : role
}

function buildAnchorPreservationDiagnostics(
  conciergeIntent: ConciergeIntent | null | undefined,
): LceAnchorPreservationDiagnostics {
  if (!conciergeIntent) {
    return {
      required: false,
      mode: 'unknown',
      source: 'none',
    }
  }
  const anchorRole =
    toAnchorRole(conciergeIntent.anchorLineage.roleHint) ??
    toAnchorRole(conciergeIntent.anchorPosture.roleHint)
  const anchorVenueId =
    conciergeIntent.anchorLineage.anchorId ?? conciergeIntent.anchorPosture.anchorValue
  return {
    required:
      conciergeIntent.anchorLineage.required ||
      conciergeIntent.anchorPosture.mode === 'hard',
    mode: conciergeIntent.anchorPosture.mode,
    ...(anchorRole ? { role: anchorRole } : {}),
    ...(anchorVenueId ? { venueId: anchorVenueId } : {}),
    source: conciergeIntent.anchorLineage.source,
  }
}

function resolveRoute(input: LceRuntimeContractInput): {
  route: RuntimeRouteArtifact | null
  source: LceRuntimeRouteSource
} {
  if (input.runtimeRouteArtifact) {
    return { route: input.runtimeRouteArtifact, source: 'runtime_route_artifact' }
  }
  if (input.canonicalRoute) {
    return { route: input.canonicalRoute, source: 'canonical_route' }
  }
  return { route: null, source: 'none' }
}

export function buildLceRuntimeContract(
  input: LceRuntimeContractInput,
): LceRuntimeContract {
  const resolvedRoute = resolveRoute(input)
  const reasonCodes = ['lce_runtime_contract_threaded', 'lce_never_silent_mutation']
  if (input.runtimeRouteArtifact) {
    reasonCodes.push('lce_consumed_runtime_route_artifact')
  }
  if (input.canonicalRoute) {
    reasonCodes.push('lce_consumed_canonical_route')
  }
  if (input.runtimeFieldReality) {
    reasonCodes.push('lce_consumed_runtime_field_reality')
    reasonCodes.push(...(input.runtimeFieldReality.reasonCodes ?? []))
  }
  if (input.conciergeIntent) {
    reasonCodes.push('lce_consumed_concierge_intent')
  }
  if (input.compatibilityIntentProfile && !input.conciergeIntent) {
    reasonCodes.push('lce_intent_profile_compatibility_projection')
  }
  if (input.phase === 'confirm' && input.userConfirmed === true) {
    reasonCodes.push('lce_user_confirmed_mutation')
  } else {
    reasonCodes.push('lce_waits_for_user_confirmation')
  }

  const targetRole = input.targetRole ?? undefined
  return {
    route: resolvedRoute.route,
    diagnostics: {
      source: input.source,
      consumedRuntimeRouteArtifact: Boolean(input.runtimeRouteArtifact),
      consumedCanonicalRoute: Boolean(input.canonicalRoute),
      consumedRuntimeFieldReality: Boolean(input.runtimeFieldReality),
      consumedConciergeIntent: Boolean(input.conciergeIntent),
      compatibilityIntentProfileUsed: Boolean(input.compatibilityIntentProfile),
      routeSource: resolvedRoute.source,
      phase: input.phase,
      mutationKind: input.mutationKind,
      ...(targetRole ? { targetRole } : {}),
      userConfirmationRequired: true,
      userConfirmed: input.userConfirmed === true,
      silentMutationAllowed: false,
      swapTolerance: normalizeSwapTolerance(input),
      controlPostureMode: input.conciergeIntent?.controlPosture.mode ?? 'unknown',
      realityPosture: {
        liveSignalPriority:
          input.conciergeIntent?.realityPosture.liveSignalPriority ?? 'unknown',
        coherencePriority:
          input.conciergeIntent?.realityPosture.coherencePriority ?? 'unknown',
      },
      anchorPreservation: buildAnchorPreservationDiagnostics(input.conciergeIntent),
      reasonCodes,
    },
  }
}

export function assertLceRuntimeMutationMayCommit(
  contract: LceRuntimeContract,
): LceRuntimeMutationGateResult {
  if (!contract.route) {
    return {
      ok: false,
      reason: 'lce_runtime_route_missing',
      reasonCodes: [
        ...contract.diagnostics.reasonCodes,
        'lce_runtime_route_missing',
      ],
    }
  }
  if (!contract.diagnostics.userConfirmed) {
    return {
      ok: false,
      reason: 'lce_user_confirmation_required',
      reasonCodes: [
        ...contract.diagnostics.reasonCodes,
        'lce_user_confirmation_required',
      ],
    }
  }
  return {
    ok: true,
    reasonCodes: [
      ...contract.diagnostics.reasonCodes,
      'lce_runtime_mutation_commit_allowed',
    ],
  }
}
