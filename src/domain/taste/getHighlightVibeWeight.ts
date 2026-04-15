import type { StarterPack } from '../types/starterPack'
import type { IntentProfile } from '../types/intent'

export function getHighlightVibeWeight(
  intent: IntentProfile,
  starterPack?: StarterPack,
): number {
  let weight = 0.28

  if (intent.crew === 'romantic') {
    weight += 0.05
  }
  if (
    intent.primaryAnchor === 'cozy' ||
    intent.primaryAnchor === 'cultured' ||
    intent.primaryAnchor === 'adventurous-outdoor' ||
    intent.primaryAnchor === 'adventurous-urban'
  ) {
    weight += 0.07
  }
  if (intent.primaryAnchor === 'lively' || intent.primaryAnchor === 'playful') {
    weight += 0.05
  }
  if (intent.primaryAnchor === 'chill') {
    weight += 0.04
  }
  if (
    starterPack?.roleContracts?.highlight ||
    starterPack?.lensPreset?.preferredStopShapes?.highlight
  ) {
    weight += 0.05
  }

  return weight
}
