import { formRawPockets, buildRawPocketFromEntities } from '../clustering/formRawPockets'
import { admitDistrictEntities } from '../entities/admitDistrictEntities'
import { inferPocketIdentity } from '../identity/inferPocketIdentity'
import { rankAndSelectPockets } from '../ranking/rankAndSelectPockets'
import { refinePocketsWithSplitMerge } from '../refinement/refinePocketsWithSplitMerge'
import { assemblePocketProfiles } from '../scoring/assemblePocketProfiles'
import { applyPocketViabilityRules } from '../viability/applyPocketViabilityRules'
import type {
  DistrictClusteringConfig,
  DistrictOpportunityProfile,
  IdentifiedPocket,
  PlaceEntity,
} from '../types/districtTypes'
import type { Venue } from '../../../domain/types/venue'

export type DistrictCandidateGeoAssignment = {
  venueId: string
  pocketId: string
  pocketLabel: string
  centroid: { lat: number; lng: number }
  radiusM: number
  classification: DistrictOpportunityProfile['classification']
  truthTier: DistrictOpportunityProfile['meta']['truthTier']
  source: 'district_intelligence'
}

export type DistrictCandidateGeoIndex = {
  assignmentsByVenueId: Map<string, DistrictCandidateGeoAssignment>
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

function buildProfileLookup(
  profiles: DistrictOpportunityProfile[],
): Map<string, DistrictOpportunityProfile> {
  return new Map(profiles.map((profile) => [profile.pocketId, profile]))
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
  const admission = admitDistrictEntities(uniqueVenues)
  const entities = admission.admitted.map((entry) => entry.entity)
  const pipeline = runDistrictPocketPipeline(entities)
  const profiles = assemblePocketProfiles(pipeline.identifiedPockets, {
    vertical: 'hospitality',
  })
  const ranked = rankAndSelectPockets(profiles)
  const profileByPocketId = buildProfileLookup(profiles)
  const entityPocketByVenueId = buildEntityPocketLookup(pipeline.identifiedPockets)
  const assignmentsByVenueId = new Map<string, DistrictCandidateGeoAssignment>()

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
    })
  }

  return {
    assignmentsByVenueId,
    profileCount: profiles.length,
    assignedVenueCount: assignmentsByVenueId.size,
    admittedVenueCount: admission.admitted.length,
    blockedVenueCount: admission.blocked.length,
    selectedPocketIds: ranked.selected.map((entry) => entry.profile.pocketId),
    notes: pipeline.notes,
  }
}
