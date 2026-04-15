export function getSpatialMode(distanceMode) {
    return distanceMode === 'nearby' ? 'walkable' : 'flexible';
}
