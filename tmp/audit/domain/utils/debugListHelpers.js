export function formatIdList(ids) {
    return ids.length > 0 ? ids.join(', ') : 'n/a';
}
export function truncateText(value, maxLength) {
    if (value.length <= maxLength) {
        return value;
    }
    return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}
export function formatCollapsedIdPreview(ids, previewCount = 4) {
    if (ids.length === 0) {
        return 'n/a';
    }
    const preview = ids.slice(0, previewCount).join(', ');
    const suffix = ids.length > previewCount ? ', ...' : '';
    return `${ids.length} [${preview}${suffix}]`;
}
export function computeJaccardOverlap(left, right) {
    const leftSet = new Set(left);
    const rightSet = new Set(right);
    if (leftSet.size === 0 && rightSet.size === 0) {
        return 1;
    }
    const intersectionCount = [...leftSet].filter((id) => rightSet.has(id)).length;
    const unionCount = new Set([...leftSet, ...rightSet]).size;
    if (unionCount === 0) {
        return 0;
    }
    return intersectionCount / unionCount;
}
export function formatJaccard(value) {
    return Number.isFinite(value) ? value.toFixed(2) : 'n/a';
}
export function formatSignedScore(value) {
    const normalized = Number(value.toFixed(3));
    return normalized >= 0 ? `+${normalized.toFixed(3)}` : normalized.toFixed(3);
}
export function areStageOverlapFingerprintsEqual(left, right) {
    if (!left) {
        return false;
    }
    return (left.scenarioKey === right.scenarioKey &&
        left.topPocketIds.join('|') === right.topPocketIds.join('|') &&
        left.directionCandidatePocketIds.join('|') === right.directionCandidatePocketIds.join('|') &&
        left.retrievedVenueIds.join('|') === right.retrievedVenueIds.join('|') &&
        left.rolePoolVenueIds.join('|') === right.rolePoolVenueIds.join('|') &&
        left.highlightShortlistIds.join('|') === right.highlightShortlistIds.join('|') &&
        left.finalStopVenueIds.join('|') === right.finalStopVenueIds.join('|'));
}
