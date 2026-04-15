import { mergePockets } from './mergePockets'
import { splitPocket } from './splitPocket'
import type { RefinedPocket, ViablePocket } from '../types/districtTypes'

export function refinePocketsWithSplitMerge(viablePockets: ViablePocket[]): RefinedPocket[] {
  const splitStage = viablePockets.flatMap((pocket) => splitPocket(pocket))
  const mergedStage = mergePockets(splitStage)

  return mergedStage.map((pocket) => ({
    ...pocket,
    refinement: {
      status: 'unchanged',
      actions: [
        {
          action: 'keep',
          note: 'Phase 1-3 pass-through refinement.',
        },
      ],
    },
  }))
}

