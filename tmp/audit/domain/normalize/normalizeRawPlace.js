import { applyQualityGate } from './applyQualityGate';
import { inferHoursPressure } from './inferHoursPressure';
import { getNormalizedCategory } from './getNormalizedCategory';
import { inferVenueSignals } from './inferVenueSignals';
function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
function collectMissingFields(raw) {
    const missing = [];
    if (!raw.city) {
        missing.push('city');
    }
    if (!raw.neighborhood) {
        missing.push('neighborhood');
    }
    if (typeof raw.driveMinutes !== 'number') {
        missing.push('driveMinutes');
    }
    if (!raw.priceTier) {
        missing.push('priceTier');
    }
    if (!raw.shortDescription) {
        missing.push('shortDescription');
    }
    if (!raw.narrativeFlavor) {
        missing.push('narrativeFlavor');
    }
    if (!raw.tags || raw.tags.length === 0) {
        missing.push('tags');
    }
    return missing;
}
export function normalizeRawPlace(raw, options = {}) {
    const categoryResult = getNormalizedCategory(raw);
    const inferred = inferVenueSignals({
        raw,
        category: categoryResult.category,
    });
    const hoursPressure = inferHoursPressure({
        raw,
        category: categoryResult.category,
        timeWindowSignal: options.timeWindowSignal,
    });
    const missingFields = collectMissingFields(raw);
    const completenessScore = clamp01(1 - missingFields.length * 0.1);
    const sourceConfidence = clamp01(typeof raw.sourceConfidence === 'number'
        ? raw.sourceConfidence
        : 0.58 + completenessScore * 0.18 + inferred.signature.signatureScore * 0.1);
    const sourceOrigin = raw.sourceOrigin ?? (raw.normalizedFromRawType === 'seed' ? 'curated' : 'live');
    const baseVenue = {
        id: raw.id,
        name: raw.name,
        city: raw.city ?? 'San Jose',
        neighborhood: raw.neighborhood ?? 'Unknown',
        driveMinutes: raw.driveMinutes ?? 14,
        category: categoryResult.category,
        subcategory: raw.subcategoryHint ?? categoryResult.subcategory,
        priceTier: raw.priceTier ?? '$$',
        tags: raw.tags ?? [],
        useCases: inferred.useCases,
        vibeTags: inferred.vibeTags,
        energyLevel: inferred.energyLevel,
        socialDensity: inferred.socialDensity,
        uniquenessScore: inferred.uniquenessScore,
        distinctivenessScore: inferred.distinctivenessScore,
        underexposureScore: inferred.underexposureScore,
        shareabilityScore: inferred.shareabilityScore,
        isChain: inferred.isChain,
        localSignals: inferred.localSignals,
        roleAffinity: inferred.roleAffinity,
        imageUrl: raw.imageUrl ?? '',
        shortDescription: raw.shortDescription ?? `${raw.name} with a usable local fit profile.`,
        narrativeFlavor: raw.narrativeFlavor ?? 'A normalized venue waiting for stronger narrative detail.',
        isHiddenGem: inferred.isHiddenGem,
        isActive: raw.isActive ?? true,
        highlightCapable: inferred.settings.highlightCapabilityTier === 'highlight-capable',
        durationProfile: inferred.durationProfile,
        settings: inferred.settings,
        signature: inferred.signature,
        source: {
            normalizedFromRawType: raw.normalizedFromRawType ?? 'raw-place',
            sourceOrigin,
            provider: raw.provider,
            providerRecordId: raw.providerRecordId,
            latitude: raw.latitude,
            longitude: raw.longitude,
            sourceQueryLabel: raw.sourceQueryLabel,
            sourceConfidence: Number(sourceConfidence.toFixed(2)),
            completenessScore: Number(completenessScore.toFixed(2)),
            qualityScore: 0,
            openNow: hoursPressure.openNow,
            hoursKnown: hoursPressure.hoursKnown,
            likelyOpenForCurrentWindow: hoursPressure.likelyOpenForCurrentWindow,
            businessStatus: hoursPressure.businessStatus,
            timeConfidence: hoursPressure.timeConfidence,
            hoursPressureLevel: hoursPressure.hoursPressureLevel,
            hoursPressureNotes: hoursPressure.hoursPressureNotes,
            hoursDemotionApplied: false,
            hoursSuppressionApplied: false,
            sourceTypes: [...new Set([...(raw.placeTypes ?? []), ...(raw.sourceTypes ?? [])])],
            missingFields,
            inferredFields: inferred.inferredFields,
            qualityGateStatus: 'approved',
            qualityGateNotes: [],
            approvalBlockers: [],
            demotionReasons: [],
            suppressionReasons: [],
        },
    };
    const qualityGate = applyQualityGate(baseVenue);
    return {
        ...baseVenue,
        source: {
            ...baseVenue.source,
            qualityScore: qualityGate.qualityScore,
            qualityGateStatus: qualityGate.status,
            qualityGateNotes: qualityGate.notes,
            approvalBlockers: qualityGate.approvalBlockers,
            demotionReasons: qualityGate.demotionReasons,
            suppressionReasons: qualityGate.suppressionReasons,
            hoursDemotionApplied: qualityGate.hoursDemotionApplied,
            hoursSuppressionApplied: qualityGate.hoursSuppressionApplied,
        },
    };
}
