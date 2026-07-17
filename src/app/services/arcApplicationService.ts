import {
  previewDistrictRecommendations,
  type DistrictPreviewResult,
} from '../../domain/previewDistrictRecommendations'
import {
  runGeneratePlan,
  runGeneratePlanForGovernedRouteIngress,
  type GeneratePlanResult,
  type GenerationTrace,
  type RunGeneratePlanOptions,
} from '../../domain/runGeneratePlan'
import {
  buildStopTypeCandidateBoardFromContract,
  buildStopTypeCandidateBoardFromIntent,
  type BuildStopTypeCandidateBoardFromIntentInput,
  type FieldDiscoveryContractInput,
  type StopTypeCandidateBoard,
} from '../../domain/interpretation/discovery/stopTypeCandidateBoard'
import type { LiveProviderEnvelope } from '../../domain/retrieval/liveEnvelope'
import {
  searchAnchorVenues,
  type AnchorSearchChip,
  type AnchorSearchResult,
} from '../../domain/search/searchAnchorVenues'
import type { IntentInput, RouteShapeContract } from '../../domain/types/intent'
import type { ContractEntryArtifactLineage } from '../../domain/artifacts/contractEntryArtifact'
import type { StarterPack } from '../../domain/types/starterPack'

export interface StepBCurateLiveSmokeCandidateSupplyGate {
  environment: 'default' | 'dev' | 'archive'
  pathname: string
  isPublicSurface: boolean
  mode: IntentInput['mode'] | null
  inputMode: IntentInput['mode']
  phase: 'candidate_supply' | 'other'
  selectedStarterPackPresent: boolean
  userSourceModeOverrideApplied: boolean
  smokeSwitchEnabled: boolean
}

const STEP_B_CURATE_LIVE_SMOKE_CANDIDATE_SUPPLY_ENVELOPE: LiveProviderEnvelope = {
  liveProviderAllowed: true,
  maxProviderCalls: 3,
  maxQueryLabels: 3,
  maxCenters: 1,
}

const GOVERNED_ROUTE_FIELD_PROXY_ENVELOPE: LiveProviderEnvelope = {
  liveProviderAllowed: true,
  maxProviderCalls: 3,
  maxQueryLabels: 3,
  maxCenters: 1,
}

/**
 * ARC BOUNDARY: application-service ingress for provider-backed and plan-build entrypoints.
 *
 * UI/page code should call this module instead of importing provider-backed search,
 * district-preview, or plan-build orchestrators directly. This keeps page wrappers on
 * one application-facing ingress boundary while preserving the existing domain modules
 * as the canonical lower-layer implementations.
 */

export type { AnchorSearchChip, AnchorSearchResult, DistrictPreviewResult, GenerationTrace }
export type { ContractEntryArtifactLineage }

export type PlaceRightCarriedPlanBuildOptions = RunGeneratePlanOptions & {
  routeShapeContract: RouteShapeContract
}

export async function runPlanBuild(
  input: IntentInput,
  options: PlaceRightCarriedPlanBuildOptions,
): Promise<GeneratePlanResult> {
  if (options?.debugMode && typeof window !== 'undefined') {
    console.info('[ID8 TRACE] runPlanBuild ingress', {
      sourceMode: options.sourceMode,
      sourceModeOverrideApplied: options.sourceModeOverrideApplied,
      mode: input.mode,
      planningMode: input.planningMode,
      city: input.city,
    })
  }
  return runGeneratePlan(input, options)
}

export async function runPlanBuildWithLegacyPlaceRightFallback(
  input: IntentInput,
  options?: RunGeneratePlanOptions,
): Promise<GeneratePlanResult> {
  return runGeneratePlan(input, options)
}

export type GovernedFieldRoutePlanBuildOptions =
  Omit<RunGeneratePlanOptions, 'sourceMode' | 'sourceModeOverrideApplied'> & {
    sourceMode?: never
    sourceModeOverrideApplied?: never
    liveEnvelope?: never
  }

export async function runGovernedFieldProxyRoutePlanBuild(
  input: IntentInput,
  options: GovernedFieldRoutePlanBuildOptions = {},
): Promise<GeneratePlanResult> {
  const {
    liveEnvelope: _ignoredCallerLiveEnvelope,
    sourceMode: _ignoredCallerSourceMode,
    sourceModeOverrideApplied: _ignoredCallerSourceModeOverrideApplied,
    ...safeOptions
  } = options as RunGeneratePlanOptions & {
    liveEnvelope?: LiveProviderEnvelope
    sourceModeOverrideApplied?: boolean
  }

  return runGeneratePlanForGovernedRouteIngress(input, {
    ...safeOptions,
    sourceMode: 'hybrid',
    sourceModeOverrideApplied: false,
    liveEnvelope: GOVERNED_ROUTE_FIELD_PROXY_ENVELOPE,
  })
}

export function shouldApplyStepBCurateLiveSmokeCandidateSupply(
  gate: StepBCurateLiveSmokeCandidateSupplyGate,
): boolean {
  const normalizedPathname = gate.pathname.toLowerCase()
  return (
    gate.environment === 'default' &&
    gate.isPublicSurface &&
    normalizedPathname === '/start/curate' &&
    gate.mode === 'curate' &&
    gate.inputMode === 'curate' &&
    gate.phase === 'candidate_supply' &&
    gate.selectedStarterPackPresent &&
    gate.userSourceModeOverrideApplied === false &&
    gate.smokeSwitchEnabled
  )
}

type StepBCurateLiveSmokeCandidateSupplyInput =
  Omit<BuildStopTypeCandidateBoardFromIntentInput, 'liveEnvelope'> & {
    liveEnvelope?: never
  }

function countStopTypeBoardCandidates(board: StopTypeCandidateBoard | null): number {
  if (!board) {
    return 0
  }
  return Object.values(board.candidatesByStopType).reduce(
    (total, candidates) => total + candidates.length,
    0,
  )
}

export async function runStepBCurateLiveSmokeCandidateSupply(params: {
  gate: StepBCurateLiveSmokeCandidateSupplyGate
  input: StepBCurateLiveSmokeCandidateSupplyInput
  starterPack: StarterPack | null
  fieldDiscoveryContract?: FieldDiscoveryContractInput
}): Promise<StopTypeCandidateBoard | null> {
  const {
    liveEnvelope: _ignoredCallerLiveEnvelope,
    sourceMode: callerSourceMode,
    ...safeInput
  } = params.input as BuildStopTypeCandidateBoardFromIntentInput
  const buildBoard = (input: {
    sourceMode: NonNullable<BuildStopTypeCandidateBoardFromIntentInput['sourceMode']>
    liveEnvelope?: LiveProviderEnvelope
  }): Promise<StopTypeCandidateBoard | null> => {
    if (params.fieldDiscoveryContract) {
      return buildStopTypeCandidateBoardFromContract({
        ...params.fieldDiscoveryContract,
        sourceMode: input.sourceMode,
        liveEnvelope: input.liveEnvelope,
        starterPack: params.starterPack ?? params.fieldDiscoveryContract.starterPack,
      })
    }
    return buildStopTypeCandidateBoardFromIntent({
      ...safeInput,
      sourceMode: input.sourceMode,
      liveEnvelope: input.liveEnvelope,
      starterPack: params.starterPack ?? safeInput.starterPack,
    })
  }
  const shouldApply = shouldApplyStepBCurateLiveSmokeCandidateSupply(params.gate)
  if (!shouldApply) {
    return buildBoard({
      sourceMode: callerSourceMode ?? 'curated',
    })
  }

  // P0-G diagnostic-only: remove after hosted Step B candidate-supply audit is complete.
  console.info('[ID8 STEP B SUPPLY TRACE]', {
    event: 'runStepBCurateLiveSmokeCandidateSupply',
    branch: 'candidate_supply_wrapper_entered',
    currentPath: params.gate.pathname,
    isPublicSurface: params.gate.isPublicSurface,
    mode: params.gate.mode,
    inputMode: params.gate.inputMode,
    phase: params.gate.phase,
    selectedStarterPackPresent: params.gate.selectedStarterPackPresent,
    userSourceModeOverrideApplied: params.gate.userSourceModeOverrideApplied,
    smokeSwitchEnabled: params.gate.smokeSwitchEnabled,
    sourceMode: 'hybrid',
    maxProviderCalls: STEP_B_CURATE_LIVE_SMOKE_CANDIDATE_SUPPLY_ENVELOPE.maxProviderCalls,
    maxQueryLabels: STEP_B_CURATE_LIVE_SMOKE_CANDIDATE_SUPPLY_ENVELOPE.maxQueryLabels,
    maxCenters: STEP_B_CURATE_LIVE_SMOKE_CANDIDATE_SUPPLY_ENVELOPE.maxCenters,
  })

  const board = await buildBoard({
    sourceMode: 'hybrid',
    liveEnvelope: STEP_B_CURATE_LIVE_SMOKE_CANDIDATE_SUPPLY_ENVELOPE,
  })

  // P0-G diagnostic-only: remove after hosted Step B candidate-supply audit is complete.
  console.info('[ID8 STEP B SUPPLY TRACE]', {
    event: 'runStepBCurateLiveSmokeCandidateSupply',
    branch: 'candidate_supply_board_built',
    currentPath: params.gate.pathname,
    boardPresent: Boolean(board),
    scenarioFamily: board?.scenarioFamily ?? null,
    requiredStopTypes: board?.requiredStopTypes.length ?? 0,
    aggregateCandidateCount: countStopTypeBoardCandidates(board),
  })

  return board
}

export async function searchAnchorVenueOptions(
  input: Parameters<typeof searchAnchorVenues>[0],
): Promise<AnchorSearchResult[]> {
  return searchAnchorVenues(input)
}

export async function previewDistrictRecommendationsForPlanBuild(
  input: Parameters<typeof previewDistrictRecommendations>[0],
  options?: Parameters<typeof previewDistrictRecommendations>[1],
): Promise<DistrictPreviewResult> {
  return previewDistrictRecommendations(input, options)
}
