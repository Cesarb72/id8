import { ID8Butler } from '../components/butler/ID8Butler'
import { StarterPackCard } from '../components/cards/StarterPackCard'
import { PageShell } from '../components/layout/PageShell'
import type { StarterPack } from '../domain/types/starterPack'

interface CurateExperiencePageProps {
  packs: StarterPack[]
  selectedPackId?: string
  onSelectPack: (packId: string) => void
  onBack: () => void
  onContinue: () => void
}

export function CurateExperiencePage({
  packs,
  selectedPackId,
  onSelectPack,
  onBack,
  onContinue,
}: CurateExperiencePageProps) {
  return (
    <PageShell
      topSlot={<ID8Butler message="Pick a starter pack and I will shape a route from it, including the new date-centered packs." />}
      title="Curate Experience"
      subtitle="Guided packs for dates, culture, and stronger local discovery."
      footer={
        <div className="action-row">
          <button type="button" className="ghost-button" onClick={onBack}>
            Back
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={onContinue}
            disabled={!selectedPackId}
          >
            Continue
          </button>
        </div>
      }
    >
      <div className="card-stack">
        {packs.map((pack) => (
          <StarterPackCard
            key={pack.id}
            pack={pack}
            selected={selectedPackId === pack.id}
            onSelect={onSelectPack}
          />
        ))}
      </div>
    </PageShell>
  )
}
