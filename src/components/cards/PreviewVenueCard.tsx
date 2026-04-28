import type { ReactNode } from 'react'
import type { VenueCardStopRepresentation } from '../../domain/types/stopRepresentation'

interface PreviewVenueCardProps extends VenueCardStopRepresentation {
  mediaAlt?: string
  futureSignalSlot?: ReactNode
  className?: string
}

function normalizeLine(value: string | undefined): string {
  return value?.trim() ?? ''
}

function normalizeRoleToken(value: string | undefined): string {
  return normalizeLine(value).toLowerCase().replace(/[\s_-]+/g, '')
}

function formatRole(value: string): string {
  const normalizedToken = normalizeRoleToken(value)
  if (normalizedToken === 'winddown') {
    return 'Wind-down'
  }
  if (normalizedToken === 'start') {
    return 'Start'
  }
  if (normalizedToken === 'highlight') {
    return 'Highlight'
  }
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function clampKnownFor(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= 60) {
    return trimmed
  }
  return `${trimmed.slice(0, 57).trimEnd()}...`
}

export function PreviewVenueCard({
  role,
  roleLabel,
  venueName,
  mediaUrl,
  mediaAlt,
  venueType,
  areaName,
  fitSummary,
  knownFor,
  areaFitSummary,
  futureSignalSlot,
  className,
}: PreviewVenueCardProps) {
  const normalizedRole = normalizeLine(role)
  const normalizedRoleLabel = normalizeLine(roleLabel)
  const normalizedVenueName = normalizeLine(venueName)
  const normalizedMediaUrl = normalizeLine(mediaUrl)
  const normalizedMediaAlt = normalizeLine(mediaAlt)
  const normalizedVenueType = normalizeLine(venueType)
  const normalizedAreaName = normalizeLine(areaName)
  const normalizedFitSummary = normalizeLine(fitSummary)
  const normalizedKnownFor = normalizeLine(knownFor)
  const normalizedAreaFitSummary = normalizeLine(areaFitSummary)

  // v1 rule: fit summary is required for rendering.
  if (!normalizedFitSummary || !normalizedVenueName || !normalizedRole || !normalizedRoleLabel) {
    return null
  }

  const roleDisplay = formatRole(normalizedRole)
  const roleLabelDistinct =
    normalizedRoleLabel &&
    normalizeRoleToken(normalizedRoleLabel) !== normalizeRoleToken(roleDisplay)
      ? normalizedRoleLabel
      : ''
  const knownForLine = normalizedKnownFor ? clampKnownFor(normalizedKnownFor) : ''
  const identityMeta = [normalizedVenueType, normalizedAreaName].filter(Boolean).join(' - ')
  const cardClassName = className ? `preview-venue-card ${className}` : 'preview-venue-card'

  return (
    <article className={cardClassName}>
      {normalizedMediaUrl && (
        <div className="preview-venue-card-media">
          <img
            src={normalizedMediaUrl}
            alt={normalizedMediaAlt || `${normalizedVenueName} preview`}
            loading="lazy"
            decoding="async"
          />
        </div>
      )}

      <div className="preview-venue-card-role-strip">
        <span className="preview-venue-card-role">{roleDisplay}</span>
        {roleLabelDistinct && <span className="preview-venue-card-role-label">{roleLabelDistinct}</span>}
      </div>

      <div className="preview-venue-card-identity">
        <h4>{normalizedVenueName}</h4>
        {identityMeta && <p className="preview-venue-card-identity-meta">{identityMeta}</p>}
      </div>

      <p className="preview-venue-card-fit-summary">{normalizedFitSummary}</p>

      {knownForLine && (
        <p className="preview-venue-card-known-for">
          <span>Known for:</span> {knownForLine}
        </p>
      )}

      {normalizedAreaFitSummary && (
        <p className="preview-venue-card-area-fit-summary">{normalizedAreaFitSummary}</p>
      )}

      {futureSignalSlot ? (
        <div className="preview-venue-card-future-signal-slot">{futureSignalSlot}</div>
      ) : null}
    </article>
  )
}
