import {
  deriveConciergeEchoChips,
  getRenderableConciergeCards,
} from '../config/conciergeCardConfig'
import type { ConciergeCardInputDraft } from '../types/conciergeCardInput'
import type {
  ConciergeCardAnswerSummary,
  ConciergeCardConfig,
  ConciergeCardFlowState,
  ConciergeCardMode,
  ConciergeEchoProjection,
} from '../types/conciergeCardFlow'

export function selectCardEchoPreviewMode(params: {
  isBuildWrapperActive: boolean
  isCurateWrapperActive: boolean
}): ConciergeCardMode {
  if (params.isBuildWrapperActive) {
    return 'build'
  }
  if (params.isCurateWrapperActive) {
    return 'curate'
  }
  return 'surprise'
}

export interface CardEchoPreviewSelectorParams {
  mode: ConciergeCardMode
  isPublicSurface: boolean
  isModeWrapperActive: boolean
  isCurateWrapperActive: boolean
  isSurpriseWrapperActive: boolean
  publicPreviewFeatureEnabled: boolean
  publicCardPreviewQueryGateActive: boolean
  hasPlan: boolean
  hasFinalRoute: boolean
  hasRevealed: boolean
  renderSharedPlanPreview: boolean
  hasSelectedCandidateRouteArtifact: boolean
  cardFlowState: ConciergeCardFlowState
  cardPreviewDraft: ConciergeCardInputDraft
  hintLabel?: string | null
}

export interface CardEchoPreviewSelectorResult {
  renderableCards: readonly ConciergeCardConfig[]
  activeCard: ConciergeCardConfig | null
  echoProjection: ConciergeEchoProjection
  visibleEchoProjection: ConciergeEchoProjection
  activeCardSummary: ConciergeCardAnswerSummary | undefined
  showPublicCardPreview: boolean
  showCurateRouteSummaryPreview: boolean
  showSurpriseRouteSummaryPreview: boolean
  showCurateDefaultCardStack: boolean
  showSurpriseDefaultCardStack: boolean
  showPublicCardStack: boolean
}

export function selectCardEchoPreviewState(
  params: CardEchoPreviewSelectorParams,
): CardEchoPreviewSelectorResult {
  const renderableCards = getRenderableConciergeCards(params.mode)
  const activeCard =
    renderableCards.find((card) => card.id === params.cardFlowState.activeCardId) ??
    renderableCards[0] ??
    null
  const echoProjection = deriveConciergeEchoChips({
    mode: params.mode,
    draft: params.cardPreviewDraft,
    flowState: params.cardFlowState,
    hintLabel: params.hintLabel,
  })
  const visibleEchoProjection =
    params.mode === 'surprise'
      ? {
          chips: echoProjection.chips.filter((chip) => chip.state !== 'skipped'),
          summaryLabel: echoProjection.chips
            .filter((chip) => chip.state !== 'skipped')
            .map((chip) => chip.valueLabel)
            .join(' | '),
        }
      : echoProjection
  const activeCardSummary = activeCard
    ? getActiveCardSummary(visibleEchoProjection, activeCard.id)
    : undefined
  const showPublicCardPreview =
    params.isPublicSurface &&
    (params.publicPreviewFeatureEnabled || params.publicCardPreviewQueryGateActive) &&
    params.isModeWrapperActive &&
    !params.hasPlan &&
    !params.hasFinalRoute &&
    !params.hasRevealed
  const showCurateRouteSummaryPreview = Boolean(
    params.isCurateWrapperActive && params.renderSharedPlanPreview,
  )
  const showSurpriseRouteSummaryPreview = Boolean(
    params.isSurpriseWrapperActive && params.renderSharedPlanPreview,
  )
  const showCurateDefaultCardStack =
    params.isPublicSurface &&
    params.isCurateWrapperActive &&
    !params.hasPlan &&
    !params.hasFinalRoute &&
    !params.hasRevealed &&
    !showCurateRouteSummaryPreview
  const showSurpriseDefaultCardStack =
    params.isPublicSurface &&
    params.isSurpriseWrapperActive &&
    !params.hasPlan &&
    !params.hasFinalRoute &&
    !params.hasRevealed &&
    !params.hasSelectedCandidateRouteArtifact &&
    !showSurpriseRouteSummaryPreview
  const showPublicCardStack =
    (showPublicCardPreview || showCurateDefaultCardStack || showSurpriseDefaultCardStack) &&
    !showCurateRouteSummaryPreview &&
    !(
      params.isSurpriseWrapperActive &&
      (params.hasSelectedCandidateRouteArtifact || showSurpriseRouteSummaryPreview)
    )

  return {
    renderableCards,
    activeCard,
    echoProjection,
    visibleEchoProjection,
    activeCardSummary,
    showPublicCardPreview,
    showCurateRouteSummaryPreview,
    showSurpriseRouteSummaryPreview,
    showCurateDefaultCardStack,
    showSurpriseDefaultCardStack,
    showPublicCardStack,
  }
}

function getActiveCardSummary(
  projection: ConciergeEchoProjection,
  activeCardId: ConciergeCardConfig['id'],
): ConciergeCardAnswerSummary | undefined {
  const chip = projection.chips.find((entry) => entry.id === activeCardId)
  return chip ? { valueLabel: chip.valueLabel } : undefined
}
