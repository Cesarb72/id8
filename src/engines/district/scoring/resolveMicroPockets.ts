import { resolveStructuralMicroPockets } from '../../../domain/interpretation/district/intelligence/hyperlocal/resolveStructuralMicroPockets'
import { computeMicroPocketTasteMeaning } from '../../../domain/interpretation/taste/computeMicroPocketTasteMeaning'
import type {
  DistrictMicroPocket,
  IdentifiedPocket,
} from '../types/districtTypes'

type ResolveMicroPocketsResult = {
  microPockets: DistrictMicroPocket[]
}

function toFixed(value: number): number {
  return Number(value.toFixed(3))
}

function buildMicroPocket(
  structuralMicroPocket: ReturnType<typeof resolveStructuralMicroPockets>['structuralMicroPockets'][number],
): DistrictMicroPocket {
  const { entities } = structuralMicroPocket
  const tasteMeaning = computeMicroPocketTasteMeaning(structuralMicroPocket)

  return {
    id: structuralMicroPocket.id,
    centroid: structuralMicroPocket.centroid,
    radiusM: toFixed(structuralMicroPocket.radiusM),
    entityIds: entities.map((entity) => entity.id),
    dominantCategories: structuralMicroPocket.dominantCategories,
    dominantLanes: structuralMicroPocket.dominantLanes,
    coherenceScore: toFixed(structuralMicroPocket.coherenceScore),
    identityStrength: toFixed(tasteMeaning.identityStrength),
    activationStrength: toFixed(tasteMeaning.activationStrength),
    environmentalInfluencePotential: toFixed(tasteMeaning.environmentalInfluencePotential),
    anchorCandidateIds: tasteMeaning.anchorCandidateIds,
    reasonSignals: tasteMeaning.reasonSignals,
  }
}

function rankMicroPockets(microPockets: DistrictMicroPocket[]): DistrictMicroPocket[] {
  return microPockets
    .slice()
    .sort((left, right) => {
      const leftScore =
        left.identityStrength * 0.34 +
        left.activationStrength * 0.31 +
        left.environmentalInfluencePotential * 0.21 +
        left.coherenceScore * 0.14
      const rightScore =
        right.identityStrength * 0.34 +
        right.activationStrength * 0.31 +
        right.environmentalInfluencePotential * 0.21 +
        right.coherenceScore * 0.14
      if (rightScore !== leftScore) {
        return rightScore - leftScore
      }
      if (right.entityIds.length !== left.entityIds.length) {
        return right.entityIds.length - left.entityIds.length
      }
      return left.id.localeCompare(right.id)
    })
}

export function resolveMicroPockets(pocket: IdentifiedPocket): ResolveMicroPocketsResult {
  const structuralResolution = resolveStructuralMicroPockets(pocket)
  return {
    microPockets: rankMicroPockets(
      structuralResolution.structuralMicroPockets.map((structuralMicroPocket) =>
        buildMicroPocket(structuralMicroPocket),
      ),
    ),
  }
}
