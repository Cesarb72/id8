import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ID8Butler } from '../components/butler/ID8Butler'
import { RouteSpine } from '../components/journey/RouteSpine'
import { PageShell } from '../components/layout/PageShell'
import type {
  DraftComposeAction,
  DraftComposeActionId,
  DraftComposeSearchActionId,
  DraftComposeSearchResult,
} from '../domain/arc/composeDraftArc'
import type { DraftRoleShapeAction, DraftRoleShapeActionId } from '../domain/arc/reshapeArcStop'
import type { GenerationTrace } from '../domain/runGeneratePlan'
import type { StopAlternative, StopAlternativeKind } from '../domain/types/arc'
import type { BudgetPreference, DistanceMode } from '../domain/types/intent'
import type { PlanAdjustmentFeedback } from '../domain/types/planAdjustmentFeedback'
import type {
  PreviewControls,
  PreviewDistanceTolerance,
  PreviewEnergyBias,
} from '../domain/types/previewControls'
import type { Itinerary, UserStopRole } from '../domain/types/itinerary'
import type { LceRepairProposal } from '../domain/lce/lceRepair'

interface PreviewPageProps {
  itinerary: Itinerary
  generationTrace?: GenerationTrace
  planAdjustmentFeedback?: PlanAdjustmentFeedback
  neighborhood?: string
  startTime?: string
  distanceMode: DistanceMode
  budget?: BudgetPreference
  previewControls: PreviewControls
  previewDirty: boolean
  compositionConflictMessage?: string
  alternativesByRole: Partial<Record<UserStopRole, StopAlternative[]>>
  alternativeKindsByRole: Partial<Record<UserStopRole, StopAlternativeKind>>
  roleShapeActionsByRole: Partial<Record<UserStopRole, DraftRoleShapeAction[]>>
  composeActionsByRole: Partial<Record<UserStopRole, DraftComposeAction[]>>
  ownedStopKindsByRole: Partial<Record<UserStopRole, 'candidate' | 'custom'>>
  adjustDisabledRoles?: UserStopRole[]
  adjustLockedNotesByRole?: Partial<Record<UserStopRole, string>>
  unavailableByRole?: Partial<Record<UserStopRole, 'removed' | 'unavailable'>>
  lceRepairProposal?: LceRepairProposal
  lceTraceNote?: string
  lceSystemMessage?: string
  debugPanel?: ReactNode
  onChangePreviewControls: (patch: Partial<PreviewControls>) => void
  onChangeNeighborhood: (neighborhood?: string) => void
  onChangeBudget: (budget?: BudgetPreference) => void
  onShowSwap: (role: UserStopRole) => void
  onApplySwap: (role: UserStopRole, venueId: string) => void
  onApplyRoleShape: (role: UserStopRole, actionId: DraftRoleShapeActionId) => boolean
  onApplyComposeAction: (role: UserStopRole, actionId: DraftComposeActionId) => boolean
  onSearchCompose: (
    role: UserStopRole,
    actionId: DraftComposeSearchActionId,
    query: string,
  ) => Promise<DraftComposeSearchResult[]>
  onCreateCustomComposeStop: (
    role: UserStopRole,
    actionId: DraftComposeSearchActionId,
    label: string,
  ) => boolean
  onApplyComposeSearchResult: (
    role: UserStopRole,
    actionId: DraftComposeSearchActionId,
    result: DraftComposeSearchResult,
  ) => boolean
  onApplyLceRepairProposal: () => void
  onKeepCurrentPlanAfterLce: () => void
  backLabel?: string
  refreshLabel?: string
  refreshDisabled?: boolean
  showRoadmap?: boolean
  onBack: () => void
  onRefresh: () => void
  onConfirm: () => void
}

const neighborhoodOptions = [
  'Downtown',
  'SoFA District',
  'Santana Row',
  'Rose Garden',
  'Willow Glen',
  'Kelley Park',
  'North San Jose',
  'Alum Rock',
  'Evergreen',
]

const draftPlaceholderItems = [
  'Extend this night',
  'Best start time',
  'Group input',
  'Availability & booking',
]

function buildDraftSummary(distanceMode: DistanceMode): string {
  if (distanceMode === 'short-drive') {
    return 'Built around your vibe with a little more range for stronger options.'
  }
  return 'Built around your vibe and nearby options.'
}

function buildDraftFeedback({
  previewDirty,
  districtPreference,
  neighborhood,
  startTime,
  distanceTolerance,
  energyBias,
}: {
  previewDirty: boolean
  districtPreference?: string
  neighborhood?: string
  startTime?: string
  distanceTolerance: PreviewDistanceTolerance
  energyBias: PreviewEnergyBias
}): string {
  if (previewDirty) {
    return 'Your preview controls are ready. Adjust plan to refresh this route.'
  }
  if (districtPreference) {
    return 'This draft is currently tuned toward your preferred district.'
  }
  if (startTime) {
    return 'We adjusted this draft to better fit your selected time.'
  }
  if (neighborhood) {
    return 'This draft stays close to your selected area.'
  }
  if (distanceTolerance === 'compact') {
    return 'We kept this route tight so everything stays easy to reach.'
  }
  if (distanceTolerance === 'open') {
    return 'This route has more movement range for wider coverage.'
  }
  if (energyBias === 'softer') {
    return 'This route is currently tuned toward a softer energy curve.'
  }
  if (energyBias === 'stronger') {
    return 'This route is currently tuned toward a stronger energy curve.'
  }
  return 'We gave this draft a little more range to open up stronger combinations.'
}

function buildEffectStrengthLabel(value: PlanAdjustmentFeedback['effectStrength']): string {
  if (value === 'strong') {
    return 'Strong update'
  }
  if (value === 'moderate') {
    return 'Moderate update'
  }
  return 'Minor update'
}

function buildStopReference(itinerary: Itinerary, role: UserStopRole) {
  return itinerary.stops.find((stop) => stop.role === role)
}

function buildRoleShapeSummary(
  itinerary: Itinerary,
  role: UserStopRole,
  action: DraftRoleShapeAction,
): string {
  const stop = buildStopReference(itinerary, role)
  const label = stop?.venueName ?? 'that stop'

  if (action.id === 'use-to-start') {
    return `Moved ${label} to the start of the night`
  }
  if (action.id === 'make-main') {
    return `Made ${label} the main stop`
  }
  if (action.id === 'save-for-later') {
    return `Saved ${label} for later in the night`
  }
  return `Moved ${label} to the end of the night`
}

function buildReplaceSummary(
  itinerary: Itinerary,
  role: UserStopRole,
  nextLabel: string,
): string {
  const stop = buildStopReference(itinerary, role)
  const roleLabel = stop?.title.toLowerCase() ?? 'this stop'
  return `Replaced ${roleLabel} with ${nextLabel}`
}

function buildRouteChangeSummary(
  itinerary: Itinerary,
  role: UserStopRole,
  actionId: DraftComposeActionId,
  nextLabel?: string,
): string {
  const stop = buildStopReference(itinerary, role)
  const currentLabel = stop?.venueName ?? 'this stop'

  if (actionId === 'remove-stop') {
    return `Removed ${currentLabel} from the route`
  }
  if (actionId === 'replace-stop' && nextLabel) {
    return buildReplaceSummary(itinerary, role, nextLabel)
  }
  if (actionId === 'add-before') {
    return `Added ${nextLabel ?? 'a stop'} before ${currentLabel}`
  }
  return `Added ${nextLabel ?? 'a stop'} after ${currentLabel}`
}

export function PreviewPage({
  itinerary,
  generationTrace,
  planAdjustmentFeedback,
  neighborhood,
  startTime,
  distanceMode,
  budget,
  previewControls,
  previewDirty,
  compositionConflictMessage,
  alternativesByRole,
  alternativeKindsByRole,
  roleShapeActionsByRole,
  composeActionsByRole,
  ownedStopKindsByRole,
  adjustDisabledRoles = [],
  adjustLockedNotesByRole,
  unavailableByRole,
  lceRepairProposal,
  lceTraceNote,
  lceSystemMessage,
  debugPanel,
  onChangePreviewControls,
  onChangeNeighborhood,
  onChangeBudget,
  onShowSwap,
  onApplySwap,
  onApplyRoleShape,
  onApplyComposeAction,
  onSearchCompose,
  onCreateCustomComposeStop,
  onApplyComposeSearchResult,
  onApplyLceRepairProposal,
  onKeepCurrentPlanAfterLce,
  backLabel = 'Back to Explore',
  refreshLabel = 'Adjust plan',
  refreshDisabled = !previewDirty,
  showRoadmap = true,
  onBack,
  onRefresh,
  onConfirm,
}: PreviewPageProps) {
  const [activeRole, setActiveRole] = useState<UserStopRole>(
    itinerary.stops.find((stop) => stop.role === 'highlight')?.role ??
      itinerary.stops[0]?.role ??
      'start',
  )
  const [changedRoles, setChangedRoles] = useState<UserStopRole[]>([])
  const [animatedRoles, setAnimatedRoles] = useState<UserStopRole[]>([])
  const [recentEditSummary, setRecentEditSummary] = useState<string>()
  const [collapseAdjustPanelKey, setCollapseAdjustPanelKey] = useState(0)
  const previousStopsByRoleRef = useRef<Partial<Record<UserStopRole, string>> | undefined>(
    undefined,
  )
  const recommendedDistricts = generationTrace?.recommendedDistricts ?? []
  const districtPreference =
    previewControls.districtPreference ?? generationTrace?.selectedDistrictId ?? ''
  const distanceTolerance: PreviewDistanceTolerance =
    previewControls.distanceTolerance ?? (distanceMode === 'short-drive' ? 'open' : 'balanced')
  const energyBias: PreviewEnergyBias = previewControls.energyBias ?? 'balanced'
  const startTimeValue = previewControls.startTime ?? startTime ?? ''
  const feedbackCopy = buildDraftFeedback({
    previewDirty,
    districtPreference: districtPreference || undefined,
    neighborhood,
    startTime: startTimeValue || undefined,
    distanceTolerance,
    energyBias,
  })

  useEffect(() => {
    if (!itinerary.stops.some((stop) => stop.role === activeRole)) {
      setActiveRole(itinerary.stops[0]?.role ?? 'start')
    }
  }, [activeRole, itinerary.stops])

  useEffect(() => {
    const nextStopsByRole = itinerary.stops.reduce<Partial<Record<UserStopRole, string>>>(
      (accumulator, stop) => {
        accumulator[stop.role] = stop.venueId
        return accumulator
      },
      {},
    )
    const previousStopsByRole = previousStopsByRoleRef.current
    previousStopsByRoleRef.current = nextStopsByRole

    if (!previousStopsByRole) {
      return
    }

    let nextChangedRoles = itinerary.stops
      .filter((stop) => previousStopsByRole[stop.role] !== stop.venueId)
      .map((stop) => stop.role)

    const previousRoles = Object.keys(previousStopsByRole) as UserStopRole[]
    const nextRoles = itinerary.stops.map((stop) => stop.role)
    const structuralChangeDetected =
      previousRoles.length !== nextRoles.length ||
      previousRoles.some((role) => !nextRoles.includes(role)) ||
      nextRoles.some((role) => !previousRoles.includes(role))

    if (structuralChangeDetected && nextChangedRoles.length === 0) {
      nextChangedRoles = nextRoles
    }

    setChangedRoles(nextChangedRoles)
    if (nextChangedRoles.length === 0) {
      setAnimatedRoles([])
      return
    }

    setActiveRole(nextChangedRoles[0] ?? 'start')
    setAnimatedRoles(nextChangedRoles)
    const timeoutId = window.setTimeout(() => setAnimatedRoles([]), 1800)
    return () => window.clearTimeout(timeoutId)
  }, [itinerary.id, itinerary.stops])

  const handleApplyRoleShape = (role: UserStopRole, action: DraftRoleShapeAction) => {
    const applied = onApplyRoleShape(role, action.id)
    if (!applied) {
      return
    }
    setActiveRole(action.targetRole)
    setRecentEditSummary(buildRoleShapeSummary(itinerary, role, action))
    setCollapseAdjustPanelKey((current) => current + 1)
  }

  const handleApplySwap = (role: UserStopRole, venueId: string) => {
    onApplySwap(role, venueId)
    const nextLabel =
      alternativesByRole[role]?.find((option) => option.scoredVenue.venue.id === venueId)?.scoredVenue
        .venue.name ?? 'a new option'
    setActiveRole(role)
    setRecentEditSummary(buildReplaceSummary(itinerary, role, nextLabel))
  }

  const handleApplyComposeAction = (role: UserStopRole, action: DraftComposeAction) => {
    const applied = onApplyComposeAction(role, action.id)
    if (!applied) {
      return false
    }
    setActiveRole(role)
    setRecentEditSummary(buildRouteChangeSummary(itinerary, role, action.id))
    setCollapseAdjustPanelKey((current) => current + 1)
    return true
  }

  const handleApplyComposeSearchResult = (
    role: UserStopRole,
    action: DraftComposeAction,
    result: DraftComposeSearchResult,
  ) => {
    const applied = onApplyComposeSearchResult(role, action.id as DraftComposeSearchActionId, result)
    if (!applied) {
      return false
    }
    setActiveRole(action.id === 'replace-stop' ? role : 'surprise')
    setRecentEditSummary(buildRouteChangeSummary(itinerary, role, action.id, result.title))
    setCollapseAdjustPanelKey((current) => current + 1)
    return true
  }

  return (
    <PageShell
      topSlot={
        <ID8Butler message="Here is the draft version of your night. Read the story spine first, then adjust individual stops if you want to reshape the plan without rebuilding it." />
      }
      title="Draft your night"
      subtitle={buildDraftSummary(distanceMode)}
    >
      <div className="draft-page-topline">
        <div className="reveal-story-meta">
          <span className="reveal-story-chip draft-chip">Draft</span>
          <span className="reveal-story-chip">{itinerary.estimatedTotalLabel}</span>
          <span className="reveal-story-chip">{itinerary.routeFeelLabel}</span>
        </div>
        <button type="button" className="ghost-button subtle draft-back-link" onClick={onBack}>
          {backLabel}
        </button>
      </div>
      <div className="reveal-story-meta" aria-label="Built with">
        <span className="reveal-story-chip">Built with:</span>
        <span className="reveal-story-chip">Real-time availability</span>
        <span className="reveal-story-chip">Local context</span>
        <span className="reveal-story-chip">Flow optimization</span>
      </div>
      <section className="preview-controls-panel" aria-label="Preview controls">
        <div className="preview-controls-header">
          <div>
            <p className="discovery-group-kicker">Preview controls</p>
            <h3>Lightly steer this route</h3>
          </div>
          <button
            type="button"
            className="ghost-button"
            disabled={refreshDisabled}
            onClick={onRefresh}
          >
            {refreshLabel}
          </button>
        </div>
        <div className="preview-controls-grid">
          {recommendedDistricts.length > 0 && (
            <label className="input-group">
              <span className="input-label">Preferred area</span>
              <select
                value={districtPreference}
                onChange={(event) =>
                  onChangePreviewControls({
                    districtPreference: event.target.value || undefined,
                  })
                }
              >
                <option value="">Let planner decide</option>
                {recommendedDistricts.map((district) => (
                  <option key={district.districtId} value={district.districtId}>
                    {district.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="input-group">
            <span className="input-label">Start time</span>
            <input
              type="time"
              value={startTimeValue}
              onChange={(event) =>
                onChangePreviewControls({
                  startTime: event.target.value || undefined,
                })
              }
              placeholder="20:00"
            />
          </label>
          <fieldset className="input-group">
            <legend className="input-label">Distance tolerance</legend>
            <div className="toggle-row">
              <button
                type="button"
                className={`toggle-pill${distanceTolerance === 'compact' ? ' selected' : ''}`}
                onClick={() =>
                  onChangePreviewControls({
                    distanceTolerance: 'compact',
                  })
                }
              >
                Compact
              </button>
              <button
                type="button"
                className={`toggle-pill${distanceTolerance === 'balanced' ? ' selected' : ''}`}
                onClick={() =>
                  onChangePreviewControls({
                    distanceTolerance: 'balanced',
                  })
                }
              >
                Balanced
              </button>
              <button
                type="button"
                className={`toggle-pill${distanceTolerance === 'open' ? ' selected' : ''}`}
                onClick={() =>
                  onChangePreviewControls({
                    distanceTolerance: 'open',
                  })
                }
              >
                Open
              </button>
            </div>
          </fieldset>
          <fieldset className="input-group">
            <legend className="input-label">Energy bias</legend>
            <div className="toggle-row">
              <button
                type="button"
                className={`toggle-pill${energyBias === 'softer' ? ' selected' : ''}`}
                onClick={() =>
                  onChangePreviewControls({
                    energyBias: 'softer',
                  })
                }
              >
                Softer
              </button>
              <button
                type="button"
                className={`toggle-pill${energyBias === 'balanced' ? ' selected' : ''}`}
                onClick={() =>
                  onChangePreviewControls({
                    energyBias: 'balanced',
                  })
                }
              >
                Balanced
              </button>
              <button
                type="button"
                className={`toggle-pill${energyBias === 'stronger' ? ' selected' : ''}`}
                onClick={() =>
                  onChangePreviewControls({
                    energyBias: 'stronger',
                  })
                }
              >
                Stronger
              </button>
            </div>
          </fieldset>
        </div>
      </section>
      {planAdjustmentFeedback && (
        <section className="plan-update-panel" aria-label="Plan update">
          <div className="plan-update-header">
            <p className="discovery-group-kicker">Plan update</p>
            <span
              className={`plan-update-strength plan-update-strength-${planAdjustmentFeedback.effectStrength}`}
            >
              {buildEffectStrengthLabel(planAdjustmentFeedback.effectStrength)}
            </span>
          </div>
          <p className="plan-update-headline">{planAdjustmentFeedback.headline}</p>
          <div className="plan-update-lists">
            <div>
              <p className="plan-update-list-title">What changed</p>
              <ul className="plan-update-list">
                {planAdjustmentFeedback.changeSummary.map((item) => (
                  <li key={`change-${item}`}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="plan-update-list-title">Why this still works</p>
              <ul className="plan-update-list">
                {planAdjustmentFeedback.trustNotes.map((item) => (
                  <li key={`trust-${item}`}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      <div className="stage-rail" aria-label="Journey stages">
        <span className="stage-rail-item">Explore</span>
        <span className="stage-rail-item active">Draft</span>
        <span className="stage-rail-item active">Tune</span>
        <span className="stage-rail-item">Confirm</span>
        <span className="stage-rail-item">Experience</span>
      </div>

      <RouteSpine
        className="draft-story-spine"
        stops={itinerary.stops}
        storySpine={itinerary.storySpine}
        debugMode={false}
        adjustMode="swap-only"
        collapseAdjustPanelKey={collapseAdjustPanelKey}
        activeRole={activeRole}
        changedRoles={changedRoles}
        animatedRoles={animatedRoles}
        generationTrace={generationTrace}
        alternativesByRole={alternativesByRole}
        alternativeKindsByRole={alternativeKindsByRole}
        roleShapeActionsByRole={roleShapeActionsByRole}
        composeActionsByRole={composeActionsByRole}
        ownedStopKindsByRole={ownedStopKindsByRole}
        adjustDisabledRoles={adjustDisabledRoles}
        adjustLockedNotesByRole={adjustLockedNotesByRole}
        unavailableByRole={unavailableByRole}
        adjustLabel="Edit"
        onFocusRole={setActiveRole}
        onShowSwap={onShowSwap}
        onShowNearby={() => undefined}
        onApplySwap={handleApplySwap}
        onApplyRoleShape={(roleToShape, actionId) => {
          const action = roleShapeActionsByRole[roleToShape]?.find((item) => item.id === actionId)
          if (!action) {
            return
          }
          handleApplyRoleShape(roleToShape, action)
        }}
        onApplyComposeAction={(roleToCompose, actionId) => {
          const action = composeActionsByRole[roleToCompose]?.find((item) => item.id === actionId)
          if (!action) {
            return false
          }
          return handleApplyComposeAction(roleToCompose, action)
        }}
        onSearchCompose={onSearchCompose}
        onCreateCustomComposeStop={onCreateCustomComposeStop}
        onApplyComposeSearchResult={(roleToCompose, actionId, result) => {
          const action = composeActionsByRole[roleToCompose]?.find((item) => item.id === actionId)
          if (!action || action.id === 'remove-stop') {
            return false
          }
          return handleApplyComposeSearchResult(roleToCompose, action, result)
        }}
      />

      {lceRepairProposal && (
        <div className="preview-notice draft-feedback">
          <p className="preview-notice-title">This stop may no longer be available.</p>
          <p className="preview-notice-copy">We found a strong alternative.</p>
          <p className="preview-notice-copy">
            {lceRepairProposal.brokenStopVenueName} {" -> "} {lceRepairProposal.replacement.venue.name}
          </p>
          <p className="preview-notice-copy">Adjusted using real-time conditions</p>
          <div className="action-row draft-actions">
            <button type="button" className="ghost-button subtle" onClick={onKeepCurrentPlanAfterLce}>
              Keep current plan
            </button>
            <button type="button" className="primary-button" onClick={onApplyLceRepairProposal}>
              Apply update
            </button>
          </div>
        </div>
      )}

      {lceSystemMessage && (
        <div className="preview-notice draft-feedback">
          <p className="preview-notice-title">System</p>
          <p className="preview-notice-copy">{lceSystemMessage}</p>
          {lceSystemMessage === 'Adjusted for availability.' && (
            <p className="preview-notice-copy">Route preserved and rebalanced.</p>
          )}
        </div>
      )}

      {recentEditSummary && (
        <div className="preview-notice draft-change-summary">
          <p className="preview-notice-title">Recent change</p>
          <p className="preview-notice-copy">{recentEditSummary}</p>
        </div>
      )}

      {compositionConflictMessage && (
        <div className="preview-notice draft-feedback">
          <p className="preview-notice-title">Composition constraint</p>
          <p className="preview-notice-copy">{compositionConflictMessage}</p>
        </div>
      )}

      {debugPanel}

      <section className="preview-adjustments draft-tune-panel">
        <div className="preview-adjustments-header">
          <div>
            <p className="discovery-group-kicker">Tune this plan</p>
            <h2>Small changes, same night</h2>
          </div>
          <p className="discovery-group-copy">
            Keep the story spine in view, then tune the pace and start point without rebuilding the
            whole flow by hand.
          </p>
          <p className="explore-section-copy">
            {
              'Use "Edit" on any stop to replace it, move it in the night, or change the route without rebuilding the whole draft.'
            }
          </p>
        </div>

        <details className="draft-more-options">
          <summary>More options</summary>
          <div className="preview-adjustments-grid">
            <label className="input-group">
              <span className="input-label">Stay near</span>
              <select
                value={neighborhood ?? ''}
                onChange={(event) =>
                  onChangeNeighborhood(event.target.value ? event.target.value : undefined)
                }
              >
                <option value="">Any neighborhood</option>
                {neighborhoodOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="input-group">
              <span className="input-label">Spend</span>
              <select
                value={budget ?? ''}
                onChange={(event) =>
                  onChangeBudget(
                    event.target.value ? (event.target.value as BudgetPreference) : undefined,
                  )
                }
              >
                <option value="">No preference</option>
                <option value="value">Value</option>
                <option value="balanced">Balanced</option>
                <option value="premium">Premium</option>
              </select>
            </label>
          </div>
        </details>

        <div className="preview-notice draft-feedback">
          <p className="preview-notice-title">System note</p>
          <p className="preview-notice-copy">{feedbackCopy}</p>
        </div>

        <div className="action-row draft-actions">
          <button type="button" className="primary-button" onClick={onConfirm}>
            Lock this night
          </button>
        </div>
      </section>

      {showRoadmap && (
        <section className="roadmap-panel" aria-label="Coming later">
          <div className="roadmap-panel-header">
            <p className="discovery-group-kicker">Coming later</p>
            <p className="discovery-group-copy">
              These are part of the fuller flow, but they are not live yet.
            </p>
          </div>
          <div className="roadmap-grid">
            {draftPlaceholderItems.map((item) => (
              <div key={item} className="roadmap-item">
                <span>{item}</span>
                <small>Not live yet</small>
              </div>
            ))}
          </div>
        </section>
      )}
    </PageShell>
  )
}

