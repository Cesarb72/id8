import { ExtendOutingSection } from '../components/exploration/ExtendOutingSection'
import { DistrictFlowNarrative } from '../components/journey/DistrictFlowNarrative'
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
  return (
    <PageShell
      title="Plan Locked"
      subtitle="Your curated route is ready."
      footer={
        <button type="button" className="primary-button" onClick={onStartOver}>
          Build Another Plan
        </button>
      }
    >
      <article className="ticket-card">
        <p className="ticket-label">Summary</p>
        <h2>{itinerary.title}</h2>
        <p>{itinerary.shareSummary}</p>
        {itinerary.storySpine && (
          <div className="ticket-story-spine">
            <p className="ticket-story-spine-title">{itinerary.storySpine.title}</p>
            <p className="ticket-story-spine-summary">{itinerary.storySpine.routeSummary}</p>
            <div className="ticket-story-spine-phases">
              {itinerary.storySpine.phases.slice(0, 3).map((phase) => (
                <span key={`${phase.role}_${phase.label}`}>{phase.label}</span>
              ))}
            </div>
          </div>
        )}
        <p className="ticket-meta">
          {itinerary.city}
          {itinerary.neighborhood ? ` | ${itinerary.neighborhood}` : ''}
          {lockedAt ? ` | Locked ${formatReadableDate(lockedAt)}` : ''}
        </p>
        <DistrictFlowNarrative itinerary={itinerary} />
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
