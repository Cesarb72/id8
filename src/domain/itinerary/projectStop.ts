import { roleProjection } from '../config/roleProjection'
import { stopTitles } from '../config/stopTitles'
import { formatStopDurationLabel } from '../taste/estimateStopDuration'
import { getStopNote } from './getStopNote'
import { getStopSubtitle } from './getStopSubtitle'
import type { ArcStop } from '../types/arc'
import type { StopExplainabilityDiagnostics } from '../types/diagnostics'
import type { ExperienceLens } from '../types/experienceLens'
import type { ItineraryStop } from '../types/itinerary'
import type { EstimatedStopDuration } from '../types/pacing'

export function projectStop(
  stop: ArcStop,
  pacingStop: EstimatedStopDuration | undefined,
  lens?: ExperienceLens,
  explainability?: StopExplainabilityDiagnostics,
  stopInsider?: ItineraryStop['stopInsider'],
): ItineraryStop {
  const userRole = roleProjection[stop.role]
  const venue = stop.scoredVenue.venue
  const estimatedDurationMinutes = pacingStop?.estimatedDurationMinutes ?? 75
  return {
    id: `${stop.role}_${venue.id}`,
    role: userRole,
    title: stopTitles[userRole],
    venueId: venue.id,
    venueName: venue.name,
    city: venue.city,
    category: venue.category,
    subcategory: venue.subcategory,
    priceTier: venue.priceTier,
    tags: venue.tags,
    vibeTags: venue.vibeTags,
    neighborhood: venue.neighborhood,
    driveMinutes: venue.driveMinutes,
    durationClass: pacingStop?.durationClass ?? 'M',
    estimatedDurationMinutes,
    estimatedDurationLabel: formatStopDurationLabel(estimatedDurationMinutes),
    subtitle: getStopSubtitle(userRole, venue, lens),
    note: getStopNote(userRole, venue, lens),
    imageUrl: venue.imageUrl,
    reasonLabels: explainability?.reasonTags,
    selectedBecause: explainability?.selectedBecause,
    selectionConfidence: explainability?.selectionConfidence,
    fallbackLabel: explainability?.fallbackLabel,
    stopInsider: stopInsider ?? {
      roleReason: 'Placed to keep the route sequence coherent.',
      localSignal: 'This area stays active enough to support this stop.',
      selectionReason: 'Chosen as the cleanest fit for this point in the route.',
    },
  }
}
