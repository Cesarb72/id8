import type { RuntimeRouteArtifact } from './runtimeRouteArtifact'
import type { DirectionPreviewModel } from './selectedRouteArtifact'

export function buildPreviewFromFinalRoute(route: RuntimeRouteArtifact): DirectionPreviewModel {
  return {
    directionId: route.selectedDirectionId,
    headline: route.routeHeadline,
    tone: route.routeSummary,
    stops: route.stops
      .slice()
      .sort((left, right) => left.stopIndex - right.stopIndex)
      .map((stop) => ({
        role: stop.role,
        name: stop.displayName,
      })),
    continuityLine: route.routeSummary,
  }
}
