const CITY_CLUSTER_ALIASES = {
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
};
function normalizeLabel(value) {
    return value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() ?? '';
}
function normalizeCity(value) {
    const normalized = normalizeLabel(value);
    const [head] = normalized.split(',');
    return (head ?? normalized).trim();
}
export function getVenueClusterId(venue) {
    const normalizedCity = normalizeCity(venue.city);
    const normalizedNeighborhood = normalizeLabel(venue.neighborhood);
    const cityAliases = CITY_CLUSTER_ALIASES[normalizedCity] ?? [];
    for (const alias of cityAliases) {
        if (alias.matches.some((match) => normalizedNeighborhood.includes(match))) {
            return alias.clusterId;
        }
    }
    if (normalizedNeighborhood) {
        return normalizedNeighborhood;
    }
    return `drive-band-${Math.floor(venue.driveMinutes / 4)}`;
}
