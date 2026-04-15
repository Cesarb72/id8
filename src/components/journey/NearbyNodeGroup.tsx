import { useEffect, useState } from 'react'
import type {
  DraftComposeAction,
  DraftComposeActionId,
  DraftComposeSearchActionId,
  DraftComposeSearchResult,
} from '../../domain/arc/composeDraftArc'
import type { DraftRoleShapeAction, DraftRoleShapeActionId } from '../../domain/arc/reshapeArcStop'
import type { StopAlternative, StopAlternativeKind } from '../../domain/types/arc'
import type { ItineraryStop } from '../../domain/types/itinerary'

interface NearbyNodeGroupProps {
  stop: ItineraryStop
  mode?: 'full' | 'swap-only'
  isExpanded?: boolean
  ownershipKind?: 'candidate' | 'custom'
  visibleKind?: StopAlternativeKind
  alternatives: StopAlternative[]
  nearbyCount?: number
  swapCount?: number
  roleShapeActions?: DraftRoleShapeAction[]
  composeActions?: DraftComposeAction[]
  onShowSwap: () => void
  onShowNearby: () => void
  onApplySwap: (venueId: string) => void
  onApplyRoleShape?: (actionId: DraftRoleShapeActionId) => void
  onApplyComposeAction?: (actionId: DraftComposeActionId) => boolean
  onSearchCompose?: (
    actionId: DraftComposeSearchActionId,
    query: string,
  ) => Promise<DraftComposeSearchResult[]>
  onCreateCustomComposeStop?: (
    actionId: DraftComposeSearchActionId,
    label: string,
  ) => boolean
  onApplyComposeSearchResult?: (
    actionId: DraftComposeSearchActionId,
    result: DraftComposeSearchResult,
  ) => boolean
}

function buildSummaryCopy(
  mode: 'full' | 'swap-only',
  visibleKind: StopAlternativeKind | undefined,
  nearbyCount: number,
  swapCount: number,
): string {
  if (mode === 'swap-only') {
    if (visibleKind === 'swap' && swapCount > 0) {
      return 'Pick a same-role alternative to reshape this beat without rebuilding the whole route.'
    }
    return 'Same-role alternatives keep the route structure intact while you swap in a different stop.'
  }
  if (visibleKind === 'nearby') {
    return 'A few nearby options if you want an easier pivot around this stop.'
  }
  if (visibleKind === 'swap') {
    return 'A few alternate takes on this same beat of the route.'
  }
  if (nearbyCount > 0 && swapCount > 0) {
    return `${nearbyCount} nearby ideas and ${swapCount} swaps are ready if you want to adjust this stop.`
  }
  if (nearbyCount > 0) {
    return `${nearbyCount} nearby ideas are ready if you want to adjust this stop.`
  }
  if (swapCount > 0) {
    return `${swapCount} swaps are ready if you want to adjust this stop.`
  }
  return 'Look nearby or swap this stop if you want a different fit.'
}

function buildEmptyCopy(
  kind: StopAlternativeKind | undefined,
  mode: 'full' | 'swap-only',
): string {
  if (mode === 'swap-only') {
    if (kind === 'swap') {
      return 'No stronger same-role swap surfaced for this stop right now.'
    }
    return 'Open this stop again to try a few same-role alternatives.'
  }
  if (kind === 'nearby') {
    return 'No nearby options surfaced for this stop right now.'
  }
  if (kind === 'swap') {
    return 'No stronger swap surfaced for this stop right now.'
  }
  return 'Choose nearby or swap to open options for this stop.'
}

function buildRationaleLabel(stop: ItineraryStop, option: StopAlternative): string {
  const venue = option.scoredVenue.venue
  const normalizedReason = option.reason.toLowerCase()

  if (normalizedReason.includes('similar area')) {
    return 'Same area'
  }
  if (normalizedReason.includes('closer fit')) {
    return 'Closer'
  }
  if (stop.role === 'highlight' && venue.energyLevel >= 4) {
    return 'More lively'
  }
  if (stop.vibeTags.includes('cozy') && venue.vibeTags.includes('cozy')) {
    return 'Better cozy fit'
  }
  if (venue.priceTier === stop.priceTier) {
    return 'Same spend'
  }
  if (venue.vibeTags.some((tag) => stop.vibeTags.includes(tag))) {
    return 'Stronger vibe match'
  }
  return 'Fits this stop'
}

function buildComposePrompt(actionId: DraftComposeSearchActionId | undefined): string {
  if (actionId === 'add-before') {
    return 'Choose what to add before this stop.'
  }
  if (actionId === 'add-after') {
    return 'Choose what to add after this stop.'
  }
  return 'Choose what should replace this stop.'
}

function buildSearchHelperCopy(actionId: DraftComposeSearchActionId | undefined): string {
  if (actionId === 'replace-stop') {
    return 'Search for a real place, known venue, or nearby match.'
  }
  return 'Search for a real place to add into this route.'
}

function buildCustomHelperCopy(actionId: DraftComposeSearchActionId | undefined): string {
  if (actionId === 'replace-stop') {
    return "Add a private or manual stop instead, like Jane's house, the office, or a meetup point."
  }
  return "Add a private or manual stop, like Jane's house, a pickup, or your office."
}

function buildOwnershipContextCopy(
  ownershipKind: 'candidate' | 'custom' | undefined,
): string | undefined {
  if (ownershipKind === 'custom') {
    return 'This is your own manual stop, so the route is built around keeping it.'
  }
  if (ownershipKind === 'candidate') {
    return 'You already picked this stop, so edits here keep your choice in place.'
  }
  return undefined
}

export function NearbyNodeGroup({
  stop,
  mode = 'full',
  isExpanded = false,
  ownershipKind,
  visibleKind,
  alternatives,
  nearbyCount = 0,
  swapCount = 0,
  roleShapeActions = [],
  composeActions = [],
  onShowSwap,
  onShowNearby,
  onApplySwap,
  onApplyRoleShape,
  onApplyComposeAction,
  onSearchCompose,
  onCreateCustomComposeStop,
  onApplyComposeSearchResult,
}: NearbyNodeGroupProps) {
  const [showAll, setShowAll] = useState(false)
  const [composeActionId, setComposeActionId] = useState<DraftComposeSearchActionId>()
  const [composePath, setComposePath] = useState<'search' | 'custom'>('search')
  const [composeQuery, setComposeQuery] = useState('')
  const [composeLoading, setComposeLoading] = useState(false)
  const [composeResults, setComposeResults] = useState<DraftComposeSearchResult[]>([])
  const hasVisibleAlternatives = alternatives.length > 0
  const previewLimit = mode === 'swap-only' ? 3 : 2
  const previewAlternatives = showAll ? alternatives : alternatives.slice(0, previewLimit)
  const hiddenCount = Math.max(alternatives.length - previewAlternatives.length, 0)
  const canReplace = composeActions.some((action) => action.id === 'replace-stop')
  const routeEditActions = composeActions.filter((action) => action.id !== 'replace-stop')
  const canSwap = swapCount > 0 || (visibleKind === 'swap' && alternatives.length > 0)
  const ownershipContextCopy = buildOwnershipContextCopy(ownershipKind)
  const showDraftActionGroups =
    mode === 'swap-only' &&
    (canSwap ||
      canReplace ||
      roleShapeActions.length > 0 ||
      routeEditActions.length > 0)

  const resetComposePanel = () => {
    setComposeActionId(undefined)
    setComposePath('search')
    setComposeQuery('')
    setComposeResults([])
    setComposeLoading(false)
  }

  useEffect(() => {
    setShowAll(false)
  }, [visibleKind, stop.id])

  useEffect(() => {
    if (!isExpanded) {
      resetComposePanel()
    }
  }, [isExpanded])

  useEffect(() => {
    resetComposePanel()
  }, [stop.id])

  useEffect(() => {
    if (
      composePath !== 'search' ||
      !composeActionId ||
      composeQuery.trim().length < 2 ||
      !onSearchCompose
    ) {
      setComposeResults([])
      setComposeLoading(false)
      return
    }

    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      setComposeLoading(true)
      void onSearchCompose(composeActionId, composeQuery.trim())
        .then((results) => {
          if (!cancelled) {
            setComposeResults(results)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setComposeResults([])
          }
        })
        .finally(() => {
          if (!cancelled) {
            setComposeLoading(false)
          }
        })
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [composeActionId, composePath, composeQuery, onSearchCompose])

  if (!isExpanded) {
    return null
  }

  const handleSelectComposeAction = (action: DraftComposeAction) => {
    if (action.id === 'remove-stop') {
      const applied = onApplyComposeAction?.(action.id)
      if (applied) {
        resetComposePanel()
      }
      return
    }

    setComposeActionId(action.id)
    setComposePath('search')
    setComposeQuery('')
    setComposeResults([])
  }

  const openComposePanel = (
    actionId: DraftComposeSearchActionId,
    path: 'search' | 'custom' = 'search',
  ) => {
    setComposeActionId(actionId)
    setComposePath(path)
    setComposeQuery('')
    setComposeResults([])
    setComposeLoading(false)
  }

  return (
    <section
      className={`nearby-node-group${mode === 'swap-only' ? ' swap-only' : ''}${
        hasVisibleAlternatives ? ' expanded' : ''
      }${
        visibleKind ? ' open' : ''
      } active`}
    >
      <div className="nearby-node-header">
        <div>
          <p className="nearby-node-kicker">Edit this stop</p>
          <p className="nearby-node-copy">
            {buildSummaryCopy(mode, visibleKind, nearbyCount, swapCount)}
          </p>
          {ownershipContextCopy && (
            <p className="nearby-node-context-note">{ownershipContextCopy}</p>
          )}
        </div>
        <div className="nearby-node-actions">
          <span className="nearby-node-preview-chip">{swapCount} swaps</span>
          {mode === 'full' && (
            <>
              <span className="nearby-node-preview-chip">{nearbyCount} nearby</span>
              <button type="button" className="chip-action subtle" onClick={onShowNearby}>
                See nearby
              </button>
              <button type="button" className="chip-action subtle" onClick={onShowSwap}>
                Swap stop
              </button>
            </>
          )}
        </div>
      </div>

      {!visibleKind && !hasVisibleAlternatives && (
        <div className="nearby-node-preview">
          <span className="nearby-node-preview-label">
            {mode === 'swap-only' ? 'Looking for same-role swaps' : 'Nothing selected yet'}
          </span>
          {mode === 'full' && <span className="nearby-node-preview-chip">{nearbyCount} nearby</span>}
          <span className="nearby-node-preview-chip">{swapCount} swaps</span>
          <span className="nearby-node-preview-note">{buildEmptyCopy(undefined, mode)}</span>
        </div>
      )}

      {visibleKind && !hasVisibleAlternatives && (
        <p className="nearby-node-empty">{buildEmptyCopy(visibleKind, mode)}</p>
      )}

      {hasVisibleAlternatives && (
        <div className="nearby-node-list">
          {previewAlternatives.map((option) => (
            <button
              key={`${stop.role}_${visibleKind}_${option.scoredVenue.venue.id}`}
              type="button"
              className="nearby-node-item"
              onClick={() => onApplySwap(option.scoredVenue.venue.id)}
            >
              <div className="nearby-node-item-topline">
                <span className="nearby-node-item-label">
                  {mode === 'swap-only'
                    ? `${stop.title} option`
                    : visibleKind === 'nearby'
                      ? 'Nearby option'
                      : 'Route swap'}
                </span>
                <span className="nearby-node-item-rationale">
                  {buildRationaleLabel(stop, option)}
                </span>
              </div>
              <strong>{option.scoredVenue.venue.name}</strong>
              <small>
                {option.scoredVenue.venue.neighborhood} | {option.scoredVenue.venue.driveMinutes} min |{' '}
                {option.scoredVenue.venue.category.replace('_', ' ')}
              </small>
              <small>{option.reason}</small>
            </button>
          ))}
          {hiddenCount > 0 && (
            <button
              type="button"
              className="nearby-node-more"
              onClick={() => setShowAll(true)}
            >
              Show {hiddenCount} more options
            </button>
          )}
        </div>
      )}

      {showDraftActionGroups && (
        <div className="nearby-node-compose">
          {(canSwap || canReplace) && (
            <div className="nearby-node-action-section">
              <p className="nearby-node-section-label">Replace this stop</p>
              <div className="nearby-node-shape-actions">
                {canSwap && (
                  <button
                    type="button"
                    className={`chip-action subtle nearby-node-shape-action${
                      visibleKind === 'swap' ? ' selected' : ''
                    }`}
                    onClick={onShowSwap}
                  >
                    Swap options
                  </button>
                )}
                {canReplace && (
                  <button
                    type="button"
                    className={`chip-action subtle nearby-node-shape-action${
                      composeActionId === 'replace-stop' && composePath === 'search'
                        ? ' selected'
                        : ''
                    }`}
                    onClick={() => openComposePanel('replace-stop', 'search')}
                  >
                    Find a place
                  </button>
                )}
                {canReplace && (
                  <button
                    type="button"
                    className={`chip-action subtle nearby-node-shape-action${
                      composeActionId === 'replace-stop' && composePath === 'custom'
                        ? ' selected'
                        : ''
                    }`}
                    onClick={() => openComposePanel('replace-stop', 'custom')}
                  >
                    Add your own stop
                  </button>
                )}
              </div>
            </div>
          )}

          {roleShapeActions.length > 0 && (
            <div className="nearby-node-action-section">
              <p className="nearby-node-section-label">Move it in the night</p>
              <div className="nearby-node-shape-actions">
                {roleShapeActions.map((action) => (
                  <button
                    key={`${stop.role}_${action.id}`}
                    type="button"
                    className="chip-action subtle nearby-node-shape-action"
                    onClick={() => onApplyRoleShape?.(action.id)}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {routeEditActions.length > 0 && (
            <div className="nearby-node-action-section">
              <p className="nearby-node-section-label">Change the route</p>
              <div className="nearby-node-shape-actions">
                {routeEditActions.map((action) => (
                  <button
                    key={`${stop.role}_${action.id}`}
                    type="button"
                    className={`chip-action subtle nearby-node-shape-action${
                      composeActionId === action.id ? ' selected' : ''
                    }`}
                    onClick={() => handleSelectComposeAction(action)}
                  >
                    {action.id === 'remove-stop' ? 'Remove stop' : action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {composeActionId && (
            <div className="nearby-node-compose-panel">
              <div className="nearby-node-compose-panel-header">
                <p className="nearby-node-preview-note">{buildComposePrompt(composeActionId)}</p>
                <button
                  type="button"
                  className="chip-action subtle"
                  onClick={resetComposePanel}
                >
                  Cancel
                </button>
              </div>
              {composeActionId !== 'replace-stop' && (
                <div className="nearby-node-compose-paths">
                  <button
                    type="button"
                    className={`chip-action subtle nearby-node-shape-action${
                      composePath === 'search' ? ' selected' : ''
                    }`}
                    onClick={() => {
                      setComposePath('search')
                      setComposeQuery('')
                      setComposeResults([])
                    }}
                  >
                    Find a place
                  </button>
                  <button
                    type="button"
                    className={`chip-action subtle nearby-node-shape-action${
                      composePath === 'custom' ? ' selected' : ''
                    }`}
                    onClick={() => {
                      setComposePath('custom')
                      setComposeQuery('')
                      setComposeResults([])
                    }}
                  >
                    Add your own stop
                  </button>
                </div>
              )}

              {composePath === 'search' && (
                <>
                  <p className="nearby-node-preview-note">
                    {buildSearchHelperCopy(composeActionId)}
                  </p>
                  <input
                    value={composeQuery}
                    onChange={(event) => setComposeQuery(event.target.value)}
                    placeholder={
                      composeActionId === 'replace-stop'
                        ? 'Search for a real place'
                        : 'Search for a place to add'
                    }
                  />
                  {composeQuery.trim().length < 2 && (
                    <p className="nearby-node-preview-note">
                      Good for nearby matches, keywords, or a specific known venue.
                    </p>
                  )}
                  {composeLoading && (
                    <p className="nearby-node-preview-note">Looking for a good fit...</p>
                  )}
                  {!composeLoading &&
                    composeQuery.trim().length >= 2 &&
                    composeResults.length === 0 && (
                      <p className="nearby-node-empty">
                        No strong place matches surfaced for this route yet.
                      </p>
                    )}
                  {composeResults.length > 0 && (
                    <div className="nearby-node-list nearby-node-compose-results">
                      {composeResults.map((result) => (
                        <button
                          key={`${stop.role}_${composeActionId}_${result.id}`}
                          type="button"
                          className="nearby-node-item"
                          onClick={() => {
                            const applied = onApplyComposeSearchResult?.(composeActionId, result)
                            if (applied) {
                              resetComposePanel()
                            }
                          }}
                        >
                          <div className="nearby-node-item-topline">
                            <span className="nearby-node-item-label">Place match</span>
                            <span className="nearby-node-item-rationale">{result.rationale}</span>
                          </div>
                          <strong>{result.title}</strong>
                          <small>{result.subtitle}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {composePath === 'custom' && (
                <>
                  <p className="nearby-node-preview-note">
                    {buildCustomHelperCopy(composeActionId)}
                  </p>
                  <input
                    value={composeQuery}
                    onChange={(event) => setComposeQuery(event.target.value)}
                    placeholder="Enter a private or manual stop"
                  />
                  <p className="nearby-node-preview-note">
                    Examples: Jane&apos;s house, meetup point, office, pickup.
                  </p>
                  <button
                    type="button"
                    className="ghost-button subtle nearby-node-custom-submit"
                    disabled={composeQuery.trim().length < 2}
                    onClick={() => {
                      if (!composeActionId) {
                        return
                      }
                      const applied = onCreateCustomComposeStop?.(
                        composeActionId,
                        composeQuery.trim(),
                      )
                      if (applied) {
                        resetComposePanel()
                      }
                    }}
                  >
                    Add this private stop
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
