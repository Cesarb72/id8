import { getNearbyAlternatives } from '../retrieval/getNearbyAlternatives'
import { swapArcStop } from './swapArcStop'
import type { ArcCandidate, StopAlternative, ScoredVenue } from '../types/arc'
import type { CrewPolicy } from '../types/crewPolicies'
import type { ExperienceLens } from '../types/experienceLens'
import type { IntentProfile } from '../types/intent'
import type { InternalRole } from '../types/venue'

interface GetRoleAlternativesInput {
  role: InternalRole
  currentArc: ArcCandidate
  scoredVenues: ScoredVenue[]
  intent: IntentProfile
  crewPolicy: CrewPolicy
  lens: ExperienceLens
  limit?: number
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function roleSpecificBoost(
  role: InternalRole,
  venue: ScoredVenue,
  lens: ExperienceLens,
): number {
  if (role === 'cooldown') {
    const energyPenalty =
      venue.venue.energyLevel >= 4
        ? lens.tone === 'electric'
          ? 0.12
          : 0.24
        : 0
    const categoryBonus =
      venue.venue.category === 'dessert' ||
      venue.venue.category === 'park' ||
      venue.venue.category === 'cafe'
        ? 0.12
        : 0
    return categoryBonus - energyPenalty
  }
  if (role === 'wildcard') {
    return lens.discoveryBias === 'high'
      ? venue.hiddenGemScore * 0.12
      : venue.hiddenGemScore * 0.04
  }
  if (role === 'peak') {
    return venue.venue.energyLevel >= 3 ? 0.08 : -0.06
  }
  return 0
}

export function getRoleAlternatives({
  role,
  currentArc,
  scoredVenues,
  intent,
  crewPolicy,
  lens,
  limit = 5,
}: GetRoleAlternativesInput): StopAlternative[] {
  const nearbyPool = getNearbyAlternatives({
    role,
    currentArc,
    scoredVenues,
    intent,
    lens,
    limit: Math.max(limit * 3, 10),
  })

  return nearbyPool
    .map((candidate) => {
      const swappedArc = swapArcStop({
        currentArc,
        role,
        replacement: candidate.scoredVenue,
        intent,
        crewPolicy,
        lens,
      })
      if (!swappedArc) {
        return null
      }
      const contractEval = candidate.scoredVenue.roleContract[role]
      const contractBoost = contractEval.score * (role === 'peak' ? 0.16 : 0.1)
      const contractPenalty =
        contractEval.satisfied || contractEval.strength === 'none'
          ? 0
          : (1 - contractEval.score) * (role === 'peak' ? 0.18 : 0.12)
      const score = clamp01(
          candidate.score * 0.4 +
          candidate.scoredVenue.roleScores[role] * 0.28 +
          candidate.scoredVenue.fitScore * 0.14 +
          candidate.scoredVenue.lensCompatibility * 0.1 +
          contractBoost -
          contractPenalty +
          roleSpecificBoost(role, candidate.scoredVenue, lens),
      )
      return {
        scoredVenue: candidate.scoredVenue,
        score,
        reason: candidate.reason,
      }
    })
    .filter((item): item is StopAlternative => Boolean(item))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
}
