import type { ContractEntryArtifact } from '../../../domain/artifacts/contractEntryArtifact'
import type { StarterSemanticRepresentation } from '../../../domain/interpretation/construction/scenarioBuilder'
import type { GeneratePlanResult } from '../../../domain/runGeneratePlan'
import type { IntentInput } from '../../../domain/types/intent'
import type { StarterPack } from '../../../domain/types/starterPack'
import {
  buildCoffeeBooksSemanticRepresentationFromRouteStops,
} from './coffeeBooksSemanticRepresentation'

type PublicRouteRole = 'start' | 'highlight' | 'windDown'
type PlannerRouteRole = GeneratePlanResult['selectedArc']['stops'][number]['role']
type PlannerRouteStop = GeneratePlanResult['selectedArc']['stops'][number]

export type CurateCommittedRouteFallbackRejectedReason =
  | 'feature_flag_disabled'
  | 'source_mode_not_curated'
  | 'live_source_present'
  | 'missing_direction_backing'
  | 'missing_start_role'
  | 'missing_highlight_role'
  | 'missing_windDown_role'

export interface CurateCommittedRouteFallbackAccepted {
  status: 'accepted'
  artifact: ContractEntryArtifact
  routeStops: string[]
  sourceMode: {
    requestedMode: string | null
    effectiveMode: string | null
    liveFetchAttempted: boolean | null
    liveCount: number | null
  }
}

export interface CurateCommittedRouteFallbackRejected {
  status: 'rejected'
  rejectedReason: CurateCommittedRouteFallbackRejectedReason
  routeStops: string[]
  sourceMode: {
    requestedMode: string | null
    effectiveMode: string | null
    liveFetchAttempted: boolean | null
    liveCount: number | null
  }
}

export type CurateCommittedRouteFallbackDecision =
  | CurateCommittedRouteFallbackAccepted
  | CurateCommittedRouteFallbackRejected

const routeRolePreference: Record<PublicRouteRole, PlannerRouteRole[]> = {
  start: ['warmup'],
  highlight: ['peak'],
  windDown: ['cooldown'],
}

const fallbackArtifactIdPrefix = 'curate_committed_route_fallback'

function readEnvValue(key: string): string | undefined {
  const importMetaEnv = import.meta.env as Record<string, string | undefined> | undefined
  const processEnv =
    typeof process === 'undefined'
      ? undefined
      : (process.env as Record<string, string | undefined>)
  return importMetaEnv?.[key] ?? processEnv?.[key]
}

export function isCurateCommittedRouteFallbackEnabled(): boolean {
  const raw = readEnvValue('VITE_ID8_ENABLE_FIELD_STATIC_PROVIDER_CORPUS_CURATE')
  return ['1', 'true', 'on', 'yes'].includes(String(raw ?? '').trim().toLowerCase())
}

export function buildCurateStarterPlannerInput(starterPack: StarterPack): IntentInput {
  return {
    mode: 'curate',
    persona: starterPack.personaBias ?? null,
    primaryVibe: starterPack.primaryAnchor,
    secondaryVibe: starterPack.secondaryAnchors?.[0],
    city: 'San Jose',
    distanceMode: starterPack.distanceMode ?? 'nearby',
    prefersHiddenGems: starterPack.lensPreset?.discoveryBias === 'high',
  }
}

export function getCurateCommittedRouteFallbackArtifactId(starterPackId: string): string {
  return `${fallbackArtifactIdPrefix}:${starterPackId}`
}

export function isCurateCommittedRouteFallbackArtifact(
  artifact: Pick<ContractEntryArtifact, 'id'> | null | undefined,
): boolean {
  return Boolean(artifact?.id.startsWith(`${fallbackArtifactIdPrefix}:`))
}

function findRoleStop(result: GeneratePlanResult, role: PublicRouteRole) {
  const plannerRoles = routeRolePreference[role]
  return result.selectedArc.stops.find((stop) => plannerRoles.includes(stop.role)) ?? null
}

function getRouteStops(result: GeneratePlanResult): string[] {
  return result.selectedArc.stops.map(
    (stop) => `${stop.role}:${stop.scoredVenue.venue.name}`,
  )
}

function getLiveSource(result: GeneratePlanResult) {
  const liveSource = result.trace.retrievalDiagnostics.liveSource
  return {
    requestedMode: liveSource.requestedMode,
    effectiveMode: liveSource.effectiveMode,
    liveFetchAttempted: liveSource.liveFetchAttempted,
    liveCount: liveSource.countsBySource.live,
  }
}

function buildCoffeeBooksFallbackSemanticRepresentation(
  stops: PlannerRouteStop[],
): StarterSemanticRepresentation {
  return buildCoffeeBooksSemanticRepresentationFromRouteStops(
    stops.map((stop) => {
      const venue = stop.scoredVenue.venue
      return {
        venueId: venue.id,
        name: venue.name,
        position:
          stop.role === 'warmup'
            ? 'start'
            : stop.role === 'peak'
              ? 'highlight'
              : stop.role === 'cooldown'
                ? 'windDown'
                : 'mid',
        stopType:
          venue.category === 'museum' ? 'cultural_institution' : 'atmospheric_experience',
        evidenceParts: [
          { field: 'venueCategory', value: venue.category },
          { field: 'venueSubcategory', value: venue.subcategory },
          { field: 'tag', value: venue.tags },
        ],
      }
    }),
  )
}

export function buildCurateCommittedRouteFallbackDecision(params: {
  starterPack: StarterPack
  result: GeneratePlanResult
  selectedDirectionId: string | null | undefined
  selectedPocketId?: string | null
}): CurateCommittedRouteFallbackDecision {
  const routeStops = getRouteStops(params.result)
  const sourceMode = getLiveSource(params.result)
  if (!isCurateCommittedRouteFallbackEnabled()) {
    return {
      status: 'rejected',
      rejectedReason: 'feature_flag_disabled',
      routeStops,
      sourceMode,
    }
  }
  if (sourceMode.requestedMode !== 'curated' || sourceMode.effectiveMode !== 'curated') {
    return {
      status: 'rejected',
      rejectedReason: 'source_mode_not_curated',
      routeStops,
      sourceMode,
    }
  }
  if (sourceMode.liveFetchAttempted || sourceMode.liveCount !== 0) {
    return {
      status: 'rejected',
      rejectedReason: 'live_source_present',
      routeStops,
      sourceMode,
    }
  }
  const selectedDirectionId = params.selectedDirectionId?.trim()
  if (!selectedDirectionId) {
    return {
      status: 'rejected',
      rejectedReason: 'missing_direction_backing',
      routeStops,
      sourceMode,
    }
  }

  const start = findRoleStop(params.result, 'start')
  const highlight = findRoleStop(params.result, 'highlight')
  const windDown = findRoleStop(params.result, 'windDown')
  if (!start) {
    return {
      status: 'rejected',
      rejectedReason: 'missing_start_role',
      routeStops,
      sourceMode,
    }
  }
  if (!highlight) {
    return {
      status: 'rejected',
      rejectedReason: 'missing_highlight_role',
      routeStops,
      sourceMode,
    }
  }
  if (!windDown) {
    return {
      status: 'rejected',
      rejectedReason: 'missing_windDown_role',
      routeStops,
      sourceMode,
    }
  }
  const fallbackRouteStops = [start, highlight, windDown]
  const coffeeBooksSemanticRepresentation =
    params.starterPack.id === 'coffee-books'
      ? buildCoffeeBooksFallbackSemanticRepresentation(fallbackRouteStops)
      : null

  const routeSummary =
    params.result.itinerary.storySpine?.routeSummary ?? params.result.itinerary.shareSummary
  const artifact: ContractEntryArtifact = {
    id: getCurateCommittedRouteFallbackArtifactId(params.starterPack.id),
    sourceOpportunityId: getCurateCommittedRouteFallbackArtifactId(params.starterPack.id),
    sourceMode: 'curated',
    anchorVenueId: highlight.scoredVenue.venue.id,
    anchorRole: 'highlight',
    anchorName: highlight.scoredVenue.venue.name,
    routeTitle: params.result.itinerary.storySpine?.title ?? params.result.itinerary.title,
    flavorLine: params.starterPack.description,
    routeSummary,
    traits: [
      params.starterPack.primaryAnchor,
      ...(params.starterPack.secondaryAnchors ?? []),
    ].filter((value) => Boolean(value && value.trim())),
    storySpine: {
      start: start.scoredVenue.venue.name,
      highlight: highlight.scoredVenue.venue.name,
      windDown: windDown.scoredVenue.venue.name,
    },
    districtLine: `Mostly in ${params.result.itinerary.city || 'San Jose'}`,
    districtAnchorLine: `District anchor: ${params.result.itinerary.city || 'San Jose'}`,
    authorityLine: routeSummary,
    whyChooseLine: routeSummary,
    selection: {
      directionId: selectedDirectionId,
      ...(params.selectedPocketId ? { pocketId: params.selectedPocketId } : {}),
    },
    ...(coffeeBooksSemanticRepresentation
      ? {
          enrichment: {
            starterSemanticRepresentation: coffeeBooksSemanticRepresentation,
          },
        }
      : {}),
  }

  return {
    status: 'accepted',
    artifact,
    routeStops,
    sourceMode,
  }
}
