import type { ContractEntryArtifact } from './contractEntryArtifact'

export interface DirectionPreviewStop {
  role: 'start' | 'highlight' | 'surprise' | 'windDown'
  name: string
}

export interface DirectionPreviewModel {
  directionId: string
  headline: string
  tone: string
  stops: DirectionPreviewStop[]
  continuityLine: string
}

export type HighlightProvenance = 'candidate_story_spine' | 'committed_runtime_route'

export interface ActiveHighlightProjection {
  provenance: HighlightProvenance
  activeName: string
  activeVenueId?: string
  activeStopId?: string
}

/**
 * ARC BOUNDARY: legacy application-projection-owned active route artifact.
 *
 * This contract projects the currently active route truth for Step 2 / preview
 * surfaces. It may point at either candidate (`ContractEntryArtifact`) truth or
 * committed/runtime truth, but it is not itself interpretation-owned or runtime-owned.
 *
 * P0-A: subsumed as a projection target. It remains for compatibility until
 * public surfaces migrate to derived projections over enriched
 * `ContractEntryArtifact` and `RuntimeRouteArtifact`. It may remain as a render
 * adapter, test fixture, diagnostic source, or compatibility projection, but it
 * must not independently author canonical route truth.
 */
export interface LegacySelectedRouteArtifact<TRuntimeArtifact = unknown> {
  source: 'candidate' | 'committed'
  directionId: string
  candidateArtifactId?: string
  candidateRouteArtifact?: ContractEntryArtifact
  canonicalRouteArtifact?: TRuntimeArtifact
  activeHighlight: ActiveHighlightProjection
  preview: DirectionPreviewModel
  routeTitle: string
  flavorLine?: string
  routeSummary: string
  traits?: string[]
  districtLine: string
  districtAnchorLine: string
  authorityLine: string
  happeningsLine?: string
  whyChooseLine: string
  whyTonightProofLine?: string
  scenarioEvaluationNotes?: string[]
}

/**
 * @deprecated Use `LegacySelectedRouteArtifact` to make the compatibility
 * projection boundary explicit.
 */
export type SelectedRouteArtifact<TRuntimeArtifact = unknown> =
  LegacySelectedRouteArtifact<TRuntimeArtifact>

export interface SelectedRouteSummaryArtifact {
  source: LegacySelectedRouteArtifact['source']
  activeHighlight: ActiveHighlightProjection
  preview: DirectionPreviewModel
  routeTitle: string
  flavorLine?: string
  routeSummary: string
  traits?: string[]
  districtLine: string
  districtAnchorLine: string
  authorityLine: string
  happeningsLine?: string
  whyChooseLine: string
  whyTonightProofLine?: string
  scenarioEvaluationNotes?: string[]
}
