import { ID8Butler } from '../components/butler/ID8Butler'
import { DevTopNav } from '../components/layout/DevTopNav'
import { PageShell } from '../components/layout/PageShell'
import {
  listSharedLiveArtifactPlans,
  loadLiveArtifactSession,
  type LiveArtifactSessionPayload,
  type SharedLiveArtifactPlanEntry,
} from '../domain/live/liveArtifactSession'
import type { ItineraryStop } from '../domain/types/itinerary'

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

function normalizeSignaturePart(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function buildSessionSignature(payload: LiveArtifactSessionPayload): string {
  const stops = payload.itinerary.stops
    .filter((stop) => stop.role === 'start' || stop.role === 'highlight' || stop.role === 'windDown')
    .map((stop) => normalizeSignaturePart(stop.venueId || stop.venueName))
  return [
    normalizeSignaturePart(payload.city || payload.itinerary.city),
    normalizeSignaturePart(payload.itinerary.title),
    ...stops,
  ].join('|')
}

function buildSharedPlanSignature(entry: SharedLiveArtifactPlanEntry): string {
  return buildSessionSignature(entry.payload)
}

function toTitleCase(value: string | undefined): string {
  if (!value) {
    return ''
  }
  return value
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function getCoreStop(stops: ItineraryStop[], role: 'start' | 'highlight' | 'windDown'): ItineraryStop | undefined {
  return stops.find((stop) => stop.role === role)
}

function buildStopSequenceLabel(payload: LiveArtifactSessionPayload): string {
  if (!payload.finalRoute) {
    return 'Saved plan incomplete'
  }
  const orderedStops = payload.finalRoute.stops.slice().sort((left, right) => left.stopIndex - right.stopIndex)
  const start = orderedStops.find((stop) => stop.role === 'start')?.displayName ?? 'Start'
  const highlight = orderedStops.find((stop) => stop.role === 'highlight')?.displayName ?? 'Highlight'
  const windDown = orderedStops.find((stop) => stop.role === 'windDown')?.displayName ?? 'Wind Down'
  return `${start} -> ${highlight} -> ${windDown}`
}

function buildPlanDescriptor(payload: LiveArtifactSessionPayload): string {
  if (!payload.finalRoute) {
    return 'Saved metadata only | Route artifact unavailable'
  }
  const area =
    payload.finalRoute.location ||
    payload.itinerary.neighborhood ||
    payload.city ||
    payload.itinerary.city ||
    'Local area'
  const persona = payload.finalRoute.persona
  const vibe = payload.finalRoute.vibe
  return [area, toTitleCase(persona), vibe ? toTitleCase(vibe) : ''].filter(Boolean).join(' | ')
}

function buildPlanTitle(payload: LiveArtifactSessionPayload): string {
  return payload.finalRoute?.routeHeadline || payload.itinerary.title || 'Saved plan'
}

function buildPlanCity(payload: LiveArtifactSessionPayload): string {
  return payload.finalRoute?.location || payload.city || payload.itinerary.city || 'San Jose'
}

export function DevHomePage() {
  const activePlan = loadLiveArtifactSession()
  const sharedPlans = listSharedLiveArtifactPlans()
  const activeSignature = activePlan ? buildSessionSignature(activePlan) : null
  const recentPlan =
    sharedPlans.find((entry) => buildSharedPlanSignature(entry) !== activeSignature) ?? null
  const continueHref = activePlan ? '/dev/live' : '/dev/plans'
  const continueLabel = activePlan ? 'Continue live plan' : 'Open plans'
  const continueTitle = activePlan?.finalRoute.routeHeadline || 'No active live plan'
  const continueMeta = activePlan
    ? `${activePlan.finalRoute.location || activePlan.city || activePlan.itinerary.city || 'San Jose'} | ${formatLockedAt(activePlan.lockedAt)}`
    : 'Resume from Plans Hub if available'

  return (
    <PageShell
      topSlot={<ID8Butler message="Choose what you want to do next." />}
      title="Development Home"
      subtitle={undefined}
    >
      <div className="dev-home-shell">
        <DevTopNav homeHref="/dev/home" />

        <section className="dev-home-section">
          <div className="dev-home-section-header">
            <h2>Continue tonight</h2>
          </div>
          <article className="dev-home-card">
            <p className="dev-home-card-title">{continueTitle}</p>
            <p className="dev-home-card-meta">{continueMeta}</p>
            <div className="action-row">
              <a className="primary-button" href={continueHref}>
                {continueLabel}
              </a>
            </div>
          </article>
        </section>

        <section className="dev-home-section">
          <div className="dev-home-section-header">
            <h2>Start something new</h2>
          </div>
          <div className="dev-home-mode-grid">
            <a className="dev-home-mode-card" href="/dev/start/surprise">
              <span>Surprise Me</span>
              <small>Assistant-led entry</small>
            </a>
            <a className="dev-home-mode-card" href="/dev/start/curate">
              <span>Curate Experience</span>
              <small>Guided curation entry</small>
            </a>
            <a className="dev-home-mode-card" href="/dev/start/build">
              <span>Build My Plan</span>
              <small>Direct planning entry</small>
            </a>
          </div>
        </section>

        <section className="dev-home-section">
          <div className="dev-home-section-header">
            <h2>Your plans</h2>
          </div>
          <div className="action-row">
            <a className="ghost-button subtle" href="/dev/plans">
              Open Plans Hub
            </a>
          </div>
          {recentPlan ? (
            <a className="dev-home-card dev-home-memory-card" href={`/p/${encodeURIComponent(recentPlan.planId)}`}>
              <p className="dev-home-card-title">{buildPlanTitle(recentPlan.payload)}</p>
              <p className="dev-home-card-meta">
                {buildPlanCity(recentPlan.payload)} |{' '}
                {formatLockedAt(recentPlan.payload.lockedAt)}
              </p>
              <p className="dev-home-card-note">{buildPlanDescriptor(recentPlan.payload)}</p>
              <p className="dev-home-card-note">{buildStopSequenceLabel(recentPlan.payload)}</p>
            </a>
          ) : (
            <p className="dev-home-empty">No saved plans yet.</p>
          )}
        </section>
      </div>
    </PageShell>
  )
}
