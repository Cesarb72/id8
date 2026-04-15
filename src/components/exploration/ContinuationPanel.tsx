import type { ExplorationPlan } from '../../domain/exploration/types'
import { getVibeLabel } from '../../domain/types/intent'
import type { Itinerary } from '../../domain/types/itinerary'

interface ContinuationPanelProps {
  plan: ExplorationPlan
  title?: string
  variant?: 'default' | 'secondary'
}

function buildRouteMeta(itinerary: Itinerary): string {
  const location = itinerary.neighborhood
    ? `${itinerary.neighborhood}, ${itinerary.city}`
    : itinerary.city
  return `${itinerary.stops.length} stops | ${location}`
}

function formatDistrictStrategy(strategy: ExplorationPlan['transition']['districtStrategy']): string {
  return strategy === 'shift-district' ? 'District shift' : 'Stay local'
}

function formatTimePhase(phase: ExplorationPlan['transition']['timePhase']): string {
  if (phase === 'late-night') {
    return 'Late night'
  }
  return phase.charAt(0).toUpperCase() + phase.slice(1)
}

function formatContinuationMode(
  mode: ExplorationPlan['transition']['continuationMode'],
): string {
  if (mode === 'CONTINUATION_FRAGMENT') {
    return 'Fragment'
  }
  if (mode === 'COMPACT_CONTINUATION') {
    return 'Compact continuation'
  }
  return 'Full continuation'
}

export function ContinuationPanel({
  plan,
  title = 'Continue the outing',
  variant = 'default',
}: ContinuationPanelProps) {
  const itinerary = plan.displayItinerary
  const kicker = variant === 'secondary' ? 'Continuation' : 'Optional continuation'

  return (
    <section className={`continuation-panel${variant === 'secondary' ? ' secondary' : ''}`}>
      <div className="continuation-header">
        <div>
          <p className="continuation-kicker">{kicker}</p>
          <h2>{title}</h2>
          <p className="continuation-copy">{plan.transition.summary}</p>
        </div>
        <div className="reveal-story-meta">
          <span className="reveal-story-chip">{buildRouteMeta(itinerary)}</span>
          <span className="reveal-story-chip">{itinerary.estimatedTotalLabel}</span>
          <span className="reveal-story-chip">{itinerary.routeFeelLabel}</span>
        </div>
      </div>

      <p className="continuation-subtitle">{itinerary.story.subtitle}</p>

      <div className="continuation-chip-row">
        <span className="continuation-chip">{formatContinuationMode(plan.transition.continuationMode)}</span>
        <span className="continuation-chip">{plan.transition.resolutionStrength}</span>
        <span className="continuation-chip">{formatDistrictStrategy(plan.transition.districtStrategy)}</span>
        <span className="continuation-chip">{plan.transition.vibeShift}</span>
        <span className="continuation-chip">{formatTimePhase(plan.transition.timePhase)}</span>
        <span className="continuation-chip">{getVibeLabel(plan.transition.nextPrimaryVibe)}</span>
      </div>

      <div className="helper-note-stack">
        <p className="helper-note">
          <strong>Resolved:</strong> {plan.transition.resolvedReason}
        </p>
        <p className="helper-note">
          <strong>Mode:</strong> {plan.transition.continuationReason}
        </p>
        <p className="helper-note">
          <strong>District:</strong> {plan.transition.districtReason}
        </p>
        <p className="helper-note">
          <strong>Vibe:</strong> {plan.transition.vibeReason}
        </p>
        <p className="helper-note">
          <strong>Repetition:</strong> {plan.transition.repetitionReason}
        </p>
      </div>

      <div className="continuation-stop-list">
        {itinerary.stops.map((stop, index) => (
          <article key={stop.id} className="continuation-stop">
            <span className="continuation-stop-index">0{index + 1}</span>
            <div className="continuation-stop-body">
              <p className="continuation-stop-kicker">{stop.title}</p>
              <strong>{stop.venueName}</strong>
              <p className="continuation-stop-meta">
                {stop.neighborhood} | {stop.category.replace('_', ' ')} | {stop.estimatedDurationLabel}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
