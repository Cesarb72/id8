import type {
  DistrictAppSignals,
  IdentifiedPocket,
} from '../types/districtTypes'

function toFixed(value: number): number {
  return Number(Math.max(-1, Math.min(1, value)).toFixed(3))
}

export function computeBearingsLite(
  pocket: IdentifiedPocket,
): NonNullable<DistrictAppSignals['directionSignals']> {
  const width = pocket.geometry.bboxWidthM
  const height = pocket.geometry.bboxHeightM
  const base = Math.max(1, width + height)
  const northSouthBias = toFixed((height - width) / base)
  const eastWestBias = toFixed((width - height) / base)
  const dominantAxis =
    Math.abs(northSouthBias) < 0.08
      ? 'balanced'
      : northSouthBias > 0
        ? 'north_south'
        : 'east_west'

  return {
    northSouthBias,
    eastWestBias,
    dominantAxis,
  }
}

