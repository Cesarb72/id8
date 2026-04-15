import type { ExperienceMode, PersonaMode, VibeAnchor } from './intent'
import type { UserStopRole } from './itinerary'

export type BoundaryContributionLevel = 'none' | 'minor' | 'meaningful'

export interface ArcCandidateSnapshot {
  candidateId: string
  stopIdsByRole: Partial<Record<UserStopRole, string>>
  stopCategoriesByRole: Partial<Record<UserStopRole, string>>
  preBoundaryScore: number
  categoryComposition: string[]
  diversitySummary: string
}

export interface RankedArcCandidateSnapshot extends ArcCandidateSnapshot {
  rank: number
  boundaryScore: number
  previousRank: number
  rankChanged: boolean
  becameWinner: boolean
  boundaryBaseScore?: number
  boundaryRefinementNudge?: number
  boundaryTiebreaker?: number
  boundaryRefinementTokens?: string[]
  boundaryRefinementTokenDeltas?: Record<string, number>
}

export interface BoundaryRefinementNudgeTrace {
  requestedTokens: string[]
  adjustedCandidateCount: number
  minAdjustment: number
  maxAdjustment: number
  averageAdjustment: number
  hostVocabularyMappingApplied: boolean
  greatStopQualityContext?: {
    riskTier: 'none' | 'warning' | 'severe'
    failedStopCount: number
    severeFailureCount: number
    suppressionRecommended: boolean
    penaltyHint: number
    reasonCodes: string[]
  }
}

export interface BoundaryDiagnostics {
  boundaryInvoked: boolean
  candidateArcCount: number
  candidateIdsPassed: string[]
  preBoundaryOrder: string[]
  postBoundaryOrder: string[]
  winnerBeforeBoundary?: string
  winnerAfterBoundary?: string
  finalProjectedWinner: string
  selectedArcBeforeBoundary?: string
  selectedArcAfterBoundary?: string
  finalProjectedArcId: string
  finalProjectedMatchesPostBoundaryWinner: boolean
  changedWinner: boolean
  boundaryChangedWinner: boolean
  changedOrderCount: number
  averageRankDelta: number
  topCandidateOverlapPct: number
  boundaryContributionLevel: BoundaryContributionLevel
  preBoundarySnapshot: ArcCandidateSnapshot[]
  postBoundarySnapshot: RankedArcCandidateSnapshot[]
  refinementNudgeTrace?: BoundaryRefinementNudgeTrace
  warnings: string[]
}

export interface OverlapScenarioDiagnostics {
  scenarioId: string
  label: string
  mode: ExperienceMode
  persona: PersonaMode
  primaryVibe: VibeAnchor
  secondaryVibe?: VibeAnchor
  starterPackId?: string
  strictShapeEnabled: boolean
  retrievedVenueIds: string[]
  rolePoolVenueIds: string[]
  topCandidateSignatures: string[]
  winnerSignature: string
}

export interface OverlapPairDiagnostics {
  leftScenarioId: string
  rightScenarioId: string
  retrievedVenueOverlapPct: number
  rolePoolOverlapPct: number
  topCandidateOverlapPct: number
  winnerOverlapPct: number
}

export interface OverlapDiagnostics {
  scenarios: OverlapScenarioDiagnostics[]
  pairs: OverlapPairDiagnostics[]
  warnings: string[]
}
