import { getHighlightVibeWeight } from './getHighlightVibeWeight'
import { getRoleShapeForVibe, getVibeProfile, scoreVibeTagAffinity } from './getVibeProfile'
import type { ExperienceLens, LensStopRole } from '../types/experienceLens'
import type { IntentProfile } from '../types/intent'
import type { StarterPack } from '../types/starterPack'
import type { Venue } from '../types/venue'

export type VibePressureSource = 'vibe' | 'pack' | 'both' | 'neutral'
export type MusicSupportSource =
  | 'vibe'
  | 'pack'
  | 'both'
  | 'neither'
  | 'not-applicable'
export type AdventureRead = 'outdoor' | 'urban' | 'balanced' | 'not-applicable'

export interface VibeAuthorityScore {
  primary: number
  secondary: number
  overall: number
  packPressure: {
    highlight: number
  }
  byRole: Record<LensStopRole, number>
  pressureSource: {
    highlight: VibePressureSource
  }
  musicSupportSource: MusicSupportSource
  adventureRead: AdventureRead
  adventureReadScores: {
    outdoor: number
    urban: number
  }
  adventureNotes: string[]
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase()
}

function tagOverlapScore(venueTags: string[], targetTags: string[]): number {
  if (targetTags.length === 0) {
    return 0
  }
  const normalizedVenueTags = new Set(venueTags.map(normalizeTag))
  const matches = targetTags.filter((tag) => normalizedVenueTags.has(normalizeTag(tag))).length
  return matches / targetTags.length
}

function scoreRoleProfileFit(
  venue: Venue,
  role: LensStopRole,
  vibe: IntentProfile['primaryAnchor'],
): number {
  const shape = getRoleShapeForVibe(vibe, role)
  const categoryFit = shape.preferredCategories.includes(venue.category) ? 1 : 0.38
  const categoryPenalty = shape.discouragedCategories.includes(venue.category) ? 0.28 : 0
  const tagFit = tagOverlapScore(venue.tags, shape.preferredTags)
  const discouragedTags = tagOverlapScore(venue.tags, shape.discouragedTags)
  const energyBand =
    venue.energyLevel <= 2 ? 'low' : venue.energyLevel <= 3 ? 'medium' : 'high'
  const energyFit = shape.energyPreference.includes(energyBand) ? 1 : 0.42
  const generalVibeFit = scoreVibeTagAffinity(venue, vibe)

  return clamp01(
    categoryFit * 0.3 +
      tagFit * 0.18 +
      energyFit * 0.18 +
      generalVibeFit * 0.34 -
      categoryPenalty -
      discouragedTags * 0.18,
  )
}

function scorePackHighlightPressure(venue: Venue, starterPack?: StarterPack): number {
  if (!starterPack) {
    return 0
  }

  const preferredCategories =
    starterPack.lensPreset?.preferredStopShapes?.highlight?.preferredCategories ??
    []
  const preferredTags =
    starterPack.lensPreset?.preferredStopShapes?.highlight?.preferredTags ?? []
  const contract = starterPack.roleContracts?.highlight
  const contractCategoryMatch =
    contract?.requiredCategories?.includes(venue.category) ||
    contract?.preferredCategories?.includes(venue.category)
      ? 1
      : 0
  const presetCategoryMatch = preferredCategories.includes(venue.category) ? 1 : 0
  const tagFit = tagOverlapScore(venue.tags, [
    ...preferredTags,
    ...(contract?.requiredTags ?? []),
    ...(contract?.preferredTags ?? []),
  ])

  return clamp01(
    contractCategoryMatch * 0.46 +
      presetCategoryMatch * 0.3 +
      tagFit * 0.24,
  )
}

function getHighlightPressureSource(
  vibeScore: number,
  packPressure: number,
): VibePressureSource {
  if (vibeScore >= 0.66 && packPressure >= 0.56) {
    return 'both'
  }
  if (vibeScore >= 0.66) {
    return 'vibe'
  }
  if (packPressure >= 0.56) {
    return 'pack'
  }
  return 'neutral'
}

function isMusicForwardVenue(venue: Venue): boolean {
  const normalizedTags = new Set(venue.tags.map(normalizeTag))
  return (
    venue.category === 'live_music' ||
    venue.category === 'event' ||
    normalizedTags.has('listening') ||
    normalizedTags.has('live') ||
    normalizedTags.has('jazz') ||
    normalizedTags.has('performance') ||
    normalizedTags.has('local-artists')
  )
}

function computeAdventureRead(venue: Venue): {
  read: AdventureRead
  outdoor: number
  urban: number
  notes: string[]
} {
  const normalizedTags = new Set(venue.tags.map(normalizeTag))
  const notes: string[] = []
  const outdoorTagMatches = [
    'trail',
    'viewpoint',
    'nature',
    'scenic',
    'fresh-air',
    'garden',
    'stargazing',
    'walkable',
    'open-air',
  ].filter((tag) => normalizedTags.has(tag)).length
  const urbanTagMatches = [
    'district',
    'street-food',
    'community',
    'local',
    'underexposed',
    'market',
    'food-hall',
    'live-popups',
    'neighborhood',
    'street-art',
  ].filter((tag) => normalizedTags.has(tag)).length

  const outdoor =
    (venue.category === 'park' ? 0.46 : venue.category === 'activity' ? 0.18 : 0) +
    outdoorTagMatches * 0.12 +
    (normalizedTags.has('outdoor-seating') ? 0.08 : 0)
  const urban =
    (venue.category === 'bar' ||
    venue.category === 'restaurant' ||
    venue.category === 'event' ||
    venue.category === 'live_music'
      ? 0.32
      : venue.category === 'cafe' || venue.category === 'dessert'
        ? 0.16
        : 0) +
    urbanTagMatches * 0.1

  if (outdoorTagMatches > 0 || venue.category === 'park') {
    notes.push('outdoor signal from category/tags')
  }
  if (urbanTagMatches > 0 || ['bar', 'restaurant', 'event', 'live_music'].includes(venue.category)) {
    notes.push('urban signal from category/tags')
  }

  if (outdoor === 0 && urban === 0) {
    return {
      read: 'not-applicable',
      outdoor: 0,
      urban: 0,
      notes,
    }
  }

  if (outdoor >= urban + 0.16) {
    return {
      read: 'outdoor',
      outdoor: clamp01(outdoor),
      urban: clamp01(urban),
      notes,
    }
  }
  if (urban >= outdoor + 0.16) {
    return {
      read: 'urban',
      outdoor: clamp01(outdoor),
      urban: clamp01(urban),
      notes,
    }
  }

  return {
    read: 'balanced',
    outdoor: clamp01(outdoor),
    urban: clamp01(urban),
    notes,
  }
}

function getMusicSupportSource(
  venue: Venue,
  intent: IntentProfile,
  packPressure: number,
): MusicSupportSource {
  if (!isMusicForwardVenue(venue)) {
    return 'not-applicable'
  }

  const profile = getVibeProfile(intent.primaryAnchor)
  const vibeSupportsMusic =
    profile.highlight.preferredCategories.includes('live_music') ||
    profile.highlight.preferredCategories.includes('event') ||
    profile.highlight.preferredTags.some((tag) =>
      ['live', 'listening', 'performance'].includes(normalizeTag(tag)),
    )

  if (vibeSupportsMusic && packPressure >= 0.56) {
    return 'both'
  }
  if (vibeSupportsMusic) {
    return 'vibe'
  }
  if (packPressure >= 0.56) {
    return 'pack'
  }
  return 'neither'
}

export function computeVibeAuthority(
  venue: Venue,
  intent: IntentProfile,
  lens: ExperienceLens,
  starterPack?: StarterPack,
): VibeAuthorityScore {
  const primary = scoreVibeTagAffinity(venue, intent.primaryAnchor)
  const secondaryValues = (intent.secondaryAnchors ?? []).map((anchor) =>
    scoreVibeTagAffinity(venue, anchor),
  )
  const secondary =
    secondaryValues.length > 0
      ? secondaryValues.reduce((sum, value) => sum + value, 0) / secondaryValues.length
      : 0
  const adventureRead = computeAdventureRead(venue)
  const adventureSplitLift =
    intent.primaryAnchor === 'adventurous-outdoor'
      ? clamp01(adventureRead.outdoor) * 0.22 - clamp01(adventureRead.urban) * 0.18
      : intent.primaryAnchor === 'adventurous-urban'
        ? clamp01(adventureRead.urban) * 0.22 - clamp01(adventureRead.outdoor) * 0.18
        : 0

  const byRole: Record<LensStopRole, number> = {
    start: clamp01(
      scoreRoleProfileFit(venue, 'start', intent.primaryAnchor) * 0.78 +
        secondary * 0.12 +
        adventureSplitLift * 0.65 +
        (lens.preferredStopShapes.start.preferredCategories.includes(venue.category)
          ? 0.1
          : 0),
    ),
    highlight: clamp01(
      scoreRoleProfileFit(venue, 'highlight', intent.primaryAnchor) *
        (1 + getHighlightVibeWeight(intent, starterPack)) +
        secondary * 0.18 +
        adventureSplitLift,
    ),
    surprise: clamp01(
      scoreRoleProfileFit(venue, 'surprise', intent.primaryAnchor) * 0.74 +
        secondary * 0.18 +
        adventureSplitLift * 0.5 +
        (lens.discoveryBias === 'high' ? venue.underexposureScore * 0.08 : 0),
    ),
    windDown: clamp01(
      scoreRoleProfileFit(venue, 'windDown', intent.primaryAnchor) * 0.84 +
        secondary * 0.14 +
        adventureSplitLift * 0.56,
    ),
  }

  const overall = clamp01(
    primary * 0.66 +
      secondary * 0.18 +
      byRole.highlight * 0.1 +
      byRole.windDown * 0.06 +
      adventureSplitLift * 0.12,
  )
  const packHighlightPressure = scorePackHighlightPressure(venue, starterPack)

  return {
    primary,
    secondary,
    overall,
    packPressure: {
      highlight: packHighlightPressure,
    },
    byRole,
    pressureSource: {
      highlight: getHighlightPressureSource(byRole.highlight, packHighlightPressure),
    },
    musicSupportSource: getMusicSupportSource(venue, intent, packHighlightPressure),
    adventureRead: adventureRead.read,
    adventureReadScores: {
      outdoor: adventureRead.outdoor,
      urban: adventureRead.urban,
    },
    adventureNotes: adventureRead.notes,
  }
}
