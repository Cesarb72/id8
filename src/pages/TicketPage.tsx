import { ExtendOutingSection } from '../components/exploration/ExtendOutingSection'
import type { LightNearbyExtensionOption } from '../domain/exploration/deriveLightNearbyExtensions'
import type { ExplorationPlan } from '../domain/exploration/types'
import { PageShell } from '../components/layout/PageShell'
import { formatReadableDate } from '../lib/time'
import type { Itinerary } from '../domain/types/itinerary'

interface TicketPageProps {
  itinerary: Itinerary
  lightNearbyExtensions: LightNearbyExtensionOption[]
  explorationPlan?: ExplorationPlan
  explorationLoading: boolean
  lockedAt?: string
  onContinueOuting: () => void
  onStartOver: () => void
}

export function TicketPage({
  itinerary,
  lightNearbyExtensions,
  explorationPlan,
  explorationLoading,
  lockedAt,
  onContinueOuting,
  onStartOver,
}: TicketPageProps) {
  const locationLabel = itinerary.neighborhood
    ? `${itinerary.neighborhood}, ${itinerary.city}`
    : itinerary.city

  return (
    <PageShell
      title="Plan Locked"
      subtitle="Your route summary is ready."
      footer={
        <button type="button" className="primary-button" onClick={onStartOver}>
          Build Another Plan
        </button>
      }
    >
      <article className="ticket-card">
        <p className="ticket-label">Summary</p>
        <h2>Locked route overview</h2>
        <div className="reveal-story-meta">
          <span className="reveal-story-chip">{`${itinerary.stops.length} stops`}</span>
          <span className="reveal-story-chip">{itinerary.estimatedTotalLabel}</span>
          <span className="reveal-story-chip">{itinerary.routeFeelLabel}</span>
        </div>
        <p className="ticket-meta">
          {locationLabel}
          {lockedAt ? ` | Locked ${formatReadableDate(lockedAt)}` : ''}
        </p>
        <ol className="ticket-stops">
          {itinerary.stops.map((stop) => (
            <li key={stop.id}>
              <span>{stop.title}</span>
              <strong>{stop.venueName}</strong>
            </li>
          ))}
        </ol>
      </article>
      <ExtendOutingSection
        options={lightNearbyExtensions}
        explorationPlan={explorationPlan}
        explorationLoading={explorationLoading}
        onContinueOuting={onContinueOuting}
      />
    </PageShell>
  )
}
