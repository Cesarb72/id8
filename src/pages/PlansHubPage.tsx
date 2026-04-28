import { useMemo, useState } from 'react'
import { ID8Butler } from '../components/butler/ID8Butler'
import { DevTopNav } from '../components/layout/DevTopNav'
import { PageShell } from '../components/layout/PageShell'
import {
  endLiveArtifactSession,
  listSharedLiveArtifactPlans,
  loadLiveArtifactSession,
  removeSharedLiveArtifactPlan,
  type LiveArtifactSessionPayload,
  type SharedLiveArtifactPlanEntry,
} from '../domain/live/liveArtifactSession'
import type { ItineraryStop } from '../domain/types/itinerary'

function formatLockedAt(lockedAt: number): string {
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

function buildPlanSignature(entry: SharedLiveArtifactPlanEntry): string {
  const stops = entry.payload.itinerary.stops
    .filter((stop) => stop.role === 'start' || stop.role === 'highlight' || stop.role === 'windDown')
    .map((stop) => normalizeSignaturePart(stop.venueId || stop.venueName))
  return [
    normalizeSignaturePart(entry.payload.city || entry.payload.itinerary.city),
    normalizeSignaturePart(entry.payload.itinerary.title),
    ...stops,
  ].join('|')
}

function dedupeSharedPlans(entries: SharedLiveArtifactPlanEntry[]): SharedLiveArtifactPlanEntry[] {
  const seen = new Set<string>()
  const deduped: SharedLiveArtifactPlanEntry[] = []
  for (const entry of entries) {
    const signature = buildPlanSignature(entry)
    if (seen.has(signature)) {
      continue
    }
    seen.add(signature)
    deduped.push(entry)
  }
  return deduped
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
    return `${payload.city || payload.itinerary.city || 'San Jose'} | Saved metadata only`
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

function buildPayloadSignature(payload: LiveArtifactSessionPayload): string {
  const stops = payload.itinerary.stops
    .filter((stop) => stop.role === 'start' || stop.role === 'highlight' || stop.role === 'windDown')
    .map((stop) => normalizeSignaturePart(stop.venueId || stop.venueName))
  return [
    normalizeSignaturePart(payload.city || payload.itinerary.city),
    normalizeSignaturePart(payload.itinerary.title),
    ...stops,
  ].join('|')
}

export function PlansHubPage() {
  const currentPath =
    typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : ''
  const isDevPlans = currentPath.startsWith('/dev')
  const activePlan = loadLiveArtifactSession()
  const [sharedPlansVersion, setSharedPlansVersion] = useState(0)
  const sharedPlans = useMemo(
    () => dedupeSharedPlans(listSharedLiveArtifactPlans()).slice(0, 5),
    [sharedPlansVersion],
  )

  const handleRemoveSavedPlan = (entry: SharedLiveArtifactPlanEntry) => {
    const targetSignature = buildPlanSignature(entry)
    const activePlanSignature = activePlan ? buildPayloadSignature(activePlan) : null
    if (activePlanSignature && activePlanSignature === targetSignature) {
      endLiveArtifactSession()
    }
    for (const candidate of listSharedLiveArtifactPlans()) {
      if (buildPlanSignature(candidate) === targetSignature) {
        removeSharedLiveArtifactPlan(candidate.planId)
      }
    }
    setSharedPlansVersion((current) => current + 1)
  }

  return (
    <PageShell
      topSlot={<ID8Butler message="Memory layer for revisiting and resuming your plans." />}
      title="Plans Hub"
      subtitle="Saved and active plans"
    >
      <div className="plans-hub">
        <DevTopNav
          homeHref={isDevPlans ? '/dev/home' : '/home'}
        />

        {activePlan && (
          <section className="plans-hub-section plans-hub-active">
            <div className="plans-hub-active-header">
              <h2>{activePlan.finalRoute.routeHeadline || 'Tonight'}</h2>
              <p>{activePlan.finalRoute.location || activePlan.city || activePlan.itinerary.city || 'San Jose'}</p>
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
                  <div className="plans-hub-list-main">
                    <a href={`/p/${encodeURIComponent(entry.planId)}`}>
                      {buildPlanTitle(entry.payload)}
                    </a>
                    <p className="plans-hub-note">{buildPlanDescriptor(entry.payload)}</p>
                    <p className="plans-hub-note">{buildStopSequenceLabel(entry.payload)}</p>
                    {!entry.payload.finalRoute && (
                      <p className="plans-hub-note">Route artifact unavailable</p>
                    )}
                  </div>
                  <div className="plans-hub-list-side">
                    <span className="plans-hub-note">{formatLockedAt(entry.payload.lockedAt)}</span>
                    <button
                      type="button"
                      className="ghost-button subtle plans-hub-remove-button"
                      aria-label={`Remove saved plan: ${entry.payload.itinerary.title || 'Saved plan'}`}
                      onClick={() => handleRemoveSavedPlan(entry)}
                    >
                      Remove saved plan
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageShell>
  )
}

