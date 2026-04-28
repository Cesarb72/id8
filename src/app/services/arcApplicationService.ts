import {
  previewDistrictRecommendations,
  type DistrictPreviewResult,
} from '../../domain/previewDistrictRecommendations'
import {
  runGeneratePlan,
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

export async function searchAnchorVenueOptions(
  input: Parameters<typeof searchAnchorVenues>[0],
): Promise<AnchorSearchResult[]> {
  return searchAnchorVenues(input)
}

export async function previewDistrictRecommendationsForPlanBuild(
  input: Parameters<typeof previewDistrictRecommendations>[0],
): Promise<DistrictPreviewResult> {
  return previewDistrictRecommendations(input)
}
