import type { ScenarioFamily } from '../interpretation/discovery/stopTypeCandidateBoard'
import type { StarterPack } from '../types/starterPack'

export const curateStarterScenarioFamilyById = {
  'cozy-date-night': 'romantic_cozy',
  'dessert-conversation': 'romantic_cozy',
  'wine-slow-evening': 'romantic_cozy',
  'sunset-stroll': 'romantic_cultured',
  'coffee-books': 'romantic_cultured',
  'cozy-jazz-night': 'romantic_cozy',
  'hidden-cocktail-corners': 'friends_lively',
  'arcade-and-drinks': 'friends_lively',
  'street-food-adventure': 'friends_cultured',
  'live-music-loop': 'friends_cultured',
  'park-and-ice-cream': 'family_cultured',
  'museum-afternoon': 'family_cultured',
} as const satisfies Record<string, ScenarioFamily>

export type CurateStarterId = keyof typeof curateStarterScenarioFamilyById

export function resolveCurateStarterScenarioFamily(
  starterPack: Pick<StarterPack, 'id'> | null | undefined,
): ScenarioFamily | null {
  if (!starterPack?.id) {
    return null
  }
  return curateStarterScenarioFamilyById[starterPack.id as CurateStarterId] ?? null
}
