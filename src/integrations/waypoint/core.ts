/**
 * ARC BOUNDARY: Waypoint integration seam (host side).
 *
 * Owns:
 * - deterministic ranking boundary contract for Arc candidates
 * - host-safe serialization of ranking inputs/outputs
 *
 * Does NOT own:
 * - interpretation semantics
 * - feasibility/admissibility gating
 * - product copy/presentation logic
 */
import { deterministicTiebreaker } from '../../lib/ids'
import type { ArcCandidate } from '../../domain/types/arc'
import type { GreatStopDownstreamSignal, IntentProfile } from '../../domain/types/intent'

export interface WaypointRankRequest {
  candidates: ArcCandidate[]
  intent: IntentProfile
}

export interface WaypointRankedCandidate {
  candidate: ArcCandidate
  rankingScore: number
  boundaryBaseScore: number
  refinementNudge: number
  refinementTokensApplied: string[]
  refinementTokenDeltas: Record<string, number>
  tiebreaker: number
}

export interface WaypointRankResponse {
  ranked: WaypointRankedCandidate[]
  engine: 'local-deterministic-boundary'
  qualityContext?: {
    greatStopRiskTier: GreatStopDownstreamSignal['riskTier']
    greatStopFailedStopCount: number
    greatStopSevereFailureCount: number
    greatStopSuppressionRecommended: boolean
    greatStopPenaltyHint: number
    reasonCodes: string[]
  }
  refinementNudgeSummary: {
    requestedTokens: string[]
    adjustedCandidateCount: number
    minAdjustment: number
    maxAdjustment: number
    averageAdjustment: number
    hostVocabularyMappingApplied: boolean
  }
}

function priceToNumber(priceTier: '$' | '$$' | '$$$' | '$$$$'): number {
  if (priceTier === '$') {
    return 1
  }
  if (priceTier === '$$') {
    return 2
  }
  if (priceTier === '$$$') {
    return 3
  }
  return 4
}

function averagePrice(candidate: ArcCandidate): number {
  const total = candidate.stops.reduce(
    (sum, stop) => sum + priceToNumber(stop.scoredVenue.venue.priceTier),
    0,
  )
  return total / candidate.stops.length
}

function driveSpread(candidate: ArcCandidate): number {
  const drives = candidate.stops.map((stop) => stop.scoredVenue.venue.driveMinutes)
  return Math.max(...drives) - Math.min(...drives)
}

function candidateDeterministicKey(candidate: ArcCandidate): string {
  return candidate.stops
    .map((stop) => `${stop.role}:${stop.scoredVenue.venue.id}`)
    .join('|')
}

function refinementAdjustmentTrace(candidate: ArcCandidate, intent: IntentProfile): {
  totalAdjustment: number
  tokensApplied: string[]
  tokenDeltas: Record<string, number>
} {
  // OBSERVE(arc-boundary): refinement weighting is currently host-vocabulary aware.
  // Keep deterministic behavior, but validate whether these knobs should be passed in from wrappers.
  const refinements = new Set(intent.refinementModes ?? [])
  let adjustment = 0
  const tokenDeltas: Record<string, number> = {}
  const addDelta = (token: string, delta: number) => {
    adjustment += delta
    tokenDeltas[token] = (tokenDeltas[token] ?? 0) + delta
  }

  if (refinements.has('more-exciting')) {
    const peak = candidate.stops.find((stop) => stop.role === 'peak')
    const wildcard = candidate.stops.find((stop) => stop.role === 'wildcard')
    addDelta('more-exciting', (peak?.scoredVenue.venue.energyLevel ?? 0) * 0.005)
    addDelta('more-exciting', (wildcard?.scoredVenue.venue.energyLevel ?? 0) * 0.004)
  }
  if (refinements.has('more-unique')) {
    const uniquenessAverage =
      candidate.stops.reduce((sum, stop) => sum + stop.scoredVenue.venue.uniquenessScore, 0) /
      candidate.stops.length
    addDelta('more-unique', uniquenessAverage * 0.04)
  }
  if (refinements.has('little-fancier')) {
    addDelta('little-fancier', averagePrice(candidate) * 0.018)
  }
  if (refinements.has('closer-by')) {
    addDelta('closer-by', Math.max(0, 0.04 - driveSpread(candidate) * 0.0025))
  }
  if (refinements.has('more-relaxed')) {
    const cooldown = candidate.stops[candidate.stops.length - 1]
    addDelta('more-relaxed', Math.max(0, (4 - cooldown.scoredVenue.venue.energyLevel) * 0.01))
  }

  return {
    totalAdjustment: adjustment,
    tokensApplied: Object.keys(tokenDeltas),
    tokenDeltas,
  }
}

export function rankWithWaypointBoundary(request: WaypointRankRequest): WaypointRankResponse {
  // Canonical coordination seam: consumes pre-built candidates and returns deterministic ordering only.
  const ranked = request.candidates
    .map((candidate) => {
      const boundaryBaseScore = candidate.totalScore
      const refinementTrace = refinementAdjustmentTrace(candidate, request.intent)
      const tiebreaker = deterministicTiebreaker(candidateDeterministicKey(candidate)) * 0.01
      const rankingScore =
        boundaryBaseScore + refinementTrace.totalAdjustment + tiebreaker
      return {
        candidate,
        rankingScore,
        boundaryBaseScore,
        refinementNudge: refinementTrace.totalAdjustment,
        refinementTokensApplied: refinementTrace.tokensApplied,
        refinementTokenDeltas: refinementTrace.tokenDeltas,
        tiebreaker,
      }
    })
    .sort((left, right) => right.rankingScore - left.rankingScore)
  const adjustments = ranked.map((entry) => entry.refinementNudge)
  const minAdjustment = adjustments.length > 0 ? Math.min(...adjustments) : 0
  const maxAdjustment = adjustments.length > 0 ? Math.max(...adjustments) : 0
  const averageAdjustment =
    adjustments.length > 0
      ? adjustments.reduce((sum, value) => sum + value, 0) / adjustments.length
      : 0
  const greatStopSignal = request.intent.selectedDirectionContext?.greatStopSignal

  return {
    ranked,
    engine: 'local-deterministic-boundary',
    qualityContext: greatStopSignal
      ? {
          greatStopRiskTier: greatStopSignal.riskTier,
          greatStopFailedStopCount: greatStopSignal.failedStopCount,
          greatStopSevereFailureCount: greatStopSignal.severeFailureCount,
          greatStopSuppressionRecommended: greatStopSignal.suppressionRecommended,
          greatStopPenaltyHint: greatStopSignal.degradedConfidencePenalty,
          reasonCodes: [...greatStopSignal.reasonCodes],
        }
      : undefined,
    refinementNudgeSummary: {
      requestedTokens: [...new Set(request.intent.refinementModes ?? [])],
      adjustedCandidateCount: adjustments.filter((value) => Math.abs(value) > 0).length,
      minAdjustment: Number(minAdjustment.toFixed(4)),
      maxAdjustment: Number(maxAdjustment.toFixed(4)),
      averageAdjustment: Number(averageAdjustment.toFixed(4)),
      hostVocabularyMappingApplied: (request.intent.refinementModes?.length ?? 0) > 0,
    },
  }
}
