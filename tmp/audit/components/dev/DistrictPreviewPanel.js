import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
function formatMetric(value, digits = 2) {
    if (value === undefined || Number.isNaN(value)) {
        return '—';
    }
    return value.toFixed(digits);
}
function formatRounded(value) {
    if (value === undefined || Number.isNaN(value)) {
        return '—';
    }
    return `${Math.round(value)}`;
}
function readSignal(source, keys) {
    if (!source) {
        return undefined;
    }
    for (const key of keys) {
        const value = source[key];
        if (typeof value === 'number') {
            return value;
        }
    }
    return undefined;
}
function getTierClass(tier) {
    if (tier === 'strong') {
        return 'district-preview-tier-strong';
    }
    if (tier === 'usable') {
        return 'district-preview-tier-usable';
    }
    if (tier === 'weak') {
        return 'district-preview-tier-weak';
    }
    return 'district-preview-tier-neutral';
}
export function DistrictPreviewPanel({ data, loading, error, locationQuery, }) {
    const ranked = data?.ranked ?? [];
    const rawPocketById = new Map((data?.rawPockets ?? []).map((pocket) => [pocket.id, pocket]));
    const identifiedById = new Map((data?.identifiedPockets ?? []).map((pocket) => [pocket.id, pocket]));
    const debugTraceById = new Map((data?.debug?.pocketTraces ?? []).map((trace) => [trace.pocketId, trace]));
    const pocketDiagnostics = data?.debug?.pocketDiagnostics;
    const rejectedPocketDiagnostics = pocketDiagnostics?.rejectedPockets ?? [];
    return (_jsxs("aside", { className: "district-preview-panel", children: [_jsxs("div", { className: "district-preview-header", children: [_jsx("p", { className: "district-preview-kicker", children: "District Preview" }), _jsx("h3", { children: data?.location.displayLabel ?? locationQuery }), _jsxs("p", { className: "district-preview-meta", children: ["entities ", data?.entities.length ?? 0, " | raw ", data?.rawPockets.length ?? 0, " | viable", ' ', data?.viablePockets.length ?? 0, " | rejected ", data?.rejectedPockets.length ?? 0, " | selected ", data?.selected.length ?? 0] }), _jsxs("p", { className: "district-preview-meta", children: ["source ", data?.location.source ?? 'n/a', " | city ", data?.location.meta.city ?? 'n/a', " | query \"", locationQuery || 'n/a', "\""] }), _jsxs("p", { className: "district-preview-meta", children: ["retrieval ", data?.retrieval.mode ?? 'n/a', " | curated ", data?.retrieval.curatedCount ?? 0, ' ', "| live fetched ", data?.retrieval.liveFetchedCount ?? 0, " | live accepted", ' ', data?.retrieval.liveAcceptedCount ?? 0, " | bootstrap ", data?.retrieval.bootstrapCount ?? 0] }), _jsxs("p", { className: "district-preview-meta", children: ["live raw ", data?.retrieval.liveRawFetchedCount ?? 0, " | mapped", ' ', data?.retrieval.liveMappedCount ?? 0, " (dropped ", data?.retrieval.liveMappedDroppedCount ?? 0, ") | normalized ", data?.retrieval.liveNormalizedCount ?? 0, " (dropped", ' ', data?.retrieval.liveNormalizationDroppedCount ?? 0, ") | suppressed", ' ', data?.retrieval.liveSuppressedCount ?? 0] }), _jsxs("p", { className: "district-preview-meta", children: ["geo buckets ", data?.retrieval.geoBucketCount ?? 0, " | dominant share", ' ', (data?.retrieval.dominantAreaShare ?? 0).toFixed(3), " | spread", ' ', (data?.retrieval.geoSpreadScore ?? 0).toFixed(3), " | downsampled", ' ', data?.retrieval.geoDiversityDownsampledCount ?? 0] }), data?.retrieval.notes && data.retrieval.notes.length > 0 && (_jsx("p", { className: "district-preview-meta", children: data.retrieval.notes[0] })), _jsxs("p", { className: "district-preview-meta", children: ["fallback ", String(data?.debug?.pathFlags.usedFallbackClustering ?? false), " | synthetic", ' ', String(data?.debug?.pathFlags.usedSyntheticFallback ?? false), " | promoted", ' ', String(data?.debug?.pathFlags.usedPromotedReject ?? false)] }), pocketDiagnostics && (_jsxs(_Fragment, { children: [_jsxs("p", { className: "district-preview-meta", children: ["debug raw ", pocketDiagnostics.rawPocketCount, " | debug viable", ' ', pocketDiagnostics.viablePocketCount, " | debug rejected", ' ', pocketDiagnostics.rejectedPocketCount] }), _jsxs("p", { className: "district-preview-meta", children: ["raw sizes:", ' ', pocketDiagnostics.rawPocketSizes.length > 0
                                        ? pocketDiagnostics.rawPocketSizes
                                            .map((entry) => `${entry.pocketId}:${entry.entityCount}`)
                                            .join(', ')
                                        : 'none'] })] }))] }), loading && _jsx("p", { className: "district-preview-status", children: "Loading district engine output\u2026" }), error && _jsx("p", { className: "district-preview-status error", children: error }), !loading && ranked.length === 0 && (_jsx("p", { className: "district-preview-status", children: "No pockets returned (check debug trace)" })), _jsx("div", { className: "district-preview-pocket-list", children: ranked.map((entry) => {
                    const profile = entry.profile;
                    const tasteSignals = profile.tasteSignals;
                    const rawPocket = rawPocketById.get(profile.pocketId);
                    const identifiedPocket = identifiedById.get(profile.pocketId);
                    const debugTrace = debugTraceById.get(profile.pocketId);
                    const legacyTasteSignals = profile.appSignals?.tasteSignals;
                    const stageNotes = [
                        ...new Set([
                            ...(profile.meta.originNotes ?? []),
                            ...(debugTrace?.stageNotes ?? []),
                        ]),
                    ];
                    const activityScore = readSignal(legacyTasteSignals, ['activityScore', 'socialDensity']);
                    const momentumScore = readSignal(legacyTasteSignals, ['momentumScore']);
                    const calmScore = readSignal(legacyTasteSignals, ['calmScore']);
                    return (_jsxs("section", { className: "district-preview-pocket", children: [_jsxs("div", { className: "district-preview-pocket-head", children: [_jsxs("div", { children: [_jsx("h4", { children: profile.label }), _jsxs("p", { className: "district-preview-inline", children: ["type ", profile.meta.identityKind, " | origin ", profile.meta.origin] })] }), _jsx("span", { className: `district-preview-tier ${getTierClass(profile.classification)}`, children: profile.classification })] }), _jsxs("p", { className: "district-preview-inline", children: ["rank ", entry.rank, " | score ", formatMetric(entry.score, 3), " | confidence", ' ', formatMetric(identifiedPocket?.identity.confidence, 3)] }), _jsx("p", { className: "district-preview-section-title", children: "Geometry" }), _jsxs("p", { className: "district-preview-inline", children: ["entities ", profile.entityCount, " | maxDist", ' ', formatRounded(rawPocket?.geometry.maxDistanceFromCentroidM), "m | elongation", ' ', formatMetric(rawPocket?.geometry.elongationRatio, 2), " | density", ' ', formatRounded(rawPocket?.geometry.densityEntitiesPerKm2)] }), _jsx("p", { className: "district-preview-section-title", children: "Field Snapshot" }), _jsxs("p", { className: "district-preview-inline", children: ["activity ", formatMetric(activityScore, 3), " | momentum ", formatMetric(momentumScore, 3), ' ', "| calm ", formatMetric(calmScore, 3)] }), _jsx("p", { className: "district-preview-section-title", children: "Taste Bridge" }), _jsxs("p", { className: "district-preview-inline", children: ["tags", ' ', tasteSignals.experientialTags.length > 0
                                        ? tasteSignals.experientialTags.join(', ')
                                        : 'none'] }), _jsxs("p", { className: "district-preview-inline", children: ["mix drinks ", formatMetric(tasteSignals.hospitalityMix.drinks, 2), " | dining", ' ', formatMetric(tasteSignals.hospitalityMix.dining, 2), " | culture", ' ', formatMetric(tasteSignals.hospitalityMix.culture, 2), " | cafe", ' ', formatMetric(tasteSignals.hospitalityMix.cafe, 2), " | activity", ' ', formatMetric(tasteSignals.hospitalityMix.activity, 2)] }), _jsxs("p", { className: "district-preview-inline", children: ["ambiance energy ", tasteSignals.ambianceProfile.energy, " | intimacy", ' ', tasteSignals.ambianceProfile.intimacy, " | noise", ' ', tasteSignals.ambianceProfile.noise] }), _jsxs("p", { className: "district-preview-inline", children: ["moment potential ", formatMetric(tasteSignals.momentPotential, 3)] }), tasteSignals.momentSeeds.length > 0 && (_jsxs(_Fragment, { children: [_jsx("p", { className: "district-preview-section-title", children: "Moment Seeds" }), _jsx("ul", { className: "district-preview-notes", children: tasteSignals.momentSeeds.map((seed, index) => (_jsx("li", { children: seed }, `${profile.pocketId}_moment_seed_${index}`))) })] })), _jsx("p", { className: "district-preview-section-title", children: "Cluster" }), _jsxs("p", { className: "district-preview-inline", children: ["source ", profile.meta.clusteringSource, " | stage notes ", stageNotes.length] }), stageNotes.length > 0 && (_jsx("ul", { className: "district-preview-notes", children: stageNotes.map((note, index) => (_jsx("li", { children: note }, `${profile.pocketId}_note_${index}`))) })), debugTrace?.composition && (_jsxs(_Fragment, { children: [_jsx("p", { className: "district-preview-section-title", children: "Composition" }), _jsxs("p", { className: "district-preview-inline", children: ["categories", ' ', debugTrace.composition.topCategories.length > 0
                                                ? debugTrace.composition.topCategories
                                                    .map((entry) => `${entry.key} (${entry.count})`)
                                                    .join(', ')
                                                : 'none'] }), _jsxs("p", { className: "district-preview-inline", children: ["lanes", ' ', debugTrace.composition.dominantLanes.length > 0
                                                ? debugTrace.composition.dominantLanes
                                                    .map((entry) => `${entry.key} (${entry.count})`)
                                                    .join(', ')
                                                : 'none'] }), _jsxs("p", { className: "district-preview-inline", children: ["category diversity ", debugTrace.composition.categoryDiversityCount, " | lane diversity ", debugTrace.composition.laneDiversityCount, " | lane score", ' ', formatMetric(debugTrace.composition.laneDiversityScore, 2)] }), debugTrace.composition.representativeEntityNames.length > 0 && (_jsxs(_Fragment, { children: [_jsx("p", { className: "district-preview-section-title", children: "Representative Entities" }), _jsx("ul", { className: "district-preview-notes", children: debugTrace.composition.representativeEntityNames.map((entityName, index) => (_jsx("li", { children: entityName }, `${profile.pocketId}_entity_${index}`))) })] }))] })), _jsx("p", { className: "district-preview-section-title", children: "Debug Flags" }), _jsxs("p", { className: "district-preview-inline", children: ["densityClamped ", String(rawPocket?.geometry.densityClamped ?? false), " | densityAreaFloorApplied", ' ', String(rawPocket?.geometry.densityAreaFloorApplied ?? false)] })] }, profile.pocketId));
                }) }), rejectedPocketDiagnostics.length > 0 && (_jsxs("div", { className: "district-preview-pocket-list", children: [_jsx("p", { className: "district-preview-section-title", children: "Rejected Pockets" }), rejectedPocketDiagnostics.map((rejectedPocket) => (_jsxs("section", { className: "district-preview-pocket", children: [_jsxs("div", { className: "district-preview-pocket-head", children: [_jsxs("div", { children: [_jsx("h4", { children: rejectedPocket.pocketId }), _jsxs("p", { className: "district-preview-inline", children: ["origin ", rejectedPocket.origin, " | source ", rejectedPocket.clusteringSource] })] }), _jsx("span", { className: `district-preview-tier ${getTierClass('reject')}`, children: "reject" })] }), _jsxs("p", { className: "district-preview-inline", children: ["entities ", rejectedPocket.entityCount, " | density", ' ', formatRounded(rejectedPocket.geometry.densityEntitiesPerKm2), " | maxDist", ' ', formatRounded(rejectedPocket.geometry.maxDistanceFromCentroidM), "m"] }), _jsx("p", { className: "district-preview-section-title", children: "Rejection Summary" }), _jsx("p", { className: "district-preview-inline", children: rejectedPocket.rejectionReasonSummary }), _jsx("p", { className: "district-preview-section-title", children: "Geometry Snapshot" }), _jsxs("p", { className: "district-preview-inline", children: ["centroid (", rejectedPocket.geometry.centroid.lat.toFixed(5), ",", ' ', rejectedPocket.geometry.centroid.lng.toFixed(5), ") | avgDist", ' ', formatRounded(rejectedPocket.geometry.avgDistanceFromCentroidM), "m | pairwise", ' ', formatRounded(rejectedPocket.geometry.maxPairwiseDistanceM), "m | bbox", ' ', formatRounded(rejectedPocket.geometry.bboxWidthM), "x", formatRounded(rejectedPocket.geometry.bboxHeightM), "m | elongation", ' ', formatMetric(rejectedPocket.geometry.elongationRatio, 2)] }), rejectedPocket.rejectionReasons.length > 0 && (_jsxs(_Fragment, { children: [_jsx("p", { className: "district-preview-section-title", children: "Rejection Detail" }), _jsx("ul", { className: "district-preview-notes", children: rejectedPocket.rejectionReasons.map((reason, index) => (_jsx("li", { children: reason }, `${rejectedPocket.pocketId}_reason_${index}`))) })] }))] }, rejectedPocket.pocketId)))] }))] }));
}
