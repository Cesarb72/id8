/**
 * ARC BOUNDARY: Bearings candidate buildability and supply-envelope checks.
 *
 * Owns:
 * - role-by-role candidate sufficiency for a selected direction identity
 * - thin/sufficient buildability status used by downstream coordination validators
 *
 * Does NOT own:
 * - semantic identity inference policy
 * - route coordination or swap structure
 * - product-facing narration
 */
import { matchesDirectionIdentitySignal } from '../interpretation/direction/directionIdentity'
import type { DirectionIdentity } from '../types/intent'
import type { ScoredVenue } from '../types/arc'
import type { UserStopRole } from '../types/itinerary'

export type DirectionCoreRole = Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>

export interface DirectionContractBuildability {
  expectedDirectionIdentity: DirectionIdentity
  contractBuildabilityStatus: 'sufficient' | 'thin'
  missingRoleForContract: DirectionCoreRole | null
  candidatePoolSufficiencyByRole: Record<DirectionCoreRole, number>
}

function hasSourceBackedIdentity(scoredVenue: ScoredVenue | undefined): boolean {
  if (!scoredVenue) {
    return false
  }
  const source = scoredVenue.venue.source
  const providerRecordId = source.providerRecordId?.trim()
  return Boolean(
    providerRecordId ||
      source.sourceOrigin === 'live' ||
      scoredVenue.candidateIdentity.parentPlaceId ||
      scoredVenue.candidateIdentity.baseVenueId,
  )
}

function hasNavigableVenueLocation(scoredVenue: ScoredVenue | undefined): boolean {
  if (!scoredVenue) {
    return false
  }
  const source = scoredVenue.venue.source
  const hasProviderRecord = Boolean(source.providerRecordId?.trim())
  const hasCoordinates =
    typeof source.latitude === 'number' && typeof source.longitude === 'number'
  const hasAreaContext = Boolean(
    scoredVenue.venue.city.trim() && scoredVenue.venue.neighborhood.trim(),
  )
  return hasProviderRecord || hasCoordinates || hasAreaContext
}

export function assessDirectionContractBuildability(params: {
  expectedDirectionIdentity: DirectionIdentity
  scoredVenues: ScoredVenue[]
}): DirectionContractBuildability {
  const { expectedDirectionIdentity, scoredVenues } = params
  const roleScoreByCoreRole: Record<DirectionCoreRole, keyof ScoredVenue['roleScores']> = {
    start: 'warmup',
    highlight: 'peak',
    windDown: 'cooldown',
  }
  const candidatePoolSufficiencyByRole: Record<DirectionCoreRole, number> = {
    start: 0,
    highlight: 0,
    windDown: 0,
  }
  const identityCandidates = scoredVenues
    .filter((candidate) => hasSourceBackedIdentity(candidate))
    .filter((candidate) => hasNavigableVenueLocation(candidate))
    .filter((candidate) =>
      matchesDirectionIdentitySignal(candidate.venue, expectedDirectionIdentity),
    )
  ;(['start', 'highlight', 'windDown'] as DirectionCoreRole[]).forEach((role) => {
    const roleScoreKey = roleScoreByCoreRole[role]
    candidatePoolSufficiencyByRole[role] = identityCandidates.filter(
      (candidate) => candidate.roleScores[roleScoreKey] >= 0.44,
    ).length
  })
  const missingRoleForContract =
    (['start', 'highlight', 'windDown'] as DirectionCoreRole[]).find(
      (role) => candidatePoolSufficiencyByRole[role] === 0,
    ) ?? null
  return {
    expectedDirectionIdentity,
    contractBuildabilityStatus: missingRoleForContract ? 'thin' : 'sufficient',
    missingRoleForContract,
    candidatePoolSufficiencyByRole,
  }
}
