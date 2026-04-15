import { haversineDistanceM } from '../clustering/geoDistance'
import type {
  DistrictIdentityAnchor,
  DistrictMicroPocket,
  IdentifiedPocket,
  PlaceEntity,
} from '../types/districtTypes'

type ScoreIdentityAnchorsInput = {
  pocket: IdentifiedPocket
  microPockets: DistrictMicroPocket[]
}

type ScoreIdentityAnchorsResult = {
  primaryAnchor?: DistrictIdentityAnchor
  secondaryAnchors: DistrictIdentityAnchor[]
  rankedAnchors: DistrictIdentityAnchor[]
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function toFixed(value: number): number {
  return Number(value.toFixed(3))
}

function getPrimaryCategory(entity: PlaceEntity): string {
  return entity.categories[0] ?? entity.type
}

function buildAnchorScore(
  entity: PlaceEntity,
  pocketEntities: PlaceEntity[],
  primaryMicroPocket: DistrictMicroPocket,
): DistrictIdentityAnchor {
  const distanceToMicroCenter = haversineDistanceM(entity.location, primaryMicroPocket.centroid)
  const proximityBandM = Math.max(120, primaryMicroPocket.radiusM * 1.25)
  const proximityScore = clamp(1 - distanceToMicroCenter / proximityBandM, 0, 1)
  const category = getPrimaryCategory(entity)
  const identityAlignment =
    (primaryMicroPocket.dominantCategories.includes(category) ? 0.62 : 0.26) +
    (primaryMicroPocket.dominantLanes.includes(entity.type) ? 0.38 : 0.18)
  const supportBandM = Math.max(90, primaryMicroPocket.radiusM * 0.9)
  const supportCount = pocketEntities.filter((candidate) => {
    if (candidate.id === entity.id) {
      return false
    }
    return haversineDistanceM(candidate.location, entity.location) <= supportBandM
  }).length
  const supportDensity = clamp(supportCount / Math.max(1, pocketEntities.length - 1), 0, 1)
  const activationLift =
    primaryMicroPocket.activationStrength * 0.58 +
    primaryMicroPocket.environmentalInfluencePotential * 0.42
  const genericPenalty =
    !primaryMicroPocket.dominantCategories.includes(category) &&
    !primaryMicroPocket.dominantLanes.includes(entity.type)
      ? 0.08
      : 0
  const isolatedPenalty = supportDensity < 0.2 ? 0.08 : supportDensity < 0.34 ? 0.04 : 0
  const score = clamp(
    proximityScore * 0.33 +
      identityAlignment * 0.24 +
      supportDensity * 0.2 +
      activationLift * 0.17 -
      genericPenalty -
      isolatedPenalty,
    0,
    1,
  )

  const reasons: string[] = []
  if (proximityScore >= 0.62) {
    reasons.push('near_primary_micro_core')
  }
  if (identityAlignment >= 0.68) {
    reasons.push('identity_aligned_anchor')
  } else if (identityAlignment >= 0.5) {
    reasons.push('partial_identity_alignment')
  }
  if (supportDensity >= 0.48) {
    reasons.push('strong_local_support_density')
  }
  if (activationLift >= 0.58) {
    reasons.push('activation_supported_anchor')
  }
  if (reasons.length === 0) {
    reasons.push('fallback_anchor_signal')
  }

  return {
    entityId: entity.id,
    entityName: entity.name,
    score: toFixed(score),
    reasons,
  }
}

export function scoreIdentityAnchors({
  pocket,
  microPockets,
}: ScoreIdentityAnchorsInput): ScoreIdentityAnchorsResult {
  const primaryMicroPocket = microPockets[0]
  if (!primaryMicroPocket) {
    return {
      primaryAnchor: undefined,
      secondaryAnchors: [],
      rankedAnchors: [],
    }
  }

  const rankedAnchors = pocket.entities
    .map((entity) => buildAnchorScore(entity, pocket.entities, primaryMicroPocket))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }
      return left.entityId.localeCompare(right.entityId)
    })

  const primaryAnchor = rankedAnchors[0]
  return {
    primaryAnchor,
    secondaryAnchors: rankedAnchors.slice(1, 4),
    rankedAnchors: rankedAnchors.slice(0, 6),
  }
}
