import type { ViablePocket } from '../types/districtTypes'

export function splitPocket(pocket: ViablePocket): ViablePocket[] {
  // TODO(district-engine, phase-4): Implement geometry-informed split logic for elongated pockets.
  return [pocket]
}

