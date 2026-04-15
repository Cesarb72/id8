import { ID8Butler } from '../components/butler/ID8Butler'
import { PageShell } from '../components/layout/PageShell'

interface LocationPageProps {
  city: string
  neighborhood?: string
  startTime?: string
  canEditMood: boolean
  onChange: (
    city: string,
    neighborhood: string | undefined,
    startTime?: string,
  ) => void
  onEditCrew: () => void
  onEditMood: () => void
  onBack: () => void
  onNext: () => void
}

const neighborhoodOptions = [
  'Downtown',
  'SoFA District',
  'Santana Row',
  'Rose Garden',
  'Willow Glen',
  'Kelley Park',
  'North San Jose',
  'Alum Rock',
  'Evergreen',
]

export function LocationPage({
  city,
  neighborhood,
  startTime,
  canEditMood,
  onChange,
  onEditCrew,
  onEditMood,
  onBack,
  onNext,
}: LocationPageProps) {
  return (
    <PageShell
      topSlot={
        <ID8Butler message="Commit the area and time you want this plan to honor." />
      }
      title="Commit"
      subtitle="Lock in the place and timing context before shaping the final route."
      footer={
        <div className="action-row">
          <button type="button" className="ghost-button" onClick={onBack}>
            Back
          </button>
          <button type="button" className="primary-button" onClick={onNext}>
            Continue to Shape
          </button>
        </div>
      }
    >
      <div className="inline-edit-row">
        <button type="button" className="chip-action" onClick={onEditCrew}>
          Edit Who's Going
        </button>
        {canEditMood && (
          <button type="button" className="chip-action" onClick={onEditMood}>
            Edit What
          </button>
        )}
      </div>

      <label className="input-group">
        <span className="input-label">City</span>
        <input
          value={city}
          onChange={(event) => onChange(event.target.value, neighborhood, startTime)}
          placeholder="San Jose"
        />
      </label>

      <label className="input-group">
        <span className="input-label">Area</span>
        <select
          value={neighborhood ?? ''}
          onChange={(event) =>
            onChange(
              city,
              event.target.value ? event.target.value : undefined,
              startTime,
            )
          }
        >
          <option value="">Any neighborhood</option>
          {neighborhoodOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="input-group">
        <span className="input-label">Start time (debug)</span>
        <input
          value={startTime ?? ''}
          onChange={(event) =>
            onChange(
              city,
              neighborhood,
              event.target.value || undefined,
            )
          }
          placeholder="20:00"
        />
      </label>
    </PageShell>
  )
}
