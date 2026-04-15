import { ID8Butler } from '../components/butler/ID8Butler'
import { PageShell } from '../components/layout/PageShell'
import {
  listSharedLiveArtifactPlans,
  loadLiveArtifactSession,
} from '../domain/live/liveArtifactSession'

function formatLockedAt(lockedAt: number): string {
  return new Date(lockedAt).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function PlansHubPage() {
  const currentPath =
    typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : ''
  const isDevPlans = currentPath.startsWith('/dev')
  const activePlan = loadLiveArtifactSession()
  const sharedPlans = listSharedLiveArtifactPlans().slice(0, 5)

  return (
    <PageShell
      topSlot={<ID8Butler message="Memory layer for revisiting and resuming your plans." />}
      title="Plans Hub"
      subtitle="Saved and active plans"
    >
      <div className="plans-hub">
        {activePlan && (
          <section className="plans-hub-section plans-hub-active">
            <div className="plans-hub-active-header">
              <h2>{activePlan.itinerary.title || 'Tonight'}</h2>
              <p>{activePlan.city || activePlan.itinerary.city || 'San Jose'}</p>
            </div>
            <p className="plans-hub-status">Live co-pilot is active</p>
            <div className="action-row wrap plans-hub-actions">
              <a className="primary-button" href={isDevPlans ? '/dev/live' : '/journey/live'}>
                Continue live plan
              </a>
            </div>
          </section>
        )}

        <section className="plans-hub-section">
          <h3>Recent saved plans</h3>
          {sharedPlans.length === 0 ? (
            <p className="plans-hub-note">No saved plans yet.</p>
          ) : (
            <ul className="plans-hub-list">
              {sharedPlans.map((entry) => (
                <li key={entry.planId} className="plans-hub-list-item">
                  <a href={`/p/${encodeURIComponent(entry.planId)}`}>
                    {entry.payload.itinerary.title || 'Saved plan'}
                  </a>
                  <span className="plans-hub-note">{formatLockedAt(entry.payload.lockedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageShell>
  )
}
