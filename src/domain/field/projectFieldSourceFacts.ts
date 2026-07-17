import type {
  FieldRealAvailabilityStatus,
  FieldRealStalenessStatus,
  FieldRealSuppressionStatus,
} from './fieldRealVerdict'
import type { VenueSourceMetadata } from '../types/normalization'
import type { Venue } from '../types/venue'

export interface FieldSourceFactProjection {
  source: {
    sourceOrigin: VenueSourceMetadata['sourceOrigin']
    normalizedFromRawType: VenueSourceMetadata['normalizedFromRawType']
    curatedSubtype?: VenueSourceMetadata['curatedSubtype']
    provider?: VenueSourceMetadata['provider']
    providerRecordId?: string
    sourceQueryLabel?: string
    sourceConfidence: number
    completenessScore: number
    qualityScore: number
    missingFields: string[]
    inferredFields: string[]
  }
  availability: {
    availabilityKnown: boolean
    availabilityStatus: FieldRealAvailabilityStatus
    openNow?: boolean
    hoursKnown: boolean
    likelyOpenForCurrentWindow: boolean
    businessStatus: VenueSourceMetadata['businessStatus']
    timeConfidence: number
    hoursPressureLevel: VenueSourceMetadata['hoursPressureLevel']
    hoursPressureNotes: string[]
    hoursDemotionApplied: boolean
    hoursSuppressionApplied: boolean
  }
  quality: {
    qualityGateStatus: VenueSourceMetadata['qualityGateStatus']
    qualityGateNotes: string[]
    approvalBlockers: string[]
    demotionReasons: string[]
    suppressionReasons: string[]
    stalenessStatus: FieldRealStalenessStatus
    suppressionStatus: FieldRealSuppressionStatus
  }
  completeness: {
    sourceConfidence: number
    completenessScore: number
    qualityScore: number
    missingFields: string[]
    inferredFields: string[]
  }
}

function hasStaleRecordSignal(source: VenueSourceMetadata): boolean {
  const notes = [
    ...source.qualityGateNotes,
    ...source.approvalBlockers,
    ...source.demotionReasons,
    ...source.suppressionReasons,
  ]

  return notes.some((note) => /\b(stale|expired|outdated)\b/i.test(note))
}

function evaluateStaleness(source: VenueSourceMetadata): FieldRealStalenessStatus {
  if (hasStaleRecordSignal(source)) {
    return 'stale'
  }

  return 'current'
}

function evaluateSuppression(source: VenueSourceMetadata): FieldRealSuppressionStatus {
  if (
    source.qualityGateStatus === 'suppressed' ||
    source.hoursSuppressionApplied ||
    source.suppressionReasons.length > 0
  ) {
    return 'suppressed'
  }

  if (
    source.qualityGateStatus === 'demoted' ||
    source.hoursDemotionApplied ||
    source.demotionReasons.length > 0
  ) {
    return 'demoted'
  }

  return 'not_suppressed'
}

function evaluateAvailability(source: VenueSourceMetadata): FieldRealAvailabilityStatus {
  if (
    source.businessStatus === 'closed-permanently' ||
    source.businessStatus === 'temporarily-closed' ||
    (source.openNow === false && source.hoursKnown && source.timeConfidence >= 0.86)
  ) {
    return 'unavailable_from_record'
  }

  if (
    source.businessStatus === 'operational' ||
    source.openNow === true ||
    source.likelyOpenForCurrentWindow
  ) {
    return 'available_from_record'
  }

  return 'unknown_from_record'
}

export function projectVenueSourceFacts(
  source: VenueSourceMetadata,
): FieldSourceFactProjection {
  const availabilityStatus = evaluateAvailability(source)
  const completeness = {
    sourceConfidence: source.sourceConfidence,
    completenessScore: source.completenessScore,
    qualityScore: source.qualityScore,
    missingFields: source.missingFields,
    inferredFields: source.inferredFields,
  }

  return {
    source: {
      sourceOrigin: source.sourceOrigin,
      normalizedFromRawType: source.normalizedFromRawType,
      curatedSubtype: source.curatedSubtype,
      provider: source.provider,
      providerRecordId: source.providerRecordId,
      sourceQueryLabel: source.sourceQueryLabel,
      ...completeness,
    },
    availability: {
      availabilityKnown: availabilityStatus !== 'unknown_from_record',
      availabilityStatus,
      openNow: source.openNow,
      hoursKnown: source.hoursKnown,
      likelyOpenForCurrentWindow: source.likelyOpenForCurrentWindow,
      businessStatus: source.businessStatus,
      timeConfidence: source.timeConfidence,
      hoursPressureLevel: source.hoursPressureLevel,
      hoursPressureNotes: source.hoursPressureNotes,
      hoursDemotionApplied: source.hoursDemotionApplied,
      hoursSuppressionApplied: source.hoursSuppressionApplied,
    },
    quality: {
      qualityGateStatus: source.qualityGateStatus,
      qualityGateNotes: source.qualityGateNotes,
      approvalBlockers: source.approvalBlockers,
      demotionReasons: source.demotionReasons,
      suppressionReasons: source.suppressionReasons,
      stalenessStatus: evaluateStaleness(source),
      suppressionStatus: evaluateSuppression(source),
    },
    completeness,
  }
}

export function projectFieldSourceFacts(venue: Venue): FieldSourceFactProjection {
  return projectVenueSourceFacts(venue.source)
}
