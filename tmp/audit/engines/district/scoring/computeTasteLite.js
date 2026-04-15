function toFixed(value) {
    return Number(Math.max(0, Math.min(1, value)).toFixed(3));
}
export function computeTasteLite(pocket) {
    // TODO(district-engine, phase-4): Replace this placeholder with true interpretation/taste features.
    const socialDensity = toFixed(pocket.entities.reduce((sum, entity) => sum + (entity.signals?.activity ?? 0), 0) /
        Math.max(1, pocket.entities.length));
    const confidence = toFixed(pocket.entities.reduce((sum, entity) => sum + (entity.signals?.trust ?? 0), 0) /
        Math.max(1, pocket.entities.length));
    return {
        socialDensity,
        confidence,
    };
}
