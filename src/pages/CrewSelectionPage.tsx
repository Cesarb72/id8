import { ID8Butler } from '../components/butler/ID8Butler'
import { CrewCard } from '../components/cards/CrewCard'
import { PageShell } from '../components/layout/PageShell'
import type { PersonaMode } from '../domain/types/intent'

interface CrewSelectionPageProps {
  selectedPersona: PersonaMode | null
  onSelect: (persona: PersonaMode) => void
  onBack: () => void
  onNext: () => void
}

const crewOptions: Array<{
  persona: PersonaMode
  title: string
  description: string
}> = [
  {
    persona: 'romantic',
    title: 'Romantic',
    description: 'Intimate, polished, and low-friction pacing.',
  },
  {
    persona: 'friends',
    title: 'Friends',
    description: 'Social, energetic, and variety-forward.',
  },
  {
    persona: 'family',
    title: 'Family',
    description: 'Comfortable for mixed ages with strong flow.',
  },
]

export function CrewSelectionPage({
  selectedPersona,
  onSelect,
  onBack,
  onNext,
}: CrewSelectionPageProps) {
  return (
    <PageShell
      topSlot={<ID8Butler message="Who is joining this plan?" />}
      title="Who's Going?"
      subtitle="Choose the persona mode for this run."
      footer={
        <div className="action-row">
          <button type="button" className="ghost-button" onClick={onBack}>
            Back
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={!selectedPersona}
            onClick={onNext}
          >
            Continue
          </button>
        </div>
      }
    >
      <div className="card-stack">
        {crewOptions.map((option) => (
          <CrewCard
            key={option.persona}
            persona={option.persona}
            title={option.title}
            description={option.description}
            selected={selectedPersona === option.persona}
            onSelect={onSelect}
          />
        ))}
      </div>
    </PageShell>
  )
}
