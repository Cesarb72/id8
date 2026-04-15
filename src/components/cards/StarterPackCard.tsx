import type { StarterPack } from '../../domain/types/starterPack'
import { getVibeLabel } from '../../domain/types/intent'

function getPersonaLabel(value?: StarterPack['personaBias']): string {
  if (value === 'romantic') {
    return 'Date'
  }
  if (value === 'friends') {
    return 'Friends'
  }
  if (value === 'family') {
    return 'Family'
  }
  return 'Flexible'
}

interface StarterPackCardProps {
  pack: StarterPack
  selected: boolean
  onSelect: (packId: string) => void
}

export function StarterPackCard({ pack, selected, onSelect }: StarterPackCardProps) {
  return (
    <button
      type="button"
      className={`starter-pack-card${selected ? ' selected' : ''}`}
      onClick={() => onSelect(pack.id)}
    >
      {selected && <span className="starter-pack-selected">Selected</span>}
      <span className="starter-pack-title">{pack.title}</span>
      <span className="starter-pack-meta">
        {getPersonaLabel(pack.personaBias)} | {getVibeLabel(pack.primaryAnchor)}
      </span>
      <span className="starter-pack-description">{pack.description}</span>
    </button>
  )
}
