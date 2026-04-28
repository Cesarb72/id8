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
 * ARC BOUNDARY: application-projection-owned active route artifact.
 *
 * This contract projects the currently active route truth for Step 2 / preview
 * surfaces. It may point at either candidate (`ContractEntryArtifact`) truth or
 * committed/runtime truth, but it is not itself interpretation-owned or runtime-owned.
 */
export interface SelectedRouteArtifact<TRuntimeArtifact = unknown> {
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

export interface SelectedRouteSummaryArtifact {
  source: SelectedRouteArtifact['source']
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
