import {
  previewDistrictRecommendations,
  type DistrictPreviewResult,
} from '../../domain/previewDistrictRecommendations'
import {
  runGeneratePlan,
  runStepBCurateLiveSmokeGeneratePlan,
  type GeneratePlanResult,
  type GenerationTrace,
  type RunGeneratePlanOptions,
} from '../../domain/runGeneratePlan'
import {
  searchAnchorVenues,
  type AnchorSearchChip,
  type AnchorSearchResult,
} from '../../domain/search/searchAnchorVenues'
import type { IntentInput } from '../../domain/types/intent'
import type { ContractEntryArtifactLineage } from '../../domain/artifacts/contractEntryArtifact'

export interface StepBCurateLiveSmokeGate {
  environment: 'default' | 'dev' | 'archive'
  pathname: string
  invocation: 'public_selected_curate_review_route' | 'other'
  mode: IntentInput['mode'] | null
  inputMode: IntentInput['mode']
  generationTarget: 'preview' | 'final'
  selectedStarterPackPresent: boolean
  userSourceModeOverrideApplied: boolean
  smokeSwitchEnabled: boolean
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

export async function runPlanBuild(
  input: IntentInput,
  options?: RunGeneratePlanOptions,
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

export function shouldApplyStepBCurateLiveSmoke(gate: StepBCurateLiveSmokeGate): boolean {
  const normalizedPathname = gate.pathname.toLowerCase()
  const publicSurface =
    normalizedPathname.length === 0 ||
    (!normalizedPathname.startsWith('/dev') && !normalizedPathname.startsWith('/sandbox'))

  return (
    gate.environment === 'default' &&
    publicSurface &&
    gate.invocation === 'public_selected_curate_review_route' &&
    gate.mode === 'curate' &&
    gate.inputMode === 'curate' &&
    gate.generationTarget === 'final' &&
    gate.selectedStarterPackPresent &&
    gate.userSourceModeOverrideApplied === false &&
    gate.smokeSwitchEnabled
  )
}

export async function runStepBCurateLiveSmokePlanBuild(params: {
  gate: StepBCurateLiveSmokeGate
  input: IntentInput
  options: RunGeneratePlanOptions
}): Promise<GeneratePlanResult> {
  if (!shouldApplyStepBCurateLiveSmoke(params.gate)) {
    return runGeneratePlan(params.input, params.options)
  }

  // P0-G diagnostic-only: remove after hosted Step B predicate/branch audit is complete.
  console.info('[ID8 STEP B TRACE]', {
    event: 'runStepBCurateLiveSmokePlanBuild',
    branch: 'step_b_wrapper_called',
    currentPath: params.gate.pathname,
    isPublicSurface:
      params.gate.pathname.length === 0 ||
      (!params.gate.pathname.toLowerCase().startsWith('/dev') &&
        !params.gate.pathname.toLowerCase().startsWith('/sandbox')),
    isCurateWrapperActive: params.gate.mode === 'curate',
    stepBSmokeSwitchEnabled: params.gate.smokeSwitchEnabled,
    selectedStarterPackPresent: params.gate.selectedStarterPackPresent,
    stepBCurateReviewRouteForceGeneration: true,
    generationInvocation: params.gate.invocation,
    generationTarget: params.gate.generationTarget,
    inputMode: params.gate.inputMode,
    userSourceModeOverrideApplied: params.gate.userSourceModeOverrideApplied,
  })

  console.info('[ID8 STEP B] Curate live smoke wrapper active', {
    maxProviderCalls: 3,
    maxQueryLabels: 3,
    maxCenters: 1,
    mode: params.gate.mode,
    generationTarget: params.gate.generationTarget,
    invocation: params.gate.invocation,
    pathname: params.gate.pathname,
  })

  return runStepBCurateLiveSmokeGeneratePlan(params.input, {
    ...params.options,
    sourceModeOverrideApplied: false,
  })
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
