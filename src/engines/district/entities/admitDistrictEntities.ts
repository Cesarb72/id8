import type { Venue } from '../../../domain/types/venue'
import type {
  DistrictAdmittedPlaceEntity,
  DistrictAdmissionStatus,
  DistrictBlockedEntityDiagnostic,
  DistrictCoordinateSource,
  DistrictIdentityKind,
} from '../types/districtTypes'
import { normalizePlaceEntity } from './normalizePlaceEntity'

const LIVE_ID_PREFIX = 'live_google_'
const MIN_LIVE_CONFIDENCE = 0.56
const MIN_LIVE_COMPLETENESS = 0.55

type DistrictAdmissionResult = {
  admitted: DistrictAdmittedPlaceEntity[]
  blocked: DistrictBlockedEntityDiagnostic[]
}

function deriveSourceMode(venue: Venue): DistrictAdmittedPlaceEntity['lineage']['sourceMode'] {
  if (venue.source.sourceOrigin === 'live') {
    return 'live'
  }
  if (venue.source.curatedSubtype === 'bootstrap-portable') {
    return 'bootstrap'
  }
  return 'curated'
}

function hasRealCoordinates(venue: Venue): venue is Venue & {
  source: Venue['source'] & { latitude: number; longitude: number }
} {
  return (
    typeof venue.source.latitude === 'number' &&
    Number.isFinite(venue.source.latitude) &&
    typeof venue.source.longitude === 'number' &&
    Number.isFinite(venue.source.longitude)
  )
}

function buildCanonicalVenueId(
  venue: Venue,
  identityKind: DistrictIdentityKind,
): string | undefined {
  return identityKind === 'canonical' ? venue.id : undefined
}

function buildBlockedDiagnostic(params: {
  venue: Venue
  admissionStatus: Exclude<DistrictAdmissionStatus, 'admitted'>
  identityKind: DistrictIdentityKind
  reason: string
  coordinateSource?: DistrictCoordinateSource
}): DistrictBlockedEntityDiagnostic {
  const { venue, admissionStatus, identityKind, reason, coordinateSource } = params
  return {
    venueId: venue.id,
    venueName: venue.name,
    sourceOrigin: venue.source.sourceOrigin,
    sourceMode: deriveSourceMode(venue),
    admissionStatus,
    identityKind,
    canonicalVenueId: buildCanonicalVenueId(venue, identityKind),
    providerRecordId: venue.source.providerRecordId,
    confidence: venue.source.sourceConfidence,
    completenessScore: venue.source.completenessScore,
    qualityGateStatus: venue.source.qualityGateStatus,
    reason,
    ...(coordinateSource ? { coordinateSource } : {}),
  }
}

function admitCuratedVenue(venue: Venue): DistrictAdmittedPlaceEntity {
  const coordinateSource: DistrictCoordinateSource = hasRealCoordinates(venue)
    ? 'real'
    : 'pseudo_fixture'
  const entity = normalizePlaceEntity(venue, {
    coordinateSource,
    locationOverride: hasRealCoordinates(venue)
      ? {
          lat: venue.source.latitude,
          lng: venue.source.longitude,
        }
      : undefined,
    sourceMode: deriveSourceMode(venue),
    sourceOrigin: venue.source.sourceOrigin,
    admissionStatus: 'admitted',
    identityKind: 'canonical',
    canonicalVenueId: venue.id,
    providerRecordId: venue.source.providerRecordId,
  })

  return {
    entity,
    lineage: {
      venueId: venue.id,
      sourceOrigin: venue.source.sourceOrigin,
      sourceMode: deriveSourceMode(venue),
      identityKind: 'canonical',
      canonicalVenueId: venue.id,
      providerRecordId: venue.source.providerRecordId,
    },
    admission: {
      status: 'admitted',
      coordinateSource,
      confidence: venue.source.sourceConfidence,
      completenessScore: venue.source.completenessScore,
    },
  }
}

function getLiveIdentityKind(venue: Venue): DistrictIdentityKind {
  return venue.id.startsWith(LIVE_ID_PREFIX) ? 'live_only' : 'canonical'
}

function isLiveIdentityResolved(venue: Venue): boolean {
  const providerRecordId = venue.source.providerRecordId?.trim()
  if (!providerRecordId) {
    return false
  }
  if (!venue.id.startsWith(LIVE_ID_PREFIX)) {
    return false
  }
  return venue.id === `${LIVE_ID_PREFIX}${providerRecordId}`
}

function getLiveBlockStatus(venue: Venue): Exclude<DistrictAdmissionStatus, 'admitted'> | undefined {
  if (!isLiveIdentityResolved(venue)) {
    return 'blocked_unresolved_identity'
  }
  if (!hasRealCoordinates(venue)) {
    return 'blocked_missing_coordinates'
  }
  if (venue.source.sourceConfidence < MIN_LIVE_CONFIDENCE) {
    return 'blocked_low_confidence'
  }
  if (
    venue.source.completenessScore < MIN_LIVE_COMPLETENESS ||
    venue.source.qualityGateStatus === 'suppressed'
  ) {
    return 'blocked_incomplete'
  }
  return undefined
}

function admitLiveVenue(
  venue: Venue,
): DistrictAdmittedPlaceEntity | DistrictBlockedEntityDiagnostic {
  const identityKind = getLiveIdentityKind(venue)
  const blockedStatus = getLiveBlockStatus(venue)

  if (blockedStatus) {
    const reasons: Record<
      Exclude<DistrictAdmissionStatus, 'admitted'>,
      string
    > = {
      diagnostic_only: 'Live provider venue retained for diagnostics only.',
      blocked_unresolved_identity:
        'Live provider venue is missing an admitted canonical or live-only identity.',
      blocked_incomplete: 'Live provider venue is incomplete for district clustering.',
      blocked_low_confidence: 'Live provider venue confidence is below district admission threshold.',
      blocked_missing_coordinates:
        'Live provider venue is missing real coordinates required for district admission.',
    }
    return buildBlockedDiagnostic({
      venue,
      admissionStatus: blockedStatus,
      identityKind,
      reason: reasons[blockedStatus],
    })
  }

  const providerRecordId = venue.source.providerRecordId?.trim()
  const entity = normalizePlaceEntity(venue, {
    coordinateSource: 'real',
    locationOverride: {
      lat: venue.source.latitude,
      lng: venue.source.longitude,
    },
    sourceMode: deriveSourceMode(venue),
    sourceOrigin: venue.source.sourceOrigin,
    admissionStatus: 'admitted',
    identityKind,
    canonicalVenueId: buildCanonicalVenueId(venue, identityKind),
    providerRecordId,
  })

  return {
    entity,
    lineage: {
      venueId: venue.id,
      sourceOrigin: venue.source.sourceOrigin,
      sourceMode: deriveSourceMode(venue),
      identityKind,
      canonicalVenueId: buildCanonicalVenueId(venue, identityKind),
      providerRecordId,
    },
    admission: {
      status: 'admitted',
      coordinateSource: 'real',
      confidence: venue.source.sourceConfidence,
      completenessScore: venue.source.completenessScore,
    },
  }
}

export function admitDistrictEntities(venues: Venue[]): DistrictAdmissionResult {
  const admitted: DistrictAdmittedPlaceEntity[] = []
  const blocked: DistrictBlockedEntityDiagnostic[] = []

  for (const venue of venues) {
    if (venue.source.sourceOrigin !== 'live') {
      admitted.push(admitCuratedVenue(venue))
      continue
    }

    const liveResult = admitLiveVenue(venue)
    if ('entity' in liveResult) {
      admitted.push(liveResult)
      continue
    }
    blocked.push(liveResult)
  }

  return { admitted, blocked }
}
