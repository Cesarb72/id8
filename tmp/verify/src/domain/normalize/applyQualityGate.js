import { computeLiveQualityFairness } from '../retrieval/computeLiveQualityFairness';
function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
function meaningfulTagCount(venue) {
    return venue.tags.filter((tag) => tag.trim().length >= 4).length;
}
function hasAnySignal(venue, candidates) {
    const normalized = new Set([...venue.tags, ...venue.source.sourceTypes].map((value) => value.trim().toLowerCase()));
    return candidates.some((candidate) => normalized.has(candidate.toLowerCase()));
}
export function applyQualityGate(venue) {
    const notes = [];
    const approvalBlockers = [];
    const demotionReasons = [];
    const suppressionReasons = [];
    let status = 'approved';
    let hoursDemotionApplied = false;
    let hoursSuppressionApplied = false;
    const tagCount = meaningfulTagCount(venue);
    const isLiveSource = venue.source.sourceOrigin === 'live';
    const supportedLiveCategories = new Set([
        'restaurant',
        'bar',
        'cafe',
        'dessert',
        'museum',
        'activity',
        'park',
        'event',
    ]);
    const nonCoreLiveCategory = venue.category !== 'restaurant' &&
        venue.category !== 'bar' &&
        venue.category !== 'cafe';
    const unsupportedLiveCategory = isLiveSource && !supportedLiveCategories.has(venue.category);
    const fastFoodLike = hasAnySignal(venue, [
        'fast-food',
        'fast-food-restaurant',
        'meal-takeaway',
        'meal-delivery',
        'drive-through',
    ]);
    const convenienceLike = hasAnySignal(venue, [
        'convenience-store',
        'gas-station',
        'grocery-store',
        'supermarket',
    ]);
    const likelyClosedNow = !venue.source.likelyOpenForCurrentWindow && venue.source.timeConfidence >= 0.7;
    const stronglyClosedNow = !venue.source.likelyOpenForCurrentWindow && venue.source.timeConfidence >= 0.86;
    const highConfidenceOpenNow = venue.source.likelyOpenForCurrentWindow && venue.source.timeConfidence >= 0.68;
    const liveFairness = computeLiveQualityFairness(venue);
    const supportApprovalCandidate = liveFairness.supportRecoveryEligible &&
        venue.settings.highlightCapabilityTier !== 'connective-only';
    const completenessPenalty = venue.source.missingFields.length * 0.07;
    const effectiveGenericScore = clamp01(venue.signature.genericScore - liveFairness.genericRelief);
    const effectiveSourceConfidence = clamp01(venue.source.sourceConfidence + (supportApprovalCandidate ? 0.03 : 0));
    const genericPenalty = effectiveGenericScore * 0.32;
    const chainPenalty = venue.signature.chainLike ? 0.16 : 0;
    const hoursPenalty = isLiveSource && likelyClosedNow
        ? stronglyClosedNow
            ? Math.max(0.1, 0.18 - liveFairness.hoursGrace)
            : Math.max(0.03, 0.08 - liveFairness.hoursGrace)
        : isLiveSource && !venue.source.hoursKnown
            ? Math.max(0.004, 0.025 - liveFairness.hoursGrace)
            : 0;
    const hoursBonus = isLiveSource && highConfidenceOpenNow ? 0.06 : 0;
    const completenessScore = clamp01(1 - completenessPenalty);
    const qualityScore = clamp01(effectiveSourceConfidence * 0.36 +
        completenessScore * 0.24 +
        venue.signature.signatureScore * 0.2 +
        (1 - effectiveGenericScore) * 0.12 +
        venue.settings.highlightConfidence * 0.08 +
        liveFairness.qualityBonus +
        hoursBonus -
        hoursPenalty -
        chainPenalty -
        genericPenalty);
    if (venue.signature.chainLike) {
        notes.push('chain-like profile');
    }
    if (effectiveGenericScore >= 0.64) {
        notes.push('generic venue signature');
    }
    if (tagCount < 2) {
        notes.push('thin descriptive tagging');
    }
    if (venue.source.missingFields.length > 2) {
        notes.push('source record is missing several engine fields');
    }
    if (venue.settings.supportOnly) {
        notes.push('support-shaped venue');
    }
    if (isLiveSource && nonCoreLiveCategory) {
        notes.push('extended live category candidate');
    }
    if (fastFoodLike) {
        notes.push('fast-food / takeaway signal');
    }
    if (convenienceLike) {
        notes.push('convenience signal');
    }
    if (isLiveSource && venue.source.hoursKnown) {
        notes.push(venue.source.likelyOpenForCurrentWindow
            ? 'hours signal supports current planning window'
            : 'hours signal conflicts with current planning window');
    }
    if (isLiveSource && !venue.source.hoursKnown) {
        notes.push('hours are unknown for the current planning window');
    }
    for (const note of liveFairness.notes) {
        notes.push(note);
    }
    if (supportApprovalCandidate) {
        notes.push('live support candidate has a viable path to approval');
    }
    if (effectiveSourceConfidence < 0.36 &&
        venue.source.missingFields.length >= 3 &&
        venue.settings.highlightCapabilityTier !== 'highlight-capable') {
        suppressionReasons.push('low-confidence record with weak completeness');
    }
    if (venue.signature.chainLike &&
        effectiveGenericScore >= 0.78 &&
        venue.settings.highlightCapabilityTier !== 'highlight-capable') {
        suppressionReasons.push('generic chain-like venue is too low-signal for current inventory');
    }
    if (tagCount < 2 &&
        venue.shortDescription.trim().length < 28 &&
        venue.settings.highlightCapabilityTier === 'connective-only') {
        suppressionReasons.push('too little descriptive signal to normalize reliably');
    }
    if (unsupportedLiveCategory) {
        suppressionReasons.push('unsupported category for live place ingestion');
    }
    if (isLiveSource &&
        nonCoreLiveCategory &&
        venue.source.sourceConfidence < 0.53 &&
        venue.source.completenessScore < 0.55 &&
        venue.settings.highlightCapabilityTier === 'connective-only') {
        suppressionReasons.push('extended live category lacked minimum confidence and completeness');
    }
    if (isLiveSource &&
        (venue.source.businessStatus === 'temporarily-closed' ||
            venue.source.businessStatus === 'closed-permanently')) {
        suppressionReasons.push(`live venue is ${venue.source.businessStatus}`);
        hoursSuppressionApplied = true;
    }
    if (isLiveSource &&
        stronglyClosedNow &&
        venue.settings.highlightCapabilityTier === 'highlight-capable') {
        suppressionReasons.push('live highlight-capable venue appears closed for the current planning window');
        hoursSuppressionApplied = true;
    }
    if (isLiveSource && (fastFoodLike || convenienceLike)) {
        suppressionReasons.push('unsupported low-signal place type for live restaurant/bar/cafe ingestion');
    }
    if (isLiveSource &&
        effectiveGenericScore >= 0.8 &&
        effectiveSourceConfidence < 0.56 &&
        venue.settings.highlightCapabilityTier !== 'highlight-capable' &&
        !liveFairness.supportRecoveryEligible) {
        suppressionReasons.push('live venue is too generic for the current engine slice');
    }
    if (suppressionReasons.length > 0) {
        status = 'suppressed';
        approvalBlockers.push(...suppressionReasons);
    }
    else {
        if (qualityScore < (supportApprovalCandidate ? 0.54 : 0.62)) {
            demotionReasons.push('quality score stayed below the approval floor');
        }
        if (effectiveGenericScore >= (supportApprovalCandidate ? 0.68 : 0.6)) {
            demotionReasons.push('generic signature kept the venue below approval');
        }
        if (effectiveSourceConfidence < (supportApprovalCandidate ? 0.5 : 0.55)) {
            demotionReasons.push('source confidence stayed below the approval floor');
        }
        if (isLiveSource &&
            likelyClosedNow &&
            venue.settings.highlightCapabilityTier !== 'connective-only') {
            demotionReasons.push('hours signal stayed too soft for confident approval');
        }
        if (isLiveSource &&
            !venue.source.hoursKnown &&
            effectiveGenericScore >= (supportApprovalCandidate ? 0.72 : 0.64) &&
            venue.settings.highlightCapabilityTier !== 'highlight-capable' &&
            !liveFairness.supportRecoveryEligible) {
            demotionReasons.push('unknown hours kept a generic live venue below approval');
        }
        if (isLiveSource &&
            effectiveGenericScore >= (supportApprovalCandidate ? 0.72 : 0.68) &&
            effectiveSourceConfidence < (supportApprovalCandidate ? 0.62 : 0.7) &&
            !liveFairness.supportRecoveryEligible) {
            demotionReasons.push('generic live metadata still outweighed trust signals');
        }
        if (venue.settings.supportOnly &&
            effectiveGenericScore >= (supportApprovalCandidate ? 0.62 : 0.52) &&
            venue.settings.highlightConfidence < (supportApprovalCandidate ? 0.54 : 0.6)) {
            demotionReasons.push('support-shaped venue still lacked enough signature to approve outright');
        }
    }
    if (demotionReasons.length > 0) {
        status = 'demoted';
        approvalBlockers.push(...demotionReasons);
        hoursDemotionApplied =
            hoursDemotionApplied ||
                (isLiveSource &&
                    ((likelyClosedNow && venue.settings.highlightCapabilityTier !== 'connective-only') ||
                        (!venue.source.hoursKnown &&
                            effectiveGenericScore >= 0.58 &&
                            venue.settings.highlightCapabilityTier !== 'highlight-capable')));
    }
    return {
        status,
        qualityScore: Number(qualityScore.toFixed(2)),
        notes: [...new Set(notes)],
        approvalBlockers: [...new Set(approvalBlockers)],
        demotionReasons: [...new Set(demotionReasons)],
        suppressionReasons,
        hoursDemotionApplied,
        hoursSuppressionApplied,
    };
}
