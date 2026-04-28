import type { DiscoveryCandidate } from './getDiscoveryCandidates'

export interface DiscoveryCandidatePresentation {
  venueName: string
  fitSummary: string
  meta: string
}

export function getDiscoveryCandidatePresentation(
  candidate: DiscoveryCandidate,
): DiscoveryCandidatePresentation {
  const previewStop = candidate.stopPreview
  return {
    venueName: previewStop?.venueName ?? candidate.name,
    fitSummary: previewStop?.fitSummary ?? 'Included in this direction.',
    meta: previewStop?.areaFitSummary ?? previewStop?.areaName ?? 'Area details unavailable.',
  }
}
