import { rankWithWaypointBoundary } from './core'
import type { ArcCandidate } from '../../domain/types/arc'
import type { IntentProfile } from '../../domain/types/intent'
import type { WaypointRankResponse } from './core'

export interface RankedArcResult {
  rankedCandidates: ArcCandidate[]
  rankingEngine: string
}

export function rankArcCandidates(
  candidates: ArcCandidate[],
  intent: IntentProfile,
): RankedArcResult {
  const response = rankWithWaypointBoundary({ candidates, intent })
  return {
    rankedCandidates: response.ranked.map((entry) => entry.candidate),
    rankingEngine: response.engine,
  }
}

export function rankArcCandidatesWithDiagnostics(
  candidates: ArcCandidate[],
  intent: IntentProfile,
): WaypointRankResponse {
  return rankWithWaypointBoundary({ candidates, intent })
}
