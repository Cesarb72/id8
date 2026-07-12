export type ArcRolePoolRole = 'warmup' | 'peak' | 'wildcard' | 'cooldown'

export interface CoordinateArcRolePoolOrderingInput<TCandidate> {
  candidates: readonly TCandidate[]
  preferredCandidate?: TCandidate
  includePreferredCandidate: boolean
  getCandidateId: (candidate: TCandidate) => string
  getSelectionScore: (candidate: TCandidate) => number
  getTieBreakScore: (candidate: TCandidate) => number
  projectPreferredCandidate?: (candidate: TCandidate) => TCandidate
}

export interface CoordinateArcRolePoolOrderingResult<TCandidate> {
  ranked: TCandidate[]
  rankedWithPreference: TCandidate[]
}

export interface ArcRolePoolSelection<TCandidate, TStatus> {
  candidates: readonly TCandidate[]
  status: TStatus
}

export interface ProjectArcRolePoolsInput<TCandidate, TStatus> {
  warmup: ArcRolePoolSelection<TCandidate, TStatus>
  peak: ArcRolePoolSelection<TCandidate, TStatus>
  wildcard: ArcRolePoolSelection<TCandidate, TStatus>
  cooldown: ArcRolePoolSelection<TCandidate, TStatus>
}

export interface ArcRolePoolsProjection<TCandidate, TStatus> {
  warmup: readonly TCandidate[]
  peak: readonly TCandidate[]
  wildcard: readonly TCandidate[]
  cooldown: readonly TCandidate[]
  contractPoolStatus: Record<ArcRolePoolRole, TStatus>
}

export function getArcRolePoolCandidateLimit(
  _role: ArcRolePoolRole,
  cooldownBoosted: boolean,
): number {
  return cooldownBoosted ? 16 : 14
}

export function coordinateArcRolePoolOrdering<TCandidate>(
  input: CoordinateArcRolePoolOrderingInput<TCandidate>,
): CoordinateArcRolePoolOrderingResult<TCandidate> {
  const ranked = [...input.candidates].sort((left, right) => {
    return (
      input.getSelectionScore(right) - input.getSelectionScore(left) ||
      input.getTieBreakScore(right) - input.getTieBreakScore(left)
    )
  })

  const rankedWithPreference =
    input.includePreferredCandidate && input.preferredCandidate
      ? [
          input.projectPreferredCandidate
            ? input.projectPreferredCandidate(input.preferredCandidate)
            : input.preferredCandidate,
          ...ranked.filter(
            (candidate) =>
              input.getCandidateId(candidate) !==
              input.getCandidateId(input.preferredCandidate!),
          ),
        ]
      : ranked

  return {
    ranked,
    rankedWithPreference,
  }
}

export function limitArcRolePoolCandidates<TCandidate>(
  candidates: readonly TCandidate[],
  limit: number,
): TCandidate[] {
  return candidates.slice(0, limit)
}

export function projectArcRolePools<TCandidate, TStatus>(
  input: ProjectArcRolePoolsInput<TCandidate, TStatus>,
): ArcRolePoolsProjection<TCandidate, TStatus> {
  return {
    warmup: input.warmup.candidates,
    peak: input.peak.candidates,
    wildcard: input.wildcard.candidates,
    cooldown: input.cooldown.candidates,
    contractPoolStatus: {
      warmup: input.warmup.status,
      peak: input.peak.status,
      wildcard: input.wildcard.status,
      cooldown: input.cooldown.status,
    },
  }
}
