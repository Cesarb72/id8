import type {
  LensBias,
  LensEnergy,
  LensStopRole,
  LensTone,
  MovementTolerance,
  StopShapeProfile,
} from '../types/experienceLens'
import type { VibeAnchor, VenueVibeTag } from '../types/intent'
import type { Venue, VenueCategory } from '../types/venue'

export interface VibeProfile {
  vibe: VibeAnchor
  label: string
  sublabel: string
  legacyTags: VenueVibeTag[]
  idealEnergyRange: [number, number]
  preferredCategories: VenueCategory[]
  discouragedCategories: VenueCategory[]
  preferredTags: string[]
  discouragedTags: string[]
  toneBias: LensTone
  discoveryBias: LensBias
  movementTolerance: MovementTolerance
  energyBand: LensEnergy[]
  start: StopShapeProfile
  highlight: StopShapeProfile
  surprise: StopShapeProfile
  windDown: StopShapeProfile
}

function buildShape(
  preferredCategories: VenueCategory[],
  discouragedCategories: VenueCategory[],
  preferredTags: string[],
  discouragedTags: string[],
  energyPreference: LensEnergy[],
): StopShapeProfile {
  return {
    preferredCategories,
    discouragedCategories,
    preferredTags,
    discouragedTags,
    energyPreference,
  }
}

const vibeProfiles: Record<VibeAnchor, VibeProfile> = {
  cozy: {
    vibe: 'cozy',
    label: 'Cozy',
    sublabel: 'warm | intimate | relaxed',
    legacyTags: ['cozy', 'culinary', 'relaxed'],
    idealEnergyRange: [1, 3],
    preferredCategories: ['restaurant', 'cafe', 'dessert', 'park'],
    discouragedCategories: ['activity', 'event', 'live_music'],
    preferredTags: ['cozy', 'intimate', 'conversation', 'slow-paced', 'craft', 'wine'],
    discouragedTags: ['high-energy', 'crowded', 'arcade', 'festival', 'chaotic'],
    toneBias: 'intimate',
    discoveryBias: 'medium',
    movementTolerance: 'low',
    energyBand: ['low', 'medium'],
    start: buildShape(
      ['cafe', 'park', 'restaurant'],
      ['activity', 'event'],
      ['cozy', 'walkable', 'intimate', 'conversation'],
      ['arcade', 'high-energy'],
      ['low', 'medium'],
    ),
    highlight: buildShape(
      ['restaurant', 'dessert', 'cafe'],
      ['activity', 'event', 'live_music'],
      ['chef-led', 'intimate', 'cozy', 'conversation', 'craft', 'wine'],
      ['chaotic', 'festival', 'arcade', 'late-night'],
      ['low', 'medium'],
    ),
    surprise: buildShape(
      ['dessert', 'cafe', 'park'],
      ['activity', 'event'],
      ['understated', 'craft', 'quiet', 'local'],
      ['high-energy', 'crowded'],
      ['low', 'medium'],
    ),
    windDown: buildShape(
      ['dessert', 'cafe', 'park'],
      ['activity', 'event', 'live_music'],
      ['calm', 'cozy', 'soft-landing', 'easygoing'],
      ['high-energy', 'crowded'],
      ['low'],
    ),
  },
  lively: {
    vibe: 'lively',
    label: 'Lively',
    sublabel: 'energetic | social | buzzing',
    legacyTags: ['lively', 'creative'],
    idealEnergyRange: [3, 5],
    preferredCategories: ['bar', 'live_music', 'event', 'activity', 'restaurant'],
    discouragedCategories: ['park'],
    preferredTags: ['social', 'buzzing', 'high-energy', 'cocktails', 'live'],
    discouragedTags: ['silent', 'sleepy', 'quiet-only'],
    toneBias: 'electric',
    discoveryBias: 'medium',
    movementTolerance: 'high',
    energyBand: ['medium', 'high'],
    start: buildShape(
      ['restaurant', 'bar', 'activity'],
      ['park'],
      ['social', 'quick-start', 'playful'],
      ['silent'],
      ['medium'],
    ),
    highlight: buildShape(
      ['live_music', 'bar', 'event', 'activity'],
      ['park', 'museum'],
      ['high-energy', 'social', 'cocktails', 'live', 'interactive'],
      ['sleepy', 'quiet'],
      ['medium', 'high'],
    ),
    surprise: buildShape(
      ['event', 'live_music', 'bar'],
      ['park'],
      ['unexpected', 'underexposed', 'community'],
      ['predictable'],
      ['medium', 'high'],
    ),
    windDown: buildShape(
      ['bar', 'dessert', 'cafe'],
      ['activity'],
      ['easygoing', 'comfort', 'social'],
      ['chaotic'],
      ['low', 'medium'],
    ),
  },
  playful: {
    vibe: 'playful',
    label: 'Playful',
    sublabel: 'fun | active | interactive',
    legacyTags: ['playful', 'creative'],
    idealEnergyRange: [3, 5],
    preferredCategories: ['activity', 'event', 'dessert', 'cafe'],
    discouragedCategories: ['museum'],
    preferredTags: ['interactive', 'games', 'fun', 'social', 'hands-on'],
    discouragedTags: ['formal', 'sleepy'],
    toneBias: 'electric',
    discoveryBias: 'medium',
    movementTolerance: 'medium',
    energyBand: ['medium', 'high'],
    start: buildShape(
      ['cafe', 'activity', 'dessert'],
      ['museum'],
      ['playful', 'quick-start', 'interactive'],
      ['formal'],
      ['medium'],
    ),
    highlight: buildShape(
      ['activity', 'event', 'dessert'],
      ['museum', 'park'],
      ['interactive', 'games', 'fun', 'social'],
      ['sleepy'],
      ['medium', 'high'],
    ),
    surprise: buildShape(
      ['event', 'dessert', 'activity'],
      ['museum'],
      ['unexpected', 'community', 'interactive'],
      ['predictable'],
      ['medium', 'high'],
    ),
    windDown: buildShape(
      ['dessert', 'cafe', 'bar'],
      ['activity'],
      ['comfort', 'easygoing', 'social'],
      ['chaotic'],
      ['low', 'medium'],
    ),
  },
  cultured: {
    vibe: 'cultured',
    label: 'Cultured',
    sublabel: 'arts | music | thoughtful',
    legacyTags: ['cultured', 'culture', 'creative'],
    idealEnergyRange: [2, 4],
    preferredCategories: ['museum', 'live_music', 'event', 'restaurant'],
    discouragedCategories: ['activity'],
    preferredTags: ['curated', 'immersive', 'performance', 'listening', 'thoughtful'],
    discouragedTags: ['arcade', 'chaotic'],
    toneBias: 'refined',
    discoveryBias: 'medium',
    movementTolerance: 'medium',
    energyBand: ['low', 'medium'],
    start: buildShape(
      ['museum', 'cafe', 'park'],
      ['activity'],
      ['thoughtful', 'curated', 'walkable'],
      ['chaotic'],
      ['low', 'medium'],
    ),
    highlight: buildShape(
      ['museum', 'live_music', 'event', 'restaurant'],
      ['activity'],
      ['curated', 'immersive', 'performance', 'listening', 'story'],
      ['arcade', 'sleepy'],
      ['medium'],
    ),
    surprise: buildShape(
      ['event', 'museum', 'dessert'],
      ['activity'],
      ['local-artists', 'underexposed', 'community'],
      ['predictable'],
      ['low', 'medium'],
    ),
    windDown: buildShape(
      ['dessert', 'cafe', 'park', 'museum'],
      ['activity', 'event'],
      ['calm', 'quiet', 'reflective'],
      ['high-energy'],
      ['low'],
    ),
  },
  chill: {
    vibe: 'chill',
    label: 'Chill',
    sublabel: 'easygoing | casual | low-pressure',
    legacyTags: ['chill', 'relaxed', 'cozy'],
    idealEnergyRange: [1, 3],
    preferredCategories: ['cafe', 'park', 'dessert', 'restaurant', 'museum'],
    discouragedCategories: ['event'],
    preferredTags: ['easygoing', 'calm', 'casual', 'low-pressure', 'quiet'],
    discouragedTags: ['high-energy', 'crowded', 'chaotic'],
    toneBias: 'intimate',
    discoveryBias: 'low',
    movementTolerance: 'low',
    energyBand: ['low', 'medium'],
    start: buildShape(
      ['cafe', 'park', 'dessert'],
      ['event'],
      ['easygoing', 'casual', 'walkable'],
      ['high-energy'],
      ['low', 'medium'],
    ),
    highlight: buildShape(
      ['restaurant', 'cafe', 'park', 'museum'],
      ['event', 'activity'],
      ['low-pressure', 'comfortable', 'quiet', 'thoughtful'],
      ['chaotic', 'crowded'],
      ['low', 'medium'],
    ),
    surprise: buildShape(
      ['park', 'dessert', 'cafe'],
      ['event'],
      ['understated', 'local', 'quiet'],
      ['high-energy'],
      ['low', 'medium'],
    ),
    windDown: buildShape(
      ['dessert', 'cafe', 'park'],
      ['activity', 'event'],
      ['calm', 'soft-landing', 'easygoing'],
      ['crowded'],
      ['low'],
    ),
  },
  'adventurous-outdoor': {
    vibe: 'adventurous-outdoor',
    label: 'Adventurous (Outdoor)',
    sublabel: 'scenic | open-air | exploratory',
    legacyTags: ['adventurous-outdoor', 'outdoors', 'relaxed'],
    idealEnergyRange: [2, 4],
    preferredCategories: ['park', 'activity', 'cafe', 'dessert'],
    discouragedCategories: ['bar', 'museum', 'live_music'],
    preferredTags: [
      'walkable',
      'nature',
      'scenic',
      'fresh-air',
      'viewpoint',
      'trail',
      'garden',
      'stargazing',
      'outdoor-seating',
    ],
    discouragedTags: ['indoors-only', 'late-night', 'district', 'street-food', 'night-market'],
    toneBias: 'refined',
    discoveryBias: 'medium',
    movementTolerance: 'medium',
    energyBand: ['low', 'medium'],
    start: buildShape(
      ['park', 'cafe'],
      ['bar', 'museum'],
      ['walkable', 'scenic', 'fresh-air', 'garden'],
      ['late-night', 'district'],
      ['low', 'medium'],
    ),
    highlight: buildShape(
      ['park', 'activity', 'cafe', 'dessert'],
      ['bar', 'live_music', 'museum'],
      ['nature', 'open-air', 'viewpoint', 'exploratory', 'trail', 'garden', 'stargazing'],
      ['indoors-only', 'late-night', 'district', 'street-food'],
      ['medium'],
    ),
    surprise: buildShape(
      ['park', 'dessert', 'activity'],
      ['bar', 'museum'],
      ['underexposed', 'trail', 'community', 'garden', 'viewpoint'],
      ['chaotic', 'district'],
      ['low', 'medium'],
    ),
    windDown: buildShape(
      ['dessert', 'park', 'cafe'],
      ['activity', 'museum', 'live_music'],
      ['calm', 'scenic', 'soft-landing', 'quiet', 'outdoor-seating'],
      ['crowded', 'late-night'],
      ['low'],
    ),
  },
  'adventurous-urban': {
    vibe: 'adventurous-urban',
    label: 'Adventurous (Urban)',
    sublabel: 'local | wandering | discovery',
    legacyTags: ['adventurous-urban', 'creative', 'culinary'],
    idealEnergyRange: [2, 4],
    preferredCategories: ['restaurant', 'bar', 'event', 'cafe', 'live_music', 'dessert'],
    discouragedCategories: ['museum', 'park'],
    preferredTags: [
      'underexposed',
      'street-food',
      'district',
      'local',
      'community',
      'wandering',
      'market',
      'food-hall',
      'live-popups',
      'neighborhood',
    ],
    discouragedTags: ['predictable', 'chain', 'sleepy', 'nature', 'trail', 'viewpoint', 'garden'],
    toneBias: 'electric',
    discoveryBias: 'high',
    movementTolerance: 'high',
    energyBand: ['medium', 'high'],
    start: buildShape(
      ['cafe', 'restaurant', 'event'],
      ['museum', 'park'],
      ['local', 'district', 'community', 'neighborhood'],
      ['predictable', 'nature'],
      ['medium'],
    ),
    highlight: buildShape(
      ['restaurant', 'bar', 'event', 'live_music', 'dessert'],
      ['museum', 'park'],
      ['underexposed', 'street-food', 'wandering', 'community', 'local', 'market', 'food-hall'],
      ['chain', 'predictable', 'nature', 'trail', 'viewpoint'],
      ['medium', 'high'],
    ),
    surprise: buildShape(
      ['event', 'bar', 'dessert', 'restaurant'],
      ['museum'],
      ['unexpected', 'underexposed', 'community', 'local', 'live-popups'],
      ['predictable', 'nature'],
      ['medium', 'high'],
    ),
    windDown: buildShape(
      ['dessert', 'cafe', 'bar'],
      ['activity', 'park'],
      ['easygoing', 'local', 'comfort', 'neighborhood'],
      ['chaotic', 'nature'],
      ['low', 'medium'],
    ),
  },
}

export function getVibeProfile(vibe: VibeAnchor): VibeProfile {
  return vibeProfiles[vibe]
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase()
}

export function venueMatchesVibeTag(venue: Venue, vibe: VibeAnchor): boolean {
  const profile = getVibeProfile(vibe)
  return profile.legacyTags.some((tag) => venue.vibeTags.includes(tag))
}

function tagOverlapScore(venueTags: string[], targetTags: string[]): number {
  if (targetTags.length === 0) {
    return 0
  }
  const normalizedVenueTags = new Set(venueTags.map(normalizeTag))
  const matches = targetTags.filter((tag) => normalizedVenueTags.has(normalizeTag(tag))).length
  return matches / targetTags.length
}

export function scoreVibeTagAffinity(venue: Venue, vibe: VibeAnchor): number {
  const profile = getVibeProfile(vibe)
  const categoryFit = profile.preferredCategories.includes(venue.category) ? 1 : 0.36
  const categoryPenalty = profile.discouragedCategories.includes(venue.category) ? 0.24 : 0
  const tagFit = tagOverlapScore(venue.tags, profile.preferredTags)
  const discouragedFit = tagOverlapScore(venue.tags, profile.discouragedTags)
  const vibeTagFit = venueMatchesVibeTag(venue, vibe) ? 1 : 0.18
  const [minEnergy, maxEnergy] = profile.idealEnergyRange
  const energyDistance =
    venue.energyLevel >= minEnergy && venue.energyLevel <= maxEnergy
      ? 0
      : Math.min(
          Math.abs(venue.energyLevel - minEnergy),
          Math.abs(venue.energyLevel - maxEnergy),
        )
  const energyFit = energyDistance === 0 ? 1 : Math.max(0, 1 - energyDistance / 4)

  return Math.max(
    0,
    Math.min(
      1,
      categoryFit * 0.34 +
        vibeTagFit * 0.26 +
        tagFit * 0.18 +
        energyFit * 0.22 -
        categoryPenalty -
        discouragedFit * 0.16,
    ),
  )
}

export function getRoleShapeForVibe(
  vibe: VibeAnchor,
  role: LensStopRole,
): StopShapeProfile {
  const profile = getVibeProfile(vibe)
  if (role === 'start') {
    return profile.start
  }
  if (role === 'highlight') {
    return profile.highlight
  }
  if (role === 'surprise') {
    return profile.surprise
  }
  return profile.windDown
}
