import type {
  CoordinationCandidate,
  CoordinationDiversityDimension,
  CoordinationSignalComponent,
} from './coordinationPrimitive'
import type {
  DistrictOpportunityProfile,
  RankAndSelectPocketsResult,
  RankedPocket,
} from '../../../engines/district/types/districtTypes'

const DEFAULT_SELECT_LIMIT = 6
const SECONDARY_POCKET_SURVIVAL_BAND = 0.2

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function getRankScore(profile: DistrictOpportunityProfile): number {
  return clamp(profile.score.totalScore - profile.meta.fallbackPenaltyApplied, 0, 1)
}

function getSetOverlap(left: string[], right: string[]): number {
  const leftSet = new Set(left.map((value) => value.toLowerCase()))
  const rightSet = new Set(right.map((value) => value.toLowerCase()))
  if (leftSet.size === 0 || rightSet.size === 0) {
    return 0
  }
  let intersection = 0
  for (const value of leftSet) {
    if (rightSet.has(value)) {
      intersection += 1
    }
  }
  const unionSize = new Set([...leftSet, ...rightSet]).size
  return unionSize > 0 ? intersection / unionSize : 0
}

function getDominantMixChannel(
  profile: DistrictOpportunityProfile,
): 'drinks' | 'dining' | 'culture' | 'cafe' | 'activity' {
  const mix = profile.tasteSignals.hospitalityMix
  return (Object.entries(mix).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1]
    }
    return left[0].localeCompare(right[0])
  })[0]?.[0] ?? 'activity') as 'drinks' | 'dining' | 'culture' | 'cafe' | 'activity'
}

function buildCoordinationSignals(
  profile: DistrictOpportunityProfile,
): CoordinationSignalComponent[] {
  return [
    {
      source: 'compat',
      key: 'rank_score',
      value: getRankScore(profile),
      reason: 'Compatibility score used for preserved District pocket ranking.',
    },
    {
      source: 'compat',
      key: 'base_score',
      value: profile.score.totalScore,
    },
    {
      source: 'bearings',
      key: 'viability',
      value: profile.coreSignals.viability,
    },
    {
      source: 'district',
      key: 'entity_count',
      value: profile.entityCount,
    },
  ]
}

function buildDiversityDimensions(
  profile: DistrictOpportunityProfile,
): CoordinationDiversityDimension[] {
  return [
    {
      source: 'district',
      key: 'category_signature',
      value: profile.categories.join('|'),
    },
    {
      source: 'taste',
      key: 'meaning_tag_signature',
      value: profile.tasteSignals.experientialTags.join('|'),
    },
    {
      source: 'district',
      key: 'primary_anchor',
      value: profile.hyperlocal?.primaryAnchor?.entityId ?? '',
    },
  ]
}

function buildCoordinationCandidate(
  profile: DistrictOpportunityProfile,
): CoordinationCandidate<DistrictOpportunityProfile> {
  return {
    id: profile.pocketId,
    payload: profile,
    signals: buildCoordinationSignals(profile),
    diversity: buildDiversityDimensions(profile),
    fallback: {
      source: 'compat',
      key: 'degraded_fallback',
      applied: profile.meta.isDegradedFallback,
      penalty: profile.meta.fallbackPenaltyApplied,
      reason: profile.meta.origin,
    },
    deterministicTieBreakKey: profile.label,
  }
}

function getSecondaryVarietyGain(
  profile: DistrictOpportunityProfile,
  retainedProfiles: DistrictOpportunityProfile[],
): number {
  if (retainedProfiles.length === 0) {
    return 0
  }
  const familyContrastScore =
    retainedProfiles.filter((entry) =>
      entry.tasteSignals.experientialTags.some(
        (tag) => !profile.tasteSignals.experientialTags.includes(tag),
      ),
    ).length / retainedProfiles.length
  const archetypeContrastScore =
    retainedProfiles.filter(
      (entry) => getDominantMixChannel(entry) !== getDominantMixChannel(profile),
    ).length / retainedProfiles.length
  const identityContrastScore =
    retainedProfiles.filter(
      (entry) => getSetOverlap(entry.categories, profile.categories) < 0.4,
    ).length / retainedProfiles.length
  const anchorId = profile.hyperlocal?.primaryAnchor?.entityId
  const distinctAnchorScore =
    anchorId &&
    retainedProfiles.every((entry) => entry.hyperlocal?.primaryAnchor?.entityId !== anchorId)
      ? 1
      : 0
  const interpretableShapeScore = clamp(
    (profile.hyperlocal?.primaryMicroPocket.identityStrength ?? 0.5) * 0.56 +
      (profile.hyperlocal?.primaryMicroPocket.coherenceScore ?? 0.5) * 0.44,
    0,
    1,
  )

  return clamp(
    familyContrastScore * 0.26 +
      archetypeContrastScore * 0.24 +
      identityContrastScore * 0.2 +
      distinctAnchorScore * 0.14 +
      interpretableShapeScore * 0.16,
    0,
    1,
  )
}

function buildReasons(profile: DistrictOpportunityProfile): string[] {
  const reasons = [
    `Score ${profile.score.totalScore} with viability ${profile.classification}.`,
    `${profile.entityCount} entities and ${profile.categories.length} leading categories.`,
    `Walkability ${profile.coreSignals.walkability}, density ${profile.coreSignals.density}.`,
  ]
  if (profile.meta.isDegradedFallback) {
    reasons.push(
      `Degraded fallback (${profile.meta.origin}) truth-tier ${profile.meta.truthTier}; penalty ${profile.meta.fallbackPenaltyApplied.toFixed(3)}.`,
    )
  }
  return reasons
}

export function rankAndSelectPockets(
  profiles: DistrictOpportunityProfile[],
  selectLimit = DEFAULT_SELECT_LIMIT,
): RankAndSelectPocketsResult {
  const coordinationCandidates = profiles.map(buildCoordinationCandidate)
  const sorted = [...coordinationCandidates].sort((leftCandidate, rightCandidate) => {
    const left = leftCandidate.payload
    const right = rightCandidate.payload
    const rightRankScore = getRankScore(right)
    const leftRankScore = getRankScore(left)
    if (rightRankScore !== leftRankScore) {
      return rightRankScore - leftRankScore
    }
    if (right.coreSignals.viability !== left.coreSignals.viability) {
      return right.coreSignals.viability - left.coreSignals.viability
    }
    if (right.entityCount !== left.entityCount) {
      return right.entityCount - left.entityCount
    }
    return left.label.localeCompare(right.label)
  }).map((candidate) => candidate.payload)

  const ranked: RankedPocket[] = sorted.map((profile, index) => ({
    rank: index + 1,
    score: getRankScore(profile),
    baseScore: profile.score.totalScore,
    degradedPenaltyApplied: profile.meta.fallbackPenaltyApplied,
    reasons: buildReasons(profile),
    profile,
  }))

  const baseSelected = ranked.slice(0, Math.max(1, selectLimit))
  const topScore = ranked[0]?.score ?? 0
  const secondarySurvivors = ranked.filter((entry) => {
    if (entry.rank <= 1) {
      return false
    }
    if (entry.profile.classification === 'weak' || entry.profile.classification === 'reject') {
      return false
    }
    return topScore - entry.score <= SECONDARY_POCKET_SURVIVAL_BAND
  }).sort((left, right) => {
    const leftGain = getSecondaryVarietyGain(
      left.profile,
      baseSelected.map((entry) => entry.profile),
    )
    const rightGain = getSecondaryVarietyGain(
      right.profile,
      baseSelected.map((entry) => entry.profile),
    )
    if (rightGain !== leftGain) {
      return rightGain - leftGain
    }
    if (right.score !== left.score) {
      return right.score - left.score
    }
    return left.profile.pocketId.localeCompare(right.profile.pocketId)
  })
  const selectedPocketIds = new Set<string>()
  const selected = [...baseSelected, ...secondarySurvivors].filter((entry) => {
    if (selectedPocketIds.has(entry.profile.pocketId)) {
      return false
    }
    selectedPocketIds.add(entry.profile.pocketId)
    return true
  })

  return {
    ranked,
    selected,
  }
}
