import { useEffect, useState } from 'react'
import { ID8Butler } from '../components/butler/ID8Butler'
import { ExtendOutingSection } from '../components/exploration/ExtendOutingSection'
import { RefineSheet } from '../components/flow/RefineSheet'
import { DistrictFlowNarrative } from '../components/journey/DistrictFlowNarrative'
import { JourneyMap } from '../components/journey/JourneyMap'
import { RevealDebugPanels } from '../components/journey/RevealDebugPanels'
import { RouteSpine } from '../components/journey/RouteSpine'
import { PageShell } from '../components/layout/PageShell'
import type { LightNearbyExtensionOption } from '../domain/exploration/deriveLightNearbyExtensions'
import type { ExplorationPlan } from '../domain/exploration/types'
import type { GenerationTrace } from '../domain/runGeneratePlan'
import type { StopAlternative, StopAlternativeKind } from '../domain/types/arc'
import type { Itinerary, UserStopRole } from '../domain/types/itinerary'
import type { RefinementMode } from '../domain/types/refinement'
import type { RefinementOutcome } from '../domain/types/refinementOutcome'

interface RevealPageProps {
  itinerary: Itinerary
  selectedRefinements: RefinementMode[]
  generationTrace?: GenerationTrace
  compositionConflictMessage?: string
  explorationPlan?: ExplorationPlan
  explorationLoading: boolean
  lightNearbyExtensions: LightNearbyExtensionOption[]
  alternativesByRole: Partial<Record<UserStopRole, StopAlternative[]>>
  alternativeKindsByRole: Partial<Record<UserStopRole, StopAlternativeKind>>
  forceDebug?: boolean
  showRoadmap?: boolean
  showExtensions?: boolean
  showDebugPanels?: boolean
  onShowSwap: (role: UserStopRole) => void
  onShowNearby: (role: UserStopRole) => void
  onApplySwap: (role: UserStopRole, venueId: string) => void
  onApplyRefinement: (modes: RefinementMode[]) => void
  onContinueOuting: () => void
  onBackToPreview: () => void
  onLock: () => void
  onStartOver: () => void
}

type AnchorStatus = 'ok' | 'conflict' | 'dropped'

const revealPlaceholderItems = [
  'Keep going nearby',
  'Try a different area',
  'Share with friends',
  'Book this plan',
]

function buildRouteMeta(itinerary: Itinerary): string {
  const location = itinerary.neighborhood
    ? `${itinerary.neighborhood}, ${itinerary.city}`
    : itinerary.city
  return `${itinerary.stops.length} stops | ${location}`
}

function buildRefinementBannerMessage(
  refinementOutcome?: RefinementOutcome,
): string | undefined {
  if (!refinementOutcome) {
    return undefined
  }

  const changedRoles = refinementOutcome.stopDeltas
    .filter((delta) => delta.changed)
    .map((delta) => delta.role)

  if (refinementOutcome.materiallyChangedStopCount === 0) {
    return 'No stronger nearby option matched that change.'
  }
  if (
    changedRoles.includes('start') &&
    refinementOutcome.requestedModes.includes('more-unique')
  ) {
    return 'Start changed for a more unique opening.'
  }
  if (
    refinementOutcome.requestedModes.includes('closer-by') &&
    refinementOutcome.changedStopCount > 0
  ) {
    return 'Route tightened for a closer night out.'
  }
  if (
    changedRoles.includes('highlight') &&
    refinementOutcome.requestedModes.includes('more-exciting')
  ) {
    return 'Highlight changed for a stronger centerpiece.'
  }
  if (
    changedRoles.includes('windDown') &&
    refinementOutcome.requestedModes.includes('more-relaxed')
  ) {
    return 'Wind Down shifted into a softer finish.'
  }
  return refinementOutcome.summaryMessage
}

function getAnchorStatus(generationTrace?: GenerationTrace): AnchorStatus {
  if (!generationTrace?.anchorApplied) {
    return 'ok'
  }

  const anchorTrace = generationTrace.constraintTrace.find((entry) => entry.type === 'anchor')
  const hasConstraintConflict = generationTrace.constraintTrace.some(
    (entry) => entry.decision === 'conflict',
  )

  if (hasConstraintConflict || anchorTrace?.decision === 'conflict') {
    return 'conflict'
  }

  if (generationTrace.anchorSurvivedToArc === false || anchorTrace?.decision === 'failed') {
    return 'dropped'
  }

  return 'ok'
}

function buildAnchorStatusMessage(
  generationTrace?: GenerationTrace,
): { status: AnchorStatus; message?: string; detail?: string } {
  const status = getAnchorStatus(generationTrace)
  if (status === 'ok') {
    return { status }
  }

  const message =
    generationTrace?.temporalTrace.mode === 'explicit'
      ? "This place isn't available at your selected time."
      : "We couldn't build a plan around this place."
  const detail =
    status === 'conflict'
      ? 'The selected time created a hard conflict, so the route stayed realistic instead of forcing the anchor.'
      : 'The route could not keep this place as the required anchor and still produce a viable plan.'

  return { status, message, detail }
}

export function RevealPage({
  itinerary,
  selectedRefinements,
  generationTrace,
  compositionConflictMessage,
  explorationPlan,
  explorationLoading,
  lightNearbyExtensions,
  alternativesByRole,
  alternativeKindsByRole,
  forceDebug = false,
  showRoadmap = true,
  showExtensions = true,
  showDebugPanels = true,
  onShowSwap,
  onShowNearby,
  onApplySwap,
  onApplyRefinement,
  onContinueOuting,
  onBackToPreview,
  onLock,
  onStartOver,
}: RevealPageProps) {
  const [showRefineSheet, setShowRefineSheet] = useState(false)
  const [showFullConfirmReview, setShowFullConfirmReview] = useState(false)
  const [activeRole, setActiveRole] = useState<UserStopRole>('start')
  const [animatedRoles, setAnimatedRoles] = useState<UserStopRole[]>([])
  const debugEnabled =
    (showDebugPanels && forceDebug) ||
    (showDebugPanels && typeof window !== 'undefined' && window.location.search.includes('debug=1'))
  const refinementOutcome = generationTrace?.refinementOutcome
  const changedRoles =
    refinementOutcome?.stopDeltas.filter((delta) => delta.changed).map((delta) => delta.role) ??
    []
  const refinementBannerMessage = buildRefinementBannerMessage(refinementOutcome)
  const anchorStatusMessage = buildAnchorStatusMessage(generationTrace)
  const startStop = itinerary.stops.find((stop) => stop.role === 'start')
  const highlightStop = itinerary.stops.find((stop) => stop.role === 'highlight')
  const windDownStop = itinerary.stops.find((stop) => stop.role === 'windDown')

  useEffect(() => {
    if (!itinerary.stops.some((stop) => stop.role === activeRole)) {
      setActiveRole('start')
    }
  }, [activeRole, itinerary.stops])

  useEffect(() => {
    setShowFullConfirmReview(false)
  }, [itinerary.id])

  useEffect(() => {
    if (!refinementOutcome?.nextItineraryId) {
      return
    }
    const nextAnimatedRoles = refinementOutcome.stopDeltas
      .filter((delta) => delta.changed)
      .map((delta) => delta.role)
    if (nextAnimatedRoles.length === 0) {
      return
    }
    setActiveRole(nextAnimatedRoles[0] ?? 'start')
    setAnimatedRoles(nextAnimatedRoles)
    const timeoutId = window.setTimeout(() => setAnimatedRoles([]), 2200)
    return () => window.clearTimeout(timeoutId)
  }, [refinementOutcome?.nextItineraryId, refinementOutcome?.stopDeltas])

  return (
    <PageShell
      topSlot={
        <ID8Butler message="Your route is set. Follow the main spine first, then open nearby branches only if you want extra room to wander." />
      }
      title={itinerary.story.headline}
      subtitle={itinerary.story.subtitle}
      footer={
        <div className="action-row wrap">
          <button type="button" className="ghost-button subtle" onClick={onBackToPreview}>
            Back to Preview
          </button>
          <button type="button" className="ghost-button" onClick={onStartOver}>
            Start Over
          </button>
          {!showFullConfirmReview ? (
            <button
              type="button"
              className="primary-button"
              onClick={() => setShowFullConfirmReview(true)}
            >
              Review full route
            </button>
          ) : (
            <>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setShowRefineSheet(true)}
              >
                Refine It
              </button>
              <button type="button" className="primary-button" onClick={onLock}>
                Lock this night
              </button>
            </>
          )}
        </div>
      }
    >
      {!showFullConfirmReview && (
        <section className="plan-update-panel" aria-label="Generated route summary">
          <div className="plan-update-header">
            <p className="discovery-group-kicker">Generated route summary</p>
          </div>
          <p className="plan-update-headline">{itinerary.story.headline}</p>
          <div className="plan-update-lists">
            <div>
              <p className="plan-update-list-title">Start</p>
              <ul className="plan-update-list">
                <li>{startStop?.venueName ?? 'Not available'}</li>
              </ul>
            </div>
            <div>
              <p className="plan-update-list-title">Highlight</p>
              <ul className="plan-update-list">
                <li>{highlightStop?.venueName ?? 'Not available'}</li>
              </ul>
            </div>
            <div>
              <p className="plan-update-list-title">Wind Down</p>
              <ul className="plan-update-list">
                <li>{windDownStop?.venueName ?? 'Not available'}</li>
              </ul>
            </div>
          </div>
        </section>
      )}

      {showFullConfirmReview && (
        <>
      <div className="reveal-story-meta">
        <span className="reveal-story-chip">Guided story</span>
        <span className="reveal-story-chip">{buildRouteMeta(itinerary)}</span>
        <span className="reveal-story-chip">{itinerary.estimatedTotalLabel}</span>
        <span className="reveal-story-chip">{itinerary.routeFeelLabel}</span>
      </div>
      <div className="reveal-story-meta" aria-label="Built with">
        <span className="reveal-story-chip">Built with:</span>
        <span className="reveal-story-chip">Real-time availability</span>
        <span className="reveal-story-chip">Local context</span>
        <span className="reveal-story-chip">Flow optimization</span>
      </div>

      <div className="stage-rail" aria-label="Journey stages">
        <span className="stage-rail-item">Explore</span>
        <span className="stage-rail-item">Draft</span>
        <span className="stage-rail-item">Tune</span>
        <span className="stage-rail-item">Confirm</span>
        <span className="stage-rail-item active">Experience</span>
      </div>

      <JourneyMap
        itinerary={itinerary}
        activeRole={activeRole}
        changedRoles={changedRoles}
        visibleAlternativesByRole={alternativesByRole}
        nearbyCounts={generationTrace?.nearbyAlternativeCounts ?? {}}
        onActiveRoleChange={setActiveRole}
      />

      <DistrictFlowNarrative itinerary={itinerary} />

      {refinementBannerMessage && (
        <div className="refinement-banner">
          <p className="refinement-banner-kicker">Refinement Update</p>
          <p className="refinement-banner-copy">{refinementBannerMessage}</p>
        </div>
      )}

      {anchorStatusMessage.status !== 'ok' && anchorStatusMessage.message && (
        <div className="refinement-banner">
          <p className="refinement-banner-kicker">&#9888;&#65039; Anchor Issue</p>
          <p className="refinement-banner-copy">{anchorStatusMessage.message}</p>
          {anchorStatusMessage.detail && (
            <p className="refinement-banner-copy">{anchorStatusMessage.detail}</p>
          )}
        </div>
      )}

      {compositionConflictMessage && (
        <div className="refinement-banner">
          <p className="refinement-banner-kicker">Composition Constraint</p>
          <p className="refinement-banner-copy">{compositionConflictMessage}</p>
        </div>
      )}

      <RouteSpine
        stops={itinerary.stops}
        storySpine={itinerary.storySpine}
        debugMode={debugEnabled}
        allowStopAdjustments={false}
        activeRole={activeRole}
        changedRoles={changedRoles}
        animatedRoles={animatedRoles}
        generationTrace={generationTrace}
        alternativesByRole={alternativesByRole}
        alternativeKindsByRole={alternativeKindsByRole}
        onFocusRole={setActiveRole}
        onShowSwap={onShowSwap}
        onShowNearby={onShowNearby}
        onApplySwap={onApplySwap}
      />

      {showExtensions && (
        <ExtendOutingSection
          options={lightNearbyExtensions}
          explorationPlan={explorationPlan}
          explorationLoading={explorationLoading}
          onContinueOuting={onContinueOuting}
        />
      )}

      {showRoadmap && (
        <section className="roadmap-panel" aria-label="Coming later">
          <div className="roadmap-panel-header">
            <p className="discovery-group-kicker">Coming later</p>
            <p className="discovery-group-copy">
              These extensions are visible here to show the fuller journey, but none are live yet.
            </p>
          </div>
          <div className="roadmap-grid">
            {revealPlaceholderItems.map((item) => (
              <div key={item} className="roadmap-item">
                <span>{item}</span>
                <small>Later</small>
              </div>
            ))}
          </div>
        </section>
      )}

      {showDebugPanels && debugEnabled && generationTrace && (
        <RevealDebugPanels
          itinerary={itinerary}
          generationTrace={generationTrace}
        />
      )}
        </>
      )}

      {showRefineSheet && (
        <RefineSheet
          initialModes={selectedRefinements}
          onClose={() => setShowRefineSheet(false)}
          onApply={(modes) => {
            setShowRefineSheet(false)
            onApplyRefinement(modes)
          }}
        />
      )}
    </PageShell>
  )
}
