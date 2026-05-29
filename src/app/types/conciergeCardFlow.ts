import type { ReactNode } from 'react'

export type ConciergeCardId = 'who' | 'vibe' | 'when' | 'occasion' | 'hint'
export type ConciergeCardRequirement = 'required' | 'optional' | 'skipped'
export type ConciergeCardMode = 'surprise' | 'curate' | 'build'
export type ConciergeCardStatus = 'unseen' | 'answered' | 'skipped'
export type ConciergeEchoChipState = 'answered' | 'defaulted' | 'skipped'

export interface ConciergeCardStepMetadata {
  step?: number
  anchorKind?: 'required_anchor'
}

export interface ConciergeCardConfig {
  id: ConciergeCardId
  requirement: ConciergeCardRequirement
  title: string
  prompt: string
  ctaLabel: string
  skipLabel?: string
  metadata?: ConciergeCardStepMetadata
}

export type ConciergeCardStatusById = Record<ConciergeCardId, ConciergeCardStatus>

export interface ConciergeCardFlowState {
  mode: ConciergeCardMode
  activeCardId: ConciergeCardId | null
  statusById: ConciergeCardStatusById
  skippedAll: boolean
}

export interface ConciergeEchoChip {
  id: ConciergeCardId
  label: string
  valueLabel: string
  state: ConciergeEchoChipState
  editable: boolean
}

export interface ConciergeEchoProjection {
  chips: ConciergeEchoChip[]
  summaryLabel: string
}

export interface ConciergeCardAnswerSummary {
  valueLabel?: string
  detail?: ReactNode
}
