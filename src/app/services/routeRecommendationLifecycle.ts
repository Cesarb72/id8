export type RouteRecommendationLifecyclePhase =
  | 'candidate_preview'
  | 'generation_input'
  | 'great_stop_failed'
  | 'generated_recommendation'
  | 'authority_valid_lockable'
  | 'runtime_route'

export interface BuildRouteRecommendationLifecycleInput {
  routeSummarySource?: string | null
  routeSummaryProvenance?: string | null
  renderedRouteSource?: string | null
  generatedContractEntryArtifactPresent?: boolean | null
  finalRoutePresent?: boolean | null
  runtimeRouteArtifactPresent?: boolean | null
  greatStopStatus?: 'PASS' | 'FAIL' | string | null
  greatStopFailureClassification?: string | null
  routeAuthorityStatus?: string | null
  lockInputAvailable?: boolean | null
  reviewEligible?: boolean | null
  lockEligible?: boolean | null
}

export interface RouteRecommendationLifecycleDiagnostics {
  phase: RouteRecommendationLifecyclePhase
  routeSummarySource: string | null
  routeSummaryProvenance: string | null
  renderedRouteSource: string | null
  generatedContractEntryArtifactPresent: boolean
  finalRoutePresent: boolean
  runtimeRouteArtifactPresent: boolean
  greatStopStatus: string | null
  greatStopFailureClassification: string | null
  routeAuthorityStatus: string | null
  lockInputAvailable: boolean
  reviewEligible: boolean
  lockEligible: boolean
  userFacingLabel: string
  reasons: string[]
}

export function isCandidateRouteLifecycleSurface(input: {
  routeSummarySource?: string | null
  routeSummaryProvenance?: string | null
}): boolean {
  return (
    input.routeSummarySource === 'candidate' ||
    input.routeSummaryProvenance === 'candidate_artifact'
  )
}

export function buildRouteRecommendationLifecycleDiagnostics(
  input: BuildRouteRecommendationLifecycleInput,
): RouteRecommendationLifecycleDiagnostics {
  const routeSummarySource = input.routeSummarySource ?? null
  const routeSummaryProvenance = input.routeSummaryProvenance ?? null
  const renderedRouteSource = input.renderedRouteSource ?? null
  const generatedContractEntryArtifactPresent = Boolean(
    input.generatedContractEntryArtifactPresent,
  )
  const finalRoutePresent = Boolean(input.finalRoutePresent)
  const runtimeRouteArtifactPresent = Boolean(input.runtimeRouteArtifactPresent)
  const greatStopStatus = input.greatStopStatus ?? null
  const greatStopFailureClassification =
    input.greatStopFailureClassification ?? null
  const routeAuthorityStatus = input.routeAuthorityStatus ?? null
  const lockInputAvailable = Boolean(input.lockInputAvailable)
  const greatStopPassed = greatStopStatus === 'PASS'
  const greatStopFailed = greatStopStatus === 'FAIL' || Boolean(greatStopFailureClassification)
  const candidateSurface = isCandidateRouteLifecycleSurface({
    routeSummarySource,
    routeSummaryProvenance,
  })
  const reasons: string[] = []
  let phase: RouteRecommendationLifecyclePhase
  let userFacingLabel: string
  let reviewEligible = Boolean(input.reviewEligible)
  let lockEligible = Boolean(input.lockEligible) && lockInputAvailable

  if (greatStopFailed) {
    phase = 'great_stop_failed'
    userFacingLabel = 'Great Stop failed - no recommendation yet'
    reviewEligible = false
    lockEligible = false
    reasons.push('great_stop_failed')
  } else if (runtimeRouteArtifactPresent && greatStopPassed) {
    phase = 'runtime_route'
    userFacingLabel = 'Runtime route'
  } else if (routeAuthorityStatus === 'valid' && lockInputAvailable && greatStopPassed) {
    phase = 'authority_valid_lockable'
    userFacingLabel = 'Reviewable route - ready to lock'
  } else if (candidateSurface) {
    phase = 'candidate_preview'
    userFacingLabel = 'Candidate preview - not a recommendation yet'
    reviewEligible = false
    lockEligible = false
    reasons.push('candidate_route_summary_not_generated_truth')
  } else if (
    greatStopPassed &&
    generatedContractEntryArtifactPresent &&
    finalRoutePresent
  ) {
    phase = 'generated_recommendation'
    userFacingLabel = 'Generated recommendation'
  } else {
    phase = 'generation_input'
    userFacingLabel = 'Generation input - not a recommendation yet'
    reviewEligible = false
    lockEligible = false
    if (!generatedContractEntryArtifactPresent) {
      reasons.push('generated_contract_entry_missing')
    }
    if (!finalRoutePresent) {
      reasons.push('final_route_missing')
    }
    if (!greatStopPassed) {
      reasons.push('great_stop_pass_required')
    }
  }

  if (!generatedContractEntryArtifactPresent && phase !== 'candidate_preview') {
    reasons.push('generated_contract_entry_missing')
  }
  if (!finalRoutePresent && phase !== 'candidate_preview') {
    reasons.push('final_route_missing')
  }
  if (!lockInputAvailable && phase === 'authority_valid_lockable') {
    reasons.push('lock_input_missing')
  }

  return {
    phase,
    routeSummarySource,
    routeSummaryProvenance,
    renderedRouteSource,
    generatedContractEntryArtifactPresent,
    finalRoutePresent,
    runtimeRouteArtifactPresent,
    greatStopStatus,
    greatStopFailureClassification,
    routeAuthorityStatus,
    lockInputAvailable,
    reviewEligible,
    lockEligible,
    userFacingLabel,
    reasons: [...new Set(reasons)],
  }
}
