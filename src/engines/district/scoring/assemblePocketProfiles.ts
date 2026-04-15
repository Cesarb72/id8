import { computeBearingsLite } from './computeBearingsLite'
import { computeDistrictScores } from './computeDistrictScores'
import { computeFieldSignals } from './computeFieldSignals'
import { resolveMicroPockets } from './resolveMicroPockets'
import { scoreIdentityAnchors } from './scoreIdentityAnchors'
import { computeTasteBridgeSignals } from './computeTasteBridgeSignals'
import { computeTasteLite } from './computeTasteLite'
import {
  getDistrictFallbackPenalty,
  getDistrictPocketTruthTier,
  isFallbackPocketOrigin,
} from '../types/districtTypes'
import type {
  DistrictEngineContext,
  DistrictOpportunityProfile,
  IdentifiedPocket,
} from '../types/districtTypes'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function toFixed(value: number): number {
  return Number(value.toFixed(3))
}

function toCoreVertical(vertical: DistrictEngineContext['vertical']): NonNullable<DistrictEngineContext['vertical']> {
  return vertical ?? 'generic'
}

function buildWhyHereSignals(input: {
  primaryReasons: string[]
  secondaryReasons: string[]
  anchorReasons: string[]
  hasStrongIdentity: boolean
  hasStrongActivation: boolean
}): string[] {
  const signals = Array.from(
    new Set([...input.primaryReasons, ...input.secondaryReasons, ...input.anchorReasons]),
  ).slice(0, 5)

  if (signals.length === 0) {
    return ['baseline_local_specificity']
  }

  if (!input.hasStrongIdentity && !input.hasStrongActivation) {
    return [...signals, 'low_specificity_fallback'].slice(0, 5)
  }

  return signals
}

function buildHyperlocal(
  pocket: IdentifiedPocket,
): DistrictOpportunityProfile['hyperlocal'] {
  const microPocketResolution = resolveMicroPockets(pocket)
  const primaryMicroPocket = microPocketResolution.microPockets[0]
  if (!primaryMicroPocket) {
    return undefined
  }

  const secondaryMicroPockets = microPocketResolution.microPockets.slice(1, 3)
  const anchorScores = scoreIdentityAnchors({
    pocket,
    microPockets: microPocketResolution.microPockets,
  })
  const hasStrongIdentity = primaryMicroPocket.identityStrength >= 0.56
  const hasStrongActivation = primaryMicroPocket.activationStrength >= 0.56
  const whyHereSignals = buildWhyHereSignals({
    primaryReasons: primaryMicroPocket.reasonSignals,
    secondaryReasons: secondaryMicroPockets.flatMap((entry) => entry.reasonSignals).slice(0, 2),
    anchorReasons: anchorScores.primaryAnchor?.reasons ?? [],
    hasStrongIdentity,
    hasStrongActivation,
  })
  const localSpecificityScore = toFixed(
    clamp(
      primaryMicroPocket.identityStrength * 0.34 +
        primaryMicroPocket.activationStrength * 0.24 +
        primaryMicroPocket.environmentalInfluencePotential * 0.22 +
        (anchorScores.primaryAnchor?.score ?? 0) * 0.2,
      0,
      1,
    ),
  )

  return {
    primaryMicroPocket,
    secondaryMicroPockets,
    primaryAnchor: anchorScores.primaryAnchor,
    secondaryAnchors: anchorScores.secondaryAnchors,
    whyHereSignals,
    localSpecificityScore,
  }
}

export function assemblePocketProfiles(
  identifiedPockets: IdentifiedPocket[],
  context: DistrictEngineContext = {},
): DistrictOpportunityProfile[] {
  const vertical = toCoreVertical(context.vertical)
  return identifiedPockets.map((pocket) => {
    const isDegradedFallback = isFallbackPocketOrigin(pocket.origin)
    const truthTier = getDistrictPocketTruthTier(pocket.origin)
    const fallbackPenaltyApplied = getDistrictFallbackPenalty(pocket.origin)
    const fieldSignals = computeFieldSignals(pocket)
    const tasteSignals = computeTasteBridgeSignals(pocket)
    const score = computeDistrictScores(fieldSignals, pocket.viability.classification)
    const sortedCategories = Object.entries(pocket.categoryCounts)
      .sort((left, right) => {
        if (right[1] !== left[1]) {
          return right[1] - left[1]
        }
        return left[0].localeCompare(right[0])
      })
      .map(([category]) => category)
    const appSignals =
      vertical === 'generic'
        ? undefined
        : {
            directionSignals: computeBearingsLite(pocket),
            tasteSignals: computeTasteLite(pocket),
          }
    const hyperlocal = buildHyperlocal(pocket)

    return {
      pocketId: pocket.id,
      label: pocket.identity.pocketLabel,
      centroid: pocket.geometry.centroid,
      radiusM: pocket.geometry.maxDistanceFromCentroidM,
      entityCount: pocket.entities.length,
      categories: sortedCategories,
      classification: pocket.viability.classification,
      coreSignals: fieldSignals,
      tasteSignals,
      score,
      appSignals,
      hyperlocal,
      meta: {
        vertical,
        provenance: [
          'district-engine',
          'phase-1-3',
          'neutral-pocket-profile',
          `origin:${pocket.origin}`,
          `truth-tier:${truthTier}`,
          ...(appSignals ? ['optional-app-projection'] : []),
          ...(hyperlocal ? ['hyperlocal-layer-v1'] : []),
        ],
        generatedAtIso: new Date().toISOString(),
        identityKind: pocket.identity.kind,
        origin: pocket.origin,
        truthTier,
        isDegradedFallback,
        fallbackPenaltyApplied,
        fallbackReasonCode: pocket.originMeta.fallbackReasonCode,
        clusteringSource: pocket.originMeta.clusteringSource,
        originNotes: pocket.originMeta.stageNotes,
        sourcePocketId: pocket.originMeta.sourcePocketId,
      },
    }
  })
}
