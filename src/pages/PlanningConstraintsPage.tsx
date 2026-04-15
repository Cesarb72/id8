import { ID8Butler } from '../components/butler/ID8Butler'
import { PageShell } from '../components/layout/PageShell'
import type { BudgetPreference, DistanceMode } from '../domain/types/intent'

interface PlanningConstraintsPageProps {
  distanceMode: DistanceMode
  budget?: BudgetPreference
  onChange: (distanceMode: DistanceMode, budget?: BudgetPreference) => void
  onBack: () => void
  onContinue: () => void
}

export function PlanningConstraintsPage({
  distanceMode,
  budget,
  onChange,
  onBack,
  onContinue,
}: PlanningConstraintsPageProps) {
  return (
    <PageShell
      topSlot={<ID8Butler message="Set the practical guardrails last." />}
      title="How Should We Shape It?"
      subtitle="Use distance and budget to tune the route without changing the core intent."
      footer={
        <div className="action-row">
          <button type="button" className="ghost-button" onClick={onBack}>
            Back
          </button>
          <button type="button" className="primary-button" onClick={onContinue}>
            Continue
          </button>
        </div>
      }
    >
      <fieldset className="input-group">
        <legend className="input-label">Distance</legend>
        <div className="toggle-row">
          <button
            type="button"
            className={`toggle-pill${distanceMode === 'nearby' ? ' selected' : ''}`}
            onClick={() => onChange('nearby', budget)}
          >
            Nearby
          </button>
          <button
            type="button"
            className={`toggle-pill${distanceMode === 'short-drive' ? ' selected' : ''}`}
            onClick={() => onChange('short-drive', budget)}
          >
            Short Drive
          </button>
        </div>
      </fieldset>

      <label className="input-group">
        <span className="input-label">Budget (optional)</span>
        <select
          value={budget ?? ''}
          onChange={(event) =>
            onChange(
              distanceMode,
              event.target.value ? (event.target.value as BudgetPreference) : undefined,
            )
          }
        >
          <option value="">No preference</option>
          <option value="value">Value</option>
          <option value="balanced">Balanced</option>
          <option value="premium">Premium</option>
        </select>
      </label>
    </PageShell>
  )
}
