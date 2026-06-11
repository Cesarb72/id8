import type { RuntimeRouteArtifact } from '../../domain/artifacts/runtimeRouteArtifact'
import type { UserStopRole } from '../../domain/types/itinerary'

/**
 * ARC BOUNDARY: approved Curate preview -> route_refinement handoff contract.
 *
 * This payload carries the exact approved route forward from Shared Plan Preview
 * into route_refinement without requiring an immediate rebuild to populate reveal state.
 *
 * P0-A: subsumed as a compatibility wrapper. Future Curate handoff data should
 * fold into `ContractEntryArtifact.qualification` and runtime lock eligibility
 * instead of remaining a mode-private route truth layer.
 */
export interface CurateRefinementEntryPayload<
  TPlanSnapshot = unknown,
  TCanonicalStopByRole = unknown,
> {
  source: 'approved_preview_route'
  artifactId: string
  selectedDirectionId: string
  selectedArtifactLineageSummary?: string
  previewRouteTitle: string
  planSnapshot: TPlanSnapshot
  finalRoute: RuntimeRouteArtifact
  canonicalStopByRole: TCanonicalStopByRole
  rejectedStopRoles: UserStopRole[]
}

export function buildCurateRefinementEntryPayload<
  TPlanSnapshot,
  TCanonicalStopByRole,
>(params: {
  artifactId: string
  selectedDirectionId: string
  selectedArtifactLineageSummary?: string
  previewRouteTitle: string
  planSnapshot: TPlanSnapshot
  finalRoute: RuntimeRouteArtifact
  canonicalStopByRole: TCanonicalStopByRole
  rejectedStopRoles: UserStopRole[]
}): CurateRefinementEntryPayload<TPlanSnapshot, TCanonicalStopByRole> {
  return {
    source: 'approved_preview_route',
    artifactId: params.artifactId,
    selectedDirectionId: params.selectedDirectionId,
    selectedArtifactLineageSummary: params.selectedArtifactLineageSummary,
    previewRouteTitle: params.previewRouteTitle,
    planSnapshot: params.planSnapshot,
    finalRoute: params.finalRoute,
    canonicalStopByRole: params.canonicalStopByRole,
    rejectedStopRoles: params.rejectedStopRoles,
  }
}
