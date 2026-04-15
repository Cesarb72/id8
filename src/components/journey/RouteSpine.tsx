import { useEffect, useRef, useState } from 'react'
import { NearbyNodeGroup } from './NearbyNodeGroup'
import { StopCard } from '../cards/StopCard'
import type {
  DraftComposeAction,
  DraftComposeActionId,
  DraftComposeSearchActionId,
  DraftComposeSearchResult,
} from '../../domain/arc/composeDraftArc'
import type { DraftRoleShapeAction, DraftRoleShapeActionId } from '../../domain/arc/reshapeArcStop'
import type {
  StopAlternative,
  StopAlternativeKind,
} from '../../domain/types/arc'
import type { GenerationTrace } from '../../domain/runGeneratePlan'
import type { ItineraryStop, UserStopRole } from '../../domain/types/itinerary'
import type { StorySpine } from '../../domain/types/itinerary'

type RouteArcType = 'full' | 'partial' | 'highlightOnly'

interface RouteDebugSummary {
  arcType: RouteArcType
  highlightIntensity?: number
  usedRecoveredCentralMomentHighlight?: boolean
}

interface RouteSpineProps {
  stops: ItineraryStop[]
  storySpine?: StorySpine
  className?: string
  debugMode?: boolean
  adjustMode?: 'full' | 'swap-only'
  allowStopAdjustments?: boolean
  collapseAdjustPanelKey?: number
  activeRole: UserStopRole
  changedRoles: UserStopRole[]
  animatedRoles: UserStopRole[]
  generationTrace?: GenerationTrace
  alternativesByRole: Partial<Record<UserStopRole, StopAlternative[]>>
  alternativeKindsByRole: Partial<Record<UserStopRole, StopAlternativeKind>>
  roleShapeActionsByRole?: Partial<Record<UserStopRole, DraftRoleShapeAction[]>>
  composeActionsByRole?: Partial<Record<UserStopRole, DraftComposeAction[]>>
  ownedStopKindsByRole?: Partial<Record<UserStopRole, 'candidate' | 'custom'>>
  adjustLabel?: string
  adjustDisabled?: boolean
  adjustDisabledRoles?: UserStopRole[]
  adjustLockedNotesByRole?: Partial<Record<UserStopRole, string>>
  unavailableByRole?: Partial<Record<UserStopRole, 'removed' | 'unavailable'>>
  highlightDecisionSignal?: string
  highlightDecisionSecondarySignal?: string
  enableInlineDetails?: boolean
  inlineDetailsByRole?: Partial<
    Record<
      UserStopRole,
      {
        whyItFits?: string
        tonightSignals?: string[]
        aroundHereSignals?: string[]
        knownFor?: string
        goodToKnow?: string
        localSignal?: string
        stopNarrativeWhyNow?: string
        stopNarrativeRoleMeaning?: string
        stopNarrativeTransitionLogic?: string
        stopNarrativeFlavorTags?: string[]
        stopNarrativeMode?: string
        stopNarrativeSource?: string
        stopFlavorSummary?: string
        stopTransitionSummary?: string
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
        venueLinkUrl?: string
      }
    >
  >
  appliedSwapNoteByRole?: Partial<Record<UserStopRole, string>>
  postSwapHintByRole?: Partial<Record<UserStopRole, string>>
  alertedRole?: UserStopRole | null
  continuationEntries?: Array<{
    id: string
    title: string
    descriptor: string
  }>
  routeHeadline?: string
  routeWhyLine?: string
  routeStructureLabel?: string
  experienceFamily?: string
  familyConfidence?: number
  usedRecoveredCentralMomentHighlight?: boolean
  routeDebugSummary?: RouteDebugSummary
  enableActiveStopTracking?: boolean
  onFocusRole: (role: UserStopRole) => void
  onShowSwap: (role: UserStopRole) => void
  onShowNearby: (role: UserStopRole) => void
  onApplySwap: (role: UserStopRole, venueId: string) => void
  onPreviewAlternative?: (role: UserStopRole, venueId: string) => void
  onPreviewDecisionAction?: (role: UserStopRole, decision: 'keep' | 'timing') => void
  onApplyRoleShape?: (role: UserStopRole, actionId: DraftRoleShapeActionId) => void
  onApplyComposeAction?: (role: UserStopRole, actionId: DraftComposeActionId) => boolean
  onSearchCompose?: (
    role: UserStopRole,
    actionId: DraftComposeSearchActionId,
    query: string,
  ) => Promise<DraftComposeSearchResult[]>
  onCreateCustomComposeStop?: (
    role: UserStopRole,
    actionId: DraftComposeSearchActionId,
    label: string,
  ) => boolean
  onApplyComposeSearchResult?: (
    role: UserStopRole,
    actionId: DraftComposeSearchActionId,
    result: DraftComposeSearchResult,
  ) => boolean
}

export function RouteSpine({
  stops,
  storySpine,
  className,
  debugMode = false,
  adjustMode = 'full',
  allowStopAdjustments = true,
  collapseAdjustPanelKey,
  activeRole,
  changedRoles,
  animatedRoles,
  generationTrace,
  alternativesByRole,
  alternativeKindsByRole,
  roleShapeActionsByRole,
  composeActionsByRole,
  ownedStopKindsByRole,
  adjustLabel,
  adjustDisabled = false,
  adjustDisabledRoles = [],
  adjustLockedNotesByRole,
  unavailableByRole,
  highlightDecisionSignal,
  highlightDecisionSecondarySignal,
  enableInlineDetails = false,
  inlineDetailsByRole,
  appliedSwapNoteByRole,
  postSwapHintByRole,
  alertedRole = null,
  continuationEntries = [],
  routeHeadline,
  routeWhyLine,
  routeStructureLabel,
  experienceFamily,
  familyConfidence,
  usedRecoveredCentralMomentHighlight = false,
  routeDebugSummary,
  enableActiveStopTracking = false,
  onFocusRole,
  onShowSwap,
  onShowNearby,
  onApplySwap,
  onPreviewAlternative,
  onPreviewDecisionAction,
  onApplyRoleShape,
  onApplyComposeAction,
  onSearchCompose,
  onCreateCustomComposeStop,
  onApplyComposeSearchResult,
}: RouteSpineProps) {
  const [expandedRole, setExpandedRole] = useState<UserStopRole | null>(null)
  const [expandedInlineRole, setExpandedInlineRole] = useState<UserStopRole | null>(null)
  const stopElementByRoleRef = useRef<Partial<Record<UserStopRole, HTMLDivElement | null>>>({})
  const lastAutoFocusRef = useRef<{
    role: UserStopRole
    distance: number
    timestamp: number
  } | null>(null)
  const familyMode =
    typeof experienceFamily === 'string' && (familyConfidence ?? 0) >= 0.58
      ? experienceFamily
      : undefined

  useEffect(() => {
    if (expandedRole && !stops.some((stop) => stop.role === expandedRole)) {
      setExpandedRole(null)
    }
    if (expandedInlineRole && !stops.some((stop) => stop.role === expandedInlineRole)) {
      setExpandedInlineRole(null)
    }
  }, [expandedInlineRole, expandedRole, stops])

  useEffect(() => {
    if (typeof collapseAdjustPanelKey === 'number') {
      setExpandedRole(null)
    }
  }, [collapseAdjustPanelKey])

  useEffect(() => {
    if (enableInlineDetails) {
      setExpandedInlineRole(activeRole)
    }
  }, [activeRole, enableInlineDetails])

  useEffect(() => {
    if (!enableActiveStopTracking || stops.length === 0) {
      return
    }

    let rafHandle = 0
    const SWITCH_HYSTERESIS_PX = 24
    const MIN_SWITCH_INTERVAL_MS = 120

    const evaluateActiveStop = () => {
      const viewportHeight = window.innerHeight || 0
      if (viewportHeight <= 0) {
        return
      }
      const viewportAnchorY = viewportHeight * 0.36

      let bestVisibleCandidate:
        | {
            role: UserStopRole
            distance: number
          }
        | undefined
      let firstVisibleRole: UserStopRole | undefined

      for (const stop of stops) {
        const element = stopElementByRoleRef.current[stop.role]
        if (!element) {
          continue
        }
        const rect = element.getBoundingClientRect()
        const isVisible = rect.bottom > 64 && rect.top < viewportHeight - 64
        const touchesViewport = rect.bottom > 0 && rect.top < viewportHeight
        if (!touchesViewport) {
          continue
        }
        if (!firstVisibleRole) {
          firstVisibleRole = stop.role
        }
        if (!isVisible) {
          continue
        }
        const distance = Math.abs(rect.top - viewportAnchorY)
        if (!bestVisibleCandidate || distance < bestVisibleCandidate.distance) {
          bestVisibleCandidate = {
            role: stop.role,
            distance,
          }
        }
      }

      const candidate =
        bestVisibleCandidate ??
        (firstVisibleRole
          ? {
              role: firstVisibleRole,
              distance: Number.POSITIVE_INFINITY,
            }
          : undefined)

      if (!candidate || candidate.role === activeRole) {
        return
      }

      const now = Date.now()
      const activeElement = stopElementByRoleRef.current[activeRole]
      const activeDistance = activeElement
        ? Math.abs(activeElement.getBoundingClientRect().top - viewportAnchorY)
        : Number.POSITIVE_INFINITY

      const lastAutoFocus = lastAutoFocusRef.current
      const switchedRecently =
        lastAutoFocus && now - lastAutoFocus.timestamp < MIN_SWITCH_INTERVAL_MS
      const candidateNotMeaningfullyBetter =
        Number.isFinite(activeDistance) &&
        candidate.distance >= activeDistance - SWITCH_HYSTERESIS_PX
      if (switchedRecently || candidateNotMeaningfullyBetter) {
        return
      }

      lastAutoFocusRef.current = {
        role: candidate.role,
        distance: candidate.distance,
        timestamp: now,
      }
      onFocusRole(candidate.role)
    }

    const scheduleEvaluate = () => {
      if (rafHandle) {
        return
      }
      rafHandle = window.requestAnimationFrame(() => {
        rafHandle = 0
        evaluateActiveStop()
      })
    }

    scheduleEvaluate()
    window.addEventListener('scroll', scheduleEvaluate, { passive: true })
    window.addEventListener('resize', scheduleEvaluate)

    return () => {
      if (rafHandle) {
        window.cancelAnimationFrame(rafHandle)
      }
      window.removeEventListener('scroll', scheduleEvaluate)
      window.removeEventListener('resize', scheduleEvaluate)
    }
  }, [activeRole, enableActiveStopTracking, onFocusRole, stops])

  const getStopIntensity = (stop: ItineraryStop): number => {
    let intensity = 0.52
    const tagSet = new Set(stop.tags.map((tag) => tag.toLowerCase()))
    if (stop.category === 'live_music' || stop.category === 'event') {
      intensity += 0.24
    }
    if (stop.category === 'bar' || stop.category === 'activity') {
      intensity += 0.16
    }
    if (stop.category === 'cafe' || stop.category === 'dessert' || stop.category === 'park') {
      intensity -= 0.12
    }
    if (tagSet.has('late-night') || tagSet.has('high-energy') || tagSet.has('live')) {
      intensity += 0.12
    }
    if (tagSet.has('quiet') || tagSet.has('cozy') || tagSet.has('conversation')) {
      intensity -= 0.14
    }
    return Math.max(0, Math.min(1, intensity))
  }

  const getArcType = (items: ItineraryStop[]): RouteArcType => {
    const hasStart = items.some((stop) => stop.role === 'start')
    const hasHighlight = items.some((stop) => stop.role === 'highlight')
    const hasWindDown = items.some((stop) => stop.role === 'windDown')
    if (hasHighlight && hasStart && hasWindDown) {
      return 'full'
    }
    if (hasHighlight && (hasStart || hasWindDown)) {
      return 'partial'
    }
    return 'highlightOnly'
  }

  const getStructureLabel = (items: ItineraryStop[], arcType: RouteArcType): string => {
    if (routeStructureLabel) {
      return routeStructureLabel
    }
    if (arcType === 'full') {
      return 'Start \u2192 Highlight \u2192 Wind-down'
    }
    const roles = items.map((stop) => stop.role)
    if (roles.includes('start') && roles.includes('highlight')) {
      return 'Start \u2192 Highlight'
    }
    if (roles.includes('highlight') && roles.includes('windDown')) {
      return 'Highlight \u2192 Wind-down'
    }
    return 'Highlight only'
  }

  const getRoleLabel = (role: UserStopRole): string => {
    if (role === 'start') {
      return 'START'
    }
    if (role === 'highlight') {
      return 'HIGHLIGHT'
    }
    if (role === 'windDown') {
      return 'WIND-DOWN'
    }
    return 'SURPRISE'
  }

  const getRoleMicroCopy = (stop: ItineraryStop, highlightIntensity?: number): string => {
    if (stop.role === 'start') {
      if (familyMode === 'eventful' || familyMode === 'social') {
        return 'Sets the tone quickly before the central moment.'
      }
      if (familyMode === 'intimate' || familyMode === 'ambient') {
        return 'Eases you into the night with a calmer first beat.'
      }
      return 'Sets the tone and opens the route cleanly.'
    }
    if (stop.role === 'highlight') {
      if (usedRecoveredCentralMomentHighlight) {
        return 'Where the night centers around its main moment.'
      }
      if ((highlightIntensity ?? getStopIntensity(stop)) >= 0.72) {
        return 'This is the peak moment the route builds toward.'
      }
      return 'Where the night centers with its strongest beat.'
    }
    if (stop.role === 'windDown') {
      if (familyMode === 'eventful' || familyMode === 'social') {
        return 'Brings the night to a close without dropping too abruptly.'
      }
      return 'A softer landing that closes the route cleanly.'
    }
    return 'Adds contrast without breaking the route flow.'
  }

  const getTransitionLine = (
    currentStop: ItineraryStop,
    nextStop: ItineraryStop,
  ): string => {
    const intensityDelta = getStopIntensity(nextStop) - getStopIntensity(currentStop)
    if (currentStop.role === 'start' && nextStop.role === 'highlight') {
      if (intensityDelta >= 0.16) {
        return 'Builds into a stronger central moment.'
      }
      if (intensityDelta >= 0.06) {
        return 'Leads into the night\'s center.'
      }
      return 'Flows into the central moment.'
    }
    if (currentStop.role === 'highlight' && nextStop.role === 'windDown') {
      if (intensityDelta <= -0.14) {
        return 'Eases into a softer landing.'
      }
      if (intensityDelta < 0) {
        return 'Leads into a clean finish.'
      }
      return 'Carries into the close without a hard drop.'
    }
    if (nextStop.role === 'highlight') {
      return 'Builds into the next main beat.'
    }
    if (currentStop.role === 'highlight') {
      return 'Eases into the next phase.'
    }
    return intensityDelta >= 0.05 ? 'Builds into the next stop.' : 'Leads into the next stop.'
  }

  const resolvedArcType = routeDebugSummary?.arcType ?? getArcType(stops)
  const highlightStop = stops.find((stop) => stop.role === 'highlight')
  const resolvedHighlightIntensity =
    routeDebugSummary?.highlightIntensity ?? (highlightStop ? getStopIntensity(highlightStop) : undefined)
  const resolvedRecoveredHighlight =
    routeDebugSummary?.usedRecoveredCentralMomentHighlight ??
    usedRecoveredCentralMomentHighlight
  const resolvedStructureLabel = getStructureLabel(stops, resolvedArcType)
  const resolvedHeadline =
    routeHeadline ??
    storySpine?.title ??
    (resolvedArcType === 'highlightOnly'
      ? 'A single strong central moment'
      : resolvedArcType === 'partial'
        ? 'A focused route with one clear center'
        : 'A full route with clear progression')
  const resolvedWhyLine =
    routeWhyLine ??
    storySpine?.routeSummary ??
    (resolvedArcType === 'highlightOnly'
      ? 'Built around one strong anchor when local options are limited.'
      : resolvedArcType === 'partial'
        ? 'A tighter route preserving the strongest available structure.'
        : 'Built as a clear start-to-finish arc with one dominant middle moment.')

  return (
    <section className={className ? `route-spine ${className}` : 'route-spine'}>
      <div className="route-spine-header">
        <div>
          <p className="route-spine-kicker">Story Spine</p>
          <h2>Your night ahead</h2>
        </div>
        <p className="route-spine-copy">
          Starts easy, builds to a strong center, and settles into a clean finish.
        </p>
      </div>

      <div className="route-spine-arc-summary">
        <p className="route-spine-arc-headline">{resolvedHeadline}</p>
        <p className="route-spine-arc-why">{resolvedWhyLine}</p>
        <div className="route-spine-arc-meta">
          <span className="route-spine-arc-chip">{resolvedStructureLabel}</span>
          {resolvedRecoveredHighlight && (
            <span className="route-spine-arc-chip subdued">Central moment</span>
          )}
        </div>
        {debugMode && (
          <p className="route-spine-arc-debug">
            arcType={resolvedArcType} | highlightIntensity=
            {typeof resolvedHighlightIntensity === 'number'
              ? resolvedHighlightIntensity.toFixed(2)
              : 'n/a'}{' '}
            | usedRecoveredCentralMomentHighlight={String(resolvedRecoveredHighlight)}
          </p>
        )}
      </div>

      {storySpine && (
        <div className="route-spine-story-panel">
          <p className="route-spine-story-title">{storySpine.title}</p>
          <p className="route-spine-story-summary">{storySpine.routeSummary}</p>
          {storySpine.phases.length > 0 && (
            <ul className="route-spine-story-phases">
              {storySpine.phases.slice(0, 3).map((phase) => (
                <li key={`${phase.role}_${phase.label}`}>
                  <p className="route-spine-story-phase-label">{phase.label}</p>
                  <p className="route-spine-story-phase-summary">{phase.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="route-spine-list">
        {stops.map((stop, index) => {
          const nextStop = stops[index + 1]
          const changed = changedRoles.includes(stop.role)
          const animated = animatedRoles.includes(stop.role)
          const isActive = activeRole === stop.role
          const isExpanded = expandedRole === stop.role
          const stopAdjustDisabled = adjustDisabled || adjustDisabledRoles.includes(stop.role)
          const ownershipKind = ownedStopKindsByRole?.[stop.role]
          const lockedNote = adjustLockedNotesByRole?.[stop.role]
          const anchorStop = stopAdjustDisabled && Boolean(lockedNote)
          const unavailableReason = unavailableByRole?.[stop.role]
          const inlineDetail = inlineDetailsByRole?.[stop.role]
          const showInlineDetailToggle =
            enableInlineDetails &&
            Boolean(
              inlineDetail?.whyItFits ||
                inlineDetail?.knownFor ||
                inlineDetail?.goodToKnow ||
                inlineDetail?.localSignal ||
                inlineDetail?.alternatives?.length ||
                inlineDetail?.venueLinkUrl,
            )
          const inlineDetailExpanded =
            showInlineDetailToggle && expandedInlineRole === stop.role
          const appliedSwapNote = appliedSwapNoteByRole?.[stop.role]
          const postSwapHint = postSwapHintByRole?.[stop.role]
          return (
            <div key={stop.id}>
              <div
                id={`story-stop-${stop.role}`}
                ref={(element) => {
                  stopElementByRoleRef.current[stop.role] = element
                }}
                className={`route-spine-stop${isActive ? ' active' : ''}${animated ? ' animated' : ''}${
                  stop.role === 'highlight' ? ' highlight' : ''
                }${stop.role === 'highlight' && resolvedRecoveredHighlight ? ' recovered-highlight' : ''}${
                  ownershipKind === 'candidate' ? ' user-owned' : ''
                }${ownershipKind === 'custom' ? ' custom-owned' : ''}${
                  anchorStop ? ' anchor-locked' : ''
                }`}
              >
                <button
                  type="button"
                  className={`route-spine-marker${changed ? ' changed' : ''}`}
                  onClick={() => onFocusRole(stop.role)}
                >
                  <span>0{index + 1}</span>
                </button>

                <div className="route-spine-content">
                  <div className="route-spine-role-row">
                    <span className={`route-spine-role-chip${stop.role === 'highlight' ? ' is-highlight' : ''}`}>
                      {getRoleLabel(stop.role)}
                    </span>
                    {stop.role === 'highlight' && (
                      <span className="route-spine-role-accent">
                        {resolvedRecoveredHighlight ? 'Central moment' : 'Peak moment'}
                      </span>
                    )}
                    <p className="route-spine-role-microcopy">
                      {getRoleMicroCopy(stop, resolvedHighlightIntensity)}
                    </p>
                  </div>

                  <StopCard
                    stop={stop}
                    sequence={index}
                    active={isActive}
                    changed={changed}
                    ownershipKind={ownershipKind}
                    locked={anchorStop}
                    anchorStop={anchorStop}
                    adjustmentOpen={isExpanded}
                    adjustLabel={allowStopAdjustments ? adjustLabel : undefined}
                    adjustDisabled={stopAdjustDisabled}
                    adjustNote={lockedNote}
                    unavailable={Boolean(unavailableReason)}
                    unavailableReason={unavailableReason}
                    highlightDecisionSignal={highlightDecisionSignal}
                    highlightDecisionSecondarySignal={highlightDecisionSecondarySignal}
                    inlineDetail={inlineDetail}
                    appliedSwapNote={appliedSwapNote}
                    postSwapHint={postSwapHint}
                    inlineDetailExpanded={Boolean(inlineDetailExpanded)}
                    showInlineDetailToggle={showInlineDetailToggle}
                    liveAlerted={alertedRole === stop.role}
                    debugMode={debugMode}
                    onFocus={() => onFocusRole(stop.role)}
                    onAdjust={
                      allowStopAdjustments
                        ? () => {
                            onFocusRole(stop.role)
                            const nextExpandedRole = isExpanded ? null : stop.role
                            if (nextExpandedRole === stop.role && adjustMode === 'swap-only') {
                              onShowSwap(stop.role)
                            }
                            setExpandedRole(nextExpandedRole)
                          }
                        : undefined
                    }
                    onToggleInlineDetail={
                      showInlineDetailToggle
                        ? () =>
                            setExpandedInlineRole((current) =>
                              current === stop.role ? null : stop.role,
                            )
                        : undefined
                    }
                    onPreviewAlternative={onPreviewAlternative}
                    onPreviewDecisionAction={onPreviewDecisionAction}
                  />

                  {allowStopAdjustments && !stopAdjustDisabled && (
                    <NearbyNodeGroup
                      stop={stop}
                      mode={adjustMode}
                      isExpanded={isExpanded}
                      ownershipKind={ownershipKind}
                      visibleKind={alternativeKindsByRole[stop.role]}
                      alternatives={alternativesByRole[stop.role] ?? []}
                      nearbyCount={generationTrace?.nearbyAlternativeCounts[stop.role]}
                      swapCount={generationTrace?.alternativeCounts[stop.role]}
                      roleShapeActions={roleShapeActionsByRole?.[stop.role] ?? []}
                      composeActions={composeActionsByRole?.[stop.role] ?? []}
                      onShowSwap={() => onShowSwap(stop.role)}
                      onShowNearby={() => onShowNearby(stop.role)}
                      onApplySwap={(venueId) => onApplySwap(stop.role, venueId)}
                      onApplyRoleShape={(actionId) => onApplyRoleShape?.(stop.role, actionId)}
                      onApplyComposeAction={(actionId) =>
                        onApplyComposeAction ? onApplyComposeAction(stop.role, actionId) : false
                      }
                      onSearchCompose={(actionId, query) =>
                        onSearchCompose
                          ? onSearchCompose(stop.role, actionId, query)
                          : Promise.resolve([])
                      }
                      onCreateCustomComposeStop={(actionId, label) =>
                        onCreateCustomComposeStop
                          ? onCreateCustomComposeStop(stop.role, actionId, label)
                          : false
                      }
                      onApplyComposeSearchResult={(actionId, result) =>
                        onApplyComposeSearchResult
                          ? onApplyComposeSearchResult(stop.role, actionId, result)
                          : false
                      }
                    />
                  )}
                </div>
              </div>

              {nextStop && (
                <p className="route-spine-transition-line">
                  {getTransitionLine(stop, nextStop)}
                </p>
              )}
            </div>
          )
        })}

        {continuationEntries.length > 0 && (
          <div className="route-spine-continuation-list">
            <p className="route-spine-continuation-kicker">Continuation</p>
            {continuationEntries.map((entry) => (
              <article key={entry.id} className="route-spine-continuation-item">
                <p className="route-spine-continuation-title">{entry.title}</p>
                <p className="route-spine-continuation-copy">{entry.descriptor}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
