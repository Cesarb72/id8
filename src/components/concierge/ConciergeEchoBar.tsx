import type {
  ConciergeCardId,
  ConciergeEchoChip,
} from '../../app/types/conciergeCardFlow'

interface ConciergeEchoBarProps {
  chips: ConciergeEchoChip[]
  onChipClick?: (id: ConciergeCardId) => void
  hidden?: boolean
  summaryLabel?: string
}

export function ConciergeEchoBar({
  chips,
  onChipClick,
  hidden = false,
  summaryLabel,
}: ConciergeEchoBarProps) {
  if (hidden) {
    return null
  }

  return (
    <aside className="concierge-echo-bar" aria-label="Concierge answers">
      {summaryLabel && <p className="concierge-echo-summary">{summaryLabel}</p>}
      <div className="concierge-echo-chip-row">
        {chips.map((chip) => {
          const chipContent = (
            <>
              <span className="concierge-echo-chip-label">{chip.label}</span>
              <span className="concierge-echo-chip-value">{chip.valueLabel}</span>
            </>
          )

          if (onChipClick && chip.editable) {
            return (
              <button
                key={chip.id}
                type="button"
                className={`concierge-echo-chip is-${chip.state}`}
                onClick={() => onChipClick(chip.id)}
              >
                {chipContent}
              </button>
            )
          }

          return (
            <span key={chip.id} className={`concierge-echo-chip is-${chip.state}`}>
              {chipContent}
            </span>
          )
        })}
      </div>
    </aside>
  )
}
