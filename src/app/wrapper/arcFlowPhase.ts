export type ArcFlowMode = 'surprise' | 'curate' | 'build'

export type ArcFlowPhase =
  | 'mode_selected'
  | 'contract_selection'
  | 'contract_creation'
  | 'contract_preview'
  | 'route_refinement'
  | 'live_plan'

export interface ResolveArcFlowPhaseParams {
  mode: ArcFlowMode | null
  hasEntryReady: boolean
  hasContractSelection: boolean
  canEnterContractPreview: boolean
  hasCommittedRoute: boolean
  isLockingLivePlan: boolean
}

export function resolveArcFlowPhase(
  params: ResolveArcFlowPhaseParams,
): ArcFlowPhase | null {
  if (!params.mode) {
    return null
  }
  if (!params.hasEntryReady) {
    return 'mode_selected'
  }
  if (params.isLockingLivePlan) {
    return 'live_plan'
  }
  if (params.hasCommittedRoute) {
    return 'route_refinement'
  }
  if (params.mode === 'curate') {
    if (!params.hasContractSelection || !params.canEnterContractPreview) {
      return 'contract_selection'
    }
    return 'contract_preview'
  }
  if (params.mode === 'build') {
    if (!params.hasContractSelection || !params.canEnterContractPreview) {
      return 'contract_creation'
    }
    return 'contract_preview'
  }
  return params.canEnterContractPreview ? 'contract_preview' : 'mode_selected'
}
