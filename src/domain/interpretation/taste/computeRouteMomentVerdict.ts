import type {
  TasteExperienceArchetype,
  TasteMomentIdentity,
  TasteMomentIntensity,
  TasteMomentPotential,
} from './types'
import type {
  TasteAnchorAsPeakCandidacy,
  TasteRouteMomentFlatArcRiskLevel,
  TasteRouteMomentPreservationStatus,
  TasteRouteMomentVerdict,
  TasteRouteMomentVenueId,
} from './routeMomentVerdict'

export type TasteRouteMomentStopRole = 'warmup' | 'peak' | 'wildcard' | 'cooldown'

export interface TasteRouteMomentStopEvidence {
  role: TasteRouteMomentStopRole
  candidateVenueId: TasteRouteMomentVenueId
  momentIdentity: TasteMomentIdentity
  momentPotential: TasteMomentPotential
  momentIntensity: TasteMomentIntensity
  primaryExperienceArchetype: TasteExperienceArchetype
  anchorStrength?: number
  roleFitScore?: number
  stopShapeFitScore?: number
  highlightValidity?: 'valid' | 'fallback' | 'invalid' | 'unknown'
}

export interface TasteRouteMomentAvailableCandidateEvidence {
  candidateVenueId: TasteRouteMomentVenueId
  momentIdentity: TasteMomentIdentity
  momentPotential: TasteMomentPotential
}

export interface ComputeRouteMomentVerdictInput {
  stops: readonly TasteRouteMomentStopEvidence[]
  availableCandidates?: readonly TasteRouteMomentAvailableCandidateEvidence[]
  tasteModeId?: string
}

export interface RouteMomentCompatibilityValues {
  highlightMomentScore: number
  score: number
  penalty: number
  varianceScore: number
  flatPenalty: number
  strongMomentPresent: boolean
  qualityNote: string
  presentCount: number
  availableCount: number
}

export interface ComputeRouteMomentVerdictResult
  extends RouteMomentCompatibilityValues {
  verdict: TasteRouteMomentVerdict
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function isHighMomentPotential(value: TasteMomentPotential | number): boolean {
  const score = typeof value === 'number' ? value : value.score
  return score >= 0.48
}

function isStrongMomentIdentity(value: TasteMomentIdentity | undefined): boolean {
  return value?.strength === 'strong'
}

function getMomentIntensityTierBoost(value: TasteMomentIntensity): number {
  if (value.tier === 'signature') {
    return 0.16
  }
  if (value.tier === 'exceptional') {
    return 0.1
  }
  if (value.tier === 'strong') {
    return 0.05
  }
  return 0
}

function isHospitalityArchetype(archetype: TasteExperienceArchetype): boolean {
  return archetype === 'dining' || archetype === 'drinks' || archetype === 'sweet'
}

function computeHighlightMomentScore(
  stops: readonly TasteRouteMomentStopEvidence[],
): number {
  const highlight = stops.find((stop) => stop.role === 'peak')
  if (!highlight) {
    return 0
  }

  const archetype = highlight.primaryExperienceArchetype
  const momentIdentity = highlight.momentIdentity
  const archetypeLift =
    archetype === 'scenic' ||
    archetype === 'outdoor' ||
    archetype === 'activity' ||
    archetype === 'culture'
      ? 0.16
      : archetype === 'social'
        ? 0.08
        : 0.02

  return clamp01(
    highlight.momentPotential.score * 0.76 +
      highlight.momentIntensity.score * 0.24 +
      getMomentIntensityTierBoost(highlight.momentIntensity) * 0.9 +
      (isHighMomentPotential(highlight.momentPotential) ? 0.14 : 0) +
      (momentIdentity.strength === 'strong' ? 0.1 : momentIdentity.strength === 'medium' ? 0.04 : 0) +
      (momentIdentity.type === 'anchor' || momentIdentity.type === 'explore' ? 0.08 : -0.04) +
      archetypeLift,
  )
}

function getMomentPreservationStatus(params: {
  strongMomentPresent: boolean
  highIntensityHighlight: boolean
  flatPenalty: number
  penalty: number
}): TasteRouteMomentPreservationStatus {
  if (params.penalty > 0 && !params.strongMomentPresent && !params.highIntensityHighlight) {
    return 'missed'
  }
  if (params.flatPenalty > 0) {
    return 'flat'
  }
  if (params.strongMomentPresent || params.highIntensityHighlight) {
    return 'preserved'
  }
  if (params.penalty > 0) {
    return 'partial'
  }
  return 'unknown'
}

function getFlatArcRiskLevel(penalty: number): TasteRouteMomentFlatArcRiskLevel {
  if (penalty <= 0) {
    return 'none'
  }
  if (penalty < 0.06) {
    return 'low'
  }
  if (penalty < 0.12) {
    return 'medium'
  }
  return 'high'
}

function getAnchorAsPeakCandidacy(
  highlight: TasteRouteMomentStopEvidence | undefined,
): TasteAnchorAsPeakCandidacy {
  if (!highlight) {
    return 'unknown'
  }
  if (highlight.momentIdentity.type === 'anchor') {
    return 'intended_peak'
  }
  return 'not_anchor'
}

export function computeRouteMomentVerdict(
  input: ComputeRouteMomentVerdictInput,
): ComputeRouteMomentVerdictResult {
  const stops = input.stops
  const availableCandidates = input.availableCandidates ?? []
  const presentHighMomentStops = stops.filter((stop) =>
    isHighMomentPotential(stop.momentPotential),
  )
  const strongMomentStops = stops.filter((stop) =>
    isStrongMomentIdentity(stop.momentIdentity),
  )
  const availableHighMomentCandidates = availableCandidates.filter((candidate) =>
    isHighMomentPotential(candidate.momentPotential),
  )
  const availableStrongMomentCandidates = availableCandidates.filter((candidate) =>
    isStrongMomentIdentity(candidate.momentIdentity),
  )
  const highlight = stops.find((stop) => stop.role === 'peak')
  const highlightHighMoment = Boolean(
    highlight && isHighMomentPotential(highlight.momentPotential),
  )
  const uniqueMomentTypes = new Set(stops.map((stop) => stop.momentIdentity.type)).size
  const varianceScore = clamp01(
    uniqueMomentTypes >= 3
      ? 1
      : uniqueMomentTypes === 2
        ? 0.66
        : uniqueMomentTypes === 1 && stops.length > 0
          ? 0.24
          : 0,
  )
  const warmup = stops.find((stop) => stop.role === 'warmup')?.momentIdentity
  const highlightIdentity = highlight?.momentIdentity
  const cooldown = stops.find((stop) => stop.role === 'cooldown')?.momentIdentity
  const roleSequenceScore = clamp01(
    (warmup && (warmup.type === 'arrival' || warmup.type === 'explore') ? 0.34 : 0) +
      (highlightIdentity && (highlightIdentity.type === 'anchor' || highlightIdentity.type === 'explore') ? 0.4 : 0) +
      (cooldown && (cooldown.type === 'linger' || cooldown.type === 'close') ? 0.34 : 0),
  )
  const highlightStrongMoment =
    highlightIdentity &&
    highlightIdentity.strength === 'strong' &&
    (highlightIdentity.type === 'anchor' || highlightIdentity.type === 'explore')
  const highIntensityHighlight =
    highlight?.momentIntensity.tier === 'signature' ||
    highlight?.momentIntensity.tier === 'exceptional'
  const strongMomentPresent = strongMomentStops.length > 0
  const allStopsSubStrong = stops.length > 0 && strongMomentStops.length === 0
  const lowVarianceHospitalityArc =
    uniqueMomentTypes <= 2 &&
    stops.filter((stop) => isHospitalityArchetype(stop.primaryExperienceArchetype)).length >= 2
  const score = clamp01(
    (strongMomentPresent
      ? highlightStrongMoment || highIntensityHighlight
        ? 0.72
        : 0.56
      : presentHighMomentStops.length > 0
        ? 0.22
        : 0) +
      Math.min(0.16, strongMomentStops.length * 0.06) +
      (highlight ? highlight.momentIntensity.score * 0.12 : 0) +
      varianceScore * 0.18 +
      roleSequenceScore * 0.18 +
      (highlightHighMoment ? 0.08 : 0),
  )
  const flatPenalty =
    (allStopsSubStrong ? 0.07 : 0) +
    (lowVarianceHospitalityArc ? 0.06 : uniqueMomentTypes <= 1 && stops.length > 0 ? 0.04 : 0)
  const missedStrongMomentPenalty =
    availableStrongMomentCandidates.length > 0 && !strongMomentPresent
      ? input.tasteModeId === 'activity-led' || input.tasteModeId === 'scenic-outdoor'
        ? 0.16
        : 0.1
      : 0
  const penalty = clamp01(
    missedStrongMomentPenalty +
      (availableHighMomentCandidates.length > 0 && presentHighMomentStops.length === 0 ? 0.08 : 0) +
      flatPenalty,
  )
  const qualityNote =
    (highlightStrongMoment || highIntensityHighlight) && varianceScore >= 0.66
      ? 'Clear main moment with distinct support beats.'
      : (strongMomentPresent || highIntensityHighlight) && roleSequenceScore >= 0.66
        ? 'Main moment is present and the arc resolves intentionally.'
        : strongMomentPresent || highIntensityHighlight
          ? 'A strong moment survived, but the rest of the arc is flatter.'
          : varianceScore >= 0.66
            ? 'Moment beats vary, but no strong main moment survived.'
            : 'Arc reads flat; most stops land on similar moment beats.'
  const highlightMomentScore = computeHighlightMomentScore(stops)
  const combinedFlatPenalty = flatPenalty + penalty

  return {
    highlightMomentScore,
    score,
    penalty,
    varianceScore,
    flatPenalty,
    strongMomentPresent,
    qualityNote,
    presentCount: presentHighMomentStops.length,
    availableCount: Math.max(
      availableHighMomentCandidates.length,
      availableStrongMomentCandidates.length,
    ),
    verdict: {
      source: 'taste',
      provenance: [
        {
          source: 'taste',
          key: 'route_moment_verdict',
          reason: 'Taste-authored route-level moment preservation verdict',
        },
      ],
      peakCandidateVenueId: highlight?.candidateVenueId,
      anchorAsPeakCandidacy: getAnchorAsPeakCandidacy(highlight),
      peakSuitability: {
        score: highlightMomentScore,
        tier: highlight?.momentIntensity.tier,
      },
      momentStrengthVerdict: {
        strength: strongMomentPresent ? 'strong' : highlightIdentity?.strength ?? 'unknown',
        score,
        reason: qualityNote,
      },
      momentPreservationStatus: getMomentPreservationStatus({
        strongMomentPresent,
        highIntensityHighlight,
        flatPenalty,
        penalty,
      }),
      strongMomentPresent,
      flatArcRisk: {
        level: getFlatArcRiskLevel(combinedFlatPenalty),
        score: combinedFlatPenalty,
        varianceScore,
        penalty: combinedFlatPenalty,
      },
      missedPeakReason: {
        applied: false,
        code: 'unknown',
        reason: 'Missed-peak feasibility remains Arc-side for GW1-ADEGA-2B.',
      },
      availableMomentEvidence: {
        availableHighMomentCount: availableHighMomentCandidates.length,
        availableStrongMomentCount: availableStrongMomentCandidates.length,
        highMomentVenueIds: availableHighMomentCandidates.map((candidate) => candidate.candidateVenueId),
        strongMomentVenueIds: availableStrongMomentCandidates.map((candidate) => candidate.candidateVenueId),
      },
      peakRoleEvidence: {
        candidateVenueId: highlight?.candidateVenueId,
        roleFitScore: highlight?.roleFitScore,
        stopShapeFitScore: highlight?.stopShapeFitScore,
        highlightValidity: highlight?.highlightValidity,
      },
      anchorStrengthEvidence: {
        candidateVenueId: highlight?.candidateVenueId,
        anchorStrength: highlight?.anchorStrength,
        momentIdentityType: highlightIdentity?.type ?? 'unknown',
        momentIdentityStrength: highlightIdentity?.strength ?? 'unknown',
        momentPotentialScore: highlight?.momentPotential.score,
        momentIntensityScore: highlight?.momentIntensity.score,
      },
      momentQualityNote: qualityNote,
    },
  }
}
