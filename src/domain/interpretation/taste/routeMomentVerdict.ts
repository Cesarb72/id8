import type {
  TasteMomentIntensityTier,
  TasteMomentStrength,
  TasteMomentType,
} from './types'

/**
 * Canonical venue identity for route-level Taste moment verdicts.
 *
 * Values must come from ScoredVenue.candidateIdentity.baseVenueId, typically
 * via getScoredVenueBaseVenueId/getArcStopBaseVenueId. Do not use provider
 * ids, display names, or rendered labels for this identity.
 */
export type TasteRouteMomentVenueId = string

export type TasteRouteMomentVerdictSource = 'taste'

export type TasteRouteMomentComparableValue = number | string | boolean

export interface TasteRouteMomentProvenance {
  source: TasteRouteMomentVerdictSource
  key: string
  label?: string
  reason?: string
}

export interface TasteRouteMomentSignalComponent<
  TValue extends TasteRouteMomentComparableValue = number,
> extends TasteRouteMomentProvenance {
  value: TValue
  weight?: number
  contribution?: number
}

export type TasteAnchorAsPeakCandidacy =
  | 'intended_peak'
  | 'supporting_anchor'
  | 'not_anchor'
  | 'unknown'

export type TasteRouteMomentPreservationStatus =
  | 'preserved'
  | 'flat'
  | 'missed'
  | 'partial'
  | 'unknown'

export type TasteRouteMomentFlatArcRiskLevel =
  | 'none'
  | 'low'
  | 'medium'
  | 'high'
  | 'unknown'

export type TasteRouteMomentMissedPeakReasonCode =
  | 'stronger_peak_available'
  | 'selected_peak_too_weak'
  | 'selected_peak_passive_fallback'
  | 'no_peak_candidate'
  | 'none'
  | 'unknown'

export interface TasteRouteMomentPeakSuitability {
  score: number
  tier?: TasteMomentIntensityTier
  components?: readonly TasteRouteMomentSignalComponent[]
}

export interface TasteRouteMomentStrengthVerdict {
  strength: TasteMomentStrength | 'unknown'
  score?: number
  reason?: string
  components?: readonly TasteRouteMomentSignalComponent[]
}

export interface TasteRouteMomentFlatArcRisk {
  level: TasteRouteMomentFlatArcRiskLevel
  score?: number
  varianceScore?: number
  penalty?: number
  reasons?: readonly string[]
}

export interface TasteRouteMomentMissedPeakReason {
  applied: boolean
  code: TasteRouteMomentMissedPeakReasonCode
  penalty?: number
  strongerPeakCandidateVenueId?: TasteRouteMomentVenueId
  reason?: string
  evidence?: readonly TasteRouteMomentSignalComponent[]
}

export interface TasteRouteMomentAvailableEvidence {
  availableHighMomentCount: number
  availableStrongMomentCount: number
  highMomentVenueIds?: readonly TasteRouteMomentVenueId[]
  strongMomentVenueIds?: readonly TasteRouteMomentVenueId[]
}

export interface TasteRouteMomentPeakRoleEvidence {
  candidateVenueId?: TasteRouteMomentVenueId
  roleFitScore?: number
  stopShapeFitScore?: number
  highlightValidity?: 'valid' | 'fallback' | 'invalid' | 'unknown'
  components?: readonly TasteRouteMomentSignalComponent[]
}

export interface TasteRouteMomentAnchorStrengthEvidence {
  candidateVenueId?: TasteRouteMomentVenueId
  anchorStrength?: number
  momentIdentityType?: TasteMomentType | 'unknown'
  momentIdentityStrength?: TasteMomentStrength | 'unknown'
  momentPotentialScore?: number
  momentIntensityScore?: number
}

export interface TasteRouteMomentVerdict {
  source: TasteRouteMomentVerdictSource
  provenance: readonly TasteRouteMomentProvenance[]
  peakCandidateVenueId?: TasteRouteMomentVenueId
  anchorAsPeakCandidacy: TasteAnchorAsPeakCandidacy
  peakSuitability: TasteRouteMomentPeakSuitability
  momentStrengthVerdict: TasteRouteMomentStrengthVerdict
  momentPreservationStatus: TasteRouteMomentPreservationStatus
  strongMomentPresent: boolean
  flatArcRisk: TasteRouteMomentFlatArcRisk
  missedPeakReason: TasteRouteMomentMissedPeakReason
  availableMomentEvidence: TasteRouteMomentAvailableEvidence
  peakRoleEvidence: TasteRouteMomentPeakRoleEvidence
  anchorStrengthEvidence: TasteRouteMomentAnchorStrengthEvidence
  momentQualityNote?: string
}
