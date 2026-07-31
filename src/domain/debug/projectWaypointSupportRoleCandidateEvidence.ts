import { roleProjection } from '../config/roleProjection'
import type { RolePools } from '../arc/buildRolePools'
import type { CandidateEvidenceObservation } from '../diagnostics/candidateEvidenceProtocol'
import type { ArcCandidate, ScoredVenue } from '../types/arc'
import type {
  LiveCompetitionStage,
  RoleCompetitionDiagnostics,
  WaypointSupportRoleCandidateEvidenceRow,
} from '../types/diagnostics'
import type { UserStopRole } from '../types/itinerary'
import type { InternalRole } from '../types/venue'

interface ProjectWaypointSupportRoleCandidateEvidenceInput {
  scoredVenues: readonly ScoredVenue[]
  rolePools: RolePools
  arcCandidates: readonly ArcCandidate[]
  selectedArc: ArcCandidate
  roleCompetitionByRole: Partial<Record<UserStopRole, RoleCompetitionDiagnostics>>
}

const supportRoles: InternalRole[] = ['warmup', 'cooldown']

function candidateId(candidate: ScoredVenue): string {
  return candidate.candidateIdentity.candidateId
}

function rolePool(rolePools: RolePools, role: InternalRole): readonly ScoredVenue[] {
  if (role === 'warmup') {
    return rolePools.warmup
  }
  if (role === 'cooldown') {
    return rolePools.cooldown
  }
  if (role === 'peak') {
    return rolePools.peak
  }
  return rolePools.wildcard
}

function available<TKey extends string, TValue>(
  key: TKey,
  value: TValue,
): CandidateEvidenceObservation<'Waypoint', TKey, TValue> {
  return {
    producer: 'Waypoint',
    key,
    available: true,
    value,
  }
}

function unavailable<TKey extends string, TValue>(
  key: TKey,
  unavailableReason: 'not_observed' | 'not_retained' | 'not_applicable',
): CandidateEvidenceObservation<'Waypoint', TKey, TValue> {
  return {
    producer: 'Waypoint',
    key,
    available: false,
    unavailableReason,
  }
}

function liveCompetitionLostAtStageObservation(params: {
  candidate: ScoredVenue
  strongestCandidateForRole: boolean
  competition: RoleCompetitionDiagnostics | undefined
}): WaypointSupportRoleCandidateEvidenceRow['observations']['lostAtStage'] {
  if (params.candidate.venue.source.sourceOrigin !== 'live') {
    return unavailable('lost_at_stage', 'not_applicable')
  }
  if (!params.competition) {
    return unavailable('lost_at_stage', 'not_observed')
  }
  if (!params.strongestCandidateForRole) {
    return unavailable('lost_at_stage', 'not_retained')
  }
  const lostAtStage = params.competition.strongestLiveLostAtStage
  return lostAtStage
    ? available('lost_at_stage', lostAtStage as LiveCompetitionStage)
    : unavailable('lost_at_stage', 'not_observed')
}

export function projectWaypointSupportRoleCandidateEvidenceRows({
  scoredVenues,
  rolePools,
  arcCandidates,
  selectedArc,
  roleCompetitionByRole,
}: ProjectWaypointSupportRoleCandidateEvidenceInput): WaypointSupportRoleCandidateEvidenceRow[] {
  return supportRoles.flatMap((internalRole) => {
    const requestedRole = roleProjection[internalRole]
    const pool = rolePool(rolePools, internalRole)
    const poolPositionByCandidateId = new Map(
      pool.map((candidate, index) => [candidateId(candidate), index] as const),
    )
    const arcAssemblyCandidateIds = new Set(
      arcCandidates.flatMap((arcCandidate) =>
        arcCandidate.stops
          .filter((stop) => stop.role === internalRole)
          .map((stop) => candidateId(stop.scoredVenue)),
      ),
    )
    const selectedStop = selectedArc.stops.find((stop) => stop.role === internalRole)
    const selectedCandidateId = selectedStop ? candidateId(selectedStop.scoredVenue) : undefined
    const competition = roleCompetitionByRole[requestedRole]

    return scoredVenues.map((candidate): WaypointSupportRoleCandidateEvidenceRow => {
      const id = candidateId(candidate)
      const rolePoolPosition = poolPositionByCandidateId.get(id)
      const rolePoolEntered = typeof rolePoolPosition === 'number'
      const strongestCandidateForRole =
        candidate.venue.source.sourceOrigin === 'live'
          ? competition?.strongestLive?.venueId === candidate.venue.id
          : competition?.strongestCurated?.venueId === candidate.venue.id

      return {
        protocolVersion: 'candidate-evidence.v1',
        producer: 'Waypoint',
        evidenceKind: 'support_role_competition',
        identity: {
          candidateId: id,
          baseVenueId: candidate.candidateIdentity.baseVenueId,
          venueId: candidate.venue.id,
          traceLabel: candidate.candidateIdentity.traceLabel,
        },
        provenance: {
          sourceOrigin: candidate.venue.source.sourceOrigin,
          provider: candidate.venue.source.provider,
          providerRecordId: candidate.venue.source.providerRecordId,
          sourceQueryLabel: candidate.venue.source.sourceQueryLabel,
        },
        requestedRole,
        internalRole,
        observations: {
          scoredCandidatePresence: available('scored_candidate_presence', true),
          rolePoolMembership: available('role_pool_membership', rolePoolEntered),
          rolePoolPosition: rolePoolEntered
            ? available('role_pool_position', rolePoolPosition)
            : unavailable('role_pool_position', 'not_applicable'),
          arcAssemblyPresence: available('arc_assembly_presence', arcAssemblyCandidateIds.has(id)),
          selectedRoutePresence: available('selected_route_presence', selectedCandidateId === id),
          strongestCandidateForRole: typeof competition === 'object'
            ? available('strongest_candidate_for_role', strongestCandidateForRole)
            : unavailable('strongest_candidate_for_role', 'not_observed'),
          competitionOutcome: competition
            ? available('competition_outcome', competition.outcome)
            : unavailable('competition_outcome', 'not_observed'),
          lostAtStage: liveCompetitionLostAtStageObservation({
            candidate,
            strongestCandidateForRole,
            competition,
          }),
        },
      }
    })
  })
}
