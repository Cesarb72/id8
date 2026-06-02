import { ID8Butler } from '../components/butler/ID8Butler'
import { useState } from 'react'
import { PageShell } from '../components/layout/PageShell'
import {
  listSharedLiveArtifactPlans,
  loadLiveArtifactHomeState,
  loadLiveArtifactSession,
  type SharedLiveArtifactPlanEntry,
} from '../domain/live/liveArtifactSession'

type HomePlanPriority = 'active-live' | 'locked-in-progress' | 'recent-saved'

const HOME_PLANNING_CITY = 'San Jose'

interface HomePlanSummary {
  priority: HomePlanPriority
  title: string
  city: string
  routePath: string
  status: string
  lockedAt?: number
}

function formatLockedAt(lockedAt: number | undefined): string {
  if (!lockedAt) {
    return 'Saved recently'
  }
  return new Date(lockedAt).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function buildSavedPlanTitle(entry: SharedLiveArtifactPlanEntry): string {
  return entry.payload.finalRoute?.routeHeadline || entry.payload.itinerary.title || 'Saved plan'
}

function buildSavedPlanCity(entry: SharedLiveArtifactPlanEntry): string {
  return (
    entry.payload.finalRoute?.location ||
    entry.payload.city ||
    entry.payload.itinerary.city ||
    'San Jose'
  )
}

function buildSavedPlanStatus(entry: SharedLiveArtifactPlanEntry): string {
  return entry.payload.finalRoute ? 'Most recent saved' : 'Saved plan incomplete'
}

export function HomePage() {
  const [locationNoticeVisible, setLocationNoticeVisible] = useState(false)
  const currentPath =
    typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : ''
  const isDevHome = currentPath.startsWith('/dev')
  const startPrefix = isDevHome ? '/dev/start' : '/start'
  const buildStartHref = isDevHome ? `${startPrefix}/build` : `${startPrefix}/build?fresh=1`
  const plansPath = isDevHome ? '/dev/plans' : '/plans'
  const homeState = loadLiveArtifactHomeState()
  const liveArtifact = loadLiveArtifactSession()
  const sharedPlans = listSharedLiveArtifactPlans()
  const mostRecentSaved = sharedPlans[0]
  const lockedInProgress =
    !liveArtifact && homeState
      ? {
          city: homeState.city,
          mapPath: homeState.mapPath,
        }
      : null

  const prioritizedContinuation: HomePlanSummary | null = liveArtifact
    ? {
        priority: 'active-live',
        title: liveArtifact.finalRoute?.routeHeadline || 'Tonight',
        city: liveArtifact.finalRoute?.location || liveArtifact.city || liveArtifact.itinerary.city || 'San Jose',
        routePath: isDevHome ? '/dev/live' : '/journey/live',
        status: 'Live plan active',
        lockedAt: liveArtifact.lockedAt,
      }
    : lockedInProgress
      ? {
          priority: 'locked-in-progress',
          title: 'Locked plan in progress',
          city: lockedInProgress.city || 'San Jose',
          routePath: isDevHome ? '/dev/live' : lockedInProgress.mapPath || '/journey/live',
          status: 'Ready to resume',
        }
      : mostRecentSaved
        ? {
            priority: 'recent-saved',
            title: buildSavedPlanTitle(mostRecentSaved),
            city: buildSavedPlanCity(mostRecentSaved),
            routePath: `/p/${encodeURIComponent(mostRecentSaved.planId)}`,
            status: buildSavedPlanStatus(mostRecentSaved),
            lockedAt: mostRecentSaved.payload.lockedAt,
          }
        : null

  const plansHubRelevantPlan: HomePlanSummary | null = lockedInProgress
    ? {
        priority: 'locked-in-progress',
        title: 'Locked plan in progress',
        city: lockedInProgress.city || 'San Jose',
        routePath: isDevHome ? '/dev/live' : lockedInProgress.mapPath || '/journey/live',
        status: 'Resume where you left off',
      }
    : mostRecentSaved
      ? {
          priority: 'recent-saved',
          title: buildSavedPlanTitle(mostRecentSaved),
          city: buildSavedPlanCity(mostRecentSaved),
          routePath: `/p/${encodeURIComponent(mostRecentSaved.planId)}`,
          status: buildSavedPlanStatus(mostRecentSaved),
          lockedAt: mostRecentSaved.payload.lockedAt,
        }
      : null

  const showContinueTonight = Boolean(prioritizedContinuation)
  const showExploreMore = !prioritizedContinuation && !plansHubRelevantPlan

  return (
    <PageShell
      topSlot={
        <>
          <ID8Butler message="Pick what you want to do next. Keep going, start fresh, or revisit a plan." />
          <div className="home-location-bar" aria-label="Planning location">
            <div>
              <span className="home-location-bar-label">Planning in</span>
              <strong>{HOME_PLANNING_CITY}</strong>
            </div>
            <button
              type="button"
              className="home-location-bar-change"
              onClick={() => setLocationNoticeVisible(true)}
            >
              Change
            </button>
          </div>
          {locationNoticeVisible && (
            <p className="home-location-bar-notice">
              Location changes from Home are coming next.
            </p>
          )}
        </>
      }
      title="Home"
      subtitle="Tonight, without friction."
    >
      <div className="home-v1">
        {showContinueTonight && prioritizedContinuation && (
          <section className="home-v1-section home-v1-section-priority">
            <div className="home-v1-section-header">
              <h2>Continue tonight</h2>
            </div>
            <a className="home-v1-living-plan-card" href={prioritizedContinuation.routePath}>
              <p className="home-v1-plan-status">{prioritizedContinuation.status}</p>
              <h3>{prioritizedContinuation.title}</h3>
              <p className="home-v1-plan-meta">
                {prioritizedContinuation.city} | {formatLockedAt(prioritizedContinuation.lockedAt)}
              </p>
            </a>
          </section>
        )}

        <section className="home-v1-section">
          <div className="home-v1-section-header">
            <h2>Start something new</h2>
          </div>
          <div className="home-v1-mode-grid">
            <a className="home-v1-mode-card" href={`${startPrefix}/surprise`}>
              <span>Surprise Me</span>
              <small>Just go.</small>
            </a>
            <a className="home-v1-mode-card" href={`${startPrefix}/curate`}>
              <span>Curate Experience</span>
              <small>Pick a direction.</small>
            </a>
            <a className="home-v1-mode-card" href={buildStartHref}>
              <span>Build My Plan</span>
              <small>Start with what you know.</small>
            </a>
          </div>
        </section>

        <section className="home-v1-section">
          <div className="home-v1-section-header">
            <h2>Your plans</h2>
          </div>
          <div className="action-row home-v1-plans-actions">
            <a className="ghost-button subtle" href={plansPath}>
              Open Plans Hub
            </a>
          </div>
          {plansHubRelevantPlan ? (
            <a className="home-v1-memory-card" href={plansHubRelevantPlan.routePath}>
              <span>{plansHubRelevantPlan.status}</span>
              <strong>{plansHubRelevantPlan.title}</strong>
              <p>
                {plansHubRelevantPlan.city} | {formatLockedAt(plansHubRelevantPlan.lockedAt)}
              </p>
            </a>
          ) : (
            <p className="home-v1-empty-note">No saved plans yet. Start one and it will show up here.</p>
          )}
        </section>

        {showExploreMore && (
          <section className="home-v1-section home-v1-section-secondary">
            <div className="home-v1-section-header">
              <h2>Explore more</h2>
            </div>
            <p className="home-v1-empty-note">
              Fresh session detected. Lightweight discovery unlocks after your first saved plan.
            </p>
          </section>
        )}
      </div>
    </PageShell>
  )
}
