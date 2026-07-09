import type { ViablePocket } from '../../../../../engines/district/types/districtTypes'

export function mergePockets(pockets: ViablePocket[]): ViablePocket[] {
  // TODO(district-engine, phase-4): Merge adjacent weak pockets when overlap and movement cost permit.
  return pockets
}

