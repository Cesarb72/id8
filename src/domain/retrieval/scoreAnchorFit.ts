import { getVibeProfile, scoreVibeTagAffinity, venueMatchesVibeTag } from '../taste/getVibeProfile'
import type { IntentProfile } from '../types/intent'
import type { Venue } from '../types/venue'

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function scoreAnchorCategoryPressure(venue: Venue, anchor: IntentProfile['primaryAnchor']): number {
  const profile = getVibeProfile(anchor)
  const categoryFit = profile.preferredCategories.includes(venue.category) ? 1 : 0.32
  const categoryPenalty = profile.discouragedCategories.includes(venue.category) ? 0.28 : 0
  return clamp01(categoryFit - categoryPenalty)
}

export function scoreAnchorFit(venue: Venue, intent: IntentProfile): number {
  const anchors = [intent.primaryAnchor, ...(intent.secondaryAnchors ?? [])]
  const scores = anchors.map((anchor, index) => {
    const directAffinity = scoreVibeTagAffinity(venue, anchor)
    const categoryPressure = scoreAnchorCategoryPressure(venue, anchor)
    const exactVibeMatch = venueMatchesVibeTag(venue, anchor) ? 1 : 0
    const anchorStrength = index === 0 ? 1 : 0.58

    return clamp01(
      (directAffinity * 0.62 + categoryPressure * 0.24 + exactVibeMatch * 0.14) *
        anchorStrength,
    )
  })

  const weightedSum = scores.reduce(
    (sum, score, index) => sum + score * (index === 0 ? 0.82 : 0.18),
    0,
  )
  const totalWeight = scores.length > 1 ? 1 : 0.82
  return clamp01(weightedSum / totalWeight)
}
