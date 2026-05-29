import type { ReactNode } from 'react'
import type {
  ConciergeCardAnswerSummary,
  ConciergeCardConfig,
} from '../../../app/types/conciergeCardFlow'

interface ConciergeCardShellProps {
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

export function ConciergeCardShell({
  card,
  summary,
  ctaLabel,
  skipLabel,
  canSkip = card.requirement === 'optional',
  onAnswer,
  onSkip,
  onBack,
  onEdit,
  children,
}: ConciergeCardShellProps) {
  return (
    <section className="concierge-card-shell" aria-labelledby={`concierge-card-${card.id}-title`}>
      <div className="concierge-card-shell-header">
        {card.metadata?.step != null && (
          <p className="concierge-card-step-label">Step {card.metadata.step}</p>
        )}
        <h2 id={`concierge-card-${card.id}-title`} className="concierge-card-title">
          {card.title}
        </h2>
        <p className="concierge-card-prompt">{card.prompt}</p>
      </div>

      {summary?.valueLabel && (
        <div className="concierge-card-summary">
          <span className="concierge-card-summary-label">Current</span>
          <span className="concierge-card-summary-value">{summary.valueLabel}</span>
          {onEdit && (
            <button type="button" className="concierge-card-edit" onClick={onEdit}>
              Edit
            </button>
          )}
        </div>
      )}

      {summary?.detail && <div className="concierge-card-summary-detail">{summary.detail}</div>}
      {children && <div className="concierge-card-body">{children}</div>}

      <div className="concierge-card-actions">
        {onBack && (
          <button type="button" className="concierge-card-secondary-action" onClick={onBack}>
            Back
          </button>
        )}
        {canSkip && onSkip && (
          <button type="button" className="concierge-card-secondary-action" onClick={onSkip}>
            {skipLabel ?? card.skipLabel ?? 'Skip'}
          </button>
        )}
        <button type="button" className="concierge-card-primary-action" onClick={onAnswer}>
          {ctaLabel ?? card.ctaLabel}
        </button>
      </div>
    </section>
  )
}
