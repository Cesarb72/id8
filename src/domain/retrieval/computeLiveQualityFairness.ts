import type { Venue } from '../types/venue'

export interface LiveQualityFairnessProfile {
  supportRecoveryEligible: boolean
  qualityBonus: number
  fitBonus: number
  genericRelief: number
  hoursGrace: number
  notes: string[]
}

const emptyProfile: LiveQualityFairnessProfile = {
  supportRecoveryEligible: false,
  qualityBonus: 0,
  fitBonus: 0,
  genericRelief: 0,
  hoursGrace: 0,
  notes: [],
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function normalizeValue(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_]+/g, '-')
}

function countMatches(values: Set<string>, candidates: string[]): number {
  return candidates.filter((candidate) => values.has(normalizeValue(candidate))).length
}

export function computeLiveQualityFairness(venue: Venue): LiveQualityFairnessProfile {
  if (venue.source.sourceOrigin !== 'live') {
    return emptyProfile
  }

  const normalizedSignals = new Set<string>([
    ...venue.tags.map(normalizeValue),
    ...venue.source.sourceTypes.map(normalizeValue),
    ...(venue.source.sourceQueryLabel
      ? venue.source.sourceQueryLabel
          .split(/[^a-z0-9]+/i)
          .map(normalizeValue)
          .filter(Boolean)
      : []),
  ])
  const notes: string[] = []

  const distinctiveSignals = countMatches(normalizedSignals, [
    'cocktails',
    'wine',
    'coffee',
    'espresso-bar',
    'tea-house',
    'brunch',
    'chef-led',
    'seasonal',
    'local',
    'artisan',
    'craft',
    'cozy',
    'intimate',
    'rooftop',
    'outdoor-seating',
    'quiet',
    'museum',
    'gallery',
    'historic',
    'park',
    'trail',
    'event',
    'discovery',
    'cultural',
  ])
  const supportedCategory =
    venue.category === 'restaurant' ||
    venue.category === 'bar' ||
    venue.category === 'cafe' ||
    venue.category === 'dessert' ||
    venue.category === 'museum' ||
    venue.category === 'activity' ||
    venue.category === 'park' ||
    venue.category === 'event'
  const supportFriendly =
    venue.category === 'cafe' ||
    venue.category === 'restaurant' ||
    venue.category === 'dessert' ||
    venue.category === 'museum' ||
    venue.category === 'activity' ||
    venue.category === 'park' ||
    venue.category === 'event' ||
    (venue.category === 'bar' && venue.settings.dateFriendly) ||
    venue.settings.supportOnly
  const strongRecord =
    venue.source.sourceConfidence >= 0.56 && venue.source.completenessScore >= 0.56
  const signatureFairness = clamp01(
    venue.signature.signatureScore * 0.34 +
      (1 - venue.signature.genericScore) * 0.24 +
      venue.source.sourceConfidence * 0.18 +
      venue.source.completenessScore * 0.14 +
      Math.min(distinctiveSignals, 4) * 0.04,
  )

  const supportRecoveryEligible =
    supportedCategory &&
    supportFriendly &&
    strongRecord &&
    !venue.signature.chainLike &&
    !venue.source.hoursSuppressionApplied &&
    (signatureFairness >= 0.56 || distinctiveSignals >= 2)

  if (supportRecoveryEligible) {
    notes.push('live support candidate has enough metadata to compete fairly')
  }
  if (distinctiveSignals >= 2) {
    notes.push('distinctive live metadata reduced genericity')
  }

  return {
    supportRecoveryEligible,
    qualityBonus: supportRecoveryEligible
      ? Number((Math.min(0.05, 0.012 + signatureFairness * 0.032)).toFixed(3))
      : 0,
    fitBonus: supportRecoveryEligible
      ? Number((Math.min(0.024, 0.006 + signatureFairness * 0.016)).toFixed(3))
      : 0,
    genericRelief: supportRecoveryEligible
      ? Number((Math.min(0.1, 0.02 + Math.min(distinctiveSignals, 4) * 0.015)).toFixed(3))
      : 0,
    hoursGrace:
      supportRecoveryEligible && !venue.source.hoursKnown
        ? 0.018
        : supportRecoveryEligible
          ? 0.008
          : 0,
    notes,
  }
}
