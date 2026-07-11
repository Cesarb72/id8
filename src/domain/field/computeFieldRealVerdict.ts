import type { ArcCandidate, ScoredVenueCandidateIdentity } from '../types/arc'
import type { VenueSourceMetadata } from '../types/normalization'
import type { Venue } from '../types/venue'
import type {
  FieldRealAvailabilityEvidence,
  FieldRealAvailabilityStatus,
  FieldRealFailureReason,
  FieldRealQualityEvidence,
  FieldRealStalenessStatus,
  FieldRealStopEvidence,
  FieldRealSuppressionStatus,
  FieldRealVerdict,
} from './fieldRealVerdict'

export interface FieldRealStopInput {
  role: string
  venue: Venue
  candidateIdentity: ScoredVenueCandidateIdentity
}

const VALID_CANONICAL_ID_PATTERN = /^[a-z0-9][a-z0-9:_-]*$/i

function uniqueReasons(reasons: FieldRealFailureReason[]): FieldRealFailureReason[] {
  return Array.from(new Set(reasons))
}

function hasText(value: string | undefined): boolean {
  return Boolean(value?.trim())
}

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0
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

function evaluateSourceUsable(source: VenueSourceMetadata): boolean {
  return (
    (source.sourceOrigin === 'curated' || source.sourceOrigin === 'live') &&
    (source.normalizedFromRawType === 'seed' ||
      source.normalizedFromRawType === 'raw-place' ||
      source.normalizedFromRawType === 'raw-event') &&
    isFinitePositive(source.sourceConfidence) &&
    isFinitePositive(source.completenessScore) &&
    isFinitePositive(source.qualityScore)
  )
}

function evaluateProvenanceValid(source: VenueSourceMetadata): boolean {
  if (source.sourceOrigin === 'live') {
    return hasText(source.provider) && hasText(source.providerRecordId)
  }

  if (hasText(source.provider)) {
    return hasText(source.providerRecordId)
  }

  return true
}

function buildAvailabilityEvidence(source: VenueSourceMetadata): FieldRealAvailabilityEvidence {
  const availabilityStatus = evaluateAvailability(source)

  return {
    availabilityKnown: availabilityStatus !== 'unknown_from_record',
    availabilityStatus,
    openNow: source.openNow,
    hoursKnown: source.hoursKnown,
    likelyOpenForCurrentWindow: source.likelyOpenForCurrentWindow,
    businessStatus: source.businessStatus,
    timeConfidence: source.timeConfidence,
    hoursPressureNotes: source.hoursPressureNotes,
  }
}

function buildQualityEvidence(venue: Venue): FieldRealQualityEvidence {
  const source = venue.source

  return {
    isActive: venue.isActive,
    qualityGateStatus: source.qualityGateStatus,
    qualityGateNotes: source.qualityGateNotes,
    approvalBlockers: source.approvalBlockers,
    demotionReasons: source.demotionReasons,
    suppressionReasons: source.suppressionReasons,
    stalenessStatus: evaluateStaleness(source),
    suppressionStatus: evaluateSuppression(source),
  }
}

function evaluateStop(input: FieldRealStopInput): FieldRealStopEvidence {
  const baseVenueId = input.candidateIdentity.baseVenueId.trim()
  const source = input.venue.source
  const availability = buildAvailabilityEvidence(source)
  const quality = buildQualityEvidence(input.venue)
  const identityUsable = hasText(baseVenueId) && VALID_CANONICAL_ID_PATTERN.test(baseVenueId)
  const sourceUsable = evaluateSourceUsable(source)
  const provenanceValid = evaluateProvenanceValid(source)
  const failureReasons: FieldRealFailureReason[] = []

  if (!hasText(baseVenueId)) {
    failureReasons.push('real:missing_canonical_identity')
  } else if (!VALID_CANONICAL_ID_PATTERN.test(baseVenueId)) {
    failureReasons.push('real:invalid_canonical_identity')
  }

  if (!sourceUsable) {
    failureReasons.push('real:unusable_source')
  }

  if (!provenanceValid) {
    failureReasons.push('real:invalid_provenance')
  }

  if (!input.venue.isActive) {
    failureReasons.push('real:inactive_record')
  }

  if (quality.suppressionStatus === 'suppressed') {
    failureReasons.push('real:suppressed_record')
  }

  if (quality.stalenessStatus === 'stale') {
    failureReasons.push('real:stale_record')
  }

  if (availability.availabilityStatus === 'unavailable_from_record') {
    failureReasons.push('real:unavailable_from_record')
  }

  if (
    failureReasons.length === 0 &&
    availability.availabilityStatus === 'unknown_from_record'
  ) {
    failureReasons.push('real:unknown_readiness')
  }

  return {
    role: input.role,
    identity: {
      candidateIdentityBaseVenueId: baseVenueId,
      candidateIdentityCandidateId: input.candidateIdentity.candidateId,
      candidateIdentityKind: input.candidateIdentity.kind,
    },
    identityUsable,
    sourceUsable,
    provenanceValid,
    availability,
    quality,
    displayName: input.venue.name,
    providerRecordId: source.providerRecordId,
    failureReasons: uniqueReasons(failureReasons),
  }
}

function worstAvailabilityStatus(
  stopEvidence: FieldRealStopEvidence[],
): FieldRealAvailabilityStatus {
  if (
    stopEvidence.some(
      (stop) => stop.availability.availabilityStatus === 'unavailable_from_record',
    )
  ) {
    return 'unavailable_from_record'
  }

  if (
    stopEvidence.some(
      (stop) => stop.availability.availabilityStatus === 'unknown_from_record',
    )
  ) {
    return 'unknown_from_record'
  }

  return 'available_from_record'
}

function worstStalenessStatus(stopEvidence: FieldRealStopEvidence[]): FieldRealStalenessStatus {
  if (stopEvidence.some((stop) => stop.quality.stalenessStatus === 'stale')) {
    return 'stale'
  }

  if (stopEvidence.some((stop) => stop.quality.stalenessStatus === 'unknown')) {
    return 'unknown'
  }

  return 'current'
}

function worstSuppressionStatus(
  stopEvidence: FieldRealStopEvidence[],
): FieldRealSuppressionStatus {
  if (stopEvidence.some((stop) => stop.quality.suppressionStatus === 'suppressed')) {
    return 'suppressed'
  }

  if (stopEvidence.some((stop) => stop.quality.suppressionStatus === 'demoted')) {
    return 'demoted'
  }

  if (stopEvidence.some((stop) => stop.quality.suppressionStatus === 'unknown')) {
    return 'unknown'
  }

  return 'not_suppressed'
}

export function computeFieldRealVerdict(stops: FieldRealStopInput[]): FieldRealVerdict {
  const stopEvidence = stops.map(evaluateStop)
  const routeFailureReasons = uniqueReasons(
    stopEvidence.flatMap((stop) => stop.failureReasons),
  )
  const failingStopCount = stopEvidence.filter((stop) => stop.failureReasons.length > 0)
    .length
  const unknownStopCount = stopEvidence.filter((stop) =>
    stop.failureReasons.includes('real:unknown_readiness'),
  ).length

  if (stopEvidence.length === 0) {
    routeFailureReasons.push('real:unknown_readiness')
  }

  const failureReasons = uniqueReasons(routeFailureReasons)
  const status =
    stopEvidence.length === 0 || failureReasons.includes('real:unknown_readiness')
      ? 'unknown'
      : failureReasons.length > 0
        ? 'fail'
        : 'pass'

  return {
    realReady: status !== 'unknown',
    status,
    identityUsable: stopEvidence.every((stop) => stop.identityUsable),
    sourceUsable: stopEvidence.every((stop) => stop.sourceUsable),
    provenanceValid: stopEvidence.every((stop) => stop.provenanceValid),
    availabilityKnown: stopEvidence.every((stop) => stop.availability.availabilityKnown),
    availabilityStatus: stopEvidence.length > 0 ? worstAvailabilityStatus(stopEvidence) : 'unknown_from_record',
    stalenessStatus: stopEvidence.length > 0 ? worstStalenessStatus(stopEvidence) : 'unknown',
    suppressionStatus:
      stopEvidence.length > 0 ? worstSuppressionStatus(stopEvidence) : 'unknown',
    failureReasons,
    stopEvidence,
    routeEvidence: {
      stopCount: stopEvidence.length,
      failingStopCount,
      unknownStopCount,
      failureReasons,
    },
    provenance: {
      source: 'field',
      evaluatedFrom: 'already_retrieved_record_truth',
      notes: [
        'Computed from already-retrieved static venue record fields only.',
        'Route-arrival temporal feasibility remains Bearings-owned.',
      ],
    },
    compatibility: {
      greatStopRealInputs: {
        realReady: status !== 'unknown',
        realVerdict: status,
        realFailureReasons: failureReasons,
        unusableStopCount: failingStopCount,
        unknownStopCount,
      },
    },
  }
}

export function computeFieldRealVerdictForArcCandidate(
  candidate: ArcCandidate,
): FieldRealVerdict {
  return computeFieldRealVerdict(
    candidate.stops.map((stop) => ({
      role: stop.role,
      venue: stop.scoredVenue.venue,
      candidateIdentity: stop.scoredVenue.candidateIdentity,
    })),
  )
}
