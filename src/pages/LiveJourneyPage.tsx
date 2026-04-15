import { useCallback, useEffect, useMemo, useState } from 'react'
import { ID8Butler } from '../components/butler/ID8Butler'
import { RouteSpine } from '../components/journey/RouteSpine'
import {
  JourneyMapReal,
  type JourneyContinuationStop,
  type JourneyNearbyOption,
} from '../components/journey/JourneyMapReal'
import { PageShell } from '../components/layout/PageShell'
import {
  createLiveArtifactPlanId,
  loadSharedLiveArtifactPlan,
  loadLiveArtifactSession,
  saveLiveArtifactSession,
  saveLiveArtifactHomeState,
  saveSharedLiveArtifactPlan,
  type FinalRoute,
  type FinalRouteStop,
  type LiveArtifactSessionPayload,
} from '../domain/live/liveArtifactSession'
import { buildTonightSignals } from '../domain/journey/buildTonightSignals'
import type { ItineraryStop, UserStopRole } from '../domain/types/itinerary'

type LiveAlertStage = 'idle' | 'alert' | 'preview' | 'resolved'
type LiveAlertDecision = 'keep' | 'switch' | 'timing'
type LiveContinuationOptionId = 'stay-nearby' | 'change-pace' | 'ease-out'
type LiveUtilityModal = 'share' | 'calendar' | null

interface LiveJourneyPageProps {
  sharedPlanId?: string
}

const LIVE_ALERT_PREVIEW_BY_DECISION: Record<
  LiveAlertDecision,
  { title: string; lines: string[]; ctaLabel: string }
> = {
  keep: {
    title: 'Stay with current plan',
    lines: ["We'll keep watching this stop."],
    ctaLabel: 'Confirm',
  },
  switch: {
    title: 'Swap Jazz Cellar for a nearby option',
    lines: ['Keeps the same role in your night.', '2 min away.'],
    ctaLabel: 'Apply swap',
  },
  timing: {
    title: 'Push this stop by 20 minutes',
    lines: ['Improves entry window.', 'Rest of route stays aligned.'],
    ctaLabel: 'Update timing',
  },
}

const LIVE_CONTINUATION_OPTIONS: Array<{
  id: LiveContinuationOptionId
  title: string
  description: string
  stops: JourneyContinuationStop[]
}> = [
  {
    id: 'stay-nearby',
    title: 'Stay nearby',
    description: 'Keep things local with one or two easy nearby beats.',
    stops: [
      {
        id: 'continue_stay_nearby_1',
        name: 'Alameda Late Kitchen',
        descriptor: 'Walkable nightcap with easy seating and soft energy.',
        coordinates: [-121.9256, 37.3235],
      },
      {
        id: 'continue_stay_nearby_2',
        name: 'Garden Patio Pour',
        descriptor: 'Low-key patio stop to keep the flow nearby.',
        coordinates: [-121.9237, 37.3221],
      },
    ],
  },
  {
    id: 'change-pace',
    title: 'Change the pace',
    description: 'Shift energy with a fresh district feel after the main arc.',
    stops: [
      {
        id: 'continue_change_pace_1',
        name: 'SoFa Vinyl Room',
        descriptor: 'A livelier late set to lift momentum again.',
        coordinates: [-121.8918, 37.3339],
      },
      {
        id: 'continue_change_pace_2',
        name: 'Market Street Social',
        descriptor: 'Crowd-forward lounge to close on a brighter note.',
        coordinates: [-121.8886, 37.3351],
      },
    ],
  },
  {
    id: 'ease-out',
    title: 'Ease out',
    description: 'Land softly with a calmer final beat before wrapping.',
    stops: [
      {
        id: 'continue_ease_out_1',
        name: 'Willow Quiet Bar',
        descriptor: 'Quieter corner for a slow final pour.',
        coordinates: [-121.9194, 37.3202],
      },
      {
        id: 'continue_ease_out_2',
        name: 'Late Dessert Counter',
        descriptor: 'Short, relaxed sweet finish before heading out.',
        coordinates: [-121.9168, 37.3189],
      },
    ],
  },
]

const WIND_DOWN_COORDINATES: [number, number] = [-121.9275, 37.3229]
const FALLBACK_COORDINATES_BY_ROLE: Record<UserStopRole, [number, number]> = {
  start: [-121.8947, 37.3358],
  highlight: [-121.8892, 37.3331],
  surprise: [-121.9078, 37.3292],
  windDown: [-121.9275, 37.3229],
}

function toTitleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getKnownForLine(stop: ItineraryStop): string {
  const priorityTags = stop.tags.filter((tag) =>
    ['jazz', 'cocktails', 'wine', 'dessert', 'chef-led', 'tasting', 'speakeasy', 'tea'].includes(
      tag.toLowerCase(),
    ),
  )
  const tags = (priorityTags.length > 0 ? priorityTags : stop.tags).slice(0, 2)
  if (tags.length > 0) {
    return `Known for ${tags.map((tag) => toTitleCase(tag)).join(' and ')}.`
  }
  if (stop.subcategory) {
    return `Known for its ${toTitleCase(stop.subcategory)} focus.`
  }
  return `Known for a strong local fit in ${stop.neighborhood}.`
}

function getLocalSignal(stop: ItineraryStop): string {
  const normalized = new Set(stop.tags.map((tag) => tag.toLowerCase()))
  if (
    ['reservations', 'reservation-recommended', 'book-ahead', 'bookings'].some((tag) =>
      normalized.has(tag),
    )
  ) {
    return 'Reservations recommended.'
  }
  if (
    ['late-night', 'night-owl', 'live', 'jazz', 'small-stage'].some((tag) => normalized.has(tag))
  ) {
    return 'Fills quickly after 9pm.'
  }
  if (['walk-up', 'quick-start', 'coffee', 'tea-room', 'dessert', 'gelato'].some((tag) => normalized.has(tag))) {
    return 'Easy to enter without long waits.'
  }
  return 'Steady local traffic through the evening.'
}

function getNearbyOptionDescriptor(category: JourneyNearbyOption['category']): string {
  if (category === 'nightlife') {
    return 'more lively'
  }
  if (category === 'dessert') {
    return 'slower pace'
  }
  if (category === 'cafe') {
    return 'more intimate'
  }
  return 'closer, easier stop'
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180
}

function estimateMinutesBetweenCoordinates(
  from: [number, number],
  to: [number, number],
): number {
  const [fromLng, fromLat] = from
  const [toLng, toLat] = to
  const earthRadiusMeters = 6371000
  const deltaLat = toRadians(toLat - fromLat)
  const deltaLng = toRadians(toLng - fromLng)
  const fromLatRadians = toRadians(fromLat)
  const toLatRadians = toRadians(toLat)
  const haversine =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(fromLatRadians) *
      Math.cos(toLatRadians) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2)
  const angularDistance = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  const distanceMeters = earthRadiusMeters * angularDistance
  const walkMetersPerMinute = 85
  return Math.max(1, Math.round(distanceMeters / walkMetersPerMinute))
}

function formatClockTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function toGoogleCalendarDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function toIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function toSharedPlanPath(planId: string): string {
  return `/p/${encodeURIComponent(planId)}`
}

function getRoleTravelWindow(
  itinerary: LiveArtifactSessionPayload['itinerary'],
  role: UserStopRole,
): number {
  const stopIndex = itinerary.stops.findIndex((stop) => stop.role === role)
  if (stopIndex < 0) {
    return 0
  }
  const before = stopIndex > 0 ? itinerary.transitions[stopIndex - 1]?.estimatedTravelMinutes ?? 0 : 0
  const after =
    stopIndex < itinerary.stops.length - 1
      ? itinerary.transitions[stopIndex]?.estimatedTravelMinutes ?? 0
      : 0
  return before + after
}

function toFinalRouteStopFromArtifact(stop: ItineraryStop, stopIndex: number): FinalRouteStop {
  const fallbackCoordinates = FALLBACK_COORDINATES_BY_ROLE[stop.role]
  return {
    id: stop.id,
    sourceStopId: stop.id,
    displayName: stop.venueName,
    providerRecordId: stop.venueId || stop.id,
    latitude: fallbackCoordinates[1],
    longitude: fallbackCoordinates[0],
    address: `${stop.neighborhood}, ${stop.city}`.replace(/^,\s*/, ''),
    role: stop.role,
    stopIndex,
    venueId: stop.venueId,
    title: stop.title,
    subtitle: stop.subtitle,
    neighborhood: stop.neighborhood,
    driveMinutes: stop.driveMinutes,
    imageUrl: stop.imageUrl,
  }
}

function buildFinalRouteFromArtifact(artifact: LiveArtifactSessionPayload): FinalRoute {
  const stops = artifact.itinerary.stops.map((stop, stopIndex) =>
    toFinalRouteStopFromArtifact(stop, stopIndex),
  )
  return {
    routeId: artifact.finalRoute?.routeId ?? `${artifact.itinerary.id}-live`,
    selectedDirectionId: artifact.finalRoute?.selectedDirectionId ?? artifact.itinerary.id,
    location: artifact.city,
    persona: artifact.finalRoute?.persona ?? artifact.itinerary.crew.persona,
    vibe: artifact.finalRoute?.vibe ?? artifact.itinerary.vibes[0] ?? 'lively',
    stops,
    activeStopIndex: Math.max(
      0,
      stops.findIndex((stop) => stop.role === artifact.initialActiveRole),
    ),
    routeHeadline: artifact.itinerary.story?.headline ?? artifact.itinerary.title,
    routeSummary: artifact.selectedClusterConfirmation,
    mapMarkers: stops.map((stop) => ({
      id: stop.id,
      displayName: stop.displayName,
      role: stop.role,
      stopIndex: stop.stopIndex,
      latitude: stop.latitude,
      longitude: stop.longitude,
    })),
    liveNotices: [],
    updatedAt: artifact.lockedAt,
  }
}

function buildFinalRouteMapMarkers(
  stops: FinalRouteStop[],
): FinalRoute['mapMarkers'] {
  return stops
    .slice()
    .sort((left, right) => left.stopIndex - right.stopIndex)
    .map((stop) => ({
      id: stop.id,
      displayName: stop.displayName,
      role: stop.role,
      stopIndex: stop.stopIndex,
      latitude: stop.latitude,
      longitude: stop.longitude,
    }))
}

function patchFinalRouteStop(params: {
  route: FinalRoute
  targetRole: UserStopRole
  targetStopId?: string
  targetStopIndex?: number
  replacementStop: FinalRouteStop
  notice?: string
  activeRole?: UserStopRole
}): {
  route: FinalRoute
  resolvedStop: FinalRouteStop
  resolution: 'id' | 'index' | 'role'
} | null {
  const orderedStops = params.route.stops
    .slice()
    .sort((left, right) => left.stopIndex - right.stopIndex)
  let replaceIndex = -1
  let resolution: 'id' | 'index' | 'role' | null = null
  if (params.targetStopId) {
    replaceIndex = orderedStops.findIndex((stop) => stop.id === params.targetStopId)
    if (replaceIndex >= 0) {
      resolution = 'id'
    }
  }
  if (replaceIndex < 0 && typeof params.targetStopIndex === 'number') {
    replaceIndex = orderedStops.findIndex((stop) => stop.stopIndex === params.targetStopIndex)
    if (replaceIndex >= 0) {
      resolution = 'index'
    }
  }
  if (replaceIndex < 0) {
    replaceIndex = orderedStops.findIndex((stop) => stop.role === params.targetRole)
    if (replaceIndex >= 0) {
      resolution = 'role'
    }
  }
  if (replaceIndex < 0 || !resolution) {
    return null
  }
  const currentStop = orderedStops[replaceIndex]
  if (!currentStop) {
    return null
  }
  const replacementStop: FinalRouteStop = {
    ...currentStop,
    ...params.replacementStop,
    title: currentStop.title,
    role: currentStop.role,
    stopIndex: currentStop.stopIndex,
  }
  const nextStops = orderedStops.map((stop, index) =>
    index === replaceIndex ? replacementStop : stop,
  )
  const nextActiveStopIndex =
    params.activeRole != null
      ? Math.max(0, nextStops.findIndex((stop) => stop.role === params.activeRole))
      : params.route.activeStopIndex
  return {
    route: {
      ...params.route,
      routeId: `${params.route.routeId}-swap-${Date.now()}`,
      stops: nextStops,
      activeStopIndex: nextActiveStopIndex,
      mapMarkers: buildFinalRouteMapMarkers(nextStops),
      liveNotices: params.notice
        ? [...(params.route.liveNotices ?? []), params.notice]
        : params.route.liveNotices,
      updatedAt: Date.now(),
    },
    resolvedStop: currentStop,
    resolution,
  }
}

function logSwapCommitChecks(
  route: FinalRoute,
  swappedRole: UserStopRole,
  surfaces: string[],
): void {
  if (!import.meta.env.DEV) {
    return
  }
  const stopNames = route.stops.map((stop) => stop.displayName)
  const stopIds = route.stops.map((stop) => stop.providerRecordId || stop.id)
  console.log('SWAP COMMIT CHECK', {
    routeId: route.routeId,
    swappedRole,
    stopNames,
    stopIds,
  })
  surfaces.forEach((surface) => {
    console.log('SURFACE ROUTE CHECK', {
      surface,
      routeId: route.routeId,
      stopNames,
    })
  })
}

export function LiveJourneyPage({ sharedPlanId }: LiveJourneyPageProps) {
  const [artifact] = useState<LiveArtifactSessionPayload | null>(() =>
    sharedPlanId ? loadSharedLiveArtifactPlan(sharedPlanId) : loadLiveArtifactSession(),
  )
  const [finalRoute, setFinalRoute] = useState<FinalRoute | null>(() => {
    if (!artifact) {
      return null
    }
    return artifact.finalRoute ?? buildFinalRouteFromArtifact(artifact)
  })
  const [activeRole, setActiveRole] = useState<UserStopRole>(artifact?.initialActiveRole ?? 'start')
  const [nearbySummaryByRole, setNearbySummaryByRole] = useState<Partial<Record<UserStopRole, string>>>(
    {},
  )
  const [nearbyOptionsByRole, setNearbyOptionsByRole] = useState<
    Partial<Record<UserStopRole, JourneyNearbyOption[]>>
  >({})
  const [liveAlertStage, setLiveAlertStage] = useState<LiveAlertStage>('idle')
  const [liveAlertDecision, setLiveAlertDecision] = useState<LiveAlertDecision | null>(null)
  const [liveAppliedDecision, setLiveAppliedDecision] = useState<LiveAlertDecision | null>(null)
  const [selectedSwitchNearbyOption, setSelectedSwitchNearbyOption] =
    useState<JourneyNearbyOption | null>(null)
  const [liveAppliedSwitchOption, setLiveAppliedSwitchOption] = useState<JourneyNearbyOption | null>(
    null,
  )
  const [selectedContinuationOptionId, setSelectedContinuationOptionId] =
    useState<LiveContinuationOptionId | null>(null)
  const [previewContinuationOptionId, setPreviewContinuationOptionId] =
    useState<LiveContinuationOptionId | null>(null)
  const [continuationStops, setContinuationStops] = useState<JourneyContinuationStop[]>([])
  const [planDetailsOpen, setPlanDetailsOpen] = useState(false)
  const [utilityModal, setUtilityModal] = useState<LiveUtilityModal>(null)
  const [shareFeedback, setShareFeedback] = useState<string | null>(null)
  const [sharePlanId, setSharePlanId] = useState<string | null>(sharedPlanId ?? null)
  const isDevLive =
    typeof window !== 'undefined' && window.location.pathname.toLowerCase().startsWith('/dev')
  const routeItineraryStops = useMemo(() => {
    if (!artifact || !finalRoute) {
      return [] as ItineraryStop[]
    }
    const sourceStopById = new Map(artifact.itinerary.stops.map((stop) => [stop.id, stop] as const))
    const sourceStopByRole = new Map(
      artifact.itinerary.stops.map((stop) => [stop.role, stop] as const),
    )
    const fallbackSourceStop = artifact.itinerary.stops[0]
    return finalRoute.stops
      .slice()
      .filter((finalStop) => finalStop.role !== 'surprise')
      .sort((left, right) => left.stopIndex - right.stopIndex)
      .map((finalStop) => {
        const sourceStop =
          sourceStopById.get(finalStop.sourceStopId) ??
          sourceStopByRole.get(finalStop.role) ??
          fallbackSourceStop
        if (!sourceStop || !finalStop.displayName.trim()) {
          return null
        }
        return {
          ...sourceStop,
          id: finalStop.sourceStopId || sourceStop.id,
          role: finalStop.role,
          title: finalStop.title || sourceStop.title,
          venueId: finalStop.venueId || sourceStop.venueId,
          venueName: finalStop.displayName,
          city: finalRoute.location || sourceStop.city,
          subtitle: finalStop.subtitle || sourceStop.subtitle,
          neighborhood: finalStop.neighborhood || sourceStop.neighborhood,
          driveMinutes: finalStop.driveMinutes ?? sourceStop.driveMinutes,
          imageUrl: finalStop.imageUrl || sourceStop.imageUrl,
        }
      })
      .filter((stop): stop is ItineraryStop => Boolean(stop))
  }, [artifact, finalRoute])

  const handleNearbySummaryChange = useCallback(
    (role: UserStopRole, summary: string | null) => {
      setNearbySummaryByRole((current) => {
        if (!summary) {
          if (!(role in current)) {
            return current
          }
          const next = { ...current }
          delete next[role]
          return next
        }
        if (current[role] === summary) {
          return current
        }
        return {
          ...current,
          [role]: summary,
        }
      })
    },
    [],
  )

  const handleNearbyOptionsChange = useCallback(
    (role: UserStopRole, options: JourneyNearbyOption[]) => {
      setNearbyOptionsByRole((current) => {
        const nextOptions = options.slice(0, 3)
        const existing = current[role] ?? []
        if (
          existing.length === nextOptions.length &&
          existing.every(
            (option, index) =>
              option.id === nextOptions[index]?.id &&
              option.minutesAway === nextOptions[index]?.minutesAway &&
              option.category === nextOptions[index]?.category,
          )
        ) {
          return current
        }
        return {
          ...current,
          [role]: nextOptions,
        }
      })
    },
    [],
  )

  const switchNearbyOptions = (nearbyOptionsByRole.highlight ?? []).slice(0, 3)
  const originalHighlightStop = routeItineraryStops.find((stop) => stop.role === 'highlight') ?? null

  useEffect(() => {
    if (!artifact) {
      return
    }
    if (liveAppliedDecision) {
      return
    }
    if (liveAlertStage !== 'idle') {
      return
    }
    const timer = window.setTimeout(() => {
      setLiveAlertStage('alert')
      setLiveAlertDecision(null)
      setSelectedSwitchNearbyOption(null)
      setActiveRole('highlight')
      setPlanDetailsOpen(true)
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [artifact, liveAlertStage, liveAppliedDecision])

  useEffect(() => {
    if (liveAlertStage !== 'resolved') {
      return
    }
    const timer = window.setTimeout(() => {
      setLiveAlertStage('idle')
    }, 2400)
    return () => window.clearTimeout(timer)
  }, [liveAlertStage])

  useEffect(() => {
    if (!shareFeedback) {
      return
    }
    const timer = window.setTimeout(() => {
      setShareFeedback(null)
    }, 2200)
    return () => window.clearTimeout(timer)
  }, [shareFeedback])
  useEffect(() => {
    if (!import.meta.env.DEV || !finalRoute) {
      return
    }
    console.log('ROUTE TRUTH CHECK', {
      routeId: finalRoute.routeId,
      selectedDirectionId: finalRoute.selectedDirectionId,
      stopNames: finalRoute.stops.map((stop) => stop.displayName),
      stopRoles: finalRoute.stops.map((stop) => stop.role),
      stopIds: finalRoute.stops.map((stop) => stop.id || stop.providerRecordId),
    })
    console.log('ROUTE SURFACE CHECK: live-map', { routeId: finalRoute.routeId })
    console.log('ROUTE SURFACE CHECK: live-spine', { routeId: finalRoute.routeId })
    console.log('ROUTE SURFACE CHECK: live-share', { routeId: finalRoute.routeId })
    console.log('ROUTE SURFACE CHECK: live-calendar', { routeId: finalRoute.routeId })
  }, [finalRoute])
  useEffect(() => {
    if (!artifact || !finalRoute || routeItineraryStops.length === 0) {
      return
    }
    saveLiveArtifactSession({
      ...artifact,
      initialActiveRole: activeRole,
      finalRoute,
      itinerary: {
        ...artifact.itinerary,
        stops: routeItineraryStops,
      },
    })
  }, [activeRole, artifact, finalRoute, routeItineraryStops])

  const handleLiveAlertDecision = (decision: LiveAlertDecision) => {
    setActiveRole('highlight')
    setPlanDetailsOpen(true)
    if (decision !== 'switch') {
      setSelectedSwitchNearbyOption(null)
    }
    setLiveAlertDecision(decision)
    setLiveAlertStage('preview')
  }

  const handlePreviewAlternativeFromCard = (role: UserStopRole, venueId: string) => {
    if (role !== 'highlight') {
      return
    }
    const option = switchNearbyOptions.find((candidate) => candidate.id === venueId)
    if (!option) {
      return
    }
    setSelectedSwitchNearbyOption(option)
    setLiveAlertDecision('switch')
    setLiveAlertStage('preview')
  }

  const handlePreviewDecisionActionFromCard = (
    role: UserStopRole,
    decision: 'keep' | 'timing',
  ) => {
    if (role !== 'highlight') {
      return
    }
    handleLiveAlertDecision(decision)
  }

  const handleSelectContinuationOption = (optionId: LiveContinuationOptionId) => {
    const selectedOption = LIVE_CONTINUATION_OPTIONS.find((option) => option.id === optionId)
    if (!selectedOption) {
      return
    }
    setPreviewContinuationOptionId(selectedOption.id)
  }

  const handleConfirmContinuationOption = () => {
    if (!previewContinuationOptionId) {
      return
    }
    const selectedOption = LIVE_CONTINUATION_OPTIONS.find(
      (option) => option.id === previewContinuationOptionId,
    )
    if (!selectedOption) {
      setPreviewContinuationOptionId(null)
      return
    }
    setSelectedContinuationOptionId(selectedOption.id)
    setContinuationStops(selectedOption.stops.slice(0, 2))
    setPlanDetailsOpen(true)
    setActiveRole('windDown')
    setPreviewContinuationOptionId(null)
  }

  const handleCloseContinuationPreview = () => {
    setPreviewContinuationOptionId(null)
  }

  const handleDonePlanning = () => {
    const sharedId = persistSharedPlan()
    const mapPath = isDevLive
      ? '/dev/live'
      : sharedId
        ? toSharedPlanPath(sharedId)
        : '/journey/live'
    saveLiveArtifactHomeState({
      city: finalRoute?.location ?? artifact.city,
      mapPath,
    })
    window.location.assign(isDevLive ? '/dev/plans' : '/home')
  }

  const handleOpenShareModal = () => {
    setShareFeedback(null)
    persistSharedPlan()
    setUtilityModal('share')
  }

  const handleOpenCalendarModal = () => {
    setUtilityModal('calendar')
  }

  const handleCloseUtilityModal = () => {
    setShareFeedback(null)
    setUtilityModal(null)
  }

  const handleConfirmLiveAlertDecision = () => {
    if (!liveAlertDecision) {
      return
    }
    if (liveAlertDecision === 'switch') {
      setLiveAppliedSwitchOption(selectedSwitchNearbyOption)
      if (selectedSwitchNearbyOption) {
        setFinalRoute((current) => {
          if (!current) {
            return current
          }
          const currentHighlightStop = current.stops.find((stop) => stop.role === 'highlight')
          if (!currentHighlightStop) {
            return current
          }
          const replacementStop: FinalRouteStop = {
            ...currentHighlightStop,
            displayName: selectedSwitchNearbyOption.name,
            providerRecordId: selectedSwitchNearbyOption.id,
            latitude: selectedSwitchNearbyOption.coordinates[1],
            longitude: selectedSwitchNearbyOption.coordinates[0],
            address: `${currentHighlightStop.neighborhood || current.location}, ${current.location}`.replace(
              /^,\s*/,
              '',
            ),
            subtitle: `${getNearbyOptionDescriptor(selectedSwitchNearbyOption.category)} · ${selectedSwitchNearbyOption.minutesAway} min away`,
          }
          const patchedRoute = patchFinalRouteStop({
            route: current,
            targetRole: 'highlight',
            targetStopId: currentHighlightStop.id,
            targetStopIndex: currentHighlightStop.stopIndex,
            replacementStop,
            notice: `Highlight switched to ${selectedSwitchNearbyOption.name}.`,
            activeRole: 'highlight',
          })
          if (!patchedRoute) {
            return current
          }
          if (import.meta.env.DEV) {
            console.log('SWAP TARGET CHECK', {
              routeId: current.routeId,
              modalTargetStopId: currentHighlightStop.id,
              modalTargetRole: 'highlight',
              modalTargetStopIndex: currentHighlightStop.stopIndex,
              resolvedStopId: patchedRoute.resolvedStop.id,
              resolvedRole: patchedRoute.resolvedStop.role,
              resolvedStopIndex: patchedRoute.resolvedStop.stopIndex,
            })
          }
          if (
            patchedRoute.resolvedStop.role !== 'highlight' ||
            patchedRoute.resolvedStop.stopIndex !== currentHighlightStop.stopIndex
          ) {
            console.error('Live swap aborted due to target mismatch.', {
              routeId: current.routeId,
              expectedRole: 'highlight',
              expectedStopIndex: currentHighlightStop.stopIndex,
              resolvedRole: patchedRoute.resolvedStop.role,
              resolvedStopIndex: patchedRoute.resolvedStop.stopIndex,
              resolution: patchedRoute.resolution,
            })
            return current
          }
          logSwapCommitChecks(patchedRoute.route, 'highlight', [
            'live',
            'map',
            'spine',
            'share',
            'calendar',
          ])
          return patchedRoute.route
        })
      }
    } else {
      setLiveAppliedSwitchOption(null)
    }
    setLiveAppliedDecision(liveAlertDecision)
    setSelectedSwitchNearbyOption(null)
    setLiveAlertDecision(null)
    setLiveAlertStage('resolved')
  }

  const handleBackFromLiveAlertPreview = () => {
    setLiveAlertDecision(null)
    setSelectedSwitchNearbyOption(null)
    setPlanDetailsOpen(true)
    setActiveRole('highlight')
    setLiveAlertStage('alert')
  }

  const inlineDetailsByRole = useMemo(() => {
    if (!artifact) {
      return {}
    }
    return Object.fromEntries(
      routeItineraryStops.map((stop) => {
        const next: {
          whyItFits: string
          knownFor: string
          goodToKnow: string
          localSignal: string
          alertSignal?: string
          decisionActions?: Array<{
            id: 'keep' | 'timing'
            label: string
          }>
          tonightSignals?: string[]
          aroundHereSignals?: string[]
          alternatives?: Array<{
            venueId: string
            name: string
            descriptor: string
            distanceLabel?: string
            replacementContext?: string
          }>
        } = {
          whyItFits:
            stop.selectedBecause?.trim() ||
            `Anchored as your ${stop.title.toLowerCase()} beat without breaking route flow.`,
          knownFor: getKnownForLine(stop),
          goodToKnow: 'Kept aligned with nearby pacing and transition timing.',
          localSignal: getLocalSignal(stop),
          tonightSignals: buildTonightSignals({
            stop,
            roleTravelWindowMinutes: getRoleTravelWindow(artifact.itinerary, stop.role),
            nearbySummary: nearbySummaryByRole[stop.role],
            nearbyOptionsCount: nearbyOptionsByRole[stop.role]?.length ?? 0,
          }),
        }
        const nearbySummary = nearbySummaryByRole[stop.role]
        if (nearbySummary) {
          next.aroundHereSignals = [nearbySummary]
        }
        if (stop.role === 'highlight' && liveAlertStage === 'alert') {
          next.alertSignal = '⚠️ This stop is getting busy'
          next.decisionActions = [
            { id: 'keep', label: 'Keep current plan' },
            { id: 'timing', label: 'Go later (~20 min)' },
          ]
          next.alternatives = switchNearbyOptions.map((option) => ({
            venueId: option.id,
            name: option.name,
            descriptor: getNearbyOptionDescriptor(option.category),
            distanceLabel: `${option.minutesAway} min away`,
            replacementContext: originalHighlightStop?.venueName ?? stop.venueName,
          }))
        }
        if (stop.role === 'highlight' && liveAppliedDecision) {
          if (liveAppliedDecision === 'keep') {
            next.localSignal = "We'll keep watching this stop."
          } else if (liveAppliedDecision === 'switch') {
            next.whyItFits = 'Same highlight role, same vibe, minimal disruption.'
            if (liveAppliedSwitchOption) {
              next.localSignal = `Swapped to ${liveAppliedSwitchOption.name} (${liveAppliedSwitchOption.minutesAway} min away).`
            } else {
              next.localSignal = 'Nearby highlight swap selected (mock) - 2 min away.'
            }
          } else if (liveAppliedDecision === 'timing') {
            next.tonightSignals = [
              'Shifted +20 min to improve the entry window.',
              ...((next.tonightSignals ?? []).slice(0, 1)),
            ]
          }
        }
        return [stop.role, next]
      }),
    ) as Partial<
      Record<
        UserStopRole,
        {
          whyItFits: string
          tonightSignals?: string[]
          aroundHereSignals?: string[]
          knownFor: string
          goodToKnow: string
          localSignal?: string
          alertSignal?: string
          decisionActions?: Array<{
            id: 'keep' | 'timing'
            label: string
          }>
          alternatives?: Array<{
            venueId: string
            name: string
            descriptor: string
            distanceLabel?: string
            replacementContext?: string
          }>
        }
      >
    >
  }, [
    artifact,
    liveAlertStage,
    liveAppliedDecision,
    liveAppliedSwitchOption,
    nearbySummaryByRole,
    originalHighlightStop?.venueName,
    routeItineraryStops,
    switchNearbyOptions,
  ])

  const continuationEntries = useMemo(
    () =>
      continuationStops.map((stop) => ({
        id: stop.id,
        title: stop.name,
        descriptor: stop.descriptor,
      })),
    [continuationStops],
  )

  const routeMoments = useMemo(() => {
    if (!artifact || !finalRoute) {
      return []
    }
    const orderedStops = [...finalRoute.stops].sort((left, right) => left.stopIndex - right.stopIndex)
    return orderedStops.map((stop, index) => ({
      id: stop.id,
      roleLabel: stop.title,
      name: stop.displayName,
      descriptor: stop.subtitle,
      durationMinutes: 45,
      travelToNextMinutes:
        artifact.itinerary.transitions[index]?.estimatedTransitionMinutes ??
        (index < orderedStops.length - 1 ? 8 : 0),
    }))
  }, [artifact, finalRoute])

  const calendarTimeline = useMemo(() => {
    if (!artifact || routeMoments.length === 0) {
      return []
    }
    const startBase = new Date(artifact.lockedAt || Date.now())
    startBase.setMinutes(0, 0, 0)
    if (startBase.getHours() < 17) {
      startBase.setHours(19, 0, 0, 0)
    }
    let cursor = startBase.getTime()
    return routeMoments.map((moment) => {
      const start = new Date(cursor)
      const end = new Date(cursor + moment.durationMinutes * 60000)
      const timeLabel = `${formatClockTime(start)} - ${formatClockTime(end)}`
      cursor = end.getTime() + moment.travelToNextMinutes * 60000
      return {
        ...moment,
        start,
        end,
        timeLabel,
      }
    })
  }, [artifact, routeMoments])

  const shareTitle = `Your night in ${finalRoute?.location ?? artifact.city}`
  const shareStopsText = routeMoments
    .map((moment, index) => `${index + 1}. ${moment.roleLabel}: ${moment.name}`)
    .join('\n')
  const shareText = `${shareTitle}\n${shareStopsText}`
  const shareArtifactPayload = useMemo<LiveArtifactSessionPayload | null>(() => {
    if (!artifact || !finalRoute) {
      return null
    }
    return {
      ...artifact,
      initialActiveRole: activeRole,
      finalRoute,
      itinerary: {
        ...artifact.itinerary,
        stops: routeItineraryStops,
      },
    }
  }, [activeRole, artifact, finalRoute, routeItineraryStops])

  const persistSharedPlan = useCallback((): string | null => {
    if (!shareArtifactPayload) {
      return null
    }
    const nextPlanId = sharePlanId ?? createLiveArtifactPlanId()
    saveSharedLiveArtifactPlan(nextPlanId, shareArtifactPayload)
    if (sharePlanId !== nextPlanId) {
      setSharePlanId(nextPlanId)
    }
    return nextPlanId
  }, [shareArtifactPayload, sharePlanId])

  const buildShareUrl = useCallback((): string | null => {
    const nextPlanId = persistSharedPlan()
    if (!nextPlanId) {
      return null
    }
    const path = toSharedPlanPath(nextPlanId)
    return typeof window !== 'undefined' ? `${window.location.origin}${path}` : path
  }, [persistSharedPlan])

  const shareUrl = useMemo(() => {
    if (!sharePlanId) {
      return typeof window !== 'undefined'
        ? `${window.location.origin}/journey/live`
        : '/journey/live'
    }
    const path = toSharedPlanPath(sharePlanId)
    return typeof window !== 'undefined' ? `${window.location.origin}${path}` : path
  }, [sharePlanId])
  const copyButtonLabel = shareFeedback === 'Copied' ? 'Copied' : 'Copy link'

  const googleCalendarUrl = useMemo(() => {
    if (calendarTimeline.length === 0) {
      return '#'
    }
    const firstEntry = calendarTimeline[0]
    const lastEntry = calendarTimeline[calendarTimeline.length - 1]
    const details = calendarTimeline
      .map((entry) => `${entry.timeLabel} - ${entry.roleLabel}: ${entry.name}`)
      .join('\n')
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      shareTitle,
    )}&dates=${toGoogleCalendarDate(firstEntry.start)}/${toGoogleCalendarDate(
      lastEntry.end,
    )}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(
      finalRoute?.location ?? artifact.city,
    )}`
  }, [artifact.city, calendarTimeline, finalRoute?.location, shareTitle])

  const calendarIcsContent = useMemo(() => {
    if (calendarTimeline.length === 0) {
      return ''
    }
    const escapeIcs = (value: string) =>
      value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
    const firstEntry = calendarTimeline[0]
    const lastEntry = calendarTimeline[calendarTimeline.length - 1]
    const details = calendarTimeline
      .map((entry) => `${entry.timeLabel} - ${entry.roleLabel}: ${entry.name}`)
      .join('\\n')
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ID8//Live Journey//EN',
      'BEGIN:VEVENT',
      `UID:id8-live-${artifact.lockedAt}@id8`,
      `DTSTAMP:${toIcsDate(new Date())}`,
      `DTSTART:${toIcsDate(firstEntry.start)}`,
      `DTEND:${toIcsDate(lastEntry.end)}`,
      `SUMMARY:${escapeIcs(shareTitle)}`,
      `DESCRIPTION:${escapeIcs(details)}`,
      `LOCATION:${escapeIcs(finalRoute?.location ?? artifact.city)}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
  }, [artifact.city, artifact.lockedAt, calendarTimeline, finalRoute?.location, shareTitle])

  const mapRouteStops = useMemo(
    () =>
      finalRoute
        ? finalRoute.stops
            .slice()
            .sort((left, right) => left.stopIndex - right.stopIndex)
            .map((stop) => ({
              id: stop.id,
              role: stop.role,
              name: stop.displayName,
              displayName: stop.displayName,
              stopIndex: stop.stopIndex,
              latitude: stop.latitude,
              longitude: stop.longitude,
            }))
        : [],
    [finalRoute],
  )
  useEffect(() => {
    if (!import.meta.env.DEV || !finalRoute) {
      return
    }
    const activeMapStop = mapRouteStops.find((stop) => stop.role === activeRole) ?? mapRouteStops[0]
    const activeMapStopIndex =
      typeof activeMapStop?.stopIndex === 'number'
        ? activeMapStop.stopIndex
        : mapRouteStops.findIndex((stop) => stop.id === activeMapStop?.id)
    console.log('MAP REFRESH CHECK', {
      routeId: finalRoute.routeId,
      activeStopId: activeMapStop?.id ?? null,
      activeStopIndex: activeMapStopIndex >= 0 ? activeMapStopIndex : null,
      mapStopNames: mapRouteStops.map((stop) => stop.displayName || stop.name),
    })
  }, [activeRole, finalRoute, mapRouteStops])

  const mapWaypointOverrides = useMemo(() => {
    return undefined
  }, [])

  const selectedNearbyPlaceIdByRole = useMemo(() => {
    return undefined
  }, [])

  const liveAlertPreview = useMemo(() => {
    if (!liveAlertDecision) {
      return null
    }
    if (liveAlertDecision === 'switch') {
      return null
    }
    return LIVE_ALERT_PREVIEW_BY_DECISION[liveAlertDecision]
  }, [liveAlertDecision])

  const liveSwapPreview = useMemo(() => {
    if (
      liveAlertStage !== 'preview' ||
      liveAlertDecision !== 'switch' ||
      !selectedSwitchNearbyOption
    ) {
      return null
    }

    const descriptor = getNearbyOptionDescriptor(selectedSwitchNearbyOption.category)
    const distanceLine = `${descriptor} · ${selectedSwitchNearbyOption.minutesAway} min away`
    const currentHighlightName = originalHighlightStop?.venueName ?? 'Theatre District Jazz Cellar'
    const currentRoleLabel = originalHighlightStop?.title ?? 'Highlight'
    const locationLine = `${originalHighlightStop?.neighborhood ?? 'Downtown San Jose'} | about ${selectedSwitchNearbyOption.minutesAway} min | ${originalHighlightStop?.driveMinutes ?? 6} min out`
    const pacingShift =
      selectedSwitchNearbyOption.minutesAway <= 4
        ? 'Slightly faster handoff into your peak moment.'
        : 'Slightly later handoff into your peak moment.'
    const travelImpact = `${selectedSwitchNearbyOption.minutesAway} min from your current highlight anchor.`
    const vibeShift =
      selectedSwitchNearbyOption.category === 'nightlife'
        ? 'Energy stays high with a similar nightlife feel.'
        : selectedSwitchNearbyOption.category === 'dessert'
          ? 'Energy softens slightly while keeping the highlight role.'
          : selectedSwitchNearbyOption.category === 'cafe'
            ? 'A calmer highlight with conversational pacing.'
            : 'Similar local energy with a nearby pivot.'

    return {
      name: selectedSwitchNearbyOption.name,
      imageUrl:
        originalHighlightStop?.imageUrl ?? routeItineraryStops[0]?.imageUrl ?? '',
      roleChip: currentRoleLabel,
      distanceLine,
      roleLine: `This becomes your new ${currentRoleLabel}`,
      replacesLine: `Replaces: ${currentHighlightName}`,
      locationLine,
      whyItFits:
        inlineDetailsByRole.highlight?.whyItFits ??
        'Same role, same route intent, with minimal disruption.',
      knownFor:
        inlineDetailsByRole.highlight?.knownFor ??
        'Known for a strong local fit in this district.',
      localSignal:
        inlineDetailsByRole.highlight?.localSignal ??
        'Local traffic remains steady through this window.',
      whatChanges: [pacingShift, travelImpact, vibeShift],
    }
  }, [
    artifact,
    inlineDetailsByRole,
    liveAlertDecision,
    liveAlertStage,
    originalHighlightStop?.driveMinutes,
    originalHighlightStop?.imageUrl,
    originalHighlightStop?.neighborhood,
    originalHighlightStop?.title,
    originalHighlightStop?.venueName,
    routeItineraryStops,
    selectedSwitchNearbyOption,
  ])

  const liveContinuationPreview = useMemo(() => {
    if (!previewContinuationOptionId) {
      return null
    }
    const selectedOption = LIVE_CONTINUATION_OPTIONS.find(
      (option) => option.id === previewContinuationOptionId,
    )
    if (!selectedOption) {
      return null
    }

    const firstStop = selectedOption.stops[0]
    if (!firstStop) {
      return null
    }
    const lastStop = selectedOption.stops[selectedOption.stops.length - 1] ?? firstStop
    const minutesFromWindDown = estimateMinutesBetweenCoordinates(
      WIND_DOWN_COORDINATES,
      firstStop.coordinates,
    )
    const durationExtensionLine =
      selectedOption.stops.length > 1
        ? 'Adds about 60-90 minutes to your night.'
        : 'Adds about 30-45 minutes to your night.'
    const travelImpactLine = `First add-on stop is about ${minutesFromWindDown} min from your wind-down.`
    const energyShiftLine =
      selectedOption.id === 'change-pace'
        ? 'Energy lifts again with a brighter late stretch.'
        : selectedOption.id === 'ease-out'
          ? 'Energy softens further for a calmer finish.'
          : 'Energy stays steady with a nearby continuation.'
    const whyItFitsLine =
      selectedOption.id === 'change-pace'
        ? 'Adds a fresh second wind while keeping your route coherent.'
        : selectedOption.id === 'ease-out'
          ? 'Extends gently without breaking your current pace.'
          : 'Keeps momentum local with minimal travel overhead.'

    return {
      title: selectedOption.title,
      name: firstStop.name,
      descriptor: firstStop.descriptor,
      distanceLine: `${minutesFromWindDown} min away from wind-down`,
      addsLine: "Adds 1-2 stops after your wind-down",
      whyItFits: whyItFitsLine,
      knownFor: `Continuation mode: ${selectedOption.title.toLowerCase()}.`,
      localSignal: 'Built from nearby context already on your map.',
      whatChanges: [
        durationExtensionLine,
        travelImpactLine,
        energyShiftLine,
        'Original three-stop route remains intact.',
      ],
      finalStopLine:
        selectedOption.stops.length > 1 ? `You'll end here instead: ${lastStop.name}` : null,
      imageUrl: routeItineraryStops[2]?.imageUrl ?? routeItineraryStops[0]?.imageUrl ?? '',
    }
  }, [previewContinuationOptionId, routeItineraryStops])

  const handleCopyShareLink = useCallback(async () => {
    const nextShareUrl = buildShareUrl()
    if (!nextShareUrl) {
      setShareFeedback('Unable to create share link')
      return
    }
    try {
      await navigator.clipboard.writeText(nextShareUrl)
      setShareFeedback('Copied')
    } catch {
      setShareFeedback('Unable to copy link on this device')
    }
  }, [buildShareUrl])

  const handleNativeShare = useCallback(async () => {
    const nextShareUrl = buildShareUrl()
    if (!nextShareUrl) {
      setShareFeedback('Unable to create share link')
      return
    }
    if (!navigator.share) {
      await handleCopyShareLink()
      return
    }
    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: nextShareUrl,
      })
      setShareFeedback('Shared')
    } catch {
      setShareFeedback('Share canceled')
    }
  }, [buildShareUrl, handleCopyShareLink, shareText, shareTitle])

  const handleDownloadIcs = useCallback(() => {
    if (!calendarIcsContent) {
      return
    }
    const file = new Blob([calendarIcsContent], { type: 'text/calendar;charset=utf-8' })
    const url = window.URL.createObjectURL(file)
    const anchor = document.createElement('a')
    const slug = (finalRoute?.location ?? artifact.city).toLowerCase().replace(/[^a-z0-9]+/g, '-')
    anchor.href = url
    anchor.download = `id8-night-${slug || 'live'}.ics`
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.URL.revokeObjectURL(url)
  }, [artifact.city, calendarIcsContent, finalRoute?.location])

  const isAlertActive = liveAlertStage === 'alert' || liveAlertStage === 'preview'
  const liveHeaderStatus = isAlertActive ? 'Adjusting in real time' : 'In motion'

  if (!artifact) {
    return (
      <PageShell title="Live Journey" subtitle="No active artifact found">
        <div className="demo-flow-frame">
          <div className="preview-notice draft-feedback">
            <p className="preview-notice-title">
              {sharedPlanId ? 'Shared plan not found' : 'No live artifact yet'}
            </p>
            <p className="preview-notice-copy">
              {sharedPlanId
                ? 'This shared link is unavailable on this device.'
                : 'Lock a night from concierge first, then come back here.'}
            </p>
          </div>
          <div className="action-row draft-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => window.location.assign(isDevLive ? '/dev/home' : sharedPlanId ? '/home' : '/')}
            >
              {isDevLive ? 'Go to sandbox home' : sharedPlanId ? 'Go to home' : 'Go to planner'}
            </button>
          </div>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell
      topSlot={<ID8Butler message="Live artifact active. Co-pilot is watching your route." />}
      title="Live Journey Artifact"
      subtitle="Active route handoff"
    >
      <div className="demo-flow-frame live-artifact-page">
        <section className="plan-reveal live-artifact-surface">
          <div className="live-artifact-top-actions">
            <button type="button" className="ghost-button subtle" onClick={handleDonePlanning}>
              Done planning
            </button>
          </div>

          <div className="confirm-night-header live-artifact-header is-live">
            <h2>Your night &mdash; live</h2>
            <p>
              {finalRoute?.location ?? artifact.city} &middot; Tonight
            </p>
            <p className="live-artifact-status">{liveHeaderStatus}</p>
          </div>

          <p className="preview-notice-copy">
            {finalRoute?.routeSummary ?? artifact.selectedClusterConfirmation}
          </p>

          <div className="artifact-map-layer is-live">
            <JourneyMapReal
              key={`live-route-${finalRoute?.routeId ?? 'none'}`}
              activeRole={activeRole}
              onNearbySummaryChange={handleNearbySummaryChange}
              onNearbyOptionsChange={handleNearbyOptionsChange}
              routeStops={mapRouteStops}
              waypointOverrides={mapWaypointOverrides}
              selectedNearbyPlaceIdByRole={selectedNearbyPlaceIdByRole}
              continuationStops={continuationStops}
              alertActive={isAlertActive}
              alertRole={isAlertActive ? 'highlight' : null}
            />
          </div>

          <section className={`lce-system-layer is-live stage-${liveAlertStage}`} aria-live="polite">
            <p className="lce-system-strip">[ LIVE CO-PILOT &mdash; ACTIVE ]</p>
            {liveAlertStage === 'idle' && (
              <p className="lce-system-idle">We&apos;re keeping an eye on your route</p>
            )}

            {liveAlertStage === 'alert' && (
              <article className="lce-alert-card">
                <h3>Something changed near your next stop</h3>
                <p className="lce-alert-copy">Theatre District Jazz Cellar is getting busy.</p>
                <p className="lce-alert-support">Open the Highlight stop below to review options.</p>
              </article>
            )}

            {liveAlertStage === 'preview' && liveAlertPreview && (
              <article className="lce-alert-card preview">
                <p className="lce-alert-kicker">Decision preview</p>
                <h3>{liveAlertPreview.title}</h3>
                {liveAlertPreview.lines.map((line) => (
                  <p key={line} className="lce-alert-support">
                    {line}
                  </p>
                ))}
                <div className="lce-alert-actions">
                  <button
                    type="button"
                    className="ghost-button lce-action-button"
                    onClick={handleBackFromLiveAlertPreview}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="ghost-button lce-action-button"
                    onClick={handleConfirmLiveAlertDecision}
                  >
                    {liveAlertPreview.ctaLabel}
                  </button>
                </div>
              </article>
            )}

            {liveAlertStage === 'resolved' && (
              <div className="preview-notice draft-feedback live-resolved-state">
                <p className="preview-notice-title">Updated</p>
                <p className="preview-notice-copy">Your night is still on track.</p>
              </div>
            )}
          </section>

          {liveSwapPreview && (
            <div
              className="swap-preview-overlay"
              onClick={handleBackFromLiveAlertPreview}
              role="presentation"
            >
              <article
                className="swap-preview-popout"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="swap-preview-header">
                  <p className="swap-preview-kicker">Preview change</p>
                  <button
                    type="button"
                    className="ghost-button subtle"
                    onClick={handleBackFromLiveAlertPreview}
                  >
                    Close
                  </button>
                </div>

                <div className="swap-preview-card">
                  <div className="swap-preview-image-wrap">
                    <img src={liveSwapPreview.imageUrl} alt={liveSwapPreview.name} />
                  </div>
                  <div className="swap-preview-body">
                    <span className="reveal-story-chip active">{liveSwapPreview.roleChip}</span>
                    <h3>{liveSwapPreview.name}</h3>
                    <p className="swap-preview-descriptor">{liveSwapPreview.distanceLine}</p>
                    <p className="stop-card-meta">{liveSwapPreview.locationLine}</p>
                    <p className="swap-preview-descriptor">{liveSwapPreview.roleLine}</p>
                    <p className="swap-preview-descriptor">{liveSwapPreview.replacesLine}</p>

                    <div className="stop-card-inline-detail-row">
                      <p className="stop-card-inline-detail-label">Why it fits</p>
                      <p className="stop-card-inline-detail-copy">{liveSwapPreview.whyItFits}</p>
                    </div>
                    <div className="stop-card-inline-detail-row">
                      <p className="stop-card-inline-detail-label">Known for</p>
                      <p className="stop-card-inline-detail-copy">{liveSwapPreview.knownFor}</p>
                    </div>
                    <div className="stop-card-inline-detail-row">
                      <p className="stop-card-inline-detail-label">Local signal</p>
                      <p className="stop-card-inline-detail-copy">{liveSwapPreview.localSignal}</p>
                    </div>

                    <div className="swap-preview-impact">
                      <p className="stop-card-inline-detail-label">What changes in your night</p>
                      <ul className="swap-preview-impact-list">
                        {liveSwapPreview.whatChanges.map((changeLine) => (
                          <li key={changeLine}>{changeLine}</li>
                        ))}
                      </ul>
                    </div>
                    <p className="swap-preview-reassure">The rest of your route stays stable.</p>

                    <div className="swap-preview-actions">
                      <div className="action-row">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={handleBackFromLiveAlertPreview}
                        >
                          Keep current
                        </button>
                        <button
                          type="button"
                          className="primary-button"
                          onClick={handleConfirmLiveAlertDecision}
                        >
                          Use this instead
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          )}

          {liveContinuationPreview && (
            <div
              className="swap-preview-overlay"
              onClick={handleCloseContinuationPreview}
              role="presentation"
            >
              <article
                className="swap-preview-popout"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="swap-preview-header">
                  <p className="swap-preview-kicker">Preview continuation</p>
                  <button
                    type="button"
                    className="ghost-button subtle"
                    onClick={handleCloseContinuationPreview}
                  >
                    Close
                  </button>
                </div>

                <div className="swap-preview-card">
                  <div className="swap-preview-image-wrap">
                    <img src={liveContinuationPreview.imageUrl} alt={liveContinuationPreview.name} />
                  </div>
                  <div className="swap-preview-body">
                    <span className="reveal-story-chip active">{liveContinuationPreview.title}</span>
                    <h3>{liveContinuationPreview.name}</h3>
                    <p className="swap-preview-descriptor">{liveContinuationPreview.descriptor}</p>
                    <p className="stop-card-meta">{liveContinuationPreview.distanceLine}</p>
                    <p className="swap-preview-descriptor">{liveContinuationPreview.addsLine}</p>
                    {liveContinuationPreview.finalStopLine && (
                      <p className="swap-preview-descriptor">
                        {liveContinuationPreview.finalStopLine}
                      </p>
                    )}

                    <div className="stop-card-inline-detail-row">
                      <p className="stop-card-inline-detail-label">Why it fits</p>
                      <p className="stop-card-inline-detail-copy">
                        {liveContinuationPreview.whyItFits}
                      </p>
                    </div>
                    <div className="stop-card-inline-detail-row">
                      <p className="stop-card-inline-detail-label">Known for</p>
                      <p className="stop-card-inline-detail-copy">
                        {liveContinuationPreview.knownFor}
                      </p>
                    </div>
                    <div className="stop-card-inline-detail-row">
                      <p className="stop-card-inline-detail-label">Local signal</p>
                      <p className="stop-card-inline-detail-copy">
                        {liveContinuationPreview.localSignal}
                      </p>
                    </div>

                    <div className="swap-preview-impact">
                      <p className="stop-card-inline-detail-label">What changes in your night</p>
                      <ul className="swap-preview-impact-list">
                        {liveContinuationPreview.whatChanges.map((changeLine) => (
                          <li key={changeLine}>{changeLine}</li>
                        ))}
                      </ul>
                    </div>
                    <p className="swap-preview-reassure">The rest of your route stays stable.</p>

                    <div className="swap-preview-actions">
                      <div className="action-row">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={handleCloseContinuationPreview}
                        >
                          Keep current
                        </button>
                        <button
                          type="button"
                          className="primary-button"
                          onClick={handleConfirmContinuationOption}
                        >
                          Add this to my night
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          )}

          {utilityModal === 'share' && (
            <div className="swap-preview-overlay" onClick={handleCloseUtilityModal} role="presentation">
              <article className="swap-preview-popout" onClick={(event) => event.stopPropagation()}>
                <div className="swap-preview-header">
                  <p className="swap-preview-kicker">{shareTitle}</p>
                  <button
                    type="button"
                    className="ghost-button subtle"
                    onClick={handleCloseUtilityModal}
                  >
                    Close
                  </button>
                </div>

                <div className="swap-preview-card">
                  <div className="swap-preview-image-wrap live-share-snapshot" aria-hidden="true">
                    {routeItineraryStops[0]?.imageUrl ? (
                      <img
                        src={routeItineraryStops[0].imageUrl}
                        alt={`${finalRoute?.location ?? artifact.city} route snapshot`}
                      />
                    ) : (
                      <p>Map snapshot placeholder</p>
                    )}
                  </div>
                  <div className="swap-preview-body">
                    <p className="swap-preview-descriptor">Route snapshot</p>
                    <ul className="swap-preview-impact-list">
                      {routeMoments.map((moment) => (
                        <li key={moment.id}>
                          {moment.roleLabel}: {moment.name}
                        </li>
                      ))}
                    </ul>
                    <p className="stop-card-meta">{shareUrl}</p>
                    {shareFeedback && <p className="stop-card-meta">{shareFeedback}</p>}
                    <div className="swap-preview-actions">
                      <div className="action-row">
                        <button type="button" className="ghost-button" onClick={handleCopyShareLink}>
                          {copyButtonLabel}
                        </button>
                        <button type="button" className="primary-button" onClick={handleNativeShare}>
                          Share
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          )}

          {utilityModal === 'calendar' && (
            <div className="swap-preview-overlay" onClick={handleCloseUtilityModal} role="presentation">
              <article className="swap-preview-popout" onClick={(event) => event.stopPropagation()}>
                <div className="swap-preview-header">
                  <p className="swap-preview-kicker">Add to calendar</p>
                  <button
                    type="button"
                    className="ghost-button subtle"
                    onClick={handleCloseUtilityModal}
                  >
                    Close
                  </button>
                </div>

                <div className="swap-preview-card">
                  <div className="live-calendar-snapshot" aria-hidden="true">
                    {calendarTimeline.length > 0 ? (
                      <ul className="live-calendar-timeline">
                        {calendarTimeline.map((entry, index) => (
                          <li key={`timeline-${entry.id}`} className="live-calendar-timeline-item">
                            <span className="live-calendar-timeline-marker">
                              <span className="live-calendar-timeline-dot" />
                              {index < calendarTimeline.length - 1 && (
                                <span className="live-calendar-timeline-line" />
                              )}
                            </span>
                            <span className="live-calendar-timeline-copy">
                              <span className="live-calendar-time">
                                {formatClockTime(entry.start)} - {entry.roleLabel}
                              </span>
                              <span className="live-calendar-stop">{entry.name}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="live-calendar-empty">Timeline updates once your route is set.</p>
                    )}
                  </div>
                  <div className="swap-preview-body">
                    <p className="swap-preview-descriptor">Structured timeline for your night.</p>
                    <div className="swap-preview-actions">
                      <div className="action-row">
                        <a
                          href={googleCalendarUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="primary-button"
                        >
                          Add to Google Calendar
                        </a>
                      </div>
                      <div className="action-row">
                        <button
                          type="button"
                          className="calendar-secondary-action"
                          onClick={handleDownloadIcs}
                        >
                          Download .ics
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          )}

          <details
            className="live-artifact-details"
            open={planDetailsOpen}
            onToggle={(event) => {
              setPlanDetailsOpen((event.currentTarget as HTMLDetailsElement).open)
            }}
          >
            <summary>View plan details</summary>
            <div className="live-artifact-details-body">
              <RouteSpine
                className="draft-story-spine artifact-reference-spine is-live"
                stops={routeItineraryStops}
                storySpine={artifact.itinerary.storySpine}
                allowStopAdjustments={false}
                enableInlineDetails
                inlineDetailsByRole={inlineDetailsByRole}
                appliedSwapNoteByRole={{}}
                postSwapHintByRole={{}}
                activeRole={activeRole}
                alertedRole={liveAlertStage === 'alert' ? 'highlight' : null}
                continuationEntries={continuationEntries}
                changedRoles={[]}
                animatedRoles={[]}
                alternativesByRole={{}}
                alternativeKindsByRole={{}}
                highlightDecisionSignal="Chosen over closer options to carry the night better."
                onFocusRole={setActiveRole}
                onShowSwap={() => undefined}
                onShowNearby={() => undefined}
                onApplySwap={() => undefined}
                onPreviewAlternative={handlePreviewAlternativeFromCard}
                onPreviewDecisionAction={handlePreviewDecisionActionFromCard}
              />
            </div>
          </details>

          <section className="live-continuation-section">
            <div className="live-continuation-header">
              <h3>Keep the night going</h3>
              <p>
                When you&apos;re ready, here are a few ways to continue from your last stop
              </p>
            </div>
            <div className="live-continuation-options">
              {LIVE_CONTINUATION_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`live-continuation-option${
                    selectedContinuationOptionId === option.id ? ' active' : ''
                  }`}
                  onClick={() => handleSelectContinuationOption(option.id)}
                >
                  <p className="live-continuation-option-title">{option.title}</p>
                  <p className="live-continuation-option-copy">{option.description}</p>
                </button>
              ))}
            </div>
          </section>

          <div className="action-row draft-actions artifact-secondary-actions">
            <button type="button" className="ghost-button subtle" onClick={handleOpenShareModal}>
              Send to friends
            </button>
            <button type="button" className="ghost-button subtle" onClick={handleOpenCalendarModal}>
              Add to calendar
            </button>
          </div>
        </section>
      </div>
    </PageShell>
  )
}



