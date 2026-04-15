import { computeHybridLiveLift } from './computeHybridLiveLift'
import { computeRoleAwareLiveLift } from './computeRoleAwareLiveLift'
import type { LiveCompetitionStage } from '../types/diagnostics'
import type { ArcCandidate, ScoredVenue } from '../types/arc'
import type { InternalRole } from '../types/venue'

interface ExplainLiveRoleLossInput {
  role: InternalRole
  strongestLive?: ScoredVenue
  rolePool: ScoredVenue[]
  arcCandidates: ArcCandidate[]
  selectedArc: ArcCandidate
}

export interface LiveRoleLossExplanation {
  stage: LiveCompetitionStage
  reason: string
}

const roleThresholds: Record<InternalRole, number> = {
  warmup: 0.56,
  peak: 0.63,
  wildcard: 0.57,
  cooldown: 0.6,
}

function lensRoleKey(role: InternalRole): 'start' | 'highlight' | 'surprise' | 'windDown' {
  if (role === 'warmup') {
    return 'start'
  }
  if (role === 'peak') {
    return 'highlight'
  }
  if (role === 'wildcard') {
    return 'surprise'
  }
  return 'windDown'
}

export function explainLiveRoleLoss({
  role,
  strongestLive,
  rolePool,
  arcCandidates,
  selectedArc,
}: ExplainLiveRoleLossInput): LiveRoleLossExplanation {
  if (!strongestLive) {
    return {
      stage: 'retrieval',
      reason: 'no live venue survived retrieval strongly enough for this role',
    }
  }

  const liveLift = computeHybridLiveLift(strongestLive.venue)
  const roleLift = computeRoleAwareLiveLift(strongestLive, role)
  const inRolePool = rolePool.some((item) => item.venue.id === strongestLive.venue.id)
  const appearsInArcAssembly = arcCandidates.some((candidate) =>
    candidate.stops.some(
      (stop) => stop.role === role && stop.scoredVenue.venue.id === strongestLive.venue.id,
    ),
  )
  const selectedForRole = selectedArc.stops.some(
    (stop) => stop.role === role && stop.scoredVenue.venue.id === strongestLive.venue.id,
  )

  if (selectedForRole) {
    return {
      stage: 'selected-winner',
      reason: 'live won this role in the selected plan',
    }
  }
  if (role === 'peak' && strongestLive.highlightValidity.validityLevel === 'invalid') {
    return {
      stage: 'highlight-validity',
      reason: 'rejected by highlight validity',
    }
  }
  if (strongestLive.roleScores[role] < roleThresholds[role]) {
    return {
      stage: 'role-pool',
      reason: 'weaker role fit than curated alternatives',
    }
  }
  if (strongestLive.stopShapeFit[lensRoleKey(role)] < 0.4) {
    return {
      stage: 'role-pool',
      reason: 'weaker role shape fit than curated alternatives',
    }
  }
  if (!strongestLive.venue.source.likelyOpenForCurrentWindow && strongestLive.venue.source.timeConfidence >= 0.65) {
    return {
      stage: 'role-pool',
      reason: 'lower hours confidence for this role',
    }
  }
  if (strongestLive.venue.source.sourceConfidence < 0.68) {
    return {
      stage: 'role-pool',
      reason: 'lower source confidence',
    }
  }
  if (strongestLive.venue.source.completenessScore < 0.55) {
    return {
      stage: 'role-pool',
      reason: 'lower completeness',
    }
  }
  if (strongestLive.highlightValidity.packLiteralRequirementSatisfied === false) {
    return {
      stage: 'highlight-validity',
      reason: 'failed pack literal requirement',
    }
  }
  if (!liveLift.liftApplied || !roleLift.qualifies) {
    return {
      stage: 'role-pool',
      reason: 'did not clear role-aware live promotion',
    }
  }
  if (!inRolePool) {
    return {
      stage: 'role-pool',
      reason: 'lost during role-pool ranking',
    }
  }
  if (!appearsInArcAssembly) {
    return {
      stage: 'arc-assembly',
      reason: 'rejected before arc assembly',
    }
  }
  return {
    stage: 'final-route-winner',
    reason: 'lost in final arc coherence',
  }
}
