import type { VibeAnchor } from '../../domain/types/intent'

interface VibeChipProps {
  vibe: VibeAnchor
  label: string
  sublabel: string
  selected: boolean
  onClick: (vibe: VibeAnchor) => void
}

export function VibeChip({ vibe, label, sublabel, selected, onClick }: VibeChipProps) {
  return (
    <button
      type="button"
      className={`vibe-chip${selected ? ' selected' : ''}`}
      onClick={() => onClick(vibe)}
    >
      <span>{label}</span>
      <small>{sublabel}</small>
    </button>
  )
}
