import { deriveReadableDistrictName } from '../../domain/districts/deriveReadableDistrictName'
import type { ItineraryStop, UserStopRole } from '../../domain/types/itinerary'
import { deriveReadableStopContent } from '../../domain/interpretation/deriveReadableStopContent'

interface StopCardProps {
  stop: ItineraryStop
  sequence?: number
  active?: boolean
  changed?: boolean
  ownershipKind?: 'candidate' | 'custom'
  locked?: boolean
  anchorStop?: boolean
  adjustmentOpen?: boolean
  adjustLabel?: string
  adjustDisabled?: boolean
  adjustNote?: string
  unavailable?: boolean
  unavailableReason?: 'removed' | 'unavailable'
  highlightDecisionSignal?: string
  highlightDecisionSecondarySignal?: string
  inlineDetail?: {
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
  appliedSwapNote?: string
  postSwapHint?: string
  inlineDetailExpanded?: boolean
  showInlineDetailToggle?: boolean
  liveAlerted?: boolean
  debugMode?: boolean
  onFocus?: () => void
  onAdjust?: () => void
  onToggleInlineDetail?: () => void
  onPreviewAlternative?: (role: UserStopRole, venueId: string) => void
  onPreviewDecisionAction?: (role: UserStopRole, decision: 'keep' | 'timing') => void
}

function buildCardClassName({
  active,
  changed,
  ownershipKind,
  locked,
  anchorStop,
  inlineDetailExpanded,
  liveAlerted,
}: {
  active: boolean
  changed: boolean
  ownershipKind?: 'candidate' | 'custom'
  locked: boolean
  anchorStop: boolean
  inlineDetailExpanded: boolean
}): string {
  return [
    'stop-card',
    active ? 'active' : '',
    changed ? 'changed' : '',
    ownershipKind === 'candidate' ? 'user-owned' : '',
    ownershipKind === 'custom' ? 'custom-owned' : '',
    locked ? 'locked' : '',
    anchorStop ? 'anchor-stop' : '',
    inlineDetailExpanded ? 'inline-detail-expanded' : '',
    liveAlerted ? 'live-alerted' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function buildAroundHereSignals(role: UserStopRole): string[] {
  if (role === 'start') {
    return [
      'Calm cafes nearby',
      'Easy seating before peak hours',
    ]
  }
  if (role === 'highlight') {
    return [
      'Live music starting nearby',
      'Bars filling faster after 8',
    ]
  }
  return [
    'Dessert spots open late',
    'Quieter corners available',
  ]
}

function buildFallbackStopInsider(role: UserStopRole): ItineraryStop['stopInsider'] {
  if (role === 'start') {
    return {
      roleReason: 'Easy opening move that starts the route cleanly.',
      localSignal: 'This pocket stays active enough to begin without rush.',
      selectionReason: 'Chosen as the cleanest opening fit for this sequence.',
    }
  }
  if (role === 'highlight') {
    return {
      roleReason: 'Placed as the central moment in the sequence.',
      localSignal: 'Surrounding activity keeps this stop from feeling isolated.',
      selectionReason: 'Chosen over nearby options to anchor the route better.',
    }
  }
  if (role === 'windDown') {
    return {
      roleReason: 'Late stop to land the night more softly.',
      localSignal: 'This area supports a calmer finish without going flat.',
      selectionReason: 'Selected for a smoother end-of-route fit.',
    }
  }
  return {
    roleReason: 'Added as a wildcard to keep the route dynamic.',
    localSignal: 'Nearby activity gives this stop context in the sequence.',
    selectionReason: 'Chosen to add contrast without breaking pacing.',
  }
}

function normalizeLineToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function uniqueLines(values: Array<string | undefined>, limit: number): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const next = value?.trim()
    if (!next) {
      continue
    }
    const token = normalizeLineToken(next)
    if (!token || seen.has(token)) {
      continue
    }
    seen.add(token)
    result.push(next)
    if (result.length >= limit) {
      break
    }
  }
  return result
}

function getRoleChipLabel(role: UserStopRole): string {
  if (role === 'windDown') {
    return 'WIND DOWN'
  }
  if (role === 'highlight') {
    return 'HIGHLIGHT'
  }
  if (role === 'start') {
    return 'START'
  }
  return 'SURPRISE'
}

function formatOpenUntil(rawTime: string): string {
  const normalized = rawTime.replace(/\s+/g, ' ').trim()
  const upperAmPm = normalized.replace(/\b(am|pm)\b/gi, (value) => value.toUpperCase())
  return `Open until ${upperAmPm}`
}

function extractOpenStatus(
  values: Array<string | undefined>,
  tags: string[],
  unavailable: boolean,
): string | undefined {
  if (unavailable) {
    return 'Unavailable'
  }

  const text = values
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .toLowerCase()

  const openUntilMatch = text.match(
    /\bopen(?:\s+until|\s+till)\s+([0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm)?)/i,
  )
  if (openUntilMatch?.[1]) {
    return formatOpenUntil(openUntilMatch[1])
  }
  if (/\bopen now\b/i.test(text)) {
    return 'Open now'
  }
  if (/\btemporarily closed\b/i.test(text)) {
    return 'Temporarily closed'
  }
  if (/\bclosed\b/i.test(text)) {
    return 'Closed'
  }

  const normalizedTags = new Set(tags.map((tag) => tag.toLowerCase()))
  if (normalizedTags.has('late-night') || normalizedTags.has('night-owl')) {
    return 'Open late'
  }
  return undefined
}

function extractRatingLabel(values: Array<string | undefined>): string | undefined {
  const text = values
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')

  const starMatch = text.match(/\b([1-4]\.\d)\s*(?:★|stars?|\/\s*5)\b/i)
  if (starMatch?.[1]) {
    return `${starMatch[1]}★`
  }
  const ratedMatch = text.match(/\brated\s+([1-4]\.\d)\b/i)
  if (ratedMatch?.[1]) {
    return `${ratedMatch[1]}★`
  }
  return undefined
}

export function StopCard({
  stop,
  sequence,
  active = false,
  changed = false,
  ownershipKind,
  locked = false,
  anchorStop = false,
  adjustmentOpen = false,
  adjustLabel,
  adjustDisabled = false,
  adjustNote,
  unavailable = false,
  unavailableReason = 'unavailable',
  highlightDecisionSignal,
  highlightDecisionSecondarySignal,
  inlineDetail,
  appliedSwapNote,
  postSwapHint,
  inlineDetailExpanded = false,
  showInlineDetailToggle = false,
  liveAlerted = false,
  debugMode = false,
  onFocus,
  onAdjust,
  onToggleInlineDetail,
  onPreviewAlternative,
  onPreviewDecisionAction,
}: StopCardProps) {
  const readableDistrict = deriveReadableDistrictName(stop.neighborhood, {
    city: stop.city,
  })
  const readableContent = deriveReadableStopContent(
    stop,
    {
      category: stop.category,
      subcategory: stop.subcategory,
      priceTier: stop.priceTier,
      tags: stop.tags,
      vibeTags: stop.vibeTags,
    },
    stop.role,
  )
  const visibleReasonLabels =
    active || changed || debugMode
      ? debugMode
        ? stop.reasonLabels
        : stop.reasonLabels?.slice(0, 2)
      : undefined
  const insider = stop.stopInsider ?? buildFallbackStopInsider(stop.role)
  const statusBadge =
    unavailable
      ? {
          label: unavailableReason === 'removed' ? 'Removed' : 'Unavailable',
          className: 'locked',
        }
      : locked
      ? { label: 'Locked', className: 'locked' }
      : ownershipKind === 'custom'
        ? { label: 'Custom', className: 'custom-stop' }
        : undefined
  const hasVenueLink = Boolean(inlineDetail?.venueLinkUrl)
  const aroundHereSignals =
    inlineDetail?.aroundHereSignals && inlineDetail.aroundHereSignals.length > 0
      ? inlineDetail.aroundHereSignals.slice(0, 1)
      : buildAroundHereSignals(stop.role)
  const tonightSignals = uniqueLines(
    [
      ...(inlineDetail?.tonightSignals?.slice(0, 3) ?? []),
      aroundHereSignals[0],
      inlineDetail?.localSignal,
      insider.localSignal,
      buildAroundHereSignals(stop.role)[1],
    ],
    3,
  )
  const replacementTarget = inlineDetail?.alternatives?.[0]?.replacementContext
  const openStatusLabel = extractOpenStatus(
    [
      stop.subtitle,
      stop.note,
      inlineDetail?.goodToKnow,
      inlineDetail?.localSignal,
      inlineDetail?.whyItFits,
    ],
    stop.tags,
    unavailable,
  )
  const ratingLabel = extractRatingLabel([
    stop.subtitle,
    inlineDetail?.knownFor,
    inlineDetail?.goodToKnow,
    ...(stop.reasonLabels ?? []),
  ])
  const realityAnchors = uniqueLines(
    [
      readableDistrict.displayName,
      `${stop.driveMinutes} min away`,
      openStatusLabel,
      ratingLabel,
    ],
    4,
  )
  const secondaryDetails = uniqueLines(
    [
      `${readableDistrict.displayName} - ${stop.estimatedDurationLabel} - ${stop.driveMinutes} min away`,
      readableContent.confidenceLine,
      insider.roleReason,
      readableContent.roleLine,
      inlineDetail?.whyItFits,
      stop.role === 'highlight'
        ? highlightDecisionSignal ?? 'Chosen as your main moment'
        : undefined,
      stop.role === 'highlight' ? highlightDecisionSecondarySignal : undefined,
      insider.selectionReason,
      inlineDetail?.knownFor,
      inlineDetail?.goodToKnow,
      inlineDetail?.localSignal,
      stop.note,
      appliedSwapNote,
      postSwapHint,
      debugMode && typeof stop.selectionConfidence === 'number'
        ? `Confidence ${stop.selectionConfidence}% - ${stop.durationClass} pace${
            stop.fallbackLabel ? ` - ${stop.fallbackLabel}` : ''
          }`
        : undefined,
      debugMode && inlineDetail?.stopNarrativeMode
        ? `Narrative mode: ${inlineDetail.stopNarrativeMode}`
        : undefined,
      debugMode && inlineDetail?.stopNarrativeSource
        ? `Narrative source: ${inlineDetail.stopNarrativeSource}`
        : undefined,
      debugMode && inlineDetail?.stopFlavorSummary
        ? `Flavor: ${inlineDetail.stopFlavorSummary}`
        : undefined,
      debugMode && inlineDetail?.stopTransitionSummary
        ? `Transition: ${inlineDetail.stopTransitionSummary}`
        : undefined,
    ],
    8,
  )
  const showSwapsSection = Boolean(
    inlineDetail?.alertSignal ||
      (inlineDetail?.alternatives && inlineDetail.alternatives.length > 0) ||
      (inlineDetail?.decisionActions && inlineDetail.decisionActions.length > 0),
  )

  return (
    <article
      className={buildCardClassName({
        active,
        changed,
        ownershipKind,
        locked,
        anchorStop,
        inlineDetailExpanded,
        liveAlerted,
      })}
      onClick={() => {
        onFocus?.()
        if (showInlineDetailToggle) {
          onToggleInlineDetail?.()
        }
      }}
    >
      <div className="stop-card-image-wrap">
        <img src={stop.imageUrl} alt={stop.venueName} loading="lazy" />
      </div>
      <div className="stop-card-content">
        <div className="stop-card-topline">
          <div className="stop-card-kicker-row">
            {typeof sequence === 'number' && <span className="stop-card-sequence">0{sequence + 1}</span>}
            <p className="stop-card-kicker">{getRoleChipLabel(stop.role)}</p>
          </div>
          {changed && <span className="stop-card-change-badge">Updated</span>}
        </div>
        {statusBadge && (
          <div className="stop-card-badge-row">
            <span className={`stop-card-badge ${statusBadge.className}`}>{statusBadge.label}</span>
          </div>
        )}
        <h3>{stop.venueName}</h3>
        <p className="stop-card-description-line">{readableContent.identityLine}</p>
        {realityAnchors.length > 0 && (
          <p className="stop-card-reality-anchors">{realityAnchors.join(' · ')}</p>
        )}
        {tonightSignals.length > 0 && (
          <div className="stop-card-inline-detail-row stop-card-tonight-primary">
            <p className="stop-card-inline-detail-label">TONIGHT</p>
            <ul className="stop-card-inline-tonight-list">
              {tonightSignals.map((signal) => (
                <li key={`${stop.id}_${signal}`} className="stop-card-inline-detail-copy">
                  {signal}
                </li>
              ))}
            </ul>
          </div>
        )}
        {unavailable && (
          <p className="stop-card-note">This stop may no longer be available.</p>
        )}
        {visibleReasonLabels && visibleReasonLabels.length > 0 && (
          <div className="stop-reason-row">
            {visibleReasonLabels.map((label) => (
              <span key={`${stop.id}_${label}`} className="stop-reason-chip">
                {label}
              </span>
            ))}
          </div>
        )}
        {(onAdjust || adjustLabel) && (
          <div className="stop-card-actions">
            <button
              type="button"
              className={`chip-action stop-card-adjust${adjustmentOpen ? ' active' : ''}`}
              disabled={adjustDisabled}
              onClick={(event) => {
                event.stopPropagation()
                onAdjust?.()
              }}
            >
              {adjustLabel ?? (adjustmentOpen ? 'Hide adjustments' : 'Adjust this stop')}
            </button>
          </div>
        )}
        {showInlineDetailToggle && (
          <div className="stop-card-actions">
            <button
              type="button"
              className={`chip-action stop-card-adjust${inlineDetailExpanded ? ' active' : ''}`}
              onClick={(event) => {
                event.stopPropagation()
                onToggleInlineDetail?.()
              }}
            >
              {inlineDetailExpanded ? 'Show less' : 'See more'}
            </button>
          </div>
        )}
        {inlineDetailExpanded && inlineDetail && (
          <div className="stop-card-inline-detail">
            {secondaryDetails.length > 0 && (
              <details
                className="stop-card-secondary-details"
                onClick={(event) => event.stopPropagation()}
              >
                <summary>See details</summary>
                <div className="stop-card-secondary-details-body">
                  {secondaryDetails.map((line) => (
                    <p key={`${stop.id}_detail_${line}`} className="stop-card-inline-detail-copy">
                      {line}
                    </p>
                  ))}
                </div>
              </details>
            )}

            {showSwapsSection && (
              <div className="stop-card-inline-detail-row stop-card-swaps-section">
                <p className="stop-card-inline-detail-label">Better options for this moment</p>
                {replacementTarget && (
                  <p className="stop-card-inline-detail-copy stop-card-inline-replacement-target">
                    Replacing: {replacementTarget}
                  </p>
                )}
                {inlineDetail.alertSignal && (
                  <p className="stop-card-inline-alert">{inlineDetail.alertSignal}</p>
                )}
                {inlineDetail.alternatives && inlineDetail.alternatives.length > 0 && (
                  <div className="stop-card-inline-alternatives">
                    {inlineDetail.alternatives.map((alternative) => {
                      const replacementId = alternative.venueId
                      return (
                        <button
                          key={replacementId}
                          type="button"
                          className="stop-card-inline-alt-button"
                          disabled={!onPreviewAlternative}
                          onClick={(event) => {
                            event.stopPropagation()
                            console.log('[SWAP CLICK]', replacementId)
                            if (!onPreviewAlternative) {
                              console.warn('[SWAP CLICK GUARD] preview handler missing', {
                                role: stop.role,
                                replacementId,
                              })
                              return
                            }
                            onPreviewAlternative(stop.role, replacementId)
                          }}
                        >
                          <div className="stop-card-inline-alt-topline">
                            <p className="stop-card-inline-detail-copy">
                              <strong>{alternative.name}</strong>
                            </p>
                            <span className="stop-card-inline-alt-action">Swap to this</span>
                          </div>
                          <p className="stop-card-inline-detail-copy">
                            {alternative.descriptor}
                            {alternative.distanceLabel ? ` - ${alternative.distanceLabel}` : ''}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                )}
                {inlineDetail.decisionActions && inlineDetail.decisionActions.length > 0 && (
                  <div className="stop-card-inline-decision-block">
                    <p className="stop-card-inline-or">Or</p>
                    <div className="stop-card-inline-decision-actions">
                      {inlineDetail.decisionActions.map((action) => (
                        <button
                          key={`${stop.id}_${action.id}`}
                          type="button"
                          className="ghost-button stop-card-inline-decision-button"
                          onClick={(event) => {
                            event.stopPropagation()
                            onPreviewDecisionAction?.(stop.role, action.id)
                          }}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}
        {hasVenueLink && (
          <div className="stop-card-final-action-row">
            <a
              className="stop-card-venue-link"
              href={inlineDetail?.venueLinkUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              Open venue page{' ->'}
            </a>
          </div>
        )}
        {adjustNote && <p className="stop-card-adjust-note">{adjustNote}</p>}
      </div>
    </article>
  )
}


