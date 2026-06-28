import type { RuntimeRouteArtifact } from '../../../domain/artifacts/runtimeRouteArtifact'
import type { Itinerary, ItineraryStop, UserStopRole } from '../../../domain/types/itinerary'

export interface SandboxCanonicalRouteArtifactPlanSnapshot {
  selectedDirectionContract: {
    id: string
  }
  selectedClusterConfirmation: string
  itinerary: Itinerary
}

export interface SandboxCanonicalRouteArtifact<
  TPlanSnapshot extends SandboxCanonicalRouteArtifactPlanSnapshot,
  TCanonicalStopByRole,
> {
  selectedDirectionId: string
  selectedClusterConfirmation: string
  itinerary: Itinerary
  finalRoute: RuntimeRouteArtifact
  canonicalStopByRole: TCanonicalStopByRole
  planSnapshot: TPlanSnapshot
}

export interface SandboxCanonicalRouteArtifactApprovedPayload<
  TPlanSnapshot extends SandboxCanonicalRouteArtifactPlanSnapshot,
  TCanonicalStopByRole,
> {
  planSnapshot: TPlanSnapshot
  canonicalStopByRole: TCanonicalStopByRole
}

export interface BuildSandboxCanonicalRouteArtifactInput<
  TPlanSnapshot extends SandboxCanonicalRouteArtifactPlanSnapshot,
  TCanonicalStopByRole,
> {
  approvedPayload?: SandboxCanonicalRouteArtifactApprovedPayload<
    TPlanSnapshot,
    TCanonicalStopByRole
  > | null
  plan?: TPlanSnapshot | null
  routeAuthorityFinalRoute?: RuntimeRouteArtifact | null
  renderOnlyFinalRoute?: RuntimeRouteArtifact | null
  canonicalStopByRole: TCanonicalStopByRole
  isBuildWrapperActive: boolean
}

export function buildSandboxCanonicalRouteArtifact<
  TPlanSnapshot extends SandboxCanonicalRouteArtifactPlanSnapshot,
  TCanonicalStopByRole,
>(
  input: BuildSandboxCanonicalRouteArtifactInput<TPlanSnapshot, TCanonicalStopByRole>,
): SandboxCanonicalRouteArtifact<TPlanSnapshot, TCanonicalStopByRole> | null {
  const activePlan = input.approvedPayload?.planSnapshot ?? input.plan ?? null
  const routeAuthorityFinalRoute = input.routeAuthorityFinalRoute ?? null
  const buildAuthorityFinalRoute = input.isBuildWrapperActive ? routeAuthorityFinalRoute : null
  const activeFinalRoute = input.approvedPayload
    ? routeAuthorityFinalRoute
    : input.isBuildWrapperActive
      ? buildAuthorityFinalRoute
      : input.renderOnlyFinalRoute ?? null
  const activeCanonicalStopByRole =
    input.approvedPayload?.canonicalStopByRole ?? input.canonicalStopByRole

  if (!activePlan || !activeFinalRoute) {
    return null
  }
  const expectedDirectionId = activePlan.selectedDirectionContract.id
  if (!expectedDirectionId || activeFinalRoute.selectedDirectionId !== expectedDirectionId) {
    return null
  }

  return {
    selectedDirectionId: expectedDirectionId,
    selectedClusterConfirmation: activePlan.selectedClusterConfirmation,
    itinerary: activePlan.itinerary,
    finalRoute: activeFinalRoute,
    canonicalStopByRole: activeCanonicalStopByRole,
    planSnapshot: activePlan,
  }
}

export function projectFinalRouteToPlanningDisplayStops<
  TPlanSnapshot extends SandboxCanonicalRouteArtifactPlanSnapshot,
  TCanonicalStopByRole,
>(
  canonicalRouteArtifact:
    | SandboxCanonicalRouteArtifact<TPlanSnapshot, TCanonicalStopByRole>
    | null,
): ItineraryStop[] {
  if (!canonicalRouteArtifact) {
    return []
  }
  const stopBySourceId = new Map(
    canonicalRouteArtifact.itinerary.stops.map((stop) => [stop.id, stop] as const),
  )
  const stopByIndex = new Map(
    canonicalRouteArtifact.itinerary.stops.map((stop, index) => [index, stop] as const),
  )
  const orderedRouteStops = [...canonicalRouteArtifact.finalRoute.stops]
    .filter((stop) => stop.role !== 'surprise')
    .sort((left, right) => left.stopIndex - right.stopIndex)

  return orderedRouteStops
    .map((finalStop) => {
      const sourceStop =
        stopBySourceId.get(finalStop.sourceStopId) ??
        stopByIndex.get(finalStop.stopIndex) ??
        canonicalRouteArtifact.itinerary.stops.find(
          (stop) => stop.role === finalStop.role && stop.venueId === finalStop.venueId,
        ) ??
        canonicalRouteArtifact.itinerary.stops.find((stop) => stop.role === finalStop.role)
      if (!sourceStop) {
        return null
      }
      return {
        ...sourceStop,
        id: finalStop.sourceStopId,
        role: finalStop.role,
        title: finalStop.title,
        subtitle: finalStop.subtitle,
        venueId: finalStop.venueId,
        venueName: finalStop.displayName,
        city: canonicalRouteArtifact.finalRoute.location || sourceStop.city,
        neighborhood: finalStop.neighborhood || sourceStop.neighborhood,
        driveMinutes: finalStop.driveMinutes,
        imageUrl: finalStop.imageUrl,
      }
    })
    .filter((stop): stop is ItineraryStop => Boolean(stop))
}
