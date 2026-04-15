import { getRolePoolForRole, computeRolePoolRankingBreakdown } from '../arc/buildRolePools'
import { roleProjection } from '../config/roleProjection'
import { computeRoleAwareHoursPressure } from '../retrieval/computeRoleAwareHoursPressure'
import { computeRoleAwareLiveLift } from '../retrieval/computeRoleAwareLiveLift'
import { explainLiveRoleLoss } from '../retrieval/explainLiveRoleLoss'
import { computeHybridLiveLift } from '../retrieval/computeHybridLiveLift'
import type { RolePools } from '../arc/buildRolePools'
import type {
  LiveRoleLeaderDiagnostics,
  RoleCompetitionCandidateDiagnostics,
  RoleCompetitionDiagnostics,
  ScoreDimensionDeltaDiagnostics,
} from '../types/diagnostics'
import type { ArcCandidate, ArcScoreBreakdown, ScoredVenue } from '../types/arc'
import type { ExperienceLens } from '../types/experienceLens'
import type { UserStopRole } from '../types/itinerary'
import type { InternalRole } from '../types/venue'

interface CompareStrongestCandidatesByRoleInput {
  scoredVenues: ScoredVenue[]
  rolePools: RolePools
  arcCandidates: ArcCandidate[]
  selectedArc: ArcCandidate
  lens: ExperienceLens
}

interface CompareStrongestCandidatesByRoleResult {
  strongestLiveByRole: Partial<Record<UserStopRole, LiveRoleLeaderDiagnostics>>
  strongestCuratedByRole: Partial<Record<UserStopRole, RoleCompetitionCandidateDiagnostics>>
  strongestLiveScoreByRole: Partial<Record<UserStopRole, number>>
  strongestCuratedScoreByRole: Partial<Record<UserStopRole, number>>
  strongestLiveLossReasonByRole: Partial<Record<UserStopRole, string>>
  strongestLiveLostAtStageByRole: Partial<Record<UserStopRole, RoleCompetitionDiagnostics['strongestLiveLostAtStage']>>
  strongestLiveVsCuratedDeltaByRole: Partial<Record<UserStopRole, ScoreDimensionDeltaDiagnostics[]>>
  roleCompetitionByRole: Partial<Record<UserStopRole, RoleCompetitionDiagnostics>>
  liveLostInFinalWinnerCount: number
}

function roundPct(value: number): number {
  return Number((value * 100).toFixed(1))
}

function validityRank(value?: 'valid' | 'fallback' | 'invalid'): number {
  if (value === 'valid') {
    return 2
  }
  if (value === 'fallback') {
    return 1
  }
  return 0
}

function tierRank(value?: 'highlight-capable' | 'support-only' | 'connective-only'): number {
  if (value === 'highlight-capable') {
    return 2
  }
  if (value === 'support-only') {
    return 1
  }
  return 0
}

function pickTopCandidate(
  candidates: ScoredVenue[],
  role: InternalRole,
  lens: ExperienceLens,
): ScoredVenue | undefined {
  return [...candidates].sort(
    (left, right) =>
      computeRolePoolRankingBreakdown(right, role, lens).score -
      computeRolePoolRankingBreakdown(left, role, lens).score,
  )[0]
}

function buildCandidateDiagnostics(
  candidate: ScoredVenue,
  role: InternalRole,
  lens: ExperienceLens,
): RoleCompetitionCandidateDiagnostics {
  const ranking = computeRolePoolRankingBreakdown(candidate, role, lens)
  const hours = computeRoleAwareHoursPressure(candidate.venue, role)
  const liveLift = computeHybridLiveLift(candidate.venue)
  const roleLift = computeRoleAwareLiveLift(candidate, role)
  return {
    venueId: candidate.venue.id,
    venueName: candidate.venue.name,
    sourceOrigin: candidate.venue.source.sourceOrigin,
    qualityGateStatus: candidate.venue.source.qualityGateStatus,
    score: {
      poolRankingScore: roundPct(ranking.score),
      roleFit: roundPct(candidate.roleScores[role]),
      tasteBonus: roundPct(ranking.tasteContribution),
      tasteRoleSuitabilityContribution: roundPct(
        ranking.tasteRoleSuitabilityContribution,
      ),
      highlightPlausibilityBonus:
        role === 'peak'
          ? roundPct(ranking.highlightPlausibilityContribution)
          : undefined,
      overallFit: roundPct(candidate.fitScore),
      lensCompatibility: roundPct(candidate.lensCompatibility),
      stopShapeFit: roundPct(
        role === 'warmup'
          ? candidate.stopShapeFit.start
          : role === 'peak'
            ? candidate.stopShapeFit.highlight
            : role === 'wildcard'
              ? candidate.stopShapeFit.surprise
              : candidate.stopShapeFit.windDown,
      ),
      vibeAuthority: roundPct(
        role === 'warmup'
          ? candidate.vibeAuthority.byRole.start
          : role === 'peak'
            ? candidate.vibeAuthority.byRole.highlight
            : role === 'wildcard'
              ? candidate.vibeAuthority.byRole.surprise
              : candidate.vibeAuthority.byRole.windDown,
      ),
      contextSpecificity: roundPct(candidate.contextSpecificity.byRole[role]),
      dominancePenalty: roundPct(candidate.dominanceControl.byRole[role]),
      contractScore: roundPct(candidate.roleContract[role].score),
      highlightValidityLevel: role === 'peak' ? candidate.highlightValidity.validityLevel : undefined,
      highlightCandidateTier: role === 'peak' ? candidate.highlightValidity.candidateTier : undefined,
      highlightValidityBoost:
        role === 'peak'
          ? candidate.highlightValidity.validityLevel === 'valid'
            ? 34
            : candidate.highlightValidity.validityLevel === 'fallback'
              ? 9
              : -50
          : undefined,
      rolePoolLift: roundPct(liveLift.rolePoolLift),
      liveRoleLift: roundPct(liveLift.roleLiftByRole[role]),
      liveRolePromotion: roundPct(roleLift.promotion),
      hoursPenalty: roundPct(hours.penalty),
      hoursAdjusted: hours.adjusted,
      sourceConfidence: roundPct(candidate.venue.source.sourceConfidence),
      completenessScore: roundPct(candidate.venue.source.completenessScore),
      qualityScore: roundPct(candidate.venue.source.qualityScore),
      timeConfidence: roundPct(candidate.venue.source.timeConfidence),
      likelyOpenForCurrentWindow: candidate.venue.source.likelyOpenForCurrentWindow,
      hoursKnown: candidate.venue.source.hoursKnown,
      signatureScore: roundPct(candidate.venue.signature.signatureScore),
      genericScore: roundPct(candidate.venue.signature.genericScore),
      qualityGateStatus: candidate.venue.source.qualityGateStatus,
    },
  }
}

function buildNumericDelta(
  key: string,
  label: string,
  liveValue: number,
  curatedValue: number,
  preferHigher: boolean,
  curatedExplanation: string,
  liveExplanation: string,
): ScoreDimensionDeltaDiagnostics {
  const favored =
    liveValue === curatedValue
      ? 'tie'
      : preferHigher
        ? liveValue > curatedValue
          ? 'live'
          : 'curated'
        : liveValue < curatedValue
          ? 'live'
          : 'curated'
  return {
    key,
    label,
    liveValue,
    curatedValue,
    delta: Number((liveValue - curatedValue).toFixed(1)),
    favored,
    explanation:
      favored === 'curated'
        ? curatedExplanation
        : favored === 'live'
          ? liveExplanation
          : `${label} was effectively tied.`,
  }
}

function buildBooleanDelta(
  key: string,
  label: string,
  liveValue: boolean,
  curatedValue: boolean,
  curatedExplanation: string,
  liveExplanation: string,
): ScoreDimensionDeltaDiagnostics {
  const favored = liveValue === curatedValue ? 'tie' : liveValue ? 'live' : 'curated'
  return {
    key,
    label,
    liveValue,
    curatedValue,
    delta: null,
    favored,
    explanation:
      favored === 'curated'
        ? curatedExplanation
        : favored === 'live'
          ? liveExplanation
          : `${label} matched on both sources.`,
  }
}

function buildRoleDeltas(
  live: RoleCompetitionCandidateDiagnostics,
  curated: RoleCompetitionCandidateDiagnostics,
  role: InternalRole,
): ScoreDimensionDeltaDiagnostics[] {
  const deltas: ScoreDimensionDeltaDiagnostics[] = [
    buildNumericDelta(
      'pool-ranking-score',
      'Role-pool score',
      live.score.poolRankingScore,
      curated.score.poolRankingScore,
      true,
      'Curated candidate carried the stronger overall role-pool stack.',
      'Live candidate carried the stronger overall role-pool stack.',
    ),
    buildNumericDelta(
      'role-fit',
      'Role fit',
      live.score.roleFit,
      curated.score.roleFit,
      true,
      'Curated candidate matched the requested stop role more cleanly.',
      'Live candidate matched the requested stop role more cleanly.',
    ),
    buildNumericDelta(
      'taste-bonus',
      'Taste bonus',
      live.score.tasteBonus,
      curated.score.tasteBonus,
      true,
      'Curated candidate received the stronger Taste bonus in role-pool ranking.',
      'Live candidate received the stronger Taste bonus in role-pool ranking.',
    ),
    buildNumericDelta(
      'taste-role-suitability',
      'Taste role suitability',
      live.score.tasteRoleSuitabilityContribution,
      curated.score.tasteRoleSuitabilityContribution,
      true,
      'Curated candidate had the stronger Taste role-suitability support.',
      'Live candidate had the stronger Taste role-suitability support.',
    ),
    buildNumericDelta(
      'overall-fit',
      'Overall fit',
      live.score.overallFit,
      curated.score.overallFit,
      true,
      'Curated candidate held the stronger blended fit score.',
      'Live candidate held the stronger blended fit score.',
    ),
    buildNumericDelta(
      'lens-compatibility',
      'Lens compatibility',
      live.score.lensCompatibility,
      curated.score.lensCompatibility,
      true,
      'Curated candidate aligned better with the current outing lens.',
      'Live candidate aligned better with the current outing lens.',
    ),
    buildNumericDelta(
      'stop-shape-fit',
      'Stop shape fit',
      live.score.stopShapeFit,
      curated.score.stopShapeFit,
      true,
      'Curated candidate fit the stage shape more directly.',
      'Live candidate fit the stage shape more directly.',
    ),
    buildNumericDelta(
      'vibe-authority',
      'Vibe authority',
      live.score.vibeAuthority,
      curated.score.vibeAuthority,
      true,
      'Curated candidate had stronger vibe authority for this role.',
      'Live candidate had stronger vibe authority for this role.',
    ),
    buildNumericDelta(
      'context-specificity',
      'Context specificity',
      live.score.contextSpecificity,
      curated.score.contextSpecificity,
      true,
      'Curated candidate read as more specific to the request.',
      'Live candidate read as more specific to the request.',
    ),
    buildNumericDelta(
      'dominance-penalty',
      'Dominance penalty',
      live.score.dominancePenalty,
      curated.score.dominancePenalty,
      false,
      'Curated candidate took the lighter generic-winner penalty.',
      'Live candidate took the lighter generic-winner penalty.',
    ),
    buildNumericDelta(
      'hours-penalty',
      'Hours penalty',
      live.score.hoursPenalty,
      curated.score.hoursPenalty,
      false,
      'Curated candidate carried less time-window friction.',
      'Live candidate carried less time-window friction.',
    ),
    buildNumericDelta(
      'time-confidence',
      'Time confidence',
      live.score.timeConfidence,
      curated.score.timeConfidence,
      true,
      'Curated candidate had the stronger hours/time confidence.',
      'Live candidate had the stronger hours/time confidence.',
    ),
    buildNumericDelta(
      'source-confidence',
      'Source confidence',
      live.score.sourceConfidence,
      curated.score.sourceConfidence,
      true,
      'Curated candidate had the stronger source confidence.',
      'Live candidate had the stronger source confidence.',
    ),
    buildNumericDelta(
      'completeness',
      'Completeness',
      live.score.completenessScore,
      curated.score.completenessScore,
      true,
      'Curated candidate had the more complete record.',
      'Live candidate had the more complete record.',
    ),
    buildNumericDelta(
      'quality-score',
      'Quality score',
      live.score.qualityScore,
      curated.score.qualityScore,
      true,
      'Curated candidate held the stronger quality-gate score.',
      'Live candidate held the stronger quality-gate score.',
    ),
    buildNumericDelta(
      'signature-score',
      'Signature score',
      live.score.signatureScore,
      curated.score.signatureScore,
      true,
      'Curated candidate read as more signature and less interchangeable.',
      'Live candidate read as more signature and less interchangeable.',
    ),
    buildNumericDelta(
      'generic-score',
      'Generic score',
      live.score.genericScore,
      curated.score.genericScore,
      false,
      'Curated candidate read as less generic.',
      'Live candidate read as less generic.',
    ),
    buildBooleanDelta(
      'likely-open',
      'Likely open now',
      live.score.likelyOpenForCurrentWindow,
      curated.score.likelyOpenForCurrentWindow,
      'Curated candidate had the safer open-now read.',
      'Live candidate had the safer open-now read.',
    ),
  ]

  if (role === 'peak') {
    deltas.push(
      buildNumericDelta(
        'highlight-validity',
        'Highlight validity',
        validityRank(live.score.highlightValidityLevel),
        validityRank(curated.score.highlightValidityLevel),
        true,
        'Curated candidate had the stronger highlight validity level.',
        'Live candidate had the stronger highlight validity level.',
      ),
      buildNumericDelta(
        'highlight-capability',
        'Highlight capability',
        tierRank(live.score.highlightCandidateTier),
        tierRank(curated.score.highlightCandidateTier),
        true,
        'Curated candidate had the stronger centerpiece capability.',
        'Live candidate had the stronger centerpiece capability.',
      ),
      buildNumericDelta(
        'highlight-plausibility-bonus',
        'Highlight plausibility bonus',
        live.score.highlightPlausibilityBonus ?? 0,
        curated.score.highlightPlausibilityBonus ?? 0,
        true,
        'Curated candidate received the stronger Taste highlight plausibility bonus.',
        'Live candidate received the stronger Taste highlight plausibility bonus.',
      ),
    )
  }

  return deltas.sort((left, right) => {
    const leftPriority = left.favored === 'curated' ? 0 : left.favored === 'tie' ? 2 : 1
    const rightPriority = right.favored === 'curated' ? 0 : right.favored === 'tie' ? 2 : 1
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority
    }
    return Math.abs(right.delta ?? 0) - Math.abs(left.delta ?? 0)
  })
}

function buildArcScoreDelta(
  bestLiveArc: ArcCandidate | undefined,
  selectedArc: ArcCandidate,
): ScoreDimensionDeltaDiagnostics[] {
  if (!bestLiveArc) {
    return []
  }

  const toValue = (breakdown: ArcScoreBreakdown, key: keyof ArcScoreBreakdown): number =>
    Number((((breakdown[key] ?? 0) as number) * 100).toFixed(1))

  const metrics: Array<{
    key: keyof ArcScoreBreakdown | 'totalScore'
    label: string
    preferHigher: boolean
    curatedExplanation: string
    liveExplanation: string
  }> = [
    {
      key: 'totalScore',
      label: 'Arc total score',
      preferHigher: true,
      curatedExplanation: 'Curated winner held the stronger total arc score.',
      liveExplanation: 'Best live arc held the stronger total arc score.',
    },
    {
      key: 'roleFlowScore',
      label: 'Role flow',
      preferHigher: true,
      curatedExplanation: 'Curated winner had cleaner role flow.',
      liveExplanation: 'Best live arc had cleaner role flow.',
    },
    {
      key: 'geographyScore',
      label: 'Geography',
      preferHigher: true,
      curatedExplanation: 'Curated winner had tighter geography.',
      liveExplanation: 'Best live arc had tighter geography.',
    },
    {
      key: 'highlightValidityScore',
      label: 'Highlight validity',
      preferHigher: true,
      curatedExplanation: 'Curated winner had the safer highlight validity stack.',
      liveExplanation: 'Best live arc had the safer highlight validity stack.',
    },
    {
      key: 'highlightVibeScore',
      label: 'Highlight vibe',
      preferHigher: true,
      curatedExplanation: 'Curated winner had stronger highlight vibe.',
      liveExplanation: 'Best live arc had stronger highlight vibe.',
    },
    {
      key: 'supportStopVibeScore',
      label: 'Support-stop vibe',
      preferHigher: true,
      curatedExplanation: 'Curated winner had better support-stop reinforcement.',
      liveExplanation: 'Best live arc had better support-stop reinforcement.',
    },
    {
      key: 'transitionSmoothnessScore',
      label: 'Transition smoothness',
      preferHigher: true,
      curatedExplanation: 'Curated winner moved more smoothly between stops.',
      liveExplanation: 'Best live arc moved more smoothly between stops.',
    },
    {
      key: 'awkwardPacingPenalty',
      label: 'Awkward pacing penalty',
      preferHigher: false,
      curatedExplanation: 'Curated winner took the lighter pacing penalty.',
      liveExplanation: 'Best live arc took the lighter pacing penalty.',
    },
  ]

  return metrics
    .map((metric) => {
      const liveValue =
        metric.key === 'totalScore'
          ? Number((bestLiveArc.totalScore * 100).toFixed(1))
          : toValue(bestLiveArc.scoreBreakdown, metric.key)
      const curatedValue =
        metric.key === 'totalScore'
          ? Number((selectedArc.totalScore * 100).toFixed(1))
          : toValue(selectedArc.scoreBreakdown, metric.key)
      return buildNumericDelta(
        String(metric.key),
        metric.label,
        liveValue,
        curatedValue,
        metric.preferHigher,
        metric.curatedExplanation,
        metric.liveExplanation,
      )
    })
    .sort((left, right) => {
      const leftPriority = left.favored === 'curated' ? 0 : left.favored === 'tie' ? 2 : 1
      const rightPriority = right.favored === 'curated' ? 0 : right.favored === 'tie' ? 2 : 1
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority
      }
      return Math.abs(right.delta ?? 0) - Math.abs(left.delta ?? 0)
    })
}

export function compareStrongestCandidatesByRole({
  scoredVenues,
  rolePools,
  arcCandidates,
  selectedArc,
  lens,
}: CompareStrongestCandidatesByRoleInput): CompareStrongestCandidatesByRoleResult {
  const strongestLiveByRole: Partial<Record<UserStopRole, LiveRoleLeaderDiagnostics>> = {}
  const strongestCuratedByRole: Partial<Record<UserStopRole, RoleCompetitionCandidateDiagnostics>> = {}
  const strongestLiveScoreByRole: Partial<Record<UserStopRole, number>> = {}
  const strongestCuratedScoreByRole: Partial<Record<UserStopRole, number>> = {}
  const strongestLiveLossReasonByRole: Partial<Record<UserStopRole, string>> = {}
  const strongestLiveLostAtStageByRole: Partial<
    Record<UserStopRole, RoleCompetitionDiagnostics['strongestLiveLostAtStage']>
  > = {}
  const strongestLiveVsCuratedDeltaByRole: Partial<Record<UserStopRole, ScoreDimensionDeltaDiagnostics[]>> = {}
  const roleCompetitionByRole: Partial<Record<UserStopRole, RoleCompetitionDiagnostics>> = {}
  let liveLostInFinalWinnerCount = 0

  for (const role of ['warmup', 'peak', 'wildcard', 'cooldown'] as InternalRole[]) {
    const userRole = roleProjection[role]
    const rolePool = getRolePoolForRole(role, rolePools)
    const strongestLive = pickTopCandidate(
      scoredVenues.filter((item) => item.venue.source.sourceOrigin === 'live'),
      role,
      lens,
    )
    const strongestCurated = pickTopCandidate(
      scoredVenues.filter((item) => item.venue.source.sourceOrigin === 'curated'),
      role,
      lens,
    )
    const liveDiagnostics = strongestLive
      ? buildCandidateDiagnostics(strongestLive, role, lens)
      : undefined
    const curatedDiagnostics = strongestCurated
      ? buildCandidateDiagnostics(strongestCurated, role, lens)
      : undefined
    const explanation = explainLiveRoleLoss({
      role,
      strongestLive,
      rolePool,
      arcCandidates,
      selectedArc,
    })
    const liveEnteredRolePool = Boolean(
      strongestLive && rolePool.some((item) => item.venue.id === strongestLive.venue.id),
    )
    const curatedEnteredRolePool = Boolean(
      strongestCurated && rolePool.some((item) => item.venue.id === strongestCurated.venue.id),
    )
    const liveReachedArcAssembly = Boolean(
      strongestLive &&
        arcCandidates.some((candidate) =>
          candidate.stops.some(
            (stop) => stop.role === role && stop.scoredVenue.venue.id === strongestLive.venue.id,
          ),
        ),
    )
    const curatedReachedArcAssembly = Boolean(
      strongestCurated &&
        arcCandidates.some((candidate) =>
          candidate.stops.some(
            (stop) => stop.role === role && stop.scoredVenue.venue.id === strongestCurated.venue.id,
          ),
        ),
    )
    const selectedStop = selectedArc.stops.find((stop) => stop.role === role)
    const liveWonFinalRoute = Boolean(
      strongestLive && selectedStop?.scoredVenue.venue.id === strongestLive.venue.id,
    )
    const bestLiveArc = strongestLive
      ? [...arcCandidates]
          .filter((candidate) =>
            candidate.stops.some(
              (stop) => stop.role === role && stop.scoredVenue.venue.id === strongestLive.venue.id,
            ),
          )
          .sort((left, right) => right.totalScore - left.totalScore)[0]
      : undefined
    const strongestLiveVsCuratedDelta =
      liveDiagnostics && curatedDiagnostics
        ? buildRoleDeltas(liveDiagnostics, curatedDiagnostics, role).slice(0, 6)
        : []
    const arcScoreDelta = buildArcScoreDelta(bestLiveArc, selectedArc).slice(0, 5)

    if (liveDiagnostics) {
      strongestLiveByRole[userRole] = {
        venueId: liveDiagnostics.venueId,
        venueName: liveDiagnostics.venueName,
        roleScore: liveDiagnostics.score.poolRankingScore,
        qualityGateStatus: liveDiagnostics.qualityGateStatus,
        likelyOpenForCurrentWindow: liveDiagnostics.score.likelyOpenForCurrentWindow,
        timeConfidence: liveDiagnostics.score.timeConfidence,
      }
      strongestLiveScoreByRole[userRole] = liveDiagnostics.score.poolRankingScore
      strongestLiveLossReasonByRole[userRole] = explanation.reason
      strongestLiveLostAtStageByRole[userRole] = explanation.stage
    }
    if (curatedDiagnostics) {
      strongestCuratedByRole[userRole] = curatedDiagnostics
      strongestCuratedScoreByRole[userRole] = curatedDiagnostics.score.poolRankingScore
    }
    strongestLiveVsCuratedDeltaByRole[userRole] = strongestLiveVsCuratedDelta

    const outcome: RoleCompetitionDiagnostics['outcome'] = !strongestLive
      ? 'no-live-candidate'
      : !strongestCurated
        ? 'no-curated-candidate'
        : selectedStop?.scoredVenue.venue.source.sourceOrigin === 'live'
          ? 'live-won'
          : 'curated-won'

    if (explanation.stage === 'final-route-winner') {
      liveLostInFinalWinnerCount += 1
    }

    roleCompetitionByRole[userRole] = {
      role: userRole,
      strongestLive: liveDiagnostics,
      strongestCurated: curatedDiagnostics,
      strongestLiveScore: liveDiagnostics?.score.poolRankingScore,
      strongestCuratedScore: curatedDiagnostics?.score.poolRankingScore,
      strongestLiveLossReason: explanation.reason,
      strongestLiveLostAtStage: explanation.stage,
      strongestLiveVsCuratedDelta,
      arcScoreDelta,
      outcome,
      liveEnteredRolePool,
      curatedEnteredRolePool,
      liveReachedArcAssembly,
      curatedReachedArcAssembly,
      liveWonFinalRoute,
      winningVenueId: selectedStop?.scoredVenue.venue.id,
      bestLiveArcCandidateId: bestLiveArc?.id,
      bestLiveArcScore: bestLiveArc ? roundPct(bestLiveArc.totalScore) : undefined,
      selectedArcScore: roundPct(selectedArc.totalScore),
    }
  }

  return {
    strongestLiveByRole,
    strongestCuratedByRole,
    strongestLiveScoreByRole,
    strongestCuratedScoreByRole,
    strongestLiveLossReasonByRole,
    strongestLiveLostAtStageByRole,
    strongestLiveVsCuratedDeltaByRole,
    roleCompetitionByRole,
    liveLostInFinalWinnerCount,
  }
}
