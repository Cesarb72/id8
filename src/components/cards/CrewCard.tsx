import type { PersonaMode } from '../../domain/types/intent'

interface CrewCardProps {
  persona: PersonaMode
  title: string
  description: string
  selected: boolean
  onSelect: (persona: PersonaMode) => void
}

export function CrewCard({ persona, title, description, selected, onSelect }: CrewCardProps) {
  return (
    <button
      type="button"
      className={`choice-card${selected ? ' selected' : ''}`}
      onClick={() => onSelect(persona)}
    >
      <span className="choice-card-title">{title}</span>
      <span className="choice-card-description">{description}</span>
    </button>
  )
}
