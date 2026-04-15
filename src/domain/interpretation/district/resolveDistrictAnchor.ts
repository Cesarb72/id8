import { deriveReadableDistrictName } from '../../districts/deriveReadableDistrictName'
import type { SpatialCoherenceAnalysis } from '../../types/spatial'
import type { DistrictAnchor } from '../../types/district'

interface ResolveDistrictAnchorInput {
  city: string
  district?: string
  neighborhood?: string
  spatial?: Pick<SpatialCoherenceAnalysis, 'homeClusterId' | 'clusterAssignments'>
}

interface DistrictAliasDefinition {
  idSuffix: string
  label: string
  aliases: string[]
}

interface StrongestCluster {
  clusterId: string
  clusterShare: number
  clusterNeighborhoods: string[]
}

const CITY_DISTRICT_ALIASES: Record<string, DistrictAliasDefinition[]> = {
  san_jose: [
    {
      idSuffix: 'downtown',
      label: 'Downtown',
      aliases: ['downtown', 'downtown core', 'downtown-core'],
    },
    {
      idSuffix: 'sofa',
      label: 'SoFA',
      aliases: ['sofa', 'south first area', 'south of first'],
    },
    {
      idSuffix: 'san_pedro',
      label: 'San Pedro',
      aliases: ['san pedro', 'san pedro square'],
    },
    {
      idSuffix: 'santana_row',
      label: 'Santana Row / Valley Fair',
      aliases: ['santana row', 'valley fair', 'santana row corridor', 'santana-row-corridor'],
    },
    {
      idSuffix: 'west_valley',
      label: 'West Valley',
      aliases: ['west valley'],
    },
  ],
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function roundToHundredths(value: number): number {
  return Number(value.toFixed(2))
}

function normalizeLabel(value: string | undefined): string {
  return value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() ?? ''
}

function slugifySegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'unknown'
}

function formatDistrictLabel(value: string): string {
  return value
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function getCityAliases(citySlug: string): DistrictAliasDefinition[] {
  return CITY_DISTRICT_ALIASES[citySlug] ?? []
}

function matchDistrictAlias(
  citySlug: string,
  value: string | undefined,
): { districtId: string; districtLabel: string } | undefined {
  const normalized = normalizeLabel(value)
  if (!normalized) {
    return undefined
  }

  const match = getCityAliases(citySlug).find((alias) =>
    alias.aliases.some((entry) => normalizeLabel(entry) === normalized),
  )
  if (!match) {
    return undefined
  }

  return {
    districtId: `${citySlug}.${match.idSuffix}`,
    districtLabel: match.label,
  }
}

function canonicalizeDistrict(
  citySlug: string,
  rawDistrict: string,
): { districtId: string; districtLabel: string } {
  if (rawDistrict.includes('.')) {
    const [rawCity, ...rest] = rawDistrict.split('.')
    const districtSuffix = rest.join('.')
    const normalizedCity = slugifySegment(rawCity)
    const normalizedSuffix = districtSuffix
      .split('.')
      .map((segment) => slugifySegment(segment))
      .join('.')

    return {
      districtId: `${normalizedCity}.${normalizedSuffix}`,
      districtLabel: formatDistrictLabel(normalizedSuffix.split('.').slice(-1)[0] ?? rawDistrict),
    }
  }

  return {
    districtId: `${citySlug}.${slugifySegment(rawDistrict)}`,
    districtLabel: formatDistrictLabel(rawDistrict),
  }
}

function pickStrongestCluster(
  spatial: ResolveDistrictAnchorInput['spatial'],
): StrongestCluster | undefined {
  const assignments = spatial?.clusterAssignments ?? []
  if (assignments.length === 0) {
    return undefined
  }

  const counts = new Map<string, number>()
  const neighborhoodsByCluster = new Map<string, string[]>()
  for (const assignment of assignments) {
    counts.set(assignment.clusterId, (counts.get(assignment.clusterId) ?? 0) + 1)
    const current = neighborhoodsByCluster.get(assignment.clusterId) ?? []
    if (assignment.neighborhood && !current.includes(assignment.neighborhood)) {
      current.push(assignment.neighborhood)
    }
    neighborhoodsByCluster.set(assignment.clusterId, current)
  }

  const orderedClusters = [...counts.entries()].sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1]
    }
    if (left[0] === spatial?.homeClusterId) {
      return -1
    }
    if (right[0] === spatial?.homeClusterId) {
      return 1
    }
    return left[0].localeCompare(right[0])
  })
  const strongest = orderedClusters[0]
  if (!strongest) {
    return undefined
  }

  return {
    clusterId: strongest[0],
    clusterShare: strongest[1] / assignments.length,
    clusterNeighborhoods: neighborhoodsByCluster.get(strongest[0]) ?? [],
  }
}

function createCityFallback(city: string, citySlug: string): DistrictAnchor {
  return {
    districtId: `${citySlug}.citywide`,
    districtLabel: city,
    source: 'city_fallback',
    confidence: 0.4,
    reason: 'city fallback due to weak cluster',
  }
}

function toReadableDistrictLabel(districtLabel: string, city: string): string {
  return deriveReadableDistrictName(districtLabel, { city }).displayName
}

export function resolveDistrictAnchor({
  city,
  district,
  neighborhood,
  spatial,
}: ResolveDistrictAnchorInput): DistrictAnchor {
  const trimmedCity = city.trim() || 'San Jose'
  const citySlug = slugifySegment(trimmedCity)

  if (district?.trim()) {
    const aliasedDistrict =
      matchDistrictAlias(citySlug, district) ?? canonicalizeDistrict(citySlug, district)
    return {
      districtId: aliasedDistrict.districtId,
      districtLabel: toReadableDistrictLabel(aliasedDistrict.districtLabel, trimmedCity),
      source: 'explicit_district',
      confidence: 1,
      reason: 'explicit district selected',
    }
  }

  if (neighborhood?.trim()) {
    const aliasedNeighborhood =
      matchDistrictAlias(citySlug, neighborhood) ?? canonicalizeDistrict(citySlug, neighborhood)
    return {
      districtId: aliasedNeighborhood.districtId,
      districtLabel: toReadableDistrictLabel(aliasedNeighborhood.districtLabel, trimmedCity),
      source: 'explicit_neighborhood',
      confidence: 0.9,
      reason: 'mapped from explicit neighborhood',
    }
  }

  const strongestCluster = pickStrongestCluster(spatial)
  if (!strongestCluster) {
    return createCityFallback(trimmedCity, citySlug)
  }

  const promotedDistrict =
    matchDistrictAlias(citySlug, strongestCluster.clusterId) ??
    strongestCluster.clusterNeighborhoods
      .map((value) => matchDistrictAlias(citySlug, value))
      .find(Boolean)

  if (promotedDistrict) {
    return {
      districtId: promotedDistrict.districtId,
      districtLabel: toReadableDistrictLabel(promotedDistrict.districtLabel, trimmedCity),
      source: 'inferred_district',
      confidence: roundToHundredths(clamp(0.75 + strongestCluster.clusterShare * 0.15, 0.75, 0.9)),
      reason: 'inferred from strongest cluster',
    }
  }

  if (strongestCluster.clusterShare >= 0.5) {
    const districtLabel = formatDistrictLabel(strongestCluster.clusterId)
    return {
      districtId: `${citySlug}.${slugifySegment(strongestCluster.clusterId)}`,
      districtLabel: toReadableDistrictLabel(districtLabel, trimmedCity),
      source: 'inferred_cluster',
      confidence: roundToHundredths(clamp(0.65 + strongestCluster.clusterShare * 0.2, 0.65, 0.85)),
      reason: 'inferred from strongest cluster',
    }
  }

  return createCityFallback(trimmedCity, citySlug)
}
