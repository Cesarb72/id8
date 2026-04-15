import { applyQualityGate } from './applyQualityGate';
import { getNormalizedCategory } from './getNormalizedCategory';
import { inferHoursPressure } from './inferHoursPressure';
import { inferVenueSignals } from './inferVenueSignals';
import { normalizeRawPlace } from './normalizeRawPlace';
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
    if (!raw.shortDescription) {
        missing.push('shortDescription');
    }
    if (!raw.narrativeFlavor) {
        missing.push('narrativeFlavor');
    }
    return missing;
}
function normalizeRawEvent(raw, options = {}) {
    const categoryResult = getNormalizedCategory(raw);
    const inferred = inferVenueSignals({
        raw,
        category: categoryResult.category,
    });
    const missingFields = collectMissingFields(raw);
    const completenessScore = clamp01(1 - missingFields.length * 0.11);
    const sourceConfidence = clamp01(typeof raw.sourceConfidence === 'number'
        ? raw.sourceConfidence
        : 0.52 + completenessScore * 0.16 + inferred.signature.signatureScore * 0.1);
    const hoursPressure = inferHoursPressure({
        raw: {
            ...raw,
            rawType: 'place',
            placeTypes: raw.eventTypes,
        },
        category: categoryResult.category,
        timeWindowSignal: options.timeWindowSignal,
    });
    const sourceOrigin = raw.sourceOrigin ?? (raw.normalizedFromRawType === 'seed' ? 'curated' : 'live');
    const baseVenue = {
        id: raw.id,
        name: raw.name,
        city: raw.city ?? 'San Jose',
        neighborhood: raw.neighborhood ?? 'Unknown',
        driveMinutes: raw.driveMinutes ?? 16,
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
        shortDescription: raw.shortDescription ?? `${raw.name} with event-like local signal.`,
        narrativeFlavor: raw.narrativeFlavor ?? 'An event-shaped venue normalized for engine use.',
        isHiddenGem: inferred.isHiddenGem,
        isActive: raw.isActive ?? true,
        highlightCapable: inferred.settings.highlightCapabilityTier === 'highlight-capable',
        durationProfile: inferred.durationProfile,
        settings: {
            ...inferred.settings,
            eventCapable: true,
            performanceCapable: raw.performanceCapable ?? inferred.settings.performanceCapable,
        },
        signature: inferred.signature,
        source: {
            normalizedFromRawType: raw.normalizedFromRawType ?? 'raw-event',
            sourceOrigin,
            provider: raw.provider,
            providerRecordId: raw.providerRecordId,
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
            sourceTypes: [...new Set([...(raw.eventTypes ?? []), ...(raw.sourceTypes ?? [])])],
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
export function normalizeVenue(raw, options = {}) {
    if (raw.rawType === 'place') {
        return normalizeRawPlace(raw, options);
    }
    return normalizeRawEvent(raw, options);
}
