import type { Venue } from '../types/venue'

type ClusterAlias = {
  clusterId: string
  matches: string[]
}

const CITY_CLUSTER_ALIASES: Record<string, ClusterAlias[]> = {
  'san jose': [
    {
      clusterId: 'downtown-core',
      matches: ['downtown', 'sofa', 'san pedro'],
    },
    {
      clusterId: 'santana-row-corridor',
      matches: ['santana row', 'valley fair'],
    },
  ],
}

function normalizeLabel(value: string | undefined): string {
  return value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() ?? ''
}

function normalizeCity(value: string | undefined): string {
  const normalized = normalizeLabel(value)
  const [head] = normalized.split(',')
  return (head ?? normalized).trim()
}

export function getVenueClusterId(
  venue: Pick<Venue, 'city' | 'neighborhood' | 'driveMinutes'>,
): string {
  const normalizedCity = normalizeCity(venue.city)
  const normalizedNeighborhood = normalizeLabel(venue.neighborhood)
  const cityAliases = CITY_CLUSTER_ALIASES[normalizedCity] ?? []

  for (const alias of cityAliases) {
    if (alias.matches.some((match) => normalizedNeighborhood.includes(match))) {
      return alias.clusterId
    }
  }

  if (normalizedNeighborhood) {
    return normalizedNeighborhood
  }

  return `drive-band-${Math.floor(venue.driveMinutes / 4)}`
}
