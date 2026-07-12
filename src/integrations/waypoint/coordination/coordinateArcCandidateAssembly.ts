import type {
  ArcCandidate,
  ArcStop,
  ScoredVenue,
  SurpriseInjectionMetadata,
} from '../../../domain/types/arc'

export interface ArcCoreRouteShape {
  warmup: ScoredVenue
  peak: ScoredVenue
  cooldown: ScoredVenue
  stops: ArcStop[]
}

export interface CoordinateArcCoreRouteShapesInput {
  warmupCandidates: readonly ScoredVenue[]
  peakCandidates: readonly ScoredVenue[]
  cooldownCandidates: readonly ScoredVenue[]
}

export interface ProjectArcCandidateAssemblyInput {
  id: string
  stops: ArcStop[]
  totalScore: ArcCandidate['totalScore']
  scoreBreakdown: ArcCandidate['scoreBreakdown']
  pacing: ArcCandidate['pacing']
  spatial: ArcCandidate['spatial']
  hasWildcard: boolean
  surpriseInjection?: SurpriseInjectionMetadata
}

export function buildArcCoreStops(
  warmup: ScoredVenue,
  peak: ScoredVenue,
  cooldown: ScoredVenue,
): ArcStop[] {
  return [
    { role: 'warmup', scoredVenue: warmup },
    { role: 'peak', scoredVenue: peak },
    { role: 'cooldown', scoredVenue: cooldown },
  ]
}

export function buildArcWildcardStops(
  stops: ArcStop[],
  wildcard: ScoredVenue,
): ArcStop[] {
  return [
    stops[0],
    stops[1],
    { role: 'wildcard', scoredVenue: wildcard },
    stops[2],
  ]
}

export function coordinateArcCoreRouteShapes(
  input: CoordinateArcCoreRouteShapesInput,
): ArcCoreRouteShape[] {
  const routeShapes: ArcCoreRouteShape[] = []
  for (const warmup of input.warmupCandidates) {
    for (const peak of input.peakCandidates) {
      for (const cooldown of input.cooldownCandidates) {
        routeShapes.push({
          warmup,
          peak,
          cooldown,
          stops: buildArcCoreStops(warmup, peak, cooldown),
        })
      }
    }
  }
  return routeShapes
}

export function projectArcCandidateAssembly(
  input: ProjectArcCandidateAssemblyInput,
): ArcCandidate {
  return {
    id: input.id,
    stops: input.stops,
    totalScore: input.totalScore,
    scoreBreakdown: input.scoreBreakdown,
    pacing: input.pacing,
    spatial: input.spatial,
    hasWildcard: input.hasWildcard,
    ...(input.surpriseInjection
      ? { surpriseInjection: input.surpriseInjection }
      : {}),
  }
}

export function rankArcCandidatesForAssembly(
  candidates: readonly ArcCandidate[],
): ArcCandidate[] {
  return [...candidates].sort((left, right) => {
    const scoreDelta = right.totalScore - left.totalScore
    if (scoreDelta !== 0) {
      return scoreDelta
    }
    const leftPromotion =
      left.surpriseInjection?.promotionOutcome === 'promoted_to_highlight' ? 1 : 0
    const rightPromotion =
      right.surpriseInjection?.promotionOutcome === 'promoted_to_highlight' ? 1 : 0
    if (rightPromotion !== leftPromotion) {
      return rightPromotion - leftPromotion
    }
    const leftTier =
      left.surpriseInjection?.candidateTier === 'strong'
        ? 2
        : left.surpriseInjection?.candidateTier === 'nearStrong'
          ? 1
          : 0
    const rightTier =
      right.surpriseInjection?.candidateTier === 'strong'
        ? 2
        : right.surpriseInjection?.candidateTier === 'nearStrong'
          ? 1
          : 0
    return rightTier - leftTier
  })
}
