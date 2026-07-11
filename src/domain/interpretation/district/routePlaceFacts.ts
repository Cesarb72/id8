import type { ArcCandidate, ArcStop } from '../../types/arc'
import type {
  BearingsRouteStopRole,
  DistrictRoutePlaceFacts,
} from '../../bearings/routePlaceRightContract'
import { getArcStopBaseVenueId } from '../../candidates/candidateIdentity'

const DISTRICT_ROUTE_PLACE_FACTS_VERSION = 'gw1-bearings-4-compatibility-projection'

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))]
}

function routeRoleFor(stop: ArcStop): BearingsRouteStopRole {
  if (stop.role === 'warmup') return 'start'
  if (stop.role === 'peak') return 'highlight'
  if (stop.role === 'cooldown') return 'windDown'
  if (stop.role === 'wildcard') return 'wildcard'
  return 'unknown'
}

export function buildDistrictRoutePlaceFactsForArcCandidate(params: {
  candidate: ArcCandidate
  requiredStopBaseVenueIds?: string[]
}): DistrictRoutePlaceFacts {
  const { candidate } = params
  const stopBaseVenueIds = candidate.stops.map(getArcStopBaseVenueId)
  const assignmentsByVenueId = new Map(
    candidate.spatial.clusterAssignments.map((assignment) => [assignment.venueId, assignment]),
  )
  const assignmentForStop = (stop: ArcStop) =>
    assignmentsByVenueId.get(stop.scoredVenue.venue.id) ??
    assignmentsByVenueId.get(getArcStopBaseVenueId(stop))
  const neighborhoods = unique(
    candidate.stops
      .map((stop) => assignmentForStop(stop)?.neighborhood ?? stop.scoredVenue.venue.neighborhood)
      .filter(Boolean),
  )
  const clusterIds = unique(
    candidate.stops
      .map((stop) => assignmentForStop(stop)?.clusterId)
      .filter((clusterId): clusterId is string => Boolean(clusterId)),
  )
  const homeNeighborhood = neighborhoods[0]
  const mismatchedStopBaseVenueIds =
    neighborhoods.length > 1 && homeNeighborhood
      ? candidate.stops
          .filter((stop) => {
            const neighborhood =
              assignmentForStop(stop)?.neighborhood ?? stop.scoredVenue.venue.neighborhood
            return neighborhood !== homeNeighborhood
          })
          .map(getArcStopBaseVenueId)
      : []
  const requiredStopBaseVenueIds = params.requiredStopBaseVenueIds ?? []
  const anchorBaseVenueId =
    requiredStopBaseVenueIds[0] ??
    candidate.stops.find((stop) => stop.role === 'peak')?.scoredVenue.candidateIdentity.baseVenueId
  const anchorStop = anchorBaseVenueId
    ? candidate.stops.find((stop) => getArcStopBaseVenueId(stop) === anchorBaseVenueId)
    : undefined
  const anchorAssignment = anchorStop ? assignmentForStop(anchorStop) : undefined
  const supportStops = anchorBaseVenueId
    ? candidate.stops.filter((stop) => getArcStopBaseVenueId(stop) !== anchorBaseVenueId)
    : candidate.stops.filter((stop) => stop.role !== 'peak')
  const supportProximity =
    anchorBaseVenueId && anchorAssignment
      ? supportStops.map((stop) => {
          const supportAssignment = assignmentForStop(stop)
          return {
            supportBaseVenueId: getArcStopBaseVenueId(stop),
            supportRole: routeRoleFor(stop),
            anchorBaseVenueId,
            sameNeighborhood:
              supportAssignment?.neighborhood !== undefined
                ? supportAssignment.neighborhood === anchorAssignment.neighborhood
                : undefined,
            sameCluster:
              supportAssignment?.clusterId !== undefined
                ? supportAssignment.clusterId === anchorAssignment.clusterId
                : undefined,
            confidence: supportAssignment ? 1 : 0.5,
            missingFactReasons: supportAssignment ? [] : ['support_cluster_assignment_missing'],
          }
        })
      : []
  const sameNeighborhoodSupportBaseVenueIds = supportProximity
    .filter((fact) => fact.sameNeighborhood)
    .map((fact) => fact.supportBaseVenueId)
  const sameClusterSupportBaseVenueIds = supportProximity
    .filter((fact) => fact.sameCluster)
    .map((fact) => fact.supportBaseVenueId)
  const structuralMissingReasons = [
    ...(candidate.spatial.clusterAssignments.length > 0 ? [] : ['cluster_assignments_missing']),
    ...(candidate.spatial.score !== undefined ? [] : ['spatial_score_missing']),
  ]

  return {
    routeId: candidate.id,
    candidateId: candidate.id,
    stopBaseVenueIds,
    requiredStopBaseVenueIds,
    sameNeighborhood: {
      allStopsSameNeighborhood: neighborhoods.length <= 1,
      neighborhoods,
      mismatchedStopBaseVenueIds,
      confidence: neighborhoods.length > 0 ? 1 : 0,
      missingFactReasons: neighborhoods.length > 0 ? [] : ['neighborhood_facts_missing'],
    },
    clusterCoherence: {
      homeClusterId: candidate.spatial.homeClusterId,
      clusterIds,
      clusterEscapeCount: candidate.spatial.clusterEscapeCount,
      repeatedClusterEscapeCount: candidate.spatial.repeatedClusterEscapeCount,
      longTransitionCount: candidate.spatial.longTransitionCount,
      backtrackDetected: candidate.spatial.repeatedClusterEscapeCount > 0,
      confidence: candidate.spatial.clusterAssignments.length > 0 ? 1 : 0,
      missingFactReasons:
        candidate.spatial.clusterAssignments.length > 0 ? [] : ['cluster_assignments_missing'],
    },
    compactness: {
      compactnessScore: candidate.spatial.score,
      confidence: 1,
      missingFactReasons: [],
    },
    supportProximity,
    anchorSupportRelationships: anchorBaseVenueId
      ? [
          {
            anchorBaseVenueId,
            supportBaseVenueIds: supportStops.map(getArcStopBaseVenueId),
            sameNeighborhoodSupportCount: sameNeighborhoodSupportBaseVenueIds.length,
            sameClusterSupportCount: sameClusterSupportBaseVenueIds.length,
            confidence: anchorAssignment ? 1 : 0.5,
            missingFactReasons: anchorAssignment ? [] : ['anchor_cluster_assignment_missing'],
          },
        ]
      : [],
    structuralConfidence: {
      status:
        structuralMissingReasons.length > 0
          ? 'missing'
          : candidate.spatial.clusterAssignments.length === candidate.stops.length
            ? 'complete'
            : 'partial',
      missingFactReasons: structuralMissingReasons,
      notes: [
        'Compatibility projection from existing route spatial facts until a dedicated route-level District place-facts producer exists.',
      ],
    },
    provenance: {
      source: 'district',
      version: DISTRICT_ROUTE_PLACE_FACTS_VERSION,
      evidenceIds: [candidate.id],
      notes: [
        'Projected from ArcCandidate.spatial as a District structural facts compatibility view.',
      ],
    },
  }
}
