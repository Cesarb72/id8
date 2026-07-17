export interface WaypointBuildProviderSourceRoleCounts {
  start: number
  highlight: number
  windDown: number
}

export type WaypointBuildProviderSourceBlockedReason =
  | 'provider_no_admissible_candidates'
  | 'provider_insufficient_role_diversity'

export interface WaypointBuildProviderSourceOpportunityOutcome {
  emitted: boolean
  blockedReason: WaypointBuildProviderSourceBlockedReason | null
  staticFallbackUsed: boolean
}

export function coordinateBuildProviderSourceOpportunityOutcome(input: {
  nearbyCandidateCount: number
  roleCandidateCounts: WaypointBuildProviderSourceRoleCounts
}): WaypointBuildProviderSourceOpportunityOutcome {
  if (input.nearbyCandidateCount === 0) {
    return {
      emitted: false,
      blockedReason: 'provider_no_admissible_candidates',
      staticFallbackUsed: true,
    }
  }

  if (
    input.roleCandidateCounts.start === 0 ||
    input.roleCandidateCounts.highlight === 0 ||
    input.roleCandidateCounts.windDown === 0
  ) {
    return {
      emitted: false,
      blockedReason: 'provider_insufficient_role_diversity',
      staticFallbackUsed: false,
    }
  }

  return {
    emitted: true,
    blockedReason: null,
    staticFallbackUsed: false,
  }
}
