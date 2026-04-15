import type { BoundaryDiagnostics } from '../types/boundaryDiagnostics'

interface BuildBoundaryTruthNotesInput {
  boundary: BoundaryDiagnostics
  strictShapeEnabled: boolean
  minRolePoolSize: number
}

export function buildBoundaryTruthNotes({
  boundary,
  strictShapeEnabled,
  minRolePoolSize,
}: BuildBoundaryTruthNotesInput): string[] {
  const notes: string[] = []

  if (!boundary.boundaryInvoked) {
    notes.push('Boundary ranking not invoked.')
  }
  if (boundary.boundaryInvoked && !boundary.changedWinner) {
    notes.push('Boundary ranking invoked but winner unchanged.')
  }
  if (!boundary.finalProjectedMatchesPostBoundaryWinner) {
    notes.push('Post-boundary winner differs from final projected arc.')
  }
  if (boundary.topCandidateOverlapPct >= 70) {
    notes.push('Candidate arcs highly overlapping before boundary.')
  }
  if (strictShapeEnabled && boundary.topCandidateOverlapPct >= 70) {
    notes.push('Strict shaping still produced near-identical candidates.')
  }
  if (minRolePoolSize < 3) {
    notes.push('Role pools collapsed before ranking.')
  }

  return notes
}
