import { useCallback, useEffect, useMemo, useState } from 'react'
import { ID8Butler } from '../components/butler/ID8Butler'
import { DevTopNav } from '../components/layout/DevTopNav'
import { RouteSpine } from '../components/journey/RouteSpine'
import {
  JourneyMapReal,
  type JourneyContinuationStop,
  type JourneyNearbyOption,
} from '../components/journey/JourneyMapReal'
import { PageShell } from '../components/layout/PageShell'
import {
  createLiveArtifactPlanId,
  loadLiveArtifactContinuationUiState,
  loadValidatedSharedLiveArtifactPlan,
  loadValidatedLiveArtifactSession,
  saveLiveArtifactContinuationUiState,
  saveLiveArtifactSession,
  saveLiveArtifactHomeState,
  saveSharedLiveArtifactPlan,
  type LockedLiveArtifactLoadResult,
  type LiveArtifactSessionPayload,
} from '../domain/live/liveArtifactSession'
import type {
  RuntimeRouteArtifact,
  RuntimeRouteStop,
} from '../domain/artifacts/runtimeRouteArtifact'
import { canonicalizeNearbySwapTarget } from '../domain/live/canonicalizeNearbySwapTarget'
import {
  validateFinalRouteAgainstItinerary,
  type LiveArtifactRouteError,
} from '../domain/live/validateLiveArtifact'
import type {
  ContinuationAlertContract,
  ContinuationArtifactTargetKind,
  ContinuationOptionContract,
  ContinuationPreviewContract,
} from '../domain/lce/continuationContract'
import {
  buildContinuationPreviewContract,
  resolveSelectedContinuationOption,
} from '../domain/lce/continuationContract'
import { buildTonightSignals } from '../domain/journey/buildTonightSignals'
import type { Itinerary, ItineraryStop, UserStopRole } from '../domain/types/itinerary'
import { buildPlanningStopRepresentation } from '../domain/adapters/buildPlanningStopRepresentation'

type LiveAlertStage = 'idle' | 'alert' | 'preview' | 'resolved'
type LiveAlertDecision = 'keep' | 'switch' | 'timing'
type LiveContinuationOptionId = 'stay-nearby' | 'change-pace' | 'ease-out'
type LiveUtilityModal = 'share' | 'calendar' | null

interface LiveJourneyPageProps {
  sharedPlanId?: string
}

const LIVE_ALERT_PREVIEW_BY_DECISION: Record<
  LiveAlertDecision,
  { signal: string; impact: string; ctaLabel: string }
> = {
  keep: {
    signal: 'Stay with current highlight',
    impact: 'Highlight entry may tighten if congestion increases further.',
    ctaLabel: 'Confirm',
  },
  switch: {
    signal: 'Switch to a nearby highlight option',
    impact: 'Keeps route continuity while reducing immediate timing pressure.',
    ctaLabel: 'Apply swap',
  },
  timing: {
    signal: 'Shift highlight timing by ~20 minutes',
    impact: 'Protects your next-step entry window without changing the route shape.',
    ctaLabel: 'Update timing',
  },
}

const LIVE_CONTINUATION_ARTIFACT_TARGET_KIND: ContinuationArtifactTargetKind =
  'runtime_final_route'

type LiveContinuationOptionContract = ContinuationOptionContract<
  LiveContinuationOptionId,
  {
  archetypeLabel: string
  continuationArchetype: string
  title: string
  description: string
  defaultRationale: string
  futureVenueSlotLabel: string
  futureVenueReasonSlotLabel: string
  stops: JourneyContinuationStop[]
  }
>

const LIVE_CONTINUATION_OPTIONS: LiveContinuationOptionContract[] = [
  {
    id: 'stay-nearby',
    artifactTargetKind: LIVE_CONTINUATION_ARTIFACT_TARGET_KIND,
    archetypeLabel: 'Continue local',
    continuationArchetype: 'stay_local_extension',
    title: 'Stay nearby',
    description: 'Keep things local with one or two easy nearby beats.',
    defaultRationale: 'Extends your landing without adding much movement.',
    futureVenueSlotLabel: 'Suggestions will appear here when this lane has a strong next match.',
    futureVenueReasonSlotLabel: 'A short fit note will appear with each suggestion.',
    stops: [
      {
        id: 'continue_stay_nearby_1',
        name: 'Nearby continuation stop A',
        descriptor: 'Compact local extension lane.',
        coordinates: [-121.9256, 37.3235],
      },
      {
        id: 'continue_stay_nearby_2',
        name: 'Nearby continuation stop B',
        descriptor: 'Optional second nearby extension.',
        coordinates: [-121.9237, 37.3221],
      },
    ],
  },
  {
    id: 'change-pace',
    artifactTargetKind: LIVE_CONTINUATION_ARTIFACT_TARGET_KIND,
    archetypeLabel: 'Re-lift energy',
    continuationArchetype: 'energy_relift_extension',
    title: 'Change the pace',
    description: 'Shift energy with a fresh district feel after the main arc.',
    defaultRationale: 'Adds a second wind after your current landing.',
    futureVenueSlotLabel: 'Suggestions will appear here when this lane has a strong next match.',
    futureVenueReasonSlotLabel: 'A short fit note will appear with each suggestion.',
    stops: [
      {
        id: 'continue_change_pace_1',
        name: 'Energy-lift continuation stop A',
        descriptor: 'Higher-energy continuation lane.',
        coordinates: [-121.8918, 37.3339],
      },
      {
        id: 'continue_change_pace_2',
        name: 'Energy-lift continuation stop B',
        descriptor: 'Optional brighter late extension.',
        coordinates: [-121.8886, 37.3351],
      },
    ],
  },
  {
    id: 'ease-out',
    artifactTargetKind: LIVE_CONTINUATION_ARTIFACT_TARGET_KIND,
    archetypeLabel: 'Soft close',
    continuationArchetype: 'soft_close_extension',
    title: 'Ease out',
    description: 'Land softly with a calmer final beat before wrapping.',
    defaultRationale: 'Preserves a calm close after your route endpoint.',
    futureVenueSlotLabel: 'Suggestions will appear here when this lane has a strong next match.',
    futureVenueReasonSlotLabel: 'A short fit note will appear with each suggestion.',
    stops: [
      {
        id: 'continue_ease_out_1',
        name: 'Soft-close continuation stop A',
        descriptor: 'Lower-energy continuation lane.',
        coordinates: [-121.9194, 37.3202],
      },
      {
        id: 'continue_ease_out_2',
        name: 'Soft-close continuation stop B',
        descriptor: 'Optional gentle final extension.',
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
const LIVE_GOOGLE_STOP_ID_PREFIX = 'live_google_'

function isUserStopRole(value: string | null | undefined): value is UserStopRole {
  return value === 'start' || value === 'highlight' || value === 'surprise' || value === 'windDown'
}

function getLiveContinuationOptionById(
  optionId: LiveContinuationOptionId | null,
): LiveContinuationOptionContract | null {
  if (!optionId) {
    return null
  }
  return LIVE_CONTINUATION_OPTIONS.find((option) => option.id === optionId) ?? null
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

function getProviderRecordIdFromVenueId(venueId: string): string | undefined {
  if (!venueId.startsWith(LIVE_GOOGLE_STOP_ID_PREFIX)) {
    return undefined
  }
  const providerRecordId = venueId.slice(LIVE_GOOGLE_STOP_ID_PREFIX.length).trim()
  return providerRecordId.length > 0 ? providerRecordId : undefined
}

function toFinalRouteStopFromArtifact(stop: ItineraryStop, stopIndex: number): RuntimeRouteStop {
  const fallbackCoordinates = FALLBACK_COORDINATES_BY_ROLE[stop.role]
  const providerRecordId = getProviderRecordIdFromVenueId(stop.venueId)
  return {
    id: stop.id,
    sourceStopId: stop.id,
    displayName: stop.venueName,
    ...(providerRecordId ? { providerRecordId } : {}),
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

function buildFinalRouteMapMarkers(
  stops: RuntimeRouteStop[],
): RuntimeRouteArtifact['mapMarkers'] {
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

function getCanonicalRouteItineraryStops(
  itinerary: Itinerary,
): ItineraryStop[] {
  return itinerary.stops.filter(
    (stop) => stop.role === 'start' || stop.role === 'highlight' || stop.role === 'windDown',
  )
}

function alignCanonicalStopToFinalRouteStop(
  canonicalStop: ItineraryStop,
  routeStop: RuntimeRouteStop,
): ItineraryStop {
  const alignedDriveMinutes =
    Number.isFinite(routeStop.driveMinutes) && routeStop.driveMinutes >= 0
      ? routeStop.driveMinutes
      : canonicalStop.driveMinutes
  return {
    ...canonicalStop,
    venueId: routeStop.venueId || canonicalStop.venueId,
    venueName: routeStop.displayName || canonicalStop.venueName,
    subtitle: routeStop.subtitle || canonicalStop.subtitle,
    neighborhood: routeStop.neighborhood || canonicalStop.neighborhood,
    driveMinutes: alignedDriveMinutes,
    imageUrl: routeStop.imageUrl || canonicalStop.imageUrl,
  }
}

function mapFinalRouteToCanonicalItineraryStops(
  itinerary: Itinerary,
  finalRoute: RuntimeRouteArtifact,
): ItineraryStop[] {
  const canonicalStops = getCanonicalRouteItineraryStops(itinerary)
  const routeStops = finalRoute.stops
    .filter((stop) => stop.role === 'start' || stop.role === 'highlight' || stop.role === 'windDown')
    .sort((left, right) => left.stopIndex - right.stopIndex)
  if (canonicalStops.length === 0 || routeStops.length === 0) {
    return []
  }
  const canonicalStopById = new Map(canonicalStops.map((stop) => [stop.id, stop] as const))
  const canonicalStopByRole = new Map(canonicalStops.map((stop) => [stop.role, stop] as const))
  const usedStopIds = new Set<string>()
  const mappedStops: ItineraryStop[] = []

  for (const routeStop of routeStops) {
    const sourceStopId = routeStop.sourceStopId?.trim()
    if (sourceStopId) {
      const canonicalById = canonicalStopById.get(sourceStopId)
      if (!canonicalById || canonicalById.role !== routeStop.role) {
        return []
      }
      if (usedStopIds.has(canonicalById.id)) {
        return []
      }
      mappedStops.push(alignCanonicalStopToFinalRouteStop(canonicalById, routeStop))
      usedStopIds.add(canonicalById.id)
      continue
    }

    const canonicalByRole = canonicalStopByRole.get(routeStop.role)
    if (!canonicalByRole || usedStopIds.has(canonicalByRole.id)) {
      return []
    }
    mappedStops.push(alignCanonicalStopToFinalRouteStop(canonicalByRole, routeStop))
    usedStopIds.add(canonicalByRole.id)
  }

  return mappedStops
}

function uniqueLiveLines(lines: Array<string | undefined>, limit: number): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const rawLine of lines) {
    const line = rawLine?.trim()
    if (!line) {
      continue
    }
    const key = line.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push(line)
    if (result.length >= limit) {
      break
    }
  }
  return result
}

function patchFinalRouteStop(params: {
  route: RuntimeRouteArtifact
  targetRole: UserStopRole
  targetStopId?: string
  targetStopIndex?: number
  replacementStop: RuntimeRouteStop
  notice?: string
  activeRole?: UserStopRole
}): {
  route: RuntimeRouteArtifact
  resolvedStop: RuntimeRouteStop
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
  const replacementStop: RuntimeRouteStop = {
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

export function LiveJourneyPage({ sharedPlanId }: LiveJourneyPageProps) {
  const [loadResult] = useState<LockedLiveArtifactLoadResult>(() =>
    sharedPlanId ? loadValidatedSharedLiveArtifactPlan(sharedPlanId) : loadValidatedLiveArtifactSession(),
  )
  const artifact = loadResult.status === 'ok' ? loadResult.payload : null
  const persistedContinuationUiState = artifact
    ? loadLiveArtifactContinuationUiState(artifact.sessionId)
    : null
  const loadError: LiveArtifactRouteError | null =
    loadResult.status === 'error' ? loadResult.error : null
  const [finalRoute, setFinalRoute] = useState<RuntimeRouteArtifact | null>(() =>
    artifact?.finalRoute ?? null,
  )
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
    useState<LiveContinuationOptionId | null>(
      () =>
        (persistedContinuationUiState?.selectedContinuationOptionId as LiveContinuationOptionId | null) ??
        null,
    )
  const [previewContinuationOptionId, setPreviewContinuationOptionId] =
    useState<LiveContinuationOptionId | null>(
      () =>
        (persistedContinuationUiState?.previewContinuationOptionId as LiveContinuationOptionId | null) ??
        null,
    )
  const [continuationStops, setContinuationStops] = useState<JourneyContinuationStop[]>(() => {
    const selectedOption = getLiveContinuationOptionById(
      (persistedContinuationUiState?.selectedContinuationOptionId as LiveContinuationOptionId | null) ??
        null,
    )
    return selectedOption ? selectedOption.stops.slice(0, 2) : []
  })
  const [planDetailsOpen, setPlanDetailsOpen] = useState(
    Boolean(
      persistedContinuationUiState?.selectedContinuationOptionId ||
        persistedContinuationUiState?.previewContinuationOptionId,
    ),
  )
  const [utilityModal, setUtilityModal] = useState<LiveUtilityModal>(null)
  const [shareFeedback, setShareFeedback] = useState<string | null>(null)
  const [sharePlanId, setSharePlanId] = useState<string | null>(sharedPlanId ?? null)
  const isDevLive =
    typeof window !== 'undefined' && window.location.pathname.toLowerCase().startsWith('/dev')
  const routeItineraryStops = useMemo(() => {
    if (!artifact || !finalRoute) {
      return [] as ItineraryStop[]
    }
    return mapFinalRouteToCanonicalItineraryStops(artifact.itinerary, finalRoute)
  }, [artifact, finalRoute])
  const routeMappingError = useMemo<LiveArtifactRouteError | null>(() => {
    if (!artifact || !finalRoute || routeItineraryStops.length > 0) {
      return null
    }
    return {
      code: 'final_route_itinerary_mismatch',
      detail:
        'Locked finalRoute could not be mapped onto the canonical itinerary companion stops.',
    }
  }, [artifact, finalRoute, routeItineraryStops])
  const canonicalRouteArtifact = useMemo<LiveArtifactSessionPayload | null>(() => {
    if (!artifact || !finalRoute || routeItineraryStops.length === 0) {
      return null
    }
    return {
      ...artifact,
      selectedClusterConfirmation: finalRoute.routeSummary || artifact.selectedClusterConfirmation,
      finalRoute,
      itinerary: artifact.itinerary,
    }
  }, [artifact, finalRoute, routeItineraryStops])
  const liveRenderRoute = useMemo(
    () => canonicalRouteArtifact?.finalRoute ?? finalRoute ?? null,
    [canonicalRouteArtifact, finalRoute],
  )

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
              option.providerRecordId === nextOptions[index]?.providerRecordId &&
              option.sourceOrigin === nextOptions[index]?.sourceOrigin &&
              option.provider === nextOptions[index]?.provider &&
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
  const primarySwitchNearbyOption = switchNearbyOptions[0] ?? null
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
    if (!canonicalRouteArtifact) {
      return
    }
    saveLiveArtifactSession({
      ...canonicalRouteArtifact,
      initialActiveRole: activeRole,
    })
  }, [activeRole, canonicalRouteArtifact])
  useEffect(() => {
    if (!artifact?.sessionId) {
      return
    }
    saveLiveArtifactContinuationUiState(artifact.sessionId, {
      selectedContinuationOptionId,
      previewContinuationOptionId,
    })
  }, [artifact?.sessionId, previewContinuationOptionId, selectedContinuationOptionId])

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

  const handleOpenHighlightSwapOptions = () => {
    if (!primarySwitchNearbyOption) {
      return
    }
    handlePreviewAlternativeFromCard('highlight', primarySwitchNearbyOption.id)
  }

  const handleSelectContinuationOption = (optionId: LiveContinuationOptionId) => {
    const selectedPreviewOption = liveContinuationPreviewContract.options.find((option) => option.id === optionId)
    if (!selectedPreviewOption) {
      return
    }
    setPreviewContinuationOptionId(selectedPreviewOption.id)
  }

  const handleConfirmContinuationOption = () => {
    const selectedPreviewOption = resolveSelectedContinuationOption(liveContinuationPreviewContract)
    if (!selectedPreviewOption) {
      setPreviewContinuationOptionId(null)
      return
    }
    const selectedOption = selectedPreviewOption.payload
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
      city: liveRenderRoute?.location ?? artifact?.city ?? 'live',
      mapPath,
    })
    window.location.assign(isDevLive ? '/dev/plans' : '/plans')
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
      const canonicalSwapTarget = canonicalizeNearbySwapTarget({
        selectedOptionId: selectedSwitchNearbyOption?.id,
        nearbyOptions: nearbyOptionsByRole.highlight ?? [],
      })
      if (!canonicalSwapTarget.ok) {
        setLiveAlertDecision(null)
        setSelectedSwitchNearbyOption(null)
        setLiveAlertStage('alert')
        return
      }
      const swapTarget = canonicalSwapTarget.canonicalOption
      setLiveAppliedSwitchOption(swapTarget)
      setFinalRoute((current) => {
        if (!current) {
          return current
        }
        const currentHighlightStop = current.stops.find((stop) => stop.role === 'highlight')
        if (!currentHighlightStop) {
          return current
        }
        const replacementStop: RuntimeRouteStop = {
          ...currentHighlightStop,
          displayName: swapTarget.name,
          venueId: swapTarget.id,
          providerRecordId: swapTarget.providerRecordId,
          latitude: swapTarget.coordinates[1],
          longitude: swapTarget.coordinates[0],
          address: `${currentHighlightStop.neighborhood || current.location}, ${current.location}`.replace(
            /^,\s*/,
            '',
          ),
          subtitle: `${getNearbyOptionDescriptor(swapTarget.category)} · ${swapTarget.minutesAway} min away`,
        }
        const patchedRoute = patchFinalRouteStop({
          route: current,
          targetRole: 'highlight',
          targetStopId: currentHighlightStop.id,
          targetStopIndex: currentHighlightStop.stopIndex,
          replacementStop,
          notice: `Highlight switched to ${swapTarget.name}.`,
          activeRole: 'highlight',
        })
        if (!patchedRoute) {
          return current
        }
        if (
          patchedRoute.resolvedStop.role !== 'highlight' ||
          patchedRoute.resolvedStop.stopIndex !== currentHighlightStop.stopIndex
        ) {
          return current
        }
        if (
          !artifact ||
          !validateFinalRouteAgainstItinerary({
            itinerary: artifact.itinerary,
            finalRoute: patchedRoute.route,
          })
        ) {
          return current
        }
        return patchedRoute.route
      })
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

  const liveStopRepresentationByRole = useMemo(
    () =>
      new Map(
        routeItineraryStops.map((stop) => [
          stop.role,
          buildPlanningStopRepresentation({ stop }),
        ]),
      ),
    [routeItineraryStops],
  )
  const canonicalHighlightVenueName = useMemo(
    () =>
      liveStopRepresentationByRole.get('highlight')?.venueName ||
      routeItineraryStops.find((stop) => stop.role === 'highlight')?.venueName ||
      null,
    [liveStopRepresentationByRole, routeItineraryStops],
  )
  const copilotBusyLine = canonicalHighlightVenueName
    ? `${canonicalHighlightVenueName} is getting busy.`
    : 'Your highlight stop is getting busy.'

  const inlineDetailsByRole = useMemo(() => {
    if (!artifact) {
      return {}
    }
    return Object.fromEntries(
      routeItineraryStops.map((stop) => {
        const sharedStopRepresentation = liveStopRepresentationByRole.get(stop.role)
        const roleTravelWindowMinutes = getRoleTravelWindow(artifact.itinerary, stop.role)
        const canonicalTonightSignals = buildTonightSignals({
          stop,
          roleTravelWindowMinutes,
          nearbySummary: nearbySummaryByRole[stop.role],
          nearbyOptionsCount: nearbyOptionsByRole[stop.role]?.length ?? 0,
        })
        const reasonSignals = stop.reasonLabels?.slice(0, 2) ?? []
        const baseGoodToKnow =
          stop.note?.trim() ||
          (roleTravelWindowMinutes > 0
            ? `${roleTravelWindowMinutes} min travel envelope around this stop.`
            : 'Compact movement envelope for this stop.')
        const next: {
          whyItFits?: string
          knownFor?: string
          goodToKnow: string
          localSignal?: string
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
          whyItFits: sharedStopRepresentation?.fitSummary,
          knownFor: sharedStopRepresentation?.knownFor,
          goodToKnow: baseGoodToKnow,
          localSignal: sharedStopRepresentation?.areaFitSummary,
          tonightSignals: uniqueLiveLines([...canonicalTonightSignals, ...reasonSignals], 3),
        }
        const canonicalAroundHere = [stop.neighborhood, stop.city]
          .filter((value): value is string => Boolean(value && value.trim()))
        if (canonicalAroundHere.length > 0) {
          next.aroundHereSignals = canonicalAroundHere.slice(0, 2)
        }
        const nearbySummary = nearbySummaryByRole[stop.role]
        if (nearbySummary) {
          next.aroundHereSignals = [nearbySummary, ...(next.aroundHereSignals ?? [])].slice(0, 2)
        }
        const highlightAlertOwnsDecision = stop.role === 'highlight' && liveAlertStage === 'alert'
        if (
          stop.role === 'highlight' &&
          switchNearbyOptions.length > 0 &&
          !highlightAlertOwnsDecision
        ) {
          next.alternatives = switchNearbyOptions.map((option) => ({
            venueId: option.id,
            name: option.name,
            descriptor: getNearbyOptionDescriptor(option.category),
            distanceLabel: `${option.minutesAway} min away`,
            replacementContext: originalHighlightStop?.venueName ?? stop.venueName,
          }))
        }
        if (highlightAlertOwnsDecision) {
          next.alertSignal = '⚠️ This stop is getting busy'
        }
        if (stop.role === 'highlight' && liveAppliedDecision) {
          if (liveAppliedDecision === 'keep') {
            next.alertSignal = 'Monitoring this stop after your keep decision.'
            next.tonightSignals = uniqueLiveLines(
              [...(next.tonightSignals ?? []), "We'll keep watching this stop."],
              3,
            )
          } else if (liveAppliedDecision === 'switch') {
            const switchSignal = liveAppliedSwitchOption
              ? `Swapped to ${liveAppliedSwitchOption.name} (${liveAppliedSwitchOption.minutesAway} min away).`
              : 'Nearby highlight swap selected.'
            next.alertSignal = switchSignal
            next.tonightSignals = uniqueLiveLines([...(next.tonightSignals ?? []), switchSignal], 3)
          } else if (liveAppliedDecision === 'timing') {
            next.alertSignal = 'Highlight timing shifted by about 20 minutes.'
            next.tonightSignals = uniqueLiveLines(
              [...(next.tonightSignals ?? []), 'Shifted +20 min to improve the entry window.'],
              3,
            )
          }
        }
        return [stop.role, next]
      }),
    ) as Partial<
      Record<
        UserStopRole,
        {
          whyItFits?: string
          tonightSignals?: string[]
          aroundHereSignals?: string[]
          knownFor?: string
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
    liveStopRepresentationByRole,
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
  const routeEndingStop = useMemo(() => {
    if (routeItineraryStops.length === 0) {
      return null
    }
    return [...routeItineraryStops].sort((left, right) => {
      const leftIndex = left.role === 'start' ? 0 : left.role === 'highlight' ? 1 : 2
      const rightIndex = right.role === 'start' ? 0 : right.role === 'highlight' ? 1 : 2
      return leftIndex - rightIndex
    })[routeItineraryStops.length - 1] ?? null
  }, [routeItineraryStops])
  const liveAlertContract = useMemo<
    ContinuationAlertContract<LiveAlertDecision, LiveContinuationOptionId>
  >(
    () => ({
      step: 'alert',
      artifactTargetKind: LIVE_CONTINUATION_ARTIFACT_TARGET_KIND,
      alertedRole: liveAlertStage === 'alert' ? 'highlight' : null,
      selectedDecisionId: liveAlertDecision,
      selectedOptionId: null,
    }),
    [liveAlertDecision, liveAlertStage],
  )
  const liveContinuationPreviewContract = useMemo<
    ContinuationPreviewContract<LiveContinuationOptionId, LiveContinuationOptionContract>
  >(
    () =>
      buildContinuationPreviewContract({
      artifactTargetKind: LIVE_CONTINUATION_ARTIFACT_TARGET_KIND,
      options: LIVE_CONTINUATION_OPTIONS.map((option) => ({
        id: option.id,
        payload: option,
      })),
      selectedOptionId: previewContinuationOptionId,
      }),
    [previewContinuationOptionId],
  )
  const continuationOptionCards = useMemo(() => {
    const endingRoleLabel = routeEndingStop?.title ?? 'Wind Down'
    const endingStopName = routeEndingStop?.venueName ?? 'your route endpoint'
    return liveContinuationPreviewContract.options.map(({ payload: option }) => {
      let rationale = option.defaultRationale
      if (option.id === 'stay-nearby') {
        rationale = `Fits your ${endingRoleLabel.toLowerCase()} landing by keeping movement tight from ${endingStopName}.`
      } else if (option.id === 'change-pace') {
        rationale = `Fits if you want to re-lift after ${endingStopName} without replacing your route ending.`
      } else if (option.id === 'ease-out') {
        rationale = `Fits if you want a softer close that extends the ${endingRoleLabel.toLowerCase()} posture.`
      }
      return {
        ...option,
        rationale,
      }
    })
  }, [liveContinuationPreviewContract, routeEndingStop])

  const routeMoments = useMemo(() => {
    if (!canonicalRouteArtifact || !liveRenderRoute) {
      return []
    }
    const orderedStops = [...liveRenderRoute.stops].sort(
      (left, right) => left.stopIndex - right.stopIndex,
    )
    return orderedStops.map((stop, index) => ({
      id: stop.id,
      roleLabel: stop.title,
      name: stop.displayName,
      descriptor: stop.subtitle,
      durationMinutes: 45,
        travelToNextMinutes:
          canonicalRouteArtifact.itinerary.transitions[index]?.estimatedTransitionMinutes ??
          (index < orderedStops.length - 1 ? 8 : 0),
    }))
  }, [canonicalRouteArtifact, liveRenderRoute])

  const calendarTimeline = useMemo(() => {
    if (!canonicalRouteArtifact || routeMoments.length === 0) {
      return []
    }
    const startBase = new Date(canonicalRouteArtifact.lockedAt || Date.now())
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
  }, [canonicalRouteArtifact, routeMoments])

  const shareTitle = `Your night in ${
    liveRenderRoute?.location ?? artifact?.city ?? 'your city'
  }`
  const shareStopsText = routeMoments
    .map((moment, index) => `${index + 1}. ${moment.roleLabel}: ${moment.name}`)
    .join('\n')
  const shareText = `${shareTitle}\n${shareStopsText}`
  const persistSharedPlan = useCallback((): string | null => {
    if (!canonicalRouteArtifact) {
      return null
    }
    const nextPlanId = sharePlanId ?? createLiveArtifactPlanId()
    saveSharedLiveArtifactPlan(nextPlanId, {
      ...canonicalRouteArtifact,
      initialActiveRole: activeRole,
    })
    if (sharePlanId !== nextPlanId) {
      setSharePlanId(nextPlanId)
    }
    return nextPlanId
  }, [activeRole, canonicalRouteArtifact, sharePlanId])

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
      liveRenderRoute?.location ?? artifact?.city ?? '',
    )}`
  }, [artifact?.city, calendarTimeline, liveRenderRoute?.location, shareTitle])

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
      `UID:id8-live-${canonicalRouteArtifact?.lockedAt ?? artifact?.lockedAt}@id8`,
      `DTSTAMP:${toIcsDate(new Date())}`,
      `DTSTART:${toIcsDate(firstEntry.start)}`,
      `DTEND:${toIcsDate(lastEntry.end)}`,
      `SUMMARY:${escapeIcs(shareTitle)}`,
      `DESCRIPTION:${escapeIcs(details)}`,
      `LOCATION:${escapeIcs(liveRenderRoute?.location ?? artifact?.city ?? '')}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
  }, [
    artifact?.city,
    artifact?.lockedAt,
    calendarTimeline,
    liveRenderRoute?.location,
    canonicalRouteArtifact?.lockedAt,
    shareTitle,
  ])

  const mapRouteStops = useMemo(
    () =>
      liveRenderRoute
        ? liveRenderRoute.stops
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
    [liveRenderRoute],
  )
  const mapWaypointOverrides = useMemo(() => {
    return undefined
  }, [])

  const selectedNearbyPlaceIdByRole = useMemo(() => {
    return undefined
  }, [])
  const liveAlertPreview = useMemo(() => {
    if (!liveAlertDecision || liveAlertStage !== 'preview') {
      return null
    }
    if (liveAlertDecision === 'switch') {
      if (!selectedSwitchNearbyOption) {
        return {
          signal: LIVE_ALERT_PREVIEW_BY_DECISION.switch.signal,
          impact: LIVE_ALERT_PREVIEW_BY_DECISION.switch.impact,
          ctaLabel: LIVE_ALERT_PREVIEW_BY_DECISION.switch.ctaLabel,
        }
      }
      return {
        signal: `Switch highlight to ${selectedSwitchNearbyOption.name}`,
        impact: `${selectedSwitchNearbyOption.minutesAway} min away; route flow stays intact with lower timing risk.`,
        ctaLabel: LIVE_ALERT_PREVIEW_BY_DECISION.switch.ctaLabel,
      }
    }
    return LIVE_ALERT_PREVIEW_BY_DECISION[liveAlertDecision]
  }, [liveAlertDecision, liveAlertStage, selectedSwitchNearbyOption])

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
    const currentHighlightName = originalHighlightStop?.venueName ?? 'Current highlight stop'
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
      whyItFits: inlineDetailsByRole.highlight?.whyItFits,
      knownFor: inlineDetailsByRole.highlight?.knownFor,
      localSignal: inlineDetailsByRole.highlight?.localSignal,
      whatChanges: [pacingShift, travelImpact, vibeShift],
    }
  }, [
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
    const selectedPreviewOptionId = liveContinuationPreviewContract.selectedOptionId
    if (!selectedPreviewOptionId) {
      return null
    }
    const selectedPreviewOption = liveContinuationPreviewContract.options.find(
      (option) => option.id === selectedPreviewOptionId,
    )
    if (!selectedPreviewOption) {
      return null
    }
    const selectedOption = selectedPreviewOption.payload

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
  }, [liveContinuationPreviewContract, routeItineraryStops])

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

  const liveArtifactCity = liveRenderRoute?.location ?? artifact?.city ?? 'live'
  const handleDownloadIcs = useCallback(() => {
    if (!calendarIcsContent) {
      return
    }
    const file = new Blob([calendarIcsContent], { type: 'text/calendar;charset=utf-8' })
    const url = window.URL.createObjectURL(file)
    const anchor = document.createElement('a')
    const slug = liveArtifactCity.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    anchor.href = url
    anchor.download = `id8-night-${slug || 'live'}.ics`
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.URL.revokeObjectURL(url)
  }, [calendarIcsContent, liveArtifactCity])

  const isAlertActive = liveAlertStage === 'alert' || liveAlertStage === 'preview'
  const liveHeaderStatus = isAlertActive ? 'Adjusting in real time' : 'In motion'

  if (!artifact && !loadError && !routeMappingError) {
    return (
      <PageShell title="Live Journey" subtitle="No active artifact found">
        <div className="demo-flow-frame">
          <DevTopNav
            homeHref={isDevLive ? '/dev/home' : '/home'}
            backHref={isDevLive ? '/dev/plans' : '/plans'}
            backLabel="Back to Plans"
          />
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
              onClick={() => window.location.assign(isDevLive ? '/dev/home' : '/home')}
            >
              {isDevLive ? 'Go to sandbox home' : 'Go to home'}
            </button>
          </div>
        </div>
      </PageShell>
    )
  }

  if (loadError || routeMappingError) {
    const artifactError = loadError ?? routeMappingError
    return (
      <PageShell title="Live Journey" subtitle="Live route artifact unavailable">
        <div className="demo-flow-frame">
          <DevTopNav
            homeHref={isDevLive ? '/dev/home' : '/home'}
            backHref={isDevLive ? '/dev/plans' : '/plans'}
            backLabel="Back to Plans"
          />
          <div className="preview-notice draft-feedback">
            <p className="preview-notice-title">Live route artifact unavailable</p>
            <p className="preview-notice-copy">
              This locked route could not be opened. Re-lock the plan from concierge before entering
              Live Journey.
            </p>
            {isDevLive && (
              <p className="preview-notice-copy">
                Route artifact error: {artifactError?.code} | {artifactError?.detail}
              </p>
            )}
          </div>
          <div className="action-row draft-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => window.location.assign(isDevLive ? '/dev/home' : '/home')}
            >
              {isDevLive ? 'Go to sandbox home' : 'Go to home'}
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
        <DevTopNav
          homeHref={isDevLive ? '/dev/home' : '/home'}
          backOnClick={handleDonePlanning}
          backLabel="Back to Plans"
        />

        <section className="plan-reveal live-artifact-surface">
          <div className="confirm-night-header live-artifact-header is-live">
            <h2>Your night &mdash; live</h2>
            <p>
              {liveRenderRoute?.location ?? artifact?.city ?? 'live'} &middot; Tonight
            </p>
            <p className="live-artifact-status">{liveHeaderStatus}</p>
          </div>

          <section className="live-map-module">
            <div className="live-section-header">
              <p className="live-section-kicker">Route progression</p>
              <p className="live-section-subcopy">
                Map state and co-pilot guidance stay aligned through your current checkpoint.
              </p>
            </div>
            {/* Map owns route/position state now; future live overlays should attach here without changing co-pilot contract. */}
            <div className="artifact-map-layer is-live">
              <JourneyMapReal
                key={`live-route-${liveRenderRoute?.routeId ?? 'none'}`}
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
              <p className="lce-system-strip">Co-pilot now</p>
              {liveAlertStage === 'idle' && (
                <p className="lce-system-idle">
                  No action now. Stay on your current route; co-pilot is watching the next checkpoint.
                </p>
              )}

              {liveAlertStage === 'alert' && (
                <article className="lce-alert-card">
                  <h3>Highlight checkpoint changed</h3>
                  <p className="lce-alert-copy">{copilotBusyLine}</p>
                  <p className="lce-alert-support">
                    If unchanged, this can compress your highlight entry timing.
                  </p>
                  <div className="lce-alert-actions">
                    {primarySwitchNearbyOption && (
                      <button
                        type="button"
                        className="primary-button lce-action-button"
                        onClick={handleOpenHighlightSwapOptions}
                      >
                        Review swap options
                      </button>
                    )}
                    {!primarySwitchNearbyOption && (
                      <button
                        type="button"
                        className="primary-button lce-action-button"
                        onClick={() => handleLiveAlertDecision('timing')}
                      >
                        Go later (~20 min)
                      </button>
                    )}
                    {primarySwitchNearbyOption && (
                      <button
                        type="button"
                        className="ghost-button lce-action-button"
                        onClick={() => handleLiveAlertDecision('timing')}
                      >
                        Go later (~20 min)
                      </button>
                    )}
                    <button
                      type="button"
                      className="ghost-button lce-action-button"
                      onClick={() => handleLiveAlertDecision('keep')}
                    >
                      Keep current plan
                    </button>
                  </div>
                </article>
              )}

              {liveAlertStage === 'preview' && liveAlertPreview && (
                <article className="lce-alert-card preview">
                  <p className="lce-alert-kicker">Decision checkpoint</p>
                  <h3>{liveAlertPreview.signal}</h3>
                  <p className="lce-alert-support">{liveAlertPreview.impact}</p>
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
                      className="primary-button lce-action-button"
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
                  <p className="preview-notice-copy">
                    Continue to your next stop. Co-pilot is now watching the next checkpoint.
                  </p>
                </div>
              )}
            </section>
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

                    {liveSwapPreview.whyItFits && (
                      <div className="stop-card-inline-detail-row">
                        <p className="stop-card-inline-detail-label">Why it fits</p>
                        <p className="stop-card-inline-detail-copy">{liveSwapPreview.whyItFits}</p>
                      </div>
                    )}
                    {liveSwapPreview.knownFor && (
                      <div className="stop-card-inline-detail-row">
                        <p className="stop-card-inline-detail-label">Known for</p>
                        <p className="stop-card-inline-detail-copy">{liveSwapPreview.knownFor}</p>
                      </div>
                    )}
                    {liveSwapPreview.localSignal && (
                      <div className="stop-card-inline-detail-row">
                        <p className="stop-card-inline-detail-label">Local signal</p>
                        <p className="stop-card-inline-detail-copy">{liveSwapPreview.localSignal}</p>
                      </div>
                    )}

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
                        alt={`${liveRenderRoute?.location ?? artifact?.city ?? 'live'} route snapshot`}
                      />
                    ) : (
                      <p>Route snapshot unavailable</p>
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
            <summary>Route reference</summary>
            <div className="live-artifact-details-body">
              <p className="live-section-subcopy compact">
                Current stop order and context for the active route.
              </p>
              <RouteSpine
                className="draft-story-spine artifact-reference-spine is-live"
                stops={routeItineraryStops}
                strictSharedSemantics
                storySpine={
                  canonicalRouteArtifact?.itinerary.storySpine ?? artifact?.itinerary.storySpine
                }
                hideArcSummary
                allowStopAdjustments={false}
                enableInlineDetails
                inlineDetailsByRole={inlineDetailsByRole}
                appliedSwapNoteByRole={{}}
                postSwapHintByRole={{}}
                activeRole={activeRole}
                alertedRole={
                  isUserStopRole(liveAlertContract.alertedRole)
                    ? liveAlertContract.alertedRole
                    : null
                }
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
              {continuationOptionCards.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`live-continuation-option${
                    selectedContinuationOptionId === option.id ? ' active' : ''
                  }`}
                  onClick={() => handleSelectContinuationOption(option.id)}
                >
                  <p className="live-continuation-option-kicker">{option.archetypeLabel}</p>
                  <p className="live-continuation-option-title">{option.title}</p>
                  <p className="live-continuation-option-copy">{option.description}</p>
                  <p className="live-continuation-option-rationale">{option.rationale}</p>
                  <div className="live-continuation-option-slot">
                    <p className="live-continuation-option-slot-label">Suggested next stop</p>
                    <p className="live-continuation-option-slot-copy">{option.futureVenueSlotLabel}</p>
                  </div>
                  <div className="live-continuation-option-slot">
                    <p className="live-continuation-option-slot-label">Why this lane fit</p>
                    <p className="live-continuation-option-slot-copy">
                      {option.futureVenueReasonSlotLabel}
                    </p>
                  </div>
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



