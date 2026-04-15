import { computeLiveQualityFairness } from './computeLiveQualityFairness'
import type { InternalRole, Venue } from '../types/venue'

export interface HybridLiveLiftProfile {
  fitLift: number
  rolePoolLift: number
  roleLiftByRole: Record<InternalRole, number>
  dedupePriorityScore: number
  liftApplied: boolean
  freshnessLiftApplied: boolean
  strongLiveCandidate: boolean
  strongHighlightCandidate: boolean
  notes: string[]
}

const emptyRoleLift: Record<InternalRole, number> = {
  warmup: 0,
  peak: 0,
  wildcard: 0,
  cooldown: 0,
}

const emptyProfile: HybridLiveLiftProfile = {
  fitLift: 0,
  rolePoolLift: 0,
  roleLiftByRole: emptyRoleLift,
  dedupePriorityScore: 0,
  liftApplied: false,
  freshnessLiftApplied: false,
  strongLiveCandidate: false,
  strongHighlightCandidate: false,
  notes: [],
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function computeHybridLiveLift(venue: Venue): HybridLiveLiftProfile {
  if (venue.source.sourceOrigin !== 'live') {
    return emptyProfile
  }

  const notes: string[] = []
  const approved = venue.source.qualityGateStatus === 'approved'
  const demoted = venue.source.qualityGateStatus === 'demoted'
  const liveFairness = computeLiveQualityFairness(venue)
  const strongHours =
    venue.source.likelyOpenForCurrentWindow &&
    venue.source.timeConfidence >= 0.68 &&
    !venue.source.hoursSuppressionApplied
  const softHours =
    venue.source.likelyOpenForCurrentWindow &&
    venue.source.timeConfidence >= 0.5 &&
    !venue.source.hoursSuppressionApplied
  const strongSource =
    venue.source.sourceConfidence >= 0.72 &&
    venue.source.completenessScore >= 0.58 &&
    venue.source.qualityScore >= 0.72
  const fairSupportSource =
    venue.source.sourceConfidence >= 0.6 &&
    venue.source.completenessScore >= 0.56 &&
    venue.source.qualityScore >= 0.6
  const signatureForward =
    venue.signature.signatureScore >= 0.58 && venue.signature.genericScore <= 0.44
  const highlightReady =
    venue.highlightCapable &&
    venue.settings.highlightCapabilityTier === 'highlight-capable' &&
    !venue.settings.connectiveOnly
  const supportReady =
    !venue.settings.connectiveOnly &&
    (venue.category === 'cafe' ||
      venue.category === 'restaurant' ||
      venue.settings.dateFriendly ||
      venue.settings.adultSocial)
  const freshnessLiftApplied = approved && strongSource && signatureForward
  const strongLiveCandidate =
    (approved && strongSource && (strongHours || softHours)) ||
    (demoted && supportReady && liveFairness.supportRecoveryEligible && fairSupportSource && venue.source.timeConfidence >= 0.4)
  const strongHighlightCandidate = strongLiveCandidate && highlightReady

  let fitLift = 0
  fitLift += strongHours ? 0.028 : softHours ? 0.016 : 0
  fitLift += freshnessLiftApplied ? 0.016 : approved && signatureForward ? 0.008 : 0
  fitLift += demoted && liveFairness.supportRecoveryEligible ? 0.008 : 0
  fitLift += approved && venue.source.qualityScore >= 0.78 ? 0.008 : 0
  fitLift -= demoted ? 0.006 : 0

  const roleLiftByRole: Record<InternalRole, number> = {
    warmup:
      strongLiveCandidate && supportReady
        ? liveFairness.supportRecoveryEligible ? 0.024 : 0.018
        : softHours && venue.category === 'cafe'
          ? 0.01
          : 0,
    peak: strongHighlightCandidate ? 0.042 : strongLiveCandidate && highlightReady ? 0.024 : 0,
    wildcard: freshnessLiftApplied && venue.signature.signatureScore >= 0.62 ? 0.016 : 0,
    cooldown:
      strongLiveCandidate &&
      supportReady &&
      venue.energyLevel <= 3
        ? liveFairness.supportRecoveryEligible ? 0.022 : 0.016
        : softHours && venue.energyLevel <= 3
          ? 0.008
          : 0,
  }
  const rolePoolLift =
    (strongHighlightCandidate ? 0.018 : 0) +
    (strongLiveCandidate && !strongHighlightCandidate ? 0.01 : 0) +
    (freshnessLiftApplied ? 0.008 : 0)
  const dedupePriorityScore = clamp(
    venue.source.qualityScore * 0.34 +
      venue.source.sourceConfidence * 0.22 +
      venue.source.completenessScore * 0.16 +
      venue.source.timeConfidence * 0.14 +
      venue.signature.signatureScore * 0.14 +
      (strongHours ? 0.08 : softHours ? 0.03 : 0),
    0,
    1,
  )

  if (strongHours) {
    notes.push('current-window hours support is strong')
  } else if (softHours) {
    notes.push('hours support is positive enough to compete')
  }
  if (freshnessLiftApplied) {
    notes.push('fresh live discovery lift applied')
  }
  if (demoted && liveFairness.supportRecoveryEligible) {
    notes.push('demoted live support venue stayed competitive on fair-quality recovery')
  }
  if (strongHighlightCandidate) {
    notes.push('live venue is strong enough to anchor Highlight competition')
  } else if (strongLiveCandidate) {
    notes.push('live venue is strong enough to stay competitive downstream')
  }

  const liftApplied =
    fitLift > 0.001 ||
    rolePoolLift > 0.001 ||
    Object.values(roleLiftByRole).some((value) => value > 0.001)

  return {
    fitLift,
    rolePoolLift,
    roleLiftByRole,
    dedupePriorityScore,
    liftApplied,
    freshnessLiftApplied,
    strongLiveCandidate,
    strongHighlightCandidate,
    notes,
  }
}
