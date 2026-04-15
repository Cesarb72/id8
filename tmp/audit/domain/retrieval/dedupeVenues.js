import { computeHybridLiveLift } from './computeHybridLiveLift';
function normalizeValue(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}
function buildNameSignature(value) {
    return normalizeValue(value)
        .split(/\s+/)
        .filter((part) => part.length > 1)
        .join(' ');
}
function isUnknownNeighborhood(value) {
    const normalized = normalizeValue(value);
    return normalized.length === 0 || normalized === 'unknown';
}
function getDuplicateReason(left, right) {
    if (left.category !== right.category) {
        return undefined;
    }
    const leftName = buildNameSignature(left.name);
    const rightName = buildNameSignature(right.name);
    if (!leftName || !rightName) {
        return undefined;
    }
    const sameNeighborhood = normalizeValue(left.neighborhood) === normalizeValue(right.neighborhood);
    const sameCity = normalizeValue(left.city) === normalizeValue(right.city);
    const ambiguousNeighborhood = isUnknownNeighborhood(left.neighborhood) || isUnknownNeighborhood(right.neighborhood);
    const nearEquivalentDrive = Math.abs(left.driveMinutes - right.driveMinutes) <= 2;
    if (!sameCity) {
        return undefined;
    }
    if (leftName === rightName && (sameNeighborhood || ambiguousNeighborhood || nearEquivalentDrive)) {
        return sameNeighborhood
            ? 'same normalized name and category in the same neighborhood'
            : ambiguousNeighborhood
                ? 'same normalized name and city with ambiguous neighborhood metadata'
                : 'same normalized name and category with nearly identical route distance';
    }
    if (sameNeighborhood && leftName.includes(rightName)) {
        return 'same-category venue with a longer live/curated name variant in the same neighborhood';
    }
    if (sameNeighborhood && rightName.includes(leftName)) {
        return 'same-category venue with a shorter live/curated name variant in the same neighborhood';
    }
    return undefined;
}
function pickPreferredVenue(left, right) {
    if (left.source.sourceOrigin !== right.source.sourceOrigin) {
        const liveVenue = left.source.sourceOrigin === 'live' ? left : right;
        const curatedVenue = left.source.sourceOrigin === 'curated' ? left : right;
        const liveLift = computeHybridLiveLift(liveVenue);
        const curatedScore = curatedVenue.source.qualityScore * 0.45 +
            curatedVenue.source.sourceConfidence * 0.25 +
            curatedVenue.signature.signatureScore * 0.16 +
            (curatedVenue.highlightCapable ? 0.08 : 0);
        if ((liveLift.strongLiveCandidate ||
            (liveVenue.source.qualityGateStatus !== 'suppressed' &&
                liveLift.dedupePriorityScore >= curatedScore - 0.02 &&
                liveVenue.signature.signatureScore >= curatedVenue.signature.signatureScore + 0.06)) &&
            liveVenue.signature.genericScore <= curatedVenue.signature.genericScore + 0.06) {
            return {
                preferred: liveVenue,
                reason: 'live record outranked curated on dedupe priority and stayed specific enough to keep',
            };
        }
        return {
            preferred: curatedVenue,
            reason: 'curated record kept the duplicate because its quality/signature stack stayed stronger than the live dedupe priority',
        };
    }
    if (left.source.qualityScore !== right.source.qualityScore) {
        return left.source.qualityScore >= right.source.qualityScore
            ? {
                preferred: left,
                reason: 'higher quality score won the duplicate tie',
            }
            : {
                preferred: right,
                reason: 'higher quality score won the duplicate tie',
            };
    }
    if (left.source.sourceConfidence !== right.source.sourceConfidence) {
        return left.source.sourceConfidence >= right.source.sourceConfidence
            ? {
                preferred: left,
                reason: 'higher source confidence won the duplicate tie',
            }
            : {
                preferred: right,
                reason: 'higher source confidence won the duplicate tie',
            };
    }
    return {
        preferred: left,
        reason: 'existing duplicate entry held on a tie',
    };
}
function computeNoveltyCollapse(removed, kept) {
    if (removed.source.sourceOrigin !== 'live' || kept.source.sourceOrigin !== 'curated') {
        return false;
    }
    return (removed.signature.signatureScore >= 0.55 ||
        removed.distinctivenessScore >= kept.distinctivenessScore ||
        computeHybridLiveLift(removed).strongLiveCandidate);
}
export function dedupeVenues(venues) {
    const deduped = [];
    let dedupedCount = 0;
    let dedupedLiveCount = 0;
    let liveDedupedAgainstCuratedCount = 0;
    let liveNoveltyCollapsedCount = 0;
    const losses = [];
    for (const venue of venues) {
        const duplicateIndex = deduped.findIndex((candidate) => Boolean(getDuplicateReason(candidate, venue)));
        if (duplicateIndex === -1) {
            deduped.push(venue);
            continue;
        }
        const current = deduped[duplicateIndex];
        const duplicateReason = getDuplicateReason(current, venue) ?? 'duplicate collapsed during source merge';
        dedupedCount += 1;
        const resolution = pickPreferredVenue(current, venue);
        const removed = resolution.preferred.id === current.id ? venue : current;
        const kept = resolution.preferred;
        if (removed.source.sourceOrigin === 'live') {
            dedupedLiveCount += 1;
        }
        const liveLostAgainstCurated = removed.source.sourceOrigin === 'live' && kept.source.sourceOrigin === 'curated';
        const liveNoveltyCollapsed = computeNoveltyCollapse(removed, kept);
        if (liveLostAgainstCurated) {
            liveDedupedAgainstCuratedCount += 1;
        }
        if (liveNoveltyCollapsed) {
            liveNoveltyCollapsedCount += 1;
        }
        if (removed.source.sourceOrigin === 'live' || kept.source.sourceOrigin === 'live') {
            losses.push({
                removedVenueId: removed.id,
                removedVenueName: removed.name,
                removedSourceOrigin: removed.source.sourceOrigin,
                keptVenueId: kept.id,
                keptVenueName: kept.name,
                keptSourceOrigin: kept.source.sourceOrigin,
                duplicateReason,
                preferenceReason: resolution.reason,
                liveLostAgainstCurated,
                liveNoveltyCollapsed,
                liveSignatureScore: removed.source.sourceOrigin === 'live'
                    ? Number((removed.signature.signatureScore * 100).toFixed(1))
                    : kept.source.sourceOrigin === 'live'
                        ? Number((kept.signature.signatureScore * 100).toFixed(1))
                        : undefined,
                keptSignatureScore: Number((kept.signature.signatureScore * 100).toFixed(1)),
                liveDistinctivenessScore: removed.source.sourceOrigin === 'live'
                    ? Number((removed.distinctivenessScore * 100).toFixed(1))
                    : kept.source.sourceOrigin === 'live'
                        ? Number((kept.distinctivenessScore * 100).toFixed(1))
                        : undefined,
                keptDistinctivenessScore: Number((kept.distinctivenessScore * 100).toFixed(1)),
            });
        }
        deduped[duplicateIndex] = kept;
    }
    return {
        venues: deduped,
        dedupedCount,
        dedupedLiveCount,
        liveDedupedAgainstCuratedCount,
        liveNoveltyCollapsedCount,
        losses,
    };
}
