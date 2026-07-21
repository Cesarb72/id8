import { normalizeVenue } from '../../../domain/normalize/normalizeVenue'
import type { PreferredDiscoveryVenue } from '../../../domain/types/intent'
import type { Venue } from '../../../domain/types/venue'
import type { BuiltScenarioStop } from '../../../domain/interpretation/construction/scenarioBuilder'
import type {
  ContractEntryArtifactMaterializedRouteStop,
  ContractEntryArtifactMaterializedRouteStops,
} from '../../../domain/artifacts/contractEntryArtifact'
import type {
  CityOpportunityStopOption,
  VerifiedCityOpportunity,
} from '../../../domain/interpretation/verifiedCityOpportunity'

type CurateHardCommitRole = Extract<
  PreferredDiscoveryVenue['role'],
  'start' | 'highlight' | 'windDown'
>

export interface CurateScenarioHardCommitSeedVenueResult {
  seedVenues: Venue[]
  missingRoles: CurateHardCommitRole[]
  missingVenueIds: string[]
}

function roleAffinityFor(role: CurateHardCommitRole): Partial<Venue['roleAffinity']> {
  if (role === 'start') {
    return {
      warmup: 0.94,
      peak: 0.58,
      wildcard: 0.62,
      cooldown: 0.48,
    }
  }
  if (role === 'highlight') {
    return {
      warmup: 0.52,
      peak: 0.96,
      wildcard: 0.72,
      cooldown: 0.52,
    }
  }
  return {
    warmup: 0.48,
    peak: 0.58,
    wildcard: 0.62,
    cooldown: 0.94,
  }
}

function energyLevelForScenarioStop(
  stop: BuiltScenarioStop,
  role: CurateHardCommitRole,
): number {
  if (role === 'start') {
    return 2
  }
  if (role === 'highlight' || role === 'windDown') {
    if (
      stop.venueCategory === 'cafe' ||
      stop.venueCategory === 'dessert' ||
      stop.venueCategory === 'museum' ||
      stop.venueCategory === 'park'
    ) {
      return 2
    }
    if (stop.venueCategory === 'bar' || stop.venueCategory === 'restaurant') {
      return 3
    }
    if (
      stop.venueCategory === 'activity' ||
      stop.venueCategory === 'event' ||
      stop.venueCategory === 'live_music'
    ) {
      return 4
    }
    return 3
  }
  return 3
}

function socialDensityForScenarioStop(
  stop: BuiltScenarioStop,
  role: CurateHardCommitRole,
): number {
  if (role !== 'windDown') {
    return 4
  }
  if (
    stop.venueCategory === 'cafe' ||
    stop.venueCategory === 'dessert' ||
    stop.venueCategory === 'museum' ||
    stop.venueCategory === 'park'
  ) {
    return 2
  }
  return 3
}

function scenarioStopToSeedVenue(params: {
  stop: BuiltScenarioStop
  role: CurateHardCommitRole
  city: string
}): Venue {
  const { stop, role, city } = params
  return normalizeVenue({
    rawType: 'place',
    id: stop.venueId,
    name: stop.name,
    city,
    neighborhood: stop.neighborhoodLabel ?? stop.district ?? 'San Jose',
    driveMinutes: role === 'highlight' ? 14 : role === 'start' ? 12 : 16,
    categoryHint: stop.venueCategory,
    subcategoryHint: stop.venueSubcategory ?? stop.venueTypeLabel ?? stop.stopType,
    sourceTypes: [
      stop.stopType,
      stop.venueCategory,
      stop.venueSubcategory,
      ...(stop.sourceTypes ?? []),
      ...(stop.venueTags ?? []),
    ].filter((value): value is string => Boolean(value)),
    tags: [
      stop.stopType,
      stop.venueCategory,
      stop.venueSubcategory,
      ...(stop.venueTags ?? []),
      ...(stop.sourceTypes ?? []),
    ].filter((value): value is string => Boolean(value)),
    normalizedFromRawType: 'seed',
    sourceOrigin: 'curated',
    curatedSubtype: 'seed',
    sourceQueryLabel: 'scenario-hard-commit-seed',
    sourceConfidence: Math.max(0.72, stop.authorityScore),
    shortDescription:
      stop.factualSummary ?? stop.whyThisStop ?? stop.reasons[0] ?? `${stop.name} scenario route stop.`,
    narrativeFlavor:
      stop.whyThisStop ?? stop.reasons[0] ?? `${stop.name} preserves the selected scenario route.`,
    isHiddenGem: stop.isHiddenGem,
    isActive: true,
    localSignals: {
      localFavoriteScore: Math.max(0.62, stop.authorityScore),
      neighborhoodPrideScore: Math.max(0.58, stop.currentRelevance),
      repeatVisitorScore: Math.max(0.52, stop.authorityScore - 0.08),
    },
    roleAffinity: roleAffinityFor(role),
    energyLevel: energyLevelForScenarioStop(stop, role),
    socialDensity: socialDensityForScenarioStop(stop, role),
    uniquenessScore: Math.max(0.62, stop.authorityScore),
    distinctivenessScore: Math.max(0.62, stop.authorityScore),
    underexposureScore: stop.isHiddenGem ? 0.74 : 0.48,
    shareabilityScore: Math.max(0.55, stop.currentRelevance),
    eventCapable: stop.sourceType === 'event' || stop.venueCategory === 'event',
    performanceCapable:
      stop.venueCategory === 'live_music' ||
      (stop.performancePotential ?? 0) >= 0.55 ||
      Boolean(stop.sourceTypes?.some((type) => type.toLowerCase().includes('performance'))),
  })
}

function stopOptionToSeedVenue(params: {
  option: CityOpportunityStopOption
  role: CurateHardCommitRole
  city: string
}): Venue {
  const { option, role, city } = params
  return normalizeVenue({
    rawType: 'place',
    id: option.venueId,
    name: option.name,
    city,
    neighborhood: 'San Jose',
    driveMinutes: role === 'highlight' ? 14 : role === 'start' ? 12 : 16,
    sourceTypes: ['scenario-hard-commit-seed', role],
    tags: ['scenario-hard-commit-seed', role],
    normalizedFromRawType: 'seed',
    sourceOrigin: 'curated',
    curatedSubtype: 'seed',
    sourceQueryLabel: 'scenario-hard-commit-seed',
    sourceConfidence: Math.max(0.68, option.score ?? 0),
    shortDescription: option.reason,
    narrativeFlavor: option.reason,
    isActive: true,
    localSignals: {
      localFavoriteScore: Math.max(0.58, option.score ?? 0),
      neighborhoodPrideScore: Math.max(0.52, option.score ?? 0),
      repeatVisitorScore: Math.max(0.5, (option.score ?? 0.58) - 0.08),
    },
    roleAffinity: roleAffinityFor(role),
  })
}

function materializedRouteStopToSeedVenue(params: {
  stop: ContractEntryArtifactMaterializedRouteStop
  role: CurateHardCommitRole
  city: string
}): Venue {
  const { stop, role, city } = params
  const seedVenueId = getMaterializedRouteStopBaseVenueId(stop) ?? stop.venueId
  return normalizeVenue({
    rawType: 'place',
    id: seedVenueId,
    name: stop.name,
    city,
    neighborhood: stop.pocketLabel ?? 'San Jose',
    driveMinutes: role === 'highlight' ? 14 : role === 'start' ? 12 : 16,
    sourceTypes: ['materialized-route-lineage', role],
    tags: ['materialized-route-lineage', role],
    normalizedFromRawType: 'seed',
    sourceOrigin: 'curated',
    curatedSubtype: 'seed',
    sourceQueryLabel: 'materialized-route-lineage',
    sourceConfidence: 0.86,
    shortDescription: `${stop.name} is carried from the materialized ContractEntryArtifact route.`,
    narrativeFlavor: `${stop.name} preserves the materialized route selected for Great Stop projection.`,
    isActive: true,
    localSignals: {
      localFavoriteScore: 0.72,
      neighborhoodPrideScore: 0.68,
      repeatVisitorScore: 0.62,
    },
    roleAffinity: roleAffinityFor(role),
  })
}

function getMaterializedRouteStopBaseVenueId(
  stop: ContractEntryArtifactMaterializedRouteStop,
): string | null {
  return stop.candidateIdentity?.baseVenueId?.trim() || stop.baseVenueId?.trim() || null
}

function findScenarioStop(
  opportunity: VerifiedCityOpportunity,
  venueId: string,
): BuiltScenarioStop | undefined {
  return opportunity.scenarioNight?.stops.find((stop) => stop.venueId === venueId)
}

function findStopOption(
  opportunity: VerifiedCityOpportunity,
  venueId: string,
): CityOpportunityStopOption | undefined {
  return [
    ...opportunity.starts,
    ...(opportunity.highlightAlternates ?? []),
    ...opportunity.closes,
  ].find((option) => option.venueId === venueId)
}

export function buildCurateScenarioHardCommitSeedVenues(params: {
  opportunity: VerifiedCityOpportunity | undefined
  discoveryPreferences: PreferredDiscoveryVenue[] | undefined
  materializedRouteStops?: ContractEntryArtifactMaterializedRouteStops
  city: string
}): CurateScenarioHardCommitSeedVenueResult {
  const rolePreferences = (params.discoveryPreferences ?? []).filter(
    (preference): preference is PreferredDiscoveryVenue & { role: CurateHardCommitRole } =>
      preference.role === 'start' ||
      preference.role === 'highlight' ||
      preference.role === 'windDown',
  )
  const requiredRoles: CurateHardCommitRole[] = ['start', 'highlight', 'windDown']
  const seedVenues: Venue[] = []
  const missingRoles: CurateHardCommitRole[] = []
  const missingVenueIds: string[] = []

  if (!params.opportunity && !params.materializedRouteStops) {
    return {
      seedVenues,
      missingRoles: requiredRoles,
      missingVenueIds: rolePreferences.map((preference) => preference.venueId),
    }
  }

  for (const role of requiredRoles) {
    const preference = rolePreferences.find((entry) => entry.role === role)
    const venueId = preference?.venueId.trim()
    if (!venueId) {
      missingRoles.push(role)
      continue
    }

    const scenarioStop = params.opportunity
      ? findScenarioStop(params.opportunity, venueId)
      : undefined
    if (scenarioStop) {
      seedVenues.push(
        scenarioStopToSeedVenue({
          stop: scenarioStop,
          role,
          city: params.city,
        }),
      )
      continue
    }

    const stopOption = params.opportunity
      ? findStopOption(params.opportunity, venueId)
      : undefined
    if (stopOption) {
      seedVenues.push(
        stopOptionToSeedVenue({
          option: stopOption,
          role,
          city: params.city,
        }),
      )
      continue
    }

    const materializedStop = params.materializedRouteStops?.[role]
    const materializedStopIds = materializedStop
      ? [
          materializedStop.venueId.trim(),
          getMaterializedRouteStopBaseVenueId(materializedStop),
        ].filter((value): value is string => Boolean(value))
      : []
    if (materializedStop && materializedStopIds.includes(venueId)) {
      seedVenues.push(
        materializedRouteStopToSeedVenue({
          stop: materializedStop,
          role,
          city: params.city,
        }),
      )
      continue
    }

    missingRoles.push(role)
    missingVenueIds.push(venueId)
  }

  return {
    seedVenues,
    missingRoles,
    missingVenueIds,
  }
}
