import type { LensEnergy } from '../types/experienceLens'
import type { VibeAnchor } from '../types/intent'
import type { VenueCategory } from '../types/venue'

export type VibeTasteProfileId =
  | 'low_key_intimate'
  | 'social_buzzing'
  | 'real_occasion'

export type TasteProfileBand = 'low' | 'medium' | 'high'

export interface VibeTasteProfile {
  id: VibeTasteProfileId
  label: string
  sourceVibes: VibeAnchor[]
  energyLevelRange: [number, number]
  energyBand: LensEnergy[]
  socialDensity: TasteProfileBand
  intimacy: TasteProfileBand
  linger: TasteProfileBand
  experiential: TasteProfileBand
  novelty: TasteProfileBand
  destinationStrength: TasteProfileBand
  preferredCategories: VenueCategory[]
  discouragedCategories: VenueCategory[]
  preferredTags: string[]
  discouragedTags: string[]
}

const vibeTasteProfiles: Record<VibeTasteProfileId, VibeTasteProfile> = {
  low_key_intimate: {
    id: 'low_key_intimate',
    label: 'Low-key and intimate',
    sourceVibes: ['cozy', 'chill'],
    energyLevelRange: [1, 2],
    energyBand: ['low'],
    socialDensity: 'low',
    intimacy: 'high',
    linger: 'high',
    experiential: 'medium',
    novelty: 'low',
    destinationStrength: 'medium',
    preferredCategories: ['cafe', 'restaurant', 'dessert', 'park'],
    discouragedCategories: ['bar', 'activity', 'event', 'live_music'],
    preferredTags: [
      'calm',
      'cozy',
      'conversation',
      'craft',
      'intimate',
      'quiet',
      'slow-paced',
      'wine',
    ],
    discouragedTags: ['arcade', 'chaotic', 'crowded', 'festival', 'high-energy', 'loud'],
  },
  social_buzzing: {
    id: 'social_buzzing',
    label: 'Social and buzzing',
    sourceVibes: ['lively', 'playful'],
    energyLevelRange: [4, 5],
    energyBand: ['high'],
    socialDensity: 'high',
    intimacy: 'medium',
    linger: 'low',
    experiential: 'medium',
    novelty: 'medium',
    destinationStrength: 'medium',
    preferredCategories: ['bar', 'live_music', 'event', 'restaurant', 'activity'],
    discouragedCategories: ['park', 'museum'],
    preferredTags: [
      'buzzing',
      'cocktails',
      'group-friendly',
      'high-energy',
      'interactive',
      'live',
      'quick-start',
      'social',
    ],
    discouragedTags: ['landing-only', 'quiet-only', 'silent', 'sleepy', 'slow-paced'],
  },
  real_occasion: {
    id: 'real_occasion',
    label: 'A real occasion',
    sourceVibes: ['cultured', 'adventurous-outdoor', 'adventurous-urban'],
    energyLevelRange: [3, 4],
    energyBand: ['medium', 'high'],
    socialDensity: 'medium',
    intimacy: 'medium',
    linger: 'high',
    experiential: 'high',
    novelty: 'high',
    destinationStrength: 'high',
    preferredCategories: ['restaurant', 'museum', 'live_music', 'event', 'bar'],
    discouragedCategories: ['park'],
    preferredTags: [
      'chef-led',
      'curated',
      'destination',
      'experiential',
      'immersive',
      'performance',
      'reservation',
      'signature',
      'tasting',
    ],
    discouragedTags: ['generic', 'low-signal', 'predictable', 'quick-only', 'sleepy'],
  },
}

export function resolveVibeTasteProfileId(vibe: VibeAnchor): VibeTasteProfileId {
  if (vibe === 'cozy' || vibe === 'chill') {
    return 'low_key_intimate'
  }
  if (vibe === 'lively' || vibe === 'playful') {
    return 'social_buzzing'
  }
  return 'real_occasion'
}

export function resolveVibeTasteProfile(vibe: VibeAnchor): VibeTasteProfile {
  return vibeTasteProfiles[resolveVibeTasteProfileId(vibe)]
}
