import { formRawPockets, buildRawPocketFromEntities } from '../clustering/formRawPockets'
import { haversineDistanceM } from '../../../domain/shared/geo/geoDistance'
import { admitDistrictEntities } from '../entities/admitDistrictEntities'
import { inferPocketIdentity } from '../identity/inferPocketIdentity'
import { rankAndSelectPockets } from '../ranking/rankAndSelectPockets'
import { refinePocketsWithSplitMerge } from '../refinement/refinePocketsWithSplitMerge'
import { assemblePocketProfiles } from '../scoring/assemblePocketProfiles'
import { applyPocketViabilityRules } from '../viability/applyPocketViabilityRules'
import type {
  DistrictClusteringConfig,
  DistrictAdmittedPlaceEntity,
  DistrictBlockedEntityDiagnostic,
  DistrictOpportunityProfile,
  IdentifiedPocket,
  PlaceEntity,
  RawPocket,
} from '../types/districtTypes'
import type { Venue } from '../../../domain/types/venue'

export type DistrictCandidateAssignmentMethod =
  | 'district_intelligence_direct'
  | 'district_intelligence_nearest_pocket'
  | 'coordinate_fallback'
  | 'neighborhood_fallback'
  | 'missing_geo'

export type DistrictCandidateGeoAssignment = {
  venueId: string
  pocketId: string
  pocketLabel: string
  centroid: { lat: number; lng: number }
  radiusM: number
  classification: DistrictOpportunityProfile['classification']
  truthTier: DistrictOpportunityProfile['meta']['truthTier']
  source: 'district_intelligence'
  assignmentMethod: Extract<
    DistrictCandidateAssignmentMethod,
    'district_intelligence_direct' | 'district_intelligence_nearest_pocket'
  >
  nearestPocketDistanceM?: number
  nearestPocketThresholdM?: number
}

export type DistrictLiveCandidateGeoDiagnostic = {
  candidateId: string
  candidateName: string
  providerRecordId?: string
  sourceRecordId?: string
  hasCoordinates: boolean
  confidence?: number
  completenessScore?: number
  admissionStatus: DistrictAdmittedPlaceEntity['admission']['status'] | DistrictBlockedEntityDiagnostic['admissionStatus']
  admissionBlockedReason?: string
  primaryPocketAssignment?: string
  fallbackPocketAssignment?: string
  nearestPocketId?: string
  nearestPocketDistanceM?: number
  nearestPocketThresholdM: number
  finalGeoSource: 'district_intelligence' | 'coordinate_fallback' | 'neighborhood_fallback' | 'missing_geo'
  assignmentMethod: DistrictCandidateAssignmentMethod
  assignmentBlockedReason?: string
}

export type DistrictCandidateGeoIndex = {
  assignmentsByVenueId: Map<string, DistrictCandidateGeoAssignment>
  liveCandidateDiagnosticsByVenueId: Map<string, DistrictLiveCandidateGeoDiagnostic>
  liveCandidateDiagnostics: DistrictLiveCandidateGeoDiagnostic[]
  profileCount: number
  assignedVenueCount: number
  admittedVenueCount: number
  blockedVenueCount: number
  selectedPocketIds: string[]
  notes: string[]
}

const PRIMARY_CLUSTERING: DistrictClusteringConfig = {
  epsM: 180,
  minPoints: 5,
  maxRadiusCapM: 600,
}

const FALLBACK_CLUSTERING: DistrictClusteringConfig = {
  epsM: 240,
  minPoints: 3,
  maxRadiusCapM: 600,
}

const LIVE_NEAREST_POCKET_ADJACENCY_M = FALLBACK_CLUSTERING.epsM

function uniqueVenuesById(venues: Venue[]): Venue[] {
  const seen = new Set<string>()
  const unique: Venue[] = []
  for (const venue of venues) {
    if (seen.has(venue.id)) {
      continue
    }
    seen.add(venue.id)
    unique.push(venue)
  }
  return unique
}

function buildEntityPocketLookup(pockets: IdentifiedPocket[]): Map<string, IdentifiedPocket> {
  const lookup = new Map<string, IdentifiedPocket>()
  for (const pocket of pockets) {
    for (const entity of pocket.entities) {
      lookup.set(entity.id, pocket)
    }
  }
  return lookup
}

function buildRawPocketLookup(pockets: RawPocket[]): Map<string, string> {
  const lookup = new Map<string, string>()
  for (const pocket of pockets) {
    for (const entityId of pocket.entityIds) {
      lookup.set(entityId, pocket.id)
    }
  }
  return lookup
}

function buildProfileLookup(
  profiles: DistrictOpportunityProfile[],
): Map<string, DistrictOpportunityProfile> {
  return new Map(profiles.map((profile) => [profile.pocketId, profile]))
}

function buildAcceptedPocketLookup(
  entities: PlaceEntity[],
  clustering: DistrictClusteringConfig,
): Map<string, string> {
  const rawPockets = formRawPockets({
    entities,
    clustering,
    origin: clustering === PRIMARY_CLUSTERING ? 'primary' : 'fallback_recluster',
    clusteringSource: clustering === PRIMARY_CLUSTERING ? 'primary' : 'fallback',
    fallbackReasonCode:
      clustering === PRIMARY_CLUSTERING ? undefined : 'recluster_no_primary_viable',
  })
  return buildRawPocketLookup(applyPocketViabilityRules(rawPockets).accepted)
}

function toFixedMeter(value: number): number {
  return Number(value.toFixed(1))
}

function getNearestPocket(params: {
  entity: PlaceEntity
  pockets: IdentifiedPocket[]
  profileByPocketId: Map<string, DistrictOpportunityProfile>
}): {
  pocket: IdentifiedPocket
  profile: DistrictOpportunityProfile
  distanceM: number
  thresholdM: number
  qualifies: boolean
} | undefined {
  let nearest:
    | {
        pocket: IdentifiedPocket
        profile: DistrictOpportunityProfile
        distanceM: number
        thresholdM: number
        qualifies: boolean
      }
    | undefined

  for (const pocket of params.pockets) {
    const profile = params.profileByPocketId.get(pocket.id)
    if (!profile) {
      continue
    }
    const centroidDistanceM = haversineDistanceM(params.entity.location, profile.centroid)
    const nearestEntityDistanceM = Math.min(
      ...pocket.entities.map((entry) => haversineDistanceM(params.entity.location, entry.location)),
    )
    const thresholdM = Math.min(
      FALLBACK_CLUSTERING.maxRadiusCapM,
      profile.radiusM + LIVE_NEAREST_POCKET_ADJACENCY_M,
    )
    const qualifies =
      centroidDistanceM <= thresholdM &&
      nearestEntityDistanceM <= LIVE_NEAREST_POCKET_ADJACENCY_M
    const candidate = {
      pocket,
      profile,
      distanceM: toFixedMeter(centroidDistanceM),
      thresholdM: toFixedMeter(thresholdM),
      qualifies,
    }
    if (!nearest || candidate.distanceM < nearest.distanceM) {
      nearest = candidate
    }
  }

  return nearest
}

function isAdmittedLiveWithRealCoordinates(entry: DistrictAdmittedPlaceEntity): boolean {
  return entry.lineage.sourceOrigin === 'live' && entry.admission.coordinateSource === 'real'
}

function getFallbackGeoSource(venue: Venue): DistrictLiveCandidateGeoDiagnostic['finalGeoSource'] {
  if (
    typeof venue.source.latitude === 'number' &&
    Number.isFinite(venue.source.latitude) &&
    typeof venue.source.longitude === 'number' &&
    Number.isFinite(venue.source.longitude)
  ) {
    return 'coordinate_fallback'
  }
  if (venue.neighborhood.trim()) {
    return 'neighborhood_fallback'
  }
  return 'missing_geo'
}

function toFallbackAssignmentMethod(
  source: DistrictLiveCandidateGeoDiagnostic['finalGeoSource'],
): DistrictCandidateAssignmentMethod {
  return source === 'district_intelligence' ? 'district_intelligence_direct' : source
}

function runDistrictPocketPipeline(entities: PlaceEntity[]): {
  identifiedPockets: IdentifiedPocket[]
  notes: string[]
} {
  const notes: string[] = []
  if (entities.length < 3) {
    return {
      identifiedPockets: [],
      notes: ['district_intelligence_unavailable:insufficient_entities'],
    }
  }

  let rawPockets = formRawPockets({
    entities,
    clustering: PRIMARY_CLUSTERING,
    origin: 'primary',
    clusteringSource: 'primary',
    stageNotes: ['Candidate-board District Intelligence primary DBSCAN pass.'],
  })
  let viability = applyPocketViabilityRules(rawPockets)

  if (viability.accepted.length === 0) {
    notes.push('district_intelligence_fallback_recluster_applied')
    const fallbackRawPockets = formRawPockets({
      entities,
      clustering: FALLBACK_CLUSTERING,
      origin: 'fallback_recluster',
      clusteringSource: 'fallback',
      fallbackReasonCode: 'recluster_no_primary_viable',
      stageNotes: ['Candidate-board District Intelligence fallback DBSCAN pass.'],
    })
    if (fallbackRawPockets.length > 0) {
      rawPockets = fallbackRawPockets
      viability = applyPocketViabilityRules(rawPockets)
    }
  }

  if (rawPockets.length === 0) {
    notes.push('district_intelligence_synthetic_fallback_applied')
    const synthetic = buildRawPocketFromEntities(
      entities.slice(0, Math.min(8, entities.length)),
      FALLBACK_CLUSTERING,
      {
        pocketId: 'raw-pocket-synthetic-1',
        origin: 'synthetic_fallback',
        clusteringSource: 'synthetic',
        fallbackReasonCode: 'synthetic_no_clusters',
        stageNotes: ['Candidate-board District Intelligence synthetic fallback pocket.'],
      },
    )
    rawPockets = [synthetic]
    viability = applyPocketViabilityRules(rawPockets)
  }

  if (viability.accepted.length === 0) {
    return {
      identifiedPockets: [],
      notes: [...notes, 'district_intelligence_unavailable:no_viable_pockets'],
    }
  }

  const refinedPockets = refinePocketsWithSplitMerge(viability.accepted)
  return {
    identifiedPockets: inferPocketIdentity(refinedPockets),
    notes,
  }
}

export function buildDistrictCandidateGeoIndex(venues: Venue[]): DistrictCandidateGeoIndex {
  const uniqueVenues = uniqueVenuesById(venues)
  const venueById = new Map(uniqueVenues.map((venue) => [venue.id, venue]))
  const admission = admitDistrictEntities(uniqueVenues)
  const entities = admission.admitted.map((entry) => entry.entity)
  const primaryPocketByVenueId = buildAcceptedPocketLookup(entities, PRIMARY_CLUSTERING)
  const fallbackPocketByVenueId = buildAcceptedPocketLookup(entities, FALLBACK_CLUSTERING)
  const pipeline = runDistrictPocketPipeline(entities)
  const profiles = assemblePocketProfiles(pipeline.identifiedPockets, {
    vertical: 'hospitality',
  })
  const ranked = rankAndSelectPockets(profiles)
  const profileByPocketId = buildProfileLookup(profiles)
  const entityPocketByVenueId = buildEntityPocketLookup(pipeline.identifiedPockets)
  const assignmentsByVenueId = new Map<string, DistrictCandidateGeoAssignment>()
  const liveCandidateDiagnosticsByVenueId = new Map<string, DistrictLiveCandidateGeoDiagnostic>()

  for (const entity of entities) {
    const pocket = entityPocketByVenueId.get(entity.id)
    if (!pocket) {
      continue
    }
    const profile = profileByPocketId.get(pocket.id)
    if (!profile) {
      continue
    }
    assignmentsByVenueId.set(entity.id, {
      venueId: entity.id,
      pocketId: profile.pocketId,
      pocketLabel: profile.label,
      centroid: profile.centroid,
      radiusM: profile.radiusM,
      classification: profile.classification,
      truthTier: profile.meta.truthTier,
      source: 'district_intelligence',
      assignmentMethod: 'district_intelligence_direct',
    })
  }

  for (const entry of admission.admitted) {
    if (!isAdmittedLiveWithRealCoordinates(entry) || assignmentsByVenueId.has(entry.lineage.venueId)) {
      continue
    }
    const nearest = getNearestPocket({
      entity: entry.entity,
      pockets: pipeline.identifiedPockets,
      profileByPocketId,
    })
    if (!nearest?.qualifies) {
      continue
    }
    assignmentsByVenueId.set(entry.lineage.venueId, {
      venueId: entry.lineage.venueId,
      pocketId: nearest.profile.pocketId,
      pocketLabel: nearest.profile.label,
      centroid: nearest.profile.centroid,
      radiusM: nearest.profile.radiusM,
      classification: nearest.profile.classification,
      truthTier: nearest.profile.meta.truthTier,
      source: 'district_intelligence',
      assignmentMethod: 'district_intelligence_nearest_pocket',
      nearestPocketDistanceM: nearest.distanceM,
      nearestPocketThresholdM: nearest.thresholdM,
    })
  }

  for (const entry of admission.admitted) {
    if (entry.lineage.sourceOrigin !== 'live') {
      continue
    }
    const venue = venueById.get(entry.lineage.venueId)
    const assignment = assignmentsByVenueId.get(entry.lineage.venueId)
    const nearest = assignment
      ? undefined
      : getNearestPocket({
          entity: entry.entity,
          pockets: pipeline.identifiedPockets,
          profileByPocketId,
        })
    const fallbackSource = venue ? getFallbackGeoSource(venue) : 'missing_geo'
    const diagnostic: DistrictLiveCandidateGeoDiagnostic = {
      candidateId: entry.lineage.venueId,
      candidateName: entry.entity.name,
      ...(entry.lineage.providerRecordId ? { providerRecordId: entry.lineage.providerRecordId } : {}),
      ...(entry.lineage.providerRecordId ? { sourceRecordId: entry.lineage.providerRecordId } : {}),
      hasCoordinates: entry.admission.coordinateSource === 'real',
      confidence: entry.admission.confidence,
      completenessScore: entry.admission.completenessScore,
      admissionStatus: entry.admission.status,
      ...(primaryPocketByVenueId.get(entry.lineage.venueId)
        ? { primaryPocketAssignment: primaryPocketByVenueId.get(entry.lineage.venueId) }
        : {}),
      ...(fallbackPocketByVenueId.get(entry.lineage.venueId)
        ? { fallbackPocketAssignment: fallbackPocketByVenueId.get(entry.lineage.venueId) }
        : {}),
      ...(assignment?.pocketId ?? nearest?.profile.pocketId
        ? { nearestPocketId: assignment?.pocketId ?? nearest?.profile.pocketId }
        : {}),
      ...(assignment?.nearestPocketDistanceM ?? nearest?.distanceM
        ? { nearestPocketDistanceM: assignment?.nearestPocketDistanceM ?? nearest?.distanceM }
        : {}),
      nearestPocketThresholdM:
        assignment?.nearestPocketThresholdM ?? nearest?.thresholdM ?? LIVE_NEAREST_POCKET_ADJACENCY_M,
      finalGeoSource: assignment ? 'district_intelligence' : fallbackSource,
      assignmentMethod: assignment
        ? assignment.assignmentMethod
        : toFallbackAssignmentMethod(fallbackSource),
      ...(!assignment
        ? {
            assignmentBlockedReason: nearest
              ? 'nearest_pocket_outside_threshold'
              : 'no_district_pocket_available',
          }
        : {}),
    }
    liveCandidateDiagnosticsByVenueId.set(entry.lineage.venueId, diagnostic)
  }

  for (const blocked of admission.blocked) {
    if (blocked.sourceOrigin !== 'live') {
      continue
    }
    const venue = venueById.get(blocked.venueId)
    const fallbackSource = venue ? getFallbackGeoSource(venue) : 'missing_geo'
    liveCandidateDiagnosticsByVenueId.set(blocked.venueId, {
      candidateId: blocked.venueId,
      candidateName: blocked.venueName,
      ...(blocked.providerRecordId ? { providerRecordId: blocked.providerRecordId } : {}),
      ...(blocked.providerRecordId ? { sourceRecordId: blocked.providerRecordId } : {}),
      hasCoordinates:
        typeof venue?.source.latitude === 'number' &&
        Number.isFinite(venue.source.latitude) &&
        typeof venue.source.longitude === 'number' &&
        Number.isFinite(venue.source.longitude),
      confidence: blocked.confidence,
      completenessScore: blocked.completenessScore,
      admissionStatus: blocked.admissionStatus,
      admissionBlockedReason: blocked.reason,
      nearestPocketThresholdM: LIVE_NEAREST_POCKET_ADJACENCY_M,
      finalGeoSource: fallbackSource,
      assignmentMethod: toFallbackAssignmentMethod(fallbackSource),
      assignmentBlockedReason: blocked.reason,
    })
  }

  return {
    assignmentsByVenueId,
    liveCandidateDiagnosticsByVenueId,
    liveCandidateDiagnostics: [...liveCandidateDiagnosticsByVenueId.values()],
    profileCount: profiles.length,
    assignedVenueCount: assignmentsByVenueId.size,
    admittedVenueCount: admission.admitted.length,
    blockedVenueCount: admission.blocked.length,
    selectedPocketIds: ranked.selected.map((entry) => entry.profile.pocketId),
    notes: pipeline.notes,
  }
}
