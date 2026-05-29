import type { ReactNode } from 'react'
import type {
  ConciergeCardAnswerSummary,
  ConciergeCardConfig,
} from '../../../app/types/conciergeCardFlow'
import { ConciergeCardShell } from './ConciergeCardShell'

interface ConciergeCardStepProps {
  card: ConciergeCardConfig
  summary?: ConciergeCardAnswerSummary
  ctaLabel?: string
  skipLabel?: string
  canSkip?: boolean
  onAnswer: () => void
  onSkip?: () => void
  onBack?: () => void
  onEdit?: () => void
  children?: ReactNode
}

function getPlaceholderCopy(card: ConciergeCardConfig): string {
  if (card.id === 'who') {
    return 'Persona choices will render here.'
  }
  if (card.id === 'vibe') {
    return 'Vibe choices will render here.'
  }
  if (card.id === 'when') {
    return 'Time, duration, and spatial mode controls will render here.'
  }
  if (card.id === 'occasion') {
    return 'Explore, connect, and celebrate options will render here.'
  }
  return card.metadata?.anchorKind === 'required_anchor'
    ? 'Required anchor input will render here.'
    : 'Optional hint input will render here.'
}

export function ConciergeCardStep({
  card,
  summary,
  ctaLabel,
  skipLabel,
  canSkip,
  onAnswer,
  onSkip,
  onBack,
  onEdit,
  children,
}: ConciergeCardStepProps) {
  return (
    <ConciergeCardShell
      card={card}
      summary={summary}
      ctaLabel={ctaLabel}
      skipLabel={skipLabel}
      canSkip={canSkip}
      onAnswer={onAnswer}
      onSkip={onSkip}
      onBack={onBack}
      onEdit={onEdit}
    >
      {children ?? (
        <p className="concierge-card-placeholder" data-card-id={card.id}>
          {getPlaceholderCopy(card)}
        </p>
      )}
    </ConciergeCardShell>
  )
}
