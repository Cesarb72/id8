function toFixed(value) {
    return Number(Math.max(0, Math.min(1, value)).toFixed(3));
}
function titleCase(value) {
    return value
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map((segment) => segment[0].toUpperCase() + segment.slice(1))
        .join(' ');
}
export function makeIdentityDecision(pocket, signals) {
    if (signals.dominantNeighborhood && signals.neighborhoodDominance >= 0.45) {
        const confidence = toFixed(0.58 + signals.neighborhoodDominance * 0.32);
        return {
            pocketLabel: `${signals.dominantNeighborhood} Pocket`,
            kind: 'known_neighborhood',
            confidence,
            signals: {
                neighborhoodDominance: signals.neighborhoodDominance,
                dominantCategory: signals.dominantCategory,
                dominantCategoryShare: signals.dominantCategoryShare,
            },
            rationale: [
                'Neighborhood majority observed across clustered entities.',
                'Label uses inferred local grouping, not formal boundary certainty.',
            ],
        };
    }
    if (signals.dominantCategoryShare >= 0.55) {
        return {
            pocketLabel: `${titleCase(signals.dominantCategory)} Cluster`,
            kind: 'inferred',
            confidence: toFixed(0.46 + signals.dominantCategoryShare * 0.28),
            signals: {
                dominantCategory: signals.dominantCategory,
                dominantCategoryShare: signals.dominantCategoryShare,
                walkability: signals.walkabilityScore,
            },
            rationale: [
                'Functional identity inferred from category concentration.',
                'No stable neighborhood certainty available from current evidence.',
            ],
        };
    }
    return {
        pocketLabel: `Local Pocket ${pocket.id.replace('raw-pocket-', '')}`,
        kind: 'unknown',
        confidence: toFixed(0.35 + signals.walkabilityScore * 0.18),
        signals: {
            walkability: signals.walkabilityScore,
            entityCount: signals.entityCount,
        },
        rationale: [
            'Mixed pocket identity; kept generic to avoid false neighborhood certainty.',
        ],
    };
}
