import type { ScoredVenue } from '../types/arc'
import type { InternalRole } from '../types/venue'

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function isDistrictStyleGenericName(name: string): boolean {
  const geoToken =
    /\b(district|downtown|midtown|uptown|japantown|willow|rose|river|alley|station|square|avenue|road)\b/i
  const venueToken =
    /\b(cellar|atelier|promenade|stroll|walk|loop|collective|corner|room|hall|yard|grove)\b/i
  return geoToken.test(name) && venueToken.test(name)
}

function getHighlightValidityScore(candidate: ScoredVenue): number {
  const validity = candidate.highlightValidity
  if (validity.validityLevel === 'invalid') {
    return -0.2
  }
  if (validity.validityLevel === 'fallback') {
    return -0.05
  }
  if (!validity.validForIntent) {
    return -0.08
  }
  if (!validity.packLiteralRequirementSatisfied) {
    return -0.04
  }
  return 0.08
}

function getRoleSpecificLift(candidate: ScoredVenue, role: InternalRole): number {
  if (role === 'peak') {
    return (
      candidate.taste.signals.momentIntensity.score * 0.16 +
      candidate.taste.signals.momentPotential.score * 0.12 +
      candidate.taste.signals.momentElevationPotential * 0.08 +
      candidate.stopShapeFit.highlight * 0.07 +
      candidate.vibeAuthority.byRole.highlight * 0.05 +
      getHighlightValidityScore(candidate)
    )
  }

  if (role === 'warmup') {
    const durationBonus =
      candidate.taste.signals.durationEstimate === 'quick' ||
      candidate.taste.signals.durationEstimate === 'moderate'
        ? 0.04
        : 0
    return (
      candidate.taste.signals.roleSuitability.start * 0.08 +
      candidate.stopShapeFit.start * 0.06 +
      durationBonus
    )
  }

  if (role === 'cooldown') {
    const durationBonus =
      candidate.taste.signals.durationEstimate === 'moderate' ||
      candidate.taste.signals.durationEstimate === 'extended'
        ? 0.03
        : 0
    return (
      candidate.taste.signals.roleSuitability.windDown * 0.08 +
      candidate.stopShapeFit.windDown * 0.06 +
      candidate.taste.signals.lingerFactor * 0.03 +
      candidate.taste.signals.intimacy * 0.03 +
      candidate.taste.signals.conversationFriendliness * 0.02 +
      durationBonus
    )
  }

  return (
    candidate.taste.signals.roleSuitability.surprise * 0.06 +
    candidate.stopShapeFit.surprise * 0.05
  )
}

function getGenericPenalty(candidate: ScoredVenue, role: InternalRole): number {
  let penalty =
    candidate.taste.fallbackPenalty.signalScore * 0.18 +
    candidate.dominanceControl.universalityScore * 0.12 +
    (candidate.dominanceControl.flaggedUniversal ? 0.08 : 0)

  if (candidate.venue.source.sourceOrigin === 'curated' && !candidate.venue.source.providerRecordId) {
    penalty += 0.03
  }

  if (isDistrictStyleGenericName(candidate.venue.name)) {
    penalty += role === 'peak' ? 0.12 : 0.06
  }

  if (role === 'peak') {
    if (candidate.taste.signals.momentIntensity.score < 0.58) {
      penalty += 0.1
    }
    if (candidate.taste.signals.momentPotential.score < 0.55) {
      penalty += 0.08
    }
    if (candidate.highlightValidity.validityLevel !== 'valid') {
      penalty += 0.09
    }
  }

  return penalty
}

export function scoreAnchoredRoleFit(candidate: ScoredVenue, role: InternalRole): number {
  const base =
    candidate.roleScores[role] * 0.34 +
    candidate.fitScore * 0.16 +
    candidate.contextSpecificity.byRole[role] * 0.14 +
    candidate.roleContract[role].score * 0.11 +
    candidate.taste.modeAlignment.score * 0.06 +
    candidate.taste.signals.experientialFactor * 0.08 +
    candidate.taste.signals.categorySpecificity * 0.06 +
    candidate.taste.signals.personalityStrength * 0.05 +
    candidate.hiddenGemScore * 0.04 +
    candidate.fitBreakdown.uniquenessFit * 0.04 +
    (candidate.venue.source.providerRecordId ? 0.03 : 0) +
    (typeof candidate.venue.source.latitude === 'number' &&
    typeof candidate.venue.source.longitude === 'number'
      ? 0.03
      : 0)

  const roleLift = getRoleSpecificLift(candidate, role)
  const genericPenalty = getGenericPenalty(candidate, role)
  return clamp01(base + roleLift - genericPenalty)
}
