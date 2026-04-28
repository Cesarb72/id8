import type { ItineraryStop } from '../types/itinerary'
import type { Venue } from '../types/venue'
import type {
  SharedStopRepresentationRole,
  VenueCardDetailInput,
  VenueCardFallbackStopSeed,
  VenueCardStopRepresentationWithSource,
} from '../types/stopRepresentation'
import { getStopRepresentationRoleLabel } from '../utils/stopRepresentationRole'

const KNOWN_FOR_TEXTURE_TOKENS = new Set([
  'ambient',
  'bistro',
  'chef-led',
  'cocktails',
  'cozy',
  'dessert',
  'garden',
  'intimate',
  'jazz',
  'listening',
  'patio',
  'romantic',
  'small-plates',
  'small-stage',
  'speakeasy',
  'tasting',
  'tea',
  'wine',
  'wine-bar',
])

export function normalizePreviewField(value: string | undefined): string {
  return value?.trim().replace(/\s+/g, ' ') ?? ''
}

function toTitleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function stripKnownForPrefix(value: string): string {
  return value
    .replace(/^known for[:\s-]*/i, '')
    .replace(/\.$/, '')
    .trim()
}

function isRouteRationaleLike(value: string): boolean {
  const normalized = value.toLowerCase()
  return [
    'route',
    'night',
    'pacing',
    'moment',
    'sequence',
    'supports',
    'anchor',
    'build',
    'transition',
    'fit',
  ].some((token) => normalized.includes(token))
}

function getPreviewVenueTypeLabel(category?: ItineraryStop['category']): string {
  if (!category) {
    return ''
  }
  if (category === 'live_music') {
    return 'Live music'
  }
  if (category === 'cafe') {
    return 'Cafe'
  }
  if (category === 'bar') {
    return 'Bar'
  }
  if (category === 'dessert') {
    return 'Dessert'
  }
  if (category === 'restaurant') {
    return 'Restaurant'
  }
  if (category === 'activity') {
    return 'Activity'
  }
  if (category === 'museum') {
    return 'Museum'
  }
  if (category === 'park') {
    return 'Park'
  }
  return 'Event'
}

function getPreviewVenueTypeForStop(stop: ItineraryStop | undefined): string {
  if (!stop) {
    return ''
  }
  const baseType = getPreviewVenueTypeLabel(stop.category)
  const subcategory = normalizePreviewField(stop.subcategory)
  if (!subcategory) {
    return baseType
  }
  const normalizedSubcategory = subcategory.toLowerCase()
  const normalizedBase = baseType.toLowerCase()
  if (
    normalizedSubcategory === normalizedBase ||
    normalizedSubcategory.includes(normalizedBase)
  ) {
    return baseType
  }
  return `${baseType} (${toTitleCase(subcategory)})`
}

function getPreviewAreaNameForStop(stop: ItineraryStop | undefined): string {
  if (!stop) {
    return ''
  }
  const neighborhood = normalizePreviewField(stop.neighborhood)
  const city = normalizePreviewField(stop.city)
  if (neighborhood && city && neighborhood.toLowerCase() !== city.toLowerCase()) {
    return `${neighborhood}, ${city}`
  }
  return neighborhood || city
}

function getPreviewMediaUrlForStop(stop: ItineraryStop | undefined): string {
  const candidate = normalizePreviewField(stop?.imageUrl)
  if (!candidate) {
    return ''
  }
  const normalized = candidate.toLowerCase()
  if (normalized === 'n/a' || normalized === 'na' || normalized === 'none') {
    return ''
  }
  return candidate
}

function derivePreviewFitSummary(
  detail: VenueCardDetailInput | undefined,
  stop: ItineraryStop | undefined,
): string {
  const fromDetail = normalizePreviewField(detail?.whyItFits ?? detail?.stopNarrativeRoleMeaning)
  if (fromDetail) {
    return fromDetail
  }
  const fromStopReason = normalizePreviewField(stop?.selectedBecause)
  if (fromStopReason) {
    return fromStopReason
  }
  const fromStopSubtitle = normalizePreviewField(stop?.subtitle)
  if (fromStopSubtitle) {
    return fromStopSubtitle
  }
  const fromReasonLabels = (stop?.reasonLabels ?? [])
    .map((reason) => normalizePreviewField(reason))
    .find(Boolean)
  return fromReasonLabels ?? ''
}

function getPreviewMediaUrlForFallbackSeed(
  seed: VenueCardFallbackStopSeed | undefined,
  curatedVenueById: Map<string, Venue>,
): string {
  const venueId = normalizePreviewField(seed?.venueId)
  if (!venueId) {
    return ''
  }
  return normalizePreviewField(curatedVenueById.get(venueId)?.imageUrl)
}

function getPreviewVenueTypeForFallbackSeed(
  seed: VenueCardFallbackStopSeed | undefined,
  curatedVenueById: Map<string, Venue>,
): string {
  const explicitType = normalizePreviewField(seed?.venueType)
  if (explicitType) {
    return explicitType
  }
  const venueId = normalizePreviewField(seed?.venueId)
  const venue = venueId ? curatedVenueById.get(venueId) : undefined
  if (!venue) {
    return ''
  }
  const baseType = getPreviewVenueTypeLabel(venue.category)
  const subcategory = normalizePreviewField(venue.subcategory)
  if (!subcategory) {
    return baseType
  }
  const normalizedSubcategory = subcategory.toLowerCase()
  const normalizedBase = baseType.toLowerCase()
  if (
    normalizedSubcategory === normalizedBase ||
    normalizedSubcategory.includes(normalizedBase)
  ) {
    return baseType
  }
  return `${baseType} (${toTitleCase(subcategory)})`
}

function getPreviewAreaNameForFallbackSeed(
  seed: VenueCardFallbackStopSeed | undefined,
  curatedVenueById: Map<string, Venue>,
): string {
  const explicitArea = normalizePreviewField(seed?.areaName)
  if (explicitArea) {
    return explicitArea
  }
  const venueId = normalizePreviewField(seed?.venueId)
  const venue = venueId ? curatedVenueById.get(venueId) : undefined
  if (!venue) {
    return ''
  }
  const neighborhood = normalizePreviewField(venue.neighborhood)
  const city = normalizePreviewField(venue.city)
  if (neighborhood && city && neighborhood.toLowerCase() !== city.toLowerCase()) {
    return `${neighborhood}, ${city}`
  }
  return neighborhood || city
}

function derivePreviewKnownForFromFallbackSeed(
  seed: VenueCardFallbackStopSeed | undefined,
  curatedVenueById: Map<string, Venue>,
): string {
  const explicitKnownFor = normalizePreviewField(seed?.knownFor)
  if (explicitKnownFor) {
    return explicitKnownFor
  }
  const venueId = normalizePreviewField(seed?.venueId)
  const venue = venueId ? curatedVenueById.get(venueId) : undefined
  if (!venue) {
    return ''
  }
  const subcategory = normalizePreviewField(venue.subcategory)
  if (subcategory && !isRouteRationaleLike(subcategory)) {
    return toTitleCase(subcategory)
  }
  const textureTags = [...venue.tags, ...venue.vibeTags]
    .map((tag) => normalizePreviewField(tag))
    .filter(Boolean)
    .filter((tag) => !isRouteRationaleLike(tag))
    .filter((tag) => KNOWN_FOR_TEXTURE_TOKENS.has(tag.toLowerCase()))
    .slice(0, 2)
  if (textureTags.length > 0) {
    return textureTags.map((tag) => toTitleCase(tag)).join(' & ')
  }
  return ''
}

function derivePreviewKnownFor(
  detail: VenueCardDetailInput | undefined,
  stop: ItineraryStop | undefined,
): string {
  const flavorSummary = normalizePreviewField(detail?.stopFlavorSummary)
  if (flavorSummary && !isRouteRationaleLike(flavorSummary)) {
    return stripKnownForPrefix(flavorSummary)
  }
  const subcategory = normalizePreviewField(stop?.subcategory)
  if (subcategory && !isRouteRationaleLike(subcategory)) {
    return toTitleCase(subcategory)
  }
  const textureTags = [...(stop?.tags ?? []), ...(stop?.vibeTags ?? [])]
    .map((tag) => normalizePreviewField(tag))
    .filter((tag) => tag.length > 0)
    .filter((tag) => !isRouteRationaleLike(tag))
    .filter((tag) => KNOWN_FOR_TEXTURE_TOKENS.has(tag.toLowerCase()))
    .slice(0, 2)
  if (textureTags.length > 0) {
    return textureTags.map((tag) => toTitleCase(tag)).join(' & ')
  }
  return ''
}

function derivePreviewAreaFitSummary(
  detail: VenueCardDetailInput | undefined,
  stop: ItineraryStop | undefined,
): string {
  const localSignal = normalizePreviewField(detail?.localSignal)
  if (localSignal && !isRouteRationaleLike(localSignal)) {
    return localSignal
  }
  const neighborhood = normalizePreviewField(stop?.neighborhood).toLowerCase()
  const city = normalizePreviewField(stop?.city).toLowerCase()
  const aroundHereLine = (detail?.aroundHereSignals ?? [])
    .map((line) => normalizePreviewField(line))
    .find((line) => {
      const normalized = line.toLowerCase()
      if (!normalized) {
        return false
      }
      if (normalized.startsWith('flavor:')) {
        return false
      }
      if (normalized === neighborhood || normalized === city) {
        return false
      }
      if (normalized.includes('nearby options')) {
        return false
      }
      return true
    })
  return aroundHereLine ?? ''
}

function coalescePreviewField(...values: Array<string | undefined>): string {
  for (const value of values) {
    const normalized = normalizePreviewField(value)
    if (normalized) {
      return normalized
    }
  }
  return ''
}

function getThinRoleFitFallback(role: SharedStopRepresentationRole): string {
  if (role === 'start') {
    return 'Selected as a start option.'
  }
  if (role === 'highlight') {
    return 'Selected as a highlight option.'
  }
  if (role === 'windDown') {
    return 'Selected as a wind-down option.'
  }
  return 'Selected as a route option.'
}

function getThinVenueTypeFallback(role: SharedStopRepresentationRole): string {
  if (role === 'start') {
    return 'Start stop'
  }
  if (role === 'highlight') {
    return 'Highlight stop'
  }
  if (role === 'windDown') {
    return 'Wind-down stop'
  }
  return 'Route stop'
}

function getThinAreaNameFallback(params: {
  planningStop: ItineraryStop | undefined
  fallbackSeed: VenueCardFallbackStopSeed | undefined
  curatedVenueById: Map<string, Venue>
}): string {
  const { planningStop, fallbackSeed, curatedVenueById } = params
  const explicit = normalizePreviewField(planningStop?.city ?? fallbackSeed?.areaName)
  if (explicit) {
    return explicit
  }
  const venueId = normalizePreviewField(fallbackSeed?.venueId)
  const venue = venueId ? curatedVenueById.get(venueId) : undefined
  return normalizePreviewField(venue?.city)
}

function getThinAreaFitSummaryFallback(params: {
  planningStop: ItineraryStop | undefined
  fallbackSeed: VenueCardFallbackStopSeed | undefined
  areaName: string
}): string {
  const { planningStop, fallbackSeed, areaName } = params
  if (planningStop && Number.isFinite(planningStop.driveMinutes) && planningStop.driveMinutes > 0) {
    return `${planningStop.driveMinutes} min from this route step.`
  }
  const fallbackArea = normalizePreviewField(fallbackSeed?.areaName)
  if (fallbackArea) {
    return `Near ${fallbackArea}.`
  }
  if (areaName) {
    return `Near ${areaName}.`
  }
  return ''
}

export function buildVenueCardStopRepresentation(params: {
  role: SharedStopRepresentationRole
  detail: VenueCardDetailInput | undefined
  planningStop: ItineraryStop | undefined
  fallbackSeed: VenueCardFallbackStopSeed | undefined
  curatedVenueById: Map<string, Venue>
}): VenueCardStopRepresentationWithSource | null {
  const { role, detail, planningStop, fallbackSeed, curatedVenueById } = params
  const source: VenueCardStopRepresentationWithSource['source'] = planningStop
    ? 'planning_stop'
    : 'fallback_seed'
  const roleLabel = getStopRepresentationRoleLabel(role)

  const venueName = normalizePreviewField(planningStop?.venueName ?? fallbackSeed?.venueName)
  if (!venueName) {
    return null
  }

  const fitSummary = normalizePreviewField(
    planningStop ? derivePreviewFitSummary(detail, planningStop) : fallbackSeed?.fitSummary,
  )
  const resolvedFitSummary = fitSummary || getThinRoleFitFallback(role)

  const mediaUrl = planningStop
    ? getPreviewMediaUrlForStop(planningStop)
    : getPreviewMediaUrlForFallbackSeed(fallbackSeed, curatedVenueById)
  const knownFor = planningStop
    ? derivePreviewKnownFor(detail, planningStop)
    : derivePreviewKnownForFromFallbackSeed(fallbackSeed, curatedVenueById)
  const areaFitSummary = planningStop
    ? derivePreviewAreaFitSummary(detail, planningStop)
    : normalizePreviewField(fallbackSeed?.areaFitSummary)
  const venueType = planningStop
    ? getPreviewVenueTypeForStop(planningStop)
    : getPreviewVenueTypeForFallbackSeed(fallbackSeed, curatedVenueById)
  const areaName = planningStop
    ? getPreviewAreaNameForStop(planningStop)
    : getPreviewAreaNameForFallbackSeed(fallbackSeed, curatedVenueById)
  const resolvedVenueType = coalescePreviewField(venueType, getThinVenueTypeFallback(role))
  const resolvedAreaName = coalescePreviewField(
    areaName,
    getThinAreaNameFallback({
      planningStop,
      fallbackSeed,
      curatedVenueById,
    }),
  )
  const resolvedAreaFitSummary = coalescePreviewField(
    areaFitSummary,
    getThinAreaFitSummaryFallback({
      planningStop,
      fallbackSeed,
      areaName: resolvedAreaName,
    }),
  )

  return {
    role,
    roleLabel,
    venueName,
    fitSummary: resolvedFitSummary,
    mediaUrl,
    mediaAlt: venueName,
    venueType: resolvedVenueType,
    areaName: resolvedAreaName,
    knownFor,
    areaFitSummary: resolvedAreaFitSummary,
    source,
  }
}
