function toFixed(value) {
    return Number(value.toFixed(3));
}
function getDominantNeighborhood(pocket) {
    const counts = new Map();
    for (const entity of pocket.entities) {
        const neighborhood = entity.metadata?.neighborhood;
        if (!neighborhood) {
            continue;
        }
        counts.set(neighborhood, (counts.get(neighborhood) ?? 0) + 1);
    }
    if (counts.size === 0) {
        return { neighborhood: undefined, dominance: 0 };
    }
    const [neighborhood, count] = [...counts.entries()].sort((left, right) => {
        if (right[1] !== left[1]) {
            return right[1] - left[1];
        }
        return left[0].localeCompare(right[0]);
    })[0];
    return {
        neighborhood,
        dominance: count / pocket.entities.length,
    };
}
function getDominantCategory(pocket) {
    const entries = Object.entries(pocket.categoryCounts);
    if (entries.length === 0) {
        return { category: 'mixed', share: 0 };
    }
    const [category, count] = entries.sort((left, right) => {
        if (right[1] !== left[1]) {
            return right[1] - left[1];
        }
        return left[0].localeCompare(right[0]);
    })[0];
    return {
        category,
        share: count / pocket.entities.length,
    };
}
export function computeIdentitySignals(pocket) {
    const neighborhood = getDominantNeighborhood(pocket);
    const category = getDominantCategory(pocket);
    return {
        dominantNeighborhood: neighborhood.neighborhood,
        neighborhoodDominance: toFixed(neighborhood.dominance),
        dominantCategory: category.category,
        dominantCategoryShare: toFixed(category.share),
        entityCount: pocket.entities.length,
        walkabilityScore: pocket.viability.signals.walkabilityScore,
    };
}
