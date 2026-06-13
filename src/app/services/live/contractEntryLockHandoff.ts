import {
  deriveContractEntryArtifactRoleCoverage,
  validateContractEntryArtifactPreCommitTruth,
  type ContractEntryArtifact,
} from '../../../domain/artifacts/contractEntryArtifact'
import { buildFinalRoute } from '../../../domain/artifacts/runtimeRouteProjection'
import type { ScoredVenue } from '../../../domain/types/arc'
import type { ExperienceMode, PersonaMode, VibeAnchor } from '../../../domain/types/intent'
import type { Itinerary, UserStopRole } from '../../../domain/types/itinerary'

interface LockCanonicalStopIdentity {
  displayName: string
  providerRecordId: string
  latitude: number
  longitude: number
  addressLine: string
  neighborhood: string
}

export interface ContractEntryRuntimeRouteLockInput {
  artifact: ContractEntryArtifact
  itinerary: Itinerary
  scoredVenues: ScoredVenue[]
  selectedDirectionId: string
  selectedClusterConfirmation: string
  city: string
  persona: PersonaMode
  vibe: VibeAnchor
  mode: ExperienceMode
}

export type ContractEntryRuntimeRouteLockResult =
  | {
      ok: true
      selectedClusterConfirmation: string
      itinerary: Itinerary
      finalRoute: NonNullable<ReturnType<typeof buildFinalRoute>>
      lockSafeItineraryStops: Itinerary['stops']
    }
  | {
      ok: false
      reason: string
    }

function normalizeRouteText(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function coreStopRolesMatchArtifact(params: {
  artifact: ContractEntryArtifact
  lockSafeItineraryStops: Itinerary['stops']
}): boolean {
  const roleCoverage = deriveContractEntryArtifactRoleCoverage(params.artifact)
  return (['start', 'highlight', 'windDown'] as const).every((role) => {
    const stop = params.lockSafeItineraryStops.find((candidate) => candidate.role === role)
    return normalizeRouteText(stop?.venueName) === normalizeRouteText(roleCoverage[role])
  })
}

function buildCanonicalStopByRole(params: {
  lockSafeItineraryStops: Itinerary['stops']
  scoredVenues: ScoredVenue[]
}):
  | {
      ok: true
      canonicalStopByRole: Partial<Record<UserStopRole, LockCanonicalStopIdentity>>
    }
  | {
      ok: false
      reason: string
    } {
  const scoredVenueByVenueId = new Map(params.scoredVenues.map((item) => [item.venue.id, item] as const))
  const canonicalStopResult = params.lockSafeItineraryStops.reduce<{
    stopsByRole: Partial<Record<UserStopRole, LockCanonicalStopIdentity>>
    failureReason?: string
  }>((next, stop) => {
    const scoredVenue = scoredVenueByVenueId.get(stop.venueId)
    if (!scoredVenue) {
      next.failureReason = `missing_scored_venue:${stop.role}:${stop.venueId}`
      return next
    }
    const venue = scoredVenue.venue
    const source = venue.source
    const providerRecordId =
      source.providerRecordId?.trim() ||
      (source.sourceOrigin === 'curated' ? venue.id.trim() : '')
    const addressLine = source.formattedAddress?.trim() || stop.formattedAddress?.trim()
    const latitude = source.latitude ?? stop.latitude
    const longitude = source.longitude ?? stop.longitude
    if (!providerRecordId) {
      next.failureReason = `missing_provider_record_id:${stop.role}:${stop.venueId}`
      return next
    }
    if (!addressLine) {
      next.failureReason = `missing_formatted_address:${stop.role}:${stop.venueId}`
      return next
    }
    if (
      typeof latitude !== 'number' ||
      !Number.isFinite(latitude) ||
      typeof longitude !== 'number' ||
      !Number.isFinite(longitude)
    ) {
      next.failureReason = `missing_coordinates:${stop.role}:${stop.venueId}`
      return next
    }
    next.stopsByRole[stop.role] = {
      displayName: venue.name,
      providerRecordId,
      latitude,
      longitude,
      addressLine,
      neighborhood: venue.neighborhood || stop.neighborhood,
    }
    return next
  }, { stopsByRole: {} })

  if (canonicalStopResult.failureReason) {
    return { ok: false, reason: canonicalStopResult.failureReason }
  }
  return { ok: true, canonicalStopByRole: canonicalStopResult.stopsByRole }
}

export function buildContractEntryRuntimeRouteLockTruth(
  input: ContractEntryRuntimeRouteLockInput,
): ContractEntryRuntimeRouteLockResult {
  const artifactValidation = validateContractEntryArtifactPreCommitTruth(input.artifact, {
    requireEnrichment: true,
  })
  if (artifactValidation.status !== 'valid' || !artifactValidation.fullPlanVisible) {
    return { ok: false, reason: `invalid_contract_entry_artifact:${artifactValidation.status}` }
  }
  if (input.artifact.enrichment?.runtimeLockEligibility?.eligible !== true) {
    return { ok: false, reason: 'runtime_lock_ineligible' }
  }
  if (input.artifact.enrichment?.mode && input.artifact.enrichment.mode !== input.mode) {
    return { ok: false, reason: 'mode_context_mismatch' }
  }
  if (!input.selectedDirectionId.trim()) {
    return { ok: false, reason: 'missing_selected_direction_id' }
  }
  if (!input.selectedClusterConfirmation.trim()) {
    return { ok: false, reason: 'missing_selected_cluster_confirmation' }
  }

  const lockSafeItineraryStops = input.itinerary.stops.filter(
    (stop) => stop.role === 'start' || stop.role === 'highlight' || stop.role === 'windDown',
  )
  const startStop = lockSafeItineraryStops.find((stop) => stop.role === 'start')
  if (!startStop) {
    return { ok: false, reason: 'missing_core_stop:start' }
  }
  const highlightStop = lockSafeItineraryStops.find((stop) => stop.role === 'highlight')
  if (!highlightStop) {
    return { ok: false, reason: 'missing_core_stop:highlight' }
  }
  const windDownStop = lockSafeItineraryStops.find((stop) => stop.role === 'windDown')
  if (!windDownStop) {
    return { ok: false, reason: 'missing_core_stop:windDown' }
  }
  if (
    !coreStopRolesMatchArtifact({
      artifact: input.artifact,
      lockSafeItineraryStops,
    })
  ) {
    return { ok: false, reason: 'itinerary_artifact_role_mismatch' }
  }

  const canonicalStopResult = buildCanonicalStopByRole({
    lockSafeItineraryStops,
    scoredVenues: input.scoredVenues,
  })
  if (!canonicalStopResult.ok) {
    return canonicalStopResult
  }
  const canonicalStopByRole = canonicalStopResult.canonicalStopByRole
  if (
    !canonicalStopByRole.start ||
    !canonicalStopByRole.highlight ||
    !canonicalStopByRole.windDown
  ) {
    return { ok: false, reason: 'missing_canonical_stop_identity' }
  }

  const itinerary: Itinerary = {
    ...input.itinerary,
    stops: lockSafeItineraryStops,
  }
  const finalRoute = buildFinalRoute({
    itinerary,
    canonicalStopByRole,
    selectedDirectionId: input.selectedDirectionId,
    city: input.city,
    persona: input.persona,
    vibe: input.vibe,
    activeRole: 'start',
    mode: input.mode,
    routeHeadline: input.artifact.routeTitle || input.itinerary.story.headline,
    routeSummary: input.artifact.routeSummary || input.itinerary.shareSummary,
  })
  if (!finalRoute) {
    return { ok: false, reason: 'build_final_route_failed' }
  }

  return {
    ok: true,
    selectedClusterConfirmation: input.selectedClusterConfirmation,
    itinerary,
    finalRoute,
    lockSafeItineraryStops,
  }
}
