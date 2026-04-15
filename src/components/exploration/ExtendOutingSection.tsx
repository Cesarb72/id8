import { ContinuationPanel } from './ContinuationPanel'
import type { LightNearbyExtensionOption } from '../../domain/exploration/deriveLightNearbyExtensions'
import type { ExplorationPlan } from '../../domain/exploration/types'

interface ExtendOutingSectionProps {
  options: LightNearbyExtensionOption[]
  explorationPlan?: ExplorationPlan
  explorationLoading: boolean
  onContinueOuting: () => void
}

function formatCategoryLabel(option: LightNearbyExtensionOption): string {
  return `${option.neighborhood} | ${option.driveMinutes} min | ${option.category.replace('_', ' ')}`
}

export function ExtendOutingSection({
  options,
  explorationPlan,
  explorationLoading,
  onContinueOuting,
}: ExtendOutingSectionProps) {
  const continuationReadsSecondary = options.length > 0
  const continuationFeelsSoft =
    explorationPlan?.transition.resolutionStrength === 'STRONG' ||
    explorationPlan?.transition.continuationMode === 'CONTINUATION_FRAGMENT'

  return (
    <section className="outing-extend-section">
      <div className="outing-extend-header">
        <div>
          <p className="outing-extend-kicker">Extend</p>
          <h2>Extend your outing</h2>
        </div>
        <p className="outing-extend-copy">A few easy ways to keep the night going.</p>
      </div>

      {options.length > 0 ? (
        <div className="outing-extend-nearby">
          <div className="outing-extend-subhead">
            <div>
              <p className="outing-extend-subkicker">First</p>
              <h3>Keep it light</h3>
            </div>
            <p className="outing-extend-subcopy">One more easy stop nearby.</p>
          </div>

          <div className="outing-extend-option-list">
            {options.map((option) => (
              <article key={option.id} className="outing-extend-option">
                <p className="outing-extend-option-label">{option.label}</p>
                <strong>{option.venueName}</strong>
                <p className="outing-extend-option-note">{option.note}</p>
                <p className="outing-extend-option-meta">{formatCategoryLabel(option)}</p>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <p className="outing-extend-empty">
          Nothing easy surfaced nearby right now, but you can still keep going if you want to.
        </p>
      )}

      <div
        className={`outing-extend-continuation${continuationReadsSecondary ? ' secondary' : ''}${
          continuationFeelsSoft ? ' soft' : ''
        }`}
      >
        <div className="outing-extend-subhead">
          <div>
            <p className="outing-extend-subkicker">Then</p>
            <h3>Or keep going</h3>
          </div>
          <p className="outing-extend-subcopy">See a fuller next chapter.</p>
        </div>

        <button
          type="button"
          className="ghost-button outing-extend-continue-button emphasis"
          onClick={onContinueOuting}
          disabled={explorationLoading}
        >
          {explorationLoading
            ? 'Finding continuation...'
            : explorationPlan
              ? 'Refresh continuation'
              : 'See how it continues'}
        </button>

        {explorationPlan ? (
          <ContinuationPanel plan={explorationPlan} variant="secondary" />
        ) : null}
      </div>
    </section>
  )
}
