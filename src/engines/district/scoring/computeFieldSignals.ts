import type { DistrictFieldSignals, IdentifiedPocket } from '../types/districtTypes'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function toFixed(value: number): number {
  return Number(value.toFixed(3))
}

export function computeFieldSignals(pocket: IdentifiedPocket): DistrictFieldSignals {
  return {
    entityCount: pocket.entities.length,
    categoryDiversity: toFixed(pocket.viability.signals.categoryDiversity),
    density: toFixed(clamp(pocket.viability.signals.densityScore, 0, 1)),
    walkability: toFixed(clamp(pocket.viability.signals.walkabilityScore, 0, 1)),
    viability: toFixed(clamp(pocket.viability.score, 0, 1)),
  }
}

