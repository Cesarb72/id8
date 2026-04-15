import type { ScoredVenue } from '../types/arc'
import type { DistanceMode, IntentProfile } from '../types/intent'

export const STRICT_NEARBY_DRIVE_MINUTES = 14
export const BOUNDED_NEARBY_STRETCH_DRIVE_MINUTES = 18

export type CanonicalDistanceStatus =
  | 'inside_strict_nearby'
  | 'inside_bounded_stretch'
  | 'outside_bounded_stretch'

function isHospitalityArchetype(
  archetype: ScoredVenue['taste']['signals']['primaryExperienceArchetype'],
): boolean {
  return archetype === 'dining' || archetype === 'drinks' || archetype === 'sweet'
}

export function getCanonicalDistanceStatus(driveMinutes: number): CanonicalDistanceStatus {
  if (driveMinutes <= STRICT_NEARBY_DRIVE_MINUTES) {
    return 'inside_strict_nearby'
  }
  if (driveMinutes <= BOUNDED_NEARBY_STRETCH_DRIVE_MINUTES) {
    return 'inside_bounded_stretch'
  }
  return 'outside_bounded_stretch'
}

export function isWithinStrictNearbyWindow(
  driveMinutes: number,
  distanceMode: DistanceMode,
): boolean {
  return distanceMode === 'nearby' && getCanonicalDistanceStatus(driveMinutes) === 'inside_strict_nearby'
}

export function isOutsideStrictNearbyButWithinBoundedStretch(
  driveMinutes: number,
  distanceMode: DistanceMode,
): boolean {
  return distanceMode === 'nearby' && getCanonicalDistanceStatus(driveMinutes) === 'inside_bounded_stretch'
}

export function getStretchDistanceStatus(
  candidate: ScoredVenue,
  intent: IntentProfile,
): string {
  const status = getCanonicalDistanceStatus(candidate.venue.driveMinutes)
  if (status === 'inside_strict_nearby') {
    return 'inside nearby'
  }
  if (status === 'inside_bounded_stretch') {
    return 'outside nearby but within bounded stretch'
  }
  return intent.distanceMode === 'nearby'
    ? 'outside nearby and outside bounded stretch'
    : 'outside bounded stretch'
}

export function isMeaningfulMomentStretchCandidate(
  candidate: ScoredVenue,
  intent: IntentProfile,
): boolean {
  if (
    !isOutsideStrictNearbyButWithinBoundedStretch(
      candidate.venue.driveMinutes,
      intent.distanceMode,
    )
  ) {
    return false
  }

  const archetype = candidate.taste.signals.primaryExperienceArchetype
  const genericHospitalityFallback =
    isHospitalityArchetype(archetype) &&
    candidate.taste.signals.momentPotential.score < 0.72 &&
    candidate.venue.signature.genericScore >= 0.45
  const contractRelevant =
    candidate.taste.modeAlignment.score >= 0.56 ||
    candidate.taste.signals.isRomanticMomentCandidate ||
    candidate.roleContract.peak.score >= 0.62 ||
    candidate.taste.signals.anchorStrength >= 0.7

  return (
    candidate.momentIdentity.strength === 'strong' &&
    candidate.roleScores.peak >= 0.64 &&
    candidate.stopShapeFit.highlight >= 0.4 &&
    candidate.highlightValidity.validityLevel !== 'invalid' &&
    candidate.taste.signals.momentPotential.score >= 0.66 &&
    contractRelevant &&
    !genericHospitalityFallback
  )
}

export function isCandidateWithinActiveDistanceWindow(
  candidate: ScoredVenue,
  intent: IntentProfile,
  options: {
    allowMeaningfulStretch?: boolean
  } = {},
): boolean {
  if (intent.distanceMode !== 'nearby') {
    return candidate.fitBreakdown.proximityFit >= 0.48
  }

  const status = getCanonicalDistanceStatus(candidate.venue.driveMinutes)
  if (status === 'inside_strict_nearby') {
    return true
  }
  if (status === 'inside_bounded_stretch' && options.allowMeaningfulStretch) {
    return isMeaningfulMomentStretchCandidate(candidate, intent)
  }
  return false
}

export function isCandidateUsedByStretch(
  candidate: ScoredVenue,
  intent: IntentProfile,
): boolean {
  return (
    intent.distanceMode === 'nearby' &&
    getCanonicalDistanceStatus(candidate.venue.driveMinutes) === 'inside_bounded_stretch' &&
    isMeaningfulMomentStretchCandidate(candidate, intent)
  )
}
