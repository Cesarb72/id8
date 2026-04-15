import type { ArcCandidate, ScoredVenue } from '../types/arc'
import type { ExperienceLens } from '../types/experienceLens'
import type { IntentProfile } from '../types/intent'
import type { InternalRole } from '../types/venue'

interface BuildRejectedReasonInput {
  role: InternalRole
  candidate: ScoredVenue
  selected: ScoredVenue
  currentArc: ArcCandidate
  intent: IntentProfile
  lens: ExperienceLens
}

export function buildRejectedReason({
  role,
  candidate,
  selected,
  currentArc,
  intent,
  lens,
}: BuildRejectedReasonInput): string[] {
  const reasons: string[] = []
  const otherStops = currentArc.stops.filter((stop) => stop.role !== role)
  const selectedCategory = selected.venue.category
  const otherCategories = new Set(otherStops.map((stop) => stop.scoredVenue.venue.category))

  if (candidate.venue.driveMinutes > selected.venue.driveMinutes + 4) {
    reasons.push('too far')
  }
  if (candidate.fitBreakdown.anchorFit < selected.fitBreakdown.anchorFit - 0.08) {
    reasons.push('lower vibe match')
  }
  if (candidate.fitBreakdown.crewFit < selected.fitBreakdown.crewFit - 0.08) {
    reasons.push('lower persona fit')
  }
  if (
    otherCategories.has(candidate.venue.category) &&
    !otherCategories.has(selectedCategory)
  ) {
    reasons.push('duplicate category')
  }
  if (candidate.roleScores[role] < selected.roleScores[role] - 0.06) {
    reasons.push('weaker role fit')
  }
  if (
    role === 'peak' &&
    candidate.highlightValidity.validityLevel === 'invalid'
  ) {
    reasons.push('invalid highlight for this request')
  }
  if (
    role === 'peak' &&
    candidate.highlightValidity.validityLevel === 'fallback' &&
    selected.highlightValidity.validityLevel === 'valid'
  ) {
    reasons.push('weaker highlight validity')
  }
  if (
    role === 'cooldown' &&
    (candidate.venue.energyLevel > 3 ||
      candidate.stopShapeFit.windDown < selected.stopShapeFit.windDown - 0.08)
  ) {
    reasons.push('poor windDown fit')
  }
  if (candidate.lensCompatibility < Math.max(0.35, selected.lensCompatibility - 0.1)) {
    reasons.push('low lens compatibility')
  }
  if (
    intent.refinementModes?.includes('closer-by') &&
    candidate.venue.driveMinutes > selected.venue.driveMinutes + 2
  ) {
    reasons.push('blocked by current refinement')
  }
  if (
    intent.refinementModes?.includes('more-relaxed') &&
    role === 'cooldown' &&
    candidate.venue.energyLevel > selected.venue.energyLevel
  ) {
    reasons.push('blocked by current refinement')
  }
  if (
    lens.movementTolerance === 'low' &&
    candidate.venue.driveMinutes > selected.venue.driveMinutes + 3 &&
    !reasons.includes('too far')
  ) {
    reasons.push('too far')
  }

  if (reasons.length === 0) {
    reasons.push('lost to stronger nearby option')
  }

  return [...new Set(reasons)].slice(0, 3)
}
