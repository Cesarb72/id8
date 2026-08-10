import {
  assertSelectableAnchorSearchResult,
  isSelectableAnchorSearchResult,
  type AnchorSearchResult,
  type SelectableAnchorSearchResult,
} from './arcApplicationService'
import type { BuildAnchorRoleResolutionSource } from '../../domain/artifacts/buildAnchorTruthContract'
import type { UserStopRole } from '../../domain/types/itinerary'
import type { Venue } from '../../domain/types/venue'

export type BuildAnchorRole = Extract<UserStopRole, 'start' | 'highlight' | 'windDown'>

export type BuildAnchorSelection = {
  venueId: string
  name: string
  category: Venue['category']
  city: string
  neighborhood: string
  sourceVenueId?: string
  providerRecordId?: string
}

export type BuildPlannerAnchor = {
  venueId: string
  role?: BuildAnchorRole
  roleResolutionSource: BuildAnchorRoleResolutionSource
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
  result: SelectableAnchorSearchResult | null
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

function isBuildAnchorCoreRole(role: UserStopRole | string | undefined): role is BuildAnchorRole {
  return role === 'start' || role === 'highlight' || role === 'windDown'
}

function getBuildAnchorProviderRecordIdFromVenue(venue: Venue): string | undefined {
  return normalizeOptionalString(venue.source.providerRecordId)
}

function getBuildAnchorProviderRecordIdFromSelection(
  selection: Partial<BuildAnchorSelection>,
): string | undefined {
  return normalizeOptionalString(selection.providerRecordId)
}

function isProviderLookingRouteIdentity(value: string, providerRecordId?: string): boolean {
  const normalized = value.trim().toLowerCase()
  return (
    normalized.startsWith('live_google_') ||
    Boolean(providerRecordId && normalized === providerRecordId.trim().toLowerCase())
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
  if (isProviderLookingRouteIdentity(venueId, providerRecordId)) {
    return null
  }
  const sourceVenueId = normalizeOptionalString(selection.sourceVenueId)

  return {
    venueId,
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
  const selectable = assertSelectableAnchorSearchResult(result)
  const selection = canonicalizeBuildAnchorSelection({
    venueId: selectable.venue.id,
    name: selectable.venue.name,
    category: selectable.venue.category,
    city: selectable.venue.city,
    neighborhood: selectable.venue.neighborhood,
    providerRecordId: getBuildAnchorProviderRecordIdFromVenue(selectable.venue),
  })
  if (!selection) {
    throw new Error('Selectable Build anchor result does not carry an admitted route identity.')
  }
  return selection
}

export function doesBuildAnchorResultMatchSelection(
  result: AnchorSearchResult,
  selection: BuildAnchorSelection | null,
): boolean {
  if (!selection) {
    return false
  }
  if (!isSelectableAnchorSearchResult(result)) {
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
    const result = JSON.parse(rawResult) as AnchorSearchResult
    return { result: isSelectableAnchorSearchResult(result) ? result : null }
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
  const matchedResult = params.buildAnchorResults.find(
    (result): result is SelectableAnchorSearchResult =>
      isSelectableAnchorSearchResult(result) &&
      doesBuildAnchorResultMatchSelection(result, params.selectedBuildAnchor),
  )
  if (matchedResult) {
    return matchedResult.venue
  }
  return params.selectedBuildAnchorResult &&
    isSelectableAnchorSearchResult(params.selectedBuildAnchorResult) &&
    doesBuildAnchorResultMatchSelection(
      params.selectedBuildAnchorResult,
      params.selectedBuildAnchor,
    )
    ? params.selectedBuildAnchorResult.venue
    : null
}

export function deriveBuildPlannerAnchor(params: {
  isBuildWrapperActive: boolean
  selectedBuildAnchor: BuildAnchorSelection | null
  selectedBuildAnchorRole?: BuildAnchorRole | null
  activeCandidateAnchorRole?: BuildAnchorRole | null
}): BuildPlannerAnchor | undefined {
  if (!params.isBuildWrapperActive || !params.selectedBuildAnchor?.venueId) {
    return undefined
  }
  const role = params.selectedBuildAnchorRole ?? params.activeCandidateAnchorRole ?? undefined
  const roleResolutionSource: BuildAnchorRoleResolutionSource = params.selectedBuildAnchorRole
    ? 'explicit'
    : params.activeCandidateAnchorRole
      ? 'inferred'
      : 'missing'
  return {
    venueId: params.selectedBuildAnchor.venueId,
    ...(role ? { role } : {}),
    roleResolutionSource,
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
    params.resultAnchor?.role ?? params.buildPlannerAnchor?.role
  if (!requiredAnchorVenueId || !isBuildAnchorCoreRole(requiredAnchorRole)) {
    return undefined
  }
  return {
    venueId: requiredAnchorVenueId,
    role: requiredAnchorRole,
  }
}
