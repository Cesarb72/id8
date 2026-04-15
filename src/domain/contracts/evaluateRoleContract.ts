import type { RoleContractEvaluation, RoleContractRule } from '../types/roleContract'
import type { Venue } from '../types/venue'

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function normalizedTags(venue: Venue): Set<string> {
  return new Set(venue.tags.map((tag) => tag.toLowerCase()))
}

function overlapScore(venue: Venue, tags: string[]): number {
  if (tags.length === 0) {
    return 0
  }
  const tagsSet = normalizedTags(venue)
  let matches = 0
  for (const tag of tags) {
    if (tagsSet.has(tag.toLowerCase())) {
      matches += 1
    }
  }
  return matches / tags.length
}

export function evaluateRoleContract(
  venue: Venue,
  rule: RoleContractRule,
): RoleContractEvaluation {
  if (rule.strength === 'none') {
    return {
      contractLabel: rule.label,
      strength: rule.strength,
      score: 1,
      satisfied: true,
      matchedSignals: [],
      violations: [],
    }
  }

  const matches: string[] = []
  const violations: string[] = []

  const requiredCategoryMet =
    rule.requiredCategories.length === 0 || rule.requiredCategories.includes(venue.category)
  if (rule.requiredCategories.length > 0) {
    if (requiredCategoryMet) {
      matches.push('required category matched')
    } else {
      violations.push('required category missing')
    }
  }

  const requiredTagScore = overlapScore(venue, rule.requiredTags)
  const requiredTagMet = rule.requiredTags.length === 0 || requiredTagScore > 0
  if (rule.requiredTags.length > 0) {
    if (requiredTagMet) {
      matches.push('required tag matched')
    } else {
      violations.push('required tag missing')
    }
  }

  const preferredCategoryScore =
    rule.preferredCategories.length === 0
      ? 0.7
      : rule.preferredCategories.includes(venue.category)
        ? 1
        : 0.25
  if (rule.preferredCategories.includes(venue.category)) {
    matches.push('preferred category matched')
  }

  const preferredTagScore = overlapScore(venue, rule.preferredTags)
  if (preferredTagScore > 0) {
    matches.push('preferred tag matched')
  }

  const discouragedCategoryPenalty = rule.discouragedCategories.includes(venue.category) ? 0.28 : 0
  if (discouragedCategoryPenalty > 0) {
    violations.push('discouraged category')
  }
  const discouragedTagPenalty = overlapScore(venue, rule.discouragedTags) * 0.22
  if (discouragedTagPenalty > 0) {
    violations.push('discouraged tag')
  }

  const maxEnergyPenalty =
    typeof rule.maxEnergyLevel === 'number' && venue.energyLevel > rule.maxEnergyLevel
      ? clamp01((venue.energyLevel - rule.maxEnergyLevel) / 4)
      : 0
  if (maxEnergyPenalty > 0) {
    violations.push('energy too high')
  }

  const score = clamp01(
    preferredCategoryScore * 0.42 +
      preferredTagScore * 0.24 +
      requiredTagScore * 0.14 +
      (requiredCategoryMet ? 0.2 : 0) -
      discouragedCategoryPenalty -
      discouragedTagPenalty -
      maxEnergyPenalty,
  )

  const hardFail = !requiredCategoryMet || !requiredTagMet
  const satisfied =
    rule.strength === 'hard'
      ? !hardFail && score >= 0.62
      : rule.strength === 'strong'
        ? !hardFail && score >= 0.55
        : score >= 0.45

  return {
    contractLabel: rule.label,
    strength: rule.strength,
    score,
    satisfied,
    matchedSignals: matches,
    violations,
  }
}
