import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { StopAlternative } from '../../domain/types/arc'
import type { Itinerary, UserStopRole } from '../../domain/types/itinerary'

interface MapPoint {
  x: number
  y: number
}

interface MapLegLabel {
  id: string
  x: number
  y: number
  minutes: number
}

interface MapSegment {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  emphasis: 'primary' | 'secondary' | 'muted'
  intoHighlight: boolean
}

interface DistrictZoneTemplate {
  x: number
  y: number
  width: number
  height: number
  tone: 'core' | 'creative' | 'calm'
}

interface JourneySurfaceDetail {
  whyItFits?: string
  tonightSignals?: string[]
  localSignal?: string
}

interface JourneyMapProps {
  itinerary: Itinerary
  activeRole: UserStopRole
  changedRoles: UserStopRole[]
  visibleAlternativesByRole: Partial<Record<UserStopRole, StopAlternative[]>>
  nearbyCounts: Partial<Record<UserStopRole, number>>
  narrativeLine?: string
  orientationOnly?: boolean
  integratedSurface?: boolean
  activeStopDescription?: string
  activeStopDetail?: JourneySurfaceDetail
  stopDescriptionsByRole?: Partial<Record<UserStopRole, string>>
  stopDetailsByRole?: Partial<Record<UserStopRole, JourneySurfaceDetail>>
  onActiveRoleChange: (role: UserStopRole) => void
}

const POSITION_TEMPLATES: Record<number, MapPoint[]> = {
  3: [
    { x: 16, y: 70 },
    { x: 50, y: 30 },
    { x: 84, y: 64 },
  ],
  4: [
    { x: 14, y: 72 },
    { x: 40, y: 46 },
    { x: 66, y: 20 },
    { x: 84, y: 66 },
  ],
}

const VIEWPORT_HALF_WIDTH = 14
const VIEWPORT_HALF_HEIGHT = 12
const DISTRICT_ZONE_TEMPLATES: DistrictZoneTemplate[] = [
  { x: 28, y: 30, width: 32, height: 24, tone: 'core' },
  { x: 56, y: 56, width: 38, height: 28, tone: 'creative' },
  { x: 80, y: 36, width: 30, height: 22, tone: 'calm' },
]
const NEARBY_SIGNAL_OFFSETS_BY_ROLE: Record<UserStopRole, MapPoint[]> = {
  start: [
    { x: -20, y: -16 },
    { x: 22, y: 14 },
  ],
  highlight: [
    { x: -8, y: -7 },
    { x: 7, y: -6 },
    { x: 9, y: 1 },
    { x: 6, y: 8 },
    { x: -2, y: 9 },
    { x: -8, y: 6 },
    { x: -9, y: -1 },
  ],
  windDown: [
    { x: -24, y: -14 },
    { x: 21, y: 15 },
  ],
  surprise: [
    { x: -12, y: -10 },
    { x: 10, y: 8 },
    { x: -9, y: 13 },
  ],
}
const ACTIVITY_SIGNAL_OFFSETS: MapPoint[] = [
  { x: -6, y: -8 },
  { x: 7, y: 6 },
]

function getMapPoints(stopCount: number): MapPoint[] {
  return POSITION_TEMPLATES[stopCount] ?? POSITION_TEMPLATES[3]
}

function getRouteCenter(points: MapPoint[], stopCount: number): MapPoint {
  const relevant = points.slice(0, stopCount)
  if (relevant.length === 0) {
    return { x: 50, y: 50 }
  }
  const sum = relevant.reduce(
    (acc, point) => ({
      x: acc.x + point.x,
      y: acc.y + point.y,
    }),
    { x: 0, y: 0 },
  )
  return {
    x: sum.x / relevant.length,
    y: sum.y / relevant.length,
  }
}

function buildNodeLabel(role: UserStopRole): string {
  if (role === 'start') {
    return 'Start'
  }
  if (role === 'highlight') {
    return 'Highlight'
  }
  if (role === 'surprise') {
    return 'Surprise'
  }
  return 'Wind Down'
}

function isInViewportFrame(point: MapPoint, center: MapPoint): boolean {
  return (
    Math.abs(point.x - center.x) <= VIEWPORT_HALF_WIDTH &&
    Math.abs(point.y - center.y) <= VIEWPORT_HALF_HEIGHT
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function buildDistrictLabels(city: string, stops: Itinerary['stops']): string[] {
  const normalizedCity = city.trim().toLowerCase()
  if (normalizedCity.includes('san jose')) {
    return ['Downtown', 'SoFa', 'Japantown']
  }

  const neighborhoodLabels = Array.from(
    new Set(
      stops
        .map((stop) => stop.neighborhood?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ).slice(0, 3)

  return [
    neighborhoodLabels[0] ?? 'Central District',
    neighborhoodLabels[1] ?? 'Arts Quarter',
    neighborhoodLabels[2] ?? 'Northside',
  ]
}

function buildRoleClass(role: UserStopRole): string {
  if (role === 'highlight') {
    return ' role-highlight'
  }
  if (role === 'start') {
    return ' role-start'
  }
  return ' role-wind-down'
}

function buildRoleStateClass(role: UserStopRole): string {
  if (role === 'windDown') {
    return ' state-wind-down'
  }
  if (role === 'highlight') {
    return ' state-highlight'
  }
  return ' state-start'
}

function getNearbyOffsets(role: UserStopRole): MapPoint[] {
  return NEARBY_SIGNAL_OFFSETS_BY_ROLE[role] ?? NEARBY_SIGNAL_OFFSETS_BY_ROLE.start
}

function buildActiveNodeSignal(role: UserStopRole): string {
  if (role === 'highlight') {
    return 'Filling up'
  }
  if (role === 'windDown') {
    return 'Quiet now'
  }
  return 'Live soon'
}

function buildFollowingCopy(role: UserStopRole): string {
  if (role === 'start') {
    return 'Starting here — easing into the night'
  }
  if (role === 'highlight') {
    return 'Next: peak energy building'
  }
  return 'Then: slowing into a clean finish'
}

export function JourneyMap({
  itinerary,
  activeRole,
  changedRoles,
  visibleAlternativesByRole: _visibleAlternativesByRole,
  nearbyCounts: _nearbyCounts,
  narrativeLine,
  orientationOnly = false,
  integratedSurface = false,
  activeStopDescription,
  activeStopDetail,
  stopDescriptionsByRole,
  stopDetailsByRole,
  onActiveRoleChange,
}: JourneyMapProps) {
  const surfaceRef = useRef<HTMLElement | null>(null)
  const [mapMode, setMapMode] = useState<'overview' | 'focus'>('overview')
  const [revealPhase, setRevealPhase] = useState<'overview' | 'begin-here' | 'free'>('overview')
  const points = useMemo(() => getMapPoints(itinerary.stops.length), [itinerary.stops.length])
  const effectiveMapMode = orientationOnly ? 'overview' : mapMode
  const effectiveRevealPhase = orientationOnly ? 'free' : revealPhase
  const revealRole = effectiveRevealPhase === 'free' ? activeRole : 'start'
  const startStop = itinerary.stops.find((stop) => stop.role === 'start') ?? itinerary.stops[0]
  const rolePointMap = useMemo(() => {
    const mapped: Partial<Record<UserStopRole, MapPoint>> = {}
    itinerary.stops.forEach((stop, index) => {
      mapped[stop.role] = points[index] ?? points[0]
    })
    return mapped
  }, [itinerary.stops, points])
  const routeCenter = useMemo(
    () => getRouteCenter(points, itinerary.stops.length),
    [itinerary.stops.length, points],
  )
  const journeyStops = useMemo(
    () =>
      itinerary.stops.map((stop, index) => ({
        index,
        role: stop.role,
        stop,
      })),
    [itinerary.stops],
  )
  const activeJourneyIndex = Math.max(
    journeyStops.findIndex((item) => item.role === activeRole),
    0,
  )
  const syncedActiveRole = journeyStops[activeJourneyIndex]?.role ?? activeRole
  const activeStop = itinerary.stops.find((stop) => stop.role === syncedActiveRole) ?? startStop
  const activeStopIndex = Math.max(
    itinerary.stops.findIndex((stop) => stop.role === syncedActiveRole),
    0,
  )
  const focusRole = effectiveRevealPhase === 'begin-here' ? 'start' : syncedActiveRole
  const focusPoint =
    effectiveMapMode === 'overview' ? routeCenter : rolePointMap[focusRole] ?? routeCenter
  const activePoint = rolePointMap[syncedActiveRole] ?? rolePointMap.highlight ?? routeCenter
  const framePoint = integratedSurface && effectiveMapMode === 'focus' ? { x: 50, y: 56 } : activePoint
  const orientationPanX = orientationOnly ? clamp((50 - activePoint.x) * 0.56, -20, 20) : 0
  const orientationPanY = orientationOnly ? clamp((50 - activePoint.y) * 0.36, -12, 12) : 0
  const glassFrameStyle = integratedSurface
    ? ({ left: '50%', top: '56%' } as CSSProperties)
    : ({ left: `${framePoint.x}%`, top: `${framePoint.y}%` } as CSSProperties)
  const activeSurfaceDetail = stopDetailsByRole?.[syncedActiveRole] ?? activeStopDetail
  const activeSurfaceDescription =
    stopDescriptionsByRole?.[syncedActiveRole] ?? activeStopDescription ?? activeStop.subtitle
  const tonightSignals = activeSurfaceDetail?.tonightSignals?.slice(0, 2) ?? []
  const routeGradientId = useMemo(
    () =>
      `journey-route-gradient-${String(itinerary.id)
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .toLowerCase()}`,
    [itinerary.id],
  )
  const districtZones = useMemo(() => {
    const labels = buildDistrictLabels(itinerary.city, itinerary.stops)
    return DISTRICT_ZONE_TEMPLATES.map((template, index) => ({
      ...template,
      label: labels[index] ?? `District ${index + 1}`,
      id: `${itinerary.id}_district_${index}`,
    }))
  }, [itinerary.city, itinerary.id, itinerary.stops])

  useEffect(() => {
    if (orientationOnly) {
      setMapMode('overview')
      setRevealPhase('free')
      return
    }
    setMapMode('overview')
    setRevealPhase('overview')
    const beginTimeoutId = window.setTimeout(() => {
      setMapMode('focus')
      setRevealPhase('begin-here')
    }, 850)
    const freeTimeoutId = window.setTimeout(() => {
      setRevealPhase('free')
    }, 2000)
    return () => {
      window.clearTimeout(beginTimeoutId)
      window.clearTimeout(freeTimeoutId)
    }
  }, [itinerary.id, orientationOnly])

  useEffect(() => {
    if (
      orientationOnly ||
      !integratedSurface ||
      journeyStops.length === 0 ||
      typeof window === 'undefined'
    ) {
      return
    }
    const target = surfaceRef.current
    if (!target) {
      return
    }

    let rafId = 0

    const updateByScroll = () => {
      const rect = target.getBoundingClientRect()
      const viewportHeight = Math.max(window.innerHeight || 0, 1)
      const progress = clamp(
        (viewportHeight - rect.top) / Math.max(rect.height + viewportHeight, 1),
        0,
        1,
      )

      let nextIndex = Math.floor(progress * journeyStops.length)
      nextIndex = clamp(nextIndex, 0, journeyStops.length - 1)
      const nextRole = journeyStops[nextIndex]?.role
      if (nextRole && nextRole !== activeRole) {
        onActiveRoleChange(nextRole)
      }
    }

    const scheduleUpdate = () => {
      if (rafId) {
        return
      }
      rafId = window.requestAnimationFrame(() => {
        rafId = 0
        updateByScroll()
      })
    }

    updateByScroll()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)
    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId)
      }
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [activeRole, integratedSurface, journeyStops, onActiveRoleChange, orientationOnly])

  const polylinePoints = points
    .slice(0, itinerary.stops.length)
    .map((point) => `${point.x},${point.y}`)
    .join(' ')
  const legLabels: MapLegLabel[] = itinerary.transitions.map((transition, index) => {
    const from = points[index] ?? points[0]
    const to = points[index + 1] ?? from
    return {
      id: `${transition.fromStopId}_${transition.toStopId}_${index}`,
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2,
      minutes: Math.max(transition.estimatedTravelMinutes, 1),
    }
  })
  const routeSegments: MapSegment[] = itinerary.transitions.map((transition, index) => {
    const from = points[index] ?? points[0]
    const to = points[index + 1] ?? from
    const isIntoActive = index === activeStopIndex - 1
    const isOutOfActive = index === activeStopIndex
    const toStop = itinerary.stops[index + 1]
    return {
      id: `${transition.fromStopId}_${transition.toStopId}_${index}`,
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      emphasis: isIntoActive ? 'primary' : isOutOfActive ? 'secondary' : 'muted',
      intoHighlight: toStop?.role === 'highlight',
    }
  })

  return (
    <section
      ref={surfaceRef}
      className={`journey-map reveal-phase-${effectiveRevealPhase}${
        orientationOnly ? ' orientation' : ''
      }`}
    >
      <div className="journey-map-header">
        <div>
          <p className="journey-map-kicker">
            {integratedSurface ? 'Journey Surface' : 'Journey Map'}
          </p>
          <h2>{itinerary.city}</h2>
          <p className="journey-map-subcopy">
            {effectiveMapMode === 'overview'
              ? 'Full route view keeps every stop and movement visible.'
              : 'Focused stop view keeps the active beat anchored in the wider route.'}
          </p>
          {narrativeLine && <p className="journey-map-narrative">{narrativeLine}</p>}
        </div>
        <div className="journey-map-controls">
          <button
            type="button"
            className="chip-action"
            onClick={() => {
              setRevealPhase('free')
              setMapMode('overview')
            }}
          >
            See Full Route
          </button>
          {!orientationOnly && (
            <button
              type="button"
              className="chip-action"
              onClick={() => {
                setRevealPhase('free')
                setMapMode('focus')
              }}
            >
              Focus Active Stop
            </button>
          )}
        </div>
      </div>

      <div
        className={`journey-map-stage-shell reveal-${effectiveRevealPhase}${buildRoleStateClass(
          syncedActiveRole,
        )}`}
      >
        {orientationOnly && (
          <p className="journey-map-following">{buildFollowingCopy(syncedActiveRole)}</p>
        )}
        {startStop && !orientationOnly && (
          <div className={`journey-map-overlay ${effectiveRevealPhase}`}>
            <p className="journey-map-overlay-kicker">
              {effectiveRevealPhase === 'overview' ? 'Full route in view' : 'Begin here'}
            </p>
            <strong>{startStop.venueName}</strong>
            <span>
              {effectiveRevealPhase === 'overview'
                ? 'Take in the whole shape first.'
                : 'Start stop highlighted first so the plan reads fast.'}
            </span>
          </div>
        )}
        <div
          className={`journey-map-stage ${effectiveMapMode} ${effectiveRevealPhase}${
            integratedSurface ? ` ${effectiveMapMode === 'focus' ? 'story-mode' : 'route-mode'}` : ''
          }`}
          style={{
            transformOrigin: `${focusPoint.x}% ${focusPoint.y}%`,
            '--orientation-pan-x': `${orientationPanX}%`,
            '--orientation-pan-y': `${orientationPanY}%`,
          }}
        >
          <div className="journey-map-grid" />
          <div className="journey-map-ambient-shimmer" aria-hidden="true" />
          <div className="journey-map-district-layer" aria-hidden="true">
            {districtZones.map((zone, index) => (
              <span
                key={`${zone.id}_zone`}
                className={`journey-map-district-zone tone-${zone.tone}`}
                style={{
                  left: `${zone.x}%`,
                  top: `${zone.y}%`,
                  width: `${zone.width}%`,
                  height: `${zone.height}%`,
                  animationDelay: `${index * 0.8}s`,
                }}
              />
            ))}
            {districtZones.map((zone, index) => (
              <span
                key={`${zone.id}_label`}
                className={`journey-map-district-label tone-${zone.tone}`}
                style={{
                  left: `${zone.x}%`,
                  top: `${zone.y}%`,
                  animationDelay: `${index * 0.9}s`,
                }}
              >
                {zone.label}
              </span>
            ))}
          </div>
          <div className="journey-map-activity-layer" aria-hidden="true">
            {itinerary.stops.map((stop, index) => {
              const point = points[index] ?? points[0]
              return ACTIVITY_SIGNAL_OFFSETS.map((offset, signalIndex) => {
                const signalPoint = {
                  x: point.x + offset.x,
                  y: point.y + offset.y,
                }
                return (
                  <span
                    key={`${stop.id}_activity_${signalIndex}`}
                    className={`journey-map-activity-signal${buildRoleClass(stop.role)}${
                      syncedActiveRole === stop.role ? ' active-stop' : ''
                    }${isInViewportFrame(signalPoint, framePoint) ? ' in-frame' : ' out-frame'}`}
                    style={{
                      left: `${signalPoint.x}%`,
                      top: `${signalPoint.y}%`,
                      animationDelay: `${index * 0.42 + signalIndex * 0.3}s`,
                    }}
                  />
                )
              })
            })}
          </div>
          <svg
            key={itinerary.id}
            className="journey-map-lines"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={routeGradientId} x1="10%" y1="80%" x2="90%" y2="20%">
                <stop offset="0%" stopColor="rgb(102 156 199 / 0.92)" />
                <stop offset="56%" stopColor="rgb(236 165 74 / 0.98)" />
                <stop offset="100%" stopColor="rgb(153 168 184 / 0.56)" />
              </linearGradient>
            </defs>
            <polyline className="journey-map-line-shadow" points={polylinePoints} />
            <polyline
              className="journey-map-line"
              points={polylinePoints}
              style={{ stroke: `url(#${routeGradientId})` }}
            />
            <polyline
              className="journey-map-line-flow"
              points={polylinePoints}
              style={{ stroke: `url(#${routeGradientId})` }}
            />
            {routeSegments.map((segment) => (
              <line
                key={segment.id}
                className={`journey-map-line-segment ${segment.emphasis}${
                  segment.intoHighlight ? ' into-highlight' : ''
                }`}
                x1={segment.x1}
                y1={segment.y1}
                x2={segment.x2}
                y2={segment.y2}
                style={{ stroke: `url(#${routeGradientId})` }}
              />
            ))}
          </svg>
          {legLabels.map((leg, index) => (
            <span
              key={leg.id}
              className={`journey-map-leg-label${
                effectiveRevealPhase === 'begin-here' && index > 0 ? ' muted' : ''
              }${isInViewportFrame(leg, framePoint) ? ' in-frame' : ' out-frame'}`}
              style={{
                left: `${leg.x}%`,
                top: `${leg.y}%`,
              }}
            >
              ~{leg.minutes} min drive
            </span>
          ))}

          {itinerary.stops.map((stop, index) => {
            const point = points[index] ?? points[0]

            return (
              <div key={stop.id}>
                {stop.role === syncedActiveRole &&
                  getNearbyOffsets(stop.role).map((offset, previewIndex) => {
                  const nearbySignalPoint = {
                    x: point.x + offset.x,
                    y: point.y + offset.y,
                  }
                  return (
                    <span
                      key={`${stop.id}_nearby_signal_${previewIndex}`}
                      className={`journey-map-nearby-dot${buildRoleClass(stop.role)}${
                        syncedActiveRole === stop.role ? ' active' : ''
                      }${isInViewportFrame(nearbySignalPoint, framePoint) ? ' in-frame' : ' out-frame'}${
                        effectiveMapMode === 'focus' && syncedActiveRole === stop.role ? ' centered' : ''
                      }`}
                      style={{
                        left: `${nearbySignalPoint.x}%`,
                        top: `${nearbySignalPoint.y}%`,
                        animationDelay: `${index * 0.25 + previewIndex * 0.14}s`,
                      }}
                    />
                  )
                })}
                {stop.role === syncedActiveRole && (
                  <span
                    className={`journey-map-node-signal${buildRoleClass(stop.role)}`}
                    style={{
                      left: `${point.x}%`,
                      top: `${point.y - 13}%`,
                    }}
                  >
                    {buildActiveNodeSignal(stop.role)}
                  </span>
                )}

                <button
                  type="button"
                  className={`journey-map-node${syncedActiveRole === stop.role ? ' active' : ''}${
                    changedRoles.includes(stop.role) ? ' changed' : ''
                  }${stop.role === 'highlight' ? ' highlight' : ''}${
                    stop.role === revealRole ? ' lead' : ''
                  }${effectiveRevealPhase === 'begin-here' && stop.role !== revealRole ? ' muted' : ''}${
                    isInViewportFrame(point, framePoint) ? ' in-frame' : ' out-frame'
                  }${effectiveMapMode === 'focus' && syncedActiveRole === stop.role ? ' centered' : ''}${
                    effectiveMapMode === 'focus' && syncedActiveRole === stop.role ? ' active-centered' : ''
                  }`}
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  onClick={() => {
                    onActiveRoleChange(stop.role)
                    if (!orientationOnly) {
                      setRevealPhase('free')
                      setMapMode('focus')
                    }
                  }}
                >
                  <span className="journey-map-node-index">0{index + 1}</span>
                  <strong>{buildNodeLabel(stop.role)}</strong>
                  <small>{stop.venueName}</small>
                </button>
              </div>
            )
          })}
          {integratedSurface && (
            <div
              className={`journey-map-story-scrim ${effectiveMapMode === 'focus' ? 'active' : ''}`}
              aria-hidden="true"
            />
          )}
          {!orientationOnly && (
            <div
              className={`journey-map-viewframe${
                integratedSurface && effectiveMapMode === 'focus' ? ' story-focus' : ''
              }`}
              style={glassFrameStyle}
              aria-hidden="true"
            />
          )}

          {integratedSurface && activeStop && (
            <div className={`journey-surface-story-layer ${effectiveMapMode === 'focus' ? 'focus' : 'overview'}`}>
              {effectiveMapMode === 'focus' ? (
                <article className="journey-surface-card active primary">
                  <p className="journey-surface-card-label">{activeStop.title.toUpperCase()}</p>
                  <h3>{activeStop.venueName}</h3>
                  <p className="journey-surface-card-description">{activeSurfaceDescription}</p>
                  {activeSurfaceDetail?.whyItFits && (
                    <div className="journey-surface-card-row">
                      <p className="journey-surface-card-row-label">Why it fits</p>
                      <p className="journey-surface-card-row-copy">{activeSurfaceDetail.whyItFits}</p>
                    </div>
                  )}
                  {tonightSignals.length > 0 && (
                    <div className="journey-surface-card-row">
                      <p className="journey-surface-card-row-label">Tonight</p>
                      <ul className="journey-surface-card-signals">
                        {tonightSignals.map((signal) => (
                          <li key={`${activeStop.id}_${signal}`}>{signal}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {activeSurfaceDetail?.localSignal && (
                    <div className="journey-surface-card-row">
                      <p className="journey-surface-card-row-label">Local note</p>
                      <p className="journey-surface-card-row-copy">{activeSurfaceDetail.localSignal}</p>
                    </div>
                  )}
                </article>
              ) : (
                <div className="journey-surface-route-pill">
                  <span>{activeStop.title}</span>
                  <strong>{activeStop.venueName}</strong>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="journey-map-footer">
        <p className="journey-map-focus">
          {effectiveMapMode === 'overview'
            ? `Full route view across ${itinerary.city}.`
            : `Focused on ${buildNodeLabel(syncedActiveRole)} with surrounding route context preserved.`}
        </p>
        <p className="journey-map-now-viewing">
          {`Now viewing: ${buildNodeLabel(syncedActiveRole)} — ${activeStop.venueName}`}
        </p>
        <div className="journey-map-legend">
          <span>Main route</span>
          <span>{integratedSurface ? 'Active story card' : 'Around here tonight'}</span>
        </div>
      </div>
    </section>
  )
}
