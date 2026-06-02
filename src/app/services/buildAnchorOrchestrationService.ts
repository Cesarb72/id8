import type { AnchorSearchResult } from './arcApplicationService'
import { curatedVenues } from '../../data/venues'
import { getProviderRecordIdFromLiveGoogleVenueId } from '../../domain/providers/admitLiveVenueIdentity'
import {
  isCanonicalVenueResolved,
  resolveCanonicalVenueIdForProviderRecord,
} from '../../domain/providers/providerCanonicalVenueMapping'
import type { UserStopRole } from '../../domain/types/itinerary'
import type { Venue } from '../../domain/types/venue'

export type BuildAnchorRole = Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>

export type BuildAnchorSelection = {
  venueId: string
  name: string
  category: AnchorSearchResult['venue']['category']
  city: string
  neighborhood: string
  sourceVenueId?: string
  providerRecordId?: string
}

export type BuildPlannerAnchor = {
  venueId: string
  role: BuildAnchorRole
}

export type RequiredBuildAnchorStop = {
  venueId: string
  role: BuildAnchorRole
}

export type PersistedBuildAnchorSelectionRestore = {
  selection: BuildAnchorSelection | null
  normalizedSelectionRaw: string | null
  shouldClearSelection: boolean
  shouldClearResult: boolean
}

export type PersistedBuildAnchorResultRestore = {
  result: AnchorSearchResult | null
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

function isBuildAnchorCoreRole(role: UserStopRole | string | undefined): role is BuildAnchorRole {
  return role === 'start' || role === 'highlight' || role === 'windDown'
}

function getBuildAnchorProviderRecordIdFromVenue(venue: Venue): string | undefined {
  return (
    normalizeOptionalString(venue.source.providerRecordId) ??
    getProviderRecordIdFromLiveGoogleVenueId(venue.id)
  )
}

function getBuildAnchorProviderRecordIdFromSelection(
  selection: Partial<BuildAnchorSelection>,
): string | undefined {
  return (
    normalizeOptionalString(selection.providerRecordId) ??
    (selection.sourceVenueId
      ? getProviderRecordIdFromLiveGoogleVenueId(selection.sourceVenueId)
      : undefined) ??
    (selection.venueId ? getProviderRecordIdFromLiveGoogleVenueId(selection.venueId) : undefined)
  )
}

export function canonicalizeBuildAnchorSelection(
  selection: Partial<BuildAnchorSelection> | null | undefined,
): BuildAnchorSelection | null {
  if (!selection) {
    return null
  }
  const venueId = normalizeOptionalString(selection.venueId)
  const name = normalizeOptionalString(selection.name)
  const city = normalizeOptionalString(selection.city)
  const neighborhood = normalizeOptionalString(selection.neighborhood)
  if (!venueId || !name || !city || !neighborhood || !selection.category) {
    return null
  }

  const providerRecordId = getBuildAnchorProviderRecordIdFromSelection(selection)
  const canonicalMapping = providerRecordId
    ? resolveCanonicalVenueIdForProviderRecord({
        provider: 'google-places',
        providerRecordId,
        staticVenues: curatedVenues,
      })
    : null
  const canonicalVenueId =
    canonicalMapping && isCanonicalVenueResolved(canonicalMapping)
      ? canonicalMapping.canonicalVenueId
      : undefined
  const canonicalizedVenueId = canonicalVenueId ?? venueId
  const sourceVenueId =
    canonicalVenueId && canonicalVenueId !== venueId
      ? normalizeOptionalString(selection.sourceVenueId) ?? venueId
      : normalizeOptionalString(selection.sourceVenueId)

  return {
    venueId: canonicalizedVenueId,
    name,
    category: selection.category,
    city,
    neighborhood,
    ...(sourceVenueId ? { sourceVenueId } : {}),
    ...(providerRecordId ? { providerRecordId } : {}),
  }
}

export function buildAnchorSelectionFromSearchResult(
  result: AnchorSearchResult,
): BuildAnchorSelection {
  return canonicalizeBuildAnchorSelection({
    venueId: result.venue.id,
    name: result.venue.name,
    category: result.venue.category,
    city: result.venue.city,
    neighborhood: result.venue.neighborhood,
    providerRecordId: getBuildAnchorProviderRecordIdFromVenue(result.venue),
  }) ?? {
    venueId: result.venue.id,
    name: result.venue.name,
    category: result.venue.category,
    city: result.venue.city,
    neighborhood: result.venue.neighborhood,
  }
}

export function doesBuildAnchorResultMatchSelection(
  result: AnchorSearchResult,
  selection: BuildAnchorSelection | null,
): boolean {
  if (!selection) {
    return false
  }
  const resultVenueId = result.venue.id.trim()
  const selectedVenueId = selection.venueId.trim()
  if (resultVenueId && resultVenueId === selectedVenueId) {
    return true
  }

  const sourceVenueId = normalizeOptionalString(selection.sourceVenueId)
  if (sourceVenueId && resultVenueId === sourceVenueId) {
    return true
  }

  const resultProviderRecordId = getBuildAnchorProviderRecordIdFromVenue(result.venue)
  const selectedProviderRecordId = getBuildAnchorProviderRecordIdFromSelection(selection)
  return Boolean(
    resultProviderRecordId &&
      selectedProviderRecordId &&
      resultProviderRecordId === selectedProviderRecordId,
  )
}

export function restorePersistedBuildAnchorSelection(
  rawSelection: string | null,
): PersistedBuildAnchorSelectionRestore {
  if (!rawSelection) {
    return {
      selection: null,
      normalizedSelectionRaw: null,
      shouldClearSelection: false,
      shouldClearResult: false,
    }
  }
  try {
    const selection = canonicalizeBuildAnchorSelection(
      JSON.parse(rawSelection) as Partial<BuildAnchorSelection>,
    )
    if (!selection) {
      return {
        selection: null,
        normalizedSelectionRaw: null,
        shouldClearSelection: true,
        shouldClearResult: true,
      }
    }
    const normalizedSelectionRaw = JSON.stringify(selection)
    return {
      selection,
      normalizedSelectionRaw:
        normalizedSelectionRaw === rawSelection ? null : normalizedSelectionRaw,
      shouldClearSelection: false,
      shouldClearResult: false,
    }
  } catch {
    return {
      selection: null,
      normalizedSelectionRaw: null,
      shouldClearSelection: true,
      shouldClearResult: true,
    }
  }
}

export function restorePersistedBuildAnchorResult(
  rawResult: string | null,
): PersistedBuildAnchorResultRestore {
  if (!rawResult) {
    return { result: null }
  }
  try {
    return { result: JSON.parse(rawResult) as AnchorSearchResult }
  } catch {
    return { result: null }
  }
}

export function selectBuildAnchorVenue(params: {
  isBuildWrapperActive: boolean
  selectedBuildAnchor: BuildAnchorSelection | null
  buildAnchorResults: AnchorSearchResult[]
  selectedBuildAnchorResult: AnchorSearchResult | null
}): Venue | null {
  if (!params.isBuildWrapperActive || !params.selectedBuildAnchor) {
    return null
  }
  return (
    params.buildAnchorResults.find((result) =>
      doesBuildAnchorResultMatchSelection(result, params.selectedBuildAnchor),
    )?.venue ??
    (params.selectedBuildAnchorResult &&
    doesBuildAnchorResultMatchSelection(
      params.selectedBuildAnchorResult,
      params.selectedBuildAnchor,
    )
      ? params.selectedBuildAnchorResult.venue
      : null)
  )
}

export function deriveBuildPlannerAnchor(params: {
  isBuildWrapperActive: boolean
  selectedBuildAnchor: BuildAnchorSelection | null
  activeCandidateAnchorRole?: BuildAnchorRole | null
}): BuildPlannerAnchor | undefined {
  if (!params.isBuildWrapperActive || !params.selectedBuildAnchor?.venueId) {
    return undefined
  }
  return {
    venueId: params.selectedBuildAnchor.venueId,
    role: params.activeCandidateAnchorRole ?? 'highlight',
  }
}

export function deriveRequiredBuildAnchorForPostPlanner(params: {
  isBuildWrapperActive: boolean
  selectedBuildAnchor: BuildAnchorSelection | null
  resultAnchor?: {
    venueId?: string
    role?: UserStopRole | string
  } | null
  buildPlannerAnchor?: BuildPlannerAnchor
}): RequiredBuildAnchorStop | undefined {
  if (!params.isBuildWrapperActive || !params.selectedBuildAnchor?.venueId) {
    return undefined
  }
  const requiredAnchorVenueId =
    params.resultAnchor?.venueId ?? params.selectedBuildAnchor.venueId
  const requiredAnchorRole =
    params.resultAnchor?.role ?? params.buildPlannerAnchor?.role ?? 'highlight'
  if (!requiredAnchorVenueId || !isBuildAnchorCoreRole(requiredAnchorRole)) {
    return undefined
  }
  return {
    venueId: requiredAnchorVenueId,
    role: requiredAnchorRole,
  }
}
