import type { IdentifiedPocket, DistrictTasteSignals } from '../types/districtTypes'

type MixKey = keyof DistrictTasteSignals['hospitalityMix']

const CATEGORY_TO_MIX_WEIGHTS: Record<string, Array<{ key: MixKey; weight: number }>> = {
  bar: [{ key: 'drinks', weight: 1 }],
  restaurant: [{ key: 'dining', weight: 1 }],
  cafe: [{ key: 'cafe', weight: 1 }],
  museum: [{ key: 'culture', weight: 1 }],
  event: [
    { key: 'activity', weight: 0.6 },
    { key: 'culture', weight: 0.4 },
  ],
  activity: [{ key: 'activity', weight: 1 }],
  park: [{ key: 'activity', weight: 0.75 }, { key: 'culture', weight: 0.25 }],
  live_music: [{ key: 'culture', weight: 0.6 }, { key: 'drinks', weight: 0.4 }],
  dessert: [{ key: 'dining', weight: 0.55 }, { key: 'cafe', weight: 0.45 }],
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function toFixed(value: number): number {
  return Number(clamp(value, 0, 1).toFixed(3))
}

function toLevel(value: number): 'low' | 'medium' | 'high' {
  if (value >= 0.67) {
    return 'high'
  }
  if (value >= 0.34) {
    return 'medium'
  }
  return 'low'
}

function normalizeMix(
  rawMix: DistrictTasteSignals['hospitalityMix'],
): DistrictTasteSignals['hospitalityMix'] {
  const total = Object.values(rawMix).reduce((sum, value) => sum + value, 0)
  if (total <= 0) {
    return {
      drinks: 0,
      dining: 0,
      culture: 0,
      cafe: 0,
      activity: 0,
    }
  }

  return {
    drinks: toFixed(rawMix.drinks / total),
    dining: toFixed(rawMix.dining / total),
    culture: toFixed(rawMix.culture / total),
    cafe: toFixed(rawMix.cafe / total),
    activity: toFixed(rawMix.activity / total),
  }
}

function computeHospitalityMix(
  pocket: IdentifiedPocket,
): DistrictTasteSignals['hospitalityMix'] {
  const rawMix: DistrictTasteSignals['hospitalityMix'] = {
    drinks: 0,
    dining: 0,
    culture: 0,
    cafe: 0,
    activity: 0,
  }

  for (const [category, count] of Object.entries(pocket.categoryCounts)) {
    const mapping =
      CATEGORY_TO_MIX_WEIGHTS[category] ??
      CATEGORY_TO_MIX_WEIGHTS[category.toLowerCase()] ??
      [{ key: 'activity', weight: 1 }]
    for (const entry of mapping) {
      rawMix[entry.key] += count * entry.weight
    }
  }

  return normalizeMix(rawMix)
}

function getDominantMixKey(
  mix: DistrictTasteSignals['hospitalityMix'],
): keyof DistrictTasteSignals['hospitalityMix'] {
  return (Object.entries(mix).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1]
    }
    return left[0].localeCompare(right[0])
  })[0]?.[0] ?? 'activity') as keyof DistrictTasteSignals['hospitalityMix']
}

function deriveExperientialTags(
  mix: DistrictTasteSignals['hospitalityMix'],
  energyScore: number,
  noiseScore: number,
  intimacyScore: number,
): string[] {
  const tags = new Set<string>()
  const dominantMix = getDominantMixKey(mix)
  const strongestWeight = Math.max(...Object.values(mix))

  if (dominantMix === 'drinks' && mix.drinks >= 0.26) {
    tags.add('drinks-forward')
  }
  if (dominantMix === 'dining' && mix.dining >= 0.3) {
    tags.add('dining-forward')
  }
  if (mix.culture >= 0.2) {
    tags.add('arts-adjacent')
  }
  if (mix.cafe >= 0.26) {
    tags.add('coffee-leaning')
  }
  if (mix.activity >= 0.34) {
    tags.add('activity-led')
  }
  if (energyScore >= 0.55) {
    tags.add('lively')
  }
  if (energyScore <= 0.35) {
    tags.add('slow-paced')
  }
  if (intimacyScore >= 0.6 && noiseScore <= 0.65) {
    tags.add('intimate')
  }
  if (strongestWeight < 0.34) {
    tags.add('mixed-program')
  }

  return Array.from(tags).sort((left, right) => left.localeCompare(right))
}

function deriveMomentSeeds(
  mix: DistrictTasteSignals['hospitalityMix'],
): DistrictTasteSignals['momentSeeds'] {
  const seeds: string[] = []
  const dominantMix = getDominantMixKey(mix)

  if (mix.drinks >= 0.18 && mix.culture >= 0.18) {
    seeds.push('gallery -> wine bar')
  }
  if (mix.cafe >= 0.14 && mix.activity >= 0.25) {
    seeds.push('coffee start')
  }
  if (mix.culture >= 0.2 && mix.activity >= 0.25) {
    seeds.push('gallery stroll')
  }
  if (dominantMix === 'dining' && mix.dining >= 0.3) {
    seeds.push('dinner anchor')
  }
  if (mix.cafe >= 0.3) {
    seeds.push('coffee + walk')
  }
  if (mix.drinks >= 0.3) {
    seeds.push('cocktail-forward start')
  }
  if (mix.culture >= 0.3) {
    seeds.push('museum + listening room')
  }
  if (mix.activity >= 0.34) {
    seeds.push('playful detour')
  }
  if (seeds.length === 0) {
    seeds.push('neighborhood sampler')
  }

  return Array.from(new Set(seeds)).slice(0, 5)
}

export function computeTasteBridgeSignals(
  pocket: IdentifiedPocket,
): DistrictTasteSignals {
  const hospitalityMix = computeHospitalityMix(pocket)
  const density = clamp(pocket.viability.signals.densityScore, 0, 1)
  const diversity = clamp(pocket.viability.signals.categoryDiversity, 0, 1)
  const compactness = clamp(
    1 - (Math.max(1, pocket.geometry.elongationRatio) - 1) / 3,
    0,
    1,
  )
  const spreadTightness = clamp(
    1 - pocket.geometry.maxDistanceFromCentroidM / 460,
    0,
    1,
  )

  const energyScore = clamp(
    density * 0.45 + hospitalityMix.activity * 0.35 + hospitalityMix.drinks * 0.2,
    0,
    1,
  )
  const noiseScore = clamp(
    energyScore * 0.55 + hospitalityMix.drinks * 0.25 + hospitalityMix.activity * 0.2,
    0,
    1,
  )
  const intimacyScore = clamp(
    compactness * 0.35 +
      spreadTightness * 0.25 +
      (1 - noiseScore) * 0.2 +
      (hospitalityMix.cafe + hospitalityMix.dining) * 0.2,
    0,
    1,
  )
  const compositionRichness = clamp(
    Object.values(hospitalityMix).filter((weight) => weight >= 0.12).length / 5,
    0,
    1,
  )
  const momentPotential = toFixed(
    diversity * 0.35 + density * 0.25 + compositionRichness * 0.4,
  )

  return {
    experientialTags: deriveExperientialTags(
      hospitalityMix,
      energyScore,
      noiseScore,
      intimacyScore,
    ),
    hospitalityMix,
    ambianceProfile: {
      energy: toLevel(energyScore),
      intimacy: toLevel(intimacyScore),
      noise: toLevel(noiseScore),
    },
    momentSeeds: deriveMomentSeeds(hospitalityMix),
    momentPotential,
  }
}
