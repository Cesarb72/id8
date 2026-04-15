import { roleProjection } from '../config/roleProjection'
import { buildLiveAttritionTrace, buildLiveNoveltyLossDiagnostics } from '../debug/buildLiveAttritionTrace'
import { compareStrongestCandidatesByRole } from '../debug/compareStrongestCandidatesByRole'
import { explainCuratedDominance } from '../debug/explainCuratedDominance'
import { computeHybridLiveLift } from './computeHybridLiveLift'
import { computeRoleAwareHoursPressure } from './computeRoleAwareHoursPressure'
import type { RetrieveVenuesResult } from './retrieveVenues'
import type { RolePools } from '../arc/buildRolePools'
import type {
  ArcCandidate,
  ScoredVenue,
} from '../types/arc'
import type {
  CuratedDominanceDiagnostics,
  LiveAttritionTraceDiagnostics,
  LiveNoveltyLossDiagnostics,
  LiveRoleLeaderDiagnostics,
  RoleCompetitionCandidateDiagnostics,
  RoleCompetitionDiagnostics,
  RolePoolCounts,
  ScoreDimensionDeltaDiagnostics,
} from '../types/diagnostics'
import type { ExperienceLens } from '../types/experienceLens'
import type { SourceMode } from '../types/sourceMode'
import type { UserStopRole } from '../types/itinerary'
import type { InternalRole } from '../types/venue'

interface ComputeLiveCompetitivenessInput {
  retrieval: RetrieveVenuesResult
  scoredVenues: ScoredVenue[]
  selectedArc: ArcCandidate
  arcCandidates: ArcCandidate[]
  rolePools: RolePools
  lens: ExperienceLens
  effectiveSourceMode: SourceMode
}

export interface LiveCompetitivenessDiagnostics {
  liveRetrievedCount: number
  hybridLiveCompetitiveCount: number
  liveHighlightCandidateCount: number
  liveCompetitivenessLiftApplied: number
  liveTimeConfidenceAdjustedCount: number
  liveTimeConfidencePenaltyByRole: RolePoolCounts
  liveRejectedByHighlightValidityCount: number
  liveRejectedByRolePoolCount: number
  liveLostInArcAssemblyCount: number
  liveLostInFinalWinnerCount: number
  liveRolePoolCounts: RolePoolCounts
  liveRoleWinCounts: RolePoolCounts
  strongestLiveByRole: Partial<Record<UserStopRole, LiveRoleLeaderDiagnostics>>
  strongestCuratedByRole: Partial<Record<UserStopRole, RoleCompetitionCandidateDiagnostics>>
  strongestLiveScoreByRole: Partial<Record<UserStopRole, number>>
  strongestCuratedScoreByRole: Partial<Record<UserStopRole, number>>
  strongestLiveLossReasonByRole: Partial<Record<UserStopRole, string>>
  strongestLiveLostAtStageByRole: Partial<Record<UserStopRole, RoleCompetitionDiagnostics['strongestLiveLostAtStage']>>
  strongestLiveVsCuratedDeltaByRole: Partial<Record<UserStopRole, ScoreDimensionDeltaDiagnostics[]>>
  roleCompetitionByRole: Partial<Record<UserStopRole, RoleCompetitionDiagnostics>>
  liveAttritionTrace: LiveAttritionTraceDiagnostics
  curatedDominance: CuratedDominanceDiagnostics
  dedupeNoveltyLoss: LiveNoveltyLossDiagnostics
  strongLiveCandidatesFilteredCount: number
  liveLostToCuratedReason: string[]
  sourceBalanceNotes: string[]
  curatedVsLiveWinnerNotes: string[]
}

function formatRole(role: UserStopRole): string {
  if (role === 'windDown') {
    return 'Wind Down'
  }
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function getRoleKeyCounts(
  liveScored: ScoredVenue[],
  role: InternalRole,
): number {
  return liveScored.filter((item) => computeRoleAwareHoursPressure(item.venue, role).penalty > 0).length
}

export function computeLiveCompetitiveness({
  retrieval,
  scoredVenues,
  selectedArc,
  arcCandidates,
  rolePools,
  lens,
  effectiveSourceMode,
}: ComputeLiveCompetitivenessInput): LiveCompetitivenessDiagnostics {
  const roleKeys: InternalRole[] = ['warmup', 'peak', 'wildcard', 'cooldown']
  const liveScored = scoredVenues.filter((item) => item.venue.source.sourceOrigin === 'live')
  const liveLiftApplied = liveScored.filter((item) => computeHybridLiveLift(item.venue).liftApplied)
  const strongLiveCandidates = liveScored.filter((item) => {
    const liveLift = computeHybridLiveLift(item.venue)
    return (
      (liveLift.strongLiveCandidate || item.fitScore >= 0.67) &&
      item.venue.source.qualityGateStatus !== 'suppressed' &&
      item.venue.source.timeConfidence >= 0.48
    )
  })
  const liveCompetitive = strongLiveCandidates.filter(
    (item) => item.fitScore >= 0.64 || computeHybridLiveLift(item.venue).liftApplied,
  )
  const liveHighlightCandidates = liveScored.filter((item) => {
    const liveLift = computeHybridLiveLift(item.venue)
    return (
      (liveLift.strongHighlightCandidate || item.roleScores.peak >= 0.69) &&
      item.highlightValidity.validityLevel !== 'invalid' &&
      (item.venue.source.likelyOpenForCurrentWindow || item.venue.source.timeConfidence < 0.55)
    )
  })
  const rolePoolVenueIds = new Set(
    [...rolePools.warmup, ...rolePools.peak, ...rolePools.wildcard, ...rolePools.cooldown].map(
      (item) => item.venue.id,
    ),
  )
  const liveRejectedByHighlightValidityCount = liveScored.filter(
    (item) =>
      item.roleScores.peak >= 0.58 && item.highlightValidity.validityLevel === 'invalid',
  ).length
  const liveRejectedByRolePoolCount = liveScored.filter(
    (item) => !rolePoolVenueIds.has(item.venue.id),
  ).length
  const strongLiveCandidatesFilteredCount = strongLiveCandidates.filter(
    (item) => !rolePoolVenueIds.has(item.venue.id),
  ).length
  const liveTimeConfidenceAdjustedCount = liveScored.filter((item) =>
    roleKeys.some((role) => computeRoleAwareHoursPressure(item.venue, role).adjusted),
  ).length
  const liveTimeConfidencePenaltyByRole: RolePoolCounts = {
    start: getRoleKeyCounts(liveScored, 'warmup'),
    highlight: getRoleKeyCounts(liveScored, 'peak'),
    surprise: getRoleKeyCounts(liveScored, 'wildcard'),
    windDown: getRoleKeyCounts(liveScored, 'cooldown'),
  }
  const liveRolePoolCounts: RolePoolCounts = {
    start: rolePools.warmup.filter((item) => item.venue.source.sourceOrigin === 'live').length,
    highlight: rolePools.peak.filter((item) => item.venue.source.sourceOrigin === 'live').length,
    surprise: rolePools.wildcard.filter((item) => item.venue.source.sourceOrigin === 'live').length,
    windDown: rolePools.cooldown.filter((item) => item.venue.source.sourceOrigin === 'live').length,
  }
  const liveRoleWinCounts: RolePoolCounts = {
    start: 0,
    highlight: 0,
    surprise: 0,
    windDown: 0,
  }
  for (const stop of selectedArc.stops) {
    if (stop.scoredVenue.venue.source.sourceOrigin !== 'live') {
      continue
    }
    liveRoleWinCounts[roleProjection[stop.role]] += 1
  }

  const roleComparison = compareStrongestCandidatesByRole({
    scoredVenues,
    rolePools,
    arcCandidates,
    selectedArc,
    lens,
  })
  const dedupeNoveltyLoss = buildLiveNoveltyLossDiagnostics(retrieval)
  const selectedStopSources = Object.fromEntries(
    selectedArc.stops.map((stop) => [roleProjection[stop.role], stop.scoredVenue.venue.source.sourceOrigin]),
  ) as Partial<Record<UserStopRole, 'curated' | 'live'>>
  const liveAttritionTrace = buildLiveAttritionTrace({
    retrieval,
    scoredVenues,
    rolePools,
    arcCandidates,
    selectedArc,
    roleCompetitionByRole: roleComparison.roleCompetitionByRole,
  })
  const curatedDominance = explainCuratedDominance({
    attritionTrace: liveAttritionTrace,
    dedupeNoveltyLoss,
    roleCompetitionByRole: roleComparison.roleCompetitionByRole,
    selectedStopSources,
  })

  const liveLostToCuratedReason = new Set<string>()
  const curatedVsLiveWinnerNotes: string[] = []
  for (const [role, comparison] of Object.entries(roleComparison.roleCompetitionByRole) as Array<
    [UserStopRole, RoleCompetitionDiagnostics | undefined]
  >) {
    if (!comparison) {
      continue
    }
    if (comparison.outcome === 'live-won') {
      const winnerName = selectedArc.stops.find((stop) => roleProjection[stop.role] === role)?.scoredVenue.venue.name
      curatedVsLiveWinnerNotes.push(`${formatRole(role)} was won by live data (${winnerName ?? 'unknown'}).`)
      continue
    }
    if (comparison.outcome !== 'curated-won' || !comparison.strongestLive) {
      continue
    }
    liveLostToCuratedReason.add(comparison.strongestLiveLossReason ?? 'curated won the role comparison')
    const topDrivers = comparison.strongestLiveVsCuratedDelta
      .filter((delta) => delta.favored === 'curated')
      .slice(0, 2)
      .map((delta) => delta.label.toLowerCase())
    curatedVsLiveWinnerNotes.push(
      `${formatRole(role)} stayed curated over live challenger ${comparison.strongestLive.venueName}; lost at ${comparison.strongestLiveLostAtStage ?? 'unknown'}${topDrivers.length > 0 ? ` on ${topDrivers.join(' + ')}` : ''}.`,
    )
  }

  const selectedLiveStops = selectedArc.stops.filter(
    (stop) => stop.scoredVenue.venue.source.sourceOrigin === 'live',
  ).length
  const sourceBalanceNotes: string[] = []
  if (effectiveSourceMode === 'hybrid') {
    if (selectedLiveStops > 0) {
      sourceBalanceNotes.push(`Hybrid winner uses ${selectedLiveStops} live stop${selectedLiveStops === 1 ? '' : 's'}.`)
    } else {
      sourceBalanceNotes.push('Hybrid winner stayed fully curated.')
    }
    if (liveCompetitive.length > 0 && selectedLiveStops === 0) {
      sourceBalanceNotes.push('Live challengers are competitive, but curated still won the final role decisions.')
    }
    if (strongLiveCandidatesFilteredCount > 0) {
      sourceBalanceNotes.push(
        `${strongLiveCandidatesFilteredCount} strong live candidate${strongLiveCandidatesFilteredCount === 1 ? '' : 's'} fell out before final role-pool competition.`,
      )
    }
  }
  for (const line of curatedDominance.sourceBalanceSummary) {
    sourceBalanceNotes.push(line)
  }

  return {
    liveRetrievedCount: liveScored.length,
    hybridLiveCompetitiveCount: liveCompetitive.length,
    liveHighlightCandidateCount: liveHighlightCandidates.length,
    liveCompetitivenessLiftApplied: liveLiftApplied.length,
    liveTimeConfidenceAdjustedCount,
    liveTimeConfidencePenaltyByRole,
    liveRejectedByHighlightValidityCount,
    liveRejectedByRolePoolCount,
    liveLostInArcAssemblyCount: liveAttritionTrace.liveLostInArcAssemblyCount,
    liveLostInFinalWinnerCount: roleComparison.liveLostInFinalWinnerCount,
    liveRolePoolCounts,
    liveRoleWinCounts,
    strongestLiveByRole: roleComparison.strongestLiveByRole,
    strongestCuratedByRole: roleComparison.strongestCuratedByRole,
    strongestLiveScoreByRole: roleComparison.strongestLiveScoreByRole,
    strongestCuratedScoreByRole: roleComparison.strongestCuratedScoreByRole,
    strongestLiveLossReasonByRole: roleComparison.strongestLiveLossReasonByRole,
    strongestLiveLostAtStageByRole: roleComparison.strongestLiveLostAtStageByRole,
    strongestLiveVsCuratedDeltaByRole: roleComparison.strongestLiveVsCuratedDeltaByRole,
    roleCompetitionByRole: roleComparison.roleCompetitionByRole,
    liveAttritionTrace,
    curatedDominance,
    dedupeNoveltyLoss,
    strongLiveCandidatesFilteredCount,
    liveLostToCuratedReason: [...liveLostToCuratedReason],
    sourceBalanceNotes,
    curatedVsLiveWinnerNotes,
  }
}
