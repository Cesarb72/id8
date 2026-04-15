import { computeHybridLiveLift } from './computeHybridLiveLift'
import { computeLiveQualityFairness } from './computeLiveQualityFairness'
import { computeRoleAwareHoursPressure } from './computeRoleAwareHoursPressure'
import type { ScoredVenue } from '../types/arc'
import type { InternalRole } from '../types/venue'

export interface RoleAwareLiveLift {
  promotion: number
  qualifies: boolean
  notes: string[]
}

const emptyLift: RoleAwareLiveLift = {
  promotion: 0,
  qualifies: false,
  notes: [],
}

export function computeRoleAwareLiveLift(
  item: ScoredVenue,
  role: InternalRole,
): RoleAwareLiveLift {
  if (item.venue.source.sourceOrigin !== 'live') {
    return emptyLift
  }

  const baseLift = computeHybridLiveLift(item.venue)
  const notes: string[] = []
  const liveFairness = computeLiveQualityFairness(item.venue)
  const highConfidence =
    item.venue.source.sourceConfidence >= (liveFairness.supportRecoveryEligible ? 0.66 : 0.72) &&
    item.venue.source.completenessScore >= 0.58
  const roleHours = computeRoleAwareHoursPressure(item.venue, role)
  const strongHours =
    item.venue.source.likelyOpenForCurrentWindow &&
    item.venue.source.timeConfidence >= (role === 'peak' ? 0.72 : liveFairness.supportRecoveryEligible ? 0.46 : 0.56) &&
    !item.venue.source.hoursSuppressionApplied

  if (role === 'warmup') {
    const qualifies =
      baseLift.strongLiveCandidate &&
      strongHours &&
      highConfidence &&
      item.roleScores.warmup >= 0.64 &&
      item.stopShapeFit.start >= (liveFairness.supportRecoveryEligible ? 0.52 : 0.56) &&
      item.vibeAuthority.byRole.start >= 0.58 &&
      item.venue.energyLevel <= 3 &&
      roleHours.penalty <= (liveFairness.supportRecoveryEligible ? 0.05 : 0.04) &&
      (item.venue.category === 'cafe' || item.venue.category === 'restaurant')
    if (!qualifies) {
      return emptyLift
    }
    notes.push('strong live start candidate')
    return {
      promotion: item.venue.category === 'cafe' ? 0.052 : liveFairness.supportRecoveryEligible ? 0.048 : 0.044,
      qualifies: true,
      notes,
    }
  }

  if (role === 'cooldown') {
    const qualifies =
      baseLift.strongLiveCandidate &&
      strongHours &&
      highConfidence &&
      item.roleScores.cooldown >= 0.66 &&
      item.stopShapeFit.windDown >= (liveFairness.supportRecoveryEligible ? 0.54 : 0.58) &&
      item.vibeAuthority.byRole.windDown >= 0.56 &&
      item.venue.energyLevel <= 3 &&
      roleHours.penalty <= (liveFairness.supportRecoveryEligible ? 0.05 : 0.04) &&
      (item.venue.category === 'cafe' ||
        item.venue.category === 'restaurant' ||
        item.venue.category === 'bar')
    if (!qualifies) {
      return emptyLift
    }
    notes.push('strong live wind-down candidate')
    return {
      promotion:
        item.venue.category === 'cafe' || item.venue.energyLevel <= 2 ? 0.05 : 0.042,
      qualifies: true,
      notes,
    }
  }

  if (role === 'peak') {
    const qualifies =
      baseLift.strongHighlightCandidate &&
      strongHours &&
      highConfidence &&
      item.highlightValidity.validityLevel === 'valid' &&
      item.roleScores.peak >= 0.72 &&
      item.stopShapeFit.highlight >= 0.56 &&
      item.vibeAuthority.byRole.highlight >= 0.64 &&
      roleHours.penalty <= 0.03 &&
      item.venue.source.qualityScore >= 0.74
    if (!qualifies) {
      return emptyLift
    }
    notes.push('selective live highlight promotion applied')
    return {
      promotion: item.venue.category === 'bar' || item.venue.category === 'restaurant' ? 0.034 : 0.024,
      qualifies: true,
      notes,
    }
  }

  if (
    baseLift.freshnessLiftApplied &&
    item.roleScores.wildcard >= 0.62 &&
    item.stopShapeFit.surprise >= 0.5 &&
    item.venue.signature.signatureScore >= 0.64
  ) {
    notes.push('live wildcard promotion applied')
    return {
      promotion: 0.014,
      qualifies: true,
      notes,
    }
  }

  return emptyLift
}
