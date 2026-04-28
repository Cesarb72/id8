import type { ReactNode } from 'react'

interface VenueScaffoldDetailRow {
  label: string
  value: string
}

interface VenueScaffoldCardProps {
  roleLabel: string
  venueName: string
  fitLine?: string
  knownFor?: string
  areaNote?: string
  detailRows?: VenueScaffoldDetailRow[]
  futureDetailsSlot?: ReactNode
  className?: string
}

export function VenueScaffoldCard({
  roleLabel,
  venueName,
  fitLine,
  knownFor,
  areaNote,
  detailRows,
  futureDetailsSlot,
  className,
}: VenueScaffoldCardProps) {
  const normalizedDetailRows = (detailRows ?? [])
    .map((row) => ({
      label: row.label.trim(),
      value: row.value.trim(),
    }))
    .filter((row) => row.label.length > 0 && row.value.length > 0)
  const fallbackRows =
    normalizedDetailRows.length > 0
      ? normalizedDetailRows
      : [
          ...(knownFor ? [{ label: 'Known for', value: knownFor }] : []),
          ...(areaNote ? [{ label: 'Area note', value: areaNote }] : []),
        ]
  return (
    <article className={className ? `venue-scaffold-card ${className}` : 'venue-scaffold-card'}>
      <p className="venue-scaffold-role">{roleLabel}</p>
      <h4>{venueName}</h4>
      {fitLine && <p className="venue-scaffold-copy">{fitLine}</p>}
      {fallbackRows.map((row) => (
        <p
          key={`venue_scaffold_${row.label.toLowerCase().replace(/\s+/g, '_')}_${row.value
            .toLowerCase()
            .replace(/\s+/g, '_')}`}
          className="venue-scaffold-copy"
        >
          {row.label}: {row.value}
        </p>
      ))}
      {futureDetailsSlot && <div className="venue-scaffold-future-slot">{futureDetailsSlot}</div>}
    </article>
  )
}
