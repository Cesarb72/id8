import type { ConciergeCardInputDraft } from '../types/conciergeCardInput'
import type {
  ConciergeCardConfig,
  ConciergeCardFlowState,
  ConciergeCardId,
  ConciergeCardMode,
  ConciergeCardStatus,
  ConciergeCardStatusById,
  ConciergeEchoChip,
  ConciergeEchoChipState,
  ConciergeEchoProjection,
} from '../types/conciergeCardFlow'

const CARD_LABEL_BY_ID: Record<ConciergeCardId, string> = {
  who: 'Who',
  vibe: 'Vibe',
  when: 'When',
  occasion: 'Occasion',
  hint: 'Hint',
}

export const CONCIERGE_CARD_SEQUENCE_BY_MODE = {
  surprise: [
    {
      id: 'who',
      requirement: 'required',
      title: 'Who is going?',
      prompt: 'Choose the group this route should fit.',
      ctaLabel: 'Next',
    },
    {
      id: 'vibe',
      requirement: 'required',
      title: 'What should it feel like?',
      prompt: 'Pick the tone for the night.',
      ctaLabel: 'Show routes',
    },
    {
      id: 'when',
      requirement: 'skipped',
      title: 'When are you going?',
      prompt: 'Surprise defaults timing until engine wiring is enabled.',
      ctaLabel: 'Skip',
    },
    {
      id: 'occasion',
      requirement: 'skipped',
      title: 'What is the occasion?',
      prompt: 'Surprise defaults occasion until engine wiring is enabled.',
      ctaLabel: 'Skip',
    },
    {
      id: 'hint',
      requirement: 'skipped',
      title: 'Any hint?',
      prompt: 'Surprise starts without an anchor hint.',
      ctaLabel: 'Skip',
    },
  ],
  curate: [
    {
      id: 'who',
      requirement: 'required',
      title: 'Who is going?',
      prompt: 'Choose the group this route should fit.',
      ctaLabel: 'Next',
    },
    {
      id: 'vibe',
      requirement: 'required',
      title: 'What should it feel like?',
      prompt: 'Pick the tone for the night.',
      ctaLabel: 'Next',
    },
    {
      id: 'when',
      requirement: 'required',
      title: 'When should it happen?',
      prompt: 'Set the time, duration, and movement range.',
      ctaLabel: 'Next',
    },
    {
      id: 'occasion',
      requirement: 'required',
      title: 'What is the occasion?',
      prompt: 'Choose the purpose this night should serve.',
      ctaLabel: 'Next',
    },
    {
      id: 'hint',
      requirement: 'optional',
      title: 'Any extra hint?',
      prompt: 'Add a preference or leave it open.',
      ctaLabel: 'Continue',
      skipLabel: 'Skip hint',
    },
  ],
  build: [
    {
      id: 'who',
      requirement: 'required',
      title: 'Who is going?',
      prompt: 'Choose the group this route should fit.',
      ctaLabel: 'Next',
      metadata: { step: 1 },
    },
    {
      id: 'vibe',
      requirement: 'optional',
      title: 'What should it feel like?',
      prompt: 'Pick a tone or let the anchor decide.',
      ctaLabel: 'Next',
      skipLabel: 'Use anchor fit',
    },
    {
      id: 'when',
      requirement: 'required',
      title: 'When should it happen?',
      prompt: 'Set the time, duration, and movement range.',
      ctaLabel: 'Next',
      metadata: { step: 3 },
    },
    {
      id: 'occasion',
      requirement: 'optional',
      title: 'What is the occasion?',
      prompt: 'Choose a purpose or keep it open.',
      ctaLabel: 'Next',
      skipLabel: 'Keep open',
    },
    {
      id: 'hint',
      requirement: 'required',
      title: 'What should we build around?',
      prompt: 'Provide the required anchor for the route.',
      ctaLabel: 'Find anchors',
      metadata: { anchorKind: 'required_anchor' },
    },
  ],
} as const satisfies Record<ConciergeCardMode, readonly ConciergeCardConfig[]>

export function getConciergeCardSequence(mode: ConciergeCardMode): readonly ConciergeCardConfig[] {
  return CONCIERGE_CARD_SEQUENCE_BY_MODE[mode]
}

export function getRenderableConciergeCards(mode: ConciergeCardMode): readonly ConciergeCardConfig[] {
  return getConciergeCardSequence(mode).filter((card) => card.requirement !== 'skipped')
}

export function getInitialConciergeCardFlowState(mode: ConciergeCardMode): ConciergeCardFlowState {
  const sequence = getConciergeCardSequence(mode)
  const firstRenderableCard = sequence.find((card) => card.requirement !== 'skipped') ?? null
  const statusById = sequence.reduce<Partial<ConciergeCardStatusById>>((current, card) => {
    current[card.id] = card.requirement === 'skipped' ? 'skipped' : 'unseen'
    return current
  }, {})

  return {
    mode,
    activeCardId: firstRenderableCard?.id ?? null,
    statusById: statusById as ConciergeCardStatusById,
    skippedAll: false,
  }
}

export function getNextConciergeCardId(params: {
  mode: ConciergeCardMode
  currentCardId: ConciergeCardId | null
  statusById?: Partial<Record<ConciergeCardId, ConciergeCardStatus>>
}): ConciergeCardId | null {
  const renderableCards = getRenderableConciergeCards(params.mode)
  const currentIndex = params.currentCardId
    ? renderableCards.findIndex((card) => card.id === params.currentCardId)
    : -1
  const remainingCards = renderableCards.slice(currentIndex + 1)
  const nextCard = remainingCards.find((card) => {
    const status = params.statusById?.[card.id]
    return status == null || status === 'unseen'
  })

  return nextCard?.id ?? null
}

function getEchoChipState(status: ConciergeCardStatus | undefined): ConciergeEchoChipState {
  if (status === 'answered') {
    return 'answered'
  }
  if (status === 'skipped') {
    return 'skipped'
  }
  return 'defaulted'
}

function formatPersonaLabel(value: ConciergeCardInputDraft['persona']): string {
  if (value === 'romantic') {
    return 'Date'
  }
  if (value === 'friends') {
    return 'Friends'
  }
  if (value === 'family') {
    return 'Family'
  }
  return 'Anyone'
}

function formatVibeLabel(value: ConciergeCardInputDraft['vibe']['uxProfile']): string {
  if (value === 'cozy') {
    return 'Cozy'
  }
  if (value === 'cultured') {
    return 'Cultured'
  }
  return 'Lively'
}

function formatOccasionLabel(value: ConciergeCardInputDraft['objectiveOccasion']): string {
  if (value === 'explore') {
    return 'Explore'
  }
  if (value === 'celebrate') {
    return 'Celebrate'
  }
  return 'Connect'
}

function formatWhenLabel(when: ConciergeCardInputDraft['when']): string {
  const details = [
    when.startTime,
    when.durationMinutes == null ? undefined : `${when.durationMinutes} min`,
    when.spatialMode === 'FLEXIBLE' ? 'Flexible' : 'Walkable',
  ].filter((value): value is string => Boolean(value))

  return details.length > 0 ? details.join(' · ') : 'Anything'
}

function getEchoValueLabel(params: {
  cardId: ConciergeCardId
  draft: ConciergeCardInputDraft
  state: ConciergeEchoChipState
  hintLabel?: string | null
}): string {
  if (params.state === 'skipped') {
    return params.cardId === 'who' ? 'Anyone' : 'Anything'
  }
  if (params.cardId === 'who') {
    return formatPersonaLabel(params.draft.persona)
  }
  if (params.cardId === 'vibe') {
    return formatVibeLabel(params.draft.vibe.uxProfile)
  }
  if (params.cardId === 'when') {
    return formatWhenLabel(params.draft.when)
  }
  if (params.cardId === 'occasion') {
    return formatOccasionLabel(params.draft.objectiveOccasion)
  }
  return params.hintLabel?.trim() || 'Anything'
}

export function deriveConciergeEchoChips(params: {
  mode: ConciergeCardMode
  draft: ConciergeCardInputDraft
  flowState?: ConciergeCardFlowState
  hintLabel?: string | null
}): ConciergeEchoProjection {
  const chips: ConciergeEchoChip[] = getConciergeCardSequence(params.mode).map((card) => {
    const status = params.flowState?.statusById[card.id]
    const state = getEchoChipState(status ?? (card.requirement === 'skipped' ? 'skipped' : undefined))
    return {
      id: card.id,
      label: CARD_LABEL_BY_ID[card.id],
      valueLabel: getEchoValueLabel({
        cardId: card.id,
        draft: params.draft,
        state,
        hintLabel: params.hintLabel,
      }),
      state,
      editable: card.requirement !== 'skipped',
    }
  })
  const summaryLabel = params.flowState?.skippedAll
    ? 'Anything · Anything'
    : chips
        .filter((chip) => chip.state !== 'skipped')
        .map((chip) => chip.valueLabel)
        .join(' · ')

  return {
    chips,
    summaryLabel,
  }
}
